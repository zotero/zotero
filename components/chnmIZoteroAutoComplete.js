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
			var resultCode = Ci.nsIAutoCompleteResult.RESULT_SUCCESS;
			break;
		
		case 'creator':
			var [singleField, itemID] = extra.split('-');
			
			var sql = "SELECT "
				// Full name not currently returned
				//+ "lastName" + (!singleField ? '' : "|| ', ' || firstName")
				+ searchParts[2]
				+ " AS name, creatorID "
				+ "FROM creators WHERE " + searchParts[2] + " LIKE ? "
				+ "AND isInstitution=?";
			var sqlParams = [searchString + '%', parseInt(singleField)];
			if (itemID){
				sql += " AND creatorID NOT IN (SELECT creatorID FROM "
					+ "itemCreators WHERE itemID = ?)";
				sqlParams.push(itemID);
			}
			sql += " ORDER BY " + searchParts[2];
			var rows = this._zotero.DB.query(sql, sqlParams);
			for each(var row in rows){
				results.push(row['name']);
				// No currently used
				//comments.push(row['creatorID'])
			}
			var resultCode = Ci.nsIAutoCompleteResult.RESULT_SUCCESS;
			break;
		
		default:
			this._zotero.debug("'" + searchParam + "' is not a valid autocomplete scope", 1);
			var results = [];
			var resultCode = Ci.nsIAutoCompleteResult.RESULT_IGNORED;
	}
	
	if (!results || !results.length){
		var results = [];
		var resultCode = Ci.nsIAutoCompleteResult.RESULT_NOMATCH;
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
