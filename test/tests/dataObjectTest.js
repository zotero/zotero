"use strict";

describe("Zotero.DataObject", function() {
	var types = ['collection', 'item', 'search'];
	
	describe("#save()", function () {
		it("should add new identifiers to cache", function* () {
			// Collection
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('collection');
			var obj = new Zotero.Collection;
			obj.name = "Test";
			var id = yield obj.save();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Search
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('search');
			var obj = new Zotero.Search;
			obj.name = "Test";
			var id = yield obj.save();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Item
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('item');
			var obj = new Zotero.Item('book');
			var id = yield obj.save();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
		})
	})
})
