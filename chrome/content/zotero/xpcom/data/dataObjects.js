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
	
	this.primaryDataSQLFrom = " " + this._primaryDataSQLFrom + " " + this._primaryDataSQLWhere;
	
	this._objectCache = {};
	this._objectKeys = {};
	this._objectIDs = {};
	this._loadedLibraries = {};
	this._loadPromise = null;
}

Zotero.DataObjects.prototype._ZDO_idOnly = false;

// Public properties
Zotero.defineProperty(Zotero.DataObjects.prototype, 'idColumn', {
	get: function() this._ZDO_id
});
Zotero.defineProperty(Zotero.DataObjects.prototype, 'table', {
	get: function() this._ZDO_table
});

Zotero.defineProperty(Zotero.DataObjects.prototype, 'primaryFields', {
	get: function () Object.keys(this._primaryDataSQLParts)
}, {lazy: true});


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
			throw new Zotero.Exception.UnloadedDataException(this._ZDO_Object + " " + id + " not yet loaded");
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
 * @return {Zotero.DataObject|Zotero.DataObject[]} - A data object, if a scalar id was passed;
 *                                                   otherwise, an array of data objects
 */
Zotero.DataObjects.prototype.getAsync = Zotero.Promise.coroutine(function* (ids, options) {
	var toLoad = [];
	var toReturn = [];
	
	if (!ids) {
		throw new Error("No arguments provided to " + this._ZDO_Objects + ".get()");
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
Zotero.DataObjects.prototype.getByLibraryAndKeyAsync = Zotero.Promise.coroutine(function* (libraryID, key, options) {
	var id = this.getIDFromLibraryAndKey(libraryID, key);
	if (!id) {
		return false;
	}
	return Zotero[this._ZDO_Objects].getAsync(id, options);
});


Zotero.DataObjects.prototype.exists = function (itemID) {
	return !!this.getLibraryAndKeyFromID(itemID);
}


/**
 * @return {Object} Object with 'libraryID' and 'key'
 */
Zotero.DataObjects.prototype.getLibraryAndKeyFromID = function (id) {
	var lk = this._objectKeys[id];
	return lk ? { libraryID: lk[0], key: lk[1] } : false;
}


Zotero.DataObjects.prototype.getIDFromLibraryAndKey = function (libraryID, key) {
	if (!libraryID) {
		throw new Error("libraryID not provided");
	}
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
 * @param {Integer} libraryID
 * @return {Promise} A promise for an array of object ids
 */
Zotero.DataObjects.prototype.getUnsynced = function (libraryID) {
	var sql = "SELECT " + this._ZDO_id + " FROM " + this._ZDO_table
		+ " WHERE libraryID=? AND synced=0";
	return Zotero.DB.columnQueryAsync(sql, [libraryID]);
}


/**
 * Get JSON from the sync cache that hasn't yet been written to the
 * main object tables
 *
 * @param {Integer} libraryID
 * @return {Promise} A promise for an array of JSON objects
 */
Zotero.DataObjects.prototype.getUnwrittenData = function (libraryID) {
	var sql = "SELECT data FROM syncCache SC "
		+ "LEFT JOIN " + this._ZDO_table + " "
		+ "USING (libraryID) "
		+ "WHERE SC.libraryID=? AND "
		+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
		+ "syncObjectTypes WHERE name='" + this._ZDO_object + "') "
		+ "AND IFNULL(O.version, 0) < SC.version";
	return Zotero.DB.columnQueryAsync(sql, [libraryID]);
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
	
	Zotero.debug('Reloading ' + (dataTypes ? dataTypes + ' for ' : '')
		+ this._ZDO_objects + ' ' + ids);
	
	for (let i=0; i<ids.length; i++) {
		if (this._objectCache[ids[i]]) {
			yield this._objectCache[ids[i]].reload(dataTypes, reloadUnchanged);
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
	
	Zotero.debug("Registering " + this._ZDO_object + " " + id + " as " + libraryID + "/" + key);
	if (!this._objectIDs[libraryID]) {
		this._objectIDs[libraryID] = {};
	}
	this._objectIDs[libraryID][key] = id;
	this._objectKeys[id] = [libraryID, key];
	this._objectCache[id] = obj;
	obj._inCache = true;
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
 * @param {Boolean} synced
 */
Zotero.DataObjects.prototype.updateVersion = Zotero.Promise.method(function (ids, version) {
	if (version != parseInt(version)) {
		throw new Error("'version' must be an integer");
	}
	version = parseInt(version);
	
	let sql = "UPDATE " + this.table + " SET version=" + version + " "
		+ "WHERE " + this.idColumn + " IN (";
	return Zotero.Utilities.Internal.forEachChunkAsync(
		ids,
		Zotero.DB.MAX_BOUND_PARAMETERS,
		function* (chunk) {
			yield Zotero.DB.queryAsync(sql + chunk.map(() => '?').join(', ') + ')', chunk);
			// Update the internal 'version' property of any loaded objects
			for (let i = 0; i < chunk.length; i++) {
				let id = chunk[i];
				let obj = this._objectCache[id];
				if (obj) {
					obj.updateVersion(version, true);
				}
			}
		}.bind(this)
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
		function* (chunk) {
			yield Zotero.DB.queryAsync(sql + chunk.map(() => '?').join(', ') + ')', chunk);
			// Update the internal 'synced' property of any loaded objects
			for (let i = 0; i < chunk.length; i++) {
				let id = chunk[i];
				let obj = this._objectCache[id];
				if (obj) {
					obj.updateSynced(!!synced, true);
				}
			}
		}.bind(this)
	);
});


Zotero.DataObjects.prototype.isEditable = function (obj) {
	var libraryID = obj.libraryID;
	if (!libraryID) {
		return true;
	}
	
	if (!Zotero.Libraries.isEditable(libraryID)) return false;
	
	if (obj.objectType == 'item' && obj.isAttachment()
		&& (obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
		&& !Zotero.Libraries.isFilesEditable(libraryID)
	) {
		return false;
	}
	
	return true;
}


Zotero.DataObjects.prototype.editCheck = function (obj) {
	if (!Zotero.Sync.Server.updatesInProgress && !Zotero.Sync.Storage.updatesInProgress && !this.isEditable(obj)) {
		throw ("Cannot edit " + this._ZDO_object + " in read-only Zotero library");
	}
}

Zotero.defineProperty(Zotero.DataObjects.prototype, "primaryDataSQL", {
	get: function () {
		return "SELECT "
		+ Object.keys(this._primaryDataSQLParts).map((val) => this._primaryDataSQLParts[val]).join(', ')
		+ this.primaryDataSQLFrom;
	}
}, {lazy: true});

Zotero.DataObjects.prototype._primaryDataSQLWhere = "WHERE 1";

Zotero.DataObjects.prototype.getPrimaryDataSQLPart = function (part) {
	var sql = this._primaryDataSQLParts[part];
	if (!sql) {
		throw new Error("Invalid primary data SQL part '" + part + "'");
	}
	return sql;
}


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
	
	// getPrimaryDataSQL() should use "O" for the primary table alias
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
				var id = row.getResultByIndex(this._ZDO_id);
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
					obj = new Zotero[this._ZDO_Object];
					obj.loadFromRow(rowObj, true);
					if (!options || !options.noCache) {
						this._objectCache[id] = obj;
						obj._inCache = true;
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
