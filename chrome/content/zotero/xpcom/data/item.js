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
 */
Zotero.Item = function(itemTypeOrID) {
	if (arguments[1] || arguments[2]) {
		throw ("Zotero.Item constructor only takes one parameter");
	}
	
	Zotero.Item._super.apply(this);
	
	this._disabled = false;
	
	// loadPrimaryData (additional properties in dataObjet.js)
	this._itemTypeID = null;
	this._firstCreator = null;
	this._sortCreator = null;
	this._itemVersion = null;
	this._numNotes = null;
	this._numNotesTrashed = null;
	this._numNotesEmbedded = null;
	this._numNotesEmbeddedTrashed = null;
	this._numAttachments = null;
	this._numAttachmentsTrashed = null;
	this._parentID = null;
	this._parentKey = null;
	this._attachmentCharset = null;
	this._attachmentLinkMode = null;
	this._attachmentContentType = null;
	this._attachmentPath = null;
	this._attachmentSyncState = null;
	
	// loadCreators
	this._creators = [];
	this._creatorIDs = [];
	
	// loadItemData
	this._itemData = null;
	this._noteTitle = null; // also loaded by Items.cacheFields()
	this._noteText = null; // also loaded by Items.cacheFields()
	this._displayTitle = null; // also loaded by Items.cacheFields()
	
	// loadChildItems
	this._attachments = null;
	this._notes = null;
	
	this._tags = {};
	this._collections = {};
	this._relations = {};
	
	this._bestAttachmentState = null;
	this._fileExists = null;
	
	this._deleted = null;
	this._hasNote = null;
	
	this._noteAccessTime = null;
	
	this._relatedItems = false;
	
	if (itemTypeOrID) {
		// setType initializes type-specific properties in this._itemData
		this.setType(Zotero.ItemTypes.getID(itemTypeOrID));
	}
}

Zotero.Item._super = Zotero.DataObject;
Zotero.Item.prototype = Object.create(Zotero.Item._super.prototype);
Zotero.Item.constructor = Zotero.Item;

Zotero.Item.prototype._objectType = 'item';
Zotero.Item.prototype._dataTypes = Zotero.Item._super.prototype._dataTypes.concat([
	'primaryData',
	'itemData',
	'note',
	'creators',
	'childItems',
	'relatedItems', // TODO: remove
	'tags',
	'collections',
	'relations'
]);

Zotero.defineProperty(Zotero.Item.prototype, 'id', {
	get: function() this._id,
	set: function(val) this.setField('id', val)
});
Zotero.defineProperty(Zotero.Item.prototype, 'itemID', {
	get: function() {
		Zotero.debug("Item.itemID is deprecated -- use Item.id");
		return this._id;
	}
});
Zotero.defineProperty(Zotero.Item.prototype, 'libraryID', {
	get: function() this._libraryID,
	set: function(val) this.setField('libraryID', val)
});
Zotero.defineProperty(Zotero.Item.prototype, 'key', {
	get: function() this._key,
	set: function(val) this.setField('key', val)
});
Zotero.defineProperty(Zotero.Item.prototype, 'itemTypeID', {
	get: function() this._itemTypeID
});
Zotero.defineProperty(Zotero.Item.prototype, 'dateAdded', {
	get: function() this._dateAdded
});
Zotero.defineProperty(Zotero.Item.prototype, 'dateModified', {
	get: function() this._dateModified
});
Zotero.defineProperty(Zotero.Item.prototype, 'version', {
	get: function() this._itemVersion,
	set: function(val) this.setField('version', val)
});
Zotero.defineProperty(Zotero.Item.prototype, 'synced', {
	get: function() this._synced,
	set: function(val) this.setField('synced', val)
});

// .parentKey and .parentID defined in dataObject.js, but create aliases
Zotero.defineProperty(Zotero.Item.prototype, 'parentItemID', {
	get: function() this.parentID,
	set: function(val) this.parentID = val
});
Zotero.defineProperty(Zotero.Item.prototype, 'parentItemKey', {
	get: function() this.parentKey,
	set: function(val) this.parentKey = val
});

Zotero.defineProperty(Zotero.Item.prototype, 'firstCreator', {
	get: function() this._firstCreator
});
Zotero.defineProperty(Zotero.Item.prototype, 'sortCreator', {
	get: function() this._sortCreator
});
Zotero.defineProperty(Zotero.Item.prototype, 'relatedItems', {
	get: function() this._getRelatedItems(true),
	set: function(arr) this._setRelatedItems(arr)
});

Zotero.Item.prototype.getID = function() {
	Zotero.debug('Item.getID() is deprecated -- use Item.id');
	return this._id;
}

Zotero.Item.prototype.getType = function() {
	Zotero.debug('Item.getType() is deprecated -- use Item.itemTypeID');
	return this._itemTypeID;
}

Zotero.Item.prototype.isPrimaryField = function (fieldName) {
	Zotero.debug("Zotero.Item.isPrimaryField() is deprecated -- use Zotero.Items.isPrimaryField()");
	return Zotero.Items.isPrimaryField(fieldName);
}

Zotero.Item.prototype._get = function (fieldName) {
	throw new Error("_get is not valid for items");
}

Zotero.Item.prototype._setParentKey = function() {
	if (!this.isNote() && !this.isAttachment()) {
		throw new Error("_setParentKey() can only be called on items of type 'note' or 'attachment'");
	}
	
	Zotero.Item._super.prototype._setParentKey.apply(this, arguments);
}

//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////
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
	
	this._requireData('primaryData');
	
	// TODO: Fix logic and add sortCreator
	if (field === 'firstCreator' && !this._id) {
		// Hack to get a firstCreator for an unsaved item
		var creatorsData = this.getCreators(true);
		if (creators.length === 0) {
			return "";
		} else if (creators.length === 1) {
			return creatorsData[0].lastName;
		} else if (creators.length === 2) {
			return creatorsData[0].lastName + " " + Zotero.getString('general.and') + " " + creatorsData[1].lastName;
		} else if (creators.length > 3) {
			return creatorsData[0].lastName + " " + Zotero.getString('general.etAl');
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
			this._itemTypeID, field
		);
	}
	
	if (!fieldID) {
		var fieldID = Zotero.ItemFields.getID(field);
	}
	
	let value = this._itemData[fieldID];
	
	if (value === undefined) {
		//Zotero.debug("Field '" + field + "' doesn't exist for item type " + this._itemTypeID + " in Item.getField()");
		return '';
	}
	
	// Either item data has to be loaded (which sets empty valid fields to false)
	// or this field has to be populated (e.g., by Zotero.Items.cacheFields())
	// before getField() is called.
	if (value === null) {
		throw new Zotero.Exception.UnloadedDataException(
			"Item data not loaded and field '" + field + "' not set", "itemData"
		);
	}
	
	value = value ? value : '';
	
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
Zotero.Item.prototype.getUsedFields = Zotero.Promise.coroutine(function* (asNames) {
	this._requireData('itemData');
	
	return Object.keys(this._itemData)
		.filter(id => this._itemData[id] !== false)
		.map(id => asNames ? Zotero.ItemFields.getName(id) : parseInt(id));
});



/*
 * Build object from database
 */
Zotero.Item.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload, failOnMissing) {
	if (this._loaded.primaryData && !reload) return;
	
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	
	if (!id && !key) {
		throw new Error('ID or key not set in Zotero.Item.loadPrimaryData()');
	}
	
	var columns = [], join = [], where = [];
	var primaryFields = Zotero.Items.primaryFields;
	for (let i=0; i<primaryFields.length; i++) {
		let field = primaryFields[i];
		// If field not already set
		if (field == 'itemID' || this['_' + field] === null || reload) {
			columns.push(Zotero.Items.getPrimaryDataSQLPart(field));
		}
	}
	if (!columns.length) {
		return;
	}
	// This should match Zotero.Items.getPrimaryDataSQL(), but without
	// necessarily including all columns
	var sql = "SELECT " + columns.join(", ") + Zotero.Items.primaryDataSQLFrom;
	if (id) {
		sql += " AND O.itemID=? ";
		var params = id;
	}
	else {
		sql += " AND O.key=? AND O.libraryID=? ";
		var params = [key, libraryID];
	}
	sql += (where.length ? ' AND ' + where.join(' AND ') : '');
	var row = yield Zotero.DB.rowQueryAsync(sql, params);
	
	if (!row) {
		if (failOnMissing) {
			throw new Error("Item " + (id ? id : libraryID + "/" + key)
				+ " not found in Zotero.Item.loadPrimaryData()");
		}
		this._loaded.primaryData = true;
		this._clearChanged('primaryData');
		return;
	}
	
	this.loadFromRow(row, reload);
	return;
});


/*
 * Populate basic item data from a database row
 */
Zotero.Item.prototype.loadFromRow = function(row, reload) {
	// If necessary or reloading, set the type and reinitialize this._itemData
	if (reload || (!this._itemTypeID && row.itemTypeID)) {
		this.setType(row.itemTypeID, true);
	}
	
	if (false) {
		var primaryFields = Zotero.Items.primaryFields;
		for (let i=0; i<primaryFields.length; i++) {
			if (primaryFields[i] === undefined) {
				Zotero.debug('Skipping missing field ' + primaryFields[i]);
				continue;
			}
		}
		
		if (row.itemID !== undefined) {
			this._id = parseInt(row.itemID);
		}
		if (row.itemTypeID !== undefined) {
			this._id = parseInt(row.itemTypeID);
		}
		if (row.libraryID !== undefined) {
			this._libraryID = parseInt(row.libraryID);
		}
		if (row.key !== undefined) {
			this._key = row.key;
		}
		if (row.dateAdded !== undefined) {
			this._dateAdded = row.dateAdded;
		}
		if (row.dateModified !== undefined) {
			this._dateModified = row.dateModified;
		}
		if (row.itemVersion !== undefined) {
			this._itemVersion = parseInt(row.itemVersion);
		}
		if (row.numNotes !== undefined) {
			this._numNotes = parseInt(row.numNotes);
		}
		if (row.numNotesTrashed !== undefined) {
			this._numNotesTrashed = parseInt(row.numNotesTrashed);
		}
		if (row.numNotesEmbedded !== undefined) {
			this._numNotesEmbedded = parseInt(row.numNotesEmbedded);
		}
		if (row.numNotesEmbeddedTrashed !== undefined) {
			this._numNotesEmbeddedTrashed = parseInt(row.numNotesEmbeddedTrashed);
		}
		if (row.numAttachments !== undefined) {
			this._numAttachments = parseInt(row.numAttachments);
		}
		if (row.numAttachmentsTrashed !== undefined) {
			this._numAttachmentsTrashed = parseInt(row.numAttachmentsTrashed);
		}
		if (row.parentKey !== undefined) {
			this._parentKey = row.parentKey || false;
		}
		if (row.parentID !== undefined) {
			this._parentID = row.parentID ? parseInt(row.parentID) : false;
		}
		if (row.synced !== undefined) {
			this._synced = !!row.synced;
		}
		if (row.firstCreator !== undefined) {
			this._firstCreator = row.firstCreator ? row.firstCreator : '';
		}
		if (row.sortCreator !== undefined) {
			this._sortCreator = row.sortCreator ? row.sortCreator : '';
		}
		if (row.attachmentCharset !== undefined) {
			this._attachmentCharset = row.attachmentCharset ? parseInt(row.attachmentCharset) : null;
		}
		if (row.attachmentLinkMode !== undefined) {
			this._attachmentLinkMode = parseInt(row.attachmentLinkMode);
		}
		if (row.attachmentContentType !== undefined) {
			this._attachmentContentType = row.attachmentContentType ? row.attachmentContentType : '';
		}
		if (row.attachmentPath !== undefined) {
			this._attachmentPath = row.attachmentPath ? row.attachmentPath : '';
		}
		if (row.attachmentSyncState !== undefined) {
			this._attachmentSyncState = parseInt(row.attachmentSyncState);
		}
	}
	else {
		var primaryFields = Zotero.Items.primaryFields;
		for (let i=0; i<primaryFields.length; i++) {
			let col = primaryFields[i];
			
			if (row[col] === undefined) {
				Zotero.debug('Skipping missing field ' + col);
				continue;
			}
			
			let val = row[col];
			
			//Zotero.debug("Setting field '" + col + "' to '" + val + "' for item " + this.id);
			switch (col) {
				case 'itemID':
					this._id = val;
					break;
				
				case 'libraryID':
					this['_' + col] = val;
					break;
				
				case 'itemVersion':
				case 'numNotes':
				case 'numNotesTrashed':
				case 'numNotesEmbedded':
				case 'numNotesEmbeddedTrashed':
				case 'numAttachments':
				case 'numAttachmentsTrashed':
					this['_' + col] = val ? parseInt(val) : 0;
					break;
				
				case 'parentKey':
					this['_parentKey'] = val || false;
					break;
				
				case 'parentID':
				case 'attachmentCharset':
					this['_' + col] = val ? parseInt(val) : false;
					break;
				
				case 'attachmentLinkMode':
					this['_' + col] = val !== null ? parseInt(val) : false;
					break;
				
				case 'synced':
					this['_synced'] = !!val;
					break;
					
				default:
					this['_' + col] = val ? val : '';
			}
		}
	}
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	this._identified = true;
}


/*
 * Set or change the item's type
 */
Zotero.Item.prototype.setType = function(itemTypeID, loadIn) {
	if (itemTypeID == this._itemTypeID) {
		return true;
	}
	
	var oldItemTypeID = this._itemTypeID;
	if (oldItemTypeID) {
		if (loadIn) {
			throw new Error('Cannot change type in loadIn mode');
		}
		
		// Changing the item type can affect fields and creators, so they need to be loaded
		this._requireData('itemData');
		this._requireData('creators');
		
		var copiedFields = [];
		var newNotifierFields = [];
		
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
				if (!this._changed.itemData) {
					this._changed.itemData = {};
				}
				this._changed.itemData[oldFieldID] = true;
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
		let creators = this.getCreators();
		if (creators) {
			let removeAll = !Zotero.CreatorTypes.itemTypeHasCreators(itemTypeID);
			for (let i=0; i<creators.length; i++) {
				// Remove all creators if new item type doesn't have any
				if (removeAll) {
					this.removeCreator(i);
					continue;
				}
				
				if (!Zotero.CreatorTypes.isValidForItemType(creators[i].creatorTypeID, itemTypeID)) {
					// Convert existing primary creator type to new item type's
					// primary creator type, or contributor (creatorTypeID 2)
					// if none or not currently primary
					let oldPrimary = Zotero.CreatorTypes.getPrimaryIDForType(oldItemTypeID);
					let newPrimary = false;
					if (oldPrimary == creators[i].creatorTypeID) {
						newPrimary = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
					}
					creators[i].creatorTypeID = newPrimary ? newPrimary : 2;
					
					this.setCreator(i, creators[i]);
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
		this._loaded['itemData'] = false;
	}
	else {
		if (oldItemTypeID) {
			this._markFieldChange('itemType', Zotero.ItemTypes.getName(oldItemTypeID));
		}
		if (!this._changed.primaryData) {
			this._changed.primaryData = {};
		}
		this._changed.primaryData.itemTypeID = true;
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
		throw new Error("Field not specified");
	}
	
	if (field == 'id' || field == 'libraryID' || field == 'key') {
		return this._setIdentifier(field, value);
	}
	
	// Primary field
	if (Zotero.Items.isPrimaryField(field)) {
		this._requireData('primaryData');
		
		if (loadIn) {
			throw('Cannot set primary field ' + field + ' in loadIn mode in Zotero.Item.setField()');
		}
		
		switch (field) {
			case 'itemTypeID':
			case 'dateAdded':
			case 'dateModified':
			case 'version':
			case 'synced':
				break;
				
			default:
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
				switch (field) {
				case 'version':
					value = parseInt(value);
					break;
				
				case 'synced':
					value = !!value;
					break;
				}
				
				this['_' + field] = value;
				
				if (!this._changed.primaryData) {
					this._changed.primaryData = {};
				}
				this._changed.primaryData[field] = true;
			}
		}
		else {
			Zotero.debug("Field '" + field + "' has not changed", 4);
		}
		return true;
	}
	
	if (!loadIn) {
		this._requireData('itemData');
	}
	
	let itemTypeID = this.itemTypeID;
	if (!itemTypeID) {
		throw ('Item type must be set before setting field data');
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
	
	if (value !== false && !Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
		var msg = "'" + field + "' is not a valid field for type " + itemTypeID;
		
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
				Zotero.debug("Discarding invalid accessDate '" + value + "' in Item.setField()");
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
		if (!this._changed.itemData) {
			this._changed.itemData = {};
		}
		this._changed.itemData[fieldID] = true;
	}
	return true;
}

/*
 * Get the title for an item for display in the interface
 *
 * This is the same as the standard title field (with includeBaseMapped on)
 * except for letters and interviews, which get placeholder titles in
 * square braces (e.g. "[Letter to Thoreau]"), and cases
 */
Zotero.Item.prototype.getDisplayTitle = function (includeAuthorAndDate) {
	if (this._displayTitle !== null) {
		return this._displayTitle;
	}
	return this._displayTitle = this.getField('title', false, true);
}


/*
 * Returns the number of creators for this item
 */
Zotero.Item.prototype.numCreators = function() {
	this._requireData('creators');
	return this._creators.length;
}


Zotero.Item.prototype.hasCreatorAt = function(pos) {
	this._requireData('creators');
	return !!this._creators[pos];
}


/**
 * @param  {Integer} pos
 * @return {Object|Boolean} The internal creator data object at the given position, or FALSE if none
 */
Zotero.Item.prototype.getCreator = function (pos) {
	this._requireData('creators');
	if (!this._creators[pos]) {
		return false;
	}
	var creator = {};
	for (let i in this._creators[pos]) {
		creator[i] = this._creators[pos][i];
	}
	return creator;
}


/**
 * @param  {Integer} pos
 * @return {Object|Boolean} The API JSON creator data at the given position, or FALSE if none
 */
Zotero.Item.prototype.getCreatorJSON = function (pos) {
	this._requireData('creators');
	return this._creators[pos] ? Zotero.Creators.internalToJSON(this._creators[pos]) : false;
}


/**
 * Returns creator data in internal format
 *
 * @return {Array<Object>}  An array of internal creator data objects
 *                          ('firstName', 'lastName', 'fieldMode', 'creatorTypeID')
 */
Zotero.Item.prototype.getCreators = function () {
	this._requireData('creators');
	// Create copies of the creator data objects
	return this._creators.map(function (data) {
		var creator = {};
		for (let i in data) {
			creator[i] = data[i];
		}
		return creator;
	});
}


/**
 * @return {Array<Object>} An array of creator data objects in API JSON format
 *                         ('firstName'/'lastName' or 'name', 'creatorType')
 */
Zotero.Item.prototype.getCreatorsJSON = function () {
	this._requireData('creators');
	return this._creators.map(function (data) Zotero.Creators.internalToJSON(data));
}


/**
 * Set or update the creator at the specified position
 *
 * @param {Integer} orderIndex
 * @param {Object} Creator data in internal or API JSON format:
 *                   <ul>
 *                     <li>'name' or 'firstName'/'lastName', or 'firstName'/'lastName'/'fieldMode'</li>
 *                     <li>'creatorType' (can be name or id) or 'creatorTypeID'</li>
 *                   </ul>
 */
Zotero.Item.prototype.setCreator = function (orderIndex, data) {
	this._requireData('creators');
	
	data = Zotero.Creators.cleanData(data);
	
	if (data.creatorTypeID === undefined) {
		throw new Error("Creator data must include a valid 'creatorType' or 'creatorTypeID' property");
	}
	
	// If creatorTypeID isn't valid for this type, use the primary type
	var itemTypeID = this._itemTypeID;
	if (!data.creatorTypeID || !Zotero.CreatorTypes.isValidForItemType(data.creatorTypeID, itemTypeID)) {
		var msg = "Creator type '" + Zotero.CreatorTypes.getName(data.creatorTypeID) + "' "
			+ "isn't valid for " + Zotero.ItemTypes.getName(itemTypeID)
			+ " -- changing to primary creator";
		Zotero.debug(msg, 2);
		Components.utils.reportError(msg);
		data.creatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
	}
	
	// If creator at this position hasn't changed, cancel
	let previousData = this._creators[orderIndex];
	if (previousData
			&& previousData.creatorTypeID === data.creatorTypeID
			&& previousData.fieldMode === data.fieldMode
			&& previousData.firstName === data.firstName
			&& previousData.lastName === data.lastName) {
		Zotero.debug("Creator in position " + orderIndex + " hasn't changed", 4);
		return false;
	}
	
	// Save copy of old creators for save() and notifier
	if (!this._changed.creators) {
		this._changed.creators = {};
		this._markFieldChange('creators', this._getOldCreators());
	}
	this._changed.creators[orderIndex] = true;
	this._creators[orderIndex] = data;
	return true;
}


/**
 * @param {Object[]} data - An array of creator data in internal or API JSON format
 */
Zotero.Item.prototype.setCreators = function (data) {
	for (let i = 0; i < data.length; i++) {
		this.setCreator(i, data[i]);
	}
}


/*
 * Remove a creator and shift others down
 */
Zotero.Item.prototype.removeCreator = function(orderIndex, allowMissing) {
	var creatorData = this.getCreator(orderIndex);
	if (!creatorData && !allowMissing) {
		throw new Error('No creator exists at position ' + orderIndex);
	}
	
	// Save copy of old creators for notifier
	if (!this._changed.creators) {
		this._changed.creators = {};
		
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
		
		this._changed.creators[i] = true;
	}
	
	return true;
}

Zotero.defineProperty(Zotero.Item.prototype, 'deleted', {
	get: function() {
		if (!this.id) {
			return false;
		}
		if (this._deleted !== null) {
			return this._deleted;
		}
		this._requireData('primaryData');
	},
	set: function(val) {
		var deleted = !!val;
		
		if (this._deleted == deleted) {
			Zotero.debug("Deleted state hasn't changed for item " + this.id);
			return;
		}
		this._markFieldChange('deleted', !!this._deleted);
		this._changed.deleted = true;
		this._deleted = deleted;
	}
});


Zotero.Item.prototype.addRelatedItem = Zotero.Promise.coroutine(function* (itemID) {
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
	
	var item = yield Zotero.Items.getAsync(itemID);
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
});


Zotero.Item.prototype.removeRelatedItem = Zotero.Promise.coroutine(function* (itemID) {
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
});


Zotero.Item.prototype.isEditable = function() {
	var editable = Zotero.Item._super.prototype.isEditable.apply(this);
	if (!editable) return false;
	
	// Check if we're allowed to save attachments
	if (this.isAttachment()
		&& (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
		&& !Zotero.Libraries.isFilesEditable(this.libraryID)
	) {
		return false;
	}
	
	return true;
}

Zotero.Item.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	var isNew = env.isNew;
	var options = env.options;
	
	var itemTypeID = this.itemTypeID;
		
	var sqlColumns = [];
	var sqlValues = [];
	var reloadParentChildItems = {};
	
	//
	// Primary fields
	//
	// If available id value, use it -- otherwise we'll use autoincrement
	var itemID = env.id = this._id = this.id ? this.id : yield Zotero.ID.get('items');
	Zotero.debug('=');
	var libraryID = env.libraryID = this.libraryID;
	var key = env.key = this._key = this.key ? this.key : this._generateKey();
	
	sqlColumns.push(
		'itemTypeID',
		'dateAdded',
		'libraryID',
		'key',
		'version',
		'synced'
	);
	
	sqlValues.push(
		{ int: itemTypeID },
		this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
		this.libraryID ? this.libraryID : 0,
		key,
		this.version ? this.version : 0,
		this.synced ? 1 : 0
	);
	
	if (isNew) {
		sqlColumns.push('dateModified', 'clientDateModified');
		sqlValues.push(Zotero.DB.transactionDateTime, Zotero.DB.transactionDateTime);
	}
	else {
		for each (let field in ['dateModified', 'clientDateModified']) {
			switch (field) {
			case 'dateModified':
			case 'clientDateModified':
				let skipFlag = "skip" + field[0].toUpperCase() + field.substr(1) + "Update";
				if (!options[skipFlag]) {
					sqlColumns.push(field);
					sqlValues.push(Zotero.DB.transactionDateTime);
				}
				break;
			}
		}
	}
	
	if (isNew) {
		sqlColumns.unshift('itemID');
		sqlValues.unshift(parseInt(itemID));
		
		var sql = "INSERT INTO items (" + sqlColumns.join(", ") + ") "
			+ "VALUES (" + sqlValues.map(function () "?").join() + ")";
		var insertID = yield Zotero.DB.queryAsync(sql, sqlValues);
		if (!itemID) {
			itemID = env.id = insertID;
		}
		
		Zotero.Notifier.trigger('add', 'item', itemID);
	}
	else {
		var sql = "UPDATE items SET " + sqlColumns.join("=?, ") + "=? WHERE itemID=?";
		sqlValues.push(parseInt(itemID));
		yield Zotero.DB.queryAsync(sql, sqlValues);
		
		var notifierData = {};
		notifierData[itemID] = { changed: this._previousData };
		Zotero.Notifier.trigger('modify', 'item', itemID, notifierData);
	}
	
	//
	// ItemData
	//
	if (this._changed.itemData) {
		let del = [];
		
		let valueSQL = "SELECT valueID FROM itemDataValues WHERE value=?";
		let insertValueSQL = "INSERT INTO itemDataValues VALUES (?,?)";
		let replaceSQL = "REPLACE INTO itemData VALUES (?,?,?)";
		
		for (let fieldID in this._changed.itemData) {
			fieldID = parseInt(fieldID);
			let value = this.getField(fieldID, true);
			
			// If field changed and is empty, mark row for deletion
			if (!value) {
				del.push(fieldID);
				continue;
			}
			
			if (Zotero.ItemFields.getID('accessDate') == fieldID
					&& (this.getField(fieldID)) == 'CURRENT_TIMESTAMP') {
				value = Zotero.DB.transactionDateTime;
			}
			
			let valueID = yield Zotero.DB.valueQueryAsync(valueSQL, [value], { debug: true })
			if (!valueID) {
				valueID = yield Zotero.ID.get('itemDataValues');
				yield Zotero.DB.queryAsync(insertValueSQL, [valueID, value], { debug: false });
			}
			
			yield Zotero.DB.queryAsync(replaceSQL, [itemID, fieldID, valueID], { debug: false });
		}
		
		// Delete blank fields
		if (del.length) {
			sql = 'DELETE from itemData WHERE itemID=? AND '
				+ 'fieldID IN (' + del.map(function () '?').join() + ')';
			yield Zotero.DB.queryAsync(sql, [itemID].concat(del));
		}
	}
	
	//
	// Creators
	//
	if (this._changed.creators) {
		for (let orderIndex in this._changed.creators) {
			orderIndex = parseInt(orderIndex);
			
			if (isNew) {
				Zotero.debug('Adding creator in position ' + orderIndex, 4);
			}
			else {
				Zotero.debug('Creator ' + orderIndex + ' has changed', 4);
			}
			
			let creatorData = this.getCreator(orderIndex);
			// If no creator in this position, just remove the item-creator association
			if (!creatorData) {
				let sql = "DELETE FROM itemCreators WHERE itemID=? AND orderIndex=?";
				yield Zotero.DB.queryAsync(sql, [itemID, orderIndex]);
				Zotero.Prefs.set('purge.creators', true);
				continue;
			}
			
			let previousCreatorID = this._previousData.creators[orderIndex]
				? this._previousData.creators[orderIndex].id
				: false;
			let newCreatorID = yield Zotero.Creators.getIDFromData(creatorData, true);
			
			// If there was previously a creator at this position and it's different from
			// the new one, the old one might need to be purged.
			if (previousCreatorID && previousCreatorID != newCreatorID) {
				Zotero.Prefs.set('purge.creators', true);
			}
			
			let sql = "INSERT OR REPLACE INTO itemCreators "
				+ "(itemID, creatorID, creatorTypeID, orderIndex) VALUES (?, ?, ?, ?)";
			yield Zotero.DB.queryAsync(
				sql,
				[
					itemID,
					newCreatorID,
					creatorData.creatorTypeID,
					orderIndex
				]
			);
		}
	}
	
	// Parent item
	let parentItem = this.parentKey;
	parentItem = parentItem ? Zotero.Items.getByLibraryAndKey(this.libraryID, parentItem) : null;
	if (this._changed.parentKey) {
		if (isNew) {
			if (!parentItem) {
				// TODO: clear caches?
				let msg = this._parentKey + " is not a valid item key";
				throw new Zotero.Error(msg, "MISSING_OBJECT");
			}
			
			let newParentItemNotifierData = {};
			//newParentItemNotifierData[newParentItem.id] = {};
			Zotero.Notifier.trigger('modify', 'item', parentItem.id, newParentItemNotifierData);
			
			switch (Zotero.ItemTypes.getName(itemTypeID)) {
				case 'note':
				case 'attachment':
					reloadParentChildItems[parentItem.id] = true;
					break;
			}
		}
		else {
			let type = Zotero.ItemTypes.getName(itemTypeID);
			let Type = type[0].toUpperCase() + type.substr(1);
			
			if (this._parentKey) {
				if (!parentItem) {
					// TODO: clear caches
					let msg = "Cannot set source to invalid item " + this._parentKey;
					throw new Zotero.Error(msg, "MISSING_OBJECT");
				}
				
				let newParentItemNotifierData = {};
				//newParentItemNotifierData[newParentItem.id] = {};
				Zotero.Notifier.trigger('modify', 'item', parentItem.id, newParentItemNotifierData);
			}
			
			var oldParentKey = this._previousData.parentKey;
			if (oldParentKey) {
				var oldParentItem = Zotero.Items.getByLibraryAndKey(this.libraryID, oldParentKey);
				if (oldParentItem) {
					let oldParentItemNotifierData = {};
					//oldParentItemNotifierData[oldParentItem.id] = {};
					Zotero.Notifier.trigger('modify', 'item', oldParentItem.id, oldParentItemNotifierData);
				}
				else {
					Zotero.debug("Old source item " + oldParentKey
						+ " didn't exist in Zotero.Item.save()", 2);
				}
			}
			
			// If this was an independent item, remove from any collections
			// where it existed previously and add parent instead
			if (!oldParentKey) {
				let sql = "SELECT collectionID FROM collectionItems WHERE itemID=?";
				let changedCollections = yield Zotero.DB.columnQueryAsync(sql, this.id);
				if (changedCollections) {
					for (let i=0; i<changedCollections.length; i++) {
						yield parentItem.loadCollections();
						parentItem.addToCollection(changedCollections[i]);
						yield this.loadCollections();
						this.removeFromCollection(changedCollections[i]);
						
						Zotero.Notifier.trigger(
							'remove',
							'collection-item',
							changedCollections[i] + '-' + this.id
						);
					}
					parentItem.save({
						skipDateModifiedUpdate: true
					});
				}
			}
			
			// Update DB, if not a note or attachment we're changing below
			if (!this._changed.attachmentData &&
					(!this._changed.note || !this.isNote())) {
				var sql = "UPDATE item" + Type + "s SET parentItemID=? "
							+ "WHERE itemID=?";
				var bindParams = [parentItem ? parentItem.id : null, this.id];
				yield Zotero.DB.queryAsync(sql, bindParams);
			}
			
			// Update the counts of the previous and new sources
			if (oldParentItem) {
				reloadParentChildItems[oldParentItem.id] = true;
			}
			if (parentItem) {
				reloadParentChildItems[parentItem.id] = true;
			}
		}
	}
	
	// Trashed status
	if (this._changed.deleted) {
		if (this.deleted) {
			sql = "REPLACE INTO deletedItems (itemID) VALUES (?)";
		}
		else {
			// If undeleting, remove any merge-tracking relations
			var relations = yield Zotero.Relations.getByURIs(
				Zotero.URI.getItemURI(this),
				Zotero.Relations.deletedItemPredicate,
				false
			);
			for each(let relation in relations) {
				relation.erase();
			}
			
			sql = "DELETE FROM deletedItems WHERE itemID=?";
		}
		yield Zotero.DB.queryAsync(sql, itemID);
		
		// Refresh trash
		Zotero.Notifier.trigger('refresh', 'trash', this.libraryID);
		if (this._deleted) {
			Zotero.Notifier.trigger('trash', 'item', this.id);
		}
		
		if (parentItem) {
			reloadParentChildItems[parentItem.id] = true;
		}
	}
	
	// Note
	if ((isNew && this.isNote()) || this._changed.note) {
		if (!isNew) {
			if (this._noteText === null || this._noteTitle === null) {
				throw new Error("Cached note values not set with "
					+ "this._changed.note set to true");
			}
		}
		
		let parent = this.isNote() ? this.parentID : null;
		let noteText = this._noteText ? this._noteText : '';
		// Add <div> wrapper if not present
		if (!noteText.match(/^<div class="zotero-note znv[0-9]+">[\s\S]*<\/div>$/)) {
			// Keep consistent with getNote()
			noteText = '<div class="zotero-note znv1">' + noteText + '</div>';
		}
		
		let params = [
			parent ? parent : null,
			noteText,
			this._noteTitle ? this._noteTitle : ''
		];
		let sql = "SELECT COUNT(*) FROM itemNotes WHERE itemID=?";
		if (yield Zotero.DB.valueQueryAsync(sql, itemID)) {
			sql = "UPDATE itemNotes SET parentItemID=?, note=?, title=? WHERE itemID=?";
			params.push(itemID);
		}
		else {
			sql = "INSERT INTO itemNotes "
					+ "(itemID, parentItemID, note, title) VALUES (?,?,?,?)";
			params.unshift(itemID);
		}
		yield Zotero.DB.queryAsync(sql, params);
		
		if (parentItem) {
			reloadParentChildItems[parentItem.id] = true;
		}
	}
	
	//
	// Attachment
	//
	if (!isNew) {
		// If attachment title changes, update parent attachments
		if (this._changed.itemData && this._changed.itemData[110] && this.isAttachment() && parentItem) {
			reloadParentChildItems[parentItem.id] = true;
		}
	}
	
	if (this.isAttachment() || this._changed.attachmentData) {
		let sql = "REPLACE INTO itemAttachments (itemID, parentItemID, linkMode, "
			+ "contentType, charsetID, path, syncState) VALUES (?,?,?,?,?,?,?)";
		let parent = this.parentID;
		let linkMode = this.attachmentLinkMode;
		let contentType = this.attachmentContentType;
		let charsetID = Zotero.CharacterSets.getID(this.attachmentCharset);
		let path = this.attachmentPath;
		let syncState = this.attachmentSyncState;
		
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
		
		let params = [
			itemID,
			parent ? parent : null,
			{ int: linkMode },
			contentType ? { string: contentType } : null,
			charsetID ? { int: charsetID } : null,
			path ? { string: path } : null,
			syncState ? { int: syncState } : 0
		];
		yield Zotero.DB.queryAsync(sql, params);
		
		// Clear cached child attachments of the parent
		if (!isNew && parentItem) {
			reloadParentChildItems[parentItem.id] = true;
		}
	}
	
	// Tags
	if (this._changed.tags) {
		let oldTags = this._previousData.tags;
		let newTags = this._tags;
		
		// Convert to individual JSON objects, diff, and convert back
		let oldTagsJSON = oldTags.map(function (x) JSON.stringify(x));
		let newTagsJSON = newTags.map(function (x) JSON.stringify(x));
		let toAdd = Zotero.Utilities.arrayDiff(newTagsJSON, oldTagsJSON)
			.map(function (x) JSON.parse(x));
		let toRemove = Zotero.Utilities.arrayDiff(oldTagsJSON, newTagsJSON)
			.map(function (x) JSON.parse(x));;
		
		for (let i=0; i<toAdd.length; i++) {
			let tag = toAdd[i];
			let tagID = yield Zotero.Tags.getIDFromName(this.libraryID, tag.tag, true);
			// "OR REPLACE" allows changing type
			let sql = "INSERT OR REPLACE INTO itemTags (itemID, tagID, type) VALUES (?, ?, ?)";
			yield Zotero.DB.queryAsync(sql, [this.id, tagID, tag.type ? tag.type : 0]);
			Zotero.Notifier.trigger('add', 'item-tag', this.id + '-' + tag.tag);
		}
		
		if (toRemove.length) {
			yield Zotero.Tags.load(this.libraryID);
			for (let i=0; i<toRemove.length; i++) {
				let tag = toRemove[i];
				let tagID = Zotero.Tags.getID(this.libraryID, tag.tag);
				let sql = "DELETE FROM itemTags WHERE itemID=? AND tagID=? AND type=?";
				yield Zotero.DB.queryAsync(sql, [this.id, tagID, tag.type ? tag.type : 0]);
				Zotero.Notifier.trigger('remove', 'item-tag', this.id + '-' + tag.tag);
			}
			Zotero.Prefs.set('purge.tags', true);
		}
	}
	
	// Collections
	if (this._changed.collections) {
		let oldCollections = this._previousData.collections;
		let newCollections = this._collections;
		
		let toAdd = Zotero.Utilities.arrayDiff(newCollections, oldCollections);
		let toRemove = Zotero.Utilities.arrayDiff(oldCollections, newCollections);
		
		for (let i=0; i<toAdd.length; i++) {
			let collectionID = toAdd[i];
			
			let sql = "SELECT IFNULL(MAX(orderIndex)+1, 0) FROM collectionItems "
				+ "WHERE collectionID=?";
			let orderIndex = yield Zotero.DB.valueQueryAsync(sql, collectionID);
			
			sql = "INSERT OR IGNORE INTO collectionItems "
				+ "(collectionID, itemID, orderIndex) VALUES (?, ?, ?)";
			yield Zotero.DB.queryAsync(sql, [collectionID, this.id, orderIndex]);
			
			Zotero.Collections.refreshChildItems(collectionID);
			Zotero.Notifier.trigger('add', 'collection-item', collectionID + '-' + this.id);
		}
		
		if (toRemove.length) {
			let sql = "DELETE FROM collectionItems WHERE itemID=? AND collectionID IN ("
				+ toRemove.join(',')
				+ ")";
			yield Zotero.DB.queryAsync(sql, this.id);
			
			for (let i=0; i<toRemove.length; i++) {
				let collectionID = toRemove[i];
				Zotero.Collections.refreshChildItems(collectionID);
				Zotero.Notifier.trigger('remove', 'collection-item', collectionID + '-' + this.id);
			}
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
			var sql = "REPLACE INTO itemSeeAlso (itemID, linkedItemID) VALUES (?,?)";
			var replaceStatement = Zotero.DB.getAsyncStatement(sql);
			
			for each(var linkedItemID in newids) {
				replaceStatement.bindInt32Parameter(0, itemID);
				replaceStatement.bindInt32Parameter(1, linkedItemID);
				
				yield Zotero.DB.executeAsyncStatement(replaceStatement);
			}
		}
		
		Zotero.Notifier.trigger('modify', 'item', removed.concat(newids));
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
			yield Zotero.DB.queryAsync(sql, [this.id].concat(removed));
		}
		
		if (newids.length) {
			var sql = "INSERT INTO itemSeeAlso (itemID, linkedItemID) VALUES (?,?)";
			var insertStatement = Zotero.DB.getAsyncStatement(sql);
			
			for each(var linkedItemID in newids) {
				insertStatement.bindInt32Parameter(0, this.id);
				insertStatement.bindInt32Parameter(1, linkedItemID);
				
				yield Zotero.DB.executeAsyncStatement(insertStatement);
			}
		}
		
		Zotero.Notifier.trigger('modify', 'item', removed.concat(newids));
	}
	
	// Update child item counts and contents
	if (reloadParentChildItems) {
		for (let parentItemID in reloadParentChildItems) {
			let parentItem = yield Zotero.Items.getAsync(parentItemID);
			yield parentItem.reload(['primaryData', 'childItems'], true);
			parentItem.clearBestAttachmentState();
		}
	}
});

Zotero.Item.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	// New items have to be reloaded via Zotero.Items.get(), so mark them as disabled
	if (env.isNew) {
		var id = this.id;
		this._disabled = true;
		return id;
	}
	
	// Always reload primary data. DataObject.reload() only reloads changed data types, so
	// it won't reload, say, dateModified and firstCreator if only creator data was changed
	// and not primaryData.
	yield this.loadPrimaryData(true);
	yield this.reload();
	this._clearChanged();
	
	return true;
});

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
	return this.isRegularItem() || !this.parentKey;
}


Zotero.Item.prototype.numChildren = function(includeTrashed) {
	return this.numNotes(includeTrashed) + this.numAttachments(includeTrashed);
}


/**
 * @return	{String|FALSE}	 Key of the parent item for an attachment or note, or FALSE if none
 */
Zotero.Item.prototype.getSourceKey = function() {
	Zotero.debug("Zotero.Item.prototype.getSource() is deprecated -- use .parentKey");
	return this._parentKey;
}


Zotero.Item.prototype.setSourceKey = function(sourceItemKey) {
	Zotero.debug("Zotero.Item.prototype.setSourceKey() is deprecated -- use .parentKey");
	return this.parentKey = sourceItemKey;
}


////////////////////////////////////////////////////////
//
// Methods dealing with note items
//
////////////////////////////////////////////////////////
Zotero.Item.prototype.incrementNumNotes = function () {
	this._numNotes++;
}

Zotero.Item.prototype.incrementNumNotesTrashed = function () {
	this._numNotesTrashed++;
}

Zotero.Item.prototype.incrementNumNotesEmbedded = function () {
	this._numNotesEmbedded++;
}

Zotero.Item.prototype.incrementNumNotesTrashed = function () {
	this._numNotesEmbeddedTrashed++;
}

Zotero.Item.prototype.decrementNumNotes = function () {
	this._numNotes--;
}

Zotero.Item.prototype.decrementNumNotesTrashed = function () {
	this._numNotesTrashed--;
}

Zotero.Item.prototype.decrementNumNotesEmbedded = function () {
	this._numNotesEmbedded--;
}

Zotero.Item.prototype.decrementNumNotesTrashed = function () {
	this._numNotesEmbeddedTrashed--;
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
	var cacheKey = '_numNotes';
	if (includeTrashed && includeEmbedded) {
		return this[cacheKey] + this[cacheKey + "EmbeddedTrashed"];
	}
	else if (includeTrashed) {
		return this[cacheKey] + this[cacheKey + "Trashed"];
	}
	else if (includeEmbedded) {
		return this[cacheKey] + this[cacheKey + "Embedded"];
	}
	return this[cacheKey];
}


/**
 * Get the first line of the note for display in the items list
 *
 * Note titles are loaded in loadItemData(), but can also come from Zotero.Items.cacheFields()
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
	this._requireData('itemData');
	return "";
};


Zotero.Item.prototype.hasNote = Zotero.Promise.coroutine(function* () {
	if (!this.isNote() && !this.isAttachment()) {
		throw new Error("hasNote() can only be called on notes and attachments");
	}
	
	if (this._hasNote !== null) {
		return this._hasNote;
	}
	
	if (!this._id) {
		return false;
	}
	
	var sql = "SELECT COUNT(*) FROM itemNotes WHERE itemID=? "
				+ "AND note!='' AND note!=?";
	var hasNote = !!(yield Zotero.DB.valueQueryAsync(sql, [this._id, Zotero.Notes.defaultNote]));
	
	this._hasNote = hasNote;
	return hasNote;
});


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
	
	this._requireData('note');
	return "";
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
	if (text === oldText) {
		Zotero.debug("Note hasn't changed", 4);
		return false;
	}
	
	this._hasNote = text !== '';
	this._noteText = text;
	this._noteTitle = Zotero.Notes.noteToTitle(text);
	this._displayTitle = this._noteTitle;
	
	this._markFieldChange('note', oldText);
	this._changed.note = true;
	
	return true;
}


/**
 * Returns child notes of this item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items
 * @param	{Boolean}	includeEmbedded		Include embedded attachment notes
 * @return	{Integer[]}						Array of itemIDs
 */
Zotero.Item.prototype.getNotes = function(includeTrashed) {
	if (this.isNote()) {
		throw new Error("getNotes() cannot be called on items of type 'note'");
	}
	
	this._requireData('childItems');
	
	var sortChronologically = Zotero.Prefs.get('sortNotesChronologically');
	var cacheKey = (sortChronologically ? "chronological" : "alphabetical")
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	
	if (this._notes[cacheKey]) {
		return this._notes[cacheKey];
	}
	
	var rows = this._notes.rows.concat();
	// Remove trashed items if necessary
	if (!includeTrashed) {
		rows = rows.filter(function (row) !row.trashed);
	}
	// Sort by title if necessary
	if (!sortChronologically) {
		var collation = Zotero.getLocaleCollation();
		rows.sort(function (a, b) {
			var aTitle = Zotero.Items.getSortTitle(a.title);
			var bTitle = Zotero.Items.getSortTitle(b.title);
			return collation.compareString(1, aTitle, bTitle);
		});
	}
	var ids = [row.itemID for (row of rows)];
	this._notes[cacheKey] = ids;
	return ids;
}


////////////////////////////////////////////////////////
//
// Methods dealing with attachments
//
// save() is not required for attachment functions
//
///////////////////////////////////////////////////////
/**
* Determine if an item is an attachment
**/
Zotero.Item.prototype.isAttachment = function() {
	return Zotero.ItemTypes.getName(this.itemTypeID) == 'attachment';
}


/**
 * @return {Promise<Boolean>}
 */
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


/**
 * @return {Promise<Boolean>}
 */
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


/**
 * @return {Promise<Boolean>}
 */
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
 * @return	<Integer>
 */
Zotero.Item.prototype.numAttachments = function(includeTrashed) {
	if (this.isAttachment()) {
		throw ("numAttachments() cannot be called on attachment items");
	}
	
	var cacheKey = '_numAttachments';
	if (includeTrashed) {
		return this[cacheKey] + this[cacheKey + "Trashed"];
	}
	return this[cacheKey];
}


/**
 * Get an nsILocalFile for the attachment, or false for invalid paths
 *
 * Note: This no longer checks whether a file exists
 *
 * @return {nsILocalFile|false}  An nsIFile, or false for invalid paths
 */
Zotero.Item.prototype.getFile = function () {
	if (arguments.length) {
		Zotero.debug("WARNING: Zotero.Item.prototype.getFile() no longer takes any arguments");
	}
	
	if (!this.isAttachment()) {
		throw new Error("getFile() can only be called on attachment items");
	}
	
	var linkMode = this.attachmentLinkMode;
	var path = this.attachmentPath;
	
	// No associated files for linked URLs
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}
	
	if (!path) {
		Zotero.debug("Attachment path is empty", 2);
		return false;
	}
	
	// Imported file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		try {
			if (path.indexOf("storage:") == -1) {
				Zotero.debug("Invalid attachment path '" + path + "'", 2);
				throw ('Invalid path');
			}
			// Strip "storage:"
			path = path.substr(8);
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
			var file = Zotero.Attachments.getStorageDirectory(this);
			file.QueryInterface(Components.interfaces.nsILocalFile);
			file.setRelativeDescriptor(file, path);
		}
		catch (e) {
			Zotero.debug(e);
			
			// See if this is a persistent path
			// (deprecated for imported attachments)
			Zotero.debug('Trying as persistent descriptor');
			
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				file.persistentDescriptor = row.path;
			}
			catch (e) {
				Zotero.debug('Invalid persistent descriptor', 2);
				return false;
			}
		}
	}
	// Linked file with relative path
	else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		var file = Zotero.Attachments.resolveRelativePath(path);
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
			}
			catch (e) {
				Zotero.debug('Invalid relative descriptor', 2);
				return false;
			}
		}
	}
	
	return file;
};


/**
 * Get the absolute file path for the attachment
 *
 * @return {Promise<string|false>} - A promise for either the absolute file path of the attachment
 *                                    or false for invalid paths
 */
Zotero.Item.prototype.getFilePath = function () {
	if (!this.isAttachment()) {
		throw new Error("getFilePath() can only be called on attachment items");
	}
	
	var linkMode = this.attachmentLinkMode;
	var path = this.attachmentPath;
	
	// No associated files for linked URLs
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}
	
	if (!path) {
		Zotero.debug("Attachment path is empty", 2);
		if (!skipExistsCheck) {
			this._updateAttachmentStates(false);
		}
		return false;
	}
	
	// Imported file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		try {
			if (path.indexOf("storage:") == -1) {
				Zotero.debug("Invalid attachment path '" + path + "'", 2);
				throw ('Invalid path');
			}
			// Strip "storage:"
			var path = path.substr(8);
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
			var file = Zotero.Attachments.getStorageDirectory(this);
			file.QueryInterface(Components.interfaces.nsILocalFile);
			file.setRelativeDescriptor(file, path);
		}
		catch (e) {
			Zotero.debug(e);
			
			// See if this is a persistent path
			// (deprecated for imported attachments)
			Zotero.debug('Trying as persistent descriptor');
			
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				file.persistentDescriptor = path;
				
				// If valid, convert this to a relative descriptor in the background
				OS.File.exists(file.path)
				.then(function (exists) {
					if (exists) {
						return Zotero.DB.queryAsync(
							"UPDATE itemAttachments SET path=? WHERE itemID=?",
							["storage:" + file.leafName, this._id]
						);
					}
				});
			}
			catch (e) {
				Zotero.debug('Invalid persistent descriptor', 2);
				this._updateAttachmentStates(false);
				return false;
			}
		}
	}
	// Linked file with relative path
	else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		var file = Zotero.Attachments.resolveRelativePath(path);
		if (!file) {
			this._updateAttachmentStates(false);
			return false;
		}
	}
	else {
		var file = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		
		try {
			file.persistentDescriptor = path;
		}
		catch (e) {
			// See if this is an old relative path (deprecated)
			Zotero.debug('Invalid persistent descriptor -- trying relative');
			try {
				var refDir = (linkMode == this.LINK_MODE_LINKED_FILE)
					? Zotero.getZoteroDirectory() : Zotero.getStorageDirectory();
				file.setRelativeDescriptor(refDir, path);
				// If valid, convert this to a persistent descriptor in the background
				OS.File.exists(file.path)
				.then(function (exists) {
					if (exists) {
						return Zotero.DB.queryAsync(
							"UPDATE itemAttachments SET path=? WHERE itemID=?",
							[file.persistentDescriptor, this._id]
						);
					}
				});
			}
			catch (e) {
				Zotero.debug('Invalid relative descriptor', 2);
				this._updateAttachmentStates(false);
				return false;
			}
		}
	}
	
	return file.path;
};


/**
 * Get the absolute path for the attachment, if it exists
 *
 * @return {Promise<String|false>} - A promise for either the absolute path of the attachment
 *                                    or false for invalid paths or if the file doesn't exist
 */
Zotero.Item.prototype.getFilePathAsync = Zotero.Promise.coroutine(function* (skipExistsCheck) {
	if (!this.isAttachment()) {
		throw new Error("getFilePathAsync() can only be called on attachment items");
	}
	
	var linkMode = this.attachmentLinkMode;
	var path = this.attachmentPath;
	
	// No associated files for linked URLs
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}
	
	if (!path) {
		Zotero.debug("Attachment path is empty", 2);
		if (!skipExistsCheck) {
			this._updateAttachmentStates(false);
		}
		return false;
	}
	
	// Imported file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		try {
			if (path.indexOf("storage:") == -1) {
				Zotero.debug("Invalid attachment path '" + path + "'", 2);
				throw ('Invalid path');
			}
			// Strip "storage:"
			var path = path.substr(8);
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
			var file = Zotero.Attachments.getStorageDirectory(this);
			file.QueryInterface(Components.interfaces.nsILocalFile);
			file.setRelativeDescriptor(file, path);
		}
		catch (e) {
			Zotero.debug(e);
			
			// See if this is a persistent path
			// (deprecated for imported attachments)
			Zotero.debug('Trying as persistent descriptor');
			
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				file.persistentDescriptor = path;
				
				// If valid, convert this to a relative descriptor
				if (!skipExistsCheck && file.exists()) {
					yield Zotero.DB.queryAsync("UPDATE itemAttachments SET path=? WHERE itemID=?",
						["storage:" + file.leafName, this._id]);
				}
			}
			catch (e) {
				Zotero.debug('Invalid persistent descriptor', 2);
				if (!skipExistsCheck) {
					this._updateAttachmentStates(false);
				}
				return false;
			}
		}
	}
	// Linked file with relative path
	else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		var file = Zotero.Attachments.resolveRelativePath(path);
		if (!skipExistsCheck && !file) {
			this._updateAttachmentStates(false);
			return false;
		}
	}
	else {
		var file = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		
		try {
			file.persistentDescriptor = path;
		}
		catch (e) {
			// See if this is an old relative path (deprecated)
			Zotero.debug('Invalid persistent descriptor -- trying relative');
			try {
				var refDir = (linkMode == this.LINK_MODE_LINKED_FILE)
					? Zotero.getZoteroDirectory() : Zotero.getStorageDirectory();
				file.setRelativeDescriptor(refDir, path);
				// If valid, convert this to a persistent descriptor
				if (!skipExistsCheck && file.exists()) {
					yield Zotero.DB.queryAsync("UPDATE itemAttachments SET path=? WHERE itemID=?",
						[file.persistentDescriptor, this._id]);
				}
			}
			catch (e) {
				Zotero.debug('Invalid relative descriptor', 2);
				if (!skipExistsCheck) {
					this._updateAttachmentStates(false);
				}
				return false;
			}
		}
	}
	
	var path = file.path;
	
	if (!skipExistsCheck && !(yield OS.File.exists(path))) {
		Zotero.debug("Attachment file '" + path + "' not found", 2);
		this._updateAttachmentStates(false);
		return false;
	}
	
	if (!skipExistsCheck) {
		this._updateAttachmentStates(true);
	}
	return file.path;
});



/**
 * Update file existence state of this item and best attachment state of parent item
 */
Zotero.Item.prototype._updateAttachmentStates = function (exists) {
	this._fileExists = exists;
	
	if (this.isTopLevelItem()) {
		return;
	}
	
	try {
		var parentKey = this.parentKey;
	}
	// This can happen during classic sync conflict resolution, if a
	// standalone attachment was modified locally and remotely was changed
	// into a child attachment
	catch (e) {
		Zotero.debug("Attachment parent doesn't exist for source key "
			+ "in Zotero.Item.updateAttachmentStates()", 1);
		return;
	}
	
	try {
		var item = Zotero.Items.getByLibraryAndKey(this.libraryID, parentKey);
	}
	catch (e) {
		if (e instanceof Zotero.Exception.UnloadedDataException) {
			Zotero.debug("Attachment parent not yet loaded in Zotero.Item.updateAttachmentStates()", 2);
			return;
		}
		throw e;
	}
	item.clearBestAttachmentState();
};


Zotero.Item.prototype.getFilename = function () {
	if (!this.isAttachment()) {
		throw new Error("getFileName() can only be called on attachment items");
	}
	
	if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw new Error("getFilename() cannot be called on link attachments");
	}
	
	var file = this.getFile();
	if (!file) {
		return '';
	}
	return file.leafName;
}


/**
 * Asynchronous cached check for file existence, used for items view
 *
 * This is updated only initially and on subsequent getFilePathAsync() calls.
 */
Zotero.Item.prototype.fileExists = Zotero.Promise.coroutine(function* () {
	if (this._fileExists !== null) {
		return this._fileExists;
	}
	
	if (!this.isAttachment()) {
		throw new Error("Zotero.Item.fileExists() can only be called on attachment items");
	}
	
	if (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw new Error("Zotero.Item.fileExists() cannot be called on link attachments");
	}
	
	return !!(yield this.getFilePathAsync());
});


/**
 * Synchronous cached check for file existence, used for items view
 */
Zotero.Item.prototype.fileExistsCached = function () {
	return this._fileExists;
}



/*
 * Rename file associated with an attachment
 *
 * -1   		Destination file exists -- use _force_ to overwrite
 * -2		Error renaming
 * false		Attachment file not found
 */
Zotero.Item.prototype.renameAttachmentFile = Zotero.Promise.coroutine(function* (newName, overwrite) {
	var origPath = yield this.getFilePath();
	if (!origPath) {
		Zotero.debug("Attachment file not found in renameAttachmentFile()", 2);
		return false;
	}
	
	try {
		var origName = OS.Path.basename(origPath);
		var origModDate = yield OS.File.stat(origPath).lastModificationDate;
		
		newName = Zotero.File.getValidFileName(newName);
		
		var destPath = OS.Path.join(OS.Path.dirname(origPath), newName);
		var destName = OS.Path.basename(destPath);
		
		// Ignore if no change
		//
		// Note: Just comparing origName to newName isn't reliable
		if (origFileName === destName) {
			return true;
		}
		
		// Update mod time and clear hash so the file syncs
		// TODO: use an integer counter instead of mod time for change detection
		// Update mod time first, because it may fail for read-only files on Windows
		yield OS.File.setDates(origPath, null, null);
		var result = yield OS.File.move(origPath, destPath, { noOverwrite: !overwrite })
		// If no overwriting and file exists, return -1
		.catch(OS.File.Error, function (e) {
			if (e.becauseExists) {
				return -1;
			}
			throw e;
		});
		if (result) {
			return result;
		}
		
		yield this.relinkAttachmentFile(destPath);
		
		yield Zotero.DB.executeTransaction(function* () {
			Zotero.Sync.Storage.setSyncedHash(this.id, null, false);
			Zotero.Sync.Storage.setSyncState(this.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
		}.bind(this));
		
		return true;
	}
	catch (e) {
		// Restore original modification date in case we managed to change it
		try {
			OS.File.setDates(origPath, null, origModDate);
		} catch (e) {
			Zotero.debug(e, 2);
		}
		Zotero.debug(e);
		Components.utils.reportError(e);
		return -2;
	}
});


/**
 * @param {string} path  File path
 * @param {Boolean} [skipItemUpdate] Don't update attachment item mod time,
 *                                   so that item doesn't sync. Used when a file
 *                                   needs to be renamed to be accessible but the
 *                                   user doesn't have access to modify the
 *                                   attachment metadata
 */
Zotero.Item.prototype.relinkAttachmentFile = Zotero.Promise.coroutine(function* (path, skipItemUpdate) {
	if (path instanceof Components.interfaces.nsIFile) {
		Zotero.debug("WARNING: Zotero.Item.prototype.relinkAttachmentFile() now takes an absolute "
			+ "file path instead of an nsIFile");
		path = path.path;
	}
	
	var linkMode = this.attachmentLinkMode;
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw new Error('Cannot relink linked URL');
	}
	
	var fileName = OS.Path.basename(path);
	
	var newName = Zotero.File.getValidFileName(fileName);
	if (!newName) {
		throw new Error("No valid characters in filename after filtering");
	}
	
	// Rename file to filtered name if necessary
	if (fileName != newName) {
		Zotero.debug("Renaming file '" + fileName + "' to '" + newName + "'");
		OS.File.move(path, OS.Path.join(OS.Path.dirname(path), newName), { noOverwrite: true });
	}
	
	this.attachmentPath = Zotero.Attachments.getPath(file, linkMode);
	
	yield this.save({
		skipDateModifiedUpdate: true,
		skipClientDateModifiedUpdate: skipItemUpdate
	});
	
	return false;
});



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
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentLinkMode', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentLinkMode;
	},
	set: function(val) {
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
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.linkMode = true;
		this._attachmentLinkMode = val;
	}
});


Zotero.Item.prototype.getAttachmentMIMEType = function() {
	Zotero.debug("getAttachmentMIMEType() deprecated -- use .attachmentContentType");
	return this.attachmentContentType;
};

Zotero.defineProperty(Zotero.Item.prototype, 'attachmentMIMEType', {
	get: function() {
		Zotero.debug(".attachmentMIMEType deprecated -- use .attachmentContentType");
		return this.attachmentContentType;
	}
});

/**
 * Content type of an attachment (e.g. 'text/plain')
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentContentType', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentContentType;
	},
	set: function(val) {
		if (!this.isAttachment()) {
			throw (".attachmentContentType can only be set for attachment items");
		}
		
		if (!val) {
			val = '';
		}
		
		if (val == this.attachmentContentType) {
			return;
		}
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.contentType = true;
		this._attachmentContentType = val;
	}
});


Zotero.Item.prototype.getAttachmentCharset = function() {
	Zotero.debug("getAttachmentCharset() deprecated -- use .attachmentCharset");
	return this.attachmentCharset;
}


/**
 * Character set of an attachment
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentCharset', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentCharset
	},
	set: function(val) {
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
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData= {};
		}
		this._changed.attachmentData.charset = true;
		this._attachmentCharset = val;
	}
});

Zotero.defineProperty(Zotero.Item.prototype, 'attachmentPath', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentPath;
	},
	set: function(val) {
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
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.path = true;
		this._attachmentPath = val;
	}
});


/**
 * Force an update of the attachment path and resave the item
 *
 * This is used when changing the attachment base directory, since relative
 * path handling is done on item save.
 */
Zotero.Item.prototype.updateAttachmentPath = function () {
	if (!this._changed.attachmentData) {
		this._changed.attachmentData = {};
	}
	this._changed.attachmentData.path = true;
	this.save({
		skipDateModifiedUpdate: true
	});
};


Zotero.defineProperty(Zotero.Item.prototype, 'attachmentSyncState', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentSyncState;
	},
	set: function(val) {
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
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.syncState = true;
		this._attachmentSyncState = val;
	}
});


/**
 * Modification time of an attachment file
 *
 * Note: This is the mod time of the file itself, not the last-known mod time
 * of the file on the storage server as stored in the database
 *
 * @return {Promise<Number|undefined>} File modification time as timestamp in milliseconds,
 *                                     or undefined if no file
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentModificationTime', {
	get: Zotero.Promise.coroutine(function* () {
		if (!this.isAttachment()) {
			return undefined;
		}
		
		if (!this.id) {
			return undefined;
		}
		
		var path = yield this.getFilePathAsync();
		if (!path) {
			return undefined;
		}
		
		var fmtime = OS.File.stat(path).lastModificationDate;
		
		if (fmtime < 1) {
			Zotero.debug("File mod time " + fmtime + " is less than 1 -- interpreting as 1", 2);
			fmtime = 1;
		}
		
		return fmtime;
	})
});


/**
 * MD5 hash of an attachment file
 *
 * Note: This is the hash of the file itself, not the last-known hash
 * of the file on the storage server as stored in the database
 *
 * @return	{String}		MD5 hash of file as hex string
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentHash', {
	get: function () {
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
		
		return Zotero.Utilities.Internal.md5(file) || undefined;
	}
});


/**
 * Return plain text of attachment content
 *
 * - Currently works on HTML, PDF and plaintext attachments
 * - Paragraph breaks will be lost in PDF content
 * - For PDFs, will return empty string if Zotero.Fulltext.pdfConverterIsRegistered() is false
 *
 * @return {Promise<String>} - A promise for attachment text or empty string if unavailable
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentText', {
	get: Zotero.Promise.coroutine(function* () {
		if (!this.isAttachment()) {
			return undefined;
		}
		
		if (!this.id) {
			return null;
		}
		
		var file = this.getFile();
		
		if (!(yield OS.File.exists(file.path))) {
			file = false;
		}
		
		var cacheFile = Zotero.Fulltext.getItemCacheFile(this);
		if (!file) {
			if (cacheFile.exists()) {
				var str = yield Zotero.File.getContentsAsync(cacheFile);
				
				return str.trim();
			}
			return '';
		}
		
		var contentType = this.attachmentContentType;
		if (!contentType) {
			contentType = yield Zotero.MIME.getMIMETypeFromFile(file);
			if (contentType) {
				this.attachmentContentType = contentType;
				yield this.save();
			}
		}
		
		var str;
		if (Zotero.Fulltext.isCachedMIMEType(contentType)) {
			var reindex = false;
			
			if (!cacheFile.exists()) {
				Zotero.debug("Regenerating item " + this.id + " full-text cache file");
				reindex = true;
			}
			// Fully index item if it's not yet
			else if (!(yield Zotero.Fulltext.isFullyIndexed(this))) {
				Zotero.debug("Item " + this.id + " is not fully indexed -- caching now");
				reindex = true;
			}
			
			if (reindex) {
				if (!Zotero.Fulltext.pdfConverterIsRegistered()) {
					Zotero.debug("PDF converter is unavailable -- returning empty .attachmentText", 3);
					return '';
				}
				yield Zotero.Fulltext.indexItems(this.id, false);
			}
			
			if (!cacheFile.exists()) {
				Zotero.debug("Cache file doesn't exist after indexing -- returning empty .attachmentText");
				return '';
			}
			str = yield Zotero.File.getContentsAsync(cacheFile);
		}
		
		else if (contentType == 'text/html') {
			str = yield Zotero.File.getContentsAsync(file);
			str = Zotero.Utilities.unescapeHTML(str);
		}
		
		else if (contentType == 'text/plain') {
			str = yield Zotero.File.getContentsAsync(file);
		}
		
		else {
			return '';
		}
		
		return str.trim();
	})
});



/**
 * Returns child attachments of this item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items
 * @return	{Integer[]}						Array of itemIDs
 */
Zotero.Item.prototype.getAttachments = function(includeTrashed) {
	if (this.isAttachment()) {
		throw new Error("getAttachments() cannot be called on attachment items");
	}
	
	this._requireData('childItems');
	
	var cacheKey = (Zotero.Prefs.get('sortAttachmentsChronologically') ? 'chronological' : 'alphabetical')
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	
	if (this._attachments[cacheKey]) {
		return this._attachments[cacheKey];
	}
	
	var rows = this._attachments.rows.concat();
	// Remove trashed items if necessary
	if (!includeTrashed) {
		rows = rows.filter(function (row) !row.trashed);
	}
	// Sort by title if necessary
	if (!Zotero.Prefs.get('sortAttachmentsChronologically')) {
		var collation = Zotero.getLocaleCollation();
		rows.sort(function (a, b) collation.compareString(1, a.title, b.title));
	}
	var ids = [row.itemID for (row of rows)];
	this._attachments[cacheKey] = ids;
	return ids;
}


/**
 * Looks for attachment in the following order: oldest PDF attachment matching parent URL,
 * oldest non-PDF attachment matching parent URL, oldest PDF attachment not matching URL,
 * old non-PDF attachment not matching URL
 *
 * @return {Promise<Zotero.Item|FALSE>} - A promise for attachment item or FALSE if none
 */
Zotero.Item.prototype.getBestAttachment = Zotero.Promise.coroutine(function* () {
	if (!this.isRegularItem()) {
		throw ("getBestAttachment() can only be called on regular items");
	}
	var attachments = yield this.getBestAttachments();
	return attachments ? attachments[0] : false;
});


/**
 * Looks for attachment in the following order: oldest PDF attachment matching parent URL,
 * oldest PDF attachment not matching parent URL, oldest non-PDF attachment matching parent URL,
 * old non-PDF attachment not matching parent URL
 *
 * @return {Promise<Zotero.Item[]>} - A promise for an array of Zotero items
 */
Zotero.Item.prototype.getBestAttachments = Zotero.Promise.coroutine(function* () {
	if (!this.isRegularItem()) {
		throw new Error("getBestAttachments() can only be called on regular items");
	}
	
	var url = this.getField('url');
	
	var sql = "SELECT IA.itemID FROM itemAttachments IA NATURAL JOIN items I "
		+ "LEFT JOIN itemData ID ON (IA.itemID=ID.itemID AND fieldID=1) "
		+ "LEFT JOIN itemDataValues IDV ON (ID.valueID=IDV.valueID) "
		+ "WHERE parentItemID=? AND linkMode NOT IN (?) "
		+ "AND IA.itemID NOT IN (SELECT itemID FROM deletedItems) "
		+ "ORDER BY contentType='application/pdf' DESC, value=? DESC, dateAdded ASC";
	var itemIDs = yield Zotero.DB.columnQueryAsync(sql, [this.id, Zotero.Attachments.LINK_MODE_LINKED_URL, url]);
	return Zotero.Items.get(itemIDs);
});



/**
 * Return state of best attachment
 *
 * @return {Promise<Integer>}  Promise for 0 (none), 1 (present), -1 (missing)
 */
Zotero.Item.prototype.getBestAttachmentState = Zotero.Promise.coroutine(function* () {
	if (this._bestAttachmentState !== null) {
		return this._bestAttachmentState;
	}
	var item = yield this.getBestAttachment();
	if (item) {
		let exists = yield item.fileExists();
		return this._bestAttachmentState = exists ? 1 : -1;
	}
	return this._bestAttachmentState = 0;
});


/**
 * Return cached state of best attachment for use in items view
 *
 * @return {Integer|null}  0 (none), 1 (present), -1 (missing), null (unavailable)
 */
Zotero.Item.prototype.getBestAttachmentStateCached = function () {
	return this._bestAttachmentState;
}


Zotero.Item.prototype.clearBestAttachmentState = function () {
	this._bestAttachmentState = null;
}


//
// Methods dealing with item tags
//
//
/**
 * Returns all tags assigned to an item
 *
 * @return {Array} Array of tag data in API JSON format
 */
Zotero.Item.prototype.getTags = function () {
	this._requireData('tags');
	// BETTER DEEP COPY?
	return JSON.parse(JSON.stringify(this._tags));
};


/**
 * Check if the item has a given tag
 *
 * @param {String}
 * @return {Boolean}
 */
Zotero.Item.prototype.hasTag = function (tagName) {
	this._requireData('tags');
	return this._tags.some(function (tagData) tagData.tag == tagName);
}


/**
 * Get the assigned type for a given tag of the item
 */
Zotero.Item.prototype.getTagType = function (tagName) {
	this._requireData('tags');
	for (let i=0; i<this._tags.length; i++) {
		let tag = this._tags[i];
		if (tag.tag === tagName) {
			return tag.type ? tag.type : 0;
		}
	}
	return null;
}


/**
 * Set the item's tags
 *
 * A separate save() is required to update the database.
 *
 * @param {Array} tags  Tag data in API JSON format (e.g., [{tag: 'tag', type: 1}])
 */
Zotero.Item.prototype.setTags = function (tags) {
	var oldTags = this.getTags();
	var newTags = tags.concat();
	for (let i=0; i<oldTags.length; i++) {
		oldTags[i] = Zotero.Tags.cleanData(oldTags[i]);
	}
	for (let i=0; i<newTags.length; i++) {
		newTags[i] = Zotero.Tags.cleanData(newTags[i]);
	}
	
	// Sort to allow comparison with JSON, which maybe we'll stop doing if it's too slow
	var sorter = function (a, b) {
		if (a.type < b.type) return -1;
		if (a.type > b.type) return 1;
		return a.tag.localeCompare(b.tag);
	};
	oldTags.sort(sorter);
	newTags.sort(sorter);
	
	if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
		Zotero.debug("Tags haven't changed", 4);
		return;
	}
	
	this._markFieldChange('tags', this._tags);
	this._changed.tags = true;
	this._tags = newTags;
}


/**
 * Add a single tag to the item. If type is 1 and an automatic tag with the same name already
 * exists, replace it with a manual one.
 *
 * A separate save() is required to update the database.
 *
 * @param {String} name
 * @param {Number} [type=0]
 */
Zotero.Item.prototype.addTag = function (name, type) {
	type = type ? parseInt(type) : 0;
	
	var changed = false;
	var tags = this.getTags();
	for (let i=0; i<tags.length; i++) {
		let tag = tags[i];
		if (tag.tag === name) {
			if (tag.type == type) {
				Zotero.debug("Tag '" + name + "' already exists on item " + this.libraryKey);
				return false;
			}
			tag.type = type;
			changed = true;
			break;
		}
	}
	if (!changed) {
		tags.push({
			tag: name,
			type: type
		});
	}
	this.setTags(tags);
	return true;
}


Zotero.Item.prototype.addTags = function (tags) {
	throw new Error("Unimplemented");
}


/**
 * Replace an existing tag with a new manual tag
 *
 * @param {String} oldTag
 * @param {String} newTag
 */
Zotero.Item.prototype.replaceTag = function (oldTag, newTag) {
	var tags = this.getTags();
	newTag = newTag.trim();
	
	Zotero.debug("REPLACING TAG " + oldTag + " " + newTag);
	
	if (newTag === "") {
		Zotero.debug('Not replacing with empty tag', 2);
		return false;
	}
	
	var changed = false;
	for (let i=0; i<tags.length; i++) {
		let tag = tags[i];
		if (tag.tag === oldTag) {
			tag.tag = newTag;
			tag.type = 0;
			changed = true;
		}
	}
	if (!changed) {
		Zotero.debug("Tag '" + oldTag + "' not found on item -- not replacing", 2);
		return false;
	}
	this.setTags(tags);
	return true;
}


/**
 * Remove a tag from the item
 *
 * A separate save() is required to update the database.
 */
Zotero.Item.prototype.removeTag = function(tagName) {
	this._requireData('tags');
	Zotero.debug(this._tags);
	var newTags = this._tags.filter(function (tagData) tagData.tag !== tagName);
	if (newTags.length == this._tags.length) {
		Zotero.debug('Cannot remove missing tag ' + tagName + ' from item ' + this.libraryKey);
		return;
	}
	Zotero.debug(newTags);
	this.setTags(newTags);
}


/**
 * Remove all tags from the item
 *
 * A separate save() is required to update the database.
 */
Zotero.Item.prototype.removeAllTags = function() {
	this._requireData('tags');
	this.setTags([]);
}


//
// Methods dealing with collections
//
/**
 * Gets the collections the item is in
 *
 * @return {Array<Integer>}  An array of collectionIDs for all collections the item belongs to
 */
Zotero.Item.prototype.getCollections = function () {
	this._requireData('collections');
	return this._collections.concat();
};


/**
 * Sets the collections the item is in
 *
 * A separate save() (with options.skipDateModifiedUpdate, possibly) is required to save changes.
 *
 * @param {Array<String|Integer>} collectionIDsOrKeys Collection ids or keys
 */
Zotero.Item.prototype.setCollections = function (collectionIDsOrKeys) {
	this._requireData('collections');
	
	if (!collectionIDsOrKeys) {
		collectionIDsOrKeys = [];
	}
	
	// Convert any keys to ids
	var collectionIDs = collectionIDsOrKeys.map(function (val) {
		return parseInt(val) == val
			? parseInt(val)
			: Zotero.Collections.getIDFromLibraryAndKey(this.libraryID, val);
	}.bind(this));
	collectionIDs = Zotero.Utilities.arrayUnique(collectionIDs);
	
	if (Zotero.Utilities.arrayEquals(this._collections, collectionIDs)) {
		Zotero.debug("Collections have not changed for item " + this.id);
		return;
	}
	
	this._markFieldChange("collections", this._collections);
	this._collections = collectionIDs;
	this._changed.collections = true;
};


/**
 * Add this item to a collection
 *
 * A separate save() (with options.skipDateModifiedUpdate, possibly) is required to save changes.
 *
 * @param {Number} collectionID
 */
Zotero.Item.prototype.addToCollection = function (collectionIDOrKey) {
	var collectionID = parseInt(collectionIDOrKey) == collectionIDOrKey
			? parseInt(collectionIDOrKey)
			: Zotero.Collections.getIDFromLibraryAndKey(this.libraryID, collectionIDOrKey)
	
	if (!collectionID) {
		throw new Error("Invalid collection '" + collectionIDOrKey + "'");
	}
	
	this._requireData('collections');
	if (this._collections.indexOf(collectionID) != -1) {
		Zotero.debug("Item is already in collection " + collectionID);
		return;
	}
	this.setCollections(this._collections.concat(collectionID));
};


/**
 * Remove this item from a collection
 *
 * A separate save() (with options.skipDateModifiedUpdate, possibly) is required to save changes.
 *
 * @param {Number} collectionID
 */
Zotero.Item.prototype.removeFromCollection = function (collectionIDOrKey) {
	var collectionID = parseInt(collectionIDOrKey) == collectionIDOrKey
			? parseInt(collectionIDOrKey)
			: Zotero.Collections.getIDFromLibraryAndKey(this.libraryID, collectionIDOrKey)
	
	if (!collectionID) {
		throw new Error("Invalid collection '" + collectionIDOrKey + "'");
	}
	
	Zotero.debug("REMOVING FROM COLLECTION");
	Zotero.debug(this._collections);
	
	this._requireData('collections');
	var pos = this._collections.indexOf(collectionID);
	if (pos == -1) {
		Zotero.debug("Item is not in collection " + collectionID);
		return;
	}
	this.setCollections(this._collections.slice(0, pos).concat(this._collections.slice(pos + 1)));
};


/**
* Determine whether the item belongs to a given collectionID
**/
Zotero.Item.prototype.inCollection = function (collectionID) {
	this._requireData('collections');
	return this._collections.indexOf(collectionID) != -1;
};


//
// Methods dealing with relations
//



/**
 * Return an item in the specified library equivalent to this item
 *
 * @return {Promise}
 */
Zotero.Item.prototype.getLinkedItem = function (libraryID) {
	return this._getLinkedObject(libraryID);
}


Zotero.Item.prototype.addLinkedItem = Zotero.Promise.coroutine(function* (item) {
	var url1 = Zotero.URI.getItemURI(this);
	var url2 = Zotero.URI.getItemURI(item);
	var predicate = Zotero.Relations.linkedObjectPredicate;
	if ((yield Zotero.Relations.getByURIs(url1, predicate, url2)).length
			|| (yield Zotero.Relations.getByURIs(url2, predicate, url1)).length) {
		Zotero.debug("Items " + this.key + " and " + item.key + " are already linked");
		return false;
	}
	
	// If one of the items is a personal library, store relation with that.
	// Otherwise, use current item's library (which in calling code is the
	// new, copied item).
	var libraryID = (!this.libraryID || !item.libraryID) ? 0 : this.libraryID;
	
	yield Zotero.Relations.add(libraryID, url1, predicate, url2);
});




Zotero.Item.prototype.getImageSrc = function() {
	var itemType = Zotero.ItemTypes.getName(this.itemTypeID);
	if (itemType == 'attachment') {
		var linkMode = this.attachmentLinkMode;
		
		// Quick hack to use PDF icon for imported files and URLs --
		// extend to support other document types later
		if ((linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE ||
				linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) &&
				this.attachmentContentType == 'application/pdf') {
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


Zotero.Item.prototype.getImageSrcWithTags = Zotero.Promise.coroutine(function* () {
	//Zotero.debug("Generating tree image for item " + this.id);
	
	var uri = this.getImageSrc();
	
	// TODO: Optimize this. Maybe load color/item associations in batch in cacheFields?
	yield this.loadTags();
	var tags = this.getTags();
	if (!tags.length) {
		return uri;
	}
	
	var tagColors = yield Zotero.Tags.getColors(this.libraryID);
	var colorData = [];
	for (let i=0; i<tags.length; i++) {
		let tag = tags[i];
		if (tagColors[tag.tag]) {
			colorData.push(tagColors[tag.tag]);
		}
	}
	if (!colorData.length) {
		return uri;
	}
	colorData.sort(function (a, b) {
		return a.position - b.position;
	});
	var colors = colorData.map(function (val) val.color);
	return Zotero.Tags.generateItemsListImage(colors, uri);
});



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
	
	changed = thisData.parentKey != otherData.parentKey;
	if (includeMatches || changed) {
		diff[0].parentKey = thisData.parentKey;
		diff[1].parentKey = otherData.parentKey;
		
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
Zotero.Item.prototype.multiDiff = Zotero.Promise.coroutine(function* (otherItems, ignoreFields) {
	var thisData = yield this.toJSON();
	
	var alternatives = {};
	var hasDiffs = false;
	
	for (let i = 0; i < otherItems.length; i++) {
		let otherItem = otherItems[i];
		let diff = [];
		let otherData = yield otherItem.toJSON();
		let numDiffs = Zotero.Items.diff(thisData, otherData, diff);
		
		if (numDiffs) {
			for (let field in diff[1]) {
				if (ignoreFields && ignoreFields.indexOf(field) != -1) {
					continue;
				}
				
				var value = diff[1][field];
				
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
});


/**
 * Returns an unsaved copy of the item
 *
 * @param {Number} [libraryID] - libraryID of the new item, or the same as original if omitted
 * @param {Boolean} [skipTags=false] - Skip tags
 */
Zotero.Item.prototype.clone = function(libraryID, skipTags) {
	Zotero.debug('Cloning item ' + this.id);
	
	if (libraryID !== undefined && libraryID !== null && typeof libraryID !== 'number') {
		throw new Error("libraryID must be null or an integer");
	}
	
	this._requireData('primaryData');
	
	if (libraryID === undefined || libraryID === null) {
		libraryID = this.libraryID;
	}
	var sameLibrary = libraryID == this.libraryID;
	
	var newItem = new Zotero.Item;
	newItem.setType(this.itemTypeID);
	
	var fieldIDs = this.getUsedFields();
	for (let i = 0; i < fieldIDs.length; i++) {
		let fieldID = fieldIDs[i];
		newItem.setField(fieldID, this.getField(fieldID));
	}
	
	// Regular item
	if (this.isRegularItem()) {
		newItem.setCreators(newItem.getCreators());
	}
	else {
		newItem.setNote(this.getNote());
		if (sameLibrary) {
			var parent = this.parentKey;
			if (parent) {
				newItem.parentKey = parent;
			}
		}
		
		if (this.isAttachment()) {
			newItem.attachmentLinkMode = this.attachmentLinkMode;
			newItem.attachmentContentType = this.attachmentContentType;
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
	
	if (!skipTags) {
		newItem.setTags(this.getTags());
	}
	
	if (sameLibrary) {
		// DEBUG: this will add reverse-only relateds too
		newItem.setRelations(this.getRelations());
	}
	
	return newItem;
}


/**
 * @return {Promise<Zotero.Item>} - A copy of the item with primary data loaded
 */
Zotero.Item.prototype.copy = Zotero.Promise.coroutine(function* () {
	var newItem = new Zotero.Item;
	newItem.id = this.id;
	yield newItem.loadPrimaryData();
	return newItem;
});;


/**
 * Delete item from database and clear from Zotero.Items internal array
 *
 * Items.erase() should be used for multiple items
 */
Zotero.Item.prototype.erase = Zotero.Promise.coroutine(function* () {
	if (!this.id) {
		return false;
	}
	
	Zotero.debug('Deleting item ' + this.id);
	
	var changedItems = [];
	var changedItemsNotifierData = {};
	var deletedItemNotifierData = {};
	
	yield Zotero.DB.executeTransaction(function* () {
		deletedItemNotifierData[this.id] = { old: this.toJSON() };
		
		// Remove item from parent collections
		var parentCollectionIDs = this.collections;
		if (parentCollectionIDs) {
			for (var i=0; i<parentCollectionIDs.length; i++) {
				let parentCollection = yield Zotero.Collections.getAsync(parentCollectionIDs[i]);
				yield parentCollection.removeItem(this.id);
			}
		}
		
		var parentItem = this.parentKey;
		parentItem = parentItem ? Zotero.Items.getByLibraryAndKey(this.libraryID, parentItem) : null;
		
		// // Delete associated attachment files
		if (this.isAttachment()) {
			let linkMode = this.getAttachmentLinkMode();
			// If link only, nothing to delete
			if (linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				try {
					let file = Zotero.Attachments.getStorageDirectory(this);
					yield OS.File.removeDir(file.path, {
						ignoreAbsent: true,
						ignorePermissions: true
					});
				}
				catch (e) {
					Zotero.debug(e, 2);
					Components.utils.reportError(e);
				}
			}
		}
		// Regular item
		else {
			let sql = "SELECT itemID FROM itemNotes WHERE parentItemID=?1 UNION "
				+ "SELECT itemID FROM itemAttachments WHERE parentItemID=?1";
			let toDelete = yield Zotero.DB.columnQueryAsync(sql, [this.id]);
			for (let i=0; i<toDelete.length; i++) {
				let obj = yield Zotero.Items.getAsync(toDelete[i]);
				yield obj.erase();
			}
		}
		
		// Flag related items for notification
		// TEMP: Do something with relations
		/*var relateds = this._getRelatedItems(true);
		for each(var id in relateds) {
			let relatedItem = Zotero.Items.get(id);
		}*/
		
		// Clear fulltext cache
		if (this.isAttachment()) {
			yield Zotero.Fulltext.clearItemWords(this.id);
			//Zotero.Fulltext.clearItemContent(this.id);
		}
		
		// Remove relations (except for merge tracker)
		var uri = Zotero.URI.getItemURI(this);
		yield Zotero.Relations.eraseByURI(uri, [Zotero.Relations.deletedItemPredicate]);
		
		yield Zotero.DB.queryAsync('DELETE FROM items WHERE itemID=?', this.id);
		
		if (parentItem) {
			yield parentItem.reload(['primaryData', 'childItems'], true);
			parentItem.clearBestAttachmentState();
		}
	}.bind(this));
	
	Zotero.Items.unload(this.id);
	
	// Send notification of changed items
	if (changedItems.length) {
		Zotero.Notifier.trigger('modify', 'item', changedItems, changedItemsNotifierData);
	}
	
	Zotero.Notifier.trigger('delete', 'item', this.id, deletedItemNotifierData);
	
	Zotero.Prefs.set('purge.items', true);
	Zotero.Prefs.set('purge.creators', true);
	Zotero.Prefs.set('purge.tags', true);
});


Zotero.Item.prototype.isCollection = function() {
	return false;
}


Zotero.Item.prototype.fromJSON = function (json) {
	if (json.itemKey) this.key = json.itemKey;
	if (json.itemType) this.setType(Zotero.ItemTypes.getID(json.itemType));
	
	var changedFields = {};
	
	// Primary data
	for (var field in json) {
		let val = json[field];
		
		switch (field) {
		case 'itemKey':
		case 'itemType':
		case 'creators':
		case 'deleted':
			break;
		
		case 'dateAdded':
		case 'dateModified':
			item[field] = val;
			break;
		
		case 'tags':
			this.setTags(json.tags);
			break;
		
		case 'collections':
			this.setCollections(json.collections);
			break;
		
		case 'relations':
			this.setRelations(json.relations);
			break;
		
		//
		// Attachment metadata
		//
		case 'linkMode':
			this.attachmentLinkMode = Zotero.Attachments["LINK_MODE_" + val.toUpperCase()];
			break;
		
		case 'contentType':
			this.attachmentContentType = val;
			break;
		
		case 'charset':
			this.attachmentCharset = val;
			break;
		
		case 'path':
			this.attachmentPath = val;
			break;
		
		// Item fields
		default:
			let changed = this.setField(field, json[field]);
			if (changed) {
				changedFields[field] = true;
			}
		}
	}
	
	// Clear existing fields not specified
	var previousFields = this.getUsedFields(true);
	for each(let field in previousFields) {
		if (!changedFields[field] &&
				// Invalid fields will already have been cleared by the type change
				Zotero.ItemFields.isValidForType(
					Zotero.ItemFields.getID(field), data.itemTypeID
				)) {
			this.setField(field, false);
		}
	}
	
	// Deleted item flag
	this.deleted = !!json.deleted;
	
	// Creators
	var numCreators = 0;
	if (json.creators) {
		for each (let creator in json.creators) {
			this.setCreator(pos, creator);
			numCreators++;
		}
	}
	// Remove item's remaining creators not in JSON
	var rem = this.numCreators() - numCreators;
	for (let j = 0; j < rem; j++) {
		// Keep removing last creator
		this.removeCreator(numCreators);
	}
	
	// Both notes and attachments might have parents and notes
	if (this.isNote() || this.isAttachment()) {
		let parentKey = json.parentItem;
		this.parentKey = parentKey ? parentKey : false;
		
		let note = json.note;
		this.setNote(note !== undefined ? note : "");
	}
}


/**
 * @param {Object} options
 * @param {Object} patchBase
 */
Zotero.Item.prototype.toJSON = Zotero.Promise.coroutine(function* (options, patchBase) {
	if (this.hasChanged()) {
		throw new Error("Cannot generate JSON from changed item");
	}
	
	if (options) {
		var mode = options.mode;
	}
	else {
		var mode = 'new';
	}
	
	if (mode == 'patch') {
		if (!patchBase) {
			throw new Error("Cannot use patch mode if patchBase not provided");
		}
	}
	else if (patchBase) {
		Zotero.debug("Zotero.Item.toJSON: ignoring provided patchBase in " + mode + " mode", 2);
	}
	
	var obj = {};
	obj.itemKey = this.key;
	obj.itemVersion = this.version;
	obj.itemType = Zotero.ItemTypes.getName(this.itemTypeID);
	
	// Fields
	yield this.loadItemData();
	for (let i in this._itemData) {
		let val = this.getField(i) + '';
		if (val !== '' || mode == 'full') {
			obj[Zotero.ItemFields.getName(i)] = val;
		}
	}
	
	// Creators
	if (this.isRegularItem()) {
		yield this.loadCreators()
		obj.creators = this.getCreatorsJSON();
	}
	else {
		var parent = this.parentKey;
		if (parent || mode == 'full') {
			obj.parentItem = parent ? parent : false;
		}
		
		// Attachment fields
		if (this.isAttachment()) {
			obj.linkMode = this.attachmentLinkMode;
			obj.contentType = this.attachmentContentType;
			obj.charset = Zotero.CharacterSets.getName(this.attachmentCharset);
			obj.path = this.attachmentPath;
		}
		
		// Notes and embedded attachment notes
		yield this.loadNote();
		let note = this.getNote();
		if (note !== "" || mode == 'full') {
			obj.note = note;
		}
		
		// TODO: md5, hash?
	}
	
	// Tags
	obj.tags = [];
	yield this.loadTags()
	var tags = this.getTags();
	for (let i=0; i<tags.length; i++) {
		obj.tags.push(tags[i]);
	}
	
	// Collections
	yield this.loadCollections();
	obj.collections = this.getCollections().map(function (id) {
		return Zotero.Collections.getLibraryAndKeyFromID(id)[1];
	});
	
	// Relations
	yield this.loadRelations();
	obj.relations = {};
	var rels = yield Zotero.Relations.getByURIs(Zotero.URI.getItemURI(this));
	for each (let rel in rels) {
		obj.relations[rel.predicate] = rel.object;
	}
	var relatedItems = this._getRelatedItems().map(function (key) {
		return Zotero.Items.getIDFromLibraryAndKey(this.libraryID, key);
	}.bind(this)).filter(function (val) val !== false);
	relatedItems = Zotero.Items.get(relatedItems);
	var pred = Zotero.Relations.relatedItemPredicate;
	for (let i=0; i<relatedItems.length; i++) {
		let item = relatedItems[i];
		let uri = Zotero.URI.getItemURI(item);
		if (obj.relations[pred]) {
			if (typeof obj.relations[pred] == 'string') {
				obj.relations[pred] = [uri];
			}
			obj.relations[pred].push(uri)
		}
		else {
			obj.relations[pred] = uri;
		}
	}
	
	// Deleted
	let deleted = this.deleted;
	if (deleted || mode == 'full') {
		obj.deleted = deleted;
	}
	
	obj.dateAdded = Zotero.Date.sqlToISO8601(this.dateAdded);
	obj.dateModified = Zotero.Date.sqlToISO8601(this.dateModified);
	
	if (mode == 'patch') {
		for (let i in patchBase) {
			switch (i) {
			case 'itemKey':
			case 'itemVersion':
			case 'dateModified':
				continue;
			}
			
			if (i in obj) {
				if (obj[i] === patchBase[i]) {
					delete obj[i];
				}
			}
			else {
				obj[i] = '';
			}
		}
	}
	
	return obj;
});


Zotero.Item.prototype.toResponseJSON = Zotero.Promise.coroutine(function* (options, patchBase) {
	var json = {
		key: this.key,
		version: this.version,
		meta: {},
		data: yield this.toJSON(options, patchBase)
	};
	
	// TODO: library block?
	
	// creatorSummary
	var firstCreator = this.getField('firstCreator');
	if (firstCreator) {
		json.meta.creatorSummary = firstCreator;
	}
	// parsedDate
	var parsedDate = Zotero.Date.multipartToSQL(this.getField('date', true, true));
	if (parsedDate) {
		// 0000?
		json.meta.parsedDate = parsedDate;
	}
	// numChildren
	if (this.isRegularItem()) {
		json.meta.numChildren = this.numChildren();
	}
	return json;
})


//////////////////////////////////////////////////////////////////////////////
//
// Asynchronous load methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Load in the field data from the database
 */
Zotero.Item.prototype.loadItemData = Zotero.Promise.coroutine(function* (reload) {
	Zotero.debug("Loading item data for item " + this.libraryKey);
	
	if (this._loaded.itemData && !reload) {
		return;
	}
	
	if (!this.id) {
		throw ('ItemID not set for object before attempting to load data');
	}
	
	if (!this.isNote()) {
		var sql = "SELECT fieldID, value FROM itemData NATURAL JOIN itemDataValues WHERE itemID=?";
		yield Zotero.DB.queryAsync(
			sql,
			this.id,
			{
				onRow: function (row) {
					this.setField(row.getResultByIndex(0), row.getResultByIndex(1), true);
				}.bind(this)
			}
		);
		
		// Mark nonexistent fields as loaded
		let itemTypeFields = Zotero.ItemFields.getItemTypeFields(this.itemTypeID);
		for (let i=0; i<itemTypeFields.length; i++) {
			let fieldID = itemTypeFields[i];
			if (this._itemData[fieldID] === null) {
				this._itemData[fieldID] = false;
			}
		}
	}
	
	if (this.isNote() || this.isAttachment()) {
		var sql = "SELECT title FROM itemNotes WHERE itemID=?";
		var row = yield Zotero.DB.rowQueryAsync(sql, this.id);
		if (row) {
			let title = row.title;
			this._noteTitle = title !== false ? title : '';
		}
	}
	
	this._loaded.itemData = true;
	this._clearChanged('itemData');
	this.loadDisplayTitle(reload);
});


Zotero.Item.prototype.loadNote = Zotero.Promise.coroutine(function* (reload) {
	Zotero.debug("Loading note data for item " + this.libraryKey);
	
	if (this._loaded.note && !reload) {
		return;
	}
	
	if (!this.isNote() && !this.isAttachment()) {
		throw new Error("Can only load note for note or attachment item");
	}
	
	var sql = "SELECT note FROM itemNotes WHERE itemID=?";
	var row = yield Zotero.DB.rowQueryAsync(sql, this.id);
	if (row) {
		let note = row.note;
		
		// Convert non-HTML notes on-the-fly
		if (note !== "") {
			if (!note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)) {
				note = Zotero.Utilities.htmlSpecialChars(note);
				note = Zotero.Notes.notePrefix + '<p>'
					+ note.replace(/\n/g, '</p><p>')
					.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
					.replace(/  /g, '&nbsp;&nbsp;')
					+ '</p>' + Zotero.Notes.noteSuffix;
				note = note.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
				let sql = "UPDATE itemNotes SET note=? WHERE itemID=?";
				yield Zotero.DB.queryAsync(sql, [note, this.id]);
			}
			
			// Don't include <div> wrapper when returning value
			let startLen = note.substr(0, 36).match(/^<div class="zotero-note znv[0-9]+">/)[0].length;
			let endLen = 6; // "</div>".length
			note = note.substr(startLen, note.length - startLen - endLen);
		}
		
		this._noteText = note ? note : '';
	}
	
	this._loaded.note = true;
	this._clearChanged('note');
});


Zotero.Item.prototype.loadDisplayTitle = Zotero.Promise.coroutine(function* (reload) {
	if (this._displayTitle !== null && !reload) {
		return;
	}
	
	var title = this.getField('title', false, true);
	var itemTypeID = this.itemTypeID;
	var itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
	
	if (title === "" && (itemTypeID == 8 || itemTypeID == 10)) { // 'letter' and 'interview' itemTypeIDs
		yield this.loadCreators();
		var creatorsData = this.getCreators();
		var authors = [];
		var participants = [];
		for (let j=0; j<creatorsData.length; j++) {
			let creatorData = creatorsData[j];
			let creatorTypeID = creatorsData[j].creatorTypeID;
			if ((itemTypeID == 8 && creatorTypeID == 16) || // 'letter'
					(itemTypeID == 10 && creatorTypeID == 7)) { // 'interview'
				participants.push(creatorData);
			}
			else if ((itemTypeID == 8 && creatorTypeID == 1) ||   // 'letter'/'author'
					(itemTypeID == 10 && creatorTypeID == 6)) { // 'interview'/'interviewee'
				authors.push(creatorData);
			}
		}
		
		var strParts = [];
		if (participants.length > 0) {
			let names = [];
			for (let j=0; j<participants.length; j++) {
				names.push(
					participants[j].name !== undefined
						? participants[j].name
						: participants[j].lastName
				);
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
		
		title = '[' + strParts.join('; ') + ']';
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
			
			yield this.loadCreators()
			var creatorData = this.getCreator(0);
			if (creatorData && creatorData.creatorTypeID === 1) { // author
				strParts.push(creatorData.lastName);
			}
			
			title = '[' + strParts.join(', ') + ']';
		}
	}
	
	return this._displayTitle = title;
});


/*
 * Load in the creators from the database
 */
Zotero.Item.prototype.loadCreators = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.creators && !reload) {
		return;
	}
	
	Zotero.debug("Loading creators for item " + this.libraryKey);
	
	if (!this.id) {
		throw new Error('ItemID not set for item before attempting to load creators');
	}
	
	var sql = 'SELECT creatorID, creatorTypeID, orderIndex FROM itemCreators '
		+ 'WHERE itemID=? ORDER BY orderIndex';
	var rows = yield Zotero.DB.queryAsync(sql, this.id);
	
	this._creators = [];
	this._creatorIDs = [];
	this._loaded.creators = true;
	this._clearChanged('creators');
	
	if (!rows) {
		return true;
	}
	
	var maxOrderIndex = -1;
	for (var i=0; i<rows.length; i++) {
		let row = rows[i];
		if (row.orderIndex > maxOrderIndex) {
			maxOrderIndex = row.orderIndex;
		}
		let creatorData = yield Zotero.Creators.getAsync(row.creatorID);
		creatorData.creatorTypeID = row.creatorTypeID;
		this._creators[i] = creatorData;
		this._creatorIDs[i] = row.creatorID;
	}
	if (i <= maxOrderIndex) {
		Zotero.debug("Fixing incorrect creator indexes for item " + this.libraryKey
			+ " (" + i + ", " + maxOrderIndex + ")", 2);
		while (i <= maxOrderIndex) {
			this._changed.creators[i] = true;
			i++;
		}
	}
	
	return true;
});


Zotero.Item.prototype.loadChildItems = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.childItems && !reload) {
		return;
	}
	
	// Attachments
	this._attachments = {
		rows: null,
		chronologicalWithTrashed: null,
		chronologicalWithoutTrashed: null,
		alphabeticalWithTrashed: null,
		alphabeticalWithoutTrashed: null
	};
	var sql = "SELECT A.itemID, value AS title, CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
		+ "FROM itemAttachments A "
		+ "NATURAL JOIN items I "
		+ "LEFT JOIN itemData ID ON (fieldID=110 AND A.itemID=ID.itemID) "
		+ "LEFT JOIN itemDataValues IDV USING (valueID) "
		+ "LEFT JOIN deletedItems DI USING (itemID) "
		+ "WHERE parentItemID=?";
	// Since we do the sort here and cache these results, a restart will be required
	// if this pref (off by default) is turned on, but that's OK
	if (Zotero.Prefs.get('sortAttachmentsChronologically')) {
		sql +=  " ORDER BY dateAdded";
	}
	this._attachments.rows = yield Zotero.DB.queryAsync(sql, this.id);
	
	//
	// Notes
	//
	this._notes = {
		rows: null,
		rowsEmbedded: null,
		chronologicalWithTrashed: null,
		chronologicalWithoutTrashed: null,
		alphabeticalWithTrashed: null,
		alphabeticalWithoutTrashed: null,
		numWithTrashed: null,
		numWithoutTrashed: null,
		numWithTrashedWithEmbedded: null,
		numWithoutTrashedWithoutEmbedded: null
	};
	var sql = "SELECT N.itemID, title, CASE WHEN DI.itemID IS NULL THEN 0 ELSE 1 END AS trashed "
		+ "FROM itemNotes N "
		+ "NATURAL JOIN items I "
		+ "LEFT JOIN deletedItems DI USING (itemID) "
		+ "WHERE parentItemID=?";
	if (Zotero.Prefs.get('sortAttachmentsChronologically')) {
		sql +=  " ORDER BY dateAdded";
	}
	this._notes.rows = yield Zotero.DB.queryAsync(sql, this.id);
	
	this._loaded.childItems = true;
	this._clearChanged('childItems');
});


Zotero.Item.prototype.loadTags = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.tags && !reload) {
		return;
	}
	
	if (!this._id) {
		return;
	}
	var sql = "SELECT tagID AS id, name AS tag, type FROM itemTags "
		+ "JOIN tags USING (tagID) WHERE itemID=?";
	var rows = yield Zotero.DB.queryAsync(sql, this.id);
	
	this._tags = [];
	for (let i=0; i<rows.length; i++) {
		let row = rows[i];
		this._tags.push(Zotero.Tags.cleanData(row));
	}
	
	this._loaded.tags = true;
	this._clearChanged('tags');
});



Zotero.Item.prototype.loadCollections = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.collections && !reload) {
		return;
	}
	if (!this._id) {
		return;
	}
	var sql = "SELECT collectionID FROM collectionItems WHERE itemID=?";
	this._collections = yield Zotero.DB.columnQueryAsync(sql, this.id);
	this._loaded.collections = true;
	this._clearChanged('collections');
});


Zotero.Item.prototype.loadRelations = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.relations && !reload) {
		return;
	}
	
	Zotero.debug("Loading relations for item " + this.libraryKey);
	
	this._requireData('primaryData');
	
	var itemURI = Zotero.URI.getItemURI(this);
	
	var relations = yield Zotero.Relations.getByURIs(itemURI);
	relations = relations.map(function (rel) [rel.predicate, rel.object]);
	
	// Related items are bidirectional, so include any with this item as the object
	var reverseRelations = yield Zotero.Relations.getByURIs(
		false, Zotero.Relations.relatedItemPredicate, itemURI
	);
	for (let i=0; i<reverseRelations.length; i++) {
		let rel = reverseRelations[i];
		relations.push([rel.predicate, rel.subject]);
	}
	
	// Also include any owl:sameAs relations with this item as the object
	reverseRelations = yield Zotero.Relations.getByURIs(
		false, Zotero.Relations.linkedObjectPredicate, itemURI
	);
	for (let i=0; i<reverseRelations.length; i++) {
		let rel = reverseRelations[i];
		relations.push([rel.predicate, rel.subject]);
	}
	
	this._relations = relations;
	this._loaded.relations = true;
	this._clearChanged('relations');
});


//////////////////////////////////////////////////////////////////////////////
//
// Private methods
//
//////////////////////////////////////////////////////////////////////////////
/**
 * Returns related items this item point to
 *
 * @return {String[]} - An array of item keys
 */
Zotero.Item.prototype._getRelatedItems = function () {
	this._requireData('relations');
	
	var predicate = Zotero.Relations.relatedItemPredicate;
	
	var relatedItemURIs = this.getRelations()[predicate];
	if (!relatedItemURIs) {
		return [];
	}
	
	if (typeof relatedItemURIs == 'string') relatedItemURIs = [relatedItemURIs];
	
	// Pull out object values from related-item relations, turn into items, and pull out keys
	var keys = [];
	for (let i=0; i<relatedItemURIs.length; i++) {
		item = Zotero.URI.getURIItem(relatedItemURIs[i]);
		if (item) {
			keys.push(item.key);
		}
	}
	return keys;
}



Zotero.Item.prototype._setRelatedItems = Zotero.Promise.coroutine(function* (itemIDs) {
	if (!this._loaded.relatedItems) {
		yield this._loadRelatedItems();
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
			
			var item = yield Zotero.Items.getAsync(id);
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
		this._relatedItems.push(yield Zotero.Items.getAsync(itemID));
	}
	return true;
});


/**
 * @return {Object} Return a copy of the creators, with additional 'id' properties
 */
Zotero.Item.prototype._getOldCreators = function () {
	var oldCreators = {};
	for (i=0; i<this._creators.length; i++) {
		let old = {};
		for (let field in this._creators[i]) {
			old[field] = this._creators[i][field];
		}
		// Add 'id' property for efficient DB updates
		old.id = this._creatorIDs[i];
		oldCreators[i] = old;
	}
	return oldCreators;
}


Zotero.Item.prototype._disabledCheck = function () {
	if (this._disabled) {
		var msg = "New Zotero.Item objects shouldn't be accessed after save -- use Zotero.Items.get()";
		Zotero.debug(msg, 2);
		Components.utils.reportError(msg);
	}
}
