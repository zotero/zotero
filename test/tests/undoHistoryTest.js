describe("Zotero.UndoHistory", function () {
	beforeEach(function () {
		Zotero.UndoHistory.clear();
	});

	describe("collection name edit", function () {
		it("should undo and redo a collection name change", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx();
			assert.equal(collection.name, 'Modified');
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.equal(collection.name, 'Original');
			assert.isTrue(Zotero.UndoHistory.canRedo());

			await Zotero.UndoHistory.redo();
			assert.equal(collection.name, 'Modified');
		});
	});

	describe("trashing a collection", function () {
		it("should undo and redo trashing a collection", async function () {
			let collection = await createDataObject('collection');

			collection.deleted = true;
			await collection.saveTx();
			assert.isTrue(collection.deleted);

			await Zotero.UndoHistory.undo();
			assert.isFalse(collection.deleted);

			await Zotero.UndoHistory.redo();
			assert.isTrue(collection.deleted);
		});

		it("should undo and redo trashing a collection with descendent sub-collections", async function () {
			let parent = await createDataObject('collection', { name: 'Parent' });
			let child = await createDataObject('collection', { name: 'Child', parentID: parent.id });
			Zotero.UndoHistory.clear();

			parent.deleted = true;
			await parent.saveTx();
			assert.isTrue(parent.deleted);
			assert.isTrue(child.deleted);

			await Zotero.UndoHistory.undo();
			assert.isFalse(parent.deleted);
			assert.isFalse(child.deleted);

			await Zotero.UndoHistory.redo();
			assert.isTrue(parent.deleted);
			assert.isTrue(child.deleted);
		});
	});

	describe("trashing items via Items.trashTx", function () {
		it("should undo and redo trashing an item", async function () {
			let item = await createDataObject('item', { title: 'Trash Me' });

			await Zotero.Items.trashTx(item.id);
			assert.isTrue(item.deleted);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.isFalse(item.deleted);

			await Zotero.UndoHistory.redo();
			assert.isTrue(item.deleted);
		});

		it("should undo trashing multiple items as a single step", async function () {
			let item1 = await createDataObject('item', { title: 'Item 1' });
			let item2 = await createDataObject('item', { title: 'Item 2' });
			Zotero.UndoHistory.clear();

			await Zotero.Items.trashTx([item1.id, item2.id]);
			assert.isTrue(item1.deleted);
			assert.isTrue(item2.deleted);

			// Should be a single undo step
			await Zotero.UndoHistory.undo();
			assert.isFalse(item1.deleted);
			assert.isFalse(item2.deleted);
			assert.isFalse(Zotero.UndoHistory.canUndo());
		});

		it("should infer trash action for items trashed via Items.trashTx", async function () {
			let item = await createDataObject('item');
			Zotero.UndoHistory.clear();

			await Zotero.Items.trashTx(item.id);
			let action = Zotero.UndoHistory.getUndoAction();
			assert.equal(action.action, 'undo-action-trash');
		});
	});

	describe("item metadata field edit", function () {
		it("should undo and redo a single item field change", async function () {
			let item = await createDataObject('item', { title: 'Original Title' });

			item.setField('title', 'New Title');
			await item.saveTx();
			assert.equal(item.getField('title'), 'New Title');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getField('title'), 'Original Title');

			await Zotero.UndoHistory.redo();
			assert.equal(item.getField('title'), 'New Title');
		});
	});

	describe("batch metadata edit", function () {
		it("should undo a batch edit as a single step", async function () {
			let item1 = await createDataObject('item', { title: 'Title A' });
			let item2 = await createDataObject('item', { title: 'Title B' });
			Zotero.UndoHistory.clear();

			await Zotero.DB.executeTransaction(async function () {
				item1.setField('title', 'Batch Title');
				await item1.save();
				item2.setField('title', 'Batch Title');
				await item2.save();
			});

			assert.equal(item1.getField('title'), 'Batch Title');
			assert.equal(item2.getField('title'), 'Batch Title');

			// Single undo should revert both
			await Zotero.UndoHistory.undo();
			assert.equal(item1.getField('title'), 'Title A');
			assert.equal(item2.getField('title'), 'Title B');
			assert.isFalse(Zotero.UndoHistory.canUndo());
		});
	});

	describe("skipUndo", function () {
		it("should not record a save with skipUndo", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });
			Zotero.UndoHistory.clear();

			collection.name = 'Modified';
			await collection.saveTx({ skipUndo: true });
			assert.equal(collection.name, 'Modified');
			assert.isFalse(Zotero.UndoHistory.canUndo());
		});

		it("should not record a save with skipAll", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			item.setField('title', 'Modified');
			await item.saveTx({ skipAll: true });
			assert.isFalse(Zotero.UndoHistory.canUndo());
		});
	});

	describe("redo stack", function () {
		it("should clear redo stack on new change", async function () {
			let collection = await createDataObject('collection', { name: 'V1' });

			collection.name = 'V2';
			await collection.saveTx();

			await Zotero.UndoHistory.undo();
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// New change should clear the redo stack
			collection.name = 'V3';
			await collection.saveTx();
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});
	});

	describe("deleted object handling", function () {
		it("should handle a deleted object gracefully during undo", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx();

			// Permanently delete the collection
			await collection.eraseTx();

			// Undo should not throw
			let result = await Zotero.UndoHistory.undo();
			assert.isTrue(result);
		});
	});

	describe("canUndo/canRedo", function () {
		it("should return false when stacks are empty", function () {
			assert.isFalse(Zotero.UndoHistory.canUndo());
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});

		it("should return false after undo with no redo available when nothing undone", async function () {
			let result = await Zotero.UndoHistory.undo();
			assert.isFalse(result);
		});

		it("should return false after redo with nothing to redo", async function () {
			let result = await Zotero.UndoHistory.redo();
			assert.isFalse(result);
		});
	});

	describe("collection membership changes", function () {
		it("should undo and redo adding an item to a collection", async function () {
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', { title: 'Test Item' });
			Zotero.UndoHistory.clear();

			item.setCollections([collection.id]);
			await item.saveTx();
			assert.include(item.getCollections(), collection.id);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.notInclude(item.getCollections(), collection.id);
			assert.lengthOf(item.getCollections(), 0);

			await Zotero.UndoHistory.redo();
			assert.include(item.getCollections(), collection.id);
		});

		it("should undo and redo removing an item from a collection", async function () {
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', {
				title: 'Test Item',
				collections: [collection.id]
			});
			assert.include(item.getCollections(), collection.id);
			Zotero.UndoHistory.clear();

			item.setCollections([]);
			await item.saveTx();
			assert.lengthOf(item.getCollections(), 0);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.include(item.getCollections(), collection.id);

			await Zotero.UndoHistory.redo();
			assert.lengthOf(item.getCollections(), 0);
		});
	});

	describe("note edit", function () {
		it("should undo and redo a note text change", async function () {
			let item = new Zotero.Item('note');
			item.setNote('Original note');
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setNote('Modified note');
			await item.saveTx();
			assert.equal(item.getNote(), 'Modified note');
			assert.isTrue(Zotero.UndoHistory.canUndo());

			let action = Zotero.UndoHistory.getUndoAction();
			assert.equal(action.action, 'undo-action-edit-note');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getNote(), 'Original note');
			assert.isTrue(Zotero.UndoHistory.canRedo());

			await Zotero.UndoHistory.redo();
			assert.equal(item.getNote(), 'Modified note');
		});
	});

	describe("action tracking", function () {
		describe("auto-inference", function () {
			it("should infer edit-metadata for an item field edit", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-edit-metadata');
				assert.deepEqual(action.actionArgs, { count: 1 });
			});

			it("should infer rename-collection for a collection name change", async function () {
				let collection = await createDataObject('collection', { name: 'Original' });
				Zotero.UndoHistory.clear();

				collection.name = 'Renamed';
				await collection.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-rename-collection');
			});

			it("should infer trash for trashing a collection", async function () {
				let collection = await createDataObject('collection');
				Zotero.UndoHistory.clear();

				collection.deleted = true;
				await collection.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-trash-collection');
				assert.deepEqual(action.actionArgs, { count: 1 });
			});

			it("should infer add-to-collection for adding an item to a collection", async function () {
				let collection = await createDataObject('collection');
				let item = await createDataObject('item', { title: 'Test' });
				Zotero.UndoHistory.clear();

				item.setCollections([collection.id]);
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-add-to-collection');
				assert.deepEqual(action.actionArgs, { count: 1 });
			});

			it("should infer remove-from-collection for removing an item from a collection", async function () {
				let collection = await createDataObject('collection');
				let item = await createDataObject('item', {
					title: 'Test',
					collections: [collection.id]
				});
				Zotero.UndoHistory.clear();

				item.setCollections([]);
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-remove-from-collection');
				assert.deepEqual(action.actionArgs, { count: 1 });
			});

			it("should include correct count for batch edits", async function () {
				let item1 = await createDataObject('item', { title: 'A' });
				let item2 = await createDataObject('item', { title: 'B' });
				let item3 = await createDataObject('item', { title: 'C' });
				Zotero.UndoHistory.clear();

				await Zotero.DB.executeTransaction(async function () {
					item1.setField('title', 'X');
					await item1.save();
					item2.setField('title', 'X');
					await item2.save();
					item3.setField('title', 'X');
					await item3.save();
				});

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-edit-metadata');
				assert.deepEqual(action.actionArgs, { count: 3 });
			});
		});

		describe("explicit override", function () {
			it("should use undoAction option from saveTx", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx({ undoAction: 'undo-action-change-type' });

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-change-type');
			});
		});

		describe("redo preservation", function () {
			it("should preserve action through undo/redo cycle", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx();

				let undoAction = Zotero.UndoHistory.getUndoAction();
				assert.equal(undoAction.action, 'undo-action-edit-metadata');

				await Zotero.UndoHistory.undo();

				let redoAction = Zotero.UndoHistory.getRedoAction();
				assert.isNotNull(redoAction);
				assert.equal(redoAction.action, 'undo-action-edit-metadata');
				assert.deepEqual(redoAction.actionArgs, { count: 1 });

				await Zotero.UndoHistory.redo();

				undoAction = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(undoAction);
				assert.equal(undoAction.action, 'undo-action-edit-metadata');
			});
		});

		describe("getUndoAction/getRedoAction", function () {
			it("should return null when stacks are empty", function () {
				assert.isNull(Zotero.UndoHistory.getUndoAction());
				assert.isNull(Zotero.UndoHistory.getRedoAction());
			});

			it("should return null for redo when nothing has been undone", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx();

				assert.isNotNull(Zotero.UndoHistory.getUndoAction());
				assert.isNull(Zotero.UndoHistory.getRedoAction());
			});
		});
	});

	describe("creator changes", function () {
		it("should undo and redo editing a creator name", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'John',
				lastName: 'Doe',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'John',
				lastName: 'Smith',
				fieldMode: 0
			});
			await item.saveTx();
			assert.equal(item.getCreator(0).lastName, 'Smith');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getCreator(0).lastName, 'Doe');

			await Zotero.UndoHistory.redo();
			assert.equal(item.getCreator(0).lastName, 'Smith');
		});

		it("should undo and redo adding a new creator", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'Jane',
				lastName: 'Doe',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setCreator(1, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'Bob',
				lastName: 'Jones',
				fieldMode: 0
			});
			await item.saveTx();
			assert.equal(item.numCreators(), 2);

			await Zotero.UndoHistory.undo();
			assert.equal(item.numCreators(), 1);
			assert.equal(item.getCreator(0).lastName, 'Doe');

			await Zotero.UndoHistory.redo();
			assert.equal(item.numCreators(), 2);
			assert.equal(item.getCreator(1).lastName, 'Jones');
		});

		it("should undo and redo removing a creator", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'Jane',
				lastName: 'Doe',
				fieldMode: 0
			});
			item.setCreator(1, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'Bob',
				lastName: 'Jones',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.removeCreator(1);
			await item.saveTx();
			assert.equal(item.numCreators(), 1);

			await Zotero.UndoHistory.undo();
			assert.equal(item.numCreators(), 2);
			assert.equal(item.getCreator(1).lastName, 'Jones');

			await Zotero.UndoHistory.redo();
			assert.equal(item.numCreators(), 1);
		});

		it("should undo and redo changing creator type", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'John',
				lastName: 'Doe',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('editor'),
				firstName: 'John',
				lastName: 'Doe',
				fieldMode: 0
			});
			await item.saveTx();
			assert.equal(item.getCreator(0).creatorTypeID, Zotero.CreatorTypes.getID('editor'));

			await Zotero.UndoHistory.undo();
			assert.equal(item.getCreator(0).creatorTypeID, Zotero.CreatorTypes.getID('author'));

			await Zotero.UndoHistory.redo();
			assert.equal(item.getCreator(0).creatorTypeID, Zotero.CreatorTypes.getID('editor'));
		});

		it("should undo and redo switching field mode", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'John',
				lastName: 'Doe',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: '',
				lastName: 'John Doe',
				fieldMode: 1
			});
			await item.saveTx();
			assert.equal(item.getCreator(0).fieldMode, 1);
			assert.equal(item.getCreator(0).lastName, 'John Doe');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getCreator(0).fieldMode, 0);
			assert.equal(item.getCreator(0).firstName, 'John');
			assert.equal(item.getCreator(0).lastName, 'Doe');

			await Zotero.UndoHistory.redo();
			assert.equal(item.getCreator(0).fieldMode, 1);
		});

		it("should undo and redo reordering creators", async function () {
			let item = await createDataObject('item');
			item.setCreator(0, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'First',
				lastName: 'Author',
				fieldMode: 0
			});
			item.setCreator(1, {
				creatorTypeID: Zotero.CreatorTypes.getID('author'),
				firstName: 'Second',
				lastName: 'Author',
				fieldMode: 0
			});
			await item.saveTx();
			Zotero.UndoHistory.clear();

			// Swap order -- move second to first position
			let creators = item.getCreators();
			item.setCreator(0, creators[1]);
			item.setCreator(1, creators[0]);
			await item.saveTx();
			assert.equal(item.getCreator(0).firstName, 'Second');
			assert.equal(item.getCreator(1).firstName, 'First');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getCreator(0).firstName, 'First');
			assert.equal(item.getCreator(1).firstName, 'Second');

			await Zotero.UndoHistory.redo();
			assert.equal(item.getCreator(0).firstName, 'Second');
			assert.equal(item.getCreator(1).firstName, 'First');
		});

		describe("action label inference", function () {
			it("should infer 'add creator' when creator count increases", async function () {
				let item = await createDataObject('item');
				item.setCreator(0, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'Jane',
					lastName: 'Doe',
					fieldMode: 0
				});
				await item.saveTx();
				Zotero.UndoHistory.clear();

				item.setCreator(1, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'Bob',
					lastName: 'Jones',
					fieldMode: 0
				});
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.equal(action.action, 'undo-action-add-creator');
			});

			it("should infer 'remove creator' when creator count decreases", async function () {
				let item = await createDataObject('item');
				item.setCreator(0, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'Jane',
					lastName: 'Doe',
					fieldMode: 0
				});
				item.setCreator(1, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'Bob',
					lastName: 'Jones',
					fieldMode: 0
				});
				await item.saveTx();
				Zotero.UndoHistory.clear();

				item.removeCreator(1);
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.equal(action.action, 'undo-action-remove-creator');
			});

			it("should infer 'edit creator' when creator count stays the same", async function () {
				let item = await createDataObject('item');
				item.setCreator(0, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'John',
					lastName: 'Doe',
					fieldMode: 0
				});
				await item.saveTx();
				Zotero.UndoHistory.clear();

				item.setCreator(0, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'John',
					lastName: 'Smith',
					fieldMode: 0
				});
				await item.saveTx();

				let action = Zotero.UndoHistory.getUndoAction();
				assert.equal(action.action, 'undo-action-edit-creator');
			});

			it("should use explicit undoAction when provided", async function () {
				let item = await createDataObject('item');
				item.setCreator(0, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'First',
					lastName: 'Author',
					fieldMode: 0
				});
				item.setCreator(1, {
					creatorTypeID: Zotero.CreatorTypes.getID('author'),
					firstName: 'Second',
					lastName: 'Author',
					fieldMode: 0
				});
				await item.saveTx();
				Zotero.UndoHistory.clear();

				// Swap and save with explicit reorder action
				let creators = item.getCreators();
				item.setCreator(0, creators[1]);
				item.setCreator(1, creators[0]);
				await item.saveTx({ undoAction: 'undo-action-reorder-creator' });

				let action = Zotero.UndoHistory.getUndoAction();
				assert.equal(action.action, 'undo-action-reorder-creator');
			});
		});
	});

	describe("item type change", function () {
		it("should undo and redo a type change that loses fields", async function () {
			let caseTypeID = Zotero.ItemTypes.getID('case');
			let filmTypeID = Zotero.ItemTypes.getID('film');

			let item = await createDataObject('item', { itemType: 'case' });
			item.setField('court', 'Supreme Court');
			await item.saveTx();
			Zotero.UndoHistory.clear();

			// Change type: Case -> Film (court is lost)
			item.setType(filmTypeID);
			await item.saveTx({ undoAction: 'undo-action-change-type' });

			assert.equal(item.itemTypeID, filmTypeID);
			assert.equal(item.getField('court'), '');
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// Undo: Film -> Case, court restored
			await Zotero.UndoHistory.undo();
			assert.equal(item.itemTypeID, caseTypeID);
			assert.equal(item.getField('court'), 'Supreme Court');
			assert.isFalse(Zotero.UndoHistory.canUndo(), "only one undo entry should exist");
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// Redo: Case -> Film (no dialog -- goes through UndoHistory.redo())
			await Zotero.UndoHistory.redo();
			assert.equal(item.itemTypeID, filmTypeID);
			assert.equal(item.getField('court'), '');
		});
	});

	describe("related items", function () {
		it("should undo and redo adding a related item", async function () {
			let itemA = await createDataObject('item', { title: 'Item A' });
			let itemB = await createDataObject('item', { title: 'Item B' });
			Zotero.UndoHistory.clear();

			await Zotero.DB.executeTransaction(async () => {
				itemA.addRelatedItem(itemB);
				await itemA.save({ skipDateModifiedUpdate: true });
				itemB.addRelatedItem(itemA);
				await itemB.save({ skipDateModifiedUpdate: true });
			});

			assert.include(itemA.relatedItems, itemB.key);
			assert.include(itemB.relatedItems, itemA.key);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.notInclude(itemA.relatedItems, itemB.key);
			assert.notInclude(itemB.relatedItems, itemA.key);

			await Zotero.UndoHistory.redo();
			assert.include(itemA.relatedItems, itemB.key);
			assert.include(itemB.relatedItems, itemA.key);
		});

		it("should undo and redo removing a related item", async function () {
			let itemA = await createDataObject('item', { title: 'Item A' });
			let itemB = await createDataObject('item', { title: 'Item B' });
			// Establish the relation
			await Zotero.DB.executeTransaction(async () => {
				itemA.addRelatedItem(itemB);
				await itemA.save({ skipDateModifiedUpdate: true });
				itemB.addRelatedItem(itemA);
				await itemB.save({ skipDateModifiedUpdate: true });
			});
			Zotero.UndoHistory.clear();

			// Remove the relation
			await Zotero.DB.executeTransaction(async () => {
				itemA.removeRelatedItem(itemB);
				await itemA.save({ skipDateModifiedUpdate: true });
				itemB.removeRelatedItem(itemA);
				await itemB.save({ skipDateModifiedUpdate: true });
			});

			assert.notInclude(itemA.relatedItems, itemB.key);
			assert.notInclude(itemB.relatedItems, itemA.key);

			await Zotero.UndoHistory.undo();
			assert.include(itemA.relatedItems, itemB.key);
			assert.include(itemB.relatedItems, itemA.key);

			await Zotero.UndoHistory.redo();
			assert.notInclude(itemA.relatedItems, itemB.key);
			assert.notInclude(itemB.relatedItems, itemA.key);
		});
	});
});
