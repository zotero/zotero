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

import { OpenAccessSourceBase } from "./base.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});

/**
 * arXiv source - Free preprints in physics, mathematics, computer science, biology
 * API: https://arxiv.org/help/api/user-manual
 */
export class ArxivSource extends OpenAccessSourceBase {
	constructor() {
		super({
			id: "arxiv",
			name: "arXiv",
			description: "Finds papers from arXiv, a free repository for physics, math, CS, and biology",
			enabled: true,
			priority: 70,
		});
	}

	async findPDF(item) {
		const arxivID = this._extractArxivID(item);
		if (arxivID) {
			return await this._findByArxivID(arxivID);
		}

		// Try searching by title + authors
		const title = item.getField('title');
		if (title) {
			return await this._searchByTitle(title);
		}

		return null;
	}

	async _findByArxivID(arxivID) {
		// arXiv PDFs are at https://arxiv.org/pdf/{id}.pdf
		return `https://arxiv.org/pdf/${arxivID}.pdf`;
	}

	async _searchByTitle(title) {
		try {
			const query = `ti:"${title.replace(/"/g, '\\"')}"`;
			const encodedQuery = encodeURIComponent(query);
			const url = `https://export.arxiv.org/api/query?search_query=${encodedQuery}&max_results=5&sortBy=relevance&sortOrder=descending`;

			const response = await lazy.Zotero.HTTP.promise("GET", url, {
				timeout: 10000,
				responseType: "text",
			});

			const entries = response.responseText.match(/<entry>[\s\S]*?<\/entry>/g);
			if (!entries || entries.length === 0) {
				return null;
			}

			// Parse first result (most relevant)
			const firstEntry = entries[0];
			const idMatch = firstEntry.match(/<id>https:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
			if (idMatch) {
				const arxivID = idMatch[1];
				return `https://arxiv.org/pdf/${arxivID}.pdf`;
			}

			return null;
		}
		catch (e) {
			lazy.Zotero.debug(`arXiv search error: ${e.message}`);
			return null;
		}
	}

	async isConfigured() {
		// arXiv API is free and open
		return true;
	}
}

// Export as singleton
export const arxivSource = new ArxivSource();
