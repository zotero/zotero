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
		for(let win of getWindows("chrome://zotero/content/recognizePDFDialog.xul")) {
			win.close();
		}
	});
	
	after(function() {
		if (win) {
			win.close();
		}
	});

	it("should recognize a PDF", function* () {
		this.timeout(30000);
		// Import the PDF
		var testdir = getTestDataDirectory();
		testdir.append("recognizePDF_test_GS.pdf");
		var item = yield Zotero.Attachments.importFromFile({
			file: testdir
		});
		
		// Recognize the PDF
		win.ZoteroPane.recognizeSelected();
		
		var addedIDs = yield waitForItemEvent("add");
		var modifiedIDs = yield waitForItemEvent("modify");
		assert.lengthOf(addedIDs, 1);
		var item = Zotero.Items.get(addedIDs[0]);
		assert.equal(item.getField("title"), "Scaling study of an improved fermion action on quenched lattices");
		assert.lengthOf(modifiedIDs, 2);
		
		yield Zotero.Promise.delay(0);
		
		var progressWindow = getWindows("chrome://zotero/content/recognizePDFDialog.xul")[0];
		assert.equal(
			progressWindow.document.getElementById("label").value,
			Zotero.getString("recognizePDF.complete.label")
		);
	});
});