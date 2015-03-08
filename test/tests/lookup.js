function lookupIdentifier(win, identifier) {
	var tbbutton = win.document.getElementById("zotero-tb-lookup");
	tbbutton.open = true;
	return waitForDOMEvent(win.document.getElementById("zotero-lookup-panel"), "popupshown").then(function() {
		tbbutton.open = true; // Shouldn't be necessary, but seems to be on Fx ESR under Xvfb
		var textbox = win.document.getElementById("zotero-lookup-textbox");
		textbox.value = identifier;
		textbox.focus();
		EventUtils.synthesizeKey("VK_RETURN", {}, win);
		var closePromise = waitForDOMEvent(win.document.getElementById("zotero-lookup-panel"), "popuphidden");
		return waitForItemEvent("add");
	});
}

describe("Add Item by Identifier", function() {
	var win;
	before(function() {
		this.timeout(5000);
		return loadZoteroPane().then(function(w) {
			win = w;
		}).then(function() {
			return waitForTranslators();
		});
	});
	after(function() {
		win.close();
	});

	it("should add an ISBN-10", function() {
		this.timeout(10000);
		return lookupIdentifier(win, "0838985890").then(function(ids) {
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField("title"), "Zotero: a guide for librarians, researchers, and educators");
		});
	});
	it("should add an ISBN-13", function() {
		this.timeout(10000);
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