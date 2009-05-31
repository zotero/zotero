/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
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
	
	this._loaded = false;
	this._changed = false;
	this._hasCollections = null;
}


Zotero.Group.prototype.__defineGetter__('objectType', function () { return 'group'; });
Zotero.Group.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Group.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Group.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Group.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Group.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Group.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Group.prototype.__defineGetter__('description', function () { return this._get('description'); });
Zotero.Group.prototype.__defineSetter__('description', function (val) { this._set('description', val); });
Zotero.Group.prototype.__defineGetter__('editable', function () { return this._get('editable'); });
Zotero.Group.prototype.__defineSetter__('editable', function (val) { this._set('editable', val); });
Zotero.Group.prototype.__defineGetter__('filesEditable', function () { return this._get('filesEditable'); });
Zotero.Group.prototype.__defineSetter__('filesEditable', function (val) { this._set('filesEditable', val); });


Zotero.Group.prototype._get = function (field) {
	if (this._id && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Group.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Group._set()");
			}
			//this._checkValue(field, val);
			this['_' + field] = val;
			return;
	}
	
	if (this.id) {
		if (!this._loaded) {
			this.load();
		}
	}
	else {
		this._loaded = true;
	}
	
	if (this['_' + field] != val) {
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
Zotero.Group.prototype.load = function() {
	var id = this._id;
	
	if (!id) {
		throw ("ID not set in Zotero.Group.load()");
	}
	
	var sql = "SELECT G.* FROM groups G WHERE groupID=?";
	var data = Zotero.DB.rowQuery(sql, id);
	
	this._loaded = true;
	
	if (!data) {
		return;
	}
	
	this.loadFromRow(data);
}


/*
 * Populate group data from a database row
 */
Zotero.Group.prototype.loadFromRow = function(row) {
	this._loaded = true;
	this._changed = false;
	this._hasCollections = null;
	
	this._id = row.groupID;
	this._libraryID = row.libraryID;
	this._name = row.name;
	this._description = row.description;
	this._editable = row.editable;
	this._filesEditable = row.filesEditable;
}


/**
 * Check if group exists in the database
 *
 * @return	bool			TRUE if the group exists, FALSE if not
 */
Zotero.Group.prototype.exists = function() {
	if (!this.id) {
		throw ('groupID not set in Zotero.Group.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM groups WHERE groupID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


Zotero.Group.prototype.hasCollections = function () {
	if (this._hasCollections !== null) {
		return this._hasCollections;
	}
	
	this._hasCollections = !!this.getCollections().length;
	return this._hasCollections;
}


Zotero.Group.prototype.clearCollectionsCache = function () {
	this._hasCollections = null;
}


/**
 * Returns collections of this group
 *
 * @param	{Boolean}		asIDs				Return as collectionIDs
 * @return	{Zotero.Collection[]}				Array of Zotero.Collection instances
 */
Zotero.Group.prototype.getCollections = function (parent) {
	var sql = "SELECT collectionID FROM collections WHERE libraryID=? AND "
				+ "parentCollectionID " + (parent ? '=' + parent : 'IS NULL');
	var ids = Zotero.DB.columnQuery(sql, this.libraryID);
	
	// Return Zotero.Collection objects
	var objs = [];
	for each(var id in ids) {
		var col = Zotero.Collections.get(id);
		objs.push(col);
	}
	
	// Do proper collation sort
	var collation = Zotero.getLocaleCollation();
	objs.sort(function (a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	return objs;
}


Zotero.Group.prototype.hasItem = function (itemID) {
	var item = Zotero.Items.get(itemID);
	return item.libraryID == this.libraryID;
}


Zotero.Group.prototype.save = function () {
	if (!this.id) {
		throw ("ID not set in Zotero.Group.save()");
	}
	
	if (!this.libraryID) {
		throw ("libraryID not set in Zotero.Group.save()");
	}
	
	if (!this._changed) {
		Zotero.debug("Group " + this.id + " has not changed");
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.exists();
	
	try {
		Zotero.debug("Saving group " + this.id);
		
		var columns = [
			'groupID',
			'libraryID',
			'name',
			'description',
			'editable',
			'filesEditable'
		];
		var placeholders = ['?', '?', '?', '?', '?', '?'];
		var sqlValues = [
			this.id,
			this.libraryID,
			this.name,
			this.description,
			this.editable ? 1 : 0,
			this.filesEditable ? 1 : 0
		];
		
		if (isNew) {
			if (!Zotero.Libraries.exists(this.libraryID)) {
				Zotero.Libraries.add(this.libraryID, 'group');
			}
			
			var sql = "INSERT INTO groups (" + columns.join(', ') + ") "
						+ "VALUES (" + placeholders.join(', ') + ")";
			Zotero.DB.query(sql, sqlValues);
		}
		else {
			columns.shift();
			sqlValues.shift();
			
			var sql = "UPDATE groups SET "
				+ columns.map(function (val) val + '=?').join(', ')
				+ " WHERE groupID=?";
			sqlValues.push(this.id);
			Zotero.DB.query(sql, sqlValues);
		}
		
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	//Zotero.Groups.reload(this.id);
	
	Zotero.Notifier.trigger('add', 'group', this.id);
}


/**
* Deletes group and all descendant objects
**/
Zotero.Group.prototype.erase = function() {
	Zotero.DB.beginTransaction();
	
	var sql, ids, obj;
	
	// Delete items
	sql = "SELECT itemID FROM items WHERE libraryID=?";
	ids = Zotero.DB.columnQuery(sql, this.libraryID);
	Zotero.Items.erase(ids);
	
	// Delete collections
	sql = "SELECT collectionID FROM collections WHERE libraryID=?";
	ids = Zotero.DB.columnQuery(sql, this.libraryID);
	for each(var id in ids) {
		obj = Zotero.Collections.get(id);
		// Subcollections might've already been deleted
		if (obj) {
			obj.erase();
		}
	}
	
	// Delete creators
	sql = "SELECT creatorID FROM creators WHERE libraryID=?";
	ids = Zotero.DB.columnQuery(sql, this.libraryID);
	for each(var id in ids) {
		obj = Zotero.Creators.get(id);
		obj.erase();
	}
	
	// Delete saved searches
	sql = "SELECT savedSearchID FROM savedSearches WHERE libraryID=?";
	ids = Zotero.DB.columnQuery(sql, this.libraryID);
	for each(var id in ids) {
		obj = Zotero.Searches.get(id);
		obj.erase();
	}
	
	// Delete tags
	sql = "SELECT tagID FROM tags WHERE libraryID=?";
	ids = Zotero.DB.columnQuery(sql, this.libraryID);
	Zotero.Tags.erase(ids);
	
	// Delete delete log entries
	sql = "DELETE FROM syncDeleteLog WHERE libraryID=?";
	Zotero.DB.query(sql, this.libraryID);
	
	// Delete group
	sql = "DELETE FROM groups WHERE groupID=?";
	ids = Zotero.DB.query(sql, this.id)
	
	Zotero.purgeDataObjects();
	
	var notifierData = {};
	notifierData[this.id] = this.serialize();
	
	Zotero.DB.commitTransaction();
	
	Zotero.Notifier.trigger('delete', 'group', this.id, notifierData);
}


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
