"use strict";

describe("Zotero.Sync.Storage.Request", function () {
	describe("#run()", function () {
		it("should run a request and wait for it to complete", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var count = 0;
			var item = await importFileAttachment('test.png');
			var request = new Zotero.Sync.Storage.Request({
				type: 'download',
				libraryID,
				name: `${item.libraryID}/${item.key}`,
				onStart: async function () {
					await Zotero.Promise.delay(25);
					count++;
					return new Zotero.Sync.Storage.Result;
				}
			});
			var results = await request.start();
			assert.equal(count, 1);
		})
	})
})
