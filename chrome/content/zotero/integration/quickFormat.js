/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
Services.scriptloader.loadSubScript("chrome://zotero/content/customElements.js", this);

var Zotero_QuickFormat = new function () {
	const pixelRe = /^([0-9]+)px$/
	const specifiedLocatorRe = /^(?:,? *(p{1,2})(?:\. *| *)|:)([0-9\-–]+) *$/;
	const yearRe = /,? *([0-9]+(?: *[-–] *[0-9]+)?) *(B[. ]*C[. ]*(?:E[. ]*)?|A[. ]*D[. ]*|C[. ]*E[. ]*)?$/i;
	const locatorRe = / (?:,? *(p{0,2})\.?|(\:)) *([0-9\-–]+)$/i;
	const creatorSplitRe = /(?:,| *(?:and|\&)) +/;
	const charRe = /[\w\u007F-\uFFFF]/;
	const numRe = /^[0-9\-–]+$/;
	
	var initialized, io, editor, dialog, qfGuidance,
		keepSorted, showEditor, referencePanel, referenceBox,
		currentLocator, currentLocatorLabel, currentSearchTime, bubbleDraggedIndex = null,
		itemPopover, itemPopoverPrefix, itemPopoverSuffix, itemPopoverSuppressAuthor, itemPopoverLocatorLabel, itemPopoverLocator,
		panelLibraryLink, panelInfo, panelRefersToBubble, panelFrameHeight = 0, accepted = false,
		isPaste = false, _itemPopoverClosed, skipInputRefocus;
	var locatorNode = null;
	var _searchPromise;
	
	var _lastFocusedInput = null;
	var _bubbleMouseDown = false;

	const ITEM_LIST_MAX_ITEMS = 50;
	const SEARCH_TIMEOUT = 250;
	const SHOWN_REFERENCES = 7;
	const WINDOW_WIDTH = 800;
	const ESC_ENTER_THROTTLE = 1000;

	/**
	 * Pre-initialization, when the dialog has loaded but has not yet appeared
	 */
	this.onDOMContentLoaded = function(event) {
		if(event.target === document) {
			initialized = true;
			io = window.arguments[0].wrappedJSObject;

			Zotero.debug(`Quick Format received citation:`);
			Zotero.debug(JSON.stringify(io.citation.toJSON()));
			
			if (io.disableClassicDialog) {
				document.getElementById('classic-view').hidden = true;
			}
			
			// Only hide chrome on Windows or Mac
			if(Zotero.isMac) {
				document.documentElement.setAttribute("drawintitlebar", true);
			}
	
			// Required for dragging to work on windows.
			// These values are important and changing them may affect how the dialog
			// is rendered
			if (Zotero.isWin) {
				document.documentElement.setAttribute('chromemargin', '0,0,15,0');
			}

			// Hide chrome on linux and explcitly make window unresizable
			if (Zotero.isLinux) {
				document.documentElement.setAttribute("resizable", false);
				document.documentElement.setAttribute("hidechrome", true);
			}

			dialog = document.querySelector(".citation-dialog.entry");
			editor = document.querySelector(".citation-dialog.editor");
			_resizeEditor();
			dialog.addEventListener("click", _onQuickSearchClick, false);
			dialog.addEventListener("keypress", _onQuickSearchKeyPress, false);
			editor.addEventListener("dragover", _onEditorDragOver);
			editor.addEventListener("drop", _onEditorDrop, false);
			referencePanel = document.querySelector(".citation-dialog.reference-panel");
			referenceBox = document.querySelector(".citation-dialog.reference-list");
			// Navigation within the reference panel
			referenceBox.addEventListener("keypress", (event) => {
				// Enter or ; selects the reference
				if ((event.key == "Enter" && !event.shiftKey) || event.charCode == 59) {
					event.preventDefault();
					event.stopPropagation();
					Zotero_QuickFormat._bubbleizeSelected();
				}
				// Tab will move focus back to the input field
				else if (event.key === "Tab") {
					event.preventDefault();
					event.stopPropagation();
					_lastFocusedInput.focus();
				}
				// Can keep typing from the reference box
				else if (isKeypressPrintable(event) || event.key === 'Backspace') {
					event.preventDefault();
					if (event.key === 'Backspace') {
						_lastFocusedInput.value = _lastFocusedInput.value.slice(0, -1);
					}
					else {
						_lastFocusedInput.value += event.key;
					}
					_lastFocusedInput.dispatchEvent(new Event('input', { bubbles: true }));
					_lastFocusedInput.focus();
				}
				else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
					event.preventDefault();
					event.stopPropagation();
					// ArrowUp from first item focuses the input
					if (event.key == "ArrowUp" && referenceBox.selectedIndex == 1 && referenceBox.selectedItem == document.activeElement) {
						_lastFocusedInput.focus();
						referenceBox.selectedIndex = -1;
					}
					else {
						handleItemSelection(event);
					}
				}
				// Right/Left arrow will hide ref panel and move focus to the previour/next element
				else if (event.key == Zotero.arrowPreviousKey) {
					_lastFocusedInput.focus();
					moveFocusBack(_lastFocusedInput);
				}
				else if (event.key == Zotero.arrowNextKey) {
					_lastFocusedInput.focus();
					moveFocusForward(_lastFocusedInput);
				}
			});
			referenceBox.addEventListener("click", (e) => {
				let item = e.target.closest("richlistitem");
				if (!item || e.button !== 0 || item.disabled) return;

				let mouseMultiSelect = e.shiftKey || (Zotero.isMac && e.metaKey) || (!Zotero.isMac && e.ctrlKey);
				let multipleSelected = referenceBox.selectedCount > 1;
				let isItemSelected = [...referenceBox.selectedItems].findIndex(node => node == item) !== -1;
				// Click without multiselect modifier will confirm the selection
				if (!mouseMultiSelect) {
					// If item is multi-selected, do not discard the selection
					if (multipleSelected && isItemSelected) {
						e.preventDefault();
					}
					Zotero_QuickFormat._bubbleizeSelected();
					return;
				}
				// Make sure there is a selected item when shift-click is handled
				if (e.shiftKey && referenceBox.selectedCount < 1) {
					_selectFirstReference();
				}
				// Shift-Click selects a range starting from _selectionStart
				// https://searchfox.org/mozilla-central/source/toolkit/content/widgets/richlistbox.js#469
				// which is not be always correct after selecting and un-selecting items
				// with a few cmd/ctrl-clicks. To achieve a more consistent behavior, reset _selectionStart
				// to be the first or last selected node, depending on which item is clicked.
				let allItems = [...referenceBox.childNodes];
				let firstSelectedIndex = allItems.findIndex(node => node == referenceBox.querySelector("[selected=true]"));
				let clickedItemIndex = allItems.findIndex(node => node == item);
				let allSelected = [...referenceBox.querySelectorAll("[selected=true]")];
				if (clickedItemIndex < firstSelectedIndex) {
					referenceBox._selectionStart = allSelected[allSelected.length - 1];
				}
				else {
					referenceBox._selectionStart = allSelected[0];
				}
				// Shift-click can end up selecting disabled separator, so make sure it's removed
				setTimeout(() => {
					let selectedSeparators = [...document.querySelectorAll("richlistitem[disabled='true'][selected='true']")];
					for (let node of selectedSeparators) {
						referenceBox.removeItemFromSelection(node);
					}
				});
			}, true);
			if (Zotero.isWin) {
				if (Zotero.Prefs.get('integration.keepAddCitationDialogRaised')) {
					dialog.setAttribute("square", "true");
				}
			}
			
			keepSorted = document.getElementById("keep-sorted");
			showEditor = document.getElementById("show-editor");
			if(keepSorted && io.sortable) {
				keepSorted.hidden = false;
				if(!io.citation.properties.unsorted) {
					keepSorted.setAttribute("checked", "true");
				}
			}
			// Make icon focusable only if there's a visible menuitem
			for (let menuitemID of ["keep-sorted", "show-editor", "classic-view"]) {
				let menuitem = document.getElementById(menuitemID);
				if (menuitem && menuitem.getAttribute("hidden") != "true") {
					document.getElementById("zotero-icon").removeAttribute("disabled");
					document.getElementById("input-description").setAttribute("data-l10n-args", `{ "dialogMenu":"active"}`);
				}
			}
			// Nodes for citation properties panel
			itemPopover = document.getElementById("citation-properties");
			if (itemPopover) {
				itemPopoverPrefix = document.getElementById("prefix");
				itemPopoverSuffix = document.getElementById("suffix");
				itemPopoverSuppressAuthor = document.getElementById("suppress-author");
				itemPopoverLocatorLabel = document.getElementById("locator-label");
				itemPopoverLocator = document.getElementById("locator");
				panelInfo = document.getElementById("citation-properties-info");
				panelLibraryLink = document.getElementById("citation-properties-library-link");

				// add labels to popup
				var locators = Zotero.Cite.labels;
				var labelList = document.getElementById("locator-label-popup");
				for(var locator of locators) {
					let locatorLabel = Zotero.Cite.getLocatorString(locator);

					// add to list of labels
					var child = document.createXULElement("menuitem");
					child.setAttribute("value", locator);
					child.setAttribute("label", locatorLabel);
					labelList.appendChild(child);
				}
				// If the focus leaves the citation properties panel, close it
				itemPopover.addEventListener("focusout", (_) => {
					setTimeout(() => {
						if (!itemPopover.contains(document.activeElement)) {
							itemPopover.hidePopup();
						}
					});
				});
				// Focus locator when popover appears
				itemPopover.addEventListener("popupshown", (e) => {
					if (e.target.id == "citation-properties") {
						document.getElementById('locator').focus();
					}
				});
			}
			
			// Don't need to set noautohide dynamically on these platforms, so do it now
			if(Zotero.isMac || Zotero.isWin) {
				referencePanel.setAttribute("noautohide", true);
			}

			// Resize whenever a bubble/input is added or removed of their attributes change
			let resizeObserver = new MutationObserver(function (_) {
				// Due to very odd mozilla behavior, calls to resize the window when
				// dragging is happening make the next drag events after resize
				// act strange (dragging doesn't happen, though dragstart fires but dragend doesn't)
				// Resizing after delay in _onEditorDrop seems to not cause this issue
				if (bubbleDraggedIndex === null) {
					_resizeWindow();
				}
			});
			resizeObserver.observe(editor, { childList: true, subtree: true, attributes: true });
		}
	};
	
	/**
	 * Initialize add citation dialog
	 */
	this.onLoad = async function (event) {
		try {
			if (event.target !== document) return;
			// make sure we are visible
			let resizePromise = (async function () {
				let screenX = window.screenX, screenY = window.screenY, i = 5;
				while (!screenX && i--) {
					await new Promise(resolve => window.requestAnimationFrame(resolve));
					screenX = window.screenX;
					screenY = window.screenY;
				}
				var xRange = [window.screen.availLeft, window.screen.left + window.screen.width - window.outerWidth];
				var yRange = [window.screen.availTop, window.screen.top + window.screen.height - window.outerHeight];
				if (screenX < xRange[0] || screenX > xRange[1] || screenY < yRange[0] || screenY > yRange[1]) {
					var targetX = Math.max(Math.min(screenX, xRange[1]), xRange[0]);
					var targetY = Math.max(Math.min(screenY, yRange[1]), yRange[0]);
					Zotero.debug(`Moving window to ${targetX}, ${targetY}`);
					window.moveTo(targetX, targetY);
				}
				qfGuidance = document.querySelector('.citation-dialog.guidance');
				qfGuidance && qfGuidance.show();
			})();
			
			// load citation data
			if (io.citation.citationItems.length) {
				await resizePromise;
				_showCitation(null);
			}
			requestAnimationFrame(() => {
				_updateItemList({ citedItems: [] });
			});
			refocusInput();
			_initWindowDragTracker();
		}
		catch (e) {
			Zotero.logError(e);
		}
	};

	// If this input field was counted as previously focused,
	// it will be cleared. Call before removing the field
	function clearLastFocused(input) {
		if (input == _lastFocusedInput) {
			_lastFocusedInput = null;
		}
	}

	// Create input in the end of the editor and focus it
	function addInputToTheEnd() {
		let newInput = _createInputField();
		editor.appendChild(newInput);
		newInput.focus();
		return newInput;
	}

	// Return the focus to the input.
	// If tryLastFocused=true, try to focus on the last active input first.
	// Then, try to focus the last input from the editor.
	// If there are no inputs, append one to the end and focus that.
	function refocusInput(tryLastFocused = true) {
		let input = tryLastFocused ? _lastFocusedInput : null;
		if (!input) {
			let allInputs = editor.querySelectorAll(".zotero-bubble-input");
			if (allInputs.length > 0) {
				input = allInputs[allInputs.length - 1];
			}
		}
		if (!input) {
			input = addInputToTheEnd();
		}
		input.focus();
		return input;
	}

	function _createInputField() {
		let newInput = document.createElement("input");
		newInput.className = "zotero-bubble-input";
		newInput.setAttribute("aria-describedby", "input-description");
		newInput.setAttribute("dir", Zotero.rtl ? "rtl" : "auto");
		newInput.addEventListener("input", (_) => {
			_resetSearchTimer();
			// Expand/shrink the input field to match the width of content
			let width = getContentWidth(newInput);
			newInput.style.width = width + 'px';
		});
		newInput.addEventListener("keypress", onInputPress);
		newInput.addEventListener("paste", _onPaste, false);
		newInput.addEventListener("focus", (_) => {
			// If the input used for the last search run is refocused,
			// just make sure the reference panel is opened if it has items.
			if (_lastFocusedInput == newInput && referenceBox.childElementCount > 0) {
				_openReferencePanel();
				return;
			}
			// Otherwise, run the search if the input is non-empty.
			if (!isInputEmpty(newInput)) {
				_resetSearchTimer();
			}
			else {
				_updateItemList({ citedItems: [] });
			}
		});
		// Delete empty input on blur unless focus is inside of the reference panel
		newInput.addEventListener("blur", (_) => {
			// Timeout to know where the focus landed after
			setTimeout(() => {
				let refPanelFocused = referencePanel.contains(document.activeElement);
				if (isInputEmpty(newInput) && !refPanelFocused) {
					// Resizing window right before drag-drop reordering starts, will interrupt the
					// drag event. To avoid it, hide the input immediately and delete it after delay.
					if (_bubbleMouseDown) {
						newInput.style.display = "none";
						setTimeout(() => {
							newInput.remove();
						}, 500);
						clearLastFocused(newInput);
					}
					else if (document.activeElement !== newInput && !isEditorCleared()) {
						// If no dragging, delete it if focus has moved elsewhere.
						// If focus remained, the entire dialog lost focus, so do nothing
						// If this is the last, non-removable, input - do not remove it as well.
						newInput.remove();
						clearLastFocused(newInput);
					}
				}
				// If focus leaves input, hide the reference panel.
				if (refPanelFocused) {
					return;
				}
				let focusedInput = _getCurrentInput();
				if (!focusedInput) {
					referencePanel.hidePopup();
				}
			});
			// If there was a br added before input so that it doesn't appear on the previous line,
			// remove it
			if (newInput.previousElementSibling?.tagName == "br") {
				newInput.previousElementSibling.remove();
			}
			locatorNode = null;
		});
		return newInput;
	}

	// Theoritically, we can have two inputs next to each other. For example,
	// if a bubble between two inputs is deleted. In this case,
	// combine two inputs into one.
	function _combineNeighboringInputs() {
		let node = editor.firstChild;
		while (node && node.nextElementSibling) {
			if (node.classList == "zotero-bubble-input"
				&& node.nextElementSibling.classList == "zotero-bubble-input") {
				let secondInputValue = node.nextElementSibling.value;
				node.value += ` ${secondInputValue}`;
				node.dispatchEvent(new Event('input', { bubbles: true }));
				// Make sure focus is not lost when two inputs are combined
				if (node.nextElementSibling == document.activeElement) {
					node.focus();
				}
				node.nextElementSibling.remove();
			}
			node = node.nextElementSibling;
		}
	}
	

	/**
	 * Updates currentLocator based on a string
	 * @param {String} str String to search for locator
	 * @return {String} str without locator
	 */
	function _updateLocator(str) {
		m = !isPaste && locatorRe.exec(str);
		if(m && (m[1] || m[2] || m[3].length !== 4) && m.index > 0) {
			currentLocator = m[3];
			str = str.substr(0, m.index)+str.substring(m.index+m[0].length);
		}
		return str;
	}

	/**
	 * Does the dirty work of figuring out what the user meant to type
	 */
	var _quickFormat = Zotero.Promise.coroutine(function* () {
		var str = _getEditorContent();
		var haveConditions = false;
		
		const etAl = " et al.";
		
		var m,
			year = false,
			isBC = false,
			dateID = false;
		
		currentLocator = false;
		currentLocatorLabel = false;
		
		// check for adding a number onto a previous page number
		if (locatorNode && numRe.test(str)) {
			// add to previous cite
			let citationItem = JSON.parse(locatorNode && locatorNode.dataset.citationItem || "null");
			if (citationItem) {
				if (!("locator" in citationItem)) {
					citationItem.locator = "";
				}
				citationItem.locator += str;
				locatorNode.dataset.citationItem = JSON.stringify(citationItem);
				locatorNode.textContent = _buildBubbleString(citationItem);
				_clearEntryList();
				let input = _getCurrentInput();
				input.value = "";
				input.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}
		}
		
		if(str && str.length > 1) {
			// check for specified locator
			m = specifiedLocatorRe.exec(str);
			if(m) {
				if(m.index === 0) {
					// add to previous cite
					let node = _getCurrentInput();
					var prevNode = locatorNode || node.previousElementSibling;
					let citationItem = JSON.parse(prevNode && prevNode.dataset.citationItem || "null");
					if (citationItem) {
						citationItem.locator = m[2];
						citationItem.label = "page";
						prevNode.dataset.citationItem = JSON.stringify(citationItem);
						prevNode.textContent = _buildBubbleString(citationItem);
						_clearEntryList();
						let input = _getCurrentInput();
						input.value = "";
						input.dispatchEvent(new Event('input', { bubbles: true }));
						return;
					}
				}
				
				// TODO support types other than page
				currentLocator = m[2];
				str = str.substring(0, m.index);
			}

			str = _updateLocator(str);
			// check for year and pages
			m = yearRe.exec(str);
			if(m) {
				year = parseInt(m[1]);
				isBC = m[2] && m[2][0] === "B";
				str = str.substr(0, m.index)+str.substring(m.index+m[0].length);
			}
			if(year) str += " "+year;
			
			var s = new Zotero.Search();
			str = str.replace(/ (?:&|and) /g, " ", "g");
			str = str.replace(/^,/, '');
			if(charRe.test(str)) {
				Zotero.debug("QuickFormat: QuickSearch: "+str);
				// Exclude feeds
				Zotero.Feeds.getAll()
					.forEach(feed => s.addCondition("libraryID", "isNot", feed.libraryID));
				if (Zotero_QuickFormat.citingNotes) {
					s.addCondition("quicksearch-titleCreatorYearNote", "contains", str);
				}
				else {
					s.addCondition("quicksearch-titleCreatorYear", "contains", str);
					s.addCondition("itemType", "isNot", "attachment");
					if (io.filterLibraryIDs) {
						io.filterLibraryIDs.forEach(id => s.addCondition("libraryID", "is", id));
					}
				}
				haveConditions = true;
			}
		}
		
		if (!haveConditions && Zotero_QuickFormat.citingNotes) {
			s = new Zotero.Search();
			str = "";
			s.addCondition("quicksearch-titleCreatorYearNote", "contains", str);
			haveConditions = true;
		}
		
		if (haveConditions) {
			var searchResultIDs = (haveConditions ? (yield s.search()) : []);
			
			// Show items list without cited items to start
			yield _updateItemList({ searchString: str, searchResultIDs });
			
			// Check to see which search results match items already in the document
			var citedItems, completed = !!Zotero_QuickFormat.citingNotes, isAsync = false;
			// Save current search time so that when we get items, we know whether it's too late to
			// process them or not
			var lastSearchTime = currentSearchTime = Date.now();
			// This may or may not be synchronous
			if (!Zotero_QuickFormat.citingNotes) {
				io.getItems().then(function(citedItems) {
					// Don't do anything if panel is already closed
					if(isAsync &&
							((referencePanel.state !== "open" && referencePanel.state !== "showing")
							|| lastSearchTime !== currentSearchTime)) return;
					
					completed = true;
					
					if(str.toLowerCase() === Zotero.getString("integration.ibid").toLowerCase()) {
						// If "ibid" is entered, show all cited items
						citedItemsMatchingSearch = citedItems;
					} else {
						Zotero.debug("Searching cited items");
						// Search against items. We do this here because it's possible that some of these
						// items are only in the doc, and not in the DB.
						var splits = Zotero.Fulltext.semanticSplitter(str),
							citedItemsMatchingSearch = [];
						for(var i=0, iCount=citedItems.length; i<iCount; i++) {
							// Generate a string to search for each item
							let item = citedItems[i];
							let itemStr = item.getCreators()
								.map(creator => creator.firstName + " " + creator.lastName)
								.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)])
								.join(" ");
							
							// See if words match
							for(var j=0, jCount=splits.length; j<jCount; j++) {
								var split = splits[j];
								if(itemStr.toLowerCase().indexOf(split) === -1) break;
							}
							
							// If matched, add to citedItemsMatchingSearch
							if(j === jCount) citedItemsMatchingSearch.push(item);
						}
						Zotero.debug("Searched cited items");
					}
					
					_updateItemList({
						citedItems,
						citedItemsMatchingSearch,
						searchString: str,
						searchResultIDs,
						preserveSelection: isAsync
					});
				});
			}
			
			if(!completed) {
				// We are going to have to wait until items have been retrieved from the document.
				Zotero.debug("Getting cited items asynchronously");
				isAsync = true;
			} else {
				Zotero.debug("Got cited items synchronously");
			}
		} else {
			// No search conditions, so just clear the box
			_updateItemList({ citedItems: [] });
		}
	});

	function _getMatchingCitedItems(options) {
		let { citedItems, citedItemsMatchingSearch, nCitedItemsFromLibrary } = options;
		if (Zotero_QuickFormat.citingNotes) return;
		
		if (!citedItems) {
			return null;
		}
		else if (citedItems.length) {
			// We have cited items
			for (let citedItem of citedItems) {
				// Tabulate number of items in document for each library
				if (!citedItem.cslItemID) {
					var libraryID = citedItem.libraryID;
					if (libraryID in nCitedItemsFromLibrary) {
						nCitedItemsFromLibrary[libraryID]++;
					}
					else {
						nCitedItemsFromLibrary[libraryID] = 1;
					}
				}
			}
			return citedItemsMatchingSearch;
		}
	}
	
	async function _getMatchingReaderOpenItems(options) {
		if (Zotero_QuickFormat.citingNotes) return [];
		let win = Zotero.getMainWindow();
		let tabs = win.Zotero_Tabs.getState();
		let itemIDs = tabs.filter(t => t.type === 'reader').sort((a, b) => {
			// Sort selected tab first
			if (a.selected) return -1;
			else if (b.selected) return 1;
			// Then in reverse chronological select order
			else if (a.timeUnselected && b.timeUnselected) return b.timeUnselected - a.timeUnselected;
			// Then in reverse order for tabs that never got loaded in this session
			else if (a.timeUnselected) return -1;
			return 1;
		}).map(t => t.data.itemID);
		if (!itemIDs.length) return [];

		let items = itemIDs.map((itemID) => {
			let item = Zotero.Items.get(itemID);
			if (item && item.parentItemID) {
				itemID = item.parentItemID;
			}
			return Zotero.Cite.getItem(itemID);
		});
		let matchedItems = new Set(items);
		if (options.searchString) {
			Zotero.debug("QuickFormat: Searching open tabs");
			matchedItems = new Set();
			let splits = Zotero.Fulltext.semanticSplitter(options.searchString);
			for (let item of items) {
				// Generate a string to search for each item
				let itemStr = item.getCreators()
					.map(creator => creator.firstName + " " + creator.lastName)
					.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)])
					.join(" ");
				
				// See if words match
				for (let split of splits) {
					if (itemStr.toLowerCase().includes(split)) matchedItems.add(item);
				}
			}
			Zotero.debug("QuickFormat: Found matching open tabs");
		}
		// Filter out already cited items
		return Array.from(matchedItems).filter(i => !options.citationItemIDs.has(i.cslItemID ? i.cslItemID : i.id));
	}
	
	async function _getMatchingLibraryItems(options) {
		let { searchString,
			searchResultIDs, nCitedItemsFromLibrary } = options;

		let win = Zotero.getMainWindow();
		let selectedItems = [];
		if (win.Zotero_Tabs.selectedType === "library") {
			if (!Zotero_QuickFormat.citingNotes) {
				selectedItems = Zotero.getActiveZoteroPane().getSelectedItems().filter(i => i.isRegularItem());
				// Filter out already cited items
				selectedItems = selectedItems.filter(i => !options.citationItemIDs.has(i.cslItemID ? i.cslItemID : i.id));
			}
			else {
				selectedItems = Zotero.getActiveZoteroPane().getSelectedItems().filter(i => i.isNote());
			}
		}
		if (!searchString) {
			return [selectedItems, []];
		}
		else if (!searchResultIDs.length) {
			return [[], []];
		}
			
		// Search results might be in an unloaded library, so get items asynchronously and load
		// necessary data
		var items = await Zotero.Items.getAsync(searchResultIDs);
		await Zotero.Items.loadDataTypes(items);
		
		searchString = searchString.toLowerCase();
		let searchParts = Zotero.SearchConditions.parseSearchString(searchString);
		var collation = Zotero.getLocaleCollation();
		
		function _itemSort(a, b) {
			var firstCreatorA = a.firstCreator, firstCreatorB = b.firstCreator;
			
			// Favor left-bound name matches (e.g., "Baum" < "Appelbaum"),
			// using last name of first author
			if (firstCreatorA && firstCreatorB) {
				for (let part of searchParts) {
					let caStartsWith = firstCreatorA.toLowerCase().startsWith(part.text);
					let cbStartsWith = firstCreatorB.toLowerCase().startsWith(part.text);
					if (caStartsWith && !cbStartsWith) {
						return -1;
					}
					else if (!caStartsWith && cbStartsWith) {
						return 1;
					}
				}
			}
			
			var libA = a.libraryID, libB = b.libraryID;
			if (libA !== libB) {
				// Sort by number of cites for library
				if (nCitedItemsFromLibrary[libA] && !nCitedItemsFromLibrary[libB]) {
					return -1;
				}
				if (!nCitedItemsFromLibrary[libA] && nCitedItemsFromLibrary[libB]) {
					return 1;
				}
				if (nCitedItemsFromLibrary[libA] !== nCitedItemsFromLibrary[libB]) {
					return nCitedItemsFromLibrary[libB] - nCitedItemsFromLibrary[libA];
				}
				
				// Sort by ID even if number of cites is equal
				return libA - libB;
			}
		
			// Sort by last name of first author
			if (firstCreatorA !== "" && firstCreatorB === "") {
				return -1;
			}
			else if (firstCreatorA === "" && firstCreatorB !== "") {
				return 1;
			}
			else if (firstCreatorA) {
				return collation.compareString(1, firstCreatorA, firstCreatorB);
			}
			
			// Sort by date
			var yearA = a.getField("date", true, true).substr(0, 4),
				yearB = b.getField("date", true, true).substr(0, 4);
			return yearA - yearB;
		}
		
		function _noteSort(a, b) {
			return collation.compareString(
				1, b.getField('dateModified'), a.getField('dateModified')
			);
		}
		
		items.sort(Zotero_QuickFormat.citingNotes ? _noteSort : _itemSort);
		
		// Split filtered items into selected and other bins
		let matchingSelectedItems = [];
		let matchingItems = [];
		for (let item of items) {
			if (selectedItems.findIndex(i => i.id === item.id) !== -1) {
				matchingSelectedItems.push(item);
			}
			else {
				matchingItems.push(item);
			}
		}
		return [matchingSelectedItems, matchingItems];
	}
	
	/**
	 * Updates the item list
	 */
	async function _updateItemList(options = {}) {
		options = Object.assign({
			citedItems: false,
			citedItemsMatchingSearch: false,
			searchString: "",
			searchResultIDs: [],
			preserveSelection: false,
			nCitedItemsFromLibrary: {},
			citationItemIDs: new Set()
		}, options);
			
		let { preserveSelection, nCitedItemsFromLibrary } = options;
		let previousItemID, selectedIndex = 1;

		// Do this so we can preserve the selected item after cited items have been loaded
		if (preserveSelection && referenceBox.selectedIndex !== -1 && referenceBox.selectedIndex !== 2) {
			previousItemID = parseInt(referenceBox.selectedItem.getAttribute("zotero-item"));
		}
		
		// Take into account items cited in this citation. This means that the sorting isn't
		// exactly by # of items cited from each library, but maybe it's better this way.
		_updateCitationObject();
		for (let citationItem of io.citation.citationItems) {
			var citedItem = io.customGetItem && io.customGetItem(citationItem) || Zotero.Cite.getItem(citationItem.id);
			options.citationItemIDs.add(citedItem.cslItemID ? citedItem.cslItemID : citedItem.id);
			if (!citedItem.cslItemID) {
				let libraryID = citedItem.libraryID;
				if (libraryID in nCitedItemsFromLibrary) {
					nCitedItemsFromLibrary[libraryID]++;
				}
				else {
					nCitedItemsFromLibrary[libraryID] = 1;
				}
			}
		}

		// To avoid blinking, fetch all necessary data first and then clear the
		// reference box without resizing the panel (it happens later)
		let openItems = await _getMatchingReaderOpenItems(options);
		let citedItems = _getMatchingCitedItems(options);
		let [selectedItems, libraryItems] = await _getMatchingLibraryItems(options);

		_clearEntryList(true);
		
		// Selected items are only returned if the currently selected tab is a library tab and
		// in that case displayed  at the top
		if (selectedItems.length) {
			referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.selectedItems")));
			for (let item of selectedItems.slice(0, ITEM_LIST_MAX_ITEMS - referenceBox.children.length)) {
				referenceBox.appendChild(_buildListItem(item));
			}
		}

		// Open reader items
		if (openItems.length && ITEM_LIST_MAX_ITEMS - referenceBox.children.length) {
			referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.openTabs")));
			for (let item of openItems.slice(0, ITEM_LIST_MAX_ITEMS - referenceBox.children.length)) {
				referenceBox.appendChild(_buildListItem(item));
			}
		}
		
		// Items cited in the document
		if (ITEM_LIST_MAX_ITEMS - referenceBox.children.length) {
			if (citedItems === null) {
				// We don't know whether or not we have cited items, because we are waiting for document
				// data
				referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.cited.loading")));
			}
			else if (citedItems && citedItems.length) {
				referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.cited")));
				for (let item of citedItems.slice(0, ITEM_LIST_MAX_ITEMS - referenceBox.children.length)) {
					referenceBox.appendChild(_buildListItem(item));
				}
			}
		}
			
		// Any other items matching in any of the user's libraries.
		var previousLibrary = -1;
		for (let item of libraryItems.slice(0, ITEM_LIST_MAX_ITEMS - referenceBox.children.length)) {
			let libraryID = item.libraryID;
			
			if (previousLibrary != libraryID) {
				var libraryName = libraryID
					? Zotero.Libraries.getName(libraryID)
					: Zotero.getString('pane.collections.library');
				referenceBox.appendChild(_buildListSeparator(libraryName));
			}

			referenceBox.appendChild(_buildListItem(item));
			previousLibrary = libraryID;
		}

		_resizeReferencePanel();
		if (!referenceBox.children.length) {
			return;
		}
	
		if (previousItemID !== undefined) {
			Array.from(referenceBox.children).some((elem, index) => {
				if (elem.getAttribute('zotero-item') === previousItemID) {
					selectedIndex = index;
					return true;
				}
				return false;
			});
		}
		
		let currentInput = _getCurrentInput();
		// Do not select the item in reference panel if the editor
		// is non-empty and nothing has been typed yet
		if (selectedIndex > 1 || isEditorCleared() || !isInputEmpty(currentInput)) {
			referenceBox.selectedIndex = selectedIndex;
		}
		referenceBox.ensureIndexIsVisible(selectedIndex);
		// Record the last input used for a search
		if (currentInput) {
			_lastFocusedInput = currentInput;
		}
	}
	
	/**
	 * Builds a string describing an item. We avoid CSL here for speed.
	 */
	function _buildItemDescription(item, infoHbox) {
		var nodes = [];
		var str = "";

		// Add a red label to retracted items
		if (Zotero.Retractions.isRetracted(item)) {
			var label = document.createXULElement("label");
			label.setAttribute("value", Zotero.getString("retraction.banner"));
			label.setAttribute("crop", "end");
			label.style.color = 'red';
			label.style['margin-inline-end'] = '5px';
			infoHbox.appendChild(label);
		}
		if (item.isNote()) {
			var date = Zotero.Date.sqlToDate(item.dateModified, true);
			date = Zotero.Date.toFriendlyDate(date);
			str += date;
			
			var text = item.note;
			text = Zotero.Utilities.unescapeHTML(text);
			text = text.trim();
			text = text.slice(0, 500);
			var parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
			if (parts[1]) str += " " + parts[1];
		}
		else {
			var author, authorDate = "";
			if(item.firstCreator) author = authorDate = item.firstCreator;
			var date = item.getField("date", true, true);
			if(date && (date = date.substr(0, 4)) !== "0000") {
				authorDate += " (" + parseInt(date) + ")";
			}
			authorDate = authorDate.trim();
			if(authorDate) nodes.push(authorDate);
			
			var publicationTitle = item.getField("publicationTitle", false, true);
			if(publicationTitle) {
				var label = document.createXULElement("label");
				label.setAttribute("value", publicationTitle);
				label.setAttribute("crop", "end");
				label.style.fontStyle = "italic";
				nodes.push(label);
			}
			
			var volumeIssue = item.getField("volume");
			var issue = item.getField("issue");
			if(issue) volumeIssue += "("+issue+")";
			if(volumeIssue) nodes.push(volumeIssue);
			
			var publisherPlace = [], field;
			if((field = item.getField("publisher"))) publisherPlace.push(field);
			if((field = item.getField("place"))) publisherPlace.push(field);
			if(publisherPlace.length) nodes.push(publisherPlace.join(": "));
			
			var pages = item.getField("pages");
			if(pages) nodes.push(pages);
			
			if(!nodes.length) {
				var url = item.getField("url");
				if(url) nodes.push(url);
			}

			// compile everything together
			for(var i=0, n=nodes.length; i<n; i++) {
				var node = nodes[i];

				if(i != 0) str += ", ";

				if(typeof node === "object") {
					var label = document.createXULElement("label");
					label.setAttribute("value", str);
					label.setAttribute("crop", "end");
					infoHbox.appendChild(label);
					infoHbox.appendChild(node);
					str = "";
				} else {
					str += node;
				}
			}

			if(nodes.length && (!str.length || str[str.length-1] !== ".")) str += ".";	
		}
		
		var label = document.createXULElement("label");
		label.setAttribute("value", str);
		label.setAttribute("crop", "end");
		label.setAttribute("flex", "1");
		infoHbox.appendChild(label);
	}
	
	/**
	 * Creates an item to be added to the item list
	 */
	function _buildListItem(item) {
		var titleNode = document.createXULElement("label");
		titleNode.setAttribute("class", "citation-dialog title");
		titleNode.setAttribute("flex", "1");
		titleNode.setAttribute("crop", "end");
		titleNode.setAttribute("value", item.getDisplayTitle());
		
		var infoNode = document.createXULElement("hbox");
		infoNode.setAttribute("class", "citation-dialog info");
		_buildItemDescription(item, infoNode);
		
		// add to rich list item
		var rll = document.createXULElement("richlistitem");
		rll.setAttribute("orient", "vertical");
		rll.setAttribute("class", "citation-dialog item");
		rll.setAttribute("zotero-item", item.cslItemID ? item.cslItemID : item.id);
		rll.setAttribute("aria-describedby", "item-description");
		rll.appendChild(titleNode);
		rll.appendChild(infoNode);
		
		return rll;
	}

	/**
	 * Creates a list separator to be added to the item list
	 */
	function _buildListSeparator(labelText, loading) {
		var titleNode = document.createXULElement("label");
		titleNode.setAttribute("class", "citation-dialog separator-title");
		titleNode.setAttribute("flex", "1");
		titleNode.setAttribute("crop", "end");
		titleNode.setAttribute("value", labelText);
		
		// add to rich list item
		var rll = document.createXULElement("richlistitem");
		rll.setAttribute("orient", "vertical");
		rll.setAttribute("disabled", true);
		// This ensures that screen readers don't include it while announcing elements' count
		rll.setAttribute("role", "presentation");
		rll.setAttribute("class", loading ? "citation-dialog loading" : "citation-dialog separator");
		rll.appendChild(titleNode);
		rll.addEventListener("mousedown", _ignoreClick, true);
		rll.addEventListener("click", _ignoreClick, true);
		
		return rll;
	}
	
	/**
	 * Builds the string to go inside a bubble
	 */
	function _buildBubbleString(citationItem) {
		var item = io.customGetItem && io.customGetItem(citationItem) || Zotero.Cite.getItem(citationItem.id);
		// create text for bubble
		
		// Creator
		var title, delimiter;
		var str = item.getField("firstCreator");
		
		// Title, if no creator (getDisplayTitle in order to get case, e-mail, statute which don't have a title field)
		title = item.getDisplayTitle();
		title = title.substr(0, 32) + (title.length > 32 ? "…" : "");
 		if (!str) {
			str = Zotero.getString("punctuation.openingQMark") + title + Zotero.getString("punctuation.closingQMark");
		}
		
		// Date
		var date = item.getField("date", true, true);
		if(date && (date = date.substr(0, 4)) !== "0000") {
			str += ", " + parseInt(date);
		}
		
		// Locator
		if(citationItem.locator) {
			// Try to fetch the short form of the locator label. E.g. "p." for "page"
			// If there is no locator label, default to "page" for now
			let label = (Zotero.Cite.getLocatorString(citationItem.label || 'page', 'short') || '').toLocaleLowerCase();
			
			str += ", "+label+" "+citationItem.locator;
		}
		
		// Prefix
		if(citationItem.prefix && Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP) {
			let prefix = citationItem.prefix.substr(0, 10) + (citationItem.prefix.length > 10 ? "…" : "")
			str = prefix
				+(Zotero.CiteProc.CSL.ENDSWITH_ROMANESQUE_REGEXP.test(citationItem.prefix) ? " " : "")
				+str;
		}
		
		// Suffix
		if(citationItem.suffix && Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP) {
			let suffix = citationItem.suffix.substr(0, 10) + (citationItem.suffix.length > 10 ? "…" : "")
			str += (Zotero.CiteProc.CSL.STARTSWITH_ROMANESQUE_REGEXP.test(citationItem.suffix) ? " " : "")
				+ suffix;
		}
		
		return str;
	}
	
	/**
	 * Insert a bubble into the DOM at a specified position
	 */
	function _insertBubble(citationItem, nextNode) {
		var str = _buildBubbleString(citationItem);
		let bubble = document.createElement("div");
		bubble.setAttribute("draggable", "true");
		bubble.setAttribute("role", "button");
		bubble.setAttribute("tabindex", "0");
		bubble.setAttribute("aria-describedby", "bubble-description");
		bubble.setAttribute("aria-haspopup", true);
		bubble.className = "citation-dialog bubble";
		// VoiceOver works better without it
		if (!Zotero.isMac) {
			bubble.setAttribute("aria-label", str);
		}
		bubble.textContent = str;
		bubble.addEventListener("click", _onBubbleClick);
		bubble.addEventListener("dragstart", _onBubbleDrag);
		bubble.addEventListener("dragend", onBubbleDragEnd);
		bubble.addEventListener("keypress", onBubblePress);
		bubble.addEventListener("mousedown", (_) => {
			_bubbleMouseDown = true;
		});
		bubble.addEventListener("mouseup", (_) => {
			_bubbleMouseDown = false;
		});
		bubble.dataset.citationItem = JSON.stringify(citationItem);
		editor.insertBefore(bubble, (nextNode ? nextNode : null));
		return bubble;
	}

	function getAllBubbles() {
		return [...editor.querySelectorAll(".bubble")];
	}

	// Delete the bubble and clear locator node if it pointed at this bubble
	function _deleteBubble(bubble) {
		if (bubble == locatorNode) {
			locatorNode = null;
		}
		bubble.remove();
	}
	
	/**
	 * Clear reference box
	 */
	function _clearEntryList(skipResize = false) {
		while(referenceBox.hasChildNodes()) referenceBox.removeChild(referenceBox.firstChild);
		if (!skipResize) {
			_resizeReferencePanel();
		}
		referenceBox.selectedIndex = -1;
	}

	// Select the first appropriate reference from the items list.
	// If there are multi-selected items, select the first one of them.
	// Otherwise, select the first non-header row.
	function _selectFirstReference() {
		if (referenceBox.selectedIndex > 0) return;
		let firstItem = [...referenceBox.selectedItems].find(node => referenceBox.contains(node));
		if (firstItem) {
			referenceBox.selectedItem = firstItem;
		}
		else {
			referenceBox.selectedIndex = 1;
		}
	}
	
	/**
	 * Converts the selected item to a bubble
	 */
	this._bubbleizeSelected = Zotero.Promise.coroutine(function* () {
		let input = _lastFocusedInput || _getCurrentInput();
		if (referenceBox.selectedCount == 0 || referencePanel.state !== 'open' || !input) return false;
		let lastAddedBubble;
		let multipleSelected = referenceBox.selectedCount > 1;
		// It is technically possible for referenceBox.selectedItems to include nodes that were removed
		// (e.g. during panel refreshing). This should never happen but this is a sanity check to make sure
		let selectedItems = [...referenceBox.selectedItems].filter(node => referenceBox.contains(node));
		for (let selectedItem of selectedItems) {
			let itemID = parseInt(selectedItem.getAttribute("zotero-item"));
			let item = { id: itemID };
			if (Zotero.Retractions.isRetracted(item)) {
				if (Zotero.Retractions.shouldShowCitationWarning(item)) {
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
							Zotero_QuickFormat.showInLibrary(itemID);
						}
						// Retraction should not be added
						referenceBox.removeItemFromSelection(selectedItem);
						return false;
					}
					if (checkbox.value) {
						Zotero.Retractions.disableCitationWarningsForItem(item);
					}
				}
			}
		}
		for (let selectedItem of selectedItems) {
			var citationItem = { id: selectedItem.getAttribute("zotero-item") };
			if (typeof citationItem.id === "string" && citationItem.id.indexOf("/") !== -1) {
				var item = Zotero.Cite.getItem(citationItem.id);
				citationItem.uris = item.cslURIs;
				citationItem.itemData = item.cslItemData;
			}
			if (currentLocator) {
				citationItem.locator = currentLocator;
				if (currentLocatorLabel) {
					citationItem.label = currentLocatorLabel;
				}
			}
			lastAddedBubble = _insertBubble(citationItem, input);
		}
		if (!lastAddedBubble) {
			return false;
		}
		isPaste = false;
		_clearEntryList();
		clearLastFocused(input);
		input.remove();

		yield _previewAndSort();
		refocusInput(false);
		// Do not record locator node if multiple bubbles are added
		if (!multipleSelected) {
			locatorNode = getAllBubbles().filter(bubble => bubble.textContent == lastAddedBubble.textContent)[0];
		}
		return true;
	});
	
	/**
	 * Ignores clicks (for use on separators in the rich list box)
	 */
	function _ignoreClick(e) {
		e.stopPropagation();
		e.preventDefault();
	}

	/**
	 * FX115.
	 * Keep track when the window is being dragged and if so - hide reference panel.
	 * Reopen it when the window stops being dragged.
	 * This is to handle the <panel> not following the window as it is moved across the screen.
	 * -moz-window-drag interferes with mouseup/down events on windows, so this is an alternative
	 * to those listeners.
	 */
	function _initWindowDragTracker() {
		const CHECK_FREQUENCY = 100;
		let windowTop = window.screenTop;
		let windowLeft = window.screenLeft;
		let checksWithoutMovement = 0;
		let checkWindowsPosition = () => {
			// Don't let the counter increase indefinitely
			if (checksWithoutMovement > 1000000) {
				checksWithoutMovement = 10;
			}
			setTimeout(() => {
				// If the window's positioning changed, the window is being dragged. Hide the reference panel
				if (windowTop !== window.screenTop || windowLeft !== window.screenLeft) {
					referencePanel.hidePopup();
					windowTop = window.screenTop;
					windowLeft = window.screenLeft;
					checksWithoutMovement = 0;
					checkWindowsPosition();
					return;
				}
				// If the position hasn't changed for a while, make sure the panel is reopened.
				if (checksWithoutMovement == 2 && isInput(document.activeElement) && referencePanel.state !== "open") {
					_resizeReferencePanel();
				}
				checksWithoutMovement += 1;
				// Keep checking every once in a while
				checkWindowsPosition();
			}, CHECK_FREQUENCY);
		};
		checkWindowsPosition();
	}

	// Set the editor's width so that it fills up all remaining space in the window.
	// It should be window.width - padding - icon wrappers width. The is needed to be explicitly set
	// so that the editor's height expands/shrinks vertically without going outside of the
	// window boundaries.
	function _resizeEditor() {
		let editorParentWidth = editor.parentNode.getBoundingClientRect().width;
		// Find the widths of all icon containers.
		// Quick format dialog has 2 sets of icons but insert note dialog has only one
		let iconWrappers = [...document.querySelectorAll(".citation-dialog.icons")];
		let iconWrapperWidth = iconWrappers.reduce((totalWidth, iconWrapper) => totalWidth + iconWrapper.getBoundingClientRect().width, 0);
		let editorDesiredWidth = editorParentWidth - iconWrapperWidth;
		// Sanity check: editor width should never be that small
		if (editorDesiredWidth > 700) {
			editor.style.width = `${editorDesiredWidth}px`;
		}
	}
	function _resizeWindow() {
		let box = document.querySelector(".citation-dialog.entry");
		let contentHeight = box.getBoundingClientRect().height;
		// Resized so that outerHeight=contentHeight
		let outerHeightAdjustment = Math.max(window.outerHeight - window.innerHeight, 0);
		let width = WINDOW_WIDTH;
		let height = contentHeight + outerHeightAdjustment;
		// On windows, there is a 10px margin around the dialog. It's required for dragging
		// to be picked up at the edges of the dialog, otherwise it will be ignored and only
		// inner half of the dialog can be used to drag the window.
		if (Zotero.isWin) {
			width += 10 * 2;
			height += 10 * 2;
		}
		if (Math.abs(height - window.innerHeight) < 5) {
			// Do not do anything if the difference is just a few pixels
			return;
		}
		window.resizeTo(width, height);
		// If the editor height changes, the panel will remain where it was.
		// Check if the panel is not next to the dialog, and if so - close and reopen it
		// to position references panel properly
		let dialogBottom = dialog.getBoundingClientRect().bottom;
		let panelTop = referencePanel.getBoundingClientRect().top;
		if (Math.abs(dialogBottom - panelTop) > 5 && referencePanel.state == "open") {
			referencePanel.hidePopup();
			// Skip a tick, otherwise the panel may just remain open where it was
			setTimeout(_openReferencePanel);
		}
		if (Zotero.isMac && Zotero.platformMajorVersion >= 60) {
			document.children[0].setAttribute('drawintitlebar', 'false');
			document.children[0].setAttribute('drawintitlebar', 'true');
		}
	}
	
	function _resizeReferencePanel() {
		let visibleNodes = [];
		let countedItems = 0;
		// Fetch enough list items to include SHOWN_REFERENCES items
		for (let n of [...referenceBox.childNodes]) {
			visibleNodes.push(n);
			if (n.className === "citation-dialog item") {
				countedItems++;
			}
			if (countedItems >= SHOWN_REFERENCES) {
				break;
			}
		}
		// References should be shown whenever there are matching items
		let showReferencePanel = visibleNodes.length > 0;
		if (!showReferencePanel) {
			referencePanel.hidePopup();
			return;
		}
		_openReferencePanel();
		if (!panelFrameHeight) {
			panelFrameHeight = referencePanel.getBoundingClientRect().height - referencePanel.clientHeight;
			var computedStyle = window.getComputedStyle(referenceBox, null);
			for (var attr of ["border-top-width", "border-bottom-width"]) {
				var val = computedStyle.getPropertyValue(attr);
				if (val) {
					var m = pixelRe.exec(val);
					if (m) panelFrameHeight += parseInt(m[1], 10);
				}
			}
		}
		// Find the height needed to display SHOWN_REFERENCES items
		let height = visibleNodes.reduce((prev, cur) => {
			return prev + cur.scrollHeight + 1;
		}, 0);
		referencePanel.sizeTo(window.outerWidth - 30, height + panelFrameHeight);
	}

	/**
	 * When bubbles are reshufled during drag-drop they may required X or X+1 lines of the editor.
	 * Then the height of the window can get out-of-sync with the height of the editor.
	 * To avoid the editor being cutoff by the window or having blank space below the editor,
	 * this will lock the height of the editor until dragging is over.
	 */
	function lockEditorHeight(isLocked) {
		if (isLocked) {
			let editorHeight = editor.getBoundingClientRect().height;
			editor.style.height = `${editorHeight}px`;
			editor.style['overflow-y'] = 'scroll';
			editor.style['scrollbar-width'] = 'none'; // avoid scrollbar/arrows
			return;
		}
		editor.style.removeProperty("height");
		editor.style.removeProperty("overflow-y");
		editor.style.removeProperty("scrollbar-width");
	}
	
	/**
	 * Opens the reference panel
	 */
	function _openReferencePanel() {
		var panelShowing = referencePanel.state === "open" || referencePanel.state === "showing";
		
		if (!panelShowing && !Zotero.isMac && !Zotero.isWin) {
			// noautohide and noautofocus are incompatible on Linux
			// https://bugzilla.mozilla.org/show_bug.cgi?id=545265
			referencePanel.setAttribute("noautohide", "false");
			
			// reinstate noautohide after the window is shown
			referencePanel.addEventListener("popupshowing", function() {
				referencePanel.removeEventListener("popupshowing", arguments.callee, false);
				referencePanel.setAttribute("noautohide", "true");
			}, false);
		}
		// Try to make the panel appear right in the center on windows
		let leftMargin = Zotero.isWin ? 5 : 15;
		referencePanel.openPopup(dialog, "after_start", leftMargin, 0, false, false, null);
	}
	
	/**
	 * Clears all citations
	 */
	function _clearCitation() {
		var citations = document.getElementsByClassName("citation-dialog bubble");
		while(citations.length) {
			citations[0].parentNode.removeChild(citations[0]);
		}
	}
	
	/**
	 * Shows citations in the citation object
	 */
	function _showCitation(insertBefore) {
		if(!io.citation.properties.unsorted
				&& keepSorted && keepSorted.hasAttribute("checked")
				&& io.citation.sortedItems
				&& io.citation.sortedItems.length) {
			for(var i=0, n=io.citation.sortedItems.length; i<n; i++) {
				_insertBubble(io.citation.sortedItems[i][1], insertBefore);
			}
		} else {
			for(var i=0, n=io.citation.citationItems.length; i<n; i++) {
				_insertBubble(io.citation.citationItems[i], insertBefore);
			}
		}
	}
	
	/**
	 * Populates the citation object
	 */
	function _updateCitationObject() {
		var nodes = editor.childNodes;
		io.citation.citationItems = [];
		for (let node of nodes) {
			if (node.dataset && node.dataset.citationItem) {
				io.citation.citationItems.push(JSON.parse(node.dataset.citationItem));
			}
		}
		
		if(io.sortable) {
			if(keepSorted && keepSorted.hasAttribute("checked")) {
				delete io.citation.properties.unsorted;
			} else {
				io.citation.properties.unsorted = true;
			}
		}
	}
	
	/**
	 * Generates the preview and sorts citations
	 */
	var _previewAndSort = Zotero.Promise.coroutine(function* () {
		var shouldKeepSorted = keepSorted && keepSorted.hasAttribute("checked"),
			editorShowing = showEditor && showEditor.hasAttribute("checked");
		if(!shouldKeepSorted && !editorShowing) return;
		
		_updateCitationObject();
		yield io.sort();
		// means we need to resort citations
		if (shouldKeepSorted) {
			let inputsLocations = {};
			// Record after which bubble every input goes
			for (let node of [...editor.childNodes]) {
				let bubble = node.previousElementSibling;
				if (node.classList.contains("zotero-bubble-input") && bubble) {
					inputsLocations[bubble.textContent] = node;
				}
			}
			_clearCitation();
			_showCitation();
			// Restore the positioning of inputs
			for (let node of [...editor.childNodes]) {
				// If there is an input that followed this bubble before reordering,
				// place it after that bubble again
				let input = inputsLocations[node.textContent];
				if (input) {
					node.after(input);
					delete inputsLocations[node.textContent];
				}
			}
		}
	});
	
	/**
	 * Shows the citation properties panel for a given bubble
	 */
	function _showItemPopover(target) {
		panelRefersToBubble = target;
		let citationItem = JSON.parse(target.dataset.citationItem);
		itemPopoverPrefix.value = citationItem["prefix"] ? citationItem["prefix"] : "";
		itemPopoverSuffix.value = citationItem["suffix"] ? citationItem["suffix"] : "";
		var pageOption = itemPopoverLocatorLabel.getElementsByAttribute("value", "page")[0];
		if(citationItem["label"]) {
			var option = itemPopoverLocatorLabel.getElementsByAttribute("value", citationItem["label"]);
			if(option.length) {
				itemPopoverLocatorLabel.selectedItem = option[0];
			} else {
				itemPopoverLocatorLabel.selectedItem = pageOption;
			}
		} else {
			itemPopoverLocatorLabel.selectedItem = pageOption;
		}
		itemPopoverLocator.value = citationItem["locator"] ? citationItem["locator"] : "";
		itemPopoverSuppressAuthor.checked = !!citationItem["suppress-author"];
		
		var item = io.customGetItem && io.customGetItem(citationItem) || Zotero.Cite.getItem(citationItem.id);
		document.getElementById("citation-properties-title").textContent = item.getDisplayTitle();
		while(panelInfo.hasChildNodes()) panelInfo.removeChild(panelInfo.firstChild);
		_buildItemDescription(item, panelInfo);
		// Aria label for the info panel to be visible to the screen readers
		let description = Array.from(panelInfo.childNodes).map(label => label.value).join(".");
		panelInfo.setAttribute('aria-label', description);
		panelLibraryLink.hidden = !item.id;
		if(item.id) {
			var libraryName = item.libraryID ? Zotero.Libraries.getName(item.libraryID)
							: Zotero.getString('pane.collections.library');
			panelLibraryLink.label = Zotero.getString("integration.openInLibrary", libraryName);
		}

		target.setAttribute("selected", "true");
		itemPopover.openPopup(target, "after_start",
			target.clientWidth/2, 0, false, false, null);
		referencePanel.hidePopup();
	}
	
	/**
	 * Called when progress changes
	 */
	function _onProgress(percent) {
		var meter = document.querySelector(".citation-dialog.progress-meter");
		if(percent === null) {
			meter.removeAttribute('value');
		} else {
			meter.value = Math.round(percent);
		}
	}
	
	/**
	 * Accepts current selection and adds citation
	 */
	this.accept = function() {
		if (accepted || _searchPromise?.isPending()) return;
		accepted = true;
		try {
			_updateCitationObject();
			document.querySelector(".citation-dialog.deck").selectedIndex = 1;
			io.accept(_onProgress);
		} catch(e) {
			Zotero.debug(e);
		}
	}
	
	/**
	 * Handles windows closed with the close box
	 */
	this.onUnload = function() {
		if(accepted) return;
		accepted = true;
		io.citation.citationItems = [];
		io.accept();
	}
	
	/**
	 * Handle escape for entire window
	 */
	this.onWindowKeyPress = function (event) {
		if (accepted || new Date() - _itemPopoverClosed < ESC_ENTER_THROTTLE) return;
		var keyCode = event.keyCode;
		if (keyCode === event.DOM_VK_ESCAPE) {
			accepted = true;
			io.citation.citationItems = [];
			io.accept();
			window.close();
		}
		else if (event.key == "Enter") {
			event.preventDefault();
			Zotero_QuickFormat.accept();
		}
		// In rare circumstances, the focus can get lost (e.g. if the focus is on an item
		// in reference panel when it is refreshed and all nodes are deleted).
		// To be able to recover from this, a tab from the window will focus the last input
		else if (event.key == "Tab" && event.target.tagName == "window") {
			refocusInput();
			event.preventDefault();
		}
	};

	function moveFocusForward(node) {
		if (node.nextElementSibling?.focus) {
			node.nextElementSibling.focus();
			return true;
		}
		return false;
	}

	function moveFocusBack(node) {
		// Skip line break if it's before the node
		if (node.previousElementSibling?.tagName == "br") {
			node = node.previousElementSibling;
		}
		if (node.previousElementSibling?.focus) {
			node.previousElementSibling.focus();
			return true;
		}
		return false;
	}

	/**
	 * Gets text within the currently selected node
	 */
	function _getEditorContent() {
		let node = _getCurrentInput();
		return node ? node.value.trim() : false;
	}

	function _getCurrentInput() {
		if (isInput(document.activeElement)) {
			return document.activeElement;
		}
		return false;
	}

	// Get width of the text inside of the input
	function getContentWidth(input) {
		let span = document.createElement("span");
		span.classList = "zotero-bubble-input";
		span.innerText = input.value;
		editor.appendChild(span);
		let spanWidth = span.getBoundingClientRect().width;
		span.remove();
		return spanWidth;
	}

	// Determine if keypress event is on a printable character.
	/* eslint-disable array-element-newline */
	function isKeypressPrintable(event) {
		if (event.ctrlKey || event.metaKey || event.altKey) return false;
		// If it's a single character, for latin locales it has to be printable
		if (event.key.length === 1) {
			return true;
		}
		// Otherwise, check against a list of common control keys
		let nonPrintableKeys = [
			'Enter', 'Escape', 'Backspace', 'Tab',
			'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
			'Home', 'End', 'PageUp', 'PageDown',
			'Delete', 'Insert',
			'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
			'Control', 'Meta', 'Alt', 'Shift', 'CapsLock'
		];
		/* eslint-enable array-element-newline */
	
		return !nonPrintableKeys.includes(event.key);
	}

	// Determine if the input is empty
	function isInputEmpty(input) {
		if (!input) {
			return true;
		}
		return input.value.length == 0;
	}

	function isInput(node) {
		if (!node) return false;
		return node.classList.contains("zotero-bubble-input");
	}

	function isCursorAtInputStart(input) {
		return Zotero.rtl ? input.selectionStart == input.value.length : input.selectionStart == 0;
	}

	function isCursorAtInputEnd(input) {
		return Zotero.rtl ? input.selectionStart == 0 : input.selectionStart == input.value.length;
	}

	// Check if the editor has only one child node: the non-removable input
	function isEditorCleared() {
		return editor.childElementCount == 1 && editor.firstChild.classList.contains("zotero-bubble-input");
	}

	/**
	 * Reset timer that controls when search takes place. We use this to avoid searching after each
	 * keypress, since searches can be slow.
	 */
	function _resetSearchTimer() {
		// Show spinner
		var spinner = document.querySelector('.citation-dialog.icons.end image');
		// Accept button does not exist in insertNote dialog
		let acceptButton = spinner.nextElementSibling;
		if (acceptButton) acceptButton.style.display = "none";
		spinner.setAttribute("status", "animate");
		// Cancel current search if active
		if (_searchPromise && _searchPromise.isPending()) {
			_searchPromise.cancel();
		}
		// Start new search
		_searchPromise = Zotero.Promise.delay(SEARCH_TIMEOUT)
			.then(() => _quickFormat())
			.then(() => {
				_searchPromise = null;
				spinner.removeAttribute("status");
				if (acceptButton) acceptButton.style.removeProperty("display");
			});
	}

	/**
	 * Find the last bubble (lastBubble) before a given coordinate and indicate if there are no bubbles
	 * to the left of the x-coordinate (startOfTheLine). If there is no last bubble, null is returned.
	 * startOfTheLine indicates if a <br> should be added so that a new input placed after lastBubble
	 * does not land on the previous line.
	 * Outputs for a sample of coordiantes (with #3 having startOfTheLine=true):
	 *  NULL    #1      #2          #3
	 *  ↓        ↓       ↓           ↓
	 * [ bubble_1 bubble_2 bubble_3
	 * 	  bubble_4, bubble_5          ]
	 *   ↑       ↑      ↑       ↑
	 *  #3      #4     #5      #5
	 * @param {Int} x - X coordinate
	 * @param {Int} y - Y coordinate
	 * @returns {lastBubble: Node, startOfTheLine: Bool}
	 */
	function getLastBubbleBeforePoint(x, y) {
		let bubbles = getAllBubbles();
		let lastBubble = null;
		let startOfTheLine = false;
		let isClickAfterBubble = (clickX, bubbleRect) => {
			return Zotero.rtl ? clickX < bubbleRect.left : clickX > bubbleRect.right;
		};
		for (let i = 0; i < bubbles.length; i++) {
			let rect = bubbles[i].getBoundingClientRect();
			// If within the vertical range of a bubble
			if (y >= rect.top && y <= rect.bottom) {
				// If the click is after the bubble, it becomes a candidate
				if (isClickAfterBubble(x, rect)) {
					lastBubble = i;
				}
				// Otherwise, stop and return the last bubble we saw if any
				else {
					if (i == 0) {
						lastBubble = null;
					}
					else {
						// Indicate there is no bubble before this one
						startOfTheLine = lastBubble === null;
						lastBubble = Math.max(i - 1, 0);
					}
					break;
				}
			}
		}
		if (lastBubble !== null) {
			lastBubble = bubbles[lastBubble];
		}
		return { lastBubble: lastBubble, startOfTheLine: startOfTheLine };
	}

	function _onQuickSearchClick(event) {
		if (qfGuidance) qfGuidance.hide();
		if (!event.target.classList.contains("editor")) return;
		let clickX = event.clientX;
		let clickY = event.clientY;
		let { lastBubble, startOfTheLine } = getLastBubbleBeforePoint(clickX, clickY);
		// If click happened right before another input, focus that input
		// instead of adding another one. There may be a br node on the way, so we have to check
		// more than just the next node. If there is no lastBubble and there is an input
		// at the start of the editor, focus it.
		let nextNode = lastBubble ? lastBubble.nextElementSibling : editor.firstChild;
		while (nextNode && !nextNode.classList.contains("bubble")) {
			if (isInput(nextNode)) {
				nextNode.focus();
				return;
			}
			nextNode = nextNode.nextElementSibling;
		}
		let newInput = _createInputField();
		let currentInput = _getCurrentInput() || _lastFocusedInput;
		// If there is a current input, delete it here.
		// It can be handled by the "blur" event handler but it happens
		// after a small delay which causes bubbles to shift back and forth
		if (currentInput && isInputEmpty(currentInput)) {
			clearLastFocused(currentInput);
			currentInput.remove();
		}
		if (lastBubble !== null) {
			lastBubble.after(newInput);
			if (startOfTheLine) {
				let lineBreak = document.createElement("br");
				lastBubble.after(lineBreak);
			}
		}
		else {
			editor.prepend(newInput);
		}
		locatorNode = null;
		newInput.focus();
	}

	// Essentially a rewrite of default richlistbox  arrow navigation
	// so that it works with voiceover on CMD-ArrowUp/Down
	var handleItemSelection = (event) => {
		let selected = referenceBox.contains(document.activeElement) ? document.activeElement : referenceBox.selectedItem;
		// Multiselect happens during arrowUp/Down navigation when Shift/Cmd is being held
		let selectMultiple = event.shiftKey || event.metaKey;
		let initiallySelected = null;
		if (referenceBox.contains(document.activeElement) && selectMultiple) {
			initiallySelected = selected;
		}
		let selectNext = (node) => {
			return event.key == "ArrowDown" ? node.nextElementSibling : node.previousElementSibling;
		};
		do {
			selected = selectNext(selected);
			referenceBox.ensureElementIsVisible(selected);
		}
		while (selected && selected.disabled);
		if (selected) {
			selected.focus();
			let multiSelected = [...referenceBox.selectedItems];
			if (selectMultiple) {
				// If the selected item is already selected, the previous one
				// should be un-selected
				if (multiSelected.includes(selected)) {
					referenceBox.removeItemFromSelection(initiallySelected);
				}
				else {
					referenceBox.addItemToSelection(selected);
					// If there are multiple selected items, focus the last one
					let following = selectNext(selected);
					while (following && following.selected) {
						following.focus();
						following = selectNext(following);
					}
				}
			}
			else {
				referenceBox.selectedItem = selected;
			}
		}
	};
	

	var onInputPress = function (event) {
		if (accepted) return;
		if ((event.charCode === 59 /* ; */ || (event.key === "Enter" && !event.shiftKey)) && referenceBox.selectedIndex >= 1) {
			event.preventDefault();
			event.stopPropagation();
			Zotero_QuickFormat._bubbleizeSelected();
		}
		else if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.shiftKey) {
			// On arrow left (right in RTL) from the beginning of the input, move to previous bubble
			if (event.key === Zotero.arrowPreviousKey && isCursorAtInputStart(this)) {
				moveFocusBack(this);
				event.preventDefault();
			}
			// On arrow right (left in RTL) from the end of the input, move to next bubble
			else if (event.key === Zotero.arrowNextKey && isCursorAtInputEnd(this)) {
				moveFocusForward(this);
				event.preventDefault();
			}
		}
		else if (["Backspace", "Delete"].includes(event.key)
			&& (this.selectionStart + this.selectionEnd) === 0) {
			event.preventDefault();
			// Backspace/Delete from the beginning of an input will delete the previous bubble.
			// If there are two inputs next to each other as a result, they are merged
			let toDelete = Zotero.rtl ? this.nextElementSibling : this.previousElementSibling;
			if (toDelete) {
				_deleteBubble(toDelete);
				_combineNeighboringInputs();
			}
			// Rerun search to update opened documents section if needed
			_resetSearchTimer();
		}
		else if (["ArrowDown", "ArrowUp"].includes(event.key) && referencePanel.state === "open") {
			event.preventDefault();
			event.stopPropagation();
			// ArrowUp when item is selected does nothing
			if (referenceBox.selectedIndex < 1 && event.key == "ArrowUp") {
				return;
			}
			// Arrow up/down will navigate the references panel if that's opened
			if (referenceBox.selectedIndex < 1) {
				_selectFirstReference();
				referenceBox.selectedItem.focus();
			}
			else {
				handleItemSelection(event);
			}
		}
		else if (event.key == "Tab" && !event.shiftKey && referencePanel.state === "open") {
			// Tab from the input will focus the selected item in the references list
			event.preventDefault();
			event.stopPropagation();
			if (referenceBox.selectedIndex < 1) {
				_selectFirstReference();
			}
			referenceBox.selectedItem.focus();
		}
	};

	var onBubblePress = function(event) {
		if (accepted) return;
		if (event.key == "ArrowDown" || event.key == " ") {
			// On arrow down or whitespace, open new citation properties panel
			_showItemPopover(this);
			event.preventDefault();
		}
		else if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.shiftKey) {
			event.preventDefault();
			let newInput = _createInputField();
			
			if (event.key === Zotero.arrowPreviousKey) {
				if (isInput(this.previousElementSibling)) {
					moveFocusBack(this);
				}
				else {
					this.before(newInput);
					newInput.focus();
				}
			}
			else if (event.key === Zotero.arrowNextKey) {
				if (isInput(this.nextElementSibling)) {
					moveFocusForward(this);
				}
				else {
					this.after(newInput);
					newInput.focus();
				}
			}
		}
		else if (["ArrowLeft", "ArrowRight"].includes(event.key) && event.shiftKey) {
			// On Shift-Left/Right swap focused bubble with it's neighbor
			event.preventDefault();
			let findNextBubble = () => {
				let node = event.target;
				do {
					node = event.key == Zotero.arrowPreviousKey ? node.previousElementSibling : node.nextElementSibling;
				} while (node && !(node.classList.contains("bubble") || node.classList.contains("zotero-bubble-input")));
				return node;
			};
			let nextBubble = findNextBubble();
			if (nextBubble) {
				if (event.key === Zotero.arrowPreviousKey) {
					nextBubble.before(this);
				}
				else {
					nextBubble.after(this);
				}
				// Do not "Keep Sources Sorted"
				if (io.sortable && keepSorted?.hasAttribute("checked")) {
					keepSorted.removeAttribute("checked");
				}
				_previewAndSort();
			}
			
			this.focus();
		}
		else if (["Backspace", "Delete"].includes(event.key)) {
			event.preventDefault();
			if (!moveFocusBack(this)) {
				moveFocusForward(this);
			}
			_deleteBubble(this);
			// Removed item bubble may belong to opened documents section. Reference panel
			// needs to be reset so that it appears among other items.
			_clearEntryList();
			_combineNeighboringInputs();
			// If all bubbles are removed, add and focus an input
			if (getAllBubbles().length == 0) {
				refocusInput();
			}
		}
		else if (isKeypressPrintable(event) && event.key !== " ") {
			event.preventDefault();
			let input = refocusInput();
			// Typing when you are focused on the bubble will re-focus the last input
			input.value += event.key;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	};

	/**
	 * Handle keyboard navigation not covered by other components
	 */
	var _onQuickSearchKeyPress = Zotero.Promise.coroutine(function* (event) {
		// Prevent hang if another key is pressed after Enter
		// https://forums.zotero.org/discussion/59157/
		if (accepted) {
			event.preventDefault();
			return;
		}
		if(qfGuidance) qfGuidance.hide();
		
		var keyCode = event.keyCode;
		let focusedInput = _getCurrentInput();
		if (event.key == ' ') {
			// Space on toolbarbutton opens the popup
			if (event.target.tagName == "toolbarbutton") {
				event.target.firstChild.openPopup();
			}
		}
		// On Home from the beginning of the input, create and focus input in the beginning
		// If there is an input in the beginning already, just focus it
		else if (event.key === "Home"
			&& (!focusedInput || (isCursorAtInputStart(focusedInput) && focusedInput.previousElementSibling))) {
			let input;
			if (isInput(editor.firstChild)) {
				input = editor.firstChild;
			}
			else {
				input = _createInputField();
				editor.prepend(input);
			}
			input.focus();
		}
		// On End from the beginning of the input, create and focus input in the end.
		// If there is an input in the end already, just focus it
		else if (event.key === "End"
			&& (!focusedInput || (isCursorAtInputEnd(focusedInput) && focusedInput.nextElementSibling))) {
			let input;
			if (isInput(editor.childNodes[editor.childNodes.length - 1])) {
				input = editor.childNodes[editor.childNodes.length - 1];
				input.focus();
			}
			else {
				addInputToTheEnd();
			}
		}
		else if (keyCode == event.DOM_VK_TAB) {
			// Shift-Tab from the input field tries to focus on zotero icon dropdown
			if (event.shiftKey) {
				let icon = document.getElementById("zotero-icon");
				if (icon && icon.getAttribute("disabled") != "true") {
					icon.focus();
					event.preventDefault();
					return;
				}
			}
			// Tab places focus on the existing input or creates a new one in the end
			refocusInput();
			
			event.preventDefault();
		}
		// Shift-Enter will accept the existing dialog's state
		else if (keyCode == "Enter" && event.shiftKey) {
			event.preventDefault();
			event.stopPropagation();
			this.accept();
		}
		else {
			isPaste = false;
		}
	});
	
	// Dragging the bubble for drag-drop reordering
	function _onBubbleDrag(event) {
		this.style.cursor = "grabbing";
		// Sometimes due to odd mozilla drag-drop behavior, the dragend event may not fire
		// so the element will get stuck with the id. Clean it up on next dragstart if it happens.
		let lastDragged = document.querySelector("#dragged-bubble");
		if (lastDragged) {
			lastDragged.removeAttribute("id");
		}
		setTimeout(() => {
			this.setAttribute("id", "dragged-bubble");
		});
		bubbleDraggedIndex = _getBubbleIndex(this);
		event.dataTransfer.setData("zotero/citation_bubble", bubbleDraggedIndex);
		event.dataTransfer.effectAllowed = "move";
		event.stopPropagation();

		// Lock editors height till the drag is over
		lockEditorHeight(true);
	}

	// Bubble being dragged over the editor
	function _onEditorDragOver(event) {
		event.preventDefault();
		let draggedBubble = document.querySelector("#dragged-bubble");
		let bubble = event.target;
		// If the target is an editor, find the last bubble before
		// mouse location to insert the placeholder after it.
		// This handles an edge case if a bubble is dragged to an empty spot in the end of the editor.
		if (bubble.classList?.contains("editor")) {
			let { lastBubble, _ } = getLastBubbleBeforePoint(event.clientX, event.clientY);
			if (!lastBubble) {
				return false;
			}
			bubble = lastBubble;
		}
		if (!draggedBubble || bubbleDraggedIndex === null || !bubble.classList?.contains("bubble")) {
			return false;
		}
		if (bubble.getAttribute("id") == "dragged-bubble") {
			return true;
		}

		let bubbleRect = bubble.getBoundingClientRect();
		let midpoint = (bubbleRect.right + bubbleRect.left) / 2;
		// If dragged-bubble is placed over the right half of another bubble, insert placeholder after it.
		if (event.clientX > midpoint && bubble.nextElementSibling?.id !== "dragged-bubble") {
			bubble.after(draggedBubble);
		}
		// If dragged-bubble is placed over the left half of another bubble, insert placeholder before it.
		else if (event.clientX < midpoint && bubble.previousElementSibling?.id !== "dragged-bubble") {
			bubble.before(draggedBubble);
		}
		return false;
	}

	function onBubbleDragEnd(_) {
		bubbleDraggedIndex = null;
		let bubble = document.getElementById("dragged-bubble");
		if (bubble) {
			bubble.style = "";
			bubble.removeAttribute("id");
		}
		// Manual call to resize after delay to avoid strange mozilla behaviors that affect
		// subsequent drag events when resizing happens around the same time as drag events
		setTimeout(() => {
			_resizeWindow();
		}, 50);
		lockEditorHeight(false);
	}

	/**
	 * Get index of bubble in citations
	 */
	function _getBubbleIndex(bubble) {
		var nodes = editor.childNodes, index = 0;
		for (let node of nodes) {
			if (node.dataset && node.dataset.citationItem) {
				if (node == bubble) return index;
				index++;
			}
		}
		return -1;
	}
	
	/**
	 * Drop dragged bubble into the editor
	 */
	var _onEditorDrop = Zotero.Promise.coroutine(function* (event) {
		event.preventDefault();
		event.stopPropagation();
		let bubble = document.getElementById("dragged-bubble");
		if (bubbleDraggedIndex === null || !bubble) return;

		// If moved out of order, turn off "Keep Sources Sorted"
		if(io.sortable && keepSorted && keepSorted.hasAttribute("checked")
			&& bubbleDraggedIndex != _getBubbleIndex(bubble)) {
			keepSorted.removeAttribute("checked");
		}

		onBubbleDragEnd();

		yield _previewAndSort();
	});
	
	/**
	 * Handle a click on a bubble
	 */
	function _onBubbleClick(_) {
		// If citation properties dialog is opened for another bubble, just close it.
		if (panelRefersToBubble) {
			itemPopover.hidePopup();
			return;
		}
		_showItemPopover(this);
	}

	/**
	 * Called when the user attempts to paste
	 */
	function _onPaste(event) {
		event.stopPropagation();
		event.preventDefault();

		var str = Zotero.Utilities.Internal.getClipboard("text/plain");
		if (str) {
			isPaste = true;
			this.value += str.replace(/[\r\n]/g, " ").trim();
			let width = getContentWidth(this);
			this.style.width = width + 'px';
			// Move curor to the end
			this.setSelectionRange(str.length, str.length);
			_resetSearchTimer();
		}
	}
	
	/**
	 * Handle changes to citation properties
	 */
	this.onCitationPropertiesChanged = function(event) {
		let citationItem = JSON.parse(panelRefersToBubble.dataset.citationItem || "{}");
		if(itemPopoverPrefix.value) {
			citationItem["prefix"] = itemPopoverPrefix.value;
		} else {
			delete citationItem["prefix"];
		}
		if(itemPopoverSuffix.value) {
			citationItem["suffix"] = itemPopoverSuffix.value;
		} else {
			delete citationItem["suffix"];
		}
		if(itemPopoverLocator.value) {
			citationItem["locator"] = itemPopoverLocator.value;
			citationItem["label"] = itemPopoverLocatorLabel.selectedItem.value;
		} else {
			delete citationItem["locator"];
			delete citationItem["label"];
		}
		if(itemPopoverSuppressAuthor.checked) {
			citationItem["suppress-author"] = true;
		} else {
			delete citationItem["suppress-author"];
		}
		panelRefersToBubble.dataset.citationItem = JSON.stringify(citationItem);
		panelRefersToBubble.textContent = _buildBubbleString(citationItem);
	};

	this.ignoreEvent = function (event) {
		event.stopPropagation();
	};
	
	/**
	 * Handle closing citation properties panel
	 */
	this.onItemPopoverClosed = function(event) {
		if (!panelRefersToBubble) {
			return;
		}
		panelRefersToBubble.removeAttribute("selected");
		Zotero_QuickFormat.onCitationPropertiesChanged();
		// On ArrowUp from the citation popup, keep focus on the bubble
		if (skipInputRefocus) {
			panelRefersToBubble.focus();
			skipInputRefocus = false;
		}
		else {
			refocusInput();
		}
		panelRefersToBubble = null;
	}
	
	/**
	 * Keyboard navigation within citation properties dialog
	 */
	this.onPanelKeyPress = function(event) {
		let stopEvent = () => {
			event.stopPropagation();
			event.preventDefault();
		};
		// Tabbing through the fields. This should not be necessary but for some reason
		// without manually handling focus, the buttons are skipped during tabbing
		if (event.key === "Tab") {
			event.preventDefault();
			let tabIndex = parseInt(event.target.closest("[tabindex]").getAttribute("tabindex"));
			tabIndex += event.shiftKey ? -1 : 1;
			if (tabIndex == 9) {
				tabIndex = 1;
			}
			if (tabIndex == 0) {
				tabIndex = 8;
			}

			itemPopover.querySelector(`[tabindex='${tabIndex}']`).focus();
		}
		// Space or enter triggers a click on buttons, checkboxes or menulist
		if (event.key == ' ' || event.key === "Enter") {
			if (event.target.tagName == "button"
				|| event.target.getAttribute("type") == "checkbox") {
				event.target.click();
				return stopEvent();
			}
			else if (event.target.tagName == "menulist") {
				event.target.firstChild.openPopup();
				return stopEvent();
			}
		}
		// Arrow up closes the popup
		if (event.key === "ArrowUp") {
			skipInputRefocus = true;
			itemPopover.hidePopup();
			return stopEvent();
		}
		// Close on Escape or Enter and record when it happened to throttle the next
		// window close attempt
		if (["Enter", "Escape"].includes(event.key)) {
			_itemPopoverClosed = new Date();
			itemPopover.hidePopup();
		}
	};
	
	/**
	 * Handle checking/unchecking "Keep Citations Sorted"
	 */
	this.onKeepSortedCommand = function(event) {
		_previewAndSort();
	};
	
	/**
	 * Open classic Add Citation window
	 */
	this.onClassicViewCommand = function(event) {
		_updateCitationObject();
		var newWindow = window.newWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(null, 'chrome://zotero/content/integration/addCitationDialog.xhtml',
			'', 'chrome,centerscreen,resizable', io);
		newWindow.addEventListener("focus", function() {
			newWindow.removeEventListener("focus", arguments.callee, true);
			window.close();
		}, true);
		accepted = true;
	}
	
	/**
	 * Show an item in the library it came from
	 */
	this.showInLibrary = async function (itemID) {
		let citationItem = JSON.parse(panelRefersToBubble?.dataset.citationItem || "{}");
		var id = itemID || citationItem.id;
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
	
	/**
	 * Resizes windows
	 * @constructor
	 */
	var Resizer = function(panel, targetWidth, targetHeight, pixelsPerStep, stepsPerSecond) {
		this.panel = panel;
		this.curWidth = panel.clientWidth;
		this.curHeight = panel.clientHeight;
		this.difX = (targetWidth ? targetWidth - this.curWidth : 0);
		this.difY = (targetHeight ? targetHeight - this.curHeight : 0);
		this.step = 0;
		this.steps = Math.ceil(Math.max(Math.abs(this.difX), Math.abs(this.difY))/pixelsPerStep);
		this.timeout = (1000/stepsPerSecond);
		
		var me = this;
		this._animateCallback = function() { me.animate() };
	};
	
	/**
	 * Performs a step of the animation
	 */
	Resizer.prototype.animate = function() {
		if(this.stopped) return;
		this.step++;
		this.panel.sizeTo(this.curWidth+Math.round(this.step*this.difX/this.steps),
			this.curHeight+Math.round(this.step*this.difY/this.steps));
		if(this.step !== this.steps) {
			window.setTimeout(this._animateCallback, this.timeout);
		}
	};
	
	/**
	 * Halts resizing
	 */
	Resizer.prototype.stop = function() {
		this.stopped = true;
	};
}

window.addEventListener("DOMContentLoaded", Zotero_QuickFormat.onDOMContentLoaded, false);
window.addEventListener("load", Zotero_QuickFormat.onLoad, false);
