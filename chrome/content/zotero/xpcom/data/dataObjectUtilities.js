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
			Zotero.debug("Deprecated: libraryID cannot be NULL\n\n" + Components.stack, 2);
		}
		else {
			var intValue = parseInt(libraryID);
			if (libraryID != intValue) {
				throw new Error("libraryID must be an integer");
			}
		}
		return intValue;
	},
	
	"getObjectTypePlural": function getObjectTypePlural(objectType) {
		return objectType == 'search' ? 'searches' : objectType + 's';
	},
	
	
	"getClassForObjectType": function getClassForObjectType(objectType) {
		var objectTypePlural = this.getObjectTypePlural(objectType);
		var className = objectTypePlural[0].toUpperCase() + objectTypePlural.substr(1);
		return Zotero[className]
	}
};
