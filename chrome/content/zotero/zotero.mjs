/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2023 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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
    
    ***** END LICENSE BLOCK *****
*/


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

/** XPCOM files to be loaded for all modes **/
const xpcomFilesAll = [
	'zotero',
	'commandLineHandler',
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
	'itemTreeManager',
	'itemPaneManager',
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
	'localAPI/server_localAPI',
];

Components.utils.import("resource://gre/modules/ComponentUtils.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { CommandLineOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");

var instanceID = (new Date()).getTime();
var isFirstLoadThisSession = true;
var zContext = null;
var initCallbacks = [];

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
	 * Shuts down Zotero, calls a callback (that may return a promise),
	 * then reinitializes Zotero. Returns a promise that is resolved
	 * when this process completes.
	 */
	reinit: function (cb, options = {}) {
		Services.obs.notifyObservers(zContext.Zotero, "zotero-before-reload");
		return zContext.Zotero.shutdown().then(function() {
			// Unregister custom protocol handler
			Services.io.unregisterProtocolHandler('zotero');
			
			return cb ? cb() : false;
		}).finally(function() {
			makeZoteroContext();
			var o = {};
			Object.assign(o, CommandLineOptions);
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
function makeZoteroContext() {
	var subscriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
	
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

		// Override Date prototype to follow Zotero configured locale #3880
		subscriptLoader.loadSubScript("chrome://zotero/content/dateOverrides.js");
	}
	
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
			Components.utils.reportError("Error loading " + xpcomFilesAll[i] + ".js");
			throw (e);
		}
	}
	
	// Load xpcomFiles for specific mode
	for (let xpcomFile of xpcomFilesLocal) {
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
	zContext.Zotero.instanceID = instanceID;
	zContext.Zotero.__defineGetter__("isFirstLoadThisSession", function() { return isFirstLoadThisSession; });
};

/**
 * The class representing the Zotero service, and affiliated XPCOM goop
 */
try {
	var start = Date.now();
	
	if(isFirstLoadThisSession) {
		makeZoteroContext(false);
		zContext.Zotero.init(CommandLineOptions)
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
					
					let ps = Services.prompt;
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
	//this.wrappedJSObject = zContext.Zotero;
}
catch (e) {
	var msg = e instanceof Error
		? e.name + ': ' + e.message + '\n' + e.fileName + ':' + e.lineNumber + '\n' + e.stack
		: '' + e;
	dump(msg + '\n');
	Components.utils.reportError(e);
	throw e;
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


export const Zotero = zContext.Zotero;
