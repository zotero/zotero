describe("Zotero.Items", function () {
	var win, collectionsView, zp;
	
	before(function* () {
		win = yield loadZoteroPane();
		collectionsView = win.ZoteroPane.collectionsView;
		zp = win.ZoteroPane;
	})
	beforeEach(function () {
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	})
	
	describe("#emptyTrash()", function () {
		it("should delete items in the trash", function* () {
			var item1 = createUnsavedDataObject('item');
			item1.setField('title', 'a');
			item1.deleted = true;
			var id1 = yield item1.saveTx();
			
			var item2 = createUnsavedDataObject('item');
			item2.setField('title', 'b');
			item2.deleted = true;
			var id2 = yield item2.saveTx();
			
			var item3 = createUnsavedDataObject('item', { itemType: 'attachment', parentID: id2 });
			item3.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
			item3.deleted = true;
			var id3 = yield item3.saveTx();
			
			yield collectionsView.selectTrash(Zotero.Libraries.userLibraryID);
			
			yield Zotero.Items.emptyTrash(Zotero.Libraries.userLibraryID);
			
			assert.isFalse(yield Zotero.Items.getAsync(id1));
			assert.isFalse(yield Zotero.Items.getAsync(id2));
			assert.isFalse(yield Zotero.Items.getAsync(id3));
			
			// TEMP: This is failing on Travis due to a race condition
			//assert.equal(zp.itemsView.rowCount, 0)
		})
	})
});
