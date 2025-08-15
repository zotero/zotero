"use strict";

describe("Duplicate Items", function () {
	var win, zp, cv;
	
	before(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		Zotero.Prefs.clear('duplicateLibraries');
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
	});
	beforeEach(function* () {
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	});

	async function merge(itemID) {
		var userLibraryID = Zotero.Libraries.userLibraryID;
			
		var selected = await cv.selectByID('D' + userLibraryID);
		assert.ok(selected);
		await waitForItemsLoad(win);
		
		// Select the first item, which should select both
		var iv = zp.itemsView;
		var row = iv.getRowIndexByID(itemID);
		var promise = iv.waitForSelect();
		clickOnItemsRow(win, iv, row);
		await promise;
		
		// Click merge button
		var button = win.document.getElementById('zotero-duplicates-merge-button');
		button.click();
		
		await waitForNotifierEvent('refresh', 'trash');
	}
	
	describe("Merging", function () {
		it("should merge two items in duplicates view", function* () {
			var item1 = yield createDataObject('item', { setTitle: true });
			var item2 = item1.clone();
			yield item2.saveTx();
			var uri2 = Zotero.URI.getItemURI(item2);
			
			yield merge(item1.id);
			
			// Items should be gone
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isTrue(item2.deleted);
			var rels = item1.getRelations();
			var pred = Zotero.Relations.replacedItemPredicate;
			assert.property(rels, pred);
			assert.equal(rels[pred], uri2);
		});
		
		it("should combine collections from all items", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = yield createDataObject('collection');
			
			var item1 = yield createDataObject('item', { setTitle: true, collections: [collection1.id] });
			var item2 = item1.clone();
			item2.setCollections([collection2.id]);
			yield item2.saveTx();

			yield merge(item1.id);
			
			// Items should be gone
			var iv = zp.itemsView;
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isTrue(item2.deleted);
			assert.isTrue(collection1.hasItem(item1.id));
			assert.isTrue(collection2.hasItem(item1.id));
		});

		it("should not create a relation to self if related items are merged", async function () {
			// Create 3 items related to each other
			// item1 <-> item2, item2 <-> item3
			var item1 = await createDataObject('item', { setTitle: true });
			var item2 = item1.clone();
			var item3 = item1.clone();
			await item2.saveTx();
			await item3.saveTx();

			item1.addRelatedItem(item2);
			item2.addRelatedItem(item1);
			
			item2.addRelatedItem(item3);
			item3.addRelatedItem(item2);

			await item1.saveTx();
			await item2.saveTx();
			await item3.saveTx();

			// Merge all 3 items into item1
			await merge(item1.id);
			
			// Item 1 should now be related to item2 and item3
			assert.sameMembers(item1.relatedItems, [item2.key, item3.key]);
			assert.sameMembers(item2.relatedItems, [item1.key]);
			assert.sameMembers(item3.relatedItems, [item1.key]);
		});
	});
});
