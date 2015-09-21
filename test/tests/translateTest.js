new function() {
Components.utils.import("resource://gre/modules/osfile.jsm");

/**
 * Build a dummy translator that can be passed to Zotero.Translate
 */
function buildDummyTranslator(translatorType, code) {
	let info = {
		"translatorID":"dummy-translator",
		"translatorType":1, // import
		"label":"Dummy Translator",
		"creator":"Simon Kornblith",
		"target":"",
		"priority":100,
		"browserSupport":"g",
		"inRepository":false,
		"lastUpdated":"0000-00-00 00:00:00",
	};
	let translator = new Zotero.Translator(info);
	translator.code = code;
	return translator;
}

/**
 * Create a new translator that saves the specified items
 * @param {String} translatorType - "import" or "web"
 * @param {Object} items - items as translator JSON
 */
function saveItemsThroughTranslator(translatorType, items) {
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
	translate.setTranslator(buildDummyTranslator(translatorType == "web" ? 4 : 1,
		"function detectWeb() {}\n"+
		"function do"+tyname+"() {\n"+
		"	var json = JSON.parse('"+JSON.stringify(items).replace(/['\\]/g, "\\$&")+"');\n"+
		"	for (var i=0; i<json.length; i++) {"+
		"		var item = new Zotero.Item;\n"+
		"		for (var field in json[i]) { item[field] = json[i][field]; }\n"+
		"		item.complete();\n"+
		"	}\n"+
		"}"));
	return translate.translate().then(function(items) {
		if (browser) Zotero.Browser.deleteHiddenBrowser(browser);
		return items;
	});
}

/**
 * Convert an array of items to an object in which they are indexed by
 * their display titles
 */
var itemsArrayToObject = Zotero.Promise.coroutine(function* itemsArrayToObject(items) {
	var obj = {};
	for (let item of items) {
		obj[yield item.loadDisplayTitle(true)] = item;
	}
	return obj;
});

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
				let savedItem = yield newItems[i].toJSON();
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

			let newItems = yield itemsArrayToObject(yield saveItemsThroughTranslator("import", myItems));
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
			newItems = yield itemsArrayToObject(newItems);
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

			let newItems = yield itemsArrayToObject(yield saveItemsThroughTranslator("import", myItems));
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
			let containedAttachments = yield itemsArrayToObject(yield Zotero.Items.getAsync(newItems[0].getAttachments()));

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

		it('web translators should save attachment from document', function* () {
			let deferred = Zotero.Promise.defer();
			let browser = Zotero.HTTP.processDocuments("http://127.0.0.1:23119/test/translate/test.html",
				                                       function (doc) { deferred.resolve(doc) }, undefined,
				                                       undefined, true);
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
			let containedAttachments = yield Zotero.Items.getAsync(newItems[0].getAttachments());
			assert.equal(containedAttachments.length, 1);

			let snapshot = containedAttachments[0];
			assert.equal(snapshot.getField("url"), "http://127.0.0.1:23119/test/translate/test.html");
			assert.equal(snapshot.getNote(), "attachment note");
			assert.equal(snapshot.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_URL);
			assert.equal(snapshot.attachmentContentType, "text/html");
			checkTestTags(snapshot, true);

			Zotero.Browser.deleteHiddenBrowser(browser);
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
	});
});

describe("Zotero.Translate.ItemGetter", function() {
	describe("nextItem", function() {
		it('should return false for an empty database', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			assert.isFalse(yield getter.nextItem());
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
			
			assert.equal((yield getter.nextItem()).uri, itemURIs[0], 'first item comes out first');
			assert.equal((yield getter.nextItem()).uri, itemURIs[1], 'second item comes out second');
			assert.isFalse((yield getter.nextItem()), 'end of item queue');
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
				let translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains automatic tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'automatic tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'automatic tag', 'automatic tag name provided as "tag" property' + suffix);
				if (legacyMode[i]) {
					assert.equal(translatorItem.tags[0].type, 0, 'automatic tag "type" is 0' + suffix);
				} else {
					assert.isUndefined(translatorItem.tags[0].type, '"type" is undefined for automatic tag' + suffix);
				}
				
				// itemWithManualTag
				translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains manual tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'manual tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'manual tag', 'manual tag name provided as "tag" property' + suffix);
				assert.equal(translatorItem.tags[0].type, 1, 'manual tag "type" is 1' + suffix);
				
				// itemWithMultipleTags
				translatorItem = yield getter.nextItem();
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
			
			let translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in library root has a collections array');
			assert.equal(translatorItem.collections.length, 0, 'item in library root does not list any collections');
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a single collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[0].key, 'item in a single collection identifies correct collection');
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in two collections has a collections array');
			assert.equal(translatorItem.collections.length, 2, 'item in two collections lists two collections');
			assert.deepEqual(
				translatorItem.collections.sort(),
				[collections[0].key, collections[1].key].sort(),
				'item in two collections identifies correct collections'
			);
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a nested collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single nested collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[2].key, 'item in a single collection identifies correct collection');
		}));
		// it('should return item relations in expected format', Zotero.Promise.coroutine(function* () {
		// 	let getter = new Zotero.Translate.ItemGetter();
		// 	let items;
			
		// 	yield Zotero.DB.executeTransaction(function* () {
		// 		items = [
		// 			new Zotero.Item('journalArticle'), // Item with no relations
					
		// 			new Zotero.Item('journalArticle'), // Relation set on this item
		// 			new Zotero.Item('journalArticle'), // To this item
					
		// 			new Zotero.Item('journalArticle'), // This item is related to two items below
		// 			new Zotero.Item('journalArticle'), // But this item is not related to the item below
		// 			new Zotero.Item('journalArticle')
		// 		];
		// 		yield Zotero.Promise.all(items.map(item => item.save()));
				
		// 		yield items[1].addRelatedItem(items[2].id);
				
		// 		yield items[3].addRelatedItem(items[4].id);
		// 		yield items[3].addRelatedItem(items[5].id);
		// 	});
			
		// 	getter._itemsLeft = items.slice();
			
		// 	let translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item with no relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 0, 'item with no relations does not list any relations');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the subject of a single relation has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of a single relation list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the subject of a single relation uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the subject of a single relation lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[2]), 'item that is the subject of a single relation identifies correct object URI');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the object of a single relation has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of a single relation list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the object of a single relation uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the object of a single relation lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[1]), 'item that is the object of a single relation identifies correct subject URI');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the subject of two relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of two relations list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the subject of two relations uses "dc:relation" as the predicate');
		// 	assert.isArray(translatorItem.relations['dc:relation'], 'item that is the subject of two relations lists "dc:relation" object as an array');
		// 	assert.equal(translatorItem.relations['dc:relation'].length, 2, 'item that is the subject of two relations lists two relations in the "dc:relation" array');
		// 	assert.deepEqual(translatorItem.relations['dc:relation'].sort(),
		// 		[Zotero.URI.getItemURI(items[4]), Zotero.URI.getItemURI(items[5])].sort(),
		// 		'item that is the subject of two relations identifies correct object URIs'
		// 	);
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the object of one relation from item with two relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of one relation from item with two relations list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the object of one relation from item with two relations uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the object of one relation from item with two relations lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[3]), 'item that is the object of one relation from item with two relations identifies correct subject URI');
		// }));
		it('should return standalone note in expected format', Zotero.Promise.coroutine(function* () {
			let relatedItem, note, collection;
			
			yield Zotero.DB.executeTransaction(function* () {
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();

				note = new Zotero.Item('note');
				note.setNote('Note');
				note.addTag('automaticTag', 0);
				note.addTag('manualTag', 1);
				// note.addRelatedItem(relatedItem.id);
				yield note.save();
				
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
				
				let translatorNote = yield getter.nextItem();
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
				// assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				// assert.equal(translatorNote.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				
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
				
				// note.addRelatedItem(relatedItem.id);
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let item = items[i];
				
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				let translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.notes, 'item with no notes contains notes array' + suffix);
				assert.equal(translatorItem.notes.length, 0, 'item with no notes contains empty notes array' + suffix);
				
				note.parentID = item.id;
				yield note.saveTx();
				
				getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				getter.legacy = legacy;
				
				translatorItem = yield getter.nextItem();
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
				// assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				// assert.equal(translatorNote.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				
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
				
					// attachment.addRelatedItem(relatedItem.id);
				
					yield attachment.save();
				}
			});
			
			let items = [ attachments[0], attachments[1], item ]; // Standalone attachments and item with child attachments
			
			// Run tests
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = items.slice();
				
				let exportDir = yield getTempDirectory();
				getter._exportFileDirectory = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
				getter._exportFileDirectory.initWithPath(exportDir);
				
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				// Gather all standalone and child attachments into a single array,
				// since tests are mostly the same
				let translatorAttachments = [], translatorItem;
				let itemsLeft = items.length, attachmentsLeft = attachments.length;
				while (translatorItem = yield getter.nextItem()) {
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
						let attachmentFile = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
						attachmentFile.initWithPath(attachment.localPath);
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
					// assert.isObject(attachment.relations, prefix + 'has relations as object' + suffix);
					// assert.equal(attachment.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), prefix + 'relation is correct' + suffix);
					/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				}
			}
		}));
	});
});
}