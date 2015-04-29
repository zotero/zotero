describe("Zotero.Item", function() {
	describe("#getField()", function () {
		it("should return false for valid unset fields on unsaved items", function* () {
			var item = new Zotero.Item('book');
			assert.equal(item.getField('rights'), false);
		});
		
		it("should return false for valid unset fields on unsaved items after setting on another field", function* () {
			var item = new Zotero.Item('book');
			item.setField('title', 'foo');
			assert.equal(item.getField('rights'), false);
		});
		
		it("should return false for invalid unset fields on unsaved items after setting on another field", function* () {
			var item = new Zotero.Item('book');
			item.setField('title', 'foo');
			assert.equal(item.getField('invalid'), false);
		});
	});
	
	describe("#parentID", function () {
		it("should create a child note", function () {
			return Zotero.DB.executeTransaction(function* () {
				var item = new Zotero.Item('book');
				var parentItemID = yield item.save();
				
				item = new Zotero.Item('note');
				item.parentID = parentItemID;
				var childItemID = yield item.save();
				
				item = yield Zotero.Items.getAsync(childItemID);
				assert.ok(item.parentID);
				assert.equal(item.parentID, parentItemID);
			}.bind(this));
		});
	});
	
	describe("#attachmentFilename", function () {
		it("should get and set a filename for a stored file", function* () {
			var filename = "test.txt";
			
			// Create parent item
			var item = new Zotero.Item("book");
			var parentItemID = yield item.save();
			
			// Create attachment item
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.parentID = parentItemID;
			var itemID = yield item.save();
			
			// Should be empty when unset
			assert.equal(item.attachmentFilename, '');
			
			// Set filename
			item.attachmentFilename = filename;
			yield item.save();
			item = yield Zotero.Items.getAsync(itemID);
			
			// Check filename
			assert.equal(item.attachmentFilename, filename);
			
			// Check full path
			var file = Zotero.Attachments.getStorageDirectory(item);
			file.append(filename);
			assert.equal(item.getFile().path, file.path);
		});
	});
});
