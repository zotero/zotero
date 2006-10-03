const ZOTERO_CONTRACTID = '@chnm.gmu.edu/Zotero;1';
const ZOTERO_CLASSNAME = 'Zotero';
const ZOTERO_CID = Components.ID('{e4c61080-ec2d-11da-8ad9-0800200c9a66}');
const ZOTERO_IID = Components.interfaces.chnmIZoteroService;

const Cc = Components.classes;
const Ci = Components.interfaces;

// Assign the global scope to a variable to passed via wrappedJSObject
var ZoteroWrapped = this;


/********************************************************************
* Include the core objects to be stored within XPCOM
*********************************************************************/

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/zotero.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/db.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/schema.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/data_access.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/attachments.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/notifier.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/history.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/search.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/ingester.js");
	
Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/translate.js");
	
Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/cite.js");
	
Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/utilities.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/integration.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/file.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/fulltext.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/mime.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/itemTreeView.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/collectionTreeView.js");

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/progressWindow.js");

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
	Zotero.init();
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
}


//
// XPCOM goop
//
ZoteroService.prototype = {
	QueryInterface: function(iid){
		if (!iid.equals(Components.interfaces.nsISupports) &&
			!iid.equals(ZOTERO_IID)){
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
