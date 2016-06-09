"use strict";

describe("Connector Server", function () {
	Components.utils.import("resource://zotero-unit/httpd.js");
	var win, connectorServerPath, testServerPath, httpd;
	var testServerPort = 16213;
	
	before(function* () {
		Zotero.Prefs.set("httpServer.enabled", true);
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		win = yield loadZoteroPane();
		connectorServerPath = 'http://127.0.0.1:' + Zotero.Prefs.get('httpServer.port');
		testServerPath = 'http://127.0.0.1:' + testServerPort;
	});
	
	beforeEach(function () {
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
		});
		
		
		it("should save to My Library if read-only library is selected", function* () {
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
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'newspaperArticle');
			// Item should've been saved to My Library
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
			
			// My Library should've been selected
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID
			);
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
		
		it("should save a webpage item to My Library if a read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield selectLibrary(win, group.libraryID);
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
			assert.equal(item.getField('title'), 'Title');
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
			// Item should've been saved to My Library
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
			
			// My Library should've been selected
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID
			);
		});
	});
});
