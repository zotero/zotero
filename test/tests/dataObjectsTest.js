"use strict";

describe("Zotero.DataObjects", function () {
	var types = ['collection', 'item', 'search'];
	
	describe("#getLibraryAndKeyFromID()", function () {
		it("should return a libraryID and key within a transaction", function* () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				yield Zotero.DB.executeTransaction(function* () {
					let obj = createUnsavedDataObject(type);
					yield obj.save();
					
					var {libraryID, key} = objectsClass.getLibraryAndKeyFromID(obj.id);
					assert.equal(libraryID, Zotero.Libraries.userLibraryID);
					assert.ok(key);
					assert.typeOf(key, 'string');
					assert.equal(key, obj.key);
					
					yield obj.erase();
				});
			}
		});
		
		it("should return false after a save failure", function* () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				var obj;
				try {
					yield Zotero.DB.executeTransaction(function* () {
						obj = createUnsavedDataObject(type);
						yield obj.save();
						throw 'Aborting transaction -- ignore';
					});
				}
				catch (e) {
					if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
				}
				
				// The registered identifiers should be reset in a rollback handler
				var libraryKey = objectsClass.getLibraryAndKeyFromID(obj.id);
				assert.isFalse(libraryKey);
			}
		});
	});
})
