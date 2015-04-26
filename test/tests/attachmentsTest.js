describe("Zotero.Attachments", function() {
	var win;
	
	before(function () {
		// Hidden browser, which requires a browser window, needed for charset detection
		// (until we figure out a better way)
		if (!Zotero.isStandalone) {
			return loadBrowserWindow().then(window => win = window);
		}
	});
	after(function () {
		if (win) {
			win.close();
		}
	});
	
	describe("#importFromFile()", function () {
		it("should create a child attachment from a text file", function* () {
			// Create test file
			var contents = "Test";
			var tmpFile = Zotero.getTempDirectory();
			tmpFile.append('test.txt');
			yield Zotero.File.putContentsAsync(tmpFile, contents);
			
			// Create parent item
			var item = new Zotero.Item('book');
			var parentItemID = yield item.save();
			
			// Create attachment and compare content
			var itemID = yield Zotero.Attachments.importFromFile(tmpFile, parentItemID);
			var item = yield Zotero.Items.getAsync(itemID);
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(itemID);
		});
		
		it("should create a child attachment from a PNG file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			// Create parent item
			var item = new Zotero.Item('book');
			var parentItemID = yield item.save();
			
			// Create attachment and compare content
			var itemID = yield Zotero.Attachments.importFromFile(file, parentItemID);
			var item = yield Zotero.Items.getAsync(itemID);
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(itemID);
		});
	})
})
