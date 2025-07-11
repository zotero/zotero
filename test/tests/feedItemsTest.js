describe("Zotero.FeedItems", function () {
	let feed;
	before(function* () {
		feed = yield createFeed({ name: 'foo', url: 'http://' + Zotero.randomString() + '.com' });
	});
	after(function () {
		return clearFeeds();
	});
	
	describe("#getMarkedAsRead", function () {
		var items = [];
		var result;
		
		before(async function () {
			for (let i = 0; i < 4; i++) {
				let f = await createDataObject(
					'feedItem',
					{
						libraryID: feed.libraryID,
						guid: 'http://www.example.com/' + i
					}
				);
				items.push(f);
			}
			await items[0].toggleRead();
			await items[2].toggleRead();
			result = (await Zotero.FeedItems.getMarkedAsRead(feed.libraryID)).map(x => x.id);
		});
		
		it('should get all marked as read items', function () {
			assert.include(result, items[0].id);
			assert.include(result, items[2].id);
		});
		
		it('should not include items that were not marked', function () {
			assert.notInclude(result, items[1].id);
			assert.notInclude(result, items[3].id);
		});
	});
	
	describe("#markAsReadByGUID", function () {
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
		it('should mark as read only specified guids', function () {
			assert.isTrue(items[0].isRead);
			assert.isTrue(items[2].isRead);
		});
		it('should leave other items marked unread', function () {
			assert.isFalse(items[1].isRead);
			assert.isFalse(items[3].isRead);
		});
	});
	
	describe("#getIDFromGUID()", function () {
		it("should return false for non-existent GUID", async function () {
			let id = await Zotero.FeedItems.getIDFromGUID(Zotero.randomString());
			assert.isFalse(id);
		});
		it("should return feed item id from GUID", async function () {
			let feedItem = await createDataObject('feedItem', { libraryID: feed.libraryID });
			await feedItem.saveTx();
			
			let id2 = await Zotero.FeedItems.getIDFromGUID(feedItem.guid);
			assert.equal(id2, feedItem.id);
		});
	});
	describe("#getAsyncByGUID()", function () {
		it("should return feed item from GUID", async function () {
			let guid = Zotero.randomString();
			let feedItem = await createDataObject('feedItem', { guid, libraryID: feed.libraryID });
			await feedItem.saveTx();
			
			let feedItem2 = await Zotero.FeedItems.getAsyncByGUID(guid);
			assert.equal(feedItem2.id, feedItem.id);
		});
		it("should return false for non-existent GUID", async function () {
			let feedItem = await Zotero.FeedItems.getAsyncByGUID(Zotero.randomString());
			assert.isFalse(feedItem);
		});
	});
	describe("#toggleReadByID()", function () {
		var save, feed, items, ids;
		
		before(function () {
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
			ids = items.map(i => i.id);
		});
		
		afterEach(function* () {
			save.resetHistory();
			
			yield clearFeeds();
		});
		
		after(function () {
			save.restore();
		});
		
		it('should toggle all items read if at least one unread', async function () {
			items[0].isRead = false;
			await items[0].saveTx();
			
			await Zotero.FeedItems.toggleReadByID(ids);
			
			for(let i = 0; i < 10; i++) {
				assert.isTrue(save.thisValues[i].isRead, "#toggleRead called with true");
			}
		});

		it('should toggle all items unread if all read', async function () {
			await Zotero.FeedItems.toggleReadByID(ids);

			for(let i = 0; i < 10; i++) {
				assert.isFalse(save.thisValues[i].isRead, "#toggleRead called with false");
			}
		});

		it('should toggle all items unread if unread state specified', async function () {
			items[0].isRead = false;
			await items[0].saveTx();

			await Zotero.FeedItems.toggleReadByID(ids, false);

			for(let i = 0; i < 10; i++) {
				assert.isFalse(save.thisValues[i].isRead, "#toggleRead called with true");
			}
		});
	});
});
