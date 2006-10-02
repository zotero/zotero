/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
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
		if(_multipleSourcesOn) {
			document.getElementById("multiple-sources").hidden = true;
			document.getElementById("add-citation-dialog").width = "600";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.multipleSources");			
			window.sizeToContent();
			window.moveTo((window.screenX+75), window.screenY);
		} else {
			document.getElementById("multiple-sources").hidden = undefined;
			document.getElementById("add-citation-dialog").width = "750";
			document.getElementById("multiple-sources-button").label = Zotero.getString("citation.singleSource");			
			window.sizeToContent();
			window.moveTo((window.screenX-75), window.screenY);
		}
		
		_multipleSourcesOn = !_multipleSourcesOn;
	}
	
	function treeItemSelected() {
		if(_multipleSourcesOn) {
			// get selected item (from selectItemsDialog.js)
			var item = getSelectedItems(true);
			
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
		itemNode.setAttribute("image", "chrome://zotero/skin/treeitem-"+Zotero.ItemTypes.getName(item.getType())+".png");
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
		var io = window.arguments[0];
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
					io.locatorTypes.push(_itemLocatorTypes[itemID]);
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