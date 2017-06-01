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
			sinon.stub(Zotero.File, 'getContentsFromURLAsync').callsFake(function(style) {
				if (style.url == styleID) {
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
});
