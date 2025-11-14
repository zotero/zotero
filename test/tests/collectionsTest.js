describe("Zotero.Collections", function () {
	describe("#getByLibrary()", function () {
		it("should get all root collections in a library", async function () {
			var group = await createGroup();
			var libraryID = group.libraryID;
			
			var col1 = await createDataObject('collection', { libraryID });
			var col2 = await createDataObject('collection', { libraryID });
			var col3 = await createDataObject('collection', { libraryID, parentID: col2.id });
			var cols = Zotero.Collections.getByLibrary(libraryID);
			assert.lengthOf(cols, 2);
			assert.sameMembers(cols.map(col => col.id), [col1.id, col2.id]);
		})
		
		it("should get all collections in a library in recursive mode", async function () {
			var group = await createGroup();
			var libraryID = group.libraryID;
			
			// Create collection in another library
			await createDataObject('collection');
			
			var col1 = await createDataObject('collection', { libraryID, name: "C" });
			var col2 = await createDataObject('collection', { libraryID, name: "A" });
			var col3 = await createDataObject('collection', { libraryID, name: "D", parentID: col2.id });
			var col4 = await createDataObject('collection', { libraryID, name: "B", parentID: col2.id });
			var col5 = await createDataObject('collection', { libraryID, name: "E", parentID: col2.id });
			var col6 = await createDataObject('collection', { libraryID, name: "G", parentID: col3.id });
			var col7 = await createDataObject('collection', { libraryID, name: "F", parentID: col3.id });
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
		it("should get all direct subcollections of a library", async function () {
			var col1 = await createDataObject('collection');
			var col2 = await createDataObject('collection');
			var col3 = await createDataObject('collection', { parentID: col2.id });
			assert.lengthOf(Zotero.Collections.getByParent(col1.id), 0);
			var cols = Zotero.Collections.getByParent(col2.id);
			assert.lengthOf(cols, 1);
			assert.sameMembers(cols.map(col => col.id), [col3.id]);
		})
		
		it("should get all collections underneath a collection in recursive mode", async function () {
			var col1 = await createDataObject('collection');
			var col2 = await createDataObject('collection');
			var col3 = await createDataObject('collection', { parentID: col2.id });
			var col4 = await createDataObject('collection', { parentID: col3.id });
			assert.lengthOf(Zotero.Collections.getByParent(col1.id), 0);
			var cols = Zotero.Collections.getByParent(col2.id, true);
			assert.lengthOf(cols, 2);
			assert.includeMembers(cols.map(col => col.id), [col3.id, col4.id]);
		})
	})
	
	describe("#getAsync()", function () {
		it("should return a collection item for a collection ID", async function () {
			let collection = new Zotero.Collection({ name: 'foo' });
			collection = await Zotero.Collections.getAsync(await collection.saveTx());
			
			assert.notOk(collection.isFeed);
			assert.instanceOf(collection, Zotero.Collection);
			assert.notInstanceOf(collection, Zotero.Feed);
		});
	});

	describe("#copy()", function () {
		let group;

		before(async function () {
			group = await createGroup();
		});

		it("should copy new collections and items to another library", async function () {
			let collection = await createDataObject('collection');
			let subcollection = await createDataObject('collection', { parentID: collection.id });
			let item = await createDataObject('item', { setTitle: true, collections: [collection.id] });

			await Zotero.Collections.copy(collection, group);

			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			assert.equal(collection.name, linkedCollection.name);
			let linkedSubcollection = await subcollection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedSubcollection.parentID, linkedCollection.id);

			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(item.title, linkedItem.title);
			assert.sameMembers(linkedItem.getCollections(), [linkedCollection.id]);
		});

		it("should copy new collections and items to a collection in another library", async function () {
			let collection = await createDataObject('collection');
			let subcollection = await createDataObject('collection', { parentID: collection.id });
			let item = await createDataObject('item', { setTitle: true, collections: [collection.id] });

			let groupCollection = await createDataObject('collection', { libraryID: group.libraryID });

			await Zotero.Collections.copy(collection, groupCollection);

			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedCollection.parentID, groupCollection.id);
			let linkedSubcollection = await subcollection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedSubcollection.parentID, linkedCollection.id);

			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(item.title, linkedItem.title);
			assert.sameMembers(linkedItem.getCollections(), [linkedCollection.id]);
		});

		it("should add items and collections into existing linked collection", async function () {
			let collection = await createDataObject('collection');
			let subcollection = await createDataObject('collection', { parentID: collection.id });
			let item = await createDataObject('item', { setTitle: true, collections: [collection.id] });

			let groupCollection = await createDataObject('collection', { libraryID: group.libraryID });
			await groupCollection.addLinkedCollection(collection);
			await collection.addLinkedCollection(groupCollection);

			await Zotero.Collections.copy(collection, groupCollection);

			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedCollection.id, groupCollection.id);
			let linkedSubcollection = await subcollection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedSubcollection.parentID, linkedCollection.id);

			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(item.title, linkedItem.title);
			assert.sameMembers(linkedItem.getCollections(), [linkedCollection.id]);
		});
	});

	describe("#replicate()", function () {
		let group;

		before(async function () {
			group = await createGroup();
		});

		it("should replicate collections structure in linked group", async function () {
			// Collection -> subcollection -> subsubcollection
			let collection = await createDataObject('collection');
			let subcollection = await createDataObject('collection', { parentID: collection.id });
			let subsubcollection = await createDataObject('collection', { parentID: subcollection.id });

			// Linked group collection
			let groupCollection = await createDataObject('collection', { libraryID: group.libraryID });
			// Linked group top-level collection that should be a top-collection
			let groupSubcollection = await createDataObject('collection', { libraryID: group.libraryID });
			// Group unlinked subcollection that should not be in that collection
			let unlinkedGroupSubcollection = await createDataObject('collection', { libraryID: group.libraryID, parentID: groupCollection.id });

			await groupCollection.addLinkedCollection(collection);
			await collection.addLinkedCollection(groupCollection);

			await subcollection.addLinkedCollection(groupSubcollection);
			await groupSubcollection.addLinkedCollection(subcollection);

			// Replicate collections
			await Zotero.Collections.replicate(collection, group);
			let linkedSubSubCollection = await subsubcollection.getLinkedCollection(group.libraryID, true);

			// groupCollection remains top-level
			assert.notOk(groupCollection.parentID);
			// groupSubcollection is now a proper child of groupCollection
			assert.equal(groupSubcollection.parentID, groupCollection.id);
			// subsubcollection added a linked collection to the group
			assert.equal(linkedSubSubCollection.parentID, groupSubcollection.id);
			// unlinked collection is deleted
			assert.isTrue(unlinkedGroupSubcollection.deleted);
		});

		it("should replicate items in the linked collection ", async function () {
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', { setTitle: true, collections: [collection.id] });
			let note = await createDataObject('item', { itemType: 'note', parentItemID: item.id });
			let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });

			// Create linked items in another group
			await Zotero.Collections.copy(collection, group);

			// Update the items metadata
			item.setField('title', 'Updated title');
			await item.saveTx();

			note.setNote('Updated note');
			await note.saveTx();
			
			attachment.setField('title', 'Updated attachment');
			await attachment.saveTx();

			// Add a random item to the group collection
			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			let randomItem = await createDataObject('item', { libraryID: group.libraryID, collections: [linkedCollection.id] });

			// Replicate the collection
			await Zotero.Collections.replicate(collection, group);

			// Metadata of items in the group should be updated
			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(linkedItem.getField("title"), 'Updated title');
			let linkedNote = await note.getLinkedItem(group.libraryID, true);
			assert.equal(linkedNote.parentID, linkedItem.id);
			assert.equal(linkedNote.getNote(), 'Updated note');
			let linkedAttachment = await attachment.getLinkedItem(group.libraryID, true);
			assert.equal(linkedAttachment.getField("title"), 'Updated attachment');
			assert.equal(linkedAttachment.parentID, linkedItem.id);
			// The not linked item should be trashed
			assert.isTrue(randomItem.deleted);
		});
	});
})
