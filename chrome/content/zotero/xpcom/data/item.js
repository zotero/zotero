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


/*
 * Constructor for Item object
 *
 * Generally should be called through Zotero.Items rather than directly
 */
Zotero.Item = function(itemTypeOrID) {
	if (arguments[1] || arguments[2]) {
		throw ("Zotero.Item constructor only takes one parameter");
	}
	
	this._disabled = false;
	this._init();
	
	if (itemTypeOrID) {
		// setType initializes type-specific properties in this._itemData
		this.setType(Zotero.ItemTypes.getID(itemTypeOrID));
	}
}

Zotero.Item.prototype._init = function () {
	// Primary fields
	this._id = null;
	this._libraryID = null
	this._key = null;
	this._itemTypeID = null;
	this._dateAdded = null;
	this._dateModified = null;
	this._firstCreator = null;
	this._numNotes = null;
	this._numNotesTrashed = null;
	this._numNotesEmbedded = null;
	this._numNotesEmbeddedIncludingTrashed = null;
	this._numAttachments = null;
	
	this._creators = [];
	this._itemData = null;
	this._sourceItem = null;
	
	this._primaryDataLoaded = false;
	this._creatorsLoaded = false;
	this._itemDataLoaded = false;
	this._relatedItemsLoaded = false;
	
	this._changed = {};
	this._changedPrimaryData = false;
	this._changedItemData = false;
	this._changedCreators = false;
	this._changedDeleted = false;
	this._changedNote = false;
	this._changedSource = false;
	this._changedAttachmentData = false;
	
	this._previousData = {};
	
	this._bestAttachmentState = null;
	this._fileExists = null;
	
	this._deleted = null;
	this._hasNote = null;
	this._noteTitle = null;
	this._noteText = null;
	this._noteAccessTime = null;
	this._cachedAttachments = null;
	this._cachedNotes = null;
	
	this._attachmentLinkMode = null;
	this._attachmentMIMEType = null;
	this._attachmentCharset;
	this._attachmentPath = null;
	this._attachmentSyncState;
	
	this._relatedItems = false;
}


Zotero.Item.prototype.__defineGetter__('objectType', function () { return 'item'; });
Zotero.Item.prototype.__defineGetter__('id', function () {
	if(!this._id && this._key && !this._primaryDataLoaded) {
		this.loadPrimaryData(true);
	}
	return this._id;
});
Zotero.Item.prototype.__defineGetter__('itemID', function () {
	Zotero.debug("Item.itemID is deprecated -- use Item.id");
	return this.id;
});
Zotero.Item.prototype.__defineSetter__('id', function (val) { this.setField('id', val); });
Zotero.Item.prototype.__defineGetter__('libraryID', function () { return this.getField('libraryID'); });
// Temporary until everything expects an integer
Zotero.Item.prototype.__defineGetter__('libraryIDInt', function () { var libraryID = this.getField('libraryID'); return libraryID ? parseInt(libraryID) : 0; });
Zotero.Item.prototype.__defineSetter__('libraryID', function (val) { this.setField('libraryID', val); });
Zotero.Item.prototype.__defineGetter__('key', function () { return this.getField('key'); });
Zotero.Item.prototype.__defineSetter__('key', function (val) { this.setField('key', val) });
Zotero.Item.prototype.__defineGetter__('itemTypeID', function () {
	if(!this._itemTypeID && (this._id || this._key) && !this._primaryDataLoaded) {
		this.loadPrimaryData(true);
	}
	return this._itemTypeID;
});
Zotero.Item.prototype.__defineGetter__('dateAdded', function () { return this.getField('dateAdded'); });
Zotero.Item.prototype.__defineGetter__('dateModified', function () { return this.getField('dateModified'); });
Zotero.Item.prototype.__defineGetter__('firstCreator', function () { return this.getField('firstCreator'); });

Zotero.Item.prototype.__defineGetter__('relatedItems', function () { var ids = this._getRelatedItems(true); return ids; });
Zotero.Item.prototype.__defineSetter__('relatedItems', function (arr) { this._setRelatedItems(arr); });
Zotero.Item.prototype.__defineGetter__('relatedItemsReverse', function () { var ids = this._getRelatedItemsReverse(); return ids; });
Zotero.Item.prototype.__defineGetter__('relatedItemsBidirectional', function () { var ids = this._getRelatedItemsBidirectional(); return ids; });

Zotero.Item.prototype.__defineGetter__('libraryKey', function () this.libraryIDInt + "/" + this.key);

Zotero.Item.prototype.getID = function() {
	Zotero.debug('Item.getID() is deprecated -- use Item.id');
	return this.id;
}

Zotero.Item.prototype.getType = function() {
	Zotero.debug('Item.getType() is deprecated -- use Item.itemTypeID');
	return this.getField('itemTypeID');
}

Zotero.Item.prototype.isPrimaryField = function (fieldName) {
	Zotero.debug("Zotero.Item.isPrimaryField() is deprecated -- use Zotero.Items.isPrimaryField()");
	return Zotero.Items.isPrimaryField(fieldName);
}


//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////
/**
 * Check if item exists in the database
 *
 * @return	bool			TRUE if the item exists, FALSE if not
 */
Zotero.Item.prototype.exists = function() {
	if (!this.id) {
		throw ('itemID not set in Zotero.Item.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM items WHERE itemID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


/*
 * Retrieves (and loads from DB, if necessary) an itemData field value
 *
 * Field can be passed as fieldID or fieldName
 *
 * If |unformatted| is true, skip any special processing of DB value
 *		(e.g. multipart date field) (default false)
 *
 * If |includeBaseMapped| is true and field is a base field, returns value of
 * 		type-specific field instead (e.g. 'label' for 'publisher' in 'audioRecording')
 */
Zotero.Item.prototype.getField = function(field, unformatted, includeBaseMapped) {
	// We don't allow access after saving to force use of the centrally cached
	// object, but we make an exception for the id
	if (field != 'id') {
		this._disabledCheck();
	}
	
	//Zotero.debug('Requesting field ' + field + ' for item ' + this._id, 4);
	
	if ((this._id || this._key) && !this._primaryDataLoaded) {
		this.loadPrimaryData(true);
	}
	
	if (field === 'firstCreator' && !this.id) {
		// Hack to get a firstCreator for an unsaved item
		var creators = this.getCreators();
		if(creators.length === 0) {
			return "";
		} else if(creators.length === 1) {
			return creators[0].ref.lastName;
		} else if(creators.length === 2) {
			return creators[0].ref.lastName+" "+Zotero.getString('general.and')+" "+creators[1].ref.lastName;
		} else if(creators.length > 3) {
			return creators[0].ref.lastName+" "+Zotero.getString('general.etAl');
		}
	} else if (field === 'id' || Zotero.Items.isPrimaryField(field)) {
		var privField = '_' + field;
		//Zotero.debug('Returning ' + (this[privField] ? this[privField] : '') + ' (typeof ' + typeof this[privField] + ')');
		return this[privField];
	}
	
	if (this.isNote()) {
		switch (Zotero.ItemFields.getName(field)) {
			case 'title':
				return this.getNoteTitle();
				
			default:
				return '';
		}
	}
	
	if (includeBaseMapped) {
		var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(
			this.itemTypeID, field
		);
	}
	
	if (!fieldID) {
		var fieldID = Zotero.ItemFields.getID(field);
	}
	
	if (typeof this._itemData[fieldID] == 'undefined') {
		//Zotero.debug("Field '" + field + "' doesn't exist for item type " + this._itemTypeID + " in Item.getField()");
		return '';
	}
	
	if (!this._itemDataLoaded && this.id && this._itemData[fieldID] === null) {
		this._loadItemData();
	}
	
	var value = this._itemData[fieldID] ? this._itemData[fieldID] : '';
	
	if (!unformatted) {
		// Multipart date fields
		// TEMP - filingDate
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') || field == 'filingDate') {
			value = Zotero.Date.multipartToStr(value);
		}
	}
	//Zotero.debug('Returning ' + value);
	return value;
}


/**
 * @param	{Boolean}				asNames
 * @return	{Integer{}|String[]}
 */
Zotero.Item.prototype.getUsedFields = function(asNames) {
	if (!this.id) {
		return [];
	}
	var sql = "SELECT fieldID FROM itemData WHERE itemID=?";
	if (asNames) {
		sql = "SELECT fieldName FROM fields WHERE fieldID IN (" + sql + ")";
	}
	var fields = Zotero.DB.columnQuery(sql, this.id);
	if (!fields) {
		return [];
	}
	return fields;
}



/*
 * Build object from database
 */
Zotero.Item.prototype.loadPrimaryData = function(allowFail) {
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	
	if (!id && !key) {
		throw ('ID or key not set in Zotero.Item.loadPrimaryData()');
	}
	
	var columns = [], join = [], where = [];
	for each(var field in Zotero.Items.primaryFields) {
		var colSQL = null, joinSQL = null, whereSQL = null;
		
		// If field not already set
		if (field == 'itemID' || this['_' + field] === null) {
			// Parts should be the same as query in Zotero.Items._load, just
			// without itemID clause
			switch (field) {
				case 'itemID':
				case 'itemTypeID':
				case 'dateAdded':
				case 'dateModified':
				case 'key':
					colSQL = 'I.' + field;
					break;
				
				case 'firstCreator':
					colSQL = Zotero.Items.getFirstCreatorSQL();
					break;
					
				case 'numNotes':
					colSQL = '(SELECT COUNT(*) FROM itemNotes INo '
						+ 'WHERE sourceItemID=I.itemID AND INo.itemID '
						+ 'NOT IN (SELECT itemID FROM deletedItems)) AS numNotes';
					break;
					
				case 'numAttachments':
					colSQL = '(SELECT COUNT(*) FROM itemAttachments IA '
						+ 'WHERE sourceItemID=I.itemID AND IA.itemID '
						+ 'NOT IN (SELECT itemID FROM deletedItems)) AS numAttachments';
					break;
			}
			if (colSQL) {
				columns.push(colSQL);
			}
			if (joinSQL) {
				join.push(joinSQL);
			}
			if (whereSQL) {
				where.push(whereSQL);
			}
		}
	}
	
	if (!columns.length) {
		throw ("No columns to load in Zotero.Item.loadPrimaryData()");
	}
	
	var sql = 'SELECT ' + columns.join(', ') + " FROM items I "
				+ (join.length ? join.join(' ') + ' ' : '') + "WHERE ";
	if (id) {
		sql += "itemID=? ";
		var params = id;
	}
	else {
		sql += "key=? ";
		var params = [key];
		if (libraryID) {
			sql += "AND libraryID=? ";
			params.push(libraryID);
		}
		else {
			sql += "AND libraryID IS NULL ";
		}
	}
	sql += (where.length ? ' AND ' + where.join(' AND ') : '');
	var row = Zotero.DB.rowQuery(sql, params);
	
	if (!row) {
		if (allowFail) {
			this._primaryDataLoaded = true;
			return false;
		}
		throw ("Item " + (id ? id : libraryID + "/" + key)
				+ " not found in Zotero.Item.loadPrimaryData()");
	}
	
	this.loadFromRow(row);
	return true;
}


/*
 * Populate basic item data from a database row
 */
Zotero.Item.prototype.loadFromRow = function(row, reload) {
	if (reload) {
		this._init();
	}
	
	// If necessary or reloading, set the type and reinitialize this._itemData
	if (reload || (!this._itemTypeID && row.itemTypeID)) {
		this.setType(row.itemTypeID, true);
	}
	
	for (var col in row) {
		if (col == 'clientDateModified') {
			continue;
		}
		
		// Only accept primary field data through loadFromRow()
		if (Zotero.Items.isPrimaryField(col)) {
			//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for item " + this.id);
			switch (col) {
				case 'itemID':
					this._id = row[col];
					break;
				
				case 'libraryID':
					this['_' + col] = row[col] ? row[col] : null;
					break;
				
				case 'numNotes':
				case 'numAttachments':
					this['_' + col] = row[col] ? parseInt(row[col]) : 0;
					break;
				
				case 'sourceItemID':
					this['_sourceItem'] = row[col] || false;
				
				default:
					this['_' + col] = row[col] ? row[col] : '';
			}
		}
		else {
			Zotero.debug(col + ' is not a valid primary field');
		}
	}
	
	this._primaryDataLoaded = true;
}


/*
 * Check if any data fields have changed since last save
 */
Zotero.Item.prototype.hasChanged = function() {
	return !!(Object.keys(this._changed).length
		|| this._changedPrimaryData
		|| this._changedItemData
		|| this._changedCreators
		|| this._changedDeleted
		|| this._changedNote
		|| this._changedSource
		|| this._changedAttachmentData);
}


/*
 * Set or change the item's type
 */
Zotero.Item.prototype.setType = function(itemTypeID, loadIn) {
	if (itemTypeID == this._itemTypeID) {
		return true;
	}
	
	var oldItemTypeID = this._itemTypeID;
	var newNotifierFields = [];
	
	if (oldItemTypeID) {
		if (loadIn) {
			throw ('Cannot change type in loadIn mode in Zotero.Item.setType()');
		}
		if (!this._itemDataLoaded && this.id) {
			this._loadItemData();
		}
		
		var copiedFields = [];
		
		// Special cases handled below
		var bookTypeID = Zotero.ItemTypes.getID('book');
		var bookSectionTypeID = Zotero.ItemTypes.getID('bookSection');
		
		var obsoleteFields = this.getFieldsNotInType(itemTypeID);
		if (obsoleteFields) {
			// Move bookTitle to title and clear short title when going from
			// bookSection to book if there's not also a title
			if (oldItemTypeID == bookSectionTypeID && itemTypeID == bookTypeID) {
				var titleFieldID = Zotero.ItemFields.getID('title');
				var bookTitleFieldID = Zotero.ItemFields.getID('bookTitle');
				var shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
				if (this._itemData[bookTitleFieldID] && !this._itemData[titleFieldID]) {
					copiedFields.push([titleFieldID, this._itemData[bookTitleFieldID]]);
					newNotifierFields.push(titleFieldID);
					if (this._itemData[shortTitleFieldID]) {
						this.setField(shortTitleFieldID, false);
					}
				}
			}
			
			for each(var oldFieldID in obsoleteFields) {
				// Try to get a base type for this field
				var baseFieldID =
					Zotero.ItemFields.getBaseIDFromTypeAndField(oldItemTypeID, oldFieldID);
				
				if (baseFieldID) {
					var newFieldID =
						Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, baseFieldID);
						
					// If so, save value to copy to new field
					if (newFieldID) {
						copiedFields.push([newFieldID, this.getField(oldFieldID)]);
					}
				}
				
				// Clear old field
				/*
				delete this._itemData[oldFieldID];
				if (!this._changedItemData) {
					this._changedItemData = {};
				}
				this._changedItemData[oldFieldID] = true;
				*/
				this.setField(oldFieldID, false);
			}
		}
		
		// Move title to bookTitle and clear shortTitle when going from book to bookSection
		if (oldItemTypeID == bookTypeID && itemTypeID == bookSectionTypeID) {
			var titleFieldID = Zotero.ItemFields.getID('title');
			var bookTitleFieldID = Zotero.ItemFields.getID('bookTitle');
			var shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
			if (this._itemData[titleFieldID]) {
				copiedFields.push([bookTitleFieldID, this._itemData[titleFieldID]]);
				newNotifierFields.push(bookTitleFieldID);
				this.setField(titleFieldID, false);
			}
			if (this._itemData[shortTitleFieldID]) {
				this.setField(shortTitleFieldID, false);
			}
		}
		
		for (var fieldID in this._itemData) {
			if (this._itemData[fieldID] &&
					(!obsoleteFields || obsoleteFields.indexOf(fieldID) == -1)) {
				copiedFields.push([fieldID, this.getField(fieldID)]);
			}
		}
	}
	
	this._itemTypeID = itemTypeID;
	
	// If there's an existing type
	if (oldItemTypeID) {
		// Reset custom creator types to the default
		var creators = this.getCreators();
		if (creators) {
			var removeAll = !Zotero.CreatorTypes.itemTypeHasCreators(itemTypeID);
			for (var i in creators) {
				// Remove all creators if new item type doesn't have any
				if (removeAll) {
					this.removeCreator(i);
					continue;
				}
				
				if (!Zotero.CreatorTypes.isValidForItemType(creators[i].creatorTypeID, itemTypeID)) {
					// Convert existing primary creator type to new item type's
					// primary creator type, or contributor (creatorTypeID 2)
					// if none or not currently primary
					var oldPrimary = Zotero.CreatorTypes.getPrimaryIDForType(oldItemTypeID);
					if (oldPrimary == creators[i].creatorTypeID) {
						var newPrimary = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
					}
					var target = newPrimary ? newPrimary : 2;
					
					this.setCreator(i, creators[i].ref, target);
				}
			}
		}
	}
	
	// Initialize this._itemData with type-specific fields
	this._itemData = {};
	var fields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
	for each(var fieldID in fields) {
		this._itemData[fieldID] = null;
	}
	
	// DEBUG: clear change item data?
	
	if (copiedFields) {
		for each(var f in copiedFields) {
			// For fields that we moved to different fields in the new type
			// (e.g., book -> bookTitle), mark the old value as explicitly
			// false in previousData (since otherwise it would be null)
			if (newNotifierFields.indexOf(f[0]) != -1) {
				this._markFieldChange(Zotero.ItemFields.getName(f[0]), false);
				this.setField(f[0], f[1]);
			}
			// For fields that haven't changed, clear from previousData
			// after setting
			else {
				this.setField(f[0], f[1]);
				this._clearFieldChange(Zotero.ItemFields.getName(f[0]));
			}
		}
	}
	
	if (loadIn) {
		this._itemDataLoaded = false;
	}
	else {
		if (oldItemTypeID) {
			this._markFieldChange('itemType', Zotero.ItemTypes.getName(oldItemTypeID));
		}
		if (!this._changedPrimaryData) {
			this._changedPrimaryData = {};
		}
		this._changedPrimaryData['itemTypeID'] = true;
	}
	
	return true;
}


/*
 * Find existing fields from current type that aren't in another
 *
 * If _allowBaseConversion_, don't return fields that can be converted
 * via base fields (e.g. label => publisher => studio)
 */
Zotero.Item.prototype.getFieldsNotInType = function (itemTypeID, allowBaseConversion) {
	var fieldIDs = [];
	
	for (var field in this._itemData) {
		if (this._itemData[field]) {
			var fieldID = Zotero.ItemFields.getID(field);
			if (Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
				continue;
			}
			
			if (allowBaseConversion) {
				var baseID = Zotero.ItemFields.getBaseIDFromTypeAndField(this.itemTypeID, field);
				if (baseID) {
					var newFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, baseID);
					if (newFieldID) {
						continue;
					}
				}
			}
			
			fieldIDs.push(fieldID);
		}
	}
	/*
	var sql = "SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?1 AND "
		+ "fieldID IN (SELECT fieldID FROM itemData WHERE itemID=?2) AND "
		+ "fieldID NOT IN (SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?3)";
		
	if (allowBaseConversion) {
		// Not the type-specific field for a base field in the new type
		sql += " AND fieldID NOT IN (SELECT fieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?1 AND baseFieldID IN "
			+ "(SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?3)) AND ";
		// And not a base field with a type-specific field in the new type
		sql += "fieldID NOT IN (SELECT baseFieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?3) AND ";
		// And not the type-specific field for a base field that has
		// a type-specific field in the new type
		sql += "fieldID NOT IN (SELECT fieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?1 AND baseFieldID IN "
			+ "(SELECT baseFieldID FROM baseFieldMappings WHERE itemTypeID=?3))";
	}
	
	return Zotero.DB.columnQuery(sql, [this.itemTypeID, this.id, { int: itemTypeID }]);
	*/
	if (!fieldIDs.length) {
		return false;
	}
	
	return fieldIDs;
}


/**
* Return an array of collectionIDs for all collections the item belongs to
**/
Zotero.Item.prototype.getCollections = function() {
	var ids = Zotero.DB.columnQuery(
		"SELECT collectionID FROM collectionItems WHERE itemID=?", this.id
	);
	return ids ? ids : [];
}


/**
* Determine whether the item belongs to a given collectionID
**/
Zotero.Item.prototype.inCollection = function(collectionID) {
	return !!parseInt(Zotero.DB.valueQuery("SELECT COUNT(*) "
		+ "FROM collectionItems WHERE collectionID=" + collectionID + " AND "
		+ "itemID=" + this.id));
}


/*
 * Set a field value, loading existing itemData first if necessary
 *
 * Field can be passed as fieldID or fieldName
 */
Zotero.Item.prototype.setField = function(field, value, loadIn) {
	if (typeof value == 'string') {
		value = value.trim();
	}
	
	this._disabledCheck();
	
	//Zotero.debug("Setting field '" + field + "' to '" + value + "' (loadIn: " + (loadIn ? 'true' : 'false') + ") for item " + this.id + " ");
	
	if (!field) {
		throw ("Field not specified in Item.setField()");
	}
	
	// Set id, libraryID, and key without loading data first
	switch (field) {
		case 'id':
		case 'libraryID':
		case 'key':
			if (value == this['_' + field]) {
				return;
			}
			
			if (this._primaryDataLoaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Item.setField()");
			}
			//this._checkValue(field, val);
			this['_' + field] = value;
			return;
	}
	
	if (this._id || this._key) {
		if (!this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
	}
	else {
		this._primaryDataLoaded = true;
	}
	
	// Primary field
	if (Zotero.Items.isPrimaryField(field)) {
		if (loadIn) {
			throw('Cannot set primary field ' + field + ' in loadIn mode in Zotero.Item.setField()');
		}
		
		switch (field) {
			case 'itemID':
			case 'firstCreator':
			case 'numNotes':
			case 'numAttachments':
			case 'sourceItemID':
				throw ('Primary field ' + field + ' cannot be changed in Zotero.Item.setField()');
		}
		
		/*
		if (!Zotero.ItemFields.validate(field, value)) {
			throw("Value '" + value + "' of type " + typeof value + " does not validate for field '" + field + "' in Zotero.Item.setField()");
		}
		*/
		
		// If field value has changed
		if (this['_' + field] != value) {
			Zotero.debug("Field '" + field + "' has changed from '" + this['_' + field] + "' to '" + value + "'", 4);
			
			// Save a copy of the field before modifying
			this._markFieldChange(field, this['_' + field]);
			
			if (field == 'itemTypeID') {
				this.setType(value, loadIn);
			}
			else {
				this['_' + field] = value;
				
				if (!this._changedPrimaryData) {
					this._changedPrimaryData = {};
				}
				this._changedPrimaryData[field] = true;
			}
		}
		else {
			Zotero.debug("Field '" + field + "' has not changed", 4);
		}
		return true;
	}
	
	if (!this.itemTypeID) {
		throw ('Item type must be set before setting field data');
	}
	
	// If existing item, load field data first unless we're already in
	// the middle of a load
	if (this.id) {
		if (!loadIn && !this._itemDataLoaded) {
			this._loadItemData();
		}
	}
	else {
		this._itemDataLoaded = true;
	}
	
	var fieldID = Zotero.ItemFields.getID(field);
	
	if (!fieldID) {
		throw ('"' + field + '" is not a valid itemData field.');
	}
	
	if (loadIn && this.isNote() && field == 110) { // title
		this._noteTitle = value;
		return true;
	}
	
	if (value === "") {
		value = false;
	}
	
	if (value !== false && !Zotero.ItemFields.isValidForType(fieldID, this.itemTypeID)) {
		var msg = "'" + field + "' is not a valid field for type " + this.itemTypeID;
		
		if (loadIn) {
			Zotero.debug(msg + " -- ignoring value '" + value + "'", 2);
			return false;
		}
		else {
			throw new Error(msg);
		}
	}
	
	// If not a multiline field, strip newlines
	if (typeof value == 'string' && !Zotero.ItemFields.isMultiline(fieldID)) {
		value = value.replace(/[\r\n]+/g, " ");;
	}
	
	if (!loadIn) {
		// Save date field as multipart date
		// TEMP - filingDate
		if (value !== false
				&& (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') || field == 'filingDate')
				&& !Zotero.Date.isMultipart(value)) {
			value = Zotero.Date.strToMultipart(value);
		}
		// Validate access date
		else if (fieldID == Zotero.ItemFields.getID('accessDate')) {
			if (value && (!Zotero.Date.isSQLDate(value) &&
					!Zotero.Date.isSQLDateTime(value) &&
					value != 'CURRENT_TIMESTAMP')) {
				Zotero.debug("Discarding invalid accessDate '" + value
					+ "' in Item.setField()");
				return false;
			}
		}
		
		// If existing value, make sure it's actually changing
		if ((typeof this._itemData[fieldID] == 'undefined' && value === false)
				|| (typeof this._itemData[fieldID] != 'undefined'
					&& this._itemData[fieldID] === value)) {
			return false;
		}
		
		// Save a copy of the field before modifying
		this._markFieldChange(
			Zotero.ItemFields.getName(field), this._itemData[fieldID]
		);
	}
	
	this._itemData[fieldID] = value;
	
	if (!loadIn) {
		if (!this._changedItemData) {
			this._changedItemData = {};
		}
		this._changedItemData[fieldID] = true;
	}
	return true;
}

/*
 * Get the title for an item for display in the interface
 *
 * This is the same as the standard title field (with includeBaseMapped on)
 * except for letters and interviews, which get placeholder titles in
 * square braces (e.g. "[Letter to Thoreau]")
 */
Zotero.Item.prototype.getDisplayTitle = function (includeAuthorAndDate) {
	var title = this.getField('title', false, true);
	var itemTypeID = this.itemTypeID;
	var itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
	
	if (!title && (itemTypeID == 8 || itemTypeID == 10)) { // 'letter' and 'interview' itemTypeIDs
		var creators = this.getCreators();
		var authors = [];
		var participants = [];
		if (creators) {
			for each(var creator in creators) {
				if ((itemTypeID == 8 && creator.creatorTypeID == 16) || // 'letter'/'recipient'
						(itemTypeID == 10 && creator.creatorTypeID == 7)) { // 'interview'/'interviewer'
					participants.push(creator);
				}
				else if ((itemTypeID == 8 && creator.creatorTypeID == 1) ||   // 'letter'/'author'
						(itemTypeID == 10 && creator.creatorTypeID == 6)) { // 'interview'/'interviewee'
					authors.push(creator);
				}
			}
		}
		
		var strParts = [];
		
		if (includeAuthorAndDate) {
			var names = [];
			for each(author in authors) {
				names.push(author.ref.lastName);
			}
			
			// TODO: Use same logic as getFirstCreatorSQL() (including "et al.")
			if (names.length) {
				strParts.push(Zotero.localeJoin(names, ', '));
			}
		}
		
		if (participants.length > 0) {
			var names = [];
			for each(participant in participants) {
				names.push(participant.ref.lastName);
			}
			switch (names.length) {
				case 1:
					var str = 'oneParticipant';
					break;
					
				case 2:
					var str = 'twoParticipants';
					break;
					
				case 3:
					var str = 'threeParticipants';
					break;
					
				default:
					var str = 'manyParticipants';
			}
			strParts.push(Zotero.getString('pane.items.' + itemTypeName + '.' + str, names));
		}
		else {
			strParts.push(Zotero.ItemTypes.getLocalizedString(itemTypeID));
		}
		
		if (includeAuthorAndDate) {
			var d = this.getField('date');
			if (d) {
				strParts.push(d);
			}
		}
		
		title = '[';
		title += Zotero.localeJoin(strParts, '; ');
		title += ']';
	}
	else if (itemTypeID == 17) { // 'case' itemTypeID
		if (title) { // common law cases always have case names
			var reporter = this.getField('reporter');
			if (reporter) { 
				title = title + ' (' + reporter + ')';
			} else {
				var court = this.getField('court');
				if (court) {
					title = title + ' (' + court + ')';
				}
			}
		}
		else { // civil law cases have only shortTitle as case name
			var strParts = [];
			var caseinfo = "";
			
			var part = this.getField('court');
			if (part) {
				strParts.push(part);
			}
			
			part = Zotero.Date.multipartToSQL(this.getField('date', true, true));
			if (part) {
				strParts.push(part);
			}

			part = this.getField('shortTitle');
			if (part) {
				strParts.push(part);
			}
			
			var creators = this.getCreators();
			if (creators.length && creators[0].creatorTypeID === 1) {
				strParts.push(creators[0].ref.lastName);
			}
			
			title = '[';
			title += Zotero.localeJoin(strParts, ', ');
			title += ']';
		}
	}
	
	return title;
}


/*
 * Returns the number of creators for this item
 */
Zotero.Item.prototype.numCreators = function() {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	return this._creators.length;
}


Zotero.Item.prototype.hasCreatorAt = function(pos) {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	
	return !!this._creators[pos];
}


/*
 * Returns an array of the creator data at the given position, or false if none
 *
 * Note: Creator data array is returned by reference
 */
Zotero.Item.prototype.getCreator = function(pos) {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	
	return this._creators[pos] ? this._creators[pos] : false;
}


/**
 * Return the position of the given creator, or FALSE if not found
 */
Zotero.Item.prototype.getCreatorPosition = function(creatorID) {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	
	for (var pos in this._creators) {
		if (this._creators[pos].creatorID == creatorID) {
			return pos;
		}
	}
	
	return false;
}


/*
 * Returns a multidimensional array of creators, or an empty array if none
 *
 * Note: Creator data array is returned by reference
 */
Zotero.Item.prototype.getCreators = function() {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	
	return this._creators;
}


/*
 * Set or update the creator at the specified position
 *
 * |orderIndex|: the position of this creator in the item (from 0)
 * |creatorTypeIDOrName|: id or type name
 */
Zotero.Item.prototype.setCreator = function(orderIndex, creator, creatorTypeIDOrName) {
	if (this.id) {
		if (!this._creatorsLoaded) {
			this._loadCreators();
		}
	}
	else {
		this._creatorsLoaded = true;
	}
	
	if (!(creator instanceof Zotero.Creator)) {
		throw ('Creator must be a Zotero.Creator object in Zotero.Item.setCreator()');
	}
	
	var creatorTypeID = Zotero.CreatorTypes.getID(creatorTypeIDOrName);
	
	if (!creatorTypeID) {
		creatorTypeID = 1;
	}
	
	// If creatorTypeID isn't valid for this type, use the primary type
	if (!Zotero.CreatorTypes.isValidForItemType(creatorTypeID, this.itemTypeID)) {
		var msg = "Invalid creator type " + creatorTypeID + " for item type " + this.itemTypeID
				+ " -- changing to primary creator";
		Zotero.debug(msg);
		Components.utils.reportError(msg)
		creatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(this.itemTypeID);
	}
	
	// If creator at this position hasn't changed, cancel
	if (this._creators[orderIndex] &&
			this._creators[orderIndex].ref.id == creator.id &&
			this._creators[orderIndex].creatorTypeID == creatorTypeID &&
			!creator.hasChanged()) {
		Zotero.debug("Creator in position " + orderIndex + " hasn't changed", 4);
		return false;
	}
	
	// Save copy of old creators for notifier
	if (!this._changedCreators) {
		this._changedCreators = {};
		
		var oldCreators = this._getOldCreators()
		this._markFieldChange('creators', oldCreators);
	}
	this._changedCreators[orderIndex] = true;
	
	this._creators[orderIndex] = {
		ref: creator,
		creatorTypeID: creatorTypeID
	};
	
	return true;
}


/*
 * Remove a creator and shift others down
 */
Zotero.Item.prototype.removeCreator = function(orderIndex) {
	if (!this._creatorsLoaded && this.id) {
		this._loadCreators();
	}
	
	var creator = this.getCreator(orderIndex);
	if (!creator) {
		throw ('No creator exists at position ' + orderIndex
			+ ' in Zotero.Item.removeCreator()');
	}
	
	if (creator.ref.countLinkedItems() == 1) {
		Zotero.Prefs.set('purge.creators', true);
	}
	
	// Save copy of old creators for notifier
	if (!this._changedCreators) {
		this._changedCreators = {};
		
		var oldCreators = this._getOldCreators();
		this._markFieldChange('creators', oldCreators);
	}
	
	// Shift creator orderIndexes down, going to length+1 so we clear the last one
	for (var i=orderIndex, max=this._creators.length+1; i<max; i++) {
		var next = this._creators[i+1] ? this._creators[i+1] : false;
		if (next) {
			this._creators[i] = next;
		}
		else {
			this._creators.splice(i, 1);
		}
		
		this._changedCreators[i] = true;
	}
	
	return true;
}


Zotero.Item.prototype.__defineGetter__('deleted', function () {
	if (this._deleted !== null) {
		return this._deleted;
	}
	
	if (!this.id) {
		return false;
	}
	
	var sql = "SELECT COUNT(*) FROM deletedItems WHERE itemID=?";
	var deleted = !!Zotero.DB.valueQuery(sql, this.id);
	this._deleted = deleted;
	return deleted;
});


Zotero.Item.prototype.__defineSetter__('deleted', function (val) {
	var deleted = !!val;
	
	if (this.deleted == deleted) {
		Zotero.debug("Deleted state hasn't changed for item " + this.id);
		return;
	}
	
	if (!this._changedDeleted) {
		this._changedDeleted = true;
	}
	this._deleted = deleted;
});


Zotero.Item.prototype.addRelatedItem = function (itemID) {
	var parsedInt = parseInt(itemID);
	if (parsedInt != itemID) {
		throw ("itemID '" + itemID + "' not an integer in Zotero.Item.addRelatedItem()");
	}
	itemID = parsedInt;
	
	if (itemID == this.id) {
		Zotero.debug("Can't relate item to itself in Zotero.Item.addRelatedItem()", 2);
		return false;
	}
	
	var current = this._getRelatedItems(true);
	if (current.indexOf(itemID) != -1) {
		Zotero.debug("Item " + this.id + " already related to item "
			+ itemID + " in Zotero.Item.addItem()");
		return false;
	}
	
	var item = Zotero.Items.get(itemID);
	if (!item) {
		throw ("Can't relate item to invalid item " + itemID
			+ " in Zotero.Item.addRelatedItem()");
	}
	/*
	var otherCurrent = item.relatedItems;
	if (otherCurrent.length && otherCurrent.indexOf(this.id) != -1) {
		Zotero.debug("Other item " + itemID + " already related to item "
			+ this.id + " in Zotero.Item.addItem()");
		return false;
	}
	*/
	
	this._markFieldChange('related', current);
	this._changed.relatedItems = true;
	this._relatedItems.push(item);
	return true;
}


Zotero.Item.prototype.removeRelatedItem = function (itemID) {
	var parsedInt = parseInt(itemID);
	if (parsedInt != itemID) {
		throw ("itemID '" + itemID + "' not an integer in Zotero.Item.removeRelatedItem()");
	}
	itemID = parsedInt;
	
	var current = this._getRelatedItems(true);
	var index = current.indexOf(itemID);
	
	if (index == -1) {
		Zotero.debug("Item " + this.id + " isn't related to item "
			+ itemID + " in Zotero.Item.removeRelatedItem()");
		return false;
	}
	
	this._markFieldChange('related', current);
	this._changed.relatedItems = true;
	this._relatedItems.splice(index, 1);
	return true;
}


/*
 * Save changes back to database
 *
 * Returns true on item update or itemID of new item
 */
Zotero.Item.prototype.save = function(options) {
	if (!options) {
		options = {};
	}
	
	Zotero.Items.editCheck(this);
	
	if (!this.hasChanged()) {
		Zotero.debug('Item ' + this.id + ' has not changed', 4);
		return false;
	}
	
	// Make sure there are no gaps in the creator indexes
	var creators = this.getCreators();
	var lastPos = -1;
	for (var pos in creators) {
		if (pos != lastPos + 1) {
			throw ("Creator index " + pos + " out of sequence in Zotero.Item.save()");
		}
		lastPos++;
	}
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.id || !this.exists();
	
	try {
		//
		// New item, insert and return id
		//
		if (isNew) {
			Zotero.debug('Saving data for new item to database');
			
			var sqlColumns = [];
			var sqlValues = [];
			
			//
			// Primary fields
			//
			
			// If available id value, use it -- otherwise we'll use autoincrement
			var itemID = this.id ? this.id : Zotero.ID.get('items');
			if (itemID) {
				sqlColumns.push('itemID');
				sqlValues.push({ int: itemID });
			}
			
			var key = this.key ? this.key : this._generateKey();
			
			sqlColumns.push(
				'itemTypeID',
				'dateAdded',
				'dateModified',
				'clientDateModified',
				'libraryID',
				'key'
			);
			sqlValues.push(
				{ int: this.getField('itemTypeID') },
				this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
				this.dateModified ? this.dateModified : Zotero.DB.transactionDateTime,
				Zotero.DB.transactionDateTime,
				this.libraryID ? this.libraryID : null,
				key
			);
			
			// Begin history transaction
			// No associated id yet, so we use false
			//Zotero.History.begin('add-item', false);
			
			//
			// Primary fields
			//
			var sql = "INSERT INTO items (" + sqlColumns.join(', ') + ') VALUES (';
			// Insert placeholders for bind parameters
			for (var i=0; i<sqlValues.length; i++) {
				sql += '?, ';
			}
			sql = sql.substring(0, sql.length-2) + ")";
			
			// Save basic data to items table
			
			try {
				// Needed to work around startup crash in Fx3.5
				var l = this.libraryID;
				var k = this.key;
				
				var insertID = Zotero.DB.query(sql, sqlValues);
			}
			catch (e) {
				if (l &&
					((e.indexOf && e.indexOf('fki_items_libraryID_libraries_libraryID') != -1)
						|| (!Zotero.Libraries.exists(l)))) {
					var msg = "Library " + l + " for item " + k + " not found";;
					var e = new Zotero.Error(msg, "MISSING_OBJECT");
				}
				throw (e);
			}
			if (!itemID) {
				itemID = insertID;
			}
			
			//Zotero.History.setAssociatedID(itemID);
			//Zotero.History.add('items', 'itemID', itemID);
			
			//
			// ItemData
			//
			if (this._changedItemData) {
				// Use manual bound parameters to speed things up
				sql = "SELECT valueID FROM itemDataValues WHERE value=?";
				var valueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemDataValues VALUES (?,?)";
				var insertValueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemData VALUES (?,?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				for (fieldID in this._changedItemData) {
					var value = this.getField(fieldID, true);
					if (!value) {
						continue;
					}
					
					if (Zotero.ItemFields.getID('accessDate') == fieldID
							&& this.getField(fieldID) == 'CURRENT_TIMESTAMP') {
						value = Zotero.DB.transactionDateTime;
					}
					
					var dataType = Zotero.DB.getSQLDataType(value);
					
					switch (dataType) {
						case 32:
							valueStatement.bindInt32Parameter(0, value);
							break;
							
						case 64:
							valueStatement.bindInt64Parameter(0, value);
							break;
						
						default:
							valueStatement.bindUTF8StringParameter(0, value);
					}
					if (valueStatement.executeStep()) {
						var valueID = valueStatement.getInt32(0);
					}
					else {
						var valueID = null;
					}
					
					valueStatement.reset();
					
					if (!valueID) {
						valueID = Zotero.ID.get('itemDataValues');
						insertValueStatement.bindInt32Parameter(0, valueID);
						
						switch (dataType) {
							case 32:
								insertValueStatement.
									bindInt32Parameter(1, value);
								break;
							
							case 64:
								insertValueStatement.
									bindInt64Parameter(1, value);
								break;
							
							default:
								insertValueStatement.
									bindUTF8StringParameter(1, value);
						}
						
						try {
							insertValueStatement.execute();
						}
						catch (e) {
							throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
						}
					}
					
					insertStatement.bindInt32Parameter(0, itemID);
					insertStatement.bindInt32Parameter(1, fieldID);
					insertStatement.bindInt32Parameter(2, valueID);
					
					try {
						insertStatement.execute();
					}
					catch(e) {
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}
					
					/*
					Zotero.History.add('itemData', 'itemID-fieldID',
						[itemID, fieldID]);
					*/
				}
			}
			
			//
			// Creators
			//
			if (this._changedCreators) {
				for (var orderIndex in this._changedCreators) {
					Zotero.debug('Adding creator in position ' + orderIndex, 4);
					var creator = this.getCreator(orderIndex);
					
					/*
					if (!creator.ref.exists()) {
						throw ("Creator in position " + orderIndex + " doesn't exist");
					}
					*/
					
					if (!creator) {
						continue;
					}
					
					if (creator.ref.hasChanged()) {
						Zotero.debug("Auto-saving changed creator " + creator.ref.id);
						creator.ref.save();
					}
					
					sql = 'INSERT INTO itemCreators VALUES (?, ?, ?, ?)';
					Zotero.DB.query(sql,
						[{ int: itemID }, { int: creator.ref.id },
						{ int: creator.creatorTypeID }, { int: orderIndex }]);
					
					/*
					Zotero.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.id, creatorID, creator['creatorTypeID']]);
					*/
				}
			}
			
			
			if (this._changedDeleted) {
				if (this.deleted) {
					sql = "REPLACE INTO deletedItems (itemID) VALUES (?)";
				}
				else {
					sql = "DELETE FROM deletedItems WHERE itemID=?";
				}
				Zotero.DB.query(sql, itemID);
			}
			
			
			// Note
			if (this.isNote() || this._changedNote) {
				sql = "INSERT INTO itemNotes "
						+ "(itemID, sourceItemID, note, title) VALUES (?,?,?,?)";
				var parent = this.isNote() ? this.getSource() : null;
				var noteText = this._noteText ? this._noteText : '';
				// Add <div> wrapper if not present
				if (!noteText.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)) {
					// Keep consistent with getNote()
					noteText = '<div class="zotero-note znv1">' + noteText + '</div>';
				}
				
				var bindParams = [
					itemID,
					parent ? parent : null,
					noteText,
					this._noteTitle ? this._noteTitle : ''
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			
			// Attachment
			if (this.isAttachment()) {
				var sql = "INSERT INTO itemAttachments (itemID, sourceItemID, linkMode, "
					+ "mimeType, charsetID, path, syncState) VALUES (?,?,?,?,?,?,?)";
				var parent = this.getSource();
				var linkMode = this.attachmentLinkMode;
				var mimeType = this.attachmentMIMEType;
				var charsetID = Zotero.CharacterSets.getID(this.attachmentCharset);
				var path = this.attachmentPath;
				var syncState = this.attachmentSyncState;
				
				if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					// Save attachment within attachment base directory as relative path
					if (Zotero.Prefs.get('saveRelativeAttachmentPath')) {
						path = Zotero.Attachments.getBaseDirectoryRelativePath(path);
					}
					// If possible, convert relative path to absolute
					else {
						let file = Zotero.Attachments.resolveRelativePath(path);
						if (file) {
							path = file.persistentDescriptor;
						}
					}
				}
				
				var bindParams = [
					itemID,
					parent ? parent : null,
					{ int: linkMode },
					mimeType ? { string: mimeType } : null,
					charsetID ? { int: charsetID } : null,
					path ? { string: path } : null,
					syncState ? { int: syncState } : 0
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			Zotero.Notifier.trigger('add', 'item', itemID);
			
			// Parent item
			if (this._sourceItem) {
				if (typeof this._sourceItem == 'number') {
					var newSourceItem = Zotero.Items.get(this._sourceItem);
				}
				else {
					var newSourceItem = Zotero.Items.getByLibraryAndKey(this.libraryID, this._sourceItem);
				}
				
				if (!newSourceItem) {
					// TODO: clear caches?
					var msg = "Cannot set source to invalid item " + this._sourceItem;
					var e = new Zotero.Error(msg, "MISSING_OBJECT");
				}
				
				var newSourceItemNotifierData = {};
				//newSourceItemNotifierData[newSourceItem.id] = {};
				Zotero.Notifier.trigger('modify', 'item', newSourceItem.id, newSourceItemNotifierData);
				
				switch (Zotero.ItemTypes.getName(this.itemTypeID)) {
					case 'note':
						newSourceItem.incrementNoteCount();
						break;
					case 'attachment':
						newSourceItem.incrementAttachmentCount();
						break;
				}
			}
			
			
			// Related items
			if (this._changed.relatedItems) {
				var removed = [];
				var newids = [];
				var currentIDs = this._getRelatedItems(true);
				
				for each(var id in currentIDs) {
					newids.push(id);
				}
				
				if (newids.length) {
					var sql = "INSERT INTO itemSeeAlso (itemID, linkedItemID) VALUES (?,?)";
					var insertStatement = Zotero.DB.getStatement(sql);
					
					for each(var linkedItemID in newids) {
						insertStatement.bindInt32Parameter(0, itemID);
						insertStatement.bindInt32Parameter(1, linkedItemID);
						
						try {
							insertStatement.execute();
						}
						catch (e) {
							throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
						}
					}
				}
				
				Zotero.Notifier.trigger('modify', 'item', removed.concat(newids));
			}
		}
		
		//
		// Existing item, update
		//
		else {
			Zotero.debug('Updating database with new item data', 4);
			
			// Begin history transaction
			//Zotero.History.begin('modify-item', this.id);
			
			//
			// Primary fields
			//
			//Zotero.History.modify('items', 'itemID', this.id);
			
			
			var sql = "UPDATE items SET ";
			var sqlValues = [];
			
			var updateFields = [
				'itemTypeID',
				'dateAdded',
				'dateModified',
				'clientDateModified',
				'libraryID',
				'key'
			];
			
			for each(var field in updateFields) {
				if (this._changedPrimaryData && this._changedPrimaryData[field]) {
					sql += field + '=?, ';
					sqlValues.push(this.getField(field));
				}
				else if (field == 'dateModified' && !options.skipDateModifiedUpdate) {
					sql += field + '=?, ';
					sqlValues.push(Zotero.DB.transactionDateTime);
				}
				else if (field == 'clientDateModified' && !options.skipClientDateModifiedUpdate) {
					sql += field + '=?, ';
					sqlValues.push(Zotero.DB.transactionDateTime);
				}
			}
			
			sql = sql.substr(0, sql.length-2) + " WHERE itemID=?";
			sqlValues.push({ int: this.id });
			
			if (sqlValues.length > 1) {
				Zotero.DB.query(sql, sqlValues);
			}
			
			
			//
			// ItemData
			//
			if (this._changedItemData) {
				var del = [];
				
				sql = "SELECT valueID FROM itemDataValues WHERE value=?";
				var valueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemDataValues VALUES (?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				sql = "REPLACE INTO itemData VALUES (?,?,?)";
				var replaceStatement = Zotero.DB.getStatement(sql);
				
				for (fieldID in this._changedItemData) {
					var value = this.getField(fieldID, true);
					
					// If field changed and is empty, mark row for deletion
					if (!value) {
						del.push(fieldID);
						continue;
					}
					
					/*
					// Field exists
					if (this._preChangeArray[Zotero.ItemFields.getName(fieldID)]) {
						Zotero.History.modify('itemData', 'itemID-fieldID',
							[this.id, fieldID]);
					}
					// Field is new
					else {
						Zotero.History.add('itemData', 'itemID-fieldID',
							[this.id, fieldID]);
					}
					*/
					
					if (Zotero.ItemFields.getID('accessDate') == fieldID
							&& this.getField(fieldID) == 'CURRENT_TIMESTAMP') {
						value = Zotero.DB.transactionDateTime;
					}
					
					var dataType = Zotero.DB.getSQLDataType(value);
					
					switch (dataType) {
						case 32:
							valueStatement.bindInt32Parameter(0, value);
							break;
							
						case 64:
							valueStatement.bindInt64Parameter(0, value);
							break;
						
						default:
							valueStatement.bindUTF8StringParameter(0, value);
					}
					if (valueStatement.executeStep()) {
						var valueID = valueStatement.getInt32(0);
					}
					else {
						var valueID = null;
					}
					
					valueStatement.reset();
					
					// Create data row if necessary
					if (!valueID) {
						valueID = Zotero.ID.get('itemDataValues');
						insertStatement.bindInt32Parameter(0, valueID);
						
						// If this is changed, search.js also needs to
						// change
						switch (dataType) {
							case 32:
								insertStatement.
									bindInt32Parameter(1, value);
								break;
							
							case 64:
								insertStatement.
									bindInt64Parameter(1, value);
								break;
							
							default:
								insertStatement.
									bindUTF8StringParameter(1, value);
						}
						
						try {
							insertStatement.execute();
						}
						catch (e) {
							throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
						}
					}
					
					replaceStatement.bindInt32Parameter(0, this.id);
					replaceStatement.bindInt32Parameter(1, fieldID);
					replaceStatement.bindInt32Parameter(2, valueID);
						
					try {
						replaceStatement.execute();
					}
					catch (e) {
						throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
					}
				}
				
				// Delete blank fields
				if (del.length) {
					/*
					// Add to history
					for (var i in del) {
						Zotero.History.remove('itemData', 'itemID-fieldID',
							[this.id, del[i]]);
					}
					*/
					
					sql = 'DELETE from itemData WHERE itemID=? '
						+ 'AND fieldID IN ('
						+ del.map(function () '?').join()
						+ ')';
					Zotero.DB.query(sql, [this.id].concat(del));
				}
			}
			
			//
			// Creators
			//
			if (this._changedCreators) {
				for (var orderIndex in this._changedCreators) {
					Zotero.debug('Creator ' + orderIndex + ' has changed', 4);
					
					var creator = this.getCreator(orderIndex);
					
					/*
					if (!creator.ref.exists()) {
						throw ("Creator in position " + orderIndex + " doesn't exist");
					}
					*/
					
					/*
					// Delete at position
					Zotero.History.remove('itemCreators', 'itemID-orderIndex',
						[this.id, orderIndex]);
					*/
					
					var sql2 = 'DELETE FROM itemCreators WHERE itemID=?'
						+ ' AND orderIndex=?';
					Zotero.DB.query(sql2, [{ int: this.id }, { int: orderIndex }]);
					
					if (!creator) {
						continue;
					}
					
					if (creator.ref.hasChanged()) {
						Zotero.debug("Auto-saving changed creator " + creator.ref.id);
						creator.ref.save();
					}
					
					sql = "INSERT INTO itemCreators VALUES (?,?,?,?)";
					
					sqlValues = [
						{ int: this.id },
						{ int: creator.ref.id },
						{ int: creator.creatorTypeID },
						{ int: orderIndex }
					];
					
					Zotero.DB.query(sql, sqlValues);
					
					/*
					Zotero.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.id, creatorID, creator['creatorTypeID']]);
					*/
				}
			}
			
			
			let parentItem = this.getSource();
			parentItem = parentItem ? Zotero.Items.get(parentItem) : null;
			
			if (this._changedDeleted) {
				if (this.deleted) {
					sql = "REPLACE INTO deletedItems (itemID) VALUES (?)";
				}
				else {
					// If undeleting, remove any merge-tracking relations
					var relations = Zotero.Relations.getByURIs(
						Zotero.URI.getItemURI(this),
						Zotero.Relations.deletedItemPredicate,
						false
					);
					for each(var relation in relations) {
						relation.erase();
					}
					
					sql = "DELETE FROM deletedItems WHERE itemID=?";
				}
				Zotero.DB.query(sql, this.id);
				
				if (parentItem) {
					parentItem.updateNumNotes();
					parentItem.updateBestAttachmentState();
				}
			}
			
			
			// Note
			if (this._changedNote) {
				if (this._noteText === null || this._noteTitle === null) {
					throw ('Cached note values not set with this._changedNote '
						+ ' set to true in Item.save()');
				}
				
				var parent = this.isNote() ? this.getSource() : null;
				var noteText = this._noteText;
				// Add <div> wrapper if not present
				if (!noteText.match(/^<div class="zotero-note znv[0-9]+">[\s\S]*<\/div>$/)) {
					noteText = '<div class="zotero-note znv1">' + noteText + '</div>';
				}
				
				var sql = "SELECT COUNT(*) FROM itemNotes WHERE itemID=?";
				if (Zotero.DB.valueQuery(sql, this.id)) {
					sql = "UPDATE itemNotes SET sourceItemID=?, note=?, title=? WHERE itemID=?";
					var bindParams = [
						parent ? parent : null,
						noteText,
						this._noteTitle,
						this.id
					];
				}
				// Row might not yet exist for new embedded attachment notes
				else {
					sql = "INSERT INTO itemNotes "
							+ "(itemID, sourceItemID, note, title) VALUES (?,?,?,?)";
					var bindParams = [
						this.id,
						parent ? parent : null,
						noteText,
						this._noteTitle
					];
				}
				Zotero.DB.query(sql, bindParams);
				
				if (parentItem) {
					// Embedded attachment notes are included in parent note count
					if (this.isAttachment()) {
						parentItem.updateNumNotes();
					}
					
					// Clear cached child notes of the parent. If the note
					// moved between parents, the old one will be cleared
					// when changing the note count below
					parentItem.clearCachedNotes();
				}
			}
			
			
			//
			// Attachment
			//
			// If attachment title changes, update parent attachments
			if (this._changedItemData[110] && this.isAttachment() && parentItem) {
				parentItem.clearCachedAttachments();
			}
			if (this._changedAttachmentData) {
				var sql = "UPDATE itemAttachments SET sourceItemID=?, "
					+ "linkMode=?, mimeType=?, charsetID=?, path=?, syncState=? "
					+ "WHERE itemID=?";
				let parent = this.getSource();
				var linkMode = this.attachmentLinkMode;
				var mimeType = this.attachmentMIMEType;
				var charsetID = Zotero.CharacterSets.getID(this.attachmentCharset);
				var path = this.attachmentPath;
				var syncState = this.attachmentSyncState;
				
				if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					// Save attachment within attachment base directory as relative path
					if (Zotero.Prefs.get('saveRelativeAttachmentPath')) {
						path = Zotero.Attachments.getBaseDirectoryRelativePath(path);
					}
					// If possible, convert relative path to absolute
					else {
						let file = Zotero.Attachments.resolveRelativePath(path);
						if (file) {
							path = file.persistentDescriptor;
						}
					}
				}
				
				var bindParams = [
					parent ? parent : null,
					{ int: linkMode },
					mimeType ? { string: mimeType } : null,
					charsetID ? { int: charsetID } : null,
					path ? { string: path } : null,
					syncState ? { int: syncState } : 0,
					this.id
				];
				Zotero.DB.query(sql, bindParams);
				
				// Clear cached child attachments of the parent. If the note
				// moved between parents, the old one will be cleared
				// when changing the note count below
				if (parentItem) {
					parentItem.clearCachedAttachments();
				}
			}
			
			var notifierData = {};
			notifierData[this.id] = { changed: this._previousData };
			Zotero.Notifier.trigger('modify', 'item', this.id, notifierData);
			
			// Parent
			if (this._changedSource) {
				var type = Zotero.ItemTypes.getName(this.itemTypeID);
				var Type = type[0].toUpperCase() + type.substr(1);
				
				if (this._sourceItem) {
					if (typeof this._sourceItem == 'number') {
						var newSourceItem = Zotero.Items.get(this._sourceItem);
					}
					else {
						var newSourceItem = Zotero.Items.getByLibraryAndKey(this.libraryID, this._sourceItem);
					}
					
					if (!newSourceItem) {
						// TODO: clear caches
						var msg = "Cannot set source to invalid item " + this._sourceItem;
						var e = new Zotero.Error(msg, "MISSING_OBJECT");
						throw (e);
					}
					
					var newSourceItemNotifierData = {};
					//newSourceItemNotifierData[newSourceItem.id] = {};
					Zotero.Notifier.trigger('modify', 'item', newSourceItem.id, newSourceItemNotifierData);
				}
				
				var oldSourceItemKey = this._previousData.parentItem;
				if (oldSourceItemKey) {
					var oldSourceItem = Zotero.Items.getByLibraryAndKey(this.libraryID, oldSourceItemKey);
					if (oldSourceItem) {
						var oldSourceItemNotifierData = {};
						//oldSourceItemNotifierData[oldSourceItem.id] = {};
						Zotero.Notifier.trigger('modify', 'item', oldSourceItem.id, oldSourceItemNotifierData);
					}
					else if (oldSourceItemKey) {
						var oldSourceItemNotifierData = null;
						Zotero.debug("Old source item " + oldSourceItemKey
							+ " didn't exist in Zotero.Item.save()", 2);
					}
				}
				
				
				
				// If this was an independent item, remove from any collections
				// where it existed previously and add source instead if
				// there is one
				if (!oldSourceItemKey) {
					var sql = "SELECT collectionID FROM collectionItems "
								+ "WHERE itemID=?";
					var changedCollections = Zotero.DB.columnQuery(sql, this.id);
					if (changedCollections) {
						sql = "UPDATE collections SET dateModified=CURRENT_TIMESTAMP, clientDateModified=CURRENT_TIMESTAMP "
							+ "WHERE collectionID IN (SELECT collectionID FROM collectionItems WHERE itemID=?)";
						Zotero.DB.query(sql, this.id);
						
						if (newSourceItem) {
							sql = "UPDATE OR REPLACE collectionItems "
								+ "SET itemID=? WHERE itemID=?";
							Zotero.DB.query(sql, [newSourceItem.id, this.id]);
						}
						else {
							sql = "DELETE FROM collectionItems WHERE itemID=?";
							Zotero.DB.query(sql, this.id);
						}
						
						for each(var c in changedCollections) {
							Zotero.Notifier.trigger('remove', 'collection-item', c + '-' + this.id);
						}
						
						Zotero.Collections.reload(changedCollections);
					}
				}
				
				// Update DB, if not a note or attachment we already changed above
				if (!this._changedAttachmentData &&
						(!this._changedNote || !this.isNote())) {
					var sql = "UPDATE item" + Type + "s SET sourceItemID=? "
								+ "WHERE itemID=?";
					var bindParams = [
						newSourceItem ? newSourceItem.id : null, this.id
					];
					Zotero.DB.query(sql, bindParams);
				}
				
				// Update the counts of the previous and new sources
				if (oldSourceItem) {
					switch (type) {
						case 'note':
							oldSourceItem.decrementNoteCount();
							break;
						case 'attachment':
							oldSourceItem.decrementAttachmentCount();
							break;
					}
				}
				
				if (newSourceItem) {
					switch (type) {
						case 'note':
							newSourceItem.incrementNoteCount();
							break;
						case 'attachment':
							newSourceItem.incrementAttachmentCount();
							break;
					}
				}
			}
			
			
			// Related items
			if (this._changed.relatedItems) {
				var removed = [];
				var newids = [];
				var currentIDs = this._getRelatedItems(true);
				
				for each(var id in this._previousData.related) {
					if (currentIDs.indexOf(id) == -1) {
						removed.push(id);
					}
				}
				for each(var id in currentIDs) {
					if (this._previousData.related.indexOf(id) != -1) {
						continue;
					}
					newids.push(id);
				}
				
				if (removed.length) {
					var sql = "DELETE FROM itemSeeAlso WHERE itemID=? "
						+ "AND linkedItemID IN ("
						+ removed.map(function () '?').join()
						+ ")";
					Zotero.DB.query(sql, [this.id].concat(removed));
				}
				
				if (newids.length) {
					var sql = "INSERT INTO itemSeeAlso (itemID, linkedItemID) VALUES (?,?)";
					var insertStatement = Zotero.DB.getStatement(sql);
					
					for each(var linkedItemID in newids) {
						insertStatement.bindInt32Parameter(0, this.id);
						insertStatement.bindInt32Parameter(1, linkedItemID);
						
						try {
							insertStatement.execute();
						}
						catch (e) {
							throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
						}
					}
				}
				
				Zotero.Notifier.trigger('modify', 'item', removed.concat(newids));
			}
		}
		
		if (!this.id) {
			this._id = itemID;
		}
		
		if (!this.key) {
			this._key = key;
		}
		
		if (this._changedDeleted) {
			// Update child item counts on parent
			var sourceItemID = this.getSource();
			if (sourceItemID) {
				var sourceItem = Zotero.Items.get(sourceItemID);
				if (this._deleted) {
					if (this.isAttachment()) {
						sourceItem.decrementAttachmentCount();
					}
					else {
						sourceItem.decrementNoteCount();
					}
				}
				else {
					if (this.isAttachment()) {
						sourceItem.incrementAttachmentCount();
					}
					else {
						sourceItem.incrementNoteCount();
					}
				}
			}
			// Refresh trash
			Zotero.Notifier.trigger('refresh', 'trash', this.libraryID ? this.libraryID : 0);
			if (this._deleted) {
				Zotero.Notifier.trigger('trash', 'item', this.id);
			}
		}
		
		Zotero.Items.reload(this.id);
		
		//Zotero.History.commit();
		Zotero.DB.commitTransaction();
	}
	
	catch (e) {
		//Zotero.History.cancel();
		Zotero.DB.rollbackTransaction();
		Zotero.debug(e);
		throw(e);
	}
	
	// New items have to be reloaded via Zotero.Items.get(),
	// so mark them as disabled
	if (isNew) {
		var id = this.id;
		this._disabled = true;
		return id;
	}
	
	return true;
}


/**
 * Used by sync code
 */
Zotero.Item.prototype.updateClientDateModified = function () {
	if (!this.id) {
		throw ("Cannot update clientDateModified of unsaved item in Zotero.Item.updateClientDateModified()");
	}
	var sql = "UPDATE items SET clientDateModified=? WHERE itemID=?";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, this.id]);
}


Zotero.Item.prototype.isRegularItem = function() {
	return !(this.isNote() || this.isAttachment());
}


Zotero.Item.prototype.isTopLevelItem = function () {
	return this.isRegularItem() || !this.getSourceKey();
}


Zotero.Item.prototype.numChildren = function(includeTrashed) {
	return this.numNotes(includeTrashed) + this.numAttachments(includeTrashed);
}


/**
 * @return	{Integer|FALSE}	 itemID of the parent item for an attachment or note, or FALSE if none
 */
Zotero.Item.prototype.getSource = function() {
	if (this._sourceItem === false) {
		return false;
	}
	
	if (this._sourceItem !== null) {
		if (typeof this._sourceItem == 'number') {
			return this._sourceItem;
		}
		var sourceItem = Zotero.Items.getByLibraryAndKey(this.libraryID, this._sourceItem);
		if (!sourceItem) {
			var msg = "Source item for keyed source doesn't exist in Zotero.Item.getSource() " + "(" + this._sourceItem + ")";
			var e = new Zotero.Error(msg, "MISSING_OBJECT");
			throw (e);
		}
		// Replace stored key with id
		this._sourceItem = sourceItem.id;
		return sourceItem.id;
	}
	
	if (!this.id) {
		return false;
	}
	
	if (this.isNote()) {
		var Type = 'Note';
	}
	else if (this.isAttachment()) {
		var Type = 'Attachment';
	}
	else {
		return false;
	}
	
	var sql = "SELECT sourceItemID FROM item" + Type + "s WHERE itemID=?";
	var sourceItemID = Zotero.DB.valueQuery(sql, this.id);
	if (!sourceItemID) {
		sourceItemID = false;
	}
	this._sourceItem = sourceItemID;
	return sourceItemID;
}


/**
 * @return	{String|FALSE}	 Key of the parent item for an attachment or note, or FALSE if none
 */
Zotero.Item.prototype.getSourceKey = function() {
	if (this._sourceItem === false) {
		return false;
	}
	
	if (this._sourceItem !== null) {
		if (typeof this._sourceItem == 'string') {
			return this._sourceItem;
		}
		var sourceItem = Zotero.Items.get(this._sourceItem);
		return sourceItem.key;
	}
	
	if (!this.id) {
		return false;
	}
	
	if (this.isNote()) {
		var Type = 'Note';
	}
	else if (this.isAttachment()) {
		var Type = 'Attachment';
	}
	else {
		return false;
	}
	
	var sql = "SELECT key FROM item" + Type + "s A JOIN items B "
				+ "ON (A.sourceItemID=B.itemID) WHERE A.itemID=?";
	var key = Zotero.DB.valueQuery(sql, this.id);
	if (!key) {
		key = null;
	}
	this._sourceItem = key;
	return key;
}


Zotero.Item.prototype.setSource = function(sourceItemID) {
	if (this.isNote()) {
		var type = 'note';
		var Type = 'Note';
	}
	else if (this.isAttachment()) {
		var type = 'attachment';
		var Type = 'Attachment';
	}
	else {
		throw ("setSource() can only be called on items of type 'note' or 'attachment'");
	}
	
	var oldSourceItemID = this.getSource();
	if (oldSourceItemID == sourceItemID) {
		Zotero.debug("Source item has not changed for item " + this.id);
		return false;
	}
	
	this._markFieldChange('parentItem', this.getSourceKey());
	this._changedSource = true;
	this._sourceItem = sourceItemID ? parseInt(sourceItemID) : false;
	
	return true;
}


Zotero.Item.prototype.setSourceKey = function(sourceItemKey) {
	if (this.isNote()) {
		var type = 'note';
		var Type = 'Note';
	}
	else if (this.isAttachment()) {
		var type = 'attachment';
		var Type = 'Attachment';
	}
	else {
		throw ("setSourceKey() can only be called on items of type 'note' or 'attachment'");
	}
	
	var oldSourceItemID = this.getSource();
	if (oldSourceItemID) {
		var sourceItem = Zotero.Items.get(oldSourceItemID);
		var oldSourceItemKey = sourceItem.key;
	}
	else {
		var oldSourceItemKey = false;
	}
	if (oldSourceItemKey == sourceItemKey) {
		Zotero.debug("Source item has not changed in Zotero.Item.setSourceKey()");
		return false;
	}
	
	this._markFieldChange('parentItem', oldSourceItemKey);
	this._changedSource = true;
	this._sourceItem = sourceItemKey ? sourceItemKey : false;
	
	return true;
}


////////////////////////////////////////////////////////
//
// Methods dealing with note items
//
////////////////////////////////////////////////////////
Zotero.Item.prototype.incrementNoteCount = function() {
	this._numNotes++;
	this._cachedNotes = null;
}


Zotero.Item.prototype.decrementNoteCount = function() {
	this._numNotes--;
	this._cachedNotes = null;
}


Zotero.Item.prototype.clearCachedNotes = function () {
	this._cachedNotes = null;
}


/**
* Determine if an item is a note
**/
Zotero.Item.prototype.isNote = function() {
	return Zotero.ItemTypes.getName(this.itemTypeID) == 'note';
}


/**
* Update an item note
*
* Note: This can only be called on saved notes and attachments
**/
Zotero.Item.prototype.updateNote = function(text) {
	throw ('updateNote() removed -- use setNote() and save()');
}


/**
 * Returns number of child notes of item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items in count
 * @param	{Boolean}	includeEmbedded		Include notes embedded in attachments
 * @return	{Integer}
 */
Zotero.Item.prototype.numNotes = function(includeTrashed, includeEmbedded) {
	if (this.isNote()) {
		throw ("numNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.id) {
		return 0;
	}
	
	if (includeTrashed && this._numNotesTrashed === null) {
		var sql = "SELECT COUNT(*) FROM itemNotes WHERE sourceItemID=? AND "
			+ "itemID IN (SELECT itemID FROM deletedItems)";
		this._numNotesTrashed = parseInt(Zotero.DB.valueQuery(sql, this.id));
	}
	var embedded = 0;
	if (includeEmbedded) {
		if ((includeTrashed ? this._numNotesEmbeddedIncludingTrashed : this._numNotesEmbedded) === null) {
			var sql = "SELECT COUNT(*) FROM itemAttachments IA JOIN itemNotes USING (itemID) WHERE ";
			// For attachments, include their own embedded notes
			if (this.isAttachment()) {
				sql += "IA.itemID=?";
			}
			else {
				sql += "IA.sourceItemID=?";
			}
			sql += " AND note!='' AND note!=?";
			if (!includeTrashed) {
				sql += " AND itemID NOT IN (SELECT itemID FROM deletedItems)";
			}
			var embedded = parseInt(Zotero.DB.valueQuery(sql, [this.id, Zotero.Notes.defaultNote]));
			if (includeTrashed) {
				this._numNotesEmbeddedIncludingTrashed = embedded;
			}
			else {
				this._numNotesEmbedded = embedded;
			}
		}
	}
	
	return this._numNotes
		+ (includeTrashed ? this._numNotesTrashed : 0)
		+ (includeTrashed ? this._numNotesEmbeddedIncludingTrashed : this._numNotesEmbedded);
}


Zotero.Item.prototype.updateNumNotes = function () {
	this._numNotesTrashed = null;
	this._numNotesEmbedded = null;
	this._numNotesEmbeddedIncludingTrashed = null;
}


/**
 * Get the first line of the note for display in the items list
 *
 * Note: Note titles can also come from Zotero.Items.cacheFields()!
 *
 * @return	{String}
 */
Zotero.Item.prototype.getNoteTitle = function() {
	if (!this.isNote() && !this.isAttachment()) {
		throw ("getNoteTitle() can only be called on notes and attachments");
	}
	
	if (this._noteTitle !== null) {
		return this._noteTitle;
	}
	
	if (!this.id) {
		return '';
	}
	
	var sql = "SELECT title FROM itemNotes WHERE itemID=?";
	var title = Zotero.DB.valueQuery(sql, this.id);
	
	this._noteTitle = title ? title : '';
	
	return title ? title : '';
}


Zotero.Item.prototype.hasNote = function () {
	if (!this.isNote() && !this.isAttachment()) {
		throw new Error("hasNote() can only be called on notes and attachments");
	}
	
	if (this._hasNote !== null) {
		return this._hasNote;
	}
	
	if (!this.id) {
		return false;
	}
	
	var sql = "SELECT COUNT(*) FROM itemNotes WHERE itemID=? "
				+ "AND note!='' AND note!=?";
	var hasNote = !!Zotero.DB.valueQuery(sql, [this.id, Zotero.Notes.defaultNote]);
	
	this._hasNote = hasNote;
	return hasNote;
}


/**
 * Get the text of an item note
 **/
Zotero.Item.prototype.getNote = function() {
	if (!this.isNote() && !this.isAttachment()) {
		throw ("getNote() can only be called on notes and attachments");
	}
	
	// Store access time for later garbage collection
	this._noteAccessTime = new Date();
	
	if (this._noteText !== null) {
		return this._noteText;
	}
	
	if (!this.id) {
		return '';
	}
	
	var sql = "SELECT note FROM itemNotes WHERE itemID=?";
	var note = Zotero.DB.valueQuery(sql, this.id);
	
	// Convert non-HTML notes on-the-fly
	if (note) {
		if (!note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)) {
			note = Zotero.Utilities.htmlSpecialChars(note);
			note = Zotero.Notes.notePrefix + '<p>'
					+ note.replace(/\n/g, '</p><p>')
						.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
						.replace(/  /g, '&nbsp;&nbsp;')
				+ '</p>' + Zotero.Notes.noteSuffix;
			note = note.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
			var sql = "UPDATE itemNotes SET note=? WHERE itemID=?";
			Zotero.DB.query(sql, [note, this.id]);
		}
		
		// Don't include <div> wrapper when returning value
		var startLen = note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)[0].length;
		var endLen = 6; // "</div>".length
		note = note.substr(startLen, note.length - startLen - endLen);
	}
	
	this._noteText = note ? note : '';
	return this._noteText;
}


/**
* Set an item note
*
* Note: This can only be called on notes and attachments
**/
Zotero.Item.prototype.setNote = function(text) {
	if (!this.isNote() && !this.isAttachment()) {
		throw ("updateNote() can only be called on notes and attachments");
	}
	
	if (typeof text != 'string') {
		throw ("text must be a string in Zotero.Item.setNote() (was " + typeof text + ")");
	}
	
	text = text
		// Strip control characters
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
		.trim();
	
	var oldText = this.getNote();
	if (text == oldText) {
		Zotero.debug("Note has not changed in Zotero.Item.setNote()");
		return false;
	}
	
	this._hasNote = text !== '';
	this._noteText = text;
	this._noteTitle = Zotero.Notes.noteToTitle(text);
	
	this._markFieldChange('note', oldText);
	this._changedNote = true;
	
	return true;
}


/**
 * Returns child notes of this item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items
 * @return	{Integer[]}						Array of itemIDs
 */
Zotero.Item.prototype.getNotes = function(includeTrashed) {
	if (this.isNote()) {
		throw ("getNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.id) {
		return [];
	}
	
	// Get the right cache array
	if (!this._cachedNotes) {
		this._cachedNotes = {
			chronologicalWithTrashed: null,
			chronologicalWithoutTrashed: null,
			alphabeticalWithTrashed: null,
			alphabeticalWithoutTrashed: null
		};
	}
	var cache = this._cachedNotes;
	var cacheKey = (Zotero.Prefs.get('sortNotesChronologically')
			? 'chronological' : 'alphabetical')
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	if (cache[cacheKey] !== null) {
		return cache[cacheKey];
	}
	
	var sql = "SELECT N.itemID, title FROM itemNotes N NATURAL JOIN items "
		+ "WHERE sourceItemID=?";
	if (!includeTrashed) {
		sql += " AND N.itemID NOT IN (SELECT itemID FROM deletedItems)";
	}
	
	if (Zotero.Prefs.get('sortNotesChronologically')) {
		sql += " ORDER BY dateAdded";
		var results = Zotero.DB.columnQuery(sql, this.id);
		results = results ? results : [];
		cache[cacheKey] = results;
		return results;
	}
	
	var notes = Zotero.DB.query(sql, this.id);
	if (!notes) {
		cache[cacheKey] = [];
		return [];
	}
	
	// Sort by title
	var collation = Zotero.getLocaleCollation();
	var f = function (a, b) {
		var aTitle = Zotero.Items.getSortTitle(a.title);
		var bTitle = Zotero.Items.getSortTitle(b.title);
		return collation.compareString(1, aTitle, bTitle);
	}
	
	var noteIDs = [];
	notes.sort(f);
	for each(var note in notes) {
		noteIDs.push(note.itemID);
	}
	cache[cacheKey] = noteIDs;
	return noteIDs;
}



////////////////////////////////////////////////////////
//
// Methods dealing with attachments
//
// save() is not required for attachment functions
//
///////////////////////////////////////////////////////
Zotero.Item.prototype.incrementAttachmentCount = function() {
	this._numAttachments++;
	this._cachedAttachments = null;
}


Zotero.Item.prototype.decrementAttachmentCount = function() {
	this._numAttachments--;
	this._cachedAttachments = null;
}


Zotero.Item.prototype.clearCachedAttachments = function () {
	this._cachedAttachments = null;
}


/**
* Determine if an item is an attachment
**/
Zotero.Item.prototype.isAttachment = function() {
	return Zotero.ItemTypes.getName(this.itemTypeID) == 'attachment';
}


Zotero.Item.prototype.isImportedAttachment = function() {
	if (!this.isAttachment()) {
		return false;
	}
	var linkMode = this.attachmentLinkMode;
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE || linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) {
		return true;
	}
	return false;
}


Zotero.Item.prototype.isWebAttachment = function() {
	if (!this.isAttachment()) {
		return false;
	}
	var linkMode = this.attachmentLinkMode;
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE || linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
		return false;
	}
	return true;
}


Zotero.Item.prototype.isFileAttachment = function() {
	if (!this.isAttachment()) {
		return false;
	}
	return this.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL;
}


/**
 * Returns number of child attachments of item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items in count
 * @return	{Integer}
 */
Zotero.Item.prototype.numAttachments = function(includeTrashed) {
	if (this.isAttachment()) {
		throw ("numAttachments() cannot be called on attachment items");
	}
	
	if (!this.id) {
		return 0;
	}
	
	var deleted = 0;
	if (includeTrashed) {
		var sql = "SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID=? AND "
			+ "itemID IN (SELECT itemID FROM deletedItems)";
		deleted = parseInt(Zotero.DB.valueQuery(sql, this.id));
	}
	
	return this._numAttachments + deleted;
}


/**
* Get an nsILocalFile for the attachment, or false if the associated file
* doesn't exist
*
* _row_ is optional itemAttachments row if available to skip queries
*
* Note: Always returns false for items with LINK_MODE_LINKED_URL,
* since they have no files -- use getField('url') instead
**/
Zotero.Item.prototype.getFile = function(row, skipExistsCheck) {
	if (!this.isAttachment()) {
		throw ("getFile() can only be called on attachment items");
	}
	
	if (!row) {
		var row = {
			linkMode: this.attachmentLinkMode,
			path: this.attachmentPath
		};
	}
	
	// No associated files for linked URLs
	if (row.linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}
	
	if (!row.path) {
		Zotero.debug("Attachment path is empty", 2);
		this._updateAttachmentStates(false);
		return false;
	}
	
	// Imported file with relative path
	if (row.linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			row.linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		try {
			if (row.path.indexOf("storage:") == -1) {
				Zotero.debug("Invalid attachment path '" + row.path + "'", 2);
				throw ('Invalid path');
			}
			// Strip "storage:"
			var path = row.path.substr(8);
			// setRelativeDescriptor() silently uses the parent directory on Windows
			// if the filename contains certain characters, so strip them —
			// but don't skip characters outside of XML range, since they may be
			// correct in the opaque relative descriptor string
			//
			// This is a bad place for this, since the change doesn't make it
			// back up to the sync server, but we do it to make sure we don't
			// accidentally use the parent dir. Syncing to OS X, which doesn't
			// exhibit this bug, will properly correct such filenames in
			// storage.js and propagate the change
			if (Zotero.isWin) {
				path = Zotero.File.getValidFileName(path, true);
			}
			var file = Zotero.Attachments.getStorageDirectory(this.id);
			file.QueryInterface(Components.interfaces.nsILocalFile);
			file.setRelativeDescriptor(file, path);
		}
		catch (e) {
			// See if this is a persistent path
			// (deprecated for imported attachments)
			Zotero.debug('Trying as persistent descriptor');
			
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				file.persistentDescriptor = row.path;
				
				// If valid, convert this to a relative descriptor
				if (file.exists()) {
					Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?",
						["storage:" + file.leafName, this.id]);
				}
			}
			catch (e) {
				Zotero.debug('Invalid persistent descriptor', 2);
				this._updateAttachmentStates(false);
				return false;
			}
		}
	}
	// Linked file with relative path
	else if (row.linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			row.path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		var file = Zotero.Attachments.resolveRelativePath(row.path);
		if (!file) {
			this._updateAttachmentStates(false);
			return false;
		}
	}
	else {
		var file = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		
		try {
			file.persistentDescriptor = row.path;
		}
		catch (e) {
			// See if this is an old relative path (deprecated)
			Zotero.debug('Invalid persistent descriptor -- trying relative');
			try {
				var refDir = (row.linkMode == this.LINK_MODE_LINKED_FILE)
					? Zotero.getZoteroDirectory() : Zotero.getStorageDirectory();
				file.setRelativeDescriptor(refDir, row.path);
				// If valid, convert this to a persistent descriptor
				if (file.exists()) {
					Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?",
						[file.persistentDescriptor, this.id]);
				}
			}
			catch (e) {
				Zotero.debug('Invalid relative descriptor', 2);
				this._updateAttachmentStates(false);
				return false;
			}
		}
	}
	
	if (!skipExistsCheck && !file.exists()) {
		Zotero.debug("Attachment file '" + file.path + "' not found", 2);
		this._updateAttachmentStates(false);
		return false;
	}
	
	this._updateAttachmentStates(true);
	return file;
}


/**
 * Update file existence state of this item and best attachment state of parent item
 */
Zotero.Item.prototype._updateAttachmentStates = function (exists) {
	this._fileExists = exists;
	
	if (this.isTopLevelItem()) {
		return;
	}
	
	try {
		var parentKey = this.getSource();
	}
	// This can happen during classic sync conflict resolution, if a
	// standalone attachment was modified locally and remotely was changed
	// into a child attachment
	catch (e) {
		Zotero.debug("Attachment parent doesn't exist for source key "
			+ "in Zotero.Item.updateAttachmentStates()", 1);
		return;
	}
	
	Zotero.Items.get(parentKey).updateBestAttachmentState();
}


Zotero.Item.prototype.getFilename = function () {
	if (!this.isAttachment()) {
		throw ("getFileName() can only be called on attachment items in Zotero.Item.getFilename()");
	}
	
	if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw ("getFilename() cannot be called on link attachments in Zotero.Item.getFilename()");
	}
	
	var file = this.getFile(null, true);
	if (!file) {
		return false;
	}
	
	return file.leafName;
}


/**
 * Cached check for file existence, used for items view
 *
 * This is updated only initially and on subsequent getFile() calls.
 */
Zotero.Item.prototype.fileExists = function (cachedOnly) {
	if (!cachedOnly && this._fileExists === null) {
		this.getFile();
	}
	return this._fileExists;
};


/**
 * Asynchronous cached check for file existence, used for items view
 *
 * This is updated only initially and on subsequent getFile() calls.
 */
Zotero.Item.prototype.fileExistsAsync = function () {
	var self = this;
	return Q.fcall(function () {
		if (self._fileExists !== null) {
			return self._fileExists;
		}
		
		if (Zotero.platformMajorVersion < 23) {
			return self.fileExists();
		}
		
		if (!self.isAttachment()) {
			throw new Error("Zotero.Item.fileExistsAsync() can only be called on attachment items");
		}
		
		if (self.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			throw new Error("Zotero.Item.fileExistsAsync() cannot be called on link attachments");
		}
		
		var nsIFile = self.getFile(null, true);
		Components.utils.import("resource://gre/modules/osfile.jsm");
		return Q(OS.File.exists(nsIFile.path))
		.then(function(exists) {
			self._updateAttachmentStates(exists);
			return exists;
		});
	});
};



/*
 * Rename file associated with an attachment
 *
 * -1   		Destination file exists -- use _force_ to overwrite
 * -2		Error renaming
 * false		Attachment file not found
 */
Zotero.Item.prototype.renameAttachmentFile = function(newName, overwrite) {
	var file = this.getFile();
	if (!file) {
		Zotero.debug("Attachment file not found in renameAttachmentFile()", 2);
		return false;
	}
	
	var origModDate = file.lastModifiedTime;
	try {
		newName = Zotero.File.getValidFileName(newName);
		
		var dest = file.parent;
		dest.append(newName);
		
		// Ignore if no change
		//
		// Note: Just comparing file.leafName to newName isn't reliable
		if (file.leafName === dest.leafName) {
			return true;
		}
		
		// If old and new names differ only in case, let's bank on this
		// just being a case change and not bother checking for existing
		// files, since dest.exists() will just show true on a case-insensitive
		// filesystem anyway.
		if (file.leafName.toLowerCase() != dest.leafName.toLowerCase()) {
			if (!overwrite && dest.exists()) {
				return -1;
			}
		}
		
		// Update mod time and clear hash so the file syncs
		// TODO: use an integer counter instead of mod time for change detection
		// Update mod time first, because it may fail for read-only files on Windows
		file.lastModifiedTime = new Date();
		file.moveTo(null, newName);
		
		this.relinkAttachmentFile(dest);
		
		Zotero.DB.beginTransaction();
		
		Zotero.Sync.Storage.setSyncedHash(this.id, null, false);
		Zotero.Sync.Storage.setSyncState(this.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
		
		Zotero.DB.commitTransaction();
		
		return true;
	}
	catch (e) {
		// Restore original modification date in case we managed to change it
		try { file.lastModifiedTime = origModDate } catch (e) {}
		Zotero.debug(e);
		Components.utils.reportError(e);
		return -2;
	}
}


/**
 * @param {Boolean} [skipItemUpdate] Don't update attachment item mod time,
 *                                   so that item doesn't sync. Used when a file
 *                                   needs to be renamed to be accessible but the
 *                                   user doesn't have access to modify the
 *                                   attachment metadata
 */
Zotero.Item.prototype.relinkAttachmentFile = function(file, skipItemUpdate) {
	var linkMode = this.attachmentLinkMode;
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw('Cannot relink linked URL in Zotero.Items.relinkAttachmentFile()');
	}
	
	var newName = Zotero.File.getValidFileName(file.leafName);
	if (!newName) {
		throw ("No valid characters in filename after filtering in Zotero.Item.relinkAttachmentFile()");
	}
	
	// Rename file to filtered name if necessary
	if (file.leafName != newName) {
		Zotero.debug("Renaming file '" + file.leafName + "' to '" + newName + "'");
		file.moveTo(null, newName);
	}
	
	var path = Zotero.Attachments.getPath(file, linkMode);
	this.attachmentPath = path;
	
	this.save({
		skipDateModifiedUpdate: true,
		skipClientDateModifiedUpdate: skipItemUpdate
	});
	
	return false;
}



/*
 * Return a file:/// URL path to files and snapshots
 */
Zotero.Item.prototype.getLocalFileURL = function() {
	if (!this.isAttachment) {
		throw ("getLocalFileURL() can only be called on attachment items");
	}
	
	var file = this.getFile();
	if (!file) {
		return false;
	}
	
	var nsIFPH = Components.classes["@mozilla.org/network/protocol;1?name=file"]
			.getService(Components.interfaces.nsIFileProtocolHandler);
	return nsIFPH.getURLSpecFromFile(file);
}


Zotero.Item.prototype.getAttachmentLinkMode = function() {
	Zotero.debug("getAttachmentLinkMode() deprecated -- use .attachmentLinkMode");
	return this.attachmentLinkMode;
}

/**
 * Link mode of an attachment
 *
 * Possible values specified as constants in Zotero.Attachments
 * (e.g. Zotero.Attachments.LINK_MODE_LINKED_FILE)
 */
Zotero.Item.prototype.__defineGetter__('attachmentLinkMode', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (this._attachmentLinkMode !== null) {
		return this._attachmentLinkMode;
	}
	
	if (!this.id) {
		return null;
	}
	
	var sql = "SELECT linkMode FROM itemAttachments WHERE itemID=?";
	var linkMode = Zotero.DB.valueQuery(sql, this.id);
	this._attachmentLinkMode = linkMode;
	return linkMode;
});


Zotero.Item.prototype.__defineSetter__('attachmentLinkMode', function (val) {
	if (!this.isAttachment()) {
		throw (".attachmentLinkMode can only be set for attachment items");
	}
	
	switch (val) {
		case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
		case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
		case Zotero.Attachments.LINK_MODE_LINKED_FILE:
		case Zotero.Attachments.LINK_MODE_LINKED_URL:
			break;
			
		default:
			throw ("Invalid attachment link mode '" + val
				+ "' in Zotero.Item.attachmentLinkMode setter");
	}
	
	if (val === this.attachmentLinkMode) {
		return;
	}
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.linkMode = true;
	this._attachmentLinkMode = val;
});


Zotero.Item.prototype.getAttachmentMIMEType = function() {
	Zotero.debug("getAttachmentMIMEType() deprecated -- use .attachmentMIMEType");
	return this.attachmentMIMEType;
}

/**
 * MIME type of an attachment (e.g. 'text/plain')
 */
Zotero.Item.prototype.__defineGetter__('attachmentMIMEType', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (this._attachmentMIMEType !== null) {
		return this._attachmentMIMEType;
	}
	
	if (!this.id) {
		return '';
	}
	
	var sql = "SELECT mimeType FROM itemAttachments WHERE itemID=?";
	var mimeType = Zotero.DB.valueQuery(sql, this.id);
	if (!mimeType) {
		mimeType = '';
	}
	this._attachmentMIMEType = mimeType;
	return mimeType;
});


Zotero.Item.prototype.__defineSetter__('attachmentMIMEType', function (val) {
	if (!this.isAttachment()) {
		throw (".attachmentMIMEType can only be set for attachment items");
	}
	
	if (!val) {
		val = '';
	}
	
	if (val == this.attachmentMIMEType) {
		return;
	}
	
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.mimeType = true;
	this._attachmentMIMEType = val;
});


Zotero.Item.prototype.getAttachmentCharset = function() {
	Zotero.debug("getAttachmentCharset() deprecated -- use .attachmentCharset");
	return this.attachmentCharset;
}


/**
 * Character set of an attachment
 */
Zotero.Item.prototype.__defineGetter__('attachmentCharset', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (this._attachmentCharset !== undefined) {
		return Zotero.CharacterSets.getName(this._attachmentCharset);
	}
	
	if (!this.id) {
		return null;
	}
	
	var sql = "SELECT charsetID FROM itemAttachments WHERE itemID=?";
	var charset = Zotero.DB.valueQuery(sql, this.id);
	if (!charset) {
		charset = null;
	}
	this._attachmentCharset = charset;
	return Zotero.CharacterSets.getName(charset);
});


Zotero.Item.prototype.__defineSetter__('attachmentCharset', function (val) {
	if (!this.isAttachment()) {
		throw (".attachmentCharset can only be set for attachment items");
	}
	
	var oldVal = this.attachmentCharset;
	if (oldVal) {
		oldVal = Zotero.CharacterSets.getID(oldVal);
	}
	if (!oldVal) {
		oldVal = null;
	}
	
	if (val) {
		val = Zotero.CharacterSets.getID(val);
	}
	if (!val) {
		val = null;
	}
	
	if (val == oldVal) {
		return;
	}
	
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.charset = true;
	this._attachmentCharset = val;
});


Zotero.Item.prototype.__defineGetter__('attachmentPath', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (this._attachmentPath !== null)  {
		return this._attachmentPath;
	}
	
	if (!this.id) {
		return '';
	}
	
	var sql = "SELECT path FROM itemAttachments WHERE itemID=?";
	var path = Zotero.DB.valueQuery(sql, this.id);
	if (!path) {
		path = '';
	}
	this._attachmentPath = path;
	return path;
});


Zotero.Item.prototype.__defineSetter__('attachmentPath', function (val) {
	if (!this.isAttachment()) {
		throw (".attachmentPath can only be set for attachment items");
	}
	
	if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw ('attachmentPath cannot be set for link attachments');
	}
	
	if (!val) {
		val = '';
	}
	
	if (val == this.attachmentPath) {
		return;
	}
	
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.path = true;
	this._attachmentPath = val;
});


/**
 * Force an update of the attachment path and resave the item
 *
 * This is used when changing the attachment base directory, since relative
 * path handling is done on item save.
 */
Zotero.Item.prototype.updateAttachmentPath = function () {
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.path = true;
	this.save({
		skipDateModifiedUpdate: true
	});
};


Zotero.Item.prototype.__defineGetter__('attachmentSyncState', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (this._attachmentSyncState != undefined) {
		return this._attachmentSyncState;
	}
	
	if (!this.id) {
		return undefined;
	}
	
	var sql = "SELECT syncState FROM itemAttachments WHERE itemID=?";
	var syncState = Zotero.DB.valueQuery(sql, this.id);
	this._attachmentSyncState = syncState;
	return syncState;
});


Zotero.Item.prototype.__defineSetter__('attachmentSyncState', function (val) {
	if (!this.isAttachment()) {
		throw ("attachmentSyncState can only be set for attachment items");
	}
	
	switch (this.attachmentLinkMode) {
		case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
		case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
			break;
			
		default:
			throw ("attachmentSyncState can only be set for snapshots and "
				+ "imported files");
	}
	
	switch (val) {
		case Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD:
		case Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD:
		case Zotero.Sync.Storage.SYNC_STATE_IN_SYNC:
		case Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD:
		case Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD:
			break;
			
		default:
			throw ("Invalid sync state '" + val
				+ "' in Zotero.Item.attachmentSyncState setter");
	}
	
	if (val == this.attachmentSyncState) {
		return;
	}
	
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.syncState = true;
	this._attachmentSyncState = val;
});


/**
 * Modification time of an attachment file
 *
 * Note: This is the mod time of the file itself, not the last-known mod time
 * of the file on the storage server as stored in the database
 *
 * @return	{Number}		File modification time as timestamp in milliseconds
 */
Zotero.Item.prototype.__defineGetter__('attachmentModificationTime', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (!this.id) {
		return undefined;
	}
	
	var file = this.getFile();
	if (!file) {
		return undefined;
	}
	
	var fmtime = file.lastModifiedTime;
	
	if (fmtime < 1) {
		Zotero.debug("File mod time " + fmtime + " is less than 1 -- interpreting as 1", 2);
		fmtime = 1;
	}
	
	return fmtime;
});


/**
 * MD5 hash of an attachment file
 *
 * Note: This is the hash of the file itself, not the last-known hash
 * of the file on the storage server as stored in the database
 *
 * @return	{String}		MD5 hash of file as hex string
 */
Zotero.Item.prototype.__defineGetter__('attachmentHash', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (!this.id) {
		return undefined;
	}
	
	var file = this.getFile();
	if (!file) {
		return undefined;
	}
	
	return Zotero.Utilities.Internal.md5(file);
});


/**
 * Return plain text of attachment content
 *
 * - Currently works on HTML, PDF and plaintext attachments
 * - Paragraph breaks will be lost in PDF content
 * - For PDFs, will return empty string if Zotero.Fulltext.pdfConverterIsRegistered() is false
 *
 * @return	{String}	Attachment text, or empty string if unavailable
 */
Zotero.Item.prototype.__defineGetter__('attachmentText', function () {
	if (!this.isAttachment()) {
		return undefined;
	}
	
	if (!this.id) {
		return null;
	}
	
	var file = this.getFile();
	var cacheFile = Zotero.Fulltext.getItemCacheFile(this.id);
	if (!file) {
		if (cacheFile.exists()) {
			var str = Zotero.File.getContents(cacheFile);
			
			return str.trim();
		}
		return '';
	}
	
	var mimeType = this.attachmentMIMEType;
	if (!mimeType) {
		mimeType = Zotero.MIME.getMIMETypeFromFile(file);
		if (mimeType) {
			this.attachmentMIMEType = mimeType;
			this.save();
		}
	}
	
	var str;
	if (Zotero.Fulltext.isCachedMIMEType(mimeType)) {
		var reindex = false;
		
		if (!cacheFile.exists()) {
			Zotero.debug("Regenerating item " + this.id + " full-text cache file");
			reindex = true;
		}
		// Fully index item if it's not yet
		else if (!Zotero.Fulltext.isFullyIndexed(this.id)) {
			Zotero.debug("Item " + this.id + " is not fully indexed -- caching now");
			reindex = true;
		}
		
		if (reindex) {
			if (!Zotero.Fulltext.pdfConverterIsRegistered()) {
				Zotero.debug("PDF converter is unavailable -- returning empty .attachmentText", 3);
				return '';
			}
			Zotero.Fulltext.indexItems(this.id, false);
		}
		
		if (!cacheFile.exists()) {
			Zotero.debug("Cache file doesn't exist after indexing -- returning empty .attachmentText");
			return '';
		}
		str = Zotero.File.getContents(cacheFile);
	}
	
	else if (mimeType == 'text/html') {
		str = Zotero.File.getContents(file);
		str = Zotero.Utilities.unescapeHTML(str);
	}
	
	else if (mimeType == 'text/plain') {
		str = Zotero.File.getContents(file);
	}
	
	else {
		return '';
	}
	
	return str.trim();
});



/**
 * Returns child attachments of this item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items
 * @return	{Integer[]}						Array of itemIDs
 */
Zotero.Item.prototype.getAttachments = function(includeTrashed) {
	if (this.isAttachment()) {
		throw ("getAttachments() cannot be called on attachment items");
	}
	
	if (!this.id) {
		return [];
	}
	
	// Get the right cache array
	if (!this._cachedAttachments) {
		this._cachedAttachments = {
			chronologicalWithTrashed: null,
			chronologicalWithoutTrashed: null,
			alphabeticalWithTrashed: null,
			alphabeticalWithoutTrashed: null
		};
	}
	var cache = this._cachedAttachments;
	var cacheKey = (Zotero.Prefs.get('sortAttachmentsChronologically')
			? 'chronological' : 'alphabetical')
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	if (cache[cacheKey] !== null) {
		return cache[cacheKey];
	}
	
	var sql = "SELECT A.itemID, value AS title FROM itemAttachments A "
		+ "NATURAL JOIN items I LEFT JOIN itemData ID "
		+ "ON (fieldID=110 AND A.itemID=ID.itemID) "
		+ "LEFT JOIN itemDataValues IDV "
		+ "ON (ID.valueID=IDV.valueID) "
		+ "WHERE sourceItemID=?";
	if (!includeTrashed) {
		sql += " AND A.itemID NOT IN (SELECT itemID FROM deletedItems)";
	}
		
	if (Zotero.Prefs.get('sortAttachmentsChronologically')) {
		sql +=  " ORDER BY dateAdded";
		var results = Zotero.DB.columnQuery(sql, this.id);
		results = results ? results : [];
		cache[cacheKey] = results;
		return results;
	}
	
	var attachments = Zotero.DB.query(sql, this.id);
	if (!attachments) {
		cache[cacheKey] = [];
		return [];
	}
	
	// Sort by title
	var collation = Zotero.getLocaleCollation();
	var f = function (a, b) {
		return collation.compareString(1, a.title, b.title);
	}
	
	var attachmentIDs = [];
	attachments.sort(f);
	for each(var attachment in attachments) {
		attachmentIDs.push(attachment.itemID);
	}
	cache[cacheKey] = attachmentIDs;
	return attachmentIDs;
}


Zotero.Item.prototype.getBestSnapshot = function () {
	var msg = "Zotero.Item.getBestSnapshot() is deprecated -- use getBestAttachment";
	Zotero.debug(msg, 2);
	Components.utils.reportError(msg);
	return this.getBestAttachment();
}


/**
 * Looks for attachment in the following order: oldest PDF attachment matching parent URL,
 * oldest non-PDF attachment matching parent URL, oldest PDF attachment not matching URL,
 * old non-PDF attachment not matching URL
 *
 * @return	{Integer}		itemID for attachment
 */
Zotero.Item.prototype.getBestAttachment = function() {
	if (!this.isRegularItem()) {
		throw ("getBestAttachment() can only be called on regular items");
	}
	var attachments = this.getBestAttachments();
	return attachments ? attachments[0] : false;
}

/**
 * Returned cached state of best attachment for use in items view
 *
 * @return {Integer}  0 (none), 1 (present), -1 (missing)
 */
Zotero.Item.prototype.getBestAttachmentState = function (cachedOnly) {
	if (cachedOnly || this._bestAttachmentState !== null) {
		return this._bestAttachmentState;
	}
	var itemID = this.getBestAttachment();
	this._bestAttachmentState = itemID
		? (Zotero.Items.get(itemID).fileExists() ? 1 : -1)
		: 0;
	return this._bestAttachmentState;
}


/**
 * Return cached state of best attachment for use in items view
 *
 * @return {Promise:Integer}  Promise with 0 (none), 1 (present), -1 (missing)
 */
Zotero.Item.prototype.getBestAttachmentStateAsync = function () {
	var self = this;
	return Q.fcall(function() {
		if (self._bestAttachmentState !== null) {
			return self._bestAttachmentState;
		}
		var itemID = self.getBestAttachment();
		if (itemID) {
			return Zotero.Items.get(itemID).fileExistsAsync()
			.then(function (exists) {
				self._bestAttachmentState = exists ? 1 : -1;
			});
		}
		else {
			self._bestAttachmentState = 0;
		}
	})
	.then(function () {
		return self._bestAttachmentState;
	});
}


Zotero.Item.prototype.updateBestAttachmentState = function () {
	this._bestAttachmentState = null;
}


/**
 * Looks for attachment in the following order: oldest PDF attachment matching parent URL,
 * oldest PDF attachment not matching parent URL, oldest non-PDF attachment matching parent URL,
 * old non-PDF attachment not matching parent URL
 *
 * @return	{Array|FALSE}		itemIDs for attachments, or FALSE if none
 */
Zotero.Item.prototype.getBestAttachments = function() {
	if (!this.isRegularItem()) {
		throw ("getBestAttachments() can only be called on regular items");
	}
	
	var url = this.getField('url');
	
	var sql = "SELECT IA.itemID FROM itemAttachments IA NATURAL JOIN items I "
		+ "LEFT JOIN itemData ID ON (IA.itemID=ID.itemID AND fieldID=1) "
		+ "LEFT JOIN itemDataValues IDV ON (ID.valueID=IDV.valueID) "
		+ "WHERE sourceItemID=? AND linkMode NOT IN (?) "
		+ "AND IA.itemID NOT IN (SELECT itemID FROM deletedItems) "
		+ "ORDER BY mimeType='application/pdf' DESC, value=? DESC, dateAdded ASC";
	return Zotero.DB.columnQuery(sql, [this.id, Zotero.Attachments.LINK_MODE_LINKED_URL, url]);
}


//
// Methods dealing with item tags
//
// save() is not required for tag functions
//
Zotero.Item.prototype.addTag = function(name, type) {
	if (!this.id) {
		throw ('Cannot add tag to unsaved item in Item.addTag()');
	}
	
	name = Zotero.Utilities.trim(name);
	
	if (!name) {
		Zotero.debug('Not saving empty tag in Item.addTag()', 2);
		return false;
	}
	
	if (!type) {
		type = 0;
	}
	
	Zotero.DB.beginTransaction();
	try {
	
	var matchingTags = Zotero.Tags.getIDs(name, this.libraryID);
	var itemTags = this.getTags();
	if (matchingTags && itemTags.length) {
		for each(var id in matchingTags) {
			if (itemTags.indexOf(id) != -1) {
				var tag = Zotero.Tags.get(id);
				// If existing automatic and adding identical user,
				// remove automatic
				if (type == 0 && tag.type == 1) {
					this.removeTag(id);
					break;
				}
				// If existing user and adding automatic, skip
				else if (type == 1 && tag.type == 0) {
					Zotero.debug("Identical user tag '" + name
						+ "' already exists -- skipping automatic tag");
					Zotero.DB.commitTransaction();
					return false;
				}
			}
		}
	}
	
	var tagID = Zotero.Tags.getID(name, type, this.libraryID);
	if (!tagID) {
		var tag = new Zotero.Tag;
		tag.libraryID = this.libraryID ? this.libraryID : null;
		tag.name = name;
		tag.type = type;
		var tagID = tag.save();
	}
	
	var added = this.addTagByID(tagID);
	Zotero.DB.commitTransaction();
	return added ? tagID : false;
	
	}
	catch (e) {
		Zotero.debug(e);
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
}


Zotero.Item.prototype.addTags = function (tags, type) {
	Zotero.DB.beginTransaction();
	try {
		var tagIDs = [];
		for (var i = 0; i < tags.length; i++) {
			let id = this.addTag(tags[i], type);
			if (id) {
				tagIDs.push(id);
			}
		}
		
		Zotero.DB.commitTransaction();
		return tagIDs.length > 0 ? tagIDs : false;
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
}


Zotero.Item.prototype.addTagByID = function(tagID) {
	if (!this.id) {
		throw ('Cannot add tag to unsaved item in Zotero.Item.addTagByID()');
	}
	
	if (!tagID) {
		throw ('tagID not provided in Zotero.Item.addTagByID()');
	}
	
	var tag = Zotero.Tags.get(tagID);
	if (!tag) {
		throw ('Cannot add invalid tag ' + tagID + ' in Zotero.Item.addTagByID()');
	}
	
	var added = tag.addItem(this.id);
	if (!added) {
		return false;
	}
	tag.save();
	return true;
}

Zotero.Item.prototype.hasTag = function(tagID) {
	return this.hasTags(tagID);
}

/*
 * Returns true if the item has one or more of |tagIDs|
 *
 * |tagIDs| can be an int or array of ints
 */
Zotero.Item.prototype.hasTags = function(tagIDs) {
	var tagIDs = Zotero.flattenArguments(tagIDs);
	
	var sql = "SELECT COUNT(*) FROM itemTags WHERE itemID=? AND tagID IN ("
				+ tagIDs.map(function () '?').join() + ")";
	return !!Zotero.DB.valueQuery(sql, [this.id].concat(tagIDs));
}

/**
 * Returns all tags assigned to an item
 *
 * @return	Array			Array of Zotero.Tag objects
 */
Zotero.Item.prototype.getTags = function() {
	if (!this.id) {
		return [];
	}
	var sql = "SELECT tagID, name FROM tags WHERE tagID IN "
		+ "(SELECT tagID FROM itemTags WHERE itemID=?)";
	var tags = Zotero.DB.query(sql, this.id);
	if (!tags) {
		return [];
	}
	
	var collation = Zotero.getLocaleCollation();
	tags.sort(function(a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	var tagObjs = [];
	for (var i=0; i<tags.length; i++) {
		var tag = Zotero.Tags.get(tags[i].tagID);
		tagObjs.push(tag);
	}
	return tagObjs;
}

Zotero.Item.prototype.getTagIDs = function() {
	var sql = "SELECT tagID FROM itemTags WHERE itemID=?";
	return Zotero.DB.columnQuery(sql, this.id);
}

Zotero.Item.prototype.replaceTag = function(oldTagID, newTag) {
	if (!this.id) {
		throw ('Cannot replace tag on unsaved item');
	}
	
	newTag = Zotero.Utilities.trim(newTag);
	
	if (!newTag) {
		Zotero.debug('Not replacing with empty tag', 2);
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	var oldTag = Zotero.Tags.getName(oldTagID);
	if (oldTag==newTag) {
		Zotero.DB.commitTransaction();
		return false;
	}
	
	this.removeTag(oldTagID);
	var id = this.addTag(newTag);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.id);
	Zotero.Notifier.trigger('remove', 'item-tag', this.id + '-' + oldTagID);
	if (id) {
		Zotero.Notifier.trigger('add', 'item-tag', this.id + '-' + id);
	}
	return id;
}

Zotero.Item.prototype.removeTag = function(tagID) {
	if (!this.id) {
		throw ('Cannot remove tag on unsaved item in Zotero.Item.removeTag()');
	}
	
	if (!tagID) {
		throw ('tagID not provided in Zotero.Item.removeTag()');
	}
	
	var tag = Zotero.Tags.get(tagID);
	if (!tag) {
		throw ('Cannot remove invalid tag ' + tagID + ' in Zotero.Item.removeTag()');
	}
	
	tag.removeItem(this.id);
	tag.save();
	
	if (!tag.countLinkedItems()) {
		Zotero.Prefs.set('purge.tags', true);
	}
}

Zotero.Item.prototype.removeAllTags = function() {
	if (!this.id) {
		throw ('Cannot remove tags on unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var tagIDs = this.getTagIDs();
	if (!tagIDs) {
		Zotero.DB.commitTransaction();
		return;
	}
	
	Zotero.DB.query("DELETE FROM itemTags WHERE itemID=?", this.id);
	Zotero.Tags.purge();
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.id);
	
	for (var i in tagIDs) {
		tagIDs[i] = this.id + '-' + tagIDs[i];
	}
	Zotero.Notifier.trigger('remove', 'item-tag', tagIDs);
}


/**
 * Return an item in the specified library equivalent to this item
 */
Zotero.Item.prototype.getLinkedItem = function (libraryID) {
	if (libraryID == this.libraryID) {
		throw ("Item is already in library " + libraryID + " in Zotero.Item.getLinkedItem()");
	}
	
	var predicate = Zotero.Relations.linkedObjectPredicate;
	var itemURI = Zotero.URI.getItemURI(this);
	var links = Zotero.Relations.getObject(itemURI, predicate, false).concat(
		Zotero.Relations.getSubject(false, predicate, itemURI)
	);
	
	if (!links.length) {
		return false;
	}
	
	if (libraryID) {
		var libraryItemPrefix = Zotero.URI.getLibraryURI(libraryID) + "/items/";
	}
	else {
		var libraryItemPrefix = Zotero.URI.getCurrentUserURI() + "/items/";
	}
	for each(var link in links) {
		if (link.indexOf(libraryItemPrefix) == 0) {
			var item = Zotero.URI.getURIItem(link);
			if (!item) {
				Zotero.debug("Referenced linked item '" + link + "' not found in Zotero.Item.getLinkedItem()", 2);
				continue;
			}
			return item;
		}
	}
	return false;
}


Zotero.Item.prototype.addLinkedItem = function (item) {
	var url1 = Zotero.URI.getItemURI(this);
	var url2 = Zotero.URI.getItemURI(item);
	var predicate = Zotero.Relations.linkedObjectPredicate;
	if (Zotero.Relations.getByURIs(url1, predicate, url2).length
			|| Zotero.Relations.getByURIs(url2, predicate, url1).length) {
		Zotero.debug("Items " + this.key + " and " + item.key + " are already linked");
		return false;
	}
	
	// If one of the items is a personal library, store relation with that.
	// Otherwise, use current item's library (which in calling code is the
	// new, copied item).
	var libraryID = (!this.libraryID || !item.libraryID) ? null : this.libraryID;
	
	Zotero.Relations.add(libraryID, url1, predicate, url2);
}




Zotero.Item.prototype.getImageSrc = function() {
	var itemType = Zotero.ItemTypes.getName(this.itemTypeID);
	if (itemType == 'attachment') {
		var linkMode = this.attachmentLinkMode;
		
		// Quick hack to use PDF icon for imported files and URLs --
		// extend to support other document types later
		if ((linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE ||
				linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) &&
				this.attachmentMIMEType == 'application/pdf') {
			itemType += '-pdf';
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
			itemType += "-file";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			itemType += "-link";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) {
			itemType += "-snapshot";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			itemType += "-web-link";
		}
	}
	
	return Zotero.ItemTypes.getImageSrc(itemType);
}



/**
 * Compares this item to another
 *
 * Returns a two-element array containing two objects with the differing values,
 * or FALSE if no differences
 *
 * @param	{Zotero.Item}	item						Zotero.Item to compare this item to
 * @param	{Boolean}		includeMatches			Include all fields, even those that aren't different
 * @param	{Boolean}		ignoreFields			If no fields other than those specified
 *														are different, just return false --
 *														only works for primary fields
 */
Zotero.Item.prototype.diff = function (item, includeMatches, ignoreFields) {
	var diff = [];
	
	if (!ignoreFields) {
		ignoreFields = [];
	}
	
	var thisData = this.serialize();
	var otherData = item.serialize();
	
	var numDiffs = Zotero.Items.diff(thisData, otherData, diff, includeMatches);
	
	diff[0].creators = [];
	diff[1].creators = [];
	// TODO: creators?
	// TODO: tags?
	// TODO: related?
	// TODO: annotations
	
	var changed = false;
	
	changed = thisData.sourceItemKey != otherData.sourceItemKey;
	if (includeMatches || changed) {
		diff[0].sourceItemKey = thisData.sourceItemKey;
		diff[1].sourceItemKey = otherData.sourceItemKey;
		
		if (changed) {
			numDiffs++;
		}
	}
	
	if (thisData.attachment) {
		for (var field in thisData.attachment) {
			changed = thisData.attachment[field] != otherData.attachment[field];
			if (includeMatches || changed) {
				if (!diff[0].attachment) {
					diff[0].attachment = {};
					diff[1].attachment = {};
				}
				diff[0].attachment[field] = thisData.attachment[field];
				diff[1].attachment[field] = otherData.attachment[field];
			}
			
			if (changed) {
				numDiffs++;
			}
		}
	}
	
	if (thisData.note != undefined) {
		// Whitespace and entity normalization
		//
		// Ideally this would all be fixed elsewhere so we didn't have to
		// convert on every sync diff
		//
		// TEMP: Using a try/catch to avoid unexpected errors in 2.1 releases
		try {
			var thisNote = thisData.note;
			var otherNote = otherData.note;
			
			// Stop non-Unix newlines from triggering erroneous conflicts
			thisNote = thisNote.replace(/\r\n?/g, "\n");
			otherNote = otherNote.replace(/\r\n?/g, "\n");
			
			// Normalize multiple spaces (due to differences TinyMCE, Z.U.text2html(),
			// and the server)
			var re = /(&nbsp; |&nbsp;&nbsp;|\u00a0 |\u00a0\u00a0)/g;
			thisNote = thisNote.replace(re, "  ");
			otherNote = otherNote.replace(re, "  ");
			
			// Normalize new paragraphs
			var re = /<p>(&nbsp;|\u00a0)<\/p>/g;
			thisNote = thisNote.replace(re, "<p> </p>");
			otherNote = otherNote.replace(re, "<p> </p>");
			
			// Unencode XML entities
			thisNote = thisNote.replace(/&amp;/g, "&");
			otherNote = otherNote.replace(/&amp;/g, "&");
			thisNote = thisNote.replace(/&apos;/g, "'");
			otherNote = otherNote.replace(/&apos;/g, "'");
			thisNote = thisNote.replace(/&quot;/g, '"');
			otherNote = otherNote.replace(/&quot;/g, '"');
			thisNote = thisNote.replace(/&lt;/g, "<");
			otherNote = otherNote.replace(/&lt;/g, "<");
			thisNote = thisNote.replace(/&gt;/g, ">");
			otherNote = otherNote.replace(/&gt;/g, ">");
			
			changed = thisNote != otherNote;
		}
		catch (e) {
			Zotero.debug(e);
			Components.utils.reportError(e);
			changed = thisNote != otherNote;
		}
		
		if (includeMatches || changed) {
			diff[0].note = thisNote;
			diff[1].note = otherNote;
		}
		
		if (changed) {
			numDiffs++;
		}
	}
	
	//Zotero.debug(thisData);
	//Zotero.debug(otherData);
	//Zotero.debug(diff);
	
	if (numDiffs == 0) {
		return false;
	}
	if (ignoreFields.length && diff[0].primary) {
		if (includeMatches) {
			throw ("ignoreFields cannot be used if includeMatches is set");
		}
		var realDiffs = numDiffs;
		for each(var field in ignoreFields) {
			if (diff[0].primary[field] != undefined) {
				realDiffs--;
				if (realDiffs == 0) {
					return false;
				}
			}
		}
	}
	
	return diff;
}


/**
 * Compare multiple items against this item and return fields that differ
 *
 * Currently compares only item data, not primary fields
 */
Zotero.Item.prototype.multiDiff = function (otherItems, ignoreFields) {
	var thisData = this.serialize();
	
	var alternatives = {};
	var hasDiffs = false;
	
	for each(var otherItem in otherItems) {
		var diff = [];
		var otherData = otherItem.serialize();
		var numDiffs = Zotero.Items.diff(thisData, otherData, diff);
		
		if (numDiffs) {
			for (var field in diff[1].fields) {
				if (ignoreFields && ignoreFields.indexOf(field) != -1) {
					continue;
				}
				
				var value = diff[1].fields[field];
				
				if (!alternatives[field]) {
					hasDiffs = true;
					alternatives[field] = [value];
				}
				else if (alternatives[field].indexOf(value) == -1) {
					hasDiffs = true;
					alternatives[field].push(value);
				}
			}
		}
	}
	
	if (!hasDiffs) {
		return false;
	}
	
	return alternatives;
}


/**
 * Returns an unsaved copy of the item
 *
 * @param  {Boolean}       [includePrimary=false]
 * @param  {Zotero.Item}   [newItem=null]         Target item for clone (used to pass a saved
 *                                                    item for duplicating items with tags)
 * @param  {Boolean}       [unsaved=false]        Skip properties that require a saved object (e.g., tags)
 * @param  {Boolean}       [skipTags=false]       Skip tags (implied by 'unsaved')
 */
Zotero.Item.prototype.clone = function(includePrimary, newItem, unsaved, skipTags) {
	Zotero.debug('Cloning item ' + this.id);
	
	if (includePrimary && newItem) {
		throw ("includePrimary and newItem parameters are mutually exclusive in Zotero.Item.clone()");
	}
	
	if (unsaved) {
		skipTags = true;
	}
	
	Zotero.DB.beginTransaction();
	
	// TODO: get rid of serialize() call
	var obj = this.serialize();
	
	var itemTypeID = this.itemTypeID;
	
	if (newItem) {
		var sameLibrary = newItem.libraryID == this.libraryID;
	}
	else {
		var newItem = new Zotero.Item;
		var sameLibrary = true;
		
		if (includePrimary) {
			newItem.id = this.id;
			newItem.libraryID = this.libraryID;
			newItem.key = this.key;
			newItem.setType(itemTypeID);
			for (var field in obj.primary) {
				switch (field) {
					case 'itemID':
					case 'itemType':
					case 'libraryID':
					case 'key':
						continue;
				}
				newItem.setField(field, obj.primary[field]);
			}
		}
		else {
			newItem.setType(itemTypeID);
		}
	}
	
	var changedFields = {};
	for (var field in obj.fields) {
		var fieldID = Zotero.ItemFields.getID(field);
		if (fieldID && Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
			newItem.setField(field, obj.fields[field]);
			changedFields[field] = true;
		}
	}
	// If modifying an existing item, clear other fields not in the cloned item
	if (newItem) {
		var previousFields = this.getUsedFields(true);
		for each(var field in previousFields) {
			if (!changedFields[field] && Zotero.ItemFields.isValidForType(field, itemTypeID)) {
				newItem.setField(field, false);
			}
		}
	}
	
	// Regular item
	if (this.isRegularItem()) {
		if (includePrimary) {
			// newItem = loaded from db
			// obj = in-memory
			var max = Math.max(newItem.numCreators(), this.numCreators());
			var deleteOffset = 0;
			for (var i=0; i<max; i++) {
				var newIndex = i - deleteOffset;
				
				// Remove existing creators (loaded because we set the itemID
				// above) not in the in-memory version
				if (!obj.creators[i]) {
					if (newItem.getCreator(newIndex)) {
						newItem.removeCreator(newIndex);
						deleteOffset++;
					}
					continue;
				}
				// Add in-memory creators
				newItem.setCreator(
					newIndex, this.getCreator(i).ref, obj.creators[i].creatorType
				);
			}
		}
		else {
			// If overwriting an existing item, clear existing creators
			if (newItem) {
				for (var i=newItem.numCreators()-1; i>=0; i--) {
					if (newItem.getCreator(i)) {
						newItem.removeCreator(i);
					}
				}
			}
			
			var i = 0;
			for (var c in obj.creators) {
				var creator = this.getCreator(c).ref;
				var creatorTypeID = this.getCreator(c).creatorTypeID;
				
				if (!sameLibrary) {
					var creatorDataID = Zotero.Creators.getDataID(this.getCreator(c).ref);
					var creatorIDs = Zotero.Creators.getCreatorsWithData(creatorDataID, newItem.libraryID);
					if (creatorIDs) {
						// TODO: support multiple creators?
						var creator = Zotero.Creators.get(creatorIDs[0]);
					}
					else {
						var newCreator = new Zotero.Creator;
						newCreator.libraryID = newItem.libraryID;
						newCreator.setFields(creator);
						var creator = newCreator;
					}
					
					var creatorTypeID = this.getCreator(c).creatorTypeID;
				}
				
				newItem.setCreator(i, creator, creatorTypeID);
				i++;
			}
		}
	}
	else {
		newItem.setNote(this.getNote());
		if (sameLibrary) {
			var parent = this.getSourceKey();
			if (parent) {
				newItem.setSourceKey(parent);
			}
		}
		
		if (this.isAttachment()) {
			newItem.attachmentLinkMode = this.attachmentLinkMode;
			newItem.attachmentMIMEType = this.attachmentMIMEType;
			newItem.attachmentCharset = this.attachmentCharset;
			if (sameLibrary) {
				if (this.attachmentPath) {
					newItem.attachmentPath = this.attachmentPath;
				}
				if (this.attachmentSyncState) {
					newItem.attachmentSyncState = this.attachmentSyncState;
				}
			}
		}
	}
	
	if (!skipTags && obj.tags) {
		for each(var tag in obj.tags) {
			if (sameLibrary) {
				newItem.addTagByID(tag.primary.tagID);
			}
			else {
				newItem.addTag(tag.fields.name, tag.fields.type);
			}
		}
	}
	
	if (obj.related && sameLibrary) {
		// DEBUG: this will add reverse-only relateds too
		newItem.relatedItems = obj.related;
	}
	
	Zotero.DB.commitTransaction();
	
	return newItem;
}


/**
 * Delete item from database and clear from Zotero.Items internal array
 *
 * Items.erase() should be used instead of this
 */
Zotero.Item.prototype.erase = function() {
	if (!this.id) {
		return false;
	}
	
	Zotero.debug('Deleting item ' + this.id);
	
	var changedItems = [];
	var changedItemsNotifierData = {};
	
	Zotero.DB.beginTransaction();
	
	var deletedItemNotifierData = {};
	deletedItemNotifierData[this.id] = { old: this.serialize() };
	
	// Remove group item metadata
	if (this.libraryID) {
		var sql = "DELETE FROM groupItems WHERE itemID=?";
		Zotero.DB.query(sql, this.id);
	}
	
	// Remove item from parent collections
	var parentCollectionIDs = this.getCollections();
	if (parentCollectionIDs) {
		for (var i=0; i<parentCollectionIDs.length; i++) {
			Zotero.Collections.get(parentCollectionIDs[i]).removeItem(this.id);
		}
	}
	
	// Note
	if (this.isNote()) {
		// Decrement note count of source items
		var sql = "SELECT sourceItemID FROM itemNotes WHERE itemID=" + this.id;
		var sourceItemID = Zotero.DB.valueQuery(sql);
		if (sourceItemID) {
			var sourceItem = Zotero.Items.get(sourceItemID);
			//changedItemsNotifierData[sourceItem.id] = {};
			if (!this.deleted) {
				sourceItem.decrementNoteCount();
			}
			changedItems.push(sourceItemID);
		}
	}
	// Attachment
	else if (this.isAttachment()) {
		// Decrement file count of source items
		var sql = "SELECT sourceItemID FROM itemAttachments WHERE itemID=" + this.id;
		var sourceItemID = Zotero.DB.valueQuery(sql);
		if (sourceItemID) {
			var sourceItem = Zotero.Items.get(sourceItemID);
			//changedItemsNotifierData[sourceItem.id] = {};
			if (!this.deleted) {
				sourceItem.decrementAttachmentCount();
			}
			changedItems.push(sourceItemID);
		}
		
		// Delete associated files
		var linkMode = this.getAttachmentLinkMode();
		switch (linkMode) {
			// Link only -- nothing to delete
			case Zotero.Attachments.LINK_MODE_LINKED_URL:
				break;
			default:
				try {
					var file = Zotero.Attachments.getStorageDirectory(this.id);
					if (file.exists()) {
						file.remove(true);
					}
				}
				catch (e) {
					Components.utils.reportError(e);
				}
		}
	}
	
	// Regular item
	
	// If flag given, delete child notes and files
	else {
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=?1 UNION "
			+ "SELECT itemID FROM itemAttachments WHERE sourceItemID=?1";
		var toDelete = Zotero.DB.columnQuery(sql, [this.id]);
		
		if (toDelete) {
			for (var i in toDelete) {
				var obj = Zotero.Items.get(toDelete[i]);
				obj.erase();
			}
		}
	}
	
	// Flag related items for notification
	var relateds = this._getRelatedItemsBidirectional();
	for each(var id in relateds) {
		var relatedItem = Zotero.Items.get(id);
		if (changedItems.indexOf(id) != -1) {
			//changedItemsNotifierData[id] = {};
			changedItems.push(id);
		}
	}
	
	// Clear fulltext cache
	if (this.isAttachment()) {
		Zotero.Fulltext.clearItemWords(this.id);
		//Zotero.Fulltext.clearItemContent(this.id);
	}
	
	// Remove relations (except for merge tracker)
	var uri = Zotero.URI.getItemURI(this);
	Zotero.Relations.eraseByURI(uri, [Zotero.Relations.deletedItemPredicate]);
	
	Zotero.DB.query('DELETE FROM annotations WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM highlights WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM deletedItems WHERE itemID=?', this.id);
	var hasCreators = Zotero.DB.valueQuery(
		"SELECT rowid FROM itemCreators WHERE itemID=? LIMIT 1", this.id
	);
	if (hasCreators) {
		Zotero.DB.query('DELETE FROM itemCreators WHERE itemID=?', this.id);
	}
	Zotero.DB.query('DELETE FROM itemNotes WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemAttachments WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemSeeAlso WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemSeeAlso WHERE linkedItemID=?', this.id);
	
	var tags = this.getTags();
	if (tags.length) {
		var hasTags = true;
		Zotero.DB.query('DELETE FROM itemTags WHERE itemID=?', this.id);
		// DEBUG: Hack to reload linked items -- replace with something better
		for each(var tag in tags) {
			tag._linkedItemsLoaded = false;
		}
	}
	else {
		var hasTags = false;
	}
	
	Zotero.DB.query('DELETE FROM itemData WHERE itemID=?', this.id);
	
	try {
		Zotero.DB.query('DELETE FROM items WHERE itemID=?', this.id);
	}
	catch (e) {
		// If deletion fails, try to correct a few things that have come up before
		Zotero.debug("Item deletion failed -- trying to fix", 2);
		Zotero.Fulltext.clearItemWords(this.id);
		Zotero.DB.query('DELETE FROM itemTags WHERE itemID=?', this.id);
		
		// And then try again
		Zotero.DB.query('DELETE FROM items WHERE itemID=?', this.id);
	}
	
	try {
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		// On failure, reset count of source items
		if (sourceItem) {
			if (this.isNote()) {
				sourceItem.incrementNoteCount();
			}
			else if (this.isAttachment()) {
				sourceItem.incrementAttachmentCount();
			}
		}
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	Zotero.Items.unload(this.id);
	
	// Send notification of changed items
	if (changedItems.length) {
		Zotero.Notifier.trigger('modify', 'item', changedItems, changedItemsNotifierData);
	}
	
	Zotero.Notifier.trigger('delete', 'item', this.id, deletedItemNotifierData);
	
	Zotero.Prefs.set('purge.items', true);
	if (hasCreators) {
		Zotero.Prefs.set('purge.creators', true);
	}
	if (hasTags) {
		Zotero.Prefs.set('purge.tags', true);
	}
}


Zotero.Item.prototype.isCollection = function() {
	return false;
}


Zotero.Item.prototype.toArray = function (mode) {
	Zotero.debug('Zotero.Item.toArray() is deprecated -- use Zotero.Item.serialize()');
	
	if (this.id || this.key) {
		if (!this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
		if (!this._itemDataLoaded) {
			this._loadItemData();
		}
	}
	
	var arr = {};
	
	// Primary fields
	for each(var i in Zotero.Items.primaryFields) {
		switch (i) {
			case 'itemID':
				arr.itemID = this._id;
				continue;
			
			case 'itemTypeID':
				arr.itemType = Zotero.ItemTypes.getName(this.itemTypeID);
				continue;
			
			// Skip virtual fields
			case 'firstCreator':
			case 'numNotes':
			case 'numAttachments':
			case 'sourceItemID':
				continue;
			
			// For the rest, just copy over
			default:
				arr[i] = this['_' + i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData) {
		arr[Zotero.ItemFields.getName(i)] = this.getField(i) + '';
	}
	
	if (mode == 1 || mode == 2) {
		if (!arr.title &&
				(this.itemTypeID == Zotero.ItemTypes.getID('letter') ||
				this.itemTypeID == Zotero.ItemTypes.getID('interview'))) {
			arr.title = this.getDisplayTitle(mode == 2) + '';
		}
	}
	
	if (!this.isNote() && !this.isAttachment()) {
		// Creators
		arr.creators = [];
		var creators = this.getCreators();
		for (var i in creators) {
			var creator = {};
			// Convert creatorTypeIDs to text
			creator.creatorType =
				Zotero.CreatorTypes.getName(creators[i].creatorTypeID);
			creator.creatorID = creators[i].ref.id;
			creator.firstName = creators[i].ref.firstName;
			creator.lastName = creators[i].ref.lastName;
			creator.fieldMode = creators[i].ref.fieldMode;
			arr.creators.push(creator);
		}
	}
	
	// Notes
	if (this.isNote()) {
		arr.note = this.getNote();
		var parent = this.getSourceKey();
		if (parent) {
			arr.sourceItemKey = parent;
		}
	}
	
	// Attachments
	if (this.isAttachment()) {
		// Attachments can have embedded notes
		arr.note = this.getNote();
		
		var parent = this.getSourceKey();
		if (parent) {
			arr.sourceItemKey = parent;
		}
	}
	
	// Attach children of regular items
	if (this.isRegularItem()) {
		// Append attached notes
		arr.notes = [];
		var notes = this.getNotes();
		for (var i in notes) {
			var note = Zotero.Items.get(notes[i]);
			arr.notes.push(note.toArray());
		}
		
		arr.attachments = [];
		var attachments = this.getAttachments();
		for (var i in attachments) {
			var attachment = Zotero.Items.get(attachments[i]);
			arr.attachments.push(attachment.toArray());
		}
	}
	
	arr.tags = [];
	var tags = this.getTags();
	for (var i=0, len=tags.length; i<len; i++) {
		var tag = tags[i].serialize();
		tag.tag = tag.fields.name;
		tag.type = tag.fields.type;
		arr.tags.push(tag);
	}
	
	arr.related = this._getRelatedItemsBidirectional();
	
	return arr;
}

/*
 * Convert the item object into a persistent form
 *	for use by the export functions
 *
 * Modes:
 *
 * 1 == e.g. [Letter to Valee]
 * 2 == e.g. [Stothard; Letter to Valee; May 8, 1928]
 */
Zotero.Item.prototype.serialize = function(mode) {
	if (this.id || this.key) {
		if (!this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
		if (!this._itemDataLoaded && this.id) {
			this._loadItemData();
		}
	}
	
	var arr = {};
	arr.primary = {};
	arr.virtual = {};
	arr.fields = {};
	
	// Primary and virtual fields
	for each(var i in Zotero.Items.primaryFields) {
		switch (i) {
			case 'itemID':
				arr.primary.itemID = this._id;
				continue;
			
			case 'itemTypeID':
				arr.primary.itemType = Zotero.ItemTypes.getName(this.itemTypeID);
				continue;
			
			case 'firstCreator':
				arr.virtual[i] = this['_' + i] + '';
				continue;
				
			case 'numNotes':
			case 'numAttachments':
				arr.virtual[i] = this['_' + i];
				continue;
			
			case 'sourceItemID':
				continue;
			
			// For the rest, just copy over
			default:
				arr.primary[i] = this['_' + i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData) {
		arr.fields[Zotero.ItemFields.getName(i)] = this.getField(i) + '';
	}
	
	if (mode == 1 || mode == 2) {
		if (!arr.fields.title &&
				(this.itemTypeID == Zotero.ItemTypes.getID('letter') ||
				this.itemTypeID == Zotero.ItemTypes.getID('interview'))) {
			arr.fields.title = this.getDisplayTitle(mode == 2) + '';
		}
	}
	
	// Deleted items flag
	if (this.deleted) {
		arr.deleted = true;
	}
	
	if (this.isRegularItem()) {
		// Creators
		arr.creators = [];
		var creators = this.getCreators();
		for (var i in creators) {
			var creator = {};
			// Convert creatorTypeIDs to text
			creator.creatorType = Zotero.CreatorTypes.getName(creators[i].creatorTypeID);
			creator.creatorID = creators[i].ref.id;
			creator.firstName = creators[i].ref.firstName;
			creator.lastName = creators[i].ref.lastName;
			creator.fieldMode = creators[i].ref.fieldMode;
			creator.libraryID = creators[i].ref.libraryID;
			creator.key = creators[i].ref.key;
			arr.creators.push(creator);
		}
		
		// Attach children of regular items
		
		// Append attached notes
		arr.notes = [];
		var notes = this.getNotes();
		for (var i in notes) {
			var note = Zotero.Items.get(notes[i]);
			arr.notes.push(note.serialize());
		}
		
		// Append attachments
		arr.attachments = [];
		var attachments = this.getAttachments();
		for (var i in attachments) {
			var attachment = Zotero.Items.get(attachments[i]);
			arr.attachments.push(attachment.serialize());
		}
	}
	// Notes and embedded attachment notes
	else {
		if (this.isAttachment()) {
			arr.attachment = {};
			arr.attachment.linkMode = this.attachmentLinkMode;
			arr.attachment.mimeType = this.attachmentMIMEType;
			arr.attachment.charset = this.attachmentCharset;
			arr.attachment.path = this.attachmentPath;
		}
		
		arr.note = this.getNote();
		var parent = this.getSourceKey();
		if (parent) {
			arr.sourceItemKey = parent;
		}
	}
	
	arr.tags = [];
	var tags = this.getTags();
	for (var i=0, len=tags.length; i<len; i++) {
		arr.tags.push(tags[i].serialize());
	}
	
	arr.related = this._getRelatedItems(true);
	arr.relatedReverse = this._getRelatedItemsReverse();
	
	return arr;
}



//////////////////////////////////////////////////////////////////////////////
//
// Private Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Load in the creators from the database
 */
Zotero.Item.prototype._loadCreators = function() {
	if (!this.id) {
		throw ('ItemID not set for item before attempting to load creators');
	}
	
	var sql = 'SELECT creatorID, creatorTypeID, orderIndex FROM itemCreators '
		+ 'WHERE itemID=? ORDER BY orderIndex';
	var creators = Zotero.DB.query(sql, this.id);
	
	this._creators = [];
	this._creatorsLoaded = true;
	
	if (!creators) {
		return true;
	}
	
	for (var i=0; i<creators.length; i++) {
		var creatorObj = Zotero.Creators.get(creators[i].creatorID);
		if (!creatorObj) {
			creatorObj = new Zotero.Creator();
			creatorObj.id = creators[i].creatorID;
		}
		this._creators[creators[i].orderIndex] = {
			ref: creatorObj,
			creatorTypeID: creators[i].creatorTypeID
		};
	}
	
	return true;
}


/*
 * Load in the field data from the database
 */
Zotero.Item.prototype._loadItemData = function() {
	if (!this.id) {
		// Log backtrace and data
		try {
			asfasfsa();
		}
		catch (e) {
			Zotero.debug(e);
			Zotero.debug(this._itemTypeID);
			Zotero.debug(this._libraryID);
			Zotero.debug(this._key);
			Zotero.debug(this._dateAdded);
			Zotero.debug(this._dateModified);
		}
		throw ('ItemID not set for object before attempting to load data');
	}
	
	var sql = "SELECT fieldID, value FROM itemData NATURAL JOIN itemDataValues "
				+ "WHERE itemID=?";
	var fields = Zotero.DB.query(sql, this.id);
	
	var itemTypeFields = Zotero.ItemFields.getItemTypeFields(this.itemTypeID);
	
	for each(var field in fields) {
		this.setField(field.fieldID, field.value, true);
	}
	
	// Mark nonexistent fields as loaded
	for each(var fieldID in itemTypeFields) {
		if (this._itemData[fieldID] === null) {
			this._itemData[fieldID] = false;
		}
	}
	
	this._itemDataLoaded = true;
}


Zotero.Item.prototype._loadRelatedItems = function() {
	if (!this.id) {
		return;
	}
	
	if (!this._primaryDataLoaded) {
		this.loadPrimaryData(true);
	}
	
	var sql = "SELECT linkedItemID FROM itemSeeAlso WHERE itemID=?";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	
	this._relatedItems = [];
	
	if (ids) {
		for each(var id in ids) {
			this._relatedItems.push(Zotero.Items.get(id));
		}
	}
	
	this._relatedItemsLoaded = true;
}


/**
 * Returns related items this item point to
 *
 * @param	bool		asIDs		Return as itemIDs
 * @return	array					Array of itemIDs
 */
Zotero.Item.prototype._getRelatedItems = function (asIDs) {
	if (!this._relatedItemsLoaded) {
		this._loadRelatedItems();
	}
	
	if (this._relatedItems.length == 0) {
		return [];
	}
	
	// Return itemIDs
	if (asIDs) {
		var ids = [];
		for each(var item in this._relatedItems) {
			ids.push(item.id);
		}
		return ids;
	}
	
	// Return Zotero.Item objects
	var objs = [];
	for each(var item in this._relatedItems) {
		objs.push(item);
	}
	return objs;
}


/**
 * Returns related items that point to this item
 *
 * @return	array						Array of itemIDs
 */
Zotero.Item.prototype._getRelatedItemsReverse = function () {
	if (!this.id) {
		return [];
	}
	
	var sql = "SELECT itemID FROM itemSeeAlso WHERE linkedItemID=?";
	var ids = Zotero.DB.columnQuery(sql, this.id);
	if (!ids) {
		return [];
	}
	return ids;
}


/**
 * Returns related items this item points to and that point to this item
 *
 * @return array		Array of itemIDs
 */
Zotero.Item.prototype._getRelatedItemsBidirectional = function () {
	var related = this._getRelatedItems(true);
	var reverse = this._getRelatedItemsReverse();
	
	if (reverse.length) {
		if (!related.length) {
			return reverse;
		}
		
		for each(var id in reverse) {
			if (related.indexOf(id) == -1) {
				related.push(id);
			}
		}
	}
	else if (!related) {
		return [];
	}
	return related;
}


Zotero.Item.prototype._setRelatedItems = function (itemIDs) {
	if (!this._relatedItemsLoaded) {
		this._loadRelatedItems();
	}
	
	if (itemIDs.constructor.name != 'Array') {
		throw ('ids must be an array in Zotero.Items._setRelatedItems()');
	}
	
	var currentIDs = this._getRelatedItems(true);
	var oldIDs = []; // children being kept
	var newIDs = []; // new children
	
	if (itemIDs.length == 0) {
		if (currentIDs.length == 0) {
			Zotero.debug('No related items added', 4);
			return false;
		}
	}
	else {
		for (var i in itemIDs) {
			var id = itemIDs[i];
			var parsedInt = parseInt(id);
			if (parsedInt != id) {
				throw ("itemID '" + id + "' not an integer in Zotero.Item.addRelatedItem()");
			}
			id = parsedInt;
			
			if (id == this.id) {
				Zotero.debug("Can't relate item to itself in Zotero.Item._setRelatedItems()", 2);
				continue;
			}
			
			if (currentIDs.indexOf(id) != -1) {
				Zotero.debug("Item " + this.id + " is already related to item " + id);
				oldIDs.push(id);
				continue;
			}
			
			var item = Zotero.Items.get(id);
			if (!item) {
				throw ("Can't relate item to invalid item " + id
					+ " in Zotero.Item._setRelatedItems()");
			}
			/*
			var otherCurrent = item.relatedItems;
			if (otherCurrent.length && otherCurrent.indexOf(this.id) != -1) {
				Zotero.debug("Other item " + id + " already related to item "
					+ this.id + " in Zotero.Item._setRelatedItems()");
				return false;
			}
			*/
			
			newIDs.push(id);
		}
	}
	
	// Mark as changed if new or removed ids
	if (newIDs.length > 0 || oldIDs.length != currentIDs.length) {
		this._markFieldChange('related', currentIDs);
		this._changed.relatedItems = true
	}
	else {
		Zotero.debug('Related items not changed in Zotero.Item._setRelatedItems()', 4);
		return false;
	}
	
	newIDs = oldIDs.concat(newIDs);
	this._relatedItems = [];
	for each(var itemID in newIDs) {
		this._relatedItems.push(Zotero.Items.get(itemID));
	}
	return true;
}


/**
 * The creator has already been changed in itembox.xml before being passed
 * to setCreator()/removeCreator(), so we have to reach in and get its
 * previousData, and ideally try to detect when this private data structure
 * has changed, which it almost certainly will. I am so sorry.
 */
Zotero.Item.prototype._getOldCreators = function () {
	var oldCreators = [];
	for (var i in this._creators) {
		if (this._creators[i].ref._changed) {
			if (!this._creators[i].ref._previousData
					&& !this._creators[i].ref._previousData.fields) {
				Components.utils.reportError("Previous creator data not available in expected form");
				oldCreators.push(false);
				continue;
			}
			var c = this._creators[i].ref._previousData.fields;
		}
		else {
			var c = this._creators[i].ref;
		}
		
		var old = {
			// Convert creatorTypeIDs to text
			creatorType: Zotero.CreatorTypes.getName(
				this._creators[i].creatorTypeID
			)
		};
		
		if (c.fieldMode) {
			// In 'fields' there's just 'name' for single-field mode
			old.name = typeof c.name == 'undefined' ? c.lastName : c.name;
		}
		else {
			old.firstName = c.firstName;
			old.lastName = c.lastName;
		}
		oldCreators.push(old);
	}
	return oldCreators;
}


/**
 * Save old version of data that's being changed, to pass to the notifier
 */
Zotero.Item.prototype._markFieldChange = function (field, oldValue) {
	// Only save if item already exists and field not already changed
	if (!this.id || !this.exists() || typeof this._previousData[field] != 'undefined') {
		return;
	}
	this._previousData[field] = oldValue;
}


Zotero.Item.prototype._clearFieldChange = function (field) {
	delete this._previousData[field];
}


Zotero.Item.prototype._generateKey = function () {
	return Zotero.Utilities.generateObjectKey();
}


Zotero.Item.prototype._disabledCheck = function () {
	if (this._disabled) {
		var msg = "New Zotero.Item objects shouldn't be accessed after save -- use Zotero.Items.get()";
		Zotero.debug(msg, 2);
		Components.utils.reportError(msg);
	}
}
