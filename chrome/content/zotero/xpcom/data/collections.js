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
		
		deleted: "DC.collectionID IS NOT NULL AS deleted",
		
		parentID: "O.parentCollectionID AS parentID",
		parentKey: "CP.key AS parentKey",
		
		hasChildCollections: "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=O.collectionID) != 0 AS hasChildCollections",
		hasChildItems: "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=O.collectionID) != 0 AS hasChildItems"
	};
	
		
	this._primaryDataSQLFrom = "FROM collections O "
			+ "LEFT JOIN deletedCollections DC ON (O.collectionID=DC.collectionID)"
			+ "LEFT JOIN collections CP ON (O.parentCollectionID=CP.collectionID) ";
	
	this._relationsTable = "collectionRelations";
	
	/**
	 * Get collections within a library
	 *
	 * Either libraryID or parentID must be provided
	 *
	 * @param {Integer} libraryID
	 * @param {Boolean} [recursive=false]
	 * @param {Boolean} [includeTrashed=false]
	 * @return {Zotero.Collection[]}
	 */
	this.getByLibrary = function (libraryID, recursive, includeTrashed) {
		return _getByContainer(libraryID, null, recursive, includeTrashed);
	}
	
	
	/**
	 * Get collections that are subcollection of a given collection
	 *
	 * @param {Integer} parentCollectionID
	 * @param {Boolean} [recursive=false]
	 * @param {Boolean} [includeTrashed=false]
	 * @return {Zotero.Collection[]}
	 */
	this.getByParent = function (parentCollectionID, recursive, includeTrashed) {
		return _getByContainer(null, parentCollectionID, recursive, includeTrashed);
	}
	
	
	var _getByContainer = function (libraryID, parentID, recursive, includeTrashed) {
		let children = [];
		
		if (parentID) {
			let parent = Zotero.Collections.get(parentID);
			children = parent.getChildCollections(false, includeTrashed);
		} else if (libraryID) {
			for (let id in this._objectCache) {
				let c = this._objectCache[id];
				if (c.libraryID == libraryID && !c.parentKey && (includeTrashed || !c.deleted)) {
					c.level = 0;
					children.push(c);
				}
			}
		} else {
			throw new Error("Either library ID or parent collection ID must be provided");
		}
		
		if (!children.length) {
			return children;
		}
		
		// Do proper collation sort
		children.sort((a, b) => Zotero.localeCompare(a.name, b.name));
		
		if (!recursive) return children;
		
		let toReturn = [];
		for (var i=0, len=children.length; i<len; i++) {
			var obj = children[i];
			toReturn.push(obj);
			
			var descendants = obj.getDescendents(false, 'collection', includeTrashed);
			for (let d of descendants) {
				var obj2 = this.get(d.id);
				if (!obj2) {
					throw new Error('Collection ' + d.id + ' not found');
				}
				
				// TODO: This is a quick hack so that we can indent subcollections
				// in the search dialog -- ideally collections would have a
				// getLevel() method, but there's no particularly quick way
				// of calculating that without either storing it in the DB or
				// changing the schema to Modified Preorder Tree Traversal,
				// and I don't know if we'll actually need it anywhere else.
				obj2.level = d.level;
				
				toReturn.push(obj2);
			}
		}
		
		return toReturn;
	}.bind(this);
	
	
	this.getCollectionsContainingItems = function (itemIDs, asIDs) {
		if (!itemIDs.length) return [];
		var sql = "SELECT collectionID FROM collections WHERE ";
		var sqlParams = [];
		for (let id of itemIDs) {
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
	
	
	this._loadChildCollections = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = "SELECT C1.collectionID, C2.collectionID AS childCollectionID "
			+ "FROM collections C1 LEFT JOIN collections C2 ON (C1.collectionID=C2.parentCollectionID) "
			+ "WHERE C1.libraryID=?"
			+ (ids.length ? " AND C1.collectionID IN (" + ids.map(id => parseInt(id)).join(", ") + ")" : "");
		var params = [libraryID];
		var lastID;
		var rows = [];
		var setRows = function (collectionID, rows) {
			var collection = this._objectCache[collectionID];
			if (!collection) {
				throw new Error("Collection " + collectionID + " not found");
			}
			
			collection._childCollections = new Set(rows);
			collection._loaded.childCollections = true;
			collection._clearChanged('childCollections');
		}.bind(this);
		
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let collectionID = row.getResultByIndex(0);
					
					if (lastID && collectionID !== lastID) {
						setRows(lastID, rows);
						rows = [];
					}
					
					lastID = collectionID;
					
					let childCollectionID = row.getResultByIndex(1);
					// No child collections
					if (childCollectionID === null) {
						return;
					}
					rows.push(childCollectionID);
				}
			}
		);
		if (lastID) {
			setRows(lastID, rows);
		}
	});
	
	
	this._loadChildItems = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = "SELECT collectionID, itemID FROM collections "
			+ "LEFT JOIN collectionItems USING (collectionID) "
			+ "WHERE libraryID=?" + idSQL;
		var params = [libraryID];
		var lastID;
		var rows = [];
		var setRows = function (collectionID, rows) {
			var collection = this._objectCache[collectionID];
			if (!collection) {
				throw new Error("Collection " + collectionID + " not found");
			}
			
			collection._childItems = new Set(rows);
			collection._loaded.childItems = true;
			collection._clearChanged('childItems');
		}.bind(this);
		
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let collectionID = row.getResultByIndex(0);
					
					if (lastID && collectionID !== lastID) {
						setRows(lastID, rows);
						rows = [];
					}
					
					lastID = collectionID;
					
					let itemID = row.getResultByIndex(1);
					// No child items
					if (itemID === null) {
						return;
					}
					rows.push(itemID);
				}
			}
		);
		if (lastID) {
			setRows(lastID, rows);
		}
	});
	
	
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
