"use strict";

describe("Zotero.LibraryTree", function() {
	var win, zp, cv, itemsView;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
	});
	beforeEach(function* () {
		yield selectLibrary(win);
		itemsView = zp.itemsView;
	})
	after(function () {
		win.close();
	});
	
	describe("#getRowIndexByID()", function () {
		it("should return the row index of an item", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			var item = await createDataObject('item', { collections: [collection.id] });
			var view = zp.itemsView;
			assert.strictEqual(view.getRowIndexByID(item.treeViewID), 0);
		});
	});
	
	describe("#_clearDropIndicator()", function () {
		// Simulate a drag pausing over a row, highlighting it as a drop target. The tests then
		// send no further drag events, as when a drag ends outside the window without the tree
		// receiving a dragleave, drop, or dragend.
		function simulateDragOverRow(view, index, draggedItemID) {
			var rowEl = {
				classList: { contains: () => false },
				getBoundingClientRect: () => ({ y: 0, height: 100 })
			};
			Zotero.DragDrop.currentDragSource = view.collectionTreeRows[0];
			view.onDragOver({
				preventDefault: () => {},
				stopPropagation: () => {},
				currentTarget: rowEl,
				target: rowEl,
				// Middle of the row, so the drop targets the row itself
				clientY: 50,
				dataTransfer: {
					dropEffect: 'copy',
					effectAllowed: 'copyMove',
					types: ['zotero/item'],
					getData: type => type == 'zotero/item' ? String(draggedItemID) : ""
				}
			}, index);
			Zotero.DragDrop.currentDragSource = null;
		}

		it("should clear a leftover drop highlight on mousemove", async function () {
			var item = await createDataObject('item');
			var note = new Zotero.Item('note');
			note.setNote('A note');
			await note.saveTx();
			var view = zp.itemsView;
			var row = view.getRowIndexByID(item.treeViewID);

			simulateDragOverRow(view, row, note.id);
			assert.equal(view._dropRow, row);
			assert.ok(view.domEl.querySelector('.row.drop'));

			view.domEl.dispatchEvent(new win.MouseEvent('mousemove', { bubbles: true }));

			assert.isNull(view._dropRow);
			assert.notOk(view.domEl.querySelector('.row.drop'));
		});

		it("should clear the drop highlight when the highlighted last row is removed", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			await createDataObject('item', { collections: [collection.id] });
			await createDataObject('item', { collections: [collection.id] });
			var note = new Zotero.Item('note');
			note.setNote('A note');
			await note.saveTx();
			var view = zp.itemsView;
			var lastRow = view.rowCount - 1;
			var lastItem = Zotero.Items.get(view.getRow(lastRow).id);

			simulateDragOverRow(view, lastRow, note.id);
			assert.equal(view._dropRow, lastRow);
			assert.ok(view.domEl.querySelector('.row.drop'));

			await Zotero.Items.trashTx([lastItem.id]);

			assert.equal(view.rowCount, 1);
			assert.isNull(view._dropRow);
			assert.notOk(view.domEl.querySelector('.row.drop'));
		});
	});

	describe("#_removeRow()", function () {
		it("should remove the last row", async function () {
			var collection = await createDataObject('collection');
			await select(win, collection);
			await createDataObject('item', { collections: [collection.id] });
			await createDataObject('item', { collections: [collection.id] });
			
			var view = zp.itemsView;
			var treeViewID = view.getRow(1).id;
			zp.itemsView._removeRow(1);
			
			assert.equal(view.rowCount, 1);
			assert.isFalse(view.getRowIndexByID(treeViewID));
		});
	});
})
