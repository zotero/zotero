describe("Item merging", function () {
	var mergeItems;
	
	before(() => {
		({ mergeItems } = ChromeUtils.importESModule("chrome://zotero/content/mergeItems.mjs"));
	});
	
	it("should merge two items", async function () {
		var item1 = await createDataObject('item');
		var item2 = await createDataObject('item');
		var item2URI = Zotero.URI.getItemURI(item2);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isTrue(item2.deleted);

		// Check for merge-tracking relation
		assert.isFalse(item1.hasChanged());
		var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 1);
		assert.equal(rels[0], item2URI);
	});

	it("should merge three items", async function () {
		var item1 = await createDataObject('item');
		var item2 = await createDataObject('item');
		var item3 = await createDataObject('item');
		var item2URI = Zotero.URI.getItemURI(item2);
		var item3URI = Zotero.URI.getItemURI(item3);

		await mergeItems(item1, [item2, item3]);

		assert.isFalse(item1.deleted);
		assert.isTrue(item2.deleted);
		assert.isTrue(item3.deleted);

		// Check for merge-tracking relation
		assert.isFalse(item1.hasChanged());
		var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 2);
		assert.sameMembers(rels, [item2URI, item3URI]);
	});

	it("should use the earliest Date Added", async function () {
		var item1 = await createDataObject('item', { dateAdded: '2019-01-02 00:00:00' });
		var item2 = await createDataObject('item', { dateAdded: '2019-01-01 00:00:00' });
		var item3 = await createDataObject('item', { dateAdded: '2019-01-03 00:00:00' });

		await mergeItems(item1, [item2, item3]);
		assert.equal(item1.dateAdded, '2019-01-01 00:00:00');
	});

	it("should keep automatic tag on non-master item as automatic", async function () {
		var item1 = await createDataObject('item', { tags: [{ tag: 'A' }] });
		var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
		await mergeItems(item1, [item2]);
		var tags = item1.getTags();
		var tag = tags.find(x => x.tag == 'B');
		assert.propertyVal(tag, 'type', 1);
	});

	it("should skip automatic tag on non-master item that exists as manual tag on master", async function () {
		var item1 = await createDataObject('item', { tags: [{ tag: 'A' }, { tag: 'B' }] });
		var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
		await mergeItems(item1, [item2]);
		var tags = item1.getTags();
		var tag = tags.find(x => x.tag == 'B');
		assert.notProperty(tag, 'type');
	});

	it("should keep automatic tag on master if it also exists on non-master item", async function () {
		var item1 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
		var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
		await mergeItems(item1, [item2]);
		var tags = item1.getTags();
		assert.propertyVal(tags[0], 'type', 1);
	});

	it("should merge two items when servant is linked to an item absent from cache", async function () {
		// two group libraries
		var groupOneInfo = await createGroup({
			id: 25026,
			name: "Group One"
		});
		var libraryOneID = Zotero.Groups.getLibraryIDFromGroupID(groupOneInfo.id);

		var groupTwoInfo = await createGroup({
			id: 11592,
			name: "Group Two"
		});
		var libraryTwoID = Zotero.Groups.getLibraryIDFromGroupID(groupTwoInfo.id);

		assert.notEqual(libraryOneID, libraryTwoID);

		// two items in the first library
		var item1 = await createDataObject('item', { libraryID: libraryOneID });
		var item2 = await createDataObject('item', { libraryID: libraryOneID });
		var item2URI = Zotero.URI.getItemURI(item2);

		// one item in the second library, linked to item2 as if it dragged and dropped from it
		var itemX = await createDataObject('item', { libraryID: libraryTwoID });
		await itemX.addLinkedItem(item2);

		// check that the owl:sameAs relation has been registered okay
		var rels = itemX.getRelationsByPredicate(Zotero.Relations.linkedObjectPredicate);
		assert.lengthOf(rels, 1);
		assert.equal(rels[0], item2URI);

		// the freshly minted item is in objectCache, but it might be absent in production,
		// so we clobber it in this test
		assert(!!Zotero.Items._objectCache[itemX.id], "itemX is in object cache");
		delete Zotero.Items._objectCache[itemX.id];

		// merge the two items in the first library
		await mergeItems(item1, [item2]);

		// check that the merge completed okay
		assert.isFalse(item1.deleted);
		assert.isTrue(item2.deleted);

		// Check for merge-tracking relation
		assert.isFalse(item1.hasChanged());
		var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 1);
		assert.equal(rels[0], item2URI);
	});

	it("should move merge-tracking relation from replaced item to master", async function () {
		var item1 = await createDataObject('item');
		var item2 = await createDataObject('item');
		var item2URI = Zotero.URI.getItemURI(item2);
		var item3 = await createDataObject('item');
		var item3URI = Zotero.URI.getItemURI(item3);

		await mergeItems(item2, [item3]);
		await mergeItems(item1, [item2]);

		// Check for merge-tracking relation from 1 to 3
		var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 2);
		assert.sameMembers(rels, [item2URI, item3URI]);
	});

	// Same as test in itemPaneTest, but without the UI
	it("should transfer merge-tracking relations when merging two pairs into one item", async function () {
		var item1 = await createDataObject('item', { title: 'A' });
		var item2 = await createDataObject('item', { title: 'B' });
		var item3 = await createDataObject('item', { title: 'C' });
		var item4 = await createDataObject('item', { title: 'D' });

		var uris = [item2, item3, item4].map(item => Zotero.URI.getItemURI(item));

		await mergeItems(item1, [item2]);
		await mergeItems(item3, [item4]);

		await mergeItems(item1, [item3]);

		// Remaining item should include all other URIs
		assert.sameMembers(
			item1.getRelations()[Zotero.Relations.replacedItemPredicate],
			uris
		);
	});

	it("should update relations pointing to replaced item to point to master", async function () {
		var item1 = await createDataObject('item');
		var item1URI = Zotero.URI.getItemURI(item1);
		var item2 = await createDataObject('item');
		var item2URI = Zotero.URI.getItemURI(item2);
		var item3 = createUnsavedDataObject('item');
		var predicate = Zotero.Relations.relatedItemPredicate;
		item3.addRelation(predicate, item2URI);
		await item3.saveTx();

		await mergeItems(item1, [item2]);

		// Check for related-item relation from 3 to 1
		var rels = item3.getRelationsByPredicate(predicate);
		assert.deepEqual(rels, [item1URI]);
	});

	it("should not update relations pointing to replaced item in other libraries", async function () {
		var group1 = await createGroup();
		var group2 = await createGroup();

		var item1 = await createDataObject('item', { libraryID: group1.libraryID });
		var item1URI = Zotero.URI.getItemURI(item1);
		var item2 = await createDataObject('item', { libraryID: group1.libraryID });
		var item2URI = Zotero.URI.getItemURI(item2);
		var item3 = createUnsavedDataObject('item', { libraryID: group2.libraryID });
		var predicate = Zotero.Relations.linkedObjectPredicate;
		item3.addRelation(predicate, item2URI);
		await item3.saveTx();

		await mergeItems(item1, [item2]);

		// Check for related-item relation from 3 to 2
		var rels = item3.getRelationsByPredicate(predicate);
		assert.deepEqual(rels, [item2URI]);
	});

	it("should merge identical attachments based on file hash", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);

		await mergeItems(item1, [item2]);

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

		await mergeItems(item1, [item2, item3]);

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

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("should merge identical attachments based on content hash when unindexed", async function () {
		let item1 = await createDataObject('item');
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_test_new_md5.pdf', { parentItemID: item2.id });

		await Zotero.DB.executeTransaction(async () => {
			await Zotero.FullText.clearItemWords(attachment1.id);
			await Zotero.FullText.clearItemWords(attachment2.id);
		});

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("shouldn't merge attachments based on content hash when files are empty", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('empty.pdf', { parentItemID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_empty_new_md5.pdf', { parentItemID: item2.id });

		assert.equal(await attachment1.attachmentText, await attachment2.attachmentText);
		assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);
		assert.isEmpty(await attachment1.attachmentText);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
	});

	it("should ignore PDF attachment with missing file", async function () {
		let item1 = await createDataObject('item');
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);
		// Delete the attachment file
		await OS.File.remove(await attachment2.getFilePathAsync());

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
	});

	it("should allow small differences when hashing content", async function () {
		let { hashAttachmentText } = ChromeUtils.importESModule("chrome://zotero/content/mergeItems.mjs");

		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('duplicatesMerge_JSTOR_1.pdf', { parentItemID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_JSTOR_2.pdf', { parentItemID: item2.id });

		assert.notEqual(await attachment1.attachmentText, await attachment2.attachmentText);
		assert.notEqual(await attachment1.attachmentHash, await attachment2.attachmentHash);
		assert.equal(
			(await hashAttachmentText(attachment1)).fromText,
			(await hashAttachmentText(attachment2)).fromText
		);

		await mergeItems(item1, [item2]);

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

		await mergeItems(item1, [item2]);

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

		await mergeItems(item1, [item2]);

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
		let annotation2Note = await Zotero.EditorInstance.createNoteFromAnnotations([annotation2], { parentID: item2.id });

		assert.include(annotation2Note.getNote(), attachment2.key);

		await mergeItems(item1, [item2]);

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

	it("should merge attachments in group library with annotation created by another user", async function () {
		var otherUserID = 92624235;
		await Zotero.Users.setName(otherUserID, 'merged-annotation-user');

		let group = await createGroup();
		let item1 = await createDataObject('item', { libraryID: group.libraryID });
		let attachment1 = await importPDFAttachment(item1);
		let annotation1 = await createAnnotation('note', attachment1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);
		let annotation2 = await createAnnotation('highlight', attachment2, { createdByUserID: otherUserID });

		await mergeItems(item1, [item2]);

		assert.equal(annotation2.parentItemID, attachment1.id);
		assert.equal(annotation2.createdByUserID, otherUserID);
	});

	it("should update all item keys when moving notes", async function () {
		let attachmentFilenames = [
			'recognizePDF_test_arXiv.pdf',
			'recognizePDF_test_DOI.pdf',
			'recognizePDF_test_title.pdf'
		];

		let item1 = await createDataObject('item', { setTitle: true });
		let attachments1 = [];
		for (let filename of attachmentFilenames) {
			let attachment = await importFileAttachment(filename, { parentID: item1.id });
			attachments1.push(attachment);
		}

		let item2 = item1.clone();
		await item2.saveTx();
		let attachments2 = [];
		let annotations2 = [];
		let notes2 = [];
		for (let filename of attachmentFilenames) {
			let attachment = await importFileAttachment(filename, { parentID: item2.id });
			let annotation = await createAnnotation('highlight', attachment);
			let note = await Zotero.EditorInstance.createNoteFromAnnotations([annotation], { parentID: item2.id });
			attachments2.push(attachment);
			annotations2.push(annotation);
			notes2.push(note);

			assert.include(note.getNote(), item2.key);
			assert.include(note.getNote(), attachment.key);
		}

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.equal(item1.numAttachments(true), 3);
		assert.isTrue(item2.deleted);

		for (let i = 0; i < 3; i++) {
			let attachment1 = attachments1[i];
			let attachment2 = attachments2[i];
			let note = notes2[i];

			assert.equal(note.parentItemID, item1.id);
			assert.include(note.getNote(), item1.key);
			assert.notInclude(note.getNote(), item2.key);
			assert.include(note.getNote(), attachment1.key);
			assert.notInclude(note.getNote(), attachment2.key);
		}
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

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("should keep a non-master snapshot that matches a trashed master snapshot", async function () {
		let item1 = await createDataObject('item');
		let attachment1 = await importSnapshotAttachment(item1);
		attachment1.deleted = true;
		await attachment1.saveTx();

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importSnapshotAttachment(item2);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isTrue(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
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

		await mergeItems(item1, [item2]);

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

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(attachment1.getField('url'), 'https://example.com/');
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
		assert.isFalse(attachment2.deleted);
		assert.isTrue(attachment3.deleted);
	});

	it("should keep only snapshot that exists when merging non-master snapshot (missing) with equivalent master snapshot (exists)", async function () {
		let item1 = await createDataObject('item');
		let file = getTestDataDirectory();
		file.append('test.html');
		let attachment1 = await importSnapshotAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importSnapshotAttachment(item2);
		// Delete the second attachment file
		await OS.File.remove(await attachment2.getFilePathAsync());

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.isTrue(await IOUtils.exists(await attachment1.getFilePathAsync()));
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("should both snapshots when merging non-master snapshot (exists) with equivalent master snapshot (missing)", async function () {
		let item1 = await createDataObject('item');
		let file = getTestDataDirectory();
		file.append('test.html');
		let attachment1 = await importSnapshotAttachment(item1);
		// Delete the first attachment file
		await OS.File.remove(await attachment1.getFilePathAsync());

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importSnapshotAttachment(item2);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.isTrue(await IOUtils.exists(await attachment2.getFilePathAsync()));
	});

	it("should move related items of merged attachments", async function () {
		let relatedItem = await createDataObject('item');

		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);
		attachment2.addRelatedItem(relatedItem);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
		assert.lengthOf(attachment1.relatedItems, 1);
		assert.equal(attachment1.relatedItems[0], relatedItem.key);
	});

	it("should move merge-tracking relation from replaced attachment to master attachment", async function () {
		let item1 = await createDataObject('item');
		let attachment1 = await importPDFAttachment(item1);

		let item2 = await createDataObject('item');
		let attachment2 = await importPDFAttachment(item2);
		let attachment2URI = Zotero.URI.getItemURI(attachment2);

		let item3 = await createDataObject('item');
		let attachment3 = await importPDFAttachment(item3);
		let attachment3URI = Zotero.URI.getItemURI(attachment3);

		await mergeItems(item2, [item3]);
		await mergeItems(item1, [item2]);

		var rels = attachment1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 2);
		assert.sameMembers(rels, [attachment2URI, attachment3URI]);
	});

	it("should not merge attachments with different content types", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);
		attachment2.attachmentContentType = 'text/plain';
		await attachment2.saveTx();

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
	});

	it("should merge two stored-file attachments with different link modes", async function () {
		let file = getTestDataDirectory();
		file.append('test.pdf');

		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);
		attachment1.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
		await attachment1.saveTx();

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("should not merge attachments with different link mode types", async function () {
		let file = getTestDataDirectory();
		file.append('test.pdf');

		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await Zotero.Attachments.linkFromFile({
			file,
			parentItemID: item1.id
		});

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);

		await mergeItems(item1, [item2]);

		assert.equal(await attachment1.attachmentHash, await attachment2.attachmentHash);
		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
	});

	it("should not merge an attachment with a deleted master attachment", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);
		attachment1.deleted = true;
		await attachment1.saveTx();

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isTrue(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
	});

	it("should move but not merge a trashed non-master PDF attachment", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importPDFAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importPDFAttachment(item2);
		let annotation = await createAnnotation('highlight', attachment2);
		attachment2.deleted = true;
		await attachment2.saveTx();

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.isTrue(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		// Annotation should not have been moved to attachment1
		assert.equal(annotation.parentItemID, attachment2.id);
	});

	it("should move but not merge a trashed non-master snapshot", async function () {
		let item1 = await createDataObject('item');
		let attachment1 = await importSnapshotAttachment(item1);

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importSnapshotAttachment(item2);
		attachment2.deleted = true;
		await attachment2.saveTx();

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.isTrue(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		// No replaced-item relation should have been added
		let rels = attachment1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
		assert.lengthOf(rels, 0);
	});

	it("should move a trashed non-master non-PDF/non-web attachment", async function () {
		let item1 = await createDataObject('item');

		let item2 = await createDataObject('item');
		let attachment = await importPDFAttachment(item2);
		attachment.attachmentContentType = 'text/plain';
		attachment.deleted = true;
		await attachment.saveTx();

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isTrue(attachment.deleted);
		assert.equal(attachment.parentItemID, item1.id);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
	});

	it("should not merge two matching PDF attachments with embedded annotations", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_annotated_2.pdf', { parentID: item2.id });

		// Import external annotations non-destructively
		await Zotero.PDFWorker.import(attachment1.id, true);
		await Zotero.PDFWorker.import(attachment2.id, true);

		assert.lengthOf(attachment1.getAnnotations(), 1);
		assert.lengthOf(attachment2.getAnnotations(), 1);
		assert.isTrue(attachment1.getAnnotations()[0].annotationIsExternal);
		assert.isTrue(attachment2.getAnnotations()[0].annotationIsExternal);
		assert.isTrue(await attachment2.hasEmbeddedAnnotations()); // Unsupported attachment remains embedded

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 2);
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);

		assert.lengthOf(attachment1.getAnnotations(), 1);
		assert.lengthOf(attachment2.getAnnotations(), 1);
		assert.isTrue(attachment1.getAnnotations()[0].annotationIsExternal);
		assert.isTrue(attachment2.getAnnotations()[0].annotationIsExternal);
	});

	it("should merge imported annotations into PDF with remaining unimported annotations", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_annotated_2.pdf', { parentID: item2.id });

		// Import external annotations non-destructively
		await Zotero.PDFWorker.import(attachment1.id, true);
		await Zotero.PDFWorker.import(attachment2.id, true);

		assert.isTrue(attachment1.getAnnotations()[0].annotationIsExternal);
		assert.isTrue(attachment2.getAnnotations()[0].annotationIsExternal);

		// Import external annotations *destructively*
		await Zotero.PDFWorker.import(attachment1.id, true, '', true);
		await Zotero.PDFWorker.import(attachment2.id, true, '', true);

		assert.lengthOf(attachment1.getAnnotations(), 1);
		assert.lengthOf(attachment2.getAnnotations(), 1);
		assert.isFalse(attachment1.getAnnotations()[0].annotationIsExternal);
		assert.isFalse(attachment2.getAnnotations()[0].annotationIsExternal);
		assert.isTrue(await attachment2.hasEmbeddedAnnotations()); // Unsupported annotation remains embedded

		await mergeItems(item1, [item2]);

		assert.isTrue(attachment1.deleted);
		assert.isFalse(attachment2.deleted);

		assert.lengthOf(attachment1.getAnnotations(), 0);
		assert.lengthOf(attachment2.getAnnotations(), 2);
		assert.isFalse(attachment2.getAnnotations()[0].annotationIsExternal);
		assert.isFalse(attachment2.getAnnotations()[1].annotationIsExternal);
	});

	it("should merge a non-master PDF without embedded annotations into a master PDF with embedded annotations", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_notAnnotated.pdf', { parentID: item2.id });

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isFalse(attachment1.deleted);
		assert.equal(item1.numAttachments(true), 1);
		assert.isTrue(item2.deleted);
		assert.isTrue(attachment2.deleted);
	});

	it("should merge a master PDF without embedded annotations into a non-master PDF with embedded annotations", async function () {
		let item1 = await createDataObject('item', { setTitle: true });
		let attachment1 = await importFileAttachment('duplicatesMerge_notAnnotated.pdf', { parentID: item1.id });

		let item2 = item1.clone();
		await item2.saveTx();
		let attachment2 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item2.id });

		await mergeItems(item1, [item2]);

		assert.isFalse(item1.deleted);
		assert.isTrue(attachment1.deleted);
		assert.equal(item1.numAttachments(false), 1); // Don't count the deleted attachment
		assert.isTrue(item2.deleted);
		assert.isFalse(attachment2.deleted);
		assert.equal(attachment2.parentItemID, item1.id);
	});
});
