describe("Zotero.Cite", function () {
	after(function () {
		Zotero.locale = 'en-US';
	});
	
	describe("#getLocatorString()", function () {
		it("should get 'book' in en-US", function () {
			Zotero.locale = 'en-US';
			assert.equal(Zotero.Cite.getLocatorString('book'), 'Book');
		});
		
		it("should get 'sub-verbo' in en-US", function () {
			Zotero.locale = 'en-US';
			assert.equal(Zotero.Cite.getLocatorString('sub-verbo'), 'Sub verbo');
		});
		
		it("should get 'timestamp' in en-US", function () {
			Zotero.locale = 'en-US';
			assert.equal(Zotero.Cite.getLocatorString('timestamp'), 'Timestamp');
		});
		
		it("should get 'book' in fr-FR", function () {
			Zotero.locale = 'fr-FR';
			assert.equal(Zotero.Cite.getLocatorString('book'), 'Livre');
		});
	});
	
	describe("#getAbbreviation()", function () {
		it("should drop accented stop-words when auto-abbreviating", function () {
			var obj = { default: { 'container-title': {} } };
			Zotero.Cite.getAbbreviation(
				"default", obj, "default", "container-title", "Jahrbuch für Heimatkunde"
			);
			assert.equal(
				obj.default['container-title']['Jahrbuch für Heimatkunde'],
				"Jahrb. Heimatkunde"
			);
		});
	});
	
	describe("Dates", function () {
		async function makeBibliography(fields) {
			let item = new Zotero.Item;
			item.fromJSON(Object.assign({
				itemType: "book",
				title: "Test Book"
			}, fields));
			await item.saveTx();

			let style = Zotero.Styles.get('http://www.zotero.org/styles/chicago-notes-bibliography');
			let cslEngine = style.getCiteProc('en-US');
			return Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [item], "text");
		}

		it("should render a date range", async function () {
			assert.include(await makeBibliography({ date: '2021/2026' }), '2021–2026');
		});

		it("should render a BCE date", async function () {
			assert.match(await makeBibliography({ date: '-429' }), /429\s?BC/);
		});

		it("should render a spelled-out BCE date", async function () {
			let output = await makeBibliography({ date: 'January 10, 200 BCE' });
			assert.match(output, /200\s?BC/);
			assert.notMatch(output, /\bAD\b/);
		});

		it("should render an EDTF range in Extra, overriding the Date field", async function () {
			let output = await makeBibliography({ date: '1999', extra: 'issued: 2021/2026' });
			assert.include(output, '2021–2026');
			assert.notInclude(output, '1999');
		});

		it("should render a quoted date as a literal string", async function () {
			assert.include(await makeBibliography({ date: '"1637 and 1662"' }), '1637 and 1662');
		});
	});

	describe("#retrieveLocale()", function () {
		it("should handle locale with script code", async function () {
			var item = new Zotero.Item;
			item.fromJSON({
				itemType: "book",
				title: "Test Book",
				edition: "2"
			});
			await item.saveTx();
			
			var style = Zotero.Styles.get('http://www.zotero.org/styles/chicago-notes-bibliography');
			var cslEngine = style.getCiteProc('sr-Latn-RS');
			
			var output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [item], "text");
			assert.include(output, 'izd');
		});

		it("should use closest available locale for locale without a CSL locale", async function () {
			var item = new Zotero.Item;
			item.fromJSON({
				itemType: "book",
				title: "Test Book",
				edition: "2"
			});
			await item.saveTx();

			var style = Zotero.Styles.get('http://www.zotero.org/styles/chicago-notes-bibliography');
			var cslEngine = style.getCiteProc('sr-RS');

			var output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [item], "text");
			assert.include(output, 'изд');
		});
	});
	
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
	
	describe("#isTitleCased()", function () {
		it("should detect a title-cased title", function () {
			assert.isTrue(Zotero.Cite.isTitleCased("The Effects of Climate Change on Coastal Cities"));
		});
		
		it("should not treat a sentence-cased title with proper nouns as title-cased", function () {
			assert.isFalse(Zotero.Cite.isTitleCased("Effects of climate change in Africa and Asia"));
		});
		
		it("should not treat a title with fewer than two long words as title-cased", function () {
			assert.isFalse(Zotero.Cite.isTitleCased("Introduction to Python"));
		});
		
		it("should ignore acronyms and words with inner capitals", function () {
			assert.isTrue(Zotero.Cite.isTitleCased("Using DNA Barcoding With iPhone Cameras"));
			assert.isFalse(Zotero.Cite.isTitleCased("Using DNA barcoding with iPhone cameras"));
		});
		
		it("should treat an all-caps title as title-cased unless it's only acronyms", function () {
			assert.isTrue(Zotero.Cite.isTitleCased("THE EFFECTS OF STRESS ON MEMORY"));
			assert.isFalse(Zotero.Cite.isTitleCased("NASA"));
		});
	});
	
	describe("#sentenceCaseTitles()", function () {
		it("should convert a title-cased title and short title", function () {
			var cslItem = {
				type: 'article-journal',
				title: 'The Effects of Climate Change on Coastal Cities: A Review of Recent Evidence',
				'title-short': 'The Effects of Climate Change on Coastal Cities',
				'container-title': 'Journal of Applied Psychology'
			};
			Zotero.Cite.sentenceCaseTitles(cslItem);
			assert.equal(cslItem.title, 'The effects of climate change on coastal cities: a review of recent evidence');
			assert.equal(cslItem['title-short'], 'The effects of climate change on coastal cities');
			// Journal names stay in title case
			assert.equal(cslItem['container-title'], 'Journal of Applied Psychology');
		});
		
		it("should preserve nocase text", function () {
			var cslItem = {
				type: 'book',
				title: 'A Study of <span class="nocase">Shakespeare</span> and His Contemporaries'
			};
			Zotero.Cite.sentenceCaseTitles(cslItem);
			assert.equal(cslItem.title, 'A study of <span class="nocase">Shakespeare</span> and his contemporaries');
		});
		
		it("should convert the book title of a chapter", function () {
			var cslItem = {
				type: 'chapter',
				title: 'Memory',
				'container-title': 'The Handbook of Cognitive Psychology Research'
			};
			Zotero.Cite.sentenceCaseTitles(cslItem);
			assert.equal(cslItem['container-title'], 'The handbook of cognitive psychology research');
		});
		
		it("should not change titles of non-English items", function () {
			var cslItem = {
				type: 'book',
				title: 'Die Entwicklung der Wirtschaft in Deutschland',
				language: 'de'
			};
			Zotero.Cite.sentenceCaseTitles(cslItem);
			assert.equal(cslItem.title, 'Die Entwicklung der Wirtschaft in Deutschland');
		});
	});
	
	describe("APA sentence-case titles", function () {
		async function makeBibliography(styleID) {
			let item = new Zotero.Item;
			item.fromJSON({
				itemType: "book",
				title: "The Effects of Climate Change on Coastal Cities: A Review of Recent Evidence",
				creators: [{ creatorType: "author", firstName: "Jane", lastName: "Smith" }],
				date: "2019"
			});
			await item.saveTx();
			
			let style = Zotero.Styles.get(styleID);
			let cslEngine = style.getCiteProc('en-US');
			return Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [item], "text");
		}
		
		afterEach(function () {
			Zotero.Prefs.clear('cite.sentenceCaseAPATitles');
		});
		
		it("should render a title-cased title in sentence case in APA", async function () {
			assert.include(
				await makeBibliography('http://www.zotero.org/styles/apa'),
				'The effects of climate change on coastal cities: A review of recent evidence'
			);
		});
		
		it("should leave the title as stored when disabled", async function () {
			Zotero.Prefs.set('cite.sentenceCaseAPATitles', false);
			assert.include(
				await makeBibliography('http://www.zotero.org/styles/apa'),
				'The Effects of Climate Change on Coastal Cities: A Review of Recent Evidence'
			);
		});
		
		it("should leave the title as stored in non-APA styles", async function () {
			assert.include(
				await makeBibliography('http://www.zotero.org/styles/chicago-notes-bibliography'),
				'The Effects of Climate Change on Coastal Cities: A Review of Recent Evidence'
			);
		});
	});
	
	describe("previewCitationCluster()", function () {
		before(async function () {
			await Zotero.Styles.init();
			await Zotero.Styles.install(
				{ file: OS.Path.join(getTestDataDirectory().path, 'apa.csl') },
				'http://www.zotero.org/styles/apa',
				true
			);
		});
		
		async function makeEngineWithCitation() {
			let item = new Zotero.Item;
			item.fromJSON({
				itemType: "book",
				title: "Preview Test",
				creators: [{ creatorType: "author", firstName: "Jane", lastName: "Smith" }],
				date: "2019"
			});
			await item.saveTx();
			let style = Zotero.Styles.get('http://www.zotero.org/styles/apa');
			let cslEngine = style.getCiteProc('en-US', 'rtf');
			cslEngine.processCitationCluster(
				{
					citationID: "CITATION-1",
					citationItems: [{ id: item.id }],
					properties: { noteIndex: 1 }
				},
				[], []
			);
			return { cslEngine, item };
		}
		
		function assertStateRestored(cslEngine, item) {
			assert.equal(cslEngine.opt.mode, 'rtf');
			assert.lengthOf(cslEngine.registry.citationreg.citationByIndex, 1);
			// Processor should still render in its native format
			let text = cslEngine.previewCitationCluster(
				{ citationItems: [{ id: item.id }], properties: { noteIndex: 2 } },
				[["CITATION-1", 1]], [], "rtf"
			);
			assert.equal(text, "(Smith, 2019)");
		}
		
		it("shouldn't modify processor state if an item can't be retrieved", async function () {
			let { cslEngine, item } = await makeEngineWithCitation();
			assert.throws(() => {
				cslEngine.previewCitationCluster(
					{ citationItems: [{ id: 999999999 }], properties: { noteIndex: 2 } },
					[["CITATION-1", 1]], [], "html"
				);
			});
			assertStateRestored(cslEngine, item);
		});
		
		it("shouldn't modify processor state if rendering fails", async function () {
			let { cslEngine, item } = await makeEngineWithCitation();
			let stub = sinon.stub(cslEngine, 'process_CitationCluster')
				.throws(new Error("simulated rendering error"));
			assert.throws(() => {
				cslEngine.previewCitationCluster(
					{ citationItems: [{ id: item.id }], properties: { noteIndex: 2 } },
					[["CITATION-1", 1]], [], "html"
				);
			});
			stub.restore();
			assertStateRestored(cslEngine, item);
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
