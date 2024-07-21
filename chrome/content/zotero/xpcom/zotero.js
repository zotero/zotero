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
    
    ***** END LICENSE BLOCK *****
*/

// Commonly used imports accessible anywhere
Components.utils.importGlobalProperties(["XMLHttpRequest"]);
Components.utils.import("resource://zotero/config.js");
Components.utils.import("resource://gre/modules/Services.jsm");
var { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");
Components.classes["@mozilla.org/net/osfileconstantsservice;1"]
	.getService(Components.interfaces.nsIOSFileConstantsService)
	.init();

const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetters(globalThis, {
	AsyncShutdown: "resource://gre/modules/AsyncShutdown.jsm",
	AppConstants: "resource://gre/modules/AppConstants.jsm",
});
const { CommandLineOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");
Services.scriptloader.loadSubScript("resource://zotero/polyfill.js");

/*
 * Core functions
 */
 (function(){
	// Privileged (public) methods
	this.getStorageDirectory = getStorageDirectory;
	this.debug = debug;
	this.setFontSize = setFontSize;
	this.flattenArguments = flattenArguments;
	this.getAncestorByTagName = getAncestorByTagName;
	this.reinit = reinit; // defined in zotero-service.js
	
	// Public properties
	this.initialized = false;
	this.skipLoading = false;
	this.startupError;
	Object.defineProperty(this, 'startupErrorHandler', {
		get: () => _startupErrorHandler,
		enumerable: true,
		configurable: true
    });
    Object.defineProperty(this, 'resourcesDir', {
		get: () => {
			// AChrome is app/chrome
			return FileUtils.getDir('AChrom', []).parent.parent.path;
		},
		enumerable: true,
		configurable: true
    });
	this.version;
	this.platform;
	this.locale;
	this.dir; // locale direction: 'ltr' or 'rtl'
	this.isMac;
	this.isWin;
	this.initialURL; // used by Schema to show the changelog on upgrades
	this.Promise = require('resource://zotero/bluebird.js');
	
	this.getMainWindow = function () {
		return Services.wm.getMostRecentWindow("navigator:browser");
	};

	/**
	 * @return {ChromeWindow[]} - An array of open windows
	 */
	this.getMainWindows = function () {
		var enumerator = Services.wm.getEnumerator("navigator:browser");
		var windows = [];
		while (enumerator.hasMoreElements()) {
			windows.push(enumerator.getNext());
		}
		return windows;
	};
	
	this.getActiveZoteroPane = function() {
		var win = Services.wm.getMostRecentWindow("navigator:browser");
		return win ? win.ZoteroPane : null;
	};
	
	this.getZoteroPanes = function () {
		var enumerator = Services.wm.getEnumerator("navigator:browser");
		var zps = [];
		while (enumerator.hasMoreElements()) {
			let win = enumerator.getNext();
			if (!win.ZoteroPane) continue;
			zps.push(win.ZoteroPane);
		}
		return zps;
	};
	
	/**
	 * @property	{Boolean}	locked		Whether all Zotero panes are locked
	 *										with an overlay
	 */
	Object.defineProperty(
		this,
		'locked',
		{
			get: () => _locked,
			set: (lock) => {
				var wasLocked = _locked;
				_locked = lock;
				
				if (!wasLocked && lock) {
					this.unlockDeferred = Zotero.Promise.defer();
					this.unlockPromise = this.unlockDeferred.promise;
				}
				else if (wasLocked && !lock) {
					Zotero.debug("Running unlock callbacks");
					this.unlockDeferred.resolve();
				}
			},
			enumerable: true,
			configurable: true
		}
	);
	
	/**
	 * @property {Boolean} crashed - True if the application needs to be restarted
	 */
	this.crashed = false;
	
	/**
	 * @property	{Boolean}	closing		True if the application is closing.
	 */
	this.closing = false;
	
	this.unlockDeferred;
	this.unlockPromise;
	this.initializationDeferred;
	this.initializationPromise;
	
	this.hiDPISuffix = "";
	
	var _startupErrorHandler;
	var _localizedStringBundle;
	
	var _locked = false;
	var _shutdownListeners = [];
	var _progressMessage;
	var _progressMeters;
	var _progressPopup;
	var _lastPercentage;
	
	// whether we are waiting for another Zotero process to release its DB lock
	var _waitingForDBLock = false;
	
	/**
	 * Maintains nsITimers to be used when Zotero.wait() completes (to reduce performance penalty
	 * of initializing new objects)
	 */
	var _waitTimers = [];
	
	/**
	 * Maintains nsITimerCallbacks to be used when Zotero.wait() completes
	 */
	var _waitTimerCallbacks = [];
	
	/**
	 * Maintains running nsITimers in global scope, so that they don't disappear randomly
	 */
	var _runningTimers = new Map();
	
	var _startupTime = new Date();
	// Errors that were in the console at startup
	var _startupErrors = [];
	// Number of errors to maintain in the recent errors buffer
	const ERROR_BUFFER_SIZE = 25;
	// A rolling buffer of the last ERROR_BUFFER_SIZE errors
	var _recentErrors = [];
	
	/**
	 * Initialize the extension
	 *
	 * @return {Promise<Boolean>}
	 */
	this.init = async function (options) {
		if (this.initialized || this.skipLoading) {
			return false;
		}
		
		this.locked = true;
		this.initializationDeferred = Zotero.Promise.defer();
		this.initializationPromise = this.initializationDeferred.promise;
		this.uiReadyDeferred = Zotero.Promise.defer();
		this.uiReadyPromise = this.uiReadyDeferred.promise;
		
		if (options) {
			let opts = [
				'openPane',
				'test',
				'automatedTest',
				'skipBundledFiles'
			];
			opts.filter(opt => options[opt]).forEach(opt => this[opt] = true);
			
			this.forceDataDir = options.forceDataDir;
		}
		
		this.mainThread = Services.tm.mainThread;
		
		this.clientName = ZOTERO_CONFIG.CLIENT_NAME;
		
		this.platformVersion = Services.appinfo.platformVersion;
		this.platformMajorVersion = parseInt(this.platformVersion.match(/^[0-9]+/)[0]);
		this.isFx = true;
		this.isClient = true;
		this.isStandalone = true;
		
		this.version = Services.appinfo.version;
		this.isBetaBuild = Zotero.version.includes('-beta');
		this.isDevBuild = Zotero.version.includes('-dev');
		this.isSourceBuild = Zotero.version.includes('SOURCE');
		
		// OS platform
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			   .getService(Components.interfaces.nsIAppShellService)
			   .hiddenDOMWindow;
		var os = Services.appinfo.OS;
		this.isMac = os == 'Darwin';
		this.isWin = os == 'WINNT';
		this.isLinux = os == 'Linux';
		
		// aarch64, x86_64, x86
		this.arch = Services.appinfo.XPCOMABI.split('-')[0];
		
		// Browser
		Zotero.browser = "g";
		
		// TEMP: Disable automatic safe mode until we can figure out why some shutdowns are
		// counting as crashes
		var branch = Services.prefs.getBranch("toolkit.startup.");
		if (branch.getIntPref('recent_crashes', 0) > 2) {
			branch.clearUserPref('recent_crashes');
		}
		
		Zotero.Intl.init();
		if (this.restarting) return;
		
		await Zotero.Prefs.init();
		Zotero.Debug.init(options && options.forceDebugLog);
		
		// Make sure that Zotero isn't running as root
		if (!Zotero.isWin) _checkRoot();
		
		if (!_checkExecutableLocation()) {
			return;
		}
		
		try {
			await Zotero.DataDirectory.init();
			if (this.restarting) {
				return;
			}
			var dataDir = Zotero.DataDirectory.dir;
		}
		catch (e) {
			// Zotero dir not found
			if (e.name == 'NotFoundError') {
				let foundInDefault = false;
				try {
					foundInDefault = (await OS.File.exists(Zotero.DataDirectory.defaultDir))
						&& (await OS.File.exists(
							OS.Path.join(
								Zotero.DataDirectory.defaultDir,
								Zotero.DataDirectory.getDatabaseFilename()
							)
						));
				}
				catch (e) {
					Zotero.logError(e);
				}
				
				let previousDir = Zotero.Prefs.get('lastDataDir')
					|| Zotero.Prefs.get('dataDir')
					|| e.dataDir;
				Zotero.startupError = foundInDefault
					? Zotero.getString(
						'dataDir.notFound.defaultFound',
						[
							Zotero.clientName,
							previousDir,
							Zotero.DataDirectory.defaultDir
						]
					)
					: Zotero.getString('dataDir.notFound', Zotero.clientName);
				_startupErrorHandler = async function() {
					var ps = Services.prompt;
					var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
						+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
						+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
					// TEMP: lastDataDir can be removed once old persistent descriptors have been
					// converted, which they are in getZoteroDirectory() in 5.0
					if (foundInDefault) {
						let index = ps.confirmEx(null,
							Zotero.getString('general.error'),
							Zotero.startupError,
							buttonFlags,
							Zotero.getString('dataDir.useNewLocation'),
							Zotero.getString('general.quit'),
							Zotero.getString('general.locate'),
							null, {}
						);
						// Revert to home directory
						if (index == 0) {
							Zotero.DataDirectory.set(Zotero.DataDirectory.defaultDir);
							Zotero.Utilities.Internal.quit(true);
							return;
						}
						// Locate data directory
						else if (index == 2) {
							await Zotero.DataDirectory.choose(true);
						}

					}
					else {
						let index = ps.confirmEx(null,
							Zotero.getString('general.error'),
							Zotero.startupError
								+ (previousDir
									? '\n\n' + Zotero.getString('dataDir.previousDir') + ' ' + previousDir
									: ''),
							buttonFlags,
							Zotero.getString('general.quit'),
							Zotero.getString('dataDir.useDefaultLocation'),
							Zotero.getString('general.locate'),
							null, {}
						);
						// Revert to home directory
						if (index == 1) {
							Zotero.DataDirectory.set(Zotero.DataDirectory.defaultDir);
							Zotero.Utilities.Internal.quit(true);
							return;
						}
						// Locate data directory
						else if (index == 2) {
							await Zotero.DataDirectory.choose(true);
						}
					}
				}
				return;
			}
			// DEBUG: handle more startup errors
			else {
				throw e;
			}
		}
		
		if (!this.forceDataDir) {
			await Zotero.DataDirectory.checkForMigration(
				dataDir, Zotero.DataDirectory.defaultDir
			);
			if (this.skipLoading) {
				return;
			}
			
			await Zotero.DataDirectory.checkForLostLegacy();
			if (this.restarting) {
				return;
			}
		}
		
		// Make sure data directory isn't in Dropbox, etc.
		await Zotero.DataDirectory.checkForUnsafeLocation(dataDir);
		
		Services.obs.addObserver({
			observe: function () {
				Zotero.Session.save();
			}
		}, "quit-application-granted", false);
		
		// Register shutdown handler to call Zotero.shutdown()
		var _shutdownObserver = {observe:function() { Zotero.shutdown().done() }};
		Services.obs.addObserver(_shutdownObserver, "quit-application", false);
		
		// Get startup errors
		try {
			let messages = Services.console.getMessageArray();
			_startupErrors = messages.filter(msg => _shouldKeepError(msg));
		} catch(e) {
			Zotero.logError(e);
		}
		// Register error observer
		Services.console.registerListener(ConsoleListener);
		
		// Add shutdown listener to remove quit-application observer and console listener
		this.addShutdownListener(function() {
			Services.obs.removeObserver(_shutdownObserver, "quit-application", false);
			Services.console.unregisterListener(ConsoleListener);
		});
		
		var success = await _initFull();
		if (!success) {
			return false;
		}
			
		Zotero.Standalone.init();
		await Zotero.initComplete();
		// Ingest command line arguments that were not handled due to late command line handler registration.
		Zotero.CommandLineIngester.ingest();
	};
	
	/**
	 * Triggers events when initialization finishes
	 */
	this.initComplete = async function() {
		if(Zotero.initialized) return;
		
		Zotero.debug("Running initialization callbacks");
		delete this.startupError;
		this.initialized = true;
		this.initializationDeferred.resolve();
		
		if(!Zotero.isFirstLoadThisSession) {
			// trigger zotero-reloaded event
			Zotero.debug('Triggering "zotero-reloaded" event');
			Services.obs.notifyObservers(Zotero, "zotero-reloaded", null);
		}
		
		Zotero.debug('Triggering "zotero-loaded" event');
		Services.obs.notifyObservers(Zotero, "zotero-loaded", null);
		
		Zotero.debug('Initializing Word Processor plugins');
		Zotero.Integration.init();
		await Zotero.Plugins.init();
	}
	
	
	this.uiIsReady = function () {
		if (this.uiReadyPromise.isPending()) {
			Zotero.debug("User interface ready in " + (new Date() - _startupTime) + " ms");
			this.uiReadyDeferred.resolve();
		}
	};
	
	
	/**
	 * Initialization function to be called only if Zotero is in full mode
	 *
	 * @return {Promise:Boolean}
	 */
	var _initFull = Zotero.Promise.coroutine(function* () {
		if (!(yield _initDB())) return false;
		
		Zotero.VersionHeader.init();
		
		// Check for data reset/restore
		var dataDir = Zotero.DataDirectory.dir;
		var restoreFile = OS.Path.join(dataDir, 'restore-from-server');
		var resetDataDirFile = OS.Path.join(dataDir, 'reset-data-directory');
		
		var result = yield Zotero.Promise.all([OS.File.exists(restoreFile), OS.File.exists(resetDataDirFile)]);
		if (result.some(r => r)) {
			[Zotero.restoreFromServer, Zotero.resetDataDir] = result;
			try {
				yield Zotero.DB.closeDatabase();
				
				// TODO: better error handling
				
				// TODO: prompt for location
				// TODO: Back up database
				// TODO: Reset translators and styles
				
				
				
				if (Zotero.restoreFromServer) {
					let dbfile = Zotero.DataDirectory.getDatabase();
					Zotero.debug("Deleting " + dbfile);
					yield OS.File.remove(dbfile, { ignoreAbsent: true });
					let storageDir = OS.Path.join(dataDir, 'storage');
					Zotero.debug("Deleting " + storageDir.path);
					OS.File.removeDir(storageDir, { ignoreAbsent: true }),
					yield OS.File.remove(restoreFile);
					Zotero.restoreFromServer = true;
				}
				else if (Zotero.resetDataDir) {
					Zotero.initAutoSync = true;
					
					// Clear some user prefs
					[
						'sync.server.username',
						'sync.storage.username'
					].forEach(p => Zotero.Prefs.clear(p));
					
					// Clear data directory
					Zotero.debug("Deleting data directory files");
					let lastError;
					// Delete all files in directory rather than removing directory, in case it's
					// a symlink
					yield Zotero.File.iterateDirectory(dataDir, async function (entry) {
						// Don't delete some files
						if (entry.name == 'pipes') {
							return;
						}
						Zotero.debug("Deleting " + entry.path);
						try {
							if (entry.isDir) {
								await OS.File.removeDir(entry.path);
							}
							else {
								await OS.File.remove(entry.path);
							}
						}
						// Keep trying to delete as much as we can
						catch (e) {
							lastError = e;
							Zotero.logError(e);
						}
					});
					if (lastError) {
						throw lastError;
					}
				}
				Zotero.debug("Done with reset");
				
				if (!(yield _initDB())) return false;
			}
			catch (e) {
				// Restore from backup?
				alert(e);
				return false;
			}
		}
		
		Zotero.HTTP.triggerProxyAuth();
		
		// Add notifier queue callbacks to the DB layer
		Zotero.DB.addCallback('begin', id => Zotero.Notifier.begin(id));
		Zotero.DB.addCallback('commit', id => Zotero.Notifier.commit(null, id));
		Zotero.DB.addCallback('rollback', id => Zotero.Notifier.reset(id));
		
		try {
			// Require >=2.1b3 database to ensure proper locking
			let dbSystemVersion = yield Zotero.Schema.getDBVersion('system');
			if (dbSystemVersion > 0 && dbSystemVersion < 31) {
				let ps = Services.prompt;
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
					+ ps.BUTTON_POS_2_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('dataDir.incompatibleDbVersion.title'),
					Zotero.getString('dataDir.incompatibleDbVersion.text'),
					buttonFlags,
					Zotero.getString('general.useDefault'),
					Zotero.getString('dataDir.chooseNewDataDirectory'),
					Zotero.getString('general.quit'),
					null,
					{}
				);
				
				var quit = false;
				
				// Default location
				if (index == 0) {
					Zotero.Prefs.set("useDataDir", false)
					
					Services.startup.quit(
						Components.interfaces.nsIAppStartup.eAttemptQuit
							| Components.interfaces.nsIAppStartup.eRestart
					);
				}
				// Select new data directory
				else if (index == 1) {
					let dir = yield Zotero.DataDirectory.choose(true);
					if (!dir) {
						quit = true;
					}
				}
				else {
					quit = true;
				}
				
				if (quit) {
					Services.startup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
				}
				
				throw true;
			}
			
			try {
				var updated = yield Zotero.Schema.updateSchema({
					onBeforeUpdate: (options = {}) => {
						if (options.minor) return;
						try {
							Zotero.showZoteroPaneProgressMeter(
								Zotero.getString('upgrade.status')
							)
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
				});
			}
			catch (e) {
				Zotero.logError(e);
				
				if (e instanceof Zotero.DB.IncompatibleVersionException) {
					let kbURL = "https://www.zotero.org/support/kb/newer_db_version";
					let msg = (e.dbClientVersion
						? Zotero.getString('startupError.incompatibleDBVersion',
							[Zotero.clientName, e.dbClientVersion])
						: Zotero.getString('startupError.zoteroVersionIsOlder')) + "\n\n"
						+ Zotero.getString('startupError.zoteroVersionIsOlder.current', Zotero.version)
							+ "\n\n"
						+ Zotero.getString('startupError.zoteroVersionIsOlder.upgrade',
							ZOTERO_CONFIG.DOMAIN_NAME);
					Zotero.startupError = msg;
					_startupErrorHandler = function() {
						var ps = Services.prompt;
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
							+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
							+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
							+ ps.BUTTON_POS_0_DEFAULT;
						
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.error'),
							Zotero.startupError,
							buttonFlags,
							Zotero.getString('general.checkForUpdates'),
							null,
							Zotero.getString('general.moreInformation'),
							null,
							{}
						);
						
						// "Check for Update" button
						if (index === 0) {
							Zotero.openCheckForUpdatesWindow({ modal: true });
						}
						// Load More Info page
						else if (index == 2) {
							let uri = Services.io.newURI(kbURL, null, null);
							let handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
								.getService(Components.interfaces.nsIExternalProtocolService)
								.getProtocolHandlerInfo('http');
							handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
							handler.launchWithURI(uri, null);
						}
					};
					throw e;
				}
				
				let stack = e.stack ? Zotero.Utilities.Internal.filterStack(e.stack) : null;
				Zotero.startupError = Zotero.getString('startupError.databaseUpgradeError')
					+ "\n\n"
					+ (stack || e);
				throw e;
			}
			
			const { ZoteroProtocolHandler } = ChromeUtils.import(
				`chrome://zotero/content/ZoteroProtocolHandler.jsm`
			);
			ZoteroProtocolHandler.init();

			const { ZoteroAutoComplete } = ChromeUtils.import(
				`chrome://zotero/content/zotero-autocomplete.js`
			);
			ZoteroAutoComplete.init();

			yield Zotero.Users.init();
			yield Zotero.Libraries.init();
			
			yield Zotero.ID.init();
			yield Zotero.ItemTypes.init();
			yield Zotero.ItemFields.init();
			yield Zotero.CreatorTypes.init();
			yield Zotero.FileTypes.init();
			yield Zotero.CharacterSets.init();
			yield Zotero.RelationPredicates.init();
			
			yield Zotero.Session.init();
			
			Zotero.locked = false;
			
			// Initialize various services
			if(Zotero.Prefs.get("httpServer.enabled")) {
				Zotero.Server.init();
			}
			
			yield Zotero.Fulltext.init();
			
			Zotero.Notifier.registerObserver(Zotero.Tags, 'setting', 'tags');
			
			yield Zotero.Sync.Data.Local.init();
			yield Zotero.Sync.Data.Utilities.init();
			Zotero.Sync.Storage.Local.init();
			Zotero.Sync.Runner = new Zotero.Sync.Runner_Module;
			Zotero.Sync.EventListeners.init();
			Zotero.Streamer = new Zotero.Streamer_Module;
			Zotero.Streamer.init();
			
			Zotero.MIMETypeHandler.init();
			yield Zotero.Proxies.init();
			
			// Initialize keyboard shortcuts
			Zotero.Keys.init();
			
			Zotero.Date.init();
			Zotero.LocateManager.init();
			yield Zotero.Collections.init();
			yield Zotero.Items.init();
			yield Zotero.Searches.init();
			yield Zotero.Tags.init();
			yield Zotero.Creators.init();
			yield Zotero.Groups.init();
			yield Zotero.Relations.init();
			yield Zotero.Retractions.init();
			yield Zotero.Dictionaries.init();
			Zotero.Reader.init();
			
			// Load all library data except for items, which are loaded when libraries are first
			// clicked on or if otherwise necessary
			yield Zotero.Promise.each(
				Zotero.Libraries.getAll(),
				library => Zotero.Promise.coroutine(function* () {
					yield Zotero.SyncedSettings.loadAll(library.libraryID);
					if (library.libraryType != 'feed') {
						yield Zotero.Collections.loadAll(library.libraryID);
						yield Zotero.Searches.loadAll(library.libraryID);
					}
				})()
			);
			
			// Migrate fields from Extra that can be moved to item fields after a schema update
			yield Zotero.Schema.migrateExtraFields();
			
			Zotero.Items.startEmptyTrashTimer();
			
			yield Zotero.QuickCopy.init();
			Zotero.addShutdownListener(() => Zotero.QuickCopy.uninit());
			
			Zotero.Feeds.init();
			Zotero.addShutdownListener(() => Zotero.Feeds.uninit());
			
			Zotero.Schema.schemaUpdatePromise.then(Zotero.purgeDataObjects.bind(Zotero));
			
			return true;
		}
		catch (e) {
			Zotero.logError(e);
			if (!Zotero.startupError) {
				Zotero.startupError = Zotero.getString('startupError', Zotero.appName) + "\n\n"
					+ Zotero.getString('db.integrityCheck.reportInForums') + "\n\n"
					+ e.message ? (e.message + "\n\n" + e.stack) : e;
			}
			return false;
		}
	});
	
	/**
	 * Initializes the DB connection
	 */
	var _initDB = Zotero.Promise.coroutine(function* (haveReleasedLock) {
		// Initialize main database connection
		Zotero.DB = new Zotero.DBConnection('zotero');
		
		try {
			// Test read access
			yield Zotero.DB.test();
			
			let dbfile = Zotero.DataDirectory.getDatabase();

			// Test write access on Zotero data directory
			if (!Zotero.File.pathToFile(PathUtils.parent(dbfile)).isWritable()) {
				var msg = 'Cannot write to ' + PathUtils.parent(dbfile) + '/';
			}
			// Test write access on Zotero database
			else if (!Zotero.File.pathToFile(dbfile).isWritable()) {
				var msg = 'Cannot write to ' + dbfile;
			}
			else {
				var msg = false;
			}
			
			if (msg) {
				var e = {
					name: 'NS_ERROR_FILE_ACCESS_DENIED',
					message: msg,
					toString: function () { return this.message; }
				};
				throw (e);
			}
		}
		catch (e) {
			if (_checkDataDirAccessError(e)) {}
			// Storage busy
			else if (e.message.includes('2153971713')) {
				Zotero.startupError = Zotero.getString('startupError.databaseInUse');
			}
			else {
				let stack = e.stack ? Zotero.Utilities.Internal.filterStack(e.stack) : null;
				Zotero.startupError = Zotero.getString('startupError', Zotero.appName) + "\n\n"
					+ Zotero.getString('db.integrityCheck.reportInForums') + "\n\n"
					+ (stack || e);
			}
			
			Zotero.debug(e.toString(), 1);
			Components.utils.reportError(e); // DEBUG: doesn't always work
			Zotero.skipLoading = true;
			return false;
		}
		
		return true;
	});
	
	
	function _checkDataDirAccessError(e) {
		if (e.name != 'NS_ERROR_FILE_ACCESS_DENIED' && !e.message.includes('2152857621')) {
			return false;
		}
		
		var msg = Zotero.getString('dataDir.databaseCannotBeOpened', Zotero.clientName)
			+ "\n\n"
			+ Zotero.getString('dataDir.checkPermissions', Zotero.clientName);
		// If already using default directory, just show it
		if (Zotero.DataDirectory.dir == Zotero.DataDirectory.defaultDir) {
			msg += "\n\n" + Zotero.getString('dataDir.location', Zotero.DataDirectory.dir);
		}
		// Otherwise suggest moving to default, since there's a good chance this is due to security
		// software preventing Zotero from accessing the selected directory (particularly if it's
		// a Firefox profile)
		else {
			msg += "\n\n"
				+ Zotero.getString('dataDir.moveToDefaultLocation', Zotero.clientName)
				+ "\n\n"
				+ Zotero.getString(
					'dataDir.migration.failure.full.current', Zotero.DataDirectory.dir
				)
				+ "\n"
				+ Zotero.getString(
					'dataDir.migration.failure.full.recommended', Zotero.DataDirectory.defaultDir
				);
		}
		Zotero.startupError = msg;
		return true;
	}
	
	
	this.shutdown = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Shutting down Zotero");
		
		try {
			// set closing to true
			Zotero.closing = true;
			
			// run shutdown listener
			let shutdownPromises = [];
			for (let listener of _shutdownListeners) {
				try {
					shutdownPromises.push(listener());
				}
				catch(e) {
					Zotero.logError(e);
				}
			}
			yield Promise.all(shutdownPromises);
			
			if (Zotero.DB) {
				// close DB
				yield Zotero.DB.closeDatabase(true)
			}
		} catch(e) {
			Zotero.logError(e);
		}
	});
	
	
	this.getProfileDirectory = function () {
		Zotero.warn("Zotero.getProfileDirectory() is deprecated -- use Zotero.Profile.dir");
		return Zotero.File.pathToFile(Zotero.Profile.dir);
	}
	
	this.getZoteroDirectory = function () {
		Zotero.warn("Zotero.getZoteroDirectory() is deprecated -- use Zotero.DataDirectory.dir");
		return Zotero.File.pathToFile(Zotero.DataDirectory.dir);
	}
	
	this.getZoteroDatabase = function (name, ext) {
		Zotero.warn("Zotero.getZoteroDatabase() is deprecated -- use Zotero.DataDirectory.getDatabase()");
		return Zotero.File.pathToFile(Zotero.DataDirectory.getDatabase(name, ext));
	}
	
	function getStorageDirectory() {
		return Zotero.File.pathToFile(Zotero.DataDirectory.getSubdirectory('storage', true));
	}

	this.getStylesDirectory = function () {
		return Zotero.File.pathToFile(Zotero.DataDirectory.getSubdirectory('styles', true));
	}
	
	this.getTranslatorsDirectory = function () {
		return Zotero.File.pathToFile(Zotero.DataDirectory.getSubdirectory('translators', true));
	}
	
	var _tmpDir;
	this.getTempDirectory = function () {
		if (_tmpDir) {
			return Zotero.File.pathToFile(_tmpDir);
		}
		var dir;
		try {
			dir = Services.dirsvc.get("TmpD", Ci.nsIFile);
			let relDir;
			if (Zotero.isWin) {
				relDir = 'Zotero';
			}
			else if (Zotero.isMac) {
				relDir = 'org.zotero.zotero';
			}
			else {
				relDir = 'zotero';
			}
			dir.append(relDir);
			Zotero.File.createDirectoryIfMissing(dir);
		}
		// If we can't use the system temp dir, fall back to 'tmp' in the data dir
		catch (e) {
			Zotero.warn(e);
			dir = Zotero.File.pathToFile(Zotero.DataDirectory.getSubdirectory('tmp', true));
		}
		
		AsyncShutdown.profileBeforeChange.addBlocker(
			"Zotero: Removing temp directory",
			() => this.removeTempDirectory()
		);
		
		_tmpDir = dir.path;
		return dir;
	};
	
	this.removeTempDirectory = async function () {
		if (!_tmpDir) return;
		try {
			Zotero.debug("Removing " + _tmpDir);
			return IOUtils.remove(_tmpDir, { recursive: true });
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	this.openMainWindow = function () {
		var chromeURI = AppConstants.BROWSER_CHROME_URL;
		var flags = "chrome,all,dialog=no,resizable=yes";
		var ww = Components.classes['@mozilla.org/embedcomp/window-watcher;1']
			.getService(Components.interfaces.nsIWindowWatcher);
		ww.openWindow(null, chromeURI, '_blank', flags, null);
	}
	
	
	this.openCheckForUpdatesWindow = function ({ modal } = {}) {
		let win = Services.wm.getMostRecentWindow('Update:Wizard');
		if (win) {
			win.focus();
		}
		else {
			let flags = 'chrome,centerscreen';
			if (modal) {
				flags += ',modal';
			}
			Services.ww.openWindow(null, 'chrome://zotero/content/update/updates.xhtml',
				'updateChecker', flags, null);
		}
	};
	
	
	/**
	 * Launch a file, the best way we can
	 */
	this.launchFile = function (file) {
		file = Zotero.File.pathToFile(file);
		try {
			Zotero.debug("Launching " + file.path);
			file.launch();
		}
		catch (e) {
			// macOS only: if there's no associated application, launch() will throw, but
			// the OS will show a dialog asking the user to choose an application. We don't
			// want to show the Firefox dialog in that case.
			if (Zotero.isMac && file.exists()) {
				return;
			}
			
			Zotero.debug(e, 2);
			Zotero.debug("launch() not supported -- trying fallback executable", 2);
			
			try {
				if (Zotero.isWin) {
					var pref = "fallbackLauncher.windows";
				}
				else {
					var pref = "fallbackLauncher.unix";
				}
				let launcher = Zotero.Prefs.get(pref);
				this.launchFileWithApplication(file.path, launcher);
			}
			catch (e) {
				Zotero.debug(e);
				Zotero.debug("Launching via executable failed -- passing to loadURI()");
				
				// If nsIFile.launch() isn't available and the fallback
				// executable doesn't exist, we just let the Firefox external
				// helper app window handle it
				var uri = Services.io.newFileURI(file);
				
				var nsIEPS = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
								getService(Components.interfaces.nsIExternalProtocolService);
				nsIEPS.loadURI(
					uri,
					Services.scriptSecurityManager.getSystemPrincipal(),
				);
			}
		}
	};
	
	
	/**
	 * Launch a file with the given application
	 */
	this.launchFileWithApplication = function (filePath, applicationPath) {
		Zotero.debug(`Launching ${filePath} with ${applicationPath}`);
		
		var exec = Zotero.File.pathToFile(applicationPath);
		if (!exec.exists()) {
			throw new Error("'" + applicationPath + "' does not exist");
		}
		
		var args;
		// On macOS, if we only have an .app, launch it using 'open'
		if (Zotero.isMac && applicationPath.endsWith('.app')) {
			args = [filePath, '-a', applicationPath];
			applicationPath = '/usr/bin/open';
		}
		else {
			args = [filePath];
		}
		
		// Async, but we don't want to block
		Zotero.Utilities.Internal.exec(applicationPath, args);
	};
	
	
	/**
	 * Launch a URL externally, the best way we can
	 */
	this.launchURL = function (url) {
		if (!Zotero.Utilities.isHTTPURL(url)) {
			if (Zotero.Utilities.isHTTPURL(url, true)) {
				url = 'http://' + url;
			}
			// Launch non-HTTP URLs
			else {
				let schemeRE = /^([a-z][a-z0-9+.-]+):/;
				let matches = url.match(schemeRE);
				if (!matches) {
					throw new Error(`Invalid URL '${url}'`);
				}
				let scheme = matches[1];
				if (['javascript', 'data', 'chrome', 'resource'].includes(scheme)) {
					throw new Error(`Invalid scheme '${scheme}'`);
				}
				let svc = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
					.getService(Components.interfaces.nsIExternalProtocolService);
				let found = {};
				let handlerInfo = svc.getProtocolHandlerInfoFromOS(scheme, found);
				if (!found.value) {
					throw new Error(`Handler not found for '${scheme}' URLs`);
				}
				svc.loadURI(Services.io.newURI(url, null, null));
				return;
			}
		}
		
		try {
			var uri = Services.io.newURI(url, null, null);
			var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
							.getService(Components.interfaces.nsIExternalProtocolService)
							.getProtocolHandlerInfo('http');
			handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
			handler.launchWithURI(uri, null);
		}
		catch (e) {
			Zotero.debug("launchWithURI() not supported -- trying fallback executable");
			
			if (Zotero.isWin) {
				var pref = "fallbackLauncher.windows";
			}
			else {
				var pref = "fallbackLauncher.unix";
			}
			var path = Zotero.Prefs.get(pref);
			
			let exec = Zotero.File.pathToFile(path);
			if (!exec.exists()) {
				throw new Error("Fallback executable not found -- "
					+ "check extensions.zotero." + pref + " in about:config");
			}
			
			var proc = Components.classes["@mozilla.org/process/util;1"]
							.createInstance(Components.interfaces.nsIProcess);
			proc.init(exec);
			
			var args = [url];
			proc.runw(false, args, args.length);
		}
	}
	
	
	/**
	 * Opens a URL in the basic viewer, and optionally run a callback on load
	 *
	 * @param {String} uri
	 * @param {Object} [options]
	 * @param {Function} [options.onLoad] - Function to run once URI is loaded; passed the loaded document
	 * @param {Object} [options.cookieSandbox] - Attach a cookie sandbox to the browser
	 * @param {Boolean} [options.allowJavaScript] - Set to false to disable JavaScript
	 */
	this.openInViewer = function (uri, options) {
		if (options && !options.onLoad && typeof options === 'function') {
			Zotero.debug("Zotero.openInViewer() now takes an 'options' object for its second parameter -- update your code");
			options = { onLoad: options };
		}

		var viewerWins = Services.wm.getEnumerator("zotero:basicViewer");
		for (let existingWin of viewerWins) {
			if (existingWin.viewerOriginalURI === uri) {
				existingWin.focus();
				return existingWin;
			}
		}
		let ww = Components.classes['@mozilla.org/embedcomp/window-watcher;1']
			.getService(Components.interfaces.nsIWindowWatcher);
		let arg = {
			uri,
			options: {
				...options,
				onLoad: undefined
			}
		};
		arg.wrappedJSObject = arg;
		let win = ww.openWindow(null, "chrome://zotero/content/standalone/basicViewer.xhtml",
			null, "chrome,dialog=yes,resizable,centerscreen,menubar,scrollbars", arg);
		if (options?.onLoad) {
			let browser;
			let func = function () {
				win.removeEventListener("load", func);
				// <browser> is created in basicViewer.js in a window load event, so we have to
				// wait for that
				setTimeout(() => {
					browser = win.document.documentElement.getElementsByTagName('browser')[0];
					browser.addEventListener("pageshow", innerFunc);
				});
			};
			let innerFunc = function () {
				browser.removeEventListener("pageshow", innerFunc);
				options.onLoad(browser.contentDocument);
			};
			win.addEventListener("load", func);
		}
		return win;
	};
	
	
	/*
	 * Debug logging function
	 *
	 * Uses prefs e.z.debug.log and e.z.debug.level (restart required)
	 *
	 * @param {} message
	 * @param {Integer} [level=3]
	 * @param {Integer} [maxDepth]
	 * @param {Boolean|Integer} [stack] Whether to display the calling stack.
	 *   If true, stack is displayed starting from the caller. If an integer,
	 *   that many stack levels will be omitted starting from the caller.
	 */
	function debug(message, level, maxDepth, stack) {
		// Account for this alias
		if (stack === true) {
			stack = 1;
		} else if (stack >= 0) {
			stack++;
		}
		
		Zotero.Debug.log(message, level, maxDepth, stack);
	}
	
	
	/*
	 * Log a message to the Mozilla JS error console
	 *
	 * |type| is a string with one of the flag types in nsIScriptError:
	 *    'error', 'warning', 'exception', 'strict'
	 */
	this.log = function (message, type, sourceName, sourceLine, lineNumber, columnNumber) {
		var scriptError = Components.classes["@mozilla.org/scripterror;1"]
			.createInstance(Components.interfaces.nsIScriptError);
		
		if (!type) {
			type = 'warning';
		}
		var flags = scriptError[type + 'Flag'];
		
		scriptError.init(
			message,
			sourceName ? sourceName : null,
			sourceLine != undefined ? sourceLine : null,
			lineNumber != undefined ? lineNumber : null, 
			columnNumber != undefined ? columnNumber : null,
			flags,
			'system javascript',
			false,
			true
		);
		Services.console.logMessage(scriptError);
	};
	
	/**
	 * Log a JS error to the Mozilla error console and debug output
	 * @param {Exception} err
	 */
	this.logError = function (err) {
		Zotero.debug(err, 1);
		this.log(err.message ? err.message : err.toString(), "error",
			err.fileName ? err.fileName : (err.filename ? err.filename : null), null,
			err.lineNumber ? err.lineNumber : null, null);
	}
	
	
	this.warn = function (err) {
		Zotero.debug(err + "\n\n" + Zotero.Utilities.Internal.filterStack(new Error().stack), 2);
		this.log(err.message ? err.message : err.toString(), "warning",
			err.fileName ? err.fileName : (err.filename ? err.filename : null), null,
			err.lineNumber ? err.lineNumber : null, null);
	}
	
	
	/**
	 * Display an alert in a given window
	 *
	 * @param {Window}
	 * @param {String} title
	 * @param {String} msg
	 */
	this.alert = function (window, title, msg) {
		this.debug(`Alert:\n\n${msg}`);
		Services.prompt.alert(window, title, msg);
	}
	
	
	/**
	 * Display an error message saying that an error has occurred and Zotero needs to be restarted.
	 *
	 * If |popup| is TRUE, display in popup progress window; otherwise, display as items pane message
	 */
	this.crash = function (popup) {
		this.crashed = true;
		
		// Check the database after restart
		Zotero.Schema.setIntegrityCheckRequired(true).catch(e => this.logError(e));
		
		var reportErrorsStr = Zotero.getString('errorReport.reportErrors');
		var reportInstructions = Zotero.getString('errorReport.reportInstructions', reportErrorsStr);
		
		var msg;
		if (popup) {
			msg = Zotero.getString('general.pleaseRestart', Zotero.appName) + ' '
				+ reportInstructions;
		}
		else {
			msg = Zotero.getString('general.errorHasOccurred') + ' '
				+ Zotero.getString('general.pleaseRestart', Zotero.appName) + '\n\n'
				+ reportInstructions;
		}
		Zotero.logError(msg);
		Zotero.logError(new Error().stack);
		
		this.startupError = msg;
		this.startupErrorHandler = null;
		
		var enumerator = Services.wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			let win = enumerator.getNext();
			if (!win.ZoteroPane) continue;
			
			// Display as popup progress window
			if (popup) {
				var pw = new Zotero.ProgressWindow();
				pw.changeHeadline(Zotero.getString('general.errorHasOccurred'));
				pw.addDescription(msg);
				pw.show();
				pw.startCloseTimer(8000);
			}
			// Display as items pane message
			else {
				win.ZoteroPane.setItemsPaneMessage(msg, true);
			}
		}
	};
	
	
	this.getErrors = function (asStrings) {
		var errors = [];
		
		for (let msg of _startupErrors.concat(_recentErrors)) {
			let altMessage;
			// Remove password in malformed XML errors
			if (msg.category == 'malformed-xml') {
				try {
					// msg.message is read-only, so store separately
					altMessage = msg.message.replace(/(https?:\/\/[^:]+:)([^@]+)(@[^"]+)/, "$1****$3");
				}
				catch (e) {}
			}
			
			if (asStrings) {
				errors.push(altMessage || msg.message)
			}
			else {
				errors.push(msg);
			}
		}
		return errors;
	}
	
	
	/**
	 * Get versions, platform, etc.
	 */
	this.getSystemInfo = async function () {
		var info = {
			appName: Services.appinfo.name,
			version: Zotero.version
				+ (!Zotero.isMac && !Services.appinfo.is64Bit ? ' (32-bit)' : ''),
			os: await this.getOSVersion(),
			locale: Zotero.locale,
		};
		
		var extensions = await Zotero.getInstalledExtensions();
		info.extensions = extensions.join(', ');
		
		var str = '';
		for (var key in info) {
			str += key + ' => ' + info[key] + ', ';
		}
		str = str.substr(0, str.length - 2);
		return str;
	};
	
	
	/**
	 * Return OS and OS version
	 *
	 * "macOS 13.3.1"
	 * "Windows 10.0 22000"
	 * "Linux 5.4.0-148-generic #165-Ubuntu SMP Tue Apr 18 08:53:12 UTC 2023"
	 *
	 * @return {String}
	 */
	this.getOSVersion = async function () {
		if (Zotero.isMac) {
			try {
				return "macOS "
					+ (await Zotero.Utilities.Internal.subprocess('/usr/bin/sw_vers', ['-productVersion'])).trim();
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		return (Zotero.isWin ? "Windows" : Services.sysinfo.getProperty("name"))
			+ " " + Services.sysinfo.getProperty("version")
			+ " " + Services.sysinfo.getProperty("build");
	};
	
	
	/**
	 * @return {Promise<String[]>} - Promise for an array of extension names and versions
	 */
	this.getInstalledExtensions = async function () {
		var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
		var installed = await AddonManager.getAllAddons();
	
		installed.sort(function(a, b) {
			return ((a.appDisabled || a.userDisabled) ? 1 : 0) -
				((b.appDisabled || b.userDisabled) ? 1 : 0);
		});
		var addons = [];
		for (let addon of installed) {
			if (addon.type == "theme") {
				continue;
			}
			
			addons.push(addon.name + " (" + addon.version
				+ (addon.type != 2 ? ", " + addon.type : "")
				+ ((addon.appDisabled || addon.userDisabled) ? ", disabled" : "")
				+ ")");
		}
		
		return addons;
	};
	
	this.getString = function (name, params, num) {
		return Zotero.Intl.getString(...arguments);
	}
	
	this.defineProperty = (...args) => Zotero.Utilities.Internal.defineProperty(...args);

	this.extendClass = (...args) => Zotero.Utilities.Internal.extendClass(...args);

	this.getLocaleCollation = function () {
	  return Zotero.Intl.collation;
	}

	this.localeCompare = function (...args) {
		return Zotero.Intl.compare(...args);
	}
	
	function setFontSize(rootElement) {
		return Zotero.Utilities.Internal.setFontSize(rootElement);
	}
	
	function flattenArguments(args){
		return Zotero.Utilities.Internal.flattenArguments(args);
	}
	
	function getAncestorByTagName(elem, tagName){
		return Zotero.Utilities.Internal.getAncestorByTagName(elem, tagName);
	}
	
	this.randomString = function(len, chars) {
		return Zotero.Utilities.randomString(len, chars);
	}
	
	
	this.moveToUnique = function (file, newFile) {
		Zotero.debug("Zotero.moveToUnique() is deprecated -- use Zotero.File.moveToUnique()", 2);
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Move file to unique name
		file.moveTo(newFile.parent, newName);
		return file;
	}
	
	this.lazy = function(fn) {
		return Zotero.Utilities.Internal.lazy(fn);
	}
	
	this.serial = function (fn) {
		return Zotero.Utilities.Internal.serial(fn);
	}
	
	this.spawn = function (generator, thisObject) {
		return Zotero.Utilities.Internal.spawn(generator, thisObject);
	}
	
	/**
	 * Show Zotero pane overlay and progress bar in all windows
	 *
	 * @param {String} msg
	 * @param {Boolean} [determinate=false]
	 * @param {Boolean} [modalOnly=false] - Don't use popup if Zotero pane isn't showing
	 * @return	void
	 */
	this.showZoteroPaneProgressMeter = function (msg, determinate, icon, modalOnly) {
		// If msg is undefined, keep any existing message. If false/null/"", clear.
		// The message is also cleared when the meters are hidden.
		_progressMessage = msg = (msg === undefined ? _progressMessage : msg) || "";
		var currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
		var enumerator = Services.wm.getEnumerator("navigator:browser");
		var progressMeters = [];
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if(!win.ZoteroPane) continue;
			
			var label = win.ZoteroPane.document.getElementById('zotero-pane-progress-label');
			if (!label) {
				Components.utils.reportError("label not found in " + win.document.location.href);
			}
			if (msg) {
				label.hidden = false;
				label.value = msg;
			}
			else {
				label.hidden = true;
			}
			// This is the craziest thing. In Firefox 52.6.0, the very presence of this line
			// causes Zotero on Linux to burn 5% CPU at idle, even if everything below it in
			// the block is commented out. Same if the progressmeter itself is hidden="true".
			// For some reason it also doesn't seem to work to set the progressmeter to
			// 'determined' when hiding, which we're doing in lookup.js. So instead, create a new
			// progressmeter each time and delete it in _hideWindowZoteroPaneOverlay().
			//
			//let progressMeter = win.ZoteroPane.document.getElementById('zotero-pane-progressmeter');
			let doc = win.ZoteroPane.document;
			let container = doc.getElementById('zotero-pane-progressmeter-container');
			let id = 'zotero-pane-progressmeter';
			let progressMeter = doc.getElementById(id);
			if (!progressMeter) {
				progressMeter = doc.createElement('progress');
				progressMeter.id = id;
			}
			if (determinate) {
				progressMeter.setAttribute('value', 0);
				progressMeter.max = 1000;
			}
			else {
				progressMeter.removeAttribute('value');
			}
			container.appendChild(progressMeter);
			
			_showWindowZoteroPaneOverlay(win.ZoteroPane.document);
			win.ZoteroPane.document.getElementById('zotero-pane-overlay-deck').selectedIndex = 0;
			
			progressMeters.push(progressMeter);
		}
		this.locked = true;
		_progressMeters = progressMeters;
	}
	
	
	/**
	 * @param	{Number}	percentage		Percentage complete as integer or float
	 */
	this.updateZoteroPaneProgressMeter = function (percentage) {
		if(percentage !== null) {
			if (percentage < 0 || percentage > 100) {
				Zotero.debug("Invalid percentage value '" + percentage + "' in Zotero.updateZoteroPaneProgressMeter()");
				return;
			}
			percentage = Math.round(percentage * 10);
		}
		if (percentage === _lastPercentage) {
			return;
		}
		for (let pm of _progressMeters) {
			if (percentage !== null) {
				if (!pm.hasAttribute('value')) {
					pm.max = 1000;
				}
				pm.setAttribute('value', percentage);
			}
			else if (pm.hasAttribute('value')) {
				pm.removeAttribute('value');
			}
		}
		_lastPercentage = percentage;
	}
	
	
	/**
	 * Hide Zotero pane overlay in all windows
	 */
	this.hideZoteroPaneOverlays = function () {
		this.locked = false;
		
		var enumerator = Services.wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if(win.ZoteroPane && win.ZoteroPane.document) {
				_hideWindowZoteroPaneOverlay(win.ZoteroPane.document);
			}
		}
		
		if (_progressPopup) {
			_progressPopup.close();
		}
		
		_progressMessage = null;
		_progressMeters = [];
		_progressPopup = null;
		_lastPercentage = null;
	}
	
	
	/**
	 * Adds a listener to be called when Zotero shuts down (even if Firefox is not shut down)
	 */
	this.addShutdownListener = function(listener) {
		_shutdownListeners.push(listener);
	}
	
	function _showWindowZoteroPaneOverlay(doc) {
		doc.getElementById('zotero-collections-tree').disabled = true;
		doc.getElementById('zotero-items-tree').disabled = true;
		doc.getElementById('zotero-pane-overlay').hidden = false;
	}
	
	
	function _hideWindowZoteroPaneOverlay(doc) {
		doc.getElementById('zotero-collections-tree').disabled = false;
		doc.getElementById('zotero-items-tree').disabled = false;
		doc.getElementById('zotero-pane-overlay').hidden = true;
		
		// See note in showZoteroPaneProgressMeter()
		let pm = doc.getElementById('zotero-pane-progressmeter');
		if (pm) {
			pm.parentNode.removeChild(pm);
		}
	}
	
	
	this.updateQuickSearchBox = function (document) {
		var searchBox = document.getElementById('zotero-tb-search');
		if (searchBox) {
			searchBox.updateMode();
		}
	};
	
	
	/*
	 * Clear entries that no longer exist from various tables
	 */
	this.purgeDataObjects = Zotero.Promise.coroutine(function* () {
		var d = new Date();
		
		yield Zotero.DB.executeTransaction(async function () {
			return Zotero.Creators.purge();
		});
		yield Zotero.DB.executeTransaction(async function () {
			return Zotero.Tags.purge();
		});
		yield Zotero.Fulltext.purgeUnusedWords();
		yield Zotero.DB.executeTransaction(async function () {
			return Zotero.Items.purge();
		});
		// DEBUG: this might not need to be permanent
		//yield Zotero.DB.executeTransaction(async function () {
		//	return Zotero.Relations.purge();
		//});
		
		Zotero.debug("Purged data tables in " + (new Date() - d) + " ms");
	});
	
	
	this.reloadDataObjects = function () {
		return Zotero.Promise.all([
			Zotero.Collections.reloadAll(),
			Zotero.Creators.reloadAll(),
			Zotero.Items.reloadAll()
		]);
	}
	
	
	/**
	 * Brings Zotero Standalone to the foreground
	 */
	this.activateStandalone = function() {
		var uri = Services.io.newURI('zotero://select', null, null);
		var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
					.getService(Components.interfaces.nsIExternalProtocolService)
					.getProtocolHandlerInfo('zotero');
		handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
		handler.launchWithURI(uri, null);
	}
	
	/**
	 * Determines whether to keep an error message so that it can (potentially) be reported later
	 */
	function _shouldKeepError(msg) {
		const skip = ['CSS Parser', 'content javascript'];
		
		//Zotero.debug(msg);
		try {
			msg.QueryInterface(Components.interfaces.nsIScriptError);
			//Zotero.debug(msg);
			if (skip.indexOf(msg.category) != -1 || msg.flags & msg.warningFlag) {
				return false;
			}
		}
		catch (e) { }
		
		const blacklist = [
			"No chrome package registered for chrome://communicator",
			'[JavaScript Error: "Components is not defined" {file: "chrome://nightly/content/talkback/talkback.js',
			'[JavaScript Error: "document.getElementById("sanitizeItem")',
			'No chrome package registered for chrome://piggy-bank',
			'[JavaScript Error: "[Exception... "\'Component is not available\' when calling method: [nsIHandlerService::getTypeFromExtension',
			'[JavaScript Error: "this._uiElement is null',
			'Error: a._updateVisibleText is not a function',
			'[JavaScript Error: "Warning: unrecognized command line flag ',
			'LibX:',
			'function skype_',
			'[JavaScript Error: "uncaught exception: Permission denied to call method Location.toString"]',
			'CVE-2009-3555',
			'OpenGL',
			'trying to re-register CID',
			'Services.HealthReport',
			'[JavaScript Error: "this.docShell is null"',
			'[JavaScript Error: "downloadable font:',
			'[JavaScript Error: "Image corrupt or truncated:',
			'[JavaScript Error: "The character encoding of the',
			'nsLivemarkService.js',
			'Sync.Engine.Tabs',
			'content-sessionStore.js',
			'org.mozilla.appSessions',
			'bad script XDR magic number',
			'did not contain an updates property',
		];
		
		for (var i=0; i<blacklist.length; i++) {
			if (msg.message.indexOf(blacklist[i]) != -1) {
				//Zotero.debug("Skipping blacklisted error: " + msg.message);
				return false;
			}
		}
		
		return true;
	}

	/**
	 * Warn if Zotero Standalone is running as root and clobber the cache directory if it is
	 */
	function _checkRoot() {
		var env = Components.classes["@mozilla.org/process/environment;1"].
			getService(Components.interfaces.nsIEnvironment);
		var user = env.get("USER") || env.get("USERNAME");
		if(user === "root") {
			// Show warning
			if(Services.prompt.confirmEx(null, "", Zotero.getString("standalone.rootWarning"),
					Services.prompt.BUTTON_POS_0*Services.prompt.BUTTON_TITLE_IS_STRING |
					Services.prompt.BUTTON_POS_1*Services.prompt.BUTTON_TITLE_IS_STRING,
					Zotero.getString("standalone.rootWarning.exit"),
					Zotero.getString("standalone.rootWarning.continue"),
					null, null, {}) == 0) {
				Components.utils.import("resource://gre/modules/ctypes.jsm");
				var exit = Zotero.IPC.getLibc().declare("exit", ctypes.default_abi,
					                                    ctypes.void_t, ctypes.int);
				// Zap cache files
				try {
					Services.dirsvc.get("ProfLD", Components.interfaces.nsIFile).remove(true);
				} catch(e) {}
				// Exit Zotero without giving XULRunner the opportunity to figure out the
				// cache is missing. Otherwise XULRunner will zap the prefs
				exit(0);
			}
		}
	}
	
	function _checkExecutableLocation() {
		// Make sure Zotero wasn't started from a Mac disk image, which can cause bundled extensions
		// not to load and possibly other problems
		if (Zotero.isMac && OS.Constants.Path.libDir.includes('AppTranslocation')) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING;
			ps.confirmEx(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('startupError.startedFromDiskImage1', Zotero.clientName)
					+ '\n\n'
					+ Zotero.getString('startupError.startedFromDiskImage2', Zotero.clientName),
				buttonFlags,
				Zotero.getString('general.quitApp', Zotero.clientName),
				null, null, null, {}
			);
			Zotero.Utilities.Internal.quit();
			return false;
		}
		
		return true;
	}
	
	/**
	 * Observer for console messages
	 * @namespace
	 */
	var ConsoleListener = {
		"QueryInterface":ChromeUtils.generateQI([Components.interfaces.nsIConsoleMessage,
			Components.interfaces.nsISupports]),
		"observe":function(msg) {
			if(!_shouldKeepError(msg)) return;
			if(_recentErrors.length === ERROR_BUFFER_SIZE) _recentErrors.shift();
			_recentErrors.push(msg);
		}
	};
}).call(Zotero);


/*
 * Handles keyboard shortcut initialization from preferences, optionally
 * overriding existing global shortcuts
 *
 * Actions are configured in ZoteroPane.handleKeyPress()
 */
Zotero.Keys = new function() {
	this.init = init;
	this.windowInit = windowInit;
	this.getCommand = getCommand;
	
	var _keys = {};
	
	
	/*
	 * Called by Zotero.init()
	 */
	function init() {
		var cmds = Zotero.Prefs.rootBranch.getChildList(ZOTERO_CONFIG.PREF_BRANCH + 'keys', {}, {});
		
		// Get the key=>command mappings from the prefs
		for (let cmd of cmds) {
			cmd = cmd.replace(/^extensions\.zotero\.keys\./, '');
			// Remove old pref
			if (cmd == 'overrideGlobal') {
				Zotero.Prefs.clear('keys.overrideGlobal');
				continue;
			}
			_keys[this.getKeyForCommand(cmd)] = cmd;
		}
	}
	
	
	/*
	 * Called by ZoteroPane.onLoad()
	 */
	function windowInit(document) {
		var globalKeys = [
			{
				name: 'saveToZotero',
				defaultKey: 'S'
			}
		];
		
		globalKeys.forEach(function (x) {
			let keyElem = document.getElementById('key_' + x.name);
			if (keyElem) {
				let prefKey = this.getKeyForCommand(x.name);
				// Only override the default with the pref if the <key> hasn't
				// been manually changed and the pref has been
				if (keyElem.getAttribute('key') == x.defaultKey
						&& keyElem.getAttribute('modifiers') == 'accel shift'
						&& prefKey != x.defaultKey) {
					keyElem.setAttribute('key', prefKey);
				}
			}
		}.bind(this));
	}
	
	
	function getCommand(key) {
		key = key.toUpperCase();
		return _keys[key] ? _keys[key] : false;
	}
	
	
	this.getKeyForCommand = function (cmd) {
		try {
			var key = Zotero.Prefs.get('keys.' + cmd);
		}
		catch (e) {}
		return key !== undefined ? key.toUpperCase() : false;
	}
}


/**
 * Identify client when connecting to first-party domains
 *
 * @namespace
 */
Zotero.VersionHeader = {
	init: function () {
		this.register();
		Zotero.addShutdownListener(this.unregister);
	},
	
	register: function () {
		Services.obs.addObserver(this, "http-on-modify-request", false);
	},
	
	observe: function (subject, topic, data) {
		try {
			let channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
			let domain = channel.URI.host;
			// Add X-Zotero-Version header to HTTP requests to zotero.org
			let isPrimaryDomain = domain == ZOTERO_CONFIG.DOMAIN_NAME
				|| domain.endsWith('.' + ZOTERO_CONFIG.DOMAIN_NAME);
			if (isPrimaryDomain) {
				channel.setRequestHeader("X-Zotero-Version", Zotero.version, false);
			}
			else {
				// Use "Firefox/[version]" in user agent if not a proxy check or file sync request
				let s3RE = /(zoteroproxycheck|zoterofilestorage(test)?)\.s3\.(us-east-1\.)?amazonaws\.com/;
				let isAppNameDomain = s3RE.test(domain);
				if (!isAppNameDomain) {
					let ua = channel.getRequestHeader('User-Agent');
					ua = this.update(ua);
					channel.setRequestHeader('User-Agent', ua, false);
				}
			}
		}
		catch (e) {
			Zotero.debug(e, 1);
		}
	},
	
	/**
	 * Replace Zotero/[version] with Firefox/[version] in the default user agent
	 *
	 * @param {String} ua - User Agent
	 * @param {String} [testAppName] - App name to look for (necessary in tests, which are
	 *     currently run in Firefox)
	 */
	update: function (ua, testAppName) {
		var info = Services.appinfo;
		var appName = testAppName || info.name;
		
		var pos = ua.indexOf(appName + '/');
		var appPart = ua.substr(pos);
		
		// Default UA (not a faked UA from the connector
		if (pos != -1) {
			ua = ua.slice(0, pos) + `Firefox/${info.platformVersion.match(/^\d+/)[0]}.0`;
			// To fix cloudflare bot detection. rv frozen to avoid some websites
			// detecting us as IE11. See https://bugzilla.mozilla.org/show_bug.cgi?id=1806690
			// For some reason we are note getting this from the Firefox base.
			ua = ua.replace('rv:115', 'rv:109');
		}
		
		return ua;
	},
	
	unregister: function () {
		Services.obs.removeObserver(Zotero.VersionHeader, "http-on-modify-request");
	}
}

Zotero.DragDrop = {
	currentEvent: null,
	currentOrientation: 0,
	
	getDataFromDataTransfer: function (dataTransfer, firstOnly) {
		var dt = dataTransfer;
		
		var dragData = {
			dataType: '',
			data: [],
			dropEffect: dt.dropEffect
		};
		
		var len = firstOnly ? 1 : dt.mozItemCount;
		
		if (dt.types.contains('zotero/collection')) {
			dragData.dataType = 'zotero/collection';
			let ids = dt.getData('zotero/collection').split(",").map(id => parseInt(id));
			dragData.data = ids;
		}
		else if (dt.types.contains('zotero/item')) {
			dragData.dataType = 'zotero/item';
			let ids = dt.getData('zotero/item').split(",").map(id => parseInt(id));
			dragData.data = ids;
		}
		else {
			if (dt.types.contains('application/x-moz-file')) {
				dragData.dataType = 'application/x-moz-file';
				var files = [];
				for (var i=0; i<len; i++) {
					var file = dt.mozGetDataAt("application/x-moz-file", i);
					if (!file) {
						continue;
					}
					file.QueryInterface(Components.interfaces.nsIFile);
					// Don't allow folder drag
					if (file.isDirectory()) {
						continue;
					}
					files.push(file);
				}
				dragData.data = files;
			}
			// This isn't an else because on Linux a link drag contains an empty application/x-moz-file too
			if (!dragData.data || !dragData.data.length) {
				if (dt.types.contains('text/x-moz-url')) {
					dragData.dataType = 'text/x-moz-url';
					var urls = [];
					for (var i=0; i<len; i++) {
						var url = dt.getData("text/x-moz-url").split("\n")[0];
						urls.push(url);
					}
					dragData.data = urls;
				}
			}
		}
		
		return dragData;
	},
	
	
	getDragSource: function () {
		return this.currentDragSource;
	},
	
	
	getDragTarget: function (event) {
		var target = event.target;
		if (target.tagName == 'treechildren') {
			var tree = target.parentNode;
			if (tree.id == 'zotero-collections-tree') {
				let { row } = tree.getCellAt(event.clientX, event.clientY);
				let win = tree.ownerDocument.defaultView;
				return win.ZoteroPane.collectionsView.getRow(row);
			}
		}
		return false;
	}
}


/*
 * Implements nsIWebProgressListener
 */
Zotero.WebProgressFinishListener = function(onFinish) {
	var _request;
	var _finished = false;
	
	this.getRequest = function () {
		return _request;
	};
	
	this.onStateChange = function(wp, req, stateFlags, status) {
		//Zotero.debug('onStateChange: ' + stateFlags);
		if (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP
				&& stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK
				&& !(stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_REQUEST)) {
			if (_finished) {
				return;
			}
			
			// Get status code and content ype
			let status = null;
			let contentType = null;
			try {
				let r = _request || req;
				if (!r) {
					Zotero.debug("WebProgressFinishListener: finished without a valid request")
				} else {
					r.QueryInterface(Components.interfaces.nsIHttpChannel);
					status = r.responseStatus;
					contentType = r.contentType;
				}
			}
			catch (e) {
				Zotero.debug(e, 2);
			}
			
			_request = null;
			onFinish({ status, contentType });
			_finished = true;
		}
		else {
			_request = req;
		}
	}
	
	this.onProgressChange = function(wp, req, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
		//Zotero.debug('onProgressChange');
		//Zotero.debug('Current: ' + curTotalProgress);
		//Zotero.debug('Max: ' + maxTotalProgress);
	}
	
	this.onLocationChange = function(wp, req, location) {}
	this.onSecurityChange = function(wp, req, stateFlags, status) {}
	this.onStatusChange = function(wp, req, status, msg) {}
}

/*
 * Saves or loads JSON objects.
 */
Zotero.JSON = new function() {
	this.serialize = function(arg) {
		Zotero.debug("WARNING: Zotero.JSON.serialize() is deprecated; use JSON.stringify()");
		return JSON.stringify(arg);
	}
	
	this.unserialize = function(arg) {
		Zotero.debug("WARNING: Zotero.JSON.unserialize() is deprecated; use JSON.parse()");
		return JSON.parse(arg);
	}
}
