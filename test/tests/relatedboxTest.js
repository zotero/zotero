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
	
	async function relateItems(...items) {
		for (let i = 0; i < items.length; i++) {
			for (let j = i + 1; j < items.length; j++) {
				items[i].addRelatedItem(items[j]);
				items[j].addRelatedItem(items[i]);
			}
		}
		for (let item of items) {
			await item.saveTx();
		}
	}
	
	it("should sort by title", async function () {
		var title1 = 'cccccc';
		var title2 = 'aaaaaa';
		var title3 = 'bbbbbb';
		var item0 = await createDataObject('item');
		var item1 = await createDataObject('item', { title: title1 });
		var item2 = await createDataObject('item', { title: title2 });
		var item3 = await createDataObject('item', { title: title3 });
		
		await relateItems(item0, item1, item2, item3);
		
		await win.ZoteroPane.selectItem(item0.id);
		
		var relatedbox = doc.getElementById('zotero-editpane-related');
		
		// Wait for relations list to populate
		do {
			await Zotero.Promise.delay(50);
		}
		while (!relatedbox.querySelectorAll('.row').length);
		
		var html = relatedbox.querySelector('.body').innerHTML;
		var pos1 = html.indexOf(title1);
		var pos2 = html.indexOf(title2);
		var pos3 = html.indexOf(title3);
		assert.isAbove(pos2, 0);
		assert.isAbove(pos3, pos2)
		assert.isAbove(pos1, pos3)
	});
	
	it("should update if a related item is renamed", async function () {
		var title1 = 'aaaaaa';
		var title2 = 'bbbbbb';
		var item1 = await createDataObject('item', { title: title1 });
		var item2 = await createDataObject('item', { title: title2 });
		item1.addRelatedItem(item2);
		await item1.saveTx();
		item2.addRelatedItem(item1);
		await item2.saveTx();
		
		var relatedbox = doc.getElementById('zotero-editpane-related');
		
		// Wait for relations list to populate
		do {
			await Zotero.Promise.delay(50);
		}
		while (!relatedbox.querySelectorAll('.row').length);
		
		assert.include(relatedbox.querySelector('.body').innerHTML, title1);
		
		title1 = 'cccccc';
		item1.setField('title', title1);
		await item1.saveTx();
		
		// New title should appear in list
		do {
			await Zotero.Promise.delay(50);
		}
		while (!relatedbox.querySelector('.body').innerHTML.includes(title1));
	});
	
	it("should update if a related item is deleted", async function () {
		var title1 = 'aaaaaa';
		var title2 = 'bbbbbb';
		var item1 = await createDataObject('item', { title: title1 });
		var item2 = await createDataObject('item', { title: title2 });
		item1.addRelatedItem(item2);
		await item1.saveTx();
		item2.addRelatedItem(item1);
		await item2.saveTx();
		
		var relatedbox = doc.getElementById('zotero-editpane-related');
		
		// Wait for relations list to populate
		do {
			await Zotero.Promise.delay(50);
		}
		while (!relatedbox.querySelectorAll('.row').length);
		
		assert.include(relatedbox.querySelector('.body').innerHTML, title1);
		
		await item1.eraseTx();
		
		// Deleted item should be removed from list
		do {
			await Zotero.Promise.delay(50);
		}
		while (relatedbox.querySelector('.body').innerHTML.includes(title1));
	});
	
	describe("Add button", function () {
		it("should add a related item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			
			var relatedbox = doc.getElementById('zotero-editpane-related');
			assert.lengthOf(relatedbox.querySelectorAll('.row'), 0);
			
			// Click the Add button to open the Select Items dialog
			setTimeout(function () {
				relatedbox.querySelector('collapsible-section .add').click();
			});
			var selectWin = yield waitForWindow('chrome://zotero/content/selectItemsDialog.xhtml');
			do {
				yield Zotero.Promise.delay(50);
			}
			while (!selectWin.loaded);
			var selectCollectionsView = selectWin.collectionsView;
			var selectItemsView = selectWin.itemsView;
			yield selectCollectionsView.waitForLoad();
			yield selectItemsView.waitForLoad();
			
			// Select the other item
			yield selectItemsView.selectItem(item1.id);
			selectWin.document.querySelector('dialog').acceptDialog();
			
			// Wait for relations list to populate
			do {
				yield Zotero.Promise.delay(50);
			}
			while (!relatedbox.querySelectorAll('.row').length);
			
			assert.lengthOf(relatedbox.querySelectorAll('.row'), 1);
			
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
			
			var relatedbox = doc.getElementById('zotero-editpane-related');
			
			// Wait for relations list to populate
			do {
				yield Zotero.Promise.delay(50);
			}
			while (!relatedbox.querySelectorAll('.row').length);
			
			relatedbox.querySelector('.zotero-clicky-minus').click();
			
			// Wait for relations list to clear
			do {
				yield Zotero.Promise.delay(50);
			}
			while (relatedbox.querySelectorAll('.row').length);
		})
	})
})
