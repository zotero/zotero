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


Zotero.Collection = function() {
	if (arguments[0]) {
		throw ("Zotero.Collection constructor doesn't take any parameters");
	}
	
	this._init();
}

Zotero.Collection.prototype._init = function () {
	// Public members for access by public methods -- do not access directly
	this._id = null;
	this._libraryID = null
	this._key = null;
	this._name = null;
	this._parent = false;
	this._dateAdded = null;
	this._dateModified = null;
	
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
	
	this._hasChildCollections;
	this._childCollections = [];
	this._childCollectionsLoaded = false;
	
	this._hasChildItems = false;
	this._childItems = [];
	this._childItemsLoaded = false;
	
	this._dateModifiedLocked = false;
}


Zotero.Collection.prototype.__defineGetter__('objectType', function () { return 'collection'; });
Zotero.Collection.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Collection.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Collection.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Collection.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Collection.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Collection.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Collection.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Collection.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Collection.prototype.__defineGetter__('parent', function () { return this._get('parent'); });
Zotero.Collection.prototype.__defineSetter__('parent', function (val) { this._set('parent', val); });
Zotero.Collection.prototype.__defineGetter__('parentKey', function () { return this._get('parentKey'); });
Zotero.Collection.prototype.__defineSetter__('parentKey', function (val) { this._set('parentKey', val); });
Zotero.Collection.prototype.__defineGetter__('dateAdded', function () { return this._get('dateAdded'); });
Zotero.Collection.prototype.__defineSetter__('dateAdded', function (val) { this._set('dateAdded', val); });
Zotero.Collection.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Collection.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });

//Zotero.Collection.prototype.__defineSetter__('childCollections', function (arr) { this._setChildCollections(arr); });
Zotero.Collection.prototype.__defineSetter__('childItems', function (arr) { this._setChildItems(arr); });

Zotero.Collection.prototype._get = function (field) {
	if ((this._id || this._key) && !this._loaded) {
		this.load();
	}
	
	switch (field) {
		case 'parent':
			return this._getParent();
			
		case 'parentKey':
			return this._getParentKey();
	}
	
	return this['_' + field];
}


Zotero.Collection.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
		case 'key':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Collection._set()");
			}
			//this._checkValue(field, val);
			this['_' + field] = val;
			return;
		
		case 'name':
			val = Zotero.Utilities.prototype.trim(val);
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
	
	switch (field) {
		case 'parent':
			this._setParent(val);
			return;
			
		case 'parentKey':
			this._setParentKey(val);
			return;
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
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	//var desc = id ? id : libraryID + "/" + key;
	
	// Should be same as query in Zotero.Collections, just with collectionID
	var sql = "SELECT C.*, "
		+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
		+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
		+ "FROM collections C WHERE ";
	if (id) {
		sql += "collectionID=?";
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
	var data = Zotero.DB.rowQuery(sql, params);
	
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
	
	this._id = row.collectionID;
	this._libraryID = row.libraryID;
	this._key = row.key;
	this._name = row.collectionName;
	this._parent = row.parentCollectionID;
	this._dateAdded = row.dateAdded;
	this._dateModified = row.dateModified;
	this._childCollectionsLoaded = false;
	this._hasChildCollections = !!row.hasChildCollections;
	this._childItemsLoaded = false;
	this._hasChildItems = !!row.hasChildItems;
	this._loadChildItems();
}


Zotero.Collection.prototype.isEmpty = function() {
	return !(parseInt(this._hasChildCollections)) && !(parseInt(this._hasChildItems));
}

Zotero.Collection.prototype.hasChildCollections = function() {
	if (!this.id) {
		throw ("Zotero.Collection.hasChildCollections cannot be called "
			+ "on an unsaved collection");
	}
	
	if (this._hasChildCollections == undefined) {
		var sql = "SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=?";
		this._hasChildCollections = !!Zotero.DB.valueQuery(sql, this.id);
	}
	
	return this._hasChildCollections;
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


/**
 * Prevent dateModified from being updated when removing an item
 *
 * Used for a tricky sync case
 */
Zotero.Collection.prototype.lockDateModified = function () {
	this._dateModifiedLocked = true;
}


Zotero.Collection.prototype.unlockDateModified = function () {
	this._dateModifiedLocked = false;
}


Zotero.Collection.prototype.save = function () {
	Zotero.Collections.editCheck(this);
	
	if (!this.name) {
		throw ('Collection name is empty in Zotero.Collection.save()');
	}
	
	if (!this._changed) {
		Zotero.debug("Collection " + this.id + " has not changed");
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var collectionID = this.id ? this.id : Zotero.ID.get('collections');
		
		Zotero.debug("Saving collection " + this.id);
		
		var key = this.key ? this.key : this._generateKey();
		
		// Verify parent
		if (this._parent) {
			if (typeof this._parent == 'number') {
				var newParent = Zotero.Collections.get(this._parent);
			}
			else {
				var newParent = Zotero.Collections.getByLibraryAndKey(this.libraryID, this._parent);
			}
			
			if (!newParent) {
				throw("Cannot set parent to invalid collection " + this._parent + " in Zotero.Collection.save()");
			}
			
			if (newParent.id == this.id) {
				throw ('Cannot move collection into itself!');
			}
			
			if (this.id && this.hasDescendent('collection', newParent.id)) {
				throw ('Cannot move collection into one of its own descendents!', 2);
			}
			
			var parent = newParent.id;
		}
		else {
			var parent = null;
		}
		
		var columns = [
			'collectionID',
			'collectionName',
			'parentCollectionID',
			'dateAdded',
			'dateModified',
			'clientDateModified',
			'libraryID',
			'key'
		];
		var placeholders = ['?', '?', '?', '?', '?', '?', '?', '?'];
		var sqlValues = [
			collectionID ? { int: collectionID } : null,
			{ string: this.name },
			parent ? parent : null,
			// If date added isn't set, use current timestamp
			this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			Zotero.DB.transactionDateTime,
			this.libraryID ? this.libraryID : null,
			key
		];
		
		var sql = "REPLACE INTO collections (" + columns.join(', ') + ") VALUES ("
			+ placeholders.join(', ') + ")";
		var insertID = Zotero.DB.query(sql, sqlValues);
		if (!collectionID) {
			collectionID = insertID;
		}
		
		if (this._changed.parent) {
			var parentIDs = [];
			if (this.id && this._previousData.parent) {
				parentIDs.push(this._previousData.parent);
			}
			if (this.parent) {
				parentIDs.push(this.parent);
			}
			if (this.id) {
				Zotero.Notifier.trigger('move', 'collection', this.id);
			}
		}
		
		/*
		// Subcollections
		if (this._changed.childCollections) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getChildCollections(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			if (this._previousData) {
				for each(var id in this._previousData.childCollections) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
			}
			for each(var id in currentIDs) {
				if (this._previousData &&
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
		*/
		
		// Child items
		if (this._changed.childItems) {
			var removed = [];
			var newids = [];
			var currentIDs = this.getChildItems(true);
			if (!currentIDs) {
				currentIDs = [];
			}
			
			if (this._previousData) {
				for each(var id in this._previousData.childItems) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
			}
			for each(var id in currentIDs) {
				if (this._previousData &&
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
						Zotero.debug("collectionID: " + collectionID);
						Zotero.debug("itemID: " + itemID);
						Zotero.debug("orderIndex: " + orderIndex);
						var errmsg = Zotero.DB.getLastErrorString();
						Zotero.debug(Zotero.DB.query("SELECT * FROM collections WHERE collectionID=?", collectionID));
						Zotero.debug(Zotero.DB.query("SELECT * FROM collectionItems WHERE collectionID=?", collectionID));
						throw (e + ' [ERROR: ' + errmsg + ']');
					}
				}
			}
			
			//Zotero.Notifier.trigger('add', 'collection-item', this.id + '-' + itemID);
		}
		
		if (this._changed.libraryID) {
			var groupID = Zotero.Libraries.getGroupIDFromLibraryID(this.libraryID);
			var group = Zotero.Groups.get(groupID);
			group.clearCollectionsCache();
		}
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	// If successful, set values in object
	if (!this.id) {
		this._id = collectionID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	Zotero.Collections.reload(this.id);
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'collection', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'collection', this.id, this._previousData);
	}
	
	// Invalidate cached child collections
	if (parentIDs) {
		Zotero.Collections.refreshChildCollections(parentIDs);
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
	
	sql = "UPDATE collections SET dateModified=?, clientDateModified=? WHERE collectionID=?";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, Zotero.DB.transactionDateTime, this.id]);
	
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
	
	if (!this._dateModifiedLocked) {
		sql = "UPDATE collections SET dateModified=?, clientDateModified=? WHERE collectionID=?";
		Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, Zotero.DB.transactionDateTime, this.id])
	}
	
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
 * Compares this collection to another
 *
 * Returns a two-element array containing two objects with the differing values,
 * or FALSE if no differences
 *
 * @param	{Zotero.Collection}	collection			Zotero.Collection to compare this item to
 * @param	{Boolean}		includeMatches			Include all fields, even those that aren't different
 * @param	{Boolean}		ignoreOnlyDateModified	If no fields other than dateModified
 *														are different, just return false
 */
Zotero.Collection.prototype.diff = function (collection, includeMatches, ignoreOnlyDateModified) {
	var diff = [];
	var thisData = this.serialize();
	var otherData = collection.serialize();
	var numDiffs = Zotero.Collections.diff(thisData, otherData, diff, includeMatches);
	
	// For the moment, just compare children and increase numDiffs if any differences
	var d1 = Zotero.Utilities.prototype.arrayDiff(
		otherData.childCollections, thisData.childCollections
	);
	var d2 = Zotero.Utilities.prototype.arrayDiff(
		thisData.childCollections, otherData.childCollections
	);
	var d3 = Zotero.Utilities.prototype.arrayDiff(
		otherData.childItems, thisData.childItems
	);
	var d4 = Zotero.Utilities.prototype.arrayDiff(
		thisData.childItems, otherData.childItems
	);
	numDiffs += d1.length + d2.length;
	
	if (d1.length || d2.length) {
		numDiffs += d1.length + d2.length;
		diff[0].childCollections = d1;
		diff[1].childCollections = d2;
	}
	else {
		diff[0].childCollections = [];
		diff[1].childCollections = [];
	}
	
	if (d3.length || d4.length) {
		numDiffs += d3.length + d4.length;
		diff[0].childItems = d3;
		diff[1].childItems = d4;
	}
	else {
		diff[0].childItems = [];
		diff[1].childItems = [];
	}
	
	// DEBUG: ignoreOnlyDateModified wouldn't work if includeMatches was set?
	if (numDiffs == 0 ||
			(ignoreOnlyDateModified && numDiffs == 1
				&& diff[0].primary && diff[0].primary.dateModified)) {
		return false;
	}
	
	return diff;
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
	var childCollections = this.getChildCollections(true);
	var childItems = this.getChildItems(true);
	var obj = {
		primary: {
			collectionID: this.id,
			libraryID: this.libraryID,
			key: this.key,
			dateAdded: this.dateAdded,
			dateModified: this.dateModified
		},
		fields: {
			name: this.name,
			parent: this.parent,
		},
		childCollections: childCollections ? childCollections : [],
		childItems: childItems ? childItems : [],
		descendents: this.id ? this.getDescendents(nested) : []
	};
	return obj;
}


/**
 * Returns an array of descendent collections and items
 *
 * @param	bool		recursive	Descend into subcollections
 * @param	bool		nested		Return multidimensional array with 'children'
 *									nodes instead of flat array
 * @param	string	type			'item', 'collection', or FALSE for both
 * @return	{Object[]}			Array of objects with 'id', 'key',
 *								'type' ('item' or 'collection'), 'parent',
 *								and, if collection, 'name' and the nesting 'level'
 */
Zotero.Collection.prototype.getChildren = function(recursive, nested, type, level) {
	if (!this.id) {
		throw ('Zotero.Collection.getChildren() cannot be called on an unsaved item');
	}
	
	var toReturn = [];
	
	if (!level) {
		level = 1;
	}
	
	// 0 == collection
	// 1 == item
	var children = Zotero.DB.query('SELECT collectionID AS id, '
		+ "0 AS type, collectionName AS collectionName, key "
		+ 'FROM collections WHERE parentCollectionID=?1'
		+ ' UNION SELECT itemID AS id, 1 AS type, NULL AS collectionName, key '
		+ 'FROM collectionItems JOIN items USING (itemID) WHERE collectionID=?1', this.id);
	
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
						key: children[i].key,
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
						key: children[i].key,
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


/**
 * Get the collectionID of the parent collection
 * @return	{Integer}
 */
Zotero.Collection.prototype._getParent = function() {
	if (this._parent !== false) {
		if (!this._parent) {
			return null;
		}
		if (typeof this._parent == 'number') {
			return this._parent;
		}
		var parentCollection = Zotero.Collections.getByLibraryAndKey(this.libraryID, this._parent);
		if (!parentCollection) {
			throw ("Parent collection for keyed parent doesn't exist in Zotero.Collection._getParent()");
		}
		// Replace stored key with id
		this._parent = parentCollection.id;
		return parentCollection.id;
	}
	
	if (!this.id) {
		return false;
	}
	
	var sql = "SELECT parentCollectionID FROM collections WHERE collectionID=?";
	var parentCollectionID = Zotero.DB.valueQuery(sql, this.id);
	if (!parentCollectionID) {
		parentCollectionID = null;
	}
	this._parent = parentCollectionID;
	return parentCollectionID;
}


/**
 * Get the key of the parent collection
 * @return	{String}
 */
Zotero.Collection.prototype._getParentKey = function() {
	if (this._parent !== false) {
		if (!this._parent) {
			return null;
		}
		if (typeof this._parent == 'string') {
			return this._parent;
		}
		var parentCollection = Zotero.Collections.get(this._parent);
		return parentCollection.key;
	}
	
	if (!this.id) {
		return false;
	}
	
	var sql = "SELECT B.key FROM collections A JOIN collections B "
				+ "ON (A.parentCollectionID=B.collectionID) WHERE A.collectionID=?";
	var key = Zotero.DB.valueQuery(sql, this.id);
	if (!key) {
		key = null;
	}
	this._parent = key;
	return key;
}


Zotero.Collection.prototype._setParent = function(parentCollectionID) {
	if (this.id || this.key) {
		if (!this.loaded) {
			this.load(true);
		}
	}
	else {
		this.loaded = true;
	}
	
	var oldParentCollectionID = this._getParent();
	if (oldParentCollectionID == parentCollectionID) {
		Zotero.debug("Parent collection has not changed for collection " + this.id);
		return false;
	}
	
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
	
	this._parent = parentCollectionID ? parseInt(parentCollectionID) : null;
	if (!this._changed) {
		this._changed = {};
	}
	this._changed.parent = true;
	
	return true;
}


Zotero.Collection.prototype._setParentKey = function(parentCollectionKey) {
	if (this.id || this.key) {
		if (!this.loaded) {
			this.load(true);
		}
	}
	else {
		this.loaded = true;
	}
	
	var oldParentCollectionID = this._getParent();
	if (oldParentCollectionID) {
		var parentCollection = Zotero.Collections.get(oldParentCollectionID)
		var oldParentCollectionKey = parentCollection.key;
	}
	else {
		var oldParentCollectionKey = null;
	}
	if (oldParentCollectionKey == parentCollectionKey) {
		Zotero.debug("Parent collection has not changed in Zotero.Collection._setParentKey()");
		return false;
	}
	
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
	
	this._parent = parentCollectionKey ? parentCollectionKey : null;
	if (!this._changed) {
		this._changed = {};
	}
	this._changed.parent = true;
	
	return true;
}


/*
Zotero.Collection.prototype._setChildCollections = function (collectionIDs) {
	this._setChildren('collection', collectionIDs);
}
*/


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
		for each(var id in newIDs) {
			var obj = Zotero[Types].get(id);
			if (!obj) {
				throw (type + ' ' + id + ' not found in Zotero.Collection._setChildren()');
			}
			this['_child' + Types].push(obj);
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
			var col = Zotero.Collections.get(id);
			if (!col) {
				throw ('Collection ' + id + ' not found in Zotero.Collection._loadChildCollections()');
			}
			this._childCollections.push(col);
		}
		this._hasChildCollections = true;
	}
	else {
		this._hasChildCollections = false;
	}
	
	this._childCollectionsLoaded = true;
}

Zotero.Collection.prototype._loadChildItems = function() {
	if (!this.id) {
		//throw ("Collection id not set in Zotero.Collection._loadChildItems()");
		this._childItemsLoaded = true;
		return;
	}
	
	var sql = "SELECT itemID FROM collectionItems WHERE collectionID=? "
		// DEBUG: Fix for child items created via context menu on parent within
		// a collection being added to the current collection
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemNotes WHERE sourceItemID IS NOT NULL) "
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments WHERE sourceItemID IS NOT NULL)";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	
	this._childItems = [];
	
	if (ids) {
		var items = Zotero.Items.get(ids)
		if (items) {
			this._childItems = items;
		}
	}
	
	this._childItemsLoaded = true;
}


/**
 * Invalid child collection cache
 *
 * Note: This is called by Zotero.Collections.refreshChildCollections()
 *
 * @private
 */
Zotero.Collection.prototype._refreshChildCollections = function () {
	this._hasChildCollections = undefined;
	this._childCollectionsLoaded = false;
}


Zotero.Collection.prototype._generateKey = function () {
	return Zotero.ID.getKey();
}
