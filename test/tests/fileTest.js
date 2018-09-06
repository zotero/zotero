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
		it("should save a text string", async function () {
			var tmpDir = await getTempDirectory();
			var destFile = OS.Path.join(tmpDir, 'test');
			var str = 'A';
			await Zotero.File.putContentsAsync(destFile, str);
			assert.equal(await Zotero.File.getContentsAsync(destFile), str);
		});
		
		it("should save a Blob", async function () {
			var srcFile = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
			var tmpDir = await getTempDirectory();
			var destFile = OS.Path.join(tmpDir, 'test.pdf');
			
			var blob = await File.createFromFileName(srcFile);
			await Zotero.File.putContentsAsync(destFile, blob);
			
			var destContents = await Zotero.File.getBinaryContentsAsync(destFile);
			assert.equal(
				await Zotero.File.getBinaryContentsAsync(srcFile),
				destContents
			);
			
			assert.equal(destContents.substr(0, 4), '%PDF');
		});
		
		it("should save via .tmp file", function* () {
			var tmpDir = yield getTempDirectory();
			var destFile = OS.Path.join(tmpDir, 'test.txt')
			var tmpFile = destFile + ".tmp";
			yield Zotero.File.putContentsAsync(tmpFile, 'A');
			assert.isTrue(yield OS.File.exists(tmpFile));
			yield Zotero.File.putContentsAsync(destFile, 'B');
			assert.isFalse(yield OS.File.exists(tmpFile));
			// Make sure .tmp file was deleted
			assert.isFalse(yield OS.File.exists(tmpFile + '.tmp'));
		});
	});
	
	
	describe("#rename()", function () {
		it("should rename a file", async function () {
			var tmpDir = await getTempDirectory();
			var sourceFile = OS.Path.join(tmpDir, 'a');
			var destFile = OS.Path.join(tmpDir, 'b');
			await Zotero.File.putContentsAsync(sourceFile, '');
			await Zotero.File.rename(sourceFile, 'b');
			assert.isTrue(await OS.File.exists(destFile));
		});
		
		it("should overwrite an existing file if `overwrite` is true", async function () {
			var tmpDir = await getTempDirectory();
			var sourceFile = OS.Path.join(tmpDir, 'a');
			var destFile = OS.Path.join(tmpDir, 'b');
			await Zotero.File.putContentsAsync(sourceFile, 'a');
			await Zotero.File.putContentsAsync(destFile, 'b');
			await Zotero.File.rename(sourceFile, 'b', { overwrite: true });
			assert.isTrue(await OS.File.exists(destFile));
			assert.equal(await Zotero.File.getContentsAsync(destFile), 'a');
		});
		
		it("should get a unique name if target file exists and `unique` is true", async function () {
			var tmpDir = await getTempDirectory();
			var sourceFile = OS.Path.join(tmpDir, 'a');
			var destFile = OS.Path.join(tmpDir, 'b');
			await Zotero.File.putContentsAsync(sourceFile, 'a');
			await Zotero.File.putContentsAsync(destFile, 'b');
			var newFilename = await Zotero.File.rename(sourceFile, 'b', { unique: true });
			var realDestFile = OS.Path.join(tmpDir, newFilename);
			assert.equal(newFilename, 'b 2');
			assert.isTrue(await OS.File.exists(realDestFile));
			assert.equal(await Zotero.File.getContentsAsync(realDestFile), 'a');
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
	
	
	describe("#moveToUnique", function () {
		it("should move a file to a unique filename", async function () {
			var tmpDir = Zotero.getTempDirectory().path;
			var sourceFile = OS.Path.join(tmpDir, "1");
			var tmpTargetDir = OS.Path.join(tmpDir, "targetDirectory")
			var targetFile = OS.Path.join(tmpTargetDir, "file.txt");
			await OS.File.makeDir(tmpTargetDir);
			await Zotero.File.putContentsAsync(sourceFile, "");
			await Zotero.File.putContentsAsync(targetFile, "");
			var newFile = await Zotero.File.moveToUnique(sourceFile, targetFile);
			assert.equal(OS.Path.join(tmpTargetDir, 'file-1.txt'), newFile);
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
