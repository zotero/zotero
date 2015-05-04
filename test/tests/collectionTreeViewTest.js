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
			var id = yield collection.save();
			
			// New collection should be selected
			yield Zotero.Promise.delay(100);
			var selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		it("shouldn't select a new collection if skipNotifier is passed", function* () {
			resetSelection();
			
			// Create collection with skipNotifier flag
			var collection = new Zotero.Collection;
			collection.name = "No select on skipNotifier";
			var id = yield collection.save({
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
			var id = yield collection.save({
				skipSelect: true
			});
			
			// Library should still be selected
			assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
		});
		
		it("shouldn't select a modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "No select on modify";
			var id = yield collection.save();
			collection = yield Zotero.Collections.getAsync(id);
			yield Zotero.Promise.delay(100);
			
			resetSelection();
			
			collection.name = "No select on modify 2";
			yield collection.save();
			
			// Modified collection should not be selected
			yield Zotero.Promise.delay(100);
			assert.equal(collectionsView.getSelectedLibraryID(), Zotero.Libraries.userLibraryID);
		});
		
		it("should reselect a selected modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Reselect on modify";
			var id = yield collection.save();
			collection = yield Zotero.Collections.getAsync(id);
			yield Zotero.Promise.delay(100);
			
			var selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
			
			collection.name = "Reselect on modify 2";
			yield collection.save();
			
			// Modified collection should still be selected
			yield Zotero.Promise.delay(100);
			selected = collectionsView.getSelectedCollection(true);
			assert.equal(selected, id);
		});
	})
})
