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


Zotero.DataObjectUtilities = {
	"checkLibraryID": function (libraryID) {
		if (libraryID === null) {
			Zotero.debug("Deprecated: libraryID cannot be NULL", 2, 1);
		}
		else {
			var intValue = parseInt(libraryID);
			if (libraryID != intValue || intValue < 0) {
				throw new Error("libraryID must be a positive integer");
			}
		}
		return intValue;
	},
	
	"checkDataID": function(dataID) {
		var intValue = parseInt(dataID);
		if (dataID != intValue || dataID < 0)
			throw new Error("id must be a positive integer");
		return intValue;
	},
	
	"checkKey": function(key) {
		if (!key) return null;
		if (!Zotero.Utilities.isValidObjectKey(key)) {
			throw new Error("key is not valid");
		}
		return key;
	},
	
	
	getObjectTypeSingular: function (objectTypePlural) {
		return objectTypePlural.replace(/(s|es)$/, '');
	},
	
	
	"getObjectTypePlural": function(objectType) {
		return objectType == 'search' ? 'searches' : objectType + 's';
	},
	
	
	"getObjectsClassForObjectType": function(objectType) {
		var objectTypePlural = this.getObjectTypePlural(objectType);
		var className = objectTypePlural[0].toUpperCase() + objectTypePlural.substr(1);
		return Zotero[className]
	}
};
