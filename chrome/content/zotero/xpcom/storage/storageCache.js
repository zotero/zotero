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
 */
Zotero.Sync.Storage.Cache = {
	// A list of items whose files we should delete locally
	_itemsToFree: [],
	// Flag to indicate if we are already processing the above list
	_freeingCache: false,

	/**
	 * Add an attachment item to the queue to delete it's local files
	 *
	 * @param items {Array<Zotero.Item>|Zotero.Item} - Attachment Item(s) to remove from cache
	 *
	 * @returns {Promise<void>}
	 */
	free: async function (items) {
		// TODO: This will break if items is large so do something better
		Array.prototype.push.apply(this._itemsToFree, items);

		// If we are already processing, start
		if (!this._freeingCache) {
			this._processItem();
		}
	},

	/**
	 * Process one item from the list of cached items to remove
	 *
	 * @returns {Promise<void>}
	 */
	_processItem: async function () {
		if (!this._itemsToFree.length) {
			// No more items to process
			Zotero.debug('Finished processing items to remove from cache.');
			return;
		}

		let item = this._itemsToFree[0];

		// We can only remove files for attachment items
		if (!item.isAttachment()) {
			Zotero.debug('Cannot free item (' + item.id + ') because it is not an attachment.');
			this._processItem();
			return;
		}

		// Only remove files if we are downloading as needed
		if (!Zotero.Sync.Storage.Local.downloadAsNeeded(item.libraryID)) {
			Zotero.debug('Cannot free item (' + item.id + ') because download as needed is not enabled.');
			this._processItem();
			return;
		}

		// TODO: Check if item exists on server before deleting

		// Delete files and update sync status
		let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
		let iterator = new OS.File.DirectoryIterator(attachmentDirectory);
		Zotero.debug(attachmentDirectory);

		// Iterate through the directory and delete files/folders
		try {
			let deletes = [];
			await iterator.forEach(
				(entry) => {
					Zotero.debug(entry);
					Zotero.debug(entry.isDir);
					Zotero.debug(entry.name);
					Zotero.debug(entry.path);
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

		// TODO: Update sync status?

		Zotero.debug('Removed files for item (' + item.id + ').');
		this._itemsToFree.shift();
		await Zotero.Promise.delay(1000);
		this._processItem();
	}
};
