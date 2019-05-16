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


Zotero.ItemFields = new function() {
	// Private members
	var _fields = {};
	var _allFields = [];
	var _fieldsFormats = [];
	var _fieldsLoaded;
	var _itemTypeFieldsLoaded;
	var _fieldFormats = [];
	var _itemTypeFields = [];
	var _baseTypeFields = [];
	var _baseMappedFields = [];
	var _typeFieldIDsByBase = {};
	var _typeFieldNamesByBase = {};
	var _baseFieldIDsByTypeAndField = {};
	
	// Privileged methods
	this.getName = getName;
	this.getID = getID;
	this.isValidForType = isValidForType;
	this.isInteger = isInteger;
	this.getItemTypeFields = getItemTypeFields;
	this.isBaseField = isBaseField;
	this.isFieldOfBase = isFieldOfBase;
	this.getFieldIDFromTypeAndBase = getFieldIDFromTypeAndBase;
	this.getBaseIDFromTypeAndField = getBaseIDFromTypeAndField;
	this.getTypeFieldsFromBase = getTypeFieldsFromBase;
	
	
	/*
	 * Load all fields into an internal hash array
	 */
	this.init = Zotero.Promise.coroutine(function* () {
		_fields = {};
		_fieldsFormats = [];
		
		var result = yield Zotero.DB.queryAsync('SELECT * FROM fieldFormats');
		
		for (var i=0; i<result.length; i++) {
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		var fields = yield Zotero.DB.queryAsync('SELECT * FROM fieldsCombined');
		
		var fieldItemTypes = yield _getFieldItemTypes();
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappingsCombined";
		var baseFields = yield Zotero.DB.columnQueryAsync(sql);
		
		for (let field of fields) {
			let isBaseField = baseFields.includes(field.fieldID);
			let label;
			try {
				label = field.label || Zotero.Schema.globalSchemaLocale.fields[field.fieldName];
			}
			// Some base fields aren't localized
			catch (e) {
				if (!isBaseField) {
					throw e;
				}
			}
			
			_fields[field.fieldID] = {
				id: field.fieldID,
				name: field.fieldName,
				label,
				custom: !!field.custom,
				isBaseField: baseFields.includes(field.fieldID),
				formatID: field.fieldFormatID,
				itemTypes: fieldItemTypes[field.fieldID]
			};
			// Store by name as well as id
			_fields[field.fieldName] = _fields[field.fieldID];
			_allFields.push({
				id: field.fieldID,
				name: field.fieldName
			});
		}
		
		_fieldsLoaded = true;
		yield _loadBaseTypeFields();
		yield _loadItemTypeFields();
	});
	
	
	/*
	 * Return the fieldID for a passed fieldID or fieldName
	 */
	function getID(field) {
		if (!_fieldsLoaded) {
			throw new Zotero.Exception.UnloadedDataException("Item field data not yet loaded");
		}
		
		if (typeof field == 'number') {
			return _fields[field] ? field : false;
		}
		
		return _fields[field] ? _fields[field]['id'] : false;
	}
	
	
	/*
	 * Return the fieldName for a passed fieldID or fieldName
	 */
	function getName(field) {
		if (!_fieldsLoaded) {
			throw new Zotero.Exception.UnloadedDataException("Item field data not yet loaded");
		}
		
		return _fields[field] ? _fields[field]['name'] : false;
	}
	
	
	this.getAll = function () {
		return [..._allFields];
	};
	
	
	this.getLocalizedString = function (field) {
		if (arguments.length == 2) {
			Zotero.warn("Zotero.ItemFields.getLocalizedString() no longer takes two arguments "
				+ "-- update your code");
			field = arguments[1];
		}
		
		var fieldName = this.getName(field);
		
		// Fields in the items table are special cases
		switch (field) {
			case 'dateAdded':
			case 'dateModified':
			case 'itemType':
				return Zotero.Schema.globalSchemaLocale.fields[field];
		}
		
		// TODO: different labels for different item types
		
		_fieldCheck(field);
		
		return _fields[field].label;
	};
	
	
	function isValidForType(fieldID, itemTypeID) {
		fieldID = getID(fieldID);
		if (!fieldID) return false;
		
		if (!_fields[fieldID]['itemTypes']) {
			return false;
		}
		
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID) {
		_fieldCheck(fieldID);
		
		var ffid = _fields[fieldID]['formatID'];
		return _fieldFormats[ffid] ? _fieldFormats[ffid]['isInteger'] : false;
	}
	
	
	this.isDate = function (field) {
		var fieldID = this.getID(field);
		var fieldName = this.getName(field);
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date')) {
			return true;
		}
		if (Zotero.Schema.globalSchemaMeta.fields[fieldName]) {
			return Zotero.Schema.globalSchemaMeta.fields[fieldName].type == 'date'
		}
		return false;
	};
	
	
	this.isCustom = function (fieldID) {
		_fieldCheck(fieldID);
		
		return _fields[fieldID].custom;
	}
	
	
	/*
	 * Returns an array of fieldIDs for a given item type
	 */
	function getItemTypeFields(itemTypeID) {
		if (!itemTypeID) {
			let e = new Error("Invalid item type id '" + itemTypeID + "'");
			e.name = "ZoteroInvalidDataError";
			throw e;
		}
		
		if (!_itemTypeFieldsLoaded) {
			throw new Zotero.Exception.UnloadedDataException("Item field data not yet loaded");
		}
		
		if (!_itemTypeFields[itemTypeID]) {
			throw new Error("Item type field data not found for itemTypeID " + itemTypeID);
		}
		
		return [..._itemTypeFields[itemTypeID]];
	}
	
	
	function isBaseField(field) {
		_fieldCheck(field);
		
		return _fields[field]['isBaseField'];
	}
	
	
	function isFieldOfBase(field, baseField) {
		var fieldID = _fieldCheck(field);
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw new Error("Invalid field '" + baseField + '" for base field');
		}
		
		if (fieldID == baseFieldID) {
			return true;
		}
		
		var typeFields = this.getTypeFieldsFromBase(baseFieldID);
		return typeFields.indexOf(fieldID) != -1;
	}
	
	
	this.getBaseMappedFields = function () {
		return _baseMappedFields.concat();
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
			throw new Error("Invalid item type '" + itemType + "'");
		}
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw new Error("Invalid field '" + baseField + '" for base field');
		}
		
		// If field isn't a base field, return it if it's valid for the type
		if (!this.isBaseField(baseFieldID)) {
			return this.isValidForType(baseFieldID, itemTypeID) ? baseFieldID : false;
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
			throw new Error("Invalid item type '" + itemType + "'");
		}
		
		_fieldCheck(typeField);
		
		if (!this.isValidForType(typeFieldID, itemTypeID)) {
			throw new Error("'" + typeField + "' is not a valid field for '" + itemType + "'");
		}
		
		// If typeField is already a base field, just return that
		if (this.isBaseField(typeFieldID)) {
			return typeFieldID;
		}
		
		if (!_baseFieldIDsByTypeAndField[itemTypeID]) return false;
		return _baseFieldIDsByTypeAndField[itemTypeID][typeFieldID] || false;
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
			[..._typeFieldIDsByBase[baseFieldID]] : false;
	}
	
	
	this.isAutocompleteField = function (field) {
		field = this.getName(field);
		
		var autoCompleteFields = [
			'journalAbbreviation',
			'series',
			'seriesTitle',
			'seriesText',
			'libraryCatalog',
			'callNumber',
			'archive',
			'archiveLocation',
			'language',
			'programmingLanguage',
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
			'title',
			'bookTitle'
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
	
	
	/**
	* Check whether a field is valid, throwing an exception if not
	* (since it should never actually happen)
	**/
	function _fieldCheck(field) {
		var fieldID = Zotero.ItemFields.getID(field);
		if (!fieldID) {
			Zotero.debug((new Error).stack, 1);
			throw new Error(`Invalid field '${field}`);
		}
		return fieldID;
	}
	
	
	/*
	 * Returns hash array of itemTypeIDs for which a given field is valid
	 */
	var _getFieldItemTypes = Zotero.Promise.coroutine(function* () {
		var sql = 'SELECT fieldID, itemTypeID FROM itemTypeFieldsCombined';
		var results = yield Zotero.DB.queryAsync(sql);
		
		if (!results) {
			throw ('No fields in itemTypeFields!');
		}
		var fields = [];
		for (let i=0; i<results.length; i++) {
			if (!fields[results[i].fieldID]) {
				fields[results[i].fieldID] = [];
			}
			fields[results[i].fieldID][results[i].itemTypeID] = true;
		}
		return fields;
	});
	
	
	/*
	 * Build a lookup table for base field mappings
	 */
	var _loadBaseTypeFields = Zotero.Promise.coroutine(function* () {
		_typeFieldIDsByBase = {};
		_typeFieldNamesByBase = {};
		
		// Grab all fields, base field or not
		var sql = "SELECT IT.itemTypeID, F.fieldID AS baseFieldID, BFM.fieldID "
			+ "FROM itemTypesCombined IT LEFT JOIN fieldsCombined F "
			+ "LEFT JOIN baseFieldMappingsCombined BFM"
			+ " ON (IT.itemTypeID=BFM.itemTypeID AND F.fieldID=BFM.baseFieldID)";
		var rows = yield Zotero.DB.queryAsync(sql);
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappingsCombined";
		var baseFields = yield Zotero.DB.columnQueryAsync(sql);
		
		var fields = [];
		for (let row of rows) {
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
		
		var sql = "SELECT itemTypeID, baseFieldID, fieldID, fieldName "
			+ "FROM baseFieldMappingsCombined JOIN fieldsCombined USING (fieldID)";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			// Type fields by base
			if (!_typeFieldIDsByBase[row['baseFieldID']]) {
				_typeFieldIDsByBase[row['baseFieldID']] = [];
				_typeFieldNamesByBase[row['baseFieldID']] = [];
			}
			_typeFieldIDsByBase[row['baseFieldID']].push(row['fieldID']);
			_typeFieldNamesByBase[row['baseFieldID']].push(row['fieldName']);
			
			// Base fields by type and field
			if (!_baseFieldIDsByTypeAndField[row.itemTypeID]) {
				_baseFieldIDsByTypeAndField[row.itemTypeID] = {};
			}
			_baseFieldIDsByTypeAndField[row.itemTypeID][row.fieldID] = row.baseFieldID;
			
		}
		
		// Get all fields mapped to base types
		sql = "SELECT DISTINCT fieldID FROM baseFieldMappingsCombined";
		_baseMappedFields = yield Zotero.DB.columnQueryAsync(sql);
		
		_baseTypeFieldsLoaded = true;
	});
	
	
	var _loadItemTypeFields = Zotero.Promise.coroutine(function* () {
		var sql = 'SELECT itemTypeID, fieldID FROM itemTypeFieldsCombined ORDER BY orderIndex';
		var rows = yield Zotero.DB.queryAsync(sql);
		
		_itemTypeFields = {
			[Zotero.ItemTypes.getID('note')]: [] // Notes have no fields
		};
		
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			let itemTypeID = row.itemTypeID;
			if (!_itemTypeFields[itemTypeID]) {
				_itemTypeFields[itemTypeID] = [];
			}
			_itemTypeFields[itemTypeID].push(row.fieldID);
		}
		
		_itemTypeFieldsLoaded = true;
	});
}
