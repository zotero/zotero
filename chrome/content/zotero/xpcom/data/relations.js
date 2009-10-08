Zotero.Relations = new function () {
	Zotero.DataObjects.apply(this, ['relation']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	var _namespaces = {
		owl: 'http://www.w3.org/2002/07/owl#'
	};
	
	var _prefix = "http://zotero.org/";
	
	this.get = function (id) {
		if (typeof id != 'number') {
			throw ("id '" + id + "' must be an integer in Zotero.Relations.get()");
		}
		
		var relation = new Zotero.Relation;
		relation.id = id;
		return relation;
	}
	
	
	/**
	 * @return	{Object[]}
	 */
	this.getByURIs = function (subject, predicate, object) {
		predicate = _getPrefixAndValue(predicate).join(':');
		if (!subject && !predicate && !object) {
			throw ("No values provided in Zotero.Relations.get()");
		}
		
		var sql = "SELECT ROWID FROM relations WHERE 1";
		var params = [];
		if (subject) {
			sql += " AND subject=?";
			params.push(subject);
		}
		if (predicate) {
			sql += " AND predicate=?";
			params.push(predicate);
		}
		if (object) {
			sql += " AND object=?";
			params.push(object);
		}
		var rows = Zotero.DB.columnQuery(sql, params);
		if (!rows) {
			return [];
		}
		
		var toReturn = [];
		for each(var id in rows) {
			var relation = new Zotero.Relation;
			relation.id = id; 
			toReturn.push(relation);
		}
		return toReturn;
	}
	
	
	this.getSubject = function (subject, predicate, object) {
		var subjects = [];
		var relations = this.getByURIs(subject, predicate, object);
		for each(var relation in relations) {
			subjects.push(relation.subject);
		}
		return subjects;
	}
	
	
	this.getObject = function (subject, predicate, object) {
		var objects = [];
		var relations = this.getByURIs(subject, predicate, object);
		for each(var relation in relations) {
			objects.push(relation.object);
		}
		return objects;
	}
	
	
	this.updateUser = function (fromUserID, fromLibraryID, toUserID, toLibraryID) {
		if (!fromUserID) {
			throw ("Invalid source userID " + fromUserID + " in Zotero.Relations.updateUserID");
		}
		if (!fromLibraryID) {
			throw ("Invalid source libraryID " + fromLibraryID + " in Zotero.Relations.updateUserID");
		}
		if (!toUserID) {
			throw ("Invalid target userID " + toUserID + " in Zotero.Relations.updateUserID");
		}
		if (!toLibraryID) {
			throw ("Invalid target libraryID " + toLibraryID + " in Zotero.Relations.updateUserID");
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "UPDATE relations SET libraryID=? WHERE libraryID=?";
		Zotero.DB.query(sql, [fromLibraryID, toLibraryID]);
		
		sql = "UPDATE relations SET "
				+ "subject=REPLACE(subject, 'zotero.org/users/" + fromUserID + "', "
					+ "'zotero.org/users/" + toUserID + "'), "
				+ "object=REPLACE(object, 'zotero.org/users/" + fromUserID + "', "
					+ "'zotero.org/users/" + toUserID + "') "
					+ "WHERE predicate='owl:sameAs'";
		Zotero.DB.query(sql);
		
		Zotero.DB.commitTransaction();
	}
	
	
	this.add = function (libraryID, subject, predicate, object) {
		predicate = _getPrefixAndValue(predicate).join(':');
		
		var relation = new Zotero.Relation;
		if (!libraryID) {
			libraryID = Zotero.libraryID;
		}
		if (libraryID) {
			relation.libraryID = parseInt(libraryID);
		}
		else {
			relation.libraryID = "local/" + Zotero.getLocalUserKey(true);
		}
		relation.subject = subject;
		relation.predicate = predicate;
		relation.object = object;
		relation.save();
	}
	
	
	this.erase = function (id) {
		Zotero.DB.beginTransaction();
		
		var sql = "DELETE FROM relations WHERE ROWID=?";
		Zotero.DB.query(sql, [id]);
		
		// TODO: log to syncDeleteLog
		
		Zotero.DB.commitTransaction();
	}
	
	
	this.eraseByPathPrefix = function (prefix) {
		prefix = _prefix + prefix + '%';
		sql = "DELETE FROM relations WHERE subject LIKE ? OR object LIKE ?";
		Zotero.DB.query(sql, [prefix, prefix]);
	}
	
	
	this.xmlToRelation = function (xml) {
		var relation = new Zotero.Relation;
		var libraryID = xml.@libraryID.toString();
		if (libraryID) {
			relation.libraryID = parseInt(libraryID);
		}
		else {
			libraryID = Zotero.libraryID;
			if (!libraryID) {
				libraryID = Zotero.getLocalUserKey(true);
			}
			relation.libraryID = parseInt(libraryID);
		}
		relation.subject = xml.subject.toString();
		relation.predicate = xml.predicate.toString();
		relation.object = xml.object.toString();
		return relation;
	}
	
	
	function _getPrefixAndValue(uri) {
		var [prefix, value] = uri.split(':');
		if (prefix && value) {
			if (!_namespaces[prefix]) {
				throw ("Invalid prefix '" + prefix + "' in Zotero.Relations.add()");
			}
			return [prefix, value];
		}
		
		for (var prefix in namespaces) {
			if (uri.indexOf(namespaces[prefix]) == 0) {
				var value = uri.substr(namespaces[prefix].length - 1)
				return [prefix, value];
			}
		}
		throw ("Invalid namespace in URI '" + uri + "' in Zotero.Relations._getPrefixAndValue()");
	}
}
