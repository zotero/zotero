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
		
		it("should respect maxLength", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "test.txt"),
				false,
				6
			);
			assert.lengthOf(contents, 6);
			assert.equal(contents, "Zotero");
		});
		
		it("should get a file from a file: URI", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.toFileURI(OS.Path.join(getTestDataDirectory().path, "test.txt"))
			);
			assert.isTrue(contents.startsWith('Zotero'));
		});
	})
	
	describe("#getBinaryContentsAsync()", function () {
		var magicPNG = ["89", "50", "4e", "47", "0d", "0a", "1a", "0a"].map(x => parseInt(x, 16));
		
		it("should return a binary string", function* () {
			var contents = yield Zotero.File.getBinaryContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "test.png")
			);
			assert.isAbove(contents.length, magicPNG.length);
			for (let i = 0; i < magicPNG.length; i++) {
				assert.equal(magicPNG[i], contents.charCodeAt(i));
			}
		});
		
		it("should respect maxLength", function* () {
			var contents = yield Zotero.File.getBinaryContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "test.png"),
				magicPNG.length
			);
			assert.lengthOf(contents, magicPNG.length)
			for (let i = 0; i < contents.length; i++) {
				assert.equal(magicPNG[i], contents.charCodeAt(i));
			}
		});
	});
	
	describe("#putContentsAsync()", function () {
		it("should save via .tmp file", function* () {
			var tmpDir = yield getTempDirectory();
			var destFile = OS.Path.join(tmpDir, 'test.txt')
			var tmpFile = destFile + ".tmp";
			yield Zotero.File.putContentsAsync(tmpFile, 'A');
			assert.isTrue(yield OS.File.exists(tmpFile));
			yield Zotero.File.putContentsAsync(destFile, 'B');
			assert.isFalse(yield OS.File.exists(tmpFile));
			// Make sure .tmp file created when creating temp file was deleted too
			assert.isFalse(yield OS.File.exists(tmpFile + '.tmp'));
		});
	});
	
	
	describe("#getClosestDirectory()", function () {
		it("should return directory for file that exists", function* () {
			var tmpDir = yield getTempDirectory();
			var closest = yield Zotero.File.getClosestDirectory(tmpDir);
			assert.equal(closest, tmpDir);
		});
		
		it("should return parent directory for missing file", function* () {
			var tmpDir = yield getTempDirectory();
			var closest = yield Zotero.File.getClosestDirectory(OS.Path.join(tmpDir, 'a'));
			assert.equal(closest, tmpDir);
		});
		
		it("should find an existing directory three levels up from a missing file", function* () {
			var tmpDir = yield getTempDirectory();
			var closest = yield Zotero.File.getClosestDirectory(OS.Path.join(tmpDir, 'a', 'b', 'c'));
			assert.equal(closest, tmpDir);
		});
		
		it("should return false for a path that doesn't exist at all", function* () {
			assert.isFalse(yield Zotero.File.getClosestDirectory('/a/b/c'));
		});
	});
	
	
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
		it("should compress a directory recursively", function* () {
			var tmpPath = Zotero.getTempDirectory().path;
			var path = OS.Path.join(tmpPath, Zotero.Utilities.randomString());
			yield OS.File.makeDir(path, { unixMode: 0o755 });
			yield Zotero.File.putContentsAsync(OS.Path.join(path, '.zotero-ft-cache'), '');
			yield Zotero.File.putContentsAsync(OS.Path.join(path, 'a.txt'), 'A');
			// Create subdirectory
			var subPath = OS.Path.join(path, 'sub');
			yield OS.File.makeDir(subPath, { unixMode: 0o755 });
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
	
	
	describe("#checkFileAccessError()", function () {
		it("should catch OS.File access-denied errors", function* () {
			// We can't modify a real OS.File.Error, but we also don't do an instanceof check in
			// checkFileAccessError, so just set the expected properties.
			var e = {
				operation: 'open',
				becauseAccessDenied: true,
				path: '/tmp/test'
			};
			try {
				Zotero.File.checkFileAccessError(e, e.path, 'create');
			}
			catch (e) {
				if (e instanceof Zotero.Error) {
					return;
				}
				throw e;
			}
			throw new Error("Error not thrown");
		});
	});
})
