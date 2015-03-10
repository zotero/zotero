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
	
	/**
	* Add new collection to DB and return Collection object
	*
	* _name_ is non-empty string
	* _parent_ is optional collectionID -- creates root collection by default
	*
	* Returns true on success; false on error
	**/
	this.add = function (name, parent) {
		var col = new Zotero.Collection;
		col.name = name;
		col.parent = parent;
		var id = col.save();
		return this.getAsync(id);
	}
	
	
	/*
	 * Zotero.getCollections(parent)
	 *
	 * Returns an array of all collections are children of a collection
	 * as Zotero.Collection instances
	 *
	 * Takes parent collectionID as optional parameter;
	 * by default, returns root collections
	 */
	this.getByParent = Zotero.Promise.coroutine(function* (libraryID, parentID, recursive) {
		let children;
		
		if (parentID) {
			let parent = yield this.getAsync(parentID);
			yield parent.loadChildCollections();
			children = parent.getChildCollections();
		} else if (libraryID) {
			children = yield this.getCollectionsInLibrary(libraryID);
		} else {
			throw new Error("Either library ID or parent collection ID must be provided to getNumCollectionsByParent");
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
			
			var desc = obj.getDescendents(false, 'collection');
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
	});
	
	
	this.getCollectionsInLibrary = Zotero.Promise.coroutine(function* (libraryID) {
		let sql = "SELECT collectionID AS id FROM collections C "
			+ "WHERE libraryID=? AND parentCollectionId IS NULL";
		let ids = yield Zotero.DB.queryAsync(sql, [libraryID]);
		let collections = yield this.getAsync(ids.map(function(row) row.id));
		if (!collections.length) return collections;
		
		return collections.sort(function (a, b) Zotero.localeCompare(a.name, b.name));
	});
	
	
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
	
	
	/**
	 * Invalidate child collection cache in specified collections, skipping any that aren't loaded
	 *
	 * @param	{Integer|Integer[]}	ids		One or more collectionIDs
	 */
	this.refreshChildCollections = Zotero.Promise.coroutine(function* (ids) {
		ids = Zotero.flattenArguments(ids);
		
		for (let i=0; i<ids.length; i++) {
			let id = ids[i];
			if (this._objectCache[id]) {
				yield this._objectCache[id]._refreshChildCollections();
			}
		}
	});
	
	
	/**
	 * Invalidate child item cache in specified collections, skipping any that aren't loaded
	 *
	 * @param	{Integer|Integer[]}	ids		One or more itemIDs
	 */
	this.refreshChildItems = Zotero.Promise.coroutine(function* (ids) {
		ids = Zotero.flattenArguments(ids);
		
		for (let i=0; i<ids.length; i++) {
			let id = ids[i];
			if (this._objectCache[id]) {
				yield this._objectCache[id]._refreshChildItems();
			}
		}
	});
	
	
	this.erase = function(ids) {
		ids = Zotero.flattenArguments(ids);
		
		return Zotero.DB.executeTransaction(function* () {
			for each(var id in ids) {
				var collection = yield this.getAsync(id);
				if (collection) {
					yield collection.erase();
				}
				collection = undefined;
			}
			
			this.unload(ids);
		});
	};
	
	Zotero.DataObjects.call(this);
	
	return this;
}.bind(Object.create(Zotero.DataObjects.prototype))();
