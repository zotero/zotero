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
	
	var _cache = {};
	var _groupIDsByLibraryID = {};
	var _libraryIDsByGroupID = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield _load();
	});
	
	/**
	 * @param {Integer} id - Group id
	 * @return {Zotero.Group}
	 */
	this.get = function (id) {
		if (!id) throw new Error("groupID not provided");
		return _cache[id] ? _cache[id] : false;
	}
	
	
	/**
	 * Get all groups, sorted by name
	 *
	 * @return {Zotero.Group[]}
	 */
	this.getAll = function () {
		var groups = [for (id of Object.keys(_cache)) _cache[id]];
		var collation = Zotero.getLocaleCollation();
		groups.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		return groups;
	}
	
	
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
	
	
	this.register = function (group) {
		_libraryIDsByGroupID[group.id] = group.libraryID;
		_groupIDsByLibraryID[group.libraryID] = group.id;
		_cache[group.id] = group;
	}
	
	
	this.unregister = function (id) {
		var libraryID = _libraryIDsByGroupID[groupID];
		delete _groupIDsByLibraryID[libraryID];
		delete _libraryIDsByGroupID[groupID];
		delete _cache[id];
	}
	
	
	var _load = Zotero.Promise.coroutine(function* () {
		var sql = "SELECT libraryID, groupID FROM groups";
		var rows = yield Zotero.DB.queryAsync(sql)
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			_groupIDsByLibraryID[row.libraryID] = row.groupID;
			_libraryIDsByGroupID[row.groupID] = row.libraryID;
			let group = new Zotero.Group;
			group.id = row.groupID;
			yield group.load();
			_cache[row.groupID] = group;
		}
	});
}
