let PDFStates = {};

const COLORS = [
	['Red', '#ff6666'],
	['Orange', '#ff8c19'],
	['Green', '#5fb236'],
	['Blue', '#2ea8e5'],
	['Purple', '#a28ae5']
];

class ViewerWindow {
	constructor() {
		this._window = null;
		this._iframeWindow = null;
		this.popupData = null;
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

			return new this._iframeWindow.Blob([u8arr], { type: mime });
		}
	}

	toggleNoteSidebar(isToggled) {
		let splitter = this._window.document.getElementById('zotero-viewer-splitter');
		let sidebar = this._window.document.getElementById('zotero-viewer-note-sidebar');

		if (isToggled) {
			splitter.hidden = false;
			sidebar.hidden = false;
		}
		else {
			splitter.hidden = true;
			sidebar.hidden = true;
		}
	}

	openAnnotationPopup(x, y, annotationId, selectedColor) {
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
				id: this.popupData.id
			};
			this._iframeWindow.postMessage(data, '*');
		});
		popup.appendChild(menuitem);

		popup.appendChild(this._window.document.createElement('menuseparator'));

		for (let color of COLORS) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', color[0]);
			menuitem.className = 'menuitem-iconic';
			let stroke = color[1] === selectedColor ? 'lightgray' : 'transparent';
			let fill = '%23' + color[1].slice(1);
			menuitem.setAttribute('image', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle shape-rendering="geometricPrecision" fill="' + fill + '" stroke-width="2" stroke="' + stroke + '" cx="8" cy="8" r="6"/></svg>');
			menuitem.addEventListener('command', () => {
				let data = {
					action: 'popupCmd',
					cmd: 'setAnnotationColor',
					id: this.popupData.id,
					color: color[1]
				};
				this._iframeWindow.postMessage(data, '*');
			});
			popup.appendChild(menuitem);
		}
		popup.openPopupAtScreen(x, y, true);
	}

	openColorPopup(x, y, selectedColor) {
		let popup = this._window.document.getElementById('colorPopup');
		popup.hidePopup();

		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}

		let menuitem;

		for (let color of COLORS) {
			menuitem = this._window.document.createElement('menuitem');
			menuitem.setAttribute('label', color[0]);
			menuitem.className = 'menuitem-iconic';
			let stroke = color[1] === selectedColor ? 'lightgray' : 'transparent';
			let fill = '%23' + color[1].slice(1);
			menuitem.setAttribute('image', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle shape-rendering="geometricPrecision" fill="' + fill + '" stroke-width="2" stroke="' + stroke + '" cx="8" cy="8" r="6"/></svg>');
			menuitem.addEventListener('command', () => {
				let data = {
					action: 'popupCmd',
					cmd: 'setColor',
					color: color[1]
				};
				this._iframeWindow.postMessage(data, '*');
			});
			popup.appendChild(menuitem);
		}
		popup.openPopupAtScreen(x, y, true);
	}


	init() {
		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (!win) return;

		this._window = win.open(
			'chrome://zotero/content/viewer.xul', '', 'chrome,resizable,centerscreen'
		);

		this._window.addEventListener('DOMContentLoaded', (e) => {
			this._window.fillTooltip = (tooltip) => {
				let node = this._window.document.tooltipNode.closest('*[title]');
				if (!node) {
					return false;
				}

				tooltip.setAttribute('label', node.getAttribute('title'));
				return true;
			}

			this._window.menuCmd = (cmd) => {

				if (cmd === 'export') {
					let zp = Zotero.getActiveZoteroPane();
					zp.exportPDF(this.itemID);
					return;
				}

				let data = {
					action: 'menuCmd',
					cmd
				};

				this._iframeWindow.postMessage(data, '*');
			}

			let viewerIframe = this._window.document.getElementById('viewer');
			if (!(viewerIframe && viewerIframe.contentWindow && viewerIframe.contentWindow.document === e.target)) return;

			let that = this;
			let editor = this._window.document.getElementById('zotero-viewer-editor');
			editor.navigateHandler = async function (uri, annotation) {
				let item = await Zotero.URI.getURIItem(uri);
				if (!item) return;

				that.open(item.id, annotation);
			}


			this._iframeWindow = this._window.document.getElementById('viewer').contentWindow;

			// In the iframe `window.performance` is null which firstly makes React to fail,
			// because it expects `undefined` or `object` type, and secondly pdf.js is hardcoded
			// to always use performance API
			// By using the method below the performance API in the iframe appears not immediately,
			// which can cause problems for scipts trying to access it too early
			this._iframeWindow.performance = this._window.performance;

			this._iframeWindow.addEventListener('message', async (e) => {
				// Clone data to avoid the dead object error when the window is closed
				let data = JSON.parse(JSON.stringify(e.data));

				switch (data.action) {
					case 'load':
						this.load(data.libraryID, data.key);
						break;

					case 'setAnnotation':

						var item = await Zotero.Items.getAsync(this.itemID);
						data.annotation.key = data.annotation.id;
						var annotation = await Zotero.Annotations.saveFromJSON(item, data.annotation);

						if (data.annotation.image) {
							let blob = this.dataURLtoBlob(data.annotation.image);
							let attachmentIds = annotation.getAttachments();
							if (attachmentIds.length) {
								let attachment = Zotero.Items.get(attachmentIds[0]);
								var path = await attachment.getFilePathAsync();
								await Zotero.File.putContentsAsync(path, blob);
								await Zotero.Sync.Storage.Local.updateSyncStates([attachment], 'to_upload');
							}
							else {
								let imageAttachment = await Zotero.Attachments.importEmbeddedImage({
									blob,
									parentItemID: annotation.id
								});
							}
						}

						break;

					case 'deleteAnnotations':
						for (let id of data.ids) {
							let item = Zotero.Items.getByLibraryAndKey(this.libraryID, id);
							if (item) {
								await Zotero.Items.trashTx([item.id]);
							}
						}
						break;

					case 'setState':
						PDFStates[this.itemID] = data.state;
						break;

					case 'openTagsPopup':
						var item = Zotero.Items.getByLibraryAndKey(this.libraryID, data.id);
						if (item) {
							this._window.document.getElementById('tags').item = item;
							this._window.document.getElementById('tagsPopup').openPopupAtScreen(data.x, data.y, false);
						}
						break;

					case 'openAnnotationPopup':
						this.popupData = data;
						this.openAnnotationPopup(data.x, data.y, data.id, data.selectedColor);
						break;

					case 'openColorPopup':
						this.popupData = data;
						this.openColorPopup(data.x, data.y, data.selectedColor);
						break;

					case 'openURL':
						let win = Services.wm.getMostRecentWindow('navigator:browser');
						if (win) {
							win.ZoteroPane.loadURI(data.url);
						}
						break;

					case 'import':
						Zotero.debug('Importing PDF annotations');
						let item1 = Zotero.Items.get(this.itemID);
						Zotero.PDFImport.import(item1);
						break;

					case 'importDismiss':
						Zotero.debug('Dismiss PDF annotations');
						break;

					case 'save':
						Zotero.debug('Exporting PDF');
						var zp = Zotero.getActiveZoteroPane();
						zp.exportPDF(this.itemID);
						break;

					case 'toggleNoteSidebar':
						this.toggleNoteSidebar(data.isToggled);
						break;
				}
			});
		});
		return true;
	};

	async waitForViewer() {
		await Zotero.Promise.delay(100);
		let n = 0;
		while (!this._iframeWindow || !this._iframeWindow.eval('window.isDocumentReady')) {
			if (n >= 500) {
				throw new Error('Waiting for viewer failed');
			}
			await Zotero.Promise.delay(100);

			n++;
		}
	};

	async waitForViewer2() {
		let n = 0;
		while (!this._iframeWindow) {
			if (n >= 50) {
				throw new Error('Waiting for viewer failed');
			}
			await Zotero.Promise.delay(10);
			n++;
		}
	};

	async open(itemID, annotation) {
		await this.waitForViewer2();

		let item = await Zotero.Items.getAsync(itemID);
		if (!item) return;
		let url = 'zotero://pdf.js/viewer.html?libraryID=' + item.libraryID + '&key=' + item.key;
		if (url !== this._iframeWindow.location.href) {
			this._iframeWindow.location = url;
		}

		this.navigate(annotation);

		return true;
	};

	async load(libraryID, key) {
		let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
		if (!item) return;


		this.itemID = item.id;
		this.libraryID = item.libraryID;

		let title = item.getField('title');
		let parentItemID = item.parentItemID;
		if (parentItemID) {
			let parentItem = await Zotero.Items.getAsync(parentItemID);
			if (parentItem) {
				title = parentItem.getField('title');
			}
		}

		this._window.document.title = title;
		Zotero.debug('Annots');
		// TODO: Remove when fixed
		item._loaded.childItems = true;
		let ids = item.getAnnotations();
		let annotations = ids.map(id => this.getAnnotation(id)).filter(x => x);
		this.annotationIds = ids;
		Zotero.debug(annotations);
		let state = PDFStates[this.itemID];

		let data = {
			action: 'open',
			libraryID,
			key,
			itemId: item.itemID,
			annotations,
			state
		};

		this._iframeWindow.postMessage(data, '*');

		return true;
	}

	updateTitle() {
		let item = Zotero.Items.get(this.itemID);
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

	/**
	 * Return item JSON in pdf-reader ready format
	 * @param itemID
	 * @returns {Object|null}
	 */
	getAnnotation(itemID) {

		try {
			let item = Zotero.Items.get(itemID);
			if (!item || !item.isAnnotation()) {
				return null;
			}


			item = Zotero.Annotations.toJSON(item);

			item.id = item.key;
			item.image = item.imageURL;
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

	setAnnotations(ids) {
		Zotero.debug('set annots')
		Zotero.debug(ids);
		let annotations = [];
		for (let id of ids) {
			let annotation = this.getAnnotation(id);
			if (annotation) {
				annotations.push(annotation);
			}
		}

		if (annotations.length) {
			let data = { action: 'setAnnotations', annotations };
			this._iframeWindow.postMessage(data, '*');
		}
	}

	unsetAnnotations(keys) {
		Zotero.debug('unset annots')
		Zotero.debug(keys)
		let data = { action: 'unsetAnnotations', ids: keys };
		this._iframeWindow.postMessage(data, '*');
	}

	async navigate(annotation) {
		if (!annotation) return;
		await this.waitForViewer();
		// TODO: Wait until the document is loaded
		let data = {
			action: 'navigate',
			annotationId: annotation.id,
			position: annotation.position,
			to: annotation
		};
		this._iframeWindow.postMessage(data, '*');
	};

	close() {
		this._window.close();
	}
}

class Viewer {
	constructor() {
		this._viewerWindows = [];

		this.instanceID = Zotero.Utilities.randomString();
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'viewer');
	}

	notify(event, type, ids, extraData) {
		// Listen for the parent item, PDF attachment and its annotation items updates
		// TODO: Skip events that emerge in the current pdf-reader window
		Zotero.debug('notification received')
		Zotero.debug(event)
		Zotero.debug(type)
		Zotero.debug(ids)
		Zotero.debug(extraData)
		for (let viewerWindow of this._viewerWindows) {
			if (event === 'delete') {
				let disappearedIds = viewerWindow.annotationIds.filter(x => ids.includes(x));
				if (disappearedIds.length) {
					let keys = disappearedIds.map(id => extraData[id].itemKey);
					viewerWindow.unsetAnnotations(keys);
				}

				if (ids.includes(viewerWindow.itemID)) {
					viewerWindow.close();
				}
			}
			else {
				// Check if any annotation is involved
				let item = Zotero.Items.get(viewerWindow.itemID);
				// TODO: Remove when fixed
				item._loaded.childItems = true;
				let annotationIds = item.getAnnotations();
				viewerWindow.annotationIds = annotationIds;
				let affectedAnnotationIds = annotationIds.filter(x => ids.includes(x));
				if (affectedAnnotationIds.length) {
					viewerWindow.setAnnotations(ids);
				}

				// Update title if the PDF attachment or the parent item changes
				if (ids.includes(viewerWindow.itemID) || ids.includes(item.parentItemID)) {
					viewerWindow.updateTitle();
				}
			}
		}
	}

	_getViewerWindow(itemID) {
		return this._viewerWindows.find(v => v.itemID === itemID);
	}

	async openURI(itemURI, annotation) {
		let item = await Zotero.URI.getURIItem(itemURI);
		if (!item) return;

		this.open(item.id, annotation);
	}

	async open(itemID, annotation) {
		let viewer = this._getViewerWindow(itemID);

		if (viewer) {
			if (annotation) {
				viewer.navigate(annotation);
			}
		}
		else {
			viewer = new ViewerWindow();
			viewer.init();
			if (!(await viewer.open(itemID))) return;
			this._viewerWindows.push(viewer);
			viewer._window.addEventListener('close', () => {
				this._viewerWindows.splice(this._viewerWindows.indexOf(viewer), 1);
			});
			viewer.navigate(annotation);
		}
		viewer._window.focus();
	}
}

Zotero.Viewer = new Viewer();
