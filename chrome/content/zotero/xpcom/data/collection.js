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
	
	this._childCollections = new Set();
	this._childItems = new Set();
	
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
	get: function() { return Zotero.Items; }
});

Zotero.defineProperty(Zotero.Collection.prototype, 'id', {
	get: function() { return this._get('id'); },
	set: function(val) { return this._set('id', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'libraryID', {
	get: function() { return this._get('libraryID'); },
	set: function(val) { return this._set('libraryID', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'key', {
	get: function() { return this._get('key'); },
	set: function(val) { return this._set('key', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'name', {
	get: function() { return this._get('name'); },
	set: function(val) { return this._set('name', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'version', {
	get: function() { return this._get('version'); },
	set: function(val) { return this._set('version', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'synced', {
	get: function() { return this._get('synced'); },
	set: function(val) { return this._set('synced', val); }
});
Zotero.defineProperty(Zotero.Collection.prototype, 'parent', {
	get: function() {
		Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
		return this.parentID;
	},
	set: function(val) {
		Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
		this.parentID = val;
	},
	enumerable: false
});

Zotero.defineProperty(Zotero.Collection.prototype, 'treeViewID', {
	get: function () {
		return "C" + this.id
	}
});

Zotero.defineProperty(Zotero.Collection.prototype, 'treeViewImage', {
	get: function () {
		// Keep in sync with collectionTreeView::getImageSrc()
		if (Zotero.isMac) {
			return `chrome://zotero-platform/content/treesource-collection${Zotero.hiDPISuffix}.png`;
		}
		return "chrome://zotero/skin/treesource-collection" + Zotero.hiDPISuffix + ".png";
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
	this._requireData('childCollections');
	return this._childCollections.size > 0;
}

Zotero.Collection.prototype.hasChildItems = function() {
	this._requireData('childItems');
	return this._childItems.size > 0;
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
		return this._childCollections.values();
	}
	
	// Return Zotero.Collection objects
	return Array.from(this._childCollections).map(id => this.ObjectsClass.get(id));
}


/**
 * Returns child items of this collection
 *
 * @param	{Boolean}	asIDs			Return as itemIDs
 * @param	{Boolean}	includeDeleted	Include items in Trash
 * @return {Zotero.Item[]|Integer[]} - Array of Zotero.Item instances or itemIDs
 */
Zotero.Collection.prototype.getChildItems = function (asIDs, includeDeleted) {
	this._requireData('childItems');
	
	if (this._childItems.size == 0) {
		return [];
	}
	
	// Remove deleted items if necessary
	var childItems = [];
	for (let itemID of this._childItems) {
		let item = this.ChildObjects.get(itemID);
		if (includeDeleted || !item.deleted) {
			childItems.push(item);
		}
	}
	
	// Return itemIDs
	if (asIDs) {
		return childItems.map(item => item.id);
	}
	
	// Return Zotero.Item objects
	return childItems.slice();
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
		
		if (this.id && this.hasDescendent('collection', newParent.id)) {
			throw new Error(`Cannot move collection '${this.name}' into one of its own descendents`);
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

	var collectionID = this._id = this.id ? this.id : Zotero.ID.get('collections');
	
	Zotero.debug("Saving collection " + this.id);
	
	env.sqlColumns.push(
		'collectionName',
		'parentCollectionID'
	);
	env.sqlValues.push(
		{ string: this.name },
		env.parent ? env.parent : null
	);
	
	if (env.sqlColumns.length) {
		if (isNew) {
			env.sqlColumns.unshift('collectionID');
			env.sqlValues.unshift(collectionID ? { int: collectionID } : null);
			
			let placeholders = env.sqlColumns.map(() => '?').join();
			let sql = "INSERT INTO collections (" + env.sqlColumns.join(', ') + ") "
				+ "VALUES (" + placeholders + ")";
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
		}
		else {
			let sql = 'UPDATE collections SET '
				+ env.sqlColumns.map(x => x + '=?').join(', ') + ' WHERE collectionID=?';
			env.sqlValues.push(collectionID ? { int: collectionID } : null);
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
		}
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
			Zotero.Notifier.queue(
				'add', 'collection', this.id, env.notifierData, env.options.notifierQueue
			);
		}
		else {
			Zotero.Notifier.queue(
				'modify', 'collection', this.id, env.notifierData, env.options.notifierQueue
			);
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
Zotero.Collection.prototype.addItem = function (itemID, options) {
	return this.addItems([itemID], options);
}


/**
 * Add multiple items to the collection in batch
 *
 * Requires a transaction
 * Does not require a separate save()
 *
 * @param {Number[]} itemIDs
 * @return {Promise}
 */
Zotero.Collection.prototype.addItems = Zotero.Promise.coroutine(function* (itemIDs, options = {}) {
	options.skipDateModifiedUpdate = true;

	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	var current = this.getChildItems(true);
	
	Zotero.DB.requireTransaction();
	for (let i = 0; i < itemIDs.length; i++) {
		let itemID = itemIDs[i];
		
		if (current && current.indexOf(itemID) != -1) {
			Zotero.debug("Item " + itemID + " already a child of collection " + this.id);
			continue;
		}
		
		let item = this.ChildObjects.get(itemID);
		item.addToCollection(this.id);
		yield item.save(options);
	}
	
	yield this.loadDataType('childItems');
});

/**
 * Remove a item from the collection. The item is not deleted from the library.
 *
 * Requires a transaction
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
	
	var current = this.getChildItems(true, true);
	
	Zotero.DB.requireTransaction();
	for (let i=0; i<itemIDs.length; i++) {
		let itemID = itemIDs[i];
		
		if (current.indexOf(itemID) == -1) {
			Zotero.debug("Item " + itemID + " not a child of collection " + this.id);
			continue;
		}
		
		let item = yield this.ChildObjects.getAsync(itemID);
		item.removeFromCollection(this.id);
		yield item.save({
			skipDateModifiedUpdate: true
		})
	}
});


/**
 * Check if an item belongs to the collection
 *
 * @param {Zotero.Item|Number} item - Item or itemID
 */
Zotero.Collection.prototype.hasItem = function (item) {
	this._requireData('childItems');
	if (item instanceof Zotero.Item) {
		item = item.id;
	}
	return this._childItems.has(item);
}


Zotero.Collection.prototype.hasDescendent = function (type, id) {
	var descendents = this.getDescendents();
	for (var i=0, len=descendents.length; i<len; i++) {
		if (descendents[i].type == type && descendents[i].id == id) {
			return true;
		}
	}
	return false;
};


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
 * Returns an unsaved copy of the collection without id and key
 *
 * Doesn't duplicate subcollections or items, because the collection isn't saved
 */
Zotero.Collection.prototype.clone = function (libraryID) {
	Zotero.debug('Cloning collection ' + this.id);
	
	if (libraryID !== undefined && libraryID !== null && typeof libraryID !== 'number') {
		throw new Error("libraryID must be null or an integer");
	}
	
	if (libraryID === undefined || libraryID === null) {
		libraryID = this.libraryID;
	}
	var sameLibrary = libraryID == this.libraryID;
	
	var newCollection = new Zotero.Collection;
	newCollection.libraryID = libraryID;
	
	var json = this.toJSON();
	if (!sameLibrary) {
		delete json.parentCollection;
		delete json.relations;
	}
	newCollection.fromJSON(json);
	
	return newCollection;
}


/**
* Deletes collection and all descendent collections (and optionally items)
**/
Zotero.Collection.prototype._eraseData = Zotero.Promise.coroutine(function* (env) {
	Zotero.DB.requireTransaction();
	
	var collections = [this.id];
	
	var descendents = this.getDescendents(false, null, true);
	var items = [];
	var libraryHasTrash = Zotero.Libraries.hasTrash(this.libraryID);
	
	var del = [];
	var itemsToUpdate = [];
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
			// Trash/delete items
			if (env.options.deleteItems) {
				del.push(descendents[i].id);
			}
			
			// If item isn't being removed or is just moving to the trash, mark for update
			if (!env.options.deleteItems || libraryHasTrash) {
				itemsToUpdate.push(descendents[i].id);
			}
		}
	}
	if (del.length) {
		if (libraryHasTrash) {
			yield this.ChildObjects.trash(del);
		}
		// If library doesn't have trash, just erase
		else {
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
	
	// Update child collection cache of parent collection
	if (this.parentKey) {
		let parentCollectionID = this.ObjectsClass.getIDFromLibraryAndKey(
			this.libraryID, this.parentKey
		);
		Zotero.DB.addCurrentCallback("commit", function () {
			this.ObjectsClass.unregisterChildCollection(parentCollectionID, this.id);
		}.bind(this));
	}
	
	yield Zotero.Utilities.Internal.forEachChunkAsync(
		collections,
		Zotero.DB.MAX_BOUND_PARAMETERS,
		async function (chunk) {
			var placeholders = chunk.map(() => '?').join();
			
			// Remove item associations for all descendent collections
			await Zotero.DB.queryAsync('DELETE FROM collectionItems WHERE collectionID IN '
				+ '(' + placeholders + ')', chunk);
			
			// Remove parent definitions first for FK check
			await Zotero.DB.queryAsync('UPDATE collections SET parentCollectionID=NULL '
				+ 'WHERE parentCollectionID IN (' + placeholders + ')', chunk);
			
			// And delete all descendent collections
			await Zotero.DB.queryAsync('DELETE FROM collections WHERE collectionID IN '
				+ '(' + placeholders + ')', chunk);
		}
	);
	
	env.deletedObjectIDs = collections;
	
	// Update collection cache for descendant items
	if (itemsToUpdate.length) {
		let deletedCollections = new Set(env.deletedObjectIDs);
		itemsToUpdate.forEach(itemID => {
			let item = Zotero.Items.get(itemID);
			item._collections = item._collections.filter(c => !deletedCollections.has(c));
		});
	}
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


/**
 * Populate the object's data from an API JSON data object
 *
 * If this object is identified (has an id or library/key), loadAllData() must have been called.
 */
Zotero.Collection.prototype.fromJSON = function (json, options = {}) {
	if (options.strict) {
		for (let prop in json) {
			switch (prop) {
			case 'key':
			case 'version':
			case 'name':
			case 'parentCollection':
			case 'relations':
				break;
			
			default:
				let e = new Error(`Unknown collection property '${prop}'`);
				e.name = "ZoteroInvalidDataError";
				throw e;
			}
		}
	}
	
	if (!json.name) {
		throw new Error("'name' property not provided for collection");
	}
	this.name = json.name;
	this.parentKey = json.parentCollection ? json.parentCollection : false;
	
	this.setRelations(json.relations || {});
}


Zotero.Collection.prototype.toJSON = function (options = {}) {
	var env = this._preToJSON(options);
	var mode = env.mode;
	
	var obj = env.obj = {};
	obj.key = this.key;
	obj.version = this.version;
	
	obj.name = this.name;
	obj.parentCollection = this.parentKey ? this.parentKey : false;
	obj.relations = this.getRelations();
	
	return this._postToJSON(env);
}


/**
 * Returns an array of descendent collections and items
 *
 * @param	{Boolean}	[nested=false]		Return multidimensional array with 'children'
 *											nodes instead of flat array
 * @param	{String}	[type]				'item', 'collection', or NULL for both
 * @param	{Boolean}	[includeDeletedItems=false]		Include items in Trash
 * @return	{Object[]} - An array of objects with 'id', 'key', 'type' ('item' or 'collection'),
 *     'parent', and, if collection, 'name' and the nesting 'level'
 */
Zotero.Collection.prototype.getDescendents = function (nested, type, includeDeletedItems, level) {
	if (!this.id) {
		throw new Error('Cannot be called on an unsaved item');
	}
	
	if (!level) {
		level = 1;
	}
	
	if (type) {
		switch (type) {
			case 'item':
			case 'collection':
				break;
			default:
				throw new (`Invalid type '${type}'`);
		}
	}
	
	var collections = Zotero.Collections.getByParent(this.id);
	var children = collections.map(c => ({
		id: c.id,
		name: c.name,
		type: 0,
		key: c.key
	}));
	if (!type || type == 'item') {
		let items = this.getChildItems(false, includeDeletedItems);
		children = children.concat(items.map(i => ({
			id: i.id,
			name: null,
			type: 1,
			key: i.key
		})));
	}
	
	children.sort(function (a, b) {
		if (a.name === null || b.name === null) return 0;
		return Zotero.localeCompare(a.name, b.name)
	});
	
	var toReturn = [];
	for(var i=0, len=children.length; i<len; i++) {
		switch (children[i].type) {
			case 0:
				if (!type || type=='collection') {
					toReturn.push({
						id: children[i].id,
						name: children[i].name,
						key: children[i].key,
						type: 'collection',
						level: level,
						parent: this.id
					});
				}
				
				let child = this.ObjectsClass.get(children[i].id);
				let descendents = child.getDescendents(
					nested, type, includeDeletedItems, level + 1
				);
				
				if (nested) {
					toReturn[toReturn.length-1].children = descendents;
				}
				else {
					for (var j=0, len2=descendents.length; j<len2; j++) {
						toReturn.push(descendents[j]);
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
};


/**
 * Return a collection in the specified library equivalent to this collection
 *
 * @return {Promise<Zotero.Collection>}
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
/**
 * Add a collection to the cached child collections list if loaded
 */
Zotero.Collection.prototype._registerChildCollection = function (collectionID) {
	if (this._loaded.childCollections) {
		let collection = this.ObjectsClass.get(collectionID);
		if (collection) {
			this._childCollections.add(collectionID);
		}
	}
}


/**
 * Remove a collection from the cached child collections list if loaded
 */
Zotero.Collection.prototype._unregisterChildCollection = function (collectionID) {
	if (this._loaded.childCollections) {
		this._childCollections.delete(collectionID);
	}
}


/**
 * Add an item to the cached child items list if loaded
 */
Zotero.Collection.prototype._registerChildItem = function (itemID) {
	if (this._loaded.childItems) {
		let item = this.ChildObjects.get(itemID);
		if (item) {
			this._childItems.add(itemID);
		}
	}
}


/**
 * Remove an item from the cached child items list if loaded
 */
Zotero.Collection.prototype._unregisterChildItem = function (itemID) {
	if (this._loaded.childItems) {
		this._childItems.delete(itemID);
	}
}
