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


Zotero.DataObjects = function () {
	if (!this._ZDO_object) throw new Error('this._ZDO_object must be set before calling Zotero.DataObjects constructor');
	
	if (!this._ZDO_objects) {
		this._ZDO_objects = Zotero.DataObjectUtilities.getObjectTypePlural(this._ZDO_object);
	}
	if (!this._ZDO_Object) {
		this._ZDO_Object = this._ZDO_object.substr(0, 1).toUpperCase()
			+ this._ZDO_object.substr(1);
	}
	if (!this._ZDO_Objects) {
		this._ZDO_Objects = this._ZDO_objects.substr(0, 1).toUpperCase()
			+ this._ZDO_objects.substr(1);
	}
	
	if (!this._ZDO_id) {
		this._ZDO_id = this._ZDO_object + 'ID';
	}
	
	if (!this._ZDO_table) {
		this._ZDO_table = this._ZDO_objects;
	}
	
	if (!this.ObjectClass) {
		this.ObjectClass = Zotero[this._ZDO_Object];
	}
	
	this._objectCache = {};
	this._objectKeys = {};
	this._objectIDs = {};
	this._loadedLibraries = {};
	this._loadPromise = null;
}

Zotero.DataObjects.prototype._ZDO_idOnly = false;

// Public properties
Zotero.defineProperty(Zotero.DataObjects.prototype, 'idColumn', {
	get: function() { return this._ZDO_id; }
});
Zotero.defineProperty(Zotero.DataObjects.prototype, 'table', {
	get: function() { return this._ZDO_table; }
});

Zotero.defineProperty(Zotero.DataObjects.prototype, 'relationsTable', {
	get: function() { return this._ZDO_object + 'Relations'; }
});

Zotero.defineProperty(Zotero.DataObjects.prototype, 'primaryFields', {
	get: function () { return Object.keys(this._primaryDataSQLParts); }
}, {lazy: true});

Zotero.defineProperty(Zotero.DataObjects.prototype, "_primaryDataSQLWhere", {
	value: "WHERE 1"
});

Zotero.defineProperty(Zotero.DataObjects.prototype, 'primaryDataSQLFrom', {
	get: function() { return " " + this._primaryDataSQLFrom + " " + this._primaryDataSQLWhere; }
}, {lateInit: true});

Zotero.DataObjects.prototype.init = function() {
	return this._loadIDsAndKeys();
}


Zotero.DataObjects.prototype.isPrimaryField = function (field) {
	return this.primaryFields.indexOf(field) != -1;
}


/**
 * Retrieves one or more already-loaded items
 *
 * If an item hasn't been loaded, an error is thrown
 *
 * @param {Array|Integer} ids  An individual object id or an array of object ids
 * @return {Zotero.[Object]|Array<Zotero.[Object]>} A Zotero.[Object], if a scalar id was passed;
 *                                          otherwise, an array of Zotero.[Object]
 */
Zotero.DataObjects.prototype.get = function (ids) {
	if (Array.isArray(ids)) {
		var singleObject = false;
	}
	else {
		var singleObject = true;
		ids = [ids];
	}
	
	var toReturn = [];
	
	for (let i=0; i<ids.length; i++) {
		let id = ids[i];
		// Check if already loaded
		if (!this._objectCache[id]) {
			// If unloaded id is registered, throw an error
			if (this._objectKeys[id]) {
				throw new Zotero.Exception.UnloadedDataException(
					this._ZDO_Object + " " + id + " not yet loaded"
				);
			}
			// Otherwise ignore (which means returning false for a single id)
			else {
				continue;
			}
		}
		toReturn.push(this._objectCache[id]);
	}
	
	// If single id, return the object directly
	if (singleObject) {
		return toReturn.length ? toReturn[0] : false;
	}
	
	return toReturn;
};
	
	
/**
 * Retrieves (and loads, if necessary) one or more items
 *
 * @param {Array|Integer} ids  An individual object id or an array of object ids
 * @param {Object} [options]
 * @param {Boolean} [options.noCache=false] - Don't add object to cache after loading
 * @return {Promise<Zotero.DataObject|Zotero.DataObject[]>} - A promise for either a data object,
 *     if a scalar id was passed, or an array of data objects, if an array of ids was passed
 */
Zotero.DataObjects.prototype.getAsync = Zotero.Promise.coroutine(function* (ids, options) {
	var toLoad = [];
	var toReturn = [];
	
	if (!ids) {
		throw new Error("No arguments provided");
	}
	
	if (options && typeof options != 'object') {
		throw new Error(`'options' must be an object, ${typeof options} given`);
	}
	
	if (Array.isArray(ids)) {
		var singleObject = false;
	}
	else {
		var singleObject = true;
		ids = [ids];
	}
	
	for (let i=0; i<ids.length; i++) {
		let id = ids[i];
		
		if (!Number.isInteger(id)) {
			// TEMP: Re-enable test when removed
			let e = new Error(`${this._ZDO_object} ID '${id}' is not an integer (${typeof id})`);
			Zotero.logError(e);
			id = parseInt(id);
			//throw new Error(`${this._ZDO_object} ID '${id}' is not an integer (${typeof id})`);
		}
		
		// Check if already loaded
		if (this._objectCache[id]) {
			toReturn.push(this._objectCache[id]);
		}
		else {
			toLoad.push(id);
		}
	}
	
	// New object to load
	if (toLoad.length) {
		// Serialize loads
		if (this._loadPromise && this._loadPromise.isPending()) {
			yield this._loadPromise;
		}
		let deferred = Zotero.Promise.defer();
		this._loadPromise = deferred.promise;
		
		let loaded = yield this._load(null, toLoad, options);
		for (let i=0; i<toLoad.length; i++) {
			let id = toLoad[i];
			let obj = loaded[id];
			if (!obj) {
				Zotero.debug(this._ZDO_Object + " " + id + " doesn't exist", 2);
				continue;
			}
			toReturn.push(obj);
		}
		deferred.resolve();
	}
	
	// If single id, return the object directly
	if (singleObject) {
		return toReturn.length ? toReturn[0] : false;
	}
	
	return toReturn;
});


/**
 * Get all loaded objects
 *
 * @return {Zotero.DataObject[]}
 */
Zotero.DataObjects.prototype.getLoaded = function () {
	return Object.keys(this._objectCache).map(id => this._objectCache[id]);
}


Zotero.DataObjects.prototype.getAllIDs = function (libraryID) {
	var sql = `SELECT ${this._ZDO_id} FROM ${this._ZDO_table} WHERE libraryID=?`;
	return Zotero.DB.columnQueryAsync(sql, [libraryID]);
};


Zotero.DataObjects.prototype.getAllKeys = function (libraryID) {
	var sql = "SELECT key FROM " + this._ZDO_table + " WHERE libraryID=?";
	return Zotero.DB.columnQueryAsync(sql, [libraryID]);
};


/**
 * @deprecated - use .libraryKey
 */
Zotero.DataObjects.prototype.makeLibraryKeyHash = function (libraryID, key) {
	Zotero.debug("WARNING: " + this._ZDO_Objects + ".makeLibraryKeyHash() is deprecated -- use .libraryKey instead");
	return libraryID + '_' + key;
}


/**
 * @deprecated - use .libraryKey
 */
Zotero.DataObjects.prototype.getLibraryKeyHash = function (obj) {
	Zotero.debug("WARNING: " + this._ZDO_Objects + ".getLibraryKeyHash() is deprecated -- use .libraryKey instead");
	return this.makeLibraryKeyHash(obj.libraryID, obj.key);
}


Zotero.DataObjects.prototype.parseLibraryKey = function (libraryKey) {
	var [libraryID, key] = libraryKey.split('/');
	return {
		libraryID: parseInt(libraryID),
		key: key
	};
}


/**
 * @deprecated - Use Zotero.DataObjects.parseLibraryKey()
 */
Zotero.DataObjects.prototype.parseLibraryKeyHash = function (libraryKey) {
	Zotero.debug("WARNING: " + this._ZDO_Objects + ".parseLibraryKeyHash() is deprecated -- use .parseLibraryKey() instead");
	var [libraryID, key] = libraryKey.split('_');
	if (!key) {
		return false;
	}
	return {
		libraryID: parseInt(libraryID),
		key: key
	};
}


/**
 * Retrieves an object by its libraryID and key
 *
 * @param	{Integer}		libraryID
 * @param	{String}			key
 * @return	{Zotero.DataObject}			Zotero data object, or FALSE if not found
 */
Zotero.DataObjects.prototype.getByLibraryAndKey = function (libraryID, key, options) {
	var id = this.getIDFromLibraryAndKey(libraryID, key);
	if (!id) {
		return false;
	}
	return Zotero[this._ZDO_Objects].get(id, options);
};


/**
 * Asynchronously retrieves an object by its libraryID and key
 *
 * @param {Integer} - libraryID
 * @param {String} - key
 * @param {Object} [options]
 * @param {Boolean} [options.noCache=false] - Don't add object to cache after loading
 * @return {Promise<Zotero.DataObject>} - Promise for a data object, or FALSE if not found
 */
Zotero.DataObjects.prototype.getByLibraryAndKeyAsync = Zotero.Promise.method(function (libraryID, key, options) {
	var id = this.getIDFromLibraryAndKey(libraryID, key);
	if (!id) {
		return false;
	}
	return Zotero[this._ZDO_Objects].getAsync(id, options);
});


Zotero.DataObjects.prototype.exists = function (id) {
	return !!this.getLibraryAndKeyFromID(id);
}


Zotero.DataObjects.prototype.existsByKey = function (key) {
	return !!this.getIDFromLibraryAndKey(id);
}


/**
 * @return {Object} Object with 'libraryID' and 'key'
 */
Zotero.DataObjects.prototype.getLibraryAndKeyFromID = function (id) {
	var lk = this._objectKeys[id];
	return lk ? { libraryID: lk[0], key: lk[1] } : false;
}


Zotero.DataObjects.prototype.getIDFromLibraryAndKey = function (libraryID, key) {
	if (!libraryID) throw new Error("Library ID not provided");
	// TEMP: Just warn for now
	//if (!key) throw new Error("Key not provided");
	if (!key) Zotero.logError("Key not provided");
	return (this._objectIDs[libraryID] && this._objectIDs[libraryID][key])
		? this._objectIDs[libraryID][key] : false;
}


Zotero.DataObjects.prototype.getOlder = Zotero.Promise.method(function (libraryID, date) {
	if (!date || date.constructor.name != 'Date') {
		throw ("date must be a JS Date in "
			+ "Zotero." + this._ZDO_Objects + ".getOlder()")
	}
	
	var sql = "SELECT ROWID FROM " + this._ZDO_table
		+ " WHERE libraryID=? AND clientDateModified<?";
	return Zotero.DB.columnQueryAsync(sql, [libraryID, Zotero.Date.dateToSQL(date, true)]);
});


Zotero.DataObjects.prototype.getNewer = Zotero.Promise.method(function (libraryID, date, ignoreFutureDates) {
	if (!date || date.constructor.name != 'Date') {
		throw ("date must be a JS Date in "
			+ "Zotero." + this._ZDO_Objects + ".getNewer()")
	}
	
	var sql = "SELECT ROWID FROM " + this._ZDO_table
		+ " WHERE libraryID=? AND clientDateModified>?";
	if (ignoreFutureDates) {
		sql += " AND clientDateModified<=CURRENT_TIMESTAMP";
	}
	return Zotero.DB.columnQueryAsync(sql, [libraryID, Zotero.Date.dateToSQL(date, true)]);
});


/**
 * Gets the latest version for each object of a given type in the given library
 *
 * @return {Promise<Object>} - A promise for an object with object keys as keys and versions
 *                             as properties
 */
Zotero.DataObjects.prototype.getObjectVersions = Zotero.Promise.coroutine(function* (libraryID, keys = null) {
	var versions = {};
	
	if (keys) {
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			keys,
			Zotero.DB.MAX_BOUND_PARAMETERS - 1,
			Zotero.Promise.coroutine(function* (chunk) {
				var sql = "SELECT key, version FROM " + this._ZDO_table
					+ " WHERE libraryID=? AND key IN (" + chunk.map(key => '?').join(', ') + ")";
				var rows = yield Zotero.DB.queryAsync(sql, [libraryID].concat(chunk));
				for (let i = 0; i < rows.length; i++) {
					let row = rows[i];
					versions[row.key] = row.version;
				}
			}.bind(this))
		);
	}
	else {
		let sql = "SELECT key, version FROM " + this._ZDO_table + " WHERE libraryID=?";
		let rows = yield Zotero.DB.queryAsync(sql, [libraryID]);
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			versions[row.key] = row.version;
		}
	}
	
	return versions;
});


/**
 * Bulk-load data type(s) of given objects if not loaded
 *
 * This would generally be used to load necessary data for cross-library search results, since those
 * results might include objects in libraries that haven't yet been loaded.
 *
 * @param {Zotero.DataObject[]} objects
 * @param {String[]} [dataTypes] - Data types to load, defaulting to all types
 * @return {Promise}
 */
Zotero.DataObjects.prototype.loadDataTypes = Zotero.Promise.coroutine(function* (objects, dataTypes) {
	if (!dataTypes) {
		dataTypes = this.ObjectClass.prototype._dataTypes;
	}
	for (let dataType of dataTypes) {
		let typeIDsByLibrary = {};
		for (let obj of objects) {
			if (obj._loaded[dataType]) {
				continue;
			}
			if (!typeIDsByLibrary[obj.libraryID]) {
				typeIDsByLibrary[obj.libraryID] = [];
			}
			typeIDsByLibrary[obj.libraryID].push(obj.id);
		}
		for (let libraryID in typeIDsByLibrary) {
			yield this._loadDataTypeInLibrary(dataType, parseInt(libraryID), typeIDsByLibrary[libraryID]);
		}
	}
});


/**
 * Loads data for a given data type
 * @param {String} dataType
 * @param {Integer} libraryID
 * @param {Integer[]} [ids]
 */
Zotero.DataObjects.prototype._loadDataTypeInLibrary = Zotero.Promise.coroutine(function* (dataType, libraryID, ids) {
	var funcName = "_load" + dataType[0].toUpperCase() + dataType.substr(1)
		// Single data types need an 's' (e.g., 'note' -> 'loadNotes()')
		+ ((dataType.endsWith('s') || dataType.endsWith('Data') ? '' : 's'));
	if (!this[funcName]) {
		throw new Error(`Zotero.${this._ZDO_Objects}.${funcName} is not a function`);
	}
	
	if (ids && ids.length == 0) {
		return;
	}
	
	var t = new Date;
	var libraryName = Zotero.Libraries.get(libraryID).name;
	
	var idSQL = "";
	if (ids) {
		idSQL = " AND " + this.idColumn + " IN (" + ids.map(id => parseInt(id)).join(", ") + ")";
	}
	
	Zotero.debug("Loading " + dataType + " for "
		+ (ids
			? ids.length + " " + (ids.length == 1 ? this._ZDO_object : this._ZDO_objects)
			: this._ZDO_objects)
		+ " in " + libraryName);
	
	yield this[funcName](libraryID, ids ? ids : [], idSQL);
	
	Zotero.debug(`Loaded ${dataType} in ${libraryName} in ${new Date() - t} ms`);
});

Zotero.DataObjects.prototype.loadAll = Zotero.Promise.coroutine(function* (libraryID, ids) {
	var t = new Date();
	var library = Zotero.Libraries.get(libraryID)
	
	Zotero.debug("Loading "
		+ (ids ? ids.length : "all") + " "
		+ (ids && ids.length == 1 ? this._ZDO_object : this._ZDO_objects)
		+ " in " + library.name);
	
	if (!ids) {
		library.setDataLoading(this._ZDO_object);
	}
	
	let dataTypes = this.ObjectClass.prototype._dataTypes;
	for (let i = 0; i < dataTypes.length; i++) {
		yield this._loadDataTypeInLibrary(dataTypes[i], libraryID, ids);
	}
	
	Zotero.debug(`Loaded ${this._ZDO_objects} in ${library.name} in ${new Date() - t} ms`);
	
	if (!ids) {
		library.setDataLoaded(this._ZDO_object);
	}
});


Zotero.DataObjects.prototype._loadPrimaryData = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL, options) {
	var loaded = {};
	
	// If library isn't an integer (presumably false or null), skip it
	if (parseInt(libraryID) != libraryID) {
		libraryID = false;
	}
	
	var sql = this.primaryDataSQL;
	var params = [];
	if (libraryID !== false) {
		sql += ' AND O.libraryID=?';
		params.push(libraryID);
	}
	if (ids.length) {
		sql += ' AND O.' + this._ZDO_id + ' IN (' + ids.join(',') + ')';
	}
	
	yield Zotero.DB.queryAsync(
		sql,
		params,
		{
			onRow: function (row) {
				var id = row.getResultByName(this._ZDO_id);
				var columns = Object.keys(this._primaryDataSQLParts);
				var rowObj = {};
				for (let i=0; i<columns.length; i++) {
					rowObj[columns[i]] = row.getResultByIndex(i);
				}
				var obj;
				
				// Existing object -- reload in place
				if (this._objectCache[id]) {
					this._objectCache[id].loadFromRow(rowObj, true);
					obj = this._objectCache[id];
				}
				// Object doesn't exist -- create new object and stuff in cache
				else {
					obj = this._getObjectForRow(rowObj);
					obj.loadFromRow(rowObj, true);
					if (!options || !options.noCache) {
						this.registerObject(obj);
					}
				}
				loaded[id] = obj;
			}.bind(this)
		}
	);
	
	if (!ids) {
		this._loadedLibraries[libraryID] = true;
		
		// If loading all objects, remove cached objects that no longer exist
		for (let i in this._objectCache) {
			let obj = this._objectCache[i];
			if (libraryID !== false && obj.libraryID !== libraryID) {
				continue;
			}
			if (!loaded[obj.id]) {
				this.unload(obj.id);
			}
		}
		
		if (this._postLoad) {
			this._postLoad(libraryID, ids);
		}
	}
	
	return loaded;
});


Zotero.DataObjects.prototype._loadRelations = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
	if (!this._relationsTable) {
		throw new Error("Relations not supported for " + this._ZDO_objects);
	}
	
	var sql = "SELECT " + this.idColumn + ", predicate, object "
		+ `FROM ${this.table} LEFT JOIN ${this._relationsTable} USING (${this.idColumn}) `
		+ "LEFT JOIN relationPredicates USING (predicateID) "
		+ "WHERE libraryID=?" + idSQL;
	var params = [libraryID];
	
	var lastID;
	var rows = [];
	var setRows = function (id, rows) {
		var obj = this._objectCache[id];
		if (!obj) {
			throw new Error(this._ZDO_Object + " " + id + " not found");
		}
		
		var relations = {};
		function addRel(predicate, object) {
			if (!relations[predicate]) {
				relations[predicate] = [];
			}
			relations[predicate].push(object);
		}
		
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			addRel(row.predicate, row.object);
		}
		
		/*if (this._objectType == 'item') {
			let getURI = Zotero.URI["get" + this._ObjectType + "URI"].bind(Zotero.URI);
			let objectURI = getURI(this);
			
			// Related items are bidirectional, so include any pointing to this object
			let objects = Zotero.Relations.getByPredicateAndObject(
				Zotero.Relations.relatedItemPredicate, objectURI
			);
			for (let i = 0; i < objects.length; i++) {
				addRel(Zotero.Relations.relatedItemPredicate, getURI(objects[i]));
			}
			
			// Also include any owl:sameAs relations pointing to this object
			objects = Zotero.Relations.getByPredicateAndObject(
				Zotero.Relations.linkedObjectPredicate, objectURI
			);
			for (let i = 0; i < objects.length; i++) {
				addRel(Zotero.Relations.linkedObjectPredicate, getURI(objects[i]));
			}
		}*/
		
		// Relations are stored as predicate-object pairs
		obj._relations = this.flattenRelations(relations);
		obj._loaded.relations = true;
		obj._clearChanged('relations');
	}.bind(this);
	
	yield Zotero.DB.queryAsync(
		sql,
		params,
		{
			noCache: ids.length != 1,
			onRow: function (row) {
				let id = row.getResultByIndex(0);
				
				if (lastID && id !== lastID) {
					setRows(lastID, rows);
					rows = [];
				}
				
				lastID = id;
				let predicate = row.getResultByIndex(1);
				// No relations
				if (predicate === null) {
					return;
				}
				rows.push({
					predicate,
					object: row.getResultByIndex(2)
				});
			}.bind(this)
		}
	);
	
	if (lastID) {
		setRows(lastID, rows);
	}
});


/**
 * Flatten API JSON relations object into an array of unique predicate-object pairs
 *
 * @param {Object} relations - Relations object in API JSON format, with predicates as keys
 *                             and arrays of URIs as objects
 * @return {Array[]} - Predicate-object pairs
 */
Zotero.DataObjects.prototype.flattenRelations = function (relations) {
	var relationsFlat = [];
	for (let predicate in relations) {
		let object = relations[predicate];
		if (Array.isArray(object)) {
			object = Zotero.Utilities.arrayUnique(object);
			for (let i = 0; i < object.length; i++) {
				relationsFlat.push([predicate, object[i]]);
			}
		}
		else if (typeof object == 'string') {
			relationsFlat.push([predicate, object]);
		}
		else {
			Zotero.debug(object, 1);
			throw new Error("Invalid relation value");
		}
	}
	return relationsFlat;
}


/**
 * Reload loaded data of loaded objects
 *
 * @param {Array|Number} ids - An id or array of ids
 * @param {Array} [dataTypes] - Data types to reload (e.g., 'primaryData'), or all loaded
 *                              types if not provided
   * @param {Boolean} [reloadUnchanged=false] - Reload even data that hasn't changed internally.
   *                                            This should be set to true for data that was
   *                                            changed externally (e.g., globally renamed tags).
   */
Zotero.DataObjects.prototype.reload = Zotero.Promise.coroutine(function* (ids, dataTypes, reloadUnchanged) {
	ids = Zotero.flattenArguments(ids);
	
	Zotero.debug('Reloading ' + (dataTypes ? '[' + dataTypes.join(', ') + '] for ' : '')
		+ this._ZDO_objects + ' ' + ids);
	
	// If data types not specified, reload loaded data for each object individually.
	// TODO: optimize
	if (!dataTypes) {
		for (let i=0; i<ids.length; i++) {
			if (this._objectCache[ids[i]]) {
				yield this._objectCache[ids[i]].reload(dataTypes, reloadUnchanged);
			}
		}
		return;
	}
	
	for (let dataType of dataTypes) {
		let typeIDsByLibrary = {};
		for (let id of ids) {
			let obj = this._objectCache[id];
			if (!obj || !obj._loaded[dataType] || obj._skipDataTypeLoad[dataType]
					|| (!reloadUnchanged && !obj._changed[dataType])) {
				continue;
			}
			if (!typeIDsByLibrary[obj.libraryID]) {
				typeIDsByLibrary[obj.libraryID] = [];
			}
			typeIDsByLibrary[obj.libraryID].push(id);
		}
		for (let libraryID in typeIDsByLibrary) {
			yield this._loadDataTypeInLibrary(dataType, parseInt(libraryID), typeIDsByLibrary[libraryID]);
		}
	}
	
	return true;
});


Zotero.DataObjects.prototype.reloadAll = function (libraryID) {
	Zotero.debug("Reloading all " + this._ZDO_objects);
	
	// Remove objects not stored in database
	var sql = "SELECT ROWID FROM " + this._ZDO_table;
	var params = [];
	if (libraryID !== undefined) {
		sql += ' WHERE libraryID=?';
		params.push(libraryID);
	}
	return Zotero.DB.columnQueryAsync(sql, params)
	.then(function (ids) {
		for (var id in this._objectCache) {
			if (!ids || ids.indexOf(parseInt(id)) == -1) {
				delete this._objectCache[id];
			}
		}
		
		// Reload data
		this._loadedLibraries[libraryID] = false;
		return this._load(libraryID);
	});
}


Zotero.DataObjects.prototype.registerObject = function (obj) {
	var id = obj.id;
	var libraryID = obj.libraryID;
	var key = obj.key;
	
	//Zotero.debug("Registering " + this._ZDO_object + " " + id + " as " + libraryID + "/" + key);
	if (!this._objectIDs[libraryID]) {
		this._objectIDs[libraryID] = {};
	}
	this._objectIDs[libraryID][key] = id;
	this._objectKeys[id] = [libraryID, key];
	this._objectCache[id] = obj;
	obj._inCache = true;
}

Zotero.DataObjects.prototype.dropDeadObjectsFromCache = function() {
	let ids = [];
	for (let libraryID in this._objectIDs) {
		if (Zotero.Libraries.exists(libraryID)) continue;
		for (let key in this._objectIDs[libraryID]) {
			ids.push(this._objectIDs[libraryID][key]);
		}
	}
	
	this.unload(ids);
}

/**
 * Clear object from internal array
 *
 * @param	int[]	ids		objectIDs
 */
Zotero.DataObjects.prototype.unload = function () {
	var ids = Zotero.flattenArguments(arguments);
	for (var i=0; i<ids.length; i++) {
		let id = ids[i];
		let {libraryID, key} = this.getLibraryAndKeyFromID(id);
		if (key) {
			delete this._objectIDs[libraryID][key];
			delete this._objectKeys[id];
		}
		delete this._objectCache[id];
	}
}


/**
 * Set the version of objects, efficiently
 *
 * @param {Integer[]} ids - Ids of objects to update
 * @param {Boolean} version
 */
Zotero.DataObjects.prototype.updateVersion = Zotero.Promise.method(function (ids, version) {
	if (version != parseInt(version)) {
		throw new Error("'version' must be an integer ('" + version + "' given)");
	}
	version = parseInt(version);
	
	let sql = "UPDATE " + this.table + " SET version=" + version + " "
		+ "WHERE " + this.idColumn + " IN (";
	return Zotero.Utilities.Internal.forEachChunkAsync(
		ids,
		Zotero.DB.MAX_BOUND_PARAMETERS,
		Zotero.Promise.coroutine(function* (chunk) {
			yield Zotero.DB.queryAsync(sql + chunk.map(() => '?').join(', ') + ')', chunk);
			// Update the internal 'version' property of any loaded objects
			for (let i = 0; i < chunk.length; i++) {
				let id = chunk[i];
				let obj = this._objectCache[id];
				if (obj) {
					obj.updateVersion(version, true);
				}
			}
		}.bind(this))
	);
});


/**
 * Set the sync state of objects, efficiently
 *
 * @param {Integer[]} ids - Ids of objects to update
 * @param {Boolean} synced
 */
Zotero.DataObjects.prototype.updateSynced = Zotero.Promise.method(function (ids, synced) {
	let sql = "UPDATE " + this.table + " SET synced=" + (synced ? 1 : 0) + " "
		+ "WHERE " + this.idColumn + " IN (";
	return Zotero.Utilities.Internal.forEachChunkAsync(
		ids,
		Zotero.DB.MAX_BOUND_PARAMETERS,
		Zotero.Promise.coroutine(function* (chunk) {
			yield Zotero.DB.queryAsync(sql + chunk.map(() => '?').join(', ') + ')', chunk);
			// Update the internal 'synced' property of any loaded objects
			for (let i = 0; i < chunk.length; i++) {
				let id = chunk[i];
				let obj = this._objectCache[id];
				if (obj) {
					obj.updateSynced(!!synced, true);
				}
			}
		}.bind(this))
	);
});


Zotero.DataObjects.prototype.isEditable = function (obj) {
	var libraryID = obj.libraryID;
	if (!libraryID) {
		return true;
	}
	
	if (!Zotero.Libraries.get(libraryID).editable) return false;
	
	if (obj.objectType == 'item' && obj.isAttachment()
		&& (obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
		&& !Zotero.Libraries.get(libraryID).filesEditable
	) {
		return false;
	}
	
	return true;
}

Zotero.defineProperty(Zotero.DataObjects.prototype, "primaryDataSQL", {
	get: function () {
		return "SELECT "
		+ Object.keys(this._primaryDataSQLParts).map((val) => this._primaryDataSQLParts[val]).join(', ')
		+ this.primaryDataSQLFrom;
	}
}, {lazy: true});

Zotero.DataObjects.prototype.getPrimaryDataSQLPart = function (part) {
	var sql = this._primaryDataSQLParts[part];
	if (!sql) {
		throw new Error("Invalid primary data SQL part '" + part + "'");
	}
	return sql;
}


/**
 * Delete one or more objects from the database and caches
 *
 * @param {Integer|Integer[]} ids - Object ids
 * @param {Object} [options] - See Zotero.DataObject.prototype.erase
 * @param {Function} [options.onProgress] - f(progress, progressMax)
 * @return {Promise}
 */
Zotero.DataObjects.prototype.erase = Zotero.Promise.coroutine(function* (ids, options = {}) {
	ids = Zotero.flattenArguments(ids);
	yield Zotero.DB.executeTransaction(function* () {
		for (let i = 0; i < ids.length; i++) {
			let obj = yield this.getAsync(ids[i]);
			if (!obj) {
				continue;
			}
			yield obj.erase(options);
			if (options.onProgress) {
				options.onProgress(i + 1, ids.length);
			}
		}
		this.unload(ids);
	}.bind(this));
});


// TEMP: remove
Zotero.DataObjects.prototype._load = Zotero.Promise.coroutine(function* (libraryID, ids, options) {
	var loaded = {};

	// If library isn't an integer (presumably false or null), skip it
	if (parseInt(libraryID) != libraryID) {
		libraryID = false;
	}

	if (libraryID === false && !ids) {
		throw new Error("Either libraryID or ids must be provided");
	}

	if (libraryID !== false && this._loadedLibraries[libraryID]) {
		return loaded;
	}

	var sql = this.primaryDataSQL;
	var params = [];
	if (libraryID !== false) {
		sql += ' AND O.libraryID=?';
		params.push(libraryID);
	}
	if (ids) {
		sql += ' AND O.' + this._ZDO_id + ' IN (' + ids.join(',') + ')';
	}

	var t = new Date();
	yield Zotero.DB.queryAsync(
		sql,
		params,
		{
			onRow: function (row) {
				var id = row.getResultByName(this._ZDO_id);
				var columns = Object.keys(this._primaryDataSQLParts);
				var rowObj = {};
				for (let i=0; i<columns.length; i++) {
					rowObj[columns[i]] = row.getResultByIndex(i);
				}
				var obj;

				// Existing object -- reload in place
				if (this._objectCache[id]) {
					this._objectCache[id].loadFromRow(rowObj, true);
					obj = this._objectCache[id];
				}
				// Object doesn't exist -- create new object and stuff in cache
				else {
					obj = this._getObjectForRow(rowObj);
					obj.loadFromRow(rowObj, true);
					if (!options || !options.noCache) {
						this.registerObject(obj);
					}
				}
				loaded[id] = obj;
			}.bind(this)
		}
	);
	Zotero.debug("Loaded " + this._ZDO_objects + " in " + ((new Date) - t) + "ms");

	if (!ids) {
		this._loadedLibraries[libraryID] = true;

		// If loading all objects, remove cached objects that no longer exist
		for (let i in this._objectCache) {
			let obj = this._objectCache[i];
			if (libraryID !== false && obj.libraryID !== libraryID) {
				continue;
			}
			if (!loaded[obj.id]) {
				this.unload(obj.id);
			}
		}

		if (this._postLoad) {
			this._postLoad(libraryID, ids);
		}
	}

	return loaded;
});



Zotero.DataObjects.prototype._getObjectForRow = function(row) {
	return new Zotero[this._ZDO_Object];
};

Zotero.DataObjects.prototype._loadIDsAndKeys = Zotero.Promise.coroutine(function* () {
	var sql = "SELECT ROWID AS id, libraryID, key FROM " + this._ZDO_table;
	var rows = yield Zotero.DB.queryAsync(sql);
	for (let i=0; i<rows.length; i++) {
		let row = rows[i];
		this._objectKeys[row.id] = [row.libraryID, row.key];
		if (!this._objectIDs[row.libraryID]) {
			this._objectIDs[row.libraryID] = {};
		}
		this._objectIDs[row.libraryID][row.key] = row.id;
	}
});
