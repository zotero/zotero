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
			var itemTypeAttachment = Zotero.ItemTypes.getID('attachment');
			var itemTypeNote = Zotero.ItemTypes.getID('note');
			
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
				inPublications: "PI.itemID IS NOT NULL AS inPublications",
				
				parentID: `(CASE O.itemTypeID WHEN ${itemTypeAttachment} THEN IAP.itemID `
					+ `WHEN ${itemTypeNote} THEN INoP.itemID END) AS parentID`,
				parentKey: `(CASE O.itemTypeID WHEN ${itemTypeAttachment} THEN IAP.key `
					+ `WHEN ${itemTypeNote} THEN INoP.key END) AS parentKey`,
				
				attachmentCharset: "CS.charset AS attachmentCharset",
				attachmentLinkMode: "IA.linkMode AS attachmentLinkMode",
				attachmentContentType: "IA.contentType AS attachmentContentType",
				attachmentPath: "IA.path AS attachmentPath",
				attachmentSyncState: "IA.syncState AS attachmentSyncState",
				attachmentSyncedModificationTime: "IA.storageModTime AS attachmentSyncedModificationTime",
				attachmentSyncedHash: "IA.storageHash AS attachmentSyncedHash"
			};
		}
	}, {lazy: true});
	
	
	this._primaryDataSQLFrom = "FROM items O "
		+ "LEFT JOIN itemAttachments IA USING (itemID) "
		+ "LEFT JOIN items IAP ON (IA.parentItemID=IAP.itemID) "
		+ "LEFT JOIN itemNotes INo ON (O.itemID=INo.itemID) "
		+ "LEFT JOIN items INoP ON (INo.parentItemID=INoP.itemID) "
		+ "LEFT JOIN deletedItems DI ON (O.itemID=DI.itemID) "
		+ "LEFT JOIN publicationsItems PI ON (O.itemID=PI.itemID) "
		+ "LEFT JOIN charsets CS ON (IA.charsetID=CS.charsetID)";
	
	this._relationsTable = "itemRelations";
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Promise<Boolean>} - True if library has items in trash, false otherwise
	 */
	this.hasDeleted = Zotero.Promise.coroutine(function* (libraryID) {
		var sql = "SELECT COUNT(*) > 0 FROM items JOIN deletedItems USING (itemID) WHERE libraryID=?";
		return !!(yield Zotero.DB.valueQueryAsync(sql, [libraryID]));
	});
	
	
	/**
	 * Return items marked as deleted
	 *
	 * @param {Integer} libraryID - Library to search
	 * @param {Boolean} [asIDs] - Return itemIDs instead of Zotero.Item objects
	 * @return {Promise<Zotero.Item[]|Integer[]>}
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
	 * @param  {Boolean}  [asIDs=false] 		 If true, resolves only with IDs
	 * @return {Promise<Array<Zotero.Item|Integer>>}
	 */
	this.getAll = Zotero.Promise.coroutine(function* (libraryID, onlyTopLevel, includeDeleted, asIDs=false) {
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
		if (asIDs) {
			return ids;
		}
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
			var json = item.toResponseJSON();
			yield prefix + JSON.stringify(json, null, 4);
		}
		
		yield '\n]';
	};
	
	
	//
	// Bulk data loading functions
	//
	// These are called by Zotero.DataObjects.prototype._loadDataType().
	//
	this._loadItemData = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var missingItems = {};
		var itemFieldsCached = {};
		
		var sql = "SELECT itemID, fieldID, value FROM items "
			+ "JOIN itemData USING (itemID) "
			+ "JOIN itemDataValues USING (valueID) WHERE libraryID=? AND itemTypeID!=?" + idSQL;
		var params = [libraryID, Zotero.ItemTypes.getID('note')];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					let fieldID = row.getResultByIndex(1);
					let value = row.getResultByIndex(2);
					
					//Zotero.debug('Setting field ' + fieldID + ' for item ' + itemID);
					if (this._objectCache[itemID]) {
						if (value === null) {
							value = false;
						}
						this._objectCache[itemID].setField(fieldID, value, true);
					}
					else {
						if (!missingItems[itemID]) {
							missingItems[itemID] = true;
							Zotero.logError("itemData row references nonexistent item " + itemID);
						}
					}
					if (!itemFieldsCached[itemID]) {
						itemFieldsCached[itemID] = {};
					}
					itemFieldsCached[itemID][fieldID] = true;
				}.bind(this)
			}
		);
		
		var sql = "SELECT itemID FROM items WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		var allItemIDs = [];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					let item = this._objectCache[itemID];
					
					// Set nonexistent fields in the cache list to false (instead of null)
					let fieldIDs = Zotero.ItemFields.getItemTypeFields(item.itemTypeID);
					for (let j=0; j<fieldIDs.length; j++) {
						let fieldID = fieldIDs[j];
						if (!itemFieldsCached[itemID] || !itemFieldsCached[itemID][fieldID]) {
							//Zotero.debug('Setting field ' + fieldID + ' to false for item ' + itemID);
							item.setField(fieldID, false, true);
						}
					}
					
					allItemIDs.push(itemID);
				}.bind(this)
			}
		);
		
		
		var titleFieldID = Zotero.ItemFields.getID('title');
		
		// Note titles
		var sql = "SELECT itemID, title FROM items JOIN itemNotes USING (itemID) "
			+ "WHERE libraryID=? AND itemID NOT IN (SELECT itemID FROM itemAttachments)" + idSQL;
		var params = [libraryID];
		
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
						if (!missingItems[itemID]) {
							missingItems[itemID] = true;
							Zotero.logError("itemData row references nonexistent item " + itemID);
						}
					}
				}.bind(this)
			}
		);
		
		for (let i=0; i<allItemIDs.length; i++) {
			let itemID = allItemIDs[i];
			let item = this._objectCache[itemID];
			
			// Mark as loaded
			item._loaded.itemData = true;
			item._clearChanged('itemData');
			
			// Display titles
			try {
				item.updateDisplayTitle()
			}
			catch (e) {
				// A few item types need creators to be loaded. Instead of making
				// updateDisplayTitle() async and loading conditionally, just catch the error
				// and load on demand
				if (e instanceof Zotero.Exception.UnloadedDataException) {
					yield item.loadDataType('creators');
					item.updateDisplayTitle()
				}
				else {
					throw e;
				}
			}
		}
	});
	
	
	this._loadCreators = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = 'SELECT itemID, creatorID, creatorTypeID, orderIndex '
			+ 'FROM items LEFT JOIN itemCreators USING (itemID) '
			+ 'WHERE libraryID=?' + idSQL + " ORDER BY itemID, orderIndex";
		var params = [libraryID];
		var rows = yield Zotero.DB.queryAsync(sql, params);
		
		// Mark creator indexes above the number of creators as changed,
		// so that they're cleared if the item is saved
		var fixIncorrectIndexes = function (item, numCreators, maxOrderIndex) {
			Zotero.debug("Fixing incorrect creator indexes for item " + item.libraryKey
				+ " (" + numCreators + ", " + maxOrderIndex + ")", 2);
			var i = numCreators;
			if (!item._changed.creators) {
				item._changed.creators = {};
			}
			while (i <= maxOrderIndex) {
				item._changed.creators[i] = true;
				i++;
			}
		};
		
		var lastItemID;
		var item;
		var index = 0;
		var maxOrderIndex = -1;
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			let itemID = row.itemID;
			
			if (itemID != lastItemID) {
				if (!this._objectCache[itemID]) {
					throw new Error("Item " + itemID + " not loaded");
				}
				item = this._objectCache[itemID];
				
				item._creators = [];
				item._creatorIDs = [];
				item._loaded.creators = true;
				item._clearChanged('creators');
				
				if (!row.creatorID) {
					lastItemID = row.itemID;
					continue;
				}
				
				if (index <= maxOrderIndex) {
					fixIncorrectIndexes(item, index, maxOrderIndex);
				}
				
				index = 0;
				maxOrderIndex = -1;
			}
			
			lastItemID = row.itemID;
			
			if (row.orderIndex > maxOrderIndex) {
				maxOrderIndex = row.orderIndex;
			}
			
			let creatorData = Zotero.Creators.get(row.creatorID);
			creatorData.creatorTypeID = row.creatorTypeID;
			item._creators[index] = creatorData;
			item._creatorIDs[index] = row.creatorID;
			index++;
		}
		
		if (index <= maxOrderIndex) {
			fixIncorrectIndexes(item, index, maxOrderIndex);
		}
	});
	
	
	this._loadNotes = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var notesToUpdate = [];
		
		var sql = "SELECT itemID, note FROM items "
			+ "JOIN itemNotes USING (itemID) "
			+ "WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					let item = this._objectCache[itemID];
					if (!item) {
						throw new Error("Item " + itemID + " not found");
					}
					let note = row.getResultByIndex(1);
					
					// Convert non-HTML notes on-the-fly
					if (note !== "") {
						if (typeof note == 'number') {
							note = '' + note;
						}
						if (typeof note == 'string') {
							if (!note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)) {
								note = Zotero.Utilities.htmlSpecialChars(note);
								note = Zotero.Notes.notePrefix + '<p>'
									+ note.replace(/\n/g, '</p><p>')
									.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
									.replace(/  /g, '&nbsp;&nbsp;')
									+ '</p>' + Zotero.Notes.noteSuffix;
								note = note.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
								notesToUpdate.push([item.id, note]);
							}
							
							// Don't include <div> wrapper when returning value
							let startLen = note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)[0].length;
							let endLen = 6; // "</div>".length
							note = note.substr(startLen, note.length - startLen - endLen);
						}
						// Clear null notes
						else {
							note = '';
							notesToUpdate.push([item.id, '']);
						}
					}
					
					item._noteText = note ? note : '';
					item._loaded.note = true;
					item._clearChanged('note');
				}.bind(this)
			}
		);
		
		if (notesToUpdate.length) {
			yield Zotero.DB.executeTransaction(function* () {
				for (let i = 0; i < notesToUpdate.length; i++) {
					let row = notesToUpdate[i];
					let sql = "UPDATE itemNotes SET note=? WHERE itemID=?";
					yield Zotero.DB.queryAsync(sql, [row[1], row[0]]);
				}
			}.bind(this));
		}
		
		// Mark notes and attachments without notes as loaded
		sql = "SELECT itemID FROM items WHERE libraryID=?" + idSQL
			+ " AND itemTypeID IN (?, ?) AND itemID NOT IN (SELECT itemID FROM itemNotes)";
		params = [libraryID, Zotero.ItemTypes.getID('note'), Zotero.ItemTypes.getID('attachment')];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					let item = this._objectCache[itemID];
					if (!item) {
						throw new Error("Item " + itemID + " not loaded");
					}
					
					item._noteText = '';
					item._loaded.note = true;
					item._clearChanged('note');
				}.bind(this)
			}
		);
	});
	
	
	this._loadChildItems = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var params = [libraryID];
		var rows = [];
		var onRow = function (row, setFunc) {
			var itemID = row.getResultByIndex(0);
			
			// If we've finished a set of rows for an item, process them
			if (lastItemID && itemID !== lastItemID) {
				setFunc(lastItemID, rows);
				rows = [];
			}
			
			lastItemID = itemID;
			rows.push({
				itemID: row.getResultByIndex(1),
				title: row.getResultByIndex(2),
				trashed: row.getResultByIndex(3)
			});
		};
		
		var sql = "SELECT parentItemID, A.itemID, value AS title, "
			+ "CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
			+ "FROM itemAttachments A "
			+ "JOIN items I ON (A.parentItemID=I.itemID) "
			+ "LEFT JOIN itemData ID ON (fieldID=110 AND A.itemID=ID.itemID) "
			+ "LEFT JOIN itemDataValues IDV USING (valueID) "
			+ "LEFT JOIN deletedItems DI USING (itemID) "
			+ "WHERE libraryID=?"
			+ (ids.length ? " AND parentItemID IN (" + ids.map(id => parseInt(id)).join(", ") + ")" : "")
			+ " ORDER BY parentItemID";
		// Since we do the sort here and cache these results, a restart will be required
		// if this pref (off by default) is turned on, but that's OK
		if (Zotero.Prefs.get('sortAttachmentsChronologically')) {
			sql +=  ", dateAdded";
		}
		var setAttachmentItem = function (itemID, rows) {
			var item = this._objectCache[itemID];
			if (!item) {
				throw new Error("Item " + itemID + " not loaded");
			}
			
			item._attachments = {
				rows,
				chronologicalWithTrashed: null,
				chronologicalWithoutTrashed: null,
				alphabeticalWithTrashed: null,
				alphabeticalWithoutTrashed: null
			};
		}.bind(this);
		var lastItemID = null;
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					onRow(row, setAttachmentItem);
				}
			}
		);
		// Process unprocessed rows
		if (lastItemID) {
			setAttachmentItem(lastItemID, rows);
		}
		// Otherwise clear existing entries for passed items
		else if (ids.length) {
			ids.forEach(id => setAttachmentItem(id, []));
		}
		
		//
		// Notes
		//
		sql = "SELECT parentItemID, N.itemID, title, "
			+ "CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
			+ "FROM itemNotes N "
			+ "JOIN items I ON (N.parentItemID=I.itemID) "
			+ "LEFT JOIN deletedItems DI USING (itemID) "
			+ "WHERE libraryID=?"
			+ (ids.length ? " AND parentItemID IN (" + ids.map(id => parseInt(id)).join(", ") + ")" : "")
			+ " ORDER BY parentItemID";
		if (Zotero.Prefs.get('sortNotesChronologically')) {
			sql +=  ", dateAdded";
		}
		var setNoteItem = function (itemID, rows) {
			var item = this._objectCache[itemID];
			if (!item) {
				throw new Error("Item " + itemID + " not loaded");
			}
			
			item._notes = {
				rows,
				rowsEmbedded: null,
				chronologicalWithTrashed: null,
				chronologicalWithoutTrashed: null,
				alphabeticalWithTrashed: null,
				alphabeticalWithoutTrashed: null,
				numWithTrashed: null,
				numWithoutTrashed: null,
				numWithTrashedWithEmbedded: null,
				numWithoutTrashedWithoutEmbedded: null
			};
		}.bind(this);
		lastItemID = null;
		rows = [];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					onRow(row, setNoteItem);
				}
			}
		);
		// Process unprocessed rows
		if (lastItemID) {
			setNoteItem(lastItemID, rows);
		}
		// Otherwise clear existing entries for passed items
		else if (ids.length) {
			ids.forEach(id => setNoteItem(id, []));
		}
		
		// Mark all top-level items as having child items loaded
		sql = "SELECT itemID FROM items I WHERE libraryID=?" + idSQL + " AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments UNION SELECT itemID FROM itemNotes)";
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					var itemID = row.getResultByIndex(0);
					var item = this._objectCache[itemID];
					if (!item) {
						throw new Error("Item " + itemID + " not loaded");
					}
					item._loaded.childItems = true;
					item._clearChanged('childItems');
				}.bind(this)
			}
		);
	});
	
	
	this._loadTags = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = "SELECT itemID, name, type FROM items "
			+ "LEFT JOIN itemTags USING (itemID) "
			+ "LEFT JOIN tags USING (tagID) WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		
		var lastItemID;
		var rows = [];
		var setRows = function (itemID, rows) {
			var item = this._objectCache[itemID];
			if (!item) {
				throw new Error("Item " + itemID + " not found");
			}
			
			item._tags = [];
			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				item._tags.push(Zotero.Tags.cleanData(row));
			}
			
			item._loaded.tags = true;
		}.bind(this);
		
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					
					if (lastItemID && itemID !== lastItemID) {
						setRows(lastItemID, rows);
						rows = [];
					}
					
					lastItemID = itemID;
					
					// Item has no tags
					let tag = row.getResultByIndex(1);
					if (tag === null) {
						return;
					}
					
					rows.push({
						tag: tag,
						type: row.getResultByIndex(2)
					});
				}.bind(this)
			}
		);
		if (lastItemID) {
			setRows(lastItemID, rows);
		}
	});
	
	
	this._loadCollections = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = "SELECT itemID, collectionID FROM items "
			+ "LEFT JOIN collectionItems USING (itemID) "
			+ "WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		
		var lastItemID;
		var rows = [];
		var setRows = function (itemID, rows) {
			var item = this._objectCache[itemID];
			if (!item) {
				throw new Error("Item " + itemID + " not found");
			}
			
			item._collections = rows;
			item._loaded.collections = true;
			item._clearChanged('collections');
		}.bind(this);
		
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					
					if (lastItemID && itemID !== lastItemID) {
						setRows(lastItemID, rows);
						rows = [];
					}
					
					lastItemID = itemID;
					let collectionID = row.getResultByIndex(1);
					// No collections
					if (collectionID === null) {
						return;
					}
					rows.push(collectionID);
				}.bind(this)
			}
		);
		if (lastItemID) {
			setRows(lastItemID, rows);
		}
	});
	
	
	this.merge = function (item, otherItems) {
		Zotero.debug("Merging items");
		
		return Zotero.DB.executeTransaction(function* () {
			var otherItemIDs = [];
			var itemURI = Zotero.URI.getItemURI(item);
			
			var replPred = Zotero.Relations.replacedItemPredicate;
			var toSave = {};
			toSave[item.id] = item;
			
			var earliestDateAdded = item.dateAdded;
			
			for (let otherItem of otherItems) {
				// Use the earliest date added of all the items
				if (otherItem.dateAdded < earliestDateAdded) {
					earliestDateAdded = otherItem.dateAdded;
				}
				
				let otherItemURI = Zotero.URI.getItemURI(otherItem);
				
				// Move child items to master
				var ids = otherItem.getAttachments(true).concat(otherItem.getNotes(true));
				for (let id of ids) {
					var attachment = yield this.getAsync(id);
					
					// TODO: Skip identical children?
					
					attachment.parentID = item.id;
					yield attachment.save();
				}
				
				// Add relations to master
				let oldRelations = otherItem.getRelations();
				for (let pred in oldRelations) {
					oldRelations[pred].forEach(obj => item.addRelation(pred, obj));
				}
				
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
				otherItem.getCollections().forEach(id => item.addToCollection(id));
				
				// Add tags to master
				var tags = otherItem.getTags();
				for (let j = 0; j < tags.length; j++) {
					let tagName = tags[j].tag;
					if (item.hasTag(tagName)) {
						let type = item.getTagType(tagName);
						// If existing manual tag, leave that
						if (type == 0) {
							continue;
						}
						// Otherwise, add the non-master item's tag, which may be manual, in which
						// case it will remain at the end
						item.addTag(tagName, tags[j].type);
					}
					// If no existing tag, add with the type from the non-master item
					else {
						item.addTag(tagName, tags[j].type);
					}
				}
				
				// Add relation to track merge
				item.addRelation(replPred, otherItemURI);
				
				// Trash other item
				otherItem.deleted = true;
				yield otherItem.save();
			}
			
			item.setField('dateAdded', earliestDateAdded);
			
			for (let i in toSave) {
				yield toSave[i].save();
			}
			
			// Hack to remove master item from duplicates view without recalculating duplicates
			Zotero.Notifier.trigger('removeDuplicatesMaster', 'item', item.id);
		}.bind(this));
	};
	
	
	this.trash = Zotero.Promise.coroutine(function* (ids) {
		Zotero.DB.requireTransaction();
		
		var libraryIDs = new Set();
		ids = Zotero.flattenArguments(ids);
		var items = [];
		for (let id of ids) {
			let item = this.get(id);
			if (!item) {
				Zotero.debug('Item ' + id + ' does not exist in Items.trash()!', 1);
				Zotero.Notifier.queue('trash', 'item', id);
				continue;
			}
			
			if (!item.isEditable()) {
				throw new Error(item._ObjectType + " " + item.libraryKey + " is not editable");
			}
			
			if (!Zotero.Libraries.get(item.libraryID).hasTrash) {
				throw new Error(Zotero.Libraries.getName(item.libraryID) + " does not have a trash");
			}
			
			items.push(item);
			libraryIDs.add(item.libraryID);
		}
		
		var parentItemIDs = new Set();
		items.forEach(item => {
			item.setDeleted(true);
			item.synced = false;
			if (item.parentItemID) {
				parentItemIDs.add(item.parentItemID);
			}
		});
		yield Zotero.Utilities.Internal.forEachChunkAsync(ids, 250, Zotero.Promise.coroutine(function* (chunk) {
			yield Zotero.DB.queryAsync(
				"UPDATE items SET synced=0, clientDateModified=CURRENT_TIMESTAMP "
					+ `WHERE itemID IN (${chunk.map(id => parseInt(id)).join(", ")})`
			);
			yield Zotero.DB.queryAsync(
				"INSERT OR IGNORE INTO deletedItems (itemID) VALUES "
					+ chunk.map(id => "(" + id + ")").join(", ")
			);
		}.bind(this)));
		
		// Keep in sync with Zotero.Item::saveData()
		for (let parentItemID of parentItemIDs) {
			let parentItem = yield Zotero.Items.getAsync(parentItemID);
			yield parentItem.reload(['primaryData', 'childItems'], true);
		}
		Zotero.Notifier.queue('modify', 'item', ids);
		Zotero.Notifier.queue('trash', 'item', ids);
		Array.from(libraryIDs).forEach(libraryID => {
			Zotero.Notifier.queue('refresh', 'trash', libraryID);
		});
	});
	
	
	this.trashTx = function (ids) {
		return Zotero.DB.executeTransaction(function* () {
			return this.trash(ids);
		}.bind(this));
	}
	
	
	/**
	 * @param {Integer} libraryID - Library to delete from
	 * @param {Object} [options]
	 * @param {Function} [options.onProgress] - fn(progress, progressMax)
	 * @param {Integer} [options.days] - Only delete items deleted more than this many days ago
	 * @param {Integer} [options.limit] - Number of items to delete
	 */
	this.emptyTrash = async function (libraryID, options = {}) {
		if (arguments.length > 2 || typeof arguments[1] == 'number') {
			Zotero.warn("Zotero.Items.emptyTrash() has changed -- update your code");
			options.days = arguments[1];
			options.limit = arguments[2];
		}
		
		if (!libraryID) {
			throw new Error("Library ID not provided");
		}
		
		var t = new Date();
		
		var deleted = await this.getDeleted(libraryID, false, options.days);
		
		if (options.limit) {
			deleted = deleted.slice(0, options.limit);
		}
		
		var processed = 0;
		if (deleted.length) {
			let toDelete = {
				top: [],
				child: []
			};
			deleted.forEach((item) => {
				item.isTopLevelItem() ? toDelete.top.push(item.id) : toDelete.child.push(item.id)
			});
			
			// Show progress meter during deletions
			let eraseOptions = options.onProgress
				? {
					onProgress: function (progress, progressMax) {
						options.onProgress(processed + progress, deleted.length);
					}
				}
				: undefined;
			for (let x of ['top', 'child']) {
				await Zotero.Utilities.Internal.forEachChunkAsync(
					toDelete[x],
					1000,
					async function (chunk) {
						await this.erase(chunk, eraseOptions);
						processed += chunk.length;
					}.bind(this)
				);
			}
			Zotero.debug("Emptied " + deleted.length + " item(s) from trash in " + (new Date() - t) + " ms");
		}
		
		return deleted.length;
	};
	
	
	/**
	 * Start idle observer to delete trashed items older than a certain number of days
	 */
	this._emptyTrashIdleObserver = null;
	this._emptyTrashTimeoutID = null;
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
					let num = 50;
					this.emptyTrash(
						Zotero.Libraries.userLibraryID,
						{
							days,
							limit: num
						}
					)
					.then((deleted) => {
						if (!deleted) {
							this._emptyTrashTimeoutID = null;
							return;
						}
						
						// Set a timer to do more every few seconds
						this._emptyTrashTimeoutID = setTimeout(() => {
							this._emptyTrashIdleObserver.observe(null, 'timer-callback', null);
						}, 2500);
					});
				}
				// When no longer idle, cancel timer
				else if (topic === 'active') {
					if (this._emptyTrashTimeoutID) {
						clearTimeout(this._emptyTrashTimeoutID);
						this._emptyTrashTimeoutID = null;
					}
				}
			}
		};
		
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].
							getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this._emptyTrashIdleObserver, 305);
	}
	
	
	this.addToPublications = function (items, options = {}) {
		if (!items.length) return;
		
		return Zotero.DB.executeTransaction(function* () {
			var timestamp = Zotero.DB.transactionTimestamp;
			
			var allItems = [...items];
			
			if (options.license) {
				for (let item of items) {
					if (!options.keepRights || !item.getField('rights')) {
						item.setField('rights', options.licenseName);
					}
				}
			}
			
			if (options.childNotes) {
				for (let item of items) {
					item.getNotes().forEach(id => allItems.push(Zotero.Items.get(id)));
				}
			}
			
			if (options.childFileAttachments || options.childLinks) {
				for (let item of items) {
					item.getAttachments().forEach(id => {
						var attachment = Zotero.Items.get(id);
						var linkMode = attachment.attachmentLinkMode;
						
						if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
							Zotero.debug("Skipping child linked file attachment on drag");
							return;
						}
						if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
							if (!options.childLinks) {
								Zotero.debug("Skipping child link attachment on drag");
								return;
							}
						}
						else if (!options.childFileAttachments) {
							Zotero.debug("Skipping child file attachment on drag");
							return;
						}
						allItems.push(attachment);
					});
				}
			}
			
			yield Zotero.Utilities.Internal.forEachChunkAsync(allItems, 250, Zotero.Promise.coroutine(function* (chunk) {
				for (let item of chunk) {
					item.setPublications(true);
					item.synced = false;
				}
				let ids = chunk.map(item => item.id);
				yield Zotero.DB.queryAsync(
					`UPDATE items SET synced=0, clientDateModified=? WHERE itemID IN (${ids.join(", ")})`,
					timestamp
				);
				yield Zotero.DB.queryAsync(
					`INSERT OR IGNORE INTO publicationsItems VALUES (${ids.join("), (")})`
				);
			}.bind(this)));
			Zotero.Notifier.queue('modify', 'item', allItems.map(item => item.id));
		}.bind(this));
	};
	
	
	this.removeFromPublications = function (items) {
		return Zotero.DB.executeTransaction(function* () {
			let allItems = [];
			for (let item of items) {
				if (!item.inPublications) {
					throw new Error(`Item ${item.libraryKey} is not in My Publications`);
				}
				
				// Remove all child items too
				if (item.isRegularItem()) {
					allItems.push(...this.get(item.getNotes(true).concat(item.getAttachments(true))));
				}
				
				allItems.push(item);
			}
			
			allItems.forEach(item => {
				item.setPublications(false);
				item.synced = false;
			});
			
			var timestamp = Zotero.DB.transactionTimestamp;
			yield Zotero.Utilities.Internal.forEachChunkAsync(allItems, 250, Zotero.Promise.coroutine(function* (chunk) {
				let idStr = chunk.map(item => item.id).join(", ");
				yield Zotero.DB.queryAsync(
					`UPDATE items SET synced=0, clientDateModified=? WHERE itemID IN (${idStr})`,
					timestamp
				);
				yield Zotero.DB.queryAsync(`DELETE FROM publicationsItems WHERE itemID IN (${idStr})`);
			}.bind(this)));
			Zotero.Notifier.queue('modify', 'item', items.map(item => item.id));
		}.bind(this));
	};
	
	
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
	
	
	
	this.getFirstCreatorFromJSON = function (json) {
		Zotero.warn("Zotero.Items.getFirstCreatorFromJSON() is deprecated "
			+ "-- use Zotero.Utilities.Internal.getFirstCreatorFromItemJSON()");
		return Zotero.Utilities.Internal.getFirstCreatorFromItemJSON(json);
	};
	
	
	/**
	 * Return a firstCreator string from internal creators data (from Zotero.Item::getCreators()).
	 *
	 * Used in Zotero.Item::getField() for unsaved items
	 *
	 * @param {Integer} itemTypeID
	 * @param {Object} creatorData
	 * @return {String}
	 */
	this.getFirstCreatorFromData = function (itemTypeID, creatorsData) {
		if (creatorsData.length === 0) {
			return "";
		}
		
		var validCreatorTypes = [
			Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID),
			Zotero.CreatorTypes.getID('editor'),
			Zotero.CreatorTypes.getID('contributor')
		];
	
		for (let creatorTypeID of validCreatorTypes) {
			let matches = creatorsData.filter(data => data.creatorTypeID == creatorTypeID)
			if (!matches.length) {
				continue;
			}
			if (matches.length === 1) {
				return matches[0].lastName;
			}
			if (matches.length === 2) {
				let a = matches[0];
				let b = matches[1];
				return a.lastName + " " + Zotero.getString('general.and') + " " + b.lastName;
			}
			if (matches.length >= 3) {
				return matches[0].lastName + " " + Zotero.getString('general.etAl');
			}
		}
		
		return "";
	};
	
	
	/**
	 * Returns an array of items with children of selected parents removed
	 *
	 * @return {Zotero.Item[]}
	 */
	this.keepParents = function (items) {
		var parentItems = new Set(
			items
				.filter(item => item.isTopLevelItem())
				.map(item => item.id)
		);
		return items.filter(item => {
			var parentItemID = item.parentItemID;
			// Not a child item or not a child of one of the passed items
			return !parentItemID || !parentItems.has(parentItemID);
		});
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
		if (title === false || title === undefined || title == null) {
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
