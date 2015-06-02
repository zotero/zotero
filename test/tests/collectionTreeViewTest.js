"use strict";

describe("Zotero.CollectionTreeView", function() {
	var win, collectionsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		collectionsView = win.ZoteroPane.collectionsView;
	});
	beforeEach(function () {
		// TODO: Add a selectCollection() function and select a collection instead?
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	});
	
	describe("collapse/expand", function () {
		it("should close and open My Library repeatedly", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var cv = collectionsView;
			yield cv.selectLibrary(libraryID);
			var row = cv.selection.currentIndex;
			
			cv.collapseLibrary(libraryID);
			var nextRow = cv.getRow(row + 1);
			assert.equal(cv.selection.currentIndex, row);
			assert.ok(nextRow.isSeparator());
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandLibrary(libraryID);
			nextRow = cv.getRow(row + 1);
			assert.equal(cv.selection.currentIndex, row);
			assert.ok(!nextRow.isSeparator());
			assert.ok(cv.isContainerOpen(row));
			
			cv.collapseLibrary(libraryID);
			nextRow = cv.getRow(row + 1);
			assert.equal(cv.selection.currentIndex, row);
			assert.ok(nextRow.isSeparator());
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandLibrary(libraryID);
			nextRow = cv.getRow(row + 1);
			assert.equal(cv.selection.currentIndex, row);
			assert.ok(!nextRow.isSeparator());
			assert.ok(cv.isContainerOpen(row));
		})
	})
	
	describe("#expandToCollection()", function () {
		it("should expand a collection to a subcollection", function* () {
			var cv = collectionsView;
			var collection1 = yield createDataObject('collection');
			var collection2 = createUnsavedDataObject('collection');
			collection2.parentID = collection1.id;
			yield collection2.saveTx({
				skipSelect: true
			});
			var row = cv.getRowIndexByID("C" + collection1.id);
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandToCollection(collection2.id);
			
			// Make sure parent row position hasn't changed
			assert.equal(cv.getRowIndexByID("C" + collection1.id), row);
			// Parent should have been opened
			assert.isTrue(cv.isContainerOpen(row));
		})
	})
	
	describe("#selectByID()", function () {
		it("should select the trash", function* () {
			yield collectionsView.selectByID("T1");
			var row = collectionsView.selection.currentIndex;
			var treeRow = collectionsView.getRow(row);
			assert.ok(treeRow.isTrash());
			assert.equal(treeRow.ref.libraryID, Zotero.Libraries.userLibraryID);
		})
	})
	
	describe("#selectWait()", function () {
		it("shouldn't hang if row is already selected", function* () {
			var row = collectionsView.getRowIndexByID("T" + Zotero.Libraries.userLibraryID);
			collectionsView.selection.select(row);
			yield Zotero.Promise.delay(50);
			yield collectionsView.selectWait(row);
		})
	})
	
	describe("#notify()", function () {
		it("should select a new collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Select new collection";
			var id = yield collection.saveTx();
			
			// New collection should be selected
			var selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		it("shouldn't select a new collection if skipNotifier is passed", function* () {
			// Create collection with skipNotifier flag
			var collection = new Zotero.Collection;
			collection.name = "No select on skipNotifier";
			var id = yield collection.saveTx({
				skipNotifier: true
			});
			
			// Library should still be selected
			assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
		});
		
		it("shouldn't select a new collection if skipSelect is passed", function* () {
			// Create collection with skipSelect flag
			var collection = new Zotero.Collection;
			collection.name = "No select on skipSelect";
			var id = yield collection.saveTx({
				skipSelect: true
			});
			
			// Library should still be selected
			assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
		});
		
		it("shouldn't select a modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "No select on modify";
			var id = yield collection.saveTx();
			
			yield selectLibrary(win);
			
			collection.name = "No select on modify 2";
			yield collection.saveTx();
			
			// Modified collection should not be selected
			assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
		});
		
		it("should reselect a selected modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Reselect on modify";
			var id = yield collection.saveTx();
			
			var selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
			
			collection.name = "Reselect on modify 2";
			yield collection.saveTx();
			
			// Modified collection should still be selected
			selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		it("should add a saved search after collections", function* () {
			var collection = new Zotero.Collection;
			collection.name = "Test";
			var collectionID = yield collection.saveTx();
			
			var search = new Zotero.Search;
			search.name = "A Test Search";
			search.addCondition('title', 'contains', 'test');
			var searchID = yield search.saveTx();
			
			var cv = win.ZoteroPane.collectionsView;
			var collectionRow = cv._rowMap["C" + collectionID];
			var searchRow = cv._rowMap["S" + searchID];
			var duplicatesRow = cv._rowMap["D" + Zotero.Libraries.userLibraryID];
			var unfiledRow = cv._rowMap["U" + Zotero.Libraries.userLibraryID];
			
			assert.isAbove(searchRow, collectionRow);
			// If there's a duplicates row or an unfiled row, add before those.
			// Otherwise, add before the trash
			if (duplicatesRow !== undefined) {
				assert.isBelow(searchRow, duplicatesRow);
			}
			else if (unfiledRow !== undefined) {
				assert.isBelow(searchRow, unfiledRow);
			}
			else {
				var trashRow = cv._rowMap["T" + Zotero.Libraries.userLibraryID];
				assert.isBelow(searchRow, trashRow);
			}
		})
	})
	
	describe("#drop()", function () {
		/**
		 * Simulate a drag and drop
		 *
		 * @param {String} targetRowID - Tree row id (e.g., "L123")
		 * @param {Integer[]} itemIDs
		 * @param {Promise} [promise] - If a promise is provided, it will be waited for and its
		 *                              value returned after the drag. Otherwise, an item 'add'
		 *                              event will be waited for, and the added ids will be
		 *                              returned.
		 */
		var drop = Zotero.Promise.coroutine(function* (targetRowID, itemIDs, promise) {
			var row = collectionsView.getRowIndexByID(targetRowID);
			
			var stub = sinon.stub(Zotero.DragDrop, "getDragTarget");
			stub.returns(collectionsView.getRow(row));
			if (!promise) {
				promise = waitForItemEvent("add");
			}
			yield collectionsView.drop(row, 0, {
				dropEffect: 'copy',
				effectAllowed: 'copy',
				mozSourceNode: win.document.getElementById('zotero-items-tree'),
				types: {
					contains: function (type) {
						return type == 'zotero/item';
					}
				},
				getData: function (type) {
					if (type == 'zotero/item') {
						return itemIDs.join(",");
					}
				}
			});
			
			// Add observer to wait for add
			var result = yield promise;
			stub.restore();
			return result;
		});
		
		
		var canDrop = Zotero.Promise.coroutine(function* (targetRowID, itemIDs) {
			var row = collectionsView.getRowIndexByID(targetRowID);
			
			var stub = sinon.stub(Zotero.DragDrop, "getDragTarget");
			stub.returns(collectionsView.getRow(row));
			var dt = {
				dropEffect: 'copy',
				effectAllowed: 'copy',
				mozSourceNode: win.document.getElementById('zotero-items-tree'),
				types: {
					contains: function (type) {
						return type == 'zotero/item';
					}
				},
				getData: function (type) {
					if (type == 'zotero/item') {
						return itemIDs.join(",");
					}
				}
			};
			var canDrop = collectionsView.canDropCheck(row, 0, dt);
			if (canDrop) {
				canDrop = yield collectionsView.canDropCheckAsync(row, 0, dt);
			}
			stub.restore();
			return canDrop;
		});
		
		
		it("should add an item to a collection", function* () {
			var collection = yield createDataObject('collection', false, { skipSelect: true });
			var item = yield createDataObject('item', false, { skipSelect: true });
			
			// Add observer to wait for collection add
			var deferred = Zotero.Promise.defer();
			var observerID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids) {
					if (type == 'collection-item' && event == 'add'
							&& ids[0] == collection.id + "-" + item.id) {
						setTimeout(function () {
							deferred.resolve();
						});
					}
				}
			}, 'collection-item', 'test');
			
			var ids = yield drop("C" + collection.id, [item.id], deferred.promise);
			
			Zotero.Notifier.unregisterObserver(observerID);
			
			yield collectionsView.selectCollection(collection.id);
			yield waitForItemsLoad(win);
			
			var itemsView = win.ZoteroPane.itemsView
			assert.equal(itemsView.rowCount, 1);
			var treeRow = itemsView.getRow(0);
			assert.equal(treeRow.ref.id, item.id);
		})
		
		it("should copy an item with an attachment to a group", function* () {
			var group = yield createGroup();
			
			var item = yield createDataObject('item', false, { skipSelect: true });
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: item.id
			});
			
			// Hack to unload relations to test proper loading
			//
			// Probably need a better method for this
			item._loaded.relations = false;
			attachment._loaded.relations = false;
			
			var ids = yield drop("L" + group.libraryID, [item.id]);
			
			yield collectionsView.selectLibrary(group.libraryID);
			yield waitForItemsLoad(win);
			
			// Check parent
			var itemsView = win.ZoteroPane.itemsView;
			assert.equal(itemsView.rowCount, 1);
			var treeRow = itemsView.getRow(0);
			assert.equal(treeRow.ref.libraryID, group.libraryID);
			assert.equal(treeRow.ref.id, ids[0]);
			// New item should link back to original
			var linked = yield item.getLinkedItem(group.libraryID);
			assert.equal(linked.id, treeRow.ref.id);
			
			// Check attachment
			assert.isTrue(itemsView.isContainer(0));
			yield itemsView.toggleOpenState(0);
			assert.equal(itemsView.rowCount, 2);
			treeRow = itemsView.getRow(1);
			assert.equal(treeRow.ref.id, ids[1]);
			// New attachment should link back to original
			linked = yield attachment.getLinkedItem(group.libraryID);
			assert.equal(linked.id, treeRow.ref.id);
			
			yield group.erase()
		})
		
		it("should not copy an item or its attachment to a group twice", function* () {
			var group = yield getGroup();
			
			var itemTitle = Zotero.Utilities.randomString();
			var item = yield createDataObject('item', false, { skipSelect: true });
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment = yield Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: item.id
			});
			var attachmentTitle = Zotero.Utilities.randomString();
			attachment.setField('title', attachmentTitle);
			yield attachment.saveTx();
			
			var ids = yield drop("L" + group.libraryID, [item.id]);
			assert.isFalse(yield canDrop("L" + group.libraryID, [item.id]));
		})
		
		it("should remove a linked, trashed item in a group from the trash and collections", function* () {
			var group = yield getGroup();
			var collection = yield createDataObject('collection', { libraryID: group.libraryID });
			
			var item = yield createDataObject('item', false, { skipSelect: true });
			var ids = yield drop("L" + group.libraryID, [item.id]);
			
			var droppedItem = yield item.getLinkedItem(group.libraryID);
			droppedItem.setCollections([collection.id]);
			droppedItem.deleted = true;
			yield droppedItem.saveTx();
			
			// Add observer to wait for collection add
			var deferred = Zotero.Promise.defer();
			var observerID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids) {
					if (event == 'refresh' && type == 'trash' && ids[0] == group.libraryID) {
						setTimeout(function () {
							deferred.resolve();
						});
					}
				}
			}, 'trash', 'test');
			var ids = yield drop("L" + group.libraryID, [item.id], deferred.promise);
			Zotero.Notifier.unregisterObserver(observerID);
			
			assert.isFalse(droppedItem.deleted);
			// Should be removed from collections when removed from trash
			assert.lengthOf(droppedItem.getCollections(), 0);
		})
	})
})
