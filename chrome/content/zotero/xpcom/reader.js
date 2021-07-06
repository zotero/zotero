/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
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

class ReaderInstance {
	constructor() {
		this.pdfStateFileName = '.zotero-pdf-state';
		this.annotationItemIDs = [];
		this.onChangeSidebarWidth = null;
		this.state = null;
		this._instanceID = Zotero.Utilities.randomString();
		this._window = null;
		this._iframeWindow = null;
		this._itemID = null;
		this._isReaderInitialized = false;
		this._showItemPaneToggle = false;
		this._initPromise = new Promise((resolve, reject) => {
			this._resolveInitPromise = resolve;
			this._rejectInitPromise = reject;
		});
	}

	focus() {
		try {
			this._iframeWindow.document.querySelector('#viewerContainer').focus();
		}
		catch (e) {
		}
	}

	async open({ itemID, state, location }) {
		let item = await Zotero.Items.getAsync(itemID);
		if (!item) {
			return false;
		}
		this.state = state;
		this._itemID = item.id;
		// Set `ReaderTab` title as fast as possible
		this.updateTitle();
		let path = await item.getFilePathAsync();
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		let annotationItems = item.getAnnotations();
		let annotations = (await Promise.all(annotationItems.map(x => this._getAnnotation(x)))).filter(x => x);
		this.annotationItemIDs = annotationItems.map(x => x.id);
		state = state || await this._getState();
		this._postMessage({
			action: 'open',
			buf,
			annotations,
			state,
			location,
			promptImport: false,
			readOnly: this._isReadOnly(),
			showItemPaneToggle: this._showItemPaneToggle,
			sidebarWidth: this._sidebarWidth,
			sidebarOpen: this._sidebarOpen,
			bottomPlaceholderHeight: this._bottomPlaceholderHeight,
			localizedStrings: {
				...Zotero.Intl.getPrefixedStrings('general.'),
				...Zotero.Intl.getPrefixedStrings('pdfReader.')
			}
		}, [buf]);
		// Set title once again, because `ReaderWindow` isn't loaded the first time
		this.updateTitle();
		return true;
	}
	
	get itemID() {
		return this._itemID;
	}
	
	updateTitle() {
		let item = Zotero.Items.get(this._itemID);
		let title = item.getDisplayTitle();
		let parentItemID = item.parentItemID;
		if (parentItemID) {
			let parentItem = Zotero.Items.get(parentItemID);
			if (parentItem) {
				title = parentItem.getDisplayTitle();
			}
		}
		this._setTitleValue(title);
	}

	async setAnnotations(items) {
		let annotations = [];
		for (let item of items) {
			let annotation = await this._getAnnotation(item);
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
	
	enableAddToNote(enable) {
		this._postMessage({ action: 'enableAddToNote', enable });
	}
	
	setSidebarWidth(width) {
		this._postMessage({ action: 'setSidebarWidth', width });
	}
	
	setSidebarOpen(open) {
		this._postMessage({ action: 'setSidebarOpen', open });
	}
	
	async setBottomPlaceholderHeight(height) {
		await this._initPromise;
		this._postMessage({ action: 'setBottomPlaceholderHeight', height });
	}
	
	async setToolbarPlaceholderWidth(width) {
		await this._initPromise;
		this._postMessage({ action: 'setToolbarPlaceholderWidth', width });
	}
	
	isHandToolActive() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfCursorTools.handTool.active');
	}
	
	allowNavigateFirstPage() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfViewer.currentPageNumber > 1');
	}
	
	allowNavigateLastPage() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfViewer.currentPageNumber < PDFViewerApplication.pdfViewer.pagesCount');
	}
	
	allowNavigateBack() {
		try {
			let { uid } = this._iframeWindow.history.state;
			if (uid == 0) {
				return false;
			}
		}
		catch (e) {
		}
		return true;
	}
	
	allowNavigateForward() {
		try {
			let { uid } = this._iframeWindow.history.state;
			let length = this._iframeWindow.history.length;
			if (uid == length - 1) {
				return false;
			}
		}
		catch (e) {
		}
		return true;
	}
	
	menuCmd(cmd) {
		if (cmd === 'export') {
			let zp = Zotero.getActiveZoteroPane();
			zp.exportPDF(this._itemID);
			return;
		}
		else if (cmd === 'showInLibrary') {
			let id = this._itemID;
			let item = Zotero.Items.get(this._itemID);
			if (item && item.parentItemID) {
				id = item.parentItemID;
			}
			let win = Zotero.getMainWindow();
			if (win) {
				win.ZoteroPane.selectItems([id]);
				win.Zotero_Tabs.select('zotero-pane');
				win.focus();
			}
			return;
		}

		let data = {
			action: 'menuCmd',
			cmd
		};
		this._postMessage(data);
	}

	async _setState(state) {
		this.state = state;
		let item = Zotero.Items.get(this._itemID);
		if (item) {
			item.setAttachmentLastPageIndex(state.pageIndex);
			let file = Zotero.Attachments.getStorageDirectory(item);
			if (!await OS.File.exists(file.path)) {
				await Zotero.Attachments.createDirectoryForItem(item);
			}
			file.append(this.pdfStateFileName);
			await Zotero.File.putContentsAsync(file, JSON.stringify(state));
		}
	}

	async _getState() {
		let item = Zotero.Items.get(this._itemID);
		let file = Zotero.Attachments.getStorageDirectory(item);
		file.append(this.pdfStateFileName);
		file = file.path;
		let state;
		try {
			if (await OS.File.exists(file)) {
				state = JSON.parse(await Zotero.File.getContentsAsync(file));
			}
		}
		catch (e) {
			Zotero.logError(e);
		}

		let pageIndex = item.getAttachmentLastPageIndex();
		if (state) {
			if (Number.isInteger(pageIndex) && state.pageIndex !== pageIndex) {
				state.pageIndex = pageIndex;
				delete state.top;
				delete state.left;
			}
			return state;
		}
		else if (Number.isInteger(pageIndex)) {
			return { pageIndex };
		}
		return null;
	}

	_isReadOnly() {
		let item = Zotero.Items.get(this._itemID);
		return !item.isEditable()
			|| item.deleted
			|| item.parentItem && item.parentItem.deleted;
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

	_getColorIcon(color, selected) {
		let stroke = selected ? 'lightgray' : 'transparent';
		let fill = '%23' + color.slice(1);
		return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect shape-rendering="geometricPrecision" fill="${fill}" stroke-width="2" x="2" y="2" stroke="${stroke}" width="12" height="12" rx="3"/></svg>`;
	}

	_openTagsPopup(x, y, item) {
		let menupopup = this._window.document.createElement('menupopup');
		menupopup.style.minWidth = '300px';
		menupopup.setAttribute('ignorekeys', true);
		let tagsbox = this._window.document.createElement('tagsbox');
		menupopup.appendChild(tagsbox);
		tagsbox.setAttribute('flex', '1');
		this._popupset.appendChild(menupopup);
		menupopup.openPopupAtScreen(x, y, false);
		tagsbox.mode = 'edit';
		tagsbox.item = item;
	}
	
	_openPagePopup(data) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		if (data.text) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('general.copy'));
			menuitem.addEventListener('command', () => {
				Zotero.Utilities.Internal.copyTextToClipboard(data.text);
			});
			popup.appendChild(menuitem);
			// Separator
			popup.appendChild(this._window.document.createElement('menuseparator'));
		}
		// Zoom in
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomIn'));
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomIn' });
		});
		popup.appendChild(menuitem);
		// Zoom out
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomOut'));
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomOut' });
		});
		popup.appendChild(menuitem);
		// Zoom 'Auto'
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomAuto'));
		menuitem.setAttribute('checked', data.isZoomAuto);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomAuto' });
		});
		popup.appendChild(menuitem);
		// Zoom 'Page Width'
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomPageWidth'));
		menuitem.setAttribute('checked', data.isZoomPageWidth);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomPageWidth' });
		});
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Next page
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.nextPage'));
		menuitem.setAttribute('disabled', !data.enableNextPage);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'nextPage' });
		});
		popup.appendChild(menuitem);
		// Previous page
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.previousPage'));
		menuitem.setAttribute('disabled', !data.enablePrevPage);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'prevPage' });
		});
		popup.appendChild(menuitem);
		popup.openPopupAtScreen(data.x, data.y, true);
	}

	_openAnnotationPopup(x, y, ids, colors, selectedColor, readOnly) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		// Add to note
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.addToNote'));
		let hasActiveEditor = this._window.ZoteroContextPane && this._window.ZoteroContextPane.getActiveEditor();
		menuitem.setAttribute('disabled', !hasActiveEditor);
		menuitem.addEventListener('command', () => {
			let data = {
				action: 'popupCmd',
				cmd: 'addToNote',
				ids
			};
			this._postMessage(data);
		});
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Colors
		for (let color of colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString(color[0]));
			menuitem.className = 'menuitem-iconic';
			menuitem.setAttribute('disabled', readOnly);
			menuitem.setAttribute('image', this._getColorIcon(color[1], color[1] === selectedColor));
			menuitem.addEventListener('command', () => {
				let data = {
					action: 'popupCmd',
					cmd: 'setAnnotationColor',
					ids,
					color: color[1]
				};
				this._postMessage(data);
			});
			popup.appendChild(menuitem);
		}
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Delete
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('general.delete'));
		menuitem.setAttribute('disabled', readOnly);
		menuitem.addEventListener('command', () => {
			let data = {
				action: 'popupCmd',
				cmd: 'deleteAnnotation',
				ids
			};
			this._postMessage(data);
		});
		popup.appendChild(menuitem);
		popup.openPopupAtScreen(x, y, true);
	}

	_openColorPopup(elementID, colors, selectedColor) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		for (let color of colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString(color[0]));
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
		let element = this._iframeWindow.document.getElementById(elementID);
		popup.openPopup(element, 'after_start', 0, 0, true);
	}

	async _postMessage(message, transfer) {
		await this._waitForReader();
		this._iframeWindow.postMessage({ itemID: this._itemID, message }, this._iframeWindow.origin, transfer);
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
			if (data.itemID !== this._itemID && data.message.action !== 'setAnnotation') {
				return;
			}
			message = data.message;
			switch (message.action) {
				case 'initialized': {
					this._resolveInitPromise();
					return;
				}
				case 'setAnnotation': {
					let attachment = Zotero.Items.get(data.itemID);
					let { annotation } = message;
					annotation.key = annotation.id;
					let saveOptions = {
						notifierData: {
							instanceID: this._instanceID
						}
					};
					let savedAnnotation = await Zotero.Annotations.saveFromJSON(attachment, annotation, saveOptions);
					
					if (annotation.image && !await Zotero.Annotations.hasCacheImage(savedAnnotation)) {
						let blob = this._dataURLtoBlob(annotation.image);
						await Zotero.Annotations.saveCacheImage(savedAnnotation, blob);
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
					await this._setState(state);
					return;
				}
				case 'openTagsPopup': {
					let { id: key, x, y } = message;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
					if (annotation) {
						this._openTagsPopup(x, y, annotation);
					}
					return;
				}
				case 'openPagePopup': {
					this._openPagePopup(message);
					return;
				}
				case 'openAnnotationPopup': {
					let { x, y, ids, colors, selectedColor, readOnly } = message;
					this._openAnnotationPopup(x, y, ids, colors, selectedColor, readOnly);
					return;
				}
				case 'openColorPopup': {
					let { elementID, colors, selectedColor } = message;
					this._openColorPopup(elementID, colors, selectedColor);
					return;
				}
				case 'openURL': {
					let { url } = message;
					let win = Services.wm.getMostRecentWindow('navigator:browser');
					if (win) {
						win.ZoteroPane.loadURI(url);
					}
					return;
				}
				case 'addToNote': {
					let { annotations } = message;
					this._addToNote(annotations);
					return;
				}
				case 'save': {
					let zp = Zotero.getActiveZoteroPane();
					zp.exportPDF(this._itemID);
					return;
				}
				case 'toggleNoteSidebar': {
					let { isToggled } = message;
					this._toggleNoteSidebar(isToggled);
					return;
				}
				case 'changeSidebarWidth': {
					let { width } = message;
					if (this.onChangeSidebarWidth) {
						this.onChangeSidebarWidth(width);
					}
					return;
				}
				case 'changeSidebarOpen': {
					let { open } = message;
					if (this.onChangeSidebarOpen) {
						this.onChangeSidebarOpen(open);
					}
					return;
				}
			}
		}
		catch (e) {
			let crash = message && ['setAnnotation'].includes(message.action);
			this._postMessage({
				action: crash ? 'crash' : 'error',
				message: `${Zotero.getString('general.error')}: '${message ? message.action : ''}'`,
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
	 *
	 * @param {Zotero.Item} item
	 * @returns {Object|null}
	 */
	async _getAnnotation(item) {
		try {
			if (!item || !item.isAnnotation()) {
				return null;
			}
			let json = await Zotero.Annotations.toJSON(item);
			json.id = item.key;
			delete json.key;
			for (let key in json) {
				json[key] = json[key] || '';
			}
			json.tags = json.tags || [];
			return json;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}
}

class ReaderTab extends ReaderInstance {
	constructor({ itemID, sidebarWidth, sidebarOpen, bottomPlaceholderHeight }) {
		super();
		this._itemID = itemID;
		this._sidebarWidth = sidebarWidth;
		this._sidebarOpen = sidebarOpen;
		this._bottomPlaceholderHeight = bottomPlaceholderHeight;
		this._showItemPaneToggle = true;
		this._window = Services.wm.getMostRecentWindow('navigator:browser');
		let { id, container } = this._window.Zotero_Tabs.add({
			type: 'reader',
			title: '',
			select: true,
			notifierData: {
				itemID
			}
		});
		this.tabID = id;
		this._tabContainer = container;
		
		this._iframe = this._window.document.createElement('browser');
		this._iframe.setAttribute('flex', '1');
		this._iframe.setAttribute('type', 'content');
		this._iframe.setAttribute('src', 'resource://zotero/pdf-reader/viewer.html');
		this._tabContainer.appendChild(this._iframe);
		
		this._popupset = this._window.document.createElement('popupset');
		this._tabContainer.appendChild(this._popupset);
		
		this._window.addEventListener('DOMContentLoaded', (event) => {
			if (this._iframe && this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
				this._iframeWindow = this._iframe.contentWindow;
				this._iframeWindow.addEventListener('message', this._handleMessage);
				this._iframeWindow.addEventListener('error', (event) => {
					Zotero.logError(event.error);
				});
			}
		});
		
		this._iframe.setAttribute('tooltip', 'html-tooltip');
	}
	
	close() {
		if (this.tabID) {
			this._window.Zotero_Tabs.close(this.tabID);
		}
	}
	
	_toggleNoteSidebar(isToggled) {
		let itemPane = this._window.document.getElementById('zotero-item-pane');
		if (itemPane.hidden) {
			itemPane.hidden = false;
		}
		else {
			itemPane.hidden = true;
		}
	}
	
	_setTitleValue(title) {
		this._window.Zotero_Tabs.rename(this.tabID, title);
	}

	_addToNote(annotations) {
		let noteEditor = this._window.ZoteroContextPane && this._window.ZoteroContextPane.getActiveEditor();
		if (!noteEditor) {
			return;
		}
		let editorInstance = noteEditor.getCurrentInstance();
		if (editorInstance) {
			editorInstance.focus();
			editorInstance.insertAnnotations(annotations);
		}
	}
}


class ReaderWindow extends ReaderInstance {
	constructor({ sidebarWidth, sidebarOpen, bottomPlaceholderHeight }) {
		super();
		this._sidebarWidth = sidebarWidth;
		this._sidebarOpen = sidebarOpen;
		this._bottomPlaceholderHeight = 0;
		this.init();
	}

	init() {
		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (!win) return;

		this._window = win.open(
			'chrome://zotero/content/reader.xul', '', 'chrome,resizable'
		);

		this._window.addEventListener('DOMContentLoaded', (event) => {
			if (event.target === this._window.document) {
				this._window.addEventListener('keypress', this._handleKeyPress);
				this._popupset = this._window.document.getElementById('zotero-reader-popupset');
				this._window.menuCmd = this.menuCmd.bind(this);
				this._window.onGoMenuOpen = this._onGoMenuOpen.bind(this);
				this._window.onViewMenuOpen = this._onViewMenuOpen.bind(this);
				this._iframe = this._window.document.getElementById('reader');
			}

			if (this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
				this._iframeWindow = this._window.document.getElementById('reader').contentWindow;
				this._iframeWindow.addEventListener('message', this._handleMessage);
			}
		});
	}

	close() {
		this._window.close();
	}

	_setTitleValue(title) {
		this._window.document.title = title;
	}

	_handleKeyPress = (event) => {
		if ((Zotero.isMac && event.metaKey || event.ctrlKey)
			&& !event.shiftKey && !event.altKey && event.key === 'w') {
			this._window.close();
		}
	}

	_onViewMenuOpen() {
		this._window.document.getElementById('view-menuitem-vertical-scrolling').setAttribute('checked', this.state.scrollMode == 0);
		this._window.document.getElementById('view-menuitem-horizontal-scrolling').setAttribute('checked', this.state.scrollMode == 1);
		this._window.document.getElementById('view-menuitem-wrapped-scrolling').setAttribute('checked', this.state.scrollMode == 2);
		this._window.document.getElementById('view-menuitem-no-spreads').setAttribute('checked', this.state.spreadMode == 0);
		this._window.document.getElementById('view-menuitem-odd-spreads').setAttribute('checked', this.state.spreadMode == 1);
		this._window.document.getElementById('view-menuitem-even-spreads').setAttribute('checked', this.state.spreadMode == 2);
		this._window.document.getElementById('view-menuitem-hand-tool').setAttribute('checked', this.isHandToolActive());
	}

	_onGoMenuOpen() {
		let keyBack = this._window.document.getElementById('key_back');
		let keyForward = this._window.document.getElementById('key_forward');

		if (Zotero.isMac) {
			keyBack.setAttribute('key', '[');
			keyBack.setAttribute('modifiers', 'meta');
			keyForward.setAttribute('key', ']');
			keyForward.setAttribute('modifiers', 'meta');
		}
		else {
			keyBack.setAttribute('keycode', 'VK_LEFT');
			keyBack.setAttribute('modifiers', 'alt');
			keyForward.setAttribute('keycode', 'VK_RIGHT');
			keyForward.setAttribute('modifiers', 'alt');
		}

		let menuItemBack = this._window.document.getElementById('go-menuitem-back');
		let menuItemForward = this._window.document.getElementById('go-menuitem-forward');
		menuItemBack.setAttribute('key', 'key_back');
		menuItemForward.setAttribute('key', 'key_forward');

		this._window.document.getElementById('go-menuitem-first-page').setAttribute('disabled', !this.allowNavigateFirstPage());
		this._window.document.getElementById('go-menuitem-last-page').setAttribute('disabled', !this.allowNavigateLastPage());
		this._window.document.getElementById('go-menuitem-back').setAttribute('disabled', !this.allowNavigateBack());
		this._window.document.getElementById('go-menuitem-forward').setAttribute('disabled', !this.allowNavigateForward());
	}
}


class Reader {
	constructor() {
		this._sidebarWidth = 240;
		this._sidebarOpen = false;
		this._bottomPlaceholderHeight = 0;
		this._readers = [];
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'reader');
		this.onChangeSidebarWidth = null;
		this.onChangeSidebarOpen = null;
		
		this._debounceSidebarWidthUpdate = Zotero.Utilities.debounce(() => {
			let readers = this._readers.filter(r => r instanceof ReaderTab);
			for (let reader of readers) {
				reader.setSidebarWidth(this._sidebarWidth);
			}
		}, 500);
	}
	
	getSidebarWidth() {
		return this._sidebarWidth;
	}
	
	_loadSidebarOpenState() {
		let win = Zotero.getMainWindow();
		if (win) {
			let pane = win.document.getElementById('zotero-reader-sidebar-pane');
			this._sidebarOpen = pane.getAttribute('collapsed') == 'false';
		}
	}

	_setSidebarOpenState() {
		let win = Zotero.getMainWindow();
		if (win) {
			let pane = win.document.getElementById('zotero-reader-sidebar-pane');
			pane.setAttribute('collapsed', this._sidebarOpen ? 'false' : 'true');
		}
	}
	
	getSidebarOpen() {
		return this._sidebarOpen;
	}
	
	setSidebarWidth(width) {
		this._sidebarWidth = width;
		let readers = this._readers.filter(r => r instanceof ReaderTab);
		for (let reader of readers) {
			reader.setSidebarWidth(width);
		}
	}
	
	setSidebarOpen(open) {
		this._sidebarOpen = open;
		let readers = this._readers.filter(r => r instanceof ReaderTab);
		for (let reader of readers) {
			reader.setSidebarOpen(open);
		}
		this._setSidebarOpenState();
	}
	
	setBottomPlaceholderHeight(height) {
		this._bottomPlaceholderHeight = height;
		let readers = this._readers.filter(r => r instanceof ReaderTab);
		for (let reader of readers) {
			reader.setBottomPlaceholderHeight(height);
		}
	}

	notify(event, type, ids, extraData) {
		if (type === 'tab') {
			let reader = Zotero.Reader.getByTabID(ids[0]);
			if (reader) {
				if (event === 'close') {
					this._readers.splice(this._readers.indexOf(reader), 1);
				}
				else if (event === 'select') {
					this.triggerAnnotationsImportCheck(reader._itemID);
				}
			}
		}
		// Listen for parent item, PDF attachment and its annotations updates
		else if (type === 'item') {
			for (let reader of this._readers.slice()) {
				if (event === 'delete' && ids.includes(reader._itemID)) {
					reader.close();
				}

				// Ignore other notifications if the attachment no longer exists
				let item = Zotero.Items.get(reader._itemID);
				if (item) {
					if (event === 'trash' && (ids.includes(item.id) || ids.includes(item.parentItemID))) {
						reader.close();
					}
					else if (event === 'delete') {
						let disappearedIDs = reader.annotationItemIDs.filter(x => ids.includes(x));
						if (disappearedIDs.length) {
							let keys = disappearedIDs.map(id => extraData[id].key);
							reader.unsetAnnotations(keys);
						}
					}
					else {
						let annotationItems = item.getAnnotations();
						reader.annotationItemIDs = annotationItems.map(x => x.id);
						let affectedAnnotations = annotationItems.filter(({ id }) => (
							ids.includes(id)
							&& !(extraData && extraData[id] && extraData[id].instanceID === reader._instanceID)
						));
						if (affectedAnnotations.length) {
							reader.setAnnotations(affectedAnnotations);
						}
						// Update title if the PDF attachment or the parent item changes
						if (ids.includes(reader._itemID) || ids.includes(item.parentItemID)) {
							reader.updateTitle();
						}
					}
				}
			}
		}
	}
	
	getByTabID(tabID) {
		return this._readers.find(r => (r instanceof ReaderTab) && r.tabID === tabID);
	}

	async openURI(itemURI, location, openWindow) {
		let item = await Zotero.URI.getURIItem(itemURI);
		if (!item) return;
		await this.open(item.id, location, openWindow);
	}

	async open(itemID, location, openWindow) {
		this._loadSidebarOpenState();
		this.triggerAnnotationsImportCheck(itemID);
		let reader;

		if (openWindow) {
			reader = this._readers.find(r => r._itemID === itemID && (r instanceof ReaderWindow));
		}
		else {
			reader = this._readers.find(r => r._itemID === itemID);
		}

		if (reader) {
			if (reader instanceof ReaderTab) {
				reader._window.Zotero_Tabs.select(reader.tabID);
			}
			
			if (location) {
				reader.navigate(location);
			}
		}
		else if (openWindow) {
			reader = new ReaderWindow({
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight
			});
			this._readers.push(reader);
			if (!(await reader.open({ itemID, location }))) {
				return;
			}
			reader._window.addEventListener('unload', () => {
				this._readers.splice(this._readers.indexOf(reader), 1);
			});
		}
		else {
			reader = new ReaderTab({
				itemID,
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight
			});
			this._readers.push(reader);
			if (!(await reader.open({ itemID, location }))) {
				return;
			}
			reader.onChangeSidebarWidth = (width) => {
				this._sidebarWidth = width;
				this._debounceSidebarWidthUpdate();
				if (this.onChangeSidebarWidth) {
					this.onChangeSidebarWidth(width);
				}
			};
			reader.onChangeSidebarOpen = (open) => {
				this._sidebarOpen = open;
				this.setSidebarOpen(open);
				if (this.onChangeSidebarOpen) {
					this.onChangeSidebarOpen(open);
				}
			};
		}

		if (reader instanceof ReaderWindow) {
			reader._window.focus();
		}
	}

	/**
	 * Trigger annotations import
	 *
	 * @param {Integer} itemID Attachment item id
	 * @returns {Promise}
	 */
	async triggerAnnotationsImportCheck(itemID) {
		let item = await Zotero.Items.getAsync(itemID);
		if (!item.isEditable()
			|| item.deleted
			|| item.parentItem && item.parentItem.deleted
		) {
			return;
		}
		let mtime = await item.attachmentModificationTime;
		if (item.attachmentLastProcessedModificationTime < Math.floor(mtime / 1000)) {
			await Zotero.PDFWorker.import(itemID, true);
		}
	}
}

Zotero.Reader = new Reader();
