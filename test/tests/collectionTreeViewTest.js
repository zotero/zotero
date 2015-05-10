"use strict";

describe("Zotero.CollectionTreeView", function() {
	var win, collectionsView;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		collectionsView = win.ZoteroPane.collectionsView;
	});
	after(function () {
		win.close();
	});
	
	// Select library
	// TODO: Add a selectCollection() function and select a collection instead
	var resetSelection = function () {
		collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
		assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
	}
	
	describe("#notify()", function () {
		it("should select a new collection", function* () {
			resetSelection();
			
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Select new collection";
			var id = yield collection.saveTx();
			
			// New collection should be selected
			var selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		it("shouldn't select a new collection if skipNotifier is passed", function* () {
			resetSelection();
			
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
			resetSelection();
			
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
			collection = yield Zotero.Collections.getAsync(id);
			
			resetSelection();
			
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
			collection = yield Zotero.Collections.getAsync(id);
			
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
})
