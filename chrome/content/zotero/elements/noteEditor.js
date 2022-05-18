/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

"use strict";

{
	class NoteEditor extends XULElement {
		constructor() {
			super();

			this.editable = false;
			this.displayTags = false;
			this.displayRelated = false;
			this.displayButton = false;
			this.hideLinksContainer = false;

			this.buttonCaption = null;
			this.parentClickHandler = null;
			this.keyDownHandler = null;
			this.commandHandler = null;
			this.clickHandler = null;
			this.navigateHandler = null;
			this.returnHandler = null;

			this._mode = 'view';
			this._destroyed = false;
			this._noteEditorID = Zotero.Utilities.randomString();
			this._iframe = null;
			this._initialized = true;
			this._editorInstance = null;
			this._item = null;
			this._parentItem = null;
			
			this.clickable = false;
			this.editable = false;
			this.saveOnEdit = false;
			this.showTypeMenu = false;
			this.hideEmptyFields = false;
			this.clickByRow = false;
			this.clickByItem = false;
			
			this.clickHandler = null;
			this.blurHandler = null;
			this.eventHandlers = [];
			
			this._mode = 'view';

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" tooltip="html-tooltip" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div id="note-editor" style="display: flex;flex-direction: column;flex-grow: 1;" xmlns="http://www.w3.org/1999/xhtml">
						<iframe  id="editor-view" style="border: 0;width: 100%;flex-grow: 1;" src="resource://zotero/note-editor/editor.html" type="content"/>
						<div id="links-container">
							<div id="links-box"/>
						</div>
					</div>
				</box>
				<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<tooltip id="html-tooltip" page="true"/>
					<menupopup id="editor-menu"/>					
				</popupset>
			`, ['chrome://zotero/locale/zotero.dtd']);

			this._destroyed = false;
			this._noteEditorID = Zotero.Utilities.randomString();
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'file'], 'noteeditor');
		}
		
		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", this.destroy);

			var shadow = this.attachShadow({ mode: "open" });
			
			// var s1 = document.createElement("link");
			// s1.rel = "stylesheet";
			// s1.href = "chrome://zotero-platform/content/noteEditor.css";
			// shadow.append(s1);

			let content = document.importNode(this.content, true);
			this._iframe = content.querySelector('#editor-view');
			this._iframe.addEventListener('DOMContentLoaded', (event) => {
				// For iframes without chrome priviledges, for unknown reasons,
				// dataTransfer.getData() returns empty value for `drop` event
				// when dragging something from the outside of Zotero.
				// Update: Since fx102 non-standard data types don't work when dragging into an§ iframe,
				// while the original problem probably no longer exists
				this._iframe.contentWindow.addEventListener('drop', (event) => {
					this._iframe.contentWindow.wrappedJSObject.droppedData = Components.utils.cloneInto({
						'text/plain': event.dataTransfer.getData('text/plain'),
						'text/html': event.dataTransfer.getData('text/html'),
						'zotero/annotation': event.dataTransfer.getData('zotero/annotation'),
						'zotero/item': event.dataTransfer.getData('zotero/item')
					}, this._iframe.contentWindow);
				}, true);
				this._initialized = true;
			});
			shadow.appendChild(content);

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'itembox');
		}
		
		destroy() {
			if (this._destroyed) {
				return;
			}
			window.removeEventListener("unload", this.destroy);
			this._destroyed = true;
			
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
		
		disconnectedCallback() {
			// Empty the DOM. We will rebuild if reconnected.
			while (this.lastChild) {
				this.removeChild(this.lastChild);
			}
			this.destroy();
		}

		async save() {

		}

		saveSync = () => {
			if (this._editorInstance) {
				this._editorInstance.saveSync();
			}
		}

		getCurrentInstance = () => {
			return this._editorInstance;
		}

		initEditor = async (state, reloaded) => {
			if (this._editorInstance) {
				this._editorInstance.uninit();
			}

			// Automatically upgrade editable v1 note before it's loaded
			// TODO: Remove this at some point
			if (this.editable) {
				await Zotero.Notes.upgradeSchemaV1(this._item);
			}

			this._editorInstance = new Zotero.EditorInstance();
			await this._editorInstance.init({
				state,
				item: this._item,
				reloaded,
				iframeWindow: this._id('editor-view').contentWindow,
				popup: this._id('editor-menu'),
				onNavigate: this._navigateHandler,
				viewMode: this.viewMode,
				readOnly: !this.editable,
				disableUI: this._mode === 'merge',
				onReturn: this._returnHandler,
				placeholder: this.placeholder
			});
			if (this._onInitCallback) {
				this._onInitCallback();
			}
		}

		onInit = (callback) => {
			if (this._editorInstance) {
				return callback();
			}
			this._onInitCallback = callback;
		}

		notify = async (event, type, ids, extraData) => {
			if (this._editorInstance) {
				await this._editorInstance.notify(event, type, ids, extraData);
			}

			if (!this.item) {
				return;
			}
			// Try to use the state from the item save event
			let id = this.item.id;
			if (ids.includes(id)) {
				if (event === 'delete') {
					if (this._returnHandler) {
						this._returnHandler();
					}
				}
				else {
					let state = extraData && extraData[id] && extraData[id].state;
					if (state) {
						if (extraData[id].noteEditorID !== this._editorInstance.instanceID) {
							this.initEditor(state, true);
						}
					}
					else {
						let curValue = this.item.note;
						if (curValue !== this._lastHtmlValue) {
							this.initEditor(null, true);
						}
					}
					this._lastHtmlValue = this.item.note;
				}
			}

			// this._id('links-container').hidden = !(this.displayTags && this.displayRelated) || this._hideLinksContainer;
			// this._id('links-box').refresh();
		}

		set navigateHandler(val) {
			if (this._editorInstance) {
				this._editorInstance.onNavigate = val;
			}
			this._navigateHandler = val;
		}

		set returnHandler(val) {
			this._returnHandler = val;
		}

		//
		// Public properties
		//
		
		// Modes are predefined settings groups for particular tasks
		get mode() {
			return this._mode;
		}
		
		set mode(val) {
			// Duplicate default property settings here
			this.editable = false;
			this.displayTags = false;
			this.displayRelated = false;
			this.displayButton = false;

			switch (val) {
				case 'view':
				case 'merge':
					this.editable = false;
					break;

				case 'edit':
					this.editable = true;
					this.parentClickHandler = this.selectParent;
					this.keyDownHandler = this.handleKeyDown;
					this.commandHandler = this.save;
					this.displayTags = true;
					this.displayRelated = true;
					break;

				default:
					throw ("Invalid mode '" + val + "' in noteEditor.js");
			}

			this._mode = val;
			// document.getAnonymousNodes(this)[0].setAttribute('mode', val);
			// this._id('links-box').mode = val;
			// this._id('links-container').hidden = !(this.displayTags && this.displayRelated) || this._hideLinksContainer;
			// this._id('links-box').refresh();
		}
		
		get item() {
			return this._item;
		}
		
		set item(val) {
			// The binding can be immediately destroyed
			// (which i.e. happens in merge dialog)
			if (this._destroyed) {
				return;
			}

			if (this._item && this._item.id && this._item.id === val.id) {
				return;
			}

			if (this._editorInstance) {
				this._editorInstance.uninit();
				this._editorInstance = null;
			}

			this._lastHtmlValue = val.note;
			this._item = val;

			// var parentKey = this._item.parentKey;
			// if (parentKey) {
			// 	this.parentItem = Zotero.Items.getByLibraryAndKey(this._item.libraryID, parentKey);
			// }

			// this._id('links-box').item = this._item;

			(async () => {
				// `item` field can be set before the constructor is called
				// or noteeditor is attached to dom (which happens in the
				// merge dialog i.e.), therefore we wait for the initialization
				let n = 0;
				while (!this._initialized && !this._destroyed) {
					if (n >= 1000) {
						throw new Error('Waiting for noteeditor initialization failed');
					}
					await Zotero.Promise.delay(10);
					n++;
				}

				if (this._destroyed) {
					return;
				}

				this.initEditor();
				// this._id('links-box').item = this._item;
			})();
		}

		get parentItem() {
			return this._parentItem;
		}

		set parentItem(val) {
			this._parentItem = val;
			// this._id('links-box').parentItem = val;
		}

		async focus() {
			let n = 0;
			while (!this._editorInstance && n++ < 100) {
				await Zotero.Promise.delay(10);
			}
			await this._editorInstance._initPromise;
			this._iframe.focus();
			this._editorInstance.focus();
		}

		async focusFirst() {
			let n = 0;
			while (!this._editorInstance && n++ < 100) {
				await Zotero.Promise.delay(10);
			}
			await this._editorInstance._initPromise;
			this._iframe.focus();
			try {
				this._editorInstance._iframeWindow.document.querySelector('.toolbar-button-return').focus();
			}
			catch(e) {
			}
		}

		_id(id) {
			return this.shadowRoot.querySelector(`[id=${id}]`);
		}
	}
	customElements.define("note-editor", NoteEditor);
}
