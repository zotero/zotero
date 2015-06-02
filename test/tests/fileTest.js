describe("Zotero.File", function () {
	describe("#getContentsAsync()", function () {
		it("should handle an empty file", function* () {
			var path = OS.Path.join(getTestDataDirectory().path, "empty");
			assert.equal((yield Zotero.File.getContentsAsync(path)), "");
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
})
