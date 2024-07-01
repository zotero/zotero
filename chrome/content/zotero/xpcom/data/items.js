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
			var itemTypeAnnotation = Zotero.ItemTypes.getID('annotation');
			
			return {
				itemID: "O.itemID",
				itemTypeID: "O.itemTypeID",
				dateAdded: "O.dateAdded",
				dateModified: "O.dateModified",
				libraryID: "O.libraryID",
				key: "O.key",
				version: "O.version",
				synced: "O.synced",
				
				createdByUserID: "createdByUserID",
				lastModifiedByUserID: "lastModifiedByUserID",
				
				firstCreator: _getFirstCreatorSQL(),
				sortCreator: _getSortCreatorSQL(),
				
				deleted: "DI.itemID IS NOT NULL AS deleted",
				inPublications: "PI.itemID IS NOT NULL AS inPublications",
				
				parentID: `(CASE O.itemTypeID `
					+ `WHEN ${itemTypeAttachment} THEN IAP.itemID `
					+ `WHEN ${itemTypeNote} THEN INoP.itemID `
					+ `WHEN ${itemTypeAnnotation} THEN IAnP.itemID `
					+ `END) AS parentID`,
				parentKey: `(CASE O.itemTypeID `
					+ `WHEN ${itemTypeAttachment} THEN IAP.key `
					+ `WHEN ${itemTypeNote} THEN INoP.key `
					+ `WHEN ${itemTypeAnnotation} THEN IAnP.key `
					+ `END) AS parentKey`,
				
				attachmentCharset: "CS.charset AS attachmentCharset",
				attachmentLinkMode: "IA.linkMode AS attachmentLinkMode",
				attachmentContentType: "IA.contentType AS attachmentContentType",
				attachmentPath: "IA.path AS attachmentPath",
				attachmentSyncState: "IA.syncState AS attachmentSyncState",
				attachmentSyncedModificationTime: "IA.storageModTime AS attachmentSyncedModificationTime",
				attachmentSyncedHash: "IA.storageHash AS attachmentSyncedHash",
				attachmentLastProcessedModificationTime: "IA.lastProcessedModificationTime AS attachmentLastProcessedModificationTime",
			};
		}
	}, {lazy: true});
	
	
	this._primaryDataSQLFrom = "FROM items O "
		+ "LEFT JOIN itemAttachments IA USING (itemID) "
		+ "LEFT JOIN items IAP ON (IA.parentItemID=IAP.itemID) "
		+ "LEFT JOIN itemNotes INo ON (O.itemID=INo.itemID) "
		+ "LEFT JOIN items INoP ON (INo.parentItemID=INoP.itemID) "
		+ "LEFT JOIN itemAnnotations IAn ON (O.itemID=IAn.itemID) "
		+ "LEFT JOIN items IAnP ON (IAn.parentItemID=IAnP.itemID) "
		+ "LEFT JOIN deletedItems DI ON (O.itemID=DI.itemID) "
		+ "LEFT JOIN publicationsItems PI ON (O.itemID=PI.itemID) "
		+ "LEFT JOIN charsets CS ON (IA.charsetID=CS.charsetID)"
		+ "LEFT JOIN groupItems GI ON (O.itemID=GI.itemID)";
	
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
				noCache: true,
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
				noCache: true,
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
				noCache: true,
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
		var rows = yield Zotero.DB.queryAsync(sql, params, { noCache: true });
		
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
				noCache: true,
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
			yield Zotero.DB.executeTransaction(async function () {
				for (let i = 0; i < notesToUpdate.length; i++) {
					let row = notesToUpdate[i];
					let sql = "UPDATE itemNotes SET note=? WHERE itemID=?";
					await Zotero.DB.queryAsync(sql, [row[1], row[0]]);
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
				noCache: true,
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
	
	
	this._loadAnnotations = async function (libraryID, ids, idSQL) {
		var sql = "SELECT itemID, IA.parentItemID, IA.type, IA.authorName, IA.text, IA.comment, "
			+ "IA.color, IA.sortIndex, IA.isExternal "
			+ "FROM items JOIN itemAnnotations IA USING (itemID) "
			+ "WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		
		// TEMP: Fix faulty upgrade from early 6.0 beta
		// https://github.com/zotero/zotero/issues/3013
		try {
			await Zotero.DB.queryAsync(
				sql,
				params,
				{
					noCache: true,
					onRow: function (row) {
						let itemID = row.getResultByIndex(0);
						
						let item = this._objectCache[itemID];
						if (!item) {
							throw new Error("Item " + itemID + " not found");
						}
						
						item._parentItemID = row.getResultByIndex(1);
						var typeID = row.getResultByIndex(2);
						var type;
						switch (typeID) {
							case Zotero.Annotations.ANNOTATION_TYPE_HIGHLIGHT:
								type = 'highlight';
								break;

							case Zotero.Annotations.ANNOTATION_TYPE_UNDERLINE:
								type = 'underline';
								break;
							
							case Zotero.Annotations.ANNOTATION_TYPE_NOTE:
								type = 'note';
								break;

							case Zotero.Annotations.ANNOTATION_TYPE_TEXT:
								type = 'text';
								break;
							
							case Zotero.Annotations.ANNOTATION_TYPE_IMAGE:
								type = 'image';
								break;
							
							case Zotero.Annotations.ANNOTATION_TYPE_INK:
								type = 'ink';
								break;
							
							default:
								throw new Error(`Unknown annotation type id ${typeID}`);
						}
						item._annotationType = type;
						item._annotationAuthorName = row.getResultByIndex(3);
						item._annotationText = row.getResultByIndex(4);
						item._annotationComment = row.getResultByIndex(5);
						item._annotationColor = row.getResultByIndex(6);
						item._annotationSortIndex = row.getResultByIndex(7);
						item._annotationIsExternal = !!row.getResultByIndex(8);
						
						item._loaded.annotation = true;
						item._clearChanged('annotation');
					}.bind(this)
				}
			);
		}
		catch (e) {
			if (e.message.includes('no such column: IA.authorName')
					&& await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM version WHERE schema='userdata' AND version IN (120, 121, 122)")) {
				await Zotero.DB.queryAsync("UPDATE version SET version=119 WHERE schema='userdata'");
				Zotero.crash();
			}
			throw e;
		}
	};
	
	
	this._loadAnnotationsDeferred = async function (libraryID, ids, idSQL) {
		var sql = "SELECT itemID, IA.position, IA.pageLabel FROM items "
			+ "JOIN itemAnnotations IA USING (itemID) "
			+ "WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		await Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: true,
				onRow: function (row) {
					let itemID = row.getResultByIndex(0);
					
					let item = this._objectCache[itemID];
					if (!item) {
						throw new Error("Item " + itemID + " not found");
					}
					
					item._annotationPosition = row.getResultByIndex(1);
					item._annotationPageLabel = row.getResultByIndex(2);
					
					item._loaded.annotationDeferred = true;
					item._clearChanged('annotationDeferred');
				}.bind(this)
			}
		);
	};
	
	
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
		
		//
		// Attachments
		//
		var titleFieldID = Zotero.ItemFields.getID('title');
		var sql = "SELECT parentItemID, A.itemID, value AS title, "
			+ "CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
			+ "FROM itemAttachments A "
			+ "JOIN items I ON (A.parentItemID=I.itemID) "
			+ `LEFT JOIN itemData ID ON (fieldID=${titleFieldID} AND A.itemID=ID.itemID) `
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
				noCache: true,
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
				noCache: true,
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
		
		//
		// Annotations
		//
		sql = "SELECT parentItemID, IAn.itemID, "
			+ "text || ' - ' || comment AS title, " // TODO: Make better
			+ "CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
			+ "FROM itemAnnotations IAn "
			+ "JOIN items I ON (IAn.parentItemID=I.itemID) "
			+ "LEFT JOIN deletedItems DI USING (itemID) "
			+ "WHERE libraryID=?"
			+ (ids.length ? " AND parentItemID IN (" + ids.map(id => parseInt(id)).join(", ") + ")" : "")
			+ " ORDER BY parentItemID, sortIndex";
		var setAnnotationItem = function (itemID, rows) {
			var item = this._objectCache[itemID];
			if (!item) {
				throw new Error("Item " + itemID + " not loaded");
			}
			rows.sort((a, b) => a.sortIndex - b.sortIndex);
			item._annotations = {
				rows,
				withTrashed: null,
				withoutTrashed: null
			};
		}.bind(this);
		lastItemID = null;
		rows = [];
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: true,
				onRow: function (row) {
					onRow(row, setAnnotationItem);
				}
			}
		);
		// Process unprocessed rows
		if (lastItemID) {
			setAnnotationItem(lastItemID, rows);
		}
		// Otherwise clear existing entries for passed items
		else if (ids.length) {
			ids.forEach(id => setAnnotationItem(id, []));
		}
		
		// Mark either all passed items or all items as having child items loaded
		sql = "SELECT itemID FROM items I WHERE libraryID=?";
		if (idSQL) {
			sql += idSQL;
		}
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: true,
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
				noCache: true,
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
				noCache: true,
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
	
	
	/**
	 * Copy child items from one item to another (e.g., in another library)
	 *
	 * Requires a transaction
	 */
	this.copyChildItems = async function (fromItem, toItem) {
		Zotero.DB.requireTransaction();
		
		var fromGroup = fromItem.library.isGroup;
		
		// Annotations on files
		if (fromItem.isFileAttachment()) {
			let annotations = fromItem.getAnnotations();
			for (let annotation of annotations) {
				// Don't copy embedded PDF annotations
				if (annotation.annotationIsExternal) {
					continue;
				}
				let newAnnotation = annotation.clone(toItem.libraryID);
				newAnnotation.parentItemID = toItem.id;
				// If there's no explicit author and we're copying an annotation created by another
				// user from a group, set the author to the creating user
				if (fromGroup
						&& !annotation.annotationAuthorName
						&& annotation.createdByUserID != Zotero.Users.getCurrentUserID()) {
					newAnnotation.annotationAuthorName =
						Zotero.Users.getName(annotation.createdByUserID);
				}
				await newAnnotation.save();
			}
		}
		
		// TODO: Other things as necessary
	};
	
	
	/**
	 * Move child items from one item to another
	 *
	 * Requires a transaction
	 *
	 * @param {Zotero.Item} fromItem
	 * @param {Zotero.Item} toItem
	 * @param {Object} options
	 * @param {Boolean} [includeTrashed=false]
	 * @param {Boolean} [skipEditCheck=false]
	 * @return {Promise}
	 */
	this.moveChildItems = async function (fromItem, toItem, { includeTrashed = false, skipEditCheck = false } = {}) {
		Zotero.DB.requireTransaction();
		
		// Annotations on files
		if (fromItem.isFileAttachment()) {
			let annotations = fromItem.getAnnotations(includeTrashed);
			for (let annotation of annotations) {
				if (annotation.annotationIsExternal) {
					continue;
				}
				annotation.parentItemID = toItem.id;
				await annotation.save({ skipEditCheck });
			}
		}
		
		// TODO: Other things as necessary
	};
	
	
	this.merge = function (item, otherItems) {
		Zotero.debug("Merging items");

		return Zotero.DB.executeTransaction(async function () {
			var replPred = Zotero.Relations.replacedItemPredicate;
			var toSave = {};
			toSave[item.id] = item;
			
			var earliestDateAdded = item.dateAdded;

			let remapAttachmentKeys = await this._mergePDFAttachments(item, otherItems);
			await this._mergeWebAttachments(item, otherItems);
			await this._mergeOtherAttachments(item, otherItems);
			
			for (let otherItem of otherItems) {
				if (otherItem.libraryID !== item.libraryID) {
					throw new Error('Items being merged must be in the same library');
				}

				// Use the earliest date added of all the items
				if (otherItem.dateAdded < earliestDateAdded) {
					earliestDateAdded = otherItem.dateAdded;
				}
				
				// Move notes to master
				var noteIDs = otherItem.getNotes(true);
				for (let id of noteIDs) {
					var note = await this.getAsync(id);
					note.parentItemID = item.id;
					Zotero.Notes.replaceItemKey(note, otherItem.key, item.key);
					Zotero.Notes.replaceAllItemKeys(note, remapAttachmentKeys);
					toSave[note.id] = note;
				}
				
				// Move relations to master
				await this._moveRelations(otherItem, item);
				
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
				
				// Trash other item
				otherItem.deleted = true;
				toSave[otherItem.id] = otherItem;
			}
			
			item.setField('dateAdded', earliestDateAdded);

			// Hack to remove master item from duplicates view without recalculating duplicates
			// Pass force = true so observers will be notified before this transaction is committed
			await Zotero.Notifier.trigger('removeDuplicatesMaster', 'item', item.id, null, true);
			
			for (let i in toSave) {
				await toSave[i].save();
			}
		}.bind(this));
	};


	this._mergePDFAttachments = async function (item, otherItems) {
		Zotero.DB.requireTransaction();

		let remapAttachmentKeys = new Map();
		let masterAttachmentHashes = await this._hashItem(item, 'bytes');
		let hashesIncludeText = false;

		for (let otherItem of otherItems) {
			let mergedMasterAttachments = new Set();

			let doMerge = async (fromAttachment, toAttachment) => {
				mergedMasterAttachments.add(toAttachment.id);
	
				await this.moveChildItems(
					fromAttachment,
					toAttachment,
					{
						includeTrashed: true,
						skipEditCheck: true
					}
				);
				await this._moveEmbeddedNote(fromAttachment, toAttachment);
				await this._moveRelations(fromAttachment, toAttachment);
	
				fromAttachment.deleted = true;
				await fromAttachment.save();
	
				// Later on, when processing notes, we'll use this to remap
				// URLs pointing to the old attachment.
				remapAttachmentKeys.set(fromAttachment.key, toAttachment.key);
	
				// Items can only have one replaced item predicate
				if (!toAttachment.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate)) {
					toAttachment.addRelation(Zotero.Relations.replacedItemPredicate,
						Zotero.URI.getItemURI(fromAttachment));
				}
	
				await toAttachment.save();
			};

			for (let otherAttachment of await this.getAsync(otherItem.getAttachments(true))) {
				if (!otherAttachment.isPDFAttachment()) {
					continue;
				}

				// First check if master has an attachment with identical MD5 hash
				let matchingHash = await otherAttachment.attachmentHash;
				let masterAttachmentID = masterAttachmentHashes.get(matchingHash);

				if (!masterAttachmentID && item.numAttachments()) {
					// If that didn't work, hash master attachments by the
					// most common words in their text and check again.
					if (!hashesIncludeText) {
						masterAttachmentHashes = new Map([
							...masterAttachmentHashes,
							...await this._hashItem(item, 'text')
						]);
						hashesIncludeText = true;
					}

					matchingHash = await this._hashAttachmentText(otherAttachment);
					masterAttachmentID = masterAttachmentHashes.get(matchingHash);
				}

				if (!masterAttachmentID || mergedMasterAttachments.has(masterAttachmentID)) {
					Zotero.debug(`No unmerged match for attachment ${otherAttachment.key} in master item - moving`);
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
					continue;
				}

				let masterAttachment = await this.getAsync(masterAttachmentID);

				if (masterAttachment.attachmentContentType !== otherAttachment.attachmentContentType) {
					Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
						+ 'but content types differ - keeping both');
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
					continue;
				}

				if (!((masterAttachment.isImportedAttachment() && otherAttachment.isImportedAttachment())
						|| (masterAttachment.isLinkedFileAttachment() && otherAttachment.isLinkedFileAttachment()))) {
					Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
						+ 'but link modes differ - keeping both');
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
					continue;
				}

				// Check whether master and other have embedded annotations
				// Error -> be safe and assume the item does have embedded annotations
				let logAndBeSafe = (e) => {
					Zotero.logError(e);
					return true;
				};

				if (await otherAttachment.hasEmbeddedAnnotations().catch(logAndBeSafe)) {
					// Other yes, master yes -> keep both
					if (await masterAttachment.hasEmbeddedAnnotations().catch(logAndBeSafe)) {
						Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
							+ 'but both have embedded annotations - keeping both');
						otherAttachment.parentItemID = item.id;
						await otherAttachment.save();
					}
					// Other yes, master no -> keep other
					else {
						Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key}, `
							+ 'but other has embedded annotations - merging into other');
						await doMerge(masterAttachment, otherAttachment);
						otherAttachment.parentItemID = item.id;
						await otherAttachment.save();
					}
					continue;
				}
				// Other no, master yes -> keep master
				// Other no, master no -> keep master

				Zotero.debug(`Master attachment ${masterAttachment.key} matches ${otherAttachment.key} - merging into master`);
				await doMerge(otherAttachment, masterAttachment);
			}
		}

		return remapAttachmentKeys;
	};


	this._mergeWebAttachments = async function (item, otherItems) {
		Zotero.DB.requireTransaction();

		let masterAttachments = (await this.getAsync(item.getAttachments(true)))
			.filter(attachment => attachment.isWebAttachment());

		for (let otherItem of otherItems) {
			for (let otherAttachment of await this.getAsync(otherItem.getAttachments(true))) {
				if (!otherAttachment.isWebAttachment()) {
					continue;
				}

				// If we can find an attachment with the same title *and* URL, use it.
				let masterAttachment = (
					masterAttachments.find(attachment => attachment.getField('title') == otherAttachment.getField('title')
						&& attachment.getField('url') == otherAttachment.getField('url')
						&& attachment.attachmentLinkMode === otherAttachment.attachmentLinkMode)
					|| masterAttachments.find(attachment => attachment.getField('title') == otherAttachment.getField('title')
						&& attachment.attachmentLinkMode === otherAttachment.attachmentLinkMode)
				);

				if (!masterAttachment) {
					Zotero.debug(`No match for web attachment ${otherAttachment.key} in master item - moving`);
					otherAttachment.parentItemID = item.id;
					await otherAttachment.save();
					continue;
				}

				otherAttachment.deleted = true;
				await this._moveRelations(otherAttachment, masterAttachment);
				await otherAttachment.save();

				masterAttachment.addRelation(Zotero.Relations.replacedItemPredicate,
					Zotero.URI.getItemURI(otherAttachment));
				await masterAttachment.save();

				// Don't match with this attachment again
				masterAttachments = masterAttachments.filter(a => a !== masterAttachment);
			}
		}
	};


	this._mergeOtherAttachments = async function (item, otherItems) {
		Zotero.DB.requireTransaction();

		for (let otherItem of otherItems) {
			for (let otherAttachment of await this.getAsync(otherItem.getAttachments(true))) {
				if (otherAttachment.isPDFAttachment() || otherAttachment.isWebAttachment()) {
					continue;
				}

				otherAttachment.parentItemID = item.id;
				await otherAttachment.save();
			}
		}
	};


	/**
	 * Hash each attachment of the provided item. Return a map from hashes to
	 * attachment IDs.
	 *
	 * @param {Zotero.Item} item
	 * @param {String} hashType 'bytes' or 'text'
	 * @return {Promise<Map<String, String>>}
	 */
	this._hashItem = async function (item, hashType) {
		if (!['bytes', 'text'].includes(hashType)) {
			throw new Error('Invalid hash type');
		}

		let attachments = (await this.getAsync(item.getAttachments()))
			.filter(attachment => attachment.isFileAttachment());
		let hashes = new Map();
		await Promise.all(attachments.map(async (attachment) => {
			let hash = hashType === 'bytes'
				? await attachment.attachmentHash
				: await this._hashAttachmentText(attachment);
			if (hash) {
				hashes.set(hash, attachment.id);
			}
		}));
		return hashes;
	};


	/**
	 * Hash an attachment by the most common words in its text.
	 * @param {Zotero.Item} attachment
	 * @return {Promise<String>}
	 */
	this._hashAttachmentText = async function (attachment) {
		var fileInfo;
		try {
			fileInfo = await OS.File.stat(attachment.getFilePath());
		}
		catch (e) {
			if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
				Zotero.debug('_hashAttachmentText: Attachment not found');
				return null;
			}
			Zotero.logError(e);
			return null;
		}
		if (fileInfo.size > 5e8) {
			Zotero.debug('_hashAttachmentText: Attachment too large');
			return null;
		}
		
		let text;
		try {
			text = await attachment.attachmentText;
		}
		catch (e) {
			Zotero.logError(e);
		}
		if (!text) {
			Zotero.debug('_hashAttachmentText: Attachment has no text');
			return null;
		}

		let mostCommonWords = this._getMostCommonWords(text, 50);
		if (mostCommonWords.length < 10) {
			Zotero.debug('_hashAttachmentText: Not enough unique words');
			return null;
		}
		return Zotero.Utilities.Internal.md5(mostCommonWords.sort().join(' '));
	};


	/**
	 * Get the n most common words in s in descending order of frequency.
	 * If s contains fewer than n unique words, the size of the returned array
	 * will be less than n.
	 *
	 * @param {String} s
	 * @param {Number} n
	 * @return {String[]}
	 */
	this._getMostCommonWords = function (s, n) {
		// Use an iterative approach for better performance.

		const whitespaceRe = /\s/;
		const wordCharRe = /\p{Letter}/u; // [a-z] only matches Latin

		let freqs = new Map();
		let currentWord = '';

		for (let codePoint of s) {
			if (whitespaceRe.test(codePoint)) {
				if (currentWord.length > 3) {
					freqs.set(currentWord, (freqs.get(currentWord) || 0) + 1);
				}

				currentWord = '';
				continue;
			}

			if (wordCharRe.test(codePoint)) {
				currentWord += codePoint.toLowerCase();
			}
		}
		
		// Add remaining word, if any
		if (currentWord.length > 3) {
			freqs.set(currentWord, (freqs.get(currentWord) || 0) + 1);
		}

		// Break ties in locale order.
		return [...freqs.keys()]
			.sort((a, b) => (freqs.get(b) - freqs.get(a)) || Zotero.localeCompare(a, b))
			.slice(0, n);
	};

	/**
	 * Move fromItem's embedded note, if it has one, to toItem.
	 * If toItem already has an embedded note, the note will be added as a new
	 * child note item on toItem's parent.
	 * Requires a transaction.
	 */
	this._moveEmbeddedNote = async function (fromItem, toItem) {
		Zotero.DB.requireTransaction();

		if (fromItem.getNote()) {
			let noteItem = toItem;
			if (toItem.getNote()) {
				noteItem = new Zotero.Item('note');
				noteItem.parentItemID = toItem.parentItemID;
			}
			noteItem.setNote(fromItem.getNote());
			fromItem.setNote('');
			Zotero.Notes.replaceItemKey(noteItem, fromItem.key, toItem.key);
			await noteItem.save();
		}
	};


	/**
	 * Move fromItem's relations to toItem as part of a merge.
	 * Requires a transaction.
	 *
	 * @param {Zotero.Item} fromItem
	 * @param {Zotero.Item} toItem
	 * @return {Promise}
	 */
	this._moveRelations = async function (fromItem, toItem) {
		Zotero.DB.requireTransaction();

		let replPred = Zotero.Relations.replacedItemPredicate;
		let fromURI = Zotero.URI.getItemURI(fromItem);
		let toURI = Zotero.URI.getItemURI(toItem);

		// Add relations to toItem
		let oldRelations = fromItem.getRelations();
		for (let pred in oldRelations) {
			oldRelations[pred].forEach(obj => toItem.addRelation(pred, obj));
		}
		
		// Remove merge-tracking relations from fromItem, so that there aren't two
		// subjects for a given deleted object
		let replItems = fromItem.getRelationsByPredicate(replPred);
		for (let replItem of replItems) {
			fromItem.removeRelation(replPred, replItem);
		}
		
		// Update relations on items in the library that point to the other item
		// to point to the master instead
		let rels = await Zotero.Relations.getByObject('item', fromURI);
		for (let rel of rels) {
			// Skip merge-tracking relations, which are dealt with above
			if (rel.predicate == replPred) continue;
			// Skip items in other libraries. They might not be editable, and even
			// if they are, merging items in one library shouldn't affect another library,
			// so those will follow the merge-tracking relations and can optimize their
			// path if they're resaved.
			if (rel.subject.libraryID != toItem.libraryID) continue;
			rel.subject.removeRelation(rel.predicate, fromURI);
			rel.subject.addRelation(rel.predicate, toURI);
			await rel.subject.save();
		}

		// Add relation to track merge
		toItem.addRelation(replPred, fromURI);

		await fromItem.save();
		await toItem.save();
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
		return Zotero.DB.executeTransaction(async function () {
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
			Zotero.Notifier.trigger('refresh', 'trash', libraryID);
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
		
		var idleService = Components.classes["@mozilla.org/widget/useridleservice;1"].
							getService(Components.interfaces.nsIUserIdleService);
		idleService.addIdleObserver(this._emptyTrashIdleObserver, 305);
	}
	
	
	this.addToPublications = function (items, options = {}) {
		if (!items.length) return;
		
		return Zotero.DB.executeTransaction(async function () {
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
			
			await Zotero.Utilities.Internal.forEachChunkAsync(allItems, 250, Zotero.Promise.coroutine(function* (chunk) {
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
		return Zotero.DB.executeTransaction(async function () {
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
			await Zotero.Utilities.Internal.forEachChunkAsync(allItems, 250, Zotero.Promise.coroutine(function* (chunk) {
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
	 * @param {Object} [options]
	 * @param {Boolean} [options.omitBidiIsolates]
	 * @return {String}
	 */
	this.getFirstCreatorFromData = function (itemTypeID, creatorsData, options) {
		if (!options) {
			options = {
				omitBidiIsolates: false
			};
		}
		
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
				let args = options.omitBidiIsolates
					? [a.lastName, b.lastName]
					// \u2068 FIRST STRONG ISOLATE: Isolates the directionality of characters that follow
					// \u2069 POP DIRECTIONAL ISOLATE: Pops the above isolation
					: [`\u2068${a.lastName}\u2069`, `\u2068${b.lastName}\u2069`];
				return Zotero.getString('general.andJoiner', args);
			}
			if (matches.length >= 3) {
				return matches[0].lastName + " " + Zotero.getString('general.etAl');
			}
		}
		
		return "";
	};
	
	
	/**
	 * Get the top-level items of all passed items
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Zotero.Item[]}
	 */
	this.getTopLevel = function (items) {
		return [...new Set(items.map(item => item.topLevelItem))];
	};
	
	
	/**
	 * Return an array of items with descendants of selected top-level items removed
	 *
	 * Non-top-level items that aren't descendents of selected items are kept.
	 *
	 * @param {Zotero.Item[]}
	 * @return {Zotero.Item[]}
	 */
	this.keepTopLevel = function (items) {
		var topLevelItems = new Set(
			items.filter(item => item.isTopLevelItem())
		);
		return items.filter((item) => {
			var topLevelItem = !item.isTopLevelItem() && item.topLevelItem;
			// Not a child item or not a child of one of the passed items
			return !topLevelItem || !topLevelItems.has(topLevelItem);
		});
	};
	
	
	this.keepParents = function (items) {
		Zotero.debug("Zotero.Items.keepParents() is deprecated -- use Zotero.Items.keepTopLevel() instead");
		return this.keepTopLevel(items);
	};
	
	
	/**
	 * Returns a rough count (0, 1, or 2) of the number of file attachments implied by the passed
	 * array of items (which can include both parent and child items) in order to display a menu
	 * label (e.g., "Show File" or "Show Files")
	 *
	 * @param {[Zotero.Item]} items
	 * @param {Function} filter - An additional filter function to run on file attachment items to
	 *     determine if they qualify
	 * @return {Integer} - 0, 1, or 2, where 2 means >1
	 */
	this.numDistinctFileAttachmentsForLabel = function (items, filter = item => item.isFileAttachment()) {
		const MAX_ITEMS = 2;
		var num = 0;
		var foundKey;
		for (let item of items) {
			if (item.isRegularItem()) {
				// Ideally we want to avoid counting a parent item and its primary attachment as
				// multiple files, but getBestAttachment() is asynchronous and we need to do this
				// synchronously, so try to use the cached best-attachment state
				let { key } = item.getBestAttachmentStateCached();
				let bestAttachment = key && Zotero.Items.getByLibraryAndKey(item.libraryID, key);
				if (bestAttachment && filter(bestAttachment)) {
					if (foundKey) {
						if (key == foundKey) {
							continue;
						}
						return MAX_ITEMS;
					}
					foundKey = key;
					num++;
				}
				// If we don't have a cached primary attachment, the best we can do is count the
				// parent item if it has any file attachments. Since we're not recording the actual
				// attachment being counted, this might result in returning MAX_ITEMS even if only
				// the parent item and primary attachment are selected.
				else if (item.getAttachments().map(itemID => Zotero.Items.get(itemID)).some(filter)) {
					foundKey = item.key;
					num++;
				}
			}
			else if (filter(item)) {
				if (foundKey) {
					if (item.key == foundKey) {
						continue;
					}
					return MAX_ITEMS;
				}
				foundKey = item.key;
				num++;
			}
			if (num >= MAX_ITEMS) {
				break;
			}
		}
		return num;
	};
	
	
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
		
		var editorCreatorTypeID = Zotero.CreatorTypes.getID('editor');
		var contributorCreatorTypeID = Zotero.CreatorTypes.getID('contributor');
		
		/* This whole block is to get the firstCreator */
		var localizedAnd = Zotero.getString('general.andJoiner').replace(/%S/g, '%s');
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
				"SELECT PRINTF(" +
					`'${localizedAnd}'` +
					", " +
					// \u2068 FIRST STRONG ISOLATE: Isolates the directionality of characters that follow
					// \u2069 POP DIRECTIONAL ISOLATE: Pops the above isolation
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators IC NATURAL JOIN creators " +
					"LEFT JOIN itemTypeCreatorTypes ITCT " +
					"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
					"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
					", " +
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators IC NATURAL JOIN creators " +
					"LEFT JOIN itemTypeCreatorTypes ITCT " +
					"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=O.itemTypeID) " +
					"WHERE itemID=O.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
				")" +
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
				"SELECT COUNT(*) FROM itemCreators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID}` +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID}` +
			") " +
			"WHEN 2 THEN (" +
				"SELECT PRINTF(" +
					`'${localizedAnd}'` +
					", " +
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators NATURAL JOIN creators " +
					`WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} ` +
					"ORDER BY orderIndex LIMIT 1)" +
					", " +
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators NATURAL JOIN creators " +
					`WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} ` +
					"ORDER BY orderIndex LIMIT 1,1) " +
				")" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} ` +
				"ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedEtAl + "' " +
			") " +
			"END, " +
			
			// Then try contributors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID}` +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID}` +
			") " +
			"WHEN 2 THEN (" +
				"SELECT PRINTF(" +
					`'${localizedAnd}'` +
					", " +
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators NATURAL JOIN creators " +
					`WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} ` +
					"ORDER BY orderIndex LIMIT 1)" +
					", " +
					"(SELECT '\u2068' || lastName || '\u2069' FROM itemCreators NATURAL JOIN creators " +
					`WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} ` +
					"ORDER BY orderIndex LIMIT 1,1) " +
				")" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				`WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} ` +
				"ORDER BY orderIndex LIMIT 1)" +
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
		
		var editorCreatorTypeID = Zotero.CreatorTypes.getID('editor');
		var contributorCreatorTypeID = Zotero.CreatorTypes.getID('contributor');
		
		var nameSQL = "lastName || ' ' || firstName ";
		
		var sql = "COALESCE("
			// First try for primary creator types
			+ "CASE (" +
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
			") "
			+ "END, "
			
			// Then try editors
			+ "CASE ("
				+ "SELECT COUNT(*) FROM itemCreators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID}`
			+ ") "
			+ "WHEN 0 THEN NULL "
			+ "WHEN 1 THEN ("
				+ "SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID}`
			+ ") "
			+ "WHEN 2 THEN ("
				+ "SELECT "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1,1) "
			+ ") "
			+ "ELSE ("
				+ "SELECT "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1,1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${editorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 2,1)"
			+ ") "
			+ "END, "
			
			// Then try contributors
			+ "CASE ("
				+ "SELECT COUNT(*) FROM itemCreators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID}`
			+ ") "
			+ "WHEN 0 THEN NULL "
			+ "WHEN 1 THEN ("
				+ "SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID}`
			+ ") "
			+ "WHEN 2 THEN ("
				+ "SELECT "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1,1) "
			+ ") "
			+ "ELSE ("
				+ "SELECT "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 1,1)"
				+ " || ' ' || "
				+ "(SELECT " + nameSQL + " FROM itemCreators NATURAL JOIN creators "
				+ `WHERE itemID=O.itemID AND creatorTypeID=${contributorCreatorTypeID} `
				+ "ORDER BY orderIndex LIMIT 2,1)"
			+ ") "
			+ "END"
		+ ") AS sortCreator";
		
		_sortCreatorSQL = sql;
		return sql;
	}


	let _stripFromSortTitle = [
		'</?i>',
		'</?b>',
		'</?sub>',
		'</?sup>',
		'<span style="font-variant:small-caps;">',
		'<span class="nocase">',
		'</span>',
		// Any punctuation at the beginning of the string, repeated any number
		// of times, and any opening punctuation that follows
		'^\\s*([^\\P{P}@#*])\\1*[\\p{Ps}"\']*',
	].map(re => Zotero.Utilities.XRegExp(re, 'g'));
	
	
	this.getSortTitle = function (title) {
		if (!title) {
			return '';
		}

		if (typeof title == 'number') {
			return title.toString();
		}

		for (let re of _stripFromSortTitle) {
			title = title.replace(re, '');
		}
		return title.trim();
	};


	/**
	 * Find attachment items whose paths begin with the passed `pathPrefix` and don't exist on disk
	 *
	 * @param {Number} libraryID
	 * @param {String} pathPrefix
	 * @return {Zotero.Item[]}
	 */
	this.findMissingLinkedFiles = async function (libraryID, pathPrefix) {
		let sql = "SELECT itemID FROM items JOIN itemAttachments USING (itemID) "
			+ "WHERE itemID NOT IN (SELECT itemID FROM deletedItems) "
			+ `AND linkMode=${Zotero.Attachments.LINK_MODE_LINKED_FILE} `
			+ "AND path LIKE ? ESCAPE '\\' "
			+ "AND libraryID=?";
		let ids = await Zotero.DB.columnQueryAsync(sql, [Zotero.DB.escapeSQLExpression(pathPrefix) + '%', libraryID]);
		let items = await this.getAsync(ids);
		let missingItems = await Promise.all(
			items.map(async item => (await item.fileExists() ? false : item))
		);
		return missingItems.filter(Boolean);
	};
	
	
	Zotero.DataObjects.call(this);
	
	return this;
}.bind(Object.create(Zotero.DataObjects.prototype))();
