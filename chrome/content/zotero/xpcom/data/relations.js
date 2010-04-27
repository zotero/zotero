/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Relations = new function () {
	Zotero.DataObjects.apply(this, ['relation']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	var _namespaces = {
		owl: 'http://www.w3.org/2002/07/owl#'
	};
	
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
	
	
	this.eraseByURIPrefix = function (prefix) {
		prefix = prefix + '%';
		sql = "DELETE FROM relations WHERE subject LIKE ? OR object LIKE ?";
		Zotero.DB.query(sql, [prefix, prefix]);
	}
	
	
	this.eraseByURI = function (uri) {
		sql = "DELETE FROM relations WHERE subject=? OR object=?";
		Zotero.DB.query(sql, [uri, uri]);
	}
	
	
	this.purge = function () {
		var sql = "SELECT subject FROM relations UNION SELECT object FROM relations";
		var uris = Zotero.DB.columnQuery(sql);
		if (uris) {
			var prefix = Zotero.URI.defaultPrefix;
			Zotero.DB.beginTransaction();
			for each(var uri in uris) {
				// Skip URIs that don't begin with the default prefix,
				// since they don't correspond to local items
				if (uri.indexOf(prefix) == -1) {
					continue;
				}
				if (!Zotero.URI.getURIItem(uri)) {
					this.eraseByURI(uri);
				}
			}
			Zotero.DB.commitTransaction();
		}
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
				throw ("Invalid prefix '" + prefix + "' in Zotero.Relations._getPrefixAndValue()");
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
