"use strict";

describe("Zotero.Sync.Data.FullTextEngine", function () {
	Components.utils.import("resource://zotero/config.js");
	
	var apiKey = Zotero.Utilities.randomString(24);
	var baseURL = "http://local.zotero/";
	var engine, server, client, caller, stub, spy;
	
	var responses = {};
	
	var setup = Zotero.Promise.coroutine(function* (options = {}) {
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		
		var client = new Zotero.Sync.APIClient({
			baseURL,
			apiVersion: options.apiVersion || ZOTERO_CONFIG.API_VERSION,
			apiKey,
			caller,
			background: options.background || true
		});
		
		var engine = new Zotero.Sync.Data.FullTextEngine({
			apiClient: client,
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			stopOnError: true
		});
		
		return { engine, client, caller };
	});
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	function generateContent() {
		return new Array(10).fill("").map(x => Zotero.Utilities.randomString()).join(" ");
	}
	
	//
	// Tests
	//
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
	})
	
	describe("Full-Text Syncing", function () {
		it("should download full-text into a new library and subsequent updates", function* () {
			({ engine, client, caller } = yield setup());
			
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			yield attachment.saveTx();
			
			var content = generateContent()
			var spy = sinon.spy(Zotero.Fulltext, "startContentProcessor")
			
			var itemFullTextVersion = 10;
			var libraryFullTextVersion = 15;
			setResponse({
				method: "GET",
				url: "users/1/fulltext",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryFullTextVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 200,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				json: {
					content,
					indexedPages: 1,
					totalPages: 1
				}
			});
			yield engine.start();
			
			var dir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var unprocessed = OS.Path.join(dir, '.zotero-ft-unprocessed');
			assert.isTrue(yield OS.File.exists(unprocessed));
			var data = JSON.parse(yield Zotero.File.getContentsAsync(unprocessed));
			assert.propertyVal(data, 'text', content);
			assert.propertyVal(data, 'indexedPages', 1);
			assert.propertyVal(data, 'totalPages', 1);
			assert.propertyVal(data, 'version', itemFullTextVersion);
			yield assert.eventually.equal(
				Zotero.FullText.getLibraryVersion(item.libraryID),
				libraryFullTextVersion
			);
			
			sinon.assert.calledOnce(spy);
			spy.restore();
			
			//
			// Get new content
			//
			({ engine, client, caller } = yield setup());
			
			item = yield createDataObject('item');
			attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			yield attachment.saveTx();
			
			content = generateContent()
			spy = sinon.spy(Zotero.Fulltext, "startContentProcessor")
			
			itemFullTextVersion = 17;
			var lastLibraryFullTextVersion = libraryFullTextVersion;
			libraryFullTextVersion = 20;
			setResponse({
				method: "GET",
				url: "users/1/fulltext?since=" + lastLibraryFullTextVersion,
				status: 200,
				headers: {
					"Last-Modified-Version": libraryFullTextVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 200,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				json: {
					content,
					indexedPages: 1,
					totalPages: 1
				}
			});
			yield engine.start();
			
			var dir = Zotero.Attachments.getStorageDirectory(attachment).path;
			var unprocessed = OS.Path.join(dir, '.zotero-ft-unprocessed');
			assert.isTrue(yield OS.File.exists(unprocessed));
			var data = JSON.parse(yield Zotero.File.getContentsAsync(unprocessed));
			assert.propertyVal(data, 'text', content);
			assert.propertyVal(data, 'indexedPages', 1);
			assert.propertyVal(data, 'totalPages', 1);
			assert.propertyVal(data, 'version', itemFullTextVersion);
			yield assert.eventually.equal(
				Zotero.FullText.getLibraryVersion(item.libraryID),
				libraryFullTextVersion
			);
			
			sinon.assert.calledOnce(spy);
			spy.restore();
		})
		
		it("should handle remotely missing full-text content", function* () {
			({ engine, client, caller } = yield setup());
			
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'application/pdf';
			attachment.attachmentFilename = 'test.pdf';
			yield attachment.saveTx();
			
			var itemFullTextVersion = 10;
			var libraryFullTextVersion = 15;
			setResponse({
				method: "GET",
				url: "users/1/fulltext",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryFullTextVersion
				},
				json: {
					[attachment.key]: itemFullTextVersion
				}
			});
			setResponse({
				method: "GET",
				url: `users/1/items/${attachment.key}/fulltext`,
				status: 404,
				headers: {
					"Last-Modified-Version": itemFullTextVersion
				},
				text: ""
			});
			yield engine.start();
		})
		
		it("should upload new full-text content and subsequent updates", function* () {
			// https://github.com/cjohansen/Sinon.JS/issues/607
			var fixSinonBug = ";charset=utf-8";
			
			var libraryID = Zotero.Libraries.userLibraryID;
			yield Zotero.Libraries.setVersion(libraryID, 5);
			
			({ engine, client, caller } = yield setup());
			
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'text/html';
			attachment.attachmentFilename = 'test.html';
			attachment.attachmentCharset = 'utf-8';
			attachment.synced = true;
			yield attachment.saveTx();
			yield Zotero.Attachments.createDirectoryForItem(attachment);
			
			var path = attachment.getFilePath();
			var content = generateContent()
			var htmlContent = "<html><body>" + content + "</body></html>";
			yield Zotero.File.putContentsAsync(path, content);
			yield Zotero.Fulltext.indexItems([attachment.id]);
			
			var libraryVersion = 15;
			var previousLibraryVersion = libraryVersion;
			
			var count = 1;
			setResponse({
				method: "GET",
				url: "users/1/fulltext",
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {}
			});
			server.respond(function (req) {
				if (req.method == "PUT") {
					if (req.url == `${baseURL}users/1/items/${attachment.key}/fulltext`) {
						assert.propertyVal(
							req.requestHeaders,
							'Content-Type',
							'application/json' + fixSinonBug
						);
						
						let json = JSON.parse(req.requestBody);
						assert.propertyVal(json, 'content', content);
						assert.propertyVal(json, 'indexedChars', content.length);
						assert.propertyVal(json, 'totalChars', content.length);
						assert.propertyVal(json, 'indexedPages', 0);
						assert.propertyVal(json, 'totalPages', 0);
						
						req.respond(
							204,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": ++libraryVersion
							},
							""
						);
						count--;
					}
				}
			})
			
			yield engine.start();
			assert.equal(count, 0);
			yield assert.eventually.equal(
				Zotero.FullText.getItemVersion(attachment.id),
				libraryVersion
			);
			
			//
			// Upload new content
			//
			({ engine, client, caller } = yield setup());
			yield Zotero.Libraries.setVersion(libraryID, libraryVersion);
			
			item = yield createDataObject('item');
			attachment = new Zotero.Item('attachment');
			attachment.parentItemID = item.id;
			attachment.attachmentLinkMode = 'imported_file';
			attachment.attachmentContentType = 'text/html';
			attachment.attachmentFilename = 'test.html';
			attachment.attachmentCharset = 'utf-8';
			attachment.synced = true;
			yield attachment.saveTx();
			yield Zotero.Attachments.createDirectoryForItem(attachment);
			
			path = attachment.getFilePath();
			content = generateContent()
			htmlContent = "<html><body>" + content + "</body></html>";
			yield Zotero.File.putContentsAsync(path, content);
			yield Zotero.Fulltext.indexItems([attachment.id]);
			
			count = 1;
			setResponse({
				method: "GET",
				url: "users/1/fulltext?since=" + previousLibraryVersion,
				status: 200,
				headers: {
					"Last-Modified-Version": libraryVersion
				},
				json: {}
			});
			server.respond(function (req) {
				if (req.method == "PUT") {
					if (req.url == `${baseURL}users/1/items/${attachment.key}/fulltext`) {
						assert.propertyVal(req.requestHeaders, 'Zotero-API-Key', apiKey);
						assert.propertyVal(
							req.requestHeaders,
							'Content-Type',
							'application/json' + fixSinonBug
						);
						
						let json = JSON.parse(req.requestBody);
						assert.propertyVal(json, 'content', content);
						assert.propertyVal(json, 'indexedChars', content.length);
						assert.propertyVal(json, 'totalChars', content.length);
						assert.propertyVal(json, 'indexedPages', 0);
						assert.propertyVal(json, 'totalPages', 0);
						
						req.respond(
							204,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": ++libraryVersion
							},
							""
						);
						count--;
					}
				}
			})
			
			yield engine.start();
			assert.equal(count, 0);
			yield assert.eventually.equal(
				Zotero.FullText.getItemVersion(attachment.id),
				libraryVersion
			);
		})
	})
})
