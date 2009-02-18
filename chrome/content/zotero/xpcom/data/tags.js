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
 * Same structure as Zotero.Creators -- make changes in both places if possible
 */
Zotero.Tags = new function() {
	Zotero.DataObjects.apply(this, ['tag']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	var _tags = {}; // indexed by tag text
	
	this.get = get;
	this.getName = getName;
	this.getID = getID;
	this.getIDs = getIDs;
	this.getTypes = getTypes;
	this.getAll = getAll;
	this.getAllWithinSearch = getAllWithinSearch;
	this.getTagItems = getTagItems;
	this.search = search;
	this.rename = rename;
	this.erase = erase;
	this.purge = purge;
	
	
	/*
	 * Returns a tag and type for a given tagID
	 */
	function get(id, skipCheck) {
		if (this._reloadCache) {
			this.reloadAll();
		}
		return this._objectCache[id] ? this._objectCache[id] : false;
	}
	
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID) {
		if (this._objectCache[tagID]) {
			return this._objectCache[tagID].name;
		}
		
		// Populate cache
		var tag = this.get(tagID);
		
		return this._objectCache[tagID] ? this._objectCache[tagID].name : false;
	}
	
	
	/*
	 * Returns the tagID matching given tag and type
	 */
	function getID(name, type) {
		name = Zotero.Utilities.prototype.trim(name).toLowerCase();
		
		if (_tags[type] && _tags[type]['_' + name]) {
			return _tags[type]['_' + name];
		}
		
		var sql = 'SELECT tagID FROM tags WHERE name=? AND type=?';
		var tagID = Zotero.DB.valueQuery(sql, [name, type]);
		
		if (tagID) {
			if (!_tags[type]) {
				_tags[type] = [];
			}
			_tags[type]['_' + name] = tagID;
		}
		
		return tagID;
	}
	
	
	/*
	 * Returns all tagIDs for this tag (of all types)
	 */
	function getIDs(name) {
		name = Zotero.Utilities.prototype.trim(name);
		var sql = 'SELECT tagID FROM tags WHERE name=?';
		return Zotero.DB.columnQuery(sql, [name]);
	}
	
	
	/*
	 * Returns an array of tag types for tags matching given tag
	 */
	function getTypes(name) {
		name = Zotero.Utilities.prototype.trim(name);
		var sql = 'SELECT type FROM tags WHERE name=?';
		return Zotero.DB.columnQuery(sql, [name]);
	}
	
	
	/**
	 * Get all tags indexed by tagID
	 *
	 * _types_ is an optional array of tag types to fetch
	 */
	function getAll(types) {
		var sql = "SELECT tagID, name FROM tags ";
		if (types) {
			sql += "WHERE type IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tag = this.get(tags[i].tagID, true);
			indexed[tags[i].tagID] = tag;
		}
		return indexed;
	}
	
	
	/*
	 * Get all tags within the items of a Zotero.Search object
	 *
	 * _types_ is an optional array of tag types to fetch
	 */
	function getAllWithinSearch(search, types) {
		// Save search results to temporary table
		try {
			var tmpTable = search.search(true);
		}
		catch (e) {
			if (typeof e == 'string'
					&& e.match(/Saved search [0-9]+ does not exist/)) {
				Zotero.DB.rollbackTransaction();
				Zotero.debug(e, 2);
			}
			else {
				throw (e);
			}
		}
		if (!tmpTable) {
			return {};
		}
		
		var sql = "SELECT DISTINCT tagID, name, type FROM itemTags "
			+ "NATURAL JOIN tags WHERE itemID IN "
			+ "(SELECT itemID FROM " + tmpTable + ") ";
		if (types) {
			sql += "AND type IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		
		Zotero.DB.query("DROP TABLE " + tmpTable);
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tag = this.get(tags[i].tagID, true);
			indexed[tags[i].tagID] = tag;
		}
		return indexed;
	}
	
	
	/**
	 * Get the items associated with the given saved tag
	 *
	 * @param	{Integer}	tagID
	 * @return	{Integer[]|FALSE}
	 */
	function getTagItems(tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQuery(sql, tagID);
	}
	
	
	function search(str) {
		var sql = 'SELECT tagID, name, type FROM tags';
		if (str) {
			sql += ' WHERE name LIKE ?';
		}
		var tags = Zotero.DB.query(sql, str ? '%' + str + '%' : undefined);
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			var tag = this.get(tags[i].tagID, true);
			indexed[tags[i].tagID] = tag;
		}
		return indexed;
	}
	
	
	function rename(tagID, name) {
		Zotero.debug('Renaming tag', 4);
		
		name = Zotero.Utilities.prototype.trim(name);
		
		Zotero.DB.beginTransaction();
		
		var tagObj = this.get(tagID);
		var oldName = tagObj.name;
		var oldType = tagObj.type;
		var notifierData = {};
		notifierData[tagID] = { old: tagObj.serialize() };
		
		if (oldName == name) {
			Zotero.DB.commitTransaction();
			return;
		}
		
		var sql = "SELECT tagID FROM tags WHERE name=? AND type=0";
		var existingTagID = Zotero.DB.valueQuery(sql, name);
		// New tag already exists as manual tag
		if (existingTagID
				// Tag check is case-insensitive, so make sure we have a
				// different tag
				&& existingTagID != tagID) {
			// Change case of existing manual tag before switching automatic
			if (oldName.toLowerCase() == name.toLowerCase()) {
				var sql = "UPDATE tags SET name=? WHERE tagID=?";
				Zotero.DB.query(sql, [name, existingTagID]);
			}
			
			var itemIDs = this.getTagItems(tagID);
			var existingItemIDs = this.getTagItems(existingTagID);
			
			// Would be easier to just call removeTag(tagID) and addTag(existingID)
			// here, but this is considerably more efficient
			var sql = "UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID=?";
			Zotero.DB.query(sql, [existingTagID, tagID]);
			
			// Manual purge of old tag
			sql = "DELETE FROM tags WHERE tagID=?";
			Zotero.DB.query(sql, tagID);
			if (_tags[oldType]) {
				delete _tags[oldType]['_' + oldName];
			}
			delete this._objectCache[tagID];
			Zotero.Notifier.trigger('delete', 'tag', tagID, notifierData);
			
			// Simulate tag removal on items that used old tag
			var itemTags = [];
			for (var i in itemIDs) {
				itemTags.push(itemIDs[i] + '-' + tagID);
			}
			Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
			
			// And send tag add for new tag (except for those that already had it)
			var changed = false;
			var itemTags = [];
			for (var i in itemIDs) {
				if (!existingItemIDs || existingItemIDs.indexOf(itemIDs[i]) == -1) {
					itemTags.push(itemIDs[i] + '-' + existingTagID);
					changed = true;
				}
			}
			
			if (changed) {
				Zotero.Notifier.trigger('add', 'item-tag', itemTags);
				
				// If any items were added to the existing tag, mark it as updated
				sql = "UPDATE tags SET dateModified=CURRENT_TIMESTAMP WHERE tagID=?";
				Zotero.DB.query(sql, existingTagID);
				Zotero.Notifier.trigger('modify', 'tag', tagID);
			}
			
			// TODO: notify linked items?
			//Zotero.Notifier.trigger('modify', 'item', itemIDs);
			
			Zotero.DB.commitTransaction();
			return;
		}
		
		tagObj.name = name;
		// Set all renamed tags to manual
		tagObj.type = 0;
		tagObj.save();
		
		Zotero.DB.commitTransaction();
	}
	
	
	function erase(ids) {
		ids = Zotero.flattenArguments(ids);
		
		Zotero.DB.beginTransaction();
		for each(var id in ids) {
			var tag = this.get(id);
			if (tag) {
				tag.erase();
			}
		}
		Zotero.DB.commitTransaction();
	}
	
	
	/*
	 * Delete obsolete tags from database and clear internal array entries
	 *
	 * Returns removed tagIDs on success
	 */
	function purge() {
		if (!Zotero.Prefs.get('purge.tags')) {
			return;
		}
		
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			
			var sql = "CREATE TEMPORARY TABLE tagDelete AS "
				+ "SELECT tagID FROM tags WHERE tagID "
				+ "NOT IN (SELECT tagID FROM itemTags)";
			Zotero.DB.query(sql);
			
			sql = "CREATE INDEX tagDelete_tagID ON tagDelete(tagID)";
			Zotero.DB.query(sql);
			
			sql = "SELECT * FROM tagDelete";
			var toDelete = Zotero.DB.columnQuery(sql);
			
			if (!toDelete) {
				sql = "DROP TABLE tagDelete";
				Zotero.DB.query(sql);
				Zotero.DB.commitTransaction();
				Zotero.Prefs.set('purge.tags', false);
				return;
			}
			
			var notifierData = {};
			
			for each(var tagID in toDelete) {
				var tag = Zotero.Tags.get(tagID);
				if (tag) {
					notifierData[tagID] = { old: tag.serialize() }
				}
			}
			
			this.unload(toDelete);
			
			sql = "DELETE FROM tags WHERE tagID IN "
				+ "(SELECT tagID FROM tagDelete);";
			Zotero.DB.query(sql);
			
			sql = "DROP TABLE tagDelete";
			Zotero.DB.query(sql);
			
			Zotero.DB.commitTransaction();
			
			Zotero.Notifier.trigger('delete', 'tag', toDelete, notifierData);
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		Zotero.Prefs.set('purge.tags', false);
	}
	
	
	/**
	 * Internal reload hook to clear cache
	 */
	this._reload = function (ids) {
		_tags = {};
	}
	
	
	/**
	 * Unload tags from caches
	 *
	 * @param	int|array	ids	 	One or more tagIDs
	 */
	this.unload = function () {
		var ids = Zotero.flattenArguments(arguments);
		
		for each(var id in ids) {
			var tag = this._objectCache[id];
			delete this._objectCache[id];
			if (tag && _tags[tag.type]) {
				delete _tags[tag.type]['_' + tag.name];
			}
		}
	}
	
	
	this._load = function () {
		if (!arguments[0]) {
			if (!this._reloadCache) {
				return;
			}
			_tags = {};
			this._reloadCache = false;
		}
		
		// This should be the same as the query in Zotero.Tag.load(),
		// just without a specific tagID
		var sql = "SELECT * FROM tags WHERE 1";
		if (arguments[0]) {
			sql += " AND tagID IN (" + Zotero.join(arguments[0], ",") + ")";
		}
		var rows = Zotero.DB.query(sql);
		
		var ids = [];
		for each(var row in rows) {
			var id = row.tagID;
			ids.push(id);
			
			// Tag doesn't exist -- create new object and stuff in array
			if (!this._objectCache[id]) {
				//this.get(id);
				this._objectCache[id] = new Zotero.Tag;
				this._objectCache[id].loadFromRow(row);
			}
			// Existing tag -- reload in place
			else {
				this._objectCache[id].loadFromRow(row);
			}
		}
		
		if (!arguments[0]) {
			// If loading all tags, remove old tags that no longer exist
			for each(var c in this._objectCache) {
				if (ids.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
		}
	}
}

