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
    
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
	
    ***** END LICENSE BLOCK *****
*/

const ZOTERO_CONTRACTID = '@zotero.org/Zotero;1';
const ZOTERO_CLASSNAME = 'Zotero';
const ZOTERO_CID = Components.ID('{e4c61080-ec2d-11da-8ad9-0800200c9a66}');
const ZOTERO_IID = Components.interfaces.chnmIZoteroService; //unused

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
                         getService(Components.interfaces.nsIXULAppInfo);
if(appInfo.platformVersion[0] == 2) {
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
}

// Assign the global scope to a variable to passed via wrappedJSObject
var ZoteroWrapped = this;

/********************************************************************
* Include the core objects to be stored within XPCOM
*********************************************************************/

var xpcomFiles = [
	'zotero',
	'annotate',
	'attachments',
	'cite',
	'collectionTreeView',
	'commons',
	'connector',
	'dataServer',
	'data_access',
	'data/dataObjects',
	'data/cachedTypes',
	'data/item',
	'data/items',
	'data/collection',
	'data/collections',
	'data/creator',
	'data/creators',
	'data/group',
	'data/groups',
	'data/itemFields',
	'data/notes',
	'data/libraries',
	'data/relation',
	'data/relations',
	'data/tag',
	'data/tags',
	'date',
	'db',
	'debug',
	'duplicate',
	'enstyle',
	'error',
	'file',
	'fulltext',
	'http',
	'id',
	'integration',
	'integration_compat',
	'itemTreeView',
	'mime',
	'mimeTypeHandler',
	'notifier',
	'openurl',
	'progressWindow',
	'proxy',
	'quickCopy',
	'report',
	'schema',
	'search',
	'style',
	'sync',
	'storage',
	'storage/session',
	'storage/zfs',
	'storage/webdav',
	'timeline',
	'translation/translator',
	'translation/translate',
	'translation/browser_firefox',
	'translation/item_local',
	'uri',
	'utilities',
	'zeroconf'
];

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFiles[0] + ".js");

// Load CiteProc into Zotero.CiteProc namespace
Zotero.CiteProc = {"Zotero":Zotero};
Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://zotero/content/xpcom/citeproc.js", Zotero.CiteProc);

for (var i=1; i<xpcomFiles.length; i++) {
	try {
		Cc["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Ci.mozIJSSubScriptLoader)
			.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFiles[i] + ".js");
	}
	catch (e) {
		Components.utils.reportError("Error loading " + xpcomFiles[i] + ".js");
		throw (e);
	}
}


// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
var rdfXpcomFiles = [
	'rdf/uri',
	'rdf/term',
	'rdf/identity',
	'rdf/match',
	'rdf/n3parser',
	'rdf/rdfparser',
	'rdf/serialize',
	'rdf'
];

Zotero.RDF = {AJAW:{}};

for (var i=0; i<rdfXpcomFiles.length; i++) {
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://zotero/content/xpcom/" + rdfXpcomFiles[i] + ".js", Zotero.RDF.AJAW);
}

Cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Ci.mozIJSSubScriptLoader)
	.loadSubScript("chrome://global/content/nsTransferable.js");

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
// TODO: is this still used? if so, move to zotero.js
function alert(msg){
	Cc["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Ci.nsIPromptService)
		.alert(null, "", msg);
}

/**
* Convenience method to replicate window.confirm()
**/
// TODO: is this still used? if so, move to zotero.js
function confirm(msg){
	return Cc["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Ci.nsIPromptService)
		.confirm(null, "", msg);
}


/**
* Convenience method to replicate window.setTimeout()
**/
// TODO: is this still used? if so, move to zotero.js
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
	contractID: ZOTERO_CONTRACTID,
	classDescription: ZOTERO_CLASSNAME,
	classID: ZOTERO_CID,
	service: true,
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports, ZOTERO_IID])
}

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroService]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([ZoteroService]);
}