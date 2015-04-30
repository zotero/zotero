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
 * @property {String|null} parentKey Null if no parent
 * @property {Integer|false|undefined} parentID False if no parent. Undefined if not applicable (e.g. search objects)
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
	
	this._loaded = {};
	this._markAllDataTypeLoadStates(false);
	
	this._clearChanged();
};

Zotero.DataObject.prototype._objectType = 'dataObject';
Zotero.DataObject.prototype._dataTypes = ['primaryData'];

Zotero.defineProperty(Zotero.DataObject.prototype, 'objectType', {
	get: function() this._objectType
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'id', {
	get: function() this._id
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'libraryID', {
	get: function() this._libraryID
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'key', {
	get: function() this._key
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'libraryKey', {
	get: function() this._libraryID + "/" + this._key
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'parentKey', {
	get: function() this._parentKey,
	set: function(v) this._setParentKey(v)
});
Zotero.defineProperty(Zotero.DataObject.prototype, 'parentID', {
	get: function() this._getParentID(),
	set: function(v) this._setParentID(v)
});

Zotero.defineProperty(Zotero.DataObject.prototype, 'ObjectsClass', {
	get: function() this._ObjectsClass
});


Zotero.DataObject.prototype._get = function (field) {
	if (this['_' + field] !== null) {
		return this['_' + field];
	}
	this._requireData('primaryData');
	return null;
}


Zotero.DataObject.prototype._setIdentifier = function (field, value) {
	// If primary data is loaded, the only allowed identifier change is libraryID
	// (allowed mainly for the library switcher in the advanced search window),
	// and then only for unsaved objects (i.e., those without an id or key)
	if (this._loaded.primaryData) {
		if (field != 'libraryID' || this._id || this._key) {
			throw new Error("Cannot set " + field + " after object is already loaded");
		}
	}
	
	switch (field) {
	case 'id':
		if (this._key) {
			throw new Error("Cannot set id if key is already set");
		}
		value = Zotero.DataObjectUtilities.checkDataID(value);
		this._identified = true;
		break;
		
	case 'libraryID':
		value = Zotero.DataObjectUtilities.checkLibraryID(value);
		break;
		
	case 'key':
		if (this._libraryID === null) {
			throw new Error("libraryID must be set before key");
		}
		if (this._id) {
			throw new Error("Cannot set key if id is already set");
		}
		value = Zotero.DataObjectUtilities.checkKey(value);
		this._identified = true;
	}
	
	if (value === this['_' + field]) {
		return;
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
		: null
	);
}

/**
 * Set the key of the parent object
 *
 * @param {String|null} [key=null]
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype._setParentKey = function(key) {
	key = Zotero.DataObjectUtilities.checkKey(key);
	
	if (this._parentKey == key) {
		return false;
	}
	this._markFieldChange('parentKey', this._parentKey);
	this._changed.parentKey = true;
	this._parentKey = key;
	this._parentID = null;
	return true;
}


/**
 * Returns all relations of the object
 *
 * @return {object} Object with predicates as keys and URI[], or URI (as string)
 *   in the case of a single object, as values
 */
Zotero.DataObject.prototype.getRelations = function () {
	this._requireData('relations');
	
	var relations = {};
	for (let i=0; i<this._relations.length; i++) {
		let relation = this._relations[i];
		
		// Relations are stored internally as predicate-object pairs
		let predicate = relation[0];
		if (relations[predicate]) {
			// If object with predicate exists, convert to an array
			if (typeof relations[predicate] == 'string') {
				relations[predicate] = [relations[predicate]];
			}
			// Add new object to array
			relations[predicate].push(relation[1]);
		}
		// Add first object as a string
		else {
			relations[predicate] = relation[1];
		}
	}
	return relations;
}


/**
 * Updates the object's relations
 *
 * @param {Object} newRelations Object with predicates as keys and URI[] as values
 * @return {Boolean} True if changed, false if stayed the same
 */
Zotero.DataObject.prototype.setRelations = function (newRelations) {
	this._requireData('relations');
	
	// There can be more than one object for a given predicate, so build
	// flat arrays with individual predicate-object pairs so we can use
	// array_diff to determine what changed
	var oldRelations = this._relations;
	
	var sortFunc = function (a, b) {
		if (a[0] < b[0]) return -1;
		if (a[0] > b[0]) return 1;
		if (a[1] < b[1]) return -1;
		if (a[1] > b[1]) return 1;
		return 0;
	};
	
	var newRelationsFlat = [];
	for (let predicate in newRelations) {
		let object = newRelations[predicate];
		for (let i=0; i<object.length; i++) {
			newRelationsFlat.push([predicate, object[i]]);
		}
	}
	
	var changed = false;
	if (oldRelations.length != newRelationsFlat.length) {
		changed = true;
	}
	else {
		oldRelations.sort(sortFunc);
		newRelationsFlat.sort(sortFunc);
		
		for (let i=0; i<oldRelations.length; i++) {
			if (oldRelations[i] != newRelationsFlat[i]) {
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
	// Store relations internally as array of predicate-object pairs
	this._relations = newRelationsFlat;
	return true;
}


/**
 * Return an object in the specified library equivalent to this object
 * @param {Integer} [libraryID]
 * @return {Object|false} Linked item, or false if not found
 */
Zotero.DataObject.prototype._getLinkedObject = Zotero.Promise.coroutine(function* (libraryID) {
	if (libraryID == this._libraryID) {
		throw new Error(this._ObjectType + " is already in library " + libraryID);
	}
	
	var predicate = Zotero.Relations.linkedObjectPredicate;
	var uri = Zotero.URI['get' + this._ObjectType + 'URI'](this);
	
	// Get all relations with this object as the subject or object
	var links = yield Zotero.Promise.all([
		Zotero.Relations.getSubject(false, predicate, uri),
		Zotero.Relations.getObject(uri, predicate, false)
	]);
	links = links[0].concat(links[1]);
	
	if (!links.length) {
		return false;
	}
	
	if (libraryID) {
		var libraryObjectPrefix = Zotero.URI.getLibraryURI(libraryID) + "/" + this._objectTypePlural + "/";
	}
	else {
		var libraryObjectPrefix = Zotero.URI.getCurrentUserURI() + "/" + this._objectTypePlural + "/";
	}
	
	for (let i=0; i<links.length; i++) {
		let link = links[i];
		if (link.startsWith(libraryObjectPrefix)) {
			var obj = yield Zotero.URI['getURI' + this._ObjectType](link);
			if (!obj) {
				Zotero.debug("Referenced linked " + this._objectType + " '" + link + "' not found "
					+ "in Zotero." + this._ObjectType + ".getLinked" + this._ObjectType + "()", 2);
				continue;
			}
			return obj;
		}
	}
	return false;
});

/*
 * Build object from database
 */
Zotero.DataObject.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload, failOnMissing) {
	if (this._loaded.primaryData && !reload) return;
	
	var id = this.id;
	var key = this.key;
	var libraryID = this.libraryID;
	
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
		dataTypes = Object.keys(this._loaded).filter(
			val => this._loaded[val]
		);
	}
	
	if (dataTypes && dataTypes.length) {
		for (let i=0; i<dataTypes.length; i++) {
			let dataType = dataTypes[i];
			if (!this._loaded[dataType] || (!reloadUnchanged && !this._changed[dataType])) {
				continue;
			}
			yield this._loadDataType(dataType, true);
		}
	}
});

/**
 * Checks wheteher a given data type has been loaded
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
 */
Zotero.DataObject.prototype._loadDataType = function (dataType, reload) {
	return this["load" + dataType[0].toUpperCase() + dataType.substr(1)](reload);
}

Zotero.DataObject.prototype.loadAllData = function (reload) {
	let loadPromises = new Array(this._dataTypes.length);
	for (let i=0; i<this._dataTypes.length; i++) {
		loadPromises[i] = this._loadDataType(this._dataTypes[i], reload);
	}
	
	return Zotero.Promise.all(loadPromises);
}

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
	// Only save if object already exists and field not already changed
	if (!this.id || typeof this._previousData[field] != 'undefined') {
		return;
	}
	this._previousData[field] = oldValue;
}

/**
 * Clears log of changed values
 * @param {String} [dataType] data type/field to clear. Defaults to clearing everything
 */
Zotero.DataObject.prototype._clearChanged = function (dataType) {
	if (dataType) {
		delete this._changed[dataType];
		delete this._previousData[dataType];
	}
	else {
		this._changed = {};
		this._previousData = {};
	}
}

/**
 * Clears field change log
 * @param {String} field
 */
Zotero.DataObject.prototype._clearFieldChange = function (field) {
	delete this._previousData[field];
}


Zotero.DataObject.prototype.isEditable = function () {
	return Zotero.Libraries.isEditable(this.libraryID);
}


Zotero.DataObject.prototype.editCheck = function () {
	if ((this._objectType == 'collection' || this._objectType == 'search')
			&& Zotero.Libraries.getType(this.libraryID) == 'publications') {
		throw new Error(this._ObjectTypePlural + " cannot be added to My Publications");
	}
	
	if (!Zotero.Sync.Server.updatesInProgress && !Zotero.Sync.Storage.updatesInProgress && !this.isEditable()) {
		throw ("Cannot edit " + this._objectType + " in read-only Zotero library");
	}
}

/**
 * Save changes to database
 *
 * @return {Promise<Integer|Boolean>}  Promise for itemID of new item,
 *                                     TRUE on item update, or FALSE if item was unchanged
 */
Zotero.DataObject.prototype.save = Zotero.Promise.coroutine(function* (options) {
	var env = {
		options: options || {},
		transactionOptions: {}
	};
	
	var proceed = yield this._initSave(env);
	if (!proceed) return false;
	
	if (env.isNew) {
		Zotero.debug('Saving data for new ' + this._objectType + ' to database', 4);
	}
	else {
		Zotero.debug('Updating database with new ' + this._objectType + ' data', 4);
	}
	
	return Zotero.DB.executeTransaction(function* () {
		if (Zotero.DataObject.prototype._finalizeSave == this._finalizeSave) {
			throw new Error("_finalizeSave not implement for Zotero." + this._ObjectType);
		}
		
		env.notifierData = {};
		if (env.options.skipSelect) {
			env.notifierData.skipSelect = true;
		}
		if (!env.isNew) {
			env.changed = this._previousData;
		}
		yield this._saveData(env);
		yield Zotero.DataObject.prototype._finalizeSave.call(this, env);
		return this._finalizeSave(env);
	}.bind(this), env.transactionOptions)
	.catch(e => {
		return this._recoverFromSaveError(env, e)
		.catch(function(e2) {
			Zotero.debug(e2, 1);
		})
		.then(function() {
			Zotero.debug(e, 1);
			throw e;
		})
	});
});

Zotero.DataObject.prototype.hasChanged = function() {
	Zotero.debug(this._changed);
	return !!Object.keys(this._changed).filter(dataType => this._changed[dataType]).length
}

Zotero.DataObject.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	// Default to user library if not specified
	if (this.libraryID === null) {
		this.libraryID = Zotero.Libraries.userLibraryID;
	}
	
	env.isNew = !this.id;
	
	if (!env.options.skipEditCheck) {
		this.editCheck();
	}
	
	if (!this.hasChanged()) {
		Zotero.debug(this._ObjectType + ' ' + this.id + ' has not changed', 4);
		return false;
	}
	
	// Undo registerIdentifiers() on failure
	env.transactionOptions.onRollback = function () {
		this.ObjectsClass.unload(env.id);
	}.bind(this);
	
	return true;
});

Zotero.DataObject.prototype._saveData = function () {
	throw new Error("_saveData is an abstract method");
};

Zotero.DataObject.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	// Register this object's identifiers in Zotero.DataObjects
	if (env.isNew) {
		this.ObjectsClass.registerIdentifiers(env.id, env.libraryID, env.key);
	}
});

Zotero.DataObject.prototype._recoverFromSaveError = Zotero.Promise.coroutine(function* (env) {
	yield this.reload(null, true);
	this._clearChanged();
});


/**
 * Delete object from database
 */
Zotero.DataObject.prototype.erase = Zotero.Promise.coroutine(function* () {
	var env = {};
	
	var proceed = yield this._eraseInit(env);
	if (!proceed) return false;
	
	Zotero.debug('Deleting ' + this.objectType + ' ' + this.id);
	
	yield Zotero.DB.executeTransaction(function* () {
		yield this._eraseData(env);
		yield this._erasePreCommit(env);
	}.bind(this));
	
	return this._erasePostCommit(env);
});

Zotero.DataObject.prototype._eraseInit = function(env) {
	if (!this.id) return Zotero.Promise.resolve(false);
	
	return Zotero.Promise.resolve(true);
};

Zotero.DataObject.prototype._eraseData = function(env) {
	throw new Error("Zotero.DataObject.prototype._eraseData is an abstract method");
};

Zotero.DataObject.prototype._erasePreCommit = function(env) {
	return Zotero.Promise.resolve();
};

Zotero.DataObject.prototype._erasePostCommit = function(env) {
	return Zotero.Promise.resolve();
};

/**
 * Generates data object key
 * @return {String} key
 */
Zotero.DataObject.prototype._generateKey = function () {
	return Zotero.Utilities.generateObjectKey();
}
