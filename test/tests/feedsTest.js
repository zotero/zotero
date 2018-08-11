describe("Zotero.Feeds", function () {
	
	after(function* () {
		yield clearFeeds();
	});
	
	describe('#importFromOPML', function() {
		var opmlUrl = getTestDataUrl("feeds.opml");
		var opmlString;
		
		before(function* (){
			opmlString = yield Zotero.File.getContentsFromURLAsync(opmlUrl);
			sinon.stub(Zotero.Feeds, 'updateFeeds').resolves();
		});
		
		beforeEach(function* () {
			yield clearFeeds();
		});
		
		after(function() {
			Zotero.Feeds.updateFeeds.restore();
		});
		
		it('imports feeds correctly', function* (){
			let shouldExist = {
				"http://example.com/feed1.rss": "A title 1",
				"http://example.com/feed2.rss": "A title 2",
				"http://example.com/feed3.rss": "A title 3",
				"http://example.com/feed4.rss": "A title 4"
			};
			yield Zotero.Feeds.importFromOPML(opmlString);
			let feeds = Zotero.Feeds.getAll();
			for (let feed of feeds) {
				assert.equal(shouldExist[feed.url], feed.name, "Feed exists and title matches");
				delete shouldExist[feed.url];
			}
			assert.equal(Object.keys(shouldExist).length, 0, "All feeds from opml have been created");
		});
		
		it("doesn't fail if some feeds already exist", function* (){
			yield createFeed({url: "http://example.com/feed1.rss"});
			yield Zotero.Feeds.importFromOPML(opmlString)
		});
	});
	
	describe("#restoreFromJSON", function() {
		var json, expiredFeedURL, existingFeedURL;
		
		beforeEach(function* () {
			yield clearFeeds();
		
			json = {};
			for (let i = 0; i < 2; i++) {
				let url = "http://" + Zotero.Utilities.randomString(10, 'abcdefgh') + ".com/feed.rss";
				json[url] = {
					url,
					name: Zotero.Utilities.randomString(),
					refreshInterval: 5,
					cleanupReadAfter: 3,
					cleanupUnreadAfter: 30,
				};
				if (i == 0) {
					existingFeedURL = url;
					yield createFeed({url});
				}
			}
			expiredFeedURL = (yield createFeed()).url;
		});
		
		it("restores correctly when merge is true", function* () {
			let feeds = Zotero.Feeds.getAll();
			assert.equal(feeds.length, 2);
			
			yield Zotero.Feeds.restoreFromJSON(json, true);
			feeds = Zotero.Feeds.getAll();
			
			for (let url in json) {
				let feed = Zotero.Feeds.getByURL(url);
				assert.ok(feed, "new feed created");
			}	
			
			let expiredFeed = Zotero.Feeds.getByURL(expiredFeedURL);
			assert.ok(expiredFeed, "does not remove feeds not in JSON");

			let existingFeed = Zotero.Feeds.getByURL(existingFeedURL);
			assert.ok(existingFeed, "does not remove feeds in database and JSON");
		});
		
		it("restores correctly when merge is false", function* () {
			let feeds = Zotero.Feeds.getAll();
			assert.equal(feeds.length, 2);
			
			yield Zotero.Feeds.restoreFromJSON(json);
			feeds = Zotero.Feeds.getAll();
			
			for (let url in json) {
				let feed = Zotero.Feeds.getByURL(url);
				assert.ok(feed, "new feed created");
			}	
			
			let expiredFeed = Zotero.Feeds.getByURL(expiredFeedURL);
			assert.notOk(expiredFeed, "removes feeds not in JSON");

			let existingFeed = Zotero.Feeds.getByURL(existingFeedURL);
			assert.ok(existingFeed, "does not remove feeds in database and JSON");
		});
	});

	describe("#haveFeeds()", function() {
		it("should return false for a DB without feeds", function* () {
			yield clearFeeds();
			assert.isFalse(Zotero.Feeds.haveFeeds(), 'no feeds in empty DB');
			
			let group = yield createGroup();
			
			assert.isFalse(Zotero.Feeds.haveFeeds(), 'no feeds in DB with groups');
		});
		it("should return true for a DB containing feeds", function* () {
			let feed = yield createFeed();
			
			assert.isTrue(Zotero.Feeds.haveFeeds());
		});
	});
	describe("#getAll()", function() {
		it("should return an empty array for a DB without feeds", function* () {
			yield clearFeeds();
			let feeds = Zotero.Feeds.getAll();
			assert.lengthOf(feeds, 0, 'no feeds in an empty DB');
			
			let group = yield createGroup();
			
			feeds = Zotero.Feeds.getAll();
			assert.lengthOf(feeds, 0, 'no feeds in DB with group libraries');
		});
		it("should return an array of feeds", function* () {
			yield clearFeeds();
			let feed1 = yield createFeed();
			let feed2 = yield createFeed();
			
			let feeds = Zotero.Feeds.getAll();
			assert.lengthOf(feeds, 2);
			assert.sameMembers(feeds, [feed1, feed2]);
		});
	});
	
	describe('#getByURL', function() {
		it("should return a feed by url", function* () {
			let url = 'http://' + Zotero.Utilities.randomString(10, 'abcdefg') + '.com/feed.rss';
			yield createFeed({url});
			let feed = Zotero.Feeds.getByURL(url);
			assert.ok(feed);
			assert.equal(feed.url, url);
		});
		it("should return undefined if feed does not exist", function* () {
			var feed;
			assert.doesNotThrow(function() {
				feed = Zotero.Feeds.getByURL('doesnotexist');
			});
			assert.isUndefined(feed);
		});
	});
	describe('#updateFeeds', function() {
		var freshFeed, recentFeed, oldFeed;
		var _updateFeed;
	
		before(function* () {
			yield clearFeeds();
		
			sinon.stub(Zotero.Feeds, 'scheduleNextFeedCheck').resolves();
			_updateFeed = sinon.stub(Zotero.Feed.prototype, '_updateFeed').resolves();
			let url = getTestDataUrl("feed.rss");
			
			freshFeed = yield createFeed({refreshInterval: 2});
			freshFeed._feedUrl = url;
			freshFeed.lastCheck = null;
			yield freshFeed.saveTx();
			
			recentFeed = yield createFeed({refreshInterval: 2});
			recentFeed._feedUrl = url;
			recentFeed.lastCheck = Zotero.Date.dateToSQL(new Date(), true);
			yield recentFeed.saveTx();
			
			oldFeed = yield createFeed({refreshInterval: 2});
			oldFeed._feedUrl = url;
			oldFeed.lastCheck = Zotero.Date.dateToSQL(new Date(Date.now() - 1000*60*60*6), true);
			yield oldFeed.saveTx();
			
			yield Zotero.Feeds.updateFeeds();
			assert.isTrue(_updateFeed.called);
		});
		
		after(function() {
			Zotero.Feeds.scheduleNextFeedCheck.restore();
			_updateFeed.restore();
		});
		
		it('should update feeds that have never been updated', function() {
			for (var feed of _updateFeed.thisValues) {
				if (feed.id == freshFeed.id) {
					break;
				}
			}
			assert.isTrue(feed._updateFeed.called);
		});
		it('should update feeds that need updating since last check', function() {
			for (var feed of _updateFeed.thisValues) {
				if (feed.id == oldFeed.id) {
					break;
				}
			}
			assert.isTrue(feed._updateFeed.called);
		});
		it("should not update feeds that don't need updating", function() {
			for (var feed of _updateFeed.thisValues) {
				if (feed.id != recentFeed.id) {
					break;
				}
				// should never reach
				assert.ok(null, "does not update feed that did not need updating")
			}
		});
	});
	describe('#scheduleNextFeedCheck()', function() {
		it('schedules next feed check', function* () {
			sinon.spy(Zotero.Feeds, 'scheduleNextFeedCheck');
			sinon.spy(Zotero.Promise, 'delay');
			
			yield clearFeeds();
			let feed = yield createFeed({refreshInterval: 1});
			feed._set('_feedLastCheck', Zotero.Date.dateToSQL(new Date(), true));
			yield feed.saveTx();

			yield Zotero.Feeds.scheduleNextFeedCheck();
			
			// Allow a propagation delay of 5000ms
			assert.isTrue(Zotero.Promise.delay.args[0][0] - 1000*60*60 <= 5000);
			
			Zotero.Feeds.scheduleNextFeedCheck.restore();
			Zotero.Promise.delay.restore();
		});
	})
})
