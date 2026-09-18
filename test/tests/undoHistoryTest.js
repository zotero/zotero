describe("Zotero.UndoHistory", function () {
	beforeEach(function () {
		Zotero.UndoHistory.clear();
	});

	describe("collection name edit", function () {
		it("should undo and redo a collection name change", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
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
			await collection.saveTx({
				undoAction: 'undo-action-trash-collection',
				undoActionArgs: { count: 1 }
			});
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
			await parent.saveTx({
				undoAction: 'undo-action-trash-collection',
				undoActionArgs: { count: 1 }
			});
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
	});

	describe("item metadata field edit", function () {
		it("should undo and redo a single item field change", async function () {
			let item = await createDataObject('item', { title: 'Original Title' });

			item.setField('title', 'New Title');
			await item.saveTx({
				undoAction: 'undo-action-edit-metadata',
				undoActionArgs: { count: 1 }
			});
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
				Zotero.UndoHistory.stageAction(
					'undo-action-edit-metadata', { count: 2 }
				);
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

	describe("opt-in capture", function () {
		it("should not record a save without an undoAction", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });
			Zotero.UndoHistory.clear();

			collection.name = 'Modified';
			await collection.saveTx();
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

		it("should drop staged changes if stageAction is never called", async function () {
			let item1 = await createDataObject('item', { title: 'A' });
			let item2 = await createDataObject('item', { title: 'B' });
			Zotero.UndoHistory.clear();

			await Zotero.DB.executeTransaction(async function () {
				item1.setField('title', 'X');
				await item1.save();
				item2.setField('title', 'Y');
				await item2.save();
				// no stageAction call
			});

			assert.isFalse(Zotero.UndoHistory.canUndo());
		});
	});

	describe("redo stack", function () {
		it("should clear redo stack on new change", async function () {
			let collection = await createDataObject('collection', { name: 'V1' });

			collection.name = 'V2';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });

			await Zotero.UndoHistory.undo();
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// New change should clear the redo stack
			collection.name = 'V3';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});
	});

	describe("deleted object handling", function () {
		it("should handle a deleted object gracefully during undo", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });

			// Permanently delete the collection
			await collection.eraseTx();

			// Undo should not throw
			let result = await Zotero.UndoHistory.undo();
			assert.isTrue(result);
		});
	});

	describe("apply failure", function () {
		it("should clear both stacks if applying an undo entry fails", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// Force the save during undo to fail
			let stub = sinon.stub(collection, 'save').rejects(new Error('save failed'));
			let result;
			try {
				result = await Zotero.UndoHistory.undo();
			}
			finally {
				stub.restore();
			}

			// Nothing was applied, so undo() should report failure
			assert.isFalse(result);
			assert.isFalse(Zotero.UndoHistory.canUndo());
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});

		it("should clear both stacks if applying a redo entry fails", async function () {
			let collection = await createDataObject('collection', { name: 'Original' });

			collection.name = 'Modified';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			await Zotero.UndoHistory.undo();
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// Force the save during redo to fail
			let stub = sinon.stub(collection, 'save').rejects(new Error('save failed'));
			let result;
			try {
				result = await Zotero.UndoHistory.redo();
			}
			finally {
				stub.restore();
			}

			// Nothing was applied, so redo() should report failure
			assert.isFalse(result);
			assert.isFalse(Zotero.UndoHistory.canUndo());
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});

		it("should not leave an object unsaveable after an undo apply failure", async function () {
			// A (move target), P (original parent), B (child being moved)
			let collectionA = await createDataObject('collection', { name: 'A' });
			let collectionP = await createDataObject('collection', { name: 'P' });
			let collectionB = await createDataObject('collection', { name: 'B', parentID: collectionP.id });

			// Move B from P onto A, recording an undo entry for the parent change
			Zotero.UndoHistory.clear();
			collectionB.parentID = collectionA.id;
			await collectionB.saveTx({ undoAction: 'undo-action-move-collection' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// Permanently erase P so its key no longer resolves to a collection
			await collectionP.eraseTx();

			// Undoing tries to set B's parent back to the now-erased P, which makes
			// Collection._initSave throw. The apply fails and history is cleared, but
			// B must not be left pinned to the vanished parent.
			await Zotero.UndoHistory.undo();

			// B should have been rolled back to its last valid parent (A) and remain
			// editable
			assert.equal(collectionB.parentID, collectionA.id);
			collectionB.name = 'B renamed';
			await collectionB.saveTx();
			assert.equal(collectionB.name, 'B renamed');
		});

		it("should not leave an earlier object's memory diverged from the DB when a later save fails", async function () {
			// Two items edited together as a single batch (one undo entry)
			let item1 = await createDataObject('item', { title: 'Title A' });
			let item2 = await createDataObject('item', { title: 'Title B' });
			Zotero.UndoHistory.clear();

			await Zotero.DB.executeTransaction(async function () {
				item1.setField('title', 'Batch Title');
				await item1.save();
				item2.setField('title', 'Batch Title');
				await item2.save();
				Zotero.UndoHistory.stageAction('undo-action-edit-metadata', { count: 2 });
			});
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// item1 is applied and saved first; force the *second* object's save to
			// fail so the transaction rolls back only after item1 has already been
			// written and reloaded into memory with its undone value.
			let stub = sinon.stub(item2, 'save').rejects(new Error('save failed'));
			try {
				await Zotero.UndoHistory.undo();
			}
			finally {
				stub.restore();
			}

			// The transaction rolled back, so the DB still holds the committed batch
			// value. item1's in-memory state must match the DB rather than retaining
			// the rolled-back undo value.
			let dbTitle = await Zotero.DB.valueQueryAsync(
				"SELECT value FROM itemData JOIN itemDataValues USING (valueID) "
					+ "WHERE itemID=? AND fieldID=?",
				[item1.id, Zotero.ItemFields.getID('title')]
			);
			assert.equal(dbTitle, 'Batch Title', "sanity: rollback kept the batch value in the DB");
			assert.equal(item1.getField('title'), 'Batch Title',
				"earlier object's memory should match the rolled-back DB, not the undone value");
			assert.isFalse(item1.hasChanged(),
				"earlier object should not be left with phantom uncommitted changes");
		});
	});

	describe("library erasure", function () {
		it("should clear undo history when a related library is erased", async function () {
			let group = await createGroup();
			let collection = await createDataObject(
				'collection', { libraryID: group.libraryID, name: 'Group Collection' }
			);
			Zotero.UndoHistory.clear();

			collection.name = 'Renamed';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// The group's objects are cascade-deleted without per-object events, so
			// the related undo entry must be discarded
			await group.eraseTx();
			assert.isFalse(Zotero.UndoHistory.canUndo());
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});

		it("should clear undo history when the erased library is referenced only in the redo stack", async function () {
			let group = await createGroup();
			let collection = await createDataObject(
				'collection', { libraryID: group.libraryID, name: 'Group Collection' }
			);
			Zotero.UndoHistory.clear();

			collection.name = 'Renamed';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			// Move the entry onto the redo stack
			await Zotero.UndoHistory.undo();
			assert.isTrue(Zotero.UndoHistory.canRedo());

			await group.eraseTx();
			assert.isFalse(Zotero.UndoHistory.canRedo());
			assert.isFalse(Zotero.UndoHistory.canUndo());
		});

		it("should preserve undo history when an unrelated library is erased", async function () {
			// Record an undo entry in the user library
			let collection = await createDataObject('collection', { name: 'My Library Collection' });
			Zotero.UndoHistory.clear();
			collection.name = 'Renamed';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// Erasing an unrelated group must not touch the user-library history
			let group = await createGroup();
			await group.eraseTx();
			assert.isTrue(Zotero.UndoHistory.canUndo());
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
			await item.saveTx({
				undoAction: 'undo-action-add-to-collection',
				undoActionArgs: { count: 1 }
			});
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
			await item.saveTx({
				undoAction: 'undo-action-remove-from-collection',
				undoActionArgs: { count: 1 }
			});
			assert.lengthOf(item.getCollections(), 0);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.include(item.getCollections(), collection.id);

			await Zotero.UndoHistory.redo();
			assert.lengthOf(item.getCollections(), 0);
		});
	});

	describe("parent change", function () {
		it("should undo and redo unparenting a child item", async function () {
			let parent = await createDataObject('item', { title: 'Parent' });
			let child = new Zotero.Item('note');
			child.parentID = parent.id;
			child.setNote('Child note');
			await child.saveTx();
			assert.equal(child.parentID, parent.id);
			Zotero.UndoHistory.clear();

			child.parentID = false;
			await child.saveTx({
				undoAction: 'undo-action-convert-to-standalone-attachment',
				undoActionArgs: { count: 1 }
			});
			assert.isFalse(!!child.parentID);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();
			assert.equal(child.parentID, parent.id);

			await Zotero.UndoHistory.redo();
			assert.isFalse(!!child.parentID);
		});
	});

	describe("note edit", function () {
		it("should undo and redo a note text change", async function () {
			let item = new Zotero.Item('note');
			item.setNote('Original note');
			await item.saveTx();
			Zotero.UndoHistory.clear();

			item.setNote('Modified note');
			await item.saveTx({ undoAction: 'undo-action-edit-note' });
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
		describe("explicit action", function () {
			it("should use undoAction option from saveTx", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx({ undoAction: 'undo-action-change-type' });

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-change-type');
			});

			it("should use stageAction called inside a transaction", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				await Zotero.DB.executeTransaction(async function () {
					item.setField('title', 'Changed');
					await item.save();
					Zotero.UndoHistory.stageAction(
						'undo-action-edit-metadata', { count: 1 }
					);
				});

				let action = Zotero.UndoHistory.getUndoAction();
				assert.isNotNull(action);
				assert.equal(action.action, 'undo-action-edit-metadata');
				assert.deepEqual(action.actionArgs, { count: 1 });
			});

			it("should let the last stageAction call win", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				await Zotero.DB.executeTransaction(async function () {
					item.setField('title', 'Changed');
					await item.save();
					Zotero.UndoHistory.stageAction('undo-action-edit-metadata');
					Zotero.UndoHistory.stageAction('undo-action-change-type');
				});

				let action = Zotero.UndoHistory.getUndoAction();
				assert.equal(action.action, 'undo-action-change-type');
			});
		});

		describe("redo preservation", function () {
			it("should preserve action through undo/redo cycle", async function () {
				let item = await createDataObject('item', { title: 'Original' });
				Zotero.UndoHistory.clear();

				item.setField('title', 'Changed');
				await item.saveTx({
					undoAction: 'undo-action-edit-metadata',
					undoActionArgs: { count: 1 }
				});

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
				await item.saveTx({ undoAction: 'undo-action-edit-metadata' });

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
			await item.saveTx({ undoAction: 'undo-action-edit-creator' });
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
			await item.saveTx({ undoAction: 'undo-action-add-creator' });
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
			await item.saveTx({ undoAction: 'undo-action-remove-creator' });
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
			await item.saveTx({ undoAction: 'undo-action-edit-creator' });
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
			await item.saveTx({ undoAction: 'undo-action-edit-creator' });
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
			await item.saveTx({ undoAction: 'undo-action-reorder-creator' });
			assert.equal(item.getCreator(0).firstName, 'Second');
			assert.equal(item.getCreator(1).firstName, 'First');

			await Zotero.UndoHistory.undo();
			assert.equal(item.getCreator(0).firstName, 'First');
			assert.equal(item.getCreator(1).firstName, 'Second');

			await Zotero.UndoHistory.redo();
			assert.equal(item.getCreator(0).firstName, 'Second');
			assert.equal(item.getCreator(1).firstName, 'First');
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
				Zotero.UndoHistory.stageAction('undo-action-add-related');
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
				Zotero.UndoHistory.stageAction('undo-action-remove-related');
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

		it("should undo adding several related items in one transaction", async function () {
			let subject = await createDataObject('item', { title: 'Subject' });
			let relA = await createDataObject('item', { title: 'Rel A' });
			let relB = await createDataObject('item', { title: 'Rel B' });
			let relC = await createDataObject('item', { title: 'Rel C' });
			Zotero.UndoHistory.clear();

			await Zotero.DB.executeTransaction(async () => {
				Zotero.UndoHistory.stageAction('undo-action-add-related');
				for (let rel of [relA, relB, relC]) {
					subject.addRelatedItem(rel);
					await subject.save({ skipDateModifiedUpdate: true });
					rel.addRelatedItem(subject);
					await rel.save({ skipDateModifiedUpdate: true });
				}
			});

			assert.include(subject.relatedItems, relA.key);
			assert.include(subject.relatedItems, relB.key);
			assert.include(subject.relatedItems, relC.key);

			await Zotero.UndoHistory.undo();
			assert.notInclude(subject.relatedItems, relA.key);
			assert.notInclude(subject.relatedItems, relB.key);
			assert.notInclude(subject.relatedItems, relC.key);
			assert.notInclude(relA.relatedItems, subject.key);
			assert.notInclude(relB.relatedItems, subject.key);
			assert.notInclude(relC.relatedItems, subject.key);

			await Zotero.UndoHistory.redo();
			assert.include(subject.relatedItems, relA.key);
			assert.include(subject.relatedItems, relB.key);
			assert.include(subject.relatedItems, relC.key);
		});

		it("should not bump Date Modified when undoing or redoing Relate Items", async function () {
			let itemA = await createDataObject('item', { title: 'Item A' });
			let itemB = await createDataObject('item', { title: 'Item B' });

			// Pin both items to a known, old Date Modified so a bump is detectable
			let dateModified = '2020-01-01 00:00:00';
			itemA.dateModified = dateModified;
			await itemA.saveTx();
			itemB.dateModified = dateModified;
			await itemB.saveTx();
			Zotero.UndoHistory.clear();

			// Relate the items, suppressing Date Modified updates (mirrors relatedBox.js)
			await Zotero.DB.executeTransaction(async () => {
				Zotero.UndoHistory.stageAction('undo-action-add-related');
				itemA.addRelatedItem(itemB);
				await itemA.save({ skipDateModifiedUpdate: true });
				itemB.addRelatedItem(itemA);
				await itemB.save({ skipDateModifiedUpdate: true });
			});

			assert.equal(itemA.dateModified, dateModified);
			assert.equal(itemB.dateModified, dateModified);

			await Zotero.UndoHistory.undo();
			assert.notInclude(itemA.relatedItems, itemB.key);
			assert.notInclude(itemB.relatedItems, itemA.key);
			assert.equal(itemA.dateModified, dateModified, 'undo should not bump Item A Date Modified');
			assert.equal(itemB.dateModified, dateModified, 'undo should not bump Item B Date Modified');

			await Zotero.UndoHistory.redo();
			assert.include(itemA.relatedItems, itemB.key);
			assert.include(itemB.relatedItems, itemA.key);
			assert.equal(itemA.dateModified, dateModified, 'redo should not bump Item A Date Modified');
			assert.equal(itemB.dateModified, dateModified, 'redo should not bump Item B Date Modified');
		});
	});

	describe("staging guards", function () {
		it("should throw if stageChange is called outside a transaction", function () {
			assert.throws(
				() => Zotero.UndoHistory.stageChange({
					objectType: 'item',
					id: 1,
					libraryID: 1,
					key: 'AAAAAAAA',
					fields: {}
				}),
				/transaction/i
			);
		});

		it("should throw if stageAction is called outside a transaction", function () {
			assert.throws(
				() => Zotero.UndoHistory.stageAction('undo-action-edit-metadata'),
				/transaction/i
			);
		});
	});

	it("should not drop undo history when undo is requested during an undo", async function () {
		let item = await createDataObject('item', { title: 'Original' });
		Zotero.UndoHistory.clear();

		item.setField('title', 'Second');
		await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
		item.setField('title', 'Third');
		await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
		assert.equal(item.getField('title'), 'Third');

		let unblockFirstUndo = Zotero.Promise.defer();
		let firstUndoReachedTransaction = Zotero.Promise.defer();
		let executeTransaction = Zotero.DB.executeTransaction;
		let firstCall = true;
		let stub = sinon.stub(Zotero.DB, 'executeTransaction').callsFake(async function (func, options) {
			if (firstCall) {
				firstCall = false;
				firstUndoReachedTransaction.resolve();
				await unblockFirstUndo.promise;
			}
			return executeTransaction.call(this, func, options);
		});

		try {
			let firstUndo = Zotero.UndoHistory.undo();
			await firstUndoReachedTransaction.promise;
			let secondUndo = Zotero.UndoHistory.undo();
			unblockFirstUndo.resolve();
			await firstUndo;
			await secondUndo;
		}
		finally {
			stub.restore();
		}

		// Both undos should apply in turn (Third -> Second -> Original). Today the
		// second undo's synchronous staleness check runs while the first undo is
		// still parked in its transaction, so the still-current 'Third' makes the
		// second entry look stale and the whole history is cleared -- leaving the
		// title at 'Second'. Undo/redo need to be serialized so each step applies.
		assert.equal(item.getField('title'), 'Original',
			"a second undo issued mid-transaction should apply in turn, not be discarded as stale");
	});

	describe("stale snapshot application", function () {
		it("should not apply an undo snapshot over a concurrent committed edit", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			item.setField('title', 'User Edit');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			let activeTransactionStarted = Zotero.Promise.defer();
			let allowActiveTransactionToChangeItem = Zotero.Promise.defer();
			let activeTransaction = Zotero.DB.executeTransaction(async () => {
				activeTransactionStarted.resolve();
				await allowActiveTransactionToChangeItem.promise;
				item.setField('title', 'Concurrent Edit');
				await item.save();
			});

			await activeTransactionStarted.promise;
			let undo = Zotero.UndoHistory.undo();
			await Zotero.Promise.delay(1);
			allowActiveTransactionToChangeItem.resolve();
			await activeTransaction;
			await undo;

			assert.equal(item.getField('title'), 'Concurrent Edit',
				"undo should not clobber a change committed while it was waiting for the DB transaction");
		});

		it("should not clobber a later third-party change to the same field", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			// User edit, recorded on the undo stack as Original -> User Edit
			item.setField('title', 'User Edit');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// A plugin (or any non-UI writer) then changes the same field. No
			// undoAction, so no new entry is created -- but the existing entry's
			// snapshot (new: 'User Edit') no longer matches the object
			item.setField('title', 'Plugin Edit');
			await item.saveTx();

			await Zotero.UndoHistory.undo();

			// Undo should detect that the field drifted from the recorded value
			// and decline (or clear), not silently revert the plugin's change
			assert.equal(item.getField('title'), 'Plugin Edit',
				"undo should not apply a stale snapshot over a later change");
		});

		it("should not clobber a later third-party change when redoing", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			// User edit, recorded on the undo stack as Original -> User Edit
			item.setField('title', 'User Edit');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });

			// Undo it, moving the entry onto the redo stack. The redo entry now
			// expects the field to still read its recorded 'old' value (Original)
			await Zotero.UndoHistory.undo();
			assert.equal(item.getField('title'), 'Original');
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// A plugin then changes the same field. No undoAction, so no new entry
			// is created, and the redo stack is preserved -- but the object no
			// longer holds the value the redo entry expects
			item.setField('title', 'Plugin Edit');
			await item.saveTx();

			await Zotero.UndoHistory.redo();

			// Redo should detect that the field drifted from the recorded value and
			// decline, not silently replay 'User Edit' over the plugin's change
			assert.equal(item.getField('title'), 'Plugin Edit',
				"redo should not apply a stale snapshot over a later change");
		});

		it("should not clobber a later third-party tag change", async function () {
			let item = await createDataObject('item', { title: 'Tagged' });
			Zotero.UndoHistory.clear();

			// User edit, recorded on the undo stack as [] -> ['user-tag']
			item.addTag('user-tag');
			await item.saveTx({ undoAction: 'undo-action-add-tag', undoActionArgs: { count: 1 } });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// A plugin then swaps that tag for a different one with no undoAction:
			// the tag count is unchanged, so detection relies on comparing tag
			// identities rather than just the set size
			item.removeTag('user-tag');
			item.addTag('plugin-tag');
			await item.saveTx();

			await Zotero.UndoHistory.undo();

			// Undoing would reapply the recorded pre-edit tags (none), wiping the
			// plugin's tag. Detection should see the tags drifted and decline.
			assert.isTrue(item.hasTag('plugin-tag'),
				"undo should not clobber the later third-party tag");
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"a detected stale entry should be cleared");
		});

		it("should still apply undo when a third party only reordered the tags", async function () {
			let item = await createDataObject('item', { title: 'Tagged' });
			Zotero.UndoHistory.clear();

			// User edit recorded on the undo stack: [] -> ['alpha', 'beta', 'gamma']
			// (the recorded snapshot is sorted by setTags)
			item.addTag('alpha');
			item.addTag('beta');
			item.addTag('gamma');
			await item.saveTx({ undoAction: 'undo-action-add-tag', undoActionArgs: { count: 3 } });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// Simulate a third party that persisted the same three tags in a
			// different order. `_tags` is loaded in DB order while the snapshot is
			// sorted, so a reordered current state is a real possibility; the
			// staleness check compares the in-memory tags, so the simulated order
			// is what gets compared.
			let cached = Zotero.Items.get(item.id);
			cached._tags = [{ tag: 'gamma' }, { tag: 'alpha' }, { tag: 'beta' }];
			await Zotero.UndoHistory.undo();

			// Same set of tags, only reordered -> not a drift -> undo proceeds and
			// reverts to the recorded pre-edit state (no tags)
			assert.isFalse(item.hasTag('alpha'));
			assert.isFalse(item.hasTag('beta'));
			assert.isFalse(item.hasTag('gamma'));
			assert.isTrue(Zotero.UndoHistory.canRedo(),
				"undo should have applied, leaving the entry on the redo stack");
		});

		it("should still undo an accessDate edit recorded as the CURRENT_TIMESTAMP sentinel", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			// Setting accessDate to the CURRENT_TIMESTAMP sentinel resolves to a
			// real SQL timestamp at save time, which the save records as the
			// entry's 'new' value and reloads into memory. Nothing external
			// changed the field, so the staleness check sees the recorded
			// timestamp still in place and lets the undo proceed.
			item.setField('accessDate', 'CURRENT_TIMESTAMP');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			await Zotero.UndoHistory.undo();

			// Undo should apply and revert accessDate, not decline as stale and
			// throw away the history
			assert.isTrue(Zotero.UndoHistory.canRedo(),
				"undo should apply, not be declined as stale");
			assert.equal(item.getField('accessDate'), '',
				"undo should have reverted accessDate to its pre-edit (empty) value");
		});

		it("should decline a stale undo when a third party changed accessDate after a sentinel edit", async function () {
			let item = await createDataObject('item', { title: 'Original' });
			Zotero.UndoHistory.clear();

			// User edit: accessDate set via the CURRENT_TIMESTAMP sentinel, which
			// the save resolves to a real timestamp and records as the entry's
			// 'new' value so it can be compared later
			item.setField('accessDate', 'CURRENT_TIMESTAMP');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			assert.isTrue(Zotero.UndoHistory.canUndo());

			// A third party then changes accessDate to a different timestamp with
			// no undoAction, so no new entry is recorded -- but the existing
			// snapshot's resolved 'new' value no longer matches the field
			item.setField('accessDate', '2020-01-01 00:00:00');
			await item.saveTx();

			await Zotero.UndoHistory.undo();

			// The field drifted from the recorded (resolved) value, so undo should
			// decline rather than clobber the third party's accessDate
			assert.equal(item.getField('accessDate'), '2020-01-01 00:00:00',
				"undo should not clobber a third-party accessDate change made after a sentinel edit");
		});

		it("should still redo a type change whose gained field recorded a null old value", async function () {
			let caseTypeID = Zotero.ItemTypes.getID('case');
			let filmTypeID = Zotero.ItemTypes.getID('film');

			let item = await createDataObject('item', { itemType: 'case' });
			Zotero.UndoHistory.clear();

			// Change type Case -> Film and set a field that exists only on film.
			// setType() initializes the newly-valid film fields to null, so the
			// edit's recorded 'old' for `distributor` is null (not a real prior
			// value).
			item.setType(filmTypeID);
			item.setField('distributor', 'Acme Pictures');
			await item.saveTx({ undoAction: 'undo-action-change-type' });
			assert.equal(item.itemTypeID, filmTypeID);
			assert.equal(item.getField('distributor'), 'Acme Pictures');

			// Undo: Film -> Case, distributor dropped
			await Zotero.UndoHistory.undo();
			assert.equal(item.itemTypeID, caseTypeID);
			assert.isTrue(Zotero.UndoHistory.canRedo());

			// Nothing changed the item since the undo, so the entry is not stale
			// and the type change should replay. After the undo, distributor is
			// invalid on a case item and reads back as `false`, while the entry
			// recorded its 'old' as null -- a null-vs-false mismatch that must
			// not be mistaken for an external change.
			await Zotero.UndoHistory.redo();
			assert.equal(item.itemTypeID, filmTypeID,
				"redo should re-apply the type change, not decline as stale");
			assert.equal(item.getField('distributor'), 'Acme Pictures',
				"redo should restore the film-only field");
		});
	});

	describe("sync interaction", function () {
		var apiKey = Zotero.Utilities.randomString(24);
		var baseURL = "http://local.zotero/";
		var server;

		beforeEach(async function () {
			await resetData();
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
			server = sinon.fakeServer.create();
			server.autoRespond = true;
			await Zotero.Users.setCurrentUserID(1);
			await Zotero.Users.setCurrentUsername("A");
			Zotero.UndoHistory.clear();

			// Minimal pre-engine stubs (mirrors syncRunnerTest.js)
			server.respondWith("GET", baseURL + "keys/current", [200,
				{ "Content-Type": "application/json" },
				JSON.stringify({
					key: apiKey,
					userID: 1,
					username: "A",
					access: {
						user: { library: true, files: true, notes: true, write: true },
						groups: { all: { library: true, write: true } }
					}
				})]);
			server.respondWith("GET", baseURL + "users/1/groups?format=versions",
				[200, { "Content-Type": "application/json" }, "{}"]);
		});

		afterEach(function () {
			Zotero.HTTP.mock = null;
		});

		function setNoRemoteChangesResponses(lastLibraryVersion) {
			// Server reports library unmodified for every endpoint sync hits.
			let headers = { "Last-Modified-Version": lastLibraryVersion };
			let target = "users/1";
			let endpoints = [
				`${target}/settings?since=${lastLibraryVersion}`,
				`${target}/collections?format=versions&since=${lastLibraryVersion}`,
				`${target}/searches?format=versions&since=${lastLibraryVersion}`,
				`${target}/items/top?format=versions&since=${lastLibraryVersion}&includeTrashed=1`,
				`${target}/items?format=versions&since=${lastLibraryVersion}&includeTrashed=1`,
				`${target}/deleted?since=${lastLibraryVersion}`
			];
			for (let url of endpoints) {
				server.respondWith("GET", baseURL + url, [
					304, headers, ""
				]);
			}
			// Full-text sync probes this regardless of the data-sync result
			server.respondWith("GET", baseURL + `${target}/fulltext?format=versions`,
				[200, headers, "{}"]);
		}

		it("preserves the undo stack when sync has no remote changes to apply", async function () {
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			let item = await createDataObject('item', { title: 'Before' });
			Zotero.UndoHistory.clear();
			item.setField('title', 'After');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			assert.isTrue(Zotero.UndoHistory.canUndo(),
				"sanity: an undo entry exists before sync");

			// Re-mark synced so the upload phase is a no-op
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			assert.isTrue(Zotero.UndoHistory.canUndo(),
				"sanity: markObjectAsSynced did not clear the undo stack");

			setNoRemoteChangesResponses(lastLibraryVersion);

			let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
			await runner._sync({
				libraries: [library.libraryID],
				onError: e => { throw e; }
			});

			assert.isTrue(Zotero.UndoHistory.canUndo(),
				"undo stack should survive a sync with no remote changes");
		});

		it("clears the undo stack when _saveObjectFromJSON applies a remote object", async function () {
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			let newLibraryVersion = 6;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			let item = await createDataObject('item', { title: 'Before' });
			item.version = lastLibraryVersion;
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			let itemKey = item.key;

			let other = await createDataObject('item', { title: 'Other-before' });
			Zotero.UndoHistory.clear();
			other.setField('title', 'Other-after');
			await other.saveTx({ undoAction: 'undo-action-edit-metadata' });
			await Zotero.Sync.Data.Local.markObjectAsSynced(other);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			setNoRemoteChangesResponses(lastLibraryVersion);

			let libraryID = library.libraryID;
			let remoteJSON = [{
				key: itemKey,
				version: newLibraryVersion,
				data: Object.assign({}, item.toJSON(), {
					key: itemKey,
					version: newLibraryVersion,
					title: 'Remote-applied title'
				})
			}];
			let engineStub = sinon.stub(Zotero.Sync.Data.Engine.prototype, 'start')
				.callsFake(async function () {
					await Zotero.Sync.Data.Local.processObjectsFromJSON(
						'item', libraryID, remoteJSON, {}
					);
				});

			try {
				let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
				await runner._sync({
					libraries: [libraryID],
					onError: e => { throw e; }
				});
			}
			finally {
				engineStub.restore();
			}

			assert.equal(item.getField('title'), 'Remote-applied title',
				"sanity: remote data was applied via _saveObjectFromJSON");
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"undo stack should be cleared once _saveObjectFromJSON marks the sync");
		});

		it("clears the undo stack when sync applies a remote deletion", async function () {
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			let newLibraryVersion = 6;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			// An item that the server has deleted. Mark synced so the engine
			// treats it as a clean deletion rather than a deletion conflict.
			let item = await createDataObject('item', { title: 'Remote-deleted' });
			item.version = lastLibraryVersion;
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			let itemKey = item.key;

			// Separate undoable edit on a different item so the stack is
			// non-empty and unrelated to the deleted object.
			let other = await createDataObject('item', { title: 'Other-before' });
			Zotero.UndoHistory.clear();
			other.setField('title', 'Other-after');
			await other.saveTx({ undoAction: 'undo-action-edit-metadata' });
			await Zotero.Sync.Data.Local.markObjectAsSynced(other);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			let newHeaders = { "Last-Modified-Version": newLibraryVersion };
			let url = u => server.respondWith("GET", baseURL + u, [200, newHeaders, "{}"]);
			url(`users/1/settings?since=${lastLibraryVersion}`);
			url(`users/1/collections?format=versions&since=${lastLibraryVersion}`);
			url(`users/1/searches?format=versions&since=${lastLibraryVersion}`);
			url(`users/1/items/top?format=versions&since=${lastLibraryVersion}&includeTrashed=1`);
			url(`users/1/items?format=versions&since=${lastLibraryVersion}&includeTrashed=1`);
			url(`users/1/fulltext?format=versions`);

			// The deletion endpoint reports our item as remotely deleted
			server.respondWith("GET",
				baseURL + `users/1/deleted?since=${lastLibraryVersion}`,
				[200, newHeaders, JSON.stringify({
					items: [itemKey], collections: [], searches: [], tags: [], settings: []
				})]);

			let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
			await runner._sync({
				libraries: [library.libraryID],
				onError: e => { throw e; }
			});

			assert.isFalse(Zotero.Items.exists(item.id),
				"sanity: remote deletion was applied locally");
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"undo stack should be cleared when sync applies a remote deletion");
		});

		it("clears the undo stack when _restoreRestoredCollectionItems applies remote changes", async function () {
			// When a collection is deleted locally but modified remotely, sync re-creates
			// the collection (covered by _saveObjectFromJSON) and then separately un-trashes
			// items that were trashed with the collection and re-adds them to it. Both are
			// remote-driven mutations to user-visible item state and must clear the stack.
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			let collection = await createDataObject('collection', { name: 'Restored' });
			await Zotero.Sync.Data.Local.markObjectAsSynced(collection);
			let collectionKey = collection.key;

			let item = await createDataObject('item', { title: 'Restored item' });
			item.deleted = true;
			await item.saveTx();
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			let itemKey = item.key;

			let other = await createDataObject('item', { title: 'Other-before' });
			Zotero.UndoHistory.clear();
			other.setField('title', 'Other-after');
			await other.saveTx({ undoAction: 'undo-action-edit-metadata' });
			await Zotero.Sync.Data.Local.markObjectAsSynced(other);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			setNoRemoteChangesResponses(lastLibraryVersion);

			// _restoreRestoredCollectionItems queries top items in the restored collection
			server.respondWith("GET",
				baseURL + `users/1/collections/${collectionKey}/items/top?format=keys`,
				[200, { "Last-Modified-Version": lastLibraryVersion }, itemKey]);

			let libraryID = library.libraryID;
			let engineStub = sinon.stub(Zotero.Sync.Data.Engine.prototype, 'start')
				.callsFake(async function () {
					await this._restoreRestoredCollectionItems([collectionKey]);
				});

			try {
				let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
				await runner._sync({
					libraries: [libraryID],
					onError: e => { throw e; }
				});
			}
			finally {
				engineStub.restore();
			}

			let restored = Zotero.Items.get(item.id);
			assert.isFalse(restored.deleted,
				"sanity: trashed item was un-trashed by the restoration");
			assert.isTrue(restored.inCollection(collection.id),
				"sanity: item was re-added to the restored collection");
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"undo stack should be cleared when _restoreRestoredCollectionItems mutates items");
		});

		it("clears the undo stack across a restartSync recursion", async function () {
			// Regression: the recursive _sync() call resets the flag at its
			// start, so the conditional clear must happen before the restart
			// branch, not after.
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			let item = await createDataObject('item', { title: 'Before' });
			Zotero.UndoHistory.clear();
			item.setField('title', 'After');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			assert.isTrue(Zotero.UndoHistory.canUndo());

			setNoRemoteChangesResponses(lastLibraryVersion);

			// First engine iteration applies a remote change; the second is a no-op
			let callCount = 0;
			let engineStub = sinon.stub(Zotero.Sync.Data.Engine.prototype, 'start')
				.callsFake(async function () {
					if (callCount === 0) {
						Zotero.Sync.Data.Local.markRemoteChangesApplied();
					}
					callCount++;
				});

			try {
				let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
				await runner._sync({
					libraries: [library.libraryID],
					onError: e => { throw e; },
					restartSync: true
				});
			}
			finally {
				engineStub.restore();
			}

			assert.equal(callCount, 2,
				"sanity: engine.start ran twice (initial run + restart)");
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"undo stack should be cleared even when restartSync recurses");
		});

		it("should not apply a stale snapshot via undo while a sync is still running", async function () {
			// The undo stack is only cleared at the end of _sync(), so after a
			// remote change has been applied but before the sync finishes,
			// undo is still enabled and applies a snapshot that predates the
			// remote change, silently reverting it
			let library = Zotero.Libraries.userLibrary;
			let lastLibraryVersion = 5;
			let newLibraryVersion = 6;
			library.libraryVersion = library.storageVersion = lastLibraryVersion;
			await library.saveTx();

			// Undoable user edit: Before -> After
			let item = await createDataObject('item', { title: 'Before' });
			Zotero.UndoHistory.clear();
			item.setField('title', 'After');
			await item.saveTx({ undoAction: 'undo-action-edit-metadata' });
			item.version = lastLibraryVersion;
			await Zotero.Sync.Data.Local.markObjectAsSynced(item);
			let itemKey = item.key;
			assert.isTrue(Zotero.UndoHistory.canUndo());

			setNoRemoteChangesResponses(lastLibraryVersion);

			let libraryID = library.libraryID;
			let remoteJSON = [{
				key: itemKey,
				version: newLibraryVersion,
				data: Object.assign({}, item.toJSON(), {
					key: itemKey,
					version: newLibraryVersion,
					title: 'Remote Edit'
				})
			}];
			let engineStub = sinon.stub(Zotero.Sync.Data.Engine.prototype, 'start')
				.callsFake(async function () {
					// Remote change lands on the same item the undo entry covers
					await Zotero.Sync.Data.Local.processObjectsFromJSON(
						'item', libraryID, remoteJSON, {}
					);
					assert.equal(item.getField('title'), 'Remote Edit',
						"sanity: remote data was applied");
					// User presses Cmd+Z while the sync is still in progress
					await Zotero.UndoHistory.undo();
				});

			try {
				let runner = new Zotero.Sync.Runner_Module({ baseURL, apiKey });
				await runner._sync({
					libraries: [libraryID],
					onError: e => { throw e; }
				});
			}
			finally {
				engineStub.restore();
			}

			assert.equal(item.getField('title'), 'Remote Edit',
				"mid-sync undo should not revert a remote change that was already applied");
		});
	});

	describe("step limit pref", function () {
		afterEach(function () {
			Zotero.Prefs.clear('undoHistory.steps');
			Zotero.UndoHistory.init();
		});

		it("should disable capture when undoHistory.steps is 0", async function () {
			Zotero.Prefs.set('undoHistory.steps', 0);
			Zotero.UndoHistory.init();

			let collection = await createDataObject('collection', { name: 'Original' });
			collection.name = 'Modified';
			await collection.saveTx({ undoAction: 'undo-action-rename-collection' });

			assert.equal(collection.name, 'Modified');
			assert.isFalse(Zotero.UndoHistory.canUndo(),
				"a configured step limit of 0 should disable undo/redo, not fall back to the default");
		});

		it("should cap the undo stack at undoHistory.steps entries", async function () {
			Zotero.Prefs.set('undoHistory.steps', 2);
			Zotero.UndoHistory.init();

			let collection = await createDataObject('collection', { name: 'Original' });
			for (let name of ['First', 'Second', 'Third']) {
				collection.name = name;
				await collection.saveTx({ undoAction: 'undo-action-rename-collection' });
			}

			// Three edits, limit of 2: only the two most recent are undoable
			assert.isTrue(await Zotero.UndoHistory.undo());
			assert.isTrue(await Zotero.UndoHistory.undo());
			assert.isFalse(await Zotero.UndoHistory.undo());
			assert.equal(collection.name, 'First');
		});
	});
});
