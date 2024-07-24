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

import { getCSSItemTypeIcon } from 'components/icons';

{
	class RelatedBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-related" data-pane="related" extra-buttons="add">
				<html:div class="body"/>
			</collapsible-section>
		`);
		
		init() {
			this._item = null;
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'relatedbox');
			this.initCollapsibleSection();
			this._section.addEventListener('add', this.add);
		}
		
		destroy() {
			this._section?.removeEventListener('add', this.add);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
		
		get item() {
			return this._item;
		}

		set item(val) {
			this.hidden = val?.isFeedItem;
			this._item = val;
		}

		notify(event, type, ids, _extraData) {
			if (!this._item || !this._item.id) return;

			// Refresh if this item has been modified
			if (event == 'modify' && ids.includes(this._item.id)) {
				this._forceRenderAll();
				return;
			}

			// Or if any listed items have been modified or deleted
			if (event == 'modify' || event == 'delete') {
				let libraryID = this._item.libraryID;
				let relatedItemIDs = new Set(this._item.relatedItems.map(key => Zotero.Items.getIDFromLibraryAndKey(libraryID, key)));
				for (let id of ids) {
					if (relatedItemIDs.has(id)) {
						this._forceRenderAll();
						return;
					}
				}
			}
		}

		render() {
			if (!this.item) return;
			if (this._isAlreadyRendered()) return;

			let body = this.querySelector('.body');
			body.replaceChildren();

			if (this._item) {
				let relatedKeys = this._item.relatedItems;
				
				let relatedItems = relatedKeys.map((key) => {
					let item = Zotero.Items.getByLibraryAndKey(this._item.libraryID, key);
					if (!item) {
						Zotero.debug(`Related item ${this._item.libraryID}/${key} not found `
							+ `for item ${this._item.libraryKey}`, 2);
					}
					return item;
				}).filter(Boolean);
				
				// Sort by display title
				var collation = Zotero.getLocaleCollation();
				var titles = new Map();
				function getTitle(item) {
					var title = titles.get(item.id);
					if (title === undefined) {
						title = Zotero.Items.getSortTitle(item.getDisplayTitle());
						titles.set(item.id, title);
					}
					return title;
				}
				relatedItems.sort((a, b) => {
					var titleA = getTitle(a);
					var titleB = getTitle(b);
					return collation.compareString(1, titleA, titleB);
				});
				
				for (let relatedItem of relatedItems) {
					let id = relatedItem.id;

					let row = document.createElement('div');
					row.className = 'row';

					let icon = getCSSItemTypeIcon(relatedItem.getItemTypeIconName());

					let label = document.createElement("span");
					label.className = 'label';
					label.append(relatedItem.getDisplayTitle());

					let box = document.createElement('div');
					box.addEventListener('click', () => this._handleShowItem(id));
					box.setAttribute("tabindex", "0");
					box.setAttribute("role", "button");
					box.setAttribute("aria-label", label.textContent);
					box.className = 'box keyboard-clickable';
					box.appendChild(icon);
					box.appendChild(label);
					row.append(box);

					if (this.editable) {
						let remove = document.createXULElement("toolbarbutton");
						remove.addEventListener('command', () => this._handleRemove(id));
						remove.className = 'zotero-clicky zotero-clicky-minus';
						remove.setAttribute("data-l10n-id", 'section-button-remove');
						remove.setAttribute("tabindex", "0");
						row.append(remove);
					}

					body.append(row);
				}
				this._updateCount();
			}
		}

		add = async () => {
			this._section.empty = false;
			this._section.open = true;

			let io = {
				dataIn: null,
				dataOut: null,
				deferred: Zotero.Promise.defer(),
				itemTreeID: 'related-box-select-item-dialog',
				filterLibraryIDs: [this._item.libraryID]
			};
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
				Zotero.alert(null, "", "You cannot relate items in different libraries.");
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
			this._section.setCount(count);
		}

		_id(id) {
			return this.querySelector(`[id=${id}]`);
		}

		receiveKeyboardFocus(_direction) {
			this._id("addButton").focus();
			// TODO: the relatedbox is not currently keyboard accessible
			// so we are ignoring the direction
		}
	}
	customElements.define("related-box", RelatedBox);
}
