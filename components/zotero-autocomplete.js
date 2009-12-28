/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const ZOTERO_AC_CONTRACTID = '@mozilla.org/autocomplete/search;1?name=zotero';
const ZOTERO_AC_CLASSNAME = 'Zotero AutoComplete';
const ZOTERO_AC_CID = Components.ID('{06a2ed11-d0a4-4ff0-a56f-a44545eee6ea}');

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;


/*
 * Implements nsIAutoCompleteSearch
 */
function ZoteroAutoComplete() {
	// Get the Zotero object
	this._zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
}


ZoteroAutoComplete.prototype.startSearch = function(searchString, searchParam, previousResult, listener) {
	var result = Cc["@mozilla.org/autocomplete/simple-result;1"]
					.createInstance(Ci.nsIAutoCompleteSimpleResult);
	result.setSearchString(searchString);
	
	this._result = result;
	this._results = [];
	this._listener = listener;
	this._cancelled = false;
	
	this._zotero.debug("Starting autocomplete search of type '"
		+ searchParam + "'" + " with string '" + searchString + "'");
	
	this.stopSearch();
	
	var self = this;
	var statement;
	
	// Allow extra parameters to be passed in
	var pos = searchParam.indexOf('/');
	if (pos!=-1){
		var extra = searchParam.substr(pos + 1);
		var searchParam = searchParam.substr(0, pos);
	}
	
	var searchParts = searchParam.split('-');
	searchParam = searchParts[0];
	
	switch (searchParam) {
		case '':
			break;
		
		case 'tag':
			var sql = "SELECT DISTINCT name AS val, NULL AS comment FROM tags WHERE name LIKE ?";
			var sqlParams = [searchString + '%'];
			if (extra){
				sql += " AND name NOT IN (SELECT name FROM tags WHERE tagID IN ("
					+ "SELECT tagID FROM itemTags WHERE itemID = ?))";
				sqlParams.push(extra);
			}
			
			statement = this._zotero.DB.getStatement(sql, sqlParams);
			
			var resultsCallback = function (results) {
				var collation = self._zotero.getLocaleCollation();
				results.sort(function(a, b) {
					return collation.compareString(1, a, b);
				});
			}
			break;
		
		case 'creator':
			// Valid fieldMode values:
			// 		0 == search two-field creators
			// 		1 == search single-field creators
			// 		2 == search both
			var [fieldMode, itemID] = extra.split('-');
			
			if (fieldMode==2)
			{
				var sql = "SELECT DISTINCT CASE fieldMode WHEN 1 THEN lastName "
					+ "WHEN 0 THEN firstName || ' ' || lastName END AS val, NULL AS comment "
					+ "FROM creators NATURAL JOIN creatorData WHERE CASE fieldMode "
					+ "WHEN 1 THEN lastName "
					+ "WHEN 0 THEN firstName || ' ' || lastName END "
					+ "LIKE ? ORDER BY val";
				var sqlParams = searchString + '%';
			}
			else
			{
				var sql = "SELECT DISTINCT ";
				if (fieldMode==1){
					sql += "lastName AS val, creatorID || '-1' AS comment";
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
						+ "ELSE 2 END AS comment";
				}
				
				var fromSQL = " FROM creators NATURAL JOIN creatorData "
					+ "WHERE " + searchParts[2] + " LIKE ?1 " + "AND fieldMode=?2";
				var sqlParams = [searchString + '%',
					fieldMode ? parseInt(fieldMode) : 0];
				if (itemID){
					fromSQL += " AND creatorID NOT IN (SELECT creatorID FROM "
						+ "itemCreators WHERE itemID=?3)";
					sqlParams.push(itemID);
				}
				
				sql += fromSQL;
				
				// If double-field mode, include matches for just this field
				// as well (i.e. "Shakespeare"), and group to collapse repeats
				if (fieldMode!=1){
					sql = "SELECT * FROM (" + sql + " UNION SELECT DISTINCT "
						+ searchParts[2] + " AS val, creatorID || '-1' AS comment"
						+ fromSQL + ") GROUP BY val";
				}
				
				sql += " ORDER BY val";
			}
			
			statement = this._zotero.DB.getStatement(sql, sqlParams);
			break;
		
		case 'dateModified':
		case 'dateAdded':
			var sql = "SELECT DISTINCT DATE(" + searchParam + ", 'localtime') AS val, NULL AS comment FROM items "
				+ "WHERE " + searchParam + " LIKE ? ORDER BY " + searchParam;
			statement = this._zotero.DB.getStatement(sql, searchString + '%');
			break;
			
		case 'accessDate':
			var fieldID = this._zotero.ItemFields.getID('accessDate');
			
			var sql = "SELECT DISTINCT DATE(value, 'localtime') AS val, NULL AS comment FROM itemData "
				+ "WHERE fieldID=? AND value LIKE ? ORDER BY value";
			statement = this._zotero.DB.getStatement(sql, [fieldID, searchString + '%']);
			break;
		
		default:
			var fieldID = this._zotero.ItemFields.getID(searchParam);
			if (!fieldID) {
				this._zotero.debug("'" + searchParam + "' is not a valid autocomplete scope", 1);
				this.updateResults([], false, Ci.nsIAutoCompleteResult.RESULT_IGNORED);
				return;
			}
			
			// We don't use date autocomplete anywhere, but if we're not
			// disallowing it altogether, we should at least do it right and
			// use the user part of the multipart field
			var valueField = searchParam=='date' ? 'SUBSTR(value, 12, 100)' : 'value';
			
			var sql = "SELECT DISTINCT " + valueField + " AS val, NULL AS comment "
				+ "FROM itemData NATURAL JOIN itemDataValues "
				+ "WHERE fieldID=?1 AND " + valueField
				+ " LIKE ?2 "
			
			var sqlParams = [fieldID, searchString + '%'];
			if (extra){
				sql += "AND value NOT IN (SELECT value FROM itemData "
					+ "NATURAL JOIN itemDataValues WHERE fieldID=?1 AND itemID=?3) ";
				sqlParams.push(extra);
			}
			sql += "ORDER BY value";
			statement = this._zotero.DB.getStatement(sql, sqlParams);
	}
	
	// Disable asynchronous until we figure out the hangs
	if (true || this._zotero.isFx30) {
		var rows = this._zotero.DB.query(sql, sqlParams);
		var results = [];
		var comments = [];
		for each(var row in rows) {
			results.push(row.val);
			let comment = row.comment;
			if (comment) {
				comments.push(comment);
			}
		}
		this.updateResults(results, comments);
		return;
	}
	
	var self = this;
	
	this._zotero.DB._connection.setProgressHandler(5000, {
		onProgress: function (connection) {
			if (self._cancelled) {
				return true;
			}
		}
	});
	
	this.pendingStatement = statement.executeAsync({
		handleResult: function (storageResultSet) {
			self._zotero.debug("Handling autocomplete results");
			
			var results = [];
			var comments = [];
			
			for (let row = storageResultSet.getNextRow();
					row;
					row = storageResultSet.getNextRow()) {
				results.push(row.getResultByIndex(0));
				let comment = row.getResultByIndex(1);
				if (comment) {
					comments.push(comment);
				}
			}
			
			if (resultsCallback) {
				if (comments.length) {
					throw ("Cannot sort results with comments in ZoteroAutoComplete.startSearch()");
				}
				resultsCallback(results);
			}
			
			self.updateResults(results, comments, true);
		},
		
		handleError: function (e) {
			//Components.utils.reportError(e.message);
		},
		
		handleCompletion: function (reason) {
			self.pendingStatement = null;
			
			if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
				var resultCode = Ci.nsIAutoCompleteResult.RESULT_FAILURE;
			}
			else {
				var resultCode = null;
			}
			
			self.updateResults(null, null, false, resultCode);
			
			if (resultCode) {
				self._zotero.debug("Autocomplete query aborted");
			}
			else {
				self._zotero.debug("Autocomplete query completed");
			}
		}
	});
}


ZoteroAutoComplete.prototype.updateResults = function (results, comments, ongoing, resultCode) {
	if (!results) {
		results = [];
	}
	if (!comments) {
		comments = [];
	}
	
	for (var i=0; i<results.length; i++) {
		let result = results[i];
		
		if (this._results.indexOf(result) == -1) {
			comment = comments[i] ? comments[i] : null;
			this._zotero.debug("Appending autocomplete value '" + result + "'" + (comment ? " (" + comment + ")" : ""));
			this._result.appendMatch(result, comment, null, null);
			this._results.push(result);
		}
		else {
			//this._zotero.debug("Skipping existing value '" + result + "'");
		}
	}
	
	if (!resultCode) {
		resultCode = "RESULT_";
		if (!this._results.length) {
			resultCode += "NOMATCH";
		}
		else {
			resultCode += "SUCCESS";
		}
		if (ongoing) {
			resultCode += "_ONGOING";
		}
		resultCode = Ci.nsIAutoCompleteResult[resultCode];
	}
	
	this._result.setSearchResult(resultCode);
	this._listener.onSearchResult(this, this._result);
}


ZoteroAutoComplete.prototype.stopSearch = function(){
	if (this.pendingStatement) {
		this._zotero.debug('Stopping autocomplete search');
		// This appears to take as long as letting the query complete,
		// so we flag instead and abort from the progress handler
		//this.pendingStatement.cancel();
		this._cancelled = true;
	}
}


ZoteroAutoComplete.prototype.QueryInterface = function(iid){
    if (!iid.equals(Ci.nsIAutoCompleteSearch) &&
        !iid.equals(Ci.nsIAutoCompleteObserver) &&
        !iid.equals(Ci.nsISupports)){
		  throw Cr.NS_ERROR_NO_INTERFACE;
	}
    return this;
}



//
// XPCOM goop
//
var ZoteroAutoCompleteFactory = {
	createInstance: function(outer, iid){
		if (outer != null){
			throw Components.results.NS_ERROR_NO_AGGREGATION;
		}
		return new ZoteroAutoComplete().QueryInterface(iid);
	}
};


var ZoteroAutoCompleteModule = {
	_firstTime: true,
	
	registerSelf: function(compMgr, fileSpec, location, type){
		if (!this._firstTime){
			throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
		}
		this._firstTime = false;
		
		compMgr =
			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		
		compMgr.registerFactoryLocation(ZOTERO_AC_CID,
										ZOTERO_AC_CLASSNAME,
										ZOTERO_AC_CONTRACTID,
										fileSpec,
										location,
										type);
	},
	
	unregisterSelf: function(compMgr, location, type){
		compMgr =
			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(ZOTERO_AC_CID, location);
	},
	
	getClassObject: function(compMgr, cid, iid){
		if (!cid.equals(ZOTERO_AC_CID)){
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		if (!iid.equals(Components.interfaces.nsIFactory)){
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		}
		return ZoteroAutoCompleteFactory;
	},
	
	canUnload: function(compMgr){ return true; }
};

function NSGetModule(comMgr, fileSpec){ return ZoteroAutoCompleteModule; }
