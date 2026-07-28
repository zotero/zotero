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
 * Unpaywall source - Identifies free, legal full-text locations for papers
 * API: https://unpaywall.org/products/api
 */
export class UnpaywallSource extends OpenAccessSourceBase {
	constructor() {
		super({
			id: "unpaywall",
			name: "Unpaywall",
			description: "Finds free, legal full-text locations for research papers using Unpaywall API",
			enabled: true,
			priority: 80,
		});
	}

	async findPDF(item) {
		const doi = item.getField('DOI');
		if (!doi) {
			return null;
		}

		try {
			const result = await this._findByDOI(doi);
			return result;
		}
		catch (e) {
			lazy.Zotero.debug(`Unpaywall error for DOI ${doi}: ${e.message}`);
			return null;
		}
	}

	async _findByDOI(doi) {
		const encodedDOI = encodeURIComponent(doi.toLowerCase());
		const url = `https://api.unpaywall.org/v2/${encodedDOI}?email=contact@zotero.org`;

		try {
			const response = await lazy.Zotero.HTTP.promise("GET", url, {
				timeout: 10000,
			});

			const data = JSON.parse(response.responseText);

			if (data.is_oa) {
				// Prefer published version over accepted version
				if (data.oa_locations && data.oa_locations.length > 0) {
					// Sort by version (published > accepted > submitted)
					const sorted = data.oa_locations.sort((a, b) => {
						const versionPriority = { "publishedVersion": 0, "acceptedVersion": 1, "submittedVersion": 2 };
						const aPriority = versionPriority[a.version] ?? 3;
						const bPriority = versionPriority[b.version] ?? 3;
						return aPriority - bPriority;
					});

					const location = sorted[0];
					if (location.pdf_url) {
						return location.pdf_url;
					}
					else if (location.url) {
						return location.url;
					}
				}
				else if (data.best_oa_location) {
					if (data.best_oa_location.pdf_url) {
						return data.best_oa_location.pdf_url;
					}
					else if (data.best_oa_location.url) {
						return data.best_oa_location.url;
					}
				}
			}

			return null;
		}
		catch (e) {
			lazy.Zotero.debug(`Unpaywall API error: ${e.message}`);
			return null;
		}
	}

	async isConfigured() {
		// Unpaywall doesn't require API key (email-based identification is free)
		return true;
	}
}

// Export as singleton
export const unpaywallSource = new UnpaywallSource();
