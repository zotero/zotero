describe("Zotero.Feeds", function () {
	
	after(function* () {
		yield clearFeeds();
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
	describe('#updateFeeds', function() {
		var freshFeed, recentFeed, oldFeed;
		var _updateFeed;
	
		before(function* () {
			yield clearFeeds();
		
			sinon.stub(Zotero.Feeds, 'scheduleNextFeedCheck');
			_updateFeed = sinon.stub(Zotero.Feed.prototype, '_updateFeed').resolves();
			let url = getTestDataItemUrl("feed.rss");
			
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
				assert.isOk(null, "does not update feed that did not need updating")
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
