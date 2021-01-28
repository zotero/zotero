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
					if (!itemIDs.has(attachment.id)) {
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
	 * Remove all attachment files for the given item/items and mark them as no longer cached
	 *
	 * @param {Zotero.Item[]} items
	 * @return {Promise}
	 */
	removeAttachmentFilesForItems: async function (items) {
		let attachmentItems = await this._getAllImportedAttachments(items);

		// Delete all files (will update the DB as well)
		await Zotero.Promise.all(
			attachmentItems.map(attachmentItem => this._deleteItemFiles(attachmentItem))
		);
		
		// TODO: There seems to be a lag compared to download file of how long it takes the
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
	 * Identify items with files currently downloaded that we should delete to limit cache
	 *
	 * Called when the limit cache preference is turned on or when a new item is downloaded or
	 * added.
	 *
	 * @param {Boolean} [forGroups] - True if we identifying in group libraries or the user library
	 * @return {Promise}
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
	 * @param {Integer} libraryID - Library ID to search for items to free
	 * @return {Promise}
	 */
	identifyItemsToFreeForLibrary: async function (libraryID) {
		let library = Zotero.Libraries.get(libraryID);
		// Check library has storage
		if (!Zotero.Sync.Storage.Local.getEnabledForLibrary(libraryID)) {
			Zotero.debug(`Storage Cache: ${library.name} does not have storage enabled`);
			return;
		}

		// Check this library is on demand
		if (!Zotero.Sync.Storage.Local.downloadAsNeeded(libraryID)) {
			Zotero.debug(`Storage Cache: ${library.name} is not download-as-needed`);
			return;
		}

		let cacheTime = this._cacheLimitForLibrary(libraryID);
		if (cacheTime === false) {
			Zotero.debug(`Storage Cache: ${library.name} does not have cache eviction enabled`);
			return;
		}

		Zotero.debug(`Storage Cache: ${library.name} cache enabled for ${cacheTime} days`);

		// Turn cache limit into seconds for timestamp
		cacheTime *= 86400;

		// Keep track of offset into table
		let offset = 0;
		let lastAccessedIsNull = false;
		let recordsFreed = 0;

		// Delete files older than the cache limit
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

			for (let i = 0; i < rows.length; i++) {
				let item = await Zotero.Items.getAsync(rows[i].itemID);

				await this._deleteItemFiles(item);

				// Slow down so we don't bog the system down
				await Zotero.Promise.delay(500);
			}

			offset += 1000;
			recordsFreed += rows.length;
			Zotero.debug(`Storage Cache: Processed ${recordsFreed} for ${library.name}`);

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

		Zotero.debug(`Storage Cache: ${library.name} is finished processing`);
	},

	/**
	 * Get the cache limit for the given library or `false` if TTL is not enabled
	 *
	 * @param {Integer} libraryID
	 * @return {Boolean|Integer} False if TTL is not enabled, otherwise TTL value in days
	 */
	_cacheLimitForLibrary: function (libraryID) {
		let enabled = Zotero.Prefs.get(this._getPrefForLibrary(libraryID, 'ttl'));
		if (!enabled) {
			return false;
		}

		return Zotero.Prefs.get(this._getPrefForLibrary(libraryID, 'ttl.value'));
	},

	_getPrefForLibrary: function (libraryID, pref) {
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return 'sync.storage.personal.' + pref;
		}

		// Group library custom settings, if enabled
		let groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
		if (Zotero.Prefs.get('sync.storage.groups.' + groupID + '.custom')) {
			return 'sync.storage.groups.' + groupID + '.' + pref;
		}

		// Fall back to global group settings
		return 'sync.storage.groups.' + pref;
	},

	/**
	 * Delete files for the given item
	 *
	 * Note: This will also update the sync state to for affected items to:
	 * Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise<Boolean>} - True if we found files to delete
	 */
	_deleteItemFiles: async function (item) {
		let fileExistsOnServer = await Zotero.Sync.Runner.checkFileExists(item);
		if (!fileExistsOnServer) {
			Zotero.debug(`Storage Cache: ${item.id} does not exist on server`);
			return false;
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

		// TODO: Need to be careful about not overriding a sync state like to-upload or something
		// Mark item to be downloaded again. Since we are in as-needed mode this won't cause
		// it to immediately download again.
		item.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD;
		await item.saveTx({ skipAll: true });

		Zotero.debug(`Storage Cache: ${item.id} had ${deletes.length} files removed`);
		return deletes.length > 0;
	}
};
