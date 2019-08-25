new function() {
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://zotero-unit/httpd.js");

/**
 * Create a new translator that saves the specified items
 * @param {String} translatorType - "import" or "web"
 * @param {Object} items - items as translator JSON
 */
function saveItemsThroughTranslator(translatorType, items, translateOptions = {}) {
	let tyname;
	if (translatorType == "web") {
		tyname = "Web";
	} else if (translatorType == "import") {
		tyname = "Import";
	} else {
		throw new Error("invalid translator type "+translatorType);
	}

	let translate = new Zotero.Translate[tyname]();
	let browser;
	if (translatorType == "web") {
		browser = Zotero.Browser.createHiddenBrowser();
		translate.setDocument(browser.contentDocument);
	} else if (translatorType == "import") {
		translate.setString("");
	}
	translate.setTranslator(buildDummyTranslator(
		translatorType,
		"function detectWeb() {}\n"+
		"function do"+tyname+"() {\n"+
		"	var json = JSON.parse('"+JSON.stringify(items).replace(/['\\]/g, "\\$&")+"');\n"+
		"	for (var i=0; i<json.length; i++) {"+
		"		var item = new Zotero.Item;\n"+
		"		for (var field in json[i]) { item[field] = json[i][field]; }\n"+
		"		item.complete();\n"+
		"	}\n"+
		"}"));
	return translate.translate(translateOptions).then(function(items) {
		if (browser) Zotero.Browser.deleteHiddenBrowser(browser);
		return items;
	});
}

/**
 * Convert an array of items to an object in which they are indexed by
 * their display titles
 */
function itemsArrayToObject(items) {
	var obj = {};
	for (let item of items) {
		obj[item.getDisplayTitle()] = item;
	}
	return obj;
}

const TEST_TAGS = [
	"manual tag as string",
	{"tag":"manual tag as object"},
	{"tag":"manual tag as object with type", "type":0},
	{"tag":"automatic tag as object", "type":1},
	{"name":"tag in name property"}
];

/**
 * Check that tags match expected values, if TEST_TAGS is passed as test array
 */
function checkTestTags(newItem, web) {
	assert.equal(newItem.getTagType("manual tag as string"), web ? 1 : 0);
	assert.equal(newItem.getTagType("manual tag as object"), web ? 1 : 0);
	assert.equal(newItem.getTagType("manual tag as object with type"), web ? 1 : 0);
	assert.equal(newItem.getTagType("automatic tag as object"), 1);
	assert.equal(newItem.getTagType("tag in name property"), web ? 1 : 0);
}

/**
 * Get included test snapshot file
 * @returns {nsIFile}
 */
function getTestSnapshot() {
	let snapshot = getTestDataDirectory();
	snapshot.append("snapshot");
	snapshot.append("index.html");
	return snapshot;
}

/**
 * Get included test snapshot file
 * @returns {nsIFile}
 */
function getTestPDF() {
	let testPDF = getTestDataDirectory();
	testPDF.append("empty.pdf");
	return testPDF;
}

/**
 * Set up endpoints for testing attachment saving
 * This must happen immediately before the test, since Zotero might get
 * restarted by resetDB(), which would erase our registered endpoints.
 */
function setupAttachmentEndpoints() {
	var SnapshotTest = function() {};
	Zotero.Server.Endpoints["/test/translate/test.html"] = SnapshotTest;
	SnapshotTest.prototype = {
		"supportedMethods":["GET"],
		"init":function(data, sendResponseCallback) {
			Zotero.File.getBinaryContentsAsync(getTestSnapshot()).then(function (data) {
				sendResponseCallback(200, "text/html", data);
			});
		}
	}
	var PDFTest = function() {};
	Zotero.Server.Endpoints["/test/translate/test.pdf"] = PDFTest;
	PDFTest.prototype = {
		"supportedMethods":["GET"],
		"init":function(data, sendResponseCallback) {
			Zotero.File.getBinaryContentsAsync(getTestPDF()).then(function (data) {
				sendResponseCallback(200, "application/pdf", data);
			});
		}
	}
	var NonExistentTest = function() {};
	Zotero.Server.Endpoints["/test/translate/does_not_exist.html"] = NonExistentTest;
	NonExistentTest.prototype = {
		"supportedMethods":["GET"],
		"init":function(data, sendResponseCallback) {
			sendResponseCallback(404, "text/html", "File does not exist");
		}
	}
}

describe("Zotero.Translate", function() {
	let win;
	before(function* () {
		// TEMP: Fix for slow translator initialization on Linux/Travis
		this.timeout(20000);
		yield Zotero.Translators.init();
		
		setupAttachmentEndpoints();
		win = yield loadBrowserWindow();
	});
	after(function () {
		win.close();
	});

	describe("Zotero.Item", function() {
		it('should save ordinary fields and creators', function* () {
			this.timeout(10000);
			let data = loadSampleData('allTypesAndFields');
			let trueItems = loadSampleData('itemJSON');
			let saveItems = [];
			for (let itemType in data) {
				saveItems.push(data[itemType]);
				let trueItem = trueItems[itemType];
				delete trueItem.dateAdded;
				delete trueItem.dateModified;
				delete trueItem.key;
			}

			let newItems = yield saveItemsThroughTranslator("import", saveItems);
			let savedItems = {};
			for (let i=0; i<newItems.length; i++) {
				let savedItem = newItems[i].toJSON();
				savedItems[Zotero.ItemTypes.getName(newItems[i].itemTypeID)] = savedItem;
				delete savedItem.dateAdded;
				delete savedItem.dateModified;
				delete savedItem.key;
			}
			assert.deepEqual(savedItems, trueItems, "saved items match inputs");
		});

		it('should accept deprecated SQL accessDates', function* () {
			let myItem = {
				"itemType":"webpage",
				"title":"Test Item",
				"accessDate":"2015-01-02 03:04:05"
			}
			let newItems = yield saveItemsThroughTranslator("import", [myItem]);
			assert.equal(newItems[0].getField("accessDate"), "2015-01-02 03:04:05");
		});

		it('should save tags', function* () {
			let myItem = {
				"itemType":"book",
				"title":"Test Item",
				"tags":TEST_TAGS
			};
			checkTestTags((yield saveItemsThroughTranslator("import", [myItem]))[0]);
		});

		it('should save notes', function* () {
			let myItems = [
				{
					"itemType":"book",
					"title":"Test Item",
					"notes":[
						"1 note as string",
							{
								"note":"2 note as object",
								"tags":TEST_TAGS
							}
					]
				},
				{
					"itemType":"note",
					"note":"standalone note",
					"tags":TEST_TAGS
				}
			];

			let newItems = itemsArrayToObject(yield saveItemsThroughTranslator("import", myItems));
			let noteIDs = newItems["Test Item"].getNotes();
			let note1 = yield Zotero.Items.getAsync(noteIDs[0]);
			assert.equal(Zotero.ItemTypes.getName(note1.itemTypeID), "note");
			assert.equal(note1.getNote(), "1 note as string");
			let note2 = yield Zotero.Items.getAsync(noteIDs[1]);
			assert.equal(Zotero.ItemTypes.getName(note2.itemTypeID), "note");
			assert.equal(note2.getNote(), "2 note as object");
			checkTestTags(note2);
			let note3 = newItems["standalone note"];
			assert.equal(note3.getNote(), "standalone note");
			checkTestTags(note3);
		});
		
		it('should save relations', async function () {
			var item = await createDataObject('item');
			var itemURI = Zotero.URI.getItemURI(item);
			let myItem = {
				itemType: "book",
				title: "Test Item",
				relations: {
					"dc:relation": [itemURI]
				}
			};
			let newItems = await saveItemsThroughTranslator("import", [myItem]);
			var relations = newItems[0].getRelations();
			assert.lengthOf(Object.keys(relations), 1);
			assert.lengthOf(relations["dc:relation"], 1);
			assert.equal(relations["dc:relation"][0], itemURI);
		});
		
		it('should save collections', function* () {
			let translate = new Zotero.Translate.Import();
			translate.setString("");
			translate.setTranslator(buildDummyTranslator(4,
				'function detectWeb() {}\n'+
				'function doImport() {\n'+
				'	var item1 = new Zotero.Item("book");\n'+
				'   item1.title = "Not in Collection";\n'+
				'   item1.complete();\n'+
				'	var item2 = new Zotero.Item("book");\n'+
				'   item2.id = 1;\n'+
				'   item2.title = "In Parent Collection";\n'+
				'   item2.complete();\n'+
				'	var item3 = new Zotero.Item("book");\n'+
				'   item3.id = 2;\n'+
				'   item3.title = "In Child Collection";\n'+
				'   item3.complete();\n'+
				'	var collection = new Zotero.Collection();\n'+
				'	collection.name = "Parent Collection";\n'+
				'	collection.children = [{"id":1}, {"type":"collection", "name":"Child Collection", "children":[{"id":2}]}];\n'+
				'	collection.complete();\n'+
				'}'));
			let newItems = yield translate.translate();
			assert.equal(newItems.length, 3);
			newItems = itemsArrayToObject(newItems);
			assert.equal(newItems["Not in Collection"].getCollections().length, 0);

			let parentCollection = newItems["In Parent Collection"].getCollections();
			assert.equal(parentCollection.length, 1);
			parentCollection = (yield Zotero.Collections.getAsync(parentCollection))[0];
			assert.equal(parentCollection.name, "Parent Collection");
			assert.isTrue(parentCollection.hasChildCollections());

			let childCollection = newItems["In Child Collection"].getCollections();
			assert.equal(childCollection.length, 1);
			childCollection = (yield Zotero.Collections.getAsync(childCollection[0]));
			assert.equal(childCollection.name, "Child Collection");
			let parentChildren = parentCollection.getChildCollections();
			assert.equal(parentChildren.length, 1);
			assert.equal(parentChildren[0], childCollection);
		});

		it('import translators should save attachments', function* () {
			let emptyPDF = getTestPDF().path;
			let snapshot = getTestSnapshot().path;
			let myItems = [
				{
					"itemType":"attachment",
					"path":emptyPDF,
					"title":"Empty PDF",
					"note":"attachment note",
					"tags":TEST_TAGS
				},
				{
					"itemType":"attachment",
					"url":"http://www.zotero.org/",
					"title":"Link to zotero.org",
					"note":"attachment 2 note",
					"tags":TEST_TAGS
				}
			];
			let childAttachments = myItems.slice();
			childAttachments.push({
				"itemType":"attachment",
				"path":snapshot,
				"url":"http://www.example.com/",
				"title":"Snapshot",
				"note":"attachment 3 note",
				"tags":TEST_TAGS
			});
			myItems.push({
				"itemType":"book",
				"title":"Container Item",
				"attachments":childAttachments
			});

			let newItems = itemsArrayToObject(yield saveItemsThroughTranslator("import", myItems));
			let containedAttachments = yield Zotero.Items.getAsync(newItems["Container Item"].getAttachments());
			assert.equal(containedAttachments.length, 3);

			for (let savedAttachments of [[newItems["Empty PDF"], newItems["Link to zotero.org"]],
				                          [containedAttachments[0], containedAttachments[1]]]) {
				assert.equal(savedAttachments[0].getField("title"), "Empty PDF");
				assert.equal(savedAttachments[0].getNote(), "attachment note");
				assert.equal(savedAttachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_FILE);
				checkTestTags(savedAttachments[0]);

				assert.equal(savedAttachments[1].getField("title"), "Link to zotero.org");
				assert.equal(savedAttachments[1].getField("url"), "http://www.zotero.org/");
				assert.equal(savedAttachments[1].getNote(), "attachment 2 note");
				assert.equal(savedAttachments[1].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
				checkTestTags(savedAttachments[1]);
			}

			assert.equal(containedAttachments[2].getField("title"), "Snapshot");
			assert.equal(containedAttachments[2].getField("url"), "http://www.example.com/");
			assert.equal(containedAttachments[2].getNote(), "attachment 3 note");
			assert.equal(containedAttachments[2].attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			checkTestTags(containedAttachments[2]);
		});

		it('import translators should save missing snapshots as links', function* () {
			let missingFile = getTestDataDirectory();
			missingFile.append("missing");
			assert.isFalse(missingFile.exists());
			missingFile = missingFile.path;
			let myItems = [
				{
					"itemType":"book",
					"title":"Container Item",
					"attachments":[
						{
							"itemType":"attachment",
							"path":missingFile,
							"url":"http://www.example.com/",
							"title":"Snapshot with missing file",
							"note":"attachment note",
							"tags":TEST_TAGS
						}
					]
				}
			];

			let newItems = yield saveItemsThroughTranslator("import", myItems);
			assert.equal(newItems.length, 1);
			assert.equal(newItems[0].getField("title"), "Container Item");
			let containedAttachments = yield Zotero.Items.getAsync(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);

			assert.equal(containedAttachments[0].getField("title"), "Snapshot with missing file");
			assert.equal(containedAttachments[0].getField("url"), "http://www.example.com/");
			assert.equal(containedAttachments[0].getNote(), "attachment note");
			assert.equal(containedAttachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
			checkTestTags(containedAttachments[0]);
		});

		it('import translators should ignore missing file attachments', function* () {
			let missingFile = getTestDataDirectory();
			missingFile.append("missing");
			assert.isFalse(missingFile.exists());
			missingFile = missingFile.path;
			let myItems = [
				{
					"itemType":"attachment",
					"path":missingFile,
					"title":"Missing file"
				},
				{
					"itemType":"book",
					"title":"Container Item",
					"attachments":[
						{
							"itemType":"attachment",
							"path":missingFile,
							"title":"Missing file"
						}
					]
				}
			];

			let newItems = yield saveItemsThroughTranslator("import", myItems);
			assert.equal(newItems.length, 1);
			assert.equal(newItems[0].getField("title"), "Container Item");
			assert.equal(newItems[0].getAttachments().length, 0);
		});
		
		it('import translators should save link attachments', async function () {
			// Start a local server so we can make sure a web request isn't made for the URL
			var port = 16213;
			var baseURL = `http://127.0.0.1:${port}/`;
			var httpd = new HttpServer();
			httpd.start(port);
			var callCount = 0;
			var handler = function (_request, response) {
				callCount++;
				response.setStatusLine(null, 200, "OK");
				response.write("<html><head><title>Title</title><body>Body</body></html>");
			};
			httpd.registerPathHandler("/1", { handle: handler });
			httpd.registerPathHandler("/2", { handle: handler });
			
			var items = [{
				itemType: "book",
				title: "Item",
				attachments: [
					// With mimeType
					{
						itemType: "attachment",
						linkMode: Zotero.Attachments.LINK_MODE_LINKED_URL,
						title: "Link 1",
						url: baseURL + "1",
						mimeType: 'text/html'
					},
					// Without mimeType
					{
						itemType: "attachment",
						linkMode: Zotero.Attachments.LINK_MODE_LINKED_URL,
						title: "Link 2",
						url: baseURL + "2"
					}
				]
			}];
			
			var newItems = itemsArrayToObject(await saveItemsThroughTranslator("import", items));
			
			assert.equal(callCount, 0);
			
			var attachments = await Zotero.Items.getAsync(newItems.Item.getAttachments());
			assert.equal(attachments.length, 2);
			
			assert.equal(attachments[0].getField("title"), "Link 1");
			assert.equal(attachments[0].getField("url"), baseURL + "1");
			assert.equal(attachments[0].attachmentContentType, "text/html");
			assert.equal(attachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
			
			assert.equal(attachments[1].getField("title"), "Link 2");
			assert.equal(attachments[1].getField("url"), baseURL + "2");
			assert.equal(attachments[1].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
			assert.equal(attachments[1].attachmentContentType, '');
			
			await new Promise(function (resolve) {
				httpd.stop(resolve);
			});
		});
		
		it("import translators should save linked-URL attachments with savingAttachments: false", async function () {
			var json = [
				{
					itemType: "journalArticle",
					title: "Parent Item",
					attachments: [
						// snapshot: false
						{
							title: "Link",
							mimeType: "text/html",
							url: "http://example.com",
							snapshot: false
						},
						// linkMode (used by RDF import)
						{
							title: "Link",
							mimeType: "text/html",
							url: "http://example.com",
							linkMode: Zotero.Attachments.LINK_MODE_LINKED_URL
						}
					]
				}
			];
			
			var newItems = itemsArrayToObject(
				await saveItemsThroughTranslator(
					"import",
					json,
					{
						saveAttachments: false
					}
				)
			);
			var attachmentIDs = newItems["Parent Item"].getAttachments();
			assert.lengthOf(attachmentIDs, 2);
			var attachments = await Zotero.Items.getAsync(attachmentIDs);
			assert.equal(attachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
			assert.equal(attachments[1].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
		});
		
		it("import translators should save linked-file attachments with linkFiles: true", async function () {
			var testDir = getTestDataDirectory().path;
			var file1 = OS.Path.join(testDir, 'test.pdf');
			var file2 = OS.Path.join(testDir, 'test.html');
			var file2URL = "http://example.com";
			var json = [
				{
					itemType: "journalArticle",
					title: "Parent Item",
					attachments: [
						{
							title: "PDF",
							mimeType: "application/pdf",
							path: file1
						},
						{
							title: "Snapshot",
							mimeType: "text/html",
							charset: "utf-8",
							url: file2URL,
							path: file2
						}
					]
				}
			];
			
			var newItems = itemsArrayToObject(
				await saveItemsThroughTranslator(
					"import",
					json,
					{
						linkFiles: true
					}
				)
			);
			var attachmentIDs = newItems["Parent Item"].getAttachments();
			assert.lengthOf(attachmentIDs, 2);
			var attachments = await Zotero.Items.getAsync(attachmentIDs);
			assert.equal(attachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_FILE);
			assert.equal(attachments[0].attachmentContentType, 'application/pdf');
			assert.equal(attachments[1].attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_FILE);
			assert.equal(attachments[1].attachmentContentType, 'text/html');
			assert.equal(attachments[1].attachmentCharset, 'utf-8');
			assert.equal(attachments[1].getNote(), file2URL);
		});
		
		it("import translators shouldn't save linked-file attachment with linkFiles: true if path is within current storage directory", async function () {
			var attachment = await importFileAttachment('test.png');
			var path = attachment.getFilePath();
			var json = [
				{
					itemType: "journalArticle",
					title: "Parent Item",
					attachments: [
						{
							title: "PDF",
							mimeType: "application/pdf",
							path
						}
					]
				}
			];
			
			var newItems = itemsArrayToObject(
				await saveItemsThroughTranslator(
					"import",
					json,
					{
						linkFiles: true
					}
				)
			);
			var attachmentIDs = newItems["Parent Item"].getAttachments();
			assert.lengthOf(attachmentIDs, 1);
			var attachments = await Zotero.Items.getAsync(attachmentIDs);
			assert.equal(attachments[0].attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_FILE);
			var newPath = attachments[0].getFilePath();
			assert.ok(newPath);
			assert.notEqual(newPath, path);
		});
		
		it('web translators should set accessDate to current date', function* () {
			let myItem = {
				"itemType":"webpage",
				"title":"Test Item",
				"url":"http://www.zotero.org/"
			};
			let newItems = yield saveItemsThroughTranslator("web", [myItem]);
			let currentDate = new Date();
			let delta = currentDate - Zotero.Date.sqlToDate(newItems[0].getField("accessDate"), true);
			assert.isAbove(delta, -500);
			assert.isBelow(delta, 5000);
		});
		
		it('web translators should set accessDate to current date for CURRENT_TIMESTAMP', function* () {
			let myItem = {
				itemType: "webpage",
				title: "Test Item",
				url: "https://www.zotero.org/",
				accessDate: 'CURRENT_TIMESTAMP'
			};
			let newItems = yield saveItemsThroughTranslator("web", [myItem]);
			let currentDate = new Date();
			let delta = currentDate - Zotero.Date.sqlToDate(newItems[0].getField("accessDate"), true);
			assert.isAbove(delta, -500);
			assert.isBelow(delta, 5000);
		});

		it('web translators should save attachments', function* () {
			let myItems = [
				{
					"itemType":"book",
					"title":"Container Item",
					"attachments":[
						{
							"url":"http://www.zotero.org/",
							"title":"Link to zotero.org",
							"note":"attachment note",
							"tags":TEST_TAGS,
							"snapshot":false
						},
						{
							"url":"http://127.0.0.1:23119/test/translate/test.html",
							"title":"Test Snapshot",
							"note":"attachment 2 note",
							"tags":TEST_TAGS
						},
						{
							"url":"http://127.0.0.1:23119/test/translate/test.pdf",
							"title":"Test PDF",
							"note":"attachment 3 note",
							"tags":TEST_TAGS
						}
					]
				}
			];

			let newItems = yield saveItemsThroughTranslator("web", myItems);
			assert.equal(newItems.length, 1);
			let containedAttachments = itemsArrayToObject(yield Zotero.Items.getAsync(newItems[0].getAttachments()));

			let link = containedAttachments["Link to zotero.org"];
			assert.equal(link.getField("url"), "http://www.zotero.org/");
			assert.equal(link.getNote(), "attachment note");
			assert.equal(link.attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_URL);
			checkTestTags(link, true);

			let snapshot = containedAttachments["Test Snapshot"];
			assert.equal(snapshot.getField("url"), "http://127.0.0.1:23119/test/translate/test.html");
			assert.equal(snapshot.getNote(), "attachment 2 note");
			assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(snapshot.attachmentContentType, "text/html");
			checkTestTags(snapshot, true);

			let pdf = containedAttachments["Test PDF"];
			assert.equal(pdf.getField("url"), "http://127.0.0.1:23119/test/translate/test.pdf");
			assert.equal(pdf.getNote(), "attachment 3 note");
			assert.equal(pdf.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(pdf.attachmentContentType, "application/pdf");
			checkTestTags(pdf, true);
		});

		it('web translators should save attachment from browser document', function* () {
			let deferred = Zotero.Promise.defer();
			let browser = Zotero.HTTP.loadDocuments(
				"http://127.0.0.1:23119/test/translate/test.html",
				doc => deferred.resolve(doc),
				undefined,
				undefined,
				true
			);
			let doc = yield deferred.promise;

			let translate = new Zotero.Translate.Web();
			translate.setDocument(doc);
			translate.setTranslator(buildDummyTranslator(4,
				'function detectWeb() {}\n'+
				'function doWeb(doc) {\n'+
				'	var item = new Zotero.Item("book");\n'+
				'	item.title = "Container Item";\n'+
				'	item.attachments = [{\n'+
				'		"document":doc,\n'+
				'		"title":"Snapshot from Document",\n'+
				'		"note":"attachment note",\n'+
				'		"tags":'+JSON.stringify(TEST_TAGS)+'\n'+
				'	}];\n'+
				'	item.complete();\n'+
				'}'));
			let newItems = yield translate.translate();
			assert.equal(newItems.length, 1);
			let containedAttachments = Zotero.Items.get(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);

			let snapshot = containedAttachments[0];
			assert.equal(snapshot.getField("url"), "http://127.0.0.1:23119/test/translate/test.html");
			assert.equal(snapshot.getNote(), "attachment note");
			assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(snapshot.attachmentContentType, "text/html");
			checkTestTags(snapshot, true);

			Zotero.Browser.deleteHiddenBrowser(browser);
		});
		
		it('web translators should save attachment from non-browser document', function* () {
			return Zotero.HTTP.processDocuments(
				"http://127.0.0.1:23119/test/translate/test.html",
				async function (doc) {
					let translate = new Zotero.Translate.Web();
					translate.setDocument(doc);
					translate.setTranslator(buildDummyTranslator(4,
						'function detectWeb() {}\n'+
						'function doWeb(doc) {\n'+
						'	var item = new Zotero.Item("book");\n'+
						'	item.title = "Container Item";\n'+
						'	item.attachments = [{\n'+
						'		"document":doc,\n'+
						'		"title":"Snapshot from Document",\n'+
						'		"note":"attachment note",\n'+
						'		"tags":'+JSON.stringify(TEST_TAGS)+'\n'+
						'	}];\n'+
						'	item.complete();\n'+
						'}'));
					let newItems = await translate.translate();
					assert.equal(newItems.length, 1);
					let containedAttachments = Zotero.Items.get(newItems[0].getAttachments());
					assert.equal(containedAttachments.length, 1);
		
					let snapshot = containedAttachments[0];
					assert.equal(snapshot.getField("url"), "http://127.0.0.1:23119/test/translate/test.html");
					assert.equal(snapshot.getNote(), "attachment note");
					assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
					assert.equal(snapshot.attachmentContentType, "text/html");
					checkTestTags(snapshot, true);
				}
			);
		});

		it('web translators should ignore attachments that return error codes', function* () {
			this.timeout(60000);
			let myItems = [
				{
					"itemType":"book",
					"title":"Container Item",
					"attachments":[
						{
							"url":"http://127.0.0.1:23119/test/translate/does_not_exist.html",
							"title":"Non-Existent HTML"
						},
						{
							"url":"http://127.0.0.1:23119/test/translate/does_not_exist.pdf",
							"title":"Non-Existent PDF"
						}
					]
				}
			];

			let newItems = yield saveItemsThroughTranslator("web", myItems);
			assert.equal(newItems.length, 1);
			let containedAttachments = yield Zotero.Items.getAsync(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 0);
		});

		it('web translators should save PDFs only if the content type matches', function* () {
			this.timeout(60000);
			let myItems = [
				{
					"itemType":"book",
					"title":"Container Item",
					"attachments":[
						{
							"url":"http://127.0.0.1:23119/test/translate/test.html",
							"mimeType":"application/pdf",
							"title":"Test PDF with wrong mime type"
						},
						{
							"url":"http://127.0.0.1:23119/test/translate/test.pdf",
							"mimeType":"application/pdf",
							"title":"Test PDF",
							"note":"attachment note",
							"tags":TEST_TAGS
						}
					]
				}
			];

			let newItems = yield saveItemsThroughTranslator("web", myItems);
			assert.equal(newItems.length, 1);
			let containedAttachments = yield Zotero.Items.getAsync(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);

			let pdf = containedAttachments[0];
			assert.equal(pdf.getField("title"), "Test PDF");
			assert.equal(pdf.getField("url"), "http://127.0.0.1:23119/test/translate/test.pdf");
			assert.equal(pdf.getNote(), "attachment note");
			assert.equal(pdf.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			checkTestTags(pdf, true);
		});
		
		it('should not convert tags to canonical form in child translators', function* () {
			var childTranslator = buildDummyTranslator(1, 
				`function detectWeb() {}
				function doImport() {
					var item = new Zotero.Item;
					item.itemType = "book";
					item.title = "The Definitive Guide of Owls";
					item.tags = ['owl', 'tag'];
					item.complete();
				}`, {translatorID: 'child-dummy-translator'}
			);
			sinon.stub(Zotero.Translators, 'get').withArgs('child-dummy-translator').returns(childTranslator);
			
			var parentTranslator = buildDummyTranslator(1,
				`function detectWeb() {}
				function doImport() {
					var translator = Zotero.loadTranslator("import");
					translator.setTranslator('child-dummy-translator');
					translator.setHandler('itemDone', Zotero.childItemDone);
					translator.translate();
				}`
			);
			
			function childItemDone(obj, item) {
				// Non-canonical tags after child translator is done
				assert.deepEqual(['owl', 'tag'], item.tags);
				item.complete();
			}
			
			var translate = new Zotero.Translate.Import();
			translate.setTranslator(parentTranslator);
			translate.setString("");
			yield translate._loadTranslator(parentTranslator);
			translate._sandboxManager.importObject({childItemDone});
			
			var items = yield translate.translate();
			
			// Canonicalized tags after parent translator
			assert.deepEqual([{tag: 'owl'}, {tag: 'tag'}], items[0].getTags());
			
			Zotero.Translators.get.restore();
		});
	});
	
	
	describe("#processDocuments()", function () {
		var url = "http://127.0.0.1:23119/test/translate/test.html";
		var doc;
		
		beforeEach(function* () {
			// This is the main processDocuments, not the translation sandbox one being tested
			doc = (yield Zotero.HTTP.processDocuments(url, doc => doc))[0];
		});
		
		it("should provide document object", async function () {
			var translate = new Zotero.Translate.Web();
			translate.setDocument(doc);
			translate.setTranslator(
				buildDummyTranslator(
					4,
					`function detectWeb() {}
					function doWeb(doc) {
						ZU.processDocuments(
							doc.location.href + '?t',
							function (doc) {
								var item = new Zotero.Item("book");
								item.title = "Container Item";
								// document.location
								item.url = doc.location.href;
								// document.evaluate()
								item.extra = doc
									.evaluate('//p', doc, null, XPathResult.ANY_TYPE, null)
									.iterateNext()
									.textContent;
								item.attachments = [{
									document: doc,
									title: "Snapshot from Document",
									note: "attachment note",
									tags: ${JSON.stringify(TEST_TAGS)}
								}];
								item.complete();
							}
						);
					}`
				)
			);
			var newItems = await translate.translate();
			assert.equal(newItems.length, 1);
			
			var item = newItems[0];
			assert.equal(item.getField('url'), url + '?t');
			assert.include(item.getField('extra'), 'your research sources');
			
			var containedAttachments = Zotero.Items.get(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);
			
			var snapshot = containedAttachments[0];
			assert.equal(snapshot.getField("url"), url + '?t');
			assert.equal(snapshot.getNote(), "attachment note");
			assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(snapshot.attachmentContentType, "text/html");
			checkTestTags(snapshot, true);
		});
		
		it("should use loaded document instead of reloading if possible", function* () {
			var translate = new Zotero.Translate.Web();
			translate.setDocument(doc);
			translate.setTranslator(
				buildDummyTranslator(
					4,
					`function detectWeb() {}
					function doWeb(doc) {
						ZU.processDocuments(
							doc.location.href,
							function (doc) {
								var item = new Zotero.Item("book");
								item.title = "Container Item";
								// document.location
								item.url = doc.location.href;
								// document.evaluate()
								item.extra = doc
									.evaluate('//p', doc, null, XPathResult.ANY_TYPE, null)
									.iterateNext()
									.textContent;
								item.attachments = [{
									document: doc,
									title: "Snapshot from Document",
									note: "attachment note",
									tags: ${JSON.stringify(TEST_TAGS)}
								}];
								item.complete();
							}
						);
					}`
				)
			);
			var newItems = yield translate.translate();
			assert.equal(newItems.length, 1);
			
			var item = newItems[0];
			assert.equal(item.getField('url'), url);
			assert.include(item.getField('extra'), 'your research sources');
			
			var containedAttachments = Zotero.Items.get(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);
			
			var snapshot = containedAttachments[0];
			assert.equal(snapshot.getField("url"), url);
			assert.equal(snapshot.getNote(), "attachment note");
			assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(snapshot.attachmentContentType, "text/html");
			checkTestTags(snapshot, true);
		});
	});
	
	
	describe("#setTranslatorProvider()", function () {
		var url = "http://127.0.0.1:23119/test/translate/test.html";
		var doc;
		
		beforeEach(function* () {
			// This is the main processDocuments, not the translation sandbox one being tested
			doc = (yield Zotero.HTTP.processDocuments(url, doc => doc))[0];
		});
		
		it("should set a custom version of Zotero.Translators", async function () {
			// Create a dummy translator to be returned by the stub methods
			var info = {
				translatorID: "e6111720-1f6c-42b0-a487-99b9fa50b8a1",
				label: "Test",
				creator: "Creator",
				target: "^http:\/\/127.0.0.1:23119\/test",
				minVersion: "5.0",
				maxVersion: "",
				priority: 100,
				translatorType: 4,
				browserSupport: "gcsibv",
				lastUpdated: "2019-07-10 05:50:39",
				cacheCode: true
			};
			info.code = JSON.stringify(info, null, '\t') + "\n\n"
				+ "function detectWeb(doc, url) {"
				+ "return 'journalArticle';"
				+ "}\n"
				+ "function doWeb(doc, url) {"
				+ "var item = new Zotero.Item('journalArticle');"
				+ "item.title = 'Test';"
				+ "item.complete();"
				+ "}\n";
			var translator = new Zotero.Translator(info);
			
			var translate = new Zotero.Translate.Web();
			var provider = Zotero.Translators.makeTranslatorProvider({
				get: function (translatorID) {
					if (translatorID == info.translatorID) {
						return translator;
					}
					return false;
				},
				
				getAllForType: async function (type) {
					var translators = [];
					if (type == 'web') {
						translators.push(translator);
					}
					return translators;
				}
			});
			translate.setTranslatorProvider(provider);
			translate.setDocument(doc);
			var translators = await translate.getTranslators();
			translate.setTranslator(translators[0]);
			var newItems = await translate.translate();
			assert.equal(newItems.length, 1);
			
			var item = newItems[0];
			assert.equal(item.getField('title'), 'Test');
		});
		
		it("should set a custom version of Zotero.Translators in a child translator", async function () {
			// Create dummy translators to be returned by the stub methods
			var info1 = {
				translatorID: "e6111720-1f6c-42b0-a487-99b9fa50b8a1",
				label: "Test",
				creator: "Creator",
				target: "^http:\/\/127.0.0.1:23119\/test",
				minVersion: "5.0",
				maxVersion: "",
				priority: 100,
				translatorType: 4,
				browserSupport: "gcsibv",
				lastUpdated: "2019-07-10 05:50:39",
				cacheCode: true
			};
			info1.code = JSON.stringify(info1, null, '\t') + "\n\n"
				+ "function detectWeb(doc, url) {"
					+ "return 'journalArticle';"
				+ "}\n"
				+ "function doWeb(doc, url) {"
					+ "var translator = Zotero.loadTranslator('import');"
					+ "translator.setTranslator('86e58f50-4e2d-4ee8-8a20-bafa225381fa');"
					+ "translator.setString('foo\\n');"
					+ "translator.setHandler('itemDone', function(obj, item) {"
						+ "item.complete();"
					+ "});"
					+ "translator.translate();"
				+ "}\n";
			var translator1 = new Zotero.Translator(info1);
			
			var info2 = {
				translatorID: "86e58f50-4e2d-4ee8-8a20-bafa225381fa",
				label: "Child Test",
				creator: "Creator",
				target: "",
				minVersion: "5.0",
				maxVersion: "",
				priority: 100,
				translatorType: 3,
				browserSupport: "gcsibv",
				lastUpdated: "2019-07-19 06:22:21",
				cacheCode: true
			};
			info2.code = JSON.stringify(info2, null, '\t') + "\n\n"
				+ "function detectImport() {"
					+ "return true;"
				+ "}\n"
				+ "function doImport() {"
					+ "var item = new Zotero.Item('journalArticle');"
					+ "item.title = 'Test';"
					+ "item.complete();"
				+ "}\n";
			var translator2 = new Zotero.Translator(info2);
			
			var translate = new Zotero.Translate.Web();
			var provider = Zotero.Translators.makeTranslatorProvider({
				get: function (translatorID) {
					switch (translatorID) {
						case info1.translatorID:
							return translator1;
						
						case info2.translatorID:
							return translator2;
					}
					return false;
				},
				
				getAllForType: async function (type) {
					var translators = [];
					if (type == 'web') {
						translators.push(translator1);
					}
					if (type == 'import') {
						translators.push(translator2);
					}
					return translators;
				}
			});
			translate.setTranslatorProvider(provider);
			translate.setDocument(doc);
			var translators = await translate.getTranslators();
			translate.setTranslator(translators[0]);
			var newItems = await translate.translate();
			assert.equal(newItems.length, 1);
			
			var item = newItems[0];
			assert.equal(item.getField('title'), 'Test');
		});
	});
	
	
	describe("Translators", function () {
		it("should round-trip child attachment via BibTeX", function* () {
			var item = yield createDataObject('item');
			yield importFileAttachment('test.png', { parentItemID: item.id });
			
			var translation = new Zotero.Translate.Export();
			var tmpDir = yield getTempDirectory();
			var exportDir = OS.Path.join(tmpDir, 'export');
			translation.setLocation(Zotero.File.pathToFile(exportDir));
			translation.setItems([item]);
			translation.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
			translation.setDisplayOptions({
				exportFileData: true
			});
			yield translation.translate();
			
			var exportFile = OS.Path.join(exportDir, 'export.bib');
			assert.isTrue(yield OS.File.exists(exportFile));
			
			var translation = new Zotero.Translate.Import();
			translation.setLocation(Zotero.File.pathToFile(exportFile));
			var translators = yield translation.getTranslators();
			translation.setTranslator(translators[0]);
			var importCollection = yield createDataObject('collection');
			var items = yield translation.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: [importCollection.id]
			});
			
			assert.lengthOf(items, 1);
			var attachments = items[0].getAttachments();
			assert.lengthOf(attachments, 1);
			var attachment = Zotero.Items.get(attachments[0]);
			assert.isTrue(yield attachment.fileExists());
		});
	});
	
	
	describe("ItemSaver", function () {
		describe("#saveCollections()", function () {
			it("should add top-level collections to specified collection", function* () {
				var collection = yield createDataObject('collection');
				var collections = [
					{
						name: "Collection",
						type: "collection",
						children: []
					}
				];
				var items = [
					{
						itemType: "book",
						title: "Test"
					}
				];
				
				var translation = new Zotero.Translate.Import();
				translation.setString("");
				translation.setTranslator(buildDummyTranslator(
					"import",
					"function detectImport() {}\n"
					+ "function doImport() {\n"
					+ "	var json = JSON.parse('" + JSON.stringify(collections).replace(/['\\]/g, "\\$&") + "');\n"
					+ "	for (let o of json) {"
					+ "		var collection = new Zotero.Collection;\n"
					+ "		for (let field in o) { collection[field] = o[field]; }\n"
					+ "		collection.complete();\n"
					+ "	}\n"
					+ "	json = JSON.parse('" + JSON.stringify(items).replace(/['\\]/g, "\\$&") + "');\n"
					+ "	for (let o of json) {"
					+ "		var item = new Zotero.Item;\n"
					+ "		for (let field in o) { item[field] = o[field]; }\n"
					+ "		item.complete();\n"
					+ "	}\n"
					+ "}"
				));
				yield translation.translate({
					collections: [collection.id]
				});
				assert.lengthOf(translation.newCollections, 1);
				assert.isNumber(translation.newCollections[0].id);
				assert.lengthOf(translation.newItems, 1);
				assert.isNumber(translation.newItems[0].id);
				var childCollections = Array.from(collection.getChildCollections(true));
				assert.sameMembers(childCollections, translation.newCollections.map(c => c.id));
			});
		});
		
		describe("#_saveAttachment()", function () {
			it("should save standalone attachment to collection", function* () {
				var collection = yield createDataObject('collection');
				var items = [
					{
						itemType: "attachment",
						title: "Test",
						mimeType: "text/html",
						url: "http://example.com"
					}
				];
				
				var translation = new Zotero.Translate.Import();
				translation.setString("");
				translation.setTranslator(buildDummyTranslator(
					"import",
					"function detectImport() {}\n"
					+ "function doImport() {\n"
					+ "	var json = JSON.parse('" + JSON.stringify(items).replace(/['\\]/g, "\\$&") + "');\n"
					+ "	for (var i=0; i<json.length; i++) {"
					+ "		var item = new Zotero.Item;\n"
					+ "		for (var field in json[i]) { item[field] = json[i][field]; }\n"
					+ "		item.complete();\n"
					+ "	}\n"
					+ "}"
				));
				yield translation.translate({
					collections: [collection.id]
				});
				assert.lengthOf(translation.newItems, 1);
				assert.isNumber(translation.newItems[0].id);
				assert.ok(collection.hasItem(translation.newItems[0].id));
			});

		});
		describe('#saveItems', function() {
			it("should deproxify item and attachment urls when proxy provided", function* (){
				var itemID;
				var item = loadSampleData('journalArticle');
				item = item.journalArticle;
				item.url = 'https://www-example-com.proxy.example.com/';
				item.attachments = [{
					url: 'https://www-example-com.proxy.example.com/pdf.pdf',
					mimeType: 'application/pdf',
					title: 'Example PDF'}];
				var itemSaver = new Zotero.Translate.ItemSaver({
					libraryID: Zotero.Libraries.userLibraryID,
					attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE,
					proxy: new Zotero.Proxy({scheme: 'https://%h.proxy.example.com/%p', dotsToHyphens: true})
				});
				var itemDeferred = Zotero.Promise.defer();
				var attachmentDeferred = Zotero.Promise.defer();
				itemSaver.saveItems([item], Zotero.Promise.coroutine(function* (attachment, progressPercentage) {
					// ItemSaver returns immediately without waiting for attachments, so we use the callback
					// to test attachments
					if (progressPercentage != 100) return;
					try {
						yield itemDeferred.promise;
						let item = Zotero.Items.get(itemID);
						attachment = Zotero.Items.get(item.getAttachments()[0]);
						assert.equal(attachment.getField('url'), 'https://www.example.com/pdf.pdf');
						attachmentDeferred.resolve();
					} catch (e) {
						attachmentDeferred.reject(e);
					}
				})).then(function(items) {
					try {
						assert.equal(items[0].getField('url'), 'https://www.example.com/');
						itemID = items[0].id;
						itemDeferred.resolve();
					} catch (e) {
						itemDeferred.reject(e);
					}
				});
				yield Zotero.Promise.all([itemDeferred.promise, attachmentDeferred.promise]);
			});
		});
	});
	
	
	describe("Error Handling", function () {
		it("should propagate saveItems() errors from synchronous doImport()", function* () {
			var items = [
				{
					// Invalid object
				},
				{
					itemType: "book",
					title: "B"
				}
			];
			
			var added = 0;
			var notifierID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids, extraData) {
					added++;
				}
			}, ['item']);
			
			var translation = new Zotero.Translate.Import();
			translation.setString("");
			translation.setTranslator(buildDummyTranslator(
				"import",
				"function detectImport() {}"
				+ "function doImport() {"
				+ "	var json = JSON.parse('" + JSON.stringify(items).replace(/['\\]/g, "\\$&") + "');"
				+ "	for (let o of json) {"
				+ "		let item = new Zotero.Item;"
				+ "		for (let field in o) { item[field] = o[field]; }"
				+ "		item.complete();"
				+ "	}"
				+ "}"
			));
			var e = yield getPromiseError(translation.translate());
			Zotero.Notifier.unregisterObserver(notifierID);
			assert.ok(e);
			
			// Saving should be stopped without any saved items
			assert.equal(added, 0);
			assert.equal(translation._savingItems, 0);
			assert.equal(translation._runningAsyncProcesses, 0);
			assert.isNull(translation._currentState);
		});
		
		it("should propagate saveItems() errors from asynchronous doImport()", function* () {
			var items = [
				{
					// Invalid object
				},
				{
					itemType: "book",
					title: "B"
				}
			];
			
			var added = 0;
			var notifierID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids, extraData) {
					added++;
				}
			}, ['item']);
			
			var translation = new Zotero.Translate.Import();
			translation.setString("");
			translation.setTranslator(buildDummyTranslator(
				"import",
				"function detectImport() {}"
					+ "function doImport() {"
					+ "	var json = JSON.parse('" + JSON.stringify(items).replace(/['\\]/g, "\\$&") + "');"
					+ "	return new Promise(function (resolve, reject) {"
					+ "		function next() {"
					+ "			var data = json.shift();"
					+ "			if (!data) {"
					+ "				resolve();"
					+ "				return;"
					+ "			}"
					+ "			var item = new Zotero.Item;"
					+ "			for (let field in data) { item[field] = data[field]; }"
					+ "			item.complete().then(next).catch(reject);"
					+ "		}"
					+ "		next();"
					+ "	});"
					+ "}",
				{
					configOptions: {
						async: true
					}
				}
			));
			var e = yield getPromiseError(translation.translate());
			Zotero.Notifier.unregisterObserver(notifierID);
			assert.ok(e);
			
			// Saving should be stopped without any saved items
			assert.equal(added, 0);
			assert.equal(translation._savingItems, 0);
			assert.equal(translation._runningAsyncProcesses, 0);
			assert.isNull(translation._currentState);
		});
		
		it("should propagate errors from saveItems with synchronous doSearch()", function* () {
			var stub = sinon.stub(Zotero.Translate.ItemSaver.prototype, "saveItems");
			stub.returns(Zotero.Promise.reject(new Error("Save error")));
			
			var translation = new Zotero.Translate.Search();
			translation.setTranslator(buildDummyTranslator(
				"search",
				"function detectSearch() {}"
					+ "function doSearch() {"
					+ "	var item = new Zotero.Item('journalArticle');"
					+ "	item.itemType = 'book';"
					+ "	item.title = 'A';"
					+ "	item.complete();"
					+ "}"
			));
			translation.setSearch({ itemType: "journalArticle", DOI: "10.111/Test"});
			var e = yield getPromiseError(translation.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				saveAttachments: false
			}));
			assert.ok(e);
			
			stub.restore();
		});
		
		it("should propagate errors from saveItems() with asynchronous doSearch()", function* () {
			var stub = sinon.stub(Zotero.Translate.ItemSaver.prototype, "saveItems");
			stub.returns(Zotero.Promise.reject(new Error("Save error")));
			
			var translation = new Zotero.Translate.Search();
			translation.setTranslator(buildDummyTranslator(
				"search",
				"function detectSearch() {}"
					+ "function doSearch() {"
					+ "	var item = new Zotero.Item('journalArticle');"
					+ "	item.itemType = 'book';"
					+ "	item.title = 'A';"
					+ "	return new Promise(function (resolve, reject) {"
					+ "		item.complete().then(next).catch(reject);"
					+ "	});"
					+ "}",
				{
					configOptions: {
						async: true
					}
				}
			));
			translation.setSearch({ itemType: "journalArticle", DOI: "10.111/Test"});
			var e = yield getPromiseError(translation.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				saveAttachments: false
			}));
			assert.ok(e);
			
			stub.restore();
		});
	});
});

describe("Zotero.Translate.ItemGetter", function() {
	describe("nextItem", function() {
		it('should return false for an empty database', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			assert.isFalse(getter.nextItem());
		}));
		it('should return items in order they are supplied', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let items, itemIDs, itemURIs;

			yield Zotero.DB.executeTransaction(function* () {
				items = [
					yield new Zotero.Item('journalArticle'),
					yield new Zotero.Item('book')
				];
				
				itemIDs = [ yield items[0].save(), yield items[1].save() ];
				itemURIs = items.map(i => Zotero.URI.getItemURI(i));
			});
			
			getter._itemsLeft = items;
			
			assert.equal((getter.nextItem()).uri, itemURIs[0], 'first item comes out first');
			assert.equal((getter.nextItem()).uri, itemURIs[1], 'second item comes out second');
			assert.isFalse((getter.nextItem()), 'end of item queue');
		}));
		it('should return items with tags in expected format', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let itemWithAutomaticTag, itemWithManualTag, itemWithMultipleTags
			
			yield Zotero.DB.executeTransaction(function* () {
				itemWithAutomaticTag = new Zotero.Item('journalArticle');
				itemWithAutomaticTag.addTag('automatic tag', 0);
				yield itemWithAutomaticTag.save();
				
				itemWithManualTag = new Zotero.Item('journalArticle');
				itemWithManualTag.addTag('manual tag', 1);
				yield itemWithManualTag.save();
				
				itemWithMultipleTags = new Zotero.Item('journalArticle');
				itemWithMultipleTags.addTag('tag1', 0);
				itemWithMultipleTags.addTag('tag2', 1);
				yield itemWithMultipleTags.save();
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				getter._itemsLeft = [itemWithAutomaticTag, itemWithManualTag, itemWithMultipleTags];
				getter.legacy = legacyMode[i];
				let suffix = legacyMode[i] ? ' in legacy mode' : '';
				
				// itemWithAutomaticTag
				let translatorItem = getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains automatic tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'automatic tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'automatic tag', 'automatic tag name provided as "tag" property' + suffix);
				if (legacyMode[i]) {
					assert.equal(translatorItem.tags[0].type, 0, 'automatic tag "type" is 0' + suffix);
				} else {
					assert.isUndefined(translatorItem.tags[0].type, '"type" is undefined for automatic tag' + suffix);
				}
				
				// itemWithManualTag
				translatorItem = getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains manual tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'manual tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'manual tag', 'manual tag name provided as "tag" property' + suffix);
				assert.equal(translatorItem.tags[0].type, 1, 'manual tag "type" is 1' + suffix);
				
				// itemWithMultipleTags
				translatorItem = getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains multiple tags in an array' + suffix);
				assert.lengthOf(translatorItem.tags, 2, 'expected number of tags returned' + suffix);
			}
		}));
		it('should return item collections in expected format', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let items, collections;
			
			yield Zotero.DB.executeTransaction(function* () {
				items = getter._itemsLeft = [
					new Zotero.Item('journalArticle'), // Not in collection
					new Zotero.Item('journalArticle'), // In a single collection
					new Zotero.Item('journalArticle'), //In two collections
					new Zotero.Item('journalArticle') // In a nested collection
				];
				yield Zotero.Promise.all(items.map(item => item.save()));
				
				collections = [
					new Zotero.Collection,
					new Zotero.Collection,
					new Zotero.Collection,
					new Zotero.Collection
				];
				collections[0].name = "test1";
				collections[1].name = "test2";
				collections[2].name = "subTest1";
				collections[3].name = "subTest2";
				yield collections[0].save();
				yield collections[1].save();
				collections[2].parentID = collections[0].id;
				collections[3].parentID = collections[1].id;
				yield collections[2].save();
				yield collections[3].save();
				
				yield collections[0].addItems([items[1].id, items[2].id]);
				yield collections[1].addItem(items[2].id);
				yield collections[2].addItem(items[3].id);
			});
			
			let translatorItem = getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in library root has a collections array');
			assert.equal(translatorItem.collections.length, 0, 'item in library root does not list any collections');
			
			translatorItem = getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a single collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[0].key, 'item in a single collection identifies correct collection');
			
			translatorItem = getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in two collections has a collections array');
			assert.equal(translatorItem.collections.length, 2, 'item in two collections lists two collections');
			assert.deepEqual(
				translatorItem.collections.sort(),
				[collections[0].key, collections[1].key].sort(),
				'item in two collections identifies correct collections'
			);
			
			translatorItem = getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a nested collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single nested collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[2].key, 'item in a single collection identifies correct collection');
		}));
		
		it('should return item relations in expected format', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let items;
			
			yield Zotero.DB.executeTransaction(function* () {
					items = [
						new Zotero.Item('journalArticle'), // Item with no relations
						
						new Zotero.Item('journalArticle'), // Bidirectional relations
						new Zotero.Item('journalArticle'), // between these items
						
						new Zotero.Item('journalArticle'), // This item is related to two items below
						new Zotero.Item('journalArticle'), // But this item is not related to the item below
						new Zotero.Item('journalArticle')
					];
					yield Zotero.Promise.all(items.map(item => item.save()));
					
					yield items[1].addRelatedItem(items[2]);
					yield items[2].addRelatedItem(items[1]);
					
					yield items[3].addRelatedItem(items[4]);
					yield items[4].addRelatedItem(items[3]);
					yield items[3].addRelatedItem(items[5]);
					yield items[5].addRelatedItem(items[3]);
			});
			
			getter._itemsLeft = items.slice();
			
			let translatorItem = getter.nextItem();
			assert.isObject(translatorItem.relations, 'item with no relations has a relations object');
			assert.equal(Object.keys(translatorItem.relations).length, 0, 'item with no relations does not list any relations');
			
			translatorItem = getter.nextItem();
			
			assert.isObject(translatorItem.relations, 'item that is the subject of a single relation has a relations object');
			assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of a single relation lists one relations predicate');
			assert.lengthOf(translatorItem.relations['dc:relation'], 1, 'item that is the subject of a single relation lists one "dc:relation" object');
			assert.equal(translatorItem.relations['dc:relation'][0], Zotero.URI.getItemURI(items[2]), 'item that is the subject of a single relation identifies correct object URI');
			
			// We currently assign these bidirectionally above, so this is a bit redundant
			translatorItem = getter.nextItem();
			assert.isObject(translatorItem.relations, 'item that is the object of a single relation has a relations object');
			assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of a single relation list one relations predicate');
			assert.lengthOf(translatorItem.relations['dc:relation'], 1, 'item that is the object of a single relation lists one "dc:relation" object');
			assert.equal(translatorItem.relations['dc:relation'][0], Zotero.URI.getItemURI(items[1]), 'item that is the object of a single relation identifies correct subject URI');
			
			translatorItem = getter.nextItem();
			assert.isObject(translatorItem.relations, 'item that is the subject of two relations has a relations object');
			assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of two relations list one relations predicate');
			assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the subject of two relations uses "dc:relation" as the predicate');
			assert.isArray(translatorItem.relations['dc:relation'], 'item that is the subject of two relations lists "dc:relation" object as an array');
			assert.equal(translatorItem.relations['dc:relation'].length, 2, 'item that is the subject of two relations lists two relations in the "dc:relation" array');
			assert.deepEqual(
				translatorItem.relations['dc:relation'].sort(),
				[Zotero.URI.getItemURI(items[4]), Zotero.URI.getItemURI(items[5])].sort(),
				'item that is the subject of two relations identifies correct object URIs'
			);
			
			translatorItem = getter.nextItem();
			assert.isObject(translatorItem.relations, 'item that is the object of one relation from item with two relations has a relations object');
			assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of one relation from item with two relations list one relations predicate');
			assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the object of one relation from item with two relations uses "dc:relation" as the predicate');
			assert.lengthOf(translatorItem.relations['dc:relation'], 1, 'item that is the object of one relation from item with two relations lists one "dc:relation" object');
			assert.equal(translatorItem.relations['dc:relation'][0], Zotero.URI.getItemURI(items[3]), 'item that is the object of one relation from item with two relations identifies correct subject URI');
		}));
		
		it('should return standalone note in expected format', Zotero.Promise.coroutine(function* () {
			let relatedItem, note, collection;
			
			yield Zotero.DB.executeTransaction(function* () {
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();

				note = new Zotero.Item('note');
				note.setNote('Note');
				note.addTag('automaticTag', 0);
				note.addTag('manualTag', 1);
				note.addRelatedItem(relatedItem);
				yield note.save();
				
				relatedItem.addRelatedItem(note);
				yield relatedItem.save();
				
				collection = new Zotero.Collection;
				collection.name = 'test';
				yield collection.save();
				yield collection.addItem(note.id);
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [note];
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				let translatorNote = getter.nextItem();
				assert.isDefined(translatorNote, 'returns standalone note' + suffix);
				assert.equal(translatorNote.itemType, 'note', 'itemType is correct' + suffix);
				assert.equal(translatorNote.note, 'Note', 'note is correct' + suffix);
				
				assert.isString(translatorNote.dateAdded, 'dateAdded is string' + suffix);
				assert.isString(translatorNote.dateModified, 'dateModified is string' + suffix);
				
				if (legacy) {
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
					
					assert.isNumber(translatorNote.itemID, 'itemID is set' + suffix);
					assert.isString(translatorNote.key, 'key is set' + suffix);
				} else {
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
				}
				
				// Tags
				assert.isArray(translatorNote.tags, 'contains tags as array' + suffix);
				assert.equal(translatorNote.tags.length, 2, 'contains correct number of tags' + suffix);
				let possibleTags = [
					{ tag: 'automaticTag', type: 0 },
					{ tag: 'manualTag', type: 1 }
				];
				for (let i=0; i<possibleTags.length; i++) {
					let match = false;
					for (let j=0; j<translatorNote.tags.length; j++) {
						if (possibleTags[i].tag == translatorNote.tags[j].tag) {
							let type = possibleTags[i].type;
							if (!legacy && type == 0) type = undefined;
							
							assert.equal(translatorNote.tags[j].type, type, possibleTags[i].tag + ' tag is correct' + suffix);
							match = true;
							break;
						}
					}
					assert.isTrue(match, 'has ' + possibleTags[i].tag + ' tag ' + suffix);
				}
				
				// Relations
				assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				assert.lengthOf(translatorNote.relations['dc:relation'], 1, 'has one relation' + suffix);
				assert.equal(translatorNote.relations['dc:relation'][0], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				
				if (!legacy) {
					// Collections
					assert.isArray(translatorNote.collections, 'has a collections array' + suffix);
					assert.equal(translatorNote.collections.length, 1, 'lists one collection' + suffix);
					assert.equal(translatorNote.collections[0], collection.key, 'identifies correct collection' + suffix);
				}
			}
		}));
		it('should return attached note in expected format', Zotero.Promise.coroutine(function* () {
			let relatedItem, items, collection, note;
			yield Zotero.DB.executeTransaction(function* () {
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();
				
				items = [
					new Zotero.Item('journalArticle'),
					new Zotero.Item('journalArticle')
				];
				yield Zotero.Promise.all(items.map(item => item.save()));
				
				collection = new Zotero.Collection;
				collection.name = 'test';
				yield collection.save();
				yield collection.addItem(items[0].id);
				yield collection.addItem(items[1].id);
				
				note = new Zotero.Item('note');
				note.setNote('Note');
				note.addTag('automaticTag', 0);
				note.addTag('manualTag', 1);
				yield note.save();
				
				note.addRelatedItem(relatedItem);
				relatedItem.addRelatedItem(note);
				yield note.save();
				yield relatedItem.save();
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let item = items[i];
				
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				let translatorItem = getter.nextItem();
				assert.isArray(translatorItem.notes, 'item with no notes contains notes array' + suffix);
				assert.equal(translatorItem.notes.length, 0, 'item with no notes contains empty notes array' + suffix);
				
				note.parentID = item.id;
				yield note.saveTx();
				
				getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				getter.legacy = legacy;
				
				translatorItem = getter.nextItem();
				assert.isArray(translatorItem.notes, 'item with no notes contains notes array' + suffix);
				assert.equal(translatorItem.notes.length, 1, 'item with one note contains array with one note' + suffix);
				
				let translatorNote = translatorItem.notes[0];
				assert.equal(translatorNote.itemType, 'note', 'itemType is correct' + suffix);
				assert.equal(translatorNote.note, 'Note', 'note is correct' + suffix);
				
				assert.isString(translatorNote.dateAdded, 'dateAdded is string' + suffix);
				assert.isString(translatorNote.dateModified, 'dateModified is string' + suffix);
				
				if (legacy) {
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
					
					assert.isNumber(translatorNote.itemID, 'itemID is set' + suffix);
					assert.isString(translatorNote.key, 'key is set' + suffix);
				} else {
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
				}
				
				// Tags
				assert.isArray(translatorNote.tags, 'contains tags as array' + suffix);
				assert.equal(translatorNote.tags.length, 2, 'contains correct number of tags' + suffix);
				let possibleTags = [
					{ tag: 'automaticTag', type: 0 },
					{ tag: 'manualTag', type: 1 }
				];
				for (let i=0; i<possibleTags.length; i++) {
					let match = false;
					for (let j=0; j<translatorNote.tags.length; j++) {
						if (possibleTags[i].tag == translatorNote.tags[j].tag) {
							let type = possibleTags[i].type;
							if (!legacy && type == 0) type = undefined;
							
							assert.equal(translatorNote.tags[j].type, type, possibleTags[i].tag + ' tag is correct' + suffix);
							match = true;
							break;
						}
					}
					assert.isTrue(match, 'has ' + possibleTags[i].tag + ' tag ' + suffix);
				}
				
				// Relations
				assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				assert.lengthOf(translatorNote.relations['dc:relation'], 1, 'has one relation' + suffix);
				assert.equal(translatorNote.relations['dc:relation'][0], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				
				if (!legacy) {
					// Collections
					assert.isUndefined(translatorNote.collections, 'has no collections array' + suffix);
				}
			}
		}));
		
		it('should return stored/linked file and URI attachments in expected format', Zotero.Promise.coroutine(function* () {
			this.timeout(60000);
			let file = getTestPDF();
			let item, relatedItem;
			
			yield Zotero.DB.executeTransaction(function* () {
				item = new Zotero.Item('journalArticle');
				yield item.save();
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();
			});

			// Attachment items
			let attachments = [
				yield Zotero.Attachments.importFromFile({"file":file}), // Standalone stored file
				yield Zotero.Attachments.linkFromFile({"file":file}), // Standalone link to file
				yield Zotero.Attachments.importFromFile({"file":file, "parentItemID":item.id}), // Attached stored file
				yield Zotero.Attachments.linkFromFile({"file":file, "parentItemID":item.id}), // Attached link to file
				yield Zotero.Attachments.linkFromURL({"url":'http://example.com', "parentItemID":item.id, "contentType":'application/pdf', "title":'empty.pdf'}) // Attached link to URL
			];
			
			yield Zotero.DB.executeTransaction(function* () {
				// Make sure all fields are populated
				for (let i=0; i<attachments.length; i++) {
					let attachment = attachments[i];
					attachment.setField('accessDate', '2001-02-03 12:13:14');
					attachment.attachmentCharset = 'utf-8';
					attachment.setField('url', 'http://example.com');
					attachment.setNote('note');
				
					attachment.addTag('automaticTag', 0);
					attachment.addTag('manualTag', 1);
					
					attachment.addRelatedItem(relatedItem);
					
					yield attachment.save();
					
					relatedItem.addRelatedItem(attachment);
				}
				
				yield relatedItem.save();
			});
			
			let items = [ attachments[0], attachments[1], item ]; // Standalone attachments and item with child attachments
			
			// Run tests
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = items.slice();
				
				let exportDir = yield getTempDirectory();
				getter._exportFileDirectory = Zotero.File.pathToFile(exportDir);
				
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				// Gather all standalone and child attachments into a single array,
				// since tests are mostly the same
				let translatorAttachments = [], translatorItem;
				let itemsLeft = items.length, attachmentsLeft = attachments.length;
				while (translatorItem = getter.nextItem()) {
					assert.isString(translatorItem.itemType, 'itemType is set' + suffix);
					
					// Standalone attachments
					if (translatorItem.itemType == 'attachment') {
						translatorAttachments.push({
							child: false,
							attachment: translatorItem
						});
						attachmentsLeft--;
					
					// Child attachments
					} else if (translatorItem.itemType == 'journalArticle') {
						assert.isArray(translatorItem.attachments, 'item contains attachment array' + suffix);
						assert.equal(translatorItem.attachments.length, 3, 'attachment array contains all items' + suffix);
						
						for (let i=0; i<translatorItem.attachments.length; i++) {
							let attachment = translatorItem.attachments[i];
							assert.equal(attachment.itemType, 'attachment', 'item attachment is of itemType "attachment"' + suffix);
							
							translatorAttachments.push({
								child: true,
								attachment: attachment
							});
							
							attachmentsLeft--;
						}
					
					// Unexpected
					} else {
						assert.fail(translatorItem.itemType, 'attachment or journalArticle', 'expected itemType returned');
					}
					
					itemsLeft--;
				}
				
				assert.equal(itemsLeft, 0, 'all items returned by getter');
				assert.equal(attachmentsLeft, 0, 'all attachments returned by getter');
				
				// Since we make no guarantees on the order of child attachments,
				// we have to rely on URI as the identifier
				let uriMap = {};
				for (let i=0; i<attachments.length; i++) {
					uriMap[Zotero.URI.getItemURI(attachments[i])] = attachments[i];
				}
				
				for (let j=0; j<translatorAttachments.length; j++) {
					let childAttachment = translatorAttachments[j].child;
					let attachment = translatorAttachments[j].attachment;
					assert.isString(attachment.uri, 'uri is set' + suffix);
					
					let zoteroItem = uriMap[attachment.uri];
					assert.isDefined(zoteroItem, 'uri is correct' + suffix);
					delete uriMap[attachment.uri];
					
					let storedFile = zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE
						|| zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL;
					let linkToURL = zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL;
					
					let prefix = (childAttachment ? 'attached ' : '')
						+ (storedFile ? 'stored ' : 'link to ')
						+ (linkToURL ? 'URL ' : 'file ');
					
					// Set fields
					assert.equal(attachment.itemType, 'attachment', prefix + 'itemType is correct' + suffix);
					assert.equal(attachment.title, 'empty.pdf', prefix + 'title is correct' + suffix);
					assert.equal(attachment.url, 'http://example.com', prefix + 'url is correct' + suffix);
					assert.equal(attachment.note, 'note', prefix + 'note is correct' + suffix);
					
					// Automatically set fields
					assert.isString(attachment.dateAdded, prefix + 'dateAdded is set' + suffix);
					assert.isString(attachment.dateModified, prefix + 'dateModified is set' + suffix);
					
					// Legacy mode fields
					if (legacy) {
						assert.isNumber(attachment.itemID, prefix + 'itemID is set' + suffix);
						assert.isString(attachment.key, prefix + 'key is set' + suffix);
						assert.equal(attachment.mimeType, 'application/pdf', prefix + 'mimeType is correct' + suffix);
						
						assert.equal(attachment.accessDate, '2001-02-03 12:13:14', prefix + 'accessDate is correct' + suffix);
						
						assert.isTrue(sqlDateTimeRe.test(attachment.dateAdded), prefix + 'dateAdded matches SQL format' + suffix);
						assert.isTrue(sqlDateTimeRe.test(attachment.dateModified), prefix + 'dateModified matches SQL format' + suffix);
					} else {
						assert.equal(attachment.contentType, 'application/pdf', prefix + 'contentType is correct' + suffix);
						
						assert.equal(attachment.accessDate, '2001-02-03T12:13:14Z', prefix + 'accessDate is correct' + suffix);
						
						assert.isTrue(isoDateTimeRe.test(attachment.dateAdded), prefix + 'dateAdded matches ISO-8601 format' + suffix);
						assert.isTrue(isoDateTimeRe.test(attachment.dateModified), prefix + 'dateModified matches ISO-8601 format' + suffix);
					}
					
					if (!linkToURL) {
						// localPath
						assert.isString(attachment.localPath, prefix + 'localPath is set' + suffix);
						let attachmentFile = Zotero.File.pathToFile(attachment.localPath);
						assert.isTrue(attachmentFile.exists(), prefix + 'localPath points to a file' + suffix);
						assert.isTrue(attachmentFile.equals(attachments[j].getFile()), prefix + 'localPath points to the correct file' + suffix);
						
						assert.equal(attachment.filename, 'empty.pdf', prefix + 'filename is correct' + suffix);
						assert.equal(attachment.defaultPath, 'files/' + attachments[j].id + '/' + attachment.filename, prefix + 'defaultPath is correct' + suffix);
						
						// saveFile function
						assert.isFunction(attachment.saveFile, prefix + 'has saveFile function' + suffix);
						attachment.saveFile(attachment.defaultPath);
						assert.equal(attachment.path, OS.Path.join(exportDir, OS.Path.normalize(attachment.defaultPath)), prefix + 'path is set correctly after saveFile call' + suffix);
						
						let fileExists = yield OS.File.exists(attachment.path);
						assert.isTrue(fileExists, prefix + 'file was copied to the correct path by saveFile function' + suffix);
						fileExists = yield OS.File.exists(attachment.localPath);
						assert.isTrue(fileExists, prefix + 'file was not removed from original location' + suffix);
						
						assert.throws(attachment.saveFile.bind(attachment, attachment.defaultPath), /^ERROR_FILE_EXISTS /, prefix + 'saveFile does not overwrite existing file by default' + suffix);
						assert.throws(attachment.saveFile.bind(attachment, 'file/../../'), /./, prefix + 'saveFile does not allow exporting outside export directory' + suffix);
						/** TODO: check if overwriting existing file works **/
					}
					
					// Tags
					assert.isArray(attachment.tags, prefix + 'contains tags as array' + suffix);
					assert.equal(attachment.tags.length, 2, prefix + 'contains correct number of tags' + suffix);
					let possibleTags = [
						{ tag: 'automaticTag', type: 0 },
						{ tag: 'manualTag', type: 1 }
					];
					for (let i=0; i<possibleTags.length; i++) {
						let match = false;
						for (let j=0; j<attachment.tags.length; j++) {
							if (possibleTags[i].tag == attachment.tags[j].tag) {
								let type = possibleTags[i].type;
								if (!legacy && type == 0) type = undefined;
								
								assert.equal(attachment.tags[j].type, type, prefix + possibleTags[i].tag + ' tag is correct' + suffix);
								match = true;
								break;
							}
						}
						assert.isTrue(match, prefix + ' has ' + possibleTags[i].tag + ' tag ' + suffix);
					}
					
					// Relations
					assert.isObject(attachment.relations, prefix + 'has relations as object' + suffix);
					assert.lengthOf(attachment.relations['dc:relation'], 1, prefix + 'has one relation' + suffix);
					assert.equal(attachment.relations['dc:relation'][0], Zotero.URI.getItemURI(relatedItem), prefix + 'relation is correct' + suffix);
					/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				}
			}
		}));
	});
	
	describe("#setCollection()", function () {
		it("should add collection items", function* () {
			var col = yield createDataObject('collection');
			var item1 = yield createDataObject('item', { collections: [col.id] });
			var item2 = yield createDataObject('item', { collections: [col.id] });
			var item3 = yield createDataObject('item');
			
			let getter = new Zotero.Translate.ItemGetter();
			getter.setCollection(col);
			
			assert.equal(getter.numItems, 2);
		});
	});
	
	describe("#_attachmentToArray()", function () {
		it("should handle missing attachment files", function* () {
			var item = yield importFileAttachment('test.png');
			var path = item.getFilePath();
			// Delete attachment file
			yield OS.File.remove(path);
			
			var translation = new Zotero.Translate.Export();
			var tmpDir = yield getTempDirectory();
			var exportDir = OS.Path.join(tmpDir, 'export');
			translation.setLocation(Zotero.File.pathToFile(exportDir));
			translation.setItems([item]);
			translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9'); // Zotero RDF
			translation.setDisplayOptions({
				exportFileData: true
			});
			yield translation.translate();
			
			var exportFile = OS.Path.join(exportDir, 'export.rdf');
			assert.isAbove((yield OS.File.stat(exportFile)).size, 0);
		});
		
		it("should handle empty attachment path", function* () {
			var item = yield importFileAttachment('test.png');
			item._attachmentPath = '';
			assert.equal(item.attachmentPath, '');
			
			var translation = new Zotero.Translate.Export();
			var tmpDir = yield getTempDirectory();
			var exportDir = OS.Path.join(tmpDir, 'export');
			translation.setLocation(Zotero.File.pathToFile(exportDir));
			translation.setItems([item]);
			translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9'); // Zotero RDF
			translation.setDisplayOptions({
				exportFileData: true
			});
			yield translation.translate();
			
			var exportFile = OS.Path.join(exportDir, 'export.rdf');
			assert.isAbove((yield OS.File.stat(exportFile)).size, 0);
		});
		
		it("should handle UNC paths", async function () {
			var path = '\\\\SHARE\\test.png';
			var attachment = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.png')
			});
			attachment._attachmentPath = path;
			assert.equal(attachment.attachmentPath, path);
			
			var translation = new Zotero.Translate.Export();
			var tmpDir = await getTempDirectory();
			var exportDir = OS.Path.join(tmpDir, 'export');
			translation.setLocation(Zotero.File.pathToFile(exportDir));
			translation.setItems([attachment]);
			translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9'); // Zotero RDF
			translation.setDisplayOptions({
				exportFileData: true
			});
			await translation.translate();
			
			var exportFile = OS.Path.join(exportDir, 'export.rdf');
			assert.isAbove((await OS.File.stat(exportFile)).size, 0);
			var rdf = Zotero.File.getContents(exportFile);
			var dp = new DOMParser();
			var doc = dp.parseFromString(rdf, 'text/xml');
			assert.equal(doc.querySelector('resource').getAttribute('rdf:resource'), path);
		});
	});
});
}