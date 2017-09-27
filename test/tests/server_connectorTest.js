"use strict";

describe("Connector Server", function () {
	Components.utils.import("resource://zotero-unit/httpd.js");
	var win, connectorServerPath, testServerPath, httpd;
	var testServerPort = 16213;
	
	before(function* () {
		this.timeout(20000);
		Zotero.Prefs.set("httpServer.enabled", true);
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		yield Zotero.Translators.init();
		
		win = yield loadZoteroPane();
		connectorServerPath = 'http://127.0.0.1:' + Zotero.Prefs.get('httpServer.port');
	});
	
	beforeEach(function () {
		// Alternate ports to prevent exceptions not catchable in JS
		testServerPort += (testServerPort & 1) ? 1 : -1;
		testServerPath = 'http://127.0.0.1:' + testServerPort;
		httpd = new HttpServer();
		httpd.start(testServerPort);
	});
	
	afterEach(function* () {
		var defer = new Zotero.Promise.defer();
		httpd.stop(() => defer.resolve());
		yield defer.promise;
	});
	
	after(function () {
		win.close();
	});


	describe('/connector/getTranslatorCode', function() {
		it('should respond with translator code', function* () {
			var code = 'function detectWeb() {}\nfunction doImport() {}';
			var translator = buildDummyTranslator(4, code);
			sinon.stub(Zotero.Translators, 'get').returns(translator);

			var response = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/getTranslatorCode",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						translatorID: "dummy-translator",
					})
				}
			);

			assert.isTrue(Zotero.Translators.get.calledWith('dummy-translator'));
			let translatorCode = yield translator.getCode();
			assert.equal(response.response, translatorCode);

			Zotero.Translators.get.restore();
		})
	});
	
	
	describe("/connector/detect", function() {
		it("should return relevant translators with proxies", function* () {
			var code = 'function detectWeb() {return "newspaperArticle";}\nfunction doWeb() {}';
			var translator = buildDummyTranslator("web", code, {target: "https://www.example.com/.*"});
			sinon.stub(Zotero.Translators, 'getAllForType').resolves([translator]);
			
			var response = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/detect",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						uri: "https://www-example-com.proxy.example.com/article",
						html: "<head><title>Owl</title></head><body><p>🦉</p></body>"
					})
				}
			);
			
			assert.equal(JSON.parse(response.response)[0].proxy.scheme, 'https://%h.proxy.example.com/%p');

			Zotero.Translators.getAllForType.restore();
		});
	});
	
	
	describe("/connector/saveItems", function () {
		// TODO: Test cookies
		it("should save a translated item to the current selected collection", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			
			var body = {
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
						creators: [
							{
								firstName: "First",
								lastName: "Last",
								creatorType: "author"
							}
						],
						attachments: [
							{
								title: "Attachment",
								url: `${testServerPath}/attachment`,
								mimeType: "text/html"
							}
						]
					}
				],
				uri: "http://example.com"
			};
			
			httpd.registerPathHandler(
				"/attachment",
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write("<html><head><title>Title</title><body>Body</body></html>");
					}
				}
			);
			
			var promise = waitForItemEvent('add');
			var reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			
			// Check parent item
			var ids = yield promise;
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'newspaperArticle');
			assert.isTrue(collection.hasItem(item.id));
			
			// Check attachment
			promise = waitForItemEvent('add');
			ids = yield promise;
			assert.lengthOf(ids, 1);
			item = Zotero.Items.get(ids[0]);
			assert.isTrue(item.isImportedAttachment());
			
			// Wait until indexing is done
			yield waitForItemEvent('refresh');
			
			var req = yield reqPromise;
			assert.equal(req.status, 201);
		});
		
		
		it("should respond with 500 if read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield selectLibrary(win, group.libraryID);
			yield waitForItemsLoad(win);
			
			var body = {
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
						creators: [
							{
								firstName: "First",
								lastName: "Last",
								creatorType: "author"
							}
						],
						attachments: []
					}
				],
				uri: "http://example.com"
			};
			
			var req = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body),
					successCodes: false
				}
			);
			
			assert.equal(req.status, 500);
			assert.isFalse(JSON.parse(req.responseText).libraryEditable);
			
			// The selection should remain
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(), group.libraryID
			);
		});
		
		it("should use the provided proxy to deproxify item url", function* () {
			yield selectLibrary(win, Zotero.Libraries.userLibraryID);
			yield waitForItemsLoad(win);
			
			var body = {
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
						creators: [
							{
								firstName: "First",
								lastName: "Last",
								creatorType: "author"
							}
						],
						attachments: [],
						url: "https://www-example-com.proxy.example.com/path"
					}
				],
				uri: "https://www-example-com.proxy.example.com/path",
				proxy: {scheme: 'https://%h.proxy.example.com/%p', dotsToHyphens: true}
			};
			
			var promise = waitForItemEvent('add');
			var req = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			
			// Check item
			var ids = yield promise;
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.getField('url'), 'https://www.example.com/path');
		});
	});
	
	describe("/connector/saveSnapshot", function () {
		// TEMP: Wait for indexing to complete, which happens after a 1-second delay, after a 201 has
		// been returned to the connector. Would be better to make sure indexing has completed.
		afterEach(function* () {
			yield Zotero.Promise.delay(1050);
		});
		
		it("should save a webpage item and snapshot to the current selected collection", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			
			// saveSnapshot saves parent and child before returning
			var ids1, ids2;
			var promise = waitForItemEvent('add').then(function (ids) {
				ids1 = ids;
				return waitForItemEvent('add').then(function (ids) {
					ids2 = ids;
				});
			});
			yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						url: "http://example.com",
						html: "<html><head><title>Title</title><body>Body</body></html>"
					})
				}
			);
			
			assert.isTrue(promise.isFulfilled());
			
			// Check parent item
			assert.lengthOf(ids1, 1);
			var item = Zotero.Items.get(ids1[0]);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'webpage');
			assert.isTrue(collection.hasItem(item.id));
			assert.equal(item.getField('title'), 'Title');
			
			// Check attachment
			assert.lengthOf(ids2, 1);
			item = Zotero.Items.get(ids2[0]);
			assert.isTrue(item.isImportedAttachment());
			assert.equal(item.getField('title'), 'Title');
		});
		
		it("should save a PDF to the current selected collection", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			
			var file = getTestDataDirectory();
			file.append('test.pdf');
			httpd.registerFile("/test.pdf", file);
			
			var ids;
			var promise = waitForItemEvent('add');
			yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						url: testServerPath + "/test.pdf",
						pdf: true
					})
				}
			);
			
			var ids = yield promise;
			
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.isTrue(item.isImportedAttachment());
			assert.equal(item.attachmentContentType, 'application/pdf');
			assert.isTrue(collection.hasItem(item.id));
		});
		
		it("should respond with 500 if a read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield selectLibrary(win, group.libraryID);
			yield waitForItemsLoad(win);
			
			var req = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						url: "http://example.com",
						html: "<html><head><title>Title</title><body>Body</body></html>"
					}),
					successCodes: false
				}
			);
			
			assert.equal(req.status, 500);
			assert.isFalse(JSON.parse(req.responseText).libraryEditable);
			
			// The selection should remain
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(), group.libraryID
			);
		});
	});
	
	describe("/connector/savePage", function() {
		before(async function () {
			await selectLibrary(win);
			await waitForItemsLoad(win);
		});
		
		// TEMP: Wait for indexing to complete, which happens after a 1-second delay, after a 201 has
		// been returned to the connector. Would be better to make sure indexing has completed.
		afterEach(function* () {
			yield Zotero.Promise.delay(1050);
		});
		
		it("should return 500 if no translator available for page", function* () {
			var xmlhttp = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/savePage",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						uri: "http://example.com",
						html: "<html><head><title>Title</title><body>Body</body></html>"
					}),
					successCodes: false
				}
			);
			assert.equal(xmlhttp.status, 500);
		});
		
		it("should translate a page if translators are available", function* () {
			var html = Zotero.File.getContentsFromURL(getTestDataUrl('coins.html'));
			var promise = waitForItemEvent('add');
			var xmlhttp = yield Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/savePage",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						uri: "https://example.com/test",
						html
					}),
					successCodes: false
				}
			);

			let ids = yield promise;
			var item = Zotero.Items.get(ids[0]);
			var title = "Test Page";
			assert.equal(JSON.parse(xmlhttp.responseText).items[0].title, title);
			assert.equal(item.getField('title'), title);
			assert.equal(xmlhttp.status, 201);
		});
	});
	
	describe('/connector/installStyle', function() {
		var endpoint;
		
		before(function() {
			endpoint = connectorServerPath + "/connector/installStyle";
		});
		
		it('should reject styles with invalid text', function* () {
			var error = yield getPromiseError(Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: { "Content-Type": "application/json" },
					body: '{}'
				}
			));	
			assert.instanceOf(error, Zotero.HTTP.UnexpectedStatusException);
			assert.equal(error.xmlhttp.status, 400);
			assert.equal(error.xmlhttp.responseText, Zotero.getString("styles.installError", "(null)"));
		});
		
		it('should import a style with application/vnd.citationstyles.style+xml content-type', function* () {
			sinon.stub(Zotero.Styles, 'install').callsFake(function(style) {
				var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser),
				doc = parser.parseFromString(style, "application/xml");
				
				return Zotero.Promise.resolve(
					Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:title[1]',
						Zotero.Styles.ns)
				);
			});
			
			var style = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" default-locale="de-DE">
  <info>
    <title>Test1</title>
    <id>http://www.example.com/test2</id>
    <link href="http://www.zotero.org/styles/cell" rel="independent-parent"/>
  </info>
</style>
`;
			var response = yield Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: { "Content-Type": "application/vnd.citationstyles.style+xml" },
					body: style
				}
			);	
			assert.equal(response.status, 201);
			assert.equal(response.response, JSON.stringify({name: 'Test1'}));
			Zotero.Styles.install.restore();
		});
	});
	
	describe('/connector/import', function() {
		var endpoint;
		
		before(function() {
			endpoint = connectorServerPath + "/connector/import";
		});
		
		it('should reject resources that do not contain import data', function* () {
			var error = yield getPromiseError(Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: { "Content-Type": "text/plain" },
					body: 'Owl'
				}
			));
			assert.instanceOf(error, Zotero.HTTP.UnexpectedStatusException);
			assert.equal(error.xmlhttp.status, 400);
		});
		
		it('should import resources (BibTeX) into selected collection', function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			
			var addedItemIDPromise = waitForItemEvent('add');
			var resource = `@book{test1,
  title={Test1},
  author={Owl},
  year={1000},
  publisher={Curly Braces Publishing}
}`;
			var response = yield Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: { "Content-Type": "application/x-bibtex" },
					body: resource
				}
			);	
			assert.equal(response.status, 201);
			assert.equal(JSON.parse(response.responseText)[0].title, 'Test1');
			
			let itemId = yield addedItemIDPromise;
			assert.isTrue(collection.hasItem(itemId[0]));
		});
		
		
		it('should respond with 500 if read-only library is selected', function* () {
			var group = yield createGroup({
				editable: false
			});
			yield selectLibrary(win, group.libraryID);
			yield waitForItemsLoad(win);
			
			var resource = `@book{test1,
  title={Test1},
  author={Owl},
  year={1000},
  publisher={Curly Braces Publishing}
}`;
			var req = yield Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: { "Content-Type": "application/x-bibtex" },
					body: resource,
					successCodes: false
				}
			);
			assert.equal(req.status, 500);
			assert.isFalse(JSON.parse(req.responseText).libraryEditable);
			
			// The selection should remain
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(), group.libraryID
			);
		});
	});
});
