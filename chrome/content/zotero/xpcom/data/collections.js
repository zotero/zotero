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


/*
 * Primary interface for accessing Zotero collection
 */
Zotero.Collections = function() {
	this.constructor = null;
	
	this._ZDO_object = 'collection';
	
	this._primaryDataSQLParts = {
		collectionID: "O.collectionID",
		name: "O.collectionName AS name",
		libraryID: "O.libraryID",
		key: "O.key",
		version: "O.version",
		synced: "O.synced",
		
		parentID: "O.parentCollectionID AS parentID",
		parentKey: "CP.key AS parentKey",
		
		hasChildCollections: "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=O.collectionID) != 0 AS hasChildCollections",
		hasChildItems: "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=O.collectionID) != 0 AS hasChildItems"
	};
	
		
	this._primaryDataSQLFrom = "FROM collections O "
			+ "LEFT JOIN collections CP ON (O.parentCollectionID=CP.collectionID)";
	
	this._relationsTable = "collectionRelations";
	
	/**
	 * Get collections within a library
	 *
	 * Either libraryID or parentID must be provided
	 *
	 * @param {Integer} libraryID
	 * @param {Boolean} [recursive=false]
	 * @return {Promise<Zotero.Collection[]>}
	 */
	this.getByLibrary = function (libraryID, recursive) {
		return _getByContainer(libraryID, null, recursive);
	}
	
	
	/**
	 * Get collections that are subcollection of a given collection
	 *
	 * @param {Integer} parentCollectionID
	 * @param {Boolean} [recursive=false]
	 * @return {Promise<Zotero.Collection[]>}
	 */
	this.getByParent = function (parentCollectionID, recursive) {
		return _getByContainer(null, parentCollectionID, recursive);
	}
	
	
	var _getByContainer = Zotero.Promise.coroutine(function* (libraryID, parentID, recursive) {
		let children;
		
		if (parentID) {
			let parent = yield Zotero.Collections.getAsync(parentID);
			yield parent.loadChildCollections();
			children = parent.getChildCollections();
		} else if (libraryID) {
			let sql = "SELECT collectionID AS id FROM collections "
				+ "WHERE libraryID=? AND parentCollectionID IS NULL";
			let ids = yield Zotero.DB.columnQueryAsync(sql, [libraryID]);
			children = yield this.getAsync(ids);
		} else {
			throw new Error("Either library ID or parent collection ID must be provided");
		}
		
		if (!children.length) {
			return children;
		}
		
		// Do proper collation sort
		children.sort(function (a, b) Zotero.localeCompare(a.name, b.name));
		
		if (!recursive) return children;
		
		let toReturn = [];
		for (var i=0, len=children.length; i<len; i++) {
			var obj = children[i];
			toReturn.push(obj);
			
			var desc = yield obj.getDescendents(false, 'collection');
			for (var j in desc) {
				var obj2 = yield this.getAsync(desc[j]['id']);
				if (!obj2) {
					throw new Error('Collection ' + desc[j] + ' not found');
				}
				
				// TODO: This is a quick hack so that we can indent subcollections
				// in the search dialog -- ideally collections would have a
				// getLevel() method, but there's no particularly quick way
				// of calculating that without either storing it in the DB or
				// changing the schema to Modified Preorder Tree Traversal,
				// and I don't know if we'll actually need it anywhere else.
				obj2.level = desc[j].level;
				
				toReturn.push(obj2);
			}
		}
		
		return toReturn;
	}.bind(this));
	
	
	this.getCollectionsContainingItems = function (itemIDs, asIDs) {
		// If an unreasonable number of items, don't try
		if (itemIDs.length > 100) {
			return Zotero.Promise.resolve([]);
		}
		
		var sql = "SELECT collectionID FROM collections WHERE ";
		var sqlParams = [];
		for each(var id in itemIDs) {
			sql += "collectionID IN (SELECT collectionID FROM collectionItems "
				+ "WHERE itemID=?) AND "
			sqlParams.push(id);
		}
		sql = sql.substring(0, sql.length - 5);
		return Zotero.DB.columnQueryAsync(sql, sqlParams)
		.then(collectionIDs => {
			return asIDs ? collectionIDs : this.get(collectionIDs);
		});
		
	}
	
	
	this.registerChildCollection = function (collectionID, childCollectionID) {
		if (this._objectCache[collectionID]) {
			this._objectCache[collectionID]._registerChildCollection(childCollectionID);
		}
	}
	
	
	this.unregisterChildCollection = function (collectionID, childCollectionID) {
		if (this._objectCache[collectionID]) {
			this._objectCache[collectionID]._unregisterChildCollection(childCollectionID);
		}
	}
	
	
	this.registerChildItem = function (collectionID, itemID) {
		if (this._objectCache[collectionID]) {
			this._objectCache[collectionID]._registerChildItem(itemID);
		}
	}
	
	
	this.unregisterChildItem = function (collectionID, itemID) {
		if (this._objectCache[collectionID]) {
			this._objectCache[collectionID]._unregisterChildItem(itemID);
		}
	}
	
	Zotero.DataObjects.call(this);
	
	return this;
}.bind(Object.create(Zotero.DataObjects.prototype))();
