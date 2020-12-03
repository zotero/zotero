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
 * Responsible for management and processing of local files to maintain proper cache size.
 *
 * @function free - Add item ID to queue to be freed
 * @function identifyItemsToFree - Identify cache items to free
 */
Zotero.Sync.Storage.Cache = {
	// Flag to indicate if we are already processing
	_freeingCache: false,

	/**
	 * Remove all attachment files for the given item/items and mark them as no longer cached
	 *
	 * @param items
	 * @returns {Promise<void>}
	 */
	removeAttachmentFilesForItems: async function (items) {
		// If an item is top-level grab all the attachment items for it
		let attachmentItems = [];
		for (let item of items) {
			if (item.isAttachment()) {
				attachmentItems.push(item);
			}
			else {
				let attachments = await Zotero.Items.getAsync(item.getAttachments());
				for (let attachment of attachments) {
					attachmentItems.push(attachment);
				}
			}
		}

		// Delete all files (will update the DB as well)
		await Zotero.Promise.all(
			attachmentItems.map(attachmentItem => this._deleteItemFiles(attachmentItem))
		);
		
		// TODO: There seems to be a lag compared to download file of how long it takes the
		// item pane to update
	},

	/**
	 * Cache the given item attachments
	 *
	 * @param items {Array} - List of items that are attachments
	 *
	 * @returns {Promise<void>}
	 */
	cacheItemAttachments: async function (items) {
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
	 * Identify items with files currently downloaded that we should delete to limit cache
	 *
	 * Called when the limit cache preference is turned on or when a new item is downloaded or
	 * added.
	 *
	 * @param forGroups {boolean} - Are we identifying in group libraries or the user library
	 * @param fullSearch {boolean} - If true, search the full library, otherwise, optimize
	 *
	 * @returns {Promise<void>}
	 */
	identifyItemsToFree: async function (forGroups, fullSearch) {
		this._freeingCache = true;
		let promises = [];
		try {
			if (forGroups) {
				Zotero.Libraries.getAll().forEach((library) => {
					if (library.libraryID !== Zotero.Libraries.userLibraryID) {
						promises.push(
							this.identifyItemsToFreeForLibrary(library.libraryID, fullSearch)
						);
					}
				});
			}
			else {
				promises.push(
					this.identifyItemsToFreeForLibrary(Zotero.Libraries.userLibraryID, fullSearch)
				);
			}
	
			await Zotero.Promise.all(promises);
		}
		catch (e) {
			throw e;
		}
		finally {
			this._freeingCache = false;
		}
	},

	/**
	 * Identify items with files currently downloaded that we should delete to limit cache
	 *
	 * Called when the limit cache preference is turned on or when a new item is downloaded or
	 * added.
	 *
	 * @param libraryID {integer} - Library ID to search for items to free
	 * @param fullSearch {boolean} - If true, search the full library, otherwise, optimize
	 *
	 * @returns {Promise<void>}
	 */
	identifyItemsToFreeForLibrary: async function (libraryID, fullSearch) {
		// Check library has storage
		if (!Zotero.Sync.Storage.Local.getEnabledForLibrary(libraryID)) {
			Zotero.debug('Zotero.Sync.Storage.Cache ('
				+ libraryID + ') exiting because it is not storage enabled ('
				+ Zotero.Libraries.get(libraryID).libraryType + ').');
			return;
		}

		// Check this library is on demand
		if (!Zotero.Sync.Storage.Local.downloadAsNeeded(libraryID)) {
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
				+ ') exiting because it is not download as-needed.');
			return;
		}
		
		let cacheLimit = Zotero.Prefs.get(this._getCacheLimitPrefFromLibrary(libraryID));
		if (cacheLimit === 0) {
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
				+ ') exiting because cache limit is unlimited.');
			return;
		}

		Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
			+ ') checking if cache exceeds preference of ' + cacheLimit + 'MB');

		// Turn cache limit into bytes
		cacheLimit = cacheLimit * 1024 * 1024;

		// Keep track of offset into table
		let offset = 0;
		// Keep track of how many bytes of files we have seen so far
		let bytesSoFar = 0;

		// Sum attachment sizes ordered by lastAccessed until we hit storage size limit
		let i, storageSize;
		while (true) {
			let sql = "SELECT itemID, storageSize FROM itemAttachments JOIN items USING (itemID) "
				+ "WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?)"
				+ "ORDER BY lastAccessed DESC, dateModified DESC LIMIT ?,1000";
			let params = [
				libraryID,
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC,
				offset
			];
			let rows = await Zotero.DB.queryAsync(sql, params);

			for (i = 0; i < rows.length; i++) {
				storageSize = rows[i].storageSize;
				if (!storageSize) {
					// No storage size in DB means we need to update the DB from
					// the filesystem
					
					// TODO: This seems like an unnecessary amount of work on
					// the DB, but I didn't want to replicate a ton of code
					// contained in these functions.
					// Another option instead of loading them one at a time
					// would be to wait and load all items after this loop
					let item = await Zotero.Items.getAsync(rows[i].itemID);
					storageSize = await Zotero.Attachments.getTotalFileSize(item, true);
					
					// Insert back into DB
					item.attachmentStorageSize = storageSize;
					await item.saveTx({ skipAll: true });
				}

				bytesSoFar += storageSize;

				// We've reached the tipping point so this item and everything after
				// it needs to be removed
				if (bytesSoFar > cacheLimit) {
					offset += i;
					break;
				}
			}

			if (bytesSoFar > cacheLimit) {
				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') '
					+ offset + ' records fit inside cache limit');
				break;
			}

			// No more rows means we are inside total cache size
			if (!rows.length || rows.length < 1000) {
				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
					+ ') exiting because cache size (' + bytesSoFar
					+ ') is inside limit (' + cacheLimit + ').');
				return;
			}

			offset += 1000;
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') processed '
				+ offset + ' records, still looking for limit.');
		}

		// Start from first removal offset and remove until we don't find a file any more
		// TODO: We could also stop when we encounter a TO_DOWNLOAD sync state
		let recordsFreed = 0, quit = false;
		while (true) {
			let sql = "SELECT itemID, storageSize FROM itemAttachments JOIN items USING (itemID) "
				+ "WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?) "
				+ "ORDER BY lastAccessed DESC, dateModified DESC LIMIT ?,1000";
			let params = [
				libraryID,
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC,
				offset
			];
			let rows = await Zotero.DB.queryAsync(sql, params);

			for (i = 0; i < rows.length; i++) {
				let item = await Zotero.Items.getAsync(rows[i].itemID);

				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
					+ ') freeing storage for item (' + item.id + ').');
				let deleted = await this._deleteItemFiles(item);
				if (!deleted && !fullSearch) {
					// If we found no files to delete and are not doing
					// a full search then call if quits here
					quit = true;
					break;
				}

				// Slow down so we don't bog the system down
				await Zotero.Promise.delay(1000);
			}
			
			if (quit) {
				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') is not '
					+ ' performing full search and found no files to delete.');
				return;
			}

			// No more rows means we've reached the end
			if (!rows.length || rows.length < 1000) {
				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
					+ ') exiting because no items are left.');
				return;
			}

			recordsFreed += rows.length;
			offset += 1000;
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') freed '
				+ recordsFreed + ' records, looking for more.');
		}
	},

	_getCacheLimitPrefFromLibrary: function (libraryID) {
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return 'sync.storage.cacheLimit.personal';
		}

		// Group library
		return 'sync.storage.cacheLimit.groups';
	},

	/**
	 * Delete files for the given item
	 *
	 * Note: This will also update the sync state to for affected items to:
	 * Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD
	 *
	 * @param item {Zotero.Item} - Item to delete attachment files for
	 *
	 * @returns {Promise<boolean>} - True if we found files to delete
	 */
	_deleteItemFiles: async function (item) {
		// TODO: Check if item exists on server before deleting
		let fileExistsOnServer = await Zotero.Sync.Runner.checkFileExists(item);
		if (!fileExistsOnServer) {
			return false;
		}

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
			Zotero.debug('Error deleting files for item (' + item.id + ').');
			Zotero.logError(e);
			throw e;
		}
		finally {
			iterator.close();
		}

		// TODO: Need to be careful about not overriding a sync state like to-upload or something
		// Mark item to be downloaded again. Since we are in as-needed mode this won't cause
		// it to immediately download again.
		item.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD;
		await item.saveTx({ skipAll: true });

		if (deletes.length > 0) {
			Zotero.debug('Removed files for item (' + item.id + ').');
			return true;
		}

		Zotero.debug('No files to remove for item (' + item.id + ').');
		return false;
	}
};
