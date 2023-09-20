"use strict";

const { HiddenBrowser } = ChromeUtils.import("chrome://zotero/content/HiddenBrowser.jsm");
const { RemoteTranslate } = ChromeUtils.import("chrome://zotero/content/RemoteTranslate.jsm");

describe("RemoteTranslate", function () {
	let dummyTranslator;
	let translatorProvider;
	before(function () {
		dummyTranslator = buildDummyTranslator('web', `
			function detectWeb() {
				Zotero.debug("test string");
				return "book";
			}
			
			function doWeb() {
				let item = new Zotero.Item("book");
				item.title = "Title";
				item.complete();
			}
		`);
		
		translatorProvider = Zotero.Translators.makeTranslatorProvider({
			get(translatorID) {
				if (translatorID == dummyTranslator.translatorID) {
					return dummyTranslator;
				}
				return false;
			},

			async getAllForType(type) {
				var translators = [];
				if (type == 'web') {
					translators.push(dummyTranslator);
				}
				return translators;
			}
		});
	});
	
	describe("#setHandler()", function () {
		it("should receive handler calls from the translator", async function () {
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			await translate.setTranslator(dummyTranslator);
			
			let debug = sinon.spy();
			translate.setHandler('debug', debug);
			await translate.detect();
			sinon.assert.calledWith(debug, translate, 'test string');
			
			HiddenBrowser.destroy(browser);
			translate.dispose();
		});
	});

	describe("#setTranslatorProvider()", function () {
		it("should cause the passed provider to be queried instead of Zotero.Translators", async function () {
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslatorProvider(translatorProvider);
			
			let detectedTranslators = await translate.detect();
			assert.deepEqual(detectedTranslators.map(t => t.translatorID), [dummyTranslator.translatorID]);

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});
	});

	describe("#translate()", function () {
		it("should return items without saving when libraryID is false", async function () {
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslatorProvider(translatorProvider);
			
			let detectedTranslators = await translate.detect();
			assert.equal(detectedTranslators[0].translatorID, dummyTranslator.translatorID);
			
			let itemDone = sinon.spy();
			translate.setHandler('itemDone', itemDone);
			
			let items = await translate.translate({ libraryID: false });
			sinon.assert.notCalled(itemDone); // No items should be saved
			assert.equal(items[0].title, 'Title');

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});

		it("should save items and call itemDone when libraryID is not false", async function () {
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslator(dummyTranslator);

			let itemDone = sinon.spy();
			translate.setHandler('itemDone', itemDone);

			let items = await translate.translate({ libraryID: null }); // User library
			sinon.assert.calledWith(itemDone, translate,
				sinon.match({
					libraryID: Zotero.Libraries.userLibraryID
				}),
				sinon.match({
					title: 'Title'
				}));
			// Item should still be returned
			assert.equal(items[0].getField('title'), 'Title');

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});

		it("should call itemDone before done", async function () {
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslator(dummyTranslator);

			let itemDone = sinon.spy();
			translate.setHandler('itemDone', itemDone);
			let done = sinon.spy();
			translate.setHandler('done', done);

			await translate.translate({ libraryID: null }); // User library
			sinon.assert.calledOnce(itemDone);
			sinon.assert.calledOnce(done);
			assert.isTrue(itemDone.calledBefore(done));

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});
		
		it("should support DOMParser", async function () {
			let domParserDummy = buildDummyTranslator('web', `
				function detectWeb() {
					return "book";
				}
				
				function doWeb() {
					let item = new Zotero.Item("book");
					item.title = new DOMParser().parseFromString("<body>content</body>", "text/html").body.textContent;
					item.complete();
				}
			`);

			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslator(domParserDummy);

			let items = await translate.translate({ libraryID: false });
			assert.equal(items[0].title, 'content');

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});
		
		it("should be able to access hidden prefs", async function () {
			let domParserDummy = buildDummyTranslator('web', `
				function detectWeb() {
					return "book";
				}
				
				function doWeb() {
					let item = new Zotero.Item("book");
					item.title = Zotero.getHiddenPref("testPref");
					item.complete();
				}
			`);

			Zotero.Prefs.set('translators.testPref', 'Test value');
			
			let translate = new RemoteTranslate();
			let browser = await HiddenBrowser.create(getTestDataUrl('test.html'));
			await translate.setBrowser(browser);
			translate.setTranslator(domParserDummy);

			let items = await translate.translate({ libraryID: false });
			assert.equal(items[0].title, 'Test value');

			HiddenBrowser.destroy(browser);
			translate.dispose();
		});
	});
});
