describe("Zotero.Feeds", function () {
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
	
	let clearFeeds = Zotero.Promise.coroutine(function* () {
		let feeds = Zotero.Feeds.getAll();
		yield Zotero.DB.executeTransaction(function* () {
			for (let i=0; i<feeds.length; i++) {
				yield feeds[i].erase();
			}
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
})
