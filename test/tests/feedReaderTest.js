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
	
	var richTextRSSFeedURL = getTestDataUrl("feedRichText.rss");
	var cdataRSSFeedURL = getTestDataUrl("feedCDATA.rss");
	var articleMetadataRSSFeedURL = getTestDataUrl("feedArticleMetadata.rss");
	var atomFeedURL = getTestDataUrl("feed.atom");
	var mediaFeedURL = getTestDataUrl("feedMedia.xml");
	
	var win;
	
	before(async function() {
		// Browser window is needed as parent window to load the feed reader scripts.
		win = await loadZoteroWindow();
	});

	after(async function() {
		if (win) {
			win.close();
		}
		await clearFeeds();
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
				abstractNote: 'How do Americans get ready to work with Russians aboard the International Space Station? They take a crash course in culture, language and protocol at Russia\'s <a xmlns="http://www.w3.org/1999/xhtml" href="http://howe.iki.rssi.ru/GCTC/gctc_e.htm">Star City</a>.',
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
				section: 'Article',
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
		
		it('should parse items correctly for an RSS feed with journal article metadata', function* () {
			let expected = {
				guid: 'https://www.mdpi.com/2311-5521/9/6/120',
				title: 'Environmental Hydraulics, Turbulence, and Sediment Transport, Second Edition',
				abstractNote: 'Abstract',
				url: 'https://www.mdpi.com/2311-5521/9/6/120',
				creators: [
					{ firstName: 'Jaan H.', lastName: 'Pu', creatorType: 'author' },
					{ firstName: 'Manish', lastName: 'Pandey', creatorType: 'author' },
					{ firstName: 'Prashanth Reddy', lastName: 'Hanmaiahgari', creatorType: 'author' }
				],
				date: '2024-05-22',
				publicationTitle: 'Fluids',
				pages: '120',
				DOI: '10.3390/fluids9060120',
				volume: '9',
				issue: '6',
				section: 'Editorial',
				publisher: 'MDPI',
				rights: 'Creative Commons Attribution (CC-BY)',
				language: 'en',
				itemType: 'journalArticle',
				enclosedItems: []
			};
		
			let fr = new Zotero.FeedReader(articleMetadataRSSFeedURL);
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
					{ firstName: 'Author2 A.', lastName: 'Auth', creatorType: 'author' },
					{ firstName: 'Author3 Z.', lastName: 'McAuthorton', creatorType: 'author' },
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
		
		it('should preserve tags in text fields', async () => {
			const fr = new Zotero.FeedReader(richTextRSSFeedURL);
			await fr.process();
			const itemIterator = new fr.ItemIterator();
			let item;
			for (let i = 0; i < 2; i++) {
				// eslint-disable-next-line no-await-in-loop
				item = await itemIterator.next().value;
			}
			
			// The entry title is text only, so tags are just more text.
			assert.equal(item.title, "Embedded <b>tags</b>");
		});

		it('should use content as abstractNote when available', async () => {
			const fr = new Zotero.FeedReader(richTextRSSFeedURL);
			await fr.process();
			const itemIterator = new fr.ItemIterator();
			let item;
			for (let i = 0; i < 3; i++) {
				item = await itemIterator.next().value;
			}

			assert.include(item.abstractNote, '<blink');
		});

		it('should parse HTML fields', async () => {
			const fr = new Zotero.FeedReader(richTextRSSFeedURL);
			await fr.process();
			const itemIterator = new fr.ItemIterator();
			let item;
			for (let i = 0; i < 2; i++) {
				// eslint-disable-next-line no-await-in-loop
				item = await itemIterator.next().value;
			}

			assert.equal(item.abstractNote, 'The proposed <b xmlns="http://www.w3.org/1999/xhtml">VASIMR</b> engine would do that.');
		});

		it('should parse CDATA as text', async () => {
			const fr = new Zotero.FeedReader(cdataRSSFeedURL);
			await fr.process();
			const itemIterator = new fr.ItemIterator();
			const item = await itemIterator.next().value;
			
			assert.equal(item.title, `"The Descent of Man," 150 years on`);
			assert.equal(item.creators[0].lastName, "Fuentes");
		});

		it('should parse enclosed media', async () => {
			const fr = new Zotero.FeedReader(mediaFeedURL);
			await fr.process();
			const itemIterator = new fr.ItemIterator();
			const item = await itemIterator.next().value;
			
			assert.equal(item.enclosedItems.length, 1);
			assert.equal(item.enclosedItems[0].url, "https://static01.nyt.com/images/2021/06/16/world/16biden-photos1/16biden-photos1-moth.jpg");
		});
	});

	describe("Legacy text encodings", function () {
		var httpd;
		var port;
		var baseURL;

		before(async function () {
			({ httpd, port, baseURL } = await startHTTPServer());

			httpd._handler._mimeMappings.rss = "text/xml; charset=ISO-8859-1";

			httpd.registerPathHandler("/feedWindows1252.rss", {
				handle(request, response) {
					response.setStatusLine(null, 200, 'OK');
					let file = getTestDataDirectory();
					file.append("feedWindows1252.rss");
					httpd._handler._writeFileResponse(request, file, response, 0, file.fileSize);
				}
			});
		});
		
		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});
		
		it("should handle an ISO-8859-1 (windows-1252) feed", async function () {
			let fr = new Zotero.FeedReader(baseURL + "feedWindows1252.rss");
			await fr.process();
			let itemIterator = new fr.ItemIterator();
			let item = await itemIterator.next().value;
			assert.equal(item.title, "Skriftlig spørsmål fra Tage Pettersen (H) til helse- og omsorgsministeren. Til behandling");
		});
	});
})
