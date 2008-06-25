Zotero.Sync = new function() {
	this.init = init;
	this.getObjectTypeID = getObjectTypeID;
	this.getObjectTypeName = getObjectTypeName;
	this.buildUploadIDs = buildUploadIDs;
	this.getUpdatedObjects = getUpdatedObjects;
	this.addToUpdated = addToUpdated;
	this.getDeletedObjects = getDeletedObjects;
	this.purgeDeletedObjects = purgeDeletedObjects;
	this.removeFromDeleted = removeFromDeleted;
	
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
			}

		};
	});
	
	default xml namespace = '';
	
	var _typesLoaded = false;
	var _objectTypeIDs = {};
	var _objectTypeNames = {};
	
	var _deleteLogDays = 30;
	
	
	function init() {
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
	
	
	function getObjectTypeID(type) {
		if (!_typesLoaded) {
			_loadObjectTypes();
		}
		
		var id = _objectTypeIDs[type];
		return id ? id : false;
	}
	
	
	function getObjectTypeName(typeID, plural) {
		if (!_typesLoaded) {
			_loadObjectTypes();
		}
		
		var name = _objectTypeNames[typeID];
		return name ? name : false;
	}
	
	
	function buildUploadIDs() {
		var uploadIDs = {};
		
		uploadIDs.updated = {};
		uploadIDs.changed = {};
		uploadIDs.deleted = {};
		
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var types = syncObject.plural.toLowerCase(); // 'items'
			
			uploadIDs.updated[types] = [];
			uploadIDs.changed[types] = {};
			uploadIDs.deleted[types] = [];
		}
		
		return uploadIDs;
	}
	
	
	/**
	 * @param	object	lastSyncDate	JS Date object
	 * @return	object	{ items: [123, 234, ...], creators: [321, 432, ...], ... }
	 */
	function getUpdatedObjects(lastSyncDate) {
		if (lastSyncDate && lastSyncDate.constructor.name != 'Date') {
			throw ('lastSyncDate must be a Date or FALSE in '
				+ 'Zotero.Sync.getDeletedObjects()')
		}
		
		var updatedIDs = {};
		for each(var syncObject in this.syncObjects) {
			var Types = syncObject.plural; // 'Items'
			var types = syncObject.plural.toLowerCase(); // 'items'
			
			Zotero.debug("Getting updated local " + types);
			
			updatedIDs[types] = Zotero[Types].getUpdated(lastSyncDate);
			if (!updatedIDs[types]) {
				updatedIDs[types] = [];
			}
		}
		return updatedIDs;
	}
	
	
	function addToUpdated(updated, ids) {
		ids = Zotero.flattenArguments(ids);
		for each(var id in ids) {
			if (updated.indexOf(id) == -1) {
				updated.push(id);
			}
		}
	}
	
	
	/**
	 * @param	object	lastSyncDate	JS Date object
	 * @return	mixed	Returns object with deleted ids
	 *		{
	 *			items: [ { id: 123, key: ABCD1234 }, ... ]
	 *			creators: [ { id: 123, key: ABCD1234 }, ... ],
	 *			...
	 *		}
	 * or FALSE if none or -1 if last sync time is before start of log
	 */
	function getDeletedObjects(lastSyncDate) {
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
		var sql = "SELECT syncObjectTypeID, objectID, key FROM syncDeleteLog";
		if (lastSyncDate) {
			param = Zotero.Date.toUnixTimestamp(lastSyncDate);
			sql += " WHERE timestamp>?";
		}
		sql += " ORDER BY timestamp";
		var rows = Zotero.DB.query(sql, param);
		
		if (!rows) {
			return false;
		}
		
		var deletedIDs = {};
		for each(var syncObject in this.syncObjects) {
			deletedIDs[syncObject.plural.toLowerCase()] = [];
		}
		
		for each(var row in rows) {
			var type = this.getObjectTypeName(row.syncObjectTypeID);
			type = this.syncObjects[type].plural.toLowerCase()
			deletedIDs[type].push({
				id: row.objectID,
				key: row.key
			});
		}
		return deletedIDs;
	}
	
	
	/**
	 * @param	int		deleteOlderThan		Unix timestamp
	 */
	function purgeDeletedObjects(deleteOlderThan) {
		if (isNaN(parseInt(deleteOlderThan))) {
			throw ("Invalid timestamp '" + deleteOlderThan
				+ "' in Zotero.Sync.purgeDeletedObjects");
		}
		var sql = "DELETE FROM syncDeleteLog WHERE timestamp<?";
		Zotero.DB.query(sql, { int: deleteOlderThan });
	}
	
	
	function removeFromDeleted(deleted, id, key) {
		for (var i=0; i<deleted.length; i++) {
			if (deleted[i].id == id && deleted[i].key == key) {
				deleted.splice(i, 1);
				i--;
			}
		}
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



/**
 * Notifier observer to add deleted objects to syncDeleteLog
 * 		plus related methods
 */
Zotero.Sync.EventListener = new function () {
	default xml namespace = '';
	
	this.init = init;
	this.ignoreDeletions = ignoreDeletions;
	this.unignoreDeletions = unignoreDeletions;
	this.notify = notify;
	
	var _notifierObserver = false;
	var _shutdown = false;
	var _deleteBlacklist = {};
	
	
	function init() {
		// Initialize delete log listener
		_notifierObserver = Zotero.Notifier.registerObserver(this);
		
		// Register shutdown handler
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(this, "xpcom-shutdown", false);
		observerService = null;
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
		
		var ZU = new Zotero.Utilities;
		
		Zotero.DB.beginTransaction();
		
		if (event == 'delete') {
			var sql = "INSERT INTO syncDeleteLog VALUES (?, ?, ?, ?)";
			var statement = Zotero.DB.getStatement(sql);
			
			var ts = Zotero.Date.getUnixTimestamp();
			
			for(var i=0, len=ids.length; i<len; i++) {
				if (_deleteBlacklist[ids[i]]) {
					Zotero.debug("Not logging blacklisted '"
						+ type + "' id " + ids[i]
						+ " in Zotero.Sync.EventListener.notify()", 4);
					continue;
				}
				
				var key = extraData[ids[i]].old.primary.key;
				
				statement.bindInt32Parameter(0, objectTypeID);
				statement.bindInt32Parameter(1, ids[i]);
				statement.bindStringParameter(2, key);
				statement.bindInt32Parameter(3, ts);
				
				try {
					statement.execute();
				}
				catch(e) {
					statement.reset();
					Zotero.DB.rollbackTransaction();
					throw(Zotero.DB.getLastErrorString());
				}
			}
			
			statement.reset();
		}
		
		Zotero.DB.commitTransaction();
	}
	
	/*
	 * Shutdown observer -- implements nsIObserver
	 */
	function observe(subject, topic, data) {
		switch (topic) {
			case 'xpcom-shutdown':
				if (_shutdown) {
					Zotero.debug('returning');
					return;
				}
				
				Zotero.debug('Shutting down sync system');
				Zotero.Notifier.unregisterObserver(_notifierObserver);
				_shutdown = true;
				break;
		}
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
	
	this.__defineGetter__('username', function () {
		return Zotero.Prefs.get('sync.server.username');
	});
	
	this.__defineGetter__('password', function () {
		if (!this.username) {
			Zotero.debug('Username not set before setting Zotero.Sync.Server.password');
			return '';
		}
		
		Zotero.debug('Getting Zotero sync password');
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		
		// Find user from returned array of nsILoginInfo objects
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == this.username) {
				return logins[i].password;
			}
		}
		
		return '';
	});
	
	this.__defineSetter__('password', function (password) {
		_sessionID = null;
		
		if (!this.username) {
			Zotero.debug('Username not set before setting Zotero.Sync.Server.password');
			return;
		}
		
		if (!password) {
			Zotero.debug('Password empty setting Zotero.Sync.Server.password');
			return;
		}
		
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
				null, this.username, password, "", "");
			loginManager.addLogin(loginInfo);
		}
	});
	
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
	this.apiVersion = 1;
	
	default xml namespace = '';
	
	var _loginManagerHost = 'chrome://zotero';
	var _loginManagerURL = 'Zotero Sync Server';
	
	var _serverURL = ZOTERO_CONFIG.SYNC_URL;
	
	var _maxAttempts = 3;
	var _attempts = _maxAttempts;
	var _syncInProgress;
	
	var _apiVersionComponent = "version=" + this.apiVersion;
	var _sessionID;
	var _sessionLock;
	
	
	function login(callback) {
		var url = _serverURL + "login";
		
		var username = Zotero.Sync.Server.username;
		
		if (!username) {
			_error("Username not set in Zotero.Sync.Server.login()");
		}
		else if (!username.match(/^\w+$/)) {
			_error("Invalid username '" + username + "' in Zotero.Sync.Server.login()");
		}
		
		var password = encodeURIComponent(Zotero.Sync.Server.password);
		var body = _apiVersionComponent
					+ "&username=" + username
					+ "&password=" + password;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				if (response.firstChild.getAttribute('type') == 'forbidden'
						&& response.firstChild.getAttribute('code') == 'INVALID_LOGIN') {
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
			
			
			Zotero.debug('Got session ID ' + _sessionID + ' from server');
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function sync() {
		if (_attempts < 0) {
			_error('Too many attempts in Zotero.Sync.Server.sync()');
		}
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			this.login(Zotero.Sync.Server.sync);
			return;
		}
		
		if (!_sessionLock) {
			Zotero.Sync.Server.lock(Zotero.Sync.Server.sync);
			return;
		}
		
		if (_syncInProgress) {
			_error("Sync operation already in progress");
		}
		
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
					+ '&lastsync=' + lastsync;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			Zotero.debug(xmlhttp.responseText);
			
			_checkResponse(xmlhttp);
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				_syncInProgress = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.sync);
				return;
			}
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				// handle error
				Zotero.debug(xmlhttp.responseText);
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			// Strip XML declaration and convert to E4X
			var xml = new XML(xmlhttp.responseText.replace(/<\?xml.*\?>/, ''));
			
			Zotero.DB.beginTransaction();
			
			try {
				Zotero.UnresponsiveScriptIndicator.disable();
				
				var lastLocalSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
				var lastLocalSyncDate = lastLocalSyncTime ?
					new Date(lastLocalSyncTime * 1000) : false;
				
				var uploadIDs = Zotero.Sync.buildUploadIDs();
				uploadIDs.updated = Zotero.Sync.getUpdatedObjects(lastLocalSyncDate);
				var deleted = Zotero.Sync.getDeletedObjects(lastLocalSyncDate);
				if (deleted == -1) {
					_error('Sync delete log starts after last sync date in Zotero.Sync.Server.sync()');
				}
				if (deleted) {
					uploadIDs.deleted = deleted;
				}
				
				var nextLocalSyncDate = Zotero.DB.transactionDate;
				var nextLocalSyncTime = Zotero.Date.toUnixTimestamp(nextLocalSyncDate);
				Zotero.Sync.Server.nextLocalSyncDate = nextLocalSyncDate;
				
				// Reconcile and save updated data from server and
				// prepare local data to upload
				var xmlstr = Zotero.Sync.Server.Data.processUpdatedXML(
					xml.updated, lastLocalSyncDate, uploadIDs
				);
				
				if (xmlstr === false) {
					Zotero.debug("Sync cancelled");
					Zotero.DB.rollbackTransaction();
					Zotero.Sync.Server.unlock();
					Zotero.reloadDataObjects();
					_syncInProgress = false;
					return;
				}
				
				if (xmlstr) {
					Zotero.debug(xmlstr);
				}
				
				//throw('break1');
				
				Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
				
				if (!xmlstr) {
					Zotero.debug("Nothing to upload to server");
					Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
					Zotero.Sync.Server.nextLocalSyncDate = false;
					Zotero.DB.commitTransaction();
					Zotero.Sync.Server.unlock();
					_syncInProgress = false;
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
						Zotero.debug(xmlhttp.responseText);
						_error(response.firstChild.firstChild.nodeValue);
					}
					
					Zotero.DB.beginTransaction();
					Zotero.Sync.purgeDeletedObjects(nextLocalSyncTime);
					Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
					Zotero.Sync.Server.nextLocalSyncDate = false;
					Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
					
					//throw('break2');
					
					Zotero.DB.commitTransaction();
					Zotero.Sync.Server.unlock();
					_syncInProgress = false;
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
			
			_resetAttempts();
		});
		
		return;
	}
	
	
	function lock(callback) {
		Zotero.debug("Getting session lock");
		
		if (_attempts < 0) {
			_error('Too many attempts in Zotero.Sync.Server.lock()', 2);
		}
		
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
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'locked') {
				_error('Invalid response from server');
			}
			
			_sessionLock = true;
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function unlock(callback) {
		Zotero.debug("Releasing session lock");
		
		if (_attempts < 0) {
			_error('Too many attempts in Zotero.Sync.Server.unlock()');
		}
		
		if (!_sessionID) {
			_error('No session available in Zotero.Sync.Server.unlock()');
		}
		
		var url = _serverURL + "unlock";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			_checkResponse(xmlhttp);
			
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'unlocked') {
				_error('Invalid response from server');
			}
			
			_sessionLock = null;
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function clear() {
		if (_attempts < 0) {
			_error('Too many attempts in Zotero.Sync.Server.clear()');
		}
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			this.login(Zotero.Sync.Server.clear);
			return;
		}
		
		var url = _serverURL + "clear";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.clear);
				return;
			}
			
			_checkResponse(xmlhttp);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'cleared') {
				_error('Invalid response from server');
			}
			
			Zotero.Sync.Server.resetClient();
		});
		
		_resetAttempts();
	}
	
	
	/**
	 * Clear session lock on server
	 */
	function resetServer() {
		if (_attempts < 0) {
			_error('Too many attempts in Zotero.Sync.Server.resetServer()');
		}
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			this.login(Zotero.Sync.Server.resetServer);
			return;
		}
		
		var url = _serverURL + "reset";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.Utilities.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login(Zotero.Sync.Server.reset);
				return;
			}
			
			_checkResponse(xmlhttp);
			
			Zotero.debug(xmlhttp.responseText);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'reset') {
				_error('Invalid response from server');
			}
			
			_syncInProgress = false;
		});
		
		_resetAttempts();
	}
	
	
	function resetClient() {
		Zotero.DB.beginTransaction();
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('lastlocalsync', 'lastremotesync', 'syncdeletelog')";
		Zotero.DB.query(sql);
		
		Zotero.DB.query("DELETE FROM syncDeleteLog");
		
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
				_error('Invalid response from server');
			}
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function _checkResponse(xmlhttp) {
		if (!xmlhttp.responseXML ||
				!xmlhttp.responseXML.childNodes[0] ||
				xmlhttp.responseXML.childNodes[0].tagName != 'response') {
			Zotero.debug(xmlhttp.responseText);
			_error('Invalid response from server');
		}
		
		if (!xmlhttp.responseXML.childNodes[0].firstChild) {
			_error('Empty response from server');
		}
	}
	
	
	function _invalidSession(xmlhttp) {
		if (xmlhttp.responseXML.childNodes[0].firstChild.tagName != 'error') {
			return false;
		}
		
		var code = xmlhttp.responseXML.childNodes[0].firstChild.getAttribute('code');
		return (code == 'INVALID_SESSION_ID') || (code == 'SESSION_TIMED_OUT');
	}
	
	
	function _resetAttempts() {
		_attempts = _maxAttempts;
	}
	
	
	function _error(e) {
		_syncInProgress = false;
		_resetAttempts();
		Zotero.DB.rollbackAllTransactions();
		
		if (_sessionID && _sessionLock) {
			Zotero.Sync.Server.unlock()
		}
		
		throw(e);
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




Zotero.Sync.Server.Data = new function() {
	this.processUpdatedXML = processUpdatedXML;
	this.buildUploadXML = buildUploadXML;
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
	
	function processUpdatedXML(xml, lastLocalSyncDate, uploadIDs) {
		if (xml.children().length() == 0) {
			Zotero.debug('No changes received from server');
			return Zotero.Sync.Server.Data.buildUploadXML(uploadIDs);
		}
		
		var remoteCreatorStore = {};
		var relatedItemsStore = {};
		
		Zotero.DB.beginTransaction();
		
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			if (!xml[types]) {
				continue;
			}
			
			var toSaveParents = [];
			var toSaveChildren = [];
			var toDeleteParents = [];
			var toDeleteChildren = [];
			var toReconcile = [];
			
			//
			// Handle modified objects
			//
			Zotero.debug("Processing remotely changed " + types);
			
			typeloop:
			for each(var xmlNode in xml[types][type]) {
				var localDelete = false;
				
				// Get local object with same id
				var obj = Zotero[Types].get(parseInt(xmlNode.@id));
				if (obj) {
					// Key match -- same item
					if (obj.key == xmlNode.@key.toString()) {
						var objDate = Zotero.Date.sqlToDate(obj.dateModified, true);
						
						// Local object has been modified since last sync
						if ((objDate > lastLocalSyncDate &&
									objDate < Zotero.Sync.Server.nextLocalSyncDate)
								// Check for object in updated array, since it might
								// have been modified during sync process, making its
								// date equal to Zotero.Sync.Server.nextLocalSyncDate
								// and therefore excluded above (example: an item
								// linked to a creator whose id changed)
								|| uploadIDs.updated[types].indexOf(obj.id) != -1) {
							
							// Merge and store related items, since CR doesn't
							// affect related items
							if (type == 'item') {
								// TODO: skip conflict if only related items changed
								
								var related = xmlNode.related.toString();
								related = related ? related.split(' ') : [];
								for each(var relID in obj.relatedItems) {
									if (related.indexOf(relID) == -1) {
										related.push(relID);
									}
								}
								if (related.length) {
									relatedItemsStore[obj.id] = related;
								}
								Zotero.Sync.Server.Data.removeMissingRelatedItems(xmlNode);
							}
							
							var remoteObj = Zotero.Sync.Server.Data['xmlTo' + Type](xmlNode);
							
							// Some types we don't bother to reconcile
							if (_noMergeTypes.indexOf(type) != -1) {
								if (obj.dateModified > remoteObj.dateModified) {
									Zotero.Sync.addToUpdated(uploadIDs.updated.items, obj.id);
									continue;
								}
								
								// Overwrite local below
							}
							// Mark other types for conflict resolution
							else {
								// Skip item if dateModified is the only modified
								// field (and no linked creators changed)
								if (type == 'item') {
									var diff = obj.diff(remoteObj, false, true);
									if (!diff) {
										// Check if creators changed
										var creatorsChanged = false;
										var creators = obj.getCreators();
										creators = creators.concat(remoteObj.getCreators());
										for each(var creator in creators) {
											if (remoteCreatorStore[obj.id]) {
												creatorsChanged = true;
												break;
											}
										}
										if (!creatorsChanged) {
											continue;
										}
									}
								}
								
								// Will be handled by item CR for now
								if (type == 'creator') {
									remoteCreatorStore[remoteObj.id] = remoteObj;
									continue;
								}
								
								if (type != 'item') {
									alert('Reconciliation unimplemented for ' + types);
									throw ('Reconciliation unimplemented for ' + types);
								}
								
								// TODO: order reconcile by parent/child?
								
								toReconcile.push([
									obj,
									remoteObj
								]);
								
								continue;
							}
						}
						
						// Overwrite local below
					}
					
					// Key mismatch -- different objects with same id,
					// so change id of local object
					else {
						var oldID = parseInt(xmlNode.@id);
						var newID = Zotero.ID.get(types, true);
						
						Zotero.debug("Changing " + type + " " + oldID + " id to " + newID);
						
						// Save changed object now to update other linked objects
						switch (type) {
							case 'item':
								obj.setField('itemID', newID);
								break;
								
							default:
								obj[type + 'ID'] = newID;
						}
						obj.save();
						
						// Update id in local updates array
						var index = uploadIDs.updated[types].indexOf(oldID);
						if (index == -1) {
							throw ("Local " + type + " " + oldID + " not in "
								+ "update array when changing id");
						}
						uploadIDs.updated[types][index] = newID;
						
						// Update id in local deletions array
						for (var i in uploadIDs.deleted[types]) {
							if (uploadIDs.deleted[types][i].id == oldID) {
								uploadIDs.deleted[types][i] = newID;
							}
						}
						
						// Add items linked to creators to updated array,
						// since their timestamps will be set to the
						// transaction timestamp
						//
						// Note: Don't need to change collection children or
						// related items, since they're stored as objects
						if (type == 'creator') {
							var linkedItems = obj.getLinkedItems();
							if (linkedItems) {
								Zotero.Sync.addToUpdated(uploadIDs.updated.items, linkedItems);
							}
						}
						
						uploadIDs.changed[types][oldID] = {
							oldID: oldID,
							newID: newID
						};
						
						obj = null;
					}
				}
				
				// Object doesn't exist locally
				else {
					// Check if object has been deleted locally
					for each(var pair in uploadIDs.deleted[types]) {
						if (pair.id != parseInt(xmlNode.@id) ||
								pair.key != xmlNode.@key.toString()) {
							continue;
						}
						
						// TODO: non-merged items
						
						if (type != 'item') {
							alert('Delete reconciliation unimplemented for ' + types);
							throw ('Delete reconciliation unimplemented for ' + types);
						}
						
						localDelete = true;
					}
				}
				
				// Temporarily remove and store related items that don't yet exist
				if (type == 'item') {
					var missing = Zotero.Sync.Server.Data.removeMissingRelatedItems(xmlNode);
					if (missing.length) {
						relatedItemsStore[xmlNode.@id] = missing;
					}
				}
				
				// Create or overwrite locally
				obj = Zotero.Sync.Server.Data['xmlTo' + Type](xmlNode, obj);
				
				if (localDelete) {
					// TODO: order reconcile by parent/child?
					
					toReconcile.push([
						'deleted',
						obj
					]);
				}
				// Child items have to be saved after parent items
				else if (type == 'item' && obj.getSource()) {
					toSaveChildren.push(obj);
				}
				else {
					toSaveParents.push(obj);
				}
				
				// Don't use assigned-but-unsaved ids for new ids
				Zotero.ID.skip(types, obj.id);
			}
			
			
			//
			// Handle deleted objects
			//
			if (xml.deleted && xml.deleted[types]) {
				Zotero.debug("Processing remotely deleted " + types);
				
				for each(var xmlNode in xml.deleted[types][type]) {
					var id = parseInt(xmlNode.@id);
					var obj = Zotero[Types].get(id);
					// Object can't be found
					if (!obj || obj.key != xmlNode.@key) {
						continue;
					}
					
					// Local object has been modified since last sync -- reconcile
					var now = Zotero.Date.sqlToDate(obj.dateModified, true);
					if (now >= lastLocalSyncDate) {
						// TODO: order reconcile by parent/child
						toReconcile.push([obj, 'deleted']);
					}
					// Local object hasn't been modified -- delete
					else {
						if (type == 'item' && obj.getSource()) {
							toDeleteChildren.push(id);
						}
						else {
							toDeleteParents.push(id);
						}
					}
				}
			}
			
			//
			// Reconcile objects that have changed locally and remotely
			//
			if (toReconcile.length) {
				var io = {
					dataIn: {
						captions: [
							// TODO: localize
							'Local Item',
							'Remote Item',
							'Merged Item'
						],
						objects: toReconcile
					}
				};
				
				if (type == 'item') {
					io.dataIn.changedCreators = remoteCreatorStore;
				}
				
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
				
				if (io.dataOut) {
					for each(var obj in io.dataOut) {
						// TODO: do we need to make sure item isn't already being saved?
						
						// Handle items deleted during merge
						if (obj.ref == 'deleted') {
							// Deleted item was remote
							if (obj.left != 'deleted') {
								if (type == 'item' && obj.left.getSource()) {
									toDeleteParents.push(obj.id);
								}
								else {
									toDeleteChildren.push(obj.id);
								}
								
								if (relatedItemsStore[obj.id]) {
									delete relatedItemsStore[obj.id];
								}
								
								uploadIDs.deleted[types].push({
									id: obj.id,
									key: obj.left.key
								});
							}
							continue;
						}
						
						if (type == 'item' && obj.ref.getSource()) {
							toSaveParents.push(obj.ref);
						}
						else {
							toSaveChildren.push(obj.ref);
						}
						
						// Don't use assigned-but-unsaved ids for new ids
						Zotero.ID.skip(types, obj.id);
						
						// Item had been deleted locally, so remove from
						// deleted array
						if (obj.left == 'deleted') {
							Zotero.Sync.removeFromDeleted(uploadIDs.deleted[types], obj.id, obj.ref.key);
						}
						
						// TODO: only upload if the local item was chosen
						// or remote item was changed
						
						Zotero.Sync.addToUpdated(uploadIDs.updated[types], obj.id);
					}
				}
				else {
					Zotero.DB.rollbackTransaction();
					return false;
				}
			}
			
			if (type == 'collection') {
				// Sort collections in order of parent collections,
				// so referenced parent collections always exist when saving
				var cmp = function (a, b) {
					var pA = a.parent;
					var pB = b.parent;
					if (pA == pB) {
						return 0;
					}
					return (pA < pB) ? -1 : 1;
				};
				toSaveParents.sort(cmp);
				
				// Temporarily remove and store subcollections before saving
				// since referenced collections may not exist yet
				var collections = [];
				for each(var obj in toSaveParents) {
					var colIDs = obj.getChildCollections(true);
					if (!colIDs.length) {
						continue;
					}
					// TODO: use exist(), like related items above
					obj.childCollections = [];
					collections.push({
						obj: obj,
						childCollections: colIDs
					});
				}
			}
			
			// Save objects
			Zotero.debug('Saving merged ' + types);
			for each(var obj in toSaveParents) {
				obj.save();
			}
			for each(var obj in toSaveChildren) {
				obj.save();
			}
			
			// Add back related items (which now exist)
			if (type == 'item') {
				for (var itemID in relatedItemsStore) {
					item = Zotero.Items.get(itemID);
					for each(var id in relatedItemsStore[itemID]) {
						item.addRelatedItem(id);
					}
					item.save();
				}
			}
			// Add back subcollections
			else if (type == 'collection') {
				for each(var collection in collections) {
					if (collection.collections) {
						collection.obj.childCollections = collection.collections;
						collection.obj.save();
					}
				}
			}
			
			
			// Delete
			Zotero.debug('Deleting merged ' + types);
			if (toDeleteChildren.length) {
				Zotero.Sync.EventListener.ignoreDeletions(type, toDeleteChildren);
				Zotero[Types].erase(toDeleteChildren);
				Zotero.Sync.EventListener.unignoreDeletions(type, toDeleteChildren);
			}
			if (toDeleteParents.length) {
				Zotero.Sync.EventListener.ignoreDeletions(type, toDeleteParents);
				Zotero[Types].erase(toDeleteParents);
				Zotero.Sync.EventListener.unignoreDeletions(type, toDeleteParents);
			}
		}
		
		var xmlstr = Zotero.Sync.Server.Data.buildUploadXML(uploadIDs);
		
		Zotero.DB.commitTransaction();
		
		return xmlstr;
	}
	
	
	/**
	 *  ids = {
	 *		updated: {
	 *			items: [123, 234, 345, 456],
	 *			creators: [321, 432, 543, 654]
	 *		},
	 *		changed: {
	 *			items: {
	 * 				oldID: { oldID: 1234, newID: 5678 }, ...
	 *			},
	 *			creators: {
	 *				oldID: { oldID: 1234, newID: 5678 }, ...
	 *			}
	 *		},
	 *		deleted: {
	 *			items: [
	 * 				{ id: 1234, key: ABCDEFGHIJKMNPQRSTUVWXYZ23456789 }, ...
	 *			],
	 *			creators: [
	 * 				{ id: 1234, key: ABCDEFGHIJKMNPQRSTUVWXYZ23456789 }, ...
	 *			]
	 *		}
	 *	};
	 */
	function buildUploadXML(ids) {
		var xml = <data/>
		
		// Add API version attribute
		xml.@version = Zotero.Sync.Server.apiVersion;
		
		
		// Updates
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			if (!ids.updated[types]) {
				continue;
			}
			
			Zotero.debug("Processing locally changed " + types);
			
			switch (type) {
				// Items.get() can take multiple ids,
				// so we handle them differently
				case 'item':
					var objs = Zotero[Types].get(ids.updated[types]);
					for each(var obj in objs) {
						xml[types][type] += this[type + 'ToXML'](obj);
					}
					break;
					
				default:
					for each(var id in ids.updated[types]) {
						var obj = Zotero[Types].get(id);
						xml[types][type] += this[type + 'ToXML'](obj);
					}
			}
		}
		
		// TODO: handle changed ids
		
		// Deletions
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			if (!ids.deleted[types]) {
				continue;
			}
			
			Zotero.debug('Processing locally deleted ' + types);
			
			for each(var obj in ids.deleted[types]) {
				var deletexml = new XML('<' + type + '/>');
				deletexml.@id = obj.id;
				deletexml.@key = obj.key;
				xml.deleted[types][type] += deletexml;
			}
		}
		
		var xmlstr = xml.toXMLString();
		if (xmlstr.match('<data version="[0-9]+"/>')) {
			return '';
		}
		
		return xmlstr;
	}
	
	
	/**
	 * Converts a Zotero.Item object to an E4X <item> object
	 */
	function itemToXML(item) {
		var xml = <item/>;
		var item = item.serialize();
		
		// Primary fields
		for (var field in item.primary) {
			switch (field) {
				case 'itemID':
					var attr = 'id';
					break;
					
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
			var newField = <field>{item.fields[field]}</field>;
			newField.@name = field;
			xml.field += newField;
		}
		
		if (item.primary.itemType == 'note' || item.primary.itemType == 'attachment') {
			if (item.sourceItemID) {
				xml.@sourceItemID = item.sourceItemID;
			}
		}
		
		// Note
		if (item.primary.itemType == 'note') {
			var note = <note>{item.note}</note>;
			xml.note += note;
		}
		
		// Attachment
		if (item.primary.itemType == 'attachment') {
			xml.@linkMode = item.attachment.linkMode;
			xml.@mimeType = item.attachment.mimeType;
			xml.@charset = item.attachment.charset;
			
			// Don't include paths for links
			if (item.attachment.linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				var path = <path>{item.attachment.path}</path>;
				xml.path += path;
			}
			
			if (item.note) {
				var note = <note>{item.note}</note>;
				xml.note += note;
			}
		}
		
		// Creators
		for (var index in item.creators) {
			var newCreator = <creator/>;
			newCreator.@id = item.creators[index].creatorID;
			newCreator.@creatorType = item.creators[index].creatorType;
			newCreator.@index = index;
			xml.creator += newCreator;
		}
		
		// Related items
		if (item.related.length) {
			xml.related = item.related.join(' ');
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
			if (skipPrimary) {
				item = new Zotero.Item;
			}
			else {
				item = new Zotero.Item(parseInt(xmlItem.@id));
				/*
				if (item.exists()) {
					_error("Item specified in XML node already exists "
						+ "in Zotero.Sync.Server.Data.xmlToItem()");
				}
				*/
			}
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing item in "
					+ "Zotero.Sync.Server.Data.xmlToItem()");
		}
		
		// TODO: add custom item types
		
		var data = {
			itemTypeID: Zotero.ItemTypes.getID(xmlItem.@itemType.toString())
		};
		if (!skipPrimary) {
			data.dateAdded = xmlItem.@dateAdded.toString();
			data.dateModified = xmlItem.@dateModified.toString();
			data.key = xmlItem.@key.toString();
		}
		
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
		
		// Item creators
		var i = 0;
		for each(var creator in xmlItem.creator) {
			var pos = parseInt(creator.@index);
			if (pos != i) {
				throw ('No creator in position ' + i);
			}
			
			item.setCreator(
				pos,
				Zotero.Creators.get(parseInt(creator.@id)),
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
			var sourceItemID = parseInt(xmlItem.@sourceItemID);
			item.setSource(sourceItemID ? sourceItemID : false);
			item.setNote(xmlItem.note.toString());
		}
		
		// Attachment metadata
		if (item.isAttachment()) {
			item.attachmentLinkMode = parseInt(xmlItem.@linkMode);
			item.attachmentMIMEType = xmlItem.@mimeType;
			item.attachmentCharset = parseInt(xmlItem.@charsetID);
			if (item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) { 
				item.attachmentPath = xmlItem.path.toString();
			}
		}
		
		// Related items
		var related = xmlItem.related.toString();
		item.relatedItems = related ? related.split(' ') : [];
		
		return item;
	}
	
	
	function removeMissingRelatedItems(xmlNode) {
		var missing = [];
		var related = xmlNode.related.toString();
		var relIDs = related ? related.split(' ') : [];
		if (relIDs.length) {
			var exist = Zotero.Items.exist(relIDs);
			for each(var id in relIDs) {
				if (exist.indexOf(id) == -1) {
					missing.push(id);
				}
			}
			xmlNode.related = exist.join(' ');
		}
		return missing;
	}
	
	
	function collectionToXML(collection) {
		var xml = <collection/>;
		
		xml.@id = collection.id;
		xml.@name = collection.name;
		xml.@dateModified = collection.dateModified;
		xml.@key = collection.key;
		if (collection.parent) {
			xml.@parent = collection.parent;
		}
		
		var children = collection.getChildren();
		if (children) {
			xml.collections = '';
			xml.items = '';
			for each(var child in children) {
				if (child.type == 'collection') {
					xml.collections = xml.collections ?
						xml.collections + ' ' + child.id : child.id;
				}
				else if (child.type == 'item') {
					xml.items = xml.items ?
						xml.items + ' ' + child.id : child.id;
				}
			}
			if (xml.collections == '') {
				delete xml.collections;
			}
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
			if (skipPrimary) {
				collection = new Zotero.Collection(null);
			}
			else {
				collection = new Zotero.Collection(parseInt(xmlCollection.@id));
				/*
				if (collection.exists()) {
					throw ("Collection specified in XML node already exists "
						+ "in Zotero.Sync.Server.Data.xmlToCollection()");
				}
				*/
			}
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing collection in "
					+ "Zotero.Sync.Server.Data.xmlToCollection()");
		}
		
		collection.name = xmlCollection.@name.toString();
		if (!skipPrimary) {
			collection.parent = xmlCollection.@parent.toString() ?
				parseInt(xmlCollection.@parent) : false;
			collection.dateAdded = xmlCollection.@dateAdded.toString();
			collection.dateModified = xmlCollection.@dateModified.toString();
			collection.key = xmlCollection.@key.toString();
		}
		
		// Subcollections
		var str = xmlCollection.collections.toString();
		collection.childCollections = str == '' ? [] : str.split(' ');
		
		// Child items
		var str = xmlCollection.items.toString();
		collection.childItems = str == '' ? [] : str.split(' ');
		
		return collection;
	}
	
	
	/**
	 * Converts a Zotero.Creator object to an E4X <creator> object
	 */
	function creatorToXML(creator) {
		var xml = <creator/>;
		var creator = creator.serialize();
		for (var field in creator.primary) {
			switch (field) {
				case 'creatorID':
					var attr = 'id';
					break;
					
				default:
					var attr = field;
			}
			xml['@' + attr] = creator.primary[field];
		}
		
		var allowEmpty = ['firstName', 'lastName', 'name'];
		
		for (var field in creator.fields) {
			if (!creator.fields[field] && allowEmpty.indexOf(field) == -1) {
				continue;
			}
			xml[field] = creator.fields[field];
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
			if (skipPrimary) {
				creator = new Zotero.Creator(null);
			}
			else {
				creator = new Zotero.Creator(parseInt(xmlCreator.@id));
				/*
				if (creator.exists()) {
					throw ("Creator specified in XML node already exists "
						+ "in Zotero.Sync.Server.Data.xmlToCreator()");
				}
				*/
			}
		}
		else if (skipPrimary) {
			throw ("Cannot use skipPrimary with existing creator in "
					+ "Zotero.Sync.Server.Data.xmlToCreator()");
		}
		
		var data = {
			birthYear: xmlCreator.birthYear.toString()
		};
		if (!skipPrimary) {
			data.dateAdded = xmlCreator.@dateAdded.toString();
			data.dateModified = xmlCreator.@dateModified.toString();
			data.key = xmlCreator.@key.toString();
		}
		
		if (xmlCreator.fieldMode == 1) {
			data.firstName = '';
			data.lastName = xmlCreator.name.toString();
			data.fieldMode = 1;
		}
		else {
			data.firstName = xmlCreator.firstName.toString();
			data.lastName = xmlCreator.lastName.toString();
			data.fieldMode = 0;
		}
		
		creator.setFields(data);
		
		return creator;
	}
	
	
	function searchToXML(search) {
		var xml = <search/>;
		
		xml.@id = search.id;
		xml.@name = search.name;
		xml.@dateModified = search.dateModified;
		xml.@key = search.key;
		
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
				conditionXML.@value = condition.value;
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
			if (skipPrimary) {
				search = new Zotero.Search(null);
			}
			else {
				search = new Zotero.Search(parseInt(xmlSearch.@id));
				/*
				if (search.exists()) {
					throw ("Search specified in XML node already exists "
						+ "in Zotero.Sync.Server.Data.xmlToSearch()");
				}
				*/
			}
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing search in "
					+ "Zotero.Sync.Server.Data.xmlToSearch()");
		}
		
		search.name = xmlSearch.@name.toString();
		if (!skipPrimary) {
			search.dateAdded = xmlSearch.@dateAdded.toString();
			search.dateModified = xmlSearch.@dateModified.toString();
			search.key = xmlSearch.@key.toString();
		}
		
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
		
		xml.@id = tag.id;
		xml.@name = tag.name;
		if (tag.type) {
			xml.@type = tag.type;
		}
		xml.@dateModified = tag.dateModified;
		xml.@key = tag.key;
		var linkedItems = tag.getLinkedItems(true);
		if (linkedItems) {
			xml.items = linkedItems.join(' ');
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
			if (skipPrimary) {
				tag = new Zotero.Tag;
			}
			else {
				tag = new Zotero.Tag(parseInt(xmlTag.@id));
				/*
				if (tag.exists()) {
					throw ("Tag specified in XML node already exists "
						+ "in Zotero.Sync.Server.Data.xmlToTag()");
				}
				*/
			}
		}
		else if (skipPrimary) {
			throw ("Cannot use new id with existing tag in "
					+ "Zotero.Sync.Server.Data.xmlToTag()");
		}
		
		tag.name = xmlTag.@name.toString();
		tag.type = parseInt(xmlTag.@type);
		if (!skipPrimary) {
			tag.dateModified = xmlTag.@dateModified.toString();
			tag.key = xmlTag.@key.toString();
		}
		
		var str = xmlTag.items ? xmlTag.items.toString() : false;
		tag.linkedItems = str ? str.split(' ') : [];
		
		return tag;
	}
}
