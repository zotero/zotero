/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
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

			this._notitle = false;
			this._mode = 'view';
			this._item = null;
			this._parentItem = null;
			this._iframe = null;
			this._initialized = false;
			this._editorInstance = null;
			this._destroyed = false;

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" tooltip="html-tooltip" style="display: flex; flex-grow: 1" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div id="note-editor" style="display: flex;flex-direction: column;flex-grow: 1;" xmlns="http://www.w3.org/1999/xhtml">
						<iframe id="editor-view" style="border: 0;width: 100%;flex-grow: 1;" src="resource://zotero/note-editor/editor.html" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" type="content"/>
						<div id="links-container">
							<links-box id="links-box" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"/>
						</div>
					</div>
				</box>
				<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<tooltip id="html-tooltip" page="true"/>
					<menupopup id="editor-menu"/>					
				</popupset>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", () => this.destroy(), { once: true });

			MozXULElement.insertFTLIfNeeded('toolkit/global/textActions.ftl');
			document.l10n.connectRoot(this);
			
			// var s1 = document.createElement("link");
			// s1.rel = "stylesheet";
			// s1.href = "chrome://zotero-platform/content/zotero.css";
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
			this.append(content);

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'noteEditor');
			this.notitle = !!this.getAttribute('notitle');
		}
		
		destroy() {
			if (this._destroyed) {
				return;
			}
			this._destroyed = true;
			
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
		
		disconnectedCallback() {
			this.replaceChildren();
			this.destroy();
		}

		async save() {

		}

		saveSync = () => {
			if (this._editorInstance) {
				this._editorInstance.saveSync();
			}
		};

		getCurrentInstance = () => {
			return this._editorInstance;
		};

		initEditor = async (state, reloaded) => {
			if (this._editorInstance) {
				this._editorInstance.uninit();
			}

			// Automatically upgrade editable v1 note before it's loaded
			// TODO: Remove this at some point
			if (this._mode == 'edit') {
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
				readOnly: this._mode != 'edit',
				disableUI: this._mode == 'merge',
				onReturn: this._returnHandler,
				placeholder: this.placeholder
			});
			if (this._onInitCallback) {
				this._onInitCallback();
			}
		};

		onInit = (callback) => {
			if (this._editorInstance) {
				return callback();
			}
			this._onInitCallback = callback;
		};

		notify = async (event, type, ids, extraData) => {
			if (this._editorInstance) {
				await this._editorInstance.notify(event, type, ids, extraData);
			}

			if (!this._item) {
				return;
			}
			// Try to use the state from the item save event
			let id = this._item.id;
			if (ids.includes(id)) {
				if (event == 'delete') {
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
						let curValue = this._item.note;
						if (curValue !== this._lastHtmlValue) {
							this.initEditor(null, true);
						}
					}
					this._lastHtmlValue = this._item.note;
				}
			}

			if (ids.includes(id) || this._parentItem && ids.includes(this._parentItem.id)) {
				this._id('links-box').refresh();
			}
		};

		set notitle(val) {
			this._notitle = !!val;
			this._id('links-box').notitle = val;
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

		get mode() {
			return this._mode;
		}
		
		set mode(val) {
			var displayLinks = true;
			switch (val) {
				case 'merge':
					displayLinks = false;
				case 'view':
					break;

				case 'edit':
					break;

				default:
					throw new Error(`Invalid mode '${val}'`);
			}

			this._mode = val;
			this._id('links-container').hidden = !displayLinks;
			this._id('links-box').mode = val;
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

			if (this._item && this._item.id && this._item.id == val.id) {
				return;
			}

			if (this._editorInstance) {
				this._editorInstance.uninit();
				this._editorInstance = null;
			}

			this._lastHtmlValue = val.note;
			this._item = val;

			var parentKey = this._item.parentKey;
			if (parentKey) {
				this.parentItem = Zotero.Items.getByLibraryAndKey(this._item.libraryID, parentKey);
			}

			this._id('links-box').item = this._item;

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
				this._id('links-box').item = this._item;
			})();
		}

		get parentItem() {
			return this._parentItem;
		}

		set parentItem(val) {
			this._parentItem = val;
			this._id('links-box').parentItem = val;
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
			try {
				let n = 0;
				while (!this._editorInstance && n++ < 100) {
					await Zotero.Promise.delay(10);
				}
				await this._editorInstance._initPromise;
				this._iframe.focus();
				this._editorInstance._iframeWindow.document.querySelector('.toolbar-button-return').focus();
			}
			catch(e) {
			}
		}

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("note-editor", NoteEditor);
}


{
	class LinksBox extends XULElement {
		constructor() {
			super();

			this._mode = 'view';
			this._item = null;
			this._parentItem = null;
			this._destroyed = false;

			this.content = MozXULElement.parseXULToFragment(`
				<div id="links-box" xmlns="http://www.w3.org/1999/xhtml">
					<div class="grid">
						<div id="parent-label" class="label" hidden="true"/>
						<div id="parent-value" class="value zotero-clicky" hidden="true"/>
						
						<div id="related-label" class="label"/>
						<div id="related-value" class="value zotero-clicky"/>
						
						<div id="tags-label" class="label"/>
						<div id="tags-value" class="value zotero-clicky"/>
					</div>
				</div>
				<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
						<menupopup id="related-popup" width="300">
							<related-box id="related"/>
						</menupopup>
						<menupopup id="tags-popup" width="300" ignorekeys="true">
							<tags-box id="tags"/>
						</menupopup>
					</popupset>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}

		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", () => this.destroy(), { once: true });

			this.append(document.importNode(this.content, true));

			this._id('parent-value').addEventListener('click', this._parentClickHandler);
			this._id('related-value').addEventListener('click', this._relatedClickHandler);
			this._id('tags-value').addEventListener('click', this._tagsClickHandler);
		}

		destroy() {
			if (this._destroyed) {
				return;
			}
			this._destroyed = true;
		}

		disconnectedCallback() {
			this.replaceChildren();
			this.destroy();
		}

		set item(val) {
			this._item = val;
			this._id('related').item = this._item;
			this._id('tags').item = this._item;

			this.refresh();

			// Hide popup to prevent it being visible out of the context or
			// in some cases even invisible but still blocking the next click
			this._id('related-popup').addEventListener('click', (event) => {
				let target = event.originalTarget;
				if (target.classList.contains('zotero-box-label')) {
					this._id('related-popup').hidePopup();
				}
			});
		}

		set mode(val) {
			this._mode = val;
			this._id('related').mode = val;
			this._id('tags').mode = val;
			this.refresh();
		}

		set notitle(val) {
			this._notitle = val;
			this.refresh();
		}

		set parentItem(val) {
			this._parentItem = val;
			this.refresh();
		}

		refresh() {
			this._updateParentRow();
			this._updateTagsSummary();
			this._updateRelatedSummary();
		}

		_updateParentRow() {
			let hidden = !this._parentItem || !!this._notitle;
			this._id('parent-value').hidden = hidden;
			this._id('parent-label').hidden = hidden;
			if (!hidden) {
				this._id('parent-label').replaceChildren(Zotero.getString('pane.item.parentItem'));
				this._id('parent-value').replaceChildren(document.createTextNode(this._parentItem.getDisplayTitle(true)));
			}
		}

		_updateRelatedSummary() {
			var r = '';
			if (this._item) {
				var keys = this._item.relatedItems;
				if (keys.length) {
					for (let key of keys) {
						let item = Zotero.Items.getByLibraryAndKey(this._item.libraryID, key);
						if (!item) {
							Zotero.debug(`Related item ${this._item.libraryID}/${key} not found `
								+ `for item ${this._item.libraryKey}`, 2);
							continue;
						}
						r = r + item.getDisplayTitle() + ", ";
					}
					r = r.slice(0, -2);
				}
			}

			let v = r;

			if (!v || v == '') {
				v = "[" + Zotero.getString('pane.item.noteEditor.clickHere') + "]";
			}

			this._id('related-label').innerText = Zotero.getString('itemFields.related')
				+ Zotero.getString('punctuation.colon');
			this._id('related-value').innerText = v;
		}

		_updateTagsSummary() {
			var r = '';

			if (this._item) {
				var tags = this._item.getTags();

				// Sort tags alphabetically
				var collation = Zotero.getLocaleCollation();
				tags.sort((a, b) => collation.compareString(1, a.tag, b.tag));

				for (let i = 0; i < tags.length; i++) {
					r = r + tags[i].tag + ", ";
				}
				r = r.slice(0, -2);
			}

			let v = r;

			if (!v || v == '') {
				v = "[" + Zotero.getString('pane.item.noteEditor.clickHere') + "]";
			}

			this._id('tags-label').innerText = Zotero.getString('itemFields.tags')
				+ Zotero.getString('punctuation.colon');
			this._id('tags-value').innerText = v;
		}

		_parentClickHandler = () => {
			if (!this._item || !this._item.id) {
				return;
			}
			var parentID = this._item.parentID;
			var win = Zotero.getMainWindow();
			if (win) {
				win.ZoteroPane.selectItem(parentID);
				win.Zotero_Tabs.select('zotero-pane');
				win.focus();
			}
		};

		_relatedClickHandler = (event) => {
			var relatedList = this._item.relatedItems;
			if (relatedList.length > 0) {
				this._id('related-popup').openPopup(this, 'topleft topleft', 0, 0, false);
			}
			else if (this._mode == 'edit') {
				this._id('related').add();
			}
		};

		_tagsClickHandler = (event) => {
			this._id('tags-popup').openPopup(this, 'topleft topleft', 0, 0, true);
			// If editable and no existing tags, open new empty row
			if (this._mode == 'edit' && !this._item.getTags().length) {
				setTimeout(() => {
					this._id('tags').addNew();
				});
			}
		};

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("links-box", LinksBox);
}
