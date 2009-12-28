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

Zotero.Libraries = new function () {
	this.exists = function (libraryID) {
		var sql = "SELECT COUNT(*) FROM libraries WHERE libraryID=?";
		return !!Zotero.DB.valueQuery(sql, [libraryID]);
	}
	
	
	this.add = function (libraryID, type) {
		switch (type) {
			case 'group':
				break;
			
			default:
				throw ("Invalid library type '" + type + "' in Zotero.Libraries.add()");
		}
		
		var sql = "INSERT INTO libraries (libraryID, libraryType) VALUES (?, ?)";
		Zotero.DB.query(sql, [libraryID, type]);
	}
	
	
	this.getName = function (libraryID) {
		var type = this.getType(libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.name;
			
			default:
				throw ("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
	
	
	this.getType = function (libraryID) {
		var sql = "SELECT libraryType FROM libraries WHERE libraryID=?";
		var libraryType = Zotero.DB.valueQuery(sql, libraryID);
		if (!libraryType) {
			throw ("Library " + libraryID + " does not exist in Zotero.Libraries.getType()");
		}
		return libraryType;
	}
	
	
	this.isEditable = function (libraryID) {
		var type = this.getType(libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.editable;
			
			default:
				throw ("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
}
