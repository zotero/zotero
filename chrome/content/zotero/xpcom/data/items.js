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
 * Primary interface for accessing Zotero items
 */
Zotero.Items = new function() {
	// Privileged methods
	this.get = get;
	this.exist = exist;
	this.getAll = getAll;
	this.getUpdated = getUpdated;
	this.add = add;
	this.reload = reload;
	this.reloadAll = reloadAll;
	this.cacheFields = cacheFields;
	this.erase = erase;
	this.purge = purge;
	this.unload = unload;
	this.getFirstCreatorSQL = getFirstCreatorSQL;
	this.getSortTitle = getSortTitle;
	
	// Private members
	var _items = [];
	var _itemsLoaded = false;
	var _cachedFields = [];
	var _firstCreatorSQL = '';
	
	
	/*
	 * Retrieves (and loads, if necessary) an arbitrary number of items
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 *
	 * If only one argument and it's an id, return object directly;
	 * otherwise, return array
	 */
	function get() {
		var toLoad = [];
		var loaded = [];
		
		if (!arguments[0]) {
			Zotero.debug('No arguments provided to Items.get()');
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		
		for (var i=0; i<ids.length; i++) {
			// Check if already loaded
			if (!_items[ids[i]]) {
				toLoad.push(ids[i]);
			}
		}
		
		// New items to load
		if (toLoad.length) {
			_load(toLoad);
		}
		
		// If single id, return the object directly
		if (arguments[0] && typeof arguments[0]!='object'
				&& typeof arguments[1]=='undefined') {
			if (!_items[arguments[0]]) {
				Zotero.debug("Item " + arguments[0] + " doesn't exist", 2);
				return false;
			}
			return _items[arguments[0]];
		}
		
		// Otherwise, build return array
		for (i=0; i<ids.length; i++) {
			if (!_items[ids[i]]) {
				Zotero.debug("Item " + ids[i] + " doesn't exist", 2);
				continue;
			}
			loaded.push(_items[ids[i]]);
		}
		
		return loaded;
	}
	
	
	function exist(itemIDs) {
		var sql = "SELECT itemID FROM items WHERE itemID IN ("
			+ itemIDs.map(function () '?').join() + ")";
		var exist = Zotero.DB.columnQuery(sql, itemIDs);
		return exist ? exist : [];
	}
	
	
	/*
	 * Returns all items in the database
	 *
	 * If |onlyTopLevel|, don't include child items
	 */
	function getAll(onlyTopLevel) {
		var sql = 'SELECT A.itemID FROM items A';
		if (onlyTopLevel) {
			sql += ' LEFT JOIN itemNotes B USING (itemID) '
			+ 'LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) '
			+ 'WHERE B.sourceItemID IS NULL AND C.sourceItemID IS NULL';
		}
		
		var ids = Zotero.DB.columnQuery(sql);
		return this.get(ids);
	}
	
	
	function getUpdated(date) {
		var s = new Zotero.Search();
		if (date) {
			s.addCondition('dateModified', 'isAfter', Zotero.Date.dateToSQL(date, true));
		}
		return s.search();
	}
	
	
	/*
	 * Create a new item with optional metadata and pass back the primary reference
	 *
	 * Using "var item = new Zotero.Item()" and "item.save()" directly results
	 * in an orphaned reference to the created item. If other code retrieves the
	 * new item with Zotero.Items.get() and modifies it, the original reference
	 * will not reflect the changes.
	 *
	 * Using this method avoids the need to call Zotero.Items.get() after save()
	 * in order to get the primary item reference. Since it accepts metadata
	 * as a JavaScript object, it also offers a simpler syntax than
	 * item.setField() and item.setCreator().
	 *
	 * Callers with no need for an up-to-date reference after save() (or who
	 * don't mind doing an extra Zotero.Items.get()) can use Zotero.Item
	 * directly if they prefer.
	 *
	 * Sample usage:
	 *
	 * var data = {
	 *     title: "Shakespeare: The Invention of the Human",
	 *     publisher: "Riverhead Hardcover",
	 *     date: '1998-10-26',
	 *     ISBN: 1573221201,
	 *     pages: 745,
	 *     creators: [
	 *         ['Harold', 'Bloom', 'author']
	 *     ]
	 * };
	 * var item = Zotero.Items.add('book', data);
	 */
	function add(itemTypeOrID, data) {
		var item = new Zotero.Item(false, itemTypeOrID);
		for (var field in data) {
			if (field == 'creators') {
				var i = 0;
				for each(var creator in data.creators) {
					// TODO: accept format from toArray()
					
					var fields = {
						firstName: creator[0],
						lastName: creator[1],
						fieldMode: creator[3] ? creator[3] : 0
					};
					
					var creatorDataID = Zotero.Creators.getDataID(fields);
					if (creatorDataID) {
						var linkedCreators = Zotero.Creators.getCreatorsWithData(creatorDataID);
						// TODO: identical creators?
						var creatorID = linkedCreators[0];
					}
					else {
						var creatorObj = new Zotero.Creator;
						creatorObj.setFields(fields);
						var creatorID = creatorObj.save();
					}
					
					item.setCreator(i, Zotero.Creators.get(creatorID), creator[2]);
					i++;
				}
			}
			else {
				item.setField(field, data[field]);
			}
		}
		var id = item.save();
		
		return this.get(id);
	}
	
	
	/*
	 * Reloads data for specified items into internal array
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 */
	function reload() {
		if (!arguments[0]) {
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		Zotero.debug('Reloading ' + ids);
		_load(ids);
		
		return true;
	}
	
	
	function reloadAll() {
		Zotero.debug("Loading all items");
		_items = [];
		_itemsLoaded = false;
		_load();
	}
	
	
	function cacheFields(fields, items) {
		Zotero.debug("Caching fields [" + fields.join() + "]"
			+ (items ? " for " + items + " items" : ''));
		_load(items);
		
		var primaryFields = [];
		var fieldIDs = [];
		for each(var field in fields) {
			// Check if field already cached
			if (_cachedFields.indexOf(field) != -1) {
				continue;
			}
			
			_cachedFields.push(field);
			
			if (Zotero.Item.prototype.isPrimaryField(field)) {
				primaryFields.push(field);
			}
			else {
				fieldIDs.push(Zotero.ItemFields.getID(field));
				if (Zotero.ItemFields.isBaseField(field)) {
					fieldIDs = fieldIDs.concat(Zotero.ItemFields.getTypeFieldsFromBase(field));
				}
			}
		}
		
		if (primaryFields.length) {
			var sql = "SELECT itemID, " + primaryFields.join(', ') + " FROM items";
			if (items) {
				sql += " WHERE itemID IN (" + items.join() + ")";
			}
			var rows = Zotero.DB.query(sql);
			for each(var row in rows) {
				//Zotero.debug('Calling loadFromRow for item ' + row.itemID);
				_items[row.itemID].loadFromRow(row);
			}
		}
		
		// All fields already cached
		if (!fieldIDs.length) {
			return;
		}
		
		var allItemIDs = Zotero.DB.columnQuery("SELECT itemID FROM items");
		var itemFieldsCached = {};
		
		var sql = "SELECT itemID, fieldID, value FROM itemData "
			+ "NATURAL JOIN itemDataValues WHERE ";
		if (items) {
			sql += "itemID IN (" + items.join() + ") AND ";
		}
		sql += "fieldID IN (" + fieldIDs.join() + ")";
		
		var itemDataRows = Zotero.DB.query(sql);
		for each(var row in itemDataRows) {
			//Zotero.debug('Setting field ' + row.fieldID + ' for item ' + row.itemID);
			if (_items[row.itemID]) {
				_items[row.itemID].setField(row.fieldID, row.value, true);
			}
			else {
				if (!missingItems) {
					var missingItems = {};
				}
				if (!missingItems[row.itemID]) {
					missingItems[row.itemID] = true;
					Components.utils.reportError("itemData row references nonexistent item " + row.itemID);
				}
			}
			
			if (!itemFieldsCached[row.itemID]) {
				itemFieldsCached[row.itemID] = {};
			}
			itemFieldsCached[row.itemID][row.fieldID] = true;
		}
		
		// If 'title' is one of the fields, load in note titles
		if (fields.indexOf('title') != -1) {
			var titleFieldID = Zotero.ItemFields.getID('title');
			var sql = "SELECT itemID, title FROM itemNotes WHERE itemID"
				+ " NOT IN (SELECT itemID FROM itemAttachments)";
			if (items) {
				sql += " AND itemID IN (" + items.join() + ")";
			}
			var rows = Zotero.DB.query(sql);
			
			for each(var row in rows) {
				//Zotero.debug('Setting title for note ' + row.itemID);
				if (_items[row.itemID]) {
					_items[row.itemID].setField(titleFieldID, row['title'], true);
				}
				else {
					if (!missingItems) {
						var missingItems = {};
					}
					if (!missingItems[row.itemID]) {
						missingItems[row.itemID] = true;
						Components.utils.reportError("itemData row references nonexistent item " + row.itemID);
					}
				}
			}
		}
		
		// Set nonexistent fields in the cache list to false (instead of null)
		for each(var itemID in allItemIDs) {
			for each(var fieldID in fieldIDs) {
				if (Zotero.ItemFields.isValidForType(fieldID, _items[itemID].itemTypeID)) {
					if (!itemFieldsCached[itemID] || !itemFieldsCached[itemID][fieldID]) {
						//Zotero.debug('Setting field ' + fieldID + ' to false for item ' + itemID);
						_items[itemID].setField(fieldID, false, true);
					}
				}
			}
		}
	}
	
	
	/**
	* Delete item(s) from database and clear from internal array
	*
	* If _eraseChildren_ is true, erase child items as well
	**/
	function erase(ids, eraseChildren) {
		ids = Zotero.flattenArguments(ids);
		
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			for each(var id in ids) {
				var item = this.get(id);
				if (!item) {
					Zotero.debug('Item ' + id + ' does not exist in Items.erase()!', 1);
					Zotero.Notifier.trigger('delete', 'item', id);
					continue;
				}
				item.erase(eraseChildren); // calls unload()
				item = undefined;
			}
			this.purge();
			Zotero.DB.commitTransaction();
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
	}
	
	
	/*
	 * Clear entries from various tables that no longer exist
	 *
	 * This is called automatically by Items.erase() but must be called
	 * manually after Item.erase()
	 */
	function purge() {
		Zotero.Creators.purge();
		Zotero.Tags.purge();
		Zotero.Fulltext.purgeUnusedWords();
		
		// Purge unused values
		var sql = "DELETE FROM itemDataValues WHERE valueID NOT IN "
			+ "(SELECT valueID FROM itemData)";
		Zotero.DB.query(sql);
	}
	
	
	/**
	* Clear item from internal array (used by Zotero.Item.erase())
	**/
	function unload(id) {
		delete _items[id];
	}
	
	
	/*
	 * Generate SQL to retrieve firstCreator field
	 *
	 * Why do we do this entirely in SQL? Because we're crazy. Crazy like foxes.
	 */
	function getFirstCreatorSQL() {
		if (_firstCreatorSQL) {
			return _firstCreatorSQL;
		}
		
		/* This whole block is to get the firstCreator */
		var localizedAnd = Zotero.getString('general.and');
		var sql = "COALESCE(" +
			// First try for primary creator types
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators IC " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END, " +
			
			// Then try editors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators " +
				"NATURAL JOIN creatorTypes WHERE itemID=I.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END, " +
			
			// Then try contributors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators " +
				"NATURAL JOIN creatorTypes WHERE itemID=I.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators NATURAL JOIN creatorData " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END" +
		") AS firstCreator";
		
		_firstCreatorSQL = sql;
		return sql;
	}
	
	
	function getSortTitle(title) {
		if (!title) {
			return '';
		}
		if (typeof title == 'number') {
			return title + '';
		}
		return title.replace(/^[\[\'\"](.*)[\'\"\]]?$/, '$1')
	}
	
	
	function _load() {
		if (!arguments[0] && _itemsLoaded) {
			return;
		}
		
		// Should be the same as parts in Zotero.Item.loadPrimaryData
		var sql = 'SELECT I.*, '
			+ getFirstCreatorSQL() + ', '
			+ "(SELECT COUNT(*) FROM itemNotes WHERE sourceItemID=I.itemID) AS numNotes, "
			+ "(SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID=I.itemID) AS numAttachments "
			+ 'FROM items I WHERE 1';
		
		if (arguments[0]) {
			sql += ' AND I.itemID IN (' + Zotero.join(arguments,',') + ')';
		}
		var itemsRows = Zotero.DB.query(sql);
		var itemIDs = [];
		
		for each(var row in itemsRows) {
			var itemID = row.itemID;
			itemIDs.push(itemID);
			
			// Item doesn't exist -- create new object and stuff in array
			if (!_items[row.itemID]) {
				var item = new Zotero.Item();
				item.loadFromRow(row, true);
				_items[row.itemID] = item;
			}
			// Existing item -- reload in place
			else {
				_items[row.itemID].loadFromRow(row, true);
			}
		}
		
		// If loading all items, remove old items that no longer exist
		if (!arguments[0]) {
			for each(var c in _items) {
				if (itemIDs.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
		}
		
		if (!arguments[0]) {
			_itemsLoaded = true;
			_cachedFields = ['itemID', 'itemTypeID', 'dateAdded', 'dateModified',
				'firstCreator', 'numNotes', 'numAttachments', 'numChildren'];
		}
	}
}

