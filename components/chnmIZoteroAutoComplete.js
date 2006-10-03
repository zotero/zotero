const ZOTERO_AC_CONTRACTID = '@mozilla.org/autocomplete/search;1?name=zotero';
const ZOTERO_AC_CLASSNAME = 'Zotero AutoComplete';
const ZOTERO_AC_CID = Components.ID('{06a2ed11-d0a4-4ff0-a56f-a44545eee6ea}');
//const ZOTERO_AC_IID = Components.interfaces.chnmIZoteroAutoComplete;

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;


/*
 * Implements nsIAutoCompleteResult
 */
function ZoteroAutoCompleteResult(searchString, searchResult, defaultIndex,
	errorDescription, results, comments){
		this._searchString = searchString;
		this._searchResult = searchResult;
		this._defaultIndex = defaultIndex;
		this._errorDescription = errorDescription;
		this._results = results;
		this._comments = comments;
}


ZoteroAutoCompleteResult.prototype = {
	_searchString: "",
	_searchResult: 0,
	_defaultIndex: 0,
	_errorDescription: "",
	_results: [],
	_comments: [],
	get searchString(){ return this._searchString; },
	get searchResult(){ return this._searchResult; },
	get defaultIndex(){ return this._defaultIndex; },
	get errorDescription(){ return this._errorDescription; },
	get matchCount(){ return this._results.length; }
}


ZoteroAutoCompleteResult.prototype.getCommentAt = function(index){
	return this._comments[index];
}


ZoteroAutoCompleteResult.prototype.getStyleAt = function(index){
	return null;
}


ZoteroAutoCompleteResult.prototype.getValueAt = function(index){
	return this._results[index];
}


ZoteroAutoCompleteResult.prototype.removeValueAt = function(index){
	this._results.splice(index, 1);
	this._comments.splice(index, 1);
}


ZoteroAutoCompleteResult.prototype.QueryInterface = function(iid){
	if (!iid.equals(Ci.nsIAutoCompleteResult) &&
		!iid.equals(Ci.nsISupports)){
			throw Cr.NS_ERROR_NO_INTERFACE;
		}
	return this;
}




/*
 * Implements nsIAutoCompleteSearch
 */
function ZoteroAutoComplete(){
	// Get the Zotero object
	this._zotero = Components.classes["@chnm.gmu.edu/Zotero;1"]
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;
}


ZoteroAutoComplete.prototype.startSearch = function(searchString, searchParam,
		previousResult, listener){
	
	this.stopSearch();
	
	/*
	this._zotero.debug("Starting autocomplete search of type '"
		+ searchParam + "'" + " with string '" + searchString + "'");
	*/
	
	var results = [];
	var comments = [];
	
	// Allow extra parameters to be passed in
	var pos = searchParam.indexOf('/');
	if (pos!=-1){
		var extra = searchParam.substr(pos + 1);
		var searchParam = searchParam.substr(0, pos);
	}
	
	var searchParts = searchParam.split('-');
	searchParam = searchParts[0];
	
	switch (searchParam){
		case '':
			break;
		
		case 'tag':
			var sql = "SELECT tag FROM tags WHERE tag LIKE ?";
			var sqlParams = [searchString + '%'];
			if (extra){
				sql += " AND tagID NOT IN (SELECT tagID FROM itemTags WHERE "
					+ "itemID = ?)";
				sqlParams.push(extra);
			}
			sql += " ORDER BY tag";
			var results = this._zotero.DB.columnQuery(sql, sqlParams);
			break;
		
		case 'creator':
			// Valid fieldMode values:
			// 		0 == search two-field creators
			// 		1 == search single-field creators
			// 		2 == search both
			var [fieldMode, itemID] = extra.split('-');
			
			if (fieldMode==2)
			{
				var sql = "SELECT DISTINCT CASE isInstitution WHEN 1 THEN lastName "
					+ "WHEN 0 THEN firstName || ' ' || lastName END AS name "
					+ "FROM creators WHERE CASE isInstitution "
					+ "WHEN 1 THEN lastName "
					+ "WHEN 0 THEN firstName || ' ' || lastName END "
					+ "LIKE ? ORDER BY name";
				var sqlParams = searchString + '%';
			}
			else
			{
				var sql = "SELECT DISTINCT ";
				if (fieldMode==1){
					sql += "lastName AS name, creatorID || '-1' AS creatorID";
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
						+ "ELSE lastName || ', ' || firstName END AS name, "
						+ "creatorID || '-' || CASE "
						+ "WHEN (firstName = '' OR firstName IS NULL) THEN 1 "
						+ "ELSE 2 END AS creatorID";
				}
				
				var fromSQL = " FROM creators WHERE " + searchParts[2]
					+ " LIKE ?1 " + "AND isInstitution=?2";
				var sqlParams = [searchString + '%', parseInt(fieldMode)];
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
						+ searchParts[2] + " AS name, creatorID || '-1' AS creatorID"
						+ fromSQL + ") GROUP BY name";
				}
				
				sql += " ORDER BY name";
			}
			
			var rows = this._zotero.DB.query(sql, sqlParams);
			for each(var row in rows){
				results.push(row['name']);
				comments.push(row['creatorID'])
			}
			break;
		
		case 'title':
		// DEBUG: These two probably won't be necesary once there's a better
		// date entry method
		case 'dateModified':
		case 'dateAdded':
			var sql = "SELECT DISTINCT " + searchParam + " FROM items "
				+ "WHERE " + searchParam + " LIKE ? ORDER BY " + searchParam;
			var results = this._zotero.DB.columnQuery(sql, searchString + '%');
			break;
		
		default:
			var sql = "SELECT fieldID FROM fields WHERE fieldName=?";
			var fieldID = this._zotero.DB.valueQuery(sql, {string:searchParam});
			
			if (!fieldID){
				this._zotero.debug("'" + searchParam + "' is not a valid autocomplete scope", 1);
				var results = [];
				var resultCode = Ci.nsIAutoCompleteResult.RESULT_IGNORED;
				break;
			}
			
			var sql = "SELECT DISTINCT value FROM itemData WHERE fieldID=?1 AND "
				+ "value LIKE ?2 "
			var sqlParams = [fieldID, searchString + '%'];
			if (extra){
				sql += "AND value NOT IN (SELECT value FROM itemData "
				+ "WHERE fieldID=?1 AND itemID=?3) ";
				sqlParams.push(extra);
			}
			sql += "ORDER BY value";
			var results = this._zotero.DB.columnQuery(sql, sqlParams);
	}
	
	if (!results || !results.length){
		var results = [];
		var resultCode = Ci.nsIAutoCompleteResult.RESULT_NOMATCH;
	}
	else if (typeof resultCode == 'undefined'){
		var resultCode = Ci.nsIAutoCompleteResult.RESULT_SUCCESS;
	}
	
	var result = new ZoteroAutoCompleteResult(searchString,
		resultCode, 0, "", results, comments);
	
	listener.onSearchResult(this, result);
}


ZoteroAutoComplete.prototype.stopSearch = function(){
	//this._zotero.debug('Stopping autocomplete search');
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
