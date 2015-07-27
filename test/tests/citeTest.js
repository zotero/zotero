describe("Zotero.Cite.System", function() {
	describe("#retrieveItem()", function() {
		let article, citeSystem;
		before(function() {
			// Load sample item into DB
			let data = populateDBWithSampleData(loadSampleData('journalArticle'));
			article = Zotero.Items.get(data.journalArticle.id);
			
			// instantiate Zotero.Cite.System object
			citeSystem = new Zotero.Cite.System();
		});
		
		it('should retrieve item given a Zotero.Item', function() {
			let cslItem = citeSystem.retrieveItem(article);
			assert.ok(cslItem);
			assert.equal(cslItem.id, article.id);
		});
		
		it.skip('should retrieve item given an item URI', function() {
			let cslItem = citeSystem.retrieveItem(Zotero.URI.getItemURI(article));
			assert.ok(cslItem);
			assert.equal(cslItem.id, article.id);
		});
		
		it('should retrieve item given a local DB ID', function() {
			let cslItem = citeSystem.retrieveItem(article.id);
			assert.ok(cslItem);
			assert.equal(cslItem.id, article.id);
		});
		
		it('should exclude URL if preference is selected', function() {
			let originalPref = Zotero.Prefs.get("export.citePaperJournalArticleURL");
			
			Zotero.Prefs.set("export.citePaperJournalArticleURL", true);
			let withURL = citeSystem.retrieveItem(article);
			assert.ok(withURL.URL, "URL is set when preference is true");
			
			Zotero.Prefs.set("export.citePaperJournalArticleURL", false);
			let withoutURL = citeSystem.retrieveItem(article);
			assert.isUndefined(withoutURL.URL, "URL is undefined when preference is false");
			
			delete withURL.URL;
			assert.deepEqual(withURL, withoutURL, "objects are the same except for the URL");
			
			Zotero.Prefs.set("export.citePaperJournalArticleURL", originalPref);
		});
	});
});
