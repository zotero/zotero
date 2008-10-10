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
	
	this._objectCache = {};
	this._reloadCache = true;
	
	
	/**
	 * Retrieves an object by its secondary lookup key
	 *
	 * @param	string	key		Secondary lookup key
	 * @return	object			Zotero data object, or FALSE if not found
	 */
	this.getByKey = function (key) {
		var sql = "SELECT " + this._ZDO_id + " FROM " + this._ZDO_table
			+ " WHERE key=?";
		var id = Zotero.DB.valueQuery(sql, key);
		if (!id) {
			return false;
		}
		return Zotero[this._ZDO_Objects].get(id);
	}
	
	
	/*
	 * Reloads data for specified items into internal array
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 */
	this.reload = function () {
		if (!arguments[0]) {
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		Zotero.debug('Reloading ' + this._ZDO_objects + ' ' + ids);
		
		// Reset cache keys to itemIDs stored in database using object keys
		var sql = "SELECT " + this._ZDO_id + " AS id, key FROM " + this._ZDO_table
					+ " WHERE " + this._ZDO_id + " IN ("
					+ ids.map(function () '?').join() + ")";
		var rows = Zotero.DB.query(sql, ids);
		
		var keyIDs = {};
		for each(var row in rows) {
			keyIDs[row.key] = row.id
		}
		var store = {};
		
		for (var id in this._objectCache) {
			var obj = this._objectCache[id];
			var dbID = keyIDs[obj.key];
			if (!dbID || id == dbID) {
				continue;
			}
			store[dbID] = obj;
			delete this._objectCache[id];
		}
		for (var id in store) {
			if (this._objectCache[id]) {
				throw("Existing " + this._ZDO_object + " " + id
					+ " exists in cache in Zotero.DataObjects.reload()");
			}
			this._objectCache[id] = store[id];
		}
		
		// Reload data
		this._load(ids);
		
		return true;
	}
	
	
	this.reloadAll = function () {
		Zotero.debug("Reloading all " + this._ZDO_objects);
		
		// Reset cache keys to itemIDs stored in database using object keys
		var sql = "SELECT " + this._ZDO_id + " AS id, key FROM " + this._ZDO_table;
		var rows = Zotero.DB.query(sql);
		
		var keyIDs = {};
		for each(var row in rows) {
			keyIDs[row.key] = row.id;
		}
		
		var store = {};
		for each(var obj in this._objectCache) {
			store[keyIDs[obj.key]] = obj;
		}
		
		this._objectCache = store;
		
		// Reload data
		this._reloadCache = true;
		this._load();
	}
	
	
	/**
	 * Clear object from internal array
	 *
	 * @param	int[]	ids		objectIDs
	 */
	this.unload = function () {
		var ids = Zotero.flattenArguments(arguments);
		for (var i=0; i<ids.length; i++) {
			delete _objectCache[ids[i]];
		}
	}
}

