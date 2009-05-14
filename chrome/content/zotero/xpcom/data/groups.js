Zotero.Groups = new function () {
	this.__defineGetter__('addGroupURL', function () ZOTERO_CONFIG.WWW_BASE_URL + 'groups/new/');
	
	this.get = function (id) {
		if (!id) {
			throw ("groupID not provided in Zotero.Groups.get()");
		}
		var group = new Zotero.Group;
		group.id = id;
		if (!group.exists()) {
			return false;
		}
		return group;
	}
	
	
	this.getAll = function () {
		var groups = [];
		var sql = "SELECT groupID FROM groups";
		var groupIDs = Zotero.DB.columnQuery(sql);
		if (!groupIDs) {
			return groups;
		}
		for each(var groupID in groupIDs) {
			var group = this.get(groupID);
			groups.push(group);
		}
		return groups;
	}
	
	
	this.getByLibraryID = function (libraryID) {
		var groupID = this.getGroupIDFromLibraryID(libraryID);
		return this.get(groupID);
	}
	
	
	this.getGroupIDFromLibraryID = function (libraryID) {
		var sql = "SELECT groupID FROM groups WHERE libraryID=?";
		var groupID = Zotero.DB.valueQuery(sql, libraryID);
		if (!groupID) {
			throw ("Group with libraryID " + libraryID + " does not exist "
					+ "in Zotero.Groups.getGroupIDFromLibraryID()");
		}
		return groupID;
	}
	
	
	this.getLibraryIDFromGroupID = function (groupID) {
		var sql = "SELECT libraryID FROM groups WHERE groupID=?";
		var libraryID = Zotero.DB.valueQuery(sql, groupID);
		if (!libraryID) {
			throw ("Group with groupID " + groupID + " does not exist "
					+ "in Zotero.Groups.getLibraryIDFromGroupID()");
		}
		return libraryID;
	}
}
