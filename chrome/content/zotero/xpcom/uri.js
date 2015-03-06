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
	this.__defineGetter__('defaultPrefix', function () 'http://zotero.org/');
	
	var _baseURI = ZOTERO_CONFIG.BASE_URI;
	var _apiURI = ZOTERO_CONFIG.API_URI;
	
	
	/**
	 * Get a URI with the user's local key, if there is one
	 *
	 * @return	{String|False}		e.g., 'http://zotero.org/users/v3aG8nQf'
	 */
	this.getLocalUserURI = function () {
		var key = Zotero.Users.getLocalUserKey();
		if (!key) {
			return false;
		}
		return _baseURI + "users/local/" + key;
	}
	
	
	/**
	 * Get a URI for the user, creating a local user key if necessary
	 *
	 * @return	{String}
	 */
	this.getCurrentUserURI = function (noLocal) {
		var userID = Zotero.Users.getCurrentUserID();
		if (!userID && noLocal) {
			throw new Exception("Local userID not available and noLocal set in Zotero.URI.getCurrentUserURI()");
		}
		if (userID) {
			return _baseURI + "users/" + userID;
		}
		
		return _baseURI + "users/local/" + Zotero.Users.getLocalUserKey();
	}
	
	
	this.getCurrentUserLibraryURI = function () {
		var userID = Zotero.Users.getCurrentUserID();
		if (!userID) {
			return false;
		}
		return _baseURI + "users/" + userID + "/items";
	}
	
	
	this.getLibraryURI = function (libraryID) {
		var path = this.getLibraryPath(libraryID);
		return _baseURI + path;
	}
	
	
	/**
	 * Get path portion of library URI (e.g., users/6 or groups/1)
	 */
	this.getLibraryPath = function (libraryID) {
		var libraryType = Zotero.Libraries.getType(libraryID);
		
		switch (libraryType) {
			case 'user':
			case 'publications':
				var id = Zotero.Users.getCurrentUserID();
				if (!id) {
					throw new Exception("User id not available in Zotero.URI.getLibraryPath()");
				}
				
				if (libraryType == 'publications') {
					return "users/" + id + "/publications";
				}
				break;
			
			case 'group':
				var id = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				break;
			
			default:
				throw ("Unsupported library type '" + libraryType + "' in Zotero.URI.getLibraryPath()");
		}
		
		return libraryType + "s/" + id;
	}
	
	
	/**
	 * Return URI of item, which might be a local URI if user hasn't synced
	 */
	this.getItemURI = function (item) {
		if (item.libraryID) {
			var baseURI = this.getLibraryURI(item.libraryID);
		}
		else {
			var baseURI =  this.getCurrentUserURI();
		}
		return baseURI + "/items/" + item.key;
	}
	
	
	/**
	 * Get path portion of item URI (e.g., users/6/items/ABCD1234 or groups/1/items/ABCD1234)
	 */
	this.getItemPath = function (item) {
		return this.getLibraryPath(item.libraryID) + "/items/" + item.key;
	}
	
	
	/**
	 * Return URI of collection, which might be a local URI if user hasn't synced
	 */
	this.getCollectionURI = function (collection) {
		if (collection.libraryID) {
			var baseURI = this.getLibraryURI(collection.libraryID);
		}
		else {
			var baseURI =  this.getCurrentUserURI();
		}
		return baseURI + "/collections/" + collection.key;
	}
	
	
	/**
	 * Get path portion of collection URI (e.g., users/6/collections/ABCD1234 or groups/1/collections/ABCD1234)
	 */
	this.getCollectionPath = function (collection) {
		return this.getLibraryPath(collection.libraryID) + "/collections/" + collection.key;
	}
	
	
	this.getGroupsURL = function () {
		return ZOTERO_CONFIG.WWW_BASE_URL + "groups";
	}
	
	
	/**
	 * @param	{Zotero.Group}		group
	 * @return	{String}
	 */
	this.getGroupURI = function (group, webRoot) {
		var uri = _baseURI + "groups/" + group.id;
		if (webRoot) {
			uri = uri.replace(ZOTERO_CONFIG.BASE_URI, ZOTERO_CONFIG.WWW_BASE_URL);
		}
		return uri;
	}
	
	
	/**
	 * Convert an item URI into an item
	 *
	 * @param	{String}				itemURI
	 * @param	{Zotero.Item|FALSE}
	 * @return {Promise<Zotero.Item|FALSE>}
	 */
	this.getURIItem = Zotero.Promise.method(function (itemURI) {
		var {libraryID, key} = this._getURIObject(itemURI, 'item');
		if (!key) return false;
		return Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
	});
	
	
	/**
	 * @param {String} itemURI
	 * @return {Object|FALSE} - Object with 'libraryID' and 'key', or FALSE if item not found
	 */
	this.getURIItemLibraryKey = function (itemURI) {
		return this._getURIObject(itemURI, 'item');
	}
	
	
	/**
	 * @param {String} itemURI
	 * @return {Integer|FALSE} - itemID of matching item, or FALSE if none
	 */
	this.getURIItemID = function (itemURI) {
		var {libraryID, key} = this._getURIObject(itemURI, 'item');
		if (!key) return false;
		return Zotero.Items.getIDFromLibraryAndKey(libraryID, key);
	}
	
	
	/**
	 * Convert a collection URI into a collection
	 *
	 * @param	{String}				collectionURI
	 * @param	{Zotero.Collection|FALSE}
	 * @return {Promise<Zotero.Collection|FALSE>}
	 */
	this.getURICollection = Zotero.Promise.method(function (collectionURI) {
		var {libraryID, key} = this._getURIObject(collectionURI, 'collection');
		if (!key) return false;
		return Zotero.Collections.getByLibraryAndKeyAsync(libraryID, key);
	});
	
	
	/**
	 * @param {String} collectionURI
	 * @return {Object|FALSE} - Object with 'libraryID' and 'key', or FALSE if item not found
	 */
	this.getURICollectionLibraryKey = function (collectionURI) {
		return this._getURIObject(collectionURI, 'collection');
	}
	
	
	/**
	 * @param {String} collectionURI
	 * @return {Integer|FALSE} - collectionID of matching collection, or FALSE if none
	 */
	this.getURICollectionID = function (collectionURI) {
		var {libraryID, key} = this._getURIObject(collectionURI, 'item');
		if (!key) return false;
		return Zotero.Collections.getIDFromLibraryAndKey(libraryID, key);
	}
	
	
	/**
	 * Convert a library URI into a libraryID
	 *
	 * @param	{String}				libraryURI
	 * @return {Integer|FALSE} - libraryID, or FALSE if no matching library
	 */
	this.getURILibrary = function (libraryURI) {
		var {libraryID} = this._getURIObject(libraryURI, "library");
		return libraryID !== undefined ? libraryID : false;
	}
	
	
	/**
	 * Convert an object URI into an object (item, collection, etc.)
	 *
	 * @param {String}	objectURI
	 * @param {'library'|'collection'|'item'} - The type of URI to expect
	 * @return {Object|FALSE} - An object containing 'libraryID' and, if applicable, 'key',
	 *                          or FALSE if library not found
	 */
	this._getURIObject = function (objectURI, type) {
		var libraryType;
		var libraryTypeID;
		
		// If this is a local URI, compare to the local user key
		if (objectURI.match(/\/users\/local\//)) {
			// For now, at least, don't check local id
			/*
			var localUserURI = this.getLocalUserURI();
			if (localUserURI) {
				localUserURI += "/";
				if (objectURI.indexOf(localUserURI) == 0) {
					objectURI = objectURI.substr(localUserURI.length);
					var libraryType = 'user';
					var id = null;
				}
			}
			*/
			libraryType = 'user';
			libraryTypeID = null;
		}
		
		// If not found, try global URI
		if (!libraryType) {
			if (!objectURI.startsWith(_baseURI)) {
				throw new Error("Invalid base URI '" + objectURI + "'");
			}
			objectURI = objectURI.substr(_baseURI.length);
			let typeRE = /^(users|groups)\/([0-9]+)(?:\/|$)/;
			let matches = objectURI.match(typeRE);
			if (!matches) {
				throw new Error("Invalid library URI '" + objectURI + "'");
			}
			libraryType = matches[1].substr(0, matches[1].length-1);
			libraryTypeID = matches[2];
			objectURI = objectURI.replace(typeRE, '');
		}
		
		if (libraryType == 'user' && objectURI.startsWith('publications/')) {
			libraryType = 'publications';
		}
		
		if (libraryType == 'user') {
			var libraryID = Zotero.Libraries.userLibraryID;
		}
		else if (libraryType == 'group') {
			if (!Zotero.Groups.exists(libraryTypeID)) {
				return false;
			}
			var libraryID = Zotero.Groups.getLibraryIDFromGroupID(libraryTypeID);
		}
		else if (libraryType == 'publications') {
			var libraryID = Zotero.Libraries.publicationsLibraryID;
		}
		
		if(type === 'library') {
			if (libraryType == 'user') {
				if (libraryTypeID) {
					if (libraryTypeID == Zotero.Users.getCurrentUserID())  {
						return {
							libraryID: libraryID
						};
					}
				}
				else {
					var localUserURI = this.getLocalUserURI();
					if (localUserURI) {
						localUserURI += "/";
						if (objectURI.startsWith(localUserURI)) {
							return {
								libraryID: Zotero.Libraries.userLibraryID
							};
						}
					}
				}
				return false;
			}
			
			if (libraryType == 'group') {
				return {
					libraryID: libraryID
				};
			}
		} else {
			var re = /(?:items|collections)\/([A-Z0-9]{8})/;
			var matches = objectURI.match(re);
			if (!matches) {
				throw ("Invalid object URI '" + objectURI + "' in Zotero.URI._getURIObject()");
			}
			let objectKey = matches[1];
			return {
				libraryID: libraryID,
				key: objectKey
			};
		}
	}
}
