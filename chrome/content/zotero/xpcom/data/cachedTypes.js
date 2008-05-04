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
	var _types = [];
	var _typesLoaded;
	var self = this;
	
	// Override these variables in child classes
	this._typeDesc = '';
	this._idCol = '';
	this._nameCol = '';
	this._table = '';
	this._ignoreCase = false;
	
	this.getName = getName;
	this.getID = getID;
	this.getTypes = getTypes;
	
	function getName(idOrName) {
		if (!_typesLoaded) {
			_load();
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!_types['_' + idOrName]) {
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return '';
		}
		
		return _types['_' + idOrName]['name'];
	}
	
	
	function getID(idOrName) {
		if (!_typesLoaded) {
			_load();
		}
		
		if (this._ignoreCase) {
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!_types['_' + idOrName]) {
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return false;
		}
		
		return _types['_' + idOrName]['id'];
	}
	
	
	function getTypes(where) {
		return Zotero.DB.query('SELECT ' + this._idCol + ' AS id, '
			+ this._nameCol + ' AS name FROM ' + this._table
			+ (where ? ' ' + where : '') + ' ORDER BY ' + this._nameCol);
	}
	
	
	function _load() {
		var types = self.getTypes();
		
		for (var i in types) {
			// Store as both id and name for access by either
			var typeData = {
				id: types[i]['id'],
				name: types[i]['name']
			}
			_types['_' + types[i]['id']] = typeData;
			if (self._ignoreCase) {
				_types['_' + types[i]['name'].toLowerCase()] = _types['_' + types[i]['id']];
			}
			else {
				_types['_' + types[i]['name']] = _types['_' + types[i]['id']];
			}
		}
		
		_typesLoaded = true;
	}
}


Zotero.CreatorTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.getTypesForItemType = getTypesForItemType;
	this.isValidForItemType = isValidForItemType;
	this.getPrimaryIDForType = getPrimaryIDForType;
	
	this._typeDesc = 'creator type';
	this._idCol = 'creatorTypeID';
	this._nameCol = 'creatorType';
	this._table = 'creatorTypes';
	
	function getTypesForItemType(itemTypeID) {
		var sql = "SELECT creatorTypeID AS id, creatorType AS name "
			+ "FROM itemTypeCreatorTypes NATURAL JOIN creatorTypes "
			// DEBUG: sort needs to be on localized strings in itemPane.js
			// (though still put primary field at top)
			+ "WHERE itemTypeID=? ORDER BY primaryField=1 DESC, name";
		return Zotero.DB.query(sql, itemTypeID);
	}
	
	
	function isValidForItemType(creatorTypeID, itemTypeID) {
		var sql = "SELECT COUNT(*) FROM itemTypeCreatorTypes "
			+ "WHERE itemTypeID=? AND creatorTypeID=?";
		return !!Zotero.DB.valueQuery(sql, [itemTypeID, creatorTypeID]);
	}
	
	
	function getPrimaryIDForType(itemTypeID) {
		var sql = "SELECT creatorTypeID FROM itemTypeCreatorTypes "
			+ "WHERE itemTypeID=? AND primaryField=1";
		return Zotero.DB.valueQuery(sql, itemTypeID);
	}
}


Zotero.ItemTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.getPrimaryTypes = getPrimaryTypes;
	this.getSecondaryTypes = getSecondaryTypes;
	this.getHiddenTypes = getHiddenTypes;
	this.getLocalizedString = getLocalizedString;
	this.getImageSrc = getImageSrc;
	
	this._typeDesc = 'item type';
	this._idCol = 'itemTypeID';
	this._nameCol = 'typeName';
	this._table = 'itemTypes';

	function getPrimaryTypes() {
		return this.getTypes('WHERE display=2');
	}

	function getSecondaryTypes() {
		return this.getTypes('WHERE display=1');
	}
	
	function getHiddenTypes() {
		return this.getTypes('WHERE display=0');
	}
	
	function getLocalizedString(typeIDOrName) {
		var typeName = this.getName(typeIDOrName);
		return Zotero.getString("itemTypes." + typeName);
	}
	
	function getImageSrc(itemType) {
		// DEBUG: only have icons for some types so far
		switch (itemType) {
			case 'attachment-file':
			case 'attachment-link':
			case 'attachment-snapshot':
			case 'attachment-web-link':
			case 'attachment-pdf':
			case 'artwork':
			case 'audioRecording':
			case 'blogPost':
			case 'book':
			case 'bookSection':
			case 'computerProgram':
			case 'conferencePaper':
			case 'email':
			case 'film':
			case 'forumPost':
			case 'interview':
			case 'journalArticle':
			case 'letter':
			case 'magazineArticle':
			case 'manuscript':
			case 'map':
			case 'newspaperArticle':
			case 'note':
			case 'podcast':
			case 'radioBroadcast':
			case 'report':
			case 'thesis':
			case 'tvBroadcast':
			case 'videoRecording':
			case 'webpage':
				return "chrome://zotero/skin/treeitem-" + itemType + ".png";
		}
		
		return "chrome://zotero/skin/treeitem.png";
	}
}


Zotero.FileTypes = new function() {
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'file type';
	this._idCol = 'fileTypeID';
	this._nameCol = 'fileType';
	this._table = 'fileTypes';
	
	this.getIDFromMIMEType = getIDFromMIMEType;
	
	function getIDFromMIMEType(mimeType) {
		var sql = "SELECT fileTypeID FROM fileTypeMIMETypes "
			+ "WHERE ? LIKE mimeType || '%'";
			
		return Zotero.DB.valueQuery(sql, [mimeType]);
	}
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
}

