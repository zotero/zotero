"use strict";

describe("VirtualizedTable", function () {
	let win, zp, itemsView;

	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
	});

	beforeEach(async function () {
		await selectLibrary(win);
		itemsView = zp.itemsView;
		await createDataObject('item');
		await waitForItemsLoad(win);
	});

	after(function () {
		win.close();
	});

	describe("#selectEventsSuppressed", function () {
		it("should not trigger updates when set to false repeatedly", function () {
			let selection = itemsView.selection;
			selection.selectEventsSuppressed = false;

			let updateSpy = sinon.spy(selection, '_updateTree');
			let invalidateSpy = sinon.spy(itemsView.tree, 'invalidate');

			try {
				selection.selectEventsSuppressed = false;
				assert.equal(updateSpy.callCount, 0);
				assert.equal(invalidateSpy.callCount, 0);
			}
			finally {
				updateSpy.restore();
				invalidateSpy.restore();
			}
		});

		it("should trigger updates when changed from true to false", function () {
			let selection = itemsView.selection;
			selection.selectEventsSuppressed = true;

			let updateSpy = sinon.spy(selection, '_updateTree');
			let invalidateSpy = sinon.spy(itemsView.tree, 'invalidate');

			try {
				selection.selectEventsSuppressed = false;
				assert.equal(updateSpy.callCount, 1);
				assert.equal(invalidateSpy.callCount, 1);
			}
			finally {
				updateSpy.restore();
				invalidateSpy.restore();
			}
		});
	});

	describe("VirtualizedTree rendering", function () {
		it("should render tree indentation and ARIA attributes", async function () {
			let parentItem = await createDataObject('item', { title: 'Parent Item' });
			let attachment = await importFileAttachment('test.pdf', { parentItemID: parentItem.id });
			let annotation = await createAnnotation('highlight', attachment);

			await waitForItemsLoad(win);
			await itemsView.selectItem(annotation.id);
			
			let parentIndex = itemsView.getRowIndexByID(parentItem.id);
			let attachmentIndex = itemsView.getRowIndexByID(attachment.id);
			let annotationIndex = itemsView.getRowIndexByID(annotation.id);
			
			let parentNode = itemsView.tree._renderItem(parentIndex);
			let attachmentNode = itemsView.tree._renderItem(attachmentIndex);
			let annotationNode = itemsView.tree._renderItem(annotationIndex);
			
			assert.equal(parentNode.getAttribute('role'), 'treeitem');
			assert.equal(attachmentNode.getAttribute('role'), 'treeitem');
			assert.equal(annotationNode.getAttribute('role'), 'treeitem');
			
			assert.equal(parentNode.getAttribute('aria-level'), '1');
			assert.equal(attachmentNode.getAttribute('aria-level'), '2');
			assert.equal(annotationNode.getAttribute('aria-level'), '3');
			
			assert.equal(parentNode.getAttribute('aria-expanded'), 'true');
			assert.equal(attachmentNode.getAttribute('aria-expanded'), 'true');
			assert.isNull(annotationNode.getAttribute('aria-expanded'));
			
			let getIndent = (node) => parseInt(node.querySelector('.cell-indent').style.paddingInlineStart || 0);
			assert.equal(getIndent(parentNode), 0);
			assert.equal(getIndent(attachmentNode), 16);
			assert.equal(getIndent(annotationNode), 32);
		});
	});
});
