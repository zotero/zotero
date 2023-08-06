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

const ZipReader = Components.Constructor(
	"@mozilla.org/libjar/zip-reader;1",
	"nsIZipReader",
	"open"
);

Zotero.EPUB = {
	async* getSectionDocuments(epubPath) {
		let zipReader = new ZipReader(Zotero.File.pathToFile(epubPath));
		let contentOPFDoc = await this._getContentOPF(zipReader);
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
			idToHref.set(manifestItem.getAttribute('id'), manifestItem.getAttribute('href'));
		}

		for (let spineItem of spine.querySelectorAll('itemref')) {
			let id = spineItem.getAttribute('idref');
			let href = idToHref.get(id);
			if (!href || !zipReader.hasEntry(href)) {
				continue;
			}
			let entryStream = zipReader.getInputStream(href);
			let doc;
			try {
				doc = await this._parseStreamToDocument(entryStream, 'application/xhtml+xml');
			}
			finally {
				entryStream.close();
			}
			
			yield { href, doc };
		}
	},
	
	async getMetadataRDF(epubPath) {
		const DC_NS = 'http://purl.org/dc/elements/1.1/';
		const OPF_NS = 'http://www.idpf.org/2007/opf';
		
		let zipReader = new ZipReader(Zotero.File.pathToFile(epubPath));
		let doc = await this._getContentOPF(zipReader);
		let metadata = doc.documentElement.querySelector(':scope > metadata');
		
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
	},
	
	/**
	 * @param {ZipReader} zipReader
	 * @return {Promise<XMLDocument>}
	 */
	async _getContentOPF(zipReader) {
		if (!zipReader.hasEntry('META-INF/container.xml')) {
			throw new Error('EPUB file does not contain container.xml');
		}

		let containerXMLStream = zipReader.getInputStream('META-INF/container.xml');
		let containerXMLDoc = await this._parseStreamToDocument(containerXMLStream, 'text/xml');
		containerXMLStream.close();

		let rootFile = containerXMLDoc.documentElement.querySelector(':scope > rootfiles > rootfile');
		if (!rootFile || !rootFile.hasAttribute('full-path')) {
			throw new Error('container.xml does not contain <rootfile full-path="...">');
		}

		let contentOPFStream = zipReader.getInputStream(rootFile.getAttribute('full-path'));
		try {
			return await this._parseStreamToDocument(contentOPFStream, 'text/xml');
		}
		finally {
			contentOPFStream.close();
		}
	},

	async _parseStreamToDocument(stream, type) {
		let parser = new DOMParser();
		let xml = await Zotero.File.getContentsAsync(stream);
		return parser.parseFromString(xml, type);
	}
};
