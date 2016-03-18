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
	this.LINK_MODE_IMPORTED_FILE = 0;
	this.LINK_MODE_IMPORTED_URL = 1;
	this.LINK_MODE_LINKED_FILE = 2;
	this.LINK_MODE_LINKED_URL = 3;
	this.BASE_PATH_PLACEHOLDER = 'attachments:';
	
	var self = this;
	
	
	/**
	 * @param {Object} options
	 * @param {nsIFile|String} [options.file] - File to add
	 * @param {Integer} [options.libraryID]
	 * @param {Integer[]|String[]} [options.parentItemID] - Parent item to add item to
	 * @param {Integer[]} [options.collections] - Collection keys or ids to add new item to
	 * @return {Promise<Zotero.Item>}
	 */
	this.importFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from file');
		
		var libraryID = options.libraryID;
		var file = Zotero.File.pathToFile(options.file);
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		
		var newName = Zotero.File.getValidFileName(file.leafName);
		
		if (file.leafName.endsWith(".lnk")) {
			throw new Error("Cannot add Windows shortcut");
		}
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var attachmentItem, itemID, newFile, contentType;
		return Zotero.DB.executeTransaction(function* () {
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
			attachmentItem.setField('title', newName);
			attachmentItem.parentID = parentItemID;
			attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
			if (collections) {
				attachmentItem.setCollections(collections);
			}
			yield attachmentItem.save();
			
			// Create directory for attachment files within storage directory
			destDir = yield this.createDirectoryForItem(attachmentItem);
			
			// Point to copied file
			newFile = destDir.clone();
			newFile.append(newName);
			
			// Copy file to unique filename, which automatically shortens long filenames
			newFile = Zotero.File.copyToUnique(file, newFile);
			
			contentType = yield Zotero.MIME.getMIMETypeFromFile(newFile);
			
			attachmentItem.attachmentContentType = contentType;
			attachmentItem.attachmentPath = newFile.path;
			yield attachmentItem.save();
		}.bind(this))
		.then(function () {
			return _postProcessFile(attachmentItem, newFile, contentType);
		})
		.catch(function (e) {
			Zotero.logError(e);
			var msg = "Failed importing file " + file.path;
			Zotero.logError(msg);
			
			// Clean up
			try {
				if (destDir && destDir.exists()) {
					destDir.remove(true);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}.bind(this))
		.then(function () {
			return attachmentItem;
		});
	});
	
	
	/**
	 * @param {nsIFile} [options.file] - File to link to
	 * @param {Integer[]|String[]} [options.parentItemID] - Parent item to add item to
	 * @param {Integer[]} [options.collections] - Collection keys or ids to add new item to
	 * @return {Promise<Zotero.Item>}
	 */
	this.linkFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from file');
		
		var file = options.file;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		
		if (parentItemID && collections) {
			throw new Error("parentItemID and collections cannot both be provided");
		}
		
		var title = file.leafName;
		var contentType = yield Zotero.MIME.getMIMETypeFromFile(file);
		var item = yield _addToDB({
			file: file,
			title: title,
			linkMode: this.LINK_MODE_LINKED_FILE,
			contentType: contentType,
			parentItemID: parentItemID,
			collections: collections
		});
		yield _postProcessFile(item, file, contentType);
		return item;
	});
	
	
	/**
	 * @param {Object} options - 'file', 'url', 'title', 'contentType', 'charset', 'parentItemID'
	 * @return {Promise<Zotero.Item>}
	 */
	this.importSnapshotFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing snapshot from file');
		
		var file = Zotero.File.pathToFile(options.file);
		var url = options.url;
		var title = options.title;
		var contentType = options.contentType;
		var charset = options.charset;
		var parentItemID = options.parentItemID;
		
		if (!parentItemID) {
			throw new Error("parentItemID not provided");
		}
		
		var attachmentItem, itemID, destDir, newFile;
		return Zotero.DB.executeTransaction(function* () {
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
			
			// DEBUG: this should probably insert access date too so as to
			// create a proper item, but at the moment this is only called by
			// translate.js, which sets the metadata fields itself
			itemID = yield attachmentItem.save();
			
			var storageDir = Zotero.getStorageDirectory();
			destDir = this.getStorageDirectory(attachmentItem);
			yield _moveOrphanedDirectory(destDir);
			file.parent.copyTo(storageDir, destDir.leafName);
			
			// Point to copied file
			newFile = destDir.clone();
			newFile.append(file.leafName);
			
			attachmentItem.attachmentPath = newFile.path;
			yield attachmentItem.save();
		}.bind(this))
		.then(function () {
			return _postProcessFile(attachmentItem, newFile, contentType, charset);
		})
		.catch(function (e) {
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
		}.bind(this))
		.then(function () {
			return attachmentItem;
		});
	});
	
	
	/**
	 * @param {Object} options - 'libraryID', 'url', 'parentItemID', 'collections', 'title',
	 *                           'fileBaseName', 'contentType', 'cookieSandbox'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromURL = Zotero.Promise.coroutine(function* (options) {
		var libraryID = options.libraryID;
		var url = options.url;
		var parentItemID = options.parentItemID;
		var collections = options.collections;
		var title = options.title;
		var fileBaseName = options.fileBaseName;
		var contentType = options.contentType;
		var cookieSandbox = options.cookieSandbox;
		
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
			var deferred = Zotero.Promise.defer();
			var browser = Zotero.HTTP.processDocuments(
				url,
				function() {
					let channel = browser.docShell.currentDocumentChannel;
					if (channel && (channel instanceof Components.interfaces.nsIHttpChannel)) {
						if (channel.responseStatus < 200 || channel.responseStatus >= 400) {
							deferred.reject(new Error("Invalid response "+channel.responseStatus+" "+channel.responseStatusText+" for '"+url+"'"));
							return;
						}
					}
					return Zotero.Attachments.importFromDocument({
						libraryID: libraryID,
						document: browser.contentDocument,
						parentItemID: parentItemID,
						title: title,
						collections: collections
					})
					.then(function (attachmentItem) {
						Zotero.Browser.deleteHiddenBrowser(browser);
						deferred.resolve(attachmentItem);
					});
				},
				undefined,
				undefined,
				true,
				cookieSandbox
			);
			return deferred.promise;
		};
		
		// Save using remote web browser persist
		var externalHandlerImport = Zotero.Promise.coroutine(function* (contentType) {
			if (fileBaseName) {
				let ext = _getExtensionFromURL(url, contentType);
				var fileName = fileBaseName + (ext != '' ? '.' + ext : '');
			}
			else {
				var fileName = _getFileNameFromURL(url, contentType);
			}
			
			const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
			var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(nsIWBP);
			wbp.persistFlags = nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
			if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(wbp);
			var encodingFlags = false;
			
			// Create a temporary directory to save to within the storage directory.
			// We don't use the normal temp directory because people might have 'storage'
			// symlinked to another volume, which makes moving complicated.
			var tmpDir = yield this.createTemporaryStorageDirectory();
			var tmpFile = tmpDir.clone();
			tmpFile.append(fileName);
			
			// Save to temp dir
			var deferred = Zotero.Promise.defer();
			wbp.progressListener = new Zotero.WebProgressFinishListener(function() {
				deferred.resolve();
			});
				
			var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
				.createInstance(Components.interfaces.nsIURL);
			nsIURL.spec = url;
			Zotero.Utilities.Internal.saveURI(wbp, nsIURL, tmpFile);

			yield deferred.promise;
			let sample = yield Zotero.File.getSample(tmpFile);
			if (contentType == 'application/pdf' &&
					Zotero.MIME.sniffForMIMEType(sample) != 'application/pdf') {
				let errString = "Downloaded PDF did not have MIME type "
					+ "'application/pdf' in Attachments.importFromURL()";
				Zotero.debug(errString, 2);
				Zotero.debug(sample, 3);
				throw(new Error(errString));
			}
			
			// Create DB item
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
				attachmentItem.setField('title', title ? title : fileName);
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
				attachmentItem.attachmentContentType = contentType;
				if (collections) {
					attachmentItem.setCollections(collections);
				}
				var itemID = yield attachmentItem.save();
				
				// Create a new folder for this item in the storage directory
				destDir = this.getStorageDirectory(attachmentItem);
				yield OS.File.move(tmpDir.path, destDir.path);
				var destFile = destDir.clone();
				destFile.append(fileName);
				
				// Refetch item to update path
				attachmentItem.attachmentPath = destFile.path;
				yield attachmentItem.save();
			}.bind(this))
			.catch(function (e) {
				Zotero.debug(e, 1);
				
				// Clean up
				try {
					if (tmpDir && tmpDir.exists()) {
						tmpDir.remove(true);
					}
					if (destDir && destDir.exists()) {
						destDir.remove(true);
					}
				}
				catch (e) {
					Zotero.debug(e, 1);
				}
				
				throw e;
			});
			
			// We don't have any way of knowing that the file is flushed to disk,
			// so we just wait a second before indexing and hope for the best.
			// We'll index it later if it fails. (This may not be necessary.)
			setTimeout(function () {
				Zotero.Fulltext.indexItems([attachmentItem.id]);
			}, 1000);
			
			return attachmentItem;
		}.bind(this));
		
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
		
		return Zotero.MIME.getMIMETypeFromURL(url, cookieSandbox).spread(process);
	});
	
	
	/**
	 * Create a link attachment from a URL
	 *
	 * @param {Object} options - 'url', 'parentItemID', 'contentType', 'title'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.linkFromURL = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from URL');
	 
		var url = options.url;
		var parentItemID = options.parentItemID;
		var contentType = options.contentType;
		var title = options.title;
		
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
		 Zotero (zotero://) */

		var urlRe = /^((https?|zotero|evernote|onenote|brain|nv|mlo|kindle|x-devonthink-item|ftp):\/\/|logosres:)[^\s]*$/;
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
		var ext = _getExtensionFromURL(url);
		if (ext == 'pdf') {
			contentType = 'application/pdf';
		}
		
		return _addToDB({
			url: url,
			title: title,
			linkMode: this.LINK_MODE_LINKED_URL,
			contentType: contentType,
			parentItemID: parentItemID
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
	 * Save a snapshot -- uses synchronous WebPageDump or asynchronous saveURI()
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
		
		var tmpDir = yield this.createTemporaryStorageDirectory();
		var tmpFile = tmpDir.clone();
		var fileName = Zotero.File.truncateFileName(
			_getFileNameFromURL(url, contentType),
			100 //make sure this matches WPD settings in webpagedump/common.js
		);
		tmpFile.append(fileName);
		
		// If we're using the title from the document, make some adjustments
		if (!options.title) {
			// Remove e.g. " - Scaled (-17%)" from end of images saved from links,
			// though I'm not sure why it's getting added to begin with
			if (contentType.indexOf('image/') === 0) {
				title = title.replace(/(.+ \([^,]+, [0-9]+x[0-9]+[^\)]+\)) - .+/, "$1" );
			}
			// If not native type, strip mime type data in parens
			else if (!Zotero.MIME.hasNativeHandler(contentType, _getExtensionFromURL(url))) {
				title = title.replace(/(.+) \([a-z]+\/[^\)]+\)/, "$1" );
			}
		}
		
		if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
			// Load WebPageDump code
			var wpd = {"Zotero":Zotero};
			Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Components.interfaces.mozIJSSubScriptLoader)
				.loadSubScript("chrome://zotero/content/webpagedump/common.js", wpd);
			Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Components.interfaces.mozIJSSubScriptLoader)
				.loadSubScript("chrome://zotero/content/webpagedump/domsaver.js", wpd);
			
			wpd.wpdDOMSaver.init(tmpFile.path, document);
			wpd.wpdDOMSaver.saveHTMLDocument();
		}
		else {
			Zotero.debug('Saving with saveURI()');
			const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
			var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(nsIWBP);
			wbp.persistFlags = nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION
				| nsIWBP.PERSIST_FLAGS_FROM_CACHE;
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
				Zotero.debug('==-=');
				Zotero.debug(parentItemID);
				Zotero.debug(parentLibraryID);
				Zotero.debug(parentKey);
				attachmentItem.libraryID = parentLibraryID;
			}
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			attachmentItem.parentID = parentItemID;
			attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			attachmentItem.attachmentCharset = 'utf-8'; // WPD will output UTF-8
			attachmentItem.attachmentContentType = contentType;
			if (collections) {
				attachmentItem.setCollections(collections);
			}
			var itemID = yield attachmentItem.save();
			
			// Create a new folder for this item in the storage directory
			destDir = this.getStorageDirectory(attachmentItem);
			yield OS.File.move(tmpDir.path, destDir.path);
			var destFile = destDir.clone();
			destFile.append(fileName);
			
			attachmentItem.attachmentPath = destFile.path;
			yield attachmentItem.save();
		}.bind(this))
		.catch(function (e) {
			Zotero.debug(e, 1);
			
			// Clean up
			try {
				if (tmpDir && tmpDir.exists()) {
					tmpDir.remove(true);
				}
				if (destDir && destDir.exists()) {
					destDir.remove(true);
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			
			throw e;
		});
		
		// We don't have any way of knowing that the file is flushed to disk,
		// so we just wait a second before indexing and hope for the best.
		// We'll index it later if it fails. (This may not be necessary.)
		if (contentType == 'application/pdf') {
			setTimeout(function () {
				Zotero.Fulltext.indexPDF(attachmentItem.getFilePath(), attachmentItem.id);
			}, 1000);
		}
		else if (Zotero.MIME.isTextType(contentType)) {
			// Index document immediately, so that browser object can't
			// be removed before indexing completes
			yield Zotero.Fulltext.indexDocument(document, attachmentItem.id);
		}
		
		return attachmentItem;
	});
	
	
	this.cleanAttachmentURI = function (uri, tryHttp) {
		uri = uri.trim();
		if (!uri) return false;
		
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		try {
			return ios.newURI(uri, null, null).spec // Valid URI if succeeds
		} catch (e) {
			if (e instanceof Components.Exception
				&& e.result == Components.results.NS_ERROR_MALFORMED_URI
			) {
				if (tryHttp && /\w\.\w/.test(uri)) {
					// Assume it's a URL missing "http://" part
					try {
						return ios.newURI('http://' + uri, null, null).spec;
					} catch (e) {}
				}
				
				Zotero.debug('cleanAttachmentURI: Invalid URI: ' + uri, 2);
				return false;
			}
			throw e;
		}
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
	
	
	/**
	 * Create directory for attachment files within storage directory
	 *
	 * If a directory exists with the same name, move it to orphaned-files
	 *
	 * @param {Number} itemID - Item id
	 * @return {Promise<nsIFile>}
	 */
	this.createDirectoryForItem = Zotero.Promise.coroutine(function* (item) {
		if (!(item instanceof Zotero.Item)) {
			throw new Error("'item' must be a Zotero.Item");
		}
		var dir = this.getStorageDirectory(item);
		yield _moveOrphanedDirectory(dir);
		if (!dir.exists()) {
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
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
			throw ('key must be an 8-character string in '
				+ 'Zotero.Attachments.getStorageDirectoryByLibraryAndKey()')
		}
		var dir = Zotero.getStorageDirectory();
		dir.append(key);
		return dir;
	}
	
	
	this.createTemporaryStorageDirectory = Zotero.Promise.coroutine(function* () {
		var tmpDir = Zotero.getStorageDirectory();
		tmpDir.append("tmp-" + Zotero.Utilities.randomString(6));
		Zotero.debug("RANDOM IS " + tmpDir.leafName);
		yield OS.File.makeDir(tmpDir.path, {
			unixMode: 0755
		});
		Zotero.debug("MADE DIRECTORY at " + tmpDir.path);
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
			basePath = OS.Path.normalize(basePath);
			path = OS.Path.normalize(path);
			path = this.BASE_PATH_PLACEHOLDER + path.substr(basePath.length + 1)
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
		
		return OS.Path.join(
			OS.Path.normalize(basePath),
			path.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length)
		);
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
			while (true) {
				let entry = yield iterator.next();
				if (entry.name.startsWith('.')) {
					continue;
				}
				numFiles++;
				if (numFiles > 1) {
					break;
				}
			}
		}
		catch (e) {
			iterator.close();
			if (e != StopIteration) {
				throw e;
			}
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
	 * Copy attachment item, including files, to another library
	 */
	this.copyAttachmentToLibrary = Zotero.Promise.coroutine(function* (attachment, libraryID, parentItemID) {
		var linkMode = attachment.attachmentLinkMode;
		
		if (attachment.libraryID == libraryID) {
			throw ("Attachment is already in library " + libraryID);
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
		if (newAttachment.isImportedAttachment() && attachment.getFile()) {
			let dir = Zotero.Attachments.getStorageDirectory(attachment);
			let newDir = yield Zotero.Attachments.createDirectoryForItem(newAttachment);
			yield Zotero.File.copyDirectory(dir, newDir);
		}
		
		yield newAttachment.addLinkedItem(attachment);
		return newAttachment.id;
	});
	
	
	function _getFileNameFromURL(url, contentType){
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		
		var ext = Zotero.MIME.getPrimaryExtension(contentType, nsIURL.fileExtension);
		
		if (!nsIURL.fileName) {
			var matches = nsIURL.directory.match(/\/([^\/]+)\/$/);
			// If no filename, use the last part of the path if there is one
			if (matches) {
				nsIURL.fileName = matches[1];
			}
			// Or just use the host
			else {
				nsIURL.fileName = nsIURL.host;
				var tld = nsIURL.fileExtension;
			}
		}
		
		// If we found a better extension, use that
		if (ext && (!nsIURL.fileExtension || nsIURL.fileExtension != ext)) {
			nsIURL.fileExtension = ext;
		}
		
		// If we replaced the TLD (which would've been interpreted as the extension), add it back
		if (tld && tld != nsIURL.fileExtension) {
			nsIURL.fileBaseName = nsIURL.fileBaseName + '.' + tld;
		}
		
		// Test unencoding fileBaseName
		try {
			decodeURIComponent(nsIURL.fileBaseName);
		}
		catch (e) {
			if (e.name == 'URIError') {
				// If we got a 'malformed URI sequence' while decoding,
				// use MD5 of fileBaseName
				nsIURL.fileBaseName = Zotero.Utilities.Internal.md5(nsIURL.fileBaseName, false);
			}
			else {
				throw e;
			}
		}
		
		// Pass unencoded name to getValidFileName() so that percent-encoded
		// characters aren't stripped to just numbers
		return Zotero.File.getValidFileName(decodeURIComponent(nsIURL.fileName));
	}
	
	
	function _getExtensionFromURL(url, contentType) {
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		return Zotero.MIME.getPrimaryExtension(contentType, nsIURL.fileExtension);
	}
	
	
	/**
	 * If directory exists and is non-empty, move it to orphaned-files directory
	 *
	 * If empty, just remove it
	 */
	var _moveOrphanedDirectory = Zotero.Promise.coroutine(function* (dir) {
		if (!dir.exists()) {
			return;
		}
		
		dir = dir.clone();
		
		// If directory is empty or has only hidden files, delete it
		var files = dir.directoryEntries;
		files.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		var empty = true;
		while (files.hasMoreElements()) {
			var file = files.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			if (file.leafName[0] == '.') {
				continue;
			}
			empty = false;
			break;
		}
		files.close();
		if (empty) {
			dir.remove(true);
			return;
		}
		
		// Create orphaned-files directory if it doesn't exist
		var orphaned = Zotero.getZoteroDirectory();
		orphaned.append('orphaned-files');
		if (!orphaned.exists()) {
			orphaned.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		
		// Find unique filename for orphaned file
		var orphanTarget = orphaned.clone();
		orphanTarget.append(dir.leafName);
		var newName = null;
		if (orphanTarget.exists()) {
			try {
				orphanTarget.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
				newName = orphanTarget.leafName;
			}
			catch (e) {
				// DEBUG: Work around createUnique() brokenness on Windows
				// as of Fx3.0.3 (https://bugzilla.mozilla.org/show_bug.cgi?id=452217)
				//
				// We just delete the conflicting file
				if (Zotero.isWin && e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
					orphanTarget.remove(true);
				}
				else {
					throw (e);
				}
			}
			if (newName) {
				orphanTarget.remove(false);
			}
		}
		
		// Move target to orphaned files directory
		dir.moveTo(orphaned, newName);
	});
	
	
	/**
	 * Create a new item of type 'attachment' and add to the itemAttachments table
	 *
	 * @param {Object} options - 'file', 'url', 'title', 'linkMode', 'contentType', 'charsetID', 'parentItemID'
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
				attachmentItem.attachmentPath = file.path;
			}
			
			if (collections) {
				attachmentItem.setCollections(collections);
			}
			yield attachmentItem.save();
			
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
		var deferred = Zotero.Promise.defer();
		var browser = Zotero.Browser.createHiddenBrowser();
		
		if (item.attachmentCharset) {
			var onpageshow = function(){
				// ignore spurious about:blank loads
				if(browser.contentDocument.location.href == "about:blank") return;
				
				browser.removeEventListener("pageshow", onpageshow, false);
				
				Zotero.Fulltext.indexDocument(browser.contentDocument, itemID)
				.then(deferred.resolve, deferred.reject)
				.finally(function () {
					Zotero.Browser.deleteHiddenBrowser(browser);
				});
			};
			browser.addEventListener("pageshow", onpageshow, false);
		}
		else {
			let callback = function(charset, args) {
				// ignore spurious about:blank loads
				if(browser.contentDocument.location.href == "about:blank") return;
				
				// Since the callback can be called during an import process that uses
				// Zotero.wait(), wait until we're unlocked
				Zotero.unlockPromise
				.then(function () {
					return Zotero.spawn(function* () {
						if (charset) {
							charset = Zotero.CharacterSets.toCanonical(charset);
							if (charset) {
								item.attachmentCharset = charset;
								yield item.saveTx({
									skipNotifier: true
								});
							}
						}
						
						yield Zotero.Fulltext.indexDocument(browser.contentDocument, item.id);
						Zotero.Browser.deleteHiddenBrowser(browser);
						
						deferred.resolve();
					});
				})
				.catch(function (e) {
					deferred.reject(e);
				});
			};
			Zotero.File.addCharsetListener(browser, callback, item.id);
		}
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(file);
		browser.loadURI(url);
		
		return deferred.promise;
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
