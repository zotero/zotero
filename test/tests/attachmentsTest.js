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
	
	describe("#linkFromFile()", function () {
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
	
	describe("#importSnapshotFromFile()", function () {
		it("should import an HTML file", function* () {
			var item = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.html');
			var attachment = yield Zotero.Attachments.importSnapshotFromFile({
				title: 'Snapshot',
				url: 'http://example.com',
				file,
				parentItemID: item.id,
				contentType: 'text/html',
				charset: 'utf-8'
			});
			
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'test');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		});
		
		it("should detect charset for an HTML file", function* () {
			var item = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.html');
			var attachment = yield Zotero.Attachments.importSnapshotFromFile({
				title: 'Snapshot',
				url: 'http://example.com',
				file,
				parentItemID: item.id,
				contentType: 'text/html'
			});
			
			assert.equal(attachment.attachmentCharset, 'utf-8');
			
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'test');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		});
	});
	
	describe("#linkFromDocument", function () {
		it("should add a link attachment for the current webpage", function* () {
			var item = yield createDataObject('item');
			
			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
			var deferred = Zotero.Promise.defer();
			win.addEventListener('pageshow', () => deferred.resolve());
			win.loadURI(uri);
			yield deferred.promise;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.linkFromDocument({
				document: win.content.document,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getField('url'), "file://" + uri);
			
			// Check indexing
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
		})
	})
	
	describe("#importFromDocument()", function () {
		it("should save a document with embedded files", function* () {
			var item = yield createDataObject('item');
			
			var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
			var deferred = Zotero.Promise.defer();
			win.addEventListener('pageshow', () => deferred.resolve());
			win.loadURI(uri);
			yield deferred.promise;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.importFromDocument({
				document: win.content.document,
				parentItemID: item.id
			});
			
			assert.equal(attachment.getField('url'), "file://" + uri);
			
			// Check indexing
			var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'share your research');
			assert.lengthOf(matches, 1);
			assert.propertyVal(matches[0], 'id', attachment.id);
			
			// Check for embedded files
			var storageDir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var file = yield attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(file), 'index.html');
			assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, 'img.gif')));
		});
	});
	
	describe("#getBaseDirectoryRelativePath()", function () {
		it("should handle base directory at Windows drive root", function () {
			Zotero.Prefs.set('baseAttachmentPath', "C:\\");
			var path = Zotero.Attachments.getBaseDirectoryRelativePath("C:\\file.txt");
			assert.equal(path, Zotero.Attachments.BASE_PATH_PLACEHOLDER + "file.txt");
		});
		
		it("should convert backslashes to forward slashes", function () {
			Zotero.Prefs.set('baseAttachmentPath', "C:\\foo\\bar");
			var path = Zotero.Attachments.getBaseDirectoryRelativePath("C:\\foo\\bar\\test\\file.txt");
			assert.equal(path, Zotero.Attachments.BASE_PATH_PLACEHOLDER + "test/file.txt");
		});
	});
	
	describe("#getTotalFileSize", function () {
		it("should return the size for a single-file attachment", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			
			assert.equal((yield Zotero.Attachments.getTotalFileSize(item)), file.fileSize);
		})
	})
	
	describe("#hasMultipleFiles and #getNumFiles()", function () {
		it("should return false and 1 for a single file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			
			assert.isFalse(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 1);
		})
		
		it("should return false and 1 for single HTML file with hidden file", function* () {
			var file = getTestDataDirectory();
			file.append('test.html');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var path = OS.Path.join(OS.Path.dirname(item.getFilePath()), '.zotero-ft-cache');
			yield Zotero.File.putContentsAsync(path, "");
			
			assert.isFalse(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 1);
		})
		
		it("should return true and 2 for multiple files", function* () {
			var file = getTestDataDirectory();
			file.append('test.html');
			
			// Create attachment and compare content
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var path = OS.Path.join(OS.Path.dirname(item.getFilePath()), 'test.png');
			yield Zotero.File.putContentsAsync(path, "");
			
			assert.isTrue(yield Zotero.Attachments.hasMultipleFiles(item));
			assert.equal((yield Zotero.Attachments.getNumFiles(item)), 2);
		})
	});
	
	describe("#createDirectoryForItem()", function () {
		it("should create missing directory", function* () {
			var item = yield importFileAttachment('test.png');
			var path = OS.Path.dirname(item.getFilePath());
			yield OS.File.removeDir(path);
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield OS.File.exists(path));
		});
		
		it("should delete all existing files", function* () {
			var item = yield importFileAttachment('test.html');
			var path = OS.Path.dirname(item.getFilePath());
			var files = ['a', 'b', 'c', 'd'];
			for (let file of files) {
				yield Zotero.File.putContentsAsync(OS.Path.join(path, file), file);
			}
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield Zotero.File.directoryIsEmpty(path));
			assert.isTrue(yield OS.File.exists(path));
		});
		
		it("should handle empty directory", function* () {
			var item = yield importFileAttachment('test.png');
			var file = item.getFilePath();
			var dir = OS.Path.dirname(item.getFilePath());
			yield OS.File.remove(file);
			yield Zotero.Attachments.createDirectoryForItem(item);
			assert.isTrue(yield OS.File.exists(dir));
		});
	});
})
