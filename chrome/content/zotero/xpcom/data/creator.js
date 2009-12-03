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


Zotero.Creator = function () {
	if (arguments[0]) {
		throw ("Zotero.Creator constructor doesn't take any parameters");
	}
	
	this._init();
}


Zotero.Creator.prototype._init = function () {
	this._id = null;
	this._libraryID = null
	this._key = null;
	this._firstName = null;
	this._lastName = null;
	this._fieldMode = null;
	this._birthYear = null;
	this._dateAdded = null;
	this._dateModified = null;
	
	this._creatorDataID = null;
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
}


Zotero.Creator.prototype.__defineGetter__('objectType', function () { return 'creator'; });
Zotero.Creator.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Creator.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Creator.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Creator.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Creator.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Creator.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Creator.prototype.__defineGetter__('creatorDataID', function () { return this._get('creatorDataID'); });
Zotero.Creator.prototype.__defineGetter__('firstName', function () { return this._get('firstName'); });
Zotero.Creator.prototype.__defineSetter__('firstName', function (val) { this._set('firstName', val); });
Zotero.Creator.prototype.__defineGetter__('lastName', function () { return this._get('lastName'); });
Zotero.Creator.prototype.__defineSetter__('lastName', function (val) { this._set('lastName', val); });
Zotero.Creator.prototype.__defineGetter__('fieldMode', function () { return this._get('fieldMode'); });
Zotero.Creator.prototype.__defineSetter__('fieldMode', function (val) { this._set('fieldMode', val); });
Zotero.Creator.prototype.__defineGetter__('birthYear', function () { return this._get('birthYear'); });
Zotero.Creator.prototype.__defineSetter__('birthYear', function (val) { this._set('birthYear', val); });
Zotero.Creator.prototype.__defineGetter__('dateAdded', function () { return this._get('dateAdded'); });
Zotero.Creator.prototype.__defineSetter__('dateAdded', function (val) { this._set('dateAdded', val); });
Zotero.Creator.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Creator.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });

// Block properties that can't be set this way
//Zotero.Creator.prototype.__defineSetter__('creatorDataID', function () { this._set('creatorDataID', val); });


Zotero.Creator.prototype._get = function (field) {
	if ((this._id || this._key) && !this._loaded) {
		this.load(true);
	}
	return this['_' + field];
}


Zotero.Creator.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
		case 'key':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Creator._set()");
			}
			this._checkValue(field, val);
			this['_' + field] = val;
			return;
		
		case 'firstName':
		case 'lastName':
		case 'shortName':
			if (val) {
				val = Zotero.Utilities.prototype.trim(val);
			}
			else {
				val = '';
			}
			break;
		
		case 'fieldMode':
			val = val ? parseInt(val) : 0;
			break;
		
		case 'creatorDataID':
			throw ("Invalid field '" + field + "' in Zotero.Creator.set()");
	}
	
	if (this.id || this.key) {
		if (!this._loaded) {
			this.load(true);
		}
	}
	else {
		this._loaded = true;
	}
	
	this._checkValue(field, val);
	
	if (this['_' + field] != val) {
		if (!this._changed) {
			this._changed = {};
		}
		this._changed[field] = true;
		if (this.id && this.exists() && !this._previousData) {
			this._previousData = this.serialize();
		}
		
		this['_' + field] = val;
	}
}


Zotero.Creator.prototype.setFields = function (fields) {
	this.firstName = fields.firstName;
	this.lastName = fields.lastName;
	this.fieldMode = fields.fieldMode;
	this.birthYear = fields.birthYear;
}


/**
 * Check if creator exists in the database
 *
 * @return	bool			TRUE if the creator exists, FALSE if not
 */
Zotero.Creator.prototype.exists = function() {
	if (!this.id) {
		throw ('creatorID not set in Zotero.Creator.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM creators WHERE creatorID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


Zotero.Creator.prototype.hasChanged = function () {
	return this._changed;
}


Zotero.Creator.prototype.save = function () {
	Zotero.Creators.editCheck(this);
	
	Zotero.debug("Saving creator " + this.id);
	
	if (!this.firstName && !this.lastName) {
		throw ('First and last name are empty in Zotero.Creator.save()');
	}
	
	if (!this.hasChanged()) {
		Zotero.debug("Creator " + this.id + " has not changed");
		return false;
	}
	
	if (this.fieldMode == 1 && this.firstName) {
		throw ("First name ('" + this.firstName + "') must be empty in single-field mode in Zotero.Creator.save()");
	}
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var creatorID = this.id ? this.id : Zotero.ID.get('creators');
		
		var key = this.key ? this.key : this._generateKey();
		
		// If this was the only creator with the previous data,
		// see if we can reuse or remove the old data row
		if (this.creatorDataID) {
			var count = Zotero.Creators.countCreatorsWithData(this.creatorDataID);
			if (count == 1) {
				var newCreatorDataID = Zotero.Creators.getDataID(this);
				// Data hasn't changed
				if (this.creatorDataID == newCreatorDataID) {
					var creatorDataID = this.creatorDataID;
				}
				// Existing data row with the new data -- switch to that
				// and flag old row for deletion below
				else if (newCreatorDataID) {
					var deleteDataID = this.creatorDataID;
					var creatorDataID = newCreatorDataID;
				}
				// Update current data row with new data
				else {
					Zotero.Creators.updateData(this.creatorDataID, this);
					var creatorDataID = this.creatorDataID;
				}
			}
		}
		
		if (!creatorDataID) {
			var creatorDataID = Zotero.Creators.getDataID(this, true);
		}
		
		var columns = [
			'creatorID',
			'creatorDataID',
			'dateAdded',
			'dateModified',
			'clientDateModified',
			'libraryID',
			'key'
		];
		var placeholders = ['?', '?', '?', '?', '?', '?', '?'];
		var sqlValues = [
			creatorID ? { int: creatorID } : null,
			{ int: creatorDataID },
			// If date added isn't set, use current timestamp
			this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			Zotero.DB.transactionDateTime,
			this.libraryID ? this.libraryID : null,
			key
		];
		
		if (isNew) {
			var sql = "INSERT INTO creators (" + columns.join(', ') + ") VALUES ("
						+ placeholders.join(', ') + ")";
			var insertID = Zotero.DB.query(sql, sqlValues);
			if (!creatorID) {
				creatorID = insertID;
			}
		}
		else {
			// Remove tagID from beginning
			columns.shift();
			sqlValues.shift();
			sqlValues.push(creatorID);
			
			var sql = "UPDATE creators SET " + columns.join("=?, ") + "=?"
				+ " WHERE creatorID=?";
			Zotero.DB.query(sql, sqlValues);
		}
		
		if (deleteDataID) {
			Zotero.Creators.deleteData(deleteDataID);
		}
		
		if (this.id) {
			Zotero.debug("Updating linked items");
			this.updateLinkedItems();
		}
		
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	// If successful, set values in object
	if (!this.id) {
		this._id = creatorID;
	}
	if (!this.key) {
		this._key = key;
	}
	if (!this.creatorDataID) {
		this._creatorDataID = creatorDataID;
	}
	
	Zotero.Creators.reload(this.id);
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'creator', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'creator', this.id, this._previousData);
	}
	
	return this.id;
}


Zotero.Creator.prototype.countLinkedItems = function() {
	var sql = "SELECT COUNT(*) FROM itemCreators WHERE creatorID=?";
	return Zotero.DB.valueQuery(sql, this.id);
}


Zotero.Creator.prototype.getLinkedItems = function () {
	var sql = "SELECT itemID FROM itemCreators WHERE creatorID=?";
	return Zotero.DB.columnQuery(sql, this.id);
}


Zotero.Creator.prototype.updateLinkedItems = function () {
	Zotero.DB.beginTransaction();
	
	var sql = "SELECT itemID FROM itemCreators WHERE creatorID=?";
	var changedItemIDs = Zotero.DB.columnQuery(sql, this.id);
	
	if (!changedItemIDs) {
		Zotero.DB.commitTransaction();
		return;
	}
	
	var notifierData = {};
	for each(var id in changedItemIDs) {
		var item = Zotero.Items.get(id);
		if (item) {
			notifierData[item.id] = { old: item.serialize() };
		}
	}
	
	sql = "UPDATE items SET dateModified=?, clientDateModified=? WHERE itemID IN "
		+ "(SELECT itemID FROM itemCreators WHERE creatorID=?)";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, Zotero.DB.transactionDateTime, this.id]);
	
	Zotero.Items.reload(changedItemIDs);
	
	Zotero.DB.commitTransaction();
	
	Zotero.Notifier.trigger('modify', 'item', changedItemIDs, notifierData);
}


Zotero.Creator.prototype.equals = function (creator) {
	return (creator.firstName == this.firstName) &&
		(creator.lastName == this.lastName) &&
		(creator.fieldMode == this.fieldMode) &&
		(creator.shortName == this.shortName) &&
		(creator.birthYear == this.birthYear);
}


Zotero.Creator.prototype.serialize = function () {
	var obj = {};
	
	obj.primary = {};
	obj.primary.creatorID = this.id;
	obj.primary.libraryID = this.libraryID;
	obj.primary.key = this.key;
	obj.primary.dateAdded = this.dateAdded;
	obj.primary.dateModified = this.dateModified;
	
	obj.fields = {};
	if (this.fieldMode == 1) {
		obj.fields.name = this.lastName;
	}
	else {
		obj.fields.firstName = this.firstName;
		obj.fields.lastName = this.lastName;
	}
	obj.fields.fieldMode = this.fieldMode;
	obj.fields.shortName = this.shortName;
	obj.fields.birthYear = this.birthYear;
	
	return obj;
}


/**
 * Remove creator from all linked items
 *
 * Creators.erase() should be used instead of this
 *
 * Actual deletion of creator occurs in Zotero.Creators.purge(),
 * which is called by Creators.erase()
 */
Zotero.Creator.prototype.erase = function () {
	if (!this.id) {
		return false;
	}
	
	Zotero.debug("Deleting creator " + this.id);
	
	// TODO: notifier
	var changedItems = [];
	var changedItemsNotifierData = {};
	
	Zotero.DB.beginTransaction();
	
	var toSave = {};
	
	var linkedItemIDs = this.getLinkedItems();
	for each(var itemID in linkedItemIDs) {
		var item = Zotero.Items.get(itemID)
		if (!item) {
			throw ('Linked item not found in Zotero.Creator.erase()');
		}
		
		var pos = item.getCreatorPosition(this.id);
		if (!pos) {
			throw ('Creator not found in linked item in Zotero.Creator.erase()');
		}
		
		item.removeCreator(pos);
		
		if (!toSave[item.id]) {
			toSave[item.id] = item;
		}
	}
	
	for each(var item in toSave) {
		item.save();
	}
	
	Zotero.DB.commitTransaction();
	
	Zotero.Prefs.set('purge.creators', true);
}


Zotero.Creator.prototype.load = function (allowFail) {
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	var desc = id ? id : libraryID + "/" + key;
	
	Zotero.debug("Loading data for creator " + desc + " in Zotero.Creator.load()");
	
	if (!id && !key) {
		throw ("ID or key not set in Zotero.Creator.load()");
	}
	
	var sql = "SELECT C.*, CD.* FROM creators C NATURAL JOIN creatorData CD WHERE ";
	if (id) {
		sql += "creatorID=?";
		var params = id;
	}
	else {
		sql += "key=?";
		var params = [key];
		if (libraryID) {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		else {
			sql += " AND libraryID IS NULL";
		}
	}
	var row = Zotero.DB.rowQuery(sql, params);
	
	if (!row) {
		if (allowFail) {
			this._loaded = true;
			return false;
		}
		throw ("Creator " + desc + " not found in Zotero.Item.load()");
	}
	
	this.loadFromRow(row);
	return true;
}


Zotero.Creator.prototype.loadFromRow = function (row) {
	this._init();
	for (var col in row) {
		//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for creator " + this.id);
		switch (col) {
			case 'clientDateModified':
				continue;
			
			case 'creatorID':
				this._id = row[col];
				continue;
			
			case 'libraryID':
				this['_' + col] = row[col] ? row[col] : null;
				continue;
		}
		this['_' + col] = row[col] ? row[col] : '';
	}
	this._loaded = true;
}



Zotero.Creator.prototype._checkValue = function (field, value) {
	if (this['_' + field] === undefined) {
		throw ("Invalid property " + field + " in Zotero.Creator._checkValue()");
	}
	
	// Data validation
	switch (field) {
		case 'id':
			if (parseInt(value) != value) {
				this._invalidValueError(field, value);
			}
			break;
		
		case 'libraryID':
			if (value && parseInt(value) != value) {
				this._invalidValueError(field, value);
			}
			break;
			
		case 'fieldMode':
			if (value !== 0 && value !== 1) {
				this._invalidValueError(field, value);
			}
			break;
			
		case 'key':
			var re = /^[23456789ABCDEFGHIJKMNPQRSTUVWXTZ]{8}$/
			if (!re.test(value)) {
				this._invalidValueError(field, value);
			}
			break;
		
		case 'dateAdded':
		case 'dateModified':
			if (value !== '' && !Zotero.Date.isSQLDateTime(value)) {
				this._invalidValueError(field, value);
			}
			break;
	}
}


Zotero.Creator.prototype._generateKey = function () {
	return Zotero.ID.getKey();
}


Zotero.Creator.prototype._invalidValueError = function (field, value) {
	throw ("Invalid '" + field + "' value '" + value + "' in Zotero.Creator._invalidValueError()");
}
