"use strict";

describe("Zotero.DataObject", function() {
	var types = ['collection', 'item', 'search'];
	
	describe("#loadAllData()", function () {
		it("should load data on a regular item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.throws(item.getNote.bind(item), 'getNote() can only be called on notes and attachments');
		})
		
		it("should load data on an attachment item", function* () {
			var item = new Zotero.Item('attachment');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.equal(item.getNote(), '');
		})
		
		it("should load data on a note item", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.equal(item.getNote(), '');
		})
	})
	
	describe("#version", function () {
		it("should be set to 0 after creating object", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type);
				assert.equal(obj.version, 0);
				yield obj.eraseTx();
			}
		})
		
		it("should be set after creating object", function* () {
			for (let type of types) {
				Zotero.logError(type);
				let obj = yield createDataObject(type, { version: 1234 });
				assert.equal(obj.version, 1234, type + " version mismatch");
				yield obj.eraseTx();
			}
		})
	})
	
	describe("#synced", function () {
		it("should be set to false after creating item", function* () {
			var item = new Zotero.Item("book");
			var id = yield item.saveTx();
			assert.isFalse(item.synced);
			yield item.eraseTx();
		});
		
		it("should be set to true when changed", function* () {
			var item = new Zotero.Item("book");
			var id = yield item.saveTx();
			
			item.synced = 1;
			yield item.saveTx();
			assert.ok(item.synced);
			
			yield item.eraseTx();
		});
		
		it("should be set to false after modifying item", function* () {
			var item = new Zotero.Item("book");
			var id = yield item.saveTx();
			
			item.synced = 1;
			yield item.saveTx();
			
			yield item.loadItemData();
			item.setField('title', 'test');
			yield item.saveTx();
			assert.isFalse(item.synced);
			
			yield item.eraseTx();
		});
		
		it("should be unchanged if skipSyncedUpdate passed", function* () {
			var item = new Zotero.Item("book");
			var id = yield item.saveTx();
			
			item.synced = 1;
			yield item.saveTx();
			
			yield item.loadItemData();
			item.setField('title', 'test');
			yield item.saveTx({
				skipSyncedUpdate: true
			});
			assert.ok(item.synced);
			
			yield item.eraseTx();
		});
	})
	
	describe("#save()", function () {
		it("should add new identifiers to cache", function* () {
			// Collection
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('collection');
			var obj = new Zotero.Collection;
			obj.name = "Test";
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Search
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('search');
			var obj = new Zotero.Search;
			obj.name = "Test";
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Item
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('item');
			var obj = new Zotero.Item('book');
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
		})
	})
})
