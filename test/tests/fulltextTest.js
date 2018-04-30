describe("Zotero.Fulltext", function () {
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
	
	describe("Indexing", function () {
		beforeEach(function () {
			Zotero.Prefs.clear('fulltext.textMaxLength');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		after(function () {
			Zotero.Prefs.clear('fulltext.textMaxLength');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		
		describe("#indexItems()", function () {
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
		});
		
		describe("#indexPDF()", function () {
			it("should create cache files for linked attachments in storage directory", function* () {
				var filename = 'test.pdf';
				var file = OS.Path.join(getTestDataDirectory().path, filename);
				var tempDir = yield getTempDirectory();
				var linkedFile = OS.Path.join(tempDir, filename);
				yield OS.File.copy(file, linkedFile);
				
				var item = yield Zotero.Attachments.linkFromFile({ file: linkedFile });
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				assert.isTrue(yield OS.File.exists(storageDir));
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, '.zotero-ft-info')));
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, '.zotero-ft-cache')));
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, filename)));
			});
		});
	});
	
	describe("#getUnsyncedContent()", function () {
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
		});
		
		it("should mark PDF attachment content as missing if cache file doesn't exist", function* () {
			var item = yield importFileAttachment('test.pdf');
			item.synced = true;
			yield item.saveTx();
			
			yield Zotero.Fulltext.indexItems([item.id]);
			yield OS.File.remove(Zotero.Fulltext.getItemCacheFile(item).path);
			
			var sql = "SELECT synced FROM fulltextItems WHERE itemID=?";
			var synced = yield Zotero.DB.valueQueryAsync(sql, item.id);
			assert.equal(synced, Zotero.Fulltext.SYNC_STATE_UNSYNCED);
			var indexed = yield Zotero.Fulltext.getIndexedState(item);
			assert.equal(indexed, Zotero.Fulltext.INDEX_STATE_INDEXED);
			
			yield Zotero.Fulltext.getUnsyncedContent(item.libraryID);
			
			synced = yield Zotero.DB.valueQueryAsync(sql, item.id);
			assert.equal(synced, Zotero.Fulltext.SYNC_STATE_MISSING);
			indexed = yield Zotero.Fulltext.getIndexedState(item);
			assert.equal(indexed, Zotero.Fulltext.INDEX_STATE_UNINDEXED);
		});
	})
	
	describe("#setItemContent()", function () {
		before(() => {
			// Disable PDF indexing
			Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
		});
		
		after(() => {
			// Re-enable PDF indexing
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		
		it("should store data in .zotero-ft-unprocessed file", function* () {
			var item = yield importFileAttachment('test.pdf');
			
			var processorCacheFile = Zotero.Fulltext.getItemProcessorCacheFile(item).path;
			var itemCacheFile = Zotero.Fulltext.getItemCacheFile(item).path;
			yield Zotero.File.putContentsAsync(itemCacheFile, "Test");
			
			yield Zotero.Fulltext.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedChars: 4,
					totalChars: 4
				},
				5
			);
			
			assert.equal((yield Zotero.Fulltext.getItemVersion(item.id)), 0);
			assert.equal(
				yield Zotero.DB.	valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				2 // to process
			);
			assert.isTrue(yield OS.File.exists(processorCacheFile));
		});
		
		
		it("should update the version if the local version is 0 but the text matches", function* () {
			var item = yield importFileAttachment('test.pdf');
			
			yield Zotero.DB.queryAsync(
				"REPLACE INTO fulltextItems (itemID, version, synced) VALUES (?, 0, ?)",
				[item.id, 0] // to process
			);
			
			var processorCacheFile = Zotero.Fulltext.getItemProcessorCacheFile(item).path;
			var itemCacheFile = Zotero.Fulltext.getItemCacheFile(item).path;
			yield Zotero.File.putContentsAsync(itemCacheFile, "Test");
			
			yield Zotero.Fulltext.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedChars: 4,
					totalChars: 4
				},
				5
			);
			
			assert.equal((yield Zotero.Fulltext.getItemVersion(item.id)), 5);
			assert.equal(
				yield Zotero.DB.	valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				1 // in sync
			);
			assert.isFalse(yield OS.File.exists(processorCacheFile));
		});
	});
})
