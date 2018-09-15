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

var Zotero_Bibliography_Dialog = new function () {
	var bibEditInterface;
	var _lastSelectedItemID = false;
	var _lastSelectedIndex = false;
	var _lastSelectedValue = false;
	var _accepted = false;
	var _revertButton, _revertAllButton, _addButton, _removeButton;
	var _itemList;
	var _suppressAllSelectEvents = false;
	
	/**
	 * Initializes add citation dialog
	 */
	this.load = function() {
		bibEditInterface = window.arguments[0].wrappedJSObject;
		
		_revertAllButton = document.documentElement.getButton("extra2");
		_revertButton = document.documentElement.getButton("extra1");
		_addButton = document.getElementById("add");
		_removeButton = document.getElementById("remove");
		_itemList = document.getElementById("item-list");
		_itemTree = document.getElementById("zotero-items-tree");
		
		_revertAllButton.label = Zotero.getString("integration.revertAll.button");
		_revertAllButton.disabled = bibEditInterface.isAnyEdited();
		_revertButton.label = Zotero.getString("integration.revert.button");
		_revertButton.disabled = true;

		document.getElementById('editor').format = "RTF";
		
		// load (from selectItemsDialog.js)
		doLoad();
		
		// load bibliography entries
		_loadItems();
	}
	
	/**
	 * Called when an item in the item selection tree is clicked
	 */
	this.treeItemSelected = function() {
		if(_suppressAllSelectEvents) return;
		var selectedItemIDs = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
		
		// if all selected items are available in the list box on the right, select them there
		// otherwise, clear the list box selection
		var clearListItems = false;
		var itemsToSelect = [];
		if(selectedItemIDs.length) {
			for (let itemID of selectedItemIDs) {
				var itemIndexToSelect = false;
				for(var i in bibEditInterface.bib[0].entry_ids) {
					if(bibEditInterface.bib[0].entry_ids[i].indexOf(itemID) !== -1) {
						itemIndexToSelect = i;
						continue;
					}
				}
				
				if(itemIndexToSelect !== false) {
					itemsToSelect.push(_itemList.getItemAtIndex(itemIndexToSelect));
				} else {
					clearListItems = true;
					break;
				}
			}
		}
		
		_suppressAllSelectEvents = true;
		_itemList.clearSelection();
		if(clearListItems) {
			_addButton.disabled = (itemsToSelect.length > 0);
			_revertButton.disabled = _removeButton.disabled = true;
		} else {
			_addButton.disabled = true;
			_removeButton.disabled = false;
			_updateRevertButtonStatus();
			itemsToSelect.forEach(item => _itemList.toggleItemSelection(item));
			_itemList.ensureIndexIsVisible(itemsToSelect[0]);
		}
		_suppressAllSelectEvents = false;
		
		_updatePreview();
	}
	
	/**
	 * Called when an item in the reference list is clicked
	 */
	this.listItemSelected = function() {
		if(_suppressAllSelectEvents) return;
		
		// enable remove if at least one item is selected
		_addButton.disabled = true;
		_removeButton.disabled = !_itemList.selectedItems.length;
		
		if(_itemList.selectedItems.length) {
			_suppressAllSelectEvents = true;
			_itemTree.view.selection.clearSelection();
			_suppressAllSelectEvents = false;
			
			// only show revert button if at least one selected item has been edited
			_updateRevertButtonStatus();
		}
		
		// update preview to blank if no items or multiple items are selected; otherwise show
		// preview for selected items
		_updatePreview();
	}
	
	/**
	 * Adds references to the reference list
	 */
	this.add = function() {
		for (let itemID of itemsView.getSelectedItems(true)) {
			bibEditInterface.add(itemID);
		}
		document.getElementById("add").disabled = true;
		_loadItems();
	}
	
	/**
	 * Clears all customizations
	 */
	this.revertAll = function() {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
		
		var out = {};
		var regenerate = promptService.confirmEx(
			window,
			Zotero.getString('integration.revertAll.title'),
			Zotero.getString('integration.revertAll.body'),
			promptService.STD_OK_CANCEL_BUTTONS+promptService.BUTTON_POS_1_DEFAULT,
			null, null, null, null, out
		);
		
		if(regenerate != 0) return;
		
		bibEditInterface.revertAll();
		
		_loadItems();
		_updatePreview(true);
	}
	
	/**
	 * Clears customizations to selected entry
	 */
	this.revert = function() {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
		
		var out = {};
		var regenerate = promptService.confirmEx(
			window,
			Zotero.getString('integration.revert.title'),
			Zotero.getString('integration.revert.body'),
			promptService.STD_OK_CANCEL_BUTTONS+promptService.BUTTON_POS_1_DEFAULT,
			null, null, null, null, out
		);
		
		if(regenerate != 0) return;
		
		for (let itemID of _getSelectedListItemIDs()) {
			bibEditInterface.revert(itemID);
		}
		
		_updatePreview();
	}
	
	/**
	 * Deletes selected references from the reference list
	 */
	this.remove = function() {
		var selectedListItemIDs = _getSelectedListItemIDs();
		
		// if cited in bibliography, warn before removing
		var isCited = false;
		for (let itemID of selectedListItemIDs) {
			isCited |= bibEditInterface.isCited(itemID);
		}
		if(isCited) {			
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
			
			var out = {};
			var regenerate = promptService.confirmEx(
				window,
				Zotero.getString('integration.removeBibEntry.title'),
				Zotero.getString('integration.removeBibEntry.body'),
				promptService.STD_OK_CANCEL_BUTTONS+promptService.BUTTON_POS_1_DEFAULT,
				null, null, null, null, out
			);
			if(regenerate != 0) return;
		}
		
		// remove
		for (let itemID of selectedListItemIDs) {
			bibEditInterface.remove(itemID);
		}
		_loadItems();
	}
	
	/**
	 * Called when the user edits the currently selected bibliography entry
	 */
	this.textChanged = function() {
		_revertButton.disabled = _revertAllButton.disabled = false;
	}
	
	/**
	 * Called when OK button is pressed
	 */
	this.accept = function() {
		if(_accepted) return;
		_updatePreview(true);
		_accepted = true;
	}
	
	/**
	 * Called when Cancel button is pressed
	 */
	this.close = function() {
		if(_accepted) return;
		bibEditInterface.cancel();
		_accepted = true;
	}
	
	/**
	 * Gets selected item IDs from list box on right
	 */
	function _getSelectedListItemIDs() {
		return Array.from(_itemList.selectedItems)
			.map(item => bibEditInterface.bib[0].entry_ids[item.value][0]);
	}
	
	/**
	 * Update status of "Revert" button to match modification status of current item
	 */
	function _updateRevertButtonStatus() {
		_revertButton.disabled = true;
		var selectedListItemIDs = _getSelectedListItemIDs();
		for (let itemID of selectedListItemIDs) {
			if(bibEditInterface.isEdited(itemID)) {
				_revertButton.disabled = false;
				break;
			}
		}
	}
	
	/**
	 * Updates the contents of the preview pane
	 */
	function _updatePreview(ignoreSelection) {
		var index = !ignoreSelection && _itemList.selectedItems.length == 1 ? _itemList.selectedIndex : undefined;
		var editor = document.getElementById('editor');
		
		if(_lastSelectedItemID) {
			var newValue = editor.value;
			if(_lastSelectedValue != newValue) {
				bibEditInterface.setCustomText(_lastSelectedItemID, newValue);
			}
		}
		
		editor.readonly = index === undefined;
		if(index !== undefined) {
			var itemID = bibEditInterface.bib[0].entry_ids[index];
			editor.value = bibEditInterface.bib[1][index];
			_lastSelectedIndex = index;
			_lastSelectedItemID = itemID;
			_lastSelectedValue = editor.value;
		} else {
			editor.value = "";
			_lastSelectedIndex = _lastSelectedItemID = _lastSelectedValue = false;
		}
		
		_revertAllButton.disabled = !bibEditInterface.isAnyEdited();
	}
	
	/*
	 * loads items from itemSet
	 */
	function _loadItems() {
		var itemIDs = bibEditInterface.bib[0].entry_ids;
		var items = itemIDs.map(itemID => Zotero.Cite.getItem(itemID[0]));
		
		// delete all existing items from list
		var itemList = document.getElementById("item-list");
		while(itemList.firstChild) {
			itemList.removeChild(itemList.firstChild);
		}
		
		// add new items
		for(var i=0; i<items.length; i++) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", i);
			itemNode.setAttribute("label", items[i].getDisplayTitle());
			itemNode.setAttribute("class", "listitem-iconic");
			itemNode.setAttribute("image", items[i].getImageSrc());
			itemList.appendChild(itemNode);
		}
		
		_updatePreview();
	}
}