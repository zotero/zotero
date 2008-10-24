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


Zotero.Creator = function (creatorID) {
	this._creatorID = creatorID ? creatorID : null;
	this._init();
}


Zotero.Creator.prototype._init = function () {
	this._firstName = null;
	this._lastName = null;
	this._fieldMode = null;
	this._birthYear = null;
	this._key = null;
	this._dateModified = null;
	
	this._creatorDataID = null;
	this._loaded = false;
	this._changed = false;
	this._previousData = false;
}


Zotero.Creator.prototype.__defineGetter__('id', function () { return this._creatorID; });
Zotero.Creator.prototype.__defineGetter__('creatorDataID', function () { return this._get('creatorDataID'); });

Zotero.Creator.prototype.__defineSetter__('creatorID', function (val) { this._set('creatorID', val); });
Zotero.Creator.prototype.__defineGetter__('firstName', function () { return this._get('firstName'); });
Zotero.Creator.prototype.__defineSetter__('firstName', function (val) { this._set('firstName', val); });
Zotero.Creator.prototype.__defineGetter__('lastName', function () { return this._get('lastName'); });
Zotero.Creator.prototype.__defineSetter__('lastName', function (val) { this._set('lastName', val); });
Zotero.Creator.prototype.__defineGetter__('fieldMode', function () { return this._get('fieldMode'); });
Zotero.Creator.prototype.__defineSetter__('fieldMode', function (val) { this._set('fieldMode', val); });
Zotero.Creator.prototype.__defineGetter__('birthYear', function () { return this._get('birthYear'); });
Zotero.Creator.prototype.__defineSetter__('birthYear', function (val) { this._set('birthYear', val); });
Zotero.Creator.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Creator.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });
Zotero.Creator.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Creator.prototype.__defineSetter__('key', function (val) { this._set('key', val); });

// Block properties that can't be set this way
Zotero.Creator.prototype.__defineSetter__('id', function () { this._set('id', val); });
Zotero.Creator.prototype.__defineSetter__('creatorDataID', function () { this._set('creatorDataID', val); });


Zotero.Creator.prototype._get = function (field) {
	if (this.id && !this._loaded) {
		this.load(true);
	}
	return this['_' + field];
}


Zotero.Creator.prototype._set = function (field, val) {
	switch (field) {
		case 'firstName':
		case 'lastName':
		case 'shortName':
			val = value = Zotero.Utilities.prototype.trim(val);
			break;
	}
	
	switch (field) {
		case 'id': // set using constructor
		//case 'creatorID': // set using constructor
		case 'creatorDataID':
			throw ("Invalid field '" + field + "' in Zotero.Creator.set()");
	}
	
	if (this.id) {
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


Zotero.Creator.prototype.setFields = function(fields) {
	for (var field in fields) {
		this[field] = fields[field];
	}
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
	
	// ID change
	if (this._changed['creatorID']) {
		var oldID = this._previousData.primary.creatorID;
		var params = [this.id, oldID];
		
		Zotero.debug("Changing creatorID " + oldID + " to " + this.id);
		
		var row = Zotero.DB.rowQuery("SELECT * FROM creators WHERE creatorID=?", oldID);
		// Add a new row so we can update the old rows despite FK checks
		// Use temp key due to UNIQUE constraint on key column
		Zotero.DB.query("INSERT INTO creators VALUES (?, ?, ?, ?)",
			[this.id, row.creatorDataID, row.dateModified, 'TEMPKEY']);
		
		Zotero.DB.query("UPDATE itemCreators SET creatorID=? WHERE creatorID=?", params);
		
		Zotero.DB.query("DELETE FROM creators WHERE creatorID=?", oldID);
		Zotero.DB.query("UPDATE creators SET key=? WHERE creatorID=?", [row.key, this.id]);
		
		Zotero.Notifier.trigger('id-change', 'creator', oldID + '-' + this.id);
		
		// Do this here because otherwise updateLinkedItems() below would
		// load a duplicate copy in the new position
		Zotero.Creators.reload(this.id);
		// update caches
	}
	
	var isNew = !this.id || !this.exists();
	
	try {
		// how to know if date modified changed (in server code too?)
		
		var creatorID = this.id ? this.id : Zotero.ID.get('creators');
		
		Zotero.debug("Saving creator " + this.id);
		
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
				// and delete old row
				else if (newCreatorDataID) {
					var creatorDataID = newCreatorDataID;
					Zotero.Creators.deleteData(this.creatorDataID);
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
		
		var columns = ['creatorID', 'creatorDataID', 'dateModified', 'key'];
		var placeholders = ['?', '?', '?', '?'];
		var sqlValues = [
			creatorID ? { int: creatorID } : null,
			{ int: creatorDataID },
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			key
		];
		
		var sql = "REPLACE INTO creators (" + columns.join(', ') + ") VALUES ("
			+ placeholders.join(', ') + ")";
		var insertID = Zotero.DB.query(sql, sqlValues);
		if (!creatorID) {
			creatorID = insertID;
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
		this._creatorID = creatorID;
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
	
	sql = "UPDATE items SET dateModified=? WHERE itemID IN "
		+ "(SELECT itemID FROM itemCreators WHERE creatorID=?)";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, this.id]);
	
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
	obj.primary.dateModified = this.dateModified;
	obj.primary.key = this.key;
	
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
}


Zotero.Creator.prototype.load = function (allowFail) {
	Zotero.debug("Loading data for creator " + this.id + " in Zotero.Creator.load()");
	
	if (!this.id) {
		throw ("creatorID not set in Zotero.Creator.load()");
	}
	
	var sql = "SELECT C.*, CD.* FROM creators C NATURAL JOIN creatorData CD "
				+ "WHERE creatorID=?";
	var row = Zotero.DB.rowQuery(sql, this.id);
	
	if (!row) {
		if (allowFail) {
			this._loaded = true;
			return false;
		}
		throw ("Creator " + this.id + " not found in Zotero.Item.load()");
	}
	
	this.loadFromRow(row);
	return true;
}


Zotero.Creator.prototype.loadFromRow = function (row) {
	this._init();
	
	for (var col in row) {
		//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for creator " + this.id);
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
