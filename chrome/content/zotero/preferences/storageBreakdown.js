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
	StorageBreakdownContainer.destroy(storageBreakdown);
}

async function updateView(loading, partitions) {
	let storageBreakdown = document.getElementById('storage-breakdown');
	StorageBreakdownContainer.render(storageBreakdown, { loading, partitions });
}

async function calculateStorage() {
	let partitions = [
		{
			name: 'Zotero Data',
			size: 0,
			count: 0
		},
		{
			name: 'Attachment Files',
			size: 0,
			count: 0
		}
	];

	await Zotero.File.iterateDirectory(Zotero.DataDirectory.dir, (entry) => {
		// Ignore storage directory
		if (entry.path === Zotero.getStorageDirectory().path) {
			return;
		}

		if (!entry.isDir) {
			Zotero.File.getFileSize(entry.path)
				.then(size => {
					partitions[0].count += 1;
					partitions[0].size += size;
				});
			return;
		}

		Zotero.File.iterateDirectory(entry.path, (attachmentFile) => {
			Zotero.File.getFileSize(attachmentFile.path)
				.then((size) => {
					partitions[0].count += 1;
					partitions[0].size += size;
				});
		});
	});

	updateView(2, partitions);

	let loading = 3;
	let update = 0;

	await Zotero.File.iterateDirectory(Zotero.getStorageDirectory().path, async (entry) => {
		if (!entry.isDir) {
			return;
		}

		await Zotero.File.iterateDirectory(entry.path, (attachmentFile) => {
			Zotero.File.getFileSize(attachmentFile.path)
				.then((size) => {
					if (entry.name.startsWith('.')) {
						partitions[0].count += 1;
						partitions[0].size += size;
					}
					else {
						partitions[1].count += 1;
						partitions[1].size += size;
					}
				});
		});

		if (update > 30) {
			updateView(loading, partitions);
			loading += 1;
			update = 0;
		}
		else {
			update += 1;
		}
	});

	updateView(0, partitions);
}
