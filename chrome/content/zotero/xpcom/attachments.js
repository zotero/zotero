/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
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
	
	
	function importFromFile(file, sourceItemID){
		Zotero.debug('Importing attachment from file');
		
		var title = file.leafName;
		
		if (!file.isFile()) {
			throw ("'" + title + "' must be a file in Zotero.Attachments.importFromFile()");
		}
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			if (sourceItemID) {
				var parentItem = Zotero.Items.get(sourceItemID);
				attachmentItem.libraryID = parentItem.libraryID;
			}
			attachmentItem.setField('title', title);
			attachmentItem.setSource(sourceItemID);
			attachmentItem.attachmentLinkMode = this.LINK_MODE_IMPORTED_FILE;
			var itemID = attachmentItem.save();
			attachmentItem = Zotero.Items.get(itemID);
			
			// Create directory for attachment files within storage directory
			var destDir = this.createDirectoryForItem(itemID);
			file.copyTo(destDir, null);
			
			// Point to copied file
			var newFile = destDir.clone();
			newFile.append(title);
			
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
	
	
	function importFromURL(url, sourceItemID, forceTitle, forceFileBaseName, parentCollectionIDs){
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
			throw ("Invalid URL '" + url + "' in Zotero.Attachments.importFromURL()");
		}
		
		Zotero.Utilities.HTTP.doHead(url, function(obj){
			if (obj.status != 200 && obj.status != 204) {
				Zotero.debug("Attachment HEAD request returned with status code "
					+ obj.status + " in Attachments.importFromURL()", 2);
				var mimeType = '';
			}
			else {
				var mimeType = obj.channel.contentType;
			}
			
			var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
						.createInstance(Components.interfaces.nsIURL);
			nsIURL.spec = url;
			
			// Override MIME type to application/pdf if extension is .pdf --
			// workaround for sites that respond to the HEAD request with an
			// invalid MIME type (https://www.zotero.org/trac/ticket/460)
			//
			// Downloaded file is inspected below and deleted if actually HTML
			if (nsIURL.fileName.match(/pdf$/) || url.match(/pdf$/)) {
				mimeType = 'application/pdf';
			}
			
			// If we can load this natively, use a hidden browser (so we can
			// get the charset and title and index the document)
			if (Zotero.MIME.hasNativeHandler(mimeType, ext)){
				var browser = Zotero.Browser.createHiddenBrowser();
				var imported = false;
				var onpageshow = function() {
					// ignore spurious about:blank loads
					if(browser.contentDocument.location.href == "about:blank") return;
					
					// pageshow can be triggered multiple times on some pages,
					// so make sure we only import once
					// (https://www.zotero.org/trac/ticket/795)
					if (imported) {
						return;
					}
					var callback = function () {
						browser.removeEventListener("pageshow", onpageshow, false);
						Zotero.Browser.deleteHiddenBrowser(browser);
					};
					Zotero.Attachments.importFromDocument(browser.contentDocument,
						sourceItemID, forceTitle, parentCollectionIDs, callback);
					imported = true;
				};
				browser.addEventListener("pageshow", onpageshow, false);
				browser.loadURI(url);
			}
			
			// Otherwise use a remote web page persist
			else {
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
				var encodingFlags = false;
				
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
								Zotero.debug("Downloaded PDF did not have MIME type "
									+ "'application/pdf' in Attachments.importFromURL()", 2);
								attachmentItem.erase();
								return;
							}
							
							attachmentItem.attachmentPath =
								Zotero.Attachments.getPath(
									file, Zotero.Attachments.LINK_MODE_IMPORTED_URL
								);
							attachmentItem.save();
							
							Zotero.Notifier.trigger('add', 'item', itemID);
							Zotero.Notifier.trigger('modify', 'item', sourceItemID);
							
							// We don't have any way of knowing that the file
							// is flushed to disk, so we just wait a second
							// and hope for the best -- we'll index it later
							// if it fails
							//
							// TODO: index later
							var timer = Components.classes["@mozilla.org/timer;1"].
								createInstance(Components.interfaces.nsITimer);
							timer.initWithCallback({notify: function() {
								Zotero.Fulltext.indexItems([itemID]);
							}}, 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
						}
						catch (e) {
							// Clean up
							attachmentItem.erase();
							
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
					
					wbp.saveURI(nsIURL, null, null, null, null, file);
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
		});
	}
	
	
	/*
	 * Create a link attachment from a URL
	 *
	 * Returns the itemID of the created attachment
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
		
		// Disable the Notifier if we're going to do a HEAD for the MIME type
		if (!mimeType) {
			var disabled = Zotero.Notifier.disable();
		}
		
		var itemID = _addToDB(null, url, title, this.LINK_MODE_LINKED_URL,
			mimeType, null, sourceItemID);
		
		if (disabled) {
			Zotero.Notifier.enable();
		}
		
		if (!mimeType) {
			// If we don't have the MIME type, do a HEAD request for it
			Zotero.Utilities.HTTP.doHead(url, function(obj){
				var mimeType = obj.channel.contentType;
				
				if (mimeType) {
					var disabled = Zotero.Notifier.disable();
					
					var item = Zotero.Items.get(itemID);
					item.attachmentMIMEType = mimeType;
					item.save();
					
					if (disabled) {
						Zotero.Notifier.enable();
					}
				}
				
				Zotero.Notifier.trigger('add', 'item', itemID);
			});
		}
		
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
	function importFromDocument(document, sourceItemID, forceTitle, parentCollectionIDs, callback) {
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
			if (sourceItemID) {
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
						callback();
					}
				};
			}
			
			if (mimeType == 'text/html') {
				var sync = true;
				
				// Load WebPageDump code
				Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader)
					.loadSubScript("chrome://zotero/content/webpagedump/common.js");
				
				Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader)
					.loadSubScript("chrome://zotero/content/webpagedump/domsaver.js");
				
				wpdDOMSaver.init(file.path, document);
				wpdDOMSaver.saveHTMLDocument();
				
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
						var timer = Components.classes["@mozilla.org/timer;1"].
							createInstance(Components.interfaces.nsITimer);
						timer.initWithCallback({notify: f}, 1000,
							Components.interfaces.nsITimer.TYPE_ONE_SHOT);
					}
					catch (e) {
						// Clean up
						var item = Zotero.Items.get(itemID);
						item.erase();
						
						throw (e);
					}
				});
				wbp.saveURI(nsIURL, null, null, null, null, file);
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
				var timer = Components.classes["@mozilla.org/timer;1"].
					createInstance(Components.interfaces.nsITimer);
				timer.initWithCallback({notify: f}, 1000,
					Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			}
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
					var value = item.getField('date', true);
					if (value) {
						value = Zotero.Date.multipartToSQL(value).substr(0, 4);
						if (value == '0000') {
							value = '';
						}
					}
				break;
				
				default:
					var value = item.getField(field, false, true);
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
		
		// Strip potentially invalid characters
		// See http://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
		formatString = formatString.replace(/[\/\\\?\*:|"<>\.]/g, '');
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
		var item = Zotero.Items.get(itemID);
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
		if (linkMode == self.LINK_MODE_IMPORTED_URL ||
				linkMode == self.LINK_MODE_IMPORTED_FILE) {
			file.QueryInterface(Components.interfaces.nsILocalFile);
			var fileName = file.getRelativeDescriptor(file.parent);
			return 'storage:' + fileName;
		}
		
		return file.persistentDescriptor;
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
		
		nsIURL.fileBaseName = Zotero.File.getValidFileName(nsIURL.fileBaseName);
		
		return nsIURL.fileName;
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
		
		var files = dir.directoryEntries;
		files.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		if (!files.hasMoreElements()) {
			dir.remove(false);
		}
		files.close();
		
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
		// MIME types that get cached by the fulltext indexer can just be
		// indexed directly
		if (Zotero.Fulltext.isCachedMIMEType(mimeType)) {
			Zotero.Fulltext.indexItems([itemID]);
			return;
		}
		
		var ext = Zotero.File.getExtension(file);
		if (mimeType.substr(0, 5)!='text/' ||
			!Zotero.MIME.hasInternalHandler(mimeType, ext)){
			return;
		}
		
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var callback = function(charset, args) {
			// ignore spurious about:blank loads
			if(browser.contentDocument.location.href == "about:blank") return;
			
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
		};
		
		Zotero.File.addCharsetListener(browser, callback, itemID);
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(file);
		browser.loadURI(url);
	}
}
