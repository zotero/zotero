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

Zotero.Sync.Runner_Module = function () {
	Zotero.defineProperty(this, 'background', { get: () => _background });
	Zotero.defineProperty(this, 'lastSyncStatus', { get: () => _lastSyncStatus });
	
	const stopOnError = true;
	
	var _autoSyncTimer;
	var _background;
	var _firstInSession = true;
	var _syncInProgress = false;
	
	var _lastSyncStatus;
	var _currentSyncStatusLabel;
	var _currentLastSyncLabel;
	var _errors = [];
	
	
	/**
	 * Begin a sync session
	 *
	 * @param {Object} [options]
	 * @param {String} [apiKey]
	 * @param {Boolean} [background=false] - Whether this is a background request, which prevents
	 *                                       some alerts from being shown
	 * @param {String} [baseURL]
	 * @param {Integer[]} [libraries] - IDs of libraries to sync
	 * @param {Function} [onError] - Function to pass errors to instead of handling internally
	 *                               (used for testing)
	 */
	this.sync = Zotero.Promise.coroutine(function* (options = {}) {
		// Clear message list
		_errors = [];
		
		if (Zotero.HTTP.browserIsOffline()){
			this.clearSyncTimeout(); // DEBUG: necessary?
			var msg = Zotero.getString('general.browserIsOffline', Zotero.appName);
			var e = new Zotero.Error(msg, 0, { dialogButtonText: null })
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
			this.updateIcons(e);
			return false;
		}
		
		// Shouldn't be possible
		if (_syncInProgress) {
			let msg = Zotero.getString('sync.error.syncInProgress');
			let e = new Zotero.Error(msg, 0, { dialogButtonText: null, frontWindowOnly: true });
			this.updateIcons(e);
			return false;
		}
		_syncInProgress = true;
		
		// Purge deleted objects so they don't cause sync errors (e.g., long tags)
		yield Zotero.purgeDataObjects(true);
		
		options.apiKey = options.apiKey || Zotero.Prefs.get('devAPIKey');
		if (!options.apiKey) {
			let msg = "API key not provided";
			let e = new Zotero.Error(msg, 0, { dialogButtonText: null })
			this.updateIcons(e);
			return false;
		}
		options.baseURL = options.baseURL || ZOTERO_CONFIG.API_URL;
		if (_firstInSession) {
			options.firstInSession = true;
			_firstInSession = false;
		}
		
		_background = !!options.background;
		_syncInProgress = true;
		this.updateIcons('animate');
		
		try {
			Components.utils.import("resource://zotero/concurrent-caller.js");
			var caller = new ConcurrentCaller(4); // TEMP: one for now
			caller.setLogger(msg => Zotero.debug(msg));
			caller.stopOnError = stopOnError;
			caller.onError = function (e) {
				this.addError(e);
				if (e.fatal) {
					caller.stop();
					throw e;
				}
			}.bind(this);
			
			// TODO: Use a single client for all operations?
			var client = new Zotero.Sync.APIClient({
				baseURL: options.baseURL,
				apiVersion: ZOTERO_CONFIG.API_VERSION,
				apiKey: options.apiKey,
				concurrentCaller: caller,
				background: options.background
			});
			
			var keyInfo = yield this.checkAccess(client, options);
			if (!keyInfo) {
				this.stop();
				Zotero.debug("Syncing cancelled");
				return false;
			}
			
			var libraries = yield this.checkLibraries(client, options, keyInfo, libraries);
			
			for (let libraryID of libraries) {
				try {
					let engine = new Zotero.Sync.Data.Engine({
						libraryID: libraryID,
						apiClient: client,
						setStatus: this.setSyncStatus.bind(this),
						stopOnError: stopOnError,
						onError: this.addError.bind(this)
					});
					yield engine.start();
				}
				catch (e) {
					Zotero.debug("Sync failed for library " + libraryID);
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
					this.checkError(e);
					if (options.onError) {
						options.onError(e);
					}
					else {
						this.addError(e);
					}
					if (stopOnError || e.fatal) {
						caller.stop();
						break;
					}
				}
			}
			
			yield Zotero.Sync.Data.Local.updateLastSyncTime();
		}
		catch (e) {
			if (options.onError) {
				options.onError(e);
			}
			else {
				this.addError(e);
			}
		}
		
		this.stop();
		
		Zotero.debug("Done syncing");
		
		return;
		
		var storageSync = function () {
			Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.syncingFiles'));
			
			Zotero.Sync.Storage.sync(options)
			.then(function (results) {
				Zotero.debug("File sync is finished");
				
				if (results.errors.length) {
					Zotero.debug(results.errors, 1);
					for each(var e in results.errors) {
						Components.utils.reportError(e);
					}
					Zotero.Sync.Runner.setErrors(results.errors);
					return;
				}
				
				if (results.changesMade) {
					Zotero.debug("Changes made during file sync "
						+ "-- performing additional data sync");
					Zotero.Sync.Server.sync(finalCallbacks);
				}
				else {
					Zotero.Sync.Runner.stop();
				}
			})
			.catch(function (e) {
				Zotero.debug("File sync failed", 1);
				Zotero.Sync.Runner.error(e);
			})
			.done();
		};
		
		Zotero.Sync.Server.sync({
			// Sync 1 success
			onSuccess: storageSync,
			
			// Sync 1 skip
			onSkip: storageSync,
			
			// Sync 1 stop
			onStop: function () {
				Zotero.Sync.Runner.stop();
			},
			
			// Sync 1 error
			onError: function (e) {
				Zotero.Sync.Runner.error(e);
			}
		});
	});
	
	
	/**
	 * Check key for current user info and return access info
	 */
	this.checkAccess = Zotero.Promise.coroutine(function* (client, options) {
		var json = yield client.getKeyInfo();
		Zotero.debug(json);
		if (!json) {
			// TODO: Nicer error message
			throw new Error("Invalid API key");
		}
		
		// Sanity check
		if (!json.userID) throw new Error("userID not found in response");
		if (!json.username) throw new Error("username not found in response");
		
		// Make sure user hasn't changed, and prompt to update database if so
		if (!(yield this.checkUser(json.userID, json.username))) {
			return false;
		}
		
		return json;
	});
	
	
	this.checkLibraries = Zotero.Promise.coroutine(function* (client, options, keyInfo, libraries = []) {
		var access = keyInfo.access;
		
/*				var libraries = [
			Zotero.Libraries.userLibraryID,
			Zotero.Libraries.publicationsLibraryID,
			// Groups sorted by name
			...(Zotero.Groups.getAll().map(x => x.libraryID))
		];
*/
		
		var syncAllLibraries = !libraries.length;
		
		// TODO: Ability to remove or disable editing of user library?
		
		if (syncAllLibraries) {
			if (access.user && access.user.library) {
				libraries.push(
					Zotero.Libraries.userLibraryID, Zotero.Libraries.publicationsLibraryID
				);
			}
		}
		else {
			// Check access to specified libraries
			for (let libraryID of libraries) {
				let type = Zotero.Libraries.getType(libraryID);
				if (type == 'user' || type == 'publications') {
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
			Zotero.debug(remoteGroupVersions);
			
			for (let id in remoteGroupVersions) {
				id = parseInt(id);
				let group = Zotero.Groups.get(id);
				
				if (syncAllLibraries) {
					// If syncing all libraries, mark any that don't exist or are outdated
					// locally for update. Group is added to the library list after downloading
					if (!group || group.version < remoteGroupVersions[id]) {
						groupsToDownload.push(id);
					}
					// If not outdated, just add to library list
					else {
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
			remotelyMissingGroups = Zotero.Utilities.arrayDiff(
				syncAllLibraries
					? Zotero.Groups.getAll().map(g => g.id)
					: libraries.filter(id => Zotero.Libraries.getType(id) == 'group')
						.map(id => Zotero.Groups.getGroupIDFromLibraryID(id)),
				remoteGroupIDs
			).map(id => Zotero.Groups.get(id));
		}
		// No group access
		else {
			remotelyMissingGroups = Zotero.Groups.getAll();
		}
		
		if (remotelyMissingGroups.length) {
			// TODO: What about explicit deletions?
			
			let removedGroups = [];
			
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
					// TODO: Mark groups to be ignored
				}
			}
			
			let removedLibraryIDs = [];
			for (let group of removedGroups) {
				removedLibraryIDs.push(group.libraryID);
				yield Zotero.DB.executeTransaction(function* () {
					return group.erase();
				});
			}
			libraries = Zotero.Utilities.arrayDiff(libraries, removedLibraryIDs);
		}
		
		// Update metadata and permissions on missing or outdated groups
		for (let groupID of groupsToDownload) {
			let info = yield client.getGroupInfo(groupID);
			if (!info) {
				throw new Error("Group " + groupID + " not found");
			}
			let group = Zotero.Groups.get(groupID);
			if (!group) {
				group = new Zotero.Group;
				group.id = groupID;
			}
			group.version = info.version;
			group.fromJSON(info.data, Zotero.Users.getCurrentUserID());
			yield group.saveTx();
			
			// Add group to library list
			libraries.push(group.libraryID);
		}
		
		return [...new Set(libraries)];
	});
	
	
	/**
	 * Make sure we're syncing with the same account we used last time, and prompt if not.
	 * If user accepts, change the current user, delete existing groups, and update relation
	 * URIs to point to the new user's library.
	 *
	 * @param	{Integer}	userID			New userID
	 * @param	{Integer}	libraryID		New libraryID
	 * @param	{Integer}	noServerData	The server account is empty — this is
	 * 											the account after a server clear
	 * @return {Boolean} - True to continue, false to cancel
	 */
	this.checkUser = Zotero.Promise.coroutine(function* (userID, username) {
		var lastUserID = Zotero.Users.getCurrentUserID();
		var lastUsername = Zotero.Users.getCurrentUsername();
		
		// TEMP: Remove? No way to determine this quickly currently.
		var noServerData = false;
		
		if (lastUserID && lastUserID != userID) {
			var groups = Zotero.Groups.getAll();
			
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
				+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
				+ ps.BUTTON_POS_1_DEFAULT
				+ ps.BUTTON_DELAY_ENABLE;
			
			var msg = Zotero.getString('sync.lastSyncWithDifferentAccount', [lastUsername, username]);
			
			if (!noServerData) {
				msg += " " + Zotero.getString('sync.localDataWillBeCombined', username);
				// If there are local groups belonging to the previous user,
				// we need to remove them
				if (groups.length) {
					msg += " " + Zotero.getString('sync.localGroupsWillBeRemoved1');
				}
				msg += "\n\n" + Zotero.getString('sync.avoidCombiningData', lastUsername);
				var syncButtonText = Zotero.getString('sync.sync');
			}
			else if (groups.length) {
				msg += " " + Zotero.getString('sync.localGroupsWillBeRemoved2', [username, lastUsername]);
				var syncButtonText = Zotero.getString('sync.removeGroupsAndSync');
			}
			// If there are no local groups and the server is empty,
			// don't bother prompting
			else {
				var noPrompt = true;
			}
			
			if (!noPrompt) {
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					msg,
					buttonFlags,
					syncButtonText,
					null,
					Zotero.getString('sync.openSyncPreferences'),
					null, {}
				);
				
				if (index > 0) {
					if (index == 2) {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
						var lastWin = wm.getMostRecentWindow("navigator:browser");
						lastWin.ZoteroPane.openPreferences('zotero-prefpane-sync');
					}
					return false;
				}
			}
		}
		
		yield Zotero.DB.executeTransaction(function* () {
			if (lastUserID != userID) {
				yield Zotero.Users.setCurrentUserID(userID);
				
				if (lastUserID) {
					// Delete all local groups if changing users
					for (let group of groups) {
						yield group.erase();
					}
					
					// Update relations pointing to the old library to point to this one
					yield Zotero.Relations.updateUser(lastUserID, userID);
				}
				// Replace local user key with libraryID, in case duplicates were
				// merged before the first sync
				else {
					let repl = "local/" + Zotero.Users.getLocalUserKey();
					yield Zotero.Relations.updateUser(repl, userID);
				}
			}
			
			if (lastUsername != username) {
				yield Zotero.Users.setCurrentUsername(username);
			}
		})
		
		return true;
	});
	
	
	this.stop = function () {
		this.updateIcons(_errors);
		_errors = [];
		_syncInProgress = false;
	}
	
	
	/**
	 * Log a warning, but don't throw an error
	 */
	this.warning = function (e) {
		Zotero.debug(e, 2);
		Components.utils.reportError(e);
		e.errorType = 'warning';
		_warning = e;
	}
	
	
	this.error = function (e) {
		if (typeof e == 'string') {
			e = new Error(e);
			e.errorType = 'error';
		}
		Zotero.debug(e, 1);
		this.updateIcons(e);
		throw (e);
	}
	
	
	/**
	 * @param	{Integer}	[timeout=15]		Timeout in seconds
	 * @param	{Boolean}	[recurring=false]
	 * @param	{Boolean}	[background]		Triggered sync is a background sync
	 */
	this.setSyncTimeout = function (timeout, recurring, background) {
		// check if server/auto-sync are enabled?
		
		if (!timeout) {
			var timeout = 15;
		}
		
		if (_autoSyncTimer) {
			Zotero.debug("Cancelling auto-sync timer");
			_autoSyncTimer.cancel();
		}
		else {
			_autoSyncTimer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
		}
		
		// Implements nsITimerCallback
		var callback = {
			notify: function (timer) {
				if (!Zotero.Sync.Server.enabled) {
					return;
				}
				
				if (Zotero.locked) {
					Zotero.debug('Zotero is locked -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Storage.syncInProgress) {
					Zotero.debug('Storage sync already in progress -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Server.syncInProgress) {
					Zotero.debug('Sync already in progress -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Server.manualSyncRequired) {
					Zotero.debug('Manual sync required -- skipping auto-sync', 4);
					return;
				}
				
				this.sync({
					background: background
				});
			}
		}
		
		if (recurring) {
			Zotero.debug('Setting auto-sync interval to ' + timeout + ' seconds');
			_autoSyncTimer.initWithCallback(
				callback, timeout * 1000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
			);
		}
		else {
			if (Zotero.Sync.Storage.syncInProgress) {
				Zotero.debug('Storage sync in progress -- not setting auto-sync timeout', 4);
				return;
			}
			
			if (Zotero.Sync.Server.syncInProgress) {
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
	
	
	this.checkError = function (e, background) {
		if (e.name && e.name == 'Zotero Error') {
			switch (e.error) {
				case Zotero.Error.ERROR_SYNC_USERNAME_NOT_SET:
				case Zotero.Error.ERROR_INVALID_SYNC_LOGIN:
					// TODO: the setTimeout() call below should just simulate a click on the sync error icon
					// instead of creating its own dialog, but updateIcons() doesn't yet provide full control
					// over dialog title and primary button text/action, which is why this version of the
					// dialog is a bit uglier than the manual click version
					// TODO: localize (=>done) and combine with below (=>?)
					var msg = Zotero.getString('sync.error.invalidLogin.text');
					e.message = msg;
					e.data = {};
					e.data.dialogText = msg;
					e.data.dialogButtonText = Zotero.getString('sync.openSyncPreferences');
					e.data.dialogButtonCallback = function () {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.openPreferences("zotero-prefpane-sync");
					};
					
					// Manual click
					if (!background) {
						setTimeout(function () {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										.getService(Components.interfaces.nsIWindowMediator);
							var win = wm.getMostRecentWindow("navigator:browser");
							
							var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
							var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
												+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
							if (e.error == Zotero.Error.ERROR_SYNC_USERNAME_NOT_SET) {
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
								win.ZoteroPane.openPreferences("zotero-prefpane-sync");
								return;
							}
						}, 1);
					}
					break;
			}
		}
		
		// TEMP
		return;
		
		if (extraInfo) {
			// Server errors will generally be HTML
			extraInfo = Zotero.Utilities.unescapeHTML(extraInfo);
			Components.utils.reportError(extraInfo);
		}
		
		Zotero.debug(e, 1);
		
		if (!skipReload) {
			Zotero.reloadDataObjects();
		}
		Zotero.Sync.EventListener.resetIgnored();
	}
	
	
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
			Zotero.debug(icon + "");
			this.updateErrorIcon(icon, state, errors);
			
			// Update sync icon
			var syncIcon = doc.getElementById('zotero-tb-sync');
			if (state == 'animate') {
				syncIcon.setAttribute('status', state);
				// Disable button while spinning
				syncIcon.disabled = true;
			}
			else {
				syncIcon.removeAttribute('status');
				syncIcon.disabled = false;
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
		if (!e.data) {
			e.data = {};
		}
		
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
			var content = doc.createElement('hbox');
			var buttons = doc.createElement('hbox');
			buttons.pack = 'end';
			box.appendChild(label);
			box.appendChild(content);
			box.appendChild(buttons);
			
			// Show our own error mesages directly
			if (e instanceof Zotero.Error) {
				var msg = e.message;
			}
			// For unexpected ones, just show a generic message
			else {
				// TODO: improve and localize
				var msg = "An error occurred during syncing:\n\n" + e;
			}
			
			var desc = doc.createElement('description');
			desc.textContent = msg;
			// Make the text selectable
			desc.setAttribute('style', '-moz-user-select: text; cursor: text');
			content.appendChild(desc);
			
			/*// If not an error and there's no explicit button text, don't show
			// button to report errors
			if (e.errorType != 'error' && e.data.dialogButtonText === undefined) {
				e.data.dialogButtonText = null;
			}*/
			
			if (e.data && e.data.dialogButtonText !== null) {
				if (e.data.dialogButtonText === undefined) {
					var buttonText = Zotero.getString('errorReport.reportError');
					var buttonCallback = function () {
						doc.defaultView.ZoteroPane.reportErrors();
					};
				}
				else {
					var buttonText = e.data.dialogButtonText;
					var buttonCallback = e.data.dialogButtonCallback;
				}
				
				var button = doc.createElement('button');
				button.setAttribute('label', buttonText);
				button.onclick = buttonCallback;
				buttons.appendChild(button);
			}
			
			panel.appendChild(box)
			break;
		}
		
		return panel;
	}
	
	
	/**
	 * Register label in sync icon tooltip to receive updates
	 *
	 * If no label passed, unregister current label
	 *
	 * @param	{Tooltip}	[label]
	 */
	this.registerSyncStatusLabel = function (statusLabel, lastSyncLabel) {
		_currentSyncStatusLabel = statusLabel;
		_currentLastSyncLabel = lastSyncLabel;
		if (_currentSyncStatusLabel) {
			_updateSyncStatusLabel();
		}
	}
	
	
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
				lastSyncTime = Zotero.Sync.Data.Local.getLastClassicSyncTime()
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
}

Zotero.Sync.Runner = new Zotero.Sync.Runner_Module;
