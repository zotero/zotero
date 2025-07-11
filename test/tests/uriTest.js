describe("Zotero.URI", function () {
	describe("#getURIItemLibraryKeyFromDB()", function () {
		it("should handle user library", async function () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/5/items/${key}`;
			var obj = await Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle user library with local user key", async function () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/local/aaaaaaaa/items/${key}`;
			var obj = await Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle publications URI", async function () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/5/publications/items/${key}`;
			var obj = await Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle group URI", async function () {
			var group = await getGroup();
			
			var key = 'ABCD2345';
			var uri = `http://zotero.org/groups/${group.id}/items/${key}`;
			var obj = await Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', group.libraryID);
			assert.propertyVal(obj, 'key', key);
		});
	});
});
