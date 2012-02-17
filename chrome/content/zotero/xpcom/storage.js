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
	this.ERROR_FILE_MISSING_AFTER_UPLOAD = -16;
	
	// TEMP
	// TODO: localize
	this.defaultError = "A file sync error occurred. Please try syncing again.\n\nIf you receive this message repeatedly, restart " + Zotero.appName + " and/or your computer and try again. If you continue to receive the message, submit an error report and post the Report ID to a new thread in the Zotero Forums.";
	this.defaultErrorRestart = "A file sync error occurred. Please restart " + Zotero.appName + " and/or your computer and try syncing again.\n\nIf you receive this message repeatedly, submit an error report and post the Report ID to a new thread in the Zotero Forums.";
	
	//
	// Public properties
	//
	
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	this.__defineGetter__("updatesInProgress", function () _updatesInProgress);
	
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
	var _updatesInProgress;
	var _changesMade;
	var _resyncOnFinish;
	
	
	//
	// Public methods
	//
	this.sync = function (moduleName, observer) {
		var module = getModuleFromName(moduleName);
		
		if (!observer) {
			throw new Error("Observer not provided");
		}
		registerDefaultObserver(moduleName);
		Zotero.Sync.Storage.EventManager.registerObserver(observer, true, moduleName);
		
		if (!module.active) {
			if (!module.enabled) {
				Zotero.debug(module.name + " file sync is not enabled");
				Zotero.Sync.Storage.EventManager.skip();
				return;
			}
			
			Zotero.debug(module.name + " file sync is not active");
			
			// Try to verify server now if it hasn't been
			if (!module.verified) {
				module.checkServer(function (uri, status) {
					var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
					var lastWin = wm.getMostRecentWindow("navigator:browser");
					
					var success = module.checkServerCallback(uri, status, lastWin, true);
					if (success) {
						Zotero.debug(module.name + " file sync is successfully set up");
						Zotero.Sync.Storage.sync(module.name);
					}
					else {
						Zotero.debug(module.name + " verification failed");
						
						var e = new Zotero.Error(
							Zotero.getString('sync.storage.error.verificationFailed', module.name),
							0,
							{
								dialogButtonText: Zotero.getString('sync.openSyncPreferences'),
								dialogButtonCallback: function () {
									var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
											   .getService(Components.interfaces.nsIWindowMediator);
									var lastWin = wm.getMostRecentWindow("navigator:browser");
									lastWin.ZoteroPane.openPreferences('zotero-prefpane-sync');
								}
							}
						);
						Zotero.Sync.Storage.EventManager.error(e, true);
					}
				});
			}
			
			return;
		}
		
		if (!module.includeUserFiles && !module.includeGroupFiles) {
			Zotero.debug("No libraries are enabled for " + module.name + " syncing");
			Zotero.Sync.Storage.EventManager.skip();
			return;
		}
		
		if (_syncInProgress) {
			Zotero.Sync.Storage.EventManager.error(
				"File sync operation already in progress"
			);
		}
		
		Zotero.debug("Beginning " + module.name + " file sync");
		_syncInProgress = true;
		_changesMade = false;
		
		try {
			Zotero.Sync.Storage.checkForUpdatedFiles(
				null,
				null,
				module.includeUserFiles && Zotero.Sync.Storage.downloadOnSync(),
				module.includeGroupFiles && Zotero.Sync.Storage.downloadOnSync('groups')
			);
		}
		catch (e) {
			Zotero.Sync.Storage.EventManager.error(e);
		}
		
		var self = this;
		
		module.getLastSyncTime(function (lastSyncTime) {
			// Register the observers again to make sure they're active when we
			// start the queues. (They'll only be registered once.) Observers are
			// cleared when all queues finish, so without this another sync
			// process (e.g., on-demand download) could finish and clear all
			// observers while getLastSyncTime() is running.
			registerDefaultObserver(moduleName);
			Zotero.Sync.Storage.EventManager.registerObserver(observer, true, moduleName);
			
			var download = true;
			
			var sql = "SELECT COUNT(*) FROM itemAttachments WHERE syncState=?";
			var force = !!Zotero.DB.valueQuery(sql, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD);
			
			if (!force && lastSyncTime) {
				var sql = "SELECT version FROM version WHERE schema='storage_" + moduleName + "'";
				var version = Zotero.DB.valueQuery(sql);
				if (version == lastSyncTime) {
					Zotero.debug("Last " + module.name + " sync time hasn't changed -- skipping file download step");
					download = false;
				}
			}
			
			try {
				var activeDown = download ? _downloadFiles(module) : false;
				var activeUp = _uploadFiles(module);
			}
			catch (e) {
				Zotero.Sync.Storage.EventManager.error(e);
			}
			
			if (!activeDown && !activeUp) {
				Zotero.Sync.Storage.EventManager.skip();
				return;
			}
		});
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
				Zotero.Sync.Storage.EventManager.error(
					"Invalid sync state '" + syncState
						+ "' in Zotero.Sync.Storage.setSyncState()"
				);
		}
		
		var sql = "UPDATE itemAttachments SET syncState=? WHERE itemID=?";
		return Zotero.DB.valueQuery(sql, [syncState, itemID]);
	}
	
	
	/**
	 * @param	{Integer}			itemID
	 * @return	{Integer|NULL}					Mod time as timestamp in ms,
	 *												or NULL if never synced
	 */
	this.getSyncedModificationTime = function (itemID) {
		var sql = "SELECT storageModTime FROM itemAttachments WHERE itemID=?";
		var mtime = Zotero.DB.valueQuery(sql, itemID);
		if (mtime === false) {
			Zotero.Sync.Storage.EventManager.error(
				"Item " + itemID + " not found in Zotero.Sync.Storage.getSyncedModificationTime()"
			);
		}
		return mtime;
	}
	
	
	/**
	 * @param	{Integer}	itemID
	 * @param	{Integer}	mtime				File modification time as
	 *												timestamp in ms
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
			Zotero.Sync.Storage.EventManager.error(
				"Item " + itemID + " not found in Zotero.Sync.Storage.getSyncedHash()"
			);
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
				if (fileHash && fileHash == syncHash) {
					Zotero.debug("Mod time didn't match (" + fileModTime + "!=" + syncModTime + ") "
						+ "but hash did for " + file.leafName + " -- ignoring");
					return false;
				}
			}
			return true;
		}
		
		return false;
	}
	
	
	/**
	 * @param {NULL|Integer|'groups'} [libraryID]
	 */
	this.downloadAsNeeded = function (libraryID) {
		// Personal library
		if (libraryID == null) {
			return Zotero.Prefs.get('sync.storage.downloadMode.personal') == 'on-demand';
		}
		// Group library (groupID or 'groups')
		else {
			return Zotero.Prefs.get('sync.storage.downloadMode.groups') == 'on-demand';
		}
	}
	
	
	/**
	 * @param {NULL|Integer|'groups'} [libraryID]
	 */
	this.downloadOnSync = function (libraryID) {
		// Personal library
		if (libraryID == null) {
			return Zotero.Prefs.get('sync.storage.downloadMode.personal') == 'on-sync';
		}
		// Group library (groupID or 'groups')
		else {
			return Zotero.Prefs.get('sync.storage.downloadMode.groups') == 'on-sync';
		}
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
		Zotero.debug("Checking for locally changed attachment files");
		// check for current ops?
		
		if (itemIDs) {
			if (includeUserFiles || includeGroupFiles) {
				throw new Error("includeUserFiles and includeGroupFiles are not allowed when itemIDs");
			}
		}
		else {
			if (!includeUserFiles && !includeGroupFiles) {
				return false;
			}
		}
		
		if (itemModTimes && !itemIDs) {
			throw new Error("itemModTimes can only be set if itemIDs is an array");
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
			
			var fmtime = item.attachmentModificationTime;
			
			//Zotero.debug("Stored mtime is " + attachmentData[item.id].mtime);
			//Zotero.debug("File mtime is " + fmtime);
			
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
			
			var mtime = attachmentData[item.id].mtime;
			
			// If stored time matches file, it hasn't changed
			if (mtime == fmtime) {
				continue;
			}
			
			// Allow floored timestamps for filesystems that don't support
			// millisecond precision (e.g., HFS+)
			if (Math.floor(mtime / 1000) * 1000 == fmtime || Math.floor(fmtime / 1000) * 1000 == mtime) {
				Zotero.debug("File mod times are within one-second precision (" + fmtime + " ≅ " + mtime + ") "
					+ "for " + file.leafName + " -- ignoring");
				continue;
			}
			
			// Allow timestamp to be exactly one hour off to get around
			// time zone issues -- there may be a proper way to fix this
			if (Math.abs(fmtime - mtime) == 3600000
					// And check with one-second precision as well
					|| Math.abs(fmtime - Math.floor(mtime / 1000) * 1000) == 3600000
					|| Math.abs(Math.floor(fmtime / 1000) * 1000 - mtime) == 3600000) {
				Zotero.debug("File mod time (" + fmtime + ") is exactly one hour off remote file (" + mtime + ") "
					+ "-- assuming time zone issue and skipping upload");
				continue;
			}
			
			// If file is already marked for upload, skip
			if (attachmentData[item.id].state == Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD) {
				continue;
			}
			
			// If file hash matches stored hash, only the mod time changed, so skip
			var f = item.getFile();
			if (f) {
				Zotero.debug(f.path);
			}
			else {
				Zotero.debug("File missing before getting hash");
			}
			var fileHash = item.attachmentHash;
			if (attachmentData[item.id].hash && attachmentData[item.id].hash == fileHash) {
				Zotero.debug("Mod time didn't match (" + fmtime + "!=" + mtime + ") "
					+ "but hash did for " + file.leafName + " -- updating file mod time");
				try {
					file.lastModifiedTime = attachmentData[item.id].mtime;
				}
				catch (e) {
					Zotero.File.checkFileAccessError(e, file, 'update');
				}
				continue;
			}
			
			Zotero.debug("Marking attachment " + item.id + " as changed ("
				+ mtime + " != " + fmtime + ")");
			updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD;
		}
		
		for (var itemID in updatedStates) {
			Zotero.Sync.Storage.setSyncState(itemID, updatedStates[itemID]);
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
	 * Download a single file
	 *
	 * If no queue is active, start one. Otherwise, add to existing queue.
	 */
	this.downloadFile = function (item, requestCallbacks) {
		var itemID = item.id;
		var module = getModuleFromLibrary(item.libraryID);
		
		if (!module || !module.active) {
			Zotero.debug("File syncing is not active for item's library -- skipping download");
			return false;
		}
		
		if (!item.isImportedAttachment()) {
			throw new Error("Not an imported attachment");
		}
		
		if (item.getFile()) {
			Zotero.debug("File already exists -- replacing");
		}
		
		var setup = function () {
			Zotero.Sync.Storage.EventManager.registerObserver({
				onSuccess: function () _syncInProgress = false,
				
				onSkip: function () _syncInProgress = false,
				
				onStop: function () _syncInProgress = false,
				
				onError: function (e) {
					Zotero.Sync.Runner.setSyncIcon('error', e);
					error(e);
					requestCallbacks.onStop();
				}
			}, false, "downloadFile");
			
			try {
				var queue = Zotero.Sync.Storage.QueueManager.get('download');
				
				var isRunning = queue.isRunning();
				if (!isRunning) {
					_syncInProgress = true;
					
					// Reset the sync icon
					Zotero.Sync.Runner.setSyncIcon();
				}
			}
			catch (e) {
				Zotero.Sync.Storage.EventManager.error(e);
			}
			
			return isRunning;
		};
		
		var run = function () {
			// We have to perform setup again at the same time that we add the
			// request, because otherwise a sync process could complete while
			// cacheCredentials() is running and clear the event handlers.
			var isRunning = setup();
			
			try {
				var queue = Zotero.Sync.Storage.QueueManager.get('download');
				
				if (!requestCallbacks) {
					requestCallbacks = {};
				}
				var onStart = function (request) {
					module.downloadFile(request);
				};
				requestCallbacks.onStart = requestCallbacks.onStart
											? [onStart, requestCallbacks.onStart]
											: onStart;
				
				var request = new Zotero.Sync.Storage.Request(
					item.libraryID + '/' + item.key, requestCallbacks
				);
				
				queue.addRequest(request, isRunning);
			}
			catch (e) {
				Zotero.Sync.Storage.EventManager.error(e);
			}
		};
		
		setup();
		module.cacheCredentials(function () {
			run();
		});
		
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
			Zotero.Sync.Storage.EventManager.error("|data| not set in " + funcName);
		}
		
		if (!data.item) {
			Zotero.Sync.Storage.EventManager.error("|data.item| not set in " + funcName);
		}
		
		if (!data.syncModTime) {
			Zotero.Sync.Storage.EventManager.error("|data.syncModTime| not set in " + funcName);
		}
		
		if (!data.compressed && !data.syncHash) {
			Zotero.Sync.Storage.EventManager.error("|data.syncHash| is required if  |data.compressed| is false in " + funcName);
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
		
		// If |newFile| is set, the file was renamed, so set item filename to that
		// and mark for updated
		var file = item.getFile();
		if (newFile && file.leafName != newFile.leafName) {
			_updatesInProgress = true;
			
			// If library isn't editable but filename was changed, update
			// database without updating the item's mod time, which would result
			// in a library access error
			if (!Zotero.Items.editCheck(item)) {
				Zotero.debug("File renamed without library access -- updating itemAttachments path", 3);
				item.relinkAttachmentFile(newFile, true);
				var useCurrentModTime = false;
			}
			else {
				item.relinkAttachmentFile(newFile);
				
				// TODO: use an integer counter instead of mod time for change detection
				var useCurrentModTime = true;
			}
			
			file = item.getFile();
			_updatesInProgress = false;
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
		
		try {
			if (useCurrentModTime) {
				file.lastModifiedTime = new Date();
				
				// Reset hash and sync state
				Zotero.Sync.Storage.setSyncedHash(item.id, null);
				Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
				_resyncOnFinish = true;
			}
			else {
				file.lastModifiedTime = syncModTime;
				// If hash not provided (e.g., WebDAV), calculate it now
				if (!syncHash) {
					syncHash = item.attachmentHash;
				}
				Zotero.Sync.Storage.setSyncedHash(item.id, syncHash);
				Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
			}
		}
		catch (e) {
			Zotero.File.checkFileAccessError(e, file, 'update');
		}
		
		Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
		Zotero.DB.commitTransaction();
		_changesMade = true;
	}
	
	
	this.checkServer = function (moduleName, callback) {
		var module = getModuleFromName(moduleName);
		Zotero.Sync.Storage.EventManager.registerObserver({
			onSuccess: function () {},
			onError: function (e) {
				Zotero.debug(e, 1);
				callback(null, null, function () {
					// If there's an error, just display that
					Zotero.Utilities.Internal.errorPrompt(Zotero.getString('general.error'), e);
				});
				return true;
			}
		}, false, "checkServer");
		return module.checkServer(function (uri, status) {
			callback(uri, status, function () {
				module.checkServerCallback(uri, status);
			});
		});
	}
	
	
	this.purgeDeletedStorageFiles = function (moduleName, callback) {
		var module = getModuleFromName(moduleName);
		if (!module.active) {
			return;
		}
		Zotero.Sync.Storage.EventManager.registerObserver({
			onError: function (e) {
				error(e);
			}
		}, false, "purgeDeletedStorageFiles");
		module.purgeDeletedStorageFiles(callback);
	}
	
	
	this.purgeOrphanedStorageFiles = function (moduleName, callback) {
		var module = getModuleFromName(moduleName);
		if (!module.active) {
			return;
		}
		Zotero.Sync.Storage.EventManager.registerObserver({
			onError: function (e) {
				error(e);
			}
		}, false, "purgeOrphanedStorageFiles");
		module.purgeOrphanedStorageFiles(callback);
	}
	
	
	this.isActive = function (moduleName) {
		return getModuleFromName(moduleName).active;
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
	function getModuleFromName(moduleName) {
		return new Zotero.Sync.Storage.Module(moduleName);
	}
	
	
	function getModuleFromLibrary(libraryID) {
		if (libraryID === undefined) {
			throw new Error("libraryID not provided");
		}
		
		// Personal library
		if (libraryID === null) {
			if (!Zotero.Prefs.get('sync.storage.enabled')) {
				Zotero.debug('disabled');
				return false;
			}
			
			var protocol = Zotero.Prefs.get('sync.storage.protocol');
			switch (protocol) {
				case 'zotero':
					return getModuleFromName('ZFS');
				
				case 'webdav':
					return getModuleFromName('WebDAV');
				
				default:
					throw new Error("Invalid storage protocol '" + protocol + "'");
			}
		}
		
		// Group library
		else {
			if (!Zotero.Prefs.get('sync.storage.groups.enabled')) {
				return false;
			}
			
			return getModuleFromName('ZFS');
		}
	}
	
	
	/**
	 * Starts download of all attachments marked for download
	 *
	 * @return	{Boolean}
	 */
	function _downloadFiles(module) {
		if (!_syncInProgress) {
			_syncInProgress = true;
		}
		
		var includeUserFiles = module.includeUserFiles && Zotero.Sync.Storage.downloadOnSync();
		var includeGroupFiles = module.includeGroupFiles && Zotero.Sync.Storage.downloadOnSync('groups');
		
		if (!includeUserFiles && !includeGroupFiles) {
			Zotero.debug("No libraries are enabled for on-sync downloading");
			return false;
		}
		
		var downloadFileIDs = _getFilesToDownload(includeUserFiles, includeGroupFiles);
		if (!downloadFileIDs) {
			Zotero.debug("No files to download");
			return false;
		}
		
		// Check for active operations?
		
		var queue = Zotero.Sync.Storage.QueueManager.get('download');
		
		for each(var itemID in downloadFileIDs) {
			var item = Zotero.Items.get(itemID);
			if (Zotero.Sync.Storage.getSyncState(itemID) !=
						Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD
					&& Zotero.Sync.Storage.isFileModified(itemID)) {
				Zotero.debug("File for attachment " + itemID + " has been modified");
				Zotero.Sync.Storage.setSyncState(itemID, this.SYNC_STATE_TO_UPLOAD);
				continue;
			}
			
			var request = new Zotero.Sync.Storage.Request(
				item.libraryID + '/' + item.key,
				{
					onStart: function (request) {
						module.downloadFile(request);
					}
				}
			);
			queue.addRequest(request);
		}
		
		return true;
	}
	
	
	/**
	 * Start upload of all attachments marked for upload
	 *
	 * @return	{Boolean}
	 */
	function _uploadFiles(module) {
		if (!_syncInProgress) {
			_syncInProgress = true;
		}
		
		var uploadFileIDs = _getFilesToUpload(module.includeUserFiles, module.includeGroupFiles);
		if (!uploadFileIDs) {
			Zotero.debug("No files to upload");
			return false;
		}
		
		// Check for active operations?
		var queue = Zotero.Sync.Storage.QueueManager.get('upload');
		
		Zotero.debug(uploadFileIDs.length + " file(s) to upload");
		
		for each(var itemID in uploadFileIDs) {
			var item = Zotero.Items.get(itemID);
			
			var request = new Zotero.Sync.Storage.Request(
				item.libraryID + '/' + item.key,
				{
					onStart: function (request) {
						module.uploadFile(request);
					}
				}
			);
			request.progressMax = Zotero.Attachments.getTotalFileSize(item, true);
			queue.addRequest(request);
		}
		
		return true;
	}
	
	
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
		
		var fileName = file.leafName;
		var renamed = false;
		
		// Make sure the new filename is valid, in case an invalid character made it over
		// (e.g., from before we checked for them)
		var filteredName = Zotero.File.getValidFileName(fileName);
		if (filteredName != fileName) {
			Zotero.debug("Filtering filename '" + fileName + "' to '" + filteredName + "'");
			fileName = filteredName;
			file.leafName = fileName;
			renamed = true;
		}
		
		Zotero.debug("Moving download file " + tempFile.leafName + " into attachment directory as '" + fileName + "'");
		try {
			tempFile.moveTo(parentDir, fileName);
		}
		catch (e) {
			var destFile = file.clone();
			
			var windowsLength = false;
			var nameLength = false;
			
			// Windows API only allows paths of 260 characters
			if (e.name == "NS_ERROR_FILE_NOT_FOUND" && destFile.path.length > 255) {
				windowsLength = true;
			}
			// ext3/ext4/HFS+ have a filename length limit of ~254 bytes
			//
			// These filenames will almost always be ASCII ad files,
			// but allow an extra 10 bytes anyway
			else if (e.name == "NS_ERROR_FAILURE" && destFile.leafName.length >= 244) {
				nameLength = true;
			}
			// Filesystem encryption (or, more specifically, filename encryption)
			// can result in a lower limit -- not much we can do about this,
			// but log a warning and skip the file
			else if (e.name == "NS_ERROR_FAILURE" && Zotero.isLinux && destFile.leafName.length > 130) {
				Zotero.debug(e);
				var msg = "Error creating file '" + destFile.leafName + "'\n\n"
					+ "See http://www.zotero.org/support/kb/encrypted_filenames for more information.";
				Components.utils.reportError(msg);
				return;
			}
			
			if (windowsLength || nameLength) {
				// Preserve extension
				var matches = destFile.leafName.match(/\.[a-z0-9]{0,8}$/);
				var ext = matches ? matches[0] : "";
				
				if (windowsLength) {
					var pathLength = destFile.path.length - destFile.leafName.length;
					var newLength = 255 - pathLength;
					// Require 40 available characters in path -- this is arbitrary,
					// but otherwise filenames are going to end up being cut off
					if (newLength < 40) {
						var msg = "Due to a Windows path length limitation, your Zotero data directory "
								+ "is too deep in the filesystem for syncing to work reliably. "
								+ "Please relocate your Zotero data to a higher directory.";
						throw (msg);
					}
				}
				else {
					var newLength = 254;
				}
				
				// Shorten file if it's too long -- we don't relink it, but this should
				// be pretty rare and probably only occurs on extraneous files with
				// gibberish for filenames
				var fileName = destFile.leafName.substr(0, newLength - (ext.length + 1)) + ext;
				var msg = "Shortening filename to '" + fileName + "'";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				
				tempFile.moveTo(parentDir, fileName);
				renamed = true;
			}
			else {
				Components.utils.reportError(e);
				var msg = Zotero.getString('sync.storage.error.fileNotCreated', parentDir.leafName + '/' + fileName);
				throw(msg);
			}
		}
		
		var returnFile = null;
		// processDownload() needs to know that we're renaming the file
		if (renamed) {
			var returnFile = file.clone();
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
			zipReader.close();
			
			try {
				zipFile.remove(false);
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, zipFile, 'delete');
			}
			
			// TODO: Remove prop file to trigger reuploading, in case it was an upload error?
			
			return false;
		}
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item.id);
		if (!parentDir.exists()) {
			Zotero.Attachments.createDirectoryForItem(item.id);
		}
		
		try {
			_deleteExistingAttachmentFiles(item);
		}
		catch (e) {
			zipReader.close();
			throw (e);
		}
		
		var returnFile = null;
		var count = 0;
		
		var entries = zipReader.findEntries(null);
		while (entries.hasMore()) {
			count++;
			var entryName = entries.getNext();
			var b64re = /%ZB64$/;
			if (entryName.match(b64re)) {
				var fileName = Zotero.Utilities.Internal.Base64.decode(
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
			
			var primaryFile = false;
			var filtered = false;
			var renamed = false;
			
			// Get the old filename
			var itemFileName = item.getFilename();
			
			// Make sure the new filename is valid, in case an invalid character
			// somehow make it into the ZIP (e.g., from before we checked for them)
			//
			// Do this before trying to use the relative descriptor, since otherwise
			// it might fail silently and select the parent directory
			var filteredName = Zotero.File.getValidFileName(fileName);
			if (filteredName != fileName) {
				Zotero.debug("Filtering filename '" + fileName + "' to '" + filteredName + "'");
				fileName = filteredName;
				filtered = true;
			}
			
			// Name in ZIP is a relative descriptor, so file has to be reconstructed
			// using setRelativeDescriptor()
			var destFile = parentDir.clone();
			destFile.QueryInterface(Components.interfaces.nsILocalFile);
			destFile.setRelativeDescriptor(parentDir, fileName);
			
			fileName = destFile.leafName;
			
			// If only one file in zip and it doesn't match the known filename,
			// take our chances and use that name
			if (count == 1 && !entries.hasMore() && itemFileName) {
				// May not be necessary, but let's be safe
				itemFileName = Zotero.File.getValidFileName(itemFileName);
				if (itemFileName != fileName) {
					Zotero.debug("Renaming single file '" + fileName + "' in ZIP to known filename '" + itemFileName + "'", 2);
					Components.utils.reportError("Renaming single file '" + fileName + "' in ZIP to known filename '" + itemFileName + "'");
					fileName = itemFileName;
					destFile.leafName = fileName;
					renamed = true;
				}
			}
			
			var primaryFile = itemFileName == fileName;
			if (primaryFile && filtered) {
				renamed = true;
			}
			
			if (destFile.exists()) {
				var msg = "ZIP entry '" + fileName + "' " + "already exists";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg + " in " + funcName);
				continue;
			}
			try {
				destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
			}
			catch (e) {
				Zotero.debug(e, 1);
				
				var windowsLength = false;
				var nameLength = false;
				
				// Windows API only allows paths of 260 characters
				if (e.name == "NS_ERROR_FILE_NOT_FOUND" && destFile.path.length > 255) {
					Zotero.debug("Path is " + destFile.path);
					windowsLength = true;
				}
				// ext3/ext4/HFS+ have a filename length limit of ~254 bytes
				//
				// These filenames will almost always be ASCII ad files,
				// but allow an extra 10 bytes anyway
				else if (e.name == "NS_ERROR_FAILURE" && destFile.leafName.length >= 244) {
					Zotero.debug("Filename is " + destFile.leafName);
					nameLength = true;
				}
				// Filesystem encryption (or, more specifically, filename encryption)
				// can result in a lower limit -- not much we can do about this,
				// but log a warning and skip the file
				else if (e.name == "NS_ERROR_FAILURE" && Zotero.isLinux && destFile.leafName.length > 130) {
					// TODO: localize
					var msg = "Error creating file '" + destFile.leafName + "'. "
						+ "See http://www.zotero.org/support/kb/encrypted_filenames for more information.";
					Components.utils.reportError(msg);
					continue;
				}
				else {
					Zotero.debug("Path is " + destFile.path);
				}
				
				if (windowsLength || nameLength) {
					// Preserve extension
					var matches = destFile.leafName.match(/\.[a-z0-9]{0,8}$/);
					var ext = matches ? matches[0] : "";
					
					if (windowsLength) {
						var pathLength = destFile.path.length - destFile.leafName.length;
						var newLength = 254 - pathLength;
						// Require 40 available characters in path -- this is arbitrary,
						// but otherwise filenames are going to end up being cut off
						if (newLength < 40) {
							zipReader.close();
							var msg = "Due to a Windows path length limitation, your Zotero data directory "
									+ "is too deep in the filesystem for syncing to work reliably. "
									+ "Please relocate your Zotero data to a higher directory.";
							throw (msg);
						}
					}
					else {
						var newLength = 254;
					}
					
					// Shorten file if it's too long -- we don't relink it, but this should
					// be pretty rare and probably only occurs on extraneous files with
					// gibberish for filenames
					//
					// Shortened file could already exist if there was another file with a
					// similar name that was also longer than the limit, so we do this in a
					// loop, adding numbers if necessary
					var step = 0;
					do {
						if (step == 0) {
							var newName = destFile.leafName.substr(0, newLength - ext.length) + ext;
						}
						else {
							var newName = destFile.leafName.substr(0, newLength - ext.length) + "-" + step + ext;
						}
						destFile.leafName = newName;
						step++;
					}
					while (destFile.exists());
					
					var msg = "Shortening filename to '" + newName + "'";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg);
					
					try {
						destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
					}
					catch (e) {
						// See above
						if (e.name == "NS_ERROR_FAILURE" && Zotero.isLinux && destFile.leafName.length > 130) {
							Zotero.debug(e);
							// TODO: localize
							var msg = "Error creating file '" + destFile.leafName + "'. "
								+ "See http://www.zotero.org/support/kb/encrypted_filenames for more information.";
							Components.utils.reportError(msg);
							continue;
						}
						
						zipReader.close();
						
						Components.utils.reportError(e);
						var msg = Zotero.getString('sync.storage.error.fileNotCreated', parentDir.leafName + '/' + fileName);
						throw(msg);
					}
					
					if (primaryFile) {
						renamed = true;
					}
				}
				else {
					zipReader.close();
					
					Components.utils.reportError(e);
					var msg = Zotero.getString('sync.storage.error.fileNotCreated', parentDir.leafName + '/' + fileName);
					throw(msg);
				}
			}
			try {
				zipReader.extract(entryName, destFile);
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, destFile, 'create');
			}
			
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
			
			// If we're renaming the main file, processDownload() needs to know
			if (renamed) {
				returnFile = destFile;
			}
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
		otherFiles.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		var filesToDelete = [];
		var file;
		while (file = otherFiles.nextFile) {
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
			
			filesToDelete.push(file);
		}
		otherFiles.close();
		
		// Do deletes outside of the enumerator to avoid an access error on Windows
		for each(var file in filesToDelete) {
			if (file.isFile()) {
				Zotero.debug("Deleting existing file " + file.leafName);
				try {
					file.remove(false);
				}
				catch (e) {
					Zotero.File.checkFileAccessError(e, file, 'delete');
				}
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
			
			fileName = Zotero.Utilities.Internal.Base64.encode(fileName) + "%ZB64";
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
			Zotero.Sync.Storage.EventManager.error(
				"At least one of includeUserFiles or includeGroupFiles must be set "
					+ "in Zotero.Sync.Storage._getFilesToDownload()"
			);
		}
		
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
					+ "WHERE syncState IN (?,?) "
					// Skip attachments with empty path, which can't be saved
					+ "AND path!=''";
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
			Zotero.Sync.Storage.EventManager.error(
				"At least one of includeUserFiles or includeGroupFiles must be set "
					+ "in Zotero.Sync.Storage._getFilesToUpload()"
			);
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
	
	
	function registerDefaultObserver(moduleName) {
		var finish = function (cancelled, skipSuccessFile) {
			// Upload success file when done
			if (!_resyncOnFinish && !skipSuccessFile) {
				// If we finished successfully and didn't upload any files, save the
				// last sync time locally rather than setting a new one on the server,
				// since we don't want other clients to check for new files
				var uploadQueue = Zotero.Sync.Storage.QueueManager.get('upload', true);
				var useLastSyncTime = !uploadQueue || (!cancelled && uploadQueue.lastTotalRequests == 0);
				
				getModuleFromName(moduleName).setLastSyncTime(function () {
					finish(cancelled, true);
				}, useLastSyncTime);
				return false;
			}
			
			Zotero.debug(moduleName + " sync is complete");
			
			_syncInProgress = false;
			
			if (_resyncOnFinish) {
				Zotero.debug("Force-resyncing items in conflict");
				_resyncOnFinish = false;
				Zotero.Sync.Storage.sync(moduleName);
				return false;
			}
			
			if (cancelled) {
				Zotero.Sync.Storage.EventManager.stop();
			}
			else if (!_changesMade) {
				Zotero.debug("No changes made during storage sync");
				Zotero.Sync.Storage.EventManager.skip();
			}
			else {
				Zotero.Sync.Storage.EventManager.success();
			}
			
			return true;
		};
		
		Zotero.Sync.Storage.EventManager.registerObserver({
			onSuccess: function () finish(),
			
			onSkip: function () {
				_syncInProgress = false
			},
			
			onStop: function () finish(true),
			
			onError: function (e) error(e),
			
			onChangesMade: function () _changesMade = true
		}, false, "default");
	}
	
	
	function error(e) {
		if (_syncInProgress) {
			Zotero.Sync.Storage.QueueManager.cancel(true);
			_syncInProgress = false;
		}
		
		Zotero.DB.rollbackAllTransactions();
		
		if (e) {
			Zotero.debug(e, 1);
		}
		else {
			e = Zotero.Sync.Storage.defaultError;
		}
		
		if (e.error && e.error == Zotero.Error.ERROR_ZFS_FILE_EDITING_DENIED) {
			setTimeout(function () {
				var group = Zotero.Groups.get(e.data.groupID);
				
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
								+ ps.BUTTON_DELAY_ENABLE;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('sync.storage.error.fileEditingAccessLost', group.name) + "\n\n"
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
		}
	}
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
			if (!entry) {
				var msg = "ZIP entry '" + fileName + "' not found for request '" + this._data.request.name + "'";
				Zotero.debug(msg, 1);
				this._zipWriter.close();
				this._data.request.error(msg);
				return;
			}
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
