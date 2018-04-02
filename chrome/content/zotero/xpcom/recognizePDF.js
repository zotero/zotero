/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
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

Zotero.RecognizePDF = new function () {
	const OFFLINE_RECHECK_DELAY = 60 * 1000;
	const MAX_PAGES = 5;
	const UNRECOGNIZE_TIMEOUT = 86400 * 1000;
	
	this.ROW_QUEUED = 1;
	this.ROW_PROCESSING = 2;
	this.ROW_FAILED = 3;
	this.ROW_SUCCEEDED = 4;
	
	let _newItems = new WeakMap();
	
	let _listeners = {};
	let _rows = [];
	let _queue = [];
	let _queueProcessing = false;
	
	/**
	 * Add listener
	 * @param name Event name
	 * @param callback
	 */
	this.addListener = function (name, callback) {
		_listeners[name] = callback;
	};
	
	/**
	 * Remove listener
	 * @param name Event name
	 */
	this.removeListener = function (name) {
		delete _listeners[name];
	};
	
	/**
	 * Checks whether a given PDF could theoretically be recognized
	 * @param {Zotero.Item} item
	 * @return {Boolean} True if the PDF can be recognized, false if it cannot be
	 */
	this.canRecognize = function (item) {
		return item.attachmentContentType
			&& item.attachmentContentType === 'application/pdf'
			&& item.isTopLevelItem();
	};
	
	/**
	 * Adds items to the queue and starts processing it
	 * @param items {Zotero.Item}
	 */
	this.recognizeItems = function (items) {
		for (let item of items) {
			_addItem(item);
		}
		_processQueue();
	};
	
	
	this.autoRecognizeItems = function (items) {
		if (!Zotero.Prefs.get('autoRecognizeFiles')) return;
		
		var pdfs = items.filter((item) => {
			return item
				&& item.isFileAttachment()
				&& item.attachmentContentType == 'application/pdf';
		});
		if (!pdfs.length) {
			return;
		}
		this.recognizeItems(pdfs);
		var win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			win.Zotero_RecognizePDF_Dialog.open();
		}
	};
	
	/**
	 * Returns all rows
	 * @return {Array}
	 */
	this.getRows = function () {
		return _rows;
	};
	
	/**
	 * Returns rows count
	 * @return {Number}
	 */
	this.getTotal = function () {
		return _rows.length;
	};
	
	/**
	 * Returns processed rows count
	 * @return {Number}
	 */
	this.getProcessedTotal = function () {
		return _rows.filter(row => row.status > Zotero.RecognizePDF.ROW_PROCESSING).length;
	};
	
	/**
	 * Stop processing items
	 */
	this.cancel = function () {
		_queue = [];
		_rows = [];
		if (_listeners['empty']) {
			_listeners['empty']();
		}
	};
	
	
	this.canUnrecognize = function (item) {
		var { dateModified } = _newItems.get(item) || {};
		// Item must have been recognized recently, must not have been modified since it was
		// created, and must have only one attachment and no other children
		if (!dateModified
				|| Zotero.Date.sqlToDate(dateModified, true) < new Date() - UNRECOGNIZE_TIMEOUT
				|| item.dateModified != dateModified
				|| item.numAttachments(true) != 1
				|| item.numChildren(true) != 1) {
			_newItems.delete(item);
			return false;
		}
		
		// Child attachment must be not be in trash and must be a PDF
		var attachments = Zotero.Items.get(item.getAttachments());
		if (!attachments.length || attachments[0].attachmentContentType != 'application/pdf') {
			_newItems.delete(item);
			return false;
		}
		
		return true;
	};
	
	
	this.unrecognize = async function (item) {
		var { originalTitle, originalFilename } = _newItems.get(item);
		var attachment = Zotero.Items.get(item.getAttachments()[0]);
		
		try {
			let currentFilename = attachment.attachmentFilename;
			if (currentFilename != originalFilename) {
				let renamed = await attachment.renameAttachmentFile(originalFilename);
				if (renamed) {
					attachment.setField('title', originalTitle);
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		return Zotero.DB.executeTransaction(async function () {
			let collections = item.getCollections();
			attachment.parentItemID = null
			attachment.setCollections(collections);
			await attachment.save();
			
			await item.erase();
		}.bind(this));
	};
	
	
	this.report = async function (item) {
		var attachment = Zotero.Items.get(item.getAttachments()[0]);
		var filePath = attachment.getFilePath();
		if (!filePath || !await OS.File.exists(filePath)) {
			throw new Error("File not found when reporting metadata");
		}
		
		var version = Zotero.version;
		var json = await extractJSON(filePath, MAX_PAGES);
		var metadata = item.toJSON();
		
		var data = { version, json, metadata };
		var uri = ZOTERO_CONFIG.RECOGNIZE_URL + 'report';
		return Zotero.HTTP.request(
			"POST",
			uri,
			{
				successCodes: [200, 204],
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			}
		);
	};
	
	
	/**
	 * Add item for processing
	 * @param item
	 * @return {null}
	 */
	function _addItem(item) {
		for (let row of _rows) {
			if (row.id === item.id) {
				if (row.status > Zotero.RecognizePDF.ROW_PROCESSING) {
					_deleteRow(row.id);
					break;
				}
				return null;
			}
		}
		
		let row = {
			id: item.id,
			status: Zotero.RecognizePDF.ROW_QUEUED,
			fileName: item.getField('title'),
			message: ''
		};
		
		_rows.unshift(row);
		_queue.unshift(item.id);
		
		if (_listeners['rowadded']) {
			_listeners['rowadded'](row);
		}
		
		if (_listeners['nonempty'] && _rows.length === 1) {
			_listeners['nonempty']();
		}
	}
	
	/**
	 * Update row status and message
	 * @param itemID
	 * @param status
	 * @param message
	 */
	function _updateRow(itemID, status, message) {
		for (let row of _rows) {
			if (row.id === itemID) {
				row.status = status;
				row.message = message;
				if (_listeners['rowupdated']) {
					_listeners['rowupdated']({
						id: row.id,
						status,
						message: message || ''
					});
				}
				return;
			}
		}
	}
	
	/**
	 * Delete row
	 * @param itemID
	 */
	function _deleteRow(itemID) {
		for (let i = 0; i < _rows.length; i++) {
			let row = _rows[i];
			if (row.id === itemID) {
				_rows.splice(i, 1);
				if (_listeners['rowdeleted']) {
					_listeners['rowdeleted']({
						id: row.id
					});
				}
				return;
			}
		}
	}
	
	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async function _processQueue() {
		await Zotero.Schema.schemaUpdatePromise;
		
		if (_queueProcessing) return;
		_queueProcessing = true;
		
		while (1) {
			if (Zotero.HTTP.browserIsOffline()) {
				await Zotero.Promise.delay(OFFLINE_RECHECK_DELAY);
				continue;
			}
			
			let itemID = _queue.shift();
			if (!itemID) break;
			
			_updateRow(itemID, Zotero.RecognizePDF.ROW_PROCESSING, Zotero.getString('general.processing'));
			
			try {
				let newItem = await _processItem(itemID);
				
				if (newItem) {
					_updateRow(itemID, Zotero.RecognizePDF.ROW_SUCCEEDED, newItem.getField('title'));
				}
				else {
					_updateRow(itemID, Zotero.RecognizePDF.ROW_FAILED, Zotero.getString('recognizePDF.noMatches'));
				}
			}
			catch (e) {
				Zotero.logError(e);
				
				_updateRow(
					itemID,
					Zotero.RecognizePDF.ROW_FAILED,
					e instanceof Zotero.Exception.Alert
						? e.message
						: Zotero.getString('recognizePDF.error')
				);
			}
		}
		
		_queueProcessing = false;
	}
	
	/**
	 * Processes the item and places it as a children of the new item
	 * @param itemID
	 * @return {Promise}
	 */
	async function _processItem(itemID) {
		let attachment = await Zotero.Items.getAsync(itemID);
		
		if (!attachment || attachment.parentItemID) {
			throw new Zotero.Exception.Alert('recognizePDF.error');
		}
		
		var zp = Zotero.getActiveZoteroPane();
		var selectParent = false;
		if (zp) {
			let selected = zp.getSelectedItems();
			if (selected.length) {
				// If only the PDF was selected, select the parent when we're done
				selectParent = selected.length == 1 && selected[0] == attachment;
			}
		}
		
		let parentItem = await _recognize(attachment);
		if (!parentItem) {
			return null;
		}
		
		// Put new item in same collections as the old one
		let collections = attachment.getCollections();
		await Zotero.DB.executeTransaction(async function () {
			if (collections.length) {
				for (let collectionID of collections) {
					parentItem.addToCollection(collectionID);
				}
				await parentItem.save();
			}
			
			// Put old item as a child of the new item
			attachment.parentID = parentItem.id;
			await attachment.save();
		});
		
		var originalTitle = attachment.getField('title');
		var path = attachment.getFilePath();
		var originalFilename = OS.Path.basename(path);
		
		// Rename attachment file to match new metadata
		if (Zotero.Prefs.get('autoRenameFiles')) {
			let ext = Zotero.File.getExtension(path);
			let fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentItem);
			let newName = fileBaseName + (ext ? '.' + ext : '');
			let result = await attachment.renameAttachmentFile(newName, false, true);
			if (result !== true) {
				throw new Error("Error renaming " + path);
			}
			// Rename attachment title
			attachment.setField('title', newName);
			await attachment.saveTx();
		}
		
		try {
			zp = Zotero.getActiveZoteroPane();
			if (zp) {
				if (selectParent) {
					await zp.selectItem(parentItem.id);
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		_newItems.set(
			parentItem,
			{
				originalTitle,
				originalFilename,
				dateModified: parentItem.dateModified
			}
		);
		return parentItem;
	}
	
	/**
	 * Get json from a PDF
	 * @param {String} filePath PDF file path
	 * @param {Number} pages Number of pages to extract
	 * @return {Promise}
	 */
	async function extractJSON(filePath, pages) {
		let cacheFile = Zotero.getTempDirectory();
		cacheFile.append("recognizePDFcache.txt");
		if (cacheFile.exists()) {
			cacheFile.remove(false);
		}
		
		let {exec, args} = Zotero.Fulltext.getPDFConverterExecAndArgs();
		args.push('-json', '-l', pages, filePath, cacheFile.path);
		
		Zotero.debug("RecognizePDF: Running " + exec.path + " " + args.map(arg => "'" + arg + "'").join(" "));
		
		try {
			await Zotero.Utilities.Internal.exec(exec, args);
			let content = await Zotero.File.getContentsAsync(cacheFile.path);
			Zotero.debug("RecognizePDF: Extracted JSON:");
			Zotero.debug(content);
			cacheFile.remove(false);
			return JSON.parse(content);
		}
		catch (e) {
			Zotero.logError(e);
			try {
				cacheFile.remove(false);
			} catch(e) {
				Zotero.logError(e);
			}
			throw new Zotero.Exception.Alert("recognizePDF.couldNotRead");
		}
	}
	
	/**
	 * Attach appropriate handlers to a Zotero.Translate instance and begin translation
	 * @return {Promise}
	 */
	async function _promiseTranslate(translate, libraryID) {
		translate.setHandler('select', function (translate, items, callback) {
			for (let i in items) {
				let obj = {};
				obj[i] = items[i];
				callback(obj);
				return;
			}
		});
		
		let newItems = await translate.translate({
			libraryID,
			saveAttachments: false
		});
		if (newItems.length) {
			return newItems[0];
		}
		throw new Error('No items found');
	}
	
	async function _query(json) {
		// TODO: Use main API URL for recognizer server
		//let uri = Zotero.Prefs.get("api.url") || ZOTERO_CONFIG.API_URL;
		let uri = Zotero.Prefs.get("api.url") || ZOTERO_CONFIG.RECOGNIZE_URL;
		
		if (!uri.endsWith('/')) {
			uri += '/';
		}
		
		uri += 'recognize';
		
		let client = Zotero.Sync.Runner.getAPIClient();
		
		let req = await client.makeRequest(
			'POST',
			uri,
			{
				successCodes: [200],
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(json),
				noAPIKey: true
			}
		);
		
		return JSON.parse(req.responseText);
	}
	
	/**
	 * Retrieves metadata for a PDF and saves it as an item
	 * @param {Zotero.Item} item
	 * @return {Promise}
	 */
	async function _recognize(item) {
		let filePath = await item.getFilePath();
		
		if (!filePath || !await OS.File.exists(filePath)) throw new Zotero.Exception.Alert('recognizePDF.fileNotFound');

		let json = await extractJSON(filePath, MAX_PAGES);
		
		let containingTextPages = 0;
		
		for(let page of json.pages) {
			if(page[2].length) {
				containingTextPages++;
			}
		}
		
		if(!containingTextPages) {
			throw new Zotero.Exception.Alert('recognizePDF.noOCR');
		}
		
		let libraryID = item.libraryID;
		
		let res = await _query(json);
		if (!res) return null;
		
		if (res.doi) {
			Zotero.debug('RecognizePDF: Getting metadata by DOI');
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier({
				DOI: res.doi
			});
			let translators = await translate.getTranslators();
			translate.setTranslator(translators);
			
			try {
				let newItem = await _promiseTranslate(translate, libraryID);
				if (!newItem.abstractNote && res.abstract) {
					newItem.setField('abstractNote', res.abstract);
				}
				if (!newItem.language && res.language) {
					newItem.setField('language', res.language);
				}
				newItem.saveTx();
				return newItem;
			}
			catch (e) {
				Zotero.debug('RecognizePDF: ' + e);
			}
		}
		
		if (res.isbn) {
			Zotero.debug('RecognizePDF: Getting metadata by ISBN');
			let translate = new Zotero.Translate.Search();
			translate.setSearch({'itemType': 'book', 'ISBN': res.isbn});
			try {
				let translatedItems = await translate.translate({
					libraryID: false,
					saveAttachments: false
				});
				Zotero.debug('RecognizePDF: Translated items:');
				Zotero.debug(translatedItems);
				if (translatedItems.length) {
					let newItem = new Zotero.Item;
					newItem.libraryID = libraryID;
					// Convert tags to automatic. For other items this is done automatically in
					// translate.js for other items, but for ISBNs we just get the data
					// (libraryID=false) and do the saving manually.
					translatedItems[0].tags = translatedItems[0].tags.map(tag => {
						if (typeof tag == 'string') {
							return {
								tag,
								type: 1
							};
						}
						tag.type = 1;
						return tag;
					});
					newItem.fromJSON(translatedItems[0]);
					if (!newItem.abstractNote && res.abstract) {
						newItem.setField('abstractNote', res.abstract);
					}
					if (!newItem.language && res.language) {
						newItem.setField('language', res.language);
					}
					newItem.saveTx();
					return newItem;
				}
			}
			catch (e) {
				Zotero.debug('RecognizePDF: ' + e);
			}
		}
		
		if (res.title) {
			let type = 'journalArticle';
			
			if (res.type === 'book-chapter') {
				type = 'bookSection';
			}
			
			let newItem = new Zotero.Item(type);
			newItem.libraryID = libraryID;
			newItem.setField('title', res.title);
			
			let creators = [];
			for (let author of res.authors) {
				creators.push({
					firstName: author.firstName,
					lastName: author.lastName,
					creatorType: 'author'
				})
			}
			
			newItem.setCreators(creators);
			
			if (res.abstract) newItem.setField('abstractNote', res.abstract);
			if (res.year) newItem.setField('date', res.year);
			if (res.pages) newItem.setField('pages', res.pages);
			if (res.volume) newItem.setField('volume', res.volume);
			if (res.url) newItem.setField('url', res.url);
			if (res.language) newItem.setField('language', res.language);
			
			if (type === 'journalArticle') {
				if (res.issue) newItem.setField('issue', res.issue);
				if (res.ISSN) newItem.setField('issn', res.issn);
				if (res.container) newItem.setField('publicationTitle', res.container);
			}
			else if (type === 'bookSection') {
				if (res.container) newItem.setField('bookTitle', res.container);
				if (res.publisher) newItem.setField('publisher', res.publisher);
			}
			
			newItem.setField('libraryCatalog', 'Zotero');
			
			await newItem.saveTx();
			return newItem;
		}
		
		return null;
	}
};

