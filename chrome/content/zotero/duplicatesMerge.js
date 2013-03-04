/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
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

var Zotero_Duplicates_Pane = new function () {
	_items = [];
	_otherItems = [];
	_ignoreFields = ['dateAdded', 'dateModified', 'accessDate'];
	
	this.setItems = function (items, displayNumItemsOnTypeError) {
		var itemTypeID, oldestItem, otherItems = [];
		for each(var item in items) {
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
			
			if (!item.isRegularItem() || [1,14].indexOf(item.itemTypeID) != -1) {
				var msg = Zotero.getString('pane.item.duplicates.onlyTopLevel');
				ZoteroPane_Local.setItemPaneMessage(msg);
				return false;
			}
			
			// Make sure all items are of the same type
			if (itemTypeID) {
				if (itemTypeID != item.itemTypeID) {
					if (displayNumItemsOnTypeError) {
						var msg = Zotero.getString('pane.item.selected.multiple', items.length);
					}
					else {
						var msg = Zotero.getString('pane.item.duplicates.onlySameItemType');
					}
					ZoteroPane_Local.setItemPaneMessage(msg);
					return false;
				}
			}
			else {
				itemTypeID = item.itemTypeID;
			}
		}
		
		_items = items;
		
		_items.sort(function (a, b) {
			return a.dateAdded > b.dateAdded ? 1 : a.dateAdded == b.dateAdded ? 0 : -1;
		});
		
		//
		// Update the UI
		//
		
		var diff = oldestItem.multiDiff(otherItems, _ignoreFields);
		
		var button = document.getElementById('zotero-duplicates-merge-button');
		var versionSelect = document.getElementById('zotero-duplicates-merge-version-select');
		var itembox = document.getElementById('zotero-duplicates-merge-item-box');
		var fieldSelect = document.getElementById('zotero-duplicates-merge-field-select');
		
		versionSelect.hidden = !diff;
		if (diff) {
			// Populate menulist with Date Added values from all items
			var dateList = document.getElementById('zotero-duplicates-merge-original-date');
			
			while (dateList.itemCount) {
				dateList.removeItemAt(0);
			}
			
			var numRows = 0;
			for each(var item in _items) {
				var date = Zotero.Date.sqlToDate(item.dateAdded, true);
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
		
		button.label = Zotero.getString('pane.item.duplicates.mergeItems', (otherItems.length + 1));
		itembox.hiddenFields = diff ? [] : ['dateAdded', 'dateModified'];
		fieldSelect.hidden = !diff;
		
		this.setMaster(0);
		
		return true;
	}
	
	
	this.setMaster = function (pos) {
		var itembox = document.getElementById('zotero-duplicates-merge-item-box');
		itembox.mode = 'fieldmerge';
		
		_otherItems = _items.concat();
		var item = _otherItems.splice(pos, 1)[0];
		
		// Add master item's values to the beginning of each set of
		// alternative values so that they're still available if the item box
		// modifies the item
		var diff = item.multiDiff(_otherItems, _ignoreFields);
		if (diff) {
			var itemValues = item.serialize()
			for (var i in diff) {
				diff[i].unshift(itemValues.fields[i]);
			}
			itembox.fieldAlternatives = diff;
		}
		
		itembox.item = item.clone(true);
	}
	
	
	this.merge = function () {
		var itembox = document.getElementById('zotero-duplicates-merge-item-box');
		Zotero.ItemGroupCache.clear();
		Zotero.Items.merge(itembox.item, _otherItems);
	}
}
