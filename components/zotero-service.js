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
	'debug',
	'error',
	'utilities/date',
	'utilities/utilities',
	'utilities/utilities_item',
	'utilities/openurl',
	'utilities/xregexp-all',
	'utilities/xregexp-unicode-zotero',
	'utilities/jsonld',
	'utilities_internal',
	'translate/src/utilities_translate',
	'file',
	'http',
	'mimeTypeHandler',
	'pdfWorker/manager',
	'ipc',
	'prompt',
	'profile',
	'progressWindow',
	'proxy',
	'translate/src/translation/translate',
	'translate/src/translator',
	'translate/src/tlds',
	'translation/translate_firefox',
	'isbn',
	'preferencePanes',
	'uiProperties',
];

/** XPCOM files to be loaded only for local translation and DB access **/
const xpcomFilesLocal = [
	'collectionTreeRow',
	'annotations',
	'api',
	'attachments',
	'browserDownload',
	'cite',
	'citeprocRsBridge',
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
	'dictionaries',
	'duplicates',
	'editorInstance',
	'feedReader',
	'fileDragDataProvider',
	'fulltext',
	'id',
	'integration',
	'locale',
	'locateManager',
	'mime',
	'notifier',
	'fileHandlers',
	'plugins',
	'reader',
	'progressQueue',
	'progressQueueDialog',
	'quickCopy',
	'recognizeDocument',
	'report',
	'retractions',
	'router',
	'schema',
	'server',
	'server_integration',
	'session',
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
	'itemTreeManager',
];

Components.utils.import("resource://gre/modules/ComponentUtils.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
			return zContext.Zotero.init(o);
		});
	}
};

const { XPCOMUtils } = ChromeUtils.import(
	"resource://gre/modules/XPCOMUtils.jsm"
);
XPCOMUtils.defineLazyModuleGetters(ZoteroContext.prototype, {
	setTimeout: "resource://gre/modules/Timer.jsm",
	clearTimeout: "resource://gre/modules/Timer.jsm",
	setInterval: "resource://gre/modules/Timer.jsm",
	clearInterval: "resource://gre/modules/Timer.jsm",
	requestIdleCallback: "resource://gre/modules/Timer.jsm",
	cancelIdleCallback: "resource://gre/modules/Timer.jsm",
});

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
		'xregexp-all',
		'xregexp-unicode-zotero'				//adds support for some Unicode categories used in Zotero
	];
	for (var i=0; i<xregexpFiles.length; i++) {
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/utilities/" + xregexpFiles[i] + ".js", zContext, 'utf-8');
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
			Components.utils.reportError("Error loading " + xpcomFile + ".js");
			throw (e);
		}
	}
	
	// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
	const rdfXpcomFiles = [
		'rdf/init',
		'rdf/uri',
		'rdf/term',
		'rdf/identity',
		'rdf/n3parser',
		'rdf/rdfparser',
		'rdf/serialize'
	];
	zContext.Zotero.RDF = {Zotero:zContext.Zotero};
	for (var i=0; i<rdfXpcomFiles.length; i++) {
		subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/translate/src/" + rdfXpcomFiles[i] + ".js", zContext.Zotero.RDF, 'utf-8');
	}
	
	subscriptLoader.loadSubScript("chrome://zotero/content/xpcom/standalone.js", zContext);
	
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
			})
			.then(async function () {
				if (zContext.Zotero.startupErrorHandler || zContext.Zotero.startupError) {
					if (zContext.Zotero.startupErrorHandler) {
						await zContext.Zotero.startupErrorHandler();
					}
					else if (zContext.Zotero.startupError) {
						// Try to repair the DB on the next startup, in case it helps resolve
						// the error
						try {
							zContext.Zotero.Schema.setIntegrityCheckRequired(true);
						}
						catch (e) {}
						
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
								.openWindow(null, 'chrome://zotero/content/update/updates.xhtml',
									'updateChecker', 'chrome,centerscreen,modal', null);
						}
					}
					zContext.Zotero.Utilities.Internal.quitZotero();
				}
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
	classID: Components.ID('{e4c61080-ec2d-11da-8ad9-0800200c9a66}'),
	QueryInterface: ChromeUtils.generateQI([])
}

function addInitCallback(callback) {
	if (zContext && zContext.Zotero) {
		callback(zContext.Zotero);
	}
	else {
		initCallbacks.push(callback);
	}
}

/**
 * Determine whether Zotero Standalone is running
 */
function isStandalone() {
	return true;
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
	handle: async function (cmdLine) {
		// Force debug output to window
		if (cmdLine.handleFlag("ZoteroDebug", false)) {
			zInitOptions.forceDebugLog = 2;
		}
		// Force debug output to text console
		else if (cmdLine.handleFlag("ZoteroDebugText", false)) {
			zInitOptions.forceDebugLog = 1;
		}
		// Pressing Ctrl-C via the terminal is interpreted as a crash, and after three crashes
		// Firefox starts up in automatic safe mode (troubleshooting mode). To avoid this, we clear the crash
		// counter when using one of the debug-logging flags, which generally imply terminal usage.
		if (zInitOptions.forceDebugLog) {
			Services.prefs.getBranch("toolkit.startup.").clearUserPref('recent_crashes');
		}
		
		zInitOptions.forceDataDir = cmdLine.handleFlagWithParam("datadir", false);
		
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
			var templateVersion = parseInt(cmdLine.handleFlagWithParam("ZoteroIntegrationTemplateVersion", false));
			templateVersion = isNaN(templateVersion) ? 0 : templateVersion;
			
			zContext.Zotero.Integration.execCommand(agent, command, docId, templateVersion);
		}
	
		var fileToOpen;
		// Handle zotero:// and file URIs and prevent them from opening a new window
		var param = cmdLine.handleFlagWithParam("url", false);
		if (param) {
			cmdLine.preventDefault = true;
			
			var uri = cmdLine.resolveURI(param);
			if (uri.schemeIs("zotero")) {
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
				
				const { DevToolsLoader } = ChromeUtils.import(
					"resource://devtools/shared/loader/Loader.jsm"
				);
				const loader = new DevToolsLoader({
					freshCompartment: true,
				});
				const { DevToolsServer } = loader.require("devtools/server/devtools-server");
				const { SocketListener } = loader.require("devtools/shared/security/socket");
				
				if (DevToolsServer.initialized) {
					dump("Debugger server already initialized\n\n");
					return;
				}
				
				DevToolsServer.init();
				DevToolsServer.registerAllActors();
				DevToolsServer.allowChromeProcess = true;
				const socketOptions = { portOrPath };
				const listener = new SocketListener(DevToolsServer, socketOptions);
				await listener.open();
				if (!DevToolsServer.listeningSockets) {
					throw new Error("No listening sockets");
				}
				
				dump(`Debugger server started on ${portOrPath}\n\n`);
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
	},
	
	classID: Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}"),
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:"m-zotero"}],
	QueryInterface: ChromeUtils.generateQI([Components.interfaces.nsICommandLineHandler])
};

var NSGetFactory = ComponentUtils.generateNSGetFactory([ZoteroService, ZoteroCommandLineHandler]);
