/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
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

/**
 * @property {String} (readOnly) objectType
 * @property {String} (readOnly) libraryKey
 * @property {String|false|undefined} parentKey - False if no parent, or undefined if not
 *                                                applicable (e.g. search objects)
 * @property {Integer|false|undefined} parentID - False if no parent, or undefined if not
 *                                                applicable (e.g. search objects)
 */

Zotero.DataObject = function () {
	let objectType = this._objectType;
	this._ObjectType = objectType[0].toUpperCase() + objectType.substr(1);
	this._objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	this._ObjectTypePlural = this._objectTypePlural[0].toUpperCase() + this._objectTypePlural.substr(1);
	this._ObjectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
	
	this._id = null;
	this._libraryID = null;
	this._key = null;
	this._dateAdded = null;
	this._dateModified = null;
	this._version = null;
	this._synced = null;
	this._identified = false;
	this._parentID = null;
	this._parentKey = null;
	
	this._relations = [];
	
	// Set in dataObjects.js
	this._inCache = false;
	
	this._loaded = {};
	this._skipDataTypeLoad = {};
	this._markAllDataTypeLoadStates(false);
	
	this._clearChanged();
};

Zotero.DataObject.prototype._objectType = 'dataObject';
Zotero.DataObject.prototype._dataTypes = ['primaryData'];

Zotero.defineProperty(Zotero.DataObject.prototype, 'objectType', {
	get: function() { return this._objectType; }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'id', {
	get: function() { return this._id; }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'libraryID', {
	get: function() { return this._libraryID; }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'library', {
	get: function () {
		return Zotero.Libraries.get(this._libraryID);
	}
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'key', {
	get: function() { return this._key; }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'libraryKey', {
	get: function() { return this._libraryID + "/" + this._key; }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'parentKey', {
	get: function () { return this._getParentKey(); },
	set: function(v) { return this._setParentKey(v); }
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'parentID', {
	get: function() { return this._getParentID(); },
	set: function(v) { return this._setParentID(v); }
});

Zotero.defineProperty(Zotero.DataObject.prototype, '_canHaveParent', {
	value: true
});

Zotero.defineProperty(Zotero.DataObject.prototype, 'ObjectsClass', {
	get: function() { return this._ObjectsClass; }
});


Zotero.DataObject.prototype._get = function (field) {
	if (field != 'id') this._disabledCheck();
	
	if (this['_' + field] !== null) {
		return this['_' + field];
	}
	if (field != 'libraryID' && field != 'key' && field != 'id') {
		this._requireData('primaryData');
	}
	return null;
}


Zotero.DataObject.prototype._set = function (field, value) {
	this._disabledCheck();
	
	if (field == 'id' || field == 'libraryID' || field == 'key') {
		return this._setIdentifier(field, value);
	}
	
	this._requireData('primaryData');
	
	switch (field) {
		case 'name':
			value = value.trim().normalize();
			break;
		
		case 'version':
			value = parseInt(value);
			break;
		
		case 'synced':
			value = !!value;
			break;
	}
	
	if (this['_' + field] != value || field == 'synced') {
		this._markFieldChange(field, this['_' + field]);
		if (!this._changed.primaryData) {
			this._changed.primaryData = {};
		}
		this._changed.primaryData[field] = true;
		
		switch (field) {
			default:
				this['_' + field] = value;
		}
	}
}


Zotero.DataObject.prototype._setIdentifier = function (field, value) {
	switch (field) {
	case 'id':
		value = Zotero.DataObjectUtilities.checkDataID(value);
		if (this._id) {
			if (value === this._id) {
				return;
			}
			throw new Error("ID cannot be changed");
		}
		if (this._key) {
			throw new Error("Cannot set id if key is already set");
		}
		break;
		
	case 'libraryID':
		value = Zotero.DataObjectUtilities.checkLibraryID(value);
		break;
		
	case 'key':
		if (this._libraryID === null) {
			throw new Error("libraryID must be set before key");
		}
		value = Zotero.DataObjectUtilities.checkKey(value);
		if (this._key) {
			if (value === this._key) {
				return;
			}
			throw new Error("Key cannot be changed");
		}
		if (this._id) {
			throw new Error("Cannot set key if id is already set");
		}
	}
	
	if (value === this['_' + field]) {
		return;
	}
	
	// If primary data is loaded, the only allowed identifier change is libraryID, and then only
	// for unidentified objects, and then only either if a libraryID isn't yet set (because
	// primary data gets marked as loaded when fields are set for new items, but some methods
	// (setCollections(), save()) automatically set the user library ID after that if none is
	// specified), or for searches (for the sake of the library switcher in the advanced search
	// window, though that could probably be rewritten)
	if (this._loaded.primaryData) {
		if (!(!this._identified && field == 'libraryID'
				&& (!this._libraryID || this._objectType == 'search'))) {
			throw new Error("Cannot change " + field + " after object is already loaded");
		}
	}
	
	if (field == 'id' || field == 'key') {
		this._identified = true;
	}
	
	this['_' + field] = value;
}


/**
 * Get the id of the parent object
 *
 * @return {Integer|false|undefined}  The id of the parent object, false if none, or undefined
 *                                      on object types to which it doesn't apply (e.g., searches)
 */
Zotero.DataObject.prototype._getParentID = function () {
	if (this._parentID !== null) {
		return this._parentID;
	}
	if (!this._parentKey) {
		if (this._objectType == 'search') {
			return undefined;
		}
		return false;
	}
	return this._parentID = this.ObjectsClass.getIDFromLibraryAndKey(this._libraryID, this._parentKey);
}


/**
 * Set the id of the parent object
 *
 * @param {Number|false} [id=false]
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype._setParentID = function (id) {
	return this._setParentKey(
		id
		? this.ObjectsClass.getLibraryAndKeyFromID(Zotero.DataObjectUtilities.checkDataID(id)).key
		: false
	);
}


Zotero.DataObject.prototype._getParentKey = function () {
	if (!this._canHaveParent) {
		return undefined;
	}
	return this._parentKey ? this._parentKey : false
}

/**
 * Set the key of the parent object
 *
 * @param {String|false} [key=false]
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype._setParentKey = function(key) {
	if (!this._canHaveParent) {
		throw new Error("Cannot set parent key for " + this._objectType);
	}
	
	key = Zotero.DataObjectUtilities.checkKey(key) || false;
	
	if (key === this._parentKey || (!this._parentKey && !key)) {
		return false;
	}
	this._markFieldChange('parentKey', this._parentKey);
	this._changed.parentKey = true;
	this._parentKey = key;
	this._parentID = null;
	return true;
}

//
// Relations
//
/**
 * Returns all relations of the object
 *
 * @return {Object} - Object with predicates as keys and arrays of values
 */
Zotero.DataObject.prototype.getRelations = function () {
	this._requireData('relations');
	
	var relations = {};
	for (let i=0; i<this._relations.length; i++) {
		let rel = this._relations[i];
		// Relations are stored internally as predicate-object pairs
		let p = rel[0];
		if (!relations[p]) {
			relations[p] = [];
		}
		relations[p].push(rel[1]);
	}
	return relations;
}


/**
 * Returns all relations of the object with a given predicate
 *
 * @return {String[]} - URIs linked to this object with the given predicate
 */
Zotero.DataObject.prototype.getRelationsByPredicate = function (predicate) {
	this._requireData('relations');
	
	if (!predicate) {
		throw new Error("Predicate not provided");
	}
	
	var relations = [];
	for (let i=0; i<this._relations.length; i++) {
		let rel = this._relations[i];
		// Relations are stored internally as predicate-object pairs
		let p = rel[0];
		if (p !== predicate) {
			continue;
		}
		relations.push(rel[1]);
	}
	return relations;
}


/**
 * @return {Boolean} - True if the relation has been queued, false if it already exists
 */
Zotero.DataObject.prototype.addRelation = function (predicate, object) {
	this._requireData('relations');
	
	if (!predicate) {
		throw new Error("Predicate not provided");
	}
	if (!object) {
		throw new Error("Object not provided");
	}
	
	for (let i = 0; i < this._relations.length; i++) {
		let rel = this._relations[i];
		if (rel[0] == predicate && rel[1] == object) {
			Zotero.debug("Relation " + predicate + " - " + object + " already exists for "
				+ this._objectType + " " + this.libraryKey);
			return false;
		}
	}
	
	this._markFieldChange('relations', this._relations);
	this._changed.relations = true;
	this._relations.push([predicate, object]);
	return true;
}


Zotero.DataObject.prototype.hasRelation = function (predicate, object) {
	this._requireData('relations');
	
	for (let i = 0; i < this._relations.length; i++) {
		let rel = this._relations[i];
		if (rel[0] == predicate && rel[1] == object) {
			return true
		}
	}
	return false;
}


Zotero.DataObject.prototype.removeRelation = function (predicate, object) {
	this._requireData('relations');
	
	for (let i = 0; i < this._relations.length; i++) {
		let rel = this._relations[i];
		if (rel[0] == predicate && rel[1] == object) {
			Zotero.debug("Removing relation " + predicate + " - " + object + " from "
				+ this._objectType + " " + this.libraryKey);
			this._markFieldChange('relations', this._relations);
			this._changed.relations = true;
			this._relations.splice(i, 1);
			return true;
		}
	}
	
	Zotero.debug("Relation " + predicate + " - " + object + " did not exist for "
		+ this._objectType + " " + this.libraryKey);
	return false;
}


/**
 * Updates the object's relations
 *
 * @param {Object} newRelations Object with predicates as keys and URI[] as values
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype.setRelations = function (newRelations) {
	this._requireData('relations');
	
	if (typeof newRelations != 'object') {
		throw new Error(`Relations must be an object (${typeof newRelations} given)`);
	}
	
	var oldRelations = this._relations;
	
	// Limit predicates to letters and colons for now
	for (let p in newRelations) {
		if (!/^[a-z]+:[a-z]+$/i.test(p)) {
			throw new Error(`Invalid relation predicate '${p}'`);
		}
	}
	
	// Relations are stored internally as a flat array with individual predicate-object pairs,
	// so convert the incoming relations to that
	var newRelationsFlat = this.ObjectsClass.flattenRelations(newRelations);
	
	var changed = false;
	if (oldRelations.length != newRelationsFlat.length) {
		changed = true;
	}
	else {
		let sortFunc = function (a, b) {
			if (a[0] < b[0]) return -1;
			if (a[0] > b[0]) return 1;
			if (a[1] < b[1]) return -1;
			if (a[1] > b[1]) return 1;
			return 0;
		};
		oldRelations.sort(sortFunc);
		newRelationsFlat.sort(sortFunc);
		
		for (let i=0; i<oldRelations.length; i++) {
			if (oldRelations[i][0] != newRelationsFlat[i][0]
					|| oldRelations[i][1] != newRelationsFlat[i][1]) {
				changed = true;
				break;
			}
		}
	}
	
	if (!changed) {
		Zotero.debug("Relations have not changed for " + this._objectType + " " + this.libraryKey, 4);
		return false;
	}
	
	this._markFieldChange('relations', this._relations);
	this._changed.relations = true;
	this._relations = newRelationsFlat;
	return true;
}


/**
 * Return an object in the specified library equivalent to this object
 *
 * Use Zotero.Collection.getLinkedCollection() and Zotero.Item.getLinkedItem() instead of
 * calling this directly.
 *
 * @param {Integer} [libraryID]
 * @return {Promise<Zotero.DataObject|false>} Linked object, or false if not found
 */
Zotero.DataObject.prototype._getLinkedObject = Zotero.Promise.coroutine(function* (libraryID, bidirectional) {
	if (!libraryID) {
		throw new Error("libraryID not provided");
	}
	
	if (libraryID == this._libraryID) {
		throw new Error(this._ObjectType + " is already in library " + libraryID);
	}
	
	var predicate = Zotero.Relations.linkedObjectPredicate;
	var libraryObjectPrefix = Zotero.URI.getLibraryURI(libraryID)
		+ "/" + this._objectTypePlural + "/";
	
	// Try the relations with this as a subject
	var uris = this.getRelationsByPredicate(predicate);
	for (let i = 0; i < uris.length; i++) {
		let uri = uris[i];
		if (uri.startsWith(libraryObjectPrefix)) {
			let obj = yield Zotero.URI['getURI' + this._ObjectType](uri);
			if (!obj) {
				Zotero.debug("Referenced linked " + this._objectType + " '" + uri + "' not found "
					+ "in Zotero." + this._ObjectType + "::getLinked" + this._ObjectType + "()", 2);
				continue;
			}
			return obj;
		}
	}
	
	// Then try relations with this as an object
	if (bidirectional) {
		var thisURI = Zotero.URI['get' + this._ObjectType + 'URI'](this);
		var objects = Zotero.Relations.getByPredicateAndObject(
			this._objectType, predicate, thisURI
		);
		for (let i = 0; i < objects.length; i++) {
			let obj = objects[i];
			if (obj.objectType != this._objectType) {
				Zotero.logError("Found linked object of different type "
					+ "(expected " + this._objectType + ", found " + obj.objectType + ")");
				continue;
			}
			if (obj.libraryID == libraryID) {
				return obj;
			}
		}
	}
	
	return false;
});


/**
 * Add a linked-item relation to a pair of objects
 *
 * A separate save() is not required.
 *
 * @param {Zotero.DataObject} object
 * @param {Promise<Boolean>}
 */
Zotero.DataObject.prototype._addLinkedObject = Zotero.Promise.coroutine(function* (object) {
	if (object.libraryID == this._libraryID) {
		throw new Error("Can't add linked " + this._objectType + " in same library");
	}
	
	var predicate = Zotero.Relations.linkedObjectPredicate;
	var thisURI = Zotero.URI['get' + this._ObjectType + 'URI'](this);
	var objectURI = Zotero.URI['get' + this._ObjectType + 'URI'](object);
	
	var exists = this.hasRelation(predicate, objectURI);
	if (exists) {
		Zotero.debug(this._ObjectTypePlural + " " + this.libraryKey
			+ " and " + object.libraryKey + " are already linked");
		return false;
	}
	
	// If one of the items is a personal library, store relation with that. Otherwise, use
	// current item's library (which in calling code is the new, copied item, since that's what
	// the user definitely has access to).
	var userLibraryID = Zotero.Libraries.userLibraryID;
	if (this.libraryID == userLibraryID || object.libraryID != userLibraryID) {
		this.addRelation(predicate, objectURI);
		yield this.save({
			skipDateModifiedUpdate: true,
			skipSelect: true
		});
	}
	else {
		object.addRelation(predicate, thisURI);
		yield object.save({
			skipDateModifiedUpdate: true,
			skipSelect: true
		});
	}
	
	return true;
});


//
// Bulk data loading functions
//
// These are called by Zotero.DataObjects.prototype.loadDataType().
//
Zotero.DataObject.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload, failOnMissing) {
	if (this._loaded.primaryData && !reload) return;
	
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	
	if (!id && !key) {
		throw new Error('ID or key not set in Zotero.' + this._ObjectType + '.loadPrimaryData()');
	}
	
	var columns = [], join = [], where = [];
	var primaryFields = this.ObjectsClass.primaryFields;
	var idField = this.ObjectsClass.idColumn;
	for (let i=0; i<primaryFields.length; i++) {
		let field = primaryFields[i];
		// If field not already set
		if (field == idField || this['_' + field] === null || reload) {
			columns.push(this.ObjectsClass.getPrimaryDataSQLPart(field));
		}
	}
	if (!columns.length) {
		return;
	}
	
	// This should match Zotero.*.primaryDataSQL, but without
	// necessarily including all columns
	var sql = "SELECT " + columns.join(", ") + this.ObjectsClass.primaryDataSQLFrom;
	if (id) {
		sql += " AND O." + idField + "=? ";
		var params = id;
	}
	else {
		sql += " AND O.key=? AND O.libraryID=? ";
		var params = [key, libraryID];
	}
	sql += (where.length ? ' AND ' + where.join(' AND ') : '');
	var row = yield Zotero.DB.rowQueryAsync(sql, params);
	
	if (!row) {
		if (failOnMissing) {
			throw new Error(this._ObjectType + " " + (id ? id : libraryID + "/" + key)
				+ " not found in Zotero." + this._ObjectType + ".loadPrimaryData()");
		}
		this._clearChanged('primaryData');
		
		// If object doesn't exist, mark all data types as loaded
		this._markAllDataTypeLoadStates(true);
		
		return;
	}
	
	this.loadFromRow(row, reload);
});


/**
 * Reloads loaded, changed data
 *
 * @param {String[]} [dataTypes] - Data types to reload, or all loaded types if not provide
 * @param {Boolean} [reloadUnchanged=false] - Reload even data that hasn't changed internally.
 *                                            This should be set to true for data that was
 *                                            changed externally (e.g., globally renamed tags).
 */
Zotero.DataObject.prototype.reload = Zotero.Promise.coroutine(function* (dataTypes, reloadUnchanged) {
	if (!this._id) {
		return;
	}
	
	if (!dataTypes) {
		dataTypes = Object.keys(this._loaded).filter(type => this._loaded[type]);
	}
	
	if (dataTypes && dataTypes.length) {
		for (let i=0; i<dataTypes.length; i++) {
			let dataType = dataTypes[i];
			if (!this._loaded[dataType] || this._skipDataTypeLoad[dataType]
					|| (!reloadUnchanged && !this._changed[dataType] && !this._dataTypesToReload.has(dataType))) {
				continue;
			}
			yield this.loadDataType(dataType, true);
			this._dataTypesToReload.delete(dataType);
		}
	}
});

/**
 * Checks whether a given data type has been loaded
 *
 * @param {String} [dataType=primaryData] Data type to check
 * @throws {Zotero.DataObjects.UnloadedDataException} If not loaded, unless the
 *   data has not yet been "identified"
 */
Zotero.DataObject.prototype._requireData = function (dataType) {
	if (this._loaded[dataType] === undefined) {
		throw new Error(dataType + " is not a valid data type for " + this._ObjectType + " objects");
	}
	
	if (dataType != 'primaryData') {
		this._requireData('primaryData');
	}
	
	if (!this._identified) {
		this._loaded[dataType] = true;
	}
	else if (!this._loaded[dataType]) {
		throw new Zotero.Exception.UnloadedDataException(
			"'" + dataType + "' not loaded for " + this._objectType + " ("
				+ this._id + "/" + this._libraryID + "/" + this._key + ")",
			dataType
		);
	}
}


/**
 * Loads data for a given data type
 * @param {String} dataType
 * @param {Boolean} reload
 * @param {Promise}
 */
Zotero.DataObject.prototype.loadDataType = function (dataType, reload) {
	return this._ObjectsClass._loadDataTypeInLibrary(dataType, this.libraryID, [this.id]);
}

Zotero.DataObject.prototype.loadAllData = Zotero.Promise.coroutine(function* (reload) {
	for (let i=0; i<this._dataTypes.length; i++) {
		let type = this._dataTypes[i];
		if (!this._skipDataTypeLoad[type]) {
			yield this.loadDataType(type, reload);
		}
	}
});

Zotero.DataObject.prototype._markAllDataTypeLoadStates = function (loaded) {
	for (let i = 0; i < this._dataTypes.length; i++) {
		this._loaded[this._dataTypes[i]] = loaded;
	}
}

/**
 * Save old version of data that's being changed, to pass to the notifier
 * @param {String} field
 * @param {} oldValue
 */
Zotero.DataObject.prototype._markFieldChange = function (field, oldValue) {
	// New method (changedData)
	if (field == 'tags') {
		if (Array.isArray(oldValue)) {
			this._changedData[field] = [...oldValue];
		}
		else {
			this._changedData[field] = oldValue;
		}
		return;
	}
	
	// Only save if object already exists and field not already changed
	if (!this.id || this._previousData[field] !== undefined) {
		return;
	}
	if (Array.isArray(oldValue)) {
		this._previousData[field] = [];
		Object.assign(this._previousData[field], oldValue)
	}
	else {
		this._previousData[field] = oldValue;
	}
}


Zotero.DataObject.prototype.hasChanged = function() {
	var changed = Object.keys(this._changed).filter(dataType => this._changed[dataType])
		.concat(
			Object.keys(this._changedData).filter(dataType => this._changedData[dataType])
		);
	if (changed.length == 1
			&& changed[0] == 'primaryData'
			&& Object.keys(this._changed.primaryData).length == 1
			&& this._changed.primaryData.synced
			&& this._previousData.synced == this._synced) {
		return false;
	}
	return !!changed.length;
}


/**
 * Clears log of changed values
 * @param {String} [dataType] data type/field to clear. Defaults to clearing everything
 */
Zotero.DataObject.prototype._clearChanged = function (dataType) {
	if (dataType) {
		delete this._changed[dataType];
		delete this._previousData[dataType];
		delete this._changedData[dataType];
	}
	else {
		this._changed = {};
		this._previousData = {};
		this._changedData = {};
		this._dataTypesToReload = new Set();
	}
}

/**
 * Clears field change log
 * @param {String} field
 */
Zotero.DataObject.prototype._clearFieldChange = function (field) {
	delete this._previousData[field];
	delete this._changedData[field];
}


/**
 * Mark a data type as requiring a reload when the current save finishes. The changed state is cleared
 * before the new data is saved to the database (so that further updates during the save process don't
 * get lost), so we need to separately keep track of what changed.
 */
Zotero.DataObject.prototype._markForReload = function (dataType) {
	this._dataTypesToReload.add(dataType);
}


Zotero.DataObject.prototype.isEditable = function () {
	return Zotero.Libraries.get(this.libraryID).editable;
}


Zotero.DataObject.prototype.editCheck = function () {
	let library = Zotero.Libraries.get(this.libraryID);
	if ((this._objectType == 'collection' || this._objectType == 'search')
			&& library.libraryType == 'publications') {
		throw new Error(this._ObjectTypePlural + " cannot be added to My Publications");
	}
	
	if (library.libraryType == 'feed') {
		return;
	}
	
	if (!this.isEditable()) {
		throw new Error("Cannot edit " + this._objectType + " in read-only library "
			+ Zotero.Libraries.get(this.libraryID).name);
	}
}

/**
 * Save changes to database
 *
 * @param {Object} [options]
 * @param {Boolean} [options.skipCache] - Don't save add new object to the cache; if set, object
 *                                         is disabled after save
 * @param {Boolean} [options.skipDateModifiedUpdate]
 * @param {Boolean} [options.skipClientDateModifiedUpdate]
 * @param {Boolean} [options.skipNotifier] - Don't trigger Zotero.Notifier events
 * @param {Boolean} [options.skipSelect] - Don't select object automatically in trees
 * @param {Boolean} [options.skipSyncedUpdate] - Don't automatically set 'synced' to false
 * @return {Promise<Integer|Boolean>}  Promise for itemID of new item,
 *                                     TRUE on item update, or FALSE if item was unchanged
 */
Zotero.DataObject.prototype.save = Zotero.Promise.coroutine(function* (options = {}) {
	var env = {
		options: Object.assign({}, options),
		transactionOptions: {}
	};
	
	if (!env.options.tx && !Zotero.DB.inTransaction()) {
		Zotero.logError("save() called on Zotero." + this._ObjectType + " without a wrapping "
			+ "transaction -- use saveTx() instead");
		Zotero.debug((new Error).stack, 2);
		env.options.tx = true;
	}
	
	if (env.options.skipAll) {
		[
			'skipDateModifiedUpdate',
			'skipClientDateModifiedUpdate',
			'skipSyncedUpdate',
			'skipEditCheck',
			'skipNotifier',
			'skipSelect'
		].forEach(x => env.options[x] = true);
	}
	
	var proceed = yield this._initSave(env);
	if (!proceed) return false;
	
	if (env.isNew) {
		Zotero.debug('Saving data for new ' + this._objectType + ' to database', 4);
	}
	else {
		Zotero.debug('Updating database with new ' + this._objectType + ' data', 4);
	}
	
	try {
		if (Zotero.DataObject.prototype._finalizeSave == this._finalizeSave) {
			throw new Error("_finalizeSave not implemented for Zotero." + this._ObjectType);
		}
		
		env.notifierData = {};
		// Pass along any 'notifierData' values
		if (env.options.notifierData) {
			Object.assign(env.notifierData, env.options.notifierData);
		}
		if (env.options.skipSelect) {
			env.notifierData.skipSelect = true;
		}
		if (!env.isNew) {
			env.changed = this._previousData;
		}
		
		// Create transaction
		let result
		if (env.options.tx) {
			result = yield Zotero.DB.executeTransaction(function* () {
				Zotero.DataObject.prototype._saveData.call(this, env);
				yield this._saveData(env);
				yield Zotero.DataObject.prototype._finalizeSave.call(this, env);
				return this._finalizeSave(env);
			}.bind(this), env.transactionOptions);
		}
		// Use existing transaction
		else {
			Zotero.DB.requireTransaction();
			Zotero.DataObject.prototype._saveData.call(this, env);
			yield this._saveData(env);
			yield Zotero.DataObject.prototype._finalizeSave.call(this, env);
			result = this._finalizeSave(env);
		}
		this._postSave(env);
		return result;
	}
	catch(e) {
		return this._recoverFromSaveError(env, e)
		.catch(function(e2) {
			Zotero.debug(e2, 1);
		})
		.then(function() {
			if (env.options.errorHandler) {
				env.options.errorHandler(e);
			}
			else {
				Zotero.logError(e);
			}
			throw e;
		})
	}
});


Zotero.DataObject.prototype.saveTx = function (options = {}) {
	options = Object.assign({}, options);
	options.tx = true;
	return this.save(options);
}


Zotero.DataObject.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	// Default to user library if not specified
	if (this.libraryID === null) {
		this._libraryID = Zotero.Libraries.userLibraryID;
	}
	
	env.isNew = !this.id;
	
	if (!env.options.skipEditCheck) {
		this.editCheck();
	}
	
	let targetLib = Zotero.Libraries.get(this.libraryID);
	if (!targetLib.isChildObjectAllowed(this._objectType)) {
		throw new Error("Cannot add " + this._objectType + " to a " + targetLib.libraryType + " library");
	}
	
	if (!this.hasChanged()) {
		Zotero.debug(this._ObjectType + ' ' + this.id + ' has not changed', 4);
		return false;
	}
	
	// Undo registerObject() on failure
	if (env.isNew) {
		var func = function () {
			this.ObjectsClass.unload(this._id);
		}.bind(this);
		if (env.options.tx) {
			env.transactionOptions.onRollback = func;
		}
		else {
			Zotero.DB.addCurrentCallback("rollback", func);
		}
	}
	
	env.relationsToRegister = [];
	env.relationsToUnregister = [];
	
	return true;
});

Zotero.DataObject.prototype._saveData = function (env) {
	var libraryID = env.libraryID = this.libraryID || Zotero.Libraries.userLibraryID;
	var key = env.key = this._key = this.key ? this.key : this._generateKey();
	
	env.sqlColumns = [];
	env.sqlValues = [];
	
	if (env.isNew) {
		env.sqlColumns.push(
			'libraryID',
			'key'
		);
		env.sqlValues.push(
			libraryID,
			key
		);
	}
	
	if (this._changed.primaryData && this._changed.primaryData.version) {
		env.sqlColumns.push('version');
		env.sqlValues.push(this.version || 0);
	}
	
	if (this._changed.primaryData && this._changed.primaryData.synced) {
		env.sqlColumns.push('synced');
		env.sqlValues.push(this.synced ? 1 : 0);
	}
	// Set synced to 0 by default
	else if (!env.isNew && !env.options.skipSyncedUpdate) {
		env.sqlColumns.push('synced');
		env.sqlValues.push(0);
	}
	
	if (env.isNew || !env.options.skipClientDateModifiedUpdate) {
		env.sqlColumns.push('clientDateModified');
		env.sqlValues.push(Zotero.DB.transactionDateTime);
	}
};

Zotero.DataObject.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	// Relations
	if (this._changed.relations) {
		let toAdd, toRemove;
		// Convert to individual JSON objects, diff, and convert back
		if (this._previousData.relations) {
			let oldRelationsJSON = this._previousData.relations.map(x => JSON.stringify(x));
			let newRelationsJSON = this._relations.map(x => JSON.stringify(x));
			toAdd = Zotero.Utilities.arrayDiff(newRelationsJSON, oldRelationsJSON)
				.map(x => JSON.parse(x));
			toRemove = Zotero.Utilities.arrayDiff(oldRelationsJSON, newRelationsJSON)
				.map(x => JSON.parse(x));
		}
		else {
			toAdd = this._relations;
			toRemove = [];
		}
		
		if (toAdd.length) {
			let sql = "INSERT INTO " + this._objectType + "Relations "
				+ "(" + this._ObjectsClass.idColumn + ", predicateID, object) VALUES ";
			// Convert predicates to ids
			for (let i = 0; i < toAdd.length; i++) {
				toAdd[i][0] = yield Zotero.RelationPredicates.add(toAdd[i][0]);
				env.relationsToRegister.push([toAdd[i][0], toAdd[i][1]]);
			}
			yield Zotero.DB.queryAsync(
				sql + toAdd.map(x => "(?, ?, ?)").join(", "),
				toAdd.map(x => [this.id, x[0], x[1]])
				.reduce((x, y) => x.concat(y))
			);
		}
		
		if (toRemove.length) {
			for (let i = 0; i < toRemove.length; i++) {
				let sql = "DELETE FROM " + this._objectType + "Relations "
					+ "WHERE " + this._ObjectsClass.idColumn + "=? AND predicateID=? AND object=?";
				yield Zotero.DB.queryAsync(
					sql,
					[
						this.id,
						(yield Zotero.RelationPredicates.add(toRemove[i][0])),
						toRemove[i][1]
					]
				);
				env.relationsToUnregister.push([toRemove[i][0], toRemove[i][1]]);
			}
		}
	}
	
	if (env.isNew) {
		if (!env.skipCache) {
			// Register this object's identifiers in Zotero.DataObjects. This has to happen here so
			// that the object exists for the reload() in objects' finalizeSave methods.
			this.ObjectsClass.registerObject(this);
		}
		// If object isn't being reloaded, disable it, since its data may be out of date
		else {
			this._disabled = true;
		}
	}
	else if (env.skipCache) {
		Zotero.logError("skipCache is only for new objects");
	}
});


/**
 * Actions to perform after DB transaction
 */
Zotero.DataObject.prototype._postSave = function (env) {
	for (let i = 0; i < env.relationsToRegister.length; i++) {
		let rel = env.relationsToRegister[i];
		Zotero.debug(rel);
		Zotero.Relations.register(this._objectType, this.id, rel[0], rel[1]);
	}
	for (let i = 0; i < env.relationsToUnregister.length; i++) {
		let rel = env.relationsToUnregister[i];
		Zotero.Relations.unregister(this._objectType, this.id, rel[0], rel[1]);
	}
};


Zotero.DataObject.prototype._recoverFromSaveError = Zotero.Promise.coroutine(function* (env) {
	yield this.reload(null, true);
	this._clearChanged();
});


/**
 * Update object version, efficiently
 *
 * Used by sync code
 *
 * @param {Integer} version
 * @param {Boolean} [skipDB=false]
 */
Zotero.DataObject.prototype.updateVersion = Zotero.Promise.coroutine(function* (version, skipDB) {
	if (!this.id) {
		throw new Error("Cannot update version of unsaved " + this._objectType);
	}
	if (version != parseInt(version)) {
		throw new Error("'version' must be an integer");
	}
	
	this._version = parseInt(version);
	
	if (!skipDB) {
		var cl = this.ObjectsClass;
		var sql = "UPDATE " + cl.table + " SET version=? WHERE " + cl.idColumn + "=?";
		yield Zotero.DB.queryAsync(sql, [parseInt(version), this.id]);
	}
	
	if (this._changed.primaryData && this._changed.primaryData.version) {
		if (Objects.keys(this._changed.primaryData).length == 1) {
			delete this._changed.primaryData;
		}
		else {
			delete this._changed.primaryData.version;
		}
	}
});

/**
 * Update object sync status, efficiently
 *
 * Used by sync code
 *
 * @param {Boolean} synced
 * @param {Boolean} [skipDB=false]
 */
Zotero.DataObject.prototype.updateSynced = Zotero.Promise.coroutine(function* (synced, skipDB) {
	if (!this.id) {
		throw new Error("Cannot update sync status of unsaved " + this._objectType);
	}
	if (typeof synced != 'boolean') {
		throw new Error("'synced' must be a boolean");
	}
	
	this._synced = synced;
	
	if (!skipDB) {
		var cl = this.ObjectsClass;
		var sql = "UPDATE " + cl.table + " SET synced=? WHERE " + cl.idColumn + "=?";
		yield Zotero.DB.queryAsync(sql, [synced ? 1 : 0, this.id]);
	}
	
	if (this._changed.primaryData && this._changed.primaryData.synced) {
		if (Object.keys(this._changed.primaryData).length == 1) {
			delete this._changed.primaryData;
		}
		else {
			delete this._changed.primaryData.synced;
		}
	}
});

/**
 * Delete object from database
 *
 * @param {Object} [options]
 * @param {Boolean} [options.deleteItems] - Move descendant items to trash (Collection only)
 * @param {Boolean} [options.skipDeleteLog] - Don't add to sync delete log
 */
Zotero.DataObject.prototype.erase = Zotero.Promise.coroutine(function* (options = {}) {
	if (!options || typeof options != 'object') {
		throw new Error("'options' must be an object (" + typeof options + ")");
	}
	
	var env = {
		options: Object.assign({}, options)
	};
	
	if (!env.options.tx && !Zotero.DB.inTransaction()) {
		Zotero.logError("erase() called on Zotero." + this._ObjectType + " without a wrapping "
			+ "transaction -- use eraseTx() instead");
		Zotero.debug((new Error).stack, 2);
		env.options.tx = true;
	}
	
	let proceed = yield this._initErase(env);
	if (!proceed) return false;
	
	Zotero.debug('Deleting ' + this.objectType + ' ' + this.id);
	
	if (env.options.tx) {
		return Zotero.DB.executeTransaction(function* () {
			yield this._eraseData(env);
			yield this._finalizeErase(env);
		}.bind(this))
	}
	else {
		Zotero.DB.requireTransaction();
		yield this._eraseData(env);
		yield this._finalizeErase(env);
	}
});

Zotero.DataObject.prototype.eraseTx = function (options) {
	options = options || {};
	options.tx = true;
	return this.erase(options);
};

Zotero.DataObject.prototype._initErase = Zotero.Promise.method(function (env) {
	env.notifierData = {};
	env.notifierData[this.id] = {
		libraryID: this.libraryID,
		key: this.key
	};
	
	if (!env.options.skipEditCheck) this.editCheck();
	
	if (env.options.skipDeleteLog) {
		env.notifierData[this.id].skipDeleteLog = true;
	}
	
	return true;
});

Zotero.DataObject.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	// Delete versions from sync cache
	if (this._objectType != 'feedItem') {
		yield Zotero.Sync.Data.Local.deleteCacheObjectVersions(
			this.objectType, this._libraryID, this._key
		);
	}
	
	Zotero.DB.addCurrentCallback("commit", function () {
		this.ObjectsClass.unload(env.deletedObjectIDs || this.id);
	}.bind(this));
	
	if (!env.options.skipNotifier) {
		Zotero.Notifier.queue(
			'delete',
			this._objectType,
			Object.keys(env.notifierData).map(id => parseInt(id)),
			env.notifierData,
			env.options.notifierQueue
		);
	}
});


Zotero.DataObject.prototype.toResponseJSON = function (options = {}) {
	// TODO: library block?
	
	var json = {
		key: this.key,
		version: this.version,
		meta: {},
		data: this.toJSON(options)
	};
	if (options.version) {
		json.version = json.data.version = options.version;
	}
	return json;
}


Zotero.DataObject.prototype._preToJSON = function (options) {
	var env = { options };
	env.mode = options.mode || 'new';
	if (env.mode == 'patch') {
		if (!options.patchBase) {
			throw new Error("Cannot use patch mode if patchBase not provided");
		}
	}
	else if (options.patchBase) {
		if (options.mode) {
			Zotero.debug("Zotero.Item.toJSON: ignoring provided patchBase in " + env.mode + " mode", 2);
		}
		// If patchBase provided and no explicit mode, use 'patch'
		else {
			env.mode = 'patch';
		}
	}
	return env;
}

Zotero.DataObject.prototype._postToJSON = function (env) {
	if (env.mode == 'patch') {
		env.obj = Zotero.DataObjectUtilities.patch(env.options.patchBase, env.obj);
	}
	if (env.options.includeVersion === false) {
		delete env.obj.version;
	}
	return env.obj;
}


/**
 * Generates data object key
 * @return {String} key
 */
Zotero.DataObject.prototype._generateKey = function () {
	return Zotero.Utilities.generateObjectKey();
}

Zotero.DataObject.prototype._disabledCheck = function () {
	if (this._disabled) {
		Zotero.logError(this._ObjectType + " is disabled -- "
			+ "use Zotero." + this._ObjectTypePlural  + ".getAsync()");
	}
}
