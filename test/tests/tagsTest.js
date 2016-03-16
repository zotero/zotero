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
	
	
	describe("#setColor()", function () {
		var libraryID;
		
		before(function* () {
			libraryID = Zotero.Libraries.userLibraryID;
			
			// Clear library tag colors
			var colors = Zotero.Tags.getColors(libraryID);
			for (let color of colors.keys()) {
				yield Zotero.Tags.setColor(libraryID, color);
			}
		});
		
		it("should set color for a tag", function* () {
			var aColor = '#ABCDEF';
			var bColor = '#BCDEF0';
			yield Zotero.Tags.setColor(libraryID, "A", aColor);
			yield Zotero.Tags.setColor(libraryID, "B", bColor);
			
			var o = Zotero.Tags.getColor(libraryID, "A")
			assert.equal(o.color, aColor);
			assert.equal(o.position, 0);
			var o = Zotero.Tags.getColor(libraryID, "B")
			assert.equal(o.color, bColor);
			assert.equal(o.position, 1);
			
			var o = Zotero.SyncedSettings.get(libraryID, 'tagColors');
			assert.isArray(o);
			assert.lengthOf(o, 2);
			assert.sameMembers(o.map(c => c.color), [aColor, bColor]);
		});
	});
})
