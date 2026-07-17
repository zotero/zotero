describe("Zotero.FullText", function () {
	describe("Content database", function () {
		async function createTextAttachment(content) {
			let tmpDir = await getTempDirectory();
			let path = OS.Path.join(tmpDir, Zotero.Utilities.randomString() + ".txt");
			await Zotero.File.putContentsAsync(path, content);
			return Zotero.Attachments.importFromFile({
				file: path,
				contentType: 'text/plain',
				charset: 'utf-8'
			});
		}

		function contentSearch(item, value) {
			let s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.addCondition('fulltextContent', 'contains', value);
			return s.search();
		}

		it("should match content case- and diacritic-insensitively", async function () {
			let item = await createTextAttachment("The Séance was held at dawn");
			assert.include(await contentSearch(item, 'seance'), item.id);
			assert.include(await contentSearch(item, 'SÉANCE'), item.id);
		});

		it("should match other forms of a word by prefix", async function () {
			let item = await createTextAttachment("old archives were archived");
			assert.include(await contentSearch(item, 'archive'), item.id);
		});

		it("should not match the middle or end of a word", async function () {
			let suffix = await createTextAttachment("the condition holds");
			assert.notInclude(await contentSearch(suffix, 'ion'), suffix.id);
			let prefixed = await createTextAttachment("postcolonialism studies");
			assert.notInclude(await contentSearch(prefixed, 'colonialism'), prefixed.id);
		});

		it("should prefix-match a short term used as an explicit condition", async function () {
			let item = await createTextAttachment("the quick brown fox");
			// Short terms are only skipped by unquoted quick search (canSearchContent), so "fo"
			// matches "fox" as a word prefix here
			assert.include(await contentSearch(item, 'fo'), item.id);
		});

		it("should prefix-match accent-insensitively", async function () {
			let item = await createTextAttachment("zzcafés in paris");
			assert.include(await contentSearch(item, 'zzcafé'), item.id);
		});

		it("should match a phrase with the final word as a prefix", async function () {
			let item = await createTextAttachment("global climate changes are accelerating");
			assert.include(await contentSearch(item, 'climate chang'), item.id);
		});

		it("should match a phrase across whitespace and hyphens", async function () {
			// Word separators vary with extraction layout and compound styling, so whitespace
			// and hyphen runs in the phrase and the content match each other
			let newline = await createTextAttachment("the climate\nchange debate");
			assert.include(await contentSearch(newline, 'climate change'), newline.id);
			let hyphen = await createTextAttachment("climate-change research");
			assert.include(await contentSearch(hyphen, 'climate change'), hyphen.id);
			let spaced = await createTextAttachment("zzdecision making processes");
			assert.include(await contentSearch(spaced, 'zzdecision-making'), spaced.id);
		});

		it("should not match a phrase across punctuation", async function () {
			// These are index candidates -- FTS5 ignores what separates adjacent tokens -- so
			// they exercise the verification scan of the cached text
			let punct = await createTextAttachment("the climate. Change is coming");
			assert.notInclude(await contentSearch(punct, 'climate change'), punct.id);
			let slash = await createTextAttachment("climate/change models");
			assert.notInclude(await contentSearch(slash, 'climate change'), slash.id);
		});

		it("should require punctuation in a single-word term to match literally", async function () {
			let cpp = await createTextAttachment("the c++ standard library");
			assert.include(await contentSearch(cpp, 'c++'), cpp.id);
			// "code" is a candidate for the "c" token prefix, but "c++" doesn't appear
			let plain = await createTextAttachment("zzcat code samples");
			assert.notInclude(await contentSearch(plain, 'c++'), plain.id);
		});

		it("should not match anything for a separator-only term", async function () {
			let item = await createTextAttachment("plain text with spaces");
			assert.notInclude(await contentSearch(item, '--'), item.id);
		});

		it("should match a 2-character CJK query", async function () {
			let item = await createTextAttachment("中文搜索系统设计");
			assert.include(await contentSearch(item, '搜索'), item.id);
		});

		it("should match a longer CJK substring within a run", async function () {
			let item = await createTextAttachment("中文搜索系统设计");
			assert.include(await contentSearch(item, '搜索系统'), item.id);
		});

		it("should distinguish voiced and unvoiced kana in CJK content", async function () {
			let item = await createTextAttachment("研究がん");
			assert.include(await contentSearch(item, 'がん'), item.id);
			assert.notInclude(await contentSearch(item, 'かん'), item.id);
		});

		it("should not match an unrelated CJK document", async function () {
			let item = await createTextAttachment("天气预报很准确");
			let other = await createTextAttachment("中文搜索系统设计");
			let results = await contentSearch(item, '搜索');
			assert.notInclude(results, item.id);
			assert.include(results, other.id);
		});

		it("should record an index-state row when indexing", async function () {
			let item = await createTextAttachment("index state recorded here");
			let version = await Zotero.DB.valueQueryAsync(
				"SELECT version FROM ftindex.fulltextIndexState WHERE itemID=?", item.id
			);
			assert.equal(version, 1);
		});

		it("should index queued items missing from the content index", async function () {
			let item = await createTextAttachment("queued jabberwocky content");
			// Simulate an item full-text indexed before the content index existed: drop its entries
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", item.id);

			// It's now in the queue and not findable by content
			assert.isAbove(await Zotero.FullText.getAttachmentIndexQueueCount(), 0);
			assert.notInclude(await contentSearch(item, 'jabberwocky'), item.id);

			// Draining the queue re-indexes it from the cached text
			await Zotero.FullText.processAttachmentIndexQueue();

			assert.include(await contentSearch(item, 'jabberwocky'), item.id);
			let version = await Zotero.DB.valueQueryAsync(
				"SELECT version FROM ftindex.fulltextIndexState WHERE itemID=?", item.id
			);
			assert.equal(version, 1);
		});

		it("should re-extract a queued item whose cache file is missing", async function () {
			let item = await importFileAttachment('test.pdf');
			let cacheFile = Zotero.FullText.getItemCacheFile(item).path;
			// Grab a real word from the extracted text to search for after re-extraction
			let word = (await Zotero.File.getContentsAsync(cacheFile)).match(/[a-z]{5,}/i)[0];
			// Simulate the storage folder being cleared after indexing (cache gone, file present),
			// then re-queue the item
			await OS.File.remove(cacheFile);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", item.id);

			// Draining the queue should re-extract from the file (not index empty)
			await Zotero.FullText.processAttachmentIndexQueue();

			assert.isTrue(await OS.File.exists(cacheFile));
			assert.include(await contentSearch(item, word), item.id);
		});

		it("should not count unindexable attachments as not indexed", async function () {
			let before = (await Zotero.FullText.getIndexStats()).unindexedQueue;
			// A Word document can't be full-text indexed, so it shouldn't inflate "not indexed"
			let path = OS.Path.join(await getTempDirectory(), Zotero.Utilities.randomString() + ".doc");
			await Zotero.File.putContentsAsync(path, "not really a word doc");
			await Zotero.Attachments.importFromFile({
				file: path, contentType: 'application/msword'
			});
			let after = (await Zotero.FullText.getIndexStats()).unindexedQueue;
			assert.equal(after, before);
		});

		it("should index an unindexed attachment that has a local file", async function () {
			let item = await createTextAttachment("filepresentunindexed content");
			// Simulate a never-indexed attachment: no fulltextItems row, not in the index
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", item.id);
			assert.notInclude(await contentSearch(item, 'filepresentunindexed'), item.id);
			await Zotero.FullText.processAttachmentExtractionQueue();
			assert.include(await contentSearch(item, 'filepresentunindexed'), item.id);
		});

		it("should record an unindexed attachment with no local file as missing", async function () {
			let item = await createTextAttachment("nolocalfile content");
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", item.id);
			// Remove the file so there's no local content to index
			await OS.File.remove(await item.getFilePathAsync());
			await Zotero.FullText.processAttachmentExtractionQueue();
			let synced = await Zotero.DB.valueQueryAsync(
				"SELECT synced FROM fulltextItems WHERE itemID=?", item.id
			);
			assert.equal(synced, Zotero.FullText.SYNC_STATE_MISSING);
		});

		it("should record an attachment as missing when its content can't be extracted", async function () {
			// A file that isn't a valid EPUB: extraction fails, so the import leaves no fulltextItems
			// row. The item must still leave the queue (recorded missing) rather than being retried
			// endlessly.
			let tmpDir = await getTempDirectory();
			let path = OS.Path.join(tmpDir, Zotero.Utilities.randomString() + ".epub");
			await Zotero.File.putContentsAsync(path, "not really an EPUB");
			let item = await Zotero.Attachments.importFromFile({
				file: path, contentType: 'application/epub+zip'
			});
			assert.isNotOk(await Zotero.DB.valueQueryAsync(
				"SELECT 1 FROM fulltextItems WHERE itemID=?", item.id
			));
			await Zotero.FullText.processAttachmentExtractionQueue();
			let synced = await Zotero.DB.valueQueryAsync(
				"SELECT synced FROM fulltextItems WHERE itemID=?", item.id
			);
			assert.equal(synced, Zotero.FullText.SYNC_STATE_MISSING);
			// No longer pending, so the drain won't keep retrying it
			assert.equal(await Zotero.FullText.getAttachmentExtractionQueueCount(), 0);
		});

		it("should skip unindexed attachments while indexing is disabled and index them when re-enabled", async function () {
			let item = await createTextAttachment("disabledpref content");
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", item.id);
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", item.id);
			Zotero.Prefs.set('fulltext.textMaxLength', 0);
			try {
				// Disabled: not counted as pending, and a pass records nothing (so it can't loop)
				assert.equal(await Zotero.FullText.getAttachmentExtractionQueueCount(), 0);
				await Zotero.FullText.processAttachmentExtractionQueue();
				assert.isNotOk(await Zotero.DB.valueQueryAsync(
					"SELECT 1 FROM fulltextItems WHERE itemID=?", item.id
				));
			}
			finally {
				Zotero.Prefs.clear('fulltext.textMaxLength');
			}
			// Re-enabled: eligible again and indexed
			await Zotero.FullText.processAttachmentExtractionQueue();
			assert.include(await contentSearch(item, 'disabledpref'), item.id);
		});

		it("should purge content index entries orphaned by item deletion", async function () {
			let item = await createTextAttachment("orphanpurge content");
			assert.include(await contentSearch(item, 'orphanpurge'), item.id);
			// Simulate the FK cascade from a delete that bypassed Item.erase(): drop the
			// fulltextItems row, leaving the content index entries orphaned
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", item.id);
			await Zotero.FullText.purgeOrphanedContent();
			assert.notInclude(await contentSearch(item, 'orphanpurge'), item.id);
		});

		it("should remove content from the index when cleared", async function () {
			let item = await createTextAttachment("disposable singular content");
			assert.include(await contentSearch(item, 'disposable'), item.id);
			await Zotero.DB.executeTransaction(async function () {
				await Zotero.FullText.clearItemWords(item.id);
			});
			assert.notInclude(await contentSearch(item, 'disposable'), item.id);
		});

		it("should keep content searchable after optimizing the index", async function () {
			let item = await createTextAttachment("optimizable content");
			await Zotero.FullText.optimizeContentIndex();
			assert.include(await contentSearch(item, 'optimizable'), item.id);
		});

		it("should keep content searchable after vacuuming the index", async function () {
			let item = await createTextAttachment("vacuumable content");
			await Zotero.FullText.vacuumContentIndex({ force: true });
			assert.include(await contentSearch(item, 'vacuumable'), item.id);
		});

		it("should discard the index when it belongs to a different database instance", async function () {
			let item = await createTextAttachment("instancemismatch content");
			assert.include(await contentSearch(item, 'instancemismatch'), item.id);
			// Simulate an index built against a different zotero.sqlite (e.g., the database was
			// deleted and re-synced, reassigning local itemIDs) by changing the stored localUserKey
			await Zotero.DB.queryAsync(
				"UPDATE ftindex.fulltextIndexMeta SET value='xxxxxxxx' WHERE key='localUserKey'"
			);
			// Force a reconnect, which re-runs the content DB setup and detects the mismatch
			await Zotero.DB.vacuum({ force: true });
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM ftindex.fulltextIndexState"), 0
			);
			assert.notInclude(await contentSearch(item, 'instancemismatch'), item.id);
		});

		describe("Note indexing", function () {
			async function createNote(noteText) {
				let item = new Zotero.Item('note');
				item.setNote(noteText);
				await item.saveTx();
				return item;
			}

			function noteSearch(item, value) {
				let s = new Zotero.Search();
				s.libraryID = item.libraryID;
				s.addCondition('note', 'contains', value);
				return s.search();
			}

			it("should match note content case- and diacritic-insensitively via the index", async function () {
				let item = await createNote("<p>zqnnThe Séance was held at dawn</p>");
				await Zotero.FullText.processNoteIndexQueue();
				assert.include(await noteSearch(item, 'zqnnthe seance'), item.id);
			});

			it("should match a just-edited note before it's re-indexed", async function () {
				let item = await createNote("<p>zqnnoriginal content</p>");
				await Zotero.FullText.processNoteIndexQueue();
				item.setNote('<p style="color: red">zqnnréplacement content</p>');
				await item.saveTx();
				// The edit is matched right away, without waiting for background re-indexing, with
				// the same accent-insensitive matching as the index (é folded)...
				assert.include(await noteSearch(item, 'zqnnreplacement'), item.id);
				// ...the old content no longer matches...
				assert.notInclude(await noteSearch(item, 'zqnnoriginal'), item.id);
				// ...and markup isn't matched
				assert.notInclude(await noteSearch(item, 'color: red'), item.id);
			});

			it("should not match note markup", async function () {
				let item = await createNote('<p style="color: red">zqnnstyled text</p>');
				await Zotero.FullText.processNoteIndexQueue();
				assert.include(await noteSearch(item, 'zqnnstyled'), item.id);
				assert.notInclude(await noteSearch(item, 'color: red'), item.id);
			});

			it("should scan plain text but not markup for a term too short for the index", async function () {
				// "ai" and "re" are too short to index, so they fall back to scanning the note's
				// normalized plain text. "ai" is in the text and matches; "re" appears only in "red"
				// in the style attribute, so scanning plain text (not raw HTML) doesn't match it.
				let item = await createNote('<p style="color: red">zqnn ai content</p>');
				await Zotero.FullText.processNoteIndexQueue();
				assert.include(await noteSearch(item, 'ai'), item.id);
				assert.notInclude(await noteSearch(item, 're'), item.id);
			});

			it("should match a mixed-script note term via the plain-text fallback", async function () {
				// A mixed CJK/non-CJK term suits neither index, so it falls back to the plain-text scan
				let item = await createNote("<p>zqnn研究ai</p>");
				await Zotero.FullText.processNoteIndexQueue();
				assert.include(await noteSearch(item, '究ai'), item.id);
			});

			it("should exclude a matching note with doesNotContain", async function () {
				let item = await createNote("<p>zqnnexcludable content</p>");
				await Zotero.FullText.processNoteIndexQueue();
				let s = new Zotero.Search();
				s.libraryID = item.libraryID;
				s.addCondition('note', 'doesNotContain', 'zqnnexcludable');
				assert.notInclude(await s.search(), item.id);
			});

			it("should fall back to scanning the HTML until the note backfill finishes", async function () {
				let item = await createNote("<p>zqnnbackfill séance</p>");
				// Rebuild the index (as after a delete-and-resync), leaving every note pending
				// backfill
				await Zotero.DB.queryAsync(
					"UPDATE ftindex.fulltextIndexMeta SET value='xxxxxxxx' WHERE key='localUserKey'"
				);
				await Zotero.DB.vacuum({ force: true });
				// The reconnect's index setup (which drops the mismatched tables) runs on the next
				// query, as at startup before searches resume
				await Zotero.DB.queryAsync("SELECT 1");
				// The note isn't in the index yet, but an exact term still matches via the scan
				assert.include(await noteSearch(item, 'zqnnbackfill'), item.id);
				// Draining the queue enables diacritic-insensitive index matching
				await Zotero.FullText.processNoteIndexQueue();
				assert.include(await noteSearch(item, 'zqnnbackfill seance'), item.id);
			});
		});
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
			it("should index a text file by default", async function () {
				var item = await importFileAttachment('test.txt');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_INDEXED
				);
			})
			
			it("should skip indexing of a text file if fulltext.textMaxLength is 0", async function () {
				Zotero.Prefs.set('fulltext.textMaxLength', 0);
				var item = await importFileAttachment('test.txt');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_UNINDEXED
				);
			})
			
			it("should index a PDF by default", async function () {
				var item = await importFileAttachment('test.pdf');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_INDEXED
				);
			})
			
			it("should skip indexing of a PDF if fulltext.textMaxLength is 0", async function () {
				Zotero.Prefs.set('fulltext.textMaxLength', 0);
				var item = await importFileAttachment('test.pdf');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_UNINDEXED
				);
			})
			
			it("should skip indexing of a PDF if fulltext.pdfMaxPages is 0", async function () {
				Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
				var item = await importFileAttachment('test.pdf');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_UNINDEXED
				);
			})

			it("should skip indexing of an EPUB if fulltext.textMaxLength is 0", async function () {
				Zotero.Prefs.set('fulltext.textMaxLength', 0);
				var item = await importFileAttachment('recognizeEPUB_test_content.epub');
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_UNINDEXED
				);
			});

			it("should still work after the DB connection is reopened", async function () {
				var item = await importFileAttachment('test.txt');
				await Zotero.DB.vacuum({ force: true });
				await Zotero.Fulltext.indexItems([item.id]);
				assert.equal(
					((await Zotero.Fulltext.getIndexedState(item))),
					Zotero.Fulltext.INDEX_STATE_INDEXED
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
			it("should create cache files for linked attachments in storage directory", async function () {
				var filename = 'test.pdf';
				var file = OS.Path.join(getTestDataDirectory().path, filename);
				var tempDir = await getTempDirectory();
				var linkedFile = OS.Path.join(tempDir, filename);
				await OS.File.copy(file, linkedFile);
				
				var item = await Zotero.Attachments.linkFromFile({ file: linkedFile });
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				assert.isTrue(await OS.File.exists(storageDir));
				assert.isTrue(await OS.File.exists(OS.Path.join(storageDir, '.zotero-ft-cache')));
				assert.isFalse(await OS.File.exists(OS.Path.join(storageDir, filename)));
			});

			it("should preserve the SDT cache when reindexing a linked attachment", async function () {
				var file = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
				var linkedFile = OS.Path.join(await getTempDirectory(), 'test.pdf');
				await OS.File.copy(file, linkedFile);
				var item = await Zotero.Attachments.linkFromFile({ file: linkedFile });

				// The full-text cache of a linked file shares the item's
				// storage directory with the SDT cache, so reindexing must
				// not recreate the directory and destroy it
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				var sdtCacheFile = OS.Path.join(storageDir, '.zotero-sdt-cache');
				await Zotero.File.putContentsAsync(sdtCacheFile, 'test');

				assert.isTrue(await Zotero.Fulltext.indexPDF(linkedFile, item.id));
				assert.isTrue(await OS.File.exists(sdtCacheFile));
			});
		});
	});
	
	describe("#getUnsyncedContent()", function () {
		it("should get content that hasn't been uploaded", async function () {
			var toSync = [];
			var group = await getGroup();
			
			var add = async function (options = {}) {
				let item = await createDataObject('item', { libraryID: options.libraryID });
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
				await attachment.saveTx();
				await Zotero.Attachments.createDirectoryForItem(attachment);
				
				let path = attachment.getFilePath();
				let content = new Array(10).fill("").map(x => Zotero.Utilities.randomString()).join(" ");
				await Zotero.File.putContentsAsync(path, content);
				
				if (!options.skip) {
					toSync.push({
						item: attachment,
						content,
						indexedChars: content.length,
						indexedPages: 0
					});
				}
			};
			await add({ synced: true });
			await add({ synced: true });
			// Unsynced attachment shouldn't uploaded
			await add({ skip: true });
			// Attachment in another library shouldn't be uploaded
			await add({ libraryID: group.libraryID, synced: true, skip: true });
			// PDF attachment
			var pdfAttachment = await importFileAttachment('test.pdf');
			pdfAttachment.synced = true;
			await pdfAttachment.saveTx();
			toSync.push({
				item: pdfAttachment,
				content: "Zotero [zoh-TAIR-oh] is a free, easy-to-use tool to help you collect, "
					+ "organize, cite, and share your research sources.",
				indexedChars: 0,
				indexedPages: 1
			});
			
			await Zotero.Fulltext.indexItems(toSync.map(x => x.item.id));
			
			var data = await Zotero.FullText.getUnsyncedContent(Zotero.Libraries.userLibraryID);
			assert.lengthOf(data, 3);
			let contents = toSync.map(x => x.content);
			
			for (let d of data) {
				assert.include(contents, d.content);
				let pos = contents.indexOf(d.content);
				assert.equal(d.indexedChars, toSync[pos].indexedChars);
				assert.equal(d.indexedPages, toSync[pos].indexedPages);
			}
		});
		
		it("should mark PDF attachment content as missing if cache file doesn't exist", async function () {
			var item = await importFileAttachment('test.pdf');
			item.synced = true;
			await item.saveTx();
			
			await Zotero.Fulltext.indexItems([item.id]);
			await OS.File.remove(Zotero.Fulltext.getItemCacheFile(item).path);
			
			var sql = "SELECT synced FROM fulltextItems WHERE itemID=?";
			var synced = await Zotero.DB.valueQueryAsync(sql, item.id);
			assert.equal(synced, Zotero.Fulltext.SYNC_STATE_UNSYNCED);
			var indexed = await Zotero.Fulltext.getIndexedState(item);
			assert.equal(indexed, Zotero.Fulltext.INDEX_STATE_INDEXED);
			
			await Zotero.Fulltext.getUnsyncedContent(item.libraryID);
			
			synced = await Zotero.DB.valueQueryAsync(sql, item.id);
			assert.equal(synced, Zotero.Fulltext.SYNC_STATE_MISSING);
			indexed = await Zotero.Fulltext.getIndexedState(item);
			assert.equal(indexed, Zotero.Fulltext.INDEX_STATE_UNINDEXED);
		});
	})
	
	describe("#processSyncedContentNow()", function () {
		before(() => {
			Zotero.Prefs.set('fulltext.pdfMaxPages', 0);
		});
		after(() => {
			Zotero.Prefs.clear('fulltext.pdfMaxPages');
		});

		it("should index sync-delivered content without waiting for idle", async function () {
			var item = await importFileAttachment('test.pdf');
			// Simulate content delivered by sync: stored as TO_PROCESS with a processor cache file,
			// not yet in the search index (PDF indexing is disabled, so it wasn't indexed locally)
			await Zotero.FullText.setItemContent(
				item.libraryID,
				item.key,
				{ content: "zqpromptsync electrophoresis", indexedChars: 28, totalChars: 28 },
				5
			);
			function search(term) {
				let s = new Zotero.Search();
				s.libraryID = item.libraryID;
				s.addCondition('fulltextContent', 'contains', term);
				return s.search();
			}
			assert.notInclude(await search('zqpromptsync'), item.id);

			// Processing it promptly (as on sync completion) makes it searchable without idle
			await Zotero.FullText.processSyncedContentNow();

			assert.include(await search('zqpromptsync'), item.id);
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT synced FROM fulltextItems WHERE itemID=?", item.id),
				Zotero.FullText.SYNC_STATE_IN_SYNC
			);
		});
	});

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
			
			var processorCacheFile = Zotero.Fulltext.getSyncedContentCacheFile(item).path;
			
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
			
			var processorCacheFile = Zotero.FullText.getSyncedContentCacheFile(item).path;
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
			
			var processorCacheFile = Zotero.FullText.getSyncedContentCacheFile(item).path;
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
			
			var processorCacheFile = Zotero.FullText.getSyncedContentCacheFile(item).path;
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
