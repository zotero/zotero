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

"use strict";

if (!Zotero.Sync) {
	Zotero.Sync = {};
}

// Initialized as Zotero.Sync.Runner in zotero.js
Zotero.Sync.Runner_Module = function (options = {}) {
	const stopOnError = false;
	
	Zotero.defineProperty(this, 'enabled', {
		get: () => {
			return _apiKey || Zotero.Sync.Data.Local.hasCredentials();
		}
	});
	Zotero.defineProperty(this, 'syncInProgress', { get: () => _syncInProgress });
	Zotero.defineProperty(this, 'lastSyncStatus', { get: () => _lastSyncStatus });
	
	Zotero.defineProperty(this, 'RESET_MODE_FROM_SERVER', { value: 1 });
	Zotero.defineProperty(this, 'RESET_MODE_TO_SERVER', { value: 2 });
	
	Zotero.defineProperty(this, 'baseURL', {
		get: () => {
			let url = options.baseURL || Zotero.Prefs.get("api.url") || ZOTERO_CONFIG.API_URL;
			if (!url.endsWith('/')) {
				url += '/';
			}
			return url;
		}
	});
	this.apiVersion = options.apiVersion || ZOTERO_CONFIG.API_VERSION;
	
	// Allows tests to set apiKey in options or as property, overriding login manager
	var _apiKey = options.apiKey;
	Zotero.defineProperty(this, 'apiKey', { set: val => _apiKey = val });
	
	Components.utils.import("resource://zotero/concurrentCaller.js");
	this.caller = new ConcurrentCaller({
		numConcurrent: 4,
		stopOnError,
		logger: msg => Zotero.debug(msg),
		onError: e => Zotero.logError(e),
		Promise: Zotero.Promise
	});
	
	var _enabled = false;
	var _autoSyncTimer;
	var _delaySyncUntil;
	var _delayPromises = [];
	var _firstInSession = true;
	var _syncInProgress = false;
	var _stopping = false;
	var _canceller;
	var _manualSyncRequired = false; // TODO: make public?
	
	var _currentEngine = null;
	var _storageControllers = {};
	
	var _lastSyncStatus;
	var _currentSyncStatusLabel;
	var _currentLastSyncLabel;
	var _errors = [];
	
	Zotero.addShutdownListener(() => this.stop());
	
	this.getAPIClient = function (options = {}) {
		return new Zotero.Sync.APIClient({
			baseURL: this.baseURL,
			apiVersion: this.apiVersion,
			apiKey: options.apiKey,
			caller: this.caller,
			cancellerReceiver: _cancellerReceiver,
		});
	}
	
	
	/**
	 * Begin a sync session
	 *
	 * @param {Object}    [options]
	 * @param {Boolean}   [options.background=false]  Whether this is a background request, which
	 *                                                prevents some alerts from being shown
	 * @param {Integer[]} [options.libraries]         IDs of libraries to sync; skipped libraries must
	 *     be removed if unwanted
	 * @param {Function}  [options.onError]           Function to pass errors to instead of
	 *                                                handling internally (used for testing)
	 */
	this.sync = Zotero.serial(function (options = {}) {
		return this._sync(options);
	});
	
	
	this._sync = Zotero.Promise.coroutine(function* (options) {
		// Clear message list
		_errors = [];
		
		// Shouldn't be possible because of serial()
		if (_syncInProgress) {
			let msg = Zotero.getString('sync.error.syncInProgress');
			let e = new Zotero.Error(msg, 0, { dialogButtonText: null, frontWindowOnly: true });
			this.updateIcons(e);
			return false;
		}
		_syncInProgress = true;
		_stopping = false;
		
		try {
			yield Zotero.Notifier.trigger('start', 'sync', []);
			
			let apiKey = yield _getAPIKey();
			if (!apiKey) {
				throw new Zotero.Error("API key not set", Zotero.Error.ERROR_API_KEY_NOT_SET);
			}
			
			if (_firstInSession) {
				options.firstInSession = true;
				_firstInSession = false;
			}
			
			this.updateIcons('animate');
			
			// If a delay is set (e.g., from the connector target selector), wait to sync
			while (_delaySyncUntil && new Date() < _delaySyncUntil) {
				this.setSyncStatus(Zotero.getString('sync.status.waiting'));
				let delay = _delaySyncUntil - new Date();
				Zotero.debug(`Waiting ${delay} ms to sync`);
				yield Zotero.Promise.delay(delay);
			}
			
			// If paused, wait until we're done
			while (true) {
				if (_delayPromises.some(p => p.isPending())) {
					this.setSyncStatus(Zotero.getString('sync.status.waiting'));
					Zotero.debug("Syncing is paused -- waiting to sync");
					yield Zotero.Promise.all(_delayPromises);
					// If more were added, continue
					if (_delayPromises.some(p => p.isPending())) {
						continue;
					}
					_delayPromises = [];
				}
				break;
			}
			
			// purgeDataObjects() starts a transaction, so if there's an active one then show a
			// nice message and wait until there's not. Another transaction could still start
			// before purgeDataObjects() and result in a wait timeout, but this should reduce the
			// frequency of that.
			while (Zotero.DB.inTransaction()) {
				this.setSyncStatus(Zotero.getString('sync.status.waiting'));
				Zotero.debug("Transaction in progress -- waiting to sync");
				yield Zotero.DB.waitForTransaction('sync');
				_stopCheck();
			}
			
			this.setSyncStatus(Zotero.getString('sync.status.preparing'));
			
			// Purge deleted objects so they don't cause sync errors (e.g., long tags)
			yield Zotero.purgeDataObjects(true);
			
			let client = this.getAPIClient({ apiKey });
			let keyInfo = yield this.checkAccess(client, options);
			
			_stopCheck();
			
			let emptyLibraryContinue = yield this.checkEmptyLibrary(keyInfo);
			if (!emptyLibraryContinue) {
				Zotero.debug("Syncing cancelled because user library is empty");
				return false;
			}
			
			let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
			let lastWin = wm.getMostRecentWindow("navigator:browser");
			if (!(yield Zotero.Sync.Data.Local.checkUser(lastWin, keyInfo.userID, keyInfo.username))) {
				Zotero.debug("User cancelled sync on username mismatch");
				return false;
			}
			
			let engineOptions = {
				userID: keyInfo.userID,
				apiClient: client,
				caller: this.caller,
				setStatus: this.setSyncStatus.bind(this),
				stopOnError,
				onError: function (e) {
					// Ignore cancelled requests
					if (e instanceof Zotero.HTTP.CancelledException) {
						Zotero.debug("Request was cancelled");
						return;
					}
					if (options.onError) {
						options.onError(e);
					}
					else {
						this.addError(e);
					}
				}.bind(this),
				background: !!options.background,
				firstInSession: _firstInSession,
				resetMode: options.resetMode
			};
			
			var librariesToSync = options.libraries = yield this.checkLibraries(
				client,
				options,
				keyInfo,
				options.libraries ? Array.from(options.libraries) : []
			);
			
			_stopCheck();
			
			// If items not yet loaded for libraries we need, load them now
			for (let libraryID of librariesToSync) {
				let library = Zotero.Libraries.get(libraryID);
				if (!library.getDataLoaded('item')) {
					yield library.waitForDataLoad('item');
				}
			}
			
			_stopCheck();
			
			// Sync data and files, and then repeat if necessary
			let attempt = 1;
			let successfulLibraries = new Set(librariesToSync);
			while (librariesToSync.length) {
				_stopCheck();
				
				if (attempt > 3) {
					// TODO: Back off and/or nicer error
					throw new Error("Too many sync attempts -- stopping");
				}
				let nextLibraries = yield _doDataSync(librariesToSync, engineOptions);
				// Remove failed libraries from the successful set
				Zotero.Utilities.arrayDiff(librariesToSync, nextLibraries).forEach(libraryID => {
					successfulLibraries.delete(libraryID);
				});
				
				_stopCheck();
				
				// Run file sync on all libraries that passed the last data sync
				librariesToSync = yield _doFileSync(nextLibraries, engineOptions);
				if (librariesToSync.length) {
					attempt++;
					continue;
				}
				
				_stopCheck();
				
				// Run full-text sync on all libraries that haven't failed a data sync
				librariesToSync = yield _doFullTextSync([...successfulLibraries], engineOptions);
				if (librariesToSync.length) {
					attempt++;
					continue;
				}
				break;
			}
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.BrowserOfflineException) {
				let msg = Zotero.getString('general.browserIsOffline', Zotero.appName);
				e = new Zotero.Error(msg, 0, { dialogButtonText: null })
				Zotero.logError(e);
				_errors = [];
			}
			
			if (e instanceof Zotero.Sync.UserCancelledException
					|| e instanceof Zotero.HTTP.CancelledException) {
				Zotero.debug("Sync was cancelled");
			}
			else if (options.onError) {
				options.onError(e);
			}
			else {
				this.addError(e);
			}
		}
		finally {
			yield this.end(options);
			
			if (options.restartSync) {
				delete options.restartSync;
				Zotero.debug("Restarting sync");
				yield this._sync(options);
				return;
			}
			
			Zotero.debug("Done syncing");
			Zotero.Notifier.trigger('finish', 'sync', librariesToSync || []);
		}
	});
	
	
	/**
	 * Check key for current user info and return access info
	 */
	this.checkAccess = Zotero.Promise.coroutine(function* (client, options={}) {
		var json = yield client.getKeyInfo(options);
		Zotero.debug(json);
		if (!json) {
			throw new Zotero.Error("API key not set", Zotero.Error.ERROR_API_KEY_INVALID);
		}
		
		// Sanity check
		if (!json.userID) throw new Error("userID not found in key response");
		if (!json.username) throw new Error("username not found in key response");
		if (!json.access) throw new Error("'access' not found in key response");
		
		return json;
	});


	// Prompt if library empty and there is no userID stored
	this.checkEmptyLibrary = Zotero.Promise.coroutine(function* (keyInfo) {
		let library = Zotero.Libraries.userLibrary;
		let feeds = Zotero.Feeds.getAll();
		let userID = Zotero.Users.getCurrentUserID();

		if (!userID) {
			let hasItems = yield library.hasItems();
			if (!hasItems && feeds.length <= 0 && !Zotero.resetDataDir) {
				let ps = Services.prompt;
				let index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('account.warning.emptyLibrary', [keyInfo.username, Zotero.clientName]) + "\n\n"
						+ Zotero.getString('account.warning.existingDataElsewhere', Zotero.clientName),
					(ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING) 
						+ (ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL)
						+ (ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING),
					Zotero.getString('sync.sync'),
					null, 
					Zotero.getString('dataDir.changeDataDirectory'), 
					null, {}
				);
				if (index == 1) {
					return false;
				}
				else if (index == 2) {
					var win = Services.wm.getMostRecentWindow("navigator:browser");
					win.openDialog("chrome://zotero/content/preferences/preferences.xul", null, null, {
						pane: 'zotero-prefpane-advanced',
						tabIndex: 1
					});
					return false;
				}
			}
		}
		return true;
	});
	
	
	/**
	 * @return {Promise<Integer[]> - IDs of libraries to sync
	 */
	this.checkLibraries = Zotero.Promise.coroutine(function* (client, options, keyInfo, libraries = []) {
		var access = keyInfo.access;
		
		var syncAllLibraries = !libraries || !libraries.length;
		
		// TODO: Ability to remove or disable editing of user library?
		
		if (syncAllLibraries) {
			if (access.user && access.user.library) {
				libraries = [Zotero.Libraries.userLibraryID];
				let skippedLibraries = Zotero.Sync.Data.Local.getSkippedLibraries();
				
				// If syncing all libraries, remove skipped libraries
				if (skippedLibraries.length) {
					Zotero.debug("Skipped libraries:");
					Zotero.debug(skippedLibraries);
					libraries = Zotero.Utilities.arrayDiff(libraries, skippedLibraries);
				}
			}
		}
		else {
			// Check access to specified libraries
			for (let libraryID of libraries) {
				let type = Zotero.Libraries.get(libraryID).libraryType;
				if (type == 'user') {
					if (!access.user || !access.user.library) {
						// TODO: Alert
						throw new Error("Key does not have access to library " + libraryID);
					}
				}
			}
		}
		
		//
		// Check group access
		//
		let remotelyMissingGroups = [];
		let groupsToDownload = [];
		
		if (!Zotero.Utilities.isEmpty(access.groups)) {
			// TEMP: Require all-group access for now
			if (access.groups.all) {
				
			}
			else {
				throw new Error("Full group access is currently required");
			}
			
			let remoteGroupVersions = yield client.getGroupVersions(keyInfo.userID);
			let remoteGroupIDs = Object.keys(remoteGroupVersions).map(id => parseInt(id));
			let skippedGroups = Zotero.Sync.Data.Local.getSkippedGroups();
			
			// Remove skipped groups
			if (syncAllLibraries) {
				let newGroups = Zotero.Utilities.arrayDiff(remoteGroupIDs, skippedGroups);
				Zotero.Utilities.arrayDiff(remoteGroupIDs, newGroups)
					.forEach(id => { delete remoteGroupVersions[id] });
				remoteGroupIDs = newGroups;
			}
			
			for (let id in remoteGroupVersions) {
				id = parseInt(id);
				let group = Zotero.Groups.get(id);
				
				if (syncAllLibraries) {
					// If syncing all libraries, mark any that don't exist, are outdated, or are
					// archived locally for update. Group is added to the library list after downloading.
					if (!group || group.version < remoteGroupVersions[id] || group.archived) {
						Zotero.debug(`Marking group ${id} to download`);
						groupsToDownload.push(id);
					}
					// If not outdated, just add to library list
					else {
						Zotero.debug(`Adding group library ${group.libraryID} to sync`);
						libraries.push(group.libraryID);
					}
				}
				else {
					// If specific libraries were provided, ignore remote groups that don't
					// exist locally or aren't in the given list
					if (!group || libraries.indexOf(group.libraryID) == -1) {
						continue;
					}
					// If group metadata is outdated, mark for update
					if (group.version < remoteGroupVersions[id]) {
						groupsToDownload.push(id);
					}
				}
			}
			
			// Get local groups (all if syncing all libraries or just selected ones) that don't
			// exist remotely
			// TODO: Use explicit removals?
			let localGroups;
			if (syncAllLibraries) {
				localGroups = Zotero.Groups.getAll()
					.map(g => g.id)
					// Don't include skipped groups
					.filter(id => skippedGroups.indexOf(id) == -1);
			}
			else {
				localGroups = libraries
					.filter(id => Zotero.Libraries.get(id).libraryType == 'group')
					.map(id => Zotero.Groups.getGroupIDFromLibraryID(id))
			}
			Zotero.debug("Local groups:");
			Zotero.debug(localGroups);
			remotelyMissingGroups = Zotero.Utilities.arrayDiff(localGroups, remoteGroupIDs)
				.map(id => Zotero.Groups.get(id));
		}
		// No group access
		else {
			remotelyMissingGroups = Zotero.Groups.getAll();
		}
		
		if (remotelyMissingGroups.length) {
			// TODO: What about explicit deletions?
			
			let removedGroups = [];
			let keptGroups = [];
			
			let ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
				+ ps.BUTTON_DELAY_ENABLE;
			
			// Prompt for each group
			//
			// TODO: Localize
			for (let group of remotelyMissingGroups) {
				// Ignore remotely missing archived groups
				if (group.archived) {
					groupsToDownload = groupsToDownload.filter(groupID => groupID != group.id);
					continue;
				}
				
				let msg;
				// If all-groups access but group is missing, user left it
				if (access.groups && access.groups.all) {
					msg = "You are no longer a member of the group \u2018" + group.name + "\u2019.";
				}
				// If not all-groups access, key might just not have access
				else {
					msg = "You no longer have access to the group \u2018" + group.name + "\u2019.";
				}
				
				msg += "\n\n" + "Would you like to remove it from this computer or keep it "
					+ "as a read-only library?";
				
				let index = ps.confirmEx(
					null,
					"Group Not Found",
					msg,
					buttonFlags,
					"Remove Group",
					// TODO: Any way to have Esc trigger extra1 instead so it doesn't
					// have to be in this order?
					"Cancel Sync",
					"Keep Group",
					null, {}
				);
				
				if (index == 0) {
					removedGroups.push(group);
				}
				else if (index == 1) {
					Zotero.debug("Cancelling sync");
					return [];
				}
				else if (index == 2) {
					keptGroups.push(group);
				}
			}
			
			let removedLibraryIDs = [];
			for (let group of removedGroups) {
				removedLibraryIDs.push(group.libraryID);
				yield group.eraseTx();
			}
			libraries = Zotero.Utilities.arrayDiff(libraries, removedLibraryIDs);
			
			let keptLibraryIDs = [];
			for (let group of keptGroups) {
				keptLibraryIDs.push(group.libraryID);
				group.editable = false;
				group.archived = true;
				yield group.saveTx();
			}
			libraries = Zotero.Utilities.arrayDiff(libraries, keptLibraryIDs);
		}
		
		// Update metadata and permissions on missing or outdated groups
		for (let groupID of groupsToDownload) {
			let info = yield client.getGroup(groupID);
			if (!info) {
				throw new Error("Group " + groupID + " not found");
			}
			let group = Zotero.Groups.get(groupID);
			if (group) {
				// Check if the user's permissions for the group have changed, and prompt to reset
				// data if so
				let { editable, filesEditable } = Zotero.Groups.getPermissionsFromJSON(
					info.data, keyInfo.userID
				);
				let keepGoing = yield Zotero.Sync.Data.Local.checkLibraryForAccess(
					null, group.libraryID, editable, filesEditable
				);
				// User chose to skip library
				if (!keepGoing) {
					Zotero.debug("Skipping sync of group " + group.id);
					continue;
				}
			}
			else {
				group = new Zotero.Group;
				group.id = groupID;
			}
			group.version = info.version;
			group.archived = false;
			group.fromJSON(info.data, Zotero.Users.getCurrentUserID());
			yield group.saveTx();
			
			// Add group to library list
			libraries.push(group.libraryID);
		}
		
		// Note: If any non-group library types become archivable, they'll need to be unarchived here.
		Zotero.debug("Final libraries to sync:");
		Zotero.debug(libraries);
		
		return [...new Set(libraries)];
	});
	
	
	/**
	 * Run sync engine for passed libraries
	 *
	 * @param {Integer[]} libraries
	 * @param {Object} options
	 * @param {Boolean} skipUpdateLastSyncTime
	 * @return {Integer[]} - Array of libraryIDs that completed successfully
	 */
	var _doDataSync = Zotero.Promise.coroutine(function* (libraries, options, skipUpdateLastSyncTime) {
		var successfulLibraries = [];
		for (let libraryID of libraries) {
			_stopCheck();
			try {
				let opts = {};
				Object.assign(opts, options);
				opts.libraryID = libraryID;
				
				_currentEngine = new Zotero.Sync.Data.Engine(opts);
				yield _currentEngine.start();
				_currentEngine = null;
				successfulLibraries.push(libraryID);
			}
			catch (e) {
				if (e instanceof Zotero.Sync.UserCancelledException) {
					if (e.advanceToNextLibrary) {
						Zotero.debug("Sync cancelled for library " + libraryID + " -- "
							+ "advancing to next library");
						continue;
					}
					throw e;
				}
				
				Zotero.debug("Sync failed for library " + libraryID, 1);
				Zotero.logError(e);
				this.checkError(e);
				options.onError(e);
				if (stopOnError || e.fatal) {
					Zotero.debug("Stopping on error", 1);
					options.caller.stop();
					break;
				}
			}
		}
		// Update last-sync time if any libraries synced
		// TEMP: Do we want to show updated time if some libraries haven't synced?
		if (!libraries.length || successfulLibraries.length) {
			yield Zotero.Sync.Data.Local.updateLastSyncTime();
		}
		return successfulLibraries;
	}.bind(this));
	
	
	/**
	 * @return {Integer[]} - Array of libraries that need data syncing again
	 */
	var _doFileSync = Zotero.Promise.coroutine(function* (libraries, options) {
		Zotero.debug("Starting file syncing");
		var resyncLibraries = []
		for (let libraryID of libraries) {
			_stopCheck();
			let libraryName = Zotero.Libraries.get(libraryID).name;
			this.setSyncStatus(
				Zotero.getString('sync.status.syncingFilesInLibrary', libraryName)
			);
			try {
				let opts = {
					onProgress: (progress, progressMax) => {
						var remaining = progressMax - progress;
						this.setSyncStatus(
							Zotero.getString(
								'sync.status.syncingFilesInLibraryWithRemaining',
								[libraryName, remaining],
								remaining
							)
						);
					}
				};
				Object.assign(opts, options);
				opts.libraryID = libraryID;
				
				let mode = Zotero.Sync.Storage.Local.getModeForLibrary(libraryID);
				opts.controller = this.getStorageController(mode, opts);
				
				let tries = 3;
				while (true) {
					if (tries == 0) {
						throw new Error("Too many file sync attempts for library " + libraryID);
					}
					tries--;
					_currentEngine = new Zotero.Sync.Storage.Engine(opts);
					let results = yield _currentEngine.start();
					_currentEngine = null;
					if (results.syncRequired) {
						resyncLibraries.push(libraryID);
					}
					else if (results.fileSyncRequired) {
						Zotero.debug("Another file sync required -- restarting");
						continue;
					}
					break;
				}
			}
			catch (e) {
				if (e instanceof Zotero.Sync.UserCancelledException) {
					if (e.advanceToNextLibrary) {
						Zotero.debug("Storage sync cancelled for library " + libraryID + " -- "
							+ "advancing to next library");
						continue;
					}
					throw e;
				}
				
				Zotero.debug("File sync failed for library " + libraryID);
				Zotero.logError(e);
				this.checkError(e);
				options.onError(e);
				if (stopOnError || e.fatal) {
					options.caller.stop();
					break;
				}
			}
		}
		Zotero.debug("Done with file syncing");
		if (resyncLibraries.length) {
			Zotero.debug("Libraries to resync: " + resyncLibraries.join(", "));
		}
		return resyncLibraries;
	}.bind(this));
	
	
	/**
	 * @return {Integer[]} - Array of libraries that need data syncing again
	 */
	var _doFullTextSync = Zotero.Promise.coroutine(function* (libraries, options) {
		if (!Zotero.Prefs.get("sync.fulltext.enabled")) return [];
		
		Zotero.debug("Starting full-text syncing");
		this.setSyncStatus(Zotero.getString('sync.status.syncingFullText'));
		var resyncLibraries = [];
		for (let libraryID of libraries) {
			_stopCheck();
			try {
				let opts = {};
				Object.assign(opts, options);
				opts.libraryID = libraryID;
				
				_currentEngine = new Zotero.Sync.Data.FullTextEngine(opts);
				yield _currentEngine.start();
				_currentEngine = null;
			}
			catch (e) {
				if (e instanceof Zotero.Sync.UserCancelledException) {
					throw e;
				}
				
				if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.status == 412) {
					resyncLibraries.push(libraryID);
					continue;
				}
				Zotero.debug("Full-text sync failed for library " + libraryID);
				Zotero.logError(e);
				this.checkError(e);
				options.onError(e);
				if (stopOnError || e.fatal) {
					options.caller.stop();
					break;
				}
			}
		}
		Zotero.debug("Done with full-text syncing");
		if (resyncLibraries.length) {
			Zotero.debug("Libraries to resync: " + resyncLibraries.join(", "));
		}
		return resyncLibraries;
	}.bind(this));
	
	
	/**
	 * Get a storage controller for a given mode ('zfs', 'webdav'),
	 * caching it if necessary
	 */
	this.getStorageController = function (mode, options) {
		if (_storageControllers[mode]) {
			return _storageControllers[mode];
		}
		var modeClass = Zotero.Sync.Storage.Utilities.getClassForMode(mode);
		return _storageControllers[mode] = new modeClass(options);
	},
	
	
	// TODO: Call on API key change
	this.resetStorageController = function (mode) {
		delete _storageControllers[mode];
	},
	
	
	/**
	 * Download a single file on demand (not within a sync process)
	 */
	this.downloadFile = Zotero.Promise.coroutine(function* (item, requestCallbacks) {
		if (Zotero.HTTP.browserIsOffline()) {
			Zotero.debug("Browser is offline", 2);
			return false;
		}
		
		var apiKey = yield _getAPIKey();
		if (!apiKey) {
			Zotero.debug("API key not set -- skipping download");
			return false;
		}
		
		// TEMP
		var options = {};
		
		var itemID = item.id;
		var modeClass = Zotero.Sync.Storage.Local.getClassForLibrary(item.libraryID);
		var controller = new modeClass({
			apiClient: this.getAPIClient({apiKey })
		});
		
		// TODO: verify WebDAV on-demand?
		if (!controller.verified) {
			Zotero.debug("File syncing is not active for item's library -- skipping download");
			return false;
		}
		
		if (!item.isImportedAttachment()) {
			throw new Error("Not an imported attachment");
		}
		
		if (yield item.getFilePathAsync()) {
			Zotero.debug("File already exists -- replacing");
		}
		
		// TODO: start sync icon?
		// TODO: create queue for cancelling
		
		if (!requestCallbacks) {
			requestCallbacks = {};
		}
		var onStart = function (request) {
			return controller.downloadFile(request);
		};
		var request = new Zotero.Sync.Storage.Request({
			type: 'download',
			libraryID: item.libraryID,
			name: item.libraryKey,
			onStart: requestCallbacks.onStart
				? [onStart, requestCallbacks.onStart]
				: [onStart]
		});
		return request.start();
	});
	
	
	this.stop = function () {
		this.setSyncStatus(Zotero.getString('sync.stopping'));
		_stopping = true;
		if (_currentEngine) {
			_currentEngine.stop();
		}
		if (_canceller) {
			_canceller();
		}
	}
	
	
	this.end = Zotero.Promise.coroutine(function* (options) {
		_syncInProgress = false;
		yield this.checkErrors(_errors, options);
		if (!options.restartSync) {
			this.updateIcons(_errors);
		}
		_errors = [];
	});
	
	
	/**
	 * @param {Integer} timeout - Timeout in seconds
	 * @param {Boolean} [recurring=false]
	 * @param {Object} [options] - Sync options
	 */
	this.setSyncTimeout = function (timeout, recurring, options = {}) {
		if (!Zotero.Prefs.get('sync.autoSync') || !this.enabled) {
			return;
		}
		
		if (!timeout) {
			throw new Error("Timeout not provided");
		}
		
		if (_autoSyncTimer) {
			Zotero.debug("Cancelling auto-sync timer");
			_autoSyncTimer.cancel();
		}
		else {
			_autoSyncTimer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
		}
		
		var mergedOpts = {
			background: true
		};
		Object.assign(mergedOpts, options);
		
		// Implements nsITimerCallback
		var callback = {
			notify: async function (timer) {
				if (!_getAPIKey()) {
					return;
				}
				
				// If a delay is set (e.g., from the connector target selector), wait to sync.
				// We do this in sync() too for manual syncs, but no need to start spinning if
				// it's just an auto-sync.
				while (_delaySyncUntil && new Date() < _delaySyncUntil) {
					let delay = _delaySyncUntil - new Date();
					Zotero.debug(`Waiting ${delay} ms to start auto-sync`);
					await Zotero.Promise.delay(delay);
				}
				
				if (Zotero.locked) {
					Zotero.debug('Zotero is locked -- skipping auto-sync', 4);
					return;
				}
				
				if (_syncInProgress) {
					Zotero.debug('Sync already in progress -- skipping auto-sync', 4);
					return;
				}
				
				if (_manualSyncRequired) {
					Zotero.debug('Manual sync required -- skipping auto-sync', 4);
					return;
				}
				
				this.sync(mergedOpts);
			}.bind(this)
		}
		
		if (recurring) {
			Zotero.debug('Setting auto-sync interval to ' + timeout + ' seconds');
			_autoSyncTimer.initWithCallback(
				callback, timeout * 1000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
			);
		}
		else {
			if (_syncInProgress) {
				Zotero.debug('Sync in progress -- not setting auto-sync timeout', 4);
				return;
			}
			
			Zotero.debug('Setting auto-sync timeout to ' + timeout + ' seconds');
			_autoSyncTimer.initWithCallback(
				callback, timeout * 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT
			);
		}
	}
	
	
	this.clearSyncTimeout = function () {
		if (_autoSyncTimer) {
			_autoSyncTimer.cancel();
		}
	}
	
	
	this.delaySync = function (ms) {
		_delaySyncUntil = new Date(Date.now() + ms);
	};
	
	
	/**
	 * Delay syncs until the returned function is called
	 *
	 * @return {Function} - Resolve function
	 */
	this.delayIndefinite = function () {
		var resolve;
		var promise = new Zotero.Promise(function () {
			resolve = arguments[0];
		});
		_delayPromises.push(promise);
		return resolve;
	};
	
	
	/**
	 * Trigger updating of the main sync icon, the sync error icon, and
	 * library-specific sync error icons across all windows
	 */
	this.addError = function (e, libraryID) {
		if (e.added) return;
		e.added = true;
		if (libraryID) {
			e.libraryID = libraryID;
		}
		Zotero.logError(e);
		_errors.push(this.parseError(e));
	}
	
	
	this.getErrorsByLibrary = function (libraryID) {
		return _errors.filter(e => e.libraryID === libraryID);
	}
	
	
	/**
	 * Get most severe error type from an array of parsed errors
	 */
	this.getPrimaryErrorType = function (errors) {
		// Set highest priority error as the primary (sync error icon)
		var errorTypes = {
			info: 1,
			warning: 2,
			error: 3,
			upgrade: 4,
			
			// Skip these
			animate: -1
		};
		var state = false;
		for (let i = 0; i < errors.length; i++) {
			let e = errors[i];
			
			let errorType = e.errorType;
				
			if (e.fatal) {
				return 'error';
			}
			
			if (!errorType || errorTypes[errorType] < 0) {
				continue;
			}
			if (!state || errorTypes[errorType] > errorTypes[state]) {
				state = errorType;
			}
		}
		return state;
	}
	
	
	this.checkErrors = Zotero.Promise.coroutine(function* (errors, options = {}) {
		for (let e of errors) {
			let handled = yield this.checkError(e, options);
			if (handled) {
				break;
			}
		}
	});
	
	
	this.checkError = Zotero.Promise.coroutine(function* (e, options = {}) {
		if (e.name && e.name == 'Zotero Error') {
			switch (e.error) {
				case Zotero.Error.ERROR_API_KEY_NOT_SET:
				case Zotero.Error.ERROR_API_KEY_INVALID:
					// TODO: the setTimeout() call below should just simulate a click on the sync error icon
					// instead of creating its own dialog, but updateIcons() doesn't yet provide full control
					// over dialog title and primary button text/action, which is why this version of the
					// dialog is a bit uglier than the manual click version
					// TODO: localize (=>done) and combine with below (=>?)
					var msg = Zotero.getString('sync.error.invalidLogin.text');
					e.message = msg;
					e.dialogButtonText = Zotero.getString('sync.openSyncPreferences');
					e.dialogButtonCallback = function () {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.openPreferences("zotero-prefpane-sync");
					};
					
					// Manual click
					if (!options.background) {
						setTimeout(function () {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										.getService(Components.interfaces.nsIWindowMediator);
							var win = wm.getMostRecentWindow("navigator:browser");
							
							var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
							var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
												+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
							if (e.error == Zotero.Error.ERROR_API_KEY_NOT_SET) {
								var title = Zotero.getString('sync.error.usernameNotSet');
								var msg = Zotero.getString('sync.error.usernameNotSet.text');
							}
							else {
								var title = Zotero.getString('sync.error.invalidLogin');
								var msg = Zotero.getString('sync.error.invalidLogin.text');
							}
							var index = ps.confirmEx(
								win,
								title,
								msg,
								buttonFlags,
								Zotero.getString('sync.openSyncPreferences'),
								null, null, null, {}
							);
							
							if (index == 0) {
								Zotero.Utilities.Internal.openPreferences("zotero-prefpane-sync");
								return;
							}
						}, 1);
					}
					break;
			}
		}
		else if (e.name && e.name == 'ZoteroObjectUploadError') {
			let { code, data, objectType, object } = e;
			
			if (code == 413) {
				// Collection name too long
				if (objectType == 'collection' && data && data.value) {
					e.message = Zotero.getString('sync.error.collectionTooLong', [data.value]);
					
					e.dialogButtonText = Zotero.getString('pane.collections.showCollectionInLibrary');
					e.dialogButtonCallback = () => {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							.getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.collectionsView.selectCollection(object.id);
					};
				}
				else if (objectType == 'item') {
					// Tag too long
					if (data && data.tag !== undefined) {
						// Show long tag fixer and handle result
						e.dialogButtonText = Zotero.getString('general.fix');
						e.dialogButtonCallback = Zotero.Promise.coroutine(function* () {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
							var lastWin = wm.getMostRecentWindow("navigator:browser");
							
							// Open long tag fixer for every long tag in every editable library we're syncing
							var editableLibraries = options.libraries
								.filter(x => Zotero.Libraries.get(x).editable);
							for (let libraryID of editableLibraries) {
								let oldTagIDs = yield Zotero.Tags.getLongTagsInLibrary(libraryID);
								for (let oldTagID of oldTagIDs) {
									let oldTag = Zotero.Tags.getName(oldTagID);
									let dataOut = { result: null };
									lastWin.openDialog(
										'chrome://zotero/content/longTagFixer.xul',
										'',
										'chrome,modal,centerscreen',
										oldTag,
										dataOut
									);
									// If dialog was cancelled, stop
									if (!dataOut.result) {
										return;
									}
									switch (dataOut.result.op) {
									case 'split':
										for (let libraryID of editableLibraries) {
											let itemIDs = yield Zotero.Tags.getTagItems(libraryID, oldTagID);
											yield Zotero.DB.executeTransaction(function* () {
												for (let itemID of itemIDs) {
													let item = yield Zotero.Items.getAsync(itemID);
													for (let tag of dataOut.result.tags) {
														item.addTag(tag);
													}
													item.removeTag(oldTag);
													yield item.save();
												}
												yield Zotero.Tags.purge(oldTagID);
											});
										}
										break;
									
									case 'edit':
										for (let libraryID of editableLibraries) {
											let itemIDs = yield Zotero.Tags.getTagItems(libraryID, oldTagID);
											yield Zotero.DB.executeTransaction(function* () {
												for (let itemID of itemIDs) {
													let item = yield Zotero.Items.getAsync(itemID);
													item.replaceTag(oldTag, dataOut.result.tag);
													yield item.save();
												}
											});
										}
										break;
									
									case 'delete':
										for (let libraryID of editableLibraries) {
											yield Zotero.Tags.removeFromLibrary(libraryID, oldTagID);
										}
										break;
									}
								}
							}
							
							options.restartSync = true;
						});
					}
					else {
						// Note too long
						if (object.isNote() || object.isAttachment()) {
							// Throw an error that adds a button for selecting the item to the sync error dialog
							if (e.message.includes('<img src="data:image')) {
								e.message = Zotero.getString('sync.error.noteEmbeddedImage');
							}
							else if (e.message.match(/^Note '.*' too long for item/)) {
								e.message = Zotero.getString(
									'sync.error.noteTooLong',
									Zotero.Utilities.ellipsize(object.getNoteTitle(), 40)
								);
							}
						}
						// Field or creator too long
						else if (data && data.field) {
							e.message = (data.field == 'creator'
								? Zotero.getString(
									'sync.error.creatorTooLong',
									[data.value]
								)
								: Zotero.getString(
									'sync.error.fieldTooLong',
									[data.field, data.value]
								))
								+ '\n\n'
								+ Zotero.getString(
									'sync.error.reportSiteIssuesToForums',
									Zotero.clientName
								);
						}
						
						// Include "Show Item in Library" button
						e.dialogButtonText = Zotero.getString('pane.items.showItemInLibrary');
						e.dialogButtonCallback = () => {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
							var win = wm.getMostRecentWindow("navigator:browser");
							win.ZoteroPane.selectItem(object.id);
						};
					}
				}
				
				// If not a background sync, show dialog immediately
				if (!options.background && e.dialogButtonCallback) {
					let maybePromise = e.dialogButtonCallback();
					if (maybePromise && maybePromise.then) {
						yield maybePromise;
					}
				}
			}
		}
		// Show warning for unknown data that couldn't be saved
		else if (e.name && e.name == 'ZoteroInvalidDataError') {
			e.message = Zotero.getString(
				'sync.error.invalidDataError',
				[
					Zotero.Libraries.get(e.libraryID).name,
					Zotero.clientName
				]
			)
				+ "\n\n"
				+ Zotero.getString('sync.error.invalidDataError.otherData');
			e.errorType = 'warning';
			e.dialogButtonText = Zotero.getString('general.checkForUpdates');
			e.dialogButtonCallback = () => {
				Zotero.openCheckForUpdatesWindow();
			};
		}
	});
	
	
	/**
	 * Set the sync icon and sync error icon across all windows
	 *
	 * @param {Error|Error[]|'animate'} errors - An error, an array of errors, or 'animate' to
	 *                                           spin the icon. An empty array will reset the
	 *                                           icons.
	 */
	this.updateIcons = function (errors) {
		if (typeof errors == 'string') {
			var state = errors;
			errors = [];
		}
		else {
			if (!Array.isArray(errors)) {
				errors = [errors];
			}
			var state = this.getPrimaryErrorType(errors);
		}
		
		// Refresh source list
		//yield Zotero.Notifier.trigger('redraw', 'collection', []);
		
		if (errors.length == 1 && errors[0].frontWindowOnly) {
			// Fake an nsISimpleEnumerator with just the topmost window
			var enumerator = {
				_returned: false,
				hasMoreElements: function () {
					return !this._returned;
				},
				getNext: function () {
					if (this._returned) {
						throw ("No more windows to return in Zotero.Sync.Runner.updateIcons()");
					}
					this._returned = true;
					var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
					return wm.getMostRecentWindow("navigator:browser");
				}
			};
		}
		// Update all windows
		else {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator('navigator:browser');
		}
		
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if (!win.ZoteroPane) continue;
			var doc = win.ZoteroPane.document;
			
			// Update sync error icon
			var icon = doc.getElementById('zotero-tb-sync-error');
			this.updateErrorIcon(icon, state, errors);
			
			// Update sync icon
			var syncIcon = doc.getElementById('zotero-tb-sync');
			var stopIcon = doc.getElementById('zotero-tb-sync-stop');
			if (state == 'animate') {
				syncIcon.setAttribute('status', state);
				// Disable button while spinning
				syncIcon.disabled = true;
				stopIcon.hidden = false;
			}
			else {
				syncIcon.removeAttribute('status');
				syncIcon.disabled = false;
				stopIcon.hidden = true;
			}
		}
		
		// Clear status
		this.setSyncStatus();
	}
	
	
	/**
	 * Set the sync icon tooltip message
	 */
	this.setSyncStatus = function (msg) {
		_lastSyncStatus = msg;
		
		// If a label is registered, update it
		if (_currentSyncStatusLabel) {
			_updateSyncStatusLabel();
		}
	}
	
	
	this.parseError = function (e) {
		if (!e) {
			return { parsed: true };
		}
		
		// Already parsed
		if (e.parsed) {
			return e;
		}
		
		e.parsed = true;
		e.errorType = e.errorType ? e.errorType : 'error';
		
		return e;
	}
	
	
	/**
	 * Set the state of the sync error icon and add an onclick to populate
	 * the error panel
	 */
	this.updateErrorIcon = function (icon, state, errors) {
		if (!errors || !errors.length) {
			icon.hidden = true;
			icon.onclick = null;
			return;
		}
		
		icon.hidden = false;
		icon.setAttribute('state', state);
		var self = this;
		icon.onclick = function () {
			var panel = self.updateErrorPanel(this.ownerDocument, errors);
			panel.openPopup(this, "after_end", 16, 0, false, false);
		};
	}
	
	
	this.updateErrorPanel = function (doc, errors) {
		var panel = doc.getElementById('zotero-sync-error-panel');
		
		// Clear existing panel content
		while (panel.hasChildNodes()) {
			panel.removeChild(panel.firstChild);
		}
		
		for (let e of errors) {
			var box = doc.createElement('vbox');
			var label = doc.createElement('label');
			if (e.libraryID !== undefined) {
				label.className = "zotero-sync-error-panel-library-name";
				if (e.libraryID == 0) {
					var libraryName = Zotero.getString('pane.collections.library');
				}
				else {
					let group = Zotero.Groups.getByLibraryID(e.libraryID);
					var libraryName = group.name;
				}
				label.setAttribute('value', libraryName);
			}
			var content = doc.createElement('vbox');
			var buttons = doc.createElement('hbox');
			buttons.pack = 'end';
			box.appendChild(label);
			box.appendChild(content);
			box.appendChild(buttons);
			
			if (e.dialogHeader) {
				let header = doc.createElement('description');
				header.className = 'error-header';
				header.textContent = e.dialogHeader;
				content.appendChild(header);
			}
			
			// Show our own error messages directly
			var msg;
			if (e instanceof Zotero.Error) {
				msg = e.message;
			}
			// For unexpected ones, just show a generic message
			else if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.xmlhttp.responseText) {
				msg = Zotero.Utilities.ellipsize(e.xmlhttp.responseText, 1000, true);
			}
			else {
				msg = e.message;
			}
			
			var desc = doc.createElement('description');
			desc.textContent = msg;
			// Make the text selectable
			desc.setAttribute('style', '-moz-user-select: text; cursor: text');
			content.appendChild(desc);
			
			/*// If not an error and there's no explicit button text, don't show
			// button to report errors
			if (e.errorType != 'error' && e.dialogButtonText === undefined) {
				e.dialogButtonText = null;
			}*/
			
			if (e.dialogButtonText !== null) {
				if (e.dialogButtonText === undefined) {
					var buttonText = Zotero.getString('errorReport.reportError');
					var buttonCallback = function () {
						doc.defaultView.ZoteroPane.reportErrors();
					};
				}
				else {
					var buttonText = e.dialogButtonText;
					var buttonCallback = e.dialogButtonCallback;
				}
				
				var button = doc.createElement('button');
				button.setAttribute('label', buttonText);
				button.onclick = function () {
					buttonCallback();
					panel.hidePopup();
				};
				buttons.appendChild(button);
			}
			
			panel.appendChild(box)
			break;
		}
		
		return panel;
	}
	
	
	/**
	 * Register labels in sync icon tooltip to receive updates
	 *
	 * If no label passed, unregister current label
	 *
	 * @param {Tooltip} [tooltip]
	 */
	this.registerSyncStatus = function (tooltip) {
		if (tooltip) {
			_currentSyncStatusLabel = tooltip.firstChild.nextSibling;
			_currentLastSyncLabel = tooltip.firstChild.nextSibling.nextSibling;
		}
		else {
			_currentSyncStatusLabel = null;
			_currentLastSyncLabel = null;
		}
		if (_currentSyncStatusLabel) {
			_updateSyncStatusLabel();
		}
	}


	this.createAPIKeyFromCredentials = Zotero.Promise.coroutine(function* (username, password) {
		var client = this.getAPIClient();
		var json = yield client.createAPIKeyFromCredentials(username, password);
		if (!json) {
			return false;
		}

		// Sanity check
		if (!json.userID) throw new Error("userID not found in key response");
		if (!json.username) throw new Error("username not found in key response");
		if (!json.access) throw new Error("'access' not found in key response");

		Zotero.Sync.Data.Local.setAPIKey(json.key);

		return json;
	})


	this.deleteAPIKey = Zotero.Promise.coroutine(function* (){
		var apiKey = yield Zotero.Sync.Data.Local.getAPIKey();
		var client = this.getAPIClient({apiKey});
		Zotero.Sync.Data.Local.setAPIKey();
		yield client.deleteAPIKey();
	})

	
	function _updateSyncStatusLabel() {
		if (_lastSyncStatus) {
			_currentSyncStatusLabel.value = _lastSyncStatus;
			_currentSyncStatusLabel.hidden = false;
		}
		else {
			_currentSyncStatusLabel.hidden = true;
		}
		
		// Always update last sync time
		var lastSyncTime = Zotero.Sync.Data.Local.getLastSyncTime();
		if (!lastSyncTime) {
			try {
				lastSyncTime = Zotero.Sync.Data.Local.getLastClassicSyncTime();
			}
			catch (e) {
				Zotero.debug(e, 2);
				Components.utils.reportError(e);
				_currentLastSyncLabel.hidden = true;
				return;
			}
		}
		if (lastSyncTime) {
			var msg = Zotero.Date.toRelativeDate(lastSyncTime);
		}
		// Don't show "Not yet synced" if a sync is in progress
		else if (_syncInProgress) {
			_currentLastSyncLabel.hidden = true;
			return;
		}
		else {
			var msg = Zotero.getString('sync.status.notYetSynced');
		}
		
		_currentLastSyncLabel.value = Zotero.getString('sync.status.lastSync') + " " + msg;
		_currentLastSyncLabel.hidden = false;
	}
	
	
	var _getAPIKey = Zotero.Promise.method(function () {
		// Set as .apiKey on Runner in tests or set in login manager
		return _apiKey || Zotero.Sync.Data.Local.getAPIKey()
	})
	
	
	function _stopCheck() {
		if (_stopping) {
			throw new Zotero.Sync.UserCancelledException;
		}
	}
	
	
	function _cancellerReceiver(canceller) {
		_canceller = canceller;
	}
}
