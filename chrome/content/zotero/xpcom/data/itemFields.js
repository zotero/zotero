/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.ItemFields = new function() {
	// Private members
	var _fields = {};
	var _fieldsLoaded;
	var _fieldFormats = [];
	var _itemTypeFields = [];
	var _baseTypeFields = [];
	var _typeFieldIDsByBase = {};
	var _typeFieldNamesByBase = {};
	
	var self = this;
	
	// Privileged methods
	this.getName = getName;
	this.getID = getID;
	this.getLocalizedString = getLocalizedString;
	this.isValidForType = isValidForType;
	this.isInteger = isInteger;
	this.getItemTypeFields = getItemTypeFields;
	this.isBaseField = isBaseField;
	this.isFieldOfBase = isFieldOfBase;
	this.getBaseMappedFields = getBaseMappedFields;
	this.getFieldIDFromTypeAndBase = getFieldIDFromTypeAndBase;
	this.getBaseIDFromTypeAndField = getBaseIDFromTypeAndField;
	this.getTypeFieldsFromBase = getTypeFieldsFromBase;
	
	
	/*
	 * Return the fieldID for a passed fieldID or fieldName
	 */
	function getID(field) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
		if (typeof field == 'number') {
			return field;
		}
		
		return _fields[field] ? _fields[field]['id'] : false;
	}
	
	
	/*
	 * Return the fieldName for a passed fieldID or fieldName
	 */
	function getName(field) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
		return _fields[field] ? _fields[field]['name'] : false;
	}
	
	
	function getLocalizedString(itemType, field) {
		// unused currently
		//var typeName = Zotero.ItemTypes.getName(itemType);
		var fieldName = Zotero.ItemFields.getName(field);
		
		// Fields in the items table are special cases
		switch (field) {
			case 'dateAdded':
			case 'dateModified':
			case 'itemType':
				return Zotero.getString("itemFields." + field);
		}
		
		// TODO: different labels for different item types
		
		try {
			_fieldCheck(field, 'getLocalizedString');
		}
		// TEMP
		catch (e) {
			try {
				asfasfa();
			}
			catch (e2) {
				Zotero.debug(e2);
			}
			Zotero.debug(e);
			throw (e);
		}
		
		return _fields[field].label ? _fields[field].label : Zotero.getString("itemFields." + fieldName);
	}
	
	
	function isValidForType(fieldID, itemTypeID) {
		_fieldCheck(fieldID, 'isValidForType');
		
		if (!_fields[fieldID]['itemTypes']) {
			return false;
		}
		
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID) {
		_fieldCheck(fieldID, 'isInteger');
		
		var ffid = _fields[fieldID]['formatID'];
		return _fieldFormats[ffid] ? _fieldFormats[ffid]['isInteger'] : false;
	}
	
	
	this.isCustom = function (fieldID) {
		_fieldCheck(fieldID, 'isCustom');
		
		return _fields[fieldID].custom;
	}
	
	
	/*
	 * Returns an array of fieldIDs for a given item type
	 */
	function getItemTypeFields(itemTypeID) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
		if (_itemTypeFields[itemTypeID]) {
			return _itemTypeFields[itemTypeID];
		}
		
		if (!itemTypeID) {
			throw("Invalid item type id '" + itemTypeID
				+ "' provided to getItemTypeFields()");
		}
		
		var sql = 'SELECT fieldID FROM itemTypeFieldsCombined '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		var fields = Zotero.DB.columnQuery(sql);
		
		_itemTypeFields[itemTypeID] = fields ? fields : [];
		return _itemTypeFields[itemTypeID];
	}
	
	
	function isBaseField(field) {
		_fieldCheck(field, arguments.callee.name);
		
		return _fields[field]['isBaseField'];
	}
	
	
	function isFieldOfBase(field, baseField) {
		var fieldID = _fieldCheck(field, 'isFieldOfBase');
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid field '" + baseField + '" for base field in ItemFields.getFieldIDFromTypeAndBase()');
		}
		
		if (fieldID == baseFieldID) {
			return true;
		}
		
		var typeFields = this.getTypeFieldsFromBase(baseFieldID);
		return typeFields.indexOf(fieldID) != -1;
	}
	
	
	function getBaseMappedFields() {
		return Zotero.DB.columnQuery("SELECT DISTINCT fieldID FROM baseFieldMappingsCombined");
	}
	
	
	/*
	 * Returns the fieldID of a type-specific field for a given base field
	 * 		or false if none
	 *
	 * Examples:
	 *
	 * 'audioRecording' and 'publisher' returns label's fieldID
	 * 'book' and 'publisher' returns publisher's fieldID
	 * 'audioRecording' and 'number' returns false
	 *
	 * Accepts names or ids
	 */
	function getFieldIDFromTypeAndBase(itemType, baseField) {
		var itemTypeID = Zotero.ItemTypes.getID(itemType);
		if (!itemTypeID) {
			throw ("Invalid item type '" + itemType + "' in ItemFields.getFieldIDFromTypeAndBase()");
		}
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid field '" + baseField + '" for base field in ItemFields.getFieldIDFromTypeAndBase()');
		}
		
		return _baseTypeFields[itemTypeID][baseFieldID];
	}
	
	
	/*
	 * Returns the fieldID of the base field for a given type-specific field
	 * 		or false if none
	 *
	 * Examples:
	 *
	 * 'audioRecording' and 'label' returns publisher's fieldID
	 * 'book' and 'publisher' returns publisher's fieldID
	 * 'audioRecording' and 'runningTime' returns false
	 *
	 * Accepts names or ids
	 */
	function getBaseIDFromTypeAndField(itemType, typeField) {
		var itemTypeID = Zotero.ItemTypes.getID(itemType);
		var typeFieldID = this.getID(typeField);
		
		if (!itemTypeID) {
			throw ("Invalid item type '" + itemType + "' in ItemFields.getBaseIDFromTypeAndField()");
		}
		
		_fieldCheck(typeField, 'getBaseIDFromTypeAndField');
		
		if (!this.isValidForType(typeFieldID, itemTypeID)) {
			throw ("'" + typeField + "' is not a valid field for '" + itemType + "' in ItemFields.getBaseIDFromTypeAndField()");
		}
		
		// If typeField is already a base field, just return that
		if (this.isBaseField(typeFieldID)) {
			return typeFieldID;
		}
		
		return Zotero.DB.valueQuery("SELECT baseFieldID FROM baseFieldMappingsCombined "
			+ "WHERE itemTypeID=? AND fieldID=?", [itemTypeID, typeFieldID]);
	}
	
	
	/*
	 * Returns an array of fieldIDs associated with a given base field
	 *
	 * e.g. 'publisher' returns fieldIDs for [university, studio, label, network]
	 */
	function getTypeFieldsFromBase(baseField, asNames) {
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid base field '" + baseField + '" in ItemFields.getTypeFieldsFromBase()');
		}
		
		if (asNames) {
			return _typeFieldNamesByBase[baseFieldID] ?
				_typeFieldNamesByBase[baseFieldID] : false;
		}
		
		return _typeFieldIDsByBase[baseFieldID] ?
			_typeFieldIDsByBase[baseFieldID] : false;
	}
	
	
	this.isAutocompleteField = function (field) {
		field = this.getName(field);
		
		var autoCompleteFields = [
			'journalAbbreviation',
			'seriesTitle',
			'seriesText',
			'repository',
			'callNumber',
			'archiveLocation',
			'language',
			'rights',
			
			// TEMP - NSF
			'programDirector',
			'institution',
			'discipline'
		];
		
		// Add the type-specific versions of these base fields
		var baseACFields = ['publisher', 'publicationTitle', 'type', 'medium', 'place'];
		autoCompleteFields = autoCompleteFields.concat(baseACFields);
		
		for (var i=0; i<baseACFields.length; i++) {
			var add = Zotero.ItemFields.getTypeFieldsFromBase(baseACFields[i], true)
			autoCompleteFields = autoCompleteFields.concat(add);
		}
		
		return autoCompleteFields.indexOf(field) != -1;
	}
	
	
	/**
	 * A long field expands into a multiline textbox while editing but displays
	 * as a single line in non-editing mode; newlines are not allowed
	 */
	this.isLong = function (field) {
		field = this.getName(field);
		var fields = [
			'title'
		];
		return fields.indexOf(field) != -1;
	}
	
	
	/**
	 * A multiline field displays as a multiline text box in editing mode
	 * and non-editing mode; newlines are allowed
	 */
	this.isMultiline = function (field) {
		field = this.getName(field);
		var fields = [
			'abstractNote',
			'extra',
			
			// TEMP - NSF
			'address'
		];
		return fields.indexOf(field) != -1;
	}
	
	
	this.reload = function () {
		_fieldsLoaded = false;
	}
	
	
	/**
	* Check whether a field is valid, throwing an exception if not
	* (since it should never actually happen)
	**/
	function _fieldCheck(field, func) {
		var fieldID = self.getID(field);
		if (!fieldID) {
			throw ("Invalid field '" + field + (func ? "' in ItemFields." + func + "()" : "'"));
		}
		return fieldID;
	}
	
	
	/*
	 * Returns hash array of itemTypeIDs for which a given field is valid
	 */
	function _getFieldItemTypes() {
		var sql = 'SELECT fieldID, itemTypeID FROM itemTypeFieldsCombined';
		
		var results = Zotero.DB.query(sql);
		
		if (!results) {
			throw ('No fields in itemTypeFields!');
		}
		var fields = new Array();
		for (var i=0; i<results.length; i++) {
			if (!fields[results[i]['fieldID']]) {
				fields[results[i]['fieldID']] = new Array();
			}
			fields[results[i]['fieldID']][results[i]['itemTypeID']] = true;
		}
		return fields;
	}
	
	
	/*
	 * Build a lookup table for base field mappings
	 */
	function _loadBaseTypeFields() {
		_typeFieldIDsByBase = {};
		_typeFieldNamesByBase = {};
		
		// Grab all fields, base field or not
		var sql = "SELECT IT.itemTypeID, F.fieldID AS baseFieldID, BFM.fieldID "
			+ "FROM itemTypesCombined IT LEFT JOIN fieldsCombined F "
			+ "LEFT JOIN baseFieldMappingsCombined BFM"
			+ " ON (IT.itemTypeID=BFM.itemTypeID AND F.fieldID=BFM.baseFieldID)";
		var rows = Zotero.DB.query(sql);
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappingsCombined";
		var baseFields = Zotero.DB.columnQuery(sql);
		
		var fields = [];
		for each(var row in rows) {
			if (!fields[row.itemTypeID]) {
				fields[row.itemTypeID] = [];
			}
			if (row.fieldID) {
				fields[row.itemTypeID][row.baseFieldID] = row.fieldID;
			}
			// If a base field and already valid for the type, just use that
			else if (isBaseField(row.baseFieldID) &&
					isValidForType(row.baseFieldID, row.itemTypeID)) {
				fields[row.itemTypeID][row.baseFieldID] = row.baseFieldID;
			}
			// Set false for other fields so that we don't need to test for
			// existence
			else {
				fields[row.itemTypeID][row.baseFieldID] = false;
			}
		}
		
		_baseTypeFields = fields;
		
		
		var sql = "SELECT baseFieldID, fieldID, fieldName "
			+ "FROM baseFieldMappingsCombined JOIN fieldsCombined USING (fieldID)";
		var rows = Zotero.DB.query(sql);
		for each(var row in rows) {
			if (!_typeFieldIDsByBase[row['baseFieldID']]) {
				_typeFieldIDsByBase[row['baseFieldID']] = [];
				_typeFieldNamesByBase[row['baseFieldID']] = [];
			}
			_typeFieldIDsByBase[row['baseFieldID']].push(row['fieldID']);
			_typeFieldNamesByBase[row['baseFieldID']].push(row['fieldName']);
		}
	}
	
	
	/*
	 * Load all fields into an internal hash array
	 */
	function _loadFields() {
		_fields = {};
		_fieldsFormats = [];
		_itemTypeFields = [];
		
		var result = Zotero.DB.query('SELECT * FROM fieldFormats');
		
		for (var i=0; i<result.length; i++) {
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		var fields = Zotero.DB.query('SELECT * FROM fieldsCombined');
		
		var fieldItemTypes = _getFieldItemTypes();
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappingsCombined";
		var baseFields = Zotero.DB.columnQuery(sql);
		
		for each(var field in fields) {
			_fields[field['fieldID']] = {
				id: field['fieldID'],
				name: field.fieldName,
				label: field.label,
				custom: !!field.custom,
				isBaseField: (baseFields.indexOf(field['fieldID']) != -1),
				formatID: field['fieldFormatID'],
				itemTypes: fieldItemTypes[field['fieldID']]
			};
			// Store by name as well as id
			_fields[field['fieldName']] = _fields[field['fieldID']];
		}
		
		_fieldsLoaded = true;
		
		_loadBaseTypeFields();
	}
}

