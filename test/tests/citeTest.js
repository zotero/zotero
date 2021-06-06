describe("Zotero.Cite", function () {
	describe("#extraToCSL()", function () {
		it("should convert Extra field values to the more restrictive citeproc-js cheater syntax", function () {
			var str1 = 'Original Date: 2017\n' // uppercase/spaces converted to lowercase/hyphens
				+ 'Archive-Place: New York\n' // allow hyphen even with title case
				+ 'Container title: Title\n' // mixed case
				+ 'DOI: 10.0/abc\n' // certain fields are uppercase
				+ 'Archive Location: Foo\n' // requires an underscore
				+ 'Original Publisher Place:  London, UK\n' // extra space OK
				+ 'Type: dataset'
				+ '\n\n'
				+ "Ignore other strings: they're not fields\n"
				+ 'This is just some text.'
			var str2 = 'original-date: 2017\n'
				+ 'archive-place: New York\n'
				+ 'container-title: Title\n'
				+ 'DOI: 10.0/abc\n'
				+ 'archive_location: Foo\n'
				+ 'original-publisher-place:  London, UK\n'
				+ 'type: dataset'
				+ '\n\n'
				+ "Ignore other strings: they're not fields\n"
				+ 'This is just some text.';
			assert.equal(Zotero.Cite.extraToCSL(str1), str2);
		});
		
		it("should convert Zotero field names to CSL fields", function () {
			var str1 = 'publicationTitle: My Publication';
			var str2 = 'container-title: My Publication';
			assert.equal(Zotero.Cite.extraToCSL(str1), str2);
		});
		
		it("should convert capitalized and spaced Zotero field names to CSL fields", function () {
			var str1 = 'Publication Title: My Publication\nDate: 1989';
			var str2 = 'container-title: My Publication\nissued: 1989';
			assert.equal(Zotero.Cite.extraToCSL(str1), str2);
		});
		
		it("should convert lowercase 'doi' to uppercase", function () {
			var str1 = 'doi: 10.0/abc';
			var str2 = 'DOI: 10.0/abc';
			assert.equal(Zotero.Cite.extraToCSL(str1), str2);
		});
		
		it("should handle a single-character field name", function () {
			var str = 'a: ';
			assert.equal(Zotero.Cite.extraToCSL(str), str);
		});
	});
	
	it("shouldn't hang during disambiguation (https://github.com/Juris-M/citeproc-js/issues/179)", async function () {
		var item1 = new Zotero.Item;
		item1.fromJSON({"key":"WB338HGS","version":0,"itemType":"journalArticle","creators":[{"firstName":"Carl G.","lastName":"de Boer","creatorType":"author"},{"firstName":"John P.","lastName":"Ray","creatorType":"author"},{"firstName":"Nir","lastName":"Hacohen","creatorType":"author"},{"firstName":"Aviv","lastName":"Regev","creatorType":"author"}],"tags":[{"tag":"CRISPR/Cas9","type":1},{"tag":"Enhancers","type":1},{"tag":"Gene regulation","type":1},{"tag":"Transcriptional regulation","type":1},{"tag":"Gene expression","type":1},{"tag":"Pooled screen","type":1},{"tag":"R","type":1}],"date":"June 3, 2020","title":"MAUDE: inferring expression changes in sorting-based CRISPR screens","journalAbbreviation":"Genome Biology","pages":"134","volume":"21","issue":"1","abstractNote":"","ISSN":"1474-760X","url":"https://doi.org/10.1186/s13059-020-02046-8","DOI":"10.1186/s13059-020-02046-8","publicationTitle":"Genome Biology","libraryCatalog":"BioMed Central","accessDate":"2021-02-17T02:40:40Z","shortTitle":"MAUDE"});
		await item1.saveTx();
		var item2 = new Zotero.Item;
		item2.fromJSON({"key":"U2L8PVTW","version":0,"itemType":"journalArticle","creators":[{"firstName":"Carl G.","lastName":"de Boer","creatorType":"author"},{"firstName":"Eeshit Dhaval","lastName":"Vaishnav","creatorType":"author"},{"firstName":"Ronen","lastName":"Sadeh","creatorType":"author"},{"firstName":"Esteban Luis","lastName":"Abeyta","creatorType":"author"},{"firstName":"Nir","lastName":"Friedman","creatorType":"author"},{"firstName":"Aviv","lastName":"Regev","creatorType":"author"}],"tags":[],"title":"Deciphering eukaryotic gene-regulatory logic with 100 million random promoters","publicationTitle":"Nature Biotechnology","rights":"2019 The Author(s), under exclusive licence to Springer Nature America, Inc.","volume":"38","issue":"1","pages":"56-65","date":"2020-01","DOI":"10.1038/s41587-019-0315-8","ISSN":"1546-1696","url":"https://www.nature.com/articles/s41587-019-0315-8","abstractNote":"","language":"en","libraryCatalog":"www.nature.com","accessDate":"2021-02-17T02:40:52Z"});
		await item2.saveTx();
		var items = [item1, item2];
		var style = Zotero.Styles.get('http://www.zotero.org/styles/elsevier-harvard');
		var cslEngine = style.getCiteProc('en-US');
		var output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "html");
	});
});
