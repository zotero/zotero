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
	});
});
