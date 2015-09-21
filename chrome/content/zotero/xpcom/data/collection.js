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

Zotero.Collection = function(params = {}) {
	Zotero.Collection._super.apply(this);
	
	this._name = null;
	
	this._hasChildCollections = null;
	this._childCollections = [];
	
	this._hasChildItems = false;
	this._childItems = [];
	
	Zotero.Utilities.assignProps(this, params, ['name', 'libraryID', 'parentID',
		'parentKey', 'lastSync']);
}

Zotero.extendClass(Zotero.DataObject, Zotero.Collection);

Zotero.Collection.prototype._objectType = 'collection';
Zotero.Collection.prototype._dataTypes = Zotero.Collection._super.prototype._dataTypes.concat([
	'childCollections',
	'childItems',
	'relations'
]);

Zotero.defineProperty(Zotero.Collection.prototype, 'ChildObjects', {
	get: function() Zotero.Items
});

Zotero.defineProperty(Zotero.Collection.prototype, 'id', {
	get: function() this._get('id'),
	set: function(val) this._set('id', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'libraryID', {
	get: function() this._get('libraryID'),
	set: function(val) this._set('libraryID', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'key', {
	get: function() this._get('key'),
	set: function(val) this._set('key', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'name', {
	get: function() this._get('name'),
	set: function(val) this._set('name', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'version', {
	get: function() this._get('version'),
	set: function(val) this._set('version', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'synced', {
	get: function() this._get('synced'),
	set: function(val) this._set('synced', val)
});
Zotero.defineProperty(Zotero.Collection.prototype, 'parent', {
	get: function() {
		Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
		return this.parentID;
	},
	set: function(val) {
		Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
		this.parentID = val;
	}
});


Zotero.Collection.prototype.getID = function() {
	Zotero.debug('Collection.getID() deprecated -- use Collection.id');
	return this.id;
}

Zotero.Collection.prototype.getName = function() {
	Zotero.debug('Collection.getName() deprecated -- use Collection.name');
	return this.name;
}


/*
 * Populate collection data from a database row
 */
Zotero.Collection.prototype.loadFromRow = function(row) {
	var primaryFields = this._ObjectsClass.primaryFields;
	for (let i=0; i<primaryFields.length; i++) {
		let col = primaryFields[i];
		try {
			var val = row[col];
		}
		catch (e) {
			Zotero.debug('Skipping missing ' + this._objectType + ' field ' + col);
			continue;
		}
		
		switch (col) {
		case this._ObjectsClass.idColumn:
			col = 'id';
			break;
		
		// Integer
		case 'libraryID':
			val = parseInt(val);
			break;
		
		// Integer or 0
		case 'version':
			val = val ? parseInt(val) : 0;
			break;
		
		// Value or false
		case 'parentKey':
			val = val || false;
			break;
		
		// Integer or false if falsy
		case 'parentID':
			val = val ? parseInt(val) : false;
			break;
		
		// Boolean
		case 'synced':
		case 'hasChildCollections':
		case 'hasChildItems':
			val = !!val;
			break;
		
		default:
			val = val || '';
		}
		
		this['_' + col] = val;
	}
	
	this._childCollectionsLoaded = false;
	this._childItemsLoaded = false;
	
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	this._identified = true;
}


Zotero.Collection.prototype.hasChildCollections = function() {
	if (this._hasChildCollections !== null) {
		return this._hasChildCollections;
	}
	this._requireData('primaryData');
	return false;
}

Zotero.Collection.prototype.hasChildItems = function() {
	if (this._hasChildItems !== null) {
		return this._hasChildItems;
	}
	this._requireData('primaryData');
	return false;
}


/**
 * Returns subcollections of this collection
 *
 * @param {Boolean} [asIDs=false] Return as collectionIDs
 * @return {Zotero.Collection[]|Integer[]}
 */
Zotero.Collection.prototype.getChildCollections = function (asIDs) {
	this._requireData('childCollections');
	
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
 * @param	{Boolean}	asIDs			Return as itemIDs
 * @param	{Boolean}	includeDeleted	Include items in Trash
 * @return {Zotero.Item[]|Integer[]} - Array of Zotero.Item instances or itemIDs,
 *                                     or FALSE if none
 */
Zotero.Collection.prototype.getChildItems = function (asIDs, includeDeleted) {
	this._requireData('childItems');
	
	if (this._childItems.length == 0) {
		return [];
	}
	
	// Remove deleted items if necessary
	var childItems = [];
	for each(var item in this._childItems) {
		if (includeDeleted || !item.deleted) {
			childItems.push(item);
		}
	}
	
	// Return itemIDs
	if (asIDs) {
		var ids = [];
		for each(var item in childItems) {
			ids.push(item.id);
		}
		return ids;
	}
	
	// Return Zotero.Item objects
	var objs = [];
	for each(var item in childItems) {
		objs.push(item);
	}
	return objs;
}

Zotero.Collection.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	if (!this.name) {
		throw new Error(this._ObjectType + ' name is empty');
	}
	
	var proceed = yield Zotero.Collection._super.prototype._initSave.apply(this, arguments);
	if (!proceed) return false;
	
		// Verify parent
	if (this._parentKey) {
		let newParent = yield this.ObjectsClass.getByLibraryAndKeyAsync(
			this.libraryID, this._parentKey
		);
		
		if (!newParent) {
			throw new Error("Cannot set parent to invalid collection " + this._parentKey);
		}
		
		if (newParent.id == this.id) {
			throw new Error('Cannot move collection into itself!');
		}
		
		if (this.id && (yield this.hasDescendent('collection', newParent.id))) {
			throw ('Cannot move collection "' + this.name + '" into one of its own descendents');
		}
		
		env.parent = newParent.id;
	}
	else {
		env.parent = null;
	}
	
	return true;
});

Zotero.Collection.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	var isNew = env.isNew;
	var options = env.options;

	var collectionID = env.id = this._id = this.id ? this.id : yield Zotero.ID.get('collections');
	
	Zotero.debug("Saving collection " + this.id);
	
	env.sqlColumns.push(
		'collectionName',
		'parentCollectionID'
	);
	env.sqlValues.push(
		{ string: this.name },
		env.parent ? env.parent : null
	);
	
	if (isNew) {
		env.sqlColumns.unshift('collectionID');
		env.sqlValues.unshift(collectionID ? { int: collectionID } : null);
		
		let placeholders = env.sqlColumns.map(function () '?').join();
		let sql = "INSERT INTO collections (" + env.sqlColumns.join(', ') + ") "
			+ "VALUES (" + placeholders + ")";
		var insertID = yield Zotero.DB.queryAsync(sql, env.sqlValues);
		if (!collectionID) {
			collectionID = env.id = insertID;
		}
	}
	else {
		let sql = 'UPDATE collections SET '
			+ env.sqlColumns.map(function (x) x + '=?').join(', ') + ' WHERE collectionID=?';
		env.sqlValues.push(collectionID ? { int: collectionID } : null);
		yield Zotero.DB.queryAsync(sql, env.sqlValues);
	}
	
	if (this._changed.parentKey) {
		// Add this item to the parent's cached item lists after commit,
		// if the parent was loaded
		if (this.parentKey) {
			let parentCollectionID = this.ObjectsClass.getIDFromLibraryAndKey(
				this.libraryID, this.parentKey
			);
			Zotero.DB.addCurrentCallback("commit", function () {
				this.ObjectsClass.registerChildCollection(parentCollectionID, collectionID);
			}.bind(this));
		}
		// Remove this from the previous parent's cached collection lists after commit,
		// if the parent was loaded
		if (!isNew && this._previousData.parentKey) {
			let parentCollectionID = this.ObjectsClass.getIDFromLibraryAndKey(
				this.libraryID, this._previousData.parentKey
			);
			Zotero.DB.addCurrentCallback("commit", function () {
				this.ObjectsClass.unregisterChildCollection(parentCollectionID, collectionID);
			}.bind(this));
		}
	}
});

Zotero.Collection.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	if (!env.options.skipNotifier) {
		if (env.isNew) {
			Zotero.Notifier.queue('add', 'collection', this.id, env.notifierData);
		}
		else  {
			Zotero.Notifier.queue('modify', 'collection', this.id, env.notifierData);
		}
	}
	
	if (!env.skipCache) {
		yield this.reload();
		// If new, there's no other data we don't have, so we can mark everything as loaded
		if (env.isNew) {
			this._markAllDataTypeLoadStates(true);
		}
		this._clearChanged();
	}
	
	if (env.isNew) {
		yield Zotero.Libraries.get(this.libraryID).updateCollections();
	}
	
	return env.isNew ? this.id : true;
});


/**
 * @param {Number} itemID
 * @return {Promise}
 */
Zotero.Collection.prototype.addItem = function (itemID) {
	return this.addItems([itemID]);
}


/**
 * Add multiple items to the collection in batch
 *
 * Does not require a separate save()
 *
 * @param {Number[]} itemIDs
 * @return {Promise}
 */
Zotero.Collection.prototype.addItems = Zotero.Promise.coroutine(function* (itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	yield this.loadChildItems();
	var current = this.getChildItems(true);
	
	Zotero.DB.requireTransaction();
	for (let i = 0; i < itemIDs.length; i++) {
		let itemID = itemIDs[i];
		
		if (current && current.indexOf(itemID) != -1) {
			Zotero.debug("Item " + itemID + " already a child of collection " + this.id);
			continue;
		}
		
		let item = yield this.ChildObjects.getAsync(itemID);
		yield item.loadCollections();
		item.addToCollection(this.id);
		yield item.save({
			skipDateModifiedUpdate: true
		});
	}
	
	yield this.loadChildItems(true);
});

/**
 * Remove a item from the collection. The item is not deleted from the library.
 *
 * Does not require a separate save()
 *
 * @return {Promise}
 */
Zotero.Collection.prototype.removeItem = function (itemID) {
	return this.removeItems([itemID]);
}


/**
 * Remove multiple items from the collection in batch.
 * The items are not deleted from the library.
 *
 * Does not require a separate save()
 */
Zotero.Collection.prototype.removeItems = Zotero.Promise.coroutine(function* (itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	yield this.loadChildItems();
	var current = this.getChildItems(true);
	
	return Zotero.DB.executeTransaction(function* () {
		for (let i=0; i<itemIDs.length; i++) {
			let itemID = itemIDs[i];
			
			if (current.indexOf(itemID) == -1) {
				Zotero.debug("Item " + itemID + " not a child of collection " + this.id);
				continue;
			}
			
			let item = yield this.ChildObjects.getAsync(itemID);
			yield item.loadCollections();
			item.removeFromCollection(this.id);
			yield item.save({
				skipDateModifiedUpdate: true
			})
		}
	}.bind(this));
	
	yield this.loadChildItems(true);
});


/**
* Check if an item belongs to the collection
**/
Zotero.Collection.prototype.hasItem = function(itemID) {
	this._requireData('childItems');
	
	for (let i=0; i<this._childItems.length; i++) {
		if (this._childItems[i].id == itemID) {
			return true;
		}
	}
	return false;
}


Zotero.Collection.prototype.hasDescendent = Zotero.Promise.coroutine(function* (type, id) {
	var descendents = yield this.getDescendents();
	for (var i=0, len=descendents.length; i<len; i++) {
		if (descendents[i].type == type && descendents[i].id == id) {
			return true;
		}
	}
	return false;
});


/**
 * Compares this collection to another
 *
 * Returns a two-element array containing two objects with the differing values,
 * or FALSE if no differences
 *
 * @param	{Zotero.Collection}	collection			Zotero.Collection to compare this item to
 * @param	{Boolean}		includeMatches			Include all fields, even those that aren't different
 */
Zotero.Collection.prototype.diff = function (collection, includeMatches) {
	var diff = [];
	var thisData = this.serialize();
	var otherData = collection.serialize();
	var numDiffs = this.ObjectsClass.diff(thisData, otherData, diff, includeMatches);
	
	// For the moment, just compare children and increase numDiffs if any differences
	var d1 = Zotero.Utilities.arrayDiff(
		thisData.childCollections, otherData.childCollections
	);
	var d2 = Zotero.Utilities.arrayDiff(
		otherData.childCollections, thisData.childCollections
	);
	var d3 = Zotero.Utilities.arrayDiff(
		thisData.childItems, otherData.childItems
	);
	var d4 = Zotero.Utilities.arrayDiff(
		otherData.childItems, thisData.childItems
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
	
	if (numDiffs == 0) {
		return false;
	}
	
	return diff;
}


/**
 * Returns an unsaved copy of the collection
 *
 * Does not copy parent collection or child items
 *
 * @param	{Boolean}		[includePrimary=false]
 * @param	{Zotero.Collection} [newCollection=null]
 */
Zotero.Collection.prototype.clone = function (includePrimary, newCollection) {
	Zotero.debug('Cloning collection ' + this.id);
	
	if (newCollection) {
		var sameLibrary = newCollection.libraryID == this.libraryID;
	}
	else {
		var newCollection = new this.constructor;
		var sameLibrary = true;
		
		if (includePrimary) {
			newCollection.id = this.id;
			newCollection.libraryID = this.libraryID;
			newCollection.key = this.key;
			
			// TODO: This isn't used, but if it were, it should probably include
			// parent collection and child items
		}
	}
	
	newCollection.name = this.name;
	
	return newCollection;
}


/**
* Deletes collection and all descendent collections (and optionally items)
**/
Zotero.Collection.prototype._eraseData = Zotero.Promise.coroutine(function* (env) {
	Zotero.DB.requireTransaction();
	
	var collections = [this.id];
	
	var descendents = yield this.getDescendents(false, null, true);
	var items = [];
	
	var del = [];
	for(var i=0, len=descendents.length; i<len; i++) {
		// Descendent collections
		if (descendents[i].type == 'collection') {
			collections.push(descendents[i].id);
			var c = yield this.ObjectsClass.getAsync(descendents[i].id);
			if (c) {
				env.notifierData[c.id] = {
					libraryID: c.libraryID,
					key: c.key
				};
			}
		}
		// Descendent items
		else {
			// Delete items from DB
			if (env.options.deleteItems) {
				del.push(descendents[i].id);
			}
		}
	}
	if (del.length) {
		if (Zotero.Libraries.hasTrash(this.libraryID)) {
			yield this.ChildObjects.trash(del);
		} else {
			Zotero.debug(Zotero.Libraries.getName(this.libraryID) + " library does not have trash. "
				+ this.ChildObjects._ZDO_Objects + " will be erased");
			let options = {};
			Object.assign(options, env.options);
			options.tx = false;
			for (let i=0; i<del.length; i++) {
				let obj = yield this.ChildObjects.getAsync(del[i]);
				yield obj.erase(options);
			}
		}
	}
	
	var placeholders = collections.map(function () '?').join();
	
	// Remove item associations for all descendent collections
	yield Zotero.DB.queryAsync('DELETE FROM collectionItems WHERE collectionID IN '
		+ '(' + placeholders + ')', collections);
	
	// Remove parent definitions first for FK check
	yield Zotero.DB.queryAsync('UPDATE collections SET parentCollectionID=NULL '
		+ 'WHERE parentCollectionID IN (' + placeholders + ')', collections);
	
	// And delete all descendent collections
	yield Zotero.DB.queryAsync ('DELETE FROM collections WHERE collectionID IN '
		+ '(' + placeholders + ')', collections);
	
	// TODO: Update member items
	env.deletedObjectIDs = collections;
});

Zotero.Collection.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.Collection._super.prototype._finalizeErase.call(this, env);
	
	yield Zotero.Libraries.get(this.libraryID).updateCollections();
});

Zotero.Collection.prototype.isCollection = function() {
	return true;
}


Zotero.Collection.prototype.serialize = function(nested) {
	var childCollections = this.getChildCollections(true);
	var childItems = this.getChildItems(true);
	var obj = {
		primary: {
			collectionID: this.id,
			libraryID: this.libraryID,
			key: this.key
		},
		fields: {
			name: this.name,
			parentKey: this.parentKey,
		},
		childCollections: childCollections ? childCollections : [],
		childItems: childItems ? childItems : [],
		descendents: this.id ? this.getDescendents(nested) : []
	};
	return obj;
}


Zotero.Collection.prototype.fromJSON = Zotero.Promise.coroutine(function* (json) {
	yield this.loadAllData();
	
	if (!json.name) {
		throw new Error("'name' property not provided for collection");
	}
	this.name = json.name;
	this.parentKey = json.parentCollection ? json.parentCollection : false;
	
	// TODO
	//this.setRelations(json.relations);
});


Zotero.Collection.prototype.toResponseJSON = Zotero.Promise.coroutine(function* (options = {}) {
	var json = yield this.constructor._super.prototype.toResponseJSON.apply(this, options);
	
	// TODO: library block?
	
	// creatorSummary
	var firstCreator = this.getField('firstCreator');
	if (firstCreator) {
		json.meta.creatorSummary = firstCreator;
	}
	// parsedDate
	var parsedDate = Zotero.Date.multipartToSQL(this.getField('date', true, true));
	if (parsedDate) {
		// 0000?
		json.meta.parsedDate = parsedDate;
	}
	// numChildren
	if (this.isRegularItem()) {
		json.meta.numChildren = this.numChildren();
	}
	return json;
})


Zotero.Collection.prototype.toJSON = Zotero.Promise.coroutine(function* (options = {}) {
	var env = this._preToJSON(options);
	var mode = env.mode;
	
	var obj = env.obj = {};
	obj.key = this.key;
	obj.version = this.version;
	
	obj.name = this.name;
	obj.parentCollection = this.parentKey ? this.parentKey : false;
	obj.relations = {}; // TEMP
	
	return this._postToJSON(env);
});


/**
 * Returns an array of descendent collections and items
 *
 * @param	{Boolean}	[recursive=false]	Descend into subcollections
 * @param	{Boolean}	[nested=false]		Return multidimensional array with 'children'
 *											nodes instead of flat array
 * @param	{String}	[type]				'item', 'collection', or NULL for both
 * @param	{Boolean}	[includeDeletedItems=false]		Include items in Trash
 * @return	{Promise<Object[]>} - A promise for an array of objects with 'id', 'key',
 *   'type' ('item' or 'collection'), 'parent', and, if collection, 'name' and the nesting 'level'
 */
Zotero.Collection.prototype.getChildren = Zotero.Promise.coroutine(function* (recursive, nested, type, includeDeletedItems, level) {
	if (!this.id) {
		throw new Error('Cannot be called on an unsaved item');
	}
	
	var toReturn = [];
	
	if (!level) {
		level = 1;
	}
	
	if (type) {
		switch (type) {
			case 'item':
			case 'collection':
				break;
			default:
				throw ("Invalid type '" + type + "' in Collection.getChildren()");
		}
	}
	
	// 0 == collection
	// 1 == item
	var sql = 'SELECT collectionID AS id, collectionName AS name, '
		+ "0 AS type, collectionName AS collectionName, key "
		+ 'FROM collections WHERE parentCollectionID=?1';
	if (!type || type == 'item') {
		sql += ' UNION SELECT itemID AS id, NULL AS name, 1 AS type, NULL AS collectionName, key '
				+ 'FROM collectionItems JOIN items USING (itemID) WHERE collectionID=?1';
		if (!includeDeletedItems) {
			sql += " AND itemID NOT IN (SELECT itemID FROM deletedItems)";
		}
	}
	var children = yield Zotero.DB.queryAsync(sql, this.id);
	children.sort(function (a, b) {
		if (a.name === null || b.name === null) return 0;
		return Zotero.localeCompare(a.name, b.name)
	});
	
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
					let child = yield this.ObjectsClass.getAsync(children[i].id);
					let descendents = yield child.getChildren(
						true, nested, type, includeDeletedItems, level+1
					);
					
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
});


/**
 * Alias for the recursive mode of getChildren()
 *
 * @return {Promise}
 */
Zotero.Collection.prototype.getDescendents = function (nested, type, includeDeletedItems) {
	return this.getChildren(true, nested, type, includeDeletedItems);
}


/**
 * Return a collection in the specified library equivalent to this collection
 */
Zotero.Collection.prototype.getLinkedCollection = function (libraryID, bidrectional) {
	return this._getLinkedObject(libraryID, bidrectional);
}


/**
 * Add a linked-object relation pointing to the given collection
 *
 * Does not require a separate save()
 */
Zotero.Collection.prototype.addLinkedCollection = Zotero.Promise.coroutine(function* (collection) {
	return this._addLinkedObject(collection);
});


//
// Private methods
//
Zotero.Collection.prototype.reloadHasChildCollections = Zotero.Promise.coroutine(function* () {
	var sql = "SELECT COUNT(*) FROM collections WHERE parentCollectionID=?";
	this._hasChildCollections = !!(yield Zotero.DB.valueQueryAsync(sql, this.id));
});


Zotero.Collection.prototype.loadChildCollections = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.childCollections && !reload) {
		return;
	}
	
	var sql = "SELECT collectionID FROM collections WHERE parentCollectionID=?";
	var ids = yield Zotero.DB.columnQueryAsync(sql, this.id);
	
	this._childCollections = [];
	
	if (ids.length) {
		for each(var id in ids) {
			var col = yield this.ObjectsClass.getAsync(id);
			if (!col) {
				throw new Error('Collection ' + id + ' not found');
			}
			this._childCollections.push(col);
		}
		this._hasChildCollections = true;
	}
	else {
		this._hasChildCollections = false;
	}
	
	this._loaded.childCollections = true;
	this._clearChanged('childCollections');
});


Zotero.Collection.prototype.reloadHasChildItems = Zotero.Promise.coroutine(function* () {
	var sql = "SELECT COUNT(*) FROM collectionItems WHERE collectionID=?";
	this._hasChildItems = !!(yield Zotero.DB.valueQueryAsync(sql, this.id));
});


Zotero.Collection.prototype.loadChildItems = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.childItems && !reload) {
		return;
	}
	
	var sql = "SELECT itemID FROM collectionItems WHERE collectionID=? "
		// DEBUG: Fix for child items created via context menu on parent within
		// a collection being added to the current collection
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL) "
		+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL)";
	var ids = yield Zotero.DB.columnQueryAsync(sql, this.id);
	
	this._childItems = [];
	
	if (ids) {
		var items = yield this.ChildObjects.getAsync(ids);
		if (items) {
			this._childItems = items;
		}
	}
	
	this._loaded.childItems = true;
	this._clearChanged('childItems');
});


/**
 * Add a collection to the cached child collections list if loaded
 */
Zotero.Collection.prototype._registerChildCollection = function (collectionID) {
	if (this._loaded.childCollections) {
		let collection = this.ObjectsClass.get(collectionID);
		if (collection) {
			this._hasChildCollections = true;
			this._childCollections.push(collection);
		}
	}
}


/**
 * Remove a collection from the cached child collections list if loaded
 */
Zotero.Collection.prototype._unregisterChildCollection = function (collectionID) {
	if (this._loaded.childCollections) {
		for (let i = 0; i < this._childCollections.length; i++) {
			if (this._childCollections[i].id == collectionID) {
				this._childCollections.splice(i, 1);
				break;
			}
		}
		this._hasChildCollections = this._childCollections.length > 0;
	}
}


/**
 * Add an item to the cached child items list if loaded
 */
Zotero.Collection.prototype._registerChildItem = function (itemID) {
	if (this._loaded.childItems) {
		let item = this.ChildObjects.get(itemID);
		if (item) {
			this._hasChildItems = true;
			this._childItems.push(item);
		}
	}
}


/**
 * Remove an item from the cached child items list if loaded
 */
Zotero.Collection.prototype._unregisterChildItem = function (itemID) {
	if (this._loaded.childItems) {
		for (let i = 0; i < this._childItems.length; i++) {
			if (this._childItems[i].id == itemID) {
				this._childItems.splice(i, 1);
				break;
			}
		}
		this._hasChildItems = this._childItems.length > 0;
	}
}
