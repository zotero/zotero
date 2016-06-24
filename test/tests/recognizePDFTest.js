describe.skip("PDF Recognition", function() {
	var win;
	
	before(function* () {
		this.timeout(60000);
		// Load Zotero pane and install PDF tools
		yield Zotero.Promise.all([
			loadZoteroPane().then(w => win = w),
			installPDFTools(),
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
		win.close();
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
		if (Zotero.automatedTest) this.skip(); // CAPTCHAs make this fail
		
		this.timeout(30000);
		// Import the PDF
		var testdir = getTestDataDirectory();
		testdir.append("recognizePDF_test_GS.pdf");
		var item = yield Zotero.Attachments.importFromFile({
			file: testdir
		});
		
		// Recognize the PDF
		win.Zotero_RecognizePDF.recognizeSelected();

		var ids = yield waitForItemEvent("add");
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.getField("title"), "Scaling study of an improved fermion action on quenched lattices");
		assert.equal(item.getField("libraryCatalog"), "Google Scholar");
	});
});