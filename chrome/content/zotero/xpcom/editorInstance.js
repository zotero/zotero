/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
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

// When changing this update in `note-editor` as well.
// This only filters images that are being imported from a URL.
// In all other cases `note-editor` should decide what
// image types can be imported, and if not then
// Zotero.Attachments.importEmbeddedImage does.
// Additionally, the allready imported images should never be
// affected
const DOWNLOADED_IMAGE_TYPE = [
	'image/jpeg',
	'image/png'
];

// Schema version here has to be the same as in note-editor!
const SCHEMA_VERSION = 1;

class EditorInstance {
	constructor() {
		this.instanceID = Zotero.Utilities.randomString();
	}

	async init(options) {
		Zotero.Notes.registerEditorInstance(this);
		this.onNavigate = options.onNavigate;
		this._item = options.item;
		this._readOnly = options.readOnly;
		this._disableUI = options.disableUI;
		this._onReturn = options.onReturn;
		this._iframeWindow = options.iframeWindow;
		this._popup = options.popup;
		this._state = options.state;
		this._disableSaving = false;
		this._subscriptions = [];
		this._deletedImages = {};
		this._quickFormatWindow = null;
		this._isAttachment = this._item.isAttachment();
		this._prefObserverIDs = [
			Zotero.Prefs.registerObserver('note.fontSize', this._handleFontChange),
			Zotero.Prefs.registerObserver('note.fontFamily', this._handleFontChange)
		];
		
		// Run Cut/Copy/Paste with chrome privileges
		this._iframeWindow.wrappedJSObject.zoteroExecCommand = function (doc, command, ui, value) {
			// Is that safe enough?
			if (!['cut', 'copy', 'paste'].includes(command)) {
				return;
			}
			return doc.execCommand(command, ui, value);
		};

		this._iframeWindow.addEventListener('message', this._messageHandler);
		this._iframeWindow.addEventListener('error', (event) => {
			Zotero.logError(event.error);
		});
		
		let note = this._item.note;

		this._postMessage({
			action: 'init',
			value: this._state || this._item.note,
			readOnly: this._readOnly,
			disableUI: this._disableUI,
			enableReturnButton: !!this._onReturn,
			placeholder: options.placeholder,
			dir: Zotero.dir,
			font: this._getFont(),
			hasBackup: note && !Zotero.Notes.hasSchemaVersion(note)
				|| !!await Zotero.NoteBackups.getNote(this._item.id)
		});
	}

	uninit() {
		this._prefObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
		
		if (this._quickFormatWindow) {
			this._quickFormatWindow.close();
			this._quickFormatWindow = null;
		}
		// TODO: Allow editor instance to finish its work before
		//  the uninitialization. I.e. to finish image importing

		// As long as the message listeners are attached on
		// both sides, editor instance can continue its work
		// in the backstage. Although the danger here is that
		// multiple editor instances of the same note can start
		// compeating
		this._iframeWindow.removeEventListener('message', this._messageHandler);
		Zotero.Notes.unregisterEditorInstance(this);
		this.saveSync();
	}

	focus() {
		this._postMessage({ action: 'focus' });
	}

	async updateCitationsForURIs(uris) {
		let subscriptions = this._subscriptions
		.filter(s => s.data.citation && s.data.citation.citationItems
		.some(citationItem => citationItem.uris && uris.some(uri => citationItem.uris.includes(uri))));
		for (let subscription of subscriptions) {
			await this._feedSubscription(subscription);
		}
	}
	
	async notify(ids) {
		let items = await Zotero.Items.getAsync(ids);

		// Update attachments
		let keys = items.map(item => item.key);
		this._subscriptions
		.filter(s => keys.includes(s.data.attachmentKey))
		.forEach(s => this._feedSubscription(s));

		// Update citations
		let uris = items.map(x => Zotero.URI.getItemURI(x)).filter(x => x);
		this._subscriptions
		.filter(s => s.data.citation && s.data.citation.citationItems
		.some(citationItem => citationItem.uris && uris.some(uri => citationItem.uris.includes(uri))))
		.forEach(s => this._feedSubscription(s));
	}

	saveSync() {
		if (!this._readOnly && !this._disableSaving && this._iframeWindow) {
			let noteData = this._iframeWindow.wrappedJSObject.getDataSync(true);
			if (noteData) {
				noteData = JSON.parse(JSON.stringify(noteData));
			}
			this._save(noteData);
		}
	}

	async insertAnnotations(annotations) {
		await this._ensureNoteCreated();
		let html = await this._serializeAnnotations(annotations);
		if (html) {
			this._postMessage({ action: 'insertHTML', pos: -1, html });
		}
	}
	
	_postMessage(message) {
		this._iframeWindow.postMessage({ instanceID: this.instanceID, message }, '*');
	}

	_getFont() {
		let fontSize = Zotero.Prefs.get('note.fontSize');
		// Fix empty old font prefs before a value was enforced
		if (fontSize < 6) {
			fontSize = 11;
		}
		let fontFamily = Zotero.Prefs.get('note.fontFamily');
		return { fontSize, fontFamily };
	}
	
	_handleFontChange = () => {
		this._postMessage({ action: 'updateFont', font: this._getFont() });
	}
	
	
	/**
	 * @param {Zotero.Item[]} annotations
	 * @return {String} - HTML string
	 */
	async _serializeAnnotations(annotations) {
		let html = '';
		for (let annotation of annotations) {
			let attachmentItem = await Zotero.Items.getAsync(annotation.attachmentItemID);
			if (!attachmentItem) {
				continue;
			}

			if (!annotation.text
				&& !annotation.comment
				&& !annotation.image) {
				continue;
			}
			
			let citationHTML = '';
			let imageHTML = '';
			let highlightHTML = '';
			let commentHTML = '';
			
			annotation.uri = Zotero.URI.getItemURI(attachmentItem);
			
			// Citation
			let parentItem = attachmentItem.parentID && await Zotero.Items.getAsync(attachmentItem.parentID);
			if (parentItem) {
				let citationItem = {
					uris: [Zotero.URI.getItemURI(parentItem)],
					// TODO: Find a more elegant way to call this method
					itemData: Zotero.Cite.System.prototype.retrieveItem(parentItem),
					locator: annotation.pageLabel
				};
				annotation.citationItem = citationItem;
				let citation = {
					citationItems: [citationItem],
					properties: {}
				};
				let formatted = (await this._getFormattedCitationParts(citation)).join(';');
				citationHTML = `<span class="citation" data-citation="${encodeURIComponent(JSON.stringify(citation))}">(${formatted})</span>`;
			}
			
			// Image
			if (annotation.image) {
				// We assume that annotation.image is always PNG
				let imageAttachmentKey = await this._importImage(annotation.image);
				delete annotation.image;

				// Normalize image dimensions to 1.25 of the print size
				let rect = annotation.position.rects[0];
				let rectWidth = rect[2] - rect[0];
				let rectHeight = rect[3] - rect[1];
				// Constants from pdf.js
				const CSS_UNITS = 96.0 / 72.0;
				const PDFJS_DEFAULT_SCALE = 1.25;
				let width = Math.round(rectWidth * CSS_UNITS * PDFJS_DEFAULT_SCALE);
				let height = Math.round(rectHeight * width / rectWidth);
				imageHTML = `<img data-attachment-key="${imageAttachmentKey}" width="${width}" height="${height}" data-annotation="${encodeURIComponent(JSON.stringify(annotation))}"/>`;
			}

			// Text
			if (annotation.text) {
				highlightHTML = `<span class="highlight" data-annotation="${encodeURIComponent(JSON.stringify(annotation))}">“${annotation.text}”</span>`;
			}
			
			// Note
			if (annotation.comment) {
				commentHTML = ' ' + annotation.comment;
			}
			
			let otherHTML = [highlightHTML, citationHTML, commentHTML].filter(x => x).join(' ');
			if (imageHTML && otherHTML) {
				imageHTML += '<br/>';
			}
			html += '<p>' + imageHTML + otherHTML + '</p>\n';
		}
		return html;
	}

	async _digestItems(ids) {
		let html = '';
		for (let id of ids) {
			let item = await Zotero.Items.getAsync(id);
			if (!item) {
				continue;
			}
			if (item.isRegularItem()) {
				let citation = {
					citationItems: [{
						uris: [Zotero.URI.getItemURI(item)],
						itemData: Zotero.Cite.System.prototype.retrieveItem(item)
					}],
					properties: {}
				};
				let formatted = (await this._getFormattedCitationParts(citation)).join(';');
				html += `<p><span class="citation" data-citation="${encodeURIComponent(JSON.stringify(citation))}">(${formatted})</span></p>`;
			}
			else if (item.isNote()) {
				let note = item.note;
				let attachments = await Zotero.Items.getAsync(item.getAttachments());
				for (let attachment of attachments) {
					let path = await attachment.getFilePathAsync();
					let buf = await OS.File.read(path, {});
					buf = new Uint8Array(buf).buffer;
					let blob = new (Zotero.getMainWindow()).Blob([buf], { type: attachment.attachmentContentType });
					// Image type is not additionally filtered because it was an attachment already
					let clonedAttachment = await Zotero.Attachments.importEmbeddedImage({
						blob,
						parentItemID: this._item.id,
						saveOptions: {
							notifierData: {
								noteEditorID: this.instanceID
							}
						}
					});
					note = note.replace(attachment.key, clonedAttachment.key);
				}
				html += `<p></p>${note}<p></p>`;
			}
		}
		return html;
	}

	_messageHandler = async (e) => {
		if (e.data.instanceID !== this.instanceID) {
			return;
		}
		let message = e.data.message;
		switch (message.action) {
			case 'insertObject': {
				let { type, data, pos } = message;
				if (this._readOnly) {
					return;
				}
				let html = '';
				await this._ensureNoteCreated();
				if (type === 'zotero/item') {
					let ids = data.split(',').map(id => parseInt(id));
					html = await this._digestItems(ids);
				}
				else if (type === 'zotero/annotation') {
					let annotations = JSON.parse(data);
					html = await this._serializeAnnotations(annotations);
				}
				if (html) {
					this._postMessage({ action: 'insertHTML', pos, html });
				}
				return;
			}
			case 'openAnnotation': {
				let { uri, position } = message;
				if (this.onNavigate) {
					this.onNavigate(uri, { position });
				}
				else {
					await Zotero.Reader.openURI(uri, { position });
				}
				return;
			}
			case 'openCitationPage': {
				let { citation } = message;
				if (!citation.citationItems.length) {
					return;
				}
				let citationItem = citation.citationItems[0];
				let item = await this._getItemFromURIs(citationItem.uris);
				if (!item) {
					return;
				}
				let attachments = Zotero.Items.get(item.getAttachments()).filter(x => x.isPDFAttachment());
				if (citationItem.locator && attachments.length === 1) {
					await Zotero.Reader.open(attachments[0].id, { pageLabel: citationItem.locator });
				}
				else {
					let zp = Zotero.getActiveZoteroPane();
					if (zp) {
						zp.selectItems([item.id]);
						let win = Zotero.getMainWindow();
						if (win) {
							win.focus();
							win.Zotero_Tabs.select('zotero-pane');
						}
					}
				}
				return;
			}
			case 'showCitationItem': {
				let { citation } = message;
				let items = [];
				for (let citationItem of citation.citationItems) {
					let item = await this._getItemFromURIs(citationItem.uris);
					if (item) {
						items.push(item);
					}
				}
				let zp = Zotero.getActiveZoteroPane();
				if (zp && items.length) {
					zp.selectItems(items.map(item => item.id));
					let win = Zotero.getMainWindow();
					if (win) {
						win.focus();
						win.Zotero_Tabs.select('zotero-pane');
					}
				}
				return;
			}
			case 'openURL': {
				let { url } = message;
				let zp = Zotero.getActiveZoteroPane();
				if (zp) {
					zp.loadURI(url);
				}
				return;
			}
			case 'showInLibrary': {
				let { uri } = message;
				let zp = Zotero.getActiveZoteroPane();
				if (zp) {
					let item = await Zotero.URI.getURIItem(uri);
					if (item) {
						zp.selectItems([item.id]);
						let win = Zotero.getMainWindow();
						if (win) {
							win.focus();
						}
					}
				}
				return;
			}
			case 'openBackup': {
				let zp = Zotero.getActiveZoteroPane();
				if (zp) {
					zp.openBackupNoteWindow(this._item.id);
				}
				return;
			}
			case 'update': {
				let { noteData } = message;
				if (this._readOnly) {
					return;
				}
				this._save(noteData);
				return;
			}
			case 'generateCitation': {
				if (this._readOnly) {
					return;
				}
				let { citation, pos } = message;
				let formatted = (await this._getFormattedCitationParts(citation)).join(';');
				let html = `<span class="citation" data-citation="${encodeURIComponent(JSON.stringify(citation))}">(${formatted})</span>`;
				this._postMessage({ action: 'insertHTML', pos, html });
				return;
			}
			case 'subscribeProvider': {
				let { subscription } = message;
				this._subscriptions.push(subscription);
				await this._feedSubscription(subscription);
				return;
			}
			case 'unsubscribeProvider': {
				let { id } = message;
				this._subscriptions.splice(this._subscriptions.findIndex(s => s.id === id), 1);
				return;
			}
			case 'openCitationPopup': {
				let { nodeID, citation } = message;
				if (this._readOnly) {
					return;
				}
				citation = JSON.parse(JSON.stringify(citation));
				let availableCitationItems = [];
				for (let citationItem of citation.citationItems) {
					let item = await this._getItemFromURIs(citationItem.uris);
					if (item) {
						availableCitationItems.push({ ...citationItem, id: item.id });
					}
				}
				citation.citationItems = availableCitationItems;
				let libraryID = this._item.libraryID;
				this._openQuickFormatDialog(nodeID, citation, [libraryID]);
				return;
			}
			case 'importImages': {
				let { images } = message;
				if (this._readOnly) {
					return;
				}
				if (this._isAttachment) {
					return;
				}
				for (let image of images) {
					let { nodeID, src } = image;
					let attachmentKey = await this._importImage(src, true);
					// TODO: Inform editor about the failed to import images
					if (attachmentKey) {
						this._postMessage({ action: 'attachImportedImage', nodeID, attachmentKey });
					}
				}
				return;
			}
			case 'syncAttachmentKeys': {
				if (this._readOnly) {
					return;
				}
				let { attachmentKeys } = message;
				if (this._isAttachment) {
					return;
				}
				let attachmentItems = this._item.getAttachments().map(id => Zotero.Items.get(id));
				let abandonedItems = attachmentItems.filter(item => !attachmentKeys.includes(item.key));
				for (let item of abandonedItems) {
					// Store image data for undo. Although it stays as long
					// as the note is opened. TODO: Find a better way
					this._deletedImages[item.key] = await this._getDataURL(item);
					await item.eraseTx();
				}
				return;
			}
			case 'openContextMenu': {
				let { x, y, pos, itemGroups } = message;
				this._openPopup(x, y, pos, itemGroups);
				return;
			}
			case 'return': {
				this._onReturn();
				return;
			}
		}
	}

	async _feedSubscription(subscription) {
		let { id, type, nodeID, data } = subscription;
		if (type === 'citation') {
			let parts = await this._getFormattedCitationParts(data.citation);
			this._postMessage({ action: 'notifyProvider', id, type, data: { formattedCitation: parts.join(';') } });
		}
		else if (type === 'image') {
			let { attachmentKey } = data;
			let item = Zotero.Items.getByLibraryAndKey(this._item.libraryID, attachmentKey);
			if (!item) {
				// TODO: Find a better way to undo image deletion,
				//  probably just keep it in a trash until the note is closed
				// This recreates the attachment as a completely new item
				let dataURL = this._deletedImages[attachmentKey];
				if (dataURL) {
					// delete this._deletedImages[attachmentKey];
					// TODO: Fix every repeated undo-redo cycle caching a
					//  new image copy in memory
					let newAttachmentKey = await this._importImage(dataURL);
					// TODO: Inform editor about the failed to import images
					this._postMessage({ action: 'attachImportedImage', nodeID, attachmentKey: newAttachmentKey });
				}
			}
			// Make sure attachment key belongs to the actual parent note,
			// otherwise it would be a security risk.
			// TODO: Figure out what to do with images not being
			//  displayed in merge dialog because of this,
			//  although another reason is because items
			//  are synced before image attachments
			else if(item.parentID === this._item.id) {
				let src = await this._getDataURL(item);
				this._postMessage({ action: 'notifyProvider', id, type, data: { src } });
			}
		}
	}

	async _importImage(src, download) {
		let blob;
		if (src.startsWith('data:')) {
			blob = this._dataURLtoBlob(src);
		}
		else if (download) {
			let res;

			try {
				res = await Zotero.HTTP.request('GET', src, { responseType: 'blob' });
			}
			catch (e) {
				return;
			}

			blob = res.response;
			
			if (!DOWNLOADED_IMAGE_TYPE.includes(blob.type)) {
				return;
			}
		}
		else {
			return;
		}

		let attachment = await Zotero.Attachments.importEmbeddedImage({
			blob,
			parentItemID: this._item.id,
			saveOptions: {
				notifierData: {
					noteEditorID: this.instanceID
				}
			}
		});

		return attachment.key;
	}

	_openPopup(x, y, pos, itemGroups) {
		this._popup.hidePopup();

		while (this._popup.firstChild) {
			this._popup.removeChild(this._popup.firstChild);
		}

		for (let itemGroup of itemGroups) {
			for (let item of itemGroup) {
				let menuitem = this._popup.ownerDocument.createElement('menuitem');
				menuitem.setAttribute('value', item.name);
				menuitem.setAttribute('label', item.label);
				if (!item.enabled) {
					menuitem.setAttribute('disabled', true);
				}
				menuitem.addEventListener('command', () => {
					this._postMessage({
						action: 'contextMenuAction',
						ctxAction: item.name,
						pos
					});
				});
				this._popup.appendChild(menuitem);
			}
			
			if (itemGroups.indexOf(itemGroup) !== itemGroups.length - 1) {
				let separator = this._popup.ownerDocument.createElement('menuseparator');
				this._popup.appendChild(separator);
			}
		}

		this._popup.openPopupAtScreen(x, y, true);
	}

	async _ensureNoteCreated() {
		if (!this._item.id) {
			return this._item.saveTx();
		}
	}

	async _save(noteData) {
		if (!noteData) return;
		let { state, html } = noteData;
		if (html === undefined) return;
		try {
			if (this._disableSaving) {
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
			if (this._item) {
				await Zotero.NoteBackups.ensureBackup(this._item);
				await Zotero.DB.executeTransaction(async () => {
					let changed = this._item.setNote(html);
					if (changed && !this._disableSaving) {
						await this._item.save({
							notifierData: {
								noteEditorID: this.instanceID,
								state
							}
						});
					}
				});
			}
			// Create a new note
			else {
				var item = new Zotero.Item('note');
				if (this.parentItem) {
					item.libraryID = this.parentItem.libraryID;
				}
				item.setNote(html);
				if (this.parentItem) {
					item.parentKey = this.parentItem.key;
				}
				if (!this._disableSaving) {
					var id = await item.saveTx();
					if (!this.parentItem && this.collection) {
						this.collection.addItem(id);
					}
					this._item = item;
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.crash(true);
			// TODO: Prevent further writing in the note
		}
	}

	async _getItemFromURIs(uris) {
		for (let uri of uris) {
			// Try getting URI directly
			try {
				let item = await Zotero.URI.getURIItem(uri);
				if (item) {
					// Ignore items in the trash
					if (!item.deleted) {
						return item;
					}
				}
			}
			catch (e) {
			}

			// Try merged item mapping
			var replacer = await Zotero.Relations.getByPredicateAndObject(
				'item', Zotero.Relations.replacedItemPredicate, uri
			);
			if (replacer.length && !replacer[0].deleted) {
				return replacer[0];
			}
		}
	}

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

	async _getFormattedCitationParts(citation) {
		let formattedItems = [];
		for (let citationItem of citation.citationItems) {
			if (!Array.isArray(citationItem.uris)) {
				continue;
			}
			let item = await this._getItemFromURIs(citationItem.uris);
			if (!item && citationItem.itemData) {
				item = new Zotero.Item();
				Zotero.Utilities.itemFromCSLJSON(item, citationItem.itemData);
			}
			if (item) {
				formattedItems.push(this._buildBubbleString(citationItem, this._getBackupStr(item)));
			}
			// else {
			// 	let formattedItem = this._buildBubbleString(citationItem, citationItem.backupText);
			// 	formattedItem = `<span style="color: red;">${formattedItem}</span>`;
			// 	formattedItems.push(formattedItem);
			// }
		}
		return formattedItems;
	}

	_getBackupStr(item) {
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

	_arrayBufferToBase64(buffer) {
		var binary = '';
		var bytes = new Uint8Array(buffer);
		var len = bytes.byteLength;
		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	_dataURLtoBlob(dataurl) {
		let parts = dataurl.split(',');
		let mime = parts[0].match(/:(.*?);/)[1];
		if (parts[0].indexOf('base64') !== -1) {
			let bstr = atob(parts[1]);
			let n = bstr.length;
			let u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}

			return new (Zotero.getMainWindow()).Blob([u8arr], { type: mime });
		}
		return null;
	}

	async _getDataURL(item) {
		let path = await item.getFilePathAsync();
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		return 'data:' + item.attachmentContentType + ';base64,' + this._arrayBufferToBase64(buf);
	}

	async _openQuickFormatDialog(nodeID, citationData, filterLibraryIDs) {
		await Zotero.Styles.init();
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
			preview: async function () {
				// Zotero.debug('CI: preview');
			},

			/**
			 * Sort the citationItems within citation (depends on this.citation.properties.unsorted)
			 * @return {Promise} A promise resolved with the previewed citation string
			 */
			sort: async function () {
				// Zotero.debug('CI: sort');
			},

			/**
			 * Accept changes to the citation
			 * @param {Function} [progressCallback] A callback to be run when progress has changed.
			 *     Receives a number from 0 to 100 indicating current status.
			 */
			accept: async function (progressCallback) {
				// Zotero.debug('CI: accept');
				if (progressCallback) progressCallback(100);

				if (win) {
					win.close();
				}

				let citation = {
					citationItems: this.citation.citationItems,
					properties: this.citation.properties
				}

				for (let citationItem of citation.citationItems) {
					let item = await Zotero.Items.getAsync(parseInt(citationItem.id));
					delete citationItem.id;
					citationItem.uris = [Zotero.URI.getItemURI(item)];
					citationItem.itemData = Zotero.Cite.System.prototype.retrieveItem(item);
				}
				
				let formattedCitation = (await that._getFormattedCitationParts(citation)).join(';');

				if (progressCallback || !citationData.citationItems.length) {
					that._postMessage({ action: 'setCitation', nodeID, citation, formattedCitation });
				}
			},

			/**
			 * Get a list of items used in the current document
			 * @return {Promise} A promise resolved by the items
			 */
			getItems: async function () {
				// Zotero.debug('CI: getItems');
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
				// Zotero.debug('Citation: loadItemData');
			}

			async handleMissingItem(idx) {
				// Zotero.debug('Citation: handleMissingItem');
			}

			async prepareForEditing() {
				// Zotero.debug('Citation: prepareForEditing');
			}

			toJSON() {
				// Zotero.debug('Citation: toJSON');
			}

			/**
			 * Serializes the citation into CSL code representation
			 * @returns {string}
			 */
			serialize() {
				// Zotero.debug('Citation: serialize');
			}
		};

		if (that._quickFormatWindow) {
			that._quickFormatWindow.close();
			that._quickFormatWindow = null;
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

		win = that._quickFormatWindow = Components.classes['@mozilla.org/embedcomp/window-watcher;1']
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null, 'chrome://zotero/content/integration/quickFormat.xul', '', mode, {
			wrappedJSObject: io
		});
	}

	/**
	 * Create note from annotations
	 *
	 * @param {Zotero.Item[]} annotations
	 * @param {Integer} parentID Creates standalone note if not provided
	 * @returns {Promise<Zotero.Item>}
	 */
	static async createNoteFromAnnotations(annotations, parentID) {
		if (!annotations.length) {
			throw new Error("No annotations provided");
		}
		
		for (let annotation of annotations) {
			if (annotation.annotationType === 'image'
				&& !await Zotero.Annotations.hasCacheImage(annotation)) {
				try {
					await Zotero.PDFRenderer.renderAttachmentAnnotations(annotation.parentID);
				}
				catch (e) {
					Zotero.debug(e);
					throw e;
				}
				break;
			}
		}

		let note = new Zotero.Item('note');
		note.libraryID = annotations[0].libraryID;
		note.parentID = parentID;
		await note.saveTx();
		let editorInstance = new EditorInstance();
		editorInstance._item = note;
		let jsonAnnotations = [];
		for (let annotation of annotations) {
			let attachmentItem = Zotero.Items.get(annotation.parentID);
			let jsonAnnotation = await Zotero.Annotations.toJSON(annotation);
			jsonAnnotation.attachmentItemID = attachmentItem.id;
			jsonAnnotations.push(jsonAnnotation);
		}
		let html = `<h1>${Zotero.getString('note.annotationsWithDate', new Date().toLocaleString())}</h1>\n`;
		html += await editorInstance._serializeAnnotations(jsonAnnotations);
		html = `<div data-schema-version="${SCHEMA_VERSION}">${html}</div>`;
		note.setNote(html);
		await note.saveTx();
		return note;
	}
}

Zotero.EditorInstance = EditorInstance;
