"use strict";

describe("Zotero.Sync.Data.Local", function() {
	describe("#processSyncCacheForObjectType()", function () {
		var types = Zotero.DataObjectUtilities.getTypes();
		
		it("should update local version number if remote version is identical", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = yield createDataObject(type);
				let data = yield obj.toJSON();
				data.key = obj.key;
				data.version = 10;
				let json = {
					key: obj.key,
					version: 10,
					data: data
				};
				yield Zotero.Sync.Data.Local.saveCacheObjects(
					type, libraryID, [json]
				);
				yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
					libraryID, type, { stopOnError: true }
				);
				assert.equal(
					objectsClass.getByLibraryAndKey(libraryID, obj.key).version, 10
				);
			}
		})
	})
	
	describe("Conflict Resolution", function () {
		beforeEach(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM syncCache");
		})
		
		after(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM syncCache");
		})
		
		it("should show conflict resolution window on item conflicts", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			
			var objects = [];
			var values = [];
			var dateAdded = Date.now() - 86400000;
			for (let i = 0; i < 2; i++) {
				values.push({
					left: {},
					right: {}
				});
				
				// Create object in cache
				let obj = objects[i] = yield createDataObject(
					type,
					{
						version: 10,
						dateAdded: Zotero.Date.dateToSQL(new Date(dateAdded), true),
						// Set Date Modified values one minute apart to enforce order
						dateModified: Zotero.Date.dateToSQL(
							new Date(dateAdded + (i * 60000)), true
						)
					}
				);
				let jsonData = yield obj.toJSON();
				jsonData.key = obj.key;
				jsonData.version = 10;
				let json = {
					key: obj.key,
					version: jsonData.version,
					data: jsonData
				};
				yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				
				// Create new version in cache, simulating a download
				json.version = jsonData.version = 15;
				values[i].right.title = jsonData.title = Zotero.Utilities.randomString();
				yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				
				// Modify object locally
				yield modifyDataObject(obj, undefined, { skipDateModifiedUpdate: true });
				values[i].left.title = obj.getField('title');
			}
			
			waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// 1 (remote)
				// Remote version should be selected by default
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				wizard.getButton('next').click();
				
				// 2 (local)
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				// Select local object
				mergeGroup.leftpane.click();
				assert.equal(mergeGroup.leftpane.getAttribute('selected'), 'true');
				if (Zotero.isMac) {
					assert.isTrue(wizard.getButton('next').hidden);
					assert.isFalse(wizard.getButton('finish').hidden);
				}
				else {
					// TODO
				}
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
				libraryID, type, { stopOnError: true }
			);
			
			assert.equal(objects[0].getField('title'), values[0].right.title);
			assert.equal(objects[1].getField('title'), values[1].left.title);
		})
		
		it("should resolve all remaining conflicts with one side", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			
			var objects = [];
			var values = [];
			var dateAdded = Date.now() - 86400000;
			for (let i = 0; i < 3; i++) {
				values.push({
					left: {},
					right: {}
				});
				
				// Create object in cache
				let obj = objects[i] = yield createDataObject(
					type,
					{
						version: 10,
						dateAdded: Zotero.Date.dateToSQL(new Date(dateAdded), true),
						// Set Date Modified values one minute apart to enforce order
						dateModified: Zotero.Date.dateToSQL(
							new Date(dateAdded + (i * 60000)), true
						)
					}
				);
				let jsonData = yield obj.toJSON();
				jsonData.key = obj.key;
				jsonData.version = 10;
				let json = {
					key: obj.key,
					version: jsonData.version,
					data: jsonData
				};
				yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				
				// Create new version in cache, simulating a download
				json.version = jsonData.version = 15;
				values[i].right.title = jsonData.title = Zotero.Utilities.randomString();
				yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				
				// Modify object locally
				yield modifyDataObject(obj, undefined, { skipDateModifiedUpdate: true });
				values[i].left.title = obj.getField('title');
			}
			
			waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				var resolveAll = doc.getElementById('resolve-all');
				
				// 1 (remote)
				// Remote version should be selected by default
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				assert.equal(
					resolveAll.label,
					Zotero.getString('sync.conflict.resolveAllRemoteFields')
				);
				wizard.getButton('next').click();
				
				// 2 (local and Resolve All checkbox)
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				mergeGroup.leftpane.click();
				assert.equal(
					resolveAll.label,
					Zotero.getString('sync.conflict.resolveAllLocalFields')
				);
				resolveAll.click();
				
				if (Zotero.isMac) {
					assert.isTrue(wizard.getButton('next').hidden);
					assert.isFalse(wizard.getButton('finish').hidden);
				}
				else {
					// TODO
				}
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
				libraryID, type, { stopOnError: true }
			);
			
			assert.equal(objects[0].getField('title'), values[0].right.title);
			assert.equal(objects[1].getField('title'), values[1].left.title);
			assert.equal(objects[2].getField('title'), values[2].left.title);
		})
		
		it("should handle local item deletion, keeping deletion", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			
			// Create object, generate JSON, and delete
			var obj = yield createDataObject(type, { version: 10 });
			var jsonData = yield obj.toJSON();
			var key = jsonData.key = obj.key;
			jsonData.version = 10;
			let json = {
				key: obj.key,
				version: jsonData.version,
				data: jsonData
			};
			// Delete object locally
			yield obj.eraseTx();
			
			// Create new version in cache, simulating a download
			json.version = jsonData.version = 15;
			jsonData.title = Zotero.Utilities.randomString();
			yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
			
			waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// Remote version should be selected by default
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				assert.ok(mergeGroup.leftpane.pane.onclick);
				mergeGroup.leftpane.pane.click();
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
				libraryID, type, { stopOnError: true }
			);
			
			obj = objectsClass.getByLibraryAndKey(libraryID, key);
			assert.isFalse(obj);
		})
		
		it("should restore locally deleted item", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			
			// Create object, generate JSON, and delete
			var obj = yield createDataObject(type, { version: 10 });
			var jsonData = yield obj.toJSON();
			var key = jsonData.key = obj.key;
			jsonData.version = 10;
			let json = {
				key: obj.key,
				version: jsonData.version,
				data: jsonData
			};
			yield obj.eraseTx();
			
			// Create new version in cache, simulating a download
			json.version = jsonData.version = 15;
			jsonData.title = Zotero.Utilities.randomString();
			yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
			
			waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				assert.isTrue(doc.getElementById('resolve-all').hidden);
				
				// Remote version should be selected by default
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
				libraryID, type, { stopOnError: true }
			);
			
			obj = objectsClass.getByLibraryAndKey(libraryID, key);
			assert.ok(obj);
			yield obj.loadItemData();
			assert.equal(obj.getField('title'), jsonData.title);
		})
		
		it("should handle note conflict", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
			
			var noteText1 = "<p>A</p>";
			var noteText2 = "<p>B</p>";
			
			// Create object in cache
			var obj = new Zotero.Item('note');
			obj.setNote("");
			obj.version = 10;
			yield obj.saveTx();
			var jsonData = yield obj.toJSON();
			var key = jsonData.key = obj.key;
			let json = {
				key: obj.key,
				version: jsonData.version,
				data: jsonData
			};
			yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
			
			// Create new version in cache, simulating a download
			json.version = jsonData.version = 15;
			json.data.note = noteText2;
			yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
			
			// Delete object locally
			obj.setNote(noteText1);
			
			waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// Remote version should be selected by default
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Data.Local.processSyncCacheForObjectType(
				libraryID, type, { stopOnError: true }
			);
			
			obj = objectsClass.getByLibraryAndKey(libraryID, key);
			assert.ok(obj);
			yield obj.loadNote();
			assert.equal(obj.getNote(), noteText2);
		})
	})
	
	describe("#_reconcileChanges()", function () {
		describe("items", function () {
			it("should ignore non-conflicting local changes and return remote changes", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					itemType: "book",
					title: "Title 1",
					url: "http://zotero.org/",
					publicationTitle: "Publisher", // Remove locally
					extra: "Extra", // Removed on both
					dateModified: "2015-05-14 12:34:56",
					collections: [
						'AAAAAAAA', // Removed locally
						'DDDDDDDD', // Removed remotely,
						'EEEEEEEE' // Removed from both
					],
					relations: {
						a: 'A', // Unchanged string
						c: ['C1', 'C2'], // Unchanged array
						d: 'D', // String removed locally
						e: ['E'], // Array removed locally
						f: 'F1', // String changed locally
						g: [
							'G1', // Unchanged
							'G2', // Removed remotely
							'G3' // Removed from both
						],
						h: 'H', // String removed remotely
						i: ['I'], // Array removed remotely
					},
					tags: [
						{ tag: 'A' }, // Removed locally
						{ tag: 'D' }, // Removed remotely
						{ tag: 'E' } // Removed from both
					]
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					itemType: "book",
					title: "Title 2", // Changed locally
					url: "https://www.zotero.org/", // Same change on local and remote
					place: "Place", // Added locally
					dateModified: "2015-05-14 14:12:34", // Changed locally and remotely, but ignored
					collections: [
						'BBBBBBBB', // Added locally
						'DDDDDDDD',
						'FFFFFFFF' // Added on both
					],
					relations: {
						'a': 'A',
						'b': 'B', // String added locally
						'f': 'F2',
						'g': [
							'G1',
							'G2',
							'G6' // Added locally and remotely
						],
						h: 'H', // String removed remotely
						i: ['I'], // Array removed remotely
	
					},
					tags: [
						{ tag: 'B' },
						{ tag: 'D' },
						{ tag: 'F', type: 1 }, // Added on both
						{ tag: 'G' }, // Added on both, but with different types
						{ tag: 'H', type: 1 } // Added on both, but with different types
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					itemType: "book",
					title: "Title 1",
					url: "https://www.zotero.org/",
					publicationTitle: "Publisher",
					date: "2015-05-15", // Added remotely
					dateModified: "2015-05-14 13:45:12",
					collections: [
						'AAAAAAAA',
						'CCCCCCCC', // Added remotely
						'FFFFFFFF'
					],
					relations: {
						'a': 'A',
						'd': 'D',
						'e': ['E'],
						'f': 'F1',
						'g': [
							'G1',
							'G4', // Added remotely
							'G6'
						],
					},
					tags: [
						{ tag: 'A' },
						{ tag: 'C' },
						{ tag: 'F', type: 1 },
						{ tag: 'G', type: 1 },
						{ tag: 'H' }
					]
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "date",
							op: "add",
							value: "2015-05-15"
						},
						{
							field: "collections",
							op: "member-add",
							value: "CCCCCCCC"
						},
						{
							field: "collections",
							op: "member-remove",
							value: "DDDDDDDD"
						},
						// Relations
						{
							field: "relations",
							op: "property-member-remove",
							value: {
								key: 'g',
								value: 'G2'
							}
						},
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: 'g',
								value: 'G4'
							}
						},
						{
							field: "relations",
							op: "property-member-remove",
							value: {
								key: 'h',
								value: 'H'
							}
						},
						{
							field: "relations",
							op: "property-member-remove",
							value: {
								key: 'i',
								value: 'I'
							}
						},
						// Tags
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: 'C'
							}
						},
						{
							field: "tags",
							op: "member-remove",
							value: {
								tag: 'D'
							}
						},
						{
							field: "tags",
							op: "member-remove",
							value: {
								tag: 'H',
								type: 1
							}
						},
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: 'H'
							}
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should return empty arrays when no remote changes to apply", function () {
				// Similar to above but without differing remote changes
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					itemType: "book",
					title: "Title 1",
					url: "http://zotero.org/",
					publicationTitle: "Publisher", // Remove locally
					extra: "Extra", // Removed on both
					dateModified: "2015-05-14 12:34:56",
					collections: [
						'AAAAAAAA', // Removed locally
						'DDDDDDDD',
						'EEEEEEEE' // Removed from both
					],
					tags: [
						{
							tag: 'A' // Removed locally
						},
						{
							tag: 'D' // Removed remotely
						},
						{
							tag: 'E' // Removed from both
						}
					]
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					itemType: "book",
					title: "Title 2", // Changed locally
					url: "https://www.zotero.org/", // Same change on local and remote
					place: "Place", // Added locally
					dateModified: "2015-05-14 14:12:34", // Changed locally and remotely, but ignored
					collections: [
						'BBBBBBBB', // Added locally
						'DDDDDDDD',
						'FFFFFFFF' // Added on both
					],
					tags: [
						{
							tag: 'B'
						},
						{
							tag: 'D'
						},
						{
							tag: 'F', // Added on both
							type: 1
						},
						{
							tag: 'G' // Added on both, but with different types
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					itemType: "book",
					title: "Title 1",
					url: "https://www.zotero.org/",
					publicationTitle: "Publisher",
					dateModified: "2015-05-14 13:45:12",
					collections: [
						'AAAAAAAA',
						'DDDDDDDD',
						'FFFFFFFF'
					],
					tags: [
						{
							tag: 'A'
						},
						{
							tag: 'D'
						},
						{
							tag: 'F',
							type: 1
						},
						{
							tag: 'G',
							type: 1
						}
					]
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				assert.lengthOf(result.changes, 0);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should return conflict when changes can't be automatically resolved", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title 1",
					dateModified: "2015-05-14 12:34:56"
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title 2",
					dateModified: "2015-05-14 14:12:34"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					title: "Title 3",
					dateModified: "2015-05-14 13:45:12"
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				Zotero.debug('=-=-=-=');
				Zotero.debug(result);
				assert.lengthOf(result.changes, 0);
				assert.sameDeepMembers(
					result.conflicts,
					[
						[
							{
								field: "title",
								op: "modify",
								value: "Title 2"
							},
							{
								field: "title",
								op: "modify",
								value: "Title 3"
							}
						]
					]
				);
			})
			
			it("should automatically merge array/object members and generate conflicts for field changes in absence of cached version", function () {
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					itemType: "book",
					title: "Title",
					creators: [
						{
							name: "Center for History and New Media",
							creatorType: "author"
						}
					],
					place: "Place", // Local
					dateModified: "2015-05-14 14:12:34", // Changed on both, but ignored
					collections: [
						'AAAAAAAA' // Local
					],
					relations: {
						'a': 'A',
						'b': 'B', // Local
						'e': 'E1',
						'f': [
							'F1',
							'F2' // Local
						],
						h: 'H', // String removed remotely
						i: ['I'], // Array removed remotely
					},
					tags: [
						{ tag: 'A' }, // Local
						{ tag: 'C' },
						{ tag: 'F', type: 1 },
						{ tag: 'G' }, // Different types
						{ tag: 'H', type: 1 } // Different types
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					itemType: "book",
					title: "Title",
					creators: [
						{
							creatorType: "author", // Different property order shouldn't matter
							name: "Center for History and New Media"
						}
					],
					date: "2015-05-15", // Remote
					dateModified: "2015-05-14 13:45:12",
					collections: [
						'BBBBBBBB' // Remote
					],
					relations: {
						'a': 'A',
						'c': 'C', // Remote
						'd': ['D'], // Remote
						'e': 'E2',
						'f': [
							'F1',
							'F3' // Remote
						],
					},
					tags: [
						{ tag: 'B' }, // Remote
						{ tag: 'C' },
						{ tag: 'F', type: 1 },
						{ tag: 'G', type: 1 }, // Different types
						{ tag: 'H' } // Different types
					]
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', false, json1, json2, ignoreFields
				);
				Zotero.debug(result);
				assert.sameDeepMembers(
					result.changes,
					[
						// Collections
						{
							field: "collections",
							op: "member-add",
							value: "BBBBBBBB"
						},
						// Relations
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: 'c',
								value: 'C'
							}
						},
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: 'd',
								value: 'D'
							}
						},
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: 'e',
								value: 'E2'
							}
						},
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: 'f',
								value: 'F3'
							}
						},
						// Tags
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: 'B'
							}
						},
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: 'G',
								type: 1
							}
						},
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: 'H'
							}
						}
					]
				);
				assert.sameDeepMembers(
					result.conflicts,
					[
						{
							field: "place",
							op: "delete"
						},
						{
							field: "date",
							op: "add",
							value: "2015-05-15"
						}
					]
				);
			})
		})
		
		
		describe("collections", function () {
			it("should ignore non-conflicting local changes and return remote changes", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					parentCollection: null,
					relations: {
						A: "A", // Removed locally
						C: "C" // Removed on both
					}
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2", // Changed locally
					parentCollection: null,
					relations: {}
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					parentCollection: "BBBBBBBB", // Added remotely
					relations: {
						A: "A",
						B: "B" // Added remotely
					}
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'collection', cacheJSON, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "parentCollection",
							op: "add",
							value: "BBBBBBBB"
						},
						{
							field: "relations",
							op: "property-member-add",
							value: {
								key: "B",
								value: "B"
							}
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should return empty arrays when no remote changes to apply", function () {
				// Similar to above but without differing remote changes
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2", // Changed locally
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						// Added locally
						{
							condition: "place",
							operator: "is",
							value: "New York"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', cacheJSON, json1, json2
				);
				assert.lengthOf(result.changes, 0);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should automatically resolve conflicts with remote version", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1"
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 3"
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', cacheJSON, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "name",
							op: "modify",
							value: "Name 3"
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should automatically resolve conflicts in absence of cached version", function () {
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "New York"
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', false, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "name",
							op: "modify",
							value: "Name 2"
						},
						{
							field: "conditions",
							op: "member-add",
							value: {
								condition: "place",
								operator: "is",
								value: "Chicago"
							}
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
		})
		
		
		describe("searches", function () {
			it("should ignore non-conflicting local changes and return remote changes", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2", // Changed locally
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						// Removed remotely
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						// Added remotely
						{
							condition: "place",
							operator: "is",
							value: "New York"
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', cacheJSON, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "conditions",
							op: "member-add",
							value: {
								condition: "place",
								operator: "is",
								value: "New York"
							}
						},
						{
							field: "conditions",
							op: "member-remove",
							value: {
								condition: "place",
								operator: "is",
								value: "Chicago"
							}
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should return empty arrays when no remote changes to apply", function () {
				// Similar to above but without differing remote changes
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2", // Changed locally
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						// Added locally
						{
							condition: "place",
							operator: "is",
							value: "New York"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', cacheJSON, json1, json2
				);
				assert.lengthOf(result.changes, 0);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should automatically resolve conflicts with remote version", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1"
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 3"
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', cacheJSON, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "name",
							op: "modify",
							value: "Name 3"
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
			
			it("should automatically resolve conflicts in absence of cached version", function () {
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 1",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "New York"
						}
					]
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1234,
					name: "Name 2",
					conditions: [
						{
							condition: "title",
							operator: "contains",
							value: "A"
						},
						{
							condition: "place",
							operator: "is",
							value: "Chicago"
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'search', false, json1, json2
				);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "name",
							op: "modify",
							value: "Name 2"
						},
						{
							field: "conditions",
							op: "member-add",
							value: {
								condition: "place",
								operator: "is",
								value: "Chicago"
							}
						}
					]
				);
				assert.lengthOf(result.conflicts, 0);
			})
		})
	})
})
