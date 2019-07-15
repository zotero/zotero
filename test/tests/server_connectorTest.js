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
			
			var req = yield reqPromise;
			assert.equal(req.status, 201);
		});
		
		
		it("should switch to My Library if read-only library is selected", function* () {
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
			var reqPromise = Zotero.HTTP.request(
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
			
			// My Library be selected, and the item should be in it
			var ids = yield promise;
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(),
				Zotero.Libraries.userLibraryID
			);
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'newspaperArticle');
			
			var req = yield reqPromise;
			assert.equal(req.status, 201);
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
		
		it("shouldn't return an attachment that isn't being saved", async function () {
			Zotero.Prefs.set('automaticSnapshots', false);
			
			await selectLibrary(win, Zotero.Libraries.userLibraryID);
			await waitForItemsLoad(win);
			
			var body = {
				items: [
					{
						itemType: "webpage",
						title: "Title",
						creators: [],
						attachments: [
							{
								url: "http://example.com/",
								mimeType: "text/html"
							}
						],
						url: "http://example.com/"
					}
				],
				uri: "http://example.com/"
			};
			
			var req = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body),
					responseType: 'json'
				}
			);
			
			Zotero.Prefs.clear('automaticSnapshots');
			
			assert.equal(req.status, 201);
			assert.lengthOf(req.response.items, 1);
			assert.lengthOf(req.response.items[0].attachments, 0);
		});
		
		describe("PDF retrieval", function () {
			var oaDOI = '10.1111/abcd';
			var nonOADOI = '10.2222/bcde';
			var pdfURL;
			var badPDFURL;
			var stub;
			
			before(function () {
				var origFunc = Zotero.HTTP.request.bind(Zotero.HTTP);
				stub = sinon.stub(Zotero.HTTP, 'request');
				stub.callsFake(function (method, url, options) {
					// OA PDF lookup
					if (url.startsWith(ZOTERO_CONFIG.SERVICES_URL)) {
						let json = JSON.parse(options.body);
						let response = [];
						if (json.doi == oaDOI) {
							response.push({
								url: pdfURL,
								version: 'submittedVersion'
							});
						}
						return {
							status: 200,
							response
						};
					}
					
					return origFunc(...arguments);
				});
			});
			
			beforeEach(() => {
				pdfURL = testServerPath + '/pdf';
				badPDFURL = testServerPath + '/badpdf';
				
				httpd.registerFile(
					pdfURL.substr(testServerPath.length),
					Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'test.pdf'))
				);
				// PDF URL that's actually an HTML page
				httpd.registerFile(
					badPDFURL.substr(testServerPath.length),
					Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'test.html'))
				);
			});
			
			afterEach(() => {
				stub.resetHistory();
			});
			
			after(() => {
				stub.restore();
			});
			
			
			it("should download a translated PDF", async function () {
				var collection = await createDataObject('collection');
				await waitForItemsLoad(win);
				
				var sessionID = Zotero.Utilities.randomString();
				
				// Save item
				var itemAddPromise = waitForItemEvent('add');
				var saveItemsReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/saveItems",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID,
							items: [
								{
									itemType: 'journalArticle',
									title: 'Title',
									DOI: nonOADOI,
									attachments: [
										{
											title: "PDF",
											url: pdfURL,
											mimeType: 'application/pdf'
										}
									]
								}
							],
							uri: 'http://website/article'
						}),
						responseType: 'json'
					}
				);
				assert.equal(saveItemsReq.status, 201);
				assert.lengthOf(saveItemsReq.response.items, 1);
				// Translated attachment should show up in the initial response
				assert.lengthOf(saveItemsReq.response.items[0].attachments, 1);
				assert.notProperty(saveItemsReq.response.items[0], 'DOI');
				assert.notProperty(saveItemsReq.response.items[0].attachments[0], 'progress');
				
				// Check parent item
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				var item = Zotero.Items.get(ids[0]);
				assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'journalArticle');
				assert.isTrue(collection.hasItem(item.id));
				
				// Legacy endpoint should show 0
				let attachmentProgressReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/attachmentProgress",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify([saveItemsReq.response.items[0].attachments[0].id]),
						responseType: 'json'
					}
				);
				assert.equal(attachmentProgressReq.status, 200);
				let progress = attachmentProgressReq.response;
				assert.sameOrderedMembers(progress, [0]);
				
				// Wait for the attachment to finish saving
				itemAddPromise = waitForItemEvent('add');
				var i = 0;
				while (i < 3) {
					let sessionProgressReq = await Zotero.HTTP.request(
						'POST',
						connectorServerPath + "/connector/sessionProgress",
						{
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({ sessionID }),
							responseType: 'json'
						}
					);
					assert.equal(sessionProgressReq.status, 200);
					let response = sessionProgressReq.response;
					assert.lengthOf(response.items, 1);
					let item = response.items[0];
					if (item.attachments.length) {
						let attachments = item.attachments;
						assert.lengthOf(attachments, 1);
						let attachment = attachments[0];
						switch (i) {
						// Translated PDF in progress
						case 0:
							if (attachment.title == "PDF"
									&& Number.isInteger(attachment.progress)
									&& attachment.progress < 100) {
								assert.isFalse(response.done);
								i++;
							}
							continue;
						
						// Translated PDF finished
						case 1:
							if (attachment.title == "PDF" && attachment.progress == 100) {
								i++;
							}
							continue;
						
						// done: true
						case 2:
							if (response.done) {
								i++;
							}
							continue;
						}
					}
					await Zotero.Promise.delay(10);
				}
				
				// Legacy endpoint should show 100
				attachmentProgressReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/attachmentProgress",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify([saveItemsReq.response.items[0].attachments[0].id]),
						responseType: 'json'
					}
				);
				assert.equal(attachmentProgressReq.status, 200);
				progress = attachmentProgressReq.response;
				assert.sameOrderedMembers(progress, [100]);
				
				// Check attachment
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				item = Zotero.Items.get(ids[0]);
				assert.isTrue(item.isImportedAttachment());
				assert.equal(item.getField('title'), 'PDF');
			});
			
			
			it("should download open-access PDF if no PDF provided", async function () {
				var collection = await createDataObject('collection');
				await waitForItemsLoad(win);
				
				var sessionID = Zotero.Utilities.randomString();
				
				// Save item
				var itemAddPromise = waitForItemEvent('add');
				var saveItemsReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/saveItems",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID,
							items: [
								{
									itemType: 'journalArticle',
									title: 'Title',
									DOI: oaDOI,
									attachments: []
								}
							],
							uri: 'http://website/article'
						}),
						responseType: 'json'
					}
				);
				assert.equal(saveItemsReq.status, 201);
				assert.lengthOf(saveItemsReq.response.items, 1);
				// Attachment shouldn't show up in the initial response
				assert.lengthOf(saveItemsReq.response.items[0].attachments, 0);
				
				// Check parent item
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				var item = Zotero.Items.get(ids[0]);
				assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'journalArticle');
				assert.isTrue(collection.hasItem(item.id));
				
				// Wait for the attachment to finish saving
				itemAddPromise = waitForItemEvent('add');
				var wasZero = false;
				var was100 = false;
				while (true) {
					let sessionProgressReq = await Zotero.HTTP.request(
						'POST',
						connectorServerPath + "/connector/sessionProgress",
						{
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({ sessionID }),
							responseType: 'json'
						}
					);
					assert.equal(sessionProgressReq.status, 200);
					let response = sessionProgressReq.response;
					assert.typeOf(response.items, 'array');
					assert.lengthOf(response.items, 1);
					let item = response.items[0];
					if (item.attachments.length) {
						// 'progress' should have started at 0
						if (item.attachments[0].progress === 0) {
							wasZero = true;
						}
						else if (!was100 && item.attachments[0].progress == 100) {
							if (response.done) {
								break;
							}
							was100 = true;
						}
						else if (response.done) {
							break;
						}
					}
					assert.isFalse(response.done);
					await Zotero.Promise.delay(10);
				}
				assert.isTrue(wasZero);
				
				// Check attachment
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				item = Zotero.Items.get(ids[0]);
				assert.isTrue(item.isImportedAttachment());
				assert.equal(item.getField('title'), Zotero.getString('attachment.submittedVersion'));
			});
			
			
			it("should download open-access PDF if a translated PDF fails", async function () {
				var collection = await createDataObject('collection');
				await waitForItemsLoad(win);
				
				var sessionID = Zotero.Utilities.randomString();
				
				// Save item
				var itemAddPromise = waitForItemEvent('add');
				var saveItemsReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/saveItems",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID,
							items: [
								{
									itemType: 'journalArticle',
									title: 'Title',
									DOI: oaDOI,
									attachments: [
										{
											title: "PDF",
											url: badPDFURL,
											mimeType: 'application/pdf'
										}
									]
								}
							],
							uri: 'http://website/article'
						}),
						responseType: 'json'
					}
				);
				assert.equal(saveItemsReq.status, 201);
				assert.lengthOf(saveItemsReq.response.items, 1);
				// Translated attachment should show up in the initial response
				assert.lengthOf(saveItemsReq.response.items[0].attachments, 1);
				assert.notProperty(saveItemsReq.response.items[0], 'DOI');
				assert.notProperty(saveItemsReq.response.items[0].attachments[0], 'progress');
				
				// Check parent item
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				var item = Zotero.Items.get(ids[0]);
				assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'journalArticle');
				assert.isTrue(collection.hasItem(item.id));
				
				// Legacy endpoint should show 0
				let attachmentProgressReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/attachmentProgress",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify([saveItemsReq.response.items[0].attachments[0].id]),
						responseType: 'json'
					}
				);
				assert.equal(attachmentProgressReq.status, 200);
				let progress = attachmentProgressReq.response;
				assert.sameOrderedMembers(progress, [0]);
				
				// Wait for the attachment to finish saving
				itemAddPromise = waitForItemEvent('add');
				var i = 0;
				while (i < 4) {
					let sessionProgressReq = await Zotero.HTTP.request(
						'POST',
						connectorServerPath + "/connector/sessionProgress",
						{
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({ sessionID }),
							responseType: 'json'
						}
					);
					assert.equal(sessionProgressReq.status, 200);
					let response = sessionProgressReq.response;
					assert.lengthOf(response.items, 1);
					let item = response.items[0];
					if (item.attachments.length) {
						let attachments = item.attachments;
						assert.lengthOf(attachments, 1);
						let attachment = attachments[0];
						switch (i) {
						// Translated PDF in progress
						case 0:
							if (attachment.title == "PDF"
									&& Number.isInteger(attachment.progress)
									&& attachment.progress < 100) {
								assert.isFalse(response.done);
								i++;
							}
							continue;
						
						// OA PDF in progress
						case 1:
							if (attachment.title == Zotero.getString('findPDF.openAccessPDF')
									&& Number.isInteger(attachment.progress)
									&& attachment.progress < 100) {
								assert.isFalse(response.done);
								i++;
							}
							continue;
						
						// OA PDF finished
						case 2:
							if (attachment.progress === 100) {
								assert.equal(attachment.title, Zotero.getString('findPDF.openAccessPDF'));
								i++;
							}
							continue;
						
						// done: true
						case 3:
							if (response.done) {
								i++;
							}
							continue;
						}
					}
					await Zotero.Promise.delay(10);
				}
				
				// Legacy endpoint should show 100
				attachmentProgressReq = await Zotero.HTTP.request(
					'POST',
					connectorServerPath + "/connector/attachmentProgress",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify([saveItemsReq.response.items[0].attachments[0].id]),
						responseType: 'json'
					}
				);
				assert.equal(attachmentProgressReq.status, 200);
				progress = attachmentProgressReq.response;
				assert.sameOrderedMembers(progress, [100]);
				
				// Check attachment
				var ids = await itemAddPromise;
				assert.lengthOf(ids, 1);
				item = Zotero.Items.get(ids[0]);
				assert.isTrue(item.isImportedAttachment());
				assert.equal(item.getField('title'), Zotero.getString('attachment.submittedVersion'));
			});
		});
	});
	
	describe("/connector/saveSnapshot", function () {
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
		
		it("should save a PDF to the current selected collection and retrieve metadata", async function () {
			var collection = await createDataObject('collection');
			await waitForItemsLoad(win);
			
			var file = getTestDataDirectory();
			file.append('test.pdf');
			httpd.registerFile("/test.pdf", file);
			
			var promise = waitForItemEvent('add');
			
			var origRequest = Zotero.HTTP.request.bind(Zotero.HTTP);
			var called = 0;
			var stub = sinon.stub(Zotero.HTTP, 'request').callsFake(function (method, url, options) {
				// Forward saveSnapshot request
				if (url.endsWith('saveSnapshot')) {
					return origRequest(...arguments);
				}
				
				// Fake recognizer response
				return Zotero.Promise.resolve({
					getResponseHeader: () => {},
					responseText: JSON.stringify({
						title: 'Test',
						authors: []
					})
				});
			});
			
			await Zotero.HTTP.request(
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
			
			var ids = await promise;
			
			assert.lengthOf(ids, 1);
			var attachment = Zotero.Items.get(ids[0]);
			assert.isTrue(attachment.isImportedAttachment());
			assert.equal(attachment.attachmentContentType, 'application/pdf');
			assert.isTrue(collection.hasItem(attachment.id));
			
			await waitForItemEvent('add');
			await waitForItemEvent('modify');
			await waitForItemEvent('modify');
			
			assert.isFalse(attachment.isTopLevelItem());
			
			stub.restore();
		});
		
		it("should switch to My Library if a read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield selectLibrary(win, group.libraryID);
			yield waitForItemsLoad(win);
			
			var promise = waitForItemEvent('add');
			var reqPromise = Zotero.HTTP.request(
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
			
			// My Library be selected, and the item should be in it
			var ids = yield promise;
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(),
				Zotero.Libraries.userLibraryID
			);
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
			
			var req = yield reqPromise;
			assert.equal(req.status, 201);
		});
	});
	
	describe("/connector/savePage", function() {
		before(async function () {
			await selectLibrary(win);
			await waitForItemsLoad(win);
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
	
	describe("/connector/updateSession", function () {
		it("should update collections and tags of item saved via /saveItems", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			await waitForItemsLoad(win);
			
			var sessionID = Zotero.Utilities.randomString();
			var body = {
				sessionID,
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
			
			var ids = await waitForItemEvent('add');
			var item = Zotero.Items.get(ids[0]);
			assert.isTrue(collection2.hasItem(item.id));
			await waitForItemEvent('add');
			
			var req = await reqPromise;
			assert.equal(req.status, 201);
			
			// Update saved item
			var req = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: collection1.treeViewID,
						tags: "A, B"
					})
				}
			);
			
			assert.equal(req.status, 200);
			assert.isTrue(collection1.hasItem(item.id));
			assert.isTrue(item.hasTag("A"));
			assert.isTrue(item.hasTag("B"));
		});
		
		it("should update collections and tags of PDF saved via /saveSnapshot", async function () {
			var sessionID = Zotero.Utilities.randomString();
			
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			await waitForItemsLoad(win);
			
			var file = getTestDataDirectory();
			file.append('test.pdf');
			httpd.registerFile("/test.pdf", file);
			
			var ids;
			var promise = waitForItemEvent('add');
			var reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						url: testServerPath + "/test.pdf",
						pdf: true
					})
				}
			);
			
			var ids = await promise;
			var item = Zotero.Items.get(ids[0]);
			assert.isTrue(collection2.hasItem(item.id));
			var req = await reqPromise;
			assert.equal(req.status, 201);
			
			// Update saved item
			var req = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: collection1.treeViewID,
						tags: "A, B"
					})
				}
			);
			
			assert.equal(req.status, 200);
			assert.isTrue(collection1.hasItem(item.id));
			assert.isTrue(item.hasTag("A"));
			assert.isTrue(item.hasTag("B"));
		});
		
		it("should update collections and tags of webpage saved via /saveSnapshot", async function () {
			var sessionID = Zotero.Utilities.randomString();
			
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			await waitForItemsLoad(win);
			
			// saveSnapshot saves parent and child before returning
			var ids1, ids2;
			var promise = waitForItemEvent('add').then(function (ids) {
				ids1 = ids;
				return waitForItemEvent('add').then(function (ids) {
					ids2 = ids;
				});
			});
			await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						url: "http://example.com",
						html: "<html><head><title>Title</title><body>Body</body></html>"
					})
				}
			);
			
			assert.isTrue(promise.isFulfilled());
			
			var item = Zotero.Items.get(ids1[0]);
			
			// Update saved item
			var req = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: collection1.treeViewID,
						tags: "A, B"
					})
				}
			);
			
			assert.equal(req.status, 200);
			assert.isTrue(collection1.hasItem(item.id));
			assert.isTrue(item.hasTag("A"));
			assert.isTrue(item.hasTag("B"));
		});
		
		it("should move item saved via /saveItems to another library", async function () {
			var group = await createGroup({ editable: true, filesEditable: false });
			await selectLibrary(win);
			await waitForItemsLoad(win);
			
			var sessionID = Zotero.Utilities.randomString();
			var body = {
				sessionID,
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
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
			
			var ids1 = await waitForItemEvent('add');
			var item1 = Zotero.Items.get(ids1[0]);
			// Attachment
			await waitForItemEvent('add');
			
			var req = await reqPromise;
			assert.equal(req.status, 201);
			
			// Move item to group without file attachment
			reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: group.treeViewID
					})
				}
			);
			
			var ids2 = await waitForItemEvent('add');
			var item2 = Zotero.Items.get(ids2[0]);
			
			req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item1.id));
			assert.equal(item2.libraryID, group.libraryID);
			assert.equal(item2.numAttachments(), 0);
			
			// Move back to My Library and resave attachment
			reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: Zotero.Libraries.userLibrary.treeViewID
					})
				}
			);
			
			var ids3 = await waitForItemEvent('add');
			var item3 = Zotero.Items.get(ids3[0]);
			// Attachment
			await waitForItemEvent('add');
			
			req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item2.id));
			assert.equal(item3.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(item3.numAttachments(), 1);
		});
		
		it("should move item saved via /saveSnapshot to another library", async function () {
			var group = await createGroup({ editable: true, filesEditable: false });
			await selectLibrary(win);
			await waitForItemsLoad(win);
			var sessionID = Zotero.Utilities.randomString();
			
			// saveSnapshot saves parent and child before returning
			var ids1;
			var promise = waitForItemEvent('add').then(function (ids) {
				ids1 = ids;
				return waitForItemEvent('add').then(function (ids) {
					ids1 = ids1.concat(ids);
				});
			});
			await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						url: "http://example.com",
						html: "<html><head><title>Title</title><body>Body</body></html>"
					})
				}
			);
			
			assert.isTrue(promise.isFulfilled());
			
			var item1 = Zotero.Items.get(ids1[0]);
			
			// Move item to group without file attachment
			var reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: group.treeViewID
					})
				}
			);
			
			var ids2 = await waitForItemEvent('add');
			var item2 = Zotero.Items.get(ids2[0]);
			
			var req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item1.id));
			assert.equal(item2.libraryID, group.libraryID);
			assert.equal(item2.numAttachments(), 0);
			
			// Move back to My Library and resave attachment
			reqPromise = Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: Zotero.Libraries.userLibrary.treeViewID
					})
				}
			);
			
			var ids3 = await waitForItemEvent('add');
			var item3 = Zotero.Items.get(ids3[0]);
			await waitForItemEvent('add');
			
			req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item2.id));
			assert.equal(item3.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(item3.numAttachments(), 1);
		});
	});
	
	describe('/connector/installStyle', function() {
		var endpoint;
		var style;
		
		before(function() {
			endpoint = connectorServerPath + "/connector/installStyle";
			style = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" default-locale="de-DE">
  <info>
    <title>Test1</title>
    <id>http://www.example.com/test2</id>
    <link href="http://www.zotero.org/styles/cell" rel="independent-parent"/>
  </info>
</style>
`;
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
				
				return Zotero.Promise.resolve({
					styleTitle: Zotero.Utilities.xpathText(
						doc, '/csl:style/csl:info[1]/csl:title[1]', Zotero.Styles.ns
					),
					styleID: Zotero.Utilities.xpathText(
						doc, '/csl:style/csl:info[1]/csl:id[1]', Zotero.Styles.ns
					)
				});
			});
			
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
		
		it('should accept text/plain request with X-Zotero-Connector-API-Version or Zotero-Allowed-Request', async function () {
			sinon.stub(Zotero.Styles, 'install').callsFake(function(style) {
				var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser),
				doc = parser.parseFromString(style, "application/xml");
				
				return Zotero.Promise.resolve({
					styleTitle: Zotero.Utilities.xpathText(
						doc, '/csl:style/csl:info[1]/csl:title[1]', Zotero.Styles.ns
					),
					styleID: Zotero.Utilities.xpathText(
						doc, '/csl:style/csl:info[1]/csl:id[1]', Zotero.Styles.ns
					)
				});
			});
			
			// X-Zotero-Connector-API-Version
			var response = await Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "text/plain",
						"X-Zotero-Connector-API-Version": "2"
					},
					body: style
				}
			);
			assert.equal(response.status, 201);
			
			// Zotero-Allowed-Request
			response = await Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "text/plain",
						"Zotero-Allowed-Request": "1"
					},
					body: style
				}
			);
			assert.equal(response.status, 201);
			
			Zotero.Styles.install.restore();
		});
		
		it('should reject text/plain request without X-Zotero-Connector-API-Version', async function () {
			var req = await Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "text/plain"
					},
					body: style,
					successCodes: [403]
				}
			);
			assert.equal(req.status, 403);
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
					headers: {
						"Content-Type": "text/plain",
						"X-Zotero-Connector-API-Version": "2"
					},
					body: 'Owl'
				}
			));
			assert.instanceOf(error, Zotero.HTTP.UnexpectedStatusException);
			assert.equal(error.xmlhttp.status, 400);
		});
		
		it('should reject requests without X-Zotero-Connector-API-Version', async function () {
			var req = await Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "text/plain"
					},
					successCodes: [403]
				}
			);
			assert.equal(req.status, 403);
		});
		
		it('should import resources (BibTeX) into selected collection', function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			
			var resource = `@book{test1,
  title={Test1},
  author={Owl},
  year={1000},
  publisher={Curly Braces Publishing},
  keywords={A, B}
}`;
			
			var addedItemIDsPromise = waitForItemEvent('add');
			var req = yield Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "application/x-bibtex",
						"X-Zotero-Connector-API-Version": "2"
					},
					body: resource
				}
			);
			assert.equal(req.status, 201);
			assert.equal(JSON.parse(req.responseText)[0].title, 'Test1');
			
			let itemIDs = yield addedItemIDsPromise;
			assert.isTrue(collection.hasItem(itemIDs[0]));
			var item = Zotero.Items.get(itemIDs[0]);
			assert.sameDeepMembers(item.getTags(), [{ tag: 'A', type: 1 }, { tag: 'B', type: 1 }]);
		});
		
		
		it('should switch to My Library if read-only library is selected', function* () {
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
			
			var addedItemIDsPromise = waitForItemEvent('add');
			var req = yield Zotero.HTTP.request(
				'POST',
				endpoint,
				{
					headers: {
						"Content-Type": "application/x-bibtex",
						"X-Zotero-Connector-API-Version": "2"
					},
					body: resource,
					successCodes: false
				}
			);
			
			assert.equal(req.status, 201);
			assert.equal(
				win.ZoteroPane.collectionsView.getSelectedLibraryID(),
				Zotero.Libraries.userLibraryID
			);
			
			let itemIDs = yield addedItemIDsPromise;
			var item = Zotero.Items.get(itemIDs[0]);
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
		});
	});
});
