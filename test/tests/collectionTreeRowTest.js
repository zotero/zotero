describe("CollectionTreeRow", function () {
	var win, zp, cv, userLibraryID;
	
	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
		userLibraryID = Zotero.Libraries.userLibraryID;
	});
	
	beforeEach(function () {
		return selectLibrary(win);
	});
	
	after(function () {
		win.close();
	});
	
	describe("Unfiled Items", function () {
		// https://github.com/zotero/zotero/issues/2771
		it("shouldn't show filed attachments with annotations", async function () {
			var item1 = await createDataObject('item');
			
			var collection = await createDataObject('collection');
			var item2 = await createDataObject('item', { collections: [collection.id] });
			var attachment = await importPDFAttachment(item2);
			var annotation = await createAnnotation('highlight', attachment);
			
			cv.selectByID("U" + userLibraryID);
			await waitForItemsLoad(win);
			var itemsView = zp.itemsView;
			
			assert.isNumber(itemsView.getRowIndexByID(item1.id));
			assert.isFalse(itemsView.getRowIndexByID(item2.id));
		});
	});
});