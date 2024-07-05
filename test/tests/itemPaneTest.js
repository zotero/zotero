describe("Item pane", function () {
	var win, doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane, itemsView;

	async function waitForPreviewBoxRender(box) {
		let res = await waitForCallback(
			() => box._asyncRenderItemID && !box._asyncRendering,
			100, 3);
		if (res instanceof Error) {
			throw res;
		}
		return true;
	}

	async function waitForPreviewBoxReader(box, itemID) {
		let preview = box._preview;
		await waitForPreviewBoxRender(box);
		let res = await waitForCallback(
			() => preview._reader?.itemID == itemID
				&& !preview._isProcessingTask && !preview._lastTask
			, 100, 3);
		if (res instanceof Error) {
			throw res;
		}
		await preview._reader._initPromise;
		return true;
	}

	function isPreviewDisplayed(box) {
		return !!(box._preview.hasPreview
			&& win.getComputedStyle(box._preview).display !== "none");
	}
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		ZoteroContextPane = win.ZoteroContextPane;
		itemsView = win.ZoteroPane.itemsView;
	});
	after(function () {
		win.close();
	});

	describe("Item pane header", function () {
		let itemData = {
			itemType: 'book',
			title: 'Birds - A Primer of Ornithology (Teach Yourself Books)',
			creators: [{
				creatorType: 'author',
				lastName: 'Hyde',
				firstName: 'George E.'
			}]
		};
		
		before(async function () {
			await Zotero.Styles.init();
		});
		
		after(function () {
			Zotero.Prefs.clear('itemPaneHeader');
			Zotero.Prefs.clear('itemPaneHeader.bibEntry.style');
			Zotero.Prefs.clear('itemPaneHeader.bibEntry.locale');
		});
		
		it("should be hidden when set to None mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'none');
			await createDataObject('item', itemData);
			assert.equal(doc.querySelector('item-pane-header').clientHeight, 0);
		});

		it("should show custom header elements when set to None mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'none');

			// Use feed item toggle button as an example
			let feed = await createFeed();
			await selectLibrary(win, feed.libraryID);
			await waitForItemsLoad(win);

			var item = await createDataObject('feedItem', { libraryID: feed.libraryID });
			await ZoteroPane.selectItem(item.id);
			let feedButton = ZoteroPane.itemPane._itemDetails.querySelector('.feed-item-toggleRead-button');
			assert.exists(feedButton);

			await selectLibrary(win);
		});
		
		it("should show title when set to Title mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'title');
			let item = await createDataObject('item', itemData);
			
			assert.isFalse(doc.querySelector('item-pane-header .title').hidden);
			assert.isTrue(doc.querySelector('item-pane-header .creator-year').hidden);
			assert.isTrue(doc.querySelector('item-pane-header .bib-entry').hidden);
			
			assert.equal(doc.querySelector('item-pane-header .title editable-text').value, item.getField('title'));
		});
		
		it("should show title/creator/year when set to Title/Creator/Year mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'titleCreatorYear');
			let item = await createDataObject('item', itemData);
			item.setField('date', '1962-05-01');
			await item.saveTx();
			
			assert.isTrue(doc.querySelector('item-pane-header .bib-entry').hidden);
			assert.isFalse(doc.querySelector('item-pane-header .title').hidden);
			assert.isFalse(doc.querySelector('item-pane-header .creator-year').hidden);
			
			assert.equal(doc.querySelector('item-pane-header .title editable-text').value, item.getField('title'));
			let creatorYearText = doc.querySelector('item-pane-header .creator-year').textContent;
			assert.include(creatorYearText, 'Hyde');
			assert.include(creatorYearText, '1962');
		});

		it("should show bib entry when set to Bibliography Entry mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'bibEntry');
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/apa');
			await createDataObject('item', itemData);

			assert.isFalse(doc.querySelector('item-pane-header .bib-entry').hidden);
			assert.isTrue(doc.querySelector('item-pane-header .title').hidden);
			assert.isTrue(doc.querySelector('item-pane-header .creator-year').hidden);

			let bibEntry = doc.querySelector('item-pane-header .bib-entry').shadowRoot.firstElementChild.textContent;
			assert.equal(bibEntry.trim(), 'Hyde, G. E. (n.d.). Birds—A Primer of Ornithology (Teach Yourself Books).');
		});

		it("should update bib entry on item change when set to Bibliography Entry mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'bibEntry');
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/apa');
			let item = await createDataObject('item', itemData);
			
			let bibEntryElem = doc.querySelector('item-pane-header .bib-entry').shadowRoot.firstElementChild;
			
			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, G. E. (n.d.). Birds—A Primer of Ornithology (Teach Yourself Books).');
			
			item.setField('date', '1962-05-01');
			await item.saveTx();
			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, G. E. (1962). Birds—A Primer of Ornithology (Teach Yourself Books).');
			
			item.setCreators([
				{
					creatorType: 'author',
					lastName: 'Smith',
					firstName: 'John'
				}
			]);
			await item.saveTx();
			assert.equal(bibEntryElem.textContent.trim(), 'Smith, J. (1962). Birds—A Primer of Ornithology (Teach Yourself Books).');
			
			item.setField('title', 'Birds');
			await item.saveTx();
			assert.equal(bibEntryElem.textContent.trim(), 'Smith, J. (1962). Birds.');
		});

		it("should update bib entry on style change when set to Bibliography Entry mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'bibEntry');
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/apa');
			await createDataObject('item', itemData);

			let bibEntryElem = doc.querySelector('item-pane-header .bib-entry').shadowRoot.firstElementChild;
			
			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, G. E. (n.d.). Birds—A Primer of Ornithology (Teach Yourself Books).');
			
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/chicago-author-date');
			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, George E. n.d. Birds - A Primer of Ornithology (Teach Yourself Books).');
		});

		it("should update bib entry on locale change when set to Bibliography Entry mode", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'bibEntry');
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/apa');
			await createDataObject('item', itemData);

			let bibEntryElem = doc.querySelector('item-pane-header .bib-entry').shadowRoot.firstElementChild;

			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, G. E. (n.d.). Birds—A Primer of Ornithology (Teach Yourself Books).');

			Zotero.Prefs.set('itemPaneHeader.bibEntry.locale', 'de-DE');
			assert.equal(bibEntryElem.textContent.trim(), 'Hyde, G. E. (o. J.). Birds—A Primer of Ornithology (Teach Yourself Books).');
		});

		it("should fall back to Title/Creator/Year when citation style is missing", async function () {
			Zotero.Prefs.set('itemPaneHeader', 'bibEntry');
			Zotero.Prefs.set('itemPaneHeader.bibEntry.style', 'http://www.zotero.org/styles/an-id-that-does-not-match-any-citation-style');
			await createDataObject('item', itemData);

			assert.isTrue(doc.querySelector('item-pane-header .bib-entry').hidden);
			assert.isFalse(doc.querySelector('item-pane-header .title').hidden);
			assert.isFalse(doc.querySelector('item-pane-header .creator-year').hidden);
		});
	});
	
	describe("Info pane", function () {
		it("should place Title after Item Type and before creators", async function () {
			var item = await createDataObject('item');
			var itemPane = win.ZoteroPane.itemPane;
			var fields = [...itemPane.querySelectorAll('.meta-label')]
				.map(x => x.getAttribute('fieldname'));
			assert.equal(fields[0], 'itemType');
			assert.equal(fields[1], 'title');
			assert.isTrue(fields[2].startsWith('creator'));
		});
		
		it("should refresh on item update", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelectorAll('[fieldname="series"]')[1];
			assert.equal(label.value, '');
			
			item.setField('series', 'Test');
			yield item.saveTx();
			
			label = itemBox.querySelectorAll('[fieldname="series"]')[1];
			assert.equal(label.value, 'Test');
			
			yield Zotero.Items.erase(id);
		});
		
		
		it("should swap creator names", async function () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				}
			]);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var lastName = itemBox.querySelector('#itembox-field-value-creator-0-lastName');
			var parent = lastName.closest(".creator-type-value");
			assert.property(parent, 'oncontextmenu');
			assert.isFunction(parent.oncontextmenu);
			
			var menupopup = itemBox.querySelector('#zotero-creator-transform-menu');
			// Fake a right-click
			doc.popupNode = parent;
			menupopup.openPopup(
				parent, "after_start", 0, 0, true, false, new MouseEvent('click', { button: 2 })
			);
			var menuitem = menupopup.getElementsByTagName('menuitem')[0];
			menuitem.click();
			await waitForItemEvent('modify');
			
			var creator = item.getCreators()[0];
			assert.propertyVal(creator, 'firstName', 'Last');
			assert.propertyVal(creator, 'lastName', 'First');
		});
		
		
		it("shouldn't show Swap Names option for single-field mode", async function () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					name: "Name",
					creatorType: "author"
				}
			]);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('#itembox-field-value-creator-0-lastName');
			var firstlast = label.closest('.creator-type-value');
			firstlast.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 }));
			
			var menuitem = doc.getElementById('creator-transform-swap-names');
			assert.isTrue(menuitem.hidden);
		});

		it("should reorder creators", async function () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					lastName: "One",
					creatorType: "author"
				},
				{
					lastName: "Two",
					creatorType: "author"
				},
				{
					lastName: "Three",
					creatorType: "author"
				}
			]);
			await item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			// Move One to the last spot
			itemBox.moveCreator(0, null, 3);
			await waitForItemEvent('modify');
			let thirdLastName = itemBox.querySelector("[fieldname='creator-2-lastName']").value;
			assert.equal(thirdLastName, "One");

			// Move One to the second spot
			itemBox.moveCreator(2, null, 1);
			await waitForItemEvent('modify');
			let secondLastname = itemBox.querySelector("[fieldname='creator-1-lastName']").value;
			assert.equal(secondLastname, "One");

			// Move Two down
			itemBox.moveCreator(0, 'down');
			await waitForItemEvent('modify');
			secondLastname = itemBox.querySelector("[fieldname='creator-1-lastName']").value;
			let firstLastName = itemBox.querySelector("[fieldname='creator-0-lastName']").value;
			assert.equal(secondLastname, "Two");
			assert.equal(firstLastName, "One");

			// Move Three up
			itemBox.moveCreator(2, 'up');
			await waitForItemEvent('modify');
			secondLastname = itemBox.querySelector("[fieldname='creator-1-lastName']").value;
			thirdLastName = itemBox.querySelector("[fieldname='creator-2-lastName']").value;
			assert.equal(secondLastname, "Three");
			assert.equal(thirdLastName, "Two");
		});
		
		
		// Note: This issue applies to all context menus in the item box (text transform, name swap),
		// though the others aren't tested. This might go away with the XUL->HTML transition.
		it.skip("should save open field after changing creator type", function* () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				}
			]);
			var id = yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = itemBox.querySelector('[fieldname="place"]');
			label.click();
			var textbox = itemBox.querySelector('[fieldname="place"]');
			textbox.value = "Place";
			
			var menuLabel = itemBox.querySelector('[fieldname="creator-0-typeID"]');
			menuLabel.click();
			var menupopup = itemBox._creatorTypeMenu;
			var menuItems = menupopup.getElementsByTagName('menuitem');
			menuItems[1].click();
			yield waitForItemEvent('modify');
			
			assert.equal(item.getField('place'), 'Place');
			assert.equal(Zotero.CreatorTypes.getName(item.getCreators()[0].creatorTypeID), 'contributor');
			
			// Wait for no-op saveTx()
			yield Zotero.Promise.delay(1);
		});
		
		it("should accept 'now' for Accessed", async function () {
			var item = await createDataObject('item');
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var textbox = itemBox.querySelector('[fieldname="accessDate"]');
			textbox.value = 'now';
			// Blur events don't necessarily trigger if window doesn't have focus
			itemBox.hideEditor(textbox);
			
			await waitForItemEvent('modify');
			
			assert.approximately(
				Zotero.Date.sqlToDate(item.getField('accessDate'), true).getTime(),
				Date.now(),
				5000
			);
		});

		it("should persist fieldMode after hiding a creator name editor", async function () {
			let item = new Zotero.Item('book');
			item.setCreators([
				{
					name: "First Last",
					creatorType: "author",
					fieldMode: 1
				}
			]);
			await item.saveTx();
			
			let itemBox = doc.getElementById('zotero-editpane-item-box');

			itemBox.querySelector('[fieldname="creator-0-lastName"]').click();
			itemBox.hideEditor(itemBox.querySelector('input[fieldname="creator-0-lastName"]'));
			
			assert.equal(
				itemBox.querySelector('[fieldname="creator-0-lastName"]').getAttribute('fieldMode'),
				'1'
			);
		});
	});

	describe("Libraries and collections pane", function () {
		var item, collectionParent, collectionChild, section;

		// Fresh setup of an item belonging to 2 collections - parent and child - for each test
		beforeEach(async function () {
			collectionParent = await createDataObject('collection');
			collectionChild = await createDataObject('collection', { parentID: collectionParent.id });
			item = await createDataObject('item', { collections: [collectionParent.id, collectionChild.id] });
			await ZoteroPane.selectItem(item.id);
			section = ZoteroPane.itemPane._itemDetails.getPane("libraries-collections");
		});
		
		it("should update collection's name after rename", async function () {
			collectionChild.name = "Updated collection name";
			collectionChild.saveTx();

			await waitForNotifierEvent('modify', 'collection');

			let collectionRow = section.querySelector(`.row[data-id="C${collectionChild.id}"]`);
			assert.equal(collectionRow.innerText, collectionChild.name);
		});

		it("should remove collection that has been trashed", async function () {
			collectionChild.deleted = true;
			collectionChild.saveTx();

			await waitForNotifierEvent('trash', 'collection');

			let rowIDs = [...section.querySelectorAll(".row")].map(node => node.dataset.id);
			assert.deepEqual(rowIDs, [`L${item.libraryID}`, `C${collectionParent.id}`]);
		});

		it("should bring back collection restored from trash", async function () {
			collectionChild.deleted = true;
			collectionChild.saveTx();

			await waitForNotifierEvent('trash', 'collection');

			// Make sure the collection is actually gone
			let rowIDs = [...section.querySelectorAll(".row")].map(node => node.dataset.id);
			assert.deepEqual(rowIDs, [`L${item.libraryID}`, `C${collectionParent.id}`]);

			// Restore the collection from trash
			collectionChild.deleted = false;
			collectionChild.saveTx();

			await waitForNotifierEvent('modify', 'collection');

			// The collection row should appear again
			rowIDs = [...section.querySelectorAll(".row")].map(node => node.dataset.id);
			assert.deepEqual(rowIDs, [`L${item.libraryID}`, `C${collectionParent.id}`, `C${collectionChild.id}`]);
		});
	});

	describe("Attachments pane", function () {
		let paneID = "attachments";

		beforeEach(function () {
			Zotero.Prefs.set("panes.attachments.open", true);
			Zotero.Prefs.set("showAttachmentPreview", true);
			Zotero_Tabs.select("zotero-pane");
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should show attachments pane in library for regular item", async function () {
			// Regular item: show
			let attachmentsBox = ZoteroPane.itemPane._itemDetails.getPane(paneID);
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			assert.isFalse(attachmentsBox.hidden);

			// Child attachment: hide
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await ZoteroPane.selectItem(attachment.id);
			assert.isTrue(attachmentsBox.hidden);

			// Standalone attachment: hide
			let attachment1 = await importFileAttachment('test.pdf');
			await ZoteroPane.selectItem(attachment1.id);
			assert.isTrue(attachmentsBox.hidden);
		});

		it("should not show attachments pane preview in reader best-matched attachment item", async function () {
			let item = new Zotero.Item('book');
			let file = getTestDataDirectory();
			file.append('test.pdf');
			await item.saveTx();
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await ZoteroPane.viewItems([attachment]);
			let tabID = Zotero_Tabs.selectedID;
			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			let attachmentsBox = itemDetails.getPane(paneID);
			assert.isFalse(attachmentsBox.hidden);

			await waitForScrollToPane(itemDetails, paneID);
			
			assert.isFalse(isPreviewDisplayed(attachmentsBox));
		});

		it("should not show attachments pane in reader standalone attachment item", async function () {
			let attachment = await importFileAttachment('test.pdf');
			await ZoteroPane.viewItems([attachment]);
			let tabID = Zotero_Tabs.selectedID;
			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			let attachmentsBox = itemDetails.getPane(paneID);
			assert.isTrue(attachmentsBox.hidden);
		});

		it("should show attachments pane preview in reader non-best-matched attachment item", async function () {
			let item = new Zotero.Item('book');
			let file = getTestDataDirectory();
			file.append('test.pdf');
			await item.saveTx();
			await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});

			let bestAttachments = await item.getBestAttachments();
			await ZoteroPane.viewItems([bestAttachments[1]]);
			// Ensure context pane is open
			ZoteroContextPane.splitter.setAttribute("state", "open");
			await waitForFrame();
			let tabID = Zotero_Tabs.selectedID;
			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			let attachmentsBox = itemDetails.getPane(paneID);
			assert.isFalse(attachmentsBox.hidden);

			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(attachmentsBox);
			assert.isTrue(isPreviewDisplayed(attachmentsBox));
		});

		it("should not render attachments pane preview when show preview is disabled", async function () {
			Zotero.Prefs.set("showAttachmentPreview", false);

			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			assert.isFalse(attachmentsBox.hidden);

			await waitForScrollToPane(itemDetails, paneID);

			assert.isFalse(isPreviewDisplayed(attachmentsBox));
		});

		it("should only render after attachments pane becomes visible", async function () {
			// Resize to very small height to ensure the attachment box is not in view
			let height = doc.documentElement.clientHeight;
			win.resizeTo(null, 100);

			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let preview = attachmentsBox._preview;
			// Force discard previous preview
			await preview.discard(true);
			
			let item = new Zotero.Item('book');
			await item.saveTx();
			let file = getTestDataDirectory();
			file.append('test.pdf');
			await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});

			await ZoteroPane.selectItem(item.id);
			assert.isFalse(itemDetails.isPaneVisible(paneID));
			// Do not use _isAlreadyRendered, since that changes the render flag state
			assert.equal(attachmentsBox._syncRenderItemID, item.id);
			assert.notEqual(attachmentsBox._asyncRenderItemID, item.id);
			assert.isFalse(isPreviewDisplayed(attachmentsBox));

			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(attachmentsBox);
			// TEMP: wait for a bit to ensure the preview is rendered?
			await Zotero.Promise.delay(100);
			assert.isTrue(itemDetails.isPaneVisible(paneID));
			assert.equal(attachmentsBox._syncRenderItemID, item.id);
			assert.equal(attachmentsBox._asyncRenderItemID, item.id);

			assert.isTrue(isPreviewDisplayed(attachmentsBox));
			assert.isTrue(preview.hasPreview);
			win.resizeTo(null, height);
		});

		it("should update attachments pane when attachments changed", async function () {
			// https://forums.zotero.org/discussion/113632/zotero-7-beta-pdf-attachment-preview-and-annotations-not-refreshed-after-adding-annotations

			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let preview = attachmentsBox._preview;
			// Force discard previous preview
			await preview.discard(true);

			// Pin the pane to ensure it's rendered
			itemDetails.pinnedPane = paneID;

			let item = new Zotero.Item('book');
			await item.saveTx();

			await ZoteroPane.selectItem(item.id);
			assert.isTrue(await waitForPreviewBoxRender(attachmentsBox));
			// No preview
			assert.isFalse(isPreviewDisplayed(attachmentsBox));
			// No row
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 0);

			// Add an attachment
			let file = getTestDataDirectory();
			file.append('test.png');
			let _attachment1 = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await ZoteroPane.selectItem(item.id);
			await itemDetails._renderPromise;
			await waitForPreviewBoxRender(attachmentsBox);
			// Image preview for item with image attachment
			assert.isTrue(isPreviewDisplayed(attachmentsBox));
			assert.equal(preview.previewType, "image");
			// 1 row
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 1);

			// Add an PDF attachment, which will be best match and update the preview
			file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment2 = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await waitForPreviewBoxReader(attachmentsBox, attachment2.id);
			await Zotero.Promise.delay(100);
			// PDF preview
			assert.isTrue(isPreviewDisplayed(attachmentsBox));
			assert.equal(preview.previewType, "pdf");
			// 2 rows
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 2);
			// Simulate an extra 'add' event on the attachment - still 2 rows
			attachmentsBox.notify('add', 'item', [attachment2.id]);
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 2);

			// Created annotations should be update in preview and attachment row
			let annotation = await createAnnotation('highlight', attachment2);
			await Zotero.Promise.delay(100);
			// Annotation updated in preview reader
			let readerAnnotation
				= preview._reader._internalReader._annotationManager._annotations.find(
					a => a.libraryID === annotation.libraryID && a.id === annotation.key
				);
			assert.exists(readerAnnotation);

			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 2);
			let attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment2.id}"]`);
			assert.isFalse(attachmentRow._annotationButton.hidden);
			// 1 annotation
			assert.equal(attachmentRow._annotationButton.querySelector('.label').textContent, "1");

			// Deleted annotations should be removed from preview and attachment row
			await annotation.eraseTx();
			await Zotero.Promise.delay(100);
			// Annotation removed from preview reader
			readerAnnotation
				= preview._reader._internalReader._annotationManager._annotations.find(
					a => a.libraryID === annotation.libraryID && a.id === annotation.key
				);
			assert.notExists(readerAnnotation);
			// Row might be recreated
			attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment2.id}"]`);
			assert.isTrue(attachmentRow._annotationButton.hidden);
			// 0 annotation
			assert.equal(attachmentRow._annotationButton.querySelector('.label').textContent, "0");

			// Delete attachment
			await attachment2.eraseTx();
			await Zotero.Promise.delay(100);
			// Image preview for item with image attachment
			assert.isTrue(isPreviewDisplayed(attachmentsBox));
			assert.equal(preview.previewType, "image");
			// 1 row
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 1);
			// The corresponding row should be removed
			attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment2.id}"]`);
			assert.notExists(attachmentRow);

			// Unpin
			itemDetails.pinnedPane = "";
		});

		it("should keep attachments pane preview status after switching tab", async function () {
			// https://forums.zotero.org/discussion/113658/zotero-7-beta-preview-appearing-in-the-item-pane-of-the-pdf-tab

			let item = new Zotero.Item('book');
			let file = getTestDataDirectory();
			file.append('test.pdf');
			await item.saveTx();
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});

			// Open reader
			await ZoteroPane.viewItems([attachment]);
			let tabID = Zotero_Tabs.selectedID;
			await Zotero.Reader.getByTabID(tabID)._waitForReader();
			// Ensure context pane is open
			ZoteroContextPane.splitter.setAttribute("state", "open");
			await waitForFrame();

			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			let attachmentsBox = itemDetails.getPane(paneID);
			assert.isFalse(attachmentsBox.hidden);

			await waitForScrollToPane(itemDetails, paneID);
			assert.isFalse(isPreviewDisplayed(attachmentsBox));

			// Select library tab
			Zotero_Tabs.select("zotero-pane");
			let libraryItemDetails = ZoteroPane.itemPane._itemDetails;
			let libraryAttachmentsBox = libraryItemDetails.getPane(paneID);
			await ZoteroPane.selectItem(item.id);
			await waitForScrollToPane(libraryItemDetails, paneID);
			// Collapse section
			libraryAttachmentsBox.querySelector('collapsible-section > .head').click();
			await Zotero.Promise.delay(50);
			// Open section
			libraryAttachmentsBox.querySelector('collapsible-section > .head').click();
			await Zotero.Promise.delay(50);
			
			// Select reader tab
			Zotero_Tabs.select(tabID);

			// Make sure the preview status is not changed in reader
			assert.isFalse(isPreviewDisplayed(attachmentsBox));
		});

		/**
		 * This test is essential to ensure the proper functioning of the sync/async rendering,
		 * scrolling handler, and pinning mechanism of ItemDetails.
		 * AttachmentsBox serves as a good example since it involves both sync and async rendering.
		 * If this test fails, it is not recommended to add timeouts as a quick fix.
		 */
		it("should keep attachments pane status after changing selection", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let preview = attachmentsBox._preview;

			// Pin the pane to avoid always scrolling to the section
			itemDetails.pinnedPane = paneID;

			// item with attachment (1 annotation)
			let item1 = new Zotero.Item('book');
			await item1.saveTx();
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment1 = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item1.id
			});
			let annotation = await createAnnotation('highlight', attachment1);

			await itemDetails._renderPromise;
			await waitForPreviewBoxReader(attachmentsBox, attachment1.id);

			assert.isFalse(attachmentsBox.hidden);
			let readerAnnotation
				= preview._reader._internalReader._annotationManager._annotations.find(
					a => a.libraryID === annotation.libraryID && a.id === annotation.key
				);
			assert.exists(readerAnnotation);
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 1);
			let attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment1.id}"]`);
			assert.isFalse(attachmentRow._annotationButton.hidden);
			// 1 annotation
			assert.equal(attachmentRow._annotationButton.querySelector('.label').textContent, "1");

			// item with attachment (no annotation)
			let item2 = new Zotero.Item('book');
			await item2.saveTx();
			file = getTestDataDirectory();
			file.append('wonderland_short.pdf');
			let attachment2 = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item2.id
			});

			// Select item with attachment (no annotation)
			await itemDetails._renderPromise;
			await waitForPreviewBoxReader(attachmentsBox, attachment2.id);

			assert.isFalse(attachmentsBox.hidden);
			readerAnnotation
				= preview._reader._internalReader._annotationManager._annotations.find(
					a => a.libraryID === annotation.libraryID && a.id === annotation.key
				);
			assert.notExists(readerAnnotation);
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 1);
			attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment2.id}"]`);
			assert.isTrue(attachmentRow._annotationButton.hidden);
			// 0 annotation
			assert.equal(attachmentRow._annotationButton.querySelector('.label').textContent, "0");

			let item3 = new Zotero.Item('book');
			await item3.saveTx();

			// Select item without attachment
			await itemDetails._renderPromise;

			assert.isFalse(attachmentsBox.hidden);
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 0);

			// Again, select item with attachment (1 annotation)
			await ZoteroPane.selectItem(item1.id);
			await itemDetails._renderPromise;
			await waitForPreviewBoxReader(attachmentsBox, attachment1.id);

			assert.isFalse(attachmentsBox.hidden);
			readerAnnotation
				= preview._reader._internalReader._annotationManager._annotations.find(
					a => a.libraryID === annotation.libraryID && a.id === annotation.key
				);
			assert.exists(readerAnnotation);
			assert.equal(attachmentsBox.querySelectorAll("attachment-row").length, 1);
			attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment1.id}"]`);
			assert.isFalse(attachmentRow._annotationButton.hidden);
			// 1 annotation
			assert.equal(attachmentRow._annotationButton.querySelector('.label').textContent, "1");

			// Unpin
			itemDetails.pinnedPane = "";
		});

		it("should open attachment on clicking attachment row", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);

			let item = new Zotero.Item('book');
			await item.saveTx();
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});

			await ZoteroPane.selectItem(item.id);
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(attachmentsBox);

			let attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment.id}"]`);
			attachmentRow._attachmentButton.click();
			await Zotero.Promise.delay(100);
			let reader = await Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			// Should open attachment
			assert.equal(reader.itemID, attachment.id);
		});

		it("should select attachment on clicking annotation button of attachment row", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);

			let item = new Zotero.Item('book');
			await item.saveTx();
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			let _annotation = await createAnnotation('highlight', attachment);

			await ZoteroPane.selectItem(item.id);
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(attachmentsBox);

			let attachmentRow = attachmentsBox.querySelector(`attachment-row[attachment-id="${attachment.id}"]`);
			attachmentRow._annotationButton.click();
			await Zotero.Promise.delay(100);
			// Should select attachment
			assert.equal(ZoteroPane.getSelectedItems(true)[0], attachment.id);
		});

		it("should open attachment on double-clicking attachments pane preview", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let preview = attachmentsBox._preview;

			let item = new Zotero.Item('book');
			await item.saveTx();
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});

			await ZoteroPane.selectItem(item.id);
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(attachmentsBox);

			let event = new MouseEvent('dblclick', {
				bubbles: true,
				cancelable: true,
				view: window
			});
			preview.dispatchEvent(event);
			await Zotero.Promise.delay(100);
			let reader = await Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			// Should open attachment
			assert.equal(reader.itemID, attachment.id);
		});

		it("should render preview robustly after making dense calls to render and discard", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let attachmentsBox = itemDetails.getPane(paneID);
			let preview = attachmentsBox._preview;

			// Pin the pane to avoid always scrolling to the section
			itemDetails.pinnedPane = paneID;

			// item with attachment
			let item1 = new Zotero.Item('book');
			await item1.saveTx();
			let file1 = getTestDataDirectory();
			file1.append('test.pdf');
			let attachment1 = await Zotero.Attachments.importFromFile({
				file: file1,
				parentItemID: item1.id
			});

			let item2 = new Zotero.Item('book');
			await item2.saveTx();
			let file2 = getTestDataDirectory();
			file2.append('test.pdf');
			let attachment2 = await Zotero.Attachments.importFromFile({
				file: file2,
				parentItemID: item2.id
			});

			let selectionMap = [item1.id, item2.id];
			// Repeat render/discard multiple times
			for (let i = 0; i < 10; i++) {
				await ZoteroPane.selectItem(selectionMap[i % 2]);

				// No await, since the render/discard may be triggered at any time in actual usage
				preview.discard();
				preview.render();
			}

			// Wait for the last render/discard task to finish
			await waitForCallback(() => !preview._isRendering && !preview._isDiscarding
				&& !preview._isProcessingTask && !preview._isWaitingForTask
				&& !preview._lastTask);

			// Should be able to render the correct preview
			await ZoteroPane.selectItem(item1.id);
			await waitForPreviewBoxReader(attachmentsBox, attachment1.id);
			assert.isTrue(isPreviewDisplayed(attachmentsBox));

			await ZoteroPane.selectItem(item2.id);
			await waitForPreviewBoxReader(attachmentsBox, attachment2.id);
			assert.isTrue(isPreviewDisplayed(attachmentsBox));

			itemDetails.pinnedPane = "";
		});
	});
	
	
	describe("Notes pane", function () {
		it("should refresh on child note change", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});
			
			var body = doc.querySelector('#zotero-editpane-notes .body');
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (body.querySelectorAll('.row .label').length !== 2);
			
			// Update note text
			note2.setNote('C');
			yield note2.saveTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while ([...body.querySelectorAll('.row .label')].every(label => label.textContent != 'C'));
		});
		
		it("should refresh on child note trash", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});

			var body = doc.querySelector('#zotero-editpane-notes .body');
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (body.querySelectorAll('.row .label').length !== 2);
			
			// Click "-" in first note
			var promise = waitForDialog();
			body.querySelector(".zotero-clicky-minus").click();
			yield promise;
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (body.querySelectorAll('.row .label').length !== 1);
		});
		
		it("should refresh on child note delete", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(async function () {
				item = createUnsavedDataObject('item');
				await item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				await note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				await note2.save();
			});
			
			var body = doc.querySelector('#zotero-editpane-notes .body');
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (body.querySelectorAll('.row .label').length !== 2);
			
			yield note2.eraseTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (body.querySelectorAll('.row .label').length !== 1);
		});
	});
	
	
	describe("Attachment pane", function () {
		let paneID = "attachment-info";

		beforeEach(function () {
			Zotero.Prefs.set("panes.attachment-info.open", true);
			Zotero.Prefs.set("showAttachmentPreview", true);
			Zotero_Tabs.select("zotero-pane");
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should refresh on file rename", async function () {
			let file = getTestDataDirectory();
			file.append('test.png');
			let item = await Zotero.Attachments.importFromFile({
				file: file
			});
			let newName = 'test2.png';

			let itemBox = doc.getElementById('zotero-attachment-box');
			let label = itemBox._id('fileName');
			let promise = waitForDOMAttributes(label, 'value', (newValue) => {
				return newValue === newName;
			});

			await item.renameAttachmentFile(newName);
			
			await promise;
			assert.equal(label.value, newName);
		});
		
		it("should update on attachment title change", async function () {
			let file = getTestDataDirectory();
			file.append('test.png');
			let item = await Zotero.Attachments.importFromFile({ file });
			let newTitle = 'New Title';

			let paneHeader = doc.getElementById('zotero-item-pane-header');
			let label = paneHeader.titleField;
			let promise = Promise.all([
				waitForDOMAttributes(label, 'value', (newValue) => {
					return newValue === newTitle;
				}),
				waitForItemEvent('modify')
			]);

			item.setField('title', newTitle);
			await item.saveTx();
			
			await promise;
			assert.equal(label.value, newTitle);
		});

		it("should show attachment pane in library for attachment item", async function () {
			// Regular item: hide
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let box = itemDetails.getPane(paneID);
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			await waitForScrollToPane(itemDetails, paneID);
			assert.isTrue(box.hidden);

			// Child attachment: show
			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await ZoteroPane.selectItem(attachment.id);
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxReader(box, attachment.id);
			assert.isFalse(box.hidden);
			await Zotero.Promise.delay(100);
			assert.isTrue(isPreviewDisplayed(box));

			// Standalone attachment: show
			let attachment1 = await importFileAttachment('test.pdf');
			await ZoteroPane.selectItem(attachment1.id);
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxReader(box, attachment1.id);
			assert.isFalse(box.hidden);
			await Zotero.Promise.delay(100);
			assert.isTrue(isPreviewDisplayed(box));
		});

		it("should show attachment pane without preview in reader for standalone attachment item", async function () {
			// Attachment item with parent item: hide
			let item = new Zotero.Item('book');
			let file = getTestDataDirectory();
			file.append('test.pdf');
			await item.saveTx();
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: item.id
			});
			await ZoteroPane.viewItems([attachment]);
			let tabID = Zotero_Tabs.selectedID;
			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			let box = itemDetails.getPane(paneID);
			assert.isTrue(box.hidden);

			// Standalone attachment item: show
			attachment = await importFileAttachment('test.pdf');
			await ZoteroPane.viewItems([attachment]);
			tabID = Zotero_Tabs.selectedID;
			itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			box = itemDetails.getPane(paneID);
			assert.isFalse(box.hidden);

			await waitForScrollToPane(itemDetails, paneID);
			// No preview
			assert.isFalse(isPreviewDisplayed(box));
		});

		it("should only show attachment note container when exists", async function () {
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let box = itemDetails.getPane(paneID);
			let noteContainer = box._id("note-container");
			let noteEditor = box._id('attachment-note-editor');

			// Hide note container by default
			let attachment = await importFileAttachment('test.pdf');
			await ZoteroPane.selectItem(attachment.id);
			await itemDetails._renderPromise;
			await waitForScrollToPane(itemDetails, paneID);
			await waitForPreviewBoxRender(box);
			assert.isTrue(noteContainer.hidden);

			// Add attachment note
			let itemModifyPromise = waitForItemEvent("modify");
			attachment.setNote("<h1>TEST</h1>");
			await attachment.saveTx();
			await itemModifyPromise;
			await waitForPreviewBoxRender(box);
			// Should show note container
			assert.isFalse(noteContainer.hidden);
			// Should be readonly
			assert.equal(noteEditor.mode, "view");
		});
	});
	
	
	describe("Note editor", function () {
		it("should refresh on note update", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			
			var noteEditor = doc.getElementById('zotero-note-editor');
			
			// Wait for the editor
			yield new Zotero.Promise((resolve, reject) => {
				noteEditor.onInit(() => resolve());
			});
			assert.equal(noteEditor._editorInstance._iframeWindow.wrappedJSObject.getDataSync(), null);
			item.setNote('<p>Test</p>');
			yield item.saveTx();
			
			// Wait for asynchronous editor update
			do {
				yield Zotero.Promise.delay(10);
			} while (
				!/<div data-schema-version=".*"><p>Test<\/p><\/div>/.test(
					noteEditor._editorInstance._iframeWindow.wrappedJSObject.getDataSync().html.replace(/\n/g, '')
				)
			);
		});
	});
	
	describe("Feed buttons", function() {
		describe("Mark as Read/Unread", function() {
			it("should change an item from unread to read", async function () {
				var feed = await createFeed();
				await select(win, feed);
				
				var item = await createDataObject('feedItem', { libraryID: feed.libraryID });
				
				// Skip timed mark-as-read
				var stub = sinon.stub(win.ZoteroPane, 'startItemReadTimeout');
				await select(win, item);
				
				// Click "Mark as Read"
				var promise = waitForItemEvent('modify');
				var button = ZoteroPane.itemPane.getCurrentPane().querySelector('.feed-item-toggleRead-button');
				assert.equal(button.label, Zotero.getString('pane.item.markAsRead'));
				assert.isFalse(item.isRead);
				button.click();
				var ids = await promise;
				
				assert.sameMembers(ids, [item.id]);
				assert.isTrue(item.isRead);
				// Button is re-created
				button = ZoteroPane.itemPane.getCurrentPane().querySelector('.feed-item-toggleRead-button');
				assert.equal(button.label, Zotero.getString('pane.item.markAsUnread'));
				
				stub.restore();
			});
			
			
			it("should update label when state of an item changes", function* () {
				let feed = yield createFeed();
				yield selectLibrary(win, feed.libraryID);
				yield waitForItemsLoad(win);
				
				var stub = sinon.stub(win.ZoteroPane, 'startItemReadTimeout');
				var item = yield createDataObject('feedItem', { libraryID: feed.libraryID });
				// Skip timed mark-as-read
				assert.ok(stub.called);
				stub.restore();
				item.isRead = true;
				yield item.saveTx();
				
				let button = ZoteroPane.itemPane.getCurrentPane().querySelector('.feed-item-toggleRead-button');
				
				assert.equal(button.label, Zotero.getString('pane.item.markAsUnread'));
				yield item.toggleRead(false);
				// Button is re-created
				button = ZoteroPane.itemPane.getCurrentPane().querySelector('.feed-item-toggleRead-button');
				assert.equal(button.label, Zotero.getString('pane.item.markAsRead'));
			});
		});
	});
	
	describe("Duplicates Merge pane", function () {
		// Same as test in itemsTest, but via UI, which makes a copy via toJSON()/fromJSON()
		it("should transfer merge-tracking relations when merging two pairs into one item", async function () {
			var item1 = await createDataObject('item', { title: 'A' });
			var item2 = await createDataObject('item', { title: 'B' });
			var item3 = await createDataObject('item', { title: 'C' });
			var item4 = await createDataObject('item', { title: 'D' });
			
			var uris = [item2, item3, item4].map(item => Zotero.URI.getItemURI(item));
			
			var p;
			
			var zp = win.ZoteroPane;
			await zp.selectItems([item1.id, item2.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			assert.sameMembers(
				item1.getRelations()[Zotero.Relations.replacedItemPredicate],
				[uris[0]]
			);
			
			await zp.selectItems([item3.id, item4.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			assert.sameMembers(
				item3.getRelations()[Zotero.Relations.replacedItemPredicate],
				[uris[2]]
			);
			
			await zp.selectItems([item1.id, item3.id]);
			zp.mergeSelectedItems();
			p = waitForItemEvent('modify');
			doc.getElementById('zotero-duplicates-merge-button').click();
			await p;
			
			// Remaining item should include all other URIs
			assert.sameMembers(
				item1.getRelations()[Zotero.Relations.replacedItemPredicate],
				uris
			);
		});
	});
});
