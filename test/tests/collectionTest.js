"use strict";

describe("Zotero.Collection", function() {
	describe("#save()", function () {
		it("should save a new collection", function* () {
			var name = "Test";
			var collection = new Zotero.Collection;
			collection.name = name;
			var id = yield collection.saveTx();
			assert.equal(collection.name, name);
			collection = yield Zotero.Collections.getAsync(id);
			assert.equal(collection.name, name);
		});
	})
	
	describe("#version", function () {
		it("should set object version", function* () {
			var version = 100;
			var collection = new Zotero.Collection
			collection.version = version;
			collection.name = "Test";
			var id = yield collection.saveTx();
			assert.equal(collection.version, version);
			collection = yield Zotero.Collections.getAsync(id);
			assert.equal(collection.version, version);
		});
	})
	
	describe("#parentKey", function () {
		it("should set parent collection for new collections", function* () {
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = yield parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = yield col.saveTx();
			assert.equal(col.parentKey, parentKey);
			col = yield Zotero.Collections.getAsync(id);
			assert.equal(col.parentKey, parentKey);
		});
		
		it("should change parent collection for existing collections", function* () {
			// Create initial parent collection
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = yield parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			// Create subcollection
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = yield col.saveTx();
			
			// Create new parent collection
			var newParentCol = new Zotero.Collection
			newParentCol.name = "New Parent";
			var newParentID = yield newParentCol.saveTx();
			var {libraryID, key: newParentKey} = Zotero.Collections.getLibraryAndKeyFromID(newParentID);
			
			// Change parent collection
			col.parentKey = newParentKey;
			yield col.saveTx();
			assert.equal(col.parentKey, newParentKey);
			col = yield Zotero.Collections.getAsync(id);
			assert.equal(col.parentKey, newParentKey);
		});
		
		it("should not mark collection as unchanged if set to existing value", function* () {
			// Create initial parent collection
			var parentCol = new Zotero.Collection
			parentCol.name = "Parent";
			var parentID = yield parentCol.saveTx();
			var {libraryID, key: parentKey} = Zotero.Collections.getLibraryAndKeyFromID(parentID);
			
			// Create subcollection
			var col = new Zotero.Collection
			col.name = "Child";
			col.parentKey = parentKey;
			var id = yield col.saveTx();
			
			// Set to existing parent
			col.parentKey = parentKey;
			assert.isFalse(col.hasChanged());
		});
		
		it("should not resave a collection with no parent if set to false", function* () {
			var col = new Zotero.Collection
			col.name = "Test";
			var id = yield col.saveTx();
			
			col.parentKey = false;
			var ret = yield col.saveTx();
			assert.isFalse(ret);
		});
	})
})
