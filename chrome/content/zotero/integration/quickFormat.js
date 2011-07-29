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
		referenceBox, referenceHeight, dragX, dragY, curLocator, curLocatorLabel, curIDs = [],
		curResizer, dragging;
	const SHOWN_REFERENCES = 7;
	
	this.onDOMContentLoaded = function() {
		io = window.arguments[0].wrappedJSObject;
		
		qfs = document.getElementById("quick-format-search");
		qfi = document.getElementById("quick-format-iframe");
		qfb = document.getElementById("quick-format-entry");
		qfbHeight = qfb.scrollHeight;
		referenceBox = document.getElementById("quick-format-reference-list");
		qfiWindow = qfi.contentWindow;
		qfiDocument = qfi.contentDocument;
		qfb.addEventListener("keypress", _onQuickSearchKeyPress, false);
		qfe = qfiDocument.getElementById("quick-format-editor");
		
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
	}
	
	/**
	 * Initialize add citation dialog
	 */
	this.onLoad = function() {
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
			}, 1);
		}
	};
	
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
		if(!str || str.length === 1) {
			// if only one char or no string, remove references and break
			while(referenceBox.hasChildNodes()) referenceBox.removeChild(referenceBox.firstChild);
			_resize();
			return;
		}
		
		const specifiedLocatorRe = /,? *(pp|p)(?:\. *| +)([0-9\-]+) *$/;
		const yearPageLocatorRe = /,? *([0-9]+) *((B[. ]*C[. ]*|B[. ]*)|[AC][. ]*|A[. ]*D[. ]*|C[. ]*E[. ]*)?,? *(?:([0-9\-]+))?$/i;
		const creatorSplitRe = /(?:,| *(?:and|\&)) +/;
		const charRe = /[\w\u007F-\uFFFF]/;
		const etAl = " et al.";
		
		var m,
			year = false,
			isBC = false,
			dateID = false;
		
		curLocator = false;
		curLocatorLabel = false;
		
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
		
		var s = new Zotero.Search();
		var haveConditions = false;
		
		if(charRe.test(str)) {
			Zotero.debug("QuickFormat: QuickSearch: "+str);
			s.addCondition("quicksearch-titlesAndCreators", "contains", str);
			haveConditions = true;
		}
		
		if(year) {
			Zotero.debug("QuickFormat: Year: "+year);
			s.addCondition("date", "isAfter", (year)+"-01-01 00:00:00");
			s.addCondition("date", "isBefore", (year)+"-12-31 23:59:59");
			haveConditions = true;
		}
		
		var ids = (haveConditions ? s.search() : []);
		
		// no need to refresh anything if box hasnt changed
		if(ids.length === curIDs.length) {
			var mismatch = false;
			for(var i=0; i<ids.length; i++) {
				if(curIDs[i] !== ids[i]) {
					mismatch = true;
					break;
				}
			}
			if(!mismatch) return;
		}
		curIDs = ids;
		
		while(referenceBox.hasChildNodes()) referenceBox.removeChild(referenceBox.firstChild);
		
		if(ids.length) {
			if(ids.length > 50) ids = ids.slice(0, 50);
			var items = Zotero.Items.get(ids);
			for(var i=0, n=items.length; i<n; i++) {
				referenceBox.appendChild(_buildListItem(items[i]));
			}
			referenceBox.ensureIndexIsVisible(0);
		}
		
		_resize();
		
		referenceBox.selectedIndex = 0;
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
		
		var nodes = [];
		
		// do some basic bibliography formatting; not using CSL here for speed
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
				infoNode.appendChild(label);
				infoNode.appendChild(node);
				str = "";
			} else {
				str += node;
			}
		}
		
		if(nodes.length && (!str.length || str[str.length-1] !== ".")) str += "."
		
		if(str) {
			var label = document.createElement("label");
			label.setAttribute("value", str);
			label.setAttribute("crop", "end");
			label.setAttribute("flex", "1");
			infoNode.appendChild(label);
		}
		
		// add to rich list item
		var rll = document.createElement("richlistitem");
		rll.setAttribute("orient", "vertical");
		rll.setAttribute("flex", "1");
		rll.setAttribute("class", "quick-format-item");
		rll.setAttribute("zotero-item", item.id);
		rll.appendChild(titleNode);
		rll.appendChild(infoNode);
		rll.addEventListener("click", _bubbleizeSelected, false);
		
		return rll;
	}
	
	/**
	 * Builds the string to go inside a bubble
	 */
	function _buildBubbleString(citationItem) {
		var item = Zotero.Items.get(citationItem.id);
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
		
		return true;
	}
	
	/**
	 * Resizes window to fit content
	 */
	function _resize() {
		var numReferences = referenceBox.childNodes.length, height;
		var qfeHeight = qfe.scrollHeight;
		if(numReferences) {
			referenceBox.hidden = false;
			if(!referenceHeight) {
				referenceHeight = referenceBox.firstChild.scrollHeight;
			}		
			height = qfbHeight+qfeHeight-14+
				+(numReferences < SHOWN_REFERENCES ? numReferences : SHOWN_REFERENCES)*referenceHeight;
		} else {
			referenceBox.hidden = true;
			height = qfbHeight+qfeHeight-14;
		}
		
		if(height === window.innerHeight) return;
		if(qfeHeight > 20) {
			qfs.style.height = (22-16+qfeHeight+(qfs.style.height == "22px" ? 2 : -2))+"px";
			qfe.style.lineHeight = "18px";
			qfs.setAttribute("multiline", true);
		} else {
			qfs.style.height = "22px";
			qfe.style.lineHeight = "16px";
			qfs.removeAttribute("multiline");
		}
		if(curResizer) curResizer.stop();
		curResizer = new Resizer(window, null, height, 10, 100);
		curResizer.animate();
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
	 * Generates the preview and sorts citations
	 */
	function _previewAndSort() {
		var shouldKeepSorted = keepSorted.hasAttribute("checked"),
			editorShowing = showEditor.hasAttribute("checked");
		if(!shouldKeepSorted && !editorShowing) return;
		
		_updateCitationObject();
		io.previewFunction();
		if(shouldKeepSorted) {
			// means we need to resort citations
			_clearCitation();
			_showCitation();
			
			// select past last citation
			var lastBubble = qfe.getElementsByClassName("quick-format-bubble");
			lastBubble = lastBubble[lastBubble.length-1];
			
			var nodeRange = qfiDocument.createRange();
			nodeRange.selectNode(lastBubble);
			nodeRange.collapse(false);
			
			var selection = qfiWindow.getSelection();
			selection.removeAllRanges();
			selection.addRange(nodeRange);
		}
	}
	
	/**
	 * Accepts current selection and adds citation
	 */
	function _accept() {
		_updateCitationObject();
		window.close();
	}
	
	/**
	 * Handle escape for entire window
	 */
	this.onKeyPress = function(event) {
		var keyCode = event.keyCode;
		if(keyCode === event.DOM_VK_ESCAPE) {
			window.close();
		}
	}
	
	/**
	 * Handle return or escape
	 */
	function _onQuickSearchKeyPress(event) {
		try {
			var keyCode = event.keyCode;
			if(keyCode === event.DOM_VK_RETURN || keyCode === event.DOM_VK_ENTER) {
				event.preventDefault();
				if(!_bubbleizeSelected()) {
					_accept();
				}
			} else if(keyCode === event.DOM_VK_TAB || event.charCode === 59 /* ; */) {
				event.preventDefault();
				_bubbleizeSelected();
			} else if(keyCode === event.DOM_VK_UP) {
				var selectedItem = referenceBox.selectedItem;
				var previousSibling;
				if((previousSibling = selectedItem.previousSibling)) {
					referenceBox.selectedItem = previousSibling;
					referenceBox.ensureElementIsVisible(previousSibling);
					event.preventDefault();
				};
			} else if(keyCode === event.DOM_VK_DOWN) {
				var selectedItem = referenceBox.selectedItem;
				var nextSibling;
				if((nextSibling = selectedItem.nextSibling)) {
					referenceBox.selectedItem = nextSibling;
					referenceBox.ensureElementIsVisible(nextSibling);
					event.preventDefault();
				};
			} else {
				// Use a timeout so that _quickFormat gets called after update
				window.setTimeout(_quickFormat, 0);
			}
		} catch(e) {
			Zotero.logError(e);
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
		var target = event.target;
		var panel = document.getElementById("citation-properties");
		var prefix = document.getElementById("prefix");
		var suffix = document.getElementById("suffix");
		var suppressAuthor = document.getElementById("suppress-author");
		var locatorLabel = document.getElementById("locator-label");
		var locator = document.getElementById("locator");
		
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
		
		target.setAttribute("selected", "true");
		panel.openPopup(target, "after_start",
			target.clientWidth/2, 0, false, false, event);
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
		}
		panel.addEventListener("popuphidden", closeListener, false);
	}
	
	/**
	 * Called when the user begins to drag the window
	 */
	this.onDragStart = function(el, event) {
		dragX = event.clientX;
		dragY = event.clientY;
		window.addEventListener("mousemove", _onDrag, false);
		window.addEventListener("mouseup", function() { window.removeEventListener("mousemove", _onDrag, false) }, false);
	}
	
	/**
	 * Called during the window drag
	 */
	function _onDrag(event) {
		window.moveTo(event.screenX-dragX, event.screenY-dragY);
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
	var Resizer = function(window, targetWidth, targetHeight, steps, time) {
		this.curWidth = window.innerWidth;
		this.curHeight = window.innerHeight;
		this.difX = (targetWidth ? targetWidth - this.curWidth : 0);
		this.difY = (targetHeight ? targetHeight - this.curHeight : 0);
		this.step = 0;
		this.steps = steps;
		this.timeout = time/steps;
		
		var me = this;
		this._animateCallback = function() { me.animate() };
	};
	
	/**
	 * Performs a step of the animation
	 */
	Resizer.prototype.animate = function() {
		if(this.stopped) return;
		this.step++;
		window.resizeTo(this.curWidth+Math.round(this.step*this.difX/this.steps),
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