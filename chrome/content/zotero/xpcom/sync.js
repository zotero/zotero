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


Zotero.Sync = new function() {
	// Keep in sync with syncObjectTypes table
	this.__defineGetter__('syncObjects', function () {
		return {
			creator: {
				singular: 'Creator',
				plural: 'Creators'
			},
			item: {
				singular: 'Item',
				plural: 'Items'
			},
			collection: {
				singular: 'Collection',
				plural: 'Collections'
			},
			search: {
				singular: 'Search',
				plural: 'Searches'
			},
			tag: {
				singular: 'Tag',
				plural: 'Tags'
			},
			relation: {
				singular: 'Relation',
				plural: 'Relations'
			},
		};
	});
	
	var _typesLoaded = false;
	var _objectTypeIDs = {};
	var _objectTypeNames = {};
	
	var _deleteLogDays = 30;
	
	
	this.init = function () {
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT version FROM version WHERE schema='syncdeletelog'";
		if (!Zotero.DB.valueQuery(sql)) {
			sql = "SELECT COUNT(*) FROM syncDeleteLog";
			if (Zotero.DB.valueQuery(sql)) {
				throw ('syncDeleteLog not empty and no timestamp in Zotero.Sync.delete()');
			}
			
			var syncInitTime = Zotero.DB.transactionDate;
			syncInitTime = Zotero.Date.toUnixTimestamp(syncInitTime);
			
			sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
			Zotero.DB.query(sql, syncInitTime);
		}
		
		Zotero.DB.commitTransaction();
		
		this.EventListener.init();
	}
	
	
	this.getObjectTypeID = function (type) {
		if (!_typesLoaded) {
			_loadObjectTypes();
		}
		
		var id = _objectTypeIDs[type];
		return id ? id : false;
	}
	
	
	this.getObjectTypeName = function (typeID, plural) {
		if (!_typesLoaded) {
			_loadObjectTypes();
		}
		
		var name = _objectTypeNames[typeID];
		return name ? name : false;
	}
	
	
	/**
	 * @param	{Date} olderThanDate		Retrieve objects last updated before this date
	 * @param	{Date} newerThanDate		Retrieve objects last updated after this date
	 * @param	{Zotero.Sync.Server.ObjectKeySet}
	 */
	this.getObjectsByDate = function (olderThanDate, newerThanDate, objectKeySet) {
		var funcName = "Zotero.Sync.getObjectsByDate()";
		if (olderThanDate && olderThanDate.constructor.name != 'Date') {
			throw ("olderThanDate must be a Date or FALSE in " + funcName)
		}
		if (newerThanDate && newerThanDate.constructor.name != 'Date') {
			throw ("newerThanDate must be a Date or FALSE in " + funcName)
		}
		
		// If either not set (first sync) or dates overlap, retrieve all objects
		if ((!olderThanDate || !newerThanDate) ||
				(olderThanDate && newerThanDate && olderThanDate > newerThanDate)) {
			olderThanDate = null;
			newerThanDate = null;
			var all = true;
		}
		
		for (var type in this.syncObjects) {
			var Types = this.syncObjects[type].plural; // 'Items'
			var types = Types.toLowerCase(); // 'items'
			
			Zotero.debug("Getting updated local " + types);
			
			if (olderThanDate) {
				var earlierIDs = Zotero[Types].getOlder(olderThanDate);
				if (earlierIDs) {
					objectKeySet.addIDs(type, earlierIDs);
				}
			}
			
			if (newerThanDate || all) {
				var laterIDs = Zotero[Types].getNewer(newerThanDate);
				if (laterIDs) {
					objectKeySet.addIDs(type, laterIDs);
				}
			}
		}
	}
	
	
	/**
	 * @param	{Date}	lastSyncDate	JS Date object
	 * @param	{Zotero.Sync.Server.ObjectKeySet}
	 * @return	TRUE if found, FALSE if none, or -1 if last sync time is before start of log
	 */
	this.getDeletedObjects = function (lastSyncDate, objectKeySet) {
		if (lastSyncDate && lastSyncDate.constructor.name != 'Date') {
			throw ('lastSyncDate must be a Date or FALSE in '
				+ 'Zotero.Sync.getDeletedObjects()')
		}
		
		var sql = "SELECT version FROM version WHERE schema='syncdeletelog'";
		var syncLogStart = Zotero.DB.valueQuery(sql);
		if (!syncLogStart) {
			throw ('syncLogStart not found in Zotero.Sync.getDeletedObjects()');
		}
		
		// Last sync time is before start of log
		if (lastSyncDate && new Date(syncLogStart * 1000) > lastSyncDate) {
			return -1;
		}
		
		var param = false;
		var sql = "SELECT syncObjectTypeID, libraryID, key FROM syncDeleteLog";
		if (lastSyncDate) {
			param = Zotero.Date.toUnixTimestamp(lastSyncDate);
			sql += " WHERE timestamp>?";
		}
		sql += " ORDER BY timestamp";
		var rows = Zotero.DB.query(sql, param);
		
		if (!rows) {
			return false;
		}
		
		var keys = {};
		for (var type in this.syncObjects) {
			keys[type] = [];
		}
		
		var type;
		for each(var row in rows) {
			type = this.getObjectTypeName(row.syncObjectTypeID);
			keys[type].push({
				libraryID: row.libraryID,
				key: row.key
			});
		}
		
		for (var type in keys) {
			objectKeySet.addLibraryKeyPairs(type, keys[type]);
		}
		
		return true;
	}
	
	
	/**
	 * @param	int		deleteOlderThan		Unix timestamp
	 */
	this.purgeDeletedObjects = function (deleteOlderThan) {
		if (isNaN(parseInt(deleteOlderThan))) {
			throw ("Invalid timestamp '" + deleteOlderThan
				+ "' in Zotero.Sync.purgeDeletedObjects");
		}
		var sql = "DELETE FROM syncDeleteLog WHERE timestamp<?";
		Zotero.DB.query(sql, { int: deleteOlderThan });
	}
	
	
	function _loadObjectTypes() {
		// TEMP: Take this out once system.sql > 31
		var sql = "UPDATE syncObjectTypes SET name='relation' WHERE syncObjectTypeID=6 AND name='relations'";
		Zotero.DB.query(sql);
		
		var sql = "SELECT * FROM syncObjectTypes";
		var types = Zotero.DB.query(sql);
		for each(var type in types) {
			_objectTypeNames[type.syncObjectTypeID] = type.name;
			_objectTypeIDs[type.name] = type.syncObjectTypeID;
		}
		_typesLoaded = true;
	}
}



Zotero.Sync.ObjectKeySet = function () {
	// Set up key holders for different types
	var syncTypes = Zotero.Sync.syncObjects;
	for each(var type in syncTypes) {
		this[type.plural.toLowerCase()] = {};
	}
}


Zotero.Sync.ObjectKeySet.prototype.addIDs = function (type, ids) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	var obj, libraryID, key;
	for each(var id in ids) {
		obj = Zotero[Types].get(id);
		libraryID = obj.libraryID;
		if (!libraryID) {
			libraryID = 0; // current user
		}
		key = obj.key;
		if (!this[types][libraryID]) {
			this[types][libraryID] = {};
		}
		this[types][libraryID][key] = true;
	}
}


/**
 * @param	{String}	type		Sync object type (e.g., 'item', 'collection')
 * @param	{Object[]}	keyPairs	Array of objects with 'libraryID' and 'key'
 */
Zotero.Sync.ObjectKeySet.prototype.addLibraryKeys = function (type, libraryID, keys) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	var key;
	for each(var key in keys) {
		if (!libraryID) {
			libraryID = 0; // current user
		}
		if (!this[types][libraryID]) {
			this[types][libraryID] = {};
		}
		this[types][libraryID][key] = true;
	}
}


/**
 * @param	{String}	type		Sync object type (e.g., 'item', 'collection')
 * @param	{Object[]}	keyPairs	Array of objects with 'libraryID' and 'key'
 */
Zotero.Sync.ObjectKeySet.prototype.addLibraryKeyPairs = function (type, keyPairs) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	var libraryID, key;
	for each(var pair in keyPairs) {
		libraryID = pair.libraryID;
		if (!libraryID) {
			libraryID = 0; // current user
		}
		key = pair.key;
		if (!this[types][libraryID]) {
			this[types][libraryID] = {};
		}
		this[types][libraryID][key] = true;
	}
}


Zotero.Sync.ObjectKeySet.prototype.hasLibraryKey = function (type, libraryID, key) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	if (!libraryID) {
		libraryID = 0;
	}
	
	if (this[types] && this[types][libraryID] && this[types][libraryID][key]) {
		return true;
	}
	
	return false;
}


Zotero.Sync.ObjectKeySet.prototype.getKeys = function (type, libraryID) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	if (!libraryID) {
		libraryID = 0;
	}
	
	if (!this[types] || !this[types][libraryID]) {
		return [];
	}
	
	var keys = [];
	for (var key in this[types][libraryID]) {
		keys.push(key);
	}
	return keys;
}


Zotero.Sync.ObjectKeySet.prototype.removeLibraryKeyPairs = function (type, keyPairs) {
	var Types = Zotero.Sync.syncObjects[type].plural;
	var types = Types.toLowerCase();
	
	var libraryID, key;
	for each(var pair in keyPairs) {
		libraryID = pair.libraryID;
		if (!libraryID) {
			libraryID = 0; // current user
		}
		key = pair.key;
		if (this[types][libraryID]) {
			delete this[types][libraryID][key];
		}
	}
}



/**
 * Notifier observer to add deleted objects to syncDeleteLog/storageDeleteLog
 * 		plus related methods
 */
Zotero.Sync.EventListener = new function () {
	this.init = init;
	this.ignoreDeletions = ignoreDeletions;
	this.notify = notify;
	
	var _deleteBlacklist = {};
	
	
	function init() {
		// Initialize delete log listener
		Zotero.Notifier.registerObserver(this);
	}
	
	
	/**
	 * Blacklist objects from going into the sync delete log
	 */
	function ignoreDeletions(type, ids) {
		if (!Zotero.Sync.syncObjects[type]) {
			throw ("Invalid type '" + type +
				"' in Zotero.Sync.EventListener.ignoreDeletions()");
		}
		
		if (!_deleteBlacklist[type]) {
			_deleteBlacklist[type] = {};
		}
		
		ids = Zotero.flattenArguments(ids);
		for each(var id in ids) {
			_deleteBlacklist[type][id] = true;
		}
	}
	
	this.resetIgnored = function () {
		_deleteBlacklist = {};
	}
	
	
	function notify(event, type, ids, extraData) {
		var objectTypeID = Zotero.Sync.getObjectTypeID(type);
		if (!objectTypeID) {
			return;
		}
		
		var isItem = Zotero.Sync.getObjectTypeName(objectTypeID) == 'item';
		
		Zotero.DB.beginTransaction();
		
		if (event == 'delete') {
			var sql = "REPLACE INTO syncDeleteLog VALUES (?, ?, ?, ?)";
			var syncStatement = Zotero.DB.getStatement(sql);
			
			if (isItem && Zotero.Sync.Storage.WebDAV.active) {
				var storageEnabled = true;
				var sql = "INSERT INTO storageDeleteLog VALUES (?, ?, ?)";
				var storageStatement = Zotero.DB.getStatement(sql);
			}
			var storageBound = false;
			
			var ts = Zotero.Date.getUnixTimestamp();
			
			for (var i=0, len=ids.length; i<len; i++) {
				if (_deleteBlacklist[type] && _deleteBlacklist[type][ids[i]]) {
					Zotero.debug("Not logging blacklisted '"
						+ type + "' id " + ids[i]
						+ " in Zotero.Sync.EventListener.notify()", 4);
					delete _deleteBlacklist[type][ids[i]];
					continue;
				}
				
				var oldItem = extraData[ids[i]].old;
				var libraryID = oldItem.primary.libraryID;
				var key = oldItem.primary.key;
				
				if (!key) {
					throw("Key not provided in notifier object in "
						+ "Zotero.Sync.EventListener.notify()");
				}
				
				syncStatement.bindInt32Parameter(0, objectTypeID);
				syncStatement.bindInt32Parameter(1, libraryID);
				syncStatement.bindStringParameter(2, key);
				syncStatement.bindInt32Parameter(3, ts);
				
				if (storageEnabled &&
						oldItem.primary.itemType == 'attachment' &&
						[
							Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
							Zotero.Attachments.LINK_MODE_IMPORTED_URL
						].indexOf(oldItem.attachment.linkMode) != -1) {
					storageStatement.bindInt32Parameter(0, libraryID);
					storageStatement.bindStringParameter(1, key);
					storageStatement.bindInt32Parameter(2, ts);
					storageBound = true;
				}
				
				try {
					syncStatement.execute();
					if (storageBound) {
						storageStatement.execute();
						storageBound = false;
					}
				}
				catch(e) {
					var errMsg = Zotero.DB.getLastErrorString();
					syncStatement.reset();
					if (storageEnabled) {
						storageStatement.reset();
					}
					Zotero.DB.rollbackTransaction();
					throw (errMsg + " in Zotero.Sync.EventListener.notify()");
				}
			}
			
			syncStatement.reset();
			if (storageEnabled) {
				storageStatement.reset();
			}
		}
		
		Zotero.DB.commitTransaction();
	}
}


Zotero.Sync.Runner = new function () {
	this.__defineGetter__("background", function () {
		return _background;
	});
	
	this.__defineGetter__("lastSyncStatus", function () {
		return _lastSyncStatus;
	});
	
	var _autoSyncTimer;
	var _queue;
	var _running;
	var _background;
	
	var _lastSyncStatus;
	var _currentSyncStatusLabel;
	var _currentLastSyncLabel;
	
	var _warning = null;
	
	this.init = function () {
		this.EventListener.init();
		this.IdleListener.init();
	}
	
	this.sync = function (background) {
		_warning = null;
		
		if (Zotero.HTTP.browserIsOffline()){
			this.clearSyncTimeout(); // DEBUG: necessary?
			var msg = "Zotero cannot sync while " + Zotero.appName + " is in offline mode.";
			var e = new Zotero.Error(msg, 0, { dialogButtonText: null })
			this.setSyncIcon('error', e);
			return false;
		}
		
		if (_running) {
			// TODO: show status in all windows
			var msg = "A sync process is already running. To view progress, check "
				+ "the window in which the sync began or restart " + Zotero.appName + ".";
			var e = new Zotero.Error(msg, 0, { dialogButtonText: null, frontWindowOnly: true })
			this.setSyncIcon('error', e);
			return false;
		}
		
		// Purge deleted objects so they don't cause sync errors (e.g., long tags)
		Zotero.purgeDataObjects(true);
		
		_background = !!background;
		_running = true;
		this.setSyncIcon('animate');
		
		var finalCallbacks = {
			onSuccess: Zotero.Sync.Runner.stop,
			onSkip: Zotero.Sync.Runner.stop,
			onStop: Zotero.Sync.Runner.stop,
			onError: Zotero.Sync.Runner.error
		};
		
		var storageSync = function () {
			var syncNeeded = false;
			
			Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.syncingFiles'));
			
			var zfsSync = function (skipSyncNeeded) {
				Zotero.Sync.Storage.ZFS.sync({
					// ZFS success
					onSuccess: function () {
						setTimeout(function () {
							Zotero.Sync.Server.sync(finalCallbacks);
						}, 0);
					},
					
					// ZFS skip
					onSkip: function () {
						setTimeout(function () {
							if (skipSyncNeeded) {
								Zotero.Sync.Server.sync(finalCallbacks);
							}
							else {
								Zotero.Sync.Runner.stop();
							}
						}, 0);
					},
					
					// ZFS cancel
					onStop: function () {
						setTimeout(function () {
							Zotero.Sync.Runner.stop();
						}, 0);
					},
					
					// ZFS failure
					onError: Zotero.Sync.Runner.error,
					
					onWarning: Zotero.Sync.Runner.warning
				})
			};
			
			Zotero.Sync.Storage.WebDAV.sync({
				// WebDAV success
				onSuccess: function () {
					zfsSync(true);
				},
				
				// WebDAV skip
				onSkip: function () {
					zfsSync();
				},
				
				// WebDAV cancel
				onStop: Zotero.Sync.Runner.stop,
				
				// WebDAV failure
				onError: Zotero.Sync.Runner.error
			});
		};
		
		Zotero.Sync.Server.sync({
			// Sync 1 success
			onSuccess: storageSync,
			
			// Sync 1 skip
			onSkip: storageSync,
			
			// Sync 1 stop
			onStop: Zotero.Sync.Runner.stop,
			
			// Sync 1 error
			onError: Zotero.Sync.Runner.error
		});
	}
	
	
	this.stop = function () {
		if (_warning) {
			Zotero.Sync.Runner.setSyncIcon('warning', _warning);
			_warning = null;
		}
		else {
			Zotero.Sync.Runner.setSyncIcon();
		}
		_running = false;
	}
	
	
	/**
	 * Log a warning, but don't throw an error
	 */
	this.warning = function (e) {
		Components.utils.reportError(e);
		_warning = e;
	}
	
	
	this.error = function (e) {
		Zotero.Sync.Runner.setSyncIcon('error', e);
		_running = false;
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
				
				Zotero.Sync.Runner.sync(background);
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
	
	
	this.setSyncIcon = function (status, e) {
		var message;
		var buttonText;
		var buttonCallback;
		var frontWindowOnly = false;
		
		status = status ? status : '';
		
		switch (status) {
			case '':
			case 'animate':
			case 'warning':
			case 'error':
				break;
			
			default:
				throw ("Invalid sync icon status '" + status
						+ "' in Zotero.Sync.Runner.setSyncIcon()");
		}
		
		if (e) {
			if (e.data) {
				if (e.data.dialogText) {
					message = e.data.dialogText;
				}
				if (typeof e.data.dialogButtonText != 'undefined') {
					buttonText = e.data.dialogButtonText;
					buttonCallback = e.data.dialogButtonCallback;
				}
				if (e.data.frontWindowOnly) {
					frontWindowOnly = e.data.frontWindowOnly;
				}
			}
			if (!message) {
				if (e.message) {
					message = e.message;
				}
				else {
					message = e;
				}
			}
		}
		
		var upgradeRequired = false;
		if (Zotero.Sync.Server.upgradeRequired) {
			upgradeRequired = true;
			Zotero.Sync.Server.upgradeRequired = false;
		}
		
		if (status == 'error') {
			var errorsLogged = Zotero.getErrors().length > 0;
		}
		
		if (frontWindowOnly) {
			// Fake an nsISimpleEnumerator with just the topmost window
			var enumerator = {
				_returned: false,
				hasMoreElements: function () {
					return !this._returned;
				},
				getNext: function () {
					if (this._returned) {
						throw ("No more windows to return in Zotero.Sync.Runner.setSyncIcon()");
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
			if(!win.ZoteroPane) continue;
			var warning = win.ZoteroPane.document.getElementById('zotero-tb-sync-warning');
			var icon = win.ZoteroPane.document.getElementById('zotero-tb-sync');
			
			if (status == 'warning' || status == 'error') {
				icon.setAttribute('status', '');
				warning.hidden = false;
				if (upgradeRequired) {
					warning.setAttribute('mode', 'upgrade');
					buttonText = null;
				}
				else {
					warning.setAttribute('mode', status);
				}
				warning.tooltipText = message;
				warning.onclick = function () {
					var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
					var win = wm.getMostRecentWindow("navigator:browser");
					
					var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
					// Warning
					if (status == 'warning') {
						var title = Zotero.getString('general.warning');
						
						// If secondary button not specified, just use an alert
						if (!buttonText) {
							ps.alert(null, title, message);
							return;
						}
						
						var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
											+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
						var index = ps.confirmEx(
							null,
							title,
							message,
							buttonFlags,
							"",
							buttonText,
							"", null, {}
						);
						
						if (index == 1) {
							setTimeout(function () { buttonCallback(); }, 1);
						}
					}
					
					// Error
					else if (status == 'error') {
						// Probably not necessary, but let's be sure
						if (!errorsLogged) {
							Components.utils.reportError(message);
						}
						
						if (typeof buttonText == 'undefined') {
							buttonText = Zotero.getString('errorReport.reportError');
							buttonCallback = function () {
								win.ZoteroPane.reportErrors();
							}
						}
						// If secondary button is explicitly null, just use an alert
						else if (buttonText === null) {
							ps.alert(null, title, message);
							return;
						}
						
						var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
											+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.error'),
							message,
							buttonFlags,
							"",
							buttonText,
							"", null, {}
						);
						
						if (index == 1) {
							setTimeout(function () { buttonCallback(); }, 1);
						}
					}
				}
			}
			else {
				icon.setAttribute('status', status);
				warning.hidden = true;
				warning.onclick = null;
			}
			
			// Disable button while spinning
			icon.disabled = status == 'animate';
		}
		
		// Clear status
		Zotero.Sync.Runner.setSyncStatus();
	}
	
	
	this.setSyncStatus = function (msg) {
		_lastSyncStatus = msg;
		
		// If a label is registered, update it
		if (_currentSyncStatusLabel) {
			_updateSyncStatusLabel();
		}
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
		var lastSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
		if (lastSyncTime) {
			var time = new Date(lastSyncTime * 1000);
			var msg = Zotero.Date.toRelativeDate(time);
		}
		// Don't show "Not yet synced" if a sync is in progress
		else if (_lastSyncStatus) {
			_currentLastSyncLabel.hidden = true;
			return;
		}
		else {
			var msg = Zotero.getString('sync.status.notYetSynced');
		}
		
		_currentLastSyncLabel.value = Zotero.localeJoin([
			Zotero.getString('sync.status.lastSync'),
			msg
		]);
		_currentLastSyncLabel.hidden = false;
	}
}


Zotero.Sync.Runner.EventListener = {
	init: function () {
		// Initialize save observer
		Zotero.Notifier.registerObserver(this);
	},
	
	notify: function (event, type, ids, extraData) {
		// TODO: skip others
		if (type == 'refresh') {
			return;
		}
		
		if (Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Server.enabled) {
			Zotero.Sync.Runner.setSyncTimeout(false, false, true);
		}
	}
}


Zotero.Sync.Runner.IdleListener = {
	_idleTimeout: 3600,
	_backTimeout: 900,
	
	init: function () {
		// DEBUG: Allow override for testing
		var idleTimeout = Zotero.Prefs.get("sync.autoSync.idleTimeout");
		if (idleTimeout) {
			this._idleTimeout = idleTimeout;
		}
		var backTimeout = Zotero.Prefs.get("sync.autoSync.backTimeout");
		if (backTimeout) {
			this._backTimeout = backTimeout;
		}
		
		if (Zotero.Prefs.get("sync.autoSync")) {
			this.register();
		}
	},
	
	register: function () {
		Zotero.debug("Initializing sync idle observer");
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this, this._idleTimeout);
		idleService.addIdleObserver(this._backObserver, this._backTimeout);
	},
	
	observe: function (subject, topic, data) {
		if (topic != 'idle') {
			return;
		}
		
		if (!Zotero.Sync.Server.enabled
				|| Zotero.Sync.Server.syncInProgress
				|| Zotero.Sync.Storage.syncInProgress) {
			return;
		}
		
		// TODO: move to Runner.sync()?
		if (Zotero.locked) {
			Zotero.debug('Zotero is locked -- skipping idle sync', 4);
			return;
		}
		
		if (Zotero.Sync.Server.manualSyncRequired) {
			Zotero.debug('Manual sync required -- skipping idle sync', 4);
			return;
		}
		
		Zotero.debug("Beginning idle sync");
		
		Zotero.Sync.Runner.sync(true);
		Zotero.Sync.Runner.setSyncTimeout(this._idleTimeout, true);
	},
	
	_backObserver: {
		observe: function (subject, topic, data) {
			if (topic != 'back') {
				return;
			}
			
			Zotero.Sync.Runner.clearSyncTimeout();
			if (!Zotero.Sync.Server.enabled
					|| Zotero.Sync.Server.syncInProgress
					|| Zotero.Sync.Storage.syncInProgress) {
				return;
			}
			Zotero.debug("Beginning return-from-idle sync");
			Zotero.Sync.Runner.sync(true);
		}
	},
	
	unregister: function () {
		Zotero.debug("Stopping sync idle observer");
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
		idleService.removeIdleObserver(this, this._idleTimeout);
		idleService.removeIdleObserver(this._backObserver, this._backTimeout);
	}
}



/**
 * Methods for syncing with the Zotero Server
 */
Zotero.Sync.Server = new function () {
	this.login = login;
	this.sync = sync;
	this.clear = clear;
	this.resetClient = resetClient;
	this.logout = logout;
	
	this.__defineGetter__('enabled', function () {
		if (_throttleTimeout && new Date() < _throttleTimeout) {
			Zotero.debug("Auto-syncing is disabled until " + Zotero.Date.dateToSQL(_throttleTimeout) + " -- skipping sync");
			return false;
		}
		return this.username && this.password;
	});
	
	this.__defineGetter__('username', function () {
		return Zotero.Prefs.get('sync.server.username');
	});
	
	this.__defineGetter__('password', function () {
		var username = this.username;
		
		if (!username) {
			return '';
		}
		
		if (_cachedCredentials.username == username && _cachedCredentials.password) {
			return _cachedCredentials.password;
		}
		
		Zotero.debug('Getting Zotero sync password');
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		try {
			var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		}
		catch (e) {
			Zotero.debug(e);
			var msg = Zotero.getString('sync.error.loginManagerCorrupted1', Zotero.appName) + "\n\n"
						+ Zotero.getString('sync.error.loginManagerCorrupted2', [Zotero.appName, Zotero.appName]);
			alert(msg);
			return '';
		}
		
		// Find user from returned array of nsILoginInfo objects
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == username) {
				_cachedCredentials = {
					username: username,
					password: logins[i].password
				};
				return logins[i].password;
			}
		}
		
		return '';
	});
	
	this.__defineSetter__('password', function (password) {
		_sessionID = null;
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		for (var i = 0; i < logins.length; i++) {
			Zotero.debug('Clearing Zotero sync credentials');
			loginManager.removeLogin(logins[i]);
			break;
		}
		
		_cachedCredentials = {};
		
		var username = this.username;
		
		if (!username) {
			return;
		}
		
		if (password) {
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
			
			Zotero.debug('Setting Zotero sync password');
			var loginInfo = new nsLoginInfo(_loginManagerHost, _loginManagerURL,
				null, username, password, "", "");
			loginManager.addLogin(loginInfo);
			_cachedCredentials = {
				username: username,
				password: password
			};
		}
	});
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	this.__defineGetter__("updatesInProgress", function () _updatesInProgress);
	this.__defineGetter__("sessionIDComponent", function () {
		return 'sessionid=' + _sessionID;
	});
	this.__defineGetter__("lastRemoteSyncTime", function () {
		return Zotero.DB.valueQuery("SELECT version FROM version WHERE schema='lastremotesync'");
	});
	this.__defineSetter__("lastRemoteSyncTime", function (val) {
		Zotero.DB.query("REPLACE INTO version VALUES ('lastremotesync', ?)", val);
	});
	this.__defineGetter__("lastLocalSyncTime", function () {
		return Zotero.DB.valueQuery("SELECT version FROM version WHERE schema='lastlocalsync'");
	});
	this.__defineSetter__("lastLocalSyncTime", function (val) {
		Zotero.DB.query("REPLACE INTO version VALUES ('lastlocalsync', ?)", { int: val });
	});
	
	
	this.canAutoResetClient = true;
	this.manualSyncRequired = false;
	this.upgradeRequired = false;
	this.nextLocalSyncDate = false;
	this.apiVersion = 9;
	
	var _loginManagerHost = 'chrome://zotero';
	var _loginManagerURL = 'Zotero Sync Server';
	
	var _serverURL = ZOTERO_CONFIG.SYNC_URL;
	
	var _apiVersionComponent = "version=" + this.apiVersion;
	var _cachedCredentials = {};
	var _syncInProgress;
	var _updatesInProgress;
	var _sessionID;
	var _throttleTimeout;
	var _checkTimer;
	
	var _callbacks = {
		onSuccess: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onSkip: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onStop: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onError: function (msg) {
			Zotero.Sync.Runner.error(msg);
		}
	};
	
	function login(callback) {
		var url = _serverURL + "login";
		
		var username = Zotero.Sync.Server.username;
		if (!username) {
			var e = new Zotero.Error(Zotero.getString('sync.error.usernameNotSet'), "SYNC_USERNAME_NOT_SET");
			_error(e);
		}
		
		var password = Zotero.Sync.Server.password;
		if (!password) {
			var e = new Zotero.Error(Zotero.getString('sync.error.passwordNotSet'), "INVALID_SYNC_LOGIN");
			_error(e);
		}
		
		username = encodeURIComponent(username);
		password = encodeURIComponent(password);
		var body = _apiVersionComponent
					+ "&username=" + username
					+ "&password=" + password;
		
		Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.loggingIn'));
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp, true);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				if (response.firstChild.getAttribute('code') == 'INVALID_LOGIN') {
					var e = new Zotero.Error(Zotero.getString('sync.error.invalidLogin'), "INVALID_SYNC_LOGIN");
					_error(e, true);
				}
				_error(response.firstChild.firstChild.nodeValue, true);
			}
			
			if (_sessionID) {
				_error("Session ID already set in Zotero.Sync.Server.login()", true)
			}
			
			// <response><sessionID>[abcdefg0-9]{32}</sessionID></response>
			_sessionID = response.firstChild.firstChild.nodeValue;
			
			var re = /^[abcdefg0-9]{32}$/;
			if (!re.test(_sessionID)) {
				_sessionID = null;
				_error('Invalid session ID received from server', true);
			}
			
			
			//Zotero.debug('Got session ID ' + _sessionID + ' from server');
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function sync(callbacks, restart, upload) {
		for (var func in callbacks) {
			_callbacks[func] = callbacks[func];
		}
		
		var self = this;
		
		Zotero.Sync.Runner.setSyncIcon('animate');
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login(function () {
				Zotero.Sync.Server.sync(_callbacks);
			});
			return;
		}
		
		if (!restart) {
			if (_syncInProgress) {
				var msg = Zotero.localeJoin([
					Zotero.getString('sync.error.syncInProgress'),
					Zotero.getString('sync.error.syncInProgress.wait', Zotero.appName)
				]);
				var e = new Zotero.Error(msg, 0, { dialogButtonText: null, frontWindowOnly: true });
				_error(e);
			}
			
			Zotero.debug("Beginning server sync");
			_syncInProgress = true;
		}
		
		// Get updated data
		var url = _serverURL + 'updated';
		var lastsync = Zotero.Sync.Server.lastRemoteSyncTime;
		if (!lastsync) {
			lastsync = 1;
		}
		
		// If no local timestamp is stored, don't use remote time
		//
		// This used to be possible when remote time was saved whether or not
		// the subsequent upload went through
		var lastLocalSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
		if (!lastLocalSyncTime) {
			lastsync = 1;
		}
		
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent
					+ '&lastsync=' + lastsync;
		// Tell server to check for read locks as well as write locks,
		// since we'll be uploading
		if (upload) {
			body += '&upload=1';
		}
		
		Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.gettingUpdatedData'));
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			Zotero.debug(xmlhttp.responseText);
			
			_checkResponse(xmlhttp, !restart);
			
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				_syncInProgress = false;
				Zotero.Sync.Server.login(function () {
					Zotero.Sync.Server.sync(_callbacks);
				});
				return;
			}
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			// If server session is locked, keep checking back
			if (_checkServerLock(response, function () { Zotero.Sync.Server.sync(_callbacks, true, upload); })) {
				return;
			}
			
			// Error that's not handled by _checkResponse()
			if (response.firstChild.localName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			try {
				var responseNode = xmlhttp.responseXML.documentElement;
				
				var updateKey = responseNode.getAttribute('updateKey');
				
				// If no earliest date is provided by the server, the server
				// account is empty
				var earliestRemoteDate = responseNode.getAttribute('earliest');
				earliestRemoteDate = parseInt(earliestRemoteDate) ?
					new Date((earliestRemoteDate + 43200) * 1000) : false;
				var noServerData = !!earliestRemoteDate;
				
				// Check to see if we're syncing with a different user
				var userID = parseInt(responseNode.getAttribute('userID'));
				var libraryID = parseInt(responseNode.getAttribute('defaultLibraryID'));
				var c = _checkSyncUser(userID, libraryID, noServerData);
				if (c == 0) {
					// Groups were deleted, so restart sync
					Zotero.debug("Restarting sync");
					_syncInProgress = false;
					Zotero.Sync.Server.sync(_callbacks);
					return;
				}
				else if (c == -1) {
					Zotero.debug("Sync cancelled");
					_syncInProgress = false;
					_callbacks.onStop();
					return;
				}
				
				Zotero.DB.beginTransaction();
				
				Zotero.UnresponsiveScriptIndicator.disable();
				
				var lastLocalSyncDate = lastLocalSyncTime ?
					new Date(lastLocalSyncTime * 1000) : false;
				
				var syncSession = new Zotero.Sync.Server.Session;
				
				// Fetch old objects not on server (due to a clear) and new
				// objects added since last sync, or all local objects if neither is set
				Zotero.Sync.getObjectsByDate(
					earliestRemoteDate, lastLocalSyncDate, syncSession.uploadKeys.updated
				);
				
				var deleted = Zotero.Sync.getDeletedObjects(lastLocalSyncDate, syncSession.uploadKeys.deleted);
				if (deleted == -1) {
					var msg = "Sync delete log starts after last sync date in Zotero.Sync.Server.sync()";
					var e = new Zotero.Error(msg, "FULL_SYNC_REQUIRED");
					throw (e);
				}
				
				var nextLocalSyncDate = Zotero.DB.transactionDate;
				var nextLocalSyncTime = Zotero.Date.toUnixTimestamp(nextLocalSyncDate);
				Zotero.Sync.Server.nextLocalSyncDate = nextLocalSyncDate;
				
				Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.processingUpdatedData'));
				
				// Reconcile and save updated data from server and
				// prepare local data to upload
				
				Zotero.suppressUIUpdates = true;
				_updatesInProgress = true;
				
				var errorHandler = function (e) {
					Zotero.DB.rollbackTransaction();
					
					Zotero.UnresponsiveScriptIndicator.enable();
					
					if (Zotero.locked) {
						Zotero.hideZoteroPaneOverlay();
					}
					Zotero.suppressUIUpdates = false;
					_updatesInProgress = false;
					
					_error(e);
				}
				
				try {
					var gen = Zotero.Sync.Server.Data.processUpdatedXML(
						responseNode.getElementsByTagName('updated')[0],
						lastLocalSyncDate,
						syncSession,
						libraryID,
						function (xmlstr) {
							Zotero.UnresponsiveScriptIndicator.enable();
							
							if (Zotero.locked) {
								Zotero.hideZoteroPaneOverlay();
							}
							Zotero.suppressUIUpdates = false;
							_updatesInProgress = false;
							
							if (xmlstr === false) {
								Zotero.debug("Sync cancelled");
								Zotero.DB.rollbackTransaction();
								Zotero.reloadDataObjects();
								Zotero.Sync.EventListener.resetIgnored();
								_syncInProgress = false;
								_callbacks.onStop();
								return;
							}
							
							if (xmlstr) {
								Zotero.debug(xmlstr);
							}
							
							if (Zotero.Prefs.get('sync.debugBreak')) {
								Zotero.debug('===============');
								throw ("break");
							}
							
							if (!xmlstr) {
								Zotero.debug("Nothing to upload to server");
								Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
								Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
								Zotero.Sync.Server.nextLocalSyncDate = false;
								Zotero.DB.commitTransaction();
								_syncInProgress = false;
								_callbacks.onSuccess();
								return;
							}
							
							Zotero.DB.commitTransaction();
							
							Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.uploadingData'));
							
							var url = _serverURL + 'upload';
							var body = _apiVersionComponent
										+ '&' + Zotero.Sync.Server.sessionIDComponent
										+ '&updateKey=' + updateKey
										+ '&data=' + encodeURIComponent(xmlstr);
							
							//var file = Zotero.getZoteroDirectory();
							//file.append('lastupload.txt');
							//Zotero.File.putContents(file, body);
							
							var uploadCallback = function (xmlhttp) {
								if (xmlhttp.status == 409) {
									Zotero.debug("Upload key is no longer valid -- restarting sync");
									setTimeout(function () {
										Zotero.Sync.Server.sync(_callbacks, true, true);
									}, 1);
									return;
								}
								
								_checkResponse(xmlhttp);
								
								Zotero.debug(xmlhttp.responseText);
								var response = xmlhttp.responseXML.childNodes[0];
								
								if (_checkServerLock(response, function (mode) {
									switch (mode) {
										// If the upload was queued, keep checking back
										case 'queued':
											Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.uploadAccepted'));
											
											var url = _serverURL + 'uploadstatus';
											var body = _apiVersionComponent
														+ '&' + Zotero.Sync.Server.sessionIDComponent;
											Zotero.HTTP.doPost(url, body, function (xmlhttp) {
												uploadCallback(xmlhttp);
											});
											break;
										
										// If affected libraries were locked, restart sync,
										// since the upload key would be out of date anyway
										case 'locked':
											setTimeout(function () {
												Zotero.Sync.Server.sync(_callbacks, true, true);
											}, 1);
											break;
											
										default:
											throw ("Unexpected server lock mode '" + mode + "' in Zotero.Sync.Server.upload()");
									}
								})) { return; }
								
								if (response.firstChild.tagName == 'error') {
									// handle error
									_error(response.firstChild.firstChild.nodeValue);
								}
								
								if (response.firstChild.localName != 'uploaded') {
									_error("Unexpected upload response '" + response.firstChild.localName
											+ "' in Zotero.Sync.Server.sync()");
								}
								
								Zotero.DB.beginTransaction();
								Zotero.Sync.purgeDeletedObjects(nextLocalSyncTime);
								Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
								Zotero.Sync.Server.nextLocalSyncDate = false;
								Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
								
								//throw('break2');
								
								Zotero.DB.commitTransaction();
								
								// Check if any items were modified during /upload,
								// and restart the sync if so
								if (Zotero.Items.getNewer(nextLocalSyncDate, true)) {
									Zotero.debug("Items were modified during upload -- restarting sync");
									Zotero.Sync.Server.sync(_callbacks, true, true);
									return;
								}
								
								_syncInProgress = false;
								_callbacks.onSuccess();
							}
							
							var compress = Zotero.Prefs.get('sync.server.compressData');
							// Compress upload data
							if (compress) {
								// Callback when compressed data is available
								var bufferUploader = function (data) {
									var gzurl = url + '?gzip=1';
									
									var oldLen = body.length;
									var newLen = data.length;
									var savings = Math.round(((oldLen - newLen) / oldLen) * 100)
									Zotero.debug("HTTP POST " + newLen + " bytes to " + gzurl
										+ " (gzipped from " + oldLen + " bytes; "
										+ savings + "% savings)");
									
									if (Zotero.HTTP.browserIsOffline()) {
										Zotero.debug('Browser is offline');
										return false;
									}
									
									var req =
										Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
											createInstance();
									req.open('POST', gzurl, true);
									req.setRequestHeader('Content-Type', "application/octet-stream");
									req.setRequestHeader('Content-Encoding', 'gzip');
									
									req.onreadystatechange = function () {
										if (req.readyState == 4) {
											uploadCallback(req);
										}
									};
									try {
										req.sendAsBinary(data);
									}
									catch (e) {
										_error(e);
									}
								}
								
								// Get input stream from POST data
								var unicodeConverter =
									Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
										.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
								unicodeConverter.charset = "UTF-8";
								var bodyStream = unicodeConverter.convertToInputStream(body);
								
								// Get listener for when compression is done
								var listener = new Zotero.BufferedInputListener(bufferUploader);
								
								// Initialize stream converter
								var converter =
									Components.classes["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
										.createInstance(Components.interfaces.nsIStreamConverter);
								converter.asyncConvertData("uncompressed", "gzip", listener, null);
								
								// Send input stream to stream converter
								var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
										createInstance(Components.interfaces.nsIInputStreamPump);
								pump.init(bodyStream, -1, -1, 0, 0, true);
								pump.asyncRead(converter, null);
							}
							
							// Don't compress upload data
							else {
								Zotero.HTTP.doPost(url, body, uploadCallback);
							}
						}
					);
					
					try {
						gen.next();
					}
					catch (e if e.toString() === "[object StopIteration]") {}
					Zotero.pumpGenerator(gen, false, errorHandler);
				}
				catch (e) {
					errorHandler(e);
				}
			}
			catch (e) {
				_error(e);
			}
			finally {
				Zotero.UnresponsiveScriptIndicator.enable();
			}
		});
		
		return;
	}
	
	
	function clear(callback) {
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login(function () {
				Zotero.Sync.Server.clear(callback);
			});
			return;
		}
		
		var url = _serverURL + "clear";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(function () {
					Zotero.Sync.Server.clear(callback);
				});
				return;
			}
			
			_checkResponse(xmlhttp);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'cleared') {
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			Zotero.Sync.Server.resetClient();
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function resetClient() {
		Zotero.debug("Resetting client");
		
		Zotero.DB.beginTransaction();
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('lastlocalsync', 'lastremotesync', 'syncdeletelog')";
		Zotero.DB.query(sql);
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('lastlocalsync', 'lastremotesync', 'syncdeletelog')";
		Zotero.DB.query(sql);
		
		Zotero.DB.query("DELETE FROM syncDeleteLog");
		Zotero.DB.query("DELETE FROM storageDeleteLog");
		
		sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
		Zotero.DB.query(sql, Zotero.Date.getUnixTimestamp());
		
		Zotero.DB.commitTransaction();
	}
	
	
	function logout(callback) {
		var url = _serverURL + "logout";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		_sessionID = null;
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp);
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'loggedout') {
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function _checkResponse(xmlhttp, noReloadOnFailure) {
		if (!xmlhttp.responseText) {
			var channel = xmlhttp.channel;
			// Check SSL cert
			var secInfo = channel.securityInfo;
			if (secInfo instanceof Ci.nsITransportSecurityInfo) {
				secInfo.QueryInterface(Ci.nsITransportSecurityInfo);
				if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_INSECURE) == Ci.nsIWebProgressListener.STATE_IS_INSECURE) {
					var url = channel.name;
					var ios = Components.classes["@mozilla.org/network/io-service;1"].
								getService(Components.interfaces.nsIIOService);
					try {
						var uri = ios.newURI(url, null, null);
						var host = uri.host;
					}
					catch (e) {
						Zotero.debug(e);
					}
					// TODO: localize
					_error("SSL certificate error connecting to " + host
						+ "\n\nSee http://zotero.org/support/kb/ssl_certificate_error for more information.",
						false, noReloadOnFailure);
				}
				else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_BROKEN) == Ci.nsIWebProgressListener.STATE_IS_BROKEN) {
					_error("SSL connection error", false, noReloadOnFailure);
				}
			}
			// TODO: localize
			if (xmlhttp.status === 0) {
				_error('Error connecting to server. Check your Internet connection.', false, noReloadOnFailure);
			}
			_error('Empty response from server. Please try again in a few minutes.', false, noReloadOnFailure);
		}
		
		if (!xmlhttp.responseXML || !xmlhttp.responseXML.childNodes[0] ||
				xmlhttp.responseXML.childNodes[0].tagName != 'response' ||
				!xmlhttp.responseXML.childNodes[0].firstChild) {
			Zotero.debug(xmlhttp.responseText);
			// TODO: localize
			_error('Invalid response from server. Please try again in a few minutes.', xmlhttp.responseText, noReloadOnFailure);
		}
		
		var firstChild = xmlhttp.responseXML.firstChild.firstChild;
		
		// Temporarily disable auto-sync if instructed by server
		if (firstChild.localName == 'throttle') {
			Zotero.debug(xmlhttp.responseText);
			var delay = first.getAttribute('delay');
			var time = new Date();
			time = time.getTime() + (delay * 1000);
			time = new Date(time);
			_throttleTimeout = time;
			if (delay < 86400000) {
				var timeStr = time.toLocaleTimeString();
			}
			else {
				var timeStr = time.toLocaleString();
			}
			_error("Auto-syncing disabled until " + timeStr, false, noReloadOnFailure);
		}
		
		if (firstChild.localName == 'error') {
			// Don't automatically retry 400 errors
			if (xmlhttp.status >= 400 && xmlhttp.status < 500 && !_invalidSession(xmlhttp)) {
				Zotero.debug("Server returned " + xmlhttp.status + " -- manual sync required", 2);
				Zotero.Sync.Server.manualSyncRequired = true;
			}
			else {
				Zotero.debug("Server returned " + xmlhttp.status, 3);
			}
			
			switch (firstChild.getAttribute('code')) {
				case 'INVALID_UPLOAD_DATA':
					// On the off-chance that this error is due to invalid characters
					// in a filename, check them all (since getting a more specific
					// error from the server would be difficult)
					var sql = "SELECT itemID FROM itemAttachments WHERE linkMode IN (?,?)";
					var ids = Zotero.DB.columnQuery(sql, [Zotero.Attachments.LINK_MODE_IMPORTED_FILE, Zotero.Attachments.LINK_MODE_IMPORTED_URL]);
					if (ids) {
						var items = Zotero.Items.get(ids);
						var rolledBack = false;
						for each(var item in items) {
							var file = item.getFile();
							if (!file) {
								continue;
							}
							try {
								var fn = file.leafName;
								// TODO: move stripping logic (copied from _xmlize()) to Utilities
								var xmlfn = file.leafName.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '');
								if (fn != xmlfn) {
									if (!rolledBack) {
										Zotero.DB.rollbackAllTransactions();
									}
									Zotero.debug("Changing invalid filename to " + xmlfn);
									item.renameAttachmentFile(xmlfn);
								}
							}
							catch (e) {
								Zotero.debug(e);
								Components.utils.reportError(e);
							}
						}
					}
					
					// Make sure this isn't due to relations using a local user key
					//
					// TEMP: This can be removed once a DB upgrade step is added
					try {
						var sql = "SELECT libraryID FROM relations WHERE libraryID LIKE 'local/%' LIMIT 1";
						var repl = Zotero.DB.valueQuery(sql);
						if (repl) {
							Zotero.Relations.updateUser(repl, repl, Zotero.userID, Zotero.libraryID);
						}
					}
					catch (e) {
						Components.utils.reportError(e);
						Zotero.debug(e);
					}
					break;
				
				case 'FULL_SYNC_REQUIRED':
					// Let current sync fail, and then do a full sync
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
							Components.utils.reportError("Skipping automatic client reset due to debug pref");
							return;
						}
						if (!Zotero.Sync.Server.canAutoResetClient) {
							Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._checkResponse()");
							return;
						}
						
						Zotero.Sync.Server.resetClient();
						Zotero.Sync.Server.canAutoResetClient = false;
						Zotero.Sync.Runner.sync(background);
					}, 1);
					break;
				
				case 'LIBRARY_ACCESS_DENIED':
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						var libraryID = parseInt(firstChild.getAttribute('libraryID'));
						var group = Zotero.Groups.getByLibraryID(libraryID);
						
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
												.getService(Components.interfaces.nsIPromptService);
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
										+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
										+ ps.BUTTON_DELAY_ENABLE;
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.warning'),
							Zotero.getString('sync.error.writeAccessLost', group.name) + "\n\n"
								+ Zotero.getString('sync.error.groupWillBeReset') + "\n\n"
								+ Zotero.getString('sync.error.copyChangedItems'),
							buttonFlags,
							Zotero.getString('sync.resetGroupAndSync'),
							null, null, null, {}
						);
						
						if (index == 0) {
							group.erase();
							Zotero.Sync.Server.resetClient();
							Zotero.Sync.Storage.resetAllSyncStates();
							Zotero.Sync.Runner.sync();
							return;
						}
					}, 1);
					break;
				
				case 'TAG_TOO_LONG':
					if (!Zotero.Sync.Runner.background) {
						var tag = xmlhttp.responseXML.firstChild.getElementsByTagName('tag');
						if (tag.length) {
							var tag = tag[0].firstChild.nodeValue;
							setTimeout(function () {
								var callback = function () {
									var sql = "SELECT DISTINCT name FROM tags WHERE LENGTH(name)>255 LIMIT 1";
									var tag = Zotero.DB.valueQuery(sql);
									if (tag) {
										var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
												   .getService(Components.interfaces.nsIWindowMediator);
										var lastWin = wm.getMostRecentWindow("navigator:browser");
										var dataOut = { result: null };
										lastWin.openDialog('chrome://zotero/content/longTagFixer.xul', '', 'chrome,modal,centerscreen', tag, dataOut);
										if (dataOut.result) {
											callback();
										}
									}
									else {
										Zotero.Sync.Runner.sync();
									}
								};
								
								callback();
							}, 1);
						}
					}
					break;
				
				// We can't reproduce it, but we can fix it
				case 'WRONG_LIBRARY_TAG_ITEM':
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						var sql = "CREATE TEMPORARY TABLE tmpWrongLibraryTags AS "
							+ "SELECT itemTags.ROWID AS tagRowID, tagID, name, itemID, "
							+ "IFNULL(tags.libraryID,0) AS tagLibraryID, "
							+ "IFNULL(items.libraryID,0) AS itemLibraryID FROM tags "
							+ "NATURAL JOIN itemTags JOIN items USING (itemID) "
							+ "WHERE IFNULL(tags.libraryID, 0)!=IFNULL(items.libraryID,0)";
						Zotero.DB.query(sql);
						
						sql = "SELECT COUNT(*) FROM tmpWrongLibraryTags";
						var badTags = !!Zotero.DB.valueQuery(sql);
						
						if (badTags) {
							sql = "DELETE FROM itemTags WHERE ROWID IN (SELECT tagRowID FROM tmpWrongLibraryTags)";
							Zotero.DB.query(sql);
						}
						
						Zotero.DB.query("DROP TABLE tmpWrongLibraryTags");
						
						// If error was actually due to a missing item, do a Full Sync
						if (!badTags) {
							if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
								Components.utils.reportError("Skipping automatic client reset due to debug pref");
								return;
							}
							if (!Zotero.Sync.Server.canAutoResetClient) {
								Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._checkResponse()");
								return;
							}
							
							Zotero.Sync.Server.resetClient();
							Zotero.Sync.Server.canAutoResetClient = false;
						}
						
						Zotero.Sync.Runner.sync(background);
					}, 1);
					break;
				
				case 'INVALID_TIMESTAMP':
					var validClock = Zotero.DB.valueQuery("SELECT CURRENT_TIMESTAMP BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'");
					if (!validClock) {
						// TODO: localize
						_error("The system clock is set to an invalid time. You will need to correct this to sync with the Zotero server.");
					}
					
					setTimeout(function () {
						Zotero.DB.beginTransaction();
						
						var types = ['collections', 'creators', 'items', 'savedSearches', 'tags'];
						for each (var type in types) {
							var sql = "UPDATE " + type + " SET dateAdded=CURRENT_TIMESTAMP "
									+ "WHERE dateAdded NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
							var sql = "UPDATE " + type + " SET dateModified=CURRENT_TIMESTAMP "
									+ "WHERE dateModified NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
							var sql = "UPDATE " + type + " SET clientDateModified=CURRENT_TIMESTAMP "
									+ "WHERE clientDateModified NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
						}
						
						Zotero.DB.commitTransaction();
					}, 1);
					break;
				
				case 'UPGRADE_REQUIRED':
					Zotero.Sync.Server.upgradeRequired = true;
					break;
			}
		}
	}
	
	
	/**
	 * @private
	 * @param	{DOMElement}	response
	 * @param	{Function}		callback
	 */
	function _checkServerLock(response, callback) {
		_checkTimer = null;
		
		var mode;
		
		switch (response.firstChild.localName) {
			case 'queued':
				mode = 'queued';
				break;
			
			case 'locked':
				mode = 'locked';
				break;
				
			default:
				return false;
		}
		
		if (mode == 'queued') {
			var msg = "Upload queued";
		}
		else {
			var msg = "Associated libraries are locked";
		}
		
		var wait = parseInt(response.firstChild.getAttribute('wait'));
		if (!wait || isNaN(wait)) {
			wait = 5000;
		}
		Zotero.debug(msg + " -- waiting " + wait + "ms before next check");
		_checkTimer = setTimeout(function () { callback(mode); }, wait);
		return true;
	}
	
	
	/**
	 * Make sure we're syncing with the same account we used last time
	 *
	 * @param	{Integer}	userID			New userID
	 * @param	{Integer}	libraryID		New libraryID
	 * @param	{Integer}	noServerData	The server account is empty — this is
	 * 											the account after a server clear
	 * @return 	1 if sync should continue, 0 if sync should restart, -1 if sync should cancel
	 */
	function _checkSyncUser(userID, libraryID, noServerData) {
		if (Zotero.DB.transactionInProgress()) {
			throw ("Transaction in progress in Zotero.Sync.Server._checkSyncUser");
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT value FROM settings WHERE setting='account' AND key='username'";
		var lastUsername = Zotero.DB.valueQuery(sql);
		var username = Zotero.Sync.Server.username;
		var lastUserID = Zotero.userID;
		var lastLibraryID = Zotero.libraryID;
		
		var restartSync = false;
		
		if (lastUserID && lastUserID != userID) {
			var groups = Zotero.Groups.getAll();
			
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
			+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING)
			+ ps.BUTTON_POS_1_DEFAULT
			+ ps.BUTTON_DELAY_ENABLE;
			
			var msg = "This Zotero database was last synced with a different "
					+ "zotero.org account ('" + lastUsername + "') from the "
					+ "current one ('" + username + "'). ";
			
			if (!noServerData) {
				// TODO: localize
				msg += "If you continue, local Zotero data will be "
						+ "combined with data from the '" + username + "' account "
						+ "stored on the server.";
				// If there are local groups belonging to the previous user,
				// we need to remove them
				if (groups.length) {
					msg += "Local groups, including any with changed items, will also "
							+ "be removed.";
				}
				msg += "\n\n"
						+ "To avoid combining or losing data, revert to the '"
						+ lastUsername + "' account or use the Reset options "
						+ "in the Sync pane of the Zotero preferences.";
				
				var syncButtonText = "Sync";
			}
			else if (groups.length) {
				msg += "If you continue, local groups, including any with changed items, "
						+ "will be removed and replaced with groups linked to the '"
						+ username + "' account."
						+ "\n\n"
						+ "To avoid losing local changes to groups, be sure you "
						+ "have synced with the '" + lastUsername + "' account before "
						+ "syncing with the '" + username + "' account.";
				
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
					if (index == 1) {
						// Cancel
					}
					else if (index == 2) {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
						var lastWin = wm.getMostRecentWindow("navigator:browser");
						lastWin.ZoteroPane.openPreferences('zotero-prefpane-sync');
					}
					
					Zotero.DB.commitTransaction();
					return -1;
				}
				
				// Delete all local groups
				for each(var group in groups) {
					group.erase();
				}
				
				restartSync = true;
			}
		}
		
		if (lastUserID != userID || lastLibraryID != libraryID) {
			if (!lastLibraryID) {
				var repl = "local/" + Zotero.getLocalUserKey();
			}
			
			Zotero.userID = userID;
			Zotero.libraryID = libraryID;
			
			// Update libraryID in relations, which we store for the local
			// for some reason. All other objects use null for the local library.
			if (lastUserID && lastLibraryID) {
				Zotero.Relations.updateUser(lastUserID, lastLibraryID, userID, libraryID);
				
				Zotero.Sync.Server.resetClient();
				Zotero.Sync.Storage.resetAllSyncStates();
			}
			// Replace local user key with libraryID, in case duplicates were
			// merged before the first sync
			else if (!lastLibraryID) {
				Zotero.Relations.updateUser(repl, repl, userID, libraryID);
			}
		}
		
		if (lastUsername != username) {
			Zotero.username = username;
		}
		
		Zotero.DB.commitTransaction();
		
		return restartSync ? 0 : 1;
	}
	
	
	
	
	
	function _invalidSession(xmlhttp) {
		if (xmlhttp.responseXML.childNodes[0].firstChild.tagName != 'error') {
			return false;
		}
		
		var code = xmlhttp.responseXML.childNodes[0].firstChild.getAttribute('code');
		return (code == 'INVALID_SESSION_ID') || (code == 'SESSION_TIMED_OUT');
	}
	
	
	function _error(e, extraInfo, skipReload) {
		if (e.name && e.name == 'ZOTERO_ERROR') {
			switch (e.error) {
				case Zotero.Error.ERROR_MISSING_OBJECT:
				case Zotero.Error.ERROR_FULL_SYNC_REQUIRED:
					// Let current sync fail, and then do a full sync
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
							Components.utils.reportError("Skipping automatic client reset due to debug pref");
							return;
						}
						if (!Zotero.Sync.Server.canAutoResetClient) {
							Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._error() -- manual sync required");
							return;
						}
						Zotero.Sync.Server.resetClient();
						Zotero.Sync.Server.canAutoResetClient = false;
						Zotero.Sync.Runner.sync(background);
					}, 1);
					break;
				
				case Zotero.Error.ERROR_SYNC_USERNAME_NOT_SET:
				case Zotero.Error.ERROR_INVALID_SYNC_LOGIN:
					// TODO: the setTimeout() call below should just simulate a click on the sync error icon
					// instead of creating its own dialog, but setSyncIcon() doesn't yet provide full control
					// over dialog title and primary button text/action, which is why this version of the
					// dialog is a bit uglier than the manual click version
					// TODO: localize and combine with below
					var msg = "The Zotero sync server did not accept your username and password.\n\n"
								+ "Please check that you have entered your zotero.org login information correctly in the Zotero sync preferences.";
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
					setTimeout(function () {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									.getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
											+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
						// TODO: localize
						if (e.error == Zotero.Error.ERROR_SYNC_USERNAME_NOT_SET) {
							var title = Zotero.getString('sync.error.usernameNotSet');
							var msg = "You must enter your zotero.org username and password in the Zotero preferences to sync with the Zotero server."
						}
						else {
							var title = Zotero.getString('sync.error.invalidLogin');
							var msg = "The Zotero sync server did not accept your username and password.\n\n"
									+ "Please check that you have entered your zotero.org login information correctly in the Zotero sync preferences.";
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
					break;
			}
		}
		
		if (e.message == 'script stack space quota is exhausted') {
			var e = "Firefox 4.0 or higher is required to process sync operations of this size.";
		}
		
		if (extraInfo) {
			// Server errors will generally be HTML
			extraInfo = Zotero.Utilities.unescapeHTML(extraInfo);
			Components.utils.reportError(extraInfo);
		}
		
		Zotero.debug(e, 1);
		
		_syncInProgress = false;
		Zotero.DB.rollbackAllTransactions();
		if (!skipReload) {
			Zotero.reloadDataObjects();
		}
		Zotero.Sync.EventListener.resetIgnored();
		
		_callbacks.onError(e);
		
		throw (e);
	}
}




Zotero.BufferedInputListener = function (callback) {
	this._callback = callback;
}

Zotero.BufferedInputListener.prototype = {
	binaryInputStream: null,
	size: 0,
	data: '',
	
	onStartRequest: function(request, context) {},
	
	onStopRequest: function(request, context, status) {
		this.binaryInputStream.close();
		delete this.binaryInputStream;
		
		this._callback(this.data);
	},
	
	onDataAvailable: function(request, context, inputStream, offset, count) {
		this.size += count;
		
		this.binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"]
			.createInstance(Components.interfaces.nsIBinaryInputStream)
		this.binaryInputStream.setInputStream(inputStream);
		this.data += this.binaryInputStream.readBytes(this.binaryInputStream.available());
	},
	
	QueryInterface: function (iid) {
		if (iid.equals(Components.interfaces.nsISupports)
			   || iid.equals(Components.interfaces.nsIStreamListener)) {
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
}


/**
 * Stores information about a sync session
 *
 * @class
 * @property	{Object}					uploadKeys		Keys to upload to server
 * @property	{Zotero.Sync.ObjectKeySet}	uploadKeys.updated
 * @property	{Zotero.Sync.ObjectKeySet}	uploadKeys.deleted
 */
Zotero.Sync.Server.Session = function (defaultLibraryID) {
	this.uploadKeys = {};
	this.uploadKeys.updated = new Zotero.Sync.ObjectKeySet;
	this.uploadKeys.deleted = new Zotero.Sync.ObjectKeySet;
	
	this.suppressWarnings = false;
}


Zotero.Sync.Server.Session.prototype.addToUpdated = function (objs) {
	this._addToKeySet('updated', objs);
}

Zotero.Sync.Server.Session.prototype.addToDeleted = function (objs) {
	this._addToKeySet('deleted', objs);
}


Zotero.Sync.Server.Session.prototype.objectInUpdated = function (obj) {
	var type = obj.objectType;
	return this.uploadKeys.updated.hasLibraryKey(type, obj.libraryID, obj.key);
}


Zotero.Sync.Server.Session.prototype.objectInDeleted = function (obj) {
	var type = obj.objectType;
	return this.uploadKeys.deleted.hasLibraryKey(type, obj.libraryID, obj.key);
}


/**
 * Returns array of keys of deleted objects in specified library
 */
Zotero.Sync.Server.Session.prototype.getDeleted = function (type, libraryID) {
	return this.uploadKeys.deleted.getKeys(type, libraryID);
}


Zotero.Sync.Server.Session.prototype.removeFromUpdated = function (objs) {
	this._removeFromKeySet('updated', objs);
}


Zotero.Sync.Server.Session.prototype.removeFromDeleted = function (objs) {
	this._removeFromKeySet('deleted', objs);
}


Zotero.Sync.Server.Session.prototype._addToKeySet = function (keySet, objs) {
	objs = Zotero.flattenArguments(objs);
	
	var type = objs[0].objectType;
	
	var keyPairs = [];
	for each(var obj in objs) {
		keyPairs.push({
			libraryID: obj.libraryID,
			key: obj.key
		});
	}
	
	this.uploadKeys[keySet].addLibraryKeyPairs(type, keyPairs)
}


Zotero.Sync.Server.Session.prototype._removeFromKeySet = function (keySet, objs) {
	if (!objs) {
		throw ("No objects provided in Zotero.Sync.Server.Session._removeFromKeySet()");
	}
	objs = Zotero.flattenArguments(objs);
	
	var type = objs[0].objectType;
	
	var keyPairs = [];
	for each(var obj in objs) {
		keyPairs.push({
			libraryID: obj.libraryID,
			key: obj.key
		});
	}
	this.uploadKeys[keySet].removeLibraryKeyPairs(type, keyPairs)
}


Zotero.Sync.Server.Data = new function() {
	var _noMergeTypes = ['search'];
	
	/**
	 * Pull out collections from delete queue in XML
	 *
	 * @param	{DOMNode}			xml
	 * @return	{String[]}					Array of collection keys
	 */
	function _getDeletedCollectionKeys(updatedNode) {
		var keys = [];
		for each(var c in updatedNode.xpath("deleted/collections/collection")) {
			var libraryID = c.getAttribute('libraryID');
			libraryID = libraryID ? parseInt(libraryID) : null;
			keys.push({
				libraryID: libraryID,
				key: c.getAttribute('key')
			});
		}
		return keys;
	}
	
	
	this.processUpdatedXML = function (updatedNode, lastLocalSyncDate, syncSession, defaultLibraryID, callback) {
		updatedNode.xpath = function (path) {
			return Zotero.Utilities.xpath(this, path);
		};
		
		if (updatedNode.childNodes.length == 0) {
			Zotero.debug('No changes received from server');
			callback(Zotero.Sync.Server.Data.buildUploadXML(syncSession));
			return;
		}
		
		function _libID(libraryID) {
			return _getLibraryID(libraryID, defaultLibraryID);
		}
		
		function _timeToYield() {
			if (!progressMeter) {
				if (Date.now() - start > progressMeterThreshold) {
					Zotero.showZoteroPaneProgressMeter(
						Zotero.getString('sync.status.processingUpdatedData'),
						false,
						"chrome://zotero/skin/arrow_rotate_animated.png"
					);
					progressMeter = true;
				}
			}
			else if (Date.now() - lastRepaint > repaintTime) {
				lastRepaint = Date.now();
				return true;
			}
			return false;
		}
		
		var progressMeter = false;
		var progressMeterThreshold = 100;
		var start = Date.now();
		var repaintTime = 100;
		var lastRepaint = Date.now();
		
		var deletedCollectionKeys = _getDeletedCollectionKeys(updatedNode);
		
		var remoteCreatorStore = {};
		var relatedItemsStore = {};
		var itemStorageModTimes = {};
		var childItemStore = [];
		
		// Remotely changed groups
		var groupNodes = updatedNode.xpath("groups/group");
		if (groupNodes.length) {
			Zotero.debug("Processing remotely changed groups");
			for each(var groupNode in groupNodes) {
				var group = Zotero.Sync.Server.Data.xmlToGroup(groupNode);
				group.save();
			}
		}
		
		if (_timeToYield()) yield true;
		
		// Remotely deleted groups
		var deletedGroups = updatedNode.xpath("deleted/groups");
		if (deletedGroups.length && deletedGroups.textContent) {
			Zotero.debug("Processing remotely deleted groups");
			var groupIDs = deletedGroups.textContent.split(' ');
			Zotero.debug(groupIDs);
			
			for each(var groupID in groupIDs) {
				var group = Zotero.Groups.get(groupID);
				if (!group) {
					continue;
				}
				
				// TODO: prompt to save data to local library?
				
				group.erase();
			}
		}
		
		if (_timeToYield()) yield true;
		
		// Get unmodified creators embedded within items -- this is necessary if, say,
		// a creator was deleted locally and appears in a new/modified item remotely
		var embeddedCreators = {};
		for each(var creatorNode in updatedNode.xpath("items/item/creator/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			
			var creatorObj = Zotero.Creators.getByLibraryAndKey(libraryID, key);
			// If creator exists locally, we don't need it
			if (creatorObj) {
				continue;
			}
			// Note which embedded creators are available
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (!embeddedCreators[lkh]) {
				embeddedCreators[lkh] = true;
			}
		}
		// Make sure embedded creators aren't already provided in the <creators> node
		// This isn't necessary if the server data is correct
		for each(var creatorNode in updatedNode.xpath("creators/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (embeddedCreators[lkh]) {
				var msg = "Creator " + libraryID + "/" + key + " was unnecessarily embedded in server response "
							+ "in Zotero.Sync.Server.Data.processUpdatedXML()";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg)
				delete embeddedCreators[lkh];
			}
		}
		// For any embedded creators that don't exist locally and aren't already
		// included in the <creators> node, copy the node into <creators> for saving
		var creatorsNode = false;
		for each(var creatorNode in updatedNode.xpath("items/item/creator/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (embeddedCreators[lkh]) {
				if (!creatorsNode) {
					creatorsNode = updatedNode.xpath("creators");
					if (creatorsNode.length) {
						creatorsNode = creatorsNode[0];
					}
					else {
						creatorsNode = updatedNode.ownerDocument.createElement("creators");
						updatedNode.appendChild(creatorsNode);
					}
				}
				
				Zotero.debug("Adding embedded creator " + libraryID + "/" + key + " to <creators>");
				
				creatorsNode.appendChild(creatorNode);
				delete embeddedCreators[lkh];
			}
		}
		
		if (_timeToYield()) yield true;
		
		// Other objects
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			var toSave = [];
			var toDelete = [];
			var toReconcile = [];
			
			// Display a warning once for each object type
			syncSession.suppressWarnings = false;
			
			//
			// Handle modified objects
			//
			Zotero.debug("Processing remotely changed " + types);
			
			typeloop:
			for each(var objectNode in updatedNode.xpath(types + "/" + type)) {
				var libraryID = _libID(objectNode.getAttribute('libraryID'));
				var key = objectNode.getAttribute('key');
				var objLibraryKeyHash = Zotero[Types].makeLibraryKeyHash(libraryID, key);
				
				Zotero.debug("Processing remote " + type + " " + libraryID + "/" + key, 4);
				var isNewObject;
				var localDelete = false;
				var skipCR = false;
				var deletedItemKeys = null;
				
				// Get local object with same library and key
				var obj = Zotero[Types].getByLibraryAndKey(libraryID, key);
				if (obj) {
					Zotero.debug("Matching local " + type + " exists", 4);
					isNewObject = false;
					
					var objDate = Zotero.Date.sqlToDate(obj.dateModified, true);
					
					// Local object has been modified since last sync
					if ((objDate > lastLocalSyncDate &&
								objDate < Zotero.Sync.Server.nextLocalSyncDate)
							// Check for object in updated array, since it might
							// have been modified during sync process, making its
							// date equal to Zotero.Sync.Server.nextLocalSyncDate
							// and therefore excluded above
							|| syncSession.objectInUpdated(obj)) {
						
						Zotero.debug("Local " + type + " " + obj.id
								+ " has been modified since last sync", 4);
						
						// Merge and store related items, since CR doesn't
						// affect related items
						if (type == 'item') {
							// Remote
							var relKeys = _getFirstChildContent(objectNode, 'related');
							relKeys = relKeys ? relKeys.split(' ') : [];
							// Local
							for each(var relID in obj.relatedItems) {
								var relKey = Zotero.Items.get(relID).key;
								if (relKeys.indexOf(relKey) == -1) {
									relKeys.push(relKey);
								}
							}
							if (relKeys.length) {
								relatedItemsStore[objLibraryKeyHash] = relKeys;
							}
							Zotero.Sync.Server.Data.removeMissingRelatedItems(objectNode);
						}
						
						var remoteObj = Zotero.Sync.Server.Data['xmlTo' + Type](objectNode, null, null, defaultLibraryID);

						// Some types we don't bother to reconcile
						if (_noMergeTypes.indexOf(type) != -1) {
							// If local is newer, send to server
							if (obj.dateModified > remoteObj.dateModified) {
								syncSession.addToUpdated(obj);
								continue;
							}
							
							// Overwrite local below
						}
						// Mark other types for conflict resolution
						else {
							// Skip item if dateModified is the only modified
							// field (and no linked creators changed)
							switch (type) {
								// Will be handled by item CR for now
								case 'creator':
									remoteCreatorStore[Zotero.Creators.getLibraryKeyHash(remoteObj)] = remoteObj;
									syncSession.removeFromUpdated(obj);
									continue;
									
								case 'item':
									var diff = obj.diff(remoteObj, false, ["dateAdded", "dateModified"]);
									Zotero.debug('Diff:');
									Zotero.debug(diff);
									if (!diff) {
										// Check if creators changed
										var creatorsChanged = false;
										
										var creators = obj.getCreators();
										var remoteCreators = remoteObj.getCreators();
										
										if (creators.length != remoteCreators.length) {
											Zotero.debug('Creators have changed');
											creatorsChanged = true;
										}
										else {
											creators = creators.concat(remoteCreators);
											for each(var creator in creators) {
												var r = remoteCreatorStore[Zotero.Creators.getLibraryKeyHash(creator.ref)];
												// Doesn't include dateModified
												if (r && !r.equals(creator.ref)) {
													creatorsChanged = true;
													break;
												}
											}
										}
										if (!creatorsChanged) {
											syncSession.removeFromUpdated(obj);
											continue;
										}
									}
									
									// Always keep the parent item if there is one,
									// regardless of which side is chosen during CR
									var localParent = obj.getSourceKey();
									var remoteParent = remoteObj.getSourceKey();
									if (!localParent && remoteParent) {
										obj.setSourceKey(remoteParent);
									}
									else if (localParent && !remoteParent) {
										remoteObj.setSourceKey(localParent);
									}
									
									/*
									if (obj.deleted && !remoteObj.deleted) {
										obj = 'trashed';
									}
									else if (!obj.deleted && remoteObj.deleted) {
										remoteObj = 'trashed';
									}
									*/
									break;
								
								case 'collection':
									var changed = _mergeCollection(obj, remoteObj, syncSession);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
										continue;
									}
									// The merged collection needs to be saved
									skipCR = true;
									break;
								
								case 'tag':
									var changed = _mergeTag(obj, remoteObj, syncSession);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
									}
									continue;
							}
							
							// TODO: order reconcile by parent/child?
							
							if (!skipCR) {
								toReconcile.push([
									obj,
									remoteObj
								]);
								
								continue;
							}
						}
					}
					else {
						Zotero.debug("Local " + type + " has not changed", 4);
					}
					
					// Overwrite local below
				}
				
				// Object doesn't exist locally
				else {
					isNewObject = true;
					
					// Check if object has been deleted locally
					var fakeObj = {
						objectType: type,
						libraryID: libraryID,
						key: key
					};
					
					if (syncSession.objectInDeleted(fakeObj)) {
						// TODO: non-merged items
						
						switch (type) {
							case 'item':
								localDelete = true;
								break;
							
							// Auto-restore locally deleted tags and collections that
							// have changed remotely
							case 'tag':
							case 'collection':
								syncSession.removeFromDeleted(fakeObj);
								
								var msg = _generateAutoChangeLogMessage(
									type, null, objectNode.getAttribute('name')
								);
								Zotero.log(msg, 'warning');
								
								if (!syncSession.suppressWarnings) {
									var msg = _generateAutoChangeAlertMessage(
										types, null, objectNode.getAttribute('name')
									);
									alert(msg);
									syncSession.suppressWarnings = true;
								}
								
								deletedItemKeys = syncSession.getDeleted('item', libraryID);
								break;
							
							default:
								var msg = 'Cannot reconcile delete conflict for ' + type;
								var e = new Zotero.Error(msg, "FULL_SYNC_REQUIRED");
								throw (e);
						}
					}
				}
				
				
				// Temporarily remove and store related items that don't yet exist
				if (type == 'item') {
					var missing = Zotero.Sync.Server.Data.removeMissingRelatedItems(objectNode);
					if (missing.length) {
						relatedItemsStore[objLibraryKeyHash] = missing;
					}
				}
				
				// Create or overwrite locally
				//
				// If we skipped CR above, we already have an object to use
				if (!skipCR) {
					obj = Zotero.Sync.Server.Data['xmlTo' + Type](objectNode, obj, false, defaultLibraryID, deletedItemKeys);
				}
				
				if (isNewObject && type == 'tag') {
					// If a local tag matches the name of a different remote tag,
					// delete the local tag and add items linked to it to the
					// matching remote tag
					//
					// DEBUG: why use objectNode?
					var tagName = objectNode.getAttribute('name');
					var tagType = objectNode.getAttribute('type');
					tagType = tagType ? parseInt(tagType) : 0;
					var linkedItems = _deleteConflictingTag(syncSession, tagName, tagType, obj.libraryID);
					if (linkedItems) {
						var mod = false;
						for each(var id in linkedItems) {
							var added = obj.addItem(id);
							if (added) {
								mod = true;
							}
						}
						if (mod) {
							obj.dateModified = Zotero.DB.transactionDateTime;
							syncSession.addToUpdated({
								objectType: 'tag',
								libraryID: obj.libraryID,
								key: objectNode.getAttribute('key')
							});
						}
					}
				}
				
				if (localDelete) {
					// TODO: order reconcile by parent/child?
					
					toReconcile.push([
						'deleted',
						obj
					]);
				}
				else {
					toSave.push(obj);
				}
				
				if (type == 'item') {
					// Make sure none of the item's creators are marked as
					// deleted, which could happen if a creator was deleted
					// locally but attached to a new/modified item remotely
					// and added back in xmlToItem()
					if (obj.isRegularItem()) {
						var creators = obj.getCreators();
						for each(var creator in creators) {
							syncSession.removeFromDeleted(creator.ref);
						}
					}
					else if (obj.isImportedAttachment()) {
						// Mark new attachments for download
						if (isNewObject) {
							obj.attachmentSyncState =
								Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
						}
						// Set existing attachments mtime update check
						else {
							var mtime = objectNode.getAttribute('storageModTime');
							if (mtime) {
								var lk = Zotero.Items.getLibraryKeyHash(obj)
								// Convert previously used Unix timestamps to ms-based timestamps
								if (mtime < 10000000000) {
									Zotero.debug("Converting Unix timestamp '" + mtime + "' to milliseconds");
									mtime = mtime * 1000;
								}
								itemStorageModTimes[lk] = parseInt(mtime);
							}
						}
					}
				}
				// Fix potential FK constraint error on fki_collectionItems_itemID_sourceItemID
				//
				// STR:
				// 
				// Create an empty note on A.
				// Create an empty item on A.
				// Create a collection on A.
				// Drag item to collection on A.
				// Sync A.
				// Sync B.
				// Drag note to collection on B.
				// Sync B.
				// Drag note under item on A.
				// Sync A.
				// 
				// Explanation:
				//
				// Dragging note to collection on B doesn't modify the note
				// and only sends the collection-items change.
				// When sync on A tries to add the note to the collection,
				// an error occurs, because the note is now a child note locally,
				// and a child note can't belong to a collection.
				//
				// We fix this by removing child items from collections they
				// would be in after saving, and we add their parents instead.
				else if (type == 'collection') {
					var childItems = obj.getChildItems(false, true);
					var existing = [];
					var toAdd = [];
					var toRemove = [];
					for each(var childItem in childItems) {
						existing.push(childItem.id);
						var parentItem = childItem.getSource();
						if (parentItem) {
							parentItem = Zotero.Items.get(parentItem);
							// Add parent to collection
							toAdd.push(parentItem.id);
							// Remove child from collection
							toRemove.push(childItem.id);
						}
					}
					// Add
					toAdd = Zotero.Utilities.arrayDiff(toAdd, existing);
					var changed = toAdd.length > 0;
					existing = existing.concat(toAdd);
					var origLen = existing.length;
					// Remove
					existing = Zotero.Utilities.arrayDiff(existing, toRemove);
					changed = changed || origLen != existing.length;
					// Set
					if (changed) {
						obj.childItems = existing;
						syncSession.addToUpdated(obj);
					}
				}
				
				if (_timeToYield()) yield true;
			}
			
			//
			// Handle remotely deleted objects
			//
			var deletedObjectNodes = updatedNode.xpath("deleted/" + types + "/" + type);
			if (deletedObjectNodes.length) {
				Zotero.debug("Processing remotely deleted " + types);
				
				syncSession.suppressWarnings = false;
				
				for each(var delNode in deletedObjectNodes) {
					var libraryID = _libID(delNode.getAttribute('libraryID'));
					var key = delNode.getAttribute('key');
					var obj = Zotero[Types].getByLibraryAndKey(libraryID, key);
					// Object can't be found
					if (!obj) {
						// Since it's already deleted remotely, don't include
						// the object in the deleted array if something else
						// caused its deletion during the sync
						syncSession.removeFromDeleted({
							objectType: type,
							libraryID: libraryID,
							key: key
						});
						continue;
					}
					
					var modDate = Zotero.Date.sqlToDate(obj.dateModified, true);
					
					// Local object hasn't been modified -- delete
					if (modDate < lastLocalSyncDate) {
						toDelete.push(obj.id);
						continue;
					}
					
					// Local object has been modified since last sync -- reconcile
					switch (type) {
						case 'item':
							// TODO: order reconcile by parent/child
							toReconcile.push([obj, 'deleted']);
							break;
						
						case 'tag':
						case 'collection':
							var msg = _generateAutoChangeLogMessage(
								type, obj.name, null
							);
							Zotero.log(msg, 'warning');
							
							if (!syncSession.suppressWarnings) {
								var msg = _generateAutoChangeAlertMessage(
									types, obj.name, null
								);
								alert(msg);
								syncSession.suppressWarnings = true;
							}
							continue;
							
						default:
							alert('Delete reconciliation unimplemented for ' + types);
							throw ('Delete reconciliation unimplemented for ' + types);
					}
				}
				
				if (_timeToYield()) yield true;
			}
			
			
			//
			// Reconcile objects that have changed locally and remotely
			//
			if (toReconcile.length) {
				if (Zotero.Sync.Runner.background) {
					Zotero.Sync.Server.manualSyncRequired = true;
					
					// TODO: localize again
					//Zotero.getString('sync.error.manualInterventionRequired')
					//Zotero.getString('sync.error.clickSyncIcon')
					var msg = "Conflicts have suspended automatic syncing.\n\nClick the sync icon to resolve them.";
					var e = new Zotero.Error(msg, 0, { dialogButtonText: null });
					throw (e);
				}
				
				var mergeData = _reconcile(type, toReconcile, remoteCreatorStore);
				if (!mergeData) {
					Zotero.DB.rollbackTransaction();
					callback(false);
					return;
				}
				_processMergeData(
					syncSession,
					type,
					mergeData,
					toSave,
					toDelete,
					relatedItemsStore
				);
			}
			
			if (_timeToYield()) yield true;
			
			// Save objects
			Zotero.debug('Saving merged ' + types);
			
			if (type == 'collection') {
				for each(var col in toSave) {
					var changed = _removeChildItemsFromCollection(col, childItemStore);
					if (changed) {
						syncSession.addToUpdated(col);
					}
				}
				
				// Save collections recursively from the top down
				_saveCollections(toSave);
			}
			else if (type == 'item') {
				// Save parent items first
				for (var i=0; i<toSave.length; i++) {
					if (!toSave[i].getSourceKey()) {
						toSave[i].save();
						toSave.splice(i, 1);
						i--;
					}
				}
				
				// Save the rest
				for each(var obj in toSave) {
					// Keep list of all child items being saved
					var store = false;
					if (!obj.isTopLevelItem()) {
						store = true;
					}
					
					obj.save();
					
					if (store) {
						childItemStore.push(obj.id)
					}
					
					if (_timeToYield()) yield true;
				}
				
				// Add back related items (which now exist)
				for (var libraryKeyHash in relatedItemsStore) {
					var lk = Zotero.Items.parseLibraryKeyHash(libraryKeyHash);
					var item = Zotero.Items.getByLibraryAndKey(lk.libraryID, lk.key);
					for each(var relKey in relatedItemsStore[libraryKeyHash]) {
						var relItem = Zotero.Items.getByLibraryAndKey(lk.libraryID, relKey);
						if (!relItem) {
							var msg = "Related item doesn't exist in Zotero.Sync.Server.Data.processUpdatedXML() "
										+ "(" + lk.libraryID + "/" + relKey + ")";
							var e = new Zotero.Error(msg, "MISSING_OBJECT");
							throw (e);
						}
						item.addRelatedItem(relItem.id);
					}
					item.save();
				}
			}
			else if (type == 'tag') {
				// Use a special saving mode for tags to avoid an issue that
				// occurs if a tag has changed names remotely but another tag
				// conflicts with the local version after the first tag has been
				// updated in memory, causing a deletion of the local tag.
				// Using the normal save mode, when the first remote tag then
				// goes to save, the linked items aren't saved, since as far
				// as the in-memory object is concerned, they haven't changed,
				// even though they've been deleted from the DB.
				//
				// To replicate, add an item, add a tag, sync both sides,
				// rename the tag, add a new one with the old name, and sync.
				for each(var obj in toSave) {
					obj.save(true);
					
					if (_timeToYield()) yield true;
				}
			}
			else if (type == 'relation') {
				for each(var obj in toSave) {
					if (obj.exists()) {
						continue;
					}
					obj.save();
					
					if (_timeToYield()) yield true;
				}
			}
			else {
				for each(var obj in toSave) {
					obj.save();
					
					if (_timeToYield()) yield true;
				}
			}
			
			// Delete
			Zotero.debug('Deleting merged ' + types);
			if (toDelete.length) {
				// Items have to be deleted children-first
				if (type == 'item') {
					var parents = [];
					var children = [];
					for each(var id in toDelete) {
						var item = Zotero.Items.get(id);
						if (item.getSource()) {
							children.push(item.id);
						}
						else {
							parents.push(item.id);
						}
						
						if (_timeToYield()) yield true;
					}
					
					// Lock dateModified in local versions of remotely deleted
					// collections so that any deleted items within them don't
					// update them, which would trigger erroneous conflicts
					var collections = [];
					for each(var col in deletedCollectionKeys) {
						col = Zotero.Collections.getByLibraryAndKey(col.libraryID, col.key);
						// If collection never existed on this side
						if (!col) {
							continue;
						}
						col.lockDateModified();
						collections.push(col);
					}
					
					if (children.length) {
						Zotero.Sync.EventListener.ignoreDeletions('item', children);
						Zotero.Items.erase(children);
					}
					if (parents.length) {
						Zotero.Sync.EventListener.ignoreDeletions('item', parents);
						Zotero.Items.erase(parents);
					}
					
					// Unlock dateModified for deleted collections
					for each(var col in collections) {
						col.unlockDateModified();
					}
					collections = null;
				}
				else {
					Zotero.Sync.EventListener.ignoreDeletions(type, toDelete);
					Zotero[Types].erase(toDelete);
				}
			}
			
			if (_timeToYield()) yield true;
			
			// Check mod times and hashes of updated items against stored values to see
			// if they've been updated elsewhere and mark for download if so
			if (type == 'item') {
				var ids = [];
				var modTimes = {};
				for (var libraryKeyHash in itemStorageModTimes) {
					var lk = Zotero.Items.parseLibraryKeyHash(libraryKeyHash);
					var item = Zotero.Items.getByLibraryAndKey(lk.libraryID, lk.key);
					ids.push(item.id);
					modTimes[item.id] = itemStorageModTimes[libraryKeyHash];
				}
				if (ids.length > 0) {
					Zotero.Sync.Storage.checkForUpdatedFiles(ids, modTimes);
				}
			}
		}
		
		if (_timeToYield()) yield true;
		
		callback(Zotero.Sync.Server.Data.buildUploadXML(syncSession));
	}
	
	
	/**
	 * @param	{Zotero.Sync.Server.Session}		syncSession
	 */
	this.buildUploadXML = function (syncSession) {
		//Zotero.debug(syncSession);
		var keys = syncSession.uploadKeys;
		
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						.createInstance(Components.interfaces.nsIDOMParser);
		var doc = parser.parseFromString("<data/>", "text/xml");
		var docElem = doc.documentElement;
		
		// Add API version attribute
		docElem.setAttribute('version', Zotero.Sync.Server.apiVersion);
		
		// Updates
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			var objectsNode = false;
			
			Zotero.debug("Processing locally changed " + types);
			
			var libraryID, key;
			for (var libraryID in keys.updated[types]) {
				for (var key in keys.updated[types][libraryID]) {
					// Insert the <[types]> node
					if (!objectsNode) {
						objectsNode = docElem.appendChild(doc.createElement(types));
					}
					
					var l = parseInt(libraryID);
					l = l ? l : null;
					var obj = Zotero[Types].getByLibraryAndKey(l, key);
					if (!obj) {
						Zotero.debug("Updated " + type + " " + l + "/" + key + " has disappeared -- skipping");
						syncSession.removeFromUpdated({
							objectType: type,
							libraryID: l,
							key: key
						});
						continue;
					}
					
					if (type == 'item') {
						// itemToXML needs the sync session
						var elem = this.itemToXML(obj, doc, syncSession);
					}
					else {
						var elem = this[type + 'ToXML'](obj, doc);
					}
					
					objectsNode.appendChild(elem);
				}
			}
		}
		
		// Deletions
		var deletedNode = doc.createElement('deleted');
		var inserted = false;
		
		var defaultLibraryID = Zotero.libraryID;
		
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			var deletedObjectsNode = false;
			
			Zotero.debug('Processing locally deleted ' + types);
			
			var elementCreated = false;
			var libraryID, key;
			for (var libraryID in keys.deleted[types]) {
				for (var key in keys.deleted[types][libraryID]) {
					// Insert the <deleted> node
					if (!inserted) {
						docElem.appendChild(deletedNode);
						inserted = true;
					}
					// Insert the <deleted><[types]></deleted> node
					if (!deletedObjectsNode) {
						deletedObjectsNode = deletedNode.appendChild(doc.createElement(types));
					}
					
					var n = doc.createElement(type);
					n.setAttribute('libraryID', parseInt(libraryID) ? parseInt(libraryID) : defaultLibraryID);
					n.setAttribute('key', key);
					deletedObjectsNode.appendChild(n);
				}
			}
		}
		
		
		var s = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
					.createInstance(Components.interfaces.nsIDOMSerializer);
		var xmlstr = s.serializeToString(doc);
		
		// No updated data
		if (docElem.childNodes.length == 0) {
			return '';
		}
		
		return xmlstr;
	}
	
	
	// Remove any child items from collection, which might exist if an attachment in a collection was
	// remotely changed from a	top-level item to a child item
	function _removeChildItemsFromCollection(collection, childItems) {
		if (!childItems.length) {
			return false;
		}
		var itemIDs = collection.getChildItems(true);
		// TODO: fix to always return array
		if (!itemIDs) {
			return false;
		}
		var newItemIDs = Zotero.Utilities.arrayDiff(itemIDs, childItems);
		if (itemIDs.length == newItemIDs.length) {
			return false;
		}
		collection.childItems = newItemIDs;
		return true;
	}
	
	
	function _mergeCollection(localObj, remoteObj, syncSession) {
		var diff = localObj.diff(remoteObj, false, true);
		if (!diff) {
			return false;
		}
		
		Zotero.debug("COLLECTION HAS CHANGED");
		Zotero.debug(diff);
		
		// Local is newer
		if (diff[0].primary.dateModified > diff[1].primary.dateModified) {
			Zotero.debug("Local is newer");
			var remoteIsTarget = false;
			var targetObj = localObj;
		}
		// Remote is newer
		else {
			Zotero.debug("Remote is newer");
			var remoteIsTarget = true;
			var targetObj = remoteObj;
		}
		
		if (diff[0].fields.name) {
			var msg = _generateAutoChangeLogMessage(
				'collection', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateAutoChangeAlertMessage(
					'collections', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
				);
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		// Check for child collections in the other object
		// that aren't in the target one
		if (diff[1].childCollections.length) {
			// TODO: log
			// TODO: add
			throw ("Collection hierarchy conflict resolution is unimplemented");
		}
		
		// Add items to local object, which is what's saved
		if (diff[1].childItems.length) {
			var childItems = localObj.getChildItems(true);
			if (childItems) {
				localObj.childItems = childItems.concat(diff[1].childItems);
			}
			else {
				localObj.childItems = diff[1].childItems;
			}
			
			var msg = _generateCollectionItemMergeLogMessage(
				targetObj.name,
				diff[0].childItems.concat(diff[1].childItems)
			);
			Zotero.log('warning');
			
			if (!syncSession.suppressWarnings) {
				
				alert(msg);
			}
		}
		
		return true;
	}
	
	
	function _mergeTag(localObj, remoteObj, syncSession) {
		var diff = localObj.diff(remoteObj, false, true);
		if (!diff) {
			return false;
		}
		
		Zotero.debug("TAG HAS CHANGED");
		Zotero.debug(diff);
		
		// Local is newer
		if (diff[0].primary.dateModified >
				diff[1].primary.dateModified) {
			var remoteIsTarget = false;
			var targetObj = localObj;
			var targetDiff = diff[0];
			var otherDiff = diff[1];
		}
		// Remote is newer
		else {
			var remoteIsTarget = true;
			var targetObj = remoteObj;
			var targetDiff = diff[1];
			var otherDiff = diff[0];
		}
		
		if (targetDiff.fields.name) {
			var msg = _generateAutoChangeLogMessage(
				'tag', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateAutoChangeAlertMessage(
					'tags', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
				);
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		// Add linked items in the other object to the target one
		if (otherDiff.linkedItems.length) {
			// need to handle changed items
			
			var linkedItems = targetObj.getLinkedItems(true);
			targetObj.linkedItems = linkedItems.concat(otherDiff.linkedItems);
			
			var msg = _generateTagItemMergeLogMessage(
				targetObj.name,
				otherDiff.linkedItems,
				remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateTagItemMergeAlertMessage();
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		targetObj.save();
		return true;
	}
	
	
	/**
	 * @param	{String}	itemTypes
	 * @param	{String}	localName
	 * @param	{String}	remoteName
	 * @param	{Boolean}	[remoteMoreRecent=false]
	 */
	function _generateAutoChangeAlertMessage(itemTypes, localName, remoteName, remoteMoreRecent) {
		if (localName === null) {
			var localDelete = true;
		}
		else if (remoteName === null) {
			var remoteDelete = true;
		}
		
		// TODO: localize
		var msg = "One or more locally deleted Zotero " + itemTypes + " have been "
			+ "modified remotely since the last sync. ";
		if (localDelete) {
			msg += "The remote versions have been kept.";
		}
		else if (remoteDelete) {
			msg += "The local versions have been kept.";
		}
		else {
			msg += "The most recent versions have been kept.";
		}
		msg += "\n\nView the " + (Zotero.isStandalone ? "" : "Firefox ")
				+ "Error Console for the full list of such changes.";
		return msg;
	}
	
	
	/**
	 * @param	{String}	itemType
	 * @param	{String}	localName
	 * @param	{String}	remoteName
	 * @param	{Boolean}	[remoteMoreRecent=false]
	 */
	function _generateAutoChangeLogMessage(itemType, localName, remoteName, remoteMoreRecent) {
		if (localName === null) {
			// TODO: localize
			localName = "[deleted]";
			var localDelete = true;
		}
		else if (remoteName === null) {
			remoteName = "[deleted]";
			var remoteDelete = true;
		}
		
		// TODO: localize
		var msg = "A Zotero " + itemType + " has changed both locally and "
			+ "remotely since the last sync:";
		msg += "\n\n";
		msg += "Local version: " + localName + "\n";
		msg += "Remote version: " + remoteName + "\n";
		msg += "\n";
		if (localDelete) {
			msg += "The remote version has been kept.";
		}
		else if (remoteDelete) {
			msg += "The local version has been kept.";
		}
		else {
			var moreRecent = remoteMoreRecent ? remoteName : localName;
			msg += "The most recent version, '" + moreRecent + "', has been kept.";
		}
		return msg;
	}
	
	
	function _generateCollectionItemMergeAlertMessage() {
		// TODO: localize
		var msg = "One or more Zotero items have been added to and/or removed "
			+ "from the same collection on multiple computers since the last sync.\n\n"
			+ "View the " + (Zotero.isStandalone ? "" : "Firefox ")
			+ "Error Console for the full list of such changes.";
		return msg;
	}
	
	
	/**
	 * @param	{String}		collectionName
	 * @param	{Integer[]}		addedItemIDs
	 */
	function _generateCollectionItemMergeLogMessage(collectionName, addedItemIDs) {
		// TODO: localize
		var introMsg = "Zotero items in the collection '" + collectionName + "' have been "
			+ "added and/or removed on multiple computers since the last sync. "
		
		introMsg += "The following items have been added to the collection:";
		var itemText = [];
		var max = addedItemIDs.length;
		for (var i=0; i<max; i++) {
			var id = addedItemIDs[i];
			var item = Zotero.Items.get(id);
			var title = item.getDisplayTitle();
			var text = " \u2022 " + title;
			var firstCreator = item.getField('firstCreator');
			if (firstCreator) {
				text += " (" + firstCreator + ")";
			}
			itemText.push(text);
			
			if (i == 19 && max > 20) {
				itemText.push(" \u2022 ...");
				break;
			}
		}
		return introMsg + "\n\n" + itemText.join("\n");
	}
	
	
	function _generateTagItemMergeAlertMessage() {
		// TODO: localize
		var msg = "One or more Zotero tags have been added to and/or removed from "
			+ "items on multiple computers since the last sync. "
			+ "The different sets of tags have been combined.\n\n"
			+ "View the " + (Zotero.isStandalone ? "" : "Firefox ")
			+ "Error Console for the full list of such changes.";
		return msg;
	}
	
	
	/**
	 * @param	{String}		tagName
	 * @param	{Integer[]}		addedItemIDs
	 * @param	{Boolean}		remoteIsTarget
	 */
	function _generateTagItemMergeLogMessage(tagName, addedItemIDs, remoteIsTarget) {
		// TODO: localize
		var introMsg = "The Zotero tag '" + tagName + "' has been added to and/or "
			+ "removed from items on multiple computers since the last sync. "
		
		if (remoteIsTarget) {
			introMsg += "It has been added to the following remote items:";
		}
		else {
			introMsg += "It has been added to the following local items:";
		}
		var itemText = [];
		for each(var id in addedItemIDs) {
			var item = Zotero.Items.get(id);
			var title = item.getField('title');
			var text = " - " + title;
			var firstCreator = item.getField('firstCreator');
			if (firstCreator) {
				text += " (" + firstCreator + ")";
			}
			itemText.push(text);
		}
		return introMsg + "\n\n" + itemText.join("\n");
	}
	
	
	/**
	 * Open a conflict resolution window and return the results
	 *
	 * @param	{String}		type			'item', 'collection', etc.
	 * @param	{Array[]}	objectPairs	Array of arrays of pairs of Item, Collection, etc.
	 */
	function _reconcile(type, objectPairs, changedCreators) {
		var io = {
			dataIn: {
				type: type,
				captions: [
					Zotero.getString('sync.localObject'),
					Zotero.getString('sync.remoteObject'),
					Zotero.getString('sync.mergedObject')
				],
				objects: objectPairs
			}
		};
		
		if (type == 'item') {
			if (!Zotero.Utilities.isEmpty(changedCreators)) {
				io.dataIn.changedCreators = changedCreators;
			}
		}
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
		if (io.error) {
			throw (io.error);
		}
		return io.dataOut;
	}
	
	
	/**
	 * Process the results of conflict resolution
	 */
	function _processMergeData(syncSession, type, data, toSave, toDelete, relatedItems) {
		var Types = Zotero.Sync.syncObjects[type].plural;
		var types = Zotero.Sync.syncObjects[type].plural.toLowerCase();
		
		for each(var obj in data) {
			// TODO: do we need to make sure item isn't already being saved?
			
			// Handle items deleted during merge
			if (obj.ref == 'deleted') {
				// Deleted item was remote
				if (obj.left != 'deleted') {
					toDelete.push(obj.id);
					
					var libraryKeyHash = Zotero[Types].getLibraryKeyHash(obj.ref);
					if (relatedItems[libraryKeyHash]) {
						delete relatedItems[libraryKeyHash];
					}
					
					syncSession.addToDeleted(obj.left);
				}
				continue;
			}
			
			toSave.push(obj.ref);
			
			// Item had been deleted locally, so remove from
			// deleted array
			if (obj.left == 'deleted') {
				syncSession.removeFromDeleted(obj.ref);
			}
			
			// TODO: only upload if the local item was chosen
			// or remote item was changed
			syncSession.addToUpdated(obj.ref);
		}
	}
	
	
	/**
	 * Converts a Zotero.Item object to a DOM <item> node
	 *
	 * @param  {Zotero.Item}  item
	 * @param  {DOMDocument}  doc
	 * @param  {Zotero.Sync.Server.Session}  [syncSession]
	 */
	this.itemToXML = function (item, doc, syncSession) {
		var item = item.serialize();
		
		var itemNode = doc.createElement('item');
		itemNode.setAttribute('libraryID', item.primary.libraryID ? item.primary.libraryID : Zotero.libraryID);
		itemNode.setAttribute('key', item.primary.key);
		
		// Primary fields
		for (var field in item.primary) {
			switch (field) {
				case 'itemID':
				case 'libraryID':
				case 'key':
					continue;
				
				default:
					var attr = field;
			}
			itemNode.setAttribute(attr, item.primary[field]);
		}
		
		// Item data
		for (var field in item.fields) {
			if (!item.fields[field]) {
				continue;
			}
			var fieldElem = doc.createElement('field');
			fieldElem.setAttribute('name', field);
			fieldElem.appendChild(doc.createTextNode(_xmlize(item.fields[field])));
			itemNode.appendChild(fieldElem);
		}
		
		// Deleted item flag
		if (item.deleted) {
			itemNode.setAttribute('deleted', '1');
		}
		
		if (item.primary.itemType == 'note' || item.primary.itemType == 'attachment') {
			if (item.sourceItemKey) {
				itemNode.setAttribute('sourceItem', item.sourceItemKey);
			}
		}
		
		// Note
		if (item.primary.itemType == 'note') {
			var noteElem = doc.createElement('note');
			noteElem.appendChild(doc.createTextNode(_xmlize(item.note)));
			itemNode.appendChild(noteElem);
		}
		
		// Attachment
		if (item.primary.itemType == 'attachment') {
			itemNode.setAttribute('linkMode', item.attachment.linkMode);
			itemNode.setAttribute('mimeType', item.attachment.mimeType);
			var charset = item.attachment.charset;
			if (charset) {
				itemNode.setAttribute('charset', charset);
			}
			
			if (item.attachment.linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				// Include paths for non-links
				var path = item.attachment.path;
				if (path != _xmlize(path)) {
					var filename = item.attachment.path.substr(8);
					// TODO: localize
					var msg = "The filename '" + filename + "' contains invalid characters.\n\nRename the file and try again. "
						+ "If you rename the file via the OS, you will need to relink it in Zotero.";
					var e = new Zotero.Error(msg, 0, { dialogButtonText: null });
					throw (e);

				}
				var pathElem = doc.createElement('path');
				pathElem.appendChild(doc.createTextNode(path));
				itemNode.appendChild(pathElem);
				
				// Include storage sync time and hash for imported files
				if (item.attachment.linkMode != Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					var mtime = Zotero.Sync.Storage.getSyncedModificationTime(item.primary.itemID);
					if (mtime) {
						itemNode.setAttribute('storageModTime', mtime);
					}
					
					var hash = Zotero.Sync.Storage.getSyncedHash(item.primary.itemID);
					if (hash) {
						itemNode.setAttribute('storageHash', hash);
					}
				}
			}
			
			if (item.note) {
				var noteElem = doc.createElement('note');
				noteElem.appendChild(doc.createTextNode(_xmlize(item.note)));
				itemNode.appendChild(noteElem);
			}
		}
		
		// Creators
		var defaultLibraryID = Zotero.libraryID;
		for (var index in item.creators) {
			var creatorElem = doc.createElement('creator');
			var libraryID = item.creators[index].libraryID ? item.creators[index].libraryID : defaultLibraryID;
			var key = item.creators[index].key;
			if (!key) {
				Zotero.debug('==========');
				Zotero.debug(index);
				Zotero.debug(item);
				throw ("Creator key not set for item in Zotero.Sync.Server.sync()");
			}
			creatorElem.setAttribute('libraryID', libraryID);
			creatorElem.setAttribute('key', key);
			creatorElem.setAttribute('creatorType', item.creators[index].creatorType);
			creatorElem.setAttribute('index', index);
			
			// Add creator XML as glue if not already included in sync session
			var fakeObj = {
				objectType: 'creator',
				libraryID: libraryID,
				key: key
			};
			if (syncSession && syncSession.objectInUpdated(fakeObj)) {
				var creator = Zotero.Creators.getByLibraryAndKey(libraryID, key);
				var subCreatorElem = Zotero.Sync.Server.Data.creatorToXML(creator, doc);
				creatorElem.appendChild(subCreatorElem);
			}
			
			itemNode.appendChild(creatorElem);
		}
		
		// Related items
		var related = item.related;
		if (related.length) {
			related = Zotero.Items.get(related);
			var keys = [];
			for each(var item in related) {
				keys.push(item.key);
			}
			if (keys.length) {
				var relatedElem = doc.createElement('related');
				relatedElem.appendChild(doc.createTextNode(keys.join(' ')));
				itemNode.appendChild(relatedElem);
			}
		}
		
		return itemNode;
	}
	
	
	/**
	 * Convert DOM <item> node into an unsaved Zotero.Item
	 *
	 * @param	object	itemNode		DOM XML node with item data
	 * @param	object	item			(Optional) Existing Zotero.Item to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	this.xmlToItem = function (itemNode, item, skipPrimary, defaultLibraryID) {
		if (!item) {
			item = new Zotero.Item;
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing item in "
					+ "Zotero.Sync.Server.Data.xmlToItem()");
		}
		
		// TODO: add custom item types
		
		var data = {};
		if (!skipPrimary) {
			data.libraryID = _getLibraryID(itemNode.getAttribute('libraryID'), defaultLibraryID);
			data.key = itemNode.getAttribute('key');
			data.dateAdded = itemNode.getAttribute('dateAdded');
			data.dateModified = itemNode.getAttribute('dateModified');
		}
		data.itemTypeID = Zotero.ItemTypes.getID(itemNode.getAttribute('itemType'));
		// TEMP - NSF
		if (!data.itemTypeID) {
			var msg = "Invalid item type '" + itemNode.getAttribute('itemType') + "' in Zotero.Sync.Server.Data.xmlToItem()";
			var e = new Zotero.Error(msg, "INVALID_ITEM_TYPE");
			throw (e);
		}
		
		var changedFields = {};
		
		// Primary data
		for (var field in data) {
			item.setField(field, data[field]);
			changedFields[field] = true;
		}
		
		// Item data
		var fields = itemNode.getElementsByTagName('field');
		for (var i=0, len=fields.length; i<len; i++) {
			var field = fields[i];
			var fieldName = field.getAttribute('name');
			item.setField(fieldName, field.textContent);
			changedFields[fieldName] = true;
		}
		var previousFields = item.getUsedFields(true);
		for each(var field in previousFields) {
			if (!changedFields[field] &&
					// If not valid, it'll already have been cleared by the
					// type change
					Zotero.ItemFields.isValidForType(
						Zotero.ItemFields.getID(field), data.itemTypeID
					)) {
				item.setField(field, false);
			}
		}
		
		// Deleted item flag
		var deleted = itemNode.getAttribute('deleted');
		item.deleted = (deleted == 'true' || deleted == "1");
		
		// Item creators
		var i = 0;
		var creators = Zotero.Utilities.xpath(itemNode, "creator");
		for each(var creator in creators) {
			var pos = parseInt(creator.getAttribute('index'));
			if (pos != i) {
				throw ('No creator in position ' + i);
			}
			
			var libraryID = data.libraryID;
			var key = creator.getAttribute('key');
			var creatorObj = Zotero.Creators.getByLibraryAndKey(libraryID, key);
			if (!creatorObj) {
				var msg = "Data for missing local creator " + libraryID + "/" + key
					+ " not provided in Zotero.Sync.Server.Data.xmlToItem()";
				var e = new Zotero.Error(msg, "MISSING_OBJECT");
				throw (e);
			}
			
			item.setCreator(
				pos,
				creatorObj,
				creator.getAttribute('creatorType')
			);
			i++;
		}
		
		// Remove item's remaining creators not in XML
		var numCreators = item.numCreators();
		var rem = numCreators - i;
		for (var j=0; j<rem; j++) {
			// Keep removing last creator
			item.removeCreator(i);
		}
		
		// Both notes and attachments might have parents and notes
		if (item.isNote() || item.isAttachment()) {
			var sourceItemKey = itemNode.getAttribute('sourceItem');
			item.setSourceKey(sourceItemKey ? sourceItemKey : false);
			item.setNote(_getFirstChildContent(itemNode, 'note'));
		}
		
		// Attachment metadata
		if (item.isAttachment()) {
			item.attachmentLinkMode = parseInt(itemNode.getAttribute('linkMode'));
			item.attachmentMIMEType = itemNode.getAttribute('mimeType');
			item.attachmentCharset = itemNode.getAttribute('charset');
			if (item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) { 
				item.attachmentPath = _getFirstChildContent(itemNode, 'path');
			}
		}
		
		// Related items
		var related = _getFirstChildContent(itemNode, 'related');
		var relatedIDs = [];
		if (related) {
			related = related.split(' ');
			for each(var key in related) {
				var relItem = Zotero.Items.getByLibraryAndKey(item.libraryID, key);
				if (!relItem) {
					var msg = "Related item " + item.libraryID + "/" + key
						+ " doesn't exist in Zotero.Sync.Server.Data.xmlToItem()";
					var e = new Zotero.Error(msg, "MISSING_OBJECT");
					throw (e);
				}
				relatedIDs.push(relItem.id);
			}
		}
		item.relatedItems = relatedIDs;
		
		return item;
	}
	
	
	this.removeMissingRelatedItems = function (itemNode) {
		var relatedNode = Zotero.Utilities.xpath(itemNode, "related");
		if (!relatedNode.length) {
			return [];
		}
		relatedNode = relatedNode[0];
		var libraryID = parseInt(itemNode.getAttribute('libraryID'));
		var exist = [];
		var missing = [];
		var relKeys = relatedNode.textContent;
		relKeys = relKeys ? relKeys.split(' ') : [];
		for each(var relKey in relKeys) {
			if (Zotero.Items.getByLibraryAndKey(libraryID, relKey)) {
				exist.push(relKey);
			}
			else {
				missing.push(relKey);
			}
		}
		relatedNode.textContent = exist.join(' ');
		return missing;
	}
	
	
	this.collectionToXML = function (collection, doc) {
		var colElem = doc.createElement('collection');
		colElem.setAttribute('libraryID', collection.libraryID ? collection.libraryID : Zotero.libraryID);
		colElem.setAttribute('key', collection.key);
		colElem.setAttribute('name', _xmlize(collection.name));
		colElem.setAttribute('dateAdded', collection.dateAdded);
		colElem.setAttribute('dateModified', collection.dateModified);
		if (collection.parent) {
			var parentCol = Zotero.Collections.get(collection.parent);
			colElem.setAttribute('parent', parentCol.key);
		}
		
		var children = collection.getChildren();
		if (children) {
			var itemKeys = [];
			
			for each(var child in children) {
				if (child.type == 'item') {
					itemKeys.push(child.key);
				}
			}
			
			if (itemKeys.length) {
				var itemsElem = doc.createElement('items');
				itemsElem.appendChild(doc.createTextNode(itemKeys.join(' ')));
				colElem.appendChild(itemsElem);
			}
		}
		
		return colElem;
	}
	
	
	/**
	 * Convert DOM <collection> node into an unsaved Zotero.Collection
	 *
	 * @param	object	collectionNode	DOM XML node with collection data
	 * @param	object	item		(Optional) Existing Zotero.Collection to update
	 * @param	bool		skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 * @param	integer	defaultLibraryID	(Optional)
	 * @param	array	deletedItems		(Optional) An array of keys that have been deleted in this sync session
	 */
	this.xmlToCollection = function (collectionNode, collection, skipPrimary, defaultLibraryID, deletedItemKeys) {
		if (!collection) {
			collection = new Zotero.Collection;
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing collection in "
					+ "Zotero.Sync.Server.Data.xmlToCollection()");
		}
		
		if (!skipPrimary) {
			collection.libraryID = _getLibraryID(collectionNode.getAttribute('libraryID'), defaultLibraryID);
			collection.key = collectionNode.getAttribute('key');
			var parentKey = collectionNode.getAttribute('parent');
			if (parentKey) {
				collection.parentKey = parentKey;
			}
			else {
				collection.parent = false;
			}
			collection.dateAdded = collectionNode.getAttribute('dateAdded');
			collection.dateModified = collectionNode.getAttribute('dateModified');
		}
		
		collection.name = collectionNode.getAttribute('name');
		
		/*
		// Subcollections
		var str = xmlCollection.collections.toString();
		collection.childCollections = str == '' ? [] : str.split(' ');
		*/
		
		// Child items
		var childItems = _getFirstChildContent(collectionNode, 'items');
		childItems = childItems ? childItems.split(' ') : []
		var childItemIDs = [];
		for each(var key in childItems) {
			var childItem = Zotero.Items.getByLibraryAndKey(collection.libraryID, key);
			if (!childItem) {
				// Ignore items that were deleted in this sync session
				//
				// This can happen if a collection and its items are deleted
				// locally but are in conflict with the server, and the local
				// item deletes are selected in CR. Then, when the deleted
				// collection is automatically restored, the items no
				// longer exist.
				if (deletedItemKeys && deletedItemKeys.indexOf(key) != -1) {
					Zotero.debug("Ignoring deleted collection item '" + key + "'");
					continue;
				}
				
				var msg = "Missing child item " + key + " for collection "
							+ collection.libraryID + "/" + collection.key
							+ " in Zotero.Sync.Server.Data.xmlToCollection()";
				var e = new Zotero.Error(msg, "MISSING_OBJECT");
				throw (e);
			}
			childItemIDs.push(childItem.id);
		}
		collection.childItems = childItemIDs;
		
		return collection;
	}
	
	
	/**
	 * Recursively save collections from the top down
	 */
	function _saveCollections(collections) {
		var originalLength = collections.length;
		var unsaved = [];
		
		var parentKey, parentCollection;
		
		for each(var collection in collections) {
			parentKey = collection.parentKey;
			// Top-level collection, so save
			if (!parentKey) {
				collection.save();
				continue;
			}
			parentCollection = Zotero.Collections.getByLibraryAndKey(
				collection.libraryID, parentKey
			);
			// Parent collection exists, so save
			if (parentCollection) {
				collection.save();
				continue;
			}
			
			// Add to unsaved list
			unsaved.push(collection);
			continue;
		}
		
		if (unsaved.length) {
			if (unsaved.length == originalLength) {
				var msg = "Incomplete collection hierarchy cannot be saved in Zotero.Sync.Server.Data._saveCollections()";
				var e = new Zotero.Error(msg, "MISSING_OBJECT");
				throw (e);
			}
			
			_saveCollections(unsaved);
		}
	}
	
	
	
	/**
	 * Converts a Zotero.Creator object to a DOM <creator> node
	 */
	this.creatorToXML = function (creator, doc) {
		var creatorElem = doc.createElement('creator');
		creatorElem.setAttribute('libraryID', creator.libraryID ? creator.libraryID : Zotero.libraryID);
		creatorElem.setAttribute('key', creator.key);
		creatorElem.setAttribute('dateAdded', creator.dateAdded);
		creatorElem.setAttribute('dateModified', creator.dateModified);
		
		var allowEmpty = ['firstName', 'lastName', 'name'];
		
		var creator = creator.serialize();
		for (var field in creator.fields) {
			if (!creator.fields[field] && allowEmpty.indexOf(field) == -1) {
				continue;
			}
			
			var fieldElem = doc.createElement(field);
			switch (field) {
				case 'firstName':
				case 'lastName':
				case 'name':
					var val = _xmlize(creator.fields[field]);
					break;
				
				default:
					var val = creator.fields[field];
			}
			fieldElem.appendChild(doc.createTextNode(val));
			creatorElem.appendChild(fieldElem);
		}
		
		return creatorElem;
	}
	
	
	/**
	 * Convert DOM <creator> node into an unsaved Zotero.Creator
	 *
	 * @param	object	creatorNode	DOM XML node with creator data
	 * @param	object	item		(Optional) Existing Zotero.Creator to update
	 * @param	bool	skipPrimary	(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	this.xmlToCreator = function (creatorNode, creator, skipPrimary, defaultLibraryID) {
		if (!creator) {
			creator = new Zotero.Creator;
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing creator in "
					+ "Zotero.Sync.Server.Data.xmlToCreator()");
		}
		
		if (!skipPrimary) {
			creator.libraryID = _getLibraryID(creatorNode.getAttribute('libraryID'), defaultLibraryID);
			creator.key = creatorNode.getAttribute('key');
			creator.dateAdded = creatorNode.getAttribute('dateAdded');
			creator.dateModified = creatorNode.getAttribute('dateModified');
		}
		
		if (_getFirstChildContent(creatorNode, 'fieldMode') == 1) {
			creator.firstName = '';
			creator.lastName = _getFirstChildContent(creatorNode, 'name');
			creator.fieldMode = 1;
		}
		else {
			creator.firstName = _getFirstChildContent(creatorNode, 'firstName');
			creator.lastName = _getFirstChildContent(creatorNode, 'lastName');
			creator.fieldMode = 0;
		}
		creator.birthYear = _getFirstChildContent(creatorNode, 'birthYear');
		
		return creator;
	}
	
	
	this.searchToXML = function (search, doc) {
		var searchElem = doc.createElement('search');
		searchElem.setAttribute('libraryID', search.libraryID ? search.libraryID : Zotero.libraryID);
		searchElem.setAttribute('key', search.key);
		searchElem.setAttribute('name', _xmlize(search.name));
		searchElem.setAttribute('dateAdded', search.dateAdded);
		searchElem.setAttribute('dateModified', search.dateModified);
		
		var conditions = search.getSearchConditions();
		if (conditions) {
			for each(var condition in conditions) {
				var conditionElem = doc.createElement('condition');
				conditionElem.setAttribute('id', condition.id);
				conditionElem.setAttribute('condition', condition.condition);
				if (condition.mode) {
					conditionElem.setAttribute('mode', condition.mode);
				}
				conditionElem.setAttribute('operator', condition.operator);
				conditionElem.setAttribute('value', _xmlize(condition.value ? condition.value : ''));
				if (condition.required) {
					conditionElem.setAttribute('required', 1);
				}
				searchElem.appendChild(conditionElem);
			}
		}
		
		return searchElem;
	}
	
	
	/**
	 * Convert DOM <search> node into an unsaved Zotero.Search
	 *
	 * @param	object	searchNode	DOM XML node with search data
	 * @param	object	item		(Optional) Existing Zotero.Search to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	this.xmlToSearch = function (searchNode, search, skipPrimary, defaultLibraryID) {
		if (!search) {
			search = new Zotero.Search;
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing search in "
					+ "Zotero.Sync.Server.Data.xmlToSearch()");
		}
		
		if (!skipPrimary) {
			search.libraryID = _getLibraryID(searchNode.getAttribute('libraryID'), defaultLibraryID);
			search.key = searchNode.getAttribute('key');
			search.dateAdded = searchNode.getAttribute('dateAdded');
			search.dateModified = searchNode.getAttribute('dateModified');
		}
		
		search.name = searchNode.getAttribute('name');
		
		var conditionID = -1;
		
		// Search conditions
		var conditions = searchNode.getElementsByTagName('condition');
		for (var i=0, len=conditions.length; i<len; i++) {
			var condition = conditions[i];
			conditionID = parseInt(condition.getAttribute('id'));
			var name = condition.getAttribute('condition');
			var mode = condition.getAttribute('mode');
			if (mode) {
				name = name + '/' + mode;
			}
			if (search.getSearchCondition(conditionID)) {
				search.updateCondition(
					conditionID,
					name,
					condition.getAttribute('operator'),
					condition.getAttribute('value'),
					!!condition.getAttribute('required')
				);
			}
			else {
				var newID = search.addCondition(
					name,
					condition.getAttribute('operator'),
					condition.getAttribute('value'),
					!!condition.getAttribute('required')
				);
				if (newID != conditionID) {
					throw ("Search condition ids not contiguous in Zotero.Sync.Server.xmlToSearch()");
				}
			}
		}
		
		conditionID++;
		while (search.getSearchCondition(conditionID)) {
			search.removeCondition(conditionID);
			conditionID++;
		}
		
		return search;
	}
	
	
	this.tagToXML = function (tag, doc) {
		var tagElem = doc.createElement('tag');
		tagElem.setAttribute('libraryID', tag.libraryID ? tag.libraryID : Zotero.libraryID);
		tagElem.setAttribute('key', tag.key);
		tagElem.setAttribute('name', _xmlize(tag.name));
		if (tag.type) {
			tagElem.setAttribute('type', tag.type);
		}
		tagElem.setAttribute('dateAdded', tag.dateAdded);
		tagElem.setAttribute('dateModified', tag.dateModified);
		var linkedItems = tag.getLinkedItems();
		if (linkedItems) {
			var linkedItemKeys = [];
			for each(var linkedItem in linkedItems) {
				linkedItemKeys.push(linkedItem.key);
			}
			var itemsElem = doc.createElement('items');
			itemsElem.appendChild(doc.createTextNode(linkedItemKeys.join(' ')));
			tagElem.appendChild(itemsElem);
		}
		return tagElem;
	}
	
	
	/**
	 * Convert DOM <tag> node into an unsaved Zotero.Tag
	 *
	 * @param	object	tagNode			DOM XML node with tag data
	 * @param	object	tag				(Optional) Existing Zotero.Tag to update
	 * @param	bool		skipPrimary		(Optional) Ignore passed primary fields
	 */
	this.xmlToTag = function (tagNode, tag, skipPrimary, defaultLibraryID, deletedItemKeys) {
		if (!tag) {
			tag = new Zotero.Tag;
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing tag in "
					+ "Zotero.Sync.Server.Data.xmlToTag()");
		}
		
		if (!skipPrimary) {
			tag.libraryID = _getLibraryID(tagNode.getAttribute('libraryID'), defaultLibraryID);
			tag.key = tagNode.getAttribute('key');
			tag.dateAdded = tagNode.getAttribute('dateAdded');
			tag.dateModified = tagNode.getAttribute('dateModified');
		}
		
		tag.name = tagNode.getAttribute('name');
		var type = tagNode.getAttribute('type');
		tag.type = type ? parseInt(type) : 0;
		
		var keys = _getFirstChildContent(tagNode, 'items');
		if (keys) {
			keys = keys.split(' ');
			var ids = [];
			for each(var key in keys) {
				var item = Zotero.Items.getByLibraryAndKey(tag.libraryID, key);
				if (!item) {
					// See note in xmlToCollection()
					if (deletedItemKeys && deletedItemKeys.indexOf(key) != -1) {
						Zotero.debug("Ignoring deleted linked item '" + key + "'");
						continue;
					}
					
					var msg = "Linked item " + key + " doesn't exist in Zotero.Sync.Server.Data.xmlToTag()";
					var e = new Zotero.Error(msg, "MISSING_OBJECT");
					throw (e);
				}
				ids.push(item.id);
			}
		}
		else {
			var ids = [];
		}
		tag.linkedItems = ids;
		
		return tag;
	}
	
	
	/**
	 * @param	{String}		name		Tag name
	 * @param	{Integer}	type		Tag type
	 * @return	{Integer[]|FALSE}	Array of itemIDs of items linked to
	 *									deleted tag, or FALSE if no
	 *									matching tag found
	 */
	function _deleteConflictingTag(syncSession, name, type, libraryID) {
		var tagID = Zotero.Tags.getID(name, type, libraryID);
		if (tagID) {
			Zotero.debug("Deleting conflicting local '" + name + "' tag " + tagID);
			var tag = Zotero.Tags.get(tagID);
			// Tag has already been deleted, which can happen if the server has
			// two new tags that differ only in case, and one matches a local tag
			// with a different key, causing that tag to be deleted already.
			if (!tag) {
				Zotero.debug("Local tag " + tagID + " doesn't exist");
				return false;
			}
			var linkedItems = tag.getLinkedItems(true);
			Zotero.Tags.erase(tagID);
			Zotero.Tags.purge(tagID);
			
			syncSession.removeFromUpdated(tag);
			//syncSession.addToDeleted(tag);
			
			return linkedItems ? linkedItems : [];
		}
		
		return false;
	}
	
	
	/**
	 * Convert DOM <group> node into an unsaved Zotero.Group
	 *
	 * @param	object	groupNode		DOM XML node with group data
	 * @param	object	group			(Optional) Existing Zotero.Group to update
	 */
	this.xmlToGroup = function (groupNode, group) {
		if (!group) {
			group = new Zotero.Group;
		}
		
		group.id = parseInt(groupNode.getAttribute('id'));
		group.libraryID = parseInt(groupNode.getAttribute('libraryID'));
		group.name = groupNode.getAttribute('name');
		group.editable = !!parseInt(groupNode.getAttribute('editable'));
		group.filesEditable = !!parseInt(groupNode.getAttribute('filesEditable'));
		group.description = _getFirstChildContent(groupNode, 'description');
		
		/*
		var keys = xmlGroup.items.toString() ? xmlGroup.items.toString().split(' ') : false;
		if (keys) {
			var ids = [];
			for each(var key in keys) {
				var item = Zotero.Items.getByLibraryAndKey(group.libraryID, key);
				if (!item) {
					throw ("Linked item " + key + " doesn't exist in Zotero.Sync.Server.Data.xmlToGroup()");
				}
				ids.push(item.id);
			}
		}
		else {
			var ids = [];
		}
		group.linkedItems = ids;
		*/
		
		return group;
	}
	
	
	this.relationToXML = function (relation, doc) {
		return relation.toXML(doc);
	}
	
	this.xmlToRelation = function (relationNode) {
		return Zotero.Relations.xmlToRelation(relationNode);
	}
	
	
	function _getFirstChildContent(node, childName) {
		var elems = Zotero.Utilities.xpath(node, childName);
		return elems.length ? elems[0].textContent : "";
	}
	
	
	function _xmlize(str) {
		return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '\u2B1A');
	}
	
	
	function _getLibraryID(libraryID, defaultLibraryID) {
		if (!libraryID) {
			return null;
		}
		return libraryID == defaultLibraryID ? null : parseInt(libraryID);
	}
}
