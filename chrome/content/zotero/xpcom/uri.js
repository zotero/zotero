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
		var key = Zotero.getLocalUserKey();
		if (!key) {
			return false;
		}
		
		return _baseURI + "users/local/" + Zotero.getLocalUserKey();
	}
	
	
	/**
	 * Get a URI for the user, creating a local user key if necessary
	 *
	 * @return	{String}
	 */
	this.getCurrentUserURI = function (noLocal) {
		var userID = Zotero.userID;
		if (!userID && noLocal) {
			throw new Exception("Local userID not available and noLocal set in Zotero.URI.getCurrentUserURI()");
		}
		if (userID) {
			return _baseURI + "users/" + userID;
		}
		
		return _baseURI + "users/local/" + Zotero.getLocalUserKey(true);
	}
	
	
	this.getCurrentUserLibraryURI = function () {
		var userID = Zotero.userID;
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
		libraryID = libraryID ? parseInt(libraryID) : 0;
		var libraryType = Zotero.Libraries.getType(libraryID);
		
		switch (libraryType) {
			case 'user':
				var id = Zotero.userID;
				if (!id) {
					throw new Exception("User id not available in Zotero.URI.getLibraryPath()");
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
	 */
	this.getURIItem = function (itemURI) {
		return this._getURIObject(itemURI, 'item');
	}
	
	
	/**
	 * Convert a collection URI into a collection
	 *
	 * @param	{String}				collectionURI
	 * @param	{Zotero.Collection|FALSE}
	 */
	this.getURICollection = function (collectionURI) {
		return this._getURIObject(collectionURI, 'collection');
	}
	
	
	/**
	 * Convert a library URI into a libraryID
	 *
	 * @param	{String}				libraryURI
	 * @return	{Zotero.Collection|FALSE}
	 */
	this.getURILibrary = function (libraryURI) {
		return this._getURIObject(libraryURI, "library");
	}
	
	
	/**
	 * Convert an object URI into an object (item, collection, etc.)
	 *
	 * @param	{String}	objectURI
	 * @param	{"item"|"collection"|"library"}	[type]	The type of object to return. If the object
	 *     is valid but not available, returns "false". Note that if type is "library", this
	 *     this function may return null for the default library, which is distinct from false.
	 *					
	 * @return	{Zotero.Item|Zotero.Collection|Integer|NULL|FALSE}
	 */
	this._getURIObject = function (objectURI, type) {
		var Types = type[0].toUpperCase() + type.substr(1) + 's';
		var types = Types.toLowerCase();
		
		var libraryType = null;
		
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
			var libraryType = 'user';
			var id = null;
		}
		
		// If not found, try global URI
		if (!libraryType) {
			if (objectURI.indexOf(_baseURI) != 0) {
				throw ("Invalid base URI '" + objectURI + "' in Zotero.URI._getURIObject()");
			}
			objectURI = objectURI.substr(_baseURI.length);
			var typeRE = /^(users|groups)\/([0-9]+)(?:\/|$)/;
			var matches = objectURI.match(typeRE);
			if (!matches) {
				throw ("Invalid library URI '" + objectURI + "' in Zotero.URI._getURIObject()");
			}
			var libraryType = matches[1].substr(0, matches[1].length-1);
			var id = matches[2];
			objectURI = objectURI.replace(typeRE, '');
		}
		
		if (libraryType == 'group') {
			if (!Zotero.Groups.get(id)) {
				return false;
			}
			var libraryID = Zotero.Groups.getLibraryIDFromGroupID(id);
		}
		
		if(type === 'library') {
			if (libraryType == 'user') {
				if(id === null) {
					var localUserURI = this.getLocalUserURI();
					if (localUserURI) {
						localUserURI += "/";
						if (objectURI.indexOf(localUserURI) == 0) {
							objectURI = objectURI.substr(localUserURI.length);
							return null;
						}
					}
				} else {
					if(id == Zotero.userID)  {
						return null;
					}
				}
				
				return false;
			}
			
			if (libraryType == 'group') {
				return libraryID;
			}
		} else {
			// TODO: objectID-based URI?
			var re = new RegExp(types + "\/([A-Z0-9]{8})");
			var matches = objectURI.match(re);
			if (!matches) {
				throw ("Invalid object URI '" + objectURI + "' in Zotero.URI._getURIObject()");
			}
			var objectKey = matches[1];
	
			if (libraryType == 'user') {
				return Zotero[Types].getByLibraryAndKey(null, objectKey);
			}
			
			if (libraryType == 'group') {
				return Zotero[Types].getByLibraryAndKey(libraryID, objectKey);
			}
		}
	}
}
