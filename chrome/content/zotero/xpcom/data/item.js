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


/*
 * Constructor for Item object
 *
 * Generally should be called through Zotero.Items rather than directly
 */
Zotero.Item = function(itemID, itemTypeOrID) {
	if (!this._init) {
		throw ('Zotero.Item() cannot be called statically');
	}
	
	//
	// These members are public so that they can be accessed by public methods
	// -- do not access directly
	//
	
	this._disabled = false;
	this._init();
	
	if (itemID) {
		if (itemID != parseInt(itemID)) {
			throw ("Invalid itemID '" + itemID + "' in Zotero.Item(itemID, itemTypeOrID)");
		}
		this._itemID = parseInt(itemID);
	}
	
	if (itemTypeOrID) {
		// setType initializes type-specific properties in this._itemData
		this.setType(Zotero.ItemTypes.getID(itemTypeOrID));
	}
}

Zotero.Item.prototype._init = function () {
	// Primary fields
	this._itemTypeID = null;
	this._dateAdded = null;
	this._dateModified = null;
	this._key = null;
	this._firstCreator = null;
	this._numNotes = null;
	this._numAttachments = null;
	
	this._creators = [];
	this._itemData = null;
	this._sourceItemID = null;
	
	this._primaryDataLoaded = false;
	this._creatorsLoaded = false;
	this._itemDataLoaded = false;
	this._relatedItemsLoaded = false;
	
	this._changed = false;
	this._changedPrimaryData = false;
	this._changedItemData = false;
	this._changedCreators = false;
	this._changedNote = false;
	this._changedSource = false;
	this._changedAttachmentData = false;
	
	this._previousData = null;
	
	this._noteTitle = null;
	this._noteText = null;
	this._noteAccessTime = null;
	
	this._attachmentLinkMode = null;
	this._attachmentMIMEType = null;
	this._attachmentCharset = null;
	this._attachmentPath = null;
	
	this._relatedItems = false;
}


Zotero.Item.prototype.__defineGetter__('id', function () { return this._itemID; });
Zotero.Item.prototype.__defineGetter__('itemID', function () { return this._itemID; });
Zotero.Item.prototype.__defineGetter__('itemTypeID', function () { return this.getField('itemTypeID'); });
Zotero.Item.prototype.__defineGetter__('dateAdded', function () { return this.getField('dateAdded'); });
Zotero.Item.prototype.__defineGetter__('dateModified', function () { return this.getField('dateModified'); });
Zotero.Item.prototype.__defineGetter__('key', function () { return this.getField('key'); });
Zotero.Item.prototype.__defineGetter__('firstCreator', function () { return this.getField('firstCreator'); });
//Zotero.Item.prototype.__defineGetter__('numNotes', function () { return this._itemID; });
//Zotero.Item.prototype.__defineGetter__('numAttachments', function () { return this._itemID; });

Zotero.Item.prototype.__defineGetter__('relatedItems', function () { var ids = this._getRelatedItems(true); return ids ? ids : []; });
Zotero.Item.prototype.__defineSetter__('relatedItems', function (arr) { this._setRelatedItems(arr); });
Zotero.Item.prototype.__defineGetter__('relatedItemsReverse', function () { var ids = this._getRelatedItemsReverse(); return ids ? ids : []; });
Zotero.Item.prototype.__defineGetter__('relatedItemsBidirectional', function () { var ids = this._getRelatedItemsBidirectional(); return ids ? ids : []; });

/*
 * Deprecated -- use id property
 */
Zotero.Item.prototype.getID = function() {
	Zotero.debug('Item.getID() is deprecated -- use Item.id');
	return this._itemID;
}

Zotero.Item.prototype.getType = function() {
	Zotero.debug('Item.getType() is deprecated -- use Item.itemTypeID');
	return this.getField('itemTypeID');
}


//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Check if the specified field is a primary field from the items table
 */
Zotero.Item.prototype.isPrimaryField = function(field) {
	// Create primaryFields hash array if not yet created
	if (!Zotero.Item.primaryFields) {
		Zotero.Item.primaryFields = Zotero.DB.getColumnHash('items');
		Zotero.Item.primaryFields.firstCreator = true;
		Zotero.Item.primaryFields.numNotes = true;
		Zotero.Item.primaryFields.numAttachments = true;
	}
	
	return !!Zotero.Item.primaryFields[field];
}


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
	this._disabledCheck();
	
	//Zotero.debug('Requesting field ' + field + ' for item ' + this.id, 4);
	if (this.isPrimaryField(field)) {
		var privField = '_' + field;
		if (this.id && !this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
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
	
	if (this.id && this._itemData[fieldID] === null && !this._itemDataLoaded) {
		this._loadItemData();
	}
	
	var value = this._itemData[fieldID] ? this._itemData[fieldID] : '';
	
	if (!unformatted) {
		// Multipart date fields
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date')) {
			value = Zotero.Date.multipartToStr(value);
		}
	}
	//Zotero.debug('Returning ' + value);
	return value;
}


Zotero.Item.prototype.getUsedFields = function(asNames) {
	var sql = "SELECT fieldID FROM itemData WHERE itemID=?";
	if (asNames) {
		sql = "SELECT fieldName FROM fields WHERE fieldID IN (" + sql + ")";
	}
	return Zotero.DB.columnQuery(sql, this.id);
}



/*
 * Build object from database
 */
Zotero.Item.prototype.loadPrimaryData = function(allowFail) {
	if (!this.id) {
		throw ('ID not set in Zotero.Item.loadPrimaryData()');
	}
	
	var columns = [], join = [], where = [];
	for (var field in Zotero.Item.primaryFields) {
		var colSQL = null, joinSQL = null, whereSQL = null;
		// If field not already set
		if (this['_' + field] === null) {
			// Parts should be the same as query in Zotero.Items._load, just
			// without itemID clause
			switch (field) {
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
					colSQL = '(SELECT COUNT(*) FROM itemNotes '
						+ 'WHERE sourceItemID=I.itemID) AS numNotes';
					break;
					
				case 'numAttachments':
					colSQL = '(SELECT COUNT(*) FROM itemAttachments '
						+ 'WHERE sourceItemID=I.itemID) AS numAttachments';
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
	
	var sql = 'SELECT I.itemID' + (columns.length ? ', ' + columns.join(', ') : '')
		+ " FROM items I " + (join.length ? join.join(' ') + ' ' : '')
		+ "WHERE I.itemID=?" + (where.length ? ' AND ' + where.join(' AND ') : '');
	var row = Zotero.DB.rowQuery(sql, this.id);
	
	if (!row) {
		if (allowFail) {
			this._primaryDataLoaded = true;
			return false;
		}
		throw ("Item " + this.id + " not found in Zotero.Item.loadPrimaryData()");
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
	
	// If necessary or reloading, set the type, initialize this._itemData,
	// and reset _itemDataLoaded
	if (reload || (!this._itemTypeID && row.itemTypeID)) {
		this.setType(row.itemTypeID, true);
	}
	
	for (var col in row) {
		// Only accept primary field data through loadFromRow()
		if (this.isPrimaryField(col)) {
			//Zotero.debug("Setting field '" + col + "' to '" + row[col] + "' for item " + this.id);
			this['_' + col] = row[col] ? row[col] : '';
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
	return !!(this._changed
		|| this._changedPrimaryData
		|| this._changedCreators
		|| this._changedItemData
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
	
	// If there's an existing type
	if (this._itemTypeID) {
		if (loadIn) {
			throw ('Cannot change type in loadIn mode in Zotero.Item.setType()');
		}
		
		if (this.id && !this._itemDataLoaded) {
			this._loadItemData();
		}
		
		var copiedFields = [];
		
		var obsoleteFields = this.getFieldsNotInType(itemTypeID);
		if (obsoleteFields) {
			for each(var oldFieldID in obsoleteFields) {
				// Try to get a base type for this field
				var baseFieldID =
					Zotero.ItemFields.getBaseIDFromTypeAndField(this.itemTypeID, oldFieldID);
				
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
		
		for (var fieldID in this._itemData) {
			if (this._itemData[fieldID] &&
					(!obsoleteFields || obsoleteFields.indexOf(fieldID) == -1)) {
				copiedFields.push([fieldID, this.getField(fieldID)]);
			}
		}
		
		// And reset custom creator types to the default
		var creators = this.getCreators();
		if (creators) {
			for (var i in creators) {
				if (!Zotero.CreatorTypes.isValidForItemType(creators[i].creatorTypeID, itemTypeID)) {
					// Convert existing primary creator type to new item type's
					// primary creator type, or contributor (creatorTypeID 2)
					// if none or not currently primary
					var oldPrimary = Zotero.CreatorTypes.getPrimaryIDForType(this.getType());
					if (oldPrimary == creators[i].creatorTypeID) {
						var newPrimary = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
					}
					var target = newPrimary ? newPrimary : 2;
					
					// Reset to contributor (creatorTypeID 2), which exists in all
					this.setCreator(i, creators[i].firstName,
						creators[i].lastName, target, creators[i].fieldMode);				}
			}
		}
	}
	
	this._itemTypeID = itemTypeID;
	
	// Initialize this._itemData with type-specific fields
	this._itemData = {};
	var fields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
	for each(var fieldID in fields) {
		this._itemData[fieldID] = null;
	}
	
	// DEBUG: clear change item data?
	
	if (copiedFields) {
		for each(var f in copiedFields) {
			this.setField(f[0], f[1]);
		}
	}
	
	if (loadIn) {
		this._itemDataLoaded = false;
	}
	else {
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
	return Zotero.DB.columnQuery("SELECT collectionID FROM collectionItems "
		+ "WHERE itemID=" + this.id);
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
	this._disabledCheck();
	
	//Zotero.debug("Setting field '" + field + "' to '" + value + "' (loadIn: " + (loadIn ? 'true' : 'false') + ")");
	
	if (!field) {
		throw ("Field not specified in Item.setField()");
	}
	
	// Primary field
	if (this.isPrimaryField(field)) {
		switch (field) {
			//case 'itemID': // necessary for id changes during sync
			case 'firstCreator':
			case 'numNotes':
			case 'numAttachments':
				throw ('Primary field ' + field + ' cannot be changed through setField()');
		}
		
		if (this.id) {
			if (!this._primaryDataLoaded) {
				this.loadPrimaryData(true);
			}
		}
		else {
			this._primaryDataLoaded = true;
		}
		
		/*
		if (!Zotero.ItemFields.validate(field, value)) {
			throw("Value '" + value + "' of type " + typeof value + " does not validate for field '" + field + "' in Zotero.Item.setField()");
		}
		*/
		
		if (loadIn) {
			// allowed?
			throw('Cannot set primary field through setField() in loadIn mode');
		}
		
		// If field value has changed
		// dateModified is always marked as changed
		if (this['_' + field] != value || field == 'dateModified') {
			Zotero.debug("Field '" + field + "' has changed from '" + this['_' + field] + "' to '" + value + "'", 4);
			
			// Save a copy of the object before modifying
			if (this.id && this.exists() && !this._previousData) {
				this._previousData = this.serialize();
			}
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
	
	if (!Zotero.ItemFields.isValidForType(fieldID, this.itemTypeID)) {
		var msg = '"' + field + "' is not a valid field for type " + this.itemTypeID;
		
		if (loadIn) {
			Zotero.debug(msg + " -- ignoring value '" + value + "'", 2);
			return false;
		}
		else {
			throw (msg);
		}
	}
	
	if (!loadIn) {
		// Save date field as multipart date
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') &&
				!Zotero.Date.isMultipart(value)) {
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
		if ((!this._itemData[fieldID] && !value) ||
				(this._itemData[fieldID] && this._itemData[fieldID]==value)) {
			return false;
		}
		
		// Save a copy of the object before modifying
		if (this.id && this.exists() && !this._previousData) {
			this._previousData = this.serialize();
		}
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
			strParts.push(Zotero.getString('itemTypes.' + itemTypeName));
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
	
	return title;
}


/*
 * Returns the number of creators for this item
 */
Zotero.Item.prototype.numCreators = function() {
	if (this.id && !this._creatorsLoaded) {
		this._loadCreators();
	}
	return this._creators.length;
}


Zotero.Item.prototype.hasCreatorAt = function(pos) {
	if (this.id && !this._creatorsLoaded) {
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
	if (this.id && !this._creatorsLoaded) {
		this._loadCreators();
	}
	
	return this._creators[pos] ? this._creators[pos] : false;
}


/**
 * Return the position of the given creator, or FALSE if not found
 */
Zotero.Item.prototype.getCreatorPosition = function(creatorID) {
	if (this.id && !this._creatorsLoaded) {
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
	if (this.id && !this._creatorsLoaded) {
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
	
	// If creator at this position hasn't changed, cancel
	if (this._creators[orderIndex] &&
			this._creators[orderIndex].ref.id == creator.id &&
			this._creators[orderIndex].creatorTypeID == creatorTypeID &&
			!creator.hasChanged()) {
		Zotero.debug("Creator in position " + orderIndex + " hasn't changed", 4);
		return false;
	}
	
	this._creators[orderIndex] = {
		ref: creator,
		creatorTypeID: creatorTypeID
	};
	
	if (!this._changedCreators) {
		this._changedCreators = {};
	}
	this._changedCreators[orderIndex] = true;
	return true;
}


/*
 * Remove a creator and shift others down
 */
Zotero.Item.prototype.removeCreator = function(orderIndex) {
	if (this.id && !this._creatorsLoaded) {
		this._loadCreators();
	}
	
	if (!this._creators[orderIndex]) {
		throw ('No creator exists at position ' + orderIndex
			+ ' in Zotero.Item.removeCreator()');
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
		
		if (!this._changedCreators) {
			this._changedCreators = {};
		}
		this._changedCreators[i] = true;
	}
	return true;
}


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
	if (current && current.indexOf(itemID) != -1) {
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
	
	this._prepFieldChange('relatedItems');
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
	if (current) {
		var index = current.indexOf(itemID);
	}
	
	if (!current || index == -1) {
		Zotero.debug("Item " + this.id + " isn't related to item "
			+ itemID + " in Zotero.Item.removeRelatedItem()");
		return false;
	}
	
	this._prepFieldChange('relatedItems');
	this._relatedItems.splice(index, 1);
	return true;
}


/*
 * Save changes back to database
 *
 * Returns true on item update or itemID of new item
 */
Zotero.Item.prototype.save = function() {
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
	
	var ZU = new Zotero.Utilities;
	
	Zotero.DB.beginTransaction();
	
	// ID change
	if (this._changedPrimaryData && this._changedPrimaryData.itemID) {
		// Foreign key constraints, how lovely you would be
		var oldID = this._previousData.primary.itemID;
		var params = [this.id, oldID];
		
		Zotero.debug("Changing itemID " + oldID + " to " + this.id);
		
		var row = Zotero.DB.rowQuery("SELECT * FROM items WHERE itemID=?", oldID);
		// Add a new row so we can update the old rows despite FK checks
		// Use temp key due to UNIQUE constraint on key column
		Zotero.DB.query("INSERT INTO items VALUES (?, ?, ?, ?, ?)",
			[this.id, row.itemTypeID, row.dateAdded, row.dateModified, 'TEMPKEY']);
		
		Zotero.DB.query("UPDATE collectionItems SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemCreators SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemAttachments SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemAttachments SET sourceItemID=? WHERE sourceItemID=?", params);
		Zotero.DB.query("UPDATE itemData SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemNotes SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemNotes SET sourceItemID=? WHERE sourceItemID=?", params);
		Zotero.DB.query("UPDATE itemSeeAlso SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE itemSeeAlso SET linkedItemID=? WHERE linkedItemID=?", params);
		Zotero.DB.query("UPDATE itemTags SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE fulltextItemWords SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE fulltextItems SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE annotations SET itemID=? WHERE itemID=?", params);
		Zotero.DB.query("UPDATE highlights SET itemID=? WHERE itemID=?", params);
		
		Zotero.DB.query("DELETE FROM items WHERE itemID=?", oldID);
		Zotero.DB.query("UPDATE items SET key=? WHERE itemID=?", [row.key, this.id]);
		
		Zotero.Items.unload(oldID);
		Zotero.Notifier.trigger('id-change', 'item', oldID + '-' + this.id);
		
		// update caches
	}
	
	
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
			
			sqlColumns.push('itemTypeID', 'key');
			sqlValues.push({ int: this.getField('itemTypeID') }, key);
			
			if (this.dateAdded) {
				sqlColumns.push('dateAdded');
				sqlValues.push(this.dateAdded);
			}
			
			if (this.dateModified) {
				sqlColumns.push('dateModified');
				sqlValues.push(this.dateModified);
			}
			
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
			var insertID = Zotero.DB.query(sql, sqlValues);
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
						value =  Zotero.DB.transactionDateTime;
					}
					
					var dataType = ZU.getSQLDataType(value);
					
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
			
			
			// Note
			if (this.isNote() || this._changedNote) {
				sql = "INSERT INTO itemNotes "
						+ "(itemID, sourceItemID, note, title) VALUES (?,?,?,?)";
				var parent = this.isNote() ? this.getSource() : null;
				var bindParams = [
					itemID,
					parent ? parent : null,
					this._noteText ? this._noteText : '',
					this._noteTitle ? this._noteTitle : ''
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			
			// Attachment
			if (this.isAttachment()) {
				var sql = "INSERT INTO itemAttachments (itemID, sourceItemID, linkMode, "
					+ "mimeType, charsetID, path) VALUES (?,?,?,?,?,?)";
				var parent = this.getSource();
				var linkMode = this.attachmentLinkMode;
				switch (linkMode) {
					case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
					case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
					case Zotero.Attachments.LINK_MODE_LINKED_FILE:
					case Zotero.Attachments.LINK_MODE_LINKED_URL:
						break;
						
					default:
						throw ("Invalid attachment link mode " + linkMode + " in Zotero.Item.save()");
				}
				var mimeType = this.attachmentMIMEType;
				var charsetID = this.attachmentCharset;
				var path = this.attachmentPath;
				
				var bindParams = [
					itemID,
					parent ? parent : null,
					{ int: linkMode },
					mimeType ? { string: mimeType } : null,
					charsetID ? { int: charsetID } : null,
					path ? { string: path } : null
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			
			// Parent item
			if (this._sourceItemID) {
				var newSourceItem = Zotero.Items.get(this._sourceItemID);
				if (!newSourceItem) {
					// TODO: clear caches?
					throw ("Cannot set source to invalid item " + this._sourceItemID);
				}
				
				var newSourceItemNotifierData = {};
				newSourceItemNotifierData[newSourceItem.id] =
					{ old: newSourceItem.serialize() };
				
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
				if (!currentIDs) {
					currentIDs = [];
				}
				
				if (this._previousData && this._previousData.related) {
					for each(var id in this._previousData.related) {
						if (currentIDs.indexOf(id) == -1) {
							removed.push(id);
						}
					}
				}
				for each(var id in currentIDs) {
					if (this._previousData && this._previousData.related &&
							this._previousData.related.indexOf(id) != -1) {
						continue;
					}
					newids.push(id);
				}
				
				if (removed.length) {
					var sql = "DELETE FROM itemSeeAlso WHERE itemID=? "
						+ "AND linkedItemID IN ("
						+ removed.map(function () '?').join()
						+ ")";
					Zotero.DB.query(sql, [itemID].concat(removed));
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
			
			var updateFields = ['itemTypeID', 'key', 'dateAdded', 'dateModified'];
			for each(field in updateFields) {
				if (this._changedPrimaryData && this._changedPrimaryData[field]) {
					sql += field + '=?, ';
					sqlValues.push(this.getField(field));
				}
				else if (field == 'dateModified') {
					sql += field + '=?, ';
					sqlValues.push(Zotero.DB.transactionDateTime);
				}
			}
			
			sql = sql.substr(0, sql.length-2) + " WHERE itemID=?";
			sqlValues.push({ int: this.id });
			
			Zotero.DB.query(sql, sqlValues);
			
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
					
					var dataType = ZU.getSQLDataType(value);
					
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
			
			
			// Note
			if (this._changedNote) {
				if (this._noteText === null || this._noteTitle === null) {
					throw ('Cached note values not set with this._changedNote '
						+ ' set to true in Item.save()');
				}
				
				sql = "REPLACE INTO itemNotes "
						+ "(itemID, sourceItemID, note, title) VALUES (?,?,?,?)";
				var parent = this.isNote() ? this.getSource() : null;
				var bindParams = [
					this.id,
					parent ? parent : null,
					this._noteText,
					this._noteTitle
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			
			// Attachment
			if (this._changedAttachmentData) {
				var sql = "REPLACE INTO itemAttachments (itemID, sourceItemID, linkMode, "
					+ "mimeType, charsetID, path) VALUES (?,?,?,?,?,?)";
				var parent = this.getSource();
				var linkMode = this.attachmentLinkMode;
				var mimeType = this.attachmentMIMEType;
				var charsetID = this.attachmentCharset;
				var path = this.attachmentPath;
				
				var bindParams = [
					this.id,
					parent ? parent : null,
					{ int: linkMode },
					mimeType ? { string: mimeType } : null,
					charsetID ? { int: charsetID } : null,
					path ? { string: path } : null
				];
				Zotero.DB.query(sql, bindParams);
			}
			
			
			// Parent
			if (this._changedSource) {
				var type = Zotero.ItemTypes.getName(this.itemTypeID);
				var Type = type[0].toUpperCase() + type.substr(1);
				
				if (this._sourceItemID) {
					var newSourceItem = Zotero.Items.get(this._sourceItemID);
					if (!newSourceItem) {
						// TODO: clear caches
						throw ("Cannot set source to invalid item " + this._sourceItemID);
					}
				}
				
				if (newSourceItem) {
					var newSourceItemNotifierData = {};
					newSourceItemNotifierData[this._sourceItemID] =
						{ old: newSourceItem.serialize() };
				}
				
				if (this._previousData) {
					var oldSourceItemID = this._previousData.sourceItemID;
					if (oldSourceItemID) {
						var oldSourceItem = Zotero.Items.get(oldSourceItemID);
					}
					if (oldSourceItem) {
						var oldSourceItemNotifierData = {};
						oldSourceItemNotifierData[oldSourceItemID] =
							{ old: oldSourceItem.serialize() };
					}
					else if (oldSourceItemID) {
						var oldSourceItemNotifierData = null;
						Zotero.debug("Old source item " + oldSourceItemID
							+ " didn't exist in setSource()", 2);
					}
				}
				
				
				// If this was an independent item, remove from any collections
				// where it existed previously and add source instead if
				// there is one
				if (!oldSourceItemID) {
					var sql = "SELECT collectionID FROM collectionItems "
						+ "WHERE itemID=?";
					var changedCollections = Zotero.DB.columnQuery(sql, this.id);
					if (changedCollections) {
						if (this._sourceItemID) {
							sql = "UPDATE OR REPLACE collectionItems "
								+ "SET itemID=? WHERE itemID=?";
							Zotero.DB.query(sql, [this._sourceItemID, this.id]);
						}
						else {
							sql = "DELETE FROM collectionItems WHERE itemID=?";
							Zotero.DB.query(sql, this.id);
						}
					}
					
					// TODO: collection notifier trigger?
				}
				
				// Update DB, if not a note or attachment we already changed above
				if (!this._changedAttachmentData &&
						(!this._changedNote || !this.isNote())) {
					var sql = "UPDATE item" + Type + "s SET sourceItemID=? "
						+ "WHERE itemID=?";
					var bindParams = [
						this._sourceItemID ? { int: this._sourceItemID } : null,
						this.id
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
				if (!currentIDs) {
					currentIDs = [];
				}
				
				if (this._previousData && this._previousData.related) {
					for each(var id in this._previousData.related) {
						if (currentIDs.indexOf(id) == -1) {
							removed.push(id);
						}
					}
				}
				for each(var id in currentIDs) {
					if (this._previousData && this._previousData.related &&
							this._previousData.related.indexOf(id) != -1) {
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
		
		//Zotero.History.commit();
		Zotero.DB.commitTransaction();
	}
	
	catch (e) {
		//Zotero.History.cancel();
		Zotero.DB.rollbackTransaction();
		throw(e);
	}
	
	if (!this.id) {
		this._itemID = itemID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	Zotero.Items.reload(this.id);
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'item', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'item', this.id, { old: this._previousData });
	}
	
	if (oldSourceItem) {
		Zotero.Notifier.trigger('modify', 'item',
			oldSourceItemID, oldSourceItemNotifierData);
	}
	if (newSourceItem) {
		Zotero.Notifier.trigger('modify', 'item',
			this._sourceItemID, newSourceItemNotifierData);
	}
	
	if (isNew) {
		var id = this.id;
		this._disabled = true;
		return id;
	}
	
	return true;
}


Zotero.Item.prototype.updateDateModified = function() {
	var sql = "UPDATE items SET dateModified=? WHERE itemID=?";
	Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, this.id]);
	sql = "SELECT dateModified FROM items WHERE itemID=?";
	this._dateModified = Zotero.DB.valueQuery(sql, this.id);
}


Zotero.Item.prototype.isRegularItem = function() {
	return !(this.isNote() || this.isAttachment());
}


Zotero.Item.prototype.numChildren = function() {
	return this.numNotes() + this.numAttachments();
}


/**
* Get the itemID of the source item for a note or file
**/
Zotero.Item.prototype.getSource = function() {
	if (this._sourceItemID !== null) {
		return this._sourceItemID;
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
		sourceItemID = null;
	}
	this._sourceItemID = sourceItemID;
	return sourceItemID;
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
	
	if (this._sourceItemID == sourceItemID) {
		Zotero.debug("Source item has not changed in Zotero.Item.setSource()");
		return false;
	}
	
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
	
	this._sourceItemID = sourceItemID;
	this._changedSource = true;
	
	return true;
}


////////////////////////////////////////////////////////
//
// Methods dealing with note items
//
////////////////////////////////////////////////////////
Zotero.Item.prototype.incrementNoteCount = function() {
	this._numNotes++;
}


Zotero.Item.prototype.decrementNoteCount = function() {
	this._numNotes--;
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
* Returns number of notes in item
**/
Zotero.Item.prototype.numNotes = function() {
	if (this.isNote()) {
		throw ("numNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.id) {
		return 0;
	}
	
	return this._numNotes;
}


/**
* Get the first line of the note for display in the items list
**/
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
	
	if (text == this._noteText) {
		Zotero.debug("Note has not changed in Zotero.Item.setNote()");
		return false;
	}
	
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
	
	this._noteText = text;
	this._noteTitle = Zotero.Notes.noteToTitle(text);
	this._changedNote = true;
	
	return true;
}


/**
* Returns an array of note itemIDs for this item
**/
Zotero.Item.prototype.getNotes = function() {
	if (this.isNote()) {
		throw ("getNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.id) {
		return [];
	}
	
	var sql = "SELECT N.itemID, title FROM itemNotes N NATURAL JOIN items "
		+ "WHERE sourceItemID=?";
	
	if (Zotero.Prefs.get('sortNotesChronologically')) {
		sql += " ORDER BY dateAdded";
		return Zotero.DB.columnQuery(sql, this.id);
	}
	
	var notes = Zotero.DB.query(sql, this.id);
	if (!notes) {
		return false;
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
	Zotero.debug('incrementing attachment count from ' + this._numAttachments);
	this._numAttachments++;
}


Zotero.Item.prototype.decrementAttachmentCount = function() {
	Zotero.debug('decrementing attachment count from ' + this._numAttachments);
	this._numAttachments--;
}


/**
* Determine if an item is an attachment
**/
Zotero.Item.prototype.isAttachment = function() {
	return Zotero.ItemTypes.getName(this.itemTypeID) == 'attachment';
}


/**
* Returns number of files in item
**/
Zotero.Item.prototype.numAttachments = function() {
	if (this.isAttachment()) {
		throw ("numAttachments() cannot be called on attachment items");
	}
	
	if (!this.id) {
		return 0;
	}
	
	return this._numAttachments;
}


/**
* Get an nsILocalFile for the attachment, or false if the associated file
* doesn't exist
*
* _row_ is optional itemAttachments row if available to skip query
*
* Note: Always returns false for items with LINK_MODE_LINKED_URL,
* since they have no files -- use getField('url') instead
**/
Zotero.Item.prototype.getFile = function(row, skipExistsCheck) {
	if (!this.isAttachment()) {
		throw ("getFile() can only be called on attachment items");
	}
	
	if (!row) {
		var sql = "SELECT linkMode, path FROM itemAttachments WHERE itemID=?"
		var row = Zotero.DB.rowQuery(sql, this.id);
	}
	
	if (!row) {
		throw ('Attachment data not found for item ' + this.id + ' in getFile()');
	}
	
	// No associated files for linked URLs
	if (row.linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}
	
	if (row.linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			row.linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		try {
			if (row.path.indexOf("storage:") == -1) {
				Zotero.debug("Invalid attachment path '" + row.path + "'");
				throw ('Invalid path');
			}
			// Strip "storage:"
			var path = row.path.substr(8);
			var file = Zotero.Attachments.getStorageDirectory(this.id);
			file.QueryInterface(Components.interfaces.nsILocalFile);
			file.append(path);
			if (!file.exists()) {
				Zotero.debug("Attachment file '" + path + "' not found");
				throw ('File not found');
			}
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
				Zotero.debug('Invalid persistent descriptor');
				return false;
			}
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
				Zotero.debug('Invalid relative descriptor');
				return false;
			}
		}
	}
	
	if (!skipExistsCheck && !file.exists()) {
		return false;
	}
	
	return file;
}


/*
 * Rename file associated with an attachment
 *
 * -1   		Destination file exists -- use _force_ to overwrite
 * -2		Error renaming
 * false		Attachment file not found or other error
 */
Zotero.Item.prototype.renameAttachmentFile = function(newName, overwrite) {
	var file = this.getFile();
	if (!file) {
		return false;
	}
	
	try {
		if (file.leafName == newName) {
			return true;
		}
		
		var dest = file.parent;
		dest.append(newName);
		
		if (overwrite) {
			dest.remove(null);
		}
		else if (dest.exists()) {
			return -1;
		}
		
		file.moveTo(null, newName);
		this.relinkAttachmentFile(file);
		
		return true;
	}
	catch (e) {
		return -2;
	}
}


Zotero.Item.prototype.relinkAttachmentFile = function(file) {
	var linkMode = this.getAttachmentLinkMode();
	
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw('Cannot relink linked URL in Zotero.Items.relinkAttachmentFile()');
	}
	
	var path = Zotero.Attachments.getPath(file, linkMode);
	
	var sql = "UPDATE itemAttachments SET path=? WHERE itemID=?";
	Zotero.DB.query(sql, [path, this.id]);
}



/*
 * Return a file:/// URL path to files and snapshots
 */
Zotero.Item.prototype.getLocalFileURL = function() {
	if (!this.isAttachment) {
		throw ("getLocalFileURL() can only be called on attachment items");
	}
	
	var file = this.getFile();
	
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
			throw ("Invalid attachment link mode '" + val + "' in Zotero.Item.attachmentLinkMode setter");
	}
	
	if (val === this._attachmentLinkMode) {
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
	
	if (val == this._attachmentMIMEType) {
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
	
	if (this._attachmentCharset !== null) {
		return this._attachmentCharset;
	}
	
	var sql = "SELECT charsetID FROM itemAttachments WHERE itemID=?";
	var charset = Zotero.DB.valueQuery(sql, this.id);
	if (!charset) {
		charset = '';
	}
	this._attachmentCharset = charset;
	return charset;
});


Zotero.Item.prototype.__defineSetter__('attachmentCharset', function (val) {
	if (!this.isAttachment()) {
		throw (".attachmentCharset can only be set for attachment items");
	}
	
	if (!val) {
		val = '';
	}
	
	if (val == this._attachmentCharset) {
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
	
	if (this._attachmentPath !== null) {
		return this._attachmentPath;
	}
	
	if (!this.id) {
		return undefined;
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
	
	if (val == this._attachmentPath) {
		return;
	}
	
	if (!this._changedAttachmentData) {
		this._changedAttachmentData = {};
	}
	this._changedAttachmentData.path = true;
	this._attachmentPath = val;
});


/**
* Returns an array of attachment itemIDs that have this item as a source,
* or FALSE if none
**/
Zotero.Item.prototype.getAttachments = function() {
	if (this.isAttachment()) {
		throw ("getAttachments() cannot be called on attachment items");
	}
	
	if (!this.id) {
		return [];
	}
	
	var sql = "SELECT A.itemID, value AS title FROM itemAttachments A "
		+ "NATURAL JOIN items I LEFT JOIN itemData ID "
		+ "ON (fieldID=110 AND A.itemID=ID.itemID) "
		+ "LEFT JOIN itemDataValues IDV "
		+ "ON (ID.valueID=IDV.valueID) "
		+ "WHERE sourceItemID=?";
		
	if (Zotero.Prefs.get('sortAttachmentsChronologically')) {
		sql +=  " ORDER BY dateAdded";
		return Zotero.DB.columnQuery(sql, this.id);
	}
	
	var attachments = Zotero.DB.query(sql, this.id);
	if (!attachments) {
		return false;
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
	return attachmentIDs;
}


/*
 * Returns the itemID of the latest child snapshot of this item with the
 * same URL as the item itself, or false if none
 */
Zotero.Item.prototype.getBestSnapshot = function() {
	if (!this.isRegularItem()) {
		throw ("getBestSnapshot() can only be called on regular items");
	}
	
	if (!this.getField('url')) {
		return false;
	}
	
	var sql = "SELECT IA.itemID FROM itemAttachments IA NATURAL JOIN items I "
		+ "LEFT JOIN itemData ID ON (IA.itemID=ID.itemID AND fieldID=1) "
		+ "NATURAL JOIN ItemDataValues "
		+ "WHERE sourceItemID=? AND linkMode=? AND value=? "
		+ "ORDER BY dateAdded DESC LIMIT 1";
		
	return Zotero.DB.valueQuery(sql, [this.id,
		Zotero.Attachments.LINK_MODE_IMPORTED_URL, {string:this.getField('url')}]);
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
	
	if (!name) {
		Zotero.debug('Not saving empty tag in Item.addTag()', 2);
		return false;
	}
	
	if (!type) {
		type = 0;
	}
	
	Zotero.DB.beginTransaction();
	
	var existingTypes = Zotero.Tags.getTypes(name);
	if (existingTypes) {
		// If existing automatic and adding identical user, remove automatic
		if (type == 0 && existingTypes.indexOf(1) != -1) {
			this.removeTag(Zotero.Tags.getID(name, 1));
		}
		// If existing user and adding automatic, skip
		else if (type == 1 && existingTypes.indexOf(0) != -1) {
			Zotero.debug('Identical user tag already exists -- skipping automatic tag add');
			Zotero.DB.commitTransaction();
			return false;
		}
	}
	
	var tagID = Zotero.Tags.getID(name, type);
	if (!tagID) {
		var tag = new Zotero.Tag;
		tag.name = name;
		tag.type = type;
		var tagID = tag.save();
	}
	
	try {
		var result = this.addTagByID(tagID);
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	return result ? tagID : false;
}


Zotero.Item.prototype.addTags = function (tags, type) {
	Zotero.DB.beginTransaction();
	try {
		for each(var tag in tags) {
			this.addTag(tag, type);
		}
		Zotero.DB.commitTransaction();
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
	
	tag.addItem(this.id);
	tag.save();
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
 * @return	array			Array of Zotero.Tag objects
 */
Zotero.Item.prototype.getTags = function() {
	if (!this.id) {
		return false;
	}
	var sql = "SELECT tagID, name FROM tags WHERE tagID IN "
		+ "(SELECT tagID FROM itemTags WHERE itemID=?)";
	var tags = Zotero.DB.query(sql, this.id);
	if (!tags) {
		return false;
	}
	
	var collation = Zotero.getLocaleCollation();
	tags.sort(function(a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	var tagObjs = [];
	for (var i=0; i<tags.length; i++) {
		var tag = Zotero.Tags.get(tags[i].tagID, true);
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
	Zotero.Notifier.trigger('add', 'item-tag', this.id + '-' + id);
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
 * @param	object	item						Zotero.Item to compare this item to
 * @param	bool		includeMatches			Include all fields, even those that aren't different
 * @param	bool		ignoreOnlyDateModified	If no fields other than dateModified
 *											are different, just return false
 */
Zotero.Item.prototype.diff = function (item, includeMatches, ignoreOnlyDateModified) {
	var thisData = this.serialize();
	var otherData = item.serialize();
	
	var diff = [{}, {}];
	var numDiffs = 0;
	
	var subs = ['primary', 'fields'];
	
	// TODO: base-mapped fields
	for each(var sub in subs) {
		diff[0][sub] = {};
		diff[1][sub] = {};
		for (var field in thisData[sub]) {
			if (!thisData[sub][field] && !otherData[sub][field]) {
				continue;
			}
			
			var changed = !thisData[sub][field] || !otherData[sub][field] ||
					thisData[sub][field] != otherData[sub][field];
			
			if (includeMatches || changed) {
				diff[0][sub][field] = thisData[sub][field] ?
					thisData[sub][field] : '';
				diff[1][sub][field] = otherData[sub][field] ?
					otherData[sub][field] : '';
			}
			
			if (changed) {
				numDiffs++;
			}
		}
		
		// DEBUG: some of this is probably redundant
		for (var field in otherData[sub]) {
			if (diff[0][sub][field] != undefined) {
				continue;
			}
			
			if (!thisData[sub][field] && !otherData[sub][field]) {
				continue;
			}
			
			var changed = !thisData[sub][field] || !otherData[sub][field] ||
					thisData[sub][field] != otherData[sub][field];
			
			if (includeMatches || changed) {
				diff[0][sub][field] = thisData[sub][field] ?
					thisData[sub][field] : '';
				diff[1][sub][field] = otherData[sub][field] ?
					otherData[sub][field] : '';
			}
			
			if (changed) {
				numDiffs++;
			}
		}
	}
	
	diff[0].creators = [];
	diff[1].creators = [];
	// TODO: creators
	
	// TODO: attachments
	
	// TODO: notes
	
	// TODO: tags
	
	// TODO: related
	
	// TODO: annotations
	
	if (numDiffs == 0 ||
			(ignoreOnlyDateModified && numDiffs == 1
				&& diff[0].primary && diff[0].primary.dateModified)) {
		return false;
	}
	
	return diff;
}


/**
 * Returns an unsaved copy of the item
 */
Zotero.Item.prototype.clone = function(includePrimary) {
	if (this.isAttachment()) {
		throw ('Cloning attachment items not supported in Zotero.Item.clone()');
	}
	
	Zotero.debug('Cloning item ' + this.id);
	
	Zotero.DB.beginTransaction();
	
	var obj = this.serialize();
	
	var itemTypeID = this.itemTypeID;
	var newItem = new Zotero.Item(includePrimary ? this.id : false, itemTypeID);
	
	if (includePrimary) {
		for (var field in obj.primary) {
			switch (field) {
				case 'itemID':
				case 'itemType':
					continue;
			}
			newItem.setField(field, obj.primary[field]);
		}
	}
	
	// Note
	if (this.isNote()) {
		newItem.setNote(this.getNote());
		var parent = this.getSource();
		if (parent) {
			newItem.setSource(parent);
		}
	}
	// Regular item
	else {
		for (var field in obj.fields) {
			var fieldID = Zotero.ItemFields.getID(field);
			if (fieldID && Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
				newItem.setField(field, obj.fields[field]);
			}
		}
		
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
			var i = 0;
			for (var c in obj.creators) {
				newItem.setCreator(i, this.getCreator(c).ref, c.creatorType);
				i++;
			}
		}
	}
	
	if (obj.tags) {
		for each(var tag in obj.tags) {
			newItem.addTagByID(tag.id);
		}
	}
	
	if (obj.related) {
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
**/
Zotero.Item.prototype.erase = function(deleteChildren) {
	if (!this.id) {
		return false;
	}
	
	Zotero.debug('Deleting item ' + this.id);
	
	var changedItems = [];
	var changedItemsNotifierData = {};
	
	Zotero.DB.beginTransaction();
	
	var deletedItemNotifierData = {};
	deletedItemNotifierData[this.id] = { old: this.serialize() };
	
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
			changedItemsNotifierData[sourceItem.id] = { old: sourceItem.serialize() };
			sourceItem.decrementNoteCount();
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
			changedItemsNotifierData[sourceItem.id] = { old: sourceItem.serialize() };
			sourceItem.decrementAttachmentCount();
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
					var file = Zotero.getStorageDirectory();
					file.append(this.id);
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
	else if (deleteChildren) {
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=?1 UNION "
			+ "SELECT itemID FROM itemAttachments WHERE sourceItemID=?1";
		var toDelete = Zotero.DB.columnQuery(sql, [this.id]);
		
		if (toDelete) {
			for (var i in toDelete) {
				var obj = Zotero.Items.get(toDelete[i]);
				obj.erase(true);
			}
		}
	}
	
	// Otherwise just unlink any child notes or files without deleting
	else {
		// Notes
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=" + this.id;
		var childNotes = Zotero.DB.columnQuery(sql);
		if (childNotes) {
			for each(var id in childNotes) {
				var i = Zotero.Items.get(id);
				changedItemsNotifierData[i.id] = { old: i.serialize() };
			}
			changedItems.push(childNotes);
		}
		var sql = "UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID="
			+ this.id;
		Zotero.DB.query(sql);
		
		// Attachments
		var sql = "SELECT itemID FROM itemAttachments WHERE sourceItemID=" + this.id;
		var childAttachments = Zotero.DB.columnQuery(sql);
		if (childAttachments) {
			for each(var id in childAttachments) {
				var i = Zotero.Items.get(id);
				changedItemsNotifierData[i.id] = { old: i.serialize() };
			}
			changedItems.push(childAttachments);
		}
		var sql = "UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID="
			+ this.id;
		Zotero.DB.query(sql);
	}
	
	// Flag related items for notification
	var relateds = this._getRelatedItemsBidirectional();
	if (relateds) {
		for each(var id in relateds) {
			var relatedItem = Zotero.Items.get(id);
			if (changedItems.indexOf(id) != -1) {
				changedItemsNotifierData[id] = { old: relatedItem.serialize() };
				changedItems.push(id);
			}
		}
	}
	
	// Clear fulltext cache
	if (this.isAttachment()) {
		Zotero.Fulltext.clearItemWords(this.id);
		//Zotero.Fulltext.clearItemContent(this.id);
	}
	
	
	Zotero.DB.query('DELETE FROM itemCreators WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemNotes WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemAttachments WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemSeeAlso WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemSeeAlso WHERE linkedItemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemTags WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM itemData WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM items WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM annotations WHERE itemID=?', this.id);
	Zotero.DB.query('DELETE FROM highlights WHERE itemID=?', this.id);
	
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
}


Zotero.Item.prototype.isCollection = function() {
	return false;
}


Zotero.Item.prototype.toArray = function (mode) {
	Zotero.debug('Zotero.Item.toArray() is deprecated -- use Zotero.Item.serialize()');
	
	if (this.id) {
		if (!this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
		if (!this._itemDataLoaded) {
			this._loadItemData();
		}
	}
	
	var arr = {};
	
	// Primary fields
	for (var i in Zotero.Item.primaryFields) {
		switch (i) {
			case 'itemTypeID':
				arr.itemType = Zotero.ItemTypes.getName(this.itemTypeID);
				continue;
			
			// Skip virtual fields
			case 'firstCreator':
			case 'numNotes':
			case 'numAttachments':
				continue;
			
			// For the rest, just copy over
			default:
				arr[i] = this['_' + i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData) {
		arr[Zotero.ItemFields.getName(i)] = this._itemData[i] ? this._itemData[i] + '': '';
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
		var parent = this.getSource();
		if (parent) {
			arr.sourceItemID = parent;
		}
	}
	
	// Attachments
	if (this.isAttachment()) {
		// Attachments can have embedded notes
		arr.note = this.getNote();
		
		var parent = this.getSource();
		if (parent) {
			arr.sourceItemID = parent;
		}
	}
	
	// Attach children of regular items
	if (this.isRegularItem()) {
		// Append attached notes
		arr.notes = [];
		var notes = this.getNotes();
		for (var i in notes) {
			var note = Zotero.Items.get(notes[i]);
			arr.notes.push(note.serialize());
		}
		
		arr.attachments = [];
		var attachments = this.getAttachments();
		for (var i in attachments) {
			var attachment = Zotero.Items.get(attachments[i]);
			arr.attachments.push(attachment.serialize());
		}
	}
	
	arr.tags = [];
	var tags = this.getTags();
	if (tags) {
		for (var i=0; i<tags.length; i++) {
			arr.tags.push(tags[i].serialize());
		}
	}
	
	arr.related = this._getRelatedItemsBidirectional();
	if (!arr.related) {
		arr.related = [];
	}
	
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
	if (this.id) {
		if (!this._primaryDataLoaded) {
			this.loadPrimaryData(true);
		}
		if (!this._itemDataLoaded) {
			this._loadItemData();
		}
	}
	
	var arr = {};
	arr.primary = {};
	arr.virtual = {};
	arr.fields = {};
	
	// Primary and virtual fields
	for (var i in Zotero.Item.primaryFields) {
		switch (i) {
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
			
			// For the rest, just copy over
			default:
				arr.primary[i] = this['_' + i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData) {
		arr.fields[Zotero.ItemFields.getName(i)] = this._itemData[i] ? this._itemData[i] + '' : '';
	}
	
	if (mode == 1 || mode == 2) {
		if (!arr.fields.title &&
				(this.itemTypeID == Zotero.ItemTypes.getID('letter') ||
				this.itemTypeID == Zotero.ItemTypes.getID('interview'))) {
			arr.fields.title = this.getDisplayTitle(mode == 2) + '';
		}
	}
	
	
	if (this.isRegularItem()) {
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
			var file = this.getFile();
			arr.attachment.mimeType = this.attachmentMIMEType;
			var charsetID = this.attachmentCharset;
			arr.attachment.charset = Zotero.CharacterSets.getName(charsetID);
			arr.attachment.path = file ?
				Zotero.Attachments.getPath(file, arr.attachment.linkMode) : '';
		}
		
		arr.note = this.getNote();
		var parent = this.getSource();
		if (parent) {
			arr.sourceItemID = parent;
		}
	}
	
	arr.tags = [];
	var tags = this.getTags();
	if (tags) {
		for (var i=0; i<tags.length; i++) {
			arr.tags.push(tags[i].serialize());
		}
	}
	
	var related = this._getRelatedItems(true);
	var reverse = this._getRelatedItemsReverse();
	arr.related = related ? related : [];
	arr.relatedReverse = reverse ? reverse : [];
	
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
		this._creators[creators[i].orderIndex] = {
			ref: new Zotero.Creator(creators[i].creatorID),
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
 * @return	array					Array of itemIDs, or FALSE if none
 */
Zotero.Item.prototype._getRelatedItems = function (asIDs) {
	if (!this._relatedItemsLoaded) {
		this._loadRelatedItems();
	}
	
	if (this._relatedItems.length == 0) {
		return false;
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
 * @return	array						Array of itemIDs, or FALSE if none
 */
Zotero.Item.prototype._getRelatedItemsReverse = function () {
	if (!this.id) {
		return false;
	}
	
	var sql = "SELECT itemID FROM itemSeeAlso WHERE linkedItemID=?";
	return Zotero.DB.columnQuery(sql, this.id);
}


/**
 * Returns related items this item points to and that point to this item
 *
 * @return array|bool		Array of itemIDs, or false if none
 */
Zotero.Item.prototype._getRelatedItemsBidirectional = function () {
	var related = this._getRelatedItems(true);
	var reverse = this._getRelatedItemsReverse();
	if (reverse) {
		if (!related) {
			return reverse;
		}
		
		for each(var id in reverse) {
			if (related.indexOf(id) == -1) {
				related.push(id);
			}
		}
	}
	else if (!related) {
		return false;
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
	if (!currentIDs) {
		currentIDs = [];
	}
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
		this._prepFieldChange('relatedItems');
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


// TODO: use for stuff other than related items
Zotero.Item.prototype._prepFieldChange = function (field) {
	if (!this._changed) {
		this._changed = {};
	}
	this._changed[field] = true;
	
	// Save a copy of the data before changing
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
}


Zotero.Item.prototype._generateKey = function () {
	return Zotero.ID.getKey();
}


Zotero.Item.prototype._disabledCheck = function () {
	if (this._disabled) {
		var msg = "New Zotero.Item objects shouldn't be accessed after save -- use Zotero.Items.get()";
		Zotero.debug(msg, 2);
		Components.utils.reportError(msg);
	}
}
