var lookupIdentifier = Zotero.Promise.coroutine(function* (win, identifier) {
	var textbox = win.document.getElementById("zotero-lookup-textbox");
	textbox.value = identifier;
	var promise = waitForItemEvent("add");
	yield win.Zotero_Lookup.accept(textbox);
	return promise;
});

describe("Add Item by Identifier", function() {
	var win;
	
	before(function* () {
		if (Zotero.automatedTest) {
			this.skip();
			return;
		}
		win = yield loadZoteroPane();
	});
	
	after(function() {
		if (win) {
			win.close();
		}
	});
	
	// TODO: mock external services: https://github.com/zotero/zotero/issues/699
	
	it("should add an ISBN-10", function() {
		this.timeout(20000);
		return lookupIdentifier(win, "0838985890").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Zotero: a guide for librarians, researchers, and educators");
		});
	});
	
	it("should add an ISBN-13", function() {
		this.timeout(20000);
		return lookupIdentifier(win, "978-0838985892").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Zotero: a guide for librarians, researchers, and educators");
		});
	});
	
	it("should add a DOI", function() {
		this.timeout(10000);
		return lookupIdentifier(win, "10.4103/0976-500X.85940").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Zotero: A bibliographic assistant to researcher");
		});
	});
	
	it.skip("should add a DOI with an open-access PDF");
	
	// e.g., arXiv
	it.skip("should not add a PDF if a DOI already retrieves one");
	
	it("should add a PMID", function() {
		this.timeout(10000);
		return lookupIdentifier(win, "24297125").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Taking control of your digital library: how modern citation managers do more than just referencing");
		});
	});
	
	it("should add an item within a collection", function* () {
		this.timeout(10000);
		
		var col = yield createDataObject('collection');
		yield waitForItemsLoad(win);
		
		// Initial translator
		var ids = yield lookupIdentifier(win, "10.4103/0976-500X.85940");
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.getField("title"), "Zotero: A bibliographic assistant to researcher");
		assert.isTrue(item.inCollection(col.id));
		
		// Fallback translator
		var ids = yield lookupIdentifier(win, "10.5281/zenodo.55073");
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.getField("title"), "Comparison Of Spectral Methods Through The Adjacency Matrix And The Laplacian Of A Graph");
		assert.isTrue(item.inCollection(col.id));
	});
});