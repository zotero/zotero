Zotero.DataObjects = function (object, objectPlural) {
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
	this._ZDO_id = object + 'ID';
	this._ZDO_table = this._ZDO_objects;
	
	
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
}

