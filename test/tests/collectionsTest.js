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
			yield createDataObject('collection', { libraryID: (yield getGroup()).libraryID });
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var col1 = yield createDataObject('collection', { name: "C" });
			var col2 = yield createDataObject('collection', { name: "A" });
			var col3 = yield createDataObject('collection', { name: "D", parentID: col2.id });
			var col4 = yield createDataObject('collection', { name: "B", parentID: col2.id });
			var col5 = yield createDataObject('collection', { name: "E", parentID: col2.id });
			var col6 = yield createDataObject('collection', { name: "G", parentID: col3.id });
			var col7 = yield createDataObject('collection', { name: "F", parentID: col3.id });
			var cols = yield Zotero.Collections.getByLibrary(libraryID, true);
			assert.isAbove(cols.length, 6);
			var ids = cols.map(col => col.id);
			assert.includeMembers(
				ids, [col1.id, col2.id, col3.id, col4.id, col5.id, col6.id, col7.id]
			);
			assert.isBelow(ids.indexOf(col2.id), ids.indexOf(col4.id), "A before child B");
			assert.isBelow(ids.indexOf(col4.id), ids.indexOf(col3.id), "B before D");
			assert.isBelow(ids.indexOf(col3.id), ids.indexOf(col7.id), "D before child F");
			assert.isBelow(ids.indexOf(col7.id), ids.indexOf(col6.id), "F before G");
			assert.isBelow(ids.indexOf(col6.id), ids.indexOf(col5.id), "G before D sibling E");
			assert.isBelow(ids.indexOf(col5.id), ids.indexOf(col1.id), "E before A sibling C");
			assert.ok(cols.every(col => col.libraryID == libraryID));
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
