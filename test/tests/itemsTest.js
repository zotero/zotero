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
		it("should add an item to My Publications", async function () {
			var item = await createDataObject('item');
			await Zotero.Items.addToPublications([item]);
			assert.isTrue(item.inPublications);
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id))),
				1
			);
		});
		
		describe("#license", function () {
			it("should set a license if specified", async function () {
				var item = createUnsavedDataObject('item');
				item.setField('rights', 'Test');
				await item.saveTx();
				await Zotero.Items.addToPublications(
					[item],
					{
						license: 'reserved',
						licenseName: 'All Rights Reserved',
						keepRights: false
					}
				);
				assert.equal(item.getField('rights'), 'All Rights Reserved');
			});
			
			it("should keep existing Rights field if .keepRights is true", async function () {
				var item1 = createUnsavedDataObject('item');
				item1.setField('rights', 'Test');
				await item1.saveTx();
				var item2 = await createDataObject('item');
				await Zotero.Items.addToPublications(
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
			
			it("shouldn't set a license if not specified", async function () {
				var item = createUnsavedDataObject('item');
				item.setField('rights', 'Test');
				await item.saveTx();
				await Zotero.Items.addToPublications([item]);
				assert.equal(item.getField('rights'), 'Test');
			});
		});
		
		it("should add child notes if .childNotes is true", async function () {
			var item = await createDataObject('item');
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			var attachment = await Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			
			await Zotero.Items.addToPublications([item], { childNotes: true });
			assert.isTrue(note.inPublications);
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", note.id))),
				1
			);
			assert.isFalse(attachment.inPublications);
		});
		
		it("should add child link attachments if .childLinks is true", async function () {
			var item = await createDataObject('item');
			var attachment1 = await Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			var attachment2 = await importFileAttachment('test.png', { parentItemID: item.id });
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			
			await Zotero.Items.addToPublications([item], { childLinks: true });
			assert.isTrue(attachment1.inPublications);
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", attachment1.id))),
				1
			);
			assert.isFalse(attachment2.inPublications);
			assert.isFalse(note.inPublications);
		});
		
		it("should add child file attachments if .childFileAttachments is true", async function () {
			var item = await createDataObject('item');
			var attachment1 = await importFileAttachment('test.png', { parentItemID: item.id });
			var attachment2 = await Zotero.Attachments.linkFromURL({
				url: "http://example.com",
				parentItemID: item.id,
				title: "Example"
			});
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			
			await Zotero.Items.addToPublications([item], { childFileAttachments: true });
			assert.isTrue(attachment1.inPublications);
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", attachment1.id))),
				1
			);
			assert.isFalse(attachment2.inPublications);
			assert.isFalse(note.inPublications);
		});
	});
	
	
	describe("#removeFromPublications", function () {
		it("should remove an item from My Publications", async function () {
			var item = await createDataObject('item');
			item.inPublications = true;
			await item.saveTx();
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id))),
				1
			);
			await Zotero.Items.removeFromPublications([item]);
			assert.isFalse(item.inPublications);
			assert.equal(
				((await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id))),
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
	
	
	describe("#trash()", function () {
		it("should send items to the trash", async function () {
			var items = [];
			items.push(
				((await createDataObject('item', { synced: true }))),
				((await createDataObject('item', { synced: true }))),
				((await createDataObject('item', { synced: true })))
			);
			items.forEach(item => {
				// Sanity-checked as true in itemTest#deleted
				assert.isUndefined(item._changed.deleted);
			});
			var ids = items.map(item => item.id);
			await Zotero.Items.trashTx(ids);
			items.forEach(item => {
				assert.isTrue(item.deleted);
				// Item should be saved (can't use hasChanged() because that includes .synced)
				assert.isUndefined(item._changed.deleted);
				assert.isFalse(item.synced);
			});
			assert.equal(((await Zotero.DB.valueQueryAsync(
				`SELECT COUNT(*) FROM deletedItems WHERE itemID IN (${ids})`
			))), 3);
			for (let item of items) {
				assert.equal(((await Zotero.DB.valueQueryAsync(
					`SELECT synced FROM items WHERE itemID=${item.id}`
				))), 0);
			}
		});
		
		it("should update parent item when trashing child item", async function () {
			var item = await createDataObject('item');
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			assert.lengthOf(item.getNotes(), 1);
			await Zotero.Items.trashTx([note.id]);
			assert.lengthOf(item.getNotes(), 0);
		});
	});
	
	
	describe("#emptyTrash()", function () {
		it("should delete items in the trash", async function () {
			var item1 = createUnsavedDataObject('item');
			item1.setField('title', 'a');
			item1.deleted = true;
			var id1 = await item1.saveTx();
			
			var item2 = createUnsavedDataObject('item');
			item2.setField('title', 'b');
			item2.deleted = true;
			var id2 = await item2.saveTx();
			
			var item3 = createUnsavedDataObject('item', { itemType: 'attachment', parentID: id2 });
			item3.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			item3.deleted = true;
			var id3 = await item3.saveTx();
			
			await collectionsView.selectTrash(Zotero.Libraries.userLibraryID);
			
			await Zotero.Items.emptyTrash(Zotero.Libraries.userLibraryID);
			
			assert.isFalse(await Zotero.Items.getAsync(id1));
			assert.isFalse(await Zotero.Items.getAsync(id2));
			assert.isFalse(await Zotero.Items.getAsync(id3));
			
			// TEMP: This is failing on Travis due to a race condition
			//assert.equal(zp.itemsView.rowCount, 0)
		})
	})
	
	describe("#getFirstCreatorFromData()", function () {
		it("should handle single eligible creator", async function () {
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
		
		it("should ignore single ineligible creator", async function () {
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
		
		it("should handle single eligible creator after ineligible creator", async function () {
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
		
		it("should handle two eligible creators", async function () {
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
		
		it("should handle three eligible creators", async function () {
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
		
		it("should handle two eligible creators with intervening creators", async function () {
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
	
	describe("#getAsync()", function () {
		it("should return Zotero.Item for item ID", async function () {
			let item = new Zotero.Item('journalArticle');
			let id = await item.saveTx();
			item = await Zotero.Items.getAsync(id);
			assert.notOk(item.isFeedItem);
			assert.instanceOf(item, Zotero.Item);
			assert.notInstanceOf(item, Zotero.FeedItem);
		});
		it("should return Zotero.FeedItem for feed item ID", async function () {
			let feed = new Zotero.Feed({ name: 'foo', url: 'http://www.' + Zotero.randomString() + '.com' });
			await feed.saveTx();
			
			let feedItem = new Zotero.FeedItem('journalArticle', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			let id = await feedItem.saveTx();
			
			feedItem = await Zotero.Items.getAsync(id);
			
			assert.isTrue(feedItem.isFeedItem);
			assert.instanceOf(feedItem, Zotero.FeedItem);
		});
	});
	
	describe("#keepTopLevel()", function () {
		it("should remove child items of passed items", async function () {
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var item3 = await createDataObject('item', { itemType: 'note', parentItemID: item1.id });
			var item4 = await createDataObject('item');
			var item5 = await createDataObject('item', { itemType: 'note', parentItemID: item4.id });
			var otherItem = await createDataObject('item');
			var item6 = await createDataObject('item', { itemType: 'note', parentItemID: otherItem.id });
			
			var items = Zotero.Items.keepTopLevel([item1, item2, item3, item4, item5, item6]);
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
			var items = Zotero.Items.keepTopLevel([item2, item3]);
			assert.sameMembers(
				items.map(item => item.id),
				[item2.id, item3.id]
			)
		});
	});
	
	
	describe("#numDistinctFileAttachmentsForLabel()", function () {
		it("should return an approximate count of attachment files for the selected items", async function () {
			var item1 = await createDataObject('item');
			var attachment1 = await importFileAttachment('test.png', { parentItemID: item1.id });
			var attachment2 = await importFileAttachment('test.png', { parentItemID: item1.id });
			
			function getNum() {
				return Zotero.Items.numDistinctFileAttachmentsForLabel(zp.getSelectedItems());
			}
			
			zp.itemsView.selection.clearSelection();
			assert.equal(getNum(), 0);
			
			// Uncached best-attachment state
			await zp.selectItems([item1.id]);
			assert.equal(getNum(), 1);
			await zp.selectItems([item1.id, attachment1.id]);
			// Make sure the best-attachment state is uncached
			item1._bestAttachmentState = null;
			// Should count parent item and best attachment as two item when uncached
			assert.equal(getNum(), 2);
			await zp.selectItems([item1.id, attachment1.id, attachment2.id]);
			// Max is 2
			assert.equal(getNum(), 2);
			
			await item1.getBestAttachment();
			
			// Cached best-attachment state
			await zp.selectItems([item1.id]);
			assert.equal(getNum(), 1);
			await zp.selectItems([item1.id, attachment1.id]);
			// Should count parent item and best attachment as one item when cached
			assert.equal(getNum(), 1);
			await zp.selectItems([item1.id, attachment1.id, attachment2.id]);
			assert.equal(getNum(), 2);
		});
		
		it("should return 0 for a parent item with a non-PDF file attachment when passed `item.isPDFAttachment()` as a filter", async function () {
			var item = await createDataObject('item');
			var attachment = await importFileAttachment('test.png', { parentItemID: item.id });
			
			var numFiles = Zotero.Items.numDistinctFileAttachmentsForLabel(
				[item],
				item => item.isPDFAttachment()
			);
			assert.equal(numFiles, 0);
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
