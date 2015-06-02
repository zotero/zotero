describe("Zotero.Attachments", function() {
	var win;
	
	before(function* () {
		// Hidden browser, which requires a browser window, needed for charset detection
		// (until we figure out a better way)
		win = yield loadBrowserWindow();
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
			var parentItemID = yield item.saveTx();
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: tmpFile,
				parentItemID: parentItemID
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a top-level attachment from a PNG file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a top-level attachment from a PNG file in a collection", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			var collection = yield createDataObject('collection');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file,
				collections: [collection.id]
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
		
		it("should create a child attachment from a PNG file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var contents = yield Zotero.File.getBinaryContentsAsync(file);
			
			// Create parent item
			var item = new Zotero.Item('book');
			var parentItemID = yield item.saveTx();
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: parentItemID
			});
			var storedFile = item.getFile();
			assert.equal((yield Zotero.File.getBinaryContentsAsync(storedFile)), contents);
			
			// Clean up
			yield Zotero.Items.erase(item.id);
		});
	})
	
	describe("#linkToFile()", function () {
		it("should link to a file in My Library", function* () {
			var item = yield createDataObject('item');
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.linkFromFile({
				file: file,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getFilePath(), file.path);
		})
		
		it.skip("should throw an error for a non-user library", function* () {
			// Should create a group library for use by all tests
		})
	})
})
