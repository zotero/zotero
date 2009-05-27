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
	Zotero.DataObjects.apply(this, ['item']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	// Privileged methods
	this.get = get;
	this.exist = exist;
	this.getAll = getAll;
	this.add = add;
	this.cacheFields = cacheFields;
	this.erase = erase;
	this.getFirstCreatorSQL = getFirstCreatorSQL;
	this.getSortTitle = getSortTitle;
	
	this.__defineGetter__('primaryFields', function () {
		if (!_primaryFields.length) {
			_primaryFields = Zotero.DB.getColumns('items');
			_primaryFields.splice(_primaryFields.indexOf('clientDateModified'), 1);
			_primaryFields = _primaryFields.concat(
				['firstCreator', 'numNotes', 'numAttachments']
			);
		}
		
		// Make a copy of array
		var fields = [];
		for each(var field in _primaryFields) {
			fields.push(field);
		}
		return fields;
	});
	
	this.__defineGetter__('linkedItemPredicate', function () "owl:sameAs");
	
	// Private members
	var _cachedFields = [];
	var _firstCreatorSQL = '';
	var _primaryFields = [];
	
	
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
			if (!this._objectCache[ids[i]]) {
				toLoad.push(ids[i]);
			}
		}
		
		// New items to load
		if (toLoad.length) {
			this._load(toLoad);
		}
		
		// If single id, return the object directly
		if (arguments[0] && typeof arguments[0]!='object'
				&& typeof arguments[1]=='undefined') {
			if (!this._objectCache[arguments[0]]) {
				Zotero.debug("Item " + arguments[0] + " doesn't exist", 2);
				return false;
			}
			return this._objectCache[arguments[0]];
		}
		
		// Otherwise, build return array
		for (i=0; i<ids.length; i++) {
			if (!this._objectCache[ids[i]]) {
				Zotero.debug("Item " + ids[i] + " doesn't exist", 2);
				continue;
			}
			loaded.push(this._objectCache[ids[i]]);
		}
		
		return loaded;
	}
	
	
	function exist(itemIDs) {
		var sql = "SELECT itemID FROM items WHERE itemID IN ("
			+ itemIDs.map(function () '?').join() + ")";
		var exist = Zotero.DB.columnQuery(sql, itemIDs);
		return exist ? exist : [];
	}
	
	
	
	/**
	 * Return items marked as deleted
	 *
	 * @param	{Boolean}	asIDs			Return itemIDs instead of
	 *											Zotero.Item objects
	 * @return	{Zotero.Item[]|Integer[]}
	 */
	this.getDeleted = function (asIDs) {
		var sql = "SELECT itemID FROM deletedItems";
		var ids = Zotero.DB.columnQuery(sql);
		if (asIDs) {
			return ids;
		}
		return this.get(ids);
	}
	
	
	/*
	 * Returns all items in the database
	 *
	 * If |onlyTopLevel|, don't include child items
	 */
	function getAll(onlyTopLevel, libraryID) {
		var sql = 'SELECT A.itemID FROM items A';
		if (onlyTopLevel) {
			sql += ' LEFT JOIN itemNotes B USING (itemID) '
			+ 'LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) '
			+ 'WHERE B.sourceItemID IS NULL AND C.sourceItemID IS NULL';
		}
		else {
			sql += " WHERE 1";
		}
		if (libraryID) {
			sql += " AND libraryID=?";
			var ids = Zotero.DB.columnQuery(sql, libraryID);
		}
		else {
			//sql += " AND libraryID IS NULL";
			var ids = Zotero.DB.columnQuery(sql);
		}
		
		return this.get(ids);
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
		var item = new Zotero.Item(itemTypeOrID);
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
	
	
	this.isPrimaryField = function (field) {
		return this.primaryFields.indexOf(field) != -1;
	}
	
	
	function cacheFields(fields, items) {
		if (items && items.length == 0) {
			return;
		}
		
		Zotero.debug("Caching fields [" + fields.join() + "]"
			+ (items ? " for " + items.length + " items" : ''));
		if (items && items.length > 0) {
			this._load(items);
		}
		else {
			this._load();
		}
		
		var primaryFields = [];
		var fieldIDs = [];
		for each(var field in fields) {
			// Check if field already cached
			if (_cachedFields.indexOf(field) != -1) {
				continue;
			}
			
			_cachedFields.push(field);
			
			if (this.isPrimaryField(field)) {
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
				this._objectCache[row.itemID].loadFromRow(row);
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
			if (this._objectCache[row.itemID]) {
				this._objectCache[row.itemID].setField(row.fieldID, row.value, true);
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
				if (this._objectCache[row.itemID]) {
					this._objectCache[row.itemID].setField(titleFieldID, row.title, true);
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
				if (Zotero.ItemFields.isValidForType(fieldID, this._objectCache[itemID].itemTypeID)) {
					if (!itemFieldsCached[itemID] || !itemFieldsCached[itemID][fieldID]) {
						//Zotero.debug('Setting field ' + fieldID + ' to false for item ' + itemID);
						this._objectCache[itemID].setField(fieldID, false, true);
					}
				}
			}
		}
	}
	
	
	this.trash = function (ids) {
		ids = Zotero.flattenArguments(ids);
		
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			for each(var id in ids) {
				var item = this.get(id);
				if (!item) {
					Zotero.debug('Item ' + id + ' does not exist in Items.trash()!', 1);
					Zotero.Notifier.trigger('delete', 'item', id);
					continue;
				}
				item.deleted = true;
				item.save();
			}
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
	
	
	this.emptyTrash = function () {
		Zotero.DB.beginTransaction();
		var deletedIDs = this.getDeleted(true);
		if (deletedIDs) {
			this.erase(deletedIDs, true);
		}
		Zotero.Notifier.trigger('refresh', 'collection', 0);
		Zotero.DB.commitTransaction();
	}
	
	
	/**
	 * Delete item(s) from database and clear from internal array
	 *
	 * @param	{Integer|Integer[]}	ids					Item ids
	 * @param	{Boolean}			eraseChildren		Erase child items as well
	 */
	function erase(ids, eraseChildren) {
		ids = Zotero.flattenArguments(ids);
		
		var usiDisabled = Zotero.UnresponsiveScriptIndicator.disable();
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
			Zotero.DB.commitTransaction();
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			if (usiDisabled) {
				Zotero.UnresponsiveScriptIndicator.enable();
			}
		}
	}
	
	
	/**
	 * Purge unused data values
	 */
	this.purge = function () {
		if (!Zotero.Prefs.get('purge.items')) {
			return;
		}
		
		var sql = "DELETE FROM itemDataValues WHERE valueID NOT IN "
					+ "(SELECT valueID FROM itemData)";
		Zotero.DB.query(sql);
		
		Zotero.Prefs.set('purge.items', false)
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
	
	
	this._load = function () {
		if (!arguments[0] && !this._reloadCache) {
			return;
		}
		
		// Should be the same as parts in Zotero.Item.loadPrimaryData
		var sql = 'SELECT I.*, '
			+ getFirstCreatorSQL() + ', '
			+ "(SELECT COUNT(*) FROM itemNotes INo WHERE sourceItemID=I.itemID AND "
			+ "INo.itemID NOT IN (SELECT itemID FROM deletedItems)) AS numNotes, "
			+ "(SELECT COUNT(*) FROM itemAttachments IA WHERE sourceItemID=I.itemID AND "
			+ "IA.itemID NOT IN (SELECT itemID FROM deletedItems)) AS numAttachments "
			+ 'FROM items I WHERE 1';
		if (arguments[0]) {
			sql += ' AND I.itemID IN (' + Zotero.join(arguments[0], ',') + ')';
		}
		var itemsRows = Zotero.DB.query(sql);
		var itemIDs = [];
		
		for each(var row in itemsRows) {
			var itemID = row.itemID;
			itemIDs.push(itemID);
			
			// Item doesn't exist -- create new object and stuff in array
			if (!this._objectCache[row.itemID]) {
				var item = new Zotero.Item();
				item.loadFromRow(row, true);
				this._objectCache[row.itemID] = item;
			}
			// Existing item -- reload in place
			else {
				this._objectCache[row.itemID].loadFromRow(row, true);
			}
		}
		
		// If loading all items, remove old items that no longer exist
		if (!arguments[0]) {
			for each(var c in this._objectCache) {
				if (itemIDs.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
			
			_cachedFields = ['itemID', 'itemTypeID', 'dateAdded', 'dateModified',
				'firstCreator', 'numNotes', 'numAttachments', 'numChildren'];
			this._reloadCache = false;
		}
	}
}

