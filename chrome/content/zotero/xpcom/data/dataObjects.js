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


Zotero.DataObjects = function (object, objectPlural, id, table) {
	var self = this;
	
	if (!object) {
		object = '';
	}
	
	// Override these variables in child objects
	this._ZDO_object = object;
	this._ZDO_objects = objectPlural ? objectPlural : object + 's';
	this._ZDO_Object = object.substr(0, 1).toUpperCase() + object.substr(1);
	this._ZDO_Objects = this._ZDO_objects.substr(0, 1).toUpperCase()
							+ this._ZDO_objects.substr(1);
	this._ZDO_id = (id ? id : object) + 'ID';
	this._ZDO_table = table ? table : this._ZDO_objects;
	
	// Certain object types don't have a libary and key and only use an id
	switch (object) {
		case 'relation':
			this._ZDO_idOnly = true;
			break;
			
		default:
			this._ZDO_idOnly = false;
	}
	
	Zotero.defineProperty(this, 'idColumn', {
		get: function() this._ZDO_id
	});
	
	this._objectCache = {};
	this._objectKeys = {};
	this._objectIDs = {};
	this._loadedLibraries = {};
	this._loadPromise = null;
	
	// Public properties
	this.table = this._ZDO_table;
	
	
	this.init = function () {
		return this._loadIDsAndKeys();
	}
	
	
	this.__defineGetter__('primaryFields', function () {
		var primaryFields = Object.keys(this._primaryDataSQLParts);
		
		// Once primary fields have been cached, get rid of getter for speed purposes
		delete this.primaryFields;
		this.primaryFields = primaryFields;
		
		return primaryFields;
	});
	
	
	this.isPrimaryField = function (field) {
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
	this.get = function (ids) {
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
	this.getAsync = Zotero.Promise.coroutine(function* (ids, options) {
		// Serialize loads
		if (this._loadPromise && this._loadPromise.isPending()) {
			yield this._loadPromise;
		}
		var deferred = Zotero.Promise.defer();
		this._loadPromise = deferred.promise;
		
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
		}
		
		deferred.resolve();
		
		// If single id, return the object directly
		if (singleObject) {
			return toReturn.length ? toReturn[0] : false;
		}
		
		return toReturn;
	});
	
	
	/**
	 * @deprecated - use .libraryKey
	 */
	this.makeLibraryKeyHash = function (libraryID, key) {
		Zotero.debug("WARNING: Zotero.DataObjects.makeLibraryKeyHash() is deprecated -- use obj.libraryKey instead");
		return libraryID + '_' + key;
	}
	
	
	/**
	 * @deprecated - use .libraryKey
	 */
	this.getLibraryKeyHash = function (obj) {
		Zotero.debug("WARNING: Zotero.DataObjects.getLibraryKeyHash() is deprecated -- use obj.libraryKey instead");
		return this.makeLibraryKeyHash(obj.libraryID, obj.key);
	}
	
	
	this.parseLibraryKey = function (libraryKey) {
		var [libraryID, key] = libraryKey.split('/');
		return {
			libraryID: parseInt(libraryID),
			key: key
		};
	}
	
	
	/**
	 * @deprecated - Use Zotero.DataObjects.parseLibraryKey()
	 */
	this.parseLibraryKeyHash = function (libraryKey) {
		Zotero.debug("WARNING: Zotero.DataObjects.parseLibraryKeyHash() is deprecated -- use .parseLibraryKey() instead");
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
	this.getByLibraryAndKey = function (libraryID, key, options) {
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
	this.getByLibraryAndKeyAsync = Zotero.Promise.coroutine(function* (libraryID, key, options) {
		var id = this.getIDFromLibraryAndKey(libraryID, key);
		if (!id) {
			return false;
		}
		return Zotero[this._ZDO_Objects].getAsync(id, options);
	});
	
	
	this.exists = function (itemID) {
		return !!this.getLibraryAndKeyFromID(itemID);
	}
	
	
	/**
	 * @return {Array} Array with libraryID and key
	 */
	this.getLibraryAndKeyFromID = function (id) {
		return this._objectKeys[id] ? this._objectKeys[id] : false;
	}
	
	
	this.getIDFromLibraryAndKey = function (libraryID, key) {
		if (libraryID === null) {
			throw new Error("libraryID cannot be NULL (did you mean 0?)");
		}
		return (this._objectIDs[libraryID] && this._objectIDs[libraryID][key])
			? this._objectIDs[libraryID][key] : false;
	}
	
	
	this.getOlder = function (libraryID, date) {
		if (!date || date.constructor.name != 'Date') {
			throw ("date must be a JS Date in "
				+ "Zotero." + this._ZDO_Objects + ".getOlder()")
		}
		
		var sql = "SELECT ROWID FROM " + this._ZDO_table
			+ " WHERE libraryID=? AND clientDateModified<?";
		return Zotero.DB.columnQuery(sql, [libraryID, Zotero.Date.dateToSQL(date, true)]);
	}
	
	
	this.getNewer = function (libraryID, date, ignoreFutureDates) {
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
	this.getUnsynced = function (libraryID) {
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
	this.getUnwrittenData = function (libraryID) {
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
	this.reload = Zotero.Promise.coroutine(function* (ids, dataTypes, reloadUnchanged) {
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
	
	
	this.reloadAll = function (libraryID) {
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
	
	
	this.registerIdentifiers = function (id, libraryID, key) {
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
	this.unload = function () {
		var ids = Zotero.flattenArguments(arguments);
		for (var i=0; i<ids.length; i++) {
			let id = ids[i];
			let [libraryID, key] = this.getLibraryAndKeyFromID(id);
			if (key) {
				delete this._objectIDs[libraryID][key];
				delete this._objectKeys[id];
			}
			delete this._objectCache[id];
		}
	}
	
	
	/**
	 * @param {Object} data1 - JSON of first object
	 * @param {Object} data2 - JSON of second object
	 * @param {Array} diff - Empty array to put diff data in
	 * @param {Boolean} [includeMatches=false] - Include all fields, even those
	 *                                           that aren't different
	 */
	this.diff = function (data1, data2, diff, includeMatches) {
		diff.push({}, {});
		var numDiffs = 0;
		
		var skipFields = ['collectionKey', 'itemKey', 'searchKey'];
		
		for (var field in data1) {
			if (skipFields.indexOf(field) != -1) {
				continue;
			}
			
			if (data1[field] === false && (data2[field] === false || data2[field] === undefined)) {
				continue;
			}
			
			var changed = data1[field] !== data2[field];
			
			if (includeMatches || changed) {
				diff[0][field] = data1[field] !== false ? data1[field] : '';
				diff[1][field] = (data2[field] !== false && data2[field] !== undefined)
					? data2[field] : '';
			}
			
			if (changed) {
				numDiffs++;
			}
		}
		
		// DEBUG: some of this is probably redundant
		for (var field in data2) {
			if (skipFields.indexOf(field) != -1) {
				continue;
			}
			
			if (diff[0][field] !== undefined) {
				continue;
			}
			
			if (data2[field] === false && (data1[field] === false || data1[field] === undefined)) {
				continue;
			}
			
			var changed = data1[field] !== data2[field];
			
			if (includeMatches || changed) {
				diff[0][field] = (data1[field] !== false && data1[field] !== undefined)
					? data1[field] : '';
				diff[1][field] = data2[field] !== false ? data2[field] : '';
			}
			
			if (changed) {
				numDiffs++;
			}
		}
		
		return numDiffs;
	}
	
	
	this.isEditable = function (obj) {
		var libraryID = obj.libraryID;
		if (!libraryID) {
			return true;
		}
		var type = Zotero.Libraries.getType(libraryID);
		switch (type) {
			case 'user':
				return true;
			
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				if (!group.editable) {
					return false;
				}
				if (obj.objectType == 'item' && obj.isAttachment()
						&& (obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
							obj.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)) {
					return group.filesEditable;
				}
				return true;
			
			default:
				throw ("Unsupported library type '" + type + "' in Zotero.DataObjects.isEditable()");
		}
	}
	
	
	this.editCheck = function (obj) {
		if (!Zotero.Sync.Server.updatesInProgress && !Zotero.Sync.Storage.updatesInProgress && !this.isEditable(obj)) {
			throw ("Cannot edit " + this._ZDO_object + " in read-only Zotero library");
		}
	}
	
	
	this.getPrimaryDataSQLPart = function (part) {
		var sql = this._primaryDataSQLParts[part];
		if (!sql) {
			throw new Error("Invalid primary data SQL part '" + part + "'");
		}
		return sql;
	}
	
	
	this._load = Zotero.Promise.coroutine(function* (libraryID, ids, options) {
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
		var sql = this.getPrimaryDataSQL();
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
	
	
	this._loadIDsAndKeys = Zotero.Promise.coroutine(function* () {
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
}
