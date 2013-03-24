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
	Zotero.DataObjects.apply(this, ['tag']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	this.MAX_COLORED_TAGS = 6;
	
	var _tags = {}; // indexed by tag text
	
	var _libraryColors = [];
	var _libraryColorsByName = {};
	var _itemsListImagePromises = {};
	var _itemsListExtraImagePromises = {};
	
	this.get = get;
	this.getName = getName;
	this.getID = getID;
	this.getIDs = getIDs;
	this.getTypes = getTypes;
	this.getAll = getAll;
	this.getAllWithinSearch = getAllWithinSearch;
	this.getTagItems = getTagItems;
	this.search = search;
	this.rename = rename;
	this.erase = erase;
	this.purge = purge;
	
	
	/*
	 * Returns a tag and type for a given tagID
	 */
	function get(id, skipCheck) {
		if (this._reloadCache) {
			this.reloadAll();
		}
		return this._objectCache[id] ? this._objectCache[id] : false;
	}
	
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID) {
		if (this._objectCache[tagID]) {
			return this._objectCache[tagID].name;
		}
		
		// Populate cache
		var tag = this.get(tagID);
		
		return this._objectCache[tagID] ? this._objectCache[tagID].name : false;
	}
	
	
	/*
	 * Returns the tagID matching given tag and type
	 */
	function getID(name, type, libraryID) {
		name = Zotero.Utilities.trim(name);
		var lcname = name.toLowerCase();
		
		if (!libraryID) {
			libraryID = 0;
		}
		
		if (_tags[libraryID] && _tags[libraryID][type] && _tags[libraryID][type]['_' + lcname]) {
			return _tags[libraryID][type]['_' + lcname];
		}
		
		// FIXME: COLLATE NOCASE doesn't work for Unicode characters, so this
		// won't find Äbc if "äbc" is entered and will allow a duplicate tag
		// to be created
		var sql = "SELECT tagID FROM tags WHERE name=? AND type=? AND libraryID";
		var params = [name, type];
		if (libraryID) {
			sql += "=?";
			params.push(libraryID);
		}
		else {
			sql += " IS NULL";
		}
		var tagID = Zotero.DB.valueQuery(sql, params);
		if (tagID) {
			if (!_tags[libraryID]) {
				_tags[libraryID] = {};
			}
			if (!_tags[libraryID][type]) {
				_tags[libraryID][type] = [];
			}
			_tags[libraryID][type]['_' + lcname] = tagID;
		}
		
		return tagID;
	}
	
	
	/*
	 * Returns all tagIDs for this tag (of all types)
	 */
	function getIDs(name, libraryID) {
		name = Zotero.Utilities.trim(name);
		var sql = "SELECT tagID FROM tags WHERE name=? AND libraryID";
		var params = [name];
		if (libraryID) {
			sql += "=?";
			params.push(libraryID);
		}
		else {
			sql += " IS NULL";
		}
		return Zotero.DB.columnQuery(sql, params);
	}
	
	
	/*
	 * Returns an array of tag types for tags matching given tag
	 */
	function getTypes(name, libraryID) {
		name = Zotero.Utilities.trim(name);
		var sql = "SELECT type FROM tags WHERE name=? AND libraryID";
		var params = [name];
		if (libraryID) {
			sql += "=?";
			params.push(libraryID);
		}
		else {
			sql += " IS NULL";
		}
		return Zotero.DB.columnQuery(sql, params);
	}
	
	
	/**
	 * Get all tags indexed by tagID
	 *
	 * _types_ is an optional array of tag types to fetch
	 */
	function getAll(types, libraryID) {
		var sql = "SELECT tagID, name FROM tags WHERE libraryID";
		var params = [];
		if (libraryID) {
			sql += "=?";
			params.push(libraryID);
		}
		else {
			sql += " IS NULL";
		}
		if (types) {
			sql += " AND type IN (" + types.join() + ")";
		}
		if (params.length) {
			var tags = Zotero.DB.query(sql, params);
		}
		else {
			var tags = Zotero.DB.query(sql);
		}
		if (!tags) {
			return {};
		}
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tag = this.get(tags[i].tagID, true);
			indexed[tags[i].tagID] = tag;
		}
		return indexed;
	}
	
	
	/*
	 * Get all tags within the items of a Zotero.Search object
	 *
	 * _types_ is an optional array of tag types to fetch
	 */
	function getAllWithinSearch(search, types, tmpTable) {
		// Save search results to temporary table
		if(!tmpTable) {
			try {
				var tmpTable = search.search(true);
			}
			catch (e) {
				if (typeof e == 'string'
						&& e.match(/Saved search [0-9]+ does not exist/)) {
					Zotero.DB.rollbackTransaction();
					Zotero.debug(e, 2);
				}
				else {
					throw (e);
				}
			}
			if (!tmpTable) {
				return {};
			}
		}
		
		var sql = "SELECT DISTINCT tagID, name, type FROM itemTags "
			+ "NATURAL JOIN tags WHERE itemID IN "
			+ "(SELECT itemID FROM " + tmpTable + ") ";
		if (types) {
			sql += "AND type IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		
		if(!tmpTable) {
			Zotero.DB.query("DROP TABLE " + tmpTable);
		}
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tagID = tags[i].tagID;
			indexed[tagID] = this.get(tagID, true);
		}
		return indexed;
	}
	
	
	/**
	 * Get the items associated with the given saved tag
	 *
	 * @param	{Integer}	tagID
	 * @return	{Integer[]|FALSE}
	 */
	function getTagItems(tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQuery(sql, tagID) || [];
	}
	
	
	function search(str) {
		var sql = 'SELECT tagID, name, type FROM tags';
		if (str) {
			sql += ' WHERE name LIKE ?';
		}
		var tags = Zotero.DB.query(sql, str ? '%' + str + '%' : undefined);
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tag = this.get(tags[i].tagID, true);
			indexed[tags[i].tagID] = tag;
		}
		return indexed;
	}
	
	
	/**
	 * Rename a tag and update the tag colors setting accordingly if necessary
	 *
	 * @return {Promise}
	 */
	function rename(tagID, newName) {
		var tagObj, libraryID, oldName, oldType, notifierData, self = this;
		return Q.fcall(function () {
			Zotero.debug('Renaming tag', 4);
			
			newName = newName.trim();
			
			tagObj = self.get(tagID);
			libraryID = tagObj.libraryID;
			oldName = tagObj.name;
			oldType = tagObj.type;
			notifierData = {};
			notifierData[tagID] = { old: tagObj.serialize() };
			
			if (oldName == newName) {
				Zotero.debug("Tag name hasn't changed", 2);
				return;
			}
			
			// We need to know if the old tag has a color assigned so that
			// we can assign it to the new name
			return self.getColor(libraryID ? parseInt(libraryID) : 0, oldName);
		})
		.then(function (oldColorData) {
			Zotero.DB.beginTransaction();
			
			var sql = "SELECT tagID, name FROM tags WHERE name=? AND type=0 AND libraryID=?";
			var row = Zotero.DB.rowQuery(sql, [newName, libraryID]);
			if (row) {
				var existingTagID = row.tagID;
				var existingName = row.name;
			}
			
			// New tag already exists as manual tag
			if (existingTagID
					// Tag check is case-insensitive, so make sure we have a different tag
					&& existingTagID != tagID) {
				
				var changed = false;
				var itemsAdded = false;
				
				// Change case of existing manual tag before switching automatic
				if (oldName.toLowerCase() == newName.toLowerCase() || existingName != newName) {
					var sql = "UPDATE tags SET name=? WHERE tagID=?";
					Zotero.DB.query(sql, [newName, existingTagID]);
					changed = true;
				}
				
				var itemIDs = self.getTagItems(tagID);
				var existingItemIDs = self.getTagItems(existingTagID);
				
				// Would be easier to just call removeTag(tagID) and addTag(existingID)
				// here, but this is considerably more efficient
				var sql = "UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID=?";
				Zotero.DB.query(sql, [existingTagID, tagID]);
				
				// Manual purge of old tag
				sql = "DELETE FROM tags WHERE tagID=?";
				Zotero.DB.query(sql, tagID);
				if (_tags[libraryID] && _tags[libraryID][oldType]) {
					delete _tags[libraryID][oldType]['_' + oldName];
				}
				delete self._objectCache[tagID];
				Zotero.Notifier.trigger('delete', 'tag', tagID, notifierData);
				
				// Simulate tag removal on items that used old tag
				var itemTags = [];
				for (var i in itemIDs) {
					itemTags.push(itemIDs[i] + '-' + tagID);
				}
				Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
				
				// And send tag add for new tag (except for those that already had it)
				var itemTags = [];
				for (var i in itemIDs) {
					if (existingItemIDs.indexOf(itemIDs[i]) == -1) {
						itemTags.push(itemIDs[i] + '-' + existingTagID);
						itemsAdded = true;
					}
				}
				
				if (changed) {
					if (itemsAdded) {
						Zotero.Notifier.trigger('add', 'item-tag', itemTags);
					}
					
					// Mark existing tag as updated
					sql = "UPDATE tags SET dateModified=CURRENT_TIMESTAMP, "
							+ "clientDateModified=CURRENT_TIMESTAMP WHERE tagID=?";
					Zotero.DB.query(sql, existingTagID);
					Zotero.Notifier.trigger('modify', 'tag', existingTagID);
					Zotero.Tags.reload(existingTagID);
				}
				
				// TODO: notify linked items?
				//Zotero.Notifier.trigger('modify', 'item', itemIDs);
			}
			else {
				tagObj.name = newName;
				// Set all renamed tags to manual
				tagObj.type = 0;
				tagObj.save();
			}
			
			Zotero.DB.commitTransaction();
			
			if (oldColorData) {
				var libraryIDInt = libraryID ? parseInt(libraryID) : 0
				
				// Remove color from old tag
				return self.setColor(libraryIDInt, oldName)
				// Add color to new tag
				.then(function () {
					return self.setColor(
						libraryIDInt,
						newName,
						oldColorData.color,
						oldColorData.position
					);
				});
			}
		});
	}
	
	
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
	 * @return {Promise} A Q promise for an object containing 'name' and 'color'
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
	 * @return {Promise} A Q promise for an object with tag names as keys and
	 *                   objects containing 'color' and 'position' as values
	 */
	this.getColors = function (libraryID) {
		var self = this;
		return Q.fcall(function () {
			if (_libraryColorsByName[libraryID]) {
				return _libraryColorsByName[libraryID];
			}
			
			return Zotero.SyncedSettings.get(libraryID, 'tagColors')
			.then(function (tagColors) {
				// If the colors became available from another run
				if (_libraryColorsByName[libraryID]) {
					return _libraryColorsByName[libraryID];
				}
				
				tagColors = tagColors || [];
				
				_libraryColors[libraryID] = tagColors;
				_libraryColorsByName[libraryID] = {};
				
				// Also create object keyed by name for quick checking for individual tag colors
				for (var i=0; i<tagColors.length; i++) {
					_libraryColorsByName[libraryID][tagColors[i].name] = {
						color: tagColors[i].color,
						position: i
					};
				}
				
				return _libraryColorsByName[libraryID];
			});
		});
	}
	
	
	/**
	 * Assign a color to a tag
	 *
	 * @return {Promise}
	 */
	this.setColor = function (libraryID, name, color, position) {
		if (libraryID === null) {
			throw new Error("libraryID must be an integer");
		}
		
		var self = this;
		return this.getColors(libraryID)
		.then(function () {
			var tagColors = _libraryColors[libraryID];
			var tagIDs = self.getIDs(name, libraryID);
			
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
				for (var i=0; i<tagColors.length; i++) {
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
	};
	
	
	/**
	 * Update caches and trigger redrawing of items in the items list
	 * when a 'tagColors' setting is modified
	 */
	this.notify = function (event, type, ids, extraData) {
		if (type != 'setting') {
			return;
		}
		
		var self = this;
		
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
			Zotero.SyncedSettings.get(libraryID, 'tagColors')
			.then(function (tagColors) {
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
					let tagIDs = self.getIDs(tagNames[i], libraryID) || [];
					for (let i=0; i<tagIDs.length; i++) {
						affectedItems = affectedItems.concat(self.getTagItems(tagIDs[i]));
					}
				};
				
				if (affectedItems.length) {
					Zotero.Notifier.trigger('redraw', 'item', affectedItems, { column: 'title' });
				}
			})
			.done();
		}
	};
	
	
	this.toggleItemsListTags = function (libraryID, items, name) {
		var self = this;
		return Q.fcall(function () {
			var tagIDs = self.getIDs(name, libraryID) || [];
			// If there's a color setting but no matching tag, don't throw
			// an error (though ideally this wouldn't be possible).
			if (!tagIDs.length) {
				return;
			}
			var tags = tagIDs.map(function (tagID) {
				return Zotero.Tags.get(tagID, true);
			});
			
			if (!items.length) {
				return;
			}
			
			Zotero.DB.beginTransaction();
			
			// Base our action on the first item. If it has the tag,
			// remove the tag from all items. If it doesn't, add it to all.
			var firstItem = items[0];
			// Remove from all items
			if (firstItem.hasTags(tagIDs)) {
				for (var i=0; i<items.length; i++) {
					for (var j=0; j<tags.length; j++) {
						tags[j].removeItem(items[i].id);
					}
				}
				tags.forEach(function (tag) tag.save());
				Zotero.Prefs.set('purge.tags', true);
			}
			// Add to all items
			else {
				for (var i=0; i<items.length; i++) {
					items[i].addTag(name);
				}
			}
			
			Zotero.DB.commitTransaction();
		});
	};
	
	
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
		var swatchWidth = 8;
		var separator = 3;
		var extraImageSeparator = 1;
		var extraImageWidth = 16;
		var canvasHeight = 16;
		var swatchHeight = 8;
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
			var dataURIPromise = Q(dataURI);
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
			var deferred = Q.defer();
			var extraImageDeferred = Q.defer();
			_itemsListExtraImagePromises[extraImage] = extraImageDeferred.promise;
			
			// When extra image has loaded, draw it
			img.onload = function () {
				ctx.drawImage(img, x, 0);
				
				var dataURI = canvas.toDataURL("image/png");
				var dataURIPromise = Q(dataURI);
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
			var dataURIPromise = Q(dataURI);
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
	
	
	/**
	 * @return {Promise}
	 */
	function erase(ids) {
		ids = Zotero.flattenArguments(ids);
		
		var deleted = [];
		
		Zotero.DB.beginTransaction();
		for each(var id in ids) {
			var tag = this.get(id);
			if (tag) {
				deleted.push({
					libraryID: tag.libraryID ? parseInt(tag.libraryID) : 0,
					name: tag.name
				});
				tag.erase();
			}
		}
		Zotero.DB.commitTransaction();
		
		// Also delete tag color setting
		//
		// Note that this isn't done in purge(), so the setting will not
		// be removed if the tag is just removed from all items without
		// without being explicitly deleted.
		for (var i in deleted) {
			this.setColor(deleted[i].libraryID, deleted[i].name, false);
		}
	}
	
	
	/**
	 * Delete obsolete tags from database and clear internal array entries
	 *
	 * @param	[Integer[]|Integer]		[tagIDs]	tagID or array of tagIDs to purge
	 */
	function purge(tagIDs) {
		if (!tagIDs && !Zotero.Prefs.get('purge.tags')) {
			return;
		}
		
		if (tagIDs) {
			tagIDs = Zotero.flattenArguments(tagIDs);
		}
		
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			
			// Use given tags
			if (tagIDs) {
				var sql = "CREATE TEMPORARY TABLE tagDelete (tagID INT PRIMARY KEY)";
				Zotero.DB.query(sql);
				for each(var id in tagIDs) {
					Zotero.DB.query("INSERT OR IGNORE INTO tagDelete VALUES (?)", id);
				}
				// Remove duplicates
				var toDelete = Zotero.DB.columnQuery("SELECT * FROM tagDelete");
			}
			// Look for orphaned tags
			else {
				var sql = "CREATE TEMPORARY TABLE tagDelete AS "
					+ "SELECT tagID FROM tags WHERE tagID "
					+ "NOT IN (SELECT tagID FROM itemTags)";
				Zotero.DB.query(sql);
				
				sql = "CREATE INDEX tagDelete_tagID ON tagDelete(tagID)";
				Zotero.DB.query(sql);
				
				sql = "SELECT * FROM tagDelete";
				var toDelete = Zotero.DB.columnQuery(sql);
				
				if (!toDelete) {
					sql = "DROP TABLE tagDelete";
					Zotero.DB.query(sql);
					Zotero.DB.commitTransaction();
					Zotero.Prefs.set('purge.tags', false);
					return;
				}
			}
			
			var notifierData = {};
			
			for each(var tagID in toDelete) {
				var tag = Zotero.Tags.get(tagID);
				if (tag) {
					notifierData[tagID] = { old: tag.serialize() }
				}
			}
			
			this.unload(toDelete);
			
			sql = "DELETE FROM tags WHERE tagID IN "
				+ "(SELECT tagID FROM tagDelete);";
			Zotero.DB.query(sql);
			
			sql = "DROP TABLE tagDelete";
			Zotero.DB.query(sql);
			
			Zotero.DB.commitTransaction();
			
			Zotero.Notifier.trigger('delete', 'tag', toDelete, notifierData);
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		Zotero.Prefs.set('purge.tags', false);
	}
	
	
	/**
	 * Internal reload hook to clear cache
	 */
	this._reload = function (ids) {
		_tags = {};
	}
	
	
	/**
	 * Unload tags from caches
	 *
	 * @param	int|array	ids	 	One or more tagIDs
	 */
	this.unload = function () {
		var ids = Zotero.flattenArguments(arguments);
		
		for each(var id in ids) {
			var tag = this._objectCache[id];
			delete this._objectCache[id];
			var libraryID = tag.libraryID ? tag.libraryID : 0;
			if (tag && _tags[libraryID] && _tags[libraryID][tag.type]) {
				delete _tags[libraryID][tag.type]['_' + tag.name];
			}
		}
	}
	
	
	this._load = function () {
		if (!arguments[0]) {
			if (!this._reloadCache) {
				return;
			}
			_tags = {};
			this._reloadCache = false;
		}
		
		// This should be the same as the query in Zotero.Tag.load(),
		// just without a specific tagID
		var sql = "SELECT * FROM tags WHERE 1";
		if (arguments[0]) {
			sql += " AND tagID IN (" + Zotero.join(arguments[0], ",") + ")";
		}
		var rows = Zotero.DB.query(sql);
		
		var ids = [];
		for each(var row in rows) {
			var id = row.tagID;
			ids.push(id);
			
			// Tag doesn't exist -- create new object and stuff in array
			if (!this._objectCache[id]) {
				//this.get(id);
				this._objectCache[id] = new Zotero.Tag;
				this._objectCache[id].loadFromRow(row);
			}
			// Existing tag -- reload in place
			else {
				this._objectCache[id].loadFromRow(row);
			}
		}
		
		if (!arguments[0]) {
			// If loading all tags, remove old tags that no longer exist
			for each(var c in this._objectCache) {
				if (ids.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
		}
	}
}

