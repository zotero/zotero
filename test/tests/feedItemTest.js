describe("Zotero.FeedItem", function () {
	let feed, libraryID;
	before(function* () {
		feed = yield createFeed({ name: 'Test ' + Zotero.randomString(), url: 'http://' + Zotero.randomString() + '.com/' });
		yield feed.saveTx();
		libraryID = feed.libraryID;
	});
	after(function () {
		return clearFeeds();
	});
	
	it("should be an instance of Zotero.Item", function () {
		assert.instanceOf(new Zotero.FeedItem(), Zotero.Item);
	});
	describe("#libraryID", function () {
		it("should reference a feed", function () {
			let feedItem = new Zotero.FeedItem();
			assert.doesNotThrow(function () {feedItem.libraryID = feed.libraryID});
			assert.throws(function () {feedItem.libraryID = Zotero.Libraries.userLibraryID}, /^libraryID must reference a feed$/);
		});
	});
	describe("#constructor()", function* () {
		it("should accept required fields as arguments", async function () {
			let guid = Zotero.randomString();
			let feedItem = new Zotero.FeedItem();
			await assert.isRejected(feedItem.saveTx());
			
			feedItem = new Zotero.FeedItem('book', { guid });
			feedItem.libraryID = libraryID;
			await assert.isFulfilled(feedItem.saveTx());
			
			assert.equal(feedItem.itemTypeID, Zotero.ItemTypes.getID('book'));
			assert.equal(feedItem.guid, guid);
			assert.equal(feedItem.libraryID, libraryID);
		});
	});
	describe("#isFeedItem", function () {
		it("should be true", function () {
			let feedItem = new Zotero.FeedItem();
			assert.isTrue(feedItem.isFeedItem);
		});
		it("should be falsy for regular item", function () {
			let item = new Zotero.Item();
			assert.notOk(item.isFeedItem);
		})
	});
	describe("#guid", function () {
		it("should not be settable to a non-string value", function () {
			let feedItem = new Zotero.FeedItem();
			assert.throws(() => feedItem.guid = 1);
		});
		it("should be settable to any string", function () {
			let feedItem = new Zotero.FeedItem();
			feedItem.guid = 'foo';
			assert.equal(feedItem.guid, 'foo');
		});
		it("should not be possible to change guid after saving item", async function () {
			let feedItem = await createDataObject('feedItem', { libraryID });
			assert.throws(() => feedItem.guid = 'bar');
		});
	});
	describe("#isRead", function () {
		it("should be false by default", async function () {
			let feedItem = await createDataObject('feedItem', { libraryID });
			assert.isFalse(feedItem.isRead);
		});
		it("should be settable and persist after saving", async function () {
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
			await Zotero.Promise.delay(2001);
			await feedItem.saveTx();
			
			readTime = await Zotero.DB.valueQueryAsync('SELECT readTime FROM feedItems WHERE itemID=?', feedItem.id);
			readTime = Zotero.Date.sqlToDate(readTime, true).getTime();
			assert.closeTo(readTime, expectedTimestamp, 2000, 'read timestamp is correct in the DB');
		});
	});
	describe("#fromJSON()", function () {
		it("should attempt to parse non ISO-8601 dates", async function () {
			Zotero.locale = 'en-US';
			Zotero.Date.init();
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
	describe("#save()", function () {
		it("should require feed being set", async function () {
			let feedItem = new Zotero.FeedItem('book', { guid: Zotero.randomString() });
			// Defaults to user library ID
			await assert.isRejected(feedItem.saveTx(), /^Cannot add /);
		});
		it("should require GUID being set", async function () {
			let feedItem = new Zotero.FeedItem('book');
			feedItem.libraryID = feed.libraryID;
			await assert.isRejected(feedItem.saveTx(),  /^GUID must be set before saving FeedItem$/);
		});
		it("should require a unique GUID", async function () {
			let guid = Zotero.randomString();
			let feedItem1 = await createDataObject('feedItem', { libraryID, guid });
			
			let feedItem2 = createUnsavedDataObject('feedItem', { libraryID, guid });
			await assert.isRejected(feedItem2.saveTx());
			
			// But we should be able to save it after deleting the original feed
			await feedItem1.eraseTx();
			await assert.isFulfilled(feedItem2.saveTx());
		});
		it("should require item type being set", async function () {
			let feedItem = new Zotero.FeedItem(null, { guid: Zotero.randomString() });
			feedItem.libraryID = feed.libraryID;
			await assert.isRejected(feedItem.saveTx(),  /^Item type must be set before saving$/);
		});
		it("should save feed item", async function () {
			let guid = Zotero.randomString();
			let feedItem = createUnsavedDataObject('feedItem', { libraryID, guid });
			await assert.isFulfilled(feedItem.saveTx());
			
			feedItem = await Zotero.FeedItems.getAsync(feedItem.id);
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
		it("should allow saving after editing data", async function () {
			let feedItem = await createDataObject('feedItem', { libraryID });
			
			feedItem.setField('title', 'bar');
			await assert.isFulfilled(feedItem.saveTx());
			assert.equal(feedItem.getField('title'), 'bar');
		});
	});
	describe("#erase()", function () {
		it("should erase an existing feed item", async function () {
			let feedItem = await createDataObject('feedItem', { libraryID });
			
			await feedItem.eraseTx();
			assert.isFalse(await Zotero.FeedItems.getAsync(feedItem.id));
			
			//yield assert.isRejected(feedItem.EraseTx(), "does not allow erasing twice");
		});
	});
	
	describe("#toggleRead()", function () {
		it('should toggle state', async function () {
			let item = await createDataObject('feedItem', { libraryID });
			item.isRead = false;
			await item.saveTx();
			
			await item.toggleRead();
			assert.isTrue(item.isRead, "item is toggled to read state");
		});
		it('should save if specified state is different from current', async function () {
			let item = await createDataObject('feedItem', { libraryID });
			item.isRead = false;
			await item.saveTx();
			sinon.spy(item, 'save');

			await item.toggleRead(true);
			assert.isTrue(item.save.called, "item was saved on toggle read");
			
			item.save.resetHistory();
			
			await item.toggleRead(true);
			assert.isFalse(item.save.called, "item was not saved on toggle read to same state");
		});
	});
	
	describe('#translate()', function () {
		var win;
		
		before(function* () {
			// TEMP: Fix for slow translator initialization on Linux/Travis
			this.timeout(20000);
			yield Zotero.Translators.init();
			
			// Needs an open window to be able to create a progress window
			win = yield loadZoteroWindow();
		});
		
		after(function () {
			win.close()
		});
		
		it('should translate and save items', async function () {
			var feedItem = await createDataObject('feedItem', {libraryID});
			var url = getTestDataUrl('metadata/journalArticle-single.html');
			feedItem.setField('url', url);
			await feedItem.saveTx();
			
			await feedItem.translate();
			
			assert.equal(feedItem.getField('title'), 'Scarcity or Abundance? Preserving the Past in a Digital Era');
		});
		it('should translate and save items to corresponding library and collection', async function () {
			let group = await createGroup();
			let collection = await createDataObject('collection', {libraryID: group.libraryID});
			
			var feedItem = await createDataObject('feedItem', {libraryID});
			var url = getTestDataUrl('metadata/journalArticle-single.html');
			feedItem.setField('url', url);
			await feedItem.saveTx();
			
			await feedItem.translate(group.libraryID, collection.id);
			
			let item = collection.getChildItems(false, false)[0];
						
			assert.equal(item.getField('title'), 'Scarcity or Abundance? Preserving the Past in a Digital Era');	
		});
		it('should clone the item to corresponding library and collection if no translators available', async function () {
			let group = await createGroup();
			let collection = await createDataObject('collection', {libraryID: group.libraryID});
			
			var feedItem = await createDataObject('feedItem', {libraryID, title: 'test'});
			var url = getTestDataUrl('test.html');
			feedItem.setField('url', url);
			await feedItem.saveTx();
			
			await feedItem.translate(group.libraryID, collection.id);
			
			let item = collection.getChildItems(false, false)[0];
						
			assert.equal(item.getField('title'), 'test');
		});
	});
});
