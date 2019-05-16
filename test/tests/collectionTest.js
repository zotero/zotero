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
	
	describe("#erase()", function () {
		it("should delete a collection but not its descendant item by default", function* () {
			var collection = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [collection.id] });
			assert.isTrue(collection.hasItem(item.id));
			
			yield collection.eraseTx();
			
			assert.isFalse((yield Zotero.Items.getAsync(item.id)).deleted);
		})
		
		it("should delete a collection and trash its descendant items with deleteItems: true", function* () {
			var collection = yield createDataObject('collection');
			var item1 = yield createDataObject('item', { collections: [collection.id] });
			var item2 = yield createDataObject('item', { collections: [collection.id] });
			assert.isTrue(collection.hasItem(item1.id));
			assert.isTrue(collection.hasItem(item2.id));
			
			yield collection.eraseTx({ deleteItems: true });
			
			assert.isTrue((yield Zotero.Items.getAsync(item1.id)).deleted);
			assert.isTrue((yield Zotero.Items.getAsync(item2.id)).deleted);
		});
		
		it("should clear collection from item cache", function* () {
			var collection = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [collection.id] });
			assert.lengthOf(item.getCollections(), 1);
			yield collection.eraseTx();
			assert.lengthOf(item.getCollections(), 0);
		});
		
		it("should clear subcollection from descendent item cache", function* () {
			var collection = yield createDataObject('collection');
			var subcollection = yield createDataObject('collection', { parentID: collection.id });
			var item = yield createDataObject('item', { collections: [subcollection.id] });
			assert.lengthOf(item.getCollections(), 1);
			yield collection.eraseTx();
			assert.lengthOf(item.getCollections(), 0);
		});
		
		it("should clear collection from item cache in deleteItems mode", function* () {
			var collection = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [collection.id] });
			assert.lengthOf(item.getCollections(), 1);
			yield collection.eraseTx({ deleteItems: true });
			assert.lengthOf(item.getCollections(), 0);
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
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 1);
			assert.equal(childCollections[0].id, collection2.id);
		})
		
		it("should not include collections that have been removed", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			yield collection1.saveTx();
			
			collection2.parentID = false;
			yield collection2.save()
			
			var childCollections = collection1.getChildCollections();
			assert.lengthOf(childCollections, 0);
		})
		
		it("should not include collections that have been deleted", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection', { parentID: collection1.id });
			yield collection1.saveTx();
			
			yield collection2.eraseTx()
			
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
			
			assert.lengthOf(collection.getChildItems(), 1);
		})
		
		it("should not include items in trash by default", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			yield item.saveTx();
			
			assert.lengthOf(collection.getChildItems(), 0);
		})
		
		it("should include items in trash if includeTrashed=true", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			item.addToCollection(collection.key);
			yield item.saveTx();
			
			assert.lengthOf(collection.getChildItems(false, true), 1);
		})
		
		it("should not include removed items", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [ col.id ] });
			assert.lengthOf(col.getChildItems(), 1);
			item.setCollections([]);
			yield item.saveTx();
			Zotero.debug(col.getChildItems());
			assert.lengthOf(col.getChildItems(), 0);
		});
		
		it("should not include deleted items", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [ col.id ] });
			assert.lengthOf(col.getChildItems(), 1);
			yield item.erase();
			assert.lengthOf(col.getChildItems(), 0);
		});
		
		it("should not include items emptied from trash", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [ col.id ], deleted: true });
			yield item.erase();
			assert.lengthOf(col.getChildItems(), 0);
		});
	})
	
	describe("#fromJSON()", function () {
		it("should ignore unknown property in non-strict mode", function () {
			var json = {
				name: "Collection",
				foo: "Bar"
			};
			var s = new Zotero.Collection();
			s.fromJSON(json);
		});
		
		it("should throw on unknown property in strict mode", function () {
			var json = {
				name: "Collection",
				foo: "Bar"
			};
			var s = new Zotero.Collection();
			var f = () => {
				s.fromJSON(json, { strict: true });
			};
			assert.throws(f, /^Unknown collection property/);
		});
	});
	
	describe("#toJSON()", function () {
		it("should set 'parentCollection' to false when cleared", function* () {
			var col1 = yield createDataObject('collection');
			var col2 = yield createDataObject('collection', { parentID: col1.id });
			// Create initial JSON with parentCollection
			var patchBase = col2.toJSON();
			// Clear parent collection and regenerate JSON
			col2.parentID = false;
			var json = col2.toJSON({ patchBase });
			assert.isFalse(json.parentCollection);
		});
	});
	
	describe("#getDescendents()", function () {
		var collection0, collection1, collection2, collection3, item1, item2, item3;
		
		before(function* () {
			collection0 = yield createDataObject('collection');
			item1 = yield createDataObject('item', { collections: [collection0.id] });
			collection1 = yield createDataObject('collection', { parentKey: collection0.key });
			item2 = yield createDataObject('item', { collections: [collection1.id] });
			collection2 = yield createDataObject('collection', { parentKey: collection1.key });
			collection3 = yield createDataObject('collection', { parentKey: collection1.key });
			item3 = yield createDataObject('item', { collections: [collection2.id] });
			item3.deleted = true;
			yield item3.saveTx();
		});
		
		it("should return a flat array of collections and items", function* () {
			var desc = collection0.getDescendents();
			assert.lengthOf(desc, 5);
			assert.sameMembers(
				desc.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item1.id + '::' + collection0.id,
					'item:' + item2.id + '::' + collection1.id,
					'collection:' + collection1.id + ':' + collection1.name + ':' + collection0.id,
					'collection:' + collection2.id + ':' + collection2.name + ':' + collection1.id,
					'collection:' + collection3.id + ':' + collection3.name + ':' + collection1.id
				]
			);
		});
		
		it("should return nested arrays of collections and items", function* () {
			var desc = collection0.getDescendents(true);
			assert.lengthOf(desc, 2);
			assert.sameMembers(
				desc.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item1.id + '::' + collection0.id,
					'collection:' + collection1.id + ':' + collection1.name + ':' + collection0.id,
				]
			);
			var c = desc[0].type == 'collection' ? desc[0] : desc[1];
			assert.lengthOf(c.children, 3);
			assert.sameMembers(
				c.children.map(x => x.type + ':' + x.id + ':' + (x.name || '') + ':' + x.parent),
				[
					'item:' + item2.id + '::' + collection1.id,
					'collection:' + collection2.id + ':' + collection2.name + ':' + collection1.id,
					'collection:' + collection3.id + ':' + collection3.name + ':' + collection1.id
				]
			);
		});
		
		it("should not include deleted items", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [col.id] });
			assert.lengthOf(col.getDescendents(), 1);
			yield item.eraseTx();
			assert.lengthOf(col.getDescendents(), 0);
		});

	});
})
