"use strict";

describe("Zotero.CollectionTreeView", function() {
	var win, collectionsView;
	
	// Select library
	// TODO: Add a selectCollection() function and select a collection instead
	var resetSelection = Zotero.Promise.coroutine(function* () {
		yield collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
		yield waitForItemsLoad(win);
		assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
	});
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		collectionsView = win.ZoteroPane.collectionsView;
	});
	beforeEach(function () {
		return resetSelection();
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
			
			yield resetSelection();
			
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
			var cv = win.ZoteroPane.collectionsView;
			
			var search = new Zotero.Search;
			search.name = "A Test Search";
			search.addCondition('title', 'contains', 'test');
			var searchID = yield search.saveTx();
			
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
		it("should add an item to a collection", function* () {
			var collection = yield createDataObject('collection', false, {
				skipSelect: true
			});
			var item = yield createDataObject('item', false, {
				skipSelect: true
			});
			var row = collectionsView.getRowByID("C" + collection.id);
			
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
			
			// Simulate a drag and drop
			var stub = sinon.stub(Zotero.DragDrop, "getDragTarget");
			stub.returns(collectionsView.getRow(row));
			collectionsView.drop(row, 0, {
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
						return "" + item.id;
					}
				}
			})
			
			yield deferred.promise;
			stub.restore();
			Zotero.Notifier.unregisterObserver(observerID);
			yield collectionsView.selectCollection(collection.id);
			yield waitForItemsLoad(win);
			
			var itemsView = win.ZoteroPane.itemsView
			assert.equal(itemsView.rowCount, 1);
			var treeRow = itemsView.getRow(0);
			assert.equal(treeRow.ref.id, item.id);
		})
		
		it("should add an item to a library", function* () {
			var group = new Zotero.Group;
			group.id = 75161251;
			group.name = "Test";
			group.description = "";
			group.editable = true;
			group.filesEditable = true;
			group.version = 1234;
			yield group.save();
			
			var item = yield createDataObject('item', false, {
				skipSelect: true
			});
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachmentID = yield Zotero.Attachments.importFromFile({
				file: file,
				parentItemID: item.id
			});
			
			var row = collectionsView.getRowByID("L" + group.libraryID);
			
			// Simulate a drag and drop
			var stub = sinon.stub(Zotero.DragDrop, "getDragTarget");
			stub.returns(collectionsView.getRow(row));
			collectionsView.drop(row, 0, {
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
						return "" + item.id;
					}
				}
			});
			
			// Add observer to wait for collection add
			var ids = yield waitForItemEvent("add");
			
			stub.restore();
			yield collectionsView.selectLibrary(group.libraryID);
			yield waitForItemsLoad(win);
			
			var itemsView = win.ZoteroPane.itemsView
			assert.equal(itemsView.rowCount, 1);
			var treeRow = itemsView.getRow(0);
			assert.equal(treeRow.ref.id, ids[0]);
		})
	})
})
