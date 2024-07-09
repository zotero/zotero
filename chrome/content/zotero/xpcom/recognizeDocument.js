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

Zotero.RecognizeDocument = new function () {
	const OFFLINE_RECHECK_DELAY = 60 * 1000;
	const MAX_PAGES = 5;
	const UNRECOGNIZE_TIMEOUT = 86400 * 1000;
	const NOTE_EDIT_THRESHOLD = 1000;
	const EPUB_MAX_SECTIONS = 5;
	
	let _newItems = new WeakMap();
	
	let _queue = [];
	let _queueProcessing = false;
	let _processingItemID = null;
	
	let _progressQueue = Zotero.ProgressQueues.create({
		id: 'recognize',
		title: 'recognizePDF.title',
		columns: [
			'recognizePDF.attachmentName.label',
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
	 * Checks whether a given attachment could theoretically be recognized
	 * @param {Zotero.Item} item
	 * @return {Boolean} True if the PDF can be recognized, false if it cannot be
	 */
	this.canRecognize = function (item) {
		return item.attachmentContentType
			&& (item.isPDFAttachment() || item.isEPUBAttachment())
			&& item.isTopLevelItem();
	};
	
	
	this.autoRecognizeItems = async function (items) {
		if (!Zotero.Prefs.get('autoRecognizeFiles')) return;
		
		var docs = items.filter((item) => {
			return item && this.canRecognize(item);
		});
		if (!docs.length) {
			return;
		}
		var queue = Zotero.ProgressQueues.get('recognize');
		var dialog = queue.getDialog();
		var numInQueue = queue.getTotal();
		var promise = this.recognizeItems(docs);
		// If the queue wasn't empty or more than one file is being saved, show the dialog
		if (numInQueue > 0 || docs.length > 1) {
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
				|| item.numAttachments(true) != 1) {
			_newItems.delete(item);
			return false;
		}
		
		// Child attachment must be not be in trash and must be a PDF or EPUB
		var attachments = Zotero.Items.get(item.getAttachments());
		if (!attachments.length || (!attachments[0].isPDFAttachment() && !attachments[0].isEPUBAttachment())) {
			_newItems.delete(item);
			return false;
		}
		
		// Notes must have been modified within one second of the item
		var notes = Zotero.Items.get(item.getNotes());
		if (notes.some(note => note.dateModified > dateModified + NOTE_EDIT_THRESHOLD)) {
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
				await attachment.renameAttachmentFile(originalFilename);
			}
			attachment.setField('title', originalTitle);
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
		var json = await extractPDFJSON(attachment.id);
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
				// If only the attachment was selected, select the parent when we're done
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
		var originalFilename = PathUtils.filename(path);
		
		// Rename attachment file to match new metadata
		if (Zotero.Attachments.shouldAutoRenameFile(attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE)) {
			let ext = Zotero.File.getExtension(path);
			let fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentItem);
			let newName = fileBaseName + (ext ? '.' + ext : '');
			let result = await attachment.renameAttachmentFile(newName, false, true);
			if (result !== true) {
				throw new Error("Error renaming " + path);
			}
		}
		
		// Rename attachment title
		attachment.setAutoAttachmentTitle();
		await attachment.saveTx();

		try {
			let win = Zotero.getMainWindow();
			if (selectParent && win && win.Zotero_Tabs.selectedID == 'zotero-pane') {
				await win.ZoteroPane.selectItem(parentItem.id);
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
	 * Get recognizer data from PDF file
	 * @param {Number} itemID Attachment item id
	 * @return {Promise}
	 */
	async function extractPDFJSON(itemID) {
		try {
			return await Zotero.PDFWorker.getRecognizerData(itemID, true);
		}
		catch (e) {
			Zotero.logError(e);
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
	 * Retrieves metadata for a PDF or EPUB and saves it as an item
	 * @param {Zotero.Item} item
	 * @return {Promise<Zotero.Item>} - New item
	 */
	async function _recognize(item) {
		if (Zotero.RecognizeDocument.recognizeStub) {
			return Zotero.RecognizeDocument.recognizeStub(item);
		}
		
		let filePath = await item.getFilePath();
		
		if (!filePath || !await OS.File.exists(filePath)) throw new Zotero.Exception.Alert('recognizePDF.fileNotFound');

		if (item.isPDFAttachment()) {
			return _recognizePDF(item, filePath);
		}
		else if (item.isEPUBAttachment()) {
			return _recognizeEPUB(item, filePath);
		}
		else {
			throw new Error('Item must be PDF or EPUB');
		}
	}
	
	async function _recognizePDF(item, filePath) {
		let json = await extractPDFJSON(item.id);
		json.fileName = PathUtils.filename(filePath);
		
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
			Zotero.debug(`RecognizeDocument: Getting metadata for arXiv ID ${res.arxiv}`);
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
				Zotero.debug('RecognizeDocument: ' + e);
			}
		}
		
		if (res.doi) {
			Zotero.debug(`RecognizeDocument: Getting metadata for DOI (${res.doi})`);
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
					Zotero.debug('RecognizeDocument: ' + e);
				}
			}
			else {
				Zotero.debug("RecognizeDocument: No translators found");
			}
		}
		
		if (res.isbn) {
			Zotero.debug(`RecognizeDocument: Getting metadata by ISBN ${res.isbn}`);
			let translate = new Zotero.Translate.Search();
			translate.setSearch({'itemType': 'book', 'ISBN': res.isbn});
			try {
				let translatedItems = await translate.translate({
					libraryID: false,
					saveAttachments: false
				});
				Zotero.debug('RecognizeDocument: Translated items:');
				Zotero.debug(translatedItems);
				if (translatedItems.length) {
					let newItem = new Zotero.Item;
					newItem.libraryID = libraryID;
					// Convert tags to automatic. For other items this is done automatically in
					// translate.js, but for ISBNs we just get the data (libraryID=false) and do the
					// saving manually.
					if (Zotero.Prefs.get('automaticTags')) {
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
					}
					else {
						translatedItems[0].tags = [];
					}
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
				Zotero.debug('RecognizeDocument: ' + e);
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
	
	async function _recognizeEPUB(item, filePath) {
		const { EPUB } = ChromeUtils.import('chrome://zotero/content/EPUB.jsm');
		
		let epub = new EPUB(filePath);
		try {
			let search = {};

			let rdfItemJSON = await _translateEPUBMetadata(epub);
			if (rdfItemJSON && rdfItemJSON.ISBN) {
				let clean = rdfItemJSON.ISBN.split(' ')
					.map(isbn => Zotero.Utilities.cleanISBN(isbn))
					.filter(Boolean);
				if (clean.length) {
					Zotero.debug('RecognizeEPUB: Found ISBN in RDF metadata');
					search.ISBN = clean.join(' ');
				}
			}

			for await (let doc of _getFirstSectionDocuments(epub)) {
				if (search.DOI && search.ISBN) break;
				if (!search.DOI) {
					let dois = _getDOIsFromDocument(doc);
					if (dois.length) {
						Zotero.debug('RecognizeEPUB: Found DOI in section document');
						search.DOI = dois[0];
					}
				}
				if (!search.ISBN) {
					let isbn = _getISBNFromDocument(doc);
					if (isbn) {
						Zotero.debug('RecognizeEPUB: Found ISBN in section document');
						search.ISBN = isbn;
					}
				}
			}

			let itemJSON;
			if (search.ISBN || search.DOI) {
				try {
					Zotero.debug('RecognizeEPUB: Searching by ' + Object.keys(search)
						.join(', '));
					let translate = new Zotero.Translate.Search();
					translate.setSearch(search);
					let [searchItemJSON] = await translate.translate({
						libraryID: false,
						saveAttachments: false
					});
					if (searchItemJSON) {
						if (search.ISBN && searchItemJSON?.ISBN?.split(' ')
								.map(resolvedISBN => Zotero.Utilities.cleanISBN(resolvedISBN))
								.includes(search.ISBN)) {
							Zotero.debug('RecognizeDocument: Using ISBN search result');
							itemJSON = searchItemJSON;
						}
						else {
							Zotero.debug(`RecognizeDocument: ISBN mismatch (was ${search.ISBN}, got ${searchItemJSON.ISBN})`);
						}
					}
				}
				catch (e) {
					Zotero.debug('RecognizeDocument: Error while resolving ISBN: ' + e);
				}
			}
			if (!itemJSON) {
				Zotero.debug('RecognizeEPUB: Falling back to RDF metadata');
				itemJSON = rdfItemJSON;
			}
			if (!itemJSON) {
				throw new Zotero.Exception.Alert("recognizePDF.couldNotRead");
			}

			if (Zotero.Prefs.get('automaticTags')) {
				itemJSON.tags = itemJSON.tags.map((tag) => {
					if (typeof tag == 'string') {
						return {
							tag,
							type: 1
						};
					}
					tag.type = 1;
					return tag;
				});
			}
			else {
				itemJSON.tags = [];
			}

			let translatedItem = new Zotero.Item();
			translatedItem.libraryID = item.libraryID;
			translatedItem.fromJSON(itemJSON);
			await translatedItem.saveTx();
			return translatedItem;
		}
		finally {
			epub.close();
		}
	}
	
	async function _translateEPUBMetadata(epub) {
		let metadata = await epub.getMetadataRDF();
		if (!metadata) {
			return null;
		}

		let translate = new Zotero.Translate.Import();
		translate.setTranslator(Zotero.Translators.TRANSLATOR_ID_RDF);
		translate.setString(metadata);

		try {
			let [itemJSON] = await translate.translate({
				libraryID: false,
				saveAttachments: false
			});
			return itemJSON;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}
	
	async function* _getFirstSectionDocuments(epub) {
		let copyrightDoc = await epub.getDocumentByReferenceType('copyright-page');
		if (copyrightDoc) {
			yield copyrightDoc;
		}
		let i = 0;
		for await (let { doc: sectionDoc } of epub.getSectionDocuments()) {
			yield sectionDoc;
			if (++i >= EPUB_MAX_SECTIONS) {
				break;
			}
		}
	}
	
	function _getDOIsFromDocument(doc) {
		// Copied from DOI translator
		
		const DOIre = /\b10\.[0-9]{4,}\/[^\s&"']*[^\s&"'.,]/g;
		var dois = new Set();

		var m, DOI;
		var treeWalker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
		var ignore = ['script', 'style'];
		while (treeWalker.nextNode()) {
			if (ignore.includes(treeWalker.currentNode.parentNode.tagName.toLowerCase())) continue;
			DOIre.lastIndex = 0;
			while ((m = DOIre.exec(treeWalker.currentNode.nodeValue))) {
				DOI = m[0];
				if (DOI.endsWith(")") && !DOI.includes("(")) {
					DOI = DOI.substring(0, DOI.length - 1);
				}
				if (DOI.endsWith("}") && !DOI.includes("{")) {
					DOI = DOI.substring(0, DOI.length - 1);
				}
				dois.add(DOI);
			}
		}

		var links = doc.querySelectorAll('a[href]');
		for (let link of links) {
			DOIre.lastIndex = 0;
			let m = DOIre.exec(link.href);
			if (m) {
				let doi = m[0];
				if (doi.endsWith(")") && !doi.includes("(")) {
					doi = doi.substring(0, doi.length - 1);
				}
				if (doi.endsWith("}") && !doi.includes("{")) {
					doi = doi.substring(0, doi.length - 1);
				}
				// only add new DOIs
				if (!dois.has(doi) && !dois.has(doi.replace(/#.*/, ''))) {
					dois.add(doi);
				}
			}
		}

		return Array.from(dois);
	}
	
	function _getISBNFromDocument(doc) {
		if (!doc.body) {
			return null;
		}
		return Zotero.Utilities.cleanISBN(doc.body.innerText) || null;
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

