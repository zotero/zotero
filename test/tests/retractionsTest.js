describe("Retractions", function() {
	describe("Notification Banner", function () {
		var win;
		var zp;
		
		before(async function () {
			win = await loadZoteroPane();
			zp = win.ZoteroPane;
		});
		
		afterEach(function () {
			win.document.getElementById('retracted-items-close').click();
		});
		
		it("shouldn't select item in trash", async function () {
			var item1 = await createDataObject('item', { deleted: true });
			var item2 = await createDataObject('item');
			var item3 = await createDataObject('item', { deleted: true });
			
			await Zotero.Retractions._addEntry(item1.id, {});
			await Zotero.Retractions._addEntry(item2.id, {});
			await Zotero.Retractions._addEntry(item3.id, {});
			
			await createDataObject('collection');
			await waitForItemsLoad(win);
			
			await Zotero.Retractions._showAlert([item1.id, item2.id, item3.id]);
			win.document.getElementById('retracted-items-link').click();
			
			while (zp.collectionsView.selectedTreeRow.id != 'L1') {
				await Zotero.Promise.delay(10);
			}
			await waitForItemsLoad(win);
			
			var item = await zp.getSelectedItems()[0];
			assert.equal(item, item2);
		});
	});
});