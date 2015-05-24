describe("Zotero.Collections", function () {
	describe("#getByLibrary()", function () {
		it("should get all root collections in a library", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			var cols = yield Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID);
			assert.isAbove(cols.length, 1);
			assert.includeMembers(cols.map(col => col.id), [col1.id, col2.id]);
			assert.ok(cols.every(col =>
				col.libraryID == Zotero.Libraries.userLibraryID && !col.parentID
			));
		})
		
		it("should get all collections in a library in recursive mode", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			var cols = yield Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID, true);
			assert.isAbove(cols.length, 2);
			assert.includeMembers(cols.map(col => col.id), [col1.id, col2.id, col3.id]);
			assert.ok(cols.every(col => col.libraryID == Zotero.Libraries.userLibraryID));
		})
	})
	
	describe("#getByParent()", function () {
		it("should get all direct subcollections of a library", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			assert.lengthOf((yield Zotero.Collections.getByParent(col1.id)), 0);
			var cols = yield Zotero.Collections.getByParent(col2.id);
			assert.lengthOf(cols, 1);
			assert.sameMembers(cols.map(col => col.id), [col3.id]);
		})
		
		it("should get all collections underneath a collection in recursive mode", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			var col4 = yield createDataObject('collection', { parentID: col3.id });
			assert.lengthOf((yield Zotero.Collections.getByParent(col1.id)), 0);
			var cols = yield Zotero.Collections.getByParent(col2.id, true);
			assert.lengthOf(cols, 2);
			assert.includeMembers(cols.map(col => col.id), [col3.id, col4.id]);
		})
	})
})
