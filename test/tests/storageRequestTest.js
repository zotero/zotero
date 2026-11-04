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
		
		it("should wait for a running download of the same file instead of starting another", async function () {
			var item = await importFileAttachment('test.png');
			var count = 0;
			var makeRequest = () => new Zotero.Sync.Storage.Request({
				type: 'download',
				libraryID: item.libraryID,
				name: item.libraryKey,
				onStart: async function () {
					count++;
					await Zotero.Promise.delay(25);
					return new Zotero.Sync.Storage.Result({ localChanges: true });
				}
			});
			var results = await Promise.all([makeRequest().start(), makeRequest().start()]);
			
			assert.equal(count, 1);
			assert.isTrue(results[0].localChanges);
			assert.isTrue(results[1].localChanges);
		});
		
		it("should start its own download if a running download of the same file fails", async function () {
			var item = await importFileAttachment('test.png');
			var count = 0;
			var makeRequest = () => new Zotero.Sync.Storage.Request({
				type: 'download',
				libraryID: item.libraryID,
				name: item.libraryKey,
				onStart: async function () {
					await Zotero.Promise.delay(25);
					if (++count == 1) {
						throw new Error("Download failed");
					}
					return new Zotero.Sync.Storage.Result({ localChanges: true });
				}
			});
			var promises = [makeRequest().start(), makeRequest().start()];
			
			var e = await getPromiseError(promises[0]);
			assert.equal(e.message, "Download failed");
			assert.isTrue((await promises[1]).localChanges);
			assert.equal(count, 2);
		});
	})
})
