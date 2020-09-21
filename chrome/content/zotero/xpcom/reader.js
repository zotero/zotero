// Temporary stuff
Zotero.PDF = {
	dateChecked: {},
	hasUnmachedAnnotations: {}
};

class ReaderWindow {
	constructor() {
		this.annotationItemIDs = [];
		this._instanceID = Zotero.Utilities.randomString();
		this._window = null;
		this._iframeWindow = null;
		this._itemID = null;
		this._state = null;
		this._prevHistory = [];
		this._nextHistory = [];
		this._isReaderInitialized = false;
	}

	init() {
		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (!win) return;

		this._window = win.open(
			'chrome://zotero/content/reader.xul', '', 'chrome,resizable'
		);

		this._window.addEventListener('DOMContentLoaded', (event) => {
			this._window.addEventListener('dragover', this._handleDragOver, true);
			this._window.addEventListener('drop', this._handleDrop, true);
			this._window.addEventListener('keypress', this._handleKeyPress);

			this._window.fillTooltip = (tooltip) => {
				let node = this._window.document.tooltipNode.closest('*[title]');
				if (!node) {
					return false;
				}
				tooltip.setAttribute('label', node.getAttribute('title'));
				return true;
			};

			this._window.menuCmd = (cmd) => {
				if (cmd === 'export') {
					let zp = Zotero.getActiveZoteroPane();
					zp.exportPDF(this._itemID);
					return;
				}
				let data = {
					action: 'menuCmd',
					cmd
				};
				this._postMessage(data);
			};

			let readerIframe = this._window.document.getElementById('reader');
			if (!(readerIframe && readerIframe.contentWindow && readerIframe.contentWindow.document === event.target)) {
				return;
			}
			let editor = this._window.document.getElementById('zotero-reader-editor');
			editor.navigateHandler = async (uri, location) => {
				let item = await Zotero.URI.getURIItem(uri);
				if (!item) {
					return;
				}
				if (item.id === this._itemID) {
					this.navigate(location);
				}
				else {
					await this.open({
						itemID: item.id,
						location
					});
				}
			};
			this._iframeWindow = this._window.document.getElementById('reader').contentWindow;
			this._iframeWindow.addEventListener('message', this._handleMessage);
		});
	}

	async open({ itemID, state, location, skipHistory }) {
		if (itemID === this._itemID) {
			return false;
		}
		let item = await Zotero.Items.getAsync(itemID);
		if (!item) {
			return false;
		}
		let path = await item.getFilePathAsync();
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		if (this._itemID && !skipHistory) {
			this._prevHistory.push({
				itemID: this._itemID,
				state: this._state
			});
			this._nextHistory = [];
		}
		this._itemID = item.id;
		let title = item.getField('title');
		let parentItemID = item.parentItemID;
		if (parentItemID) {
			let parentItem = await Zotero.Items.getAsync(parentItemID);
			if (parentItem) {
				title = parentItem.getField('title');
			}
		}
		this._window.document.title = title;
		// TODO: Remove when fixed
		item._loaded.childItems = true;
		let ids = item.getAnnotations();
		let annotations = (await Promise.all(ids.map(id => this._getAnnotation(id)))).filter(x => x);
		this.annotationItemIds = ids;
		state = state || PDFStates[this._itemID];
		this._state = state;
		this._postMessage({
			action: 'open',
			buf,
			annotations,
			state,
			location,
			enablePrev: !!this._prevHistory.length,
			enableNext: !!this._nextHistory.length,
			promptImport: !!Zotero.PDF.hasUnmachedAnnotations[this._itemID]
		}, [buf]);
		return true;
	}

	updateTitle() {
		let item = Zotero.Items.get(this._itemID);
		let title = item.getField('title');
		let parentItemID = item.parentItemID;
		if (parentItemID) {
			let parentItem = Zotero.Items.get(parentItemID);
			if (parentItem) {
				title = parentItem.getField('title');
			}
		}
		this._window.document.title = title;
	}

	async setAnnotations(ids) {
		let annotations = [];
		for (let id of ids) {
			let annotation = await this._getAnnotation(id);
			if (annotation) {
				annotations.push(annotation);
			}
		}
		if (annotations.length) {
			let data = { action: 'setAnnotations', annotations };
			this._postMessage(data);
		}
	}

	unsetAnnotations(keys) {
		let data = { action: 'unsetAnnotations', ids: keys };
		this._postMessage(data);
	}

	async navigate(location) {
		this._postMessage({ action: 'navigate', location });
	}

	toggleImportPrompt(enable) {
		this._postMessage({ action: 'toggleImportPrompt', enable });
	}

	close() {
		this._window.close();
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
			return new this._iframeWindow.Blob([u8arr], { type: mime });
		}
	}

	// TODO: Pass sidebar state to the responsible pdf-reader button
	_toggleNoteSidebar(isToggled) {
		let splitter = this._window.document.getElementById('zotero-reader-splitter');
		let sidebar = this._window.document.getElementById('zotero-reader-note-sidebar');
		if (isToggled) {
			splitter.hidden = false;
			sidebar.hidden = false;
		}
		else {
			splitter.hidden = true;
			sidebar.hidden = true;
		}
	}

	_getColorIcon(color, selected) {
		let stroke = selected ? 'lightgray' : 'transparent';
		let fill = '%23' + color.slice(1);
		return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect shape-rendering="geometricPrecision" fill="${fill}" stroke-width="2" x="2" y="2" stroke="${stroke}" width="12" height="12" rx="3"/></svg>`;
	}

	_openAnnotationPopup(x, y, annotationId, colors, selectedColor) {
		let popup = this._window.document.getElementById('annotationPopup');
		popup.hidePopup();
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}
		let menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', 'Delete');
		menuitem.addEventListener('command', () => {
			let data = {
				action: 'popupCmd',
				cmd: 'deleteAnnotation',
				id: annotationId
			};
			this._postMessage(data);
		});
		popup.appendChild(menuitem);
		popup.appendChild(this._window.document.createElement('menuseparator'));
		for (let color of colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', color[0]);
			menuitem.className = 'menuitem-iconic';
			menuitem.setAttribute('image', this._getColorIcon(color[1], color[1] === selectedColor));
			menuitem.addEventListener('command', () => {
				let data = {
					action: 'popupCmd',
					cmd: 'setAnnotationColor',
					id: annotationId,
					color: color[1]
				};
				this._postMessage(data);
			});
			popup.appendChild(menuitem);
		}
		popup.openPopupAtScreen(x, y, true);
	}

	_openColorPopup(x, y, colors, selectedColor) {
		let popup = this._window.document.getElementById('colorPopup');
		popup.hidePopup();
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}
		let menuitem;
		for (let color of colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', color[0]);
			menuitem.className = 'menuitem-iconic';
			menuitem.setAttribute('image', this._getColorIcon(color[1], color[1] === selectedColor));
			menuitem.addEventListener('command', () => {
				let data = {
					action: 'popupCmd',
					cmd: 'setColor',
					color: color[1]
				};
				this._postMessage(data);
			});
			popup.appendChild(menuitem);
		}
		popup.openPopupAtScreen(x, y, true);
	}

	async _postMessage(message, transfer) {
		await this._waitForReader();
		this._iframeWindow.postMessage({ itemId: this._itemID, message }, this._iframeWindow.origin, transfer);
	}

	_handleMessage = async (event) => {
		let message;
		try {
			if (event.source !== this._iframeWindow) {
				return;
			}
			// Clone data to avoid the dead object error when the window is closed
			let data = JSON.parse(JSON.stringify(event.data));
			// Filter messages coming from previous reader instances,
			// except for `setAnnotation` to still allow saving it
			if (data.itemId !== this._itemID && data.message.action !== 'setAnnotation') {
				return;
			}
			Zotero.debug('Received message from pdf-reader iframe: ' + JSON.stringify(data));
			message = data.message;
			switch (message.action) {
				case 'navigatePrev': {
					let prev = this._prevHistory.pop();
					if (prev) {
						this._nextHistory.push({
							itemID: this._itemID,
							state: this._state
						});
						this.open({ itemID: prev.itemID, state: prev.state, skipHistory: true });
					}
					return;
				}
				case 'navigateNext': {
					let next = this._nextHistory.pop();
					if (next) {
						this._prevHistory.push({
							itemID: this._itemID,
							state: this._state
						});
						this.open({ itemID: next.itemID, state: next.state, skipHistory: true });
					}
					return;
				}
				case 'setAnnotation': {
					let attachment = Zotero.Items.get(data.itemId);
					let { annotation } = message;
					annotation.key = annotation.id;
					let saveOptions = {
						notifierData: {
							instanceID: this._instanceID
						}
					};
					let savedAnnotation = await Zotero.Annotations.saveFromJSON(attachment, annotation, saveOptions);
					if (annotation.image) {
						let blob = this._dataURLtoBlob(annotation.image);
						let attachmentIds = savedAnnotation.getAttachments();
						if (attachmentIds.length) {
							let attachment = Zotero.Items.get(attachmentIds[0]);
							let path = await attachment.getFilePathAsync();
							await Zotero.File.putContentsAsync(path, blob);
							await Zotero.Sync.Storage.Local.updateSyncStates([attachment], 'to_upload');
							Zotero.Notifier.trigger('modify', 'item', attachment.id, { instanceID: this._instanceID });
						}
						else {
							await Zotero.Attachments.importEmbeddedImage({
								blob,
								parentItemID: savedAnnotation.id,
								saveOptions
							});
						}
					}
					return;
				}
				case 'deleteAnnotations': {
					let { ids: keys } = message;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					for (let key of keys) {
						let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
						// A small check, as we are receiving a list of item keys from a less secure code
						if (annotation && annotation.isAnnotation() && annotation.parentID === this._itemID) {
							this.annotationItemIDs = this.annotationItemIDs.filter(id => id !== annotation.id);
							await annotation.eraseTx();
						}
					}
					return;
				}
				case 'setState': {
					let { state } = message;
					PDFStates[this._itemID] = state;
					this._state = state;
					return;
				}
				case 'openTagsPopup': {
					let { id: key, x, y } = message;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
					if (annotation) {
						this._window.document.getElementById('tags').item = annotation;
						this._window.document.getElementById('tagsPopup').openPopupAtScreen(x, y, false);
					}
					return;
				}
				case 'openAnnotationPopup': {
					let { x, y, id, colors, selectedColor } = message;
					this._openAnnotationPopup(x, y, id, colors, selectedColor);
					return;
				}
				case 'openColorPopup': {
					let { x, y, colors, selectedColor } = message;
					this._openColorPopup(x, y, colors, selectedColor);
					return;
				}
				case 'openUrl': {
					let { url } = message;
					let win = Services.wm.getMostRecentWindow('navigator:browser');
					if (win) {
						win.ZoteroPane.loadURI(url);
					}
					return;
				}
				case 'import': {
					Zotero.debug('Importing PDF annotations');
					Zotero.PDFWorker.import(this._itemID, true, true);
					return;
				}
				case 'importDismiss': {
					Zotero.debug('Dismiss PDF annotations');
					return;
				}
				case 'save': {
					Zotero.debug('Exporting PDF');
					let zp = Zotero.getActiveZoteroPane();
					zp.exportPDF(this._itemID);
					return;
				}
				case 'toggleNoteSidebar': {
					let { isToggled } = message;
					this._toggleNoteSidebar(isToggled);
					return;
				}
			}
		}
		catch (e) {
			this._postMessage({
				action: 'error',
				message: `An error occured during '${message ? message.action : ''}'`,
				moreInfo: {
					message: e.message,
					stack: e.stack,
					fileName: e.fileName,
					lineNumber: e.lineNumber
				}
			});
			throw e;
		}
	}

	_handleDragOver = (event) => {
		if (event.dataTransfer.getData('zotero/item')) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	_handleDrop = (event) => {
		let data;
		if (!(data = event.dataTransfer.getData('zotero/item'))) {
			return;
		}

		let ids = data.split(',').map(id => parseInt(id));
		let item = Zotero.Items.get(ids[0]);
		if (!item) {
			return;
		}

		if (item.isNote()) {
			event.preventDefault();
			event.stopPropagation();

			let cover = this._window.document.getElementById('zotero-reader-sidebar-cover');
			let container = this._window.document.getElementById('zotero-reader-sidebar-container');
			let splitter = this._window.document.getElementById('zotero-reader-splitter');

			cover.hidden = true;
			container.hidden = false;
			splitter.hidden = false;

			let editor = this._window.document.getElementById('zotero-reader-editor');
			let notebox = this._window.document.getElementById('zotero-reader-note-sidebar');
			editor.mode = 'edit';
			notebox.hidden = false;
			editor.item = item;
		}
		else if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
			event.preventDefault();
			event.stopPropagation();
			this.open({ itemID: item.id });
		}
		else if (item.isRegularItem()) {
			let attachments = item.getAttachments();
			if (attachments.length === 1) {
				let id = attachments[0];
				let attachment = Zotero.Items.get(id);
				if (attachment.attachmentContentType === 'application/pdf') {
					event.preventDefault();
					event.stopPropagation();
					this.open({ itemID: attachment.id });
				}
			}
		}
	}

	_handleKeyPress = (event) => {
		if ((Zotero.isMac && event.metaKey || event.ctrlKey)
			&& !event.shiftKey && !event.altKey && event.key === 'w') {
			this._window.close();
		}
	}

	async _waitForReader() {
		if (this._isReaderInitialized) {
			return;
		}
		let n = 0;
		while (!this._iframeWindow || !this._iframeWindow.eval('window.isReady')) {
			if (n >= 500) {
				throw new Error('Waiting for reader failed');
			}
			await Zotero.Promise.delay(10);
			n++;
		}
		this._isReaderInitialized = true;
	}

	/**
	 * Return item JSON in the pdf-reader ready format
	 * @param itemID
	 * @returns {Object|null}
	 */
	async _getAnnotation(itemID) {
		try {
			let item = Zotero.Items.get(itemID);
			if (!item || !item.isAnnotation()) {
				return null;
			}
			// TODO: Remve when fixed
			item._loaded.childItems = true;
			item = await Zotero.Annotations.toJSON(item);
			item.id = item.key;
			item.image = item.image;
			delete item.key;
			for (let key in item) {
				item[key] = item[key] || '';
			}
			item.tags = item.tags || [];
			return item;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}
}

class Reader {
	constructor() {
		this._readerWindows = [];
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'reader');
	}

	notify(event, type, ids, extraData) {
		// Listen for the parent item, PDF attachment and its annotation items updates
		for (let readerWindow of this._readerWindows) {
			if (event === 'delete') {
				let disappearedIds = readerWindow.annotationItemIDs.filter(x => ids.includes(x));
				if (disappearedIds.length) {
					let keys = disappearedIds.map(id => extraData[id].key);
					readerWindow.unsetAnnotations(keys);
				}
				if (ids.includes(readerWindow._itemID)) {
					readerWindow.close();
				}
			}
			else {
				let item = Zotero.Items.get(readerWindow._itemID);
				// TODO: Remove when fixed
				item._loaded.childItems = true;
				let annotationItemIDs = item.getAnnotations();
				readerWindow.annotationItemIDs = annotationItemIDs;
				let affectedAnnotationIds = annotationItemIDs.filter(annotationID => {
					let annotation = Zotero.Items.get(annotationID);
					let imageAttachmentID = null;
					annotation._loaded.childItems = true;
					let annotationAttachments = annotation.getAttachments();
					if (annotationAttachments.length) {
						imageAttachmentID = annotationAttachments[0];
					}
					return (
						ids.includes(annotationID) && !(extraData[annotationID]
							&& extraData[annotationID].instanceID === readerWindow._instanceID)
						|| ids.includes(imageAttachmentID) && !(extraData[imageAttachmentID]
							&& extraData[imageAttachmentID].instanceID === readerWindow._instanceID)
					);
				});
				if (affectedAnnotationIds.length) {
					readerWindow.setAnnotations(affectedAnnotationIds);
				}
				// Update title if the PDF attachment or the parent item changes
				if (ids.includes(readerWindow._itemID) || ids.includes(item.parentItemID)) {
					readerWindow.updateTitle();
				}
			}
		}
	}

	_getReaderWindow(itemID) {
		return this._readerWindows.find(v => v._itemID === itemID);
	}

	async openURI(itemURI, location) {
		let item = await Zotero.URI.getURIItem(itemURI);
		if (!item) return;
		this.open(item.id, location);
	}

	async open(itemID, location) {
		this.triggerAnnotationsImportCheck(itemID);
		let reader = this._getReaderWindow(itemID);
		if (reader) {
			if (location) {
				reader.navigate(location);
			}
		}
		else {
			reader = new ReaderWindow();
			reader.init();
			if (!(await reader.open({ itemID, location }))) {
				return;
			}
			this._readerWindows.push(reader);
			reader._window.addEventListener('unload', () => {
				this._readerWindows.splice(this._readerWindows.indexOf(reader), 1);
			});
		}
		reader._window.focus();
	}

	async triggerAnnotationsImportCheck(itemID) {
		let item = await Zotero.Items.getAsync(itemID);
		let mtime = await item.attachmentModificationTime;
		let dateModified = Zotero.Date.dateToISO(new Date(mtime));
		if (!Zotero.PDF.dateChecked[itemID] || Zotero.PDF.dateChecked[itemID] < dateModified) {
			await Zotero.PDFWorker.import(itemID, false);
		}
	}
}

Zotero.Reader = new Reader();
