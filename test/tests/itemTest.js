"use strict";

describe("Zotero.Item", function () {
	describe("#getField()", function () {
		it("should return an empty string for valid unset fields on unsaved items", function () {
			var item = new Zotero.Item('book');
			assert.strictEqual(item.getField('rights'), "");
		});
		
		it("should return an empty string for valid unset fields on unsaved items after setting on another field", function () {
			var item = new Zotero.Item('book');
			item.setField('title', 'foo');
			assert.strictEqual(item.getField('rights'), "");
		});
		
		it("should return an empty string for invalid unset fields on unsaved items after setting on another field", function () {
			var item = new Zotero.Item('book');
			item.setField('title', 'foo');
			assert.strictEqual(item.getField('invalid'), "");
		});
	});
	
	describe("#setField", function () {
		it("should throw an error if item type isn't set", function () {
			var item = new Zotero.Item;
			assert.throws(() => item.setField('title', 'test'), "Item type must be set before setting field data");
		})
		
		it("should mark a field as changed", function () {
			var item = new Zotero.Item('book');
			item.setField('title', 'Foo');
			assert.isTrue(item._changed.itemData[Zotero.ItemFields.getID('title')]);
			assert.isTrue(item.hasChanged());
		})
		
		it('should clear an existing field when ""/null/false is passed', function* () {
			var field = 'title';
			var val = 'foo';
			var fieldID = Zotero.ItemFields.getID(field);
			var item = new Zotero.Item('book');
			item.setField(field, val);
			yield item.saveTx();
			
			item.setField(field, "");
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			// Reset to original value
			yield item.reload();
			assert.isFalse(item.hasChanged());
			assert.equal(item.getField(field), val);
			
			// false
			item.setField(field, false);
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			// Reset to original value
			yield item.reload();
			assert.isFalse(item.hasChanged());
			assert.equal(item.getField(field), val);
			
			// null
			item.setField(field, null);
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			yield item.saveTx();
			assert.equal(item.getField(field), "");
		})
		
		it('should clear a field set to 0 when a ""/null/false is passed', function* () {
			var field = 'title';
			var val = 0;
			var fieldID = Zotero.ItemFields.getID(field);
			var item = new Zotero.Item('book');
			item.setField(field, val);
			yield item.saveTx();
			
			assert.strictEqual(item.getField(field), val);
			
			// ""
			item.setField(field, "");
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			// Reset to original value
			yield item.reload();
			assert.isFalse(item.hasChanged());
			assert.strictEqual(item.getField(field), val);
			
			// False
			item.setField(field, false);
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			// Reset to original value
			yield item.reload();
			assert.isFalse(item.hasChanged());
			assert.strictEqual(item.getField(field), val);
			
			// null
			item.setField(field, null);
			assert.ok(item._changed.itemData[fieldID]);
			assert.isTrue(item.hasChanged());
			
			yield item.saveTx();
			assert.strictEqual(item.getField(field), "");
		})
		
		it("should throw if value is undefined", function () {
			var item = new Zotero.Item('book');
			assert.throws(() => item.setField('title'), "'title' value cannot be undefined");
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
			assert.equal(item.version, 1);
		});
		
		it("should save versionNumber for computerProgram", function* () {
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
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateAdded, true).getTime(), Date.now(), 2000);
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
			assert.equal(item.dateModified, dateModified);
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
			assert.equal(item.dateModified, dateModified);
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
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 2000);
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
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 2000);
		})
		
		it("should use current time if value is not given when skipDateModifiedUpdate is set for a new item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx({
				skipDateModifiedUpdate: true
			});
			item = yield Zotero.Items.getAsync(id);
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 2000);
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
	
	describe("#deleted", function () {
		it("should be set to true after save", function* () {
			var item = yield createDataObject('item');
			item.deleted = true;
			yield item.saveTx();
			assert.ok(item.deleted);
		})
		
		it("should be set to false after save", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.deleted = true;
			yield item.saveTx();
			
			item.deleted = false;
			yield item.saveTx();
			assert.isFalse(item.deleted);
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
	
	describe("#getAttachments()", function () {
		it("#should return child attachments", function* () {
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item("attachment");
			attachment.parentID = item.id;
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			yield attachment.saveTx();
			
			var attachments = item.getAttachments();
			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0], attachment.id);
		})
		
		it("#should ignore trashed child attachments by default", function* () {
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item("attachment");
			attachment.parentID = item.id;
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			attachment.deleted = true;
			yield attachment.saveTx();
			
			var attachments = item.getAttachments();
			assert.lengthOf(attachments, 0);
		})
		
		it("#should include trashed child attachments if includeTrashed=true", function* () {
			var item = yield createDataObject('item');
			var attachment = new Zotero.Item("attachment");
			attachment.parentID = item.id;
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			attachment.deleted = true;
			yield attachment.saveTx();
			
			var attachments = item.getAttachments(true);
			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0], attachment.id);
		})
		
		it("#should return an empty array for an item with no attachments", function* () {
			var item = yield createDataObject('item');
			assert.lengthOf(item.getAttachments(), 0);
		})
	})
	
	describe("#getNotes()", function () {
		it("#should return child notes", function* () {
			var item = yield createDataObject('item');
			var note = new Zotero.Item("note");
			note.parentID = item.id;
			yield note.saveTx();
			
			var notes = item.getNotes();
			assert.lengthOf(notes, 1);
			assert.equal(notes[0], note.id);
		})
		
		it("#should ignore trashed child notes by default", function* () {
			var item = yield createDataObject('item');
			var note = new Zotero.Item("note");
			note.parentID = item.id;
			note.deleted = true;
			yield note.saveTx();
			
			var notes = item.getNotes();
			assert.lengthOf(notes, 0);
		})
		
		it("#should include trashed child notes if includeTrashed=true", function* () {
			var item = yield createDataObject('item');
			var note = new Zotero.Item("note");
			note.parentID = item.id;
			note.deleted = true;
			yield note.saveTx();
			
			var notes = item.getNotes(true);
			assert.lengthOf(notes, 1);
			assert.equal(notes[0], note.id);
		})
		
		it("#should return an empty array for an item with no notes", function* () {
			var item = yield createDataObject('item');
			assert.lengthOf(item.getNotes(), 0);
		})
	})
	
	describe("#attachmentCharset", function () {
		it("should get and set a value", function* () {
			var charset = 'utf-8';
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.attachmentCharset = charset;
			var itemID = yield item.saveTx();
			assert.equal(item.attachmentCharset, charset);
			item = yield Zotero.Items.getAsync(itemID);
			assert.equal(item.attachmentCharset, charset);
		})
		
		it("should not allow a numerical value", function* () {
			var charset = 1;
			var item = new Zotero.Item("attachment");
			try {
				item.attachmentCharset = charset;
			}
			catch (e) {
				assert.equal(e.message, "Character set must be a string")
				return;
			}
			assert.fail("Numerical charset was allowed");
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
	
	describe("#renameAttachmentFile()", function () {
		it("should rename an attached file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var newName = 'test2.png';
			yield item.renameAttachmentFile(newName);
			assert.equal(item.attachmentFilename, newName);
			var path = yield item.getFilePathAsync();
			assert.equal(OS.Path.basename(path), newName)
			yield OS.File.exists(path);
			
			assert.equal(
				(yield Zotero.Sync.Storage.getSyncState(item.id)),
				Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD
			);
			assert.isNull(yield Zotero.Sync.Storage.getSyncedHash(item.id));
		})
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
	
	describe("#addTag", function () {
		it("should add a tag", function* () {
			var item = createUnsavedDataObject('item');
			item.addTag('a');
			yield item.saveTx();
			var tags = item.getTags();
			assert.deepEqual(tags, [{ tag: 'a' }]);
		})
		
		it("should add two tags", function* () {
			var item = createUnsavedDataObject('item');
			item.addTag('a');
			item.addTag('b');
			yield item.saveTx();
			var tags = item.getTags();
			assert.sameDeepMembers(tags, [{ tag: 'a' }, { tag: 'b' }]);
		})
		
		it("should add two tags of different types", function* () {
			var item = createUnsavedDataObject('item');
			item.addTag('a');
			item.addTag('b', 1);
			yield item.saveTx();
			var tags = item.getTags();
			assert.sameDeepMembers(tags, [{ tag: 'a' }, { tag: 'b', type: 1 }]);
		})
		
		it("should add a tag to an existing item", function* () {
			var item = yield createDataObject('item');
			item.addTag('a');
			yield item.saveTx();
			var tags = item.getTags();
			assert.deepEqual(tags, [{ tag: 'a' }]);
		})
		
		it("should add two tags to an existing item", function* () {
			var item = yield createDataObject('item');
			item.addTag('a');
			item.addTag('b');
			yield item.saveTx();
			var tags = item.getTags();
			assert.sameDeepMembers(tags, [{ tag: 'a' }, { tag: 'b' }]);
		})
	})
	
	//
	// Relations and related items
	//
	describe("#addRelatedItem", function () {
		it("should add a dc:relation relation to an item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			item1.addRelatedItem(item2);
			yield item1.saveTx();
			
			var rels = item1.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.lengthOf(rels, 1);
			assert.equal(rels[0], Zotero.URI.getItemURI(item2));
		})
		
		it("should allow an unsaved item to be related to an item in the user library", function* () {
			var item1 = yield createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			yield item2.saveTx();
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.lengthOf(rels, 1);
			assert.equal(rels[0], Zotero.URI.getItemURI(item1));
		})
		
		it("should throw an error for a relation in a different library", function* () {
			var group = yield getGroup();
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item', { libraryID: group.libraryID });
			try {
				item1.addRelatedItem(item2)
			}
			catch (e) {
				assert.ok(e);
				assert.equal(e.message, "Cannot relate item to an item in a different library");
				return;
			}
			assert.fail("addRelatedItem() allowed for an item in a different library");
		})
	})
	
	describe("#save()", function () {
		it("should throw an error for an empty item without an item type", function* () {
			var item = new Zotero.Item;
			var e = yield getPromiseError(item.saveTx());
			assert.ok(e);
			assert.equal(e.message, "Item type must be set before saving");
		})
	})
	
	describe("#clone()", function () {
		// TODO: Expand to other data
		it("should copy creators", function* () {
			var item = new Zotero.Item('book');
			item.setCreators([
				{
					firstName: "A",
					lastName: "Test",
					creatorType: 'author'
				}
			]);
			yield item.saveTx();
			var newItem = yield item.clone();
			assert.sameDeepMembers(item.getCreators(), newItem.getCreators());
		})
	})
	
	describe("#toJSON()", function () {
		describe("default mode", function () {
			it("should output only fields with values", function* () {
				var itemType = "book";
				var title = "Test";
				
				var item = new Zotero.Item(itemType);
				item.setField("title", title);
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var json = yield item.toJSON();
				
				assert.equal(json.itemType, itemType);
				assert.equal(json.title, title);
				assert.isUndefined(json.date);
				assert.isUndefined(json.numPages);
			})
		})
		
		describe("'full' mode", function () {
			it("should output all fields", function* () {
				var itemType = "book";
				var title = "Test";
				
				var item = new Zotero.Item(itemType);
				item.setField("title", title);
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var json = yield item.toJSON({ mode: 'full' });
				assert.equal(json.title, title);
				assert.equal(json.date, "");
				assert.equal(json.numPages, "");
			})
		})
		
		describe("'patch' mode", function () {
			it("should output only fields that differ", function* () {
				var itemType = "book";
				var title = "Test";
				var date = "2015-05-12";
				
				var item = new Zotero.Item(itemType);
				item.setField("title", title);
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var patchBase = yield item.toJSON();
				
				item.setField("date", date);
				yield item.saveTx();
				var json = yield item.toJSON({
					patchBase: patchBase
				})
				assert.isUndefined(json.itemType);
				assert.isUndefined(json.title);
				assert.equal(json.date, date);
				assert.isUndefined(json.numPages);
				assert.isUndefined(json.deleted);
				assert.isUndefined(json.creators);
				assert.isUndefined(json.relations);
				assert.isUndefined(json.tags);
			})
			
			it("should include changed 'deleted' field", function* () {
				// True to false
				var item = new Zotero.Item('book');
				item.deleted = true;
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var patchBase = yield item.toJSON();
				
				item.deleted = false;
				var json = yield item.toJSON({
					patchBase: patchBase
				})
				assert.isUndefined(json.title);
				assert.isFalse(json.deleted);
				
				// False to true
				var item = new Zotero.Item('book');
				item.deleted = false;
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var patchBase = yield item.toJSON();
				
				item.deleted = true;
				var json = yield item.toJSON({
					patchBase: patchBase
				})
				assert.isUndefined(json.title);
				assert.isTrue(json.deleted);
			})
		})
		
		// TODO: Expand to all fields
		it("should handle attachment fields", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({
				file: file
			});
			var json = yield item.toJSON();
			assert.equal(json.linkMode, 'imported_file');
			assert.equal(json.filename, 'test.png');
			assert.isUndefined(json.path);
			assert.equal(json.md5, '93da8f1e5774c599f0942dcecf64b11c');
			assert.typeOf(json.mtime, 'number');
		})
	})

	describe("#fromJSON()", function () {
		it("should accept ISO 8601 dates", function* () {
			var json = {
				itemType: "journalArticle",
				accessDate: "2015-06-07T20:56:00Z",
				dateAdded: "2015-06-07T20:57:00Z",
				dateModified: "2015-06-07T20:58:00Z",
			};
			var item = new Zotero.Item;
			yield item.fromJSON(json);
			assert.equal(item.getField('accessDate'), '2015-06-07 20:56:00');
			assert.equal(item.dateAdded, '2015-06-07 20:57:00');
			assert.equal(item.dateModified, '2015-06-07 20:58:00');
		})
		
		it("should ignore non–ISO 8601 dates", function* () {
			var json = {
				itemType: "journalArticle",
				accessDate: "2015-06-07 20:56:00",
				dateAdded: "2015-06-07 20:57:00",
				dateModified: "2015-06-07 20:58:00",
			};
			var item = new Zotero.Item;
			yield item.fromJSON(json);
			assert.strictEqual(item.getField('accessDate'), '');
			// DEBUG: Should these be null, or empty string like other fields from getField()?
			assert.isNull(item.dateAdded);
			assert.isNull(item.dateModified);
		})
		
		it("should set creators", function* () {
			var json = {
				itemType: "journalArticle",
				creators: [
					{
						firstName: "First",
						lastName: "Last",
						creatorType: "author"
					},
					{
						name: "Test Name",
						creatorType: "editor"
					}
				]
			};
			
			var item = new Zotero.Item;
			yield item.fromJSON(json);
			var id = yield item.saveTx();
			assert.sameDeepMembers(item.getCreatorsJSON(), json.creators);
		})
		
		it("should map a base field to an item-specific field", function* () {
			var item = new Zotero.Item("bookSection");
			yield item.fromJSON({
				"itemType":"bookSection",
				"publicationTitle":"Publication Title"
			});
			assert.equal(item.getField("bookTitle"), "Publication Title");
		});
	});
});
