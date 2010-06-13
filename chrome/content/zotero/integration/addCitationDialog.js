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

var Zotero_Citation_Dialog = new function () {
	var _preserveData = {
		"prefix":"value",
		"suffix":"value",
		"label":"selectedIndex",
		"locator":"value",
		"suppress-author":"checked"
	};
	
	var _itemData = new Object();
	var _multipleSourcesOn = false;
	var _lastSelected = null;
	var _previewShown = false;
	var _suppressNextTreeSelect = false;
	var _suppressNextListSelect = false;
	var _locatorIndexArray = {};
	var _locatorNameArray = {};
	var _autoRegeneratePref;
	var _acceptButton;
	var _sortCheckbox;
	var _citationList;
	var _originalHTML;
	var io;
	
	this.load = load;
	this.toggleMultipleSources = toggleMultipleSources;
	this.toggleEditor = toggleEditor;
	this.treeItemSelected = treeItemSelected;
	this.listItemSelected = listItemSelected;
	this.up = up;
	this.down = down;
	this.add = add;
	this.remove = remove;
	this.sortCitation = sortCitation;
	this.confirmRegenerate = confirmRegenerate;
	this.accept = accept;
	this.cancel = cancel;
	
	/*
	 * initialize add citation dialog
	 */
	function load() {
		document.documentElement.getButton("extra1").label = Zotero.getString("citation.multipleSources");
		document.documentElement.getButton("extra2").label = Zotero.getString("citation.showEditor");
		
		io = window.arguments[0].wrappedJSObject;
		
		// find accept button
		_acceptButton = document.getElementById("zotero-add-citation-dialog").getButton("accept");
		_autoRegeneratePref = Zotero.Prefs.get("integration.autoRegenerate");
		_citationList = document.getElementById("citation-list");
		
		// if a style with sortable citations, present checkbox
		if(io.sortable) {
			_sortCheckbox = document.getElementById("keepSorted");
			_sortCheckbox.hidden = false;
			_sortCheckbox.checked = !io.citation.properties.unsorted;
		}
		
		// load locators
		var locators = Zotero.Cite.labels;
		var menu = document.getElementById("label");
		var popup = document.getElementById("locator-type-popup");
		var i = 0;
		for(var value in locators) {
			var locator = locators[value];
			var locatorLabel = locator[0].toUpperCase()+locator.substr(1);
			// add to popup
			var child = document.createElement("menuitem");
			child.setAttribute("value", value);
			child.setAttribute("label", locatorLabel);
			popup.appendChild(child);
			// add to array
			_locatorIndexArray[locator] = i;
			_locatorNameArray[i] = locator;
			i++;
		}
		menu.selectedIndex = 0;
		
		// load (from selectItemsDialog.js)
		doLoad();
		
		// if we already have a citation, load data from it
		document.getElementById('editor').format = "RTF";
		if(io.citation.citationItems.length) {
			if(io.citation.citationItems.length == 1) {
				// single citation
				_suppressNextTreeSelect = true;
				itemsView.selectItem(io.citation.citationItems[0].id);	 // treeview from selectItemsDialog.js
				for(var property in _preserveData) {
					if(io.citation.citationItems[0][property]) {
						if(property == "label") {
							document.getElementById(property)[_preserveData[property]] = _locatorIndexArray[io.citation.citationItems[0][property]];
						} else {
							document.getElementById(property)[_preserveData[property]] = io.citation.citationItems[0][property];
						}
					}
				}
			} else {
				// multiple citations
				toggleMultipleSources();
				for(var i=0; i<io.citation.citationItems.length; i++) {
					var item = Zotero.Items.get(io.citation.citationItems[i].id);
					if(item) {
						_addItem(item);
						_itemData[io.citation.citationItems[i].id] = io.citation.citationItems[i];
					}
				}
			}
			
			// show user-editable edited citation
			if(io.citation.properties.custom) {
				toggleEditor(io.citation.properties.custom);
				delete io.citation.properties.custom;
			}
			
			_updateAccept();
		}
	}
	
	/*
	 * turn on/off multiple sources item list
	 */
	function toggleMultipleSources() {
		_multipleSourcesOn = !_multipleSourcesOn;
		if(_multipleSourcesOn) {
			var items = itemsView.getSelectedItems(true);
			var itemID = (items.length ? items[0] : false);
			// var itemDataID = itemID+"::"+0;
			document.getElementById("multiple-sources").hidden = undefined;
			document.getElementById("zotero-add-citation-dialog").width = "750";
			document.documentElement.getButton("extra1").label = Zotero.getString("citation.singleSource");			
			// move user field content to multiple before adding XXXXX
			if (itemID) {
				// _itemData[itemDataID] = new Object();
				_itemData[itemID] = new Object();
				var element;
				for (var box in _preserveData) {
					element = document.getElementById(box);
					// _itemData[itemDataID][box] = element[_preserveData[box]];
					_itemData[itemID][box] = element[_preserveData[box]];
				}
			}
			treeItemSelected();
			// disable adding info until citation added
			_itemSelected(false);
			// add current selection
			if (itemID) {
				this.add();
			} else {
				_updateAccept();
				_updatePreview();
			}
		} else {
			document.getElementById("multiple-sources").hidden = true;
			document.getElementById("zotero-add-citation-dialog").width = "600";
			document.documentElement.getButton("extra1").label = Zotero.getString("citation.multipleSources");
			
			// enable all fields
			for(var i in _preserveData) {
				document.getElementById(i).disabled = false;
			}
			
			// delete item list
			_itemData = new Object();
			
			// delete all items
			_clearCitationList();
			_updateAccept();
			_updatePreview();
		}
	}
	
	/*
	 * called when an item in the item selection tree is clicked
	 */
	function treeItemSelected() {
		if(_suppressNextTreeSelect) {
			_suppressNextTreeSelect = false;
			_updateAccept();
			return;
		}
		var items = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
		var itemID = (items.length ? items[0] : false);
		
		if(_multipleSourcesOn) {
			// if item is also on right side, show info
			var hasBeenAdded = itemID && _itemData[itemID] !== undefined;
			// disable boxes if item not added; otherwise, enable
			_itemSelected(hasBeenAdded ? itemID : false);
			// turn off highlight in selected item list
			_suppressNextListSelect = true;
			document.getElementById("citation-list").selectedIndex = -1;
			// disable adding nothing, or things already added
			document.getElementById("add").disabled = !itemID || hasBeenAdded;
			document.getElementById("remove").disabled = true;
			document.getElementById("up").disabled = true;
			document.getElementById("down").disabled = true;
		} else {
			_updateAccept();
			_updatePreview();
		}
	}
	
	/*
	 * called when an item in the selected items list is clicked
	 */
	function listItemSelected() {
		if(_suppressNextListSelect) {
			_suppressNextListSelect = false;
			_updateAccept();
			return;
		}
		var selectedListItem = _citationList.getSelectedItem(0);
		var selectedListIndex = _citationList.selectedIndex;
		var itemID = (selectedListItem ? selectedListItem.value : false);
		_itemSelected(itemID);
		// turn off highlight in item tree
		_suppressNextTreeSelect = true;
		document.getElementById("zotero-items-tree").view.selection.clearSelection();
		document.getElementById("remove").disabled = !itemID;
		document.getElementById("add").disabled = true;
		_configListPosition(!itemID, selectedListIndex);
	}
	
	function _configListPosition(flag, selectedListIndex) {
		if (selectedListIndex > 0) {
			document.getElementById("up").disabled = flag;
		} else {
			document.getElementById("up").disabled = true;
		}
		if (-1 < selectedListIndex && selectedListIndex < (_citationList.getRowCount() - 1)) {
			document.getElementById("down").disabled = flag;
		} else {
			document.getElementById("down").disabled = true;
		}
	}

	function _move(direction) {
		// automatically uncheck sorted checkbox if user is rearranging citation
		if(_sortCheckbox && _sortCheckbox.checked) {
			_sortCheckbox.checked = false;
			sortCitation();
		}
		
		var insertBeforeItem;
		var selectedListItem = _citationList.getSelectedItem(0);
		var selectedListIndex = _citationList.selectedIndex;
		var itemID = selectedListItem.value;
		if (direction === -1) {
			insertBeforeItem = selectedListItem.previousSibling;
		} else {
			insertBeforeItem = selectedListItem.nextSibling.nextSibling;
		}
		var listItem = _citationList.removeChild(selectedListItem);
		_citationList.insertBefore(listItem, insertBeforeItem);
		_citationList.selectedIndex = (selectedListIndex + direction);
		_itemSelected(itemID);
		_updatePreview();
		_configListPosition(false, (selectedListIndex + direction));
	}

	function up() {
		_move(-1);
	}

	function down() {
		_move(1);
	}

	/*
	 * Adds a citation to the multipleSources list
	 */
	function add() {
		var item = itemsView.getSelectedItems()[0]; // treeview from selectItemsDialog.js
		_itemSelected(item.getID());
		_addItem(item);
		
		// don't let someone select it again
		document.getElementById("add").disabled = true;
		
		// allow user to press OK
		_updateAccept();
		_updatePreview();
		sortCitation();
	}
	
	/*
	 * Deletes a citation from the multipleSources list
	 */
	function remove() {
		var selectedListItem = _citationList.getSelectedItem(0);
		var selectedListIndex = _citationList.selectedIndex;
		var itemID = selectedListItem.value;
		
		// remove from _itemData
		delete _itemData[itemID];
		_itemData[itemID] = undefined;
		_lastSelected = null;
		
		// remove from list
		_citationList.removeChild(selectedListItem);
		
		if (selectedListIndex >= _citationList.getRowCount()) {
			selectedListIndex = _citationList.getRowCount() - 1;
		}
		_citationList.selectedIndex = selectedListIndex;

		_updateAccept();
		_updatePreview();
	}
	
	/*
	 * Sorts the list of citations
	 */
	function sortCitation() {
		if(!_sortCheckbox) return;
		if(!_sortCheckbox.checked) {
			io.citation.properties.unsorted = true;
			return;
		}

		var selectedItemID = (_citationList.selectedItem ? _citationList.selectedItem.value : null);
		Zotero.debug("item "+selectedItemID+" selected");
		_getCitation();
		
		// delete all existing items from list
		_clearCitationList();
		
		// run preview function to re-sort, if it hasn't already been
		// run
		io.previewFunction();
		
		// add items back to list
		for(var i=0; i<io.citation.sortedItems.length; i++) {
			var itemID = io.citation.sortedItems[i][0].id;
			var item = Zotero.Items.get(itemID);
			_addItem(item);
			if(itemID == selectedItemID) _citationList.selectedIndex = i;
		}
	}
	
	/*
	 * Ask whether to modfiy the preview
	 */
	function confirmRegenerate(focusShifted) {
		if(document.getElementById('editor').value == _originalHTML || _originalHTML === undefined) {
			// no changes; just update without asking
			_updatePreview();
			return;
		}
		
		if(_autoRegeneratePref == -1) {
			if(focusShifted) {	// only ask after onchange event; oninput is too
								// frequent for this to be worthwhile
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
												.getService(Components.interfaces.nsIPromptService);
				
				var saveBehavior = { value: false };
				var regenerate = promptService.confirmEx(
					this.window,
					Zotero.getString('integration.regenerate.title'),
					Zotero.getString('integration.regenerate.body'),
					promptService.STD_YES_NO_BUTTONS,
					null, null, null,
					Zotero.getString('integration.regenerate.saveBehavior'),
					saveBehavior
				);
				
				if(saveBehavior.value) {
					_autoRegeneratePref = (regenerate == 0 ? 1 : 0);
					Zotero.Prefs.set("integration.autoRegenerate", _autoRegeneratePref);
				}
				
				if(regenerate == 0) {
					_updatePreview();
				}
			}
		} else if(_autoRegeneratePref == 1) {
			_updatePreview();
		}
	}
	
	/*
	 * Shows the edit pane
	 */
	function toggleEditor(text) {
		var warning = document.getElementById('zotero-editor-warning');
		var editor = document.getElementById('editor');
		warning.hidden = _previewShown;
		editor.hidden = _previewShown;
		_previewShown = !_previewShown;
		
		if(_previewShown) {
			document.documentElement.getButton("extra2").label = Zotero.getString("citation.hideEditor");		
			if(text) {
				editor.value = text;
			} else {
				_updatePreview();
			}
		} else {
			document.documentElement.getButton("extra2").label = Zotero.getString("citation.showEditor");		
		}
	}
	
	/*
	 * called when accept button is clicked
	 */
	function accept() {
		Zotero.debug("Trying to accept");
		_getCitation();
		Zotero.debug("got citation");
		var isCustom = _previewShown && io.citation.citationItems.length	// if a citation is selected
				&& document.getElementById('editor').value != _originalHTML	// and citation has been edited
		
		if(isCustom) {	
			var citation = document.getElementById('editor').value;
		} else {
			var citation = (io.citation.citationItems.length ? io.previewFunction() : "");
		}
		Zotero.debug("verified not custom");
		
		if(Zotero.Utilities.prototype.trim(citation) == "") {				
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
						.getService(Components.interfaces.nsIPromptService);
			var insert = promptService.confirm(window,
				Zotero.getString("integration.emptyCitationWarning.title"),
				Zotero.getString("integration.emptyCitationWarning.body"));
			if(!insert) return false;
		}
		Zotero.debug("verified not empty");
		
		if(isCustom) io.citation.properties.custom = citation;
		
		return true;
	}
	
	/*
	 * called when cancel button is clicked
	 */
	function cancel() {
		io.citation.citationItems = new Array();
	}
	
	/*
	 * Updates the contents of the preview pane
	 */
	function _updatePreview() {
		if(_previewShown) {
			var editor = document.getElementById('editor');
			_getCitation();
			
			editor.readonly = !io.citation.citationItems.length;
			editor.value = (io.citation.citationItems.length ? io.previewFunction() : "");
			_originalHTML = editor.value;
		}
	}
	
	/*
	 * Controls whether the accept (OK) button should be enabled
	 */
	function _updateAccept(status) {
		if(_multipleSourcesOn) {
			_acceptButton.disabled = !_citationList.getRowCount();
		} else {
			_acceptButton.disabled = !itemsView.getSelectedItems().length; // treeview from selectItemsDialog.js
		}
	}
	
	/*
	 * called when an item is selected; if itemID is false, disables fields; if
	 * itemID is undefined, only updates _itemData array
	 */
	function _itemSelected(itemID) {
		if(_lastSelected && !_itemData[_lastSelected]) {
			_itemData[_lastSelected] = new Object();
		}
		
		for(var box in _preserveData) {
			var domBox = document.getElementById(box);
			var property = _preserveData[box];
			
			// save property
			if(_lastSelected) {
				if(property == "label") {
					_itemData[_lastSelected][box] = _locatorNameArray[domBox.selectedIndex];
				} else {
					_itemData[_lastSelected][box] = domBox[property];
				}
			}
			// restore previous property
			if(itemID) {
				domBox.disabled = false;
				if(_itemData[itemID] && _itemData[itemID][box] !== undefined) {
					if(property == "label") {
						domBox[property] = _locatorIndexArray[_itemData[itemID][box]];
					} else {
						domBox[property] = _itemData[itemID][box];
					}
				}
			} else if(itemID !== undefined) {
				domBox.disabled = true;
				domBox[property] = "";
			}
		}
		
		if(itemID !== undefined) _lastSelected = itemID;
	}
	
	/*
	 * updates io.citation to reflect selected items
	 */
	function _getCitation() {
		io.citation.citationItems = new Array();
		
		// use to map selectedIndexes back to page/paragraph/line
		var locatorTypeElements = document.getElementById("label").getElementsByTagName("menuitem");
		if(_multipleSourcesOn) {
			_itemSelected();		// store locator info
			var listLength = _citationList.childNodes.length;
			var citationItems = new Array();
			if(listLength) {
				// generate citationItems
				for(var i=0; i<listLength; i++) {
					var itemID = _citationList.childNodes[i].value;
					
					var citationItem = _itemData[itemID];
					citationItem.id = itemID;
					io.citation.citationItems.push(citationItem);
				}
			}
		} else {
			var items = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
			
			if(items.length) {
				var citationItem = {};
				citationItem.id = items[0];
				for(var property in _preserveData) {
					if(property == "label") {
						citationItem[property] = _locatorNameArray[document.getElementById(property).selectedIndex];
					} else {
						citationItem[property] = document.getElementById(property)[_preserveData[property]];
					}
				}
				
				if(citationItem["locator"] == "") {
					citationItem["locator"] = citationItem["label"] = undefined;
				}
				
				io.citation.citationItems = [citationItem];
			} else {
				io.citation.citationItems = [];
			}
		}
	}
	
	/*
	 * Add an item to the item list (multiple sources only)
	 */
	function _addItem(item) {
		var itemNode = document.createElement("listitem");
		itemNode.setAttribute("value", item.getID());
		itemNode.setAttribute("label", item.getField("title"));
		itemNode.setAttribute("class", "listitem-iconic");
		itemNode.setAttribute("image", item.getImageSrc());
		_citationList.appendChild(itemNode);
	}
	
	/*
	 * Removes all items from the multiple sources list
	 */
	function _clearCitationList() {
		while(_citationList.firstChild) _citationList.removeChild(_citationList.firstChild);
	}
}