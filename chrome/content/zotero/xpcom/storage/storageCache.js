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
	 *
	 * @returns {Promise<void>}
	 */
	identifyItemsToFree: async function (forGroups) {
		this._freeingCache = true;
		let promises = [];
		try {
			if (forGroups) {
				Zotero.Libraries.getAll().forEach((library) => {
					if (library.libraryID !== Zotero.Libraries.userLibraryID) {
						promises.push(
							this.identifyItemsToFreeForLibrary(library.libraryID)
						);
					}
				});
			}
			else {
				promises.push(
					this.identifyItemsToFreeForLibrary(Zotero.Libraries.userLibraryID)
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
	 *
	 * @returns {Promise<void>}
	 */
	identifyItemsToFreeForLibrary: async function (libraryID) {
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
		
		let cacheTime = Zotero.Prefs.get(this._getCacheLimitPrefFromLibrary(libraryID));
		if (cacheTime === 0) {
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
				+ ') exiting because cache time is unlimited.');
			return;
		}

		Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
			+ ') checking if cached files exceeds preference of ' + cacheTime + ' days.');

		// Turn cache limit into seconds for timestamp
		cacheTime = cacheTime * 24 * 60 * 60;

		// Keep track of offset into table
		let offset = 0;

		// Delete files older than the cache limit
		let lastAccessedIsNull = false, i, recordsFreed = 0;
		while (true) {
			let sql = "SELECT itemID FROM itemAttachments JOIN items USING (itemID) "
				+ " WHERE libraryID=? AND linkMode IN (?,?) AND syncState IN (?)";
			
			// If we have no last accessed data in DB then compare with dateModified
			if (lastAccessedIsNull) {
				sql += " AND lastAccessed IS NULL AND dateModified < ?";
			}
			else {
				sql += " AND lastAccessed IS NOT NULL AND lastAccessed > ?";
			}
			
			sql += " ORDER BY lastAccessed DESC, dateModified DESC LIMIT ?,1000";
			let params = [
				libraryID,
				Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
				Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC,
				cacheTime,
				offset
			];
			let rows = await Zotero.DB.queryAsync(sql, params);

			for (i = 0; i < rows.length; i++) {
				let item = await Zotero.Items.getAsync(rows[i].itemID);

				Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID
					+ ') freeing storage for item (' + item.id + ').');
				await this._deleteItemFiles(item);

				// Slow down so we don't bog the system down
				await Zotero.Promise.delay(500);
			}

			offset += 1000;
			recordsFreed += rows.length;
			Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') processed '
				+ recordsFreed + ' records.');

			// Check if we need to break out of the loop
			if (rows.length === 0 || rows.length < 1000) {
				if (!lastAccessedIsNull) {
					// Now let's process records that don't have a last accessed
					lastAccessedIsNull = true;

					offset = 0;
				}
				else {
					// All done
					break;
				}
			}
		}

		Zotero.debug('Zotero.Sync.Storage.Cache (' + libraryID + ') freed '
			+ recordsFreed + ' records.');
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
