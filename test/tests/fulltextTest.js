describe("Zotero.Fulltext", function () {
	describe("#downloadPDFTool()", function () {
		var originalBaseURL;
		before(function* () {
			originalBaseURL = Zotero.Fulltext.pdfToolsDownloadBaseURL;
		})
		after(function () {
			Zotero.Fulltext.pdfToolsDownloadBaseURL = originalBaseURL;
		})
		
		it("should install the PDF tools", function* () {
			var version = "3.04";
			var dataDir = Zotero.getZoteroDirectory().path;
			var execFileName = 'pdfinfo-' + Zotero.platform;
			var execContents = new Array(50001).join('a');
			var execPath = OS.Path.join(dataDir, execFileName);
			var versionFileName = execFileName + '.version';
			var versionPath = OS.Path.join(dataDir, versionFileName);
			var scriptExt = Zotero.isWin ? 'vbs' : 'sh';
			var scriptPath = OS.Path.join(dataDir, 'pdfinfo.' + scriptExt);
			var scriptContents = yield Zotero.File.getContentsFromURLAsync(
				'resource://zotero/redirect.' + scriptExt
			);
			
			// Delete existing files
			try {
				yield OS.File.remove(execPath);
			}
			catch (e) {}
			try {
				yield OS.File.remove(versionPath);
			}
			catch (e) {}
			try {
				yield OS.File.remove(scriptPath);
			}
			catch (e) {}
			
			var tmpDir = Zotero.getTempDirectory();
			// Create temp version directory
			var tmpVersionDir = OS.Path.join(tmpDir.path, version);
			yield OS.File.makeDir(tmpVersionDir);
			// Create dummy executable file to download
			var tmpExecPath = OS.Path.join(tmpVersionDir, execFileName);
			yield Zotero.File.putContentsAsync(tmpExecPath, execContents);
			
			// Override the download URL with a file URL for the temp directory
			Zotero.Fulltext.pdfToolsDownloadBaseURL = OS.Path.toFileURI(tmpDir.path) + "/";
			
			yield Zotero.Fulltext.downloadPDFTool('info', version);
			
			assert.ok(Zotero.Fulltext.pdfInfoIsRegistered());
			assert.equal(
				(yield Zotero.File.getContentsAsync(execPath)),
				execContents
			);
			assert.equal((yield OS.File.stat(execPath)).unixMode, 0o755);
			assert.equal(
				(yield Zotero.File.getContentsAsync(versionPath)),
				version
			);
			assert.equal(
				(yield Zotero.File.getContentsAsync(scriptPath)),
				scriptContents
			);
			assert.equal((yield OS.File.stat(scriptPath)).unixMode, 0o755);
			
			yield OS.File.removeDir(tmpVersionDir);
		})
	})
})
