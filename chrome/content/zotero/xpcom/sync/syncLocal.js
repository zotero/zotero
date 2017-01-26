/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

if (!Zotero.Sync.Data) {
	Zotero.Sync.Data = {};
}

Zotero.Sync.Data.Local = {
	_syncQueueIntervals: [0.5, 1, 4, 16, 16, 16, 16, 16, 16, 16, 64], // hours
	_loginManagerHost: 'chrome://zotero',
	_loginManagerRealm: 'Zotero Web API',
	_lastSyncTime: null,
	_lastClassicSyncTime: null,
	
	init: Zotero.Promise.coroutine(function* () {
		yield this._loadLastSyncTime();
		if (!_lastSyncTime) {
			yield this._loadLastClassicSyncTime();
		}
	}),
	
	
	/**
	 * @return {Promise}
	 */
	getAPIKey: Zotero.Promise.method(function () {
		var login = this._getAPIKeyLoginInfo();
		return login
			? login.password
			// Fallback to old username/password
			: this._getAPIKeyFromLogin();
	}),
	
	
	/**
	 * Check for an API key or a legacy username/password (which may or may not be valid)
	 */
	hasCredentials: function () {
		var login = this._getAPIKeyLoginInfo();
		if (login) {
			return true;
		}
		// If no API key, check for legacy login
		var username = Zotero.Prefs.get('sync.server.username');
		return username && !!this.getLegacyPassword(username)
	},
	
	
	setAPIKey: function (apiKey) {
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
			.getService(Components.interfaces.nsILoginManager);
		
		var oldLoginInfo = this._getAPIKeyLoginInfo();
		
		// Clear old login
		if ((!apiKey || apiKey === "")) {
			if (oldLoginInfo) {
				Zotero.debug("Clearing old API key");
				loginManager.removeLogin(oldLoginInfo);
			}
			Zotero.Notifier.trigger('delete', 'api-key', []);
			return;
		}
		
		var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
		var loginInfo = new nsLoginInfo(
			this._loginManagerHost,
			null,
			this._loginManagerRealm,
			'API Key',
			apiKey,
			'',
			''
		);
		if (!oldLoginInfo) {
			Zotero.debug("Setting API key");
			loginManager.addLogin(loginInfo);
		}
		else {
			Zotero.debug("Replacing API key");
			loginManager.modifyLogin(oldLoginInfo, loginInfo);
		}
		Zotero.Notifier.trigger('modify', 'api-key', []);
	},
	
	
	/**
	 * Make sure we're syncing with the same account we used last time, and prompt if not.
	 * If user accepts, change the current user and initiate deletion of all user data after a
	 * restart.
	 *
	 * @param {Window|null}
	 * @param {Integer} userID - New userID
	 * @param {Integer} username - New username
	 * @return {Boolean} - True to continue, false to cancel
	 */
	checkUser: Zotero.Promise.coroutine(function* (win, userID, username) {
		var lastUserID = Zotero.Users.getCurrentUserID();
		var lastUsername = Zotero.Users.getCurrentUsername();
		
		if (lastUserID && lastUserID != userID) {
			var io = {
				title: Zotero.getString('general.warning'),
				text: [Zotero.getString('account.lastSyncWithDifferentAccount', [ZOTERO_CONFIG.CLIENT_NAME, lastUsername, username])],
				checkboxLabel: Zotero.getString('account.confirmDelete'),
				acceptLabel: Zotero.getString('account.confirmDelete.button')
			};
			win.openDialog("chrome://zotero/content/hardConfirmationDialog.xul", "",
				"chrome, dialog, modal, centerscreen", io);
					
			var accept = false;
			if (io.accept) {
				var resetDataDirFile = OS.Path.join(Zotero.DataDirectory.dir, 'reset-data-directory');
				yield Zotero.File.putContentsAsync(resetDataDirFile, '');

				Zotero.Utilities.Internal.quitZotero(true);
				accept = true;
			}
			// else if (io.extra1) {
			// 	if (Zotero.DataDirectory.forceChange(win)) {
			// 		var ps = Services.prompt;
			// 		ps.alert(null,
			// 			Zotero.getString('general.restartRequired'),
			// 			Zotero.getString('general.restartRequiredForChange', Zotero.appName)
			// 		);
			// 		Zotero.Utilities.Internal.quitZotero(true);
			// 		accept = true;
			// 	} 
			// }
			if (accept) {
				Zotero.Prefs.clear('sync.storage.downloadMode.groups');
				Zotero.Prefs.clear('sync.storage.groups.enabled');
				Zotero.Prefs.clear('sync.storage.downloadMode.personal');
				Zotero.Prefs.clear('sync.storage.username');
				Zotero.Prefs.clear('sync.storage.url');
				Zotero.Prefs.clear('sync.storage.scheme');
				Zotero.Prefs.clear('sync.storage.protocol');
				Zotero.Prefs.clear('sync.storage.enabled');
			}
			return accept;
		}
		
		yield Zotero.DB.executeTransaction(function* () {
			if (lastUsername != username) {
				yield Zotero.Users.setCurrentUsername(username);
			} 
			if (!lastUserID) {
				yield Zotero.Users.setCurrentUserID(userID);
			}
		});
		
		return true;
	}),
	
	
	/**
	 * @return {Promise<Boolean>} - True if library updated, false to cancel
	 */
	checkLibraryForAccess: Zotero.Promise.coroutine(function* (win, libraryID, editable, filesEditable) {
		var library = Zotero.Libraries.get(libraryID);
		
		// If library is going from editable to non-editable and there's unsynced local data, prompt
		if (library.editable && !editable
				&& ((yield this._libraryHasUnsyncedData(libraryID))
					|| (yield this._libraryHasUnsyncedFiles(libraryID)))) {
			let index = Zotero.Sync.Data.Utilities.showWriteAccessLostPrompt(win, library);
			
			// Reset library
			if (index == 0) {
				// This check happens before item data is loaded for syncing, so do it now,
				// since the reset requires it
				if (!library.getDataLoaded('item')) {
					yield library.waitForDataLoad('item');
				}
				yield this.resetUnsyncedLibraryData(libraryID);
				return true;
			}
			
			// Skip library
			return false;
		}
		
		if (library.filesEditable && !filesEditable && (yield this._libraryHasUnsyncedFiles(libraryID))) {
			let index = Zotero.Sync.Storage.Utilities.showFileWriteAccessLostPrompt(win, library);
			
			// Reset library files
			if (index == 0) {
				// This check happens before item data is loaded for syncing, so do it now,
				// since the reset requires it
				if (!library.getDataLoaded('item')) {
					yield library.waitForDataLoad('item');
				}
				yield this.resetUnsyncedLibraryFiles(libraryID);
				return true;
			}
			
			// Skip library
			return false;
		}
		
		return true;
	}),
	
	
	_libraryHasUnsyncedData: Zotero.Promise.coroutine(function* (libraryID) {
		let settings = yield Zotero.SyncedSettings.getUnsynced(libraryID);
		if (Object.keys(settings).length) {
			return true;
		}
		
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(libraryID)) {
			let ids = yield Zotero.Sync.Data.Local.getUnsynced(objectType, libraryID);
			if (ids.length) {
				return true;
			}
			
			let keys = yield Zotero.Sync.Data.Local.getDeleted(objectType, libraryID);
			if (keys.length) {
				return true;
			}
		}
		
		return false;
	}),
	
	
	_libraryHasUnsyncedFiles: Zotero.Promise.coroutine(function* (libraryID) {
		yield Zotero.Sync.Storage.Local.checkForUpdatedFiles(libraryID);
		return !!(yield Zotero.Sync.Storage.Local.getFilesToUpload(libraryID));
	}),
	
	
	resetUnsyncedLibraryData: Zotero.Promise.coroutine(function* (libraryID) {
		let settings = yield Zotero.SyncedSettings.getUnsynced(libraryID);
		if (Object.keys(settings).length) {
			yield Zotero.Promise.each(Object.keys(settings), function (key) {
				return Zotero.SyncedSettings.clear(libraryID, key, { skipDeleteLog: true });
			});
		}
		
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(libraryID)) {
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			
			// New/modified objects
			let ids = yield Zotero.Sync.Data.Local.getUnsynced(objectType, libraryID);
			let keys = ids.map(id => objectsClass.getLibraryAndKeyFromID(id).key);
			let cacheVersions = yield this.getLatestCacheObjectVersions(objectType, libraryID, keys);
			let toDelete = [];
			for (let key of keys) {
				let obj = objectsClass.getByLibraryAndKey(libraryID, key);
				
				// If object is in cache, overwrite with pristine data
				if (cacheVersions[key]) {
					let json = yield this.getCacheObject(objectType, libraryID, key, cacheVersions[key]);
					yield Zotero.DB.executeTransaction(function* () {
						yield this._saveObjectFromJSON(obj, json, {});
					}.bind(this));
				}
				// Otherwise, erase
				else {
					toDelete.push(objectsClass.getIDFromLibraryAndKey(libraryID, key));
				}
			}
			if (toDelete.length) {
				yield objectsClass.erase(toDelete, { skipDeleteLog: true });
			}
			
			// Deleted objects
			keys = yield Zotero.Sync.Data.Local.getDeleted(objectType, libraryID);
			yield this.removeObjectsFromDeleteLog(objectType, libraryID, keys);
		}
		
		// Mark library for full sync
		var library = Zotero.Libraries.get(libraryID);
		library.libraryVersion = -1;
		yield library.saveTx();
		
		yield this.resetUnsyncedLibraryFiles(libraryID);
	}),
	
	
	/**
	 * Delete unsynced files from library
	 *
	 * _libraryHasUnsyncedFiles(), which checks for updated files, must be called first.
	 */
	resetUnsyncedLibraryFiles: Zotero.Promise.coroutine(function* (libraryID) {
		var itemIDs = yield Zotero.Sync.Storage.Local.getFilesToUpload(libraryID);
		for (let itemID of itemIDs) {
			let item = Zotero.Items.get(itemID);
			yield item.deleteAttachmentFile();
		}
	}),
	
	
	getSkippedLibraries: function () {
		return this._getSkippedLibrariesByPrefix("L");
	},
	
	
	getSkippedGroups: function () {
		return this._getSkippedLibrariesByPrefix("G");
	},
	
	
	_getSkippedLibrariesByPrefix: function (prefix) {
		var pref = 'sync.librariesToSkip';
		try {
			var librariesToSkip = JSON.parse(Zotero.Prefs.get(pref) || '[]');
			return librariesToSkip
				.filter(id => id.startsWith(prefix))
				.map(id => parseInt(id.substr(1)));
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.Prefs.clear(pref);
			return [];
		}
	},
	
	
	/**
	 * @return {nsILoginInfo|false}
	 */
	_getAPIKeyLoginInfo: function () {
		try {
			var loginManager = Components.classes["@mozilla.org/login-manager;1"]
				.getService(Components.interfaces.nsILoginManager);
			var logins = loginManager.findLogins(
				{},
				this._loginManagerHost,
				null,
				this._loginManagerRealm
			);
		}
		catch (e) {
			Zotero.logError(e);
			if (Zotero.isStandalone) {
				var msg = Zotero.getString('sync.error.loginManagerCorrupted1', Zotero.appName) + "\n\n"
					+ Zotero.getString('sync.error.loginManagerCorrupted2', [Zotero.appName, Zotero.appName]);
			}
			else {
				var msg = Zotero.getString('sync.error.loginManagerInaccessible') + "\n\n"
					+ Zotero.getString('sync.error.checkMasterPassword', Zotero.appName) + "\n\n"
					+ Zotero.getString('sync.error.corruptedLoginManager', Zotero.appName);
			}
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, Zotero.getString('general.error'), msg);
			return false;
		}
		
		// Get API from returned array of nsILoginInfo objects
		return logins.length ? logins[0] : false;
	},
	
	
	_getAPIKeyFromLogin: Zotero.Promise.coroutine(function* () {
		let username = Zotero.Prefs.get('sync.server.username');
		if (username) {
			// Check for legacy password if no password set in current session
			// and no API keys stored yet
			let password = this.getLegacyPassword(username);
			if (!password) {
				return "";
			}
			
			let json = yield Zotero.Sync.Runner.createAPIKeyFromCredentials(username, password);
			this.removeLegacyLogins();
			return json.key;
		}
		return "";
	}),
	
	
	getLegacyPassword: function (username) {
		var loginManagerHost = 'chrome://zotero';
		var loginManagerRealm = 'Zotero Sync Server';
		
		Zotero.debug('Getting Zotero sync password');
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
			.getService(Components.interfaces.nsILoginManager);
		try {
			var logins = loginManager.findLogins({}, loginManagerHost, null, loginManagerRealm);
		}
		catch (e) {
			Zotero.logError(e);
			return '';
		}
		
		// Find user from returned array of nsILoginInfo objects
		for (let i = 0; i < logins.length; i++) {
			if (logins[i].username == username) {
				return logins[i].password;
			}
		}
		
		// Pre-4.0.28.5 format, broken for findLogins and removeLogin in Fx41,
		var logins = loginManager.findLogins({}, loginManagerHost, "", null);
		for (let i = 0; i < logins.length; i++) {
			if (logins[i].username == username
					&& logins[i].formSubmitURL == "Zotero Sync Server") {
				return logins[i].password;
			}
		}
		return '';
	},
	
	
	removeLegacyLogins: function () {
		var loginManagerHost = 'chrome://zotero';
		var loginManagerRealm = 'Zotero Sync Server';
		
		Zotero.debug('Removing legacy Zotero sync credentials (api key acquired)');
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
			.getService(Components.interfaces.nsILoginManager);
		try {
			var logins = loginManager.findLogins({}, loginManagerHost, null, loginManagerRealm);
		}
		catch (e) {
			Zotero.logError(e);
			return '';
		}
		
		// Remove all legacy users
		for (let login of logins) {
			loginManager.removeLogin(login);
		}
		// Remove the legacy pref
		Zotero.Prefs.clear('sync.server.username');
	},
	
	
	getLastSyncTime: function () {
		if (_lastSyncTime === null) {
			throw new Error("Last sync time not yet loaded");
		}
		return _lastSyncTime;
	},
	
	
	/**
	 * @return {Promise}
	 */
	updateLastSyncTime: function () {
		_lastSyncTime = new Date();
		return Zotero.DB.queryAsync(
			"REPLACE INTO version (schema, version) VALUES ('lastsync', ?)",
			Math.round(_lastSyncTime.getTime() / 1000)
		);
	},
	
	
	_loadLastSyncTime: Zotero.Promise.coroutine(function* () {
		var sql = "SELECT version FROM version WHERE schema='lastsync'";
		var lastsync = yield Zotero.DB.valueQueryAsync(sql);
		_lastSyncTime = (lastsync ? new Date(lastsync * 1000) : false);
	}),
	
	
	/**
	 * @param {String} objectType
	 * @param {Integer} libraryID
	 * @return {Promise<String[]>} - A promise for an array of object keys
	 */
	getSynced: function (objectType, libraryID) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var sql = "SELECT key FROM " + objectsClass.table + " WHERE libraryID=? AND synced=1";
		return Zotero.DB.columnQueryAsync(sql, [libraryID]);
	},
	
	
	/**
	 * @param {String} objectType
	 * @param {Integer} libraryID
	 * @return {Promise<Integer[]>} - A promise for an array of object ids
	 */
	getUnsynced: Zotero.Promise.coroutine(function* (objectType, libraryID) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var sql = "SELECT O." + objectsClass.idColumn + " FROM " + objectsClass.table + " O";
		if (objectType == 'item') {
			sql += " LEFT JOIN itemAttachments IA USING (itemID) "
				+ "LEFT JOIN itemNotes INo ON (O.itemID=INo.itemID) ";
		}
		sql += " WHERE libraryID=? AND synced=0";
		// Sort child items last
		if (objectType == 'item') {
			sql += " ORDER BY COALESCE(IA.parentItemID, INo.parentItemID)";
		}
		
		var ids = yield Zotero.DB.columnQueryAsync(sql, [libraryID]);
		
		// Sort descendent collections last
		if (objectType == 'collection') {
			ids = Zotero.Collections.sortByLevel(ids);
		}
		
		return ids;
	}),
	
	
	//
	// Cache management
	//
	/**
	 * Gets the latest version for each object of a given type in the given library
	 *
	 * @return {Promise<Object>} - A promise for an object with object keys as keys and versions
	 *                             as properties
	 */
	getLatestCacheObjectVersions: Zotero.Promise.coroutine(function* (objectType, libraryID, keys=[]) {
		var versions = {};
		
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			keys,
			Zotero.DB.MAX_BOUND_PARAMETERS - 2,
			Zotero.Promise.coroutine(function* (chunk) {
				// The MAX(version) ensures we get the data from the most recent version of the object,
				// thanks to SQLite 3.7.11 (http://www.sqlite.org/releaselog/3_7_11.html)
				var sql = "SELECT key, MAX(version) AS version FROM syncCache "
					+ "WHERE libraryID=? AND "
					+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM syncObjectTypes WHERE name=?) ";
				var params = [libraryID, objectType]
				if (chunk.length) {
					sql += "AND key IN (" + chunk.map(key => '?').join(', ') + ") ";
					params = params.concat(chunk);
				}
				sql += "GROUP BY libraryID, key";
				var rows = yield Zotero.DB.queryAsync(sql, params);
				
				for (let i = 0; i < rows.length; i++) {
					let row = rows[i];
					versions[row.key] = row.version;
				}
			})
		);
		
		return versions;
	}),
	
	
	/**
	 * @return {Promise<Integer[]>} - A promise for an array of object versions
	 */
	getCacheObjectVersions: function (objectType, libraryID, key) {
		var sql = "SELECT version FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?) ORDER BY version";
		return Zotero.DB.columnQueryAsync(sql, [libraryID, key, objectType]);
	},
	
	
	/**
	 * @return {Promise<Number>} - A promise for an object version
	 */
	getLatestCacheObjectVersion: function (objectType, libraryID, key) {
		var sql = "SELECT version FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?) ORDER BY VERSION DESC LIMIT 1";
		return Zotero.DB.valueQueryAsync(sql, [libraryID, key, objectType]);
	},
	
	
	/**
	 * @return {Promise}
	 */
	getCacheObject: Zotero.Promise.coroutine(function* (objectType, libraryID, key, version) {
		var sql = "SELECT data FROM syncCache WHERE libraryID=? AND key=? AND version=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?)";
		var data = yield Zotero.DB.valueQueryAsync(sql, [libraryID, key, version, objectType]);
		if (data) {
			return JSON.parse(data);
		}
		return false;
	}),
	
	
	getCacheObjects: Zotero.Promise.coroutine(function* (objectType, libraryID, keyVersionPairs) {
		if (!keyVersionPairs.length) return [];
		var sql = "SELECT data FROM syncCache SC JOIN (SELECT "
			+ keyVersionPairs.map(function (pair) {
				Zotero.DataObjectUtilities.checkKey(pair[0]);
				return "'" + pair[0] + "' AS key, " + parseInt(pair[1]) + " AS version";
			}).join(" UNION SELECT ")
			+ ") AS pairs ON (pairs.key=SC.key AND pairs.version=SC.version) "
			+ "WHERE libraryID=? AND "
			+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM syncObjectTypes WHERE name=?)";
		var rows = yield Zotero.DB.columnQueryAsync(sql, [libraryID, objectType]);
		return rows.map(row => JSON.parse(row));
	}),
	
	
	saveCacheObject: Zotero.Promise.coroutine(function* (objectType, libraryID, json) {
		json = this._checkCacheJSON(json);
		
		Zotero.debug("Saving to sync cache:");
		Zotero.debug(json);
		
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "INSERT OR REPLACE INTO syncCache "
			+ "(libraryID, key, syncObjectTypeID, version, data) VALUES (?, ?, ?, ?, ?)";
		var params = [libraryID, json.key, syncObjectTypeID, json.version, JSON.stringify(json)];
		return Zotero.DB.queryAsync(sql, params);
	}),
	
	
	saveCacheObjects: Zotero.Promise.coroutine(function* (objectType, libraryID, jsonArray) {
		if (!Array.isArray(jsonArray)) {
			throw new Error("'json' must be an array");
		}
		
		if (!jsonArray.length) {
			Zotero.debug("No " + Zotero.DataObjectUtilities.getObjectTypePlural(objectType)
				+ " to save to sync cache");
			return;
		}
		
		jsonArray = jsonArray.map(json => this._checkCacheJSON(json));
		
		Zotero.debug("Saving to sync cache:");
		Zotero.debug(jsonArray);
		
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "INSERT OR REPLACE INTO syncCache "
			+ "(libraryID, key, syncObjectTypeID, version, data) VALUES ";
		var chunkSize = Math.floor(Zotero.DB.MAX_BOUND_PARAMETERS / 5);
		return Zotero.DB.executeTransaction(function* () {
			return Zotero.Utilities.Internal.forEachChunkAsync(
				jsonArray,
				chunkSize,
				Zotero.Promise.coroutine(function* (chunk) {
					var params = [];
					for (let i = 0; i < chunk.length; i++) {
						let o = chunk[i];
						params.push(libraryID, o.key, syncObjectTypeID, o.version, JSON.stringify(o));
					}
					return Zotero.DB.queryAsync(
						sql + chunk.map(() => "(?, ?, ?, ?, ?)").join(", "), params
					);
				})
			);
		}.bind(this));
	}),
	
	
	/**
	 * Process downloaded JSON and update local objects
	 *
	 * @return {Promise<Object[]>} - Promise for an array of objects with the following properties:
	 *         {String} key
	 *         {Boolean} processed
	 *         {Object} [error]
	 *         {Boolean} [retry]
	 *         {Boolean} [conflict=false]
	 *         {Object} [left] - Local JSON data for conflict (or .deleted and .dateDeleted)
	 *         {Object} [right] - Remote JSON data for conflict
	 *         {Object[]} [changes] - An array of operations to apply locally to resolve conflicts,
	 *             as returned by _reconcileChanges()
	 *         {Object[]} [conflicts] - An array of conflicting fields that can't be resolved automatically
	 */
	processObjectsFromJSON: Zotero.Promise.coroutine(function* (objectType, libraryID, json, options = {}) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		var ObjectType = Zotero.Utilities.capitalize(objectType);
		var libraryName = Zotero.Libraries.get(libraryID).name;
		
		var knownErrors = [
			'ZoteroUnknownTypeError',
			'ZoteroUnknownFieldError',
			'ZoteroMissingObjectError'
		];
		
		Zotero.debug("Processing " + json.length + " downloaded "
			+ (json.length == 1 ? objectType : objectTypePlural)
			+ " for " + libraryName);
		
		var results = [];
		
		if (!json.length) {
			return results;
		}
		
		json = json.map(o => this._checkCacheJSON(o));
		
		if (options.setStatus) {
			options.setStatus("Downloading " + objectTypePlural + " in " + libraryName); // TODO: localize
		}
		
		// Sort parent objects first, to avoid retries due to unmet dependencies
		if (objectType == 'item' || objectType == 'collection') {
			let parentProp = 'parent' + objectType[0].toUpperCase() + objectType.substr(1);
			json.sort(function (a, b) {
				if (a[parentProp] && !b[parentProp]) return 1;
				if (b[parentProp] && !a[parentProp]) return -1;
				return 0;
			});
		}
		
		var batchSize = options.getNotifierBatchSize ? options.getNotifierBatchSize() : json.length;
		var notifierQueues = [];
		
		try {
			for (let i = 0; i < json.length; i++) {
				// Batch notifier updates
				if (notifierQueues.length == batchSize) {
					yield Zotero.Notifier.commit(notifierQueues);
					notifierQueues = [];
					// Get the current batch size, which might have increased
					if (options.getNotifierBatchSize) {
						batchSize = options.getNotifierBatchSize()
					}
				}
				let notifierQueue = new Zotero.Notifier.Queue;
				
				let jsonObject = json[i];
				let jsonData = jsonObject.data;
				let objectKey = jsonObject.key;
				
				let saveOptions = {};
				Object.assign(saveOptions, options);
				saveOptions.isNewObject = false;
				saveOptions.skipCache = false;
				saveOptions.storageDetailsChanged = false;
				saveOptions.notifierQueue = notifierQueue;
				
				Zotero.debug(`Processing ${objectType} ${libraryID}/${objectKey}`);
				Zotero.debug(jsonObject);
				
				// Skip objects with unmet dependencies
				if (objectType == 'item' || objectType == 'collection') {
					let parentProp = 'parent' + objectType[0].toUpperCase() + objectType.substr(1);
					let parentKey = jsonData[parentProp];
					if (parentKey) {
						let parentObj = yield objectsClass.getByLibraryAndKeyAsync(
							libraryID, parentKey, { noCache: true }
						);
						if (!parentObj) {
							let error = new Error("Parent of " + objectType + " "
								+ libraryID + "/" + jsonData.key + " not found -- skipping");
							error.name = "ZoteroMissingObjectError";
							Zotero.debug(error.message);
							results.push({
								key: objectKey,
								processed: false,
								error,
								retry: true
							});
							continue;
						}
					}
					
					/*if (objectType == 'item') {
						for (let j = 0; j < jsonData.collections.length; i++) {
							let parentKey = jsonData.collections[j];
							let parentCollection = Zotero.Collections.getByLibraryAndKey(
								libraryID, parentKey, { noCache: true }
							);
							if (!parentCollection) {
								// ???
							}
						}
					}*/
				}
				
				// Errors have to be thrown in order to roll back the transaction, so catch those here
				// and continue
				try {
					yield Zotero.DB.executeTransaction(function* () {
						let obj = yield objectsClass.getByLibraryAndKeyAsync(
							libraryID, objectKey, { noCache: true }
						);
						if (obj) {
							Zotero.debug("Matching local " + objectType + " exists", 4);
							
							let jsonDataLocal = obj.toJSON();
							
							// For items, check if mtime or file hash changed in metadata,
							// which would indicate that a remote storage sync took place and
							// a download is needed
							if (objectType == 'item' && obj.isImportedAttachment()) {
								if (jsonDataLocal.mtime != jsonData.mtime
										|| jsonDataLocal.md5 != jsonData.md5) {
									saveOptions.storageDetailsChanged = true;
								}
							}
							
							// Local object has been modified since last sync
							if (!obj.synced) {
								Zotero.debug("Local " + objectType + " " + obj.libraryKey
										+ " has been modified since last sync", 4);
								
								let cachedJSON = yield this.getCacheObject(
									objectType, obj.libraryID, obj.key, obj.version
								);
								
								let result = this._reconcileChanges(
									objectType,
									cachedJSON.data,
									jsonDataLocal,
									jsonData,
									['mtime', 'md5', 'dateAdded', 'dateModified']
								);
								
								// If no changes, update local version number and mark as synced
								if (!result.changes.length && !result.conflicts.length) {
									Zotero.debug("No remote changes to apply to local "
										+ objectType + " " + obj.libraryKey);
									
									let saveResults = yield this._saveObjectFromJSON(
										obj,
										jsonObject,
										{
											skipData: true,
											notifierQueue,
											// Save as unsynced
											saveAsChanged: !!result.localChanged
										}
									);
									results.push(saveResults);
									if (!saveResults.processed) {
										throw saveResults.error;
									}
									return;
								}
								
								if (result.conflicts.length) {
									if (objectType != 'item') {
										throw new Error(`Unexpected conflict on ${objectType} object`);
									}
									Zotero.debug("Conflict!", 2);
									Zotero.debug(jsonDataLocal);
									Zotero.debug(jsonData);
									Zotero.debug(result);
									results.push({
										libraryID,
										key: objectKey,
										processed: false,
										conflict: true,
										left: jsonDataLocal,
										right: jsonData,
										changes: result.changes,
										conflicts: result.conflicts
									});
									return;
								}
								
								// If no conflicts, apply remote changes automatically
								Zotero.debug(`Applying remote changes to ${objectType} `
									+ obj.libraryKey);
								Zotero.debug(result.changes);
								Zotero.DataObjectUtilities.applyChanges(
									jsonDataLocal, result.changes
								);
								// Transfer properties that aren't in the changeset
								['version', 'dateAdded', 'dateModified'].forEach(x => {
									if (jsonDataLocal[x] !== jsonData[x]) {
										Zotero.debug(`Applying remote '${x}' value`);
									}
									jsonDataLocal[x] = jsonData[x];
								})
								jsonObject.data = jsonDataLocal;
								
								// Save as unsynced
								if (results.localChanged) {
									saveOptions.saveAsChanged = true;
								}
							}
						}
						// Object doesn't exist locally
						else {
							Zotero.debug(ObjectType + " doesn't exist locally");
							
							saveOptions.isNewObject = true;
							
							// Check if object has been deleted locally
							let dateDeleted = yield this.getDateDeleted(
								objectType, libraryID, objectKey
							);
							if (dateDeleted) {
								Zotero.debug(ObjectType + " was deleted locally");
								
								switch (objectType) {
								case 'item':
									if (jsonData.deleted) {
										Zotero.debug("Remote item is in trash -- allowing local deletion to propagate");
										results.push({
											libraryID,
											key: objectKey,
											processed: true
										});
										return;
									}
									
									results.push({
										libraryID,
										key: objectKey,
										processed: false,
										conflict: true,
										left: {
											deleted: true,
											dateDeleted: Zotero.Date.dateToSQL(dateDeleted, true)
										},
										right: jsonData
									});
									return;
								
								// Auto-restore some locally deleted objects that have changed remotely
								case 'collection':
								case 'search':
									yield this.removeObjectsFromDeleteLog(
										objectType,
										libraryID,
										[objectKey]
									);
									
									throw new Error("Unimplemented");
									break;
								
								default:
									throw new Error("Unknown object type '" + objectType + "'");
								}
							}
							
							// Create new object
							obj = new Zotero[ObjectType];
							obj.libraryID = libraryID;
							obj.key = objectKey;
							yield obj.loadPrimaryData();
							
							// Don't cache new items immediately, which skips reloading after save
							saveOptions.skipCache = true;
						}
						
						let saveResults = yield this._saveObjectFromJSON(obj, jsonObject, saveOptions);
						results.push(saveResults);
						if (!saveResults.processed) {
							throw saveResults.error;
						}
					}.bind(this));
					
					if (notifierQueue.size) {
						notifierQueues.push(notifierQueue);
					}
				}
				catch (e) {
					// Display nicer debug line for known errors
					if (knownErrors.indexOf(e.name) != -1) {
						let desc = e.name
							.replace(/^Zotero/, "")
							// Convert "MissingObjectError" to "missing object error"
							.split(/([a-z]+)/).join(' ').trim()
							.replace(/([A-Z]) ([a-z]+)/g, "$1$2").toLowerCase();
						let msg = Zotero.Utilities.capitalize(desc) + " for "
							+ `${objectType} ${jsonObject.key} in ${Zotero.Libraries.get(libraryID).name}`;
						Zotero.debug(msg, 2);
						Zotero.debug(e, 2);
						Components.utils.reportError(msg + ": " + e.message);
					}
					else {
						Zotero.logError(e);
					}
					
					if (options.onError) {
						options.onError(e);
					}
					
					if (Zotero.DB.closed) {
						e.fatal = true;
					}
					if (options.stopOnError || e.fatal) {
						throw e;
					}
				}
				finally {
					if (options.onObjectProcessed) {
						options.onObjectProcessed();
					}
				}
				
				yield Zotero.Promise.delay(10);
			}
		}
		finally {
			if (notifierQueues.length) {
				yield Zotero.Notifier.commit(notifierQueues);
			}
		}
		
		let processed = 0;
		let skipped = 0;
		results.forEach(x => x.processed ? processed++ : skipped++);
		
		Zotero.debug(`Processed ${processed} `
			+ (processed == 1 ? objectType : objectTypePlural)
			+ (skipped ? ` and skipped ${skipped}` : "")
			+ " in " + libraryName);
		
		return results;
	}),
	
	
	_checkCacheJSON: function (json) {
		if (json.key === undefined) {
			Zotero.debug(json, 1);
			throw new Error("Missing 'key' property in JSON");
		}
		if (json.version === undefined) {
			Zotero.debug(json, 1);
			throw new Error("Missing 'version' property in JSON");
		}
		// If direct data object passed, wrap in fake response object
		return json.data === undefined ? {
			key: json.key,
			version: json.version,
			data: json
		} :  json;
	},
	
	
	/**
	 * Check whether an attachment's file mod time matches the given mod time, and mark the file
	 * for download if not (or if this is a new attachment)
	 */
	_checkAttachmentForDownload: Zotero.Promise.coroutine(function* (item, mtime, isNewObject) {
		var markToDownload = false;
		if (!isNewObject) {
			// Convert previously used Unix timestamps to ms-based timestamps
			if (mtime < 10000000000) {
				Zotero.debug("Converting Unix timestamp '" + mtime + "' to ms");
				mtime = mtime * 1000;
			}
			var fmtime = null;
			try {
				fmtime = yield item.attachmentModificationTime;
			}
			catch (e) {
				// This will probably fail later too, but ignore it for now
				Zotero.logError(e);
			}
			if (fmtime) {
				let state = Zotero.Sync.Storage.Local.checkFileModTime(item, fmtime, mtime);
				if (state !== false) {
					markToDownload = true;
				}
			}
			else {
				markToDownload = true;
			}
		}
		else {
			markToDownload = true;
		}
		if (markToDownload) {
			item.attachmentSyncState = "to_download";
		}
	}),
	
	
	/**
	 * Delete one or more versions of an object from the sync cache
	 *
	 * @param {String} objectType
	 * @param {Integer} libraryID
	 * @param {String} key
	 * @param {Integer} [minVersion]
	 * @param {Integer} [maxVersion]
	 */
	deleteCacheObjectVersions: function (objectType, libraryID, key, minVersion, maxVersion) {
		var sql = "DELETE FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?)";
		var params = [libraryID, key, objectType];
		if (minVersion && minVersion == maxVersion) {
			sql += " AND version=?";
			params.push(minVersion);
		}
		else {
			if (minVersion) {
				sql += " AND version>=?";
				params.push(minVersion);
			}
			if (maxVersion || maxVersion === 0) {
				sql += " AND version<=?";
				params.push(maxVersion);
			}
		}
		return Zotero.DB.queryAsync(sql, params);
	},
	
	
	processConflicts: Zotero.Promise.coroutine(function* (objectType, libraryID, conflicts, options = {}) {
		if (!conflicts.length) return [];
		
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var ObjectType = Zotero.Utilities.capitalize(objectType);
		
		// Sort conflicts by local Date Modified/Deleted
		conflicts.sort(function (a, b) {
			var d1 = a.left.dateDeleted || a.left.dateModified;
			var d2 = b.left.dateDeleted || b.left.dateModified;
			if (d1 > d2) {
				return 1
			}
			if (d1 < d2) {
				return -1;
			}
			return 0;
		})
		
		var results = [];
		
		var mergeData = this.showConflictResolutionWindow(conflicts);
		if (!mergeData) {
			Zotero.debug("Conflict resolution was cancelled", 2);
			for (let conflict of conflicts) {
				results.push({
					// Use key from either, in case one side is deleted
					key: conflict.left.key || conflict.right.key,
					processed: false,
					retry: false
				});
			}
			return results;
		}
		
		Zotero.debug("Processing resolved conflicts");
		
		let batchSize = mergeData.length;
		let notifierQueues = [];
		try {
			for (let i = 0; i < mergeData.length; i++) {
				// Batch notifier updates
				if (notifierQueues.length == batchSize) {
					yield Zotero.Notifier.commit(notifierQueues);
					notifierQueues = [];
				}
				let notifierQueue = new Zotero.Notifier.Queue;
				
				let json = mergeData[i];
				
				let saveOptions = {};
				Object.assign(saveOptions, options);
				// Tell _saveObjectFromJSON() to save as unsynced
				saveOptions.saveAsChanged = true;
				saveOptions.notifierQueue = notifierQueue;
				
				// Errors have to be thrown in order to roll back the transaction, so catch
				// those here and continue
				try {
					yield Zotero.DB.executeTransaction(function* () {
						let obj = yield objectsClass.getByLibraryAndKeyAsync(
							libraryID, json.key, { noCache: true }
						);
						// Update object with merge data
						if (obj) {
							// Delete local object
							if (json.deleted) {
								try {
									yield obj.erase({
										notifierQueue
									});
								}
								catch (e) {
									results.push({
										key: json.key,
										processed: false,
										error: e,
										retry: false
									});
									throw e;
								}
								results.push({
									key: json.key,
									processed: true
								});
								return;
							}
							
							// Save merged changes below
						}
						// If no local object and merge wanted a delete, we're good
						else if (json.deleted) {
							results.push({
								key: json.key,
								processed: true
							});
							return;
						}
						// Recreate locally deleted object
						else {
							obj = new Zotero[ObjectType];
							obj.libraryID = libraryID;
							obj.key = json.key;
							yield obj.loadPrimaryData();
							
							// Don't cache new items immediately,
							// which skips reloading after save
							saveOptions.skipCache = true;
						}
						
						let saveResults = yield this._saveObjectFromJSON(
							obj, json, saveOptions
						);
						results.push(saveResults);
						if (!saveResults.processed) {
							throw saveResults.error;
						}
					}.bind(this));
					
					if (notifierQueue.size) {
						notifierQueues.push(notifierQueue);
					}
				}
				catch (e) {
					Zotero.logError(e);
					
					if (options.onError) {
						options.onError(e);
					}
					
					if (options.stopOnError) {
						throw e;
					}
				}
			}
		}
		finally {
			if (notifierQueues.length) {
				yield Zotero.Notifier.commit(notifierQueues);
			}
		}
		
		return results;
	}),
	
	
	showConflictResolutionWindow: function (conflicts) {
		Zotero.debug("Showing conflict resolution window");
		Zotero.debug(conflicts);
		
		var io = {
			dataIn: {
				captions: [
					Zotero.getString('sync.conflict.localItem'),
					Zotero.getString('sync.conflict.remoteItem'),
					Zotero.getString('sync.conflict.mergedItem')
				],
				conflicts
			}
		};
		var url = 'chrome://zotero/content/merge.xul';
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		if (lastWin) {
			lastWin.openDialog(url, '', 'chrome,modal,centerscreen', io);
		}
		else {
			// When using nsIWindowWatcher, the object has to be wrapped here
			// https://developer.mozilla.org/en-US/docs/Working_with_windows_in_chrome_code#Example_5_Using_nsIWindowWatcher_for_passing_an_arbritrary_JavaScript_object
			io.wrappedJSObject = io;
			let ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Components.interfaces.nsIWindowWatcher);
			ww.openWindow(null, url, '', 'chrome,modal,centerscreen,dialog', io);
		}
		if (io.error) {
			throw io.error;
		}
		return io.dataOut;
	},
	
	
	//
	// Classic sync
	//
	getLastClassicSyncTime: function () {
		if (_lastClassicSyncTime === null) {
			throw new Error("Last classic sync time not yet loaded");
		}
		return _lastClassicSyncTime;
	},
	
	_loadLastClassicSyncTime: Zotero.Promise.coroutine(function* () {
		var sql = "SELECT version FROM version WHERE schema='lastlocalsync'";
		var lastsync = yield Zotero.DB.valueQueryAsync(sql);
		_lastClassicSyncTime = (lastsync ? new Date(lastsync * 1000) : false);
	}),
	
	_saveObjectFromJSON: Zotero.Promise.coroutine(function* (obj, json, options) {
		var results = {};
		try {
			results.key = json.key;
			json = this._checkCacheJSON(json);
			
			if (!options.skipData) {
				obj.fromJSON(json.data);
			}
			if (obj.objectType == 'item' && obj.isImportedAttachment()) {
				yield this._checkAttachmentForDownload(obj, json.data.mtime, options.isNewObject);
			}
			obj.version = json.data.version;
			if (!options.saveAsChanged) {
				obj.synced = true;
			}
			yield obj.save({
				skipEditCheck: true,
				skipDateModifiedUpdate: true,
				skipSelect: true,
				skipCache: options.skipCache || false,
				notifierQueue: options.notifierQueue,
				// Errors are logged elsewhere, so skip in DataObject.save()
				errorHandler: function (e) {
					return;
				}
			});
			yield this.saveCacheObject(obj.objectType, obj.libraryID, json.data);
			results.processed = true;
			
			// Delete older versions of the object in the cache
			yield this.deleteCacheObjectVersions(
				obj.objectType, obj.libraryID, json.key, null, json.version - 1
			);
			
			// Delete from sync queue
			yield this._removeObjectFromSyncQueue(obj.objectType, obj.libraryID, json.key);
			
			// Mark updated attachments for download
			if (obj.objectType == 'item' && obj.isImportedAttachment()) {
				// If storage changes were made (attachment mtime or hash), mark
				// library as requiring download
				if (options.isNewObject || options.storageDetailsChanged) {
					Zotero.Libraries.get(obj.libraryID).storageDownloadNeeded = true;
				}
			}
		}
		catch (e) {
			// For now, allow sync to proceed after all errors
			results.processed = false;
			results.error = e;
			results.retry = false;
		}
		return results;
	}),
	
	
	/**
	 * Calculate a changeset to apply locally to resolve an object conflict, plus a list of
	 * conflicts where not possible
	 */
	_reconcileChanges: function (objectType, originalJSON, currentJSON, newJSON, ignoreFields) {
		if (!originalJSON) {
			return this._reconcileChangesWithoutCache(objectType, currentJSON, newJSON, ignoreFields);
		}
		
		var changeset1 = Zotero.DataObjectUtilities.diff(originalJSON, currentJSON, ignoreFields);
		var changeset2 = Zotero.DataObjectUtilities.diff(originalJSON, newJSON, ignoreFields);
		
		Zotero.debug("CHANGESET1");
		Zotero.debug(changeset1);
		Zotero.debug("CHANGESET2");
		Zotero.debug(changeset2);
		
		var conflicts = [];
		
		for (let i = 0; i < changeset1.length; i++) {
			for (let j = 0; j < changeset2.length; j++) {
				let c1 = changeset1[i];
				let c2 = changeset2[j];
				if (c1.field != c2.field) {
					continue;
				}
				
				// Disregard member additions/deletions for different values
				if (c1.op.startsWith('member-') && c2.op.startsWith('member-')) {
					switch (c1.field) {
					case 'collections':
						if (c1.value !== c2.value) {
							continue;
						}
						break;
					
					case 'creators':
						if (!Zotero.Creators.equals(c1.value, c2.value)) {
							continue;
						}
						break;
					
					case 'tags':
						if (!Zotero.Tags.equals(c1.value, c2.value)) {
							// If just a type difference, treat as modify with type 0 if
							// not type 0 in changeset1
							if (c1.op == 'member-add' && c2.op == 'member-add'
									&& c1.value.tag === c2.value.tag) {
								changeset1.splice(i--, 1);
								changeset2.splice(j--, 1);
								if (c1.value.type > 0) {
									changeset2.push({
										field: "tags",
										op: "member-remove",
										value: c1.value
									});
									changeset2.push({
										field: "tags",
										op: "member-add",
										value: c2.value
									});
								}
							}
							continue;
						}
						break;
					}
				}
				
				// Disregard member additions/deletions for different properties and values
				if (c1.op.startsWith('property-member-') && c2.op.startsWith('property-member-')) {
					if (c1.value.key !== c2.value.key || c1.value.value !== c2.value.value) {
						continue;
					}
				}
				
				// Changes are equal or in conflict
				
				// Removed on both sides
				if (c1.op == 'delete' && c2.op == 'delete') {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// Added or removed members on both sides
				if ((c1.op == 'member-add' && c2.op == 'member-add')
						|| (c1.op == 'member-remove' && c2.op == 'member-remove')
						|| (c1.op == 'property-member-add' && c2.op == 'property-member-add')
						|| (c1.op == 'property-member-remove' && c2.op == 'property-member-remove')) {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// If both sides have values, see if they're the same, and if so remove the
				// second one
				if (c1.op != 'delete' && c2.op != 'delete' && c1.value === c2.value) {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// Automatically apply remote changes if both items are in trash and for non-items,
				// even if in conflict
				if ((objectType == 'item' && currentJSON.deleted && newJSON.deleted)
						|| objectType != 'item') {
					continue;
				}
				
				// Conflict
				changeset2.splice(j--, 1);
				conflicts.push([c1, c2]);
			}
		}
		
		return {
			changes: changeset2,
			conflicts: conflicts
		};
	},
	
	
	/**
	 * Calculate a changeset to apply locally to resolve an object conflict in absence of a
	 * cached version. Members and property members (e.g., collections, tags, relations)
	 * are combined, so any removals will be automatically undone. Field changes result in
	 * conflicts.
	 */
	_reconcileChangesWithoutCache: function (objectType, currentJSON, newJSON, ignoreFields) {
		var changeset = Zotero.DataObjectUtilities.diff(currentJSON, newJSON, ignoreFields);
		
		var changes = [];
		var conflicts = [];
		
		for (let i = 0; i < changeset.length; i++) {
			let c2 = changeset[i];
			
			// Member changes are additive only, so ignore removals
			if (c2.op.endsWith('-remove')) {
				continue;
			}
			
			// Record member changes
			if (c2.op.startsWith('member-') || c2.op.startsWith('property-member-')) {
				changes.push(c2);
				continue;
			}
			
			// Automatically apply remote changes for non-items, even if in conflict
			if ((objectType == 'item' && currentJSON.deleted && newJSON.deleted)
						|| objectType != 'item') {
				changes.push(c2);
				continue;
			}
			
			// Field changes are conflicts
			//
			// Since we don't know what changed, use only 'add' and 'delete'
			if (c2.op == 'modify') {
				c2.op = 'add';
			}
			let val = currentJSON[c2.field];
			let c1 = {
				field: c2.field,
				op: val !== undefined ? 'add' : 'delete'
			};
			if (val !== undefined) {
				c1.value = val;
			}
			if (c2.op == 'modify') {
				c2.op = 'add';
			}
			conflicts.push([c1, c2]);
		}
		
		var localChanged = false;
		
		// Massage some old data
		conflicts = conflicts.filter((x) => {
			// If one side has auto-hyphenated ISBN, use that
			if (x[0].field == 'ISBN' && x[0].op == 'add' && x[1].op == 'add') {
				let hyphenatedA = Zotero.Utilities.Internal.hyphenateISBN(x[0].value);
				let hyphenatedB = Zotero.Utilities.Internal.hyphenateISBN(x[1].value);
				if (hyphenatedA && hyphenatedB) {
					// Use remote
					if (hyphenatedA == x[1].value) {
						changes.push(x[1]);
						return false;
					}
					// Use local
					else if (x[0].value == hyphenatedB) {
						localChanged = true;
						return false;
					}
				}
			}
			return true;
		});
		
		return { changes, conflicts, localChanged };
	},
	
	
	markObjectAsSynced: Zotero.Promise.method(function (obj) {
		obj.synced = true;
		return obj.saveTx({ skipAll: true });
	}),
	
	
	markObjectAsUnsynced: Zotero.Promise.method(function (obj) {
		obj.synced = false;
		return obj.saveTx({ skipAll: true });
	}),
	
	
	/**
	 * @return {Promise<Date|false>}
	 */
	getDateDeleted: Zotero.Promise.coroutine(function* (objectType, libraryID, key) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "SELECT dateDeleted FROM syncDeleteLog WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID=?";
		var date = yield Zotero.DB.valueQueryAsync(sql, [libraryID, key, syncObjectTypeID]);
		return date ? Zotero.Date.sqlToDate(date, true) : false;
	}),
	
	
	/**
	 * @return {Promise<String[]>} - Promise for array of keys
	 */
	getDeleted: Zotero.Promise.coroutine(function* (objectType, libraryID) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "SELECT key FROM syncDeleteLog WHERE libraryID=? AND syncObjectTypeID=?";
		return Zotero.DB.columnQueryAsync(sql, [libraryID, syncObjectTypeID]);
	}),
	
	
	/**
	 * @return {Promise}
	 */
	removeObjectsFromDeleteLog: function (objectType, libraryID, keys) {
		if (!keys.length) Zotero.Promise.resolve();
		
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "DELETE FROM syncDeleteLog WHERE libraryID=? AND syncObjectTypeID=? AND key IN (";
		return Zotero.DB.executeTransaction(function* () {
			return Zotero.Utilities.Internal.forEachChunkAsync(
				keys,
				Zotero.DB.MAX_BOUND_PARAMETERS - 2,
				Zotero.Promise.coroutine(function* (chunk) {
					var params = [libraryID, syncObjectTypeID].concat(chunk);
					return Zotero.DB.queryAsync(
						sql + Array(chunk.length).fill('?').join(',') + ")", params
					);
				})
			);
		}.bind(this));
	},
	
	
	addObjectsToSyncQueue: Zotero.Promise.coroutine(function* (objectType, libraryID, keys) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var now = Zotero.Date.getUnixTimestamp();
		
		// Default to first try
		var keyTries = {};
		keys.forEach(key => keyTries[key] = 0);
		
		// Check current try counts
		var sql = "SELECT key, tries FROM syncQueue WHERE ";
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			keys,
			Math.floor(Zotero.DB.MAX_BOUND_PARAMETERS / 3),
			Zotero.Promise.coroutine(function* (chunk) {
				var params = chunk.reduce(
					(arr, key) => arr.concat([libraryID, key, syncObjectTypeID]), []
				);
				var rows = yield Zotero.DB.queryAsync(
					sql + Array(chunk.length)
						.fill('(libraryID=? AND key=? AND syncObjectTypeID=?)')
						.join(' OR '),
					params
				);
				for (let row of rows) {
					keyTries[row.key] = row.tries + 1; // increment current count
				}
			})
		);
		
		// Insert or update
		yield Zotero.DB.executeTransaction(function* () {
			var sql = "INSERT OR REPLACE INTO syncQueue "
				+ "(libraryID, key, syncObjectTypeID, lastCheck, tries) VALUES ";
			return Zotero.Utilities.Internal.forEachChunkAsync(
				keys,
				Math.floor(Zotero.DB.MAX_BOUND_PARAMETERS / 5),
				function (chunk) {
					var params = chunk.reduce(
						(arr, key) => arr.concat(
							[libraryID, key, syncObjectTypeID, now, keyTries[key]]
						), []
					);
					return Zotero.DB.queryAsync(
						sql + Array(chunk.length).fill('(?, ?, ?, ?, ?)').join(', '), params
					);
				}
			);
		}.bind(this));
	}),
	
	
	getObjectsFromSyncQueue: function (objectType, libraryID) {
		return Zotero.DB.columnQueryAsync(
			"SELECT key FROM syncQueue WHERE libraryID=? AND "
				+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM syncObjectTypes WHERE name=?)",
			[libraryID, objectType]
		);
	},
	
	
	getObjectsToTryFromSyncQueue: Zotero.Promise.coroutine(function* (objectType, libraryID) {
		var rows = yield Zotero.DB.queryAsync(
			"SELECT key, lastCheck, tries FROM syncQueue WHERE libraryID=? AND "
				+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM syncObjectTypes WHERE name=?)",
			[libraryID, objectType]
		);
		var keysToTry = [];
		for (let row of rows) {
			let interval = this._syncQueueIntervals[row.tries];
			// Keep using last interval if beyond
			if (!interval) {
				interval = this._syncQueueIntervals[this._syncQueueIntervals.length - 1];
			}
			let nextCheck = row.lastCheck + interval * 60 * 60;
			if (nextCheck <= Zotero.Date.getUnixTimestamp()) {
				keysToTry.push(row.key);
			}
		}
		return keysToTry;
	}),
	
	
	removeObjectsFromSyncQueue: function (objectType, libraryID, keys) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "DELETE FROM syncQueue WHERE libraryID=? AND syncObjectTypeID=? AND key IN (";
		return Zotero.DB.executeTransaction(function* () {
			return Zotero.Utilities.Internal.forEachChunkAsync(
				keys,
				Zotero.DB.MAX_BOUND_PARAMETERS - 2,
				Zotero.Promise.coroutine(function* (chunk) {
					var params = [libraryID, syncObjectTypeID].concat(chunk);
					return Zotero.DB.queryAsync(
						sql + Array(chunk.length).fill('?').join(',') + ")", params
					);
				})
			);
		}.bind(this));
	},
	
	
	_removeObjectFromSyncQueue: function (objectType, libraryID, key) {
		return Zotero.DB.queryAsync(
			"DELETE FROM syncQueue WHERE libraryID=? AND key=? AND syncObjectTypeID=?",
			[
				libraryID,
				key,
				Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType)
			]
		);
	},
	
	
	resetSyncQueue: function () {
		return Zotero.DB.queryAsync("DELETE FROM syncQueue");
	},
	
	
	resetSyncQueueTries: function () {
		return Zotero.DB.queryAsync("UPDATE syncQueue SET tries=0");
	}
}
