describe("Zotero.FeedItems", function () {
	let feed;
	before(function* () {
		feed = yield createFeed({ name: 'foo', url: 'http://' + Zotero.randomString() + '.com' });
	});
	after(function() {
		return clearFeeds();
	});
	
	describe("#getMarkedAsRead", function() {
		var items = [];
		var result;
		before(function* () {
			for (let i = 0; i < 4; i++) {
				let f = yield createDataObject('feedItem', {libraryID: feed.libraryID, guid: 'http://www.example.com/' + i});
				items.push(f);
			}
			yield items[0].toggleRead();
			yield items[2].toggleRead();
			result = yield Zotero.FeedItems.getMarkedAsRead(feed.libraryID);
		});
		it('should get all marked as read items', function() {
			assert.include(result, items[0]);
			assert.include(result, items[2]);
		});
		it('should not include items that were not marked', function() {
			assert.notInclude(result, items[1]);
			assert.notInclude(result, items[3]);
		});
	});
	
	describe("#markAsReadByGUID", function() {
		var items = [];
		var result;
		before(function* () {
			for (let i = 0; i < 4; i++) {
				let f = yield createDataObject('feedItem', {
					libraryID: feed.libraryID, 
					guid: 'http://' + Zotero.Utilities.randomString() + '.com/feed.rss'
				});
				items.push(f);
			}
			yield Zotero.FeedItems.markAsReadByGUID([items[0].guid, items[2].guid]);
		});
		it('should mark as read only specified guids', function() {
			assert.isTrue(items[0].isRead);
			assert.isTrue(items[2].isRead);
		});
		it('should leave other items marked unread', function() {
			assert.isFalse(items[1].isRead);
			assert.isFalse(items[3].isRead);
		});
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
		
		afterEach(function* () {
			save.resetHistory();
			
			yield clearFeeds();
		});
		
		after(function() {
			save.restore();
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
