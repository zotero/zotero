"use strict";

let httpRequest = (method, url, options) => {
	if (!options) {
		options = {};
	}
	if (!('errorDelayMax' in options)) {
		options.errorDelayMax = 0;
	}
	return Zotero.HTTP.request(method, url, options);
}

describe("Connector Server", function () {
	var { HttpServer } = ChromeUtils.importESModule("chrome://remote/content/server/httpd.sys.mjs");;
	var win, connectorServerPath, testServerPath, httpd;
	var testServerPort = 16213;
	var snapshotHTML = "<html><head><title>Title</title><body>Body</body></html>";
	
	before(function* () {
		this.timeout(20000);
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		yield Zotero.Translators.init();
		
		win = yield loadZoteroPane();
		connectorServerPath = 'http://127.0.0.1:' + Zotero.Server.port;
	});
	
	beforeEach(function () {
		// Alternate ports to prevent exceptions not catchable in JS
		testServerPort += (testServerPort & 1) ? 1 : -1;
		testServerPath = 'http://127.0.0.1:' + testServerPort;
		httpd = new HttpServer();
		httpd.start(testServerPort);
		
		httpd.registerPathHandler(
			"/snapshot",
			{
				handle: function (request, response) {
					response.setStatusLine(null, 200, "OK");
					response.write(snapshotHTML);
				}
			}
		);
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

			var response = yield httpRequest(
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
			let translatorCode = yield Zotero.Translators.getCodeForTranslator(translator);
			assert.equal(response.response, translatorCode);

			Zotero.Translators.get.restore();
		})
	});
	
	
	describe("/connector/detect", function() {
		it("should return relevant translators with proxies", function* () {
			var code = 'function detectWeb() {return "newspaperArticle";}\nfunction doWeb() {}';
			var translator = buildDummyTranslator("web", code, {target: "https://www.example.com/.*"});
			sinon.stub(Zotero.Translators, 'getAllForType').resolves([translator]);
			
			var response = yield httpRequest(
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
		it("should save a translated item to the current selected collection", function* () {
			var collection = yield createDataObject('collection');
			yield select(win, collection);
			
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
					}
				],
				uri: "http://example.com"
			};
			
			
			var promise = waitForItemEvent('add');
			var reqPromise = httpRequest(
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
			
			var req = yield reqPromise;
			assert.equal(req.status, 201);
		});
		
		
		it("should switch to My Library if read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield select(win, group);
			
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
			var reqPromise = httpRequest(
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
				proxy: {scheme: 'https://%h.proxy.example.com/%p'}
			};
			
			var promise = waitForItemEvent('add');
			var req = yield httpRequest(
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

	describe("/connector/saveSingleFile", function () {
		it("should save a webpage item with /saveSnapshot", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);

			// Promise for item save
			let promise = waitForItemEvent('add');

			let testDataDirectory = getTestDataDirectory().path;
			let indexPath = OS.Path.join(testDataDirectory, 'snapshot', 'index.html');

			let title = Zotero.Utilities.randomString();
			let sessionID = Zotero.Utilities.randomString();
			let payload = {
				sessionID,
				url: "http://example.com/test",
				title,
			};

			await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(payload)
				}
			);

			// Await item save
			let parentIDs = await promise;

			// Check parent item
			assert.lengthOf(parentIDs, 1);
			var item = Zotero.Items.get(parentIDs[0]);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'webpage');
			assert.isTrue(collection.hasItem(item.id));
			assert.equal(item.getField('title'), title);

			// Promise for attachment save
			promise = waitForItemEvent('add');

			let body = JSON.stringify(Object.assign(payload, {
				snapshotContent: await Zotero.File.getContentsAsync(indexPath)
			}));

			await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSingleFile",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body
				}
			);

			// Await attachment save
			let attachmentIDs = await promise;

			// Check attachment
			assert.lengthOf(attachmentIDs, 1);
			item = Zotero.Items.get(attachmentIDs[0]);
			assert.isTrue(item.isImportedAttachment());
			assert.equal(item.getField('title'), title);

			// Check attachment html file
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
			let path = OS.Path.join(attachmentDirectory, item.attachmentFilename);
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			let expectedContents = await Zotero.File.getContentsAsync(indexPath);
			assert.equal(contents, expectedContents);
		});

		it("should save a webpage item with /saveItems", async function () {
			let collection = await createDataObject('collection');
			await select(win, collection);

			let title = Zotero.Utilities.randomString();
			let sessionID = Zotero.Utilities.randomString();
			let payload = {
				sessionID: sessionID,
				items: [
					{
						itemType: "newspaperArticle",
						title: title,
						creators: [
							{
								firstName: "First",
								lastName: "Last",
								creatorType: "author"
							}
						]
					}
				],
				uri: "http://example.com"
			};

			let promise = waitForItemEvent('add');
			let req = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(payload)
				}
			);
			assert.equal(req.status, 201);

			// Check parent item
			let itemIDs = await promise;
			assert.lengthOf(itemIDs, 1);
			let item = Zotero.Items.get(itemIDs[0]);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'newspaperArticle');
			assert.isTrue(collection.hasItem(item.id));

			// Promise for attachment save
			promise = waitForItemEvent('add');

			let testDataDirectory = getTestDataDirectory().path;
			let indexPath = OS.Path.join(testDataDirectory, 'snapshot', 'index.html');

			let body = JSON.stringify(Object.assign(payload, {
				url: `${testServerPath}/attachment`,
				snapshotContent: await Zotero.File.getContentsAsync(indexPath)
			}));

			req = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSingleFile",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body
				}
			);
			assert.equal(req.status, 201);

			// Await attachment save
			let attachmentIDs = await promise;

			// Check attachment
			assert.lengthOf(attachmentIDs, 1);
			item = Zotero.Items.get(attachmentIDs[0]);
			assert.isTrue(item.isImportedAttachment());
			assert.equal(item.getField('title'), 'Test');

			// Check attachment html file
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
			let path = OS.Path.join(attachmentDirectory, item.attachmentFilename);
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getContentsAsync(path);
			let expectedContents = await Zotero.File.getContentsAsync(indexPath);
			assert.equal(contents, expectedContents);
		});
	});

	describe("/connector/saveSnapshot", function () {
		it("should save a webpage item to the current selected collection", function* () {
			var collection = yield createDataObject('collection');
			yield select(win, collection);

			// saveSnapshot saves parent and child before returning
			var ids;
			var promise = waitForItemEvent('add').then(function (_ids) {
				ids = _ids;
			});

			var file = getTestDataDirectory();
			file.append('snapshot');
			file.append('index.html');
			httpd.registerFile("/test", file);

			yield httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						url: `${testServerPath}/test`,
						title: "Title"
					})
				}
			);

			assert.isTrue(promise.isFulfilled());

			// Check item
			assert.lengthOf(ids, 1);
			var item = Zotero.Items.get(ids[0]);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'webpage');
			assert.isTrue(collection.hasItem(item.id));
			assert.equal(item.getField('title'), 'Title');
		});

		it("should switch to My Library if a read-only library is selected", function* () {
			var group = yield createGroup({
				editable: false
			});
			yield select(win, group);
			
			var promise = waitForItemEvent('add');
			var reqPromise = httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						url: testServerPath + '/snapshot',
						html: snapshotHTML
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
	
	describe("/connector/saveAttachment", function () {
		const pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
		let pdfSample, pdfArrayBuffer;
		before(async function () {
			await selectLibrary(win, Zotero.Libraries.userLibraryID);
	 		pdfSample = await Zotero.File.getSample(pdfPath);
			pdfArrayBuffer = (await OS.File.read(pdfPath)).buffer;
		});

		it("should save a child item attachment to the specified parent item", async function () {
			// First, save multiple items
			const sessionID = Zotero.Utilities.randomString();
			const bookItemID = Zotero.Utilities.randomString();
			const articleItemID = Zotero.Utilities.randomString();
			const body = {
				sessionID,
				items: [
					{
						id: bookItemID,
						itemType: "book",
						title: "Book Title",
					},
					{
						id: articleItemID,
						itemType: "journalArticle",
						title: "Article Title",
					}
				]
			};
			
			let itemAddPromise = waitForItemEvent('add');
			let saveItemsReq = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			
			assert.equal(saveItemsReq.status, 201);
			let itemIDs = await itemAddPromise;
			let bookItem = Zotero.Items.get(itemIDs[0]);
			let articleItem = Zotero.Items.get(itemIDs[1]);
			assert.equal(bookItem.numAttachments(), 0);
			assert.equal(articleItem.numAttachments(), 0);
			
			// Now save an attachment to the first parent item (book)
			let attachmentAddPromise = waitForItemEvent('add');
			let attachmentReq = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveAttachment",
				{
					headers: {
						"Content-Type": "application/pdf",
						"X-Metadata": JSON.stringify({
							sessionID,
							title: "Book Attachment",
							parentItemID: bookItemID,
							url: `${testServerPath}/attachment1.pdf`,
						})
					},
					body: pdfArrayBuffer
				}
			);
			
			assert.equal(attachmentReq.status, 201);
			let attachmentIds = await attachmentAddPromise;
			assert.lengthOf(attachmentIds, 1);
			let attachment1 = Zotero.Items.get(attachmentIds[0]);
			assert.equal(bookItem.numAttachments(), 1);
			assert.equal(articleItem.numAttachments(), 0);
			
			// Verify attachment was saved correctly
			assert.equal(attachment1.parentItemID, bookItem.id);
			assert.equal(attachment1.getField('title'), "Book Attachment");
			assert.isTrue(attachment1.isPDFAttachment());
			
			
			// Save a second attachment to the second parent item (article)
			attachmentAddPromise = waitForItemEvent('add');
			attachmentReq = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveAttachment",
				{
					headers: {
						"Content-Type": "application/pdf",
						"X-Metadata": JSON.stringify({
							sessionID,
							title: "Article Attachment",
							parentItemID: articleItemID,
							url: `${testServerPath}/attachment2.pdf`,
						})
					},
					body: pdfArrayBuffer
				}
			);
			
			assert.equal(attachmentReq.status, 201);
			attachmentIds = await attachmentAddPromise;
			assert.lengthOf(attachmentIds, 1);
			var attachment2 = Zotero.Items.get(attachmentIds[0]);
			
			// Verify second attachment was saved correctly
			assert.equal(attachment2.parentItemID, articleItem.id);
			assert.equal(attachment2.getField('title'), "Article Attachment");
			assert.isTrue(attachment2.isPDFAttachment());
			
			assert.equal(bookItem.numAttachments(), 1);
			assert.equal(articleItem.numAttachments(), 1);

			// Verify attachment content
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(attachment1).path;
			let path = OS.Path.join(attachmentDirectory, attachment1.attachmentFilename);
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getSample(path);
			assert.equal(contents, pdfSample);
		});
	});

	describe("/connector/hasAttachmentResolvers", function () {
		it("should respond with 'true' if the item has OA attachments", async function () {
			const sessionID = Zotero.Utilities.randomString();
			const itemID = Zotero.Utilities.randomString();
			const body = {
				sessionID,
				items: [
					{
						id: itemID,
						itemType: "journalArticle",
						title: "Test Article with DOI",
						DOI: "10.1234/example.doi",
					}
				]
			};
			
			let response = await httpRequest(
				"POST",
				connectorServerPath + "/connector/saveItems", 
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			
			assert.equal(response.status, 201);
			
			response = await httpRequest(
				"POST",
				connectorServerPath + "/connector/hasAttachmentResolvers",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						itemID
					}),
				}
			);
			
			assert.equal(response.status, 200);
			assert.isTrue(JSON.parse(response.responseText));
		});

		it("should respond with 'false' if the item has no OA attachments", async function () {
			const sessionID = Zotero.Utilities.randomString();
			const itemID = Zotero.Utilities.randomString();
			const body = {
				sessionID,
				items: [
					{
						id: itemID,
						itemType: "journalArticle",
						title: "Test Article",
					}
				]
			};
			
			let response = await httpRequest(
				"POST",
				connectorServerPath + "/connector/saveItems", 
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			
			assert.equal(response.status, 201);
			
			response = await httpRequest(
				"POST",
				connectorServerPath + "/connector/hasAttachmentResolvers",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						itemID
					}),
				}
			);
			
			assert.equal(response.status, 200);
			assert.isFalse(JSON.parse(response.responseText));
		});
	});

	describe("/connector/saveAttachmentFromResolver", function () {
		it("should save an OA attachment for the specified item and return 201 if OA attachment is available", async function () {
			let stub = sinon.stub(Zotero.Attachments, 'addFileFromURLs').returns({
				id: Zotero.Utilities.randomString(),
				getDisplayTitle: () => "OA Attachment"
			});
			try {
				const sessionID = Zotero.Utilities.randomString();
				const itemID = Zotero.Utilities.randomString();
				const body = {
					sessionID,
					items: [
						{
							id: itemID,
							itemType: "journalArticle",
							title: "Test Article with DOI",
							DOI: "10.1234/example.doi",
						}
					]
				};
				
				let response = await httpRequest(
					"POST",
					connectorServerPath + "/connector/saveItems",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify(body)
					}
				);
				
				assert.equal(response.status, 201);
				
				response = await httpRequest(
					"POST",
					connectorServerPath + "/connector/saveAttachmentFromResolver",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID,
							itemID
						}),
					}
				);
				
				assert.equal(response.status, 201);
				assert.equal(response.responseText, "OA Attachment");
			}
			finally {
				stub.restore();
			}
		});

		it("should return 500 if OA attachment is not available", async function () {
			let stub = sinon.stub(Zotero.Attachments, 'addFileFromURLs').returns(null);
			try {
				const sessionID = Zotero.Utilities.randomString();
				const itemID = Zotero.Utilities.randomString();
				const body = {
					sessionID,
					items: [
						{
							id: itemID,
							itemType: "journalArticle",
							title: "Test Article with DOI",
							DOI: "10.1234/example.doi",
						}
					]
				};
				
				let response = await httpRequest(
					"POST",
					connectorServerPath + "/connector/saveItems",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify(body)
					}
				);
				
				assert.equal(response.status, 201);
				
				response = await httpRequest(
					"POST",
					connectorServerPath + "/connector/saveAttachmentFromResolver",
					{
						headers: {
							"Content-Type": "application/json"
						},
						successCodes: false,
						body: JSON.stringify({
							sessionID,
							itemID
						}),
					}
				);
				
				assert.equal(response.status, 500);
				assert.equal(response.responseText, "Failed to save an attachment");
			}
			finally {
				stub.restore();
			}
		});
	});
	

	describe("/connector/saveStandaloneAttachment", function () {
		before(async function () {
			await selectLibrary(win, Zotero.Libraries.userLibraryID);
		});

		it("should save a standalone PDF attachment", async function () {
			const pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
	 		const pdfSample = await Zotero.File.getSample(pdfPath);
			const pdfArrayBuffer = (await OS.File.read(pdfPath)).buffer;
			const attachmentInfo = {
				url: `${testServerPath}/test1.pdf`,
				title: "Test PDF1",
				contentType: "application/pdf",
				sessionID: Zotero.Utilities.randomString()
			};
			let itemIDsPromise = waitForItemEvent('add');
			let xhr = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveStandaloneAttachment",
				{
					headers: {
						"Content-Type": attachmentInfo.contentType,
						"X-Metadata": JSON.stringify(attachmentInfo)
					},
					body: pdfArrayBuffer
				}
			);

			assert.equal(xhr.status, 201);
			assert.isTrue(JSON.parse(xhr.responseText).canRecognize);
			let itemIDs = await itemIDsPromise;
			let item = Zotero.Items.get(itemIDs[0]);
			
			assert.equal(item.itemType, "attachment");
			assert.equal(item.attachmentContentType, attachmentInfo.contentType);
			assert.equal(item.getField("title"), attachmentInfo.title);
			assert.equal(item.getField("url"), attachmentInfo.url);
			// Check content
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
			let path = OS.Path.join(attachmentDirectory, item.attachmentFilename);
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getSample(path);
			assert.equal(contents, pdfSample);
		});

		it("should save a standalone image attachment", async function () {
			const imagePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
	 		const imageSample = await Zotero.File.getSample(imagePath);
			const imageArrayBuffer = (await OS.File.read(imagePath)).buffer;
			const attachmentInfo = {
				url: `${testServerPath}/test.png`,
				title: "Test PNG",
				contentType: "image/png",
				sessionID: Zotero.Utilities.randomString()
			};
			
			let itemIDsPromise = waitForItemEvent('add');
			let xhr = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveStandaloneAttachment",
				{
					headers: {
						"Content-Type": attachmentInfo.contentType,
						"X-Metadata": JSON.stringify(attachmentInfo)
					},
					body: imageArrayBuffer
				}
			);

			assert.equal(xhr.status, 201);
			assert.isFalse(JSON.parse(xhr.responseText).canRecognize);
			let itemIDs = await itemIDsPromise;
			let item = Zotero.Items.get(itemIDs[0]);
			
			assert.equal(item.itemType, "attachment");
			assert.equal(item.attachmentContentType, attachmentInfo.contentType);
			assert.equal(item.getField("title"), attachmentInfo.title);
			assert.equal(item.getField("url"), attachmentInfo.url);
			// Check content
			let attachmentDirectory = Zotero.Attachments.getStorageDirectory(item).path;
			let path = OS.Path.join(attachmentDirectory, item.attachmentFilename);
			assert.isTrue(await OS.File.exists(path));
			let contents = await Zotero.File.getSample(path);
			assert.equal(contents, imageSample);
		});
	});


	describe("/connector/getRecognizedItem", function () {
		it("should return the recognized parent item", async function () {
			const stub = sinon.stub(Zotero.RecognizeDocument, '_recognize').callsFake(async () => {
				return await createDataObject('item', {
					title: "Recognized Item",
				});
			});

			try {
				const pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
				const pdfArrayBuffer = (await OS.File.read(pdfPath)).buffer;
				const sessionID = Zotero.Utilities.randomString();
				const attachmentInfo = {
					url: `${testServerPath}/test2.pdf`,
					title: "Test PDF2",
					contentType: "application/pdf",
					sessionID
				};
				let itemIDsPromise = waitForItemEvent('add');
				let xhr = await httpRequest(
					'POST',
					connectorServerPath + "/connector/saveStandaloneAttachment",
					{
						headers: {
							"Content-Type": attachmentInfo.contentType,
							"X-Metadata": JSON.stringify(attachmentInfo)
						},
						body: pdfArrayBuffer
					}
				);

				assert.equal(xhr.status, 201);
				assert.isTrue(JSON.parse(xhr.responseText).canRecognize);
				let itemIDs = await itemIDsPromise;
				let standaloneAttachment = Zotero.Items.get(itemIDs[0]);
				
				assert.isFalse(standaloneAttachment.parentID);

				let recognizedItemIDsPromise = waitForItemEvent('add');
				xhr = await httpRequest(
					'POST',
					connectorServerPath + "/connector/getRecognizedItem",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID
						})
					}
				);

				assert.isTrue(stub.called);
				assert.equal(xhr.status, 200);
				assert.equal(JSON.parse(xhr.responseText).title, "Recognized Item");
				let recognizedItemIDs = await recognizedItemIDsPromise;
				let recognizedItem = Zotero.Items.get(recognizedItemIDs[0]);
				assert.equal(standaloneAttachment.parentID, recognizedItem.id);
			}
			finally {
				stub.restore();
			}
		});
	});
	
	
	describe("/connector/updateSession", function () {
		it("should update collections, tags, and notes of item saved via /saveItems", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			await select(win, collection2);
			
			const id = Zotero.Utilities.randomString();
			var sessionID = Zotero.Utilities.randomString();
			var body = {
				sessionID,
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
						id,
						creators: [
							{
								firstName: "First",
								lastName: "Last",
								creatorType: "author"
							}
						]
					}
				],
				uri: "http://example.com"
			};
			
			var reqPromise = httpRequest(
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
			var req = await reqPromise;
			assert.equal(req.status, 201);

			reqPromise = httpRequest(
				'POST',
				connectorServerPath + "/connector/saveAttachment",
				{
					headers: {
						"Content-Type": "text/html",
						"X-Metadata": JSON.stringify({
							sessionID,
							title: "Attachment",
							parentItemID: id,
							url: `${testServerPath}/attachment`,
						})
					},
					body: "<html><head><title>Title</title><body>Body</body></html>"
				}
			);

			let childIDs = await waitForItemEvent('add');
			req = await reqPromise;
			assert.equal(req.status, 201);
			var childItem = Zotero.Items.get(childIDs[0]);
			assert.equal(childItem.getField('title'), "Attachment");
			assert.equal(childItem.parentID, item.id);

			
			// Update saved item
			var req = await httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: collection1.treeViewID,
						tags: "A, B",
						note: "Test note"
					})
				}
			);
			
			assert.equal(req.status, 200);
			assert.isTrue(collection1.hasItem(item.id));
			assert.isTrue(item.hasTag("A"));
			assert.isTrue(item.hasTag("B"));
			let note = Zotero.Items.get(item.getNotes())[0];
			assert.equal(note.getNote(), "Test note");
		});
		
		it("should update collections and tags of a PDF saved via /saveStandaloneAttachment", async function () {
			const sessionID = Zotero.Utilities.randomString();
			
			let collection1 = await createDataObject('collection');
			let collection2 = await createDataObject('collection');
			await select(win, collection2);

			const pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
			const pdfArrayBuffer = (await OS.File.read(pdfPath)).buffer;
			const attachmentInfo = {
				url: `${testServerPath}/test1.pdf`,
				title: "Test PDF1",
				contentType: "application/pdf",
				sessionID
			};

			let ids;
			let promise = waitForItemEvent('add');
			let req = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveStandaloneAttachment",
				{
					headers: {
						"Content-Type": attachmentInfo.contentType,
						"X-Metadata": JSON.stringify(attachmentInfo)
					},
					body: pdfArrayBuffer
				}
			);
			
			ids = await promise;
			let item = Zotero.Items.get(ids[0]);
			assert.isTrue(collection2.hasItem(item.id));
			assert.equal(req.status, 201);
			
			// Update saved item
			req = await httpRequest(
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
			await select(win, collection2);
			
			// saveSnapshot saves parent and child before returning
			var ids1, ids2;
			var promise = waitForItemEvent('add').then(function (ids) {
				ids1 = ids;
				return waitForItemEvent('add').then(function (ids) {
					ids2 = ids;
				});
			});
			await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						url: testServerPath + '/snapshot',
						title: "Title"
					})
				}
			);

			await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSingleFile",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						title: "Snapshot",
						url: `${testServerPath}/snapshot`,
						snapshotContent: "<html><head><title>Title</title><body>Body</body></html>"
					})
				}
			);
			
			assert.isTrue(promise.isFulfilled());
			
			var item = Zotero.Items.get(ids1[0]);
			
			// Update saved item
			var req = await httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: collection1.treeViewID,
						tags: "A, B",
						note: "Test note"
					})
				}
			);
			
			assert.equal(req.status, 200);
			assert.isTrue(collection1.hasItem(item.id));
			assert.isTrue(item.hasTag("A"));
			assert.isTrue(item.hasTag("B"));
			let note = Zotero.Items.get(item.getNotes())[0];
			assert.equal(note.getNote(), "Test note");
		});
		
		it("should move item saved via /saveItems to another library", async function () {
			var group = await createGroup({ editable: true, filesEditable: false });
			await select(win, group);

			const id = Zotero.Utilities.randomString();
			const sessionID = Zotero.Utilities.randomString();

			let saveAttachment = () => {
				return httpRequest(
					'POST',
					connectorServerPath + "/connector/saveAttachment",
					{
						headers: {
							"Content-Type": "text/html",
							"X-Metadata": JSON.stringify({
								sessionID,
								title: "Attachment",
								parentItemID: id,
								url: `${testServerPath}/attachment`,
							})
						},
						body: "<html><head><title>Title</title><body>Body</body></html>"
					}
				);
			};
			
			var body = {
				sessionID,
				items: [
					{
						itemType: "newspaperArticle",
						title: "Title",
						id,
					}
				],
				uri: "http://example.com"
			};
			
			var reqPromise = httpRequest(
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
			var req = await reqPromise;
			assert.equal(req.status, 201);

			req = await saveAttachment();
			// Attachment save returns with 200 since library files are not editable
			assert.equal(req.status, 200);
			assert.equal(req.responseText, "Library files are not editable.");

			// Add a note
			await httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: group.treeViewID,
						note: "Test note"
					})
				}
			);
			var note1ID = item1.getNotes()[0];
			assert.isNumber(note1ID);
			
			// Move item to user library where we can save files
			reqPromise = httpRequest(
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
			
			var ids2 = await waitForItemEvent('add');
			req = await reqPromise;
			assert.equal(req.status, 200);

			reqPromise = saveAttachment();
			await waitForItemEvent('add');
			req = await reqPromise;
			// Attachment is saved in user library
			assert.equal(req.status, 201);
			
			var item2 = Zotero.Items.get(ids2[0]);
			assert.isFalse(Zotero.Items.exists(item1.id));
			assert.equal(item2.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(item2.numAttachments(), 1);
			// Make sure the child note remains
			assert.equal(item2.getNotes().length, 1);
			let note = Zotero.Items.get(item2.getNotes())[0];
			let note2ID = note.id;
			assert.equal(note.getNote(), "Test note");
			// Make sure the child note from another group is gone
			assert.isFalse(Zotero.Items.get(note1ID));
			
			// Move back to the file-editing restricted group
			reqPromise = httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						target: group.treeViewID,
						note: note.getNote()
					})
				}
			);
			
			var ids3 = await waitForItemEvent('add');
			var item3 = Zotero.Items.get(ids3[0]);
			
			req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item2.id));
			assert.equal(item3.libraryID, group.libraryID);
			assert.equal(item3.numAttachments(), 0);
			// Make sure the child note remains
			assert.equal(item3.getNotes().length, 1);
			note = Zotero.Items.get(item3.getNotes())[0];
			assert.equal(note.getNote(), "Test note");
			// Make sure the child note from another group is gone
			assert.isFalse(Zotero.Items.get(note2ID));
		});
		
		it("should move item saved via /saveSnapshot to another library", async function () {
			var group = await createGroup({ editable: true, filesEditable: false });
			await select(win, group);

			const sessionID = Zotero.Utilities.randomString();
			let saveSingleFile = () => {
				return httpRequest(
					'POST',
					connectorServerPath + "/connector/saveSingleFile",
					{
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							sessionID,
							title: "Snapshot",
							url: `${testServerPath}/snapshot`,
							snapshotContent: "<html><head><title>Title</title><body>Body</body></html>"
						})
					}
				);
			};
			
			var reqPromise = httpRequest(
				'POST',
				connectorServerPath + "/connector/saveSnapshot",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						sessionID,
						url: testServerPath + '/snapshot',
					})
				}
			);
			
			var ids1 = await waitForItemEvent('add');
			var req = await reqPromise;
			assert.equal(req.status, 201);
			var item1 = Zotero.Items.get(ids1[0]);
			req = await saveSingleFile();
			assert.equal(req.status, 200);
			assert.equal(req.responseText, "Library files are not editable.");
			
			// Move item to user library with file attachments
			var reqPromise = httpRequest(
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
			
			var ids2 = await waitForItemEvent('add');
			var item2 = Zotero.Items.get(ids2[0]);
			
			var req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item1.id));
			assert.equal(item2.libraryID, Zotero.Libraries.userLibraryID);

			req = await saveSingleFile();
			assert.equal(req.status, 201);
			assert.equal(item2.numAttachments(), 1);
			
			// Move back to the file-editing restricted group
			reqPromise = httpRequest(
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
			
			var ids3 = await waitForItemEvent('add');
			var item3 = Zotero.Items.get(ids3[0]);
			
			req = await reqPromise;
			assert.equal(req.status, 200);
			assert.isFalse(Zotero.Items.exists(item2.id));
			assert.equal(item3.libraryID, group.libraryID);
			assert.equal(item3.numAttachments(), 0);
		});

		it("should delete added child note if its content is erased", async function () {
			let collection = await createDataObject('collection');
			await select(win, collection);

			let sessionID = Zotero.Utilities.randomString();
			let payload = {
				sessionID,
				items: [
					{
						itemType: "newspaperArticle",
						title: "Note Test",
						creators: [
							{ firstName: "First", lastName: "Last", creatorType: "author" }
						],
						attachments: []
					}
				],
				uri: "http://example.com"
			};

			let promise = waitForItemEvent('add');
			// Create item
			await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload)
				}
			);
			let ids = await promise;
			let item = Zotero.Items.get(ids[0]);

			// Add a note
			await httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sessionID,
						target: collection.treeViewID,
						note: "Test note"
					})
				}
			);
			let notes = Zotero.Items.get(item.getNotes());
			assert.isNotEmpty(notes);
			assert.equal(notes[0].getNote(), "Test note");

			// Erase the note
			await httpRequest(
				'POST',
				connectorServerPath + "/connector/updateSession",
				{
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sessionID,
						target: collection.treeViewID,
						note: ""
					})
				}
			);
			// Make sure the child note is removed
			notes = Zotero.Items.get(item.getNotes());
			assert.equal(notes.length, 0);
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
			var error = yield getPromiseError(httpRequest(
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
				var parser = new DOMParser(),
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
			
			var response = yield httpRequest(
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
				var parser = new DOMParser(),
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
			var response = await httpRequest(
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
			response = await httpRequest(
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
			var req = await httpRequest(
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
			const sessionID = Zotero.Utilities.randomString();
			var error = yield getPromiseError(httpRequest(
				'POST',
				endpoint + `?session=${sessionID}`,
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
			const sessionID = Zotero.Utilities.randomString();
			var req = await httpRequest(
				'POST',
				endpoint + `?session=${sessionID}`,
				{
					headers: {
						"Content-Type": "text/plain"
					},
					successCodes: [403]
				}
			);
			assert.equal(req.status, 403);
		});
		
		it('should import resources (BibTeX) into selected collection', async function () {
			const sessionID = Zotero.Utilities.randomString();
			var collection = await createDataObject('collection');
			await select(win, collection);
			
			var resource = `@book{test1,
  title={Test1},
  author={Owl},
  year={1000},
  publisher={Curly Braces Publishing},
  keywords={A, B}
}`;
			
			var addedItemIDsPromise = waitForItemEvent('add');
			var req = await httpRequest(
				'POST',
				endpoint + `?session=${sessionID}`,
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
			
			let itemIDs = await addedItemIDsPromise;
			assert.isTrue(collection.hasItem(itemIDs[0]));
			var item = Zotero.Items.get(itemIDs[0]);
			assert.sameDeepMembers(item.getTags(), [{ tag: 'A', type: 1 }, { tag: 'B', type: 1 }]);
		});
		
		
		it('should switch to My Library if read-only library is selected', async function () {
			const sessionID = Zotero.Utilities.randomString();
			var group = await createGroup({
				editable: false
			});
			await select(win, group);
			
			var resource = `@book{test1,
  title={Test1},
  author={Owl},
  year={1000},
  publisher={Curly Braces Publishing}
}`;
			
			var addedItemIDsPromise = waitForItemEvent('add');
			var req = await httpRequest(
				'POST',
				endpoint + `?session=${sessionID}`,
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
			
			let itemIDs = await addedItemIDsPromise;
			var item = Zotero.Items.get(itemIDs[0]);
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
		});
	});
	
	describe('/connector/request', function () {
		let endpoint;
		
		before(function () {
			endpoint = connectorServerPath + '/connector/request';
		});
		
		beforeEach(function () {
			Zotero.Server.Connector.Request.enableValidation = true;
		});

		after(function () {
			Zotero.Server.Connector.Request.enableValidation = true;
		});
		
		it('should reject GET requests', async function () {
			let req = await httpRequest(
				'GET',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: 'https://www.example.com/'
					}),
					successCodes: false
				}
			);
			assert.equal(req.status, 400);
			assert.include(req.responseText, 'Endpoint does not support method');
		});

		it('should not make requests to arbitrary hosts', async function () {
			let req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: `http://localhost:${Zotero.Server.port}/`
					}),
					successCodes: false
				}
			);
			assert.equal(req.status, 400);
			assert.include(req.responseText, 'Unsupported URL');

			req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: `http://www.example.com/`
					}),
					successCodes: false
				}
			);
			assert.equal(req.status, 400);
			assert.include(req.responseText, 'Unsupported URL');
		});

		it('should reject requests with non-Mozilla/ user agents', async function () {
			let req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: {
						'content-type': 'application/json',
						'user-agent': 'BadBrowser/1.0'
					},
					body: JSON.stringify({
						method: 'GET',
						url: `https://www.worldcat.org/api/nonexistent`
					}),
					successCodes: false
				}
			);
			assert.equal(req.status, 400);
			assert.include(req.responseText, 'Unsupported User-Agent');
		});

		it('should allow a request to an allowed host', async function () {
			let stub = sinon.stub(Zotero.HTTP, 'request');
			// First call: call original
			stub.callThrough();
			// Second call (call from within /connector/request handler): return the following
			stub.onSecondCall().returns({
				status: 200,
				getAllResponseHeaders: () => '',
				response: 'it went through'
			});
			
			let req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: `https://www.worldcat.org/api/nonexistent`
					})
				}
			);
			assert.equal(req.status, 200);
			assert.equal(JSON.parse(req.responseText).body, 'it went through');
			
			stub.restore();
		});

		it('should return response in translator request() format with lowercase headers', async function () {
			let testEndpointPath = '/test/header';
			
			httpd.registerPathHandler(
				testEndpointPath,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, 'OK');
						response.setHeader('X-Some-Header', 'Header value');
						response.write('body');
					}
				}
			);
			
			Zotero.Server.Connector.Request.enableValidation = false;
			let req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: testServerPath + testEndpointPath
					}),
					responseType: 'json'
				}
			);
			
			assert.equal(req.response.status, 200);
			assert.equal(req.response.headers['x-some-header'], 'Header value');
			assert.equal(req.response.body, 'body');
		});

		it('should set Referer', async function () {
			let testEndpointPath = '/test/referer';
			let referer = 'https://www.example.com/';

			httpd.registerPathHandler(
				testEndpointPath,
				{
					handle: function (request, response) {
						assert.equal(request.getHeader('Referer'), referer);
						response.setStatusLine(null, 200, 'OK');
						response.write('');
					}
				}
			);

			Zotero.Server.Connector.Request.enableValidation = false;
			let req = await httpRequest(
				'POST',
				endpoint,
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						method: 'GET',
						url: testServerPath + testEndpointPath,
						options: {
							headers: {
								Referer: referer
							}
						}
					})
				}
			);

			assert.equal(JSON.parse(req.response).status, 200);
		});
	});

	describe('/connector/cancelSession', function () {
		var pdfArrayBuffer;
		var pdfPath = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
		before(async () => {
			await selectLibrary(win, Zotero.Libraries.userLibraryID);
			pdfArrayBuffer = (await OS.File.read(pdfPath)).buffer;
		});

		it('should delete saved items if called after everything is saved', async function () {
			var collection = await createDataObject('collection');
			let sessionID = Zotero.Utilities.randomString();
			let bookItemID = Zotero.Utilities.randomString();
			await select(win, collection);

			let body = {
				sessionID,
				items: [
					{
						id: bookItemID,
						itemType: "book",
						title: "Book Title",
					}
				]
			};
			let itemAddPromise = waitForItemEvent('add');
			// Save the item as if by the connector
			await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			let itemIDs = await itemAddPromise;

			// Add the attachment to the item
			let attachmentAddPromise = waitForItemEvent('add');
			let attachmentReq = await httpRequest(
				'POST',
				connectorServerPath + "/connector/saveAttachment",
				{
					headers: {
						"Content-Type": "application/pdf",
						"X-Metadata": JSON.stringify({
							sessionID,
							title: "Book Attachment",
							parentItemID: bookItemID,
							url: `${testServerPath}/attachment1.pdf`,
						})
					},
					body: pdfArrayBuffer
				}
			);
			assert.equal(attachmentReq.status, 201);
			let attachmentIds = await attachmentAddPromise;
			assert.lengthOf(attachmentIds, 1);
			let attachment1 = Zotero.Items.get(attachmentIds[0]);
			let bookItem = Zotero.Items.get(itemIDs[0]);
			assert.equal(attachment1.parentItemID, bookItem.id);

			// Cancel the session
			let cancelReq = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + '/connector/cancelSession',
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ sessionID })
				}
			);
			assert.equal(cancelReq.status, 200);

			// The item and attachment should be deleted
			let deletedItem = await Zotero.Items.getAsync(attachment1.parentItemID);
			let deletedAttachment = await Zotero.Items.getAsync(attachment1.id);
			assert.isFalse(deletedItem);
			assert.isFalse(deletedAttachment);
		});

		it('should not save attachment items if session is cancelled half-way through', async function () {
			var collection = await createDataObject('collection');
			let sessionID = Zotero.Utilities.randomString();
			let bookItemID = Zotero.Utilities.randomString();
			await select(win, collection);

			let body = {
				sessionID,
				items: [
					{
						id: bookItemID,
						itemType: "book",
						title: "Book Title",
					}
				]
			};

			let itemAddPromise = waitForItemEvent('add');
			// Save the item as if by the connector
			await Zotero.HTTP.request(
				'POST',
				connectorServerPath + "/connector/saveItems",
				{
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			);
			let itemIDs = await itemAddPromise;

			// Cancel the session
			let cancelReq = await Zotero.HTTP.request(
				'POST',
				connectorServerPath + '/connector/cancelSession',
				{
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ sessionID })
				}
			);
			assert.equal(cancelReq.status, 200);

			// Try to add the attachment to the item
			let attachmentReq = await getPromiseError(httpRequest(
				'POST',
				connectorServerPath + "/connector/saveAttachment",
				{
					headers: {
						"Content-Type": "application/pdf",
						"X-Metadata": JSON.stringify({
							sessionID,
							title: "Book Attachment",
							parentItemID: bookItemID,
							url: `${testServerPath}/attachment1.pdf`,
						})
					},
					body: pdfArrayBuffer
				}
			));
			// It should be rejected
			assert.equal(attachmentReq.status, 409);

			// The parent item should also be removed
			let bookItem = await Zotero.Items.getAsync(itemIDs[0]);
			assert.isFalse(bookItem);
		});
	});
});
