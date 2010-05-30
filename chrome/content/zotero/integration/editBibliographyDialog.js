/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

var Zotero_Bibliography_Dialog = new function () {
	var bibEditInterface;
	var _lastSelectedItemID = false;
	var _lastSelectedIndex = false;
	var _lastSelectedValue = false;
	
	this.load = load;
	this.treeItemSelected = treeItemSelected;
	this.listItemSelected = listItemSelected;
	this.add = add;
	this.remove = remove;
	this.accept = accept;
	
	/*
	 * initialize add citation dialog
	 */
	function load() {
		document.getElementById('editor').format = "RTF";
		
		bibEditInterface = window.arguments[0].wrappedJSObject;
		
		// load (from selectItemsDialog.js)
		doLoad();
		
		// load bibliography entires
		_loadItems();
	}
	
	/*
	 * called when an item in the item selection tree is clicked
	 */
	function treeItemSelected() {
		var selectedItems = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
		
		// disable add if item already in itemSet
		document.getElementById("add").disabled = selectedItems.length && bibEditInterface.bibliography[0].entry_ids.indexOf(selectedItems[0].id) !== -1;
	}
	
	/*
	 * called when an item in the reference list is clicked
	 */
	function listItemSelected() {
		var selectedListItem = document.getElementById("item-list").getSelectedItem(0);
		
		// enable remove if item is selected
		document.getElementById("remove").disabled = !selectedListItem;
		
		if(selectedListItem) {
			_updatePreview(selectedListItem.value);
		} else {
			_updatePreview();
		}
	}
	
	/*
	 * Adds a citation to the reference list
	 */
	function add() {
		var selectedItem = itemsView.getSelectedItems()[0]; // treeview from selectItemsDialog.js
		Zotero.debug(selectedItem);
		
		bibEditInterface.add(selectedItem.id);
		document.getElementById("add").disabled = true;
		_loadItems();
	}
	
	/*
	 * Deletes a citation from the reference list
	 */
	function remove() {
		var selectedListItem = document.getElementById("item-list").getSelectedItem(0);
		var itemID = bibEditInterface.bibliography[0].entry_ids[selectedListItem.value];
		
		if(bibEditInterface.isCited(itemID)) {
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
			
			var out = {};
			var regenerate = promptService.confirmEx(
				window,
				Zotero.getString('integration.deleteCitedItem.title'),
				Zotero.getString('integration.deleteCitedItem.body'),
				promptService.STD_OK_CANCEL_BUTTONS+promptService.BUTTON_POS_1_DEFAULT,
				null, null, null, null, out
			);
			
			if(regenerate != 0) return;
		}
		
		bibEditInterface.remove(itemID);
		_loadItems();
	}
	
	function accept() {
		_updatePreview();
	}
	
	/*
	 * Updates the contents of the preview pane
	 */
	function _updatePreview(index) {
		Zotero.debug("_updatePreview called");
		var editor = document.getElementById('editor');
		
		if(_lastSelectedItemID) {
			var newValue = editor.value;
			if(_lastSelectedValue != newValue) {
				Zotero.debug("setting bibliography for "+_lastSelectedItemID+" to "+newValue);
				bibEditInterface.setCustomText(_lastSelectedItemID, newValue);
			}
		}
		
		editor.readonly = index === undefined;
		if(index !== undefined) {
			Zotero.debug("updating preview of "+index);
			var itemID = bibEditInterface.bibliography[0].entry_ids[index];
			editor.value = bibEditInterface.bibliography[1][index];
			_lastSelectedIndex = index;
			_lastSelectedItemID = itemID;
			_lastSelectedValue = editor.value;
		} else {
			editor.value = "";
			_lastSelectedIndex = _lastSelectedItemID = _lastSelectedValue = false;
		}
	}
	
	/*
	 * loads items from itemSet
	 */
	function _loadItems() {
		var itemIDs = bibEditInterface.bibliography[0].entry_ids;
		var items = Zotero.Items.get(itemIDs);
		
		// delete all existing items from list
		var itemList = document.getElementById("item-list");
		while(itemList.firstChild) {
			itemList.removeChild(itemList.firstChild);
		}
		
		// add new items
		for(var i=0; i<items.length; i++) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", i);
			itemNode.setAttribute("label", items[i].getField("title"));
			itemNode.setAttribute("class", "listitem-iconic");
			itemNode.setAttribute("image", items[i].getImageSrc());
			itemList.appendChild(itemNode);
		}
		
		_updatePreview();
	}
}