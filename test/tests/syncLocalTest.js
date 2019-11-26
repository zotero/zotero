"use strict";

describe("Zotero.Sync.Data.Local", function() {
	describe("#getAPIKey()/#setAPIKey()", function () {
		it("should get and set an API key", function* () {
			var apiKey1 = Zotero.Utilities.randomString(24);
			var apiKey2 = Zotero.Utilities.randomString(24);
			Zotero.Sync.Data.Local.setAPIKey(apiKey1);
			yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(apiKey1), apiKey1);
			Zotero.Sync.Data.Local.setAPIKey(apiKey2);
			yield assert.eventually.equal(Zotero.Sync.Data.Local.getAPIKey(apiKey2), apiKey2);
		})
		
		
		it("should clear an API key by setting an empty string", function* () {
			var apiKey = Zotero.Utilities.randomString(24);
			Zotero.Sync.Data.Local.setAPIKey(apiKey);
			Zotero.Sync.Data.Local.setAPIKey("");
			yield assert.eventually.strictEqual(Zotero.Sync.Data.Local.getAPIKey(apiKey), "");
		})
	})
	
	
	describe("#checkUser()", function () {
		var resetDataDirFile;
		
		before(function() {
			resetDataDirFile = OS.Path.join(Zotero.DataDirectory.dir, 'reset-data-directory');
			sinon.stub(Zotero.Utilities.Internal, 'quitZotero');
		});	
		
		beforeEach(function* () {
			yield OS.File.remove(resetDataDirFile, {ignoreAbsent: true});
			Zotero.Utilities.Internal.quitZotero.reset();
		});
		
		after(function() {
			Zotero.Utilities.Internal.quitZotero.restore();
		});
	
		it("should prompt for data reset and create a temp 'reset-data-directory' file on accept", function* (){
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");
			
			var handled = false;
			waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				var matches = text.match(/‘[^’]*’/g);
				assert.equal(matches.length, 3);
				assert.equal(matches[0], "‘A’");
				assert.equal(matches[1], "‘B’");
				assert.equal(matches[2], "‘A’");
				
				dialog.document.getElementById('zotero-hardConfirmationDialog-checkbox').checked = true;
				dialog.document.getElementById('zotero-hardConfirmationDialog-checkbox')
					.dispatchEvent(new Event('command'));
				
				handled = true;
			}, 'accept', 'chrome://zotero/content/hardConfirmationDialog.xul');
			var cont = yield Zotero.Sync.Data.Local.checkUser(window, 2, "B");
			var resetDataDirFileExists = yield OS.File.exists(resetDataDirFile);
			assert.isTrue(handled);
			assert.isTrue(cont);
			assert.isTrue(resetDataDirFileExists);
		});
		
		it("should prompt for data reset and cancel", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");
			
			waitForDialog(false, 'cancel', 'chrome://zotero/content/hardConfirmationDialog.xul');
			var cont = yield Zotero.Sync.Data.Local.checkUser(window, 2, "B");
			var resetDataDirFileExists = yield OS.File.exists(resetDataDirFile);
			assert.isFalse(cont);
			assert.isFalse(resetDataDirFileExists);
			
			assert.equal(Zotero.Users.getCurrentUserID(), 1);
			assert.equal(Zotero.Users.getCurrentUsername(), "A");
		});
		
		// extra1 functionality not used at the moment
		it.skip("should prompt for data reset and allow to choose a new data directory", function* (){
			sinon.stub(Zotero.DataDirectory, 'forceChange').returns(Zotero.Promise.resolve(true));
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("A");
			
			waitForDialog(null, 'extra1', 'chrome://zotero/content/hardConfirmationDialog.xul');
			waitForDialog();
			var cont = yield Zotero.Sync.Data.Local.checkUser(window, 2, "B");
			var resetDataDirFileExists = yield OS.File.exists(resetDataDirFile);
			assert.isTrue(cont);
			assert.isTrue(Zotero.DataDirectory.forceChange.called);
			assert.isFalse(resetDataDirFileExists);
			
			Zotero.DataDirectory.forceChange.restore();
		});
		
		it("should migrate relations using local user key", function* () {
			yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='account'");
			yield Zotero.Users.init();
			
			var item1 = yield createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			yield item2.save();
			
			var pred = Zotero.Relations.relatedItemPredicate;
			assert.isTrue(
				item2.toJSON().relations[pred][0].startsWith('http://zotero.org/users/local/')
			);
			
			waitForDialog(false, 'accept', 'chrome://zotero/content/hardConfirmationDialog.xul');
			yield Zotero.Sync.Data.Local.checkUser(window, 1, "A");
			
			assert.isTrue(
				item2.toJSON().relations[pred][0].startsWith('http://zotero.org/users/1/items/')
			);
		});
	});
	
	
	describe("#checkLibraryForAccess()", function () {
		//
		// editable
		//
		it("should prompt if library is changing from editable to non-editable and reset library on accept", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			var promise = waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			});
			
			var mock = sinon.mock(Zotero.Sync.Data.Local);
			mock.expects("_libraryHasUnsyncedData").once().returns(Zotero.Promise.resolve(true));
			mock.expects("resetUnsyncedLibraryData").once().returns(Zotero.Promise.resolve());
			mock.expects("resetUnsyncedLibraryFiles").never();
			
			assert.isTrue(
				yield Zotero.Sync.Data.Local.checkLibraryForAccess(null, libraryID, false, false)
			);
			yield promise;
			
			mock.verify();
		});
		
		it("should prompt if library is changing from editable to non-editable but not reset library on cancel", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			var promise = waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			}, "cancel");
			
			var mock = sinon.mock(Zotero.Sync.Data.Local);
			mock.expects("_libraryHasUnsyncedData").once().returns(Zotero.Promise.resolve(true));
			mock.expects("resetUnsyncedLibraryData").never();
			mock.expects("resetUnsyncedLibraryFiles").never();
			
			assert.isFalse(
				yield Zotero.Sync.Data.Local.checkLibraryForAccess(null, libraryID, false, false)
			);
			yield promise;
			
			mock.verify();
		});
		
		it("should not prompt if library is changing from editable to non-editable", function* () {
			var group = yield createGroup({ editable: false, filesEditable: false });
			var libraryID = group.libraryID;
			yield Zotero.Sync.Data.Local.checkLibraryForAccess(null, libraryID, true, true);
		});
		
		//
		// filesEditable
		//
		it("should prompt if library is changing from filesEditable to non-filesEditable and reset library files on accept", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			var promise = waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			});
			
			var mock = sinon.mock(Zotero.Sync.Data.Local);
			mock.expects("_libraryHasUnsyncedFiles").once().returns(Zotero.Promise.resolve(true));
			mock.expects("resetUnsyncedLibraryData").never();
			mock.expects("resetUnsyncedLibraryFiles").once().returns(Zotero.Promise.resolve());
			
			assert.isTrue(
				yield Zotero.Sync.Data.Local.checkLibraryForAccess(null, libraryID, true, false)
			);
			yield promise;
			
			mock.verify();
		});
		
		it("should prompt if library is changing from filesEditable to non-filesEditable but not reset library files on cancel", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			var promise = waitForDialog(function (dialog) {
				var text = dialog.document.documentElement.textContent;
				assert.include(text, group.name);
			}, "cancel");
			
			var mock = sinon.mock(Zotero.Sync.Data.Local);
			mock.expects("_libraryHasUnsyncedFiles").once().returns(Zotero.Promise.resolve(true));
			mock.expects("resetUnsyncedLibraryData").never();
			mock.expects("resetUnsyncedLibraryFiles").never();
			
			assert.isFalse(
				yield Zotero.Sync.Data.Local.checkLibraryForAccess(null, libraryID, true, false)
			);
			yield promise;
			
			mock.verify();
		});
	});
	
	
	describe("#_libraryHasUnsyncedData()", function () {
		it("should return true for unsynced setting", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			yield Zotero.SyncedSettings.set(libraryID, "testSetting", { foo: "bar" });
			assert.isTrue(yield Zotero.Sync.Data.Local._libraryHasUnsyncedData(libraryID));
		});
		
		it("should return true for unsynced item", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			yield createDataObject('item', { libraryID });
			assert.isTrue(yield Zotero.Sync.Data.Local._libraryHasUnsyncedData(libraryID));
		});
		
		it("should return false if no changes", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			assert.isFalse(yield Zotero.Sync.Data.Local._libraryHasUnsyncedData(libraryID));
		});
	});
	
	
	describe("#resetUnsyncedLibraryData()", function () {
		it("should revert group and mark for full sync", function* () {
			var group = yield createGroup({
				version: 1,
				libraryVersion: 2
			});
			var libraryID = group.libraryID;
			
			// New setting
			yield Zotero.SyncedSettings.set(libraryID, "testSetting", { foo: "bar" });
			
			// Changed collection
			var changedCollection = yield createDataObject('collection', { libraryID, version: 1 });
			var originalCollectionName = changedCollection.name;
			yield Zotero.Sync.Data.Local.saveCacheObject(
				'collection', libraryID, changedCollection.toJSON()
			);
			yield modifyDataObject(changedCollection);
			
			// Unchanged item
			var unchangedItem = yield createDataObject('item', { libraryID, version: 1, synced: true });
			yield Zotero.Sync.Data.Local.saveCacheObject(
				'item', libraryID, unchangedItem.toJSON()
			);
			
			// Changed item
			var changedItem = yield createDataObject('item', { libraryID, version: 1 });
			var originalChangedItemTitle = changedItem.getField('title');
			yield Zotero.Sync.Data.Local.saveCacheObject('item', libraryID, changedItem.toJSON());
			yield modifyDataObject(changedItem);
			
			// New item
			var newItem = yield createDataObject('item', { libraryID, version: 1 });
			var newItemKey = newItem.key;
			
			// Delete item
			var deletedItem = yield createDataObject('item', { libraryID });
			var deletedItemKey = deletedItem.key;
			yield deletedItem.eraseTx();
			
			// Make group read-only
			group.editable = false;
			yield group.saveTx();
			
			yield Zotero.Sync.Data.Local.resetUnsyncedLibraryData(libraryID);
			
			assert.isNull(Zotero.SyncedSettings.get(group.libraryID, "testSetting"));
			
			assert.equal(changedCollection.name, originalCollectionName);
			assert.isTrue(changedCollection.synced);
			
			assert.isTrue(unchangedItem.synced);
			
			assert.equal(changedItem.getField('title'), originalChangedItemTitle);
			assert.isTrue(changedItem.synced);
			
			assert.isFalse(Zotero.Items.get(newItemKey));
			
			assert.isFalse(yield Zotero.Sync.Data.Local.getDateDeleted('item', libraryID, deletedItemKey));
			
			assert.equal(group.libraryVersion, -1);
		});
		
		
		describe("#resetUnsyncedLibraryFiles", function () {
			it("should delete unsynced files", function* () {
				var group = yield createGroup({
					version: 1,
					libraryVersion: 2
				});
				var libraryID = group.libraryID;
				
				// File attachment that's totally in sync -- leave alone
				var attachment1 = yield importFileAttachment('test.png', { libraryID });
				attachment1.attachmentSyncState = "in_sync";
				attachment1.attachmentSyncedModificationTime = yield attachment1.attachmentModificationTime;
				attachment1.attachmentSyncedHash = yield attachment1.attachmentHash;
				attachment1.synced = true;
				yield attachment1.saveTx({
					skipSyncedUpdate: true
				});
				
				// File attachment that's in sync with changed file -- delete file and mark for download
				var attachment2 = yield importFileAttachment('test.png', { libraryID });
				attachment2.synced = true;
				yield attachment2.saveTx({
					skipSyncedUpdate: true
				});
				
				// File attachment that's unsynced -- delete item and file
				var attachment3 = yield importFileAttachment('test.pdf', { libraryID });
				
				// Has to be called before resetUnsyncedLibraryFiles()
				assert.isTrue(yield Zotero.Sync.Data.Local._libraryHasUnsyncedFiles(libraryID));
				
				yield Zotero.Sync.Data.Local.resetUnsyncedLibraryFiles(libraryID);
				
				assert.isTrue(yield attachment1.fileExists());
				assert.isFalse(yield attachment2.fileExists());
				assert.isFalse(yield attachment3.fileExists());
				assert.equal(
					attachment1.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC
				);
				assert.equal(
					attachment2.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD
				);
				assert.isFalse(Zotero.Items.get(attachment3.id));
			});
		});
		
		it("should revert modified file attachment item", async function () {
			var group = await createGroup({
				version: 1,
				libraryVersion: 2
			});
			var libraryID = group.libraryID;
			
			// File attachment that's changed but file is in sync -- reset item, keep file
			var attachment = await importFileAttachment('test.png', { libraryID });
			var originalTitle = attachment.getField('title');
			attachment.attachmentSyncedModificationTime = await attachment.attachmentModificationTime;
			attachment.attachmentSyncedHash = await attachment.attachmentHash;
			attachment.attachmentSyncState = "in_sync";
			attachment.synced = true;
			attachment.version = 2;
			await attachment.saveTx({
				skipSyncedUpdate: true
			});
			// Save original in cache
			await Zotero.Sync.Data.Local.saveCacheObject(
				'item',
				libraryID,
				Object.assign(
					attachment.toJSON(),
					// TEMP: md5 and mtime aren't currently included in JSON, and without it the
					// file gets marked for download when the item gets reset from the cache
					{
						md5: attachment.attachmentHash,
						mtime: attachment.attachmentSyncedModificationTime
					}
				)
			);
			// Modify title
			attachment.setField('title', "New Title");
			await attachment.saveTx();
			
			await Zotero.Sync.Data.Local.resetUnsyncedLibraryFiles(libraryID);
			
			assert.isTrue(await attachment.fileExists());
			assert.equal(attachment.getField('title'), originalTitle);
			assert.equal(
				attachment.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC
			);
		});
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
	
	
	describe("#getUnsynced()", function () {
		it("should correct incorrectly nested collections", async function () {
			var c1 = await createDataObject('collection');
			var c2 = await createDataObject('collection');
			
			c1.parentID = c2.id;
			await c1.saveTx();
			
			await Zotero.DB.queryAsync(
				"UPDATE collections SET parentCollectionID=? WHERE collectionID=?",
				[
					c1.id,
					c2.id
				]
			);
			await c2.reload(['primaryData'], true);
			
			var ids = await Zotero.Sync.Data.Local.getUnsynced('collection', Zotero.Libraries.userLibraryID);
			
			// One of the items should still be the parent of the other, though which one is undefined
			assert.isTrue(
				(c1.parentID == c2.id && !c2.parentID) || (c2.parentID == c1.id && !c1.parentID)
			);
		});
	});
	
	
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
			yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [data]);
			
			// Change local title
			yield modifyDataObject(obj)
			var changedTitle = obj.getField('title');
			
			// Create remote version without title but with changed place
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
			// Item should be marked as unsynced so the local changes are uploaded
			assert.isFalse(obj.synced);
		});
		
		it("should keep local item changes while ignoring matching remote changes", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var type = 'item';
			let obj = await createDataObject(type, { version: 5 });
			let data = obj.toJSON();
			await Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [data]);
			
			// Change local title and place
			await modifyDataObject(obj)
			var changedTitle = obj.getField('title');
			var changedPlace = 'New York';
			obj.setField('place', changedPlace);
			await obj.saveTx();
			
			// Create remote version without title but with changed place
			data.key = obj.key;
			data.version = 10;
			data.place = changedPlace;
			let json = {
				key: obj.key,
				version: 10,
				data: data
			};
			await Zotero.Sync.Data.Local.processObjectsFromJSON(
				type, libraryID, [json], { stopOnError: true }
			);
			assert.equal(obj.version, 10);
			assert.equal(obj.getField('title'), changedTitle);
			assert.equal(obj.getField('place'), changedPlace);
			// Item should be marked as unsynced so the local changes are uploaded
			assert.isFalse(obj.synced);
		});
		
		it("should save item with overriding local conflict as unsynced", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var isbn = '978-0-335-22006-9';
			var type = 'item';
			let obj = createUnsavedDataObject(type, { version: 5 });
			obj.setField('ISBN', isbn);
			await obj.saveTx();
			let data = obj.toJSON();
			
			data.key = obj.key;
			data.version = 10;
			data.ISBN = '9780335220069';
			let json = {
				key: obj.key,
				version: 10,
				data
			};
			var results = await Zotero.Sync.Data.Local.processObjectsFromJSON(
				type, libraryID, [json], { stopOnError: true }
			);
			assert.isTrue(results[0].processed);
			assert.isUndefined(results[0].changes);
			assert.isUndefined(results[0].conflicts);
			assert.equal(obj.version, 10);
			assert.equal(obj.getField('ISBN'), isbn);
			assert.isFalse(obj.synced);
			// Sync cache should match remote
			var cacheJSON = await Zotero.Sync.Data.Local.getCacheObject(type, libraryID, data.key, data.version);
			assert.propertyVal(cacheJSON.data, "ISBN", data.ISBN);
		});
		
		it("should restore locally deleted collections and searches that changed remotely", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			for (let type of ['collection', 'search']) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = await createDataObject(type, { version: 1 });
				let data = obj.toJSON();
				
				await obj.eraseTx();
				
				data.key = obj.key;
				data.version = 2;
				let json = {
					key: obj.key,
					version: 2,
					data
				};
				let results = await Zotero.Sync.Data.Local.processObjectsFromJSON(
					type, libraryID, [json], { stopOnError: true }
				);
				assert.isTrue(results[0].processed);
				assert.notOk(results[0].conflict);
				assert.isTrue(results[0].restored);
				assert.isUndefined(results[0].changes);
				assert.isUndefined(results[0].conflicts);
				obj = objectsClass.getByLibraryAndKey(libraryID, data.key);
				assert.equal(obj.version, 2);
				assert.isTrue(obj.synced);
				assert.isFalse(await Zotero.Sync.Data.Local.getDateDeleted(type, libraryID, data.key));
			}
		});
		
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
		
		it("should mark new attachment items and library for download", function* () {
			var library = Zotero.Libraries.userLibrary;
			var libraryID = library.id;
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
			assert.isTrue(library.storageDownloadNeeded);
		})
		
		it("should mark updated attachment items for download", function* () {
			var library = Zotero.Libraries.userLibrary;
			var libraryID = library.id;
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
			assert.isTrue(library.storageDownloadNeeded);
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
			var libraryID = Zotero.Libraries.userLibraryID;
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
						itemType: "invalidType",
						title: "Test B"
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
			lib2 = (yield getGroup()).libraryID;
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
	
	
	describe("#showConflictResolutionWindow()", function () {
		it("should show title of note parent", function* () {
			var parentItem = yield createDataObject('item', { title: "Parent" });
			var note = new Zotero.Item('note');
			note.parentKey = parentItem.key;
			note.setNote("Test");
			yield note.saveTx();
			
			var promise = waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// Show title for middle and right panes
				var parentText = Zotero.getString('pane.item.parentItem') + " Parent";
				assert.equal(mergeGroup.leftpane._id('parent-row').textContent, "");
				assert.equal(mergeGroup.rightpane._id('parent-row').textContent, parentText);
				assert.equal(mergeGroup.mergepane._id('parent-row').textContent, parentText);
				
				wizard.getButton('finish').click();
			});
			
			Zotero.Sync.Data.Local.showConflictResolutionWindow([
				{
					libraryID: note.libraryID,
					key: note.key,
					processed: false,
					conflict: true,
					left: {
						deleted: true,
						dateDeleted: "2016-07-07 12:34:56"
					},
					right: note.toJSON()
				}
			]);
			
			yield promise;
		});
		
		it("should switch types by showing regular item after note", async function () {
			var note = await createDataObject('item', { itemType: 'note' });
			var item = await createDataObject('item');
			
			var promise = waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// 1 (accept remote deletion)
				assert.equal(mergeGroup.leftpane.getAttribute('selected'), 'true');
				mergeGroup.rightpane.click();
				wizard.getButton('next').click();
				
				// 2 (accept remote deletion)
				mergeGroup.rightpane.click();
				if (Zotero.isMac) {
					assert.isTrue(wizard.getButton('next').hidden);
					assert.isFalse(wizard.getButton('finish').hidden);
				}
				else {
					// TODO
				}
				wizard.getButton('finish').click();
			});
			
			var mergeData = Zotero.Sync.Data.Local.showConflictResolutionWindow([
				{
					libraryID: note.libraryID,
					key: note.key,
					processed: false,
					conflict: true,
					left: note.toJSON(),
					right: {
						deleted: true,
						dateDeleted: "2019-09-01 00:00:00"
					}
				},
				{
					libraryID: item.libraryID,
					key: item.key,
					processed: false,
					conflict: true,
					left: item.toJSON(),
					right: {
						deleted: true,
						dateDeleted: "2019-09-01 01:00:00"
					}
				}
			]);
			
			await promise;
			
			assert.isTrue(mergeData[0].data.deleted);
			assert.isTrue(mergeData[1].data.deleted);
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
					creators: [
						{
							firstName: "First1",
							lastName: "Last1",
							creatorType: "author"
						}
					],
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
					creators: [
						{
							firstName: "First1",
							lastName: "Last1",
							creatorType: "author"
						},
						// Same new creator on local and remote
						{
							firstName: "First2",
							lastName: "Last2",
							creatorType: "editor"
						}
					],
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
					creators: [
						{
							firstName: "First1",
							lastName: "Last1",
							creatorType: "author"
						},
						// Same new creator on local and remote
						{
							firstName: "First2",
							lastName: "Last2",
							creatorType: "editor"
						}
					],
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
			});
			
			it("should return conflict when creator changes can't be automatically resolved", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title",
					creators: [
						{
							firstName: "First1",
							lastName: "Last1",
							creatorType: "author"
						}
					],
					dateModified: "2015-05-14 12:34:56"
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title",
					creators: [
						{
							firstName: "First2",
							lastName: "Last2",
							creatorType: "author"
						}
					],
					dateModified: "2015-05-14 14:12:34"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					title: "Title",
					creators: [
						{
							firstName: "First3",
							lastName: "Last3",
							creatorType: "author"
						}
					],
					dateModified: "2015-05-14 13:45:12"
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				assert.lengthOf(result.changes, 0);
				assert.lengthOf(result.conflicts, 1);
				assert.propertyVal(result.conflicts[0][0], 'field', 'creators');
				assert.propertyVal(result.conflicts[0][0], 'op', 'modify');
				assert.lengthOf(result.conflicts[0][0].value, 1);
				assert.include(
					result.conflicts[0][0].value[0],
					{
						firstName: 'First2',
						lastName: 'Last2',
						creatorType: 'author'
					}
				);
				assert.propertyVal(result.conflicts[0][1], 'field', 'creators');
				assert.propertyVal(result.conflicts[0][1], 'op', 'modify');
				assert.lengthOf(result.conflicts[0][1].value, 1);
				assert.include(
					result.conflicts[0][1].value[0],
					{
						firstName: 'First3',
						lastName: 'Last3',
						creatorType: 'author'
					}
				);
			});
			
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
			
			it("should automatically use remote version for unresolvable conflicts when both sides are in trash", function () {
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
					deleted: true,
					dateModified: "2015-05-14 14:12:34"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					title: "Title 3",
					deleted: true,
					dateModified: "2015-05-14 13:45:12"
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				assert.lengthOf(result.changes, 1);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "title",
							op: "modify",
							value: "Title 3"
						},
					]
				);
			});
			
			it("should automatically apply inPublications setting from remote", function () {
				var cacheJSON = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title 1",
					dateModified: "2017-04-02 12:34:56"
				};
				var json1 = {
					key: "AAAAAAAA",
					version: 1234,
					title: "Title 1",
					dateModified: "2017-04-02 12:34:56"
				};
				var json2 = {
					key: "AAAAAAAA",
					version: 1235,
					title: "Title 1",
					inPublications: true,
					dateModified: "2017-04-03 12:34:56"
				};
				var ignoreFields = ['dateAdded', 'dateModified'];
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'item', cacheJSON, json1, json2, ignoreFields
				);
				assert.lengthOf(result.changes, 1);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "inPublications",
							op: "add",
							value: true
						}
					]
				);
			});
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
		});
		
		
		describe("tags", function () {
			// https://forums.zotero.org/discussion/79429/syncing-error-c1-is-undefined
			it("should handle multiple local type 1 and remote type 0", async function () {
				var cacheJSON = {
					tags: []
				};
				var json1 = {
					tags: [
						{
							tag: 'C',
							type: 1
						},
						{
							tag: 'D',
							type: 1
						}
					]
				};
				var json2 = {
					tags: [
						{
							tag: 'C'
						},
						{
							tag: 'D'
						}
					]
				};
				var result = Zotero.Sync.Data.Local._reconcileChanges(
					'tag', cacheJSON, json1, json2
				);
				assert.lengthOf(result.changes, 4);
				assert.sameDeepMembers(
					result.changes,
					[
						{
							field: "tags",
							op: "member-remove",
							value: {
								tag: "C",
								type: 1
							}
						},
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: "C"
							}
						},
						{
							field: "tags",
							op: "member-remove",
							value: {
								tag: "D",
								type: 1
							}
						},
						{
							field: "tags",
							op: "member-add",
							value: {
								tag: "D"
							}
						}
					]
				);
			});
		});
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
		
		it("should automatically use remote version for note markup differences when text content matches", function () {
			var val2 = "<p>Foo bar<br />bar   foo</p>";
			
			var json1 = {
				key: "AAAAAAAA",
				version: 0,
				itemType: "note",
				note: "Foo bar<br/>bar foo",
				dateModified: "2017-06-13 13:45:12"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 5,
				itemType: "note",
				note: val2,
				dateModified: "2017-06-13 13:45:12"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.lengthOf(result.changes, 1);
			assert.sameDeepMembers(
				result.changes,
				[
					{
						field: "note",
						op: "add",
						value: val2
					}
				]
			);
			assert.lengthOf(result.conflicts, 0);
		});
		
		it("should show conflict for note markup differences when text content doesn't match", function () {
			var json1 = {
				key: "AAAAAAAA",
				version: 0,
				itemType: "note",
				note: "Foo bar?",
				dateModified: "2017-06-13 13:45:12"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 5,
				itemType: "note",
				note: "<p>Foo bar!</p>",
				dateModified: "2017-06-13 13:45:12"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.lengthOf(result.changes, 0);
			assert.lengthOf(result.conflicts, 1);
		});
		
		it("should automatically use remote version for conflicting fields when both sides are in trash", function () {
			var json1 = {
				key: "AAAAAAAA",
				version: 1234,
				title: "Title 1",
				pages: 10,
				deleted: true,
				dateModified: "2015-05-14 14:12:34"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 1235,
				title: "Title 2",
				place: "New York",
				deleted: true,
				dateModified: "2015-05-14 13:45:12"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.lengthOf(result.changes, 3);
			assert.sameDeepMembers(
				result.changes,
				[
					{
						field: "title",
						op: "modify",
						value: "Title 2"
					},
					{
						field: "pages",
						op: "delete"
					},
					{
						field: "place",
						op: "add",
						value: "New York"
					}
				]
			);
		});
		
		it("should automatically use local hyphenated ISBN value if only difference", function () {
			var json1 = {
				key: "AAAAAAAA",
				version: 1234,
				itemType: "book",
				ISBN: "978-0-335-22006-9"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 1235,
				itemType: "book",
				ISBN: "9780335220069"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.lengthOf(result.changes, 0);
			assert.lengthOf(result.conflicts, 0);
			assert.isTrue(result.localChanged);
		});
		
		it("should automatically use remote hyphenated ISBN value if only difference", function () {
			var json1 = {
				key: "AAAAAAAA",
				version: 1234,
				itemType: "book",
				ISBN: "9780335220069"
			};
			var json2 = {
				key: "AAAAAAAA",
				version: 1235,
				itemType: "book",
				ISBN: "978-0-335-22006-9"
			};
			var ignoreFields = ['dateAdded', 'dateModified'];
			var result = Zotero.Sync.Data.Local._reconcileChangesWithoutCache(
				'item', json1, json2, ignoreFields
			);
			assert.sameDeepMembers(
				result.changes,
				[
					{
						field: "ISBN",
						op: "add",
						value: "978-0-335-22006-9"
					}
				]
			);
			assert.lengthOf(result.conflicts, 0);
			assert.isFalse(result.localChanged);
		});
	})
})
