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
	this._editable = !!row.editable;
	this._filesEditable = !!row.filesEditable;
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

/**
 * Returns collections of this group
 *
 * @param	{Boolean}		asIDs				Return as collectionIDs
 * @return	{Zotero.Collection[]}				Array of Zotero.Collection instances
 */
Zotero.Group.prototype.getCollections = Zotero.Promise.coroutine(function* (parent) {
	var sql = "SELECT collectionID FROM collections WHERE libraryID=? AND "
				+ "parentCollectionID " + (parent ? '=' + parent : 'IS NULL');
	var ids = yield Zotero.DB.columnQueryAsync(sql, this.libraryID);
	
	// Return Zotero.Collection objects
	var objs = [];
	for each(var id in ids) {
		var col = yield Zotero.Collections.getAsync(id);
		objs.push(col);
	}
	
	// Do proper collation sort
	var collation = Zotero.getLocaleCollation();
	objs.sort(function (a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	return objs;
});


Zotero.Group.prototype.hasItem = function (item) {
	if (!(item instanceof Zotero.Item)) {
		throw new Error("item must be a Zotero.Item");
	}
	return item.libraryID == this.libraryID;
}


Zotero.Group.prototype.save = Zotero.Promise.coroutine(function* () {
	if (!this.id) {
		throw new Error("Group id not set");
	}
	
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
			'editable',
			'filesEditable',
			'version'
		];
		var sqlValues = [
			this.id,
			this.name,
			this.description,
			this.editable ? 1 : 0,
			this.filesEditable ? 1 : 0,
			this.version
		];
		
		if (isNew) {
			var { id: libraryID } = yield Zotero.Libraries.add('group');
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
		}
		
		if (isNew) {
			Zotero.DB.addCurrentCallback("commit", Zotero.Promise.coroutine(function* () {
				yield this.load();
				Zotero.Groups.register(this)
			}.bind(this)));
			Zotero.Notifier.trigger('add', 'group', this.id);
		}
		else {
			Zotero.Notifier.trigger('modify', 'group', this.id);
		}
	}.bind(this));
});


/**
* Deletes group and all descendant objects
**/
Zotero.Group.prototype.erase = Zotero.Promise.coroutine(function* () {
	yield Zotero.DB.executeTransaction(function* () {
		var notifierData = {};
		notifierData[this.id] = this.serialize(); // TODO: Replace with JSON
		
		var sql, ids, obj;
		
		// Delete items
		var types = ['item', 'collection', 'search'];
		for (let type of types) {
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			let sql = "SELECT " + objectsClass.idColumn + " FROM " + objectsClass.table
				+ " WHERE libraryID=?";
			ids = yield Zotero.DB.columnQueryAsync(sql, this.libraryID);
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				let obj = yield Zotero.Items.getAsync(id, { noCache: true });
				yield obj.erase({
					skipNotifier: true
				});
			}
		}
		
		/*// Delete tags
		sql = "SELECT tagID FROM tags WHERE libraryID=?";
		ids = yield Zotero.DB.columnQueryAsync(sql, this.libraryID);
		yield Zotero.Tags.erase(ids);*/
		
		// Delete delete log entries
		sql = "DELETE FROM syncDeleteLog WHERE libraryID=?";
		yield Zotero.DB.queryAsync(sql, this.libraryID);
		
		var prefix = "groups/" + this.id;
		yield Zotero.Relations.eraseByURIPrefix(Zotero.URI.defaultPrefix + prefix);
		
		// Delete settings
		sql = "DELETE FROM syncedSettings WHERE libraryID=?";
		yield Zotero.DB.queryAsync(sql, this.libraryID);
		
		// Delete group
		sql = "DELETE FROM groups WHERE groupID=?";
		yield Zotero.DB.queryAsync(sql, this.id)
		
		// Delete library
		sql = "DELETE FROM libraries WHERE libraryID=?";
		yield Zotero.DB.queryAsync(sql, this.libraryID)
		
		Zotero.Groups.unregister(this.id);
		Zotero.Notifier.trigger('delete', 'group', this.id, notifierData);
	}.bind(this));
	
	yield Zotero.purgeDataObjects();
});


Zotero.Group.prototype.serialize = function() {
	var obj = {
		primary: {
			groupID: this.id,
			libraryID: this.libraryID
		},
		fields: {
			name: this.name,
			description: this.description,
			editable: this.editable,
			filesEditable: this.filesEditable
		}
	};
	return obj;
}


Zotero.Group.prototype._requireLoad = function () {
	if (!this._loaded && Zotero.Groups.exists(this.id)) {
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
