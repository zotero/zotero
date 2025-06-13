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
 * @returns {Promise<void>} Resolves when the renaming process is complete.
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
		if (!path) {
			continue;
		}

		const ext = Zotero.File.getExtension(path);
		let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: attachmentItem.getField('title') });

		Zotero.debug(`Renaming attachment ${attachmentItem.id} on parent item ${parentItem.id} to ${newName}`);
		
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
	const t2 = Date.now();
	Zotero.debug(`Renaming ${count} attachments in ${librariesWithAttachmentsToRename.length} libraries took ${((t2 - t1) / 1000).toFixed(2)} seconds. (rename in the user library: ${userLibrary}, rename in group libraries: ${groupLibrary})`);
	Zotero.Prefs.set('autoRenameFiles.done', true);
	Zotero.hideZoteroPaneOverlays();
};

export async function renameFileFromParent(attachmentItem) {
	if (!attachmentItem.isAttachment() || attachmentItem.isTopLevelItem() || attachmentItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw new Error('Item ' + attachmentItem.itemID + ' cannot be renamed based on its parent item');
	}

	let path = await attachmentItem.getFilePathAsync();
	if (!path) {
		return;
	}

	const parentItemID = attachmentItem.parentItemID;
	let parentItem = await Zotero.Items.getAsync(parentItemID);
	const oldBaseName = attachmentItem.attachmentFilename.replace(/\.[^.]+$/, '');
	const fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: attachmentItem.getField('title') });
	const ext = Zotero.Attachments.getCorrectFileExtension(attachmentItem);
	const newName = fileBaseName + (ext ? '.' + ext : '');

	const renamed = await attachmentItem.renameAttachmentFile(newName, { updateTitle: false, unique: true });
	if (!renamed) {
		Zotero.debug(`Failed to rename attachment ${attachmentItem.id} on parent item ${parentItem.id}`);
		return;
	}

	if (attachmentItem.getField('title') === oldBaseName) {
		attachmentItem.setAutoAttachmentTitle({ ignoreAutoRenamePrefs: true });
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
