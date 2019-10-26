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
 * Same structure as Zotero.Creators -- make changes in both places if possible
 */
Zotero.Tags = new function() {
	this.MAX_COLORED_TAGS = 9;
	this.MAX_SYNC_LENGTH = 255;
	
	var _initialized = false;
	var _tagsByID = new Map();
	var _idsByTag = new Map();
	var _libraryColors = {};
	var _libraryColorsByName = {};
	var _itemsListImagePromises = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield Zotero.DB.queryAsync(
			"SELECT tagID, name FROM tags",
			false,
			{
				onRow: function (row) {
					var tagID = row.getResultByIndex(0);
					var name = row.getResultByIndex(1);
					_tagsByID.set(tagID, name);
					_idsByTag.set(name, tagID);
				}
			}
		);
		_initialized = true;
	});
	
	
	/**
	 * Returns a tag for a given tagID
	 *
	 * @param {Integer} tagID
	 * @return {Promise<String|false>} - A tag name, or false if tag with id not found
	 */
	this.getName = function (tagID) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		var name = _tagsByID.get(tagID);
		return name !== undefined ? name : false;
	};
	
	
	/**
	 * Returns the tagID matching given fields, or false if none
	 *
	 * @param {String} name - Tag data in API JSON format
	 * @return {Integer} tagID
	 */
	this.getID = function (name) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		if (arguments.length > 1) {
			throw new Error("Zotero.Tags.getID() no longer takes a second parameter -- use Zotero.Tags.create()");
		}
		
		data = this.cleanData({
			tag: name
		});
		var id = _idsByTag.get(data.tag);
		return id !== undefined ? id : false;
	};
	
	
	/**
	 * Returns the tagID matching given fields, or creates one and returns its id
	 *
	 * Requires a wrapping transaction
	 *
	 * @param {String} name - Tag data in API JSON format
	 * @return {Promise<Integer>} tagID
	 */
	this.create = Zotero.Promise.coroutine(function* (name) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		Zotero.DB.requireTransaction();
		data = this.cleanData({
			tag: name
		});
		var id = this.getID(data.tag);
		if (!id) {
			id = Zotero.ID.get('tags');
			let sql = "INSERT INTO tags (tagID, name) VALUES (?, ?)";
			yield Zotero.DB.queryAsync(sql, [id, data.tag]);
			_tagsByID.set(id, data.tag);
			_idsByTag.set(data.tag, id);
		}
		return id;
	});
	
	
	this.getLongTagsInLibrary = Zotero.Promise.coroutine(function* (libraryID) {
		var sql = "SELECT DISTINCT tagID FROM tags "
			+ "JOIN itemTags USING (tagID) "
			+ "JOIN items USING (itemID) "
			+ "WHERE libraryID=? AND LENGTH(name)>?"
		return yield Zotero.DB.columnQueryAsync(sql, [libraryID, this.MAX_SYNC_LENGTH]);
	});
	
	
	/**
	 * Get all tags in library
	 *
	 * @param {Number} libraryID
	 * @param {Number[]} [types] - Tag types to fetch
	 * @return {Promise<Array>}   A promise for an array containing tag objects in API JSON format
	 *                            [{ { tag: "foo" }, { tag: "bar", type: 1 }]
	 */
	this.getAll = async function (libraryID, types) {
		return this.getAllWithin({ libraryID, types });
	};
	
	
	/**
	 * Get all tags within the items of a temporary table of search results
	 *
	 * @param {Object}
	 * @param {Object.Number} libraryID
	 * @param {Object.String} tmpTable - Temporary table with items to use
	 * @param {Object.Number[]} [types] - Array of tag types to fetch
	 * @param {Object.Number[]} [tagIDs] - Array of tagIDs to limit the result to
	 * @return {Promise<Array[]>} - Promise for an array of tag objects in API JSON format
	 */
	this.getAllWithin = async function ({ libraryID, tmpTable, types, tagIDs }) {
		// mozStorage/Proxy are slow, so get in a single column
		var sql = "SELECT DISTINCT tagID || ':' || type FROM itemTags "
			+ "JOIN tags USING (tagID) ";
		var params = [];
		if (libraryID) {
			sql += "JOIN items USING (itemID) WHERE libraryID = ? ";
			params.push(libraryID);
		}
		else {
			sql += "WHERE 1 ";
		}
		if (tmpTable) {
			if (libraryID) {
				throw new Error("tmpTable and libraryID are mutually exclusive");
			}
			sql += "AND itemID IN (SELECT itemID FROM " + tmpTable + ") ";
		}
		if (types && types.length) {
			sql += "AND type IN (" + new Array(types.length).fill('?').join(', ') + ") ";
			params.push(...types);
		}
		if (tagIDs) {
			sql += "AND tagID IN (" + new Array(tagIDs.length).fill('?').join(', ') + ") ";
			params.push(...tagIDs);
		}
		// Not a perfect locale sort, but speeds up the sort in the tag selector later without any
		// discernible performance cost
		sql += "ORDER BY name COLLATE NOCASE";
		var rows = await Zotero.DB.columnQueryAsync(sql, params);
		return rows.map((row) => {
			var [tagID, type] = row.split(':');
			return this.cleanData({
				tag: Zotero.Tags.getName(parseInt(tagID)),
				type: type
			});
		});
	};
	
	
	/**
	 * Get the items associated with the given tag
	 *
	 * @param  {Number}             tagID
	 * @return {Promise<Number[]>}  A promise for an array of itemIDs
	 */
	this.getTagItems = function (libraryID, tagID) {
		var sql = "SELECT itemID FROM itemTags JOIN items USING (itemID) "
			+ "WHERE tagID=? AND libraryID=?";
		return Zotero.DB.columnQueryAsync(sql, [tagID, libraryID]);
	}
	
	
	this.search = Zotero.Promise.coroutine(function* (str) {
		var sql = 'SELECT name AS tag, type FROM tags';
		if (str) {
			sql += ' WHERE name LIKE ?';
		}
		var rows = yield Zotero.DB.queryAsync(sql, str ? '%' + str + '%' : undefined);
		return rows.map((row) => this.cleanData(row));
	});
	
	
	/**
	 * Rename a tag and update the tag colors setting accordingly if necessary
	 *
	 * @param {Number} tagID
	 * @param {String} newName
	 * @return {Promise}
	 */
	this.rename = Zotero.Promise.coroutine(function* (libraryID, oldName, newName) {
		Zotero.debug("Renaming tag '" + oldName + "' to '" + newName + "' in library " + libraryID);
		
		oldName = oldName.trim();
		newName = newName.trim();
		
		if (oldName == newName) {
			Zotero.debug("Tag name hasn't changed", 2);
			return;
		}
		
		var oldTagID = this.getID(oldName);
		if (!oldTagID) {
			throw new Error(`Tag '${oldName}' not found`);
		}
		
		// We need to know if the old tag has a color assigned so that
		// we can assign it to the new name
		var oldColorData = this.getColor(libraryID, oldName);
		
		yield Zotero.DB.executeTransaction(function* () {
			var oldItemIDs = yield this.getTagItems(libraryID, oldTagID);
			var newTagID = yield this.create(newName);
			
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				oldItemIDs,
				Zotero.DB.MAX_BOUND_PARAMETERS - 2,
				Zotero.Promise.coroutine(function* (chunk) {
					let placeholders = chunk.map(() => '?').join(',');
					
					// This is ugly, but it's much faster than doing replaceTag() for each item
					let sql = 'UPDATE OR REPLACE itemTags SET tagID=?, type=0 '
						+ 'WHERE tagID=? AND itemID IN (' + placeholders + ')';
					yield Zotero.DB.queryAsync(sql, [newTagID, oldTagID].concat(chunk));
					
					sql = 'UPDATE items SET synced=0, clientDateModified=? '
						+ 'WHERE itemID IN (' + placeholders + ')'
					yield Zotero.DB.queryAsync(sql, [Zotero.DB.transactionDateTime].concat(chunk));
					
					yield Zotero.Items.reload(oldItemIDs, ['primaryData', 'tags'], true);
				})
			);
			
			var notifierData = {};
			for (let i = 0; i < oldItemIDs.length; i++) {
				notifierData[oldItemIDs[i] + '-' + newTagID] = {
					tag: newName,
					old: {
						tag: oldName
					}
				}
			};
			
			Zotero.Notifier.queue(
				'modify',
				'item-tag',
				oldItemIDs.map(itemID => itemID + '-' + newTagID),
				notifierData
			);
			
			yield this.purge(oldTagID);
		}.bind(this));
		
		if (oldColorData) {
			yield Zotero.DB.executeTransaction(function* () {
				// Remove color from old tag
				yield this.setColor(libraryID, oldName);
				
				// Add color to new tag
				yield this.setColor(
					libraryID,
					newName,
					oldColorData.color,
					oldColorData.position
				);
			}.bind(this));
		}
	});
	
	
	/**
	 * @param {Integer} libraryID
	 * @param {Integer[]} tagIDs
	 * @param {Function} [onProgress]
	 * @param {Integer[]} [types]
	 * @return {Promise}
	 */
	this.removeFromLibrary = Zotero.Promise.coroutine(function* (libraryID, tagIDs, onProgress, types) {
		var d = new Date();
		
		if (!Array.isArray(tagIDs)) {
			tagIDs = [tagIDs];
		}
		if (types && !Array.isArray(types)) {
			types = [types];
		}
		
		var colors = this.getColors(libraryID);
		var done = 0;
		
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			tagIDs,
			100,
			async function (chunk) {
				await Zotero.DB.executeTransaction(function* () {
					var rowIDs = [];
					var itemIDs = [];
					var uniqueTags = new Set();
					var notifierIDs = [];
					var notifierData = {};
					
					var sql = 'SELECT IT.ROWID AS rowID, tagID, itemID, type FROM itemTags IT '
						+ 'JOIN items USING (itemID) '
						+ 'WHERE libraryID=? AND tagID IN ('
						+ Array(chunk.length).fill('?').join(', ')
						+ ') ';
					if (types) {
						sql += 'AND type IN (' + types.join(', ') + ') ';
					}
					sql += 'ORDER BY tagID, type';
					var rows = yield Zotero.DB.queryAsync(sql, [libraryID, ...chunk]);
					for (let { rowID, tagID, itemID, type } of rows) {
						uniqueTags.add(tagID);
						
						let name = this.getName(tagID);
						if (name === false) {
							continue;
						}
						
						rowIDs.push(rowID);
						itemIDs.push(itemID);
						
						let ids = itemID + '-' + tagID;
						notifierIDs.push(ids);
						notifierData[ids] = {
							libraryID: libraryID,
							tag: name,
							type
						};
						
						// If we're deleting the tag and not just a specific type, also clear any
						// tag color
						if (colors.has(name) && !types) {
							yield this.setColor(libraryID, name, false);
						}
					}
					if (itemIDs.length) {
						Zotero.Notifier.queue('remove', 'item-tag', notifierIDs, notifierData);
					}
					
					sql = "DELETE FROM itemTags WHERE ROWID IN (" + rowIDs.join(", ") + ")";
					yield Zotero.DB.queryAsync(sql);
					
					yield this.purge(chunk);
					
					// Update internal timestamps on all items that had these tags
					yield Zotero.Utilities.Internal.forEachChunkAsync(
						Zotero.Utilities.arrayUnique(itemIDs),
						Zotero.DB.MAX_BOUND_PARAMETERS - 1,
						async function (chunk) {
							var sql = 'UPDATE items SET synced=0, clientDateModified=? '
								+ 'WHERE itemID IN (' + Array(chunk.length).fill('?').join(',') + ')';
							await Zotero.DB.queryAsync(sql, [Zotero.DB.transactionDateTime].concat(chunk));
							
							await Zotero.Items.reload(itemIDs, ['primaryData', 'tags'], true);
						}
					);
					
					if (onProgress) {
						done += uniqueTags.size;
						onProgress(done, tagIDs.length);
					}
				}.bind(this));
			}.bind(this)
		);
		
		Zotero.debug(`Removed ${tagIDs.length} ${Zotero.Utilities.pluralize(tagIDs.length, 'tag')} `
			+ `in ${new Date() - d} ms`);
	});
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Integer[]} - An array of tagIDs
	 */
	this.getAutomaticInLibrary = function (libraryID) {
		var sql = "SELECT DISTINCT tagID FROM itemTags JOIN items USING (itemID) "
			+ "WHERE type=1 AND libraryID=?"
		return Zotero.DB.columnQueryAsync(sql, libraryID);
	};
	
	
	/**
	 * Remove all automatic tags in the given library
	 */
	this.removeAutomaticFromLibrary = async function (libraryID, onProgress) {
		var tagType = 1;
		var tagIDs = await this.getAutomaticInLibrary(libraryID);
		if (onProgress) {
			onProgress(0, tagIDs.length);
		}
		return this.removeFromLibrary(libraryID, tagIDs, onProgress, tagType);
	};
	
	
	/**
	 * Delete obsolete tags from database
	 *
	 * @param {Number|Number[]} [tagIDs] - tagID or array of tagIDs to purge
	 * @return {Promise}
	 */
	this.purge = Zotero.Promise.coroutine(function* (tagIDs) {
		var d = new Date();
		
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Tags not yet loaded");
		}
		
		if (!tagIDs && !Zotero.Prefs.get('purge.tags')) {
			return;
		}
		
		if (tagIDs) {
			tagIDs = Zotero.flattenArguments(tagIDs);
		}
		
		if (tagIDs && !tagIDs.length) {
			return;
		}
		
		Zotero.DB.requireTransaction();
		
		var sql;
		
		// Use given tags, as long as they're orphaned
		if (tagIDs) {
			sql = "CREATE TEMPORARY TABLE tagDelete (tagID INT PRIMARY KEY)";
			yield Zotero.DB.queryAsync(sql);
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				tagIDs,
				Zotero.DB.MAX_BOUND_PARAMETERS,
				function (chunk) {
					return Zotero.DB.queryAsync(
						"INSERT OR IGNORE INTO tagDelete VALUES "
							+ Array(chunk.length).fill('(?)').join(', '),
						chunk
					);
				}
			);
			
			// Skip tags that are still linked to items
			sql = "DELETE FROM tagDelete WHERE tagID IN (SELECT tagID FROM itemTags)";
			yield Zotero.DB.queryAsync(sql);
			
			sql = "SELECT tagID AS id, name FROM tagDelete JOIN tags USING (tagID)";
			var toDelete = yield Zotero.DB.queryAsync(sql);
		}
		// Look for orphaned tags
		else {
			sql = "CREATE TEMPORARY TABLE tagDelete AS "
				+ "SELECT tagID FROM tags WHERE tagID NOT IN (SELECT tagID FROM itemTags)";
			yield Zotero.DB.queryAsync(sql);
			
			sql = "CREATE INDEX tagDelete_tagID ON tagDelete(tagID)";
			yield Zotero.DB.queryAsync(sql);
			
			sql = "SELECT tagID AS id, name FROM tagDelete JOIN tags USING (tagID)";
			var toDelete = yield Zotero.DB.queryAsync(sql);
		}
		
		if (!toDelete.length) {
			return Zotero.DB.queryAsync("DROP TABLE tagDelete");
		}
		
		var ids = [];
		notifierData = {};
		for (let i=0; i<toDelete.length; i++) {
			let row = toDelete[i];
			
			Zotero.DB.addCurrentCallback('commit', () => {
				_tagsByID.delete(row.id);
				_idsByTag.delete(row.name);
			});
			
			ids.push(row.id);
			notifierData[row.id] = {
				old: {
					tag: row.name
				}
			};
		}
		
		sql = "DELETE FROM tags WHERE tagID IN (SELECT tagID FROM tagDelete);";
		yield Zotero.DB.queryAsync(sql);
		
		sql = "DROP TABLE tagDelete";
		yield Zotero.DB.queryAsync(sql);
		
		Zotero.Notifier.queue('delete', 'tag', ids, notifierData);
		
		Zotero.Prefs.set('purge.tags', false);
		
		Zotero.debug(`Purged ${toDelete.length} ${Zotero.Utilities.pluralize(toDelete.length, 'tag')} `
			+ `in ${new Date() - d} ms`);
	});
	
	
	//
	// Tag color methods
	//
	/**
	 *
	 * @param {Integer} libraryID
	 * @param {String} name Tag name
	 * @return {Object|false} An object containing 'color' as a hex string (e.g., '#990000') and
	 *     'position', or false if no colored tag with that name
	 */
	this.getColor = function (libraryID, name) {
		// Cache colors
		this.getColors(libraryID);
		return _libraryColorsByName[libraryID].get(name) || false;
	}
	
	
	/**
	 * Get color data by position (number key - 1)
	 *
	 * @param {Integer} libraryID
	 * @param {Integer} position The position of the tag, starting at 0
	 * @return {Object|false} An object containing 'name' and 'color', or false if no color at
	 *     the given position
	 */
	this.getColorByPosition = function (libraryID, position) {
		this.getColors(libraryID);
		return _libraryColors[libraryID][position] ? _libraryColors[libraryID][position] : false;
	}
	
	
	/**
	 * Get colored tags within a given library
	 *
	 * @param {Integer} libraryID
	 * @return {Map} - A Map with tag names as keys and objects containing 'color' and 'position'
	 *     as values
	 */
	this.getColors = function (libraryID) {
		if (!libraryID) {
			throw new Error("libraryID not provided");
		}
		
		if (_libraryColorsByName[libraryID]) {
			return _libraryColorsByName[libraryID];
		}
		
		var tagColors = Zotero.SyncedSettings.get(libraryID, 'tagColors') || [];
		_libraryColors[libraryID] = tagColors;
		_libraryColorsByName[libraryID] = new Map;
		
		// Also create object keyed by name for quick checking for individual tag colors
		for (let i=0; i<tagColors.length; i++) {
			_libraryColorsByName[libraryID].set(tagColors[i].name, {
				color: tagColors[i].color,
				position: i
			});
		}
		
		return _libraryColorsByName[libraryID];
	};
	
	
	/**
	 * Assign a color to a tag
	 *
	 * @return {Promise}
	 */
	this.setColor = Zotero.Promise.coroutine(function* (libraryID, name, color, position) {
		if (!Number.isInteger(libraryID)) {
			throw new Error("libraryID must be an integer");
		}
		
		this.getColors(libraryID);
		var tagColors = _libraryColors[libraryID];
		
		name = name.trim();
		
		// Unset
		if (!color) {
			// Trying to clear color on tag that doesn't have one
			if (!_libraryColorsByName[libraryID].has(name)) {
				return;
			}
			
			_libraryColors[libraryID] = tagColors = tagColors.filter(val => val.name != name);
			_libraryColorsByName[libraryID].delete(name);
		}
		else {
			// Get current position if present
			var currentPosition = -1;
			for (let i=0; i<tagColors.length; i++) {
				if (tagColors[i].name == name) {
					currentPosition = i;
					break;
				}
			}
			
			// Remove if present
			if (currentPosition != -1) {
				// If no position was specified, we'll reinsert into the same place
				if (typeof position == 'undefined') {
					position = currentPosition;
				}
				tagColors.splice(currentPosition, 1);
			}
			var newObj = {
				name: name,
				color: color
			};
			// If no position or after end, add at end
			if (typeof position == 'undefined' || position >= tagColors.length) {
				tagColors.push(newObj);
			}
			// Otherwise insert into new position
			else {
				tagColors.splice(position, 0, newObj);
			}
		}
		
		if (tagColors.length) {
			return Zotero.SyncedSettings.set(libraryID, 'tagColors', tagColors);
		}
		else {
			return Zotero.SyncedSettings.clear(libraryID, 'tagColors');
		}
	});
	
	
	/**
	 * Update caches and trigger redrawing of items in the items list
	 * when a 'tagColors' setting is modified
	 */
	this.notify = Zotero.Promise.coroutine(function* (event, type, ids, extraData) {
		if (type != 'setting') {
			return;
		}
		
		for (let i=0; i<ids.length; i++) {
			let libraryID, setting;
			[libraryID, setting] = ids[i].split("/");
			libraryID = parseInt(libraryID);
			
			if (setting != 'tagColors') {
				continue;
			}
			
			delete _libraryColors[libraryID];
			delete _libraryColorsByName[libraryID];
			
			// Get the tag colors for each library in which they were modified
			let tagColors = Zotero.SyncedSettings.get(libraryID, 'tagColors');
			if (!tagColors) {
				tagColors = [];
			}
			
			let id = libraryID + "/" + setting;
			if ((event == 'modify' || event == 'delete') && extraData[id].changed) {
				var previousTagColors = extraData[id].changed.value;
			}
			else {
				var previousTagColors = [];
			}
			
			var affectedItems = [];
			
			// Get all items linked to previous or current tag colors
			var tagNames = tagColors.concat(previousTagColors).map(val => val.name);
			tagNames = Zotero.Utilities.arrayUnique(tagNames);
			if (tagNames.length) {
				for (let i=0; i<tagNames.length; i++) {
					let tagID = this.getID(tagNames[i]);
					// Colored tags may not exist
					if (tagID) {
						affectedItems = affectedItems.concat(
							yield this.getTagItems(libraryID, tagID)
						);
					}
				};
			}
			
			if (affectedItems.length) {
				yield Zotero.Notifier.trigger('redraw', 'item', affectedItems, { column: 'title' });
			}
		}
	});
	
	
	this.toggleItemsListTags = async function (items, tagName) {
		if (!items.length) {
			return;
		}
		
		// Color setting can exist without tag. If missing, we have to add the tag.
		var tagID = this.getID(tagName);
		
		return Zotero.DB.executeTransaction(function* () {
			// Base our action on the first item. If it has the tag,
			// remove the tag from all items. If it doesn't, add it to all.
			var firstItem = items[0];
			// Remove from all items
			if (tagID && firstItem.hasTag(tagName)) {
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					item.removeTag(tagName);
					yield item.save({
						skipDateModifiedUpdate: true
					});
				}
				Zotero.Prefs.set('purge.tags', true);
			}
			// Add to all items
			else {
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					item.addTag(tagName);
					yield item.save({
						skipDateModifiedUpdate: true
					});
				}
			}
		}.bind(this));
	};
	
	
	/**
	 * @param {Zotero.Item[]}
	 * @return {Promise}
	 */
	this.removeColoredTagsFromItems = async function (items) {
		return Zotero.DB.executeTransaction(async function () {
			for (let item of items) {
				let colors = this.getColors(item.libraryID);
				let tags = item.getTags();
				let changed = false;
				for (let tag of tags) {
					if (colors.has(tag.tag)) {
						item.removeTag(tag.tag);
						changed = true;
					}
				}
				if (changed) {
					await item.save({
						skipDateModifiedUpdate: true
					});
				}
			}
		}.bind(this));
	};
	
	
	/**
	 * A tree cell can show only one image, and (as of Fx19) it can't be an SVG,
	 * so we need to generate a composite image containing the existing item type
	 * icon and one or more tag color swatches.
	 *
	 * @params {String[]} colors - Array of swatch colors
	 * @params {String} extraImage - chrome:// URL of image to add to final image
	 * @params {Boolean} [retracted = false] - If true, show an icon indicating the item was retracted
	 * @return {Promise<String>} - A promise for a data: URL for a PNG
	 */
	this.generateItemsListImage = async function (colors, extraImage, retracted) {
		var multiplier = Zotero.hiDPI ? 2 : 1;
		
		var canvasHeight = 16 * multiplier;
		var extraImageWidth = 16 * multiplier;
		var extraImageHeight = 16 * multiplier;
		var retractionImage = `chrome://zotero/skin/cross${Zotero.hiDPI ? '@1.5x' : ''}.png`;
		var retractionImageLeftPadding = 1 * multiplier;
		var retractionImageWidth = 16 * multiplier;
		var retractionImageHeight = 16 * multiplier;
		var retractionImageScaledWidth = 12 * multiplier;
		var retractionImageScaledHeight = 12 * multiplier;
		var tagsLeftPadding = 3 * multiplier;
		var swatchSeparator = 3 * multiplier;
		var swatchWidth = 8 * multiplier;
		var swatchHeight = 8 * multiplier;
		
		var hash = colors.join("") + (extraImage ? extraImage : "") + (retracted ? "retracted" : "");
		
		if (_itemsListImagePromises[hash]) {
			return _itemsListImagePromises[hash];
		}
		
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			.getService(Components.interfaces.nsIAppShellService)
			.hiddenDOMWindow;
		var doc = win.document;
		var canvas = doc.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		
		var width = extraImageWidth
			+ (retracted
				? (retractionImageLeftPadding
					+ ((retractionImageWidth - retractionImageScaledWidth) / 2)
					+ retractionImageScaledWidth)
				: 0)
			+ (colors.length ? tagsLeftPadding : 0)
			+ (colors.length * (swatchWidth + swatchSeparator));
		
		canvas.width = width;
		canvas.height = canvasHeight;
		var swatchTop = Math.floor((canvasHeight - swatchHeight) / 2);
		var ctx = canvas.getContext('2d');
		
		// If extra image hasn't started loading, start now
		if (_itemsListImagePromises[extraImage] === undefined) {
			let ios = Services.io;
			let uri = ios.newURI(extraImage, null, null);
			let img = new win.Image();
			img.src = uri.spec;
			_itemsListImagePromises[extraImage] = new Zotero.Promise((resolve) => {
				img.onload = function () {
					resolve(img);
				};
			});
		}
		
		// If retraction image hasn't started loading, start now
		if (_itemsListImagePromises[retractionImage] === undefined) {
			let ios = Services.io;
			let uri = ios.newURI(retractionImage, null, null);
			let img = new win.Image();
			img.src = uri.spec;
			_itemsListImagePromises[retractionImage] = new Zotero.Promise((resolve) => {
				img.onload = function () {
					resolve(img);
				};
			});
		}
		
		var x = extraImageWidth
			+ (retracted ? retractionImageLeftPadding + retractionImageWidth: 0)
			+ tagsLeftPadding;
		for (let i = 0, len = colors.length; i < len; i++) {
			ctx.fillStyle = colors[i];
			_canvasRoundRect(ctx, x, swatchTop + 1, swatchWidth, swatchHeight, 2, true, false);
			x += swatchWidth + swatchSeparator;
		}
		
		if (retracted) {
			let [img1, img2] = await Zotero.Promise.all([
				_itemsListImagePromises[extraImage],
				_itemsListImagePromises[retractionImage]
			]);
			ctx.drawImage(img1, 0, 0, extraImageWidth, extraImageHeight);
			ctx.drawImage(
				img2,
				extraImageWidth + retractionImageLeftPadding
					+ ((retractionImageWidth - retractionImageScaledWidth) / 2),
				(retractionImageHeight - retractionImageScaledHeight) / 2 + 1, // Lower by 1
				retractionImageScaledWidth,
				retractionImageScaledHeight
			);
		}
		else {
			let img = await _itemsListImagePromises[extraImage];
			ctx.drawImage(img, 0, 0, extraImageWidth, extraImageHeight);
		}
		
		var dataURI = canvas.toDataURL("image/png");
		_itemsListImagePromises[hash] = Zotero.Promise.resolve(dataURI);
		return dataURI;
	};
	
	
	/**
	 * From http://js-bits.blogspot.com/2010/07/canvas-rounded-corner-rectangles.html
	 *
	 * Draws a rounded rectangle using the current state of the canvas.
	 * If you omit the last three params, it will draw a rectangle
	 * outline with a 5 pixel border radius
	 *
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Number} x The top left x coordinate
	 * @param {Number} y The top left y coordinate
	 * @param {Number} width The width of the rectangle
	 * @param {Number} height The height of the rectangle
	 * @param {Number} radius The corner radius. Defaults to 5;
	 * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
	 * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
	 */
	function _canvasRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
		if (typeof stroke == "undefined" ) {
			stroke = true;
		}
		if (typeof radius === "undefined") {
			radius = 5;
		}
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		if (stroke) {
			ctx.stroke();
		}
		if (fill) {
			ctx.fill();
		}
	}
	
	
	/**
	 * Compare two API JSON tag objects
	 */
	this.equals = function (data1, data2) {
		data1 = this.cleanData(data1);
		data2 = this.cleanData(data2);
		return data1.tag === data2.tag
			&& ((!data1.type && !data2.type) || data1.type === data2.type);
	},
	
	
	this.cleanData = function (data) {
		// Validate data
		if (data.tag === undefined) {
			throw new Error("Tag data must contain 'tag' property");
		}
		if (data.type !== undefined && data.type != 0 && data.type != 1) {
			throw new Error("Tag 'type' must be 0 or 1");
		}
		
		var cleanedData = {};
		cleanedData.tag = (data.tag + '').trim().normalize();
		if (data.type) {
			cleanedData.type = parseInt(data.type);
		}
		return cleanedData;
	}
}

