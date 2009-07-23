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
	
	default xml namespace = '';
	
	var _typesLoaded = false;
	var _objectTypeIDs = {};
	var _objectTypeNames = {};
	
	var _deleteLogDays = 30;
	
	
	this.init = function () {
		var sql = "SELECT version FROM version WHERE schema='syncdeletelog'";
		if (!Zotero.DB.valueQuery(sql)) {
			sql = "SELECT COUNT(*) FROM syncDeleteLog";
			if (Zotero.DB.valueQuery(sql)) {
				throw ('syncDeleteLog not empty and no timestamp in Zotero.Sync.delete()');
			}
			sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
			Zotero.DB.query(sql, Zotero.Date.getUnixTimestamp());
		}
		
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
	
	return this[types] && this[types][libraryID] && this[types][libraryID][key];
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
	default xml namespace = '';
	
	this.init = init;
	this.ignoreDeletions = ignoreDeletions;
	this.unignoreDeletions = unignoreDeletions;
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
	
	
	/**
	 * Remove objects blacklisted from the sync delete log
	 */
	function unignoreDeletions(type, ids) {
		if (!Zotero.Sync.syncObjects[type]) {
			throw ("Invalid type '" + type +
				"' in Zotero.Sync.EventListener.ignoreDeletions()");
		}
		
		ids = Zotero.flattenArguments(ids);
		for each(var id in ids) {
			if (_deleteBlacklist[type][id]) {
				delete _deleteBlacklist[type][id];
			}
		}
	}
	
	
	function notify(event, type, ids, extraData) {
		var objectTypeID = Zotero.Sync.getObjectTypeID(type);
		if (!objectTypeID) {
			return;
		}
		
		var isItem = Zotero.Sync.getObjectTypeName(objectTypeID) == 'item';
		
		var ZU = new Zotero.Utilities;
		
		Zotero.DB.beginTransaction();
		
		if (event == 'delete') {
			var sql = "INSERT INTO syncDeleteLog VALUES (?, ?, ?, ?)";
			var syncStatement = Zotero.DB.getStatement(sql);
			
			if (isItem && Zotero.Sync.Storage.active) {
				var storageEnabled = true;
				var sql = "INSERT INTO storageDeleteLog VALUES (?, ?, ?)";
				var storageStatement = Zotero.DB.getStatement(sql);
			}
			var storageBound = false;
			
			var ts = Zotero.Date.getUnixTimestamp();
			
			for (var i=0, len=ids.length; i<len; i++) {
				if (_deleteBlacklist[ids[i]]) {
					Zotero.debug("Not logging blacklisted '"
						+ type + "' id " + ids[i]
						+ " in Zotero.Sync.EventListener.notify()", 4);
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
					syncStatement.reset();
					if (storageEnabled) {
						storageStatement.reset();
					}
					Zotero.DB.rollbackTransaction();
					throw(Zotero.DB.getLastErrorString());
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
	this.__defineGetter__("lastSyncError", function () {
		return _lastSyncError;
	});
	
	this.__defineGetter__("background", function () {
		return _background;
	});
	
	var _lastSyncError;
	var _autoSyncTimer;
	var _queue;
	var _running;
	var _background;
	
	this.init = function () {
		this.EventListener.init();
		this.IdleListener.init();
	}
	
	this.sync = function (background) {
		if (Zotero.Utilities.HTTP.browserIsOffline()){
			_lastSyncError = "Browser is offline"; // TODO: localize
			this.clearSyncTimeout(); // DEBUG: necessary?
			this.setSyncIcon('error');
			return false;
		}
		
		if (_running) {
			throw ("Sync already running in Zotero.Sync.Runner.sync()");
		}
		
		// Purge deleted objects so they don't cause sync errors (e.g., long tags)
		Zotero.purgeDataObjects(true);
		
		_background = !!background;
		
		_queue = [
			Zotero.Sync.Server.sync,
			Zotero.Sync.Storage.sync,
			Zotero.Sync.Server.sync,
			Zotero.Sync.Storage.sync
		];
		_running = true;
		_lastSyncError = '';
		this.setSyncIcon('animate');
		this.next();
	}
	
	
	this.next = function () {
		if (!_queue.length) {
			this.setSyncIcon();
			_running = false;
			return;
		}
		var func = _queue.shift();
		func();
	}
	
	
	this.setError = function (msg) {
		this.setSyncIcon('error');
		_lastSyncError = msg;
	}
	
	
	this.reset = function () {
		_queue = [];
		_running = false;
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
			Zotero.debug("CANCELLING");
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
				
				if (Zotero.Sync.Storage.syncInProgress) {
					Zotero.debug('Storage sync already in progress -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Server.syncInProgress) {
					Zotero.debug('Sync already in progress -- skipping auto-sync', 4);
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
	
	
	this.setSyncIcon = function (status) {
		status = status ? status : '';
		
		switch (status) {
			case '':
			case 'animate':
			case 'error':
				break;
			
		default:
			throw ("Invalid sync icon status '" + status
					+ "' in Zotero.Sync.Runner.setSyncIcon()");
		}
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		var win = wm.getMostRecentWindow('navigator:browser');
		var icon = win.document.getElementById('zotero-tb-sync');
		icon.setAttribute('status', status);
		
		switch (status) {
			case 'animate':
				icon.setAttribute('disabled', true);
				break;
			
			default:
				icon.setAttribute('disabled', false);
		}
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
			Zotero.Sync.Runner.setSyncTimeout();
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
	this.lock = lock;
	this.unlock = unlock;
	this.clear = clear;
	this.resetServer = resetServer;
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
			Zotero.debug('Username not set before setting Zotero.Sync.Server.password');
			return '';
		}
		
		if (_cachedCredentials[username]) {
			return _cachedCredentials[username];
		}
		
		Zotero.debug('Getting Zotero sync password');
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		try {
			var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		}
		catch (e) {
			Zotero.debug(e);
			// TODO: localize
			var msg = "Zotero cannot access your login information, "
						+ "likely due to a corrupted Firefox login manager database."
						+ "\n\n"
						+ "Close Firefox, back up and delete signons.* from your Firefox profile, "
						+ "and re-enter your Zotero login information in the Sync pane of the Zotero preferences.";
			alert(msg);
			return '';
		}
		
		// Find user from returned array of nsILoginInfo objects
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == username) {
				_cachedCredentials[username] = logins[i].password;
				return logins[i].password;
			}
		}
		
		return '';
	});
	
	this.__defineSetter__('password', function (password) {
		_sessionID = null;
		
		var username = this.username;
		
		if (!username) {
			Zotero.debug('Username not set before setting Zotero.Sync.Server.password');
			return;
		}
		
		delete _cachedCredentials[username];
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		
		var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		
		for (var i = 0; i < logins.length; i++) {
			Zotero.debug('Clearing Zotero sync passwords');
			loginManager.removeLogin(logins[i]);
			break;
		}
		
		if (password) {
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
			
			Zotero.debug('Setting Zotero sync password');
			var loginInfo = new nsLoginInfo(_loginManagerHost, _loginManagerURL,
				null, username, password, "", "");
			loginManager.addLogin(loginInfo);
			_cachedCredentials[username] = password;
		}
	});
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	this.__defineGetter__("sessionIDComponent", function () {
		return 'sessionid=' + _sessionID;
	});
	this.__defineGetter__("lastRemoteSyncTime", function () {
		return Zotero.DB.valueQuery("SELECT version FROM version WHERE schema='lastremotesync'");
	});
	this.__defineSetter__("lastRemoteSyncTime", function (val) {
		Zotero.DB.query("REPLACE INTO version VALUES ('lastremotesync', ?)", { int: val });
	});
	this.__defineGetter__("lastLocalSyncTime", function () {
		return Zotero.DB.valueQuery("SELECT version FROM version WHERE schema='lastlocalsync'");
	});
	this.__defineSetter__("lastLocalSyncTime", function (val) {
		Zotero.DB.query("REPLACE INTO version VALUES ('lastlocalsync', ?)", { int: val });
	});
	
	this.nextLocalSyncDate = false;
	this.apiVersion = 5;
	
	default xml namespace = '';
	
	var _loginManagerHost = 'chrome://zotero';
	var _loginManagerURL = 'Zotero Sync Server';
	
	var _serverURL = ZOTERO_CONFIG.SYNC_URL;
	
	var _apiVersionComponent = "version=" + this.apiVersion;
	var _cachedCredentials = {};
	var _syncInProgress;
	var _sessionID;
	var _sessionLock;
	var _throttleTimeout;
	var _canAutoResetClient = true;
	
	function login(callback, callbackCallback) {
		var url = _serverURL + "login";
		
		var username = Zotero.Sync.Server.username;
		
		if (!username) {
			_error("Username not set in Zotero.Sync.Server.login()");
		}
		
		username = encodeURIComponent(Zotero.Sync.Server.username);
		var password = encodeURIComponent(Zotero.Sync.Server.password);
		var body = _apiVersionComponent
					+ "&username=" + username
					+ "&password=" + password;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				if (response.firstChild.getAttribute('code') == 'INVALID_LOGIN') {
					_error('Invalid login/pass');
				}
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (_sessionID) {
				_error("Session ID already set in Zotero.Sync.Server.login()")
			}
			
			// <response><sessionID>[abcdefg0-9]{32}</sessionID></response>
			_sessionID = response.firstChild.firstChild.nodeValue;
			
			var re = /^[abcdefg0-9]{32}$/;
			if (!re.test(_sessionID)) {
				_sessionID = null;
				_error('Invalid session ID received from server');
			}
			
			
			//Zotero.debug('Got session ID ' + _sessionID + ' from server');
			
			if (callback) {
				callback(callbackCallback);
			}
		});
	}
	
	
	function sync(callback) {
		Zotero.Sync.Runner.setSyncIcon('animate');
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login(Zotero.Sync.Server.sync, callback);
			return;
		}
		
		/*
		if (!_sessionLock) {
			Zotero.Sync.Server.lock(Zotero.Sync.Server.sync, callback);
			return;
		}
		*/
		
		if (_syncInProgress) {
			_error("Sync operation already in progress");
		}
		
		Zotero.debug("Beginning server sync");
		_syncInProgress = true;
		
		// Get updated data
		var url = _serverURL + 'updated';
		var lastsync = Zotero.Sync.Server.lastRemoteSyncTime;
		// TODO: use full sync instead? or make this full sync?
		if (!lastsync) {
			lastsync = 1;
		}
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent
					+ '&lastsync=' + lastsync
					+ '&lock=1';
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			Zotero.debug(xmlhttp.responseText);
			
			_checkResponse(xmlhttp);
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				_syncInProgress = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.sync, callback);
				return;
			}
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				var resetCallback = function () {
					Zotero.Sync.Server.sync(callback);
				};
				if (_checkServerSessionLock(response.firstChild, resetCallback)) {
					return;
				}
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			_sessionLock = true;
			
			// Strip XML declaration and convert to E4X
			var xml = new XML(xmlhttp.responseText.replace(/<\?xml.*\?>/, ''));
			
			Zotero.DB.beginTransaction();
			
			try {
				var userID = parseInt(xml.@userID);
				var libraryID = parseInt(xml.@defaultLibraryID);
				if (!_checkSyncUser(userID, libraryID)) {
					Zotero.debug("Sync cancelled");
					Zotero.DB.rollbackTransaction();
					Zotero.Sync.Server.unlock(function () {
						if (callback) {
							Zotero.Sync.Runner.setSyncIcon();
							callback();
						}
						else {
							Zotero.Sync.Runner.reset();
							Zotero.Sync.Runner.next();
						}
					});
					_syncInProgress = false;
					return;
				}
				
				Zotero.UnresponsiveScriptIndicator.disable();
				
				var earliestRemoteDate = parseInt(xml.@earliest) ?
					new Date((xml.@earliest + 43200) * 1000) : false;
				
				var lastLocalSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
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
				
				// Reconcile and save updated data from server and
				// prepare local data to upload
				var xmlstr = Zotero.Sync.Server.Data.processUpdatedXML(
					xml.updated, lastLocalSyncDate, syncSession
				);
				
				//Zotero.debug(xmlstr);
				//throw('break');
				
				if (xmlstr === false) {
					Zotero.debug("Sync cancelled");
					Zotero.DB.rollbackTransaction();
					Zotero.Sync.Server.unlock(function () {
						if (callback) {
							Zotero.Sync.Runner.setSyncIcon();
							callback();
						}
						else { 
							Zotero.Sync.Runner.reset();
							Zotero.Sync.Runner.next();
						}
					});
					Zotero.reloadDataObjects();
					_syncInProgress = false;
					return;
				}
				
				if (xmlstr) {
					Zotero.debug(xmlstr);
				}
				
				Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
				
				if (!xmlstr) {
					Zotero.debug("Nothing to upload to server");
					Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
					Zotero.Sync.Server.nextLocalSyncDate = false;
					Zotero.DB.commitTransaction();
					Zotero.Sync.Server.unlock(function () {
						_syncInProgress = false;
						if (callback) {
							Zotero.Sync.Runner.setSyncIcon();
							callback();
						}
						else {
							Zotero.Sync.Runner.next();
						}
					});
					return;
				}
				
				Zotero.DB.commitTransaction();
				
				var url = _serverURL + 'upload';
				var body = _apiVersionComponent
							+ '&' + Zotero.Sync.Server.sessionIDComponent
							+ '&data=' + encodeURIComponent(xmlstr);
				
				//var file = Zotero.getZoteroDirectory();
				//file.append('lastupload.txt');
				//Zotero.File.putContents(file, body);
				
				var uploadCallback = function (xmlhttp) {
					_checkResponse(xmlhttp);
					
					//var ZU = new Zotero.Utilities;
					//Zotero.debug(ZU.unescapeHTML(xmlhttp.responseText));
					Zotero.debug(xmlhttp.responseText);
					
					var response = xmlhttp.responseXML.childNodes[0];
					
					if (response.firstChild.tagName == 'error') {
						// handle error
						_error(response.firstChild.firstChild.nodeValue);
					}
					
					Zotero.DB.beginTransaction();
					Zotero.Sync.purgeDeletedObjects(nextLocalSyncTime);
					Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
					Zotero.Sync.Server.nextLocalSyncDate = false;
					Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
					
					//throw('break2');
					
					Zotero.DB.commitTransaction();
					Zotero.Sync.Server.unlock(function () {
						_syncInProgress = false;
						if (callback) {
							Zotero.Sync.Runner.setSyncIcon();
							callback();
						}
						else {
							Zotero.Sync.Runner.next();
						}
					});
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
						
						if (Zotero.Utilities.HTTP.browserIsOffline()) {
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
					Zotero.Utilities.HTTP.doPost(url, body, uploadCallback);
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
	
	
	function lock(callback, callbackCallback) {
		Zotero.debug("Getting session lock");
		
		if (!_sessionID) {
			_error('No session available in Zotero.Sync.Server.lock()', 2);
		}
		
		if (_sessionLock) {
			_error('Session already locked in Zotero.Sync.Server.lock()', 2);
		}
		
		var url = _serverURL + "lock";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(callback);
				return;
			}
			
			_checkResponse(xmlhttp);
			
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				if (_checkServerSessionLock(response.firstChild)) {
					Zotero.Sync.Server.lock(function () {
						if (callback) {
							callback(callbackCallback);
						}
					});
					return;
				}
				
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'locked') {
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			_sessionLock = true;
			
			if (callback) {
				callback(callbackCallback);
			}
		});
	}
	
	
	function unlock(callback) {
		Zotero.debug("Releasing session lock");
		
		if (!_sessionID) {
			_error('No session available in Zotero.Sync.Server.unlock()');
		}
		
		var syncInProgress = _syncInProgress;
		
		var url = _serverURL + "unlock";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp);
			
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_sessionLock = null;
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'unlocked') {
				_sessionLock = null;
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			_sessionLock = null;
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function clear(callback) {
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login(Zotero.Sync.Server.clear, callback);
			return;
		}
		
		var url = _serverURL + "clear";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.clear, callback);
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
	
	
	/**
	 * Clear session lock on server
	 */
	function resetServer(callback) {
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login(Zotero.Sync.Server.resetServer, callback);
			return;
		}
		
		var url = _serverURL + "reset";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.reset, callback);
				return;
			}
			
			_checkResponse(xmlhttp);
			
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'reset') {
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			_syncInProgress = false;
			
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
		
		Zotero.DB.query("DELETE FROM syncDeleteLog");
		Zotero.DB.query("DELETE FROM storageDeleteLog");
		sql = "DELETE FROM settings WHERE setting='account' AND "
				+ "key IN ('userID', 'username')";
		Zotero.DB.query(sql);
		
		sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
		Zotero.DB.query(sql, Zotero.Date.getUnixTimestamp());
		
		Zotero.DB.commitTransaction();
	}
	
	
	function logout(callback) {
		var url = _serverURL + "logout";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		_sessionID = null;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
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
	
	
	function _checkResponse(xmlhttp) {
		if (!xmlhttp.responseText) {
			// Check SSL cert
			var channel = xmlhttp.channel;
			if (!channel instanceof Ci.nsIChannel) {
				_error('No HTTPS channel available');
			}
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
					_error("SSL certificate error connecting to " + host);
				}
				else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_BROKEN) == Ci.nsIWebProgressListener.STATE_IS_BROKEN) {
					_error("SSL connection error");
				}
			}
			_error('Empty response from server');
		}
		
		if (!xmlhttp.responseXML || !xmlhttp.responseXML.childNodes[0] ||
				xmlhttp.responseXML.childNodes[0].tagName != 'response' ||
				!xmlhttp.responseXML.childNodes[0].firstChild) {
			Zotero.debug(xmlhttp.responseText);
			_error('Invalid response from server', xmlhttp.responseText);
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
			// TODO: localize
			_error("Auto-syncing disabled until " + timeStr);
		}
		
		
		if (firstChild.localName == 'error') {
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
							Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._checkResponse() -- manual sync required");
							return;
						}
						
						Zotero.Sync.Server.resetClient();
						Zotero.Sync.Server.canAutoResetClient = false;
						Zotero.Sync.Runner.sync(background);
					}, 1);
					break;
				
				case 'TAG_TOO_LONG':
					if (!Zotero.Sync.Runner.background) {
						var tag = xmlhttp.responseXML.firstChild.getElementsByTagName('tag');
						if (tag.length) {
							var tag = tag[0].firstChild.nodeValue;
							setTimeout(function () {
								var callback = function () {
									var sql = "SELECT DISTINCT name FROM itemTags NATURAL JOIN tags WHERE LENGTH(name)>255 LIMIT 1";
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
			}
		}
	}
	
	
	function _checkServerSessionLock(errorNode, callback) {
		var code = errorNode.getAttribute('code');
		if (code != 'SYNC_IN_PROGRESS') {
			return false;
		}
		var lastAccessTime = errorNode.getAttribute('lastAccessTime');
		var relativeDateStr = Zotero.Date.toRelativeDate(lastAccessTime * 1000);
		var ipAddress = errorNode.getAttribute('ipAddress');
		
		var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
					.createInstance(Components.interfaces.nsIPrompt);
		var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
		+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL)
		+ pr.BUTTON_POS_1_DEFAULT;
		var index = pr.confirmEx(
			Zotero.getString('general.warning'),
			// TODO: localize
			"Another sync operation, started " + relativeDateStr + " from "
			+ (ipAddress
				? "another IP address (" + ipAddress + ")"
				: "the current IP address")
			+ ", "
			+ "is still in progress. "
			+ "This may indicate an active sync "
			+ (ipAddress ? "from another computer " : "")
			+ "or may have been caused by an interrupted session."
			+ "\n\n"
			+ "Do you want to reset the existing session? You should only do so "
			+ "if you do not believe another sync process is currently running.",
			buttonFlags,
			"Reset Session",
			null, null, null, {}
			);
		
		if (index == 0) {
			// TODO: 
			Zotero.Sync.Server.resetServer(callback);
			return true;
		}
		
		return false;
	}
	
	
	/**
	 * Make sure we're syncing with the same account we used last time
	 *
	 * @return 	TRUE if sync should continue, FALSE if cancelled
	 */
	function _checkSyncUser(userID, libraryID) {
		var sql = "SELECT value FROM settings WHERE "
					+ "setting='account' AND key='username'";
		var lastUsername = Zotero.DB.valueQuery(sql);
		var username = Zotero.Sync.Server.username;
		var lastUserID = Zotero.userID;
		var lastLibraryID = Zotero.libraryID;
		
		if (lastUserID && lastUserID != userID) {
			var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
						.createInstance(Components.interfaces.nsIPrompt);
			var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
			+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL)
			+ (pr.BUTTON_POS_2) * (pr.BUTTON_TITLE_IS_STRING)
			+ pr.BUTTON_POS_1_DEFAULT
			+ pr.BUTTON_DELAY_ENABLE;
			var index = pr.confirmEx(
				Zotero.getString('general.warning'),
				// TODO: localize
				"This Zotero database was last synced with a different "
					+ "zotero.org account ('" + lastUsername + "') from the "
					+ "current one ('" + username + "'). "
					+ "If you continue, local Zotero data will be "
					+ "combined with data from the '" + username + "' account "
					+ "stored on the server.\n\n"
					+ "To avoid combining data, revert to the '"
					+ lastUsername + "' account or use the Reset options "
					+ "in the Sync pane of the Zotero preferences.",
				buttonFlags,
				"Sync",
				null,
				"Open Sync Preferences",
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
				
				return false;
			}
		}
		
		if (lastUserID != userID || lastLibraryID != libraryID) {
			Zotero.userID = userID;
			Zotero.libraryID = libraryID;
		}
		
		if (lastUsername != username) {
			var sql = "REPLACE INTO settings VALUES ('account', 'username', ?)";
			Zotero.DB.query(sql, username);
		}
		
		return true;
	}
	
	
	function _invalidSession(xmlhttp) {
		if (xmlhttp.responseXML.childNodes[0].firstChild.tagName != 'error') {
			return false;
		}
		
		var code = xmlhttp.responseXML.childNodes[0].firstChild.getAttribute('code');
		return (code == 'INVALID_SESSION_ID') || (code == 'SESSION_TIMED_OUT');
	}
	
	
	function _error(e, extraInfo) {
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
			}
		}
		
		if (extraInfo) {
			// Server errors will generally be HTML
			extraInfo = Zotero.Utilities.prototype.unescapeHTML(extraInfo);
			Components.utils.reportError(extraInfo);
		}
		
		Zotero.debug(e, 1);
		
		_syncInProgress = false;
		Zotero.DB.rollbackAllTransactions();
		Zotero.reloadDataObjects();
		
		if (_sessionID && _sessionLock) {
			Zotero.Sync.Server.unlock()
		}
		
		Zotero.Sync.Runner.setError(e.message ? e.message : e);
		Zotero.Sync.Runner.reset();
		
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
Zotero.Sync.Server.Session = function () {
	this.uploadKeys = {};
	this.uploadKeys.updated = new Zotero.Sync.ObjectKeySet;
	this.uploadKeys.deleted = new Zotero.Sync.ObjectKeySet;
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
	Zotero.debug('a');
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
	this.processUpdatedXML = processUpdatedXML;
	this.itemToXML = itemToXML;
	this.xmlToItem = xmlToItem;
	this.removeMissingRelatedItems = removeMissingRelatedItems;
	this.collectionToXML = collectionToXML;
	this.xmlToCollection = xmlToCollection;
	this.creatorToXML = creatorToXML;
	this.xmlToCreator = xmlToCreator;
	this.searchToXML = searchToXML;
	this.xmlToSearch = xmlToSearch;
	this.tagToXML = tagToXML;
	this.xmlToTag = xmlToTag;
	
	var _noMergeTypes = ['search'];
	
	default xml namespace = '';
	
	
	/**
	 * Pull out collections from delete queue in XML
	 *
	 * @param	{XML}			xml
	 * @return	{String[]}					Array of collection keys
	 */
	function _getDeletedCollectionKeys(xml) {
		var keys = [];
		if (xml.deleted && xml.deleted.collections) {
			for each(var xmlNode in xml.deleted.collections.collection) {
				var libraryID = xmlNode.@libraryID.toString();
				libraryID = libraryID ? parseInt(libraryID) : null;
				keys.push({
					libraryID: libraryID,
					key: xmlNode.@key.toString()
				});
			}
		}
		return keys;
	}
	
	
	function processUpdatedXML(xml, lastLocalSyncDate, syncSession) {
		if (xml.children().length() == 0) {
			Zotero.debug('No changes received from server');
			return Zotero.Sync.Server.Data.buildUploadXML(syncSession);
		}
		
		Zotero.DB.beginTransaction();
		
		var deletedCollectionKeys = _getDeletedCollectionKeys(xml);
		
		var remoteCreatorStore = {};
		var relatedItemsStore = {};
		var itemStorageModTimes = {};
		var childItemStore = [];
		
		if (xml.groups.length()) {
			Zotero.debug("Processing remotely changed groups");
			for each(var xmlNode in xml.groups.group) {
				var group = Zotero.Sync.Server.Data.xmlToGroup(xmlNode);
				group.save();
			}
		}
		
		if (xml.deleted.groups.toString()) {
			Zotero.debug("Processing remotely deleted groups");
			var groupIDs = xml.deleted.groups.toString().split(' ');
			Zotero.debug(groupIDs);
			
			for each(var groupID in groupIDs) {
				var group = Zotero.Groups.get(groupID);
				if (!group) {
					continue;
				}
				// TODO: prompt to save
				
				Zotero.Notifier.disable();
				
				// TODO: figure out a better way to do this
				var notifierData = {};
				notifierData[groupID] = group.serialize();
				group.erase();
				
				Zotero.Notifier.enable();
				
				Zotero.Notifier.trigger('delete', 'group', groupID, notifierData);
			}
		}
		
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			var toSave = [];
			var toDelete = [];
			var toReconcile = [];
			
			//
			// Handle modified objects
			//
			Zotero.debug("Processing remotely changed " + types);
			
			typeloop:
			for each(var xmlNode in xml[types][type]) {
				var libraryID = xmlNode.@libraryID.toString();
				var key = xmlNode.@key.toString();
				var objLibraryKeyHash = Zotero[Types].makeLibraryKeyHash(libraryID, key);
				
				Zotero.debug("Processing remote " + type + " " + libraryID + "/" + key, 4);
				var isNewObject;
				var localDelete = false;
				
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
							var relKeys = xmlNode.related.toString();
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
							Zotero.Sync.Server.Data.removeMissingRelatedItems(xmlNode);
						}
						
						var remoteObj = Zotero.Sync.Server.Data['xmlTo' + Type](xmlNode);

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
							var reconcile = false;
							
							// Skip item if dateModified is the only modified
							// field (and no linked creators changed)
							switch (type) {
								// Will be handled by item CR for now
								case 'creator':
									remoteCreatorStore[Zotero.Creators.getLibraryKeyHash(remoteObj)] = remoteObj;
									syncSession.removeFromUpdated(obj);
									continue;
									
								case 'item':
									var diff = obj.diff(remoteObj, false, ["dateModified"]);
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
									
									/*
									if (obj.deleted && !remoteObj.deleted) {
										obj = 'trashed';
									}
									else if (!obj.deleted && remoteObj.deleted) {
										remoteObj = 'trashed';
									}
									*/
									reconcile = true;
									break;
								
								case 'collection':
									var changed = _mergeCollection(obj, remoteObj, childItemStore);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
									}
									continue;
								
								case 'tag':
									var changed = _mergeTag(obj, remoteObj);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
									}
									continue;
							}
							
							if (!reconcile) {
								Zotero.debug(obj);
								Zotero.debug(remoteObj);
								var msg = "Reconciliation unimplemented for " + types;
								alert(msg);
								throw(msg);
							}
							
							// TODO: order reconcile by parent/child?
							
							toReconcile.push([
								obj,
								remoteObj
							]);
							
							continue;
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
							
							// Auto-restore locally deleted tags that have
							// changed remotely
							case 'tag':
								syncSession.removeFromDeleted(fakeObj);
								var msg = _generateAutoChangeMessage(
									type, null, xmlNode.@name.toString()
								);
								alert(msg);
								continue;
							
							default:
								alert('Delete reconciliation unimplemented for ' + types);
								throw ('Delete reconciliation unimplemented for ' + types);
						}
					}
				}
				
				
				// Temporarily remove and store related items that don't yet exist
				if (type == 'item') {
					var missing = Zotero.Sync.Server.Data.removeMissingRelatedItems(xmlNode);
					if (missing.length) {
						relatedItemsStore[objLibraryKeyHash] = missing;
					}
				}
				
				// Create or overwrite locally
				obj = Zotero.Sync.Server.Data['xmlTo' + Type](xmlNode, obj);
				
				if (isNewObject && type == 'tag') {
					// If a local tag matches the name of a different remote tag,
					// delete the local tag and add items linked to it to the
					// matching remote tag
					//
					// DEBUG: why use xmlNode?
					var tagName = xmlNode.@name.toString();
					var tagType = xmlNode.@type.toString()
									? parseInt(xmlNode.@type) : 0;
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
							Zotero.debug('d');
							syncSession.addToUpdated({
								objectType: 'tag',
								libraryID: obj.libraryID,
								key: xmlNode.@key
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
					else if (obj.isAttachment() &&
							(obj.attachmentLinkMode ==
								Zotero.Attachments.LINK_MODE_IMPORTED_FILE ||
							 obj.attachmentLinkMode ==
								Zotero.Attachments.LINK_MODE_IMPORTED_URL)) {
						// Mark new attachments for download
						if (isNewObject) {
							obj.attachmentSyncState =
								Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
						}
						// Set existing attachments mtime update check
						else {
							var mtime = xmlNode.@storageModTime.toString();
							if (mtime) {
								itemStorageModTimes[obj.key] = parseInt(mtime);
							}
						}
					}
				}
			}
			
			
			//
			// Handle remotely deleted objects
			//
			if (xml.deleted.length() && xml.deleted[types].length()) {
				Zotero.debug("Processing remotely deleted " + types);
				
				for each(var xmlNode in xml.deleted[types][type]) {
					var libraryID = xmlNode.@libraryID.toString();
					libraryID = libraryID ? parseInt(libraryID) : null;
					var key = xmlNode.@key.toString();
					var obj = Zotero[Types].getByLibraryAndKey(libraryID, key);
					// Object can't be found
					if (!obj) {
						// Since it's already deleted remotely, don't include
						// the object in the deleted array if something else
						// caused its deletion during the sync
						syncSession.removeFromDeleted({
							objectType: type,
							libraryID: parseInt(xmlNode.@libraryID),
							key: xmlNode.@key.toString()
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
							var msg = _generateAutoChangeMessage(
								type, obj.name, null
							);
							alert(msg);
							continue;
							
						default:
							alert('Delete reconciliation unimplemented for ' + types);
							throw ('Delete reconciliation unimplemented for ' + types);
					}
				}
			}
			
			
			//
			// Reconcile objects that have changed locally and remotely
			//
			if (toReconcile.length) {
				if (Zotero.Sync.Runner.background) {
					// TODO: localize
					throw ("Background sync resulted in conflict \u2014 manual sync required");
				}
				
				var mergeData = _reconcile(type, toReconcile, remoteCreatorStore);
				if (!mergeData) {
					// TODO: throw?
					Zotero.DB.rollbackTransaction();
					return false;
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
				}
				
				// Add back related items (which now exist)
				for (var libraryKeyHash in relatedItemsStore) {
					var lk = Zotero.Items.parseLibraryKeyHash(libraryKeyHash);
					var item = Zotero.Items.getByLibraryAndKey(lk.libraryID, lk.key);
					for each(var relKey in relatedItemsStore[libraryKeyHash]) {
						var relItem = Zotero.Items.getByLibraryAndKey(lk.libraryID, relKey);
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
				}
			}
			else if (type == 'relation') {
				for each(var obj in toSave) {
					if (obj.exists()) {
						continue;
					}
					obj.save();
				}
			}
			else {
				for each(var obj in toSave) {
					obj.save();
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
						Zotero.Sync.EventListener.unignoreDeletions('item', children);
					}
					if (parents.length) {
						Zotero.Sync.EventListener.ignoreDeletions('item', parents);
						Zotero.Items.erase(parents);
						Zotero.Sync.EventListener.unignoreDeletions('item', parents);
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
					Zotero.Sync.EventListener.unignoreDeletions(type, toDelete);
				}
			}
			
			// Check mod times of updated items against stored time to see
			// if they've been updated elsewhere and mark for download if so
			if (type == 'item') {
				var ids = [];
				var modTimes = {};
				for (var key in itemStorageModTimes) {
					var item = Zotero.Items.getByLibraryAndKey(null, key);
					ids.push(item.id);
					modTimes[item.id] = itemStorageModTimes[key];
				}
				if (ids.length > 0) {
					Zotero.Sync.Storage.checkForUpdatedFiles(ids, modTimes);
				}
			}
		}
		
		var xmlstr = Zotero.Sync.Server.Data.buildUploadXML(syncSession);
		
		if (Zotero.Prefs.get('sync.debugBreak')) {
			Zotero.debug(xmlstr);
			throw ('break');
		}
		
		Zotero.DB.commitTransaction();
		
		return xmlstr;
	}
	
	
	/**
	 * @param	{Zotero.Sync.Server.Session}		syncSession
	 */
	this.buildUploadXML = function (syncSession) {
		//Zotero.debug(syncSession);
		var keys = syncSession.uploadKeys;
		
		var xml = <data/>
		
		// Add API version attribute
		xml.@version = Zotero.Sync.Server.apiVersion;
		
		
		// Updates
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			Zotero.debug("Processing locally changed " + types);
			
			var elementCreated = false;
			var libraryID, key;
			for (var libraryID in keys.updated[types]) {
				for (var key in keys.updated[types][libraryID]) {
					if (!elementCreated) {
						xml[types] = new XML("<" + types + "/>");
						elementCreated = true;
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
						xml.items.appendChild(this.itemToXML(obj, syncSession));
					}
					else {
						xml[types].appendChild(this[type + 'ToXML'](obj));
					}
				}
			}
		}
		
		// Deletions
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			Zotero.debug('Processing locally deleted ' + types);
			
			var elementCreated = false;
			var libraryID, key;
			for (var libraryID in keys.deleted[types]) {
				for (var key in keys.deleted[types][libraryID]) {
					if (!elementCreated) {
						xml.deleted[types] = new XML("<" + types + "/>");
						elementCreated = true;
					}
					var deletexml = new XML('<' + type + '/>');
					deletexml.@libraryID = parseInt(libraryID) ? parseInt(libraryID) : Zotero.libraryID;
					deletexml.@key = key;
					xml.deleted[types].appendChild(deletexml);
				}
			}
		}
		
		var xmlstr = xml.toXMLString();
		if (xmlstr.match('<data version="[0-9]+"/>')) {
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
		var newItemIDs = Zotero.Utilities.prototype.arrayDiff(childItems, itemIDs);
		if (itemIDs.length == newItemIDs.length) {
			return false;
		}
		collection.childItems = newItemIDs;
		return true;
	}
	
	
	function _mergeCollection(localObj, remoteObj, childItems) {
		var diff = localObj.diff(remoteObj, false, true);
		if (!diff) {
			return false;
		}
		
		Zotero.debug("COLLECTION HAS CHANGED");
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
			var msg = _generateAutoChangeMessage(
				'collection', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			// TODO: log rather than alert
			alert(msg);
		}
		
		// Check for child collections in the other object
		// that aren't in the target one
		if (otherDiff.childCollections.length) {
			// TODO: log
			// TODO: add
			throw ("Collection hierarchy conflict resolution is unimplemented");
		}
		
		// Add items in other object to target one
		if (otherDiff.childItems.length) {
			var childItems = targetObj.getChildItems(true);
			if (childItems) {
				targetObj.childItems = childItems.concat(otherDiff.childItems);
			}
			else {
				targetObj.childItems = otherDiff.childItems;
			}
			
			var msg = _generateCollectionItemMergeMessage(
				targetObj.name,
				otherDiff.childItems,
				remoteIsTarget
			);
			// TODO: log rather than alert
			alert(msg);
		}
		
		_removeChildItemsFromCollection(targetObj, childItems);
		
		targetObj.save();
		return true;
	}
	
	
	function _mergeTag(localObj, remoteObj) {
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
		
		// TODO: log old name
		if (targetDiff.fields.name) {
			var msg = _generateAutoChangeMessage(
				'tag', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			alert(msg);
		}
		
		// Add linked items in the other object to the target one
		if (otherDiff.linkedItems.length) {
			// need to handle changed items
			
			var linkedItems = targetObj.getLinkedItems(true);
			targetObj.linkedItems = linkedItems.concat(otherDiff.linkedItems);
			
			var msg = _generateTagItemMergeMessage(
				targetObj.name,
				otherDiff.linkedItems,
				remoteIsTarget
			);
			// TODO: log rather than alert
			alert(msg);
		}
		
		targetObj.save();
		return true;
	}
	
	
	/**
	 * @param	{String}	itemType
	 * @param	{String}	localName
	 * @param	{String}	remoteName
	 * @param	{Boolean}	[remoteMoreRecent=false]
	 */
	function _generateAutoChangeMessage(itemType, localName, remoteName, remoteMoreRecent) {
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
		var msg = "A " + itemType + " has changed both locally and "
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
	
	
	/**
	 * @param	{String}		collectionName
	 * @param	{Integer[]}		addedItemIDs
	 * @param	{Boolean}		remoteIsTarget
	 */
	function _generateCollectionItemMergeMessage(collectionName, addedItemIDs, remoteIsTarget) {
		// TODO: localize
		var introMsg = "Items in the collection '" + collectionName + "' have been "
			+ "added and/or removed in multiple locations."
		
		introMsg += " ";
		if (remoteIsTarget) {
			introMsg += "The following items have been added to the remote collection:";
		}
		else {
			introMsg += "The following items have been added to the local collection:";
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
	 * @param	{String}		tagName
	 * @param	{Integer[]}		addedItemIDs
	 * @param	{Boolean}		remoteIsTarget
	 */
	function _generateTagItemMergeMessage(tagName, addedItemIDs, remoteIsTarget) {
		// TODO: localize
		var introMsg = "The tag '" + tagName + "' has been "
			+ "added to and/or removed from items in multiple locations."
		
		introMsg += " ";
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
					// TODO: localize
					'Local Object',
					'Remote Object',
					'Merged Object'
				],
				objects: objectPairs
			}
		};
		
		if (type == 'item') {
			if (!Zotero.Utilities.prototype.isEmpty(changedCreators)) {
				io.dataIn.changedCreators = changedCreators;
			}
		}
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
		
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
	 * Converts a Zotero.Item object to an E4X <item> object
	 *
	 * @param	{Zotero.Item}					item
	 * @param	{Zotero.Sync.Server.Session}		[syncSession]
	 */
	function itemToXML(item, syncSession) {
		var xml = <item/>;
		var item = item.serialize();
		
		xml.@libraryID = item.primary.libraryID ? item.primary.libraryID : Zotero.libraryID;
		xml.@key = item.primary.key;
		
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
			xml['@' + attr] = item.primary[field];
		}
		
		// Item data
		for (var field in item.fields) {
			if (!item.fields[field]) {
				continue;
			}
			var newField = <field>{_xmlize(item.fields[field])}</field>;
			newField.@name = field;
			xml.field += newField;
		}
		
		// Deleted item flag
		if (item.deleted) {
			xml.@deleted = '1';
		}
		
		if (item.primary.itemType == 'note' || item.primary.itemType == 'attachment') {
			if (item.sourceItemKey) {
				xml.@sourceItem = item.sourceItemKey;
			}
		}
		
		// Note
		if (item.primary.itemType == 'note') {
			var note = <note>{_xmlize(item.note)}</note>;
			xml.note += note;
		}
		
		// Attachment
		if (item.primary.itemType == 'attachment') {
			xml.@linkMode = item.attachment.linkMode;
			xml.@mimeType = item.attachment.mimeType;
			var charset = item.attachment.charset;
			if (charset) {
				xml.@charset = charset;
			}
			
			// Include storage sync time and paths for non-links
			if (item.attachment.linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				var mtime = Zotero.Sync.Storage.getSyncedModificationTime(item.primary.itemID);
				if (mtime) {
					xml.@storageModTime = mtime;
				}
				
				var path = <path>{item.attachment.path}</path>;
				xml.path += path;
			}
			
			if (item.note) {
				var note = <note>{_xmlize(item.note)}</note>;
				xml.note += note;
			}
		}
		
		// Creators
		for (var index in item.creators) {
			var newCreator = <creator/>;
			var libraryID = item.creators[index].libraryID ? item.creators[index].libraryID : Zotero.libraryID;
			var key = item.creators[index].key;
			if (!key) {
				throw ("Creator key not set for item in Zotero.Sync.Server.sync()");
			}
			newCreator.@libraryID = libraryID;
			newCreator.@key = key;
			newCreator.@creatorType = item.creators[index].creatorType;
			newCreator.@index = index;
			
			// Add creator XML as glue if not already included in sync session
			var fakeObj = {
				objectType: 'creator',
				libraryID: libraryID,
				key: key
			};
			if (syncSession && syncSession.objectInUpdated(fakeObj)) {
				var creator = Zotero.Creators.getByLibraryAndKey(libraryID, key);
				var creatorXML = Zotero.Sync.Server.Data.creatorToXML(creator);
				newCreator.creator = creatorXML;
			}
			
			xml.creator += newCreator;
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
				xml.related = keys.join(' ');
			}
		}
		
		return xml;
	}
	
	
	/**
	 * Convert E4X <item> object into an unsaved Zotero.Item
	 *
	 * @param	object	xmlItem		E4X XML node with item data
	 * @param	object	item			(Optional) Existing Zotero.Item to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	function xmlToItem(xmlItem, item, skipPrimary) {
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
			var libraryID = xmlItem.@libraryID.toString();
			data.libraryID = libraryID ? parseInt(libraryID) : null;
			data.key = xmlItem.@key.toString();
			data.dateAdded = xmlItem.@dateAdded.toString();
			data.dateModified = xmlItem.@dateModified.toString();
		}
		data.itemTypeID = Zotero.ItemTypes.getID(xmlItem.@itemType.toString());
		
		var changedFields = {};
		
		// Primary data
		for (var field in data) {
			item.setField(field, data[field]);
			changedFields[field] = true;
		}
		
		// Item data
		for each(var field in xmlItem.field) {
			var fieldName = field.@name.toString();
			item.setField(fieldName, field.toString());
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
		var deleted = xmlItem.@deleted.toString();
		item.deleted = (deleted == 'true' || deleted == "1");
		
		// Item creators
		var i = 0;
		for each(var creator in xmlItem.creator) {
			var pos = parseInt(creator.@index);
			if (pos != i) {
				throw ('No creator in position ' + i);
			}
			
			var creatorObj = Zotero.Creators.getByLibraryAndKey(data.libraryID, creator.@key.toString());
			// If creator doesn't exist locally (e.g., if it was deleted locally
			// and appears in a new/modified item remotely), get it from within
			// the item's creator block, where a copy should be provided
			if (!creatorObj) {
				if (creator.creator.length() == 0) {
					var msg = "Data for missing local creator "
						+ data.libraryID + "/" + creator.@key.toString()
						+ " not provided in Zotero.Sync.Server.Data.xmlToItem()";
					var e = new Zotero.Error(msg, "MISSING_OBJECT");
					throw (e);
				}
				var l = creator.@libraryID.toString();
				l = l ? l : null;
				var creatorObj = Zotero.Sync.Server.Data.xmlToCreator(creator.creator);
				if (l != creatorObj.libraryID || creator.@key.toString() != creatorObj.key) {
					throw ("Creator id " + creatorObj.id + " does not match "
						+ "item creator in Zotero.Sync.Server.Data.xmlToItem()");
				}
			}
			item.setCreator(
				pos,
				creatorObj,
				creator.@creatorType.toString()
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
			var sourceItemKey = xmlItem.@sourceItem.toString();
			item.setSourceKey(sourceItemKey ? sourceItemKey : false);
			item.setNote(xmlItem.note.toString());
		}
		
		// Attachment metadata
		if (item.isAttachment()) {
			item.attachmentLinkMode = parseInt(xmlItem.@linkMode);
			item.attachmentMIMEType = xmlItem.@mimeType.toString();
			item.attachmentCharset = xmlItem.@charset.toString();
			if (item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) { 
				item.attachmentPath = xmlItem.path.toString();
			}
		}
		
		// Related items
		var related = xmlItem.related.toString();
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
	
	
	function removeMissingRelatedItems(xmlNode) {
		var libraryID = parseInt(xmlNode.@libraryID);
		var exist = [];
		var missing = [];
		var relKeys = xmlNode.related.toString();
		relKeys = relKeys ? relKeys.split(' ') : [];
		for each(var relKey in relKeys) {
			if (Zotero.Items.getByLibraryAndKey(libraryID, relKey)) {
				exist.push(relKey);
			}
			else {
				missing.push(relKey);
			}
		}
		xmlNode.related = exist.join(' ');
		return missing;
	}
	
	
	function collectionToXML(collection) {
		var xml = <collection/>;
		xml.@libraryID = collection.libraryID ? collection.libraryID : Zotero.libraryID;
		xml.@key = collection.key;
		xml.@name = _xmlize(collection.name);
		xml.@dateAdded = collection.dateAdded;
		xml.@dateModified = collection.dateModified;
		if (collection.parent) {
			var parentCol = Zotero.Collections.get(collection.parent);
			xml.@parent = parentCol.key;
		}
		
		var children = collection.getChildren();
		if (children) {
			//xml.collections = '';
			xml.items = '';
			for each(var child in children) {
				/*
				if (child.type == 'collection') {
					xml.collections = xml.collections ?
						xml.collections + ' ' + child.id : child.id;
				}
				else */if (child.type == 'item') {
					xml.items = xml.items ?
						xml.items + ' ' + child.key : child.key;
				}
			}
			/*
			if (xml.collections == '') {
				delete xml.collections;
			}
			*/
			if (xml.items == '') {
				delete xml.items;
			}
		}
		
		return xml;
	}
	
	
	/**
	 * Convert E4X <collection> object into an unsaved Zotero.Collection
	 *
	 * @param	object	xmlCollection	E4X XML node with collection data
	 * @param	object	item		(Optional) Existing Zotero.Collection to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	function xmlToCollection(xmlCollection, collection, skipPrimary) {
		if (!collection) {
			collection = new Zotero.Collection;
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing collection in "
					+ "Zotero.Sync.Server.Data.xmlToCollection()");
		}
		
		if (!skipPrimary) {
			var libraryID = xmlCollection.@libraryID.toString();
			collection.libraryID = libraryID ? parseInt(libraryID) : null;
			collection.key = xmlCollection.@key.toString();
			var parentKey = xmlCollection.@parent.toString();
			if (parentKey) {
				collection.parentKey = parentKey;
			}
			else {
				collection.parent = false;
			}
			collection.dateAdded = xmlCollection.@dateAdded.toString();
			collection.dateModified = xmlCollection.@dateModified.toString();
		}
		
		collection.name = xmlCollection.@name.toString();
		
		/*
		// Subcollections
		var str = xmlCollection.collections.toString();
		collection.childCollections = str == '' ? [] : str.split(' ');
		*/
		
		// Child items
		var childItems = xmlCollection.items.toString();
		childItems = childItems ? childItems.split(' ') : []
		var childItemIDs = [];
		for each(var key in childItems) {
			var childItem = Zotero.Items.getByLibraryAndKey(collection.libraryID, key);
			if (!childItem) {
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
	 * Converts a Zotero.Creator object to an E4X <creator> object
	 */
	function creatorToXML(creator) {
		var xml = <creator/>;
		
		xml.@libraryID = creator.libraryID ? creator.libraryID : Zotero.libraryID;
		xml.@key = creator.key;
		xml.@dateAdded = creator.dateAdded;
		xml.@dateModified = creator.dateModified;
		
		var allowEmpty = ['firstName', 'lastName', 'name'];
		
		var creator = creator.serialize();
		for (var field in creator.fields) {
			if (!creator.fields[field] && allowEmpty.indexOf(field) == -1) {
				continue;
			}
			
			switch (field) {
				case 'firstName':
				case 'lastName':
				case 'name':
					xml[field] = _xmlize(creator.fields[field]);
					break;
				
				default:
					xml[field] = creator.fields[field];
			}
		}
		return xml;
	}
	
	
	/**
	 * Convert E4X <creator> object into an unsaved Zotero.Creator
	 *
	 * @param	object	xmlCreator	E4X XML node with creator data
	 * @param	object	item		(Optional) Existing Zotero.Creator to update
	 * @param	bool	skipPrimary	(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	function xmlToCreator(xmlCreator, creator, skipPrimary) {
		if (!creator) {
			creator = new Zotero.Creator;
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing creator in "
					+ "Zotero.Sync.Server.Data.xmlToCreator()");
		}
		
		if (!skipPrimary) {
			var libraryID = xmlCreator.@libraryID.toString();
			creator.libraryID = libraryID ? parseInt(libraryID) : null;
			creator.key = xmlCreator.@key.toString();
			creator.dateAdded = xmlCreator.@dateAdded.toString();
			creator.dateModified = xmlCreator.@dateModified.toString();
		}
		
		if (xmlCreator.fieldMode == 1) {
			creator.firstName = '';
			creator.lastName = xmlCreator.name.toString();
			creator.fieldMode = 1;
		}
		else {
			creator.firstName = xmlCreator.firstName.toString();
			creator.lastName = xmlCreator.lastName.toString();
			creator.fieldMode = 0;
		}
		creator.birthYear = xmlCreator.birthYear.toString();
		
		return creator;
	}
	
	
	function searchToXML(search) {
		var xml = <search/>;
		xml.@libraryID = search.libraryID ? search.libraryID : Zotero.libraryID;
		xml.@key = search.key;
		xml.@name = _xmlize(search.name);
		xml.@dateAdded = search.dateAdded;
		xml.@dateModified = search.dateModified;
		
		var conditions = search.getSearchConditions();
		if (conditions) {
			for each(var condition in conditions) {
				var conditionXML = <condition/>
				conditionXML.@id = condition.id;
				conditionXML.@condition = condition.condition;
				if (condition.mode) {
					conditionXML.@mode = condition.mode;
				}
				conditionXML.@operator = condition.operator;
				conditionXML.@value =
					_xmlize(condition.value ? condition.value : '');
				if (condition.required) {
					conditionXML.@required = 1;
				}
				xml.condition += conditionXML;
			}
		}
		
		return xml;
	}
	
	
	/**
	 * Convert E4X <search> object into an unsaved Zotero.Search
	 *
	 * @param	object	xmlSearch	E4X XML node with search data
	 * @param	object	item		(Optional) Existing Zotero.Search to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields (except itemTypeID)
	 */
	function xmlToSearch(xmlSearch, search, skipPrimary) {
		if (!search) {
			search = new Zotero.Search;
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing search in "
					+ "Zotero.Sync.Server.Data.xmlToSearch()");
		}
		
		if (!skipPrimary) {
			var libraryID = xmlSearch.@libraryID.toString();
			search.libraryID = libraryID ? parseInt(libraryID) : null;
			search.key = xmlSearch.@key.toString();
			search.dateAdded = xmlSearch.@dateAdded.toString();
			search.dateModified = xmlSearch.@dateModified.toString();
		}
		
		search.name = xmlSearch.@name.toString();
		
		var conditionID = -1;
		
		// Search conditions
		for each(var condition in xmlSearch.condition) {
			conditionID = parseInt(condition.@id);
			var name = condition.@condition.toString();
			var mode = condition.@mode.toString();
			if (mode) {
				name = name + '/' + mode;
			}
			if (search.getSearchCondition(conditionID)) {
				search.updateCondition(
					conditionID,
					name,
					condition.@operator.toString(),
					condition.@value.toString(),
					!!condition.@required.toString()
				);
			}
			else {
				var newID = search.addCondition(
					name,
					condition.@operator.toString(),
					condition.@value.toString(),
					!!condition.@required.toString()
				);
				if (newID != conditionID) {
					throw ("Search condition ids not contiguous in Zotero.Sync.Server.xmlToSearch()");
				}
			}
		}
		
		conditionID++;
		while (search.getSearchCondition(conditionID)) {
			search.removeCondition(conditionID);
		}
		
		return search;
	}
	
	
	function tagToXML(tag) {
		var xml = <tag/>;
		xml.@libraryID = tag.libraryID ? tag.libraryID : Zotero.libraryID;
		xml.@key = tag.key;
		xml.@name = _xmlize(tag.name);
		if (tag.type) {
			xml.@type = tag.type;
		}
		xml.@dateAdded = tag.dateAdded;
		xml.@dateModified = tag.dateModified;
		var linkedItems = tag.getLinkedItems();
		if (linkedItems) {
			var linkedItemKeys = [];
			for each(var linkedItem in linkedItems) {
				linkedItemKeys.push(linkedItem.key);
			}
			xml.items = linkedItemKeys.join(' ');
		}
		return xml;
	}
	
	
	/**
	 * Convert E4X <tag> object into an unsaved Zotero.Tag
	 *
	 * @param	object	xmlTag			E4X XML node with tag data
	 * @param	object	tag				(Optional) Existing Zotero.Tag to update
	 * @param	bool	skipPrimary		(Optional) Ignore passed primary fields
	 */
	function xmlToTag(xmlTag, tag, skipPrimary) {
		if (!tag) {
			tag = new Zotero.Tag;
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing tag in "
					+ "Zotero.Sync.Server.Data.xmlToTag()");
		}
		
		if (!skipPrimary) {
			var libraryID = xmlTag.@libraryID.toString();
			tag.libraryID = libraryID ? parseInt(libraryID) : null;
			tag.key = xmlTag.@key.toString();
			tag.dateAdded = xmlTag.@dateAdded.toString();
			tag.dateModified = xmlTag.@dateModified.toString();
		}
		
		tag.name = xmlTag.@name.toString();
		tag.type = xmlTag.@type.toString() ? parseInt(xmlTag.@type) : 0;
		
		var keys = xmlTag.items.toString() ? xmlTag.items.toString().split(' ') : false;
		if (keys) {
			var ids = [];
			for each(var key in keys) {
				var item = Zotero.Items.getByLibraryAndKey(tag.libraryID, key);
				if (!item) {
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
			Zotero.debug("Deleting conflicting local tag " + tagID);
			var tag = Zotero.Tags.get(tagID);
			var linkedItems = tag.getLinkedItems(true);
			Zotero.Tags.erase(tagID);
			Zotero.Tags.purge();
			
			syncSession.removeFromUpdated(tag);
			//syncSession.addToDeleted(tag);
			
			return linkedItems ? linkedItems : [];
		}
		
		return false;
	}
	
	
	/**
	 * Convert E4X <group> object into an unsaved Zotero.Group
	 *
	 * @param	object	xmlGroup		E4X XML node with group data
	 * @param	object	group			(Optional) Existing Zotero.Group to update
	 */
	this.xmlToGroup = function (xmlGroup, group) {
		if (!group) {
			group = new Zotero.Group;
		}
		
		Zotero.debug(xmlGroup.toXMLString());
		
		group.id = parseInt(xmlGroup.@id);
		group.libraryID = parseInt(xmlGroup.@libraryID);
		group.name = xmlGroup.@name.toString();
		group.editable = !!parseInt(xmlGroup.@editable);
		group.filesEditable = !!parseInt(xmlGroup.@filesEditable);
		group.description = xmlGroup.description.toString();
		
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
	
	
	this.relationToXML = function (relation) {
		return relation.toXML();
	}
	
	this.xmlToRelation = function (xmlRelation) {
		return Zotero.Relations.xmlToRelation(xmlRelation);
	}
	
	
	function _xmlize(str) {
		return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '\u2B1A');
	}
}
