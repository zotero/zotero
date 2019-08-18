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
		owl: 'http://www.w3.org/2002/07/owl#',
		mendeleyDB: 'http://zotero.org/namespaces/mendeleyDB#'
	};
	
	var _types = ['collection', 'item'];
	var _subjectsByPredicateIDAndObject = {};
	var _subjectPredicatesByObject = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		// Load relations for different types
		for (let type of _types) {
			let t = new Date();
			Zotero.debug(`Loading ${type} relations`);
			
			let sql = "SELECT * FROM " + type + "Relations "
				+ "JOIN relationPredicates USING (predicateID)";
			yield Zotero.DB.queryAsync(
				sql,
				false,
				{
					onRow: function (row) {
						this.register(
							type,
							row.getResultByIndex(0),
							row.getResultByIndex(1),
							row.getResultByIndex(2)
						);
					}.bind(this)
				}
			);
			
			Zotero.debug(`Loaded ${type} relations in ${new Date() - t} ms`);
		}
	});
	
	
	this.register = function (objectType, subjectID, predicate, object) {
		var predicateID = Zotero.RelationPredicates.getID(predicate);
		
		if (!_subjectsByPredicateIDAndObject[objectType]) {
			_subjectsByPredicateIDAndObject[objectType] = {};
		}
		if (!_subjectPredicatesByObject[objectType]) {
			_subjectPredicatesByObject[objectType] = {};
		}
		
		// _subjectsByPredicateIDAndObject
		var o = _subjectsByPredicateIDAndObject[objectType];
		if (!o[predicateID]) {
			o[predicateID] = {};
		}
		if (!o[predicateID][object]) {
			o[predicateID][object] = new Set();
		}
		o[predicateID][object].add(subjectID);
		
		// _subjectPredicatesByObject
		o = _subjectPredicatesByObject[objectType];
		if (!o[object]) {
			o[object] = {};
		}
		if (!o[object][predicateID]) {
			o[object][predicateID] = new Set();
		}
		o[object][predicateID].add(subjectID);
	};
	
	
	this.unregister = function (objectType, subjectID, predicate, object) {
		var predicateID = Zotero.RelationPredicates.getID(predicate);
		
		if (!_subjectsByPredicateIDAndObject[objectType]
				|| !_subjectsByPredicateIDAndObject[objectType][predicateID]
				|| !_subjectsByPredicateIDAndObject[objectType][predicateID][object]) {
			return;
		}
		
		_subjectsByPredicateIDAndObject[objectType][predicateID][object].delete(subjectID)
		_subjectPredicatesByObject[objectType][object][predicateID].delete(subjectID)
	};
	
	
	/**
	 * Get the data objects that are subjects with the given predicate and object
	 *
	 * @param {String} objectType - Type of relation to search for (e.g., 'item')
	 * @param {String} predicate
	 * @param {String} object
	 * @return {Zotero.DataObject[]}
	 */
	this.getByPredicateAndObject = function (objectType, predicate, object) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		if (predicate) {
			predicate = this._getPrefixAndValue(predicate).join(':');
		}
		
		var predicateID = Zotero.RelationPredicates.getID(predicate);
		
		var o = _subjectsByPredicateIDAndObject[objectType];
		if (!o || !o[predicateID] || !o[predicateID][object]) {
			return [];
		}
		return objectsClass.get(Array.from(o[predicateID][object].values()));
	};
	
	
	/**
	 * Get the data objects that are subjects with the given predicate and object
	 *
	 * @param {String} objectType - Type of relation to search for (e.g., 'item')
	 * @param {String} object
	 * @return {Object[]} - An array of objects with a Zotero.DataObject as 'subject'
	 *     and a predicate string as 'predicate'
	 */
	this.getByObject = Zotero.Promise.coroutine(function* (objectType, object) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var predicateIDs = [];
		var o = _subjectPredicatesByObject[objectType]
			? _subjectPredicatesByObject[objectType][object] : false;
		if (!o) {
			return [];
		}
		var toReturn = [];
		for (let predicateID in o) {
			for (let subjectID of o[predicateID]) {
				var subject = yield objectsClass.getAsync(subjectID);
				toReturn.push({
					subject: subject,
					predicate: Zotero.RelationPredicates.getName(predicateID)
				});
			};
		}
		return toReturn;
	});
	
	
	/**
	 * For every relation pointing to a given object, create a relation on the subject pointing to a
	 * new object
	 *
	 * @param {Zotero.DataObject} fromObject
	 * @param {Zotero.DataObject} toObject
	 * @return {Promise}
	 */
	this.copyObjectSubjectRelations = async function (fromObject, toObject) {
		var objectType = fromObject.objectType;
		var ObjectType = Zotero.Utilities.capitalize(objectType);
		var fromObjectURI = Zotero.URI[`get${ObjectType}URI`](fromObject);
		var toObjectURI = Zotero.URI[`get${ObjectType}URI`](toObject);
		var subjectPredicates = await Zotero.Relations.getByObject(objectType, fromObjectURI);
		for (let { subject, predicate } of subjectPredicates) {
			if (subject.isEditable()) {
				subject.addRelation(predicate, toObjectURI);
				await subject.saveTx({
					skipDateModifiedUpdate: true
				});
			}
			else {
				Zotero.debug(`Subject ${objectType} ${subject.libraryKey} is not editable `
					+ `-- not copying ${predicate} relation`);
			}
		}
	};
	
	
	this.updateUser = Zotero.Promise.coroutine(function* (fromUserID, toUserID) {
		if (!fromUserID) {
			fromUserID = "local/" + Zotero.Users.getLocalUserKey();
		}
		if (!toUserID) {
			throw new Error("Invalid target userID " + toUserID);
		}
		
		Zotero.DB.requireTransaction();
		for (let type of _types) {
			let sql = `SELECT DISTINCT object FROM ${type}Relations WHERE object LIKE ?`;
			let objects = yield Zotero.DB.columnQueryAsync(
				sql, 'http://zotero.org/users/' + fromUserID + '/%'
			);
			Zotero.DB.addCurrentCallback("commit", function* () {
				for (let object of objects) {
					let subPrefs = yield this.getByObject(type, object);
					let newObject = object.replace(
						new RegExp("^http://zotero.org/users/" + fromUserID + "/(.*)"),
						"http://zotero.org/users/" + toUserID + "/$1"
					);
					for (let subPref of subPrefs) {
						this.unregister(type, subPref.subject.id, subPref.predicate, object);
						this.register(type, subPref.subject.id, subPref.predicate, newObject);
					}
				}
			}.bind(this));
			
			sql = "UPDATE " + type + "Relations SET "
				+ "object=REPLACE(object, 'zotero.org/users/" + fromUserID + "/', "
				+ "'zotero.org/users/" + toUserID + "/')";
			yield Zotero.DB.queryAsync(sql);
			
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			let loadedObjects = objectsClass.getLoaded();
			for (let object of loadedObjects) {
				yield object.reload(['relations'], true);
			}
		}
	});
	
	
	this.purge = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Purging relations");
		
		Zotero.DB.requireTransaction();
		var t = new Date;
		let prefix = Zotero.URI.defaultPrefix;
		for (let type of _types) {
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			let getFunc = "getURI" + Zotero.Utilities.capitalize(type);
			let objects = {};
			
			// Get all object URIs except merge-tracking ones
			let sql = "SELECT " + objectsClass.idColumn + " AS id, predicate, object "
				+ "FROM " + objectsClass.relationsTable
				+ " JOIN relationPredicates USING (predicateID) WHERE predicate != ?";
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
						&& !(yield Zotero.URI[getFunc](uri))) {
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
