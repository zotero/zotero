/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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


// Implements nsIFlavorDataProvider for dragging attachment files to OS
//
// Not used on Windows in Firefox 3 or higher
Zotero.FileDragDataProvider = function (itemIDs) {
	this._itemIDs = itemIDs;
};

Zotero.FileDragDataProvider.prototype = {
	QueryInterface : function(iid) {
		if (iid.equals(Components.interfaces.nsIFlavorDataProvider) ||
			iid.equals(Components.interfaces.nsISupports)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	},

	getFlavorData : function(transferable, flavor, data, dataLen) {
		Zotero.debug("Getting flavor data for " + flavor);
		if (flavor == "application/x-moz-file-promise") {
			// On platforms other than OS X, the only directory we know of here
			// is the system temp directory, and we pass the nsIFile of the file
			// copied there in data.value below
			var useTemp = !Zotero.isMac;

			// Get the destination directory
			var dirPrimitive = {};
			var dataSize = {};
			transferable.getTransferData("application/x-moz-file-promise-dir", dirPrimitive, dataSize);
			var destDir = dirPrimitive.value.QueryInterface(Components.interfaces.nsIFile);

			var draggedItems = Zotero.Items.get(this._itemIDs);
			var items = [];

			// Make sure files exist
			var notFoundNames = [];
			for (var i=0; i<draggedItems.length; i++) {
				// TODO create URL?
				if (!draggedItems[i].isAttachment() ||
					draggedItems[i].getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					continue;
				}

				let path = draggedItems[i].getFilePath();
				if (path && Zotero.File.pathToFile(path).exists()) {
					items.push(draggedItems[i]);
				}
				else {
					notFoundNames.push(draggedItems[i].getField('title'));
				}
			}

			// If using the temp directory, create a directory to store multiple
			// files, since we can (it seems) only pass one nsIFile in data.value
			if (useTemp && items.length > 1) {
				var tmpDirName = 'Zotero Dragged Files';
				destDir.append(tmpDirName);
				if (destDir.exists()) {
					destDir.remove(true);
				}
				destDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
			}

			var copiedFiles = [];
			var existingItems = [];
			var existingFileNames = [];

			for (var i=0; i<items.length; i++) {
				// TODO create URL?
				if (!items[i].isAttachment() ||
					items[i].attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					continue;
				}

				var file = items[i].getFile();

				// Determine if we need to copy multiple files for this item
				// (web page snapshots)
				if (items[i].attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					var parentDir = file.parent;
					var files = parentDir.directoryEntries;
					var numFiles = 0;
					while (files.hasMoreElements()) {
						var f = files.getNext();
						f.QueryInterface(Components.interfaces.nsIFile);
						if (f.leafName.indexOf('.') != 0) {
							numFiles++;
						}
					}
				}

				// Create folder if multiple files
				if (numFiles > 1) {
					var dirName = Zotero.Attachments.getFileBaseNameFromItem(items[i]);
					try {
						if (useTemp) {
							var copiedFile = destDir.clone();
							copiedFile.append(dirName);
							if (copiedFile.exists()) {
								// If item directory already exists in the temp dir,
								// delete it
								if (items.length == 1) {
									copiedFile.remove(true);
								}
									// If item directory exists in the container
									// directory, it's a duplicate, so give this one
								// a different name
								else {
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
									var newName = copiedFile.leafName;
									copiedFile.remove(null);
								}
							}
						}

						parentDir.copyToFollowingLinks(destDir, newName ? newName : dirName);

						// Store nsIFile
						if (useTemp) {
							copiedFiles.push(copiedFile);
						}
					}
					catch (e) {
						if (e.name == 'NS_ERROR_FILE_ALREADY_EXISTS') {
							// Keep track of items that already existed
							existingItems.push(items[i].id);
							existingFileNames.push(dirName);
						}
						else {
							throw (e);
						}
					}
				}
				// Otherwise just copy
				else {
					try {
						if (useTemp) {
							var copiedFile = destDir.clone();
							copiedFile.append(file.leafName);
							if (copiedFile.exists()) {
								// If file exists in the temp directory,
								// delete it
								if (items.length == 1) {
									copiedFile.remove(true);
								}
									// If file exists in the container directory,
									// it's a duplicate, so give this one a different
								// name
								else {
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
									var newName = copiedFile.leafName;
									copiedFile.remove(null);
								}
							}
						}

						file.copyToFollowingLinks(destDir, newName ? newName : null);

						// Store nsIFile
						if (useTemp) {
							copiedFiles.push(copiedFile);
						}
					}
					catch (e) {
						if (e.name == 'NS_ERROR_FILE_ALREADY_EXISTS') {
							existingItems.push(items[i].id);
							existingFileNames.push(items[i].getFile().leafName);
						}
						else {
							throw (e);
						}
					}
				}
			}

			// Files passed via data.value will be automatically moved
			// from the temp directory to the destination directory
			if (useTemp && copiedFiles.length) {
				if (items.length > 1) {
					data.value = destDir.QueryInterface(Components.interfaces.nsISupports);
				}
				else {
					data.value = copiedFiles[0].QueryInterface(Components.interfaces.nsISupports);
				}
				dataLen.value = 4;
			}

			if (notFoundNames.length || existingItems.length) {
				var promptService = Services.prompt;
			}

			// Display alert if files were not found
			if (notFoundNames.length > 0) {
				// On platforms that use a temporary directory, an alert here
				// would interrupt the dragging process, so we just log a
				// warning to the console
				if (useTemp) {
					for (let name of notFoundNames) {
						var msg = "Attachment file for dragged item '" + name + "' not found";
						Zotero.log(msg, 'warning',
							'chrome://zotero/content/xpcom/itemTreeView.js');
					}
				}
				else {
					promptService.alert(null, Zotero.getString('general.warning'),
						Zotero.getString('dragAndDrop.filesNotFound') + "\n\n"
						+ notFoundNames.join("\n"));
				}
			}

			// Display alert if existing files were skipped
			if (existingItems.length > 0) {
				promptService.alert(null, Zotero.getString('general.warning'),
					Zotero.getString('dragAndDrop.existingFiles') + "\n\n"
					+ existingFileNames.join("\n"));
			}
		}
	}
}


/**
 * Implements nsIFlavorDataProvider for a single dragged attachment file, handing drop targets a
 * copy in the temp directory instead of the file in storage. The copy is made only when a target
 * asks for the file, so drags within Zotero don't copy anything, and a target that moves the
 * dropped file (e.g., File Explorer on Windows for an unmodified drag) moves the copy.
 *
 * A target can still be working on the copy after the drag ends -- e.g., while a replace/skip
 * dialog is open -- and gives no signal when it's done, so a copy's directory is removed only
 * once it's empty (the target moved the file), at the start of the next drag, or with the temp
 * directory at shutdown.
 *
 * @param {String} path
 */
Zotero.TempFileDragDataProvider = function (path) {
	this._path = path;
	this._file = null;
};

Zotero.TempFileDragDataProvider._copiedSinceDragEnd = false;

/**
 * Remove directories created for copies
 *
 * @param {Object} [options]
 * @param {Boolean} [options.onlyEmpty=false] - Remove only directories whose file the target has
 *     moved away, which is safe while a target may still be using another copy
 */
Zotero.TempFileDragDataProvider.removeCopies = async function ({ onlyEmpty = false } = {}) {
	let tmpDir = Zotero.getTempDirectory().path;
	let children;
	try {
		children = await IOUtils.getChildren(tmpDir);
	}
	catch (e) {
		Zotero.debug(e, 2);
		return;
	}
	for (let dir of children) {
		if (!/^drag(-\d+)?$/.test(PathUtils.filename(dir))) {
			continue;
		}
		try {
			if (onlyEmpty) {
				if ((await IOUtils.getChildren(dir)).length) {
					continue;
				}
				// Non-recursive, so a copy made in the meantime is never removed
				await IOUtils.remove(dir);
			}
			else {
				await IOUtils.remove(dir, { recursive: true });
			}
			Zotero.debug(`Removed drag copy directory ${dir}`);
		}
		// A target may still have a copy open
		catch (e) {
			Zotero.debug(e, 2);
		}
	}
};

/**
 * Call when a drag that offered files through these providers ends
 */
Zotero.TempFileDragDataProvider.onDragEnd = function () {
	if (!this._copiedSinceDragEnd) {
		return;
	}
	this._copiedSinceDragEnd = false;
	// An unmodified drop in File Explorer moves the copy right away, so remove the emptied
	// directory shortly after, with a later pass for a target that took longer
	for (let delay of [2000, 30000]) {
		setTimeout(() => this.removeCopies({ onlyEmpty: true }), delay);
	}
};

Zotero.TempFileDragDataProvider.prototype = {
	QueryInterface: ChromeUtils.generateQI(["nsIFlavorDataProvider"]),
	
	getFlavorData(_transferable, flavor, data) {
		if (flavor != 'application/x-moz-file') {
			return;
		}
		// Targets ask for the file repeatedly during a drag, so make the copy once
		if (!this._file) {
			let file = Zotero.File.pathToFile(this._path);
			// Copy into a directory of its own so that the copy keeps its filename
			let dir = Zotero.getTempDirectory();
			dir.append('drag');
			dir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
			Zotero.debug(`Copying ${this._path} to ${dir.path} for drag`);
			file.copyTo(dir, null);
			Zotero.TempFileDragDataProvider._copiedSinceDragEnd = true;
			dir.append(file.leafName);
			this._file = dir;
		}
		data.value = this._file;
	}
};
