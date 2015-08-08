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
	
	describe("#hasChildCollections()", function () {
		it("should be false if child made top-level", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			
			assert.isTrue(collection1.hasChildCollections());
			collection2.parentKey = false;
			yield collection2.saveTx();
			assert.isFalse(collection1.hasChildCollections());
		})
		
		it("should be false if child moved to another collection", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			var collection3 = yield createDataObject('collection');
			
			assert.isTrue(collection1.hasChildCollections());
			collection2.parentKey = collection3.key;
			yield collection2.saveTx();
			assert.isFalse(collection1.hasChildCollections());
		})
	})
	
	describe("#getChildCollections()", function () {
		it("should include child collections", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			yield collection1.saveTx();
			
			yield collection1.loadChildCollections();
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 1);
			assert.equal(childCollections[0].id, collection2.id);
		})
		
		it("should not include collections that have been removed", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			yield collection1.saveTx();
			
			yield collection1.loadChildCollections();
			
			collection2.parentID = false;
			yield collection2.save()
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 0);
		})
	})
	
	describe("#getChildItems()", function () {
		it("should include child items", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.addToCollection(collection.key);
			yield item.saveTx();
			
			yield collection.loadChildItems();
			assert.lengthOf(collection.getChildItems(), 1);
		})
		
		it("should not include items in trash by default", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			yield item.saveTx();
			
			yield collection.loadChildItems();
			assert.lengthOf(collection.getChildItems(), 0);
		})
		
		it("should include items in trash if includeTrashed=true", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			yield item.saveTx();
			
			yield collection.loadChildItems();
			assert.lengthOf(collection.getChildItems(false, true), 1);
		})
	})
})
