describe("Zotero.Feed", function () {
	// Clean up after after tests
	after(function* () {
		yield clearFeeds();
	});
	
	it("should be an instance of Zotero.Library", function () {
		let feed = new Zotero.Feed();
		assert.instanceOf(feed, Zotero.Library);
	});
	
	describe("#constructor()", function () {
		it("should accept required fields as arguments", async function () {
			let feed = new Zotero.Feed();
			await assert.isRejected(feed.saveTx(), /^Feed name not set$/);
			
			feed = new Zotero.Feed({
				name: 'Test ' + Zotero.randomString(),
				url: 'http://www.' + Zotero.randomString() + '.com'
			});
			await assert.isFulfilled(feed.saveTx());
		});
	});
	
	describe("#isFeed", function () {
		it("should be true", function () {
			let feed = new Zotero.Feed();
			assert.isTrue(feed.isFeed);
		});
		it("should be falsy for regular Library", function () {
			let library = new Zotero.Library();
			assert.notOk(library.isFeed);
		});
	});
	
	describe("#editable", function () {
		it("should always be not editable", async function () {
			let feed = await createFeed();
			assert.isFalse(feed.editable);
			feed.editable = true;
			assert.isFalse(feed.editable);
			await feed.saveTx();
			assert.isFalse(feed.editable);
		});
		it("should allow adding items without editCheck override", async function () {
			let feed = await createFeed();
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			await assert.isFulfilled(feedItem.saveTx());
		});
	});
	
	describe("#libraryTypeID", function () {
		it("should be undefind", async function () {
			let feed = await createFeed();
			assert.isUndefined(feed.libraryTypeID);
		});
	});
	
	describe("#url", function () {
		it("should throw if trying to set an invalid URL", async function () {
			let feed = new Zotero.Feed({ name: 'Test ' + Zotero.randomString() });
			
			assert.throws(function () {feed.url = 'foo'}, /^Invalid feed URL /);
			assert.throws(function () {feed.url = 'ftp://example.com'}, /^Invalid feed URL /);
		});
	});
	
	describe("#save()", function () {
		it("should save a new feed to the feed library", async function () {
			let props = {
				name: 'Test ' + Zotero.randomString(),
				url: 'http://' + Zotero.randomString() + '.com/'
			};
			let feed = await createFeed(props);
			
			assert.equal(feed.name, props.name, "name is correct");
			assert.equal(feed.url.toLowerCase(), props.url.toLowerCase(), "url is correct");
		});
		it("should save a feed with all fields set", async function () {
			let props = {
				name: 'Test ' + Zotero.randomString(),
				url: 'http://' + Zotero.randomString() + '.com/',
				refreshInterval: 30,
				cleanupReadAfter: 1,
				cleanupUnreadAfter: 30
			};
			
			let feed = await createFeed(props);
			
			assert.equal(feed.name, props.name, "name is correct");
			assert.equal(feed.url.toLowerCase(), props.url.toLowerCase(), "url is correct");
			assert.equal(feed.refreshInterval, props.refreshInterval, "refreshInterval is correct");
			assert.equal(feed.cleanupReadAfter, props.cleanupReadAfter, "cleanupReadAfter is correct");
			assert.equal(feed.cleanupUnreadAfter, props.cleanupUnreadAfter, "cleanupUnreadAfter is correct");
			
			assert.isNull(feed.lastCheck, "lastCheck is null");
			assert.isNull(feed.lastUpdate, "lastUpdate is null");
			assert.isNull(feed.lastCheckError, "lastCheckError is null");
		});
		it("should throw if name or url are missing", async function () {
			let feed = new Zotero.Feed();
			await assert.isRejected(feed.saveTx(), /^Feed name not set$/);
			
			feed.name = 'Test ' + Zotero.randomString();
			await assert.isRejected(feed.saveTx(), /^Feed URL not set$/);
			
			feed = new Zotero.Feed();
			feed.url = 'http://' + Zotero.randomString() + '.com';
			await assert.isRejected(feed.saveTx(), /^Feed name not set$/);
		});
		it("should not allow saving a feed with the same url", async function () {
			let url = 'http://' + Zotero.randomString() + '.com';
			let feed1 = await createFeed({ url });
			
			let feed2 = new Zotero.Feed({ name: 'Test ' + Zotero.randomString(), url });
			await assert.isRejected(feed2.saveTx(), /^Feed for URL already exists: /);
			
			// Perform check with normalized URL
			feed2.url = url + '/';
			await assert.isRejected(feed2.saveTx(), /^Feed for URL already exists: /);
			
			feed2.url = url.toUpperCase();
			await assert.isRejected(feed2.saveTx(), /^Feed for URL already exists: /);
		});
		it("should allow saving a feed with the same name", async function () {
			let name = 'Test ' + Zotero.randomString();
			let feed1 = await createFeed({ name });
			
			let feed2 = new Zotero.Feed({ name , url: 'http://' + Zotero.randomString() + '.com' });
			
			await assert.isFulfilled(feed2.saveTx(), "allow saving feed with an existing name");
			
			assert.equal(feed1.name, feed2.name, "feed names remain the same");
		});
		it("should save field to DB after editing", async function () {
			let feed = await createFeed();
			
			feed.name = 'bar';
			await feed.saveTx();
			
			let dbVal = await Zotero.DB.valueQueryAsync('SELECT name FROM feeds WHERE libraryID=?', feed.libraryID);
			assert.equal(feed.name, 'bar');
			assert.equal(dbVal, feed.name);
		});
		it("should add a new synced setting after creation", async function () {
			let url = 'http://' + Zotero.Utilities.randomString(10, 'abcde') + '.com/feed.rss';
			
			let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.notOk(syncedFeeds[url]);
			
			await createFeed({url});
			
			syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.ok(syncedFeeds[url]);
		});
		it("should remove previous feed and add a new one if url changed", async function () {
			let feed = await createFeed();
			
			let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.ok(syncedFeeds[feed.url]);

			let oldUrl = feed.url;
			feed.url = 'http://' + Zotero.Utilities.randomString(10, 'abcde') + '.com/feed.rss';
			await feed.saveTx();

			syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.notOk(syncedFeeds[oldUrl]);
			assert.ok(syncedFeeds[feed.url]);
		});
		it('should update syncedSettings if `name`, `url`, `refreshInterval` or `cleanupUnreadAfter` was modified', async function () {
			let feed = await createFeed();
			let syncedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', syncedSetting, 0, true);
			
			feed.name = "New name";
			await feed.saveTx();
			assert.isFalse(Zotero.SyncedSettings.getMetadata(Zotero.Libraries.userLibraryID, 'feeds').synced)
		});
		it('should not update syncedSettings if `name`, `url`, `refreshInterval` or `cleanupUnreadAfter` were not modified', async function () {
			let feed = await createFeed();
			let syncedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', syncedSetting, 0, true);

			feed._set('_feedLastCheck', Zotero.Date.dateToSQL(new Date(), true));
			await feed.saveTx();
			assert.isTrue(Zotero.SyncedSettings.getMetadata(Zotero.Libraries.userLibraryID, 'feeds').synced)
		});
	});
	describe("#erase()", function () {
		it("should erase a saved feed", async function () {
			let feed = await createFeed();
			let id = feed.libraryID;
			let url = feed.url;
			
			await feed.eraseTx();
			
			assert.isFalse(Zotero.Libraries.exists(id));
			assert.isFalse(Zotero.Feeds.existsByURL(url));
			
			let dbValue = await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM feeds WHERE libraryID=?', id);
			assert.equal(dbValue, '0');
		});
		it("should clear feedItems from cache", async function () {
			let feed = await createFeed();
			
			let feedItem = await createDataObject('feedItem', { libraryID: feed.libraryID });
			assert.ok(await Zotero.FeedItems.getAsync(feedItem.id));
			
			await feed.eraseTx();
			
			assert.notOk(await Zotero.FeedItems.getAsync(feedItem.id));
		});
		it("should remove synced settings", async function () {
			let url = 'http://' + Zotero.Utilities.randomString(10, 'abcde') + '.com/feed.rss';
			let feed = await createFeed({url});
			
			let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.ok(syncedFeeds[feed.url]);
			
			await feed.eraseTx();
			
			syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.notOk(syncedFeeds[url]);

		});
	});
	
	describe("#storeSyncedSettings", function () {
		it("should store settings for feed in compact format", async function () {
			let url = 'http://' + Zotero.Utilities.randomString().toLowerCase() + '.com/feed.rss';
			let settings = [Zotero.Utilities.randomString(), 1, 30, 1];
			let feed = await createFeed({
				url,
				name: settings[0],
				cleanupReadAfter: settings[1],
				cleanupUnreadAfter: settings[2],
				refreshInterval: settings[3]
			});
			
			let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			assert.deepEqual(syncedFeeds[url], settings);
		});
	});
	
	describe("#clearExpiredItems()", function () {
		var feed, readExpiredFI, unreadExpiredFI, readFeedItem, feedItem, readStillInFeed, feedItemIDs;
		
		before(function* (){
			feed = yield createFeed({cleanupReadAfter: 1, cleanupUnreadAfter: 3});
			
			readExpiredFI = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			// Read 2 days ago
			readExpiredFI.isRead = true;
			readExpiredFI._feedItemReadTime = Zotero.Date.dateToSQL(
					new Date(Date.now() - 2 * 24*60*60*1000), true);
			yield readExpiredFI.saveTx();

			// Added 5 days ago
			unreadExpiredFI = yield createDataObject('feedItem', { 
				libraryID: feed.libraryID,
				dateAdded: Zotero.Date.dateToSQL(new Date(Date.now() - 5 * 24*60*60*1000), true),
				dateModified: Zotero.Date.dateToSQL(new Date(Date.now() - 5 * 24*60*60*1000), true)
			});
			yield unreadExpiredFI.saveTx();
			
			readStillInFeed = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			// Read 2 days ago
			readStillInFeed.isRead = true;
			readStillInFeed._feedItemReadTime = Zotero.Date.dateToSQL(
					new Date(Date.now() - 2 * 24*60*60*1000), true);
			yield readStillInFeed.saveTx();
			
			readFeedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			readFeedItem.isRead = true;
			yield readFeedItem.saveTx();
			
			feedItem = yield createDataObject('feedItem', { libraryID: feed.libraryID });
			
			feedItemIDs = yield Zotero.FeedItems.getAll(feed.libraryID).map((row) => row.id);
			
			assert.include(feedItemIDs, feedItem.id, "feed contains unread feed item");
			assert.include(feedItemIDs, readFeedItem.id, "feed contains read feed item");
			assert.include(feedItemIDs, readExpiredFI.id, "feed contains expired feed item");
			assert.include(feedItemIDs, readStillInFeed.id, "feed contains expired but still in rss feed item");
			
			yield feed.clearExpiredItems(new Set([readStillInFeed.id]));
			
			feedItemIDs = yield Zotero.FeedItems.getAll(feed.libraryID).map((row) => row.id);
		});
	
		it('should clear expired items', function () {
			assert.notInclude(feedItemIDs, readExpiredFI.id, "feed no longer contains expired read feed item");
			assert.notInclude(feedItemIDs, unreadExpiredFI.id, "feed no longer contains expired feed item");	
		});
		
		it('should not clear read items that have not expired yet', function () {
			assert.include(feedItemIDs, readFeedItem.id, "feed still contains new feed item");
		});
		
		it('should not clear read items that are still in rss', function () {
			assert.include(feedItemIDs, readStillInFeed.id, "feed still contains read still in rss feed item");
		});
		
		it('should not clear unread items', function () {
			assert.include(feedItemIDs, feedItem.id, "feed still contains new feed item");
		});
	});
	
	describe('#updateFeed()', function () {
		var feed, scheduleNextFeedCheck;
		var feedUrl = getTestDataUrl("feed.rss");
		var modifiedFeedUrl = getTestDataUrl("feedModified.rss");
		var win;
		
		before(async function () {
			// Browser window is needed as parent window to load the feed reader scripts.
			win = await loadZoteroWindow();
			scheduleNextFeedCheck = sinon.stub(Zotero.Feeds, 'scheduleNextFeedCheck').resolves();
		});
		
		beforeEach(function* (){
			scheduleNextFeedCheck.resetHistory();
			feed = yield createFeed();
			feed._feedUrl = feedUrl;
			yield feed.updateFeed();
		});
		
		afterEach(function* () {
			yield clearFeeds();
		});
		
		after(function () {
			if (win) {
				win.close();
			}
			scheduleNextFeedCheck.restore();
		});
		
		it('should schedule next feed check', async function () {
			let feed = await createFeed();
			feed._feedUrl = feedUrl;
			await feed.updateFeed();
			assert.equal(scheduleNextFeedCheck.called, true);
		});
		
		it('should add new feed items', async function () {
			let feedItems = await Zotero.FeedItems.getAll(feed.id, true);
			assert.equal(feedItems.length, 3);
		});
		
		it('should set lastCheck and lastUpdated values', async function () {
			await clearFeeds();
			let feed = await createFeed();
			feed._feedUrl = feedUrl;
			
			assert.notOk(feed.lastCheck);
			assert.notOk(feed.lastUpdate);
			
			await feed.updateFeed();
			
			assert.isTrue(feed.lastCheck > Zotero.Date.dateToSQL(new Date(Date.now() - 1000*60), true), 'feed.lastCheck updated');
			assert.isTrue(feed.lastUpdate > Zotero.Date.dateToSQL(new Date(Date.now() - 1000*60), true), 'feed.lastUpdate updated');
		});
		it('should update modified items, preserving isRead', async function () {
			let feedItem = await Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			feedItem.isRead = true;
			await feedItem.saveTx();
			feedItem = await Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			assert.isTrue(feedItem.isRead);
			
			let oldDateModified = feedItem.getField('date');
			
			feed._feedUrl = modifiedFeedUrl;
			await feed.updateFeed();
			
			feedItem = await Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			
			assert.notEqual(oldDateModified, feedItem.getField('date'));
			assert.isTrue(feedItem.isRead);
		});
		it('should skip items that are not modified', async function () {
			let save = sinon.spy(Zotero.FeedItem.prototype, 'save');
			
			feed._feedUrl = modifiedFeedUrl;
			await feed.updateFeed();
			
			assert.equal(save.thisValues[0].guid, "http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			save.restore();
		});
		it('should update unread count', async function () {
			assert.equal(feed.unreadCount, 3);

			let feedItems = await Zotero.FeedItems.getAll(feed.id);
			for (let feedItem of feedItems) {
				feedItem.isRead = true;
				await feedItem.saveTx();
			}
			
			feed._feedUrl = modifiedFeedUrl;
			await feed.updateFeed();
			
			assert.equal(feed.unreadCount, 1);
		});
		it('should add a link to enclosed pdfs from <enclosure/> elements', async function () {
			let feedItem = await Zotero.FeedItems.getAsyncByGUID("http://liftoff.msfc.nasa.gov/2003/06/03.html#item573");
			let pdf = await Zotero.Items.getAsync(feedItem.getAttachments()[0]);
			
			assert.equal(pdf.getField('url'), "http://www.example.com/example.pdf");
		});
	});
	
	describe("Adding items", function () {
		let feed;
		before(function* () {
			feed = yield createFeed();
		})
		it("should not allow adding collections", async function () {
			let collection = new Zotero.Collection({ name: 'test', libraryID: feed.libraryID });
			await assert.isRejected(collection.saveTx({ skipEditCheck: true }), /^Cannot add /);
		});
		it("should not allow adding saved search", async function () {
			let search = new Zotero.Search({ name: 'test', libraryID: feed.libraryID });
			await assert.isRejected(search.saveTx({ skipEditCheck: true }), /^Cannot add /);
		});
		it("should allow adding feed item", async function () {
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			await assert.isFulfilled(feedItem.saveTx());
		});
	});
})
