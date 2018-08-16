"use strict";

describe("Zotero.Intl", function() {
	describe("#getString()", function () {
		it("should return the right plural form", function* () {
			if (Zotero.locale != 'en-US') {
				this.skip();
			}
			var str1 = Zotero.getString('fileInterface.itemsWereImported')
				.split(/;/)[1]
				.replace('%1$S', 2);
			var str2 = Zotero.getString('fileInterface.itemsWereImported', 2, 2);
			assert.equal(str1, str2);
		});
	});

	describe("#localeCompare", function () {
		it("shouldn't ignore whitespace", function () {
			assert.equal(Zotero.localeCompare("Chang", "Chan H"), 1);
		});
		 
		it("shouldn't ignore leading punctuation", function () {
			assert.equal(Zotero.localeCompare("_Abcd", "Abcd"), -1);
		});
	});
});
