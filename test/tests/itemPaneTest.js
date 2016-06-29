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
	})
	
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
	
	describe("Note pane", function () {
		it("should refresh on note update", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			
			// Wait for the editor
			var noteBox = doc.getElementById('zotero-note-editor');
			var val = false;
			do {
				try {
					val = noteBox.noteField.value;
				}
				catch (e) {}
				yield Zotero.Promise.delay(1);
			}
			while (val === false)
			assert.equal(noteBox.noteField.value, '');
			
			item.setNote('<p>Test</p>');
			yield item.saveTx();
			
			assert.equal(noteBox.noteField.value, '<p>Test</p>');
		})
	})
	
	describe("Feed buttons", function() {
		describe("Mark as Read/Unread", function() {
			it("Updates label when state of an item changes", function* () {
				let feed = yield createFeed();
				yield selectLibrary(win, feed.libraryID);
				let item = yield createDataObject('feedItem', {libraryID: feed.libraryID});
				yield itemsView.selectItem(item.id);
				let button = doc.getElementById('zotero-feed-item-toggleRead-button');
				
				assert.equal(button.getAttribute('label'), Zotero.getString('pane.item.markAsUnread'));
				yield item.toggleRead(false);
				assert.equal(button.getAttribute('label'), Zotero.getString('pane.item.markAsRead'));
			});
		});
	});
})
