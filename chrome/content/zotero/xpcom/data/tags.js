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
	var _tags = []; // indexed by tag text
	var _tagsByID = []; // indexed by tagID
	
	this.get = get;
	this.getName = getName;
	this.getID = getID;
	this.getIDs = getIDs;
	this.getTypes = getTypes;
	this.getAll = getAll;
	this.getAllWithinSearch = getAllWithinSearch;
	this.getTagItems = getTagItems;
	this.search = search;
	this.add = add;
	this.rename = rename;
	this.remove = remove;
	this.purge = purge;
	this.toArray = toArray;
	
	
	/*
	 * Returns a tag and type for a given tagID
	 */
	function get(tagID) {
		if (_tagsByID[tagID]) {
			return _tagsByID[tagID];
		}
		
		var sql = 'SELECT tag, tagType FROM tags WHERE tagID=?';
		var result = Zotero.DB.rowQuery(sql, tagID);
		
		if (!result) {
			return false;
		}
		
		_tagsByID[tagID] = {
			tag: result.tag,
			type: result.tagType
		};
		return result;
	}
	
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID) {
		if (_tagsByID[tagID]) {
			return _tagsByID[tagID].tag;
		}
		
		var tag = this.get(tagID);
		
		return _tagsByID[tagID] ? _tagsByID[tagID].tag : false;
	}
	
	
	/*
	 * Returns the tagID matching given tag and type
	 */
	function getID(tag, type) {
		if (_tags[type] && _tags[type]['_' + tag]) {
			return _tags[type]['_' + tag];
		}
		
		var sql = 'SELECT tagID FROM tags WHERE tag=? AND tagType=?';
		var tagID = Zotero.DB.valueQuery(sql, [tag, type]);
		
		if (tagID) {
			if (!_tags[type]) {
				_tags[type] = [];
			}
			_tags[type]['_' + tag] = tagID;
		}
		
		return tagID;
	}
	
	
	/*
	 * Returns all tagIDs for this tag (of all types)
	 */
	function getIDs(tag) {
		var sql = 'SELECT tagID FROM tags WHERE tag=?';
		return Zotero.DB.columnQuery(sql, [tag]);
	}
	
	
	/*
	 * Returns an array of tagTypes for tags matching given tag
	 */
	function getTypes(tag) {
		var sql = 'SELECT tagType FROM tags WHERE tag=?';
		return Zotero.DB.columnQuery(sql, [tag]);
	}
	
	
	/**
	 * Get all tags indexed by tagID
	 *
	 * _types_ is an optional array of tagTypes to fetch
	 */
	function getAll(types) {
		var sql = "SELECT tagID, tag, tagType FROM tags ";
		if (types) {
			sql += "WHERE tagType IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.tag, b.tag);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			indexed[tags[i].tagID] = {
				tag: tags[i].tag,
				type: tags[i].tagType
			};
		}
		return indexed;
	}
	
	
	/*
	 * Get all tags within the items of a Zotero.Search object
	 *
	 * _types_ is an optional array of tagTypes to fetch
	 */
	function getAllWithinSearch(search, types) {
		// Save search results to temporary table
		try {
			var tmpTable = search.search(true);
		}
		catch (e) {
			if (e.match(/Saved search [0-9]+ does not exist/)) {
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
		
		var sql = "SELECT DISTINCT tagID, tag, tagType FROM itemTags "
			+ "NATURAL JOIN tags WHERE itemID IN "
			+ "(SELECT itemID FROM " + tmpTable + ") ";
		if (types) {
			sql += "AND tagType IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		
		Zotero.DB.query("DROP TABLE " + tmpTable);
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.tag, b.tag);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			indexed[tags[i].tagID] = {
				tag: tags[i].tag,
				type: tags[i].tagType
			};
		}
		return indexed;
	}
	
	
	function getTagItems(tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQuery(sql, tagID);
	}
	
	
	function search(str) {
		var sql = 'SELECT tagID, tag, tagType FROM tags';
		if (str) {
			sql += ' WHERE tag LIKE ?';
		}
		sql += ' ORDER BY tag COLLATE NOCASE';
		var tags = Zotero.DB.query(sql, str ? '%' + str + '%' : undefined);
		var indexed = {};
		for each(var tag in tags) {
			indexed[tag.tagID] = {
				tag: tag.tag,
				type: tag.tagType
			};
		}
		return indexed;
	}
	
	
	/*
	 * Add a new tag to the database
	 *
	 * Returns new tagID
	 */
	function add(tag, type) {
		if (type != 0 && type != 1) {
			throw ('Invalid tag type ' + type + ' in Tags.add()');
		}
		
		if (!type) {
			type = 0;
		}
		
		Zotero.debug('Adding new tag of type ' + type, 4);
		
		Zotero.DB.beginTransaction();
		
		var sql = 'INSERT INTO tags VALUES (?,?,?)';
		var rnd = Zotero.ID.get('tags');
		Zotero.DB.query(sql, [{int: rnd}, {string: tag}, {int: type}]);
		
		Zotero.DB.commitTransaction();
		Zotero.Notifier.trigger('add', 'tag', rnd);
		return rnd;
	}
	
	
	function rename(tagID, tag) {
		Zotero.debug('Renaming tag', 4);
		
		Zotero.DB.beginTransaction();
		
		var tagObj = this.get(tagID);
		var oldName = tagObj.tag;
		var oldType = tagObj.type;
		var notifierData = {};
		notifierData[this.id] = { old: this.toArray() };
		
		if (oldName == tag) {
			// Convert unchanged automatic tags to manual
			if (oldType != 0) {
				var sql = "UPDATE tags SET tagType=0 WHERE tagID=?";
				Zotero.DB.query(sql, tagID);
				Zotero.Notifier.trigger('modify', 'tag', tagID, notifierData);
			}
			Zotero.DB.commitTransaction();
			return;
		}
		
		// Check if the new tag already exists
		var sql = "SELECT tagID FROM tags WHERE tag=? AND tagType=0";
		var existingTagID = Zotero.DB.valueQuery(sql, tag);
		if (existingTagID) {
			var itemIDs = this.getTagItems(tagID);
			var existingItemIDs = this.getTagItems(existingTagID);
			
			// Would be easier to just call removeTag(tagID) and addTag(existingID)
			// here, but this is considerably more efficient
			var sql = "UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID=?";
			Zotero.DB.query(sql, [existingTagID, tagID]);
			
			// Manual purge of old tag
			var sql = "DELETE FROM tags WHERE tagID=?";
			Zotero.DB.query(sql, tagID);
			if (_tags[oldType]) {
				delete _tags[oldType]['_' + oldName];
			}
			delete _tagsByID[tagID];
			Zotero.Notifier.trigger('delete', 'tag', tagID, notifierData);
			
			// Simulate tag removal on items that used old tag
			var itemTags = [];
			for (var i in itemIDs) {
				itemTags.push(itemIDs[i] + '-' + tagID);
			}
			Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
			
			// And send tag add for new tag (except for those that already had it)
			var itemTags = [];
			for (var i in itemIDs) {
				if (existingItemIDs.indexOf(itemIDs[i]) == -1) {
					itemTags.push(itemIDs[i] + '-' + existingTagID);
				}
			}
			Zotero.Notifier.trigger('add', 'item-tag', itemTags);
			
			Zotero.Notifier.trigger('modify', 'item', itemIDs);
			Zotero.DB.commitTransaction();
			return;
		}
		
		// 0 == user tag -- we set all renamed tags to 0
		var sql = "UPDATE tags SET tag=?, tagType=0 WHERE tagID=?";
		Zotero.DB.query(sql, [{string: tag}, tagID]);
		
		var itemIDs = this.getTagItems(tagID);
		
		if (_tags[oldType]) {
			delete _tags[oldType]['_' + oldName];
		}
		delete _tagsByID[tagID];
		
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('modify', 'item', itemIDs);
		Zotero.Notifier.trigger('modify', 'tag', tagID, notifierData);
	}
	
	
	function remove(tagID) {
		Zotero.DB.beginTransaction();
		
		var sql  = "SELECT itemID FROM itemTags WHERE tagID=?";
		var itemIDs = Zotero.DB.columnQuery(sql, tagID);
		
		if (!itemIDs) {
			Zotero.DB.commitTransaction();
			return;
		}
		
		var sql = "DELETE FROM itemTags WHERE tagID=?";
		Zotero.DB.query(sql, tagID);
		
		Zotero.Notifier.trigger('modify', 'item', itemIDs)
		var itemTags = [];
		for (var i in itemIDs) {
			itemTags.push(itemIDs[i] + '-' + tagID);
		}
		Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
		
		this.purge();
		Zotero.DB.commitTransaction();
		return;
	}
	
	
	/*
	 * Delete obsolete tags from database and clear internal array entries
	 *
	 * Returns removed tagIDs on success
	 */
	function purge() {
		Zotero.DB.beginTransaction();
		
		var sql = 'SELECT tagID, tag, tagType FROM tags WHERE tagID '
			+ 'NOT IN (SELECT tagID FROM itemTags);';
		var toDelete = Zotero.DB.query(sql);
		
		if (!toDelete) {
			Zotero.DB.commitTransaction();
			return false;
		}
		
		var purged = [];
		var notifierData = {};
		
		// Clear tag entries in internal array
		for each(var tag in toDelete) {
			notifierData[tag.tagID] = { old: Zotero.Tags.toArray(tag.tagID) }
			
			purged.push(tag.tagID);
			if (_tags[tag.tagType]) {
				delete _tags[tag.tagType]['_' + tag.tag];
			}
			delete _tagsByID[tag.tagID];
		}
		
		sql = 'DELETE FROM tags WHERE tagID NOT IN '
			+ '(SELECT tagID FROM itemTags);';
		var result = Zotero.DB.query(sql);
		
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('delete', 'tag', purged, notifierData);
		
		return toDelete;
	}
	
	
	function toArray(tagID) {
		var obj = this.get(tagID);
		obj.id = tagID;
		return obj;
	}
}

