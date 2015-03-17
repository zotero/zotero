function lookupIdentifier(win, identifier) {
	var textbox = win.document.getElementById("zotero-lookup-textbox");
	textbox.value = identifier;
	win.Zotero_Lookup.accept(textbox);
	return waitForItemEvent("add");
}

describe("Add Item by Identifier", function() {
	var win;
	before(function() {
		this.timeout(5000);
		// Load a Zotero pane and update the translators (needed to
		// make sure they're available before we run the tests)
		return loadZoteroPane().then(function(w) {
			win = w;
		});
	});
	after(function() {
		win.close();
	});

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
	it("should add a PMID", function() {
		this.timeout(10000);
		return lookupIdentifier(win, "24297125").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Taking control of your digital library: how modern citation managers do more than just referencing");
		});
	});
});