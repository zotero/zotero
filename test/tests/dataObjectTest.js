"use strict";

describe("Zotero.DataObject", function() {
	var types = ['collection', 'item', 'search'];
	
	describe("#key", function () {
		it("shouldn't update .loaded on get if unset", function* () {
			for (let type of types) {
				if (type == 'item') {
					var param = 'book';
				}
				let obj = new Zotero[Zotero.Utilities.capitalize(type)](param);
				obj.libraryID = Zotero.Libraries.userLibraryID;
				assert.isNull(obj.key);
				assert.isFalse(obj._loaded.primaryData);
				obj.key = Zotero.DataObjectUtilities.generateKey();
			}
		})
	})
	
	describe("#version", function () {
		it("should be set to 0 after creating object", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type);
				assert.equal(obj.version, 0);
				yield obj.eraseTx();
			}
		})
		
		it("should be set after creating object", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type, { version: 1234 });
				assert.equal(obj.version, 1234, type + " version mismatch");
				yield obj.eraseTx();
			}
		})
	})
	
	describe("#synced", function () {
		it("should be set to false after creating object", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = yield obj.saveTx();
				assert.isFalse(obj.synced);
				yield obj.eraseTx();
			}
		});
		
		it("should be set to false after modifying object", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = yield obj.saveTx();
				
				obj.synced = true;
				yield obj.saveTx();
				
				if (type == 'item') {
					yield obj.loadItemData();
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				yield obj.saveTx();
				assert.isFalse(obj.synced);
				
				yield obj.eraseTx();
			}
		});
		
		it("should be changed to true explicitly with no other changes", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = yield obj.saveTx();
				
				obj.synced = true;
				yield obj.saveTx();
				assert.isTrue(obj.synced);
				
				yield obj.eraseTx();
			}
		});
		
		it("should be changed to true explicitly with other field changes", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = yield obj.saveTx();
				
				if (type == 'item') {
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				obj.synced = true;
				yield obj.saveTx();
				assert.isTrue(obj.synced);
				
				yield obj.eraseTx();
			}
		});
		
		it("should remain at true if set explicitly", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				obj.synced = true;
				var id = yield obj.saveTx();
				assert.isTrue(obj.synced);
				
				if (type == 'item') {
					obj.setField('title', 'test');
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				obj.synced = true;
				yield obj.saveTx();
				assert.isTrue(obj.synced);
				
				yield obj.eraseTx();
			}
		});
		
		it("should be unchanged if skipSyncedUpdate passed", function* () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = yield obj.saveTx();
				
				obj.synced = 1;
				yield obj.saveTx();
				
				if (type == 'item') {
					yield obj.loadItemData();
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				yield obj.saveTx({
					skipSyncedUpdate: true
				});
				assert.ok(obj.synced);
				
				yield obj.eraseTx();
			}
		});
	})
	
	describe("#loadPrimaryData()", function () {
		it("should load unloaded primary data if partially set", function* () {
			var objs = {};
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				yield obj.save({
					skipCache: true
				});
				objs[type] = {
					key: obj.key,
					version: obj.version
				};
			}
			
			for (let type of types) {
				let obj = new Zotero[Zotero.Utilities.capitalize(type)];
				obj.libraryID = Zotero.Libraries.userLibraryID;
				obj.key = objs[type].key;
				yield obj.loadPrimaryData();
				assert.equal(obj.version, objs[type].version);
			}
		})
	})
	
	describe("#loadAllData()", function () {
		it("should load data on a regular item", function* () {
			var item = new Zotero.Item('book');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.throws(item.getNote.bind(item), 'getNote() can only be called on notes and attachments');
		})
		
		it("should load data on an attachment item", function* () {
			var item = new Zotero.Item('attachment');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.equal(item.getNote(), '');
		})
		
		it("should load data on a note item", function* () {
			var item = new Zotero.Item('note');
			var id = yield item.saveTx();
			yield item.loadAllData();
			assert.equal(item.getNote(), '');
		})
	})
	
	
	describe("#hasChanged()", function () {
		it("should return false if 'synced' was set but unchanged and nothing else changed", function* () {
			for (let type of types) {
				// True
				var obj = createUnsavedDataObject(type);
				obj.synced = true;
				var id = yield obj.saveTx();
				assert.isTrue(obj.synced);
				
				obj.synced = true;
				assert.isFalse(obj.hasChanged(), type + " shouldn't be changed");
				
				// False
				var obj = createUnsavedDataObject(type);
				obj.synced = false;
				var id = yield obj.saveTx();
				assert.isFalse(obj.synced);
				obj.synced = false;
				assert.isFalse(obj.hasChanged(), type + " shouldn't be changed");
			}
		})
		
		it("should return true if 'synced' was set but unchanged and another primary field changed", function* () {
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				obj.synced = true;
				yield obj.saveTx();
				
				obj.synced = true;
				obj.version = 1234;
				assert.isTrue(obj.hasChanged());
			}
		})
	})
	
	describe("#save()", function () {
		it("should add new identifiers to cache", function* () {
			// Collection
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('collection');
			var obj = new Zotero.Collection;
			obj.name = "Test";
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Search
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('search');
			var obj = new Zotero.Search;
			obj.name = "Test";
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			
			// Item
			var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType('item');
			var obj = new Zotero.Item('book');
			var id = yield obj.saveTx();
			var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
			assert.typeOf(key, 'string');
			assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
		})
	})
	
	describe("#erase()", function () {
		it("shouldn't trigger notifier if skipNotifier is passed", function* () {
			let observerIDs = [];
			let promises = [];
			for (let type of types) {
				let obj = yield createDataObject(type);
				// For items, test automatic child item deletion
				if (type == 'item') {
					yield createDataObject(type, { itemType: 'note', parentID: obj.id });
				}
				
				let deferred = Zotero.Promise.defer();
				promises.push(deferred.promise);
				observerIDs.push(Zotero.Notifier.registerObserver(
					{
						notify: function (event) {
							if (event == 'delete') {
								deferred.reject("Notifier called for erase on " + type);
							}
						}
					},
					type,
					'test'
				));
				yield obj.eraseTx({
					skipNotifier: true
				});
			}
			yield Zotero.Promise.all(promises)
				// Give notifier time to trigger
				.timeout(100).catch(Zotero.Promise.TimeoutError, (e) => {})
			
			for (let id of observerIDs) {
				Zotero.Notifier.unregisterObserver(id);
			}
		})
		
		it("should delete object versions from sync cache", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type);
				let libraryID = obj.libraryID;
				let key = obj.key;
				let json = yield obj.toJSON();
				yield Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				yield obj.eraseTx();
				let versions = yield Zotero.Sync.Data.Local.getCacheObjectVersions(
					type, libraryID, key
				);
				assert.lengthOf(versions, 0);
			}
		})
	})
	
	describe("#updateVersion()", function() {
		it("should update the object version", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type);
				assert.equal(obj.version, 0);
				
				yield obj.updateVersion(1234);
				assert.equal(obj.version, 1234);
				assert.isFalse(obj.hasChanged());
				
				obj.synced = true;
				assert.ok(obj.hasChanged());
				yield obj.updateVersion(1235);
				assert.equal(obj.version, 1235);
				assert.ok(obj.hasChanged());
				
				yield obj.eraseTx();
			}
		})
	})
	
	describe("#updateSynced()", function() {
		it("should update the object sync status", function* () {
			for (let type of types) {
				let obj = yield createDataObject(type);
				assert.isFalse(obj.synced);
				
				yield obj.updateSynced(false);
				assert.isFalse(obj.synced);
				assert.isFalse(obj.hasChanged());
				
				yield obj.updateSynced(true);
				assert.ok(obj.synced);
				assert.isFalse(obj.hasChanged());
				
				obj.version = 1234;
				assert.ok(obj.hasChanged());
				yield obj.updateSynced(false);
				assert.isFalse(obj.synced);
				assert.ok(obj.hasChanged());
				
				yield obj.eraseTx();
			}
		})
	})
	
	describe("Relations", function () {
		var types = ['collection', 'item'];
		
		function makeObjectURI(objectType) {
			var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			return 'http://zotero.org/groups/1/' + objectTypePlural + '/'
				+ Zotero.Utilities.generateObjectKey();
		}
		
		describe("#addRelation()", function () {
			it("should add a relation to an object", function* () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					yield obj.saveTx();
					var relations = obj.getRelations();
					assert.property(relations, predicate);
					assert.include(relations[predicate], object);
				}
			})
		})
		
		describe("#removeRelation()", function () {
			it("should remove a relation from an object", function* () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					yield obj.saveTx();
					
					obj.removeRelation(predicate, object);
					yield obj.saveTx();
					
					assert.lengthOf(Object.keys(obj.getRelations()), 0);
				}
			})
		})
		
		describe("#hasRelation()", function () {
			it("should return true if an object has a given relation", function* () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					yield obj.saveTx();
					assert.ok(obj.hasRelation(predicate, object));
				}
			})
		})
		
		describe("#_getLinkedObject()", function () {
			it("should return a linked object in another library", function* () {
				var group = yield getGroup();
				var item1 = yield createDataObject('item');
				var item2 = yield createDataObject('item', { libraryID: group.libraryID });
				var item2URI = Zotero.URI.getItemURI(item2);
				
				yield item2.addLinkedItem(item1);
				var linkedItem = yield item1.getLinkedItem(item2.libraryID);
				assert.equal(linkedItem.id, item2.id);
			})
			
			it("shouldn't return reverse linked objects by default", function* () {
				var group = yield getGroup();
				var item1 = yield createDataObject('item');
				var item1URI = Zotero.URI.getItemURI(item1);
				var item2 = yield createDataObject('item', { libraryID: group.libraryID });
				
				yield item2.addLinkedItem(item1);
				var linkedItem = yield item2.getLinkedItem(item1.libraryID);
				assert.isFalse(linkedItem);
			})
			
			it("should return reverse linked objects with bidirectional flag", function* () {
				var group = yield getGroup();
				var item1 = yield createDataObject('item');
				var item1URI = Zotero.URI.getItemURI(item1);
				var item2 = yield createDataObject('item', { libraryID: group.libraryID });
				
				yield item2.addLinkedItem(item1);
				var linkedItem = yield item2.getLinkedItem(item1.libraryID, true);
				assert.equal(linkedItem.id, item1.id);
			})
		})
		
		describe("#_addLinkedObject()", function () {
			it("should add an owl:sameAs relation", function* () {
				var group = yield getGroup();
				var item1 = yield createDataObject('item');
				var dateModified = item1.getField('dateModified');
				var item2 = yield createDataObject('item', { libraryID: group.libraryID });
				var item2URI = Zotero.URI.getItemURI(item2);
				
				yield item2.addLinkedItem(item1);
				var preds = item1.getRelationsByPredicate(Zotero.Relations.linkedObjectPredicate);
				assert.include(preds, item2URI);
				
				// Make sure Date Modified hasn't changed
				assert.equal(item1.getField('dateModified'), dateModified);
			})
		})
	})
})
