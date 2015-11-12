describe("Zotero.Fulltext", function () {
	describe("#downloadPDFTool()", function () {
		it("should install the PDF tools", function* () {
			yield Zotero.Fulltext.uninstallPDFTools();
			assert.isFalse(Zotero.Fulltext.pdfInfoIsRegistered());
			
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
				let content = [Zotero.Utilities.randomString() for (x of new Array(10))].join(" ");
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
			for (let i = toSync.length - 1; i >= 0 ; i--) {
				assert.equal(data[i].content, toSync[i].content);
				assert.equal(data[i].indexedChars, toSync[i].indexedChars);
				assert.equal(data[i].indexedPages, toSync[i].indexedPages);
			}
		})
	})
})
