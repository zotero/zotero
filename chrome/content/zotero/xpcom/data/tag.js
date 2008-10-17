/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.Tag = function(tagID) {
	this._tagID = tagID ? tagID : null;
	this._init();
}

Zotero.Tag.prototype._init = function () {
	// Public members for access by public methods -- do not access directly
	this._name = null;
	this._type = null;
	this._dateModified = null;
	this._key = null;
	
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
	
	this._linkedItemsLoaded = false;
	this._linkedItems = [];
}


Zotero.Tag.prototype.__defineGetter__('id', function () { return this._tagID; });

Zotero.Tag.prototype.__defineSetter__('tagID', function (val) { this._set('tagID', val); });
Zotero.Tag.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Tag.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Tag.prototype.__defineGetter__('type', function () { return this._get('type'); });
Zotero.Tag.prototype.__defineSetter__('type', function (val) { this._set('type', val); });
Zotero.Tag.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Tag.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });
Zotero.Tag.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Tag.prototype.__defineSetter__('key', function (val) { this._set('key', val); });

Zotero.Tag.prototype.__defineSetter__('linkedItems', function (arr) { this._setLinkedItems(arr); });


Zotero.Tag.prototype._get = function (field) {
	if (this.id && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Tag.prototype._set = function (field, val) {
	switch (field) {
		case 'id': // set using constructor
		//case 'tagID': // set using constructor
			throw ("Invalid field '" + field + "' in Zotero.Tag.set()");
	}
	
	if (this.id) {
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
	Zotero.debug("Loading data for tag " + this.id + " in Zotero.Tag.load()");
	
	if (!this.id) {
		throw ("tagID not set in Zotero.Tag.load()");
	}
	
	var sql = "SELECT name, type, dateModified, key FROM tags WHERE tagID=?";
	var row = Zotero.DB.rowQuery(sql, this.id);
	
	this.loadFromRow(row);
	return true;
}


Zotero.Tag.prototype.loadFromRow = function (row) {
	this._init();
	for (var col in row) {
		//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for tag " + this.id);
		this['_' + col] = (!row[col] && row[col] !== 0) ? '' : row[col];
	}
	this._loaded = true;
}



/**
 * Returns items linked to this tag
 *
 * @param	bool		asIDs	Return as itemIDs
 * @return	array				Array of Zotero.Item instances or itemIDs,
 *									or FALSE if none
 */
Zotero.Tag.prototype.getLinkedItems = function (asIDs) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (this._linkedItems.length == 0) {
		return false;
	}
	
	// Return itemIDs
	if (asIDs) {
		var ids = [];
		for each(var item in this._linkedItems) {
			ids.push(item.id);
		}
		return ids;
	}
	
	// Return Zotero.Item objects
	var objs = [];
	for each(var item in this._linkedItems) {
		objs.push(item);
	}
	return objs;
}


Zotero.Tag.prototype.addItem = function (itemID) {
	var current = this.getLinkedItems(true);
	if (current && current.indexOf(itemID) != -1) {
		Zotero.debug("Item " + itemID + " already has tag "
			+ this.id + " in Zotero.Tag.addItem()");
		return false;
	}
	
	this._prepFieldChange('linkedItems');
	var item = Zotero.Items.get(itemID);
	if (!item) {
		throw ("Can't link invalid item " + itemID + " to tag " + this.id
			+ " in Zotero.Tag.addItem()");
	}
	this._linkedItems.push(item);
	return true;
}


Zotero.Tag.prototype.removeItem = function (itemID) {
	var current = this.getLinkedItems(true);
	if (current) {
		var index = current.indexOf(itemID);
	}
	
	if (!current || index == -1) {
		Zotero.debug("Item " + itemID + " doesn't have tag "
			+ this.id + " in Zotero.Tag.removeItem()");
		return false;
	}
	
	this._prepFieldChange('linkedItems');
	this._linkedItems.splice(index, 1);
	return true;
}


Zotero.Tag.prototype.save = function () {
	// Default to manual tag
	if (!this.type) {
		this.type = 0;
	}
	
	if (this.type !== 0 && this.type != 1) {
		throw ('Invalid tag type ' + this.type + ' in Zotero.Tag.save()');
	}
	
	if (!this.name) {
		throw ('Tag name is empty in Zotero.Tag.save()');
	}
	
	if (!this._changed) {
		Zotero.debug("Tag " + this.id + " has not changed");
		return false;
	}
	
	
	Zotero.DB.beginTransaction();
	
	// ID change
	if (this._changed.tagID) {
		var oldID = this._previousData.primary.tagID;
		var params = [this.id, oldID];
		
		Zotero.debug("Changing tagID " + oldID + " to " + this.id);
		
		var row = Zotero.DB.rowQuery("SELECT * FROM tags WHERE tagID=?", oldID);
		
		// Set type on old row to -1, since there's a UNIQUE on name/type
		Zotero.DB.query("UPDATE tags SET type=-1 WHERE tagID=?", oldID);
		
		// Add a new row so we can update the old rows despite FK checks
		// Use temp key due to UNIQUE constraint on key column
		Zotero.DB.query("INSERT INTO tags VALUES (?, ?, ?, ?, ?)",
			[this.id, row.name, row.type, row.dateModified, 'TEMPKEY']);
		
		Zotero.DB.query("UPDATE itemTags SET tagID=? WHERE tagID=?", params);
		
		Zotero.DB.query("DELETE FROM tags WHERE tagID=?", oldID);
		
		Zotero.DB.query("UPDATE tags SET key=? WHERE tagID=?", [row.key, this.id]);
		
		Zotero.Notifier.trigger('id-change', 'tag', oldID + '-' + this.id);
		
		// update caches
	}
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var tagID = this.id ? this.id : Zotero.ID.get('tags');
		
		Zotero.debug("Saving tag " + this.id);
		
		var key = this.key ? this.key : this._generateKey();
		
		var columns = [
			'tagID', 'name', 'type', 'dateModified', 'key'
		];
		var placeholders = ['?', '?', '?', '?', '?'];
		var sqlValues = [
			tagID ? { int: tagID } : null,
			{ string: this.name },
			{ int: this.type },
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			key
		];
		
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
		
		
		// Linked items
		if (this._changed.linkedItems) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getLinkedItems(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			if (this._previousData.linkedItems) {
				for each(var id in this._previousData.linkedItems) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
			}
			for each(var id in currentIDs) {
				if (this._previousData.linkedItems &&
						this._previousData.linkedItems.indexOf(id) != -1) {
					continue;
				}
				newids.push(id);
			}
			
			if (removed.length) {
				var sql = "DELETE FROM itemTags WHERE tagID=? "
					+ "AND itemID IN ("
					+ removed.map(function () '?').join()
					+ ")";
				Zotero.DB.query(sql, [tagID].concat(removed));
			}
			
			if (newids.length) {
				var sql = "INSERT INTO itemTags (itemID, tagID) VALUES (?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				for each(var itemID in newids) {
					insertStatement.bindInt32Parameter(0, itemID);
					insertStatement.bindInt32Parameter(1, tagID);
					
					try {
						insertStatement.execute();
					}
					catch (e) {
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}
				}
			}
			
			//Zotero.Notifier.trigger('add', 'tag-item', this.id + '-' + itemID);
			
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
		this._tagID = tagID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	Zotero.Tags.reload(this.id);
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'tag', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'tag', this.id, this._previousData);
	}
	
	return this.id;
}


Zotero.Tag.prototype.serialize = function () {
	var obj = {
		primary: {
			tagID: this.id,
			dateModified: this.dateModified,
			key: this.key
		},
		name: this.name,
		type: this.type,
		linkedItems: this.getLinkedItems(true),
	};
	return obj;
}



/**
 * Remove tag from all linked items
 *
 * Tags.erase() should be used externally instead of this
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
	
	var deletedTagNotifierData = {};
	deletedTagNotifierData[this.id] = { old: this.serialize() };
	
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
	Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
	
	// Send notification of linked items
	if (linkedItems.length) {
		Zotero.Notifier.trigger('modify', 'item', linkedItems, linkedItemsNotifierData);
	}
	
	Zotero.Notifier.trigger('delete', 'tag', this.id, deletedTagNotifierData);
	
	Zotero.DB.commitTransaction();
	return;
}


Zotero.Tag.prototype._loadLinkedItems = function() {
	if (!this._loaded) {
		this.load();
	}
	
	var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	
	this._linkedItems = [];
	
	if (ids) {
		for each(var id in ids) {
			this._linkedItems.push(Zotero.Items.get(id));
		}
	}
	
	this._linkedItemsLoaded = true;
}


Zotero.Tag.prototype._setLinkedItems = function (itemIDs) {
	if (!this._linkedItemsLoaded) {
		this._loadLinkedItems();
	}
	
	if (itemIDs.constructor.name != 'Array') {
		throw ('ids must be an array in Zotero.Tag._setLinkedItems()');
	}
	
	var currentIDs = this.getLinkedItems(true);
	if (!currentIDs) {
		currentIDs = [];
	}
	var oldIDs = []; // children being kept
	var newIDs = []; // new children
	
	if (itemIDs.length == 0) {
		if (currentIDs.length == 0) {
			Zotero.debug('No linked items added', 4);
			return false;
		}
	}
	else {
		for (var i in itemIDs) {
			var id = parseInt(itemIDs[i]);
			if (isNaN(id)) {
				throw ("Invalid itemID '" + itemIDs[i]
					+ "' in Zotero.Tag._setLinkedItems()");
			}
			
			if (currentIDs.indexOf(id) != -1) {
				Zotero.debug("Item " + itemIDs[i]
					+ " is already linked to tag " + this.id);
				oldIDs.push(id);
				continue;
			}
			
			newIDs.push(id);
		}
	}
	
	// Mark as changed if new or removed ids
	if (newIDs.length > 0 || oldIDs.length != currentIDs.length) {
		this._prepFieldChange('linkedItems');
	}
	else {
		Zotero.debug('Linked items not changed in Zotero.Tag._setLinkedItems()', 4);
		return false;
	}
	
	newIDs = oldIDs.concat(newIDs);
	
	var items = Zotero.Items.get(itemIDs);
	this._linkedItems = items ? items : [];
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
	return Zotero.ID.getKey();
}

