Components.utils.import("resource://gre/modules/osfile.jsm");

describe("Zotero.Translate.ItemGetter", function() {
	describe("nextItem", function() {
		it('should return false for an empty database', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			assert.isFalse(yield getter.nextItem());
		}));
		it('should return items in order they are supplied', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let items, itemIDs, itemURIs;

			yield Zotero.DB.executeTransaction(function* () {
				items = [
					yield new Zotero.Item('journalArticle'),
					yield new Zotero.Item('book')
				];
				
				itemIDs = [ yield items[0].save(), yield items[1].save() ];
				itemURIs = items.map(i => Zotero.URI.getItemURI(i));
			});
			
			getter._itemsLeft = items;
			
			assert.equal((yield getter.nextItem()).uri, itemURIs[0], 'first item comes out first');
			assert.equal((yield getter.nextItem()).uri, itemURIs[1], 'second item comes out second');
			assert.isFalse((yield getter.nextItem()), 'end of item queue');
		}));
		it('should return items with tags in expected format', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let itemWithAutomaticTag, itemWithManualTag, itemWithMultipleTags
			
			yield Zotero.DB.executeTransaction(function* () {
				itemWithAutomaticTag = new Zotero.Item('journalArticle');
				itemWithAutomaticTag.addTag('automatic tag', 0);
				yield itemWithAutomaticTag.save();
				
				itemWithManualTag = new Zotero.Item('journalArticle');
				itemWithManualTag.addTag('manual tag', 1);
				yield itemWithManualTag.save();
				
				itemWithMultipleTags = new Zotero.Item('journalArticle');
				itemWithMultipleTags.addTag('tag1', 0);
				itemWithMultipleTags.addTag('tag2', 1);
				yield itemWithMultipleTags.save();
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				getter._itemsLeft = [itemWithAutomaticTag, itemWithManualTag, itemWithMultipleTags];
				getter.legacy = legacyMode[i];
				let suffix = legacyMode[i] ? ' in legacy mode' : '';
				
				// itemWithAutomaticTag
				let translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains automatic tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'automatic tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'automatic tag', 'automatic tag name provided as "tag" property' + suffix);
				if (legacyMode[i]) {
					assert.equal(translatorItem.tags[0].type, 0, 'automatic tag "type" is 0' + suffix);
				} else {
					assert.isUndefined(translatorItem.tags[0].type, '"type" is undefined for automatic tag' + suffix);
				}
				
				// itemWithManualTag
				translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains manual tags in an array' + suffix);
				assert.isObject(translatorItem.tags[0], 'manual tag is an object' + suffix);
				assert.equal(translatorItem.tags[0].tag, 'manual tag', 'manual tag name provided as "tag" property' + suffix);
				assert.equal(translatorItem.tags[0].type, 1, 'manual tag "type" is 1' + suffix);
				
				// itemWithMultipleTags
				translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.tags, 'item contains multiple tags in an array' + suffix);
				assert.lengthOf(translatorItem.tags, 2, 'expected number of tags returned' + suffix);
			}
		}));
		it('should return item collections in expected format', Zotero.Promise.coroutine(function* () {
			let getter = new Zotero.Translate.ItemGetter();
			let items, collections;
			
			yield Zotero.DB.executeTransaction(function* () {
				items = getter._itemsLeft = [
					new Zotero.Item('journalArticle'), // Not in collection
					new Zotero.Item('journalArticle'), // In a single collection
					new Zotero.Item('journalArticle'), //In two collections
					new Zotero.Item('journalArticle') // In a nested collection
				];
				yield Zotero.Promise.all(items.map(item => item.save()));
				
				collections = [
					new Zotero.Collection,
					new Zotero.Collection,
					new Zotero.Collection,
					new Zotero.Collection
				];
				collections[0].name = "test1";
				collections[1].name = "test2";
				collections[2].name = "subTest1";
				collections[3].name = "subTest2";
				yield collections[0].save();
				yield collections[1].save();
				collections[2].parentID = collections[0].id;
				collections[3].parentID = collections[1].id;
				yield collections[2].save();
				yield collections[3].save();
				
				yield collections[0].addItems([items[1].id, items[2].id]);
				yield collections[1].addItem(items[2].id);
				yield collections[2].addItem(items[3].id);
			});
			
			let translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in library root has a collections array');
			assert.equal(translatorItem.collections.length, 0, 'item in library root does not list any collections');
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a single collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[0].key, 'item in a single collection identifies correct collection');
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in two collections has a collections array');
			assert.equal(translatorItem.collections.length, 2, 'item in two collections lists two collections');
			assert.deepEqual(
				translatorItem.collections.sort(),
				[collections[0].key, collections[1].key].sort(),
				'item in two collections identifies correct collections'
			);
			
			translatorItem = yield getter.nextItem();
			assert.isArray(translatorItem.collections, 'item in a nested collection has a collections array');
			assert.equal(translatorItem.collections.length, 1, 'item in a single nested collection lists one collection');
			assert.equal(translatorItem.collections[0], collections[2].key, 'item in a single collection identifies correct collection');
		}));
		// it('should return item relations in expected format', Zotero.Promise.coroutine(function* () {
		// 	let getter = new Zotero.Translate.ItemGetter();
		// 	let items;
			
		// 	yield Zotero.DB.executeTransaction(function* () {
		// 		items = [
		// 			new Zotero.Item('journalArticle'), // Item with no relations
					
		// 			new Zotero.Item('journalArticle'), // Relation set on this item
		// 			new Zotero.Item('journalArticle'), // To this item
					
		// 			new Zotero.Item('journalArticle'), // This item is related to two items below
		// 			new Zotero.Item('journalArticle'), // But this item is not related to the item below
		// 			new Zotero.Item('journalArticle')
		// 		];
		// 		yield Zotero.Promise.all(items.map(item => item.save()));
				
		// 		yield items[1].addRelatedItem(items[2].id);
				
		// 		yield items[3].addRelatedItem(items[4].id);
		// 		yield items[3].addRelatedItem(items[5].id);
		// 	});
			
		// 	getter._itemsLeft = items.slice();
			
		// 	let translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item with no relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 0, 'item with no relations does not list any relations');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the subject of a single relation has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of a single relation list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the subject of a single relation uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the subject of a single relation lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[2]), 'item that is the subject of a single relation identifies correct object URI');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the object of a single relation has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of a single relation list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the object of a single relation uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the object of a single relation lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[1]), 'item that is the object of a single relation identifies correct subject URI');
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the subject of two relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the subject of two relations list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the subject of two relations uses "dc:relation" as the predicate');
		// 	assert.isArray(translatorItem.relations['dc:relation'], 'item that is the subject of two relations lists "dc:relation" object as an array');
		// 	assert.equal(translatorItem.relations['dc:relation'].length, 2, 'item that is the subject of two relations lists two relations in the "dc:relation" array');
		// 	assert.deepEqual(translatorItem.relations['dc:relation'].sort(),
		// 		[Zotero.URI.getItemURI(items[4]), Zotero.URI.getItemURI(items[5])].sort(),
		// 		'item that is the subject of two relations identifies correct object URIs'
		// 	);
			
		// 	translatorItem = yield getter.nextItem();
		// 	assert.isObject(translatorItem.relations, 'item that is the object of one relation from item with two relations has a relations object');
		// 	assert.equal(Object.keys(translatorItem.relations).length, 1, 'item that is the object of one relation from item with two relations list one relations predicate');
		// 	assert.isDefined(translatorItem.relations['dc:relation'], 'item that is the object of one relation from item with two relations uses "dc:relation" as the predicate');
		// 	assert.isString(translatorItem.relations['dc:relation'], 'item that is the object of one relation from item with two relations lists "dc:relation" object as a string');
		// 	assert.equal(translatorItem.relations['dc:relation'], Zotero.URI.getItemURI(items[3]), 'item that is the object of one relation from item with two relations identifies correct subject URI');
		// }));
		it('should return standalone note in expected format', Zotero.Promise.coroutine(function* () {
			let relatedItem, note, collection;
			
			yield Zotero.DB.executeTransaction(function* () {
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();

				note = new Zotero.Item('note');
				note.setNote('Note');
				note.addTag('automaticTag', 0);
				note.addTag('manualTag', 1);
				// note.addRelatedItem(relatedItem.id);
				yield note.save();
				
				collection = new Zotero.Collection;
				collection.name = 'test';
				yield collection.save();
				yield collection.addItem(note.id);
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [note];
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				let translatorNote = yield getter.nextItem();
				assert.isDefined(translatorNote, 'returns standalone note' + suffix);
				assert.equal(translatorNote.itemType, 'note', 'itemType is correct' + suffix);
				assert.equal(translatorNote.note, 'Note', 'note is correct' + suffix);
				
				assert.isString(translatorNote.dateAdded, 'dateAdded is string' + suffix);
				assert.isString(translatorNote.dateModified, 'dateModified is string' + suffix);
				
				if (legacy) {
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
					
					assert.isNumber(translatorNote.itemID, 'itemID is set' + suffix);
					assert.isString(translatorNote.key, 'key is set' + suffix);
				} else {
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
				}
				
				// Tags
				assert.isArray(translatorNote.tags, 'contains tags as array' + suffix);
				assert.equal(translatorNote.tags.length, 2, 'contains correct number of tags' + suffix);
				let possibleTags = [
					{ tag: 'automaticTag', type: 0 },
					{ tag: 'manualTag', type: 1 }
				];
				for (let i=0; i<possibleTags.length; i++) {
					let match = false;
					for (let j=0; j<translatorNote.tags.length; j++) {
						if (possibleTags[i].tag == translatorNote.tags[j].tag) {
							let type = possibleTags[i].type;
							if (!legacy && type == 0) type = undefined;
							
							assert.equal(translatorNote.tags[j].type, type, possibleTags[i].tag + ' tag is correct' + suffix);
							match = true;
							break;
						}
					}
					assert.isTrue(match, 'has ' + possibleTags[i].tag + ' tag ' + suffix);
				}
				
				// Relations
				// assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				// assert.equal(translatorNote.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				
				if (!legacy) {
					// Collections
					assert.isArray(translatorNote.collections, 'has a collections array' + suffix);
					assert.equal(translatorNote.collections.length, 1, 'lists one collection' + suffix);
					assert.equal(translatorNote.collections[0], collection.key, 'identifies correct collection' + suffix);
				}
			}
		}));
		it('should return attached note in expected format', Zotero.Promise.coroutine(function* () {
			let relatedItem, items, collection, note;
			yield Zotero.DB.executeTransaction(function* () {
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();
				
				items = [
					new Zotero.Item('journalArticle'),
					new Zotero.Item('journalArticle')
				];
				yield Zotero.Promise.all(items.map(item => item.save()));
				
				collection = new Zotero.Collection;
				collection.name = 'test';
				yield collection.save();
				yield collection.addItem(items[0].id);
				yield collection.addItem(items[1].id);
				
				note = new Zotero.Item('note');
				note.setNote('Note');
				note.addTag('automaticTag', 0);
				note.addTag('manualTag', 1);
				yield note.save();
				
				// note.addRelatedItem(relatedItem.id);
			});
			
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let item = items[i];
				
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				let translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.notes, 'item with no notes contains notes array' + suffix);
				assert.equal(translatorItem.notes.length, 0, 'item with no notes contains empty notes array' + suffix);
				
				note.parentID = item.id;
				yield note.saveTx();
				
				getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = [item];
				getter.legacy = legacy;
				
				translatorItem = yield getter.nextItem();
				assert.isArray(translatorItem.notes, 'item with no notes contains notes array' + suffix);
				assert.equal(translatorItem.notes.length, 1, 'item with one note contains array with one note' + suffix);
				
				let translatorNote = translatorItem.notes[0];
				assert.equal(translatorNote.itemType, 'note', 'itemType is correct' + suffix);
				assert.equal(translatorNote.note, 'Note', 'note is correct' + suffix);
				
				assert.isString(translatorNote.dateAdded, 'dateAdded is string' + suffix);
				assert.isString(translatorNote.dateModified, 'dateModified is string' + suffix);
				
				if (legacy) {
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(sqlDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
					
					assert.isNumber(translatorNote.itemID, 'itemID is set' + suffix);
					assert.isString(translatorNote.key, 'key is set' + suffix);
				} else {
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateAdded), 'dateAdded is in correct format' + suffix);
					assert.isTrue(isoDateTimeRe.test(translatorNote.dateModified), 'dateModified is in correct format' + suffix);
				}
				
				// Tags
				assert.isArray(translatorNote.tags, 'contains tags as array' + suffix);
				assert.equal(translatorNote.tags.length, 2, 'contains correct number of tags' + suffix);
				let possibleTags = [
					{ tag: 'automaticTag', type: 0 },
					{ tag: 'manualTag', type: 1 }
				];
				for (let i=0; i<possibleTags.length; i++) {
					let match = false;
					for (let j=0; j<translatorNote.tags.length; j++) {
						if (possibleTags[i].tag == translatorNote.tags[j].tag) {
							let type = possibleTags[i].type;
							if (!legacy && type == 0) type = undefined;
							
							assert.equal(translatorNote.tags[j].type, type, possibleTags[i].tag + ' tag is correct' + suffix);
							match = true;
							break;
						}
					}
					assert.isTrue(match, 'has ' + possibleTags[i].tag + ' tag ' + suffix);
				}
				
				// Relations
				// assert.isObject(translatorNote.relations, 'has relations as object' + suffix);
				// assert.equal(translatorNote.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), 'relation is correct' + suffix);
				/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				
				if (!legacy) {
					// Collections
					assert.isUndefined(translatorNote.collections, 'has no collections array' + suffix);
				}
			}
		}));
		it('should return stored/linked file and URI attachments in expected format', Zotero.Promise.coroutine(function* () {
			this.timeout(60000);
			let file = getTestDataDirectory();
			let item, relatedItem;
			file.append("empty.pdf");
			
			yield Zotero.DB.executeTransaction(function* () {
				item = new Zotero.Item('journalArticle');
				yield item.save();
				relatedItem = new Zotero.Item('journalArticle');
				yield relatedItem.save();
			});

			// Attachment items
			let attachments = [
				yield Zotero.Attachments.importFromFile({"file":file}), // Standalone stored file
				yield Zotero.Attachments.linkFromFile({"file":file}), // Standalone link to file
				yield Zotero.Attachments.importFromFile({"file":file, "parentItemID":item.id}), // Attached stored file
				yield Zotero.Attachments.linkFromFile({"file":file, "parentItemID":item.id}), // Attached link to file
				yield Zotero.Attachments.linkFromURL({"url":'http://example.com', "parentItemID":item.id, "contentType":'application/pdf', "title":'empty.pdf'}) // Attached link to URL
			];
			
			yield Zotero.DB.executeTransaction(function* () {
				// Make sure all fields are populated
				for (let i=0; i<attachments.length; i++) {
					let attachment = attachments[i];
					attachment.setField('accessDate', '2001-02-03 12:13:14');
					attachment.attachmentCharset = Zotero.CharacterSets.getID('utf-8');
					attachment.setField('url', 'http://example.com');
					attachment.setNote('note');
				
					attachment.addTag('automaticTag', 0);
					attachment.addTag('manualTag', 1);
				
					// attachment.addRelatedItem(relatedItem.id);
				
					yield attachment.save();
				}
			});
			
			let items = [ attachments[0], attachments[1], item ]; // Standalone attachments and item with child attachments
			
			// Run tests
			let legacyMode = [false, true];
			for (let i=0; i<legacyMode.length; i++) {
				let getter = new Zotero.Translate.ItemGetter();
				getter._itemsLeft = items.slice();
				
				let exportDir = yield getTempDirectory();
				getter._exportFileDirectory = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
				getter._exportFileDirectory.initWithPath(exportDir);
				
				let legacy = getter.legacy = legacyMode[i];
				let suffix = legacy ? ' in legacy mode' : '';
				
				// Gather all standalone and child attachments into a single array,
				// since tests are mostly the same
				let translatorAttachments = [], translatorItem;
				let itemsLeft = items.length, attachmentsLeft = attachments.length;
				while (translatorItem = yield getter.nextItem()) {
					assert.isString(translatorItem.itemType, 'itemType is set' + suffix);
					
					// Standalone attachments
					if (translatorItem.itemType == 'attachment') {
						translatorAttachments.push({
							child: false,
							attachment: translatorItem
						});
						attachmentsLeft--;
					
					// Child attachments
					} else if (translatorItem.itemType == 'journalArticle') {
						assert.isArray(translatorItem.attachments, 'item contains attachment array' + suffix);
						assert.equal(translatorItem.attachments.length, 3, 'attachment array contains all items' + suffix);
						
						for (let i=0; i<translatorItem.attachments.length; i++) {
							let attachment = translatorItem.attachments[i];
							assert.equal(attachment.itemType, 'attachment', 'item attachment is of itemType "attachment"' + suffix);
							
							translatorAttachments.push({
								child: true,
								attachment: attachment
							});
							
							attachmentsLeft--;
						}
					
					// Unexpected
					} else {
						assert.fail(translatorItem.itemType, 'attachment or journalArticle', 'expected itemType returned');
					}
					
					itemsLeft--;
				}
				
				assert.equal(itemsLeft, 0, 'all items returned by getter');
				assert.equal(attachmentsLeft, 0, 'all attachments returned by getter');
				
				// Since we make no guarantees on the order of child attachments,
				// we have to rely on URI as the identifier
				let uriMap = {};
				for (let i=0; i<attachments.length; i++) {
					uriMap[Zotero.URI.getItemURI(attachments[i])] = attachments[i];
				}
				
				for (let j=0; j<translatorAttachments.length; j++) {
					let childAttachment = translatorAttachments[j].child;
					let attachment = translatorAttachments[j].attachment;
					assert.isString(attachment.uri, 'uri is set' + suffix);
					
					let zoteroItem = uriMap[attachment.uri];
					assert.isDefined(zoteroItem, 'uri is correct' + suffix);
					delete uriMap[attachment.uri];
					
					let storedFile = zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE
						|| zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL;
					let linkToURL = zoteroItem.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL;
					
					let prefix = (childAttachment ? 'attached ' : '')
						+ (storedFile ? 'stored ' : 'link to ')
						+ (linkToURL ? 'URL ' : 'file ');
					
					// Set fields
					assert.equal(attachment.itemType, 'attachment', prefix + 'itemType is correct' + suffix);
					assert.equal(attachment.title, 'empty.pdf', prefix + 'title is correct' + suffix);
					assert.equal(attachment.url, 'http://example.com', prefix + 'url is correct' + suffix);
					assert.equal(attachment.note, 'note', prefix + 'note is correct' + suffix);
					
					// Automatically set fields
					assert.isString(attachment.dateAdded, prefix + 'dateAdded is set' + suffix);
					assert.isString(attachment.dateModified, prefix + 'dateModified is set' + suffix);
					
					// Legacy mode fields
					if (legacy) {
						assert.isNumber(attachment.itemID, prefix + 'itemID is set' + suffix);
						assert.isString(attachment.key, prefix + 'key is set' + suffix);
						assert.equal(attachment.mimeType, 'application/pdf', prefix + 'mimeType is correct' + suffix);
						
						assert.equal(attachment.accessDate, '2001-02-03 12:13:14', prefix + 'accessDate is correct' + suffix);
						
						assert.isTrue(sqlDateTimeRe.test(attachment.dateAdded), prefix + 'dateAdded matches SQL format' + suffix);
						assert.isTrue(sqlDateTimeRe.test(attachment.dateModified), prefix + 'dateModified matches SQL format' + suffix);
					} else {
						assert.equal(attachment.contentType, 'application/pdf', prefix + 'contentType is correct' + suffix);
						
						assert.equal(attachment.accessDate, '2001-02-03T12:13:14Z', prefix + 'accessDate is correct' + suffix);
						
						assert.isTrue(isoDateTimeRe.test(attachment.dateAdded), prefix + 'dateAdded matches ISO-8601 format' + suffix);
						assert.isTrue(isoDateTimeRe.test(attachment.dateModified), prefix + 'dateModified matches ISO-8601 format' + suffix);
					}
					
					if (!linkToURL) {
						// localPath
						assert.isString(attachment.localPath, prefix + 'localPath is set' + suffix);
						let attachmentFile = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
						attachmentFile.initWithPath(attachment.localPath);
						assert.isTrue(attachmentFile.exists(), prefix + 'localPath points to a file' + suffix);
						assert.isTrue(attachmentFile.equals(attachments[j].getFile(null, true)), prefix + 'localPath points to the correct file' + suffix);
						
						assert.equal(attachment.filename, 'empty.pdf', prefix + 'filename is correct' + suffix);
						assert.equal(attachment.defaultPath, 'files/' + attachments[j].id + '/' + attachment.filename, prefix + 'defaultPath is correct' + suffix);
						
						// saveFile function
						assert.isFunction(attachment.saveFile, prefix + 'has saveFile function' + suffix);
						attachment.saveFile(attachment.defaultPath);
						assert.equal(attachment.path, OS.Path.join(exportDir, OS.Path.normalize(attachment.defaultPath)), prefix + 'path is set correctly after saveFile call' + suffix);
						
						let fileExists = yield OS.File.exists(attachment.path);
						assert.isTrue(fileExists, prefix + 'file was copied to the correct path by saveFile function' + suffix);
						fileExists = yield OS.File.exists(attachment.localPath);
						assert.isTrue(fileExists, prefix + 'file was not removed from original location' + suffix);
						
						assert.throws(attachment.saveFile.bind(attachment, attachment.defaultPath), /^ERROR_FILE_EXISTS /, prefix + 'saveFile does not overwrite existing file by default' + suffix);
						assert.throws(attachment.saveFile.bind(attachment, 'file/../../'), /./, prefix + 'saveFile does not allow exporting outside export directory' + suffix);
						/** TODO: check if overwriting existing file works **/
					}
					
					// Tags
					assert.isArray(attachment.tags, prefix + 'contains tags as array' + suffix);
					assert.equal(attachment.tags.length, 2, prefix + 'contains correct number of tags' + suffix);
					let possibleTags = [
						{ tag: 'automaticTag', type: 0 },
						{ tag: 'manualTag', type: 1 }
					];
					for (let i=0; i<possibleTags.length; i++) {
						let match = false;
						for (let j=0; j<attachment.tags.length; j++) {
							if (possibleTags[i].tag == attachment.tags[j].tag) {
								let type = possibleTags[i].type;
								if (!legacy && type == 0) type = undefined;
								
								assert.equal(attachment.tags[j].type, type, prefix + possibleTags[i].tag + ' tag is correct' + suffix);
								match = true;
								break;
							}
						}
						assert.isTrue(match, prefix + ' has ' + possibleTags[i].tag + ' tag ' + suffix);
					}
					
					// Relations
					// assert.isObject(attachment.relations, prefix + 'has relations as object' + suffix);
					// assert.equal(attachment.relations['dc:relation'], Zotero.URI.getItemURI(relatedItem), prefix + 'relation is correct' + suffix);
					/** TODO: test other relations and multiple relations per predicate (should be an array) **/
				}
			}
		}));
	});
});