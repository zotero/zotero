describe("Zotero.ItemTreeView", function() {
	var win, itemsView, existingItemID;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		itemsView = win.ZoteroPane.itemsView;
		
		var item = new Zotero.Item('book');
		existingItemID = yield item.saveTx();
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
			var selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
			yield itemsView.selectItem(existingItemID);
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
		});
	})
	
	describe("#notify()", function () {
		beforeEach(function () {
			sinon.spy(win.ZoteroPane, "itemSelected");
		})
		
		afterEach(function () {
			win.ZoteroPane.itemSelected.restore();
		})
		
		it("should select a new item", function* () {
			itemsView.selection.clearSelection();
			assert.lengthOf(itemsView.getSelectedItems(), 0);
			
			assert.equal(win.ZoteroPane.itemSelected.callCount, 1);
			
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			
			// New item should be selected
			var selected = itemsView.getSelectedItems();
			assert.lengthOf(selected, 1);
			assert.equal(selected[0].id, id);
			
			// Item should have been selected once
			assert.equal(win.ZoteroPane.itemSelected.callCount, 2);
			assert.ok(win.ZoteroPane.itemSelected.returnValues[1].value());
		});
		
		it("shouldn't select a new item if skipNotifier is passed", function* () {
			// Select existing item
			yield itemsView.selectItem(existingItemID);
			var selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
			
			// Reset call count on spy
			win.ZoteroPane.itemSelected.reset();
			
			// Create item with skipNotifier flag
			var item = new Zotero.Item('book');
			var id = yield item.saveTx({
				skipNotifier: true
			});
			
			// No select events should have occurred
			assert.equal(win.ZoteroPane.itemSelected.callCount, 0);
			
			// Existing item should still be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
		});
		
		it("shouldn't select a new item if skipSelect is passed", function* () {
			// Select existing item
			yield itemsView.selectItem(existingItemID);
			var selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
			
			// Reset call count on spy
			win.ZoteroPane.itemSelected.reset();
			
			// Create item with skipSelect flag
			var item = new Zotero.Item('book');
			var id = yield item.saveTx({
				skipSelect: true
			});
			
			// itemSelected should have been called once (from 'selectEventsSuppressed = false'
			// in notify()) as a no-op
			assert.equal(win.ZoteroPane.itemSelected.callCount, 1);
			assert.isFalse(win.ZoteroPane.itemSelected.returnValues[0].value());
			
			// Existing item should still be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], existingItemID);
		});
		
		it("shouldn't select a modified item", function* () {
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			itemsView.selection.clearSelection();
			assert.lengthOf(itemsView.getSelectedItems(), 0);
			// Reset call count on spy
			win.ZoteroPane.itemSelected.reset();
			
			// Modify item
			item.setField('title', 'no select on modify');
			yield item.saveTx();
			
			// itemSelected should have been called once (from 'selectEventsSuppressed = false'
			// in notify()) as a no-op
			assert.equal(win.ZoteroPane.itemSelected.callCount, 1);
			assert.isFalse(win.ZoteroPane.itemSelected.returnValues[0].value());
			
			// Modified item should not be selected
			assert.lengthOf(itemsView.getSelectedItems(), 0);
		});
		
		it("should maintain selection on a selected modified item", function* () {
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			yield itemsView.selectItem(id);
			var selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], id);
			
			// Reset call count on spy
			win.ZoteroPane.itemSelected.reset();
			
			// Modify item
			item.setField('title', 'maintain selection on modify');
			yield item.saveTx();
			
			// itemSelected should have been called once (from 'selectEventsSuppressed = false'
			// in notify()) as a no-op
			assert.equal(win.ZoteroPane.itemSelected.callCount, 1);
			assert.isFalse(win.ZoteroPane.itemSelected.returnValues[0].value());
			
			// Modified item should still be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected[0], id);
		});
	})
})
