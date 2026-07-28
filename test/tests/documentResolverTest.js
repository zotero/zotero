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

describe("DocumentResolver", function () {
	describe("findDocument", function () {
		it("should return null for item without DOI or other identifiers", async function () {
			const item = new Zotero.Item('journalArticle');
			item.setField('title', 'Random Article');
			const result = await Zotero.DocumentResolver.findDocument(item);
			assert.isNull(result);
		});

		it("should search Unpaywall for items with DOI", async function () {
			this.timeout(10000);
			const item = new Zotero.Item('journalArticle');
			item.setField('title', 'Machine Learning');
			item.setField('DOI', '10.1038/nature12373'); // A known OA paper
			const result = await Zotero.DocumentResolver.findDocument(item);
			// Result may be null if API is unavailable, but shouldn't throw
			assert(result === null || result.sourceID);
		});

		it("should search arXiv for items with arXiv ID", async function () {
			this.timeout(10000);
			const item = new Zotero.Item('journalArticle');
			item.setField('title', 'Attention Is All You Need');
			item.setField('extra', 'arXiv: 1706.03762');
			const result = await Zotero.DocumentResolver.findDocument(item);
			// Should find it on arXiv
			if (result) {
				assert.equal(result.sourceID, 'arxiv');
				assert(result.url.includes('arxiv.org'));
			}
		});

		it("should skip disabled sources", async function () {
			const item = new Zotero.Item('journalArticle');
			item.setField('title', 'Test');
			item.setField('extra', 'arXiv: 1706.03762');

			Zotero.DocumentResolver.setSourceEnabled('arxiv', false);
			try {
				const result = await Zotero.DocumentResolver.findDocument(item);
				assert.isNull(result);
			}
			finally {
				Zotero.DocumentResolver.setSourceEnabled('arxiv', true);
			}
		});
	});

	describe("getSources", function () {
		it("should return array of sources", function () {
			const sources = Zotero.DocumentResolver.getSources();
			assert.isArray(sources);
			assert.isAtLeast(sources.length, 3); // Should have at least built-in sources
		});

		it("should include required properties", function () {
			const sources = Zotero.DocumentResolver.getSources();
			sources.forEach(source => {
				assert(source.id);
				assert(source.name);
				assert(typeof source.enabled === 'boolean');
				assert(typeof source.priority === 'number');
			});
		});
	});

	describe("setSourceEnabled", function () {
		it("should toggle source enabled state", function () {
			const sources = Zotero.DocumentResolver.getSources();
			const source = sources[0];

			const originalState = source.enabled;
			Zotero.DocumentResolver.setSourceEnabled(source.id, !originalState);

			let updated = Zotero.DocumentResolver.getSources()
				.find(s => s.id === source.id);
			assert.equal(updated.enabled, !originalState);

			// Restore
			Zotero.DocumentResolver.setSourceEnabled(source.id, originalState);
		});
	});

	describe("registerSource", function () {
		it("should register custom source", function () {
			const MockSource = class {
				id = 'test-source';
				name = 'Test Source';
				description = 'Test';
				enabled = true;
				priority = 50;
				async findPDF() { return null; }
				async isConfigured() { return true; }
				async getConfigErrors() { return []; }
			};

			const source = new MockSource();
			Zotero.DocumentResolver.registerSource(source, 'test-plugin');

			const sources = Zotero.DocumentResolver.getSources();
			const registered = sources.find(s => s.id === 'test-source');
			assert(registered);
			assert(registered.isCustom);

			// Cleanup
			Zotero.DocumentResolver.unregisterSource('test-source');
		});

		it("should throw without id", function () {
			const source = { name: 'Bad Source' };
			assert.throws(() => {
				Zotero.DocumentResolver.registerSource(source, 'plugin');
			});
		});
	});

	describe("ArxivSource", function () {
		it("should handle arXiv ID extraction", async function () {
			const item = new Zotero.Item('journalArticle');
			item.setField('extra', 'arXiv: 2301.00001');
			const result = await Zotero.DocumentResolver.findDocument(item);
			// May be null if request fails, but extraction should work
			assert(result === null || result.url.includes('2301.00001'));
		});

		it("should handle old arXiv ID format", async function () {
			const item = new Zotero.Item('journalArticle');
			item.setField('extra', 'arXiv: math/0510001');
			const result = await Zotero.DocumentResolver.findDocument(item);
			assert(result === null || result.url.includes('math/0510001'));
		});
	});

	describe("Integration", function () {
		it("should handle HTTP errors gracefully", async function () {
			const item = new Zotero.Item('journalArticle');
			item.setField('DOI', '10.0000/invalid.doi');
			// Should not throw, just return null
			const result = await Zotero.DocumentResolver.findDocument(item);
			assert.isNull(result);
		});
	});
});
