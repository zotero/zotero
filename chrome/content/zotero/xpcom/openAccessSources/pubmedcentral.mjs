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
 * PubMed Central source - Free full-text biomedical articles
 * API: https://www.ncbi.nlm.nih.gov/pmc/tools/developers/
 */
export class PubmedCentralSource extends OpenAccessSourceBase {
	constructor() {
		super({
			id: "pubmedcentral",
			name: "PubMed Central",
			description: "Finds open-access biomedical articles from PubMed Central",
			enabled: true,
			priority: 75,
		});
	}

	async findPDF(item) {
		// Try by PMID first
		const pmid = item.getField('pubmedID');
		if (pmid) {
			const result = await this._findByPMID(pmid);
			if (result) return result;
		}

		// Try by DOI
		const doi = item.getField('DOI');
		if (doi) {
			const pmid = await this._searchPMIDByDOI(doi);
			if (pmid) {
				const result = await this._findByPMID(pmid);
				if (result) return result;
			}
		}

		// Try by title + authors
		const title = item.getField('title');
		if (title) {
			return await this._searchByTitle(title);
		}

		return null;
	}

	async _findByPMID(pmid) {
		try {
			// Get PMC ID from PMID
			const pmcID = await this._getPMCIDFromPMID(pmid);
			if (!pmcID) {
				return null;
			}

			// PubMed Central PDFs are available at:
			// https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{PMCID}/pdf/
			return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcID}/pdf/`;
		}
		catch (e) {
			lazy.Zotero.debug(`PubMed Central PMID lookup error: ${e.message}`);
			return null;
		}
	}

	async _getPMCIDFromPMID(pmid) {
		try {
			const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=zotero&email=contact@zotero.org&ids=${pmid}&format=json`;

			const response = await lazy.Zotero.HTTP.promise("GET", url, {
				timeout: 10000,
			});

			const data = JSON.parse(response.responseText);
			if (data.records && data.records.length > 0) {
				const record = data.records[0];
				if (record.pmcid) {
					return record.pmcid.replace(/^PMC/, '');
				}
			}
			return null;
		}
		catch (e) {
			lazy.Zotero.debug(`PubMed Central ID conversion error: ${e.message}`);
			return null;
		}
	}

	async _searchPMIDByDOI(doi) {
		try {
			const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=zotero&email=contact@zotero.org&ids=${encodeURIComponent(doi)}&format=json`;

			const response = await lazy.Zotero.HTTP.promise("GET", url, {
				timeout: 10000,
			});

			const data = JSON.parse(response.responseText);
			if (data.records && data.records.length > 0) {
				const record = data.records[0];
				if (record.pmid) {
					return record.pmid;
				}
			}
			return null;
		}
		catch (e) {
			lazy.Zotero.debug(`PubMed Central DOI search error: ${e.message}`);
			return null;
		}
	}

	async _searchByTitle(title) {
		try {
			const query = `"${title}"[Title] AND open access[filter]`;
			const encodedQuery = encodeURIComponent(query);
			const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodedQuery}&retmax=1&tool=zotero&email=contact@zotero.org&rettype=json`;

			const response = await lazy.Zotero.HTTP.promise("GET", url, {
				timeout: 10000,
				responseType: "text",
			});

			const data = JSON.parse(response.responseText);
			if (data.esearchresult && data.esearchresult.idlist && data.esearchresult.idlist.length > 0) {
				const pmcid = data.esearchresult.idlist[0];
				return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid}/pdf/`;
			}

			return null;
		}
		catch (e) {
			lazy.Zotero.debug(`PubMed Central title search error: ${e.message}`);
			return null;
		}
	}

	async isConfigured() {
		// PubMed Central API is free and open
		return true;
	}
}

// Export as singleton
export const pubmedCentralSource = new PubmedCentralSource();
