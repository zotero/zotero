describe("Zotero.FeedItem", function () {
	let feed, libraryID;
	before(function* () {
		feed = yield createFeed({ name: 'Test ' + Zotero.randomString(), url: 'http://' + Zotero.randomString() + '.com/' });
		yield feed.saveTx();
		libraryID = feed.libraryID;
	});
	after(function() {
		return clearFeeds();
	});
	
	it("should be an instance of Zotero.Item", function() {
		assert.instanceOf(new Zotero.FeedItem(), Zotero.Item);
	});
	describe("#libraryID", function() {
		it("should reference a feed", function() {
			let feedItem = new Zotero.FeedItem();
			assert.doesNotThrow(function() {feedItem.libraryID = feed.libraryID});
			assert.throws(function() {feedItem.libraryID = Zotero.Libraries.userLibraryID}, /^libraryID must reference a feed$/);
		});
	});
	describe("#constructor()", function* () {
		it("should accept required fields as arguments", function* () {
			let guid = Zotero.randomString();
			let feedItem = new Zotero.FeedItem();
			yield assert.isRejected(feedItem.saveTx());
			
			feedItem = new Zotero.FeedItem('book', { guid });
			feedItem.libraryID = libraryID;
			yield assert.isFulfilled(feedItem.saveTx());
			
			assert.equal(feedItem.itemTypeID, Zotero.ItemTypes.getID('book'));
			assert.equal(feedItem.guid, guid);
			assert.equal(feedItem.libraryID, libraryID);
		});
	});
	describe("#isFeedItem", function() {
		it("should be true", function() {
			let feedItem = new Zotero.FeedItem();
			assert.isTrue(feedItem.isFeedItem);
		});
		it("should be falsy for regular item", function() {
			let item = new Zotero.Item();
			assert.notOk(item.isFeedItem);
		})
	});
	describe("#guid", function() {
		it("should not be settable to a non-string value", function() {
			let feedItem = new Zotero.FeedItem();
			assert.throws(() => feedItem.guid = 1);
		});
		it("should be settable to any string", function() {
			let feedItem = new Zotero.FeedItem();
			feedItem.guid = 'foo';
			assert.equal(feedItem.guid, 'foo');
		});
		it("should not be possible to change guid after saving item", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID });
			assert.throws(() => feedItem.guid = 'bar');
		});
	});
	describe("#isRead", function() {
		it("should be false by default", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID });
			assert.isFalse(feedItem.isRead);
		});
		it("should be settable and persist after saving", function* () {
			this.timeout(5000);
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			assert.isFalse(feedItem.isRead);
			
			let expectedTimestamp = Date.now();
			feedItem.isRead = true;
			assert.isTrue(feedItem.isRead);
			let readTime = Zotero.Date.sqlToDate(feedItem._feedItemReadTime, true).getTime();
			assert.closeTo(readTime, expectedTimestamp, 2000, 'sets the read timestamp to current time');
			
			feedItem.isRead = false;
			assert.isFalse(feedItem.isRead);
			assert.notOk(feedItem._feedItemReadTime);
			
			expectedTimestamp = Date.now();
			feedItem.isRead = true;
			yield Zotero.Promise.delay(2001);
			yield feedItem.saveTx();
			
			readTime = yield Zotero.DB.valueQueryAsync('SELECT readTime FROM feedItems WHERE itemID=?', feedItem.id);
			readTime = Zotero.Date.sqlToDate(readTime, true).getTime();
			assert.closeTo(readTime, expectedTimestamp, 2000, 'read timestamp is correct in the DB');
		});
	});
	describe("#fromJSON()", function() {
		it("should attempt to parse non ISO-8601 dates", function* () {
			Zotero.locale = 'en-US';
			var data = [
				{
					itemType: "journalArticle",
					date: "2015-06-07 20:56:00" // sql
				},
				{
					itemType: "journalArticle",
					date: "Mon, 13 Jun 2016 06:25:57 EDT" // HTTP
				},
				{
					itemType: "journalArticle",
					date: "18-20 June 2015" // parsed by `strToDate`
				},
				{
					itemType: "journalArticle",
					date: "06/07/2015" // american format also parsed by `strToDate`
				}
			];
			var expectedDates = [
				'2015-06-07 20:56:00',
				'2016-06-13 10:25:57',
				'2015-06-18',
				'2015-06-07'
			];
			for (let i = 0; i < data.length; i++) {
				var item = new Zotero.FeedItem;
				item.fromJSON(data[i]);
				assert.strictEqual(item.getField('date'), expectedDates[i]);
			}
		})
	});
	describe("#save()", function() {
		it("should require feed being set", function* () {
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			// Defaults to user library ID
			yield assert.isRejected(feedItem.saveTx(), /^Cannot add /);
		});
		it("should require GUID being set", function* () {
			let feedItem = new Zotero.FeedItem('book');
			feedItem.libraryID = feed.libraryID;
			yield assert.isRejected(feedItem.saveTx(),  /^GUID must be set before saving FeedItem$/);
		});
		it("should require a unique GUID", function* () {
			let guid = Zotero.randomString();
			let feedItem1 = yield createDataObject('feedItem', { libraryID, guid });
			
			let feedItem2 = createUnsavedDataObject('feedItem', { libraryID, guid });
			yield assert.isRejected(feedItem2.saveTx());
			
			// But we should be able to save it after deleting the original feed
			yield feedItem1.eraseTx();
			yield assert.isFulfilled(feedItem2.saveTx());
		});
		it("should require item type being set", function* () {
			let feedItem = new Zotero.FeedItem(null, { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			yield assert.isRejected(feedItem.saveTx(),  /^Item type must be set before saving$/);
		});
		it("should save feed item", function* () {
			let guid = Zotero.randomString();
			let feedItem = createUnsavedDataObject('feedItem', { libraryID, guid });
			yield assert.isFulfilled(feedItem.saveTx());
			
			feedItem = yield Zotero.FeedItems.getAsync(feedItem.id);
			assert.ok(feedItem);
			assert.equal(feedItem.guid, guid);
		});
		it.skip("should support saving feed items with all types and fields", function* () {
			this.timeout(60000);
			let allTypesAndFields = loadSampleData('allTypesAndFields'),
				feedItems = [];
			for (let type in allTypesAndFields) {
				let feedItem = new Zotero.FeedItem(null, type, feed.libraryID);
				feedItem.fromJSON(allTypesAndFields[type]);
				
				yield feedItem.saveTx();
				
				feedItems.push(feedItem);
			}
			
			let feedItemsJSON = {};
			for (let i=0; i<feedItems.length; i++) {
				let feed = feedItems[i];
				feedItemsJSON[feed.guid] = feed.toJSON();
			}
			
			assert.deepEqual(feedItemsJSON, allTypesAndFields);
		});
		it("should allow saving after editing data", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID });
			
			feedItem.setField('title', 'bar');
			yield assert.isFulfilled(feedItem.saveTx());
			assert.equal(feedItem.getField('title'), 'bar');
		});
	});
	describe("#erase()", function() {
		it("should erase an existing feed item", function* () {
			let feedItem = yield createDataObject('feedItem', { libraryID });
			
			yield feedItem.eraseTx();
			assert.isFalse(yield Zotero.FeedItems.getAsync(feedItem.id));
			
			//yield assert.isRejected(feedItem.EraseTx(), "does not allow erasing twice");
		});
	});
	
	describe("#toggleRead()", function() {
		it('should toggle state', function* () {
			let item = yield createDataObject('feedItem', { libraryID });
			item.isRead = false;
			yield item.saveTx();
			
			yield item.toggleRead();
			assert.isTrue(item.isRead, "item is toggled to read state");
		});
		it('should save if specified state is different from current', function* (){
			let item = yield createDataObject('feedItem', { libraryID });
			item.isRead = false;
			yield item.saveTx();
			sinon.spy(item, 'save');

			yield item.toggleRead(true);
			assert.isTrue(item.save.called, "item was saved on toggle read");
			
			item.save.resetHistory();
			
			yield item.toggleRead(true);
			assert.isFalse(item.save.called, "item was not saved on toggle read to same state");
		});
	});
	
	describe('#translate()', function() {
		var win;
		
		before(function* () {
			// TEMP: Fix for slow translator initialization on Linux/Travis
			this.timeout(20000);
			yield Zotero.Translators.init();
			
			// Needs an open window to be able to create a hidden window for translation
			win = yield loadBrowserWindow();
		});
		
		after(function () {
			win.close()
		});
		
		it('should translate and save items', function* () {
			var feedItem = yield createDataObject('feedItem', {libraryID});
			var url = getTestDataUrl('metadata/journalArticle-single.html');
			feedItem.setField('url', url);
			yield feedItem.saveTx();
			
			yield feedItem.translate();
			
			assert.equal(feedItem.getField('title'), 'Scarcity or Abundance? Preserving the Past in a Digital Era');
		});
		it('should translate and save items to corresponding library and collection', function* () {
			let group = yield createGroup();
			let collection = yield createDataObject('collection', {libraryID: group.libraryID});
			
			var feedItem = yield createDataObject('feedItem', {libraryID});
			var url = getTestDataUrl('metadata/journalArticle-single.html');
			feedItem.setField('url', url);
			yield feedItem.saveTx();
			
			yield feedItem.translate(group.libraryID, collection.id);
			
			let item = collection.getChildItems(false, false)[0];
						
			assert.equal(item.getField('title'), 'Scarcity or Abundance? Preserving the Past in a Digital Era');	
		});
		it('should clone the item to corresponding library and collection if no translators available', function* () {
			let group = yield createGroup();
			let collection = yield createDataObject('collection', {libraryID: group.libraryID});
			
			var feedItem = yield createDataObject('feedItem', {libraryID, title: 'test'});
			var url = getTestDataUrl('test.html');
			feedItem.setField('url', url);
			yield feedItem.saveTx();
			
			yield feedItem.translate(group.libraryID, collection.id);
			
			let item = collection.getChildItems(false, false)[0];
						
			assert.equal(item.getField('title'), 'test');
		});
	});
});
