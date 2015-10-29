"use strict";

describe("Zotero.Utilities.Internal", function () {
	describe("#md5Async()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		})
	})
})
