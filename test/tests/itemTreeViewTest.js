describe("Zotero.ItemTreeView", function() {
	var win, itemsView, existingItemID;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		itemsView = win.ZoteroPane.itemsView;
		
		var item = new Zotero.Item('book');
		existingItemID = yield item.save();
	});
	after(function () {
		win.close();
	});
	
	describe("#selectItem()", function () {
		/**
		 * Make sure that selectItem() doesn't hang if the pane's item-select handler is never
		 * triggered due to the item already being selected
		 */
		it("should return if item is already selected", function* () {
			yield itemsView.selectItem(existingItemID);
			var selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, existingItemID);
			yield itemsView.selectItem(existingItemID);
			selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, existingItemID);
		});
	})
	
	describe("#notify()", function () {
		it("should select a new item", function* () {
			itemsView.selection.clearSelection();
			assert.lengthOf(itemsView.getSelectedItems(), 0);
			
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.save();
			
			// New item should be selected
			var selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, id);
		});
		
		it("shouldn't select a new item if skipNotifier is passed", function* () {
			// Select existing item
			yield itemsView.selectItem(existingItemID);
			var selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, existingItemID);
			
			// Create item with skipNotifier flag
			var item = new Zotero.Item('book');
			var id = yield item.save({
				skipNotifier: true
			});
			
			// Existing item should still be selected
			selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, existingItemID);
		});
		
		it("shouldn't select a new item if skipSelect is passed", function* () {
			// Select existing item
			yield itemsView.selectItem(existingItemID);
			var selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, existingItemID);
			
			// Create item with skipSelect flag
			var item = new Zotero.Item('book');
			var id = yield item.save({
				skipSelect: true
			});
			
			// Existing item should still be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
		});
		
		it("shouldn't select a modified item", function* () {
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			itemsView.selection.clearSelection();
			assert.lengthOf(itemsView.getSelectedItems(), 0);
			
			item.setField('title', 'no select on modify');
			yield item.save();
			
			// Modified item should not be selected
			assert.lengthOf(itemsView.getSelectedItems(), 0);
		});
		
		it("should reselect a selected modified item", function* () {
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			yield itemsView.selectItem(id);
			var selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], id);
			
			item.setField('title', 'reselect on modify');
			yield item.save();
			
			// Modified item should still be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], id);
		});
	})
})
