describe("Zotero.Fulltext", function () {
	var win, pdfToolsVersion;
	
	before(function* () {
		// Hidden browser, which requires a browser window, needed for charset detection
		// (until we figure out a better way)
		win = yield loadBrowserWindow();
		
		pdfToolsVersion = Zotero.isWin ? '3.02a' : '3.04';
	});
	after(function () {
		if (win) {
			win.close();
		}
	});
	
	describe("#indexItems()", function () {
		before(function* () {
			yield Zotero.Fulltext.downloadPDFTool('info', pdfToolsVersion);
			yield Zotero.Fulltext.downloadPDFTool('converter', pdfToolsVersion);
		});
		
		beforeEach(function () {
			Zotero.Prefs.clear('fulltext.textMaxLength');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		after(function () {
			Zotero.Prefs.clear('fulltext.textMaxLength');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		
		it("should index a text file by default", function* () {
			var item = yield importFileAttachment('test.txt');
			assert.equal(
				(yield Zotero.Fulltext.getIndexedState(item)),
				Zotero.Fulltext.INDEX_STATE_INDEXED
			);
		})
		
		it("should skip indexing of a text file if fulltext.textMaxLength is 0", function* () {
			Zotero.Prefs.set('fulltext.textMaxLength', 0);
			var item = yield importFileAttachment('test.txt');
			assert.equal(
				(yield Zotero.Fulltext.getIndexedState(item)),
				Zotero.Fulltext.INDEX_STATE_UNINDEXED
			);
		})
		
		it("should index a PDF by default", function* () {
			var item = yield importFileAttachment('test.pdf');
			assert.equal(
				(yield Zotero.Fulltext.getIndexedState(item)),
				Zotero.Fulltext.INDEX_STATE_INDEXED
			);
		})
		
		it("should skip indexing of a PDF if fulltext.textMaxLength is 0", function* () {
			Zotero.Prefs.set('fulltext.textMaxLength', 0);
			var item = yield importFileAttachment('test.pdf');
			assert.equal(
				(yield Zotero.Fulltext.getIndexedState(item)),
				Zotero.Fulltext.INDEX_STATE_UNINDEXED
			);
		})
		
		it("should skip indexing of a PDF if fulltext.pdfMaxPages is 0", function* () {
			Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
			var item = yield importFileAttachment('test.pdf');
			assert.equal(
				(yield Zotero.Fulltext.getIndexedState(item)),
				Zotero.Fulltext.INDEX_STATE_UNINDEXED
			);
		})
	})
	
	describe("#downloadPDFTool()", function () {
		it("should install the PDF tools", function* () {
			yield Zotero.Fulltext.uninstallPDFTools();
			assert.isFalse(Zotero.Fulltext.pdfInfoIsRegistered());
			
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
				getTestDataDirectory().path, "pdf", pdfToolsVersion, execFileName
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
			
			yield Zotero.Fulltext.downloadPDFTool('info', pdfToolsVersion);
			
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
				pdfToolsVersion
			);
			
			//Temp: disabled on Windows
			if (!Zotero.isWin) {
				assert.equal(
					(yield Zotero.File.getContentsAsync(scriptPath)),
					scriptContents
				);
				assert.equal((yield OS.File.stat(scriptPath)).unixMode, 0o755);
			}
			
			yield uninstallPDFTools();
			assert.isFalse(Zotero.Fulltext.pdfInfoIsRegistered());
		})
	})
	
	
	describe("#getUnsyncedContent()", function () {
		before(function* () {
			yield installPDFTools();
		})
		
		after(function* () {
			yield uninstallPDFTools();
		})
		
		it("should get content that hasn't been uploaded", function* () {
			var toSync = [];
			var group = yield getGroup();
			
			var add = Zotero.Promise.coroutine(function* (options = {}) {
				let item = yield createDataObject('item', { libraryID: options.libraryID });
				let attachment = new Zotero.Item('attachment');
				if (options.libraryID) {
					attachment.libraryID = options.libraryID;
				}
				attachment.parentItemID = item.id;
				attachment.attachmentLinkMode = 'imported_file';
				attachment.attachmentContentType = 'text/plain';
				attachment.attachmentCharset = 'utf-8';
				attachment.attachmentFilename = 'test.txt';
				if (options.synced) {
					attachment.synced = true;
				}
				yield attachment.saveTx();
				yield Zotero.Attachments.createDirectoryForItem(attachment);
				
				let path = attachment.getFilePath();
				let content = new Array(10).fill("").map(x => Zotero.Utilities.randomString()).join(" ");
				yield Zotero.File.putContentsAsync(path, content);
				
				if (!options.skip) {
					toSync.push({
						item: attachment,
						content,
						indexedChars: content.length,
						indexedPages: 0
					});
				}
			});
			yield add({ synced: true });
			yield add({ synced: true });
			// Unsynced attachment shouldn't uploaded
			yield add({ skip: true });
			// Attachment in another library shouldn't be uploaded
			yield add({ libraryID: group.libraryID, synced: true, skip: true });
			// PDF attachment
			var pdfAttachment = yield importFileAttachment('test.pdf');
			pdfAttachment.synced = true;
			yield pdfAttachment.saveTx();
			toSync.push({
				item: pdfAttachment,
				content: "Zotero [zoh-TAIR-oh] is a free, easy-to-use tool to help you collect, "
					+ "organize, cite, and share your research sources.\n\n",
				indexedChars: 0,
				indexedPages: 1
			});
			
			yield Zotero.Fulltext.indexItems(toSync.map(x => x.item.id));
			
			var data = yield Zotero.FullText.getUnsyncedContent(Zotero.Libraries.userLibraryID);
			assert.lengthOf(data, 3);
			let contents = toSync.map(x => x.content);
			for (let d of data) {
				let pos = contents.indexOf(d.content);
				assert.isAbove(pos, -1);
				assert.equal(d.indexedChars, toSync[pos].indexedChars);
				assert.equal(d.indexedPages, toSync[pos].indexedPages);
			}
		})
	})
})
