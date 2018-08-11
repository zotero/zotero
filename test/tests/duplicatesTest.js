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
	
	describe("Merging", function () {
		it("should merge two items in duplicates view", function* () {
			var item1 = yield createDataObject('item', { setTitle: true });
			var item2 = item1.clone();
			yield item2.saveTx();
			var uri2 = Zotero.URI.getItemURI(item2);
			
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var selected = yield cv.selectByID('D' + userLibraryID);
			assert.ok(selected);
			yield waitForItemsLoad(win);
			
			// Select the first item, which should select both
			var iv = zp.itemsView;
			var row = iv.getRowIndexByID(item1.id);
			assert.isNumber(row);
			clickOnItemsRow(iv, row);
			assert.equal(iv.selection.count, 2);
			
			// Click merge button
			var button = win.document.getElementById('zotero-duplicates-merge-button');
			button.click();
			
			yield waitForNotifierEvent('refresh', 'trash');
			
			// Items should be gone
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
			
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			var selected = yield cv.selectByID('D' + userLibraryID);
			assert.ok(selected);
			yield waitForItemsLoad(win);
			
			// Select the first item, which should select both
			var iv = zp.itemsView;
			var row = iv.getRowIndexByID(item1.id);
			clickOnItemsRow(iv, row);
			
			// Click merge button
			var button = win.document.getElementById('zotero-duplicates-merge-button');
			button.click();
			
			yield waitForNotifierEvent('refresh', 'trash');
			
			// Items should be gone
			assert.isFalse(iv.getRowIndexByID(item1.id));
			assert.isFalse(iv.getRowIndexByID(item2.id));
			assert.isTrue(item2.deleted);
			assert.isTrue(collection1.hasItem(item1.id));
			assert.isTrue(collection2.hasItem(item1.id));
		});
	});
});
