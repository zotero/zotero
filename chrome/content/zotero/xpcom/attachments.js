/*
 ***** BEGIN LICENSE BLOCK *****
 
 Copyright © 2009 Center for History and New Media
 George Mason University, Fairfax, Virginia, USA
 http://zotero.org
 
 This file is part of Zotero.
 
 Zotero is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 Zotero is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU Affero General Public License for more details.
 
 You should have received a copy of the GNU Affero General Public License
 along with Zotero. If not, see <http://www.gnu.org/licenses/>.
 
 ***** END LICENSE BLOCK *****
*/

Zotero.Attachments = new function () {
	const { HiddenBrowser } = ChromeUtils.import("chrome://zotero/content/HiddenBrowser.jsm");
	
	// Keep in sync with Zotero.Schema.integrityCheck() and this.linkModeToName()
	this.LINK_MODE_IMPORTED_FILE = 0;
	this.LINK_MODE_IMPORTED_URL = 1;
	this.LINK_MODE_LINKED_FILE = 2;
	this.LINK_MODE_LINKED_URL = 3;
	this.LINK_MODE_EMBEDDED_IMAGE = 4;
	
	this.BASE_PATH_PLACEHOLDER = 'attachments:';
	
	var _findPDFQueue = [];
	var _findPDFQueuePromise = null;
	
	var self = this;
	
	
	/**
	 * @param {Object} options
	 * @param {nsIFile|String} [options.file] - File to add
	 * @param {Integer} [options.libraryID]
	 * @param {Integer[]|String[]} [options.parentItemID] - Parent item to add item to
	 * @param {String} [options.title]
	 * @param {Integer[]} [options.collections] - Collection keys or ids to add new item to
	 * @param {String} [options.fileBaseName]
	 * @param {String} [options.contentType]
	 * @param {String} [options.charset]
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.importFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from file');
		
		var libraryID = options.libraryID;
		var file = Zotero.File.pathToFile(options.file);
		var path = file.path;
		var leafName = file.leafName;
		var parentItemID = options.parentItemID;
		var title = options.title;
		var collections = options.collections;
		var fileBaseName = options.fileBaseName;
		var contentType = options.contentType;
		var charset = options.charset;
		var saveOptions = options.saveOptions;
		
		if (fileBaseName) {
			let ext = Zotero.File.getExtension(path);
			var newName = fileBaseName + (ext != '' ? '.' + ext : '');
		}
		else {
			var newName = Zotero.File.getValidFileName(leafName);
		}
		
		if (leafName.endsWith(".lnk")) {
			throw new Error("Cannot add Windows shortcut");
		}
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var attachmentItem, newFile, destDir;
		try {
			yield Zotero.DB.executeTransaction(async function () {
				// Create a new attachment
				attachmentItem = new Zotero.Item('attachment');
				if (parentItemID) {
					let {libraryID: parentLibraryID, key: parentKey} =
						Zotero.Items.getLibraryAndKeyFromID(parentItemID);
					attachmentItem.libraryID = parentLibraryID;
				}
				else if (libraryID) {
					attachmentItem.libraryID = libraryID;
				}
				// If we have an explicit title, set it now
				// Otherwise do it below once we've set the other attachment properties
				// and can generate a title via setAutoAttachmentTitle()
				if (title != undefined) {
					attachmentItem.setField('title', title);
				}
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
				if (collections) {
					attachmentItem.setCollections(collections);
				}
				await attachmentItem.save(saveOptions);
				
				// Create directory for attachment files within storage directory
				destDir = await this.createDirectoryForItem(attachmentItem);
				
				// Point to copied file
				newFile = OS.Path.join(destDir, newName);
				
				// Copy or move file to unique filename, which automatically shortens long filenames
				if (options.moveFile) {
					const newFilePath = await Zotero.File.moveToUnique(file.path, newFile);
					newFile = Zotero.File.pathToFile(newFilePath);
				}
				else {
					newFile = Zotero.File.copyToUnique(file, newFile);
				}
				
				await Zotero.File.setNormalFilePermissions(newFile.path);
				
				if (!contentType) {
					contentType = await Zotero.MIME.getMIMETypeFromFile(newFile);
				}
				attachmentItem.attachmentContentType = contentType;
				if (charset) {
					attachmentItem.attachmentCharset = charset;
				}
				attachmentItem.attachmentPath = newFile.path;
				if (title == undefined) {
					attachmentItem.setAutoAttachmentTitle();
				}
				await attachmentItem.save(saveOptions);
			}.bind(this));
			try {
				yield _postProcessFile(attachmentItem);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.logError("Failed importing file " + file.path);
			
			// Clean up
			try {
				if (destDir && (yield OS.File.exists(destDir))) {
					yield OS.File.removeDir(destDir);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			throw e;
		}
		
		return attachmentItem;
	});
	
	
	/**
	 * @param {nsIFile|String} options.file - File to add
	 * @param {Integer[]|String[]} [options.parentItemID] - Parent item to add item to
	 * @param {String} [options.title]
	 * @param {Integer[]} [options.collections] - Collection keys or ids to add new item to
	 * @param {String} [options.contentType] - Content type
	 * @param {String} [options.charset] - Character set
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.linkFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from file');
		
		var file = Zotero.File.pathToFile(options.file);
		var parentItemID = options.parentItemID;
		var title = options.title;
		var collections = options.collections;
		var contentType = options.contentType || (yield Zotero.MIME.getMIMETypeFromFile(file));
		var charset = options.charset;
		var saveOptions = options.saveOptions;
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var item = yield _addToDB({
			file,
			title,
			linkMode: this.LINK_MODE_LINKED_FILE,
			contentType,
			charset,
			parentItemID,
			collections,
			saveOptions
		});
		try {
			yield _postProcessFile(item);
		}
		catch (e) {
			Zotero.logError(e);
		}
		return item;
	});
	
	
	/**
	 * @param {String} options.path - Relative path to file
	 * @param {String} options.title
	 * @param {String} options.contentType
	 * @param {Integer[]|String[]} [options.parentItemID] - Parent item to add item to
	 * @param {Integer[]} [options.collections] - Collection keys or ids to add new item to
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.linkFromFileWithRelativePath = async function (options) {
		Zotero.debug('Linking attachment from file in base directory');
		
		var path = options.path;
		var title = options.title;
		var contentType = options.contentType;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		var saveOptions = options.saveOptions;
		
		if (!path) {
			throw new Error("'path' not provided");
		}
		
		if (path.startsWith('/') || path.match(/^[A-Z]:\\/)) {
			throw new Error("'path' must be a relative path");
		}
		
		if (!title) {
			throw new Error("'title' not provided");
		}
		
		if (!contentType) {
			throw new Error("'contentType' not provided");
		}
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		path = Zotero.Attachments.BASE_PATH_PLACEHOLDER + path;
		var item = await _addToDB({
			file: path,
			title,
			linkMode: this.LINK_MODE_LINKED_FILE,
			contentType,
			parentItemID,
			collections,
			saveOptions
		});
		
		// If the file is found (which requires a base directory being set and the file existing),
		// index it
		var file = this.resolveRelativePath(path);
		if (file && await OS.File.exists(file)) {
			try {
				await _postProcessFile(item);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		return item;
	};
	
	
	/**
	 * @param {Object} options - 'file', 'url', 'title', 'contentType', 'charset', 'libraryID', 'parentItemID', 'singleFile'
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.importSnapshotFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing snapshot from file');
		
		var file = Zotero.File.pathToFile(options.file);
		// TODO: Fix main filename when copying directory, though in that case it's probably
		// from our own export and already clean
		var fileName = options.singleFile
			? Zotero.File.getValidFileName(file.leafName)
			: file.leafName;
		var url = options.url;
		var title = options.title;
		var contentType = options.contentType;
		var charset = options.charset;
		var libraryID = options.libraryID;
		var parentItemID = options.parentItemID;
		var saveOptions = options.saveOptions;
		
		if (parentItemID) {
			libraryID = Zotero.Items.getLibraryAndKeyFromID(parentItemID).libraryID;
		}
		else if (contentType == 'text/html') {
			throw new Error("parentItemID not provided");
		}
		
		// Webpage snapshots must have parent items
		if (!parentItemID && contentType == 'text/html') {
			throw new Error("parentItemID not provided");
		}
		
		var attachmentItem, itemID, destDir, newPath;
		try {
			yield Zotero.DB.executeTransaction(async function () {
				// Create a new attachment
				attachmentItem = new Zotero.Item('attachment');
				if (libraryID) {
					attachmentItem.libraryID = libraryID;
				}
				attachmentItem.setField('title', title);
				attachmentItem.setField('url', url);
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_URL;
				attachmentItem.attachmentContentType = contentType;
				attachmentItem.attachmentCharset = charset;
				attachmentItem.attachmentPath = 'storage:' + fileName;
				
				// DEBUG: this should probably insert access date too so as to
				// create a proper item, but at the moment this is only called by
				// translate.js, which sets the metadata fields itself
				itemID = await attachmentItem.save(saveOptions);
				
				var storageDir = Zotero.getStorageDirectory();
				destDir = this.getStorageDirectory(attachmentItem);
				await IOUtils.remove(destDir.path, { recursive: true, ignoreAbsent: true });
				newPath = OS.Path.join(destDir.path, fileName);
				// Copy single file to new directory
				if (options.singleFile) {
					await this.createDirectoryForItem(attachmentItem);
					if (options.moveFile) {
						await OS.File.move(file.path, newPath);
					}
					else {
						await OS.File.copy(file.path, newPath);
					}
				}
				// Copy entire parent directory (for HTML snapshots)
				else {
					file.parent.copyTo(storageDir, destDir.leafName);
				}
			}.bind(this));
			try {
				yield _postProcessFile(attachmentItem);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		catch (e) {
			Zotero.logError(e);
			
			// Clean up
			try {
				if (destDir && destDir.exists()) {
					destDir.remove(true);
				}
			}
			catch (e) {
				Zotero.logError(e, 1);
			}
			
			throw e;
		}
		return attachmentItem;
	});


	/**
	 * Saves an image for a parent note or image annotation
	 *
	 * Emerging formats like WebP and AVIF are supported here,
	 * but should be filtered on the calling logic for now
	 *
	 * @param {Object} params
	 * @param {Blob} params.blob - Image to save
	 * @param {Integer} params.parentItemID - Note or annotation item to add item to
	 * @param {Object} [params.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.importEmbeddedImage = async function ({ blob, parentItemID, saveOptions }) {
		Zotero.debug('Importing embedded image');
		
		if (!parentItemID) {
			throw new Error("parentItemID must be provided");
		}
		
		var contentType = blob.type;
		var fileExt;
		switch (contentType) {
			case 'image/apng':
				fileExt = 'apng';
				break;
			case 'image/avif': // Supported from FF 86
				fileExt = 'avif';
				break;
			case 'image/gif':
				fileExt = 'gif';
				break;
			case 'image/jpeg':
				fileExt = 'jpg';
				break;
			case 'image/png':
				fileExt = 'png';
				break;
			case 'image/svg+xml':
				fileExt = 'svg';
				break;
			case 'image/webp': // Supported from FF 65
				fileExt = 'webp';
				break;
			case 'image/bmp':
				fileExt = 'bmp';
				break;
			default:
				throw new Error(`Unsupported embedded image content type '${contentType}'`);
		}
		var filename = 'image.' + fileExt;
		
		var attachmentItem;
		var destDir;
		try {
			await Zotero.DB.executeTransaction(async function () {
				// Create a new attachment
				attachmentItem = new Zotero.Item('attachment');
				let { libraryID: parentLibraryID } = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
				attachmentItem.libraryID = parentLibraryID;
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = this.LINK_MODE_EMBEDDED_IMAGE;
				attachmentItem.attachmentPath = 'storage:' + filename;
				attachmentItem.attachmentContentType = contentType;
				await attachmentItem.save(saveOptions);
				
				// Write blob to file in attachment directory
				destDir = await this.createDirectoryForItem(attachmentItem);
				let file = OS.Path.join(destDir, filename);
				await Zotero.File.putContentsAsync(file, blob);
				await Zotero.File.setNormalFilePermissions(file);
			}.bind(this));
		}
		catch (e) {
			Zotero.logError("Failed importing image:\n\n" + e);
			
			// Clean up
			try {
				if (destDir) {
					await OS.File.removeDir(destDir, { ignoreAbsent: true });
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			throw e;
		}
		
		return attachmentItem;
	};
	
	
	/**
	 * Copy an image from one note to another
	 *
	 * @param {Object} params
	 * @param {Zotero.Item} params.attachment - Image attachment to copy
	 * @param {Zotero.Item} params.note - Note item to add attachment to
	 * @param {Object} [params.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.copyEmbeddedImage = async function ({ attachment, note, saveOptions }) {
		Zotero.DB.requireTransaction();
		
		if (!attachment.isEmbeddedImageAttachment()) {
			throw new Error("'attachment' must be an embedded image");
		}
		
		if (!await attachment.fileExists()) {
			throw new Error("Image attachment file doesn't exist");
		}
		
		var newAttachment = attachment.clone(note.libraryID);
		// Attachment path isn't copied over by clone() if libraryID is different
		newAttachment.attachmentPath = attachment.attachmentPath;
		newAttachment.parentID = note.id;
		await newAttachment.save(saveOptions);
		
		let dir = Zotero.Attachments.getStorageDirectory(attachment);
		let newDir = await Zotero.Attachments.createDirectoryForItem(newAttachment);
		await Zotero.File.copyDirectory(dir, newDir);
		
		return newAttachment;
	};
	
	
	/**
	 * @param {Object} options
	 * @param {Integer} options.libraryID
	 * @param {String} options.url
	 * @param {Integer} [options.parentItemID]
	 * @param {Integer[]} [options.collections]
	 * @param {String} [options.title]
	 * @param {String} [options.fileBaseName]
	 * @param {Boolean} [options.renameIfAllowedType=false]
	 * @param {String} [options.contentType]
	 * @param {String} [options.referrer]
	 * @param {CookieSandbox} [options.cookieSandbox]
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromURL = Zotero.Promise.coroutine(function* (options) {
		var libraryID = options.libraryID;
		var url = options.url;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		var title = options.title;
		var fileBaseName = options.fileBaseName;
		var renameIfAllowedType = options.renameIfAllowedType;
		var contentType = options.contentType;
		var referrer = options.referrer;
		var cookieSandbox = options.cookieSandbox;
		var saveOptions = options.saveOptions;
		
		Zotero.debug('Importing attachment from URL ' + url);
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		// Throw error on invalid URLs
		//
		// TODO: allow other schemes
		var urlRe = /^https?:\/\/[^\s]*$/;
		var matches = urlRe.exec(url);
		if (!matches) {
			throw new Error("Invalid URL '" + url + "'");
		}
		
		// Save using a hidden browser
		var nativeHandlerImport = async function () {
			let browser;
			try {
				browser = new HiddenBrowser({
					docShell: { allowImages: true },
					cookieSandbox,
				});
				await browser.load(url, { requireSuccessfulStatus: true });
				return await Zotero.Attachments.importFromDocument({
					libraryID,
					browser,
					parentItemID,
					title,
					collections,
					saveOptions
				});
			}
			catch (e) {
				Zotero.logError(e);
				throw e;
			}
			finally {
				if (browser) browser.destroy();
			}
		};
		
		// Save using remote web browser persist
		var externalHandlerImport = async function (contentType) {
			// Rename attachment
			if (renameIfAllowedType && !fileBaseName && this.getRenamedFileTypes().includes(contentType)) {
				let parentItem = Zotero.Items.get(parentItemID);
				fileBaseName = this.getFileBaseNameFromItem(parentItem);
			}
			if (fileBaseName) {
				let ext = this._getExtensionFromURL(url, contentType);
				var filename = fileBaseName + (ext != '' ? '.' + ext : '');
			}
			else {
				var filename = this._getFileNameFromURL(url, contentType);
			}
			
			// Create a temporary directory to save to within the storage directory.
			// We don't use the normal temp directory because people might have 'storage'
			// symlinked to another volume, which would make the save slower.
			var tmpDir = (await this.createTemporaryStorageDirectory()).path;
			var tmpFile = OS.Path.join(tmpDir, filename);
			
			var attachmentItem;
			
			try {
				await this.downloadFile(
					url,
					tmpFile,
					{
						cookieSandbox,
						referrer,
						isPDF: contentType == 'application/pdf',
						shouldDisplayCaptcha: true
					}
				);
				
				attachmentItem = await this.createURLAttachmentFromTemporaryStorageDirectory({
					directory: tmpDir,
					libraryID,
					parentItemID,
					title,
					filename,
					url,
					contentType,
					collections,
					saveOptions
				});
			}
			catch (e) {
				try {
					if (tmpDir) {
						await OS.File.removeDir(tmpDir, { ignoreAbsent: true });
					}
				}
				catch (e) {
					Zotero.debug(e, 1);
				}
				throw e;
			}
			
			return attachmentItem;
		}.bind(this);
		
		var process = function (contentType, hasNativeHandler) {
			// If we can load this natively, use a hidden browser
			// (so we can get the charset and title and index the document)
			if (hasNativeHandler) {
				return nativeHandlerImport();
			}
			
			// Otherwise use a remote web page persist
			return externalHandlerImport(contentType);
		}
		
		if (contentType) {
			return process(contentType, Zotero.MIME.hasNativeHandler(contentType));
		}
		
		var args = yield Zotero.MIME.getMIMETypeFromURL(url, cookieSandbox);
		return process(...args);
	});
	
	
	/**
	 * Create an imported-URL attachment using a file downloaded to a temporary directory
	 * in 'storage', moving the directory into place
	 *
	 * We download files to temporary 'storage' directories rather than the normal temporary
	 * directory because people might have their storage directory on another device, which
	 * would make the move a copy.
	 *
	 * @param {Object} options
	 * @param {String} options.directory
	 * @param {Number} options.libraryID
	 * @param {String} options.filename
	 * @param {String} options.url
	 * @param {Number} [options.parentItemID]
	 * @param {String} [options.title]
	 * @param {String} options.contentType
	 * @param {String[]} [options.collections]
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Zotero.Item}
	 */
	this.createURLAttachmentFromTemporaryStorageDirectory = async function (options) {
		if (!options.directory) throw new Error("'directory' not provided");
		if (!options.libraryID) throw new Error("'libraryID' not provided");
		if (!options.filename) throw new Error("'filename' not provided");
		if (!options.url) throw new Error("'directory' not provided");
		if (!options.contentType) throw new Error("'contentType' not provided");
		
		var notifierQueue = (options.saveOptions && options.saveOptions.notifierQueue)
				|| new Zotero.Notifier.Queue;
		var attachmentItem = new Zotero.Item('attachment');
		try {
			// Create DB item
			if (options.libraryID) {
				attachmentItem.libraryID = options.libraryID;
			}
			else if (options.parentItemID) {
				let {libraryID: parentLibraryID, key: parentKey} =
					Zotero.Items.getLibraryAndKeyFromID(options.parentItemID);
				attachmentItem.libraryID = parentLibraryID;
			}
			attachmentItem.setField('title', options.title != undefined ? options.title : options.filename);
			attachmentItem.setField('url', options.url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			attachmentItem.parentID = options.parentItemID;
			attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			attachmentItem.attachmentContentType = options.contentType;
			if (options.collections) {
				attachmentItem.setCollections(options.collections);
			}
			attachmentItem.attachmentPath = 'storage:' + options.filename;
			await attachmentItem.saveTx(
				Object.assign(
					{ notifierQueue },
					options.saveOptions || {}
				)
			);
			
			// Move file to final location
			let destDir = this.getStorageDirectory(attachmentItem).path;
			try {
				await OS.File.move(options.directory, destDir);
			}
			catch (e) {
				await attachmentItem.eraseTx({ notifierQueue });
				throw e;
			}
		}
		finally {
			await Zotero.Notifier.commit(notifierQueue);
		}
		
		await Zotero.FullText.queueItem(attachmentItem);
		
		return attachmentItem;
	};
	
	
	/**
	 * Create a link attachment from a URL
	 *
	 * @param {Object} options - 'url', 'parentItemID', 'contentType', 'title', 'collections'
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.linkFromURL = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from URL');
	 
		var url = options.url;
		var parentItemID = options.parentItemID;
		var contentType = options.contentType;
		var title = options.title;
		var collections = options.collections;
		var saveOptions = options.saveOptions;
		
		var schemeRE = /^([a-z][a-z0-9+.-]+):/;
		var matches = url.match(schemeRE);
		if (!matches) {
			throw new Error(`Invalid URL '${url}'`);
		}
		var scheme = matches[1];
		if (['javascript', 'data', 'chrome', 'resource', 'mailto'].includes(scheme)) {
			throw new Error(`Invalid scheme '${scheme}'`);
		}
		
		// If no title provided, figure it out from the URL
		// Web addresses with paths will be whittled to the last element
		// excluding references and queries. All others are the full string
		if (!title) {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			var titleURL = ioService.newURI(url, null, null);

			if (titleURL.scheme == 'http' || titleURL.scheme == 'https') {
				titleURL = titleURL.QueryInterface(Components.interfaces.nsIURL);
				if (titleURL.path == '/') {
					title = titleURL.host;
				}
				else if (titleURL.fileName) {
					title = titleURL.fileName;
				}
				else {
					var dir = titleURL.directory.split('/');
					title = dir[dir.length - 2];
				}
			}
			
			if (!title) {
				title = url;
			}
		}
		
		// Override MIME type to application/pdf if extension is .pdf --
		// workaround for sites that respond to the HEAD request with an
		// invalid MIME type (https://www.zotero.org/trac/ticket/460)
		var ext = this._getExtensionFromURL(url);
		if (ext == 'pdf') {
			contentType = 'application/pdf';
		}
		
		return _addToDB({
			url,
			title,
			linkMode: this.LINK_MODE_LINKED_URL,
			contentType,
			parentItemID,
			collections,
			saveOptions,
		});
	});
	
	
	/**
	 * TODO: what if called on file:// document?
	 *
	 * @param {Object} options - 'document', 'parentItemID', 'collections'
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>}
	 */
	this.linkFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from document');
		
		var document = options.document;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		var saveOptions = options.saveOptions;
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var url = document.location.href;
		var title = document.title; // TODO: don't use Mozilla-generated title for images, etc.
		var contentType = document.contentType;
		
		var item = yield _addToDB({
			url,
			title,
			linkMode: this.LINK_MODE_LINKED_URL,
			contentType,
			charset: document.characterSet,
			parentItemID,
			collections,
			saveOptions,
		});
		
		if (Zotero.MIME.isTextType(document.contentType)) {
			yield Zotero.Fulltext.indexDocument(document, item.id);
		}
		
		return item;
	});
	
	
	/**
	 * Save a snapshot from a Document
	 *
	 * @param {Object} options - 'libraryID', 'document', 'browser', 'parentItemID', 'forceTitle', 'collections'
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from ' + (options.document ? 'document' : 'browser'));
		
		var libraryID = options.libraryID;
		var document = options.document;
		var browser = options.browser;
		var parentItemID = options.parentItemID;
		var title = options.title;
		var collections = options.collections;
		var saveOptions = options.saveOptions;
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and parentCollectionIDs cannot both be provided");
		}
		
		if (!document && !browser) {
			throw new Error("Either document or browser must be provided");
		}
		
		var url = document ? document.location.href : browser.currentURI.spec;
		title = title ? title : (document ? document.title : browser.contentTitle);
		var contentType = document ? document.contentType : browser.documentContentType;
		if (document ? Zotero.Attachments.isPDFJSDocument(document) : Zotero.Attachments.isPDFJSBrowser(browser)) {
			contentType = "application/pdf";
		}
		
		var tmpDir = (yield this.createTemporaryStorageDirectory()).path;
		try {
			var fileName = Zotero.File.truncateFileName(this._getFileNameFromURL(url, contentType), 100);
			var tmpFile = OS.Path.join(tmpDir, fileName);
			
			// If we're using the title from the document, make some adjustments
			if (!options.title) {
				// Remove e.g. " - Scaled (-17%)" from end of images saved from links,
				// though I'm not sure why it's getting added to begin with
				if (contentType.indexOf('image/') === 0) {
					title = title.replace(/(.+ \([^,]+, [0-9]+x[0-9]+[^\)]+\)) - .+/, "$1" );
				}
				// If not native type, strip mime type data in parens
				else if (!Zotero.MIME.hasNativeHandler(contentType, this._getExtensionFromURL(url))) {
					title = title.replace(/(.+) \([a-z]+\/[^\)]+\)/, "$1" );
				}
			}
			
			if ((contentType === 'text/html' || contentType === 'application/xhtml+xml')
					// Documents from XHR don't work here
					&& (browser || Zotero.Translate.DOMWrapper.unwrap(document) instanceof Document)) {
				if (browser) {
					// If we have a full hidden browser, use SingleFile
					Zotero.debug('Getting snapshot with HiddenBrowser.snapshot()');
					let snapshotContent = yield browser.snapshot();

					// Write main HTML file to disk
					yield Zotero.File.putContentsAsync(tmpFile, snapshotContent);
				}
				else {
					// Fallback to nsIWebBrowserPersist
					Zotero.debug('Saving document with saveDocument()');
					yield Zotero.Utilities.Internal.saveDocument(document, tmpFile);
				}
			}
			else {
				Zotero.debug("Saving file with saveURI()");
				const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
				var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(nsIWBP);
				wbp.persistFlags = nsIWBP.PERSIST_FLAGS_FROM_CACHE;
				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);
				var nsIURL = ioService.newURI(url, null, null);
				var deferred = Zotero.Promise.defer();
				wbp.progressListener = new Zotero.WebProgressFinishListener(function () {
					deferred.resolve();
				});
				Zotero.Utilities.Internal.saveURI(wbp, nsIURL, tmpFile);
				yield deferred.promise;
			}
			
			var attachmentItem;
			var destDir;
			yield Zotero.DB.executeTransaction(async function () {
				// Create a new attachment
				attachmentItem = new Zotero.Item('attachment');
				if (libraryID) {
					attachmentItem.libraryID = libraryID;
				}
				else if (parentItemID) {
					let {libraryID: parentLibraryID, key: parentKey} =
						Zotero.Items.getLibraryAndKeyFromID(parentItemID);
					attachmentItem.libraryID = parentLibraryID;
				}
				attachmentItem.setField('title', title);
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
				attachmentItem.attachmentCharset = 'utf-8'; // WPD will output UTF-8
				attachmentItem.attachmentContentType = contentType;
				if (collections && collections.length) {
					attachmentItem.setCollections(collections);
				}
				attachmentItem.attachmentPath = 'storage:' + fileName;
				var itemID = await attachmentItem.save(saveOptions);
				
				destDir = this.getStorageDirectory(attachmentItem).path;
				await OS.File.move(tmpDir, destDir);
			}.bind(this));
			
			yield Zotero.FullText.queueItem(attachmentItem);
		}
		catch (e) {
			Zotero.debug(e, 1);
			
			// Clean up
			try {
				if (tmpDir) {
					yield OS.File.removeDir(tmpDir, { ignoreAbsent: true });
				}
				if (destDir) {
					yield OS.File.removeDir(destDir, { ignoreAbsent: true });
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			
			throw e;
		}
		
		return attachmentItem;
	});
	
	
	/**
	 * Save a snapshot from HTML page content given by SingleFile
	 *
	 * @param {Object} options
	 * @param {String} options.url
	 * @param {Object} options.snapshotContent - HTML content from SingleFile
	 * @param {Integer} [options.parentItemID]
	 * @param {Integer[]} [options.collections]
	 * @param {String} [options.title]
	 * @param {Object} [options.saveOptions] - Options to pass to Zotero.Item::save()
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromSnapshotContent = async (options) => {
		Zotero.debug("Importing attachment item from Snapshot Content");

		let url = options.url;
		let snapshotContent = options.snapshotContent;
		let parentItemID = options.parentItemID;
		let collections = options.collections;
		let title = options.title;
		let saveOptions = options.saveOptions;

		let contentType = "text/html";

		if (parentItemID && collections) {
			throw new Error("parentItemID and parentCollectionIDs cannot both be provided");
		}

		// If no title was provided, pull it from the document
		if (!title) {
			let parser = new DOMParser();
			let doc = parser.parseFromString(snapshotContent, 'text/html');
			title = doc.title;
		}
		
		let tmpDirectory = (await this.createTemporaryStorageDirectory()).path;
		let destDirectory;
		let attachmentItem;
		try {
			let fileName = Zotero.File.truncateFileName(this._getFileNameFromURL(url, contentType), 100);
			let tmpFile = OS.Path.join(tmpDirectory, fileName);
			await Zotero.File.putContentsAsync(tmpFile, snapshotContent);

			// If we're using the title from the document, make some adjustments
			// Remove e.g. " - Scaled (-17%)" from end of images saved from links,
			// though I'm not sure why it's getting added to begin with
			if (contentType.indexOf('image/') === 0) {
				title = title.replace(/(.+ \([^,]+, [0-9]+x[0-9]+[^\)]+\)) - .+/, "$1" );
			}
			// If not native type, strip mime type data in parens
			else if (!Zotero.MIME.hasNativeHandler(contentType, this._getExtensionFromURL(url))) {
				title = title.replace(/(.+) \([a-z]+\/[^\)]+\)/, "$1" );
			}

			attachmentItem = await _addToDB({
				file: 'storage:' + fileName,
				title,
				url,
				linkMode: Zotero.Attachments.LINK_MODE_IMPORTED_URL,
				parentItemID,
				charset: 'utf-8',
				contentType,
				collections,
				saveOptions
			});

			destDirectory = this.getStorageDirectory(attachmentItem).path;
			await OS.File.move(tmpDirectory, destDirectory);
			
			await Zotero.FullText.queueItem(attachmentItem);
		}
		catch (e) {
			Zotero.debug(e, 1);
			
			// Clean up
			try {
				if (tmpDirectory) {
					await OS.File.removeDir(tmpDirectory, { ignoreAbsent: true });
				}
				if (destDirectory) {
					await OS.File.removeDir(destDirectory, { ignoreAbsent: true });
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			
			throw e;
		}
		
		return attachmentItem;
	};


	/**
	 * @param {String} url
	 * @param {String} path
	 * @param {Object} [options]
	 * @param {Object} [options.cookieSandbox]
	 * @param {String} [options.referrer]
	 * @param {Boolean} [options.isPDF] - Delete file if not PDF
	 * @param {Boolean} [options.shouldDisplayCaptcha]
	 */
	this.downloadFile = async function (url, path, options = {}) {
		Zotero.debug(`Downloading file from ${url}`);
		
		let enforcingPDF = false;
		try {
			await new Zotero.Promise(function (resolve) {
				var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(Components.interfaces.nsIWebBrowserPersist);
				if (options.cookieSandbox) {
					options.cookieSandbox.attachToInterfaceRequestor(wbp);
				}
				
				wbp.progressListener = new Zotero.WebProgressFinishListener(() => resolve());
				var headers = {};
				if (options.referrer) {
					headers.Referer = options.referrer;
				}
				Zotero.Utilities.Internal.saveURI(wbp, url, path, headers);
			});
			
			if (options.isPDF) {
				enforcingPDF = true;
				await _enforcePDF(path);
			}
		}
		catch (e) {
			try {
				await OS.File.remove(path, { ignoreAbsent: true });
			}
			catch (e) {
				Zotero.logError(e);
			}
			// Custom handling for PDFs that are bot-guarded
			// via a JS-redirect
			if (enforcingPDF && e instanceof this.InvalidPDFException) {
				if (Zotero.BrowserDownload.shouldAttemptDownloadViaBrowser(url)) {
					return Zotero.BrowserDownload.downloadPDF(url, path, options);
				}
			}
			throw e;
		}
	};
	
	/**
	 * Make sure a file is a PDF
	 */
	async function _enforcePDF(path) {
		var sample = await Zotero.File.getContentsAsync(path, null, 1000);
		if (Zotero.MIME.sniffForMIMEType(sample) != 'application/pdf') {
			Zotero.debug("Downloaded PDF was not a PDF", 2);
			if (Zotero.Debug.enabled) {
				Zotero.debug(
					Zotero.Utilities.ellipsize(
						await Zotero.File.getContentsAsync(path),
						20000,
						false,
						true
					),
					3
				);
			}
			throw new Zotero.Attachments.InvalidPDFException();
		}
	}
	
	
	this.InvalidPDFException = function() {
		this.message = "Downloaded PDF was not a PDF";
		this.stack = new Error().stack;
	};
	this.InvalidPDFException.prototype = Object.create(Error.prototype);
	
	
	this.canFindPDFForItem = function (item) {
		return item.isRegularItem()
			&& !item.isFeedItem
			&& (!!item.getField('DOI') || !!item.getField('url') || !!item.getExtraField('DOI'))
			&& item.numPDFAttachments() == 0;
	};
	
	
	/**
	 * Get the PDF resolvers that can be used for a given item based on the available fields
	 *
	 * @param {Zotero.Item} item
	 * @param {String[]} [methods=['doi', 'url', 'oa', 'custom']]
	 * @param {Boolean} [automatic=false] - Only include custom resolvers with `automatic: true`
	 * @return {Object[]} - An array of urlResolvers (see downloadFirstAvailableFile())
	 */
	this.getPDFResolvers = function (item, methods, automatic) {
		if (!methods) {
			methods = ['doi', 'url', 'oa', 'custom'];
		}
		
		var useDOI = methods.includes('doi');
		var useURL = methods.includes('url');
		var useOA = methods.includes('oa');
		var useCustom = methods.includes('custom');
		
		var resolvers = [];
		var doi = item.getField('DOI') || item.getExtraField('DOI');
		doi = Zotero.Utilities.cleanDOI(doi);
		
		if (useDOI && doi) {
			doi = Zotero.Utilities.cleanDOI(doi);
			if (doi) {
				resolvers.push({
					pageURL: 'https://doi.org/' + doi,
					accessMethod: 'doi'
				});
			}
		}
		
		if (useURL) {
			let url = item.getField('url');
			if (url) {
				url = Zotero.Utilities.cleanURL(url);
				if (url) {
					resolvers.push({
						pageURL: url,
						accessMethod: 'url'
					});
				}
			}
		}
		
		if (useOA && doi) {
			resolvers.push(async function () {
				let urls = await Zotero.Utilities.Internal.getOpenAccessPDFURLs(doi);
				return urls.map((o) => {
					return {
						url: o.url,
						pageURL: o.pageURL,
						articleVersion: o.version,
						accessMethod: 'oa'
					};
				});
			});
		}
		
		if (useCustom && doi) {
			let customResolvers;
			try {
				customResolvers = Zotero.Prefs.get('findPDFs.resolvers');
				if (customResolvers) {
					customResolvers = JSON.parse(customResolvers);
				}
			}
			catch (e) {
				Zotero.debug("Error parsing custom PDF resolvers", 2);
				Zotero.debug(e, 2);
			}
			if (customResolvers) {
				// Handle single object instead of array
				if (!Array.isArray(customResolvers) && customResolvers.method) {
					customResolvers = [customResolvers];
				}
				if (Array.isArray(customResolvers)) {
					// Only include resolvers that have opted into automatic processing
					if (automatic) {
						customResolvers = customResolvers.filter(r => r.automatic);
					}
					
					for (let resolver of customResolvers) {
						try {
							let {
								name,
								method,
								url,
								mode,
								selector,
								
								// HTML
								attribute,
								index,
								
								// JSON
								mappings
							} = resolver;
							if (!name) {
								throw new Error("'name' not provided");
							}
							if (!['GET', 'POST'].includes(method.toUpperCase())) {
								throw new Error("'method' must be 'GET' or 'POST'");
							}
							if (!url) {
								throw new Error("'url' not provided");
							}
							if (!url.includes('{doi}')) {
								throw new Error("'url' must include '{doi}'");
							}
							if (!['html', 'json'].includes(mode.toLowerCase())) {
								throw new Error("'mode' must be 'html' or 'json'");
							}
							if (!selector) {
								throw new Error("'selector' not provided");
							}
							
							url = url.replace(/\{doi}/, doi);
							
							resolvers.push(async function () {
								Zotero.debug(`Looking for PDFs for ${doi} via ${name}`);
								
								var req = await Zotero.HTTP.request(
									method.toUpperCase(),
									url,
									{
										responseType: mode == 'json' ? 'json' : 'document',
										timeout: 5000
									}
								);
								
								if (mode == 'html') {
									let doc = req.response;
									let elem = index
										? doc.querySelectorAll(selector).item(index)
										: doc.querySelector(selector);
									if (!elem) return [];
									let val = attribute
										? elem.getAttribute(attribute)
										: elem.textContent;
									if (!val) return [];
									
									// Handle relative paths
									val = Services.io.newURI(
										val, null, Services.io.newURI(url)
									).spec;
									
									return [{
										accessMethod: name,
										url: val,
										referrer: url,
									}];
								}
								else if (mode == 'json') {
									let jspath = require('resource://zotero/jspath.js');
									let json = req.response;
									let results = jspath.apply(selector, json);
									// If mappings for 'url' and 'pageURL' are supplied,
									// extract properties from each object in the array
									if (mappings) {
										let mappedResults = [];
										for (let result of results) {
											if (typeof result != 'object') continue;
											let mappedResult = {};
											for (let field in mappings) {
												if (!['url', 'pageURL'].includes(field)) continue;
												
												if (result[mappings[field]]) {
													mappedResult[field] = result[mappings[field]];
												}
											}
											mappedResults.push(mappedResult);
										}
										results = mappedResults;
									}
									// Otherwise just treat each array entry as the URL
									else {
										results = results
											.filter(url => typeof url == 'string')
											.map(url => ({ url }));
									}
									return results.map((o) => {
										return Object.assign(
											o,
											{
												accessMethod: name,
												referrer: url
											}
										);
									});
								}
							});
						}
						catch (e) {
							Zotero.debug("Error parsing PDF resolver", 2);
							Zotero.debug(e, 2);
							Zotero.debug(resolver, 2);
						}
					}
				}
			}
		}
		
		return resolvers;
	};
	
	
	/**
	 * Look for available PDFs for items and add as attachments
	 *
	 * @param {Zotero.Item[]} items
	 * @param {Object} [options]
	 * @param {String[]} [options.methods] - See getPDFResolvers()
	 * @param {Number} [options.sameDomainRequestDelay=1000] - Minimum number of milliseconds
	 *     between requests to the same domain (used in tests)
	 * @return {Promise}
	 */
	this.addAvailablePDFs = async function (items, options = {}) {
		const MAX_CONSECUTIVE_DOMAIN_FAILURES = 5;
		const SAME_DOMAIN_REQUEST_DELAY = options.sameDomainRequestDelay || 1000;
		var queue;
		
		var domains = new Map();
		function getDomainInfo(domain) {
			var domainInfo = domains.get(domain);
			if (!domainInfo) {
				domainInfo = {
					nextRequestTime: 0,
					consecutiveFailures: 0
				};
				domains.set(domain, domainInfo);
			}
			return domainInfo;
		}
		
		var progressQueue = Zotero.ProgressQueues.get('findPDF');
		if (!progressQueue) {
			progressQueue = Zotero.ProgressQueues.create({
				id: 'findPDF',
				title: 'pane.items.menu.findAvailablePDF.multiple',
				columns: [
					'general.item',
					'general.pdf'
				]
			});
			progressQueue.addListener('cancel', () => queue = []);
		}

		queue = _findPDFQueue;
		
		for (let item of items) {
			// Skip items that aren't eligible. This is sort of weird, because it means some
			// selected items just don't appear in the list, but there are several different reasons
			// why items might not be eligible (non-regular items, no URL or DOI, already has a PDF)
			// and listing each one seems a little unnecessary.
			if (!this.canFindPDFForItem(item)) {
				continue;
			}
			
			let entry = {
				item,
				urlResolvers: this.getPDFResolvers(item, options.methods),
				domain: null,
				continuation: null,
				processing: false,
				result: null
			};
			
			let pos = queue.findIndex(x => x.item == item);
			if (pos != -1) {
				let current = queue[pos];
				// Skip items that are already processing or that returned a result
				if (current.processing || current.result) {
					continue;
				}
				// Replace current queue entry
				queue[pos] = entry;
			}
			else {
				// Add new items to queue
				queue.push(entry);
			}
			
			progressQueue.addRow(item);
		}
		
		// If no eligible items, just show a popup saying no PDFs were found
		if (!queue.length) {
			let progressWin = new Zotero.ProgressWindow();
			let title = Zotero.getString('pane.items.menu.findAvailablePDF.multiple');
			progressWin.changeHeadline(title);
			let itemProgress = new progressWin.ItemProgress(
				'attachmentPDF',
				Zotero.getString('findPDF.noPDFsFound')
			);
			progressWin.show();
			itemProgress.setProgress(100);
			progressWin.startCloseTimer(4000);
			return;
		}
		
		var dialog = progressQueue.getDialog();
		dialog.showMinimizeButton(false);
		dialog.open();
		
		// If queue was already in progress, just wait for it to finish
		if (_findPDFQueuePromise) {
			return _findPDFQueuePromise;
		}
		
		var queueResolve;
		_findPDFQueuePromise = new Zotero.Promise((resolve) => {
			queueResolve = resolve;
		});
		
		//
		// Process items in the queue
		//
		var i = 0;
		await new Zotero.Promise((resolve) => {
			var processNextItem = function () {
				var current = queue[i++];
				
				// We reached the end of the queue
				if (!current) {
					// If all entries are resolved, we're done
					if (queue.every(x => x.result instanceof Zotero.Item || x.result === false)) {
						resolve();
						return;
					}
					
					// Otherwise, wait until the next time a pending request is ready to process
					// and restart. If no pending requests, they're all in progress.
					let nextStart = queue
						.map(x => x.result === null && getDomainInfo(x.domain).nextRequestTime)
						.filter(x => x)
						.reduce((accumulator, currentValue) => {
							return currentValue < accumulator ? currentValue : accumulator;
						});
					i = 0;
					setTimeout(processNextItem, Math.max(0, nextStart - Date.now()));
					return;
				}
				
				// If item was already processed, skip
				if (current.result !== null) {
					processNextItem();
					return;
				}
				
				// If processing for a domain was paused and not enough time has passed, skip ahead
				if (current.domain && getDomainInfo(current.domain).nextRequestTime > Date.now()) {
					processNextItem();
					return;
				}
				
				// Resume paused item
				if (current.continuation) {
					current.continuation();
					return;
				}
				
				// Currently filtered out above
				/*if (!this.canFindPDFForItem(current.item)) {
					current.result = false;
					progressQueue.updateRow(
						current.item.id,
						Zotero.ProgressQueue.ROW_FAILED,
						""
					);
					processNextItem();
					return;
				}*/
				
				current.processing = true;
				
				// Process item
				this.addPDFFromURLs(
					current.item,
					current.urlResolvers,
					{
						onBeforeRequest: async function (url, noDelay) {
							var domain = urlToDomain(url);
							
							// Don't delay between subsequent requests to the DOI resolver or
							// to localhost in tests
							if (['doi.org', 'localhost'].includes(domain)) {
								return;
							}
							
							var domainInfo = getDomainInfo(domain);
							
							// If too many requests have failed, stop trying
							if (domainInfo.consecutiveFailures > MAX_CONSECUTIVE_DOMAIN_FAILURES) {
								throw new Error(`Too many failed requests for ${urlToDomain(url)}`);
							}
							
							// If enough time hasn't passed since the last attempt for this domain,
							// skip for now and process more items
							let nextRequestTime = domainInfo.nextRequestTime;
							if (!noDelay && nextRequestTime > Date.now()) {
								return new Promise((resolve, reject) => {
									Zotero.debug(`Delaying request to ${domain} for ${nextRequestTime - Date.now()} ms`);
									current.domain = domain;
									current.continuation = () => {
										if (domainInfo.consecutiveFailures < MAX_CONSECUTIVE_DOMAIN_FAILURES) {
											resolve();
										}
										else {
											reject(new Error(`Too many failed requests for ${urlToDomain(url)}`));
										}
									};
									processNextItem();
								});
							}
							
							domainInfo.nextRequestTime = Date.now() + SAME_DOMAIN_REQUEST_DELAY;
						},
						
						// Reset consecutive failures on successful request
						onAfterRequest: function (url) {
							var domain = urlToDomain(url);
							
							// Ignore localhost in tests
							if (domain == 'localhost') {
								return;
							}
							
							var domainInfo = getDomainInfo(domain);
							domainInfo.consecutiveFailures = 0;
						},
						
						// Return true to retry request or false to skip
						onRequestError: function (e) {
							const maxDelay = 3600;
							
							if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
								let domain = urlToDomain(e.url);
								let domainInfo = getDomainInfo(domain);
								domainInfo.consecutiveFailures++;
								
								let status = e.status;
								
								// Retry-After
								if (status == 429 || status == 503) {
									let retryAfter = e.xmlhttp.getResponseHeader('Retry-After');
									if (retryAfter) {
										Zotero.debug("Got Retry-After: " + retryAfter);
										if (parseInt(retryAfter) == retryAfter) {
											if (retryAfter > maxDelay) {
												Zotero.debug("Retry-After is too long -- skipping request");
												return false;
											}
											domainInfo.nextRequestTime = Date.now() + retryAfter * 1000;
											return true;
										}
										else if (Zotero.Date.isHTTPDate(retryAfter)) {
											let d = new Date(val);
											if (d > Date.now() + maxDelay * 1000) {
												Zotero.debug("Retry-After is too long -- skipping request");
												return false;
											}
											domainInfo.nextRequestTime = d.getTime();
											return true;
										}
										Zotero.debug("Invalid Retry-After value -- skipping request");
										return false;
									}
								}
								
								// If not specified, wait 10 seconds before next request to domain
								if (e.status == 429 || e.is5xx()) {
									domainInfo.nextRequestTime = Date.now() + 10000;
									return true;
								}
							}
							
							return false;
						}
					}
				)
				.then((attachment) => {
					current.result = attachment;
					progressQueue.updateRow(
						current.item.id,
						attachment
							? Zotero.ProgressQueue.ROW_SUCCEEDED
							: Zotero.ProgressQueue.ROW_FAILED,
						attachment
							? attachment.getField('title')
							: Zotero.getString('findPDF.noPDFFound')
					);
				})
				.catch((e) => {
					Zotero.logError(e);
					current.result = false;
					progressQueue.updateRow(
						current.item.id,
						Zotero.ProgressQueue.ROW_FAILED,
						Zotero.getString('general.failed')
					);
				})
				// finally() isn't implemented until Firefox 58, but then() is the same here
				//.finally(() => {
				.then(function () {
					current.processing = false;
					processNextItem();
				});
			}.bind(this);
			
			processNextItem();
		});
		
		var numPDFs = queue.reduce((accumulator, currentValue) => {
			return accumulator + (currentValue.result ? 1 : 0);
		}, 0);
		dialog.setStatus(
			numPDFs
				? Zotero.getString('findPDF.pdfsAdded', numPDFs, numPDFs)
				: Zotero.getString('findPDF.noPDFsFound')
		);
		_findPDFQueue = [];
		queueResolve();
		_findPDFQueuePromise = null;
	};
	
	
	function urlToDomain(url) {
		return Services.io.newURI(url, null, null).host;
	}
	
	
	/**
	 * Look for an available PDF for an item and add it as an attachment
	 *
	 * @param {Zotero.Item} item
	 * @param {Object} [options]
	 * @param {String[]} [options.methods] - See getPDFResolvers()
	 * @return {Zotero.Item|false} - New Zotero.Item, or false if unsuccessful
	 */
	this.addAvailablePDF = async function (item, options = {}) {
		Zotero.debug("Looking for available PDFs");
		return this.addPDFFromURLs(item, this.getPDFResolvers(item, options.methods));
	};
	
	
	/**
	 * Try to add a PDF to an item from a set of URL resolvers
	 *
	 * @param {Zotero.Item} item
	 * @param {(String|Object|Function)[]} urlResolvers - See downloadFirstAvailableFile()
	 * @param {Object} [options]
	 * @param {Function} [options.onAccessMethodStart] - Function to run when a new access method
	 *     is started, taking the access method name as an argument
	 * @return {Zotero.Item|false} - New Zotero.Item, or false if unsuccessful
	 */
	this.addPDFFromURLs = async function (item, urlResolvers, options = {}) {
		var fileBaseName = this.getFileBaseNameFromItem(item);
		var tmpDir;
		var tmpFile;
		var attachmentItem = false;
		try {
			tmpDir = (await this.createTemporaryStorageDirectory()).path;
			tmpFile = OS.Path.join(tmpDir, fileBaseName + '.pdf');
			let { title, url, props } = await this.downloadFirstAvailableFile(
				urlResolvers,
				tmpFile,
				{
					isPDF: true,
					shouldDisplayCaptcha: true,
					onAccessMethodStart: options.onAccessMethodStart,
					onBeforeRequest: options.onBeforeRequest,
					onRequestError: options.onRequestError
				}
			);
			if (url) {
				attachmentItem = await this.createURLAttachmentFromTemporaryStorageDirectory({
					directory: tmpDir,
					libraryID: item.libraryID,
					filename: PathUtils.filename(tmpFile),
					title: title || _getPDFTitleFromVersion(props.articleVersion),
					url,
					contentType: 'application/pdf',
					parentItemID: item.id
				});
			}
			else {
				await OS.File.removeDir(tmpDir);
			}
		}
		catch (e) {
			if (tmpDir) {
				await OS.File.removeDir(tmpDir, { ignoreAbsent: true });
			}
			throw e;
		}
		
		return attachmentItem;
	};
	
	
	function _getPDFTitleFromVersion(version) {
		var str;
		
		switch (version) {
		case 'acceptedVersion':
		case 'accepted':
			str = 'acceptedVersion';
			break;
		
		case 'submittedVersion':
		case 'submitted':
			str = 'submittedVersion';
			break;
		
		// 'publishedVersion' or unspecified
		default:
			str = 'fullText';
		}
		
		return Zotero.getString('attachment.' + str);
	}
	
	
	/**
	 * Try to download a file from a set of URL resolvers, keeping the first one that succeeds
	 *
	 * URLs are only tried once.
	 *
	 * @param {(String|Object|Function)[]} urlResolvers - An array of URLs, objects, or functions
	 *    that return arrays of objects. Objects should contain 'url' and/or 'pageURL' (the latter
	 *    being a webpage that might contain a translatable PDF link), 'accessMethod' (which will
	 *    be displayed in the save popup), and an optional 'articleVersion' ('submittedVersion',
	 *    'acceptedVersion', or 'publishedVersion'). Functions that return promises are waited for,
	 *    and functions aren't called unless a file hasn't yet been found from an earlier entry.
	 * @param {String} path - Path to save file to
	 * @param {Object} [options]
	 * @param {Function} [options.onBeforeRequest] - Async function that runs before a request
	 * @param {Function} [options.onAfterRequest] - Function that runs after a request
	 * @param {Function} [options.onRequestError] - Function that runs when a request fails.
	 *     Return true to retry request and false to skip.
	 * @return {Object|false} - Object with successful 'title' (when available from translator), 'url', and 'props'
	 *    from the associated urlResolver, or false if no file could be downloaded
	 */
	this.downloadFirstAvailableFile = async function (urlResolvers, path, options) {
		const maxURLs = 6;
		const schemeRE = /^(http:)?\/\//;
		
		// Operate on copy, since we might change things
		urlResolvers = [...urlResolvers];
		
		// Don't try the same normalized URL more than once
		var triedURLs = new Set();
		function normalizeURL(url) {
			return url.replace(/\?.*/, '');
		}
		function isTriedURL(url) {
			return triedURLs.has(normalizeURL(url));
		}
		function addTriedURL(url) {
			triedURLs.add(normalizeURL(url));
		}
		
		// Check a URL against options.onBeforeRequest(), which can delay or cancel the request
		async function beforeRequest(url, noDelay) {
			if (options.onBeforeRequest) {
				await options.onBeforeRequest(url, noDelay);
			}
		}
		
		function afterRequest(url) {
			if (options.onAfterRequest) {
				options.onAfterRequest(url);
			}
		}
		
		function handleRequestError(e) {
			if (options.onRequestError) {
				return options.onRequestError(e);
			}
		}
		
		for (let i = 0; i < urlResolvers.length; i++) {
			let urlResolver = urlResolvers[i];
			
			// If resolver is a function, run it and then replace it in the resolvers list with
			// the results
			if (typeof urlResolver == 'function') {
				try {
					urlResolver = await urlResolver();
				}
				catch (e) {
					Zotero.logError(e);
					urlResolver = [];
				}
				
				// Don't allow more than 6 URLs from a given resolver
				// Among other things, this ignores Unpaywall rows that have a huge number of
				// URLs by mistake (as of August 2018).
				if (urlResolver.length > maxURLs) {
					Zotero.debug(`Keeping ${maxURLs} URLs`);
					urlResolver = urlResolver.slice(0, maxURLs);
				}
				
				// Splice any URLs from resolver into the array
				urlResolvers.splice(i, 1, ...urlResolver);
				i--;
				continue;
			}
			
			// Accept URL strings in addition to objects
			if (typeof urlResolver == 'string') {
				urlResolver = { url: urlResolver };
			}
			
			let url = urlResolver.url;
			let pageURL = urlResolver.pageURL;
			
			// Force URLs to HTTPS. If a request fails because of that, too bad.
			if (!Zotero.test) {
				if (url) url = url.replace(schemeRE, 'https://');
				if (pageURL) pageURL = pageURL.replace(schemeRE, 'https://');
			}
			
			// Ignore URLs we've already tried
			if (url && isTriedURL(url)) {
				Zotero.debug(`PDF at ${url} was already tried -- skipping`);
				url = null;
			}
			if (pageURL && isTriedURL(pageURL)) {
				Zotero.debug(`Page at ${pageURL} was already tried -- skipping`);
				pageURL = null;
			}
			
			if (!url && !pageURL) {
				continue;
			}
			
			if (urlResolver.referrer) {
				options.referrer = urlResolver.referrer;
			}
			if (options.onAccessMethodStart) {
				options.onAccessMethodStart(urlResolver.accessMethod);
				delete options.onAccessMethod;
			}
			
			// Try URL first if available
			if (url) {
				addTriedURL(url);
				// Backoff loop
				let tries = 3;
				while (tries-- > 0) {
					try {
						await beforeRequest(url);
						await this.downloadFile(url, path, options);
						afterRequest(url);
						return { url, props: urlResolver };
					}
					catch (e) {
						Zotero.debug(`Error downloading ${url}: ${e}\n\n${e.stack}`);
						if (handleRequestError(e)) {
							continue;
						}
					}
					break;
				}
			}
			
			// If URL wasn't available or failed, try to get a URL from a page
			if (pageURL) {
				url = null;
				let title = null;
				let responseURL;
				try {
					Zotero.debug(`Looking for PDF on ${pageURL}`);
					
					let redirects = 0;
					let nextURL = pageURL;
					let req;
					let blob;
					let doc;
					let contentType;
					let skip = false;
					let domains = new Set();
					let redirectLimit = 10;
					let redirectURLTries = new Map();
					while (true) {
						if (redirectLimit == 0) {
							Zotero.debug("Too many redirects -- stopping");
							skip = true;
							break;
						}
						
						let domain = urlToDomain(nextURL);
						let noDelay = domains.has(domain);
						domains.add(domain);
						
						// Backoff loop
						let tries = 3;
						while (tries-- > 0) {
							try {
								await beforeRequest(nextURL, noDelay);
								req = await Zotero.HTTP.request(
									'GET',
									nextURL,
									{
										responseType: 'blob',
										followRedirects: false,
										// Use our own error handling
										errorDelayMax: 0
									}
								);
							}
							catch (e) {
								if (handleRequestError(e)) {
									// Even if this was initially a same-domain redirect, we should
									// now obey delays, since we just set one
									noDelay = false;
									continue;
								}
							}
							break;
						}
						afterRequest(nextURL);
						if (!req) {
							break;
						}
						if ([301, 302, 303, 307].includes(req.status)) {
							let location = req.getResponseHeader('Location');
							if (!location) {
								throw new Error("Location header not provided");
							}
							
							let currentURL = nextURL;
							
							nextURL = Services.io.newURI(nextURL, null, null).resolve(location);
							if (isTriedURL(nextURL)) {
								Zotero.debug("Redirect URL has already been tried -- skipping");
								skip = true;
								break;
							}
							
							// Keep track of tries for each redirect URL, and stop if too many
							let maxTriesPerRedirectURL = 2;
							let tries = (redirectURLTries.get(currentURL) || 0) + 1;
							if (tries > maxTriesPerRedirectURL) {
								Zotero.debug(`Too many redirects to ${currentURL} -- stopping`);
								skip = true;
								break;
							}
							redirectURLTries.set(currentURL, tries);
							// And keep track of total redirects for this chain
							redirectLimit--;
							continue;
						}
						
						blob = req.response;
						responseURL = req.responseURL;
						if (pageURL != responseURL) {
							Zotero.debug("Redirected to " + responseURL);
						}
						
						contentType = req.getResponseHeader('Content-Type');
						if (contentType.startsWith('text/html')) {
							doc = await Zotero.Utilities.Internal.blobToHTMLDocument(blob, responseURL);
							
							// Check for a meta redirect on HTML pages
							let refreshURL = Zotero.HTTP.getHTMLMetaRefreshURL(doc, responseURL);
							if (refreshURL) {
								if (isTriedURL(refreshURL)) {
									Zotero.debug("Meta refresh URL has already been tried -- skipping");
									skip = true;
									break;
								}
								doc = null;
								nextURL = refreshURL;
								continue;
							}
						}
						
						// Don't try this page URL again
						//
						// We only do this for URLs that don't redirect, since some sites seem to
						// use redirects plus cookies for IP-based authentication [1]. The downside
						// is that we might follow the same set of redirects more than once, but we
						// won't process the final page multiple times, and if a publisher URL does
						// redirect that's hopefully a decent indication that a PDF will be found
						// the first time around.
						//
						// [1] https://forums.zotero.org/discussion/81182
						addTriedURL(responseURL);
						
						break;
					}
					if (skip) {
						continue;
					}
					
					// If DOI resolves directly to a PDF, save it to disk
					if (contentType && contentType.startsWith('application/pdf')) {
						Zotero.debug("URL resolves directly to PDF");
						await Zotero.File.putContentsAsync(path, blob);
						await _enforcePDF(path);
						return { url: responseURL, props: urlResolver };
					}
					// Otherwise translate the Document we parsed above
					else if (doc) {
						({ title, url } = await Zotero.Utilities.Internal.getPDFFromDocument(doc));
					}
				}
				catch (e) {
					Zotero.debug(`Error getting PDF from ${pageURL}: ${e}\n\n${e.stack}`);
					continue;
				}
				if (!url) {
					Zotero.debug(`No PDF found on ${responseURL || pageURL}`);
					continue;
				}
				if (isTriedURL(url)) {
					Zotero.debug(`PDF at ${url} was already tried -- skipping`);
					continue;
				}
				// Don't try this PDF URL again
				addTriedURL(url);
				
				// Use the page we loaded as the referrer
				let downloadOptions = Object.assign({}, options, { referrer: responseURL });
				// Backoff loop
				let tries = 3;
				while (tries-- >= 0) {
					try {
						await beforeRequest(url);
						await this.downloadFile(url, path, downloadOptions);
						afterRequest(url);
						return { title, url, props: urlResolver };
					}
					catch (e) {
						Zotero.debug(`Error downloading ${url}: ${e}\n\n${e.stack}`);
						if (handleRequestError(e)) {
							continue;
						}
					}
					break;
				}
			}
		}
		return false;
	};
	
	
	/**
	 * @deprecated Use Zotero.Utilities.cleanURL instead
	 */
	this.cleanAttachmentURI = function (uri, tryHttp) {
		Zotero.debug("Zotero.Attachments.cleanAttachmentURI() is deprecated -- use Zotero.Utilities.cleanURL");
		return Zotero.Utilities.cleanURL(uri, tryHttp);
	}
	
	
	/*
	 * Returns a formatted string to use as the basename of an attachment
	 * based on the metadata of the specified item and a format string
	 *
	 * (Optional) |formatString| specifies the format string -- otherwise
	 * the 'attachmentRenameTemplate' pref is used
	 *
	 * @param {Zotero.Item} item
	 * @param {String} formatString
	 */
	this.getFileBaseNameFromItem = function (item, formatString) {
		if (!(item instanceof Zotero.Item)) {
			throw new Error("'item' must be a Zotero.Item");
		}

		if (!formatString) {
			formatString = Zotero.Prefs.get('attachmentRenameTemplate');
		}

		let chunks = [];
		let protectedLiterals = new Set();

		formatString = formatString.trim();

		const getSlicedCreatorsOfType = (creatorType, slice) => {
			let creatorTypeIDs;
			switch (creatorType) {
				case 'authors':
					creatorTypeIDs = [Zotero.CreatorTypes.getPrimaryIDForType(item.itemTypeID)];
					break;
				case 'editors':
					creatorTypeIDs = [Zotero.CreatorTypes.getID('editor'), Zotero.CreatorTypes.getID('seriesEditor')];
					break;
				default:
				case 'creators':
					creatorTypeIDs = null;
					break;
			}
			
			if (slice === 0) {
				return [];
			}
			const matchingCreators = creatorTypeIDs === null
				? item.getCreators()
				: item.getCreators().filter(c => creatorTypeIDs.includes(c.creatorTypeID));
			const slicedCreators = slice > 0
				? matchingCreators.slice(0, slice)
				: matchingCreators.slice(slice);

			if (slice < 0) {
				slicedCreators.reverse();
			}
			return slicedCreators;
		};


		const common = (value, { truncate = false, prefix = '', suffix = '', case: textCase = '' } = {}) => {
			if (value === '' || value === null || typeof value === 'undefined') {
				return '';
			}

			if (prefix === '\\' || prefix === '/') {
				prefix = '';
			}

			if (suffix === '\\' || suffix === '/') {
				suffix = '';
			}

			if (protectedLiterals.size > 0) {
				// escape protected literals in the format string with \
				value = value.replace(
					new RegExp(`(${Array.from(protectedLiterals.keys()).join('|')})`, 'g'),
					'\\$1//'
				);
			}

			if (truncate) {
				value = value.substr(0, truncate);
			}

			value = value.trim();
			let rawValue = value;

			let affixed = false;

			if (prefix && !value.startsWith(prefix)) {
				value = prefix + value;
				affixed = true;
			}
			if (suffix && !value.endsWith(suffix)) {
				value += suffix;
				affixed = true;
			}

			if (affixed) {
				chunks.push({ value, rawValue, suffix, prefix });
			}

			switch (textCase) {
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'lower':
					value = value.toLowerCase();
					break;
				case 'sentence':
					value = value.slice(0, 1).toUpperCase() + value.slice(1);
					break;
				case 'title':
					value = Zotero.Utilities.capitalizeTitle(value, true);
					break;
				case 'hyphen':
					value = value.toLowerCase().replace(/\s+/g, '-');
					break;
				case 'snake':
					value = value.toLowerCase().replace(/\s+/g, '_');
					break;
				case 'camel':
					value = value.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
					break;
			}
			return value;
		};

		const initializeFn = (name, shouldInitialize, initializeWith) => (shouldInitialize ? name.slice(0, 1).toUpperCase() + initializeWith : name);

		const transformName = (creator, { name, namePartSeparator, initialize, initializeWith } = {}) => {
			if (creator.name) {
				return initializeFn(creator.name, ['full', 'name'].includes(initialize), initializeWith);
			}

			const firstLast = ['full', 'given-family', 'first-last'];
			const lastFirst = ['full-reversed', 'family-given', 'last-first'];
			const first = ['given', 'first'];
			const last = ['family', 'last'];

			if (firstLast.includes(name)) {
				return initializeFn(creator.firstName, ['full', ...first].includes(initialize), initializeWith) + namePartSeparator + initializeFn(creator.lastName, ['full', ...last].includes(initialize), initializeWith);
			}
			else if (lastFirst.includes(name)) {
				return initializeFn(creator.lastName, ['full', ...last].includes(initialize), initializeWith) + namePartSeparator + initializeFn(creator.firstName, ['full', ...first].includes(initialize), initializeWith);
			}
			else if (first.includes(name)) {
				return initializeFn(creator.firstName, ['full', ...first].includes(initialize), initializeWith);
			}

			return initializeFn(creator.lastName, ['full', ...last].includes(initialize), initializeWith);
		};

		const commonCreators = (value, { max = Infinity, name = 'family', namePartSeparator = ' ', join = ', ', initialize = '', initializeWith = '.' } = {}) => {
			return getSlicedCreatorsOfType(value, max)
				.map(c => transformName(c, { name, namePartSeparator, initialize, initializeWith }))
				.join(join);
		};

		const fields = Zotero.ItemFields.getAll()
			.map(f => f.name)
			.reduce((obj, name) => {
				obj[name] = (args) => {
					return common(item.getField(name, false, true), args);
				};
				return obj;
			}, {});

		const year = (args) => {
			let value = item.getField('date', true, true);
			if (value) {
				value = Zotero.Date.multipartToSQL(value).substr(0, 4);
				if (value == '0000') {
					value = '';
				}
			}
			return common(value, args);
		};

		const itemType = ({ localize = false, ...rest }) => common(
			localize ? Zotero.ItemTypes.getLocalizedString(item.itemType) : item.itemType, rest
		);

		const creatorFields = ['authors', 'editors', 'creators'].reduce((obj, name) => {
			obj[name] = (args) => {
				return common(commonCreators(name, args), args);
			};
			return obj;
		}, {});

		const firstCreator = args => common(
			// Pass unformatted = true to omit bidi isolates
			item.getField('firstCreator', true, true), args
		);

		const vars = { ...fields, ...creatorFields, firstCreator, itemType, year };


		// Final name is generated twice. In the first pass we collect all affixed values and determine protected literals.
		// This is done in order to remove repeated suffixes, except if these appear in the value or the format string itself.
		// See "should suppress suffixes where they would create a repeat character" test for edge cases.
		let formatted = Zotero.Utilities.Internal.generateHTMLFromTemplate(formatString, vars);
		
		let replacePairs = new Map();
		for (let chunk of chunks) {
			if (chunk.suffix && formatted.includes(`${chunk.rawValue}${chunk.suffix}${chunk.suffix}`)) {
				protectedLiterals.add(`${chunk.rawValue}${chunk.suffix}${chunk.suffix}`);
				replacePairs.set(`${chunk.rawValue}${chunk.suffix}${chunk.suffix}`, `${chunk.rawValue}${chunk.suffix}`);
			}
			if (chunk.prefix && formatted.includes(`${chunk.prefix}${chunk.prefix}${chunk.rawValue}`)) {
				protectedLiterals.add(`${chunk.prefix}${chunk.prefix}${chunk.rawValue}`);
				replacePairs.set(`${chunk.prefix}${chunk.prefix}${chunk.rawValue}`, `${chunk.prefix}${chunk.rawValue}`);
			}
		}

		// Use "/" and "\" as escape characters for protected literals. We need two different escape chars for edge cases.
		// Both escape chars are invalid in file names and thus removed from the final string by `getValidFileName`
		if (protectedLiterals.size > 0) {
			formatString = formatString.replace(
				new RegExp(`(${Array.from(protectedLiterals.keys()).join('|')})`, 'g'),
				'\\$1//'
			);
		}

		formatted = Zotero.Utilities.Internal.generateHTMLFromTemplate(formatString, vars);
		if (replacePairs.size > 0) {
			formatted = formatted.replace(
				new RegExp(`(${Array.from(replacePairs.keys()).map(replace => `(?<!\\\\)${replace}(?!//)`).join('|')})`, 'g'),
				match => replacePairs.get(match)
			);
		}
		
		formatted = Zotero.Utilities.cleanTags(formatted);
		formatted = Zotero.File.getValidFileName(formatted);
		return formatted;
	};
	
	
	this.shouldAutoRenameFile = function (isLink) {
		if (!Zotero.Prefs.get('autoRenameFiles')) {
			return false;
		}
		if (isLink) {
			return Zotero.Prefs.get('autoRenameFiles.linked');
		}
		return true;
	}
	
	
	this.getRenamedFileTypes = function () {
		try {
			var types = Zotero.Prefs.get('autoRenameFiles.fileTypes');
			return types ? types.split(',') : [];
		}
		catch (e) {
			return [];
		}
	};
	
	
	this.getRenamedFileBaseNameIfAllowedType = async function (parentItem, file) {
		var types = this.getRenamedFileTypes();
		var contentType = file.endsWith('.pdf')
			// Don't bother reading file if there's a .pdf extension
			? 'application/pdf'
			: await Zotero.MIME.getMIMETypeFromFile(file);
		if (!types.includes(contentType)) {
			return false;
		}
		return this.getFileBaseNameFromItem(parentItem);
	}
	
	
	/**
	 * Create directory for attachment files within storage directory
	 *
	 * If a directory exists, delete and recreate
	 *
	 * @param {Number} itemID - Item id
	 * @return {Promise<String>} - Path of new directory
	 */
	this.createDirectoryForItem = Zotero.Promise.coroutine(function* (item) {
		if (!(item instanceof Zotero.Item)) {
			throw new Error("'item' must be a Zotero.Item");
		}
		var dir = this.getStorageDirectory(item).path;
		// Testing for directories in OS.File, used by removeDir(), is broken on Travis, so use nsIFile
		if (Zotero.automatedTest) {
			let nsIFile = Zotero.File.pathToFile(dir);
			if (nsIFile.exists()) {
				nsIFile.remove(true);
			}
		}
		else {
			yield OS.File.removeDir(dir, { ignoreAbsent: true });
		}
		yield Zotero.File.createDirectoryIfMissingAsync(dir);
		return dir;
	});
	
	
	this.getStorageDirectory = function (item) {
		if (!(item instanceof Zotero.Item)) {
			throw new Error("'item' must be a Zotero.Item");
		}
		if (!item.key) {
			throw new Error("Item key must be set");
		}
		return this.getStorageDirectoryByLibraryAndKey(item.libraryID, item.key);
	}
	
	
	this.getStorageDirectoryByID = function (itemID) {
		if (!itemID) {
			throw new Error("itemID not provided");
		}
		var {libraryID, key} = Zotero.Items.getLibraryAndKeyFromID(itemID);
		if (!key) {
			throw new Error("Item " + itemID + " not found");
		}
		var dir = Zotero.getStorageDirectory();
		dir.append(key);
		return dir;
	}
	
	
	this.getStorageDirectoryByLibraryAndKey = function (libraryID, key) {
		if (typeof key != 'string' || !key.match(/^[A-Z0-9]{8}$/)) {
			Zotero.debug(key, 1);
			throw new Error('key must be an 8-character string');
		}
		var dir = Zotero.getStorageDirectory();
		dir.append(key);
		return dir;
	}
	
	
	this.createTemporaryStorageDirectory = Zotero.Promise.coroutine(function* () {
		var tmpDir = Zotero.getStorageDirectory();
		tmpDir.append("tmp-" + Zotero.Utilities.randomString(6));
		yield OS.File.makeDir(tmpDir.path, {
			unixMode: 0o755
		});
		return tmpDir;
	});
	
	
	/**
	 * If path is within the attachment base directory, return a relative
	 * path prefixed by BASE_PATH_PLACEHOLDER. Otherwise, return unchanged.
	 */
	this.getBaseDirectoryRelativePath = function (path) {
		if (!path || path.startsWith(this.BASE_PATH_PLACEHOLDER)) {
			return path;
		}
		
		var basePath = Zotero.Prefs.get('baseAttachmentPath');
		if (!basePath) {
			return path;
		}
		
		if (Zotero.File.directoryContains(basePath, path)) {
			// Since stored paths can be synced to other platforms, use forward slashes for consistency.
			// resolveRelativePath() will convert to the appropriate platform-specific slash on use.
			basePath = OS.Path.normalize(basePath).replace(/\\/g, "/");
			path = OS.Path.normalize(path).replace(/\\/g, "/");
			// Normalize D:\ vs. D:\foo
			if (!basePath.endsWith('/')) {
				basePath += '/';
			}
			path = this.BASE_PATH_PLACEHOLDER + path.substr(basePath.length)
		}
		
		return path;
	};
	
	
	/**
	 * Get an absolute path from this base-dir relative path, if we can
	 *
	 * @param {String} path - Absolute path or relative path prefixed by BASE_PATH_PLACEHOLDER
	 * @return {String|false} - Absolute path, or FALSE if no path
	 */
	this.resolveRelativePath = function (path) {
		if (!path.startsWith(Zotero.Attachments.BASE_PATH_PLACEHOLDER)) {
			return false;
		}
		
		var basePath = Zotero.Prefs.get('baseAttachmentPath');
		if (!basePath) {
			Zotero.debug("No base attachment path set -- can't resolve '" + path + "'", 2);
			return false;
		}
		
		basePath = this.fixPathSlashes(OS.Path.normalize(basePath));
		path = this.fixPathSlashes(path);
		
		return PathUtils.joinRelative(
			basePath,
			path.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length)
		);
	}
	
	
	this.fixPathSlashes = function (path) {
		return path.replace(Zotero.isWin ? /\//g : /\\/g, Zotero.isWin ? "\\" : "/");
	}
	
	
	this.hasMultipleFiles = Zotero.Promise.coroutine(function* (item) {
		if (!item.isAttachment()) {
			throw new Error("Item is not an attachment");
		}
		
		var linkMode = item.attachmentLinkMode;
		switch (linkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
			
			case Zotero.Attachments.LINK_MODE_EMBEDDED_IMAGE:
				return false;
			
			default:
				throw new Error("Invalid attachment link mode");
		}
		
		if (item.attachmentContentType != 'text/html') {
			return false;
		}
		
		var path = yield item.getFilePathAsync();
		if (!path) {
			throw new Error("File not found");
		}
		
		var numFiles = 0;
		var parent = PathUtils.parent(path);
		var iterator = new OS.File.DirectoryIterator(parent);
		try {
			yield iterator.forEach((entry) => {
				if (entry.name.startsWith('.')) {
					return;
				}
				numFiles++;
				if (numFiles > 1) {
					iterator.close();
				}
			});
		}
		finally {
			iterator.close();
		}
		return numFiles > 1;
	});
	
	
	/**
	 * Returns the number of files in the attachment directory
	 *
	 * Only counts if MIME type is text/html
	 *
	 * @param	{Zotero.Item}	item	Attachment item
	 */
	this.getNumFiles = Zotero.Promise.coroutine(function* (item) {
		if (!item.isAttachment()) {
			throw new Error("Item is not an attachment");
		}
		
		var linkMode = item.attachmentLinkMode;
		switch (linkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
			
			default:
				throw new Error("Invalid attachment link mode");
		}
		
		if (item.attachmentContentType != 'text/html') {
			return 1;
		}
		
		var path = yield item.getFilePathAsync();
		if (!path) {
			throw new Error("File not found");
		}
		
		var numFiles = 0;
		var parent = PathUtils.parent(path);
		var iterator = new OS.File.DirectoryIterator(parent);
		try {
			yield iterator.forEach(function (entry) {
				if (entry.name.startsWith('.')) {
					return;
				}
				numFiles++;
			})
		}
		finally {
			iterator.close();
		}
		return numFiles;
	});
	
	
	/**
	 * @param {Zotero.Item} item
	 * @param {Boolean} [skipHidden=true] - Don't count hidden files
	 * @return {Promise<Integer>} - Promise for the total file size in bytes
	 */
	this.getTotalFileSize = Zotero.Promise.coroutine(function* (item, skipHidden = true) {
		if (!item.isAttachment()) {
			throw new Error("Item is not an attachment");
		}
		
		var linkMode = item.attachmentLinkMode;
		switch (linkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
			case Zotero.Attachments.LINK_MODE_LINKED_FILE:
				break;
			
			default:
				throw new Error("Invalid attachment link mode");
		}
		
		var path = yield item.getFilePathAsync();
		if (!path) {
			throw new Error("File not found");
		}
		
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			return (yield OS.File.stat(path)).size;
		}
		
		var size = 0;
		var parent = PathUtils.parent(path);
		let iterator = new OS.File.DirectoryIterator(parent);
		try {
			yield iterator.forEach(function (entry) {
				if (skipHidden && entry.name.startsWith('.')) {
					return;
				}
				return OS.File.stat(entry.path)
				.then(
					function (info) {
						size += info.size;
					},
					function (e) {
						// Can happen if there's a symlink to a missing file
						if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
							return;
						}
						else {
							throw e;
						}
					}
				);
			})
		}
		finally {
			iterator.close();
		}
		return size;
	});
	
	
	/**
	 * Move attachment item, including file, to another library
	 */
	this.moveAttachmentToLibrary = async function (attachment, libraryID, parentItemID) {
		if (attachment.libraryID == libraryID) {
			throw new Error("Attachment is already in library " + libraryID);
		}
		
		Zotero.DB.requireTransaction();
		
		var newAttachment = attachment.clone(libraryID);
		if (attachment.isStoredFileAttachment()) {
			// Attachment path isn't copied over by clone() if libraryID is different
			newAttachment.attachmentPath = attachment.attachmentPath;
		}
		if (parentItemID) {
			newAttachment.parentID = parentItemID;
		}
		await newAttachment.save();
		
		// Move files over if they exist
		var oldDir;
		var newDir;
		if (newAttachment.isStoredFileAttachment()) {
			oldDir = this.getStorageDirectory(attachment).path;
			if (await OS.File.exists(oldDir)) {
				newDir = this.getStorageDirectory(newAttachment).path;
				// Target directory shouldn't exist, but remove it if it does
				//
				// Testing for directories in OS.File, used by removeDir(), is broken on Travis,
				// so use nsIFile
				if (Zotero.automatedTest) {
					let nsIFile = Zotero.File.pathToFile(newDir);
					if (nsIFile.exists()) {
						nsIFile.remove(true);
					}
				}
				else {
					await OS.File.removeDir(newDir, { ignoreAbsent: true });
				}
				await OS.File.move(oldDir, newDir);
			}
		}
		
		try {
			await attachment.erase();
		}
		catch (e) {
			// Move files back if old item can't be deleted
			if (newAttachment.isStoredFileAttachment()) {
				try {
					await OS.File.move(newDir, oldDir);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			throw e;
		}
		
		return newAttachment.id;
	};
	
	
	/**
	 * Copy attachment item, including file, to another library
	 *
	 * @return {Zotero.Item} - The new attachment
	 */
	this.copyAttachmentToLibrary = Zotero.Promise.coroutine(function* (attachment, libraryID, parentItemID) {
		if (attachment.libraryID == libraryID) {
			throw new Error("Attachment is already in library " + libraryID);
		}
		
		Zotero.DB.requireTransaction();
		
		var newAttachment = attachment.clone(libraryID);
		if (attachment.isStoredFileAttachment()) {
			// Attachment path isn't copied over by clone() if libraryID is different
			newAttachment.attachmentPath = attachment.attachmentPath;
		}
		if (parentItemID) {
			newAttachment.parentID = parentItemID;
		}
		yield newAttachment.save();
		
		// Copy over files if they exist
		if (newAttachment.isStoredFileAttachment() && (yield attachment.fileExists())) {
			let dir = Zotero.Attachments.getStorageDirectory(attachment);
			let newDir = yield Zotero.Attachments.createDirectoryForItem(newAttachment);
			yield Zotero.File.copyDirectory(dir, newDir);
		}
		
		yield newAttachment.addLinkedItem(attachment);
		return newAttachment;
	});
	
	
	this.convertLinkedFileToStoredFile = async function (item, options = {}) {
		if (!item.isLinkedFileAttachment()) {
			throw new Error("Not a linked-file attachment");
		}
		
		var file = await item.getFilePathAsync();
		if (!file) {
			Zotero.debug("Linked file not found at " + file);
			return false;
		}
		
		var json = item.toJSON();
		json.linkMode = 'imported_file';
		delete json.path;
		json.filename = PathUtils.filename(file);
		var newItem = new Zotero.Item('attachment');
		newItem.libraryID = item.libraryID;
		newItem.fromJSON(json);
		await newItem.saveTx();
		
		// Move child annotations and embedded-image attachments
		await Zotero.DB.executeTransaction(async function () {
			await Zotero.Items.moveChildItems(item, newItem);
		});
		// Copy relations pointing to the old item
		await Zotero.Relations.copyObjectSubjectRelations(item, newItem);
		
		var newFile;
		try {
			// Transfer file
			let destDir = await this.createDirectoryForItem(newItem);
			newFile = OS.Path.join(destDir, json.filename);
			if (options.move) {
				newFile = await Zotero.File.moveToUnique(file, newFile);
			}
			// Copy file to unique filename, which automatically shortens long filenames
			else {
				newFile = Zotero.File.copyToUnique(file, newFile);
				// TEMP: copyToUnique returns an nsIFile
				newFile = newFile.path;
				await Zotero.File.setNormalFilePermissions(newFile);
				let mtime = (await OS.File.stat(file)).lastModificationDate;
				await OS.File.setDates(newFile, null, mtime);
			}
		}
		catch (e) {
			Zotero.logError(e);
			// Delete new file
			if (newFile) {
				try {
					await Zotero.File.removeIfExists(newFile);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			// Delete new item
			try {
				await newItem.eraseTx();
			}
			catch (e) {
				Zotero.logError(e);
			}
			return false;
		}
		
		try {
			await Zotero.DB.executeTransaction(async function () {
				await Zotero.Fulltext.transferItemIndex(item, newItem);
			});
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		if (newFile && json.filename != PathUtils.filename(newFile)) {
			Zotero.debug("Filename was changed");
			newItem.attachmentFilename = PathUtils.filename(newFile);
			await newItem.saveTx();
		}
		
		await item.eraseTx();
		
		return newItem;
	};
	
	
	this._getFileNameFromURL = function(url, contentType) {
		url = Zotero.Utilities.Internal.parseURL(url);
		
		var fileBaseName = url.fileBaseName;
		var fileExt = Zotero.MIME.getPrimaryExtension(contentType, url.fileExtension);
		
		if (!fileBaseName) {
			let matches = url.pathname.match(/\/([^\/]+)\/$/);
			// If no filename, use the last part of the path if there is one
			if (matches) {
				fileBaseName = matches[1];
			}
			// Or just use the host
			else {
				fileBaseName = url.hostname;
			}
		}
		
		// Test unencoding fileBaseName
		try {
			decodeURIComponent(fileBaseName);
		}
		catch (e) {
			if (e.name == 'URIError') {
				// If we got a 'malformed URI sequence' while decoding,
				// use MD5 of fileBaseName
				fileBaseName = Zotero.Utilities.Internal.md5(fileBaseName, false);
			}
			else {
				throw e;
			}
		}
		
		var fileName = fileBaseName + (fileExt ? '.' + fileExt : '');
		
		// Pass unencoded name to getValidFileName() so that percent-encoded
		// characters aren't stripped to just numbers
		return Zotero.File.getValidFileName(decodeURIComponent(fileName));
	}
	
	
	this._getExtensionFromURL = function (url, contentType) {
		let fileExtension;
		try {
			let nsIURL = Services.io.newURI(url)
				.QueryInterface(Ci.nsIURL);
			fileExtension = nsIURL.fileExtension;
		}
		catch (e) {
			// The URI is not a URL
			fileExtension = '';
		}
		return Zotero.MIME.getPrimaryExtension(contentType, fileExtension);
	}
	
	
	/**
	 * Create a new item of type 'attachment' and add to the itemAttachments table
	 *
	 * @param {Object} options
	 * @param {nsIFile|String} [file]
	 * @param {String} [url]
	 * @param {String} [title]
	 * @param {Number} linkMode
	 * @param {String} contentType
	 * @param {String} [charset]
	 * @param {Number} [parentItemID]
	 * @param {String[]|Number[]} [collections]
	 * @param {Object} [saveOptions]
	 * @return {Promise<Zotero.Item>} - A promise for the new attachment
	 */
	function _addToDB(options) {
		var file = options.file;
		var url = options.url;
		var title = options.title;
		var linkMode = options.linkMode;
		var contentType = options.contentType;
		var charset = options.charset;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		var saveOptions = options.saveOptions;
		
		return Zotero.DB.executeTransaction(async function () {
			var attachmentItem = new Zotero.Item('attachment');
			if (parentItemID) {
				let {libraryID: parentLibraryID, key: parentKey} =
					Zotero.Items.getLibraryAndKeyFromID(parentItemID);
				if (parentLibraryID != Zotero.Libraries.userLibraryID
						&& linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					throw new Error("Cannot save linked file in non-local library");
				}
				attachmentItem.libraryID = parentLibraryID;
			}
			if (linkMode == self.LINK_MODE_IMPORTED_URL || linkMode == self.LINK_MODE_LINKED_URL) {
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			}
			
			attachmentItem.parentID = parentItemID;
			attachmentItem.attachmentLinkMode = linkMode;
			attachmentItem.attachmentContentType = contentType;
			attachmentItem.attachmentCharset = charset;
			if (file) {
				attachmentItem.attachmentPath = typeof file == 'string' ? file : file.path;
			}
			
			if (collections) {
				attachmentItem.setCollections(collections);
			}

			if (title == undefined) {
				attachmentItem.setAutoAttachmentTitle();
			}
			else {
				attachmentItem.setField('title', title);
			}

			await attachmentItem.save(saveOptions);
			
			return attachmentItem;
		}.bind(this));
	}
	
	
	/**
	 * If necessary/possible, detect the file charset and index the file
	 *
	 * Since we have to load the content into the browser to get the character set, we create the
	 * item above and update asynchronously after the fact
	 *
	 * @return {Promise}
	 */
	var _postProcessFile = async function (item) {
		return Zotero.Fulltext.indexItems([item.id]);
	};
	
	
	/**
	 * Determines if a given document is an instance of PDFJS
	 * @return {Boolean}
	 */
	this.isPDFJSDocument = function(doc) {
		// pdf.js HACK
		// This may no longer be necessary (as of Fx 23)
		if(doc.contentType === "text/html") {
			var win = doc.defaultView;
			if(win) {
				win = win.wrappedJSObject;
				if(win && "PDFJS" in win) {
					return true;
				}
			}
		}
		return false;
	}


	/**
	 * Determines if a given Browser is displaying an instance of PDFJS
	 * @return {Boolean}
	 */
	this.isPDFJSBrowser = function (browser) {
		// https://searchfox.org/mozilla-esr102/rev/f78d456e055a41106be086c501b271385a973961/browser/base/content/browser.js#5518
		return browser.contentPrincipal?.spec == "resource://pdf.js/web/viewer.html";
	};
	
	
	this.linkModeToName = function (linkMode) {
		switch (linkMode) {
		case this.LINK_MODE_IMPORTED_FILE:
			return 'imported_file';
		case this.LINK_MODE_IMPORTED_URL:
			return 'imported_url';
		case this.LINK_MODE_LINKED_FILE:
			return 'linked_file';
		case this.LINK_MODE_LINKED_URL:
			return 'linked_url';
		case this.LINK_MODE_EMBEDDED_IMAGE:
			return 'embedded_image';
		default:
			throw new Error(`Invalid link mode ${linkMode}`);
		}
	}
	
	
	this.linkModeFromName = function (linkModeName) {
		var prop = "LINK_MODE_" + linkModeName.toUpperCase();
		if (this[prop] !== undefined) {
			return this[prop];
		}
		throw new Error(`Invalid link mode name '${linkModeName}'`);
	}
};
