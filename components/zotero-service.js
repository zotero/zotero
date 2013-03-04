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
	'utilities',
	'utilities_internal',
	'utilities_translate'
];

/** XPCOM files to be loaded only for local translation and DB access **/
const xpcomFilesLocal = [
	'collectionTreeView',
	'annotate',
	'attachments',
	'cite',
	'cookieSandbox',
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
	'db',
	'duplicates',
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
	'storage/streamListener',
	'storage/eventLog',
	'storage/queueManager',
	'storage/queue',
	'storage/request',
	'storage/mode',
	'storage/zfs',
	'storage/webdav',
	'syncedSettings',
	'timeline',
	'uri',
	'translation/translate_item',
	'translation/translator',
	'server_connector'
];

/** XPCOM files to be loaded only for connector translation and DB access **/
const xpcomFilesConnector = [
	'connector/translate_item',
	'connector/translator',
	'connector/connector',
	'connector/connector_firefox',
	'connector/cachedTypes',
	'connector/repo',
	'connector/typeSchemaData'
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
	
	var subscriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
	
	// Load zotero.js first
	subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[0] + ".js", zContext);
	
	// Load CiteProc into Zotero.CiteProc namespace
	zContext.Zotero.CiteProc = {"Zotero":zContext.Zotero};
	subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/citeproc.js", zContext.Zotero.CiteProc);
	
	// Load XRegExp object into Zotero.XRegExp
	const xregexpFiles = [
		/**Core functions**/
		'xregexp',
	
		/**Addons**/
		'addons/build',												//adds ability to "build regular expressions using named subpatterns, for readability and pattern reuse"
		'addons/matchrecursive',							//adds ability to "match recursive constructs using XRegExp pattern strings as left and right delimiters"
	
		/**Unicode support**/
		'addons/unicode/unicode-base',				//required for all other unicode packages. Adds \p{Letter} category
	
		//'addons/unicode/unicode-blocks',			//adds support for all Unicode blocks (e.g. InArabic, InCyrillic_Extended_A, etc.)
		'addons/unicode/unicode-categories',	//adds support for all Unicode categories (e.g. Punctuation, Lowercase_Letter, etc.)
		//'addons/unicode/unicode-properties',	//adds Level 1 Unicode properties (e.g. Uppercase, White_Space, etc.)
		//'addons/unicode/unicode-scripts'			//adds support for all Unicode scripts (e.g. Gujarati, Cyrillic, etc.)
		'addons/unicode/unicode-zotero'				//adds support for some Unicode categories used in Zotero
	];
	for (var i=0; i<xregexpFiles.length; i++) {
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/xregexp/" + xregexpFiles[i] + ".js", zContext);
	}
	
	// Load remaining xpcomFiles
	for (var i=1; i<xpcomFilesAll.length; i++) {
		try {
			subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[i] + ".js", zContext);
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFilesAll[i] + ".js", zContext);
			throw (e);
		}
	}
	
	// Load xpcomFiles for specific mode
	for each(var xpcomFile in (isConnector ? xpcomFilesConnector : xpcomFilesLocal)) {
		try {
			subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFile + ".js", zContext);
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFile + ".js", zContext);
			throw (e);
		}
	}
	
	// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
	const rdfXpcomFiles = [
		'rdf/init',
		'rdf/uri',
		'rdf/term',
		'rdf/identity',
		'rdf/match',
		'rdf/n3parser',
		'rdf/rdfparser',
		'rdf/serialize'
	];
	zContext.Zotero.RDF = {Zotero:zContext.Zotero};
	for (var i=0; i<rdfXpcomFiles.length; i++) {
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + rdfXpcomFiles[i] + ".js", zContext.Zotero.RDF);
	}
	
	if(isStandalone()) {
		// If isStandalone, load standalone.js
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/standalone.js", zContext);
	}
	
	// load nsTransferable (query: do we still use this?)
	subscriptLoader.loadSubScript("chrome://global/content/nsTransferable.js", zContext);
	
	// add connector-related properties
	zContext.Zotero.isConnector = isConnector;
	zContext.Zotero.instanceID = instanceID;
	zContext.Zotero.__defineGetter__("isFirstLoadThisSession", function() isFirstLoadThisSession);
};

/**
 * The class representing the Zotero service, and affiliated XPCOM goop
 */
function ZoteroService() {
	try {
		var start = Date.now();
		
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
		
		zContext.Zotero.debug("Initialized in "+(Date.now() - start)+" ms");
	} catch(e) {
		var msg = typeof e == 'string' ? e : e.name;
		dump(e + "\n\n");
		Components.utils.reportError(e);
		throw e;
	}
}

ZoteroService.prototype = {
	contractID: '@zotero.org/Zotero;1',
	classDescription: 'Zotero',
	classID: Components.ID('{e4c61080-ec2d-11da-8ad9-0800200c9a66}'),
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports,
			Components.interfaces.nsIProtocolHandler])
}

var _isStandalone = null;
/**
 * Determine whether Zotero Standalone is running
 */
function isStandalone() {
	if(_isStandalone === null) {
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
			getService(Components.interfaces.nsIXULAppInfo);
		_isStandalone = appInfo.ID === 'zotero@chnm.gmu.edu';
	}
	return _isStandalone;
}

/**
 * The class representing the Zotero command line handler
 */
function ZoteroCommandLineHandler() {}
ZoteroCommandLineHandler.prototype = {
	/* nsICommandLineHandler */
	handle : function(cmdLine) {
		// handler for Zotero integration commands
		// this is typically used on Windows only, via WM_COPYDATA rather than the command line
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		if(agent) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			
			var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
			var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
			
			// Not quite sure why this is necessary to get the appropriate scoping
			var Zotero = this.Zotero;
			Zotero.setTimeout(function() { Zotero.Integration.execCommand(agent, command, docId) }, 0);
		}
		
		// handler for Windows IPC commands
		var ipcParam = cmdLine.handleFlagWithParam("ZoteroIPC", false);
		if(ipcParam) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			var Zotero = this.Zotero;
			Zotero.setTimeout(function() { Zotero.IPC.parsePipeInput(ipcParam) }, 0);
		}
		
		// special handler for "zotero" URIs at the command line to prevent them from opening a new
		// window
		if(isStandalone()) {
			var param = cmdLine.handleFlagWithParam("url", false);
			if(param) {
				var uri = cmdLine.resolveURI(param);
				if(uri.schemeIs("zotero")) {
					// Check for existing window and focus it
					var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator);
					var win = wm.getMostRecentWindow("navigator:browser");
					if(win) {
						win.focus();
						Components.classes["@mozilla.org/network/protocol;1?name=zotero"]
							.createInstance(Components.interfaces.nsIProtocolHandler).newChannel(uri);
					}
				} else {
					this.Zotero.debug("Not handling URL: "+uri.spec);
				}
			}
			
			var param = cmdLine.handleFlagWithParam("file", false);
			if(param) {
				var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(param);
				
				if(file.leafName.substr(-4).toLowerCase() === ".csl"
						|| file.leafName.substr(-8).toLowerCase() === ".csl.txt") {
					// Install CSL file
					this.Zotero.Styles.install(file);
				} else {
					// Ask before importing
					var checkState = {"value":this.Zotero.Prefs.get('import.createNewCollection.fromFileOpenHandler')};
					if(Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Components.interfaces.nsIPromptService)
							.confirmCheck(null, this.Zotero.getString('ingester.importFile.title'),
							this.Zotero.getString('ingester.importFile.text', [file.leafName]),
							this.Zotero.getString('ingester.importFile.intoNewCollection'), 
							checkState)) {
						// Perform file import in front window
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										   .getService(Components.interfaces.nsIWindowMediator);
						var browserWindow = wm.getMostRecentWindow("navigator:browser");
						browserWindow.Zotero_File_Interface.importFile(file, checkState.value);
						this.Zotero.Prefs.set('import.createNewCollection.fromFileOpenHandler', checkState.value);
					}
				}
			}
		}
		// handler to open Zotero pane at startup in Zotero for Firefox
		else {
			var zPaneOpen = cmdLine.handleFlag("ZoteroPaneOpen", false);
			if (zPaneOpen) {
                this.Zotero.openPane = true;
            }
        }
	},
	
	contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=zotero",
	classDescription: "Zotero Command Line Handler",
	classID: Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}"),
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:"m-zotero"}],
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
	                                       Components.interfaces.nsISupports])
};

ZoteroCommandLineHandler.prototype.__defineGetter__("Zotero", function() {
	if(!zContext) new ZoteroService();
	return zContext.Zotero;
});

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroService, ZoteroCommandLineHandler]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([ZoteroService, ZoteroCommandLineHandler]);
}