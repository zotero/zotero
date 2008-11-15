Zotero.Sync.Storage = new function () {
	//
	// Constants
	//
	this.SYNC_STATE_TO_UPLOAD = 0;
	this.SYNC_STATE_TO_DOWNLOAD = 1;
	this.SYNC_STATE_IN_SYNC = 2;
	
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
	var _finishCallback;
	
	// Queue
	var _queues = {
		download: { current: 0, queue: [] },
		upload: { current: 0, queue: [] }
	};
	var _queueSimultaneous = {
		download: null,
		upload: null
	};
	
	// Progress
	var _requests = {
		download: {},
		upload: {}
	};
	var _numRequests = {
		download: { active: 0, queued: 0, done: 0 },
		upload: { active: 0, queued: 0, done: 0 }
	}
	var _totalProgress = {
		download: 0,
		upload: 0
	};
	var _totalProgressMax = {
		download: 0,
		upload: 0
	}
	_requestSizeMultiplier = 1;
	
	
	//
	// Public methods
	//
	this.init = function () {
		_queueSimultaneous.download = Zotero.Prefs.get('sync.storage.maxDownloads');
		_queueSimultaneous.upload = Zotero.Prefs.get('sync.storage.maxUploads');
	}
	
	
	this.sync = function () {
		if (!Zotero.Sync.Storage.enabled) {
			Zotero.debug("Storage sync is not enabled");
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
		Zotero.Sync.Runner.setSyncIcon('animate');
		_syncInProgress = true;
		
		Zotero.Sync.Storage.checkForUpdatedFiles();
		
		// If authorization header isn't cached, cache it before proceeding,
		// since during testing Firefox 3.0.1 was being a bit amnesic with auth
		// info for subsequent requests -- surely a better way to fix this
		if (!_cachedCredentials.authHeader) {
			Zotero.Utilities.HTTP.doOptions(Zotero.Sync.Storage.rootURI, function (req) {
				var authHeader = Zotero.Utilities.HTTP.getChannelAuthorization(req.channel);
				if (authHeader) {
					_cachedCredentials.authHeader = authHeader;
				}
				
				var activeDown = Zotero.Sync.Storage.downloadFiles();
				var activeUp = Zotero.Sync.Storage.uploadFiles();
				if (!activeDown && !activeUp) {
					_syncInProgress = false;
					Zotero.Sync.Runner.next();
				}
			});
			return;
		}
		
		var activeDown = Zotero.Sync.Storage.downloadFiles();
		var activeUp = Zotero.Sync.Storage.uploadFiles();
		if (!activeDown && !activeUp) {
			_syncInProgress = false;
			Zotero.Sync.Runner.next();
		}
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
			
			if (req.status == 404) {
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
	 * @param	{Object}		itemModTimes		Item mod times indexed by item ids
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
		var maxIDs = 999;
		var done = 0;
		var rows = [];
		
		Zotero.DB.beginTransaction();
		
		do {
			var chunk = itemIDs.splice(0, maxIDs);
			var sql = "SELECT itemID, linkMode, path, storageModTime FROM itemAttachments "
						+ "WHERE linkMode IN (?,?) AND syncState IN (?,?)";
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
		var mtimes = {};
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
			mtimes[id] = row.storageModTime;
			attachmentData[id] = {
				linkMode: row.linkMode,
				path: row.path
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
			
			//Zotero.debug("Stored mtime is " + mtimes[item.id]);
			//Zotero.debug("File mtime is " + fileModTime);
			
			if (itemModTimes) {
				Zotero.debug("Item mod time is " + itemModTimes[item.id]);
			}
			
			if (mtimes[item.id] != fileModTime) {
				Zotero.debug("Marking attachment " + item.id + " as changed ("
					+ mtimes[item.id] + " != " + fileModTime + ")");
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
	 * Start download of all attachments marked for download
	 *
	 * @return	{Boolean}
	 */
	this.downloadFiles = function () {
		// Check for active operations?
		_queueReset('download');
		
		var downloadFileIDs = _getFilesToDownload();
		if (!downloadFileIDs) {
			Zotero.debug("No files to download");
			return false;
		}
		
		for each(var itemID in downloadFileIDs) {
			var item = Zotero.Items.get(itemID);
			if (this.isFileModified(itemID)) {
				Zotero.debug("File for attachment " + itemID + " has been modified");
				this.setSyncState(itemID, this.SYNC_STATE_TO_UPLOAD);
				continue;
			}
			
			_addRequest({
				name: _getItemURI(item).spec,
				requestMethod: "GET",
				QueryInterface: function (iid) {
					if (iid.equals(Components.interfaces.nsIHttpChannel) ||
							iid.equals(Components.interfaces.nsISupports)) {
						return this;
					}
					throw Components.results.NS_NOINTERFACE;
				}
			});
			_queueAdd('download', itemID);
		}
		
		// Start downloads
		_queueAdvance('download', Zotero.Sync.Storage.downloadFile);
		return true;
	}
	
	
	/**
	 * Begin download process for individual file
	 *
	 * @param	{Integer}	itemID
	 */
	this.downloadFile = function (itemID) {
		var item = Zotero.Items.get(itemID);
		if (!item) {
			_error("Item " + itemID
						+ " not found in Zotero.Sync.Storage.downloadFile()");
		}
		
		// Retrieve modification time from server to store locally afterwards 
		Zotero.Sync.Storage.getStorageModificationTime(item, function (item, mdate) {
			if (!mdate) {
				Zotero.debug("Remote file not found for item " + item.id);
				_removeRequest({
					name: _getItemURI(item).spec,
					requestMethod: "GET",
					QueryInterface: function (iid) {
						if (iid.equals(Components.interfaces.nsIHttpChannel) ||
								iid.equals(Components.interfaces.nsISupports)) {
							return this;
						}
						throw Components.results.NS_NOINTERFACE;
					}
				});
				_queueAdvance('download', Zotero.Sync.Storage.downloadFile, true);
				return;
			}
			
			var syncModTime = Zotero.Date.toUnixTimestamp(mdate);
			var uri = _getItemURI(item);
			var destFile = Zotero.getTempDirectory();
			destFile.append(item.key + '.zip.tmp');
			if (destFile.exists()) {
				destFile.remove(false);
			}
			
			var listener = new Zotero.Sync.Storage.StreamListener(
				{
					onProgress: _updateProgress,
					onStop: _processDownload,
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
		// Check for active operations?
		_queueReset('upload');
		
		var uploadFileIDs = _getFilesToUpload();
		if (!uploadFileIDs) {
			Zotero.debug("No files to upload");
			return false;
		}
		
		Zotero.debug(uploadFileIDs.length + " file(s) to upload");
		
		for each(var itemID in uploadFileIDs) {
			var item = Zotero.Items.get(itemID);
			var size = Zotero.Attachments.getTotalFileSize(item, true);
			_addRequest({
				name: _getItemURI(item).spec,
				requestMethod: "PUT",
				QueryInterface: function (iid) {
					if (iid.equals(Components.interfaces.nsIHttpChannel) ||
							iid.equals(Components.interfaces.nsISupports)) {
						return this;
					}
					throw Components.results.NS_NOINTERFACE;
				}
			}, size);
			_queueAdd('upload', itemID);
		}
		
		// Start uploads
		_queueAdvance('upload', Zotero.Sync.Storage.uploadFile);
		return true;
	}
	
	
	this.uploadFile = function (itemID) {
		_createUploadFile(itemID);
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
			for each(var response in xml.D::response) {
				var href = response.D::href.toString();
				
				// Absolute
				if (href.match(/^https?:\/\//)) {
					var ios = Components.classes["@mozilla.org/network/io-service;1"].
								getService(Components.interfaces.nsIIOService);
					var href = ios.newURI(href, null, null);
					href = href.path;
				}
				
				if (href.indexOf(path) == -1) {
					_error("DAV:href '" + href
							+ "' does not begin with path '" + path + "' in " + funcName);
				}
				
				// Skip root URI
				//
				// Try URL-encoded as well, in case there's a '~' or similar
				// character in the URL and the server (e.g., Sakai) is
				// encoding the value
				if (href == path || decodeURIComponent(href) == path) {
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
				var item = Zotero.Items.getByKey(key);
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
	
	
	this.resetAllSyncStates = function () {
		var sql = "UPDATE itemAttachments SET syncState=?";
		Zotero.DB.query(sql, [this.SYNC_STATE_TO_UPLOAD]);
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
	 * @return	{Object}			data			Properties 'item', 'syncModTime'
	 */
	function _processDownload(request, status, response, data) {
		var funcName = "Zotero.Sync.Storage._processDownload()";
		
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
			zipFile.remove(null);
			_removeRequest(request);
			_queueAdvance('download', Zotero.Sync.Storage.downloadFile, true);
			return;
		}
		
		var parentDir = Zotero.Attachments.createDirectoryForItem(item.id);
		
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
			_removeRequest(request);
			var msg = "File not found for item " + item.id + " after extracting ZIP";
			Zotero.debug(msg, 1);
			Components.utils.reportError(msg + " in " + funcName);
			_queueAdvance('download', Zotero.Sync.Storage.downloadFile, true);
			return;
		}
		file.lastModifiedTime = syncModTime * 1000;
		
		Zotero.DB.beginTransaction();
		var syncState = Zotero.Sync.Storage.getSyncState(item.id);
		var updateItem = syncState != 1;
		Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
		Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
		Zotero.DB.commitTransaction();
		
		_removeRequest(request);
		_queueAdvance('download', Zotero.Sync.Storage.downloadFile, true);
	}
	
	
	/**
	 * Create zip file of attachment directory
	 *
	 * @param	{Integer} 				itemID
	 * @return	{Boolean}							TRUE if zip process started,
	 *												FALSE if storage was empty
	 */
	function _createUploadFile(itemID) {
		Zotero.debug('Creating zip file for item ' + itemID);
		var item = Zotero.Items.get(itemID);
		
		switch (item.attachmentLinkMode) {
			case Zotero.Attachments.LINK_MODE_LINKED_FILE:
			case Zotero.Attachments.LINK_MODE_LINKED_URL:
				_error("Upload file must be an imported snapshot or file in "
					+ "Zotero.Sync.Storage.createUploadFile()");
		}
		
		var dir = Zotero.Attachments.getStorageDirectory(itemID);
		
		var tmpFile = Zotero.getTempDirectory();
		tmpFile.append(item.key + '.zip');
		
		var zw = Components.classes["@mozilla.org/zipwriter;1"]
			.createInstance(Components.interfaces.nsIZipWriter);
		zw.open(tmpFile, 0x04 | 0x08 | 0x20); // open rw, create, truncate
		var fileList = _zipDirectory(dir, dir, zw);
		if (fileList.length == 0) {
			Zotero.debug('No files to add -- removing zip file');
			tmpFile.remove(null);
			_removeRequest({
				name: _getItemURI(item).spec,
				requestMethod: "PUT",
				QueryInterface: function (iid) {
					if (iid.equals(Components.interfaces.nsIHttpChannel) ||
							iid.equals(Components.interfaces.nsISupports)) {
						return this;
					}
					throw Components.results.NS_NOINTERFACE;
				}
			});
			_queueAdvance('upload', Zotero.Sync.Storage.uploadFile, true);
			return false;
		}
		
		Zotero.debug('Creating ' + tmpFile.leafName + ' with ' + fileList.length + ' file(s)');
		
		var observer = new Zotero.Sync.Storage.ZipWriterObserver(
			zw, _processUploadFile, { itemID: itemID, files: fileList }
		);
		zw.processQueue(observer, null);
		return true;
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
	 * @param	{Object}		Object with 'itemID' property
	 * @return	{void}
	 */
	function _processUploadFile(data) {
		_updateSizeMultiplier(
			(100 - Zotero.Sync.Storage.compressionTracker.ratio) / 100
		);
		
		var item = Zotero.Items.get(data.itemID);
		
		Zotero.Sync.Storage.getStorageModificationTime(item, function (item, mdate) {
			// Check for conflict
			if (mdate) {
				var file = item.getFile();
				if (Zotero.Date.toUnixTimestamp(mdate)
						!= Zotero.Sync.Storage.getSyncedModificationTime(item.id)) {
					_error("Conflict! Last known mod time does not match remote time!")
				}
			}
			else {
				Zotero.debug("Remote file not found for item " + item.id);
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
					onProgress: _updateProgress,
					onStop: _onUploadComplete,
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
		});
	}
	
	
	function _onUploadComplete(request, status, response, data) {
		var item = data.item;
		var url = request.name;
		
		Zotero.debug("Upload of attachment " + item.id
			+ " finished with status code " + status);
		
		switch (status) {
			case 200:
			case 201:
			case 204:
				break;
			
			default:
				Zotero.debug(response);
				_error("Unexpected file upload status " + status
					+ " in Zotero.Sync.Storage._onUploadComplete()");
		}
		
		Zotero.Sync.Storage.setStorageModificationTime(item, function (item, mtime) {
			Zotero.DB.beginTransaction();
			
			Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
			Zotero.Sync.Storage.setSyncedModificationTime(item.id, mtime, true);
			
			Zotero.DB.commitTransaction();
			
			var file = Zotero.getTempDirectory();
			file.append(item.key + '.zip');
			file.remove(null);
			
			_removeRequest(request);
			_queueAdvance('upload', Zotero.Sync.Storage.uploadFile, true);
		});
	}
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToDownload() {
		var sql = "SELECT itemID FROM itemAttachments WHERE syncState=?";
		return Zotero.DB.columnQuery(sql, Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD);
	}
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToUpload() {
		var sql = "SELECT itemID FROM itemAttachments WHERE syncState=? "
					+ "AND linkMode IN (?,?)";
		return Zotero.DB.columnQuery(sql,
			[
				Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD,
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
	// Queuing functions
	//
	function _queueAdd(queueName, id) {
		Zotero.debug("Queuing " + queueName + " object " + id);
		var q = _queues[queueName];
		if (q.queue.indexOf(id) != -1) {
			return;
		}
		q.queue.push(id);
	}
	
	
	function _queueAdvance(queueName, callback, decrement) {
		var q = _queues[queueName];
		
		if (decrement) {
			q.current--;
		}
		
		if (q.queue.length == 0) {
			Zotero.debug("No objects in " + queueName + " queue ("
				+ q.current + " current)");
			return;
		}
		
		if (q.current >= _queueSimultaneous[queueName]) {
			Zotero.debug(queueName + " queue is busy (" + q.current + ")");
			return;
		}
		
		var id = q.queue.shift();
		q.current++;
		
		Zotero.debug("Processing " + queueName + " object " + id);
		callback(id);
		
		// Wait a second, and then, if still under limit and there are more
		// requests, process another
		setTimeout(function () {
			if (q.queue.length > 0 && q.current < _queueSimultaneous[queueName]) {
				_queueAdvance(queueName, callback);
			}
		}, 1000);
	}
	
	
	function _queueReset(queueName) {
		Zotero.debug("Resetting " + queueName + " queue");
		var q = _queues[queueName];
		q.queue = [];
		q.current = 0;
	}
	
	
	//
	// Progress management
	//
	/**
	 * @param	{nsIRequest}
	 * @param	{Integer}		[size]	Total size in bytes, which might be
	 *									scaled by a compression multiplier
	 */
	function _addRequest(request, size) {
		var info = _getRequestInfo(request);
		var queue = info.queue;
		var name = info.name;
		
		if (_requests[queue][name]) {
			queue = queue.substr(0, 1).toUpperCase() + queue.substr(1);
			_error(queue + " request already exists in Zotero.Sync.Storage._addRequest()");
		}
		_requests[queue][name] = {
			state: 0, // 0: queued, 1: active, 2: done
			progress: 0,
			progressMax: 0,
			size: size ? size : null
		};
		// Add estimated size
		if (size) {
			_totalProgressMax[queue] += Math.round(size * _requestSizeMultiplier);
		}
		_numRequests[queue].queued++;
	}
	
	
	/**
	 * Updates multiplier applied to estimated sizes
	 *
	 * Also updates progress meter
	 */
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
	
	
	/**
	 * Update counters for given request
	 *
	 * Also updates progress meter
	 *
	 * @param	{nsIRequest}		request
	 * @param	{Integer}		progress			Bytes transferred so far
	 * @param	{Integer}		progressMax		Total bytes in this request
	 */
	function _updateProgress(request, progress, progressMax) {
		//Zotero.debug("Updating progress");
		
		var info = _getRequestInfo(request);
		var queue = info.queue;
		var name = info.name;
		
		var r = _requests[queue][name];
		
		switch (r.state) {
			// Queued
			case 0:
				r.state = 1;
				_numRequests[queue].queued--;
				_numRequests[queue].active++;
				// Remove estimated size
				if (r.size) {
					_totalProgressMax[queue] -=
						Math.round(r.size * _requestSizeMultiplier);
				}
				break;
			
			// Done
			case 2:
				_error("Trying to update a finished request in "
						+ "_Zotero.Sync.Storage._updateProgress()");
		}
		
		// Workaround for invalid progress values (possibly related to
		// https://bugzilla.mozilla.org/show_bug.cgi?id=451991 and fixed in 3.1)
		if (progress < r.progress) {
			//Zotero.debug("Invalid progress (" + progress + " < " + r.progress + ")");
			return;
		}
		
		_totalProgress[queue] += progress - r.progress;
		r.progress = progress;
		
		_totalProgressMax[queue] += progressMax - r.progressMax;
		r.progressMax = progressMax;
		
		_updateProgressMeter();
	}
	
	
	/*
	 * Mark request as done, and, if last request, clear all requests
	 *
	 * Also updates progress meter
	 */
	function _removeRequest(request) {
		var info = _getRequestInfo(request);
		var queue = info.queue;
		var name = info.name;
		
		var r = _requests[queue][name];
		
		//Zotero.debug("Removing " + queue + " request " + name);
		if (!r) {
			_error("Existing " + queue + " request not found in "
					+ "Zotero.Sync.Storage._removeRequest()");
		}
		
		switch (r.state) {
			// Active
			case 1:
				_numRequests[queue].active--;
				_numRequests[queue].done++;
				//_totalProgress[queue] -= r.progressMax;
				//_totalProgressMax[queue] -= r.progressMax;
				break;
			
			// Queued
			case 0:
				_numRequests[queue].queued--;
				_numRequests[queue].done++;
				// Remove estimated size
				//_totalProgressMax[queue] -= Math.round(r.size * _requestSizeMultiplier);
				break;
			
			// Done
			case 2:
				_error("Trying to remove a finished request in "
						+ "_Zotero.Sync.Storage._removeRequest()");
		}
		
		//r = undefined;
		//delete _requests[queue][name];
		r.state = 2; // Done
		
		var done = _resetRequestsIfDone();
		if (!done) {
			_updateProgressMeter();
		}
	}
	
	
	/**
	 * Check if all requests are done, and if so reset everything
	 *
	 * Also updates progress meter
	 */
	function _resetRequestsIfDone() {
		//Zotero.debug(_requests);
		//Zotero.debug(_numRequests);
		for (var queue in _requests) {
			if (_numRequests[queue].active != 0 || _numRequests[queue].queued != 0) {
				return false;
			}
		}
		Zotero.debug("Resetting all requests");
		for (var queue in _requests) {
			_requests[queue] = {};
			_numRequests[queue].done = 0;
			_totalProgress[queue] = 0;
			_totalProgressMax[queue] = 0;
			_requestSizeMultiplier = 1;
		}
		_updateProgressMeter();
		
		// TODO: Find a better place for this?
		_syncInProgress = false;
		Zotero.Sync.Runner.next();
		return true;
	}
	
	
	function _updateProgressMeter() {
		var totalRequests = 0;
		for (var queue in _requests) {
			totalRequests += _numRequests[queue].active;
			totalRequests += _numRequests[queue].queued;
		}
		
		if (totalRequests > 0) {
			var percentage = Math.round(
				(
					(_totalProgress.download + _totalProgress.upload) /
					(_totalProgressMax.download + _totalProgressMax.upload)
				) * 100
			);
			//Zotero.debug("Percentage is " + percentage);
			
			if (_totalProgressMax.download) {
				var remaining = Math.round(
					(_totalProgressMax.download - _totalProgress.download) / 1024
				);
				var downloadStatus =
					Zotero.getString('sync.storage.kbRemaining', remaining);
			}
			else {
				var downloadStatus = Zotero.getString('sync.storage.none');
			}
			
			if (_totalProgressMax.upload) {
				remaining = Math.round(
					(_totalProgressMax.upload - _totalProgress.upload) / 1024
				);
				var uploadStatus =
					Zotero.getString('sync.storage.kbRemaining', remaining);
			}
			else {
				var uploadStatus = Zotero.getString('sync.storage.none');
			}
		}
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			var doc = win.document;
			
			//
			// TODO: Move to overlay.js?
			//
			var meter = doc.getElementById("zotero-tb-syncProgress");
			
			if (totalRequests == 0) {
				meter.hidden = true;
				continue;
			}
			
			meter.setAttribute("value", percentage);
			meter.hidden = false;
			
			var tooltip = doc.
				getElementById("zotero-tb-syncProgress-tooltip-progress");
			tooltip.setAttribute("value", percentage + "%");
			
			var tooltip = doc.
				getElementById("zotero-tb-syncProgress-tooltip-downloads");
			tooltip.setAttribute("value", downloadStatus);
			
			var tooltip = doc.
				getElementById("zotero-tb-syncProgress-tooltip-uploads");
			tooltip.setAttribute("value", uploadStatus);
		}
	}
	
	
	function _getRequestInfo(request) {
		request.QueryInterface(Components.interfaces.nsIHttpChannel);
		switch (request.requestMethod) {
			case 'GET':
				var queue = 'download';
				break;
			
			case 'POST':
			case 'PUT':
				var queue = 'upload';
				break;
				
			default:
				_error("Unsupported method '" + request.requestMethod
					+ "' in Zotero.Sync.Storage._updateProgress()")
		}
		
		return {
			queue: queue,
			name: request.name
		};
	}
	
	
	
	//
	//
	//
	function _error(e) {
		_syncInProgress = false;
		Zotero.DB.rollbackAllTransactions();
		
		Zotero.Sync.Runner.setSyncIcon('error');
		
		if (e.name) {
			Zotero.Sync.Runner.lastSyncError = e.name;
		}
		else {
			Zotero.Sync.Runner.lastSyncError = e;
		}
		Zotero.debug(e, 1);
		Zotero.Sync.Runner.reset();
		throw(e);
	}
}


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
 * Possible properties of data object:
 *   - onStart: f(request)
 *   - onProgress:  f(name, progess, progressMax)
 *   - onStop:  f(request, status, response, data)
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
		
		if (status != 0) {
			throw ("Request status is " + status
				+ " in Zotero.Sync.Storage.StreamListener.onStopRequest()");
		}
		
		this._onDone(request, status);
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
		if (request instanceof Components.interfaces.nsIHttpChannel) {
			request.QueryInterface(Components.interfaces.nsIHttpChannel);
			status = request.responseStatus;
			request.QueryInterface(Components.interfaces.nsIRequest);
		}
		
		if (this._data.streams) {
			for each(var stream in this._data.streams) {
				stream.close();
			}
		}
		
		if (this._data.onStop) {
			// Remove callbacks before passing along
			var passData = {};
			for (var i in this._data) {
				switch (i) {
					case "onStart":
					case "onProgress":
					case "onStop":
						continue;
				}
				passData[i] = this._data[i];
			}
			this._data.onStop(request, status, this._response, passData);
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

