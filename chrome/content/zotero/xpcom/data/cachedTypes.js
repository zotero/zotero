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
 *	this._typeDesc = 'c';
 *	this._idCol = '';
 *	this._nameCol = '';
 *	this._table = '';
 *	this._ignoreCase = false;
 * 
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
	this._ignoreCase = false;
	this._hasCustom = false;
	
	this.getName = getName;
	this.getID = getID;
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		this._types = {};
		this._typesArray = [];
		
		var types = yield this._getTypesFromDB();
		for (let i=0; i<types.length; i++) {
			this._cacheTypeData(types[i]);
		}
	});
	
	
	function getName(idOrName) {
		if (!this._types) {
			throw new Zotero.Exception.UnloadedDataException(
				this._typeDesc[0].toUpperCase() + this._typeDesc.substr(1) + " data not yet loaded"
			);
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!this._types['_' + idOrName]) {
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			Zotero.debug((new Error()).stack, 1);
			return '';
		}
		
		return this._types['_' + idOrName]['name'];
	}
	
	
	function getID(idOrName) {
		if (!this._types) {
			throw new Zotero.Exception.UnloadedDataException(
				this._typeDesc[0].toUpperCase() + this._typeDesc.substr(1) + " data not yet loaded"
			);
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!this._types['_' + idOrName]) {
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			Zotero.debug((new Error()).stack, 1);
			return false;
		}
		
		return this._types['_' + idOrName]['id'];
	}
	
	
	this.getTypes = function () {
		if (!this._typesArray) {
			throw new Zotero.Exception.UnloadedDataException(
				this._typeDesc[0].toUpperCase() + this._typeDesc.substr(1) + " data not yet loaded"
			);
		}
		return this._typesArray;
	}
	
	
	// Currently used only for item types
	this.isCustom = function (idOrName) {
		return this._types['_' + idOrName] && this._types['_' + idOrName].custom ? this._types['_' + idOrName].custom : false;
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
	
	this.getTypesForItemType = getTypesForItemType;
	this.isValidForItemType = isValidForItemType;
	
	this._typeDesc = 'creator type';
	this._idCol = 'creatorTypeID';
	this._nameCol = 'creatorType';
	this._table = 'creatorTypes';
	
	var _primaryIDCache;
	var _hasCreatorTypeCache = {};
	var _creatorTypesByItemType = {};
	var _isValidForItemType = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield this.constructor.prototype.init.apply(this);
		
		var sql = "SELECT itemTypeID, creatorTypeID AS id, creatorType AS name "
			+ "FROM itemTypeCreatorTypes NATURAL JOIN creatorTypes "
			// DEBUG: sort needs to be on localized strings in itemPane.js
			// (though still put primary field at top)
			+ "ORDER BY primaryField=1 DESC, name";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			let itemTypeID = row.itemTypeID;
			if (!_creatorTypesByItemType[itemTypeID]) {
				_creatorTypesByItemType[itemTypeID] = [];
			}
			_creatorTypesByItemType[itemTypeID].push({
				id: row.id,
				name: row.name
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
	
	
	function getTypesForItemType(itemTypeID) {
		if (!_creatorTypesByItemType[itemTypeID]) {
			throw new Error("Creator types not loaded for itemTypeID " + itemTypeID);
		}
		
		return _creatorTypesByItemType[itemTypeID];
	}
	
	
	function isValidForItemType(creatorTypeID, itemTypeID) {
		if (_isValidForItemType[itemTypeID] && typeof _isValidForItemType[itemTypeID][creatorTypeID] != 'undefined') {
			return _isValidForItemType[itemTypeID][creatorTypeID];
		}
		
		var valid = false;
		var types = this.getTypesForItemType(itemTypeID);
		for each(var type in types) {
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
		return Zotero.getString("creatorTypes."+this.getName(idOrName));
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
	
	this.getImageSrc = getImageSrc;
	
	this.customIDOffset = 10000;
	
	this._typeDesc = 'item type';
	this._idCol = 'itemTypeID';
	this._nameCol = 'typeName';
	this._table = 'itemTypesCombined';
	this._hasCustom = true;
	
	var _primaryTypes;
	var _secondaryTypes;
	var _hiddenTypes;
	
	var _customImages = {};
	var _customLabels = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield this.constructor.prototype.init.apply(this);
		
		// Primary types
		var limit = 5;
		
		// TODO: get rid of ' AND itemTypeID!=5' and just remove display=2
		// from magazineArticle in system.sql
		var sql = 'WHERE (display=2 AND itemTypeID!=5) ';
		
		var mru = Zotero.Prefs.get('newItemTypeMRU');
		if (mru) {
			var params = [];
			mru = mru.split(',').slice(0, limit);
			for (var i=0, len=mru.length; i<len; i++) {
				var id = parseInt(mru[i]);
				if (!isNaN(id) && id != 13) { // ignore 'webpage' item type
					params.push(id);
				}
			}
			if (params.length) {
				sql += 'OR id IN '
						+ '(' + params.map(function () '?').join() + ') '
						+ 'ORDER BY id NOT IN '
						+ '(' + params.map(function () '?').join() + ') ';
				params = params.concat(params);
			}
			else {
				params = false;
			}
		}
		else {
			params = false;
		}
		sql += 'LIMIT ' + limit;
		_primaryTypes = yield this._getTypesFromDB(sql, params);
		
		// Secondary types
		_secondaryTypes = yield this._getTypesFromDB('WHERE display IN (1,2)');
		
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
		
		return Zotero.getString("itemTypes." + typeName);
	}
	
	function getImageSrc(itemType) {
		var suffix = Zotero.hiDPI ? "@2x" : "";
		
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
			case 'attachment-web-link':
			case 'artwork':
			case 'audioRecording':
			case 'bill':
			case 'book':
			case 'bookSection':
			case 'computerProgram':
			case 'film':
			case 'instantMessage':
			case 'interview':
			case 'journalArticle':
			case 'letter':
			case 'magazineArticle':
			case 'newspaperArticle':
			case 'note':
			case 'report':
			case 'webpage':
				return "chrome://zotero/skin/treeitem-" + itemType + suffix + ".png";
			
			// No HiDPI images available
			case 'attachment-snapshot':
			case 'attachment-pdf':
			case 'blogPost':
			case 'case':
			case 'conferencePaper':
			case 'dictionaryEntry':
			case 'email':
			case 'encyclopediaArticle':
			case 'forumPost':
			case 'hearing':
			case 'manuscript':
			case 'map':
			case 'patent':
			case 'podcast':
			case 'presentation':
			case 'radioBroadcast':
			case 'statute':
			case 'thesis':
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
	this._idCol = 'charsetID';
	this._nameCol = 'charset';
	this._table = 'charsets';
	this._ignoreCase = true;
	
	this.getAll = getAll;
	
	function getAll() {
		return this.getTypes();
	}
	
	
	/**
	 * @param {String} name - Type name to add
	 * @return {Integer|False} - The type id (new or existing), or false if invalid type name
	 */
	this.add = Zotero.Promise.coroutine(function* (name) {
		if (typeof name != 'string' || name === "") {
			return false;
		}
		
		var id = this.getID(name);
		if (id) {
			return id;
		}
		
		name = name.toLowerCase();
		
		// Don't allow too-long or non-ASCII names
		if (name.length > 50 || !name.match(/[^a-z0-9\-_]/)) {
			return false;
		}
		
		var sql = "INSERT INTO " + this._table + " (" + this._nameCol + ") VALUES (?)";
		yield Zotero.DB.queryAsync(sql, name);
		
		sql = "SELECT id FROM " + this._table + " WHERE " + this._nameCol + "=?";
		var id = yield Zotero.DB.valueQueryAsync(sql, name);
		
		this._cacheTypeData({
			id: id,
			name: name
		});
		
		return id;
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.purge = function () {
		var sql = "DELETE FROM " + this._table + " WHERE " + this._idCol + " NOT IN "
			+ "(SELECT " + this._idCol + " FROM itemAttachments)";
		return Zotero.DB.queryAsync(sql);
	};
}

