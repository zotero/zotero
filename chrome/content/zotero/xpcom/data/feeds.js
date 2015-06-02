/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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

// Add some feed methods, but otherwise proxy to Zotero.Collections
Zotero.Feeds = new function() {
	this._cache = null;
	
	this._makeCache = function() {
		return {
			libraryIDByURL: {},
			urlByLibraryID: {}
		};
	}
	
	this.register = function (feed) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		Zotero.debug("Zotero.Feeds: Registering feed " + feed.libraryID, 5);
		this._addToCache(this._cache, feed);
	}
	
	this._addToCache = function (cache, feed) {
		if (!feed.libraryID) throw new Error('Cannot register an unsaved feed');
		
		if (cache.libraryIDByURL[feed.url]) {
			Zotero.debug('Feed with url ' + feed.url + ' is already registered', 2, true);
		}
		if (cache.urlByLibraryID[feed.libraryID]) {
			Zotero.debug('Feed with libraryID ' + feed.libraryID + ' is already registered', 2, true);
		}
		
		cache.libraryIDByURL[feed.url] = feed.libraryID;
		cache.urlByLibraryID[feed.libraryID] = feed.url;
	}
	
	this.unregister = function (libraryID) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		Zotero.debug("Zotero.Feeds: Unregistering feed " + libraryID, 5);
		
		let url = this._cache.urlByLibraryID[libraryID];
		if (url === undefined) {
			Zotero.debug('Attempting to unregister a feed that is not registered (' + libraryID + ')', 2, true);
			return;
		}
		
		delete this._cache.urlByLibraryID[libraryID];
		delete this._cache.libraryIDByURL[url];
	}
	
	this.getByURL = function(urls) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		let asArray = true;
		if (!Array.isArray(urls)) {
			urls = [urls];
			asArray = false;
		}
		
		let libraryIDs = Array(urls.length);
		for (let i=0; i<urls.length; i++) {
			let libraryID = this._cache.libraryIDByURL[urls[i]];
			if (!libraryID) {
				throw new Error('Feed with url ' + urls[i] + ' not registered in feed cache');
			}
			
			libraryIDs[i] = libraryID;
		}
		
		let feeds = Zotero.Libraries.get(libraryIDs);
		return asArray ? feeds : feeds[0];
	}
	
	this.existsByURL = function(url) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return this._cache.libraryIDByURL[url] !== undefined;
	}
	
	this.getAll = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return Object.keys(this._cache.urlByLibraryID)
			.map(id => Zotero.Libraries.get(id));
	}
	
	this.haveFeeds = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return !!Object.keys(this._cache.urlByLibraryID).length
	}
}
