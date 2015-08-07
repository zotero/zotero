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
})
