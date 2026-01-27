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

const getExtension = filename => filename.match(/\.([^.]+)$/)?.[1] ?? '';

const getNewFileNameData = async (attachmentItem, parentItem) => {
	const newFileBaseName = Zotero.Attachments.getFileBaseNameFromItem(
		parentItem, { attachmentTitle: attachmentItem.getField('title') }
	);

	const path = await attachmentItem.getFilePathAsync();
	const ext = path
		? Zotero.Attachments.getCorrectFileExtension(attachmentItem)
		: getExtension(attachmentItem.attachmentFilename);

	const newName = newFileBaseName + (ext ? '.' + ext : '');
	return { newName, isFilePresent: !!path };
};

/**
 * Rename eligible attachment files based on their parent items' metadata.
 * @async
 * @param {Object} [options]
 * @param {boolean} [options.userLibrary=true] - Process "My Library".
 * @param {boolean} [options.groupLibrary=false] - Process group libraries.
 * @param {boolean} [options.pretend=false] - If true, perform a dry run (compile a list of files to rename).
 * @param {(progress:number)=>void} [options.reportProgress] - Callback for progress updates (0..1).
 * @returns {Promise<Array<{attachmentId:number,parentItemId:number,oldName:string,newName:string,isFilePresent:boolean}>>}
 *          Summary of (performed or proposed) rename operations.
 */
export async function renameFilesFromParent({ userLibrary = true, groupLibrary = false, pretend = false, reportProgress = () => {} } = {}) {
	const t1 = Date.now();
	let summary = [];
	let progress = 0;

	let adjustProgressBy = (additionalProgress) => {
		progress = clamp(progress + additionalProgress);
		reportProgress(progress);
	};

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

		const { newName, isFilePresent } = await getNewFileNameData(attachmentItem, parentItem);
		Zotero.debug(`Renaming attachment ${attachmentItem.id} on parent item ${parentItem.id} to ${newName}`);

		if (newName !== attachmentItem.attachmentFilename) {
			summary.push({
				attachmentId: attachmentItem.id,
				parentItemId: parentItem.id,
				oldName: attachmentItem.attachmentFilename,
				newName,
				isFilePresent
			});
		}

		if (!pretend) {
			if (isFilePresent) {
				let out = {};
				const renamed = await attachmentItem.renameAttachmentFile(newName, { updateTitle: true, out });
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
				attachmentItem.attachmentFilename = newName;

				// update the title if it matches the old filename
				const newTitleLC = attachmentItem.getField('title').toLowerCase();
				if (newTitleLC === oldBaseName.toLowerCase() || newTitleLC === oldFileName.toLowerCase()) {
					attachmentItem.setAutoAttachmentTitle();
				}

				await attachmentItem.saveTx();
				noFilePresentCount++;
			}
		}
	}
	const t2 = Date.now();
	if (!pretend) {
		Zotero.debug(`Renaming ${count + noFilePresentCount} attachments (${noFilePresentCount} with no file present) in ${librariesWithAttachmentsToRename.length} `
			+ `libraries took ${((t2 - t1) / 1000).toFixed(2)} seconds `
			+ `(user library: ${userLibrary}, group libraries: ${groupLibrary})`);
		Zotero.Prefs.set('autoRenameFiles.done', true);
	}
	return summary;
};

/**
 * Renames an individual attachment file based on its parent item's metadata.
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

	const oldName = attachmentItem.attachmentFilename;
	const oldBaseName = attachmentItem.attachmentFilename.replace(/\.[^.]+$/, '');
	const parentItemID = attachmentItem.parentItemID;
	let parentItem = await Zotero.Items.getAsync(parentItemID);
	const { newName } = await getNewFileNameData(attachmentItem, parentItem);

	const renamed = await attachmentItem.renameAttachmentFile(
		newName, { updateTitle: false, unique: true }
	);

	let requiresSave = false;
	if (!renamed && attachmentItem.isStoredFileAttachment()) {
		// the file is not present locally, but we can still update the filename in the database
		attachmentItem.attachmentFilename = newName;
		requiresSave = true;
	}
	
	const newTitleLC = attachmentItem.getField('title').toLowerCase();
	if (newTitleLC === oldBaseName.toLowerCase() || newTitleLC === oldName.toLowerCase()) {
		attachmentItem.setAutoAttachmentTitle();
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
				if (!parentItem.isRegularItem() || parentItem.isFeedItem) {
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
						parentItemBefore.setCreators(Object.values(value));
					}
					else if (validFields.includes(key)) {
						parentItemBefore.setField(key, value);
					}
				}

				await attachmentItem.loadDataType('itemData');
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

export async function openRenameFilesPreview() {
	Services.ww.openWindow(null, "chrome://zotero/content/renameFilesPreview.xhtml",
		"renameFilesPreview", "chrome,dialog=yes,centerscreen,modal", null);
}

export async function promptAutoRenameFiles() {
	let [title, description, yes, no] = await Zotero.getMainWindow().document.l10n.formatValues([
		'file-renaming-auto-rename-prompt-title',
		'file-renaming-auto-rename-prompt-body',
		'file-renaming-auto-rename-prompt-yes',
		'file-renaming-auto-rename-prompt-no'
	]);
	let index = Zotero.Prompt.confirm({
		title,
		text: description,
		button0: yes,
		button1: no
	});
	if (index == 0) {
		openRenameFilesPreview();
	}
	else {
		Zotero.Prefs.set('autoRenameFiles.done', false);
	}
}
