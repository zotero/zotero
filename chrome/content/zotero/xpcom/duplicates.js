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

Zotero.Duplicates = function (libraryIDs) {
	if (typeof libraryIDs == 'undefined') {
		throw ("libraryID(s) not provided in Zotero.Duplicates constructor");
	}
	
	if (!libraryIDs) {
		libraryIDs = Zotero.Libraries.userLibraryID;
	}
	
	if (!Array.isArray(libraryIDs)) {
		libraryIDs = [libraryIDs];
	}
	
	if (!libraryIDs.length) {
		throw ("libraryIDs must contain at least one libraryID");
	}
	
	this._libraryIDs = libraryIDs;
}


Zotero.Duplicates.prototype.__defineGetter__('name', function () { return Zotero.getString('pane.collections.duplicate'); });
Zotero.Duplicates.prototype.__defineGetter__('libraryIDs', function () { return this._libraryIDs; });
Zotero.Duplicates.prototype.__defineGetter__('libraryID', function () {
	if (this._libraryIDs.length > 1) {
		throw ("libraryID is not available when Zotero.Duplicates includes multiple libraries");
	}
	return this._libraryIDs[0];
});

Zotero.Duplicates.prototype._getLibraryCondition = function (field = 'libraryID') {
	if (this._libraryIDs.length == 1) {
		return {
			sql: `${field}=?`,
			params: [this._libraryIDs[0]]
		};
	}
	
	return {
		sql: `${field} IN (${this._libraryIDs.map(() => '?').join(', ')})`,
		params: this._libraryIDs.slice()
	};
};

Zotero.Duplicates.normalizeString = function (str) {
	// Make sure we have a string and not an integer
	str = str + "";
	
	if (str === "") {
		return "";
	}
	
	str = Zotero.Utilities.removeDiacritics(str)
		.replace(/[ !-/:-@[-`{-~]+/g, ' ') // Convert (ASCII) punctuation to spaces
		.trim()
		.toLowerCase();
	
	return str;
};

Zotero.Duplicates._sortByValue = function (a, b) {
	if ((a.value === null && b.value !== null)
		|| (a.value === undefined && b.value !== undefined)
		|| a.value < b.value) {
		return -1;
	}
	
	if (a.value === b.value) return 0;
	
	return 1;
};

/**
 * Get duplicates, populate a temporary table, and return a search based
 * on that table
 *
 * @return {Zotero.Search}
 */
Zotero.Duplicates.prototype.getSearchObject = async function () {
	var table = 'tmpDuplicates_' + Zotero.Utilities.randomString();
	
	await this._findDuplicates();
	var ids = this._sets.findAll(true);
	
	// Zotero.CollectionTreeRow::getSearchObject() extracts the table name and creates an
	// unload listener that drops the table when the ItemTreeView is unregistered
	var sql = `CREATE TEMPORARY TABLE ${table} (id INTEGER PRIMARY KEY)`;
	await Zotero.DB.queryAsync(sql);
	
	if (ids.length) {
		Zotero.debug("Inserting rows into temp table");
		sql = `INSERT INTO ${table} VALUES `;
		await Zotero.Utilities.Internal.forEachChunkAsync(
			ids,
			Zotero.DB.MAX_BOUND_PARAMETERS,
			async function (chunk) {
				let idStr = '(' + chunk.join('), (') + ')';
				await Zotero.DB.queryAsync(sql + idStr, false, { debug: false });
			}
		);
		Zotero.debug("Done");
	}
	else {
		Zotero.debug("No duplicates found");
	}
	
	var s = new Zotero.Search;
	if (this._libraryIDs.length == 1) {
		s.libraryID = this.libraryID;
	}
	s.addCondition('tempTable', 'is', table);
	return s;
};


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


/**
 * The comparison function for title-based duplicate matching.
 *
 * Reads metadata directly from the row objects (which are enriched with
 * doi/isbn/year/creators in _loadCaches and findDuplicatesOf), so it has
 * no dependency on instance caches.
 *
 * Assumes rows are sorted by normalized title. Returns:
 *   -1: not a match, stop comparing (title mismatch in sorted order)
 *    0: not a match, but keep looking (title matches but metadata conflicts)
 *    1: match
 *
 * @param {Object} a - Enriched row {itemID, value, doi?, isbn?, year?, creators?}
 * @param {Object} b - Enriched row {itemID, value, doi?, isbn?, year?, creators?}
 * @return {Integer}
 */
Zotero.Duplicates._compareRows = function (a, b) {
	var aTitle = a.value;
	var bTitle = b.value;
	
	// If we stripped one of the strings completely, we can't compare them
	if (!aTitle || !bTitle) {
		return -1;
	}
	
	if (aTitle !== bTitle) {
		return -1; // everything is sorted by title, so if this mismatches, everything following will too
	}
	
	// If both items have a DOI and they don't match, it's not a dupe
	if (a.doi && b.doi && a.doi != b.doi) {
		return 0;
	}
	
	// If both items have an ISBN and they don't match, it's not a dupe
	if (a.isbn && b.isbn && a.isbn != b.isbn) {
		return 0;
	}
	
	// If both items have a year and they're off by more than one, it's not a dupe
	if (a.year && b.year && Math.abs(a.year - b.year) > 1) {
		return 0;
	}
	
	// Match if neither has creators
	if (!a.creators && !b.creators) {
		return 1;
	}
	
	// One has creators and the other doesn't — not a dupe
	if (!a.creators || !b.creators) {
		return 0;
	}
	
	// Check for at least one match on last name + first initial of first name
	for (let i = 0; i < a.creators.length; i++) {
		let aCreator = a.creators[i];
		let aLastName = aCreator.lastName;
		let aFirstInitial = aCreator.firstInitial || "";
		
		for (let j = 0; j < b.creators.length; j++) {
			let bCreator = b.creators[j];
			let bLastName = bCreator.lastName;
			let bFirstInitial = bCreator.firstInitial || "";
			
			if (aLastName === bLastName && aFirstInitial === bFirstInitial) {
				return 1;
			}
		}
	}
	
	return 0;
};


/**
 * Check if a target row has duplicates among the given rows.
 *
 * This is the inner loop of processRows, extracted so it can be reused
 * by findDuplicatesOf. Rows must be sorted by value.
 *
 * @param {Object} targetRow - Row with .itemID and .value
 * @param {Object[]} rows - Sorted rows to compare against
 * @param {Function} [compareRows] - Comparison function returning -1/0/1.
 *                                   If omitted, checks for exact value match.
 * @return {Object[]} - Array of matching rows
 */
Zotero.Duplicates._checkIfDuplicate = function (targetRow, rows, compareRows) {
	let matches = [];
	for (let j = 0; j < rows.length; j++) {
		if (compareRows) {
			let match = compareRows(targetRow, rows[j]);
			// Not a match, and don't try any more
			if (match == -1) {
				break;
			}
			// Not a match, but keep looking
			if (match == 0) {
				continue;
			}
		}
		// If no comparison function, check for exact match
		else {
			if (!targetRow.value || !rows[j].value
				|| (targetRow.value !== rows[j].value)
			) {
				break;
			}
		}
		matches.push(rows[j]);
	}
	return matches;
};


/**
 * Load all data needed for duplicate detection from the database.
 *
 * Populates:
 *   this._isbnRows  - sorted [{itemID, value}] for ISBN exact-match pass
 *   this._doiRows   - sorted [{itemID, value}] for DOI exact-match pass
 *   this._titleRows - sorted enriched rows for title+creators pass:
 *                     [{itemID, value, doi?, isbn?, year?, creators?}]
 *   this._itemCache - {itemID: {doi?, isbn?, year?, creators?}} — consolidated
 *                     metadata used to enrich title rows
 */
Zotero.Duplicates.prototype._loadCaches = async function () {
	var normalizeString = Zotero.Duplicates.normalizeString;
	var sortByValue = Zotero.Duplicates._sortByValue;
	
	let libraryCondition = this._getLibraryCondition();
	
	this._itemCache = {};
	var getCacheEntry = (itemID) => {
		if (!this._itemCache[itemID]) this._itemCache[itemID] = {};
		return this._itemCache[itemID];
	};
	
	// Match books by ISBN
	var sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
				+ "JOIN itemDataValues USING (valueID) "
				+ `WHERE ${libraryCondition.sql} AND itemTypeID=? AND fieldID=? `
				+ "AND itemID NOT IN (SELECT itemID FROM deletedItems)";
	var rows = await Zotero.DB.queryAsync(
		sql,
		[
			...libraryCondition.params,
			Zotero.ItemTypes.getID('book'),
			Zotero.ItemFields.getID('ISBN')
		]
	);
	this._isbnRows = [];
	for (let row of rows) {
		let cleaned = Zotero.Utilities.cleanISBN('' + row.value);
		if (!cleaned) continue;
		getCacheEntry(row.itemID).isbn = cleaned;
		this._isbnRows.push({ itemID: row.itemID, value: cleaned });
	}
	this._isbnRows.sort(sortByValue);
	
	// DOI
	sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
			+ "JOIN itemDataValues USING (valueID) "
			+ `WHERE ${libraryCondition.sql} AND fieldID=? AND value LIKE ? `
			+ "AND itemID NOT IN (SELECT itemID FROM deletedItems)";
	rows = await Zotero.DB.queryAsync(
		sql,
		[
			...libraryCondition.params,
			Zotero.ItemFields.getID('DOI'),
			'10.%'
		]
	);
	this._doiRows = [];
	for (let row of rows) {
		// DOIs are case insensitive
		let doi = (row.value + '').trim().toUpperCase();
		getCacheEntry(row.itemID).doi = doi;
		this._doiRows.push({ itemID: row.itemID, value: doi });
	}
	this._doiRows.sort(sortByValue);
	
	// Get years
	var dateFields = [
		Zotero.ItemFields.getID('date'),
		...Zotero.ItemFields.getTypeFieldsFromBase('date')
	];
	sql = "SELECT itemID, SUBSTR(value, 1, 4) AS year FROM items "
			+ "JOIN itemData USING (itemID) "
			+ "JOIN itemDataValues USING (valueID) "
			+ `WHERE ${libraryCondition.sql} AND fieldID IN (`
			+ dateFields.map(() => '?').join() + ") "
			+ "AND SUBSTR(value, 1, 4) != '0000' "
			+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
			+ "ORDER BY value";
	rows = await Zotero.DB.queryAsync(sql, [...libraryCondition.params, ...dateFields]);
	for (let row of rows) {
		getCacheEntry(row.itemID).year = row.year;
	}
	
	var itemTypeAttachment = Zotero.ItemTypes.getID('attachment');
	var itemTypeNote = Zotero.ItemTypes.getID('note');
	
	// Get all creators and group by itemID
	sql = "SELECT itemID, lastName, firstName, fieldMode FROM items "
		+ "JOIN itemCreators USING (itemID) "
		+ "JOIN creators USING (creatorID) "
		+ `WHERE ${libraryCondition.sql} AND itemTypeID NOT IN (${itemTypeAttachment}, ${itemTypeNote}) AND `
		+ "itemID NOT IN (SELECT itemID FROM deletedItems)"
		+ "ORDER BY itemID, orderIndex";
	let creatorRows = await Zotero.DB.queryAsync(sql, libraryCondition.params);
	for (let row of creatorRows) {
		let entry = getCacheEntry(row.itemID);
		if (!entry.creators) entry.creators = [];
		entry.creators.push({
			lastName: normalizeString(row.lastName),
			firstInitial: row.fieldMode == 0 ? normalizeString(row.firstName).charAt(0) : false
		});
	}
	
	// Match on normalized title
	var titleIDs = Zotero.ItemFields.getTypeFieldsFromBase('title');
	titleIDs.push(Zotero.ItemFields.getID('title'));
	sql = "SELECT itemID, value FROM items JOIN itemData USING (itemID) "
			+ "JOIN itemDataValues USING (valueID) "
			+ `WHERE ${libraryCondition.sql} AND fieldID IN `
			+ "(" + titleIDs.join(', ') + ") "
			+ `AND itemTypeID NOT IN (${itemTypeAttachment}, ${itemTypeNote}) `
			+ "AND itemID NOT IN (SELECT itemID FROM deletedItems)";
	rows = await Zotero.DB.queryAsync(sql, libraryCondition.params);
	// Normalize titles and enrich with metadata from the cache
	this._titleRows = rows.map((row) => {
		let entry = this._itemCache[row.itemID] || {};
		return {
			itemID: row.itemID,
			value: normalizeString(row.value),
			...entry
		};
	});
	// Sort rows by normalized values
	this._titleRows.sort(sortByValue);
};


/**
 * Process sorted rows, finding duplicates and unioning them into sets.
 *
 * @param {Object[]} rows - Sorted rows with .itemID and .value
 * @param {Function} [compareRows] - Comparison function returning -1/0/1.
 *                                   If omitted, checks for exact value match.
 * @param {Boolean} [reprocessMatches] - If true, don't skip ahead past matches.
 *                                       Needed for multi-dimensional comparisons
 *                                       (e.g. title + creators) where items with
 *                                       the same title but different creators
 *                                       must still be compared individually.
 */
Zotero.Duplicates.prototype._processRows = function (rows, compareRows, reprocessMatches) {
	for (let i = 0, len = rows.length; i < len; i++) {
		let matches = Zotero.Duplicates._checkIfDuplicate(
			rows[i], rows.slice(i + 1), compareRows
		);
		for (let m of matches) {
			this._sets.union(
				this._getObjectFromID(rows[i].itemID),
				this._getObjectFromID(m.itemID)
			);
		}
		if (!reprocessMatches && matches.length) {
			i += matches.length;
		}
	}
};


Zotero.Duplicates.prototype._findDuplicates = async function () {
	Zotero.debug("Finding duplicates");
	
	var start = Date.now();
	
	await this._loadCaches();
	
	this._sets = new Zotero.DisjointSetForest;
	
	this._processRows(this._isbnRows);
	this._processRows(this._doiRows);
	this._processRows(this._titleRows, Zotero.Duplicates._compareRows, true);
	
	Zotero.debug("Found duplicates in " + (Date.now() - start) + " ms");
};


/**
 * Build an enriched row (suitable for _compareRows) from a Zotero.Item.
 *
 * @param {Zotero.Item} item - A saved or unsaved Zotero.Item
 * @return {Object} - {itemID, value, doi?, isbn?, year?, creators?}
 */
Zotero.Duplicates._rowFromItem = function (item) {
	var normalizeString = Zotero.Duplicates.normalizeString;
	
	var rawDOI = item.getField('DOI');
	var doi = rawDOI ? (rawDOI + '').trim().toUpperCase() : undefined;
	if (doi && !doi.startsWith('10.')) doi = undefined;
	
	var rawISBN = item.getField('ISBN');
	var isbn = rawISBN ? Zotero.Utilities.cleanISBN('' + rawISBN) : undefined;
	if (!isbn) isbn = undefined;
	
	var year = item.getField('year') || undefined;
	
	var creators = item.getCreators();
	var normalizedCreators = creators.length
		? creators.map(c => ({
			lastName: normalizeString(c.lastName || ''),
			firstInitial: c.fieldMode === 0 ? normalizeString(c.firstName || '').charAt(0) : false
		}))
		: undefined;
	
	return {
		itemID: item.id || null,
		value: normalizeString(item.getField('title', false, true)),
		doi: doi,
		isbn: isbn,
		year: year,
		creators: normalizedCreators
	};
};


/**
 * Find items in the library that are duplicates of the given item.
 *
 * @param {Zotero.Item|Object} itemOrCSLJSON - A Zotero.Item, or a CSL-JSON object
 * @return {Promise<Integer[]>} - Array of matching itemIDs
 */
Zotero.Duplicates.prototype.findDuplicatesOf = async function (itemOrCSLJSON) {
	var item;
	if (itemOrCSLJSON instanceof Zotero.Item) {
		item = itemOrCSLJSON;
	}
	else {
		item = new Zotero.Item();
		Zotero.Utilities.Item.itemFromCSLJSON(item, itemOrCSLJSON);
	}
	
	await this._loadCaches();
	
	var targetRow = Zotero.Duplicates._rowFromItem(item);
	var matches = new Set();
	
	// ISBN exact-match pass
	if (targetRow.isbn) {
		let startIdx = _binarySearch(this._isbnRows, targetRow.isbn);
		let m = Zotero.Duplicates._checkIfDuplicate(
			{ value: targetRow.isbn },
			this._isbnRows.slice(startIdx)
		);
		for (let r of m) matches.add(r.itemID);
	}
	
	// DOI exact-match pass
	if (targetRow.doi) {
		let startIdx = _binarySearch(this._doiRows, targetRow.doi);
		let m = Zotero.Duplicates._checkIfDuplicate(
			{ value: targetRow.doi },
			this._doiRows.slice(startIdx)
		);
		for (let r of m) matches.add(r.itemID);
	}
	
	// Title + creators pass — reuses _compareRows directly with the enriched row
	if (targetRow.value) {
		let startIdx = _binarySearch(this._titleRows, targetRow.value);
		let m = Zotero.Duplicates._checkIfDuplicate(
			targetRow,
			this._titleRows.slice(startIdx),
			Zotero.Duplicates._compareRows
		);
		for (let r of m) matches.add(r.itemID);
	}
	
	// Filter out the target item itself if it was a library item
	if (targetRow.itemID) matches.delete(targetRow.itemID);
	return [...matches];
};


/**
 * Binary search for the first row whose value >= the target value
 * in a sorted rows array.
 *
 * @param {Object[]} rows - Sorted by .value
 * @param {String} value - Target value to find
 * @return {Integer} - Index of first row with value >= target
 */
function _binarySearch(rows, value) {
	let lo = 0, hi = rows.length;
	while (lo < hi) {
		let mid = (lo + hi) >> 1;
		if (rows[mid].value < value) {
			lo = mid + 1;
		}
		else {
			hi = mid;
		}
	}
	return lo;
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
	for (let i in this._objects) {
		let obj = this._objects[i];
		objects.push(asIDs ? obj.id : obj);
	}
	return objects;
}


Zotero.DisjointSetForest.prototype.findAllInSet = function (x, asIDs) {
	var xRoot = this.find(x);
	var objects = [];
	for (let i in this._objects) {
		let obj = this._objects[i];
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
