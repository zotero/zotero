describe("Zotero.Feed", function() {
	// Clean up after after tests
	after(function* () {
		yield clearFeeds();
	});
	
	it("should be an instance of Zotero.Library", function() {
		let feed = new Zotero.Feed();
		assert.instanceOf(feed, Zotero.Library);
	});
	
	describe("#constructor()", function() {
		it("should accept required fields as arguments", function* () {
			let feed = new Zotero.Feed();
			yield assert.isRejected(feed.saveTx(), /^Error: Feed name not set$/);
			
			feed = new Zotero.Feed({
				name: 'Test ' + Zotero.randomString(),
				url: 'http://www.' + Zotero.randomString() + '.com'
			});
			yield assert.isFulfilled(feed.saveTx());
		});
	});
	
	describe("#isFeed", function() {
		it("should be true", function() {
			let feed = new Zotero.Feed();
			assert.isTrue(feed.isFeed);
		});
		it("should be falsy for regular Library", function() {
			let library = new Zotero.Library();
			assert.notOk(library.isFeed);
		});
	});
	
	describe("#editable", function() {
		it("should always be not editable", function* () {
			let feed = yield createFeed();
			assert.isFalse(feed.editable);
			feed.editable = true;
			assert.isFalse(feed.editable);
			yield feed.saveTx();
			assert.isFalse(feed.editable);
		});
		it("should not allow adding items without editCheck override", function* () {
			let feed = yield createFeed();
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			yield assert.isRejected(feedItem.saveTx(), /^Error: Cannot edit feedItem in read-only library/);
			yield assert.isFulfilled(feedItem.saveTx({ skipEditCheck: true }));
		});
	});
	
	describe("#url", function() {
		it("should throw if trying to set an invalid URL", function *() {
			let feed = new Zotero.Feed({ name: 'Test ' + Zotero.randomString() });
			
			assert.throws(function() {feed.url = 'foo'}, /^Invalid feed URL /);
			assert.throws(function() {feed.url = 'ftp://example.com'}, /^Invalid feed URL /);
		});
	});
	
	describe("#save()", function() {
		it("should save a new feed to the feed library", function* () {
			let props = {
				name: 'Test ' + Zotero.randomString(),
				url: 'http://' + Zotero.randomString() + '.com/'
			};
			let feed = yield createFeed(props);
			
			assert.equal(feed.name, props.name, "name is correct");
			assert.equal(feed.url.toLowerCase(), props.url.toLowerCase(), "url is correct");
		});
		it("should save a feed with all fields set", function* () {
			let props = {
				name: 'Test ' + Zotero.randomString(),
				url: 'http://' + Zotero.randomString() + '.com/',
				refreshInterval: 30,
				cleanupAfter: 1
			};
			
			let feed = yield createFeed(props);
			
			assert.equal(feed.name, props.name, "name is correct");
			assert.equal(feed.url.toLowerCase(), props.url.toLowerCase(), "url is correct");
			assert.equal(feed.refreshInterval, props.refreshInterval, "refreshInterval is correct");
			assert.equal(feed.cleanupAfter, props.cleanupAfter, "cleanupAfter is correct");
			
			assert.isNull(feed.lastCheck, "lastCheck is null");
			assert.isNull(feed.lastUpdate, "lastUpdate is null");
			assert.isNull(feed.lastCheckError, "lastCheckError is null");
		});
		it("should throw if name or url are missing", function *() {
			let feed = new Zotero.Feed();
			yield assert.isRejected(feed.saveTx(), /^Error: Feed name not set$/);
			
			feed.name = 'Test ' + Zotero.randomString();
			yield assert.isRejected(feed.saveTx(), /^Error: Feed URL not set$/);
			
			feed = new Zotero.Feed();
			feed.url = 'http://' + Zotero.randomString() + '.com';
			yield assert.isRejected(feed.saveTx(), /^Error: Feed name not set$/);
		});
		it("should not allow saving a feed with the same url", function *() {
			let url = 'http://' + Zotero.randomString() + '.com';
			let feed1 = yield createFeed({ url });
			
			let feed2 = new Zotero.Feed({ name: 'Test ' + Zotero.randomString(), url });
			yield assert.isRejected(feed2.saveTx(), /^Error: Feed for URL already exists: /);
			
			// Perform check with normalized URL
			feed2.url = url + '/';
			yield assert.isRejected(feed2.saveTx(), /^Error: Feed for URL already exists: /);
			
			feed2.url = url.toUpperCase();
			yield assert.isRejected(feed2.saveTx(), /^Error: Feed for URL already exists: /);
		});
		it("should allow saving a feed with the same name", function *() {
			let name = 'Test ' + Zotero.randomString();
			let feed1 = yield createFeed({ name });
			
			let feed2 = new Zotero.Feed({ name , url: 'http://' + Zotero.randomString() + '.com' });
			
			yield assert.isFulfilled(feed2.saveTx(), "allow saving feed with an existing name");
			
			assert.equal(feed1.name, feed2.name, "feed names remain the same");
		});
		it("should save field to DB after editing", function* () {
			let feed = yield createFeed();
			
			feed.name = 'bar';
			yield feed.saveTx();
			
			let dbVal = yield Zotero.DB.valueQueryAsync('SELECT name FROM feeds WHERE libraryID=?', feed.libraryID);
			assert.equal(feed.name, 'bar');
			assert.equal(dbVal, feed.name);
		});
	});
	describe("#erase()", function() {
		it("should erase a saved feed", function* () {
			let feed = yield createFeed();
			let id = feed.libraryID;
			let url = feed.url;
			
			yield feed.eraseTx();
			
			assert.isFalse(Zotero.Libraries.exists(id));
			assert.isFalse(Zotero.Feeds.existsByURL(url));
			
			let dbValue = yield Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM feeds WHERE libraryID=?', id);
			assert.equal(dbValue, '0');
		});
		it("should clear feedItems from cache", function* () {
			let feed = yield createFeed();
			
			let feedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			assert.ok(yield Zotero.FeedItems.getAsync(feedItem.id));
			
			yield feed.eraseTx();
			
			assert.notOk(yield Zotero.FeedItems.getAsync(feedItem.id));
		});
	});
	
	describe("#clearExpiredItems()", function() {
		var feed, expiredFeedItem, readFeedItem, feedItem, feedItemIDs;
		
		before(function* (){
			feed = yield createFeed({cleanupAfter: 1});
			
			expiredFeedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			// Read 2 days ago
			expiredFeedItem.isRead = true;
			expiredFeedItem._feedItemReadTime = Zotero.Date.dateToSQL(
					new Date(Date.now() - 2 * 24*60*60*1000), true);
			yield expiredFeedItem.forceSaveTx();
			
			readFeedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			readFeedItem.isRead = true;
			yield readFeedItem.forceSaveTx();
			
			feedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			
			feedItemIDs = yield Zotero.FeedItems.getAll(feed.libraryID).map((row) => row.id);
			
			assert.include(feedItemIDs, feedItem.id, "feed contains unread feed item");
			assert.include(feedItemIDs, readFeedItem.id, "feed contains read feed item");
			assert.include(feedItemIDs, expiredFeedItem.id, "feed contains expired feed item");
			
			yield feed.clearExpiredItems();
			
			feedItemIDs = yield Zotero.FeedItems.getAll(feed.libraryID).map((row) => row.id);
		});
	
		it('should clear expired items', function() {
			assert.notInclude(feedItemIDs, expiredFeedItem.id, "feed no longer contain expired feed item");	
		});
		
		it('should not clear read items that have not expired yet', function() {
			assert.include(feedItemIDs, readFeedItem.id, "feed still contains new feed item");
		})
		
		it('should not clear unread items', function() {
			assert.include(feedItemIDs, feedItem.id, "feed still contains new feed item");
		});
	});
	
	describe('#updateFeed()', function() {
		var feedUrl = getTestDataItemUrl("feed.rss");
		var modifiedFeedUrl = getTestDataItemUrl("feedModified.rss");
		
		afterEach(function* () {
			yield clearFeeds();
		});
		
		it('should schedule next feed check', function* () {
			let scheduleNextFeedCheck = sinon.stub(Zotero.Feeds, 'scheduleNextFeedCheck');
			
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();
			assert.equal(scheduleNextFeedCheck.called, true);
			
			scheduleNextFeedCheck.restore();
		});
		
		it('should add new feed items', function* () {
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();
			
			let feedItems = yield Zotero.FeedItems.getAll(feed.id);
			assert.equal(feedItems.length, 4);
		});
		
		it('should set lastCheck and lastUpdated values', function* () {
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			
			assert.notOk(feed.lastCheck);
			assert.notOk(feed.lastUpdate);
			
			yield feed.updateFeed();
			
			assert.ok(feed.lastCheck >= Zotero.Date.dateToSQL(new Date(Date.now() - 1000*60), true));
			assert.ok(feed.lastUpdate >= Zotero.Date.dateToSQL(new Date(Date.now() - 1000*60), true));
		});
		it('should update modified items and set unread', function* () {
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();

			let feedItem = yield Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			feedItem.isRead = true;
			yield feedItem.forceSaveTx();
			feedItem = yield Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			assert.isTrue(feedItem.isRead);
			
			let oldDateModified = feedItem.dateModified;
			
			feed._feedUrl = modifiedFeedUrl;
			yield feed.updateFeed();
			
			feedItem = yield Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			
			assert.notEqual(oldDateModified, feedItem.dateModified);
			assert.isFalse(feedItem.isRead)
		});
		it('should skip items that are not modified', function* () {
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();

			let feedItems = yield Zotero.FeedItems.getAll(feed.id);
			let datesAdded = [], datesModified = [];
			for(let feedItem of feedItems) {
				datesAdded.push(feedItem.dateAdded);
				datesModified.push(feedItem.dateModified);
			}
			
			feed._feedUrl = modifiedFeedUrl;
			yield feed.updateFeed();
			
			feedItems = yield Zotero.FeedItems.getAll(feed.id);
			
			let changedCount = 0;
			for (let i = 0; i < feedItems.length; i++) {
				assert.equal(feedItems[i].dateAdded, datesAdded[i]);
				if (feedItems[i].dateModified != datesModified[i]) {
					changedCount++;
				}
			}
			
			assert.equal(changedCount, 1);
		});
		it('should update unread count', function* () {
			let feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();
			
			assert.equal(feed.unreadCount, 4);

			let feedItems = yield Zotero.FeedItems.getAll(feed.id);
			for (let feedItem of feedItems) {
				feedItem.isRead = true;
				yield feedItem.forceSaveTx();
			}
			
			feed._feedUrl = modifiedFeedUrl;
			yield feed.updateFeed();
			
			assert.equal(feed.unreadCount, 1);
		});
	});
	
	describe("Adding items", function() {
		let feed;
		before(function* () {
			feed = yield createFeed();
		})
		it("should not allow adding regular items", function* () {
			let item = new Zotero.Item('book');
			item.libraryID = feed.libraryID;
			yield assert.isRejected(item.saveTx({ skipEditCheck: true }), /^Error: Cannot add /);
		});
		it("should not allow adding collections", function* () {
			let collection = new Zotero.Collection({ name: 'test', libraryID: feed.libraryID });
			yield assert.isRejected(collection.saveTx({ skipEditCheck: true }), /^Error: Cannot add /);
		});
		it("should not allow adding saved search", function* () {
			let search = new Zotero.Search({ name: 'test', libraryID: feed.libraryID });
			yield assert.isRejected(search.saveTx({ skipEditCheck: true }), /^Error: Cannot add /);
		});
		it("should allow adding feed item", function* () {
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			yield assert.isFulfilled(feedItem.forceSaveTx());
		});
	});
})
