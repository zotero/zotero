/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

export async function renameFiles() {
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

	// We only rename files in group libraries if user has NOT changed the rename template.
	// See comments in https://github.com/zotero/zotero/pull/3860
	const shouldRenameInGroupLibraries = false; // TODO

	for (let library of libraries) {
		if (library.libraryType === 'user' || (shouldRenameInGroupLibraries && library.libraryType === 'group')) {
			items.push(...await Zotero.Items.getAll(library.libraryID, false, true));
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
		if (!attachmentItem || !Zotero.Attachments.shouldAutoRenameFile(attachmentItem.isLinkedFileAttachment())) {
			continue;
		}

		let path = await attachmentItem.getFilePathAsync();
		if (!path) {
			continue;
		}

		let newName = await Zotero.Attachments.getRenamedFileBaseNameIfAllowedType(parentItem, path);
		if (newName) {
			Zotero.debug(`Renaming attachment ${attachmentItem.id} on parent item ${parentItem.id} to ${newName}`);
			const ext = Zotero.File.getExtension(path);
			let out = {};
			const renamed = await attachmentItem.renameAttachmentFile(ext.length ? `${newName}.${ext}` : newName, { updateTitle: true, out });
			if (renamed === true && !out.noChange) {
				count++;
			}
			else {
				Zotero.debug(`Failed to rename attachment ${attachmentItem.id} on parent item ${parentItem.id}`);
			}
		}
	}
	const t2 = Date.now();
	Zotero.debug(`Renamed ${count} attachments in ${((t2 - t1) / 1000).toFixed(2)} seconds`);
	Zotero.Prefs.set('autoRenameFiles.done', true);
	Zotero.hideZoteroPaneOverlays();
};
