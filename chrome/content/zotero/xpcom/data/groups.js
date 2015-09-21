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
	Zotero.defineProperty(this, 'addGroupURL', {
		value: ZOTERO_CONFIG.WWW_BASE_URL + 'groups/new/'
	});
	
	this._cache = null;
	
	this._makeCache = function() {
		return {
			groupIDByLibraryID: {},
			libraryIDByGroupID: {}
		};
	}
	
	this.register = function (group) {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		Zotero.debug("Zotero.Groups: Registering group " + group.id + " (" + group.libraryID + ")", 5);
		this._addToCache(this._cache, group);
	}
	
	this._addToCache = function (cache, group) {
		cache.libraryIDByGroupID[group.id] = group.libraryID;
		cache.groupIDByLibraryID[group.libraryID] = group.id;
	}
	
	this.unregister = function (groupID) {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		let libraryID = this._cache.libraryIDByGroupID[groupID];
		Zotero.debug("Zotero.Groups: Unegistering group " + groupID + " (" + libraryID + ")", 5);
		delete this._cache.groupIDByLibraryID[libraryID];
		delete this._cache.libraryIDByGroupID[groupID];
	}
	
	this.init = Zotero.Promise.method(function() {
		// Cache initialized in Zotero.Libraries
	})
	
	/**
	 * @param {Integer} id - Group id
	 * @return {Zotero.Group}
	 */
	this.get = function (id) {
		return Zotero.Libraries.get(this.getLibraryIDFromGroupID(id));
	}
	
	
	/**
	 * Get all groups, sorted by name
	 *
	 * @return {Zotero.Group[]}
	 */
	this.getAll = function () {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		
		var groups = Object.keys(this._cache.groupIDByLibraryID)
			.map(id => Zotero.Libraries.get(id));
		var collation = Zotero.getLocaleCollation();
		groups.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		return groups;
	}
	
	
	this.getByLibraryID = function (libraryID) {
		return Zotero.Libraries.get(libraryID);
	}
	
	
	this.exists = function (groupID) {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		
		return !!this._cache.libraryIDByGroupID[groupID];
	}
	
	
	this.getGroupIDFromLibraryID = function (libraryID) {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		
		var groupID = this._cache.groupIDByLibraryID[libraryID];
		if (!groupID) {
			throw new Error("Group with libraryID " + libraryID + " does not exist");
		}
		return groupID;
	}
	
	
	this.getLibraryIDFromGroupID = function (groupID) {
		if (!this._cache) throw new Error("Zotero.Groups cache is not initialized");
		
		return this._cache.libraryIDByGroupID[groupID] || false;
	}
}
