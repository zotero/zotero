"use strict";

describe("ZoteroPane", function() {
	var win, doc, zp, userLibraryID;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		zp = win.ZoteroPane;
		userLibraryID = Zotero.Libraries.userLibraryID;
	});
	
	after(function () {
		win.close();
	});
	
	describe("#_setHighlightedRowsCallback()", function () {
		it("should highlight parent collection of collection in trash", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection', { parentID: collection1.id, deleted: true });
			
			await selectTrash(win);
			
			var row = zp.itemsView.getRowIndexByID(collection2.treeViewID);
			zp.itemsView.selection.select(row);
			
			var spy = sinon.spy(zp.collectionsView, 'setHighlightedRows');
			await zp._setHighlightedRowsCallback();
			
			assert.sameMembers(spy.getCall(0).args[0], [collection1.treeViewID]);
			var rows = win.document.querySelectorAll('.highlighted');
			assert.lengthOf(rows, 1);
			
			await zp.collectionsView.setHighlightedRows();
			
			spy.restore();
			// Switch back to library to avoid breaking other tests
			await selectLibrary(win);
		});
	});
	
	describe("#newItem", function () {
		it("should create an item and focus the title field", function* () {
			yield zp.newItem(Zotero.ItemTypes.getID('book'), {}, null, true);
			assert.equal(doc.activeElement.closest("editable-text").id, "itembox-field-value-title");
			doc.activeElement.blur();
			yield Zotero.Promise.delay(1);
		})
		
		it("should save an entered value when New Item is used", function* () {
			var value = "Test";
			var item = yield zp.newItem(Zotero.ItemTypes.getID('book'), {}, null, true);
			let header = doc.getElementById('zotero-item-pane-header');
			let title = header.querySelector("editable-text");
			title.value = value;
			yield header.save();
			item = yield Zotero.Items.getAsync(item.id);
			assert.equal(item.getField('title'), value);
		})
	});
	
	describe("#newNote()", function () {
		it("should create a child note and select it", function* () {
			var item = yield createDataObject('item');
			var noteID = yield zp.newNote(false, item.key, "Test");
			var selected = zp.itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected, noteID);
		})
		
		it("should create a standalone note within a collection and select it", function* () {
			var collection = yield createDataObject('collection');
			yield select(win, collection);
			var noteID = yield zp.newNote(false, false, "Test");
			assert.equal(zp.collectionsView.getSelectedCollection(), collection);
			var selected = zp.itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected, noteID);
		})
	})
	
	describe("#newCollection()", function () {
		it("should create a collection", function* () {
			var promise = waitForDialog(
				null,
				'accept',
				'chrome://zotero/content/newCollectionDialog.xhtml'
			);
			var id = yield zp.newCollection();
			yield promise;
			var collection = Zotero.Collections.get(id);
			assert.isTrue(collection.name.startsWith(Zotero.getString('pane.collections.untitled')));
		});
	});
	
	describe("#newSearch()", function () {
		it("should create a saved search", function* () {
			var promise = waitForDialog(
				// TODO: Test changing a condition
				function (dialog) {},
				'accept',
				'chrome://zotero/content/searchDialog.xhtml'
			);
			var id = yield zp.newSearch();
			yield promise;
			var search = Zotero.Searches.get(id);
			assert.ok(search);
			assert.isTrue(search.name.startsWith(Zotero.getString('pane.collections.untitled')));
		});
		
		it("should handle clicking Cancel in the search window", function* () {
			var promise = waitForDialog(
				function (dialog) {},
				'cancel',
				'chrome://zotero/content/searchDialog.xhtml'
			);
			var id = yield zp.newSearch();
			yield promise;
			assert.isFalse(id);
		});
	});
	
	describe("#itemSelected()", function () {
		it.skip("should update the item count", function* () {
			var collection = new Zotero.Collection;
			collection.name = "Count Test";
			var id = yield collection.saveTx();
			yield waitForItemsLoad(win);
			
			// Unselected, with no items in view
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				yield doc.l10n.formatValue('item-pane-message-unselected', { count: 0 })
			);
			
			// Unselected, with one item in view
			var item = new Zotero.Item('newspaperArticle');
			item.setCollections([id]);
			var itemID1 = yield item.saveTx({
				skipSelect: true
			});
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				yield doc.l10n.formatValue('item-pane-message-unselected', { count: 1 })
			);
			
			// Unselected, with multiple items in view
			var item = new Zotero.Item('audioRecording');
			item.setCollections([id]);
			var itemID2 = yield item.saveTx({
				skipSelect: true
			});
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				yield doc.l10n.formatValue('item-pane-message-unselected', { count: 2 })
			);
			
			// Multiple items selected
			var promise = zp.itemsView._getItemSelectedPromise();
			zp.itemsView.rememberSelection([itemID1, itemID2]);
			yield promise;
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				Zotero.getString('pane.item.selected.multiple', 2)
			);
		})
	})
	
	describe("#viewAttachment", function () {
		var apiKey = Zotero.Utilities.randomString(24);
		var baseURL;
		var httpd;
		
		async function downloadOnDemand() {
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			// TODO: Test binary data
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			var mtime = "1441252524000";
			var md5 = Zotero.Utilities.Internal.md5(text)
			
			var s3Path = `pretend-s3/${item.key}`;
			httpd.registerPathHandler(
				`/users/1/items/${item.key}/file`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 302, "Found");
						response.setHeader("Zotero-File-Modification-Time", mtime, false);
						response.setHeader("Zotero-File-MD5", md5, false);
						response.setHeader("Zotero-File-Compressed", "No", false);
						response.setHeader("Location", baseURL + s3Path, false);
					}
				}
			);
			httpd.registerPathHandler(
				"/" + s3Path,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(text);
					}
				}
			);
			
			// Disable loadURI() so viewAttachment() doesn't trigger translator loading
			var stub = sinon.stub(Zotero, "launchFile");
			
			await zp.viewAttachment(item.id);
			
			assert.ok(stub.calledOnce);
			assert.ok(stub.calledWith(item.getFilePath()));
			stub.restore();
			
			assert.equal(await item.attachmentHash, md5);
			assert.equal(await item.attachmentModificationTime, mtime);
			var path = await item.getFilePathAsync();
			assert.equal(await Zotero.File.getContentsAsync(path), text);
		};
		
		before(function () {
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		})
		beforeEach(async function () {
			var port;
			({ httpd, port } = await startHTTPServer());
			baseURL = `http://localhost:${port}/`;
			Zotero.Prefs.set("api.url", baseURL);
			
			Zotero.Sync.Runner.apiKey = apiKey;
			await Zotero.Users.setCurrentUserID(1);
			await Zotero.Users.setCurrentUsername("testuser");
		})
		afterEach(function* () {
			var defer = new Zotero.Promise.defer();
			httpd.stop(() => defer.resolve());
			yield defer.promise;
		})
		after(function () {
			Zotero.HTTP.mock = null;
		});
		
		it("should download an attachment on-demand in as-needed mode", function* () {
			Zotero.Sync.Storage.Local.downloadAsNeeded(Zotero.Libraries.userLibraryID, true);
			yield downloadOnDemand();
		});
		
		// As noted in viewAttachment(), this is only necessary for files modified before 5.0.85
		it("should re-download a remotely modified attachment in as-needed mode", async function () {
			Zotero.Sync.Storage.Local.downloadAsNeeded(Zotero.Libraries.userLibraryID, true);
			
			var item = await importFileAttachment('test.txt');
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			var text = Zotero.Utilities.randomString();
			var mtime = "1441252524000";
			var md5 = Zotero.Utilities.Internal.md5(text)
			
			var s3Path = `pretend-s3/${item.key}`;
			httpd.registerPathHandler(
				`/users/1/items/${item.key}/file`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 302, "Found");
						response.setHeader("Zotero-File-Modification-Time", mtime, false);
						response.setHeader("Zotero-File-MD5", md5, false);
						response.setHeader("Zotero-File-Compressed", "No", false);
						response.setHeader("Location", baseURL + s3Path, false);
					}
				}
			);
			httpd.registerPathHandler(
				"/" + s3Path,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(text);
					}
				}
			);
			
			// Disable loadURI() so viewAttachment() doesn't trigger translator loading
			var downloadSpy = sinon.spy(Zotero.Sync.Runner, "downloadFile");
			var launchFileStub = sinon.stub(Zotero, "launchFile");
			
			await zp.viewAttachment(item.id);
			
			assert.ok(downloadSpy.calledOnce);
			assert.ok(launchFileStub.calledOnce);
			assert.ok(launchFileStub.calledWith(item.getFilePath()));
			downloadSpy.restore();
			launchFileStub.restore();
			
			assert.equal(await item.attachmentHash, md5);
			assert.equal(await item.attachmentModificationTime, mtime);
			var path = await item.getFilePathAsync();
			assert.equal(await Zotero.File.getContentsAsync(path), text);
		});
		
		it("should handle a 404 when re-downloading a remotely modified attachment in as-needed mode", async function () {
			Zotero.Sync.Storage.Local.downloadAsNeeded(Zotero.Libraries.userLibraryID, true);
			
			var item = await importFileAttachment('test.txt');
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			var mtime = await item.attachmentModificationTime;
			var md5 = await item.attachmentHash;
			var text = await Zotero.File.getContentsAsync(item.getFilePath());
			
			httpd.registerPathHandler(
				`/users/1/items/${item.key}/file`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 404, "Not Found");
					}
				}
			);
			
			// Disable loadURI() so viewAttachment() doesn't trigger translator loading
			var downloadSpy = sinon.spy(Zotero.Sync.Runner, "downloadFile");
			var launchFileStub = sinon.stub(Zotero, "launchFile");
			
			await zp.viewAttachment(item.id);
			
			assert.ok(downloadSpy.calledOnce);
			assert.ok(launchFileStub.calledOnce);
			assert.ok(launchFileStub.calledWith(item.getFilePath()));
			downloadSpy.restore();
			launchFileStub.restore();
			
			// File shouldn't have changed
			assert.equal(await item.attachmentModificationTime, mtime);
			assert.equal(await item.attachmentHash, md5);
			var path = await item.getFilePathAsync();
			assert.equal(await Zotero.File.getContentsAsync(path), text);
		});
		
		it("should download an attachment on-demand in at-sync-time mode", function* () {
			Zotero.Sync.Storage.Local.downloadOnSync(Zotero.Libraries.userLibraryID, true);
			yield downloadOnDemand();
		});
		
		it("should update a PDF with a blank MIME type", async function () {
			let attachment = await importFileAttachment('test.pdf');
			// Can't use contentType argument to importFileAttachment() because blank string is ignored
			attachment.attachmentContentType = '';
			await attachment.saveTx();
			await zp.viewAttachment(attachment.id);
			assert.equal(attachment.attachmentContentType, 'application/pdf');
		});
		
		it("should update an EPUB with an 'application/epub' MIME type", async function () {
			let attachment = await importFileAttachment('stub.epub', { contentType: 'application/epub' });
			assert.equal(attachment.attachmentContentType, 'application/epub');
			await zp.viewAttachment(attachment.id);
			assert.equal(attachment.attachmentContentType, 'application/epub+zip');
		});
		
		it("should update an EPUB with an 'application/octet-stream' MIME type", async function () {
			let attachment = await importFileAttachment('stub.epub', { contentType: 'application/octet-stream' });
			assert.equal(attachment.attachmentContentType, 'application/octet-stream');
			await zp.viewAttachment(attachment.id);
			assert.equal(attachment.attachmentContentType, 'application/epub+zip');
		});
	})
	
	
	describe("#addNoteFromAnnotationsFromSelected()", function () {
		it("should create a single note within a selected regular item for all child attachments", async function () {
			var item = await createDataObject('item');
			var attachment1 = await importPDFAttachment(item);
			var attachment2 = await importPDFAttachment(item);
			var annotation1 = await createAnnotation('highlight', attachment1);
			var annotation2 = await createAnnotation('highlight', attachment1);
			var annotation3 = await createAnnotation('highlight', attachment2);
			var annotation4 = await createAnnotation('highlight', attachment2);
			await zp.selectItems([item.id]);
			await zp.addNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			assert.equal(note.itemType, 'note');
			assert.equal(note.parentID, item.id);
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			assert.sameMembers(
				[...doc.querySelectorAll('h3')].map(x => x.textContent),
				[attachment1.getField('title'), attachment2.getField('title')]
			);
			assert.lengthOf([...doc.querySelectorAll('h3 + p')], 2);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 4);
		});
		
		it("should create a single note within the parent for all selected sibling attachments", async function () {
			var item = await createDataObject('item');
			var attachment1 = await importPDFAttachment(item);
			var attachment2 = await importPDFAttachment(item);
			var annotation1 = await createAnnotation('highlight', attachment1);
			var annotation2 = await createAnnotation('highlight', attachment1);
			var annotation3 = await createAnnotation('highlight', attachment2);
			var annotation4 = await createAnnotation('highlight', attachment2);
			await zp.selectItems([attachment1.id, attachment2.id]);
			await zp.addNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			assert.equal(note.parentID, item.id);
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			assert.sameMembers(
				[...doc.querySelectorAll('h3')].map(x => x.textContent),
				[attachment1.getField('title'), attachment2.getField('title')]
			);
			// No item titles
			assert.lengthOf([...doc.querySelectorAll('h2 + p')], 0);
			// Just attachment titles
			assert.lengthOf([...doc.querySelectorAll('h3 + p')], 2);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 4);
		});
		
		it("should ignore top-level item if child attachment is also selected", async function () {
			var item = await createDataObject('item');
			var attachment1 = await importPDFAttachment(item);
			var attachment2 = await importPDFAttachment(item);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment2);
			await zp.selectItems([item.id, attachment1.id]);
			await zp.addNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			// No titles
			assert.lengthOf([...doc.querySelectorAll('h2 + p')], 0);
			assert.lengthOf([...doc.querySelectorAll('h3 + p')], 0);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 2);
		});
		
		it("shouldn't do anything if parent item and child note is selected", async function () {
			var item = await createDataObject('item');
			var attachment = await importPDFAttachment(item);
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			await createAnnotation('highlight', attachment);
			await zp.selectItems([item.id, note.id]);
			await zp.addNoteFromAnnotationsFromSelected();
			var selectedItems = zp.getSelectedItems();
			assert.lengthOf(selectedItems, 2);
			assert.sameMembers(selectedItems, [item, note]);
		});
	});
	
	
	describe("#createStandaloneNoteFromAnnotationsFromSelected()", function () {
		it("should create a single standalone note for all child attachments of selected regular items", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			var item1 = await createDataObject('item', { setTitle: true, collections: [collection.id] });
			var item2 = await createDataObject('item', { setTitle: true, collections: [collection.id] });
			var attachment1 = await importPDFAttachment(item1);
			var attachment2 = await importPDFAttachment(item1);
			var attachment3 = await importPDFAttachment(item2);
			var attachment4 = await importPDFAttachment(item2);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment4);
			await createAnnotation('highlight', attachment4);
			await zp.selectItems([item1.id, item2.id]);
			await zp.createStandaloneNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			assert.equal(note.itemType, 'note');
			assert.isFalse(note.parentID);
			assert.isTrue(collection.hasItem(note));
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			assert.sameMembers(
				[...doc.querySelectorAll('h2')].map(x => x.textContent),
				[item1.getDisplayTitle(), item2.getDisplayTitle()]
			);
			assert.sameMembers(
				[...doc.querySelectorAll('h3')].map(x => x.textContent),
				[
					attachment1.getField('title'),
					attachment2.getField('title'),
					attachment3.getField('title'),
					attachment4.getField('title')
				]
			);
			assert.lengthOf([...doc.querySelectorAll('h3 + p')], 4);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 8);
		});
		
		it("should create a single standalone note for all selected attachments", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			var item1 = await createDataObject('item', { setTitle: true, collections: [collection.id] });
			var item2 = await createDataObject('item', { setTitle: true, collections: [collection.id] });
			var attachment1 = await importPDFAttachment(item1);
			var attachment2 = await importPDFAttachment(item1);
			var attachment3 = await importPDFAttachment(item2);
			var attachment4 = await importPDFAttachment(item2);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment4);
			await createAnnotation('highlight', attachment4);
			await zp.selectItems([attachment1.id, attachment3.id]);
			await zp.createStandaloneNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			assert.isFalse(note.parentID);
			assert.isTrue(collection.hasItem(note));
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			assert.sameMembers(
				[...doc.querySelectorAll('h2')].map(x => x.textContent),
				[item1.getDisplayTitle(), item2.getDisplayTitle()]
			);
			assert.lengthOf([...doc.querySelectorAll('h2 + p')], 2);
			assert.lengthOf([...doc.querySelectorAll('h3')], 0);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 4);
		});
		
		it("should ignore top-level item if child attachment is also selected", async function () {
			var item1 = await createDataObject('item', { setTitle: true });
			var item2 = await createDataObject('item', { setTitle: true });
			var attachment1 = await importPDFAttachment(item1);
			var attachment2 = await importPDFAttachment(item1);
			var attachment3 = await importPDFAttachment(item2);
			var attachment4 = await importPDFAttachment(item2);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment1);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment2);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment3);
			await createAnnotation('highlight', attachment4);
			await createAnnotation('highlight', attachment4);
			await zp.selectItems([item1.id, attachment1.id, attachment3.id]);
			await zp.createStandaloneNoteFromAnnotationsFromSelected();
			var newItems = zp.getSelectedItems();
			assert.lengthOf(newItems, 1);
			var note = newItems[0];
			var dp = new DOMParser();
			var doc = dp.parseFromString(note.getNote(), 'text/html');
			assert.sameMembers(
				[...doc.querySelectorAll('h2')].map(x => x.textContent),
				[item1.getDisplayTitle(), item2.getDisplayTitle()]
			);
			assert.lengthOf([...doc.querySelectorAll('h2 + p')], 2);
			assert.lengthOf([...doc.querySelectorAll('h3')], 0);
			assert.lengthOf([...doc.querySelectorAll('span.highlight')], 4);
		});
	});
	
	
	describe("#renameSelectedAttachmentsFromParents()", function () {
		it("should rename a linked file", async function () {
			var oldFilename = 'old.png';
			var newFilename = 'Test.png';
			var file = getTestDataDirectory();
			file.append('test.png');
			var tmpDir = await getTempDirectory();
			var oldFile = OS.Path.join(tmpDir, oldFilename);
			await OS.File.copy(file.path, oldFile);
			
			var item = createUnsavedDataObject('item');
			item.setField('title', 'Test');
			await item.saveTx();
			
			var attachment = await Zotero.Attachments.linkFromFile({
				file: oldFile,
				parentItemID: item.id
			});
			await zp.selectItem(attachment.id);
			
			await zp.renameSelectedAttachmentsFromParents();
			assert.equal(attachment.attachmentFilename, newFilename);
			var path = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(path), newFilename)
			await OS.File.exists(path);
		});
		
		it("should use unique name for linked file if target name is taken", async function () {
			var oldFilename = 'old.png';
			var newFilename = 'Test.png';
			var uniqueFilename = 'Test 2.png';
			var file = getTestDataDirectory();
			file.append('test.png');
			var tmpDir = await getTempDirectory();
			var oldFile = OS.Path.join(tmpDir, oldFilename);
			await OS.File.copy(file.path, oldFile);
			// Create file with target filename
			await Zotero.File.putContentsAsync(OS.Path.join(tmpDir, newFilename), '');
			
			var item = createUnsavedDataObject('item');
			item.setField('title', 'Test');
			await item.saveTx();
			
			var attachment = await Zotero.Attachments.linkFromFile({
				file: oldFile,
				parentItemID: item.id
			});
			await zp.selectItem(attachment.id);
			
			await zp.renameSelectedAttachmentsFromParents();
			assert.equal(attachment.attachmentFilename, uniqueFilename);
			var path = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(path), uniqueFilename)
			await OS.File.exists(path);
		});
		
		it("should use unique name for linked file without extension if target name is taken", async function () {
			var oldFilename = 'old';
			var newFilename = 'Test';
			var uniqueFilename = 'Test 2';
			var file = getTestDataDirectory();
			file.append('test.png');
			var tmpDir = await getTempDirectory();
			var oldFile = OS.Path.join(tmpDir, oldFilename);
			await OS.File.copy(file.path, oldFile);
			// Create file with target filename
			await Zotero.File.putContentsAsync(OS.Path.join(tmpDir, newFilename), '');
			
			var item = createUnsavedDataObject('item');
			item.setField('title', 'Test');
			await item.saveTx();
			
			var attachment = await Zotero.Attachments.linkFromFile({
				file: oldFile,
				parentItemID: item.id
			});
			await zp.selectItem(attachment.id);
			
			await zp.renameSelectedAttachmentsFromParents();
			assert.equal(attachment.attachmentFilename, uniqueFilename);
			var path = await attachment.getFilePathAsync();
			assert.equal(OS.Path.basename(path), uniqueFilename)
			await OS.File.exists(path);
		});
		
		it("shouldn't change attachment title if different from filename", async function () {
			var item = createUnsavedDataObject('item');
			item.setField('title', 'Title');
			await item.saveTx();
			
			var attachment = await importFileAttachment('test.png', { parentItemID: item.id });
			attachment.setField('title', 'Image');
			await attachment.saveTx();
			await zp.selectItem(attachment.id);
			
			await zp.renameSelectedAttachmentsFromParents();
			assert.equal(attachment.attachmentFilename, 'Title.png');
			assert.equal(attachment.getField('title'), 'Image')
		});
		
		it("should not change attachment title even if the same as filename", async function () {
			var item = createUnsavedDataObject('item');
			item.setField('title', 'Title');
			await item.saveTx();
			
			var attachment = await importFileAttachment('test.png', { parentItemID: item.id });
			attachment.setField('title', 'test.png');
			await attachment.saveTx();
			await zp.selectItem(attachment.id);
			
			await zp.renameSelectedAttachmentsFromParents();
			assert.equal(attachment.attachmentFilename, 'Title.png');
			assert.equal(attachment.getField('title'), 'test.png')
		});
	});
	
	
	describe("#duplicateSelectedItem()", function () {
		it("should add reverse relations", async function () {
			await selectLibrary(win);
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item');
			item1.addRelatedItem(item2);
			await item1.saveTx();
			item2.addRelatedItem(item1);
			await item2.saveTx();
			var item3 = await zp.duplicateSelectedItem();
			assert.sameMembers(item3.relatedItems, [item1.key]);
			assert.sameMembers(item2.relatedItems, [item1.key]);
			assert.sameMembers(item1.relatedItems, [item2.key, item3.key]);
		});
	});
	
	
	describe("#duplicateAndConvertSelectedItem()", function () {
		describe("book to book section", function () {
			it("should not add relations to other book sections for the same book", async function () {
				await selectLibrary(win);
				var bookItem = await createDataObject('item', { itemType: 'book', title: "Book Title" });
				
				// Relate book to another book section with a different title
				var otherBookSection = createUnsavedDataObject('item', { itemType: 'bookSection', setTitle: true })
				otherBookSection.setField('bookTitle', "Another Book Title");
				await otherBookSection.saveTx();
				bookItem.addRelatedItem(otherBookSection);
				await bookItem.saveTx();
				otherBookSection.addRelatedItem(bookItem);
				await otherBookSection.saveTx();
				
				await zp.selectItem(bookItem.id);
				var bookSectionItem1 = await zp.duplicateAndConvertSelectedItem();
				await zp.selectItem(bookItem.id);
				var bookSectionItem2 = await zp.duplicateAndConvertSelectedItem();
				
				// Book sections should only be related to parent
				assert.sameMembers(bookSectionItem1.relatedItems, [bookItem.key, otherBookSection.key]);
				assert.sameMembers(bookSectionItem2.relatedItems, [bookItem.key, otherBookSection.key]);
			});
		});
		
		it("should not copy abstracts", async function() {
			await selectLibrary(win);
			var bookItem = await createDataObject('item', { itemType: 'book', title: "Book Title" });
			bookItem.setField('abstractNote', 'An abstract');
			bookItem.saveTx();

			var bookSectionItem = await zp.duplicateAndConvertSelectedItem();
			assert.isEmpty(bookSectionItem.getField('abstractNote'));
		});
	});
	
	
	describe("#deleteSelectedItems()", function () {
		const DELETE_KEY_CODE = 46;
		
		afterEach(async function () {
			await selectLibrary(win);
		});
		
		it("should remove an item from My Publications", function* () {
			var item = createUnsavedDataObject('item');
			item.inPublications = true;
			yield item.saveTx();
			
			yield zp.collectionsView.selectByID("P" + userLibraryID);
			yield waitForItemsLoad(win);
			var iv = zp.itemsView;
			
			var selected = iv.selectItem(item.id);
			assert.ok(selected);
			
			var tree = doc.getElementById(iv.id);
			tree.focus();
			
			yield Zotero.Promise.delay(1);
			
			var promise = waitForDialog();
			var modifyPromise = waitForItemEvent('modify');
			
			var event = new KeyboardEvent(
				"keypress",
				{
					key: 'Delete',
					code: 'Delete',
					keyCode: DELETE_KEY_CODE,
					bubbles: true,
					cancelable: true
				}
			);
			tree.dispatchEvent(event);
			yield promise;
			yield modifyPromise;
			
			assert.isFalse(item.inPublications);
			assert.isFalse(item.deleted);
		});
		
		it("should move My Publications item to trash with prompt for modified Delete", function* () {
			var item = createUnsavedDataObject('item');
			item.inPublications = true;
			yield item.saveTx();
			
			yield zp.collectionsView.selectByID("P" + userLibraryID);
			yield waitForItemsLoad(win);
			var iv = zp.itemsView;
			
			var selected = iv.selectItem(item.id);
			assert.ok(selected);
			
			var tree = doc.getElementById(iv.id);
			tree.focus();
			
			yield Zotero.Promise.delay(1);
			
			var promise = waitForDialog();
			var modifyPromise = waitForItemEvent('modify');
			
			var event = new KeyboardEvent(
				"keypress",
				{
					key: 'Delete',
					code: 'Delete',
					keyCode: DELETE_KEY_CODE,
					bubbles: true,
					cancelable: true,
					shiftKey: !Zotero.isMac,
					metaKey: Zotero.isMac,
				}
			);
			tree.dispatchEvent(event);
			yield promise;
			yield modifyPromise;
			
			assert.isTrue(item.inPublications);
			assert.isTrue(item.deleted);
		});
		
		it("should move saved search item to trash with prompt for unmodified Delete", async function () {
			var search = await createDataObject('search');
			var title = [...Object.values(search.conditions)]
				.filter(x => x.condition == 'title' && x.operator == 'contains')[0].value;
			var item = await createDataObject('item', { title });
			
			await select(win, search);
			var iv = zp.itemsView;
			
			var selected = iv.selectItem(item.id);
			assert.ok(selected);
			
			var tree = doc.getElementById(iv.id);
			tree.focus();
			
			await Zotero.Promise.delay(1);
			
			var promise = waitForDialog();
			var modifyPromise = waitForItemEvent('modify');
			
			var event = new KeyboardEvent(
				"keypress",
				{
					key: 'Delete',
					code: 'Delete',
					keyCode: DELETE_KEY_CODE,
					bubbles: true,
					cancelable: true
				}
			);
			tree.dispatchEvent(event);
			await promise;
			await modifyPromise;
			
			assert.isTrue(item.deleted);
		});
		
		it("should move saved search item to trash without prompt for modified Delete", async function () {
			var search = await createDataObject('search');
			var title = [...Object.values(search.conditions)]
				.filter(x => x.condition == 'title' && x.operator == 'contains')[0].value;
			var item = await createDataObject('item', { title });
			
			await select(win, search);
			var iv = zp.itemsView;
			
			var selected = iv.selectItem(item.id);
			assert.ok(selected);
			
			var tree = doc.getElementById(iv.id);
			tree.focus();
			
			await Zotero.Promise.delay(1);
			
			var modifyPromise = waitForItemEvent('modify');
			
			var event = new KeyboardEvent(
				"keypress",
				{
					key: 'Delete',
					code: 'Delete',
					keyCode: DELETE_KEY_CODE,
					metaKey: Zotero.isMac,
					shiftKey: !Zotero.isMac,
					bubbles: true,
					cancelable: true
				}
			);
			tree.dispatchEvent(event);
			await modifyPromise;
			
			assert.isTrue(item.deleted);
		});

		it("should prompt to remove an item from subcollections when recursiveCollections enabled", async function () {
			Zotero.Prefs.set('recursiveCollections', true);

			let collection1 = await createDataObject('collection');
			let collection2 = await createDataObject('collection', { parentID: collection1.id });
			let item = await createDataObject('item', { collections: [collection2.id] });

			await select(win, collection1);
			let iv = zp.itemsView;
			assert.ok(await iv.selectItem(item.id));

			await Zotero.Promise.delay(100);

			let promise = waitForDialog();
			let modifyPromise = waitForItemEvent('modify');

			await zp.deleteSelectedItems(false);

			let dialog = await promise;
			await modifyPromise;

			assert.include(dialog.document.documentElement.textContent, Zotero.getString('pane.items.removeRecursive'));
			assert.isFalse(item.inCollection(collection2.id));

			Zotero.Prefs.clear('recursiveCollections');
		});
	});
	
	describe("#deleteSelectedCollection()", function () {
		it("should move collection to trash but not descendant items by default", function* () {
			var collection = yield createDataObject('collection');
			yield select(win, collection);
			var item = yield createDataObject('item', { collections: [collection.id] });
			var promise = waitForDialog();
			yield zp.deleteSelectedCollection();
			assert.isTrue(collection.deleted);
			assert.isTrue(Zotero.Items.exists(item.id));
			assert.isFalse(item.deleted);
		});
		
		it("should move to trash collection and descendant items when deleteItems=true", function* () {
			var collection = yield createDataObject('collection');
			yield select(win, collection);
			var item = yield createDataObject('item', { collections: [collection.id] });
			var promise = waitForDialog();
			yield zp.deleteSelectedCollection(true);
			assert.isTrue(collection.deleted);
			assert.isTrue(Zotero.Items.exists(item.id));
			assert.isTrue(item.deleted);
		});
	});
	
	
	describe("#setVirtual()", function () {
		var cv;
		
		before(function* () {
			cv = zp.collectionsView;
		});
		beforeEach(function () {
			Zotero.Prefs.clear('duplicateLibraries');
			Zotero.Prefs.clear('unfiledLibraries');
			return selectLibrary(win);
		})
		
		it("should show a hidden virtual collection in My Library", function* () {
			// Create unfiled, duplicate items
			var title = Zotero.Utilities.randomString();
			var item1 = yield createDataObject('item', { title });
			var item2 = yield createDataObject('item', { title });
			
			// Start hidden (tested in collectionTreeViewTest)
			Zotero.Prefs.set('duplicateLibraries', `{"${userLibraryID}": false}`);
			Zotero.Prefs.set('unfiledLibraries', `{"${userLibraryID}": false}`);
			yield cv.refresh();
			
			// Show Duplicate Items
			var id = "D" + userLibraryID;
			assert.isFalse(cv.getRowIndexByID(id));
			yield zp.setVirtual(userLibraryID, 'duplicates', true, true);
			// Duplicate Items should be selected
			assert.equal(zp.getCollectionTreeRow().id, id);
			// Should be missing from pref
			assert.isUndefined(JSON.parse(Zotero.Prefs.get('duplicateLibraries'))[userLibraryID])
			
			// Clicking should select both items
			var row = cv.getRowIndexByID(id);
			assert.ok(row);
			assert.equal(cv.selection.pivot, row);
			yield waitForItemsLoad(win);
			var iv = zp.itemsView;
			row = iv.getRowIndexByID(item1.id);
			assert.isNumber(row);
			var promise = iv.waitForSelect();
			clickOnItemsRow(win, iv, row);
			assert.equal(iv.selection.count, 2);
			yield promise;
			
			// Show Unfiled Items
			id = "U" + userLibraryID;
			assert.isFalse(cv.getRowIndexByID(id));
			yield zp.setVirtual(userLibraryID, 'unfiled', true, true);
			// Unfiled Items should be selected
			assert.equal(zp.getCollectionTreeRow().id, id);
			// Should be missing from pref
			assert.isUndefined(JSON.parse(Zotero.Prefs.get('unfiledLibraries'))[userLibraryID])
		});
		
		it("should expand library if collapsed when showing virtual collection", function* () {
			// Start hidden (tested in collectionTreeViewTest)
			Zotero.Prefs.set('duplicateLibraries', `{"${userLibraryID}": false}`);
			yield cv.refresh();
			
			var libraryRow = cv.getRowIndexByID(Zotero.Libraries.userLibrary.treeViewID);
			if (cv.isContainerOpen(libraryRow)) {
				yield cv.toggleOpenState(libraryRow);
				cv._saveOpenStates();
			}
			
			// Show Duplicate Items
			var id = "D" + userLibraryID;
			yield zp.setVirtual(userLibraryID, 'duplicates', true, true);
			
			// Library should have been expanded and Duplicate Items selected
			assert.ok(cv.getRowIndexByID(id));
			assert.equal(zp.getCollectionTreeRow().id, id);
		});
		
		it("should hide a virtual collection in My Library", function* () {
			yield cv.refresh();
			
			// Hide Duplicate Items
			var id = "D" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield zp.setVirtual(userLibraryID, 'duplicates', false);
			assert.isFalse(cv.getRowIndexByID(id));
			assert.isFalse(JSON.parse(Zotero.Prefs.get('duplicateLibraries'))[userLibraryID])
			
			// Hide Unfiled Items
			id = "U" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield zp.setVirtual(userLibraryID, 'unfiled', false);
			assert.isFalse(cv.getRowIndexByID(id));
			assert.isFalse(JSON.parse(Zotero.Prefs.get('unfiledLibraries'))[userLibraryID])
		});
		
		it("should hide a virtual collection in a group", function* () {
			yield cv.refresh();
			
			var group = yield createGroup();
			var groupRow = cv.getRowIndexByID(group.treeViewID);
			var rowCount = cv._rows.length;
			
			// Make sure group is open
			if (!cv.isContainerOpen(groupRow)) {
				yield cv.toggleOpenState(groupRow);
			}
			
			// Make sure Duplicate Items is showing
			var id = "D" + group.libraryID;
			assert.ok(cv.getRowIndexByID(id));
			
			// Hide Duplicate Items
			assert.ok(yield cv.selectByID(id));
			yield zp.setVirtual(group.libraryID, 'duplicates', false);
			// Row should have been removed
			assert.isFalse(cv.getRowIndexByID(id));
			// Pref should have been updated
			Zotero.debug(Zotero.Prefs.get('duplicateLibraries'));
			assert.isFalse(JSON.parse(Zotero.Prefs.get('duplicateLibraries'))[group.libraryID]);
			// Group row shouldn't have changed
			assert.equal(cv.getRowIndexByID(group.treeViewID), groupRow);
			// Group should remain open
			assert.isTrue(cv.isContainerOpen(groupRow));
			// Row count should be 1 less
			assert.equal(cv._rows.length, --rowCount);
			
			// Hide Unfiled Items
			id = "U" + group.libraryID;
			assert.ok(yield cv.selectByID(id));
			// Hide Unfiled Items
			yield zp.setVirtual(group.libraryID, 'unfiled', false);
			// Row should have been removed
			assert.isFalse(cv.getRowIndexByID(id));
			// Pref should have been updated
			assert.isFalse(JSON.parse(Zotero.Prefs.get('unfiledLibraries'))[group.libraryID]);
			// Group row shouldn't have changed
			assert.equal(cv.getRowIndexByID(group.treeViewID), groupRow);
			// Group should remain open
			assert.isTrue(cv.isContainerOpen(groupRow));
			// Row count should be 1 less
			assert.equal(cv._rows.length, --rowCount);
		});
	});
	
	describe("#editSelectedCollection()", function () {
		it("should edit a saved search", function* () {
			var search = yield createDataObject('search');
			yield select(win, search);
			var promise = waitForWindow('chrome://zotero/content/searchDialog.xhtml', function (win) {
				let searchBox = win.document.getElementById('search-box');
				var c = searchBox.search.getCondition(
					searchBox.search.addCondition("title", "contains", "foo")
				);
				searchBox.addCondition(c);
				win.document.querySelector('dialog').acceptDialog();
			});
			yield zp.editSelectedCollection();
			yield promise;
			var conditions = search.getConditions();
			assert.lengthOf(Object.keys(conditions), 3);
		});
		
		it("should edit a saved search in a group", function* () {
			var group = yield getGroup();
			var search = yield createDataObject('search', { libraryID: group.libraryID });
			yield select(win, search);
			var promise = waitForWindow('chrome://zotero/content/searchDialog.xhtml', function (win) {
				let searchBox = win.document.getElementById('search-box');
				var c = searchBox.search.getCondition(
					searchBox.search.addCondition("title", "contains", "foo")
				);
				searchBox.addCondition(c);
				win.document.querySelector('dialog').acceptDialog();
			});
			yield zp.editSelectedCollection();
			yield promise;
			var conditions = search.getConditions();
			assert.lengthOf(Object.keys(conditions), 3);
		});
	});
	
	describe("#buildItemContextMenu()", function () {
		it("shouldn't show export or bib options for multiple standalone file attachments without notes", async function () {
			var item1 = await importFileAttachment('test.png');
			var item2 = await importFileAttachment('test.png');
			
			await zp.selectItems([item1.id, item2.id]);
			await zp.buildItemContextMenu();
			
			var menu = win.document.getElementById('zotero-itemmenu');
			assert.isTrue(menu.querySelector('.zotero-menuitem-export').hidden);
			assert.isTrue(menu.querySelector('.zotero-menuitem-create-bibliography').hidden);
		});
		
		it("should show “Export Note…” for standalone file attachment with note", async function () {
			var item1 = await importFileAttachment('test.png');
			item1.setNote('<p>Foo</p>');
			await item1.saveTx();
			var item2 = await importFileAttachment('test.png');
			
			await zp.selectItems([item1.id, item2.id]);
			await zp.buildItemContextMenu();
			
			var menu = win.document.getElementById('zotero-itemmenu');
			var exportMenuItem = menu.querySelector('.zotero-menuitem-export');
			assert.isFalse(exportMenuItem.hidden);
			assert.equal(
				exportMenuItem.getAttribute('label'),
				Zotero.getString('pane.items.menu.exportNote.multiple')
			);
		});

		it("should enable “Delete Item…” when selected item or an ancestor is in trash", async function () {
			var item1 = await createDataObject('item', { deleted: true });
			var attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			
			await zp.selectItems([attachment1.id]);
			await zp.buildItemContextMenu();
			var menu = win.document.getElementById('zotero-itemmenu');
			var deleteMenuItem = menu.querySelector('.zotero-menuitem-delete-from-lib');
			assert.isFalse(deleteMenuItem.disabled);

			await zp.selectItems([item1.id, attachment1.id]);
			await zp.buildItemContextMenu();
			assert.isFalse(deleteMenuItem.disabled);

			item1.deleted = false;
			attachment1.deleted = true;
			await item1.saveTx();
			await attachment1.saveTx();
			await zp.buildItemContextMenu();
			assert.isTrue(deleteMenuItem.disabled);
		});

		it("should enable “Restore to Library” when at least one selected item is in trash", async function () {
			var item1 = await createDataObject('item', { deleted: true });
			var attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			
			await zp.selectItems([item1.id]);
			await zp.buildItemContextMenu();
			var menu = win.document.getElementById('zotero-itemmenu');
			var restoreMenuItem = menu.querySelector('.zotero-menuitem-restore-to-library');
			assert.isFalse(restoreMenuItem.disabled);

			await zp.selectItems([item1.id, attachment1.id]);
			await zp.buildItemContextMenu();
			assert.isFalse(restoreMenuItem.disabled);
		});

		it("should disable “Restore to Library” when no selected items are in trash", async function () {
			var item1 = await createDataObject('item');
			var attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			
			await zp.selectItems([item1.id]);
			await zp.buildItemContextMenu();
			var menu = win.document.getElementById('zotero-itemmenu');
			var restoreMenuItem = menu.querySelector('.zotero-menuitem-restore-to-library');
			assert.isTrue(restoreMenuItem.disabled);
		});
	});

	describe("#restoreSelectedItems()", function () {
		it("should restore trashed parent and single trashed child when both are selected", async function () {
			let item1 = await createDataObject('item', { deleted: true });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([item1.id, attachment1.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
		});

		it("should restore child when parent and trashed child are selected", async function () {
			let item1 = await createDataObject('item', { deleted: false });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([item1.id, attachment1.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
		});

		it("should restore parent and selected children when parent and some trashed children are selected", async function () {
			let item1 = await createDataObject('item', { deleted: false });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment2 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();
			attachment2.deleted = true;
			await attachment2.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([item1.id, attachment1.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.isTrue(attachment2.deleted);
		});

		it("should restore parent and all children when trashed parent and no children are selected", async function () {
			let item1 = await createDataObject('item', { deleted: true });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment2 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment3 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();
			attachment2.deleted = true;
			await attachment2.saveTx();
			attachment3.deleted = true;
			await attachment3.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([item1.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.isFalse(attachment2.deleted);
			assert.isFalse(attachment3.deleted);
		});

		it("should restore parent and selected children when trashed parent and some trashed children are selected", async function () {
			let item1 = await createDataObject('item', { deleted: true });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment2 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment3 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();
			attachment2.deleted = true;
			await attachment2.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([item1.id, attachment2.id, attachment3.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isTrue(attachment1.deleted);
			assert.isFalse(attachment2.deleted);
			assert.isFalse(attachment3.deleted);
		});

		it("should restore selected children when trashed children and untrashed children are selected", async function () {
			let item1 = await createDataObject('item', { deleted: false });
			let attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment2 = await importFileAttachment('test.png', { parentItemID: item1.id });
			let attachment3 = await importFileAttachment('test.png', { parentItemID: item1.id });
			attachment1.deleted = true;
			await attachment1.saveTx();
			attachment2.deleted = true;
			await attachment2.saveTx();

			var userLibraryID = Zotero.Libraries.userLibraryID;
			await zp.collectionsView.selectByID('T' + userLibraryID);
			await zp.selectItems([attachment1.id, attachment2.id, attachment3.id]);
			await zp.restoreSelectedItems();

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.isFalse(attachment2.deleted);
			assert.isFalse(attachment3.deleted);
		});
	});

	describe("#checkForLinkedFilesToRelink()", function () {
		let labdDir;

		this.beforeEach(async () => {
			labdDir = await getTempDirectory();
			Zotero.Prefs.set('baseAttachmentPath', labdDir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true);
		});

		it("should detect and relink a single attachment", async function () {
			let item = await createDataObject('item');
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let outsideStorageDir = await getTempDirectory();
			let outsideFile = OS.Path.join(outsideStorageDir, 'test.pdf');

			let labdFile = OS.Path.join(labdDir, 'test.pdf');

			await OS.File.copy(file.path, outsideFile);

			let attachment = await Zotero.Attachments.linkFromFile({
				file: outsideFile,
				parentItemID: item.id
			});

			await assert.eventually.isTrue(attachment.fileExists());
			await OS.File.move(outsideFile, labdFile);
			await assert.eventually.isFalse(attachment.fileExists());

			let stub = sinon.stub(zp, 'showLinkedFileFoundAutomaticallyDialog')
				.returns('one');
			await zp.checkForLinkedFilesToRelink(attachment);
			assert.ok(stub.calledOnce);
			assert.ok(stub.calledWith(attachment, sinon.match.string, 0));

			await assert.eventually.isTrue(attachment.fileExists());
			assert.equal(attachment.getFilePath(), labdFile);
			assert.equal(attachment.attachmentPath, 'attachments:test.pdf');

			stub.restore();
		});

		it("should detect and relink multiple attachments when user chooses", async function () {
			for (let choice of ['one', 'all']) {
				let file1 = getTestDataDirectory();
				file1.append('test.pdf');
				let file2 = getTestDataDirectory();
				file2.append('empty.pdf');
				let outsideStorageDir = await getTempDirectory();
				let outsideFile1 = OS.Path.join(outsideStorageDir, 'test.pdf');
				let outsideFile2 = OS.Path.join(outsideStorageDir, 'empty.pdf');

				let labdFile1 = OS.Path.join(labdDir, 'test.pdf');
				let labdFile2 = OS.Path.join(labdDir, 'empty.pdf');

				await OS.File.copy(file1.path, outsideFile1);
				await OS.File.copy(file2.path, outsideFile2);

				let attachment1 = await Zotero.Attachments.linkFromFile({ file: outsideFile1 });
				let attachment2 = await Zotero.Attachments.linkFromFile({ file: outsideFile2 });

				await assert.eventually.isTrue(attachment1.fileExists());
				await assert.eventually.isTrue(attachment2.fileExists());
				await OS.File.move(outsideFile1, labdFile1);
				await OS.File.move(outsideFile2, labdFile2);
				await assert.eventually.isFalse(attachment1.fileExists());
				await assert.eventually.isFalse(attachment2.fileExists());

				let stub = sinon.stub(zp, 'showLinkedFileFoundAutomaticallyDialog')
					.returns(choice);
				await zp.checkForLinkedFilesToRelink(attachment1);
				assert.ok(stub.calledOnce);
				assert.ok(stub.calledWith(attachment1, sinon.match.string, 1));

				await assert.eventually.isTrue(attachment1.fileExists());
				await assert.eventually.equal(attachment2.fileExists(), choice === 'all');
				assert.equal(attachment1.getFilePath(), labdFile1);
				assert.equal(attachment1.attachmentPath, 'attachments:test.pdf');
				if (choice === 'all') {
					assert.equal(attachment2.getFilePath(), labdFile2);
					assert.equal(attachment2.attachmentPath, 'attachments:empty.pdf');
				}
				else {
					assert.equal(attachment2.getFilePath(), outsideFile2);
				}

				stub.restore();
			}
		});

		it("should use subdirectories of original path", async function () {
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let outsideStorageDir = OS.Path.join(await getTempDirectory(), 'subdir');
			await OS.File.makeDir(outsideStorageDir);
			let outsideFile = OS.Path.join(outsideStorageDir, 'test.pdf');

			let labdSubdir = OS.Path.join(labdDir, 'subdir');
			await OS.File.makeDir(labdSubdir);
			let labdFile = OS.Path.join(labdSubdir, 'test.pdf');

			await OS.File.copy(file.path, outsideFile);

			let attachment = await Zotero.Attachments.linkFromFile({ file: outsideFile });

			await assert.eventually.isTrue(attachment.fileExists());
			await OS.File.move(outsideFile, labdFile);
			await assert.eventually.isFalse(attachment.fileExists());

			let dialogStub = sinon.stub(zp, 'showLinkedFileFoundAutomaticallyDialog')
				.returns('one');
			// No longer works with IOUtils
			//let existsSpy = sinon.spy(IOUtils, 'exists');
			await zp.checkForLinkedFilesToRelink(attachment);
			assert.ok(dialogStub.calledOnce);
			assert.ok(dialogStub.calledWith(attachment, sinon.match.string, 0));
			//Zotero.debug(existsSpy.calledWith(OS.Path.join(labdSubdir, 'test.pdf')));
			//assert.ok(existsSpy.calledWith(OS.Path.join(labdSubdir, 'test.pdf')));
			//assert.notOk(existsSpy.calledWith(OS.Path.join(labdDir, 'test.pdf'))); // Should never get there

			await assert.eventually.isTrue(attachment.fileExists());
			assert.equal(attachment.getFilePath(), labdFile);
			assert.equal(attachment.attachmentPath, 'attachments:subdir/test.pdf');

			dialogStub.restore();
			//existsSpy.restore();
		});

		it("should handle Windows paths", async function () {
			let filenames = [['test.pdf'], ['empty.pdf'], ['search', 'baz.pdf']];
			let labdFiles = [];
			let attachments = [];

			for (let parts of filenames) {
				let file = getTestDataDirectory();
				parts.forEach(part => file.append(part));

				await OS.File.makeDir(OS.Path.join(labdDir, ...parts.slice(0, -1)));
				let labdFile = OS.Path.join(labdDir, ...parts);
				await OS.File.copy(file.path, labdFile);
				labdFiles.push(labdFile);

				let attachment = await Zotero.Attachments.linkFromFile({ file });
				attachment.attachmentPath = `C:\\test\\${parts.join('\\')}`;
				await attachment.saveTx();
				attachments.push(attachment);

				await assert.eventually.isFalse(attachment.fileExists());
			}

			let stub = sinon.stub(zp, 'showLinkedFileFoundAutomaticallyDialog')
				.returns('all');
			await zp.checkForLinkedFilesToRelink(attachments[0]);
			assert.ok(stub.calledOnce);
			assert.ok(stub.calledWith(attachments[0], sinon.match.string, filenames.length - 1));

			for (let i = 0; i < filenames.length; i++) {
				let attachment = attachments[i];
				await assert.eventually.isTrue(attachment.fileExists());
				assert.equal(attachment.getFilePath(), labdFiles[i]);
				assert.equal(attachment.attachmentPath, 'attachments:' + OS.Path.join(...filenames[i]));
			}

			stub.restore();
		});
	});
	
	describe("#focus()", function () {
		before(async function () {
			var collection = new Zotero.Collection;
			collection.name = "Focus Test";
			await collection.saveTx();
			// Make sure there is a tag
			var item = new Zotero.Item('newspaperArticle');
			item.setCollections([collection.id]);
			await item.setTags(["Tag"]);
			await item.saveTx({
				skipSelect: true
			});
			// Make sure there is more than one tab so that the tabs menu is focusable
			if (win.Zotero_Tabs.numTabs == 1) {
				let attachment = await importFileAttachment('test.pdf');
				await attachment.saveTx();
				await zp.viewAttachment(attachment.id);
				win.Zotero_Tabs.select('zotero-pane');
			}
			await waitForItemsLoad(win);
			await zp.collectionsView.selectLibrary(userLibraryID);
		});

		var tab = new KeyboardEvent('keydown', {
			key: 'Tab',
			shiftKey: false,
			bubbles: true
		});

		var shiftTab = new KeyboardEvent('keydown', {
			key: 'Tab',
			shiftKey: true,
			bubbles: true
		});

		var rightArrow = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true
		});
		var leftArrow = new KeyboardEvent('keydown', {
			key: 'ArrowLeft',
			bubbles: true
		});

		// Focus sequence for Zotero Pane
		let sequence = [
			"zotero-tb-search-dropmarker",
			"zotero-tb-add",
			"tag-selector-actions",
			"search-input",
			"tag-selector-item",
			"collection-tree",
			"zotero-collections-search",
			"zotero-tb-collection-add",
			"zotero-tb-sync",
			"zotero-tb-tabs-menu"
		];
		it("should shift-tab across the zotero pane", async function () {
			let searchBox = doc.getElementById('zotero-tb-search-textbox');
			searchBox.focus();

			for (let id of sequence) {
				doc.activeElement.dispatchEvent(shiftTab);
				// Wait for collection search to be revealed
				if (id === "zotero-collections-search") {
					await Zotero.Promise.delay(250);
				}
				// Some elements don't have id, so use classes to verify they're focused
				if (doc.activeElement.id) {
					assert.equal(doc.activeElement.id, id);
				}
				else {
					let clases = [...doc.activeElement.classList];
					assert.include(clases, id);
				}
				// Wait for collection search to be hidden for subsequent tests
				if (id === "zotero-tb-collection-add") {
					await Zotero.Promise.delay(50);
				}
			}
			doc.activeElement.dispatchEvent(shiftTab);
			assert.equal(doc.activeElement.className, "tab selected");

			doc.activeElement.dispatchEvent(shiftTab);
			assert.equal(doc.activeElement.id, "item-tree-main-default");
		});

		it("should tab across the zotero pane", async function () {
			win.Zotero_Tabs.moveFocus("current");
			sequence.reverse();
			for (let id of sequence) {
				doc.activeElement.dispatchEvent(tab);
				// Wait for collection search to be revealed
				if (id === "zotero-collections-search") {
					await Zotero.Promise.delay(250);
				}
				// Some elements don't have id, so use classes to verify they're focused
				if (doc.activeElement.id) {
					assert.equal(doc.activeElement.id, id);
				}
				else {
					let clases = [...doc.activeElement.classList];
					assert.include(clases, id);
				}
			}
		});

		it("should navigate toolbarbuttons with arrows", async function () {
			let addItem = doc.getElementById('zotero-tb-add');
			addItem.focus();
			
			doc.activeElement.dispatchEvent(rightArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-lookup");
			doc.activeElement.dispatchEvent(rightArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-attachment-add");
			doc.activeElement.dispatchEvent(rightArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-note-add");

			doc.activeElement.dispatchEvent(leftArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-attachment-add");
			doc.activeElement.dispatchEvent(leftArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-lookup");
			doc.activeElement.dispatchEvent(leftArrow);
			assert.equal(doc.activeElement.id, "zotero-tb-add");
		});
	});
	
	describe("#addAttachmentFromDialog()", function () {
		it("should set an automatic title on the first file attachment of each supported type", async function () {
			let parentItem = await createDataObject('item');
			
			// Add a link attachment, which won't affect renaming
			await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				parentItemID: parentItem.id,
			});
			
			// Add a PDF attachment, which will get a default title
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let [pdfAttachment1] = await zp.addAttachmentFromDialog(false, parentItem.id, [file.path]);
			assert.equal(parentItem.getAttachments().length, 2);
			assert.equal(pdfAttachment1.getField('title'), Zotero.getString('fileTypes.pdf'));
			
			// Add a second, which will get a title based on its filename
			let [pdfAttachment2] = await zp.addAttachmentFromDialog(false, parentItem.id, [file.path]);
			assert.equal(parentItem.getAttachments().length, 3);
			assert.equal(pdfAttachment2.getField('title'), 'test');
			
			// Add an EPUB attachment, which will get a default title
			file = getTestDataDirectory();
			file.append('stub.epub');
			let [epubAttachment] = await zp.addAttachmentFromDialog(false, parentItem.id, [file.path]);
			assert.equal(parentItem.getAttachments().length, 4);
			assert.equal(epubAttachment.getField('title'), Zotero.getString('fileTypes.ebook'));
		});
	});
})
