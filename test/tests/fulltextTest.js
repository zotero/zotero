describe("Zotero.Fulltext", function () {
	describe("#downloadPDFTool()", function () {
		it("should install the PDF tools", function* () {
			var version = Zotero.isWin ? '3.02a' : '3.04';
			var dataDir = Zotero.getZoteroDirectory().path;
			var execFileName = Zotero.Fulltext.pdfInfoFileName;
			var execPath = OS.Path.join(dataDir, execFileName);
			var versionFileName = execFileName + '.version';
			var versionPath = OS.Path.join(dataDir, versionFileName);
			var scriptExt = Zotero.isWin ? 'vbs' : 'sh';
			var scriptPath = OS.Path.join(dataDir, 'pdfinfo.' + scriptExt);
			var scriptContents = yield Zotero.File.getContentsFromURLAsync(
				'resource://zotero/redirect.' + scriptExt
			);
			var cacheExecPath = OS.Path.join(
				getTestDataDirectory().path, "pdf", version, execFileName
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
			
			yield Zotero.Fulltext.downloadPDFTool('info', version);
			
			assert.ok(Zotero.Fulltext.pdfInfoIsRegistered());
			assert.equal(
				(yield Zotero.File.getBinaryContentsAsync(cacheExecPath)),
				(yield Zotero.File.getBinaryContentsAsync(execPath))
			);
			if (!Zotero.isWin) {
				assert.equal((yield OS.File.stat(execPath)).unixMode, 0o755);
			}
			assert.equal(
				(yield Zotero.File.getContentsAsync(versionPath)),
				version
			);
			
			//Temp: disabled on Windows
			if (!Zotero.isWin) {
				assert.equal(
					(yield Zotero.File.getContentsAsync(scriptPath)),
					scriptContents
				);
				assert.equal((yield OS.File.stat(scriptPath)).unixMode, 0o755);
			}
			
			yield Zotero.Fulltext.uninstallPDFTools();
			assert.isFalse(Zotero.Fulltext.pdfInfoIsRegistered());
		})
	})
})
