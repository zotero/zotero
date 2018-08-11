describe("Item pane", function () {
	var win, doc, itemsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		itemsView = win.ZoteroPane.itemsView;
	});
	after(function () {
		win.close();
	});
	
	describe("Info pane", function () {
		it("should refresh on item update", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'title')[1];
			assert.equal(label.textContent, '');
			
			item.setField('title', 'Test');
			yield item.saveTx();
			
			var label = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'title')[1];
			assert.equal(label.textContent, 'Test');
			
			yield Zotero.Items.erase(id);
		})
		
		
		it.skip("should swap creator names", function* () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				}
			]);
			yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'creator-0-lastName')[0];
			var parent = label.parentNode;
			assert.isTrue(parent.hasAttribute('contextmenu'));
			
			var menupopup = doc.getAnonymousNodes(itemBox)[0]
				.getElementsByAttribute('id', 'zotero-creator-transform-menu')[0];
			// Fake a right-click
			doc.popupNode = parent;
			menupopup.openPopup(
				parent, "after_start", 0, 0, true, false, new MouseEvent('click', { button: 2 })
			);
			var menuitem = menupopup.getElementsByTagName('menuitem')[0];
			menuitem.click();
			yield waitForItemEvent('modify');
			
			var creator = item.getCreators()[0];
			assert.propertyVal(creator, 'firstName', 'Last');
			assert.propertyVal(creator, 'lastName', 'First');
		});
		
		
		it("shouldn't show Swap Names menu for single-field mode", function* () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					name: "Name",
					creatorType: "author"
				}
			]);
			yield item.saveTx();
			
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var label = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'creator-0-lastName')[0];
			assert.isFalse(label.parentNode.hasAttribute('contextmenu'));
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
			var label = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'place')[1];
			label.click();
			var textbox = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'place')[1];
			textbox.value = "Place";
			
			var menuLabel = doc.getAnonymousNodes(itemBox)[0].getElementsByAttribute('fieldname', 'creator-0-typeID')[0];
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
			var box = doc.getAnonymousNodes(itemBox)[0];
			var label = box.querySelector('label[fieldname="accessDate"][class="zotero-clicky"]');
			label.click();
			var textbox = box.querySelector('textbox[fieldname="accessDate"]');
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
	})
	
	
	describe("Notes pane", function () {
		it("should refresh on child note change", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(function* () {
				item = createUnsavedDataObject('item');
				yield item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				yield note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				yield note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var noteRows = doc.getElementById('zotero-editpane-dynamic-notes');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (noteRows.childNodes.length !== 2);
			
			// Update note text
			note2.setNote('C');
			yield note2.saveTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (Array.from(noteRows.querySelectorAll('label.zotero-box-label')).every(label => label.value != 'C'));
		});
		
		it("should refresh on child note trash", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(function* () {
				item = createUnsavedDataObject('item');
				yield item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				yield note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				yield note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var noteRows = doc.getElementById('zotero-editpane-dynamic-notes');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (noteRows.childNodes.length !== 2);
			
			// Click "-" in first note
			var promise = waitForDialog();
			noteRows.childNodes[0].lastChild.click();
			yield promise;
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (noteRows.childNodes.length !== 1);
		});
		
		it("should refresh on child note delete", function* () {
			var item;
			var note1;
			var note2;
			yield Zotero.DB.executeTransaction(function* () {
				item = createUnsavedDataObject('item');
				yield item.save();
				
				note1 = new Zotero.Item('note');
				note1.parentID = item.id;
				note1.setNote('A');
				yield note1.save();
				
				note2 = new Zotero.Item('note');
				note2.parentID = item.id;
				note2.setNote('B');
				yield note2.save();
			});
			
			var tabs = doc.getElementById('zotero-editpane-tabs');
			var notesTab = doc.getElementById('zotero-editpane-notes-tab');
			var noteRows = doc.getElementById('zotero-editpane-dynamic-notes');
			tabs.selectedItem = notesTab;
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (noteRows.childNodes.length !== 2);
			
			yield note2.eraseTx();
			
			// Wait for note list to update
			do {
				yield Zotero.Promise.delay(1);
			}
			while (noteRows.childNodes.length !== 1);
		});
	});
	
	
	describe("Attachment pane", function () {
		it("should refresh on file rename", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var newName = 'test2.png';
			yield item.renameAttachmentFile(newName);
			
			var itemBox = doc.getElementById('zotero-attachment-box');
			var label = itemBox._id('fileName');
			assert.equal(label.value, newName);
		})
	})
	
	
	describe("Note editor", function () {
		it("should refresh on note update", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			
			var noteEditor = doc.getElementById('zotero-note-editor');
			
			// Wait for the editor
			yield new Zotero.Promise((resolve, reject) => {
				noteEditor.noteField.onInit(() => resolve());
			})
			assert.equal(noteEditor.noteField.value, '');
			
			item.setNote('<p>Test</p>');
			yield item.saveTx();
			
			assert.equal(noteEditor.noteField.value, '<p>Test</p>');
		})
	})
	
	describe("Feed buttons", function() {
		describe("Mark as Read/Unread", function() {
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
				
				let button = doc.getElementById('zotero-feed-item-toggleRead-button');
				
				assert.equal(button.getAttribute('label'), Zotero.getString('pane.item.markAsUnread'));
				yield item.toggleRead(false);
				assert.equal(button.getAttribute('label'), Zotero.getString('pane.item.markAsRead'));
			});
		});
	});
})
