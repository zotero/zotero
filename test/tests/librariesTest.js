describe("Zotero.Libraries", function () {
	let groupName = 'test',
		group,
		builtInLibraries;
	before(function* () {
		builtInLibraries = [
			Zotero.Libraries.userLibraryID,
		];
		
		group = yield createGroup({ name: groupName });
	});
	
	it("should provide user library ID as .userLibraryID", function () {
		assert.isDefined(Zotero.Libraries.userLibraryID);
		assert(Number.isInteger(Zotero.Libraries.userLibraryID), ".userLibraryID is an integer");
		assert.isAbove(Zotero.Libraries.userLibraryID, 0);
	});
	
	describe("#getAll()", function () {
		it("should return an array of Zotero.Library instances", function () {
			let libraries = Zotero.Libraries.getAll();
			assert.isArray(libraries);
			assert(libraries.every(library => library instanceof Zotero.Library));
		})
		
		it("should return all libraries in sorted order", async function () {
			// Add/remove a few group libraries beforehand to ensure that data is kept in sync
			let library = await createGroup();
			let tempLib = await createGroup();
			await tempLib.eraseTx();
			
			var libraries = Zotero.Libraries.getAll();
			var ids = libraries.map(library => library.libraryID);
			var dbIDs = await Zotero.DB.columnQueryAsync("SELECT libraryID FROM libraries");
			assert.sameMembers(ids, dbIDs);
			assert.equal(dbIDs.length, ids.length, "returns correct number of IDs");
			
			// Check sort
			assert.equal(ids[0], Zotero.Libraries.userLibraryID);
			
			var last = "";
			var collation = Zotero.getLocaleCollation();
			for (let i = 2; i < libraries.length; i++) {
				let current = libraries[i].name;
				assert.isAbove(
					collation.compareString(1, current, last),
					0,
					`'${current}' should sort after '${last}'`
				);
				last = current;
			}
			
			// remove left-over library
			await library.eraseTx();
		});
	});
	
	describe("#exists()", function () {
		it("should return true for all existing IDs", function () {
			let ids = Zotero.Libraries.getAll().map(library => library.libraryID);
			assert.isTrue(ids.reduce(function (res, id) { return res && Zotero.Libraries.exists(id) }, true));
		});
		it("should return false for a non-existing ID", function () {
			assert.isFalse(Zotero.Libraries.exists(-1), "returns boolean false for a negative ID");
			let badID = Zotero.Libraries.getAll().map(lib => lib.libraryID).reduce((a, b) => (a < b ? b : a)) + 1;
			assert.isFalse(Zotero.Libraries.exists(badID), "returns boolean false for a non-existent positive ID");
		});
	});
	describe("#getName()", function () {
		it("should return correct library name for built-in libraries", function () {
			assert.equal(Zotero.Libraries.getName(Zotero.Libraries.userLibraryID), Zotero.getString('pane.collections.library'), "user library name is correct");
		});
		it("should return correct name for a group library", function () {
			assert.equal(Zotero.Libraries.getName(group.libraryID), groupName);
		});
		it("should throw for invalid library ID", function () {
			assert.throws(() => Zotero.Libraries.getName(-1), /^Invalid library ID /);
		});
	});
	describe("#getType()", function () {
		it("should return correct library type for built-in libraries", function () {
			assert.equal(Zotero.Libraries.getType(Zotero.Libraries.userLibraryID), 'user', "user library type is correct");
		});
		it("should return correct library type for a group library", function () {
			assert.equal(Zotero.Libraries.getType(group.libraryID), 'group');
		});
		it("should throw for invalid library ID", function () {
			assert.throws(() => Zotero.Libraries.getType(-1), /^Invalid library ID /);
		});
	});
	describe("#isEditable()", function () {
		it("should always return true for user library", function () {
			assert.isTrue(Zotero.Libraries.isEditable(Zotero.Libraries.userLibraryID));
		});
		it("should return correct state for a group library", async function () {
			group.editable = true;
			await group.saveTx();
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			group.editable = false;
			await group.saveTx();
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
		});
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isEditable.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
		it("should not depend on filesEditable", async function () {
			let editableStartState = Zotero.Libraries.isEditable(group.libraryID),
				filesEditableStartState = Zotero.Libraries.isFilesEditable(group.libraryID);
			
			// Test all combinations
			// E: true, FE: true => true
			await Zotero.Libraries.setEditable(group.libraryID, true);
			await Zotero.Libraries.setFilesEditable(group.libraryID, true);
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: false, FE: true => false
			await Zotero.Libraries.setEditable(group.libraryID, false);
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: false, FE: false => false
			await Zotero.Libraries.setFilesEditable(group.libraryID, false);
			assert.isFalse(Zotero.Libraries.isEditable(group.libraryID));
			
			// E: true, FE: false => true
			await Zotero.Libraries.setEditable(group.libraryID, true);
			assert.isTrue(Zotero.Libraries.isEditable(group.libraryID));
			
			// Revert settings
			await Zotero.Libraries.setFilesEditable(group.libraryID, filesEditableStartState);
			await Zotero.Libraries.setEditable(group.libraryID, editableStartState);
		});
	});
	describe("#setEditable()", function () {
		it("should not allow changing editable state of built-in libraries", async function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				assert.ok(await getPromiseError(Zotero.Libraries.setEditable(builtInLibraries[i])));
			}
		});
		it("should allow changing editable state for group library", async function () {
			let startState = Zotero.Libraries.isEditable(group.libraryID);
			await Zotero.Libraries.setEditable(group.libraryID, !startState);
			assert.equal(Zotero.Libraries.isEditable(group.libraryID), !startState, 'changes state');
			
			await Zotero.Libraries.setEditable(group.libraryID, startState);
			assert.equal(Zotero.Libraries.isEditable(group.libraryID), startState, 'reverts state');
		});
		it("should throw for invalid library ID", async function () {
			assert.match((await getPromiseError(Zotero.Libraries.setEditable(-1))).message, /^Invalid library ID /);
		});
	});
	describe("#isFilesEditable()", function () {
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isFilesEditable.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
	describe("#setFilesEditable()", function () {
		it("should not allow changing files editable state of built-in libraries", async function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				assert.ok(await getPromiseError(Zotero.Libraries.setFilesEditable(builtInLibraries[i])));
			}
		});
		it("should allow changing files editable state for group library", async function () {
			let startState = Zotero.Libraries.isFilesEditable(group.libraryID),
				editableStartState = Zotero.Libraries.isEditable(group.libraryID);
			
			// Since filesEditable is false for all non-editable libraries
			await Zotero.Libraries.setEditable(group.libraryID, true);
			
			await Zotero.Libraries.setFilesEditable(group.libraryID, !startState);
			assert.equal(Zotero.Libraries.isFilesEditable(group.libraryID), !startState, 'changes state');
			
			await Zotero.Libraries.setFilesEditable(group.libraryID, startState);
			assert.equal(Zotero.Libraries.isFilesEditable(group.libraryID), startState, 'reverts state');
			
			await Zotero.Libraries.setEditable(group.libraryID, editableStartState);
		});
		it("should throw for invalid library ID", async function () {
			assert.match((await getPromiseError(Zotero.Libraries.setFilesEditable(-1))).message, /^Invalid library ID /);
		});
	});
	describe("#isGroupLibrary()", function () {
		it("should return false for non-group libraries", function () {
			for (let i=0; i<builtInLibraries.length; i++) {
				let id = builtInLibraries[i],
					type = Zotero.Libraries.getType(id);
				assert.isFalse(Zotero.Libraries.isGroupLibrary(id), "returns false for " + type + " library");
			}
		});
		
		it("should return true for group library", function () {
			assert.isTrue(Zotero.Libraries.isGroupLibrary(group.libraryID));
		})
		
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.isGroupLibrary.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
	describe("#hasTrash()", function () {
		it("should return true for all library types", function () {
			assert.isTrue(Zotero.Libraries.hasTrash(Zotero.Libraries.userLibraryID));
			assert.isTrue(Zotero.Libraries.hasTrash(group.libraryID));
		});
		it("should throw for invalid library ID", function () {
			assert.throws(Zotero.Libraries.hasTrash.bind(Zotero.Libraries, -1), /^Invalid library ID /);
		});
	});
	describe("#copy()", function () {
		let group;

		before(async function () {
			group = await createGroup();
		});

		it("should add top-level items to another library", async function () {
			let item = await createDataObject('item');
			await Zotero.Libraries.copy(Zotero.Libraries.userLibrary, group);
			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(linkedItem.getDisplayTitle(), item.getDisplayTitle());
		});

		it("should add new collections and items to another library", async function () {
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', { collections: [collection.id] });
			await Zotero.Libraries.copy(Zotero.Libraries.userLibrary, group);

			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(collection.name, linkedCollection.name);
			assert.equal(item.getDisplayTitle(), linkedItem.getDisplayTitle());
			assert.sameMembers(linkedItem.getCollections(), [linkedCollection.id]);
		});

		it("should add items and collections into existing linked collection", async function () {
			let collection = await createDataObject('collection');
			let subcollection = await createDataObject('collection', { parentID: collection.id });

			let groupCollection = await createDataObject('collection', { libraryID: group.libraryID });
			await groupCollection.addLinkedCollection(collection);
			await collection.addLinkedCollection(groupCollection);

			let item = await createDataObject('item', { collections: [collection.id] });
			await Zotero.Libraries.copy(Zotero.Libraries.userLibrary, group);

			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedCollection.id, groupCollection.id);
			let linkedSubcollection = await subcollection.getLinkedCollection(group.libraryID, true);
			assert.equal(linkedSubcollection.parentID, groupCollection.id);
			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(item.getDisplayTitle(), linkedItem.getDisplayTitle());
			assert.sameMembers(linkedItem.getCollections(), [linkedCollection.id]);
		});
	});

	describe("#replicate()", function () {
		let group;

		before(async function () {
			group = await createGroup();
		});

		it("should replicate the state of group items", async function () {
			let item = await createDataObject('item');
			let groupItem = await createDataObject('item', { libraryID: group.libraryID });
			let unlinkedGroupItem = await createDataObject('item', { libraryID: group.libraryID });

			await groupItem.addLinkedItem(item);
			await item.addLinkedItem(groupItem);

			item.setField('title', 'Updated title');
			await item.saveTx();

			await Zotero.Libraries.replicate(Zotero.Libraries.userLibrary, group);

			let linkedItem = await item.getLinkedItem(group.libraryID, true);
			assert.equal(linkedItem.getDisplayTitle(), 'Updated title');
			assert.isTrue(unlinkedGroupItem.deleted);
		});

		it("should replicate collection structure in target library", async function () {
			let collection = await createDataObject('collection');
			let subcollectionOne = await createDataObject('collection', { parentID: collection.id });
			let subcollectionTwo = await createDataObject('collection', { parentID: collection.id });

			// Create linked collections in the group
			await Zotero.Libraries.copy(Zotero.Libraries.userLibrary, group);

			// Add a few random unlinked collections
			let groupTopLevelRandomCollectionOne = await createDataObject('collection', { libraryID: group.libraryID });
			let groupTopLevelRandomCollectionTwo = await createDataObject('collection', { libraryID: group.libraryID });

			// Move around linked collections in the group
			let linkedCollection = await collection.getLinkedCollection(group.libraryID, true);
			linkedCollection.parentID = groupTopLevelRandomCollectionOne.id;
			await linkedCollection.saveTx();
			let linkedSubcollectionOne = await subcollectionOne.getLinkedCollection(group.libraryID, true);
			linkedSubcollectionOne.parentID = false;
			await linkedSubcollectionOne.saveTx();
			let linkedSubcollectionTwo = await subcollectionTwo.getLinkedCollection(group.libraryID, true);
			linkedSubcollectionTwo.parentID = groupTopLevelRandomCollectionTwo.id;
			await linkedSubcollectionTwo.saveTx();

			// Replicate library
			await Zotero.Libraries.replicate(Zotero.Libraries.userLibrary, group);
			
			// Make sure the structure of collections in the group is the same as in My Library
			assert.notOk(linkedCollection.parentID);
			assert.equal(linkedSubcollectionOne.parentID, linkedCollection.id);
			assert.equal(linkedSubcollectionTwo.parentID, linkedCollection.id);
			// Unlinked collections should be deleted
			assert.isTrue(groupTopLevelRandomCollectionOne.deleted);
			assert.isTrue(groupTopLevelRandomCollectionTwo.deleted);
		});
	});
})
