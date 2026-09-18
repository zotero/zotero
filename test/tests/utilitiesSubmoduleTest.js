describe("Zotero.Utilities.Item", function () {
	describe("itemToCSLJSON()", async function () {
		it("should accept Zotero.Item and Zotero export item format", async function () {
			let data = await populateDBWithSampleData(loadSampleData('journalArticle'));
			let item = await Zotero.Items.getAsync(data.journalArticle.id);
	
			let fromZoteroItem;
			try {
				fromZoteroItem = Zotero.Utilities.Item.itemToCSLJSON(item);
			}
			catch (e) {
				assert.fail(e, null, 'accepts Zotero Item');
			}
			assert.isObject(fromZoteroItem, 'converts Zotero Item to object');
			assert.isNotNull(fromZoteroItem, 'converts Zotero Item to non-null object');
	
	
			let fromExportItem;
			try {
				fromExportItem = Zotero.Utilities.Item.itemToCSLJSON(
					Zotero.Utilities.Internal.itemToExportFormat(item)
				);
			}
			catch (e) {
				assert.fail(e, null, 'accepts Zotero export item');
			}
			assert.isObject(fromExportItem, 'converts Zotero export item to object');
			assert.isNotNull(fromExportItem, 'converts Zotero export item to non-null object');
	
			assert.deepEqual(fromZoteroItem, fromExportItem, 'conversion from Zotero Item and from export item are the same');
		});

		it("should preserve EDTF ranges and circa dates from CSL JSON", function () {
			let item = new Zotero.Item('book');
			Zotero.Utilities.Item.itemFromCSLJSON(item, { type: 'book', issued: { "date-parts": [[2021], [2026]] } });
			assert.equal(item.getField('date'), '2021/2026');

			item = new Zotero.Item('book');
			Zotero.Utilities.Item.itemFromCSLJSON(item, { type: 'book', issued: { "date-parts": [[-429]], circa: true } });
			assert.equal(item.getField('date'), '-0429~');
		});

		it("should convert an EDTF date stored on an item", async function () {
			let item = new Zotero.Item('book');
			item.setField('date', '-429?');
			await item.saveTx();
			let cslItem = Zotero.Utilities.Item.itemToCSLJSON(item);
			assert.deepEqual(cslItem.issued, { "date-parts": [[-429]], circa: true });
		});
	});
});
