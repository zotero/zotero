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


Zotero.Group = function () {
	if (arguments[0]) {
		throw ("Zotero.Group constructor doesn't take any parameters");
	}
	
	this._init();
}

Zotero.Group.prototype._init = function () {
	this._id = null;
	this._libraryID = null;
	this._name = null;
	this._description = null;
	this._editable = null;
	this._filesEditable = null;
	this._version = null;
	
	this._loaded = false;
	this._changed = false;
	this._hasCollections = null;
	this._hasSearches = null;
}


Zotero.Group.prototype.__defineGetter__('objectType', function () { return 'group'; });
Zotero.Group.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Group.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Group.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Group.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Group.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Group.prototype.__defineGetter__('description', function () { return this._get('description'); });
Zotero.Group.prototype.__defineSetter__('description', function (val) { this._set('description', val); });
Zotero.Group.prototype.__defineGetter__('editable', function () { return this._get('editable'); });
Zotero.Group.prototype.__defineSetter__('editable', function (val) { this._set('editable', val); });
Zotero.Group.prototype.__defineGetter__('filesEditable', function () { if (!this.editable) { return false; } return this._get('filesEditable'); });
Zotero.Group.prototype.__defineSetter__('filesEditable', function (val) { this._set('filesEditable', val); });
Zotero.Group.prototype.__defineGetter__('version', function () { return this._get('version'); });
Zotero.Group.prototype.__defineSetter__('version', function (val) { this._set('version', val); });

Zotero.Group.prototype._get = function (field) {
	if (this['_' + field] !== null) {
		return this['_' + field];
	}
	this._requireLoad();
	return null;
}


Zotero.Group.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw new Error("Cannot set " + field + " after object is already loaded");
			}
			//this._checkValue(field, val);
			this['_' + field] = val;
			return;
	}
	
	this._requireLoad();
	
	if (this['_' + field] !== val) {
		this._prepFieldChange(field);
		
		switch (field) {
			default:
				this['_' + field] = val;
		}
	}
}


/*
 * Build group from database
 */
Zotero.Group.prototype.load = Zotero.Promise.coroutine(function* () {
	var id = this._id;
	
	if (!id) {
		throw new Error("ID not set");
	}
	
	var sql = "SELECT G.* FROM groups G WHERE groupID=?";
	var data = yield Zotero.DB.rowQueryAsync(sql, id);
	if (!data) {
		this._loaded = true;
		return false;
	}
	
	this.loadFromRow(data);
	
	return true;
});


/*
 * Populate group data from a database row
 */
Zotero.Group.prototype.loadFromRow = function(row) {
	this._loaded = true;
	this._changed = false;
	this._hasCollections = null;
	this._hasSearches = null;
	
	this._id = row.groupID;
	this._libraryID = row.libraryID;
	this._name = row.name;
	this._description = row.description;
	this._editable = Zotero.Libraries.isEditable(row.libraryID);
	this._filesEditable = Zotero.Libraries.isFilesEditable(row.libraryID);
	this._version = row.version;
}


/**
 * Check if group exists in the database
 *
 * @return	bool			TRUE if the group exists, FALSE if not
 */
Zotero.Group.prototype.exists = function() {
	return Zotero.Groups.exists(this.id);
}


Zotero.Group.prototype.hasCollections = function () {
	if (this._hasCollections !== null) {
		return this._hasCollections;
	}
	this._requireLoad();
	return false;
}


Zotero.Group.prototype.hasSearches = function () {
	if (this._hasSearches !== null) {
		return this._hasSearches;
	}
	this._requireLoad();
	return false;
}


Zotero.Group.prototype.clearCollectionCache = function () {
	this._hasCollections = null;
}

Zotero.Group.prototype.clearSearchCache = function () {
	this._hasSearches = null;
}

Zotero.Group.prototype.hasItem = function (item) {
	if (!(item instanceof Zotero.Item)) {
		throw new Error("item must be a Zotero.Item");
	}
	return item.libraryID == this.libraryID;
}


Zotero.Group.prototype.save = Zotero.Promise.coroutine(function* () {
	if (!this.id) throw new Error("Group id not set");
	if (!this.name) throw new Error("Group name not set");
	if (!this.version) throw new Error("Group version not set");
	
	if (!this._changed) {
		Zotero.debug("Group " + this.id + " has not changed");
		return false;
	}
	
	yield Zotero.DB.executeTransaction(function* () {
		var isNew = !this.exists();
		
		Zotero.debug("Saving group " + this.id);
		
		var sqlColumns = [
			'groupID',
			'name',
			'description',
			'version'
		];
		var sqlValues = [
			this.id,
			this.name,
			this.description,
			this.version
		];
		
		if (isNew) {
			let { id: libraryID } = yield Zotero.Libraries.add(
				'group', this.editable, this.filesEditable
			);
			sqlColumns.push('libraryID');
			sqlValues.push(libraryID);
			
			let sql = "INSERT INTO groups (" + sqlColumns.join(', ') + ") "
						+ "VALUES (" + sqlColumns.map(() => '?').join(', ') + ")";
			yield Zotero.DB.queryAsync(sql, sqlValues);
		}
		else {
			sqlColumns.shift();
			sqlValues.push(sqlValues.shift());
			
			let sql = "UPDATE groups SET " + sqlColumns.map(function (val) val + '=?').join(', ')
				+ " WHERE groupID=?";
			yield Zotero.DB.queryAsync(sql, sqlValues);
			
			yield Zotero.Libraries.setEditable(this.libraryID, this.editable);
			yield Zotero.Libraries.setFilesEditable(this.libraryID, this.filesEditable);
		}
		
		if (isNew) {
			Zotero.DB.addCurrentCallback("commit", Zotero.Promise.coroutine(function* () {
				yield this.load();
				Zotero.Groups.register(this)
			}.bind(this)));
			Zotero.Notifier.queue('add', 'group', this.id);
		}
		else {
			Zotero.Notifier.queue('modify', 'group', this.id);
		}
	}.bind(this));
});


/**
* Deletes group and all descendant objects
**/
Zotero.Group.prototype.erase = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Removing group " + this.id);
	
	Zotero.DB.requireTransaction();
	
	// Delete items
	var types = ['item', 'collection', 'search'];
	for (let type of types) {
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
		let sql = "SELECT " + objectsClass.idColumn + " FROM " + objectsClass.table
			+ " WHERE libraryID=?";
		ids = yield Zotero.DB.columnQueryAsync(sql, this.libraryID);
		for (let i = 0; i < ids.length; i++) {
			let id = ids[i];
			let obj = yield objectsClass.getAsync(id, { noCache: true });
			// Descendent object may have already been deleted
			if (!obj) {
				continue;
			}
			yield obj.erase({
				skipNotifier: true
			});
		}
	}
	
	// Delete library row, which deletes from tags, syncDeleteLog, syncedSettings, and groups
	// tables via cascade. If any of those gain caching, they should be deleted separately.
	var sql = "DELETE FROM libraries WHERE libraryID=?";
	yield Zotero.DB.queryAsync(sql, this.libraryID)
	
	Zotero.DB.addCurrentCallback('commit', function () {
		Zotero.Groups.unregister(this.id);
		//yield Zotero.purgeDataObjects();
	}.bind(this))
	var notifierData = {};
	notifierData[this.id] = {
		libraryID: this.libraryID
	};
	Zotero.Notifier.queue('delete', 'group', this.id, notifierData);
});


Zotero.Group.prototype.eraseTx = function () {
	return Zotero.DB.executeTransaction(function* () {
		return this.erase();
	}.bind(this));
}


Zotero.Group.prototype.fromJSON = function (json, userID) {
	this._requireLoad();
	
	this.name = json.name;
	this.description = json.description;
	
	var editable = false;
	var filesEditable = false;
	if (userID) {
		// If user is owner or admin, make library editable, and make files editable unless they're
		// disabled altogether
		if (json.owner == userID || (json.admins && json.admins.indexOf(userID) != -1)) {
			editable = true;
			if (json.fileEditing != 'none') {
				filesEditable = true;
			}
		}
		// If user is member, make library and files editable if they're editable by all members
		else if (json.members && json.members.indexOf(userID) != -1) {
			if (json.libraryEditing == 'members') {
				editable = true;
				if (json.fileEditing == 'members') {
					filesEditable = true;
				}
			}
		}
	}
	this.editable = editable;
	this.filesEditable = filesEditable;
}


Zotero.Group.prototype._requireLoad = function () {
	if (!this._loaded && Zotero.Groups.exists(this._id)) {
		throw new Error("Group has not been loaded");
	}
}


Zotero.Group.prototype._prepFieldChange = function (field) {
	if (!this._changed) {
		this._changed = {};
	}
	this._changed[field] = true;
	
	// Save a copy of the data before changing
	// TODO: only save previous data if group exists
	if (this.id && this.exists() && !this._previousData) {
		//this._previousData = this.serialize();
	}
}
