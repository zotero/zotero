Zotero.Sync.Storage.Local = {
	//
	// Constants
	//
	SYNC_STATE_TO_UPLOAD: 0,
	SYNC_STATE_TO_DOWNLOAD: 1,
	SYNC_STATE_IN_SYNC: 2,
	SYNC_STATE_FORCE_UPLOAD: 3,
	SYNC_STATE_FORCE_DOWNLOAD: 4,
	SYNC_STATE_IN_CONFLICT: 5,
	
	lastFullFileCheck: {},
	uploadCheckFiles: [],
	storageRemainingForLibrary: new Map(),
	
	init: function () {
		Zotero.Notifier.registerObserver(this, ['group'], 'storageLocal');
	},
	
	notify: async function (action, type, ids, _extraData) {
		// Clean up cache on group deletion
		if (action == 'delete' && type == 'group') {
			for (let libraryID of ids) {
				if (this.lastFullFileCheck[libraryID]) {
					delete this.lastFullFileCheck[libraryID];
				}
				if (this.storageRemainingForLibrary.has(libraryID)) {
					this.storageRemainingForLibrary.delete(libraryID);
				}
			}
		}
	},
	
	getEnabledForLibrary: function (libraryID) {
		// The user must have synced for the first time before we allow storage requests.
		// This is relevant if an account is set up for syncing but the DB file is cleared and the
		// user double-clicks on a missing file in download-as-needed mode.
		if (!Zotero.Users.getCurrentUserID()) {
			return false;
		}
		var libraryType = Zotero.Libraries.get(libraryID).libraryType;
		switch (libraryType) {
		case 'user':
			return Zotero.Prefs.get("sync.storage.enabled");
		
		// TEMP: Always sync publications files, at least until we have a better interface for
		// setting library-specific settings
		case 'publications':
			return true;
		
		case 'group':
			return Zotero.Prefs.get("sync.storage.groups.enabled");
		
		case 'feed':
			return false;
		
		default:
			throw new Error(`Unexpected library type '${libraryType}'`);
		}
	},
	
	getClassForLibrary: function (libraryID) {
		return Zotero.Sync.Storage.Utilities.getClassForMode(this.getModeForLibrary(libraryID));
	},
	
	getModeForLibrary: function (libraryID) {
		var libraryType = Zotero.Libraries.get(libraryID).libraryType;
		switch (libraryType) {
		case 'user':
			return Zotero.Prefs.get("sync.storage.protocol") == 'webdav' ? 'webdav' : 'zfs';
		
		case 'publications':
		case 'group':
		// TODO: Remove after making sure this is never called for feed libraries
		case 'feed':
			return 'zfs';
		
		default:
			throw new Error(`Unexpected library type '${libraryType}'`);
		}
	},
	
	setModeForLibrary: function (libraryID, mode) {
		var libraryType = Zotero.Libraries.get(libraryID).libraryType;
		
		if (libraryType != 'user') {
			throw new Error(`Cannot set storage mode for ${libraryType} library`);
		}
		
		switch (mode) {
		case 'webdav':
		case 'zfs':
			Zotero.Prefs.set("sync.storage.protocol", mode);
			break;
		
		default:
			throw new Error(`Unexpected storage mode '${mode}'`);
		}
	},
	
	/**
	 * Check or enable download-as-needed mode
	 *
	 * @param {Integer} [libraryID]
	 * @param {Boolean} [enable] - If true, enable download-as-needed mode for the given library
	 * @return {Boolean|undefined} - If 'enable' isn't set to true, return true if
	 *     download-as-needed mode enabled and false if not
	 */
	downloadAsNeeded: function (libraryID, enable) {
		var pref = this._getDownloadPrefFromLibrary(libraryID);
		var val = 'on-demand';
		if (enable) {
			Zotero.Prefs.set(pref, val);
			return;
		}
		return Zotero.Prefs.get(pref) == val;
	},
	
	/**
	 * Check or enable download-on-sync mode
	 *
	 * @param {Integer} [libraryID]
	 * @param {Boolean} [enable] - If true, enable download-on-demand mode for the given library
	 * @return {Boolean|undefined} - If 'enable' isn't set to true, return true if
	 *     download-as-needed mode enabled and false if not
	 */
	downloadOnSync: function (libraryID, enable) {
		var pref = this._getDownloadPrefFromLibrary(libraryID);
		var val = 'on-sync';
		if (enable) {
			Zotero.Prefs.set(pref, val);
			return;
		}
		return Zotero.Prefs.get(pref) == val;
	},
	
	_getDownloadPrefFromLibrary: function (libraryID) {
		if (libraryID == Zotero.Libraries.userLibraryID) {
			return 'sync.storage.downloadMode.personal';
		}
		// TODO: Library-specific settings
		
		// Group library
		return 'sync.storage.downloadMode.groups';
	},
	
	/**
	 * Get files to check for local modifications for uploading
	 *
	 * This includes files previously modified or opened externally via Zotero within maxCheckAge
	 */
	getFilesToCheck: Zotero.Promise.coroutine(function* (libraryID, maxCheckAge) {
		var minTime = new Date().getTime() - (maxCheckAge * 1000);
		
		// Get files modified and synced since maxCheckAge
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?) AND "
			+ "storageModTime>=?";
		var params = [
			libraryID,
			Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
			Zotero.Attachments.LINK_MODE_IMPORTED_URL,
			this.SYNC_STATE_IN_SYNC,
			minTime
		];
		var itemIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		
		// Get files opened since maxCheckAge
		itemIDs = itemIDs.concat(
			this.uploadCheckFiles.filter(x => x.timestamp >= minTime).map(x => x.itemID)
		);
		
		return Zotero.Utilities.arrayUnique(itemIDs);
	}),
	
	
	/**
	 * Scans local files and marks any that have changed for uploading
	 * and any that are missing for downloading
	 *
	 * @param {Integer} libraryID
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
	checkForUpdatedFiles: Zotero.Promise.coroutine(function* (libraryID, itemIDs, itemModTimes) {
		var libraryName = Zotero.Libraries.getName(libraryID);
		var msg = "Checking for locally changed attachment files in " + libraryName;
		
		var memmgr = Components.classes["@mozilla.org/memory-reporter-manager;1"]
			.getService(Components.interfaces.nsIMemoryReporterManager);
		memmgr.init();
		//Zotero.debug("Memory usage: " + memmgr.resident);
		
		if (itemIDs) {
			if (!itemIDs.length) {
				Zotero.debug("No files to check for local changes");
				return false;
			}
		}
		if (itemModTimes) {
			if (!Object.keys(itemModTimes).length) {
				return false;
			}
			msg += " in download-marking mode";
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
		
		do {
			let chunk = itemIDs.splice(0, maxIDs);
			let sql = "SELECT itemID, linkMode, path, storageModTime, storageHash, syncState "
						+ "FROM itemAttachments JOIN items USING (itemID) "
						+ "WHERE linkMode IN (?,?) AND syncState IN (?,?)";
			let params = [
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				this.SYNC_STATE_TO_UPLOAD,
				this.SYNC_STATE_IN_SYNC
			];
			if (libraryID !== false) {
				sql += " AND libraryID=?";
				params.push(libraryID);
			}
			if (chunk.length) {
				sql += " AND itemID IN (" + chunk.map(() => '?').join() + ")";
				params = params.concat(chunk);
			}
			let chunkRows = yield Zotero.DB.queryAsync(sql, params);
			if (chunkRows) {
				rows = rows.concat(chunkRows);
			}
			done += chunk.length;
		}
		while (done < numIDs);
		
		// If no files, or everything is already marked for download,
		// we don't need to do anything
		if (!rows.length) {
			Zotero.debug("No in-sync or to-upload files found in " + libraryName);
			return false;
		}
		
		// Index attachment data by item id
		itemIDs = [];
		var attachmentData = {};
		for (let row of rows) {
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
		var items = yield Zotero.Items.getAsync(itemIDs, { noCache: true });
		var numItems = items.length;
		var updatedStates = {};
		
		//Zotero.debug("Memory usage: " + memmgr.resident);
		
		var changed = false;
		var statesToSet = {};
		for (let item of items) {
			// TODO: Catch error?
			let state = yield this._checkForUpdatedFile(item, attachmentData[item.id]);
			if (state !== false) {
				if (!statesToSet[state]) {
					statesToSet[state] = [];
				}
				statesToSet[state].push(item);
				changed = true;
			}
		}
		// Update sync states in bulk
		if (changed) {
			yield Zotero.DB.executeTransaction(function* () {
				for (let state in statesToSet) {
					yield this.updateSyncStates(statesToSet[state], parseInt(state));
				}
			}.bind(this));
		}
		
		if (!items.length) {
			Zotero.debug("No synced files have changed locally");
		}
		
		Zotero.debug(`Checked ${numItems} files in ${libraryName} in ` + (new Date() - t) + " ms");
		
		return changed;
	}),
	
	
	_checkForUpdatedFile: Zotero.Promise.coroutine(function* (item, attachmentData, remoteModTime) {
		var lk = item.libraryKey;
		Zotero.debug("Checking attachment file for item " + lk, 4);
		
		var path = item.getFilePath();
		if (!path) {
			Zotero.debug("Marking pathless attachment " + lk + " as in-sync");
			return this.SYNC_STATE_IN_SYNC;
		}
		var fileName = OS.Path.basename(path);
		var file;
		
		try {
			file = yield OS.File.open(path);
			let info = yield file.stat();
			//Zotero.debug("Memory usage: " + memmgr.resident);
			
			let fmtime = info.lastModificationDate.getTime();
			//Zotero.debug("File modification time for item " + lk + " is " + fmtime);
			
			if (fmtime < 0) {
				Zotero.debug("File mod time " + fmtime + " is less than 0 -- interpreting as 0", 2);
				fmtime = 0;
			}
			
			// If file is already marked for upload, skip check. Even if the file was changed
			// both locally and remotely, conflicts are checked at upload time, so we don't need
			// to worry about it here.
			if (item.attachmentSyncState == this.SYNC_STATE_TO_UPLOAD) {
				Zotero.debug("File is already marked for upload");
				return false;
			}
			
			//Zotero.debug("Stored mtime is " + attachmentData.mtime);
			//Zotero.debug("File mtime is " + fmtime);
			
			//BAIL AFTER DOWNLOAD MARKING MODE, OR CHECK LOCAL?
			let mtime = attachmentData ? attachmentData.mtime : false;
			
			// Download-marking mode
			if (remoteModTime) {
				Zotero.debug(`Remote mod time for item ${lk} is ${remoteModTime}`);
				
				// Ignore attachments whose stored mod times haven't changed
				mtime = mtime !== false ? mtime : item.attachmentSyncedModificationTime;
				if (mtime == remoteModTime) {
					Zotero.debug(`Synced mod time (${mtime}) hasn't changed for item ${lk}`);
					return false;
				}
				
				Zotero.debug(`Marking attachment ${lk} for download (stored mtime: ${mtime})`);
				// DEBUG: Always set here, or allow further steps?
				return this.SYNC_STATE_FORCE_DOWNLOAD;
			}
			
			var same = !this.checkFileModTime(item, fmtime, mtime);
			if (same) {
				Zotero.debug("File has not changed");
				return false;
			}
			
			// If file hash matches stored hash, only the mod time changed, so skip
			let fileHash = yield Zotero.Utilities.Internal.md5Async(file);
			
			var hash = attachmentData ? attachmentData.hash : (yield this.getSyncedHash(item.id));
			if (hash && hash == fileHash) {
				// We have to close the file before modifying it from the main
				// thread (at least on Windows, where assigning lastModifiedTime
				// throws an NS_ERROR_FILE_IS_LOCKED otherwise)
				yield file.close();
				
				Zotero.debug("Mod time didn't match (" + fmtime + " != " + mtime + ") "
					+ "but hash did for " + fileName + " for item " + lk
					+ " -- updating file mod time");
				try {
					yield OS.File.setDates(path, null, mtime);
				}
				catch (e) {
					Zotero.File.checkFileAccessError(e, path, 'update');
				}
				return false;
			}
			
			// Mark file for upload
			Zotero.debug("Marking attachment " + lk + " as changed "
				+ "(" + mtime + " != " + fmtime + ")");
			return this.SYNC_STATE_TO_UPLOAD;
		}
		catch (e) {
			if (e instanceof OS.File.Error) {
				let missing = e.becauseNoSuchFile
					// ERROR_PATH_NOT_FOUND: This can happen if a path is too long on Windows, e.g. a
					// file is being accessed on a VM through a share (and probably in other cases)
					|| e.winLastError == 3
					// ERROR_INVALID_NAME: This can happen if there's a colon in the name from before
					// we were filtering
					|| e.winLastError == 123
					// ERROR_BAD_PATHNAME
					|| e.winLastError == 161;
				if (!missing) {
					Components.classes["@mozilla.org/net/osfileconstantsservice;1"]
						.getService(Components.interfaces.nsIOSFileConstantsService)
						.init();
					missing = e.unixErrno == OS.Constants.libc.ENOTDIR
						// Handle long filenames on OS X/Linux
						|| e.unixErrno == OS.Constants.libc.ENAMETOOLONG;
				}
				if (missing) {
					if (!e.becauseNoSuchFile) {
						Zotero.debug(e, 1);
					}
					Zotero.debug("Marking attachment " + lk + " as missing");
					return this.SYNC_STATE_TO_DOWNLOAD;
				}
				if (e.becauseClosed) {
					Zotero.debug("File was closed", 2);
				}
				Zotero.debug(e, 1);
				Zotero.debug(e.unixErrno, 1);
				Zotero.debug(e.winLastError, 1);
				throw new Error(`Error for operation '${e.operation}' for ${path}: ${e}`);
			}
			throw e;
		}
		finally {
			if (file) {
				//Zotero.debug("Closing file for item " + lk);
				file.close();
			}
		}
	}),
	
	/**
	 *
	 * @param {Zotero.Item} item
	 * @param {Integer} fmtime - File modification time in milliseconds
	 * @param {Integer} mtime - Remote modification time in milliseconds
	 * @return {Boolean} - True if file modification time differs from remote mod time,
	 *                     false otherwise
	 */
	checkFileModTime: function (item, fmtime, mtime) {
		var libraryKey = item.libraryKey;
		
		if (fmtime == mtime) {
			Zotero.debug(`Mod time for ${libraryKey} matches remote file -- skipping`);
		}
		// Compare floored timestamps for filesystems that don't support millisecond
		// precision (e.g., HFS+)
		else if (Math.floor(mtime / 1000) == Math.floor(fmtime / 1000)) {
			Zotero.debug(`File mod times for ${libraryKey} are within one-second precision `
				+ "(" + fmtime + " \u2248 " + mtime + ") -- skipping");
		}
		// Allow timestamp to be exactly one hour off to get around time zone issues
		// -- there may be a proper way to fix this
		else if (Math.abs(Math.floor(fmtime / 1000) - Math.floor(mtime / 1000)) == 3600) {
			Zotero.debug(`File mod time (${fmtime}) for {$libraryKey} is exactly one hour off `
				+ `remote file (${mtime}) -- assuming time zone issue and skipping`);
		}
		else {
			return true;
		}
		
		return false;
	},
	
	checkForForcedDownloads: Zotero.Promise.coroutine(function* (libraryID) {
		// Forced downloads happen even in on-demand mode
		var sql = "SELECT COUNT(*) FROM items JOIN itemAttachments USING (itemID) "
			+ "WHERE libraryID=? AND syncState=?";
		return !!(yield Zotero.DB.valueQueryAsync(
			sql, [libraryID, this.SYNC_STATE_FORCE_DOWNLOAD]
		));
	}),
	
	
	/**
	 * Get files marked as ready to download
	 *
	 * @param {Integer} libraryID
	 * @return {Promise<Number[]>} - Promise for an array of attachment itemIDs
	 */
	getFilesToDownload: function (libraryID, forcedOnly) {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
					+ "WHERE libraryID=? AND syncState IN (?";
		var params = [libraryID, this.SYNC_STATE_FORCE_DOWNLOAD];
		if (!forcedOnly) {
			sql += ",?";
			params.push(this.SYNC_STATE_TO_DOWNLOAD);
		}
		sql += ") "
			// Skip attachments with empty path, which can't be saved, and files with .zotero*
			// paths, which have somehow ended up in some users' libraries
			+ "AND path!='' AND path NOT LIKE ?";
		params.push('storage:.zotero%');
		return Zotero.DB.columnQueryAsync(sql, params);
	},
	
	
	/**
	 * Get files marked as ready to upload
	 *
	 * @param {Integer} libraryID
	 * @return {Promise<Number[]>} - Promise for an array of attachment itemIDs
	 */
	getFilesToUpload: function (libraryID) {
		var sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
			+ "WHERE libraryID=? AND syncState IN (?,?) AND linkMode IN (?,?)";
		var params = [
			libraryID,
			this.SYNC_STATE_TO_UPLOAD,
			this.SYNC_STATE_FORCE_UPLOAD,
			Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
			Zotero.Attachments.LINK_MODE_IMPORTED_URL
		];
		return Zotero.DB.columnQueryAsync(sql, params);
	},
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Promise<String[]>} - Promise for an array of item keys
	 */
	getDeletedFiles: function (libraryID) {
		var sql = "SELECT key FROM storageDeleteLog WHERE libraryID=?";
		return Zotero.DB.columnQueryAsync(sql, libraryID);
	},
	
	
	/**
	 * @param {Zotero.Item[]} items
	 * @param {String|Integer} syncState
	 * @return {Promise}
	 */
	updateSyncStates: function (items, syncState) {
		if (syncState === undefined) {
			throw new Error("Sync state not specified");
		}
		if (typeof syncState == 'string') {
			syncState = this["SYNC_STATE_" + syncState.toUpperCase()];
		}
		return Zotero.Utilities.Internal.forEachChunkAsync(
			items,
			1000,
			async function (chunk) {
				chunk.forEach((item) => {
					item._attachmentSyncState = syncState;
				});
				return Zotero.DB.queryAsync(
					"UPDATE itemAttachments SET syncState=? WHERE itemID IN "
						+ "(" + chunk.map(item => item.id).join(', ') + ")",
					syncState
				);
			}
		);
	},
	
	
	/**
	 * Mark all stored files for upload checking
	 *
	 * This is used when switching between storage modes in the preferences so that all existing files
	 * are uploaded via the new mode if necessary.
	 */
	resetAllSyncStates: async function (libraryID) {
		if (!libraryID) {
			throw new Error("libraryID not provided");
		}
		
		return Zotero.DB.executeTransaction(async function () {
			var sql = "SELECT itemID FROM items JOIN itemAttachments USING (itemID) "
				+ "WHERE libraryID=? AND itemTypeID=? AND linkMode IN (?, ?)";
			var params = [
				libraryID,
				Zotero.ItemTypes.getID('attachment'),
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
			];
			var itemIDs = await Zotero.DB.columnQueryAsync(sql, params);
			for (let itemID of itemIDs) {
				let item = Zotero.Items.get(itemID);
				item._attachmentSyncState = this.SYNC_STATE_TO_UPLOAD;
			}
			sql = "UPDATE itemAttachments SET syncState=? WHERE itemID IN (" + sql + ")";
			await Zotero.DB.queryAsync(sql, [this.SYNC_STATE_TO_UPLOAD].concat(params));
		}.bind(this));
	},
	
	
	/**
	 * Extract a downloaded file and update the database metadata
	 *
	 * @param {Zotero.Item} data.item
	 * @param {Integer}     data.mtime
	 * @param {String}      data.md5
	 * @param {Boolean}     data.compressed
	 * @return {Promise}
	 */
	processDownload: Zotero.Promise.coroutine(function* (data) {
		if (!data) {
			throw new Error("'data' not set");
		}
		if (!data.item) {
			throw new Error("'data.item' not set");
		}
		if (!data.mtime) {
			throw new Error("'data.mtime' not set");
		}
		if (data.mtime != parseInt(data.mtime)) {
			throw new Error("Invalid mod time '" + data.mtime + "'");
		}
		if (!data.compressed && !data.md5) {
			throw new Error("'data.md5' is required if 'data.compressed'");
		}
		
		var item = data.item;
		var mtime = parseInt(data.mtime);
		var md5 = data.md5;
		
		// TODO: Test file hash
		
		if (data.compressed) {
			var newPath = yield this._processZipDownload(item);
		}
		else {
			var newPath = yield this._processSingleFileDownload(item);
		}
		
		// If newPath is set, the file was renamed, so set item filename to that
		// and mark for updated
		var path = yield item.getFilePathAsync();
		if (newPath && path != newPath) {
			// If library isn't editable but filename was changed, update
			// database without updating the item's mod time, which would result
			// in a library access error
			try {
				if (!Zotero.Items.isEditable(item)) {
					Zotero.debug("File renamed without library access -- "
						+ "updating itemAttachments path", 3);
					yield item.relinkAttachmentFile(newPath, true);
				}
				else {
					yield item.relinkAttachmentFile(newPath);
				}
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, path, 'update');
			}
			
			path = newPath;
		}
		
		if (!path) {
			// This can happen if an HTML snapshot filename was changed and synced
			// elsewhere but the renamed file wasn't synced, so the ZIP doesn't
			// contain a file with the known name
			Components.utils.reportError("File '" + item.attachmentFilename
				+ "' not found after processing download " + item.libraryKey);
			return new Zotero.Sync.Storage.Result({
				localChanges: false
			});
		}
		
		try {
			// If hash not provided (e.g., WebDAV), calculate it now
			if (!md5) {
				md5 = yield item.attachmentHash;
			}
			
			// Set the file mtime to the time from the server
			yield OS.File.setDates(path, null, new Date(parseInt(mtime)));
		}
		catch (e) {
			Zotero.File.checkFileAccessError(e, path, 'update');
		}
		
		item.attachmentSyncedModificationTime = mtime;
		item.attachmentSyncedHash = md5;
		item.attachmentSyncState = "in_sync";
		yield item.saveTx({ skipAll: true });
		
		return new Zotero.Sync.Storage.Result({
			localChanges: true
		});
	}),
	
	
	_processSingleFileDownload: Zotero.Promise.coroutine(function* (item) {
		var tempFilePath = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.tmp');
		
		if (!(yield OS.File.exists(tempFilePath))) {
			Zotero.debug(tempFilePath, 1);
			throw new Error("Downloaded file not found");
		}
		
		yield Zotero.Attachments.createDirectoryForItem(item);
		
		var filename = item.attachmentFilename;
		if (!filename) {
			Zotero.debug("Empty filename for item " + item.key, 2);
		}
		// Don't save Windows aliases
		if (filename.endsWith('.lnk')) {
			return false;
		}
		
		var attachmentDir = Zotero.Attachments.getStorageDirectory(item).path;
		var renamed = false;
		
		// Make sure the new filename is valid, in case an invalid character made it over
		// (e.g., from before we checked for them)
		var filteredFilename = Zotero.File.getValidFileName(filename);
		if (filteredFilename != filename) {
			Zotero.debug("Filtering filename '" + filename + "' to '" + filteredFilename + "'");
			filename = filteredFilename;
			renamed = true;
		}
		var path = OS.Path.join(attachmentDir, filename);
		
		Zotero.debug("Moving download file " + OS.Path.basename(tempFilePath)
			+ ` into attachment directory as '${filename}'`);
		try {
			var finalFilename = Zotero.File.createShortened(
				path, Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644
			);
		}
		catch (e) {
			Zotero.File.checkFileAccessError(e, path, 'create');
		}
		
		if (finalFilename != filename) {
			Zotero.debug("Changed filename '" + filename + "' to '" + finalFilename + "'");
			
			filename = finalFilename;
			path = OS.Path.join(attachmentDir, filename);
			
			// Abort if Windows path limitation would cause filenames to be overly truncated
			if (Zotero.isWin && filename.length < 40) {
				try {
					yield OS.File.remove(path);
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
			yield OS.File.move(tempFilePath, path);
		}
		catch (e) {
			try {
				yield OS.File.remove(tempFilePath);
			}
			catch (e) {}
			
			Zotero.File.checkFileAccessError(e, path, 'create');
		}
		
		// processDownload() needs to know that we're renaming the file
		return renamed ? path : null;
	}),
	
	
	_processZipDownload: Zotero.Promise.coroutine(function* (item) {
		var zipFile = Zotero.getTempDirectory();
		zipFile.append(item.key + '.tmp');
		
		if (!zipFile.exists()) {
			Zotero.debug(zipFile.path);
			throw new Error(`Downloaded ZIP file not found for item ${item.libraryKey}`);
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
		
		var parentDir = Zotero.Attachments.getStorageDirectory(item).path;
		try {
			yield Zotero.Attachments.createDirectoryForItem(item);
		}
		catch (e) {
			zipReader.close();
			throw e;
		}
		
		var returnFile = null;
		var count = 0;
		
		var itemFileName = item.attachmentFilename;
		
		var entries = zipReader.findEntries(null);
		while (entries.hasMore()) {
			var entryName = entries.getNext();
			var entry = zipReader.getEntry(entryName);
			var b64re = /%ZB64$/;
			if (entryName.match(b64re)) {
				var filePath = Zotero.Utilities.Internal.Base64.decode(
					entryName.replace(b64re, '')
				);
			}
			else {
				var filePath = entryName;
			}
			
			if (filePath.startsWith('.zotero')) {
				Zotero.debug("Skipping " + filePath);
				continue;
			}
			
			if (entry.isDirectory) {
				Zotero.debug("Skipping directory " + filePath);
				continue;
			}
			count++;
			
			Zotero.debug("Extracting " + filePath);
			
			var primaryFile = itemFileName == filePath;
			var filtered = false;
			var renamed = false;
			
			// Make sure all components of the path are valid, in case an invalid character somehow made
			// it into the ZIP (e.g., from before we checked for them)
			var filteredPath = filePath.split('/').map(part => Zotero.File.getValidFileName(part)).join('/');
			if (filteredPath != filePath) {
				Zotero.debug("Filtering filename '" + filePath + "' to '" + filteredPath + "'");
				filePath = filteredPath;
				filtered = true;
			}
			
			var destPath = OS.Path.join(parentDir, ...filePath.split('/'));
			
			// If only one file in zip and it doesn't match the known filename,
			// take our chances and use that name
			if (count == 1 && !entries.hasMore() && itemFileName) {
				// May not be necessary, but let's be safe
				itemFileName = Zotero.File.getValidFileName(itemFileName);
				if (itemFileName != filePath) {
					let msg = "Renaming single file '" + filePath + "' in ZIP to known filename '" + itemFileName + "'";
					Zotero.debug(msg, 2);
					Components.utils.reportError(msg);
					filePath = itemFileName;
					destPath = OS.Path.join(OS.Path.dirname(destPath), itemFileName);
					renamed = true;
					primaryFile = true;
				}
			}
			
			if (primaryFile && filtered) {
				renamed = true;
			}
			
			if (yield OS.File.exists(destPath)) {
				var msg = "ZIP entry '" + filePath + "' already exists";
				Zotero.logError(msg);
				Zotero.debug(destPath);
				continue;
			}
			
			let shortened;
			try {
				shortened = Zotero.File.createShortened(
					destPath, Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644
				);
			}
			catch (e) {
				Zotero.logError(e);
				
				zipReader.close();
				
				Zotero.File.checkFileAccessError(e, destPath, 'create');
			}
			
			if (OS.Path.basename(destPath) != shortened) {
				Zotero.debug(`Changed filename '${OS.Path.basename(destPath)}' to '${shortened}'`);
				
				// Abort if Windows path limitation would cause filenames to be overly truncated
				if (Zotero.isWin && shortened < 40) {
					try {
						yield OS.File.remove(destPath);
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
				
				destPath = OS.Path.join(OS.Path.dirname(destPath), shortened);
				
				if (primaryFile) {
					renamed = true;
				}
			}
			
			try {
				zipReader.extract(entryName, Zotero.File.pathToFile(destPath));
			}
			catch (e) {
				try {
					yield OS.File.remove(destPath);
				}
				catch (e) {}
				
				// For advertising junk files, ignore a bug on Windows where
				// destFile.create() works but zipReader.extract() doesn't
				// when the path length is close to 255.
				if (OS.Path.basename(destPath).match(/[a-zA-Z0-9+=]{130,}/)) {
					var msg = "Ignoring error extracting '" + destPath + "'";
					Zotero.debug(msg, 2);
					Zotero.debug(e, 2);
					Components.utils.reportError(msg + " in " + funcName);
					continue;
				}
				
				zipReader.close();
				
				Zotero.File.checkFileAccessError(e, destPath, 'create');
			}
			
			yield Zotero.File.setNormalFilePermissions(destPath);
			
			// If we're renaming the main file, processDownload() needs to know
			if (renamed) {
				returnFile = destPath;
			}
		}
		zipReader.close();
		zipFile.remove(false);
		
		return returnFile;
	}),
	
	
	/**
	 * @return {Promise<Object[]>} - A promise for an array of conflict objects
	 */
	getConflicts: Zotero.Promise.coroutine(function* (libraryID) {
		var sql = "SELECT itemID, version FROM items JOIN itemAttachments USING (itemID) "
			+ "WHERE libraryID=? AND syncState=?";
		var rows = yield Zotero.DB.queryAsync(
			sql,
			[
				{ int: libraryID },
				this.SYNC_STATE_IN_CONFLICT
			]
		);
		var keyVersionPairs = rows.map(function (row) {
			var { libraryID, key } = Zotero.Items.getLibraryAndKeyFromID(row.itemID);
			return [key, row.version];
		});
		var cacheObjects = yield Zotero.Sync.Data.Local.getCacheObjects(
			'item', libraryID, keyVersionPairs
		);
		if (!cacheObjects.length) return [];
		
		var cacheObjectsByKey = {};
		cacheObjects.forEach(obj => cacheObjectsByKey[obj.key] = obj);
		
		var items = [];
		var localItems = yield Zotero.Items.getAsync(rows.map(row => row.itemID));
		for (let localItem of localItems) {
			// Use the mtime for the dateModified field, since that's all that's shown in the
			// CR window at the moment
			let localItemJSON = localItem.toJSON();
			localItemJSON.dateModified = Zotero.Date.dateToISO(
				new Date(yield localItem.attachmentModificationTime)
			);
			
			let remoteItemJSON = cacheObjectsByKey[localItem.key];
			if (!remoteItemJSON) {
				Zotero.logError("Cached object not found for item " + localItem.libraryKey);
				continue;
			}
			remoteItemJSON = remoteItemJSON.data;
			if (remoteItemJSON.mtime) {
				remoteItemJSON.dateModified = Zotero.Date.dateToISO(new Date(remoteItemJSON.mtime));
			}
			items.push({
				libraryID,
				left: localItemJSON,
				right: remoteItemJSON,
				changes: [],
				conflicts: []
			})
		}
		return items;
	}),
	
	
	resolveConflicts: Zotero.Promise.coroutine(function* (libraryID) {
		var conflicts = yield this.getConflicts(libraryID);
		if (!conflicts.length) return false;
		
		Zotero.debug("Reconciling conflicts for " + Zotero.Libraries.get(libraryID).name);
		Zotero.debug(conflicts);
		
		var io = {
			dataIn: {
				type: 'file',
				captions: [
					Zotero.getString('sync.storage.localFile'),
					Zotero.getString('sync.storage.remoteFile'),
					Zotero.getString('sync.storage.savedFile')
				],
				conflicts
			}
		};
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
		
		if (!io.dataOut) {
			return false;
		}
		
		yield Zotero.DB.executeTransaction(function* () {
			for (let i = 0; i < conflicts.length; i++) {
				let conflict = conflicts[i];
				// TEMP
				Zotero.debug(conflict);
				let item = Zotero.Items.getByLibraryAndKey(libraryID, conflict.left.key);
				let mtime = io.dataOut[i].data.dateModified;
				// Local
				if (mtime == conflict.left.dateModified) {
					syncState = this.SYNC_STATE_FORCE_UPLOAD;
					// When local version is chosen, update stored mtime and hash to remote values
					// so that upload goes through without a 412.
					//
					// These sometimes might not be set in the cached JSON (for unclear reasons, but
					// see https://forums.zotero.org/discussion/79011/zotero-error-report), in which
					// case we just ignore them and hope that the local version has null values too.
					if (conflict.right.mtime) {
						item.attachmentSyncedModificationTime = conflict.right.mtime;
					}
					if (conflict.right.md5) {
						item.attachmentSyncedHash = conflict.right.md5;
					}
				}
				// Remote
				else {
					syncState = this.SYNC_STATE_FORCE_DOWNLOAD;
				}
				item.attachmentSyncState = syncState;
				yield item.save({ skipAll: true });
			}
		}.bind(this));
		return true;
	})
}
