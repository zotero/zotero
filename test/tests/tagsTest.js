"use strict";

describe("Zotero.Tags", function () {
	describe("#getID()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			assert.typeOf(Zotero.Tags.getID(tagName), "number");
		})
	})
	
	describe("#getName()", function () {
		it("should return tag id", function* () {
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var tagID = Zotero.Tags.getID(tagName);
			assert.equal(Zotero.Tags.getName(tagID), tagName);
		})
	})
	
	describe("#rename()", function () {
		it("should mark items as changed", function* () {
			var item1 = yield createDataObject('item', { tags: [{ tag: "A" }], synced: true });
			var item2 = yield createDataObject('item', { tags: [{ tag: "A" }, { tag: "B" }], synced: true });
			var item3 = yield createDataObject('item', { tags: [{ tag: "B" }, { tag: "C" }], synced: true });
			
			yield Zotero.Tags.rename(item1.libraryID, "A", "D");
			assert.isFalse(item1.synced);
			assert.isFalse(item2.synced);
			assert.isTrue(item3.synced);
		});
	});
	
	describe("#removeFromLibrary()", function () {
		it("should remove tags in given library", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var groupLibraryID = (await getGroup()).libraryID;
			
			var tags = [];
			var items = [];
			await Zotero.DB.executeTransaction(async function () {
				for (let i = 0; i < 10; i++) {
					let tagName = Zotero.Utilities.randomString();
					tags.push(tagName);
					let item = createUnsavedDataObject('item', { tags: [tagName] });
					await item.save();
					items.push(item);
				}
			});
			
			var groupTagName = tags[0];
			var groupItem = await createDataObject(
				'item',
				{
					libraryID: groupLibraryID,
					tags: [groupTagName]
				}
			);
			
			var tagIDs = tags.map(tag => Zotero.Tags.getID(tag));
			await Zotero.Tags.removeFromLibrary(libraryID, tagIDs);
			items.forEach(item => assert.lengthOf(item.getTags(), 0));
			
			// Group item should still have the tag
			assert.sameDeepMembers(groupItem.getTags(), [{ tag: groupTagName }]);
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM itemTags WHERE itemID=?",
					groupItem.id
				),
				1
			);
		});
		
		
		it("should reload tags of associated items", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tagName = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.addTag(tagName);
			yield item.saveTx();
			assert.lengthOf(item.getTags(), 1);
			
			var tagID = Zotero.Tags.getID(tagName);
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
			
			var tagID = Zotero.Tags.getID(tagName);
			assert.typeOf(tagID, "number");
			
			yield item.eraseTx();
			
			assert.equal(Zotero.Tags.getName(tagID), tagName);
			
			yield Zotero.DB.executeTransaction(function* () {
				yield Zotero.Tags.purge();
			});
			
			assert.isFalse(Zotero.Tags.getName(tagID));
		})
	})
	
	
	describe("#setColor()", function () {
		var libraryID;
		
		beforeEach(function* () {
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
		
		it("should clear color for a tag", function* () {
			var aColor = '#ABCDEF';
			yield Zotero.Tags.setColor(libraryID, "A", aColor);
			var o = Zotero.Tags.getColor(libraryID, "A")
			assert.equal(o.color, aColor);
			assert.equal(o.position, 0);
			
			yield Zotero.Tags.setColor(libraryID, "A", false);
			assert.equal(Zotero.Tags.getColors(libraryID).size, 0);
			assert.isFalse(Zotero.Tags.getColor(libraryID, "A"));
			
			var o = Zotero.SyncedSettings.get(libraryID, 'tagColors');
			assert.isNull(o);
		});
	});
})
