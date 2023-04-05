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
	class NotesBox extends XULElement {
		constructor() {
			super();

			this._mode = 'view';
			this._item = null;
			this._destroyed = false;
			this._noteIDs = [];

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div style="flex-grow: 1" xmlns="http://www.w3.org/1999/xhtml">
						<div class="header">
							<label id="notes-num"/>
							<button id="notes-add">&zotero.item.add;</button>
						</div>
						<div id="notes-grid" class="grid"/>
					</div>
				</box>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", this.destroy);

			let content = document.importNode(this.content, true);
			this.append(content);

			this._id('notes-add').addEventListener('click', this._handleAdd);

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'notesBox');
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
			this.replaceChildren();
			this.destroy();
		}

		get mode() {
			return this._mode;
		}

		set mode(val) {
			switch (val) {
				case 'view':
				case 'merge':
				case 'mergeedit':
				case 'edit':
					break;
					
				default:
					throw new Error(`Invalid mode '${val}'`);
			}

			this._mode = val;
		}

		get item() {
			return this._item;
		}

		set item(val) {
			this._item = val;
			this._refresh();
		}

		notify(event, type, ids, extraData) {
			if (['modify', 'delete'].includes(event) && ids.some(id => this._noteIDs.includes(id))) {
				this._refresh();
			}
		}

		_refresh() {
			if (!this._item) {
				return;
			}

			this._noteIDs = this._item.getNotes();
			this._id('notes-add').hidden = this._mode != 'edit';

			let grid = this._id('notes-grid');
			grid.replaceChildren();

			let notes = Zotero.Items.get(this._item.getNotes());
			for (let item of notes) {
				let id = item.id;
				let icon = document.createElement("img");
				icon.src = item.getImageSrc();

				let label = document.createElement("label");
				label.append(item.getDisplayTitle());

				let box = document.createElement('div');
				box.addEventListener('click', () => this._handleShowItem(id));
				box.className = 'box zotero-clicky';
				box.appendChild(icon);
				box.appendChild(label);

				grid.append(box);

				if (this._mode == 'edit') {
					let remove = document.createElement("label");
					remove.addEventListener('click', () => this._handleRemove(id));
					remove.className = 'zotero-clicky zotero-clicky-minus';
					remove.append('-');
					grid.append(remove);
				}
			}

			let num = this._noteIDs.length;
			this._id('notes-num').replaceChildren(Zotero.getString('pane.item.notes.count', num, num));
		}

		_handleAdd = (event) => {
			ZoteroPane_Local.newNote(event.shiftKey, this._item.key);
		};

		_handleRemove(id) {
			var ps = Services.prompt;
			if (ps.confirm(null, '', Zotero.getString('pane.item.notes.delete.confirm'))) {
				Zotero.Items.trashTx(id);
			}
		}

		_handleShowItem(id) {
			ZoteroPane_Local.selectItem(id);
		}

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("notes-box", NotesBox);
}
