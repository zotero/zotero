"use strict";

describe("Zotero.FeedReader", function () {
	
	var htmlUrl = getTestDataUrl("test.html");
	
	var rssFeedURL = getTestDataUrl("feed.rss");
	var rssFeedInfo = {
		title: 'Liftoff News',
		subtitle: 'Liftoff to Space Exploration.',
		updated: new Date("Tue, 10 Jun 2003 09:41:01 GMT"),
		creators: [{
			firstName: '',
			lastName: 'editor@example.com',
			creatorType: 'author',
			fieldMode: 1
		}],
		language: 'en-us'
	};
	
	var detailedRSSFeedURL = getTestDataUrl("feedDetailed.rss");
	var detailedRSSFeedInfo = {
		title: 'Feed',
		subtitle: 'Feed Description',
		creators: [{firstName: 'Feed', lastName: 'Author', creatorType: 'author'}],
		publicationTitle: 'Publication',
		publisher: 'Publisher',
		rights: '©2016 Published by Publisher',
		ISSN: '0000-0000',
		language: 'en'
	};
	
	var atomFeedURL = getTestDataUrl("feed.atom");
	var atomFeedInfo = {
		title: 'Incircular nets and confocal conics',
		updated: new Date("Tue, 10 Jun 2003 09:41:01 GMT"),
		creators: [{
			firstName: '',
			lastName: 'editor@example.com',
			creatorType: 'author',
			fieldMode: 1
		}],
		language: 'en-us'
	};
	
	after(function* () {
		yield clearFeeds();
	});

	describe('FeedReader()', function () {
		it('should throw if url not provided', function() {
			assert.throw(() => new Zotero.FeedReader())
		});
		
		it('should throw if url invalid', function() {
			assert.throw(() => new Zotero.FeedReader('invalid url'))
		});
	});
	
	describe('#process()', function() {
		it('should reject if the provided url is not a valid feed', function* () {
			let fr = new Zotero.FeedReader(htmlUrl);
			let e = yield getPromiseError(fr.process());
			assert.ok(e);
			e = yield getPromiseError(fr._feedItems[fr._feedItems.length-1].promise);
			assert.ok(e);
		});
		
		it('should set #feedProperties on FeedReader object', function* () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			assert.throw(() => fr.feedProperties);
			yield fr.process();
			assert.ok(fr.feedProperties);
		});
	});
	
	describe('#terminate()', function() {
		it('should reject last feed item and feed processing promise if feed not processed yet', function* () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			fr.terminate("test");
			let e = yield getPromiseError(fr.process());
			assert.ok(e);
			e = yield getPromiseError(fr._feedItems[fr._feedItems.length-1].promise);
			assert.ok(e);
		});
		
		it('should reject last feed item if feed processed', function* () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			yield fr.process();
			fr.terminate("test");
			let e = yield getPromiseError(fr._feedItems[fr._feedItems.length-1].promise);
			assert.ok(e);
		});
	});
	
	describe('#feedProperties', function() {
		it('should throw if accessed before feed is processed', function () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			assert.throw(() => fr.feedProperties);
		});
		
		it('should have correct values for a sparse feed', function* () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			yield fr.process();
			assert.deepEqual(fr.feedProperties, rssFeedInfo);
		});
		
		it('should have correct values for a detailed feed', function* () {
			let fr = new Zotero.FeedReader(detailedRSSFeedURL);
			yield fr.process();
			assert.deepEqual(fr.feedProperties, detailedRSSFeedInfo);
		});
	});
	
	describe('#ItemIterator()', function() {
		it('should throw if called before feed is resolved', function() {
			let fr = new Zotero.FeedReader(rssFeedURL);
			assert.throw(() => new fr.ItemIterator);
		});
		
		it('should parse items correctly for a sparse RSS feed', function* () {
			let expected = { guid: 'http://liftoff.msfc.nasa.gov/2003/06/03.html#item573',
				title: 'Star City',
				abstractNote: 'How do Americans get ready to work with Russians aboard the International Space Station? They take a crash course in culture, language and protocol at Russia\'s Star City.',
				url: 'http://liftoff.msfc.nasa.gov/news/2003/news-starcity.asp',
				creators: [{ firstName: '', lastName: 'editor@example.com', creatorType: 'author', fieldMode: 1 }],
				date: 'Tue, 03 Jun 2003 09:39:21 GMT',
				language: 'en-us',
				itemType: 'journalArticle',
				enclosedItems: [{ url: 'http://www.example.com/example.pdf', contentType: 'application/pdf' }]
			};
		
			let fr = new Zotero.FeedReader(rssFeedURL);
			yield fr.process();
			let itemIterator = new fr.ItemIterator();
			let item = yield itemIterator.next().value;
			assert.deepEqual(item, expected);
		});
		
		it('should parse items correctly for a detailed RSS feed', function* () {
			let expected = {
				guid: 'http://www.example.com/item1',
				title: 'Title 1',
				abstractNote: 'Description 1',
				url: 'http://www.example.com/item1',
				creators: [
					{ firstName: 'Author1 A. T.', lastName: 'Rohtua', creatorType: 'author' },
					{ firstName: 'Author2 A.', lastName: 'Auth', creatorType: 'author' },
					{ firstName: 'Author3', lastName: 'Autho', creatorType: 'author' },
					{ firstName: 'Contributor1 A. T.', lastName: 'Rotubirtnoc', creatorType: 'contributor' },
					{ firstName: 'Contributor2 C.', lastName: 'Contrib', creatorType: 'contributor' },
					{ firstName: 'Contributor3', lastName: 'Contr', creatorType: 'contributor' }
				],
				date: '2016-01-07',
				publicationTitle: 'Publication',
				ISSN: '0000-0000',
				publisher: 'Publisher',
				rights: '©2016 Published by Publisher',
				language: 'en',
				itemType: 'journalArticle',
				enclosedItems: []
			};
		
			let fr = new Zotero.FeedReader(detailedRSSFeedURL);
			yield fr.process();
			let itemIterator = new fr.ItemIterator();
			let item = yield itemIterator.next().value;
			assert.deepEqual(item, expected);
		});
		
		it("should parse item from an Atom feed", function* () {
			let expected = {
				guid: 'http://www.example.com/item1',
				title: 'Title 1',
				abstractNote: 'Abstract 1',
				url: 'http://www.example.com/item1',
				creators: [
					{ firstName: 'Author1 A. T.', lastName: 'Rohtua', creatorType: 'author' },
					{ firstName: 'Author2 A.', lastName: 'Auth', creatorType: 'author' }
				],
				// TODO: DOI?
				date: '2017-10-27T12:27:09Z',
				itemType: 'journalArticle',
				enclosedItems: []
			};
			
			let fr = new Zotero.FeedReader(atomFeedURL);
			yield fr.process();
			let itemIterator = new fr.ItemIterator();
			let item = yield itemIterator.next().value;
			
			assert.deepEqual(item, expected);
		});
		
		it('should resolve last item with null', function* () {
			let fr = new Zotero.FeedReader(rssFeedURL);
			yield fr.process();
			let itemIterator = new fr.ItemIterator();
			let item;
			while(item = yield itemIterator.next().value);
			assert.isNull(item);
		});
	});
})