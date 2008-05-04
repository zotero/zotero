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
		var fieldName = this.getName(field);
		
		// Fields in the items table are special cases
		switch (field) {
			case 'dateAdded':
			case 'dateModified':
			case 'itemType':
				fieldName = field;
		}
		
		// TODO: different labels for different item types
		
		return Zotero.getString("itemFields." + fieldName);
	}
	
	
	function isValidForType(fieldID, itemTypeID) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
		_fieldCheck(fieldID, 'isValidForType');
		
		if (!_fields[fieldID]['itemTypes']) {
			return false;
		}
		
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
		_fieldCheck(fieldID, 'isInteger');
		
		var ffid = _fields[fieldID]['formatID'];
		return _fieldFormats[ffid] ? _fieldFormats[ffid]['isInteger'] : false;
	}
	
	
	/*
	 * Returns an array of fieldIDs for a given item type
	 */
	function getItemTypeFields(itemTypeID) {
		if (_itemTypeFields[itemTypeID]) {
			return _itemTypeFields[itemTypeID];
		}
		
		if (!itemTypeID) {
			throw("Invalid item type id '" + itemTypeID
				+ "' provided to getItemTypeFields()");
		}
		
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		var fields = Zotero.DB.columnQuery(sql);
		
		_itemTypeFields[itemTypeID] = fields ? fields : [];
		return _itemTypeFields[itemTypeID];
	}
	
	
	function isBaseField(field) {
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
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
		return Zotero.DB.columnQuery("SELECT DISTINCT fieldID FROM baseFieldMappings");
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
		if (!_fieldsLoaded) {
			_loadFields();
		}
		
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
		
		return Zotero.DB.valueQuery("SELECT baseFieldID FROM baseFieldMappings "
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
		var sql = 'SELECT fieldID, itemTypeID FROM itemTypeFields';
		
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
		// Grab all fields, base field or not
		var sql = "SELECT IT.itemTypeID, F.fieldID AS baseFieldID, BFM.fieldID "
			+ "FROM itemTypes IT LEFT JOIN fields F "
			+ "LEFT JOIN baseFieldMappings BFM"
			+ " ON (IT.itemTypeID=BFM.itemTypeID AND F.fieldID=BFM.baseFieldID)";
		var rows = Zotero.DB.query(sql);
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappings";
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
			+ "FROM baseFieldMappings JOIN fields USING (fieldID)";
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
		var result = Zotero.DB.query('SELECT * FROM fieldFormats');
		
		for (var i=0; i<result.length; i++) {
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		var fields = Zotero.DB.query('SELECT * FROM fields');
		
		var fieldItemTypes = _getFieldItemTypes();
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappings";
		var baseFields = Zotero.DB.columnQuery(sql);
		
		for each(var field in fields) {
			_fields[field['fieldID']] = {
				id: field['fieldID'],
				name: field['fieldName'],
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

