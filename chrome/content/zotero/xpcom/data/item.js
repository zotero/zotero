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
	
	// loadPrimaryData (additional properties in dataObject.js)
	this._itemTypeID = null;
	this._firstCreator = null;
	this._sortCreator = null;
	this._attachmentCharset = null;
	this._attachmentLinkMode = null;
	this._attachmentContentType = null;
	this._attachmentPath = null;
	this._attachmentSyncState = 0;
	this._attachmentSyncedModificationTime = null;
	this._attachmentSyncedHash = null;
	
	// loadCreators
	this._creators = [];
	this._creatorIDs = [];
	
	// loadItemData
	this._itemData = null;
	this._noteTitle = null;
	this._noteText = null;
	this._displayTitle = null;
	
	// loadChildItems
	this._attachments = null;
	this._notes = null;
	
	this._tags = [];
	this._collections = [];
	
	this._bestAttachmentState = null;
	this._fileExists = null;
	
	this._deleted = null;
	this._hasNote = null;
	
	this._noteAccessTime = null;
	
	if (itemTypeOrID) {
		// setType initializes type-specific properties in this._itemData
		this.setType(Zotero.ItemTypes.getID(itemTypeOrID));
	}
}

Zotero.extendClass(Zotero.DataObject, Zotero.Item);

Zotero.Item.prototype._objectType = 'item';
Zotero.defineProperty(Zotero.Item.prototype, 'ContainerObjectsClass', {
	get: function() { return Zotero.Collections; }
});

Zotero.Item.prototype._dataTypes = Zotero.Item._super.prototype._dataTypes.concat([
	'creators',
	'itemData',
	'note',
	'childItems',
//	'relatedItems', // TODO: remove
	'tags',
	'collections',
	'relations'
]);

Zotero.defineProperty(Zotero.Item.prototype, 'id', {
	get: function() { return this._id; },
	set: function(val) { return this.setField('id', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'itemID', {
	get: function() {
		Zotero.debug("Item.itemID is deprecated -- use Item.id");
		return this._id;
	},
	enumerable: false
});
Zotero.defineProperty(Zotero.Item.prototype, 'libraryID', {
	get: function() { return this._libraryID; },
	set: function(val) { return this.setField('libraryID', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'key', {
	get: function() { return this._key; },
	set: function(val) { return this.setField('key', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'itemTypeID', {
	get: function() { return this._itemTypeID; }
});
Zotero.defineProperty(Zotero.Item.prototype, 'dateAdded', {
	get: function() { return this._dateAdded; },
	set: function(val) { return this.setField('dateAdded', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'dateModified', {
	get: function() { return this._dateModified; },
	set: function(val) { return this.setField('dateModified', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'version', {
	get: function() { return this._version; },
	set: function(val) { return this.setField('version', val); }
});
Zotero.defineProperty(Zotero.Item.prototype, 'synced', {
	get: function() { return this._synced; },
	set: function(val) { return this.setField('synced', val); }
});

// .parentKey and .parentID defined in dataObject.js, but create aliases
Zotero.defineProperty(Zotero.Item.prototype, 'parentItemID', {
	get: function() { return this.parentID; },
	set: function(val) { return this.parentID = val; }
});
Zotero.defineProperty(Zotero.Item.prototype, 'parentItemKey', {
	get: function() { return this.parentKey; },
	set: function(val) { return this.parentKey = val; }
});
Zotero.defineProperty(Zotero.Item.prototype, 'parentItem', {
	get: function() { return Zotero.Items.get(this.parentID) || undefined; },
});


Zotero.defineProperty(Zotero.Item.prototype, 'firstCreator', {
	get: function() { return this._firstCreator; }
});
Zotero.defineProperty(Zotero.Item.prototype, 'sortCreator', {
	get: function() { return this._sortCreator; }
});
Zotero.defineProperty(Zotero.Item.prototype, 'relatedItems', {
	get: function() { return this._getRelatedItems(); }
});

Zotero.defineProperty(Zotero.Item.prototype, 'treeViewID', {
	get: function () {
		return this.id
	}
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
	return this.ObjectsClass.isPrimaryField(fieldName);
}

Zotero.Item.prototype._get = function () {
	throw new Error("_get is not valid for items");
}

Zotero.Item.prototype._set = function () {
	throw new Error("_set is not valid for items");
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
 * Retrieves an itemData field value
 *
 * @param {String|Integer} field fieldID or fieldName
 * @param {Boolean} [unformatted] Skip any special processing of DB value
 *   (e.g. multipart date field)
 * @param {Boolean} includeBaseMapped If true and field is a base field, returns
 *   value of type-specific field instead
 *   (e.g. 'label' for 'publisher' in 'audioRecording')
 * @return {String} Value as string or empty string if value is not present
 */
Zotero.Item.prototype.getField = function(field, unformatted, includeBaseMapped) {
	if (field != 'id') this._disabledCheck();
	
	//Zotero.debug('Requesting field ' + field + ' for item ' + this._id, 4);
	
	this._requireData('primaryData');
	
	// TODO: Add sortCreator
	if (field === 'firstCreator' && !this._id) {
		// Hack to get a firstCreator for an unsaved item
		let creatorsData = this.getCreators(true);
		return Zotero.Items.getFirstCreatorFromData(this.itemTypeID, creatorsData);
	} else if (field === 'id' || this.ObjectsClass.isPrimaryField(field)) {
		var privField = '_' + field;
		//Zotero.debug('Returning ' + (this[privField] ? this[privField] : '') + ' (typeof ' + typeof this[privField] + ')');
		return this[privField];
	} else if (field == 'year') {
		return this.getField('date', true, true).substr(0,4);
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
	
	// If the item is identified (has an id or key), this field has to be populated
	if (this._identified && value === null && !this._loaded.itemData) {
		throw new Zotero.Exception.UnloadedDataException(
			"Item data not loaded and field '" + field + "' not set for item " +  this.libraryKey,
			"itemData"
		);
	}
	
	value = (value !== null && value !== false) ? value : '';
	
	if (!unformatted) {
		// Multipart date fields
		if (Zotero.ItemFields.isDate(fieldID)) {
			value = Zotero.Date.multipartToStr(value);
		}
	}
	//Zotero.debug('Returning ' + value);
	return value;
}


Zotero.Item.prototype.getExtraField = function (fieldName) {
	var { fields } = Zotero.Utilities.Internal.extractExtraFields(this.getField('extra'));
	return fields.get(fieldName) || '';
};


/**
 * @param	{Boolean}				asNames
 * @return	{Integer[]|String[]}
 */
Zotero.Item.prototype.getUsedFields = function(asNames) {
	this._requireData('itemData');
	
	return Object.keys(this._itemData)
		.filter(id => this._itemData[id] !== false && this._itemData[id] !== null)
		.map(id => asNames ? Zotero.ItemFields.getName(id) : parseInt(id));
};



/*
 * Populate basic item data from a database row
 */
Zotero.Item.prototype.loadFromRow = function(row, reload) {
	// If necessary or reloading, set the type and reinitialize this._itemData
	if (reload || (!this._itemTypeID && row.itemTypeID)) {
		this.setType(row.itemTypeID, true);
	}
	
	this._parseRowData(row);
	this._finalizeLoadFromRow(row);
}

Zotero.Item.prototype._parseRowData = function(row) {
	var primaryFields = this.ObjectsClass.primaryFields;
	for (let i=0; i<primaryFields.length; i++) {
		let col = primaryFields[i];
		
		try {
			var val = row[col];
		}
		catch (e) {
			Zotero.debug('Skipping missing field ' + col);
			continue;
		}
		
		//Zotero.debug("Setting field '" + col + "' to '" + val + "' for item " + this.id);
		
		switch (col) {
			// Unchanged
			case 'libraryID':
			case 'itemTypeID':
			case 'attachmentSyncState':
			case 'attachmentSyncedHash':
			case 'attachmentSyncedModificationTime':
				break;
			
			case 'itemID':
				col = 'id';
				break;
			
			// Integer or 0
			case 'version':
				val = val ? parseInt(val) : 0;
				break;
			
			// Value or false
			case 'parentKey':
				val = val || false;
				break;
			
			// Integer or false if falsy
			case 'parentID':
				val = val ? parseInt(val) : false;
				break;
			
			case 'attachmentLinkMode':
				val = val !== null
					? parseInt(val)
					// Shouldn't happen
					: Zotero.Attachments.LINK_MODE_IMPORTED_URL;
				break;
			
			case 'attachmentPath':
				// Ignore .zotero* files that were relinked before we started blocking them
				if (!val || val.startsWith('.zotero')) {
					val = '';
				}
				break;
			
			// Boolean
			case 'synced':
			case 'deleted':
			case 'inPublications':
				val = !!val;
				break;
				
			default:
				val = val ? val : '';
		}
		
		this['_' + col] = val;
	}
}

Zotero.Item.prototype._finalizeLoadFromRow = function(row) {
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	this._clearChanged('attachmentData');
	this._identified = true;
}


/*
 * Set or change the item's type
 */
Zotero.Item.prototype.setType = function(itemTypeID, loadIn) {
	if (itemTypeID == this._itemTypeID) {
		return true;
	}
	
	// Adjust 'note' data type based on whether the item is an attachment or note
	var isAttachment = Zotero.ItemTypes.getID('attachment') == itemTypeID;
	var isNote = Zotero.ItemTypes.getID('note') == itemTypeID;
	this._skipDataTypeLoad.note = !(isAttachment || isNote);
	
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
			
			for (let oldFieldID of obsoleteFields) {
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
		if (creators.length) {
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
	for (let fieldID of fields) {
		this._itemData[fieldID] = null;
	}
	
	// DEBUG: clear change item data?
	
	if (copiedFields) {
		for (let f of copiedFields) {
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
	this._disabledCheck();
	
	if (value === undefined) {
		throw new Error(`'${field}' value cannot be undefined`);
	}
	
	// Normalize values
	if (typeof value == 'number') {
		value = "" + value;
	}
	else if (typeof value == 'string') {
		value = value.trim().normalize();
	}
	if (value === "" || value === null || value === false) {
		value = false;
	}
	
	//Zotero.debug("Setting field '" + field + "' to '" + value + "' (loadIn: " + (loadIn ? 'true' : 'false') + ") for item " + this.id + " ");
	
	if (!field) {
		throw new Error("Field not specified");
	}
	
	if (field == 'id' || field == 'libraryID' || field == 'key') {
		return this._setIdentifier(field, value);
	}
	
	// Primary field
	if (this.ObjectsClass.isPrimaryField(field)) {
		this._requireData('primaryData');
		
		if (loadIn) {
			throw new Error('Cannot set primary field ' + field + ' in loadIn mode in Zotero.Item.setField()');
		}
		
		switch (field) {
			case 'itemTypeID':
				break;
			
			case 'dateAdded':
			case 'dateModified':
				// Accept ISO dates
				if (Zotero.Date.isISODate(value)) {
					let d = Zotero.Date.isoToDate(value);
					value = Zotero.Date.dateToSQL(d, true);
				}
				
				// Make sure it's valid
				let date = Zotero.Date.sqlToDate(value, true);
				if (!date) throw new Error("Invalid SQL date: " + value);
				
				value = Zotero.Date.dateToSQL(date, true);
				break;
			
			case 'version':
				value = parseInt(value);
				break;
			
			case 'synced':
				value = !!value;
				break;
			
			default:
				throw new Error('Primary field ' + field + ' cannot be changed in Zotero.Item.setField()');
			
		}
		
		/*
		if (!Zotero.ItemFields.validate(field, value)) {
			throw("Value '" + value + "' of type " + typeof value + " does not validate for field '" + field + "' in Zotero.Item.setField()");
		}
		*/
		
		// If field value has changed
		if (this['_' + field] === value) {
			if (field == 'synced') {
				Zotero.debug("Setting synced to " + value);
			}
			else {
				Zotero.debug("Field '" + field + "' has not changed", 4);
				return false;
			}
		}
		else {
			Zotero.debug("Field '" + field + "' has changed from '" + this['_' + field] + "' to '" + value + "'", 4);
		}
		
		// Save a copy of the field before modifying
		this._markFieldChange(field, this['_' + field]);
		
		if (field == 'itemTypeID') {
			this.setType(value, loadIn);
		}
		else {
			
			this['_' + field] = value;
			
			if (!this._changed.primaryData) {
				this._changed.primaryData = {};
			}
			this._changed.primaryData[field] = true;
		}
		return true;
	}
	
	if (!loadIn) {
		this._requireData('itemData');
	}
	
	let itemTypeID = this.itemTypeID;
	if (!itemTypeID) {
		throw new Error('Item type must be set before setting field data');
	}
	
	var fieldID = Zotero.ItemFields.getID(field);
	if (!fieldID) {
		throw new Error('"' + field + '" is not a valid itemData field');
	}
	
	if (loadIn && this.isNote() && field == Zotero.ItemFields.getID('title')) {
		this._noteTitle = value ? value : "";
		return true;
	}
	
	// Make sure to use type-specific field ID if available
	fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID) || fieldID;
	
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
	
	if (fieldID == Zotero.ItemFields.getID('ISBN')) {
		// Hyphenate ISBNs, but only if everything is in expected format and valid
		let isbns = ('' + value).trim().split(/\s*[,;]\s*|\s+/),
			newISBNs = '',
			failed = false;
		for (let i=0; i<isbns.length; i++) {
			let isbn = Zotero.Utilities.Internal.hyphenateISBN(isbns[i]);
			if (!isbn) {
				failed = true;
				break;
			}
			
			newISBNs += ' ' + isbn;
		}
		
		if (!failed) value = newISBNs.substr(1);
	}
	
	if (!loadIn) {
		// Save date field as multipart date
		if (value !== false
				&& (Zotero.ItemFields.isDate(fieldID))
				&& !Zotero.Date.isMultipart(value)) {
			value = Zotero.Date.strToMultipart(value);
		}
		// Validate access date
		else if (fieldID == Zotero.ItemFields.getID('accessDate')) {
			if (value && value != 'CURRENT_TIMESTAMP') {
				// Accept ISO dates
				if (Zotero.Date.isISODate(value) && !Zotero.Date.isSQLDate(value)) {
					let d = Zotero.Date.isoToDate(value);
					value = Zotero.Date.dateToSQL(d, true);
				}
				
				if (!Zotero.Date.isSQLDate(value) && !Zotero.Date.isSQLDateTime(value)) {
					Zotero.logError(`Discarding invalid ${Zotero.ItemFields.getName(field)} '${value}' `
						+ `for item ${this.libraryKey} in setField()`);
					return false;
				}
			}
		}
		
		// If existing value, make sure it's actually changing
		if ((this._itemData[fieldID] === null && value === false)
				|| (this._itemData[fieldID] !== null && this._itemData[fieldID] === value)) {
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


/**
 * Update the generated display title from the loaded data
 */
Zotero.Item.prototype.updateDisplayTitle = function () {
	var title = this.getField('title', false, true);
	var itemTypeID = this.itemTypeID;
	var itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
	
	var itemTypeLetter = Zotero.ItemTypes.getID('letter');
	var itemTypeInterview = Zotero.ItemTypes.getID('interview');
	var itemTypeCase = Zotero.ItemTypes.getID('case');
	
	var creatorTypeAuthor = Zotero.CreatorTypes.getID('author');
	var creatorTypeRecipient = Zotero.CreatorTypes.getID('recipient');
	var creatorTypeInterviewer = Zotero.CreatorTypes.getID('interviewer');
	var creatorTypeInterviewee = Zotero.CreatorTypes.getID('interviewee');
	
	// 'letter' and 'interview'
	if (title === "" && (itemTypeID == itemTypeLetter || itemTypeID == itemTypeInterview)) {
		var creatorsData = this.getCreators();
		var authors = [];
		var participants = [];
		for (let i=0; i<creatorsData.length; i++) {
			let creatorData = creatorsData[i];
			let creatorTypeID = creatorsData[i].creatorTypeID;
			if ((itemTypeID == itemTypeLetter && creatorTypeID == creatorTypeRecipient) ||
					(itemTypeID == itemTypeInterview && creatorTypeID == creatorTypeInterviewer)) {
				participants.push(creatorData);
			}
			else if ((itemTypeID == itemTypeLetter && creatorTypeID == creatorTypeAuthor) ||
					(itemTypeID == itemTypeInterview && creatorTypeID == creatorTypeInterviewee)) {
				authors.push(creatorData);
			}
		}
		
		var strParts = [];
		if (participants.length > 0) {
			let names = [];
			let max = Math.min(4, participants.length);
			for (let i=0; i<max; i++) {
				names.push(
					participants[i].name !== undefined
						? participants[i].name
						: participants[i].lastName
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
	// 'case'
	else if (itemTypeID == itemTypeCase) {
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
			
			var creatorData = this.getCreator(0);
			if (creatorData && creatorData.creatorTypeID === creatorTypeAuthor) {
				strParts.push(creatorData.lastName);
			}
			
			title = '[' + strParts.join(', ') + ']';
		}
	}
	
	this._displayTitle = title;
};


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
	return this._creators.map(data => Zotero.Creators.internalToJSON(data));
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
 * @param {Object} [options]
 * @param {Boolean} [options.strict] - Throw on invalid creator type
 */
Zotero.Item.prototype.setCreator = function (orderIndex, data, options = {}) {
	var itemTypeID = this._itemTypeID;
	if (!itemTypeID) {
		throw new Error('Item type must be set before setting creators');
	}
	
	this._requireData('creators');
	
	var origCreatorType = data.creatorType;
	data = Zotero.Creators.cleanData(data, options);
	
	if (data.creatorTypeID === undefined) {
		throw new Error("Creator data must include a valid 'creatorType' or 'creatorTypeID' property");
	}
	
	// If creatorTypeID isn't valid for this type, use the primary type
	if (!data.creatorTypeID || !Zotero.CreatorTypes.isValidForItemType(data.creatorTypeID, itemTypeID)) {
		let itemType = Zotero.ItemTypes.getName(itemTypeID);
		if (options.strict) {
			let e = new Error(`Invalid creator type '${origCreatorType}' for type ${itemType}`);
			e.name = "ZoteroInvalidDataError";
			throw e;
		}
		let msg = `Creator type '${origCreatorType}' isn't valid for ${itemType} -- `
			+ "changing to primary creator";
		Zotero.warn(msg);
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
Zotero.Item.prototype.setCreators = function (data, options = {}) {
	// If empty array, clear all existing creators
	if (!data.length) {
		while (this.hasCreatorAt(0)) {
			this.removeCreator(0);
		}
		return;
	}
	
	for (let i = 0; i < data.length; i++) {
		this.setCreator(i, data[i], options);
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


// Define boolean properties
for (let name of ['deleted', 'inPublications']) {
	let prop = '_' + name;
	Zotero.defineProperty(Zotero.Item.prototype, name, {
		get: function() {
			if (!this.id) {
				return false;
			}
			if (this[prop] !== null) {
				return this[prop];
			}
			this._requireData('primaryData');
		},
		set: function(val) {
			val = !!val;
			
			if (this[prop] == val) {
				Zotero.debug(Zotero.Utilities.capitalize(name)
					+ " state hasn't changed for item " + this.id);
				return;
			}
			this._markFieldChange(name, !!this[prop]);
			this._changed[name] = true;
			this[prop] = val;
		}
	});
}


/**
 * Relate this item to another. A separate save is required.
 *
 * @param {Zotero.Item}
 * @return {Boolean}
 */
Zotero.Item.prototype.addRelatedItem = function (item) {
	if (!(item instanceof Zotero.Item)) {
		throw new Error("'item' must be a Zotero.Item");
	}
	
	if (item == this) {
		Zotero.debug("Can't relate item to itself in Zotero.Item.addRelatedItem()", 2);
		return false;
	}
	
	if (!this.libraryID) {
		this.libraryID = Zotero.Libraries.userLibraryID;
	}
	
	if (item.libraryID != this.libraryID) {
		throw new Error("Cannot relate item to an item in a different library");
	}
	
	return this.addRelation(Zotero.Relations.relatedItemPredicate, Zotero.URI.getItemURI(item));
}


/**
 * @param {Zotero.Item}
 */
Zotero.Item.prototype.removeRelatedItem = Zotero.Promise.coroutine(function* (item) {
	if (!(item instanceof Zotero.Item)) {
		throw new Error("'item' must be a Zotero.Item");
	}
	
	return this.removeRelation(Zotero.Relations.relatedItemPredicate, Zotero.URI.getItemURI(item));
});


Zotero.Item.prototype.isEditable = function() {
	var editable = Zotero.Item._super.prototype.isEditable.apply(this);
	if (!editable) return false;
	
	// Check if we're allowed to save attachments
	if (this.isAttachment()
		&& (this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
		&& !Zotero.Libraries.get(this.libraryID).filesEditable
	) {
		return false;
	}
	
	return true;
}

Zotero.Item.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	if (!this.itemTypeID) {
		throw new Error("Item type must be set before saving");
	}
	return Zotero.Item._super.prototype._initSave.apply(this, arguments);
})

Zotero.Item.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	Zotero.DB.requireTransaction();
	
	var isNew = env.isNew;
	var options = env.options;
	var libraryType = env.libraryType = Zotero.Libraries.get(env.libraryID).libraryType;
	
	var itemTypeID = this.itemTypeID;
	
	var reloadParentChildItems = {};
	
	//
	// Primary fields
	//
	// If available id value, use it -- otherwise we'll use autoincrement
	var itemID = this._id = this.id ? this.id : Zotero.ID.get('items');
	
	if (this._changed.primaryData && this._changed.primaryData.itemTypeID) {
		env.sqlColumns.push('itemTypeID');
		env.sqlValues.push({ int: itemTypeID });
	}
	
	if (isNew || (this._changed.primaryData && this._changed.primaryData.dateAdded)) {
		env.sqlColumns.push('dateAdded');
		env.sqlValues.push(this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime);
	}
	
	// If a new item and Date Modified hasn't been provided, or an existing item and
	// Date Modified hasn't changed from its previous value and skipDateModifiedUpdate wasn't
	// passed, use the current timestamp
	if (!this.dateModified
			|| ((!this._changed.primaryData || !this._changed.primaryData.dateModified)
				&& !options.skipDateModifiedUpdate)) {
		env.sqlColumns.push('dateModified');
		env.sqlValues.push(Zotero.DB.transactionDateTime);
	}
	// Otherwise, if a new Date Modified was provided, use that. (This would also work when
	// skipDateModifiedUpdate was passed and there's an existing value, but in that case we
	// can just not change the field at all.)
	else if (this._changed.primaryData && this._changed.primaryData.dateModified) {
		env.sqlColumns.push('dateModified');
		env.sqlValues.push(this.dateModified);
	}
	
	if (env.sqlColumns.length) {
		if (isNew) {
			env.sqlColumns.unshift('itemID');
			env.sqlValues.unshift(parseInt(itemID));
			
			let sql = "INSERT INTO items (" + env.sqlColumns.join(", ") + ") "
				+ "VALUES (" + env.sqlValues.map(() => "?").join() + ")";
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
			
			if (!env.options.skipNotifier) {
				Zotero.Notifier.queue('add', 'item', itemID, env.notifierData, env.options.notifierQueue);
			}
		}
		else {
			let sql = "UPDATE items SET " + env.sqlColumns.join("=?, ") + "=? WHERE itemID=?";
			env.sqlValues.push(parseInt(itemID));
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
			
			if (!env.options.skipNotifier) {
				Zotero.Notifier.queue('modify', 'item', itemID, env.notifierData, env.options.notifierQueue);
			}
		}
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
			if (value === '') {
				del.push(fieldID);
				continue;
			}
			
			if (Zotero.ItemFields.getID('accessDate') == fieldID
					&& (this.getField(fieldID)) == 'CURRENT_TIMESTAMP') {
				value = Zotero.DB.transactionDateTime;
			}
			
			let valueID = yield Zotero.DB.valueQueryAsync(valueSQL, [value], { debug: true })
			if (!valueID) {
				valueID = Zotero.ID.get('itemDataValues');
				yield Zotero.DB.queryAsync(insertValueSQL, [valueID, value], { debug: false });
			}
			
			yield Zotero.DB.queryAsync(replaceSQL, [itemID, fieldID, valueID], { debug: false });
		}
		
		// Delete blank fields
		if (del.length) {
			sql = 'DELETE from itemData WHERE itemID=? AND '
				+ 'fieldID IN (' + del.map(() => '?').join() + ')';
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
			
			let previousCreatorID = !isNew && this._previousData.creators[orderIndex]
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
	
	// Parent item (DB update is done below after collection removals)
	var parentItemKey = this.parentKey;
	var parentItemID = parentItemKey
		? (this.ObjectsClass.getIDFromLibraryAndKey(this.libraryID, parentItemKey) || null)
		: null;
	if (this._changed.parentKey) {
		if (isNew) {
			if (!parentItemID) {
				// TODO: clear caches?
				let msg = "Parent item " + this.libraryID + "/" + parentItemKey + " not found";
				let e = new Error(msg);
				e.name = "ZoteroMissingObjectError";
				throw e;
			}
			
			let newParentItemNotifierData = {};
			//newParentItemNotifierData[newParentItem.id] = {};
			if (!env.options.skipNotifier) {
				Zotero.Notifier.queue(
					'modify', 'item', parentItemID, newParentItemNotifierData, env.options.notifierQueue
				);
			}
			
			switch (Zotero.ItemTypes.getName(itemTypeID)) {
				case 'note':
				case 'attachment':
					reloadParentChildItems[parentItemID] = true;
					break;
			}
		}
		else {
			if (parentItemKey) {
				if (!parentItemID) {
					// TODO: clear caches
					let msg = "Parent item " + this.libraryID + "/" + parentItemKey + " not found";
					let e = new Error(msg);
					e.name = "ZoteroMissingObjectError";
					throw e;
				}
				
				let newParentItemNotifierData = {};
				//newParentItemNotifierData[newParentItem.id] = {};
				if (!env.options.skipNotifier) {
					Zotero.Notifier.queue(
						'modify',
						'item',
						parentItemID,
						newParentItemNotifierData,
						env.options.notifierQueue
					);
				}
			}
			
			let oldParentKey = this._previousData.parentKey;
			let oldParentItemID;
			if (oldParentKey) {
				oldParentItemID = this.ObjectsClass.getIDFromLibraryAndKey(this.libraryID, oldParentKey);
				if (oldParentItemID) {
					let oldParentItemNotifierData = {};
					//oldParentItemNotifierData[oldParentItemID] = {};
					if (!env.options.skipNotifier) {
						Zotero.Notifier.queue(
							'modify',
							'item',
							oldParentItemID,
							oldParentItemNotifierData,
							env.options.notifierQueue
						);
					}
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
				if (changedCollections.length) {
					let parentItem = yield this.ObjectsClass.getByLibraryAndKeyAsync(
						this.libraryID, parentItemKey
					);
					for (let i=0; i<changedCollections.length; i++) {
						parentItem.addToCollection(changedCollections[i]);
						this.removeFromCollection(changedCollections[i]);
						
						if (!env.options.skipNotifier) {
							Zotero.Notifier.queue(
								'remove',
								'collection-item',
								changedCollections[i] + '-' + this.id,
								{},
								env.options.notifierQueue
							);
						}
					}
					yield parentItem.save({
						skipDateModifiedUpdate: true,
						skipEditCheck: env.options.skipEditCheck
					});
				}
			}
			
			// Update the counts of the previous and new sources
			if (oldParentItemID) {
				reloadParentChildItems[oldParentItemID] = true;
			}
			if (parentItemID) {
				reloadParentChildItems[parentItemID] = true;
			}
		}
	}
	
	if (this._inPublications) {
		if (!this.isRegularItem() && !parentItemID) {
			throw new Error("Top-level attachments and notes cannot be added to My Publications");
		}
		if (this.isAttachment() && this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			throw new Error("Linked-file attachments cannot be added to My Publications");
		}
		if (Zotero.Libraries.get(this.libraryID).libraryType != 'user') {
			throw new Error("Only items in user libraries can be added to My Publications");
		}
	}
	
	// Trashed status
	if (this._changed.deleted) {
		if (this._deleted) {
			sql = "REPLACE INTO deletedItems (itemID) VALUES (?)";
		}
		else {
			// If undeleting, remove any merge-tracking relations
			let predicate = Zotero.Relations.replacedItemPredicate;
			let thisURI = Zotero.URI.getItemURI(this);
			let mergeItems = Zotero.Relations.getByPredicateAndObject(
				'item', predicate, thisURI
			);
			for (let mergeItem of mergeItems) {
				// An item shouldn't have itself as a dc:replaces relation, but if it does it causes an
				// infinite loop
				if (mergeItem.id == this.id) {
					Zotero.logError(`Item ${this.libraryKey} has itself as a ${predicate} relation`);
					this.removeRelation(predicate, thisURI);
					continue;
				}
				
				mergeItem.removeRelation(predicate, thisURI);
				yield mergeItem.save({
					skipDateModifiedUpdate: true,
					skipEditCheck: env.options.skipEditCheck
				});
			}
			
			sql = "DELETE FROM deletedItems WHERE itemID=?";
		}
		yield Zotero.DB.queryAsync(sql, itemID);
		
		// Refresh trash
		if (!env.options.skipNotifier) {
			Zotero.Notifier.queue('refresh', 'trash', this.libraryID, {}, env.options.notifierQueue);
			if (this._deleted) {
				Zotero.Notifier.queue('trash', 'item', this.id, {}, env.options.notifierQueue);
			}
		}
		
		if (parentItemID) {
			reloadParentChildItems[parentItemID] = true;
		}
	}
	
	if (this._changed.inPublications) {
		if (this._inPublications) {
			sql = "INSERT OR IGNORE INTO publicationsItems (itemID) VALUES (?)";
		}
		else {
			sql = "DELETE FROM publicationsItems WHERE itemID=?";
		}
		yield Zotero.DB.queryAsync(sql, itemID);
	}
	
	// Collections
	//
	// Only diffing and removal are done here. Additions have to be done below after parentItemID has
	// been updated in itemAttachments/itemNotes, since a child item that was made a standalone item and
	// added to a collection can't be added to the collection while it still has a parent, and vice
	// versa, due to the trigger checks on collectionItems/itemAttachments/itemNotes.
	if (this._changed.collections) {
		if (libraryType == 'publications') {
			throw new Error("Items in My Publications cannot be added to collections");
		}
		
		let oldCollections = this._previousData.collections || [];
		let newCollections = this._collections;
		
		let toAdd = Zotero.Utilities.arrayDiff(newCollections, oldCollections);
		let toRemove = Zotero.Utilities.arrayDiff(oldCollections, newCollections);
		
		env.collectionsAdded = toAdd;
		env.collectionsRemoved = toRemove;
		
		if (toRemove.length) {
			let sql = "DELETE FROM collectionItems WHERE itemID=? AND collectionID IN ("
				+ toRemove.join(',')
				+ ")";
			yield Zotero.DB.queryAsync(sql, this.id);
			
			for (let i=0; i<toRemove.length; i++) {
				let collectionID = toRemove[i];
				
				if (!env.options.skipNotifier) {
					Zotero.Notifier.queue(
						'remove',
						'collection-item',
						collectionID + '-' + this.id,
						{},
						env.options.notifierQueue
					);
				}
			}
			
			// Remove this item from any loaded collections' cached item lists after commit
			Zotero.DB.addCurrentCallback("commit", function () {
				for (let i = 0; i < toRemove.length; i++) {
					this.ContainerObjectsClass.unregisterChildItem(toRemove[i], this.id);
				}
			}.bind(this));
		}
	}
	
	// Add parent item for existing item, if note or attachment data isn't going to be updated below
	//
	// Technically this doesn't have to go below collection removals, but only because the
	// 'collectionitem must be top level' trigger check applies only to INSERTs, not UPDATEs, which was
	// probably done in an earlier attempt to solve this problem.
	if (!isNew && this._changed.parentKey && !this._changed.note && !this._changed.attachmentData) {
		let type = Zotero.ItemTypes.getName(itemTypeID);
		let Type = type[0].toUpperCase() + type.substr(1);
		let sql = "UPDATE item" + Type + "s SET parentItemID=? WHERE itemID=?";
		yield Zotero.DB.queryAsync(sql, [parentItemID, this.id]);
	}
	
	// There's no reload for parentKey, so clear it here
	if (this._changed.parentKey) {
		this._clearChanged('parentKey');
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
			noteText = Zotero.Notes.notePrefix + noteText + Zotero.Notes.noteSuffix;
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
		
		if (parentItemID) {
			reloadParentChildItems[parentItemID] = true;
		}
	}
	
	//
	// Attachment
	//
	if (!isNew) {
		// If attachment title changes, update parent attachments
		if (this._changed.itemData && this._changed.itemData[110] && this.isAttachment() && parentItemID) {
			reloadParentChildItems[parentItemID] = true;
		}
	}
	if (this._changed.attachmentData) {
		let sql = "REPLACE INTO itemAttachments "
			+ "(itemID, parentItemID, linkMode, contentType, charsetID, path, "
				+ "syncState, storageModTime, storageHash) "
			+ "VALUES (?,?,?,?,?,?,?,?,?)";
		let linkMode = this.attachmentLinkMode;
		let contentType = this.attachmentContentType;
		let charsetID = this.attachmentCharset
			? Zotero.CharacterSets.getID(this.attachmentCharset)
			: null;
		let path = this.attachmentPath;
		let syncState = this.attachmentSyncState;
		let storageModTime = this.attachmentSyncedModificationTime;
		let storageHash = this.attachmentSyncedHash;
		
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE && libraryType != 'user') {
			throw new Error("Linked files can only be added to user library");
		}
		
		let params = [
			itemID,
			parentItemID,
			{ int: linkMode },
			contentType ? { string: contentType } : null,
			charsetID ? { int: charsetID } : null,
			path ? { string: path } : null,
			syncState !== undefined ? syncState : 0,
			storageModTime !== undefined ? storageModTime : null,
			storageHash || null
		];
		yield Zotero.DB.queryAsync(sql, params);
		
		// Clear cached child attachments of the parent
		if (!isNew && parentItemID) {
			reloadParentChildItems[parentItemID] = true;
		}
	}
	
	// Add to new collections
	if (env.collectionsAdded) {
		let toAdd = env.collectionsAdded;
		for (let i=0; i<toAdd.length; i++) {
			let collectionID = toAdd[i];
			
			let sql = "SELECT IFNULL(MAX(orderIndex)+1, 0) FROM collectionItems "
				+ "WHERE collectionID=?";
			let orderIndex = yield Zotero.DB.valueQueryAsync(sql, collectionID);
			
			sql = "INSERT OR IGNORE INTO collectionItems "
				+ "(collectionID, itemID, orderIndex) VALUES (?, ?, ?)";
			yield Zotero.DB.queryAsync(sql, [collectionID, this.id, orderIndex]);
			
			if (!env.options.skipNotifier) {
				Zotero.Notifier.queue(
					'add',
					'collection-item',
					collectionID + '-' + this.id,
					{},
					env.options.notifierQueue
				);
			}
		}
		
		// Add this item to any loaded collections' cached item lists after commit
		Zotero.DB.addCurrentCallback("commit", function () {
			for (let i = 0; i < toAdd.length; i++) {
				this.ContainerObjectsClass.registerChildItem(toAdd[i], this.id);
			}
		}.bind(this));
	}
	
	// Tags
	if (this._changedData.tags) {
		let oldTags = this._tags;
		let newTags = this._changedData.tags;
		this._clearChanged('tags');
		this._markForReload('tags');
		
		// Convert to individual JSON objects, diff, and convert back
		let oldTagsJSON = oldTags.map(x => JSON.stringify(x));
		let newTagsJSON = newTags.map(x => JSON.stringify(x));
		
		let toAdd = Zotero.Utilities.arrayDiff(newTagsJSON, oldTagsJSON).map(x => JSON.parse(x));
		let toRemove = Zotero.Utilities.arrayDiff(oldTagsJSON, newTagsJSON).map(x => JSON.parse(x));
		
		for (let i=0; i<toAdd.length; i++) {
			let tag = toAdd[i];
			let tagID = yield Zotero.Tags.create(tag.tag);
			let tagType = tag.type ? tag.type : 0;
			// "OR REPLACE" allows changing type
			let sql = "INSERT OR REPLACE INTO itemTags (itemID, tagID, type) VALUES (?, ?, ?)";
			yield Zotero.DB.queryAsync(sql, [this.id, tagID, tagType]);
			
			let notifierData = {};
			notifierData[this.id + '-' + tagID] = {
				libraryID: this.libraryID,
				tag: tag.tag,
				type: tagType
			};
			if (!env.options.skipNotifier) {
				Zotero.Notifier.queue(
					'add', 'item-tag', this.id + '-' + tagID, notifierData, env.options.notifierQueue
				);
			}
		}
		
		if (toRemove.length) {
			for (let i=0; i<toRemove.length; i++) {
				let tag = toRemove[i];
				let tagID = Zotero.Tags.getID(tag.tag);
				let tagType = tag.type ? tag.type : 0;
				let sql = "DELETE FROM itemTags WHERE itemID=? AND tagID=? AND type=?";
				yield Zotero.DB.queryAsync(sql, [this.id, tagID, tagType]);
				let notifierData = {};
				notifierData[this.id + '-' + tagID] = {
					libraryID: this.libraryID,
					tag: tag.tag,
					type: tagType
				};

				if (!env.options.skipNotifier) {
					Zotero.Notifier.queue(
						'remove', 'item-tag', this.id + '-' + tagID, notifierData, env.options.notifierQueue
					);
				}
			}
			Zotero.Prefs.set('purge.tags', true);
		}
	}
	
	// Update child item counts and contents
	if (reloadParentChildItems) {
		for (let parentItemID in reloadParentChildItems) {
			// Keep in sync with Zotero.Items.trash()
			let parentItem = yield this.ObjectsClass.getAsync(parseInt(parentItemID));
			yield parentItem.reload(['primaryData', 'childItems'], true);
			parentItem.clearBestAttachmentState();
		}
	}
	
	Zotero.DB.requireTransaction();
});

Zotero.Item.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	if (!env.skipCache) {
		// Always reload primary data. DataObject.reload() only reloads changed data types, so
		// it won't reload, say, dateModified and firstCreator if only creator data was changed
		// and not primaryData.
		yield this.loadPrimaryData(true);
		yield this.reload();
		// If new, there's no other data we don't have, so we can mark everything as loaded
		if (env.isNew) {
			this._markAllDataTypeLoadStates(true);
		}
	}
	
	return env.isNew ? this.id : true;
});


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
	this._requireData('childItems');
	var notes = Zotero.Items.get(this.getNotes(includeTrashed));
	var num = notes.length;
	if (includeEmbedded) {
		// Include embedded attachment notes that aren't empty
		num += Zotero.Items.get(this.getAttachments(includeTrashed))
			.filter(x => x.getNote() !== '').length;
	}
	return num;
}


/**
 * Get the first line of the note for display in the items list
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
		throw new Error("getNote() can only be called on notes and attachments "
			+ `(${this.libraryID}/${this.key} is a ${Zotero.ItemTypes.getName(this.itemTypeID)})`);
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
	if (this.isNote()) {
		this._displayTitle = this._noteTitle;
	}
	
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
	
	if (!this._notes) {
		return [];
	}
	
	var sortChronologically = Zotero.Prefs.get('sortNotesChronologically');
	var cacheKey = (sortChronologically ? "chronological" : "alphabetical")
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	
	if (this._notes[cacheKey]) {
		return [...this._notes[cacheKey]];
	}
	
	var rows = this._notes.rows.concat();
	// Remove trashed items if necessary
	if (!includeTrashed) {
		rows = rows.filter(row => !row.trashed);
	}
	// Sort by title if necessary
	if (!sortChronologically) {
		var collation = Zotero.getLocaleCollation();
		rows.sort((a, b) => {
			var aTitle = this.ObjectsClass.getSortTitle(a.title);
			var bTitle = this.ObjectsClass.getSortTitle(b.title);
			return collation.compareString(1, aTitle, bTitle);
		});
	}
	var ids = rows.map(row => row.itemID);
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
 * @return {Boolean}
 */
Zotero.Item.prototype.isFileAttachment = function() {
	if (!this.isAttachment()) {
		return false;
	}
	return this.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL;
}


/**
 * @return {Boolean}
 */
Zotero.Item.prototype.isLinkedFileAttachment = function() {
	return this.isAttachment() && this.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE;
}


/**
 * Returns number of child attachments of item
 *
 * @param	{Boolean}	includeTrashed		Include trashed child items in count
 * @return	<Integer>
 */
Zotero.Item.prototype.numAttachments = function (includeTrashed) {
	this._requireData('childItems');
	return this.getAttachments(includeTrashed).length;
}


Zotero.Item.prototype.numNonHTMLFileAttachments = function () {
	this._requireData('childItems');
	return this.getAttachments()
		.map(itemID => Zotero.Items.get(itemID))
		.filter(item => item.isFileAttachment() && item.attachmentContentType != 'text/html')
		.length;
};


Zotero.Item.prototype.numPDFAttachments = function () {
	this._requireData('childItems');
	return this.getAttachments()
		.map(itemID => Zotero.Items.get(itemID))
		.filter(item => item.isFileAttachment() && item.attachmentContentType == 'application/pdf')
		.length;
};


Zotero.Item.prototype.getFile = function () {
	Zotero.debug("Zotero.Item.prototype.getFile() is deprecated -- use getFilePath[Async]()", 2);
	
	var path = this.getFilePath();
	if (path) {
		return Zotero.File.pathToFile(path);
	}
	return false;
}


/**
 * Get the absolute file path for the attachment
 *
 * @return {string|false} - The absolute file path of the attachment, or false for invalid paths
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
		this._updateAttachmentStates(false);
		return false;
	}
	
	if (!this._identified) {
		Zotero.debug("Can't get file path for unsaved file");
		return false;
	}
	
	// Imported file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		if (!path.includes("storage:")) {
			Zotero.logError("Invalid attachment path '" + path + "'");
			this._updateAttachmentStates(false);
			return false;
		}
		// Strip "storage:"
		path = path.substr(8);
		
		// Ignore .zotero* files that were relinked before we started blocking them
		if (path.startsWith(".zotero")) {
			Zotero.debug("Ignoring attachment file " + path, 2);
			return false;
		}
		
		return OS.Path.join(
			OS.Path.normalize(Zotero.Attachments.getStorageDirectory(this).path), path
		);
	}
	
	// Linked file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		path = Zotero.Attachments.resolveRelativePath(path);
		if (!path) {
			this._updateAttachmentStates(false);
		}
		return path;
	}
	
	// Old-style OS X persistent descriptor (Base64-encoded opaque alias record)
	//
	// These should only exist if they weren't converted in the 80 DB upgrade step because
	// the file couldn't be found.
	if (path.startsWith('AAAA')) {
		// These can only be resolved on Macs
		if (!Zotero.isMac) {
			Zotero.debug(`Can't resolve old-style attachment path '${path}' on non-Mac platform`);
			this._updateAttachmentStates(false);
			return false;
		}
		
		let file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsIFile);
		try {
			file.persistentDescriptor = path;
		}
		catch (e) {
			Zotero.debug(`Can't resolve old-style attachment path '${path}'`);
			this._updateAttachmentStates(false);
			return false;
		}
		
		// If valid, convert this to a regular string in the background
		Zotero.DB.queryAsync(
			"UPDATE itemAttachments SET path=? WHERE itemID=?",
			[file.path, this._id]
		);
		
		return file.path;
	}
	
	return path;
};


/**
 * Get the absolute path for the attachment, if the file exists
 *
 * @return {Promise<String|false>} - A promise for either the absolute path of the attachment
 *                                   or false for invalid paths or if the file doesn't exist
 */
Zotero.Item.prototype.getFilePathAsync = Zotero.Promise.coroutine(function* () {
	if (!this.isAttachment()) {
		throw new Error("getFilePathAsync() can only be called on attachment items");
	}
	
	var linkMode = this.attachmentLinkMode;
	var path = this.attachmentPath;
	
	// No associated files for linked URLs
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		this._updateAttachmentStates(false);
		return false;
	}
	
	if (!path) {
		Zotero.debug("Attachment path is empty", 2);
		this._updateAttachmentStates(false);
		return false;
	}
	
	// Imported file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		if (!path.includes("storage:")) {
			Zotero.logError("Invalid attachment path '" + path + "'");
			this._updateAttachmentStates(false);
			return false;
		}
		
		// Strip "storage:"
		path = path.substr(8);
		
		// Ignore .zotero* files that were relinked before we started blocking them
		if (path.startsWith(".zotero")) {
			Zotero.debug("Ignoring attachment file " + path, 2);
			this._updateAttachmentStates(false);
			return false;
		}
		
		path = OS.Path.join(
			OS.Path.normalize(Zotero.Attachments.getStorageDirectory(this).path), path
		);
		
		if (!(yield OS.File.exists(path))) {
			Zotero.debug("Attachment file '" + path + "' not found", 2);
			this._updateAttachmentStates(false);
			return false;
		}
		
		this._updateAttachmentStates(true);
		return path;
	}
	
	// Linked file with relative path
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE &&
			path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
		path = Zotero.Attachments.resolveRelativePath(path);
		if (!path) {
			this._updateAttachmentStates(false);
			return false;
		}
		if (!(yield OS.File.exists(path))) {
			Zotero.debug("Attachment file '" + path + "' not found", 2);
			this._updateAttachmentStates(false);
			return false;
		}
		
		this._updateAttachmentStates(true);
		return path;
	}
	
	// Old-style OS X persistent descriptor (Base64-encoded opaque alias record)
	//
	// These should only exist if they weren't converted in the 80 DB upgrade step because
	// the file couldn't be found
	if (Zotero.isMac && path.startsWith('AAAA')) {
		let file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsIFile);
		try {
			file.persistentDescriptor = path;
		}
		catch (e) {
			this._updateAttachmentStates(false);
			return false;
		}
		
		// If valid, convert this to a regular string
		yield Zotero.DB.queryAsync(
			"UPDATE itemAttachments SET path=? WHERE itemID=?",
			[file.leafName, this._id]
		);
		
		if (!(yield OS.File.exists(file.path))) {
			Zotero.debug("Attachment file '" + file.path + "' not found", 2);
			this._updateAttachmentStates(false);
			return false;
		}
		
		this._updateAttachmentStates(true);
		
		return file.path;
	}
	
	if (!(yield OS.File.exists(path))) {
		Zotero.debug("Attachment file '" + path + "' not found", 2);
		this._updateAttachmentStates(false);
		return false;
	}
	
	this._updateAttachmentStates(true);
	
	return path;
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
		Zotero.logError(`Attachment parent ${this.libraryID}/${parentKey} doesn't exist for `
			+ "source key in Zotero.Item.updateAttachmentStates()");
		return;
	}
	
	try {
		var item = this.ObjectsClass.getByLibraryAndKey(this.libraryID, parentKey);
	}
	catch (e) {
		if (e instanceof Zotero.Exception.UnloadedDataException) {
			Zotero.logError(`Attachment parent ${this.libraryID}/${parentKey} not yet loaded in `
				+ "Zotero.Item.updateAttachmentStates()");
			return;
		}
		throw e;
	}
	if (!item) {
		Zotero.logError(`Attachment parent ${this.libraryID}/${parentKey} doesn't exist`);
		return;
	}
	item.clearBestAttachmentState();
};


Zotero.Item.prototype.getFilename = function () {
	Zotero.debug("getFilename() deprecated -- use .attachmentFilename");
	return this.attachmentFilename;
}


/**
 * Asynchronous check for file existence
 */
Zotero.Item.prototype.fileExists = Zotero.Promise.coroutine(function* () {
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



/**
 * Rename file associated with an attachment
 *
 * @param {String} newName
 * @param {Boolean} [overwrite=false] - Overwrite file if one exists
 * @param {Boolean} [unique=false] - Add suffix to create unique filename if necessary
 * @return {Number|false} -- true - Rename successful
 *                           -1 - Destination file exists; use _force_ to overwrite
 *                           -2 - Error renaming
 *                           false - Attachment file not found
 */
Zotero.Item.prototype.renameAttachmentFile = async function (newName, overwrite = false, unique = false) {
	var origPath = await this.getFilePathAsync();
	if (!origPath) {
		Zotero.debug("Attachment file not found in renameAttachmentFile()", 2);
		return false;
	}
	
	try {
		let origName = OS.Path.basename(origPath);
		if (this.isImportedAttachment()) {
			var origModDate = (await OS.File.stat(origPath)).lastModificationDate;
		}
		
		// No change
		if (origName === newName) {
			Zotero.debug("Filename has not changed");
			return true;
		}
		
		// Update mod time and clear hash so the file syncs
		// TODO: use an integer counter instead of mod time for change detection
		// Update mod time first, because it may fail for read-only files on Windows
		if (this.isImportedAttachment()) {
			await OS.File.setDates(origPath, null, null);
		}
		
		newName = await Zotero.File.rename(
			origPath,
			newName,
			{
				overwrite,
				unique
			}
		);
		let destPath = OS.Path.join(OS.Path.dirname(origPath), newName);
		
		await this.relinkAttachmentFile(destPath);
		
		if (this.isImportedAttachment()) {
			this.attachmentSyncedHash = null;
			this.attachmentSyncState = "to_upload";
			await this.saveTx({ skipAll: true });
		}
		
		return true;
	}
	catch (e) {
		Zotero.logError(e);
		
		// Restore original modification date in case we managed to change it
		if (this.isImportedAttachment()) {
			try {
				OS.File.setDates(origPath, null, origModDate);
			} catch (e) {
				Zotero.debug(e, 2);
			}
		}
		
		return -2;
	}
};


/**
 * @param {string} path  File path
 * @param {Boolean} [skipItemUpdate] Don't update attachment item mod time, so that item doesn't
 *     sync. Used when a file needs to be renamed to be accessible but the user doesn't have
 *     access to modify the attachment metadata. This also allows a save when the library is
 *     read-only.
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
	if (fileName.endsWith(".lnk")) {
		throw new Error("Cannot relink to Windows shortcut");
	}
	var newPath;
	var newName = Zotero.File.getValidFileName(fileName);
	if (!newName) {
		throw new Error("No valid characters in filename after filtering");
	}
	
	// If selected file isn't in the attachment's storage directory,
	// copy it in and use that one instead
	var storageDir = Zotero.Attachments.getStorageDirectory(this).path;
	if (this.isImportedAttachment() && OS.Path.dirname(path) != storageDir) {
		newPath = OS.Path.join(storageDir, newName);
		
		// If file with same name already exists in the storage directory,
		// move it out of the way
		let backupCreated = false;
		if (yield OS.File.exists(newPath)) {
			backupCreated = true;
			yield OS.File.move(newPath, newPath + ".bak");
		}
		// Create storage directory if necessary
		else if (!(yield OS.File.exists(storageDir))) {
			yield Zotero.Attachments.createDirectoryForItem(this);
		}
		
		let newFile;
		try {
			newFile = Zotero.File.copyToUnique(path, newPath);
		}
		catch (e) {
			// Restore backup file if copying failed
			if (backupCreated) {
				yield OS.File.move(newPath + ".bak", newPath);
			}
			throw e;
		}
		newPath = newFile.path;
		
		// Delete backup file
		if (backupCreated) {
			yield OS.File.remove(newPath + ".bak");
		}
	}
	else {
		newPath = OS.Path.join(OS.Path.dirname(path), newName);
		
		// Rename file to filtered name if necessary
		if (fileName != newName) {
			Zotero.debug("Renaming file '" + fileName + "' to '" + newName + "'");
			try {
				yield OS.File.move(path, newPath, { noOverwrite: true });
			}
			catch (e) {
				if (e instanceof OS.File.Error && e.becauseExists && fileName.normalize() == newName) {
					// Ignore normalization differences that the filesystem ignores
				}
				else {
					throw e;
				}
			}
		}
	}
	
	this.attachmentPath = newPath;
	
	yield this.saveTx({
		skipDateModifiedUpdate: true,
		skipClientDateModifiedUpdate: skipItemUpdate,
		skipEditCheck: skipItemUpdate
	});
	
	this._updateAttachmentStates(true);
	yield Zotero.Notifier.trigger('refresh', 'item', this.id);
	
	return true;
});


Zotero.Item.prototype.deleteAttachmentFile = Zotero.Promise.coroutine(function* () {
	if (!this.isImportedAttachment()) {
		throw new Error("deleteAttachmentFile() can only be called on imported attachment items");
	}
	
	var path = yield this.getFilePathAsync();
	if (!path) {
		Zotero.debug(`File not found for item ${this.libraryKey} in deleteAttachmentFile()`, 2);
		return false;
	}
	
	Zotero.debug("Deleting attachment file for item " + this.libraryKey);
	try {
		yield Zotero.File.removeIfExists(path);
		this.attachmentSyncState = "to_download";
		yield this.saveTx({ skipAll: true });
		return true;
	}
	catch (e) {
		Zotero.logError(e);
		return false;
	}
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
		
		// Allow 'imported_url', etc.
		if (typeof val == 'string') {
			let code = Zotero.Attachments["LINK_MODE_" + val.toUpperCase()];
			if (code !== undefined) {
				val = code;
			}
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
	},
	enumerable: false
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
		
		if (typeof val == 'number') {
			throw new Error("Character set must be a string");
		}
		oldVal = this.attachmentCharset;
		
		if (val) {
			val = Zotero.CharacterSets.toCanonical(val);
		}
		if (!val) {
			val = "";
		}
		
		if (val === oldVal) {
			return;
		}
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData= {};
		}
		this._changed.attachmentData.charset = true;
		this._attachmentCharset = val;
	}
});


/**
 * Get or set the filename of file attachments
 *
 * This will return the filename for all file attachments, but the filename can only be set
 * for stored file attachments. Linked file attachments should be set using .attachmentPath.
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentFilename', {
	get: function () {
		if (!this.isAttachment()) {
			return undefined;
		}
		var path = this.attachmentPath;
		if (!path) {
			return '';
		}
		var prefixedPath = path.match(/^(?:attachments|storage):(.*)$/);
		if (prefixedPath) {
			return prefixedPath[1];
		}
		return OS.Path.basename(path);
	},
	set: function (val) {
		if (!this.isAttachment()) {
			throw new Error("Attachment filename can only be set for attachment items");
		}
		var linkMode = this.attachmentLinkMode;
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE
				|| linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			throw new Error("Attachment filename can only be set for stored files");
		}
		
		if (!val) {
			throw new Error("Attachment filename cannot be blank");
		}
		
		this.attachmentPath = 'storage:' + val;
	}
});


/**
 * Returns raw attachment path string as stored in DB
 * (e.g., "storage:foo.pdf", "attachments:foo/bar.pdf", "/Users/foo/Desktop/bar.pdf")
 *
 * Can be set as absolute path or prefixed string ("storage:foo.pdf")
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentPath', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentPath;
	},
	set: function(val) {
		if (!this.isAttachment()) {
			throw new Error(".attachmentPath can only be set for attachment items");
		}
		
		if (typeof val != 'string') {
			throw new Error(".attachmentPath must be a string");
		}
		
		var linkMode = this.attachmentLinkMode;
		if (linkMode === null) {
			throw new Error("Link mode must be set before setting attachment path");
		}
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			throw new Error('attachmentPath cannot be set for link attachments');
		}
		
		if (!val) {
			val = '';
		}
		
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			if (this._libraryID) {
				let libraryType = Zotero.Libraries.get(this._libraryID).libraryType;
				if (libraryType != 'user') {
					throw new Error("Linked files can only be added to user library");
				}
			}
			
			// If base directory is enabled, save attachment within as relative path
			if (Zotero.Prefs.get('saveRelativeAttachmentPath')) {
				val = Zotero.Attachments.getBaseDirectoryRelativePath(val);
			}
			// Otherwise, convert relative path to absolute if possible
			else {
				val = Zotero.Attachments.resolveRelativePath(val) || val;
			}
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
				linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
			if (val && !val.startsWith('storage:')) {
				let storagePath = Zotero.Attachments.getStorageDirectory(this).path;
				if (!val.startsWith(storagePath)) {
					throw new Error("Imported file path must be within storage directory");
				}
				val = 'storage:' + OS.Path.basename(val);
			}
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


Zotero.defineProperty(Zotero.Item.prototype, 'attachmentSyncState', {
	get: function() {
		if (!this.isAttachment()) {
			return undefined;
		}
		return this._attachmentSyncState;
	},
	set: function(val) {
		if (!this.isAttachment()) {
			throw new Error("attachmentSyncState can only be set for attachment items");
		}
		
		if (typeof val == 'string') {
			val = Zotero.Sync.Storage.Local["SYNC_STATE_" + val.toUpperCase()];
		}
		
		switch (this.attachmentLinkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
				
			default:
				throw new Error("attachmentSyncState can only be set for stored files");
		}
		
		switch (val) {
			case Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD:
			case Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD:
			case Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC:
			case Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD:
			case Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_DOWNLOAD:
			case Zotero.Sync.Storage.Local.SYNC_STATE_IN_CONFLICT:
				break;
				
			default:
				throw new Error("Invalid sync state '" + val + "'");
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


Zotero.defineProperty(Zotero.Item.prototype, 'attachmentSyncedModificationTime', {
	get: function () {
		if (!this.isFileAttachment()) {
			return undefined;
		}
		return this._attachmentSyncedModificationTime;
	},
	set: function (val) {
		if (!this.isAttachment()) {
			throw new Error("attachmentSyncedModificationTime can only be set for attachment items");
		}
		
		switch (this.attachmentLinkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
				
			default:
				throw new Error("attachmentSyncedModificationTime can only be set for stored files");
		}
		
		if (typeof val != 'number') {
			Zotero.debug(val, 2);
			throw new Error("attachmentSyncedModificationTime must be a number");
		}
		if (parseInt(val) != val || val < 0) {
			Zotero.debug(val, 2);
			throw new Error("attachmentSyncedModificationTime must be a timestamp in milliseconds");
		}
		if (val < 10000000000) {
			Zotero.logError("attachmentSyncedModificationTime should be a timestamp in milliseconds "
				+ "-- " + val + " given");
		}
		
		if (val == this._attachmentSyncedModificationTime) {
			return;
		}
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.syncedModificationTime = true;
		this._attachmentSyncedModificationTime = val;
	}
});


Zotero.defineProperty(Zotero.Item.prototype, 'attachmentSyncedHash', {
	get: function () {
		if (!this.isFileAttachment()) {
			return undefined;
		}
		return this._attachmentSyncedHash;
	},
	set: function (val) {
		if (!this.isAttachment()) {
			throw ("attachmentSyncedHash can only be set for attachment items");
		}
		
		switch (this.attachmentLinkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
				
			default:
				throw new Error("attachmentSyncedHash can only be set for stored files");
		}
		
		if (val !== null && val.length != 32) {
			throw new Error("Invalid attachment hash '" + val + "'");
		}
		
		if (val == this._attachmentSyncedHash) {
			return;
		}
		
		if (!this._changed.attachmentData) {
			this._changed.attachmentData = {};
		}
		this._changed.attachmentData.syncedHash = true;
		this._attachmentSyncedHash = val;
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
		if (!this.isFileAttachment()) {
			return undefined;
		}
		
		if (!this.id) {
			return undefined;
		}
		
		var path = yield this.getFilePathAsync();
		if (!path) {
			return undefined;
		}
		
		var fmtime = ((yield OS.File.stat(path)).lastModificationDate).getTime();
		
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
 * @return {Promise<String>} - MD5 hash of file as hex string
 */
Zotero.defineProperty(Zotero.Item.prototype, 'attachmentHash', {
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
		
		return Zotero.Utilities.Internal.md5Async(path);
	})
});



/**
 * Return plain text of attachment content
 *
 * - Currently works on HTML, PDF and plaintext attachments
 * - Paragraph breaks will be lost in PDF content
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
	
	if (!this._attachments) {
		return [];
	}
	
	var cacheKey = (Zotero.Prefs.get('sortAttachmentsChronologically') ? 'chronological' : 'alphabetical')
		+ 'With' + (includeTrashed ? '' : 'out') + 'Trashed';
	
	if (this._attachments[cacheKey]) {
		return this._attachments[cacheKey];
	}
	
	var rows = this._attachments.rows.concat();
	// Remove trashed items if necessary
	if (!includeTrashed) {
		rows = rows.filter(row => !row.trashed);
	}
	// Sort by title if necessary
	if (!Zotero.Prefs.get('sortAttachmentsChronologically')) {
		var collation = Zotero.getLocaleCollation();
		rows.sort((a, b) => collation.compareString(1, a.title, b.title));
	}
	var ids = rows.map(row => row.itemID);
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
	var urlFieldID = Zotero.ItemFields.getID('url');
	
	var sql = "SELECT IA.itemID FROM itemAttachments IA NATURAL JOIN items I "
		+ `LEFT JOIN itemData ID ON (IA.itemID=ID.itemID AND fieldID=${urlFieldID}) `
		+ "LEFT JOIN itemDataValues IDV ON (ID.valueID=IDV.valueID) "
		+ `WHERE parentItemID=? AND linkMode NOT IN (${Zotero.Attachments.LINK_MODE_LINKED_URL}) `
		+ "AND IA.itemID NOT IN (SELECT itemID FROM deletedItems) "
		+ "ORDER BY contentType='application/pdf' DESC, value=? DESC, dateAdded ASC";
	var itemIDs = yield Zotero.DB.columnQueryAsync(sql, [this.id, url]);
	return this.ObjectsClass.get(itemIDs);
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
	return JSON.parse(JSON.stringify(this._changedData.tags || this._tags));
};


/**
 * Check if the item has a given tag
 *
 * @param {String}
 * @return {Boolean}
 */
Zotero.Item.prototype.hasTag = function (tagName) {
	this._requireData('tags');
	var tags = this._changedData.tags || this._tags;
	return tags.some(tagData => tagData.tag == tagName);
}


/**
 * Get the assigned type for a given tag of the item
 */
Zotero.Item.prototype.getTagType = function (tagName) {
	this._requireData('tags');
	var tags = this._changedData.tags || this._tags;
	for (let tag of tags) {
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
 * @param {String[]|Object[]} tags - Array of strings or object in API JSON format
 *                                   (e.g., [{tag: 'tag', type: 1}])
 */
Zotero.Item.prototype.setTags = function (tags) {
	this._requireData('tags');
	var oldTags = this._changedData.tags || this._tags;
	var newTags = tags.concat()
		// Allow array of strings
		.map(tag => typeof tag == 'string' ? { tag } : tag);
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
	
	this._markFieldChange('tags', newTags);
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


/**
 * Replace an existing tag with a new manual tag
 *
 * A separate save() is required to update the database.
 *
 * @param {String} oldTag
 * @param {String} newTag
 */
Zotero.Item.prototype.replaceTag = function (oldTag, newTag) {
	var tags = this.getTags();
	newTag = newTag.trim();
	
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
	var oldTags = this._changedData.tags || this._tags;
	var newTags = oldTags.filter(tagData => tagData.tag !== tagName);
	if (newTags.length == oldTags.length) {
		Zotero.debug('Cannot remove missing tag ' + tagName + ' from item ' + this.libraryKey);
		return;
	}
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
	if (!this.libraryID) {
		this.libraryID = Zotero.Libraries.userLibraryID;
	}
	
	this._requireData('collections');
	
	if (!collectionIDsOrKeys) {
		collectionIDsOrKeys = [];
	}
	
	// Convert any keys to ids
	var collectionIDs = collectionIDsOrKeys.map(function (val) {
		if (typeof val == 'number') {
			return val;
		}
		var id = this.ContainerObjectsClass.getIDFromLibraryAndKey(this.libraryID, val);
		if (!id) {
			let e = new Error("Collection " + val + " not found for item " + this.libraryKey);
			e.name = "ZoteroMissingObjectError";
			throw e;
		}
		return id;
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
	if (!this.libraryID) {
		this.libraryID = Zotero.Libraries.userLibraryID;
	}
	
	var collectionID = parseInt(collectionIDOrKey) == collectionIDOrKey
			? parseInt(collectionIDOrKey)
			: this.ContainerObjectsClass.getIDFromLibraryAndKey(this.libraryID, collectionIDOrKey)
	
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
	if (!this.libraryID) {
		this.libraryID = Zotero.Libraries.userLibraryID;
	}
	
	var collectionID = parseInt(collectionIDOrKey) == collectionIDOrKey
			? parseInt(collectionIDOrKey)
			: this.ContainerObjectsClass.getIDFromLibraryAndKey(this.libraryID, collectionIDOrKey)
	
	if (!collectionID) {
		throw new Error("Invalid collection '" + collectionIDOrKey + "'");
	}
	
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


/**
 * Update item deleted (i.e., trash) state without marking as changed or modifying DB
 *
 * This is used by Zotero.Items.trash().
 *
 * Database state must be set separately!
 *
 * @param {Boolean} deleted
 */
Zotero.DataObject.prototype.setDeleted = Zotero.Promise.coroutine(function* (deleted) {
	if (!this.id) {
		throw new Error("Cannot update deleted state of unsaved item");
	}
	
	this._deleted = !!deleted;
	
	if (this._changed.deleted) {
		delete this._changed.deleted;
	}
});


/**
 * Update item publications state without marking as changed or modifying DB
 *
 * This is used by Zotero.Items.addToPublications()/removeFromPublications()
 *
 * Database state must be set separately!
 *
 * @param {Boolean} inPublications
 */
Zotero.DataObject.prototype.setPublications = Zotero.Promise.coroutine(function* (inPublications) {
	if (!this.id) {
		throw new Error("Cannot update publications state of unsaved item");
	}
	
	this._inPublications = !!inPublications;
	
	if (this._changed.inPublications) {
		delete this._changed.inPublications;
	}
});


Zotero.Item.prototype.getImageSrc = function() {
	var itemType = Zotero.ItemTypes.getName(this.itemTypeID);
	if (itemType == 'attachment') {
		var linkMode = this.attachmentLinkMode;
		
		if (this.attachmentContentType == 'application/pdf' && this.isFileAttachment()) {
			if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				itemType += '-pdf-link';
			}
			else {
				itemType += '-pdf';
			}
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
	
	var retracted = Zotero.Retractions.isRetracted(this);
	
	var tags = this.getTags();
	if (!tags.length && !retracted) {
		return uri;
	}
	
	var colorData = [];
	if (tags.length) {
		let tagColors = Zotero.Tags.getColors(this.libraryID);
		for (let tag of tags) {
			let data = tagColors.get(tag.tag);
			if (data) {
				colorData.push(data);
			}
		}
		if (!colorData.length && !retracted) {
			return uri;
		}
		colorData.sort(function (a, b) {
			return a.position - b.position;
		});
	}
	var colors = colorData.map(val => val.color);
	
	return Zotero.Tags.generateItemsListImage(colors, uri, retracted);
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
	
	var numDiffs = this.ObjectsClass.diff(thisData, otherData, diff, includeMatches);
	
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
		for (let field of ignoreFields) {
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
	var thisData = this.toJSON();
	
	var alternatives = {};
	var hasDiffs = false;
	
	for (let i = 0; i < otherItems.length; i++) {
		let otherData = otherItems[i].toJSON();
		let changeset = Zotero.DataObjectUtilities.diff(thisData, otherData, ignoreFields);
		
		for (let i = 0; i < changeset.length; i++) {
			let change = changeset[i];
			
			if (change.op == 'delete') {
				continue;
			}
			
			if (!alternatives[change.field]) {
				hasDiffs = true;
				alternatives[change.field] = [change.value];
			}
			else if (alternatives[change.field].indexOf(change.value) == -1) {
				hasDiffs = true;
				alternatives[change.field].push(change.value);
			}
		}
	}
	
	if (!hasDiffs) {
		return false;
	}
	
	return alternatives;
};


/**
 * Returns an unsaved copy of the item without itemID and key
 *
 * This is used to duplicate items and copy them between libraries.
 *
 * @param {Number} [libraryID] - libraryID of the new item, or the same as original if omitted
 * @param {Boolean} [options.skipTags=false] - Skip tags
 * @param {Boolean} [options.includeCollections=false] - Add new item to all collections
 * @return {Promise<Zotero.Item>}
 */
Zotero.Item.prototype.clone = function (libraryID, options = {}) {
	Zotero.debug('Cloning item ' + this.id);
	
	if (libraryID !== undefined && libraryID !== null && typeof libraryID !== 'number') {
		throw new Error("libraryID must be null or an integer");
	}
	
	if (libraryID === undefined || libraryID === null) {
		libraryID = this.libraryID;
	}
	var sameLibrary = libraryID == this.libraryID;
	
	var newItem = new Zotero.Item;
	newItem.libraryID = libraryID;
	newItem.setType(this.itemTypeID);
	
	var fieldIDs = this.getUsedFields();
	for (let i = 0; i < fieldIDs.length; i++) {
		let fieldID = fieldIDs[i];
		newItem.setField(fieldID, this.getField(fieldID));
	}
	
	// Regular item
	if (this.isRegularItem()) {
		newItem.setCreators(this.getCreators());
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
			}
		}
	}
	
	if (!options.skipTags) {
		newItem.setTags(this.getTags());
	}
	
	if (options.includeCollections) {
		if (!sameLibrary) {
			throw new Error("Can't include collections when cloning to different library");
		}
		newItem.setCollections(this.getCollections());
	}
	
	if (sameLibrary) {
		// DEBUG: this will add reverse-only relateds too
		newItem.setRelations(this.getRelations());
	}
	
	return newItem;
}


/**
 * @param {Zotero.Item} item
 * @param {Integer} libraryID
 * @return {Zotero.Item} - New item
 */
Zotero.Item.prototype.moveToLibrary = async function (libraryID, onSkippedAttachment) {
	if (!this.isEditable) {
		throw new Error("Can't move item in read-only library");
	}
	var library = Zotero.Libraries.get(libraryID);
	Zotero.debug("Moving item to " + library.name);
	if (!library.editable) {
		throw new Error("Can't move item to read-only library");
	}
	var filesEditable = library.filesEditable;
	var allowsLinkedFiles = library.allowsLinkedFiles;
	
	var newItem = await Zotero.DB.executeTransaction(async function () {
		// Create new clone item in target library
		var newItem = this.clone(libraryID);
		var newItemID = await newItem.save({
			skipSelect: true
		});
		
		if (this.isNote()) {
			// Delete old item
			await this.erase();
			return newItem;
		}
		
		// For regular items, add child items
		
		// Child notes
		var noteIDs = this.getNotes();
		var notes = Zotero.Items.get(noteIDs);
		for (let note of notes) {
			let newNote = note.clone(libraryID);
			newNote.parentID = newItemID;
			await newNote.save({
				skipSelect: true
			});
		}
		
		// Child attachments
		var attachmentIDs = this.getAttachments();
		var attachments = Zotero.Items.get(attachmentIDs);
		for (let attachment of attachments) {
			let linkMode = attachment.attachmentLinkMode;
			
			// Skip linked files if not allowed in destination
			if (!allowsLinkedFiles && linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				Zotero.debug("Target library doesn't support linked files -- skipping attachment");
				if (onSkippedAttachment) {
					await onSkippedAttachment(attachment);
				}
				continue;
			}
			
			// Skip files if not allowed in destination
			if (!filesEditable && linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				Zotero.debug("Target library doesn't allow file editing -- skipping attachment");
				if (onSkippedAttachment) {
					await onSkippedAttachment(attachment);
				}
				continue;
			}
			
			await Zotero.Attachments.moveAttachmentToLibrary(
				attachment, libraryID, newItemID
			);
		}
		
		return newItem;
	}.bind(this));
	
	// Delete old item. Do this outside of a transaction so we don't leave stranded files
	// in the target library if deleting fails.
	await this.eraseTx();
	
	return newItem;
};


Zotero.Item.prototype._eraseData = Zotero.Promise.coroutine(function* (env) {
	Zotero.DB.requireTransaction();
	
	// Remove item from parent collections
	var parentCollectionIDs = this._collections;
	for (let parentCollectionID of parentCollectionIDs) {
		let parentCollection = yield Zotero.Collections.getAsync(parentCollectionID);
		yield parentCollection.removeItem(this.id);
	}
	
	var parentItem = this.parentKey;
	parentItem = parentItem
		? (yield this.ObjectsClass.getByLibraryAndKeyAsync(this.libraryID, parentItem))
		: null;
	
	if (parentItem && !env.options.skipParentRefresh) {
		Zotero.Notifier.queue('refresh', 'item', parentItem.id);
	}
	
	// // Delete associated attachment files
	if (this.isAttachment()) {
		let linkMode = this.attachmentLinkMode;
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
		
		// Zotero.Sync.EventListeners.ChangeListener needs to know if this was a storage file
		env.notifierData[this.id].storageDeleteLog = this.isImportedAttachment();
	}
	// Regular item
	else {
		let sql = "SELECT itemID FROM itemNotes WHERE parentItemID=?1 UNION "
			+ "SELECT itemID FROM itemAttachments WHERE parentItemID=?1";
		let toDelete = yield Zotero.DB.columnQueryAsync(sql, [this.id]);
		for (let i=0; i<toDelete.length; i++) {
			let obj = yield this.ObjectsClass.getAsync(toDelete[i]);
			yield obj.erase({
				skipParentRefresh: true,
				skipEditCheck: env.options.skipEditCheck
			});
		}
	}
	
	// Remove related-item relations pointing to this item
	var relatedItems = Zotero.Relations.getByPredicateAndObject(
		'item', Zotero.Relations.relatedItemPredicate, Zotero.URI.getItemURI(this)
	);
	for (let relatedItem of relatedItems) {
		relatedItem.removeRelatedItem(this);
		relatedItem.save({
			skipDateModifiedUpdate: true,
			skipEditCheck: env.options.skipEditCheck
		});
	}
	
	// Clear fulltext cache
	if (this.isAttachment()) {
		yield Zotero.Fulltext.clearItemWords(this.id);
		//Zotero.Fulltext.clearItemContent(this.id);
	}
	
	yield Zotero.DB.queryAsync('DELETE FROM items WHERE itemID=?', this.id);
	
	if (parentItem && !env.options.skipParentRefresh) {
		yield parentItem.reload(['primaryData', 'childItems'], true);
		parentItem.clearBestAttachmentState();
	}
	
	Zotero.Prefs.set('purge.items', true);
	Zotero.Prefs.set('purge.creators', true);
	Zotero.Prefs.set('purge.tags', true);
});


Zotero.Item.prototype.isCollection = function() {
	return false;
}


/**
 * Populate the object's data from an API JSON data object
 *
 * @param {Object} json
 * @param {Object} [options]
 * @param {Boolean} [options.strict = false] - Throw on unknown field or invalid field for type
 */
Zotero.Item.prototype.fromJSON = function (json, options = {}) {
	var strict = !!options.strict;
	
	if (!json.itemType && !this._itemTypeID) {
		throw new Error("itemType property not provided");
	}
	
	let itemTypeID = Zotero.ItemTypes.getID(json.itemType);
	if (!itemTypeID) {
		let e = new Error(`Unknown item type '${json.itemType}'`);
		e.name = "ZoteroInvalidDataError";
		throw e;
	}
	this.setType(itemTypeID);
	
	var isValidForType = {};
	var setFields = new Set();
	/*var { fields: extraFields, creators: extraCreators, extra } = Zotero.Utilities.Internal.extractExtraFields(
		json.extra !== undefined ? json.extra : '',
		this,
		Object.keys(json)
	);*/
	
	// Transfer valid fields from Extra to regular fields
	// Currently disabled
	/*for (let [field, value] of extraFields) {
		this.setField(field, value);
		setFields.add(field);
		extraFields.delete(field);
	}*/
	
	for (let field in json) {
		let val = json[field];
		
		switch (field) {
		case 'key':
		case 'version':
		case 'itemType':
		case 'note':
		// Use?
		case 'md5':
		case 'mtime':
		// Handled below
		case 'collections':
		case 'parentItem':
		case 'deleted':
		case 'inPublications':
		case 'extra':
			break;
		
		case 'accessDate':
			if (val && !Zotero.Date.isSQLDate(val)) {
				let d = Zotero.Date.isoToDate(val);
				if (!d) {
					Zotero.logError(`Discarding invalid ${field} '${val}' for item ${this.libraryKey}`);
					continue;
				}
				val = Zotero.Date.dateToSQL(d, true);
			}
			this.setField(field, val);
			setFields.add(field);
			break;
		
		case 'dateAdded':
		case 'dateModified':
			if (val) {
				let d = Zotero.Date.isoToDate(val);
				if (!d) {
					Zotero.logError(`Discarding invalid ${field} '${val}' for item ${this.libraryKey}`);
					continue;
				}
				val = Zotero.Date.dateToSQL(d, true);
			}
			this[field] = val;
			break;
		
		case 'creators':
			//this.setCreators(json.creators.concat(extraCreators), options);
			this.setCreators(json.creators, options);
			break;
		
		case 'tags':
			this.setTags(json.tags);
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
		
		case 'filename':
			if (val === "") {
				Zotero.logError("Ignoring empty attachment filename in JSON for item " + this.libraryKey);
			}
			else {
				this.attachmentFilename = val;
			}
			break;
		
		case 'path':
			this.attachmentPath = val;
			break;
		
		// Item fields
		default:
			let fieldID = Zotero.ItemFields.getID(field);
			if (!fieldID) {
				// In strict mode, fail on unknown field
				if (strict) {
					let e = new Error(`Unknown field '${field}'`);
					e.name = "ZoteroInvalidDataError";
					throw e;
				}
				// Otherwise store in Extra
				// TEMP: Disabled for now, along with tests in itemTest.js
				/*if (typeof val == 'string') {
					Zotero.warn(`Storing unknown field '${field}' in Extra for item ${this.libraryKey}`);
					extraFields.set(field, val);
					break;
				}*/
				Zotero.warn(`Discarding unknown JSON ${typeof val} '${field}' for item ${this.libraryKey}`);
				continue;
			}
			// Convert to base-mapped field if necessary, so that setFields has the base-mapped field
			// when it's checked for values from getUsedFields() below
			let origFieldID = fieldID;
			let origField = field;
			fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID) || fieldID;
			if (origFieldID != fieldID) {
				field = Zotero.ItemFields.getName(fieldID);
			}
			isValidForType[field] = Zotero.ItemFields.isValidForType(fieldID, this.itemTypeID);
			if (!isValidForType[field]) {
				let type = Zotero.ItemTypes.getName(itemTypeID);
				// In strict mode, fail on invalid field for type
				if (strict) {
					let e = new Error(`Invalid field '${origField}' for type ${type}`);
					e.name = "ZoteroInvalidDataError";
					throw e;
				}
				// Otherwise store in Extra
				// TEMP: Disabled for now, since imports can assign values to multiple versions of
				// fields
				// https://groups.google.com/d/msg/zotero-dev/a1IPUJ2m_3s/hfmdK2P3BwAJ
				/*Zotero.warn(`Storing invalid field '${origField}' for type ${type} in Extra for `
					+ `item ${this.libraryKey}`);
				extraFields.set(field, val);*/
				continue;
			}
			this.setField(field, json[origField]);
			setFields.add(field);
		}
	}
	
	//this.setField('extra', Zotero.Utilities.Internal.combineExtraFields(extra, extraFields));
	this.setField('extra', json.extra !== undefined ? json.extra : '');
	
	if (json.collections || this._collections.length) {
		this.setCollections(json.collections);
	}
	
	// Clear existing fields not specified
	var previousFields = this.getUsedFields(true);
	for (let field of previousFields) {
		if (!setFields.has(field) && isValidForType[field] !== false && field != 'extra') {
			this.setField(field, false);
		}
	}
	
	// Both notes and attachments might have parents and notes
	if (this.isNote() || this.isAttachment()) {
		let parentKey = json.parentItem;
		this.parentKey = parentKey ? parentKey : false;
		
		let note = json.note;
		this.setNote(note !== undefined ? note : "");
	}
	
	// Update boolean fields that might not be present in JSON
	['deleted', 'inPublications'].forEach(field => {
		if (json[field] || this[field]) {
			this[field] = !!json[field];
		}
	});
}


/**
 * @param {Object} options
 */
Zotero.Item.prototype.toJSON = function (options = {}) {
	var env = this._preToJSON(options);
	var mode = env.mode;
	
	var obj = env.obj = {};
	obj.key = this.key;
	obj.version = this.version;
	obj.itemType = Zotero.ItemTypes.getName(this.itemTypeID);
	
	// Fields
	for (let i in this._itemData) {
		let val = this.getField(i) + '';
		if (val !== '' || mode == 'full') {
			obj[Zotero.ItemFields.getName(i)] = val;
		}
	}
	
	// Creators
	if (this.isRegularItem()) {
		obj.creators = this.getCreatorsJSON();
	}
	else {
		var parent = this.parentKey;
		if (parent || mode == 'full') {
			obj.parentItem = parent ? parent : false;
		}
		
		// Attachment fields
		if (this.isAttachment()) {
			let linkMode = this.attachmentLinkMode;
			obj.linkMode = Zotero.Attachments.linkModeToName(linkMode);
			
			obj.contentType = this.attachmentContentType;
			obj.charset = this.attachmentCharset;
			
			if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				obj.path = this.attachmentPath;
			}
			else if (linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				obj.filename = this.attachmentFilename;
			}
			
			if (this.isImportedAttachment() && !options.skipStorageProperties) {
				if (options.syncedStorageProperties) {
					let mtime = this.attachmentSyncedModificationTime;
					// There's never a reason to include these if they're null. This can happen if
					// we're restoring to server from a copy of the database that was never
					// file-synced. We don't want to clear the remote file associations when that
					// happens.
					if (mtime !== null) {
						obj.mtime = mtime;
					}
					let md5 = this.attachmentSyncedHash;
					if (md5 !== null) {
						obj.md5 = md5;
					}
				}
				else {
					// TEMP
					//obj.mtime = (yield this.attachmentModificationTime) || null;
					//obj.md5 = (yield this.attachmentHash) || null;
				}
			}
		}
		
		// Notes and embedded attachment notes
		let note = this.getNote();
		if (note !== "" || mode == 'full' || (mode == 'new' && this.isNote())) {
			obj.note = note;
		}
	}
	
	// Tags
	obj.tags = [];
	var tags = this.getTags();
	for (let i=0; i<tags.length; i++) {
		obj.tags.push(tags[i]);
	}
	
	// Collections
	if (this.isTopLevelItem()) {
		obj.collections = this.getCollections().map(function (id) {
			var { libraryID, key } = this.ContainerObjectsClass.getLibraryAndKeyFromID(id);
			if (!key) {
				throw new Error("Item collection " + id + " not found");
			}
			return key;
		}.bind(this));
	}
	
	// My Publications
	if (this._inPublications
			// Include in 'full' mode, but only in My Library
			|| (mode == 'full' && this.library && this.library.libraryType == 'user')) {
		obj.inPublications = this._inPublications;
	}
	
	// Deleted
	let deleted = this.deleted;
	if (deleted || mode == 'full') {
		// Match what APIv3 returns, though it would be good to change this
		obj.deleted = deleted ? 1 : 0;
	}
	
	// Relations
	obj.relations = this.getRelations()
	
	if (obj.accessDate) obj.accessDate = Zotero.Date.sqlToISO8601(obj.accessDate);
	
	if (this.dateAdded) {
		obj.dateAdded = Zotero.Date.sqlToISO8601(this.dateAdded);
	}
	if (this.dateModified) {
		obj.dateModified = Zotero.Date.sqlToISO8601(this.dateModified);
	}
	
	var json = this._postToJSON(env);
	
	// TODO: Remove once we stop clearing props from the cached JSON in patch mode
	if (options.skipStorageProperties) {
		delete json.md5;
		delete json.mtime;
	}
	return json;
}


Zotero.Item.prototype.toResponseJSON = function (options = {}) {
	// Default to showing synced storage properties, since that's what the API does, and this function
	// is generally used to emulate the API
	if (options.syncedStorageProperties === undefined) {
		options.syncedStorageProperties = true;
	}
	
	var json = this.constructor._super.prototype.toResponseJSON.call(this, options);
	
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
};


/**
 * Migrate valid fields in Extra to real fields
 *
 * A separate save is required
 */
Zotero.Item.prototype.migrateExtraFields = function () {
	var { itemType, fields, creators, extra } = Zotero.Utilities.Internal.extractExtraFields(
		this.getField('extra'), this
	);
	if (itemType) {
		this.setType(Zotero.ItemTypes.getID(itemType));
	}
	for (let [field, value] of fields) {
		this.setField(field, value);
	}
	if (creators.length) {
		this.setCreators([...item.getCreators(), ...creators]);
	}
	this.setField('extra', extra);
	if (!this.hasChanged()) {
		return false;
	}
	
	Zotero.debug("Migrating Extra fields for item " + this.libraryKey);
	if (itemType) {
		Zotero.debug("Item Type: " + itemType);
	}
	if (fields.size) {
		Zotero.debug(Array.from(fields.entries()));
	}
	if (creators.length) {
		Zotero.debug(creators);
	}
	Zotero.debug(extra);
	
	return true;
}


//////////////////////////////////////////////////////////////////////////////
//
// Asynchronous load methods
//
//////////////////////////////////////////////////////////////////////////////


/**
 * Return an item in the specified library equivalent to this item
 *
 * @return {Promise<Zotero.Item>}
 */
Zotero.Item.prototype.getLinkedItem = function (libraryID, bidirectional) {
	return this._getLinkedObject(libraryID, bidirectional);
};


/**
 * Add a linked-object relation pointing to the given item
 *
 * Does not require a separate save()
 *
 * @return {Promise}
 */
Zotero.Item.prototype.addLinkedItem = Zotero.Promise.coroutine(function* (item) {
	return this._addLinkedObject(item);
});


//////////////////////////////////////////////////////////////////////////////
//
// Private methods
//
//////////////////////////////////////////////////////////////////////////////
/**
 * Returns related items this item points to
 *
 * @return {String[]} - Keys of related items
 */
Zotero.Item.prototype._getRelatedItems = function () {
	this._requireData('relations');
	
	var predicate = Zotero.Relations.relatedItemPredicate;
	
	var relatedItemURIs = this.getRelationsByPredicate(predicate);
	
	// Pull out object values from related-item relations, turn into items, and pull out keys
	var keys = [];
	for (let i=0; i<relatedItemURIs.length; i++) {
		let {libraryID, key} = Zotero.URI.getURIItemLibraryKey(relatedItemURIs[i]);
		if (key) {
			keys.push(key);
		}
	}
	return keys;
}


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
