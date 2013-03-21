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

Zotero.Relations = new function () {
	Zotero.DataObjects.apply(this, ['relation']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	this.__defineGetter__('linkedObjectPredicate', function () "owl:sameAs");
	this.__defineGetter__('deletedItemPredicate', function () 'dc:isReplacedBy');
	
	var _namespaces = {
		dc: 'http://purl.org/dc/elements/1.1/',
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
		if (predicate) {
			predicate = _getPrefixAndValue(predicate).join(':');
		}
		
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
		Zotero.DB.query(sql, [toLibraryID, fromLibraryID]);
		
		sql = "UPDATE relations SET "
				+ "subject=REPLACE(subject, 'zotero.org/users/" + fromUserID + "', "
					+ "'zotero.org/users/" + toUserID + "'), "
				+ "object=REPLACE(object, 'zotero.org/users/" + fromUserID + "', "
					+ "'zotero.org/users/" + toUserID + "') "
					+ "WHERE predicate IN (?, ?)";
		Zotero.DB.query(sql, [this.linkedObjectPredicate, this.deletedItemPredicate]);
		
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
	
	
	/**
	 * Copy relations from one object to another within the same library
	 */
	this.copyURIs = function (libraryID, fromURI, toURI) {
		var rels = this.getByURIs(fromURI);
		for each(var rel in rels) {
			this.add(libraryID, toURI, rel.predicate, rel.object);
		}
		
		var rels = this.getByURIs(false, false, fromURI);
		for each(var rel in rels) {
			this.add(libraryID, rel.subject, rel.predicate, toURI);
		}
	}
	
	
	/**
	 * @param {String} prefix
	 * @param {String[]} ignorePredicates
	 */
	this.eraseByURIPrefix = function (prefix, ignorePredicates) {
		Zotero.DB.beginTransaction();
		
		prefix = prefix + '%';
		var sql = "SELECT ROWID FROM relations WHERE (subject LIKE ? OR object LIKE ?)";
		var params = [prefix, prefix];
		if (ignorePredicates) {
			for each(var ignorePredicate in ignorePredicates) {
				sql += " AND predicate != ?";
				params.push(ignorePredicate);
			}
		}
		var ids = Zotero.DB.columnQuery(sql, params);
		
		for each(var id in ids) {
			var relation = this.get(id);
			relation.erase();
		}
		
		Zotero.DB.commitTransaction();
	}
	
	
	this.eraseByURI = function (uri, ignorePredicates) {
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT ROWID FROM relations WHERE (subject=? OR object=?)";
		var params = [uri, uri];
		if (ignorePredicates) {
			for each(var ignorePredicate in ignorePredicates) {
				sql += " AND predicate != ?";
				params.push(ignorePredicate);
			}
		}
		var ids = Zotero.DB.columnQuery(sql, params);
		
		for each(var id in ids) {
			var relation = this.get(id);
			relation.erase();
		}
		
		Zotero.DB.commitTransaction();
	}
	
	
	this.purge = function () {
		var sql = "SELECT subject FROM relations WHERE predicate != ? "
				+ "UNION SELECT object FROM relations WHERE predicate != ?";
		var uris = Zotero.DB.columnQuery(sql, [this.deletedItemPredicate, this.deletedItemPredicate]);
		if (uris) {
			var prefix = Zotero.URI.defaultPrefix;
			Zotero.DB.beginTransaction();
			for each(var uri in uris) {
				// Skip URIs that don't begin with the default prefix,
				// since they don't correspond to local items
				if (uri.indexOf(prefix) == -1) {
					continue;
				}
				if (uri.indexOf(/\/items\//) != -1 && !Zotero.URI.getURIItem(uri)) {
					this.eraseByURI(uri);
				}
				if (uri.indexOf(/\/collections\//) != -1 && !Zotero.URI.getURICollection(uri)) {
					this.eraseByURI(uri);
				}
			}
			Zotero.DB.commitTransaction();
		}
	}
	
	
	this.xmlToRelation = function (relationNode) {
		var relation = new Zotero.Relation;
		var libraryID = relationNode.getAttribute('libraryID');
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
		
		var elems = Zotero.Utilities.xpath(relationNode, 'subject');
		relation.subject = elems.length ? elems[0].textContent : "";
		var elems = Zotero.Utilities.xpath(relationNode, 'predicate');
		relation.predicate = elems.length ? elems[0].textContent : "";
		var elems = Zotero.Utilities.xpath(relationNode, 'object');
		relation.object = elems.length ? elems[0].textContent : "";
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
