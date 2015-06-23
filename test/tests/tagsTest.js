"use strict";

describe("Zotero.Tags", function () {
	describe("#getID()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			assert.typeOf((yield Zotero.Tags.getID(tagName)), "number");
		})
	})
	
	describe("#getName()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var tagID = yield Zotero.Tags.getID(tagName);
			assert.equal((yield Zotero.Tags.getName(tagID)), tagName);
		})
	})
	
	describe("#removeFromLibrary()", function () {
		it("should reload tags of associated items", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			assert.lengthOf(item.getTags(), 1);
			
			var tagID = yield Zotero.Tags.getID(tagName);
			yield Zotero.Tags.removeFromLibrary(libraryID, tagID);
			assert.lengthOf(item.getTags(), 0);
		})
	})
	
	describe("#purge()", function () {
		it("should remove orphaned tags", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			var tagID = yield Zotero.Tags.getID(tagName);
			assert.typeOf(tagID, "number");
			
			yield item.eraseTx();
			
			assert.equal((yield Zotero.Tags.getName(tagID)), tagName);
			
			yield Zotero.DB.executeTransaction(function* () {
				yield Zotero.Tags.purge();
			});
			
			assert.isFalse(yield Zotero.Tags.getName(tagID));
		})
	})
})
