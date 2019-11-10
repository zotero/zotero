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

Components.utils.import("resource://gre/modules/Services.jsm");

var Zotero_Citation_Dialog = new function () {
	// Array value [0] is property name.
	// Array value [1] is default value of property.
	var _preserveData = {
		"prefix":["value", ""],
		"suffix":["value", ""],
		"label":["selectedIndex", 0],
		"locator":["value", ""],
		"suppress-author":["checked", false]
	};
	
	var _accepted = false;
	var _itemData = new Object();
	var _multipleSourcesOn = false;
	var _lastSelected = null;
	var _previewShown = false;
	var _suppressNextTreeSelect = false;
	var _suppressNextListSelect = false;
	var _customHTML = false;
	var _locatorIndexArray = {};
	var _locatorNameArray = {};
	var _autoRegeneratePref;
	var _acceptButton;
	var _multipleSourceButton;
	var _sortCheckbox;
	var _citationList;
	var _originalHTML;
	var serial_number;
	var io;
	
	this.toggleMultipleSources = toggleMultipleSources;
	this.toggleEditor = toggleEditor;
	this.treeItemSelected = treeItemSelected;
	this.listItemSelected = listItemSelected;
	this.up = up;
	this.down = down;
	this.remove = remove;
	this.setSortToggle = setSortToggle;
	this.confirmRegenerate = confirmRegenerate;
	this.accept = accept;
	this.cancel = cancel;
	
	/*
	 * initialize add citation dialog
	 */
	this.load = Zotero.Promise.coroutine(function* () {
		// make sure we are visible
		window.setTimeout(function() {
			var screenX = window.screenX;
			var screenY = window.screenY;
			var xRange = [window.screen.availLeft, window.screen.width-window.outerWidth];
			var yRange = [window.screen.availTop, window.screen.height-window.outerHeight];
			if(screenX < xRange[0] || screenX > xRange[1] || screenY < yRange[0] || screenY > yRange[1]) {
				var targetX = Math.max(Math.min(screenX, xRange[1]), xRange[0]);
				var targetY = Math.max(Math.min(screenY, yRange[1]), yRange[0]);
				Zotero.debug("Moving window to "+targetX+", "+targetY);
				window.moveTo(targetX, targetY);
			}
		}, 0);
		
		document.documentElement.getButton("extra1").label = Zotero.getString("citation.multipleSources");
		document.documentElement.getButton("extra2").label = Zotero.getString("citation.showEditor");
		
		io = window.arguments[0].wrappedJSObject;
		
		// find accept button
		_acceptButton = document.getElementById("zotero-add-citation-dialog").getButton("accept");
		_multipleSourceButton = document.documentElement.getButton("extra1");
		_autoRegeneratePref = Zotero.Prefs.get("integration.autoRegenerate");
		_citationList = document.getElementById("citation-list");
		
		// Manipulated by _addItem().  Discriminates between cite instances
		// based on the same item in the same citation.  Internal throwaway variable,
		// reset each time _multipleSourcesOn is set to true.
		serial_number = 0;

		// if a style with sortable citations, present checkbox
		if(io.sortable) {
			_sortCheckbox = document.getElementById("keepSorted");
			_sortCheckbox.hidden = false;
			_sortCheckbox.checked = !io.citation.properties.unsorted;
		}
		
		// load locators
		var locators = Zotero.Cite.labels;
		var menu = document.getElementById("label");
		var label_list = document.getElementById("locator-type-popup");
		var i = 0;
		for(var value in locators) {
			var locator = locators[value];
			var locatorLabel = Zotero.getString('citation.locator.'+locator.replace(/\s/g,''));
			// add to list of labels
			var child = document.createElement("menuitem");
			child.setAttribute("value", value);
			child.setAttribute("label", locatorLabel);
			label_list.appendChild(child);
			// add to array
			_locatorIndexArray[locator] = i;
			_locatorNameArray[i] = locator;
			i++;
		}
		menu.selectedIndex = 0;
		
		// load (from selectItemsDialog.js)
		yield doLoad();
		
		// if we already have a citation, load data from it
		document.getElementById('editor').format = "RTF";
		if(io.citation.citationItems.length) {
			if(io.citation.citationItems.length === 1) {
				// single citation
				toggleMultipleSources(false);
				_suppressNextTreeSelect = true;
				
				// DEBUG: When editing a citation before the library data has been loaded (i.e., in
				// Firefox before the pane has been opened), this is the citation id, not the item id,
				// and this fails. It works on subsequent attempts. Since this won't happen in
				// Standalone, we can ignore.
				var id = io.citation.citationItems[0].id;
				let selected = yield collectionsView.selectItem(id);
				
				for(var box in _preserveData) {
					var property = _preserveData[box][0];
					if(io.citation.citationItems[0][box]) {
						if(box === "label") {
							document.getElementById(box)[property] = _locatorIndexArray[io.citation.citationItems[0][box]];
						} else {
							document.getElementById(box)[property] = io.citation.citationItems[0][box];
						}
					}
				}
			} else {
				// multiple citations
				toggleMultipleSources(true);
				var _itemData = {};
				// There is a little thrashing here, with repeated writes and
				// overwrites of node content.  But sticking to the same
				// workflow for all updates (node -> array -> io.citation) makes
				// debugging a little less painful.
				for(var i=0; i<io.citation.citationItems.length; i++) {
					var item = Zotero.Items.get(io.citation.citationItems[i].id);
					if(item) {
						var itemNode = _addItem(item);
						var itemDataID = itemNode.getAttribute("value");
						_itemData[itemDataID] = {};
						for(var box in _preserveData) {
							var domBox = document.getElementById(box);
							var property = _preserveData[box][0];
							if("undefined" !== typeof io.citation.citationItems[i][box]) {
								if(box === "label") {
									domBox[property] = _locatorIndexArray[io.citation.citationItems[i][box]];
								} else {
									domBox[property] = io.citation.citationItems[i][box];
								}
							} else {
								domBox[property] = _preserveData[box][1];
							}
						}
						_itemSelected(itemDataID, true);
					}
				}
				for (var box in _preserveData) {
					document.getElementById(box).disabled = true;
				}
			}
			
			// show user-editable edited citation
			if(io.citation.properties.custom) {
				toggleEditor(io.citation.properties.custom);
				delete io.citation.properties.custom;
			}
			
			_updateAccept();
		} else {
			toggleMultipleSources(false);
		}
	});
	
	/*
	 * turn on/off multiple sources item list
	 */
	function toggleMultipleSources(mode) {
		if (mode === false || mode === true) {
			_multipleSourcesOn = !mode;
		}
		_multipleSourcesOn = !_multipleSourcesOn;
		var popup = document.defaultView;
		var dialog = document.getElementById("zotero-add-citation-dialog");
		if (dialog.getAttribute("height") == 1) {
			 popup.sizeToContent();
		}
		if(_multipleSourcesOn) {
			_multipleSourceButton.label = Zotero.getString("citation.singleSource");
			document.getElementById("multiple-sources").setAttribute("hidden", false);
			if(dialog.getAttribute("width") <= 600) {
				popup.resizeTo(750, dialog.getAttribute("height"));
			}
			//popup.moveBy((600 - 750)/2, 0);

			serial_number = 0;


			// The mode is forced only when run from load(), in which case
			// the adding of items is done separately.
			if (mode !== true) {
				this.add(true);
			}
		} else {
			_multipleSourceButton.label = Zotero.getString("citation.multipleSources");
			document.getElementById("multiple-sources").setAttribute("hidden", true);
			//popup.resizeTo(600, dialog.getAttribute("height"));
			//popup.moveBy((750 - 600)/2, 0);
			
			// enable all fields
			for(var box in _preserveData) {
				document.getElementById(box).disabled = false;
			}
			
			var itemID = false;
			if (_citationList.selectedIndex > -1) {
				var itemDataID = _citationList.getSelectedItem(0).getAttribute("value");
				itemID = itemDataID.slice(0, itemDataID.indexOf(":"));
			}

			// delete item list
			_itemData = new Object();
			
			// delete all items
			_clearCitationList();

			// refresh
			if (itemID) {
				collectionsView.selectItem(itemID);
			}
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
		var items = itemsView.getSelectedItems(true); // treeview from xpcom/itemTreeView.js
		var itemID = (items.length ? items[0] : false);
		
		if(_multipleSourcesOn) {
			// We can safely use itemID here, because none of these operations
			// affect selected items; this is all about the tree and navigation.

			// turn off highlight in selected item list
			_suppressNextListSelect = true;
			document.getElementById("citation-list").selectedIndex = -1;

			// disable all fields

			for(var box in _preserveData) {
				document.getElementById(box).disabled = true;
			}

			// disable adding nothing
			document.getElementById("add").disabled = !itemID;
			document.getElementById("remove").disabled = true;
			document.getElementById("up").disabled = true;
			document.getElementById("down").disabled = true;
		} else {
			for(var box in _preserveData) {
				document.getElementById(box).disabled = !itemID;
			}
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
		var itemDataID = (selectedListItem ? selectedListItem.getAttribute("value") : false);
		_itemSelected(itemDataID);
		// turn off highlight in item tree
		_suppressNextTreeSelect = true;
		document.getElementById("zotero-items-tree").view.selection.clearSelection();
		document.getElementById("remove").disabled = !itemDataID;
		document.getElementById("add").disabled = true;
		_configListPosition(!itemDataID, selectedListIndex);
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
			setSortToggle();
		}
		
		var insertBeforeItem;
		var selectedListItem = _citationList.getSelectedItem(0);
		var selectedListIndex = _citationList.selectedIndex;
		var itemDataID = selectedListItem.getAttribute("value");
		if (direction === -1) {
			insertBeforeItem = selectedListItem.previousSibling;
		} else {
			insertBeforeItem = selectedListItem.nextSibling.nextSibling;
		}
		var listItem = _citationList.removeChild(selectedListItem);
		_citationList.insertBefore(listItem, insertBeforeItem);
		_citationList.selectedIndex = (selectedListIndex + direction);
		_itemSelected(itemDataID);
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
	 * Adds an item to the multipleSources list
	 */
	this.add = Zotero.Promise.coroutine(function* (first_item) {
		
		var pos, len;
		var item = itemsView.getSelectedItems()[0]; // treeview from xpcom/itemTreeView.js
		
		if (!item) {
			yield sortCitation();
			_updateAccept();
			_updatePreview();
			return;
		}

		// Add to selection list and generate a new itemDataID for this cite.
		var selectionNode = _addItem(item);
		var itemDataID = selectionNode.getAttribute("value");
		document.getElementById("add").disabled = !itemDataID;

		// Save existing locator and affix field content, if any.
		if (first_item) {
			_itemSelected(itemDataID, true);
		} else {
			_itemSelected();
			// set to defaults
			for(var box in _preserveData) {
				var property = _preserveData[box][0];
				var default_value = _preserveData[box][1];
				document.getElementById(box)[property] = default_value;
			}
			// Save default locator and affix element values to this multi-item.
			_itemSelected(itemDataID, true);
		}

		for(var box in _preserveData) {
			document.getElementById(box).disabled = true;
		}

		_citationList.ensureElementIsVisible(selectionNode);

		// allow user to press OK
		selectionNode = yield sortCitation(selectionNode);
		_citationList.selectItem(selectionNode);
		_updateAccept();
		_updatePreview();
	});
	
	/*
	 * Deletes a citation from the multipleSources list
	 */
	function remove() {
		var selectedListItem = _citationList.getSelectedItem(0);
		var selectedListIndex = _citationList.selectedIndex;
		var itemDataID = selectedListItem.getAttribute("value");
		
		// remove from _itemData
		delete _itemData[itemDataID];
		_itemData[itemDataID] = undefined;
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
	 * Sorts preview citations, if preview is open.
	 */
	this.citationSortUnsort = Zotero.Promise.coroutine(function* () {
		setSortToggle();
		yield sortCitation();
		_updatePreview();
	});

	/*
	 * Sets the current sort toggle state persistently on the citation.
	 */
	function setSortToggle() {
		if(!_sortCheckbox) return;
		if(!_sortCheckbox.checked) {
			io.citation.properties.unsorted = true;
		} else {
			io.citation.properties.unsorted = false;
		}
		return;
	}

	/*
	 * Sorts the list of citations
 	 */
	var sortCitation = Zotero.Promise.coroutine(function* (scrollToItem) {
 		if(!_sortCheckbox) return scrollToItem;
 		if(!_sortCheckbox.checked) {
 			io.citation.properties.unsorted = true;
 			return scrollToItem;
 		}
		var scrollToItemID = false;
		if (scrollToItem) {
			scrollToItemID = scrollToItem.getAttribute("value");
		}
		_getCitation();
		
		// delete all existing items from list
		_clearCitationList();
		
		// run preview function to re-sort, if it hasn't already been
		// run
		yield io.sort();
		
		// add items back to list
		scrollToItem = null;
		for(var i=0; i<io.citation.sortedItems.length; i++) {
			var itemID = io.citation.sortedItems[i][0].id;
			var itemDataID = io.citation.sortedItems[i][1].tmpItemDataID;
			var item = Zotero.Items.get(itemID);
			// Don't increment serial_number, and use the
			// existing itemDataID stored on the item in sortedItems
			var itemNode = _addItem(item, itemDataID);
			if(itemDataID == scrollToItemID) _citationList.selectedIndex = i;
			if(scrollToItemID && itemDataID == scrollToItemID) scrollToItem = itemNode;
		}
		
		if(scrollToItem) _citationList.ensureElementIsVisible(scrollToItem);
		return scrollToItem;
	});
	
	/*
	 * Ask whether to modify the preview
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
			if (!text && _customHTML) {
				text = _customHTML;
			}
			if(text) {
				io.preview().then(function(preview) {
					_originalHTML = preview;
					editor.value = text;
				}).done();
			} else {
				_updatePreview();
			}
		} else {
			if (editor.initialized) {
				if (editor.value) {
					_customHTML = editor.value;
				}
			}
			document.documentElement.getButton("extra2").label = Zotero.getString("citation.showEditor");		
		}
	}
	
	/*
	 * called when accept button is clicked
	 */
	function accept() {
		if(_accepted) return true;

		_getCitation();
		var isCustom = _previewShown && io.citation.citationItems.length	// if a citation is selected
				&& _originalHTML
				&& document.getElementById('editor').value != _originalHTML	// and citation has been edited
		
		if(isCustom) {	
			var citation = document.getElementById('editor').value;
			if(Zotero.Utilities.trim(citation) == "") {				
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Components.interfaces.nsIPromptService);
				var insert = promptService.confirm(window,
					Zotero.getString("integration.emptyCitationWarning.title"),
					Zotero.getString("integration.emptyCitationWarning.body"));
				if(!insert) return false;
			}
			io.citation.properties.custom = citation;
		}
		
		if (io.citation.citationItems.length) {
			for (let item of io.citation.citationItems) {
				if (Zotero.Retractions.isRetracted({ id: parseInt(item.id) })) {
					if (Zotero.Retractions.shouldShowCitationWarning({ id: parseInt(item.id) })) {
						var ps = Services.prompt;
						var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
							+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
							+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
						var checkbox = { value: false };
						var result = ps.confirmEx(null,
							Zotero.getString('general.warning'),
							Zotero.getString('retraction.citeWarning.text1') + '\n\n'
								+ Zotero.getString('retraction.citeWarning.text2'),
							buttonFlags,
							Zotero.getString('general.continue'),
							null,
							Zotero.getString('pane.items.showItemInLibrary'),
							Zotero.getString('retraction.citationWarning.dontWarn'), checkbox);
						if (result > 0) {
							if (result == 2) {
								_showItemInLibrary(parseInt(item.id));
							}
							return false;
						}
						if (checkbox.value) {
							Zotero.Retractions.disableCitationWarningsForItem({ id: parseInt(item.id) });
						}
					}
					item.ignoreRetraction = true;
				}
			}
		}
		
		io.accept();
		_accepted = true;
		return true;
	}
	
	/*
	 * called when cancel button is clicked
	 */
	function cancel() {
		if(_accepted) return true;
		io.citation.citationItems = new Array();

		io.accept();
		_accepted = true;
		return true;
	}
	
	/*
	 * Updates the contents of the preview pane
	 */
	function _updatePreview() {
		if(_previewShown) {
			var editor = document.getElementById('editor');
			_getCitation();
			
			editor.readonly = !io.citation.citationItems.length;
			if(io.citation.citationItems.length) {
				io.preview().then(function(preview) {
					editor.value = preview;
					
					if (editor.initialized) {
						_originalHTML = editor.value;
					}
					else {
						editor.onInit(() => _originalHTML = editor.value);
					}
				});
			} else {
				editor.value = "";
				_originalHTML = "";
			}
		}
	}
	
	/*
	 * Controls whether the accept (OK) button should be enabled
	 */
	function _updateAccept() {
		if(_multipleSourcesOn) {
			_acceptButton.disabled = !_citationList.getRowCount();
			// To prevent accidental data loss, do not allow change to
			// single citation mode if multiple items are in selection
			// list.
			if (_citationList.getRowCount() > 1) {
				_multipleSourceButton.disabled = true;
			} else {
				_multipleSourceButton.disabled = false;
			}
		} else {
			collectionsView.onLoad.addListener(Zotero.Promise.coroutine(function* () {
				if (itemsView) {
					yield itemsView.waitForLoad();
					_acceptButton.disabled = !itemsView.getSelectedItems().length;
				}
			}));
		}
	}
	
	/*
	 * called when an item is selected; if itemDataID is false, disables fields; if
	 * itemDataID is undefined, only updates _itemData array
	 *
	 * Note: This function no longer disables fields.  That operation is
	 * now performed separately by explicit code.
	 */
	function _itemSelected(itemDataID, forceSave) {

		if (forceSave) {
			_lastSelected = itemDataID;
		}

		if(_lastSelected && !_itemData[_lastSelected]) {
			_itemData[_lastSelected] = new Object();
		}
		
		for(var box in _preserveData) {
			var domBox = document.getElementById(box);
			var property = _preserveData[box][0];
			
			// save property
			if(_lastSelected) {
				if(property == "label") {
					_itemData[_lastSelected][box] = _locatorNameArray[domBox.selectedIndex];
				} else {
					_itemData[_lastSelected][box] = domBox[property];
				}
			}
			// restore previous property
			if(itemDataID) {
				domBox.disabled = false;
				if(_itemData[itemDataID] && _itemData[itemDataID][box] !== undefined) {
					if(property == "label") {
						domBox[property] = _locatorIndexArray[_itemData[itemDataID][box]];
					} else {
						domBox[property] = _itemData[itemDataID][box];
					}
				}
			}
		}
		
		if(itemDataID !== undefined) _lastSelected = itemDataID;
	}
	
	/*
	 * updates io.citation to reflect selected items
	 */
	function _getCitation() {
		var key;
		io.citation.citationItems = new Array();
		
		// use to map selectedIndexes back to page/paragraph/line
		var locatorTypeElements = document.getElementById("label").getElementsByTagName("menuitem");
		if(_multipleSourcesOn) {
			_itemSelected();		// store locator info
			var listLength = _citationList.getRowCount();
			if(listLength) {
				// generate citationItems
				for(var i=0; i<listLength; i++) {
					var itemDataID = _citationList.getItemAtIndex(i).getAttribute("value");
					var citationItem = {};
					for (key in _itemData[itemDataID]) {
						// label is special everywhere
						if (key === "label") {
							citationItem.label = _locatorNameArray[_itemData[itemDataID].label];
						} else if (_itemData[itemDataID][key]) {
							citationItem[key] = _itemData[itemDataID][key];
						}
					}
					citationItem["tmpItemDataID"] = itemDataID;
					var itemID = itemDataID.slice(0, itemDataID.indexOf(":"));
					citationItem.id = itemID;
					io.citation.citationItems.push(citationItem);
				}
			}
		} else {
			var items = itemsView.getSelectedItems(true); // treeview from xpcom/itemTreeView.js
			
			if(items.length) {
				var citationItem = {};
				citationItem.id = items[0];
				for(var box in _preserveData) {
					var property = _preserveData[box][0];
					if(box == "label") {
						citationItem[box] = _locatorNameArray[document.getElementById(box).selectedIndex];
					} else {
						var prop = document.getElementById(box)[property];
						if(prop !== "" && prop !== false) citationItem[box] = prop;
					}
				}
				
				if(!citationItem["locator"]) {
					delete citationItem["locator"];
					delete citationItem["label"];
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
	function _addItem(item, forceID) {
		var itemNode = document.createElement("listitem");

		var itemDataID;
		if (!forceID) {
			serial_number += 1;
			itemDataID = item.id + ":" + serial_number;
		} else {
			itemDataID = forceID;
		}

		itemNode.setAttribute("value", itemDataID);
		itemNode.setAttribute("label", item.getDisplayTitle());
		itemNode.setAttribute("class", "listitem-iconic");
		itemNode.setAttribute("image", item.getImageSrc());
		_citationList.appendChild(itemNode);
		return itemNode;
	}
	
	/*
	 * Removes all items from the multiple sources list
	 */
	function _clearCitationList() {
		while(_citationList.firstChild) _citationList.removeChild(_citationList.firstChild);
	}
	
	async function _showItemInLibrary(id) {
		var pane = Zotero.getActiveZoteroPane();
		// Open main window if it's not open (Mac)
		if (!pane) {
			let win = Zotero.openMainWindow();
			await new Zotero.Promise((resolve) => {
				let onOpen = function () {
					win.removeEventListener('load', onOpen);
					resolve();
				};
				win.addEventListener('load', onOpen);
			});
			pane = win.ZoteroPane;
		}
		pane.selectItem(id);
		
		// Pull window to foreground
		Zotero.Utilities.Internal.activate(pane.document.defaultView);
	}
}
