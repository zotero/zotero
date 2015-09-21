describe("Zotero.FeedItems", function () {
	let feed;
	before(function() {
		feed = new Zotero.Feed({ name: 'foo', url: 'http://' + Zotero.randomString() + '.com' });
		return feed.saveTx();
	});
	after(function() {
		return feed.eraseTx();
	});
	
	describe("#getIDFromGUID()", function() {
		it("should return false for non-existent GUID", function* () {
			let id = yield Zotero.FeedItems.getIDFromGUID(Zotero.randomString());
			assert.isFalse(id);
		});
		it("should return feed item id from GUID", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			yield feedItem.forceSaveTx();
			
			let id2 = yield Zotero.FeedItems.getIDFromGUID(feedItem.guid);
			assert.equal(id2, feedItem.id);
		});
	});
	describe("#getAsyncByGUID()", function() {
		it("should return feed item from GUID", function* () {
			let guid = Zotero.randomString();
			let feedItem = yield createDataObject('feedItem', { guid, libraryID: feed.libraryID });
			yield feedItem.forceSaveTx();
			
			let feedItem2 = yield Zotero.FeedItems.getAsyncByGUID(guid);
			assert.equal(feedItem2.id, feedItem.id);
		});
		it("should return false for non-existent GUID", function* () {
			let feedItem = yield Zotero.FeedItems.getAsyncByGUID(Zotero.randomString());
			assert.isFalse(feedItem);
		});
	});
});
