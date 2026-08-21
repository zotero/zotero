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
	
	describe("findDuplicatesOf()", function () {
		it("should find duplicates of a Zotero.Item by title + creator", async function () {
			var item1 = await createDataObject('item', {
				title: 'Test Dedup Title',
				creators: [{
					firstName: 'John',
					lastName: 'Smith',
					creatorType: 'author'
				}]
			});
			var item2 = await createDataObject('item', {
				title: 'Test Dedup Title',
				creators: [{
					firstName: 'John',
					lastName: 'Smith',
					creatorType: 'author'
				}]
			});
			// Different title, should not match
			var item3 = await createDataObject('item', {
				title: 'Different Title',
				creators: [{
					firstName: 'John',
					lastName: 'Smith',
					creatorType: 'author'
				}]
			});
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(item1);
			assert.include(dupes, item2.id);
			assert.notInclude(dupes, item1.id);
			assert.notInclude(dupes, item3.id);
		});
		
		it("should find duplicates of a CSL-JSON item by title + creator", async function () {
			var item1 = await createDataObject('item', {
				title: 'CSL Dedup Title',
				creators: [{
					firstName: 'Jane',
					lastName: 'Doe',
					creatorType: 'author'
				}]
			});
			
			var cslItem = {
				type: 'book',
				title: 'CSL Dedup Title',
				author: [{ family: 'Doe', given: 'Jane' }]
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.include(dupes, item1.id);
		});
		
		it("should find duplicates by DOI", async function () {
			var item1 = await createDataObject('item', {
				itemType: 'journalArticle',
				title: 'Article One'
			});
			item1.setField('DOI', '10.1234/test.doi');
			await item1.saveTx();
			
			var cslItem = {
				type: 'article-journal',
				title: 'Completely Different Title',
				DOI: '10.1234/test.doi'
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.include(dupes, item1.id);
		});
		
		it("should find duplicates by ISBN", async function () {
			var item1 = await createDataObject('item', {
				itemType: 'book',
				title: 'My Book'
			});
			item1.setField('ISBN', '978-0-306-40615-7');
			await item1.saveTx();
			
			var cslItem = {
				type: 'book',
				title: 'Some Other Book Title',
				ISBN: '978-0-306-40615-7'
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.include(dupes, item1.id);
		});
		
		it("should not match items with same title but conflicting years", async function () {
			var item1 = await createDataObject('item', {
				title: 'Year Conflict Title',
				creators: [{
					firstName: 'Alice',
					lastName: 'Test',
					creatorType: 'author'
				}]
			});
			item1.setField('date', '2020');
			await item1.saveTx();
			
			var cslItem = {
				type: 'book',
				title: 'Year Conflict Title',
				author: [{ family: 'Test', given: 'Alice' }],
				issued: { 'date-parts': [[2015]] }
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.notInclude(dupes, item1.id);
		});
		
		it("should not match items with same title but different creators", async function () {
			var item1 = await createDataObject('item', {
				title: 'Creator Mismatch Title',
				creators: [{
					firstName: 'Alice',
					lastName: 'One',
					creatorType: 'author'
				}]
			});
			
			var cslItem = {
				type: 'book',
				title: 'Creator Mismatch Title',
				author: [{ family: 'Two', given: 'Bob' }]
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.notInclude(dupes, item1.id);
		});
		
		it("should return empty array when no duplicates exist", async function () {
			var cslItem = {
				type: 'book',
				title: 'Absolutely Unique Title ' + Zotero.Utilities.randomString(),
				author: [{ family: 'Nobody', given: 'X' }]
			};
			
			var d = new Zotero.Duplicates(Zotero.Libraries.userLibraryID);
			var dupes = await d.findDuplicatesOf(cslItem);
			assert.lengthOf(dupes, 0);
		});
	});
	
	describe("Merging", function () {
		it("should merge two items in duplicates view", async function () {
			var item1 = await createDataObject('item', { setTitle: true });
			var item2 = item1.clone();
			await item2.saveTx();
			var uri2 = Zotero.URI.getItemURI(item2);
			
			await merge(item1.id);
			
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
		
		it("should combine collections from all items", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			
			var item1 = await createDataObject('item', { setTitle: true, collections: [collection1.id] });
			var item2 = item1.clone();
			item2.setCollections([collection2.id]);
			await item2.saveTx();

			await merge(item1.id);
			
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
