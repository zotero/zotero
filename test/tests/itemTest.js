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
		
		it("should return a firstCreator for an unsaved item", function* () {
			var item = createUnsavedDataObject('item');
			item.setCreators([
				{
					firstName: "A",
					lastName: "B",
					creatorType: "author"
				},
				{
					firstName: "C",
					lastName: "D",
					creatorType: "editor"
				}
			]);
			assert.equal(item.getField('firstCreator'), "B");
		});

		it("should return a multi-author firstCreator for an unsaved item", async function () {
			var item = createUnsavedDataObject('item');
			item.setCreators([
				{
					firstName: "A",
					lastName: "B",
					creatorType: "author"
				},
				{
					firstName: "C",
					lastName: "D",
					creatorType: "author"
				}
			]);
			assert.equal(
				item.getField('firstCreator'),
				Zotero.getString('general.andJoiner', ['\u2068B\u2069', '\u2068D\u2069'])
			);
		});

		it("should strip bidi isolates from firstCreator when unformatted = true", async function () {
			var item = createUnsavedDataObject('item');
			item.setCreators([
				{
					firstName: "A",
					lastName: "B",
					creatorType: "author"
				},
				{
					firstName: "C",
					lastName: "D",
					creatorType: "author"
				}
			]);
			
			// Test unsaved - uses getFirstCreatorFromData()'s omitBidiIsolates option
			assert.equal(
				item.getField('firstCreator', /* unformatted */ true),
				Zotero.getString('general.andJoiner', ['B', 'D'])
			);
			
			await item.saveTx();

			// Test saved - implemented in getField()
			assert.equal(
				item.getField('firstCreator', /* unformatted */ true),
				Zotero.getString('general.andJoiner', ['B', 'D'])
			);
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
		
		it("should save an integer as a string", function* () {
			var val = 1234;
			var item = new Zotero.Item('book');
			item.setField('numPages', val);
			yield item.saveTx();
			assert.strictEqual(item.getField('numPages'), "" + val);
			// Setting again as string shouldn't register a change
			assert.isFalse(item.setField('numPages', "" + val));
			
			// Value should be TEXT in the DB
			var sql = "SELECT TYPEOF(value) FROM itemData JOIN itemDataValues USING (valueID) "
				+ "WHERE itemID=? AND fieldID=?";
			var type = yield Zotero.DB.valueQueryAsync(sql, [item.id, Zotero.ItemFields.getID('numPages')]);
			assert.equal(type, 'text');
		});
		
		it("should save integer 0 as a string", function* () {
			var val = 0;
			var item = new Zotero.Item('book');
			item.setField('numPages', val);
			yield item.saveTx();
			assert.strictEqual(item.getField('numPages'), "" + val);
			// Setting again as string shouldn't register a change
			assert.isFalse(item.setField('numPages', "" + val));
		});
		
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
		
		it('should clear a field set to "0" when a ""/null/false is passed', function* () {
			var field = 'title';
			var val = "0";
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
		
		it("should accept ISO 8601 dates", function* () {
			var fields = {
				accessDate: "2015-06-07T20:56:00Z",
				dateAdded: "2015-06-07T20:57:00Z",
				dateModified: "2015-06-07T20:58:00Z",
			};
			var item = createUnsavedDataObject('item');
			for (let i in fields) {
				item.setField(i, fields[i]);
			}
			assert.equal(item.getField('accessDate'), '2015-06-07 20:56:00');
			assert.equal(item.dateAdded, '2015-06-07 20:57:00');
			assert.equal(item.dateModified, '2015-06-07 20:58:00');
		})
		
		it("should accept SQL dates", function* () {
			var fields = {
				accessDate: "2015-06-07 20:56:00",
				dateAdded: "2015-06-07 20:57:00",
				dateModified: "2015-06-07 20:58:00",
			};
			var item = createUnsavedDataObject('item');
			for (let i in fields) {
				item.setField(i, fields[i]);
				item.getField(i, fields[i]);
			}
		})
		
		it("should accept SQL accessDate without time", function* () {
			var item = createUnsavedDataObject('item');
			var date = "2017-04-05";
			item.setField("accessDate", date);
			assert.strictEqual(item.getField('accessDate'), date);
		});
		
		it("should ignore unknown accessDate values", function* () {
			var fields = {
				accessDate: "foo"
			};
			var item = createUnsavedDataObject('item');
			for (let i in fields) {
				item.setField(i, fields[i]);
			}
			assert.strictEqual(item.getField('accessDate'), '');
		})
	})
	
	describe("#dateAdded", function () {
		it("should use current time if value was not given for a new item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			item = Zotero.Items.get(id);
			
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
			item = Zotero.Items.get(id);
			
			// Save again without changing Date Modified
			item.setField('title', 'Test');
			yield item.saveTx()
			
			assert.closeTo(Zotero.Date.sqlToDate(item.dateModified, true).getTime(), Date.now(), 2000);
		})
		
		it("should use current time if the existing value was given for an existing item", function* () {
			var dateModified = "2015-05-05 17:18:12";
			var item = new Zotero.Item('book');
			item.dateModified = dateModified;
			var id = yield item.saveTx();
			item = Zotero.Items.get(id);
			
			// Set Date Modified to existing value
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
			item = Zotero.Items.get(id);
			
			// Resave with skipDateModifiedUpdate
			item.setField('title', 'Test');
			yield item.saveTx({
				skipDateModifiedUpdate: true
			})
			assert.equal(item.dateModified, dateModified);
		})
	})
	
	describe("#inPublications", function () {
		it("should add item to publications table", function* () {
			var item = yield createDataObject('item');
			item.inPublications = true;
			yield item.saveTx();
			assert.ok(item.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id)),
				1
			);
		})
		
		it("should be set to false after save", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item');
			item.inPublications = false;
			yield item.saveTx();
			
			item.inPublications = false;
			yield item.saveTx();
			assert.isFalse(item.inPublications);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM publicationsItems WHERE itemID=?", item.id)),
				0
			);
		});
		
		it("should be invalid for linked-file attachments", function* () {
			var item = yield createDataObject('item', { inPublications: true });
			var attachment = yield Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.png'),
				parentItemID: item.id
			});
			attachment.inPublications = true;
			var e = yield getPromiseError(attachment.saveTx());
			assert.ok(e);
			assert.include(e.message, "Linked-file attachments cannot be added to My Publications");
		});
		
		it("should be invalid for group library items", function* () {
			var group = yield getGroup();
			var item = yield createDataObject('item', { libraryID: group.libraryID });
			item.inPublications = true;
			var e = yield getPromiseError(item.saveTx());
			assert.ok(e);
			assert.equal(e.message, "Only items in user libraries can be added to My Publications");
		});
	});
	
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
		
		it("should not be settable to item itself", async function () {
			var item = await createDataObject('item', { itemType: 'note' });
			item.parentID = item.id;
			var e = await getPromiseError(item.saveTx());
			assert.ok(e);
			assert.equal(e.message, "Item cannot be set as parent of itself");
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
		
		it("should not be marked as changed after a save", async function () {
			var item = await createDataObject('item');
			var attachment = new Zotero.Item('attachment');
			attachment.attachmentLinkMode = 'linked_url';
			await attachment.saveTx();
			
			attachment.parentKey = item.key;
			assert.isTrue(attachment._changed.parentKey);
			await attachment.saveTx();
			assert.isUndefined(attachment._changed.parentKey);
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
		
		it("should not be settable to item itself", async function () {
			var item = new Zotero.Item('note');
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.key = Zotero.DataObjectUtilities.generateKey();
			item.parentKey = item.key;
			var e = await getPromiseError(item.saveTx());
			assert.ok(e);
			assert.equal(e.message, "Item cannot be set as parent of itself");
		});
	});
	
	describe("#topLevelItem", function () {
		it("should return self for top-level item", async function () {
			var item = await createDataObject('item');
			assert.equal(item, item.topLevelItem);
		});
		
		it("should return parent item for note", async function () {
			var item = await createDataObject('item');
			var note = await createDataObject('item', { itemType: 'note', parentItemID: item.id });
			assert.equal(item, note.topLevelItem);
		});
		
		it("should return top-level item for annotation", async function () {
			var item = await createDataObject('item');
			var attachment = await importPDFAttachment(item);
			var annotation = await createAnnotation('highlight', attachment);
			assert.equal(item, annotation.topLevelItem);
		});
	});
	
	describe("#getCreators()", function () {
		it("should update after creators are removed", function* () {
			var item = createUnsavedDataObject('item');
			item.setCreators([
				{
					creatorType: "author",
					name: "A"
				}
			]);
			yield item.saveTx();
			
			assert.lengthOf(item.getCreators(), 1);
			
			item.setCreators([]);
			yield item.saveTx();
			
			assert.lengthOf(item.getCreators(), 0);
		});
	});
	
	describe("#setCreators()", function () {
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
			item = Zotero.Items.get(id);
			assert.sameDeepMembers(item.getCreatorsJSON(), creators);
		})
		
		it("should accept an array of creators in internal format", function* () {
			var creators = [
				{
					firstName: "First",
					lastName: "Last",
					fieldMode: 0,
					creatorTypeID: Zotero.CreatorTypes.getID('author')
				},
				{
					firstName: "",
					lastName: "Test Name",
					fieldMode: 1,
					creatorTypeID: Zotero.CreatorTypes.getID('editor')
				}
			];
			
			var item = new Zotero.Item("journalArticle");
			item.setCreators(creators);
			var id = yield item.saveTx();
			item = Zotero.Items.get(id);
			assert.sameDeepMembers(item.getCreators(), creators);
		})
		
		it("should clear creators if empty array passed", function () {
			var item = createUnsavedDataObject('item');
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					fieldMode: 0,
					creatorTypeID: Zotero.CreatorTypes.getID('author')
				}
			]);
			assert.lengthOf(item.getCreators(), 1);
			item.setCreators([]);
			assert.lengthOf(item.getCreators(), 0);
		});
		
		it("should switch to primary creator type if unknown type given", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "unknown"
				}
			]);
			assert.equal(item.getCreators()[0].creatorTypeID, Zotero.CreatorTypes.getID('author'));
		});
		
		it("should switch to primary creator type on invalid creator type for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setCreators([
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "interviewee"
				}
			]);
			assert.equal(item.getCreators()[0].creatorTypeID, Zotero.CreatorTypes.getID('author'));
		});
		
		it("should throw on unknown creator type in strict mode", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			var f = () => {
				item.setCreators(
					[
						{
							firstName: "First",
							lastName: "Last",
							creatorType: "unknown"
						}
					],
					{
						strict: true
					}
				);
			};
			assert.throws(f, /^Unknown creator type/);
		});
		
		it("should throw on invalid creator type for a given item type in strict mode", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			var f = () => {
				item.setCreators(
					[
						{
							firstName: "First",
							lastName: "Last",
							creatorType: "interviewee"
						}
					],
					{
						strict: true
					}
				);
			}
			assert.throws(f, /^Invalid creator type/);
		});
	})
	
	
	describe("#getCollections()", function () {
		it("shouldn't include collections in the trash", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [collection1.id, collection2.id] });
			
			assert.sameMembers(item.getCollections(), [collection1.id, collection2.id]);
			
			collection1.deleted = true;
			await collection1.saveTx();
			
			assert.sameMembers(item.getCollections(), [collection2.id]);
			
			// Simulate a restart
			await Zotero.Items.get(item.id).reload(null, true);
			
			// Make sure the deleted collection is not back in item's cache
			assert.sameMembers(item.getCollections(), [collection2.id]);
		});
		
		it("should include collections in the trash if includeTrashed=true", async function () {
			var collection1 = await createDataObject('collection');
			var collection2 = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [collection1.id, collection2.id] });
			
			assert.sameMembers(item.getCollections(true), [collection1.id, collection2.id]);
			
			collection1.deleted = true;
			await collection1.saveTx();
			
			assert.sameMembers(item.getCollections(true), [collection1.id, collection2.id]);
			
			// Simulate a restart
			await Zotero.Items.get(item.id).reload(null, true);
			
			assert.sameMembers(item.getCollections(true), [collection1.id, collection2.id]);
		});
	});
	
	
	describe("#setCollections()", function () {
		it("should add a collection with an all-numeric key", async function () {
			var col = new Zotero.Collection();
			col.libraryID = Zotero.Libraries.userLibraryID;
			col.key = '23456789';
			await col.loadPrimaryData();
			col.name = 'Test';
			var id = await col.saveTx();
			
			var item = createUnsavedDataObject('item');
			item.setCollections([col.key]);
			await item.saveTx();
			
			assert.isTrue(col.hasItem(item));
		});
	});
	
	
	describe("#numAttachments()", function () {
		it("should include child attachments", function* () {
			var item = yield createDataObject('item');
			var attachment = yield importFileAttachment('test.png', { parentID: item.id });
			assert.equal(item.numAttachments(), 1);
		});
		
		it("shouldn't include trashed child attachments by default", function* () {
			var item = yield createDataObject('item');
			yield importFileAttachment('test.png', { parentID: item.id });
			var attachment = yield importFileAttachment('test.png', { parentID: item.id });
			attachment.deleted = true;
			yield attachment.saveTx();
			assert.equal(item.numAttachments(), 1);
		});
		
		it("should include trashed child attachments if includeTrashed=true", function* () {
			var item = yield createDataObject('item');
			yield importFileAttachment('test.png', { parentID: item.id });
			var attachment = yield importFileAttachment('test.png', { parentID: item.id });
			attachment.deleted = true;
			yield attachment.saveTx();
			assert.equal(item.numAttachments(true), 2);
		});
	});
	
	
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
		
		it("should return child attachments sorted alphabetically", async function () {
			var item = await createDataObject('item');
			
			var titles = ['B', 'C', 'A'];
			var attachments = [];
			for (let title of titles) {
				let attachment = new Zotero.Item("attachment");
				attachment.attachmentLinkMode = 'linked_url';
				attachment.parentID = item.id;
				attachment.setField('title', title);
				await attachment.saveTx();
				attachments.push(attachment);
			}
			
			attachments = item.getAttachments().map(id => Zotero.Items.get(id));
			assert.equal(attachments[0].getField('title'), 'A');
			assert.equal(attachments[1].getField('title'), 'B');
			assert.equal(attachments[2].getField('title'), 'C');
		});
		
		it("should return re-sorted child attachments after one is modified", async function () {
			var item = await createDataObject('item');
			
			var titles = ['B', 'C', 'A'];
			var attachments = [];
			for (let title of titles) {
				let attachment = new Zotero.Item("attachment");
				attachment.attachmentLinkMode = 'linked_url';
				attachment.parentID = item.id;
				attachment.setField('title', title);
				await attachment.saveTx();
				attachments.push(attachment);
			}
			
			attachments[0].setField('title', 'D');
			await attachments[0].saveTx();
			
			attachments = item.getAttachments().map(id => Zotero.Items.get(id));
			assert.equal(attachments[0].getField('title'), 'A');
			assert.equal(attachments[1].getField('title'), 'C');
			assert.equal(attachments[2].getField('title'), 'D');
		});
		
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
		
		it("should update after an attachment is moved to the trash", async function () {
			var item = await createDataObject('item');
			var attachment = new Zotero.Item("attachment");
			attachment.parentID = item.id;
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			await attachment.saveTx();
			
			// Attachment should show up initially
			var attachments = item.getAttachments();
			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0], attachment.id);
			
			// Move attachment to trash
			attachment.deleted = true;
			await attachment.saveTx();
			
			// Attachment should not show up without includeTrashed=true
			attachments = item.getAttachments();
			assert.lengthOf(attachments, 0);
		});
		
		it("#should return an empty array for an item with no attachments", function* () {
			var item = yield createDataObject('item');
			assert.lengthOf(item.getAttachments(), 0);
		})
		
		it("should update after an attachment is moved to another item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			var item3 = new Zotero.Item('attachment');
			item3.parentID = item1.id;
			item3.attachmentLinkMode = 'linked_url';
			item3.setField('url', 'http://example.com');
			yield item3.saveTx();
			
			assert.lengthOf(item1.getAttachments(), 1);
			assert.lengthOf(item2.getAttachments(), 0);
			
			item3.parentID = item2.id;
			yield item3.saveTx();
			
			assert.lengthOf(item1.getAttachments(), 0);
			assert.lengthOf(item2.getAttachments(), 1);
		});
	})
	
	describe("#numNotes()", function () {
		it("should include child notes", function* () {
			var item = yield createDataObject('item');
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			assert.equal(item.numNotes(), 2);
		});
		
		it("shouldn't include trashed child notes by default", function* () {
			var item = yield createDataObject('item');
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			yield createDataObject('item', { itemType: 'note', parentID: item.id, deleted: true });
			assert.equal(item.numNotes(), 1);
		});
		
		it("should include trashed child notes with includeTrashed", function* () {
			var item = yield createDataObject('item');
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			yield createDataObject('item', { itemType: 'note', parentID: item.id, deleted: true });
			assert.equal(item.numNotes(true), 2);
		});
		
		it("should include child attachment notes with includeEmbedded", function* () {
			var item = yield createDataObject('item');
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			var attachment = yield importFileAttachment('test.png', { parentID: item.id });
			attachment.setNote('test');
			yield attachment.saveTx();
			yield item.loadDataType('childItems');
			assert.equal(item.numNotes(false, true), 2);
		});
		
		it("shouldn't include empty child attachment notes with includeEmbedded", function* () {
			var item = yield createDataObject('item');
			yield createDataObject('item', { itemType: 'note', parentID: item.id });
			var attachment = yield importFileAttachment('test.png', { parentID: item.id });
			assert.equal(item.numNotes(false, true), 1);
		});
		
		// TODO: Fix numNotes(false, true) updating after child attachment note is added or removed
	});
	
	
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
		});
		
		it("should update after a note is moved to another item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			var item3 = yield createDataObject('item', { itemType: 'note', parentID: item1.id });
			
			assert.lengthOf(item1.getNotes(), 1);
			assert.lengthOf(item2.getNotes(), 0);
			
			item3.parentID = item2.id;
			yield item3.saveTx();
			
			assert.lengthOf(item1.getNotes(), 0);
			assert.lengthOf(item2.getNotes(), 1);
		});
	})
	
	
	describe("#getFilePath()", function () {
		it("should return the absolute path for an embedded image", async function () {
			var note = await createDataObject('item', { itemType: 'note' });
			
			var path = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var imageData = await Zotero.File.getBinaryContentsAsync(path);
			var array = new Uint8Array(imageData.length);
			for (let i = 0; i < imageData.length; i++) {
				array[i] = imageData.charCodeAt(i);
			}
			
			var blob = new Blob([array], { type: 'image/png' });
			var attachment = await Zotero.Attachments.importEmbeddedImage({
				blob,
				parentItemID: note.id
			});
			
			var storageDir = Zotero.getStorageDirectory().path;
			assert.equal(
				OS.Path.join(storageDir, attachment.key, 'image.png'),
				attachment.getFilePath()
			);
		});
	});
	
	
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
		afterEach(function () {
			Zotero.Prefs.set('saveRelativeAttachmentPath', false)
			Zotero.Prefs.clear('baseAttachmentPath')
		});
		
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
			assert.equal(item.getFilePath(), file.path);
		});
		
		it("should handle line and paragraph separators in filenames", async function () {
			var filename = "Line 1\u2028Line 2\u2029Line 3.txt";
			
			var item = await createDataObject('item');
			
			var attachment = new Zotero.Item("attachment");
			attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			attachment.parentID = item.id;
			attachment.attachmentFilename = filename;
			await attachment.saveTx();
			
			assert.equal(attachment.attachmentFilename, filename);
		});
		
		it("should get a filename for a base-dir-relative file", function () {
			var dir = getTestDataDirectory().path;
			Zotero.Prefs.set('saveRelativeAttachmentPath', true)
			Zotero.Prefs.set('baseAttachmentPath', dir)
			
			var file = OS.Path.join(dir, 'test.png');
			
			var item = new Zotero.Item('attachment');
			item.attachmentLinkMode = 'linked_file';
			item.attachmentPath = file;
			
			assert.equal(item.attachmentFilename, 'test.png');
		});
		
		it("should get a filename for a base-dir-relative file in a subdirectory", function () {
			var dir = getTestDataDirectory().path;
			var baseDir = OS.Path.dirname(dir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true)
			Zotero.Prefs.set('baseAttachmentPath', baseDir)
			
			var file = OS.Path.join(dir, 'test.png');
			
			var item = new Zotero.Item('attachment');
			item.attachmentLinkMode = 'linked_file';
			item.attachmentPath = file;
			
			assert.equal(item.attachmentFilename, 'test.png');
		});
	})
	
	describe("#attachmentPath", function () {
		afterEach(function () {
			Zotero.Prefs.set('saveRelativeAttachmentPath', false)
			Zotero.Prefs.clear('baseAttachmentPath')
		});
		
		it("should return an absolute path for a linked attachment", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.linkFromFile({ file });
			assert.equal(item.attachmentPath, file.path);
		})
		
		it("should return a prefixed path for an imported file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			
			assert.equal(item.attachmentPath, "storage:test.png");
		})
		
		it("should set a prefixed relative path for a path within the defined base directory", function* () {
			var dir = getTestDataDirectory().path;
			var baseDir = OS.Path.dirname(dir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true)
			Zotero.Prefs.set('baseAttachmentPath', baseDir)
			
			var file = OS.Path.join(dir, 'test.png');
			
			var item = new Zotero.Item('attachment');
			item.attachmentLinkMode = 'linked_file';
			item.attachmentPath = file;
			
			assert.equal(item.attachmentPath, "attachments:data/test.png");
		})
		
		it("should return a prefixed path for a linked attachment within the defined base directory", function* () {
			var dir = getTestDataDirectory().path;
			var baseDir = OS.Path.dirname(dir);
			Zotero.Prefs.set('saveRelativeAttachmentPath', true)
			Zotero.Prefs.set('baseAttachmentPath', baseDir)
			
			var file = OS.Path.join(dir, 'test.png');
			
			var item = yield Zotero.Attachments.linkFromFile({
				file: Zotero.File.pathToFile(file)
			});
			
			assert.equal(item.attachmentPath, "attachments:data/test.png");
		})
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
			
			// File should be flagged for upload
			// DEBUG: Is this necessary?
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD);
			assert.isNull(item.attachmentSyncedHash);
		});
		
		// Only relevant on a case-insensitive filesystem
		it("should rename an attached file with a case-only change (Mac)", async function () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({
				file: file
			});
			var newName = 'Test.png';
			await item.renameAttachmentFile(newName);
			assert.equal(item.attachmentFilename, newName);
			var path = await item.getFilePathAsync();
			assert.equal(OS.Path.basename(path), newName)
			await OS.File.exists(path);
		});
		
		it("should rename a linked file", function* () {
			var filename = 'test.png';
			var file = getTestDataDirectory();
			file.append(filename);
			var tmpDir = yield getTempDirectory();
			var tmpFile = OS.Path.join(tmpDir, filename);
			yield OS.File.copy(file.path, tmpFile);
			
			var item = yield Zotero.Attachments.linkFromFile({
				file: tmpFile
			});
			var newName = 'test2.png';
			yield assert.eventually.isTrue(item.renameAttachmentFile(newName));
			assert.equal(item.attachmentFilename, newName);
			var path = yield item.getFilePathAsync();
			assert.equal(OS.Path.basename(path), newName)
			yield OS.File.exists(path);
		})
	})
	
	
	describe("#getBestAttachmentState()", function () {
		it("should cache state for an existing file", function* () {
			var parentItem = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.png');
			var childItem = yield Zotero.Attachments.importFromFile({
				file,
				parentItemID: parentItem.id
			});
			yield parentItem.getBestAttachmentState();
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ type: 'image', exists: true, key: childItem.key }
			);
		});
		
		it("should cache state for a missing file", function* () {
			var parentItem = yield createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.png');
			var childItem = yield Zotero.Attachments.importFromFile({
				file,
				parentItemID: parentItem.id
			});
			let path = yield childItem.getFilePathAsync();
			yield OS.File.remove(path);
			yield parentItem.getBestAttachmentState();
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ type: 'image', exists: false, key: childItem.key }
			);
		});

		it("should cache state for a standalone attachment", async function () {
			var standaloneAttachment = await importPDFAttachment();
			await standaloneAttachment.getBestAttachmentState();
			assert.deepEqual(
				standaloneAttachment.getBestAttachmentStateCached(),
				{ type: 'pdf', exists: true, key: standaloneAttachment.key }
			);
		});

		it("should update best attachment state without clearing it for as long as item key matches", async function () {
			var parentItem = await createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.png');
			var childItem = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: parentItem.id
			});
			let path = await childItem.getFilePathAsync();
			await OS.File.remove(path);
			await parentItem.getBestAttachment();
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ key: childItem.key }
			);
			await childItem._updateAttachmentStates(false);
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ exists: false, key: childItem.key }
			);
			await parentItem.getBestAttachmentState();
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ type: 'image', exists: false, key: childItem.key }
			);
			await childItem._updateAttachmentStates(true);
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ type: 'image', exists: true, key: childItem.key }
			);
		});

		it("should update best attachment state when attachment is trashed", async function () {
			var parentItem = await createDataObject('item');
			var file = getTestDataDirectory();
			file.append('test.png');
			var childItem = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: parentItem.id
			});

			await parentItem.getBestAttachmentState();
			childItem._updateAttachmentStates(true);
			assert.deepEqual(
				parentItem.getBestAttachmentStateCached(),
				{ type: 'image', exists: true, key: childItem.key }
			);

			await Zotero.Items.trashTx([childItem.id]);
			childItem._updateAttachmentStates(true);
			assert.deepEqual(parentItem.getBestAttachmentStateCached(), { type: null });
		});
	});
	
	
	describe("#fileExists()", function () {
		it("should cache state for an existing file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			yield item.fileExists();
			assert.equal(item.fileExistsCached(), true);
		})
		
		it("should cache state for a missing file", function* () {
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			let path = yield item.getFilePathAsync();
			yield OS.File.remove(path);
			yield item.fileExists();
			assert.equal(item.fileExistsCached(), false);
		})
	})
	
	
	describe("#relinkAttachmentFile", function () {
		it("should copy a file elsewhere into the storage directory", function* () {
			var filename = 'test.png';
			var file = getTestDataDirectory();
			file.append(filename);
			var tmpDir = yield getTempDirectory();
			var tmpFile = OS.Path.join(tmpDir, filename);
			yield OS.File.copy(file.path, tmpFile);
			file = OS.Path.join(tmpDir, filename);
			
			var item = yield Zotero.Attachments.importFromFile({ file });
			let path = yield item.getFilePathAsync();
			yield OS.File.remove(path);
			yield OS.File.removeEmptyDir(OS.Path.dirname(path));
			
			assert.isFalse(yield item.fileExists());
			yield item.relinkAttachmentFile(file);
			assert.isTrue(yield item.fileExists());
			
			assert.isTrue(yield OS.File.exists(tmpFile));
		});
		
		it("should handle normalized filenames", function* () {
			var item = yield importFileAttachment('test.png');
			var path = yield item.getFilePathAsync();
			var dir = OS.Path.dirname(path);
			var filename = 'tést.pdf'.normalize('NFKD');
			
			// Make sure we're actually testing something -- the test string should be differently
			// normalized from what's done in getValidFileName
			assert.notEqual(filename, Zotero.File.getValidFileName(filename));
			
			var newPath = OS.Path.join(dir, filename);
			yield OS.File.move(path, newPath);
			
			assert.isFalse(yield item.fileExists());
			yield item.relinkAttachmentFile(newPath);
			assert.isTrue(yield item.fileExists());
		});
	});
	
	
	describe("#attachmentLastProcessedModificationTime", function () {
		it("should save time in milliseconds", async function () {
			var item = await createDataObject('item');
			var attachment = await importFileAttachment('test.pdf', { parentID: item.id });
			
			var mtime = Math.floor(Date.now() / 1000);
			attachment.attachmentLastProcessedModificationTime = mtime;
			await attachment.saveTx();
			
			assert.equal(attachment.attachmentLastProcessedModificationTime, mtime);
			
			var sql = "SELECT lastProcessedModificationTime FROM itemAttachments WHERE itemID=?";
			var dbmtime = await Zotero.DB.valueQueryAsync(sql, attachment.id);
			
			assert.equal(mtime, dbmtime);
		});
	});
	
	
	describe("Attachment Page Index", function () {
		describe("#getAttachmentLastPageIndex()", function () {
			it("should get the page index", async function () {
				var attachment = await importFileAttachment('test.pdf');
				assert.isNull(attachment.getAttachmentLastPageIndex());
				await attachment.setAttachmentLastPageIndex(2);
				assert.equal(2, attachment.getAttachmentLastPageIndex());
			});
			
			it("should throw an error if called on a regular item", async function () {
				var item = createUnsavedDataObject('item');
				assert.throws(
					() => item.getAttachmentLastPageIndex(),
					"getAttachmentLastPageIndex() can only be called on file attachments"
				);
			});
			
			it("should discard invalid page index", async function () {
				var attachment = await importFileAttachment('test.pdf');
				var id = attachment._getLastPageIndexSettingKey();
				await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, id, '"1"');
				assert.isNull(attachment.getAttachmentLastPageIndex());
			});
		});
		
		it("should be cleared when item is deleted", async function () {
			var attachment = await importFileAttachment('test.pdf');
			await attachment.setAttachmentLastPageIndex(2);
			var id = attachment._getLastPageIndexSettingKey();
			assert.equal(2, Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, id));
			await attachment.eraseTx();
			assert.isNull(Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, id));
		});
	});
	
	
	describe("Annotations", function () {
		var item;
		var attachment;
		
		before(async function () {
			item = await createDataObject('item');
			attachment = await importFileAttachment('test.pdf', { parentID: item.id });
		});
		
		describe("#annotationType", function () {
			it("should throw an invalid-data error if unknown type", function () {
				var a = new Zotero.Item('annotation');
				try {
					a.annotationType = 'foo';
				}
				catch (e) {
					assert.equal(e.name, 'ZoteroInvalidDataError');
					assert.equal(e.message, "Unknown annotation type 'foo'");
					return;
				}
				assert.fail("Invalid annotationType should throw");
			});
		});
		
		describe("#annotationText", function () {
			it("should not be changeable", async function () {
				var a = new Zotero.Item('annotation');
				a.annotationType = 'highlight';
				assert.doesNotThrow(() => a.annotationType = 'highlight');
				assert.doesNotThrow(() => a.annotationType = 'underline');
				assert.throws(() => a.annotationType = 'note');
			});
		});
		
		describe("#annotationText", function () {
			it("should only be allowed for highlights", async function () {
				var a = new Zotero.Item('annotation');
				a.annotationType = 'highlight';
				assert.doesNotThrow(() => a.annotationText = "This is highlighted text.");
				
				a = new Zotero.Item('annotation');
				a.annotationType = 'note';
				assert.throws(() => a.annotationText = "This is highlighted text.");
				
				a = new Zotero.Item('annotation');
				a.annotationType = 'image';
				assert.throws(() => a.annotationText = "This is highlighted text.");
			});
		});
		
		describe("#annotationComment", function () {
			it("should not mark object without comment as changed if empty string", async function () {
				var annotation = await createAnnotation('highlight', attachment, { comment: "" });
				annotation.annotationComment = "";
				assert.isFalse(annotation.hasChanged());
			});
			
			it("should clear existing value when empty string is passed", async function () {
				var annotation = await createAnnotation('highlight', attachment);
				annotation.annotationComment = "";
				assert.isTrue(annotation.hasChanged());
			});
		});
		
		describe("#saveTx()", function () {
			it("should save a highlight annotation", async function () {
				var annotation = new Zotero.Item('annotation');
				annotation.parentID = attachment.id;
				annotation.annotationType = 'highlight';
				annotation.annotationText = "This is highlighted text.";
				annotation.annotationColor = "#ffff66";
				annotation.annotationSortIndex = '00015|002431|00000';
				annotation.annotationPosition = JSON.stringify({
					pageIndex: 123,
					rects: [
						[314.4, 412.8, 556.2, 609.6]
					]
				});
				await annotation.saveTx();
				assert.isFalse(annotation.hasChanged());
			});
			
			it("should assign a default color", async function () {
				var annotation = new Zotero.Item('annotation');
				annotation.parentID = attachment.id;
				annotation.annotationType = 'highlight';
				annotation.annotationText = "This is highlighted text.";
				annotation.annotationSortIndex = '00015|002431|00000';
				annotation.annotationPosition = JSON.stringify({
					pageIndex: 123,
					rects: [
						[314.4, 412.8, 556.2, 609.6]
					]
				});
				await annotation.saveTx();
				assert.equal(annotation.annotationColor, '#ffd400');
			});
			
			it("should save a note annotation", async function () {
				var annotation = new Zotero.Item('annotation');
				annotation.parentID = attachment.id;
				annotation.annotationType = 'note';
				annotation.annotationComment = "This is a comment.";
				annotation.annotationSortIndex = '00015|002431|00000';
				annotation.annotationPosition = JSON.stringify({
					pageIndex: 123,
					rects: [
						[314.4, 412.8, 556.2, 609.6]
					]
				});
				await annotation.saveTx();
				assert.isFalse(annotation.hasChanged());
			});
			
			it("should save an image annotation", async function () {
				// Create a Blob from a PNG
				var path = OS.Path.join(getTestDataDirectory().path, 'test.png');
				var imageData = await Zotero.File.getBinaryContentsAsync(path);
				var array = new Uint8Array(imageData.length);
				for (let i = 0; i < imageData.length; i++) {
					array[i] = imageData.charCodeAt(i);
				}
				
				var annotation = new Zotero.Item('annotation');
				annotation.parentID = attachment.id;
				annotation.annotationType = 'image';
				annotation.annotationSortIndex = '00015|002431|00000';
				annotation.annotationPosition = JSON.stringify({
					pageIndex: 123,
					rects: [
						[314.4, 412.8, 556.2, 609.6]
					],
					width: 1,
					height: 1
				});
				await annotation.saveTx();
				assert.isFalse(annotation.hasChanged());
				
				var blob = new Blob([array], { type: 'image/png' });
				await Zotero.Annotations.saveCacheImage(annotation, blob);
				
				var imagePath = Zotero.Annotations.getCacheImagePath(annotation);
				assert.ok(imagePath);
				assert.equal(OS.Path.basename(imagePath), annotation.key + '.png');
				assert.equal(
					await Zotero.File.getBinaryContentsAsync(imagePath),
					imageData
				);
			});
			
			it("should remove cached image for an annotation item when position changes", async function () {
				var attachment = await importFileAttachment('test.pdf');
				var annotation = await createAnnotation('image', attachment);
				
				// Get Blob from file and attach it
				var blob = await getImageBlob();
				var file = await Zotero.Annotations.saveCacheImage(annotation, blob);
				
				assert.isTrue(await OS.File.exists(file));
				
				var position = JSON.parse(annotation.annotationPosition);
				position.rects[0][0] = position.rects[0][0] + 1;
				annotation.annotationPosition = JSON.stringify(position);
				await annotation.saveTx();
				assert.isFalse(await OS.File.exists(file));
			});
		});
		
		describe("#getAnnotations()", function () {
			var item;
			var attachment;
			var annotation1;
			var annotation2;
			
			before(async function () {
				item = await createDataObject('item');
				attachment = await importFileAttachment('test.pdf', { parentID: item.id });
				annotation1 = await createAnnotation('highlight', attachment);
				annotation2 = await createAnnotation('highlight', attachment);
				annotation2.deleted = true;
				await annotation2.saveTx();
			});
			
			after(async function () {
				await annotation2.eraseTx();
			});
			
			it("should return annotations not in trash", async function () {
				var items = attachment.getAnnotations();
				assert.sameMembers(items, [annotation1]);
			});
			
			it("should return annotations in trash if includeTrashed=true", async function () {
				var items = attachment.getAnnotations(true);
				assert.sameMembers(items, [annotation1, annotation2]);
			});
		});

		describe("#hasEmbeddedAnnotations()", function () {
			it("should recognize a highlight annotation", async function () {
				let attachment = await importFileAttachment('duplicatesMerge_annotated_1.pdf');
				assert.isTrue(await attachment.hasEmbeddedAnnotations());
			});

			it("should recognize a strikeout annotation", async function () {
				let attachment = await importFileAttachment('duplicatesMerge_annotated_3.pdf');
				assert.isTrue(await attachment.hasEmbeddedAnnotations());
			});

			it("should not recognize a link annotation", async function () {
				let attachment = await importFileAttachment('duplicatesMerge_notAnnotated.pdf');
				assert.isFalse(await attachment.hasEmbeddedAnnotations());
			});
		});
		
		describe("#isEditable()", function () {
			var group;
			var groupAttachment;
			var groupAnnotation1;
			var groupAnnotation2;
			var groupAnnotation3;
			
			before(async function () {
				await Zotero.Users.setCurrentUserID(1);
				await Zotero.Users.setName(1, 'Abc');
				await Zotero.Users.setName(12345, 'Def');
				group = await createGroup();
				groupAttachment = await importFileAttachment('test.pdf', { libraryID: group.libraryID });
				groupAnnotation1 = await createAnnotation('highlight', groupAttachment);
				groupAnnotation2 = await createAnnotation('highlight', groupAttachment, { createdByUserID: Zotero.Users.getCurrentUserID() });
				groupAnnotation3 = await createAnnotation('highlight', groupAttachment, { createdByUserID: 12345 });
			});
			
			describe("'edit'", function () {
				it("should return true for personal library annotation", async function () {
					var item = await createDataObject('item');
					var attachment = await importFileAttachment('test.pdf', { parentID: item.id });
					var annotation = await createAnnotation('highlight', attachment);
					assert.isTrue(annotation.isEditable());
				});
				
				it("should return true for group annotation created locally", async function () {
					assert.isTrue(groupAnnotation1.isEditable());
				});
				
				it("should return true for group annotation created by current user elsewhere", async function () {
					assert.isTrue(groupAnnotation2.isEditable());
				});
				
				it("should return false for annotations created by another user", async function () {
					assert.isFalse(groupAnnotation3.isEditable());
				});
				
				it("shouldn't allow editing of group annotation owned by another user", async function () {
					var annotation = await createAnnotation('image', groupAttachment, { createdByUserID: 12345 });
					
					annotation.annotationComment = 'foobar';
					var e = await getPromiseError(annotation.saveTx());
					assert.ok(e);
					assert.include(e.message, "Cannot edit item");
				});
			});
			
			describe("'erase'", function () {
				it("should return true for annotations created by another user", async function () {
					assert.isTrue(groupAnnotation3.isEditable('erase'));
				});
				
				it("should allow deletion of group annotation owned by another user", async function () {
					var annotation = await createAnnotation('image', groupAttachment, { createdByUserID: 12345 });
					await annotation.eraseTx();
				});
			});
		});
	});
	
	
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
			item = Zotero.Items.get(id);
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
			item = Zotero.Items.get(id);
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
			item = Zotero.Items.get(id);
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

	describe("#getItemsListTags", function() {
		it("should return tags with emojis after colored tags", async function () {
			var tags = [
				{
					tag: "BBB ⭐️⭐️"
				},
				{
					tag: "ZZZ 👲"
				},
				{
					tag: "colored tag two"
				},
				{
					tag: "AAA 😀"
				},
				{
					tag: "colored tag one"
				},
				{
					tag: "not included"
				}
			];
			await Zotero.Tags.setColor(Zotero.Libraries.userLibraryID, "colored tag one", "#990000");
			await Zotero.Tags.setColor(Zotero.Libraries.userLibraryID, "colored tag two", "#FF6666");

			var item = new Zotero.Item('journalArticle');
			item.setTags(tags);
			await item.saveTx();

			var itemListTags = item.getItemsListTags();
			var expected = [
				{ tag: "colored tag one", color: "#990000" },
				{ tag: "colored tag two", color: "#FF6666" },
				{ tag: "AAA 😀", color: null },
				{ tag: "BBB ⭐️⭐️", color: null },
				{ tag: "ZZZ 👲", color: null },
			];
			for (let i = 0; i < 5; i++) {
				assert.deepEqual(itemListTags[i], expected[i]);
			}
		});
	});
	
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
		
		describe("saving a child item", function () {
			it("should throw an error if a new note is the child of another note", async function () {
				var note1 = await createDataObject('item', { itemType: 'note' });
				var note2 = createUnsavedDataObject('item', { itemType: 'note', parentID: note1.id });
				var e = await getPromiseError(note2.saveTx());
				assert.ok(e);
				assert.include(e.message, "must be a regular item");
			});
			
			it("should throw an error if a new imported_file attachment is the child of a note", async function () {
				var note = await createDataObject('item', { itemType: 'note' });
				var e = await getPromiseError(importFileAttachment('test.png', { parentItemID: note.id }));
				assert.ok(e);
				assert.include(e.message, "must be a regular item");
			});
			
			it("should throw an error if a new note is the child of another attachment", async function () {
				var attachment = await importFileAttachment('test.png');
				var note = createUnsavedDataObject('item', { itemType: 'note', parentID: attachment.id });
				var e = await getPromiseError(note.saveTx());
				assert.ok(e);
				assert.include(e.message, "must be a regular item");
			});
			
			it("should throw an error if an existing note is set as a child of another note", async function () {
				var note1 = await createDataObject('item', { itemType: 'note' });
				var note2 = createUnsavedDataObject('item', { itemType: 'note' });
				await note2.saveTx();
				note2.parentID = note1.id;
				var e = await getPromiseError(note2.saveTx());
				assert.ok(e);
				assert.include(e.message, "must be a regular item");
			});
		});
		
		it("should reload child items for parent items", function* () {
			var item = yield createDataObject('item');
			var attachment = yield importFileAttachment('test.png', { parentItemID: item.id });
			var note1 = new Zotero.Item('note');
			note1.parentItemID = item.id;
			yield note1.saveTx();
			var note2 = new Zotero.Item('note');
			note2.parentItemID = item.id;
			yield note2.saveTx();
			
			assert.lengthOf(item.getAttachments(), 1);
			assert.lengthOf(item.getNotes(), 2);
			
			note2.parentItemID = null;
			yield note2.saveTx();
			
			assert.lengthOf(item.getAttachments(), 1);
			assert.lengthOf(item.getNotes(), 1);
		});
		
		// Make sure we're updating annotations rather than replacing and triggering ON DELETE CASCADE
		it("should update attachment without deleting child annotations", async function () {
			var attachment = await importFileAttachment('test.pdf');
			var annotation = await createAnnotation('highlight', attachment);
			
			var annotationIDs = await Zotero.DB.columnQueryAsync(
				"SELECT itemID FROM itemAnnotations WHERE parentItemID=?", attachment.id
			);
			assert.lengthOf(annotationIDs, 1);
			
			attachment.attachmentLastProcessedModificationTime = Math.floor(Date.now() / 1000);
			await attachment.saveTx();
			
			annotationIDs = await Zotero.DB.columnQueryAsync(
				"SELECT itemID FROM itemAnnotations WHERE parentItemID=?", attachment.id
			);
			assert.lengthOf(annotationIDs, 1);
		});
		
		it("should set username as name if not set for library item", async function () {
			await Zotero.Users.setCurrentUserID(1);
			var username = Zotero.Utilities.randomString();
			await Zotero.Users.setCurrentUsername(username);
			await Zotero.DB.queryAsync("DELETE FROM users");
			
			var group = await createGroup();
			var libraryID = group.libraryID;
			var item = await createDataObject('item', { libraryID });
			
			assert.equal(Zotero.Users.getCurrentName(), username);
		});
	})
	
	
	describe("#_eraseData()", function () {
		it("should remove relations pointing to this item", function* () {
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject('item');
			item1.addRelatedItem(item2);
			yield item1.saveTx();
			item2.addRelatedItem(item1);
			yield item2.saveTx();
			
			yield item1.eraseTx();
			
			assert.lengthOf(item2.relatedItems, 0);
			yield assert.eventually.equal(
				Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM itemRelations WHERE itemID=?", item2.id),
				0
			);
		});
		
		it("should remove an item in a collection in a read-only library with 'skipEditCheck'", async function () {
			var group = await createGroup();
			var libraryID = group.libraryID;
			var collection = await createDataObject('collection', { libraryID });
			var item = await createDataObject('item', { libraryID, collections: [collection.id] });
			
			group.editable = false;
			await group.save();
			
			await item.eraseTx({
				skipEditCheck: true
			});
		});
		
		it("should remove cached image for an annotation item", async function () {
			var attachment = await importFileAttachment('test.pdf');
			var annotation = await createAnnotation('image', attachment);
			
			// Get Blob from file and attach it
			var path = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var imageData = await Zotero.File.getBinaryContentsAsync(path);
			var array = new Uint8Array(imageData.length);
			for (let i = 0; i < imageData.length; i++) {
				array[i] = imageData.charCodeAt(i);
			}
			var blob = new Blob([array], { type: 'image/png' });
			var file = await Zotero.Annotations.saveCacheImage(annotation, blob);
			
			assert.isTrue(await OS.File.exists(file));
			await annotation.eraseTx();
			assert.isFalse(await OS.File.exists(file));
		});
	});
	
	
	describe("#multiDiff", function () {
		it("should return set of alternatives for differing fields in other items", function* () {
			var type = 'item';
			
			var dates = ['2016-03-08 17:44:45'];
			var accessDates = ['2016-03-08T18:44:45Z'];
			var urls = ['http://www.example.com', 'http://example.net'];
			
			var obj1 = createUnsavedDataObject(type);
			obj1.setField('date', '2016-03-07 12:34:56'); // different in 1 and 3, not in 2
			obj1.setField('url', 'http://example.com'); // different in all three
			obj1.setField('title', 'Test'); // only in 1
			
			var obj2 = createUnsavedDataObject(type);
			obj2.setField('url', urls[0]);
			obj2.setField('accessDate', accessDates[0]); // only in 2
			
			var obj3 = createUnsavedDataObject(type);
			obj3.setField('date', dates[0]);
			obj3.setField('url', urls[1]);
			
			var alternatives = obj1.multiDiff([obj2, obj3]);
			
			assert.sameMembers(Object.keys(alternatives), ['url', 'date', 'accessDate']);
			assert.sameMembers(alternatives.url, urls);
			assert.sameMembers(alternatives.date, dates);
			assert.sameMembers(alternatives.accessDate, accessDates);
		});
	});
	
	
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
			var newItem = item.clone();
			assert.sameDeepMembers(item.getCreators(), newItem.getCreators());
		})
		
		it("shouldn't copy linked-item relation", async function () {
			var group = await getGroup();
			var groupItem = await createDataObject('item', { libraryID: group.libraryID });
			var item = await createDataObject('item');
			await item.addLinkedItem(groupItem);
			assert.equal(await item.getLinkedItem(group.libraryID), groupItem);
			var newItem = item.clone();
			assert.isEmpty(Object.keys(newItem.toJSON().relations));
		});
		
		it("should clone an annotation item", async function () {
			var attachment = await importFileAttachment('test.pdf');
			var annotation = await createAnnotation('highlight', attachment);
			var newAnnotation = annotation.clone();
			
			var fields = Object.keys(annotation.toJSON())
				.filter(field => field.startsWith('annotation'));
			assert.isAbove(fields.length, 0);
			for (let field of fields) {
				assert.equal(annotation[field], newAnnotation[field], field);
			}
		});
	})
	
	describe("#moveToLibrary()", function () {
		it("should move items from My Library to a filesEditable group", async function () {
			var group = await createGroup();
			
			var item = await createDataObject('item');
			var attachment1 = await importFileAttachment('test.png', { parentID: item.id });
			var file = getTestDataDirectory();
			file.append('test.png');
			var attachment2 = await Zotero.Attachments.linkFromFile({
				file,
				parentItemID: item.id
			});
			var note = await createDataObject('item', { itemType: 'note', parentID: item.id });
			
			var originalIDs = [item.id, attachment1.id, attachment2.id, note.id];
			var originalAttachmentFile = attachment1.getFilePath();
			var originalAttachmentHash = await attachment1.attachmentHash
			
			assert.isTrue(await OS.File.exists(originalAttachmentFile));
			
			var newItem = await item.moveToLibrary(group.libraryID);
			
			// Old items and file should be gone
			assert.isTrue(originalIDs.every(id => !Zotero.Items.get(id)));
			assert.isFalse(await OS.File.exists(originalAttachmentFile));
			
			// New items and stored file should exist; linked file should be gone
			assert.equal(newItem.libraryID, group.libraryID);
			assert.lengthOf(newItem.getAttachments(), 1);
			var newAttachment = Zotero.Items.get(newItem.getAttachments()[0]);
			assert.equal(await newAttachment.attachmentHash, originalAttachmentHash);
			assert.lengthOf(newItem.getNotes(), 1);
		});
		
		it("should move items from My Library to a non-filesEditable group", async function () {
			var group = await createGroup({
				filesEditable: false
			});
			
			var item = await createDataObject('item');
			var attachment = await importFileAttachment('test.png', { parentID: item.id });
			
			var originalIDs = [item.id, attachment.id];
			var originalAttachmentFile = attachment.getFilePath();
			var originalAttachmentHash = await attachment.attachmentHash
			
			assert.isTrue(await OS.File.exists(originalAttachmentFile));
			
			var newItem = await item.moveToLibrary(group.libraryID);
			
			// Old items and file should be gone
			assert.isTrue(originalIDs.every(id => !Zotero.Items.get(id)));
			assert.isFalse(await OS.File.exists(originalAttachmentFile));
			
			// Parent should exist, but attachment should not
			assert.equal(newItem.libraryID, group.libraryID);
			assert.lengthOf(newItem.getAttachments(), 0);
		});
	});
	
	describe("#toJSON()", function () {
		describe("default mode", function () {
			it("should output only fields with values", function* () {
				var itemType = "book";
				var title = "Test";
				
				var item = new Zotero.Item(itemType);
				item.setField("title", title);
				var id = yield item.saveTx();
				item = Zotero.Items.get(id);
				var json = item.toJSON();
				
				assert.equal(json.itemType, itemType);
				assert.equal(json.title, title);
				assert.isUndefined(json.date);
				assert.isUndefined(json.numPages);
			})
			
			describe("Attachments", function () {
				it.skip("should output attachment fields from file", function* () {
					var file = getTestDataDirectory();
					file.append('test.png');
					var item = yield Zotero.Attachments.importFromFile({ file });
					
					yield Zotero.DB.executeTransaction(function* () {
						yield Zotero.Sync.Storage.Local.setSyncedModificationTime(
							item.id, new Date().getTime()
						);
						yield Zotero.Sync.Storage.Local.setSyncedHash(
							item.id, 'b32e33f529942d73bea4ed112310f804'
						);
					});
					
					var json = item.toJSON();
					assert.equal(json.linkMode, 'imported_file');
					assert.equal(json.filename, 'test.png');
					assert.isUndefined(json.path);
					assert.equal(json.mtime, (yield item.attachmentModificationTime));
					assert.equal(json.md5, (yield item.attachmentHash));
				})
				
				it("should omit storage values with .skipStorageProperties", function* () {
					var file = getTestDataDirectory();
					file.append('test.png');
					var item = yield Zotero.Attachments.importFromFile({ file });
					
					item.attachmentSyncedModificationTime = new Date().getTime();
					item.attachmentSyncedHash = 'b32e33f529942d73bea4ed112310f804';
					yield item.saveTx({ skipAll: true });
					
					var json = item.toJSON({
						skipStorageProperties: true
					});
					assert.isUndefined(json.mtime);
					assert.isUndefined(json.md5);
				});
				
				it("should output synced storage values with .syncedStorageProperties", function* () {
					var item = new Zotero.Item('attachment');
					item.attachmentLinkMode = 'imported_file';
					item.fileName = 'test.txt';
					yield item.saveTx();
					
					var mtime = new Date().getTime();
					var md5 = 'b32e33f529942d73bea4ed112310f804';
					
					item.attachmentSyncedModificationTime = mtime;
					item.attachmentSyncedHash = md5;
					yield item.saveTx({ skipAll: true });
					
					var json = item.toJSON({
						syncedStorageProperties: true
					});
					assert.equal(json.mtime, mtime);
					assert.equal(json.md5, md5);
				})
				
				it.skip("should output unset storage properties as null", function* () {
					var item = new Zotero.Item('attachment');
					item.attachmentLinkMode = 'imported_file';
					item.fileName = 'test.txt';
					var id = yield item.saveTx();
					var json = item.toJSON();
					
					assert.isNull(json.mtime);
					assert.isNull(json.md5);
				})
				
				it("shouldn't include filename, path, or PDF properties for linked_url attachments", function* () {
					var item = new Zotero.Item('attachment');
					item.attachmentLinkMode = 'linked_url';
					item.url = "https://www.zotero.org/";
					var json = item.toJSON();
					assert.notProperty(json, "filename");
					assert.notProperty(json, "path");
				});
				
				it("shouldn't include various properties on embedded-image attachments", async function () {
					var item = await createDataObject('item', { itemType: 'note' });
					var attachment = await createEmbeddedImage(item);
					var json = attachment.toJSON();
					assert.notProperty(json, 'title');
					assert.notProperty(json, 'url');
					assert.notProperty(json, 'accessDate');
					assert.notProperty(json, 'tags');
					assert.notProperty(json, 'collections');
					assert.notProperty(json, 'relations');
					assert.notProperty(json, 'note');
					assert.notProperty(json, 'charset');
					assert.notProperty(json, 'path');
				});
			});
			
			describe("Annotations", function () {
				var attachment;
				
				before(async function () {
					attachment = await importFileAttachment('test.pdf');
				});
				
				it("should output highlight annotation", async function () {
					var item = createUnsavedDataObject(
						'item', { itemType: 'annotation', parentKey: attachment.key }
					);
					item.annotationType = 'highlight';
					item.annotationText = "This is an <b>extracted</b> text with rich-text\nAnd a new line";
					item.annotationComment = "This is a comment with <i>rich-text</i>\nAnd a new line";
					item.annotationColor = "#ffec00";
					item.annotationPageLabel = "15";
					item.annotationSortIndex = "00015|002431|00000";
					item.annotationPosition = JSON.stringify({
						"pageIndex": 1,
						"rects": [
							[231.284, 402.126, 293.107, 410.142],
							[54.222, 392.164, 293.107, 400.18],
							[54.222, 382.201, 293.107, 390.217],
							[54.222, 372.238, 293.107, 380.254],
							[54.222, 362.276, 273.955, 370.292]
						]
					});
					var json = item.toJSON();
					
					for (let prop of ['Type', 'Text', 'Comment', 'Color', 'PageLabel', 'SortIndex']) {
						let name = 'annotation' + prop;
						assert.propertyVal(json, name, item[name]);
					}
					assert.deepEqual(json.annotationPosition, item.annotationPosition);
					assert.doesNotHaveAnyKeys(json.relations);
					assert.notProperty(json, 'collections');
					assert.notProperty(json, 'annotationIsExternal');
				});
				
				it("should include Mendeley annotation relation", async function () {
					var item = createUnsavedDataObject(
						'item', { itemType: 'annotation', parentKey: attachment.key }
					);
					item.annotationType = 'highlight';
					item.annotationText = "Foo";
					item.annotationComment = "";
					item.annotationColor = "#ffec00";
					item.annotationPageLabel = "15";
					item.annotationSortIndex = "00015|002431|00000";
					item.annotationPosition = JSON.stringify({
						"pageIndex": 1,
						"rects": [
							[231.284, 402.126, 293.107, 410.142]
						]
					});
					item.setRelations({
						'mendeleyDB:annotationUUID': '13e4ec18-f49a-47fb-93f6-fda915d3a1c2'
					});
					var json = item.toJSON();
					assert.sameMembers(
						json.relations['mendeleyDB:annotationUUID'],
						item.getRelations()['mendeleyDB:annotationUUID']
					);
				});
				
				describe("#annotationIsExternal", function () {
					it("should be false if not set", async function () {
						var item = await createAnnotation('highlight', attachment);
						assert.isFalse(item.annotationIsExternal);
					});
					
					it("should be true if set", async function () {
						var item = await createAnnotation('highlight', attachment, { isExternal: true });
						assert.isTrue(item.annotationIsExternal);
					});
					
					it("should prevent changing of annotationIsExternal on existing item", async function () {
						var item = await createAnnotation('highlight', attachment);
						assert.throws(() => {
							item.annotationIsExternal = true;
						}, "Cannot change annotationIsExternal");
					});
				});
			});
			
			it("should include inPublications=true for items in My Publications", function* () {
				var item = createUnsavedDataObject('item');
				item.inPublications = true;
				var json = item.toJSON();
				assert.propertyVal(json, "inPublications", true);
			});
			
			it("shouldn't include inPublications for items not in My Publications in patch mode", function* () {
				var item = createUnsavedDataObject('item');
				var json = item.toJSON();
				assert.notProperty(json, "inPublications");
			});
			
			it("should include inPublications=false for personal-library items not in My Publications in full mode", async function () {
				var item = createUnsavedDataObject('item', { libraryID: Zotero.Libraries.userLibraryID });
				var json = item.toJSON({ mode: 'full' });
				assert.property(json, "inPublications", false);
			});
			
			it("shouldn't include inPublications=false for group items not in My Publications in full mode", function* () {
				var group = yield getGroup();
				var item = createUnsavedDataObject('item', { libraryID: group.libraryID });
				var json = item.toJSON({ mode: 'full' });
				assert.notProperty(json, "inPublications");
			});
		})
		
		describe("'full' mode", function () {
			it("should output all fields", function* () {
				var itemType = "book";
				var title = "Test";
				
				var item = new Zotero.Item(itemType);
				item.setField("title", title);
				var id = yield item.saveTx();
				item = yield Zotero.Items.getAsync(id);
				var json = item.toJSON({ mode: 'full' });
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
				var patchBase = item.toJSON();
				
				item.setField("date", date);
				yield item.saveTx();
				var json = item.toJSON({
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
			
			it("should set 'parentItem' to false when cleared", function* () {
				var item = yield createDataObject('item');
				var note = new Zotero.Item('note');
				note.parentID = item.id;
				// Create initial JSON with parentItem
				var patchBase = note.toJSON();
				// Clear parent item and regenerate JSON
				note.parentID = false;
				var json = note.toJSON({ patchBase });
				assert.isFalse(json.parentItem);
			});
			
			it("should include relations if related item was removed", function* () {
				var item1 = yield createDataObject('item');
				var item2 = yield createDataObject('item');
				var item3 = yield createDataObject('item');
				var item4 = yield createDataObject('item');
				
				var relateItems = Zotero.Promise.coroutine(function* (i1, i2) {
					yield Zotero.DB.executeTransaction(async function () {
						i1.addRelatedItem(i2);
						await i1.save({
							skipDateModifiedUpdate: true
						});
						i2.addRelatedItem(i1);
						await i2.save({
							skipDateModifiedUpdate: true
						});
					});
				});
				
				yield relateItems(item1, item2);
				yield relateItems(item1, item3);
				yield relateItems(item1, item4);
				
				var patchBase = item1.toJSON();
				
				item1.removeRelatedItem(item2);
				yield item1.saveTx();
				item2.removeRelatedItem(item1);
				yield item2.saveTx();
				
				var json = item1.toJSON({ patchBase });
				assert.sameMembers(json.relations['dc:relation'], item1.getRelations()['dc:relation']);
			});
			
			it("shouldn't clear storage properties from original in .skipStorageProperties mode", function* () {
				var item = new Zotero.Item('attachment');
				item.attachmentLinkMode = 'imported_file';
				item.attachmentFilename = 'test.txt';
				item.attachmentContentType = 'text/plain';
				item.attachmentCharset = 'utf-8';
				item.attachmentSyncedModificationTime = 1234567890000;
				item.attachmentSyncedHash = '18d21750c8abd5e3afa8ea89e3dfa570';
				var patchBase = item.toJSON({
					syncedStorageProperties: true
				});
				item.setNote("Test");
				var json = item.toJSON({
					patchBase,
					skipStorageProperties: true
				});
				Zotero.debug(json);
				assert.equal(json.note, "Test");
				assert.notProperty(json, "md5");
				assert.notProperty(json, "mtime");
			});
		})
	})
	
	describe("#fromJSON()", function () {
		it("should clear missing fields", function* () {
			var item = new Zotero.Item('book');
			item.setField('title', 'Test');
			item.setField('date', '2016');
			item.setField('accessDate', '2015-06-07T20:56:00Z');
			yield item.saveTx();
			var json = item.toJSON();
			// Remove fields, which should cause them to be cleared in fromJSON()
			delete json.date;
			delete json.accessDate;
			
			item.fromJSON(json);
			assert.strictEqual(item.getField('title'), 'Test');
			assert.strictEqual(item.getField('date'), '');
			assert.strictEqual(item.getField('accessDate'), '');
		});
		
		it("should remove missing creators and change existing", function () {
			var item = new Zotero.Item('book');
			item.setCreators(
				[
					{
						name: "A",
						creatorType: "author"
					},
					{
						name: "B",
						creatorType: "author"
					},
					{
						name: "C",
						creatorType: "author"
					}
				]
			);
			var json = item.toJSON();
			// Remove creators, which should cause them to be cleared in fromJSON()
			var newCreators = [
				{
					name: "D",
					creatorType: "author"
				}
			];
			json.creators = newCreators;
			
			item.fromJSON(json);
			assert.sameDeepMembers(item.getCreatorsJSON(), newCreators);
		});
		
		it("should remove item from collection if 'collections' property not provided", function* () {
			var collection = yield createDataObject('collection');
			// Create standalone attachment in collection
			var attachment = yield importFileAttachment('test.png', { collections: [collection.id] });
			var item = yield createDataObject('item', { collections: [collection.id] });
			
			assert.isTrue(collection.hasItem(attachment.id));
			var json = attachment.toJSON();
			json.path = 'storage:test2.png';
			// Add to parent, which implicitly removes from collection
			json.parentItem = item.key;
			delete json.collections;
			attachment.fromJSON(json);
			yield attachment.saveTx();
			assert.isFalse(collection.hasItem(attachment.id));
		});
		
		it("should remove child item from parent if 'parentKey' property not provided", async function () {
			var item = await createDataObject('item');
			var note = await createDataObject('item', { itemType: 'note', parentKey: [item.key] });
			
			var json = note.toJSON();
			delete json.parentItem;
			
			note.fromJSON(json);
			await note.saveTx();
			
			assert.lengthOf(item.getNotes(), 0);
		});
		
		
		it("should remove item from My Publications if 'inPublications' property not provided", async function () {
			var item = await createDataObject('item', { inPublications: true });
			
			assert.isTrue(item.inPublications);
			
			var json = item.toJSON();
			delete json.inPublications;
			
			item.fromJSON(json);
			await item.saveTx();
			
			assert.isFalse(item.inPublications);
		});
		
		// Not currently following this behavior
		/*it("should move valid field in Extra to field if not set", function () {
			var doi = '10.1234/abcd';
			var json = {
				itemType: "journalArticle",
				title: "Test",
				extra: `DOI: ${doi}`
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(item.getField('DOI'), doi);
			assert.equal(item.getField('extra'), '');
		});
		
		it("shouldn't move valid field in Extra to field if also present in JSON", function () {
			var doi1 = '10.1234/abcd';
			var doi2 = '10.2345/bcde';
			var json = {
				itemType: "journalArticle",
				title: "Test",
				DOI: doi1,
				extra: `doi: ${doi2}`
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(item.getField('DOI'), doi1);
			assert.equal(item.getField('extra'), `doi: ${doi2}`);
		});
		
		it("shouldn't move valid field in Extra to field if already set", function () {
			var doi1 = '10.1234/abcd';
			var doi2 = '10.2345/bcde';
			var json = {
				itemType: "journalArticle",
				title: "Test",
				DOI: doi1,
				extra: `doi: ${doi2}`
			};
			var item = new Zotero.Item('journalArticle');
			item.setField('DOI', doi1);
			item.fromJSON(json);
			assert.equal(item.getField('DOI'), doi1);
			assert.equal(item.getField('extra'), `doi: ${doi2}`);
		});*/
		
		it("should use valid CSL type from Extra", function () {
			var json = {
				itemType: "journalArticle",
				pages: "123",
				extra: "Type: song"
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('audioRecording'));
			// A field valid for the old item type should be moved to Extra
			assert.equal(item.getField('extra'), 'Pages: 123');
		});
		
		it("shouldn't convert 'Type: article' from Extra into Document item", function () {
			var json = {
				itemType: "report",
				extra: "Type: article"
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(Zotero.ItemTypes.getName(item.itemTypeID), 'report');
			assert.equal(item.getField('extra'), 'Type: article');
		});
		
		it("should ignore creator field in Extra", async function () {
			var json = {
				itemType: "journalArticle",
				extra: "Author: Name"
			};
			var item = new Zotero.Item();
			item.fromJSON(json);
			assert.lengthOf(item.getCreatorsJSON(), 0);
			assert.equal(item.getField('extra'), json.extra);
		});
		
		describe("not-strict mode", function () {
			it("should handle Extra in non-strict mode", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					extra: "Here's some extra text"
				};
				var item = new Zotero.Item();
				item.fromJSON(json);
				assert.equal(item.getField('extra'), json.extra);
			});
			
			it("should store unknown fields in Extra", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					fooBar: "123",
					testField: "test value"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('title'), 'Test');
				assert.equal(item.getField('extra'), 'Foo Bar: 123\nTest Field: test value');
			});
			
			it("should replace unknown field in Extra", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					foo: "BBB",
					extra: "Foo: AAA\nBar: CCC"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('title'), 'Test');
				assert.equal(item.getField('extra'), 'Foo: BBB\nBar: CCC');
			});
			
			it("should store invalid-for-type field in Extra", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					medium: "123"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('title'), 'Test');
				assert.equal(item.getField('extra'), 'Medium: 123');
			});
			
			it("should ignore invalid-for-type base-mapped field if valid-for-type base field is set in Extra", function () {
				var json = {
					itemType: "document",
					publisher: "Foo", // Valid for 'document'
					company: "Bar" // Not valid for 'document', but mapped to base field 'publisher'
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('publisher'), 'Foo');
				assert.equal(item.getField('extra'), '');
			});
			
			it("shouldn't include base field or invalid base-mapped field in Extra if valid base-mapped field is set", function () {
				var json = {
					itemType: "audioRecording",
					publisher: "A", // Base field, which will be overwritten by the valid base-mapped field
					label: "B", // Valid base-mapped field, which should be stored
					company: "C", // Invalid base-mapped field, which should be ignored
					foo: "D" // Invalid other field, which should be added to Extra
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('label'), 'B');
				assert.equal(item.getField('extra'), 'Foo: D');
			});
			
			it("should remove invalid-for-type base-mapped fields with same values and use base field if not present when storing in Extra", function () {
				var json = {
					itemType: "artwork",
					publisher: "Foo", // Invalid base field
					company: "Foo", // Invalid base-mapped field
					label: "Foo" // Invaid base-mapped field
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('extra'), 'Publisher: Foo');
			});
			
			it("should remove invalid-for-type base-mapped Type fields when storing in Extra", function () {
				var json = {
					itemType: "document",
					reportType: "Foo", // Invalid base-mapped field
					websiteType: "Foo" // Invaid base-mapped field
				};
				// Confirm that 'type' is still invalid for 'document', in case this changes
				assert.isFalse(Zotero.ItemFields.isValidForType(
					Zotero.ItemFields.getID('type'),
					Zotero.ItemTypes.getID('document')
				));
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('extra'), '');
			});
			
			it("should ignore some redundant fields from RDF translator (temporary)", function () {
				var json = {
					itemType: "book",
					edition: "1",
					versionNumber: "1"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('edition'), "1");
				assert.equal(item.getField('extra'), '');
				
				json = {
					itemType: "presentation",
					meetingName: "Foo",
					conferenceName: "Foo"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('meetingName'), "Foo");
				assert.equal(item.getField('extra'), '');
				
				json = {
					itemType: "journalArticle",
					publicationTitle: "Foo",
					reporter: "Foo"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('publicationTitle'), "Foo");
				assert.equal(item.getField('extra'), '');
				
				json = {
					itemType: "conferencePaper",
					proceedingsTitle: "Foo",
					reporter: "Foo"
				};
				var item = new Zotero.Item;
				item.fromJSON(json);
				assert.equal(item.getField('proceedingsTitle'), "Foo");
				assert.equal(item.getField('extra'), '');
			});
		});
		
		describe("strict mode", function () {
			it("should throw on unknown field", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					foo: "Bar"
				};
				var item = new Zotero.Item;
				var f = () => {
					item.fromJSON(json, { strict: true });
				};
				assert.throws(f, /^Unknown field/);
			});
			
			it("should throw on invalid field for a given item type", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					numPages: "123"
				};
				var item = new Zotero.Item;
				var f = () => {
					item.fromJSON(json, { strict: true });
				};
				assert.throws(f, /^Invalid field/);
			});
			
			it("should throw on unknown creator type", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					creators: [
						{
							firstName: "First",
							lastName: "Last",
							creatorType: "unknown"
						}
					]
				};
				var item = new Zotero.Item;
				var f = () => {
					item.fromJSON(json, { strict: true });
				};
				assert.throws(f, /^Unknown creator type/);
			});
			
			it("should throw on invalid creator type for a given item type", function () {
				var json = {
					itemType: "journalArticle",
					title: "Test",
					creators: [
						{
							firstName: "First",
							lastName: "Last",
							creatorType: "interviewee"
						}
					]
				};
				var item = new Zotero.Item;
				var f = () => {
					item.fromJSON(json, { strict: true });
				};
				assert.throws(f, /^Invalid creator type/);
			});
		});
		
		it("should accept ISO 8601 dates", function* () {
			var json = {
				itemType: "journalArticle",
				accessDate: "2015-06-07T20:56:00Z",
				dateAdded: "2015-06-07T20:57:00Z",
				dateModified: "2015-06-07T20:58:00Z",
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(item.getField('accessDate'), '2015-06-07 20:56:00');
			assert.equal(item.dateAdded, '2015-06-07 20:57:00');
			assert.equal(item.dateModified, '2015-06-07 20:58:00');
		})
		
		it("should accept ISO 8601 access date without time", function* () {
			var json = {
				itemType: "journalArticle",
				accessDate: "2015-06-07",
				dateAdded: "2015-06-07T20:57:00Z",
				dateModified: "2015-06-07T20:58:00Z",
			};
			var item = new Zotero.Item;
			item.fromJSON(json);
			assert.equal(item.getField('accessDate'), '2015-06-07');
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
			item.fromJSON(json);
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
			item.fromJSON(json);
			var id = yield item.saveTx();
			assert.sameDeepMembers(item.getCreatorsJSON(), json.creators);
		})
		
		it("should map a base field to an item-specific field", function* () {
			var item = new Zotero.Item("bookSection");
			item.fromJSON({
				"itemType":"bookSection",
				"publicationTitle":"Publication Title"
			});
			assert.equal(item.getField("bookTitle"), "Publication Title");
		});
		
		it("should import attachment content type and path", async function () {
			var contentType = 'application/pdf';
			var path = OS.Path.join(getTestDataDirectory().path, 'test.pdf');
			var json = {
				itemType: 'attachment',
				linkMode: 'linked_file',
				contentType,
				path
			};
			var item = new Zotero.Item();
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.fromJSON(json, { strict: true });
			assert.propertyVal(item, 'attachmentContentType', contentType);
			assert.propertyVal(item, 'attachmentPath', path);
		});
		
		it("should import other attachment fields", async function () {
			var contentType = 'application/pdf';
			var json = {
				itemType: 'attachment',
				linkMode: 'linked_file',
				contentType: 'text/plain',
				charset: 'utf-8',
				path: 'attachments:test.txt'
			};
			var item = new Zotero.Item();
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.fromJSON(json, { strict: true });
			assert.propertyVal(item, 'attachmentCharset', 'utf-8');
		});
		
		it("should import annotation fields", async function () {
			var attachment = await importPDFAttachment();
			
			var item = new Zotero.Item();
			item.libraryID = attachment.libraryID;
			var json = {
				itemType: "annotation",
				parentItem: attachment.key,
				annotationType: 'highlight',
				annotationText: "This is highlighted text.",
				annotationComment: "This is a comment with <i>rich-text</i>\nAnd a new line",
				annotationSortIndex: '00015|002431|00000',
				annotationPosition: JSON.stringify({
					pageIndex: 123,
					rects: [
						[314.4, 412.8, 556.2, 609.6]
					]
				}),
				tags: [
					{
						tag: "tagA"
					}
				]
			};
			item.fromJSON(json, { strict: true });
			for (let i in json) {
				if (i == 'tags') {
					assert.deepEqual(item.getTags(), json[i]);
				}
				else if (i == 'parentItem') {
					assert.equal(item.parentKey, json[i]);
				}
				else {
					assert.equal(item[i], json[i]);
				}
			}
		});
	});
});
