"use strict";

describe("Zotero.Tags", function () {
	describe("#getID()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			assert.typeOf(Zotero.Tags.getID(Zotero.Libraries.userLibraryID, tagName), "number");
		})
	})
	
	describe("#getName()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			var tagID = Zotero.Tags.getID(Zotero.Libraries.userLibraryID, tagName);
			assert.equal(Zotero.Tags.getName(Zotero.Libraries.userLibraryID, tagID), tagName);
		})
	})
	
	describe("#purge()", function () {
		it("should remove orphaned tags", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			var tagID = Zotero.Tags.getID(libraryID, tagName);
			assert.typeOf(tagID, "number");
			
			yield item.eraseTx();
			
			assert.equal(Zotero.Tags.getName(libraryID, tagID), tagName);
			
			yield Zotero.DB.executeTransaction(function* () {
				yield Zotero.Tags.purge();
			});
			
			yield Zotero.Tags.load(libraryID);
			assert.isFalse(Zotero.Tags.getName(libraryID, tagID));
		})
	})
})
