"use strict";

describe("Related Box", function () {
	var win, doc, itemsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		itemsView = win.ZoteroPane.itemsView;
	});
	after(function () {
		win.close();
	})
	
	describe("Add button", function () {
		it("should add a related item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			
			// Select the Related pane
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 3;
			var relatedbox = doc.getElementById('zotero-editpane-related');
			assert.lengthOf(relatedbox.id('relatedRows').childNodes, 0);
			
			// Click the Add button to open the Select Items dialog
			setTimeout(function () {
				relatedbox.id('addButton').click();
			});
			var selectWin = yield waitForWindow('chrome://zotero/content/selectItemsDialog.xul');
			// wrappedJSObject isn't working on zotero-collections-tree for some reason, so
			// just wait for the items tree to be created and select it directly
			do {
				var view = selectWin.document.getElementById('zotero-items-tree').view.wrappedJSObject;
				yield Zotero.Promise.delay(50);
			}
			while (!view);
			yield view.waitForLoad();
			
			// Select the other item
			for (let i = 0; i < view.rowCount; i++) {
				if (view.getRow(i).ref.id == item1.id) {
					view.selection.select(i);
				}
			}
			selectWin.document.documentElement.acceptDialog();
			
			// Wait for relations list to populate
			do {
				yield Zotero.Promise.delay(50);
			}
			while (!relatedbox.id('relatedRows').childNodes.length);
			
			assert.lengthOf(relatedbox.id('relatedRows').childNodes, 1);
			
			var items = item1.relatedItems;
			assert.lengthOf(items, 1);
			assert.equal(items[0], item2.key);
			
			// Relation should be assigned bidirectionally
			var items = item2.relatedItems;
			assert.lengthOf(items, 1);
			assert.equal(items[0], item1.key);
		})
	})
	
	describe("Remove button", function () {
		it("should remove a related item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			
			item1.addRelatedItem(item2);
			yield item1.saveTx();
			item2.addRelatedItem(item1);
			yield item2.saveTx();
			
			// Select the Related pane
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 3;
			var relatedbox = doc.getElementById('zotero-editpane-related');
			
			// Wait for relations list to populate
			do {
				yield Zotero.Promise.delay(50);
			}
			while (!relatedbox.id('relatedRows').childNodes.length);
			
			doc.getAnonymousNodes(relatedbox)[0]
				.getElementsByAttribute('value', '-')[0]
				.click();
			
			// Wait for relations list to clear
			do {
				yield Zotero.Promise.delay(50);
			}
			while (relatedbox.id('relatedRows').childNodes.length);
		})
	})
})
