describe("Zotero.Feed", function() {
	let createFeed = Zotero.Promise.coroutine(function* (props = {}) {
		let feed = new Zotero.Feed({
			name: props.name || 'Test ' + Zotero.randomString(),
			url: props.url || 'http://www.' + Zotero.randomString() + '.com',
			refreshInterval: props.refreshInterval,
			cleanupAfter: props.cleanupAfter
		});
		
		yield feed.saveTx();
		return feed;
	});
	
	// Clean up after after tests
	after(function* () {
		let feeds = Zotero.Feeds.getAll();
		yield Zotero.DB.executeTransaction(function* () {
			for (let i=0; i<feeds.length; i++) {
				yield feeds[i].erase();
			}
		});
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
			yield assert.isRejected(feedItem.saveTx(), /^Error: Cannot edit feedItem in read-only Zotero library$/);
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
				cleanupAfter: 2
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
