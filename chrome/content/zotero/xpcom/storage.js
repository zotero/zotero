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
	this.ERROR_NO_USERNAME = -2;
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
	this.ERROR_NONEXISTENT_FILE_NOT_MISSING = -17;
	
	// TEMP
	this.__defineGetter__("defaultError", function () Zotero.getString('sync.storage.error.default', Zotero.appName));
	this.__defineGetter__("defaultErrorRestart", function () Zotero.getString('sync.storage.error.defaultRestart', Zotero.appName));
	
	//
	// Public properties
	//
	
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	this.__defineGetter__("updatesInProgress", function () _updatesInProgress);
	
	this.compressionTracker = {
		compressed: 0,
		uncompressed: 0,
		get ratio() {
			return (Zotero.Sync.Storage.compressionTracker.uncompressed - 
				Zotero.Sync.Storage.compressionTracker.compressed) /
				Zotero.Sync.Storage.compressionTracker.uncompressed;
		}
	}
	
	Zotero.Notifier.registerObserver(this, ['file']);
	
	
	//
	// Private properties
	//
	var _maxCheckAgeInSeconds = 10800; // maximum age for upload modification check (3 hours)
	var _syncInProgress;
	var _updatesInProgress;
	var _itemDownloadPercentages = {};
	var _uploadCheckFiles = [];
	var _lastFullFileCheck = {};
	
	
	this.sync = function (options) {
		if (options.libraries) {
			Zotero.debug("Starting file sync for libraries " + options.libraries);
		}
		else {
			Zotero.debug("Starting file sync");
		}
		
		var self = this;
		
		var libraryModes = {};
		var librarySyncTimes = {};
		
		// Get personal library file sync mode
		return Zotero.Promise.try(function () {
			// TODO: Make sure modes are active
			
			if (options.libraries && options.libraries.indexOf(0) == -1) {
				return;
			}
			
			if (Zotero.Sync.Storage.ZFS.includeUserFiles) {
				libraryModes[0] = Zotero.Sync.Storage.ZFS;
			}
			else if (Zotero.Sync.Storage.WebDAV.includeUserFiles) {
				libraryModes[0] = Zotero.Sync.Storage.WebDAV;
			}
		})
		.then(function () {
			// Get group library file sync modes
			if (Zotero.Sync.Storage.ZFS.includeGroupFiles) {
				var groups = Zotero.Groups.getAll();
				for each(var group in groups) {
					if (options.libraries && options.libraries.indexOf(group.libraryID) == -1) {
						continue;
					}
					// TODO: if library file syncing enabled
					libraryModes[group.libraryID] = Zotero.Sync.Storage.ZFS;
				}
			}
			
			// Cache auth credentials for each mode
			var modes = [];
			var promises = [];
			for each(var mode in libraryModes) {
				if (modes.indexOf(mode) == -1) {
					modes.push(mode);
					
					// Try to verify WebDAV server first if it hasn't been
					if (mode == Zotero.Sync.Storage.WebDAV
							&& !Zotero.Sync.Storage.WebDAV.verified) {
						Zotero.debug("WebDAV file sync is not active");
						var promise = Zotero.Sync.Storage.checkServerPromise(Zotero.Sync.Storage.WebDAV)
						.then(function () {
							return mode.cacheCredentials();
						});
					}
					else {
						var promise = mode.cacheCredentials();
					}
					promises.push(Zotero.Promise.allSettled([mode, promise]));
				}
			}
			
			return Zotero.Promise.all(promises)
			// Get library last-sync times
			.then(function (cacheCredentialsPromises) {
				var promises = [];
				
				// Mark WebDAV verification failure as user library error.
				// We ignore credentials-caching errors for ZFS and let the
				// later requests fail.
				cacheCredentialsPromises.forEach(function (results) {
					let mode = results[0].value;
					if (mode == Zotero.Sync.Storage.WebDAV) {
						if (results[1].state == "rejected") {
							promises.push(Zotero.Promise.allSettled(
								[0, Zotero.Promise.reject(results[1].reason)]
							));
							// Skip further syncing of user library
							delete libraryModes[0];
						}
					}
				});
				
				for (var libraryID in libraryModes) {
					libraryID = parseInt(libraryID);
					
					// Get the last sync time for each library
					if (self.downloadOnSync(libraryID)) {
						promises.push(Zotero.Promise.allSettled(
							[libraryID, libraryModes[libraryID].getLastSyncTime(libraryID)]
						));
					}
					// If download-as-needed, we don't need the last sync time
					else {
						promises.push(Zotero.Promise.allSettled([libraryID, null]));
					}
				}
				return Zotero.Promise.all(promises);
			});
		})
		.then(function (promises) {
			if (!promises.length) {
				Zotero.debug("No libraries are active for file sync");
				return [];
			}
			
			var libraryQueues = [];
			
			// Get the libraries we have sync times for
			promises.forEach(function (results) {
				let libraryID = results[0].value;
				let lastSyncTime = results[1].value;
				if (results[1].state == "fulfilled") {
					librarySyncTimes[libraryID] = lastSyncTime;
				}
				else {
					Zotero.debug(lastSyncTime.reason);
					Components.utils.reportError(lastSyncTime.reason);
					// Pass rejected promise through
					libraryQueues.push(results);
				}
			});
			
			// Check for updated files to upload in each library
			var promises = [];
			for (let libraryID in librarySyncTimes) {
				let promise;
				libraryID = parseInt(libraryID);
				
				if (!Zotero.Libraries.isFilesEditable(libraryID)) {
					Zotero.debug("No file editing access -- skipping file "
						+ "modification check for library " + libraryID);
					continue;
				}
				// If this is a background sync, it's not the first sync of
				// the session, the library has had at least one full check
				// this session, and it's been less than _maxCheckAgeInSeconds
				// since the last full check of this library, check only files
				// that were previously modified or opened recently
				else if (options.background
						&& !options.firstInSession
						&& _lastFullFileCheck[libraryID]
						&& (_lastFullFileCheck[libraryID] + (_maxCheckAgeInSeconds * 1000))
							> new Date().getTime()) {
					let itemIDs = _getFilesToCheck(libraryID);
					promise = self.checkForUpdatedFiles(libraryID, itemIDs);
				}
				// Otherwise check all files in the library
				else {
					_lastFullFileCheck[libraryID] = new Date().getTime();
					promise = self.checkForUpdatedFiles(libraryID);
				}
				promises.push(promise);
			}
			return Zotero.Promise.all(promises)
			.then(function () {
				// Queue files to download and upload from each library
				for (let libraryID in librarySyncTimes) {
					libraryID = parseInt(libraryID);
					
					var downloadAll = self.downloadOnSync(libraryID);
					
					// Forced downloads happen even in on-demand mode
					var sql = "SELECT COUNT(*) FROM items "
						+ "JOIN itemAttachments USING (itemID) "
						+ "WHERE libraryID=? AND syncState=?";
					var downloadForced = !!Zotero.DB.valueQuery(
						sql,
						[libraryID, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD]
					);
					
					// If we don't have any forced downloads, we can skip
					// downloads if the last sync time hasn't changed
					// or doesn't exist on the server (meaning there are no files)
					if (downloadAll && !downloadForced) {
						let lastSyncTime = librarySyncTimes[libraryID];
						if (lastSyncTime) {
							var version = self.getStoredLastSyncTime(
								libraryModes[libraryID], libraryID
							);
							if (version == lastSyncTime) {
								Zotero.debug("Last " + libraryModes[libraryID].name
									+ " sync id hasn't changed for library "
									+ libraryID + " -- skipping file downloads");
								downloadAll = false;
							}
						}
						else {
							Zotero.debug("No last " + libraryModes[libraryID].name
								+ " sync time for library " + libraryID
								+ " -- skipping file downloads");
							downloadAll = false;
						}
					}
					
					if (downloadAll || downloadForced) {
						for each(var itemID in _getFilesToDownload(libraryID, !downloadAll)) {
							var item = Zotero.Items.get(itemID);
							self.queueItem(item);
						}
					}
					
					// Get files to upload
					if (Zotero.Libraries.isFilesEditable(libraryID)) {
						for each(var itemID in _getFilesToUpload(libraryID)) {
							var item = Zotero.Items.get(itemID);
							self.queueItem(item);
						}
					}
					else {
						Zotero.debug("No file editing access -- skipping file uploads for library " + libraryID);
					}
				}
				
				// Start queues for each library
				for (let libraryID in librarySyncTimes) {
					libraryID = parseInt(libraryID);
					libraryQueues.push(Zotero.Promise.allSettled(
						[libraryID, Zotero.Sync.Storage.QueueManager.start(libraryID)]
					));
				}
				
				// The promise is done when all libraries are done
				return Zotero.Promise.all(libraryQueues);
			});
		})
		.then(function (promises) {
			Zotero.debug('Queue manager is finished');
			
			var changedLibraries = [];
			var finalPromises = [];
			
			promises.forEach(function (results) {
				var libraryID = results[0].value;
				var libraryQueues = results[1].value;
				
				if (results[1].state == "fulfilled") {
					libraryQueues.forEach(function (queuePromise) {
						if (queueZotero.Promise.isFulfilled()) {
							let result = queueZotero.Promise.value();
							Zotero.debug("File " + result.type + " sync finished "
								+ "for library " + libraryID);
							if (result.localChanges) {
								changedLibraries.push(libraryID);
							}
							finalPromises.push(Zotero.Promise.allSettled([
								libraryID,
								libraryModes[libraryID].setLastSyncTime(
									libraryID,
									result.remoteChanges ? false : librarySyncTimes[libraryID]
								)
							]));
						}
						else {
							let e = queueZotero.Promise.reason();
							Zotero.debug("File " + e.type + " sync failed "
								+ "for library " + libraryID);
							finalPromises.push(Zotero.Promise.allSettled(
								[libraryID, Zotero.Promise.reject(e)]
							));
						}
					});
				}
				else {
					Zotero.debug("File sync failed for library " + libraryID);
					finalPromises.push([libraryID, libraryQueues]);
				}
				
				// If WebDAV sync enabled, purge deleted and orphaned files
				if (libraryID == Zotero.Libraries.userLibraryID
						&& Zotero.Sync.Storage.WebDAV.includeUserFiles) {
					Zotero.Sync.Storage.WebDAV.purgeDeletedStorageFiles()
					.then(function () {
						return Zotero.Sync.Storage.WebDAV.purgeOrphanedStorageFiles();
					})
					.catch(function (e) {
						Zotero.debug(e, 1);
						Components.utils.reportError(e);
					});
				}
			});
			
			Zotero.Sync.Storage.ZFS.purgeDeletedStorageFiles()
			.catch(function (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
			});
			
			if (promises.length && !changedLibraries.length) {
				Zotero.debug("No local changes made during file sync");
			}
			
			return Zotero.Promise.all(finalPromises)
			.then(function (promises) {
				var results = {
					changesMade: !!changedLibraries.length,
					errors: []
				};
				
				promises.forEach(function (promiseResults) {
					var libraryID = promiseResults[0].value;
					if (promiseResults[1].state == "rejected") {
						let e = promiseResults[1].reason;
						if (typeof e == 'string') {
							e = new Error(e);
						}
						e.libraryID = libraryID;
						results.errors.push(e);
					}
				});
				
				return results;
			});
		});
	}
	
	
	//
	// Public methods
	//
	this.queueItem = function (item, highPriority) {
		var library = item.libraryID;
		if (libraryID) {
			var mode = Zotero.Sync.Storage.ZFS;
		}
		else {
			var mode = Zotero.Sync.Storage.ZFS.includeUserFiles
				? Zotero.Sync.Storage.ZFS : Zotero.Sync.Storage.WebDAV;
		}
		switch (Zotero.Sync.Storage.getSyncState(item.id)) {
			case this.SYNC_STATE_TO_DOWNLOAD:
			case this.SYNC_STATE_FORCE_DOWNLOAD:
				var queue = 'download';
				var callbacks = {
					onStart: function (request) {
						return mode.downloadFile(request);
					}
				};
				break;
			
			case this.SYNC_STATE_TO_UPLOAD:
			case this.SYNC_STATE_FORCE_UPLOAD:
				var queue = 'upload';
				var callbacks = {
					onStart: function (request) {
						return mode.uploadFile(request);
					}
				}; 
				break;
			
			case false:
				Zotero.debug("Sync state for item " + item.id + " not found", 2);
				return;
		}
		
		var queue = Zotero.Sync.Storage.QueueManager.get(queue, library);
		var request = new Zotero.Sync.Storage.Request(
			item.libraryID + '/' + item.key, callbacks
		);
		if (queue.type == 'upload') {
			try {
				request.setMaxSize(Zotero.Attachments.getTotalFileSize(item));
			}
			// If this fails, ignore it, though we might fail later
			catch (e) {
				// But if the file doesn't exist yet, don't try to upload it
				//
				// This isn't a perfect test, because the file could still be
				// in the process of being downloaded. It'd be better to
				// download files to a temp directory and move them into place.
				if (!item.getFile()) {
					Zotero.debug("File " + item.libraryKey + " not yet available to upload -- skipping");
					return;
				}
				
				Components.utils.reportError(e);
				Zotero.debug(e, 1);
			}
		}
		queue.addRequest(request, highPriority);
	};
	
	
	this.getStoredLastSyncTime = function (mode, libraryID) {
		var sql = "SELECT version FROM version WHERE schema=?";
		return Zotero.DB.valueQuery(
			sql, "storage_" + mode.name.toLowerCase() + "_" + libraryID
		);
	};
	
	
	this.setStoredLastSyncTime = function (mode, libraryID, time) {
		var sql = "REPLACE INTO version SET version=? WHERE schema=?";
		Zotero.DB.query(
			sql,
			[
				time,
				"storage_" + mode.name.toLowerCase() + "_" + libraryID
			]
		);
	};
	
	
	/**
	 * @param	{Integer}		itemID
	 */
	this.getSyncState = function (itemID) {
		var sql = "SELECT syncState FROM itemAttachments WHERE itemID=?";
		return Zotero.DB.valueQueryAsync(sql, itemID);
	}
	
	
	/**
	 * @param	{Integer}		itemID
	 * @param	{Integer}		syncState		Constant from Zotero.Sync.Storage
	 */
	this.setSyncState = Zotero.Promise.method(function (itemID, syncState) {
		switch (syncState) {
			case this.SYNC_STATE_TO_UPLOAD:
			case this.SYNC_STATE_TO_DOWNLOAD:
			case this.SYNC_STATE_IN_SYNC:
			case this.SYNC_STATE_FORCE_UPLOAD:
			case this.SYNC_STATE_FORCE_DOWNLOAD:
				break;
			
			default:
				throw new Error("Invalid sync state '" + syncState);
		}
		
		var sql = "UPDATE itemAttachments SET syncState=? WHERE itemID=?";
		return Zotero.DB.valueQueryAsync(sql, [syncState, itemID]);
	});
	
	
	/**
	 * @param	{Integer}			itemID
	 * @return	{Integer|NULL}					Mod time as timestamp in ms,
	 *												or NULL if never synced
	 */
	this.getSyncedModificationTime = function (itemID) {
		var sql = "SELECT storageModTime FROM itemAttachments WHERE itemID=?";
		var mtime = Zotero.DB.valueQuery(sql, itemID);
		if (mtime === false) {
			throw "Item " + itemID + " not found in "
				+ "Zotero.Sync.Storage.getSyncedModificationTime()";
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
	 * @param {Integer} itemID
	 * @return {Promise<String|null|false>} - File hash, null if never synced, if false if
	 *     file doesn't exist
	 */
	this.getSyncedHash = Zotero.Promise.coroutine(function* (itemID) {
		var sql = "SELECT storageHash FROM itemAttachments WHERE itemID=?";
		var hash = yield Zotero.DB.valueQueryAsync(sql, itemID);
		if (hash === false) {
			throw new Error("Item " + itemID + " not found");
		}
		return hash;
	})
	
	
	/**
	 * @param	{Integer}	itemID
	 * @param	{String}	hash				File hash
	 * @param	{Boolean}	[updateItem=FALSE]	Update dateModified field of
	 *												attachment item
	 */
	this.setSyncedHash = Zotero.Promise.coroutine(function* (itemID, hash, updateItem) {
		if (hash !== null && hash.length != 32) {
			throw ("Invalid file hash '" + hash + "' in Zotero.Storage.setSyncedHash()");
		}
		
		Zotero.DB.requireTransaction();
		
		var sql = "UPDATE itemAttachments SET storageHash=? WHERE itemID=?";
		yield Zotero.DB.queryAsync(sql, [hash, itemID]);
		
		if (updateItem) {
			// Update item date modified so the new mod time will be synced
			var sql = "UPDATE items SET clientDateModified=? WHERE itemID=?";
			yield Zotero.DB.queryAsync(sql, [Zotero.DB.transactionDateTime, itemID]);
		}
	});
	
	
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
	 * @param {Integer|'groups'} [libraryID]
	 */
	this.downloadAsNeeded = function (libraryID) {
		// Personal library
		if (!libraryID) {
			return Zotero.Prefs.get('sync.storage.downloadMode.personal') == 'on-demand';
		}
		// Group library (groupID or 'groups')
		else {
			return Zotero.Prefs.get('sync.storage.downloadMode.groups') == 'on-demand';
		}
	}
	
	
	/**
	 * @param {Integer|'groups'} [libraryID]
	 */
	this.downloadOnSync = function (libraryID) {
		// Personal library
		if (!libraryID) {
			return Zotero.Prefs.get('sync.storage.downloadMode.personal') == 'on-sync';
		}
		// Group library (groupID or 'groups')
		else {
			return Zotero.Prefs.get('sync.storage.downloadMode.groups') == 'on-sync';
		}
	}
	
	
	
	/**
	 * Scans local files and marks any that have changed for uploading
	 * and any that are missing for downloading
	 *
	 * @param {Integer} [libraryID]
	 * @param {Integer[]} [itemIDs]
	 * @param {Object} [itemModTimes]  Item mod times indexed by item ids;
	 *                                 items with stored mod times
	 *                                 that differ from the provided
	 *                                 time but file mod times
	 *                                 matching the stored time will
	 *                                 be marked for download
	 * @return {Promise} Promise resolving to TRUE if any items changed state,
	 *                   FALSE otherwise
	 */
	this.checkForUpdatedFiles = function (libraryID, itemIDs, itemModTimes) {
		return Zotero.Promise.try(function () {
			libraryID = parseInt(libraryID);
			if (isNaN(libraryID)) {
				libraryID = false;
			}
			
			var msg = "Checking for locally changed attachment files";
			
			var memmgr = Components.classes["@mozilla.org/memory-reporter-manager;1"]
				.getService(Components.interfaces.nsIMemoryReporterManager);
			memmgr.init();
			//Zotero.debug("Memory usage: " + memmgr.resident);
			
			if (libraryID !== false) {
				if (itemIDs) {
					if (!itemIDs.length) {
						var msg = "No files to check for local changes in library " + libraryID;
						Zotero.debug(msg);
						return false;
					}
				}
				if (itemModTimes) {
					throw new Error("itemModTimes is not allowed when libraryID is set");
				}
				
				msg += " in library " + libraryID;
			}
			else if (itemIDs) {
				throw new Error("libraryID not provided");
			}
			else if (itemModTimes) {
				if (!Object.keys(itemModTimes).length) {
					return false;
				}
				msg += " in download-marking mode";
			}
			else {
				throw new Error("libraryID, itemIDs, or itemModTimes must be provided");
			}
			Zotero.debug(msg);
			
			var changed = false;
			
			if (!itemIDs) {
				itemIDs = Object.keys(itemModTimes ? itemModTimes : {});
			}
			
			// Can only handle a certain number of bound parameters at a time
			var numIDs = itemIDs.length;
			var maxIDs = Zotero.DB.MAX_BOUND_PARAMETERS - 10;
			var done = 0;
			var rows = [];
			
			Zotero.DB.beginTransaction();
			
			do {
				var chunk = itemIDs.splice(0, maxIDs);
				var sql = "SELECT itemID, linkMode, path, storageModTime, storageHash, syncState "
							+ "FROM itemAttachments JOIN items USING (itemID) "
							+ "WHERE linkMode IN (?,?) AND syncState IN (?,?)";
				var params = [];
				params.push(
					Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
					Zotero.Attachments.LINK_MODE_IMPORTED_URL,
					Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD,
					Zotero.Sync.Storage.SYNC_STATE_IN_SYNC
				);
				if (libraryID !== false) {
					sql += " AND libraryID=?";
					params.push(libraryID);
				}
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
			
			Zotero.DB.commitTransaction();
			
			// If no files, or everything is already marked for download,
			// we don't need to do anything
			if (!rows.length) {
				var msg = "No in-sync or to-upload files found";
				if (libraryID !== false) {
					msg += " in library " + libraryID;
				}
				Zotero.debug(msg);
				return false;
			}
			
			// Index attachment data by item id
			itemIDs = [];
			var attachmentData = {};
			for each(let row in rows) {
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
			rows = null;
			
			var t = new Date();
			var items = Zotero.Items.get(itemIDs);
			var numItems = items.length;
			var updatedStates = {};
			
			let checkItems = function () {
				if (!items.length) return Zotero.Promise.resolve();
				
				//Zotero.debug("Memory usage: " + memmgr.resident);
				
				let item = items.shift();
				let row = attachmentData[item.id];
				let lk = item.libraryKey;
				Zotero.debug("Checking attachment file for item " + lk);
				
				let nsIFile = item.getFile(row, true);
				if (!nsIFile) {
					Zotero.debug("Marking pathless attachment " + lk + " as in-sync");
					updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_IN_SYNC;
					return checkItems();
				}
				let file = null;
				return Zotero.Promise.resolve(OS.File.open(nsIFile.path))
				.then(function (promisedFile) {
					file = promisedFile;
					return file.stat()
					.then(function (info) {
						//Zotero.debug("Memory usage: " + memmgr.resident);
						
						var fmtime = info.lastModificationDate.getTime();
						//Zotero.debug("File modification time for item " + lk + " is " + fmtime);
						
						if (fmtime < 1) {
							Zotero.debug("File mod time " + fmtime + " is less than 1 -- interpreting as 1", 2);
							fmtime = 1;
						}
						
						// If file is already marked for upload, skip check. Even if this
						// is download-marking mode (itemModTimes) and the file was
						// changed remotely, conflicts are checked at upload time, so we
						// don't need to worry about it here.
						if (row.state == Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD) {
							return;
						}
						
						//Zotero.debug("Stored mtime is " + row.mtime);
						//Zotero.debug("File mtime is " + fmtime);
						
						// Download-marking mode
						if (itemModTimes) {
							Zotero.debug("Remote mod time for item " + lk + " is " + itemModTimes[item.id]);
							
							// Ignore attachments whose stored mod times haven't changed
							if (row.storageModTime == itemModTimes[item.id]) {
								Zotero.debug("Storage mod time (" + row.storageModTime + ") "
									+ "hasn't changed for item " + lk);
								return;
							}
							
							Zotero.debug("Marking attachment " + lk + " for download "
								+ "(stored mtime: " + itemModTimes[item.id] + ")");
							updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD;
						}
						
						var mtime = row.mtime;
						
						// If stored time matches file, it hasn't changed locally
						if (mtime == fmtime) {
							return;
						}
						
						// Allow floored timestamps for filesystems that don't support
						// millisecond precision (e.g., HFS+)
						if (Math.floor(mtime / 1000) * 1000 == fmtime || Math.floor(fmtime / 1000) * 1000 == mtime) {
							Zotero.debug("File mod times are within one-second precision "
								+ "(" + fmtime + " ≅ " + mtime + ") for " + file.leafName
								+ " for item " + lk + " -- ignoring");
							return;
						}
						
						// Allow timestamp to be exactly one hour off to get around
						// time zone issues -- there may be a proper way to fix this
						if (Math.abs(fmtime - mtime) == 3600000
								// And check with one-second precision as well
								|| Math.abs(fmtime - Math.floor(mtime / 1000) * 1000) == 3600000
								|| Math.abs(Math.floor(fmtime / 1000) * 1000 - mtime) == 3600000) {
							Zotero.debug("File mod time (" + fmtime + ") is exactly one "
								+ "hour off remote file (" + mtime + ") for item " + lk
								+ "-- assuming time zone issue and skipping upload");
							return;
						}
						
						// If file hash matches stored hash, only the mod time changed, so skip
						return Zotero.Utilities.Internal.md5Async(file)
						.then(function (fileHash) {
							if (row.hash && row.hash == fileHash) {
								// We have to close the file before modifying it from the main
								// thread (at least on Windows, where assigning lastModifiedTime
								// throws an NS_ERROR_FILE_IS_LOCKED otherwise)
								return Zotero.Promise.resolve(file.close())
								.then(function () {
									Zotero.debug("Mod time didn't match (" + fmtime + "!=" + mtime + ") "
										+ "but hash did for " + nsIFile.leafName + " for item " + lk
										+ " -- updating file mod time");
									try {
										nsIFile.lastModifiedTime = row.mtime;
									}
									catch (e) {
										Zotero.File.checkFileAccessError(e, nsIFile, 'update');
									}
								});
							}
							
							// Mark file for upload
							Zotero.debug("Marking attachment " + lk + " as changed "
								+ "(" + mtime + " != " + fmtime + ")");
							updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD;
						});
					});
				})
				.finally(function () {
					if (file) {
						//Zotero.debug("Closing file for item " + lk);
						file.close();
					}
				})
				.catch(function (e) {
					if (e instanceof OS.File.Error &&
							(e.becauseNoSuchFile
							// This can happen if a path is too long on Windows,
							// e.g. a file is being accessed on a VM through a share
							// (and probably in other cases).
							|| (e.winLastError && e.winLastError == 3)
							// Handle long filenames on OS X/Linux
							|| (e.unixErrno && e.unixErrno == 63))) {
						Zotero.debug("Marking attachment " + lk + " as missing");
						updatedStates[item.id] = Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
						return;
					}
					
					if (e instanceof OS.File.Error) {
						if (e.becauseClosed) {
							Zotero.debug("File was closed", 2);
						}
						Zotero.debug(e);
						Zotero.debug(e.toString());
						throw new Error("Error for operation '" + e.operation + "' for " + nsIFile.path);
					}
					
					throw e;
				})
				.then(function () {
					return checkItems();
				});
			};
			
			return checkItems()
			.then(function () {
				for (let itemID in updatedStates) {
					Zotero.Sync.Storage.setSyncState(itemID, updatedStates[itemID]);
					changed = true;
				}
				
				if (!changed) {
					Zotero.debug("No synced files have changed locally");
				}
				
				let msg = "Checked " + numItems + " files in ";
				if (libraryID !== false) {
					msg += "library " + libraryID + " in ";
				}
				msg += (new Date() - t) + "ms";
				Zotero.debug(msg);
				
				return changed;
			});
		});
	};
	
	
	/**
	 * Download a single file
	 *
	 * If no queue is active, start one. Otherwise, add to existing queue.
	 */
	this.downloadFile = function (item, requestCallbacks) {
		var itemID = item.id;
		var mode = getModeFromLibrary(item.libraryID);
		
		// TODO: verify WebDAV on-demand?
		if (!mode || !mode.verified) {
			Zotero.debug("File syncing is not active for item's library -- skipping download");
			return false;
		}
		
		if (!item.isImportedAttachment()) {
			throw new Error("Not an imported attachment");
		}
		
		if (item.getFile()) {
			Zotero.debug("File already exists -- replacing");
		}
		
		// TODO: start sync icon in cacheCredentials
		return Zotero.Promise.try(function () {
			return mode.cacheCredentials();
		})
		.then(function () {
			// TODO: start sync icon
			var library = item.libraryID;
			var queue = Zotero.Sync.Storage.QueueManager.get(
				'download', library
			);
			
			if (!requestCallbacks) {
				requestCallbacks = {};
			}
			var onStart = function (request) {
				return mode.downloadFile(request);
			};
			requestCallbacks.onStart = requestCallbacks.onStart
										? [onStart, requestCallbacks.onStart]
										: onStart;
			
			var request = new Zotero.Sync.Storage.Request(
				library + '/' + item.key, requestCallbacks
			);
			
			queue.addRequest(request, true);
			queue.start();
			
			return request.promise;
		});
	}
	
	
	/**
	 * Extract a downloaded file and update the database metadata
	 *
	 * This is called from Zotero.Sync.Server.StreamListener.onStopRequest()
	 *
	 * @return {Promise<Object>} data - Promise for object with properties 'request', 'item',
	 *                                  'compressed', 'syncModTime', 'syncHash'
	 */
	this.processDownload = Zotero.Promise.coroutine(function* (data) {
		var funcName = "Zotero.Sync.Storage.processDownload()";
		
		if (!data) {
			throw "'data' not set in " + funcName;
		}
		
		if (!data.item) {
			throw "'data.item' not set in " + funcName;
		}
		
		if (!data.syncModTime) {
			throw "'data.syncModTime' not set in " + funcName;
		}
		
		if (!data.compressed && !data.syncHash) {
			throw "'data.syncHash' is required if 'data.compressed' is false in " + funcName;
		}
		
		var item = data.item;
		var syncModTime = data.syncModTime;
		var syncHash = data.syncHash;
		
		// TODO: Test file hash
		
		if (data.compressed) {
			var newFile = yield _processZipDownload(item);
		}
		else {
			var newFile = yield _processDownload(item);
		}
		
		// If |newFile| is set, the file was renamed, so set item filename to that
		// and mark for updated
		var file = item.getFile();
		if (newFile && file.leafName != newFile.leafName) {
			// Bypass library access check
			_updatesInProgress = true;
			
			// If library isn't editable but filename was changed, update
			// database without updating the item's mod time, which would result
			// in a library access error
			if (!Zotero.Items.isEditable(item)) {
				Zotero.debug("File renamed without library access -- "
					+ "updating itemAttachments path", 3);
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
			Components.utils.reportError("File '" + missingFile.leafName
				+ "' not found after processing download "
				+ item.libraryID + "/" + item.key + " in " + funcName);
			return false;
		}
		
		Zotero.DB.beginTransaction();
		
		//var syncState = Zotero.Sync.Storage.getSyncState(item.id);
		//var updateItem = syncState != this.SYNC_STATE_TO_DOWNLOAD;
		var updateItem = false;
		
		try {
			if (useCurrentModTime) {
				file.lastModifiedTime = new Date();
				
				// Reset hash and sync state
				Zotero.Sync.Storage.setSyncedHash(item.id, null);
				Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
				this.queueItem(item);
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
		
		return true;
	});
	
	
	this.checkServerPromise = function (mode) {
		return mode.checkServer()
		.spread(function (uri, status) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
			var lastWin = wm.getMostRecentWindow("navigator:browser");
			
			var success = mode.checkServerCallback(uri, status, lastWin, true);
			if (!success) {
				Zotero.debug(mode.name + " verification failed");
				
				var e = new Zotero.Error(
					Zotero.getString('sync.storage.error.verificationFailed', mode.name),
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
				throw e;
			}
		})
		.then(function () {
			Zotero.debug(mode.name + " file sync is successfully set up");
			Zotero.Prefs.set("sync.storage.verified", true);
		});
	}
	
	
	this.getItemDownloadImageNumber = function (item) {
		var numImages = 64;
		
		var lk = item.libraryID + "/" + item.key;
		
		if (typeof _itemDownloadPercentages[lk] == 'undefined') {
			return false;
		}
		
		var percentage = _itemDownloadPercentages[lk];
		return Math.round(percentage / 100 * (numImages - 1)) + 1;
	}
	
	
	this.setItemDownloadPercentage = function (libraryKey, percentage) {
		Zotero.debug("Setting image download percentage to " + percentage
			+ " for item " + libraryKey);
		
		if (percentage !== false) {
			_itemDownloadPercentages[libraryKey] = percentage;
		}
		else {
			delete _itemDownloadPercentages[libraryKey];
		}
		
		var libraryID, key;
		[libraryID, key] = libraryKey.split("/");
		var item = Zotero.Items.getByLibraryAndKey(libraryID, key);
		// TODO: yield or switch to queue
		Zotero.Notifier.trigger('redraw', 'item', item.id, { column: "hasAttachment" });
		
		var parent = item.parentItemKey;
		if (parent) {
			var parentItem = Zotero.Items.getByLibraryAndKey(libraryID, parent);
			var parentLibraryKey = libraryID + "/" + parentItem.key;
			if (percentage !== false) {
				_itemDownloadPercentages[parentLibraryKey] = percentage;
			}
			else {
				delete _itemDownloadPercentages[parentLibraryKey];
			}
			Zotero.Notifier.trigger('redraw', 'item', parentItem.id, { column: "hasAttachment" });
		}
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
		var params = [syncState];
		if (includeUserFiles && !includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID = ?)";
			params.push(Zotero.Libraries.userLibraryID);
		}
		else if (!includeUserFiles && includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID != ?)";
			params.push(Zotero.Libraries.userLibraryID);
		}
		Zotero.DB.query(sql, [syncState]);
		
		var sql = "DELETE FROM version WHERE schema LIKE 'storage_%'";
		Zotero.DB.query(sql);
	}
	
	
	this.getItemFromRequestName = function (name) {
		var [libraryID, key] = name.split('/');
		return Zotero.Items.getByLibraryAndKey(libraryID, key);
	}
	
	
	this.notify = function(event, type, ids, extraData) {
		if (event == 'open' && type == 'file') {
			let timestamp = new Date().getTime();
			
			for each(let id in ids) {
				_uploadCheckFiles.push({
					itemID: id,
					timestamp: timestamp
				});
			}
		}
	}
	
	
	//
	// Private methods
	//
	function getModeFromLibrary(libraryID) {
		if (libraryID === undefined) {
			throw new Error("libraryID not provided");
		}
		
		// Personal library
		if (!libraryID) {
			if (Zotero.Sync.Storage.ZFS.includeUserFiles) {
				return Zotero.Sync.Storage.ZFS;
			}
			if (Zotero.Sync.Storage.WebDAV.includeUserFiles) {
				return Zotero.Sync.Storage.WebDAV;
			}
			return false;
		}
		
		// Group library
		else {
			if (Zotero.Sync.Storage.ZFS.includeGroupFiles) {
				return Zotero.Sync.Storage.ZFS;
			}
			return false;
		}
	}
	
	
	var _processDownload = Zotero.Promise.coroutine(function* (item) {
		var funcName = "Zotero.Sync.Storage._processDownload()";
		
		var tempFile = Zotero.getTempDirectory();
		tempFile.append(item.key + '.tmp');
		
		if (!tempFile.exists()) {
			Zotero.debug(tempFile.path);
			throw ("Downloaded file not found in " + funcName);
		}
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item);
		if (!parentDir.exists()) {
			yield Zotero.Attachments.createDirectoryForItem(item);
		}
		
		_deleteExistingAttachmentFiles(item);
		
		var file = item.getFile(null, true);
		if (!file) {
			throw ("Empty path for item " + item.key + " in " + funcName);
		}
		// Don't save Windows aliases
		if (file.leafName.endsWith('.lnk')) {
			return false;
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
			var destFile = parentDir.clone();
			destFile.append(fileName);
			Zotero.File.createShortened(destFile, Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
		}
		catch (e) {
			Zotero.File.checkFileAccessError(e, destFile, 'create');
		}
		
		if (destFile.leafName != fileName) {
			Zotero.debug("Changed filename '" + fileName + "' to '" + destFile.leafName + "'");
			
			// Abort if Windows path limitation would cause filenames to be overly truncated
			if (Zotero.isWin && destFile.leafName.length < 40) {
				try {
					destFile.remove(false);
				}
				catch (e) {}
				// TODO: localize
				var msg = "Due to a Windows path length limitation, your Zotero data directory "
					+ "is too deep in the filesystem for syncing to work reliably. "
					+ "Please relocate your Zotero data to a higher directory.";
				Zotero.debug(msg, 1);
				throw new Error(msg);
			}
			
			renamed = true;
		}
		
		try {
			tempFile.moveTo(parentDir, destFile.leafName);
		}
		catch (e) {
			try {
				destFile.remove(false);
			}
			catch (e) {}
			
			Zotero.File.checkFileAccessError(e, destFile, 'create');
		}
		
		var returnFile = null;
		// processDownload() needs to know that we're renaming the file
		if (renamed) {
			returnFile = destFile.clone();
		}
		return returnFile;
	});
	
	
	var _processZipDownload = Zotero.Promise.coroutine(function* (item) {
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
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item);
		if (!parentDir.exists()) {
			yield Zotero.Attachments.createDirectoryForItem(item);
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
			
			if (fileName.startsWith('.zotero')) {
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
				Zotero.File.createShortened(destFile, Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
				
				zipReader.close();
				
				Zotero.File.checkFileAccessError(e, destFile, 'create');
			}
			
			if (destFile.leafName != fileName) {
				Zotero.debug("Changed filename '" + fileName + "' to '" + destFile.leafName + "'");
				
				// Abort if Windows path limitation would cause filenames to be overly truncated
				if (Zotero.isWin && destFile.leafName.length < 40) {
					try {
						destFile.remove(false);
					}
					catch (e) {}
					zipReader.close();
					// TODO: localize
					var msg = "Due to a Windows path length limitation, your Zotero data directory "
						+ "is too deep in the filesystem for syncing to work reliably. "
						+ "Please relocate your Zotero data to a higher directory.";
					Zotero.debug(msg, 1);
					throw new Error(msg);
				}
				
				if (primaryFile) {
					renamed = true;
				}
			}
			
			try {
				zipReader.extract(entryName, destFile);
			}
			catch (e) {
				try {
					destFile.remove(false);
				}
				catch (e) {}
				
				// For advertising junk files, ignore a bug on Windows where
				// destFile.create() works but zipReader.extract() doesn't
				// when the path length is close to 255.
				if (destFile.leafName.match(/[a-zA-Z0-9+=]{130,}/)) {
					var msg = "Ignoring error extracting '" + destFile.path + "'";
					Zotero.debug(msg, 2);
					Zotero.debug(e, 2);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				
				zipReader.close();
				
				Zotero.File.checkFileAccessError(e, destFile, 'create');
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
	});
	
	
	function _deleteExistingAttachmentFiles(item) {
		var funcName = "Zotero.Sync.Storage._deleteExistingAttachmentFiles()";
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item);
		
		// Delete existing files
		var otherFiles = parentDir.directoryEntries;
		otherFiles.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		var filesToDelete = [];
		var file;
		while (file = otherFiles.nextFile) {
			if (file.leafName.startsWith('.zotero')) {
				continue;
			}
			
			// Check symlink awareness, just to be safe
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
			try {
				if (file.isFile()) {
					Zotero.debug("Deleting existing file " + file.leafName);
					file.remove(false);
				}
				else if (file.isDirectory()) {
					Zotero.debug("Deleting existing directory " + file.leafName);
					file.remove(true);
				}
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, file, 'delete');
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
			
			var dir = Zotero.Attachments.getStorageDirectory(item);
			
			var tmpFile = Zotero.getTempDirectory();
			tmpFile.append(item.key + '.zip');
			
			var zw = Components.classes["@mozilla.org/zipwriter;1"]
				.createInstance(Components.interfaces.nsIZipWriter);
			zw.open(tmpFile, 0x04 | 0x08 | 0x20); // open rw, create, truncate
			var fileList = _zipDirectory(dir, dir, zw);
			if (fileList.length == 0) {
				Zotero.debug('No files to add -- removing zip file');
				zw.close();
				tmpFile.remove(null);
				return false;
			}
			
			Zotero.debug('Creating ' + tmpFile.leafName + ' with ' + fileList.length + ' file(s)');
			
			var observer = new Zotero.Sync.Storage.ZipWriterObserver(
				zw, callback, { request: request, files: fileList }
			);
			zw.processQueue(observer, null);
			return true;
		}
		// DEBUG: Do we want to catch this?
		catch (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
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
			if (fileName.startsWith('.zotero')) {
				Zotero.debug('Skipping file ' + fileName);
				continue;
			}
			
			//Zotero.debug("Adding file " + fileName);
			
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
	 * Get files marked as ready to download
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToDownload(libraryID, forcedOnly) {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
					+ "WHERE libraryID=? AND syncState IN (?";
		var params = [libraryID, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD];
		if (!forcedOnly) {
			sql += ",?";
			params.push(Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD);
		}
		sql += ") "
			// Skip attachments with empty path, which can't be saved, and files with .zotero*
			// paths, which have somehow ended up in some users' libraries
			+ "AND path!='' AND path NOT LIKE 'storage:.zotero%'";
		var itemIDs = Zotero.DB.columnQuery(sql, params);
		if (!itemIDs) {
			return [];
		}
		return itemIDs;
	}
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @inner
	 * @return	{Number[]}	Array of attachment itemIDs
	 */
	function _getFilesToUpload(libraryID) {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE syncState IN (?,?) AND linkMode IN (?,?)";
		var params = [
			Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD,
			Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD,
			Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
			Zotero.Attachments.LINK_MODE_IMPORTED_URL
		];
		if (typeof libraryID != 'undefined') {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		else {
			throw new Error("libraryID not specified");
		}
		var itemIDs = Zotero.DB.columnQuery(sql, params);
		if (!itemIDs) {
			return [];
		}
		return itemIDs;
	}
	
	
	/**
	 * Get files to check for local modifications for uploading
	 *
	 * This includes files previously modified and files opened externally
	 * via Zotero within _maxCheckAgeInSeconds.
	 */
	function _getFilesToCheck(libraryID) {
		var minTime = new Date().getTime() - (_maxCheckAgeInSeconds * 1000);
		
		// Get files by modification time
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?) AND "
			+ "storageModTime>=?";
		var params = [
			libraryID,
			Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
			Zotero.Attachments.LINK_MODE_IMPORTED_URL,
			Zotero.Sync.Storage.SYNC_STATE_IN_SYNC,
			minTime
		];
		var itemIDs = Zotero.DB.columnQuery(sql, params) || [];
		
		// Get files by open time
		_uploadCheckFiles.filter(function (x) x.timestamp >= minTime);
		itemIDs = itemIDs.concat([x.itemID for each(x in _uploadCheckFiles)])
		
		return Zotero.Utilities.arrayUnique(itemIDs);
	}
	
	
	/**
	 * @inner
	 * @return	{String[]|FALSE}			Array of keys, or FALSE if none
	 */
	this.getDeletedFiles = function () {
		var sql = "SELECT key FROM storageDeleteLog";
		return Zotero.DB.columnQuery(sql);
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
					// TODO: transaction
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
				Components.utils.reportError(msg);
				Zotero.debug(msg, 1);
				this._zipWriter.close();
				this._callback(false);
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
			+ Math.round(Zotero.Sync.Storage.compressionTracker.ratio * 100) + "%");
		
		this._callback(this._data);
	}
}
