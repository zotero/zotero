"use strict";

describe("Zotero.Styles", function () {
	var styleID = "http://www.zotero.org/styles/cell";
	var stylePath = OS.Path.join(getTestDataDirectory().path, 'cell.csl');
	var styleFile = Zotero.File.pathToFile(stylePath);
	var style;
	
	before(function* () {
		yield Zotero.Styles.init();
		style = yield Zotero.File.getContentsAsync(stylePath);
	});
	
	describe("Zotero.Styles.install", function () {
		afterEach(`${styleID} style should be installed`, function* (){
			assert.isOk(Zotero.Styles.get(styleID));
			yield Zotero.Styles.get(styleID).remove();
		});
		
		it("should install the style from string", async function () {
			await Zotero.Styles.install(style, styleID, true);
		});
		
		it("should install the style from nsIFile", async function () {
			await Zotero.Styles.install(styleFile, styleID, true);
		});

		it("should install the style from url", async function () {
			var getContentsFromURLAsync = Zotero.File.getContentsFromURLAsync;
			sinon.stub(Zotero.File, 'getContentsFromURLAsync').callsFake(function (url) {
				if (url === styleID) {
					return Promise.resolve(style);
				} else {
					return getContentsFromURLAsync.apply(Zotero.File, arguments);
				}
			});
			await Zotero.Styles.install({url: styleID}, styleID, true);
			Zotero.File.getContentsFromURLAsync.restore();
		});
		
		it("should install the style from file path", async function () {
			await Zotero.Styles.install({file: stylePath}, styleID, true);
		})
	});
	
	describe("subtitle capitalization", function () {
		var item;
		
		before(async function () {
			item = createUnsavedDataObject(
				'item',
				{
					itemType: 'journalArticle',
					title: 'Foo bar: baz qux'
				}
			);
			item.setField('shortTitle', 'Foo bar');
			item.setField('date', '2019');
			await item.saveTx();
		});
		
		it("should capitalize subtitles in APA", async function () {
			var o = Zotero.QuickCopy.getContentFromItems(
				[item],
				'bibliography=http://www.zotero.org/styles/apa'
			);
			assert.equal(o.text, 'Foo bar: Baz qux. (2019).\n');
		});
		
		it("shouldn't capitalize subtitles in AMA", async function () {
			var o = Zotero.QuickCopy.getContentFromItems(
				[item],
				'bibliography=http://www.zotero.org/styles/american-medical-association'
			);
			assert.equal(o.text, '1. Foo bar: baz qux. Published online 2019.\n');
		});
		
		it("shouldn't capitalize subtitles in Vancouver", async function () {
			var o = Zotero.QuickCopy.getContentFromItems(
				[item],
				'bibliography=http://www.zotero.org/styles/vancouver'
			);
			assert.equal(o.text, '1. Foo bar: baz qux. 2019; \n');
		});
	});
	
	describe("event-title replacement", function () {
		var item;
		var eventStyleXML = `<?xml version="1.0" encoding="utf-8"?>
		<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
		  <info>
			<title>Test</title>
			<id>http://www.zotero.org/styles/test</id>
			<link href="http://www.zotero.org/styles/test" rel="self"/>
			<updated>2022-04-14T13:48:43+00:00</updated>
		  </info>
		  <bibliography>
			<layout>
			  <text variable="event"/>
			  <text value=" - "/>
			  <text variable="event foo"/>
			  <text value=" - "/>
			  <text variable="event-place"/>
			</layout>
		  </bibliography>
		</style>
		`;
		
		before(async function () {
			item = createUnsavedDataObject(
				'item',
				{
					itemType: 'conferencePaper',
					title: 'Conference Paper'
				}
			);
			item.setField('conferenceName', 'Conference');
			item.setField('place', 'Place');
			await item.saveTx();
		});
		
		it("should substitute `event-title` in style using `event`", function () {
			var style = new Zotero.Style(eventStyleXML);
			var cslEngine = style.getCiteProc('en-US', 'text');
			var text = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [item], "text");
			cslEngine.free();
			assert.equal(text, 'Conference - Conference - Place\n');
		});
	});

	describe("Cached CSL.Engine instances", function () {
		if (Zotero.Prefs.get('cite.useCiteprocRs')) {
			this.skip();
		}
		
		it("should correctly handle disambiguation", async function () {
			let style = Zotero.Styles.get('http://www.zotero.org/styles/apa');
			
			let testItem1 = await createDataObject('item');
			testItem1.setField('title', `title1`);
			testItem1.setCreator(0, { creatorType: 'author', firstName: "Foo", lastName: "Bar" });
			testItem1.setField('date', '2022-01-01');
			let testItem2 = await createDataObject('item');
			testItem2.setField('title', `title2`);
			testItem2.setCreator(0, { creatorType: 'author', firstName: "Foo", lastName: "Bar" });
			testItem2.setField('date', '2022-01-01');

			function getCitation() {
				let cslEngine = style.getCiteProc('en-US', 'text');
				cslEngine.updateItems([testItem1.id, testItem2.id]);
				var citation = {
					citationItems: [{ id: testItem1.id }, { id: testItem2.id }],
					properties: {}
				};
				return cslEngine.previewCitationCluster(citation, [], [], 'text');
			}

			assert.equal(getCitation(), '(Bar, 2022a, 2022b)');

			testItem2.setCreator(0, { creatorType: 'author', firstName: "Foo F", lastName: "Bar" });
			assert.equal(getCitation(), '(F. Bar, 2022; F. F. Bar, 2022)');

			testItem2.setCreator(0, { creatorType: 'author', firstName: "Foo", lastName: "Bar" });
			assert.equal(getCitation(), '(Bar, 2022a, 2022b)');
		});
	});
});
