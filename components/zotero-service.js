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
const Cr = Components.results;
const Cu = Components.utils;

/** XPCOM files to be loaded for all modes **/
const xpcomFilesAll = [
	'zotero',
	'intl',
	'prefs',
	'dataDirectory',
	'date',
	'debug',
	'error',
	'utilities',
	'utilities_internal',
	'file',
	'http',
	'mimeTypeHandler',
	'openurl',
	'ipc',
	'profile',
	'progressWindow',
	'proxy',
	'translation/translate',
	'translation/translate_firefox',
	'translation/translator',
	'translation/tlds',
	'isbn',
	'utilities_translate'
];

/** XPCOM files to be loaded only for local translation and DB access **/
const xpcomFilesLocal = [
	'libraryTreeView',
	'collectionTreeView',
	'collectionTreeRow',
	'annotate',
	'api',
	'attachments',
	'cite',
	'cookieSandbox',
	'data/library',
	'data/libraries',
	'data/dataObject',
	'data/dataObjects',
	'data/dataObjectUtilities',
	'data/cachedTypes',
	'data/notes',
	'data/item',
	'data/items',
	'data/collection',
	'data/collections',
	'data/feedItem',
	'data/feedItems',
	'data/feed',
	'data/feeds',
	'data/creators',
	'data/group',
	'data/groups',
	'data/itemFields',
	'data/relations',
	'data/search',
	'data/searchConditions',
	'data/searches',
	'data/tags',
	'db',
	'duplicates',
	'feedReader',
	'fulltext',
	'id',
	'integration',
	'itemTreeView',
	'locale',
	'locateManager',
	'mime',
	'notifier',
	'openPDF',
	'progressQueue',
	'progressQueueDialog',
	'quickCopy',
	'recognizePDF',
	'report',
	'retractions',
	'router',
	'schema',
	'server',
	'streamer',
	'style',
	'sync',
	'sync/syncAPIClient',
	'sync/syncEngine',
	'sync/syncExceptions',
	'sync/syncEventListeners',
	'sync/syncFullTextEngine',
	'sync/syncLocal',
	'sync/syncRunner',
	'sync/syncUtilities',
	'storage',
	'storage/storageEngine',
	'storage/storageLocal',
	'storage/storageRequest',
	'storage/storageResult',
	'storage/storageUtilities',
	'storage/streamListener',
	'storage/zfs',
	'storage/webdav',
	'syncedSettings',
	'timeline',
	'uri',
	'users',
	'translation/translate_item',
	'translation/translators',
	'connector/httpIntegrationClient',
	'connector/server_connector',
	'connector/server_connectorIntegration',
];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var instanceID = (new Date()).getTime();
var isFirstLoadThisSession = true;
var zContext = null;
var initCallbacks = [];
var zInitOptions = {};

// Components.utils.import('resource://zotero/require.js');
// Not using Cu.import here since we don't want the require module to be cached
// for includes within ZoteroPane or other code, where we want the window instance available to modules.
Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Components.interfaces.mozIJSSubScriptLoader)
	.loadSubScript('resource://zotero/require.js');

var ZoteroContext = function() {}
ZoteroContext.prototype = {
	require,
	
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
		return this.Zotero.setTimeout(func, ms);
	},
	
	"clearTimeout":function setTimeout(id) {
		this.Zotero.clearTimeout(id);
	},
	
	/**
	 * Switches in or out of connector mode
	 */
	"switchConnectorMode":function(isConnector) {
		if(isConnector !== this.isConnector) {
			Services.obs.notifyObservers(zContext.Zotero, "zotero-before-reload", isConnector ? "connector" : "full");
			zContext.Zotero.shutdown().then(function() {
				// create a new zContext
				makeZoteroContext(isConnector);
				return zContext.Zotero.init(zInitOptions);
			}).done();
		}
		
		return zContext;
	},

	/**
	 * Shuts down Zotero, calls a callback (that may return a promise),
	 * then reinitializes Zotero. Returns a promise that is resolved
	 * when this process completes.
	 */
	"reinit":function(cb, isConnector, options = {}) {
		Services.obs.notifyObservers(zContext.Zotero, "zotero-before-reload", isConnector ? "connector" : "full");
		return zContext.Zotero.shutdown().then(function() {
			return cb ? cb() : false;
		}).finally(function() {
			makeZoteroContext(isConnector);
			var o = {};
			Object.assign(o, zInitOptions);
			Object.assign(o, options);
			zContext.Zotero.init(o);
		});
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
	subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[0] + ".js", zContext, 'utf-8');
	
	// Load CiteProc into Zotero.CiteProc namespace
	zContext.Zotero.CiteProc = {"Zotero":zContext.Zotero};
	subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/citeproc.js", zContext.Zotero.CiteProc, 'utf-8');
	
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
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/xregexp/" + xregexpFiles[i] + ".js", zContext, 'utf-8');
	}
	
	// Load remaining xpcomFiles
	for (var i=1; i<xpcomFilesAll.length; i++) {
		try {
			subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFilesAll[i] + ".js", zContext, 'utf-8');
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFilesAll[i] + ".js", zContext);
			throw (e);
		}
	}
	
	// Load xpcomFiles for specific mode
	for (let xpcomFile of (isConnector ? xpcomFilesConnector : xpcomFilesLocal)) {
		try {
			subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + xpcomFile + ".js", zContext, "utf-8");
		}
		catch (e) {
			dump("Error loading " + xpcomFile + ".js\n\n");
			dump(e + "\n\n");
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
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/" + rdfXpcomFiles[i] + ".js", zContext.Zotero.RDF, 'utf-8');
	}
	
	if(isStandalone()) {
		// If isStandalone, load standalone.js
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/standalone.js", zContext, 'utf-8');
	}
	
	// add connector-related properties
	zContext.Zotero.isConnector = isConnector;
	zContext.Zotero.instanceID = instanceID;
	zContext.Zotero.__defineGetter__("isFirstLoadThisSession", function() { return isFirstLoadThisSession; });
};

/**
 * The class representing the Zotero service, and affiliated XPCOM goop
 */
function ZoteroService() {
	try {
		var start = Date.now();
		
		if(isFirstLoadThisSession) {
			makeZoteroContext(false);
			zContext.Zotero.init(zInitOptions)
			.catch(function (e) {
				dump(e + "\n\n");
				Components.utils.reportError(e);
				if (!zContext.Zotero.startupError) {
					zContext.Zotero.startupError = e.stack || e;
				}
				if (!isStandalone()) {
					throw e;
				}
			})
			.then(function () {
				if (isStandalone()) {
					if (zContext.Zotero.startupErrorHandler || zContext.Zotero.startupError) {
						if (zContext.Zotero.startupErrorHandler) {
							zContext.Zotero.startupErrorHandler();
						}
						else if (zContext.Zotero.startupError) {
							try {
								zContext.Zotero.startupError =
									zContext.Zotero.Utilities.Internal.filterStack(
										zContext.Zotero.startupError
									);
							}
							catch (e) {}
							
							let ps = Cc["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Ci.nsIPromptService);
							let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
							// Get the stringbundle manually
							let errorStr = "Error";
							let quitStr = "Quit";
							let checkForUpdateStr = "Check for Update";
							try {
								let src = 'chrome://zotero/locale/zotero.properties';
								let stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
									.getService(Components.interfaces.nsIStringBundleService);
								let stringBundle = stringBundleService.createBundle(src);
								errorStr = stringBundle.GetStringFromName('general.error');
								checkForUpdateStr = stringBundle.GetStringFromName('general.checkForUpdate');
								quitStr = stringBundle.GetStringFromName('general.quit');
							}
							catch (e) {}
							let index = ps.confirmEx(
								null,
								errorStr,
								zContext.Zotero.startupError,
								buttonFlags,
								checkForUpdateStr,
								quitStr,
								null,
								null,
								{}
							);
							if (index == 0) {
								Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
									.getService(Components.interfaces.nsIWindowWatcher)
									.openWindow(null, 'chrome://mozapps/content/update/updates.xul',
										'updateChecker', 'chrome,centerscreen,modal', null);
							}
						}
						zContext.Zotero.Utilities.Internal.quitZotero();
					}
					return;
				}
				zContext.Zotero.debug("Initialized in "+(Date.now() - start)+" ms");
				isFirstLoadThisSession = false;
			});
			
			let cb;
			while (cb = initCallbacks.shift()) {
				cb(zContext.Zotero);
			}
		}
		else {
			zContext.Zotero.debug("Already initialized");
		}
		this.wrappedJSObject = zContext.Zotero;
	} catch(e) {
		var msg = e instanceof Error
			? e.name + ': ' + e.message + '\n' + e.fileName + ':' + e.lineNumber + '\n' + e.stack
			: '' + e;
		dump(msg + '\n');
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

function addInitCallback(callback) {
	if (zContext && zContext.Zotero) {
		callback(zContext.Zotero);
	}
	else {
		initCallbacks.push(callback);
	}
}

var _isStandalone = null;
/**
 * Determine whether Zotero Standalone is running
 */
function isStandalone() {
	if(_isStandalone === null) {
		_isStandalone = Services.appinfo.ID === 'zotero@chnm.gmu.edu';
	}
	return _isStandalone;
}

function getOS() {
	return Services.appinfo.OS;
}

function isMac() {
	return getOS() == "Darwin";
}

function isWin() {
	return getOS() == "WINNT";
}

function isLinux() {
	return getOS() == "Linux";
}

/**
 * The class representing the Zotero command line handler
 */
function ZoteroCommandLineHandler() {}
ZoteroCommandLineHandler.prototype = {
	/* nsICommandLineHandler */
	handle : function(cmdLine) {
		// Force debug output to window
		if (cmdLine.handleFlag("ZoteroDebug", false)) {
			zInitOptions.forceDebugLog = 2;
		}
		// Force debug output to text console
		else if (cmdLine.handleFlag("ZoteroDebugText", false)) {
			zInitOptions.forceDebugLog = 1;
		}
		
		zInitOptions.forceDataDir = cmdLine.handleFlagWithParam("datadir", false);
		
		// handler to open Zotero pane at startup in Zotero for Firefox
		if (!isStandalone() && cmdLine.handleFlag("ZoteroPaneOpen", false)) {
			zInitOptions.openPane = true;
		}
		
		if (cmdLine.handleFlag("ZoteroTest", false)) {
			zInitOptions.test = true;
		}
		if (cmdLine.handleFlag("ZoteroAutomatedTest", false)) {
			zInitOptions.automatedTest = true;
		}
		if (cmdLine.handleFlag("ZoteroSkipBundledFiles", false)) {
			zInitOptions.skipBundledFiles = true;
		}
		
		// handler for Zotero integration commands
		// this is typically used on Windows only, via WM_COPYDATA rather than the command line
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		if(agent) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			
			var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
			var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
			
			zContext.Zotero.Integration.execCommand(agent, command, docId);
		}
		
		// handler for Windows IPC commands
		var ipcParam = cmdLine.handleFlagWithParam("ZoteroIPC", false);
		if(ipcParam) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			if (!zContext) new ZoteroService();
			let Zotero = zContext.Zotero;
			Zotero.setTimeout(() => Zotero.IPC.parsePipeInput(ipcParam), 0);
		}
		
		if(isStandalone()) {
			var fileToOpen;
			// Special handler for "zotero" URIs at the command line to prevent them from opening a new window
			var param = cmdLine.handleFlagWithParam("url", false);
			if (param) {
				var uri = cmdLine.resolveURI(param);
				if(uri.schemeIs("zotero")) {
					addInitCallback(function (Zotero) {
						Zotero.uiReadyPromise
						.then(function () {
							// Check for existing window and focus it
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
							var win = wm.getMostRecentWindow("navigator:browser");
							if (win) {
								win.focus();
								win.ZoteroPane.loadURI(uri.spec)
							}
						});
					});
				}
				// See below
				else if (uri.schemeIs("file")) {
					Components.utils.import("resource://gre/modules/osfile.jsm")
					fileToOpen = OS.Path.fromFileURI(uri.spec)
				}
				else {
					dump(`Not handling URL: ${uri.spec}\n\n`);
				}
			}
			
			param = cmdLine.handleFlag("debugger", false);
			if (param) {
				try {
					let portOrPath = Services.prefs.getBranch('').getIntPref('devtools.debugger.remote-port');
					
					const { devtools } = Components.utils.import("resource://devtools/shared/Loader.jsm", {});
					const { DebuggerServer } = devtools.require("devtools/server/main");
					
					if (!DebuggerServer.initialized) {
						dump("Initializing devtools server\n");
						DebuggerServer.init();
						DebuggerServer.registerAllActors();
						DebuggerServer.allowChromeProcess = true;
					}
					
					let listener = DebuggerServer.createListener();
					listener.portOrPath = portOrPath;
					listener.open();
					
					dump("Debugger server started on " + portOrPath + "\n\n");
				}
				catch (e) {
					dump(e + "\n\n");
					Components.utils.reportError(e);
				}
			}
			
			// In Fx49-based Mac Standalone, if Zotero is closed, an associated file is launched, and
			// Zotero hasn't been opened before, a -file parameter is passed and two main windows open.
			// Subsequent file openings when closed result in -url with file:// URLs (converted above)
			// and don't result in two windows. Here we prevent the double window.
			param = fileToOpen;
			if (!param) {
				param = cmdLine.handleFlagWithParam("file", false);
				if (param && isMac()) {
					cmdLine.preventDefault = true;
				}
			}
			if (param) {
				addInitCallback(function (Zotero) {
					// Wait to handle things that require the UI until after it's loaded
					Zotero.uiReadyPromise
					.then(function () {
						var file = Zotero.File.pathToFile(param);
						
						if(file.leafName.substr(-4).toLowerCase() === ".csl"
								|| file.leafName.substr(-8).toLowerCase() === ".csl.txt") {
							// Install CSL file
							Zotero.Styles.install({ file: file.path }, file.path);
						} else {
							// Ask before importing
							var checkState = {
								value: Zotero.Prefs.get('import.createNewCollection.fromFileOpenHandler')
							};
							if (Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService)
									.confirmCheck(null, Zotero.getString('ingester.importFile.title'),
									Zotero.getString('ingester.importFile.text', [file.leafName]),
									Zotero.getString('ingester.importFile.intoNewCollection'),
									checkState)) {
								Zotero.Prefs.set(
									'import.createNewCollection.fromFileOpenHandler', checkState.value
								);
								
								// Perform file import in front window
								var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
								var browserWindow = wm.getMostRecentWindow("navigator:browser");
								browserWindow.Zotero_File_Interface.importFile({
									file,
									createNewCollection: checkState.value
								});
							}
						}
					});
				});
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

var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroService, ZoteroCommandLineHandler]);
