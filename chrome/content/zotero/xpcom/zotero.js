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
Components.utils.import("resource://zotero/config.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

Services.scriptloader.loadSubScript("resource://zotero/polyfill.js");

/*
 * Core functions
 */
 (function(){
	// Privileged (public) methods
	this.getStorageDirectory = getStorageDirectory;
	this.debug = debug;
	this.log = log;
	this.logError = logError;
	this.getErrors = getErrors;
	this.localeJoin = localeJoin;
	this.setFontSize = setFontSize;
	this.flattenArguments = flattenArguments;
	this.getAncestorByTagName = getAncestorByTagName;
	this.randomString = randomString;
	this.moveToUnique = moveToUnique;
	this.reinit = reinit; // defined in zotero-service.js
	
	// Public properties
	this.initialized = false;
	this.skipLoading = false;
	this.startupError;
	this.__defineGetter__("startupErrorHandler", function() { return _startupErrorHandler; });
	this.version;
	this.platform;
	this.locale;
	this.dir; // locale direction: 'ltr' or 'rtl'
	this.isMac;
	this.isWin;
	this.initialURL; // used by Schema to show the changelog on upgrades
	
	Components.utils.import("resource://zotero/bluebird.js", this);
	
	this.getActiveZoteroPane = function() {
		var win = Services.wm.getMostRecentWindow("navigator:browser");
		return win ? win.ZoteroPane : null;
	};
	
	/**
	 * @property	{Boolean}	locked		Whether all Zotero panes are locked
	 *										with an overlay
	 */
	this.__defineGetter__('locked', function () { return _locked; });
	this.__defineSetter__('locked', function (lock) {
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
	});
	
	/**
	 * @property	{Boolean}	closing		True if the application is closing.
	 */
	this.closing = false;
	
	
	this.unlockDeferred;
	this.unlockPromise;
	this.initializationDeferred;
	this.initializationPromise;
	this.objectInitializationDeferred;
	this.objectInitializationPromise;
	
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
	this.init = Zotero.Promise.coroutine(function* (options) {
		if (this.initialized || this.skipLoading) {
			return false;
		}
		
		this.locked = true;
		this.initializationDeferred = Zotero.Promise.defer();
		this.initializationPromise = this.initializationDeferred.promise;
		this.uiReadyDeferred = Zotero.Promise.defer();
		this.uiReadyPromise = this.uiReadyDeferred.promise;
		
		// Add a function to Zotero.Promise to check whether a value is still defined, and if not
		// to throw a specific error that's ignored by the unhandled rejection handler in
		// bluebird.js. This allows for easily cancelling promises when they're no longer
		// needed, for example after a binding is destroyed.
		//
		// Example usage:
		//
		// getAsync.tap(() => Zotero.Promise.check(this.mode))
		//
		// If the binding is destroyed while getAsync() is being resolved and this.mode no longer
		// exists, subsequent lines won't be run, and nothing will be logged to the console.
		this.Promise.check = function (val) {
			if (!val && val !== 0) {
				let e = new Error;
				e.name = "ZoteroPromiseInterrupt";
				throw e;
			}
		};
		
		if (options) {
			let opts = [
				'openPane',
				'test',
				'automatedTest',
				'skipBundledFiles'
			];
			opts.filter(opt => options[opt]).forEach(opt => this[opt] = true);
		}
		
		this.mainThread = Services.tm.mainThread;
		
		this.clientName = ZOTERO_CONFIG.CLIENT_NAME;
		
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo);
		this.platformVersion = appInfo.platformVersion;
		this.platformMajorVersion = parseInt(appInfo.platformVersion.match(/^[0-9]+/)[0]);
		this.isFx = true;
		this.isClient = true;
		this.isStandalone = Services.appinfo.ID == ZOTERO_CONFIG['GUID'];
		
		if (Zotero.isStandalone) {
			var version = Services.appinfo.version;
		}
		else {
			let deferred = Zotero.Promise.defer();
			Components.utils.import("resource://gre/modules/AddonManager.jsm");
			AddonManager.getAddonByID(
				ZOTERO_CONFIG.GUID,
				function (addon) {
					deferred.resolve(addon.version);
				}
			);
			var version = yield deferred.promise;
		}
		Zotero.version = version;
		
		// OS platform
		var win = Components.classes["@mozilla.org/appshell/appShellService;1"]
			   .getService(Components.interfaces.nsIAppShellService)
			   .hiddenDOMWindow;
		this.platform = win.navigator.platform;
		this.isMac = (this.platform.substr(0, 3) == "Mac");
		this.isWin = (this.platform.substr(0, 3) == "Win");
		this.isLinux = (this.platform.substr(0, 5) == "Linux");
		this.oscpu = win.navigator.oscpu;
		
		// Browser
		Zotero.browser = "g";
		
		// Locale
		var uaPrefs = Services.prefs.getBranch("general.useragent.");
		try {
			this.locale = uaPrefs.getComplexValue("locale", Components.interfaces.nsIPrefLocalizedString);
		} catch (e) {}
		
		if(this.locale) {
			this.locale = this.locale.toString();
		} else {
			this.locale = uaPrefs.getCharPref("locale");
		}
		
		if (this.locale.length == 2) {
			this.locale = this.locale + '-' + this.locale.toUpperCase();
		}
		
		// Load in the localization stringbundle for use by getString(name)
		var appLocale = Services.locale.getApplicationLocale();
		
		_localizedStringBundle = Services.strings.createBundle(
			"chrome://zotero/locale/zotero.properties", appLocale);
		// Fix logged error in PluralForm.jsm when numForms() is called before get(), as it is in
		// getString() when a number is based
		PluralForm.get(1, '1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16')
		
		// Also load the brand as appName
		var brandBundle = Services.strings.createBundle(
			"chrome://branding/locale/brand.properties", appLocale);
		this.appName = brandBundle.GetStringFromName("brandShortName");
		
		// Set the locale direction to Zotero.dir
		// DEBUG: is there a better way to get the entity from JS?
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		xmlhttp.open('GET', 'chrome://global/locale/global.dtd', false);
		xmlhttp.overrideMimeType('text/plain');
		xmlhttp.send(null);
		var matches = xmlhttp.responseText.match(/(ltr|rtl)/);
		if (matches && matches[0] == 'rtl') {
			Zotero.dir = 'rtl';
		}
		else {
			Zotero.dir = 'ltr';
		}
		Zotero.rtl = Zotero.dir == 'rtl';
		
		Zotero.Prefs.init();
		Zotero.Debug.init(options && options.forceDebugLog);
		
		// Make sure that Zotero Standalone is not running as root
		if(Zotero.isStandalone && !Zotero.isWin) _checkRoot();
		
		_addToolbarIcon();
		
		try {
			yield Zotero.DataDirectory.init();
			var dataDir = Zotero.DataDirectory.dir;
		}
		catch (e) {
			// Zotero dir not found
			if (e.name == 'NS_ERROR_FILE_NOT_FOUND') {
				Zotero.startupError = Zotero.getString('dataDir.notFound');
				_startupErrorHandler = function() {
					var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
							createInstance(Components.interfaces.nsIPromptService);
					var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_OK)
						+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
						+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
					// TEMP: lastDataDir can be removed once old persistent descriptors have been
					// converted, which they are in getZoteroDirectory() in 5.0
					var previousDir = Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir');
					var index = ps.confirmEx(null,
						Zotero.getString('general.error'),
						Zotero.startupError + '\n\n' +
						Zotero.getString('dataDir.previousDir') + ' ' + previousDir,
						buttonFlags, null,
						Zotero.getString('dataDir.useDefaultLocation'),
						Zotero.getString('general.locate'),
						null, {});
					
					// Revert to home directory
					if (index == 1) {
						Zotero.DataDirectory.choose(false, true);
					}
					// Locate data directory
					else if (index == 2) {
						Zotero.DataDirectory.choose();
					}
				}
				return;
			}
			// DEBUG: handle more startup errors
			else {
				throw e;
			}
		}
		
		if (!Zotero.isConnector) {
			yield Zotero.DataDirectory.checkForMigration(
				dataDir, Zotero.DataDirectory.defaultDir
			);
			if (this.skipLoading) {
				return;
			}
			
			// Make sure data directory isn't in Dropbox, etc.
			if (Zotero.isStandalone) {
				yield Zotero.DataDirectory.checkForUnsafeLocation(dataDir);
			}
		}
		
		// Register shutdown handler to call Zotero.shutdown()
		var _shutdownObserver = {observe:function() { Zotero.shutdown().done() }};
		Services.obs.addObserver(_shutdownObserver, "quit-application", false);
		
		try {
			Zotero.IPC.init();
		}
		catch (e) {
			if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
				var msg = Zotero.localeJoin([
					Zotero.getString('startupError.databaseCannotBeOpened'),
					Zotero.getString('startupError.checkPermissions')
				]);
				Zotero.startupError = msg;
				Zotero.logError(e);
				return false;
			}
			throw (e);
		}
		
		// Get startup errors
		try {
			var messages = {};
			Services.console.getMessageArray(messages, {});
			_startupErrors = Object.keys(messages.value).map(i => messages[i])
				.filter(msg => _shouldKeepError(msg));
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
		
		// Load additional info for connector or not
		if(Zotero.isConnector) {
			Zotero.debug("Loading in connector mode");
			Zotero.Connector_Types.init();
			
			// Store a startupError until we get information from Zotero Standalone
			Zotero.startupError = Zotero.getString("connector.loadInProgress")
			
			if(!Zotero.isFirstLoadThisSession) {
				// We want to get a checkInitComplete message before initializing if we switched to
				// connector mode because Standalone was launched
				Zotero.IPC.broadcast("checkInitComplete");
			} else {
				Zotero.initComplete();
			}
		} else {
			Zotero.debug("Loading in full mode");
			return _initFull()
			.then(function (success) {
				if (!success) {
					return false;
				}
				
				if(Zotero.isStandalone) Zotero.Standalone.init();
				Zotero.initComplete();
			})
		}
		
		return true;
	});
	
	/**
	 * Triggers events when initialization finishes
	 */
	this.initComplete = function() {
		if(Zotero.initialized) return;
		
		Zotero.debug("Running initialization callbacks");
		delete this.startupError;
		this.initialized = true;
		this.initializationDeferred.resolve();
		
		if(Zotero.isConnector) {
			Zotero.Repo.init();
			Zotero.locked = false;
		}
		
		if(!Zotero.isFirstLoadThisSession) {
			// trigger zotero-reloaded event
			Zotero.debug('Triggering "zotero-reloaded" event');
			Services.obs.notifyObservers(Zotero, "zotero-reloaded", null);
		}
		
		Zotero.debug('Triggering "zotero-loaded" event');
		Services.obs.notifyObservers(Zotero, "zotero-loaded", null);
	}
	
	
	this.uiIsReady = function () {
		if (this.uiReadyPromise.isPending()) {
			Zotero.debug("User interface ready in " + (new Date() - _startupTime) + " ms");
			this.uiReadyDeferred.resolve();
		}
	};
	
	
	var _addToolbarIcon = function () {
		if (Zotero.isStandalone) return;
		
		// Add toolbar icon
		try {
			Services.scriptloader.loadSubScript("chrome://zotero/content/icon.js", {}, "UTF-8");
		}
		catch (e) {
			if (Zotero) {
				Zotero.debug(e, 1);
			}
			Components.utils.reportError(e);
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
				// TODO: better error handling
				
				// TODO: prompt for location
				// TODO: Back up database
				
				
				var dbfile = Zotero.DataDirectory.getDatabase();
				yield OS.File.remove(dbfile, {ignoreAbsent: true});
				
				if (Zotero.restoreFromServer) {
					yield OS.File.remove(restoreFile);
					Zotero.restoreFromServer = true;
				} else if (Zotero.resetDataDir) {
					Zotero.initAutoSync = true;
					var storageDir = OS.Path.join(dataDir, 'storage');
					yield Zotero.Promise.all([
						OS.File.removeDir(storageDir, {ignoreAbsent: true}), 
						OS.File.remove(resetDataDirFile)
					]);
				}
				
				// Recreate database with no quick start guide
				Zotero.Schema.skipDefaultData = true;
				yield Zotero.Schema.updateSchema();
				
			}
			catch (e) {
				// Restore from backup?
				alert(e);
				return false;
			}
		}
		
		Zotero.HTTP.triggerProxyAuth();
		
		// Add notifier queue callbacks to the DB layer
		Zotero.DB.addCallback('begin', function () { return Zotero.Notifier.begin(); });
		Zotero.DB.addCallback('commit', function () { return Zotero.Notifier.commit(); });
		Zotero.DB.addCallback('rollback', function () { return Zotero.Notifier.reset(); });
		
		try {
			// Require >=2.1b3 database to ensure proper locking
			if (Zotero.isStandalone) {
				let dbSystemVersion = yield Zotero.Schema.getDBVersion('system');
				if (dbSystemVersion > 0 && dbSystemVersion < 31) {
					var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.createInstance(Components.interfaces.nsIPromptService);
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
						Zotero.getString('dataDir.standaloneMigration.selectCustom'),
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
			}
			
			try {
				var updated = yield Zotero.Schema.updateSchema({
					onBeforeUpdate: () => {
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
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Components.interfaces.nsIPromptService);
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
							+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
							+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
							+ ps.BUTTON_POS_0_DEFAULT;
						
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.error'),
							Zotero.startupError,
							buttonFlags,
							Zotero.getString('general.checkForUpdate'),
							null,
							Zotero.getString('general.moreInformation'),
							null,
							{}
						);
						
						// "Check for Update" button
						if(index === 0) {
							if(Zotero.isStandalone) {
								Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
									.getService(Components.interfaces.nsIWindowWatcher)
									.openWindow(null, 'chrome://mozapps/content/update/updates.xul',
										'updateChecker', 'chrome,centerscreen,modal', null);
							} else {
								// In Firefox, show the add-on manager
								Components.utils.import("resource://gre/modules/AddonManager.jsm");
								AddonManager.getAddonByID(ZOTERO_CONFIG['GUID'],
									function (addon) {
										// Disable auto-update so that the user is presented with the option
										var initUpdateState = addon.applyBackgroundUpdates;
										addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
										addon.findUpdates({
												onNoUpdateAvailable: function() {
													ps.alert(
														null,
														Zotero.getString('general.noUpdatesFound'),
														Zotero.getString('general.isUpToDate', 'Zotero')
													);
												},
												onUpdateAvailable: function() {
													// Show available update
													Components.classes["@mozilla.org/appshell/window-mediator;1"]
														.getService(Components.interfaces.nsIWindowMediator)
														.getMostRecentWindow('navigator:browser')
														.BrowserOpenAddonsMgr('addons://updates/available');
												},
												onUpdateFinished: function() {
													// Restore add-on auto-update state, but don't fire
													//  too quickly or the update will not show in the
													//  add-on manager
													setTimeout(function() {
															addon.applyBackgroundUpdates = initUpdateState;
													}, 1000);
												}
											},
											AddonManager.UPDATE_WHEN_USER_REQUESTED
										);
									}
								);
							}
						}
						// Load More Info page
						else if (index == 2) {
							let io = Components.classes['@mozilla.org/network/io-service;1']
								.getService(Components.interfaces.nsIIOService);
							let uri = io.newURI(kbURL, null, null);
							let handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
								.getService(Components.interfaces.nsIExternalProtocolService)
								.getProtocolHandlerInfo('http');
							handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
							handler.launchWithURI(uri, null);
						}
					};
					throw e;
				}
				
				Zotero.startupError = Zotero.getString('startupError.databaseUpgradeError') + "\n\n"
					+ (e.stack || e);
				throw e;
			}
			
			yield Zotero.Users.init();
			yield Zotero.Libraries.init();
			
			yield Zotero.ItemTypes.init();
			yield Zotero.ItemFields.init();
			yield Zotero.CreatorTypes.init();
			yield Zotero.FileTypes.init();
			yield Zotero.CharacterSets.init();
			yield Zotero.RelationPredicates.init();
			
			Zotero.locked = false;
			
			// Initialize various services
			Zotero.Integration.init();
			
			if(Zotero.Prefs.get("httpServer.enabled")) {
				Zotero.Server.init();
			}
			
			yield Zotero.Fulltext.init();
			
			Zotero.Notifier.registerObserver(Zotero.Tags, 'setting', 'tags');
			
			yield Zotero.Sync.Data.Local.init();
			yield Zotero.Sync.Data.Utilities.init();
			Zotero.Sync.Runner = new Zotero.Sync.Runner_Module;
			Zotero.Sync.Streamer = new Zotero.Sync.Streamer_Module;
			Zotero.Sync.EventListeners.init();
			
			Zotero.MIMETypeHandler.init();
			yield Zotero.Proxies.init();
			
			// Initialize keyboard shortcuts
			Zotero.Keys.init();
			
			yield Zotero.Date.init();
			Zotero.LocateManager.init();
			yield Zotero.ID.init();
			yield Zotero.Collections.init();
			yield Zotero.Items.init();
			yield Zotero.Searches.init();
			yield Zotero.Tags.init();
			yield Zotero.Creators.init();
			yield Zotero.Groups.init();
			yield Zotero.Relations.init();
			
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

			
			Zotero.Items.startEmptyTrashTimer();
			
			yield Zotero.QuickCopy.init();
			Zotero.addShutdownListener(() => Zotero.QuickCopy.uninit());
			
			Zotero.Feeds.init();
			Zotero.addShutdownListener(() => Zotero.Feeds.uninit());
			
			return true;
		}
		catch (e) {
			Zotero.logError(e);
			if (!Zotero.startupError) {
				Zotero.startupError = Zotero.getString('startupError') + "\n\n" + (e.stack || e);
			}
			return false;
		}
	});
	
	/**
	 * Initializes the DB connection
	 */
	var _initDB = Zotero.Promise.coroutine(function* (haveReleasedLock) {
		try {
			// Test read access
			yield Zotero.DB.test();
			
			let dbfile = Zotero.DataDirectory.getDatabase();

			// Tell any other Zotero instances to release their lock,
			// in case we lost the lock on the database (how?) and it's
			// now open in two places at once
			Zotero.IPC.broadcast("releaseLock " + dbfile);
			
			// Test write access on Zotero data directory
			if (!Zotero.File.pathToFile(OS.Path.dirname(dbfile)).isWritable()) {
				var msg = 'Cannot write to ' + OS.Path.dirname(dbfile) + '/';
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
			if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
				var msg = Zotero.localeJoin([
					Zotero.getString('startupError.databaseCannotBeOpened'),
					Zotero.getString('startupError.checkPermissions')
				]);
				Zotero.startupError = msg;
			}
			// Storage busy
			else if (e.message.endsWith('2153971713')) {
				Zotero.startupError = Zotero.getString('startupError.databaseInUse') + "\n\n"
					+ Zotero.getString(
						"startupError.close" + (Zotero.isStandalone ? 'Firefox' : 'Standalone')
					);
			} else {
				Zotero.startupError = Zotero.getString('startupError') + "\n\n" + (e.stack || e);
			}
			
			Zotero.debug(e.toString(), 1);
			Components.utils.reportError(e); // DEBUG: doesn't always work
			Zotero.skipLoading = true;
			return false;
		}
		
		return true;
	});
	
	/**
	 * Called when the DB has been released by another Zotero process to perform necessary 
	 * initialization steps
	 */
	this.onDBLockReleased = function() {
		if(Zotero.isConnector) {
			// if DB lock is released, switch out of connector mode
			switchConnectorMode(false);
		} else if(_waitingForDBLock) {
			// if waiting for DB lock and we get it, continue init
			_waitingForDBLock = false;
		}
	}
	
	this.shutdown = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Shutting down Zotero");
		
		try {
			// set closing to true
			Zotero.closing = true;
			
			// run shutdown listener
			for (let listener of _shutdownListeners) {
				try {
					listener();
				} catch(e) {
					Zotero.logError(e);
				}
			}
			
			// remove temp directory
			Zotero.removeTempDirectory();
			
			if (Zotero.DB) {
				// close DB
				yield Zotero.DB.closeDatabase(true)
				
				if (!Zotero.restarting) {
					// broadcast that DB lock has been released
					Zotero.IPC.broadcast("lockReleased");
				}
			}
		} catch(e) {
			Zotero.logError(e);
			throw e;
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
	
	
	function getStorageDirectory(){
		var file = OS.Path.join(Zotero.DataDirectory.dir, 'storage');
		file = Zotero.File.pathToFile(file);
		Zotero.File.createDirectoryIfMissing(file);
		return file;
	}
	
	
	this.getZoteroDatabase = function (name, ext) {
		Zotero.warn("Zotero.getZoteroDatabase() is deprecated -- use Zotero.DataDirectory.getDatabase()");
		return Zotero.File.pathToFile(Zotero.DataDirectory.getDatabase(name, ext));
	}
	
	
	/**
	 * @return	{nsIFile}
	 */
	this.getTempDirectory = function () {
		var tmp = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
		tmp.append('tmp');
		Zotero.File.createDirectoryIfMissing(tmp);
		return tmp;
	}
	
	
	this.removeTempDirectory = function () {
		var tmp = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
		tmp.append('tmp');
		if (tmp.exists()) {
			try {
				tmp.remove(true);
			}
			catch (e) {}
		}
	}
	
	
	this.getStylesDirectory = function () {
		var dir = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
		dir.append('styles');
		Zotero.File.createDirectoryIfMissing(dir);
		return dir;
	}
	
	
	this.getTranslatorsDirectory = function () {
		var dir = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
		dir.append('translators');
		Zotero.File.createDirectoryIfMissing(dir);
		return dir;
	}
	
	
	/**
	 * Launch a file, the best way we can
	 */
	this.launchFile = function (file) {
		file = Zotero.File.pathToFile(file);
		try {
			file.launch();
		}
		catch (e) {
			Zotero.debug(e, 2);
			Zotero.debug("launch() not supported -- trying fallback executable", 2);
			
			try {
				if (Zotero.isWin) {
					var pref = "fallbackLauncher.windows";
				}
				else {
					var pref = "fallbackLauncher.unix";
				}
				var path = Zotero.Prefs.get(pref);
				
				var exec = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
				exec.initWithPath(path);
				if (!exec.exists()) {
					throw (path + " does not exist");
				}
				
				var proc = Components.classes["@mozilla.org/process/util;1"]
								.createInstance(Components.interfaces.nsIProcess);
				proc.init(exec);
				
				var args = [file.path];
				proc.runw(true, args, args.length);
			}
			catch (e) {
				Zotero.debug(e);
				Zotero.debug("Launching via executable failed -- passing to loadUrl()");
				
				// If nsILocalFile.launch() isn't available and the fallback
				// executable doesn't exist, we just let the Firefox external
				// helper app window handle it
				var nsIFPH = Components.classes["@mozilla.org/network/protocol;1?name=file"]
								.getService(Components.interfaces.nsIFileProtocolHandler);
				var uri = nsIFPH.newFileURI(file);
				
				var nsIEPS = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
								getService(Components.interfaces.nsIExternalProtocolService);
				nsIEPS.loadUrl(uri);
			}
		}
	}
	
	
	/**
	 * Opens a URL in the basic viewer, and optionally run a callback on load
	 *
	 * @param {String} uri
	 * @param {Function} [onLoad] - Function to run once URI is loaded; passed the loaded document
	 */
	this.openInViewer = function (uri, onLoad) {
		var wm = Services.wm;
		var win = wm.getMostRecentWindow("zotero:basicViewer");
		if (win) {
			win.loadURI(uri);
		} else {
			let window = wm.getMostRecentWindow("navigator:browser");
			win = window.openDialog("chrome://zotero/content/standalone/basicViewer.xul",
				"basicViewer", "chrome,resizable,centerscreen,menubar,scrollbars", uri);
		}
		if (onLoad) {
			let browser
			let func = function () {
				win.removeEventListener("load", func);
				browser = win.document.documentElement.getElementsByTagName('browser')[0];
				browser.addEventListener("pageshow", innerFunc);
			};
			let innerFunc = function () {
				browser.removeEventListener("pageshow", innerFunc);
				onLoad(browser.contentDocument);
			};
			win.addEventListener("load", func);
		}
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
	function log(message, type, sourceName, sourceLine, lineNumber, columnNumber) {
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
			'component javascript'
		);
		Services.console.logMessage(scriptError);
	}
	
	/**
	 * Log a JS error to the Mozilla error console and debug output
	 * @param {Exception} err
	 */
	function logError(err) {
		Zotero.debug(err, 1);
		log(err.message ? err.message : err.toString(), "error",
			err.fileName ? err.fileName : (err.filename ? err.filename : null), null,
			err.lineNumber ? err.lineNumber : null, null);
	}
	
	
	this.warn = function (err) {
		Zotero.debug(err, 2);
		log(err.message ? err.message : err.toString(), "warning",
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		ps.alert(window, title, msg);
	}
	
	
	function getErrors(asStrings) {
		var errors = [];
		
		for (let msg of _startupErrors.concat(_recentErrors)) {
			// Remove password in malformed XML messages
			if (msg.category == 'malformed-xml') {
				try {
					// msg.message is read-only, so store separately
					var altMessage = msg.message.replace(/(file: "https?:\/\/[^:]+:)([^@]+)(@[^"]+")/, "$1********$3");
				}
				catch (e) {}
			}
			
			if (asStrings) {
				errors.push(altMessage ? altMessage : msg.message)
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
	this.getSystemInfo = Zotero.Promise.coroutine(function* () {
		var info = {
			version: Zotero.version,
			platform: Zotero.platform,
			oscpu: Zotero.oscpu,
			locale: Zotero.locale,
			appName: Services.appinfo.name,
			appVersion: Services.appinfo.version
		};
		
		var extensions = yield Zotero.getInstalledExtensions();
		info.extensions = extensions.join(', ');
		
		var str = '';
		for (var key in info) {
			str += key + ' => ' + info[key] + ', ';
		}
		str = str.substr(0, str.length - 2);
		return str;
	});
	
	
	/**
	 * @return {Promise<String[]>} - Promise for an array of extension names and versions
	 */
	this.getInstalledExtensions = Zotero.Promise.method(function () {
		var deferred = Zotero.Promise.defer();
		function onHaveInstalledAddons(installed) {
			installed.sort(function(a, b) {
				return ((a.appDisabled || a.userDisabled) ? 1 : 0) -
					((b.appDisabled || b.userDisabled) ? 1 : 0);
			});
			var addons = [];
			for (let addon of installed) {
				switch (addon.id) {
					case "zotero@chnm.gmu.edu":
					case "{972ce4c6-7e08-4474-a285-3208198ce6fd}": // Default theme
						continue;
				}
				
				addons.push(addon.name + " (" + addon.version
					+ (addon.type != 2 ? ", " + addon.type : "")
					+ ((addon.appDisabled || addon.userDisabled) ? ", disabled" : "")
					+ ")");
			}
			deferred.resolve(addons);
		}
		
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		AddonManager.getAllAddons(onHaveInstalledAddons);
		return deferred.promise;
	});
	
	/**
	 * @param {String} name
	 * @param {String[]} [params=[]] - Strings to substitute for placeholders
	 * @param {Number} [num] - Number (also appearing in `params`) to use when determining which plural
	 *     form of the string to use; localized strings should include all forms in the order specified
	 *     in https://developer.mozilla.org/en-US/docs/Mozilla/Localization/Localization_and_Plurals,
	 *     separated by semicolons
	 */
	this.getString = function (name, params, num) {
		try {
			if (params != undefined) {
				if (typeof params != 'object'){
					params = [params];
				}
				var l10n = _localizedStringBundle.formatStringFromName(name, params, params.length);
			}
			else {
				var l10n = _localizedStringBundle.GetStringFromName(name);
			}
			if (num !== undefined) {
				let availableForms = l10n.split(/;/);
				// If not enough available forms, use last one -- PluralForm.get() uses first by
				// default, but it's more likely that a localizer will translate the two English
				// strings with some plural form as the second one, so we might as well use that
				if (availableForms.length < PluralForm.numForms()) {
					l10n = availableForms[availableForms.length - 1];
				}
				else {
					l10n = PluralForm.get(num, l10n);
				}
			}
		}
		catch (e){
			if (e.name == 'NS_ERROR_ILLEGAL_VALUE') {
				Zotero.debug(params, 1);
			}
			else if (e.name != 'NS_ERROR_FAILURE') {
				Components.utils.reportError(e);
				Zotero.debug(e, 1);
			}
			throw ('Localized string not available for ' + name);
		}
		return l10n;
	}
	
	
	/**
	 * Defines property on the object
	 * More compact way to do Object.defineProperty
	 *
	 * @param {Object} obj Target object
	 * @param {String} prop Property to be defined
	 * @param {Object} desc Propery descriptor. If not overriden, "enumerable" is true
	 * @param {Object} opts Options:
	 *   lazy {Boolean} If true, the _getter_ is intended for late
	 *     initialization of the property. The getter is replaced with a simple
	 *     property once initialized.
	 */
	this.defineProperty = function(obj, prop, desc, opts) {
		if (typeof prop != 'string') throw new Error("Property must be a string");
		var d = { __proto__: null, enumerable: true, configurable: true }; // Enumerable by default
		for (let p in desc) {
			if (!desc.hasOwnProperty(p)) continue;
			d[p] = desc[p];
		}
		
		if (opts) {
			if (opts.lazy && d.get) {
				let getter = d.get;
				d.configurable = true; // Make sure we can change the property later
				d.get = function() {
					let val = getter.call(this);
					
					// Redefine getter on this object as non-writable value
					delete d.set;
					delete d.get;
					d.writable = false;
					d.value = val;
					Object.defineProperty(this, prop, d);
					
					return val;
				}
			}
		}
		
		Object.defineProperty(obj, prop, d);
	}
	
	this.extendClass = function(superClass, newClass) {
		newClass._super = superClass;
		newClass.prototype = Object.create(superClass.prototype);
		newClass.prototype.constructor = newClass;
	}
	
	
	/*
	 * This function should be removed
	 *
	 * |separator| defaults to a space (not a comma like Array.join()) if
	 *   not specified
	 *
	 * TODO: Substitute localized characters (e.g. Arabic comma and semicolon)
	 */
	function localeJoin(arr, separator) {
		if (typeof separator == 'undefined') {
			separator = ' ';
		}
		return arr.join(separator);
	}
	
	
	this.getLocaleCollation = function () {
		if (this.collation) {
			return this.collation;
		}
		
		var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
				.getService(Components.interfaces.nsILocaleService);
		var appLocale = localeService.getApplicationLocale();
		
		try {
			var locale = appLocale.getCategory('NSILOCALE_COLLATE');
			// Extract a valid language tag
			locale = locale.match(/^[a-z]{2}(\-[A-Z]{2})?/)[0];
			var collator = new Intl.Collator(locale, {
				ignorePunctuation: true,
				numeric: true,
				sensitivity: 'base'
			});
		}
		catch (e) {
			Zotero.debug(e, 1);
			
			// If there's an error, just skip sorting
			collator = {
				compare: function (a, b) {
					return 0;
				}
			};
		}
		
		// Grab all ASCII punctuation and space at the begining of string
		var initPunctuationRE = /^[\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+/;
		// Punctuation that should be ignored when sorting
		var ignoreInitRE = /["'[{(]+$/;
		
		// Until old code is updated, pretend we're returning an nsICollation
		return this.collation = {
			compareString: function (_, a, b) {
				if (!a && !b) return 0;
				if (!a || !b) return b ? -1 : 1;
				
				// Compare initial punctuation
				var aInitP = initPunctuationRE.exec(a) || '';
				var bInitP = initPunctuationRE.exec(b) || '';
				
				var aWordStart = 0, bWordStart = 0;
				if (aInitP) {
					aWordStart = aInitP[0].length;
					aInitP = aInitP[0].replace(ignoreInitRE, '');
				}
				if (bInitP) {
					bWordStart = bInitP.length;
					bInitP = bInitP[0].replace(ignoreInitRE, '');
				}
				
				// If initial punctuation is equivalent, use collator comparison
				// that ignores all punctuation
				if (aInitP == bInitP || !aInitP && !bInitP) return collator.compare(a, b);
				
				// Otherwise consider "attached" words as well, e.g. the order should be
				// "__ n", "__z", "_a"
				// We don't actually care what the attached word is, just whether it's
				// there, since at this point we're guaranteed to have non-equivalent
				// initial punctuation
				if (aWordStart < a.length) aInitP += 'a';
				if (bWordStart < b.length) bInitP += 'a';
				
				return aInitP.localeCompare(bInitP);
			}
		};
	}
	
	this.defineProperty(this, "localeCompare", {
		get: function() {
			var collation = this.getLocaleCollation();
			return collation.compareString.bind(collation, 1);
		}
	}, {lazy: true});
	
	/*
	 * Sets font size based on prefs -- intended for use on root element
	 *  (zotero-pane, note window, etc.)
	 */
	function setFontSize(rootElement) {
		var size = Zotero.Prefs.get('fontSize');
		rootElement.style.fontSize = size + 'em';
		if (size <= 1) {
			size = 'small';
		}
		else if (size <= 1.25) {
			size = 'medium';
		}
		else {
			size = 'large';
		}
		// Custom attribute -- allows for additional customizations in zotero.css
		rootElement.setAttribute('zoteroFontSize', size);
	}
	
	
	/*
	 * Flattens mixed arrays/values in a passed _arguments_ object and returns
	 * an array of values -- allows for functions to accept both arrays of
	 * values and/or an arbitrary number of individual values
	 */
	function flattenArguments(args){
		// Put passed scalar values into an array
		if (args === null || typeof args == 'string' || typeof args.length == 'undefined') {
			args = [args];
		}
		
		var returns = [];
		for (var i=0; i<args.length; i++){
			var arg = args[i];
			if (!arg && arg !== 0) {
				continue;
			}
			if (Array.isArray(arg)) {
				for (var j=0; j<arg.length; j++){
					returns.push(arg[j]);
				}
			}
			else {
				returns.push(arg);
			}
		}
		return returns;
	}
	
	
	function getAncestorByTagName(elem, tagName){
		while (elem.parentNode){
			elem = elem.parentNode;
			if (elem.localName == tagName) {
				return elem;
			}
		}
		return false;
	}
	
	
	/**
	* Generate a random string of length 'len' (defaults to 8)
	**/
	function randomString(len, chars) {
		return Zotero.Utilities.randomString(len, chars);
	}
	
	
	function moveToUnique(file, newFile){
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Move file to unique name
		file.moveTo(newFile.parent, newName);
		return file;
	}
	
	
	/**
	 * Generate a function that produces a static output
	 *
	 * Zotero.lazy(fn) returns a function. The first time this function
	 * is called, it calls fn() and returns its output. Subsequent
	 * calls return the same output as the first without calling fn()
	 * again.
	 */
	this.lazy = function(fn) {
		var x, called = false;
		return function() {
			if(!called) {
				x = fn.apply(this);
				called = true;
			}
			return x;
		};
	};
	
	
	this.serial = function (fn) {
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(Zotero.debug);
		return function () {
			var args = arguments;
			return caller.start(function () {
				return fn.apply(this, args);
			}.bind(this));
		};
	}
	
	
	this.spawn = function (generator, thisObject) {
		if (thisObject) {
			return Zotero.Promise.coroutine(generator.bind(thisObject))();
		}
		return Zotero.Promise.coroutine(generator)();
	}
	
	
	/**
	 * Emulates the behavior of window.setTimeout
	 *
	 * @param {Function} func			The function to be called
	 * @param {Integer} ms				The number of milliseconds to wait before calling func
	 * @return {Integer} - ID of timer to be passed to clearTimeout()
	 */
	var _lastTimeoutID = 0;
	this.setTimeout = function (func, ms) {
		var id = ++_lastTimeoutID;
		
		var timer = Components.classes["@mozilla.org/timer;1"]
			.createInstance(Components.interfaces.nsITimer);
		var timerCallback = {
			"notify": function () {
				func();
				_runningTimers.delete(id);
			}
		};
		timer.initWithCallback(timerCallback, ms, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		_runningTimers.set(id, timer);
		return id;
	};
	
	
	this.clearTimeout = function (id) {
		var timer = _runningTimers.get(id);
		if (timer) {
			timer.cancel();
			_runningTimers.delete(id);
		}
	};
	
	
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
			if (!win.ZoteroPane.isShowing() && !modalOnly) {
				if (win != currentWindow) {
					continue;
				}
				
				// If Zotero is closed in the top-most window, show a popup instead
				_progressPopup = new Zotero.ProgressWindow();
				_progressPopup.changeHeadline("Zotero");
				if (icon) {
					_progressPopup.addLines([msg], [icon]);
				}
				else {
					_progressPopup.addDescription(msg);
				}
				_progressPopup.show();
				continue;
			}
			
			var label = win.ZoteroPane.document.getElementById('zotero-pane-progress-label');
			if (msg) {
				label.hidden = false;
				label.value = msg;
			}
			else {
				label.hidden = true;
			}
			var progressMeter = win.ZoteroPane.document.getElementById('zotero-pane-progressmeter')
			if (determinate) {
				progressMeter.mode = 'determined';
				progressMeter.value = 0;
				progressMeter.max = 1000;
			}
			else {
				progressMeter.mode = 'undetermined';
			}
			
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
				if (pm.mode == 'undetermined') {
					pm.max = 1000;
					pm.mode = 'determined';
				}
				pm.value = percentage;
			} else if(pm.mode === 'determined') {
				pm.mode = 'undetermined';
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
		doc.getElementById('zotero-pane-tab-catcher-top').hidden = false;
		doc.getElementById('zotero-pane-tab-catcher-bottom').hidden = false;
		doc.getElementById('zotero-pane-overlay').hidden = false;
	}
	
	
	function _hideWindowZoteroPaneOverlay(doc) {
		doc.getElementById('zotero-collections-tree').disabled = false;
		doc.getElementById('zotero-items-tree').disabled = false;
		doc.getElementById('zotero-pane-tab-catcher-top').hidden = true;
		doc.getElementById('zotero-pane-tab-catcher-bottom').hidden = true;
		doc.getElementById('zotero-pane-overlay').hidden = true;
	}
	
	
	this.updateQuickSearchBox = function (document) {
		var searchBox = document.getElementById('zotero-tb-search');
		if(!searchBox) return;
		
		var mode = Zotero.Prefs.get("search.quicksearch-mode");
		var prefix = 'zotero-tb-search-mode-';
		var prefixLen = prefix.length;
		
		var modes = {
			titleCreatorYear: {
				label: Zotero.getString('quickSearch.mode.titleCreatorYear')
			},
			
			fields: {
				label: Zotero.getString('quickSearch.mode.fieldsAndTags')
			},
			
			everything: {
				label: Zotero.getString('quickSearch.mode.everything')
			}
		};
		
		if (!modes[mode]) {
			Zotero.Prefs.set("search.quicksearch-mode", "fields");
			mode = 'fields';
		}
		
		var hbox = document.getAnonymousNodes(searchBox)[0];
		var input = hbox.getElementsByAttribute('class', 'textbox-input')[0];
		
		// Already initialized, so just update selection
		var button = hbox.getElementsByAttribute('id', 'zotero-tb-search-menu-button');
		if (button.length) {
			button = button[0];
			var menupopup = button.firstChild;
			for (let menuitem of menupopup.childNodes) {
				if (menuitem.id.substr(prefixLen) == mode) {
					menuitem.setAttribute('checked', true);
					searchBox.placeholder = modes[mode].label;
					return;
				}
			}
			return;
		}
		
		// Otherwise, build menu
		button = document.createElement('button');
		button.id = 'zotero-tb-search-menu-button';
		button.setAttribute('type', 'menu');
		
		var menupopup = document.createElement('menupopup');
		
		for (var i in modes) {
			var menuitem = document.createElement('menuitem');
			menuitem.setAttribute('id', prefix + i);
			menuitem.setAttribute('label', modes[i].label);
			menuitem.setAttribute('name', 'searchMode');
			menuitem.setAttribute('type', 'radio');
			//menuitem.setAttribute("tooltiptext", "");
			
			menupopup.appendChild(menuitem);
			
			if (mode == i) {
				menuitem.setAttribute('checked', true);
				menupopup.selectedItem = menuitem;
			}
		}
		
		menupopup.addEventListener("command", function(event) {
			var mode = event.target.id.substr(22);
			Zotero.Prefs.set("search.quicksearch-mode", mode);
			if (document.getElementById("zotero-tb-search").value == "") {
				event.stopPropagation();
			}
		}, false);
		
		button.appendChild(menupopup);
		hbox.insertBefore(button, input);
		
		searchBox.placeholder = modes[mode].label;
		
		// If Alt-Up/Down, show popup
		searchBox.addEventListener("keypress", function(event) {
			if (event.altKey && (event.keyCode == event.DOM_VK_UP || event.keyCode == event.DOM_VK_DOWN)) {
				document.getElementById('zotero-tb-search-menu-button').open = true;
				event.stopPropagation();
			}
		}, false);
	}
	
	
	/*
	 * Clear entries that no longer exist from various tables
	 */
	this.purgeDataObjects = Zotero.Promise.coroutine(function* () {
		yield Zotero.DB.executeTransaction(function* () {
			return Zotero.Creators.purge();
		});
		yield Zotero.DB.executeTransaction(function* () {
			return Zotero.Tags.purge();
		});
		Zotero.Fulltext.purgeUnusedWords();
		yield Zotero.DB.executeTransaction(function* () {
			return Zotero.Items.purge();
		});
		// DEBUG: this might not need to be permanent
		//yield Zotero.DB.executeTransaction(function* () {
		//	return Zotero.Relations.purge();
		//});
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
			'bad script XDR magic number'
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
	
	/**
	 * Observer for console messages
	 * @namespace
	 */
	var ConsoleListener = {
		"QueryInterface":XPCOMUtils.generateQI([Components.interfaces.nsIConsoleMessage,
			Components.interfaces.nsISupports]),
		"observe":function(msg) {
			if(!_shouldKeepError(msg)) return;
			if(_recentErrors.length === ERROR_BUFFER_SIZE) _recentErrors.shift();
			_recentErrors.push(msg);
		}
	};
}).call(Zotero);

Zotero.Prefs = new function(){
	// Privileged methods
	this.init = init;
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	// Public properties
	this.prefBranch;
	
	function init(){
		this.prefBranch = Services.prefs.getBranch(ZOTERO_CONFIG.PREF_BRANCH);
		
		// Register observer to handle pref changes
		this.register();
		
		// Process pref version updates
		var fromVersion = this.get('prefVersion');
		if (!fromVersion) {
			fromVersion = 0;
		}
		var toVersion = 2;
		if (fromVersion < toVersion) {
			for (var i = fromVersion + 1; i <= toVersion; i++) {
				switch (i) {
					case 1:
						// If a sync username is entered and ZFS is enabled, turn
						// on-demand downloading off to maintain current behavior
						if (this.get('sync.server.username')) {
							if (this.get('sync.storage.enabled')
									&& this.get('sync.storage.protocol') == 'zotero') {
								this.set('sync.storage.downloadMode.personal', 'on-sync');
							}
							if (this.get('sync.storage.groups.enabled')) {
								this.set('sync.storage.downloadMode.groups', 'on-sync');
							}
						}
						break;
					
					case 2:
						// Re-show saveButton guidance panel (and clear old saveIcon pref).
						// The saveButton guidance panel initially could auto-hide too easily.
						this.clear('firstRunGuidanceShown.saveIcon');
						this.clear('firstRunGuidanceShown.saveButton');
						break;
				}
			}
			this.set('prefVersion', toVersion);
		}
	}
	
	
	/**
	* Retrieve a preference
	**/
	function get(pref, global){
		try {
			if (global) {
				var branch = Services.prefs.getBranch("");
			}
			else {
				var branch = this.prefBranch;
			}
			
			switch (branch.getPrefType(pref)){
				case branch.PREF_BOOL:
					return branch.getBoolPref(pref);
				case branch.PREF_STRING:
					return '' + branch.getComplexValue(pref, Components.interfaces.nsISupportsString);
				case branch.PREF_INT:
					return branch.getIntPref(pref);
			}
		}
		catch (e){
			throw ("Invalid preference '" + pref + "'");
		}
	}
	
	
	/**
	* Set a preference
	**/
	function set(pref, value, global) {
		try {
			if (global) {
				var branch = Services.prefs.getBranch("");
			}
			else {
				var branch = this.prefBranch;
			}
			
			switch (branch.getPrefType(pref)) {
				case branch.PREF_BOOL:
					return branch.setBoolPref(pref, value);
				case branch.PREF_STRING:
					let str = Cc["@mozilla.org/supports-string;1"]
						.createInstance(Ci.nsISupportsString);
					str.data = value;
					return branch.setComplexValue(pref, Ci.nsISupportsString, str);
				case branch.PREF_INT:
					return branch.setIntPref(pref, value);
				
				// If not an existing pref, create appropriate type automatically
				case 0:
					if (typeof value == 'boolean') {
						Zotero.debug("Creating boolean pref '" + pref + "'");
						return branch.setBoolPref(pref, value);
					}
					if (typeof value == 'string') {
						Zotero.debug("Creating string pref '" + pref + "'");
						return branch.setCharPref(pref, value);
					}
					if (parseInt(value) == value) {
						Zotero.debug("Creating integer pref '" + pref + "'");
						return branch.setIntPref(pref, value);
					}
					throw new Error("Invalid preference value '" + value + "' for pref '" + pref + "'");
			}
		}
		catch (e) {
			Zotero.logError(e);
			throw new Error("Invalid preference '" + pref + "'");
		}
	}
	
	
	this.clear = function (pref) {
		this.prefBranch.clearUserPref(pref);
	}
	
	
	// Import settings bundles
	this.importSettings = function (str, uri) {
		var ps = Services.prompt;
		
		if (!uri.match(/https:\/\/([^\.]+\.)?zotero.org\//)) {
			Zotero.debug("Ignoring settings file not from https://zotero.org");
			return;
		}
		
		str = Zotero.Utilities.trim(str.replace(/<\?xml.*\?>\s*/, ''));
		Zotero.debug(str);
		
		var confirm = ps.confirm(
			null,
			"",
			"Apply settings from zotero.org?"
		);
		
		if (!confirm) {
			return;
		}
		
		// TODO: parse settings XML
	}
	
	// Handlers for some Zotero preferences
	var _handlers = [
		[ "automaticScraperUpdates", function(val) {
			if (val){
				Zotero.Schema.updateFromRepository();
			}
			else {
				Zotero.Schema.stopRepositoryTimer();
			}
		}],
		["fontSize", function (val) {
			Zotero.setFontSize(
				Zotero.getActiveZoteroPane().document.getElementById('zotero-pane')
			);
		}],
		[ "layout", function(val) {
			Zotero.getActiveZoteroPane().updateLayout();
		}],
		[ "note.fontSize", function(val) {
			if (val < 6) {
				Zotero.Prefs.set('note.fontSize', 11);
			}
		}],
		[ "zoteroDotOrgVersionHeader", function(val) {
			if (val) {
				Zotero.VersionHeader.register();
			}
			else {
				Zotero.VersionHeader.unregister();
			}
		}],
		[ "sync.autoSync", function(val) {
			if (val) {
				Zotero.Sync.EventListeners.AutoSyncListener.register();
				Zotero.Sync.EventListeners.IdleListener.register();
			}
			else {
				Zotero.Sync.EventListeners.AutoSyncListener.unregister();
				Zotero.Sync.EventListeners.IdleListener.unregister();
			}
		}],
		[ "search.quicksearch-mode", function(val) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("navigator:browser");
			while (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				if (!win.ZoteroPane) continue;
				Zotero.updateQuickSearchBox(win.ZoteroPane.document);
			}
			
			var enumerator = wm.getEnumerator("zotero:item-selector");
			while (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				if (!win.Zotero) continue;
				Zotero.updateQuickSearchBox(win.document);
			}
		}]
	];
	
	//
	// Methods to register a preferences observer
	//
	function register(){
		this.prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefBranch.addObserver("", this, false);
		
		// Register pre-set handlers
		for (var i=0; i<_handlers.length; i++) {
			this.registerObserver(_handlers[i][0], _handlers[i][1]);
		}
	}
	
	function unregister(){
		if (!this.prefBranch){
			return;
		}
		this.prefBranch.removeObserver("", this);
	}
	
	/**
	 * @param {nsIPrefBranch} subject The nsIPrefBranch we're observing (after appropriate QI)
	 * @param {String} topic The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
	 * @param {String} data The name of the pref that's been changed (relative to subject)
	 */
	function observe(subject, topic, data){
		if (topic != "nsPref:changed" || !_observers[data] || !_observers[data].length) {
			return;
		}
		
		var obs = _observers[data];
		for (var i=0; i<obs.length; i++) {
			try {
				obs[i](this.get(data));
			}
			catch (e) {
				Zotero.debug("Error while executing preference observer handler for " + data);
				Zotero.debug(e);
			}
		}
	}
	
	var _observers = {};
	this.registerObserver = function(name, handler) {
		_observers[name] = _observers[name] || [];
		_observers[name].push(handler);
	}
	
	this.unregisterObserver = function(name, handler) {
		var obs = _observers[name];
		if (!obs) {
			Zotero.debug("No preferences observer registered for " + name);
			return;
		}
		
		var i = obs.indexOf(handler);
		if (i == -1) {
			Zotero.debug("Handler was not registered for preference " + name);
			return;
		}
		
		obs.splice(i, 1);
	}
}


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
		var cmds = Zotero.Prefs.prefBranch.getChildList('keys', {}, {});
		
		// Get the key=>command mappings from the prefs
		for (let cmd of cmds) {
			cmd = cmd.substr(5); // strips 'keys.'
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
				name: 'openZotero',
				defaultKey: 'Z'
			},
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
 * Add X-Zotero-Version header to HTTP requests to zotero.org
 *
 * @namespace
 */
Zotero.VersionHeader = {
	init: function () {
		if (Zotero.Prefs.get("zoteroDotOrgVersionHeader")) {
			this.register();
		}
		Zotero.addShutdownListener(this.unregister);
	},
	
	// Called from this.init() and Zotero.Prefs.observe()
	register: function () {
		Services.obs.addObserver(this, "http-on-modify-request", false);
	},
	
	observe: function (subject, topic, data) {
		try {
			var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
			if (channel.URI.host.match(/zotero\.org$/)) {
				channel.setRequestHeader("X-Zotero-Version", Zotero.version, false);
			}
		}
		catch (e) {
			Zotero.debug(e);
		}
	},
	
	unregister: function () {
		Services.obs.removeObserver(Zotero.VersionHeader, "http-on-modify-request");
	}
}

Zotero.DragDrop = {
	currentEvent: null,
	currentOrientation: 0,
	currentSourceNode: null,
	
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
			var ids = dt.getData('zotero/collection').split(",");
			dragData.data = ids;
		}
		else if (dt.types.contains('zotero/item')) {
			dragData.dataType = 'zotero/item';
			var ids = dt.getData('zotero/item').split(",");
			dragData.data = ids;
		}
		else if (dt.types.contains('application/x-moz-file')) {
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
		else if (dt.types.contains('text/x-moz-url')) {
			dragData.dataType = 'text/x-moz-url';
			var urls = [];
			for (var i=0; i<len; i++) {
				var url = dt.getData("text/x-moz-url").split("\n")[0];
				urls.push(url);
			}
			dragData.data = urls;
		}
		
		return dragData;
	},
	
	
	getDragSource: function (dataTransfer) {
		if (!dataTransfer) {
			//Zotero.debug("Drag data not available", 2);
			return false;
		}
		
		// For items, the drag source is the CollectionTreeRow of the parent window
		// of the source tree
		if (dataTransfer.types.contains("zotero/item")) {
			let sourceNode = dataTransfer.mozSourceNode || this.currentSourceNode;
			if (!sourceNode || sourceNode.tagName != 'treechildren'
					|| sourceNode.parentElement.id != 'zotero-items-tree') {
				return false;
			}
			var win = sourceNode.ownerDocument.defaultView;
			if (win.document.documentElement.getAttribute('windowtype') == 'zotero:search') {
				return win.ZoteroAdvancedSearch.itemsView.collectionTreeRow;
			}
			return win.ZoteroPane.collectionsView.selectedTreeRow;
		}
		
		return false;
	},
	
	
	getDragTarget: function (event) {
		var target = event.target;
		if (target.tagName == 'treechildren') {
			var tree = target.parentNode;
			if (tree.id == 'zotero-collections-tree') {
				let row = {}, col = {}, obj = {};
				tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
				let win = tree.ownerDocument.defaultView;
				return win.ZoteroPane.collectionsView.getRow(row.value);
			}
		}
		return false;
	}
}


/**
 * Functions for creating and destroying hidden browser objects
 **/
Zotero.Browser = new function() {
	var nBrowsers = 0;
	
	this.createHiddenBrowser = createHiddenBrowser;
	this.deleteHiddenBrowser = deleteHiddenBrowser;
	
	function createHiddenBrowser(win) {
	 	if (!win) {
			var win = Services.wm.getMostRecentWindow("navigator:browser");
			if(!win) {
				var win = Services.ww.activeWindow;
			}
			if (!win) {
				throw new Error("Parent window not available for hidden browser");
			}
		}
		
		// Create a hidden browser
		var hiddenBrowser = win.document.createElement("browser");
		hiddenBrowser.setAttribute('type', 'content');
		hiddenBrowser.setAttribute('disablehistory', 'true');
		win.document.documentElement.appendChild(hiddenBrowser);
		// Disable some features
		hiddenBrowser.docShell.allowAuth = false;
		hiddenBrowser.docShell.allowDNSPrefetch = false;
		hiddenBrowser.docShell.allowImages = false;
		hiddenBrowser.docShell.allowJavascript = true;
		hiddenBrowser.docShell.allowMetaRedirects = false;
		hiddenBrowser.docShell.allowPlugins = false;
		Zotero.debug("Created hidden browser (" + (nBrowsers++) + ")");
		return hiddenBrowser;
	}
	
	function deleteHiddenBrowser(myBrowsers) {
		if(!(myBrowsers instanceof Array)) myBrowsers = [myBrowsers];
		for(var i=0; i<myBrowsers.length; i++) {
			var myBrowser = myBrowsers[i];
			myBrowser.stop();
			myBrowser.destroy();
			myBrowser.parentNode.removeChild(myBrowser);
			myBrowser = null;
			Zotero.debug("Deleted hidden browser (" + (--nBrowsers) + ")");
		}
	}
}


/*
 * Implements nsIWebProgressListener
 */
Zotero.WebProgressFinishListener = function(onFinish) {
	this.onStateChange = function(wp, req, stateFlags, status) {
		//Zotero.debug('onStageChange: ' + stateFlags);
		if (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP
				&& stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK) {
			onFinish();
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
