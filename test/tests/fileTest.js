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
			assert.lengthOf(contents, 3);
			assert.equal(contents, "\u201C\u00E9\u201D");
		})
		
		it("should handle a GBK character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "gbk.txt"),
				"gbk"
			);
			assert.lengthOf(contents, 9);
			assert.equal(contents, "这是一个测试文件。");
		})
		
		it("should handle an invalid character", function* () {
			var contents = yield Zotero.File.getContentsAsync(
				OS.Path.join(getTestDataDirectory().path, "charsets", "invalid.txt")
			);
			assert.lengthOf(contents, 3);
			assert.equal(contents, "A" + Zotero.File.REPLACEMENT_CHARACTER + "B");
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
		
		it("should take a file:// URI", async function () {
			var file = OS.Path.join(getTestDataDirectory().path, "test.png");
			var uri = PathUtils.toFileURI(file);
			
			var contents = await Zotero.File.getBinaryContentsAsync(uri);
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
		
		// Only relevant on a case-insensitive filesystem
		it("should rename a file with a case-only change (Mac)", async function () {
			var tmpDir = await getTempDirectory();
			var sourceFile = OS.Path.join(tmpDir, 'a');
			var destFile = OS.Path.join(tmpDir, 'A');
			await Zotero.File.putContentsAsync(sourceFile, 'foo');
			var newFilename = await Zotero.File.rename(sourceFile, 'A');
			assert.equal(newFilename, 'A');
			assert.equal(await Zotero.File.getContentsAsync(destFile), 'foo');
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
		
		it("should copy subfolders", async function () {
			// file1
			// subdir/file2
			var tmpDir = await getTempDirectory()
			var source = OS.Path.join(tmpDir, "1");
			await OS.File.makeDir(OS.Path.join(source, 'subdir'), {
				from: tmpDir
			});
			Zotero.File.putContents(Zotero.File.pathToFile(OS.Path.join(source, 'file1')), 'abc');
			Zotero.File.putContents(Zotero.File.pathToFile(OS.Path.join(source, 'subdir', 'file2')), 'def');
			
			var target = OS.Path.join(tmpDir, "2");
			await OS.File.makeDir(target);
			
			await Zotero.File.copyDirectory(source, target);
			
			var targetFile1 = OS.Path.join(target, 'file1');
			var targetFile2 = OS.Path.join(target, 'subdir', 'file2');
			assert.isTrue(await OS.File.exists(targetFile1));
			assert.isTrue(await OS.File.exists(targetFile2));
			assert.equal(Zotero.File.getContents(targetFile1), 'abc');
			assert.equal(Zotero.File.getContents(targetFile2), 'def');
		});
	})
	
	describe("#createDirectoryIfMissing()", function () {
		it("should throw error on broken symlink", async function () {
			if (Zotero.isWin) {
				this.skip();
			};
			
			var tmpPath = await getTempDirectory();
			var destPath = OS.Path.join(tmpPath, 'missing');
			var linkPath = OS.Path.join(tmpPath, 'link');
			await OS.File.unixSymLink(destPath, linkPath);
			
			assert.throws(() => Zotero.File.createDirectoryIfMissing(linkPath), /^Broken symlink/);
		});
	});
	
	describe("#createDirectoryIfMissingAsync()", function () {
		it("should throw error on broken symlink", async function () {
			if (Zotero.isWin) {
				this.skip();
			};
			
			var tmpPath = await getTempDirectory();
			var destPath = OS.Path.join(tmpPath, 'missing');
			var linkPath = OS.Path.join(tmpPath, 'link');
			await OS.File.unixSymLink(destPath, linkPath);
			
			var e = await getPromiseError(Zotero.File.createDirectoryIfMissingAsync(linkPath));
			assert.ok(e);
			assert.match(e.message, /^Broken symlink/);
		});
		
		it("should handle 'from' in options", async function () {
			var tmpPath = await getTempDirectory();
			var path = OS.Path.join(tmpPath, 'a', 'b');
			await Zotero.File.createDirectoryIfMissingAsync(path, { from: tmpPath });
			assert.isTrue(await OS.File.exists(path));
		});
	});
	
	describe("#directoryContains()", function () {
		it("should return true for file within folder ending in slash", function () {
			assert.isTrue(Zotero.File.directoryContains('/foo/', '/foo/bar'));
		});
		
		it("should return true for file within folder not ending in slash", function () {
				assert.isTrue(Zotero.File.directoryContains('/foo/', '/foo/bar'));
		});
		
		it("should return true for file within subfolder", function () {
				assert.isTrue(Zotero.File.directoryContains('/foo/', '/foo/bar/qux'));
		});
		
		it("should return false for subfolder with same name within another folder", function () {
				assert.isFalse(Zotero.File.directoryContains('/foo', '/bar/foo'));
		});
		
		it("should return false for sibling folder that starts with the same string", function () {
			assert.isFalse(Zotero.File.directoryContains('/foo', '/foobar'));
		});
	});
	
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
	
	
	describe("#truncateFileName()", function () {
		it("should drop extension if longer than limit", function () {
			var filename = "lorem.json";
			var shortened = Zotero.File.truncateFileName(filename, 5);
			assert.equal(shortened, "lorem");
		});
		
		it("should use byte length rather than character length", function () {
			var filename = "\uD83E\uDD92abcdefgh.pdf";
			var shortened = Zotero.File.truncateFileName(filename, 10);
			assert.equal(shortened, "\uD83E\uDD92ab.pdf");
		});
		
		it("should remove characters, not bytes", function () {
			// Emoji would put length over limit, so it should be removed completely
			var filename = "abcé\uD83E\uDD92.pdf";
			var shortened = Zotero.File.truncateFileName(filename, 10);
			assert.equal(shortened, "abcé.pdf");
		});
		
		it("should replace single multi-byte character with underscore if longer than maxLength", function () {
			// Emoji would put length over limit, so it should be replaced with _
			var filename = "\uD83E\uDD92.pdf";
			var shortened = Zotero.File.truncateFileName(filename, 5);
			assert.equal(shortened, "_.pdf");
		});
		
		// The optimal behavior would probably be to remove the entire character sequence, but I'm
		// not sure we can do that without an emoji library, so just make sure we're removing whole
		// characters without corrupting anything.
		it("should cruelly break apart families", function () {
			var family = [
				"\uD83D\uDC69", // woman (4)
				"\uD83C\uDFFE", // skin tone (4)
				"\u200D", // zero-width joiner (3)
				"\uD83D\uDC68", // man (4)
				"\uD83C\uDFFE", // skin tone (4)
				"\u200D", // zero-width joiner (3)
				"\uD83D\uDC67", // girl (4)
				"\uD83C\uDFFE", // skin tone (4)
				"\u200D", // zero-width joiner (3)
				"\uD83D\uDC66", // boy (4)
				"\uD83C\uDFFE" // skin tone (4)
			].join("");
			
			var filename = "abc" + family + ".pdf";
			var limit = 3 // 'abc'
				+ 4 + 4 + 3
				+ 4 + 4 + 3
				+ 4; // ext
			// Add some extra bytes to make sure we don't corrupt an emoji character
			limit += 2;
			var shortened = Zotero.File.truncateFileName(filename, limit);
			assert.equal(
				shortened,
				"abc"
					+ "\uD83D\uDC69"
					+ "\uD83C\uDFFE"
					+ "\u200D"
					+ "\uD83D\uDC68"
					+ "\uD83C\uDFFE"
					+ "\u200D"
					+ ".pdf"
			);
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

	describe('#download()', function () {
		const sizeInMB = 16; // size of the generated text file
		let port, httpd, baseURL;

		before(async function () {
			// Real HTTP server
			Components.utils.import("resource://zotero-unit/httpd.js");
			port = 16213;
			httpd = new HttpServer();
			baseURL = `http://127.0.0.1:${port}`;
			httpd.start(port);
			httpd.registerPathHandler(
				'/file1.txt',
				{
					handle: function (request, response) {
						const text1KB = Array.from({ length: 64 }, _ => "lorem ipsum foo\n").join('');
						const text16MB = Array.from({ length: 1024 * sizeInMB }, _ => text1KB).join('');
						response.setStatusLine(null, 200, "OK");
						response.setHeader('Content-Type', 'text/plain', false);
						response.write(text16MB);
					}
				}
			);
		});

		after(function* () {
			var defer = new Zotero.Promise.defer();
			httpd.stop(() => defer.resolve());
			yield defer.promise;
		});

		it("should download a file", async function () {
			const url = `${baseURL}/file1.txt`;
			const path = OS.Path.join(Zotero.getTempDirectory().path, 'zotero.txt');
			await Zotero.File.download(url, path);
			const fileSize = (await OS.File.stat(path)).size;
			assert.equal(fileSize, 1024 * 1024 * sizeInMB);
		});

		it("should concurrently download three large files", async function () {
			const url = `${baseURL}/file1.txt`;
			
			var { ConcurrentCaller } = ChromeUtils.import("resource://zotero/concurrentCaller.js");
			var caller = new ConcurrentCaller({
				numConcurrent: 3,
				Promise: Zotero.Promise,
			});

			let failed = false;

			const fetchFile = async (srcUrl, targetPath) => {
				try {
					await Zotero.File.download(srcUrl, targetPath);
				}
				catch (e) {
					failed = true;
					throw e;
				}
			};

			
			caller.add(() => fetchFile(url, OS.Path.join(Zotero.getTempDirectory().path, 'zotero-1.txt')));
			caller.add(() => fetchFile(url, OS.Path.join(Zotero.getTempDirectory().path, 'zotero-2.txt')));
			caller.add(() => fetchFile(url, OS.Path.join(Zotero.getTempDirectory().path, 'zotero-3.txt')));

			await caller.runAll();

			assert.isFalse(failed);
			for (let i = 1; i < 4; i++) {
				const path = OS.Path.join(Zotero.getTempDirectory().path, `zotero-${i}.txt`);
				const fileSize = (await OS.File.stat(path)).size;
				assert.equal(fileSize, 1024 * 1024 * sizeInMB);
			}
		});

		it("should extract a file from xpi", async function () {
			const url = `jar:file://${getTestDataDirectory().path}/fake.xpi!/test.txt`;
			const path = OS.Path.join(Zotero.getTempDirectory().path, 'xpi-extracted.txt');
			await Zotero.File.download(url, path);
			const contents = await Zotero.File.getContentsAsync(path);
			assert.equal(contents, 'Hello Zotero\n');
		});
	});

	describe("#normalizeToUnix()", function () {
		it("should normalize a Unix-style path", async function () {
			assert.equal(Zotero.File.normalizeToUnix('/path/to/directory/'), '/path/to/directory');
		});

		it("should normalize '.' and '..'", async function () {
			assert.equal(Zotero.File.normalizeToUnix('/path/./to/some/../file'), '/path/to/file');
		});

		it("should replace backslashes with forward slashes and trim trailing", async function () {
			assert.equal(Zotero.File.normalizeToUnix('C:\\Zotero\\Some\\Directory\\'), 'C:/Zotero/Some/Directory');
		});
	});
})
