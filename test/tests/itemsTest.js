describe("Zotero.Items", function () {
	var win, collectionsView, zp;
	
	before(function* () {
		this.timeout(10000);
		win = yield loadZoteroPane();
		collectionsView = win.ZoteroPane.collectionsView;
		zp = win.ZoteroPane;
	})
	beforeEach(function () {
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	})
	
	
	describe("#addToPublications", function () {
		it("should add an item to My Publications", function* () {
			var item = yield createDataObject('item');
			yield Zotero.Items.addToPublications([item]);
			assert.isTrue(item.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id)),
				1
			);
		});
		
		describe("#license", function () {
			it("should set a license if specified", function* () {
				var item = createUnsavedDataObject('item');
				item.setField('rights', 'Test');
				yield item.saveTx();
				yield Zotero.Items.addToPublications(
					[item],
					{
						license: 'reserved',
						licenseName: 'All Rights Reserved',
						keepRights: false
					}
				);
				assert.equal(item.getField('rights'), 'All Rights Reserved');
			});
			
			it("should keep existing Rights field if .keepRights is true", function* () {
				var item1 = createUnsavedDataObject('item');
				item1.setField('rights', 'Test');
				yield item1.saveTx();
				var item2 = yield createDataObject('item');
				yield Zotero.Items.addToPublications(
					[item1, item2],
					{
						license: 'reserved',
						licenseName: 'All Rights Reserved',
						keepRights: true
					}
				);
				assert.equal(item1.getField('rights'), 'Test');
				assert.equal(item2.getField('rights'), 'All Rights Reserved');
			});
			
			it("shouldn't set a license if not specified", function* () {
				var item = createUnsavedDataObject('item');
				item.setField('rights', 'Test');
				yield item.saveTx();
				yield Zotero.Items.addToPublications([item]);
				assert.equal(item.getField('rights'), 'Test');
			});
		});
		
		it("should add child notes if .childNotes is true", function* () {
			var item = yield createDataObject('item');
			var note = yield createDataObject('item', { itemType: 'note', parentID: item.id });
			var attachment = yield Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			
			yield Zotero.Items.addToPublications([item], { childNotes: true });
			assert.isTrue(note.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", note.id)),
				1
			);
			assert.isFalse(attachment.inPublications);
		});
		
		it("should add child link attachments if .childLinks is true", function* () {
			var item = yield createDataObject('item');
			var attachment1 = yield Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			var attachment2 = yield importFileAttachment('test.png', { parentItemID: item.id });
			var note = yield createDataObject('item', { itemType: 'note', parentID: item.id });
			
			yield Zotero.Items.addToPublications([item], { childLinks: true });
			assert.isTrue(attachment1.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", attachment1.id)),
				1
			);
			assert.isFalse(attachment2.inPublications);
			assert.isFalse(note.inPublications);
		});
		
		it("should add child file attachments if .childFileAttachments is true", function* () {
			var item = yield createDataObject('item');
			var attachment1 = yield importFileAttachment('test.png', { parentItemID: item.id });
			var attachment2 = yield Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			var note = yield createDataObject('item', { itemType: 'note', parentID: item.id });
			
			yield Zotero.Items.addToPublications([item], { childFileAttachments: true });
			assert.isTrue(attachment1.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", attachment1.id)),
				1
			);
			assert.isFalse(attachment2.inPublications);
			assert.isFalse(note.inPublications);
		});
	});
	
	
	describe("#removeFromPublications", function () {
		it("should remove an item from My Publications", function* () {
			var item = yield createDataObject('item');
			item.inPublications = true;
			yield item.saveTx();
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id)),
				1
			);
			yield Zotero.Items.removeFromPublications([item]);
			assert.isFalse(item.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id)),
				0
			);
		});
	});
	
	
	describe("#copyChildItems()", function () {
		var group;
		
		before(async function () {
			group = await createGroup();
		});
		
		after(async function () {
			await group.eraseTx();
		});
		
		it("should copy annotations from a group library to a personal library", async function () {
			await Zotero.Users.setCurrentUserID(1);
			await Zotero.Users.setName(1, 'Name 1');
			await Zotero.Users.setName(12345, 'Name 2');
			
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var item = await createDataObject('item', { libraryID: group.libraryID });
			var file = getTestDataDirectory();
			file.append('test.pdf');
			var attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			// Annotation by this user
			var annotation1 = await createAnnotation('highlight', attachment);
			await annotation1.saveTx();
			// Annotation by this user with createdByUserID set
			var annotation2 = await createAnnotation('highlight', attachment);
			annotation2.createdByUserID = 1;
			await annotation2.saveTx({
				skipEditCheck: true
			});
			// Annotation by another user
			var annotation3 = await createAnnotation('highlight', attachment);
			annotation3.createdByUserID = 12345;
			await annotation3.saveTx({
				skipEditCheck: true
			});
			
			var newItem = item.clone(userLibraryID);
			await newItem.saveTx();
			var newAttachment = attachment.clone(userLibraryID);
			await newAttachment.saveTx();
			
			await Zotero.DB.executeTransaction(async function () {
				await Zotero.Items.copyChildItems(attachment, newAttachment);
			});
			
			// Check annotations
			var annotations = newAttachment.getAnnotations();
			assert.lengthOf(annotations, 3);
			var newAnnotation1 = annotations.find(o => o.annotationText == annotation1.annotationText);
			var newAnnotation2 = annotations.find(o => o.annotationText == annotation2.annotationText);
			var newAnnotation3 = annotations.find(o => o.annotationText == annotation3.annotationText);
			// Current user's name shouldn't have been transferred
			assert.isNull(newAnnotation1.annotationAuthorName);
			assert.isNull(newAnnotation2.annotationAuthorName);
			// Other user's should've been transferred
			assert.equal(newAnnotation3.annotationAuthorName, 'Name 2');
		});
	});
	
	
	describe("#merge()", function () {
		it("should merge two items", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			var item2URI = Zotero.URI.getItemURI(item2);
			
			yield Zotero.Items.merge(item1, [item2]);
			
			assert.isFalse(item1.deleted);
			assert.isTrue(item2.deleted);
			
			// Check for merge-tracking relation
			assert.isFalse(item1.hasChanged());
			var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
			assert.lengthOf(rels, 1);
			assert.equal(rels[0], item2URI);
		})
		
		it("should merge three items", async function () {
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item');
			var item3 = await createDataObject('item');
			var item2URI = Zotero.URI.getItemURI(item2);
			var item3URI = Zotero.URI.getItemURI(item3);
			
			await Zotero.Items.merge(item1, [item2, item3]);
			
			assert.isFalse(item1.deleted);
			assert.isTrue(item2.deleted);
			assert.isTrue(item3.deleted);
			
			// Check for merge-tracking relation
			assert.isFalse(item1.hasChanged());
			var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
			assert.lengthOf(rels, 2);
			assert.sameMembers(rels, [item2URI, item3URI]);
		})
		
		it("should use the earliest Date Added", async function () {
			var item1 = await createDataObject('item', { dateAdded: '2019-01-02 00:00:00' });
			var item2 = await createDataObject('item', { dateAdded: '2019-01-01 00:00:00' });
			var item3 = await createDataObject('item', { dateAdded: '2019-01-03 00:00:00' });
			
			await Zotero.Items.merge(item1, [item2, item3]);
			assert.equal(item1.dateAdded, '2019-01-01 00:00:00');
		});
		
		it("should keep automatic tag on non-master item as automatic", async function () {
			var item1 = await createDataObject('item', { tags: [{ tag: 'A' }] });
			var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
			await Zotero.Items.merge(item1, [item2]);
			var tags = item1.getTags();
			var tag = tags.find(x => x.tag == 'B');
			assert.propertyVal(tag, 'type', 1);
		});
		
		it("should skip automatic tag on non-master item that exists as manual tag on master", async function () {
			var item1 = await createDataObject('item', { tags: [{ tag: 'A' }, { tag: 'B' }] });
			var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
			await Zotero.Items.merge(item1, [item2]);
			var tags = item1.getTags();
			var tag = tags.find(x => x.tag == 'B');
			assert.notProperty(tag, 'type');
		});
		
		it("should keep automatic tag on master if it also exists on non-master item", async function () {
			var item1 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
			var item2 = await createDataObject('item', { tags: [{ tag: 'B', type: 1 }] });
			await Zotero.Items.merge(item1, [item2]);
			var tags = item1.getTags();
			assert.propertyVal(tags[0], 'type', 1);
		});
		
		it("should merge two items when servant is linked to an item absent from cache", function* () {
			// two group libraries
			var groupOneInfo = yield createGroup({
				id: 25026,
				name: "Group One"
			});
			var libraryOneID = Zotero.Groups.getLibraryIDFromGroupID(groupOneInfo.id);

			var groupTwoInfo = yield createGroup({
				id: 11592,
				name: "Group Two"
			});
			var libraryTwoID = Zotero.Groups.getLibraryIDFromGroupID(groupTwoInfo.id);

			assert.notEqual(libraryOneID, libraryTwoID);

			// two items in the first library
			var item1 = yield createDataObject('item', {libraryID: libraryOneID});
			var item2 = yield createDataObject('item', {libraryID: libraryOneID});
			var item2URI = Zotero.URI.getItemURI(item2);

			// one item in the second library, linked to item2 as if it dragged and dropped from it
			var itemX = yield createDataObject('item', {libraryID: libraryTwoID});
			yield itemX.addLinkedItem(item2);

			// check that the owl:sameAs relation has been registered okay
			var rels = itemX.getRelationsByPredicate(Zotero.Relations.linkedObjectPredicate);
			assert.lengthOf(rels, 1);
			assert.equal(rels[0], item2URI);

			// the freshly minted item is in objectCache, but it might be absent in production,
			// so we clobber it in this test
			assert(!!Zotero.Items._objectCache[itemX.id], "itemX is in object cache")
			delete Zotero.Items._objectCache[itemX.id];

			// merge the two items in the first library
			yield Zotero.Items.merge(item1, [item2]);

			// check that the merge completed okay
			assert.isFalse(item1.deleted);
			assert.isTrue(item2.deleted);

			// Check for merge-tracking relation
			assert.isFalse(item1.hasChanged());
			var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
			assert.lengthOf(rels, 1);
			assert.equal(rels[0], item2URI);
		})

		it("should move merge-tracking relation from replaced item to master", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			var item2URI = Zotero.URI.getItemURI(item2);
			var item3 = yield createDataObject('item');
			var item3URI = Zotero.URI.getItemURI(item3);
			
			yield Zotero.Items.merge(item2, [item3]);
			yield Zotero.Items.merge(item1, [item2]);
			
			// Check for merge-tracking relation from 1 to 3
			var rels = item1.getRelationsByPredicate(Zotero.Relations.replacedItemPredicate);
			assert.lengthOf(rels, 2);
			assert.sameMembers(rels, [item2URI, item3URI]);
		})
		
		// Same as test in itemPaneTest, but without the UI
		it("should transfer merge-tracking relations when merging two pairs into one item", async function () {
			var item1 = await createDataObject('item', { title: 'A' });
			var item2 = await createDataObject('item', { title: 'B' });
			var item3 = await createDataObject('item', { title: 'C' });
			var item4 = await createDataObject('item', { title: 'D' });
			
			var uris = [item2, item3, item4].map(item => Zotero.URI.getItemURI(item));
			
			await Zotero.Items.merge(item1, [item2]);
			await Zotero.Items.merge(item3, [item4]);
			
			await Zotero.Items.merge(item1, [item3]);
			
			// Remaining item should include all other URIs
			assert.sameMembers(
				item1.getRelations()[Zotero.Relations.replacedItemPredicate],
				uris
			);
		});
		
		it("should update relations pointing to replaced item to point to master", function* () {
			var item1 = yield createDataObject('item');
			var item1URI = Zotero.URI.getItemURI(item1);
			var item2 = yield createDataObject('item');
			var item2URI = Zotero.URI.getItemURI(item2);
			var item3 = createUnsavedDataObject('item');
			var predicate = Zotero.Relations.relatedItemPredicate;
			item3.addRelation(predicate, item2URI);
			yield item3.saveTx();
			
			yield Zotero.Items.merge(item1, [item2]);
			
			// Check for related-item relation from 3 to 1
			var rels = item3.getRelationsByPredicate(predicate);
			assert.deepEqual(rels, [item1URI]);
		})
		
		it("should not update relations pointing to replaced item in other libraries", function* () {
			var group1 = yield createGroup();
			var group2 = yield createGroup();
			
			var item1 = yield createDataObject('item', { libraryID: group1.libraryID });
			var item1URI = Zotero.URI.getItemURI(item1);
			var item2 = yield createDataObject('item', { libraryID: group1.libraryID });
			var item2URI = Zotero.URI.getItemURI(item2);
			var item3 = createUnsavedDataObject('item', { libraryID: group2.libraryID });
			var predicate = Zotero.Relations.linkedObjectPredicate;
			item3.addRelation(predicate, item2URI);
			yield item3.saveTx();
			
			yield Zotero.Items.merge(item1, [item2]);
			
			// Check for related-item relation from 3 to 2
			var rels = item3.getRelationsByPredicate(predicate);
			assert.deepEqual(rels, [item2URI]);
		})

		it("should merge identical attachments based on file hash", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);

			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2, item3]);

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

			await Zotero.Items.merge(item1, [item2]);
			
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
			
			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2]);
			
			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
		});
		
		it("should ignore attachment with missing file", async function () {
			let item1 = await createDataObject('item');
			let attachment1 = await importPDFAttachment(item1);
			
			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);
			// Delete the attachment file
			await OS.File.remove(await attachment2.getFilePathAsync());
			
			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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
			
			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(attachment1.getField('url'), 'https://example.com/');
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.equal(attachment2.parentItemID, item1.id);
			assert.isFalse(attachment2.deleted);
			assert.isTrue(attachment3.deleted);
		});

		it("should move related items of merged attachments", async function () {
			let relatedItem = await createDataObject('item');

			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importPDFAttachment(item1);

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importPDFAttachment(item2);
			attachment2.addRelatedItem(relatedItem);

			await Zotero.Items.merge(item1, [item2]);
			
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
			
			await Zotero.Items.merge(item2, [item3]);
			await Zotero.Items.merge(item1, [item2]);
			
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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

			assert.isFalse(item1.deleted);
			assert.isTrue(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
			assert.equal(attachment2.parentItemID, item1.id);
		});

		it("should not merge two matching PDF attachments with embedded annotations", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('duplicatesMerge_annotated_2.pdf', { parentID: item2.id });

			await Zotero.Items.merge(item1, [item2]);

			assert.isFalse(item1.deleted);
			assert.isFalse(attachment1.deleted);
			assert.equal(item1.numAttachments(true), 2);
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
			assert.equal(attachment2.parentItemID, item1.id);
		});

		it("should merge a non-master PDF without embedded annotations into a master PDF with embedded annotations", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let attachment1 = await importFileAttachment('duplicatesMerge_annotated_1.pdf', { parentID: item1.id });

			let item2 = item1.clone();
			await item2.saveTx();
			let attachment2 = await importFileAttachment('duplicatesMerge_notAnnotated.pdf', { parentID: item2.id });

			await Zotero.Items.merge(item1, [item2]);

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

			await Zotero.Items.merge(item1, [item2]);

			assert.isFalse(item1.deleted);
			assert.isTrue(attachment1.deleted);
			assert.equal(item1.numAttachments(false), 1); // Don't count the deleted attachment
			assert.isTrue(item2.deleted);
			assert.isFalse(attachment2.deleted);
			assert.equal(attachment2.parentItemID, item1.id);
		});
	})
	
	
	describe("#trash()", function () {
		it("should send items to the trash", function* () {
			var items = [];
			items.push(
				(yield createDataObject('item', { synced: true })),
				(yield createDataObject('item', { synced: true })),
				(yield createDataObject('item', { synced: true }))
			);
			items.forEach(item => {
				// Sanity-checked as true in itemTest#deleted
				assert.isUndefined(item._changed.deleted);
			});
			var ids = items.map(item => item.id);
			yield Zotero.Items.trashTx(ids);
			items.forEach(item => {
				assert.isTrue(item.deleted);
				// Item should be saved (can't use hasChanged() because that includes .synced)
				assert.isUndefined(item._changed.deleted);
				assert.isFalse(item.synced);
			});
			assert.equal((yield Zotero.DB.valueQueryAsync(
				`SELECT COUNT(*) FROM deletedItems WHERE itemID IN (${ids})`
			)), 3);
			for (let item of items) {
				assert.equal((yield Zotero.DB.valueQueryAsync(
					`SELECT synced FROM items WHERE itemID=${item.id}`
				)), 0);
			}
		});
		
		it("should update parent item when trashing child item", function* () {
			var item = yield createDataObject('item');
			var note = yield createDataObject('item', { itemType: 'note', parentID: item.id });
			assert.lengthOf(item.getNotes(), 1);
			yield Zotero.Items.trashTx([note.id]);
			assert.lengthOf(item.getNotes(), 0);
		});
	});
	
	
	describe("#emptyTrash()", function () {
		it("should delete items in the trash", function* () {
			var item1 = createUnsavedDataObject('item');
			item1.setField('title', 'a');
			item1.deleted = true;
			var id1 = yield item1.saveTx();
			
			var item2 = createUnsavedDataObject('item');
			item2.setField('title', 'b');
			item2.deleted = true;
			var id2 = yield item2.saveTx();
			
			var item3 = createUnsavedDataObject('item', { itemType: 'attachment', parentID: id2 });
			item3.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			item3.deleted = true;
			var id3 = yield item3.saveTx();
			
			yield collectionsView.selectTrash(Zotero.Libraries.userLibraryID);
			
			yield Zotero.Items.emptyTrash(Zotero.Libraries.userLibraryID);
			
			assert.isFalse(yield Zotero.Items.getAsync(id1));
			assert.isFalse(yield Zotero.Items.getAsync(id2));
			assert.isFalse(yield Zotero.Items.getAsync(id3));
			
			// TEMP: This is failing on Travis due to a race condition
			//assert.equal(zp.itemsView.rowCount, 0)
		})
	})
	
	describe("#getFirstCreatorFromData()", function () {
		it("should handle single eligible creator", function* () {
			for (let creatorType of ['author', 'editor', 'contributor']) {
				assert.equal(
					Zotero.Items.getFirstCreatorFromData(
						Zotero.ItemTypes.getID('book'),
						[
							{
								fieldMode: 0,
								firstName: 'A',
								lastName: 'B',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							}
						]
					),
					'B',
					creatorType
				);
			}
		});
		
		it("should ignore single ineligible creator", function* () {
			assert.strictEqual(
				Zotero.Items.getFirstCreatorFromData(
					Zotero.ItemTypes.getID('book'),
					[
						{
							fieldMode: 0,
							firstName: 'A',
							lastName: 'B',
							creatorTypeID: Zotero.CreatorTypes.getID('translator')
						}
					]
				),
				''
			);
		});
		
		it("should handle single eligible creator after ineligible creator", function* () {
			for (let creatorType of ['author', 'editor', 'contributor']) {
				assert.equal(
					Zotero.Items.getFirstCreatorFromData(
						Zotero.ItemTypes.getID('book'),
						[
							{
								fieldMode: 0,
								firstName: 'A',
								lastName: 'B',
								creatorTypeID: Zotero.CreatorTypes.getID('translator')
							},
							{
								fieldMode: 0,
								firstName: 'C',
								lastName: 'D',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							}
						]
					),
					'D',
					creatorType
				);
			}
		});
		
		it("should handle two eligible creators", function* () {
			for (let creatorType of ['author', 'editor', 'contributor']) {
				assert.equal(
					Zotero.Items.getFirstCreatorFromData(
						Zotero.ItemTypes.getID('book'),
						[
							{
								fieldMode: 0,
								firstName: 'A',
								lastName: 'B',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							},
							{
								fieldMode: 0,
								firstName: 'C',
								lastName: 'D',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							}
						]
					),
					Zotero.getString(
						'general.andJoiner',
						['\u2068' + 'B' + '\u2069', '\u2068' + 'D' + '\u2069']
					),
					creatorType
				);
			}
		});
		
		it("should handle three eligible creators", function* () {
			for (let creatorType of ['author', 'editor', 'contributor']) {
				assert.equal(
					Zotero.Items.getFirstCreatorFromData(
						Zotero.ItemTypes.getID('book'),
						[
							{
								fieldMode: 0,
								firstName: 'A',
								lastName: 'B',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							},
							{
								fieldMode: 0,
								firstName: 'C',
								lastName: 'D',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							},
							{
								fieldMode: 0,
								firstName: 'E',
								lastName: 'F',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							}
						]
					),
					'B ' + Zotero.getString('general.etAl'),
					creatorType
				);
			}
		});
		
		it("should handle two eligible creators with intervening creators", function* () {
			for (let creatorType of ['author', 'editor', 'contributor']) {
				assert.equal(
					Zotero.Items.getFirstCreatorFromData(
						Zotero.ItemTypes.getID('book'),
						[
							{
								fieldMode: 0,
								firstName: 'A',
								lastName: 'B',
								creatorTypeID: Zotero.CreatorTypes.getID('translator')
							},
							{
								fieldMode: 0,
								firstName: 'C',
								lastName: 'D',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							},
							{
								fieldMode: 0,
								firstName: 'E',
								lastName: 'F',
								creatorTypeID: Zotero.CreatorTypes.getID('translator')
							},
							{
								fieldMode: 0,
								firstName: 'G',
								lastName: 'H',
								creatorTypeID: Zotero.CreatorTypes.getID(creatorType)
							}
						]
					),
					Zotero.getString(
						'general.andJoiner',
						['\u2068' + 'D' + '\u2069', '\u2068' + 'H' + '\u2069']
					),
					creatorType
				);
			}
		});
	});
	
	describe("#getAsync()", function() {
		it("should return Zotero.Item for item ID", function* () {
			let item = new Zotero.Item('journalArticle');
			let id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			assert.notOk(item.isFeedItem);
			assert.instanceOf(item, Zotero.Item);
			assert.notInstanceOf(item, Zotero.FeedItem);
		});
		it("should return Zotero.FeedItem for feed item ID", function* () {
			let feed = new Zotero.Feed({ name: 'foo', url: 'http://www.' + Zotero.randomString() + '.com' });
			yield feed.saveTx();
			
			let feedItem = new Zotero.FeedItem('journalArticle', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			let id = yield feedItem.saveTx();
			
			feedItem = yield Zotero.Items.getAsync(id);
			
			assert.isTrue(feedItem.isFeedItem);
			assert.instanceOf(feedItem, Zotero.FeedItem);
		});
	});
	
	describe("#keepParents()", function () {
		it("should remove child items of passed items", async function () {
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var item3 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var item4 = await createDataObject('item');
			var item5 = await createDataObject('item', { itemType: 'note', parentItemID: item4.id });
			var otherItem = await createDataObject('item');
			var item6 = await createDataObject('item', { itemType: 'note', parentItemID: otherItem.id });
			
			var items = Zotero.Items.keepParents([item1, item2, item3, item4, item5, item6]);
			assert.sameMembers(
				// Convert to ids for clearer output
				items.map(item => item.id),
				[item1, item4, item6].map(item => item.id)
			);
		});
		
		it("shouldn't return parent item more than once when two child items are selected", async function () {
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var item3 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var items = Zotero.Items.keepParents([item2, item3]);
			assert.sameMembers(
				items.map(item => item.id),
				[item2.id, item3.id]
			)
		});
	});
	
	describe("#_loadChildItems()", function () {
		it("should mark child items as loaded for an attachment", async function () {
			var attachment = await importPDFAttachment();
			var itemID = attachment.id;
			Zotero.Items.unload([itemID]);
			attachment = await Zotero.Items.getAsync(itemID);
			await attachment.loadDataType('childItems');
			assert.isTrue(attachment._loaded.childItems);
			attachment.getAnnotations();
			await attachment.eraseTx();
		});
	});

	describe("#getSortTitle()", function () {
		it("should strip recognized markup tags", function () {
			let tests = [
				['A title <i>in italics</i>', 'A title in italics'],
				['An unmatched </b> tag', 'An unmatched  tag'],
				['A <sup>title</sub> with mismatched tags', 'A title with mismatched tags'],
				['A title with a valid <span style="font-variant:small-caps;">span</span>', 'A title with a valid span'],
				['Another title with a valid <span class="nocase">span</span>', 'Another title with a valid span'],
				['A random <span>span tag</span>', 'A random <span>span tag']
			];

			for (let [input, expected] of tests) {
				assert.equal(Zotero.Items.getSortTitle(input), expected);
			}
		});

		it("should strip any punctuation at the beginning of the string besides @, #, and *", function () {
			let tests = [
				['_title', 'title'],
				['-title', 'title'],
				['-- longer title', 'longer title'],
				['-_ longer title with different second character', '_ longer title with different second character'],
				['"Quoted title', 'Quoted title'],
				['@zotero on Twitter', '@zotero on Twitter'],
				['#hashtag', '#hashtag'],
				['*special', '*special'],
				['**repeated', '**repeated']
			];

			for (let [input, expected] of tests) {
				assert.equal(Zotero.Items.getSortTitle(input), expected);
			}
		});

		it("should not strip dashes in the middle of the string", function () {
			let tests = [
				['123-456', '123-456'],
				['Meyers-Briggs', 'Meyers-Briggs'],
				['En–dash', 'En–dash'],
				['Em—dash', 'Em—dash']
			];

			for (let [input, expected] of tests) {
				assert.equal(Zotero.Items.getSortTitle(input), expected);
			}
		});

		it("should strip opening punctuation after string-initial punctuation", function () {
			let tests = [
				['.[Test]', 'Test]'],
				['"❮Word❯"', 'Word❯"'],
				['"@": The Musical', '@": The Musical'],
			];

			for (let [input, expected] of tests) {
				assert.equal(Zotero.Items.getSortTitle(input), expected);
			}
		});

		it("should sort titles with special characters correctly", function () {
			let tests = [
				[
					['A*B*@!@C*D 1', 'ABCD 2', 'A*B*@!@C*D 3', 'ABCD 4'],
					['A*B*@!@C*D 1', 'A*B*@!@C*D 3', 'ABCD 2', 'ABCD 4']
				],
				[
					['Why? Volume 1', 'Why! Volume 1', 'Why! Volume 2', 'Why? Volume 2'],
					['Why! Volume 1', 'Why! Volume 2', 'Why? Volume 1', 'Why? Volume 2']
				],
				[
					['Sign and symbol', '"@" Sign. Its accidental history.', 'Sign language'],
					['"@" Sign. Its accidental history.', 'Sign and symbol', 'Sign language']
				],
			];

			let st = Zotero.Items.getSortTitle;
			let collation = Zotero.getLocaleCollation();
			for (let [input, expected] of tests) {
				input.sort((a, b) => collation.compareString(1, st(a), st(b)));
				assert.deepEqual(input, expected);
			}
		});
	});
});
