Zotero.URI = new function () {
	var _baseURI = ZOTERO_CONFIG.BASE_URI;
	
	
	this.getCurrentUserURI = function () {
		var userID = Zotero.userID;
		if (userID) {
			return _baseURI + "users/" + userID;
		}
		
		return _baseURI + "users/local/" + Zotero.getLocalUserKey(true);
	}
	
	
	this.getLibraryURI = function (libraryID) {
		var libraryType = Zotero.Libraries.getType(libraryID);
		switch (libraryType) {
			case 'group':
				var id = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				break;
			
			case 'user':
				throw ("User library ids are not supported in Zotero.URI.getLibraryURI");
			
			default:
				throw ("Unsupported library type '" + libraryType + "' in Zotero.URI.getLibraryURI()");
		}
		return _baseURI + libraryType + "s/" + id;
	}
	
	
	this.getItemURI = function (item) {
		if (item.libraryID) {
			var baseURI = this.getLibraryURI(item.libraryID);
		}
		else {
			var baseURI =  this.getCurrentUserURI();
		}
		return baseURI + "/items/" + item.key;
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
		var libraryType = null;
		
		// If this is a local URI, compare to the local user key
		if (itemURI.match(/\/users\/local\//)) {
			var currentUserURI = this.getCurrentUserURI() + "/";
			if (itemURI.indexOf(currentUserURI) == 0) {
				itemURI = itemURI.substr(currentUserURI.length);
				var libraryType = 'user';
				var libraryTypeID = null;
			}
		}
		
		// If not found, try global URI
		if (!libraryType) {
			if (itemURI.indexOf(_baseURI) != 0) {
				throw ("Invalid base URI '" + itemURI + "' in Zotero.URI.getURIItem()");
			}
			itemURI = itemURI.substr(_baseURI.length);
			var typeRE = /^(users|groups)\/([0-9]+)\//;
			var matches = itemURI.match(typeRE);
			if (!matches) {
				throw ("Invalid library URI '" + itemURI + "' in Zotero.URI.getURIItem()");
			}
			var libraryType = matches[1].substr(0, matches[1].length-1);
			var libraryTypeID = matches[2];
			itemURI = itemURI.replace(typeRE, '');
		}
		
		// TODO: itemID-based URI?
		var matches = itemURI.match(/items\/([A-Z0-9]{8})/);
		if (!matches) {
			throw ("Invalid item URI '" + itemURI + "' in Zotero.URI.getURIItem()");
		}
		var itemKey = matches[1];
		
		if (libraryType == 'user') {
			return Zotero.Items.getByLibraryAndKey(null, itemKey);
		}
		
		if (libraryType == 'group') {
			var libraryID = Zotero.Groups.getLibraryIDFromGroupID(libraryTypeID);
			return Zotero.Items.getByLibraryAndKey(libraryID, itemKey);
		}
	}
}
