describe("Zotero.File", function () {
	describe("#getContentsAsync()", function () {
		it("should handle an empty file", function* () {
			var path = OS.Path.join(getTestDataDirectory().path, "empty");
			assert.equal((yield Zotero.File.getContentsAsync(path)), "");
		})
		
		it("should handle an extended character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "utf8.txt")
			);
			assert.lengthOf(contents, 3);
			assert.equal(contents, "A\u72acB");
		})
		
		it("should handle an extended Windows-1252 character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "windows1252.txt"),
				"windows-1252"
			);
			assert.lengthOf(contents, 1);
			assert.equal(contents, "\u00E9");
		})
		
		it("should handle a GBK character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "gbk.txt"),
				"gbk"
			);
			assert.lengthOf(contents, 1);
			assert.equal(contents, "\u4e02");
		})
		
		it("should handle an invalid character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "invalid.txt")
			);
			assert.lengthOf(contents, 3);
			assert.equal(contents, "A\uFFFDB");
		})
	})
	
	describe("#copyDirectory()", function () {
		it("should copy all files within a directory", function* () {
			var tmpDir = Zotero.getTempDirectory().path;
			var tmpCopyDir = OS.Path.join(tmpDir, "copyDirectory")
			var source = OS.Path.join(tmpCopyDir, "1");
			var target = OS.Path.join(tmpCopyDir, "2");
			yield OS.File.makeDir(source, {
				from: tmpDir
			});
			
			yield Zotero.File.putContentsAsync(OS.Path.join(source, "A"), "Test 1");
			yield Zotero.File.putContentsAsync(OS.Path.join(source, "B"), "Test 2");
			
			yield OS.File.removeDir(target, {
				ignoreAbsent: true
			});
			
			yield Zotero.File.copyDirectory(source, target);
			
			assert.equal(
				(yield Zotero.File.getContentsAsync(OS.Path.join(target, "A"))),
				"Test 1"
			);
			assert.equal(
				(yield Zotero.File.getContentsAsync(OS.Path.join(target, "B"))),
				"Test 2"
			);
		})
	})
	
	describe("#zipDirectory()", function () {
		afterEach(function () {
			Zotero.Prefs.set('debug.log', false);
			Zotero.Debug.init();
		});
		
		it("should compress a directory recursively", function* () {
			Zotero.Prefs.set('debug.log', true);
			Zotero.Debug.init();
			
			var tmpPath = Zotero.getTempDirectory().path;
			var path = OS.Path.join(tmpPath, Zotero.Utilities.randomString());
			yield OS.File.makeDir(path);
			yield Zotero.File.putContentsAsync(OS.Path.join(path, '.zotero-ft-cache'), '');
			yield Zotero.File.putContentsAsync(OS.Path.join(path, 'a.txt'), 'A');
			// Create subdirectory
			var subPath = OS.Path.join(path, 'sub');
			yield OS.File.makeDir(subPath);
			yield Zotero.File.putContentsAsync(OS.Path.join(subPath, 'b.txt'), 'B');
			
			var zipFile = OS.Path.join(tmpPath, 'test.zip');
			yield Zotero.File.zipDirectory(path, zipFile);
			
			var zr = Components.classes["@mozilla.org/libjar/zip-reader;1"]
				.createInstance(Components.interfaces.nsIZipReader);
			zr.open(Zotero.File.pathToFile(zipFile));
			var entries = zr.findEntries('*');
			var files = {};
			var is = Components.classes['@mozilla.org/scriptableinputstream;1']
				.createInstance(Components.interfaces.nsIScriptableInputStream);
			while (entries.hasMore()) {
				let entryPointer = entries.getNext();
				let entry = zr.getEntry(entryPointer);
				let inputStream = zr.getInputStream(entryPointer);
				is.init(inputStream);
				files[entryPointer] = is.read(entry.realSize);
			}
			zr.close();
			
			assert.notProperty(files, '.zotero-ft-cache');
			assert.propertyVal(files, 'a.txt', 'A');
			assert.propertyVal(files, 'sub/b.txt', 'B');
		});
	});
})
