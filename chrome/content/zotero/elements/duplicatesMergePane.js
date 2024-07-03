/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

{
	class DuplicatesMergePane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<groupbox>
				<button id="zotero-duplicates-merge-button" data-l10n-id="item-pane-duplicates-merge-items" />
			</groupbox>
			
			<groupbox id="zotero-duplicates-merge-version-select">
				<description>&zotero.duplicatesMerge.versionSelect;</description>
				<hbox>
					<richlistbox id="zotero-duplicates-merge-original-date" rows="0"/>
				</hbox>
			</groupbox>
			
			<groupbox id="zotero-duplicates-merge-field-select">
				<description>&zotero.duplicatesMerge.fieldSelect;</description>
			</groupbox>

			<vbox id="zotero-duplicates-merge-item-box-container">
				<item-box id="zotero-duplicates-merge-item-box"/>
			</vbox>
		`, ['chrome://zotero/locale/zotero.dtd']);

		init() {
			this._masterItem = null;
			this._items = [];
			this._otherItems = [];
			this._ignoreFields = ['dateAdded', 'dateModified', 'accessDate'];

			this.querySelector("#zotero-duplicates-merge-button").addEventListener(
				"command", () => this.merge());
			this.querySelector("#zotero-duplicates-merge-original-date").addEventListener(
				"select", event => this.setMaster(event.target.selectedIndex));
		}

		setItems(items, displayNumItemsOnTypeError) {
			let itemTypeID, oldestItem, otherItems = [];
			for (let item of items) {
				// Find the oldest item
				if (!oldestItem) {
					oldestItem = item;
				}
				else if (item.dateAdded < oldestItem.dateAdded) {
					otherItems.push(oldestItem);
					oldestItem = item;
				}
				else {
					otherItems.push(item);
				}
				
				if (!item.isRegularItem() || ['annotation', 'attachment', 'note'].includes(item.itemType)) {
					let msg = Zotero.getString('pane.item.duplicates.onlyTopLevel');
					ZoteroPane.itemPane.setItemPaneMessage(msg);
					return false;
				}
				
				// Make sure all items are of the same type
				if (itemTypeID) {
					if (itemTypeID != item.itemTypeID) {
						let msg;
						if (displayNumItemsOnTypeError) {
							msg = { l10nId: 'item-pane-message-items-selected', l10nArgs: { count: items.length } };
						}
						else {
							msg = Zotero.getString('pane.item.duplicates.onlySameItemType');
						}
						ZoteroPane.itemPane.setItemPaneMessage(msg);
						return false;
					}
				}
				else {
					itemTypeID = item.itemTypeID;
				}
			}
			
			this._items = items;
			
			this._items.sort(function (a, b) {
				return a.dateAdded > b.dateAdded ? 1 : a.dateAdded == b.dateAdded ? 0 : -1;
			});
			
			//
			// Update the UI
			//
			
			let button = document.getElementById('zotero-duplicates-merge-button');
			let versionSelect = document.getElementById('zotero-duplicates-merge-version-select');
			let itembox = document.getElementById('zotero-duplicates-merge-item-box');
			let fieldSelect = document.getElementById('zotero-duplicates-merge-field-select');
			
			let alternatives = oldestItem.multiDiff(otherItems, this._ignoreFields);
			if (alternatives) {
				// Populate menulist with Date Added values from all items
				let dateList = document.getElementById('zotero-duplicates-merge-original-date');
				dateList.innerHTML = '';
				
				let numRows = 0;
				for (let item of items) {
					let date = Zotero.Date.sqlToDate(item.dateAdded, true);
					dateList.appendItem(date.toLocaleString());
					numRows++;
				}
				
				dateList.setAttribute('rows', numRows);
				
				// If we set this inline, the selection doesn't take on the first
				// selection after unhiding versionSelect (when clicking
				// from a set with no differences) -- tested in Fx5.0.1
				setTimeout(function () {
					dateList.selectedIndex = 0;
				}, 0);
			}
			
			document.l10n.setArgs(button, { count: otherItems.length + 1 });
			versionSelect.hidden = fieldSelect.hidden = !alternatives;
			itembox.hiddenFields = alternatives ? [] : ['dateAdded', 'dateModified'];
			// Since the header of the collapsible section is hidden, the section has to be opened
			itembox.open = true;
			
			this.setMaster(0);
			
			return true;
		}
		
		setMaster(pos) {
			let itembox = document.getElementById('zotero-duplicates-merge-item-box');
			itembox.mode = 'fieldmerge';
			
			this._otherItems = this._items.concat();
			let item = this._otherItems.splice(pos, 1)[0];
			
			// Add master item's values to the beginning of each set of
			// alternative values so that they're still available if the item box
			// modifies the item
			let alternatives = item.multiDiff(this._otherItems, this._ignoreFields);
			if (alternatives) {
				let itemValues = item.toJSON();
				for (let i in alternatives) {
					alternatives[i].unshift(itemValues[i] !== undefined ? itemValues[i] : '');
				}
				itembox.fieldAlternatives = alternatives;
			}
			
			this._masterItem = item;
			itembox.item = item.clone();
			// The item.id is null which equals to _lastRenderItemID, so we need to force render it
			itembox._forceRenderAll();
		}
		
		async merge() {
			let itembox = document.getElementById('zotero-duplicates-merge-item-box');
			Zotero.CollectionTreeCache.clear();
			// Update master item with any field alternatives from the item box
			let json = this._masterItem.toJSON();
			// Exclude certain properties that are empty in the cloned object, so we don't clobber them
			const { relations: _r, collections: _c, tags: _t, ...keep } = itembox.item.toJSON();
			Object.assign(json, keep);
			
			this._masterItem.fromJSON(json);
			Zotero.Items.merge(this._masterItem, this._otherItems);
		}
	}
	customElements.define("duplicates-merge-pane", DuplicatesMergePane);
}
