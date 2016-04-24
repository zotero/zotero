"use strict";

describe("Duplicate Items", function () {
	var win, zp, cv;
	
	before(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
	});
	beforeEach(function* () {
		Zotero.Prefs.clear('duplicateLibraries');
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
		
		return selectLibrary(win);
	})
	after(function () {
		if (win) {
			win.close();
		}
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
	});
});
