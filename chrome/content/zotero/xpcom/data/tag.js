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


Zotero.Tag = function () {
	if (arguments[0]) {
		throw ("Zotero.Tag constructor doesn't take any parameters");
	}
	
	this._init();
}

Zotero.Tag.prototype._init = function () {
	// Public members for access by public methods -- do not access directly
	this._id = null;
	this._libraryID = null
	this._key = null;
	this._name = null;
	this._type = null;
	this._dateAdded = null;
	this._dateModified = null;
	
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
	
	this._linkedItemsLoaded = false;
	this._linkedItems = {};
	this._linkedItemIDsToAdd = [];
	this._linkedItemIDsToRemove = [];
}


Zotero.Tag.prototype.__defineGetter__('objectType', function () { return 'tag'; });
Zotero.Tag.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Tag.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Tag.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Tag.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Tag.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Tag.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Tag.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Tag.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Tag.prototype.__defineGetter__('type', function () { return this._get('type'); });
Zotero.Tag.prototype.__defineSetter__('type', function (val) { this._set('type', val); });
Zotero.Tag.prototype.__defineGetter__('dateAdded', function () { return this._get('dateAdded'); });
Zotero.Tag.prototype.__defineSetter__('dateAdded', function (val) { this._set('dateAdded', val); });
Zotero.Tag.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Tag.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });
Zotero.Tag.prototype.__defineGetter__('key', function () { return this._get('key'); });

Zotero.Tag.prototype.__defineSetter__('linkedItems', function (arr) { this._setLinkedItems(arr); });


Zotero.Tag.prototype._get = function (field) {
	if ((this._id || this._key) && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Tag.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
		case 'key':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Tag._set()");
			}
			//this._checkValue(field, val);
			this['_' + field] = val;
			return;
		
		case 'name':
			val = Zotero.Utilities.trim(val);
			break;
	}
	
	if (this.id || this.key) {
		if (!this._loaded) {
			this.load();
		}
	}
	else {
		this._loaded = true;
	}
	
	if (this['_' + field] != val) {
		this._prepFieldChange(field);
		
		switch (field) {
			default:
				this['_' + field] = val;
		}
	}
}


/**
 * Check if tag exists in the database
 *
 * @return	bool			TRUE if the tag exists, FALSE if not
 */
Zotero.Tag.prototype.exists = function() {
	if (!this.id) {
		throw ('tagID not set in Zotero.Tag.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM tags WHERE tagID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


/*
 * Build tag from database
 */
Zotero.Tag.prototype.load = function() {
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	var desc = id ? id : libraryID + "/" + key;
	
	Zotero.debug("Loading data for tag " + desc + " in Zotero.Tag.load()");
	
	if (!id && !key) {
		throw ("ID or key not set in Zotero.Tag.load()");
	}
	
	var sql = "SELECT * FROM tags WHERE ";
	if (id) {
		sql += "tagID=?";
		var params = id;
	}
	else {
		sql += "key=?";
		var params = [key];
		if (libraryID) {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		else {
			sql += " AND libraryID IS NULL";
		}
	}
	var row = Zotero.DB.rowQuery(sql, params);
	
	if (!row) {
		return;
	}
	
	this.loadFromRow(row);
	return true;
}


Zotero.Tag.prototype.loadFromRow = function (row) {
	this._init();
	for (var col in row) {
		//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for tag " + this.id);
		switch (col) {
			case 'clientDateModified':
				continue;
			
			case 'tagID':
				this._id = row[col];
				continue;
			
			case 'libraryID':
				this['_' + col] = row[col] ? row[col] : null;
				continue;
		}
		this['_' + col] = (!row[col] && row[col] !== 0) ? '' : row[col];
	}
	this._loaded = true;
}



/**
 * Returns items linked to this tag
 *
 * @param	{Boolean}	asIDs	Return as itemIDs
 * @return	{Array}				Array of Zotero.Item instances or itemIDs,
 *									or FALSE if none
 */
Zotero.Tag.prototype.getLinkedItems = function (asIDs) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (Zotero.Utilities.isEmpty(this._linkedItems)) {
		return [];
	}
	
	// Return itemIDs
	if (asIDs) {
		return Object.keys(this._linkedItems);
	}
	
	// Return Zotero.Item objects
	return [item for each(item in this._linkedItems)];
}


Zotero.Tag.prototype.countLinkedItems = function () {
	return Object.keys(this._linkedItems).length;
}


Zotero.Tag.prototype.addItem = function (itemID) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (this._linkedItems[itemID]) {
		Zotero.debug("Item " + itemID + " already has tag "
			+ this.id + " in Zotero.Tag.addItem()");
		return false;
	}
	
	var item = Zotero.Items.get(itemID);
	if (!item) {
		throw new Error("Can't link invalid item " + itemID + " to tag " + this.id);
	}
	this._prepFieldChange('linkedItems');
	this._linkedItems[itemID] = item;
	this._linkedItemIDsToAdd.push(itemID);
	this._linkedItemIDsToRemove = this._linkedItemIDsToRemove.filter(function (x) x != itemID);
	return true;
}


Zotero.Tag.prototype.removeItem = function (itemID) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (!this._linkedItems[itemID]) {
		Zotero.debug("Item " + itemID + " doesn't have tag "
			+ this.id + " in Zotero.Tag.removeItem()");
		return false;
	}
	
	this._prepFieldChange('linkedItems');
	delete this._linkedItems[itemID];
	this._linkedItemIDsToAdd = this._linkedItemIDsToAdd.filter(function (x) x != itemID);
	this._linkedItemIDsToRemove.push(itemID);
	return true;
}


Zotero.Tag.prototype.save = function (full) {
	Zotero.Tags.editCheck(this);
	
	// Default to manual tag
	if (!this.type) {
		this.type = 0;
	}
	
	if (this.type != 0 && this.type != 1) {
		Zotero.debug(this);
		throw ('Invalid tag type ' + this.type + ' for tag ' + this.id + ' in Zotero.Tag.save()');
	}
	
	if (!this.name) {
		throw ('Tag ' + this.id + ' name is empty in Zotero.Tag.save()');
	}
	
	if (!this._changed) {
		Zotero.debug("Tag " + this.id + " has not changed");
		return false;
	}
	
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var tagID = this.id ? this.id : Zotero.ID.get('tags');
		
		Zotero.debug("Saving tag " + this.id);
		
		var key = this.key ? this.key : this._generateKey();
		
		var columns = [
			'tagID',
			'name',
			'type',
			'dateAdded',
			'dateModified',
			'clientDateModified',
			'libraryID',
			'key'
		];
		var placeholders = ['?', '?', '?', '?', '?', '?', '?', '?'];
		var sqlValues = [
			tagID ? { int: tagID } : null,
			{ string: this.name },
			{ int: this.type },
			// If date added isn't set, use current timestamp
			this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			Zotero.DB.transactionDateTime,
			this.libraryID ? this.libraryID : null,
			key
		];
		
		try {
			if (isNew) {
				var sql = "INSERT INTO tags (" + columns.join(', ') + ") VALUES ("
					+ placeholders.join(', ') + ")";
				var insertID = Zotero.DB.query(sql, sqlValues);
				if (!tagID) {
					tagID = insertID;
				}
			}
			else {
				// Remove tagID from beginning
				columns.shift();
				sqlValues.shift();
				sqlValues.push(tagID);
				
				var sql = "UPDATE tags SET " + columns.join("=?, ") + "=?"
					+ " WHERE tagID=?";
				Zotero.DB.query(sql, sqlValues);
			}
		}
		catch (e) {
			// If an incoming tag is the same as an existing tag, but with a different key,
			// then delete the old tag and add its linked items to the new tag
			if (typeof e == 'string' &&
					(e.indexOf('columns libraryID, name, type are not unique') != -1
						|| e.indexOf('NS_ERROR_STORAGE_CONSTRAINT') != -1)) {
				Zotero.debug("Tag matches existing tag with different key -- delete old tag and merging items");
				
				// GET existing tag
				var existing = Zotero.Tags.getIDs(this.name, this.libraryID);
				if (!existing) {
					throw new Error("Existing tag not found");
				}
				for each(var id in existing) {
					var tag = Zotero.Tags.get(id, true);
					if (tag.type == this.type) {
						var linked = tag.getLinkedItems(true);
						Zotero.Tags.erase(id);
						Zotero.Tags.purge(id);
						break;
					}
				}
				
				// Save again
				if (isNew) {
					var sql = "INSERT INTO tags (" + columns.join(', ') + ") VALUES ("
						+ placeholders.join(', ') + ")";
					var insertID = Zotero.DB.query(sql, sqlValues);
					if (!tagID) {
						tagID = insertID;
					}
				}
				else {
					var sql = "UPDATE tags SET " + columns.join("=?, ") + "=?"
						+ " WHERE tagID=?";
					Zotero.DB.query(sql, sqlValues);
				}
				
				// TEMP: until getLinkedItems() returns only arrays
				linked = linked ? linked : [];
				var linked2 = this.getLinkedItems(true);
				linked2 = linked2 ? linked2 : [];
				linked = linked.concat(linked2);
				
				this.linkedItems = Zotero.Utilities.arrayUnique(linked);
			}
			else {
				throw (e);
			}
		}
		
		// Linked items
		if (full || this._changed.linkedItems) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getLinkedItems(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			// Use the database for comparison instead of relying on the cache
			// This is necessary for a syncing edge case (described in sync.js).
			if (full) {
				var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
				var dbItemIDs = Zotero.DB.columnQuery(sql, tagID);
				if (dbItemIDs) {
					removed = Zotero.Utilities.arrayDiff(dbItemIDs, currentIDs);
					newids = Zotero.Utilities.arrayDiff(currentIDs, dbItemIDs);
				}
				else {
					newids = currentIDs;
				}
			}
			else {
				removed = this._linkedItemIDsToRemove;
				newids = this._linkedItemIDsToAdd;
			}
			
			if (removed.length) {
				var done = 0;
				var maxItems = 998; // stay below compiled limit
				var numItems = removed.length;
				
				var pairs = [];
				for each(var itemID in removed) {
					pairs.push(itemID + "-" + tagID);
				}
				
				let tempRemoved = removed.concat();
				
				do {
					var chunk = tempRemoved.splice(0, maxItems);
					
					var sql = "DELETE FROM itemTags WHERE tagID=? "
						+ "AND itemID IN (" + chunk.map(function () '?').join() + ")";
					Zotero.DB.query(sql, [tagID].concat(chunk));
					
					done += chunk.length;
				}
				while (done < numItems);
				
				Zotero.Notifier.trigger('remove', 'item-tag', pairs);
			}
			
			if (newids.length) {
				var sql = "INSERT OR IGNORE INTO itemTags (itemID, tagID) VALUES (?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				var pairs = [];
				for each(var itemID in newids) {
					insertStatement.bindInt32Parameter(0, itemID);
					insertStatement.bindInt32Parameter(1, tagID);
					
					try {
						insertStatement.execute();
					}
					catch (e) {
						Zotero.debug("itemID: " + itemID);
						Zotero.debug("tagID: " + tagID);
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}
					
					pairs.push(itemID + "-" + tagID);
				}
				
				Zotero.Notifier.trigger('add', 'item-tag', pairs);
			}
			
			// TODO: notify linked items of name changes?
			Zotero.Notifier.trigger('modify', 'item', removed.concat(newids));
		}
		
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	// If successful, set values in object
	if (!this.id) {
		this._id = tagID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'tag', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'tag', this.id, this._previousData);
	}
	
	this._reset();
	Zotero.Tags.reload(this.id);
	
	return this.id;
}


/**
 * Compares this tag to another
 *
 * Returns a two-element array containing two objects with the differing values,
 * or FALSE if no differences
 *
 * @param	{Zotero.Tag}		tag						Zotero.Tag to compare this item to
 * @param	{Boolean}		includeMatches			Include all fields, even those that aren't different
 * @param	{Boolean}		ignoreOnlyDateModified	If no fields other than dateModified
 *														are different, just return false
 */
Zotero.Tag.prototype.diff = function (tag, includeMatches, ignoreOnlyDateModified) {
	var diff = [];
	var thisData = this.serialize();
	var otherData = tag.serialize();
	var numDiffs = Zotero.Tags.diff(thisData, otherData, diff, includeMatches);
	
	// For the moment, just compare linked items and increase numDiffs if any differences
	var d1 = Zotero.Utilities.arrayDiff(
		thisData.linkedItems, otherData.linkedItems
	);
	var d2 = Zotero.Utilities.arrayDiff(
		otherData.linkedItems, thisData.linkedItems
	);
	numDiffs += d1.length + d2.length;
	
	if (d1.length || d2.length) {
		numDiffs += d1.length + d2.length;
		diff[0].linkedItems = d1;
		diff[1].linkedItems = d2;
	}
	else {
		diff[0].linkedItems = [];
		diff[1].linkedItems = [];
	}
	
	// DEBUG: ignoreOnlyDateModified wouldn't work if includeMatches was set?
	if (numDiffs == 0 ||
			(ignoreOnlyDateModified && numDiffs == 1
				&& diff[0].primary && diff[0].primary.dateModified)) {
		return false;
	}
	
	return diff;
}


Zotero.Tag.prototype.serialize = function () {
	var linkedItems = this.getLinkedItems(true);
	
	var obj = {
		primary: {
			tagID: this.id,
			libraryID: this.libraryID,
			key: this.key,
			dateAdded: this.dateAdded,
			dateModified: this.dateModified
		},
		fields: {
			name: this.name,
			type: this.type,
		},
		linkedItems: linkedItems ? linkedItems : []
	};
	return obj;
}


/**
 * Remove tag from all linked items
 *
 * Tags.erase() should be used instead of tag.erase() for deleting multiple tags
 *
 * Actual deletion of tag occurs in Zotero.Tags.purge()
 */
Zotero.Tag.prototype.erase = function () {
	Zotero.debug('Deleting tag ' + this.id);
	
	if (!this.id) {
		return;
	}
	
	var linkedItems = [];
	var linkedItemsNotifierData = {};
	
	Zotero.DB.beginTransaction();
	
	// Deletion done in Zotero.Tags.purge()
	//var deletedTagNotifierData = {};
	//deletedTagNotifierData[this.id] = { old: this.serialize() };
	
	var sql  = "SELECT itemID FROM itemTags WHERE tagID=?";
	var linkedItemIDs = Zotero.DB.columnQuery(sql, this.id);
	
	if (!linkedItemIDs) {
		Zotero.DB.commitTransaction();
		return;
	}
	
	var sql = "DELETE FROM itemTags WHERE tagID=?";
	Zotero.DB.query(sql, this.id);
	
	var itemTags = [];
	for each(var itemID in linkedItemIDs) {
		var item = Zotero.Items.get(itemID)
		if (!item) {
			throw ('Linked item not found in Zotero.Tag.erase()');
		}
		linkedItems.push(itemID);
		linkedItemsNotifierData[itemID] = { old: item.serialize() };
		
		itemTags.push(itemID + '-' + this.id);
	}
	
	// Deletion done in Zotero.Tags.purge()
	//Zotero.Tags.unload(this.id);
	
	Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
	
	// Send notification of linked items
	if (linkedItems.length) {
		Zotero.Notifier.trigger('modify', 'item', linkedItems, linkedItemsNotifierData);
	}
	
	// Deletion done in Zotero.Tags.purge()
	//Zotero.Notifier.trigger('delete', 'tag', this.id, deletedTagNotifierData);
	
	Zotero.DB.commitTransaction();
	
	this._reset();
	
	Zotero.Prefs.set('purge.tags', true);
}


Zotero.Tag.prototype._reset = function () {
	var id = this._id;
	var libraryID = this._libraryID;
	var key = this._key;
	this._init();
	this._id = id;
	this._libraryID = libraryID;
	this._key = key;
}


Zotero.Tag.prototype._loadLinkedItems = function() {
	if (!this.id && !this.key) {
		this._linkedItemsLoaded = true;
		return;
	}
	
	if (!this._loaded) {
		this.load();
	}
	
	if (!this.id) {
		this._linkedItemsLoaded = true;
		return;
	}
	
	var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
	var ids = Zotero.DB.columnQuery(sql, this.id) || [];
	
	this._linkedItems = {};
	
	for (let i=0; i<ids.length; i++) {
		let id = ids[i];
		this._linkedItems[id] = Zotero.Items.get(id);
	}
	
	this._linkedItemsLoaded = true;
}


Zotero.Tag.prototype._setLinkedItems = function (itemIDs) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (!Array.isArray(itemIDs)) {
		throw new Error('itemIDs must be an array');
	}
	
	var numCurrent = this.countLinkedItems();
	
	if (itemIDs.length == 0) {
		if (numCurrent == 0) {
			Zotero.debug('No linked items added', 4);
			return false;
		}
		
		// No items passed, so remove all currently linked items
		this._prepFieldChange('linkedItems');
		this._linkedItems = {};
		this._linkedItemIDsToAdd = [];
		this._linkedItemIDsToRemove = this.getLinkedItems(true);
		return true;
	}
	
	// Get all new items
	for (let i=0; i<itemIDs.length; i++) {
		let id = itemIDs[i];
		if (isNaN(parseInt(id))) {
			throw new Error("Invalid itemID '" + itemIDs[i] + "'");
		}
		
		if (this._linkedItems[id]) {
			Zotero.debug("Item " + id + " is already linked to tag " + this.id);
		}
		else {
			this._linkedItemIDsToAdd.push(id);
		}
	}
	
	// If no new items and the old and new lengths match, none are being removed either
	if (!this._linkedItemIDsToAdd.length && numCurrent == itemIDs.length) {
		Zotero.debug('Linked items not changed in Zotero.Tag._setLinkedItems()', 4);
		return false;
	}
	
	this._prepFieldChange('linkedItems');
	
	// Rebuild linked items with items that exist
	var items = Zotero.Items.get(itemIDs) || [];
	this._linkedItems = {};
	for (let i=0; i<items.length; i++) {
		this._linkedItems[items[i].id] = items[i];
	}
	
	// Mark items not found for removal
	for (let i=0; i<itemIDs.length; i++) {
		let id = itemIDs[i];
		if (!this._linkedItems[id]) {
			this._linkedItemIDsToRemove.push(id);
		}
	}
	
	return true;
}


Zotero.Tag.prototype._prepFieldChange = function (field) {
	if (!this._changed) {
		this._changed = {};
	}
	this._changed[field] = true;
	
	// Save a copy of the data before changing
	// TODO: only save previous data if tag exists
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
}


Zotero.Tag.prototype._generateKey = function () {
	return Zotero.Utilities.generateObjectKey();
}

