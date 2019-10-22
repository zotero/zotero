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

Zotero.Attachments = new function(){
	// Keep in sync with Zotero.Schema.integrityCheck()
	this.LINK_MODE_IMPORTED_FILE = 0;
	this.LINK_MODE_IMPORTED_URL = 1;
	this.LINK_MODE_LINKED_FILE = 2;
	this.LINK_MODE_LINKED_URL = 3;
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
			var newName = Zotero.File.getValidFileName(OS.Path.basename(leafName));
		}
		
		if (leafName.endsWith(".lnk")) {
			throw new Error("Cannot add Windows shortcut");
		}
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var attachmentItem, itemID, newFile, contentType, destDir;
		try {
			yield Zotero.DB.executeTransaction(function* () {
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
				attachmentItem.setField('title', title != undefined ? title : newName);
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
				if (collections) {
					attachmentItem.setCollections(collections);
				}
				yield attachmentItem.save(saveOptions);
				
				// Create directory for attachment files within storage directory
				destDir = yield this.createDirectoryForItem(attachmentItem);
				
				// Point to copied file
				newFile = OS.Path.join(destDir, newName);
				
				// Copy file to unique filename, which automatically shortens long filenames
				newFile = Zotero.File.copyToUnique(file, newFile);
				
				yield Zotero.File.setNormalFilePermissions(newFile.path);
				
				if (!contentType) {
					contentType = yield Zotero.MIME.getMIMETypeFromFile(newFile);
				}
				attachmentItem.attachmentContentType = contentType;
				if (charset) {
					attachmentItem.attachmentCharset = charset;
				}
				attachmentItem.attachmentPath = newFile.path;
				yield attachmentItem.save(saveOptions);
			}.bind(this));
			try {
				yield _postProcessFile(attachmentItem, newFile, contentType);
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
			title: title != undefined ? title : file.leafName,
			linkMode: this.LINK_MODE_LINKED_FILE,
			contentType,
			charset,
			parentItemID,
			collections,
			saveOptions
		});
		try {
			yield _postProcessFile(item, file, contentType);
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
				await _postProcessFile(item, file, contentType);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		return item;
	};
	
	
	/**
	 * @param {Object} options - 'file', 'url', 'title', 'contentType', 'charset', 'parentItemID', 'singleFile'
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
		var parentItemID = options.parentItemID;
		
		if (!parentItemID) {
			throw new Error("parentItemID not provided");
		}
		
		var attachmentItem, itemID, destDir, newPath;
		try {
			yield Zotero.DB.executeTransaction(function* () {
				// Create a new attachment
				attachmentItem = new Zotero.Item('attachment');
				let {libraryID, key: parentKey} = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
				attachmentItem.libraryID = libraryID;
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
				itemID = yield attachmentItem.save();
				
				var storageDir = Zotero.getStorageDirectory();
				destDir = this.getStorageDirectory(attachmentItem);
				yield OS.File.removeDir(destDir.path);
				newPath = OS.Path.join(destDir.path, fileName);
				// Copy single file to new directory
				if (options.singleFile) {
					yield this.createDirectoryForItem(attachmentItem);
					yield OS.File.copy(file.path, newPath);
				}
				// Copy entire parent directory (for HTML snapshots)
				else {
					file.parent.copyTo(storageDir, destDir.leafName);
				}
			}.bind(this));
			try {
				yield _postProcessFile(
					attachmentItem,
					Zotero.File.pathToFile(newPath),
					contentType,
					charset
				);
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
	 * @param {Object} [options.saveOptions]
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
		var nativeHandlerImport = function () {
			return new Zotero.Promise(function (resolve, reject) {
				var browser = Zotero.HTTP.loadDocuments(
					url,
					Zotero.Promise.coroutine(function* () {
						let channel = browser.docShell.currentDocumentChannel;
						if (channel && (channel instanceof Components.interfaces.nsIHttpChannel)) {
							if (channel.responseStatus < 200 || channel.responseStatus >= 400) {
								reject(new Error("Invalid response " + channel.responseStatus + " "
									+ channel.responseStatusText + " for '" + url + "'"));
								return false;
							}
						}
						try {
							let attachmentItem = yield Zotero.Attachments.importFromDocument({
								libraryID,
								document: browser.contentDocument,
								parentItemID,
								title,
								collections,
								saveOptions
							});
							resolve(attachmentItem);
						}
						catch (e) {
							Zotero.logError(e);
							reject(e);
						}
						finally {
							Zotero.Browser.deleteHiddenBrowser(browser);
						}
					}),
					undefined,
					undefined,
					true,
					cookieSandbox
				);
			});
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
						isPDF: contentType == 'application/pdf'
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
	 * @param {Object} [options.saveOptions]
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
					options.saveOptions || {},
					{ notifierQueue }
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
		
		Zotero.Fulltext.queueItem(attachmentItem);
		
		return attachmentItem;
	};
	
	
	/**
	 * Create a link attachment from a URL
	 *
	 * @param {Object} options - 'url', 'parentItemID', 'contentType', 'title', 'collections'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.linkFromURL = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from URL');
	 
		var url = options.url;
		var parentItemID = options.parentItemID;
		var contentType = options.contentType;
		var title = options.title;
		var collections = options.collections;
		
		/* Throw error on invalid URLs
		 We currently accept the following protocols:
		 PersonalBrain (brain://)
		 DevonThink (x-devonthink-item://)
		 Notational Velocity (nv://)
		 MyLife Organized (mlo://)
		 Evernote (evernote://)
		 OneNote (onenote://)
		 Kindle (kindle://) 
		 Logos (logosres:) 
		 Bear (bear://)
		 MarginNote (marginnoteapp://)
		 Zotero (zotero://) */

		var urlRe = /^((https?|zotero|evernote|onenote|brain|nv|mlo|kindle|x-devonthink-item|bear|marginnoteapp|ftp):\/\/|logosres:)[^\s]*$/;
		var matches = urlRe.exec(url);
		if (!matches) {
			throw ("Invalid URL '" + url + "' in Zotero.Attachments.linkFromURL()");
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
			collections
		});
	});
	
	
	/**
	 * TODO: what if called on file:// document?
	 *
	 * @param {Object} options - 'document', 'parentItemID', 'collections'
	 * @return {Promise<Zotero.Item>}
	 */
	this.linkFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from document');
		
		var document = options.document;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		
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
			collections
		});
		
		if (Zotero.Fulltext.isCachedMIMEType(contentType)) {
			// No file, so no point running the PDF indexer
			//Zotero.Fulltext.indexItems([itemID]);
		}
		else if (Zotero.MIME.isTextType(document.contentType)) {
			yield Zotero.Fulltext.indexDocument(document, item.id);
		}
		
		return item;
	});
	
	
	/**
	 * Save a snapshot from a Document
	 *
	 * @param {Object} options - 'libraryID', 'document', 'parentItemID', 'forceTitle', 'collections'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from document');
		
		var libraryID = options.libraryID;
		var document = options.document;
		var parentItemID = options.parentItemID;
		var title = options.title;
		var collections = options.collections;
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and parentCollectionIDs cannot both be provided");
		}
		
		var url = document.location.href;
		title = title ? title : document.title;
		var contentType = document.contentType;
		if (Zotero.Attachments.isPDFJS(document)) {
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
					&& Zotero.Translate.DOMWrapper.unwrap(document) instanceof Ci.nsIDOMDocument) {
				Zotero.debug('Saving document with saveDocument()');
				yield Zotero.Utilities.Internal.saveDocument(document, tmpFile);
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
			yield Zotero.DB.executeTransaction(function* () {
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
				var itemID = yield attachmentItem.save();
				
				Zotero.Fulltext.queueItem(attachmentItem);
				
				// DEBUG: Does this fail if 'storage' is symlinked to another drive?
				destDir = this.getStorageDirectory(attachmentItem).path;
				yield OS.File.move(tmpDir, destDir);
			}.bind(this));
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
	 * @param {String} url
	 * @param {String} path
	 * @param {Object} [options]
	 * @param {Object} [options.cookieSandbox]
	 * @param {String} [options.referrer]
	 * @param {Boolean} [options.isPDF] - Delete file if not PDF
	 */
	this.downloadFile = async function (url, path, options = {}) {
		Zotero.debug(`Downloading file from ${url}`);
		
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
				await _enforcePDF(path);
			}
		}
		catch (e) {
			try {
				await OS.File.remove(path, { ignoreAbsent: true });
			}
			catch (e) {
				Zotero.debug(e, 1);
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
			Zotero.debug(sample, 3);
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
			&& (!!item.getField('DOI') || !!item.getField('url') || !!item.getExtraField('DOI'))
			&& item.numPDFAttachments() == 0;
	};
	
	
	/**
	 * Look for an available PDF for an item and add it as an attachment
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
		}
		var queue = _findPDFQueue;
		
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
			let icon = 'chrome://zotero/skin/treeitem-attachment-pdf.png';
			let progressWin = new Zotero.ProgressWindow();
			let title = Zotero.getString('pane.items.menu.findAvailablePDF.multiple');
			progressWin.changeHeadline(title);
			let itemProgress = new progressWin.ItemProgress(
				icon,
				Zotero.getString('findPDF.noPDFsFound')
			);
			progressWin.show();
			itemProgress.setProgress(100);
			itemProgress.setIcon(icon);
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
		
		// Only one listener can be added, so we just add each time
		progressQueue.addListener('cancel', () => {
			queue = [];
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
			let { url, props } = await this.downloadFirstAvailableFile(
				urlResolvers,
				tmpFile,
				{
					isPDF: true,
					onAccessMethodStart: options.onAccessMethodStart,
					onBeforeRequest: options.onBeforeRequest,
					onRequestError: options.onRequestError
				}
			);
			if (url) {
				attachmentItem = await this.createURLAttachmentFromTemporaryStorageDirectory({
					directory: tmpDir,
					libraryID: item.libraryID,
					filename: OS.Path.basename(tmpFile),
					title: _getPDFTitleFromVersion(props.articleVersion),
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
	 * @return {Object|false} - Object with successful 'url' and 'props' from the associated urlResolver,
	 *     or false if no file could be downloaded
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
			let fromPage = false;
			
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
				while (tries-- >= 0) {
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
				addTriedURL(pageURL);
				url = null;
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
					while (true) {
						let domain = urlToDomain(nextURL);
						let noDelay = domains.has(domain);
						domains.add(domain);
						
						// Backoff loop
						let tries = 3;
						while (tries-- >= 0) {
							try {
								await beforeRequest(nextURL, noDelay);
								req = await Zotero.HTTP.request(
									'GET',
									nextURL,
									{
										responseType: 'blob',
										followRedirects: false
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
								throw e;
							}
							break;
						}
						afterRequest(nextURL);
						if ([301, 302, 303, 307].includes(req.status)) {
							let location = req.getResponseHeader('Location');
							if (!location) {
								throw new Error("Location header not provided");
							}
							nextURL = Services.io.newURI(nextURL, null, null).resolve(location);
							if (isTriedURL(nextURL)) {
								Zotero.debug("Redirect URL has already been tried -- skipping");
								skip = true;
								break;
							}
							addTriedURL(nextURL);
							continue;
						}
						
						blob = req.response;
						responseURL = req.responseURL;
						if (pageURL != responseURL) {
							Zotero.debug("Redirected to " + responseURL);
						}
						
						// If HTML, check for a meta redirect
						contentType = req.getResponseHeader('Content-Type');
						if (contentType.startsWith('text/html')) {
							doc = await Zotero.Utilities.Internal.blobToHTMLDocument(blob, responseURL);
							let refreshURL = Zotero.HTTP.getHTMLMetaRefreshURL(doc, responseURL);
							if (refreshURL) {
								if (isTriedURL(refreshURL)) {
									Zotero.debug("Meta refresh URL has already been tried -- skipping");
									skip = true;
									break;
								}
								doc = null;
								nextURL = refreshURL;
								addTriedURL(nextURL);
								continue;
							}
						}
						break;
					}
					if (skip) {
						continue;
					}
					
					// If DOI resolves directly to a PDF, save it to disk
					if (contentType.startsWith('application/pdf')) {
						Zotero.debug("URL resolves directly to PDF");
						await Zotero.File.putContentsAsync(path, blob);
						await _enforcePDF(path);
						return { url: responseURL, props: urlResolver };
					}
					// Otherwise translate the Document we parsed above
					else if (doc) {
						url = await Zotero.Utilities.Internal.getPDFFromDocument(doc);
					}
				}
				catch (e) {
					Zotero.debug(`Error getting PDF from ${pageURL}: ${e}\n\n${e.stack}`);
					continue;
				}
				if (!url) {
					Zotero.debug(`No PDF found on ${responseURL}`);
					continue;
				}
				if (isTriedURL(url)) {
					Zotero.debug(`PDF at ${url} was already tried -- skipping`);
					continue;
				}
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
	 * the 'attachmentRenameFormatString' pref is used
	 *
	 * Valid substitution markers:
	 *
	 * %c -- firstCreator
	 * %y -- year (extracted from Date field)
	 * %t -- title
	 *
	 * Fields can be truncated to a certain length by appending an integer
	 * within curly brackets -- e.g. %t{50} truncates the title to 50 characters
	 *
	 * @param {Zotero.Item} item
	 * @param {String} formatString
	 */
	this.getFileBaseNameFromItem = function (item, formatString) {
		if (!(item instanceof Zotero.Item)) {
			throw new Error("'item' must be a Zotero.Item");
		}
		
		if (!formatString) {
			formatString = Zotero.Prefs.get('attachmentRenameFormatString');
		}
		
		// Replaces the substitution marker with the field value,
		// truncating based on the {[0-9]+} modifier if applicable
		function rpl(field, str) {
			if (!str) {
				str = formatString;
			}
			
			switch (field) {
				case 'creator':
					field = 'firstCreator';
					var rpl = '%c';
					break;
					
				case 'year':
					var rpl = '%y';
					break;
					
				case 'title':
					var rpl = '%t';
					break;
			}
			
			switch (field) {
				case 'year':
					var value = item.getField('date', true, true);
					if (value) {
						value = Zotero.Date.multipartToSQL(value).substr(0, 4);
						if (value == '0000') {
							value = '';
						}
					}
				break;
				
				default:
					var value = '' + item.getField(field, false, true);
			}
			
			var re = new RegExp("\{?([^%\{\}]*)" + rpl + "(\{[0-9]+\})?" + "([^%\{\}]*)\}?");
			
			// If no value for this field, strip entire conditional block
			// (within curly braces)
			if (!value) {
				if (str.match(re)) {
					return str.replace(re, '')
				}
			}
			
			var f = function(match, p1, p2, p3) {
				var maxChars = p2 ? p2.replace(/[^0-9]+/g, '') : false;
				return p1 + (maxChars ? value.substr(0, maxChars) : value) + p3;
			}
			
			return str.replace(re, f);
		}
		
		formatString = rpl('creator');
		formatString = rpl('year');
		formatString = rpl('title');
		
		formatString = Zotero.File.getValidFileName(formatString);
		return formatString;
	}
	
	
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
		
		return this.fixPathSlashes(OS.Path.join(
			OS.Path.normalize(basePath),
			path.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length)
		));
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
		var parent = OS.Path.dirname(path);
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
		var parent = OS.Path.dirname(path);
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
		var parent = OS.Path.dirname(path);
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
		if (attachment.isImportedAttachment()) {
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
		if (newAttachment.isImportedAttachment()) {
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
			if (newAttachment.isImportedAttachment()) {
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
	 */
	this.copyAttachmentToLibrary = Zotero.Promise.coroutine(function* (attachment, libraryID, parentItemID) {
		if (attachment.libraryID == libraryID) {
			throw new Error("Attachment is already in library " + libraryID);
		}
		
		Zotero.DB.requireTransaction();
		
		var newAttachment = attachment.clone(libraryID);
		if (attachment.isImportedAttachment()) {
			// Attachment path isn't copied over by clone() if libraryID is different
			newAttachment.attachmentPath = attachment.attachmentPath;
		}
		if (parentItemID) {
			newAttachment.parentID = parentItemID;
		}
		yield newAttachment.save();
		
		// Copy over files if they exist
		if (newAttachment.isImportedAttachment() && (yield attachment.fileExists())) {
			let dir = Zotero.Attachments.getStorageDirectory(attachment);
			let newDir = yield Zotero.Attachments.createDirectoryForItem(newAttachment);
			yield Zotero.File.copyDirectory(dir, newDir);
		}
		
		yield newAttachment.addLinkedItem(attachment);
		return newAttachment.id;
	});
	
	
	this.convertLinkedFileToStoredFile = async function (item, options = {}) {
		if (item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_FILE) {
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
		json.filename = OS.Path.basename(file);
		var newItem = new Zotero.Item('attachment');
		newItem.libraryID = item.libraryID;
		newItem.fromJSON(json);
		await newItem.saveTx();
		
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
		
		if (newFile && json.filename != OS.Path.basename(newFile)) {
			Zotero.debug("Filename was changed");
			newItem.attachmentFilename = OS.Path.basename(newFile);
			await newItem.saveTx();
		}
		
		await item.eraseTx();
		
		return newItem;
	};
	
	
	this._getFileNameFromURL = function(url, contentType) {
		url = Zotero.Utilities.parseURL(url);
		
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
	
	
	this._getExtensionFromURL = function(url, contentType) {
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		return Zotero.MIME.getPrimaryExtension(contentType, nsIURL.fileExtension);
	}
	
	
	/**
	 * Create a new item of type 'attachment' and add to the itemAttachments table
	 *
	 * @param {Object} options
	 * @param {nsIFile|String} [file]
	 * @param {String} [url]
	 * @param {String} title
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
		
		return Zotero.DB.executeTransaction(function* () {
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
			attachmentItem.setField('title', title);
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
			yield attachmentItem.save(saveOptions);
			
			return attachmentItem;
		}.bind(this));
	}
	
	
	/**
	 * If necessary/possible, detect the file charset and index the file
	 *
	 * Since we have to load the content into the browser to get the
	 * character set (at least until we figure out a better way to get
	 * at the native detectors), we create the item above and update
	 * asynchronously after the fact
	 *
	 * @return {Promise}
	 */
	var _postProcessFile = Zotero.Promise.coroutine(function* (item, file, contentType) {
		// Don't try to process if MIME type is unknown
		if (!contentType) {
			return;
		}
		
		// Items with content types that get cached by the fulltext indexer can just be indexed,
		// since a charset isn't necessary
		if (Zotero.Fulltext.isCachedMIMEType(contentType)) {
			return Zotero.Fulltext.indexItems([item.id]);
		}
		
		// Ignore non-text types
		var ext = Zotero.File.getExtension(file);
		if (!Zotero.MIME.hasInternalHandler(contentType, ext) || !Zotero.MIME.isTextType(contentType)) {
			return;
		}
		
		// If the charset is already set, index item directly
		if (item.attachmentCharset) {
			return Zotero.Fulltext.indexItems([item.id]);
		}
		
		// Otherwise, load in a hidden browser to get the charset, and then index the document
		return new Zotero.Promise(function (resolve, reject) {
			var browser = Zotero.Browser.createHiddenBrowser(
				null,
				// Disable JavaScript, since it can cause imports that include HTML files to hang
				// (from network requests that fail?)
				{ allowJavaScript: false }
			);
			
			var pageshown = false;
			
			if (item.attachmentCharset) {
				var onpageshow = async function () {
					// ignore spurious about:blank loads
					if(browser.contentDocument.location.href == "about:blank") return;
					
					pageshown = true;
					
					browser.removeEventListener("pageshow", onpageshow, false);
					
					try {
						await Zotero.Fulltext.indexDocument(browser.contentDocument, itemID);
						resolve();
					}
					catch (e) {
						reject(e);
					}
					finally {
						Zotero.Browser.deleteHiddenBrowser(browser);
					}
				};
				browser.addEventListener("pageshow", onpageshow, false);
			}
			else {
				let callback = async function (charset, args) {
					// ignore spurious about:blank loads
					if(browser.contentDocument.location.href == "about:blank") return;
					
					pageshown = true;
					
					try {
						if (charset) {
							charset = Zotero.CharacterSets.toCanonical(charset);
							if (charset) {
								item.attachmentCharset = charset;
								await item.saveTx({
									skipNotifier: true
								});
							}
						}
						
						await Zotero.Fulltext.indexDocument(browser.contentDocument, item.id);
						resolve();
					}
					catch (e) {
						reject(e);
					}
					finally {
						Zotero.Browser.deleteHiddenBrowser(browser);
					}
				};
				Zotero.File.addCharsetListener(browser, callback, item.id);
			}
			
			var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
						.getService(Components.interfaces.nsIFileProtocolHandler)
						.getURLSpecFromFile(file);
			browser.loadURI(url);
			
			// Avoid a hang if a pageshow is never called on the hidden browser (which can happen
			// if a .pdf file is really HTML, which can also result in the file being launched,
			// which we should try to fix)
			setTimeout(function () {
				if (!pageshown) {
					reject(new Error("pageshow not called in hidden browser"));
				}
			}, 5000);
		});
	});
	
	/**
	 * Determines if a given document is an instance of PDFJS
	 * @return {Boolean}
	 */
	this.isPDFJS = function(doc) {
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
}
