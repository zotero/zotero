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

import FilePicker from 'zotero/modules/filePicker';

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
		this._title = '';
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

	getSecondViewState() {
		let state = this._iframeWindow.wrappedJSObject.getSecondViewState();
		return state ? JSON.parse(JSON.stringify(state)) : undefined;
	}

	async migrateMendeleyColors(libraryID, annotations) {
		let colorMap = new Map();
		colorMap.set('#fff5ad', '#ffd400');
		colorMap.set('#ffb5b6', '#ff6666');
		colorMap.set('#bae2ff', '#2ea8e5');
		colorMap.set('#d3c2ff', '#a28ae5');
		colorMap.set('#dcffb0', '#5fb236');
		let updatedAnnotations = [];
		for (let annotation of annotations) {
			let color = colorMap.get(annotation.color);
			if (color) {
				annotation.color = color;
				updatedAnnotations.push(annotation);
			}
		}
		if (!updatedAnnotations.length) {
			return false;
		}
		Zotero.debug('Migrating Mendeley colors');
		let notifierQueue = new Zotero.Notifier.Queue();
		try {
			for (let annotation of updatedAnnotations) {
				let { id: key, color } = annotation;
				let item = Zotero.Items.getByLibraryAndKey(libraryID, key);
				if (item && item.isEditable()) {
					item.annotationColor = color;
					await item.saveTx({ skipDateModifiedUpdate: true, notifierQueue });
				}
			}
		}
		finally {
			await Zotero.Notifier.commit(notifierQueue);
		}
		return true;
	}

	async open({ itemID, state, location, secondViewState }) {
		let { libraryID } = Zotero.Items.getLibraryAndKeyFromID(itemID);
		let library = Zotero.Libraries.get(libraryID);
		await library.waitForDataLoad('item');
		
		let item = Zotero.Items.get(itemID);
		if (!item) {
			return false;
		}
		this.state = state;
		this._itemID = item.id;
		// Set `ReaderTab` title as fast as possible
		await this.updateTitle();
		let path = await item.getFilePathAsync();
		// Check file size, otherwise we get uncatchable error:
		// JavaScript error: resource://gre/modules/osfile/osfile_native.jsm, line 60: RangeError: invalid array length
		// See more https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Invalid_array_length
		let fileSize = (await OS.File.stat(path)).size;
		// Max ArrayBuffer size before fx89 is 2GB-1 bytes
		if (fileSize > Math.pow(2, 31) - 1) {
			throw new Error(`The file "${path}" is too large`);
		}
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		let annotationItems = item.getAnnotations();
		let annotations = (await Promise.all(annotationItems.map(x => this._getAnnotation(x)))).filter(x => x);

		// TODO: Remove after some time
		// Migrate Mendeley colors to Zotero PDF reader colors
		let migrated = await this.migrateMendeleyColors(libraryID, annotations);
		if (migrated) {
			annotationItems = item.getAnnotations();
			annotations = (await Promise.all(annotationItems.map(x => this._getAnnotation(x)))).filter(x => x);
		}

		this.annotationItemIDs = annotationItems.map(x => x.id);
		state = state || await this._getState();
		this._postMessage({
			action: 'open',
			buf,
			annotations,
			state,
			secondViewState,
			location,
			readOnly: this._isReadOnly(),
			authorName: item.library.libraryType === 'group' ? Zotero.Users.getCurrentName() : '',
			showItemPaneToggle: this._showItemPaneToggle,
			sidebarWidth: this._sidebarWidth,
			sidebarOpen: this._sidebarOpen,
			bottomPlaceholderHeight: this._bottomPlaceholderHeight,
			rtl: Zotero.rtl,
			fontSize: Zotero.Prefs.get('fontSize'),
			localizedStrings: {
				...Zotero.Intl.getPrefixedStrings('general.'),
				...Zotero.Intl.getPrefixedStrings('pdfReader.')
			}
		}, [buf]);
		// Set title once again, because `ReaderWindow` isn't loaded the first time
		await this.updateTitle();

		this._prefObserverIDs = [
			Zotero.Prefs.registerObserver('fontSize', this._handleFontSizePrefChange),
			Zotero.Prefs.registerObserver('tabs.title.reader', this._handleTabTitlePrefChange)
		];

		return true;
	}

	uninit() {
		if (this._prefObserverIDs) {
			this._prefObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
		}
	}
	
	get itemID() {
		return this._itemID;
	}
	
	async updateTitle() {
		let type = Zotero.Prefs.get('tabs.title.reader');
		let item = Zotero.Items.get(this._itemID);
		let readerTitle = item.getDisplayTitle();
		let parentItem = item.parentItem;
		// If type is "filename", then readerTitle already has it
		if (parentItem && type !== 'filename') {
			let attachment = await parentItem.getBestAttachment();
			if (attachment && attachment.id === this._itemID) {
				let parts = [];
				let creator = parentItem.getField('firstCreator');
				let year = parentItem.getField('year');
				let title = parentItem.getDisplayTitle();
				// If creator is missing fall back to titleCreatorYear
				if (type === 'creatorYearTitle' && creator) {
					parts = [creator, year, title];
				}
				else if (type === 'title') {
					parts = [title];
				}
				// If type is titleCreatorYear, or is missing, or another type falls back
				else {
					parts = [title, creator, year];
				}
				readerTitle = parts.filter(x => x).join(' - ');
			}
		}
		this._title = readerTitle;
		this._setTitleValue(readerTitle);
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

	focusLastToolbarButton() {
		this._iframeWindow.focus();
		this._postMessage({ action: 'focusLastToolbarButton' });
	}

	tabToolbar(reverse) {
		this._postMessage({ action: 'tabToolbar', reverse });
		// Avoid toolbar find button being focused for a short moment
		setTimeout(() => this._iframeWindow.focus());
	}

	focusFirst() {
		this._postMessage({ action: 'focusFirst' });
		setTimeout(() => this._iframeWindow.focus());
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
	
	isZoomAutoActive() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfViewer.currentScaleValue === "auto"');
	}
	
	isZoomPageWidthActive() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfViewer.currentScaleValue === "page-width"');
	}

	isZoomPageHeightActive() {
		return this._iframeWindow.eval('PDFViewerApplication.pdfViewer.currentScaleValue === "page-fit"');
	}

	isSplitVerticallyActive() {
		return this._iframeWindow.wrappedJSObject.getSplitType() === 'vertical';
	}

	isSplitHorizontallyActive() {
		return this._iframeWindow.wrappedJSObject.getSplitType() === 'horizontal';
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

	promptToTransferAnnotations() {
		let ps = Services.prompt;
		let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		let index = ps.confirmEx(
			null,
			Zotero.getString('pdfReader.promptTransferFromPDF.title'),
			Zotero.getString('pdfReader.promptTransferFromPDF.text', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.continue'),
			null, null, null, {}
		);
		return !index;
	}

	promptToDeletePages(num) {
		let ps = Services.prompt;
		let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		let index = ps.confirmEx(
			null,
			Zotero.getString('pdfReader.promptDeletePages.title'),
			Zotero.getString(
				'pdfReader.promptDeletePages.text',
				new Intl.NumberFormat().format(num),
				num
			),
			buttonFlags,
			Zotero.getString('general.continue'),
			null, null, null, {}
		);
		return !index;
	}

	async reload(data) {
		let item = Zotero.Items.get(this._itemID);
		let path = await item.getFilePathAsync();
		let buf = await OS.File.read(path, {});
		buf = new Uint8Array(buf).buffer;
		this._postMessage({ action: 'reload', buf, data }, [buf]);
	}
	
	async menuCmd(cmd) {
		if (cmd === 'transferFromPDF') {
			if (this.promptToTransferAnnotations(true)) {
				try {
					await Zotero.PDFWorker.import(this._itemID, true, '', true);
				}
				catch (e) {
					if (e.name === 'PasswordException') {
						Zotero.alert(null, Zotero.getString('general.error'),
							Zotero.getString('pdfReader.promptPasswordProtected'));
					}
					throw e;
				}
			}
		}
		else if (cmd === 'export') {
			let zp = Zotero.getActiveZoteroPane();
			zp.exportPDF(this._itemID);
			return;
		}
		else if (cmd === 'showInLibrary') {
			let win = Zotero.getMainWindow();
			if (win) {
				let item = Zotero.Items.get(this._itemID);
				let id = item.parentID || item.id;
				win.ZoteroPane.selectItems([id]);
				win.Zotero_Tabs.select('zotero-pane');
				win.focus();
			}
			return;
		}
		else if (cmd === 'rotateLeft') {
			await this._rotateCurrentPage(270);
			return;
		}
		else if (cmd === 'rotateRight') {
			await this._rotateCurrentPage(90);
			return;
		}
		else if (cmd === 'rotate180') {
			await this._rotateCurrentPage(180);
			return;
		}
		else if (cmd === 'splitVertically') {
			this._splitVertically();
		}
		else if (cmd === 'splitHorizontally') {
			this._splitHorizontally();
		}

		let data = {
			action: 'menuCmd',
			cmd
		};
		this._postMessage(data);
	}

	_initIframeWindow() {
		this._iframeWindow.addEventListener('message', this._handleMessage);
		this._iframeWindow.addEventListener('error', (event) => {
			Zotero.logError(event.error);
		});
		this._iframeWindow.wrappedJSObject.zoteroSetDataTransferAnnotations = (dataTransfer, annotations) => {
			// A small hack to force serializeAnnotations to include image annotation
			// even if image isn't saved and imageAttachmentKey isn't available
			for (let annotation of annotations) {
				if (annotation.image && !annotation.imageAttachmentKey) {
					annotation.imageAttachmentKey = 'none';
					delete annotation.image;
				}
			}
			let res = Zotero.EditorInstanceUtilities.serializeAnnotations(annotations);
			let tmpNote = new Zotero.Item('note');
			tmpNote.libraryID = Zotero.Libraries.userLibraryID;
			tmpNote.setNote(res.html);
			let items = [tmpNote];
			let format = Zotero.QuickCopy.getNoteFormat();
			Zotero.debug('Copying/dragging annotation(s) with ' + format);
			format = Zotero.QuickCopy.unserializeSetting(format);
			// Basically the same code is used in itemTree.jsx onDragStart
			try {
				if (format.mode === 'export') {
					// If exporting with virtual "Markdown + Rich Text" translator, call Note Markdown
					// and Note HTML translators instead
					if (format.id === Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
						let markdownFormat = { mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN, options: format.markdownOptions };
						let htmlFormat = { mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_HTML, options: format.htmlOptions };
						Zotero.QuickCopy.getContentFromItems(items, markdownFormat, (obj, worked) => {
							if (!worked) {
								return;
							}
							Zotero.QuickCopy.getContentFromItems(items, htmlFormat, (obj2, worked) => {
								if (!worked) {
									return;
								}
								dataTransfer.setData('text/plain', obj.string.replace(/\r\n/g, '\n'));
								dataTransfer.setData('text/html', obj2.string.replace(/\r\n/g, '\n'));
							});
						});
					}
					else {
						Zotero.QuickCopy.getContentFromItems(items, format, (obj, worked) => {
							if (!worked) {
								return;
							}
							var text = obj.string.replace(/\r\n/g, '\n');
							// For Note HTML translator use body content only
							if (format.id === Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
								// Use body content only
								let parser = Cc['@mozilla.org/xmlextras/domparser;1']
								.createInstance(Ci.nsIDOMParser);
								let doc = parser.parseFromString(text, 'text/html');
								text = doc.body.innerHTML;
							}
							dataTransfer.setData('text/plain', text);
						});
					}
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
		};
		this._iframeWindow.wrappedJSObject.zoteroConfirmDeletion = function (plural) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
			let index = ps.confirmEx(
				null,
				'',
				Zotero.getString('pdfReader.deleteAnnotation.' + (plural ? 'plural' : 'singular')),
				buttonFlags,
				Zotero.getString('general.delete'),
				null, null, null, {}
			);
			return !index;
		};

		this._iframeWindow.wrappedJSObject.zoteroCopyImage = async (dataURL) => {
			let parts = dataURL.split(',');
			if (!parts[0].includes('base64')) {
				return;
			}
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
			let imgPtr = Components.classes["@mozilla.org/supports-interface-pointer;1"]
				.createInstance(Components.interfaces.nsISupportsInterfacePointer);
			let mimeType = `image/png`;
			imgPtr.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
			transferable.init(null);
			transferable.addDataFlavor(mimeType);
			transferable.setTransferData(mimeType, imgPtr, 0);
			clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		};

		this._iframeWindow.wrappedJSObject.zoteroSaveImageAs = async (dataURL) => {
			let fp = new FilePicker();
			fp.init(this._iframeWindow, Zotero.getString('pdfReader.saveImageAs'), fp.modeSave);
			fp.appendFilter("PNG", "*.png");
			fp.defaultString = Zotero.getString('fileTypes.image').toLowerCase() + '.png';
			let rv = await fp.show();
			if (rv === fp.returnOK || rv === fp.returnReplace) {
				let outputPath = fp.file;
				let parts = dataURL.split(',');
				if (parts[0].includes('base64')) {
					let bstr = atob(parts[1]);
					let n = bstr.length;
					let u8arr = new Uint8Array(n);
					while (n--) {
						u8arr[n] = bstr.charCodeAt(n);
					}
					await OS.File.writeAtomic(outputPath, u8arr);
				}
			}
		};
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
			// Using `writeAtomic` instead of `putContentsAsync` to avoid
			// using temp file that causes conflicts on simultaneous writes (on slow systems)
			await OS.File.writeAtomic(file.path, JSON.stringify(state));
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

	_handleFontSizePrefChange = () => {
		this._postMessage({ action: 'setFontSize', fontSize: Zotero.Prefs.get('fontSize') });
	};

	_handleTabTitlePrefChange = async () => {
		await this.updateTitle();
	};

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

	async _rotateCurrentPage(degrees) {
		let pageIndex = this._iframeWindow.wrappedJSObject.PDFViewerApplication.pdfViewer.currentPageNumber - 1;
		this._postMessage({ action: 'reloading' });
		await Zotero.PDFWorker.rotatePages(this._itemID, [pageIndex], degrees, true);
		await this.reload({ rotatedPageIndexes: [pageIndex] });
	}

	_splitVertically() {
		if (this.isSplitVerticallyActive()) {
			this._iframeWindow.wrappedJSObject.unsplitView();
		}
		else {
			this._iframeWindow.wrappedJSObject.splitView();
		}
		setTimeout(() => this._updateSecondViewState(), 500);
	}

	_splitHorizontally() {
		if (this.isSplitHorizontallyActive()) {
			this._iframeWindow.wrappedJSObject.unsplitView();
		}
		else {
			this._iframeWindow.wrappedJSObject.splitView(true);
		}
		setTimeout(() => this._updateSecondViewState(), 500);
	}

	_openTagsPopup(item, selector) {
		let menupopup = this._window.document.createElement('menupopup');
		menupopup.className = 'tags-popup';
		menupopup.style.minWidth = '300px';
		menupopup.setAttribute('ignorekeys', true);
		let tagsbox = this._window.document.createElement('tagsbox');
		menupopup.appendChild(tagsbox);
		tagsbox.setAttribute('flex', '1');
		this._popupset.appendChild(menupopup);
		let element = this._iframeWindow.document.querySelector(selector);
		menupopup.openPopup(element, 'overlap', 0, 0, true);
		tagsbox.mode = 'edit';
		tagsbox.item = item;
		if (tagsbox.mode == 'edit' && tagsbox.count == 0) {
			tagsbox.newTag();
		}
	}
	
	_openPagePopup(data, secondView) {
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
				this._window.document.getElementById('menu_copy').click();
			});
			popup.appendChild(menuitem);
			// Separator
			popup.appendChild(this._window.document.createElement('menuseparator'));
		}
		// Zoom in
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomIn'));
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomIn' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Zoom out
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomOut'));
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomOut' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Zoom 'Auto'
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomAuto'));
		menuitem.setAttribute('type', 'checkbox');
		menuitem.setAttribute('checked', data.isZoomAuto);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomAuto' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Zoom 'Page Width'
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomPageWidth'));
		menuitem.setAttribute('type', 'checkbox');
		menuitem.setAttribute('checked', data.isZoomPageWidth);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomPageWidth' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Zoom 'Page Height'
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.zoomPageHeight'));
		menuitem.setAttribute('type', 'checkbox');
		menuitem.setAttribute('checked', data.isZoomPageHeight);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'zoomPageHeight' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Split Horizontally
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.splitHorizontally'));
		menuitem.setAttribute('type', 'checkbox');
		menuitem.setAttribute('checked', this.isSplitHorizontallyActive());
		menuitem.addEventListener('command', () => this._splitHorizontally());
		popup.appendChild(menuitem);
		// Split Vertically
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.splitVertically'));
		menuitem.setAttribute('type', 'checkbox');
		menuitem.setAttribute('checked', this.isSplitVerticallyActive());
		menuitem.addEventListener('command', () => this._splitVertically());
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Next page
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.nextPage'));
		menuitem.setAttribute('disabled', !data.enableNextPage);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'nextPage' }, [], secondView);
		});
		popup.appendChild(menuitem);
		// Previous page
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.previousPage'));
		menuitem.setAttribute('disabled', !data.enablePrevPage);
		menuitem.addEventListener('command', () => {
			this._postMessage({ action: 'popupCmd', cmd: 'prevPage' }, [], secondView);
		});
		popup.appendChild(menuitem);
		popup.openPopupAtScreen(data.x, data.y, true);
	}

	_openAnnotationPopup(data) {
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
		menuitem.setAttribute('disabled', !hasActiveEditor || !data.enableAddToNote);
		menuitem.addEventListener('command', () => {
			this._postMessage({
				action: 'popupCmd',
				cmd: 'addToNote',
				ids: data.ids
			});
		});
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Colors
		for (let color of data.colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString(color[0]));
			menuitem.className = 'menuitem-iconic';
			menuitem.setAttribute('disabled', data.readOnly);
			menuitem.setAttribute('image', this._getColorIcon(color[1], color[1] === data.selectedColor));
			menuitem.addEventListener('command', () => {
				this._postMessage({
					action: 'popupCmd',
					cmd: 'setAnnotationColor',
					ids: data.ids,
					color: color[1]
				});
			});
			popup.appendChild(menuitem);
		}
		// Separator
		if (data.enableEditPageNumber || data.enableEditHighlightedText) {
			popup.appendChild(this._window.document.createElement('menuseparator'));
		}
		// Change page number
		if (data.enableEditPageNumber) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('pdfReader.editPageNumber'));
			menuitem.setAttribute('disabled', data.readOnly);
			menuitem.addEventListener('command', () => {
				this._postMessage({
					action: 'popupCmd',
					cmd: 'openPageLabelPopup',
					data
				});
			});
			popup.appendChild(menuitem);
		}
		// Edit highlighted text
		if (data.enableEditHighlightedText) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('pdfReader.editHighlightedText'));
			menuitem.setAttribute('disabled', data.readOnly);
			menuitem.addEventListener('command', () => {
				this._postMessage({
					action: 'popupCmd',
					cmd: 'editHighlightedText',
					data
				});
			});
			popup.appendChild(menuitem);
		}
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));

		if (data.enableImageOptions) {
			// Copy Image
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('pdfReader.copyImage'));
			menuitem.addEventListener('command', () => {
				this._postMessage({ action: 'popupCmd', cmd: 'copyImage', data });
			});
			popup.appendChild(menuitem);
			// Save Image As…
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('pdfReader.saveImageAs'));
			menuitem.addEventListener('command', () => {
				this._postMessage({ action: 'popupCmd', cmd: 'saveImageAs', data });
			});
			popup.appendChild(menuitem);
			// Separator
			popup.appendChild(this._window.document.createElement('menuseparator'));
		}

		// Delete
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('general.delete'));
		menuitem.setAttribute('disabled', data.readOnly);
		menuitem.addEventListener('command', () => {
			this._postMessage({
				action: 'popupCmd',
				cmd: 'deleteAnnotation',
				ids: data.ids
			});
		});
		popup.appendChild(menuitem);

		if (data.x) {
			popup.openPopupAtScreen(data.x, data.y, true);
		}
		else if (data.selector) {
			let element = this._iframeWindow.document.querySelector(data.selector);
			popup.openPopup(element, 'after_start', 0, 0, true);
		}
	}

	_openColorPopup(data) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		for (let color of data.colors) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString(color[0]));
			menuitem.className = 'menuitem-iconic';
			menuitem.setAttribute('image', this._getColorIcon(color[1], color[1] === data.selectedColor));
			menuitem.addEventListener('command', () => {
				this._postMessage({
					action: 'popupCmd',
					cmd: 'setColor',
					color: color[1]
				});
			});
			popup.appendChild(menuitem);
		}
		let element = this._iframeWindow.document.getElementById(data.elementID);
		popup.openPopup(element, 'after_start', 0, 0, true);
	}

	_openThumbnailPopup(data) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		// Rotate Left
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.rotateLeft'));
		menuitem.setAttribute('disabled', this._isReadOnly());
		menuitem.addEventListener('command', async () => {
			this._postMessage({ action: 'reloading' });
			await Zotero.PDFWorker.rotatePages(this._itemID, data.pageIndexes, 270, true);
			await this.reload({ rotatedPageIndexes: data.pageIndexes });
		});
		popup.appendChild(menuitem);
		// Rotate Right
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.rotateRight'));
		menuitem.setAttribute('disabled', this._isReadOnly());
		menuitem.addEventListener('command', async () => {
			this._postMessage({ action: 'reloading' });
			await Zotero.PDFWorker.rotatePages(this._itemID, data.pageIndexes, 90, true);
			await this.reload({ rotatedPageIndexes: data.pageIndexes });
		});
		popup.appendChild(menuitem);
		// Rotate 180
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('pdfReader.rotate180'));
		menuitem.setAttribute('disabled', this._isReadOnly());
		menuitem.addEventListener('command', async () => {
			this._postMessage({ action: 'reloading' });
			await Zotero.PDFWorker.rotatePages(this._itemID, data.pageIndexes, 180, true);
			await this.reload({ rotatedPageIndexes: data.pageIndexes });
		});
		popup.appendChild(menuitem);
		// Separator
		popup.appendChild(this._window.document.createElement('menuseparator'));
		// Delete
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('general.delete'));
		menuitem.setAttribute('disabled', this._isReadOnly());
		menuitem.addEventListener('command', async () => {
			if (this.promptToDeletePages(data.pageIndexes.length)) {
				this._postMessage({ action: 'reloading' });
				try {
					await Zotero.PDFWorker.deletePages(this._itemID, data.pageIndexes, true);
				}
				catch (e) {
				}
				await this.reload();
			}
		});
		popup.appendChild(menuitem);
		popup.openPopupAtScreen(data.x, data.y, true);
	}

	_openSelectorPopup(data) {
		let popup = this._window.document.createElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
		let menuitem;
		// Clear Selection
		menuitem = this._window.document.createElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('general.clearSelection'));
		menuitem.setAttribute('disabled', !data.enableClearSelection);
		menuitem.addEventListener('command', () => {
			this._postMessage({
				action: 'popupCmd',
				cmd: 'clearSelector',
				ids: data.ids
			});
		});
		popup.appendChild(menuitem);
		popup.openPopupAtScreen(data.x, data.y, true);
	}

	async _postMessage(message, transfer, secondView) {
		await this._waitForReader();
		this._iframeWindow.postMessage({ itemID: this._itemID, message, secondView }, this._iframeWindow.origin, transfer);
	}

	_updateSecondViewState() {
		if (this.tabID) {
			let win = Zotero.getMainWindow();
			if (win) {
				win.Zotero_Tabs.setSecondViewState(this.tabID, this.getSecondViewState());
			}
		}
	}

	_handleMessage = async (event) => {
		let message;
		let secondViewIframeWindow = this._iframeWindow.document.getElementById('secondViewIframe');
		if (secondViewIframeWindow) {
			secondViewIframeWindow = secondViewIframeWindow.contentWindow;
		}
		try {
			if (event.source !== this._iframeWindow
			&& event.source !== secondViewIframeWindow) {
				return;
			}
			// Clone data to avoid the dead object error when the window is closed
			let data = JSON.parse(JSON.stringify(event.data));
			let { secondView } = data;
			// Filter messages coming from previous reader instances,
			// except for `setAnnotation` to still allow saving it
			if (data.itemID !== this._itemID && data.message.action !== 'setAnnotation') {
				return;
			}
			message = data.message;

			if (secondView) {
				switch (message.action) {
					case 'openPagePopup': break;
					case 'setState': {
						this._updateSecondViewState();
						return;
					}
					default: return;
				}
			}

			switch (message.action) {
				case 'initialized': {
					this._resolveInitPromise();
					return;
				}
				case 'saveAnnotations': {
					let attachment = Zotero.Items.get(data.itemID);
					let { annotations } = message;
					let notifierQueue = new Zotero.Notifier.Queue();
					try {
						for (let annotation of annotations) {
							annotation.key = annotation.id;
							let saveOptions = {
								notifierQueue,
								notifierData: {
									instanceID: this._instanceID
								}
							};

							if (annotation.onlyTextOrComment) {
								saveOptions.notifierData.autoSyncDelay = Zotero.Notes.AUTO_SYNC_DELAY;
							}

							let item = Zotero.Items.getByLibraryAndKey(attachment.libraryID, annotation.key);
							// If annotation isn't editable, only save image to cache.
							// This is the only case when saving can be triggered for non-editable annotation
							if (annotation.image && item && !item.isEditable()) {
								let blob = this._dataURLtoBlob(annotation.image);
								await Zotero.Annotations.saveCacheImage(item, blob);
							}
							// Save annotation, and save image to cache
							else {
								// Delete authorName to prevent setting annotationAuthorName unnecessarily
								delete annotation.authorName;
								let savedAnnotation = await Zotero.Annotations.saveFromJSON(attachment, annotation, saveOptions);
								if (annotation.image) {
									let blob = this._dataURLtoBlob(annotation.image);
									await Zotero.Annotations.saveCacheImage(savedAnnotation, blob);
								}
							}
						}
					}
					finally {
						await Zotero.Notifier.commit(notifierQueue);
					}
					return;
				}
				case 'deleteAnnotations': {
					let { ids: keys } = message;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					let notifierQueue = new Zotero.Notifier.Queue();
					try {
						for (let key of keys) {
							let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
							// Make sure the annotation actually belongs to the current PDF
							if (annotation && annotation.isAnnotation() && annotation.parentID === this._itemID) {
								this.annotationItemIDs = this.annotationItemIDs.filter(id => id !== annotation.id);
								await annotation.eraseTx({ notifierQueue });
							}
						}
					}
					finally {
						await Zotero.Notifier.commit(notifierQueue);
					}
					return;
				}
				// Save rendered image when annotation isn't modified
				case 'saveImage': {
					let { annotation } = message;
					let { image, id: key } = annotation;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					let item = Zotero.Items.getByLibraryAndKey(attachment.libraryID, key);
					if (item) {
						let blob = this._dataURLtoBlob(image);
						await Zotero.Annotations.saveCacheImage({ libraryID, key }, blob);
					}
					return;
				}
				case 'setState': {
					let { state } = message;
					await this._setState(state);
					return;
				}
				case 'openTagsPopup': {
					let { id: key, selector } = message;
					let attachment = Zotero.Items.get(this._itemID);
					let libraryID = attachment.libraryID;
					let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
					if (annotation) {
						this._openTagsPopup(annotation, selector);
					}
					return;
				}
				case 'openPagePopup': {
					this._openPagePopup(message.data, secondView);
					return;
				}
				case 'openAnnotationPopup': {
					this._openAnnotationPopup(message.data);
					return;
				}
				case 'openColorPopup': {
					this._openColorPopup(message.data);
					return;
				}
				case 'openThumbnailPopup': {
					this._openThumbnailPopup(message.data);
					return;
				}
				case 'openSelectorPopup': {
					this._openSelectorPopup(message.data);
					return;
				}
				case 'closePopup': {
					// Note: This currently only closes tags popup when annotations are
					// disappearing from pdf-reader sidebar
					for (let child of Array.from(this._popupset.children)) {
						if (child.classList.contains('tags-popup')) {
							child.hidePopup();
						}
					}
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
				case 'focusSplitButton': {
					if (this instanceof ReaderTab) {
						let win = Zotero.getMainWindow();
						if (win) {
							win.document.getElementById('zotero-tb-toggle-item-pane').focus();
						}
					}
					return;
				}
				case 'focusContextPane': {
					if (this instanceof ReaderWindow || !this._window.ZoteroContextPane.focus()) {
						this.focusFirst();
					}
					return;
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
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
	constructor({ itemID, title, sidebarWidth, sidebarOpen, bottomPlaceholderHeight, index, tabID, background }) {
		super();
		this._itemID = itemID;
		this._sidebarWidth = sidebarWidth;
		this._sidebarOpen = sidebarOpen;
		this._bottomPlaceholderHeight = bottomPlaceholderHeight;
		this._showItemPaneToggle = true;
		this._window = Services.wm.getMostRecentWindow('navigator:browser');
		let { id, container } = this._window.Zotero_Tabs.add({
			id: tabID,
			type: 'reader',
			title: title || '',
			index,
			data: {
				itemID
			},
			select: !background
		});
		this.tabID = id;
		this._tabContainer = container;
		
		this._iframe = this._window.document.createElement('browser');
		this._iframe.setAttribute('class', 'reader');
		this._iframe.setAttribute('flex', '1');
		this._iframe.setAttribute('type', 'content');
		this._iframe.setAttribute('src', 'resource://zotero/pdf-reader/viewer.html');
		this._tabContainer.appendChild(this._iframe);
		this._iframe.docShell.windowDraggingAllowed = true;
		
		this._popupset = this._window.document.createElement('popupset');
		this._tabContainer.appendChild(this._popupset);
		
		this._window.addEventListener('DOMContentLoaded', (event) => {
			if (this._iframe && this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
				this._iframeWindow = this._iframe.contentWindow;
				this._initIframeWindow();
			}
		});
		
		this._iframe.setAttribute('tooltip', 'html-tooltip');

		// This is a nonsense work-around to trigger mouseup and pointerup
		// events in PDF reader iframe when mouse up happens over another iframe
		// i.e. note-editor. There should be a better way to solve this
		this._window.addEventListener('pointerup', (event) => {
			try {
				if (this._window.Zotero_Tabs.selectedID === this.tabID
					&& this._iframeWindow
					&& event.target
					&& event.target.closest
					&& !event.target.closest('#outerContainer')) {
					let evt = new this._iframeWindow.CustomEvent('mouseup', { bubbles: false });
					evt.clientX = event.clientX;
					evt.clientY = event.clientY;
					this._iframeWindow.dispatchEvent(evt);

					evt = new this._iframeWindow.CustomEvent('pointerup', { bubbles: false });
					evt.clientX = event.clientX;
					evt.clientY = event.clientY;
					this._iframeWindow.dispatchEvent(evt);
				}
			}
			catch(e) {
			}
		});
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
				this._iframe.docShell.windowDraggingAllowed = true;
			}

			if (this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
				this._iframeWindow = this._window.document.getElementById('reader').contentWindow;
				this._initIframeWindow();
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
		this._window.document.getElementById('view-menuitem-zoom-auto').setAttribute('checked', this.isZoomAutoActive());
		this._window.document.getElementById('view-menuitem-zoom-page-width').setAttribute('checked', this.isZoomPageWidthActive());
		this._window.document.getElementById('view-menuitem-zoom-page-height').setAttribute('checked', this.isZoomPageHeightActive());
		this._window.document.getElementById('view-menuitem-split-vertically').setAttribute('checked', this.isSplitVerticallyActive());
		this._window.document.getElementById('view-menuitem-split-horizontally').setAttribute('checked', this.isSplitHorizontallyActive());
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
			this._setSidebarState();
		}, 500);
	}
	
	getSidebarWidth() {
		return this._sidebarWidth;
	}
	
	async init() {
		await Zotero.uiReadyPromise;
		Zotero.Session.state.windows
			.filter(x => x.type == 'reader' && Zotero.Items.exists(x.itemID))
			.forEach(x => this.open(x.itemID, null, { title: x.title, openInWindow: true, secondViewState: x.secondViewState }));
	}
	
	_loadSidebarState() {
		let win = Zotero.getMainWindow();
		if (win) {
			let pane = win.document.getElementById('zotero-reader-sidebar-pane');
			this._sidebarOpen = pane.getAttribute('collapsed') == 'false';
			let width = pane.getAttribute('width');
			if (width) {
				this._sidebarWidth = parseInt(width);
			}
		}
	}

	_setSidebarState() {
		let win = Zotero.getMainWindow();
		if (win) {
			let pane = win.document.getElementById('zotero-reader-sidebar-pane');
			pane.setAttribute('collapsed', this._sidebarOpen ? 'false' : 'true');
			pane.setAttribute('width', this._sidebarWidth);
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
		this._setSidebarState();
	}
	
	setSidebarOpen(open) {
		this._sidebarOpen = open;
		let readers = this._readers.filter(r => r instanceof ReaderTab);
		for (let reader of readers) {
			reader.setSidebarOpen(open);
		}
		this._setSidebarState();
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
			if (event === 'close') {
				for (let id of ids) {
					let reader = Zotero.Reader.getByTabID(id);
					if (reader) {
						reader.uninit();
						this._readers.splice(this._readers.indexOf(reader), 1);
					}
				}
			}
			else if (event === 'select') {
				let reader = Zotero.Reader.getByTabID(ids[0]);
				if (reader) {
					this.triggerAnnotationsImportCheck(reader._itemID);
				}
			}
			
			if (event === 'add' || event === 'close') {
				Zotero.Session.debounceSave();
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
	
	getWindowStates() {
		return this._readers
			.filter(r => r instanceof ReaderWindow)
			.map(r => ({
				type: 'reader',
				itemID: r._itemID,
				title: r._title,
				secondViewState: r.getSecondViewState()
			}));
	}

	async openURI(itemURI, location, options) {
		let item = await Zotero.URI.getURIItem(itemURI);
		if (!item) return;
		await this.open(item.id, location, options);
	}

	async open(itemID, location, { title, tabIndex, tabID, openInBackground, openInWindow, allowDuplicate, secondViewState } = {}) {
		this._loadSidebarState();
		this.triggerAnnotationsImportCheck(itemID);
		let reader;

		// If duplicating is not allowed, and no reader instance is loaded for itemID,
		// try to find an unloaded tab and select it. Zotero.Reader.open will then be called again
		if (!allowDuplicate && !this._readers.find(r => r._itemID === itemID)) {
			let win = Zotero.getMainWindow();
			if (win) {
				let existingTabID = win.Zotero_Tabs.getTabIDByItemID(itemID);
				if (existingTabID) {
					win.Zotero_Tabs.select(existingTabID, false, { location });
					return;
				}
			}
		}

		if (openInWindow) {
			reader = this._readers.find(r => r._itemID === itemID && (r instanceof ReaderWindow));
		}
		else if (!allowDuplicate) {
			reader = this._readers.find(r => r._itemID === itemID);
		}

		if (reader) {
			if (reader instanceof ReaderTab) {
				reader._window.Zotero_Tabs.select(reader.tabID, true);
			}
			
			if (location) {
				reader.navigate(location);
			}
		}
		else if (openInWindow) {
			reader = new ReaderWindow({
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight
			});
			this._readers.push(reader);
			if (!(await reader.open({ itemID, location, secondViewState }))) {
				return;
			}
			Zotero.Session.debounceSave();
			reader._window.addEventListener('unload', () => {
				this._readers.splice(this._readers.indexOf(reader), 1);
				Zotero.Session.debounceSave();
			});
		}
		else {
			reader = new ReaderTab({
				itemID,
				title,
				index: tabIndex,
				tabID,
				background: openInBackground,
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight
			});
			this._readers.push(reader);
			if (!(await reader.open({ itemID, location, secondViewState }))) {
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
		
		if (!openInBackground) {
			reader._window.focus();
		}
		return reader;
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
