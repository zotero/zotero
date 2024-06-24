"use strict";

describe("Zotero.LibraryTree", function() {
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
		it("should return the row index of an item", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			var item = await createDataObject('item', { collections: [collection.id] });
			var view = zp.itemsView;
			assert.strictEqual(view.getRowIndexByID(item.treeViewID), 0);
		});
	});
	
	describe("#_removeRow()", function () {
		it("should remove the last row", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			await createDataObject('item', { collections: [collection.id] });
			await createDataObject('item', { collections: [collection.id] });
			
			var view = zp.itemsView;
			var treeViewID = view.getRow(1).id;
			zp.itemsView._removeRow(1);
			
			assert.equal(view.rowCount, 1);
			assert.isFalse(view.getRowIndexByID(treeViewID));
		});
	});
})
