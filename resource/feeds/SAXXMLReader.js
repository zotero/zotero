/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

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

"use strict";

/**
 * This implements `nsISAXXMLReader` using content-accessible APIs, such as `DOMParser` and
 * `TreeWalker`. It should be usable in any web platform environment that supports those standard
 * APIs.
 * 
 * Note that while this class implements a SAX-style API (which usually implies streaming style
 * parsing for documents of any length), this class actually uses whole document parsing internally.
 * Instead, `DOMParser` reads the entire document and this walks the resulting DOM. Thus, this class
 * is mainly useful only for smaller documents where it's useful to conform to SAX-style API to
 * support existing code.
 * 
 * Higher-level components are notified of XML content via the `nsISAXContentHandler` and
 * `nsISAXErrorHandler` interfaces as this reader walks through the XML content.
 */
class SAXXMLReader {
	constructor() {
		this.contentHandler = null;
		this.errorHandler = null;
		this.baseURI = null;
		this._data = null;
		this._walker = null;
	}
	
	// nsISAXXMLReader
	
	parseAsync(requestObserver) {
		if (requestObserver) {
			throw new Error("requestObserver argument parseAsync is not currently supported");
		}
	}
	
	// Fetch API

	async onResponseAvailable(response) {
		if (!response.ok) {
			throw new Error("Unable to fetch data");
		}
		this._data = await response.text();
		this._parseAndNotify();
	}
	
	// Parsing and notification
	
	_parseAndNotify() {
		if (!this.contentHandler) {
			return;
		}
		
		const doc = new DOMParser().parseFromString(this._data, "text/xml");
		this._walker = doc.createTreeWalker(doc.documentElement);
		
		this.contentHandler.startDocument();
		this._walk();
		this.contentHandler.endDocument();
		
		this._data = null;
		this._walker = null;
	}
	
	_walk() {
		const node = this._walker.currentNode;
		
		switch (node.nodeType) {
			// ELEMENT_NODE
			case 1: {
				this.contentHandler.startElement(
					node.namespaceURI,
					node.localName,
					"", // qualifed names are not used
					node.attributes,
				);
				
				// Try to move down
				if (this._walker.firstChild()) {
					this._walk();
					// Move up
					this._walker.parentNode();
				}
				
				this.contentHandler.endElement(
					node.namespaceURI,
					node.localName,
					"", // qualifed names are not used
				);
				break;
			}
			// TEXT_NODE
			case 3: {
				this.contentHandler.characters(node.data);
				break;
			}
			// CDATA_SECTION_NODE
			case 4: {
				this.contentHandler.characters(node.data);
				break;
			}
			// PROCESSING_INSTRUCTION_NODE
			case 7: {
				this.contentHandler.processingInstruction(node.target, node.data);
				break;
			}
		}

		// Try to move across
		if (this._walker.nextSibling()) {
			this._walk();
		}
	}
}

if (typeof module == "object") {
	module.exports = SAXXMLReader;
}
