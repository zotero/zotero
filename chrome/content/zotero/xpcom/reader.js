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

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

const { BlockingObserver } = ChromeUtils.import("chrome://zotero/content/BlockingObserver.jsm");

const ZipReader = Components.Constructor(
	"@mozilla.org/libjar/zip-reader;1",
	"nsIZipReader",
	"open"
);

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Invalid_array_length
const ARRAYBUFFER_MAX_LENGTH = Services.appinfo.is64Bit
	? Math.pow(2, 33)
	: Math.pow(2, 32) - 1;

class ReaderInstance {
	constructor(options) {
		this.stateFileName = '.zotero-reader-state';
		this.annotationItemIDs = [];
		this._item = options.item;
		this._instanceID = Zotero.Utilities.randomString();
		this._window = null;
		this._iframeWindow = null;
		this._title = '';
		this._isReaderInitialized = false;
		this._showContextPaneToggle = false;
		this._initPromise = new Promise((resolve, reject) => {
			this._resolveInitPromise = resolve;
			this._rejectInitPromise = reject;
		});
		this._pendingWriteStateTimeout = null;
		this._pendingWriteStateFunction = null;

		this._type = this._item.attachmentReaderType;
		if (!this._type) {
			throw new Error('Unsupported attachment type');
		}

		return new Proxy(this, {
			get(target, prop) {
				if (target[prop] === undefined
					&& target._internalReader
					&& target._internalReader[prop] !== undefined) {
					if (typeof target._internalReader[prop] === 'function') {
						return function (...args) {
							return target._internalReader[prop](...args);
						};
					}
					return target._internalReader[prop];
				}
				return target[prop];
			},
			set(originalTarget, prop, value) {
				let target = originalTarget;
				if (!originalTarget.hasOwnProperty(prop)
					&& originalTarget._internalReader
					&& target._internalReader[prop] !== undefined) {
					target = originalTarget._internalReader;
				}
				target[prop] = value;
				return true;
			}
		});
	}

	get type() {
		return this._type;
	}

	async focus() {
		await this._waitForReader();
		this._iframeWindow.focus();
		this._internalReader?.focus();
	}

	getSecondViewState() {
		let state = this._iframeWindow?.wrappedJSObject?.getSecondViewState?.();
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

	displayError(error) {
		if (this._internalReader) {
			let errorMessage = `${Zotero.getString('general.error')}: '${error.message}'`;
			this._internalReader.setErrorMessage(errorMessage);
		}
	}

	async _open({ state, location, secondViewState, preview }) {
		// Set `ReaderTab` title as fast as possible
		this.updateTitle();

		await Zotero.SyncedSettings.loadAll(Zotero.Libraries.userLibraryID);

		let data = await this._getData();
		let annotationItems = this._item.getAnnotations();
		let annotations = (await Promise.all(annotationItems.map(x => this._getAnnotation(x)))).filter(x => x);

		// TODO: Remove after some time
		// Migrate Mendeley colors to Zotero PDF reader colors
		let migrated = await this.migrateMendeleyColors(this._item.libraryID, annotations);
		if (migrated) {
			annotationItems = this._item.getAnnotations();
			annotations = (await Promise.all(annotationItems.map(x => this._getAnnotation(x)))).filter(x => x);
		}

		this.annotationItemIDs = annotationItems.map(x => x.id);
		state = state || await this._getState();


		await this._waitForReader();

		this._iframeWindow.addEventListener('customEvent', (event) => {
			let data = event.detail.wrappedJSObject;
			let append = data.append;
			data.append = (...args) => {
				append(...Components.utils.cloneInto(args, this._iframeWindow, { wrapReflectors: true, cloneFunctions: true }));
			};
			data.reader = this;
			Zotero.Reader._dispatchEvent(data);
		});

		this._blockingObserver = new BlockingObserver({
			shouldBlock(uri) {
				return uri.scheme === 'http' || uri.scheme === 'https';
			}
		});
		this._blockingObserver.register(this._iframe);

		this._internalReader = this._iframeWindow.wrappedJSObject.createReader(Components.utils.cloneInto({
			type: this._type,
			data,
			annotations,
			primaryViewState: state,
			secondaryViewState: secondViewState,
			location,
			readOnly: this._isReadOnly(),
			preview,
			platform: 'zotero',
			authorName: this._item.library.libraryType === 'group' ? Zotero.Users.getCurrentName() : '',
			showContextPaneToggle: this._showContextPaneToggle,
			sidebarWidth: this._sidebarWidth,
			sidebarOpen: this._sidebarOpen,
			bottomPlaceholderHeight: this._bottomPlaceholderHeight,
			rtl: Zotero.rtl,
			fontSize: Zotero.Prefs.get('fontSize'),
			localizedStrings: {
				...Zotero.Intl.getPrefixedStrings('general.'),
				...Zotero.Intl.getPrefixedStrings('pdfReader.')
			},
			showAnnotations: true,
			textSelectionAnnotationMode: Zotero.Prefs.get('reader.textSelectionAnnotationMode'),
			customThemes: Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'readerCustomThemes') ?? [],
			lightTheme: Zotero.Prefs.get('reader.lightTheme'),
			darkTheme: Zotero.Prefs.get('reader.darkTheme'),
			fontFamily: Zotero.Prefs.get('reader.ebookFontFamily'),
			hyphenation: Zotero.Prefs.get('reader.ebookHyphenate'),
			autoDisableNoteTool: Zotero.Prefs.get('reader.autoDisableTool.note'),
			autoDisableTextTool: Zotero.Prefs.get('reader.autoDisableTool.text'),
			autoDisableImageTool: Zotero.Prefs.get('reader.autoDisableTool.image'),
			onOpenContextMenu: () => {
				// Functions can only be passed over wrappedJSObject (we call back onClick for context menu items)
				this._openContextMenu(this._iframeWindow.wrappedJSObject.contextMenuParams);
			},
			onAddToNote: (annotations) => {
				this._addToNote(annotations);
			},
			onSaveAnnotations: async (annotations, callback) => {
				// Reader iframe will wait for this function to finish to make sure there
				// aren't simultaneous transaction waiting to modify the same annotation item.
				// Although simultaneous changes are still possible from different reader instances,
				// but unlikely to be a problem.
				// It's best to test that by running the code below in Run JavaScript tool:
				// await Zotero.DB.executeTransaction(async function () {
				//     await Zotero.Promise.delay(15000);
				// });
				let attachment = Zotero.Items.get(this.itemID);
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
				catch (e) {
					// Enter read-only mode if annotation saving fails
					this.displayError(e);
					this._internalReader.setReadOnly(true);
					throw e;
				}
				finally {
					// Reader iframe doesn't have permissions to wait for onSaveAnnotations
					// promise, therefore using callback to inform when saving finishes
					callback();
					await Zotero.Notifier.commit(notifierQueue);
				}
			},
			onDeleteAnnotations: async (ids) => {
				let keys = ids;
				let attachment = this._item;
				let libraryID = attachment.libraryID;
				let notifierQueue = new Zotero.Notifier.Queue();
				try {
					for (let key of keys) {
						let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
						// Make sure the annotation actually belongs to the current PDF
						if (annotation && annotation.isAnnotation() && annotation.parentID === this._item.id) {
							this.annotationItemIDs = this.annotationItemIDs.filter(id => id !== annotation.id);
							await annotation.eraseTx({ notifierQueue });
						}
					}
				}
				catch (e) {
					this.displayError(e);
					throw e;
				}
				finally {
					await Zotero.Notifier.commit(notifierQueue);
				}
			},
			onChangeViewState: async (state, primary) => {
				state = JSON.parse(JSON.stringify(state));
				if (primary) {
					await this._setState(state);
				}
				else if (this.tabID) {
					let win = Zotero.getMainWindow();
					if (win) {
						win.Zotero_Tabs.setSecondViewState(this.tabID, state);
					}
				}
			},
			onOpenTagsPopup: (id, x, y) => {
				let key = id;
				let attachment = Zotero.Items.get(this._item.id);
				let libraryID = attachment.libraryID;
				let annotation = Zotero.Items.getByLibraryAndKey(libraryID, key);
				if (annotation) {
					this._openTagsPopup(annotation, x, y);
				}
			},
			onClosePopup: () => {
				// Note: This currently only closes tags popup when annotations are
				// disappearing from pdf-reader sidebar
				for (let child of Array.from(this._popupset.children)) {
					if (child.classList.contains('tags-popup')) {
						child.hidePopup();
					}
				}
			},
			onOpenLink: (url) => {
				let win = Services.wm.getMostRecentWindow('navigator:browser');
				if (win) {
					win.ZoteroPane.loadURI(url);
				}
			},
			onToggleSidebar: (open) => {
				if (this._onToggleSidebarCallback) {
					this._onToggleSidebarCallback(open);
				}
			},
			onChangeSidebarWidth: (width) => {
				if (this._onChangeSidebarWidthCallback) {
					this._onChangeSidebarWidthCallback(width);
				}
			},
			onFocusContextPane: () => {
				if (this instanceof ReaderWindow || !this._window.ZoteroContextPane.focus()) {
					this.focusFirst();
				}
			},
			onSetDataTransferAnnotations: (dataTransfer, annotations, fromText) => {
				try {
					// A little hack to force serializeAnnotations to include image annotation
					// even if image isn't saved and imageAttachmentKey isn't available
					for (let annotation of annotations) {
						annotation.attachmentItemID = this._item.id;
					}
					dataTransfer.setData('zotero/annotation', JSON.stringify(annotations));
					// Don't set Markdown or HTML if copying or dragging text
					if (fromText) {
						return;
					}
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
					Zotero.debug(`Copying/dragging (${annotations.length}) annotation(s) with ${format}`);
					format = Zotero.QuickCopy.unserializeSetting(format);
					// Basically the same code is used in itemTree.jsx onDragStart
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
									let parser = new DOMParser();
									let doc = parser.parseFromString(text, 'text/html');
									text = doc.body.innerHTML;
								}
								dataTransfer.setData('text/plain', text);
							});
						}
					}
				}
				catch (e) {
					this.displayError(e);
					throw e;
				}
			},
			onConfirm: function (title, text, confirmationButtonTitle) {
				let ps = Services.prompt;
				let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
				let index = ps.confirmEx(null, title, text, buttonFlags,
					confirmationButtonTitle, null, null, null, {});
				return !index;
			},
			onCopyImage: async (dataURL) => {
				try {
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
					let imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
					let transferable = Components.classes['@mozilla.org/widget/transferable;1'].createInstance(Components.interfaces.nsITransferable);
					let clipboardService = Components.classes['@mozilla.org/widget/clipboard;1'].getService(Components.interfaces.nsIClipboard);
					let img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
					transferable.init(null);
					let kNativeImageMime = 'application/x-moz-nativeimage';
					transferable.addDataFlavor(kNativeImageMime);
					transferable.setTransferData(kNativeImageMime, img);
					clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
				}
				catch (e) {
					this.displayError(e);
				}
			},
			onSaveImageAs: async (dataURL) => {
				try {
					let fp = new FilePicker();
					fp.init(this._iframeWindow, Zotero.getString('pdfReader.saveImageAs'), fp.modeSave);
					fp.appendFilter("PNG", "*.png");
					fp.defaultString = Zotero.getString('file-type-image').toLowerCase() + '.png';
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
				}
				catch (e) {
					this.displayError(e);
					throw e;
				}
			},
			onRotatePages: async (pageIndexes, degrees) => {
				this._internalReader.freeze();
				try {
					await Zotero.PDFWorker.rotatePages(this._item.id, pageIndexes, degrees, true);
				}
				catch (e) {
					this.displayError(e);
				}
				await this.reload();
				this._internalReader.unfreeze();
			},
			onDeletePages: async (pageIndexes) => {
				if (this._promptToDeletePages(pageIndexes.length)) {
					this._internalReader.freeze();
					try {
						await Zotero.PDFWorker.deletePages(this._item.id, pageIndexes, true);
					}
					catch (e) {
						this.displayError(e);
					}
					await this.reload();
					this._internalReader.unfreeze();
				}
			},
			onToggleContextPane: () => {
				Zotero.debug('toggle context pane');
				let win = Zotero.getMainWindow();
				win.ZoteroContextPane.togglePane();
			},
			onToolbarShiftTab: () => {
				// Shift-tab from the toolbar focuses the sync button (if reader instance is opened in a tab)
				if (!this.tabID) return;
				let win = Zotero.getMainWindow();
				win.document.getElementById("zotero-tb-sync").focus();
			},
			onIframeTab: () => {
				// Tab after the last tabstop will focus the contextPane (if reader instance is opened in a tab)
				if (!this.tabID) return;
				let win = Zotero.getMainWindow();
				let focused = win.ZoteroContextPane.focus();
				// If context pane wasn't focused (e.g. it's collapsed), focus the tab bar
				if (!focused) {
					win.Zotero_Tabs.moveFocus("current");
				}
			},
			onSetZoom: (iframe, zoom) => {
				iframe.browsingContext.textZoom = 1;
				iframe.browsingContext.fullZoom = zoom;
			},
			onTextSelectionAnnotationModeChange: (mode) => {
				Zotero.Prefs.set('reader.textSelectionAnnotationMode', mode);
			},
			onBringReaderToFront: (bring) => {
				// Temporary bring reader iframe to front to make sure popups and context menus
				// aren't overlapped by contextPane, in Stacked View mode
				if (bring) {
					if (Zotero.Prefs.get('layout') === 'stacked') {
						this._iframe.parentElement.style.zIndex = 1;
					}
				}
				else {
					this._iframe.parentElement.style.zIndex = 'unset';
				}
			},
			onSaveCustomThemes: async (customThemes) => {
				// If a custom theme is deleted, clear the theme preference.
				// This ensures that the correct light/dark theme is auto-picked and also fixes #5070.
				const lightTheme = Zotero.Prefs.get('reader.lightTheme');
				const darkTheme = Zotero.Prefs.get('reader.darkTheme');

				if (lightTheme.startsWith('custom') && !customThemes?.some(theme => theme.id === lightTheme)) {
					Zotero.Prefs.clear('reader.lightTheme');
				}

				if (darkTheme.startsWith('custom') && !customThemes?.some(theme => theme.id === darkTheme)) {
					Zotero.Prefs.clear('reader.darkTheme');
				}
				
				if (customThemes?.length) {
					await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'readerCustomThemes', customThemes);
				}
				else {
					await Zotero.SyncedSettings.clear(Zotero.Libraries.userLibraryID, 'readerCustomThemes');
				}
			},
			onSetLightTheme: (themeName) => {
				Zotero.Prefs.set('reader.lightTheme', themeName || false);
			},
			onSetDarkTheme: (themeName) => {
				Zotero.Prefs.set('reader.darkTheme', themeName || false);
			}
		}, this._iframeWindow, { cloneFunctions: true }));

		this._resolveInitPromise();
		// Set title once again, because `ReaderWindow` isn't loaded the first time
		this.updateTitle();

		this._prefObserverIDs = [
			Zotero.Prefs.registerObserver('fontSize', this._handleFontSizeChange),
			Zotero.Prefs.registerObserver('tabs.title.reader', this._handleTabTitlePrefChange),
			Zotero.Prefs.registerObserver('reader.textSelectionAnnotationMode', this._handleTextSelectionAnnotationModeChange),
			Zotero.Prefs.registerObserver('reader.lightTheme', this._handleLightThemeChange),
			Zotero.Prefs.registerObserver('reader.darkTheme', this._handleDarkThemeChange),
			Zotero.Prefs.registerObserver('reader.ebookFontFamily', this._handleEbookPrefChange),
			Zotero.Prefs.registerObserver('reader.ebookHyphenate', this._handleEbookPrefChange),
			Zotero.Prefs.registerObserver('reader.autoDisableTool.note', this._handleAutoDisableToolPrefChange),
			Zotero.Prefs.registerObserver('reader.autoDisableTool.text', this._handleAutoDisableToolPrefChange),
			Zotero.Prefs.registerObserver('reader.autoDisableTool.image', this._handleAutoDisableToolPrefChange),
		];

		return true;
	}

	async _getData() {
		let item = Zotero.Items.get(this._item.id);
		let path = await item.getFilePathAsync();
		// Check file size, otherwise we get uncatchable error:
		// JavaScript error: resource://gre/modules/osfile/osfile_native.jsm, line 60: RangeError: invalid array length
		// See more https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Invalid_array_length
		let fileSize = (await OS.File.stat(path)).size;
		if (fileSize > ARRAYBUFFER_MAX_LENGTH) {
			throw new Error(`The file "${path}" is too large`);
		}
		return {
			url: `zotero://attachment/${Zotero.API.getLibraryPrefix(item.libraryID)}/items/${item.key}/`,
			importedFromURL: this._item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_IMPORTED_URL
				? this._item.getField('url')
				: undefined,
		};
	}

	uninit() {
		if (this._prefObserverIDs) {
			this._prefObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
		}
		this._flushState();
		if (this._blockingObserver && this._iframe) {
			this._blockingObserver.unregister(this._iframe);
		}
	}

	get itemID() {
		return this._item.id;
	}

	async updateTitle() {
		this._title = await this._item.getTabTitle();
		this._setTitleValue(this._title);
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
			this._internalReader.setAnnotations(Components.utils.cloneInto(annotations, this._iframeWindow));
		}
	}

	unsetAnnotations(keys) {
		this._internalReader.unsetAnnotations(Components.utils.cloneInto(keys, this._iframeWindow));
	}

	async navigate(location) {
		this._internalReader.navigate(Components.utils.cloneInto(location, this._iframeWindow));
	}

	async enableAddToNote(enable) {
		await this._initPromise;
		this._internalReader.enableAddToNote(enable);
	}

	focusLastToolbarButton() {
		this._iframeWindow.focus();
		// this._postMessage({ action: 'focusLastToolbarButton' });
	}

	tabToolbar(_reverse) {
		// this._postMessage({ action: 'tabToolbar', reverse });
		// Avoid toolbar find button being focused for a short moment
		setTimeout(() => this._iframeWindow.focus());
	}

	focusFirst() {
		// this._postMessage({ action: 'focusFirst' });
		setTimeout(() => this._iframeWindow.focus());
	}

	async setBottomPlaceholderHeight(height) {
		await this._initPromise;
		this._internalReader.setBottomPlaceholderHeight(height);
	}

	async setToolbarPlaceholderWidth(width) {
		await this._initPromise;
		this._internalReader.setToolbarPlaceholderWidth(width);
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

	_promptToDeletePages(num) {
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

	async reload() {
		let data = await this._getData();
		this._internalReader.reload(Components.utils.cloneInto(data, this._iframeWindow));
	}

	async transferFromPDF() {
		if (this.promptToTransferAnnotations(true)) {
			try {
				await Zotero.PDFWorker.import(this._item.id, true, '', true);
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

	/**
	 * @param {string} [path] For tests: used instead of getFilePathAsync()
	 * @returns {Promise<void>}
	 */
	async importFromEPUB(path = null) {
		let getKOReaderInput = async (path) => {
			// KOReader metadata is never embedded, so we just need to check
			// ./[basename-without-.epub].sdr/metadata.epub.lua
			if (path.endsWith('.epub')) {
				path = PathUtils.join(path.slice(0, -5) + '.sdr', 'metadata.epub.lua');
			}
			else if (!path.endsWith('.lua')) {
				return null;
			}
			if (!await IOUtils.exists(path)) {
				return null;
			}
			return Cu.cloneInto(await IOUtils.read(path), this._iframeWindow);
		};
		
		let getCalibreInput = async (path) => {
			let externalPath = PathUtils.filename(path).endsWith('.opf')
				? path
				: PathUtils.join(PathUtils.parent(path), 'metadata.opf');
			if (await IOUtils.exists(externalPath)) {
				return Zotero.File.getContentsAsync(externalPath);
			}
			if (!path.endsWith('.epub')) {
				return null;
			}
			
			let epubZip;
			try {
				epubZip = new ZipReader(Zotero.File.pathToFile(path));
			}
			catch (e) {
				Zotero.logError(e);
				return null;
			}
			
			try {
				const CALIBRE_BOOKMARKS_PATH = 'META-INF/calibre_bookmarks.txt';
				if (!epubZip.hasEntry(CALIBRE_BOOKMARKS_PATH)) {
					return null;
				}
				// Await before returning for the try-finally
				return await Zotero.File.getContentsAsync(epubZip.getInputStream(CALIBRE_BOOKMARKS_PATH));
			}
			finally {
				epubZip.close();
			}
		};
		
		let selectFile = async () => {
			let fp = new FilePicker();
			fp.init(this._window, Zotero.ftl.formatValueSync('pdfReader-import-from-epub-prompt-title'), fp.modeOpen);
			fp.appendFilter('EPUB Data', '*.epub; *.lua; *.opf');
			if (await fp.show() !== fp.returnOK) {
				return null;
			}
			return fp.file;
		};
		
		path ??= await this._item.getFilePathAsync();
		let isOpenFile = true;
		if (!path) {
			path = await selectFile();
			isOpenFile = false;
		}
		while (path) {
			let koReaderInput;
			try {
				koReaderInput = await getKOReaderInput(path);
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			let calibreInput;
			try {
				calibreInput = await getCalibreInput(path);
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			let koReaderStats = koReaderInput && this._internalReader.getKOReaderAnnotationStats(koReaderInput);
			let calibreStats = calibreInput && this._internalReader.getCalibreAnnotationStats(calibreInput);
			let stats = koReaderStats || calibreStats || { count: 0 };
			
			if (stats.count) {
				let ps = Services.prompt;
				let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
					+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
				let index = ps.confirmEx(
					this._window,
					Zotero.ftl.formatValueSync('pdfReader-import-from-epub-prompt-title'),
					Zotero.ftl.formatValueSync('pdfReader-import-from-epub-prompt-text', {
						count: stats.count,
						lastModifiedRelative: Zotero.Date.toRelativeDate(stats.lastModified),
						tool: stats === koReaderStats ? 'KOReader' : 'Calibre',
					}),
					buttonFlags,
					Zotero.getString('general.import'),
					'',
					Zotero.ftl.formatValueSync('pdfReader-import-from-epub-select-other'),
					'', {}
				);
				if (index === 0) {
					try {
						if (stats === koReaderStats) {
							this._internalReader.importAnnotationsFromKOReaderMetadata(koReaderInput);
						}
						else {
							this._internalReader.importAnnotationsFromCalibreMetadata(calibreInput);
						}
					}
					catch (e) {
						Zotero.alert(this._window, Zotero.getString('general.error'), e.message);
					}
					break;
				}
				else if (index === 1) {
					break;
				}
			}
			else {
				let ps = Services.prompt;
				let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
				
				let message = isOpenFile
					? Zotero.ftl.formatValueSync('pdfReader-import-from-epub-no-annotations-current-file')
					: Zotero.ftl.formatValueSync('pdfReader-import-from-epub-no-annotations-other-file', {
						filename: PathUtils.filename(path)
					});
				let index = ps.confirmEx(
					this._window,
					Zotero.ftl.formatValueSync('pdfReader-import-from-epub-prompt-title'),
					message,
					buttonFlags,
					Zotero.ftl.formatValueSync('pdfReader-import-from-epub-select-other'),
					'', '', '', {}
				);
				if (index === 1) {
					break;
				}
			}
			
			path = await selectFile();
			isOpenFile = false;
		}
	}

	export() {
		let zp = Zotero.getActiveZoteroPane();
		zp.exportPDF(this._item.id);
	}

	showInLibrary() {
		let win = Zotero.getMainWindow();
		if (win) {
			let item = Zotero.Items.get(this._item.id);
			let id = item.parentID || item.id;
			win.ZoteroPane.selectItems([id]);
			win.focus();
		}
	}

	async _setState(state) {
		let item = Zotero.Items.get(this._item.id);
		if (item) {
			if (this._type === 'pdf') {
				item.setAttachmentLastPageIndex(state.pageIndex);
			}
			else if (this._type === 'epub') {
				item.setAttachmentLastPageIndex(state.cfi);
			}
			else if (this._type === 'snapshot') {
				item.setAttachmentLastPageIndex(state.scrollYPercent);
			}
			let file = Zotero.Attachments.getStorageDirectory(item);
			if (!await OS.File.exists(file.path)) {
				await Zotero.Attachments.createDirectoryForItem(item);
			}
			file.append(this.stateFileName);
			
			// Write the new state to disk
			let path = file.path;

			// State updates can be frequent (every scroll) and we need to debounce actually writing them to disk.
			// We flush the debounced write operation when Zotero shuts down or the window/tab is closed.
			if (this._pendingWriteStateTimeout) {
				clearTimeout(this._pendingWriteStateTimeout);
			}
			this._pendingWriteStateFunction = async () => {
				if (this._pendingWriteStateTimeout) {
					clearTimeout(this._pendingWriteStateTimeout);
				}
				this._pendingWriteStateFunction = null;
				this._pendingWriteStateTimeout = null;
				
				Zotero.debug('Writing reader state to ' + path);
				// Using atomic `writeJSON` instead of `putContentsAsync` to avoid using temp file that causes conflicts
				// on simultaneous writes (on slow systems)
				await IOUtils.writeJSON(path, state);
			};
			this._pendingWriteStateTimeout = setTimeout(this._pendingWriteStateFunction, 5000);
		}
	}
	
	async _flushState() {
		if (this._pendingWriteStateFunction) {
			await this._pendingWriteStateFunction();
		}
	}

	async _getState() {
		let state;
		let item = Zotero.Items.get(this._item.id);
		let directory = Zotero.Attachments.getStorageDirectory(item);
		let file = directory.clone();
		file.append(this.stateFileName);
		try {
			if (await OS.File.exists(file.path)) {
				state = JSON.parse(await Zotero.File.getContentsAsync(file.path));
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		// Try to fall back to the older .zotero-pdf-state file
		if (!state && this._type === 'pdf') {
			let file = directory.clone();
			file.append('.zotero-pdf-state');
			try {
				if (await OS.File.exists(file.path)) {
					state = JSON.parse(await Zotero.File.getContentsAsync(file.path));
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}

		if (this._type === 'pdf') {
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
		}
		else if (this._type === 'epub') {
			let cfi = item.getAttachmentLastPageIndex();
			if (state) {
				state.cfi = cfi;
				return state;
			}
			else {
				return { cfi };
			}
		}
		else if (this._type === 'snapshot') {
			let scrollYPercent = item.getAttachmentLastPageIndex();
			if (state) {
				state.scrollYPercent = scrollYPercent;
				return state;
			}
			else {
				return { scrollYPercent };
			}
		}
		return null;
	}

	_isReadOnly() {
		let item = Zotero.Items.get(this._item.id);
		return !item.isEditable()
			|| item.deleted
			|| item.parentItem && item.parentItem.deleted;
	}

	_handleFontSizeChange = () => {
		this._internalReader.setFontSize(Zotero.Prefs.get('fontSize'));
	};

	_handleTabTitlePrefChange = async () => {
		await this.updateTitle();
	};

	_handleTextSelectionAnnotationModeChange = () => {
		this._internalReader.setTextSelectionAnnotationMode(Zotero.Prefs.get('reader.textSelectionAnnotationMode'));
	};

	_handleLightThemeChange = () => {
		this._internalReader.setLightTheme(Zotero.Prefs.get('reader.lightTheme'));
	};

	_handleDarkThemeChange = () => {
		this._internalReader.setDarkTheme(Zotero.Prefs.get('reader.darkTheme'));
	};

	_handleEbookPrefChange = () => {
		this._internalReader.setFontFamily(Zotero.Prefs.get('reader.ebookFontFamily'));
		this._internalReader.setHyphenate(Zotero.Prefs.get('reader.ebookHyphenate'));
	};

	_handleAutoDisableToolPrefChange = () => {
		this._internalReader.setAutoDisableNoteTool(Zotero.Prefs.get('reader.autoDisableTool.note'));
		this._internalReader.setAutoDisableTextTool(Zotero.Prefs.get('reader.autoDisableTool.text'));
		this._internalReader.setAutoDisableImageTool(Zotero.Prefs.get('reader.autoDisableTool.image'));
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
		return undefined;
	}

	_getColorIcon(color, selected) {
		let stroke = selected ? '%23555' : 'transparent';
		let fill = '%23' + color.slice(1);
		return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect shape-rendering="geometricPrecision" fill="${fill}" stroke-width="2" x="2" y="2" stroke="${stroke}" width="12" height="12" rx="3"/></svg>`;
	}

	_openTagsPopup(item, x, y) {
		let tagsPopup = this._window.document.createXULElement('panel');
		// <panel> completely takes over Escape keydown event, by attaching a capturing keydown
		// listener to document which just closes the popup. It leads to unwanted edits being saved.
		// Attach our own listener to this._window.document to properly handle Escape on edited tags
		let handleKeyDown = (event) => {
			if (event.key !== "Escape") return;
			let focusedTag = tagsPopup.querySelector("editable-text.focused");
			if (focusedTag) {
				if (focusedTag.closest("[isNew]")) {
					// remove newly added tag
					focusedTag.closest(".row").remove();
				}
				else {
					// or reset to initial value if the tag is not new
					focusedTag.value = focusedTag.initialValue;
				}
			}
			// now that all tags values are reset, close the popup
			tagsPopup.hidePopup();
		};
		tagsPopup.addEventListener('popuphidden', (event) => {
			if (event.target === tagsPopup) {
				tagsPopup.remove();
			}
			this._window.document.removeEventListener("keydown", handleKeyDown, true);
		});
		this._window.document.addEventListener("keydown", handleKeyDown, true);
		tagsPopup.className = 'tags-popup';
		let tagsbox = this._window.document.createXULElement('tags-box');
		tagsPopup.appendChild(tagsbox);
		tagsbox.setAttribute('flex', '1');
		this._popupset.appendChild(tagsPopup);
		let rect = this._iframe.getBoundingClientRect();
		x += rect.left;
		y += rect.top;
		tagsbox.editable = true;
		tagsbox.item = item;
		tagsbox.render();
		// remove unnecessary tabstop from the section header
		tagsbox.querySelector(".head").removeAttribute("tabindex");
		tagsPopup.addEventListener("popupshown", (_) => {
			// Ensure tagsbox is open
			tagsbox.open = true;
			if (tagsbox.count == 0) {
				tagsbox.newTag();
			}
			else {
				// Focus + button
				Services.focus.setFocus(tagsbox.querySelector("toolbarbutton"), Services.focus.FLAG_NOSHOWRING);
			}
			tagsbox.collapsible = false;
		});
		tagsPopup.openPopup(null, 'before_start', x, y, true);
	}

	async _openContextMenu({ x, y, itemGroups }) {
		let popup = this._window.document.createXULElement('menupopup');
		this._popupset.appendChild(popup);
		popup.addEventListener('popuphidden', function () {
			popup.remove();
		});
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
						menuitem.setAttribute('label', item.label);
						menuitem.setAttribute('disabled', item.disabled);
						if (item.color) {
							menuitem.className = 'menuitem-iconic';
							menuitem.setAttribute('image', this._getColorIcon(item.color, item.checked));
						}
						else if (item.checked) {
							menuitem.setAttribute('type', 'checkbox');
							menuitem.setAttribute('checked', item.checked);
						}
						menuitem.addEventListener('command', () => item.onCommand());
						parentNode.appendChild(menuitem);
					}
				}
				if (itemGroups.indexOf(itemGroup) !== itemGroups.length - 1) {
					let separator = parentNode.ownerDocument.createXULElement('menuseparator');
					parentNode.appendChild(separator);
				}
			}
		};
		appendItems(popup, itemGroups);
		let rect = this._iframe.getBoundingClientRect();
		rect = this._window.windowUtils.toScreenRectInCSSUnits(rect.x + x, rect.y + y, 0, 0);
		setTimeout(() => popup.openPopupAtScreen(rect.x, rect.y, true));
	}

	_updateSecondViewState() {
		if (this.tabID) {
			let win = Zotero.getMainWindow();
			if (win) {
				win.Zotero_Tabs.setSecondViewState(this.tabID, this.getSecondViewState());
			}
		}
	}

	async _waitForReader() {
		if (this._isReaderInitialized) {
			return;
		}
		let n = 0;
		while (!this._iframeWindow) {
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
	constructor(options) {
		super(options);
		this._sidebarWidth = options.sidebarWidth;
		this._sidebarOpen = options.sidebarOpen;
		this._bottomPlaceholderHeight = options.bottomPlaceholderHeight;
		this._showContextPaneToggle = true;
		this._onToggleSidebarCallback = options.onToggleSidebar;
		this._onChangeSidebarWidthCallback = options.onChangeSidebarWidth;
		this._window = Services.wm.getMostRecentWindow('navigator:browser');
		let existingTabID = options.tabID;
		// If an unloaded tab for this item already exists, load the reader in it.
		// Otherwise, create a new tab
		if (existingTabID) {
			this.tabID = existingTabID;
			this._tabContainer = this._window.document.getElementById(existingTabID);
		}
		else {
			let { id, container } = this._window.Zotero_Tabs.add({
				id: options.tabID,
				type: 'reader',
				title: options.title || '',
				index: options.index,
				data: {
					itemID: this._item.id
				},
				select: !options.background,
				preventJumpback: options.preventJumpback
			});
			this.tabID = id;
			this._tabContainer = container;
		}
		
		this._iframe = this._window.document.createXULElement('browser');
		this._iframe.setAttribute('class', 'reader');
		this._iframe.setAttribute('flex', '1');
		this._iframe.setAttribute('type', 'content');
		this._iframe.setAttribute('transparent', 'true');
		this._iframe.setAttribute('src', 'resource://zotero/reader/reader.html');
		this._iframe.setAttribute('context', 'textbox-contextmenu');
		this._tabContainer.appendChild(this._iframe);
		this._iframe.docShell.windowDraggingAllowed = true;
		
		this._popupset = this._window.document.createXULElement('popupset');
		this._tabContainer.appendChild(this._popupset);
		
		this._window.addEventListener('DOMContentLoaded', this._handleLoad);
		this._window.addEventListener('pointerdown', this._handlePointerDown);
		this._window.addEventListener('pointerup', this._handlePointerUp);

		this._window.goBuildEditContextMenu();

		this._iframe.setAttribute('tooltip', 'html-tooltip');

		this._open({ location: options.location, secondViewState: options.secondViewState });
	}
	
	close() {
		this._window.removeEventListener('DOMContentLoaded', this._handleLoad);
		this._window.removeEventListener('pointerdown', this._handlePointerDown);
		this._window.removeEventListener('pointerup', this._handlePointerUp);
		if (this.tabID) {
			this._window.Zotero_Tabs.close(this.tabID);
		}
	}

	_handleLoad = (event) => {
		if (this._iframe && this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
			this._window.removeEventListener('DOMContentLoaded', this._handleLoad);
			this._iframeWindow = this._iframe.contentWindow;
			this._iframeWindow.addEventListener('error', event => Zotero.logError(event.error));

			// Disable text direction switching option because it tries to change direction
			// for the whole window and crashes it
			this._iframeWindow.addEventListener('contextmenu', () => {
				let popup = this._window.goBuildEditContextMenu();
				this._window.goUpdateGlobalEditMenuItems(true);
				popup.addEventListener('popupshowing', (e) => {
					let menuitemSwitchTextDirection = e.target.querySelector("[command='cmd_switchTextDirection']");
					if (menuitemSwitchTextDirection) {
						menuitemSwitchTextDirection.hidden = true;
					}
				}, { once: true });
			});
		}
	};

	// We don't want to send fake pointerup event, if pointerdown and pointerup was in the same iframe
	_handlePointerDown = (event) => {
		if (this._window.Zotero_Tabs.selectedID === this.tabID
			&& event.target.closest('#outerContainer')) {
			this._pointerDownWindow = event.target.ownerDocument.defaultView;
		}
	};

	// This is a nonsense work-around to trigger mouseup and pointerup
	// events in PDF reader iframe when mouse up happens over another iframe
	// i.e. note-editor. There should be a better way to solve this
	_handlePointerUp = (event) => {
		try {
			var _window = event.target.ownerDocument.defaultView;
			if (this._window.Zotero_Tabs.selectedID === this.tabID
				// If the event isn't inside a reader PDF.js iframe, or isn't the same iframe (if using split view)
				&& (!event.target.closest('#outerContainer') || this._pointerDownWindow !== _window)
				&& this._pointerDownWindow
			) {
				let evt = new this._internalReader._primaryView._iframeWindow.MouseEvent('mouseup', { ...event, bubbles: false });
				this._internalReader._primaryView._iframeWindow.dispatchEvent(evt);
				this._internalReader._secondaryView?._iframeWindow.dispatchEvent(evt);
				if (evt.defaultPrevented) {
					event.preventDefault();
					return;
				}
				if (evt.clickEventPrevented && evt.clickEventPrevented()) {
					event.preventClickEvent();
				}
				evt = new this._internalReader._primaryView._iframeWindow.PointerEvent('pointerup', { ...event, bubbles: false });
				this._internalReader._primaryView._iframeWindow.dispatchEvent(evt);
				this._internalReader._secondaryView?._iframeWindow.dispatchEvent(evt);
				if (evt.defaultPrevented) {
					event.preventDefault();
				}
			}
			this._pointerDownWindow = null;
		}
		catch (e) {
			if (!e.message.includes("can't access dead object")) {
				Zotero.logError(e);
			}
		}
	};

	_setTitleValue() {}

	_addToNote(annotations) {
		annotations = annotations.map(x => ({ ...x, attachmentItemID: this._item.id }));
		if (!this._window.ZoteroContextPane) {
			return;
		}
		let noteEditor = this._window.ZoteroContextPane.activeEditor;
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
	constructor(options) {
		super(options);
		this._sidebarWidth = options.sidebarWidth;
		this._sidebarOpen = options.sidebarOpen;
		this._bottomPlaceholderHeight = 0;
		this._onClose = options.onClose;

		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (!win) return;

		this._window = win.open(
			'chrome://zotero/content/reader.xhtml', '', 'chrome,resizable'
		);

		this._window.addEventListener('DOMContentLoaded', (event) => {
			if (event.target === this._window.document) {
				this._popupset = this._window.document.getElementById('zotero-reader-popupset');
				this._window.onFileMenuOpen = this._onFileMenuOpen.bind(this);
				this._window.onGoMenuOpen = this._onGoMenuOpen.bind(this);
				this._window.onViewMenuOpen = this._onViewMenuOpen.bind(this);
				this._window.reader = this;
				this._iframe = this._window.document.getElementById('reader');
				this._iframe.docShell.windowDraggingAllowed = true;
			}

			if (this._iframe.contentWindow && this._iframe.contentWindow.document === event.target) {
				this._iframeWindow = this._window.document.getElementById('reader').contentWindow;
				this._iframeWindow.addEventListener('error', event => Zotero.logError(event.error));
				this._window.goBuildEditContextMenu();
				// Disable text direction switching option because it changes direction for the whole window
				this._iframeWindow.addEventListener('contextmenu', () => {
					let popup = this._window.goBuildEditContextMenu();
					this._window.goUpdateGlobalEditMenuItems(true);
					popup.addEventListener('popupshowing', (e) => {
						let menuitemSwitchTextDirection = e.target.querySelector("[command='cmd_switchTextDirection']");
						if (menuitemSwitchTextDirection) {
							menuitemSwitchTextDirection.hidden = true;
						}
					}, { once: true });
				});
			}

			this._switchReaderSubtype(this._type);
		});

		this._open({ state: options.state, location: options.location, secondViewState: options.secondViewState });
	}

	_switchReaderSubtype(subtype) {
		// Do the same as in standalone.js
		this._window.document.querySelectorAll(
			'.menu-type-reader.pdf, .menu-type-reader.epub, .menu-type-reader.snapshot'
		).forEach(el => el.hidden = true);
		this._window.document.querySelectorAll('.menu-type-reader.' + subtype).forEach(el => el.hidden = false);
	}

	close() {
		this.uninit();
		this._window.close();
		this._onClose();
	}

	_setTitleValue(title) {
		// Tab titles render Citeproc.js markup. There's no good way
		// to show rich text in a window title, but we can at least
		// strip the markup.
		this._window.document.title = Zotero.Utilities.Internal.renderItemTitle(title);
	}

	_onFileMenuOpen() {
		let item = Zotero.Items.get(this._item.id);
		let library = Zotero.Libraries.get(item.libraryID);
		
		let transferFromPDFMenuitem = this._window.document.getElementById('menu_transferFromPDF');
		let importFromEPUBMenuitem = this._window.document.getElementById('menu_importFromEPUB');
		
		if (item
			&& library.filesEditable
			&& library.editable
			&& !(item.deleted || item.parentItem && item.parentItem.deleted)) {
			let annotations = item.getAnnotations();
			let canTransferFromPDF = annotations.find(x => x.annotationIsExternal);
			transferFromPDFMenuitem.setAttribute('disabled', !canTransferFromPDF);
			importFromEPUBMenuitem.setAttribute('disabled', false);
		}
		else {
			transferFromPDFMenuitem.setAttribute('disabled', true);
			importFromEPUBMenuitem.setAttribute('disabled', true);
		}
	}

	_onViewMenuOpen() {
		if (this._type === 'pdf' || this._type === 'epub') {
			this._window.document.getElementById('view-menuitem-no-spreads').setAttribute('checked', this._internalReader.spreadMode === 0);
			this._window.document.getElementById('view-menuitem-odd-spreads').setAttribute('checked', this._internalReader.spreadMode === 1);
			this._window.document.getElementById('view-menuitem-even-spreads').setAttribute('checked', this._internalReader.spreadMode === 2);
		}
		if (this._type === 'pdf') {
			this._window.document.getElementById('view-menuitem-vertical-scrolling').setAttribute('checked', this._internalReader.scrollMode === 0);
			this._window.document.getElementById('view-menuitem-horizontal-scrolling').setAttribute('checked', this._internalReader.scrollMode === 1);
			this._window.document.getElementById('view-menuitem-wrapped-scrolling').setAttribute('checked', this._internalReader.scrollMode === 2);
			this._window.document.getElementById('view-menuitem-hand-tool').setAttribute('checked', this._internalReader.toolType === 'hand');
			this._window.document.getElementById('view-menuitem-zoom-auto').setAttribute('checked', this._internalReader.zoomAutoEnabled);
			this._window.document.getElementById('view-menuitem-zoom-page-width').setAttribute('checked', this._internalReader.zoomPageWidthEnabled);
			this._window.document.getElementById('view-menuitem-zoom-page-height').setAttribute('checked', this._internalReader.zoomPageHeightEnabled);
		}
		else if (this._type === 'epub') {
			this._window.document.getElementById('view-menuitem-scrolled').setAttribute('checked', this._internalReader.flowMode === 'scrolled');
			this._window.document.getElementById('view-menuitem-paginated').setAttribute('checked', this._internalReader.flowMode === 'paginated');
		}
		this._window.document.getElementById('view-menuitem-split-vertically').setAttribute('checked', this._internalReader.splitType === 'vertical');
		this._window.document.getElementById('view-menuitem-split-horizontally').setAttribute('checked', this._internalReader.splitType === 'horizontal');
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

		if (['pdf', 'epub'].includes(this._type)) {
			this._window.document.getElementById('go-menuitem-first-page').setAttribute('disabled', !this._internalReader.canNavigateToFirstPage);
			this._window.document.getElementById('go-menuitem-last-page').setAttribute('disabled', !this._internalReader.canNavigateToLastPage);
		}
		this._window.document.getElementById('go-menuitem-back').setAttribute('disabled', !this._internalReader.canNavigateBack);
		this._window.document.getElementById('go-menuitem-forward').setAttribute('disabled', !this._internalReader.canNavigateForward);
	}
}


class ReaderPreview extends ReaderInstance {
	// TODO: implement these inside reader after redesign is done there
	static CSS = {
		global: `
		#split-view, .split-view {
			top: 0 !important;
			inset-inline-start: 0 !important;
		}
		#reader-ui {
			display: none !important;
		}`,
		pdf: `
		#mainContainer {
			/* Hide left-side vertical line */
			margin-inline-start: -1px;
		}
		#viewerContainer {
			overflow: hidden;
		}
		.pdfViewer {
			padding: 6px 0px;
		}
		.pdfViewer .page {
			border-radius: 5px;
			box-shadow: none;
		}
		.pdfViewer .page::before {
			content: "";
			position: absolute;
			height: 100%;
			width: 100%;
			border-radius: 5px;
		}
		@media (prefers-color-scheme: light) {
			body #viewerContainer {
				background-color: #f2f2f2 !important;
			}
			.pdfViewer .page::before {
				box-shadow: inset 0 0 0px 1px #0000001a;
			}
		}
		@media (prefers-color-scheme: dark) {
			body #viewerContainer {
				background-color: #303030 !important;
			}
			.pdfViewer .page::before {
				box-shadow: inset 0 0 0px 1px #ffffff1f;
			}
		}`,
		epub: `
		body.flow-mode-paginated {
			margin: 8px !important;
		}
		body.flow-mode-paginated > .sections {
			min-height: calc(100vh - 16px);
			max-height: calc(100vh - 16px);
		}
		body.flow-mode-paginated > .sections.spread-mode-odd {
			column-width: calc(50vw - 16px);
		}
		body.flow-mode-paginated replaced-body img, body.flow-mode-paginated replaced-body svg,
		body.flow-mode-paginated replaced-body audio, body.flow-mode-paginated replaced-body video {
			max-width: calc(50vw - 16px) !important;
			max-height: calc(100vh - 16px) !important;
		}
		body.flow-mode-paginated replaced-body .table-like {
			max-height: calc(100vh - 16px);
		}
		`,
		snapshot: `
		html {
			pointer-events: none !important;
			user-select: none !important;
			min-width: 1024px;
			transform: scale(var(--win-scale));
			transform-origin: 0 0;
			overflow-x: hidden;
		}
		
		body {
			overflow-y: visible;
		}`
	};

	constructor(options) {
		super(options);
		this._iframe = options.iframe;
		this._iframeWindow = this._iframe.contentWindow;
		this._iframeWindow.addEventListener('error', event => Zotero.logError(event.error));
	}

	async _open({ state, location, secondViewState }) {
		let success;
		try {
			success = await super._open({ state, location, secondViewState, preview: true });

			this._injectCSS(this._iframeWindow.document, ReaderPreview.CSS.global);

			let ready = await this._waitForInternalReader();
			if (!ready) {
				return false;
			}

			let win = this._internalReader._primaryView._iframeWindow;
			if (this._type === "snapshot") {
				win.addEventListener(
					"resize", this.updateSnapshotAttr);
				this.updateSnapshotAttr();
			}
			else if (this._type === "pdf") {
				let viewer = win?.PDFViewerApplication?.pdfViewer;
				let t = 0;
				while (!viewer?.firstPagePromise && t < 100) {
					t++;
					await Zotero.Promise.delay(10);
					viewer = win?.PDFViewerApplication?.pdfViewer;
				}
				await viewer?.firstPagePromise;
				win.addEventListener("resize", this.updatePDFAttr);
				this.updatePDFAttr();
			}
			else if (this._type === "epub") {
				this.updateEPUBAttr();
			}

			this._injectCSS(
				win.document,
				ReaderPreview.CSS[this._type]
			);

			return success;
		}
		catch (e) {
			Zotero.warn(`Failed to load preview for attachment ${this._item?.libraryID}/${this._item?.key}: ${String(e)}`);
			this._item = null;
			return false;
		}
	}

	uninit() {
		if (this._type === "snapshot") {
			this._internalReader?._primaryView?._iframeWindow.removeEventListener(
				"resize", this.updateSnapshotAttr);
		}
		else if (this._type === "pdf") {
			this._internalReader?._primaryView?._iframeWindow.removeEventListener(
				"resize", this.updatePDFAttr);
		}
		super.uninit();
	}

	/**
	 * Goto previous/next page
	 * @param {"prev" | "next"} type goto previous or next page
	 * @returns {void}
	 */
	goto(type) {
		if (type === "prev") {
			this._internalReader.navigateToPreviousPage();
		}
		else {
			this._internalReader.navigateToNextPage();
		}
	}

	/**
	 * Check if can goto previous/next page
	 * @param {"prev" | "next"} type goto previous or next page
	 * @returns {boolean}
	 */
	canGoto(type) {
		if (type === "prev") {
			return this._internalReader?._state?.primaryViewStats?.canNavigateToPreviousPage;
		}
		else {
			return this._internalReader?._state?.primaryViewStats?.canNavigateToNextPage;
		}
	}

	_isReadOnly() {
		return true;
	}

	async _getState() {
		if (this._type === "pdf") {
			return { pageIndex: 0, scale: "page-height", scrollMode: 0, spreadMode: 0 };
		}
		else if (this._type === "epub") {
			return Object.assign(await super._getState(), {
				scale: 1,
				flowMode: "paginated",
				spreadMode: 0
			});
		}
		else if (this._type === "snapshot") {
			return { scale: 1, scrollYPercent: 0 };
		}
		return super._getState();
	}

	async _setState() {}

	updateTitle() {}

	_injectCSS(doc, content) {
		if (!content) {
			return;
		}
		let style = doc.createElement("style");
		style.textContent = content;
		doc.head.appendChild(style);
	}

	updateSnapshotAttr = () => {
		let win = this._internalReader?._primaryView?._iframeWindow;
		let root = win?.document?.documentElement;
		root?.style.setProperty('--win-scale', String(this._iframe.getBoundingClientRect().width / 1024));
	};

	updateEPUBAttr() {
		let view = this._internalReader?._primaryView;
		let currentSize = parseFloat(
			view._iframeWindow?.getComputedStyle(view?._iframeDocument?.documentElement).fontSize);
		let scale = 12 / currentSize;
		view?._setScale(scale);
	}

	updatePDFAttr = () => {
		this._internalReader._primaryView._iframeWindow.PDFViewerApplication.pdfViewer.currentScaleValue = 'page-height';
		this._internalReader._primaryView._iframeWindow.PDFViewerApplication.pdfViewer.scrollMode = 3;
	};

	getPageWidthHeightRatio() {
		if (this._type !== 'pdf') {
			return NaN;
		}
		try {
			let viewport = this._internalReader?._primaryView?._iframeWindow
				?.PDFViewerApplication?.pdfViewer._pages[0].viewport;
			return viewport?.width / viewport?.height;
		}
		catch (e) {
			return NaN;
		}
	}

	async _waitForInternalReader() {
		let n = 0;
		try {
			while (!this._internalReader?._primaryView?._iframeWindow) {
				if (n >= 500) {
					return false;
				}
				await Zotero.Promise.delay(10);
				n++;
			}
			await this._internalReader._primaryView.initializedPromise;
			return true;
		}
		catch (e) {
			return false;
		}
	}
}


class Reader {
	constructor() {
		this._sidebarWidth = 240;
		this._sidebarOpen = false;
		this._bottomPlaceholderHeight = 0;
		this._readers = [];
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'setting', 'tab'], 'reader');
		this._registeredListeners = [];
		this.onChangeSidebarWidth = null;
		this.onToggleSidebar = null;

		this._debounceSidebarWidthUpdate = Zotero.Utilities.debounce(() => {
			let readers = this._readers.filter(r => r instanceof ReaderTab);
			for (let reader of readers) {
				reader.setSidebarWidth(this._sidebarWidth);
			}
			this._setSidebarState();
		}, 500);

		Zotero.Plugins.addObserver({
			shutdown: ({ id: pluginID }) => {
				this._unregisterEventListenerByPluginID(pluginID);
			}
		});
	}

	_dispatchEvent(event) {
		for (let listener of this._registeredListeners) {
			if (listener.type === event.type) {
				listener.handler(event);
			}
		}
	}

	/**
	 * Inject DOM nodes to reader UI parts:
	 * - renderTextSelectionPopup
	 * - renderSidebarAnnotationHeader
	 * - renderToolbar
	 *
	 * Zotero.Reader.registerEventListener('renderTextSelectionPopup', (event) => {
	 * 	let { reader, doc, params, append } = event;
	 * 	let container = doc.createElement('div');
	 * 	container.append('Loading…');
	 * 	append(container);
	 * 	setTimeout(() => container.replaceChildren('Translated text: ' + params.annotation.text), 1000);
	 * });
	 *
	 *
	 * Add options to context menus:
	 * - createColorContextMenu
	 * - createViewContextMenu
	 * - createAnnotationContextMenu
	 * - createThumbnailContextMenu
	 * - createSelectorContextMenu
	 *
	 * Zotero.Reader.registerEventListener('createAnnotationContextMenu', (event) => {
	 * 	let { reader, params, append } = event;
	 * 	append({
	 * 		label: 'Test',
	 * 		onCommand(){ reader._iframeWindow.alert('Selected annotations: ' + params.ids.join(', ')); }
	 * 	});
	 * });
	 */
	registerEventListener(type, handler, pluginID = undefined) {
		this._registeredListeners.push({ pluginID, type, handler });
	}

	unregisterEventListener(type, handler) {
		this._registeredListeners = this._registeredListeners.filter(x => x.type === type && x.handler === handler);
	}

	_unregisterEventListenerByPluginID(pluginID) {
		this._registeredListeners = this._registeredListeners.filter(x => x.pluginID !== pluginID);
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
	
	toggleSidebar(open) {
		this._sidebarOpen = open;
		let readers = this._readers.filter(r => r instanceof ReaderTab);
		for (let reader of readers) {
			reader.toggleSidebar(open);
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
					this.triggerAnnotationsImportCheck(reader.itemID);
				}
			}
			
			if (event === 'add' || event === 'close') {
				Zotero.Session.debounceSave();
			}
		}
		// Listen for parent item, PDF attachment and its annotations updates
		else if (type === 'item') {
			for (let reader of this._readers.slice()) {
				if (event === 'delete' && ids.includes(reader.itemID)) {
					reader.close();
				}

				// Ignore other notifications if the attachment no longer exists
				let item = Zotero.Items.get(reader.itemID);
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
						if (['add', 'modify'].includes(event)) {
							let annotationItems = item.getAnnotations();
							reader.annotationItemIDs = annotationItems.map(x => x.id);
							let affectedAnnotations = annotationItems.filter(({ id }) => (
								ids.includes(id)
								&& !(extraData && extraData[id] && extraData[id].instanceID === reader._instanceID)
							));
							if (affectedAnnotations.length) {
								reader.setAnnotations(affectedAnnotations);
							}
						}
						// Update title if the PDF attachment or the parent item changes
						if (ids.includes(reader.itemID) || ids.includes(item.parentItemID)) {
							reader.updateTitle();
						}
					}
				}
			}
		}
		else if (type === 'setting') {
			let id = ids[0];
			if (id === `${Zotero.Libraries.userLibraryID}/readerCustomThemes`) {
				let newCustomThemes = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'readerCustomThemes') ?? [];
				this._readers.forEach((reader) => {
					reader._internalReader.setCustomThemes(
						Components.utils.cloneInto(newCustomThemes, reader._iframeWindow)
					);
				});
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
				itemID: r.itemID,
				title: r._title,
				secondViewState: r.getSecondViewState()
			}));
	}

	async openURI(itemURI, location, options) {
		let item = await Zotero.URI.getURIItem(itemURI);
		if (!item) return;
		await this.open(item.id, location, options);
	}

	async open(itemID, location, { title, tabIndex, tabID, openInBackground, openInWindow, allowDuplicate, secondViewState, preventJumpback } = {}) {
		let { libraryID } = Zotero.Items.getLibraryAndKeyFromID(itemID);
		let library = Zotero.Libraries.get(libraryID);
		let win = Zotero.getMainWindow();

		await library.waitForDataLoad('item');

		let item = Zotero.Items.get(itemID);
		if (!item) {
			throw new Error('Item does not exist');
		}

		this._loadSidebarState();
		this.triggerAnnotationsImportCheck(itemID);
		let reader;
		// If duplicating is not allowed, and no reader instance is loaded for itemID,
		// try to find an unloaded tab and select it. Zotero.Reader.open will then be called again
		if (!allowDuplicate && !this._readers.find(r => r.itemID === itemID)) {
			if (win) {
				let existingTabID = win.Zotero_Tabs.getTabIDByItemID(itemID);
				if (existingTabID) {
					win.Zotero_Tabs.select(existingTabID, false, { location });
					return undefined;
				}
			}
		}

		if (openInWindow) {
			reader = this._readers.find(r => r.itemID === itemID && (r instanceof ReaderWindow));
		}
		else if (!allowDuplicate) {
			reader = this._readers.find(r => r.itemID === itemID);
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
				item,
				location,
				secondViewState,
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight,
				onClose: () => {
					this._readers.splice(this._readers.indexOf(reader), 1);
					Zotero.Session.debounceSave();
				}
			});
			this._readers.push(reader);
			Zotero.Session.debounceSave();
		}
		else {
			reader = new ReaderTab({
				item,
				location,
				secondViewState,
				title,
				index: tabIndex,
				tabID,
				background: openInBackground,
				sidebarWidth: this._sidebarWidth,
				sidebarOpen: this._sidebarOpen,
				bottomPlaceholderHeight: this._bottomPlaceholderHeight,
				preventJumpback: preventJumpback,
				onToggleSidebar: (open) => {
					this._sidebarOpen = open;
					this.toggleSidebar(open);
					if (this.onToggleSidebar) {
						this.onToggleSidebar(open);
					}
				},
				onChangeSidebarWidth: (width) => {
					this._sidebarWidth = width;
					this._debounceSidebarWidthUpdate();
					if (this.onChangeSidebarWidth) {
						this.onChangeSidebarWidth(width);
					}
				}
			});
			this._readers.push(reader);
			// Change tab's type from "reader-unloaded" to "reader" after reader loaded
			win.Zotero_Tabs.markAsLoaded(tabID);
		}
		
		if (!openInBackground
			&& !win.Zotero_Tabs.focusOptions.keepTabFocused) {
			// Do not change focus when tabs are traversed/selected using a keyboard
			reader.focus();
		}
		return reader;
	}

	async openPreview(itemID, iframe) {
		let { libraryID } = Zotero.Items.getLibraryAndKeyFromID(itemID);
		let library = Zotero.Libraries.get(libraryID);
		await library.waitForDataLoad('item');

		let item = Zotero.Items.get(itemID);
		if (!item) {
			throw new Error('Item does not exist');
		}

		let reader = new ReaderPreview({
			item,
			sidebarWidth: 0,
			sidebarOpen: false,
			bottomPlaceholderHeight: 0,
			iframe,
		});
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
		if (!item.isPDFAttachment()
			|| !item.isEditable()
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
	
	async flushAllReaderStates() {
		for (let reader of this._readers) {
			try {
				await reader._flushState();
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}
}

Zotero.Reader = new Reader();
Zotero.addShutdownListener(() => Zotero.Reader.flushAllReaderStates());
