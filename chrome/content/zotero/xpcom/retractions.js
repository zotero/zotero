/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Retractions = {
	TYPE_DOI: 'd',
	TYPE_PMID: 'p',
	TYPE_NAMES: ['DOI', 'PMID'],
	
	FLAG_NORMAL: 0,
	FLAG_HIDDEN: 1,
	FLAG_NO_CITATION_WARNING: 2,
	
	_prefObserverRegistered: false,
	_initialized: false,
	_version: 1,
	
	init: async function () {
		this._resetState();
		
		if (!this._prefObserverRegistered) {
			Zotero.Prefs.registerObserver('retractions.enabled', this._handlePrefChange.bind(this));
			this._prefObserverRegistered = true;
		}
		
		if (!Zotero.Prefs.get('retractions.enabled')) {
			return;
		}
		
		// Load mappings of keys (DOI hashes and PMIDs) to items and vice versa and register for
		// item changes so they can be kept up to date in notify().
		await this._cacheKeyMappings();
		Zotero.Notifier.registerObserver(this, ['item', 'group', 'sync'], 'retractions', 20);
		
		// Load in the cached prefix list that we check new items against
		try {
			await this._loadCacheFile();
		}
		catch (e) {
			Zotero.logError("Error loading retractions cache file");
			Zotero.logError(e);
		}
		
		// Load existing retracted items
		var rows = await Zotero.DB.queryAsync(
			"SELECT libraryID, itemID, DI.itemID IS NOT NULL AS deleted, RI.flag FROM items "
				+ "JOIN retractedItems RI USING (itemID) "
				+ "LEFT JOIN deletedItems DI USING (itemID)"
		);
		for (let row of rows) {
			this._retractedItems.set(row.itemID, row.flag);
			if (!row.deleted && row.flag != this.FLAG_HIDDEN) {
				if (!this._retractedItemsByLibrary[row.libraryID]) {
					this._retractedItemsByLibrary[row.libraryID] = new Set();
				}
				this._retractedItemsByLibrary[row.libraryID].add(row.itemID);
			}
		}
		
		this._initialized = true;
		
		// If no cache file or it was created with a different version, download list at startup
		if (!this._cacheETag || this._cacheVersion != this._version) {
			Zotero.Schema.schemaUpdatePromise.then(() => {
				if (Zotero.test) {
					Zotero.debug("Skipping retraction list download in test mode");
					return;
				}
				this.updateFromServer();
			});
		}
	},
	
	_resetState: function () {
		this._initialized = false;
		this._keyItems = {};
		this._itemKeys = {};
		this._queuedItems = new Set();
		this._queuedPrefixStrings = new Set();
		this._retractedItems = new Map();
		this._retractedItemsByLibrary = {};
		this._librariesWithRetractions = new Set();
		this._cacheVersion = null;
		this._cacheETag = null;
		this._cacheDOIPrefixLength = null;
		this._cachePMIDPrefixLength = null;
		this._cachePrefixList = new Set();
		this._suppressAlerts = false;
	},
	
	/**
	 * If item was retracted and the retraction hasn't been hidden
	 *
	 * @param {Zotero.Item} item
	 * @return {Boolean}
	 */
	isRetracted: function (item) {
		var flag = this._retractedItems.get(item.id);
		return flag !== undefined && flag !== this.FLAG_HIDDEN;
	},
	
	/**
	 * If item was retracted and hasn't been marked to not show citation warnings
	 *
	 * @param {Zotero.Item}
	 * @return {Boolean}
	 */
	shouldShowCitationWarning: function (item) {
		return this._retractedItems.get(item.id) === this.FLAG_NORMAL;
	},
	
	/**
	 * Don't show any future retraction warnings for this item
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise}
	 */
	hideRetraction: async function (item) {
		return this._updateItemFlag(item, this.FLAG_HIDDEN);
	},
	
	/**
	 * Don't show future citation warnings for this item
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise}
	 */
	disableCitationWarningsForItem: async function (item) {
		return this._updateItemFlag(item, this.FLAG_NO_CITATION_WARNING);
	},
	
	_updateItemFlag: async function (item, flag) {
		this._retractedItems.set(item.id, flag);
		await Zotero.DB.queryAsync(
			"UPDATE retractedItems SET flag=? WHERE itemID=?",
			[flag, item.id]
		);
		await Zotero.Notifier.trigger('modify', 'item', [item.id]);
	},
	
	getRetractionsFromJSON: Zotero.serial(async function (jsonItems) {
		// TODO: Save as retractions-cache with etag and cache and use for other checks
		var keyCache = this._keyCache;
		if (!keyCache) {
			this._keyCache = keyCache = {
				[this.TYPE_DOI]: new Map(),
				[this.TYPE_PMID]: new Map(),
			};
		}
		
		var matchingIndexes = new Set();
		var valuesToCheck = [];
		for (let i = 0; i < jsonItems.length; i++) {
			let json = jsonItems[i];
			
			// DOI
			let doi;
			if (json.DOI) {
				doi = json.DOI;
			}
			else if (json.extra) {
				let { fields } = Zotero.Utilities.Internal.extractExtraFields(json.extra);
				let extraField = fields.get('DOI');
				if (extraField) {
					doi = extraField;
				}
			}
			if (doi) {
				doi = Zotero.Utilities.cleanDOI(doi);
			}
			if (doi) {
				valuesToCheck.push({
					type: this.TYPE_DOI,
					value: doi,
					index: i
				});
			}
			
			// PMID
			if (json.extra) {
				let pmid = this._extractExtraFields(json.extra).pmid;
				if (pmid) {
					valuesToCheck.push({
						type: this.TYPE_PMID,
						value: pmid,
						index: i
					});
				}
			}
		}
		
		// Check all possible values
		var keyIndexes = new Map();
		var prefixStringsToCheck = [];
		for (let { type, value, index } of valuesToCheck) {
			// See if we've already cached a result for this key
			let key = this._valueToKey(type, value);
			let cachedResult = keyCache[type].get(key);
			if (cachedResult !== undefined) {
				if (cachedResult) {
					matchingIndexes.add(index);
				}
				continue;
			}
			
			// Otherwise, check prefix against list
			let prefixStr = this._getPrefixString(type, value, this._getCachedPrefixLength(type));
			if (this._cachePrefixList.has(prefixStr)) {
				prefixStringsToCheck.push(prefixStr);
				
				// Map key to array index
				let indexes = keyIndexes.get(key);
				if (!indexes) {
					indexes = new Set();
					keyIndexes.set(key, indexes);
				}
				indexes.add(index);
			}
			
			// Set all keys to false in the cache. Any that match will be set to true below.
			keyCache[type].set(key, false);
		}
		
		if (prefixStringsToCheck.length) {
			let possibleMatches = await this._downloadPossibleMatches(prefixStringsToCheck);
			for (let row of possibleMatches) {
				if (row.doi) {
					let indexes = keyIndexes.get(row.doi);
					if (indexes !== undefined) {
						for (let index of indexes) {
							matchingIndexes.add(index);
						}
					}
					
					keyCache[this.TYPE_DOI].set(row.doi, true);
				}
				if (row.pmid) {
					let indexes = keyIndexes.get(row.pmid);
					if (indexes !== undefined) {
						for (let index of indexes) {
							matchingIndexes.add(index);
						}
					}
					
					keyCache[this.TYPE_PMID].set(row.pmid, true);
				}
			}
		}
		
		// TODO: Save key cache to disk with current ETag
		
		return [...matchingIndexes];
	}),
	
	libraryHasRetractedItems: function (libraryID) {
		return !!(this._retractedItemsByLibrary[libraryID]
			&& this._retractedItemsByLibrary[libraryID].size);
	},
	
	_addLibraryRetractedItem: async function (libraryID, itemID) {
		if (!this._retractedItemsByLibrary[libraryID]) {
			this._retractedItemsByLibrary[libraryID] = new Set();
		}
		this._retractedItemsByLibrary[libraryID].add(itemID);
		await this._updateLibraryRetractions(libraryID);
	},
	
	_removeLibraryRetractedItem: async function (libraryID, itemID) {
		// Might not exist if retracted item was in trash at startup or when detected
		if (!this._retractedItemsByLibrary[libraryID]) {
			return;
		}
		this._retractedItemsByLibrary[libraryID].delete(itemID);
		await this._updateLibraryRetractions(libraryID);
	},
	
	_updateLibraryRetractions: async function (libraryID) {
		var previous = this._librariesWithRetractions.has(libraryID);
		var current = this.libraryHasRetractedItems(libraryID);
		
		// Update Retracted Items virtual collection
		if (Zotero.Libraries.exists(libraryID)
				// Changed
				&& (previous != current
					// Explicitly hidden
					|| (current && !Zotero.Prefs.getVirtualCollectionStateForLibrary(libraryID, 'retracted')))) {
			let promises = [];
			for (let zp of Zotero.getZoteroPanes()) {
				if (!zp.loaded) continue;
				promises.push(zp.setVirtual(libraryID, 'retracted', current));
				zp.hideRetractionBanner();
			}
			await Promise.all(promises);
		}
		
		if (current) {
			this._librariesWithRetractions.add(libraryID);
		}
		else {
			this._librariesWithRetractions.delete(libraryID);
		}
	},
	
	_resetLibraryRetractions: function (libraryID) {
		delete this._retractedItemsByLibrary[libraryID];
		this._updateLibraryRetractions(libraryID);
	},
	
	/**
	 * Return retraction data for an item
	 *
	 * @param {Zotero.Item} item
	 * @return {Object|false}
	 */
	getData: async function (item) {
		var data = await Zotero.DB.valueQueryAsync(
			"SELECT data FROM retractedItems WHERE itemID=?", item.id
		);
		if (!data) {
			return false;
		}
		try {
			data = JSON.parse(data);
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		
		try {
			if (data.date) {
				data.date = Zotero.Date.sqlToDate(data.date);
			}
			else {
				data.date = null;
			}
		}
		catch (e) {
			Zotero.logError("Error parsing retraction date: " + data.date);
			data.date = null;
		}
		
		return data;
	},
	
	getReasonDescription: function (reason) {
		var description = this._reasonDescriptions[reason];
		if (!description) {
			Zotero.warn(`Description not found for retraction reason "${reason}"`);
			return '';
		}
		return description;
	},
	
	notify: async function (action, type, ids, extraData) {
		// The observer is removed when disabled but something might already be in progress
		if (!this._initialized) {
			return;
		}
		
		if (type == 'sync') {
			// If there's no stored user yet, this is the first sync on this computer.
			// Suppress the retraction banner until the sync completes -- we don't want
			// to alert on items that were already in the library before we started
			// checking.
			if (action == 'start' && !Zotero.Users.getCurrentUserID()) {
				this._suppressAlerts = true;
			}
			else if (action == 'finish') {
				this._suppressAlerts = false;
			}
			return;
		}

		// Clean up cache on group deletion
		if (type == 'group') {
			if (action == 'delete') {
				for (let libraryID of ids) {
					this._resetLibraryRetractions(libraryID);
				}
			}
			return;
		}
		
		// Items
		if (action == 'add') {
			for (let id of ids) {
				this._updateItem(Zotero.Items.get(id));
			}
		}
		else if (action == 'modify') {
			for (let id of ids) {
				let item = Zotero.Items.get(id);
				for (let type of this.TYPE_NAMES) {
					let typeID = this['TYPE_' + type];
					let fieldVal = this['_getItem' + type](item);
					if (fieldVal) {
						// If the item isn't already mapped to the key, re-map and re-check
						let key = this._itemKeys[typeID].get(item.id);
						let newKey = this._valueToKey(typeID, fieldVal);
						if (key != newKey) {
							this._deleteItemKeyMappings(id);
							this._updateItem(item);
							continue;
						}
					}
					// If a previous key value was cleared, re-map and re-check
					else if (this._itemKeys[typeID].get(item.id)) {
						this._deleteItemKeyMappings(id);
						this._updateItem(item);
						continue;
					}
				}
				// We don't want to show the virtual collection for items in the trash, so add or
				// remove from the library set depending on whether it's in the trash. This is
				// handled for newly detected items in _addEntry(), which gets called by
				// _updateItem() above after a delay (such that the item won't yet be retracted
				// here).
				let flag = this._retractedItems.get(item.id);
				if (flag !== undefined) {
					if (item.deleted || flag == this.FLAG_HIDDEN) {
						await this._removeLibraryRetractedItem(item.libraryID, item.id);
					}
					else {
						await this._addLibraryRetractedItem(item.libraryID, item.id);
					}
				}
			}
		}
		else if (action == 'delete') {
			let removedItemIDs = [];
			for (let id of ids) {
				if (await this._removeEntry(id, extraData[id].libraryID)) {
					removedItemIDs.push(id);
				}
			}
			if (removedItemIDs.length) {
				await Zotero.Notifier.trigger('refresh', 'item', removedItemIDs);
			}
		}
	},
	
	/**
	 * Check for possible matches for items in the queue (debounced)
	 */
	checkQueuedItems: Zotero.Utilities.debounce(async function () {
		return this._checkQueuedItemsInternal();
	}, 1000),
	
	_checkQueuedItemsInternal: async function () {
		Zotero.debug("Checking updated items for retractions");
		
		// If no possible matches, clear retraction flag on any items that changed
		if (!this._queuedPrefixStrings.size) {
			let removedItemIDs = [];
			for (let item of this._queuedItems) {
				if (await this._removeEntry(item.id, item.libraryID)) {
					removedItemIDs.push(item.id);
				}
			}
			this._queuedItems.clear();
			if (removedItemIDs.length) {
				await Zotero.Notifier.trigger('refresh', 'item', removedItemIDs);
			}
			return;
		}
		
		var items = [...this._queuedItems];
		var prefixStrings = [...this._queuedPrefixStrings];
		this._queuedItems.clear();
		this._queuedPrefixStrings.clear();
		var addedItems = [];
		try {
			let possibleMatches = await this._downloadPossibleMatches(prefixStrings);
			addedItems = await this._addPossibleMatches(possibleMatches);
		}
		catch (e) {
			// Add back to queue on failure
			for (let item of items) {
				this._queuedItems.add(item);
			}
			for (let prefixStr of prefixStrings) {
				this._queuedPrefixStrings.add(prefixStr);
			}
			throw e;
		}
		
		// Remove retraction status for items that were checked but didn't match
		let removedItemIDs = [];
		for (let item of items) {
			if (!addedItems.includes(item.id)) {
				if (await this._removeEntry(item.id, item.libraryID)) {
					removedItemIDs.push(item.id);
				}
			}
		}
		if (removedItemIDs.length) {
			await Zotero.Notifier.trigger('refresh', 'item', removedItemIDs);
		}
	},
	
	updateFromServer: Zotero.serial(async function () {
		if (!this._initialized) {
			return;
		}
		
		// Download list
		var headers = {};
		if (this._cacheETag) {
			headers["If-None-Match"] = this._cacheETag;
		}
		var req = await Zotero.HTTP.request(
			"GET",
			this._getURLPrefix() + 'list',
			{
				headers,
				noCache: true,
				successCodes: [200, 304]
			}
		);
		if (req.status == 304) {
			Zotero.debug("Retraction list is up to date");
			return;
		}
		var etag = req.getResponseHeader('ETag');
		var list = req.response.split('\n').filter(x => x);
		
		if (!list.length) {
			Zotero.logError("Empty retraction list from server");
			return;
		}
		
		// Calculate prefix length automatically
		var doiPrefixLength;
		var pmidPrefixLength = 0;
		for (let row of list) {
			let [prefixStr, _date] = row.split(' ');
			let type = prefixStr[0];
			let prefix = prefixStr.substr(1);
			if (type == this.TYPE_DOI && !doiPrefixLength) {
				doiPrefixLength = prefix.length;
			}
			else if (type == this.TYPE_PMID) {
				pmidPrefixLength = Math.max(pmidPrefixLength, prefix.length);
			}
		}
		
		// Get all keys and compute prefixes to check for possible matches
		var prefixStrings = new Set([
			...Array.from(this._keyItems[this.TYPE_DOI].keys())
				.map(x => this.TYPE_DOI + x.substr(0, doiPrefixLength)),
			...Array.from(this._keyItems[this.TYPE_PMID].keys())
				.map(x => this.TYPE_PMID + x.substr(0, pmidPrefixLength))
		]);
		var prefixesToSend = new Set();
		for (let row of list) {
			let [prefixStr, _date] = row.split(' ');
			let type = prefixStr[0];
			let prefix = prefixStr.substr(1);
			if (!type || !prefix) {
				Zotero.warn("Bad line in retractions data: " + row);
				continue;
			}
			if (prefixStrings.has(prefixStr)) {
				prefixesToSend.add(prefixStr);
			}
		}
		
		if (prefixesToSend.size) {
			let possibleMatches = await this._downloadPossibleMatches([...prefixesToSend]);
			await this._addPossibleMatches(possibleMatches, true);
		}
		else {
			Zotero.debug("No possible retractions");
			await this._addPossibleMatches([], true);
		}
		
		await this._saveCacheFile(list, etag, doiPrefixLength, pmidPrefixLength);
	}),
	
	
	/**
	 * @param {String[]} prefixStrings
	 * @return {Object[]} - Results from API search
	 */
	_downloadPossibleMatches: async function (prefixStrings) {
		var req = await Zotero.HTTP.request(
			"POST",
			this._getURLPrefix() + 'search',
			{
				body: JSON.stringify(prefixStrings),
				responseType: 'json'
			}
		);
		var results = req.response;
		Zotero.debug(`Retrieved ${results.length} possible `
			+ Zotero.Utilities.pluralize(results.length, ['match', 'matches']));
		
		results.push(...this._fixedResults);
		return results;
	},
	
	/**
	 * @param {Object[]} possibleMatches - Results from API search
	 * @param {Boolean} [removeExisting = false] - Remove retracted flag from all items that don't
	 *     match the results. This should only be true if possibleMatches includes all possible
	 *     matches in the database.
	 * @return {Number[]} - Array of added item ids
	 */
	_addPossibleMatches: async function (possibleMatches, removeExisting) {
		// Look in the key mappings for local items that match and add them as retractions
		var addedItemIDs = new Set();
		var allItemIDs = new Set();
		for (let row of possibleMatches) {
			if (row.doi) {
				let ids = this._keyItems[this.TYPE_DOI].get(row.doi);
				if (ids) {
					for (let id of ids) {
						if (!this._retractedItems.has(id)) {
							addedItemIDs.add(id);
						}
						allItemIDs.add(id);
						await this._addEntry(id, row);
					}
				}
			}
			if (row.pmid) {
				let ids = this._keyItems[this.TYPE_PMID].get(row.pmid.toString());
				if (ids) {
					for (let id of ids) {
						if (!this._retractedItems.has(id)) {
							addedItemIDs.add(id);
						}
						allItemIDs.add(id);
						await this._addEntry(id, row);
					}
				}
			}
		}
		
		// Remove existing retracted items that no longer match
		var removedItemIDs = [];
		if (removeExisting) {
			for (let itemID of this._retractedItems.keys()) {
				if (!allItemIDs.has(itemID)) {
					let item = await Zotero.Items.getAsync(itemID);
					if (await this._removeEntry(itemID, item.libraryID)) {
						removedItemIDs.push(itemID);
					}
				}
			}
		}
		
		var msg = `Found ${addedItemIDs.size} retracted `
			+ Zotero.Utilities.pluralize(addedItemIDs.size, 'item');
		if (removedItemIDs.length) {
			msg += " and removed " + removedItemIDs.length;
		}
		Zotero.debug(msg);
		addedItemIDs = [...addedItemIDs];
		// Refresh the items whose retraction state changed
		let changedItemIDs = [...addedItemIDs, ...removedItemIDs];
		if (changedItemIDs.length) {
			await Zotero.Notifier.trigger('refresh', 'item', changedItemIDs);
		}
		if (addedItemIDs.length && !this._suppressAlerts) {
			this._showAlert(addedItemIDs); // async
		}
		return addedItemIDs;
	},
	
	_showAlert: async function (itemIDs) {
		// Don't show banner for items in the trash
		var items = await Zotero.Items.getAsync(itemIDs);
		items = items.filter(item => !item.deleted);
		if (!items.length) {
			return;
		}
		Zotero.Prefs.set('retractions.recentItems', JSON.stringify(items.map(item => item.id)));
		var zp = Zotero.getActiveZoteroPane();
		if (zp) {
			await zp.showRetractionBanner();
		}
	},
	
	_getItemDOI: function (item) {
		var itemDOI = item.getField('DOI') || item.getExtraField('DOI');
		if (itemDOI) {
			itemDOI = Zotero.Utilities.cleanDOI(itemDOI);
		}
		return itemDOI || null;
	},
	
	_getItemPMID: function (item) {
		return this._extractExtraFields(item.getField('extra')).pmid;
	},
	
	// TEMP
	_extractExtraFields: function (str) {
		var fields = {
			doi: null,
			pmid: null
		};
		if (!str) {
			return fields;
		}
		var lines = str.split(/\n+/g);
		for (let line of lines) {
			let parts = line.match(/^([a-z -]+):(.+)/i);
			if (!parts) {
				continue;
			}
			let [_, originalField, value] = parts;
			
			let field = originalField.trim().toLowerCase()
				// Strip spaces
				.replace(/\s+/g, '')
				// Old citeproc.js cheater syntax
				.replace(/{:([^:]+):([^}]+)}/);
			value = value.trim();
			
			if (field == 'doi' && !fields.doi) {
				fields.doi = value;
			}
			else if ((field == 'pmid' || field == 'pubmedid') && !fields.pmid) {
				fields.pmid = value;
			}
			
			if (fields.doi && fields.pmid) {
				break;
			}
		}
		return fields;
	},
	
	_valueToKey: function (type, value) {
		if (type == this.TYPE_DOI) {
			// DOIs are case-insensitive
			value = value.toLowerCase();
			return Zotero.Utilities.Internal.sha1(value);
		}
		return value;
	},
	
	_getPrefixString: function (type, value, length) {
		switch (type) {
			case this.TYPE_DOI: {
				let hash = this._valueToKey(this.TYPE_DOI, value);
				return this.TYPE_DOI + hash.substr(0, length);
			}
			
			case this.TYPE_PMID: {
				return this.TYPE_PMID + value.substr(0, length);
			}
		}
		throw new Error("Unsupported type " + type);
	},
	
	_getCachedPrefixLength: function (type) {
		switch (type) {
			case this.TYPE_DOI: {
				return this._cacheDOIPrefixLength;
			}
			
			case this.TYPE_PMID: {
				return this._cachePMIDPrefixLength;
			}
		}
		throw new Error("Unsupported type " + type);
	},
	
	_cacheKeyMappings: async function () {
		this._keyItems[this.TYPE_DOI] = new Map();
		this._itemKeys[this.TYPE_DOI] = new Map();
		this._keyItems[this.TYPE_PMID] = new Map();
		this._itemKeys[this.TYPE_PMID] = new Map();
		
		var doiFieldID = Zotero.ItemFields.getID('DOI');
		var extraFieldID = Zotero.ItemFields.getID('extra');
		
		var sql = "SELECT itemID AS id, fieldID, value FROM itemData "
			+ "JOIN itemDataValues USING (valueID) WHERE fieldID IN (?, ?)";
		var rows = await Zotero.DB.queryAsync(
			sql,
			[
				doiFieldID,
				extraFieldID
			]
		);
		
		for (let row of rows) {
			// DOI field
			if (row.fieldID == doiFieldID) {
				let value = Zotero.Utilities.cleanDOI(row.value);
				if (value) {
					this._addItemKeyMapping(this.TYPE_DOI, value, row.id);
				}
			}
			// Extra field
			else {
				// DOI
				/*
				let { fields } = Zotero.Utilities.Internal.extractExtraFields(row.value);
				let doi = fields.get('DOI');
				if (!doi) continue;
				*/
				let { doi, pmid } = this._extractExtraFields(row.value);
				
				if (doi) {
					let value = Zotero.Utilities.cleanDOI(doi);
					if (value) {
						this._addItemKeyMapping(this.TYPE_DOI, value, row.id);
					}
				}
				
				// PMID
				/*
				let { fields } = Zotero.Utilities.Internal.extractExtraFields(row.value);
				let pmid = fields.get('pmid') || fields.get('pubmedID');
				if (!pmid) continue;
				this._addItemKeyMapping(this.TYPE_PMID, pmid, row.id);
				*/
				//let pmid = this._extractPMID(row.value);
				if (pmid) {
					this._addItemKeyMapping(this.TYPE_PMID, pmid, row.id);
				}
			}
		}
	},
	
	_addItemKeyMapping: function (type, value, itemID) {
		var key = this._valueToKey(type, value);
		// Map key to item id
		var ids = this._keyItems[type].get(key);
		if (!ids) {
			ids = new Set();
			this._keyItems[type].set(key, ids);
		}
		ids.add(itemID);
		
		// Map item id to key so we can clear on change
		this._itemKeys[type].set(itemID, key);
	},
	
	_deleteItemKeyMappings: function (itemID) {
		for (let type of [this.TYPE_DOI, this.TYPE_PMID]) {
			var key = this._itemKeys[type].get(itemID);
			if (key) {
				this._keyItems[type].get(key).delete(itemID);
				this._itemKeys[type].delete(itemID);
			}
		}
	},
	
	/**
	 * Add new key mappings for an item, check if it matches a cached prefix, and queue it for full
	 * checking if so
	 */
	_updateItem: function (item) {
		if (!item.isRegularItem()) {
			return;
		}
		this._queuedItems.add(item);
		let doi = this._getItemDOI(item);
		if (doi) {
			this._addItemKeyMapping(this.TYPE_DOI, doi, item.id);
			let prefixStr = this._getPrefixString(this.TYPE_DOI, doi, this._cacheDOIPrefixLength);
			if (this._cachePrefixList.has(prefixStr)) {
				this._queuedPrefixStrings.add(prefixStr);
			}
		}
		let pmid = this._getItemPMID(item);
		if (pmid) {
			this._addItemKeyMapping(this.TYPE_PMID, pmid, item.id);
			let prefixStr = this._getPrefixString(this.TYPE_PMID, pmid, this._cachePMIDPrefixLength);
			if (this._cachePrefixList.has(prefixStr)) {
				this._queuedPrefixStrings.add(prefixStr);
			}
		}
		this.checkQueuedItems();
	},
	
	_addEntry: async function (itemID, data) {
		var o = {};
		Object.assign(o, data);
		// Replace original ids with retraction ids
		if (data.retractionDOI) o.doi = data.retractionDOI;
		if (data.retractionPMID) o.pmid = data.retractionPMID;
		delete o.retractionDOI;
		delete o.retractionPMID;
		
		var sql = "REPLACE INTO retractedItems (itemID, data) VALUES (?, ?)";
		await Zotero.DB.queryAsync(sql, [itemID, JSON.stringify(o)]);
		
		var item = await Zotero.Items.getAsync(itemID);
		var libraryID = item.libraryID;
		// Check whether the retraction is already hidden by the user
		var flag = this._retractedItems.get(itemID);
		// An item already known to be retracted needs no refresh
		var isNew = flag === undefined;
		if (isNew) {
			this._retractedItems.set(itemID, this.FLAG_NORMAL);
		}
		if (!item.deleted && flag !== this.FLAG_HIDDEN) {
			if (!this._retractedItemsByLibrary[libraryID]) {
				this._retractedItemsByLibrary[libraryID] = new Set();
			}
			this._retractedItemsByLibrary[libraryID].add(itemID);
			await this._updateLibraryRetractions(libraryID);
		}
		
		return isNew;
	},
	
	_removeEntry: async function (itemID, libraryID) {
		this._deleteItemKeyMappings(itemID);
		
		if (!this._retractedItems.has(itemID)) {
			return false;
		}
		
		await Zotero.DB.queryAsync("DELETE FROM retractedItems WHERE itemID=?", itemID);
		this._retractedItems.delete(itemID);
		this._retractedItemsByLibrary[libraryID].delete(itemID);
		await this._updateLibraryRetractions(libraryID);
		
		return true;
	},
	
	_removeAllEntries: async function () {
		var libraryIDs = await Zotero.DB.columnQueryAsync(
			"SELECT libraryID FROM items WHERE itemID IN (SELECT itemID FROM retractedItems)"
		);
		var itemIDs = await Zotero.DB.columnQueryAsync("SELECT itemID FROM retractedItems");
		if (!itemIDs.length) {
			return;
		}
		await Zotero.DB.queryAsync("DELETE FROM retractedItems");
		this._retractedItems.clear();
		this._retractedItemsByLibrary = {};
		for (let libraryID of libraryIDs) {
			await this._updateLibraryRetractions(libraryID);
		}
		await Zotero.Notifier.trigger('refresh', 'item', itemIDs);
	},
	
	_loadCacheFile: async function () {
		var cacheFile = OS.Path.join(Zotero.Profile.dir, 'retractions.json');
		if (!(await OS.File.exists(cacheFile))) {
			return;
		}
		var data = JSON.parse(await Zotero.File.getContentsAsync(cacheFile));
		if (data) {
			this._processCacheData(data);
		}
	},
	
	_processCacheData: function (data) {
		this._cacheVersion = data.version;
		this._cacheETag = data.etag;
		this._cacheDOIPrefixLength = data.doiPrefixLength;
		this._cachePMIDPrefixLength = data.pmidPrefixLength;
		this._cachePrefixList = new Set();
		for (let row of data.data) {
			this._cachePrefixList.add(row.split(' ')[0]);
		}
		// Add hard-coded prefixes
		for (let row of this._fixedResults) {
			if (row.doi) {
				this._cachePrefixList.add(this.TYPE_DOI + row.doi);
			}
			if (row.pmid) {
				this._cachePrefixList.add(this.TYPE_PMID + row.pmid);
			}
		}
	},
	
	/**
	 * Cache prefix list in profile directory
	 */
	_saveCacheFile: async function (data, etag, doiPrefixLength, pmidPrefixLength) {
		var cacheFile = OS.Path.join(Zotero.Profile.dir, 'retractions.json');
		var cacheJSON = {
			version: this._version,
			etag,
			doiPrefixLength,
			pmidPrefixLength,
			data
		};
		try {
			await Zotero.File.putContentsAsync(cacheFile, JSON.stringify(cacheJSON));
			this._processCacheData(cacheJSON);
		}
		catch (e) {
			Zotero.logError("Error caching retractions data: " + e);
		}
	},
	
	_getURLPrefix: function () {
		var url = (Zotero.Prefs.get("api.url") || ZOTERO_CONFIG.API_URL);
		if (!url.endsWith('/')) {
			url += '/';
		}
		url += 'retractions/';
		return url;
	},
	
	_handlePrefChange: async function () {
		// Enable
		if (Zotero.Prefs.get('retractions.enabled')) {
			await this.init();
		}
		// Disable
		else {
			if (this._notifierID) {
				Zotero.Notifier.unregisterObserver(this._notifierID);
				delete this._notifierID;
			}
			await this._removeAllEntries();
			this._resetState();
			let cacheFile = OS.Path.join(Zotero.Profile.dir, 'retractions.json');
			await OS.File.remove(cacheFile);
		}
	},
	
	// https://retractionwatch.com/retraction-watch-database-user-guide/retraction-watch-database-user-guide-appendix-b-reasons/
	_reasonDescriptions: {
		"Author Unresponsive": "The corresponding author(s) did not respond to journal/publisher requests for response, clarification, etc., about one or more concerns/issues with a publication. Retraction Watch does not apply this reason when the lack of response is only to the language or posting of a notice of correction/EOC/retraction.",
		"Bias Issues or Lack of Balance": "Any question, controversy or dispute about balance or bias in any of the methods, analyses, results or any part of the published content. Retraction Watch entries using this reason do not state or imply, nor should users infer, any intentionality.",
		"Breach of Policy by Author": "A journal/publisher/institution states that one or more authors violated one or more of the journal/publisher/institution’s policy(ies). Retraction Watch will use this reason when no other information about the correction/EOC/retraction is available (i.e., the notice only states that there was a breach of policy), or when the breach of policy (as an additional reason) cannot be addressed by existing reasons.",
		"Cites Retracted Work": "Retracted content is used in citations or referencing.",
		"Civil Proceedings": "Civil legal proceedings were instigated in response to the article and/or notice(s), or civil legal proceedings resulted in the correction/EOC/retraction/etc.",
		"Complaints about Author": "Complaints about one or more authors in addition to concerns about the original article. Retraction Watch may also use this reason for cases in which something about one or more authors is called into question following any notice, i.e., when complaints escalate to being entirely author-based.",
		"Complaints about Company/Institution": "Complaints about one or more companies/institutions in addition to concerns about the original article. Retraction Watch may also use this reason for cases in which something about one or more companies/institutions is called into question following any notice, i.e., when complaints escalate to being entirely company/institution-based.",
		"Complaints about Third Party": "Complaints about one or more third parties in addition to concerns about the original article. Retraction Watch may also use this reason for cases in which something about one or more third parties is called into question following any notice, ie., when complaints escalate to being entirely third party-based.",
		"Compromised Peer Review": "The peer review was not performed in accordance with the journal’s guidelines or ethical standards",
		"Computer-Aided Content or Computer-Generated Content": "Contains any content that was created via a text generator, randomizing algorithm, generative AI, etc. Some examples of these tools include Mathgen, Scigen, ChatGPT.",
		"Concerns/Issues about Animal Welfare": "Any question, controversy or dispute about any non-human test or study subject(s).",
		"Concerns/Issues about Article": "Any question, controversy or dispute about published content, or undefined sections of it.",
		"Concerns/Issues about Authorship/Affiliation": "Any question, controversy or dispute about authorship and/or affiliation, except for false/forged authorship or false/forged affiliation. False/forged authorship or false/forged affiliation are covered under their own reasons.",
		"Concerns/Issues about Data": "Any question, controversy or dispute about any of the data.",
		"Concerns/Issues about Human Subject Welfare": "Any question, controversy or dispute about any human test or study subject(s).",
		"Concerns/Issues about Image": "Any question, controversy or dispute about one or more images, or part(s) of one or more images.",
		"Concerns/Issues about Methods": "Any question, controversy or dispute about any of the methods.",
		"Concerns/Issues about Peer Review": "The peer review was not performed solely through journal error, or there are problems with the peer review that are not covered under “Compromised Peer Review”.",
		"Concerns/Issues about Referencing/Attributions": "Any question, controversy or dispute about references, citations, attributions, etc. This could include fabricated/falsified references, reference stacking, citing other work with an EOC or correction, etc.",
		"Concerns/Issues about Results and/or Conclusions": "Any question, controversy or dispute about the results and/or conclusions.",
		"Concerns/Issues about Third Party Involvement": "Any question, controversy or dispute about third party involvement.",
		"Conflict of Interest": "Any question, controversy or dispute about author(s), editor(s), any third party and/or peer reviewer(s) having affiliations with companies, associations or institutions that may serve to influence how they conduct their role in any part of the research and/or publication process(es).",
		"Contamination of Cell Lines/Tissues": "Impurities were found or suspected within cell lines or tissues.",
		"Contamination of Materials": "Impurities were found or suspected within compounds, reagents or solutions used in experiments.",
		"Copyright Claims": "Dispute concerning permissions or ownership of materials (equipment, cell lines, etc.), technologies, images, text, patents, etc.",
		"Criminal Proceedings": "Criminal legal proceedings were instigated in response to the publication and/or notice(s), or criminal legal proceedings resulted in the correction/EOC/retraction/etc.",
		"Date of Article and/or Notice Unknown": "The article and/or notice do not have clear publication dates. Retraction Watch may also use this reason when a publisher overwrites the original article’s HTML page with the notice, without changing the publication date to reflect the change.",
		"Doing the Right Thing": "An attribution made by co-founders of Retraction Watch indicating admirable behavior by one of the involved parties",
		"Duplication of Content through Error by Journal/Publisher": "Duplication of published content due to an error by the journal or publisher.",
		"Duplication of Data": "Duplication of any of the data.",
		"Duplication of/in Article": "Duplication of a published item, or undefined sections of it.",
		"Duplication of/in Image": "Duplication of one or more images, or part(s) of one or more images.",
		"Duplication of Text": "Duplication of any of the text.",
		"EOC Lifted": "Expression of Concern has been removed or is no longer applicable. Not to be confused with an “Upgraded to Retraction”",
		"Error by Journal/Publisher": "An error attributed to a journal/publisher.",
		"Error by Third Party": "An error attributed to any third party.",
		"Error in Analyses": "One or more errors in the evaluation of any of the data or in any calculation(s).",
		"Error in Cell Lines/Tissues": "One or more errors in the choice or identification of any of the cell lines or tissues.",
		"Error in Data": "One or more errors in any of the data.",
		"Error in Image": "One or more errors in one or more images, or part(s) of one or more images.",
		"Error in Materials": "One or more errors in one or more experimental materials, including reagents, mixing bowls, equipment or instrumentation.",
		"Error in Methods": "One or more errors in the choice of and/or implementation of experimental protocol(s).",
		"Error in Results and/or Conclusions": "One or more errors in any of the results and/or the conclusions.",
		"Error in Text": "One or more errors in any of the text.",
		"Ethical Violations by Author": "When a journal/publisher/institution states that one or more authors have not met the journal/publisher/institution’s standards of publishing and/or research ethics. Retraction Watch will use this reason when no other information about the correction/EOC/retraction is available (i.e., the notice only states that there was an ethical violation), or when the ethical violation (as an additional reason) cannot be addressed by existing reasons.",
		"Ethical Violations by Company/Institution/Third Party": "When a journal/publisher/institution states that one or more company(ies)/institution(s)/third party(ies) have not met the journal/publisher/institution’s standards of publishing and/or research ethics. Retraction Watch will use this reason when no other information about the correction/EOC/retraction is available (i.e., the notice only states that there was an ethical violation), or when the ethical violation (as an additional reason) cannot be addressed by existing reasons.",
		"Euphemisms for Duplication": "The notice does not clearly state that the authors reused ideas, text, or images from one of their previously published items without suitable citation",
		"Euphemisms for Misconduct": "The notice does not explicitly state that the reason for the notice is due to misconduct, despite a journal, publisher, company, institution, government agency or author explicitly stating that there was misconduct.",
		"Euphemisms for Plagiarism": "The notice describes plagiarism of material without using the words “plagiarize(d)” or “plagiarism.”",
		"False/Forged Affiliation": "The false/forged use of an affiliation/institutional name in the publication process.",
		"False/Forged Authorship": "The false/forged use of one or more author names in the publication process.",
		"Falsification/Fabrication of Data": "Falsification or fabrication of any data in order to mislead.",
		"Falsification/Fabrication of Image": "Falsification or fabrication in/of one or more images, or part(s) of one or more images, in order to mislead.",
		"Falsification/Fabrication of Results": "Falsification or fabrication of results in order to mislead.",
		"Hoax Paper": "The paper was intentionally drafted with fabricated or falsified data or other content with the goal of testing a journal or publisher’s manuscript acceptance policies.",
		"Informed/Patient Consent - None/Withdrawn": "When informed/patient consent documentation is deemed insufficient or is not available or the participant later disputes/withdraws their approval.",
		"Investigation by Company/Institution": "An investigation by the company/institution listed as the affiliation of one or more authors.",
		"Investigation by Journal/Publisher": "An investigation by the journal/publisher of the article.",
		"Investigation by ORI": "An investigation by the United States Office of Research Integrity (ORI).",
		"Investigation by Third Party": "An investigation by any third party that is not the United States Office of Research Integrity (ORI).",
		"Lack of Approval from Author": "One or more authors did not approve one or more parts of the research or publication process(es). Retraction Watch also uses this reason if the notice mentions a lack of documentation of alleged approval.",
		"Lack of Approval from Company/Institution": "One or more companies/institutions did not approve one or more parts of the research or publication process(es). Retraction Watch also uses this reason if the notice mentions a lack of documentation of alleged approval.",
		"Lack of Approval from Third Party": "One or more third parties did not approve one or more parts of the research or publication process(es). Retraction Watch also uses this reason if the notice mentions a lack of documentation of alleged approval.",
		"Lack of IRB/IACUC Approval and/or Compliance": "Failure to obtain consent from the institutional ethical review board overseeing human or animal experimentation prior to initiation of study, or failure to provide proof of such",
		"Legal Reasons and/or Threats": "When a journal/publisher/author/third party uses the phrase “legal reasons,” documents litigation or legal threats, or mentions one or more specific laws",
		"Manipulation of Data": "Manipulation of any data.",
		"Manipulation of Images": "Manipulation of one or more images, or part(s) of one or more images.",
		"Manipulation of Results": "Manipulation of any results.",
		"Miscommunication with/by Author": "One or more authors misunderstood one or more parts of a message sent to and/or from one or more authors.",
		"Miscommunication with/by Company/Institution": "One or more companies/institutions misunderstood one or more parts of a message sent to and/or from one or more companies/institutions.",
		"Miscommunication with/by Journal/Publisher": "One or more journals/publishers misunderstood one or more parts of a message sent to and/or from one or more journals/publishers.",
		"Miscommunication with/by Third Party": "One or more third parties misunderstood one or more parts of a message sent to and/or from one or more third parties.",
		"Misconduct by Author": "Statement by journal, publisher, company, institution, government agency or author that one or more authors committed misconduct.",
		"Misconduct by Company/Institution": "Statement by journal, publisher, company, institution, government agency or author that one or more companies/institutions committed misconduct.",
		"Misconduct by Third Party": "Statement by journal, publisher, company, institution, government agency or author that one or more third party(ies) committed misconduct.",
		"Misconduct - Official Investigation(s) and/or Finding(s)": "An investigation by an incorporated company, institution or government agency into misconduct allegations (founded or unfounded) and/or the finding(s) of misconduct by an incorporated company, institution or government agency.",
		"No Further Action": "The journal or publisher has stated that no further action will be taken.",
		"Nonpayment of Fees and/or Refusal to Pay": "Fees for services, licenses or access were not paid and/or completed, and/or there was a refusal to pay fees.",
		"Notice - Lack of": "No notice was published by the journal or publisher.",
		"Notice - Limited or No Information": "A notice provides minimal information as to the cause of the notice, or the original item is watermarked as retracted or corrected without explanation",
		"Notice - Unable to Access via current resources": "The notice is paywalled by the journal/publisher, only available in print or is in some form unavailable for inspection.",
		"Not Presented at Conference": "The paper/abstract/poster was not presented at the conference for which it was accepted.",
		"Objections by Author(s)": "One or more authors objected to the notice or the wording of the notice.",
		"Objections by Company/Institution": "One or more companies/institutions objected to the notice or the wording of the notice.",
		"Objections by Third Party": "One or more third parties objected to the notice or the wording of the notice.",
		"Original Data and/or Images not Provided and/or not Available": "The original data or images for the published study is no longer available or is not given to the editorial staff.",
		"Paper Mill": "When a journal/publisher/institution states that a paper came from a paper mill or the paper is in a list of paper mill papers. Retraction Watch may also use this reason to reflect that Retraction Watch has identified multiple paper mill criteria applying to this paper.",
		"Plagiarism of Data": "Plagiarism of any of the data.",
		"Plagiarism of Image": "Plagiarism of one or more images.",
		"Plagiarism of/in Article": "Plagiarism of a published item, or undefined sections of it.",
		"Plagiarism of Text": "Plagiarism of any of the text.",
		"Publishing Ban": "When a journal/publisher states that no manuscripts will be accepted from one or more authors of the original article. Bans could be for a limited time or indefinitely.",
		Removed: "The original article is removed from access on the journal’s website or publishing platform.",
		"Results Not Reproducible": "When repetition(s) of experiment(s), using the same materials and methods, failed to replicate the results in the original article.",
		"Retract and Replace": "The change of an item’s status reflecting that a retracted item will be replaced with a new publication in the same journal. The journal has indicated that the replacement should be cited as the version of record.",
		"Rogue Editor": "Used when an editor’s credentials are false/forged or when an editor subverts one or more processes under their purview. An “editor” may be an established editor affiliated with the journal or a guest editor.",
		"Sabotage of Materials/Methods": "An intentional action by a third party, without the researchers’ knowledge or consent, to sabotage or contaminate experimental ingredients or processes in order to influence experimental outcome(s).",
		"Salami Slicing": "The publication of several articles using the same dataset by breaking it into sections, with the intent of exploiting a limited data set for the production of several published works. This does not apply to large multi-group studies such as the Framingham Heart Study.",
		"Taken from Dissertation/Thesis": "The duplicated or plagiarized content was taken from an academic dissertation or thesis.",
		"Taken via Peer Review": "The duplicated or plagiarized content was taken during the peer review process.",
		"Taken via Translation": "The duplicated or plagiarized content was created via a translation from one language to another.",
		"Temporary Removal": "The original article is removed from the journal’s publishing platform and the notice states the removal will be for an undefined period of time.",
		"Transfer of Copyright and/or Ownership": "A change in the copyright and/or ownership of the article or any of its content.",
		"Unreliable Data": "Any of the data is unreliable.",
		"Unreliable Image": "One or more images, or part(s) of one or more images, are unreliable.",
		"Unreliable Results and/or Conclusions": "Any of the results and/or conclusions are unreliable.",
		"Updated to Correction": "The article has a correction after this notice.",
		"Updated to Expression of Concern": "The article has an expression of concern after this notice.",
		"Updated to Retraction": "The article has a retraction after this notice.",
		"Upgrade/Update of Prior Notice(s)": "At least one prior notice for the article has been upgraded or updated with this notice.",
		"Withdrawn as Out of Date": "The article has been retracted as part of a journal’s process of keeping guidelines or reviews current for professional use.",
		"Withdrawn to Publish in Different Journal": "The article was taken from one journal/platform or access type to be published in a different journal/platform or with a different access type.",
	},
	
	_fixedResults: [
		{ date: "1977-04-15", pmid: 993, retractionPMID: 195582, reasons: ["Results Not Reproducible"], urls: [] }
	]
};
