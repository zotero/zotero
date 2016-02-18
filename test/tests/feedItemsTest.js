describe("Zotero.FeedItems", function () {
	let feed;
	before(function* () {
		feed = yield createFeed({ name: 'foo', url: 'http://' + Zotero.randomString() + '.com' });
	});
	after(function() {
		return clearFeeds();
	});
	
	describe("#getIDFromGUID()", function() {
		it("should return false for non-existent GUID", function* () {
			let id = yield Zotero.FeedItems.getIDFromGUID(Zotero.randomString());
			assert.isFalse(id);
		});
		it("should return feed item id from GUID", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			yield feedItem.saveTx();
			
			let id2 = yield Zotero.FeedItems.getIDFromGUID(feedItem.guid);
			assert.equal(id2, feedItem.id);
		});
	});
	describe("#getAsyncByGUID()", function() {
		it("should return feed item from GUID", function* () {
			let guid = Zotero.randomString();
			let feedItem = yield createDataObject('feedItem', { guid, libraryID: feed.libraryID });
			yield feedItem.saveTx();
			
			let feedItem2 = yield Zotero.FeedItems.getAsyncByGUID(guid);
			assert.equal(feedItem2.id, feedItem.id);
		});
		it("should return false for non-existent GUID", function* () {
			let feedItem = yield Zotero.FeedItems.getAsyncByGUID(Zotero.randomString());
			assert.isFalse(feedItem);
		});
	});
	describe("#toggleReadByID()", function() {
		var save, feed, items, ids;
		
		before(function() {
			save = sinon.spy(Zotero.FeedItem.prototype, 'save');
		});
		
		beforeEach(function* (){
			feed = yield createFeed();

			items = [];
			for (let i = 0; i < 10; i++) {
				let item = yield createDataObject('feedItem', { guid: Zotero.randomString(), libraryID: feed.id });
				item.isRead = true;
				yield item.saveTx();
				items.push(item);
			}
			ids = Array.map(items, (i) => i.id);
		});
		
		after(function() {
			save.restore();
		});
		
		afterEach(function* () {
			save.reset();
			
			yield clearFeeds();
		});
	
		it('should toggle all items read if at least one unread', function* () {
			items[0].isRead = false;
			yield items[0].saveTx();
			
			yield Zotero.FeedItems.toggleReadByID(ids);
			
			for(let i = 0; i < 10; i++) {
				assert.isTrue(save.thisValues[i].isRead, "#toggleRead called with true");
			}
		});

		it('should toggle all items unread if all read', function* () {
			yield Zotero.FeedItems.toggleReadByID(ids);

			for(let i = 0; i < 10; i++) {
				assert.isFalse(save.thisValues[i].isRead, "#toggleRead called with false");
			}
		});

		it('should toggle all items unread if unread state specified', function* () {
			items[0].isRead = false;
			yield items[0].saveTx();

			yield Zotero.FeedItems.toggleReadByID(ids, false);

			for(let i = 0; i < 10; i++) {
				assert.isFalse(save.thisValues[i].isRead, "#toggleRead called with true");
			}
		});
	});
});
