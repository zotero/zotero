/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2020 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

Components.utils.import("resource://gre/modules/FileUtils.jsm");
let io;

function doLoad() {
	// Set font size from pref
	let sbc = document.getElementById('storage-breakdown');
	Zotero.setFontSize(sbc);

	io = window.arguments[0];

	updateView(1, []);
	calculateStorage();
}


function doUnload() {
	let storageBreakdown = document.getElementById('storage-breakdown');
	StorageBreakdown.destroy(storageBreakdown);
}

async function updateView(loading, partitions) {
	Zotero.debug('Updating view....' + loading);
	let storageBreakdown = document.getElementById('storage-breakdown');
	StorageBreakdown.render(storageBreakdown, { loading, partitions });
}

async function calculateStorage() {
	let partitions = Zotero.Libraries.getAll().map((library) => {
		return {
			libraryID: library.libraryID,
			name: library.name,
			size: 0,
			count: 0
		};
	});

	let loading = 2;
	let update = 0;
	
	await Zotero.Promise.all(partitions.map(async (partition, index) => {
		let items = await Zotero.Items.getAll(partition.libraryID);

		const getFileSize = (attachmentFile) => {
			Zotero.File.getFileSize(attachmentFile.path)
				.then((size) => {
					if (!attachmentFile.name.startsWith('.')) {
						partitions[index].size += size;
					}
				});
		};

		await Zotero.Promise.all(items.map(async (item) => {
			if (item.isImportedAttachment() && await item.fileExists()) {
				partitions[index].count += 1;

				await Zotero.File.iterateDirectory(
					Zotero.Attachments.getStorageDirectory(item).path,
					getFileSize
				);
			}

			if (update > 100) {
				updateView(loading, partitions);
				loading += 1;
				update = 0;
			}
			else {
				update += 1;
			}
		}));
	}));

	updateView(0, partitions);
}
