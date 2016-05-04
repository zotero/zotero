"use strict";

describe("Zotero.Sync.Data.Local", function() {
	describe("#getAPIKey()/#setAPIKey()", function () {
		it("should get and set an API key", function* () {
			var apiKey1 = Zotero.Utilities.randomString(24);
			var apiKey2 = Zotero.Utilities.randomString(24);
			Zotero.Sync.Data.Local.setAPIKey(apiKey1);
			assert.equal(Zotero.Sync.Data.Local.getAPIKey(apiKey1), apiKey1);
			Zotero.Sync.Data.Local.setAPIKey(apiKey2);
			assert.equal(Zotero.Sync.Data.Local.getAPIKey(apiKey2), apiKey2);
		})
		
		
		it("should clear an API key by setting an empty string", function* () {
			var apiKey = Zotero.Utilities.randomString(24);
			Zotero.Sync.Data.Local.setAPIKey(apiKey);
			Zotero.Sync.Data.Local.setAPIKey("");
			assert.strictEqual(Zotero.Sync.Data.Local.getAPIKey(apiKey), "");
		})
	})
	
	
	describe("#checkUser()", function () {
		var win;
		
		beforeEach(function* () {
			win = yield loadBrowserWindow();
		});
		
		afterEach(function () {
			win.close();
		});
		
		it("should prompt for user update and perform on accept", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");
			
			var handled = false;
			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				var matches = text.match(/‘[^’]*’/g);
				assert.equal(matches.length, 4);
				assert.equal(matches[0], "‘A’");
				assert.equal(matches[1], "‘B’");
				assert.equal(matches[2], "‘B’");
				assert.equal(matches[3], "‘A’");
				handled = true;
			});
			var cont = yield Zotero.Sync.Data.Local.checkUser(win, 2, "B");
			assert.isTrue(handled);
			assert.isTrue(cont);
			
			assert.equal(Zotero.Users.getCurrentUserID(), 2);
			assert.equal(Zotero.Users.getCurrentUsername(), "B");
		})
		
		it("should prompt for user update and cancel", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");
			
			waitForDialog(false, 'cancel');
			var cont = yield Zotero.Sync.Data.Local.checkUser(win, 2, "B");
			assert.isFalse(cont);
			
			assert.equal(Zotero.Users.getCurrentUserID(), 1);
			assert.equal(Zotero.Users.getCurrentUsername(), "A");
		})
		
		it("should update local relations when syncing for the first time", function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
			
			var item1 = yield createDataObject('item');
			var item2 = yield createDataObject(
				'item', { libraryID: Zotero.Libraries.publicationsLibraryID }
			);
			
			yield item1.addLinkedItem(item2);
			
			var cont = yield Zotero.Sync.Data.Local.checkUser(win, 1, "A");
			assert.isTrue(cont);
			
			var json = item1.toJSON();
			var uri = json.relations[Zotero.Relations.linkedObjectPredicate][0];
			assert.notInclude(uri, 'users/local');
			assert.include(uri, 'users/1/publications');
		})
	});
	
	
	describe("#getLatestCacheObjectVersions", function () {
		before(function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
			
			yield Zotero.Sync.Data.Local.saveCacheObjects(
				'item',
				Zotero.Libraries.userLibraryID,
				[
					{
						key: 'AAAAAAAA',
						version: 2,
						title: "A2"
					},
					{
						key: 'AAAAAAAA',
						version: 1,
						title: "A1"
					},
					{
						key: 'BBBBBBBB',
						version: 1,
						title: "B1"
					},
					{
						key: 'BBBBBBBB',
						version: 2,
						title: "B2"
					},
					{
						key: 'CCCCCCCC',
						version: 3,
						title: "C"
					}
				]
			);
		})
		
		it("should return latest version of all objects if no keys passed", function* () {
			var versions = yield Zotero.Sync.Data.Local.getLatestCacheObjectVersions(
				'item',
				Zotero.Libraries.userLibraryID
			);
			var keys = Object.keys(versions);
			assert.lengthOf(keys, 3);
			assert.sameMembers(keys, ['AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC']);
			assert.equal(versions.AAAAAAAA, 2);
			assert.equal(versions.BBBBBBBB, 2);
			assert.equal(versions.CCCCCCCC, 3);
		})
		
		it("should return latest version of objects with passed keys", function* () {
			var versions = yield Zotero.Sync.Data.Local.getLatestCacheObjectVersions(
				'item',
				Zotero.Libraries.userLibraryID,
				['AAAAAAAA', 'CCCCCCCC']
			);
			var keys = Object.keys(versions);
			assert.lengthOf(keys, 2);
			assert.sameMembers(keys, ['AAAAAAAA', 'CCCCCCCC']);
			assert.equal(versions.AAAAAAAA, 2);
			assert.equal(versions.CCCCCCCC, 3);
		})
	})
	
	
	describe("#processObjectsFromJSON()", function () {
		var types = Zotero.DataObjectUtilities.getTypes();
		
		beforeEach(function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
		})
		
		it("should update local version number and mark as synced if remote version is identical", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = yield createDataObject(type);
				let data = obj.toJSON();
				data.key = obj.key;
				data.version = 10;
				let json = {
					key: obj.key,
					version: 10,
					data: data
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON(
					type, libraryID, [json], { stopOnError: true }
				);
				let localObj = objectsClass.getByLibraryAndKey(libraryID, obj.key);
				assert.equal(localObj.version, 10);
				assert.isTrue(localObj.synced);
			}
		})
		
		it("should keep local item changes while applying non-conflicting remote changes", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			let obj = yield createDataObject(type, { version: 5 });
			let data = obj.toJSON();
			yield Zotero.Sync.Data.Local.saveCacheObjects(
				type, libraryID, [data]
			);
			
			// Change local title
			yield modifyDataObject(obj)
			var changedTitle = obj.getField('title');
			
			// Save remote version to cache without title but with changed place
			data.key = obj.key;
			data.version = 10;
			var changedPlace = data.place = 'New York';
			let json = {
				key: obj.key,
				version: 10,
				data: data
			};
			yield Zotero.Sync.Data.Local.processObjectsFromJSON(
				type, libraryID, [json], { stopOnError: true }
			);
			assert.equal(obj.version, 10);
			assert.equal(obj.getField('title'), changedTitle);
			assert.equal(obj.getField('place'), changedPlace);
		})
		
		it("should delete older versions in sync cache after processing", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				
				// Save original version
				let obj = yield createDataObject(type, { version: 5 });
				let data = obj.toJSON();
				yield Zotero.Sync.Data.Local.saveCacheObjects(
					type, libraryID, [data]
				);
				
				// Save newer version
				data.version = 10;
				yield Zotero.Sync.Data.Local.processObjectsFromJSON(
					type, libraryID, [data], { stopOnError: true }
				);
				
				let localObj = objectsClass.getByLibraryAndKey(libraryID, obj.key);
				assert.equal(localObj.version, 10);
				
				let versions = yield Zotero.Sync.Data.Local.getCacheObjectVersions(
					type, libraryID, obj.key
				);
				assert.sameMembers(
					versions,
					[10],
					"should have only latest version of " + type + " in cache"
				);
			}
		});
		
		it("should delete object from sync queue after processing", function* () {
			var objectType = 'item';
			var libraryID = Zotero.Libraries.userLibraryID;
			var key = Zotero.DataObjectUtilities.generateKey();
			
			yield Zotero.Sync.Data.Local.addObjectsToSyncQueue(objectType, libraryID, [key]);
			
			var versions = yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue(objectType, libraryID);
			assert.include(versions, key);
			
			var json = {
				key,
				version: 10,
				data: {
					key,
					version: 10,
					itemType: "book",
					title: "Test"
				}
			};
			
			yield Zotero.Sync.Data.Local.processObjectsFromJSON(
				objectType, libraryID, [json], { stopOnError: true }
			);
			
			var versions = yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue(objectType, libraryID);
			assert.notInclude(versions, key);
		});
		
		it("should mark new attachment items for download", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			Zotero.Sync.Storage.Local.setModeForLibrary(libraryID, 'zfs');
			
			var key = Zotero.DataObjectUtilities.generateKey();
			var version = 10;
			var json = {
				key,
				version,
				data: {
					key,
					version,
					itemType: 'attachment',
					linkMode: 'imported_file',
					md5: '57f8a4fda823187b91e1191487b87fe6',
					mtime: 1442261130615
				}
			};
			
			yield Zotero.Sync.Data.Local.processObjectsFromJSON(
				'item', libraryID, [json], { stopOnError: true }
			);
			var item = Zotero.Items.getByLibraryAndKey(libraryID, key);
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD);
		})
		
		it("should mark updated attachment items for download", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			Zotero.Sync.Storage.Local.setModeForLibrary(libraryID, 'zfs');
			
			var item = yield importFileAttachment('test.png');
			item.version = 5;
			item.synced = true;
			yield item.saveTx();
			
			// Set file as synced
			item.attachmentSyncedModificationTime = yield item.attachmentModificationTime;
			item.attachmentSyncedHash = yield item.attachmentHash;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			
			// Simulate download of version with updated attachment
			var json = item.toResponseJSON();
			json.version = 10;
			json.data.version = 10;
			json.data.md5 = '57f8a4fda823187b91e1191487b87fe6';
			json.data.mtime = new Date().getTime() + 10000;
			yield Zotero.Sync.Data.Local.processObjectsFromJSON(
				'item', libraryID, [json], { stopOnError: true }
			);
			
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD);
		})
		
		it("should ignore attachment metadata when resolving metadata conflict", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			Zotero.Sync.Storage.Local.setModeForLibrary(libraryID, 'zfs');
			
			var item = yield importFileAttachment('test.png');
			item.version = 5;
			yield item.saveTx();
			var json = item.toResponseJSON();
			yield Zotero.Sync.Data.Local.saveCacheObjects('item', libraryID, [json]);
			
			// Set file as synced
			item.attachmentSyncedModificationTime = yield item.attachmentModificationTime;
			item.attachmentSyncedHash = yield item.attachmentHash;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			
			// Modify title locally, leaving item unsynced
			var newTitle = Zotero.Utilities.randomString();
			item.setField('title', newTitle);
			yield item.saveTx();
			
			// Simulate download of version with original title but updated attachment
			json.version = 10;
			json.data.version = 10;
			json.data.md5 = '57f8a4fda823187b91e1191487b87fe6';
			json.data.mtime = new Date().getTime() + 10000;
			yield Zotero.Sync.Data.Local.processObjectsFromJSON(
				'item', libraryID, [json], { stopOnError: true }
			);
			
			assert.equal(item.getField('title'), newTitle);
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD);
		})
		
		it("should roll back partial object changes on error", function* () {
			var libraryID = Zotero.Libraries.publicationsLibraryID;
			var key1 = "AAAAAAAA";
			var key2 = "BBBBBBBB";
			var json = [
				{
					key: key1,
					version: 1,
					data: {
						key: key1,
						version: 1,
						itemType: "book",
						title: "Test A"
					}
				},
				{
					key: key2,
					version: 1,
					data: {
						key: key2,
						version: 1,
						itemType: "journalArticle",
						title: "Test B",
						deleted: true // Not allowed in My Publications
					}
				}
			];
			yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, json);
			
			// Shouldn't roll back the successful item
			yield assert.eventually.equal(Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM items WHERE libraryID=? AND key=?", [libraryID, key1]
			), 1);
			// Should rollback the unsuccessful item
			yield assert.eventually.equal(Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM items WHERE libraryID=? AND key=?", [libraryID, key2]
			), 0);
		});
	})
	
	describe("Sync Queue", function () {
		var lib1, lib2;
		
		before(function* () {
			lib1 = Zotero.Libraries.userLibraryID;
			lib2 = Zotero.Libraries.publicationsLibraryID;
		});
		
		beforeEach(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM syncQueue");
		});
		
		after(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM syncQueue");
		});
		
		describe("#addObjectsToSyncQueue()", function () {
			it("should add new objects and update lastCheck and tries for existing objects", function* () {
				var objectType = 'item';
				var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
				var now = Zotero.Date.getUnixTimestamp();
				var key1 = Zotero.DataObjectUtilities.generateKey();
				var key2 = Zotero.DataObjectUtilities.generateKey();
				var key3 = Zotero.DataObjectUtilities.generateKey();
				var key4 = Zotero.DataObjectUtilities.generateKey();
				yield Zotero.DB.queryAsync(
					"INSERT INTO syncQueue (libraryID, key, syncObjectTypeID, lastCheck, tries) "
						+ "VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
					[
						lib1, key1, syncObjectTypeID, now - 3700, 0,
						lib1, key2, syncObjectTypeID, now - 7000, 1,
						lib2, key3, syncObjectTypeID, now - 86400, 2
					]
				);
				
				yield Zotero.Sync.Data.Local.addObjectsToSyncQueue(objectType, lib1, [key1, key2]);
				yield Zotero.Sync.Data.Local.addObjectsToSyncQueue(objectType, lib2, [key4]);
				
				var sql = "SELECT lastCheck, tries FROM syncQueue WHERE libraryID=? "
					+ `AND syncObjectTypeID=${syncObjectTypeID} AND key=?`;
				var row;
				// key1
				row = yield Zotero.DB.rowQueryAsync(sql, [lib1, key1]);
				assert.approximately(row.lastCheck, now, 1);
				assert.equal(row.tries, 1);
				// key2
				row = yield Zotero.DB.rowQueryAsync(sql, [lib1, key2]);
				assert.approximately(row.lastCheck, now, 1);
				assert.equal(row.tries, 2);
				// key3
				row = yield Zotero.DB.rowQueryAsync(sql, [lib2, key3]);
				assert.equal(row.lastCheck, now - 86400);
				assert.equal(row.tries, 2);
				// key4
				row = yield Zotero.DB.rowQueryAsync(sql, [lib2, key4]);
				assert.approximately(row.lastCheck, now, 1);
				assert.equal(row.tries, 0);
			});
		});
		
		describe("#getObjectsToTryFromSyncQueue()", function () {
			it("should get objects that should be retried", function* () {
				var objectType = 'item';
				var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
				var now = Zotero.Date.getUnixTimestamp();
				var key1 = Zotero.DataObjectUtilities.generateKey();
				var key2 = Zotero.DataObjectUtilities.generateKey();
				var key3 = Zotero.DataObjectUtilities.generateKey();
				var key4 = Zotero.DataObjectUtilities.generateKey();
				yield Zotero.DB.queryAsync(
					"INSERT INTO syncQueue (libraryID, key, syncObjectTypeID, lastCheck, tries) "
						+ "VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
					[
						lib1, key1, syncObjectTypeID, now - (30 * 60) - 10, 0, // more than half an hour, so should be retried
						lib1, key2, syncObjectTypeID, now - (16 * 60 * 60) + 10, 4, // less than 16 hours, shouldn't be retried
						lib2, key3, syncObjectTypeID, now - 86400 * 7, 20 // more than 64 hours, so should be retried
					]
				);
				
				var keys = yield Zotero.Sync.Data.Local.getObjectsToTryFromSyncQueue('item', lib1);
				assert.sameMembers(keys, [key1]);
				var keys = yield Zotero.Sync.Data.Local.getObjectsToTryFromSyncQueue('item', lib2);
				assert.sameMembers(keys, [key3]);
			});
		});
		
		describe("#removeObjectsFromSyncQueue()", function () {
			it("should remove objects from the sync queue", function* () {
				var objectType = 'item';
				var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
				var now = Zotero.Date.getUnixTimestamp();
				var key1 = Zotero.DataObjectUtilities.generateKey();
				var key2 = Zotero.DataObjectUtilities.generateKey();
				var key3 = Zotero.DataObjectUtilities.generateKey();
				yield Zotero.DB.queryAsync(
					"INSERT INTO syncQueue (libraryID, key, syncObjectTypeID, lastCheck, tries) "
						+ "VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
					[
						lib1, key1, syncObjectTypeID, now, 0,
						lib1, key2, syncObjectTypeID, now, 4,
						lib2, key3, syncObjectTypeID, now, 20
					]
				);
				
				yield Zotero.Sync.Data.Local.removeObjectsFromSyncQueue('item', lib1, [key1]);
				
				var sql = "SELECT COUNT(*) FROM syncQueue WHERE libraryID=? "
					+ `AND syncObjectTypeID=${syncObjectTypeID} AND key=?`;
				assert.notOk(yield Zotero.DB.valueQueryAsync(sql, [lib1, key1]));
				assert.ok(yield Zotero.DB.valueQueryAsync(sql, [lib1, key2]));
				assert.ok(yield Zotero.DB.valueQueryAsync(sql, [lib2, key3]));
			})
		});
		
		describe("#resetSyncQueueTries", function () {
			var spy;
			
			after(function () {
				if (spy) {
					spy.restore();
				}
			})
			
			it("should be run on version upgrade", function* () {
				var sql = "REPLACE INTO settings (setting, key, value) VALUES ('client', 'lastVersion', ?)";
				yield Zotero.DB.queryAsync(sql, "5.0foo");
				
				spy = sinon.spy(Zotero.Sync.Data.Local, "resetSyncQueueTries");
				yield Zotero.Schema.updateSchema();
				assert.ok(spy.called);
			});
		});
	});
	
	
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
						[
							{
								field: "place",
								op: "add",
								value: "Place"
							},
							{
								field: "place",
								op: "delete"
							}
						],
						[
							{
								field: "date",
								op: "delete"
							},
							{
								field: "date",
								op: "add",
								value: "2015-05-15"
							}
						]
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
	
	
	describe("#reconcileChangesWithoutCache()", function () {
		it("should return conflict for conflicting fields", function () {
			var json1 = {
				key: "AAAAAAAA",
				version: 1234,
				title: "Title 1",
				pages: 10,
				dateModified: "2015-05-14 14:12:34"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 1235,
				title: "Title 2",
				place: "New York",
				dateModified: "2015-05-14 13:45:12"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.lengthOf(result.changes, 0);
			assert.sameDeepMembers(
				result.conflicts,
				[
					[
						{
							field: "title",
							op: "add",
							value: "Title 1"
						},
						{
							field: "title",
							op: "add",
							value: "Title 2"
						}
					],
					[
						{
							field: "pages",
							op: "add",
							value: 10
						},
						{
							field: "pages",
							op: "delete"
						}
					],
					[
						{
							field: "place",
							op: "delete"
						},
						{
							field: "place",
							op: "add",
							value: "New York"
						}
					]
				]
			);
		})
	})
})
