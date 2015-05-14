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
 * @param {Object} options  'noCache': Don't cache loaded objects
 * @return {Zotero.[Object]|Array<Zotero.[Object]>} A Zotero.[Object], if a scalar id was passed;
 *                                          otherwise, an array of Zotero.[Object]
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


Zotero.DataObjects.prototype.getOlder = function (libraryID, date) {
	if (!date || date.constructor.name != 'Date') {
		throw ("date must be a JS Date in "
			+ "Zotero." + this._ZDO_Objects + ".getOlder()")
	}
	
	var sql = "SELECT ROWID FROM " + this._ZDO_table
		+ " WHERE libraryID=? AND clientDateModified<?";
	return Zotero.DB.columnQuery(sql, [libraryID, Zotero.Date.dateToSQL(date, true)]);
}


Zotero.DataObjects.prototype.getNewer = function (libraryID, date, ignoreFutureDates) {
	if (!date || date.constructor.name != 'Date') {
		throw ("date must be a JS Date in "
			+ "Zotero." + this._ZDO_Objects + ".getNewer()")
	}
	
	var sql = "SELECT ROWID FROM " + this._ZDO_table
		+ " WHERE libraryID=? AND clientDateModified>?";
	if (ignoreFutureDates) {
		sql += " AND clientDateModified<=CURRENT_TIMESTAMP";
	}
	return Zotero.DB.columnQuery(sql, [libraryID, Zotero.Date.dateToSQL(date, true)]);
}


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


Zotero.DataObjects.prototype.registerIdentifiers = function (id, libraryID, key) {
	Zotero.debug("Registering " + this._ZDO_object + " " + id + " as " + libraryID + "/" + key);
	if (!this._objectIDs[libraryID]) {
		this._objectIDs[libraryID] = {};
	}
	this._objectIDs[libraryID][key] = id;
	this._objectKeys[id] = [libraryID, key];
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
 * @param {Object} data1 - API JSON of first object
 * @param {Object} data2 - API JSON of second object
 * @param {Array} [ignoreFields] - Fields to ignore
 */
Zotero.DataObjects.prototype.diff = function (data1, data2, ignoreFields) {
	var diff = [{}, {}];
	var numDiffs = 0;
	
	var skipFields = {};
	for (let field of ['key', 'version'].concat(ignoreFields || [])) {
		skipFields[field] = true;
	}
	
	for (var field in data1) {
		if (skipFields[field]) {
			continue;
		}
		
		if (!data1[field] && data1[field] !== 0 && !data2[field] && data2[field] !== 0) {
			continue;
		}
		
		switch (field) {
		case 'creators':
		case 'collections':
		case 'tags':
		case 'relations':
			var changed = this["_diff" + field[0].toUpperCase() + field.substr(1)](
				data1[field], data2[field]
			);
			break;
		
		default:
			var changed = data1[field] !== data2[field];
		}
		
		if (changed) {
			diff[0][field] = data1[field] !== false ? data1[field] : '';
			diff[1][field] = (data2[field] !== false && data2[field] !== undefined)
				? data2[field] : '';
		}
		
		if (changed) {
			//Zotero.debug("Field " + field + " has changed");
			numDiffs++;
		}
		
		skipFields[field] = true;
	}
	
	for (var field in data2) {
		// Skip ignored fields and fields we've already compared
		if (skipFields[field]) {
			continue;
		}
		
		if (!data2[field] && data2[field] !== 0 && !data1[field] && data1[field] !== 0) {
			continue;
		}
		
		switch (field) {
		case 'creators':
		case 'collections':
		case 'tags':
		case 'relations':
			var changed = this["_diff" + field[0].toUpperCase() + field.substr(1)](
				data1[field], data2[field]
			);
			break;
		
		default:
			var changed = data1[field] !== data2[field];
		}
		
		if (changed) {
			diff[0][field] = (data1[field] !== false && data1[field] !== undefined)
				? data1[field] : '';
			diff[1][field] = data2[field] !== false ? data2[field] : '';
		}
		
		if (changed) {
			//Zotero.debug("Field " + field + " has changed");
			numDiffs++;
		}
	}
	
	return numDiffs ? diff : false;
}

Zotero.DataObjects.prototype._diffCreators = function (data1, data2) {
	if (data1.length != data2.length) return false;
	for (let i = 0; i < data1.length; i++) {
		let c1 = Zotero.Creators.cleanData(data1[i]);
		let c2 = Zotero.Creators.cleanData(data2[i]);
		if (c1.lastName !== c2.lastName
				|| c1.firstName !== c2.firstName
				|| c1.fieldMode !== c2.fieldMode
				|| c1.creatorTypeID !== c2.creatorTypeID) {
			return true;
		}
	}
	return false;
}

Zotero.DataObjects.prototype._diffCollections = function (data1, data2) {
	// Child items shouldn't have collections properties, but just in case one does
	if (!data2) return false;
	if (data1.length != data2.length) return false;
	let c1 = data1.concat();
	let c2 = data2.concat();
	c1.sort();
	c2.sort();
	return !Zotero.Utilities.arrayEquals(c1, c2);
}

Zotero.DataObjects.prototype._diffTags = function (data1, data2) {
	if (data1.length != data2.length) return false;
	for (let i = 0; i < data1.length; i++) {
		let t1 = data1[i];
		let t2 = data2[i];
		if (t1.tag !== t2.tag || (t1.type || 0) !== (t2.type || 0)) {
			return false;
		}
	}
	return false;
}

Zotero.DataObjects.prototype._diffRelations = function (data1, data2) {
	var pred1 = Object.keys(data1);
	pred1.sort();
	var pred2 = Object.keys(data2);
	pred2.sort();
	if (!Zotero.Utilities.arrayEquals(pred1, pred2)) return false;
	for (let i in pred1) {
		if (!Zotero.Utilities.arrayEquals(pred1[i], pred2[i])) {
			return true;
		}
	}
	return false;
}


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
