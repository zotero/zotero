describe("Zotero.URI", function() {
	describe("#getURIItemLibraryKeyFromDB()", function () {
		it("should handle user library", function* () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/5/items/${key}`;
			var obj = yield Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle user library with local user key", function* () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/local/aaaaaaaa/items/${key}`;
			var obj = yield Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle publications URI", function* () {
			var key = 'ABCD2345';
			var uri = `http://zotero.org/users/5/publications/items/${key}`;
			var obj = yield Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', Zotero.Libraries.userLibraryID);
			assert.propertyVal(obj, 'key', key);
		});
		
		it("should handle group URI", function* () {
			var group = yield getGroup();
			
			var key = 'ABCD2345';
			var uri = `http://zotero.org/groups/${group.id}/items/${key}`;
			var obj = yield Zotero.URI.getURIItemLibraryKeyFromDB(uri);
			assert.propertyVal(obj, 'libraryID', group.libraryID);
			assert.propertyVal(obj, 'key', key);
		});
	});
});
