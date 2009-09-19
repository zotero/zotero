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
	var _syncInProgress;
	var _changesMade;
	
	var _session;
	
	var _callbacks = {
		onSuccess: function () {},
		onSkip: function () {},
		onStop: function () {},
		onError: function () {},
		onWarning: function () {}
	};
	
	//
	// Public methods
	//
	this.sync = function (module, callbacks) {
		for (var func in callbacks) {
			_callbacks[func] = callbacks[func];
		}
		
		_session = new Zotero.Sync.Storage.Session(module, {
			onChangesMade: function () {
				_changesMade = true;
			},
			onError: _error
		});
		
		if (!_session.enabled) {
			Zotero.debug(_session.name + " file sync is not enabled");
			_callbacks.onSkip();
			return;
		}
		if (!_session.initFromPrefs()) {
			Zotero.debug(_session.name + " module not initialized");
			_callbacks.onSkip();
			return;
		}
		
		if (!_session.active) {
			Zotero.debug(_session.name + " file sync is not active");
			
			var callback = function (uri, status) {
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				
				var success = _session.checkServerCallback(uri, status, lastWin, true);
				if (success) {
					Zotero.debug(_session.name + " file sync is successfully set up");
					Zotero.Sync.Storage.sync(module, callbacks);
				}
				else {
					Zotero.debug(_session.name + " verification failed");
					_callbacks.onSkip();
				}
			}
			
			_session.checkServer(callback);
			return;
		}
		
		if (_syncInProgress) {
			_error("File sync operation already in progress");
		}
		
		Zotero.debug("Beginning " + _session.name + " file sync");
		_syncInProgress = true;
		_changesMade = false;
		
		Zotero.Sync.Storage.checkForUpdatedFiles(null, null, _session.includeUserFiles, _session.includeGroupFiles);
		
		var lastSyncCheckCallback = function (lastSyncTime) {
			var downloadFiles = true;
			
			var sql = "SELECT COUNT(*) FROM itemAttachments WHERE syncState=?";
			var force = !!Zotero.DB.valueQuery(sql, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD);
			
			if (!force && lastSyncTime) {
				var sql = "SELECT version FROM version WHERE schema='storage_" + module + "'";
				var version = Zotero.DB.valueQuery(sql);
				if (version == lastSyncTime) {
					Zotero.debug("Last " + _session.name + " sync time hasn't changed -- skipping file download step");
					downloadFiles = false;
				}
			}
			
			var activeDown = downloadFiles ? Zotero.Sync.Storage.downloadFiles() : false;
			var activeUp = Zotero.Sync.Storage.uploadFiles();
			if (!activeDown && !activeUp) {
				_syncInProgress = false;
				_callbacks.onSkip();
			}
		};
		
		_session.getLastSyncTime(lastSyncCheckCallback);
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
		if (mtime < 0) {
			Components.utils.reportError("Invalid file mod time " + mtime
				+ " in Zotero.Storage.setSyncedModificationTime()");
			mtime = 0;
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "UPDATE itemAttachments SET storageModTime=? WHERE itemID=?";
		Zotero.DB.valueQuery(sql, [mtime, itemID]);
		
		if (updateItem) {
			// Update item date modified so the new mod time will be synced
			var sql = "UPDATE items SET clientDateModified=? WHERE itemID=?";
			Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, itemID]);
		}
		
		Zotero.DB.commitTransaction();
	}
	
	
	/**
	 * @param	{Integer}			itemID
	 * @return	{String|NULL}					File hash, or NULL if never synced
	 */
	this.getSyncedHash = function (itemID) {
		var sql = "SELECT storageHash FROM itemAttachments WHERE itemID=?";
		var hash = Zotero.DB.valueQuery(sql, itemID);
		if (hash === false) {
			_error("Item " + itemID
				+ " not found in Zotero.Sync.Storage.getSyncedHash()");
		}
		return hash;
	}
	
	
	/**
	 * @param	{Integer}	itemID
	 * @param	{String}	hash				File hash
	 * @param	{Boolean}	[updateItem=FALSE]	Update dateModified field of
	 *												attachment item
	 */
	this.setSyncedHash = function (itemID, hash, updateItem) {
		if (hash !== null && hash.length != 32) {
			throw ("Invalid file hash '" + hash + "' in Zotero.Storage.setSyncedHash()");
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "UPDATE itemAttachments SET storageHash=? WHERE itemID=?";
		Zotero.DB.valueQuery(sql, [hash, itemID]);
		
		if (updateItem) {
			// Update item date modified so the new mod time will be synced
			var sql = "UPDATE items SET clientDateModified=? WHERE itemID=?";
			Zotero.DB.query(sql, [Zotero.DB.transactionDateTime, itemID]);
		}
		
		Zotero.DB.commitTransaction();
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
		var file = item.getFile();
		if (!file) {
			return false;
		}
		
		var fileModTime = item.attachmentModificationTime;
		if (!fileModTime) {
			return false;
		}
		
		var syncModTime = Zotero.Sync.Storage.getSyncedModificationTime(itemID);
		if (fileModTime != syncModTime) {
			var syncHash = Zotero.Sync.Storage.getSyncedHash(itemID);
			if (syncHash) {
				var fileHash = item.attachmentHash;
				Zotero.debug('================');
				Zotero.debug(fileHash);
				Zotero.debug(syncHash);
				if (fileHash && fileHash == syncHash) {
					Zotero.debug("Mod time didn't match but hash did for " + file.leafName + " -- ignoring");
					return false;
				}
			}
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
	 * @param	{Integer[]}	[itemIDs]		An optional set of item ids to check
	 * @param	{Object}	[itemModTimes]	Item mod times indexed by item ids
	 *											appearing in itemIDs; if set,
	 *											items with stored mod times
	 *											that differ from the provided
	 *											time but file mod times
	 *											matching the stored time will
	 *											be marked for download
	 * @param	{Boolean}	[includePersonalItems=false]
	 * @param	{Boolean}	[includeGroupItems=false]
	 * @return	{Boolean}					TRUE if any items changed state,
	 *											FALSE otherwise
	 */
	this.checkForUpdatedFiles = function (itemIDs, itemModTimes, includeUserFiles, includeGroupFiles) {
		var funcName = "Zotero.Sync.Storage.checkForUpdatedFiles()";
		
		Zotero.debug("Checking for locally changed attachment files");
		// check for current ops?
		
		if (itemIDs) {
			if (includeUserFiles || includeGroupFiles) {
				_error("includeUserFiles and includeGroupFiles are not allowed when itemIDs is set in " + funcName);
			}
		}
		else {
			if (!includeUserFiles && !includeGroupFiles) {
				_error("At least one of includeUserFiles or includeGroupFiles must be set in " + funcName);
			}
		}
		
		if (itemModTimes && !itemIDs) {
			_error("itemModTimes can only be set if itemIDs is an array in " + funcName);
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
			var sql = "SELECT itemID, linkMode, path, storageModTime, storageHash, syncState "
						+ "FROM itemAttachments JOIN items USING (itemID) "
						+ "WHERE linkMode IN (?,?) AND syncState IN (?,?)";
			if (includeUserFiles && !includeGroupFiles) {
				sql += " AND libraryID IS NULL";
			}
			else if (!includeUserFiles && includeGroupFiles) {
				sql += " AND libraryID IS NOT NULL";
			}
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
		
		// Index data by item id
		var itemIDs = [];
		var attachmentData = {};
		for each(var row in rows) {
			var id = row.itemID;
			itemIDs.push(id);
			attachmentData[id] = {
				linkMode: row.linkMode,
				path: row.path,
				mtime: row.storageModTime,
				hash: row.storageHash,
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
				updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
				continue;
			}
			
			var fileModTime = Math.round(file.lastModifiedTime / 1000);
			
			//Zotero.debug("Stored mtime is " + attachmentData[item.id].mtime);
			//Zotero.debug("File mtime is " + fileModTime);
			
			// Download-marking mode
			if (itemModTimes) {
				Zotero.debug("Item mod time is " + itemModTimes[item.id]);
				
				// Ignore attachments whose storage mod times haven't changed
				if (row.storageModTime == itemModTimes[id]) {
					Zotero.debug("Storage mod time (" + row.storageModTime + ") "
						+ "hasn't changed for attachment " + id);
					continue;
				}
				
				Zotero.debug("Marking attachment " + item.id + " for download");
				updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
				
				continue;
			}
			
			// If stored time matches file, it hasn't changed
			if (attachmentData[item.id].mtime == fileModTime) {
				continue;
			}
			
			// If file is already marked for upload, skip
			if (attachmentData[item.id].state == Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD) {
				continue;
			}
			
			// If file hash matches stored hash, only the mod time changed, so skip
			var fileHash = item.attachmentHash;
			if (attachmentData[item.id].hash && attachmentData[item.id].hash == fileHash) {
				Zotero.debug("Mod time didn't match but hash did for " + file.leafName + " -- ignoring");
				continue;
			}
			
			Zotero.debug("Marking attachment " + item.id + " as changed ("
				+ attachmentData[item.id].mtime + " != " + fileModTime + ")");
			updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD;
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
		
		var downloadFileIDs = _getFilesToDownload(_session.includeUserFiles, _session.includeGroupFiles);
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
				item.libraryID + '/' + item.key, function (request) { _session.downloadFile(request); }
			);
			queue.addRequest(request);
		}
		
		// Start downloads
		queue.start();
		return true;
	}
	
	
	/**
	 * Extract a downloaded file and update the database metadata
	 *
	 * This is called from Zotero.Sync.Server.StreamListener.onStopRequest()
	 *
	 * @return	{Object}			data			Properties 'request', 'item', 'compressed', 'syncModTime', 'syncHash'
	 */
	this.processDownload = function (data) {
		var funcName = "Zotero.Sync.Storage.processDownload()";
		
		if (!data) {
			_error("|data| not set in " + funcName);
		}
		
		if (!data.item) {
			_error("|data.item| not set in " + funcName);
		}
		
		if (!data.syncModTime) {
			_error("|data.syncModTime| not set in " + funcName);
		}
		
		if (!data.compressed && !data.syncHash) {
			_error("|data.storageHash| is required if  |data.compressed| is false in " + funcName);
		}
		
		var item = data.item;
		var syncModTime = data.syncModTime;
		var syncHash = data.syncHash;
		
		// TODO: Test file hash
		
		if (data.compressed) {
			var newFile = _processZipDownload(item);
		}
		else {
			var newFile = _processDownload(item);
		}
		
		// If |updated| is a file, it was renamed, so set item filename to that
		// and mark for updated
		var file = item.getFile();
		if (newFile && file.leafName != newFile.leafName) {
			item.relinkAttachmentFile(newFile);
			file = item.getFile();
			// TODO: use an integer counter instead of mod time for change detection
			var useCurrentModTime = true;
		}
		else {
			var useCurrentModTime = false;
		}
		
		if (!file) {
			// This can happen if an HTML snapshot filename was changed and synced
			// elsewhere but the renamed file wasn't synced, so the ZIP doesn't
			// contain a file with the known name
			var missingFile = item.getFile(null, true);
			Components.utils.reportError("File '" + missingFile.leafName + "' not found after processing download "
				+ item.libraryID + "/" + item.key + " in " + funcName);
			return;
		}
		
		Zotero.DB.beginTransaction();
		var syncState = Zotero.Sync.Storage.getSyncState(item.id);
		
		
		var updateItem = syncState != 1;
		var updateItem = false;
		
		if (useCurrentModTime) {
			file.lastModifiedTime = new Date();
			
			// Reset hash and sync state
			Zotero.Sync.Storage.setSyncedHash(item.id, null);
			Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
			Zotero.Sync.Storage.resyncOnFinish = true;
		}
		else {
			file.lastModifiedTime = syncModTime * 1000;
			
			// Only save hash if file isn't compressed
			if (!data.compressed) {
				Zotero.Sync.Storage.setSyncedHash(item.id, syncHash, false);
			}
			Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
		}
		
		Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
		Zotero.DB.commitTransaction();
		_changesMade = true;
	}
	
	
	/**
	 * Start upload of all attachments marked for upload
	 *
	 * @return	{Boolean}
	 */
	this.uploadFiles = function () {
		if (!_syncInProgress) {
			_syncInProgress = true;
		}
		
		var uploadFileIDs = _getFilesToUpload(_session.includeUserFiles, _session.includeGroupFiles);
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
				item.libraryID + '/' + item.key, function (request) { _session.uploadFile(request); }
			);
			request.progressMax = Zotero.Attachments.getTotalFileSize(item, true);
			queue.addRequest(request);
		}
		
		// Start uploads
		queue.start();
		return true;
	}
	
	
	this.checkServer = function (module, callback) {
		_session = new Zotero.Sync.Storage.Session(module, { onError: callback });
		_session.initFromPrefs();
		_session.checkServer(callback);
	}
	
	
	this.checkServerCallback = function (uri, status, window, skipSuccessMessage) {
		return _session.checkServerCallback(uri, status, window, skipSuccessMessage);
	}
	
	
	this.purgeDeletedStorageFiles = function (module, callback) {
		_session = new Zotero.Sync.Storage.Session(module, { onError: _error });
		if (!_session.initFromPrefs()) {
			_error("Module not initialized");
		}
		_session.purgeDeletedStorageFiles(callback);
	}
	
	
	this.resetAllSyncStates = function (syncState, includeUserFiles, includeGroupFiles) {
		if (!includeUserFiles && !includeGroupFiles) {
			includeUserFiles = true;
			includeGroupFiles = true;
		}
		
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
		
		//var sql = "UPDATE itemAttachments SET syncState=?, storageModTime=NULL, storageHash=NULL";
		var sql = "UPDATE itemAttachments SET syncState=?";
		if (includeUserFiles && !includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID IS NULL)";
		}
		else if (!includeUserFiles && includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID IS NOT NULL)";
		}
		Zotero.DB.query(sql, [syncState]);
		
		var sql = "DELETE FROM version WHERE schema LIKE 'storage_%'";
		Zotero.DB.query(sql);
	}
	
	
	this.getItemFromRequestName = function (name) {
		var [libraryID, key] = name.split('/');
		if (libraryID == "null") {
			libraryID = null;
		}
		return Zotero.Items.getByLibraryAndKey(libraryID, key);
	}
	
	
	//
	// Private methods
	//
	function _processDownload(item) {
		var funcName = "Zotero.Sync.Storage._processDownload()";
		
		var tempFile = Zotero.getTempDirectory();
		tempFile.append(item.key + '.tmp');
		
		if (!tempFile.exists()) {
			Zotero.debug(tempFile.path);
			throw ("Downloaded file not found in " + funcName);
		}
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item.id);
		if (!parentDir.exists()) {
			Zotero.Attachments.createDirectoryForItem(item.id);
		}
		
		_deleteExistingAttachmentFiles(item);
		
		var file = item.getFile(null, true);
		if (!file) {
			throw ("Empty path for item " + item.key + " in " + funcName);
		}
		var newName = file.leafName;
		var returnFile = null
		
		Zotero.debug("Moving download file " + tempFile.leafName + " into attachment directory");
		try {
			tempFile.moveTo(parentDir, newName);
		}
		catch (e) {
			var destFile = parentDir.clone();
			destFile.append(newName);
			
			// Windows API only allows paths of 260 characters
			if (e.name == "NS_ERROR_FILE_NOT_FOUND" && destFile.path.length > 255) {
				var pathLength = destFile.path.length - destFile.leafName.length;
				var newLength = 255 - pathLength;
				// Require 40 available characters in path -- this is arbitrary,
				// but otherwise filenames are going to end up being cut off
				if (newLength < 40) {
					throw ("Storage directory path is too long in " + funcName);
				}
				
				// Shorten file if it's too long -- we don't relink it, but this should
				// be pretty rare and probably only occurs on extraneous files with
				// gibberish for filenames
				var newName = destFile.leafName.substr(0, newLength);
				var msg = "Shortening filename to '" + newName + "'";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				tempFile.moveTo(parentDir, newName);
				
				destFile = parentDir.clone();
				destFile.append(newName);
				
				// processDownload() needs to know that we're renaming the file
				returnFile = destFile;
			}
			else {
				throw(e);
			}
		}
		
		return returnFile;
	}
	
	
	function _processZipDownload(item) {
		var funcName = "Zotero.Sync.Storage._processDownloadedZip()";
		
		var zipFile = Zotero.getTempDirectory();
		zipFile.append(item.key + '.zip.tmp');
		
		if (!zipFile.exists()) {
			throw ("Downloaded ZIP file not found in " + funcName);
		}
		
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
			return false;
		}
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item.id);
		if (!parentDir.exists()) {
			Zotero.Attachments.createDirectoryForItem(item.id);
		}
		
		_deleteExistingAttachmentFiles(item);
		
		var returnFile = null;
		
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
			
			// Make sure the new filename is valid, in case an invalid character
			// for this OS somehow make it into the ZIP (e.g., from before we checked
			// for them or if a user manually renamed and relinked a file on another OS)
			fileName = Zotero.File.getValidFileName(fileName);
			
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
			try {
				destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
			}
			catch (e) {
				// Windows API only allows paths of 260 characters
				if (e.name == "NS_ERROR_FILE_NOT_FOUND" && destFile.path.length > 255) {
					// Is this the main attachment file?
					var primaryFile = item.getFile(null, true).leafName == destFile.leafName;
					
					var pathLength = destFile.path.length - destFile.leafName.length;
					var newLength = 255 - pathLength;
					// Require 40 available characters in path -- this is arbitrary,
					// but otherwise filenames are going to end up being cut off
					if (newLength < 40) {
						throw ("Storage directory path is too long in " + funcName);
					}
					
					// Shorten file if it's too long -- we don't relink it, but this should
					// be pretty rare and probably only occurs on extraneous files with
					// gibberish for filenames
					var newName = destFile.leafName.substr(0, newLength);
					Components.utils.reportError("Shortening filename to '" + newName + "'");
					destFile.leafName = newName;
					destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
					
					// If we're renaming the main file, processDownload() needs to know
					if (primaryFile) {
						returnFile = destFile;
					}
				}
				else {
					throw(e);
				}
			}
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
		
		return returnFile;
	}
	
	
	function _deleteExistingAttachmentFiles(item) {
		var funcName = "Zotero.Sync.Storage._deleteExistingAttachmentFiles()";
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item.id);
		
		// Delete existing files
		var otherFiles = parentDir.directoryEntries;
		while (otherFiles.hasMoreElements()) {
			var file = otherFiles.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			if (file.leafName[0] == '.') {
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
	}
	
	
	/**
	 * Create zip file of attachment directory
	 *
	 * @param	{Zotero.Sync.Storage.Request}		request
	 * @param	{Function}							callback
	 * @return	{Boolean}							TRUE if zip process started,
	 *												FALSE if storage was empty
	 */
	this.createUploadFile = function (request, callback) {
		var item = Zotero.Sync.Storage.getItemFromRequestName(request.name);
		Zotero.debug("Creating zip file for item " + item.libraryID + "/" + item.key);
		
		try {
			switch (item.attachmentLinkMode) {
				case Zotero.Attachments.LINK_MODE_LINKED_FILE:
				case Zotero.Attachments.LINK_MODE_LINKED_URL:
					throw (new Error(
						"Upload file must be an imported snapshot or file in "
							+ "Zotero.Sync.Storage.createUploadFile()"
					));
			}
			
			var dir = Zotero.Attachments.getStorageDirectoryByKey(item.key);
			
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
				zw, callback, { request: request, files: fileList }
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
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToDownload(includeUserFiles, includeGroupFiles) {
		if (!includeUserFiles && !includeGroupFiles) {
			_error("At least one of includeUserFiles or includeGroupFiles must be set "
				+ "in Zotero.Sync.Storage._getFilesToDownload()");
		}
		
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
					+ "WHERE syncState IN (?,?)";
		if (includeUserFiles && !includeGroupFiles) {
			sql += " AND libraryID IS NULL";
		}
		else if (!includeUserFiles && includeGroupFiles) {
			sql += " AND libraryID IS NOT NULL";
		}
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
	function _getFilesToUpload(includeUserFiles, includeGroupFiles) {
		if (!includeUserFiles && !includeGroupFiles) {
			_error("At least one of includeUserFiles or includeGroupFiles must be set "
				+ "in Zotero.Sync.Storage._getFilesToUpload()");
		}
		
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE syncState IN (?,?) AND linkMode IN (?,?)";
		if (includeUserFiles && !includeGroupFiles) {
			sql += " AND libraryID IS NULL";
		}
		else if (!includeUserFiles && includeGroupFiles) {
			sql += " AND libraryID IS NOT NULL";
		}
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
	this.getDeletedFiles = function (days) {
		if (!days) {
			days = Zotero.Prefs.get("sync.storage.deleteDelayDays");
		}
		
		var ts = Zotero.Date.getUnixTimestamp();
		ts = ts - (86400 * days);
		
		var sql = "SELECT key FROM storageDeleteLog WHERE timestamp<?";
		return Zotero.DB.columnQuery(sql, ts);
	}
	
	
	this.finish = function (cancelled, skipSuccessFile) {
		if (!_syncInProgress) {
			throw ("Sync not in progress in Zotero.Sync.Storage.finish()");
		}
		
		// Upload success file when done
		if (!this.resyncOnFinish && !skipSuccessFile) {
			// If we finished successfully and didn't upload any files, save the
			// last sync time locally rather than setting a new one on the server,
			// since we don't want other clients to check for new files
			var uploadQueue = Zotero.Sync.Storage.QueueManager.get('upload');
			var useLastSyncTime = !cancelled && uploadQueue.totalRequests == 0;
			
			_session.setLastSyncTime(function () {
				Zotero.Sync.Storage.finish(cancelled, true);
			}, useLastSyncTime);
			return;
		}
		
		Zotero.debug(_session.name + " sync is complete");
		_syncInProgress = false;
		
		if (this.resyncOnFinish) {
			Zotero.debug("Force-resyncing items in conflict");
			this.resyncOnFinish = false;
			this.sync(_session.module, _callbacks);
			return;
		}
		
		_session = null;
		
		if (!_changesMade) {
			Zotero.debug("No changes made during storage sync");
		}
		
		if (cancelled) {
			_callbacks.onStop();
			return;
		}
		
		if (!_changesMade) {
			_callbacks.onSkip();
			return;
		}
		
		_callbacks.onSuccess();
	}
	
	
	//
	// Stop requests, log error, and 
	//
	function _error(e) {
		if (_syncInProgress) {
			Zotero.Sync.Storage.QueueManager.cancel(true);
			_syncInProgress = false;
			_session = null;
		}
		
		Zotero.DB.rollbackAllTransactions();
		
		Zotero.debug(e, 1);
		
		// If we get a quota error, log and continue
		if (e.error && e.error == Zotero.Error.ERROR_ZFS_OVER_QUOTA && _callbacks.onWarning) {
			_callbacks.onWarning(e);
			_callbacks.onSuccess();
		}
		else if (e.error && e.error == Zotero.Error.ERROR_ZFS_FILE_EDITING_DENIED) {
			setTimeout(function () {
				var group = Zotero.Groups.get(e.data.groupID);
				
				var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
							.createInstance(Components.interfaces.nsIPrompt);
				var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
								+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL)
								+ pr.BUTTON_DELAY_ENABLE;
				var index = pr.confirmEx(
					Zotero.getString('general.warning'),
					// TODO: localize
					"You no longer have file editing access to the Zotero group '" + group.name + "', "
						+ "and files you've added or edited cannot be synced to the server.\n\n"
						+ "If you continue, your copy of the group will be reset to its state "
						+ "on the server, and local modifications to items and files will be lost.\n\n"
						+ "If you would like a chance to copy changed items and files elsewhere, "
						+ "cancel the sync now.",
					buttonFlags,
					"Reset Group and Sync",
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
			_callbacks.onError(e);
		}
		else if (_callbacks.onError) {
			_callbacks.onError(e);
		}
		else {
			throw (e);
		}
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
				
				default:
					throw ("Invalid queue '" + queueName + "' in Zotero.Sync.Storage.QueueManager.get()");
			}
			_queues[queueName] = queue;
		}
		
		return _queues[queueName];
	}
	
	
	/**
	 * Stop all queues
	 *
	 * @param	{Boolean}	[skipStorageFinish=false]	Don't call Zotero.Sync.Storage.finish()
	 *													when done (used when we stopped because of
	 *													an error)
	 */
	this.cancel = function (skipStorageFinish) {
		this._cancelled = true;
		if (skipStorageFinish) {
			this._skipStorageFinish = true;
		}
		for each(var queue in _queues) {
			if (!queue.isFinished() && !queue.isStopping()) {
				queue.stop();
			}
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
		
		if (this._skipStorageFinish) {
			this._cancelled = false;
			this._skipStorageFinish = false;
			return;
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
		Zotero.debug('===========');
		Zotero.debug(localData);
		Zotero.debug(remoteData);
		
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
			var item = Zotero.Sync.Storage.getItemFromRequestName(conflict.name);
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
			io.dataOut[i].id = Zotero.Sync.Storage.getItemFromRequestName(_conflicts[i].name).id;
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
	
	this.__defineGetter__('running', function () _running);
	this.__defineGetter__('stopping', function () _stopping);
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
			if (this._errors) {
				Zotero.debug("Errors:");
				Zotero.debug(this._errors);
			}
			
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
 * @param	{String}		name			Identifier for request (e.g., "[libraryID]/[key]")
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
				+ this._remaining + " for request " + this.name);
		remaining = this._remaining;
	}
	else if (remaining < 0) {
		Zotero.debug(remaining + " is less than 0 for request " + this.name);
	}
	else {
		this._remaining = remaining;
	}
	//Zotero.debug("Request '" + this.name + "' remaining is " + remaining);
	return remaining;
});


Zotero.Sync.Storage.Request.prototype.setChannel = function (channel) {
	this.channel = channel;
}


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
		throw ("Trying to update finished request " + this.name + " in "
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
	var finishNow = false;
	try {
		// If upload already finished, finish() will never be called otherwise
		if (this.channel) {
			this.channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			// Throws error if request not finished
			this.channel.requestSucceeded;
			Zotero.debug("Channel is no longer running for request " + this.name);
			Zotero.debug(this.channel.requestSucceeded);
			finishNow = true;
		}
		else {
			Zotero.debug("No channel to stop for request " + this.name);
		}
	}
	catch (e) { Zotero.debug(e); }
	
	if (!this._running || !this.channel || finishNow) {
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
			var data = this._getPassData();
			this._data.onStart(request, data);
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
		
		var data = this._getPassData();
		
		if (cancelled) {
			if (this._data.onCancel) {
				this._data.onCancel(request, status, data);
			}
		}
		else {
			if (this._data.onStop) {
				this._data.onStop(request, status, this._response, data);
			}
		}
		
		this._channel = null;
	},
	
	_getPassData: function () {
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
		return passData;
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

