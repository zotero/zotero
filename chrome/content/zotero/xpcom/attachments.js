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
	this.getStorageDirectory = getStorageDirectory;
	this.getPath = getPath;
	
	var self = this;
	
	
	function importFromFile(file, sourceItemID){
		Zotero.debug('Importing attachment from file');
		
		var title = file.leafName;
		
		Zotero.DB.beginTransaction();
		
		try {
			// Create a new attachment
			var attachmentItem = new Zotero.Item('attachment');
			attachmentItem.setField('title', title);
			attachmentItem.save();
			var itemID = attachmentItem.getID();
			
			// Create directory for attachment files within storage directory
			var destDir = this.createDirectoryForItem(itemID);
			
			file.copyTo(destDir, null);
			
			// Point to copied file
			var newFile = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
			newFile.initWithFile(destDir);
			newFile.append(title);
			
			var mimeType = Zotero.MIME.getMIMETypeFromFile(newFile);
			
			_addToDB(newFile, null, null, this.LINK_MODE_IMPORTED_FILE,
				mimeType, null, sourceItemID, itemID);
			
			Zotero.DB.commitTransaction();
			
			// Determine charset and build fulltext index
			_postProcessFile(itemID, newFile, mimeType);
		}
		catch (e){
			// hmph
			Zotero.DB.rollbackTransaction();
			
			try {
				// Clean up
				if (itemID){
					var itemDir = Zotero.getStorageDirectory();
					itemDir.append(itemID);
					if (itemDir.exists()){
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
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			// DEBUG: this should probably insert access date too so as to
			// create a proper item, but at the moment this is only called by
			// translate.js, which sets the metadata fields itself
			attachmentItem.save();
			var itemID = attachmentItem.getID();
			
			var storageDir = Zotero.getStorageDirectory();
			file.parent.copyTo(storageDir, itemID);
			
			// Point to copied file
			var newFile = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
			newFile.initWithFile(storageDir);
			newFile.append(itemID);
			newFile.append(file.leafName);
			
			_addToDB(newFile, url, null, this.LINK_MODE_IMPORTED_URL, mimeType,
				charsetID, sourceItemID, itemID);
			Zotero.DB.commitTransaction();
			
			// Determine charset and build fulltext index
			_postProcessFile(itemID, newFile, mimeType);
		}
		catch (e){
			Zotero.DB.rollbackTransaction();
			
			try {
				// Clean up
				if (itemID){
					var itemDir = Zotero.getStorageDirectory();
					itemDir.append(itemID);
					if (itemDir.exists()){
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
		
		Zotero.Utilities.HTTP.doHead(url, function(obj){
			var mimeType = obj.channel.contentType;
			
			var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
						.createInstance(Components.interfaces.nsIURL);
			nsIURL.spec = url;
			var ext = nsIURL.fileExtension;
			
			// Override MIME type to application/pdf if extension is .pdf --
			// workaround for sites that respond to the HEAD request with an
			// invalid MIME type (https://www.zotero.org/trac/ticket/460)
			//
			// Downloaded file is inspected below and deleted if actually HTML
			if (ext == 'pdf') {
				mimeType = 'application/pdf';
			}
			
			// If we can load this natively, use a hidden browser (so we can
			// get the charset and title and index the document)
			if (Zotero.MIME.hasNativeHandler(mimeType, ext)){
				var browser = Zotero.Browser.createHiddenBrowser();
				var imported = false;
				var onpageshow = function() {
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
					attachmentItem.setField('title', title);
					attachmentItem.setField('url', url);
					attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
					// Don't send a Notifier event on the incomplete item
					var itemID = attachmentItem.save();
					
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
					
					var file = Components.classes["@mozilla.org/file/local;1"].
							createInstance(Components.interfaces.nsILocalFile);
					file.initWithFile(destDir);
					file.append(fileName);
					
					wbp.progressListener = new Zotero.WebProgressFinishListener(function(){
						try {
							var str = Zotero.File.getSample(file);
							if (mimeType == 'application/pdf' &&
									Zotero.MIME.sniffForMIMEType(str) != 'application/pdf') {
								Zotero.debug("Downloaded PDF did not have MIME type "
									+ "'application/pdf' in Attachments.importFromURL()", 2);
								var item = Zotero.Items.get(itemID);
								item.erase();
								return;
							}
							
							_addToDB(file, url, title, Zotero.Attachments.LINK_MODE_IMPORTED_URL,
								mimeType, null, sourceItemID, itemID);
							
							Zotero.Notifier.trigger('add', 'item', itemID);
							
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
							var item = Zotero.Items.get(itemID);
							item.erase();
							
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
		});
	}
	
	
	/*
	 * Create a link attachment from a URL
	 *
	 * Returns the itemID of the created attachment
	 */
	function linkFromURL(url, sourceItemID, mimeType, title){
		Zotero.debug('Linking attachment from URL');
		
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
		
		// If we don't have the MIME type, do a HEAD request for it
		Zotero.Utilities.HTTP.doHead(url, function(obj){
			var mimeType = obj.channel.contentType;
			
			if (mimeType) {
				var sql = "UPDATE itemAttachments SET mimeType=? WHERE itemID=?";
				Zotero.DB.query(sql, [mimeType, itemID]);
			}
			
			Zotero.Notifier.trigger('add', 'item', itemID);
		});
		
		return itemID;
	}
	
	
	// TODO: what if called on file:// document?
	function linkFromDocument(document, sourceItemID, parentCollectionIDs){
		Zotero.debug('Linking attachment from document');
		
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
			attachmentItem.setField('title', title);
			attachmentItem.setField('url', url);
			attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			var itemID = attachmentItem.save();
			
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
				
				_addToDB(file, url, title, Zotero.Attachments.LINK_MODE_IMPORTED_URL,
					mimeType, charsetID, sourceItemID, itemID);
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
						_addToDB(file, url, title, Zotero.Attachments.LINK_MODE_IMPORTED_URL,
							mimeType, charsetID, sourceItemID, itemID);
						
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
			
			// If no value for this field, strip entire conditional block
			// (within curly braces)
			if (!value) {
				var re = new RegExp("\{[^%]*" + rpl + "(\{[0-9]+\})?" + "[^%]*\}");
				if (str.match(re)) {
					return str.replace(re, '')
				}
			}
			
			var f = function(match) {
				var chars = match.match(/{([0-9]+)}/);
				return (chars) ? value.substr(0, chars[1]) : value;
			}
			
			var re = new RegExp("(\{[^%]*)?" + rpl + "(\{[0-9]+\})?" + "([^%]*\})?");
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
	 */
	function createDirectoryForItem(itemID) {
		var dir = this.getStorageDirectory(itemID);
		if (!dir.exists()) {
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
		return dir;
	}
	
	
	function getStorageDirectory(itemID) {
		var dir = Zotero.getStorageDirectory();
		dir.append(itemID);
		return dir;
	}
	
	
	/*
	 * Gets a relative descriptor for imported attachments and a persistent
	 * descriptor for files outside the storage directory
	 */
	function getPath(file, linkMode) {
		if (!file.exists()) {
			throw ('Zotero.Attachments.getPath() cannot be called on non-existent file');
		}
		
		file.QueryInterface(Components.interfaces.nsILocalFile);
		
		if (linkMode == self.LINK_MODE_IMPORTED_URL ||
				linkMode == self.LINK_MODE_IMPORTED_FILE) {
			var storageDir = Zotero.getStorageDirectory();
			storageDir.QueryInterface(Components.interfaces.nsILocalFile);
			return file.getRelativeDescriptor(storageDir);
		}
		
		return file.persistentDescriptor;
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
		
		return nsIURL.fileName;
	}
	
	
	function _getExtensionFromURL(url, mimeType) {
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		return Zotero.MIME.getPrimaryExtension(mimeType, nsIURL.fileExtension);
	}
	
	
	/**
	* Create a new item of type 'attachment' and add to the itemAttachments table
	*
	* Passing an itemID causes it to skip new item creation and use the specified
	* item instead -- used when importing files (since we have to know
	* the itemID before copying in a file and don't want to update the DB before
	* the file is saved)
	*
	* Returns the itemID of the new attachment
	**/
	function _addToDB(file, url, title, linkMode, mimeType, charsetID, sourceItemID, itemID){
		Zotero.DB.beginTransaction();
		
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
			if (!sourceItem){
				Zotero.DB.commitTransaction();
				throw ("Cannot set attachment source to invalid item " + sourceItemID);
			}
			if (sourceItem.isAttachment()){
				Zotero.DB.commitTransaction();
				throw ("Cannot set attachment source to another file (" + sourceItemID + ")");
			}
		}
		
		// If an itemID is provided, use that
		if (itemID){
			var attachmentItem = Zotero.Items.get(itemID);
			if (!attachmentItem.isAttachment()){
				throw ("Item " + itemID + " is not a valid attachment in _addToDB()");
			}
		}
		// Otherwise create a new attachment
		else {
			var attachmentItem = new Zotero.Item('attachment');
			attachmentItem.setField('title', title);
			if (linkMode==self.LINK_MODE_IMPORTED_URL
				|| linkMode==self.LINK_MODE_LINKED_URL){
				attachmentItem.setField('url', url);
				attachmentItem.setField('accessDate', "CURRENT_TIMESTAMP");
			}
			attachmentItem.save();
		}
		
		if (file) {
			if (file.exists()) {
				var path = getPath(file, linkMode);
			}
			// If file doesn't exist, create one temporarily so we can get the
			// relative path (since getPath() doesn't work on non-existent files)
			else if (linkMode == self.LINK_MODE_IMPORTED_URL ||
					linkMode == self.LINK_MODE_IMPORTED_FILE) {
				var missingFile = self.createDirectoryForItem(attachmentItem.getID());
				missingFile.append(file.leafName);
				missingFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
				var path = getPath(missingFile, linkMode);
				var parentDir = missingFile.parent;
				missingFile.remove(null);
				parentDir.remove(null);
			}
		}
		
		var sql = "INSERT INTO itemAttachments (itemID, sourceItemID, linkMode, "
			+ "mimeType, charsetID, path) VALUES (?,?,?,?,?,?)";
		var bindParams = [
			attachmentItem.getID(),
			sourceItemID ? {int:sourceItemID} : null,
			{int:linkMode},
			mimeType ? {string:mimeType} : null,
			charsetID ? {int:charsetID} : null,
			path ? {string:path} : null
		];
		Zotero.DB.query(sql, bindParams);
		
		if (sourceItemID){
			sourceItem.incrementAttachmentCount();
			Zotero.Notifier.trigger('modify', 'item', sourceItemID);
		}
		
		Zotero.DB.commitTransaction();
		
		return attachmentItem.getID();
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
		
		Zotero.File.addCharsetListener(browser, new function(){
			return function(charset, id){
				var charsetID = Zotero.CharacterSets.getID(charset);
				if (charsetID){
					var sql = "UPDATE itemAttachments SET charsetID=" + charsetID
						+ " WHERE itemID=" + itemID;
					Zotero.DB.query(sql);
				}
				
				// Chain fulltext indexer inside the charset callback,
				// since it's asynchronous and a prerequisite
				Zotero.Fulltext.indexDocument(browser.contentDocument, itemID);
				
				Zotero.Browser.deleteHiddenBrowser(browser);
			};
		}, itemID);
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(file);
		browser.loadURI(url);
	}
}
