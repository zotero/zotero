describe("Zotero.Item", function () {
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
	
	describe("#setField", function () {
		it("should mark a field as changed", function () {
			var item = new Zotero.Item('book');
			item.setField('title', 'Foo');
			assert.ok(item._changed.itemData[Zotero.ItemFields.getID('title')]);
			assert.ok(item.hasChanged());
		})
		
		it("should clear an existing field set to a falsy value", function () {
			var field = 'title';
			var fieldID = Zotero.ItemFields.getID(field);
			var item = new Zotero.Item('book');
			item.setField(field, 'Foo');
			id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			item.setField(field, "");
			assert.ok(item._changed.itemData[fieldID]);
			assert.ok(item.hasChanged());
			yield item.reload();
			
			assert.isFalse(item.hasChanged());
			
			item.setField(field, false);
			assert.ok(item._changed.itemData[fieldID]);
			assert.ok(item.hasChanged());
			yield item.reload();
			
			assert.isFalse(item.hasChanged());
			
			item.setField(field, null);
			assert.ok(item._changed.itemData[fieldID]);
			assert.ok(item.hasChanged());
			
			yield item.save();
			assert.isFalse(item.getField(fieldID));
		})
		
		it("should not mark an empty field set to an empty string as changed", function () {
			var item = new Zotero.Item('book');
			item.setField('url', '');
			assert.isUndefined(item._changed.itemData);
		})
		
		it("should save version as object version", function* () {
			var item = new Zotero.Item('book');
			item.setField("version", 1);
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.getField("version"), 1);
		});
		
		it("should save versionNumber for computerProgram", function () {
			var item = new Zotero.Item('computerProgram');
			item.setField("versionNumber", "1.0");
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.getField("versionNumber"), "1.0");
		});
	})
	
	describe("#dateModified", function () {
		it("should use given Date Modified for a new item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.dateModified, dateModified);
		})
		
		it("should use given Date Modified when skipDateModifiedUpdate is set for a new item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.save({
				skipDateModifiedUpdate: true
			});
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.dateModified, dateModified);
		})
		
		it("should use current time if Date Modified was not given for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			// Save again without changing Date Modified
			yield item.loadItemData();
			item.setField('title', 'Test');
			yield item.save()
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should use current time if the existing Date Modified value was given for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			// Set Date Modified to existing value
			yield item.loadItemData();
			item.setField('title', 'Test');
			item.dateModified = dateModified;
			yield item.save()
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should use current time if Date Modified is not given when skipDateModifiedUpdate is set for a new item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.save({
				skipDateModifiedUpdate: true
			});
			item = yield Zotero.Items.getAsync(id);
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should keep original Date Modified when skipDateModifiedUpdate is set for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			// Resave with skipDateModifiedUpdate
			yield item.loadItemData();
			item.setField('title', 'Test');
			yield item.save({
				skipDateModifiedUpdate: true
			})
			assert.equal(item.dateModified, dateModified);
		})
	})
	
	describe("#parentID", function () {
		it("should create a child note", function* () {
			var item = new Zotero.Item('book');
			var parentItemID = yield item.save();
			
			item = new Zotero.Item('note');
			item.parentID = parentItemID;
			var childItemID = yield item.save();
			
			item = yield Zotero.Items.getAsync(childItemID);
			assert.ok(item.parentID);
			assert.equal(item.parentID, parentItemID);
		});
	});
	
	describe("#parentKey", function () {
		it("should be false for an unsaved attachment", function () {
			var item = new Zotero.Item('attachment');
			assert.isFalse(item.parentKey);
		});
		
		it("should be false on an unsaved non-attachment item", function () {
			var item = new Zotero.Item('book');
			assert.isFalse(item.parentKey);
		});
		
		it("should not be marked as changed setting to false on an unsaved item", function () {
			var item = new Zotero.Item('attachment');
			item.attachmentLinkMode = 'linked_url';
			item.parentKey = false;
			assert.isUndefined(item._changed.parentKey);
		});
		
		it("should not mark item as changed if false and no existing parent", function* () {
			var item = new Zotero.Item('attachment');
			item.attachmentLinkMode = 'linked_url';
			item.url = "https://www.zotero.org/";
			var id = yield item.save();
			item = yield Zotero.Items.getAsync(id);
			
			item.parentKey = false;
			assert.isFalse(item.hasChanged());
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
