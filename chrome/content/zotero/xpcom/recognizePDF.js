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
	
	let _newItems = new WeakMap();
	
	let _queue = [];
	let _queueProcessing = false;
	let _processingItemID = null;
	
	let _progressQueue = Zotero.ProgressQueues.create({
		id: 'recognize',
		title: 'recognizePDF.title',
		columns: [
			'recognizePDF.pdfName.label',
			'recognizePDF.itemName.label'
		]
	});
	
	_progressQueue.addListener('cancel', function () {
		_queue = [];
	});
	
	this.recognizeStub = null;
	
	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async function _processQueue() {
		await Zotero.Schema.schemaUpdatePromise;
		
		if (_queueProcessing) return;
		_queueProcessing = true;
		
		while (1) {
			// While all current progress queue usages are related with
			// online APIs, check internet connectivity here
			if (Zotero.HTTP.browserIsOffline()) {
				await Zotero.Promise.delay(OFFLINE_RECHECK_DELAY);
				continue;
			}
			
			let itemID = _queue.pop();
			if (!itemID) break;
			
			_processingItemID = itemID;
			
			_progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_PROCESSING, Zotero.getString('general.processing'));
			
			try {
				let item = await Zotero.Items.getAsync(itemID);
				
				if (!item) {
					throw new Error();
				}
				
				let res = await _processItem(item);
				_progressQueue.updateRow(itemID, Zotero.ProgressQueue.ROW_SUCCEEDED, item.getField('title'));
			}
			catch (e) {
				Zotero.logError(e);
				
				_progressQueue.updateRow(
					itemID,
					Zotero.ProgressQueue.ROW_FAILED,
					e instanceof Zotero.Exception.Alert
						? e.message
						: Zotero.getString('general.error')
				);
			}
		}
		
		_queueProcessing = false;
		_processingItemID = null;
	}
	
	
	/**
	 * Adds items to the queue and triggers processing
	 * @param {Zotero.Item[]} items
	 */
	this.recognizeItems = async function (items) {
		for (let item of items) {
			if(
				_processingItemID === item.id ||
				_queue.includes(item.id) ||
				!this.canRecognize(item)
			) {
				continue;
			}
			_queue.unshift(item.id);
			_progressQueue.addRow(item);
		}
		await _processQueue();
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
	
	
	this.autoRecognizeItems = async function (items) {
		if (!Zotero.Prefs.get('autoRecognizeFiles')) return;
		
		var pdfs = items.filter((item) => {
			return item
				&& item.isFileAttachment()
				&& item.attachmentContentType == 'application/pdf';
		});
		if (!pdfs.length) {
			return;
		}
		var queue = Zotero.ProgressQueues.get('recognize');
		var dialog = queue.getDialog();
		var numInQueue = queue.getTotal();
		var promise = this.recognizeItems(pdfs);
		// If the queue wasn't empty or more than one file is being saved, show the dialog
		if (numInQueue > 0 || pdfs.length > 1) {
			dialog.open();
			return promise;
		}
		await promise;
		// If dialog wasn't opened automatically and wasn't opened manually, clear it after
		// recognizing files
		if (!dialog.isOpen()) {
			queue.cancel();
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
	
	
	this.report = async function (item, description) {
		var attachment = Zotero.Items.get(item.getAttachments()[0]);
		var filePath = attachment.getFilePath();
		if (!filePath || !await OS.File.exists(filePath)) {
			throw new Error("File not found when reporting metadata");
		}
		
		var version = Zotero.version;
		var json = await extractJSON(filePath, MAX_PAGES);
		var metadata = item.toJSON();
		
		var data = { description, version, json, metadata };
		var url = _getBaseURL() + 'report';
		return Zotero.HTTP.request(
			"POST",
			url,
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
	 * Processes the item and places it as a children of the new item
	 * @param itemID
	 * @return {Promise}
	 */
	async function _processItem(attachment) {
		// Make sure the attachment still doesn't have a parent
		if (attachment.parentItemID) {
			throw new Error('Already has parent');
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
			throw new Zotero.Exception.Alert("recognizePDF.noMatches");
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
		if (Zotero.Attachments.shouldAutoRenameFile(attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE)) {
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
			}
			catch (e) {
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
		var uri = _getBaseURL() + 'recognize';
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
	 * @return {Promise<Zotero.Item>} - New item
	 */
	async function _recognize(item) {
		if (Zotero.RecognizePDF.recognizeStub) {
			return Zotero.RecognizePDF.recognizeStub(item);
		}
		
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
		
		if (res.arxiv) {
			Zotero.debug(`RecognizePDF: Getting metadata for arXiv ID ${res.arxiv}`);
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier({arXiv: res.arxiv});
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
		
		if (res.doi) {
			Zotero.debug(`RecognizePDF: Getting metadata for DOI (${res.doi})`);
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier({
				DOI: res.doi
			});
			let translators = await translate.getTranslators();
			if (translators.length) {
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
			else {
				Zotero.debug("RecognizePDF: No translators found");
			}
		}
		
		if (res.isbn) {
			Zotero.debug(`RecognizePDF: Getting metadata by ISBN ${res.isbn}`);
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
	
	/**
	 * To customize the recognizer endpoint, set either recognize.url (used directly)
	 * or services.url (used with a 'recognizer/' suffix).
	 */
	function _getBaseURL() {
		var url = Zotero.Prefs.get("recognize.url");
		if (url) {
			if (!url.endsWith('/')) {
				url += '/';
			}
			return url;
		}
		url = Zotero.Prefs.get("services.url") || ZOTERO_CONFIG.SERVICES_URL;
		if (!url.endsWith('/')) {
			url += '/';
		}
		return url + "recognizer/";
	}
};

