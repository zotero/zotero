class NoteEditor {
	constructor() {
		this.instanceID = Zotero.Utilities.randomString();
		Zotero.Notes.editorInstances.push(this);
		Zotero.debug('Creating a new editor instance');
	}

	async init(options) {
		this.id = options.item.id;

		this.item = options.item;
		// this._onNavigate = options.onNavigate;
		this.saveOnEdit = true;
		this.state = options.state;
		this.citations = [];
		this.disableSaving = false;
		this._readOnly = options.readOnly;
		this.window = options.window;

		await this.waitForEditor();
		// Zotero.Notes.updateURIs(h1);

		// Run Cut/Copy/Paste with chrome privileges
		this.window.wrappedJSObject.zoteroExecCommand = function (doc, command, ui, value) {
			// Is that safe enough?
			if (!['cut', 'copy', 'paste'].includes(command)) {
				return;
			}
			return doc.execCommand(command, ui, value);
		}

		this.window.addEventListener('message', this.listener);
		this.quickFormatWindow = null;
		let data = this.state ? { state: this.state } : { html: this.item.note };
		this.postMessage({
			op: 'init', ...data,
			libraryId: this.item.libraryID,
			key: this.item.key,
			readOnly: this._readOnly
		});
	}

	uninit() {
		this.window.removeEventListener('message', this.listener);
		let index = Zotero.Notes.editorInstances.indexOf(this);
		if (index >= 0) {
			Zotero.Notes.editorInstances.splice(index, 1);
		}
	}

	async waitForEditor() {
		let n = 0;
		while (!this.window) {
			if (n >= 1000) {
				throw new Error('Waiting for editor failed ');
			}
			await Zotero.Promise.delay(10);
			n++;
		}
	}

	postMessage(message) {
		this.window.postMessage({ instanceId: this.instanceID, message }, '*');
	}

	listener = async (e) => {
		if (e.data.instanceId !== this.instanceID) {
			return;
		}
		// Zotero.debug('Message received from editor ' + e.data.instanceId + ' ' + this.instanceID + ' ' + e.data.message.op);

		let message = e.data.message;

		if (message.op === 'getItemData') {
			let parent = message.parent;
			let item = await Zotero.Items.getAsync(message.itemId);
			if (parent && item && item.parentID) {
				item = await Zotero.Items.getAsync(item.parentID);
			}
			if (item) {
				let data = {
					uri: Zotero.URI.getItemURI(item),
					backupText: this.getBackupStr(item)
				};
			}
		}
		else if (message.op === 'insertObject') {
			let { type, data, pos } = message;

			if (type === 'zotero/item') {
				let ids = data.split(',').map(id => parseInt(id));
				let citations = [];
				for (let id of ids) {
					let item = await Zotero.Items.getAsync(id);
					if (!item) {
						continue;
					}
					citations.push({
						citationItems: [{
							uri: Zotero.URI.getItemURI(item),
							backupText: this.getBackupStr(item)
						}],
						properties: {}
					});
				}
				this.postMessage({ op: 'insertCitations', citations, pos });
			}
			else if (type === 'zotero/annotation') {
				let annotations = JSON.parse(data);
				let list = [];
				for (let annotation of annotations) {
					let attachmentItem = await Zotero.Items.getAsync(annotation.itemId);
					if (!attachmentItem) {
						continue;
					}
					let citationItem = attachmentItem.parentID && await Zotero.Items.getAsync(attachmentItem.parentID) || attachmentItem;
					annotation.uri = Zotero.URI.getItemURI(attachmentItem);
					let citation = {
						citationItems: [{
							uri: Zotero.URI.getItemURI(citationItem),
							backupText: this.getBackupStr(citationItem),
							locator: annotation.pageLabel
						}],
						properties: {}
					};
					list.push({ annotation, citation });
				}
				this.postMessage({ op: 'insertAnnotationsAndCitations', list, pos });
			}
		}
		else if (message.op === 'navigate') {
			if (this._onNavigate) {
				this._onNavigate(message.uri, { position: message.position });
			}
			else {
				await Zotero.Viewer.openURI(message.uri, { position: message.position });
			}
		}
		else if (message.op === 'openURL') {
			var zp = typeof ZoteroPane !== 'undefined' ? ZoteroPane : window.opener.ZoteroPane;
			zp.loadURI(message.url);
		}
		else if (message.op === 'showInLibrary') {
			let zp = Zotero.getActiveZoteroPane();
			if (zp) {
				let item = await Zotero.URI.getURIItem(message.itemURI);
				if (item) {
					zp.selectItems([item.id]);
					let win = Zotero.getMainWindow();
					if (win) {
						win.focus();
					}
				}
			}
		}
		else if (message.op === 'update') {
			this.save(message.noteData);
		}
		else if (message.op === 'getFormattedCitations') {
			let formattedCitations = await this.getFormattedCitations(message.citations);
			for (let newCitation of message.citations) {
				if (!this.citations.find(citation => citation.id === newCitation.id)) {
					this.citations.push(newCitation);
				}
			}
			this.postMessage({
				op: 'setFormattedCitations',
				formattedCitations
			});
		}
		else if (message.op === 'quickFormat') {
			let id = message.id;
			let citation = message.citation;
			citation = JSON.parse(JSON.stringify(citation));
			let availableCitationItems = [];
			for (let citationItem of citation.citationItems) {
				let item = await Zotero.URI.getURIItem(citationItem.uri);
				if (item) {
					availableCitationItems.push({ ...citationItem, id: item.id });
				}
			}
			citation.citationItems = availableCitationItems;
			let libraryID = this.item.libraryID;
			this.quickFormatDialog(id, citation, [libraryID]);
		}
		else if (message.op === 'updateImages') {
			for (let image of message.added) {
				let blob = this.dataURLtoBlob(image.dataUrl);
				let imageAttachment = await Zotero.Attachments.importEmbeddedImage({
					blob,
					parentItemID: this.item.id,
					itemKey: image.attachmentKey,
					saveOptions: {
						notifierData: {
							noteEditorID: this.instanceID
						}
					}
				});
			}
			let attachmentItems = this.item.getAttachments().map(id => Zotero.Items.get(id));
			let abandonedItems = attachmentItems.filter(item => !message.all.includes(item.key));
			for (let item of abandonedItems) {
				await item.eraseTx();
			}
		}
		else if (message.op === 'requestImage') {
			let { attachmentKey } = message;
			var item = Zotero.Items.getByLibraryAndKey(this.item.libraryID, attachmentKey);
			if (!item) return;
			let path = await item.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;
			let dataURL = 'data:' + item.attachmentContentType + ';base64,' + this.arrayBufferToBase64(buf);
			this.postMessage({
				op: 'updateImage',
				attachmentKey,
				dataUrl: dataURL
			});
		}
		else if (message.op === 'popup') {
			this.openPopup(message.x, message.y, message.items);
		}
	}

	openPopup(x, y, items) {
		let popup = document.getElementById('editor-menu');
		popup.hidePopup();

		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}

		for (let item of items) {
			let menuitem = document.createElement('menuitem');
			menuitem.setAttribute('value', item[0]);
			menuitem.setAttribute('label', item[1]);
			menuitem.addEventListener('command', () => {
				this.postMessage({
					op: 'contextMenuAction',
					ctxAction: item[0],
					payload: item.payload
				});
			});
			popup.appendChild(menuitem);
		}

		popup.openPopupAtScreen(x, y, true);
	}

	async save(noteData) {
		if (!noteData) return;
		let { state, html } = noteData;
		if (html === undefined) return;
		try {
			if (this.disableSaving) {
				Zotero.debug('Saving is disabled');
				return;
			}

			if (this._readOnly) {
				Zotero.debug('Not saving read-only note');
				return;
			}
			if (html === null) {
				Zotero.debug('Note value not available -- not saving', 2);
				return;
			}
			// Update note
			if (this.item) {
				let changed = this.item.setNote(html);
				if (changed && this.saveOnEdit) {
					// this.noteField.changed = false;
					await this.item.saveTx({
						notifierData: {
							noteEditorID: this.instanceID,
							state
						}
					});
				}
			}
			else {
				// Create a new note
				var item = new Zotero.Item('note');
				if (this.parentItem) {
					item.libraryID = this.parentItem.libraryID;
				}
				item.setNote(html);
				if (this.parentItem) {
					item.parentKey = this.parentItem.key;
				}
				if (this.saveOnEdit) {
					var id = await item.saveTx();

					if (!this.parentItem && this.collection) {
						this.collection.addItem(id);
					}
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
			if (this.hasAttribute('onerror')) {
				let fn = new Function('', this.getAttribute('onerror'));
				fn.call(this)
			}
			if (this.onError) {
				this.onError(e);
			}
		}
	}

	focus = () => {

	}

	getNoteDataSync = () => {
		if (!this._readOnly && !this.disableSaving && this.window) {
			return this.window.wrappedJSObject.getDataSync();
		}
		return null;
	};

	/**
	 * Builds the string to go inside a bubble
	 */
	_buildBubbleString(citationItem, str) {
		// Locator
		if (citationItem.locator) {
			if (citationItem.label) {
				// TODO localize and use short forms
				var label = citationItem.label;
			}
			else if (/[\-–,]/.test(citationItem.locator)) {
				var label = 'pp.';
			}
			else {
				var label = 'p.';
			}

			str += ', ' + label + ' ' + citationItem.locator;
		}

		// Prefix
		if (citationItem.prefix && Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP) {
			str = citationItem.prefix
				+ (Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP.test(citationItem.prefix) ? ' ' : '')
				+ str;
		}

		// Suffix
		if (citationItem.suffix && Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP) {
			str += (Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP.test(citationItem.suffix) ? ' ' : '')
				+ citationItem.suffix;
		}

		return str;
	}

	async updateCitationsForURIs(uris) {
		let citations = this.citations
		.filter(citation => citation.citationItems
		.some(citationItem => uris.includes(citationItem.uri)));

		if (citations.length) {
			let formattedCitations = await this.getFormattedCitations(citations);
			this.postMessage({
				op: 'setFormattedCitations',
				formattedCitations
			});
		}
	}

	getFormattedCitations = async (citations) => {
		let formattedCitations = {};
		for (let citation of citations) {
			formattedCitations[citation.id] = await this.getFormattedCitation(citation);
		}
		return formattedCitations;
	}

	getFormattedCitation = async (citation) => {
		let formattedItems = [];
		for (let citationItem of citation.citationItems) {
			let item = await Zotero.URI.getURIItem(citationItem.uri);
			if (item && !item.deleted) {
				formattedItems.push(this._buildBubbleString(citationItem, this.getBackupStr(item)));
			}
			else {
				let formattedItem = this._buildBubbleString(citationItem, citationItem.backupText);
				formattedItem = `<span style="color: red;">${formattedItem}</span>`;
				formattedItems.push(formattedItem);
			}
		}
		return formattedItems.join(';');
	}

	getBackupStr(item) {
		var str = item.getField('firstCreator');

		// Title, if no creator (getDisplayTitle in order to get case, e-mail, statute which don't have a title field)
		if (!str) {
			str = Zotero.getString('punctuation.openingQMark') + item.getDisplayTitle() + Zotero.getString('punctuation.closingQMark');
		}

		// Date
		var date = item.getField('date', true, true);
		if (date && (date = date.substr(0, 4)) !== '0000') {
			str += ', ' + date;
		}
		return str;
	}

	arrayBufferToBase64(buffer) {
		var binary = '';
		var bytes = new Uint8Array(buffer);
		var len = bytes.byteLength;
		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return self.btoa(binary);
	}

	dataURLtoBlob(dataurl) {
		let parts = dataurl.split(',');
		let mime = parts[0].match(/:(.*?);/)[1];
		if (parts[0].indexOf('base64') !== -1) {
			let bstr = atob(parts[1]);
			let n = bstr.length;
			let u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}

			return new self.Blob([u8arr], { type: mime });
		}
		return null;
	}

	quickFormatDialog(id, citationData, filterLibraryIDs) {
		let that = this;
		let win;
		/**
		 * Citation editing functions and propertiesaccessible to quickFormat.js and addCitationDialog.js
		 */
		let CI = function (citation, sortable, fieldIndexPromise, citationsByItemIDPromise, previewFn) {
			this.citation = citation;
			this.sortable = sortable;
			this.filterLibraryIDs = filterLibraryIDs;
			this.disableClassicDialog = true;
		}

		CI.prototype = {
			/**
			 * Execute a callback with a preview of the given citation
			 * @return {Promise} A promise resolved with the previewed citation string
			 */
			preview: function () {
				Zotero.debug('CI: preview')
			},

			/**
			 * Sort the citationItems within citation (depends on this.citation.properties.unsorted)
			 * @return {Promise} A promise resolved with the previewed citation string
			 */
			sort: function () {
				Zotero.debug('CI: sort')
				return async function () {
				};
			},

			/**
			 * Accept changes to the citation
			 * @param {Function} [progressCallback] A callback to be run when progress has changed.
			 *     Receives a number from 0 to 100 indicating current status.
			 */
			accept: async function (progressCallback) {
				Zotero.debug('CI: accept');
				if (progressCallback) progressCallback(100);

				if (win) {
					win.close();
				}

				let citation = {
					citationItems: this.citation.citationItems,
					properties: this.citation.properties
				}

				for (let citationItem of citation.citationItems) {
					let itm = await Zotero.Items.getAsync(citationItem.id);
					delete citationItem.id;
					citationItem.uri = Zotero.URI.getItemURI(itm);
					citationItem.backupText = that.getBackupStr(itm);
				}

				let formattedCitation = await that.getFormattedCitation(citation);

				if (this.citation.citationItems.length) {
					that.postMessage({
						op: 'setCitation',
						id, citation, formattedCitation
					});
				}
			},

			/**
			 * Get a list of items used in the current document
			 * @return {Promise} A promise resolved by the items
			 */
			getItems: async function () {
				Zotero.debug('CI: getItems')
				return [];
			}
		}


		let Citation = class {
			constructor(citationField, data, noteIndex) {
				if (!data) {
					data = { citationItems: [], properties: {} };
				}
				this.citationID = data.citationID;
				this.citationItems = data.citationItems;
				this.properties = data.properties;
				this.properties.noteIndex = noteIndex;

				this._field = citationField;
			}

			/**
			 * Load citation item data
			 * @param {Boolean} [promptToReselect=true] - will throw a MissingItemException if false
			 * @returns {Promise{Number}}
			 * 	- Zotero.Integration.NO_ACTION
			 * 	- Zotero.Integration.UPDATE
			 * 	- Zotero.Integration.REMOVE_CODE
			 * 	- Zotero.Integration.DELETE
			 */
			loadItemData() {
				Zotero.debug('Citation: loadItemData');
			}

			async handleMissingItem(idx) {
				Zotero.debug('Citation: handleMissingItem');
			}

			async prepareForEditing() {
				Zotero.debug('Citation: prepareForEditing');
			}

			toJSON() {
				Zotero.debug('Citation: toJSON');
			}

			/**
			 * Serializes the citation into CSL code representation
			 * @returns {string}
			 */
			serialize() {
				Zotero.debug('Citation: serialize');
			}
		};

		if (that.quickFormatWindow) {
			that.quickFormatWindow.close();
			that.quickFormatWindow = null;
		}

		let citation = new Citation();
		citation.citationItems = citationData.citationItems;
		citation.properties = citationData.properties;
		let styleID = Zotero.Prefs.get('export.lastStyle');
		let locale = Zotero.Prefs.get('export.lastLocale');
		let csl = Zotero.Styles.get(styleID).getCiteProc(locale);
		var io = new CI(citation, csl.opt.sort_citations);


		var allOptions = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if (Zotero.isLinux) allOptions += ',dialog=no';
		// if(options) allOptions += ','+options;

		var mode = (!Zotero.isMac && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')
			? 'popup' : 'alwaysRaised') + ',resizable=false,centerscreen';

		win = that.quickFormatWindow = Components.classes['@mozilla.org/embedcomp/window-watcher;1']
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null, 'chrome://zotero/content/integration/quickFormat.xul', '', mode, {
			wrappedJSObject: io
		});
	}
}

Zotero.NoteEditor = NoteEditor;
