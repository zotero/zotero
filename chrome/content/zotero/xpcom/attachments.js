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
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Attachments = new function(){
	this.LINK_MODE_IMPORTED_FILE = 0;
	this.LINK_MODE_IMPORTED_URL = 1;
	this.LINK_MODE_LINKED_FILE = 2;
	this.LINK_MODE_LINKED_URL = 3;
	
	this.importFromFile = importFromFile;
	this.linkFromFile = linkFromFile;
	this.importSnapshotFromFile = importSnapshotFromFile;
	this.importFromURL = importFromURL;
	this.linkFromURL = linkFromURL;
	this.linkFromDocument = linkFromDocument;
	this.importFromDocument = importFromDocument;
	this.createMissingAttachment = createMissingAttachment;
	this.getFileBaseNameFromItem = getFileBaseNameFromItem;
	this.createDirectoryForItem = createDirectoryForItem;
	this.createDirectoryForMissingItem = createDirectoryForMissingItem;
	this.getStorageDirectory = getStorageDirectory;
	this.getPath = getPath;
	
	var self = this;
	
	
	function importFromFile(file, sourceItemID, libraryID) {
		Zotero.debug('Importing attachment from file');
		
		// Try decoding URI entities, since we're going to strip '%'
		var newName = file.leafName;
		try {
			newName = decodeURIComponent(file.leafName);
		}
		catch (e) {}
		newName = Zotero.File.getValidFileName(newName);
		
		if (!file.isFile()) {
			throw ("'" + file.leafName + "' must be a file in Zotero.Attachments.importFromFile()");
		}
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			if (sourceItemID) {
				var parentItem = Zotero.Items.get(sourceItemID);
				attachmentItem.libraryID = parentItem.libraryID;
			}
			else if (libraryID) {
				attachmentItem.libraryID = libraryID;
			}
			attachmentItem.setField('title', newName);
			attachmentItem.setSource(sourceItemID);
			attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
			var itemID = attachmentItem.save();
			attachmentItem = Zotero.Items.get(itemID);
			
			// Create directory for attachment files within storage directory
			var destDir = this.createDirectoryForItem(itemID);
			file.copyTo(destDir, newName);
			
			// Point to copied file
			var newFile = destDir.clone();
			newFile.append(newName);
			
			var mimeType = Zotero.MIME.getMIMETypeFromFile(newFile);
			
			
			attachmentItem.attachmentMIMEType = mimeType;
			attachmentItem.attachmentPath = this.getPath(newFile, this.LINK_MODE_IMPORTED_FILE);
			attachmentItem.save();
			
			Zotero.DB.commitTransaction();
			
			// Determine charset and build fulltext index
			_postProcessFile(itemID, newFile, mimeType);
		}
		catch (e){
			// hmph
			Zotero.DB.rollbackTransaction();
			
			var msg = "Failed importing file " + file.path;
			Components.utils.reportError(msg);
			Zotero.debug(msg, 1);
			
			try {
				// Clean up
				if (itemID) {
					var itemDir = this.getStorageDirectory(itemID);
					if (itemDir.exists()) {
						itemDir.remove(true);
					}
				}
			}
			catch (e) {}
			
			throw (e);
		}
		return itemID;
	}
	
	
	function linkFromFile(file, sourceItemID){
		Zotero.debug('Linking attachment from file');
		
		var title = file.leafName;
		var mimeType = Zotero.MIME.getMIMETypeFromFile(file);
		
		var itemID = _addToDB(file, null, title, this.LINK_MODE_LINKED_FILE, mimeType,
			null, sourceItemID);
		
		// Determine charset and build fulltext index
		_postProcessFile(itemID, file, mimeType);
		
		return itemID;
	}
	
	
	function importSnapshotFromFile(file, url, title, mimeType, charset, sourceItemID){
		Zotero.debug('Importing snapshot from file');
		
		var charsetID = charset ? Zotero.CharacterSets.getID(charset) : null;
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			if (sourceItemID) {
				var parentItem = Zotero.Items.get(sourceItemID);
				attachmentItem.libraryID = parentItem.libraryID;
			}
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			attachmentItem.setSource(sourceItemID);
			attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_URL;
			attachmentItem.attachmentMIMEType = mimeType;
			attachmentItem.attachmentCharset = charset;
			
			// DEBUG: this should probably insert access date too so as to
			// create a proper item, but at the moment this is only called by
			// translate.js, which sets the metadata fields itself
			var itemID = attachmentItem.save();
			attachmentItem = Zotero.Items.get(itemID)
			
			var storageDir = Zotero.getStorageDirectory();
			var destDir = this.getStorageDirectory(itemID);
			_moveOrphanedDirectory(destDir);
			file.parent.copyTo(storageDir, destDir.leafName);
			
			// Point to copied file
			var newFile = destDir.clone();
			newFile.append(file.leafName);
			
			attachmentItem.attachmentPath = this.getPath(newFile, this.LINK_MODE_IMPORTED_URL);
			attachmentItem.save();
			
			Zotero.DB.commitTransaction();
			
			// Determine charset and build fulltext index
			_postProcessFile(itemID, newFile, mimeType);
		}
		catch (e){
			Zotero.DB.rollbackTransaction();
			
			try {
				// Clean up
				if (itemID) {
					var itemDir = this.getStorageDirectory(itemID);
					if (itemDir.exists()) {
						itemDir.remove(true);
					}
				}
			}
			catch (e) {}
			
			throw (e);
		}
		return itemID;
	}
	
	
	function importFromURL(url, sourceItemID, forceTitle, forceFileBaseName, parentCollectionIDs,
			mimeType, libraryID, callback, cookieSandbox) {
		Zotero.debug('Importing attachment from URL');
		
		if (sourceItemID && parentCollectionIDs) {
			var msg = "parentCollectionIDs is ignored when sourceItemID is set in Zotero.Attachments.importFromURL()";
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
			if(callback) callback(false);
			throw ("Invalid URL '" + url + "' in Zotero.Attachments.importFromURL()");
		}
		
		// Save using a hidden browser
		var nativeHandlerImport = function () {
			var browser = Zotero.HTTP.processDocuments(url, function() {
				var importCallback = function (item) {
					Zotero.Browser.deleteHiddenBrowser(browser);
					if(callback) callback(item);
				};
				Zotero.Attachments.importFromDocument(browser.contentDocument,
					sourceItemID, forceTitle, parentCollectionIDs, importCallback, libraryID);
			}, undefined, undefined, true);
		};
		
		// Save using remote web browser persist
		var externalHandlerImport = function (mimeType) {
			if (forceFileBaseName) {
				var ext = _getExtensionFromURL(url, mimeType);
				var fileName = forceFileBaseName + (ext != '' ? '.' + ext : '');
			}
			else {
				var fileName = _getFileNameFromURL(url, mimeType);
			}
			
			var title = forceTitle ? forceTitle : fileName;
			
			const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
			var wbp = Components
				.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(nsIWBP);
			wbp.persistFlags = nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
			if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(wbp);
			var encodingFlags = false;
			
			Zotero.DB.beginTransaction();
			
			try {
				// Create a new attachment
				var attachmentItem = new Zotero.Item('attachment');
				if (libraryID) {
					attachmentItem.libraryID = libraryID;
				}
				else if (sourceItemID) {
					var parentItem = Zotero.Items.get(sourceItemID);
					attachmentItem.libraryID = parentItem.libraryID;
				}
				attachmentItem.setField('title', title);
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
				attachmentItem.setSource(sourceItemID);
				attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
				attachmentItem.attachmentMIMEType = mimeType;
				var itemID = attachmentItem.save();
				attachmentItem = Zotero.Items.get(itemID);
				
				// Add to collections
				if (parentCollectionIDs){
					var ids = Zotero.flattenArguments(parentCollectionIDs);
					for each(var id in ids){
						var col = Zotero.Collections.get(id);
						col.addItem(itemID);
					}
				}
				
				// Create a new folder for this item in the storage directory
				var destDir = Zotero.Attachments.createDirectoryForItem(itemID);
				
				var file = destDir.clone();
				file.append(fileName);
				
				wbp.progressListener = new Zotero.WebProgressFinishListener(function(){
					try {
						var str = Zotero.File.getSample(file);
						
						if (mimeType == 'application/pdf' &&
								Zotero.MIME.sniffForMIMEType(str) != 'application/pdf') {
							var errString = "Downloaded PDF did not have MIME type "
								+ "'application/pdf' in Attachments.importFromURL()";
							Zotero.debug(errString, 2);
							attachmentItem.erase();
							if(callback) callback(false, new Error(errString));
							return;
						}
						
						attachmentItem.attachmentPath =
							Zotero.Attachments.getPath(
								file, Zotero.Attachments.LINK_MODE_IMPORTED_URL
							);
						attachmentItem.save();
						
						Zotero.Notifier.trigger('add', 'item', itemID);
						Zotero.Notifier.trigger('modify', 'item', sourceItemID);
				
						if(callback) callback(attachmentItem);
						
						// We don't have any way of knowing that the file
						// is flushed to disk, so we just wait a second
						// and hope for the best -- we'll index it later
						// if it fails
						//
						// TODO: index later
						setTimeout(function() {
							Zotero.Fulltext.indexItems([itemID]);
						}, 1000);
					}
					catch (e) {
						// Clean up
						attachmentItem.erase();
						if(callback) callback(false, e);
						
						throw (e);
					}
				});
				
				// Disable the Notifier during the commit
				var disabled = Zotero.Notifier.disable();
				
				// The attachment is still incomplete here, but we can't risk
				// leaving the transaction open if the callback never triggers
				Zotero.DB.commitTransaction();
				
				if (disabled) {
					Zotero.Notifier.enable();
				}
				
				var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
							.createInstance(Components.interfaces.nsIURL);
				nsIURL.spec = url;
				try {
					wbp.saveURI(nsIURL, null, null, null, null, file);
				} catch(e if e.name === "NS_ERROR_XPC_NOT_ENOUGH_ARGS") {
					// https://bugzilla.mozilla.org/show_bug.cgi?id=794602
					// XXX Always use when we no longer support Firefox < 18
					wbp.saveURI(nsIURL, null, null, null, null, file, null);
				}
				
				return attachmentItem;
			}
			catch (e){
				Zotero.DB.rollbackTransaction();
				
				try {
					// Clean up
					if (itemID) {
						var itemDir = this.getStorageDirectory(itemID);
						if (itemDir.exists()) {
							itemDir.remove(true);
						}
					}
				}
				catch (e) {}
				
				throw (e);
			}
		}
		
		var process = function (mimeType, hasNativeHandler) {
			// If we can load this natively, use a hidden browser
			// (so we can get the charset and title and index the document)
			if (hasNativeHandler) {
				nativeHandlerImport();
			}
			// Otherwise use a remote web page persist
			else {
				return externalHandlerImport(mimeType);
			}
		}
		
		if (mimeType) {
			return process(mimeType, Zotero.MIME.hasNativeHandler(mimeType));
		}
		else {
			Zotero.MIME.getMIMETypeFromURL(url, function (mimeType, hasNativeHandler) {
				process(mimeType, hasNativeHandler);
			}, cookieSandbox);
		}
	}
	
	
	/*
	 * Create a link attachment from a URL
	 *
	 * @param	{String}		url
	 * @param	{Integer}		sourceItemID	Parent item
	 * @param	{String}		[mimeType]		MIME type of page
	 * @param	{String}		[title]			Title to use for attachment
	 */
	function linkFromURL(url, sourceItemID, mimeType, title){
		Zotero.debug('Linking attachment from URL');
		
		// Throw error on invalid URLs
		var urlRe = /^https?:\/\/[^\s]*$/;
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
			mimeType = 'application/pdf';
		}
		
		var itemID = _addToDB(null, url, title, this.LINK_MODE_LINKED_URL,
			mimeType, null, sourceItemID);
		return itemID;
	}
	
	
	// TODO: what if called on file:// document?
	function linkFromDocument(document, sourceItemID, parentCollectionIDs){
		Zotero.debug('Linking attachment from document');
		
		if (sourceItemID && parentCollectionIDs) {
			var msg = "parentCollectionIDs is ignored when sourceItemID is set in Zotero.Attachments.linkFromDocument()";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			parentCollectionIDs = undefined;
		}
		
		var url = document.location.href;
		var title = document.title; // TODO: don't use Mozilla-generated title for images, etc.
		var mimeType = document.contentType;
		var charsetID = Zotero.CharacterSets.getID(document.characterSet);
		
		Zotero.DB.beginTransaction();
		
		var itemID = _addToDB(null, url, title, this.LINK_MODE_LINKED_URL,
			mimeType, charsetID, sourceItemID);
		
		// Add to collections
		if (parentCollectionIDs){
			var ids = Zotero.flattenArguments(parentCollectionIDs);
			for each(var id in ids){
				var col = Zotero.Collections.get(id);
				col.addItem(itemID);
			}
		}
		
		Zotero.DB.commitTransaction();
		
		// Run the fulltext indexer asynchronously (actually, it hangs the UI
		// thread, but at least it lets the menu close)
		setTimeout(function() {
			if (Zotero.Fulltext.isCachedMIMEType(mimeType)) {
				// No file, so no point running the PDF indexer
				//Zotero.Fulltext.indexItems([itemID]);
			}
			else {
				Zotero.Fulltext.indexDocument(document, itemID);
			}
		}, 50);
		
		return itemID;
	}
	
	
	/*
	 * Save a snapshot -- uses synchronous WebPageDump or asynchronous saveURI()
	 */
	function importFromDocument(document, sourceItemID, forceTitle, parentCollectionIDs, callback, libraryID) {
		Zotero.debug('Importing attachment from document');
		
		if (sourceItemID && parentCollectionIDs) {
			var msg = "parentCollectionIDs is ignored when sourceItemID is set in Zotero.Attachments.importFromDocument()";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			parentCollectionIDs = undefined;
		}
		
		var url = document.location.href;
		var title = forceTitle ? forceTitle : document.title;
		var mimeType = document.contentType;
		if(Zotero.Attachments.isPDFJS(document)) {
			mimeType = "application/pdf";
		}
		
		var charsetID = Zotero.CharacterSets.getID(document.characterSet);
		
		if (!forceTitle) {
			// Remove e.g. " - Scaled (-17%)" from end of images saved from links,
			// though I'm not sure why it's getting added to begin with
			if (mimeType.indexOf('image/') === 0) {
				title = title.replace(/(.+ \([^,]+, [0-9]+x[0-9]+[^\)]+\)) - .+/, "$1" );
			}
			// If not native type, strip mime type data in parens
			else if (!Zotero.MIME.hasNativeHandler(mimeType, _getExtensionFromURL(url))) {
				title = title.replace(/(.+) \([a-z]+\/[^\)]+\)/, "$1" );
			}
		}
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			if (libraryID) {
				attachmentItem.libraryID = libraryID;
			}
			else if (sourceItemID) {
				var parentItem = Zotero.Items.get(sourceItemID);
				attachmentItem.libraryID = parentItem.libraryID;
			}
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			attachmentItem.setSource(sourceItemID);
			attachmentItem.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			attachmentItem.attachmentCharset = charsetID;
			attachmentItem.attachmentMIMEType = mimeType;
			var itemID = attachmentItem.save();
			attachmentItem = Zotero.Items.get(itemID);
			
			// Create a new folder for this item in the storage directory
			var destDir = this.createDirectoryForItem(itemID);
			
			var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
			file.initWithFile(destDir);
			
			var fileName = _getFileNameFromURL(url, mimeType);
			file.append(fileName);
			
			if (mimeType == 'application/pdf') {
				var f = function() {
					Zotero.Fulltext.indexPDF(file, itemID);
					Zotero.Notifier.trigger('refresh', 'item', itemID);
				};
			}
			else {
				var f = function() {
					Zotero.Fulltext.indexDocument(document, itemID);
					Zotero.Notifier.trigger('refresh', 'item', itemID);
					if (callback) {
						callback(attachmentItem);
					}
				};
			}
			
			if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
				var sync = true;
				
				// Load WebPageDump code
				var wpd = {"Zotero":Zotero};
				Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader)
					.loadSubScript("chrome://zotero/content/webpagedump/common.js", wpd);
				Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader)
					.loadSubScript("chrome://zotero/content/webpagedump/domsaver.js", wpd);
				
				wpd.wpdDOMSaver.init(file.path, document);
				wpd.wpdDOMSaver.saveHTMLDocument();
				
				attachmentItem.attachmentPath = this.getPath(
					file, Zotero.Attachments.LINK_MODE_IMPORTED_URL
				);
				attachmentItem.save();
			}
			else {
				Zotero.debug('Saving with saveURI()');
				const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
				var wbp = Components
					.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(nsIWBP);
				wbp.persistFlags = nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION
					| nsIWBP.PERSIST_FLAGS_FROM_CACHE;
				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);
				var nsIURL = ioService.newURI(url, null, null);
				wbp.progressListener = new Zotero.WebProgressFinishListener(function () {
					try {
						attachmentItem.attachmentPath = Zotero.Attachments.getPath(
							file,
							Zotero.Attachments.LINK_MODE_IMPORTED_URL
						);
						attachmentItem.save();
						
						Zotero.Notifier.trigger('add', 'item', itemID);
						
						// We don't have any way of knowing that the file is flushed to
						// disk, so we just wait a second and hope for the best --
						// we'll index it later if it fails
						//
						// TODO: index later
						setTimeout(function () {
							f();
						}, 1000);
					}
					catch (e) {
						// Clean up
						var item = Zotero.Items.get(itemID);
						item.erase();
						if(callback) callback(false, e);
						
						throw (e);
					}
				});
				try {
					wbp.saveURI(nsIURL, null, null, null, null, file);
				} catch(e if e.name === "NS_ERROR_XPC_NOT_ENOUGH_ARGS") {
					// https://bugzilla.mozilla.org/show_bug.cgi?id=794602
					// XXX Always use when we no longer support Firefox < 18
					wbp.saveURI(nsIURL, null, null, null, null, file, null);
				}
			}
			
			// Add to collections
			if (parentCollectionIDs){
				var ids = Zotero.flattenArguments(parentCollectionIDs);
				for each(var id in ids){
					var col = Zotero.Collections.get(id);
					col.addItem(itemID);
				}
			}
			
			// Disable the Notifier during the commit if this is async
			if (!sync) {
				var disabled = Zotero.Notifier.disable();
			}
			
			Zotero.DB.commitTransaction();
			
			if (disabled) {
				Zotero.Notifier.enable();
			}
			
			if (sync) {
				Zotero.Notifier.trigger('add', 'item', itemID);
				
				// Wait a second before indexing (see note above)
				setTimeout(function () {
					f();
				}, 1000);
			}
			
			// Caution: Take care using this itemID. The notifier may not yet have been called,
			// so the attachment may not be available in, for example, the items list
			return itemID;
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			
			try {
				// Clean up
				if (itemID) {
					var itemDir = this.getStorageDirectory(itemID);
					if (itemDir.exists()) {
						itemDir.remove(true);
					}
				}
			}
			catch (e) {}
			
			throw (e);
		}
	}
	
	
	/*
	 * Previous asynchronous snapshot method -- disabled in favor of WebPageDump
	 */
	 /*
	function importFromDocument(document, sourceItemID, forceTitle, parentCollectionIDs, callback){
		Zotero.debug('Importing attachment from document');
		
		var url = document.location.href;
		var title = forceTitle ? forceTitle : document.title;
		var mimeType = document.contentType;
		var charsetID = Zotero.CharacterSets.getID(document.characterSet);
		
		if (!forceTitle) {
			// Remove e.g. " - Scaled (-17%)" from end of images saved from links,
			// though I'm not sure why it's getting added to begin with
			if (mimeType.indexOf('image/') === 0) {
				title = title.replace(/(.+ \([^,]+, [0-9]+x[0-9]+[^\)]+\)) - .+/, "$1" );
			}
			// If not native type, strip mime type data in parens
			else if (!Zotero.MIME.hasNativeHandler(mimeType, _getExtensionFromURL(url))) {
				title = title.replace(/(.+) \([a-z]+\/[^\)]+\)/, "$1" );
			}
		}
		
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		var wbp = Components
			.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(nsIWBP);
		wbp.persistFlags = nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
		var encodingFlags = false;
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			// Don't send a Notifier event on the incomplete item
			var disabled = Zotero.Notifier.disable();
			attachmentItem.save();
			if (disabled) {
				Zotero.Notifier.enable();
			}
			var itemID = attachmentItem.getID();
			
			// Create a new folder for this item in the storage directory
			var destDir = this.createDirectoryForItem(itemID);
			
			var file = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
			file.initWithFile(destDir);
			
			var fileName = _getFileNameFromURL(url, mimeType);
			
			file.append(fileName);
			
			wbp.progressListener = new Zotero.WebProgressFinishListener(function(){
				try {
					Zotero.DB.beginTransaction();
					
					_addToDB(file, url, title, Zotero.Attachments.LINK_MODE_IMPORTED_URL, mimeType,
						charsetID, sourceItemID, itemID);
					
					Zotero.Notifier.trigger('add', 'item', itemID);
					
					// Add to collections
					if (parentCollectionIDs){
						var ids = Zotero.flattenArguments(parentCollectionIDs);
						for each(var id in ids){
							var col = Zotero.Collections.get(id);
							col.addItem(itemID);
						}
					}
					
					Zotero.DB.commitTransaction();
				}
				catch (e) {
					Zotero.DB.rollbackTransaction();
					
					// Clean up
					if (itemID) {
						var item = Zotero.Items.get(itemID);
						if (item) {
							item.erase();
						}
						
						try {
							var destDir = Zotero.getStorageDirectory();
							destDir.append(itemID);
							if (destDir.exists()) {
								destDir.remove(true);
							}
						}
						catch (e) {}
					}
					
					throw (e);
				}
				
				Zotero.Fulltext.indexDocument(document, itemID);
				
				if (callback) {
					callback();
				}
			});
			
			// The attachment is still incomplete here, but we can't risk
			// leaving the transaction open if the callback never triggers
			Zotero.DB.commitTransaction();
			
			if (mimeType == 'text/html') {
				Zotero.debug('Saving with saveDocument() to ' + destDir.path);
				wbp.saveDocument(document, file, destDir, mimeType, encodingFlags, false);
			}
			else {
				Zotero.debug('Saving with saveURI()');
				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);
				var nsIURL = ioService.newURI(url, null, null);
				wbp.saveURI(nsIURL, null, null, null, null, file);
			}
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			
			try {
				// Clean up
				if (itemID) {
					var destDir = Zotero.getStorageDirectory();
					destDir.append(itemID);
					if (destDir.exists()) {
						destDir.remove(true);
					}
				}
			}
			catch (e) {}
			
			throw (e);
		}
	}
	*/
	
	
	/*
	 * Create a new attachment with a missing file
	 */
	function createMissingAttachment(linkMode, file, url, title, mimeType, charset, sourceItemID) {
		if (linkMode == this.LINK_MODE_LINKED_URL) {
			throw ('Zotero.Attachments.createMissingAttachment() cannot be used to create linked URLs');
		}
		
		var charsetID = charset ? Zotero.CharacterSets.getID(charset) : null;
		
		return _addToDB(file, url, title, linkMode, mimeType,
				charsetID, sourceItemID);
	}
	
	
	/*
	 * Returns a formatted string to use as the basename of an attachment
	 * based on the metadata of the specified item and a format string
	 *
	 * (Optional) |formatString| specifies the format string -- otherwise
	 *     the 'attachmentRenameFormatString' pref is used
	 *
	 * Valid substitution markers:
	 *
	 *  %c -- firstCreator
	 *  %y -- year (extracted from Date field)
	 *  %t -- title
	 *
	 * Fields can be truncated to a certain length by appending an integer
	 * within curly brackets -- e.g. %t{50} truncates the title to 50 characters
	 */
	function getFileBaseNameFromItem(itemID, formatString) {
		if (!formatString) {
			formatString = Zotero.Prefs.get('attachmentRenameFormatString');
		}
		
		var item = Zotero.Items.get(itemID);
		if (!item) {
			throw ('Invalid itemID ' + itemID + ' in Zotero.Attachments.getFileBaseNameFromItem()');
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
	
	
	/*
	 * Create directory for attachment files within storage directory
	 *
	 * @param	integer		itemID		Item id
	 *
	 * If a directory exists with the same name, move it to orphaned-files
	 */
	function createDirectoryForItem(itemID) {
		var dir = this.getStorageDirectory(itemID);
		_moveOrphanedDirectory(dir);
		if (!dir.exists()) {
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return dir;
	}
	
	
	/*
	 * Create directory for missing attachment files within storage directory
	 *
	 * @param	string	key		Item secondary lookup key
	 */
	function createDirectoryForMissingItem(key) {
		var dir = this.getStorageDirectoryByKey(key);
		if (!dir.exists()) {
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return dir;
	}
	
	
	function getStorageDirectory(itemID) {
		if (!itemID) {
			throw ("itemID not provided in Zotero.Attachments.getStorageDirectory()");
		}
		var item = Zotero.Items.get(itemID);
		if (!item) {
			throw ("Item " + itemID + " not found in Zotero.Attachments.getStorageDirectory()");
		}
		if (!item.key) {
			throw ("No item key in Zotero.Attachments.getStorageDirectory()");
		}
		var dir = Zotero.getStorageDirectory();
		dir.append(item.key);
		return dir;
	}
	
	
	this.getStorageDirectoryByKey = function (key) {
		if (typeof key != 'string' || !key.match(/^[A-Z0-9]{8}$/)) {
			throw ('key must be an 8-character string in '
				+ 'Zotero.Attachments.getStorageDirectoryByKey()')
		}
		var dir = Zotero.getStorageDirectory();
		dir.append(key);
		return dir;
	}
	
	
	/*
	 * Gets a relative descriptor for imported attachments and a persistent
	 * descriptor for files outside the storage directory
	 */
	function getPath(file, linkMode) {
		file.QueryInterface(Components.interfaces.nsILocalFile);
		if (linkMode == self.LINK_MODE_IMPORTED_URL ||
				linkMode == self.LINK_MODE_IMPORTED_FILE) {
			var fileName = file.getRelativeDescriptor(file.parent);
			return 'storage:' + fileName;
		}
		return file.persistentDescriptor;
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
		
		if (item.attachmentMIMEType != 'text/html') {
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
	this.copyAttachmentToLibrary = function (attachment, libraryID, sourceItemID) {
		var linkMode = attachment.attachmentLinkMode;
		
		if (attachment.libraryID == libraryID) {
			throw ("Attachment is already in library " + libraryID);
		}
		
		var newAttachment = new Zotero.Item('attachment');
		newAttachment.libraryID = libraryID;
		// Link mode needs to be set when saving new attachment
		newAttachment.attachmentLinkMode = linkMode;
		if (attachment.isImportedAttachment()) {
			// Attachment path isn't copied over by clone() if libraryID is different
			newAttachment.attachmentPath = attachment.attachmentPath;
		}
		// DEBUG: save here because clone() doesn't currently work on unsaved tagged items
		var id = newAttachment.save();
		newAttachment = Zotero.Items.get(id);
		attachment.clone(false, newAttachment);
		if (sourceItemID) {
			newAttachment.setSource(sourceItemID);
		}
		newAttachment.save();
		
		// Copy over files if they exist
		if (newAttachment.isImportedAttachment() && attachment.getFile()) {
			var dir = Zotero.Attachments.getStorageDirectory(attachment.id);
			var newDir = Zotero.Attachments.createDirectoryForItem(newAttachment.id);
			Zotero.File.copyDirectory(dir, newDir);
		}
		
		attachment.addLinkedItem(newAttachment);
		return newAttachment.id;
	}
	
	
	function _getFileNameFromURL(url, mimeType){
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		
		var ext = Zotero.MIME.getPrimaryExtension(mimeType, nsIURL.fileExtension);
		
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
		
		// Unencode fileBaseName
		var decodedFileBaseName;
		try {
			decodedFileBaseName = decodeURIComponent(nsIURL.fileBaseName);
		}
		catch (e) {
			if (e.name == 'URIError') {
				// If we got a 'malformed URI sequence' while decoding,
				// try MD5 (in hex string) of fileBaseName.
				decodedFileBaseName = Zotero.Utilities.Internal.md5(nsIURL.fileBaseName, false);
			}
			else {
				throw e;
			}
		}
		
		// Pass unencoded name to getValidFileName() so that '%20' isn't stripped to '20'
		nsIURL.fileBaseName = Zotero.File.getValidFileName(decodedFileBaseName);
		
		return decodeURIComponent(nsIURL.fileName);
	}
	
	
	function _getExtensionFromURL(url, mimeType) {
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		return Zotero.MIME.getPrimaryExtension(mimeType, nsIURL.fileExtension);
	}
	
	
	/**
	 * If directory exists and is non-empty, move it to orphaned-files directory
	 *
	 * If empty, just remove it
	 */
	function _moveOrphanedDirectory(dir) {
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
	}
	
	
	/**
	* Create a new item of type 'attachment' and add to the itemAttachments table
	*
	* Returns the itemID of the new attachment
	**/
	function _addToDB(file, url, title, linkMode, mimeType, charsetID, sourceItemID) {
		Zotero.DB.beginTransaction();
		
		var attachmentItem = new Zotero.Item('attachment');
		if (sourceItemID) {
			var parentItem = Zotero.Items.get(sourceItemID);
			if (parentItem.libraryID && linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				throw ("Cannot save linked file in non-local library");
			}
			attachmentItem.libraryID = parentItem.libraryID;
		}
		attachmentItem.setField('title', title);
		if (linkMode == self.LINK_MODE_IMPORTED_URL
				|| linkMode == self.LINK_MODE_LINKED_URL) {
			attachmentItem.setField('url', url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
		}
		
		// Get path
		if (file) {
			attachmentItem.attachmentPath
				= Zotero.Attachments.getPath(file, linkMode);
		}
		
		attachmentItem.setSource(sourceItemID);
		attachmentItem.attachmentLinkMode = linkMode;
		attachmentItem.attachmentMIMEType = mimeType;
		attachmentItem.attachmentCharset = charsetID;
		attachmentItem.save();
		
		Zotero.DB.commitTransaction();
		
		return attachmentItem.id;
	}
	
	
	/*
	 * Since we have to load the content into the browser to get the
	 * character set (at least until we figure out a better way to get
	 * at the native detectors), we create the item above and update
	 * asynchronously after the fact
	 */
	function _postProcessFile(itemID, file, mimeType){
		// Don't try to process if MIME type is unknown
		if (!mimeType) {
			return;
		}
		
		// MIME types that get cached by the fulltext indexer can just be
		// indexed directly
		if (Zotero.Fulltext.isCachedMIMEType(mimeType)) {
			Zotero.Fulltext.indexItems([itemID]);
			return;
		}
		
		var ext = Zotero.File.getExtension(file);
		if (!Zotero.MIME.hasInternalHandler(mimeType, ext)) {
			return;
		}
		
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var callback = function(charset, args) {
			// ignore spurious about:blank loads
			if(browser.contentDocument.location.href == "about:blank") return;
			
			var writeCallback = function () {
				var charsetID = Zotero.CharacterSets.getID(charset);
				if (charsetID) {
					var disabled = Zotero.Notifier.disable();
					
					var item = Zotero.Items.get(itemID);
					item.attachmentCharset = charsetID;
					item.save();
					
					if (disabled) {
						Zotero.Notifier.enable();
					}
				}
				
				// Chain fulltext indexer inside the charset callback,
				// since it's asynchronous and a prerequisite
				Zotero.Fulltext.indexDocument(browser.contentDocument, itemID);
			}
			
			// Since the callback can be called during an import process that uses
			// Zotero.wait(), try to queue the callback to run at the end,
			// or run now if not queued
			var queued = Zotero.addUnlockCallback(writeCallback);
			if (!queued) {
				writeCallback();
			}
		};
		
		Zotero.File.addCharsetListener(browser, callback, itemID);
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(file);
		browser.loadURI(url);
	}
	
	/**
	 * Determines if a given document is an instance of PDFJS
	 * @return {Boolean}
	 */
	this.isPDFJS = function(doc) {
		// pdf.js HACK
		if(doc.contentType === "text/html") {
			var win = doc.defaultView;
			if(win) {
				win = win.wrappedJSObject;
				if(win && "PDFJS" in win && win.PDFJS.isFirefoxExtension) {
					return true;
				}
			}
		}
		return false;
	}
}
