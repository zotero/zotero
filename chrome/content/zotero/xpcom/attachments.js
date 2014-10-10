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
	 * @return {Promise}
	 */
	this.importFromFile = Zotero.Promise.coroutine(function* (file, parentItemID, libraryID) {
		Zotero.debug('Importing attachment from file');
		
		var newName = Zotero.File.getValidFileName(file.leafName);
		
		if (!file.isFile()) {
			throw ("'" + file.leafName + "' must be a file in Zotero.Attachments.importFromFile()");
		}
		
		var itemID, newFile;
		yield Zotero.DB.executeTransaction(function* () {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			if (parentItemID) {
				let [parentLibraryID, parentKey] = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
				attachmentItem.libraryID = parentLibraryID;
			}
			else if (libraryID) {
				attachmentItem.libraryID = libraryID;
			}
			attachmentItem.setField('title', newName);
			attachmentItem.parentID = parentItemID;
			attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
			itemID = yield attachmentItem.save();
			attachmentItem = yield Zotero.Items.getAsync(itemID);
			
			// Create directory for attachment files within storage directory
			var destDir = yield this.createDirectoryForItem(attachmentItem);
			
			// Point to copied file
			newFile = destDir.clone();
			newFile.append(newName);
			
			// Copy file to unique filename, which automatically shortens long filenames
			newFile = Zotero.File.copyToUnique(file, newFile);
			
			var contentType = yield Zotero.MIME.getMIMETypeFromFile(newFile);
			
			attachmentItem.attachmentContentType = contentType;
			attachmentItem.attachmentPath = this.getPath(newFile, this.LINK_MODE_IMPORTED_FILE);
			yield attachmentItem.save();
			
			// Determine charset and build fulltext index
			yield _postProcessFile(itemID, newFile, contentType);
		}.bind(this))
		.catch(function (e) {
			Zotero.debug(e, 1);
			var msg = "Failed importing file " + file.path;
			Components.utils.reportError(msg);
			Zotero.debug(msg, 1);
			
			// Clean up
			try {
				if (destDir && destDir.exists()) {
					destDir.remove(true);
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			
			throw e;
		}.bind(this));
		return itemID;
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.linkFromFile = Zotero.Promise.coroutine(function* (file, parentItemID) {
		Zotero.debug('Linking attachment from file');
		
		var title = file.leafName;
		var contentType = yield Zotero.MIME.getMIMETypeFromFile(file);
		
		return Zotero.DB.executeTransaction(function* () {
			var itemID = yield _addToDB({
				file: file,
				title: title,
				linkMode: this.LINK_MODE_LINKED_FILE,
				contentType: contentType,
				parentItemID: parentItemID
			});
			
			// Determine charset and build fulltext index
			yield _postProcessFile(itemID, file, contentType);
			
			return itemID;
		}.bind(this));
	});
	
	
	/**
	 * @param {Object} options - 'file', 'url', 'title', 'contentType', 'charset', 'parentItemID'
	 * @return {Promise}
	 */
	this.importSnapshotFromFile = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing snapshot from file');
		
		var file = options.file;
		var url = options.url;
		var title = options.title;
		var contentType = options.contentType;
		var charset = options.charset;
		var parentItemID = options.parentItemID;
		
		if (!parentItemID) {
			throw new Error("parentItemID not provided");
		}
		
		var destDir;
		yield Zotero.DB.executeTransaction(function* () {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			let [libraryID, parentKey] = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
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
			var itemID = yield attachmentItem.save();
			attachmentItem = yield Zotero.Items.getAsync(itemID)
			
			destDir = this.getStorageDirectory(attachmentItem);
			yield _moveOrphanedDirectory(destDir);
			file.parent.copyTo(storageDir, destDir.leafName);
			
			// Point to copied file
			var newFile = destDir.clone();
			newFile.append(file.leafName);
			
			attachmentItem.attachmentPath = this.getPath(newFile, this.LINK_MODE_IMPORTED_URL);
			yield attachmentItem.save();
			
			// Determine charset and build fulltext index
			yield _postProcessFile(itemID, newFile, contentType);
		}.bind(this))
		.catch(function (e) {
			Zotero.debug(e, 1);
			
			// Clean up
			try {
				if (destDir && destDir.exists()) {
					destDir.remove(true);
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			
			throw e;
		}.bind(this));
		
		return itemID;
	});
	
	
	/**
	 * @param {Object} options - 'url', 'parentItemID', 'parentCollectionIDs', 'title',
	 *                           'fileBaseName', 'contentType', 'cookieSandbox'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromURL = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from URL');
		
		var libraryID = options.libraryID;
		var url = options.url;
		var parentItemID = options.parentItemID;
		var parentCollectionIDs = options.parentCollectionIDs;
		var title = options.title;
		var fileBaseName = options.forceFileBaseName;
		var contentType = options.contentType;
		var cookieSandbox = options.cookieSandbox;
		
		if (parentItemID && parentCollectionIDs) {
			let msg = "parentCollectionIDs is ignored when parentItemID is set in Zotero.Attachments.importFromURL()";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			parentCollectionIDs = undefined;
		}
		
		// Throw error on invalid URLs
		//
		// TODO: allow other schemes
		var urlRe = /^https?:\/\/[^\s]*$/;
		var matches = urlRe.exec(url);
		if (!matches) {
			Components.utils.reportError("Invalid URL '" + url + "' in Zotero.Attachments.importFromURL()");
			return false;
		}
		
		// Save using a hidden browser
		var nativeHandlerImport = function () {
			var deferred = Zotero.Promise.defer();
			var browser = Zotero.HTTP.processDocuments(
				url,
				function() {
					return Zotero.Attachments.importFromDocument({
						libraryID: libraryID,
						document: browser.contentDocument,
						parentItemID: parentItemID,
						title: title,
						parentCollectionIDs: parentCollectionIDs
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
			if (forceFileBaseName) {
				let ext = _getExtensionFromURL(url, contentType);
				var fileName = forceFileBaseName + (ext != '' ? '.' + ext : '');
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
				if (contentType == 'application/pdf' &&
						Zotero.MIME.sniffForMIMEType(str) != 'application/pdf') {
					let errString = "Downloaded PDF did not have MIME type "
						+ "'application/pdf' in Attachments.importFromURL()";
					Zotero.debug(errString, 2);
					Zotero.File.getSample(tmpFile)
					.then(function (sample) {
						Zotero.debug(sample, 3);
						deferred.reject(new Error(errString));
					});
					return;
				}
				deferred.resolve();
			});
				
			var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
				.createInstance(Components.interfaces.nsIURL);
			nsIURL.spec = url;
			wbp.saveURI(nsIURL, null, null, null, null, tmpFile, null);
			yield deferred.promise;
			
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
					let [parentLibraryID, parentKey] = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
					attachmentItem.libraryID = parentLibraryID;
				}
				attachmentItem.setField('title', title ? title : fileName);
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
				attachmentItem.parentID = parentItemID;
				attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
				attachmentItem.attachmentContentType = contentType;
				var itemID = yield attachmentItem.save();
				
				// Create a new folder for this item in the storage directory
				destDir = this.getStorageDirectory(attachmentItem);
				yield OS.File.move(tmpDir.path, destDir.path);
				var destFile = destDir.clone();
				destFile.append(fileName);
				
				// Refetch item to update path
				attachmentItem = yield Zotero.Items.getAsync(itemID);
				attachmentItem.attachmentPath = Zotero.Attachments.getPath(
					destFile, Zotero.Attachments.LINK_MODE_IMPORTED_URL
				);
				yield attachmentItem.save();
				
				// Add to collections
				if (parentCollectionIDs) {
					var ids = Zotero.flattenArguments(parentCollectionIDs);
					for (let i=0; i<ids.length; i++) {
						let col = yield Zotero.Collections.getAsync(ids[i]);
						yield col.addItem(itemID);
					}
				}
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
		});
		
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
		if (!title){
			title = url.substring(url.lastIndexOf('/')+1);
		}
		
		// Override MIME type to application/pdf if extension is .pdf --
		// workaround for sites that respond to the HEAD request with an
		// invalid MIME type (https://www.zotero.org/trac/ticket/460)
		var ext = _getExtensionFromURL(url);
		if (ext == 'pdf') {
			contentType = 'application/pdf';
		}
		
		var itemID = yield _addToDB({
			url: url,
			title: title,
			linkMode: this.LINK_MODE_LINKED_URL,
			contentType: contentType,
			parentItemID: parentItemID
		});
		return Zotero.Items.get(itemID);
	});
	
	
	/**
	 * TODO: what if called on file:// document?
	 *
	 * @param {Object} options - 'document', 'parentItemID', 'parentCollectionIDs'
	 * @return {Promise}
	 */
	this.linkFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Linking attachment from document');
		
		var document = options.document;
		var parentItemID = options.parentItemID;
		var parentCollectionIDs = options.parentCollectionIDs;
		
		if (parentItemID && parentCollectionIDs) {
			let msg = "parentCollectionIDs is ignored when parentItemID is set in Zotero.Attachments.linkFromDocument()";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			parentCollectionIDs = undefined;
		}
		
		var url = document.location.href;
		var title = document.title; // TODO: don't use Mozilla-generated title for images, etc.
		var contentType = document.contentType;
		var charsetID = Zotero.CharacterSets.getID(document.characterSet);
		
		var itemID;
		yield Zotero.DB.executeTransaction(function* () {
			itemID = yield _addToDB({
				url: url,
				title: title,
				linkMode: this.LINK_MODE_LINKED_URL,
				contentType: contentType,
				charset: charsetID,
				parentItemID: parentItemID
			});
			
			// Add to collections
			if (parentCollectionIDs) {
				var ids = Zotero.flattenArguments(parentCollectionIDs);
				for (let i=0; i<ids.length; i++) {
					let col = yield Zotero.Collections.getAsync(id);
					yield col.addItem(itemID);
				}
			}
		}.bind(this));
		
		// Run the indexer asynchronously
		setTimeout(function () {
			if (Zotero.Fulltext.isCachedMIMEType(contentType)) {
				// No file, so no point running the PDF indexer
				//Zotero.Fulltext.indexItems([itemID]);
			}
			else if (Zotero.MIME.isTextType(document.contentType)) {
				Zotero.Fulltext.indexDocument(document, itemID);
			}
		}, 50);
		
		return Zotero.Items.get(itemID);
	});
	
	
	/**
	 * Save a snapshot -- uses synchronous WebPageDump or asynchronous saveURI()
	 *
	 * @param {Object} options - 'libraryID', 'document', 'parentItemID', 'forceTitle', 'parentCollectionIDs'
	 * @return {Promise<Zotero.Item>} - A promise for the created attachment item
	 */
	this.importFromDocument = Zotero.Promise.coroutine(function* (options) {
		Zotero.debug('Importing attachment from document');
		
		var libraryID = options.libraryID;
		var document = options.document;
		var parentItemID = options.parentItemID;
		var title = options.title;
		var parentCollectionIDs = options.parentCollectionIDs;
		
		if (parentItemID && parentCollectionIDs) {
			var msg = "parentCollectionIDs is ignored when parentItemID is set in Zotero.Attachments.importFromDocument()";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			parentCollectionIDs = undefined;
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
		
		var charsetID = Zotero.CharacterSets.getID(document.characterSet);
		
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
			wbp.saveURI(nsIURL, null, null, null, null, file, null);
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
				let [parentLibraryID, parentKey] = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
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
			attachmentItem.attachmentCharset = charsetID;
			attachmentItem.attachmentContentType = contentType;
			var itemID = yield attachmentItem.save();
			
			// Create a new folder for this item in the storage directory
			destDir = this.getStorageDirectory(attachmentItem);
			yield OS.File.move(tmpDir.path, destDir.path);
			var destFile = destDir.clone();
			destFile.append(fileName);
			
			attachmentItem = yield Zotero.Items.getAsync(itemID);
			attachmentItem.attachmentPath = this.getPath(
				destFile, Zotero.Attachments.LINK_MODE_IMPORTED_URL
			);
			yield attachmentItem.save();
			
			// Add to collections
			if (parentCollectionIDs) {
				let ids = Zotero.flattenArguments(parentCollectionIDs);
				for (let i=0; i<ids.length; i++) {
					let col = yield Zotero.Collections.getAsync(ids[i]);
					yield col.addItem(itemID);
				}
			}
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
			if (contentType == 'application/pdf') {
				Zotero.Fulltext.indexPDF(file.path, attachmentItem.id);
			}
			else if (Zotero.MIME.isTextType(contentType)) {
				Zotero.Fulltext.indexDocument(document, attachmentItem.id);
			}
		}, 1000);
		
		return attachmentItem;
	});
	
	
	/*
	 * Create a new attachment with a missing file
	 */
	this.createMissingAttachment = Zotero.Promise.coroutine(function* (options) {
		if (options.linkMode == this.LINK_MODE_LINKED_URL) {
			throw new Error('Cannot create missing linked URLs');
		}
		return _addToDB(options);
	});
	
	
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
		var [libraryID, key] = Zotero.Items.getLibraryAndKeyFromID(itemID);
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
	
	
	/*
	 * Gets a relative descriptor for imported attachments and a persistent
	 * descriptor for files outside the storage directory
	 */
	this.getPath = function (file, linkMode) {
		file.QueryInterface(Components.interfaces.nsILocalFile);
		if (linkMode == self.LINK_MODE_IMPORTED_URL ||
				linkMode == self.LINK_MODE_IMPORTED_FILE) {
			var fileName = file.getRelativeDescriptor(file.parent);
			return 'storage:' + fileName;
		}
		return file.persistentDescriptor;
	}
	
	
	/**
	 * If file is within the attachment base directory, return a relative
	 * path prefixed by BASE_PATH_PLACEHOLDER. Otherwise, return unchanged.
	 */
	this.getBaseDirectoryRelativePath = function (path) {
		if (!path || path.indexOf(this.BASE_PATH_PLACEHOLDER) == 0) {
			return path;
		}
		
		var basePath = Zotero.Prefs.get('baseAttachmentPath');
		if (!basePath) {
			return path;
		}
		
		// Get nsIFile for base directory
		var baseDir = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			baseDir.persistentDescriptor = basePath;
		}
		catch (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			return path;
		}
		
		// Get nsIFile for file
		var attachmentFile = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			attachmentFile.persistentDescriptor = path;
		}
		catch (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			return path;
		}
		
		if (Zotero.File.directoryContains(baseDir, attachmentFile)) {
			path = this.BASE_PATH_PLACEHOLDER
				+ attachmentFile.getRelativeDescriptor(baseDir);
		}
		
		return path;
	}
	
	
	/**
	 * Get a file from this path, if we can
	 *
	 * @param {String} path Absolute path or relative path prefixed
	 * by BASE_PATH_PLACEHOLDER
	 * @param {Boolean} asFile Return nsIFile instead of path
	 * @return {String|nsIFile|FALSE} Persistent descriptor string, file,
	 * of FALSE if no path
	 */
	this.resolveRelativePath = function (path) {
		if (path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) != 0) {
			return false;
		}
		
		var basePath = Zotero.Prefs.get('baseAttachmentPath');
		if (!basePath) {
			Zotero.debug("No base attachment path set -- can't resolve '" + path + "'", 2);
			return false;
		}
		
		// Get file from base directory
		var baseDir = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			baseDir.persistentDescriptor = basePath;
		}
		catch (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			Zotero.debug("Invalid base attachment path -- can't resolve'" + row.path + "'", 2);
			return false;
		}
		
		// Get file from relative path
		var relativePath = path.substr(
			Zotero.Attachments.BASE_PATH_PLACEHOLDER.length
		);
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			file.setRelativeDescriptor(baseDir, relativePath);
		}
		catch (e) {
			Zotero.debug("Invalid relative descriptor '" + relativePath + "'", 2);
			return false;
		}
		
		return file;
	}
	
	
	/**
	 * Returns the number of files in the attachment directory
	 *
	 * Only counts if MIME type is text/html
	 *
	 * @param	{Zotero.Item}	item	Attachment item
	 */
	this.getNumFiles = function (item) {
		var funcName = "Zotero.Attachments.getNumFiles()";
		
		if (!item.isAttachment()) {
			throw ("Item is not an attachment in " + funcName);
		}
		
		var linkMode = item.attachmentLinkMode;
		switch (linkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
				break;
			
			default:
				throw ("Invalid attachment link mode in " + funcName);
		}
		
		if (item.attachmentContentType != 'text/html') {
			return 1;
		}
		
		var file = item.getFile();
		if (!file) {
			throw ("File not found in " + funcName);
		}
		
		var numFiles = 0;
		var parentDir = file.parent;
		var files = parentDir.directoryEntries;
		while (files.hasMoreElements()) {
			file = files.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			if (file.leafName.indexOf('.') == 0) {
				continue;
			}
			numFiles++;
		}
		return numFiles;
	}
	
	
	/**
	 * @param	{Zotero.Item}	item
	 * @param	{Boolean}		[skipHidden=FALSE]	Don't count hidden files
	 * @return	{Integer}							Total file size in bytes
	 */
	this.getTotalFileSize = function (item, skipHidden) {
		var funcName = "Zotero.Attachments.getTotalFileSize()";
		
		if (!item.isAttachment()) {
			throw ("Item is not an attachment in " + funcName);
		}
		
		var linkMode = item.attachmentLinkMode;
		switch (linkMode) {
			case Zotero.Attachments.LINK_MODE_IMPORTED_URL:
			case Zotero.Attachments.LINK_MODE_IMPORTED_FILE:
			case Zotero.Attachments.LINK_MODE_LINKED_FILE:
				break;
			
			default:
				throw ("Invalid attachment link mode in " + funcName);
		}
		
		var file = item.getFile();
		if (!file) {
			throw ("File not found in " + funcName);
		}
		
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			return item.fileSize;
		}
		
		var parentDir = file.parent;
		var files = parentDir.directoryEntries;
		var size = 0;
		while (files.hasMoreElements()) {
			file = files.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			if (skipHidden && file.leafName.indexOf('.') == 0) {
				continue;
			}
			size += file.fileSize;
		}
		return size;
	}
	
	
	/**
	 * Copy attachment item, including files, to another library
	 */
	this.copyAttachmentToLibrary = Zotero.Promise.coroutine(function* (attachment, libraryID, parentItemID) {
		var linkMode = attachment.attachmentLinkMode;
		
		if (attachment.libraryID == libraryID) {
			throw ("Attachment is already in library " + libraryID);
		}
		
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
			var dir = Zotero.Attachments.getStorageDirectory(attachment);
			var newDir = yield Zotero.Attachments.createDirectoryForItem(newAttachment);
			Zotero.File.copyDirectory(dir, newDir);
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
	 * @return {Promise<Number>} Returns a promise for the itemID of the new attachment
	 */
	function _addToDB(options) {
		var file = options.file;
		var url = options.url;
		var title = options.title;
		var linkMode = options.linkMode;
		var contentType = options.contentType;
		var charset = options.charset;
		var parentItemID = options.parentItemID;
		
		return Zotero.DB.executeTransaction(function* () {
			var attachmentItem = new Zotero.Item('attachment');
			if (parentItemID) {
				let [parentLibraryID, parentKey] = Zotero.Items.getLibraryAndKeyFromID(parentItemID);
				if (parentLibraryID && linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					throw new Error("Cannot save linked file in non-local library");
				}
				attachmentItem.libraryID = parentLibraryID;
			}
			attachmentItem.setField('title', title);
			if (linkMode == self.LINK_MODE_IMPORTED_URL || linkMode == self.LINK_MODE_LINKED_URL) {
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			}
			
			// Get path
			if (file) {
				attachmentItem.attachmentPath = Zotero.Attachments.getPath(file, linkMode);
			}
			
			attachmentItem.parentID = parentItemID;
			attachmentItem.attachmentLinkMode = linkMode;
			attachmentItem.attachmentContentType = contentType;
			attachmentItem.attachmentCharset = charset;
			yield attachmentItem.save();
			
			return attachmentItem.id;
		}.bind(this));
	}
	
	
	/**
	 * Since we have to load the content into the browser to get the
	 * character set (at least until we figure out a better way to get
	 * at the native detectors), we create the item above and update
	 * asynchronously after the fact
	 *
	 * @return {Promise}
	 */
	function _postProcessFile(itemID, file, contentType){
		// Don't try to process if MIME type is unknown
		if (!contentType) {
			return;
		}
		
		// MIME types that get cached by the fulltext indexer can just be
		// indexed directly
		if (Zotero.Fulltext.isCachedMIMEType(contentType)) {
			return Zotero.Fulltext.indexItems([itemID]);
		}
		
		var ext = Zotero.File.getExtension(file);
		if (!Zotero.MIME.hasInternalHandler(contentType, ext) || !Zotero.MIME.isTextType(contentType)) {
			return;
		}
		
		var deferred = Zotero.Promise.defer();
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var callback = function(charset, args) {
			// ignore spurious about:blank loads
			if(browser.contentDocument.location.href == "about:blank") return;
			
			// Since the callback can be called during an import process that uses
			// Zotero.wait(), wait until we're unlocked
			Zotero.unlockPromise
			.then(function () {
				return Zotero.spawn(function* () {
					var charsetID = Zotero.CharacterSets.getID(charset);
					if (charsetID) {
						var disabled = Zotero.Notifier.disable();
						
						var item = yield Zotero.Items.getAsync(itemID);
						item.attachmentCharset = charsetID;
						yield item.save();
						
						if (disabled) {
							Zotero.Notifier.enable();
						}
					}
					
					// Chain fulltext indexer inside the charset callback,
					// since it's asynchronous and a prerequisite
					yield Zotero.Fulltext.indexDocument(browser.contentDocument, itemID);
					Zotero.Browser.deleteHiddenBrowser(browser);
					
					deferred.resolve();
				});
			});
		};
		
		Zotero.File.addCharsetListener(browser, callback, itemID);
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(file);
		browser.loadURI(url);
		
		return deferred.promise;
	}
	
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
}
