describe("Zotero.FullText", function () {
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

			it("should skip indexing of an EPUB if fulltext.textMaxLength is 0", function* () {
				Zotero.Prefs.set('fulltext.textMaxLength', 0);
				var item = yield importFileAttachment('recognizeEPUB_test_content.epub');
				assert.equal(
					(yield Zotero.Fulltext.getIndexedState(item)),
					Zotero.Fulltext.INDEX_STATE_UNINDEXED
				);
			});

			describe("Indexing with HiddenBrowser", () => {
				it("should index attachment as its attachmentContentType when supported", async function () {
					// Firefox would normally load this as text/x-shellscript, but we detect text/plain
					let item = await importFileAttachment('test.sh');
					assert.equal(item.attachmentContentType, 'text/plain');
					assert.equal(await Zotero.Fulltext.getIndexedState(item), Zotero.Fulltext.INDEX_STATE_INDEXED);
				});

				it("should index attachment as text/plain when its text/* attachmentContentType is unsupported", async function () {
					// Now we force text/x-shellscript, which the HiddenBrowser would normally refuse to load
					// It should still load, because we fall back to text/plain from an unsupported text/* content type
					let item = await importFileAttachment('test.sh', { contentType: 'text/x-shellscript' });
					assert.equal(item.attachmentContentType, 'text/x-shellscript');
					assert.equal(await Zotero.Fulltext.getIndexedState(item), Zotero.Fulltext.INDEX_STATE_INDEXED);
				});

				it("should not index attachment with non-text attachmentContentType", async function () {
					let item = await importFileAttachment('test.txt', { contentType: 'image/png' });
					assert.equal(item.attachmentContentType, 'image/png');
					assert.equal(await Zotero.Fulltext.getIndexedState(item), Zotero.Fulltext.INDEX_STATE_UNINDEXED);
				});
			});
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
					+ "organize, cite, and share your research sources.",
				indexedChars: 0,
				indexedPages: 1
			});
			
			yield Zotero.Fulltext.indexItems(toSync.map(x => x.item.id));
			
			var data = yield Zotero.FullText.getUnsyncedContent(Zotero.Libraries.userLibraryID);
			assert.lengthOf(data, 3);
			let contents = toSync.map(x => x.content);
			
			for (let d of data) {
				assert.include(contents, d.content);
				let pos = contents.indexOf(d.content);
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
		
		it("should store data in .zotero-ft-unprocessed file", async function () {
			var item = await importFileAttachment('test.pdf');
			
			var processorCacheFile = Zotero.Fulltext.getItemProcessorCacheFile(item).path;
			
			var version = 5;
			await Zotero.Fulltext.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedPages: 4,
					totalPages: 4
				},
				version
			);
			
			assert.equal(await Zotero.Fulltext.getItemVersion(item.id), 0);
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				Zotero.FullText.SYNC_STATE_TO_PROCESS
			);
			assert.isTrue(await OS.File.exists(processorCacheFile));
		});
		
		
		it("should update the version if the local version is 0 but the text matches", async function () {
			var item = await importFileAttachment('test.pdf');
			
			await Zotero.DB.queryAsync(
				"REPLACE INTO fulltextItems (itemID, version, indexedPages, totalPages, synced) "
					+ "VALUES (?, 0, 4, 4, ?)",
				[item.id, Zotero.FullText.SYNC_STATE_UNSYNCED]
			);
			
			var processorCacheFile = Zotero.FullText.getItemProcessorCacheFile(item).path;
			var itemCacheFile = Zotero.FullText.getItemCacheFile(item).path;
			await Zotero.File.putContentsAsync(itemCacheFile, "Test");
			
			var version = 5;
			await Zotero.FullText.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedPages: 4,
					totalPages: 4
				},
				version
			);
			
			assert.equal(await Zotero.FullText.getItemVersion(item.id), version);
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				Zotero.FullText.SYNC_STATE_IN_SYNC
			);
			var { indexedPages, total } = await Zotero.FullText.getPages(item.id);
			assert.equal(indexedPages, 4);
			assert.equal(total, 4);
			assert.isFalse(await OS.File.exists(processorCacheFile));
		});
	});
	
	describe("#rebuildIndex()", function () {
		afterEach(() => {
			// Re-enable PDF indexing
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});
		
		it("should process queued full-text content in indexedOnly mode", async function () {
			Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
			var item = await importFileAttachment('test.pdf');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
			
			var version = 5;
			await Zotero.FullText.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedPages: 4,
					totalPages: 4
				},
				version
			);
			
			var processorCacheFile = Zotero.FullText.getItemProcessorCacheFile(item).path;
			var itemCacheFile = Zotero.FullText.getItemCacheFile(item).path;
			
			assert.isTrue(await OS.File.exists(processorCacheFile));
			
			await Zotero.FullText.rebuildIndex(true);
			
			// .zotero-ft-unprocessed should have been deleted
			assert.isFalse(await OS.File.exists(processorCacheFile));
			// .zotero-ft-cache should now exist
			assert.isTrue(await OS.File.exists(itemCacheFile));
			
			assert.equal(await Zotero.FullText.getItemVersion(item.id), version);
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				Zotero.FullText.SYNC_STATE_IN_SYNC
			);
			var { indexedPages, total } = await Zotero.FullText.getPages(item.id);
			assert.equal(indexedPages, 4);
			assert.equal(total, 4);
		});
		
		it("should ignore queued full-text content in non-indexedOnly mode", async function () {
			Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
			var item = await importFileAttachment('test.pdf');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
			
			var version = 5;
			await Zotero.FullText.setItemContent(
				item.libraryID,
				item.key,
				{
					content: "Test",
					indexedPages: 4,
					totalPages: 4
				},
				version
			);
			
			var processorCacheFile = Zotero.FullText.getItemProcessorCacheFile(item).path;
			var itemCacheFile = Zotero.FullText.getItemCacheFile(item).path;
			
			assert.isTrue(await OS.File.exists(processorCacheFile));
			
			await Zotero.FullText.rebuildIndex();
			
			// .zotero-ft-unprocessed should have been deleted
			assert.isFalse(await OS.File.exists(processorCacheFile));
			// .zotero-ft-cache should now exist
			assert.isTrue(await OS.File.exists(itemCacheFile));
			
			// Processor cache file shouldn't have been used, and full text should be marked for
			// syncing
			assert.equal(await Zotero.FullText.getItemVersion(item.id), 0);
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT synced FROM fulltextItems WHERE itemID=?",
					item.id
				),
				Zotero.FullText.SYNC_STATE_UNSYNCED
			);
			var { indexedPages, total } = await Zotero.FullText.getPages(item.id);
			assert.equal(indexedPages, 1);
			assert.equal(total, 1);
		});
		
		// This shouldn't happen, but before 5.0.85 items reindexed elsewhere could clear local stats
		it("shouldn't clear indexed items with missing file and no stats", async function () {
			Zotero.Prefs.set('fulltext.pdfMaxPages', 1);
			var item = await importFileAttachment('test.pdf');
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
			
			var itemCacheFile = Zotero.FullText.getItemCacheFile(item).path;
			assert.isTrue(await OS.File.exists(itemCacheFile));
			
			var { indexedPages, total } = await Zotero.FullText.getPages(item.id);
			assert.equal(indexedPages, 1);
			assert.equal(total, 1);
			await Zotero.DB.queryAsync(
				"UPDATE fulltextItems SET indexedPages=NULL, totalPages=NULL WHERE itemID=?",
				item.id
			);
			
			await Zotero.FullText.rebuildIndex();
			
			// .zotero-ft-cache should still exist
			assert.isTrue(await OS.File.exists(itemCacheFile));
			
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM fulltextItems WHERE itemID=?",
					item.id
				),
				1
			);
		});
	});
})
