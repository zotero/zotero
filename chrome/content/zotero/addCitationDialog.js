/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

var Zotero_Citation_Dialog = new function () {
	var _preserveData = {
		"prefix":"value",
		"suffix":"value",
		"locatorType":"selectedIndex",
		"locator":"value",
		"suppressAuthor":"checked"
	};
	
	var _itemData = new Object();
	var _multipleSourcesOn = false;
	var _lastSelected = null;
	var _previewShown = false;
	var _suppressNextTreeSelect = false;
	var _locatorIndexArray = {};
	var _autoRegeneratePref;
	var _acceptButton;
	var _sortCheckbox;
	var _originalHTML;
	var io;
	
	this.load = load;
	this.toggleMultipleSources = toggleMultipleSources;
	this.toggleEditor = toggleEditor;
	this.treeItemSelected = treeItemSelected;
	this.listItemSelected = listItemSelected;
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
		document.getElementById("multiple-sources-button").label = Zotero.getString("citation.multipleSources");
		document.getElementById("show-editor-button").label = Zotero.getString("citation.showEditor");
		
		io = window.arguments[0].wrappedJSObject;
		
		// find accept button
		_acceptButton = document.getElementById("zotero-add-citation-dialog").getButton("accept");
		_autoRegeneratePref = Zotero.Prefs.get("integration.autoRegenerate");
		
		// if a style with sortable citations, present checkbox
		if(io.citation.sortable) {
			_sortCheckbox = document.getElementById("keepSorted");
			_sortCheckbox.hidden = false;
			if(io.citation.properties.sort === undefined) io.citation.properties.sort = true;
			_sortCheckbox.checked = io.citation.properties.sort;
		}
		
		// load locators
		var locators = Zotero.CSL.Global.getLocatorStrings();
		var menu = document.getElementById("locatorType");
		var popup = document.getElementById("locator-type-popup");
		var i = 0;
		for(var value in locators) {
			var locator = locators[value];
			locator = locator[0].toUpperCase()+locator.substr(1);
			// add to popup
			var child = document.createElement("menuitem");
			child.setAttribute("value", value);
			child.setAttribute("label", locator);
			popup.appendChild(child);
			// add to array
			_locatorIndexArray[value] = i;
			i++;
		}
		menu.selectedIndex = 0;
		
		// load (from selectItemsDialog.js)
		doLoad();
		
		// if we already have a citation, load data from it
		document.getElementById('editor').format = "Integration";
		if(io.citation.citationItems.length) {
			if(io.citation.citationItems.length == 1) {
				// single citation
				_suppressNextTreeSelect = true;
				itemsView.selectItem(io.citation.citationItems[0].itemID);	 // treeview from selectItemsDialog.js
				for(var property in _preserveData) {
					if(io.citation.citationItems[0][property]) {
						if(property == "locatorType") {
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
					var item = Zotero.Items.get(io.citation.citationItems[i].itemID);
					if(item) {
						_addItem(item);
						_itemData[io.citation.citationItems[i].itemID] = io.citation.citationItems[i];
					}
				}
			}
			
			// show user-editable edited citation
			if(io.citation.properties.custom) {
				toggleEditor(io.citation.properties.custom);
				io.citation.properties.custom = undefined;
			}
			
			_updateAccept();
		}
		
		// Center citation popups manually after a delay when using a popup, since
		// popups aren't resizable and there might be persisted positions
		if (Zotero.Integration.usePopup) {
			document.getElementsByTagName("dialog")[0].style.border = "1px solid black";
			setTimeout(function () {
				window.centerWindowOnScreen();
			}, 1);
		}
	}
	
	/*
	 * turn on/off multiple sources item list
	 */
	function toggleMultipleSources() {
		_multipleSourcesOn = !_multipleSourcesOn;
		if(_multipleSourcesOn) {
			document.getElementById("multiple-sources").hidden = undefined;
			document.getElementById("zotero-add-citation-dialog").width = "750";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.singleSource");			
			window.sizeToContent();
			window.moveTo((window.screenX-75), window.screenY);
			treeItemSelected();
			// disable adding info until citation added
			_itemSelected(false);
		} else {
			document.getElementById("multiple-sources").hidden = true;
			document.getElementById("zotero-add-citation-dialog").width = "600";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.multipleSources");			
			window.sizeToContent();
			window.moveTo((window.screenX+75), window.screenY);
			
			// enable all fields
			for(var i in _preserveData) {
				document.getElementById(i).disabled = false;
			}
			
			// delete item list
			_itemData = new Object();
			
			// delete all items
			_clearCitationList();
		}
		_updateAccept();
		_updatePreview();
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
			// disable adding nothing, or things already added
			document.getElementById("add").disabled = !itemID || hasBeenAdded;
		} else {
			_updateAccept();
			_updatePreview();
		}
	}
	
	/*
	 * called when an item in the selected items list is clicked
	 */
	function listItemSelected() {
		var selectedListItem = document.getElementById("citation-list").getSelectedItem(0);
		var itemID = (selectedListItem ? selectedListItem.value : false);
		_itemSelected(itemID);
		
		document.getElementById("remove").disabled = !itemID;
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
		var citationList = document.getElementById("citation-list");
		var selectedListItem = citationList.getSelectedItem(0);
		var itemID = selectedListItem.value;
		
		// remove from _itemData
		delete _itemData[itemID];
		_itemData[itemID] = undefined;
		_lastSelected = null;
		
		// re-select currently selected in left pane
		var itemIDs = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
		if(itemIDs.length) {
			document.getElementById("zotero-items-tree").focus();
			treeItemSelected();
		}
		
		// remove from list
		citationList.removeChild(selectedListItem);
		
		_updateAccept();
		_updatePreview();
		treeItemSelected();
	}
	
	/*
	 * Sorts the list of citations
	 */
	function sortCitation() {
		io.citation.properties.sort = _sortCheckbox && _sortCheckbox.checked;
		if(_sortCheckbox.checked) {
			_getCitation();
			
			// delete all existing items from list
			_clearCitationList();
			
			// run preview function to re-sort, if it hasn't already been
			// run
			io.previewFunction();
			
			// add items back to list
			for(var i=0; i<io.citation.citationItems.length; i++) {
				var item = Zotero.Items.get(io.citation.citationItems[i].itemID);
				_addItem(item);
			}
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
		var editor = document.getElementById('editor');
		editor.hidden = _previewShown;
		_previewShown = !_previewShown;
		
		if(_previewShown) {
			document.getElementById("show-editor-button").label = Zotero.getString("citation.hideEditor");		
			window.sizeToContent();
			if(text) {
				editor.value = text;
			} else {
				_updatePreview();
			}
		} else {
			document.getElementById("show-editor-button").label = Zotero.getString("citation.showEditor");		
			window.sizeToContent();
		}
	}
	
	/*
	 * called when accept button is clicked
	 */
	function accept() {
		_getCitation();
		var isCustom = _previewShown && io.citation.citationItems.length	// if a citation is selected
				&& document.getElementById('editor').value != _originalHTML	// and citation has been edited
		
		if(isCustom) {	
			var citation = document.getElementById('editor').value
		} else {
			var citation = (io.citation.citationItems.length ? io.previewFunction() : "");
		}
		
		if(Zotero.Utilities.prototype.trim(citation) == "") {				
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
						.getService(Components.interfaces.nsIPromptService);
			var insert = promptService.confirm(window,
				Zotero.getString("integration.emptyCitationWarning.title"),
				Zotero.getString("integration.emptyCitationWarning.body"));
			if(!insert) return false;
		}
		
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
			editor.value = _originalHTML = (io.citation.citationItems.length ? io.previewFunction() : "");
		}
	}
	
	/*
	 * Controls whether the accept (OK) button should be enabled
	 */
	function _updateAccept(status) {
		if(_multipleSourcesOn) {
			_acceptButton.disabled = !document.getElementById("citation-list").childNodes.length;
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
				if(property == "locatorType") {
					_itemData[_lastSelected][box] = domBox.selectedItem.value;
				} else {
					_itemData[_lastSelected][box] = domBox[property];
				}
			}
			// restore previous property
			if(itemID) {
				domBox.disabled = false;
				if(_itemData[itemID] && _itemData[itemID][box] !== undefined) {
					if(property == "locatorType") {
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
		var locatorTypeElements = document.getElementById("locatorType").getElementsByTagName("menuitem");
		if(_multipleSourcesOn) {
			_itemSelected();		// store locator info
			
			var citationList = document.getElementById("citation-list");
			var listLength = citationList.childNodes.length;
			
			var citationItems = new Array();
			if(listLength) {
				// generate citationItems
				for(var i=0; i<listLength; i++) {
					var itemID = citationList.childNodes[i].value;
					
					var citationItem = _itemData[itemID];
					citationItem.itemID = itemID;
					io.citation.citationItems.push(citationItem);
				}
			}
		} else {
			var items = itemsView.getSelectedItems(true); // treeview from selectItemsDialog.js
			
			var citationItem = new Zotero.CSL.CitationItem();
			citationItem.itemID = items[0];
			for(var property in _preserveData) {
				if(property == "locatorType") {
					citationItem[property] = document.getElementById(property).selectedItem.value;
				} else {
					citationItem[property] = document.getElementById(property)[_preserveData[property]];
				}
			}
			
			if(citationItem["locator"] == "") {
				citationItem["locator"] = citationItem["locatorType"] = undefined;
			}
			
			io.citation.citationItems = [citationItem];
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
		document.getElementById("citation-list").appendChild(itemNode);
	}
	
	/*
	 * Removes all items from the multiple sources list
	 */
	function _clearCitationList() {
		var citationList = document.getElementById("citation-list");
		while(citationList.firstChild) {
			citationList.removeChild(citationList.firstChild);
		}
	}
}