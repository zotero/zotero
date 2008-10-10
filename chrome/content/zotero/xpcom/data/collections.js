/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


/*
 * Primary interface for accessing Zotero collection
 */
Zotero.Collections = new function() {
	Zotero.DataObjects.apply(this, ['collection']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	this.get = get;
	this.add = add;
	this.getUpdated = getUpdated;
	this.getCollectionsContainingItems = getCollectionsContainingItems;
	this.erase = erase;
	
	/*
	 * Returns a Zotero.Collection object for a collectionID
	 */
	function get(id) {
		if (this._reloadCache) {
			this.reloadAll();
		}
		return this._objectCache[id] ? this._objectCache[id] : false;
	}
	
	
	/**
	* Add new collection to DB and return Collection object
	*
	* _name_ is non-empty string
	* _parent_ is optional collectionID -- creates root collection by default
	*
	* Returns true on success; false on error
	**/
	function add(name, parent) {
		var col = new Zotero.Collection;
		col.name = name;
		col.parent = parent;
		var id = col.save();
		return this.get(id);
	}
	
	
	function getUpdated(date) {
		var sql = "SELECT collectionID FROM collections";
		if (date) {
			sql += " WHERE dateModified>?";
			return Zotero.DB.columnQuery(sql, Zotero.Date.dateToSQL(date, true));
		}
		return Zotero.DB.columnQuery(sql);
	}
	
	
	function getCollectionsContainingItems(itemIDs, asIDs) {
		var sql = "SELECT collectionID FROM collections WHERE ";
		var sqlParams = [];
		for each(var id in itemIDs) {
			sql += "collectionID IN (SELECT collectionID FROM collectionItems "
				+ "WHERE itemID=?) AND "
			sqlParams.push(id);
		}
		sql = sql.substring(0, sql.length - 5);
		var collectionIDs = Zotero.DB.columnQuery(sql, sqlParams);
		
		if (asIDs) {
			return collectionIDs;
		}
		
		return Zotero.Collections.get(collectionIDs);
	}
	
	
	/**
	 * Refresh cached parents in specified collections, skipping
	 * any that aren't loaded
	 *
	 * @param	{Integer|Integer[]}	ids		One or more itemIDs
	 */
	this.refreshParents = function (ids) {
		ids = Zotero.flattenArguments(ids);
		
		for each(var id in ids) {
			if (this._objectCache[id]) {
				this._objectCache[id]._refreshParent();
			}
		}
	}
	
	
	/**
	 * Invalidate child collection cache in specified collections, skipping
	 * any that aren't loaded
	 *
	 * @param	{Integer|Integer[]}	ids		One or more itemIDs
	 */
	this.refreshChildCollections = function (ids) {
		ids = Zotero.flattenArguments(ids);
		
		for each(var id in ids) {
			if (this._objectCache[id]) {
				this._objectCache[id]._refreshChildCollections();
			}
		}
	}
	
	
	function erase(ids) {
		ids = Zotero.flattenArguments(ids);
		
		Zotero.DB.beginTransaction();
		for each(var id in ids) {
			var collection = this.get(id);
			if (collection) {
				collection.erase();
			}
			collection = undefined;
		}
		
		this.unload(ids);
		
		Zotero.DB.commitTransaction();
	}
	
	
	this._load = function () {
		if (!arguments[0] && !this._reloadCache) {
			return;
		}
		
		this._reloadCache = false;
		
		// This should be the same as the query in Zotero.Collection.load(),
		// just without a specific collectionID
		var sql = "SELECT C.*, "
			+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
			+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
			+ "FROM collections C WHERE 1";
		if (arguments[0]) {
			sql += " AND collectionID IN (" + Zotero.join(arguments[0], ",") + ")";
		}
		var rows = Zotero.DB.query(sql);
		var ids = [];
		for each(var row in rows) {
			var id = row.collectionID;
			ids.push(id);
			
			// Creator doesn't exist -- create new object and stuff in array
			if (!this._objectCache[id]) {
				//this.get(id);
				this._objectCache[id] = new Zotero.Collection;
				this._objectCache[id].loadFromRow(row);
			}
			// Existing creator -- reload in place
			else {
				this._objectCache[id].loadFromRow(row);
			}
		}
		
		// If loading all creators, remove old creators that no longer exist
		if (!arguments[0]) {
			for each(var c in this._objectCache) {
				if (ids.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
		}
	}
}

