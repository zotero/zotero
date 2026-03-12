"use strict";

describe("ItemTreeRow", function () {
	var win;
	var ItemTreeRow;
	var ZoteroItemTreeRow;
	var FileItemTreeRow;
	var AnnotationItemTreeRow;
	var CollectionItemTreeRow;
	var SearchItemTreeRow;

	before(async function () {
		win = await loadZoteroPane();
		({
			ItemTreeRow,
			ZoteroItemTreeRow,
			FileItemTreeRow,
			AnnotationItemTreeRow,
			CollectionItemTreeRow,
			SearchItemTreeRow,
		} = win.require('zotero/itemTreeRow'));
		await selectLibrary(win);
	});

	after(function () {
		win.close();
	});

	it("should create row subclasses via factory", async function () {
		let item = await createDataObject('item');
		let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		let annotation = await createAnnotation('highlight', attachment);
		let collection = await createDataObject('collection');
		let search = await createDataObject('search');

		assert.instanceOf(ItemTreeRow.create(item, 0, false), ZoteroItemTreeRow);
		assert.instanceOf(ItemTreeRow.create(attachment, 0, false), FileItemTreeRow);
		assert.instanceOf(ItemTreeRow.create(annotation, 0, false), AnnotationItemTreeRow);
		assert.instanceOf(ItemTreeRow.create(annotation, 0, false), ZoteroItemTreeRow);
		assert.instanceOf(ItemTreeRow.create(collection, 0, false), CollectionItemTreeRow);
		assert.instanceOf(ItemTreeRow.create(search, 0, false), SearchItemTreeRow);
	});

	it("should provide container and child behavior for regular items and file attachments", async function () {
		let item = await createDataObject('item');
		let note = await createDataObject('item', { itemType: 'note', parentID: item.id });
		let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		let annotation = await createAnnotation('highlight', attachment);

		let itemRow = ItemTreeRow.create(item, 0, false);
		assert.isTrue(itemRow.isContainer());
		assert.isFalse(itemRow.isContainerOpen());
		assert.isFalse(itemRow.isContainerEmpty({
			searchMode: false,
			searchItemIDs: new Set(),
			includeTrashed: false,
		}));
		assert.sameMembers(
			itemRow.getChildItems({ includeTrashed: false }).map(x => x.id),
			[note.id, attachment.id]
		);

		let attachmentRow = ItemTreeRow.create(attachment, 1, false);
		assert.isTrue(attachmentRow.isContainer());
		assert.isFalse(attachmentRow.isContainerOpen());
		assert.sameMembers(
			attachmentRow.getChildItems({
				searchMode: false,
				searchItemIDs: new Set(),
				includeTrashed: false,
			}).map(x => x.id),
			[annotation.id]
		);

		let annotationRow = ItemTreeRow.create(annotation, 2, false);
		assert.isFalse(annotationRow.isContainer());
	});

	it("should expose attachment-state behavior by row type", async function () {
		let item = await createDataObject('item');
		let childAttachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		let topLevelAttachment = await importFileAttachment('test.pdf');
		let annotation = await createAnnotation('highlight', topLevelAttachment);
		let note = await createDataObject('item', { itemType: 'note' });
		let collection = await createDataObject('collection');
		let search = await createDataObject('search');

		let itemRow = ItemTreeRow.create(item, 0, false);
		let childAttachmentRow = ItemTreeRow.create(childAttachment, 1, false);
		let topLevelAttachmentRow = ItemTreeRow.create(topLevelAttachment, 0, false);
		let annotationRow = ItemTreeRow.create(annotation, 1, false);
		let noteRow = ItemTreeRow.create(note, 0, false);
		let collectionRow = ItemTreeRow.create(collection, 0, false);
		let searchRow = ItemTreeRow.create(search, 0, false);

		assert.ok(itemRow.getBestAttachmentState()?.then);
		assert.notOk(childAttachmentRow.getBestAttachmentState());
		assert.ok(topLevelAttachmentRow.getBestAttachmentState()?.then);
		assert.notOk(annotationRow.getBestAttachmentState());
		assert.notOk(noteRow.getBestAttachmentState());
		assert.notOk(collectionRow.getBestAttachmentState());
		assert.notOk(searchRow.getBestAttachmentState());
	});

	it("should return localized type labels for all row types", async function () {
		let item = await createDataObject('item', { itemType: 'book' });
		let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		let annotation = await createAnnotation('highlight', attachment);
		let collection = await createDataObject('collection');
		let search = await createDataObject('search');

		let itemRow = ItemTreeRow.create(item, 0, false);
		let attachmentRow = ItemTreeRow.create(attachment, 1, false);
		let annotationRow = ItemTreeRow.create(annotation, 2, false);
		let collectionRow = ItemTreeRow.create(collection, 0, false);
		let searchRow = ItemTreeRow.create(search, 0, false);

		assert.equal(itemRow.getTypeLabel(), Zotero.ItemTypes.getLocalizedString(item.itemTypeID));
		assert.equal(attachmentRow.getTypeLabel(), Zotero.ItemTypes.getLocalizedString(attachment.itemTypeID));
		assert.equal(annotationRow.getTypeLabel(), Zotero.ItemTypes.getLocalizedString(annotation.itemTypeID));
		assert.equal(collectionRow.getTypeLabel(), Zotero.getString('searchConditions.collection'));
		assert.equal(searchRow.getTypeLabel(), Zotero.getString('searchConditions.savedSearch'));
	});

	it("should return filename as display title for file attachment when pref is enabled", async function () {
		let pref = Zotero.Prefs.get('showAttachmentFilenames');
		let item = await createDataObject('item');
		let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		attachment.setField('title', 'Custom Attachment Title');
		await attachment.saveTx();

		try {
			Zotero.Prefs.set('showAttachmentFilenames', false);
			let withoutPref = ItemTreeRow.create(attachment, 1, false);
			assert.equal(withoutPref.getDisplayTitle(), attachment.getDisplayTitle());

			Zotero.Prefs.set('showAttachmentFilenames', true);
			let withPref = ItemTreeRow.create(attachment, 1, false);
			assert.notEqual(withPref.getDisplayTitle(), attachment.getDisplayTitle());
			assert.equal(withPref.getDisplayTitle(), attachment.attachmentFilename);
		}
		finally {
			Zotero.Prefs.set('showAttachmentFilenames', pref);
		}
	});

	it("should render annotation row content with title and comment cells", async function () {
		let item = await createDataObject('item');
		let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
		let annotation = await createAnnotation('highlight', attachment, {
			comment: 'Annotation comment',
		});

		let row = ItemTreeRow.create(annotation, 2, false);
		let div = win.document.createElement('div');
		let columns = [{ dataKey: 'title', className: 'title' }];
		let calls = {
			renderCell: 0,
		};

		let renderCtx = {
			firstColumn: columns[0],
			renderCell: () => {
				calls.renderCell++;
				let span = win.document.createElement('span');
				span.className = 'cell title';
				let text = win.document.createElement('span');
				text.className = 'cell-text';
				span.append(text);
				return span;
			},
		};

		row.renderRow(div, 0, columns, {}, renderCtx);

		assert.equal(row.type, 'annotation');
		assert.isTrue(div.classList.contains('annotation-row'));
		assert.isAbove(calls.renderCell, 0);
		assert.exists(div.querySelector('.annotation-comment'));
	});
});
