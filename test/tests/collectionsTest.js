describe("Zotero.Collections", function () {
	describe("#getByLibrary()", function () {
		it("should get all root collections in a library", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			
			var col1 = yield createDataObject('collection', { libraryID });
			var col2 = yield createDataObject('collection', { libraryID });
			var col3 = yield createDataObject('collection', { libraryID, parentID: col2.id });
			var cols = Zotero.Collections.getByLibrary(libraryID);
			assert.lengthOf(cols, 2);
			assert.sameMembers(cols.map(col => col.id), [col1.id, col2.id]);
		})
		
		it("should get all collections in a library in recursive mode", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			
			// Create collection in another library
			yield createDataObject('collection');
			
			var col1 = yield createDataObject('collection', { libraryID, name: "C" });
			var col2 = yield createDataObject('collection', { libraryID, name: "A" });
			var col3 = yield createDataObject('collection', { libraryID, name: "D", parentID: col2.id });
			var col4 = yield createDataObject('collection', { libraryID, name: "B", parentID: col2.id });
			var col5 = yield createDataObject('collection', { libraryID, name: "E", parentID: col2.id });
			var col6 = yield createDataObject('collection', { libraryID, name: "G", parentID: col3.id });
			var col7 = yield createDataObject('collection', { libraryID, name: "F", parentID: col3.id });
			var cols = Zotero.Collections.getByLibrary(libraryID, true);
			assert.lengthOf(cols, 7);
			var ids = cols.map(col => col.id);
			assert.sameMembers(
				ids, [col1.id, col2.id, col3.id, col4.id, col5.id, col6.id, col7.id]
			);
			assert.isBelow(ids.indexOf(col2.id), ids.indexOf(col4.id), "A before child B");
			assert.isBelow(ids.indexOf(col4.id), ids.indexOf(col3.id), "B before D");
			assert.isBelow(ids.indexOf(col3.id), ids.indexOf(col7.id), "D before child F");
			assert.isBelow(ids.indexOf(col7.id), ids.indexOf(col6.id), "F before G");
			assert.isBelow(ids.indexOf(col6.id), ids.indexOf(col5.id), "G before D sibling E");
			assert.isBelow(ids.indexOf(col5.id), ids.indexOf(col1.id), "E before A sibling C");
			
			// 'level' property, which is a hack for indenting in the advanced search window
			assert.equal(cols[0].level, 0);
			assert.equal(cols[1].level, 1);
			assert.equal(cols[2].level, 1);
			assert.equal(cols[3].level, 2);
			assert.equal(cols[4].level, 2);
			assert.equal(cols[5].level, 1);
			assert.equal(cols[6].level, 0);
		})
		
		it("should not include collections in trash", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var col = await createDataObject('collection', { deleted: true });
			var cols = Zotero.Collections.getByLibrary(libraryID);
			assert.notInclude(cols.map(c => c.id), col.id);
		});
		
		it("should not include collections in trash in recursive mode", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var col1 = await createDataObject('collection');
			var col2 = await createDataObject('collection', { parentID: col1.id, deleted: true });
			var col3 = await createDataObject('collection', { parentID: col2.id });
			var col4 = await createDataObject('collection', { parentID: col1.id });
			var col5 = await createDataObject('collection', { parentID: col4.id, deleted: true });
			var cols = Zotero.Collections.getByLibrary(libraryID, true);
			assert.notIncludeMembers(cols.map(c => c.id), [col2.id, col3.id, col5.id]);
		});
	})
	
	describe("#getByParent()", function () {
		it("should get all direct subcollections of a library", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			assert.lengthOf(Zotero.Collections.getByParent(col1.id), 0);
			var cols = Zotero.Collections.getByParent(col2.id);
			assert.lengthOf(cols, 1);
			assert.sameMembers(cols.map(col => col.id), [col3.id]);
		})
		
		it("should get all collections underneath a collection in recursive mode", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection');
			var col3 = yield createDataObject('collection', { parentID: col2.id });
			var col4 = yield createDataObject('collection', { parentID: col3.id });
			assert.lengthOf(Zotero.Collections.getByParent(col1.id), 0);
			var cols = Zotero.Collections.getByParent(col2.id, true);
			assert.lengthOf(cols, 2);
			assert.includeMembers(cols.map(col => col.id), [col3.id, col4.id]);
		})
	})
	
	describe("#getAsync()", function() {
		it("should return a collection item for a collection ID", function* () {
			let collection = new Zotero.Collection({ name: 'foo' });
			collection = yield Zotero.Collections.getAsync(yield collection.saveTx());
			
			assert.notOk(collection.isFeed);
			assert.instanceOf(collection, Zotero.Collection);
			assert.notInstanceOf(collection, Zotero.Feed);
		});
	});
})
