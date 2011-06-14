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

/** XPCOM files to be loaded for all modes **/
const xpcomFilesAll = [
	'zotero',
	'date',
	'debug',
	'error',
	'file',
	'http',
	'mimeTypeHandler',
	'openurl',
	'ipc',
	'progressWindow',
	'translation/translate',
	'translation/translate_firefox',
	'translation/tlds',
	'utilities'
];

/** XPCOM files to be loaded only for local translation and DB access **/
const xpcomFilesLocal = [
	'collectionTreeView',
	'annotate',
	'attachments',
	'cite',
	'commons',
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
	'duplicate',
	'enstyle',
	'fulltext',
	'id',
	'integration',
	'itemTreeView',
	'locateManager',
	'mime',
	'notifier',
	'proxy',
	'quickCopy',
	'report',
	'schema',
	'search',
	'server',
	'style',
	'sync',
	'storage',
	'storage/session',
	'storage/zfs',
	'storage/webdav',
	'timeline',
	'uri',
	'zeroconf',
	'translation/translate_item',
	'translation/translator',
	'server_connector'
];

/** XPCOM files to be loaded only for connector translation and DB access **/
const xpcomFilesConnector = [
	'connector/translate_item',
	'connector/translator',
	'connector/connector',
	'connector/cachedTypes'
];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var instanceID = (new Date()).getTime();
var isFirstLoadThisSession = true;
var zContext = null;

ZoteroContext = function() {}
ZoteroContext.prototype = {
	/**
	 * Convenience method to replicate window.alert()
	 **/
	// TODO: is this still used? if so, move to zotero.js
	"alert":function alert(msg){
		this.Zotero.debug("alert() is deprecated from Zotero XPCOM");
		Cc["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Ci.nsIPromptService)
			.alert(null, "", msg);
	},
	
	/**
	 * Convenience method to replicate window.confirm()
	 **/
	// TODO: is this still used? if so, move to zotero.js
	"confirm":function confirm(msg){
		this.Zotero.debug("confirm() is deprecated from Zotero XPCOM");
		return Cc["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Ci.nsIPromptService)
			.confirm(null, "", msg);
	},
	
	"Cc":Cc,
	"Ci":Ci,
	
	/**
	 * Convenience method to replicate window.setTimeout()
	 **/
	"setTimeout":function setTimeout(func, ms){
		this.Zotero.setTimeout(func, ms);
	},
	
	/**
	 * Switches in or out of connector mode
	 */
	"switchConnectorMode":function(isConnector) {
		if(isConnector !== this.isConnector) {
			zContext.Zotero.shutdown();
			
			// create a new zContext
			makeZoteroContext(isConnector);
			zContext.Zotero.init();
		}
		
		return zContext;
	}
};

/**
 * The class from which the Zotero global XPCOM context is constructed
 *
 * @constructor
 * This runs when ZoteroService is first requested to load all applicable scripts and initialize
 * Zotero. Calls to other XPCOM components must be in here rather than in top-level code, as other
 * components may not have yet been initialized.
 */
function makeZoteroContext(isConnector) {
	if(zContext) {
		// Swap out old zContext
		var oldzContext = zContext;
		// Create new zContext
		zContext = new ZoteroContext();
		// Swap in old Zotero object, so that references don't break, but empty it
		zContext.Zotero = oldzContext.Zotero;
		for(var key in zContext.Zotero) delete zContext.Zotero[key];
	} else {
		zContext = new ZoteroContext();
		zContext.Zotero = function() {};
	}
	
	// Load zotero.js first
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[0] + ".js", zContext);
	
	// Load CiteProc into Zotero.CiteProc namespace
	zContext.Zotero.CiteProc = {"Zotero":zContext.Zotero};
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://zotero/content/xpcom/citeproc.js", zContext.Zotero.CiteProc);
	
	// Load remaining xpcomFiles
	for (var i=1; i<xpcomFilesAll.length; i++) {
		try {
			Cc["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Ci.mozIJSSubScriptLoader)
				.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[i] + ".js", zContext);
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFilesAll[i] + ".js", zContext);
			throw (e);
		}
	}
	
	// Load xpcomFiles for specific mode
	for each(var xpcomFile in (isConnector ? xpcomFilesConnector : xpcomFilesLocal)) {
		try {
			Cc["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Ci.mozIJSSubScriptLoader)
				.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFile + ".js", zContext);
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFile + ".js", zContext);
			throw (e);
		}
	}
	
	// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
	const rdfXpcomFiles = [
		'rdf/uri',
		'rdf/term',
		'rdf/identity',
		'rdf/match',
		'rdf/n3parser',
		'rdf/rdfparser',
		'rdf/serialize',
		'rdf'
	];
	zContext.Zotero.RDF = {AJAW:{Zotero:zContext.Zotero}};
	for (var i=0; i<rdfXpcomFiles.length; i++) {
		Cc["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Ci.mozIJSSubScriptLoader)
			.loadSubScript("chrome://zotero/content/xpcom/" + rdfXpcomFiles[i] + ".js", zContext.Zotero.RDF.AJAW);
	}
	
	// load nsTransferable (query: do we still use this?)
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://global/content/nsTransferable.js", zContext);
	
	// add connector-related properties
	zContext.Zotero.isConnector = isConnector;
	zContext.Zotero.instanceID = instanceID;
	zContext.Zotero.__defineGetter__("isFirstLoadThisSession", function() isFirstLoadThisSession);
};

/**
 * The class representing the Zotero service, and affiliated XPCOM goop
 */
function ZoteroService(){
	try {
		if(isFirstLoadThisSession) {
			makeZoteroContext(false);
			try {
				zContext.Zotero.init();
			} catch(e) {
				if(e === "ZOTERO_SHOULD_START_AS_CONNECTOR") {
					// if Zotero should start as a connector, reload it
					zContext.Zotero.shutdown();
					makeZoteroContext(true);
					zContext.Zotero.init();
				} else {
					dump(e.toSource());
					Components.utils.reportError(e);
					throw e;
				}
			}
		}
		isFirstLoadThisSession = false;	// no longer first load
		this.wrappedJSObject = zContext.Zotero;
	} catch(e) {
		var msg = typeof e == 'string' ? e : e.name;
		dump(e + "\n\n");
		Components.utils.reportError(e);
		throw e;
	}
}

//
// XPCOM goop
//

ZoteroService.prototype = {
	contractID: ZOTERO_CONTRACTID,
	classDescription: ZOTERO_CLASSNAME,
	classID: ZOTERO_CID,
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports,
			Components.interfaces.nsIProtocolHandler])
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