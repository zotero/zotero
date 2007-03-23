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
	var _itemLocators = new Object();
	var _itemLocatorTypes = new Object();
	var _multipleSourcesOn = false;
	var _lastSelected = null;
	
	this.load = load;
	this.toggleMultipleSources = toggleMultipleSources;
	this.treeItemSelected = treeItemSelected;
	this.listItemSelected = listItemSelected;
	this.addCitation = addCitation;
	this.deleteCitation = deleteCitation;
	this.accept = accept;
	
	function load() {
		document.getElementById("multiple-sources-button").label = Zotero.getString("citation.multipleSources");
		
		// load (from selectItemsDialog.js)
		doLoad();
	}
	
	function toggleMultipleSources() {
		_multipleSourcesOn = !_multipleSourcesOn;
		if(_multipleSourcesOn) {
			document.getElementById("multiple-sources").hidden = undefined;
			document.getElementById("add-citation-dialog").width = "750";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.singleSource");			
			window.sizeToContent();
			window.moveTo((window.screenX-75), window.screenY);
			Zotero.debug("Calling treeItemSelected");
			treeItemSelected();
		} else {
			document.getElementById("multiple-sources").hidden = true;
			document.getElementById("add-citation-dialog").width = "600";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.multipleSources");			
			window.sizeToContent();
			window.moveTo((window.screenX+75), window.screenY);
		}
	}
	
	function treeItemSelected() {
		if(_multipleSourcesOn) {
			// get selected item (from selectItemsDialog.js)
			var item = getSelectedItems(true);
			
			Zotero.debug(item);
			
			// if item has already been added, disable add button
			document.getElementById("citation-add").disabled = (!item.length || _itemLocators[item[0]] != undefined ? true : false);
		}
	}
	
	function listItemSelected() {
		var pagesBox = document.getElementById("item-locator");
		var locatorTypeBox = document.getElementById("item-locator-type");
		if(_lastSelected) {
			_itemLocators[_lastSelected.value] = pagesBox.value;
			_itemLocatorTypes[_lastSelected.value] = locatorTypeBox.selectedIndex;
		}
		
		var selectedListItem = document.getElementById("citation-list").getSelectedItem(0);
		
		if(selectedListItem) {
			document.getElementById("citation-delete").disabled = pagesBox.disabled = locatorTypeBox.disabled = false;
			pagesBox.value = _itemLocators[selectedListItem.value];
			locatorTypeBox.selectedIndex = _itemLocatorTypes[selectedListItem.value];
		} else {
			document.getElementById("citation-delete").disabled = pagesBox.disabled = locatorTypeBox.disabled = true;
			pagesBox.value = "";
			locatorTypeBox.selectedIndex = -1;
		}
		
		_lastSelected = selectedListItem;
	}
	
	function addCitation() {
		// get selected item (from selectItemsDialog.js)
		var item = getSelectedItems();
		item = item[0];
		var itemID = item.getID();
		
		// add to list
		var itemNode = document.createElement("listitem");
		itemNode.setAttribute("value", itemID);
		itemNode.setAttribute("label", item.getField("title"));
		itemNode.setAttribute("class", "listitem-iconic");
		itemNode.setAttribute("image", item.getImageSrc());
		document.getElementById("citation-list").appendChild(itemNode);
		
		// don't let someone select it again
		document.getElementById("citation-add").disabled = true;
		
		// flag
		_itemLocators[itemID] = document.getElementById("tree-locator").value;
		_itemLocatorTypes[itemID] = document.getElementById("tree-locator-type").selectedIndex;
		document.getElementById("tree-locator").value = "";
	}
	
	function deleteCitation() {
		var citationList = document.getElementById("citation-list");
		var selectedListItem = citationList.getSelectedItem(0);
		
		// remove from _itemLocators
		_itemLocators[selectedListItem.value] = _itemLocatorType[selectedListItem.value] = undefined;
		
		// remove from list
		citationList.removeChild(selectedListItem);
	}
	
	function accept() {
		// use to map selectedIndexes back to "p"/"g"/"l"
		var locatorTypeElements = document.getElementById("tree-locator-type").getElementsByTagName("menuitem");
		
		var io = window.arguments[0].wrappedJSObject;
		if(_multipleSourcesOn) {
			treeItemSelected();		// store locator info
			
			var citationList = document.getElementById("citation-list");
			var listLength = citationList.childNodes.length;
			
			if(listLength) {
				io.items = new Array();
				io.locatorTypes = new Array();
				io.locators = new Array();
				
				for(var i=0; i<listLength; i++) {
					var itemID = citationList.childNodes[i].value;
					io.items.push(itemID);
					io.locatorTypes.push(locatorTypeElements[_itemLocatorTypes[itemID]].value);
					io.locators.push(_itemLocators[itemID]);
				}
			}
		} else {
			// get selected item (from selectItemsDialog.js)
			io.items = getSelectedItems(true);
			
			if(io.items.length) {
				io.locatorTypes = new Array(document.getElementById("tree-locator-type").selectedItem.value);
				io.locators = new Array(document.getElementById("tree-locator").value);
			}
		}
	}
}