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
					'B ' + Zotero.getString('general.and') + ' D',
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
					'D ' + Zotero.getString('general.and') + ' H',
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
	});
});
