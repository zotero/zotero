/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2023 Corporation for Digital Scholarship
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

var EXPORTED_SYMBOLS = ["EPUB"];

const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
	Zotero: "chrome://zotero/content/include.jsm"
});

const ZipReader = Components.Constructor(
	"@mozilla.org/libjar/zip-reader;1",
	"nsIZipReader",
	"open"
);

const DC_NS = 'http://purl.org/dc/elements/1.1/';
const OPF_NS = 'http://www.idpf.org/2007/opf';

class EPUB {
	_zipReader;

	_contentOPF = null;
	
	_contentOPFPath = null;

	/**
	 * @param {String | nsIFile} file
	 */
	constructor(file) {
		this._zipReader = new ZipReader(Zotero.File.pathToFile(file));
	}

	close() {
		this._zipReader.close();
		this._zipReader = null
		Cu.forceGC();
	}

	async* getSectionDocuments() {
		let contentOPFDoc = await this._getContentOPF();
		let manifest = contentOPFDoc.documentElement.querySelector(':scope > manifest');
		let spine = contentOPFDoc.documentElement.querySelector(':scope > spine');
		if (!manifest || !spine) {
			throw new Error('content.opf does not contain <manifest> and <spine>');
		}

		let idToHref = new Map();
		for (let manifestItem of manifest.querySelectorAll(':scope > item')) {
			if (!manifestItem.hasAttribute('id')
					|| !manifestItem.hasAttribute('href')
					|| manifestItem.getAttribute('media-type') !== 'application/xhtml+xml') {
				continue;
			}
			let href = manifestItem.getAttribute('href');
			href = this._resolveRelativeToContentOPF(href);
			idToHref.set(manifestItem.getAttribute('id'), href);
		}

		for (let spineItem of spine.querySelectorAll('itemref')) {
			let id = spineItem.getAttribute('idref');
			let href = idToHref.get(id);
			if (!href || !this._zipReader.hasEntry(href)) {
				Zotero.debug('EPUB: Skipping missing or invalid href in spine: ' + href);
				continue;
			}
			let doc = await this._parseEntryToDocument(href, 'application/xhtml+xml');
			yield {
				href,
				doc
			};
		}
	}

	async getDocumentByReferenceType(referenceType) {
		let contentOPFDoc = await this._getContentOPF();
		let guide = contentOPFDoc.documentElement.querySelector(':scope > guide');
		if (!guide) {
			return null;
		}

		let reference = guide.querySelector(`:scope > reference[type="${referenceType}"]`);
		if (!reference) {
			return null;
		}
		let href = reference.getAttribute('href')
			?.split('#')[0];
		if (!href) {
			return null;
		}
		href = this._resolveRelativeToContentOPF(href);
		if (!this._zipReader.hasEntry(href)) {
			return null;
		}
		return this._parseEntryToDocument(href, 'application/xhtml+xml');
	}

	async getMetadataRDF() {
		let doc = await this._getContentOPF();
		let metadata = doc.documentElement.querySelector(':scope > metadata');
		metadata = metadata.cloneNode(true);

		if (!metadata.getAttribute('xmlns')) {
			metadata.setAttribute('xmlns', doc.documentElement.namespaceURI || '');
		}

		for (let elem of metadata.querySelectorAll('*')) {
			for (let attr of Array.from(elem.attributes)) {
				// Null- and unknown-namespace attributes cause rdf.js to ignore the entire element
				// (Why?)
				if (attr.namespaceURI === null || attr.namespaceURI === OPF_NS) {
					elem.removeAttributeNode(attr);
				}
			}
		}

		// If the metadata doesn't contain a dc:type, add one
		if (!metadata.getElementsByTagNameNS(DC_NS, 'type').length) {
			let dcType = doc.createElementNS(DC_NS, 'type');
			dcType.textContent = 'book';
			metadata.appendChild(dcType);
		}

		return new XMLSerializer().serializeToString(metadata);
	}

	/**
	 * @return {Promise<XMLDocument>}
	 */
	async _getContentOPF() {
		if (this._contentOPF) {
			return this._contentOPF;
		}

		if (!this._zipReader.hasEntry('META-INF/container.xml')) {
			throw new Error('EPUB file does not contain container.xml');
		}

		let containerXMLDoc = await this._parseEntryToDocument('META-INF/container.xml', 'text/xml');

		let rootFile = containerXMLDoc.documentElement.querySelector(':scope > rootfiles > rootfile');
		if (!rootFile || !rootFile.hasAttribute('full-path')) {
			throw new Error('container.xml does not contain <rootfile full-path="...">');
		}

		this._contentOPFPath = rootFile.getAttribute('full-path');
		this._contentOPF = await this._parseEntryToDocument(this._contentOPFPath, 'text/xml');
		return this._contentOPF;
	}
	
	_resolveRelativeToContentOPF(path) {
		if (!this._contentOPFPath) {
			throw new Error('content.opf not loaded');
		}
		// Use the URL class with a phony zip: scheme to resolve relative paths in a non-platform-defined way
		return new URL(path, 'zip:/' + this._contentOPFPath).pathname.substring(1);
	}

	async _parseEntryToDocument(entry, type) {
		let parser = new DOMParser();
		let stream = this._zipReader.getInputStream(entry);
		let xml;
		try {
			xml = await Zotero.File.getContentsAsync(stream);
		}
		finally {
			stream.close();
		}
		return parser.parseFromString(xml, type);
	}
}
