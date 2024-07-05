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
	class LibrariesCollectionsBox extends ItemPaneSectionElementBase {
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

		_linkedItems = [];

		get item() {
			return this._item;
		}

		set item(item) {
			if (item?.isRegularItem() && !item?.isFeedItem) {
				this.hidden = false;
			}
			else {
				this.hidden = true;
				return;
			}
			this._item = item;
			this._linkedItems = [];
		}

		get _renderDependencies() {
			return [...super._renderDependencies, this.collectionTreeRow?.id];
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'collection'], 'librariesCollectionsBox');
			this._body = this.querySelector('.body');
			this.initCollapsibleSection();
			this._section.addEventListener('add', this._handleAdd);
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
			this._section?.removeEventListener('add', this._handleAdd);
		}

		notify(action, type, ids) {
			if (!this._item) return;
			if (action == 'modify'
					&& type == "item"
					&& (ids.includes(this._item.id) || this._linkedItems.some(item => ids.includes(item.id)))) {
				this._forceRenderAll();
			}
			
			if (["modify", "trash"].includes(action) && type == "collection") {
				let isRelevantCollection = ids.some(id => Zotero.Collections.get(id).hasItem(this._item));
				if (isRelevantCollection) {
					this._forceRenderAll();
				}
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
			box.className = 'box keyboard-clickable';
			box.setAttribute("tabindex", "0");
			box.setAttribute('aria-label', obj.name);
			box.setAttribute('role', "button");
			
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
			
			if (this.editable && obj instanceof Zotero.Collection && !isContext) {
				let remove = document.createXULElement('toolbarbutton');
				remove.className = 'zotero-clicky zotero-clicky-minus';
				remove.setAttribute("tabindex", "0");
				remove.setAttribute("data-l10n-id", 'section-button-remove');
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
			
			let isCurrent = this.tabType === 'library'
				&& this.collectionTreeRow?.id == obj.treeViewID;
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
		
		render() {
			if (!this._item) return;
			if (!this._section.open) return;
			if (this._isAlreadyRendered()) return;

			this._body.replaceChildren();
			
			for (let item of [this._item]) {
				this._addObject(Zotero.Libraries.get(item.libraryID), item);
				for (let collection of Zotero.Collections.get(item.getCollections())) {
					this._addObject(collection, item);
				}
			}
		}

		async asyncRender() {
			if (!this._item) {
				return;
			}
			if (this._isAlreadyRendered("async")) return;
			// Skip if already rendered
			if (this._linkedItems.length > 0) {
				return;
			}

			this._linkedItems = (await Promise.all(Zotero.Libraries.getAll()
					.filter(lib => lib.libraryID !== this._item.libraryID)
					.map(lib => this._item.getLinkedItem(lib.libraryID, true))))
				.filter(Boolean);
			for (let item of this._linkedItems) {
				this._addObject(Zotero.Libraries.get(item.libraryID), item);
				for (let collection of Zotero.Collections.get(item.getCollections())) {
					this._addObject(collection, item);
				}
			}
		}

		_handleAdd = (event) => {
			this.querySelector('.add-popup').openPopupAtScreen(
				event.detail.button.screenX,
				event.detail.button.screenY,
				true
			);
			this._section.open = true;
		};
	}
	customElements.define("libraries-collections-box", LibrariesCollectionsBox);
}
