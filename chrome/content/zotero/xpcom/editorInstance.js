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

Components.utils.import("resource://gre/modules/InlineSpellChecker.jsm");

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

// Note: TinyMCE is automatically doing some meaningless corrections to
// note-editor produced HTML. Which might result to more
// conflicts, especially in group libraries

// Note: Synchronous save can still affect dateModified

// When changing this update in `note-editor` as well.
// This only filters images that are being imported from a URL.
// In all other cases `note-editor` should decide what
// image types can be imported, and if not then
// Zotero.Attachments.importEmbeddedImage does.
// Additionally, the already imported images should never be
// affected
const DOWNLOADED_IMAGE_TYPE = [
	'image/jpeg',
	'image/png'
];

class EditorInstance {
	constructor() {
		this.instanceID = Zotero.Utilities.randomString();
	}

	async init(options) {
		Zotero.Notes.registerEditorInstance(this);
		this.onNavigate = options.onNavigate;
		// TODO: Consider to use only itemID instead of loaded item
		this._item = options.item;
		this._reloaded = options.reloaded;
		this._viewMode = options.viewMode;
		this._readOnly = options.readOnly || this._isReadOnly();
		this._filesReadOnly = !Zotero.Libraries.get(this._item.libraryID).filesEditable;
		this._disableUI = options.disableUI;
		this._onReturn = options.onReturn;
		this._iframeWindow = options.iframeWindow;
		this._popup = options.popup;
		this._state = options.state;
		this._disableSaving = false;
		this._subscriptions = [];
		this._quickFormatWindow = null;
		this._citationItemsList = [];
		this._initPromise = new Promise((resolve, reject) => {
			this._resolveInitPromise = resolve;
			this._rejectInitPromise = reject;
		});
		this._prefObserverIDs = [
			Zotero.Prefs.registerObserver('note.fontSize', this._handleFontChange),
			Zotero.Prefs.registerObserver('note.fontFamily', this._handleFontChange),
			Zotero.Prefs.registerObserver('note.css', this._handleStyleChange),
			Zotero.Prefs.registerObserver('layout.spellcheckDefault', this._handleSpellCheckChange, true)
		];
		this._spellChecker = null;
		
		// Run Cut/Copy/Paste with chrome privileges
		this._iframeWindow.wrappedJSObject.zoteroExecCommand = function (doc, command, ui, value) {
			// Is that safe enough?
			if (!['cut', 'copy', 'paste'].includes(command)) {
				return;
			}
			return doc.execCommand(command, ui, value);
		};

		// Translate note HTML into Markdown, for setting it as text/plain in clipboard (on text copy/drag)
		this._iframeWindow.wrappedJSObject.zoteroTranslateToMarkdown = (html) => {
			let item = new Zotero.Item('note');
			item.libraryID = this._item.libraryID;
			item.setNote(html);
			let text = '';
			var translation = new Zotero.Translate.Export;
			translation.noWait = true;
			translation.setItems([item]);
			translation.setTranslator(Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN);
			translation.setHandler("done", (obj, worked) => {
				if (worked) {
					text = obj.string.replace(/\r\n/g, '\n');
				}
			});
			translation.translate();
			return text;
		};

		this._iframeWindow.wrappedJSObject.zoteroCopyImage = async (dataURL) => {
			let parts = dataURL.split(',');
			if (!parts[0].includes('base64')) {
				return;
			}
			let mime = parts[0].match(/:(.*?);/)[1];
			let bstr = atob(parts[1]);
			let n = bstr.length;
			let u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}
			let imgTools = Components.classes["@mozilla.org/image/tools;1"]
				.getService(Components.interfaces.imgITools);
			let transferable = Components.classes['@mozilla.org/widget/transferable;1']
				.createInstance(Components.interfaces.nsITransferable);
			let clipboardService = Components.classes['@mozilla.org/widget/clipboard;1']
				.getService(Components.interfaces.nsIClipboard);
			let img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
			transferable.init(null);
			let kNativeImageMime = 'application/x-moz-nativeimage';
			transferable.addDataFlavor(kNativeImageMime);
			transferable.setTransferData(kNativeImageMime, img);
			clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		};

		this._iframeWindow.wrappedJSObject.zoteroSaveImageAs = async (dataURL) => {
			let parts = dataURL.split(',');
			if (!parts[0].includes('base64')) {
				return;
			}
			let mime = parts[0].match(/:(.*?);/)[1];
			let bstr = atob(parts[1]);
			let n = bstr.length;
			let u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}
			let ext = Zotero.MIME.getPrimaryExtension(mime, '');
			let fp = new FilePicker();
			fp.init(this._iframeWindow, Zotero.getString('noteEditor.saveImageAs'), fp.modeSave);
			fp.appendFilters(fp.filterImages);
			fp.defaultString = Zotero.getString('fileTypes.image').toLowerCase() + '.' + ext;
			let rv = await fp.show();
			if (rv === fp.returnOK || rv === fp.returnReplace) {
				let outputPath = fp.file;
				await OS.File.writeAtomic(outputPath, u8arr);
			}
		};

		this._iframeWindow.addEventListener('message', this._messageHandler);
		this._iframeWindow.addEventListener('error', (event) => {
			Zotero.logError(event.error);
		});
		
		let note = this._item.note;

		// TODO: From Firefox 64 this is no longer necessary
		this._iframeWindow.document.execCommand('enableObjectResizing', false, 'false');
		this._iframeWindow.document.execCommand('enableInlineTableEditing', false, 'false');

		let style = Zotero.Prefs.get('note.css');
		if (style) {
			Zotero.debug('Using a custom CSS style:');
			Zotero.debug(style);
		}

		this._postMessage({
			action: 'init',
			value: this._state || this._item.note,
			reloaded: this._reloaded,
			viewMode: this._viewMode,
			readOnly: this._readOnly,
			unsaved: !this._item.id,
			disableUI: this._disableUI,
			enableReturnButton: !!this._onReturn,
			isAttachmentNote: this._item.isAttachment(),
			placeholder: options.placeholder,
			dir: Zotero.dir,
			font: this._getFont(),
			style,
			smartQuotes: Zotero.Prefs.get('note.smartQuotes'),
			localizedStrings: {
				// Figure out a better way to pass this
				'zotero.appName': Zotero.appName,
				...Zotero.Intl.getPrefixedStrings('general.'),
				...Zotero.Intl.getPrefixedStrings('noteEditor.')
			}
		});
		
		if (!this._item.isAttachment()) {
			Zotero.Notes.ensureEmbeddedImagesAreAvailable(this._item);
		}
	}

	async uninit() {
		this._prefObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
		if (this._quickFormatWindow) {
			this._quickFormatWindow.close();
			this._quickFormatWindow = null;
		}
		this._iframeWindow.removeEventListener('message', this._messageHandler);
		this.saveSync();
		await Zotero.Notes.unregisterEditorInstance(this);
		if (!this._item.isAttachment() && !this._filesReadOnly) {
			await Zotero.Notes.deleteUnusedEmbeddedImages(this._item);
		}
	}

	focus() {
		this._postMessage({ action: 'focus' });
	}

	async notify(event, type, ids, extraData) {
		if (type === 'file' && event === 'download') {
			let items = await Zotero.Items.getAsync(ids);
			for (let item of items) {
				if (item.isAttachment() && await item.getFilePathAsync()) {
					let subscription = this._subscriptions.find(x => x.data.attachmentKey === item.key);
					if (subscription) {
						await this._feedSubscription(subscription);
					}
				}
			}
		}
		
		if (this._readOnly || !this._item) {
			return;
		}
		
		// Update citations itemData
		let items = await Zotero.Items.getAsync(ids);
		let uris = items.map(x => Zotero.URI.getItemURI(x)).filter(x => x);
		let citationItemsList = this._citationItemsList
			.filter(ci => ci.uris && uris.some(uri => ci.uris.includes(uri)));
		await this._updateCitationItems(citationItemsList);
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
		await this.importImages(annotations);
		let { html } = Zotero.EditorInstanceUtilities.serializeAnnotations(annotations);
		if (html) {
			this._postMessage({ action: 'insertHTML', pos: null, html });
		}
	}
	
	_postMessage(message) {
		this._iframeWindow.postMessage({ instanceID: this.instanceID, message }, '*');
	}

	_isReadOnly() {
		let item = this._item;
		return !item.isEditable()
			|| item.deleted
			|| item.parentItem && item.parentItem.deleted;
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
		this._postMessage({ action: 'setFont', font: this._getFont() });
	};

	_handleStyleChange = () => {
		this._postMessage({ action: 'setStyle', style: Zotero.Prefs.get('note.css') });
	};

	_handleSpellCheckChange = () => {
		try {
			let spellChecker = this._getSpellChecker();
			let value = Zotero.Prefs.get('layout.spellcheckDefault', true);
			if (!value && spellChecker.enabled
				|| value && !spellChecker.enabled) {
				spellChecker.toggleEnabled();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	_showInLibrary(ids) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		let win = Zotero.getMainWindow();
		if (win) {
			win.ZoteroPane.selectItems(ids);
			win.focus();
		}
	}

	async importImages(annotations) {
		for (let annotation of annotations) {
			if (annotation.image && !this._filesReadOnly) {
				annotation.imageAttachmentKey = await this._importImage(annotation.image);
			}
			delete annotation.image;
		}
	}

	async _digestItems(ids) {
		let html = '';
		let items = await Zotero.Items.getAsync(ids);
		for (let item of items) {
			if (item.isNote()
				&& !await Zotero.Notes.ensureEmbeddedImagesAreAvailable(item)
				&& !Zotero.Notes.promptToIgnoreMissingImage()) {
				return null;
			}
		}
		
		for (let item of items) {
			if (item.isRegularItem()) {
				let itemData = Zotero.Utilities.Item.itemToCSLJSON(item);
				let citation = {
					citationItems: [{
						uris: [Zotero.URI.getItemURI(item)],
						itemData
					}],
					properties: {}
				};
				let formatted = Zotero.EditorInstanceUtilities.formatCitation(citation);
				html += `<p><span class="citation" data-citation="${encodeURIComponent(JSON.stringify(citation))}">${formatted}</span></p>`;
			}
			else if (item.isNote()) {
				let note = item.note;
				
				let parser = new DOMParser();
				let doc = parser.parseFromString(note, 'text/html');

				// Get citationItems with itemData from note metadata
				let storedCitationItems = [];
				let containerNode = doc.querySelector('body > div[data-schema-version]');
				if (containerNode) {
					try {
						let data = JSON.parse(decodeURIComponent(containerNode.getAttribute('data-citation-items')));
						if (Array.isArray(data)) {
							storedCitationItems = data;
						}
					}
					catch (e) {
					}
				}

				if (storedCitationItems.length) {
					let fillWithItemData = (citationItems) => {
						for (let citationItem of citationItems) {
							let item = storedCitationItems.find(item => item.uris.some(uri => citationItem.uris.includes(uri)));
							if (item) {
								citationItem.itemData = item.itemData;
							}
						}
					};

					let nodes = doc.querySelectorAll('.citation[data-citation]');
					for (let node of nodes) {
						let citation = node.getAttribute('data-citation');
						try {
							citation = JSON.parse(decodeURIComponent(citation));
							fillWithItemData(citation.citationItems);
							citation = encodeURIComponent(JSON.stringify(citation));
							node.setAttribute('data-citation', citation);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
					
					// img[data-annotation] and div.highlight[data-annotation]
					nodes = doc.querySelectorAll('*[data-annotation]');
					for (let node of nodes) {
						let annotation = node.getAttribute('data-annotation');
						try {
							annotation = JSON.parse(decodeURIComponent(annotation));
							// citationItem is allowed to not exist in annotation
							if (annotation.citationItem) {
								fillWithItemData([annotation.citationItem]);
								annotation = encodeURIComponent(JSON.stringify(annotation));
								node.setAttribute('data-annotation', annotation);
							}
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
				}

				// Clone all note image attachments and replace keys in the new note
				if (!this._filesReadOnly) {
					let attachments = Zotero.Items.get(item.getAttachments());
					for (let attachment of attachments) {
						if (!await attachment.fileExists()) {
							continue;
						}
						await Zotero.DB.executeTransaction(async () => {
							let copiedAttachment = await Zotero.Attachments.copyEmbeddedImage({
								attachment,
								note: this._item,
								saveOptions: {
									notifierData: {
										noteEditorID: this.instanceID
									}
								}
							});
							let node = doc.querySelector(`img[data-attachment-key="${attachment.key}"]`);
							if (node) {
								node.setAttribute('data-attachment-key', copiedAttachment.key);
							}
						});
					}
				}
				
				html += `<p></p>${doc.body.innerHTML}<p></p>`;
			}
		}
		return html;
	}

	_messageHandler = async (e) => {
		if (e.source !== this._iframeWindow
			|| e.data.instanceID !== this.instanceID) {
			return;
		}
		let message = e.data.message;
		try {
			switch (message.action) {
				case 'initialized': {
					this._resolveInitPromise();
					return;
				}
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
						if (!html) {
							return;
						}
					}
					else if (type === 'zotero/annotation') {
						let annotations = JSON.parse(data);
						await this.importImages(annotations);
						let { html: serializedHTML } = Zotero.EditorInstanceUtilities.serializeAnnotations(annotations);
						html = serializedHTML;
					}
					if (html) {
						this._postMessage({ action: 'insertHTML', pos, html });
					}
					return;
				}
				case 'openAnnotation': {
					let { attachmentURI, position } = message;
					if (this.onNavigate) {
						this.onNavigate(attachmentURI, { position });
					}
					else {
						let zp = Zotero.getActiveZoteroPane();
						if (zp) {
							let item = await Zotero.URI.getURIItem(attachmentURI);
							if (item) {
								zp.viewPDF(item.id, { position });
							}
						}
					}
					return;
				}
				case 'openCitationPage': {
					let { citation } = message;
					if (!citation.citationItems.length) {
						return;
					}
					let citationItem = citation.citationItems[0];
					let item = await Zotero.EditorInstance.getItemFromURIs(citationItem.uris);
					if (!item) {
						return;
					}

					if (citationItem.locator) {
						let attachments = await item.getBestAttachments();
						attachments = attachments.filter(x => x.isPDFAttachment());
						if (attachments.length) {
							let zp = Zotero.getActiveZoteroPane();
							if (zp) {
								zp.viewPDF(attachments[0].id, { pageLabel: citationItem.locator });
							}
						}
					}
					else {
						this._showInLibrary(item.id);
					}
					return;
				}
				case 'showCitationItem': {
					let { citation } = message;
					let items = [];
					for (let citationItem of citation.citationItems) {
						let item = await Zotero.EditorInstance.getItemFromURIs(citationItem.uris);
						if (item) {
							items.push(item);
						}
					}

					if (items.length) {
						this._showInLibrary(items.map(item => item.id));
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
				case 'showNote': {
					this._showInLibrary(this._item.id);
					return;
				}
				case 'openWindow': {
					// TODO: Can we can avoid creating empty note just to open it in a new window?
					await this._ensureNoteCreated();
					let zp = Zotero.getActiveZoteroPane();
					zp.openNoteWindow(this._item.id);
					return;
				}
				case 'update': {
					let { noteData, system } = message;
					if (this._readOnly) {
						return;
					}
					await this._save(noteData, system);
					return;
				}
				case 'subscribe': {
					let { subscription } = message;
					subscription = JSON.parse(JSON.stringify(subscription));
					this._subscriptions.push(subscription);
					if (subscription.type === 'image') {
						await this._feedSubscription(subscription);
					}
					return;
				}
				case 'unsubscribe': {
					let { id } = message;
					this._subscriptions.splice(this._subscriptions.findIndex(s => s.id === id), 1);
					return;
				}
				// Called on note editor load
				case 'updateCitationItemsList': {
					let { list } = message;
					list = list.slice();
					let newList = [];
					for (let item of list) {
						let existingItem = this._citationItemsList
						.find(ci => ci.uris.some(uri => item.uris.includes(uri)));
						if (!existingItem) {
							newList.push(item);
						}
					}
					await this._updateCitationItems(newList);
					this._citationItemsList = list;
					return;
				}
				case 'openCitationPopup': {
					let { nodeID, citation } = message;
					if (this._readOnly) {
						return;
					}
					citation = JSON.parse(JSON.stringify(citation));
					for (let citationItem of citation.citationItems) {
						let item = await Zotero.EditorInstance.getItemFromURIs(citationItem.uris);
						if (item) {
							citationItem.id = item.id;
						}
					}
					let openedEmpty = !citation.citationItems.length;
					if (!citation.citationItems.length) {
						let win = Zotero.getMainWindow();
						if (win) {
							let reader = Zotero.Reader.getByTabID(win.Zotero_Tabs.selectedID);
							if (reader) {
								let item = Zotero.Items.get(reader.itemID);
								if (item && item.parentItem) {
									item = item.parentItem;
									let citationItem = {};
									citationItem.id = item.id;
									citationItem.uris = [Zotero.URI.getItemURI(item)];
									citationItem.itemData = Zotero.Utilities.Item.itemToCSLJSON(item);
									citation.citationItems.push(citationItem);
								}
							}
						}
					}
					let libraryID = this._item.libraryID;
					this._openQuickFormatDialog(nodeID, citation, [libraryID], openedEmpty);
					return;
				}
				case 'importImages': {
					await this._ensureNoteCreated();
					let { images } = message;
					if (this._readOnly || this._filesReadOnly) {
						return;
					}
					if (this._item.isAttachment()) {
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
		catch (e) {
			Zotero.logError(e);
			if (message && ['update', 'importImages'].includes(message.action)) {
				this._postMessage({ action: 'crash' });
			}
			throw e;
		}
	}

	async _updateCitationItems(citationItemsList) {
		let citationItems = [];
		for (let { uris } of citationItemsList) {
			let item = await Zotero.EditorInstance.getItemFromURIs(uris);
			if (item) {
				let itemData = Zotero.Utilities.Item.itemToCSLJSON(item);
				citationItems.push({ uris, itemData });
			}
		}
		if (citationItems.length) {
			this._postMessage({ action: 'updateCitationItems', citationItems });
		}
	}

	async _feedSubscription(subscription) {
		let { id, type, data } = subscription;
		if (type === 'image') {
			let { attachmentKey } = data;
			let n = 0;
			// For now wait up to 60 seconds, as there is no point to wait for very long sync to finish
			while (n++ < 60) {
				let item = Zotero.Items.getByLibraryAndKey(this._item.libraryID, attachmentKey);
				// Attachment item (not the file) might not be synced at the time
				if (!item && Zotero.Sync.Runner.syncInProgress) {
					await Zotero.Promise.delay(1000);
					continue;
				}
				// Check if the attachment is actually the child
				if (item.parentID === this._item.id) {
					if (await item.getFilePathAsync()) {
						let src = await this._getDataURL(item);
						this._postMessage({ action: 'notifySubscription', id, data: { src } });
					}
					else {
						await Zotero.Notes.ensureEmbeddedImagesAreAvailable(this._item);
						// this._postMessage({ action: 'notifySubscription', id, data: { src: 'error' } });
					}
				}
				break;
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

	async _openPopup(x, y, pos, itemGroups) {
		let appendItems = (parentNode, itemGroups) => {
			for (let itemGroup of itemGroups) {
				for (let item of itemGroup) {
					if (item.groups) {
						let menu = parentNode.ownerDocument.createXULElement('menu');
						menu.setAttribute('label', item.label);
						let menupopup = parentNode.ownerDocument.createXULElement('menupopup');
						menu.append(menupopup);
						appendItems(menupopup, item.groups);
						parentNode.appendChild(menu);
					}
					else {
						let menuitem = parentNode.ownerDocument.createXULElement('menuitem');
						menuitem.setAttribute('value', item.name);
						menuitem.setAttribute('label', item.label);
						menuitem.setAttribute('disabled', !item.enabled);
						if (item.checked) {
							menuitem.setAttribute('type', 'checkbox');
						}
						menuitem.setAttribute('checked', item.checked);
						menuitem.addEventListener('command', () => {
							if (item.name === 'insertImage') {
								return this._iframeWindow.eval('openImageFilePicker()');
							}
							this._postMessage({
								action: 'contextMenuAction',
								ctxAction: item.name,
								pos
							});
						});
						parentNode.appendChild(menuitem);
					}
				}

				if (itemGroups.indexOf(itemGroup) !== itemGroups.length - 1) {
					let separator = parentNode.ownerDocument.createXULElement('menuseparator');
					parentNode.appendChild(separator);
				}
			}
		};
		
		this._popup.hidePopup();

		while (this._popup.firstChild) {
			this._popup.removeChild(this._popup.firstChild);
		}
		
		appendItems(this._popup, itemGroups);
		
		// Spell checker
		let spellChecker = this._getSpellChecker();
		
		// If `contenteditable` area wasn't focused before, the spell checker
		// might not be fully initialized on right-click.
		// The wait time depends on system performance/load
		let n = 0;
		// Wait for 200ms
		while (n++ < 20) {
			try {
				if (spellChecker.mInlineSpellChecker.spellChecker.GetCurrentDictionary()) {
					break;
				}
			}
			catch (e) {
				break;
			}
			await Zotero.Promise.delay(10);
		}
		
		// Separator
		var separator = this._popup.ownerDocument.createXULElement('menuseparator');
		this._popup.appendChild(separator);
		// Check Spelling
		var menuitem = this._popup.ownerDocument.createXULElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('spellCheck.checkSpelling'));
		menuitem.setAttribute('checked', spellChecker.enabled);
		menuitem.setAttribute('type', 'checkbox');
		menuitem.addEventListener('command', () => {
			// Possible values: 0 - off, 1 - only multi-line, 2 - multi and single line input boxes
			Zotero.Prefs.set('layout.spellcheckDefault', spellChecker.enabled ? 0 : 1, true);
		});
		this._popup.append(menuitem);

		if (spellChecker.enabled) {
			// Languages menu
			var menu = this._popup.ownerDocument.createXULElement('menu');
			menu.setAttribute('label', Zotero.getString('general.languages'));
			this._popup.append(menu);
			// Languages menu popup
			var menupopup = this._popup.ownerDocument.createXULElement('menupopup');
			menu.append(menupopup);
			
			spellChecker.addDictionaryListToMenu(menupopup, null);
			
			// The menu is prepopulated with names from InlineSpellChecker::getDictionaryDisplayName(),
			// which will be in English, so swap in native locale names where we have them
			for (var menuitem of menupopup.children) {
				// 'spell-check-dictionary-en-US'
				let locale = menuitem.id.slice(23);
				let label = Zotero.Dictionaries.getBestDictionaryName(locale);
				if (label && label != locale) {
					menuitem.setAttribute('label', label);
				}
			}
			
			// Separator
			var separator = this._popup.ownerDocument.createXULElement('menuseparator');
			menupopup.appendChild(separator);
			// Add Dictionaries
			var menuitem = this._popup.ownerDocument.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('spellCheck.addRemoveDictionaries'));
			menuitem.addEventListener('command', () => {
				Services.ww.openWindow(null, "chrome://zotero/content/dictionaryManager.xhtml",
					"dictionary-manager", "chrome,centerscreen", {});
				
			});
			menupopup.append(menuitem);
			
			let selection = this._iframeWindow.getSelection();
			if (selection) {
				spellChecker.initFromEvent(
					selection.anchorNode,
					selection.anchorOffset
				);
			}

			let firstElementChild = this._popup.firstElementChild;
			let showSeparator = false;
			let suggestionCount = spellChecker.addSuggestionsToMenuOnParent(this._popup, firstElementChild, 5);
			if (suggestionCount) {
				showSeparator = true;
			}
			if (spellChecker.overMisspelling) {
				let addToDictionary = this._popup.ownerDocument.createXULElement('menuitem');
				addToDictionary.setAttribute('data-l10n-id', 'text-action-spell-add-to-dictionary');
				addToDictionary.addEventListener('command', () => {
					spellChecker.addToDictionary();
				});
				this._popup.insertBefore(addToDictionary, firstElementChild);
				showSeparator = true;
			}
			if (spellChecker.canUndo()) {
				let undo = this._popup.ownerDocument.createXULElement('menuitem');
				undo.setAttribute('data-l10n-id', 'text-action-spell-undo-add-to-dictionary');
				undo.addEventListener('command', () => {
					spellChecker.undoAddToDictionary();
				});
				this._popup.insertBefore(undo, firstElementChild);
				showSeparator = true;
			}
			
			if (showSeparator) {
				let separator = this._popup.ownerDocument.createXULElement('menuseparator');
				this._popup.insertBefore(separator, firstElementChild);
			}
		}
		
		this._popup.openPopupAtScreen(x, y, true);
	}

	_getSpellChecker() {
		// Fix cannot access dead object error
		if (Components.utils.isDeadWrapper(this._iframeWindow)) return null;
		if (!this._spellChecker) {
			let editingSession = this._iframeWindow.docShell.editingSession;
			this._spellChecker = new InlineSpellChecker(
				editingSession.getEditorForWindow(this._iframeWindow)
			);
		}
		return this._spellChecker;
	}

	async _ensureNoteCreated() {
		if (!this._item.id) {
			return this._item.saveTx();
		}
	}

	async _save(noteData, skipDateModifiedUpdate) {
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
				await Zotero.DB.executeTransaction(async () => {
					let changed = this._item.setNote(html);
					if (changed && !this._disableSaving) {
						await this._item.save({
							skipDateModifiedUpdate,
							notifierData: {
								// Use a longer timeout to avoid repeated syncing during typing
								autoSyncDelay: Zotero.Notes.AUTO_SYNC_DELAY,
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
					var id = await item.saveTx({
						notifierData: {
							autoSyncDelay: Zotero.Notes.AUTO_SYNC_DELAY
						}
					});
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
			throw e;
		}
		
		// Reset spell checker as ProseMirror DOM modifications are
		// often ignored otherwise
		try {
			let spellChecker = this._getSpellChecker();
			spellChecker.toggleEnabled();
			spellChecker.toggleEnabled();
		} catch(e) {
			Zotero.logError(e);
		}
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
		return new Promise((resolve, reject) => {
			let blob = new Blob([buf], { type: item.attachmentContentType });
			let reader = new FileReader();
			reader.onloadend = function () {
				resolve(reader.result);
			}
			reader.onerror = function (e) {
				reject("FileReader error: " + e);
			};
			reader.readAsDataURL(blob);
		});
	}

	// TODO: Allow only one quickFormat dialog
	async _openQuickFormatDialog(nodeID, citationData, filterLibraryIDs, openedEmpty) {
		await Zotero.Styles.init();
		let that = this;
		let win;
		
		/**
		 * Citation editing functions and properties accessible to quickFormat.js and addCitationDialog.js
		 */
		let CI = function (citation) {
			this.citation = citation;
			this.filterLibraryIDs = filterLibraryIDs;
			this.disableClassicDialog = true;
			
			// Cited items updated in `getItems`
			this.citedItems = [];
		};

		CI.prototype = {
		
			/**
			 * 1) Provide `quickFormat` dialog with items created from
			 * `itemData`, without dealing with `Zotero.Integration.sessions`
			 *
			 * 2) Allow to pick already cited item from `quickFormat` dropdown
			 *
			 * @param citationItem
			 * @returns {Zotero.Item|undefined}
			 */
			customGetItem(citationItem) {
				// Using `id` as cited item index from `getItems` below
				let citedItem = typeof citationItem.id === 'string'
					&& this.citedItems[parseInt(citationItem.id.split('cited:')[1])];
				
				// Return cited item picked in `quickFormat` dropdown
				if (citedItem) {
					return citedItem.item;
				}
				// Provide an item created from `itemData`
				else if (!citationItem.id && citationItem.itemData) {
					let item = new Zotero.Item();
					Zotero.Utilities.itemFromCSLJSON(item, citationItem.itemData);
					return item;
				}
				// Otherwise returns `undefined` which makes this function to be
			},
			
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
				// Normally `this.citation.citationItems` should be sorted by
				// citation preview, but in our editor it doesn't make sense
				// to do so, because we don't have a real style here and
				// it's not the final document
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
				};

				for (let citationItem of citation.citationItems) {
					let citedItem = typeof citationItem.id === 'string'
						&& this.citedItems[parseInt(citationItem.id.split('cited:')[1])];
					
					// Cited item
					if (citedItem) {
						let ci = citedItem.citationItem;
						citationItem.uris = ci.uris;
						citationItem.itemData = ci.itemData;
					}
					// New item
					else if (citationItem.id) {
						let item = await Zotero.Items.getAsync(parseInt(citationItem.id));
						citationItem.uris = [Zotero.URI.getItemURI(item)];
						citationItem.itemData = Zotero.Utilities.Item.itemToCSLJSON(item);
					}
					// Otherwise it's existing item, so just passing untouched citationItem
					
					delete citationItem.id;
				}
				
				if (progressCallback || !citationData.citationItems.length || openedEmpty) {
					that._postMessage({ action: 'setCitation', nodeID, citation });
				}
			},

			/**
			 * Get a list of items used in the current document
			 * @return {Promise} A promise resolved by the items
			 */
			getItems: async function () {
				// Zotero.debug('CI: getItems');
				let note = that._item.note;

				let parser = new DOMParser();
				let doc = parser.parseFromString(note, 'text/html');
				
				let metadataContainer = doc.querySelector('body > div[data-schema-version]');
				if (metadataContainer) {
					let citationItems = metadataContainer.getAttribute('data-citation-items');
					if (citationItems) {
						try {
							citationItems = JSON.parse(decodeURIComponent(citationItems));
							let items = [];
							for (let citationItem of citationItems) {
								let item = new Zotero.Item();
								Zotero.Utilities.itemFromCSLJSON(item, citationItem.itemData);
								// This is the only way to pass our custom id for already cited
								// items, without modifying `quickFormat` dialog too much.
								// Must not contain `/`
								item.cslItemID = 'cited:' + items.length;
								items.push({ item, citationItem });
							}
							this.citedItems = items;
							return items.map(x => x.item);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
				}
				return [];
			}
		};


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
		var io = new CI(citation);

		var allOptions = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if (Zotero.isLinux) allOptions += ',dialog=no';
		// if(options) allOptions += ','+options;

		var mode = (!Zotero.isMac && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')
			? 'popup' : 'alwaysRaised') + ',resizable=false,centerscreen';

		win = that._quickFormatWindow = Zotero.openWindow(null, 'chrome://zotero/content/integration/quickFormat.xhtml', '', mode, {
			wrappedJSObject: io
		});
	}

	// TODO: This should be moved to utilities
	static async getItemFromURIs(uris) {
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
	 * Create note from annotations
	 *
	 * @param {Zotero.Item[]} annotations
	 * @param {Object} options
	 * @param {Integer} options.parentID - Creates standalone note if not provided
	 * @param {Integer} options.collectionID - Only valid if parentID not provided
	 * @returns {Promise<Zotero.Item>}
	 */
	static async createNoteFromAnnotations(annotations, { parentID, collectionID } = {}) {
		if (!annotations.length) {
			throw new Error("No annotations provided");
		}
		
		for (let annotation of annotations) {
			if (annotation.annotationType === 'image'
				&& !await Zotero.Annotations.hasCacheImage(annotation)) {
				try {
					await Zotero.PDFWorker.renderAttachmentAnnotations(annotation.parentID);
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
		if (parentID) {
			note.parentID = parentID;
		}
		else if (collectionID) {
			note.addToCollection(collectionID);
		}
		await note.saveTx();
		let editorInstance = new EditorInstance();
		editorInstance._item = note;
		let jsonAnnotations = [];
		for (let annotation of annotations) {
			let attachmentItem = Zotero.Items.get(annotation.parentID);
			let jsonAnnotation = await Zotero.Annotations.toJSON(annotation);
			jsonAnnotation.attachmentItemID = attachmentItem.id;
			jsonAnnotation.id = annotation.key;
			jsonAnnotations.push(jsonAnnotation);
		}

		let vars = {
			title: Zotero.getString('pdfReader.annotations'),
			date: new Date().toLocaleString()
		};
		let html = Zotero.Utilities.Internal.generateHTMLFromTemplate(Zotero.Prefs.get('annotations.noteTemplates.title'), vars);
		// New line is needed for note title parser
		html += '\n';

		await editorInstance.importImages(jsonAnnotations);

		let multipleParentParent = false;
		let lastParentParentID;
		let lastParentID;
		// Group annotations per attachment
		let groups = [];
		for (let i = 0; i < annotations.length; i++) {
			let annotation = annotations[i];
			let jsonAnnotation = jsonAnnotations[i];
			let parentParentID = annotation.parentItem.parentID;
			let parentID = annotation.parentID;
			if (groups.length) {
				if (parentParentID !== lastParentParentID) {
					// Multiple top level regular items detected, allow including their titles
					multipleParentParent = true;
				}
			}
			if (!groups.length || parentID !== lastParentID) {
				groups.push({
					parentTitle: annotation.parentItem.getDisplayTitle(),
					parentParentID,
					parentParentTitle: annotation.parentItem.parentItem && annotation.parentItem.parentItem.getDisplayTitle(),
					jsonAnnotations: [jsonAnnotation]
				});
			}
			else {
				let group = groups[groups.length - 1];
				group.jsonAnnotations.push(jsonAnnotation);
			}
			lastParentParentID = parentParentID;
			lastParentID = parentID;
		}
		let citationItems = [];
		lastParentParentID = null;
		for (let group of groups) {
			if (multipleParentParent && group.parentParentTitle && lastParentParentID !== group.parentParentID) {
				html += `<h2>${group.parentParentTitle}</h2>\n`;
			}
			lastParentParentID = group.parentParentID;
			// If attachment doesn't have a parent or there are more attachments with the same parent, show attachment title
			if (!group.parentParentID || groups.filter(x => x.parentParentID === group.parentParentID).length > 1) {
				html += `<h3>${group.parentTitle}</h3>\n`;
			}
			let { html: _html, citationItems: _citationItems } = Zotero.EditorInstanceUtilities.serializeAnnotations(group.jsonAnnotations, true);
			html += _html + '\n';
			for (let _citationItem of _citationItems) {
				if (!citationItems.find(item => item.uris.some(uri => _citationItem.uris.includes(uri)))) {
					citationItems.push(_citationItem);
				}
			}
		}
		citationItems = encodeURIComponent(JSON.stringify(citationItems));
		// Note: Update schema version only if using new features.
		let schemaVersion = 9;
		// If using underline annotations, increase schema version number
		// TODO: Can be removed once most clients support schema version 10
		if (schemaVersion === 9 && annotations.some(x => x.annotationType === 'underline')) {
			schemaVersion = 10;
		}
		html = `<div data-citation-items="${citationItems}" data-schema-version="${schemaVersion}">${html}</div>`;
		note.setNote(html);
		await note.saveTx();
		return note;
	}
}

class EditorInstanceUtilities {
	/**
	 * Serialize annotations into HTML
	 *
	 * @param {Object[]} annotations JSON annotations
	 * @param {Boolean} skipEmbeddingItemData Do not add itemData to citation items
	 * @return {Object} Object with `html` string and `citationItems` array to embed into metadata container
	 */
	serializeAnnotations(annotations, skipEmbeddingItemData) {
		let storedCitationItems = [];
		let html = '';
		for (let annotation of annotations) {
			let attachmentItem = Zotero.Items.get(annotation.attachmentItemID);
			if (!attachmentItem) {
				continue;
			}

			if (!annotation.text
				&& !annotation.comment
				&& !annotation.imageAttachmentKey
				|| annotation.type === 'ink') {
				continue;
			}

			let citationHTML = '';
			let imageHTML = '';
			let highlightHTML = '';
			let quotedHighlightHTML = '';
			let commentHTML = '';

			let storedAnnotation = {
				attachmentURI: Zotero.URI.getItemURI(attachmentItem),
				annotationKey: annotation.id,
				color: annotation.color,
				pageLabel: annotation.pageLabel,
				position: annotation.position
			};

			// Citation
			let parentItem = attachmentItem.parentID && Zotero.Items.get(attachmentItem.parentID);
			if (parentItem) {
				let uris = [Zotero.URI.getItemURI(parentItem)];
				let citationItem = {
					uris,
					locator: annotation.pageLabel
				};

				// Note: integration.js` uses `Zotero.Cite.System.prototype.retrieveItem`,
				// which produces a little bit different CSL JSON
				let itemData = Zotero.Utilities.Item.itemToCSLJSON(parentItem);
				if (!skipEmbeddingItemData) {
					citationItem.itemData = itemData;
				}

				let item = storedCitationItems.find(item => item.uris.some(uri => uris.includes(uri)));
				if (!item) {
					storedCitationItems.push({ uris, itemData });
				}

				storedAnnotation.citationItem = citationItem;
				let citation = {
					citationItems: [citationItem],
					properties: {}
				};

				let citationWithData = JSON.parse(JSON.stringify(citation));
				citationWithData.citationItems[0].itemData = itemData;
				let formatted = Zotero.EditorInstanceUtilities.formatCitation(citationWithData);
				citationHTML = `<span class="citation" data-citation="${encodeURIComponent(JSON.stringify(citation))}">${formatted}</span>`;
			}

			// Image
			if (annotation.imageAttachmentKey) {
				// // let imageAttachmentKey = await this._importImage(annotation.image);
				// delete annotation.image;

				// Normalize image dimensions to 1.25 of the print size
				let rect = annotation.position.rects[0];
				let rectWidth = rect[2] - rect[0];
				let rectHeight = rect[3] - rect[1];
				// Constants from pdf.js
				const CSS_UNITS = 96.0 / 72.0;
				const PDFJS_DEFAULT_SCALE = 1.25;
				let width = Math.round(rectWidth * CSS_UNITS * PDFJS_DEFAULT_SCALE);
				let height = Math.round(rectHeight * width / rectWidth);
				imageHTML = `<img data-attachment-key="${annotation.imageAttachmentKey}" width="${width}" height="${height}" data-annotation="${encodeURIComponent(JSON.stringify(storedAnnotation))}"/>`;
			}

			// Text
			if (annotation.text) {
				let text = this._transformTextToHTML(annotation.text.trim());
				highlightHTML = `<span class="${annotation.type}" data-annotation="${encodeURIComponent(JSON.stringify(storedAnnotation))}">${text}</span>`;
				quotedHighlightHTML = `<span class="${annotation.type}" data-annotation="${encodeURIComponent(JSON.stringify(storedAnnotation))}">${Zotero.getString('punctuation.openingQMark')}${text}${Zotero.getString('punctuation.closingQMark')}</span>`;
			}

			// Note
			if (annotation.comment) {
				commentHTML = this._transformTextToHTML(annotation.comment.trim());
			}

			let template;
			if (['highlight', 'underline'].includes(annotation.type)) {
				template = Zotero.Prefs.get('annotations.noteTemplates.highlight');
			}
			else if (['note', 'text'].includes(annotation.type)) {
				template = Zotero.Prefs.get('annotations.noteTemplates.note');
			}
			else if (annotation.type === 'image') {
				template = '<p>{{image}}<br/>{{citation}} {{comment}}</p>';
			}

			Zotero.debug('Using note template:');
			Zotero.debug(template);

			template = template.replace(
				/(<blockquote>[^<>]*?)({{highlight}})([\s\S]*?<\/blockquote>)/g,
				(match, p1, p2, p3) => p1 + "{{highlight quotes='false'}}" + p3
			);

			let vars = {
				color: annotation.color || '',
				// Include quotation marks by default, but allow to disable with `quotes='false'`
				highlight: (attrs) => attrs.quotes === 'false' ? highlightHTML : quotedHighlightHTML,
				comment: commentHTML,
				citation: citationHTML,
				image: imageHTML,
				tags: (attrs) => (annotation.tags && annotation.tags.map(tag => tag.name) || []).join(attrs.join || ' ')
			};

			let templateHTML = Zotero.Utilities.Internal.generateHTMLFromTemplate(template, vars);
			// Remove some spaces at the end of paragraph
			templateHTML = templateHTML.replace(/([\s]*)(<\/p)/g, '$2');
			// Remove multiple spaces
			templateHTML = templateHTML.replace(/\s\s+/g, ' ');
			html += templateHTML;
		}
		return { html, citationItems: storedCitationItems };
	}

	/**
	 * Transform plain text, containing some supported HTML tags, into actual HTML.
	 * A similar code is also used in pdf-reader mini editor for annotation text and comments.
	 * It basically creates a text node and then parses and wraps specific parts
	 * of it into supported HTML tags
	 *
	 * @param text Plain text flavored with some HTML tags
	 * @returns {string} HTML
	 * @private
	 */
	_transformTextToHTML(text) {
		const supportedFormats = ['i', 'b', 'sub', 'sup'];

		function getFormatter(str) {
			let results = supportedFormats.map(format => str.toLowerCase().indexOf('<' + format + '>'));
			results = results.map((offset, idx) => [supportedFormats[idx], offset]);
			results.sort((a, b) => a[1] - b[1]);
			for (let result of results) {
				let format = result[0];
				let offset = result[1];
				if (offset < 0) continue;
				let lastIndex = str.toLowerCase().indexOf('</' + format + '>', offset);
				if (lastIndex >= 0) {
					let parts = [];
					parts.push(str.slice(0, offset));
					parts.push(str.slice(offset + format.length + 2, lastIndex));
					parts.push(str.slice(lastIndex + format.length + 3));
					return {
						format,
						parts
					};
				}
			}
			return null;
		}

		function walkFormat(parent) {
			let child = parent.firstChild;
			while (child) {
				if (child.nodeType === 3) {
					let text = child.nodeValue;
					let formatter = getFormatter(text);
					if (formatter) {
						let nodes = [];
						nodes.push(doc.createTextNode(formatter.parts[0]));
						let midNode = doc.createElement(formatter.format);
						midNode.appendChild(doc.createTextNode(formatter.parts[1]));
						nodes.push(midNode);
						nodes.push(doc.createTextNode(formatter.parts[2]));
						child.replaceWith(...nodes);
						child = midNode;
					}
				}
				walkFormat(child);
				child = child.nextSibling;
			}
		}

		let parser = new DOMParser();
		let doc = parser.parseFromString('', 'text/html');

		// innerText transforms \n into <br>
		doc.body.innerText = text;
		walkFormat(doc.body);
		return doc.body.innerHTML;
	}

	/**
	 * Build citation item preview string (based on _buildBubbleString in quickFormat.js)
	 * TODO: Try to avoid duplicating this code here and inside note-editor
	 */
	_formatCitationItemPreview(citationItem) {
		const STARTSWITH_ROMANESQUE_REGEXP = /^[&a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/;
		const ENDSWITH_ROMANESQUE_REGEXP = /[.;:&a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]$/;

		let { itemData } = citationItem;
		let str = '';

		// Authors
		let authors = itemData.author;
		if (authors) {
			if (authors.length === 1) {
				str = authors[0].family || authors[0].literal;
			}
			else if (authors.length === 2) {
				let a = authors[0].family || authors[0].literal;
				let b = authors[1].family || authors[1].literal;
				str = Zotero.getString('general.andJoiner', [a, b]);
			}
			else if (authors.length >= 3) {
				str = (authors[0].family || authors[0].literal) + ' ' + Zotero.getString('general.etAl');
			}
		}

		// Title
		if (!str && itemData.title) {
			str = `“${itemData.title}”`;
		}

		// Date
		if (itemData.issued
			&& itemData.issued['date-parts']
			&& itemData.issued['date-parts'][0]) {
			let year = itemData.issued['date-parts'][0][0];
			if (year && year != '0000') {
				str += ', ' + year;
			}
		}

		// Locator
		if (citationItem.locator) {
			if (citationItem.label) {
				// TODO: Localize and use short forms
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
		if (citationItem.prefix && ENDSWITH_ROMANESQUE_REGEXP) {
			str = citationItem.prefix
				+ (ENDSWITH_ROMANESQUE_REGEXP.test(citationItem.prefix) ? ' ' : '')
				+ str;
		}

		// Suffix
		if (citationItem.suffix && STARTSWITH_ROMANESQUE_REGEXP) {
			str += (STARTSWITH_ROMANESQUE_REGEXP.test(citationItem.suffix) ? ' ' : '')
				+ citationItem.suffix;
		}

		return str;
	}

	formatCitation(citation) {
		return '(' + citation.citationItems.map((x) => {
			return `<span class="citation-item">${this._formatCitationItemPreview(x)}</span>`;
		}).join('; ') + ')';
	}
}

Zotero.EditorInstance = EditorInstance;
Zotero.EditorInstanceUtilities = new EditorInstanceUtilities();
