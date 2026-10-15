"use strict";

describe("Select Items Dialog", function () {
	var candidate1;
	var candidate2;
	var childNote;
	var excluded;
	var collection;
	var group;

	async function openDialog(itemIDs) {
		let io = {
			dataOut: null,
			itemIDs,
			multiSelect: false,
			onlyRegularItems: true,
			deferred: Zotero.Promise.defer()
		};
		let dialogPromise = waitForWindow('chrome://zotero/content/selectItemsDialog.xhtml');
		Services.ww.openWindow(null, 'chrome://zotero/content/selectItemsDialog.xhtml', '',
			'chrome,dialog=no,centerscreen,resizable=yes', io);
		let dialog = await dialogPromise;
		await waitForCallback(() => dialog.loaded);
		return { dialog, io };
	}

	async function selectSuggestedItems(dialog) {
		let row = dialog.collectionsView.getRowIndexByID('suggested-items');
		assert.isNumber(row);
		await dialog.collectionsView.selectWait(row);
	}

	function assertLibraryColumnPosition(dialog) {
		let columns = dialog.itemsView._getColumns();
		let libraryColumnIndex = columns.findIndex(column => column.dataKey === 'library');
		let attachmentColumnIndex = columns.findIndex(column => column.dataKey === 'hasAttachment');
		assert.equal(libraryColumnIndex, attachmentColumnIndex - 1);
		assert.isAtLeast(parseInt(columns[libraryColumnIndex].width), 120);
	}

	before(async function () {
		candidate1 = await createDataObject('item', { title: 'Candidate One' });
		group = await createGroup({ name: 'Candidate Library' });
		candidate2 = await createDataObject('item', {
			title: 'Candidate Two',
			libraryID: group.libraryID
		});
		childNote = await createDataObject('item', { itemType: 'note', parentID: candidate1.id });
		excluded = await createDataObject('item', { title: 'Excluded Item' });
		collection = await createDataObject('collection', { name: 'Browsable Collection' });
	});

	after(async function () {
		await group.eraseTx();
	});

	describe("with suggestions from multiple libraries", function () {
		var dialog;
		var showInLibrary;

		before(async function () {
			({ dialog } = await openDialog([candidate1.id, candidate2.id]));
			showInLibrary = sinon.stub(Zotero.Utilities.Internal, 'showInLibrary').resolves();
			await waitForCallback(() => dialog.itemsView.getRowIndexByID(candidate2.id) !== false);
		});

		beforeEach(async function () {
			await selectSuggestedItems(dialog);
			await dialog.itemsView.setFilter('search', '');
			dialog.document.getElementById('zotero-tb-search').searchTextbox.value = '';
			dialog.itemsView.selection.clearSelection();
			showInLibrary.resetHistory();
		});

		after(function () {
			showInLibrary.restore();
			if (!dialog.closed) {
				dialog.close();
			}
		});

		it("should show Suggested Items above the normal collection tree", function () {
			assert.equal(dialog.collectionsView.getRow(0).id, 'suggested-items');
			assert.equal(dialog.collectionsView.getRow(0).type, 'suggestedItems');
			assert.isTrue(dialog.collectionsView.getRow(1).isSeparator());
			assert.isNumber(
				dialog.collectionsView.getRowIndexByID(`L${Zotero.Libraries.userLibraryID}`)
			);
			assert.isNumber(dialog.collectionsView.getRowIndexByID(`C${collection.id}`));
			assert.isFalse(dialog.document.getElementById('zotero-collections-tree-container').hidden);
			assert.isFalse(dialog.document.getElementById('search-toolbar').hidden);
		});

		it("should show only regular candidate items", function () {
			assert.isNumber(dialog.itemsView.getRowIndexByID(candidate1.id));
			assert.isNumber(dialog.itemsView.getRowIndexByID(candidate2.id));
			assert.strictEqual(dialog.itemsView.getRowIndexByID(childNote.id), false);
			assert.strictEqual(dialog.itemsView.getRowIndexByID(excluded.id), false);
		});

		it("should show the Library column before Attachments", async function () {
			let libraryColumn = dialog.itemsView._getColumns()
				.find(column => column.dataKey === 'library');
			assert.isOk(libraryColumn);
			assert.isFalse(libraryColumn.hidden);
			assertLibraryColumnPosition(dialog);

			await dialog.itemsView.selectItem(candidate2.id);
			let rowIndex = dialog.itemsView.getRowIndexByID(candidate2.id);
			let row = dialog.document.getElementById(`${dialog.itemsView.id}-row-${rowIndex}`);
			let icon = row.querySelector('.library .icon-library-group');
			assert.isOk(icon);
			let iconStyle = dialog.getComputedStyle(icon);
			assert.notEqual(iconStyle.backgroundImage, 'none');
			assert.equal(iconStyle.width, '16px');
			assert.equal(iconStyle.height, '16px');
		});

		it("should enable Show in Library for a selected suggestion", async function () {
			let button = dialog.document.querySelector("dialog button[dlgtype='extra1']");
			assert.isFalse(button.hidden);
			assert.isTrue(button.disabled);

			await dialog.itemsView.selectItem(candidate2.id);
			assert.isFalse(button.disabled);
			button.click();
			await waitForCallback(() => showInLibrary.called);
			sinon.assert.calledOnceWithExactly(showInLibrary, [candidate2]);
		});
	});

	describe("with suggestions only from My Library", function () {
		var dialog;

		before(async function () {
			({ dialog } = await openDialog([candidate1.id]));
			await waitForCallback(() => dialog.itemsView.getRowIndexByID(candidate1.id) !== false);
		});

		after(function () {
			if (!dialog.closed) {
				dialog.close();
			}
		});

		it("should not add the Library column", function () {
			let libraryColumn = dialog.itemsView._getColumns()
				.find(column => column.dataKey === 'library');
			assert.isUndefined(libraryColumn);
		});
	});
});
