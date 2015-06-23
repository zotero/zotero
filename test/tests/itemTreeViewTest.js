describe("Zotero.ItemTreeView", function() {
	var win, zp, itemsView, existingItemID;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		
		var item = new Zotero.Item('book');
		existingItemID = yield item.saveTx();
	});
	beforeEach(function* () {
		yield zp.collectionsView.selectLibrary();
		yield waitForItemsLoad(win)
		itemsView = zp.itemsView;
	})
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
		
		it("shouldn't change selection outside of trash if new trashed item is created with skipSelect", function* () {
			yield selectLibrary(win);
			yield waitForItemsLoad(win);
			
			itemsView.selection.clearSelection();
			
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			var id = yield item.saveTx({
				skipSelect: true
			});
			
			// Nothing should be selected
			selected = itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 0);
		})
		
		it("shouldn't select a modified item", function* () {
			// Create item
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			
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
		
		it("should reselect the same row when an item is removed", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			itemsView = zp.itemsView;
			
			var items = [];
			var num = 10;
			for (let i = 0; i < num; i++) {
				let item = createUnsavedDataObject('item');
				item.addToCollection(collection.id);
				yield item.saveTx();
				items.push(item);
			}
			yield Zotero.Promise.delay(2000);
			assert.equal(itemsView.rowCount, num);
			
			// Select the third item in the list
			itemsView.selection.select(2);
			var treeRow = itemsView.getRow(2);
			yield treeRow.ref.eraseTx();
			
			// Selection should stay on third row
			assert.equal(itemsView.selection.currentIndex, 2);
			
			yield Zotero.Items.erase(items.map(item => item.id));
		})
	})
	
	describe("#drop()", function () {
		it("should create a top-level attachment when a file is dragged", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			
			var deferred = Zotero.Promise.defer();
			itemsView.addEventListener('select', () => deferred.resolve());
			
			itemsView.drop(0, -1, {
				dropEffect: 'copy',
				effectAllowed: 'copy',
				types: {
					contains: function (type) {
						return type == 'application/x-moz-file';
					}
				},
				mozItemCount: 1,
				mozGetDataAt: function (type, i) {
					if (type == 'application/x-moz-file' && i == 0) {
						return file;
					}
				}
			})
			
			yield deferred.promise;
			var items = itemsView.getSelectedItems();
			var path = yield items[0].getFilePathAsync();
			assert.equal(
				(yield Zotero.File.getBinaryContentsAsync(path)),
				(yield Zotero.File.getBinaryContentsAsync(file))
			);
		})
	});
})
