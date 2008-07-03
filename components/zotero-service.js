const ZOTERO_CONTRACTID = '@zotero.org/Zotero;1';
const ZOTERO_CLASSNAME = 'Zotero';
const ZOTERO_CID = Components.ID('{e4c61080-ec2d-11da-8ad9-0800200c9a66}');
const ZOTERO_IID = Components.interfaces.chnmIZoteroService; //unused

const Cc = Components.classes;
const Ci = Components.interfaces;

// Assign the global scope to a variable to passed via wrappedJSObject
var ZoteroWrapped = this;


/********************************************************************
* Include the core objects to be stored within XPCOM
*********************************************************************/

var xpcomFiles = ['zotero',
	'annotate', 'attachments', 'cite', 'cite_compat', 'collectionTreeView',
	'dataServer', 'data_access', 'data/item', 'data/items', 'data/collection',
	'data/collections', 'data/cachedTypes', 'data/creator', 'data/creators',
	'data/itemFields', 'data/notes', 'data/tag', 'data/tags', 'db', 'enstyle',
	'file', 'fulltext', 'id', 'ingester', 'integration', 'itemTreeView', 'mime',
	'notifier', 'progressWindow', 'quickCopy', 'report', 'schema', 'search',
	'sync', 'timeline', 'translate', 'utilities', 'zeroconf'];

for (var i=0; i<xpcomFiles.length; i++) {
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFiles[i] + ".js");
}

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://global/content/nsTransferable.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://global/content/nsDragAndDrop.js");

/********************************************************************/


// Initialize the Zotero service
//
// This runs when ZoteroService is first requested.
// Calls to other XPCOM components must be in here rather than in top-level
// code, as other components may not have yet been initialized.
function setupService(){
	try {
		Zotero.init();
	}
	catch (e) {
		var msg = typeof e == 'string' ? e : e.name;
		dump(e + "\n\n");
		Components.utils.reportError(e);
		throw (e);
	}
}

function ZoteroService(){
	this.wrappedJSObject = ZoteroWrapped.Zotero;
	setupService();
}


/**
* Convenience method to replicate window.alert()
**/
function alert(msg){
	Cc["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Ci.nsIPromptService)
		.alert(null, "", msg);
}

/**
* Convenience method to replicate window.confirm()
**/
function confirm(msg){
	return Cc["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Ci.nsIPromptService)
		.confirm(null, "", msg);
}


/**
* Convenience method to replicate window.setTimeout()
**/
function setTimeout(func, ms){
	var timer = Components.classes["@mozilla.org/timer;1"].
		createInstance(Components.interfaces.nsITimer);
	// {} implements nsITimerCallback
	timer.initWithCallback({notify:func}, ms,
		Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	return timer;
}


//
// XPCOM goop
//
ZoteroService.prototype = {
	QueryInterface: function(iid){
		if (!iid.equals(Components.interfaces.nsISupports) &&
			!iid.equals(ZOTERO_IID)){ // interface unused
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	}
};


var ZoteroFactory = {
	createInstance: function(outer, iid){
		if (outer != null){
			throw Components.results.NS_ERROR_NO_AGGREGATION;
		}
		return new ZoteroService().QueryInterface(iid);
	}
};


var ZoteroModule = {
	_firstTime: true,
	
	registerSelf: function(compMgr, fileSpec, location, type){
		if (!this._firstTime){
			throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
		}
		this._firstTime = false;
		
		compMgr =
			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		
		compMgr.registerFactoryLocation(ZOTERO_CID,
										ZOTERO_CLASSNAME,
										ZOTERO_CONTRACTID,
										fileSpec,
										location,
										type);
	},
	
	unregisterSelf: function(compMgr, location, type){
		compMgr =
			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(ZOTERO_CID, location);
	},
	
	getClassObject: function(compMgr, cid, iid){
		if (!cid.equals(ZOTERO_CID)){
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		if (!iid.equals(Components.interfaces.nsIFactory)){
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		}
		return ZoteroFactory;
	},
	
	canUnload: function(compMgr){ return true; }
};

function NSGetModule(comMgr, fileSpec){ return ZoteroModule; }
