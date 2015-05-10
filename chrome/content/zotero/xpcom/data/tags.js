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
	this.MAX_COLORED_TAGS = 6;
	
	var _tagIDsByName = {};
	var _tagNamesByID = {};
	var _loaded = {};
	
	var _libraryColors = {};
	var _libraryColorsByName = {};
	var _itemsListImagePromises = {};
	var _itemsListExtraImagePromises = {};
	
	
	/**
	 * Returns a tag for a given tagID
	 *
	 * @param {Number} libraryID
	 * @param {Number} tagID
	 */
	this.getName = function (libraryID, tagID) {
		if (!tagID) {
			throw new Error("tagID not provided");
		}
		if (_tagNamesByID[tagID]) {
			return _tagNamesByID[tagID].name;
		}
		_requireLoad(libraryID);
		return false;
	}
	
	
	/**
	 * Returns the tagID matching a given tag
	 *
	 * @param {Number} libraryID
	 * @param {String} name
	 */
	this.getID = function (libraryID, name) {
		if (_tagIDsByName[libraryID] && _tagIDsByName[libraryID]['_' + name]) {
			return _tagIDsByName[libraryID]['_' + name];
		}
		_requireLoad(libraryID);
		return false;
	};
	
	
	/**
	 * Returns the tagID matching given fields, or creates a new tag and returns its id
	 *
	 * @requireTransaction
	 * @param {Number} libraryID
	 * @param {String} name - Tag data in API JSON format
	 * @param {Boolean} [create=false] - If no matching tag, create one
	 * @return {Promise<Integer>} tagID
	 */
	this.getIDFromName = Zotero.Promise.coroutine(function* (libraryID, name, create) {
		Zotero.DB.requireTransaction();
		data = this.cleanData({
			tag: name
		});
		var sql = "SELECT tagID FROM tags WHERE libraryID=? AND name=?";
		var id = yield Zotero.DB.valueQueryAsync(sql, [libraryID, data.tag]);
		if (!id && create) {
			id = yield Zotero.ID.get('tags');
			let sql = "INSERT INTO tags (tagID, libraryID, name) VALUES (?, ?, ?)";
			let insertID = yield Zotero.DB.queryAsync(sql, [id, libraryID, data.tag]);
			if (!id) {
				id = insertID;
			}
			_cacheTag(libraryID, id, data.tag);
		}
		return id;
	});
	
	
	/*
	 * Returns an array of tag types for tags matching given tag
	 */
	this.getTypes = Zotero.Promise.method(function (name, libraryID) {
		if (libraryID != parseInt(libraryID)) {
			throw new Error("libraryID must be an integer");
		}
		
		var sql = "SELECT type FROM tags WHERE libraryID=? AND name=?";
		return Zotero.DB.columnQueryAsync(sql, [libraryID, name.trim()]);
	});
	
	
	/**
	 * Get all tags indexed by tagID
	 *
	 * @param {Number} libraryID
	 * @param {Array}  [types]    Tag types to fetch
	 * @return {Promise<Array>}   A promise for an array containing tag objects in API JSON format
	 *                            [{ { tag: "foo" }, { tag: "bar", type: 1 }]
	 */
	this.getAll = Zotero.Promise.coroutine(function* (libraryID, types) {
		var sql = "SELECT DISTINCT name AS tag, type FROM tags "
			+ "JOIN itemTags USING (tagID) WHERE libraryID=?";
		var params = [libraryID];
		if (types) {
			sql += " AND type IN (" + types.join() + ")";
		}
		var rows = yield Zotero.DB.queryAsync(sql, params);
		return rows.map((row) => this.cleanData(row));
	});
	
	
	/**
	 * Get all tags within the items of a Zotero.Search object
	 *
	 * @param {Zotero.Search} search
	 * @param {Array} [types] Array of tag types to fetch
	 * @param {String|Promise<String>} [tmpTable] Temporary table with items to use
	 */
	this.getAllWithinSearch = Zotero.Promise.coroutine(function* (search, types) {
		// Save search results to temporary table, if one isn't provided
		var tmpTable = yield search.search(true);
		if (!tmpTable) {
			return {};
		}
		return this.getAllWithinSearchResults(tmpTable, types);
	});
	
	
	/**
	 * Get all tags within the items of a temporary table of search results
	 *
	 * @param {String} tmpTable  Temporary table with items to use
	 * @param {Array} [types]  Array of tag types to fetch
	 * @return {Promise<Object>}  Promise for object with tag data in API JSON format, keyed by tagID
	 */
	this.getAllWithinSearchResults = Zotero.Promise.coroutine(function* (tmpTable, types) {
		var sql = "SELECT DISTINCT name AS tag, type FROM itemTags "
			+ "JOIN tags USING (tagID) WHERE itemID IN "
			+ "(SELECT itemID FROM " + tmpTable + ") ";
		if (types) {
			sql += "AND type IN (" + types.join() + ") ";
		}
		var rows = yield Zotero.DB.queryAsync(sql);
		
		if(!tmpTable) {
			yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		}
		
		return rows.map((row) => this.cleanData(row));
	});
	
	
	/**
	 * Get the items associated with the given saved tag
	 *
	 * @param  {Number}             tagID
	 * @return {Promise<Number[]>}  A promise for an array of itemIDs
	 */
	this.getTagItems = function (tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQueryAsync(sql, tagID);
	}
	
	
	this.search = Zotero.Promise.coroutine(function* (str) {
		var sql = 'SELECT name AS tag, type FROM tags';
		if (str) {
			sql += ' WHERE name LIKE ?';
		}
		var rows = yield Zotero.DB.queryAsync(sql, str ? '%' + str + '%' : undefined);
		return rows.map((row) => this.cleanData(row));
	});
	
	
	this.load = Zotero.Promise.coroutine(function* (libraryID, reload) {
		if (_loaded[libraryID] && !reload) {
			return;
		}
		
		Zotero.debug("Loading tags in library " + libraryID);
		
		var sql = 'SELECT tagID AS id, name FROM tags WHERE libraryID=?';
		var tags = yield Zotero.DB.queryAsync(sql, libraryID);
		
		_tagIDsByName[libraryID] = {}
		
		for (var i=0; i<tags.length; i++) {
			let tag = tags[i];
			_tagIDsByName[libraryID]['_' + tag.name] = tag.id;
			_tagNamesByID[tag.id] = tag.name;
		}
		
		_loaded[libraryID] = true;
	});
	
	
	/**
	 * Rename a tag and update the tag colors setting accordingly if necessary
	 *
	 * @param {Number} tagID
	 * @param {String} newName
	 * @return {Promise}
	 */
	this.rename = Zotero.Promise.coroutine(function* (libraryID, oldName, newName) {
		Zotero.debug("Renaming tag '" + oldName + "' to '" + newName + "'", 4);
		
		oldName = oldName.trim();
		newName = newName.trim();
		
		if (oldName == newName) {
			Zotero.debug("Tag name hasn't changed", 2);
			return;
		}
		
		yield Zotero.Tags.load(libraryID);
		var oldTagID = this.getID(libraryID, oldName);
		
		// We need to know if the old tag has a color assigned so that
		// we can assign it to the new name
		var oldColorData = yield this.getColor(libraryID, oldName);
		
		yield Zotero.DB.executeTransaction(function* () {
			var oldItemIDs = yield this.getTagItems(oldTagID);
			var newTagID = yield this.getIDFromName(libraryID, newName, true);
			
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				oldItemIDs,
				Zotero.DB.MAX_BOUND_PARAMETERS - 2,
				Zotero.Promise.coroutine(function* (chunk) {
					let placeholders = chunk.map(function () '?').join(',');
					
					// This is ugly, but it's much faster than doing replaceTag() for each item
					let sql = 'UPDATE OR REPLACE itemTags SET tagID=?, type=0 '
						+ 'WHERE tagID=? AND itemID IN (' + placeholders + ')';
					yield Zotero.DB.queryAsync(sql, [newTagID, oldTagID].concat(chunk));
					
					sql = 'UPDATE items SET clientDateModified=? '
						+ 'WHERE itemID IN (' + placeholders + ')'
					yield Zotero.DB.queryAsync(sql, [Zotero.DB.transactionDateTime].concat(chunk));
					
					yield Zotero.Items.reload(oldItemIDs, ['tags'], true);
				})
			);
			
			var notifierData = {};
			notifierData[newName] = {
				old: {
					tag: oldName
				}
			};
			Zotero.Notifier.trigger(
				'modify',
				'item-tag',
				oldItemIDs.map(function (itemID) itemID + '-' + newName),
				notifierData
			);
			
			yield this.purge(libraryID, oldTagID);
		}.bind(this));
		
		if (oldColorData) {
			// Remove color from old tag
			yield this.setColor(libraryID, oldName);
			
			// Add color to new tag
			yield this.setColor(
				libraryID,
				newName,
				oldColorData.color,
				oldColorData.position
			);
		}
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.erase = Zotero.Promise.coroutine(function* (libraryID, tagIDs) {
		tagIDs = Zotero.flattenArguments(tagIDs);
		
		var deletedNames = [];
		var oldItemIDs = [];
		
		yield Zotero.DB.executeTransaction(function* () {
			yield Zotero.Tags.load(libraryID);
			
			for (let i=0; i<tagIDs.length; i++) {
				let tagID = tagIDs[i];
				let name = this.getName(libraryID, tagID);
				if (name === false) {
					continue;
				}
				deletedNames.push(name);
				oldItemIDs = oldItemIDs.concat(yield this.getTagItems(tagID));
				
				// This causes a cascading delete from itemTags
				let sql = "DELETE FROM tags WHERE tagID=?";
				yield Zotero.DB.queryAsync(sql, [tagID]);
			}
			
			yield this.purge(libraryID, tagIDs);
			
			// Update internal timestamps on all items that had these tags
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				Zotero.Utilities.arrayUnique(oldItemIDs),
				Zotero.DB.MAX_BOUND_PARAMETERS - 1,
				Zotero.Promise.coroutine(function* (chunk) {
					let placeholders = chunk.map(function () '?').join(',');
					
					sql = 'UPDATE items SET clientDateModified=? '
						+ 'WHERE itemID IN (' + placeholders + ')'
					yield Zotero.DB.queryAsync(sql, [Zotero.DB.transactionDateTime].concat(chunk));
					
					yield Zotero.Items.reload(oldItemIDs, ['tags']);
				})
			);
		}.bind(this));
		
		// Also delete tag color setting
		//
		// Note that this isn't done in purge(), so the setting will not
		// be removed if the tag is just removed from all items without
		// being explicitly deleted.
		for (let i=0; i<deletedNames.length; i++) {
			this.setColor(libraryID, deletedNames[i], false);
		}
	});
	
	
	/**
	 * Delete obsolete tags from database and clear internal cache entries
	 *
	 * @param {Number} libraryID
	 * @param {Number|Number[]} [tagIDs] - tagID or array of tagIDs to purge
	 * @return {Promise}
	 */
	this.purge = Zotero.Promise.coroutine(function* (libraryID, tagIDs) {
		if (!tagIDs && !Zotero.Prefs.get('purge.tags')) {
			return;
		}
		
		if (tagIDs) {
			tagIDs = Zotero.flattenArguments(tagIDs);
		}
		
		yield Zotero.DB.executeTransaction(function* () {
			yield Zotero.Tags.load(libraryID);
			
			// Use given tags, as long as they're orphaned
			if (tagIDs) {
				let sql = "CREATE TEMPORARY TABLE tagDelete (tagID INT PRIMARY KEY)";
				yield Zotero.DB.queryAsync(sql);
				for (let i=0; i<tagIDs.length; i++) {
					yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO tagDelete VALUES (?)", tagIDs[i]);
				}
				sql = "SELECT * FROM tagDelete WHERE tagID NOT IN (SELECT tagID FROM itemTags)";
				var toDelete = yield Zotero.DB.columnQueryAsync(sql);
			}
			// Look for orphaned tags
			else {
				var sql = "CREATE TEMPORARY TABLE tagDelete AS "
					+ "SELECT tagID FROM tags WHERE tagID "
					+ "NOT IN (SELECT tagID FROM itemTags)";
				yield Zotero.DB.queryAsync(sql);
				
				sql = "CREATE INDEX tagDelete_tagID ON tagDelete(tagID)";
				yield Zotero.DB.queryAsync(sql);
				
				sql = "SELECT * FROM tagDelete";
				var toDelete = yield Zotero.DB.columnQueryAsync(sql);
				
				if (!toDelete) {
					sql = "DROP TABLE tagDelete";
					return Zotero.DB.queryAsync(sql);
				}
			}
			
			notifierData = {};
			for (let i=0; i<toDelete.length; i++) {
				let id = toDelete[i];
				if (_tagNamesByID[id]) {
					notifierData[id] = {
						old: {
							libraryID: libraryID,
							tag: _tagNamesByID[id]
						}
					};
				}
			}
			
			_unload(libraryID, toDelete);
			
			sql = "DELETE FROM tags WHERE tagID IN (SELECT tagID FROM tagDelete);";
			yield Zotero.DB.queryAsync(sql);
			
			sql = "DROP TABLE tagDelete";
			yield Zotero.DB.queryAsync(sql);
			
			Zotero.Notifier.trigger('delete', 'tag', toDelete, notifierData);
		}.bind(this));
		
		Zotero.Prefs.set('purge.tags', false);
	});
	
	
	//
	// Tag color methods
	//
	/**
	 *
	 * @param {Integer} libraryID
	 * @param {String} name Tag name
	 * @return {Promise} A Q promise for the tag color as a hex string (e.g., '#990000')
	 */
	this.getColor = function (libraryID, name) {
		return this.getColors(libraryID)
		.then(function () {
			return _libraryColorsByName[libraryID][name]
				? _libraryColorsByName[libraryID][name] : false;
		});
	}
	
	
	/**
	 * Get color data by position (number key - 1)
	 *
	 * @param {Integer} libraryID
	 * @param {Integer} position The position of the tag, starting at 0
	 * @return {Promise} A promise for an object containing 'name' and 'color'
	 */
	this.getColorByPosition = function (libraryID, position) {
		return this.getColors(libraryID)
		.then(function () {
			return _libraryColors[libraryID][position]
				? _libraryColors[libraryID][position] : false;
		});
	}
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Promise} A promise for an object with tag names as keys and
	 *                   objects containing 'color' and 'position' as values
	 */
	this.getColors = Zotero.Promise.coroutine(function* (libraryID) {
		if (_libraryColorsByName[libraryID]) {
			return _libraryColorsByName[libraryID];
		}
		
		var tagColors = yield Zotero.SyncedSettings.get(libraryID, 'tagColors');
		
		// If the colors became available from another run
		if (_libraryColorsByName[libraryID]) {
			return _libraryColorsByName[libraryID];
		}
		
		tagColors = tagColors || [];
		
		_libraryColors[libraryID] = tagColors;
		_libraryColorsByName[libraryID] = {};
		
		// Also create object keyed by name for quick checking for individual tag colors
		for (let i=0; i<tagColors.length; i++) {
			_libraryColorsByName[libraryID][tagColors[i].name] = {
				color: tagColors[i].color,
				position: i
			};
		}
		
		return _libraryColorsByName[libraryID];
	});
	
	
	/**
	 * Assign a color to a tag
	 *
	 * @return {Promise}
	 */
	this.setColor = Zotero.Promise.coroutine(function* (libraryID, name, color, position) {
		if (!Number.isInteger(libraryID)) {
			throw new Error("libraryID must be an integer");
		}
		
		yield this.load(libraryID);
		yield this.getColors(libraryID);
		
		var tagColors = _libraryColors[libraryID];
		
		// Unset
		if (!color) {
			// Trying to clear color on tag that doesn't have one
			if (!_libraryColorsByName[libraryID][name]) {
				return;
			}
			
			tagColors = tagColors.filter(function (val) val.name != name);
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
			return Zotero.SyncedSettings.set(libraryID, 'tagColors');
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
			let tagColors = yield Zotero.SyncedSettings.get(libraryID, 'tagColors');
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
			var tagNames = tagColors.concat(previousTagColors).map(function (val) val.name);
			tagNames = Zotero.Utilities.arrayUnique(tagNames);
			for (let i=0; i<tagNames.length; i++) {
				let tagID = this.getID(libraryID, tagNames[i]);
				affectedItems = affectedItems.concat(yield this.getTagItems(tagID));
			};
			
			if (affectedItems.length) {
				Zotero.Notifier.trigger('redraw', 'item', affectedItems, { column: 'title' });
			}
		}
	});
	
	
	this.toggleItemsListTags = Zotero.Promise.coroutine(function* (libraryID, items, tagName) {
		if (!items.length) {
			return;
		}
		
		yield this.load(libraryID);
		var tagID = this.getID(libraryID, tagName);
		
		// If there's a color setting but no matching tag, don't throw
		// an error (though ideally this wouldn't be possible).
		if (!tagID) {
			return;
		}
		
		return Zotero.DB.executeTransaction(function* () {
			// Base our action on the first item. If it has the tag,
			// remove the tag from all items. If it doesn't, add it to all.
			var firstItem = items[0];
			// Remove from all items
			if (firstItem.hasTag(tagName)) {
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
	});
	
	
	/**
	 * A tree cell can show only one image, and (as of Fx19) it can't be an SVG,
	 * so we need to generate a composite image containing the existing item type
	 * icon and one or more tag color swatches.
	 *
	 * @params {Array} colors Array of swatch colors
	 * @params {String} extraImage Chrome URL of image to add to final image
	 * @return {Q Promise} A Q promise for a data: URL for a PNG
	 */
	this.generateItemsListImage = function (colors, extraImage) {
		var multiplier = (extraImage && extraImage.indexOf('2x') != -1) ? 2 : 1;
		
		var swatchWidth = 8 * multiplier;
		var separator = 3 * multiplier;
		var extraImageSeparator = 1 * multiplier;
		var extraImageWidth = 16 * multiplier;
		var canvasHeight = 16 * multiplier;
		var swatchHeight = 8 * multiplier;
		var prependExtraImage = true;
		
		var hash = colors.join("") + (extraImage ? extraImage : "");
		
		if (_itemsListImagePromises[hash]) {
			return _itemsListImagePromises[hash];
		}
		
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			.getService(Components.interfaces.nsIAppShellService)
			.hiddenDOMWindow;
		var doc = win.document;
		var canvas = doc.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		
		var width = colors.length * (swatchWidth + separator);
		if (extraImage) {
			width += (colors.length ? extraImageSeparator : 0) + extraImageWidth;
		}
		else if (colors.length) {
			width -= separator;
		}
		canvas.width = width;
		canvas.height = canvasHeight;
		var swatchTop = Math.floor((canvasHeight - swatchHeight) / 2);
		var ctx = canvas.getContext('2d');
		
		var x = prependExtraImage ? extraImageWidth + separator + extraImageSeparator : 0;
		for (let i=0, len=colors.length; i<len; i++) {
			ctx.fillStyle = colors[i];
			_canvasRoundRect(ctx, x, swatchTop + 1, swatchWidth, swatchHeight, 2, true, false)
			x += swatchWidth + separator;
		}
		
		// If there's no extra iamge, resolve a promise now
		if (!extraImage) {
			var dataURI = canvas.toDataURL("image/png");
			var dataURIPromise = Zotero.Promise.resolve(dataURI);
			_itemsListImagePromises[hash] = dataURIPromise;
			return dataURIPromise;
		}
		
		// Add an extra image to the beginning or end of the swatches
		if (prependExtraImage) {
			x = 0;
		}
		else {
			x += extraImageSeparator;
		}
		
		// If extra image hasn't started loading, start now
		if (typeof _itemsListExtraImagePromises[extraImage] == 'undefined') {
			let ios = Components.classes['@mozilla.org/network/io-service;1']
				.getService(Components.interfaces["nsIIOService"]);
			let uri = ios.newURI(extraImage, null, null);
			uri = Components.classes['@mozilla.org/chrome/chrome-registry;1']
				.getService(Components.interfaces["nsIChromeRegistry"])
				.convertChromeURL(uri);
			
			var img = new win.Image();
			img.src = uri.spec;
			
			// Mark that we've started loading
			var deferred = Zotero.Promise.defer();
			var extraImageDeferred = Zotero.Promise.defer();
			_itemsListExtraImagePromises[extraImage] = extraImageDeferred.promise;
			
			// When extra image has loaded, draw it
			img.onload = function () {
				ctx.drawImage(img, x, 0);
				
				var dataURI = canvas.toDataURL("image/png");
				var dataURIPromise = Zotero.Promise.resolve(dataURI);
				_itemsListImagePromises[hash] = dataURIPromise;
				
				// Fulfill the promise for this call
				deferred.resolve(dataURI);
				
				// And resolve the extra image's promise to fulfill
				// other promises waiting on it
				extraImageDeferred.resolve(img);
			}
			
			return deferred.promise;
		}
		
		// If extra image has already started loading, return a promise
		// for the composite image once it's ready
		return _itemsListExtraImagePromises[extraImage]
		.then(function (img) {
			ctx.drawImage(img, x, 0);
			
			var dataURI = canvas.toDataURL("image/png");
			var dataURIPromise = Zotero.Promise.resolve(dataURI);
			_itemsListImagePromises[hash] = dataURIPromise;
			return dataURIPromise;
		});
	}
	
	
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
	
	
	/**
	 * Clear cache to reload
	 */
	this.reload = function () {
		_tagNamesByID = {};
		_tagIDsByName = {};
	}
	
	
	this.getPrimaryDataSQL = function () {
		// This should be the same as the query in Zotero.Tag.load(),
		// just without a specific tagID
		return "SELECT * FROM tags O WHERE 1";
	}
	
	
	function _requireLoad(libraryID) {
		if (!_loaded[libraryID]) {
			throw new Zotero.Exception.UnloadedDataException(
				"Tag data has not been loaded for library " + libraryID,
				"tags"
			);
		}
	}
	
	
	function _cacheTag(libraryID, tagID, name) {
		_tagNamesByID[tagID] = name;
		if (!_tagIDsByName[libraryID]) {
			_tagIDsByName[libraryID] = {};
		}
		_tagIDsByName[libraryID]['_' + name] = tagID;
	}
	
	/**
	 * Unload tags from caches
	 *
	 * @param {Number} libraryID
	 * @param {Number|Array<Number>} ids One or more tagIDs
	 */
	function _unload(libraryID, ids) {
		var ids = Zotero.flattenArguments(ids);
		
		for (let i=0; i<ids.length; i++) {
			let id = ids[i];
			let tagName = _tagNamesByID[id];
			delete _tagNamesByID[id];
			if (tagName && _tagIDsByName[libraryID]) {
				delete _tagIDsByName[libraryID]['_' + tagName];
			}
		}
	}
}

