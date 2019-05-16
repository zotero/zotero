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
		
		// TEMP: Until we can figure out why some schema updates aren't going through despite the
		// version number being incremented, create table here if it's missing
		await Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS retractedItems (\n	itemID INTEGER PRIMARY KEY,\n	data TEXT,\n	FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n);");
		try {
			await Zotero.DB.queryAsync("ALTER TABLE retractedItems ADD COLUMN flag INT DEFAULT 0");
		}
		catch (e) {}
		
		// Load mappings of keys (DOI hashes and PMIDs) to items and vice versa and register for
		// item changes so they can be kept up to date in notify().
		await this._cacheKeyMappings();
		Zotero.Notifier.registerObserver(this, ['item', 'group'], 'retractions', 20);
		
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
			Zotero.Schema.schemaUpdatePromise.then(() => this.updateFromServer());
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
				if (extraField && extraField.value) {
					doi = extraField.value;
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
				let pmid = this._extractPMID(json.extra);
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
					|| (current && !Zotero.Utilities.Internal.getVirtualCollectionStateForLibrary(libraryID, 'retracted')))) {
			let promises = [];
			for (let zp of Zotero.getZoteroPanes()) {
				promises.push(zp.setVirtual(libraryID, 'retracted', current));
				zp.hideRetractionBanner();
			}
			await Zotero.Promise.all(promises);
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
			for (let id of ids) {
				await this._removeEntry(id, extraData[id].libraryID);
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
			for (let item of this._queuedItems) {
				await this._removeEntry(item.id, item.libraryID);
			}
			this._queuedItems.clear();
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
		for (let item of items) {
			if (!addedItems.includes(item.id)) {
				await this._removeEntry(item.id, item.libraryID);
			}
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
			let [prefixStr, date] = row.split(' ');
			let type = prefixStr[0];
			let prefix = prefixStr.substr(1);
			if (!type || !prefix || !date) {
				Zotero.warn("Bad line in retractions data: " + row);
				continue;
			}
			if (prefixStrings.has(prefixStr)) {
				prefixesToSend.add(prefixStr);
			}
		}
		
		if (prefixesToSend.size) {
			// TODO: Diff list and remove existing retractions that are missing
			
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
		var removed = 0;
		if (removeExisting) {
			for (let itemID of this._retractedItems.keys()) {
				if (!allItemIDs.has(itemID)) {
					let item = await Zotero.Items.getAsync(itemID);
					await this._removeEntry(itemID, item.libraryID);
					removed++;
				}
			}
		}
		
		var msg = `Found ${addedItemIDs.size} retracted `
			+ Zotero.Utilities.pluralize(addedItemIDs.size, 'item');
		if (removed) {
			msg += " and removed " + removed;
		}
		Zotero.debug(msg);
		addedItemIDs = [...addedItemIDs];
		if (addedItemIDs.length) {
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
		var itemDOI = item.getField('DOI') || item.getExtraField('doi');
		if (itemDOI) {
			itemDOI = Zotero.Utilities.cleanDOI(itemDOI);
		}
		return itemDOI || null;
	},
	
	_getItemPMID: function (item) {
		// TEMP
		return this._extractPMID(item.getField('extra')) || null;
	},
	
	// TEMP
	_extractPMID: function (str) {
		if (!str) {
			return false;
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
			
			if (field == 'pmid' || field == 'pubmedid') {
				return value;
			}
		}
		return false;
	},
	
	_valueToKey: function (type, value) {
		if (type == this.TYPE_DOI) {
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
		await this._cacheDOIMappings();
		await this._cachePMIDMappings();
	},
	
	_cacheDOIMappings: async function () {
		this._keyItems[this.TYPE_DOI] = new Map();
		this._itemKeys[this.TYPE_DOI] = new Map();
		
		var sql = "SELECT itemID AS id, value FROM itemData "
			+ "JOIN itemDataValues USING (valueID) WHERE fieldID=?";
		var rows = await Zotero.DB.queryAsync(sql, Zotero.ItemFields.getID('DOI'));
		for (let row of rows) {
			let value = Zotero.Utilities.cleanDOI(row.value);
			if (!value) continue;
			this._addItemKeyMapping(this.TYPE_DOI, value, row.id);
		}
		
		// Extract from Extract field
		sql = "SELECT itemID AS id, value FROM itemData "
			+ "JOIN itemDataValues USING (valueID) WHERE fieldID=?";
		rows = await Zotero.DB.queryAsync(sql, Zotero.ItemFields.getID('extra'));
		for (let row of rows) {
			let { fields } = Zotero.Utilities.Internal.extractExtraFields(row.value);
			let doi = fields.get('doi');
			if (!doi || !doi.value) continue;
			let value = Zotero.Utilities.cleanDOI(doi.value);
			if (!value) continue;
			this._addItemKeyMapping(this.TYPE_DOI, value, row.id);
		}
	},
	
	_cachePMIDMappings: async function () {
		this._keyItems[this.TYPE_PMID] = new Map();
		this._itemKeys[this.TYPE_PMID] = new Map();
		
		var sql = "SELECT itemID AS id, value FROM itemData "
			+ "JOIN itemDataValues USING (valueID) WHERE fieldID=?";
		var rows = await Zotero.DB.queryAsync(sql, Zotero.ItemFields.getID('extra'));
		for (let row of rows) {
			/*
			let { fields } = Zotero.Utilities.Internal.extractExtraFields(row.value);
			let pmid = fields.get('pmid') || fields.get('pubmedID');
			if (!pmid || !pmid.value) continue;
			this._addItemKeyMapping(this.TYPE_PMID, pmid.value, row.id);
			*/
			let pmid = this._extractPMID(row.value);
			if (!pmid) continue;
			this._addItemKeyMapping(this.TYPE_PMID, pmid, row.id);
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
		if (flag === undefined) {
			this._retractedItems.set(itemID, this.FLAG_NORMAL);
		}
		if (!item.deleted && flag !== this.FLAG_HIDDEN) {
			if (!this._retractedItemsByLibrary[libraryID]) {
				this._retractedItemsByLibrary[libraryID] = new Set();
			}
			this._retractedItemsByLibrary[libraryID].add(itemID);
			await this._updateLibraryRetractions(libraryID);
		}
		
		await Zotero.Notifier.trigger('refresh', 'item', [itemID]);
	},
	
	_removeEntry: async function (itemID, libraryID) {
		this._deleteItemKeyMappings(itemID);
		
		if (!this._retractedItems.has(itemID)) {
			return;
		}
		
		await Zotero.DB.queryAsync("DELETE FROM retractedItems WHERE itemID=?", itemID);
		this._retractedItems.delete(itemID);
		this._retractedItemsByLibrary[libraryID].delete(itemID);
		await this._updateLibraryRetractions(libraryID);
		
		await Zotero.Notifier.trigger('refresh', 'item', [itemID]);
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
		if (!await OS.File.exists(cacheFile)) {
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
		"Author Unresponsive": "Author(s) lack of communication after prior contact by Journal, Publisher or other original Authors",
		"Breach of Policy by Author": "A violation of the Journal, Publisher or Institutional accepted practices by the author",
		"Breach of Policy by Third Party": "A violation of the Journal, Publisher or Institutional accepted practices by a person or company/institution not the authors",
		"Cites Prior Retracted Work": "A retracted item is used in citations or referencing",
		"Civil Proceedings": "Non-criminal litigation arising from the publication of the original article or the related notice(s)",
		"Complaints about Author": "Allegations made strictly about the author without respect to the original article",
		"Complaints about Company/Institution": "Allegations made strictly about the author’s affiliation(s) without respect to the original article",
		"Complaints about Third Party": "Allegations made strictly about those not the author or the author’s affiliation(s) without respect to the original article",
		"Concerns/Issues About Authorship": "Any question, controversy or dispute over the rightful claim to authorship, excluding forged authorship",
		"Concerns/Issues About Data": "Any question, controversy or dispute over the validity of the data",
		"Concerns/Issues About Image": "Any question, controversy or dispute over the validity of the image",
		"Concerns/Issues about Referencing/Attributions": "Any question, controversy or dispute over whether ideas, analyses, text or data are properly credited to the originator",
		"Concerns/Issues About Results": "Any question, controversy or dispute over the validity of the results",
		"Concerns/Issues about Third Party Involvement": "Any question, controversy or dispute over the rightful claim to authorship, excluding forged authorship",
		"Conflict of Interest": "Authors having affiliations with companies, associations, or institutions that may serve to influence their belief about their findings",
		"Contamination of Cell Lines/Tissues": "Impurities found within cell lines or tissues",
		"Contamination of Materials (General)": "Impurities found within compounds or solutions used in experiments",
		"Contamination of Reagents": "Impurities found within compounds or solutions used to drive experimental outcomes",
		"Copyright Claims": "Dispute concerning right of ownership of a publication",
		"Criminal Proceedings": "Court actions that may result in incarceration or fines arising from the publication of the original article or the related notice(s)",
		"Date of Retraction/Other Unknown": "A lack of publishing date given on the notice – or the date on the notice is not representative of the actual notice date.  Commonly found when Publishers overwrite the original article’s HTML page with the retraction notice, without changing the publication date to reflect such.",
		"Doing the Right Thing": "An attribution made by co-founders of Retraction Watch indicating admirable behavior by one of the involved parties",
		"Duplication of Article": "Also known as “self-plagiarism”.  Used when an entire published item, or undefined sections of it, written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Duplication of Data": "Also known as “self-plagiarism”.  Used when the all or part of the data from an item written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Duplication of Image": "Also known as “self-plagiarism”.  Used when an image from an item written by one or all authors of the original article is repeated in the original article without appropriate citation.",
		"Duplication of Text": "Also known as “self-plagiarism”.  Used when sections of text from an item written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Error by Journal/Publisher": "A mistake attributed to a Journal Editor or Publisher",
		"Error by Third Party": "A mistake attributed to a person or other, who is not an author or representative of the Journal or Publisher",
		"Error in Analyses": "A mistake made in the evaluation of the data or calculations",
		"Error in Cell Lines/Tissues": "A mistake made in the identification of cell lines or tissues, or the choice of an incorrect cell line or tissue",
		"Error in Data": "A mistake made in the data, either in data entry, gathering or identification",
		"Error in Image": "A mistake made in the preparation or printing of an image",
		"Error in Materials (General)": "A mistake made in the choice of materials in the performance of experiments (eg., reagents, mixing bowls, etc)",
		"Error in Methods": "A mistake made in the experimental protocol, either in following the wrong protocol, or in erring during the performance of the protocol",
		"Error in Results and/or Conclusions": "A mistake made in determining the results or establishing conclusions from an experiment or analysis",
		"Error in Text": "A mistake made in the written portion of the item",
		"Ethical Violations by Author": "When an author performs an action contrary to accepted standards of behavior.  Generally used only when stated as such in the notice and no other specific reason (e.g., duplication of image) is given.",
		"Ethical Violations by Third Party": "When any person not an author performs an action contrary to accepted standards of behavior.  Generally used only when stated as such in the notice and no other specific reason (e.g., duplication of image) is given.",
		"Euphemisms for Duplication": "The notice does not clearly state that the authors reused ideas, text, or images from one of their previously published items without suitable citation",
		"Euphemisms for Misconduct": "The notice does not clearly state that the reason for the notice is due to fabrication, falsification, or plagiarism by one or all the authors, despite an institutional report stating such.",
		"Euphemisms for Plagiarism": "The notice does not clearly state that the authors reused ideas, text, or images, without suitable citation, from items published by those not the authors",
		"Fake Peer Review": "The peer review was intentionally not performed in accordance with the journal’s guidelines or ethical standards",
		"Falsification/Fabrication of Data": "Intentional changes to data so that it is not representative of the actual finding",
		"Falsification/Fabrication of Image": "Intentional changes to an image so that it is not representative of the actual data",
		"Falsification/Fabrication of Results": "Intentional changes to results so that it is not representative of the actual finding",
		"Forged Authorship": "The fraudulent use of an author name in submitting a manuscript for publication",
		"Hoax Paper": "Paper intentionally drafted with fraudulent data or information with the specific intent of testing a journal’s or publisher’s manuscript acceptance policies",
		"Informed/Patient Consent – None/Withdrawn": "When the full risks and benefits from being in an experiment are not provided to and accepted by the participant, or the participant chooses to later recant their approval",
		"Investigation by Company/Institution": "An evaluation of allegations by the affiliations of one or all of the authors",
		"Investigation by Journal/Publisher": "An evaluation of allegations by the Journal or Publisher",
		"Investigation by ORI": "An evaluation of allegations by the United State Office of Research Integrity",
		"Investigation by Third Party": "An evaluation of allegations by a person, company or institution not the Authors, Journal, Publisher or ORI",
		"Lack of Approval from Author": "Failure to obtain agreement from original author(s)",
		"Lack of Approval from Company/Institution": "Failure to obtain agreement from original author(s)",
		"Lack of Approval from Third Party": "Failure to obtain agreement from original author(s)",
		"Lack Of Balance/Bias Issues": "Failure to maintain objectivity in the presentation or analysis of information",
		"Lack of IRB/IACUC Approval": "Failure to obtain consent from the institutional ethical review board overseeing human or animal experimentation",
		"Legal Reasons/Legal Threats": "Actions taken to avoid or foster litigation",
		"Manipulation of Images": "The changing of the presentation of an image by reversal, rotation or similar action",
		"Manipulation of Results": "The changing of the presentation of results which may lead to conclusions not otherwise warranted",
		"Miscommunication by Author": "Error in messaging from or to author",
		"Miscommunication by Company/Institution": "Error in messaging from or to authors’ affiliations",
		"Miscommunication by Journal/Publisher": "Error in messaging from or to Journal or Publisher",
		"Miscommunication by Third Party": "Error in messaging from or to any party not the author, affiliations,  journal of publisher",
		"Misconduct – Official Investigation/Finding": "Finding of misconduct after investigation by incorporated company, institution of governmental agency",
		"Misconduct by Author": "Statement Journal, Publisher, Company, Institution, Governmental Agency, or Author that author committed misconduct",
		"Misconduct by Company/Institution": "Statement Journal, Publisher, Company, Institution, or Governmental Agency that Company/Institution committed misconduct",
		"Misconduct by Third Party": "Statement Journal, Publisher, Company, Institution, or Governmental Agency that a third party committed misconduct",
		"No Further Action": "Generally applicable to Expressions of Concern – Statement by Editor or Publisher that",
		"Nonpayment of Fees/Refusal to Pay": "Lack of payment of full amount due for services rendered or for rights of access",
		"Notice – Lack of": "No Notice was published by the Journal or Publisher, and the article is removed from the publishing platform.",
		"Notice – Limited or No Information": "A notice provides minimal information as to the cause of the notice, or the original item is watermaked as retracted or corrected without explanation",
		"Notice – Unable to Access via current resources": "The notice is paywalled, only in print, or in some form unavailable for inspection at this time.",
		"Objections by Author(s)": "A complaint by any of the original authors or refusal to agree actions taken by the Journal or Publisher",
		"Objections by Company/Institution": "A complaint by any of the original authors’ affiliation(s) or refusal by same to agree actions taken by the Journal or Publisher",
		"Objections by Third Party": "A complaint by any person, company or institution not of the original authors, or refusal by same to agree actions taken by the Journal or Publisher",
		"Plagiarism of Article": "Used when an entire published item, or undefined sections of it, and not written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Plagiarism of Data": "Used when the all or part of the data from an item not written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Plagiarism of Image": "Used when an image from an item not written by one or all authors of the original article is repeated in the original article without appropriate citation.",
		"Plagiarism of Text": "Used when sections of text from an item not written by one or all authors of the original article, are repeated in the original article without appropriate citation.",
		"Publishing Ban": "A Journal or Publisher states that no manuscripts will be acceptance from one or all the authors of the original article.  It can be for a limited time, or indefinitely.",
		"Results Not Reproducible": "Experiments conducted, using the same materials and methods, that fail to replicate the finding of the original article",
		"Retract and Replace": "The permanent change of an item to a non-citable status, with a subsequent republication by the same journal after substantial changes to the item",
		"Sabotage of Materials": "An intentional action to surreptitiously change or contaminate experimental ingredients in order to artificially change the experimental outcome",
		"Sabotage of Methods": "An intentional action to surreptitiously change or contaminate experimental instruments or tools in order to artificially change the experimental outcome",
		"Salami Slicing": "The publication of several articles by using the same (small) dataset, but by breaking it into sections, with the intent of exploiting a limited data set for the production of several published works  This does not apply to large multi-group studies such as the Framingham Heart Study.",
		"Temporary Removal": "An original article is removed from the Journal’s publishing platform for an undefined period of time, after which, if returned to the publishing platform, it appears with minimal or no substantial changes",
		"Unreliable Data": "The accuracy or validity of the data is questionable",
		"Unreliable Image": "The accuracy or validity of the image is questionable",
		"Unreliable Results": "The accuracy or validity of the results is questionable",
		"Updated to Correction": "A prior notice has been changed to the status of a Correction",
		"Updated to Retraction": "A prior notice has been changed to the status of a Retraction",
		"Upgrade/Update of Prior Notice": "Either a change to or affirmation of a prior notice",
		Withdrawal: "The original article is removed from access on the Journal’s publishing platform."
	},
	
	_fixedResults: [
		{ date: "1977-04-15", pmid: 993, retractionPMID: 195582, reasons: ["Results Not Reproducible"], urls: [] }
	]
};
