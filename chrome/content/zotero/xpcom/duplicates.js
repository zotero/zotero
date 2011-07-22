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

Zotero.Duplicates = function (libraryID) {
	if (typeof libraryID == 'undefined') {
		throw ("libraryID not provided in Zotero.Duplicates constructor");
	}
	
	if (!libraryID) {
		libraryID = null;
	}
	
	this._libraryID = libraryID;
}


Zotero.Duplicates.prototype.__defineGetter__('name', function () "Duplicate Items"); // TODO: localize
Zotero.Duplicates.prototype.__defineGetter__('libraryID', function () this._libraryID);


/**
 * Get duplicates, populate a temporary table, and return a search based
 * on that table
 *
 * @return {Zotero.Search}
 */
Zotero.Duplicates.prototype.getSearchObject = function () {
	Zotero.DB.beginTransaction();
	
	var sql = "DROP TABLE IF EXISTS tmpDuplicates";
	Zotero.DB.query(sql);
	
	var sql = "CREATE TEMPORARY TABLE tmpDuplicates "
				+ "(id INTEGER PRIMARY KEY)";
	Zotero.DB.query(sql);
	
	this._findDuplicates();
	var ids = this._sets.findAll(true);
	
	sql = "INSERT INTO tmpDuplicates VALUES (?)";
	var insertStatement = Zotero.DB.getStatement(sql);
	
	for each(var id in ids) {
		insertStatement.bindInt32Parameter(0, id);
		
		try {
			insertStatement.execute();
		}
		catch(e) {
			throw (e + ' [ERROR: ' + Zotero.DB.getLastErrorString() + ']');
		}
	}
	
	Zotero.DB.commitTransaction();
	
	var s = new Zotero.Search;
	s.libraryID = this._libraryID;
	s.addCondition('tempTable', 'is', 'tmpDuplicates');
	return s;
}


/**
 * Finds all items in the same set as a given item
 *
 * @param {Integer} itemID
 * @return {Integer[]}  Array of itemIDs
 */
Zotero.Duplicates.prototype.getSetItemsByItemID = function (itemID) {
	return this._sets.findAllInSet(this._getObjectFromID(itemID), true);
}


Zotero.Duplicates.prototype._getObjectFromID = function (id) {
	return {
		get id() { return id; }
	}
}


Zotero.Duplicates.prototype._findDuplicates = function () {
	var self = this;
	
	this._sets = new Zotero.DisjointSetForest;
	var sets = this._sets;
	
	function normalizeString(str) {
		// Make sure we have a string and not an integer
		str = str + "";
		
		str = Zotero.Utilities.removeDiacritics(str)
			.replace(/[^!-~]/g, ' ') // Convert punctuation to spaces
			.replace(/ +/, ' ') // Normalize spaces
			.toLowerCase();
		
		return str;
	}
	
	/**
	 * @param {Function} compareRows  Comparison function, if not exact match
	 */
	function processRows(compareRows) {
		if (!rows) {
			return;
		}
		
		for (var i = 0, len = rows.length; i < len; i++) {
			var j = i + 1, lastMatch = false, added = false;
			while (j < len) {
				if (compareRows) {
					var match = compareRows(rows[i], rows[j]);
					// Not a match, and don't try any more with this i value
					if (match == -1) {
						break;
					}
					// Not a match, but keep looking
					if (match == 0) {
						j++;
						continue;
					}
				}
				// If no comparison function, check for exact match
				else {
					if (rows[i].value != rows[j].value) {
						break;
					}
				}
				
				sets.union(
					self._getObjectFromID(rows[i].itemID),
					self._getObjectFromID(rows[j].itemID)
				);
				
				lastMatch = j;
				j++;
			}
			if (lastMatch) {
				i = lastMatch;
			}
		}
	}
	
	// Match on normalized title
	var sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
				+ "JOIN itemDataValues USING (valueID) "
				+ "WHERE libraryID=? AND fieldID BETWEEN 110 AND 113 "
				+ "AND itemTypeID NOT IN (1, 14) "
				+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
				+ "ORDER BY value COLLATE locale";
	var rows = Zotero.DB.query(sql, [this._libraryID]);
	processRows(function (a, b) {
		a = normalizeString(a.value);
		b = normalizeString(b.value);
		// If we stripped one of the strings completely, we can't compare them
		if (a.length == 0 || b.length == 0) {
			return -1;
		}
		return a == b ? 1 : -1;
	});
	
	// Match books by ISBN
	var sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
				+ "JOIN itemDataValues USING (valueID) "
				+ "WHERE libraryID=? AND itemTypeID=? AND fieldID=? "
				+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
				+ "ORDER BY value";
	var rows = Zotero.DB.query(
		sql,
		[
			this._libraryID,
			Zotero.ItemTypes.getID('book'),
			Zotero.ItemFields.getID('ISBN')
		]
	);
	processRows();
	
	// Match on exact fields
	var fields = ['DOI'];
	for each(var field in fields) {
		var sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
					+ "JOIN itemDataValues USING (valueID) "
					+ "WHERE libraryID=? AND fieldID=? "
					+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
					+ "ORDER BY value";
		var rows = Zotero.DB.query(sql, [this._libraryID, Zotero.ItemFields.getID(field)]);
		processRows();
	}
}



/**
 * Implements the Disjoint Set data structure
 *
 *  Based on pseudo-code from http://en.wikipedia.org/wiki/Disjoint-set_data_structure
 *
 * Objects passed should have .id properties that uniquely identify them
 */

Zotero.DisjointSetForest = function () {
	this._objects = {};
}

Zotero.DisjointSetForest.prototype.find = function (x) {
	var id = x.id;
	
	// If we've seen this object before, use the existing copy,
	// which will have .parent and .rank properties
	if (this._objects[id]) {
		var obj = this._objects[id];
	}
	// Otherwise initialize it as a new set
	else {
		this._makeSet(x);
		this._objects[id] = x;
		var obj = x;
	}
	
	if (obj.parent.id == obj.id) {
		return obj;
	}
	else {
		obj.parent = this.find(obj.parent);
		return obj.parent;
	}
}


Zotero.DisjointSetForest.prototype.union = function (x, y) {
	var xRoot = this.find(x);
	var yRoot = this.find(y);
	
	// Already in same set
	if (xRoot.id == yRoot.id) {
		return;
	}
	
	if (xRoot.rank < yRoot.rank) {
		xRoot.parent = yRoot;
	}
	else if (xRoot.rank > yRoot.rank) {
		yRoot.parent = xRoot;
	}
	else {
		yRoot.parent = xRoot;
		xRoot.rank = xRoot.rank + 1;
	}
}


Zotero.DisjointSetForest.prototype.sameSet = function (x, y) {
    return this.find(x) == this.find(y);
}


Zotero.DisjointSetForest.prototype.findAll = function (asIDs) {
	var objects = [];
	for each(var obj in this._objects) {
		objects.push(asIDs ? obj.id : obj);
	}
	return objects;
}


Zotero.DisjointSetForest.prototype.findAllInSet = function (x, asIDs) {
	var xRoot = this.find(x);
	var objects = [];
	for each(var obj in this._objects) {
		if (this.find(obj) == xRoot) {
			objects.push(asIDs ? obj.id : obj);
		}
	}
	return objects;
}


Zotero.DisjointSetForest.prototype._makeSet = function (x) {
	x.parent = x;
	x.rank = 0;
}
