"use strict";

describe("Zotero.Styles", function() {
	var styleID = "http://www.zotero.org/styles/cell";
	var stylePath = OS.Path.join(getTestDataDirectory().path, 'cell.csl');
	var styleFile = Zotero.File.pathToFile(stylePath);
	var style;
	
	before(function* () {
		yield Zotero.Styles.init();
		style = yield Zotero.File.getContentsAsync(stylePath);
	});
	
	describe("Zotero.Styles.install", function() {
		afterEach(`${styleID} style should be installed`, function* (){
			assert.isOk(Zotero.Styles.get(styleID));
			yield Zotero.Styles.get(styleID).remove();
		});
		
		it("should install the style from string", function* () {
			yield Zotero.Styles.install(style, styleID, true);
		});
		
		it("should install the style from nsIFile", function* () {
			yield Zotero.Styles.install(styleFile, styleID, true);
		});

		it("should install the style from url", function* () {
			var getContentsFromURLAsync = Zotero.File.getContentsFromURLAsync;
			sinon.stub(Zotero.File, 'getContentsFromURLAsync').callsFake(function(url) {
				if (url === styleID) {
					return Zotero.Promise.resolve(style);
				} else {
					return getContentsFromURLAsync.apply(Zotero.File, arguments);
				}
			});
			yield Zotero.Styles.install({url: styleID}, styleID, true);
			Zotero.File.getContentsFromURLAsync.restore();
		});
		
		it("should install the style from file path", function* () {
			yield Zotero.Styles.install({file: stylePath}, styleID, true);
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
			assert.equal(o.text, '1. Foo bar: baz qux. 2019.\n');
		});
		
		it("shouldn't capitalize subtitles in Vancouver", async function () {
			var o = Zotero.QuickCopy.getContentFromItems(
				[item],
				'bibliography=http://www.zotero.org/styles/vancouver'
			);
			assert.equal(o.text, '1. Foo bar: baz qux. 2019; \n');
		});
	});
});
