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
		it("should throw an error if item type isn't set", function* () {
			var item = new Zotero.Item;
			assert.throws(item.setField.bind(item, 'title', 'test'), "Item type must be set before setting field data");
		})
		
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
			id = yield item.saveTx();
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
			
			yield item.saveTx();
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
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.getField("version"), 1);
		});
		
		it("should save versionNumber for computerProgram", function () {
			var item = new Zotero.Item('computerProgram');
			item.setField("versionNumber", "1.0");
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.getField("versionNumber"), "1.0");
		});
	})
	
	describe("#dateAdded", function () {
		it("should use current time if value was not given for a new item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateAdded, true).getTime(), Date.now(), 1000);
		})
		
		it("should use given value for a new item", function* () {
			var dateAdded = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateAdded = dateAdded;
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.dateAdded, dateAdded);
		})
	})
	
	describe("#dateModified", function () {
		it("should use given value for a new item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.dateModified, dateModified);
		})
		
		it("should use given value when skipDateModifiedUpdate is set for a new item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx({
				skipDateModifiedUpdate: true
			});
			item = yield Zotero.Items.getAsync(id);
			assert.equal(item.dateModified, dateModified);
		})
		
		it("should use current time if value was not given for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			// Save again without changing Date Modified
			yield item.loadItemData();
			item.setField('title', 'Test');
			yield item.saveTx()
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should use current time if the existing value was given for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			// Set Date Modified to existing value
			yield item.loadItemData();
			item.setField('title', 'Test');
			item.dateModified = dateModified;
			yield item.saveTx()
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should use current time if value is not given when skipDateModifiedUpdate is set for a new item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx({
				skipDateModifiedUpdate: true
			});
			item = yield Zotero.Items.getAsync(id);
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 1000);
		})
		
		it("should keep original value when skipDateModifiedUpdate is set for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			// Resave with skipDateModifiedUpdate
			yield item.loadItemData();
			item.setField('title', 'Test');
			yield item.saveTx({
				skipDateModifiedUpdate: true
			})
			assert.equal(item.dateModified, dateModified);
		})
	})
	
	describe("#parentID", function () {
		it("should create a child note", function* () {
			var item = new Zotero.Item('book');
			var parentItemID = yield item.saveTx();
			
			item = new Zotero.Item('note');
			item.parentID = parentItemID;
			var childItemID = yield item.saveTx();
			
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
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			
			item.parentKey = false;
			assert.isFalse(item.hasChanged());
		});
		
		it("should move a top-level note under another item", function* () {
			var noteItem = new Zotero.Item('note');
			var id = yield noteItem.saveTx()
			noteItem = yield Zotero.Items.getAsync(id);
			
			var item = new Zotero.Item('book');
			id = yield item.saveTx();
			var { libraryID, key } = Zotero.Items.getLibraryAndKeyFromID(id);
			
			noteItem.parentKey = key;
			yield noteItem.saveTx();
			
			assert.isFalse(noteItem.isTopLevelItem());
		})
		
		it("should remove top-level item from collections when moving it under another item", function* () {
			// Create a collection
			var collection = new Zotero.Collection;
			collection.name = "Test";
			var collectionID = yield collection.saveTx();
			
			// Create a top-level note and add it to a collection
			var noteItem = new Zotero.Item('note');
			noteItem.addToCollection(collectionID);
			var id = yield noteItem.saveTx()
			noteItem = yield Zotero.Items.getAsync(id);
			
			var item = new Zotero.Item('book');
			id = yield item.saveTx();
			var { libraryID, key } = Zotero.Items.getLibraryAndKeyFromID(id);
			noteItem.parentKey = key;
			yield noteItem.saveTx();
			
			assert.isFalse(noteItem.isTopLevelItem());
		})
	});
	
	describe("#setCreators", function () {
		it("should accept an array of creators in API JSON format", function* () {
			var creators = [
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "author"
				},
				{
					name: "Test Name",
					creatorType: "editor"
				}
			];
			
			var item = new Zotero.Item("journalArticle");
			item.setCreators(creators);
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			yield item.loadCreators();
			assert.sameDeepMembers(item.getCreatorsJSON(), creators);
		})
		
		it("should accept an array of creators in internal format", function* () {
			var creators = [
				{
					firstName: "First",
					lastName: "Last",
					fieldMode: 0,
					creatorTypeID: 1
				},
				{
					firstName: "",
					lastName: "Test Name",
					fieldMode: 1,
					creatorTypeID: 2
				}
			];
			
			var item = new Zotero.Item("journalArticle");
			item.setCreators(creators);
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			yield item.loadCreators();
			assert.sameDeepMembers(item.getCreators(), creators);
		})
	})
	
	describe("#attachmentCharset", function () {
		it("should get and set a value", function* () {
			var charset = 'utf-8';
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.attachmentCharset = charset;
			var itemID = yield item.saveTx();
			item = yield Zotero.Items.getAsync(itemID);
			assert.equal(item.attachmentCharset, charset);
		})
		
		it("should not be marked as changed if not changed", function* () {
			var charset = 'utf-8';
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.attachmentCharset = charset;
			var itemID = yield item.saveTx();
			item = yield Zotero.Items.getAsync(itemID);
			
			// Set charset to same value
			item.attachmentCharset = charset
			assert.isFalse(item.hasChanged());
		})
	})
	
	describe("#attachmentFilename", function () {
		it("should get and set a filename for a stored file", function* () {
			var filename = "test.txt";
			
			// Create parent item
			var item = new Zotero.Item("book");
			var parentItemID = yield item.saveTx();
			
			// Create attachment item
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.parentID = parentItemID;
			var itemID = yield item.saveTx();
			
			// Should be empty when unset
			assert.equal(item.attachmentFilename, '');
			
			// Set filename
			item.attachmentFilename = filename;
			yield item.saveTx();
			item = yield Zotero.Items.getAsync(itemID);
			
			// Check filename
			assert.equal(item.attachmentFilename, filename);
			
			// Check full path
			var file = Zotero.Attachments.getStorageDirectory(item);
			file.append(filename);
			assert.equal(item.getFile().path, file.path);
		});
	})
	
	describe("#setTags", function () {
		it("should save an array of tags in API JSON format", function* () {
			var tags = [
				{
					tag: "A"
				},
				{
					tag: "B"
				}
			];
			var item = new Zotero.Item('journalArticle');
			item.setTags(tags);
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			yield item.loadTags();
			assert.sameDeepMembers(item.getTags(tags), tags);
		})
		
		it("shouldn't mark item as changed if tags haven't changed", function* () {
			var tags = [
				{
					tag: "A"
				},
				{
					tag: "B"
				}
			];
			var item = new Zotero.Item('journalArticle');
			item.setTags(tags);
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			yield item.loadTags();
			item.setTags(tags);
			assert.isFalse(item.hasChanged());
		})
		
		it("should remove an existing tag", function* () {
			var tags = [
				{
					tag: "A"
				},
				{
					tag: "B"
				}
			];
			var item = new Zotero.Item('journalArticle');
			item.setTags(tags);
			var id = yield item.saveTx();
			item = yield Zotero.Items.getAsync(id);
			yield item.loadTags();
			item.setTags(tags.slice(0));
			yield item.saveTx();
			assert.sameDeepMembers(item.getTags(tags), tags.slice(0));
		})
	})
});
