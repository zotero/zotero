Zotero.Libraries = new function () {
	this.exists = function (libraryID) {
		var sql = "SELECT COUNT(*) FROM libraries WHERE libraryID=?";
		return !!Zotero.DB.valueQuery(sql, [libraryID]);
	}
	
	
	this.add = function (libraryID, type) {
		switch (type) {
			case 'group':
				break;
			
			default:
				throw ("Invalid library type '" + type + "' in Zotero.Libraries.add()");
		}
		
		var sql = "INSERT INTO libraries (libraryID, libraryType) VALUES (?, ?)";
		Zotero.DB.query(sql, [libraryID, type]);
	}
	
	
	this.getName = function (libraryID) {
		var type = this.getType(libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				var group = Zotero.Groups.get(groupID);
				return group.name;
			
			default:
				throw ("Unsupported library type '" + type + "' in Zotero.Libraries.getName()");
		}
	}
	
	
	this.getType = function (libraryID) {
		var sql = "SELECT libraryType FROM libraries WHERE libraryID=?";
		var libraryType = Zotero.DB.valueQuery(sql, libraryID);
		if (!libraryType) {
			throw ("Library " + libraryID + " does not exist in Zotero.Libraries.getType()");
		}
		return libraryType;
	}
}
