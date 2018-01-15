describe("PDF Recognition", function() {
	var win;
	
	before(function* () {
		if (Zotero.automatedTest) this.skip(); // TODO: Mock services
		
		this.timeout(60000);
		// Load Zotero pane and install PDF tools
		yield Zotero.Promise.all([
			loadZoteroPane().then(w => win = w)
		]);
	});
	
	beforeEach(function* () {
		yield selectLibrary(win);
	});
	
	afterEach(function() {
		for(let win of getWindows("chrome://zotero/content/pdfProgress.xul")) {
			win.close();
		}
	});
	
	after(function() {
		if (win) {
			win.close();
		}
	});

	it("should recognize a PDF with a DOI within a collection", function* () {
		this.timeout(30000);
		// Import the PDF
		var testdir = getTestDataDirectory();
		testdir.append("recognizePDF_test_DOI.pdf");
		
		var col = yield createDataObject('collection');
		yield waitForItemsLoad(win);
		
		var attachment = yield Zotero.Attachments.importFromFile({
			file: testdir,
			collections: [col.id]
		});

		// Recognize the PDF
		win.Zotero_RecognizePDF.recognizeSelected();

		var ids = yield waitForItemEvent("add");
		yield waitForNotifierEvent('add', 'collection-item')
		
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.getField("title"), "Shaping the Research Agenda");
		assert.equal(item.getField("libraryCatalog"), "CrossRef");
		assert.equal(attachment.parentID, item.id);
		assert.isTrue(col.hasItem(item.id));
	});

	it("should recognize a PDF without a DOI", function* () {
		this.timeout(30000);
		// Import the PDF
		var testdir = getTestDataDirectory();
		testdir.append("recognizePDF_test_GS.pdf");
		var item = yield Zotero.Attachments.importFromFile({
			file: testdir
		});
		
		// Recognize the PDF
		win.Zotero_RecognizePDF.recognizeSelected();

		var addedIDs = yield waitForItemEvent("add");
		var modifiedIDs = yield waitForItemEvent("modify");
		assert.lengthOf(addedIDs, 1);
		var item = Zotero.Items.get(addedIDs[0]);
		assert.equal(item.getField("title"), "Scaling study of an improved fermion action on quenched lattices");
		assert.equal(item.getField("libraryCatalog"), "Google Scholar");
		assert.lengthOf(modifiedIDs, 2);
		
		yield Zotero.Promise.delay(0);
		
		var progressWindow = getWindows("chrome://zotero/content/pdfProgress.xul")[0];
		assert.equal(
			progressWindow.document.getElementById("label").value,
			Zotero.getString("recognizePDF.complete.label")
		);
	});
});