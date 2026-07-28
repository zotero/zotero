/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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

/**
 * Base class for open-access document sources.
 * Plugins can extend this to provide custom document resolution logic.
 */
export class OpenAccessSourceBase {
	/**
	 * Unique identifier for this source
	 * @type {string}
	 */
	id;

	/**
	 * Display name for the source
	 * @type {string}
	 */
	name;

	/**
	 * Brief description of the source
	 * @type {string}
	 */
	description;

	/**
	 * Whether this source is enabled by default
	 * @type {boolean}
	 */
	enabled = true;

	/**
	 * Priority for ordering (higher = checked first)
	 * @type {number}
	 */
	priority = 50;

	/**
	 * Plugin ID that registered this source (if applicable)
	 * @type {string|null}
	 */
	pluginID = null;

	constructor(config) {
		Object.assign(this, config);
		if (!this.id) {
			throw new Error("OpenAccessSource requires an id");
		}
		if (!this.name) {
			throw new Error("OpenAccessSource requires a name");
		}
	}

	/**
	 * Find an open-access PDF URL for an item based on available metadata.
	 *
	 * @param {Zotero.Item} item - The item to find a document for
	 * @return {Promise<string|null>} - URL to the PDF, or null if not found
	 */
	async findPDF(item) {
		throw new Error("findPDF() must be implemented by subclass");
	}

	/**
	 * Helper method to search by DOI
	 * @param {string} doi
	 * @return {Promise<string|null>}
	 */
	async _findByDOI(doi) {
		return null;
	}

	/**
	 * Helper method to search by arXiv ID
	 * @param {string} arxivID
	 * @return {Promise<string|null>}
	 */
	async _findByArxivID(arxivID) {
		return null;
	}

	/**
	 * Helper method to search by PMID
	 * @param {string} pmid
	 * @return {Promise<string|null>}
	 */
	async _findByPMID(pmid) {
		return null;
	}

	/**
	 * Extract metadata from a Zotero item
	 * @param {Zotero.Item} item
	 * @return {Object}
	 */
	_extractMetadata(item) {
		return {
			doi: item.getField('DOI'),
			title: item.getField('title'),
			authors: this._extractAuthors(item),
			year: item.getField('date') || item.getField('publicationDate'),
			pmid: item.getField('pubmedID'),
			isbn: item.getField('ISBN'),
			issn: item.getField('ISSN'),
			arxivID: this._extractArxivID(item),
			url: item.getField('url'),
		};
	}

	_extractAuthors(item) {
		try {
			const creators = item.getCreators();
			return creators
				.filter(c => c.creatorTypeID === 1) // Author type
				.map(c => `${c.lastName} ${c.firstName}`.trim())
				.slice(0, 3); // First 3 authors
		}
		catch (e) {
			return [];
		}
	}

	_extractArxivID(item) {
		// Check extra field for arXiv ID
		const extra = item.getField('extra') || '';
		const arxivMatch = extra.match(/arXiv:\s*(\d{4}\.\d{4,5})/);
		if (arxivMatch) return arxivMatch[1];

		// Check if the URL contains arXiv
		const url = item.getField('url') || '';
		const urlArxivMatch = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
		if (urlArxivMatch) return urlArxivMatch[1];

		return null;
	}

	/**
	 * Check if source requires authentication/API key
	 * @return {boolean}
	 */
	requiresAuth() {
		return false;
	}

	/**
	 * Validate that the source is properly configured
	 * @return {Promise<boolean>}
	 */
	async isConfigured() {
		return true;
	}

	/**
	 * Get configuration errors if any
	 * @return {Promise<string[]>}
	 */
	async getConfigErrors() {
		return [];
	}
}
