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
	});

	describe("Different-Item Relations", function () {
		it("should prevent items from showing in Duplicate Items", async function () {
			let item1 = await createDataObject('item', { setTitle: true });
			let item2 = item1.clone();
			await item2.saveTx();

			item1.addRelation(Zotero.Relations.differentItemPredicate, Zotero.URI.getItemURI(item2));
			item2.addRelation(Zotero.Relations.differentItemPredicate, Zotero.URI.getItemURI(item1));
			await item1.saveTx();
			await item2.saveTx();

			let userLibraryID = Zotero.Libraries.userLibraryID;

			let selected = await cv.selectByID('D' + userLibraryID);
			assert.ok(selected);
			await waitForItemsLoad(win);

			let iv = zp.itemsView;
			assert.equal(iv.rowCount, 0);
		});
	});

	describe("Merge All Duplicates", function () {
		it("should merge two duplicate sets", async function () {
			let item1 = createUnsavedDataObject('item', { setTitle: true, dateAdded: '2000-01-01 00:00:00' });
			item1.setField('abstractNote', 'Abstract 1');
			await item1.saveTx();
			let item2 = item1.clone();
			item2.dateAdded = '2001-01-01 00:00:00';
			item2.setField('abstractNote', 'Abstract 2');
			await item2.saveTx();

			let item3 = await createDataObject('item', { setTitle: true, dateAdded: '2022-05-17 01:00:00' });
			let item4 = item3.clone();
			item4.dateAdded = '2022-05-17 00:00:00';
			item4.setField('abstractNote', 'Abstract 4');
			await item4.saveTx();

			let userLibraryID = Zotero.Libraries.userLibraryID;

			let selected = await cv.selectByID('D' + userLibraryID);
			assert.ok(selected);
			await waitForItemsLoad(win);

			let iv = zp.itemsView;
			assert.equal(iv.rowCount, 4);
			await zp.selectItems([item1.id, item2.id, item3.id, item4.id]);
			await zp.mergeAllDuplicates('dateAdded', true);

			assert.equal(iv.rowCount, 0);
			assert.isTrue(item1.deleted);
			assert.isFalse(item2.deleted);
			assert.isFalse(item3.deleted);
			assert.isTrue(item4.deleted);
			assert.equal(item2.dateAdded, item1.dateAdded);
			assert.equal(item3.dateAdded, '2022-05-17 00:00:00');
			assert.equal(item2.getField('abstractNote'), 'Abstract 2');
			assert.equal(item3.getField('abstractNote'), 'Abstract 4');
		});
	});
});
