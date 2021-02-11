/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

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

/**
 * Manage Storage Cache for libraries or items
 *
 * @function removeAttachmentFilesForItems - Remove files for given items
 * @function cacheItemAttachments - Download files for given items
 * @function cleanCacheForLibrary - Remove synced files for given library
 */
Zotero.Sync.Storage.Cache = {
	// Properties to make testing easier
	_dbScanRecordLimit: 1000,
	_dbScanSleepPeriod: 100,
	_fileDeletionSleepPeriod: 100,

	// Keep promises of running cache clean processes to prevent duplicates
	_cleaningCachePromises: {},

	// Cache the breakdown of storage for efficiency
	_storageBreakdown: false,
	_storageBreakdownCache: 0,

	/**
	 * Remove all attachment files for the given items and mark them as TO_DOWNLOAD
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Promise}
	 */
	removeAttachmentFilesForItems: async function (items) {
		let attachmentItems = await this._getAllImportedAttachments(items);

		// Delete all files (will update the DB as well)
		let deleted = await this._deleteItemFiles(attachmentItems);
		
		Zotero.debug(`Storage Cache: deleted files for ${deleted} attachment items`);

		// TODO: There seems to be a lag compared to download/delete file of how long it takes the
		// item pane to update (in particular, snapshots don't seem to update at all)
	},

	/**
	 * Cache all the attachments of the given items (top-level or child)
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Promise}
	 */
	cacheItemAttachments: async function (items) {
		items = await this._getAllImportedAttachments(items);

		let failed = [];
		await Zotero.Promise.all(items.map(async (item) => {
			let path = item.getFilePath();
			let fileExists = await OS.File.exists(path);

			// TEMP: If file is queued for download, download first. Starting in 5.0.85, files
			// modified remotely get marked as SYNC_STATE_FORCE_DOWNLOAD, causing them to get
			// downloaded at sync time even in download-as-needed mode, but this causes files
			// modified previously to be downloaded on open.
			if (fileExists
				&& (item.attachmentSyncState !== Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD)) {
				// We are not downloading, but still touch last accessed
				item.attachmentLastAccessed = Date.now();
				await item.saveTx({ skipAll: true });
				return;
			}

			// Download item
			let results = await Zotero.Sync.Runner.downloadFile(item);
			if (!results || !results.localChanges) {
				failed.push(item);
				Zotero.debug("Attachment download failed -- skipping");
			}
		}));
		
		Zotero.debug('Finished caching items');

		if (failed.length) {
			Zotero.alert(
				window,
				'Download Failure',
				'Some attachments failed to download: ' + failed.join(', ')
			);
		}
	},

	/**
	 * Clean the cache for the given library, or if a clean is already in progress, await that
	 * promise.
	 *
	 * @param libraryID
	 * @return {Promise}
	 */
	cleanCacheForLibrary: async function (libraryID) {
		if (!this._cleaningCachePromises[libraryID]) {
			Zotero.debug(`Storage Cache: Execute clean for library ${libraryID}`);
			this._cleaningCachePromises[libraryID] = this._executeCleanForLibrary(libraryID);
		}

		Zotero.debug(`Storage Cache: Awaiting cache clean for library ${libraryID}`);
		await this._cleaningCachePromises[libraryID];
		delete this._cleaningCachePromises[libraryID];

		// Reset cache breakdown age
		this._storageBreakdownCache = 0;
	},

	_executeCleanForLibrary: async function (libraryID) {
		Zotero.Sync.Storage.Local.lastCacheClean.set(libraryID, Date.now());

		let expiredItems = await this._getExpiredItemsForLibrary(libraryID);

		if (expiredItems.length) {
			let deleted = await this._deleteItemFiles(expiredItems);
			Zotero.debug(`Storage Cache: deleted files for ${deleted} attachment items`);
		}
	},

	/**
	 * Scan the given library to identify items that have a `lastAccessed` date older than the
	 * cache preference.
	 *
	 * @param {Integer} libraryID
	 * @return {Promise<Zotero.Item[]|Boolean>} - Items in library that are expired or `false`
	 * 	if the library is not storage/cache enabled
	 */
	_getExpiredItemsForLibrary: async function (libraryID) {
		let library = Zotero.Libraries.get(libraryID);
		// Check library has file syncing storage enabled
		if (!Zotero.Sync.Storage.Local.getEnabledForLibrary(libraryID)) {
			Zotero.debug(`Storage Cache: ${library.name} does not have storage enabled`);
			return false;
		}

		// Check this library is on-demand
		if (!Zotero.Sync.Storage.Local.downloadAsNeeded(libraryID)) {
			Zotero.debug(`Storage Cache: ${library.name} is not download-as-needed`);
			return false;
		}

		let cacheTime = this._cacheLimitForLibrary();
		if (cacheTime === false) {
			Zotero.debug(`Storage Cache: ${library.name} does not have cache eviction enabled`);
			return false;
		}

		Zotero.debug(`Storage Cache: ${library.name} cache enabled for ${cacheTime} days`);

		// Turn cache limit into a timestamp
		let cacheCutoff = Date.now() - (cacheTime * 86400000);
		let cacheDate = Zotero.Date.dateToSQL(new Date(cacheCutoff));

		// Not every record in the DB is guaranteed to have a `lastAccessed`. So first we
		// go through every record that does and then fallback to `dateModified` for all the
		// ones that don't
		let useLastAccessed = true;

		let expiredItems = [];
		let offset = 0;
		while (true) {
			let sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
				+ " WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?)";
			
			let dateParam;
			if (useLastAccessed) {
				sql += " AND lastAccessed IS NOT NULL AND lastAccessed < ?";
				dateParam = cacheCutoff;
			}
			else {
				sql += " AND lastAccessed IS NULL AND dateModified < ?";
				dateParam = cacheDate;
			}
			
			sql += " ORDER BY lastAccessed DESC, dateModified DESC LIMIT ?,?";
			let params = [
				libraryID,
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC,
				dateParam,
				offset,
				this._dbScanRecordLimit
			];
			let rows = await Zotero.DB.queryAsync(sql, params);
			Zotero.debug(`Storage Cache: ${library.name} retrieved ${rows.length} rows`);

			for (let i = 0; i < rows.length; i++) {
				let item = await Zotero.Items.getAsync(rows[i].itemID);
				expiredItems.push(item);
			}

			offset += this._dbScanRecordLimit;

			// Check if we need to break out of the loop
			if (rows.length === 0 || rows.length < this._dbScanRecordLimit) {
				if (useLastAccessed) {
					// Now let's process records that don't have a last accessed
					useLastAccessed = false;
					// Reset offset since we are in a whole new category
					offset = 0;
				}
				else {
					// All done
					break;
				}
			}

			// Slow down so we don't bog the system down if we are scanning a
			// big library
			await Zotero.Promise.delay(this._dbScanSleepPeriod);
		}

		Zotero.debug(`Storage Cache: ${library.name} has ${expiredItems.length} expired items`);
		return expiredItems;
	},

	/**
	 * Get the cache limit for the given library or `false` if TTL is not enabled
	 *
	 * @return {Boolean|Integer} False if TTL is not enabled, otherwise TTL value in days
	 */
	_cacheLimitForLibrary: function () {
		let enabled = Zotero.Prefs.get(this._getPrefForLibrary('enabled'));
		if (!enabled) {
			return false;
		}

		return Zotero.Prefs.get(this._getPrefForLibrary('value'));
	},

	_getPrefForLibrary: function (pref) {
		return 'sync.storage.timeToLive.' + pref;
	},

	/**
	 * Delete files for the given attachment items
	 *
	 * Note: This will also update the sync state to for affected items to:
	 * Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Promise<Integer>} - Number of attachment items that had files deleted
	 */
	_deleteItemFiles: async function (items) {
		let result = 0;

		for (let item of items) {
			if (!item.isImportedAttachment()) {
				Zotero.debug(`Storage Cache: ${item.id} is not an imported attachment`);
				continue;
			}

			let fileExistsOnServer = await Zotero.Sync.Runner.checkFileExists(item);
			if (!fileExistsOnServer) {
				Zotero.debug(`Storage Cache: ${item.id} does not exist on server`);
				continue;
			}

			Zotero.debug(`Storage Cache: Removing files for ${item.id}`);

			// Delete files and update sync status
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
			let iterator = new OS.File.DirectoryIterator(attachmentDirectory);

			// Iterate through the directory and delete files/folders
			let deletes = [];
			try {
				await iterator.forEach(
					(entry) => {
						if (entry.isDir) {
							deletes.push(OS.File.removeDir(entry.path));
						}
						else if (!entry.name.startsWith('.')) {
							deletes.push(OS.File.remove(entry.path));
						}
					}
				);

				await Zotero.Promise.all(deletes);
			}
			catch (e) {
				Zotero.debug(`Storage Cache: Could not delete files for ${item.id}`);
				Zotero.logError(e);
				throw e;
			}
			finally {
				iterator.close();
			}

			// TODO: Do we care about overwriting another state here (do we need to check above)?
			// Mark item to be downloaded again. Since we are in as-needed mode this won't cause
			// it to immediately download again.
			item.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD;
			await item.saveTx({ skipAll: true });

			Zotero.debug(`Storage Cache: ${item.id} had ${deletes.length} files removed`);
			result += 1;

			// Rate limit this in case we are deleting a lot of files
			await Zotero.Promise.delay(this._fileDeletionSleepPeriod);
		}

		return result;
	},

	/**
	 * Helper function to take in a list of items, attachments, etc. and return a list of all
	 * child imported attachments that have been selected.
	 *
	 * Removes duplicates in case both an item and it's children are passed in.
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Promise<Zotero.Item[]>}
	 */
	_getAllImportedAttachments: async function (items) {
		let itemIDs = new Set();
		let importedAttachments = [];
		for (let item of items) {
			if (item.isRegularItem()) {
				let attachmentItems = item.getAttachments();
				let attachments = await Zotero.Items.getAsync(attachmentItems);
				for (let attachment of attachments) {
					if (attachment.isImportedAttachment()
						&& !itemIDs.has(attachment.id)) {
						itemIDs.add(attachment.id);
						importedAttachments.push(attachment);
					}
				}
			}
			else if (item.isImportedAttachment() && !itemIDs.has(item.id)) {
				itemIDs.add(item.id);
				importedAttachments.push(item);
			}
			// Ignore notes
		}

		return importedAttachments;
	},


	/**
	 * Scan all library attachment files to calculate breakdown of storage
	 *
	 * Results are cached and updated if older than 1 hour or a library has been cleaned
	 *
	 * @param {Function} [onUpdate] - Receive periodic updated storage counts while scanning
	 * @param {Integer[]} [libraryIDs] - List of Library IDs to limit scan to
	 * @return {Promise}
	 */
	calculateStorageBreakdown: async function (onUpdate, libraryIDs) {
		// Check to see if we have recently scanned our groups
		if (this._storageBreakdown && !libraryIDs) {
			// Check if results are newer than 1 hour
			if (this._storageBreakdownCache > (Date.now() - 3600000)) {
				// Return the cached results
				onUpdate(this._storageBreakdown);
				return this._storageBreakdown;
			}
		}

		this._storageBreakdownCache = Date.now();

		// Otherwise start scanning
		let update = 0;
		let libraries = Zotero.Libraries.getAll();

		if (libraryIDs) {
			libraries = libraries
				.filter(library => libraryIDs.includes(library.libraryID));

			Zotero.debug('Storage Cache: Calculating storage breakdown for libraries: ' + libraryIDs.join(','));
		}
		else {
			this._storageBreakdown = {};

			Zotero.debug('Storage Cache: Calculating storage breakdown for all libraries');
		}

		await Zotero.Promise.all(libraries.map(async (library) => {
			this._storageBreakdown[library.libraryID] = {
				libraryID: library.libraryID,
				name: library.name,
				size: 0,
				count: 0
			};
			onUpdate(this._storageBreakdown);

			let items = await Zotero.Items.getAll(library.libraryID);

			const getFileSize = async (attachmentFile) => {
				if (attachmentFile.name.startsWith('.')) {
					return;
				}

				try {
					let size = (await OS.File.stat(attachmentFile.path)).size;
					this._storageBreakdown[library.libraryID].size += size;
				}
				catch (e) {
					if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
						// File may or may not exist on disk, but we
						// don't care so swallow this error
					}
					else {
						Zotero.logError(e);
						return;
					}
				}

				if (onUpdate && update > 200) {
					onUpdate(this._storageBreakdown);
					update = 0;
				}
				else {
					update += 1;
				}
			};

			await Zotero.Promise.all(items.map(async (item) => {
				if (!item.isImportedAttachment()) {
					return;
				}

				this._storageBreakdown[library.libraryID].count += 1;

				await Zotero.File.iterateDirectory(
					Zotero.Attachments.getStorageDirectory(item).path,
					getFileSize
				);
			}));
		}));

		onUpdate(this._storageBreakdown);
		return this._storageBreakdown;
	}
};
