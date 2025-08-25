/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2025 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

const clamp = (val, min = 0, max = 1.0) => Math.min(Math.max(val, min), max);

export const DEFAULT_ATTACHMENT_RENAME_TEMPLATE = "{{ firstCreator suffix=\" - \" }}{{ year suffix=\" - \" }}{{ title truncate=\"100\" }}";
export const DEFAULT_AUTO_RENAME_FILE_TYPES = "application/pdf,application/epub+zip";

/**
 * Renames all attachment files in Zotero based on their parent items' metadata.
 *
 * @async
 * @function
 * @param {Object} [options] - Options for renaming files.
 * @param {boolean} [options.userLibrary=true] - Whether to rename files in the user library.
 * @param {boolean} [options.groupLibrary=false] - Whether to rename files in group libraries.
 * @returns {Promise} Resolves when the renaming process is complete.
 */
export async function renameFilesFromParent({ userLibrary = true, groupLibrary = false } = {}) {
	const t1 = Date.now();
	let progress = 0;
	let adjustProgressBy = (additionalProgress) => {
		progress = clamp(progress + additionalProgress);
		Zotero.updateZoteroPaneProgressMeter(
			Math.round(progress * 100)
		);
	};

	Zotero.showZoteroPaneProgressMeter(null, true);
	Zotero.updateZoteroPaneProgressMeter(0);

	let libraries = Zotero.Libraries.getAll();
	adjustProgressBy(0.01); // move progress bar slightly while we load required data
	let items = [];
	let librariesWithAttachmentsToRename = [];

	for (let library of libraries) {
		let shouldRename = userLibrary && library.libraryType === 'user';
		
		if (!shouldRename) {
			// for group libraries, check `autoRenameFiles` synced setting
			shouldRename = groupLibrary && Zotero.SyncedSettings.get(library.libraryID, 'autoRenameFiles');
		}

		if (shouldRename) {
			items.push(...await Zotero.Items.getAll(library.libraryID, false, true));
			librariesWithAttachmentsToRename.push(library);
		}
	}

	adjustProgressBy(0.01);

	await Zotero.Items.loadDataTypes(items, ['itemData']);
	adjustProgressBy(0.01);

	// use remaining 97% of progress bar for renaming attachments
	let perItemProgress = 0.97 / items.length;
	let count = 0;
	let noFilePresentCount = 0;

	for (let parentItem of items) {
		adjustProgressBy(perItemProgress);
		if (!parentItem.isTopLevelItem() || !parentItem.isRegularItem()) {
			continue;
		}

		let attachmentItem = await parentItem.getBestAttachment();
		if (!attachmentItem) {
			continue;
		}

		if (!Zotero.Attachments.shouldAutoRenameAttachment(attachmentItem)) {
			continue;
		}

		let path = await attachmentItem.getFilePathAsync();
		const ext = path ? Zotero.File.getExtension(path) : attachmentItem.attachmentFilename.split('.').pop();

		let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: attachmentItem.getField('title') });
		Zotero.debug(`Renaming attachment ${attachmentItem.id} on parent item ${parentItem.id} to ${newName}`);

		if (path) {
			let out = {};
			const renamed = await attachmentItem.renameAttachmentFile(ext.length ? `${newName}.${ext}` : newName, { updateTitle: true, out });
			if (out.noChange) {
				continue;
			}
			if (renamed === true) {
				count++;
			}
			else {
				Zotero.debug(`Failed to rename attachment ${attachmentItem.id} on parent item ${parentItem.id}`);
			}
		}
		else if (attachmentItem.attachmentFilename !== newName && attachmentItem.isStoredFileAttachment()) {
			const oldFileName = attachmentItem.attachmentFilename;
			const oldBaseName = attachmentItem.attachmentFilename.replace(/\.[^.]+$/, '');

			// file is not present locally but we can still update filename in the database
			attachmentItem.attachmentFilename = newName;

			// update title if it matches the old filename
			if (attachmentItem.getField('title') === oldBaseName || attachmentItem.getField('title') === oldFileName) {
				attachmentItem.setAutoAttachmentTitle({ ignoreAutoRenamePrefs: true });
			}

			await attachmentItem.saveTx();
			noFilePresentCount++;
		}
	}
	const t2 = Date.now();
	Zotero.debug(`Renaming ${count + noFilePresentCount} attachments (${noFilePresentCount} with no file present) in ${librariesWithAttachmentsToRename.length} `
		+ `libraries took ${((t2 - t1) / 1000).toFixed(2)} seconds `
		+ `(user library: ${userLibrary}, group libraries: ${groupLibrary})`);
	Zotero.Prefs.set('autoRenameFiles.done', true);
	Zotero.hideZoteroPaneOverlays();
};

/**
 * Renames an invidual attachment file based on its parent item's metadata.
 *
 * @async
 * @param {Zotero.Item} attachmentItem - The attachment item to be renamed.
 * @throws {Error} If the item is not a valid attachment for renaming.
 * @returns {Promise}
 */
export async function renameFileFromParent(attachmentItem) {
	if (!attachmentItem.isAttachment() || attachmentItem.isTopLevelItem() || attachmentItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw new Error('Item ' + attachmentItem.itemID + ' cannot be renamed based on its parent item');
	}

	const parentItemID = attachmentItem.parentItemID;
	let parentItem = await Zotero.Items.getAsync(parentItemID);
	const oldBaseName = attachmentItem.attachmentFilename.replace(/\.[^.]+$/, '');
	const fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: attachmentItem.getField('title') });
	const ext = Zotero.Attachments.getCorrectFileExtension(attachmentItem);
	const newName = fileBaseName + (ext ? '.' + ext : '');

	const renamed = await attachmentItem.renameAttachmentFile(newName, { updateTitle: false, unique: true });
	let requiresSave = false;
	if (!renamed && attachmentItem.isStoredFileAttachment()) {
		// file is not present locally but we can still update filename in the database
		attachmentItem.attachmentFilename = newName;
		requiresSave = true;
	}

	if (attachmentItem.getField('title') === oldBaseName) {
		attachmentItem.setAutoAttachmentTitle({ ignoreAutoRenamePrefs: true });
		requiresSave = true;
	}

	if (requiresSave) {
		await attachmentItem.saveTx();
	}
};

export async function canRenameFileFromParent(attachmentItem) {
	if (!attachmentItem.isAttachment() || attachmentItem.isTopLevelItem() || attachmentItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		return false;
	}

	let path = await attachmentItem.getFilePathAsync();
	if (!path) {
		return false;
	}

	const parentItemID = attachmentItem.parentItemID;
	let parentItem = await Zotero.Items.getAsync(parentItemID);
	const origFilename = PathUtils.filename(path);
	const ext = Zotero.File.getExtension(path);
	let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: attachmentItem.getField('title') });

	newName = ext.length ? `${newName}.${ext}` : newName;
	return newName !== origFilename;
};


export function registerAutoRenameFileFromParent() {
	Zotero.Notifier.registerObserver({
		notify: async (event, _type, ids, extraData) => {
			if (!Zotero.Prefs.get('autoRenameFiles.onMetadataChange')) {
				return;
			}
			if (event !== 'modify') {
				return;
			}

			for (let id of ids) {
				if (extraData[id]?.skipRenameFile) {
					continue;
				}
				
				const parentItem = await Zotero.Items.getAsync(id);
				if (!parentItem.isTopLevelItem() || !parentItem.isRegularItem()) {
					continue;
				}

				let attachmentItem = await parentItem.getBestAttachment();
				
				if (!attachmentItem) {
					continue;
				}

				if (!Zotero.Attachments.shouldAutoRenameAttachment(attachmentItem)) {
					continue;
				}

				if (!extraData?.[id]?.changed) {
					continue;
				}

				let changes = Object.entries(extraData[id].changed).filter(([key, _value]) => {
					if (['tags', 'collections'].includes(key)) {
						return false; // Don't care about tags or collections
					}
					return true;
				});

				if (changes.length === 0) {
					continue; // No relevant changes
				}

				let parentItemBefore = parentItem.clone(null, { skipTags: true, includeCollections: false });
				let validFields = Zotero.ItemFields.getItemTypeFields(parentItem.itemTypeID).map(fieldID => Zotero.ItemFields.getName(fieldID));
				for (let [key, value] of changes) {
					if (key === 'itemType') {
						parentItemBefore.setType(value);
					}
					else if (key === 'creators') {
						parentItemBefore.setCreators(value);
					}
					else if (validFields.includes(key)) {
						parentItemBefore.setField(key, value);
					}
				}

				let previousMetadataBaseName = Zotero.Attachments.getFileBaseNameFromItem(
					parentItemBefore, { attachmentTitle: attachmentItem.getField('title') }
				);
				let currentBaseName = attachmentItem.attachmentFilename?.replace(/\.[^.]+$/, '') ?? '';

				if (previousMetadataBaseName === currentBaseName) {
					// Filename appears to be derived from the metadata, so update it to match the latest metadata.
					renameFileFromParent(attachmentItem);
				}
				else {
					// Filename has most likely been manually changed, so
					// don’t rename it. Reset `autoRenameFiles.done` so that
					// "Rename Files Now" appears in Preferences.
					Zotero.Prefs.set('autoRenameFiles.done', false);
				}
			}
		}
	}, ['item'], 'autoRenameFileFromParent', 150); // lower priority than the other item observers
}
