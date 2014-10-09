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

Zotero.Libraries = new function () {
	var _libraryData = {};
	
	this.init = Zotero.Promise.coroutine(function* () {
		// Library data
		var sql = "SELECT * FROM libraries";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			_libraryData[row.libraryID] = {
				type: row.libraryType,
				version: row.version
			};
		}
	});
	
	this.exists = function (libraryID) {
		// Until there are other library types, this can just check groups,
		// which already preload ids at startup
		try {
			return !!Zotero.Groups.getGroupIDFromLibraryID(libraryID);
		}
		catch (e) {
			if (e.getMessage().indexOf("does not exist") != -1) {
				return false;
			}
			throw e;
		}
	}
	
	
	this.add = function (libraryID, type) {
		switch (type) {
			case 'group':
				break;
			
			default:
				throw new Error("Invalid library type '" + type + "' in Zotero.Libraries.add()");
		}
		
		var sql = "INSERT INTO libraries (libraryID, libraryType) VALUES (?, ?)";
		Zotero.DB.query(sql, [libraryID, type]);
	}
	
	
	this.dbLibraryID = function (libraryID) {
		return (libraryID == Zotero.Users.getCurrentLibraryID()) ? 0 : libraryID;
	}
	
	
	this.getName = function (libraryID) {
		if (!libraryID) {
			return Zotero.getString('pane.collections.library');
		}
		
		var type = this.getType(libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.name;
			
			default:
				throw new Error("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
	
	
	this.getType = function (libraryID) {
		if (this.dbLibraryID(libraryID) === 0) {
			return 'user';
		}
		if (!_libraryData[libraryID]) {
			throw new Error("Library data not loaded for library " + libraryID);
		}
		return _libraryData[libraryID].type;
	}
	
	/**
	 * @param {Integer} libraryID
	 * @return {Integer}
	 */
	this.getVersion = function (libraryID) {
		if (!_libraryData[libraryID]) {
			throw new Error("Library data not loaded for library " + libraryID);
		}
		return _libraryData[libraryID].version;
	}
	
	
	/**
	 * @param {Integer} libraryID
	 * @param {Integer} version
	 * @return {Promise}
	 */
	this.setVersion = Zotero.Promise.coroutine(function* (libraryID, version) {
		version = parseInt(version);
		var sql = "UPDATE libraries SET version=? WHERE libraryID=?";
		yield Zotero.DB.queryAsync(sql, [version, libraryID]);
		_libraryData[libraryID] = version;
	});
	
	
	this.isEditable = function (libraryID) {
		var type = this.getType(libraryID);
		switch (type) {
			case 'user':
				return true;
			
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.editable;
			
			default:
				throw new Error("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
	
	
	this.isFilesEditable = function (libraryID) {
		var type = this.getType(libraryID);
		switch (type) {
			case 'user':
				return true;
			
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.filesEditable;
			
			default:
				throw new Error("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
}
