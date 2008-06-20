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


Zotero.Collection = function(collectionID) {
	this._collectionID = collectionID ? collectionID : null;
	this._init();
}

Zotero.Collection.prototype._init = function () {
	// Public members for access by public methods -- do not access directly
	this._name = null;
	this._parent = null;
	this._dateModified = null;
	this._key = null;
	
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
	
	this._hasChildCollections = false;
	this._childCollections = [];
	this._childCollectionsLoaded = false;
	
	this._hasChildItems = false;
	this._childItems = [];
	this._childItemsLoaded = false;
}


Zotero.Collection.prototype.__defineGetter__('id', function () { return this._collectionID; });

Zotero.Collection.prototype.__defineSetter__('collectionID', function (val) { this._set('collectionID', val); });
Zotero.Collection.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Collection.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Collection.prototype.__defineGetter__('parent', function () { return this._get('parent'); });
Zotero.Collection.prototype.__defineSetter__('parent', function (val) { this._set('parent', val); });
Zotero.Collection.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Collection.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });
Zotero.Collection.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Collection.prototype.__defineSetter__('key', function (val) { this._set('key', val); });

Zotero.Collection.prototype.__defineSetter__('childCollections', function (arr) { this._setChildCollections(arr); });
Zotero.Collection.prototype.__defineSetter__('childItems', function (arr) { this._setChildItems(arr); });


Zotero.Collection.prototype._get = function (field) {
	if (this.id && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Collection.prototype._set = function (field, val) {
	switch (field) {
		case 'id': // set using constructor
		//case 'collectionID': // set using constructor
			throw ("Invalid field '" + field + "' in Zotero.Collection.set()");
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

Zotero.Collection.prototype.getID = function() {
	Zotero.debug('Collection.getID() deprecated -- use Collection.id');
	return this.id;
}

Zotero.Collection.prototype.getName = function() {
	Zotero.debug('Collection.getName() deprecated -- use Collection.name');
	return this.name;
}

Zotero.Collection.prototype.getParent = function() {
	Zotero.debug('Collection.getParent() deprecated -- use Collection.parent');
	return this.parent;
}


/*
 * Build collection from database
 */
Zotero.Collection.prototype.load = function() {
	// Should be same as query in Zotero.Collections, just with collectionID
	var sql = "SELECT C.*, "
		+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
		+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
		+ "FROM collections C WHERE collectionID=?";
	var data = Zotero.DB.rowQuery(sql, this.id);
	
	this._init();
	this._loaded = true;
	
	if (!data) {
		return;
	}
	
	this.loadFromRow(data);
}


/*
 * Populate collection data from a database row
 */
Zotero.Collection.prototype.loadFromRow = function(row) {
	this._loaded = true;
	this._changed = false;
	this._previousData = false;
	
	this._collectionID = row.collectionID;
	this._name = row.collectionName;
	this._parent = row.parentCollectionID;
	this._dateModified = row.dateModified;
	this._key = row.key;
	this._hasChildCollections = row.hasChildCollections;
	this._hasChildItems = row.hasChildItems;
	this._loadChildItems();
}


Zotero.Collection.prototype.isEmpty = function() {
	return !(parseInt(this._hasChildCollections)) && !(parseInt(this._hasChildItems));
}

Zotero.Collection.prototype.hasChildCollections = function() {
	return !!(parseInt(this._hasChildCollections));
}

Zotero.Collection.prototype.hasChildItems = function() {
	return !!(parseInt(this._hasChildItems));
}


/**
 * Check if collection exists in the database
 *
 * @return	bool			TRUE if the collection exists, FALSE if not
 */
Zotero.Collection.prototype.exists = function() {
	if (!this.id) {
		throw ('collectionID not set in Zotero.Collection.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM collections WHERE collectionID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


/**
 * Returns subcollections of this collection
 *
 * @param	bool		asIDs		Return as collectionIDs
 * @return	array				Array of Zotero.Collection instances
 *									or collectionIDs, or FALSE if none
 */
Zotero.Collection.prototype.getChildCollections = function (asIDs) {
	if (!this._childCollectionsLoaded) {
		this._loadChildCollections();
	}
	
	if (this._childCollections.length == 0) {
		return false;
	}
	
	// Return collectionIDs
	if (asIDs) {
		var ids = [];
		for each(var col in this._childCollections) {
			ids.push(col.id);
		}
		return ids;
	}
	
	// Return Zotero.Collection objects
	var objs = [];
	for each(var col in this._childCollections) {
		objs.push(col);
	}
	return objs;
}


/**
 * Returns child items of this collection
 *
 * @param	bool		asIDs		Return as itemIDs
 * @return	array				Array of Zotero.Item instances or itemIDs,
 *									or FALSE if none
 */
Zotero.Collection.prototype.getChildItems = function (asIDs) {
	if (!this._childItemsLoaded) {
		this._loadChildItems();
	}
	
	if (this._childItems.length == 0) {
		return false;
	}
	
	// Return itemIDs
	if (asIDs) {
		var ids = [];
		for each(var item in this._childItems) {
			ids.push(item.id);
		}
		return ids;
	}
	
	// Return Zotero.Item objects
	var objs = [];
	for each(var item in this._childItems) {
		objs.push(item);
	}
	return objs;
}


Zotero.Collection.prototype.save = function () {
	if (!this.name) {
		throw ('Collection name is empty in Zotero.Collection.save()');
	}
	
	if (!this._changed) {
		Zotero.debug("Collection " + this.id + " has not changed");
		return false;
	}
	
	if (this._changed.parent && this.parent) {
		if (!Zotero.Collections.get(this.parent)) {
			throw ('Cannot set parent of collection ' + this.id
				+ ' to invalid parent ' + this.parent);
		}
		
		if (this.parent == this.id) {
			throw ('Cannot move collection into itself!');
		}
		
		if (this.hasDescendent('collection', this.parent)) {
			throw ('Cannot move collection into one of its own descendents!', 2);
		}
	}
	
	
	Zotero.DB.beginTransaction();
	
	// ID change
	if (this._changed['collectionID']) {
		var oldID = this._previousData.primary.collectionID;
		var params = [this.id, oldID];
		
		Zotero.debug("Changing collectionID " + oldID + " to " + this.id);
		
		var row = Zotero.DB.rowQuery("SELECT * FROM collections WHERE collectionID=?", oldID);
		// Add a new row so we can update the old rows despite FK checks
		// Use temp key due to UNIQUE constraint on key column
		Zotero.DB.query("INSERT INTO collections VALUES (?, ?, ?, ?, ?)",
			[this.id, row.collectionName, row.parentCollectionID,
			row.dateModified, 'TEMPKEY']);
		
		Zotero.DB.query("UPDATE collectionItems SET collectionID=? WHERE collectionID=?", params);
		Zotero.DB.query("UPDATE collections SET parentCollectionID=? WHERE parentCollectionID=?", params);
		
		Zotero.DB.query("DELETE FROM collections WHERE collectionID=?", oldID);
		Zotero.DB.query("UPDATE collections SET key=? WHERE collectionID=?", [row.key, this.id]);
		
		Zotero.Collections.unload(oldID);
		Zotero.Notifier.trigger('id-change', 'collection', oldID + '-' + this.id);
		
		// update caches
	}
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var collectionID = this.id ? this.id : Zotero.ID.get('collections');
		
		Zotero.debug("Saving collection " + this.id);
		
		var key = this.key ? this.key : this._generateKey();
		
		var columns = [
			'collectionID', 'collectionName', 'parentCollectionID',
			'dateModified', 'key'
		];
		var placeholders = ['?', '?', '?', '?', '?'];
		var sqlValues = [
			collectionID ? { int: collectionID } : null,
			{ string: this.name },
			this.parent ? { int: this.parent } : null,
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			key
		];
		
		var sql = "REPLACE INTO collections (" + columns.join(', ') + ") VALUES ("
			+ placeholders.join(', ') + ")";
		var insertID = Zotero.DB.query(sql, sqlValues);
		if (!collectionID) {
			collectionID = insertID;
		}
		
		// Subcollections
		if (this._changed.childCollections) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getChildCollections(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			if (this._previousData.childCollections) {
				for each(var id in this._previousData.childCollections) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
			}
			for each(var id in currentIDs) {
				if (this._previousData.childCollections &&
						this._previousData.childCollections.indexOf(id) != -1) {
					continue;
				}
				newids.push(id);
			}
			
			if (removed.length) {
				var sql = "UPDATE collections SET parentCollectionID=NULL "
						+ "WHERE collectionID IN ("
						+ removed.map(function () '?').join()
						+ ")";
				Zotero.DB.query(sql, removed);
			}
			
			if (newids.length) {
				var sql = "UPDATE collections SET parentCollectionID=? "
						+ "WHERE collectionID IN ("
						+ newids.map(function () '?').join()
						+ ")";
				Zotero.DB.query(sql, [collectionID].concat(newids));
			}
			
			// TODO: notifier
		}
		
		// Child items
		if (this._changed.childItems) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getChildItems(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			if (this._previousData.childItems) {
				for each(var id in this._previousData.childItems) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
			}
			for each(var id in currentIDs) {
				if (this._previousData.childItems &&
						this._previousData.childItems.indexOf(id) != -1) {
					continue;
				}
				newids.push(id);
			}
			
			if (removed.length) {
				var sql = "DELETE FROM collectionItems WHERE collectionID=? "
					+ "AND itemID IN ("
					+ removed.map(function () '?').join()
					+ ")";
				Zotero.DB.query(sql, [collectionID].concat(removed));
			}
			
			if (newids.length) {
				var sql = "SELECT IFNULL(MAX(orderIndex)+1, 0) "
					+ "FROM collectionItems WHERE collectionID=?"
				var orderStatement = Zotero.DB.getStatement(sql);
				
				var sql = "INSERT INTO collectionItems "
					+ "(collectionID, itemID, orderIndex) VALUES (?,?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				for each(var itemID in newids) {
					orderStatement.bindInt32Parameter(0, collectionID);
					try {
						if (orderStatement.executeStep()) {
							var orderIndex = orderStatement.getInt32(0);
						}
					}
					catch (e) {
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}

					orderStatement.reset();
					
					insertStatement.bindInt32Parameter(0, collectionID);
					insertStatement.bindInt32Parameter(1, itemID);
					insertStatement.bindInt32Parameter(2,
						orderIndex ? orderIndex : 0);
					
					try {
						insertStatement.execute();
					}
					catch (e) {
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}
				}
			}
			
			//Zotero.Notifier.trigger('add', 'collection-item', this.id + '-' + itemID);
		}
		
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	// If successful, set values in object
	if (!this.id) {
		this._collectionID = collectionID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	Zotero.Collections.reloadAll();
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'collection', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'collection', this.id, this._previousData);
	}
	
	if (this._changed.parent) {
		var notifyIDs = [this.id];
		if (this._previousData.parent) {
			notifyIDs.push(this._previousData.parent);
		}
		if (this.parent) {
			notifyIDs.push(this.parent);
		}
		//Zotero.Notifier.trigger('move', 'collection', notifyIDs, notifierData);
	}
	
	return this.id;
}


/**
* Add an item to the collection
**/
Zotero.Collection.prototype.addItem = function(itemID) {
	var current = this.getChildItems(true);
	if (current && current.indexOf(itemID) != -1) {
		Zotero.debug("Item " + itemID + " already a child of collection "
			+ this.id + " in Zotero.Collection.addItem()");
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	if (!Zotero.Items.get(itemID)) {
		Zotero.DB.rollbackTransaction();	
		throw(itemID + ' is not a valid item id');
	}
	
	var sql = "SELECT IFNULL(MAX(orderIndex)+1, 0) "
			+ "FROM collectionItems WHERE collectionID=?";
	var nextOrderIndex = Zotero.DB.valueQuery(sql, this.id);
	
	sql = "INSERT OR IGNORE INTO collectionItems VALUES (?,?,?)";
	Zotero.DB.query(sql, [this.id, itemID, nextOrderIndex]);
	
	sql = "UPDATE collections SET dateModified=? WHERE collectionID=?";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, this.id]);
	
	Zotero.DB.commitTransaction();
	
	Zotero.Collections.reload(this.id);
	
	Zotero.Notifier.trigger('add', 'collection-item', this.id + '-' + itemID);
	
	return true;
}


/**
 * Add multiple items to the collection in batch
 */
Zotero.Collection.prototype.addItems = function(itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	Zotero.DB.beginTransaction();
	for (var i=0; i<itemIDs.length; i++) {
		this.addItem(itemIDs[i]);
	}
	Zotero.DB.commitTransaction();
}


/**
* Remove an item from the collection (does not delete item from library)
**/
Zotero.Collection.prototype.removeItem = function(itemID) {
	var childItems = this.getChildItems(true);
	if (childItems) {
		var index = childItems.indexOf(itemID);
		if (index == -1) {
			Zotero.debug("Item " + itemID + " not a child of collection "
				+ this.id + " in Zotero.Collection.removeItem()");
			return false;
		}
	}
	
	Zotero.DB.beginTransaction();
	
	var sql = "DELETE FROM collectionItems WHERE collectionID=? AND itemID=?";
	Zotero.DB.query(sql, [this.id, itemID]);
	
	sql = "UPDATE collections SET dateModified=? WHERE collectionID=?";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, this.id])
	
	Zotero.DB.commitTransaction();
	
	Zotero.Collections.reload(this.id);
	
	Zotero.Notifier.trigger('remove', 'collection-item', this.id + '-' + itemID);
	
	return true;
}


/**
 * Remove multiple items from the collection in batch
 * (does not delete item from library)
 */
Zotero.Collection.prototype.removeItems = function(itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	Zotero.DB.beginTransaction();
	for (var i=0; i<itemIDs.length; i++) {
		this.removeItem(itemIDs[i]);
	}
	Zotero.DB.commitTransaction();
}


/**
* Check if an item belongs to the collection
**/
Zotero.Collection.prototype.hasItem = function(itemID) {
	if (!this._childItemsLoaded) {
		this._loadChildItems();
	}
	
	for each(var item in this._childItems) {
		if (item.id == itemID) {
			return true;
		}
	}
	return false;
}


Zotero.Collection.prototype.hasDescendent = function(type, id) {
	var descendents = this.getDescendents();
	for (var i=0, len=descendents.length; i<len; i++) {
		if (descendents[i].type == type && descendents[i].id == id) {
			return true;
		}
	}
	return false;
}


/**
* Deletes collection and all descendent collections (and optionally items)
**/
Zotero.Collection.prototype.erase = function(deleteItems) {
	Zotero.DB.beginTransaction();
	
	var descendents = this.getDescendents();
	var collections = [this.id];
	var items = [];
	var notifierData = {};
	notifierData[this.id] = { old: this.serialize() };
	
	for(var i=0, len=descendents.length; i<len; i++) {
		// Descendent collections
		if (descendents[i].type == 'collection') {
			collections.push(descendents[i].id);
			var c = Zotero.Collections.get(descendents[i].id);
			if (c) {
				notifierData[c.id] = { old: c.serialize() };
			}
		}
		// Descendent items
		else {
			if (deleteItems) {
				// Delete items from DB
				Zotero.Items.get(descendents[i].id).erase();
			}
		}
	}
	
	var placeholders = collections.map(function () '?').join();
	
	// Remove item associations for all descendent collections
	Zotero.DB.query('DELETE FROM collectionItems WHERE collectionID IN '
		+ '(' + placeholders + ')', collections);
	
	// Remove parent definitions first for FK check
	Zotero.DB.query('UPDATE collections SET parentCollectionID=NULL '
		+ 'WHERE parentCollectionID IN (' + placeholders + ')', collections);
	
	// And delete all descendent collections
	Zotero.DB.query('DELETE FROM collections WHERE collectionID IN '
		+ '(' + placeholders + ')', collections);
	
	Zotero.DB.commitTransaction();
	
	// Clear deleted collection from internal memory
	Zotero.Collections.unload(collections);
	
	Zotero.Collections.reloadAll();
	
	Zotero.Notifier.trigger('delete', 'collection', collections, notifierData);
}


Zotero.Collection.prototype.isCollection = function() {
	return true;
}


Zotero.Collection.prototype.toArray = function() {
	Zotero.debug('Collection.toArray() is deprecated -- use Collection.serialize()');
	return this.serialize();
}


Zotero.Collection.prototype.serialize = function(nested) {
	var obj = {
		primary: {
			collectionID: this.id,
			dateModified: this.dateModified,
			key: this.key
		},
		name: this.name,
		parent: this.parent,
		childCollections: this.getChildCollections(true),
		childItems: this.getChildItems(true),
		descendents: this.getDescendents(nested)
	};
	return obj;
}


/**
 * Returns an array of descendent collections and items
 *	(rows of 'id', 'type' ('item' or 'collection'), 'parent', and,
 * 	if collection, 'name' and the nesting 'level')
 *
 * @param	bool		recursive	Descend into subcollections
 * @param	bool		nested		Return multidimensional array with 'children'
 *									nodes instead of flat array
 * @param	string	type			'item', 'collection', or FALSE for both
 */
Zotero.Collection.prototype.getChildren = function(recursive, nested, type, level) {
	var toReturn = [];
	
	if (!level) {
		level = 1;
	}
	
	// 0 == collection
	// 1 == item
	var children = Zotero.DB.query('SELECT collectionID AS id, '
		+ "0 AS type, collectionName AS collectionName "
		+ 'FROM collections WHERE parentCollectionID=?1'
		+ ' UNION SELECT itemID AS id, 1 AS type, NULL AS collectionName '
		+ 'FROM collectionItems WHERE collectionID=?1', this.id);
	
	if (type) {
		switch (type) {
			case 'item':
			case 'collection':
				break;
			default:
				throw ("Invalid type '" + type + "' in Collection.getChildren()");
		}
	}
	
	for(var i=0, len=children.length; i<len; i++) {
		// This seems to not work without parseInt() even though
		// typeof children[i]['type'] == 'number' and
		// children[i]['type'] === parseInt(children[i]['type']),
		// which sure seems like a bug to me
		switch (parseInt(children[i].type)) {
			case 0:
				if (!type || type=='collection') {
					toReturn.push({
						id: children[i].id,
						name: children[i].collectionName,
						type: 'collection',
						level: level,
						parent: this.id
					});
				}
				
				if (recursive) {
					var descendents =
						Zotero.Collections.get(children[i].id).
							getChildren(true, nested, type, level+1);
					
					if (nested) {
						toReturn[toReturn.length-1].children = descendents;
					}
					else {
						for (var j=0, len2=descendents.length; j<len2; j++) {
							toReturn.push(descendents[j]);
						}
					}
				}
			break;
			
			case 1:
				if (!type || type=='item') {
					toReturn.push({
						id: children[i].id,
						type: 'item',
						parent: this.id
					});
				}
			break;
		}
	}
	
	return toReturn;
}


/**
 * Alias for the recursive mode of getChildren()
 */
Zotero.Collection.prototype.getDescendents = function(nested, type, level) {
	return this.getChildren(true, nested, type);
}


Zotero.Collection.prototype._prepFieldChange = function (field) {
	if (!this._changed) {
		this._changed = {};
	}
	this._changed[field] = true;
	
	// Save a copy of the data before changing
	// TODO: only save previous data if collection exists
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
}


Zotero.Collection.prototype._setChildCollections = function (collectionIDs) {
	this._setChildren('collection', collectionIDs);
}


Zotero.Collection.prototype._setChildItems = function (itemIDs) {
	this._setChildren('item', itemIDs);
}


Zotero.Collection.prototype._setChildren = function (type, ids) {
	if (type != 'collection' && type != 'item') {
		throw ("Invalid type '" + type + "' in Zotero.Collection._setChildren()");
	}
	
	var Type = type.charAt(0).toUpperCase() + type.substr(1);
	var Types = Type + 's'; // 'Items'
	var types = type + 's'; // 'items'
	
	if (!this['_child' + Types + 'Loaded']) {
		this['_loadChild' + Types]();
	}
	
	if (ids.constructor.name != 'Array') {
		throw (type + 'IDs must be an array in Zotero.Collection._setChildren()');
	}
	
	var currentIDs = this['getChild' + Types](true);
	if (!currentIDs) {
		currentIDs = [];
	}
	var oldIDs = []; // children being kept
	var newIDs = []; // new children
	
	if (ids.length == 0) {
		if (this['_child' + Types].length == 0) {
			Zotero.debug('No child ' + types + ' added', 4);
			return false;
		}
	}
	else {
		for (var i in ids) {
			var id = parseInt(ids[i]);
			if (isNaN(id)) {
				throw ("Invalid " + type + "ID '" + ids[i]
					+ "' in Zotero.Collection._setChildren()");
			}
			
			if (currentIDs.indexOf(id) != -1) {
				Zotero.debug(Type + " " + ids[i]
					+ " is already a child of collection " + this.id);
				oldIDs.push(id);
				continue;
			}
			
			newIDs.push(id);
		}
	}
	
	// Mark as changed if new or removed ids
	if (newIDs.length > 0 || oldIDs.length != this['_child' + Types].length) {
		this._prepFieldChange('child' + Types);
	}
	else {
		Zotero.debug('Child ' + types + ' not changed', 4);
		return false;
	}
	
	newIDs = oldIDs.concat(newIDs);
	
	this['_child' + Types] = [];
	// Items.get() can take an array
	if (type == 'item') {
		this._childItems = Zotero.Items.get(newIDs);
	}
	else {
		for (var id in newIDs) {
			this['_child' + Types].push(Zotero[Types].get(id));
		}
	}
	
	return true;
}


Zotero.Collection.prototype._loadChildCollections = function () {
	var sql = "SELECT collectionID FROM collections WHERE parentCollectionID=?";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	
	this._childCollections = [];
	
	if (ids) {
		for each(var id in ids) {
			this._childCollections.push(Zotero.Collections.get(id));
		}
	}
	
	this._childCollectionsLoaded = true;
}

Zotero.Collection.prototype._loadChildItems = function() {
	var sql = "SELECT itemID FROM collectionItems WHERE collectionID=? ";
		// DEBUG: Fix for child items created via context menu on parent within
		// a collection being added to the current collection
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemNotes WHERE sourceItemID IS NOT NULL) "
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments WHERE sourceItemID IS NOT NULL)";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	
	this._childItems = [];
	
	if (ids) {
		for each(var id in ids) {
			this._childItems.push(Zotero.Items.get(id));
		}
	}
	
	this._childItemsLoaded = true;
}


Zotero.Collection.prototype._generateKey = function () {
	return Zotero.ID.getKey();
}
