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

class EditorInstance {
	constructor() {
		this.instanceID = Zotero.Utilities.randomString();
		Zotero.Notes.registerEditorInstance(this);
		Zotero.debug('Creating a new editor instance');
	}

	async init(options) {
		this.onNavigate = options.onNavigate;
		this._item = options.item;
		this._readOnly = options.readOnly;
		this._iframeWindow = options.iframeWindow;
		this._popup = options.popup;
		this._state = options.state;
		this._saveOnEdit = true;
		this._disableSaving = false;
		this._subscriptions = [];
		this._quickFormatWindow = null;

		await this._waitForEditor();

		// Run Cut/Copy/Paste with chrome privileges
		this._iframeWindow.wrappedJSObject.zoteroExecCommand = function (doc, command, ui, value) {
			// Is that safe enough?
			if (!['cut', 'copy', 'paste'].includes(command)) {
				return;
			}
			return doc.execCommand(command, ui, value);
		};

		this._iframeWindow.addEventListener('message', this._listener);

		this._postMessage({
			action: 'init',
			value: this._state || this._item.note,
			schemaVersion: this._item.noteSchemaVersion,
			readOnly: this._readOnly
		});
	}

	uninit() {
		this._iframeWindow.removeEventListener('message', this._listener);
		Zotero.Notes.unregisterEditorInstance(this);
	}

	focus() {
		this._postMessage({ action: 'focus' });
	}

	async updateCitationsForURIs(uris) {
		let subscriptions = this._subscriptions
		.filter(s => s.data.citation && s.data.citation.citationItems
		.some(citationItem => uris.includes(citationItem.uri)));
		for (let subscription of subscriptions) {
			await this._feedSubscription(subscription);
		}
	}

	saveSync() {
		if (!this._readOnly && !this._disableSaving && this._iframeWindow) {
			let noteData = this._iframeWindow.wrappedJSObject.getDataSync();
			noteData = JSON.parse(JSON.stringify(noteData));
			this._save(noteData);
		}
	}

	async _waitForEditor() {
		let n = 0;
		while (!this._iframeWindow) {
			if (n >= 1000) {
				throw new Error('Waiting for editor failed');
			}
			await Zotero.Promise.delay(10);
			n++;
		}
	}

	_postMessage(message) {
		this._iframeWindow.postMessage({ instanceId: this.instanceID, message }, '*');
	}

	_listener = async (e) => {
		if (e.data.instanceId !== this.instanceID) {
			return;
		}
		let message = e.data.message;
		switch (message.action) {
			case 'insertObject': {
				let { type, data, pos } = message;
				let list = [];
				if (type === 'zotero/item') {
					let ids = data.split(',').map(id => parseInt(id));
					for (let id of ids) {
						let item = await Zotero.Items.getAsync(id);
						if (!item) {
							continue;
						}
						list.push({
							citation: {
								citationItems: [{
									uri: Zotero.URI.getItemURI(item),
									backupText: this._getBackupStr(item)
								}],
								properties: {}
							}
						});
					}
				}
				else if (type === 'zotero/annotation') {
					let annotations = JSON.parse(data);
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
								backupText: this._getBackupStr(citationItem),
								locator: annotation.pageLabel
							}],
							properties: {}
						};
						list.push({ annotation, citation });
					}
				}
				if (list.length) {
					this._postMessage({ action: 'insertAnnotationsAndCitations', list, pos });
				}
				return;
			}
			case 'openAnnotation': {
				let { uri, position } = message;
				if (this.onNavigate) {
					this.onNavigate(uri, { position });
				}
				else {
					await Zotero.Viewer.openURI(uri, { position });
				}
				return;
			}
			case 'openUrl': {
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
				this._save(noteData);
				return;
			}
			case 'subscribeProvider': {
				let { id, type, data } = message;
				let subscription = { id, type, data };
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
				let { nodeId, citation } = message;
				citation = JSON.parse(JSON.stringify(citation));
				let availableCitationItems = [];
				for (let citationItem of citation.citationItems) {
					let item = await Zotero.URI.getURIItem(citationItem.uri);
					if (item) {
						availableCitationItems.push({ ...citationItem, id: item.id });
					}
				}
				citation.citationItems = availableCitationItems;
				let libraryID = this._item.libraryID;
				this._openQuickFormatDialog(nodeId, citation, [libraryID]);
				return;
			}
			case 'importImages': {
				let { images } = message;
				for (let image of images) {
					let { nodeId, src } = image;
					let attachmentKey = await this._importImage(src);
					this._postMessage({ action: 'attachImportedImage', nodeId, attachmentKey });
				}
				return;
			}
			case 'syncAttachmentKeys': {
				let { attachmentKeys } = message;
				let attachmentItems = this._item.getAttachments().map(id => Zotero.Items.get(id));
				let abandonedItems = attachmentItems.filter(item => !attachmentKeys.includes(item.key));
				for (let item of abandonedItems) {
					await item.eraseTx();
				}
				return;
			}
			case 'popup': {
				let { x, y, pos, items } = message;
				this._openPopup(x, y, pos, items);
				return;
			}
		}
	}

	async _feedSubscription(subscription) {
		let { id, type, data } = subscription;
		if (type === 'citation') {
			let formattedCitation = await this._getFormattedCitation(data.citation);
			this._postMessage({ action: 'notifyProvider', id, type, data: { formattedCitation } });
		}
		else if (type === 'image') {
			let { attachmentKey } = data;
			let item = Zotero.Items.getByLibraryAndKey(this._item.libraryID, attachmentKey);
			if (!item) return;
			let path = await item.getFilePathAsync();
			let buf = await OS.File.read(path, {});
			buf = new Uint8Array(buf).buffer;
			let src = 'data:' + item.attachmentContentType + ';base64,' + this._arrayBufferToBase64(buf);
			this._postMessage({ action: 'notifyProvider', id, type, data: { src } });
		}
	}

	async _importImage(src) {
		let blob;
		if (src.startsWith('data:')) {
			blob = this._dataURLtoBlob(src);
		}
		else {
			let res;

			try {
				res = await Zotero.HTTP.request('GET', src, { responseType: 'blob' });
			}
			catch (e) {
				return;
			}

			blob = res.response;
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

	_openPopup(x, y, pos, items) {
		this._popup.hidePopup();

		while (this._popup.firstChild) {
			this._popup.removeChild(this._popup.firstChild);
		}

		for (let item of items) {
			let menuitem = this._popup.ownerDocument.createElement('menuitem');
			menuitem.setAttribute('value', item[0]);
			menuitem.setAttribute('label', item[1]);
			menuitem.addEventListener('command', () => {
				this._postMessage({
					action: 'contextMenuAction',
					ctxAction: item[0],
					pos
				});
			});
			this._popup.appendChild(menuitem);
		}

		this._popup.openPopupAtScreen(x, y, true);
	}

	async _save(noteData) {
		if (!noteData) return;
		let { schemaVersion, state, html } = noteData;
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
					let changed = this._item.setNote(html, schemaVersion);
					if (changed && this._saveOnEdit) {
						// Make sure saving is not disabled
						if (this._disableSaving) {
							return;
						}
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
				item.setNote(html, schemaVersion);
				if (this.parentItem) {
					item.parentKey = this.parentItem.key;
				}
				if (this._saveOnEdit) {
					var id = await item.saveTx();

					if (!this.parentItem && this.collection) {
						this.collection.addItem(id);
					}
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
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

	async _getFormattedCitation(citation) {
		let formattedItems = [];
		for (let citationItem of citation.citationItems) {
			let item = await Zotero.URI.getURIItem(citationItem.uri);
			if (item && !item.deleted) {
				formattedItems.push(this._buildBubbleString(citationItem, this._getBackupStr(item)));
			}
			else {
				let formattedItem = this._buildBubbleString(citationItem, citationItem.backupText);
				formattedItem = `<span style="color: red;">${formattedItem}</span>`;
				formattedItems.push(formattedItem);
			}
		}
		return formattedItems.join(';');
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
		return this._iframeWindow.btoa(binary);
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
		return null;
	}

	_openQuickFormatDialog(nodeId, citationData, filterLibraryIDs) {
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
				Zotero.debug('CI: preview');
			},

			/**
			 * Sort the citationItems within citation (depends on this.citation.properties.unsorted)
			 * @return {Promise} A promise resolved with the previewed citation string
			 */
			sort: function () {
				Zotero.debug('CI: sort');
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
					citationItem.backupText = that._getBackupStr(itm);
				}

				if (this.citation.citationItems.length) {
					that._postMessage({ action: 'setCitation', nodeId, citation });
				}
			},

			/**
			 * Get a list of items used in the current document
			 * @return {Promise} A promise resolved by the items
			 */
			getItems: async function () {
				Zotero.debug('CI: getItems');
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

Zotero.EditorInstance = EditorInstance;
