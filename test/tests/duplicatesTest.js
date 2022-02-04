"use strict";

describe("Duplicate Items", function () {
	var win, zp, cv;
	
	before(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		Zotero.Prefs.clear('duplicateLibraries');
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
	});
	beforeEach(function* () {
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	});

	async function merge(itemID) {
		var userLibraryID = Zotero.Libraries.userLibraryID;
			
		var selected = await cv.selectByID('D' + userLibraryID);
		assert.ok(selected);
		await waitForItemsLoad(win);
		
		// Select the first item, which should select both
		var iv = zp.itemsView;
		var row = iv.getRowIndexByID(itemID);
		var promise = iv.waitForSelect();
		clickOnItemsRow(win, iv, row);
		await promise;
		
		// Click merge button
		var button = win.document.getElementById('zotero-duplicates-merge-button');
		button.click();
		
		await waitForNotifierEvent('refresh', 'trash');
	}
	
	describe("Merging", function () {
		it("should merge two items in duplicates view", function* () {
			var item1 = yield createDataObject('item', { setTitle: true });
			var item2 = item1.clone();
			yield item2.saveTx();
			var uri2 = Zotero.URI.getItemURI(item2);
			
			yield merge(item1.id);
			
			// Items should be gone
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isTrue(item2.deleted);
			var rels = item1.getRelations();
			var pred = Zotero.Relations.replacedItemPredicate;
			assert.property(rels, pred);
			assert.equal(rels[pred], uri2);
		});
		
		it("should combine collections from all items", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection');
			
			var item1 = yield createDataObject('item', { setTitle: true, collections: [collection1.id] });
			var item2 = item1.clone();
			item2.setCollections([collection2.id]);
			yield item2.saveTx();

			yield merge(item1.id);
			
			// Items should be gone
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isTrue(item2.deleted);
			assert.isTrue(collection1.hasItem(item1.id));
			assert.isTrue(collection2.hasItem(item1.id));
		});

		it("should merge identical attachments based on file hash", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);

			await merge(item1.id);
			
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
		});

		it("should merge one attachment per item into the master attachment", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);

			let item3 = item1.clone();
			await item3.saveTx();
			let attachment3 = await importPDFAttachment(item3);

			await merge(item1.id);
			
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(iv.getRowIndexByID(item3.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
			assert.isTrue(item3.deleted);
			assert.isTrue(attachment3.deleted);
		});

		it("should merge identical attachments based on content hash", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('duplicatesMerge_test_new_md5.pdf', { parentItemID: item2.id });

			assert.equal(await attachment1.attachmentText, await attachment2.attachmentText);
			assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);

			await merge(item1.id);
			
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
		});

		it("shouldn't merge based on content hash when files are empty", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('empty.pdf', { parentItemID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('duplicatesMerge_empty_new_md5.pdf', { parentItemID: item2.id });

			assert.equal(await attachment1.attachmentText, await attachment2.attachmentText);
			assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);
			assert.isEmpty(await attachment1.attachmentText);

			await merge(item1.id);
			
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
		});

		it("should allow small differences when hashing content", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('duplicatesMerge_JSTOR_1.pdf', { parentItemID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('duplicatesMerge_JSTOR_2.pdf', { parentItemID: item2.id });

			assert.notEqual(await attachment1.attachmentText, await attachment2.attachmentText);
			assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);
			assert.equal(
				(await Zotero.Items._hashAttachmentText(attachment1)).fromText,
				(await Zotero.Items._hashAttachmentText(attachment2)).fromText
			);

			await merge(item1.id);
			
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
		});

		it("should keep similar but not identical attachments separate", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('wonderland_short.pdf', { parentItemID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('wonderland_long.pdf', { parentItemID: item2.id });

			assert.notEqual(await attachment1.attachmentText, await attachment2.attachmentText);
			assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
		});

		it("should only match attachments one-to-one", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('wonderland_short_watermarked_1.pdf', { parentItemID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('wonderland_short_watermarked_2.pdf', { parentItemID: item2.id });
			let attachment3 = await importFileAttachment('wonderland_short_watermarked_2.pdf', { parentItemID: item2.id });

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			// Doesn't matter which got merged
			assert.isTrue((attachment2.deleted || attachment3.deleted) && !(attachment2.deleted && attachment3.deleted));
		});

		it("should copy annotations when merging", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);
			let annotation1 = await createAnnotation('note', attachment1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);
			let annotation2 = await createAnnotation('highlight', attachment2);
			let annotation2Note = await Zotero.EditorInstance.createNoteFromAnnotations([annotation2], item2.id);

			assert.include(annotation2Note.getNote(), attachment2.key);

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.isFalse(annotation1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
			assert.isFalse(annotation2.deleted);
			assert.equal(annotation1.parentItemID, attachment1.id);
			assert.equal(annotation2.parentItemID, attachment1.id);
			assert.notInclude(annotation2Note.getNote(), item2.key);
			assert.include(annotation2Note.getNote(), item1.key);
			assert.notInclude(annotation2Note.getNote(), attachment2.key);
			assert.include(annotation2Note.getNote(), attachment1.key);
		});

		it("should merge snapshots with the same title, even if URL differs", async function () {
			let content = getTestDataDirectory();
			content.append('snapshot');
			content.append('index.html');
			
			let snapshotContent = await Zotero.File.getContentsAsync(content);
			
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await Zotero.Attachments.importFromSnapshotContent({
				parentItemID: item1.id,
				url: 'https://example.com/test.html',
				title: 'Snapshot',
				snapshotContent
			});

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await Zotero.Attachments.importFromSnapshotContent({
				parentItemID: item2.id,
				url: 'https://otherdomain.example.com/test.html',
				title: 'Snapshot',
				snapshotContent
			});

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 1);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
		});

		it("should merge linked URLs", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Catalog Entry',
				parentItemID: item1.id
			});

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Catalog Entry',
				parentItemID: item2.id
			});
			let attachment3 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Catalog Entry',
				parentItemID: item2.id
			});

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(attachment1.getField('url'), 'https://example.com/');
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isTrue(attachment2.deleted);
			assert.equal(attachment3.parentItemID, item1.id);
			assert.isFalse(attachment3.deleted);
		});

		it("should keep web attachment with same URL but different title", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Catalog Entry',
				parentItemID: item1.id
			});

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Official Website',
				parentItemID: item2.id
			});
			let attachment3 = await Zotero.Attachments.linkFromURL({
				url: 'https://example.com/',
				title: 'Catalog Entry',
				parentItemID: item2.id
			});

			await merge(item1.id);

			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(attachment1.getField('url'), 'https://example.com/');
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.equal(attachment2.parentItemID, item1.id);
			assert.isFalse(attachment2.deleted);
			assert.isTrue(attachment3.deleted);
		});
	});
});
