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


Zotero.URI = new function () {
	Zotero.defineProperty(this, 'defaultPrefix', {
		value: 'http://zotero.org/'
	});
	
	// This should match all possible URIs. Match groups are as follows:
	// 1: users|groups
	// 2: local/|NULL
	// 3: userID|groupID|localUserKey
	// 4: publications|feeds/libraryID|NULL
	// 5: items|collections|NULL
	// 6: itemKey|collectionKey|NULL
	var uriPartsRe = new RegExp(
		'^' + Zotero.Utilities.quotemeta(this.defaultPrefix)
		+ '(users|groups)/(local/)?(\\w+)(?:/(publications|feeds/\\w+))?'
		+ '(?:/(items|collections)/(\\w+))?'
	);
	
	/**
	 * Get a URI with the user's local key, if there is one
	 *
	 * @return	{String|False}		e.g., 'http://zotero.org/users/local/v3aG8nQf'
	 */
	this.getLocalUserURI = function () {
		return this.defaultPrefix + "users/local/" + Zotero.Users.getLocalUserKey();
	}
	
	
	/**
	 * Get a URI for the user, creating a local user key if necessary
	 *
	 * @return	{String}
	 */
	this.getCurrentUserURI = function () {
		var userID = Zotero.Users.getCurrentUserID();
		if (userID) {
			return this.defaultPrefix + "users/" + userID;
		}
		
		return this.getLocalUserURI();
	}
	
	
	this.getCurrentUserLibraryURI = function () {
		var userID = Zotero.Users.getCurrentUserID();
		if (!userID) {
			return false;
		}
		return this.getCurrentUserURI() + "/items";
	}
	
	
	this.getLibraryURI = function (libraryID) {
		return this.defaultPrefix + this.getLibraryPath(libraryID);
	}
	
	
	/**
	 * Get path portion of library URI (e.g., users/6 or groups/1)
	 */
	this.getLibraryPath = function (libraryID) {
		var libraryType = Zotero.Libraries.get(libraryID).libraryType;
		
		switch (libraryType) {
			case 'user':
				var id = Zotero.Users.getCurrentUserID();
				if (!id) {
					id = 'local/' + Zotero.Users.getLocalUserKey();
				}
				
				if (libraryType == 'publications') {
					return "users/" + id + "/" + libraryType;
				}
				
				break;
			
			case 'feed':
				// Since feeds are not currently synced, generate a local URI
				return "users/local/" + Zotero.Users.getLocalUserKey() + "/feeds/" + libraryID;
			
			case 'group':
				var id = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				break;
			
			default:
				throw new Error(`Unsupported library type '${libraryType}' for library ${libraryID}`);
		}
		
		return libraryType + "s/" + id;
	}
	
	
	/**
	 * Get library from path (e.g., users/6 or groups/1)
	 *
	 * @return {Zotero.Library|false}
	 */
	this.getPathLibrary = function (path) {
		let matches = path.match(/^\/\/?users\/(\d+)/);
		if (matches) {
			let userID = matches[1];
			let currentUserID = Zotero.Users.getCurrentUserID();
			if (userID != currentUserID) {
				Zotero.debug("User ID from streaming server doesn't match current id! "
					+ `(${userID} != ${currentUserID})`);
				return false;
			}
			return Zotero.Libraries.userLibrary;
		}
		matches = path.match(/^\/groups\/(\d+)/);
		if (matches) {
			let groupID = matches[1];
			return Zotero.Groups.get(groupID);
		}
	}
	
	
	/**
	 * Return URI of item, which might be a local URI if user hasn't synced
	 */
	this.getItemURI = function (item) {
		return this._getObjectURI(item);
	}
	
	
	/**
	 * Get path portion of item URI (e.g., users/6/items/ABCD1234 or groups/1/items/ABCD1234)
	 */
	this.getItemPath = function (item) {
		return this._getObjectPath(item);
	}
	
	
	this.getFeedItemURI = function(feedItem) {
		return this.getItemURI(feedItem);
	}
	
	this.getFeedItemPath = function(feedItem) {
		return this.getItemPath(feedItem);
	}
	
	/**
	 * Return URI of collection, which might be a local URI if user hasn't synced
	 */
	this.getCollectionURI = function (collection) {
		return this._getObjectURI(collection);
	}
	
	
	/**
	 * Get path portion of collection URI (e.g., users/6/collections/ABCD1234 or groups/1/collections/ABCD1234)
	 */
	this.getCollectionPath = function (collection) {
		return this._getObjectPath(collection);
	}
	
	this.getFeedURI = function(feed) {
		return this.getLibraryURI(feed);
	}
	
	this.getFeedPath = function(feed) {
		return this.getLibraryPath(feed);
	}
	
	
	this.getGroupsURL = function () {
		return ZOTERO_CONFIG.WWW_BASE_URL + "groups";
	}
	
	
	/**
	 * @param	{Zotero.Group}		group
	 * @return	{String}
	 */
	this.getGroupURI = function (group, webRoot) {
		var uri = this._getObjectURI(group);
		if (webRoot) {
			uri = uri.replace(ZOTERO_CONFIG.BASE_URI, ZOTERO_CONFIG.WWW_BASE_URL);
		}
		return uri;
	}
	
	this._getObjectPath = function(obj) {
		let path = this.getLibraryPath(obj.libraryID);
		if (obj instanceof Zotero.Library) {
			return path;
		}
		
		if (obj instanceof Zotero.Item) {
			return path + '/items/' + obj.key;
		}
		
		if (obj instanceof Zotero.Collection) {
			return path + '/collections/' + obj.key;
		}
		
		throw new Error("Unsupported object type '" + obj._objectType + "'");
	}
	
	this._getObjectURI = function(obj) {
		return this.defaultPrefix + this._getObjectPath(obj);
	}
	
	/**
	 * Convert an item URI into an item
	 *
	 * @param	{String}				itemURI
	 * @return {Promise<Zotero.Item|false>}
	 */
	this.getURIItem = Zotero.Promise.method(function (itemURI) {
		var obj = this._getURIObject(itemURI, 'item');
		if (!obj) return false;
		return Zotero.Items.getByLibraryAndKeyAsync(obj.libraryID, obj.key);
	});
	
	
	/**
	 * @param {String} itemURI
	 * @return {Object|FALSE} - Object with 'libraryID' and 'key', or FALSE if item not found
	 */
	this.getURIItemLibraryKey = function (itemURI) {
		return this._getURIObject(itemURI, 'item');
	}
	
	
	/**
	 * Convert an item URI into a libraryID and key from the database, without relying on global state
	 *
	 * Note that while the URI must point to a valid library, the item doesn't need to exist
	 */
	this.getURIItemLibraryKeyFromDB = function (itemURI) {
		return this._getURIObjectLibraryKeyFromDB(itemURI, 'item');
	}
	
	
	/**
	 * @param {String} itemURI
	 * @return {Integer|FALSE} - itemID of matching item, or FALSE if none
	 */
	this.getURIItemID = function (itemURI) {
		var obj = this._getURIObject(itemURI, 'item');
		if (!obj) return false;
		return Zotero.Items.getIDFromLibraryAndKey(obj.libraryID, obj.key);
	}
	
	
	/**
	 * Convert a collection URI into a collection
	 *
	 * @param	{String}				collectionURI
	 * @param	{Zotero.Collection|FALSE}
	 * @return {Promise<Zotero.Collection|false>}
	 */
	this.getURICollection = Zotero.Promise.method(function (collectionURI) {
		var obj = this._getURIObject(collectionURI, 'collection');
		if (!obj) return false;
		return Zotero.Collections.getByLibraryAndKeyAsync(obj.libraryID, obj.key);
	});
	
	
	/**
	 * @param {String} collectionURI
	 * @return {Object|FALSE} - Object with 'libraryID' and 'key', or FALSE if item not found
	 */
	this.getURICollectionLibraryKey = function (collectionURI) {
		return this._getURIObject(collectionURI, 'collection');;
	}
	
	
	/**
	 * @param {String} collectionURI
	 * @return {Integer|FALSE} - collectionID of matching collection, or FALSE if none
	 */
	this.getURICollectionID = function (collectionURI) {
		var obj = this._getURIObject(collectionURI, 'collection');
		if (!obj) return false;
		return Zotero.Collections.getIDFromLibraryAndKey(obj.libraryID, obj.key);
	}
	
	
	/**
	 * Convert a library URI into a libraryID
	 *
	 * @param	{String}				libraryURI
	 * @return {Integer|FALSE} - libraryID, or FALSE if no matching library
	 */
	this.getURILibrary = function (libraryURI) {
		let library = this._getURIObjectLibrary(libraryURI);
		return library ? library.id : false;
	}


	this.getURIFeed = function (feedURI) {
		return this._getURIObjectLibrary(feedURI, 'feed');
	}
	
	
	/**
	 * Convert an object URI into an object containing libraryID and key
	 *
	 * @param {String} objectURI
	 * @param {String} [type] Object type to expect
	 * @return {Object|FALSE} - An object containing libraryID, objectType and
	 *   key. Key and objectType may not be present if the URI references a
	 *   library itself
	 */
	this._getURIObject = function (objectURI, type) { 
		let uri = objectURI.replace(/\/+$/, ''); // Drop trailing /
		let uriParts = uri.match(uriPartsRe);
		
		if (!uriParts) {
			throw new Error("Could not parse object URI " + objectURI);
		}
		
		let library = this._getURIObjectLibrary(objectURI);
		if (!library) return false;
		
		let retObj = {libraryID: library.libraryID};
		if (!uriParts[5]) {
			// References the library itself
			return retObj;
		}
		
		retObj.objectType = uriParts[5] == 'items' ? 'item' : 'collection';
		retObj.key = uriParts[6];
		
		if (type && type != retObj.objectType) return false;
		
		return retObj;
	};
	
	
	/**
	 * Convert an object URI into a Zotero.Library that the object is in
	 *
	 * @param {String}	objectURI
	 * @return {Zotero.Library|FALSE} - An object referenced by the URI
	 */
	this._getURIObjectLibrary = function (objectURI) {
		let uri = objectURI.replace(/\/+$/, ''); // Drop trailing "/"
		let uriParts = uri.match(uriPartsRe);
		
		if (!uriParts) {
			throw new Error("Could not parse object URI " + objectURI);
		}
		
		let library;
		if (uriParts[1] == 'users') {
			let type = uriParts[4];
			if (!type) {
				// Handles local and synced libraries
				library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			} else {
				let feedID = type.split('/')[1];
				library = Zotero.Libraries.get(feedID);
			}
		} else {
			// Group libraries
			library = Zotero.Groups.get(uriParts[3]);
		}
		
		if (!library) {
			Zotero.debug("Could not find a library for URI " + objectURI, 2, true);
			return false;
		}
		
		return library;
	}
	
	
	/**
	 * Convert an object URI into a libraryID from the database, without relying on global state
	 *
	 * @param {String}	objectURI
	 * @return {Promise<Integer|FALSE>} - A promise for either a libraryID or FALSE if a matching
	 *     library couldn't be found
	 */
	this._getURIObjectLibraryID = Zotero.Promise.coroutine(function* (objectURI) {
		let uri = objectURI.replace(/\/+$/, ''); // Drop trailing "/"
		let uriParts = uri.match(uriPartsRe);
		
		let libraryID;
		if (uriParts[1] == 'users') {
			let type = uriParts[4];
			// Personal library
			if (!type || type == 'publications') {
				libraryID = yield Zotero.DB.valueQueryAsync(
					"SELECT libraryID FROM libraries WHERE type='user'"
				);
			}
			// Feed libraries
			else {
				libraryID = type.split('/')[1];
			}
		}
		// Group libraries
		else {
			libraryID = yield Zotero.DB.valueQueryAsync(
				"SELECT libraryID FROM groups WHERE groupID=?", uriParts[3]
			);
		}
		
		if (!libraryID) {
			Zotero.debug("Could not find a library for URI " + objectURI, 2, true);
			return false;
		}
		
		return libraryID;
	});
	
	
	
	/**
	 * Convert an object URI into a libraryID and key from the database, without relying on global state
	 *
	 * Note that while the URI must point to a valid library, the object doesn't need to exist
	 *
	 * @param {String} objectURI - Object URI
	 * @param {String} type - Object type
	 * @return {Promise<Object|FALSE>} - A promise for an object with 'objectType', 'libraryID', 'key'
	 *     or FALSE if library didn't exist
	 */
	this._getURIObjectLibraryKeyFromDB = Zotero.Promise.coroutine(function* (objectURI, type) {
		let uri = objectURI.replace(/\/+$/, ''); // Drop trailing /
		let uriParts = uri.match(uriPartsRe);
		
		if (!uriParts) {
			throw new Error("Could not parse object URI " + uri);
		}
		
		let libraryID = yield this._getURIObjectLibraryID(uri);
		if (!libraryID) {
			return false;
		}
		
		let retObj = { libraryID };
		if (!uriParts[5]) {
			// References the library itself
			return false;
		}
		
		retObj.objectType = uriParts[5] == 'items' ? 'item' : 'collection';
		retObj.key = uriParts[6];
		
		if (type && type != retObj.objectType) return false;
		
		return retObj;
	});
}
