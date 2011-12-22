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

var Zotero_QuickFormat = new function () {
	var io, qfs, qfi, qfiWindow, qfiDocument, qfe, qfb, qfbHeight, keepSorted, showEditor,
		referencePanel, referenceBox, referenceHeight, separatorHeight, dragX, dragY, curLocator,
		curLocatorLabel, curIDs = [], curResizer, dragging;
	
	// A variable that contains the timeout object for the latest onKeyPress event
	var eventTimeout = null;
	
	const SHOWN_REFERENCES = 7;
	
	/**
	 * Pre-initialization, when the dialog has loaded but has not yet appeared
	 */
	this.onDOMContentLoaded = function() {
		io = window.arguments[0].wrappedJSObject;
		
		// Only hide chrome on Windows or Mac
		if(Zotero.isMac || Zotero.isWin) {
			document.documentElement.setAttribute("hidechrome", true);
		}
		
		qfs = document.getElementById("quick-format-search");
		qfi = document.getElementById("quick-format-iframe");
		qfb = document.getElementById("quick-format-entry");
		qfbHeight = qfb.scrollHeight;
		referencePanel = document.getElementById("quick-format-reference-panel");
		referenceBox = document.getElementById("quick-format-reference-list");
		qfiWindow = qfi.contentWindow;
		qfiDocument = qfi.contentDocument;
		qfb.addEventListener("keypress", _onQuickSearchKeyPress, false);
		qfe = qfiDocument.getElementById("quick-format-editor");
		
		if(Zotero.isWin && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')) {
			qfb.setAttribute("square", "true");
		}
		
		// add labels to popup
		var locators = Zotero.Cite.labels;
		var menu = document.getElementById("locator-label");
		var labelList = document.getElementById("locator-label-popup");
		for each(var locator in locators) {
			// TODO localize
			var locatorLabel = locator[0].toUpperCase()+locator.substr(1);
			
			// add to list of labels
			var child = document.createElement("menuitem");
			child.setAttribute("value", locator);
			child.setAttribute("label", locatorLabel);
			labelList.appendChild(child);
		}
		menu.selectedIndex = 0;
		
		keepSorted = document.getElementById("keep-sorted");
		showEditor = document.getElementById("show-editor");
		if(io.sortable) {
			keepSorted.hidden = false;
			if(!io.citation.properties.unsorted) {
				keepSorted.setAttribute("checked", "true");
			}
		}
		
		window.sizeToContent();
	}
	
	/**
	 * Initialize add citation dialog
	 */
	this.onLoad = function() {
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
		
		window.focus();
		qfe.focus();
		
		// load citation data
		if(io.citation.citationItems.length) {
			// hack to get spacing right
			var evt = qfiDocument.createEvent("KeyboardEvent");
			evt.initKeyEvent("keypress", true, true, qfiWindow,
				0, 0, 0, 0,
				0, " ".charCodeAt(0))
			qfe.dispatchEvent(evt);
			window.setTimeout(function() {				
				var node = qfe.firstChild;
				node.nodeValue = "";
				_showCitation(node);
				_resize();
			}, 1);
		}
	};
	
	function _refocusQfe() {
		window.focus();
		qfe.focus();
		referencePanel.blur();
	}
	
	/**
	 * Gets the content of the text node that the cursor is currently within
	 */
	function _getCurrentEditorTextNode() {
		var selection = qfiWindow.getSelection();
		var range = selection.getRangeAt(0);
		
		var node = range.startContainer;
		if(node !== range.endContainer || node.nodeType !== Node.TEXT_NODE ) {
			return false;
		}
		
		return node;
	}
	
	/**
	 * Gets text within the currently selected node
	 * @param {Boolean} [clear] If true, also remove these nodes
	 */
	function _getEditorContent(clear) {
		var node = _getCurrentEditorTextNode();
		return node ? node.textContent : false;
	}
	
	/**
	 * Does the dirty work of figuring out what the user meant to type
	 */
	function _quickFormat() {
		var str = _getEditorContent();
		var haveConditions = false;
		
		const specifiedLocatorRe = /^(?:,? *(pp|p)(?:\. *| +)|:)([0-9\-]+) *$/;
		const yearPageLocatorRe = /,? *([0-9]+) *((B[. ]*C[. ]*|B[. ]*)|[AC][. ]*|A[. ]*D[. ]*|C[. ]*E[. ]*)?,? *(?:([0-9\-]+))?$/i;
		const creatorSplitRe = /(?:,| *(?:and|\&)) +/;
		const charRe = /[\w\u007F-\uFFFF]/;
		const numRe = /^[0-9\-]+$/;
		const etAl = " et al.";
		
		var m,
			year = false,
			isBC = false,
			dateID = false;
		
		curLocator = false;
		curLocatorLabel = false;
		
		// check for adding a number onto a previous page number
		if(numRe.test(str)) {
			// add to previous cite
			var node = _getCurrentEditorTextNode();
			var prevNode = node.previousSibling;
			if(prevNode && prevNode.citationItem && prevNode.citationItem.locator) {
				prevNode.citationItem.locator += str;
				prevNode.value = _buildBubbleString(prevNode.citationItem);
				node.nodeValue = "";
				_clearEntryList();
				return;
			}
		}
		
		if(str && str.length > 1) {
			// check for specified locator
			m = specifiedLocatorRe.exec(str);
			if(m) {
				if(m.index === 0) {
					// add to previous cite
					var node = _getCurrentEditorTextNode();
					var prevNode = node.previousSibling;
					if(prevNode && prevNode.citationItem) {
						prevNode.citationItem.locator = m[2];
						prevNode.value = _buildBubbleString(prevNode.citationItem);
						node.nodeValue = "";
						_clearEntryList();
						return;
					}
				}
				
				// TODO support types other than page
				curLocator = m[2];
				str = str.substring(0, m.index);
			}
			
			// check for year and pages
			m = yearPageLocatorRe.exec(str);
			if(m) {
				if(m[1].length === 4 || m[2] || m[4]) {
					year = parseInt(m[1]);
					if(m[3]) {
						isBC = true;
					}
					if(!curLocator && m[4]) {
						curLocator = m[4];
					}
				} else {
					curLocator = m[1];
				}
				
				str = str.substr(0, m.index)+str.substring(m.index+m[0].length);
			}
			if(year) str += " "+year;
			
			var s = new Zotero.Search();
			str = str.replace(" & ", " ", "g").replace(" and ", " ", "g");
			if(charRe.test(str)) {
				Zotero.debug("QuickFormat: QuickSearch: "+str);
				s.addCondition("quicksearch-titleCreatorYear", "contains", str);
				s.addCondition("itemType", "isNot", "attachment");
				haveConditions = true;
			}
		}
		
		if(haveConditions) {		
			var searchResultIDs = (haveConditions ? s.search() : []);
			
			// No need to refresh anything if box hasn't changed
			if(searchResultIDs.length === curIDs.length) {
				var mismatch = false;
				for(var i=0; i<searchResultIDs.length; i++) {
					if(curIDs[i] !== searchResultIDs[i]) {
						mismatch = true;
						break;
					}
				}
				if(!mismatch) {
					_resize();
					return;
				}
			}
			curIDs = searchResultIDs;
			
			// Check to see which search results match items already in the document
			var citedItems, completed = false, isAsync = false;
			io.getItems(function(citedItems) {
				// Don't do anything if panel is already closed
				if(isAsync && referencePanel.state !== "open" && referencePanel.state !== "showing") return;
				
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
						var item = citedItems[i],
							itemStr = [creator.ref.firstName+" "+creator.ref.lastName for each(creator in item.getCreators())];
						itemStr = itemStr.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)]).join(" ");
						
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
				
				_updateItemList(citedItemsMatchingSearch, searchResultIDs, isAsync);
			});
			
			if(!completed) {
				// We are going to have to wait until items have been retrieved from the document.
				// Until then, show item list without cited items.
				_updateItemList(false, searchResultIDs);
				isAsync = true;
			}
		} else {
			// No search conditions, so just clear the box
			_updateItemList([], []);
		}
	}
	
	/**
	 * Sorts items
	 */
	function _itemSort(a, b) {
		// Sort by library ID
		var libA = a.libraryID, libB = b.libraryID;
		if(libA !== libB) {
			return libA - libB;
		}
	
		// Sort by last name of first author
		var creatorsA = a.getCreators(), creatorsB = b.getCreators(),
			caExists = creatorsA.length ? 1 : 0, cbExists = creatorsB.length ? 1 : 0;
		if(caExists !== cbExists) {
			return cbExists-caExists;
		} else if(caExists) {
			return creatorsA[0].ref.lastName.localeCompare(creatorsB[0].ref.lastName);
		}
		
		// Sort by date
		var yearA = a.getField("date", true, true).substr(0, 4),
			yearB = b.getField("date", true, true).substr(0, 4);
		return yearA - yearB;
	}
	
	/**
	 * Updates the item list
	 */
	function _updateItemList(citedItems, searchResultIDs, preserveSelection) {
		var selectedIndex = 1, previousItemID;
		
		// Do this so we can preserve the selected item after cited items have been loaded
		if(preserveSelection && referenceBox.selectedIndex !== 2) {
			previousItemID = parseInt(referenceBox.selectedItem.getAttribute("zotero-item"), 10);
		}
		
		while(referenceBox.hasChildNodes()) referenceBox.removeChild(referenceBox.firstChild);
		
		if(!citedItems) {
			// We don't know whether or not we have cited items, because we are waiting for document
			// data
			referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.cited.loading")));
			selectedIndex = 2;
		} else if(citedItems.length) {
			// We have cited items
			referenceBox.appendChild(_buildListSeparator(Zotero.getString("integration.cited")));
			for(var i=0, n=citedItems.length; i<n; i++) {
				referenceBox.appendChild(_buildListItem(citedItems[i]));
			}
		}

		if(searchResultIDs.length && (!citedItems || citedItems.length < 50)) {
			// Don't handle more than 50 results
			if(searchResultIDs.length > 50-citedItems.length) {
				searchResultIDs = searchResultIDs.slice(0, 50-citedItems.length);
			}
			
			var items = Zotero.Items.get(searchResultIDs);
			items.sort(_itemSort);
			
			var previousLibrary = -1;
			for(var i=0, n=items.length; i<n; i++) {
				var item = items[i], libraryID = item.libraryID;
				
				if(previousLibrary != libraryID) {
					var libraryName = libraryID ? Zotero.Libraries.getName(libraryID)
						: Zotero.getString('pane.collections.library');
					referenceBox.appendChild(_buildListSeparator(libraryName));
				}

				referenceBox.appendChild(_buildListItem(item));
				previousLibrary = libraryID;
				
				if(preserveSelection && (item.cslItemID ? item.cslItemID : item.id) === previousItemID) {
					selectedIndex = referenceBox.childNodes.length-1;
				}
			}
		}
		
		_resize();
		if((citedItems && citedItems.length) || searchResultIDs.length) {
			referenceBox.selectedIndex = selectedIndex;
			referenceBox.ensureIndexIsVisible(selectedIndex);
		}
	}
	
	/**
	 * Builds a string describing an item. We avoid CSL here for speed.
	 */
	function _buildItemDescription(item, infoHbox) {
		var nodes = [];
		
		var author, authorDate = "";
		if(item.firstCreator) author = authorDate = item.firstCreator;
		var date = item.getField("date", true);
		if(date && (date = date.substr(0, 4)) !== "0000") {
			authorDate += " ("+date+")";
		}
		authorDate = authorDate.trim();
		if(authorDate) nodes.push(authorDate);
		
		var publicationTitle = item.getField("publicationTitle", false, true);
		if(publicationTitle) {
			var label = document.createElement("label");
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
		var str = "";
		for(var i=0, n=nodes.length; i<n; i++) {
			var node = nodes[i];
			
			if(i != 0) str += ", ";
			
			if(typeof node === "object") {
				var label = document.createElement("label");
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
		var label = document.createElement("label");
		label.setAttribute("value", str);
		label.setAttribute("crop", "end");
		label.setAttribute("flex", "1");
		infoHbox.appendChild(label);
	}
	
	/**
	 * Creates an item to be added to the item list
	 */
	function _buildListItem(item) {
		var titleNode = document.createElement("label");
		titleNode.setAttribute("class", "quick-format-title");
		titleNode.setAttribute("flex", "1");
		titleNode.setAttribute("crop", "end");
		titleNode.setAttribute("value", item.getDisplayTitle());
		
		var infoNode = document.createElement("hbox");
		infoNode.setAttribute("class", "quick-format-info");
		_buildItemDescription(item, infoNode);
		
		// add to rich list item
		var rll = document.createElement("richlistitem");
		rll.setAttribute("orient", "vertical");
		rll.setAttribute("flex", "1");
		rll.setAttribute("class", "quick-format-item");
		rll.setAttribute("zotero-item", item.cslItemID ? item.cslItemID : item.id);
		rll.appendChild(titleNode);
		rll.appendChild(infoNode);
		rll.addEventListener("click", _bubbleizeSelected, false);
		
		return rll;
	}

	/**
	 * Creates a list separator to be added to the item list
	 */
	function _buildListSeparator(labelText, loading) {
		var titleNode = document.createElement("label");
		titleNode.setAttribute("class", "quick-format-separator-title");
		titleNode.setAttribute("flex", "1");
		titleNode.setAttribute("crop", "end");
		titleNode.setAttribute("value", labelText);
		
		// add to rich list item
		var rll = document.createElement("richlistitem");
		rll.setAttribute("orient", "vertical");
		rll.setAttribute("flex", "1");
		rll.setAttribute("disabled", true);
		rll.setAttribute("class", loading ? "quick-format-loading" : "quick-format-separator");
		rll.appendChild(titleNode);
		rll.addEventListener("mousedown", _ignoreClick, true);
		rll.addEventListener("click", _ignoreClick, true);
		
		return rll;
	}
	
	/**
	 * Builds the string to go inside a bubble
	 */
	function _buildBubbleString(citationItem) {
		var item = Zotero.Cite.getItem(citationItem.id);
		// create text for bubble
		var title, delimiter;
		var str = item.getField("firstCreator");
		if(!str) {
			// TODO localize quotes
			str = '"'+item.getField("title")+'"';
		}
		
		var date = item.getField("date", true);
		if(date && (date = date.substr(0, 4)) !== "0000") {
			str += ", "+date;
		}
		
		if(citationItem.locator) {
			str += ", "+(citationItem.locator.indexOf("-") !== -1 || citationItem.locator.indexOf("–") !== -1 ? "pp" : "p")+". "+citationItem.locator;
		}
		
		return str;
	}
	
	/**
	 * Insert a bubble into the DOM at a specified position
	 */
	function _insertBubble(citationItem, nextNode) {
		var str = _buildBubbleString(citationItem);
		
		// It's entirely unintuitive why, but after trying a bunch of things, it looks like using
		// a XUL label for these things works best. A regular span causes issues with moving the
		// cursor.
		var bubble = qfiDocument.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "label");
		bubble.setAttribute("class", "quick-format-bubble");
		bubble.setAttribute("value", str);
		bubble.addEventListener("click", _onBubbleClick, false);
		bubble.addEventListener("dragstart", _onBubbleDrag, false);
		bubble.addEventListener("dragend", _onBubbleDrop, false);
		bubble.citationItem = citationItem;
		qfe.insertBefore(bubble, (nextNode ? nextNode : null));
		
		// make sure that there are no rogue <br>s
		var elements = qfe.getElementsByTagName("br");
		while(elements.length) {
			elements[0].parentNode.removeChild(elements[0]);
		}
		return bubble;
	}
	
	/**
	 * Clear list of bubbles
	 */
	function _clearEntryList() {
		while(referenceBox.hasChildNodes()) referenceBox.removeChild(referenceBox.firstChild);
		_resize();
	}
	
	/**
	 * Converts the selected item to a bubble
	 */
	function _bubbleizeSelected() {
		if(!referenceBox.hasChildNodes() || !referenceBox.selectedItem) return false;
		
		var citationItem = {"id":referenceBox.selectedItem.getAttribute("zotero-item")};
		if(typeof citationItem.id === "string" && citationItem.id.indexOf("/") !== -1) {
			var item = Zotero.Cite.getItem(citationItem.id);
			citationItem.uris = item.cslURIs;
			citationItem.itemData = item.cslItemData;
		}
		if(curLocator) {
			 citationItem["locator"] = curLocator;
			if(curLocatorLabel) {
				citationItem["label"] = curLocatorLabel;
			}
		}
		
		// get next node and clear this one
		var node = _getCurrentEditorTextNode();
		node.nodeValue = "";
		var bubble = _insertBubble(citationItem, node);
		_clearEntryList();
		_previewAndSort();
		_refocusQfe();
		
		return true;
	}
	
	/**
	 * Ignores clicks (for use on separators in the rich list box)
	 */
	function _ignoreClick(e) {
		e.stopPropagation();
		e.preventDefault();
	}
	
	/**
	 * Resizes window to fit content
	 */
	function _resize() {
		var childNodes = referenceBox.childNodes,
			numReferences = 0,
			numSeparators = 0,
			firstReference,
			firstSeparator,
			height;
		for(var i=0, n=childNodes.length; i<n && numReferences < SHOWN_REFERENCES; i++) {
			if(childNodes[i].className === "quick-format-item") {
				numReferences++;
				firstReference = childNodes[i];
			} else if(childNodes[i].className === "quick-format-separator") {
				numSeparators++;
				firstSeparator = childNodes[i];
			}
		}
		
		var qfeHeight = qfe.scrollHeight;
		
		if(qfeHeight > 30) {
			qfe.setAttribute("multiline", true);
			qfs.setAttribute("multiline", true);
			qfeHeight = qfe.scrollHeight;
			var height = 4+qfeHeight;
			
			qfs.style.height = height+"px";
			window.sizeToContent();
		} else {
			delete qfs.style.height;
			qfe.removeAttribute("multiline");
			qfs.removeAttribute("multiline");
			window.sizeToContent();
		}
		
		var panelShowing = referencePanel.state === "open" || referencePanel.state === "showing";
		
		if(numReferences) {
			var height = referenceHeight ? 
				Math.min(numReferences*referenceHeight+1+numSeparators*separatorHeight) : 39;
			
			if(panelShowing && height !== referencePanel.clientHeight) {
				referencePanel.sizeTo((window.outerWidth-30), height);
				/*if(curResizer) curResizer.stop();
				curResizer = new Resizer(referencePanel, null, height, 30, 1000);
				curResizer.animate();*/
			} else {
				referencePanel.sizeTo((window.outerWidth-30), height);
				referencePanel.openPopup(document.documentElement, "after_start", 15, null,
					false, false, null);
				
				if(!referenceHeight) {
					separatorHeight = firstSeparator.scrollHeight;
					referenceHeight = firstReference.scrollHeight;
					height = Math.min(numReferences*referenceHeight+1+numSeparators*separatorHeight);
					referencePanel.sizeTo((window.outerWidth-30), height);
				}
			}
		} else {
			if(panelShowing) {
				referencePanel.hidePopup();
				referencePanel.sizeTo(referencePanel.clientWidth, 0);
			}
		}
	}
	
	/**
	 * Clears all citations
	 */
	function _clearCitation() {
		var citations = qfe.getElementsByClassName("quick-format-bubble");
		while(citations.length) {
			citations[0].parentNode.removeChild(citations[0]);
		}
	}
	
	/**
	 * Shows citations in the citation object
	 */
	function _showCitation(insertBefore) {
		if(!io.citation.properties.unsorted
				&& keepSorted.hasAttribute("checked")
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
		var nodes = qfe.childNodes;
		io.citation.citationItems = [];
		for(var i=0, n=nodes.length; i<n; i++) {
			if(nodes[i].citationItem) io.citation.citationItems.push(nodes[i].citationItem);
		}
		
		if(io.sortable) {
			if(keepSorted.hasAttribute("checked")) {
				delete io.citation.properties.unsorted;
			} else {
				io.citation.properties.unsorted = true;
			}
		}
	}
	
	/**
	 * Move cursor to end of the textbox
	 */
	function _moveCursorToEnd() {
		var nodeRange = qfiDocument.createRange();
		nodeRange.selectNode(qfe.lastChild);
		nodeRange.collapse(false);
		
		var selection = qfiWindow.getSelection();
		selection.removeAllRanges();
		selection.addRange(nodeRange);
	}
	
	/**
	 * Generates the preview and sorts citations
	 */
	function _previewAndSort() {
		var shouldKeepSorted = keepSorted.hasAttribute("checked"),
			editorShowing = showEditor.hasAttribute("checked");
		if(!shouldKeepSorted && !editorShowing) return;
		
		_updateCitationObject();
		io.sort();
		if(shouldKeepSorted) {
			// means we need to resort citations
			_clearCitation();
			_showCitation();
			
			// select past last citation
			var lastBubble = qfe.getElementsByClassName("quick-format-bubble");
			lastBubble = lastBubble[lastBubble.length-1];
			
			_moveCursorToEnd();
		}
	}
	
	/**
	 * Shows the citation properties panel for a given bubble
	 */
	function _showCitationProperties(target) {
		var panel = document.getElementById("citation-properties");
		var prefix = document.getElementById("prefix");
		var suffix = document.getElementById("suffix");
		var suppressAuthor = document.getElementById("suppress-author");
		var locatorLabel = document.getElementById("locator-label");
		var locator = document.getElementById("locator");
		var info = document.getElementById("citation-properties-info");
		
		prefix.value = target.citationItem["prefix"] ? target.citationItem["prefix"] : "";
		suffix.value = target.citationItem["suffix"] ? target.citationItem["suffix"] : "";
		if(target.citationItem["label"]) {
			var option = locatorLabel.getElementsByAttribute("value", target.citationItem["label"]);
			if(option.length) {
				locatorLabel.selectedItem = option[0];
			} else {
				locatorLabel.selectedIndex = 0;
			}
		} else {
			locatorLabel.selectedIndex = 0;
		}
		locator.value = target.citationItem["locator"] ? target.citationItem["locator"] : "";
		suppressAuthor.checked = !!target.citationItem["suppress-author"];
		
		var item = Zotero.Cite.getItem(target.citationItem.id);
		document.getElementById("citation-properties-title").textContent = item.getDisplayTitle();
		while(info.hasChildNodes()) info.removeChild(info.firstChild);
		_buildItemDescription(item, info);
		
		target.setAttribute("selected", "true");
		panel.openPopup(target, "after_start",
			target.clientWidth/2, 0, false, false, null);
		locator.focus();
		
		var closeListener = function(event) {
			panel.removeEventListener("popuphidden", closeListener, false);
			target.removeAttribute("selected");
			if(prefix.value) {
				target.citationItem["prefix"] = prefix.value;
			} else {
				delete target.citationItem["prefix"];
			}
			if(suffix.value) {
				target.citationItem["suffix"] = suffix.value;
			} else {
				delete target.citationItem["suffix"];
			}
			if(locatorLabel.selectedIndex !== 0) {
				target.citationItem["label"] = locatorLabel.selectedItem.value;
			} else {
				delete target.citationItem["label"];
			}
			if(locator.value) {
				target.citationItem["locator"] = locator.value;
			} else {
				delete target.citationItem["locator"];
			}
			if(suppressAuthor.checked) {
				target.citationItem["suppress-author"] = true;
			} else {
				delete target.citationItem["suppress-author"];
			}
			target.value = _buildBubbleString(target.citationItem);
			_moveCursorToEnd();
		}
		panel.addEventListener("popuphidden", closeListener, false);
	}
	
	/**
	 * Called when progress changes
	 */
	function _onProgress(percent) {
		var meter = document.getElementById("quick-format-progress-meter");
		if(percent === null) {
			meter.mode = "undetermined";
		} else {
			meter.mode = "determined";
			meter.value = Math.round(percent);
		}
	}
	
	/**
	 * Accepts current selection and adds citation
	 */
	function _accept() {
		_updateCitationObject();
		document.getElementById("quick-format-deck").selectedIndex = 1;
		io.accept(_onProgress);
	}
	
	/**
	 * Handle escape for entire window
	 */
	this.onKeyPress = function(event) {
		var keyCode = event.keyCode;
		if(keyCode === event.DOM_VK_ESCAPE) {
			io.citation.citationItems = [];
			io.accept();
		}
	}
	
	/**
	 * Handle return or escape
	 */
	function _onQuickSearchKeyPress(event) {
		var keyCode = event.keyCode;
		if(keyCode === event.DOM_VK_RETURN || keyCode === event.DOM_VK_ENTER) {
			event.preventDefault();
			if(!_bubbleizeSelected() && !_getEditorContent()) {
				_accept();
			}
		} else if(keyCode === event.DOM_VK_TAB || event.charCode === 59 /* ; */) {
			event.preventDefault();
			_bubbleizeSelected();
		} else if(keyCode === event.DOM_VK_BACK_SPACE) {
			_resize();
			
			if(Zotero_QuickFormat.eventTimeout) clearTimeout(Zotero_QuickFormat.eventTimeout);
			Zotero_QuickFormat.eventTimeout = setTimeout(_quickFormat, 250);
			
		} else if(keyCode === event.DOM_VK_UP) {
			var selectedItem = referenceBox.selectedItem;

			var previousSibling;
			
			//Seek the closet previous sibling that is not disabled
			while((previousSibling = selectedItem.previousSibling) && previousSibling.getAttribute("disabled")){
				selectedItem = previousSibling;
			}
			//If found, change to that
			if(previousSibling) {
				referenceBox.selectedItem = previousSibling;
				
				//If there are separators before this item, ensure that they are visible
				var visibleItem = previousSibling;

				while(visibleItem.previousSibling && visibleItem.previousSibling.getAttribute("disabled")){
					visibleItem = visibleItem.previousSibling;
				}
				referenceBox.ensureElementIsVisible(visibleItem);
				event.preventDefault();
			};
		} else if(keyCode === event.DOM_VK_DOWN) {
			if((Zotero.isMac ? event.metaKey : event.ctrlKey)) {
				// If meta key is held down, show the citation properties panel
				var selection = qfiWindow.getSelection();
				var range = selection.getRangeAt(0);
				
				// Check whether the bubble is selected
				var endContainer = range.endContainer;
				if(endContainer !== qfe) {
					if(range.endContainer.citationItem) {
						_showCitationProperties(range.endContainer);
					} else if(endContainer.nodeType === Node.TEXT_NODE) {
						if(endContainer.parentNode === qfe) {
							var node = endContainer;
							while((node = endContainer.previousSibling)) {
								if(node.citationItem) {
									_showCitationProperties(node);
									event.preventDefault();
									return;
								}
							}
						}
					}
					event.preventDefault();
					return;
				}
				
				// Check whether there is a bubble in the range
				var endOffset = range.endOffset;
				var childNodes = qfe.childNodes;
				for(var i=Math.min(endOffset, childNodes.length-1); i>=0; i--) {
					var node = childNodes[i];
					if(node.citationItem) {
						_showCitationProperties(node);
						event.preventDefault();
						return;
					}
				}
				
				event.preventDefault();
			} else {
				var selectedItem = referenceBox.selectedItem;
				var nextSibling;
				
				//Seek the closet next sibling that is not disabled
				while((nextSibling = selectedItem.nextSibling) && nextSibling.getAttribute("disabled")){
					selectedItem = nextSibling;
				}
				
				//If found, change to that

				if(nextSibling){
					referenceBox.selectedItem = nextSibling;
					referenceBox.ensureElementIsVisible(nextSibling);
					event.preventDefault();
				};
			}
		} else {
			// Use a timeout so that _quickFormat gets called after update
			if(Zotero_QuickFormat.eventTimeout) clearTimeout(Zotero_QuickFormat.eventTimeout);
			Zotero_QuickFormat.eventTimeout = setTimeout(_quickFormat, 250);
		}
	}
	
	/**
	 * Adds a dummy element to make dragging work
	 */
	function _onBubbleDrag(event) {
		// just in case
		var el = qfiDocument.getElementById("zotero-drag");
		if(el) el.parentNode.removeChild(el);
		
		var dt = event.dataTransfer;
		dragging = event.target.citationItem;
		dt.setData("text/html", '<span id="zotero-drag"/>');
		event.stopPropagation();
	}
	
	/**
	 * Replaces the dummy element with a node to make dropping work
	 */
	function _onBubbleDrop(event) {
		window.setTimeout(function() {
			var el = qfiDocument.getElementById("zotero-drag");
			if(el) {
				_insertBubble(dragging, el);
				el.parentNode.removeChild(el);
			}
		}, 0);
	}
	
	/**
	 * Handle a click on a bubble
	 */
	function _onBubbleClick(event) {
		_showCitationProperties(event.target);
	}
	
	/**
	 * Makes "Enter" work in the panel
	 */
	this.onPanelKeyPress = function(event) {
		var keyCode = event.keyCode;
		if(keyCode === event.DOM_VK_RETURN || keyCode === event.DOM_VK_ENTER) {
			document.getElementById("citation-properties").hidePopup();
		}
	};
	
	/**
	 * Handle checking/unchecking "Keep Citations Sorted"
	 */
	this.onKeepSortedCommand = function(event) {
		_previewAndSort();
	};
	
	/**
	 * Handle checking/unchecking "Show Editor"
	 */
	this.onShowEditorCommand = function(event) {
	};
	
	/**
	 * Open classic Add Citation window
	 */
	this.onClassicViewCommand = function(event) {
		_updateCitationObject();
		var newWindow = window.newWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(null, 'chrome://zotero/content/integration/addCitationDialog.xul',
			'', 'chrome,centerscreen,resizable', io);
		newWindow.addEventListener("load", function() { window.close(); }, false);
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