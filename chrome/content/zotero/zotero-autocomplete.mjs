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

const ZOTERO_AC_CLASS_ID = Components.ID('{06a2ed11-d0a4-4ff0-a56f-a44545eee6ea}');
const ZOTERO_AC_CONTRACT_ID = "@mozilla.org/autocomplete/search;1?name=zotero";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

import { Zotero } from "chrome://zotero/content/zotero.mjs";

const MAX_RESULTS = 50;

let searchResultsCache = {};
let currentSearchConfig = null;
let currentQuery = null;
let nextQuery = null;
let lastQueryTs = 0;

/*
 * Implements nsIAutoCompleteSearch
 */
export function ZoteroAutoComplete() {}

// Entrypoint to autocomplete search called on each input change
ZoteroAutoComplete.prototype.startSearch = async function (searchString, searchParams, previousResult, listener) {
	// stopSearch is not always called before startSearch. We could
	// ensure that any ongoing queries are cancelled here. But instead,
	// we let the old query finish, in hope that some query results will
	// match the new search string, since they will be added faster.
	// this.stopSearch();

	var result = Cc["@mozilla.org/autocomplete/simple-result;1"]
					.createInstance(Ci.nsIAutoCompleteSimpleResult);
	result.setSearchString(searchString);

	this._result = result;
	this._includedSearchResults = new Set();
	this._listener = listener;

	let queryID = Zotero.Utilities.randomString();

	Zotero.debug("Start autocomplete query " + queryID + " with data '"
		+ searchParams + "'" + " and string '" + searchString + "'");

	// startSearch is called on each typed character. We don't want to start running
	// a new query unless the old one finished to avoid spamming many queries running
	// at the same time, which poorly affects performance.
	// We maintain a record of the current query and the next query that should run
	// after the first one finished.
	// Suppose we get "t", "te", "tes", and "test" searches, and queries take a somewhat long time.
	// "t" query will be started, "te" and "tes" will be  skipped, and we'll only run "test"
	// after "t" finishes.
	nextQuery = { queryID, searchString, searchParams, cancelled: false };
	if (!currentQuery) {
		this._processQueries();
	}
};

// Fetch search results one query at a time
ZoteroAutoComplete.prototype._processQueries = async function () {
	while (nextQuery) {
		// Move next query to current
		currentQuery = nextQuery;
		nextQuery = null;
		let currentTime = (new Date()).getTime();
		
		let { queryID, searchString, searchParams } = currentQuery;

		// If the search config has not changed since last search, see if any
		// earlier search results match this query
		let searchConfig = JSON.stringify(searchParams);
		let isExpired = currentTime - lastQueryTs > 10 * 1000;
		if (currentSearchConfig === searchConfig && !isExpired) {
			this._applyCachedResults(searchString);
		}
		// If the search config has changed, clear the cache
		else {
			searchResultsCache = {};
			currentSearchConfig = searchConfig;
		}
		lastQueryTs = currentTime;

		await this.executeQuery(queryID, searchString, searchParams);

		currentQuery = null;
	}
};

ZoteroAutoComplete.prototype.executeQuery = async function (queryID, searchString, searchParams) {
	Zotero.debug("Execute autocomplete query with data '"
		+ searchParams + "'" + " and string '" + searchString + "'");
	
	searchParams = JSON.parse(searchParams);
	if (!searchParams) {
		throw new Error("Invalid JSON passed to autocomplete");
	}
	var [fieldName, , subField] = searchParams.fieldName.split("-");
	
	switch (fieldName) {
		case '':
			break;
		
		case 'tag':
			var sql = "SELECT DISTINCT name AS val, NULL AS id FROM tags WHERE name LIKE ? ESCAPE '\\'";
			var sqlParams = ["%" + Zotero.DB.escapeSQLExpression(searchString) + '%'];
			if (searchParams.libraryID) {
				sql += " AND tagID IN (SELECT tagID FROM itemTags JOIN items USING (itemID) "
					+ "WHERE libraryID=?)";
				sqlParams.push(searchParams.libraryID);
			}
			if (searchParams.itemID) {
				sql += " AND name NOT IN (SELECT name FROM tags WHERE tagID IN ("
					+ "SELECT tagID FROM itemTags WHERE itemID = ?))";
				sqlParams.push(searchParams.itemID);
			}
			sql += " ORDER BY val COLLATE locale";
			break;
		
		case 'creator':
		case 'author':
		case 'bookAuthor':
		case 'editor':
			// Valid fieldMode values:
			// 		0 == search two-field creators
			// 		1 == search single-field creators
			// 		2 == search both
			if (searchParams.fieldMode == 2) {
				var sql = "SELECT DISTINCT CASE fieldMode WHEN 1 THEN lastName "
					+ "WHEN 0 THEN firstName || ' ' || lastName END AS val, NULL AS id "
					+ "FROM creators ";
				if (fieldName != 'creator' || searchParams.libraryID) {
					sql += "JOIN itemCreators USING (creatorID) ";
				}
				if (searchParams.libraryID) {
					sql += "JOIN items USING (itemID) ";
				}
				sql += "WHERE CASE fieldMode "
					+ "WHEN 1 THEN lastName LIKE ?1 "
					+ "WHEN 0 THEN (firstName || ' ' || lastName LIKE ?1) OR (lastName LIKE ?1) END ";
				var sqlParams = [searchString + '%'];
				// Limit results to specific creator type
				if (fieldName != 'creator') {
					sql += "AND creatorTypeID=? ";
					sqlParams.push(Zotero.CreatorTypes.getID(fieldName));
				}
				if (searchParams.libraryID) {
					sql += ` AND libraryID=? `;
					sqlParams.push(searchParams.libraryID);
				}
				sql += "ORDER BY val";
			}
			else
			{
				var sql = "SELECT DISTINCT ";
				if (searchParams.fieldMode == 1) {
					sql += "lastName AS val, creatorID || '-1' AS id";
				}
				// Retrieve the matches in the specified field
				// as well as any full names using the name
				//
				// e.g. "Shakespeare" and "Shakespeare, William"
				//
				// creatorID is in the format "12345-1" or "12345-2",
				// 		- 1 means the row uses only the specified field
				// 		- 2 means it uses both
				else {
					sql += "CASE WHEN firstName='' OR firstName IS NULL THEN lastName "
						+ "ELSE lastName || ', ' || firstName END AS val, "
						+ "creatorID || '-' || CASE "
						+ "WHEN (firstName = '' OR firstName IS NULL) THEN 1 "
						+ "ELSE 2 END AS id";
				}
				
				var fromSQL = " FROM creators "
				if (searchParams.libraryID) {
					fromSQL += "JOIN itemCreators USING (creatorID) JOIN items USING (itemID) ";
				}
				fromSQL += "WHERE " + subField + " LIKE ?1 AND fieldMode=?2";
				var sqlParams = [
					searchString + '%',
					searchParams.fieldMode ? searchParams.fieldMode : 0
				];
				if (searchParams.itemID) {
					fromSQL += " AND creatorID NOT IN (SELECT creatorID FROM "
						+ `itemCreators WHERE itemID=?${sqlParams.length + 1}`;
					sqlParams.push(searchParams.itemID);
					if (searchParams.creatorTypeID) {
						fromSQL += ` AND creatorTypeID=?${sqlParams.length + 1}`;
						sqlParams.push(searchParams.creatorTypeID);
					}
					fromSQL += ")";
				}
				if (searchParams.libraryID) {
					fromSQL += ` AND libraryID=?${sqlParams.length + 1}`;
					sqlParams.push(searchParams.libraryID);
				}
				
				sql += fromSQL;
				
				// If double-field mode, include matches for just this field
				// as well (i.e. "Shakespeare"), and group to collapse repeats
				if (searchParams.fieldMode != 1) {
					sql = "SELECT * FROM (" + sql + " UNION SELECT DISTINCT "
						+ subField + " AS val, creatorID || '-1' AS id"
						+ fromSQL + ") GROUP BY val";
				}
				
				sql += " ORDER BY val";
			}
			break;
		
		case 'dateModified':
		case 'dateAdded':
			var sql = "SELECT DISTINCT DATE(" + fieldName + ", 'localtime') AS val, NULL AS id "
				+ "FROM items WHERE " + fieldName + " LIKE ? ";
			var sqlParams = [searchString + '%'];
			if (searchParams.libraryID) {
				sql += "AND libraryID=? ";
				sqlParams.push(searchParams.libraryID);
			}
			sql += "ORDER BY " + fieldName;
			
			break;
			
		case 'accessDate':
			var fieldID = Zotero.ItemFields.getID('accessDate');
			
			var sql = "SELECT DISTINCT DATE(value, 'localtime') AS val, NULL AS id FROM itemData ";
			if (searchParams.libraryID) {
				sql += "JOIN items USING (itemID) ";
			}
			sql += "WHERE fieldID=? AND value LIKE ? ";
			var sqlParams = [fieldID, searchString + '%'];
			if (searchParams.libraryID) {
				sql += "AND libraryID=? ";
				sqlParams.push(searchParams.libraryID);
			}
			sql += "ORDER BY value";
			
			break;
		
		default:
			var fieldID = Zotero.ItemFields.getID(fieldName);
			if (!fieldID) {
				Zotero.debug("'" + fieldName + "' is not a valid autocomplete scope", 1);
				this._notifyResult(false, Ci.nsIAutoCompleteResult.RESULT_IGNORED);
				return;
			}
			
			// We don't use date autocomplete anywhere, but if we're not
			// disallowing it altogether, we should at least do it right and
			// use the user part of the multipart field
			var valueField = fieldName == 'date' ? 'SUBSTR(value, 12, 100)' : 'value';
			
			var sql = "SELECT DISTINCT " + valueField + " AS val, NULL AS id FROM itemData ";
			if (searchParams.libraryID) {
				sql += "JOIN items USING (itemID) ";
			}
			sql += "JOIN itemDataValues USING (valueID) "
				+ "WHERE fieldID=?1 AND " + valueField + " LIKE ?2 ";
			var sqlParams = [fieldID, searchString + '%'];
			// Exclude values from an item
			if (searchParams.itemID) {
				sql += "AND value NOT IN (SELECT value FROM itemData "
					+ "NATURAL JOIN itemDataValues WHERE fieldID=?1 AND itemID=?3) ";
				sqlParams.push(searchParams.itemID);
			}
			// Limit to specific library
			if (searchParams.libraryID) {
				sql += `AND libraryID=?${sqlParams.length + 1} `;
				sqlParams.push(searchParams.libraryID);
			}
			sql += "ORDER BY value";
	}
	
	// Limit search results to 1000, even though we only display 50 results at a time.
	// If the user types "t" first, we'll save 1000 records to searchResultsCache,
	// so that if they type "est" after, we are more likely to find some "test" results
	// in the 1000 matches for "t".
	sql += " LIMIT 1000";
	
	try {
		// Process matching row results
		let onRow = (row, cancel) => {
			if (currentQuery?.cancelled) {
				cancel();
				return;
			}
			var value = row.getResultByIndex(0);
			var id = row.getResultByIndex(1);
			this.updateResult(searchString, value, id);
		};
		await Zotero.DB.queryAsync(sql, sqlParams, { onRow });
		Zotero.debug("Autocomplete query completed");
		this._notifyResult(false);
	}
	catch (e) {
		Zotero.debug(e, 1);
		this._notifyResult(false, Ci.nsIAutoCompleteResult.RESULT_FAILURE);
		Zotero.debug("Autocomplete query aborted");
	}
};


// Add an autocomplete value to the result set and save it in the cache
ZoteroAutoComplete.prototype.updateResult = function (searchString, value, id) {
	// A value can be added either during the initial check for cached results
	// or after the actual SQL query run. Don't add the same value twice.
	if (this._includedSearchResults.has(value)) return false;

	// Record the search result in the cache
	if (searchResultsCache[searchString] === undefined) {
		searchResultsCache[searchString] = [];
	}
	if (!searchResultsCache[searchString].find(r => r.value === value && r.id === id)) {
		searchResultsCache[searchString].push({ value, id });
	}

	// updateResult can be called by the handler of a query for an old searchString
	// (e.g. "t" while typing "test"). In that case, don't display it in the popup.
	let doesMatchCurrentQuery = value.toLowerCase().includes(this._result.searchString.toLowerCase());
	if (!doesMatchCurrentQuery) return false;

	// Don't show too many results
	if (this._result.matchCount > MAX_RESULTS) return false;

	Zotero.debug(`Appending autocomplete value '${value}'` + (id ? " (" + id + ")" : ''));
	// Add to nsIAutoCompleteResult
	this._result.appendMatch(value, id, null, null, null, value);

	// Only update the UI every 10 records
	if (this._result.matchCount % 10 == 0) {
		this._notifyResult(true);
	}
	this._includedSearchResults.add(value);
	return true;
};

// Add to search results cached results from earlier searches that still match
ZoteroAutoComplete.prototype._applyCachedResults = function (searchString) {
	// Fetch cached queries that are a part of the current search string
	// (e.g. "t" and "te" queries if "test" is being searched for)
	let queries = Object.keys(searchResultsCache)
		.filter(q => searchString.toLowerCase().includes(q.toLowerCase()))
		.sort((a, b) => b.length - a.length);
	let addedResults = 0;
	// Find among cached query results those that match the current search string
	// and add them to the result set
	for (let query of queries) {
		let queryResults = searchResultsCache[query];
		for (let { value, id } of queryResults) {
			if (addedResults >= MAX_RESULTS) break;
			let matches = value.toLowerCase().includes(searchString.toLowerCase());
			if (!matches) continue;
			Zotero.debug(`Found cached autocomplete value '${value}' and id ${id} for query '${searchString}'`);
			this.updateResult(searchString, value, id);
			addedResults++;
		}
	}
	Zotero.debug("Found " + addedResults + " cached result for query" + searchString);
	this._notifyResult(true, null);
	return addedResults;
};


ZoteroAutoComplete.prototype._notifyResult = function (ongoing, resultCode) {
	if (!resultCode) {
		if (!this._result.matchCount) {
			resultCode = "RESULT_NOMATCH";
		}
		else {
			resultCode = "RESULT_SUCCESS";
		}
		if (ongoing) {
			resultCode += "_ONGOING";
		}
		resultCode = Ci.nsIAutoCompleteResult[resultCode];
	}
	Zotero.debug("Found " + this._result.matchCount
		+ " result" + (this._result.matchCount != 1 ? "s" : ""));
	
	this._result.setSearchResult(resultCode);
	this._listener.onSearchResult(this, this._result);
}

ZoteroAutoComplete.prototype.createInstance = function (iid) {
	return this.QueryInterface(iid);
};

ZoteroAutoComplete.prototype.stopSearch = function () {
	Zotero.debug('Stopping autocomplete search');
	if (currentQuery) {
		currentQuery.cancelled = true;
	}
	nextQuery = null;
}

// Static
ZoteroAutoComplete.init = function () {
	// If already registered (e.g., after a Zotero.reinit() in tests), skip
	var registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	if (registrar.isCIDRegistered(ZOTERO_AC_CLASS_ID)) {
		return;
	}
	var search = new ZoteroAutoComplete();
	registrar.registerFactory(ZOTERO_AC_CLASS_ID, "", ZOTERO_AC_CONTRACT_ID, search);
};

//
// XPCOM goop
//

ZoteroAutoComplete.prototype.classID = ZOTERO_AC_CLASS_ID;
ZoteroAutoComplete.prototype.QueryInterface = ChromeUtils.generateQI([
	"nsIFactory",
	"nsIAutoCompleteSearch"
]);
