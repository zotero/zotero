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
	
	
	describe("#merge()", function () {
		it("should merge two items", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			var item2URI = Zotero.URI.getItemURI(item2);
			
			yield Zotero.Items.merge(item1, [item2]);
			
			assert.isFalse(item1.deleted);
			assert.isTrue(item2.deleted);
			
			// Check for merge-tracking relation
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
			let id = yield feedItem.forceSaveTx();
			
			feedItem = yield Zotero.Items.getAsync(id);
			
			assert.isTrue(feedItem.isFeedItem);
			assert.instanceOf(feedItem, Zotero.FeedItem);
		});
	});
});
