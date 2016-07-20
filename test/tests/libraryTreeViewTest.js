"use strict";

describe("Zotero.LibraryTreeView", function() {
	var win, zp, cv, itemsView;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
	});
	beforeEach(function* () {
		yield selectLibrary(win);
		itemsView = zp.itemsView;
	})
	after(function () {
		win.close();
	});
	
	describe("#getRowIndexByID()", function () {
		it("should return the row index of an item", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			var item = yield createDataObject('item', { collections: [collection.id] });
			var view = zp.itemsView;
			assert.strictEqual(view.getRowIndexByID(item.treeViewID), 0);
		});
	});
	
	describe("#_removeRow()", function () {
		it("should remove the last row", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			yield createDataObject('item', { collections: [collection.id] });
			yield createDataObject('item', { collections: [collection.id] });
			
			var view = zp.itemsView;
			var treeViewID = view.getRow(1).id;
			zp.itemsView._removeRow(1);
			
			assert.equal(view.rowCount, 1);
			assert.isFalse(view.getRowIndexByID(treeViewID));
		});
	});
})
