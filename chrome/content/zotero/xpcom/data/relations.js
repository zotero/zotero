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

"use strict";

Zotero.Relations = new function () {
	Zotero.defineProperty(this, 'relatedItemPredicate', {value: 'dc:relation'});
	Zotero.defineProperty(this, 'linkedObjectPredicate', {value: 'owl:sameAs'});
	Zotero.defineProperty(this, 'replacedItemPredicate', {value: 'dc:replaces'});
	
	this._namespaces = {
		dc: 'http://purl.org/dc/elements/1.1/',
		owl: 'http://www.w3.org/2002/07/owl#'
	};
	
	var _types = ['collection', 'item'];
	
	
	/**
	 * Get the data objects that are subjects with the given predicate and object
	 *
	 * @param {String} objectType - Type of relation to search for (e.g., 'item')
	 * @param {String} predicate
	 * @param {String} object
	 * @return {Promise<Zotero.DataObject[]>}
	 */
	this.getByPredicateAndObject = Zotero.Promise.coroutine(function* (objectType, predicate, object) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		if (predicate) {
			predicate = this._getPrefixAndValue(predicate).join(':');
		}
		var sql = "SELECT " + objectsClass.idColumn + " FROM " + objectType + "Relations "
			+ "JOIN relationPredicates USING (predicateID) WHERE predicate=? AND object=?";
		var ids = yield Zotero.DB.columnQueryAsync(sql, [predicate, object]);
		return yield objectsClass.getAsync(ids, { noCache: true });
	});
	
	
	/**
	 * Get the data objects that are subjects with the given predicate and object
	 *
	 * @param {String} objectType - Type of relation to search for (e.g., 'item')
	 * @param {String} object
	 * @return {Promise<Object[]>} - Promise for an object with a Zotero.DataObject as 'subject'
	 *                               and a predicate string as 'predicate'
	 */
	this.getByObject = Zotero.Promise.coroutine(function* (objectType, object) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var sql = "SELECT " + objectsClass.idColumn + " AS id, predicate "
			+ "FROM " + objectType + "Relations JOIN relationPredicates USING (predicateID) "
			+ "WHERE object=?";
		var toReturn = [];
		var rows = yield Zotero.DB.queryAsync(sql, object);
		for (let i = 0; i < rows.length; i++) {
			toReturn.push({
				subject: yield objectsClass.getAsync(rows[i].id, { noCache: true }),
				predicate: rows[i].predicate
			});
		}
		return toReturn;
	});
	
	
	this.updateUser = Zotero.Promise.coroutine(function* (fromUserID, fromLibraryID, toUserID, toLibraryID) {
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
		
		yield Zotero.DB.executeTransaction(function* () {
			var sql = "UPDATE relations SET libraryID=? WHERE libraryID=?";
			yield Zotero.DB.queryAsync(sql, [toLibraryID, fromLibraryID]);
			
			sql = "UPDATE relations SET "
					+ "subject=REPLACE(subject, 'zotero.org/users/" + fromUserID + "', "
						+ "'zotero.org/users/" + toUserID + "'), "
					+ "object=REPLACE(object, 'zotero.org/users/" + fromUserID + "', "
						+ "'zotero.org/users/" + toUserID + "') "
						+ "WHERE predicate IN (?, ?)";
			yield Zotero.DB.queryAsync(sql, [this.linkedObjectPredicate, this.replacedItemPredicate]);
		}.bind(this));
	});
	
	
	this.purge = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Purging relations");
		
		Zotero.DB.requireTransaction();
		var t = new Date;
		let prefix = Zotero.URI.defaultPrefix;
		var types = ['collection', 'item'];
		for (let type of types) {
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			let getFunc = "getURI" + Zotero.Utilities.capitalize(type);
			let objects = {};
			
			// Get all object URIs except merge-tracking ones
			let sql = "SELECT " + objectsClass.idColumn + " AS id, predicate, object "
				+ "FROM " + type + "Relations "
				+ "JOIN relationPredicates USING (predicateID) WHERE predicate != ?";
			let rows = yield Zotero.DB.queryAsync(sql, [this.replacedItemPredicate]);
			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				let uri = row.object;
				// Erase Zotero URIs of this type that don't resolve to a local object
				//
				// TODO: Check for replaced-item relations and update relation rather than
				// removing
				if (uri.indexOf(prefix) != -1
						&& uri.indexOf("/" + type + "s/") != -1
						&& !Zotero.URI[getFunc](uri)) {
					if (!objects[row.id]) {
						objects[row.id] = yield objectsClass.getAsync(row.id, { noCache: true });
					}
					objects[row.id].removeRelation(row.predicate, uri);
				}
				for (let i in objects) {
					yield objects[i].save();
				}
			}
			
			Zotero.debug("Purged relations in " + ((new Date) - t) + "ms");
		}
	});
	
	
	this._getPrefixAndValue = function(uri) {
		var [prefix, value] = uri.split(':');
		if (prefix && value) {
			if (!this._namespaces[prefix]) {
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