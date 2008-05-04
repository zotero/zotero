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
	var _collections = {};
	var _collectionsLoaded = false;
	
	this.get = get;
	this.add = add;
	this.getUpdated = getUpdated;
	this.getCollectionsContainingItems = getCollectionsContainingItems;
	this.reload = reload;
	this.reloadAll = reloadAll;
	this.erase = erase;
	this.unload = unload;
	
	/*
	 * Returns a Zotero.Collection object for a collectionID
	 */
	function get(id) {
		if (!_collectionsLoaded) {
			this.reloadAll();
		}
		return (typeof _collections[id]!='undefined') ? _collections[id] : false;
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
	
	
	function reload(id) {
		if (!_collectionsLoaded) {
			this.reloadAll();
			return;
		}
		
		if (!_collections[id]) {
			_collections[id] = new Zotero.Collection(id);
		}
		_collections[id].load();
	}
	
	
	/**
	* Loads collection data from DB and adds to internal cache
	**/
	function reloadAll() {
		Zotero.debug('Loading all collections');
		
		// This should be the same as the query in Zotero.Collection.load(),
		// just without a specific collectionID
		var sql = "SELECT C.*, "
			+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
			+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
			+ "FROM collections C";
		var result = Zotero.DB.query(sql);
		
		var collectionIDs = [];
		
		if (result) {
			for (var i=0; i<result.length; i++) {
				var collectionID = result[i].collectionID;
				collectionIDs.push(collectionID);
				
				// If collection doesn't exist, create new object and stuff in array
				if (!_collections[collectionID]) {
					_collections[collectionID] = new Zotero.Collection;
				}
				_collections[collectionID].loadFromRow(result[i]);
			}
		}
		
		// Remove old collections that no longer exist
		for each(var c in _collections) {
			if (collectionIDs.indexOf(c.id) == -1) {
				this.unload(c.id);
			}
		}
		
		_collectionsLoaded = true;
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
	
	
	/**
	* Clear collection from internal cache (used by Zotero.Collection.erase())
	*
	* Can be passed ids as individual parameters or as an array of ids, or both
	**/
	function unload() {
		var ids = Zotero.flattenArguments(arguments);
		
		for(var i=0; i<ids.length; i++) {
			delete _collections[ids[i]];
		}
	}

}

