describe("Document Recognition", function() {
	var win;
	
	before(function* () {
		this.timeout(60000);
		Zotero.Prefs.set('autoRenameFiles.whenMetadataChanges', false); // Prevent auto-rename triggering during recognition
		// Load Zotero pane and install PDF tools
		yield Zotero.Promise.all([
			loadZoteroPane().then(w => win = w)
		]);
	});
	
	beforeEach(function* () {
		yield selectLibrary(win);
	});
	
	afterEach(async function() {
		for(let win of getWindows("chrome://zotero/content/progressQueueDialog.xhtml")) {
			win.close();
		}
		
		// Wait for all rows to be done processing
		var queue = Zotero.ProgressQueues.get('recognize');
		while (queue.getRows().some(row => row.status == Zotero.ProgressQueue.ROW_PROCESSING)) {
			await Zotero.Promise.delay(50);
		}
		
		queue.cancel();
		Zotero.RecognizeDocument.recognizeStub = null;
		Zotero.Prefs.clear('autoRenameFiles.linked');
	});
	
	after(function() {
		if (win) {
			win.close();
		}
		Zotero.Prefs.clear('autoRenameFiles.whenMetadataChanges');
	});
	
	describe("PDFs", function () {
		it("should recognize a PDF by DOI and rename the file", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			// Import the PDF
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_DOI.pdf");
			var collection = await createDataObject('collection');
			var attachment = await Zotero.Attachments.importFromFile({
				file: testdir,
				collections: [collection.id]
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			assert.lengthOf(addedIDs, 1);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField("title"), "Shaping the Research Agenda");
			assert.equal(item.getField("libraryCatalog"), "DOI.org (Crossref)");
			assert.lengthOf(modifiedIDs, 2);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			// The file should have been renamed
			assert.equal(
				attachment.attachmentFilename,
				Zotero.Attachments.getFileBaseNameFromItem(item) + '.pdf'
			);
		});
		
		it("should recognize a PDF by arXiv ID", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			// Import the PDF
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_arXiv.pdf");
			var attachment = await Zotero.Attachments.importFromFile({
				file: testdir
			});
			
			// Recognize the PDF
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			// Item and note
			assert.lengthOf(addedIDs, 2);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField("title"), "Scaling study of an improved fermion action on quenched lattices");
			assert.lengthOf(modifiedIDs, 1);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
		});
		
		it("should put new item in same collection", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			// Import the PDF
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_arXiv.pdf");
			var collection = await createDataObject('collection');
			var attachment = await Zotero.Attachments.importFromFile({
				file: testdir,
				collections: [collection.id]
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			// Item and note
			assert.lengthOf(addedIDs, 2);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.lengthOf(modifiedIDs, 1);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			assert.isTrue(collection.hasItem(item.id));
		});
		
		it("should recognize PDF by arXiv ID and put new item in same collection in group library", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_arXiv.pdf");
			var group = await getGroup();
			var collection = await createDataObject('collection', { libraryID: group.libraryID });
			var attachment = await Zotero.Attachments.importFromFile({
				libraryID: group.libraryID,
				file: testdir,
				collections: [collection.id],
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			// Item and note
			assert.lengthOf(addedIDs, 2);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.lengthOf(modifiedIDs, 1);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			assert.isTrue(collection.hasItem(item.id));
		});
		
		it.skip("should recognize PDF by ISBN and put new item in same collection in group library", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_ISBN.pdf");
			var group = await getGroup();
			var collection = await createDataObject('collection', { libraryID: group.libraryID });
			var attachment = await Zotero.Attachments.importFromFile({
				libraryID: group.libraryID,
				file: testdir,
				collections: [collection.id],
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			assert.lengthOf(addedIDs, 1);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.lengthOf(modifiedIDs, 2);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			assert.isTrue(collection.hasItem(item.id));
		});
		
		it("should recognize PDF by title and put new item in same collection in group library", async function () {
			if (Zotero.automatedTest) this.skip(); // TODO: Mock services
			this.timeout(30000);
			var testdir = getTestDataDirectory();
			testdir.append("recognizePDF_test_title.pdf");
			var group = await getGroup();
			var collection = await createDataObject('collection', { libraryID: group.libraryID });
			var attachment = await Zotero.Attachments.importFromFile({
				libraryID: group.libraryID,
				file: testdir,
				collections: [collection.id],
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			assert.lengthOf(addedIDs, 1);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.lengthOf(modifiedIDs, 2);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			assert.isTrue(collection.hasItem(item.id));
		});
		
		it("should rename a linked file attachment using parent metadata if no existing file attachments and pref enabled", async function () {
			Zotero.Prefs.set('autoRenameFiles.linked', true);
			var itemTitle = Zotero.Utilities.randomString();
			Zotero.RecognizeDocument.recognizeStub = async function () {
				return createDataObject('item', { title: itemTitle });
			};
			
			// Link to the PDF
			var tempDir = await getTempDirectory();
			var tempFile = OS.Path.join(tempDir, 'test.pdf');
			await OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'test.pdf'), tempFile);
			var attachment = await Zotero.Attachments.linkFromFile({
				file: tempFile
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			assert.lengthOf(addedIDs, 1);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField("title"), itemTitle);
			assert.lengthOf(modifiedIDs, 2);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			// The file should have been renamed
			assert.equal(
				attachment.attachmentFilename,
				Zotero.Attachments.getFileBaseNameFromItem(item) + '.pdf'
			);
		});
		
		it("shouldn't rename a linked file attachment using parent metadata if pref disabled", async function () {
			Zotero.Prefs.set('autoRenameFiles.linked', false);
			var itemTitle = Zotero.Utilities.randomString();;
			Zotero.RecognizeDocument.recognizeStub = async function () {
				return createDataObject('item', { title: itemTitle });
			};
			
			// Link to the PDF
			var tempDir = await getTempDirectory();
			var tempFile = OS.Path.join(tempDir, 'test.pdf');
			await OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'test.pdf'), tempFile);
			var attachment = await Zotero.Attachments.linkFromFile({
				file: tempFile
			});
			
			win.ZoteroPane.recognizeSelected();
			
			var addedIDs = await waitForItemEvent("add");
			var modifiedIDs = await waitForItemEvent("modify");
			assert.lengthOf(addedIDs, 1);
			var item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField("title"), itemTitle);
			assert.lengthOf(modifiedIDs, 2);
			
			// Wait for status to show as complete
			var progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			var completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}
			
			// The file should not have been renamed
			assert.equal(attachment.attachmentFilename, 'test.pdf');
		});
	});

	describe("Ebooks", function () {
		it("should recognize an EPUB by ISBN and rename the file", async function () {
			let isbn = '9780656173822';
			let search;
			let translateStub = sinon.stub(Zotero.Translate.Search.prototype, 'translate')
				.callsFake(async function () {
					search = this.search;
					return [{
						itemType: 'book',
						title: 'The Mania of the Nations on the Planet Mars: ISBN Database Edition',
						ISBN: isbn,
						attachments: [],
						tags: []
					}];
				});

			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_ISBN.epub');
			let collection = await createDataObject('collection');
			let attachment = await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.isTrue(translateStub.calledOnce);
			assert.ok(search);
			assert.equal(search.ISBN, isbn);
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'The Mania of the Nations on the Planet Mars: ISBN Database Edition');
			assert.equal(Zotero.Utilities.cleanISBN(item.getField('ISBN')), isbn);
			assert.lengthOf(modifiedIDs, 2);

			// Wait for status to show as complete
			let progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			let completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}

			// The file should have been renamed
			assert.equal(
				attachment.attachmentFilename,
				Zotero.Attachments.getFileBaseNameFromItem(item) + '.epub'
			);

			translateStub.restore();
		});

		it("should recognize an EPUB without an ISBN and rename the file", async function () {
			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_DC.epub');
			let collection = await createDataObject('collection');
			let attachment = await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'The Mania of the Nations on the Planet Mars and its Terrific Consequences / A Combination of Fun and Wisdom');
			assert.equal(item.getCreators().length, 1);
			assert.equal(item.getField('ISBN'), '');
			assert.lengthOf(modifiedIDs, 2);

			// Wait for status to show as complete
			let progressWindow = getWindows("chrome://zotero/content/progressQueueDialog.xhtml")[0];
			let completeStr = Zotero.getString("general.finished");
			while (progressWindow.document.getElementById("label").value != completeStr) {
				await Zotero.Promise.delay(20);
			}

			// The file should have been renamed
			assert.equal(
				attachment.attachmentFilename,
				Zotero.Attachments.getFileBaseNameFromItem(item) + '.epub'
			);
		});

		it("should use metadata from EPUB when search returns item with different ISBN", async function () {
			let isbn = '9780656173822';
			let isbnWrong = '9780656173823';
			let search;
			let translateStub = sinon.stub(Zotero.Translate.Search.prototype, 'translate')
				.callsFake(async function () {
					search = this.search;
					return [{
						itemType: 'book',
						title: 'The Mania of the Nations on the Planet Mars: Bad Metadata Edition',
						ISBN: isbnWrong, // Wrong ISBN
						attachments: [],
						tags: []
					}];
				});

			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_ISBN.epub');
			let collection = await createDataObject('collection');
			await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.isTrue(translateStub.calledOnce);
			assert.ok(search);
			assert.equal(search.ISBN, isbn);
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'The Mania of the Nations on the Planet Mars and its Terrific Consequences / A Combination of Fun and Wisdom');
			assert.equal(Zotero.Utilities.cleanISBN(item.getField('ISBN')), isbn);
			assert.lengthOf(modifiedIDs, 2);

			translateStub.restore();
		});

		it("should use metadata from EPUB when search fails", async function () {
			let isbn = '9780656173822';
			let search = null;
			let translateStub = sinon.stub(Zotero.Translate.Search.prototype, 'translate')
				.callsFake(async function () {
					search = this.search;
					throw new Error('simulated failure');
				});

			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_ISBN.epub');
			let collection = await createDataObject('collection');
			let attachment = await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.isTrue(translateStub.calledOnce);
			assert.ok(search);
			assert.equal(search.ISBN, isbn);
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'The Mania of the Nations on the Planet Mars and its Terrific Consequences / A Combination of Fun and Wisdom');
			assert.equal(Zotero.Utilities.cleanISBN(item.getField('ISBN')), isbn);
			assert.lengthOf(modifiedIDs, 2);

			translateStub.restore();
		});

		it("should find and search by ISBN and DOI in section marked as copyright page", async function () {
			let isbn = '9780226300481';
			let doi = '10.7208/chicago/9780226300658.001.0001';
			let search = null;
			let translateStub = sinon.stub(Zotero.Translate.Search.prototype, 'translate')
				.callsFake(async function () {
					search = this.search;
					return [{
						itemType: 'book',
						title: 'Building the American Republic, Volume 1, Library Catalog Edition',
						ISBN: isbn,
						attachments: [],
						tags: []
					}];
				});

			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_copyright_page.epub');
			let collection = await createDataObject('collection');
			await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.isTrue(translateStub.calledOnce);
			assert.ok(search);
			assert.equal(search.ISBN, isbn);
			assert.equal(search.DOI, doi);
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'Building the American Republic, Volume 1, Library Catalog Edition');
			assert.equal(Zotero.Utilities.cleanISBN(item.getField('ISBN')), isbn);
			assert.lengthOf(modifiedIDs, 2);

			translateStub.restore();
		});

		it("should find and search by ISBN and DOI in section not marked as copyright page", async function () {
			let isbn = '9780226300481';
			let doi = '10.7208/chicago/9780226300658.001.0001';
			let search = null;
			let translateStub = sinon.stub(Zotero.Translate.Search.prototype, 'translate')
				.callsFake(async function () {
					search = this.search;
					return [{
						itemType: 'book',
						title: 'Building the American Republic, Volume 1, Library Catalog Edition',
						ISBN: isbn,
						attachments: [],
						tags: []
					}];
				});

			let testDir = getTestDataDirectory();
			testDir.append('recognizeEPUB_test_content.epub');
			let collection = await createDataObject('collection');
			await Zotero.Attachments.importFromFile({
				file: testDir,
				collections: [collection.id]
			});

			win.ZoteroPane.recognizeSelected();

			let addedIDs = await waitForItemEvent('add');
			let modifiedIDs = await waitForItemEvent('modify');
			assert.isTrue(translateStub.calledOnce);
			assert.ok(search);
			assert.equal(search.ISBN, isbn);
			assert.equal(search.DOI, doi);
			assert.lengthOf(addedIDs, 1);
			let item = Zotero.Items.get(addedIDs[0]);
			assert.equal(item.getField('title'), 'Building the American Republic, Volume 1, Library Catalog Edition');
			assert.equal(Zotero.Utilities.cleanISBN(item.getField('ISBN')), isbn);
			assert.lengthOf(modifiedIDs, 2);

			translateStub.restore();
		});
	});
});