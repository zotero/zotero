Zotero.Sync.Storage = new function () {
	//
	// Constants
	//
	this.SYNC_STATE_TO_UPLOAD = 0;
	this.SYNC_STATE_TO_DOWNLOAD = 1;
	this.SYNC_STATE_IN_SYNC = 2;
	this.SYNC_STATE_FORCE_UPLOAD = 3;
	this.SYNC_STATE_FORCE_DOWNLOAD = 4;
	
	this.SUCCESS = 1;
	this.ERROR_NO_URL = -1;
	this.ERROR_NO_PASSWORD = -3;
	this.ERROR_OFFLINE = -4;
	this.ERROR_UNREACHABLE = -5;
	this.ERROR_SERVER_ERROR = -6;
	this.ERROR_NOT_DAV = -7;
	this.ERROR_BAD_REQUEST = -8;
	this.ERROR_AUTH_FAILED = -9;
	this.ERROR_FORBIDDEN = -10;
	this.ERROR_PARENT_DIR_NOT_FOUND = -11;
	this.ERROR_ZOTERO_DIR_NOT_FOUND = -12;
	this.ERROR_ZOTERO_DIR_NOT_WRITABLE = -13;
	this.ERROR_NOT_ALLOWED = -14;
	this.ERROR_UNKNOWN = -15;
	
	//
	// Public properties
	//
	
	/**
	 * URI of Zotero directory on storage server
	 *
	 * @return	{nsIURI}		nsIURI of data directory, with spec ending in '/'
	 */
	this.__defineGetter__('rootURI', function () {
		if (_rootURI) {
			return _rootURI.clone()
		}
		
		var spec = Zotero.Prefs.get('sync.storage.url');
		if (!spec) {
			var msg = "Zotero storage URL not provided";
			Zotero.debug(msg);
			throw ({
				message: msg,
				name: "Z_ERROR_NO_URL",
				filename: "storage.js",
				toString: function () { return this.message; }
			});
		}
		var username = Zotero.Sync.Storage.username;
		var password = Zotero.Sync.Storage.password;
		if (username && !password) {
			var msg = "Zotero storage password not provided";
			Zotero.debug(msg);
			throw ({
				message: msg,
				name: "Z_ERROR_NO_PASSWORD",
				filename: "storage.js",
				toString: function () { return this.message; }
			});
		}
		
		var protocol = Zotero.Prefs.get('sync.storage.protocol');
		switch (protocol) {
			case 'webdav':
				var scheme = "http";
				break;
			
			case 'webdavs':
				var scheme = "https";
				break;
			
			default:
				throw ("Invalid storage protocol '" + protocol
					+ "' in Zotero.Sync.Storage.rootURI");
		}
		
		spec = scheme + '://' + spec + '/zotero/';
		
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
					getService(Components.interfaces.nsIIOService);
		try {
			var uri = ios.newURI(spec, null, null);
			if (username) {
				uri.username = username;
				uri.password = password;
			}
		}
		catch (e) {
			Zotero.debug(e);
			Components.utils.reportError(e);
			return false;
		}
		_rootURI = uri;
		return _rootURI.clone();

		
		return ;
	});
	
	this.__defineGetter__('username', function () {
		return Zotero.Prefs.get('sync.storage.username');
	});
	
	this.__defineGetter__('password', function () {
		var username = this.username;
		
		if (!username) {
			Zotero.debug('Username not set before setting Zotero.Sync.Storage.password');
			return '';
		}
		
		if (_cachedCredentials.username && _cachedCredentials.username == username) {
			return _cachedCredentials.password;
		}
		
		Zotero.debug('Getting Zotero storage password');
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		
		// Find user from returned array of nsILoginInfo objects
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == username) {
				_cachedCredentials.username = username;
				_cachedCredentials.password = logins[i].password;
				return logins[i].password;
			}
		}
		
		return '';
	});
	
	this.__defineSetter__('password', function (password) {
		_rootURI = false;
		
		var username = this.username;
		if (!username) {
			Zotero.debug('Username not set before setting Zotero.Sync.Server.password');
			return;
		}
		
		_cachedCredentials = {};
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, _loginManagerHost, _loginManagerURL, null);
		
		for (var i = 0; i < logins.length; i++) {
			Zotero.debug('Clearing Zotero storage passwords');
			loginManager.removeLogin(logins[i]);
			break;
		}
		
		if (password) {
			Zotero.debug('Setting Zotero storage password');
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
			var loginInfo = new nsLoginInfo(_loginManagerHost, _loginManagerURL,
				null, username, password, "", "");
			loginManager.addLogin(loginInfo);
			_cachedCredentials.username = username;
			_cachedCredentials.password = password;
		}
	});
	
	this.__defineGetter__('enabled', function () {
		return Zotero.Prefs.get("sync.storage.enabled");
	});
	
	this.__defineGetter__('verified', function () {
		return Zotero.Prefs.get("sync.storage.verified");
	});
	
	this.__defineGetter__('active', function () {
		return this.enabled && this.verified;
	});
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	
	this.compressionTracker = {
		compressed: 0,
		uncompressed: 0,
		get ratio() {
			return Math.round(
				(Zotero.Sync.Storage.compressionTracker.uncompressed - 
				Zotero.Sync.Storage.compressionTracker.compressed) /
				Zotero.Sync.Storage.compressionTracker.uncompressed * 100);
		}
	}
	
	//
	// Private properties
	//
	var _loginManagerHost = 'chrome://zotero';
	var _loginManagerURL = 'Zotero Storage Server';
	var _cachedCredentials = { username: null, password: null, authHeader: null };
	var _rootURI;
	var _syncInProgress;
	var _changesMade;
	var _finishCallback;
	
	
	//
	// Public methods
	//
	this.sync = function () {
		if (!Zotero.Sync.Storage.enabled) {
			Zotero.debug("Storage sync is not enabled");
			Zotero.Sync.Runner.reset();
			Zotero.Sync.Runner.next();
			return;
		}
		
		if (!Zotero.Sync.Storage.active) {
			Zotero.debug("Storage sync is not active");
			
			var callback = function (uri, status, authRequired) {
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				
				var success = Zotero.Sync.Storage.checkServerCallback(uri, status, authRequired, lastWin, true);
				if (success) {
					Zotero.debug("Storage sync is successfully set up");
					Zotero.Sync.Storage.sync();
				}
				else {
					Zotero.debug("Storage sync verification failed");
					Zotero.Sync.Runner.reset();
					Zotero.Sync.Runner.next();
				}
			}
			
			Zotero.Sync.Storage.checkServer(callback);
			return;
		}
		
		if (_syncInProgress) {
			_error("Storage sync operation already in progress");
		}
		
		Zotero.debug("Beginning storage sync");
		_syncInProgress = true;
		_changesMade = false;
		
		Zotero.Sync.Storage.checkForUpdatedFiles();
		
		var successFileCheckCallback = function (lastSyncTime) {
			var downloadFiles = true;
			if (lastSyncTime) {
				var sql = "SELECT version FROM version WHERE schema='storage'";
				var version = Zotero.DB.valueQuery(sql);
				if (version == lastSyncTime) {
					Zotero.debug("Last storage sync time hasn't changed -- skipping file download step");
					downloadFiles = false;
				}
			}
			
			var activeDown = downloadFiles ? Zotero.Sync.Storage.downloadFiles() : false;
			var activeUp = Zotero.Sync.Storage.uploadFiles();
			if (!activeDown && !activeUp) {
				_syncInProgress = false;
				Zotero.Sync.Runner.reset();
				Zotero.Sync.Runner.next();
			}
		};
		
		// If authorization header isn't cached, cache it before proceeding,
		// since during testing Firefox 3.0.1 was being a bit amnesic with auth
		// info for subsequent requests -- surely a better way to fix this
		if (!_cachedCredentials.authHeader) {
			Zotero.Utilities.HTTP.doOptions(Zotero.Sync.Storage.rootURI, function (req) {
				var authHeader = Zotero.Utilities.HTTP.getChannelAuthorization(req.channel);
				if (authHeader) {
					_cachedCredentials.authHeader = authHeader;
				}
				
				_getSuccessFileTimestamp(successFileCheckCallback);
			});
			return;
		}
		
		_getSuccessFileTimestamp(successFileCheckCallback);
	}
	
	
	/**
	 * @param	{Integer}		itemID
	 */
	this.getSyncState = function (itemID) {
		var sql = "SELECT syncState FROM itemAttachments WHERE itemID=?";
		return Zotero.DB.valueQuery(sql, itemID);
	}
	
	
	/**
	 * @param	{Integer}		itemID
	 * @param	{Integer}		syncState		Constant from Zotero.Sync.Storage
	 */
	this.setSyncState = function (itemID, syncState) {
		switch (syncState) {
			case this.SYNC_STATE_TO_UPLOAD:
			case this.SYNC_STATE_TO_DOWNLOAD:
			case this.SYNC_STATE_IN_SYNC:
			case this.SYNC_STATE_FORCE_UPLOAD:
			case this.SYNC_STATE_FORCE_DOWNLOAD:
				break;
			
			default:
				_error("Invalid sync state '" + syncState
					+ "' in Zotero.Sync.Storage.setSyncState()");
		}
		
		var sql = "UPDATE itemAttachments SET syncState=? WHERE itemID=?";
		return Zotero.DB.valueQuery(sql, [syncState, itemID]);
	}
	
	
	/**
	 * @param	{Integer}			itemID
	 * @return	{Integer|NULL}					Mod time as Unix timestamp,
	 *												or NULL if never synced
	 */
	this.getSyncedModificationTime = function (itemID) {
		var sql = "SELECT storageModTime FROM itemAttachments WHERE itemID=?";
		var mtime = Zotero.DB.valueQuery(sql, itemID);
		if (mtime === false) {
			_error("Item " + itemID
				+ " not found in Zotero.Sync.Storage.getSyncedModificationTime()");
		}
		return mtime;
	}
	
	
	/**
	 * @param	{Integer}	itemID
	 * @param	{Integer}	mtime				File modification time as
	 *												Unix timestamp
	 * @param	{Boolean}	[updateItem=FALSE]	Update dateModified field of
	 *												attachment item
	 */
	this.setSyncedModificationTime = function (itemID, mtime, updateItem) {
		Zotero.DB.beginTransaction();
		
		var sql = "UPDATE itemAttachments SET storageModTime=? WHERE itemID=?";
		Zotero.DB.valueQuery(sql, [mtime, itemID]);
		
		if (updateItem) {
			// Update item date modified so the new mod time will be synced
			var item = Zotero.Items.get(itemID);
			//var date = new Date(mtime * 1000);
			//item.setField('dateModified', Zotero.Date.dateToSQL(date, true));
			item.setField('dateModified', Zotero.DB.transactionDateTime);
			item.save();
		}
		
		Zotero.DB.commitTransaction();
	}
	
	
	/**
	 * Get mod time of file on storage server
	 *
	 * @param	{Zotero.Item}	item
	 * @param	{Function}		callback		Callback f(item, mdate)
	 */
	this.getStorageModificationTime = function (item, callback) {
		var uri = _getItemPropertyURI(item);
		var headers = _cachedCredentials.authHeader ?
			{ Authorization: _cachedCredentials.authHeader } : null;
		
		Zotero.Utilities.HTTP.doGet(uri, function (req) {
			var funcName = "Zotero.Sync.Storage.getStorageModificationTime()";
			
			// mod_speling can return 300s for 404s with base name matches
			if (req.status == 404 || req.status == 300) {
				callback(item, false);
				return;
			}
			else if (req.status != 200) {
				Zotero.debug(req.responseText);
				_error("Unexpected status code " + req.status + " in " + funcName);
			}
			
			Zotero.debug(req.responseText);
			
			var mtime = req.responseText;
			// No modification time set
			if (!mtime) {
				callback(item, false);
				return;
			}
			
			var mdate = new Date(mtime * 1000);
			callback(item, mdate);
		}, headers);
	}
	
	
	/**
	 * Set mod time of file on storage server
	 *
	 * @param	{Zotero.Item}	item
	 * @param	{Function}		callback		Callback f(item, mtime)
	 */
	this.setStorageModificationTime = function (item, callback) {
		var uri = _getItemPropertyURI(item);
		var headers = _cachedCredentials.authHeader ?
			{ Authorization: _cachedCredentials.authHeader } : null;
		
		Zotero.Utilities.HTTP.WebDAV.doPut(uri, item.attachmentModificationTime + '', function (req) {
			switch (req.status) {
				case 200:
				case 201:
				case 204:
					break;
				
				default:
					Zotero.debug(req.responseText);
					throw ("Unexpected status code " + req.status + " in "
						+ "Zotero.Sync.Storage.setStorageModificationTime()");
			}
			callback(item, item.attachmentModificationTime);
		}, headers);
	}
	
	
	/**
	 * Check if modification time of file on disk matches the mod time
	 * in the database
	 *
	 * @param	{Integer}	itemID
	 * @return	{Boolean}
	 */
	this.isFileModified = function (itemID) {
		var item = Zotero.Items.get(itemID);
		if (!item.getFile()) {
			return false;
		}
		
		var fileModTime = item.attachmentModificationTime;
		if (!fileModTime) {
			return false;
		}
		
		var syncModTime = Zotero.Sync.Storage.getSyncedModificationTime(itemID);
		if (fileModTime != syncModTime) {
			return true;
		}
		
		return false;
	}
	
	
	/**
	 * Scans local files and marks any that have changed as 0 for uploading
	 * and any that are missing as 1 for downloading
	 *
	 * Also marks missing files for downloading
	 *
	 * @param	{Integer[]}	itemIDs			An optional set of item ids to check
	 * @param	{Object}	itemModTimes	Item mod times indexed by item ids
	 *											appearing in itemIDs; if set,
	 *											items with stored mod times
	 *											that differ from the provided
	 *											time but file mod times
	 *											matching the stored time will
	 *											be marked for download
	 * @return	{Boolean}					TRUE if any items changed state,
	 *											FALSE otherwise
	 */
	this.checkForUpdatedFiles = function (itemIDs, itemModTimes) {
		Zotero.debug("Checking for locally changed attachment files");
		// check for current ops?
		
		if (itemModTimes && !itemIDs) {
			_error("itemModTimes can only be set if itemIDs is an array "
				+ "in Zotero.Sync.Storage.checkForUpdatedFiles()");
		}
		
		var changed = false;
		
		if (!itemIDs) {
			itemIDs = [];
		}
		
		// Can only handle 999 bound parameters at a time
		var numIDs = itemIDs.length;
		var maxIDs = 990;
		var done = 0;
		var rows = [];
		
		Zotero.DB.beginTransaction();
		
		do {
			var chunk = itemIDs.splice(0, maxIDs);
			var sql = "SELECT itemID, linkMode, path, storageModTime, syncState "
						+ "FROM itemAttachments JOIN items USING (itemID) "
						+ "WHERE linkMode IN (?,?) AND syncState IN (?,?) AND libraryID IS NULL";
			var params = [
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD,
				Zotero.Sync.Storage.SYNC_STATE_IN_SYNC
			];
			if (chunk.length) {
				sql += " AND itemID IN (" + chunk.map(function () '?').join() + ")";
				params = params.concat(chunk);
			}
			var chunkRows = Zotero.DB.query(sql, params);
			if (chunkRows) {
				rows = rows.concat(chunkRows);
			}
			done += chunk.length;
		}
		while (done < numIDs);
		
		if (!rows) {
			Zotero.debug("No to-upload or in-sync files found");
			Zotero.DB.commitTransaction();
			return changed;
		}
		
		// Index mtimes by item id
		var itemIDs = [];
		var attachmentData = {};
		for each(var row in rows) {
			var id = row.itemID;
			
			// In download-marking mode, ignore attachments whose
			// storage mod times haven't changed
			if (itemModTimes &&
					row.storageModTime == itemModTimes[id]) {
				Zotero.debug("Storage mod time (" + row.storageModTime
					+ ") hasn't changed for attachment " + id);
				continue;
			}
			itemIDs.push(id);
			attachmentData[id] = {
				linkMode: row.linkMode,
				path: row.path,
				mtime: row.storageModTime,
				state: row.syncState
			};
		}
		if (itemIDs.length == 0) {
			Zotero.DB.commitTransaction();
			return changed;
		}
		
		rows = undefined;
		
		var updatedStates = {};
		var items = Zotero.Items.get(itemIDs);
		for each(var item in items) {
			var file = item.getFile(attachmentData[item.id]);
			if (!file) {
				Zotero.debug("Marking attachment " + item.id + " as missing");
				updatedStates[item.id] =
					Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
				continue;
			}
			
			var fileModTime = Math.round(file.lastModifiedTime / 1000);
			
			//Zotero.debug("Stored mtime is " + attachmentData[item.id].mtime);
			//Zotero.debug("File mtime is " + fileModTime);
			
			if (itemModTimes) {
				Zotero.debug("Item mod time is " + itemModTimes[item.id]);
			}
			
			if (attachmentData[item.id].mtime != fileModTime) {
				if (attachmentData[item.id].state ==
						Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD) {
					continue;
				}
				Zotero.debug("Marking attachment " + item.id + " as changed ("
					+ attachmentData[item.id].mtime + " != " + fileModTime + ")");
				updatedStates[item.id] =
					Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD;
			}
			else if (itemModTimes) {
				Zotero.debug("Marking attachment " + item.id + " for download");
				updatedStates[item.id] =
					Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
			}
		}
		
		for (var itemID in updatedStates) {
			var sql = "UPDATE itemAttachments SET syncState=? WHERE itemID=?";
			Zotero.DB.query(
				sql,
				[
					updatedStates[itemID],
					itemID
				]
			);
			changed = true;
		}
		
		if (!changed) {
			Zotero.debug("No synced files have changed locally");
		}
		
		//throw ('foo');
		
		Zotero.DB.commitTransaction();
		return changed;
	}
	
	
	/**
	 * Starts download of all attachments marked for download
	 *
	 * @return	{Boolean}
	 */
	this.downloadFiles = function () {
		if (!_syncInProgress) {
			_syncInProgress = true;
		}
		
		var downloadFileIDs = _getFilesToDownload();
		if (!downloadFileIDs) {
			Zotero.debug("No files to download");
			return false;
		}
		
		// Check for active operations?
		var queue = Zotero.Sync.Storage.QueueManager.get('download');
		if (queue.isRunning()) {
			throw ("Download queue already running in "
					+ "Zotero.Sync.Storage.downloadFiles()");
		}
		queue.reset();
		
		for each(var itemID in downloadFileIDs) {
			var item = Zotero.Items.get(itemID);
			if (Zotero.Sync.Storage.getSyncState(itemID) !=
						Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD
					&& this.isFileModified(itemID)) {
				Zotero.debug("File for attachment " + itemID + " has been modified");
				this.setSyncState(itemID, this.SYNC_STATE_TO_UPLOAD);
				continue;
			}
			
			var request = new Zotero.Sync.Storage.Request(
				item.key, Zotero.Sync.Storage.downloadFile
			);
			queue.addRequest(request);
		}
		
		// Start downloads
		queue.start();
		return true;
	}
	
	
	/**
	 * Begin download process for individual file
	 *
	 * @param	{Zotero.Sync.Storage.Request}	[request]
	 */
	this.downloadFile = function (request) {
		var key = request.name;
		var item = Zotero.Items.getByLibraryAndKey(null, key);
		if (!item) {
			_error("Item '" + key
						+ "' not found in Zotero.Sync.Storage.downloadFile()");
		}
		
		// Retrieve modification time from server to store locally afterwards 
		Zotero.Sync.Storage.getStorageModificationTime(item, function (item, mdate) {
			if (!request.isRunning()) {
				Zotero.debug("Download request '" + request.name
					+ "' is no longer running after getting mod time");
				return;
			}
			
			if (!mdate) {
				Zotero.debug("Remote file not found for item " + item.key);
				request.finish();
				return;
			}
			
			try {
				var syncModTime = Zotero.Date.toUnixTimestamp(mdate);
				
				// Skip download if local file exists and matches mod time
				var file = item.getFile();
				if (file && file.exists()
						&& syncModTime == Math.round(file.lastModifiedTime / 1000)) {
					Zotero.debug("Stored file mod time matches remote file -- skipping download");
					
					Zotero.DB.beginTransaction();
					var syncState = Zotero.Sync.Storage.getSyncState(item.id);
					var updateItem = syncState != 1;
					Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, true);
					Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
					Zotero.DB.commitTransaction();
					_changesMade = true;
					request.finish();
					return;
				}
				
				var uri = _getItemURI(item);
				var destFile = Zotero.getTempDirectory();
				destFile.append(item.key + '.zip.tmp');
				if (destFile.exists()) {
					destFile.remove(false);
				}
				
				var listener = new Zotero.Sync.Storage.StreamListener(
					{
						onProgress: function (a, b, c) {
							request.onProgress(a, b, c)
						},
						onStop: _processDownload,
						request: request,
						item: item,
						syncModTime: syncModTime
					}
				);
				
				Zotero.debug('Saving with saveURI()');
				const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
				var wbp = Components
					.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(nsIWBP);
				wbp.persistFlags = nsIWBP.PERSIST_FLAGS_BYPASS_CACHE;
				
				wbp.progressListener = listener;
				wbp.saveURI(uri, null, null, null, null, destFile);
			}
			catch (e) {
				request.error(e);
			}
		});
	}
	
	
	/**
	 * Start upload of all attachments marked for upload
	 *
	 * If mod time on server doesn't match file, display conflict window
	 *
	 * @return	{Boolean}
	 */
	this.uploadFiles = function () {
		if (!_syncInProgress) {
			_syncInProgress = true;
		}
		
		var uploadFileIDs = _getFilesToUpload();
		if (!uploadFileIDs) {
			Zotero.debug("No files to upload");
			return false;
		}
		
		// Check for active operations?
		var queue = Zotero.Sync.Storage.QueueManager.get('upload');
		if (queue.isRunning()) {
			throw ("Upload queue already running in "
					+ "Zotero.Sync.Storage.uploadFiles()");
		}
		queue.reset();
		
		Zotero.debug(uploadFileIDs.length + " file(s) to upload");
		
		for each(var itemID in uploadFileIDs) {
			var item = Zotero.Items.get(itemID);
			
			var request = new Zotero.Sync.Storage.Request(
				item.key, Zotero.Sync.Storage.uploadFile
			);
			request.progressMax = Zotero.Attachments.getTotalFileSize(item, true);
			queue.addRequest(request);
		}
		
		// Start uploads
		queue.start();
		return true;
	}
	
	
	this.uploadFile = function (request) {
		_createUploadFile(request);
	}
	
	
	/**
	 * Remove files on storage server that were deleted locally more than
	 * sync.storage.deleteDelayDays days ago
	 *
	 * @param	{Function}	callback		Passed number of files deleted
	 */
	this.purgeDeletedStorageFiles = function (callback) {
		Zotero.debug("Purging deleted storage files");
		var files = _getDeletedFiles();
		if (!files) {
			Zotero.debug("No files to delete remotely");
			return;
		}
		
		// Add .zip extension
		var files = files.map(function (file) file + ".zip");
		
		_deleteStorageFiles(files, function (results) {
			// Remove deleted and nonexistent files from storage delete log
			var toPurge = results.deleted.concat(results.missing);
			if (toPurge.length > 0) {
				var done = 0;
				var maxFiles = 999;
				var numFiles = toPurge.length;
				
				Zotero.DB.beginTransaction();
				
				do {
					var chunk = toPurge.splice(0, maxFiles);
					var sql = "DELETE FROM storageDeleteLog WHERE key IN ("
						+ chunk.map(function () '?').join() + ")";
					Zotero.DB.query(sql, chunk);
					done += chunk.length;
				}
				while (done < numFiles);
				
				Zotero.DB.commitTransaction();
			}
			
			if (callback) {
				callback(results.deleted.length);
			}
		});
	}
	
	
	/**
	 * Delete orphaned storage files older than a day before last sync time
	 *
	 * @param	{Function}	callback	
	 */
	this.purgeOrphanedStorageFiles = function (callback) {
		const daysBeforeSyncTime = 1;
		
		Zotero.debug("Purging orphaned storage files");
		var uri = Zotero.Sync.Storage.rootURI;
		var path = uri.path;
		
		var prolog = '<?xml version="1.0" encoding="utf-8" ?>\n';
		var D = new Namespace("D", "DAV:");
		var nsDeclarations = 'xmlns:' + D.prefix + '=' + '"' + D.uri + '"';
		
		var requestXML = new XML('<D:propfind ' + nsDeclarations + '/>');
		requestXML.D::prop = '';
		requestXML.D::prop.D::getlastmodified = '';
		
		var xmlstr = prolog + requestXML.toXMLString();
		
		var lastSyncDate = new Date(Zotero.Sync.Server.lastLocalSyncTime * 1000);
		
		Zotero.Utilities.HTTP.WebDAV.doProp("PROPFIND", uri, xmlstr, function (req) {
			Zotero.debug(req.responseText);
				
			var funcName = "Zotero.Sync.Storage.purgeOrphanedStorageFiles()";
			
			// Strip XML declaration and convert to E4X
			var xml = new XML(req.responseText.replace(/<\?xml.*\?>/, ''));
			
			var deleteFiles = [];
			var trailingSlash = !!path.match(/\/$/);
			for each(var response in xml.D::response) {
				var href = response.D::href.toString();
				
				// Strip trailing slash if there isn't one on the root path
				if (!trailingSlash) {
					href = href.replace(/\/$/, "")
				}
				
				// Absolute
				if (href.match(/^https?:\/\//)) {
					var ios = Components.classes["@mozilla.org/network/io-service;1"].
								getService(Components.interfaces.nsIIOService);
					var href = ios.newURI(href, null, null);
					href = href.path;
				}
				
				if (href.indexOf(path) == -1
						// Try URL-encoded as well, in case there's a '~' or similar
						// character in the URL and the server (e.g., Sakai) is
						// encoding the value
						&& decodeURIComponent(href).indexOf(path) == -1) {
					_error("DAV:href '" + href
							+ "' does not begin with path '" + path + "' in " + funcName);
				}
				
				// Skip root URI
				if (href == path
						// Try URL-encoded as well, as above
						|| decodeURIComponent(href) == path) {
					continue;
				}
				
				var matches = href.match(/[^\/]+$/);
				if (!matches) {
					_error("Unexpected href '" + href + "' in " + funcName)
				}
				var file = matches[0];
				
				if (file.indexOf('.') == 0) {
					Zotero.debug("Skipping hidden file " + file);
					continue;
				}
				if (!file.match(/\.zip$/) && !file.match(/\.prop$/)) {
					Zotero.debug("Skipping file " + file);
					continue;
				}
				
				var key = file.replace(/\.(zip|prop)$/, '');
				var item = Zotero.Items.getByLibraryAndKey(null, key);
				if (item) {
					Zotero.debug("Skipping existing file " + file);
					continue;
				}
				
				Zotero.debug("Checking orphaned file " + file);
				
				// TODO: Parse HTTP date properly
				var lastModified = response..*::getlastmodified.toString();
				lastModified = Zotero.Date.strToISO(lastModified);
				lastModified = Zotero.Date.sqlToDate(lastModified);
				
				// Delete files older than a day before last sync time
				var days = (lastSyncDate - lastModified) / 1000 / 60 / 60 / 24;
				
				// DEBUG!!!!!!!!!!!!
				//
				// For now, delete all orphaned files immediately
				if (true) {
					deleteFiles.push(file);
				} else
				
				if (days > daysBeforeSyncTime) {
					deleteFiles.push(file);
				}
			}
			
			_deleteStorageFiles(deleteFiles, callback);
		},
		{ Depth: 1 });
	}
	
	
	/**
	 * Create a Zotero directory on the storage server
	 */
	this.createServerDirectory = function (callback) {
		var uri = this.rootURI;
		Zotero.Utilities.HTTP.WebDAV.doMkCol(uri, function (req) {
			Zotero.debug(req.responseText);
			Zotero.debug(req.status);
			
			switch (req.status) {
				case 201:
					callback(uri, Zotero.Sync.Storage.SUCCESS);
					break;
				
				case 401:
					callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
					return;
				
				case 403:
					callback(uri, Zotero.Sync.Storage.ERROR_FORBIDDEN);
					return;
				
				case 405:
					callback(uri, Zotero.Sync.Storage.ERROR_NOT_ALLOWED);
					return;
				
				case 500:
					callback(uri, Zotero.Sync.Storage.ERROR_SERVER_ERROR);
					return;
				
				default:
					callback(uri, Zotero.Sync.Storage.ERROR_UNKNOWN);
					return;
			}
		});
	}
	
	
	this.resetAllSyncStates = function (syncState) {
		if (!syncState) {
			syncState = this.SYNC_STATE_TO_UPLOAD;
		}
		
		switch (syncState) {
			case this.SYNC_STATE_TO_UPLOAD:
			case this.SYNC_STATE_TO_DOWNLOAD:
			case this.SYNC_STATE_IN_SYNC:
				break;
			
			default:
				throw ("Invalid sync state '" + syncState + "' in "
					+ "Zotero.Sync.Storage.resetAllSyncStates()");
		}
		
		var sql = "UPDATE itemAttachments SET syncState=? WHERE itemID IN "
					+ "(SELECT itemID FROM items WHERE libraryID IS NULL)";
		Zotero.DB.query(sql, [syncState]);
		
		var sql = "DELETE FROM version WHERE schema='storage'";
		Zotero.DB.query(sql);
	}
	
	
	this.clearSettingsCache = function () {
		_rootURI = undefined;
	}
	
	
	//
	// Private methods
	//
	
	
	/**
	 * Extract a downloaded ZIP file and update the database metadata
	 *
	 * This is called from Zotero.Sync.Server.StreamListener.onStopRequest()
	 *
	 * @param	{nsIRequest}		request
	 * @param	{Integer}		status		Status code from download listener
	 * @param	{String}			response
	 * @return	{Object}			data			Properties 'request', 'item', 'syncModTime'
	 */
	function _processDownload(request, status, response, data) {
		try {
			var funcName = "Zotero.Sync.Storage._processDownload()";
			
			var request = data.request;
			var item = data.item;
			var syncModTime = data.syncModTime;
			var zipFile = Zotero.getTempDirectory();
			zipFile.append(item.key + '.zip.tmp');
			
			Zotero.debug("Finished download of " + zipFile.path + " with status " + status);
			
			var zipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].
					createInstance(Components.interfaces.nsIZipReader);
			try {
				zipReader.open(zipFile);
				zipReader.test(null);
				
				Zotero.debug("ZIP file is OK");
			}
			catch (e) {
				Zotero.debug(zipFile.leafName + " is not a valid ZIP file", 2);
				if (zipFile.exists()) {
					zipFile.remove(false);
				}
				return;
			}
			
			var parentDir = Zotero.Attachments.getStorageDirectory(item.id);
			if (!parentDir.exists()) {
				Zotero.Attachments.createDirectoryForItem(item.id);
			}
			
			// Delete existing files
			var otherFiles = parentDir.directoryEntries;
			while (otherFiles.hasMoreElements()) {
				var file = otherFiles.getNext();
				file.QueryInterface(Components.interfaces.nsIFile);
				if (file.leafName[0] == '.' || file.equals(zipFile)) {
					continue;
				}
				
				// Firefox (as of 3.0.1) can't detect symlinks (at least on OS X),
				// so use pre/post-normalized path to check
				var origPath = file.path;
				var origFileName = file.leafName;
				file.normalize();
				if (origPath != file.path) {
					var msg = "Not deleting symlink '" + origFileName + "'";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				// This should be redundant with above check, but let's do it anyway
				if (!parentDir.contains(file, false)) {
					var msg = "Storage directory doesn't contain '" + file.leafName + "'";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				
				if (file.isFile()) {
					Zotero.debug("Deleting existing file " + file.leafName);
					file.remove(false);
				}
				else if (file.isDirectory()) {
					Zotero.debug("Deleting existing directory " + file.leafName);
					file.remove(true);
				}
			}
			
			var entries = zipReader.findEntries(null);
			while (entries.hasMore()) {
				var entryName = entries.getNext();
				var b64re = /%ZB64$/;
				if (entryName.match(b64re)) {
					var fileName = Zotero.Utilities.Base64.decode(
						entryName.replace(b64re, '')
					);
				}
				else {
					var fileName = entryName;
				}
				
				if (fileName.indexOf('.') == 0) {
					Zotero.debug("Skipping " + fileName);
					continue;
				}
				
				Zotero.debug("Extracting " + fileName);
				var destFile = parentDir.clone();
				destFile.QueryInterface(Components.interfaces.nsILocalFile);
				destFile.setRelativeDescriptor(parentDir, fileName);
				if (destFile.exists()) {
					var msg = "ZIP entry '" + fileName + "' "
						+ " already exists";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
				zipReader.extract(entryName, destFile);
				
				var origPath = destFile.path;
				var origFileName = destFile.leafName;
				destFile.normalize();
				if (origPath != destFile.path) {
					var msg = "ZIP file " + zipFile.leafName + " contained symlink '"
						+ origFileName + "'";
					Zotero.debug(msg, 1);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				destFile.permissions = 0644;
			}
			zipReader.close();
			zipFile.remove(false);
			
			var file = item.getFile();
			if (!file) {
				var msg = "File not found for item " + item.id + " after extracting ZIP";
				Zotero.debug(msg, 1);
				Components.utils.reportError(msg + " in " + funcName);
				return;
			}
			file.lastModifiedTime = syncModTime * 1000;
			
			Zotero.DB.beginTransaction();
			var syncState = Zotero.Sync.Storage.getSyncState(item.id);
			var updateItem = syncState != 1;
			Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
			Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
			Zotero.DB.commitTransaction();
			_changesMade = true;
		}
		finally {
			request.finish();
		}
	}
	
	
	/**
	 * Create zip file of attachment directory
	 *
	 * @param	{Zotero.Sync.Storage.Request}		request
	 * @return	{Boolean}							TRUE if zip process started,
	 *												FALSE if storage was empty
	 */
	function _createUploadFile(request) {
		var key = request.name;
		var item = Zotero.Items.getByLibraryAndKey(null, key);
		Zotero.debug("Creating zip file for item " + item.key);
		
		try {
			switch (item.attachmentLinkMode) {
				case Zotero.Attachments.LINK_MODE_LINKED_FILE:
				case Zotero.Attachments.LINK_MODE_LINKED_URL:
					throw (new Error(
						"Upload file must be an imported snapshot or file in "
							+ "Zotero.Sync.Storage.createUploadFile()"
					));
			}
			
			var dir = Zotero.Attachments.getStorageDirectoryByKey(key);
			
			var tmpFile = Zotero.getTempDirectory();
			tmpFile.append(item.key + '.zip');
			
			var zw = Components.classes["@mozilla.org/zipwriter;1"]
				.createInstance(Components.interfaces.nsIZipWriter);
			zw.open(tmpFile, 0x04 | 0x08 | 0x20); // open rw, create, truncate
			var fileList = _zipDirectory(dir, dir, zw);
			if (fileList.length == 0) {
				Zotero.debug('No files to add -- removing zip file');
				tmpFile.remove(null);
				request.finish();
				return false;
			}
			
			Zotero.debug('Creating ' + tmpFile.leafName + ' with ' + fileList.length + ' file(s)');
			
			var observer = new Zotero.Sync.Storage.ZipWriterObserver(
				zw, _processUploadFile, { request: request, files: fileList }
			);
			zw.processQueue(observer, null);
			return true;
		}
		catch (e) {
			request.error(e);
			return false;
		}
	}
	
	function _zipDirectory(rootDir, dir, zipWriter) {
		var fileList = [];
		dir = dir.directoryEntries;
		while (dir.hasMoreElements()) {
			var file = dir.getNext();
			file.QueryInterface(Components.interfaces.nsILocalFile);
			if (file.isDirectory()) {
				//Zotero.debug("Recursing into directory " + file.leafName);
				fileList.concat(_zipDirectory(rootDir, file, zipWriter));
				continue;
			}
			var fileName = file.getRelativeDescriptor(rootDir);
			if (fileName.indexOf('.') == 0) {
				Zotero.debug('Skipping file ' + fileName);
				continue;
			}
			
			//Zotero.debug("Adding file " + fileName);
			
			fileName = Zotero.Utilities.Base64.encode(fileName) + "%ZB64";
			zipWriter.addEntryFile(
				fileName,
				Components.interfaces.nsIZipWriter.COMPRESSION_DEFAULT,
				file,
				true
			);
			fileList.push(fileName);
		}
		return fileList;
	}
	
	
	/**
	 * Upload the generated ZIP file to the server
	 *
	 * @param	{Object}		Object with 'request' property
	 * @return	{void}
	 */
	function _processUploadFile(data) {
		/*
		_updateSizeMultiplier(
			(100 - Zotero.Sync.Storage.compressionTracker.ratio) / 100
		);
		*/
		
		var request = data.request;
		var item = Zotero.Items.getByLibraryAndKey(null, request.name);
		
		Zotero.Sync.Storage.getStorageModificationTime(item, function (item, mdate) {
			if (!request.isRunning()) {
				Zotero.debug("Upload request '" + request.name
					+ "' is no longer running after getting mod time");
				return;
			}
			
			try {
				// Check for conflict
				if (Zotero.Sync.Storage.getSyncState(item.id)
						!= Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD) {
					if (mdate) {
						var mtime = Zotero.Date.toUnixTimestamp(mdate);
						var smtime = Zotero.Sync.Storage.getSyncedModificationTime(item.id);
						// If file has been uploaded to storage server but there's
						// no local record of the time (e.g., due to a reset?),
						// use local file's time
						if (!smtime) {
							smtime = item.attachmentModificationTime;
						}
						
						if (smtime == mtime) {
							Zotero.debug("Stored file mod time matches remote file -- skipping upload");
							
							Zotero.DB.beginTransaction();
							var syncState = Zotero.Sync.Storage.getSyncState(item.id);
							Zotero.Sync.Storage.setSyncedModificationTime(item.id, smtime, true);
							Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
							Zotero.DB.commitTransaction();
							_changesMade = true;
							request.finish();
							return;
						}
						
						var localData = { modTime: smtime };
						var remoteData = { modTime: mtime };
						Zotero.Sync.Storage.QueueManager.addConflict(
							request.name, localData, remoteData
						);
						Zotero.debug("Conflict -- last synced file mod time "
							+ "does not match time on storage server"
							+ " (" + smtime + " != " + mtime + ")");
						request.finish();
						return;
					}
					else {
						Zotero.debug("Remote file not found for item " + item.id);
					}
				}
				
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				
				var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
							.createInstance(Components.interfaces.nsIFileInputStream);
				fis.init(file, 0x01, 0, 0);
				
				var bis = Components.classes["@mozilla.org/network/buffered-input-stream;1"]
							.createInstance(Components.interfaces.nsIBufferedInputStream)
				bis.init(fis, 64 * 1024);
				
				var uri = _getItemURI(item);
				
				var ios = Components.classes["@mozilla.org/network/io-service;1"].
							getService(Components.interfaces.nsIIOService);
				var channel = ios.newChannelFromURI(uri);
				channel.QueryInterface(Components.interfaces.nsIUploadChannel);
				channel.setUploadStream(bis, 'application/octet-stream', -1);
				channel.QueryInterface(Components.interfaces.nsIHttpChannel);
				channel.requestMethod = 'PUT';
				channel.allowPipelining = false;
				if (_cachedCredentials.authHeader) {
					channel.setRequestHeader(
						'Authorization', _cachedCredentials.authHeader, false
					);
				}
				channel.setRequestHeader('Keep-Alive', '', false);
				channel.setRequestHeader('Connection', '', false);
				
				var listener = new Zotero.Sync.Storage.StreamListener(
					{
						onProgress: function (a, b, c) {
							request.onProgress(a, b, c);
						},
						onStop: _onUploadComplete,
						onCancel: _onUploadCancel,
						request: request,
						item: item,
						streams: [fis, bis]
					}
				);
				channel.notificationCallbacks = listener;
				
				var dispURI = uri.clone();
				if (dispURI.password) {
					dispURI.password = '********';
				}
				Zotero.debug("HTTP PUT of " + file.leafName + " to " + dispURI.spec);
				
				channel.asyncOpen(listener, null);
			}
			catch (e) {
				request.error(e);
			}
		});
	}
	
	
	function _onUploadComplete(httpRequest, status, response, data) {
		var request = data.request;
		var item = data.item;
		var url = httpRequest.name;
		
		Zotero.debug("Upload of attachment " + item.key
			+ " finished with status code " + status);
		
		switch (status) {
			case 200:
			case 201:
			case 204:
				break;
			
			default:
				_error("Unexpected file upload status " + status
					+ " in Zotero.Sync.Storage._onUploadComplete()");
		}
		
		Zotero.Sync.Storage.setStorageModificationTime(item, function (item, mtime) {
			if (!request.isRunning()) {
				Zotero.debug("Upload request '" + request.name
					+ "' is no longer running after getting mod time");
				return;
			}
			
			Zotero.DB.beginTransaction();
			
			Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
			Zotero.Sync.Storage.setSyncedModificationTime(item.id, mtime, true);
			
			Zotero.DB.commitTransaction();
			
			try {
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				file.remove(false);
			}
			catch (e) {
				Components.utils.reportError(e);
			}
			
			_changesMade = true;
			request.finish();
		});
	}
	
	
	function _onUploadCancel(httpRequest, status, data) {
		var request = data.request;
		var item = data.item;
		
		Zotero.debug("Upload of attachment " + item.key
			+ " cancelled with status code " + status);
		
		try {
			var file = Zotero.getTempDirectory();
			file.append(item.key + '.zip');
			file.remove(false);
		}
		catch (e) {
			Components.utils.reportError(e);
		}
		
		request.finish();
	}
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToDownload() {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE syncState IN (?,?) AND libraryID IS NULL";
		return Zotero.DB.columnQuery(sql,
			[
				Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD,
				Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD
			]
		);
	}
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToUpload() {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE syncState IN (?,?) AND linkMode IN (?,?) AND libraryID IS NULL";
		return Zotero.DB.columnQuery(sql,
			[
				Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD,
				Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD,
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL
			]
		);
	}
	
	
	/**
	 * @inner
	 * @param	{Integer}	[days=pref:e.z.sync.storage.deleteDelayDays]
	 *									Number of days old files have to be
	 * @return	{String[]|FALSE}			Array of keys, or FALSE if none
	 */
	function _getDeletedFiles(days) {
		if (!days) {
			days = Zotero.Prefs.get("sync.storage.deleteDelayDays");
		}
		
		var ts = Zotero.Date.getUnixTimestamp();
		ts = ts - (86400 * days);
		
		var sql = "SELECT key FROM storageDeleteLog WHERE timestamp<?";
		return Zotero.DB.columnQuery(sql, ts);
	}
	
	
	/**
	 * @inner
	 * @param	{String[]}	files		Remote filenames to delete (e.g., ZIPs)
	 * @param	{Function}	callback		Passed object containing three arrays:
	 *										'deleted', 'missing', and 'error',
	 *										each containing filenames
	 */
	function _deleteStorageFiles(files, callback) {
		var results = {
			deleted: [],
			missing: [],
			error: []
		};
		
		if (files.length == 0) {
			if (callback) {
				callback(results);
			}
			return;
		}
		
		for (var i=0; i<files.length; i++) {
			let last = (i == files.length - 1);
			let fileName = files[i];
			
			let deleteURI = Zotero.Sync.Storage.rootURI;
			// This should never happen, but let's be safe
			if (!deleteURI.spec.match(/\/$/)) {
				callback(deleted);
				_error("Root URI does not end in slash in "
					+ "Zotero.Sync.Storage._deleteStorageFiles()");
			}
			deleteURI.QueryInterface(Components.interfaces.nsIURL);
			deleteURI.fileName = files[i];
			deleteURI.QueryInterface(Components.interfaces.nsIURI);
			Zotero.Utilities.HTTP.WebDAV.doDelete(deleteURI, function (req) {
				switch (req.status) {
					case 204:
					// IIS 5.1 and Sakai return 200
					case 200:
						var fileDeleted = true;
						break;
					
					case 404:
						var fileDeleted = false;
						break;
					
					default:
						if (last && callback) {
							callback(results);
						}
						
						results.error.push(fileName);
						var msg = "An error occurred attempting to delete "
							+ "'" + fileName
							+ "' (" + req.status + " " + req.statusText + ").";
						_error(msg);
						return;
				}
				
				// If an item file URI, get the property URI
				var deletePropURI = _getPropertyURIFromItemURI(deleteURI);
				if (!deletePropURI) {
					if (fileDeleted) {
						results.deleted.push(fileName);
					}
					else {
						results.missing.push(fileName);
					}
					if (last && callback) {
						callback(results);
					}
					return;
				}
				
				// If property file appears separately in delete queue,
				// remove it, since we're taking care of it here
				var propIndex = files.indexOf(deletePropURI.fileName);
				if (propIndex > i) {
					delete files[propIndex];
					i--;
					last = (i == files.length - 1);
				}
				
				// Delete property file
				Zotero.Utilities.HTTP.WebDAV.doDelete(deletePropURI, function (req) {
					switch (req.status) {
						case 204:
						// IIS 5.1 and Sakai return 200
						case 200:
							results.deleted.push(fileName);
							break;
						
						case 404:
							if (fileDeleted) {
								results.deleted.push(fileName);
							}
							else {
								results.missing.push(fileName);
							}
							break;
						
						default:
							var error = true;
					}
					
					if (last && callback) {
						callback(results);
					}
					
					if (error) {
						results.error.push(fileName);
						var msg = "An error occurred attempting to delete "
							+ "'" + fileName
							+ "' (" + req.status + " " + req.statusText + ").";
						_error(msg);
					}
				});
			});
		}
	}
	
	
	/**
	 * @param	{Function}	callback			Function to pass URI and result value to
	 * @param	{Object}		errorCallbacks
	 */
	this.checkServer = function (callback) {
		try {
			var uri = this.rootURI;
		}
		catch (e) {
			switch (e.name) {
				case 'Z_ERROR_NO_URL':
					callback(null, Zotero.Sync.Storage.ERROR_NO_URL);
					return;
				
				case 'Z_ERROR_NO_PASSWORD':
					callback(null, Zotero.Sync.Storage.ERROR_NO_PASSWORD);
					return;
					
				default:
					Zotero.debug(e);
					Components.utils.reportError(e);
					callback(null, Zotero.Sync.Storage.ERROR_UNKNOWN);
					return;
			}
		}
		
		var requestHolder = { request: null };
		
		var prolog = '<?xml version="1.0" encoding="utf-8" ?>\n';
		var D = new Namespace("D", "DAV:");
		var nsDeclarations = 'xmlns:' + D.prefix + '=' + '"' + D.uri + '"';
		
		var requestXML = new XML('<D:propfind ' + nsDeclarations + '/>');
		requestXML.D::prop = '';
		// IIS 5.1 requires at least one property in PROPFIND
		requestXML.D::prop.D::getcontentlength = '';
		
		var xmlstr = prolog + requestXML.toXMLString();
		
		// Test whether URL is WebDAV-enabled
		var request = Zotero.Utilities.HTTP.doOptions(uri, function (req) {
			Zotero.debug(req.status);
			
			// Timeout
			if (req.status == 0) {
				callback(uri, Zotero.Sync.Storage.ERROR_UNREACHABLE);
				return;
			}
			
			Zotero.debug(req.getAllResponseHeaders());
			Zotero.debug(req.responseText);
			Zotero.debug(req.status);
			
			switch (req.status) {
				case 400:
					callback(uri, Zotero.Sync.Storage.ERROR_BAD_REQUEST);
					return;
				
				case 401:
					callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
					return;
				
				case 403:
					callback(uri, Zotero.Sync.Storage.ERROR_FORBIDDEN);
					return;
				
				case 500:
					callback(uri, Zotero.Sync.Storage.ERROR_SERVER_ERROR);
					return;
			}
			
			var dav = req.getResponseHeader("DAV");
			if (dav == null) {
				callback(uri, Zotero.Sync.Storage.ERROR_NOT_DAV);
				return;
			}
			
			var headers = { Depth: 0 };
			
			var authHeader = Zotero.Utilities.HTTP.getChannelAuthorization(req.channel);
			if (authHeader) {
				_cachedCredentials.authHeader = authHeader;
				headers.Authorization = authHeader;
				// Create a version without Depth
				var authHeaders = { Authorization: authHeader };
				var authRequired = true;
			}
			else {
				var authRequired = false;
			}
			
			// Test whether Zotero directory exists
			Zotero.Utilities.HTTP.WebDAV.doProp("PROPFIND", uri, xmlstr, function (req) {
				Zotero.debug(req.responseText);
				Zotero.debug(req.status);
				
				switch (req.status) {
					case 207:
						// Test if Zotero directory is writable
						var testFileURI = uri.clone();
						testFileURI.spec += "zotero-test-file";
						Zotero.Utilities.HTTP.WebDAV.doPut(testFileURI, "", function (req) {
							Zotero.debug(req.responseText);
							Zotero.debug(req.status);
							
							switch (req.status) {
								case 200:
								case 201:
								case 204:
									// Delete test file
									Zotero.Utilities.HTTP.WebDAV.doDelete(
										testFileURI,
										function (req) {
											Zotero.debug(req.responseText);
											Zotero.debug(req.status);
											
											switch (req.status) {
												case 200: // IIS 5.1 and Sakai return 200
												case 204:
													callback(
														uri,
														Zotero.Sync.Storage.SUCCESS,
														!authRequired
													);
													return;
												
												case 401:
													callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
													return;
												
												case 403:
													callback(uri, Zotero.Sync.Storage.ERROR_FORBIDDEN);
													return;
												
												default:
													callback(uri, Zotero.Sync.Storage.ERROR_UNKNOWN);
													return;
											}
										}
									);
									return;
								
								case 401:
									callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
									return;
								
								case 403:
									callback(uri, Zotero.Sync.Storage.ERROR_FORBIDDEN);
									return;
								
								case 500:
									callback(uri, Zotero.Sync.Storage.ERROR_SERVER_ERROR);
									return;
								
								default:
									callback(uri, Zotero.Sync.Storage.ERROR_UNKNOWN);
									return;
							}
						});
						return;
					
					case 400:
						callback(uri, Zotero.Sync.Storage.ERROR_BAD_REQUEST);
						return;
					
					case 401:
						callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
						return;
					
					case 403:
						callback(uri, Zotero.Sync.Storage.ERROR_FORBIDDEN);
						return;
					
					case 404:
						var parentURI = uri.clone();
						parentURI.spec = parentURI.spec.replace(/zotero\/$/, '');
						
						// Zotero directory wasn't found, so see if at least
						// the parent directory exists
						Zotero.Utilities.HTTP.WebDAV.doProp("PROPFIND", parentURI, xmlstr,
							function (req) {
								Zotero.debug(req.responseText);
								Zotero.debug(req.status);
								
								switch (req.status) {
									// Parent directory existed
									case 207:
										callback(uri, Zotero.Sync.Storage.ERROR_ZOTERO_DIR_NOT_FOUND);
										return;
									
									case 400:
										callback(uri, Zotero.Sync.Storage.ERROR_BAD_REQUEST);
										return;
									
									case 401:
										callback(uri, Zotero.Sync.Storage.ERROR_AUTH_FAILED);
										return;
									
									// Parent directory wasn't found either
									case 404:
										callback(uri, Zotero.Sync.Storage.ERROR_PARENT_DIR_NOT_FOUND);
										return;
									
									default:
										callback(uri, Zotero.Sync.Storage.ERROR_UNKNOWN);
										return;
								}
							},  headers);
						return;
					
					case 500:
						callback(uri, Zotero.Sync.Storage.ERROR_SERVER_ERROR);
						return;
						
					default:
						callback(uri, Zotero.Sync.Storage.ERROR_UNKNOWN);
						return;
				}
			}, headers);
		});
		
		if (!request) {
			callback(uri, Zotero.Sync.Storage.ERROR_OFFLINE);
		}
		
		requestHolder.request = request;
		return requestHolder;
	}
	
	
	this.checkServerCallback = function (uri, status, authRequired, window, skipSuccessMessage) {
		var promptService =
			Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		if (uri) {
			var spec = uri.scheme + '://' + uri.hostPort + uri.path;
		}
		
		switch (status) {
			case Zotero.Sync.Storage.SUCCESS:
				if (!skipSuccessMessage) {
					promptService.alert(
						window,
						"Server configuration verified",
						"File storage is successfully set up."
					);
				}
				Zotero.Prefs.set("sync.storage.verified", true);
				return true;
			
			case Zotero.Sync.Storage.ERROR_NO_URL:
				var errorMessage = "Please enter a URL.";
				break;
			
			case Zotero.Sync.Storage.ERROR_NO_PASSWORD:
				var errorMessage = "Please enter a password.";
				break;
			
			case Zotero.Sync.Storage.ERROR_UNREACHABLE:
				var errorMessage = "The server " + uri.host + " could not be reached.";
				break;
			
			case Zotero.Sync.Storage.ERROR_NOT_DAV:
				var errorMessage = spec + " is not a valid WebDAV URL.";
				break;
			
			case Zotero.Sync.Storage.ERROR_AUTH_FAILED:
				var errorTitle = "Permission denied";
				var errorMessage = "The storage server did not accept the "
					+ "username and password you entered." + " "
					+ "Please check your storage settings "
					+ "or contact your server administrator.";
				break;
			
			case Zotero.Sync.Storage.ERROR_FORBIDDEN:
				var errorTitle = "Permission denied";
				var errorMessage = "You don't have permission to access "
					+ uri.path + " on the storage server." + " "
					+ "Please check your storage settings "
					+ "or contact your server administrator.";
				break;
			
			case Zotero.Sync.Storage.ERROR_PARENT_DIR_NOT_FOUND:
				var errorTitle = "Directory not found";
				var parentSpec = spec.replace(/\/zotero\/$/, "");
				var errorMessage = parentSpec + " does not exist.";
				break;
			
			case Zotero.Sync.Storage.ERROR_ZOTERO_DIR_NOT_FOUND:
				var create = promptService.confirmEx(
					window,
					// TODO: localize
					"Storage directory not found",
					spec + " does not exist.\n\nDo you want to create it now?",
					promptService.BUTTON_POS_0
						* promptService.BUTTON_TITLE_IS_STRING
					+ promptService.BUTTON_POS_1
						* promptService.BUTTON_TITLE_CANCEL,
					"Create",
					null, null, null, {}
				);
				
				if (create != 0) {
					return;
				}
				
				Zotero.Sync.Storage.createServerDirectory(function (uri, status) {
					switch (status) {
						case Zotero.Sync.Storage.SUCCESS:
							if (!skipSuccessMessage) {
								promptService.alert(
									window,
									"Server configuration verified",
									"File storage is successfully set up."
								);
							}
							Zotero.Prefs.set("sync.storage.verified", true);
							return true;
						
						case Zotero.Sync.Storage.ERROR_FORBIDDEN:
							var errorTitle = "Permission denied";
							var errorMessage = "You do not have "
								+ "permission to create a Zotero directory "
								+ "at the following address:" + "\n\n" + spec;
							errorMessage += "\n\n"
								+ "Please check your storage settings or "
								+ "contact your server administrator.";
							break;
					}
					
					// TEMP
					if (!errorMessage) {
						var errorMessage = status;
					}
					promptService.alert(window, errorTitle, errorMessage);
				});
				
				return false;
		}
		
		if (!errorTitle) {
			var errorTitle = Zotero.getString("general.error");
		}
		// TEMP
		if (!errorMessage) {
			var errorMessage = status;
		}
		promptService.alert(window, errorTitle, errorMessage);
		return false;
	}
	
	
	this.finish = function (cancelled, skipSuccessFile) {
		if (!_syncInProgress) {
			throw ("Sync not in progress in Zotero.Sync.Storage.finish()");
		}
		
		// Upload success file when done
		if (!cancelled && !this.resyncOnFinish && !skipSuccessFile) {
			_uploadSuccessFile(function () {
				Zotero.Sync.Storage.finish(false, true);
			});
			return;
		}
		
		Zotero.debug("Storage sync is complete");
		_syncInProgress = false;
		
		if (!cancelled && this.resyncOnFinish) {
			Zotero.debug("Force-resyncing items in conflict");
			this.resyncOnFinish = false;
			this.sync();
			return;
		}
		
		if (cancelled || !_changesMade) {
			if (!_changesMade) {
				Zotero.debug("No changes made during storage sync");
			}
			Zotero.Sync.Runner.reset();
		}
		
		Zotero.Sync.Runner.next();
	}
	
	
	function _getSuccessFileTimestamp(callback) {
		try {
			var uri = Zotero.Sync.Storage.rootURI;
			var successFileURI = uri.clone();
			successFileURI.spec += "lastsync";
			Zotero.Utilities.HTTP.doGet(successFileURI, function (req) {
				var ts = undefined;
				try {
					Zotero.debug(req.responseText);
					Zotero.debug(req.status);
					var lastModified = req.getResponseHeader("Last-modified");
					var date = new Date(lastModified);
					Zotero.debug("Last successful storage sync was " + date);
					var ts = Zotero.Date.toUnixTimestamp(date);
				}
				finally {
					callback(ts);
				}
			});
			return;
		}
		catch (e) {
			Zotero.debug(e);
			Components.utils.reportError(e);
			callback();
			return;
		}
	}
	
	
	function _uploadSuccessFile(callback) {
		try {
			var uri = Zotero.Sync.Storage.rootURI;
			var successFileURI = uri.clone();
			successFileURI.spec += "lastsync";
			Zotero.Utilities.HTTP.WebDAV.doPut(successFileURI, "", function (req) {
				Zotero.debug(req.responseText);
				Zotero.debug(req.status);
				
				switch (req.status) {
					case 200:
					case 201:
					case 204:
						_getSuccessFileTimestamp(function (ts) {
							if (ts) {
								var sql = "REPLACE INTO version VALUES ('storage', ?)";
								Zotero.DB.query(sql, { int: ts });
							}
							if (callback) {
								callback();
							}
						});
						return;
				}
				
				var msg = "Unexpected error code " + req.status + " uploading storage success file";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				if (callback) {
					callback();
				}
			});
		}
		catch (e) {
			Zotero.debug(e);
			Components.utils.reportError(e);
			if (callback) {
				callback();
			}
			return;
		}
	}
	
	
	/**
	 * Get the storage URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of file on storage server
	 */
	function _getItemURI(item) {
		var uri = Zotero.Sync.Storage.rootURI;
		uri.spec = uri.spec + item.key + '.zip';
		return uri;
	}
	
	
	/**
	 * Get the storage property file URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of property file on storage server
	 */
	function _getItemPropertyURI(item) {
		var uri = Zotero.Sync.Storage.rootURI;
		uri.spec = uri.spec + item.key + '.prop';
		return uri;
	}
	
	
	/**
	 * Get the storage property file URI corresponding to a given item storage URI
	 *
	 * @param	{nsIURI}			Item storage URI
	 * @return	{nsIURI|FALSE}	Property file URI, or FALSE if not an item storage URI
	 */
	function _getPropertyURIFromItemURI(uri) {
		if (!uri.spec.match(/\.zip$/)) {
			return false;
		}
		var propURI = uri.clone();
		propURI.QueryInterface(Components.interfaces.nsIURL);
		propURI.fileName = uri.fileName.replace(/\.zip$/, '.prop');
		propURI.QueryInterface(Components.interfaces.nsIURI);
		return propURI;
	}
	
	
	/**
	 * @inner
	 * @param	{XMLHTTPRequest}		req
	 * @throws
	 */
	function _checkResponse(req) {
		if (!req.responseText) {
			_error('Empty response from server');
		}
		if (!req.responseXML ||
				!req.responseXML.firstChild ||
				!(req.responseXML.firstChild.namespaceURI == 'DAV:' &&
					req.responseXML.firstChild.localName == 'multistatus') ||
					!req.responseXML.childNodes[0].firstChild) {
			Zotero.debug(req.responseText);
			_error('Invalid response from storage server');
		}
	}
	
	
	
	//
	// Stop requests, log error, and 
	//
	function _error(e) {
		if (_syncInProgress) {
			Zotero.Sync.Storage.QueueManager.cancel();
			_syncInProgress = false;
		}
		
		Zotero.DB.rollbackAllTransactions();
		
		Zotero.debug(e, 1);
		Zotero.Sync.Runner.setError(e.message ? e.message : e);
		Zotero.Sync.Runner.reset();
		throw (e);
	}
}




Zotero.Sync.Storage.QueueManager = new function () {
	var _queues = {};
	var _conflicts = [];
	
	
	/**
	 * Retrieving a queue, creating a new one if necessary
	 *
	 * @param	{String}		queueName
	 */
	this.get = function (queueName) {
		// Initialize the queue if it doesn't exist yet
		if (!_queues[queueName]) {
			var queue = new Zotero.Sync.Storage.Queue(queueName);
			switch (queueName) {
				case 'download':
					queue.maxConcurrentRequests =
						Zotero.Prefs.get('sync.storage.maxDownloads')
					break;
				
				case 'upload':
					queue.maxConcurrentRequests =
						Zotero.Prefs.get('sync.storage.maxUploads')
					break;
			}
			_queues[queueName] = queue;
		}
		
		return _queues[queueName];
	}
	
	
	/**
	 * Stop all queues
	 */
	this.cancel = function () {
		this._cancelled = true;
		for each(var queue in _queues) {
			queue.stop();
		}
		_conflicts = [];
	}
	
	
	/**
	 * Tell the storage system that we're finished
	 */
	this.finish = function () {
		if (_conflicts.length) {
			var data = _reconcileConflicts();
			if (data) {
				_processMergeData(data);
			}
			_conflicts = [];
		}
		
		Zotero.Sync.Storage.finish(this._cancelled);
		this._cancelled = false;
	}
	
	
	/**
	 * Calculate the current progress values and trigger a display update
	 *
	 * Also detects when all queues have finished and ends sync progress
	 */
	this.updateProgress = function () {
		var activeRequests = 0;
		var allFinished = true;
		for each(var queue in _queues) {
			// Finished or never started
			if (queue.isFinished() || (!queue.isRunning() && !queue.isStopping())) {
				continue;
			}
			allFinished = false;
			activeRequests += queue.activeRequests;
		}
		if (activeRequests == 0) {
			this.updateProgressMeters(0);
			if (allFinished) {
				this.finish();
			}
			return;
		}
		
		// Percentage
		var percentageSum = 0;
		var numQueues = 0;
		for each(var queue in _queues) {
			percentageSum += queue.percentage;
			numQueues++;
		}
		var percentage = Math.round(percentageSum / numQueues);
		//Zotero.debug("Total percentage is " + percentage);
		
		// Remaining KB
		var downloadStatus = _queues.download ?
								_getQueueStatus(_queues.download) : 0;
		var uploadStatus = _queues.upload ?
								_getQueueStatus(_queues.upload) : 0;
		
		this.updateProgressMeters(
			activeRequests, percentage, downloadStatus, uploadStatus
		);
	}
	
	
	/**
	 * Cycle through windows, updating progress meters with new values
	 */
	this.updateProgressMeters = function (activeRequests, percentage, downloadStatus, uploadStatus) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			var doc = win.document;
			
			//
			// TODO: Move to overlay.js?
			//
			var box = doc.getElementById("zotero-tb-sync-progress-box");
			var meter = doc.getElementById("zotero-tb-sync-progress");
			
			if (activeRequests == 0) {
				box.hidden = true;
				continue;
			}
			
			meter.setAttribute("value", percentage);
			box.hidden = false;
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-progress");
			tooltip.setAttribute("value", percentage + "%");
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-downloads");
			tooltip.setAttribute("value", downloadStatus);
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-uploads");
			tooltip.setAttribute("value", uploadStatus);
		}
	}
	
	
	this.addConflict = function (requestName, localData, remoteData) {
		_conflicts.push({
			name: requestName,
			localData: localData,
			remoteData: remoteData
		});
	}
	
	
	/**
	 * Get a status string for a queue
	 *
	 * @param	{Zotero.Sync.Storage.Queue}		queue
	 * @return	{String}
	 */
	function _getQueueStatus(queue) {
		var remaining = queue.remaining;
		var unfinishedRequests = queue.unfinishedRequests;
		
		if (!unfinishedRequests) {
			return Zotero.getString('sync.storage.none')
		}
		
		var kbRemaining = Zotero.getString(
			'sync.storage.kbRemaining',
			Zotero.Utilities.prototype.numberFormat(remaining / 1024, 0)
		);
		var totalRequests = queue.totalRequests;
		// TODO: localize
		/*
		var filesRemaining = Zotero.getString(
			'sync.storage.filesRemaining',
			[totalRequests - unfinishedRequests, totalRequests]
		);
		*/
		var filesRemaining = (totalRequests - unfinishedRequests)
								+ "/" + totalRequests + " files";
		var status = Zotero.localeJoin([kbRemaining, '(' + filesRemaining + ')']);
		return status;
	}
	
	
	function _reconcileConflicts() {
		var objectPairs = [];
		for each(var conflict in _conflicts) {
			var item = Zotero.Items.getByLibraryAndKey(null, conflict.name);
			var item1 = item.clone(false, false, true);
			item1.setField('dateModified',
				Zotero.Date.dateToSQL(new Date(conflict.localData.modTime * 1000), true));
			var item2 = item.clone(false, false, true);
			item2.setField('dateModified',
				Zotero.Date.dateToSQL(new Date(conflict.remoteData.modTime * 1000), true));
			objectPairs.push([item1, item2]);
		}
		
		var io = {
			dataIn: {
				type: 'storagefile',
				captions: [
					// TODO: localize
					'Local File',
					'Remote File',
					'Saved File'
				],
				objects: objectPairs
			}
		};
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
		
		if (!io.dataOut) {
			return false;
		}
		
		// Since we're only putting cloned items into the merge window,
		// we have to manually set the ids
		for (var i=0; i<_conflicts.length; i++) {
			io.dataOut[i].id = Zotero.Items.getByLibraryAndKey(null, _conflicts[i].name).id;
		}
		
		return io.dataOut;
	}
	
	
	function _processMergeData(data) {
		if (!data.length) {
			return false;
		}
		
		Zotero.Sync.Storage.resyncOnFinish = true;
		
		for each(var mergeItem in data) {
			var itemID = mergeItem.id;
			var dateModified = mergeItem.ref.getField('dateModified');
			// Local
			if (dateModified == mergeItem.left.getField('dateModified')) {
				Zotero.Sync.Storage.setSyncState(
					itemID, Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD
				);
			}
			// Remote
			else {
				Zotero.Sync.Storage.setSyncState(
					itemID, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD
				);
			}
		}
	}
}



/**
 * Queue for storage sync transfer requests
 *
 * @param	{String}		name		Queue name (e.g., 'download' or 'upload')
 */
Zotero.Sync.Storage.Queue = function (name) {
	Zotero.debug("Initializing " + name + " queue");
	
	//
	// Public properties
	//
	this.name = name;
	this.__defineGetter__('Name', function () {
		return this.name[0].toUpperCase() + this.name.substr(1);
	});
	this.maxConcurrentRequests = 1;
	
	this.activeRequests = 0;
	this.__defineGetter__('finishedRequests', function () {
		return _finishedReqs;
	});
	this.__defineSetter__('finishedRequests', function (val) {
		Zotero.debug("Finished requests: " + val);
		Zotero.debug("Total requests: " + this.totalRequests);
		
		_finishedReqs = val;
		
		if (val == 0) {
			return;
		}
		
		// Last request
		if (val == this.totalRequests) {
			Zotero.debug(this.Name + " queue is done");
			// DEBUG info
			Zotero.debug("Active requests: " + this.activeRequests);
			Zotero.debug("Errors:");
			Zotero.debug(this._errors);
			
			if (this.activeRequests) {
				throw (this.Name + " queue can't be finished if there "
					+ "are active requests in Zotero.Sync.Storage.finishedRequests");
			}
			
			this._running = false;
			this._stopping = false;
			this._finished = true;
			return;
		}
		
		if (this.isStopping() || this.isFinished()) {
			return;
		}
		this.advance();
	});
	this.totalRequests = 0;
	
	this.__defineGetter__('unfinishedRequests', function () {
		return this.totalRequests - this.finishedRequests;
	});
	this.__defineGetter__('queuedRequests', function () {
		return this.unfinishedRequests - this.activeRequests;
	});
	this.__defineGetter__('remaining', function () {
		var remaining = 0;
		for each(var request in this._requests) {
			remaining += request.remaining;
		}
		return remaining;
	});
	this.__defineGetter__('percentage', function () {
		if (this.totalRequests == 0) {
			return 0;
		}
		
		var completedRequests = 0;
		for each(var request in this._requests) {
			completedRequests += request.percentage / 100;
		}
		return Math.round((completedRequests / this.totalRequests) * 100);
	});
	
	
	//
	// Private properties
	//
	this._requests = {};
	this._running = false;
	this._errors = [];
	this._stopping = false;
	this._finished = false;
	
	var _finishedReqs = 0;
}


Zotero.Sync.Storage.Queue.prototype.isRunning = function () {
	return this._running;
}

Zotero.Sync.Storage.Queue.prototype.isStopping = function () {
	return this._stopping;
}

Zotero.Sync.Storage.Queue.prototype.isFinished = function () {
	return this._finished;
}

/**
 * Add a request to this queue
 *
 * @param {Zotero.Sync.Storage.Request} request
 */
Zotero.Sync.Storage.Queue.prototype.addRequest = function (request) {
	if (this.isRunning()) {
		throw ("Can't add request after queue started");
	}
	if (this.isFinished()) {
		throw ("Can't add request after queue finished");
	}
	
	request.queue = this;
	var name = request.name;
	Zotero.debug("Queuing " + this.name + " request '" + name + "'");
	
	if (this._requests[name]) {
		throw (this.name + " request '" + name + "' already exists in "
			+ "Zotero.Sync.Storage.Queue.addRequest()");
	}
	
	this._requests[name] = request;
	this.totalRequests++;
}


/**
 * Starts this queue
 */
Zotero.Sync.Storage.Queue.prototype.start = function () {
	if (this._running) {
		throw (this.Name + " queue is already running in "
			+ "Zotero.Sync.Storage.Queue.start()");
	}
	
	if (!this.queuedRequests) {
		Zotero.debug("No requests to start in " + this.name + " queue");
		return;
	}
	
	this._running = true;
	this.advance();
}


Zotero.Sync.Storage.Queue.prototype.logError = function (msg) {
	Zotero.debug(msg, 1);
	Components.utils.reportError(msg);
	// TODO: necessary?
	this._errors.push(msg);
}


/**
 * Start another request in this queue if there's an available slot
 */
Zotero.Sync.Storage.Queue.prototype.advance = function () {
	if (this._stopping) {
		Zotero.debug(this.Name + " queue is being stopped in "
			+ "Zotero.Sync.Storage.Queue.advance()", 2);
		return;
	}
	if (this._finished) {
		Zotero.debug(this.Name + " queue already finished "
			+ "Zotero.Sync.Storage.Queue.advance()", 2);
		return;
	}
	
	if (!this.queuedRequests) {
		Zotero.debug("No remaining requests in " + this.name + " queue ("
			+ this.activeRequests + " active, "
			+ this.finishedRequests + " finished)");
		return;
	}
	
	if (this.activeRequests >= this.maxConcurrentRequests) {
		Zotero.debug(this.Name + " queue is busy ("
			+ this.activeRequests + "/" + this.maxConcurrentRequests + ")");
		return;
	}
	
	for each(var request in this._requests) {
		if (!request.isRunning() && !request.isFinished()) {
			request.start();
			
			var self = this;
			
			// Wait a second and then try starting another
			setTimeout(function () {
				if (self.isStopping() || self.isFinished()) {
					return;
				}
				self.advance();
			}, 1000);
			return;
		}
	}
}


Zotero.Sync.Storage.Queue.prototype.updateProgress = function () {
	Zotero.Sync.Storage.QueueManager.updateProgress();
}


/**
 * Stops all requests in this queue
 */
Zotero.Sync.Storage.Queue.prototype.stop = function () {
	if (this._stopping) {
		Zotero.debug("Already stopping " + this.name + " queue");
		return;
	}
	if (this._finished) {
		Zotero.debug(this.Name + " queue is already finished");
		return;
	}
	
	// If no requests, finish manually
	if (this.activeRequests == 0) {
		this._finishedRequests = this._finishedRequests;
		return;
	}
	
	this._stopping = true;
	for each(var request in this._requests) {
		if (!request.isFinished()) {
			request.stop();
		}
	}
}


/**
 * Clears queue state data
 */
Zotero.Sync.Storage.Queue.prototype.reset = function () {
	Zotero.debug("Resetting " + this.name + " queue");
	
	if (this._running) {
		throw ("Can't reset running queue in Zotero.Sync.Storage.Queue.reset()");
	}
	if (this._stopping) {
		throw ("Can't reset stopping queue in Zotero.Sync.Storage.Queue.reset()");
	}
	
	this._finished = false;
	this._requests = {};
	this._errors = [];
	this.activeRequests = 0;
	this.finishedRequests = 0;
	this.totalRequests = 0;
}




/**
 * Updates multiplier applied to estimated sizes
 *
 * Also updates progress meter
 */
 /*
function _updateSizeMultiplier(mult) {
	var previousMult = _requestSizeMultiplier;
	_requestSizeMultiplier = mult;
	for (var queue in _requests) {
		for (var name in _requests[queue]) {
			var r = _requests[queue][name];
			if (r.progressMax > 0 || !r.size) {
				continue;
			}
			// Remove previous estimated size and add new one
			_totalProgressMax[queue] += Math.round(r.size * previousMult) * -1
									+ Math.round(r.size * mult);
		}
	}
	_updateProgressMeter();
}
*/



/**
 * Transfer request for storage sync
 *
 * @param	{String}		name			Identifier for request (e.g., item key)
 * @param	{Function}	onStart		Callback when request is started
 */
Zotero.Sync.Storage.Request = function (name, onStart) {
	Zotero.debug("Initializing request '" + name + "'");
	
	this.name = name;
	this.channel = null;
	this.queue = null;
	this.progress = 0;
	this.progressMax = 0;
	
	this._running = false;
	this._onStart = onStart;
	this._percentage = 0;
	this._remaining = null;
	this._finished = false;
}


Zotero.Sync.Storage.Request.prototype.__defineGetter__('percentage', function () {
	if (this.progressMax == 0) {
		return 0;
	}
	
	var percentage = Math.round((this.progress / this.progressMax) * 100);
	if (percentage < this._percentage) {
		Zotero.debug(percentage + " is less than last percentage of "
			+ this._percentage + " for request '" + this.name + "'", 2);
		Zotero.debug(this.progress);
		Zotero.debug(this.progressMax);
		percentage = this._percentage;
	}
	else if (percentage > 100) {
		Zotero.debug(percentage + " is greater than 100 for "
			+ this.name + " request", 2);
		Zotero.debug(this.progress);
		Zotero.debug(this.progressMax);
		percentage = 100;
	}
	else {
		this._percentage = percentage;
	}
	//Zotero.debug("Request '" + this.name + "' percentage is " + percentage);
	return percentage;
});


Zotero.Sync.Storage.Request.prototype.__defineGetter__('remaining', function () {
	if (!this.progressMax) {
		//Zotero.debug("Remaining not yet available for request '" + this.name + "'");
		return 0;
	}
	
	var remaining = this.progressMax - this.progress;
	if (this._remaining === null) {
		this._remaining = remaining;
	}
	else if (remaining > this._remaining) {
		Zotero.debug(remaining + " is greater than the last remaining amount of "
				+ this._remaining);
		remaining = this._remaining;
	}
	else if (remaining < 0) {
		Zotero.debug();
	}
	else {
		this._remaining = remaining;
	}
	//Zotero.debug("Request '" + this.name + "' remaining is " + remaining);
	return remaining;
});


Zotero.Sync.Storage.Request.prototype.start = function () {
	if (!this.queue) {
		throw ("Request '" + this.name + "' must be added to a queue before starting");
	}
	
	if (this._running) {
		throw ("Request '" + this.name + "' already running in "
			+ "Zotero.Sync.Storage.Request.start()");
	}
	
	Zotero.debug("Starting " + this.queue.name + " request '" + this.name + "'");
	this._running = true;
	this.queue.activeRequests++;
	this._onStart(this);
}


Zotero.Sync.Storage.Request.prototype.isRunning = function () {
	return this._running;
}


Zotero.Sync.Storage.Request.prototype.isFinished = function () {
	return this._finished;
}


/**
 * Update counters for given request
 *
 * Also updates progress meter
 *
 * @param	{Integer}		progress			Progress so far
 *												(usually bytes transferred)
 * @param	{Integer}		progressMax		Max progress value for this request
 *												(usually total bytes)
 */
Zotero.Sync.Storage.Request.prototype.onProgress = function (channel, progress, progressMax) {
	if (!this._running) {
		throw ("Trying to update a finished request in "
				+ "Zotero.Sync.Storage.Request.onProgress()");
	}
	
	if (!this.channel) {
		this.channel = channel;
	}
	
	// Workaround for invalid progress values (possibly related to
	// https://bugzilla.mozilla.org/show_bug.cgi?id=451991 and fixed in 3.1)
	if (progress < this.progress) {
		Zotero.debug("Invalid progress for request '"
			+ this.name + "' (" + progress + " < " + this.progress + ")");
		return;
	}
	
	if (progressMax != this.progressMax) {
		Zotero.debug("progressMax has changed from " + this.progressMax
			+ " to " + progressMax + " for request '" + this.name + "'", 2);
	}
	
	this.progress = progress;
	this.progressMax = progressMax;
	this.queue.updateProgress();
}


Zotero.Sync.Storage.Request.prototype.error = function (msg) {
	msg = typeof msg == 'object' ? msg.message : msg;
	
	this.queue.logError(msg);
	
	// DEBUG: ever need to stop channel?
	this.finish();
}


/**
 * Stop the request's underlying network request, if there is one
 */
Zotero.Sync.Storage.Request.prototype.stop = function () {
	if (!this._running || !this.channel) {
		this.finish();
		return;
	}
	
	Zotero.debug("Stopping request '" + this.name + "'");
	this.channel.cancel(0x804b0002); // NS_BINDING_ABORTED
}


/**
 * Mark request as finished and notify queue that it's done
 */
Zotero.Sync.Storage.Request.prototype.finish = function () {
	if (this._finished) {
		throw ("Request '" + this.name + "' is already finished");
	}
	
	Zotero.debug("Finishing " + this.queue.name + " request '" + this.name + "'");
	
	this._finished = true;
	var active = this._running;
	this._running = false;
	
	if (active) {
		this.queue.activeRequests--;
	}
	// mechanism for failures?
	this.queue.finishedRequests++;
	this.queue.updateProgress();
}




/**
 * Request observer for zip writing
 *
 * Implements nsIRequestObserver
 *
 * @param	{nsIZipWriter}	zipWriter
 * @param	{Function}		callback
 * @param	{Object}			data
 */
Zotero.Sync.Storage.ZipWriterObserver = function (zipWriter, callback, data) {
	this._zipWriter = zipWriter;
	this._callback = callback;
	this._data = data;
}

Zotero.Sync.Storage.ZipWriterObserver.prototype = {
	onStartRequest: function () {},
	
	onStopRequest: function(req, context, status) {
		var zipFileName = this._zipWriter.file.leafName;
		
		var originalSize = 0;
		for each(var fileName in this._data.files) {
			var entry = this._zipWriter.getEntry(fileName);
			originalSize += entry.realSize;
		}
		delete this._data.files;
		
		this._zipWriter.close();
		
		Zotero.debug("Zip of " + zipFileName + " finished with status " + status
			+ " (original " + Math.round(originalSize / 1024) + "KB, "
			+ "compressed " + Math.round(this._zipWriter.file.fileSize / 1024) + "KB, "
			+ Math.round(
				((originalSize - this._zipWriter.file.fileSize) / originalSize) * 100
			  ) + "% reduction)");
		
		Zotero.Sync.Storage.compressionTracker.compressed += this._zipWriter.file.fileSize;
		Zotero.Sync.Storage.compressionTracker.uncompressed += originalSize;
		Zotero.debug("Average compression so far: "
			+ Zotero.Sync.Storage.compressionTracker.ratio + "%");
		
		this._callback(this._data);
	}
}


/**
 * Stream listener that can handle both download and upload requests
 *
 * Possible properties of data object:
 *   - onStart: f(request)
 *   - onProgress:  f(request, progress, progressMax)
 *   - onStop:  f(request, status, response, data)
 *   - onCancel:  f(request, status, data)
 *   - streams: array of streams to close on completion
 *   - Other values to pass to onStop()
 */
Zotero.Sync.Storage.StreamListener = function (data) {
	this._data = data;
}

Zotero.Sync.Storage.StreamListener.prototype = {
	_channel: null,
	
	// nsIProgressEventSink
	onProgress: function (request, context, progress, progressMax) {
		// Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=451991
		// (fixed in Fx3.1)
		if (progress > progressMax) {
			progress = progressMax;
		}
		//Zotero.debug("onProgress with " + progress + "/" + progressMax);
		this._onProgress(request, progress, progressMax);
	},
	
	onStatus: function (request, context, status, statusArg) {
		//Zotero.debug('onStatus');
	},
	
	// nsIRequestObserver
	// Note: For uploads, this isn't called until data is done uploading
	onStartRequest: function (request, context) {
		Zotero.debug('onStartRequest');
		this._response = "";
		
		this._onStart(request);
	},
	
	onStopRequest: function (request, context, status) {
		Zotero.debug('onStopRequest');
		
		switch (status) {
			case 0:
			case 0x804b0002: // NS_BINDING_ABORTED
				this._onDone(request, status);
				break;
			
			default:
				throw ("Unexpected request status " + status
					+ " in Zotero.Sync.Storage.StreamListener.onStopRequest()");
		}
	},
	
	// nsIWebProgressListener
	onProgressChange: function (wp, request, curSelfProgress,
			maxSelfProgress, curTotalProgress, maxTotalProgress) {
		//Zotero.debug("onProgressChange with " + curTotalProgress + "/" + maxTotalProgress);
		
		// onProgress gets called too, so this isn't necessary
		//this._onProgress(request, curTotalProgress, maxTotalProgress);
	},
	
	onStateChange: function (wp, request, stateFlags, status) {
		Zotero.debug("onStateChange");
		
		if ((stateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
				&& (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK)) {
			this._onStart(request);
		}
		else if ((stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
				&& (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK)) {
			this._onDone(request, status);
		}
	},
	
	onStatusChange: function (progress, request, status, message) {
		Zotero.debug("onStatusChange with '" + message + "'");
	},
	onLocationChange: function () {},
	onSecurityChange: function () {},
	
	// nsIStreamListener
	onDataAvailable: function (request, context, stream, sourceOffset, length) {
		Zotero.debug('onDataAvailable');
		var scriptableInputStream = 
			Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance(Components.interfaces.nsIScriptableInputStream);
		scriptableInputStream.init(stream);
		
		this._response += scriptableInputStream.read(length);
	},
	
	// nsIChannelEventSink
	onChannelRedirect: function (oldChannel, newChannel, flags) {
		Zotero.debug('onRedirect');
		
		// if redirecting, store the new channel
		this._channel = newChannel;
	},
	
	// nsIHttpEventSink
	onRedirect: function (oldChannel, newChannel) {
		Zotero.debug('onRedirect');
	},
	
	
	//
	// Private methods
	//
	_onStart: function (request) {
		//Zotero.debug('Starting request');
		if (this._data && this._data.onStart) {
			this._data.onStart(request);
		}
	},
	
	_onProgress: function (request, progress, progressMax) {
		if (this._data && this._data.onProgress) {
			this._data.onProgress(request, progress, progressMax);
		}
	},
	
	_onDone: function (request, status) {
		var cancelled = status == 0x804b0002; // NS_BINDING_ABORTED
		
		if (!cancelled && request instanceof Components.interfaces.nsIHttpChannel) {
			request.QueryInterface(Components.interfaces.nsIHttpChannel);
			status = request.responseStatus;
			request.QueryInterface(Components.interfaces.nsIRequest);
		}
		
		if (this._data.streams) {
			for each(var stream in this._data.streams) {
				stream.close();
			}
		}
		
		// Make copy of data without callbacks to pass along
		var passData = {};
		for (var i in this._data) {
			switch (i) {
				case "onStart":
				case "onProgress":
				case "onStop":
				case "onCancel":
					continue;
			}
			passData[i] = this._data[i];
		}
		
		if (cancelled) {
			if (this._data.onCancel) {
				this._data.onCancel(request, status, passData);
			}
		}
		else {
			if (this._data.onStop) {
				this._data.onStop(request, status, this._response, passData);
			}
		}
		
		this._channel = null;
	},
	
	
	// nsIInterfaceRequestor
	getInterface: function (iid) {
		try {
			return this.QueryInterface(iid);
		}
		catch (e) {
			throw Components.results.NS_NOINTERFACE;
		}
	},
	
	QueryInterface: function(iid) {
		if (iid.equals(Components.interfaces.nsISupports) ||
				iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
				iid.equals(Components.interfaces.nsIChannelEventSink) || 
				iid.equals(Components.interfaces.nsIProgressEventSink) ||
				iid.equals(Components.interfaces.nsIHttpEventSink) ||
				iid.equals(Components.interfaces.nsIStreamListener) ||
				iid.equals(Components.interfaces.nsIWebProgressListener)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	},
	
	_safeSpec: function (uri) {
		return uri.scheme + '://' + uri.username + ':********@'
			+ uri.hostPort + uri.path
	},
};

