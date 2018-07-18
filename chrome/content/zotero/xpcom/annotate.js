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

const TEXT_TYPE = Components.interfaces.nsIDOMNode.TEXT_NODE;

/**
 * Globally accessible functions relating to annotations
 * @namespace
 */
Zotero.Annotate = new function() {
	var _annotated = {};
	
	this.highlightColor = "#fff580";
	this.alternativeHighlightColor = "#555fa9";
	
	/**
	 * Gets the pixel offset of an item from the top left of a page
	 *
	 * @param {Node} node DOM node to get the pixel offset of
	 * @param {Integer} offset Text offset
	 * @return {Integer[]} X and Y coordinates
	 */
	this.getPixelOffset = function(node, offset) {
		var x = 0;
		var y = 0;
		
		do {
			x += node.offsetLeft;
			y += node.offsetTop;
			node = node.offsetParent;
		} while(node);
		
		return [x, y];
	}
	
	/**
	 * Gets the annotation ID from a given URL
	 */
	this.getAnnotationIDFromURL = function(url) {
		const attachmentRe = /^zotero:\/\/attachment\/([0-9]+)\/$/;
		var m = attachmentRe.exec(url);
		if (m) {
			var id = m[1];
			var item = Zotero.Items.get(id);
			var contentType = item.attachmentContentType;
			var file = item.getFilePath();
			var ext = Zotero.File.getExtension(file);
			if (contentType == 'text/plain' || !Zotero.MIME.hasNativeHandler(contentType, ext)) {
				return false;
			}
			return id;
		}
		return false;
	}
	
	/**
	 * Parses CSS/HTML color descriptions
	 *
	 * @return {Integer[]} An array of 3 values from 0 to 255 representing R, G, and B components
	 */
	this.parseColor = function(color) {
		const rgbColorRe = /rgb\(([0-9]+), ?([0-9]+), ?([0-9]+)\)/i;
		
		var colorArray = rgbColorRe.exec(color);
		if(colorArray) return [parseInt(colorArray[1]), parseInt(colorArray[2]), parseInt(colorArray[3])];
		
		if(color[0] == "#") color = color.substr(1);
		try	{
			colorArray = [];
			for(var i=0; i<6; i+=2) {
				colorArray.push(parseInt(color.substr(i, 2), 16));
			}
			return colorArray;
		} catch(e) {
			throw new Error("Annotate: parseColor passed invalid color");
		}
	}
	
	/**
	 * Gets the city block distance between two colors. Accepts colors in the format returned by
	 * Zotero.Annotate.parseColor()
	 *
	 * @param {Integer[]} color1
	 * @param {Integer[]} color2
	 * @return {Integer} The distance
	 */
	this.getColorDistance = function(color1, color2) {
		color1 = this.parseColor(color1);
		color2 = this.parseColor(color2);
		
		var distance = 0;
		for(var i=0; i<3; i++) {
			distance += Math.abs(color1[i] - color2[i]);
		}
		
		return distance;
	}
	
	/**
	 * Checks to see if a given item is already open for annotation
	 *
	 * @param {Integer} id An item ID
	 * @return {Boolean}
	 */
	this.isAnnotated = function(id) {
		const XUL_NAMESPACE = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		
		var annotationURL = "zotero://attachment/"+id+"/";
		var haveBrowser = false;
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while(enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			var tabbrowser = win.document.getElementsByTagNameNS(XUL_NAMESPACE, "tabbrowser");
			if(tabbrowser && tabbrowser.length) {
				var browsers = tabbrowser[0].browsers;
			} else {
				var browsers = win.document.getElementsByTagNameNS(XUL_NAMESPACE, "browser");
			}
			for (let browser of browsers) {
				if(browser.currentURI) {
					if(browser.currentURI.spec == annotationURL) {
						if(haveBrowser) {
							// require two with this URI
							return true;
						} else {
							haveBrowser = true;
						}
					}
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Sometimes, Firefox gives us a node offset inside another node, as opposed to a text offset
	 * This function replaces such offsets with references to the nodes themselves
	 *
	 * @param {Node} node DOM node
	 * @param {Integer} offset Node offset
	 * @return {Node} The DOM node after dereferencing has taken place
	 */
	this.dereferenceNodeOffset = function(node, offset) {
		if(offset != 0) {
			if(offset == node.childNodes.length) {
				node = node.lastChild;
			} else if(offset < node.childNodes.length) {
				node = node.childNodes[offset];
			} else {
				throw new Error("Annotate: dereferenceNodeOffset called with invalid offset "+offset);
			}
			if(!node) throw new Error("Annotate: dereferenceNodeOffset resolved to invalid node");
		}
		
		return node;
	}
	
	/**
	 * Normalizes a DOM range, resolving it to a range that begins and ends at a text offset and
	 * remains unchanged when serialized to a Zotero.Annotate.Path object
	 *
	 * @param {Range} selectedRange The range to normalize
	 * @param {Function} nsResolver Namespace resolver function
	 * @return {Zotero.Annotate.Path[]} Start and end paths
	 */
	this.normalizeRange = function(selectedRange, nsResolver) {
		var document = selectedRange.startContainer.ownerDocument;
		
		var container, offset;
		if(selectedRange.startContainer.nodeType != TEXT_TYPE) {
			[container, offset] = _getTextNode(selectedRange.startContainer, selectedRange.startOffset, true);
			selectedRange.setStart(container, offset);
		}
		if(selectedRange.endContainer.nodeType != TEXT_TYPE) {
			[container, offset] = _getTextNode(selectedRange.endContainer, selectedRange.endOffset);
			selectedRange.setEnd(container, offset);
		}
		
		var startPath = new Zotero.Annotate.Path(document, nsResolver);
		var endPath = new Zotero.Annotate.Path(document, nsResolver);
		startPath.fromNode(selectedRange.startContainer, selectedRange.startOffset);
		endPath.fromNode(selectedRange.endContainer, selectedRange.endOffset);
		
		[container, offset] = startPath.toNode();
		selectedRange.setStart(container, offset);
		[container, offset] = endPath.toNode();
		selectedRange.setEnd(container, offset);
		
		return [startPath, endPath];
	}
	
	/**
	 * Takes a node and finds the relevant text node inside of it
	 *
	 * @private
	 * @param {Node} container Node to get text node of
	 * @param {Integer} offset Node offset (see dereferenceNodeOffset)
	 * @param {Boolean} isStart Whether to treat this node as a start node. We look for the first
	 * 	text node from the start of start nodes, or the first from the end of end nodes
	 * @return {Array} The node and offset
	 */
	function _getTextNode(container, offset, isStart) {
		var firstTarget = isStart ? "firstChild" : "lastChild";
		var secondTarget = isStart ? "nextSibling" : "previousSibling";
		
		container = Zotero.Annotate.dereferenceNodeOffset(container, offset);
		if(container.nodeType == TEXT_TYPE) return [container, 0];
		
		var seenArray = new Array();
		var node = container;
		while(node) {
			if ( !node ) {
				// uh-oh
				break;
			}
			if(node.nodeType == TEXT_TYPE ) {
				container = node;
				break;
			}
			if( node[firstTarget] && ! _seen(node[firstTarget],seenArray)) {
				var node = node[firstTarget];
			} else if( node[secondTarget] && ! _seen(node[secondTarget],seenArray)) {
				var node = node[secondTarget];
			} else {
				var node = node.parentNode;
			}
		}
		return [container, (!isStart && container.nodeType == TEXT_TYPE ? container.nodeValue.length : 0)];
	}

	/**
	 * look for a node object in an array. return true if the node
	 * is found in the array. otherwise push the node onto the array
	 * and return false. used by _getTextNode.
	 */
	function _seen(node,array) {
		var seen = false;
		for (n in array) {
			if (node === array[n]) {
				var seen = true;
			}
		}
		if ( !seen ) {
			array.push(node);
		}
		return seen;
	}		
}

/**
 * Creates a new Zotero.Annotate.Path object from an XPath, text node index, and text offset
 *
 * @class A persistent descriptor for a point in the DOM, invariant to modifications of
 *	the DOM produced by highlights and annotations
 *
 * @property {String} parent XPath of parent node of referenced text node, or XPath of referenced
 *	element
 * @property {Integer} textNode Index of referenced text node
 * @property {Integer} offset Offset of referenced point inside text node
 * 
 * @constructor
 * @param {Document} document DOM document this path references
 * @param {Function} nsResolver Namespace resolver (for XPaths)
 * @param {String} parent (Optional) XPath of parent node
 * @param {Integer} textNode (Optional) Text node number
 * @param {Integer} offset (Optional) Text offset
 */
Zotero.Annotate.Path = function(document, nsResolver, parent, textNode, offset) {
	if(parent !== undefined) {
		this.parent = parent;
		this.textNode = textNode;
		this.offset = offset;
	}
	this._document = document;
	this._nsResolver = nsResolver;
}

/**
 * Converts a DOM node/offset combination to a Zotero.Annotate.Path object
 *
 * @param {Node} node The DOM node to reference
 * @param {Integer} offset The text offset, if the DOM node is a text node
 */
Zotero.Annotate.Path.prototype.fromNode = function(node, offset) {
	if(!node) throw new Error("Annotate: Path() called with invalid node");
	Zotero.debug("Annotate: Path() called with node "+node.tagName+" offset "+offset);
	
	this.parent = "";
	this.textNode = null;
	this.offset = (offset === 0 || offset ? offset : null);
	
	var lastWasTextNode = node.nodeType == TEXT_TYPE;
	
	if(!lastWasTextNode && offset) {
		node = Zotero.Annotate.dereferenceNodeOffset(node, offset);
		offset = 0;
		lastWasTextNode = node.nodeType == TEXT_TYPE;
	}
	
	if(node.parentNode.getAttribute && node.parentNode.getAttribute("zotero")) {		
		// if the selected point is inside a Zotero node node, add offsets of preceding
		// text nodes
		var first = false;
		var sibling = node.previousSibling;
		while(sibling) {
			if(sibling.nodeType == TEXT_TYPE) this.offset += sibling.nodeValue.length;
			sibling = sibling.previousSibling;
		}
		
		// use parent node for future purposes
		node = node.parentNode;
	} else if(node.getAttribute && node.getAttribute("zotero")) {
		// if selected point is a Zotero node, move it to last character of the previous node
		node = node.previousSibling ? node.previousSibling : node.parentNode;
		if(node.nodeType == TEXT_TYPE) {
			this.offset = node.nodeValue.length;
			lastWasTextNode = true;
		} else {
			this.offset = 0;
		}
	}
	if(!node) throw new Error("Annotate: Path() handled Zotero <span> inappropriately");
	
	lastWasTextNode = lastWasTextNode || node.nodeType == TEXT_TYPE;
	
	if(lastWasTextNode) {
		this.textNode = 1;
		var first = true;
		
		var sibling = node.previousSibling;
		while(sibling) {
			var isZotero = (sibling.getAttribute ? sibling.getAttribute("zotero") : false);
			
			if(sibling.nodeType == TEXT_TYPE ||
			  (isZotero == "highlight")) {
				// is a text node
				if(first == true) {
					// is still part of the first text node
					if(sibling.getAttribute) {
						// get offset of all child nodes
						for (let child of sibling.childNodes) {
							if(child && child.nodeType == TEXT_TYPE) {
								this.offset += child.nodeValue.length;
							}
						}
					} else {
						this.offset += sibling.nodeValue.length;
					}
				} else if(!lastWasTextNode) {
					// is part of another text node
					this.textNode++;
					lastWasTextNode = true;
				}
			} else if(!isZotero) {		// skip over annotation marker nodes
				// is not a text node
				lastWasTextNode = first = false;
			}
			
			sibling = sibling.previousSibling;
		}
		
		node = node.parentNode;
	}
	if(!node) throw new Error("Annotate: Path() resolved text offset inappropriately");
	
	while(node && node !== this._document) {
		var number = 1;
		var sibling = node.previousSibling;
		while(sibling) {
			if(sibling.tagName) {
				if(sibling.tagName == node.tagName && !sibling.hasAttribute("zotero")) number++;
			} else {
				if(sibling.nodeType == node.nodeType) number++;
			}
			sibling = sibling.previousSibling;
		}
		
		// don't add highlight nodes
		if(node.tagName) {
			var tag = node.tagName.toLowerCase();
			if(tag == "span") {
				tag += "[not(@zotero)]";
			}
			this.parent = "/"+tag+"["+number+"]"+this.parent;
		} else if(node.nodeType == Components.interfaces.nsIDOMNode.COMMENT_NODE) {
			this.parent = "/comment()["+number+"]";
		} else if(node.nodeType == Components.interfaces.nsIDOMNode.TEXT_NODE) {
			Zotero.debug("Annotate: Path() referenced a text node; this should never happen");
			this.parent = "/text()["+number+"]";
		} else {
			Zotero.debug("Annotate: Path() encountered unrecognized node type");
		}
		
		node = node.parentNode;
	}
	
	Zotero.debug("Annotate: got path "+this.parent+", "+this.textNode+", "+this.offset);
}

/**
 * Converts a Zotero.Annotate.Path object to a DOM/offset combination
 *
 * @return {Array} Node and offset
 */
Zotero.Annotate.Path.prototype.toNode = function() {
	Zotero.debug("toNode on "+this.parent+" "+this.textNode+", "+this.offset);
	
	var offset = 0;
	
	// try to evaluate parent
	try {
		var node = this._document.evaluate(this.parent, this._document, this._nsResolver,
			Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null).iterateNext();
	} catch(e) {
		Zotero.debug("Annotate: could not find XPath "+this.parent+" in Path.toNode()");
		return [false, false];
	}
	
	// don't do further processing if this path does not refer to a text node
	if(!this.textNode) return [node, offset];
	
	// parent node must have children if we have a text node index
	if(!node.hasChildNodes()) {
		Zotero.debug("Annotate: Parent node has no child nodes, but a text node was specified");
		return [false, false];
	}
	
	node = node.firstChild;
	offset = this.offset;
	var lastWasTextNode = false;
	var number = 0;
	
	// find text node
	while(true) {
		var isZotero = undefined;
		if(node.getAttribute) isZotero = node.getAttribute("zotero");
		
		if(node.nodeType == TEXT_TYPE ||
		   isZotero == "highlight") {
			if(!lastWasTextNode) {
				number++;
				
				// if we found the node we're looking for, break
				if(number == this.textNode) break;
				
				lastWasTextNode = true;
			}
		} else if(!isZotero) {
			lastWasTextNode = false;
		}
		
		node = node.nextSibling;
		// if there's no node, this point is invalid
		if(!node) {
			Zotero.debug("Annotate: reached end of node list while searching for text node "+this.textNode+" of "+this.parent);
			return [false, false];
		}
	}
	
	// find offset
	while(true) {
		// get length of enclosed text node
		if(node.getAttribute) {
			// this is a highlighted node; loop through and subtract all
			// offsets, breaking if we reach the end
			var parentNode = node;
			node = node.firstChild;
			while(node) {
				if(node.nodeType == TEXT_TYPE) {
					// break if end condition reached
					if(node.nodeValue.length >= offset) return [node, offset];
					// otherwise, continue subtracting offsets
					offset -= node.nodeValue.length;
				}
				node = node.nextSibling;
			}
			// restore parent node
			node = parentNode;
		} else {
			// this is not a highlighted node; use simple node length
			if(node.nodeValue.length >= offset) return [node, offset];
			offset -= node.nodeValue.length;
		}
		
		// get next node
		node = node.nextSibling;
		// if next node does not exist or is not a text node, this
		// point is invalid
		if(!node || (node.nodeType != TEXT_TYPE && (!node.getAttribute || !node.getAttribute("zotero")))) {
			Zotero.debug("Annotate: could not find offset "+this.offset+" for text node "+this.textNode+" of "+this.parent);
			return [false, false];
		}
	}
}

/**
 * Creates a new Zotero.Annotations object
 * @class Manages all annotations and highlights for a given item
 *
 * @constructor
 * @param {Zotero_Browser} Zotero_Browser object for the tab in which this item is loaded
 * @param {Browser} Mozilla Browser object
 * @param {Integer} itemID ID of the item to be annotated/highlighted
 */
Zotero.Annotations = function(Zotero_Browser, browser, itemID) {
	this.Zotero_Browser = Zotero_Browser;
	this.browser = browser;
	this.document = browser.contentDocument;
	this.window = browser.contentWindow;
	this.nsResolver = this.document.createNSResolver(this.document.documentElement);
	
	this.itemID = itemID;
	
	this.annotations = new Array();
	this.highlights = new Array();
	
	this.zIndex = 9999;
}

/**
 * Creates a new annotation at the cursor position
 * @return {Zotero.Annotation}
 */
Zotero.Annotations.prototype.createAnnotation = function() {
	var annotation = new Zotero.Annotation(this);
	this.annotations.push(annotation);
	return annotation;
}

/**
 * Highlights text
 *
 * @param {Range} selectedRange Range to highlight
 * @return {Zotero.Highlight}
 */
Zotero.Annotations.prototype.highlight = function(selectedRange) {
	var startPath, endPath;
	[startPath, endPath] = Zotero.Annotate.normalizeRange(selectedRange, this.nsResolver);
	
	var deleteHighlights = new Array();
	var startIn = false, endIn = false;
	
	// first, see if part of this range is already 
	for(var i in this.highlights) {
		var compareHighlight = this.highlights[i];
		var compareRange = compareHighlight.getRange();
		
		var startToStart = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.START_TO_START, selectedRange);
		var endToEnd = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.END_TO_END, selectedRange);
		if(startToStart != 1 && endToEnd != -1) {
			// if the selected range is inside this one
			return compareHighlight;
		} else if(startToStart != -1 && endToEnd != 1) {
			// if this range is inside selected range, delete
			delete this.highlights[i];
		} else {
			var endToStart = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.END_TO_START, selectedRange);
			if(endToStart != 1 && endToEnd != -1) {
				// if the end of the selected range is between the start and
				// end of this range
				var endIn = i;
			} else {
				var startToEnd = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.START_TO_END, selectedRange);
				if(startToEnd != -1 && startToStart != 1) {
					// if the start of the selected range is between the
					// start and end of this range
					var startIn = i;
				}
			}
		}
	}
	
	if(startIn !== false || endIn !== false) {
		// starts in and ends in existing highlights
		if(startIn !== false) {
			var highlight = this.highlights[startIn];
			startRange = highlight.getRange();
			selectedRange.setStart(startRange.startContainer, startRange.startOffset);
			startPath = highlight.startPath;
		} else {
			var highlight = this.highlights[endIn];
		}
		
		if(endIn !== false) {
			endRange = this.highlights[endIn].getRange();
			selectedRange.setEnd(endRange.endContainer, endRange.endOffset);
			endPath = this.highlights[endIn].endPath;
		}
		
		// if bridging ranges, delete end range
		if(startIn !== false && endIn !== false) {
			delete this.highlights[endIn];
		}
	} else {
		// need to create a new highlight
		var highlight = new Zotero.Highlight(this);
		this.highlights.push(highlight);
	}
	
	// actually generate ranges
	highlight.initWithRange(selectedRange, startPath, endPath);
	
	//for(var i in this.highlights) Zotero.debug(i+" = "+this.highlights[i].startPath.offset+" to "+this.highlights[i].endPath.offset+" ("+this.highlights[i].startPath.parent+" to "+this.highlights[i].endPath.parent+")");
	return highlight;
}

/**
 * Unhighlights text
 *
 * @param {Range} selectedRange Range to unhighlight
 */
Zotero.Annotations.prototype.unhighlight = function(selectedRange) {
	var startPath, endPath, node, offset;
	[startPath, endPath] = Zotero.Annotate.normalizeRange(selectedRange, this.nsResolver);
	
	// first, see if part of this range is already highlighted
	for(var i in this.highlights) {
		var updateStart = false;
		var updateEnd = false;
		
		var compareHighlight = this.highlights[i];
		var compareRange = compareHighlight.getRange();
		
		var startToStart = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.START_TO_START, selectedRange);
		var endToEnd = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.END_TO_END, selectedRange);
		
		if(startToStart == -1 && endToEnd == 1) {
			// need to split range into two highlights
			var compareEndPath = compareHighlight.endPath;
			
			// this will unhighlight the entire end
			compareHighlight.unhighlight(selectedRange.startContainer, selectedRange.startOffset,
				startPath, Zotero.Highlight.UNHIGHLIGHT_FROM_POINT);
			var newRange = this.document.createRange();
			
			// need to use point references because they disregard highlights
			[node, offset] = endPath.toNode();
			newRange.setStart(node, offset);
			[node, offset] = compareEndPath.toNode();
			newRange.setEnd(node, offset);
			
			// create new node
			var highlight = new Zotero.Highlight(this);
			highlight.initWithRange(newRange, endPath, compareEndPath);
			this.highlights.push(highlight);
			break;
		} else if(startToStart != -1 && endToEnd != 1) {
			// if this range is inside selected range, delete
			compareHighlight.unhighlight(null, null, null, Zotero.Highlight.UNHIGHLIGHT_ALL);
			delete this.highlights[i];
			updateEnd = updateStart = true;
		} else if(startToStart == -1) {
			var startToEnd = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.START_TO_END, selectedRange);
			if(startToEnd != -1) {
				// if the start of the selected range is between the start and end of this range
				compareHighlight.unhighlight(selectedRange.startContainer, selectedRange.startOffset,
					startPath, Zotero.Highlight.UNHIGHLIGHT_FROM_POINT);
				updateEnd = true;
			}
		} else {
			var endToStart = compareRange.compareBoundaryPoints(Components.interfaces.nsIDOMRange.END_TO_START, selectedRange);
			if(endToStart != 1) {
				// if the end of the selected range is between the start and end of this range
				compareHighlight.unhighlight(selectedRange.endContainer, selectedRange.endOffset,
					endPath, Zotero.Highlight.UNHIGHLIGHT_TO_POINT);
				updateStart = true;
			}
		}
		
		// need to update start and end parts of ranges if spans have shifted around
		if(updateStart) {
			[node, offset] = startPath.toNode();
			selectedRange.setStart(node, offset);
		}
		if(updateEnd) {
			[node, offset] = endPath.toNode();
			selectedRange.setEnd(node, offset);
		}
	}
	
	//for(var i in this.highlights) Zotero.debug(i+" = "+this.highlights[i].startPath.offset+" to "+this.highlights[i].endPath.offset+" ("+this.highlights[i].startPath.parent+" to "+this.highlights[i].endPath.parent+")");
}

/**
 * Refereshes display of annotations (useful if page is reloaded)
 */
Zotero.Annotations.prototype.refresh = function() {
	for (let annotation of this.annotations) {
		annotation.display();
	}
}

/**
 * Saves annotations to DB
 */
Zotero.Annotations.prototype.save = function() {
	Zotero.DB.beginTransaction();
	try {
		Zotero.DB.query("DELETE FROM highlights WHERE itemID = ?", [this.itemID]);
		
		// save highlights
		for (let highlight of this.highlights) {
			if(highlight) highlight.save();
		}
		
		// save annotations
		for (let annotation of this.annotations) {
			// Don't drop all annotations if one is broken (due to ~3.0 glitch)
			try {
				annotation.save();
			}
			catch(e) {
				Zotero.debug(e);
				continue;
			}
		}
		Zotero.DB.commitTransaction();
	} catch(e) {
		Zotero.debug(e);
		Zotero.DB.rollbackTransaction();
		throw(e);
	}
}

/**
 * Loads annotations from DB
 */
Zotero.Annotations.prototype.load = Zotero.Promise.coroutine(function* () {
	// load annotations
	var rows = yield Zotero.DB.queryAsync("SELECT * FROM annotations WHERE itemID = ?", [this.itemID]);
	for (let row of rows) {
		var annotation = this.createAnnotation();
		annotation.initWithDBRow(row);
	}
	
	// load highlights
	var rows = yield Zotero.DB.queryAsync("SELECT * FROM highlights WHERE itemID = ?", [this.itemID]);
	for (let row of rows) {
		try {
			var highlight = new Zotero.Highlight(this);
			highlight.initWithDBRow(row);
			this.highlights.push(highlight);
		} catch(e) {
			Zotero.debug("Annotate: could not load highlight");
		}
	}
});

/**
 * Expands annotations if any are collapsed, or collapses highlights if all are expanded
 */
Zotero.Annotations.prototype.toggleCollapsed = function() {
	// look to see if there are any collapsed annotations
	var status = true;
	for (let annotation of this.annotations) {
		if(annotation.collapsed) {
			status = false;
			break;
		}
	}
	
	// set status on all annotations
	for (let annotation of this.annotations) {
		annotation.setCollapsed(status);
	}
}

/**
 * @class Represents an individual annotation
 *
 * @constructor
 * @property {Boolean} collapsed Whether this annotation is collapsed (minimized)
 * @param {Zotero.Annotations} annotationsObj The Zotero.Annotations object corresponding to the
 * 	page this annotation is on
 */
Zotero.Annotation = function(annotationsObj) {
	this.annotationsObj = annotationsObj;
	this.window = annotationsObj.browser.contentWindow;
	this.document = annotationsObj.browser.contentDocument;
	this.nsResolver = annotationsObj.nsResolver;
	this.cols = 30;
	this.rows = 5;
}

/**
 * Generates annotation from a click event
 *
 * @param {Event} e The DOM click event
 */
Zotero.Annotation.prototype.initWithEvent = function(e) {
	var maxOffset = false;
	
	try {
		var range = this.window.getSelection().getRangeAt(0);
		this.node = range.startContainer;
		var offset = range.startOffset;
		if(this.node.nodeValue) maxOffset = this.node.nodeValue.length;
	} catch(err) {
		this.node = e.target;
		var offset = 0;
	}
		
	var clickX = this.window.pageXOffset + e.clientX;
	var clickY = this.window.pageYOffset + e.clientY;
	
	var isTextNode = (this.node.nodeType == Components.interfaces.nsIDOMNode.TEXT_NODE);
	
	if(offset == 0 || !isTextNode) {
		// tag by this.offset from parent this.node, rather than text
		if(isTextNode) this.node = this.node.parentNode;
		offset = 0;
	}
	
	if(offset) this._generateMarker(offset);
	
	var pixelOffset = Zotero.Annotate.getPixelOffset(this.node);
	this.x = clickX - pixelOffset[0];
	this.y = clickY - pixelOffset[1];
	this.collapsed = false;
	
	Zotero.debug("Annotate: added new annotation");
	
	this.displayWithAbsoluteCoordinates(clickX, clickY, true);
}

/**
 * Generates annotation from a DB row
 *
 * @param {Object} row The DB row
 */
Zotero.Annotation.prototype.initWithDBRow = function(row) {
	var path = new Zotero.Annotate.Path(this.document, this.nsResolver, row.parent, row.textNode, row.offset);
	[node, offset] = path.toNode();
	if(!node) {
		Zotero.debug("Annotate: could not load annotation "+row.annotationID+" from DB");
		return;
	}
	this.node = node;
	if(offset) this._generateMarker(offset);
	
	this.x = row.x;
	this.y = row.y;
	this.cols = row.cols;
	this.rows = row.rows;
	this.annotationID = row.annotationID;
	this.collapsed = !!row.collapsed;
	
	this.display();
	
	var me = this;
	this.iframe.addEventListener("load", function() { me.textarea.value = row.text }, false);
}

/**
 * Saves annotation to DB
 */
Zotero.Annotation.prototype.save = function() {
	var text = this.textarea.value;
	
	// fetch marker location
	if(this.node.getAttribute && this.node.getAttribute("zotero") == "annotation-marker") {
		var node = this.node.previousSibling;
		
		if(node.nodeType != Components.interfaces.nsIDOMNode.TEXT_NODE) {
			// someone added a highlight around this annotation
			node = node.lastChild;
		}
		var offset = node.nodeValue.length;
	} else {
		var node = this.node;
		var offset = 0;
	}
	
	// fetch path to node
	var path = new Zotero.Annotate.Path(this.document, this.nsResolver);
	path.fromNode(node, offset);
	
	var parameters = [
		this.annotationsObj.itemID,	// itemID
		path.parent,				// parent
		path.textNode,				// textNode
		path.offset,				// offset
		this.x,						// x
		this.y,						// y
		this.cols,					// cols
		this.rows,					// rows
		text,						// text
		(this.collapsed ? 1 : 0)	// collapsed
	];
	
	if(this.annotationID) {
		var query = "INSERT OR REPLACE INTO annotations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))";
		parameters.unshift(this.annotationID);
	} else {
		var query = "INSERT INTO annotations VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))";
	}
	
	Zotero.DB.query(query, parameters);
}

/**
 * Displays annotation
 */
Zotero.Annotation.prototype.display = function() {
	if(!this.node) throw new Error("Annotation not initialized!");
	
	var x = 0, y = 0;
	
	// first fetch the coordinates
	var pixelOffset = Zotero.Annotate.getPixelOffset(this.node);
	
	var x = pixelOffset[0] + this.x;
	var y = pixelOffset[1] + this.y;
 	
	// then display
	this.displayWithAbsoluteCoordinates(x, y);
}

/**
 * Displays annotation given absolute coordinates for its position
 */
Zotero.Annotation.prototype.displayWithAbsoluteCoordinates = function(absX, absY, select) {
	if(!this.node) throw new Error("Annotation not initialized!");
	
	var startScroll = this.window.scrollMaxX;
	
	if(!this.iframe) {
		var me = this;
		var body = this.document.getElementsByTagName("body")[0];
		
		const style = "position: absolute; margin: 0; padding: 0; border: none; overflow: hidden; ";
		
		// generate regular div
		this.iframe = this.document.createElement("iframe");
		this.iframe.setAttribute("zotero", "annotation");
		this.iframe.setAttribute("style", style+" -moz-opacity: 0.9;");
		this.iframe.setAttribute("src", "zotero://attachment/annotation.html");
		body.appendChild(this.iframe);
		this.iframe.addEventListener("load", function() {
			me._addChildElements(select);
			me.iframe.style.display = (me.collapsed ? "none" : "block");
		}, false);
		
		// generate pushpin image
		this.pushpinDiv = this.document.createElement("img");
		this.pushpinDiv.setAttribute("style", style+" cursor: pointer;");
		this.pushpinDiv.setAttribute("src", "zotero://attachment/annotation-hidden.gif");
		this.pushpinDiv.setAttribute("title", Zotero.getString("annotations.expand.tooltip"));
		body.appendChild(this.pushpinDiv);
		this.pushpinDiv.style.display = (this.collapsed ? "block" : "none");
		this.pushpinDiv.addEventListener("click", function() { me.setCollapsed(false) }, false);
	}
	this.iframe.style.left = this.pushpinDiv.style.left = absX+"px";
	this.iframeX = absX;
	this.iframe.style.top = this.pushpinDiv.style.top = absY+"px";
	this.iframeY = absY;
	this.pushpinDiv.style.zIndex = this.iframe.style.zIndex = this.annotationsObj.zIndex;
	
	// move to the left if we're making things scroll
	if(absX + this.iframe.scrollWidth > this.window.innerWidth) {
		this.iframe.style.left = (absX-this.iframe.scrollWidth)+"px";
		this.iframeX = absX-this.iframe.scrollWidth;
	}
}

/**
 * Collapses or uncollapses annotation
 *
 * @param {Boolean} status True to collapse, false to uncollapse
 */
Zotero.Annotation.prototype.setCollapsed = function(status) {
	if(status == true) {	// hide iframe
		this.iframe.style.display = "none";
		this.pushpinDiv.style.display = "block";
		this.collapsed = true;
	} else {				// hide pushpin div
		this.pushpinDiv.style.display = "none";
		this.iframe.style.display = "block";
		this.collapsed = false;
	}
}

/**
 * Generates a marker within a paragraph for this annotation. Such markers will remain in place
 * even if the DOM is changed, e.g., by highlighting
 *
 * @param {Integer} offset Text offset within parent node
 * @private
 */
Zotero.Annotation.prototype._generateMarker = function(offset) {
	// first, we create a new span at the correct offset in the node
	var range = this.document.createRange();
	range.setStart(this.node, offset);
	range.setEnd(this.node, offset);
	
	// next, we delete the old node, if there is one
	if(this.node && this.node.getAttribute && this.node.getAttribute("zotero") == "annotation-marker") {
		this.node.parentNode.removeChild(this.node);
		this.node = undefined;
	}
		
	// next, we insert a span
	this.node = this.document.createElement("span");
	this.node.setAttribute("zotero", "annotation-marker");
	range.insertNode(this.node);
}

/**
 * Prepare iframe representing this annotation
 *
 * @param {Boolean} select Whether to select the textarea once iframe is prepared
 * @private
 */
Zotero.Annotation.prototype._addChildElements = function(select) {
	var me = this;
	this.iframeDoc = this.iframe.contentDocument;
	
	// close
	var img = this.iframeDoc.getElementById("close");
	img.title = Zotero.getString("annotations.close.tooltip");
	img.addEventListener("click", function(e) { me._confirmDelete(e) }, false);
	
	// move
	this.moveImg = this.iframeDoc.getElementById("move");
	this.moveImg.title = Zotero.getString("annotations.move.tooltip");
	this.moveImg.addEventListener("click", function(e) { me._startMove(e) }, false);
	
	// hide
	img = this.iframeDoc.getElementById("collapse");
	img.title = Zotero.getString("annotations.collapse.tooltip");
	img.addEventListener("click", function(e) { me.setCollapsed(true) }, false);
	
	// collapse
	this.grippyDiv = this.iframeDoc.getElementById("grippy");
	this.grippyDiv.addEventListener("mousedown", function(e) { me._startDrag(e) }, false);
	
	// text area
	this.textarea = this.iframeDoc.getElementById("text");
	this.textarea.setAttribute("zotero", "annotation");
	this.textarea.cols = this.cols;
	this.textarea.rows = this.rows;
	
	this.iframe.style.width = (6+this.textarea.offsetWidth)+"px";
	this.iframe.style.height = this.iframeDoc.body.offsetHeight+"px";
	this.iframeDoc.addEventListener("click", function() { me._click() }, false);
	
	if(select) this.textarea.select();
}

/**
 * Brings annotation to the foreground
 * @private
 */
Zotero.Annotation.prototype._click = function() {
	// clear current action
	this.annotationsObj.Zotero_Browser.toggleMode(null);
	
	// alter z-index
	this.annotationsObj.zIndex++
	this.iframe.style.zIndex = this.pushpinDiv.style.zIndex = this.annotationsObj.zIndex;
}

/**
 * Asks user to confirm deletion of this annotation
 * @private
 */
Zotero.Annotation.prototype._confirmDelete = function(event) {
	if (this.textarea.value == '' || !Zotero.Prefs.get('annotations.warnOnClose')) {
		var del = true;
	} else {	
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
		
		var dontShowAgain = { value: false };
		var del = promptService.confirmCheck(
			this.window,
			Zotero.getString('annotations.confirmClose.title'),
			Zotero.getString('annotations.confirmClose.body'),
			Zotero.getString('general.dontShowWarningAgain'),
			dontShowAgain
		);
		
		if (dontShowAgain.value) {
			Zotero.Prefs.set('annotations.warnOnClose', false);
		}
	}
	
	if(del) this._delete();
}

/**
 * Deletes this annotation
 * @private
 */
Zotero.Annotation.prototype._delete = function() {
	if(this.annotationID) {
		Zotero.DB.query("DELETE FROM annotations WHERE annotationID = ?", [this.annotationID]);
	}
	
	// hide div
	this.iframe.parentNode.removeChild(this.iframe);
	// delete from list
	for(var i in this.annotationsObj.annotations) {
		if(this.annotationsObj.annotations[i] == this) {
			this.annotationsObj.annotations.splice(i, 1);
		}
	}
}

/**
 * Called to begin resizing the annotation
 *
 * @param {Event} e DOM event corresponding to click on the grippy
 * @private
 */
Zotero.Annotation.prototype._startDrag = function(e) {
	var me = this;
	
	this.clickStartX = e.screenX;
	this.clickStartY = e.screenY;
	this.clickStartCols = this.textarea.cols;
	this.clickStartRows = this.textarea.rows;
	
	/**
	 * Listener to handle mouse moves
	 * @inner
	 */
	var handleDrag = function(e) { me._doDrag(e); };
	this.iframeDoc.addEventListener("mousemove", handleDrag, false);
	this.document.addEventListener("mousemove", handleDrag, false);
	
	/**
	 * Listener to call when mouse is let up
	 * @inner
	 */
	var endDrag = function() {
		me.iframeDoc.removeEventListener("mousemove", handleDrag, false);
		me.document.removeEventListener("mousemove", handleDrag, false);
		me.iframeDoc.removeEventListener("mouseup", endDrag, false);
		me.document.removeEventListener("mouseup", endDrag, false);
		me.dragging = false;
	}
	this.iframeDoc.addEventListener("mouseup", endDrag, false);
	this.document.addEventListener("mouseup", endDrag, false);
	
	// stop propagation
	e.stopPropagation();
	e.preventDefault();
}

/**
 * Called when mouse is moved while annotation is being resized
 *
 * @param {Event} e DOM event corresponding to mouse move
 * @private
 */
Zotero.Annotation.prototype._doDrag = function(e) {
	var x = e.screenX - this.clickStartX;
	var y = e.screenY - this.clickStartY;
	
	// update sizes
	var colSize = this.textarea.clientWidth/this.textarea.cols;
	var rowSize = this.textarea.clientHeight/this.textarea.rows;
	
	// update cols and rows
	var cols = this.clickStartCols+Math.floor(x/colSize);
	cols = (cols > 5 ? cols : 5);
	this.textarea.cols = this.cols = cols;
	
	var rows = this.clickStartRows+Math.floor(y/rowSize);
	rows = (rows > 2 ? rows : 2);
	this.textarea.rows = this.rows = rows;
	
	this.iframe.style.width = (6+this.textarea.offsetWidth)+"px";
	this.iframe.style.height = this.iframe.contentDocument.body.offsetHeight+"px";
}

/**
 * Called to begin moving the annotation
 *
 * @param {Event} e DOM event corresponding to click on the grippy
 * @private
 */
Zotero.Annotation.prototype._startMove = function(e) {
	// stop propagation
	e.stopPropagation();
	e.preventDefault();
	
	var body = this.document.getElementsByTagName("body")[0];
	
	// deactivate current action
	this.annotationsObj.Zotero_Browser.toggleMode(null);
	
	var me = this;
	// set the handler required to deactivate
	
	/**
	 * Callback to end move action
	 * @inner
	 */
	this.annotationsObj.clearAction = function() {
		me.document.removeEventListener("click", me._handleMove, false);
		body.style.cursor = "auto";
		me.moveImg.src = "zotero://attachment/annotation-move.png";
		me.annotationsObj.clearAction = undefined;
	}
	
	/**
	 * Listener to handle mouse moves on main page
	 * @inner
	 */
	var handleMoveMouse1 = function(e) {
		me.displayWithAbsoluteCoordinates(e.pageX + 1, e.pageY + 1);
	};
	/**
	 * Listener to handle mouse moves in iframe
	 * @inner
	 */
	var handleMoveMouse2 = function(e) {
		me.displayWithAbsoluteCoordinates(e.pageX + me.iframeX + 1, e.pageY + me.iframeY + 1);
	};
	this.document.addEventListener("mousemove", handleMoveMouse1, false);
	this.iframeDoc.addEventListener("mousemove", handleMoveMouse2, false);
	
	/**
	 * Listener to finish off move when a click is made
	 * @inner
	 */
	var handleMove = function(e) {
		me.document.removeEventListener("mousemove", handleMoveMouse1, false);
		me.iframeDoc.removeEventListener("mousemove", handleMoveMouse2, false);
		me.document.removeEventListener("click", handleMove, false);
		
		me.initWithEvent(e);
		me.annotationsObj.clearAction();
		
		// stop propagation
		e.stopPropagation();
		e.preventDefault();
	};	
	this.document.addEventListener("click", handleMove, false);
	
	body.style.cursor = "pointer";
	this.moveImg.src = "zotero://attachment/annotation-move-selected.png";
}

/**
 * @class Represents an individual highlighted range
 *
 * @constructor
 * @param {Zotero.Annotations} annotationsObj The Zotero.Annotations object corresponding to the
 *	page this highlight is on
 */
Zotero.Highlight = function(annotationsObj) {
	this.annotationsObj = annotationsObj;
	this.window = annotationsObj.browser.contentWindow;
	this.document = annotationsObj.browser.contentDocument;
	this.nsResolver = annotationsObj.nsResolver;
	
	this.spans = new Array();
}

/**
 * Gets the highlighted DOM range
 * @return {Range} DOM range
 */
Zotero.Highlight.prototype.getRange = function() {
	this.range = this.document.createRange();
	var startContainer, startOffset, endContainer, endOffset;
	[startContainer, startOffset] = this.startPath.toNode();
	[endContainer, endOffset] = this.endPath.toNode();
	
	if(!startContainer || !endContainer) {
		throw("Annotate: PATH ERROR in highlight module!");
	}
	
	this.range.setStart(startContainer, startOffset);
	this.range.setEnd(endContainer, endOffset);
	return this.range;
}

/**
 * Generates a highlight representing the given DB row
 */
Zotero.Highlight.prototype.initWithDBRow = function(row) {
	this.startPath = new Zotero.Annotate.Path(this.document, this.nsResolver, row.startParent,
		row.startTextNode, row.startOffset);
	this.endPath = new Zotero.Annotate.Path(this.document, this.nsResolver, row.endParent,
		row.endTextNode, row.endOffset);
	this.getRange();
	this._highlight();
}

/**
 * Generates a highlight representing given a DOM range
 *
 * @param {Range} range DOM range
 * @param {Zotero.Annotate.Path} startPath Path representing start of range
 * @param {Zotero.Annotate.Path} endPath Path representing end of range
 */
Zotero.Highlight.prototype.initWithRange = function(range, startPath, endPath) {
	this.startPath = startPath;
	this.endPath = endPath;
	this.range = range;
	this._highlight();
}

/**
 * Saves this highlight to the DB
 */
Zotero.Highlight.prototype.save = function() {
	// don't save defective highlights
	if(this.startPath.parent == this.endPath.parent
			&& this.startPath.textNode == this.endPath.textNode
			&& this.startPath.offset == this.endPath.offset) {
		return false;
	}
	
	var query = "INSERT INTO highlights VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))";
	var parameters = [
		this.annotationsObj.itemID,									// itemID
		this.startPath.parent,										// startParent
		(this.startPath.textNode ? this.startPath.textNode : null),	// startTextNode
		(this.startPath.offset || this.startPath.offset === 0 ? this.startPath.offset : null),	// startOffset
		this.endPath.parent,										// endParent
		(this.endPath.textNode ? this.endPath.textNode : null),		// endTextNode
		(this.endPath.offset || this.endPath.offset === 0  ? this.endPath.offset: null)			// endOffset
	];
	
	Zotero.DB.query(query, parameters);	
}

Zotero.Highlight.UNHIGHLIGHT_ALL = 0;
Zotero.Highlight.UNHIGHLIGHT_TO_POINT = 1;
Zotero.Highlight.UNHIGHLIGHT_FROM_POINT = 2;

/**
 * Un-highlights a range
 *
 * @param {Node} container Node to highlight/unhighlight from, or null if mode == UNHIGHLIGHT_ALL
 * @param {Integer} offset Text offset, or null if mode == UNHIGHLIGHT_ALL
 * @param {Zotero.Annotate.Path} path Path representing node, offset combination, or null
 *	if mode == UNHIGHLIGHT_ALL
 * @param {Integer} mode Unhighlight mode
 */
Zotero.Highlight.prototype.unhighlight = function(container, offset, path, mode) {
	this.getRange();
		
	if(mode == 1) {
		this.range.setStart(container, offset);
		this.startPath = path;
	} else if(mode == 2) {
		this.range.setEnd(container, offset);
		this.endPath = path;
	}
	
	var length = this.spans.length;
	for(var i=0; i<length; i++) {
		var span = this.spans[i];
		if(!span) continue;
		var parentNode = span.parentNode;
		
		if(mode != 0 && span === container.parentNode && offset != 0) {
			if(mode == 1) {
				// split text node
				var textNode = container.splitText(offset);
				this.range.setStart(container, offset);
				
				// loop through, removing nodes
				var node = span.firstChild;
				
				while(span.firstChild && span.firstChild !== textNode) {
					parentNode.insertBefore(span.removeChild(span.firstChild), span);
				}
			} else if(mode == 2) {
				// split text node
				var textNode = container.splitText(offset);
				
				// loop through, removing nodes
				var node = textNode;
				var nextNode = span.nextSibling ? span.nextSibling : null;
				var child;
				while(node) {
					child = node;
					node = node.nextSibling;
					parentNode.insertBefore(span.removeChild(child), nextNode);
				}
				
				this.range.setEnd(span.lastChild, span.lastChild.nodeValue.length);
			}
		} else if((mode == 0 || !this.range.isPointInRange(span, 0)) && parentNode) {
			// attach child nodes before
			while(span.hasChildNodes()) {
				parentNode.insertBefore(span.removeChild(span.firstChild), span);
			}
			
			// remove span from DOM
			parentNode.removeChild(span);
			
			// remove span from list
			this.spans.splice(i, 1);
			i--;
		}
	}
	
	this.document.normalize();
}

/**
 * Actually highlights the range this object refers to
 * @private
 */
Zotero.Highlight.prototype._highlight = function() {
	var endUpdated = false;
	var startNode = this.range.startContainer;
	var endNode = this.range.endContainer;
	
	var ancestor = this.range.commonAncestorContainer;
	
	var onlyOneNode = startNode === endNode;
	
	if(!onlyOneNode && startNode !== ancestor && endNode !== ancestor) {
		// highlight nodes after start node in the DOM hierarchy not at ancestor level
		while(startNode.parentNode && startNode.parentNode !== ancestor) {
			if(startNode.nextSibling) {
				this._highlightSpaceBetween(startNode.nextSibling, startNode.parentNode.lastChild);
			}
			startNode = startNode.parentNode
		}
		// highlight nodes after end node in the DOM hierarchy not at ancestor level
		while(endNode.parentNode && endNode.parentNode !== ancestor) {
			if(endNode.previousSibling) {
				this._highlightSpaceBetween(endNode.parentNode.firstChild, endNode.previousSibling);
			}
			endNode = endNode.parentNode
		}
		// highlight nodes between start node and end node at ancestor level
		if(startNode !== endNode.previousSibling) {
			this._highlightSpaceBetween(startNode.nextSibling, endNode.previousSibling);
		}
	}
	
	// split the end off the existing node
	if(this.range.endContainer.nodeType == Components.interfaces.nsIDOMNode.TEXT_NODE && this.range.endOffset != 0) {
		if(this.range.endOffset != this.range.endContainer.nodeValue.length) {
			var textNode = this.range.endContainer.splitText(this.range.endOffset);
		}
		if(!onlyOneNode) {
			var span = this._highlightTextNode(this.range.endContainer);
			this.range.setEnd(span.lastChild, span.lastChild.nodeValue.length);
			endUpdated = true;
		} else if(textNode) {
			this.range.setEnd(textNode, 0);
			endUpdated = true;
		}
	}
	
	// split the start off of the first node
	if(this.range.startContainer.nodeType == Components.interfaces.nsIDOMNode.TEXT_NODE) {
		if(!this.range.startOffset) {
			var highlightNode = this.range.startContainer;
		} else {
			var highlightNode = this.range.startContainer.splitText(this.range.startOffset);
		}
		var span = this._highlightTextNode(highlightNode);
	} else {
		var span = this._highlightSpaceBetween(this.range.startContainer, this.range.endContainer);
	}
	
	this.range.setStart(span.firstChild, 0);
	if(onlyOneNode && !endUpdated) {
		this.range.setEnd(span.lastChild, span.lastChild.nodeValue.length);
	}
	
	this.document.normalize();
}

/**
 * Highlights a single text node
 *
 * @param {Node} textNode
 * @return {Node} Span including the highlighted text
 * @private
 */
Zotero.Highlight.prototype._highlightTextNode = function(textNode) {
	if(!textNode) return;
	var parent = textNode.parentNode;
	
	var span = false;
	var saveSpan = true;
	
	var alreadyHighlighted = parent.getAttribute("zotero") == "highlight";
	
	var nextSibling = (alreadyHighlighted ? textNode.parentNode.nextSibling : textNode.nextSibling);
	var previousSibling = (alreadyHighlighted ? textNode.parentNode.previousSibling : textNode.previousSibling);
	var previousSiblingHighlighted = previousSibling && previousSibling.getAttribute &&
		previousSibling.getAttribute("zotero") == "highlight";
	var nextSiblingHighlighted = nextSibling && nextSibling.getAttribute &&
		nextSibling.getAttribute("zotero") == "highlight";
	
	if(alreadyHighlighted) {
		if(previousSiblingHighlighted || nextSiblingHighlighted) {
			// merge with previous sibling
			while(parent.firstChild) {
				if(previousSiblingHighlighted) {
					previousSibling.appendChild(parent.removeChild(parent.firstChild));
				} else {
					nextSibling.insertBefore(parent.removeChild(parent.firstChild),
						(nextSibling.firstChild ? nextSibling.firstChild : null));
				}
			}
			parent.parentNode.removeChild(parent);
			// look for span in this.spans and delete it if it's there
			var span = previousSiblingHighlighted ? previousSibling : nextSibling;
			for(var i=0; i<this.spans.length; i++) {
				if(parent === this.spans[i]) {
					this.spans.splice(i, 1);
					i--;
				} else if(span === this.spans[i]) {
					saveSpan = false;
				}
			}
		} else {
			span = parent;
		}
	} else if(previousSiblingHighlighted) {
		previousSibling.appendChild(parent.removeChild(textNode));
		
		var span = previousSibling;
		for(var i=0; i<this.spans.length; i++) {
			if(span === this.spans[i]) saveSpan = false;
		}
	} else if(nextSiblingHighlighted) {
		nextSibling.insertBefore(parent.removeChild(textNode), nextSibling.firstChild);
		
		var span = nextSibling;
		for(var i=0; i<this.spans.length; i++) {
			if(span === this.spans[i]) saveSpan = false;
		}
	} else {
		var previousSibling = textNode.previousSibling;
		
		var span = this.document.createElement("span");
		span.setAttribute("zotero", "highlight");
		span.style.display = "inline";
		span.style.backgroundColor = Zotero.Annotate.highlightColor;
		
		var computedColor = this.document.defaultView.getComputedStyle(parent, null).color;
		if(computedColor) {
			var distance1 = Zotero.Annotate.getColorDistance(computedColor, Zotero.Annotate.highlightColor)
			if(distance1 <= 180) {
				var distance2 = Zotero.Annotate.getColorDistance(computedColor, Zotero.Annotate.alternativeHighlightColor);
				if(distance2 > distance1) {
					span.style.backgroundColor = Zotero.Annotate.alternativeHighlightColor;
				}
			}
		}
		
		span.appendChild(parent.removeChild(textNode));
		parent.insertBefore(span, (nextSibling ? nextSibling : null));
	}
	
	if(span && saveSpan) this.spans.push(span);
	return span;
}

/**
 * Highlights the space between two nodes at the same level
 *
 * @param {Node} start
 * @param {Node} end
 * @return {Node} Span containing the first block of highlighted text
 * @private
 */
Zotero.Highlight.prototype._highlightSpaceBetween = function(start, end) {
	var firstSpan = false;
	var node = start;
	var text;
	
	while(node) {
		// process nodes
		if(node.nodeType == Components.interfaces.nsIDOMNode.TEXT_NODE) {
			var textArray = [node];
		} else {
			var texts = this.document.evaluate('.//text()', node, this.nsResolver,
				Components.interfaces.nsIDOMXPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
			var textArray = new Array()
			while(text = texts.iterateNext()) textArray.push(text);
		}
		
		// do this in the middle, after we're finished with node but before we add any spans
		if(node === end) {
			node = false;
		} else {
			node = node.nextSibling;
		}
		
		for (let textNode of textArray) {
			if(firstSpan) {
				this._highlightTextNode(textNode);
			} else {
				firstSpan = this._highlightTextNode(textNode);
			}
		}
	}
	
	return firstSpan;
}