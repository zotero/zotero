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
	class RelatedBox extends XULElement {
		constructor() {
			super();

			this._mode = 'view';
			this._item = null;
			this._destroyed = false;

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div style="flex-grow: 1" xmlns="http://www.w3.org/1999/xhtml">
						<div class="header">
							<label id="related-num"/>
							<button id="related-add">&zotero.item.add;</button>
						</div>
						<div id="related-grid" class="grid"/>
					</div>
				</box>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", this.destroy);

			let content = document.importNode(this.content, true);
			this.append(content);

			this._id('related-add').addEventListener('click', this.add);

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'relatedbox');
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
			this.refresh();
		}

		notify(event, type, ids, extraData) {
			if (!this._item || !this._item.id) return;

			// Refresh if this item has been modified
			if (event == 'modify' && ids.includes(this._item.id)) {
				this.refresh();
				return;
			}

			// Or if any listed items have been modified or deleted
			if (event == 'modify' || event == 'delete') {
				let libraryID = this._item.libraryID;
				let relatedItemIDs = new Set(this._item.relatedItems.map(key => Zotero.Items.getIDFromLibraryAndKey(libraryID, key)));
				for (let id of ids) {
					if (relatedItemIDs.has(id)) {
						this.refresh();
						return;
					}
				}
			}
		}

		refresh() {
			this._id('related-add').hidden = this._mode != 'edit';

			let grid = this._id('related-grid');
			grid.replaceChildren();

			if (this._item) {
				let relatedKeys = this._item.relatedItems;
				for (let i = 0; i < relatedKeys.length; i++) {
					let key = relatedKeys[i];
					let relatedItem = Zotero.Items.getByLibraryAndKey(
						this._item.libraryID, key
					);
					if (!relatedItem) {
						Zotero.debug(`Related item ${this._item.libraryID}/${key} not found `
							+ `for item ${this._item.libraryKey}`, 2);
						continue;
					}
					let id = relatedItem.id;
					let icon = document.createElement("img");
					icon.src = relatedItem.getImageSrc();

					let label = document.createElement("label");
					label.append(relatedItem.getDisplayTitle());

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
				this._updateCount();
			}
		}

		add = async () => {
			let io = { dataIn: null, dataOut: null, deferred: Zotero.Promise.defer(), itemTreeID: 'related-box-select-item-dialog' };
			window.openDialog('chrome://zotero/content/selectItemsDialog.xhtml', '',
				'chrome,dialog=no,centerscreen,resizable=yes', io);

			await io.deferred.promise;
			if (!io.dataOut || !io.dataOut.length) {
				return;
			}

			let relItems = await Zotero.Items.getAsync(io.dataOut);
			if (!relItems.length) {
				return;
			}
			if (relItems[0].libraryID != this._item.libraryID) {
				Zotero.alert.alert(null, "", "You cannot relate items in different libraries.");
				return;
			}
			await Zotero.DB.executeTransaction(async () => {
				for (let relItem of relItems) {
					if (this._item.addRelatedItem(relItem)) {
						await this._item.save({
							skipDateModifiedUpdate: true
						});
					}
					if (relItem.addRelatedItem(this._item)) {
						await relItem.save({
							skipDateModifiedUpdate: true
						});
					}
				}
			});
		};

		async _handleRemove(id) {
			let item = await Zotero.Items.getAsync(id);
			if (item) {
				await Zotero.DB.executeTransaction(async () => {
					if (this._item.removeRelatedItem(item)) {
						await this._item.save({
							skipDateModifiedUpdate: true
						});
					}
					if (item.removeRelatedItem(this._item)) {
						await item.save({
							skipDateModifiedUpdate: true
						});
					}
				});
			}
		}

		_handleShowItem(id) {
			let win = Zotero.getMainWindow();
			if (win) {
				win.ZoteroPane.selectItem(id);
				win.Zotero_Tabs.select('zotero-pane');
				win.focus();
			}
		}

		_updateCount() {
			let count = this._item.relatedItems.length;
			let str = 'pane.item.related.count.';
			switch (count) {
				case 0:
					str += 'zero';
					break;
				case 1:
					str += 'singular';
					break;
				default:
					str += 'plural';
					break;
			}
			this._id('related-num').replaceChildren(Zotero.getString(str, [count]));
		}

		_id(id) {
			return this.querySelector(`[id=${id}]`);
		}

		receiveKeyboardFocus(direction) {
			this._id("addButton").focus();
			// TODO: the relatedbox is not currently keyboard accessible
			// so we are ignoring the direction
		}
	}
	customElements.define("related-box", RelatedBox);
}
