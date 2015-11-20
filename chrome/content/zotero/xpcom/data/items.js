/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
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


/*
 * Primary interface for accessing Zotero items
 */
Zotero.Items = function() {
	this.constructor = null;
	
	this._ZDO_object = 'item';
	
	// This needs to wait until all Zotero components are loaded to initialize,
	// but otherwise it can be just a simple property
	Zotero.defineProperty(this, "_primaryDataSQLParts", {
		get: function () {
			return {
				itemID: "O.itemID",
				itemTypeID: "O.itemTypeID",
				dateAdded: "O.dateAdded",
				dateModified: "O.dateModified",
				libraryID: "O.libraryID",
				key: "O.key",
				version: "O.version",
				synced: "O.synced",
				
				firstCreator: _getFirstCreatorSQL(),
				sortCreator: _getSortCreatorSQL(),
				
				deleted: "DI.itemID IS NOT NULL AS deleted",
				
				numNotes: "(SELECT COUNT(*) FROM itemNotes INo "
					+ "WHERE parentItemID=O.itemID AND "
					+ "INo.itemID NOT IN (SELECT itemID FROM deletedItems)) AS numNotes",
				
				numNotesTrashed: "(SELECT COUNT(*) FROM itemNotes INo "
					+ "WHERE parentItemID=O.itemID AND "
					+ "INo.itemID IN (SELECT itemID FROM deletedItems)) AS numNotesTrashed",
				
				numNotesEmbedded: "(SELECT COUNT(*) FROM itemAttachments IA "
					+ "JOIN itemNotes USING (itemID) "
					+ "WHERE IA.parentItemID=O.itemID AND "
					+ "note!='' AND note!='" + Zotero.Notes.defaultNote + "' AND "
					+ "IA.itemID NOT IN (SELECT itemID FROM deletedItems)) AS numNotesEmbedded",
				
				numNotesEmbeddedTrashed: "(SELECT COUNT(*) FROM itemAttachments IA "
					+ "JOIN itemNotes USING (itemID) "
					+ "WHERE IA.parentItemID=O.itemID AND "
					+ "note!='' AND note!='" + Zotero.Notes.defaultNote + "' AND "
					+ "IA.itemID IN (SELECT itemID FROM deletedItems)) "
					+ "AS numNotesEmbeddedTrashed",
				
				numAttachments: "(SELECT COUNT(*) FROM itemAttachments IA WHERE parentItemID=O.itemID AND "
					+ "IA.itemID NOT IN (SELECT itemID FROM deletedItems)) AS numAttachments",
				
				numAttachmentsTrashed: "(SELECT COUNT(*) FROM itemAttachments IA WHERE parentItemID=O.itemID AND "
					+ "IA.itemID IN (SELECT itemID FROM deletedItems)) AS numAttachmentsTrashed",
				
				parentID: "(CASE O.itemTypeID WHEN 14 THEN IAP.itemID WHEN 1 THEN INoP.itemID END) AS parentID",
				parentKey: "(CASE O.itemTypeID WHEN 14 THEN IAP.key WHEN 1 THEN INoP.key END) AS parentKey",
				
				attachmentCharset: "CS.charset AS attachmentCharset",
				attachmentLinkMode: "IA.linkMode AS attachmentLinkMode",
				attachmentContentType: "IA.contentType AS attachmentContentType",
				attachmentPath: "IA.path AS attachmentPath"
			};
		}
	}, {lazy: true});
	
	
	this._primaryDataSQLFrom = "FROM items O "
		+ "LEFT JOIN itemAttachments IA USING (itemID) "
		+ "LEFT JOIN items IAP ON (IA.parentItemID=IAP.itemID) "
		+ "LEFT JOIN itemNotes INo ON (O.itemID=INo.itemID) "
		+ "LEFT JOIN items INoP ON (INo.parentItemID=INoP.itemID) "
		+ "LEFT JOIN deletedItems DI ON (O.itemID=DI.itemID) "
		+ "LEFT JOIN charsets CS ON (IA.charsetID=CS.charsetID)";
	
	this._relationsTable = "itemRelations";
	
	/**
	 * Return items marked as deleted
	 *
	 * @param {Integer} libraryID - Library to search
	 * @param {Boolean} [asIDs] - Return itemIDs instead of Zotero.Item objects
	 * @return {Zotero.Item[]|Integer[]}
	 */
	this.getDeleted = Zotero.Promise.coroutine(function* (libraryID, asIDs, days) {
		var sql = "SELECT itemID FROM items JOIN deletedItems USING (itemID) "
				+ "WHERE libraryID=?";
		if (days) {
			sql += " AND dateDeleted<=DATE('NOW', '-" + parseInt(days) + " DAYS')";
		}
		var ids = yield Zotero.DB.columnQueryAsync(sql, [libraryID]);
		if (!ids.length) {
			return [];
		}
		if (asIDs) {
			return ids;
		}
		return this.getAsync(ids);
	});
	
	
	/**
	 * Returns all items in a given library
	 *
	 * @param  {Integer}  libraryID
	 * @param  {Boolean}  [onlyTopLevel=false]   If true, don't include child items
	 * @param  {Boolean}  [includeDeleted=false] If true, include deleted items
	 * @return {Promise<Array<Zotero.Item>>}
	 */
	this.getAll = Zotero.Promise.coroutine(function* (libraryID, onlyTopLevel, includeDeleted) {
		var sql = 'SELECT A.itemID FROM items A';
		if (onlyTopLevel) {
			sql += ' LEFT JOIN itemNotes B USING (itemID) '
			+ 'LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) '
			+ 'WHERE B.parentItemID IS NULL AND C.parentItemID IS NULL';
		}
		else {
			sql += " WHERE 1";
		}
		if (!includeDeleted) {
			sql += " AND A.itemID NOT IN (SELECT itemID FROM deletedItems)";
		}
		sql += " AND libraryID=?";
		var ids = yield Zotero.DB.columnQueryAsync(sql, libraryID);
		return this.getAsync(ids);
	});
	
	
	/**
	 * Return item data in web API format
	 *
	 * var data = Zotero.Items.getAPIData(0, 'collections/NF3GJ38A/items');
	 *
	 * @param {Number} libraryID
	 * @param {String} [apiPath='items'] - Web API style
	 * @return {Promise<String>}.
	 */
	this.getAPIData = Zotero.Promise.coroutine(function* (libraryID, apiPath) {
		var gen = this.getAPIDataGenerator(...arguments);
		var data = "";
		while (true) {
			var result = gen.next();
			if (result.done) {
				break;
			}
			var val = yield result.value;
			if (typeof val == 'string') {
				data += val;
			}
			else if (val === undefined) {
				continue;
			}
			else {
				throw new Error("Invalid return value from generator");
			}
		}
		return data;
	});
	
	
	/**
	 * Zotero.Utilities.Internal.getAsyncInputStream-compatible generator that yields item data
	 * in web API format as strings
	 *
	 * @param {Object} params - Request parameters from Zotero.API.parsePath()
	 */
	this.apiDataGenerator = function* (params) {
		Zotero.debug(params);
		var s = new Zotero.Search;
		s.addCondition('libraryID', 'is', params.libraryID);
		if (params.scopeObject == 'collections') {
			s.addCondition('collection', 'is', params.scopeObjectKey);
		}
		s.addCondition('title', 'contains', 'test');
		var ids = yield s.search();
		
		yield '[\n';
		
		for (let i=0; i<ids.length; i++) {
			let prefix = i > 0 ? ',\n' : '';
			let item = yield this.getAsync(ids[i], { noCache: true });
			var json = yield item.toResponseJSON();
			yield prefix + JSON.stringify(json, null, 4);
		}
		
		yield '\n]';
	};
	
	
	this._cachedFields = {};
	this.cacheFields = Zotero.Promise.coroutine(function* (libraryID, fields, items) {
		if (items && items.length == 0) {
			return;
		}
		
		var t = new Date;
		
		fields = fields.concat();
		
		// Needed for display titles for some item types
		if (fields.indexOf('title') != -1) {
			fields.push('reporter', 'court');
		}
		
		Zotero.debug("Caching fields [" + fields.join() + "]"
			+ (items ? " for " + items.length + " items" : '')
			+ " in library " + libraryID);
		
		if (items && items.length > 0) {
			yield this._load(libraryID, items);
		}
		else {
			yield this._load(libraryID);
		}
		
		var primaryFields = [];
		var fieldIDs = [];
		for each(var field in fields) {
			// Check if field already cached
			if (this._cachedFields[libraryID] && this._cachedFields[libraryID].indexOf(field) != -1) {
				continue;
			}
			
			if (!this._cachedFields[libraryID]) {
				this._cachedFields[libraryID] = [];
			}
			this._cachedFields[libraryID].push(field);
			
			if (this.isPrimaryField(field)) {
				primaryFields.push(field);
			}
			else {
				fieldIDs.push(Zotero.ItemFields.getID(field));
				if (Zotero.ItemFields.isBaseField(field)) {
					fieldIDs = fieldIDs.concat(Zotero.ItemFields.getTypeFieldsFromBase(field));
				}
			}
		}
		
		if (primaryFields.length) {
			var sql = "SELECT O.itemID, "
				+ primaryFields.map((val) => this.getPrimaryDataSQLPart(val)).join(', ')
				+ this.primaryDataSQLFrom + " AND O.libraryID=?";
			var params = [libraryID];
			if (items) {
				sql += " AND O.itemID IN (" + items.join() + ")";
			}
			yield Zotero.DB.queryAsync(
				sql,
				params,
				{
					onRow: function (row) {
						let obj = {
							itemID: row.getResultByIndex(0)
						};
						for (let i=0; i<primaryFields.length; i++) {
							obj[primaryFields[i]] = row.getResultByIndex(i);
						}
						Zotero.debug(obj.itemID);
						Zotero.debug(Object.keys(this._objectCache));
						this._objectCache[obj.itemID].loadFromRow(obj);
					}.bind(this)
				}
			);
		}
		
		// All fields already cached
		if (!fieldIDs.length) {
			Zotero.debug('All fields already cached');
			return;
		}
		
		var sql = "SELECT itemID FROM items WHERE libraryID=?";
		var params = [libraryID];
		var allItemIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		var itemFieldsCached = {};
		
		var sql = "SELECT itemID, fieldID, value FROM items JOIN itemData USING (itemID) "
			+ "JOIN itemDataValues USING (valueID) WHERE libraryID=?";
		var params = [libraryID];
		if (items) {
			sql += " AND itemID IN (" + items.join() + ")";
		}
		sql += " AND fieldID IN (" + fieldIDs.join() + ")";
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					let fieldID = row.getResultByIndex(1);
					let value = row.getResultByIndex(2);
					
					//Zotero.debug('Setting field ' + fieldID + ' for item ' + itemID);
					if (this._objectCache[itemID]) {
						this._objectCache[itemID].setField(fieldID, value, true);
					}
					else {
						if (!missingItems) {
							var missingItems = {};
						}
						if (!missingItems[itemID]) {
							missingItems[itemID] = true;
							Zotero.debug("itemData row references nonexistent item " + itemID);
							Components.utils.reportError("itemData row references nonexistent item " + itemID);
						}
					}
					
					if (!itemFieldsCached[itemID]) {
						itemFieldsCached[itemID] = {};
					}
					itemFieldsCached[itemID][fieldID] = true;
				}.bind(this)
			}
		);
		
		// Set nonexistent fields in the cache list to false (instead of null)
		for (let i=0; i<allItemIDs.length; i++) {
			let itemID = allItemIDs[i];
			for (let j=0; j<fieldIDs.length; j++) {
				let fieldID = fieldIDs[j];
				if (Zotero.ItemFields.isValidForType(fieldID, this._objectCache[itemID].itemTypeID)) {
					if (!itemFieldsCached[itemID] || !itemFieldsCached[itemID][fieldID]) {
						//Zotero.debug('Setting field ' + fieldID + ' to false for item ' + itemID);
						this._objectCache[itemID].setField(fieldID, false, true);
					}
				}
			}
		}
		
		// If 'title' is one of the fields, load in display titles (note titles, letter titles...)
		if (fields.indexOf('title') != -1) {
			var titleFieldID = Zotero.ItemFields.getID('title');
			
			// Note titles
			var sql = "SELECT itemID, title FROM items JOIN itemNotes USING (itemID) "
				+ "WHERE libraryID=? AND itemID NOT IN (SELECT itemID FROM itemAttachments)";
			var params = [libraryID];
			if (items) {
				sql += " AND itemID IN (" + items.join() + ")";
			}
			
			yield Zotero.DB.queryAsync(
				sql,
				params,
				{
					onRow: function (row) {
						let itemID = row.getResultByIndex(0);
						let title = row.getResultByIndex(1);
						
						//Zotero.debug('Setting title for note ' + row.itemID);
						if (this._objectCache[itemID]) {
							this._objectCache[itemID].setField(titleFieldID, title, true);
						}
						else {
							if (!missingItems) {
								var missingItems = {};
							}
							if (!missingItems[itemID]) {
								missingItems[itemID] = true;
								Components.utils.reportError(
									"itemData row references nonexistent item " + itemID
								);
							}
						}
					}.bind(this)
				}
			);
			
			// Display titles
			for (let i=0; i<allItemIDs.length; i++) {
				let itemID = allItemIDs[i];
				let item = this._objectCache[itemID];
				yield item.loadDisplayTitle()
			}
		}
		
		Zotero.debug("Cached fields in " + ((new Date) - t) + "ms");
	});
	
	
	this.merge = function (item, otherItems) {
		return Zotero.DB.executeTransaction(function* () {
			var otherItemIDs = [];
			var itemURI = Zotero.URI.getItemURI(item);
			
			yield item.loadTags();
			yield item.loadRelations();
			var replPred = Zotero.Relations.replacedItemPredicate;
			var toSave = {};
			toSave[this.id];
			
			for each(var otherItem in otherItems) {
				yield otherItem.loadChildItems();
				yield otherItem.loadCollections();
				yield otherItem.loadTags();
				yield otherItem.loadRelations();
				let otherItemURI = Zotero.URI.getItemURI(otherItem);
				
				// Move child items to master
				var ids = otherItem.getAttachments(true).concat(otherItem.getNotes(true));
				for each(var id in ids) {
					var attachment = yield this.getAsync(id);
					
					// TODO: Skip identical children?
					
					attachment.parentID = item.id;
					yield attachment.save();
				}
				
				// Add relations to master
				item.setRelations(otherItem.getRelations());
				
				// Remove merge-tracking relations from other item, so that there aren't two
				// subjects for a given deleted object
				let replItems = otherItem.getRelationsByPredicate(replPred);
				for (let replItem of replItems) {
					otherItem.removeRelation(replPred, replItem);
				}
				
				// Update relations on items in the library that point to the other item
				// to point to the master instead
				let rels = yield Zotero.Relations.getByObject('item', otherItemURI);
				for (let rel of rels) {
					// Skip merge-tracking relations, which are dealt with above
					if (rel.predicate == replPred) continue;
					// Skip items in other libraries. They might not be editable, and even
					// if they are, merging items in one library shouldn't affect another library,
					// so those will follow the merge-tracking relations and can optimize their
					// path if they're resaved.
					if (rel.subject.libraryID != item.libraryID) continue;
					rel.subject.removeRelation(rel.predicate, otherItemURI);
					rel.subject.addRelation(rel.predicate, itemURI);
					if (!toSave[rel.subject.id]) {
						toSave[rel.subject.id] = rel.subject;
					}
				}
				
				// All other operations are additive only and do not affect the,
				// old item, which will be put in the trash
				
				// Add collections to master
				var collectionIDs = otherItem.getCollections();
				for each(var collectionID in collectionIDs) {
					let collection = yield Zotero.Collections.getAsync(collectionID);
					yield collection.addItem(item.id);
				}
				
				// Add tags to master
				var tags = otherItem.getTags();
				for (let j = 0; j < tags.length; j++) {
					item.addTag(tags[j].tag);
				}
				
				// Add relation to track merge
				item.addRelation(replPred, otherItemURI);
				
				// Trash other item
				otherItem.deleted = true;
				yield otherItem.save();
			}
			
			for (let i in toSave) {
				yield toSave[i].save();
			}
		}.bind(this));
	};
	
	
	this.trash = function (ids) {
		ids = Zotero.flattenArguments(ids);
		
		return Zotero.DB.executeTransaction(function* () {
			for (let i=0; i<ids.length; i++) {
				let id = ids[i];
				let item = yield this.getAsync(id);
				if (!item) {
					Zotero.debug('Item ' + id + ' does not exist in Items.trash()!', 1);
					Zotero.Notifier.queue('delete', 'item', id);
					continue;
				}
				
				if (!item.isEditable()) {
					throw new Error(item._ObjectType + " " + item.libraryKey + " is not editable");
				}
				
				if (!Zotero.Libraries.hasTrash(item.libraryID)) {
					throw new Error(Zotero.Libraries.getName(item.libraryID) + " does not have Trash");
				}
				
				item.deleted = true;
				yield item.save({
					skipDateModifiedUpdate: true
				});
			}
		}.bind(this));
	}
	
	
	/**
	 * @param {Integer} libraryID - Library to delete from
	 * @param {Integer} [days] - Only delete items deleted more than this many days ago
	 * @param {Integer} [limit]
	 */
	this.emptyTrash = Zotero.Promise.coroutine(function* (libraryID, days, limit) {
		if (!libraryID) {
			throw new Error("Library ID not provided");
		}
		
		var t = new Date();
		
		var deletedIDs = [];
		
		deletedIDs = yield this.getDeleted(libraryID, true, days);
		if (deletedIDs.length) {
			yield Zotero.Utilities.Internal.forEachChunkAsync(deletedIDs, 50, Zotero.Promise.coroutine(function* (chunk) {
				yield this.erase(chunk);
				yield Zotero.Notifier.trigger('refresh', 'trash', libraryID);
			}.bind(this)));
		}
		
		if (deletedIDs.length) {
			Zotero.debug("Emptied " + deletedIDs.length + " item(s) from trash in " + (new Date() - t) + " ms");
		}
		
		return deletedIDs.length;
	});
	
	
	/**
	 * Start idle observer to delete trashed items older than a certain number of days
	 */
	this._emptyTrashIdleObserver = null;
	this._emptyTrashTimer = null;
	this.startEmptyTrashTimer = function () {
		this._emptyTrashIdleObserver = {
			observe: (subject, topic, data) => {
				if (topic == 'idle' || topic == 'timer-callback') {
					var days = Zotero.Prefs.get('trashAutoEmptyDays');
					if (!days) {
						return;
					}
					
					// TODO: empty group trashes if permissions
					
					// Delete a few items a time
					//
					// TODO: increase number after dealing with slow
					// tag.getLinkedItems() call during deletes
					var num = 10;
					this.emptyTrash(Zotero.Libraries.userLibraryID, days, num)
					.then(deleted => {
						if (!deleted) {
							this._emptyTrashTimer = null;
							return;
						}
						
						// Set a timer to do more every few seconds
						if (!this._emptyTrashTimer) {
							this._emptyTrashTimer = Components.classes["@mozilla.org/timer;1"]
								.createInstance(Components.interfaces.nsITimer);
						}
						this._emptyTrashTimer.init(
							this._emptyTrashIdleObserver.observe,
							5 * 1000,
							Components.interfaces.nsITimer.TYPE_ONE_SHOT
						);
					});
				}
				// When no longer idle, cancel timer
				else if (topic == 'back') {
					if (this._emptyTrashTimer) {
						this._emptyTrashTimer.cancel();
					}
				}
			}
		};
		
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].
							getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this._emptyTrashIdleObserver, 305);
	}
	
	
	/**
	 * Purge unused data values
	 */
	this.purge = Zotero.Promise.coroutine(function* () {
		Zotero.DB.requireTransaction();
		
		if (!Zotero.Prefs.get('purge.items')) {
			return;
		}
		
		var sql = "DELETE FROM itemDataValues WHERE valueID NOT IN "
					+ "(SELECT valueID FROM itemData)";
		yield Zotero.DB.queryAsync(sql);
		
		Zotero.Prefs.set('purge.items', false)
	});
	
	
	/**
	 * Returns an array of items with children of selected parents removed
	 * @return {Array<Zotero.Item>}
	 */
	this.keepParents = function(items) {
		var itemMap = {};
		for (let item of items) {
			itemMap[item.id] = item;
		}
		for (let id in itemMap) {
			// Remove children of selected parents
			let item = itemMap[id];
			if (itemMap[item.parentID]) {
				delete itemMap[id];
			}
		}
		// This is unfortunately 90x (!) faster than any of ES6 syntactic sugar
		let result = [];
		for (let id in itemMap) {
			result.push(itemMap[id])
		}
			
		return result;	
	}
	
	
	this._postLoad = function (libraryID, ids) {
		if (!ids) {
			if (!this._cachedFields[libraryID]) {
				this._cachedFields[libraryID] = [];
			}
			this._cachedFields[libraryID] = this.primaryFields.concat();
		}
	}
	
	
	/*
	 * Generate SQL to retrieve firstCreator field
	 *
	 * Why do we do this entirely in SQL? Because we're crazy. Crazy like foxes.
	 */
	var _firstCreatorSQL = '';
	function _getFirstCreatorSQL() {
		if (_firstCreatorSQL) {
			return _firstCreatorSQL;
		}
		
		/* This whole block is to get the firstCreator */
		var localizedAnd = Zotero.getString('general.and');
		var localizedEtAl = Zotero.getString('general.etAl'); 
		var sql = "COALESCE(" +
			// First try for primary creator types
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators IC " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedEtAl + "' " + 
			") " +
			"END, " +
			
			// Then try editors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators WHERE itemID=O.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedEtAl + "' " +
			") " +
			"END, " +
			
			// Then try contributors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators WHERE itemID=O.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedEtAl + "' " + 
			") " +
			"END" +
		") AS firstCreator";
		
		_firstCreatorSQL = sql;
		return sql;
	}
	
	
	/*
	 * Generate SQL to retrieve sortCreator field
	 */
	var _sortCreatorSQL = '';
	function _getSortCreatorSQL() {
		if (_sortCreatorSQL) {
			return _sortCreatorSQL;
		}
		
		var nameSQL = "lastName || ' ' || firstName ";
		
		var sql = "COALESCE(" +
			// First try for primary creator types
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators IC " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT " + nameSQL + "FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
				"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 2,1)" +
			") " +
			"END, " +
			
			// Then try editors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators WHERE itemID=O.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1,1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 2,1)" +
			") " +
			"END, " +
			
			// Then try contributors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators WHERE itemID=O.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' ' || " + 
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1,1)" +
				" || ' ' || " + 
				"(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=O.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 2,1)" +
			") " +
			"END" +
		") AS sortCreator";
		
		_sortCreatorSQL = sql;
		return sql;
	}
	
	
	this.getSortTitle = function(title) {
		if (title === false || title === undefined) {
			return '';
		}
		if (typeof title == 'number') {
			return title + '';
		}
		return title.replace(/^[\[\'\"](.*)[\'\"\]]?$/, '$1')
	}
	
	Zotero.DataObjects.call(this);
	
	return this;
}.bind(Object.create(Zotero.DataObjects.prototype))();
