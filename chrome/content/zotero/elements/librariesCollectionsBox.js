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

import { getCSSIcon } from 'components/icons';

{
	class LibrariesCollectionsBox extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-libraries-collections" data-pane="libraries-collections" extra-buttons="add">
				<html:div class="body"/>
			</collapsible-section>
			
			<popupset>
				<menupopup class="add-popup" onpopupshowing="ZoteroPane_Local.buildAddToCollectionMenu(event)">
					<menuitem label="&zotero.toolbar.newCollection.label;" oncommand="ZoteroPane_Local.addSelectedItemsToCollection(null, true)"/>
					<menuseparator/>
				</menupopup>
			</popupset>
		`, ['chrome://zotero/locale/zotero.dtd']);

		_item = null;
		
		_linkedItems = [];

		_mode = null;

		get item() {
			return this._item;
		}

		set item(item) {
			if (item?.isRegularItem()) {
				this.hidden = false;
			}
			else {
				this.hidden = true;
				return;
			}
			this._item = item;
			// Getting linked items is an async process, so start by rendering without them
			this._linkedItems = [];
			this.render();
			
			this._updateLinkedItems();
		}

		get mode() {
			return this._mode;
		}

		set mode(mode) {
			this._mode = mode;
			this.setAttribute('mode', mode);
			this.render();
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'librariesCollectionsBox');
			this._body = this.querySelector('.body');
			this._section = this.querySelector('collapsible-section');
			this._section.addEventListener('add', (event) => {
				this.querySelector('.add-popup').openPopupAtScreen(
					event.detail.button.screenX,
					event.detail.button.screenY,
					true
				);
				this._section.open = true;
			});
			this.render();
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (action == 'modify'
					&& this._item
					&& (ids.includes(this._item.id) || this._linkedItems.some(item => ids.includes(item.id)))) {
				this.render();
			}
		}
		
		_buildRow(obj, level, contextItem) {
			let isContext = obj instanceof Zotero.Collection && !contextItem.inCollection(obj.id);

			let row = document.createElement('div');
			row.classList.add('row');
			row.dataset.id = obj.treeViewID;
			row.dataset.level = level;
			row.style.setProperty('--level', level);
			row.classList.toggle('context', isContext);
			
			let box = document.createElement('div');
			box.className = 'box keyboard_clickable';
			box.setAttribute("tabindex", "0");
			
			let iconName;
			if (obj instanceof Zotero.Group) {
				iconName = 'library-group';
			}
			else if (obj instanceof Zotero.Library) {
				iconName = 'library';
			}
			else {
				iconName = 'collection';
			}
			let icon = getCSSIcon(iconName);
			box.append(icon);
			
			let text = document.createElement('span');
			text.classList.add('label');
			text.textContent = obj.name;
			box.append(text);
			
			row.append(box);
			
			if (this._mode == 'edit' && obj instanceof Zotero.Collection && !isContext) {
				let remove = document.createXULElement('toolbarbutton');
				remove.className = 'zotero-clicky zotero-clicky-minus';
				remove.setAttribute("tabindex", "0");
				remove.addEventListener('command', () => {
					if (Services.prompt.confirm(
						window,
						Zotero.getString('pane.items.remove.title'),
						Zotero.getString('pane.items.removeFromOther', [obj.name])
					)) {
						contextItem.removeFromCollection(obj.id);
						contextItem.saveTx();
					}
				});
				row.append(remove);
			}
			
			let isCurrent = ZoteroPane.collectionsView.selectedTreeRow?.id == obj.treeViewID;
			box.classList.toggle('current', isCurrent);

			// Disable clicky if this is a context row or we're already in the library/collection it points to
			let disableClicky = isContext || isCurrent;
			box.toggleAttribute('disabled', disableClicky);
			if (!disableClicky) {
				box.addEventListener('click', async () => {
					await ZoteroPane.collectionsView.selectByID(obj.treeViewID);
					await ZoteroPane.selectItem(contextItem.id);
				});
			}

			return row;
		}
		
		_findRow(obj) {
			return this._body.querySelector(`.row[data-id="${obj.treeViewID}"]`);
		}
		
		_getChildren(row = null, deep = false) {
			let rows = Array.from(this._body.querySelectorAll('.row'));
			let startIndex = row ? rows.indexOf(row) + 1 : 0;
			let level = row ? parseInt(row.dataset.level) + 1 : 0;
			let children = [];
			for (let i = startIndex; i < rows.length; i++) {
				let childLevel = parseInt(rows[i].dataset.level);
				if (childLevel == level || deep && childLevel > level) {
					children.push(rows[i]);
				}
				else if (childLevel < level) {
					break;
				}
			}
			return children;
		}
		
		_addObject(obj, contextItem) {
			let existingRow = this._findRow(obj);
			if (existingRow) {
				return existingRow;
			}
			
			let parent = obj instanceof Zotero.Library
				? null
				: (obj.parentID ? Zotero.Collections.get(obj.parentID) : Zotero.Libraries.get(obj.libraryID));
			let parentRow = parent && this._findRow(parent);
			if (parent && !parentRow) {
				parentRow = this._addObject(parent, contextItem);
			}
			
			let row = this._buildRow(obj, parentRow ? parseInt(parentRow.dataset.level) + 1 : 0, contextItem);
			let siblings = this._getChildren(parentRow);
			let added = false;
			for (let sibling of siblings) {
				if (Zotero.localeCompare(sibling.querySelector('.label').textContent, obj.name) > 0) {
					sibling.before(row);
					added = true;
					break;
				}
			}
			if (!added) {
				if (siblings.length) {
					let lastSibling = siblings[siblings.length - 1];
					let childrenOfLastSibling = this._getChildren(lastSibling, true);
					if (childrenOfLastSibling.length) {
						childrenOfLastSibling[childrenOfLastSibling.length - 1].after(row);
					}
					else {
						lastSibling.after(row);
					}
				}
				else if (parentRow) {
					parentRow.after(row);
				}
				else {
					this._body.append(row);
				}
			}
			return row;
		}
		
		async _updateLinkedItems() {
			this._linkedItems = (await Promise.all(Zotero.Libraries.getAll()
					.filter(lib => lib.libraryID !== this._item.libraryID)
					.map(lib => this._item.getLinkedItem(lib.libraryID, true))))
				.filter(Boolean);
			this.render();
		}
		
		render() {
			if (!this._item) {
				return;
			}

			this._body.replaceChildren();
			for (let item of [this._item, ...this._linkedItems]) {
				this._addObject(Zotero.Libraries.get(item.libraryID), item);
				for (let collection of Zotero.Collections.get(item.getCollections())) {
					this._addObject(collection, item);
				}
			}
		}
	}
	customElements.define("libraries-collections-box", LibrariesCollectionsBox);
}
