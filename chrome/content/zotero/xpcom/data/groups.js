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


Zotero.Groups = new function () {
	this.__defineGetter__('addGroupURL', function () ZOTERO_CONFIG.WWW_BASE_URL + 'groups/new/');
	
	var _groupIDsByLibraryID = {};
	var _libraryIDsByGroupID = {};
	
	
	this.init = function () {
		_loadIDs();
	}
	
	this.get = Zotero.Promise.coroutine(function* (id) {
		if (!id) {
			throw new Error("groupID not provided");
		}
		var group = new Zotero.Group;
		group.id = id;
		if (!(yield group.load())) {
			return false;
		}
		return group;
	});
	
	
	this.getAll = Zotero.Promise.coroutine(function* () {
		var groups = [];
		var sql = "SELECT groupID FROM groups ORDER BY name COLLATE locale";
		var groupIDs = yield Zotero.DB.columnQueryAsync(sql);
		if (!groupIDs.length) {
			return groups;
		}
		for each(var groupID in groupIDs) {
			groups.push(this.get(groupID));
		}
		return Zotero.Promise.all(groups);
	});
	
	
	this.getByLibraryID = function (libraryID) {
		var groupID = this.getGroupIDFromLibraryID(libraryID);
		return this.get(groupID);
	}
	
	
	this.exists = function (groupID) {
		return !!_libraryIDsByGroupID[groupID];
	}
	
	
	this.getGroupIDFromLibraryID = function (libraryID) {
		var groupID = _groupIDsByLibraryID[libraryID];
		if (!groupID) {
			throw new Error("Group with libraryID " + libraryID + " does not exist");
		}
		return groupID;
	}
	
	
	this.getLibraryIDFromGroupID = function (groupID) {
		var libraryID = _libraryIDsByGroupID[groupID];
		if (!libraryID) {
			throw new Error("Group with groupID " + groupID + " does not exist");
		}
		return libraryID;
	}
	
	
	function _loadIDs() {
		var sql = "SELECT libraryID, groupID FROM groups";
		return Zotero.DB.queryAsync(sql)
		.then(function (rows) {
			for (let i=0; i<rows.length; i++) {
				let row = rows[i];
				_groupIDsByLibraryID[row.libraryID] = row.groupID;
				_libraryIDsByGroupID[row.groupID] = row.libraryID;
			}
		}.bind(this));
	}
}
