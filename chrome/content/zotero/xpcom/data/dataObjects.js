/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
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
	
	this._objectCache = {};
	this._reloadCache = true;
	
	
	this.makeLibraryKeyHash = function (libraryID, key) {
		var libraryID = libraryID ? libraryID : 0;
		return libraryID + '_' + key;
	}
	
	
	this.getLibraryKeyHash = function (obj) {
		return this.makeLibraryKeyHash(obj.libraryID, obj.key);
	}
	
	
	this.parseLibraryKeyHash = function (libraryKey) {
		var [libraryID, key] = libraryKey.split('_');
		if (!key) {
			return false;
		}
		libraryID = parseInt(libraryID);
		return {
			libraryID: libraryID ? libraryID : null,
			key: key
		};
	}
	
	
	/**
	 * Retrieves an object of the current by its key
	 *
	 * @param	{String}			key
	 * @return	{Zotero.DataObject}			Zotero data object, or FALSE if not found
	 */
	this.getByKey = function (key) {
		if (arguments.length > 1) {
			throw ("getByKey() takes only one argument");
		}
		
		Components.utils.reportError("Zotero." + this._ZDO_Objects
			+ ".getByKey() is deprecated -- use getByLibraryAndKey()");
		
		return this.getByLibraryAndKey(null, key);
	}
	
	
	/**
	 * Retrieves an object by its libraryID and key
	 *
	 * @param	{Integer|NULL}		libraryID
	 * @param	{String}			key
	 * @return	{Zotero.DataObject}			Zotero data object, or FALSE if not found
	 */
	this.getByLibraryAndKey = function (libraryID, key) {
		var sql = "SELECT ROWID FROM " + this._ZDO_table + " WHERE ";
		var params = [];
		if (this._ZDO_idOnly) {
			sql += "ROWID=?";
			params.push(key);
		}
		else {
			sql += "libraryID";
			if (libraryID) {
				sql += "=? ";
				params.push(libraryID);
			}
			else {
				sql += " IS NULL ";
			}
			sql += "AND key=?";
			params.push(key);
		}
		var id = Zotero.DB.valueQuery(sql, params);
		if (!id) {
			return false;
		}
		return Zotero[this._ZDO_Objects].get(id);
	}
	
	
	this.getOlder = function (date) {
		if (!date || date.constructor.name != 'Date') {
			throw ("date must be a JS Date in "
				+ "Zotero." + this._ZDO_Objects + ".getOlder()")
		}
		
		var sql = "SELECT ROWID FROM " + this._ZDO_table + " WHERE ";
		if (this._ZDO_object == 'relation') {
			sql += "clientDateModified<?";
		}
		else {
			sql += "dateModified<?";
		}
		return Zotero.DB.columnQuery(sql, Zotero.Date.dateToSQL(date, true));
	}
	
	
	this.getNewer = function (date) {
		if (date && date.constructor.name != 'Date') {
			throw ("date must be a JS Date in "
				+ "Zotero." + this._ZDO_Objects + ".getNewer()")
		}
		
		var sql = "SELECT ROWID FROM " + this._ZDO_table;
		if (date) {
			sql += " WHERE clientDateModified>?";
			return Zotero.DB.columnQuery(sql, Zotero.Date.dateToSQL(date, true));
		}
		return Zotero.DB.columnQuery(sql);
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
		
		/*
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
		
		Zotero.debug('==================');
		for (var id in this._objectCache) {
			Zotero.debug('id is ' + id);
			var obj = this._objectCache[id];
			//Zotero.debug(obj);
			var dbID = keyIDs[obj.key];
			Zotero.debug("DBID: " + dbID);
			if (!dbID || id == dbID) {
				Zotero.debug('continuing');
				continue;
			}
			Zotero.debug('Assigning ' + dbID + ' to store');
			store[dbID] = obj;
			Zotero.debug('deleting ' + id);
			delete this._objectCache[id];
		}
		Zotero.debug('------------------');
		for (var id in store) {
			Zotero.debug(id);
			if (this._objectCache[id]) {
				throw("Existing " + this._ZDO_object + " " + id
					+ " exists in cache in Zotero.DataObjects.reload()");
			}
			this._objectCache[id] = store[id];
		}
		*/
		
		// If there's an internal reload hook, call it
		if (this._reload) {
			this._reload(ids)
		}
		
		// Reload data
		this._load(ids);
		
		return true;
	}
	
	
	this.reloadAll = function () {
		Zotero.debug("Reloading all " + this._ZDO_objects);
		
		// Remove objects not stored in database
		var sql = "SELECT ROWID FROM " + this._ZDO_table;
		var ids = Zotero.DB.columnQuery(sql);
		
		for (var id in this._objectCache) {
			if (!ids || ids.indexOf(parseInt(id)) == -1) {
				delete this._objectCache[id];
			}
		}
		
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
			delete this._objectCache[ids[i]];
		}
	}
	
	
	/**
	 * @param	{Object}		data1				Serialized copy of first object
	 * @param	{Object}		data2				Serialized copy of second object
	 * @param	{Array}		diff					Empty array to put diff data in
	 * @param	{Boolean}	[includeMatches=false]	Include all fields, even those
	 *													that aren't different
	 */
	this.diff = function (data1, data2, diff, includeMatches) {
		diff.push({}, {});
		var numDiffs = 0;
		
		var subs = ['primary', 'fields'];
		var skipFields = ['collectionID', 'creatorID', 'itemID', 'searchID', 'tagID', 'libraryID', 'key'];
		
		for each(var sub in subs) {
			diff[0][sub] = {};
			diff[1][sub] = {};
			for (var field in data1[sub]) {
				if (skipFields.indexOf(field) != -1) {
					continue;
				}
				
				if (!data1[sub][field] && !data2[sub][field]) {
					continue;
				}
				
				var changed = !data1[sub][field] || !data2[sub][field] ||
						data1[sub][field] != data2[sub][field];
				
				if (includeMatches || changed) {
					diff[0][sub][field] = data1[sub][field] ?
						data1[sub][field] : '';
					diff[1][sub][field] = data2[sub][field] ?
						data2[sub][field] : '';
				}
				
				if (changed) {
					numDiffs++;
				}
			}
			
			// DEBUG: some of this is probably redundant
			for (var field in data2[sub]) {
				if (skipFields.indexOf(field) != -1) {
					continue;
				}
				
				if (diff[0][sub][field] != undefined) {
					continue;
				}
				
				if (!data1[sub][field] && !data2[sub][field]) {
					continue;
				}
				
				var changed = !data1[sub][field] || !data2[sub][field] ||
						data1[sub][field] != data2[sub][field];
				
				if (includeMatches || changed) {
					diff[0][sub][field] = data1[sub][field] ?
						data1[sub][field] : '';
					diff[1][sub][field] = data2[sub][field] ?
						data2[sub][field] : '';
				}
				
				if (changed) {
					numDiffs++;
				}
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
			if (Zotero.Sync.Storage.syncInProgress) {
				try {
					asfasf();
				}
				catch (e) {
					Zotero.debug(e);
				}
				Components.utils.reportError("Storage sync in progress but updatesInProgress not set -- fix?");
				return;
			}
			throw ("Cannot edit " + this._ZDO_object + " in read-only Zotero library");
		}
	}
}

