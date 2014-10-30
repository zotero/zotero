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

Zotero.Collection = function() {
	Zotero.Collection._super.apply(this);
	
	this._name = null;
	this._parentID = null;
	this._parentKey = null;
	
	this._hasChildCollections = null;
	this._childCollections = [];
	
	this._hasChildItems = false;
	this._childItems = [];
}

Zotero.Collection._super = Zotero.DataObject;
Zotero.Collection.prototype = Object.create(Zotero.Collection._super.prototype);
Zotero.Collection.constructor = Zotero.Collection;

Zotero.Collection.prototype._objectType = 'collection';
Zotero.Collection.prototype._dataTypes = Zotero.Collection._super.prototype._dataTypes.concat([
	'primaryData',
	'childCollections',
	'childItems'
]);

Zotero.Collection.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Collection.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Collection.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Collection.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Collection.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Collection.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Collection.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Collection.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
// .parentKey and .parentID defined in dataObject.js
Zotero.Collection.prototype.__defineGetter__('version', function () { return this._get('version'); });
Zotero.Collection.prototype.__defineSetter__('version', function (val) { this._set('version', val); });
Zotero.Collection.prototype.__defineGetter__('synced', function () { return this._get('synced'); });
Zotero.Collection.prototype.__defineSetter__('synced', function (val) { this._set('synced', val); });

Zotero.Collection.prototype.__defineGetter__('parent', function (val) {
	Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
	return this.parentID;
});
Zotero.Collection.prototype.__defineSetter__('parent', function (val) {
	Zotero.debug("WARNING: Zotero.Collection.prototype.parent has been deprecated -- use .parentID or .parentKey", 2);
	this.parentID = val;
});

Zotero.Collection.prototype._set = function (field, value) {
	if (field == 'id' || field == 'libraryID' || field == 'key') {
		return this._setIdentifier(field, value);
	}
	
	this._requireData('primaryData');
	
	switch (field) {
		case 'name':
			value = value.trim();
			break;
		
		case 'version':
			value = parseInt(value);
			break;
		
		case 'synced':
			value = !!value;
			break;
	}
	
	if (this['_' + field] != value) {
		this._markFieldChange(field, this['_' + field]);
		this._changed.primaryData = true;
		
		switch (field) {
			default:
				this['_' + field] = value;
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


/*
 * Build collection from database
 */
Zotero.Collection.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.primaryData && !reload) return;
	
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	
	var sql = Zotero.Collections.getPrimaryDataSQL();
	if (id) {
		sql += " AND O.collectionID=?";
		var params = id;
	}
	else {
		sql += " AND O.libraryID=? AND O.key=?";
		var params = [libraryID, key];
	}
	var data = yield Zotero.DB.rowQueryAsync(sql, params);
	
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	
	if (!data) {
		return;
	}
	
	this.loadFromRow(data);
});


/*
 * Populate collection data from a database row
 */
Zotero.Collection.prototype.loadFromRow = function(row) {
	Zotero.debug("Loading collection from row");
	
	for each(let col in Zotero.Collections.primaryFields) {
		if (row[col] === undefined) {
			Zotero.debug('Skipping missing collection field ' + col);
		}
	}
	
	this._id = row.collectionID;
	this._libraryID = parseInt(row.libraryID);
	this._key = row.key;
	this._name = row.name;
	this._parentID = row.parentID || false;
	this._parentKey = row.parentKey || false;
	this._version = parseInt(row.version);
	this._synced = !!row.synced;
	
	this._hasChildCollections = !!row.hasChildCollections;
	this._childCollectionsLoaded = false;
	this._hasChildItems = !!row.hasChildItems;
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
 * @param	bool		asIDs		Return as collectionIDs
 * @return	array				Array of Zotero.Collection instances
 *									or collectionIDs, or FALSE if none
 */
Zotero.Collection.prototype.getChildCollections = function (asIDs) {
	this._requireData('childCollections');
	
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
 * @param	{Boolean}	asIDs			Return as itemIDs
 * @param	{Boolean}	includeDeleted	Include items in Trash
 * @return	{Zotero.Item[]|Integer[]|FALSE}		Array of Zotero.Item instances or itemIDs,
 *												or FALSE if none
 */
Zotero.Collection.prototype.getChildItems = function (asIDs, includeDeleted) {
	this._requireData('childItems');
	
	if (this._childItems.length == 0) {
		return false;
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


Zotero.Collection.prototype.save = Zotero.Promise.coroutine(function* () {
	try {
		Zotero.Collections.editCheck(this);
		
		if (!this.name) {
			throw new Error('Collection name is empty');
		}
		
		if (Zotero.Utilities.isEmpty(this._changed)) {
			Zotero.debug("Collection " + this.id + " has not changed");
			return false;
		}
		
		var isNew = !this.id;
		
		// Register this item's identifiers in Zotero.DataObjects on transaction commit,
		// before other callbacks run
		var collectionID, libraryID, key;
		if (isNew) {
			var transactionOptions = {
				onCommit: function () {
					Zotero.Collections.registerIdentifiers(collectionID, libraryID, key);
				}
			};
		}
		else {
			var transactionOptions = null;
		}
		
		return Zotero.DB.executeTransaction(function* () {
			// how to know if date modified changed (in server code too?)
			
			collectionID = this._id = this.id ? this.id : yield Zotero.ID.get('collections');
			libraryID = this.libraryID;
			key = this._key = this.key ? this.key : this._generateKey();
			
			Zotero.debug("Saving collection " + this.id);
			
			// Verify parent
			if (this._parentKey) {
				let newParent = Zotero.Collections.getByLibraryAndKey(
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
				
				var parent = newParent.id;
			}
			else {
				var parent = null;
			}
			
			var columns = [
				'collectionID',
				'collectionName',
				'parentCollectionID',
				'clientDateModified',
				'libraryID',
				'key',
				'version',
				'synced'
			];
			var sqlValues = [
				collectionID ? { int: collectionID } : null,
				{ string: this.name },
				parent ? parent : null,
				Zotero.DB.transactionDateTime,
				this.libraryID ? this.libraryID : 0,
				key,
				this.version ? this.version : 0,
				this.synced ? 1 : 0
			];
			if (isNew) {
				var placeholders = columns.map(function () '?').join();
				
				var sql = "REPLACE INTO collections (" + columns.join(', ') + ") "
					+ "VALUES (" + placeholders + ")";
				var insertID = yield Zotero.DB.queryAsync(sql, sqlValues);
				if (!collectionID) {
					collectionID = insertID;
				}
			}
			else {
				columns.shift();
				sqlValues.push(sqlValues.shift());
				let sql = 'UPDATE collections SET '
					+ columns.map(function (x) x + '=?').join(', ')
					+ ' WHERE collectionID=?';
				yield Zotero.DB.queryAsync(sql, sqlValues);
			}
			
			if (this._changed.parentKey) {
				var parentIDs = [];
				if (this.id && this._previousData.parentKey) {
					parentIDs.push(Zotero.Collections.getIDFromLibraryAndKey(
						this.libraryID, this._previousData.parentKey
					));
				}
				if (this.parentKey) {
					parentIDs.push(Zotero.Collections.getIDFromLibraryAndKey(
						this.libraryID, this.parentKey
					));
				}
				if (this.id) {
					Zotero.Notifier.trigger('move', 'collection', this.id);
				}
			}
			
			if (isNew && this.libraryID) {
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.libraryID);
				var group = Zotero.Groups.get(groupID);
				group.clearCollectionCache();
			}
			
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
			
			// New collections have to be reloaded via Zotero.Collections.get(), so mark them as disabled
			if (isNew) {
				var id = this.id;
				this._disabled = true;
				return id;
			}
			
			yield this.reload();
			this._clearChanged();
			
			return true;
		}.bind(this), transactionOptions);
	}
	catch (e) {
		try {
			yield this.reload();
			this._clearChanged();
		}
		catch (e2) {
			Zotero.debug(e2, 1);
		}
		
		Zotero.debug(e, 1);
		throw e;
	}
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
	
	return Zotero.DB.executeTransaction(function* () {
		for (let i=0; i<itemIDs.length; i++) {
			let itemID = itemIDs[i];
			
			if (current && current.indexOf(itemID) != -1) {
				Zotero.debug("Item " + itemID + " already a child of collection " + this.id);
				continue;
			}
			
			let item = yield Zotero.Items.getAsync(itemID);
			yield item.loadCollections();
			item.addToCollection(this.id);
			yield item.save({
				skipDateModifiedUpdate: true
			});
		}
	}.bind(this));
	
	yield this.loadChildItems(true);
});

/**
 * Remove a item from the collection. The item is not deleted from the library.
 *
 * Does not require a separate save()
 *
 * @return {Promise}
 */
Zotero.Collection.prototype.removeItem = function (itemIDs) {
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
			
			let item = yield Zotero.Items.getAsync(itemID);
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
	var numDiffs = Zotero.Collections.diff(thisData, otherData, diff, includeMatches);
	
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
		var newCollection = new Zotero.Collection;
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
Zotero.Collection.prototype.erase = function(deleteItems) {
	var collections = [this.id];
	var notifierData = {};
	
	return Zotero.DB.executeTransaction(function* () {
		var descendents = yield this.getDescendents(false, null, true);
		var items = [];
		notifierData[this.id] = { old: this.toJSON() };
		
		var del = [];
		for(var i=0, len=descendents.length; i<len; i++) {
			// Descendent collections
			if (descendents[i].type == 'collection') {
				collections.push(descendents[i].id);
				var c = yield Zotero.Collections.getAsync(descendents[i].id);
				if (c) {
					notifierData[c.id] = { old: c.toJSON() };
				}
			}
			// Descendent items
			else {
				// Delete items from DB
				if (deleteItems) {
					del.push(descendents[i].id);
				}
			}
		}
		if (del.length) {
			yield Zotero.Items.trash(del);
		}
		
		// Remove relations
		var uri = Zotero.URI.getCollectionURI(this);
		yield Zotero.Relations.eraseByURI(uri);
		
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
	}.bind(this))
	.then(function () {
		// Clear deleted collection from internal memory
		Zotero.Collections.unload(collections);
		//return Zotero.Collections.reloadAll();
	})
	.then(function () {
		Zotero.Notifier.trigger('delete', 'collection', collections, notifierData);
	});
}


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


Zotero.Collection.prototype.toJSON = function (options, patch) {
	var obj = {};
	if (options && options.includeKey) {
		obj.collectionKey = this.key;
	}
	if (options && options.includeVersion) {
		obj.collectionVersion = this.version;
	}
	obj.name = this.name;
	obj.parentCollection = this.parentKey ? this.parentKey : false;
	return obj;
}


/**
 * Returns an array of descendent collections and items
 *
 * @param	{Boolean}	[recursive=false]	Descend into subcollections
 * @param	{Boolean}	[nested=false]		Return multidimensional array with 'children'
 *											nodes instead of flat array
 * @param	{String}	[type]				'item', 'collection', or NULL for both
 * @param	{Boolean}	[includeDeletedItems=false]		Include items in Trash
 * @return	{Object[]}			Array of objects with 'id', 'key',
 *								'type' ('item' or 'collection'), 'parent',
 *								and, if collection, 'name' and the nesting 'level'
 */
Zotero.Collection.prototype.getChildren = Zotero.Promise.coroutine(function* (recursive, nested, type, includeDeletedItems, level) {
	if (!this.id) {
		throw ('Zotero.Collection.getChildren() cannot be called on an unsaved item');
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
	var sql = 'SELECT collectionID AS id, '
		+ "0 AS type, collectionName AS collectionName, key "
		+ 'FROM collections WHERE parentCollectionID=?1';
	if (!type || type == 'item') {
		sql += ' UNION SELECT itemID AS id, 1 AS type, NULL AS collectionName, key '
				+ 'FROM collectionItems JOIN items USING (itemID) WHERE collectionID=?1';
		if (!includeDeletedItems) {
			sql += " AND itemID NOT IN (SELECT itemID FROM deletedItems)";
		}
	}
	var children = yield Zotero.DB.queryAsync(sql, this.id);
	
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
					let child = yield Zotero.Collections.getAsync(children[i].id);
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
Zotero.Collection.prototype.getLinkedCollection = function (libraryID) {
	return this._getLinkedObject(libraryID);
};

Zotero.Collection.prototype.addLinkedCollection = Zotero.Promise.coroutine(function* (collection) {
	var url1 = Zotero.URI.getCollectionURI(this);
	var url2 = Zotero.URI.getCollectionURI(collection);
	var predicate = Zotero.Relations.linkedObjectPredicate;
	if ((yield Zotero.Relations.getByURIs(url1, predicate, url2)).length
			|| (yield Zotero.Relations.getByURIs(url2, predicate, url1)).length) {
		Zotero.debug("Collections " + this.key + " and " + collection.key + " are already linked");
		return false;
	}
	
	// If both group libraries, store relation with source group.
	// Otherwise, store with personal library.
	var libraryID = (this.libraryID && collection.libraryID) ? this.libraryID : 0;
	
	yield Zotero.Relations.add(libraryID, url1, predicate, url2);
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
	
	if (ids) {
		for each(var id in ids) {
			var col = yield Zotero.Collections.getAsync(id);
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
		var items = yield Zotero.Items.getAsync(ids)
		if (items) {
			this._childItems = items;
		}
	}
	
	this._loaded.childItems = true;
	this._clearChanged('childItems');
});


/**
 * Invalidate child collection cache, if collections are loaded
 *
 * Note: This is called by Zotero.Collections.refreshChildCollections()
 *
 * @private
 * @return {Promise}
 */
Zotero.Collection.prototype._refreshChildCollections = Zotero.Promise.coroutine(function* () {
	yield this.reloadHasChildCollections();
	if (this._loaded.childCollections) {
		return this.loadChildCollections(true);
	}
});;


/**
 * Invalidate child item cache, if items are loaded
 *
 * Note: This is called by Zotero.Collections.refreshChildItems()
 *
 * @private
 */
Zotero.Collection.prototype._refreshChildItems = Zotero.Promise.coroutine(function* () {
	yield this.reloadHasChildItems();
	if (this._loaded.childItems) {
		return this.loadChildItems(true);
	}
});
