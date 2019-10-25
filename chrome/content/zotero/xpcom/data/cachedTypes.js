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
 * Base function for retrieving ids and names of static types stored in the DB
 * (e.g. creatorType, fileType, charset, itemType)
 *
 * Extend using the following code within a child constructor:
 *
 * 	Zotero.CachedTypes.apply(this, arguments);
 *  this.constructor.prototype = new Zotero.CachedTypes();
 *
 * And the following properties:
 *
 *	this._typeDesc = '';
 *	this._typeDescPlural = '';
 *	this._idCol = '';
 *	this._nameCol = '';
 *	this._table = '';
 *
 * Optional properties:
 *
 *  this._allowAdd: Allow new types to be added via .add(name)
 *	this._ignoreCase: Ignore case when looking for types, and add new types as lowercase
 *
 * And add .init() to zotero.js
 */
Zotero.CachedTypes = function() {
	this._types = null;
	this._typesArray = null;
	var self = this;
	
	// Override these variables in child classes
	this._typeDesc = '';
	this._idCol = '';
	this._nameCol = '';
	this._table = '';
	this._allowAdd = false;
	this._ignoreCase = false;
	this._hasCustom = false;
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		this._types = {};
		this._typesArray = [];
		
		var types = yield this._getTypesFromDB();
		for (let i=0; i<types.length; i++) {
			this._cacheTypeData(types[i]);
		}
	});
	
	
	this.getName = function (idOrName) {
		if (!this._types) {
			throw new Zotero.Exception.UnloadedDataException(
				Zotero.Utilities.capitalize(this._typeDesc) + " data not yet loaded"
			);
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!this._types['_' + idOrName]) {
			Zotero.debug(`Unknown ${this._typeDesc} '${idOrName}'`, 1);
			return '';
		}
		
		return this._types['_' + idOrName]['name'];
	}
	
	
	this.getID = function (idOrName) {
		if (!this._types) {
			throw new Zotero.Exception.UnloadedDataException(
				Zotero.Utilities.capitalize(this._typeDesc) + " data not yet loaded"
			);
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!this._types['_' + idOrName]) {
			Zotero.debug(`Unknown ${this._typeDesc} '${idOrName}'`, 1);
			return false;
		}
		
		return this._types['_' + idOrName]['id'];
	}
	
	
	this.getAll = this.getTypes = function () {
		if (!this._typesArray) {
			throw new Zotero.Exception.UnloadedDataException(
				Zotero.Utilities.capitalize(this._typeDesc) + " data not yet loaded"
			);
		}
		return this._typesArray;
	}
	
	
	// Currently used only for item types
	this.isCustom = function (idOrName) {
		return this._types['_' + idOrName] && this._types['_' + idOrName].custom ? this._types['_' + idOrName].custom : false;
	}
	
	
	/**
	 * Add a new type to the data and return its id. If the type already exists, return its id.
	 *
	 * @param {String} name - Type name to add
	 * @return {Integer|False} - The type id (new or existing), or false if invalid type name
	 */
	this.add = Zotero.Promise.coroutine(function* (name) {
		if (!this._allowAdd) {
			throw new Error("New " + this._typeDescPlural + " cannot be added");
		}
		
		if (typeof name != 'string' || name === "") {
			throw new Error("'name' must be a string");
		}
		
		var id = this.getID(name);
		if (id) {
			return id;
		}
		
		if (this._ignoreCase) {
			name = name.toLowerCase();
		}
		
		var allow = this._valueCheck(name);
		if (!allow) {
			return false;
		}
		
		var sql = "INSERT INTO " + this._table + " (" + this._nameCol + ") VALUES (?)";
		yield Zotero.DB.queryAsync(sql, name);
		
		sql = "SELECT " + this._idCol + " FROM " + this._table + " WHERE " + this._nameCol + "=?";
		var id = yield Zotero.DB.valueQueryAsync(sql, name);
		
		this._cacheTypeData({
			id: id,
			name: name
		});
		
		return id;
	});
	
	
	this._valueCheck = function (name) {
		return true;
	}
	
	
	/**
	 * @return {Promise}
	 */
	this._getTypesFromDB = function (where, params) {
		return Zotero.DB.queryAsync(
			'SELECT ' + this._idCol + ' AS id, '
				+ this._nameCol + ' AS name'
				+ (this._hasCustom ? ', custom' : '')
				+ ' FROM ' + this._table
				+ (where ? ' ' + where : ''),
			params ? params : false
		);
	};
	
	
	this._cacheTypeData = function (type) {
		// Store as both id and name for access by either
		var typeData = {
			id: type.id,
			name: type.name,
			custom: this._hasCustom ? !!type.custom : false
		}
		this._types['_' + type.id] = typeData;
		if (this._ignoreCase) {
			this._types['_' + type.name.toLowerCase()] = this._types['_' + type.id];
		}
		else {
			this._types['_' + type.name] = this._types['_' + type.id];
		}
		this._typesArray.push(typeData);
	}
}


Zotero.CreatorTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.isValidForItemType = isValidForItemType;
	
	this._typeDesc = 'creator type';
	this._typeDescPlural = 'creator types';
	this._idCol = 'creatorTypeID';
	this._nameCol = 'creatorType';
	this._table = 'creatorTypes';
	
	var _primaryIDCache;
	var _hasCreatorTypeCache = {};
	var _creatorTypesByItemType = {};
	var _isValidForItemType = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield this.constructor.prototype.init.apply(this);
		
		var sql = "SELECT itemTypeID, creatorTypeID AS id, creatorType AS name, primaryField "
			+ "FROM itemTypeCreatorTypes NATURAL JOIN creatorTypes";
		var rows = yield Zotero.DB.queryAsync(sql);
		_creatorTypesByItemType = {};
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			let itemTypeID = row.itemTypeID;
			if (!_creatorTypesByItemType[itemTypeID]) {
				_creatorTypesByItemType[itemTypeID] = [];
			}
			_creatorTypesByItemType[itemTypeID].push({
				id: row.id,
				name: row.name,
				primaryField: row.primaryField,
				localizedName: this.getLocalizedString(row.name)
			});
		}
		// Sort primary field first, then by localized name
		for (let itemTypeID in _creatorTypesByItemType) {
			_creatorTypesByItemType[itemTypeID].sort((a, b) => {
				if (a.primaryField != b.primaryField) return b.primaryField - a.primaryField;
				return Zotero.localeCompare(a.localizedName, b.localizedName);
			});
			_creatorTypesByItemType[itemTypeID].forEach((x) => {
				delete x.primaryField;
				delete x.localizedName;
			});
		}
		
		// Load primary creator type ids
		_primaryIDCache = {};
		var sql = "SELECT itemTypeID, creatorTypeID FROM itemTypeCreatorTypes "
			+ "WHERE primaryField=1";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			_primaryIDCache[row.itemTypeID] = row.creatorTypeID;
		}
	});
	
	
	this.getTypesForItemType = function (itemTypeID) {
		if (!_creatorTypesByItemType[itemTypeID]) {
			return [];
		}
		return _creatorTypesByItemType[itemTypeID];
	}
	
	
	function isValidForItemType(creatorTypeID, itemTypeID) {
		if (_isValidForItemType[itemTypeID] && typeof _isValidForItemType[itemTypeID][creatorTypeID] != 'undefined') {
			return _isValidForItemType[itemTypeID][creatorTypeID];
		}
		
		var valid = false;
		var types = this.getTypesForItemType(itemTypeID);
		for (let type of types) {
			if (type.id == creatorTypeID) {
				valid = true;
				break;
			}
		}
		
		if (!_isValidForItemType[itemTypeID]) {
			_isValidForItemType[itemTypeID] = {};
		}
		_isValidForItemType[itemTypeID][creatorTypeID] = valid;
		return valid;
	}
	
	
	this.getLocalizedString = function(idOrName) {
		var name = this.getName(idOrName);
		return Zotero.Schema.globalSchemaLocale.creatorTypes[name];
	}
	
	
	this.itemTypeHasCreators = function (itemTypeID) {
		if (typeof _hasCreatorTypeCache[itemTypeID] != 'undefined') {
			return _hasCreatorTypeCache[itemTypeID];
		}
		_hasCreatorTypeCache[itemTypeID] = !!this.getTypesForItemType(itemTypeID).length;
		return _hasCreatorTypeCache[itemTypeID];
	}
	
	
	this.getPrimaryIDForType = function (itemTypeID) {
		if (!_primaryIDCache) {
			throw new Zotero.Exception.UnloadedDataException(
				"Primary creator types not yet loaded"
			);
		}
		
		if (_primaryIDCache[itemTypeID] === undefined) {
			return false;
		}
		
		return _primaryIDCache[itemTypeID];
	}
}


Zotero.ItemTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.customIDOffset = 10000;
	
	this._typeDesc = 'item type';
	this._typeDescPlural = 'item types';
	this._idCol = 'itemTypeID';
	this._nameCol = 'typeName';
	this._table = 'itemTypesCombined';
	this._hasCustom = true;
	
	var _primaryTypeNames = ['book', 'bookSection', 'journalArticle', 'newspaperArticle', 'document'];
	var _primaryTypes;
	var _secondaryTypes;
	var _hiddenTypes;
	
	var _numPrimary = 5;
	
	var _customImages = {};
	var _customLabels = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield this.constructor.prototype.init.apply(this);
		
		_primaryTypes = yield this._getTypesFromDB(
			`WHERE typeName IN ('${_primaryTypeNames.join("', '")}')`
		);
		
		// Secondary types
		_secondaryTypes = yield this._getTypesFromDB(
			`WHERE display != 0 AND display NOT IN ('${_primaryTypeNames.join("', '")}')`
		);
		
		// Hidden types
		_hiddenTypes = yield this._getTypesFromDB('WHERE display=0')
		
		// Custom labels and icons
		var sql = "SELECT customItemTypeID AS id, label, icon FROM customItemTypes";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			let id = row.id;
			_customLabels[id] = row.label;
			_customImages[id] = row.icon;
		}
	});
	
	
	this.getPrimaryTypes = function () {
		if (!_primaryTypes) {
			throw new Zotero.Exception.UnloadedDataException("Primary item type data not yet loaded");
		}
		
		var mru = Zotero.Prefs.get('newItemTypeMRU');
		if (mru && mru.length) {
			// Get types from the MRU list
			mru = new Set(
				mru.split(',')
				.slice(0, _numPrimary)
				.map(name => this.getName(name))
				// Ignore 'webpage' item type
				.filter(name => name && name != 'webpage')
			);
			
			// Add types from defaults until we reach our limit
			for (let i = 0; i < _primaryTypes.length && mru.size < _numPrimary; i++) {
				mru.add(_primaryTypes[i].name);
			}
			
			return Array.from(mru).map(name => ({ id: this.getID(name), name }));
		}
		
		return _primaryTypes;
	}

	this.getSecondaryTypes = function () {
		if (!_secondaryTypes) {
			throw new Zotero.Exception.UnloadedDataException("Secondary item type data not yet loaded");
		}
		return _secondaryTypes;
	}
	
	this.getHiddenTypes = function () {
		if (!_hiddenTypes) {
			throw new Zotero.Exception.UnloadedDataException("Hidden item type data not yet loaded");
		}
		return _hiddenTypes;
	}
	
	this.getLocalizedString = function (idOrName) {
		var typeName = this.getName(idOrName);
		
		// For custom types, use provided label
		if (this.isCustom(idOrName)) {
			var id = this.getID(idOrName) - this.customIDOffset;
			if (!_customLabels[id]) {
				throw new Error("Label not available for custom field " + idOrName);
			}
			return _customLabels[id];
		}
		
		return Zotero.Schema.globalSchemaLocale.itemTypes[typeName];
	}
	
	this.getImageSrc = function (itemType) {
		var suffix = Zotero.hiDPISuffix;
		
		if (this.isCustom(itemType)) {
			var id = this.getID(itemType) - this.customIDOffset;
			if (!_customImages[id]) {
				throw new Error("Image not available for custom field " + itemType);
			}
			return _customImages[id];
		}
		
		switch (itemType) {
			// Use treeitem.png
			case 'attachment-file':
			case 'document':
				break;
			
			// HiDPI images available
			case 'attachment-link':
			case 'attachment-pdf':
			case 'attachment-pdf-link':
			case 'attachment-snapshot':
			case 'attachment-web-link':
			case 'artwork':
			case 'audioRecording':
			case 'bill':
			case 'blogPost':
			case 'book':
			case 'bookSection':
			case 'case':
			case 'computerProgram':
			case 'conferencePaper':
			case 'dictionaryEntry':
			case 'email':
			case 'encyclopediaArticle':
			case 'film':
			case 'forumPost':
			case 'hearing':
			case 'instantMessage':
			case 'interview':
			case 'journalArticle':
			case 'letter':
			case 'magazineArticle':
			case 'manuscript':
			case 'newspaperArticle':
			case 'note':
			case 'patent':
			case 'presentation':
			case 'report':
			case 'statute':
			case 'thesis':
			case 'webpage':
				return "chrome://zotero/skin/treeitem-" + itemType + suffix + ".png";
			
			// No HiDPI images available
			case 'map':
			case 'podcast':
			case 'radioBroadcast':
			case 'tvBroadcast':
			case 'videoRecording':
				return "chrome://zotero/skin/treeitem-" + itemType + ".png";
		}
		
		return "chrome://zotero/skin/treeitem" + suffix + ".png";
	}
}


Zotero.FileTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'file type';
	this._typeDescPlural = 'file types';
	this._idCol = 'fileTypeID';
	this._nameCol = 'fileType';
	this._table = 'fileTypes';
	
	/**
	 * @return {Promise<Integer>} fileTypeID
	 */
	this.getIDFromMIMEType = function (mimeType) {
		var sql = "SELECT fileTypeID FROM fileTypeMIMETypes "
			+ "WHERE ? LIKE mimeType || '%'";
		return Zotero.DB.valueQueryAsync(sql, [mimeType]);
	};
}


Zotero.CharacterSets = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'character set';
	this._typeDescPlural = 'character sets';
	this._idCol = 'charsetID';
	this._nameCol = 'charset';
	this._table = 'charsets';
	this._ignoreCase = true;
	
	
	// Converts charset label to charset name
	// https://encoding.spec.whatwg.org/#names-and-labels
	// @param {String} charset
	// @return {String|Boolean} Normalized charset name or FALSE if not recognized
	this.toCanonical = function (charset) {
		let canonical = charsetMap[charset.trim().toLowerCase()];
		if (!canonical) {
			Zotero.debug("Unrecognized charset: " + charset);
			return false;
		}
		return canonical;
	};
	
	// Normalizes charset label to conform to DOM standards
	// https://dom.spec.whatwg.org/#dom-document-characterset
	// @param {String} charset
	// @param {Boolean} mozCompat Whether to return a Mozilla-compatible label
	//   for use in Gecko internal APIs.
	//   https://developer.mozilla.org/en-US/docs/Gecko/Character_sets_supported_by_Gecko
	// @return {String|Boolean} Normalized label or FALSE is not recognized
	this.toLabel = function (charset, mozCompat) {
		charset = this.toCanonical(charset);
		if (!charset) return false;
		
		if (mozCompat && charset == 'gbk') return charset; // See https://developer.mozilla.org/en-US/docs/Gecko/Character_sets_supported_by_Gecko
		
		return compatibilityNames[charset];
	}
	
	// From https://encoding.spec.whatwg.org/#names-and-labels
	// Don't use this, use charsetMap. See below
	let charsetList = {
		"utf-8": ["unicode-1-1-utf-8", "utf-8", "utf8"],
		"ibm866": ["866", "cp866", "csibm866", "ibm866"],
		"iso-8859-2": ["csisolatin2", "iso-8859-2", "iso-ir-101", "iso8859-2", "iso88592", "iso_8859-2", 
			"iso_8859-2:1987","l2", "latin2"],
		"iso-8859-3": ["csisolatin3", "iso-8859-3", "iso-ir-109", "iso8859-3", "iso88593", "iso_8859-3", 
			"iso_8859-3:1988","l3", "latin3"],
		"iso-8859-4": ["csisolatin4", "iso-8859-4", "iso-ir-110", "iso8859-4", "iso88594", "iso_8859-4", 
			"iso_8859-4:1988","l4", "latin4"],
		"iso-8859-5": ["csisolatincyrillic", "cyrillic", "iso-8859-5", "iso-ir-144", "iso8859-5", "iso88595", "iso_8859-5", 
			"iso_8859-5:1988"],
		"iso-8859-6": ["arabic", "asmo-708", "csiso88596e", "csiso88596i", "csisolatinarabic", "ecma-114", "iso-8859-6", "iso-8859-6-e", "iso-8859-6-i", "iso-ir-127", "iso8859-6", "iso88596", "iso_8859-6", 
			"iso_8859-6:1987"],
		"iso-8859-7": ["csisolatingreek", "ecma-118", "elot_928", "greek", "greek8", "iso-8859-7", "iso-ir-126", "iso8859-7", "iso88597", "iso_8859-7", 
			"iso_8859-7:1987","sun_eu_greek"],
		"iso-8859-8": ["csiso88598e", "csisolatinhebrew", "hebrew", "iso-8859-8", "iso-8859-8-e", "iso-ir-138", "iso8859-8", "iso88598", "iso_8859-8", 
			"iso_8859-8:1988","visual"],
		"iso-8859-8-i": ["csiso88598i", "iso-8859-8-i", "logical"],
		"iso-8859-10": ["csisolatin6", "iso-8859-10", "iso-ir-157", "iso8859-10", "iso885910", "l6", "latin6"],
		"iso-8859-13": ["iso-8859-13", "iso8859-13", "iso885913"],
		"iso-8859-14": ["iso-8859-14", "iso8859-14", "iso885914"],
		"iso-8859-15": ["csisolatin9", "iso-8859-15", "iso8859-15", "iso885915", "iso_8859-15", "l9"],
		"iso-8859-16": ["iso-8859-16"],
		"koi8-r": ["cskoi8r", "koi", "koi8", "koi8-r", "koi8_r"],
		"koi8-u": ["koi8-u"],
		"macintosh": ["csmacintosh", "mac", "macintosh", "x-mac-roman"],
		"windows-874": ["dos-874", "iso-8859-11", "iso8859-11", "iso885911", "tis-620", "windows-874"],
		"windows-1250": ["cp1250", "windows-1250", "x-cp1250"],
		"windows-1251": ["cp1251", "windows-1251", "x-cp1251"],
		"windows-1252": [
			"ansi_x3.4-1968","ascii", "cp1252", "cp819", "csisolatin1", "ibm819", "iso-8859-1", "iso-ir-100", "iso8859-1", "iso88591", "iso_8859-1", 
			"iso_8859-1:1987","l1", "latin1", "us-ascii", "windows-1252", "x-cp1252"],
		"windows-1253": ["cp1253", "windows-1253", "x-cp1253"],
		"windows-1254": ["cp1254", "csisolatin5", "iso-8859-9", "iso-ir-148", "iso8859-9", "iso88599", "iso_8859-9", 
			"iso_8859-9:1989","l5", "latin5", "windows-1254", "x-cp1254"],
		"windows-1255": ["cp1255", "windows-1255", "x-cp1255"],
		"windows-1256": ["cp1256", "windows-1256", "x-cp1256"],
		"windows-1257": ["cp1257", "windows-1257", "x-cp1257"],
		"windows-1258": ["cp1258", "windows-1258", "x-cp1258"],
		"x-mac-cyrillic": ["x-mac-cyrillic", "x-mac-ukrainian"],
		"gbk": ["chinese", "csgb2312", "csiso58gb231280", "gb2312", "gb_2312", "gb_2312-80", "gbk", "iso-ir-58", "x-gbk"],
		"gb18030": ["gb18030"],
		"big5": ["big5", "cn-big5", "csbig5", "x-x-big5"],
		"big5-hkscs": ["big5-hkscs"], // see https://bugzilla.mozilla.org/show_bug.cgi?id=912470
		"euc-jp": ["cseucpkdfmtjapanese", "euc-jp", "x-euc-jp"],
		"iso-2022-jp": ["csiso2022jp", "iso-2022-jp"],
		"shift_jis": ["csshiftjis", "ms_kanji", "shift-jis", "shift_jis", "sjis", "windows-31j", "x-sjis"],
		"euc-kr": ["cseuckr", "csksc56011987", "euc-kr", "iso-ir-149", "korean", "ks_c_5601-1987", "ks_c_5601-1989", "ksc5601", "ksc_5601", "windows-949"],
		"replacement": ["csiso2022kr", "hz-gb-2312", "iso-2022-cn", "iso-2022-cn-ext", "iso-2022-kr"],
		"utf-16be": ["utf-16be"],
		"utf-16le": ["utf-16", "utf-16le"],
		"x-user-defined": ["x-user-defined"]
	}
	
	// As per https://dom.spec.whatwg.org/#dom-document-characterset
	let compatibilityNames = {
		"utf-8": "UTF-8",
		"ibm866": "IBM866",
		"iso-8859-2": "ISO-8859-2",
		"iso-8859-3": "ISO-8859-3",
		"iso-8859-4": "ISO-8859-4",
		"iso-8859-5": "ISO-8859-5",
		"iso-8859-6": "ISO-8859-6",
		"iso-8859-7": "ISO-8859-7",
		"iso-8859-8": "ISO-8859-8",
		"iso-8859-8-i": "ISO-8859-8-I",
		"iso-8859-10": "ISO-8859-10",
		"iso-8859-13": "ISO-8859-13",
		"iso-8859-14": "ISO-8859-14",
		"iso-8859-15": "ISO-8859-15",
		"iso-8859-16": "ISO-8859-16",
		"koi8-r": "KOI8-R",
		"koi8-u": "KOI8-U",
		"gbk": "GBK",
		"big5": "Big5",
		"euc-jp": "EUC-JP",
		"iso-2022-jp": "ISO-2022-JP",
		"shift_jis": "Shift_JIS",
		"euc-kr": "EUC-KR",
		"utf-16be": "UTF-16BE",
		"utf-16le": "UTF-16LE"
	};
	
	let charsetMap = {};
	for (let canonical in charsetList) {
		charsetMap[canonical.toLowerCase()] = canonical;
		charsetList[canonical].forEach((c) => charsetMap[c.toLowerCase()] = canonical);
		
		if (!compatibilityNames[canonical]) {
			compatibilityNames[canonical] = canonical;
		}
	}
	
	// Clear charsetList
	charsetList = null;
}


Zotero.RelationPredicates = new function () {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'relation predicate';
	this._typeDescPlural = 'relation predicates';
	this._idCol = 'predicateID';
	this._nameCol = 'predicate';
	this._table = 'relationPredicates';
	this._ignoreCase = false;
	this._allowAdd = true;
}
