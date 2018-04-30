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

"use strict";

Zotero.Group = function (params = {}) {
	params.libraryType = 'group';
	Zotero.Group._super.call(this, params);
	
	Zotero.Utilities.assignProps(this, params, ['groupID', 'name', 'description',
		'version']);
	
	// Return a proxy so that we can disable the object once it's deleted
	return new Proxy(this, {
		get: function(obj, prop) {
			if (obj._disabled && !(prop == 'libraryID' || prop == 'id')) {
				throw new Error("Group (" + obj.libraryID + ") has been disabled");
			}
			return obj[prop];
		}
	});
}


/**
 * Non-prototype properties
 */

Zotero.defineProperty(Zotero.Group, '_dbColumns', {
	value: Object.freeze(['name', 'description', 'version'])
});

Zotero.Group._colToProp = function(c) {
	return "_group" + Zotero.Utilities.capitalize(c);
}

Zotero.defineProperty(Zotero.Group, '_rowSQLSelect', {
	value: Zotero.Library._rowSQLSelect + ", G.groupID, "
		+ Zotero.Group._dbColumns.map(c => "G." + c + " AS " + Zotero.Group._colToProp(c)).join(", ")
});

Zotero.defineProperty(Zotero.Group, '_rowSQL', {
	value: "SELECT " + Zotero.Group._rowSQLSelect
		+ " FROM groups G JOIN libraries L USING (libraryID)"
});

Zotero.extendClass(Zotero.Library, Zotero.Group);

Zotero.defineProperty(Zotero.Group.prototype, '_objectType', {
	value: 'group'
});

Zotero.defineProperty(Zotero.Group.prototype, 'libraryTypes', {
	value: Object.freeze(Zotero.Group._super.prototype.libraryTypes.concat(['group']))
});

Zotero.defineProperty(Zotero.Group.prototype, 'groupID', {
	get: function() { return this._groupID; },
	set: function(v) { return this._groupID = v; }
});

Zotero.defineProperty(Zotero.Group.prototype, 'id', {
	get: function() { return this.groupID; },
	set: function(v) { return this.groupID = v; }
});

Zotero.defineProperty(Zotero.Group.prototype, 'allowsLinkedFiles', {
	value: false
});

// Create accessors
(function() {
let accessors = ['name', 'description', 'version'];
for (let i=0; i<accessors.length; i++) {
	let name = accessors[i];
	let prop = Zotero.Group._colToProp(name);
	Zotero.defineProperty(Zotero.Group.prototype, name, {
		get: function() { return this._get(prop); },
		set: function(v) { return this._set(prop, v); }
	})
}
})();

Zotero.Group.prototype._isValidGroupProp = function(prop) {
	let preffix = '_group';
	if (prop.indexOf(preffix) !== 0 || prop.length == preffix.length) {
		return false;
	}
	
	let col = prop.substr(preffix.length);
	col =  col.charAt(0).toLowerCase() + col.substr(1);
	
	return Zotero.Group._dbColumns.indexOf(col) != -1;
}

Zotero.Group.prototype._isValidProp = function(prop) {
	return this._isValidGroupProp(prop)
		|| Zotero.Group._super.prototype._isValidProp.call(this, prop);
}

/*
 * Populate group data from a database row
 */
Zotero.Group.prototype._loadDataFromRow = function(row) {
	Zotero.Group._super.prototype._loadDataFromRow.call(this, row);
	
	this._groupID = row.groupID;
	this._groupName = row._groupName;
	this._groupDescription = row._groupDescription;
	this._groupVersion = row._groupVersion;
}

Zotero.Group.prototype._set = function(prop, val) {
	switch(prop) {
		case '_groupVersion':
			let newVal = Number.parseInt(val, 10);
			if (newVal != val) {
				throw new Error(prop + ' must be an integer');
			}
			val = newVal
			
			if (val < 0) {
				throw new Error(prop + ' must be non-negative');
			}
			
			// Ensure that it is never decreasing
			if (val < this._groupVersion) {
				throw new Error(prop + ' cannot decrease');
			}
			
			break;
		case '_groupName':
		case '_groupDescription':
			if (typeof val != 'string') {
				throw new Error(prop + ' must be a string');
			}
			break;
	}
	
	return Zotero.Group._super.prototype._set.call(this, prop, val);
}

Zotero.Group.prototype._reloadFromDB = Zotero.Promise.coroutine(function* () {
	let sql = Zotero.Group._rowSQL + " WHERE G.groupID=?";
	let row = yield Zotero.DB.rowQueryAsync(sql, [this.groupID]);
	this._loadDataFromRow(row);
});

Zotero.Group.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	let proceed = yield Zotero.Group._super.prototype._initSave.call(this, env);
	if (!proceed) return false;
	
	if (!this._groupName) throw new Error("Group name not set");
	if (typeof this._groupDescription != 'string') throw new Error("Group description not set");
	if (!(this._groupVersion >= 0)) throw new Error("Group version not set");
	if (!this._groupID) throw new Error("Group ID not set");
	
	return true;
});

Zotero.Group.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.Group._super.prototype._saveData.call(this, env);
	
	let changedCols = [], params = [];
	for (let i=0; i<Zotero.Group._dbColumns.length; i++) {
		let col = Zotero.Group._dbColumns[i];
		let prop = Zotero.Group._colToProp(col);
		
		if (!this._changed[prop]) continue;
		
		changedCols.push(col);
		params.push(this[prop]);
	}
	
	if (env.isNew) {
		changedCols.push('groupID', 'libraryID');
		params.push(this.groupID, this.libraryID);
		
		let sql = "INSERT INTO groups (" + changedCols.join(', ') + ") "
			+ "VALUES (" + Array(params.length).fill('?').join(', ') + ")";
		yield Zotero.DB.queryAsync(sql, params);
		
		Zotero.Notifier.queue('add', 'group', this.groupID, env.notifierData);
	}
	else if (changedCols.length) {
		let sql = "UPDATE groups SET " + changedCols.map(v => v + '=?').join(', ')
			+ " WHERE groupID=?";
		params.push(this.groupID);
		yield Zotero.DB.queryAsync(sql, params);
		
		if (!env.options.skipNotifier) {
			Zotero.Notifier.queue('modify', 'group', this.groupID, env.notifierData);
		}
	}
	else {
		Zotero.debug("Group data did not change for group " + this.groupID, 5);
	}
});

Zotero.Group.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.Group._super.prototype._finalizeSave.call(this, env);
	
	if (env.isNew) {
		Zotero.Groups.register(this);
	}
});

Zotero.Group.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	let notifierData = {};
	notifierData[this.groupID] = {
		libraryID: this.libraryID
	};
	Zotero.Notifier.queue('delete', 'group', this.groupID, notifierData);
	
	Zotero.Groups.unregister(this.groupID);
	
	yield Zotero.Group._super.prototype._finalizeErase.call(this, env);
});

Zotero.Group.prototype.fromJSON = function (json, userID) {
	if (json.name !== undefined) this.name = json.name;
	if (json.description !== undefined) this.description = json.description;
	
	var editable = false;
	var filesEditable = false;
	if (userID) {
		({ editable, filesEditable } = Zotero.Groups.getPermissionsFromJSON(json, userID));
	}
	this.editable = editable;
	this.filesEditable = filesEditable;
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
