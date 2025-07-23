"use strict";

describe("Zotero.DataObject", function () {
	var types = ['collection', 'item', 'search'];
	
	describe("#library", function () {
		it("should return a Zotero.Library", async function () {
			var item = await createDataObject('item');
			assert.equal(item.library, Zotero.Libraries.userLibrary);
		});
	});
	
	describe("#libraryID", function () {
		it("should return a libraryID", async function () {
			var item = await createDataObject('item');
			assert.isNumber(item.libraryID);
			assert.equal(item.libraryID, Zotero.Libraries.userLibraryID);
		});
	});
	
	describe("#key", function () {
		it("shouldn't update .loaded on get if unset", async function () {
			for (let type of types) {
				let param;
				if (type == 'item') {
					param = 'book';
				}
				let obj = new (Zotero[Zotero.Utilities.capitalize(type)])(param);
				obj.libraryID = Zotero.Libraries.userLibraryID;
				assert.isNull(obj.key, 'key is null for ' + type);
				assert.isFalse(obj._loaded.primaryData, 'primary data not loaded for ' + type);
				obj.key = Zotero.DataObjectUtilities.generateKey();
			}
		})
	})
	
	describe("#version", function () {
		it("should be set to 0 after creating object", async function () {
			for (let type of types) {
				let obj = await createDataObject(type);
				assert.equal(obj.version, 0);
				await obj.eraseTx();
			}
		})
		
		it("should be set after creating object", async function () {
			for (let type of types) {
				let obj = await createDataObject(type, { version: 1234 });
				assert.equal(obj.version, 1234, type + " version mismatch");
				await obj.eraseTx();
			}
		})
	})
	
	describe("#synced", function () {
		it("should be set to false after creating object", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = await obj.saveTx();
				assert.isFalse(obj.synced);
				await obj.eraseTx();
			}
		});
		
		it("should be set to false after modifying object", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = await obj.saveTx();
				
				obj.synced = true;
				await obj.saveTx();
				
				if (type == 'item') {
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				await obj.saveTx();
				assert.isFalse(obj.synced);
				
				await obj.eraseTx();
			}
		});
		
		it("should be changed to true explicitly with no other changes", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = await obj.saveTx();
				
				obj.synced = true;
				await obj.saveTx();
				assert.isTrue(obj.synced);
				
				await obj.eraseTx();
			}
		});
		
		it("should be changed to true explicitly with other field changes", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = await obj.saveTx();
				
				if (type == 'item') {
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				obj.synced = true;
				await obj.saveTx();
				assert.isTrue(obj.synced);
				
				await obj.eraseTx();
			}
		});
		
		it("should remain at true if set explicitly", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				obj.synced = true;
				var id = await obj.saveTx();
				assert.isTrue(obj.synced);
				
				if (type == 'item') {
					obj.setField('title', 'test');
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				obj.synced = true;
				await obj.saveTx();
				assert.isTrue(obj.synced);
				
				await obj.eraseTx();
			}
		});
		
		it("should be unchanged if skipSyncedUpdate passed", async function () {
			for (let type of types) {
				var obj = createUnsavedDataObject(type);
				var id = await obj.saveTx();
				
				obj.synced = true;
				await obj.saveTx();
				
				if (type == 'item') {
					obj.setField('title', Zotero.Utilities.randomString());
				}
				else {
					obj.name = Zotero.Utilities.randomString();
				}
				await obj.saveTx({
					skipSyncedUpdate: true
				});
				assert.ok(obj.synced);
				
				await obj.eraseTx();
			}
		});
	})
	
	
	describe("#deleted", function () {
		it("should set trash status", async function () {
			for (let type of types) {
				let plural = Zotero.DataObjectUtilities.getObjectTypePlural(type)
				let pluralClass = Zotero[Zotero.Utilities.capitalize(plural)];
				
				// Set to true
				var obj = await createDataObject(type);
				assert.isFalse(obj.deleted, type);
				obj.deleted = true;
				// Sanity check for itemsTest#trash()
				if (type == 'item') {
					assert.isTrue(obj._changedData.deleted, type);
				}
				await obj.saveTx();
				var id = obj.id;
				await pluralClass.reload(id, false, true);
				assert.isTrue(obj.deleted, type);
				
				// Set to false
				obj.deleted = false;
				await obj.saveTx();
				await pluralClass.reload(id, false, true);
				assert.isFalse(obj.deleted, type);
			}
		});
	});
	
	describe("#loadPrimaryData()", function () {
		it("should load unloaded primary data if partially set", async function () {
			var objs = {};
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				await obj.save({
					skipCache: true
				});
				objs[type] = {
					key: obj.key,
					version: obj.version
				};
			}
			
			for (let type of types) {
				let obj = new (Zotero[Zotero.Utilities.capitalize(type)]);
				obj.libraryID = Zotero.Libraries.userLibraryID;
				obj.key = objs[type].key;
				await obj.loadPrimaryData();
				assert.equal(obj.version, objs[type].version);
			}
		});
		
		it("shouldn't overwrite item type set in constructor", async function () {
			var item = new Zotero.Item('book');
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.key = Zotero.DataObjectUtilities.generateKey();
			await item.loadPrimaryData();
			var saved = await item.saveTx();
			assert.ok(saved);
		});
	})
	
	describe("#loadAllData()", function () {
		it("should load data on a regular item", async function () {
			var item = new Zotero.Item('book');
			var id = await item.saveTx();
			await item.loadAllData();
			assert.throws(item.getNote.bind(item), 'getNote() can only be called on notes and attachments');
		})
		
		it("should load data on an attachment item", async function () {
			var item = new Zotero.Item('attachment');
			var id = await item.saveTx();
			await item.loadAllData();
			assert.equal(item.note, '');
		})
		
		it("should load data on a note item", async function () {
			var item = new Zotero.Item('note');
			var id = await item.saveTx();
			await item.loadAllData();
			assert.equal(item.note, '');
		})
	})
	
	
	describe("#hasChanged()", function () {
		it("should return false if 'synced' was set but unchanged and nothing else changed", async function () {
			for (let type of types) {
				// True
				var obj = createUnsavedDataObject(type);
				obj.synced = true;
				var id = await obj.saveTx();
				assert.isTrue(obj.synced);
				
				obj.synced = true;
				assert.isFalse(obj.hasChanged(), type + " shouldn't be changed");
				
				// False
				var obj = createUnsavedDataObject(type);
				obj.synced = false;
				var id = await obj.saveTx();
				assert.isFalse(obj.synced);
				obj.synced = false;
				assert.isFalse(obj.hasChanged(), type + " shouldn't be changed");
			}
		})
		
		it("should return true if 'synced' was set but unchanged and another primary field changed", async function () {
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				obj.synced = true;
				await obj.saveTx();
				
				obj.synced = true;
				obj.version = 1234;
				assert.isTrue(obj.hasChanged());
			}
		})
	});
	
	
	describe("#save()", function () {
		it("should add new identifiers to cache", async function () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = createUnsavedDataObject(type);
				let id = await obj.saveTx();
				let { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
				assert.typeOf(key, 'string');
				assert.equal(objectsClass.getIDFromLibraryAndKey(libraryID, key), id);
			}
		})
		
		it("should reset changed state on objects", async function () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = createUnsavedDataObject(type);
				await obj.saveTx();
				assert.isFalse(obj.hasChanged());
			}
		})
		
		it("should handle additional tag change in the middle of a save", async function () {
			var item = await createDataObject('item');
			item.setTags(['a']);
			
			var deferred = Zotero.Promise.defer();
			var origFunc = Zotero.Notifier.queue.bind(Zotero.Notifier);
			sinon.stub(Zotero.Notifier, "queue").callsFake(function (event, type, ids, extraData) {
				// Add a new tag after the first one has been added to the DB and before the save is
				// finished. The changed state should've cleared before saving to the DB the first
				// time, so the second setTags() should mark the item as changed and allow the new tag
				// to be saved in the second saveTx().
				if (event == 'add' && type == 'item-tag') {
					item.setTags(['a', 'b']);
					Zotero.Notifier.queue.restore();
					deferred.resolve(item.saveTx());
				}
				origFunc(...arguments);
			});
			
			await Promise.all([item.saveTx(), deferred.promise]);
			assert.sameMembers(item.getTags().map(o => o.tag), ['a', 'b']);
			var tags = await Zotero.DB.columnQueryAsync(
				"SELECT name FROM tags JOIN itemTags USING (tagID) WHERE itemID=?", item.id
			);
			assert.sameMembers(tags, ['a', 'b']);
		});
		
		describe("Edit Check", function () {
			var group;
			
			before(function* () {
				group = yield createGroup({
					editable: false
				});
			});
			
			it("should disallow saving to read-only libraries", async function () {
				let item = createUnsavedDataObject('item', { libraryID: group.libraryID });
				var e = await getPromiseError(item.saveTx());
				assert.ok(e);
				assert.include(e.message, "Cannot edit item");
			});
			
			it("should allow saving if skipEditCheck is passed", async function () {
				let item = createUnsavedDataObject('item', { libraryID: group.libraryID });
				var e = await getPromiseError(item.saveTx({
					skipEditCheck: true
				}));
				assert.isFalse(e);
			});
			
			it("should allow saving if skipAll is passed", async function () {
				let item = createUnsavedDataObject('item', { libraryID: group.libraryID });
				var e = await getPromiseError(item.saveTx({
					skipAll: true
				}));
				assert.isFalse(e);
			});
		});
	})
	
	describe("#erase()", function () {
		it("shouldn't trigger notifier if skipNotifier is passed", async function () {
			let observerIDs = [];
			let promises = [];
			for (let type of types) {
				let obj = await createDataObject(type);
				// For items, test automatic child item deletion
				if (type == 'item') {
					await createDataObject(type, { itemType: 'note', parentID: obj.id });
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
				await obj.eraseTx({
					skipNotifier: true
				});
			}
			await Promise.all(promises);
			
			for (let id of observerIDs) {
				Zotero.Notifier.unregisterObserver(id);
			}
		})
		
		it("should delete object versions from sync cache", async function () {
			for (let type of types) {
				let obj = await createDataObject(type);
				let libraryID = obj.libraryID;
				let key = obj.key;
				let json = obj.toJSON();
				await Zotero.Sync.Data.Local.saveCacheObjects(type, libraryID, [json]);
				await obj.eraseTx();
				let versions = await Zotero.Sync.Data.Local.getCacheObjectVersions(
					type, libraryID, key
				);
				assert.lengthOf(versions, 0);
			}
		})
	})
	
	describe("#updateVersion()", function () {
		it("should update the object version", async function () {
			for (let type of types) {
				let obj = await createDataObject(type);
				assert.equal(obj.version, 0);
				
				await obj.updateVersion(1234);
				assert.equal(obj.version, 1234);
				assert.isFalse(obj.hasChanged());
				
				obj.synced = true;
				assert.ok(obj.hasChanged());
				await obj.updateVersion(1235);
				assert.equal(obj.version, 1235);
				assert.ok(obj.hasChanged());
				
				await obj.eraseTx();
			}
		})
	})
	
	describe("#updateSynced()", function () {
		it("should update the object sync status", async function () {
			for (let type of types) {
				let obj = await createDataObject(type);
				assert.isFalse(obj.synced);
				
				await obj.updateSynced(false);
				assert.isFalse(obj.synced);
				assert.isFalse(obj.hasChanged());
				
				await obj.updateSynced(true);
				assert.ok(obj.synced);
				assert.isFalse(obj.hasChanged());
				
				obj.version = 1234;
				assert.ok(obj.hasChanged());
				await obj.updateSynced(false);
				assert.isFalse(obj.synced);
				assert.ok(obj.hasChanged());
				
				await obj.eraseTx();
			}
		})
		
		it("should clear changed status", async function () {
			var item = createUnsavedDataObject('item');
			item.synced = true;
			await item.saveTx();
			
			// Only synced changed
			item.synced = false;
			assert.isTrue(item.hasChanged());
			assert.isTrue(item._changed.primaryData.synced);
			await item.updateSynced(true);
			assert.isFalse(item.hasChanged());
			// Should clear primary data change object
			assert.isUndefined(item._changed.primaryData);
			
			// Another primary field also changed
			item.setField('dateModified', '2017-02-27 12:34:56');
			item.synced = false;
			assert.isTrue(item.hasChanged());
			assert.isTrue(item._changed.primaryData.synced);
			await item.updateSynced(true);
			assert.isTrue(item.hasChanged());
			// Should clear only 'synced' change status
			assert.isUndefined(item._changed.primaryData.synced);
		});
	})
	
	describe("Relations", function () {
		var types = ['collection', 'item'];
		
		function makeObjectURI(objectType) {
			var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			return 'http://zotero.org/groups/1/' + objectTypePlural + '/'
				+ Zotero.Utilities.generateObjectKey();
		}
		
		describe("#addRelation()", function () {
			it("should add a relation to an object", async function () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					await obj.saveTx();
					var relations = obj.getRelations();
					assert.property(relations, predicate);
					assert.include(relations[predicate], object);
				}
			})
		})
		
		describe("#removeRelation()", function () {
			it("should remove a relation from an object", async function () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					await obj.saveTx();
					
					obj.removeRelation(predicate, object);
					await obj.saveTx();
					
					assert.lengthOf(Object.keys(obj.getRelations()), 0);
				}
			})
		})
		
		describe("#hasRelation()", function () {
			it("should return true if an object has a given relation", async function () {
				for (let type of types) {
					let predicate = 'owl:sameAs';
					let object = makeObjectURI(type);
					let obj = createUnsavedDataObject(type);
					obj.addRelation(predicate, object);
					await obj.saveTx();
					assert.ok(obj.hasRelation(predicate, object));
				}
			})
		})
		
		describe("#setRelations()", function () {
			it("shouldn't allow invalid 'relations' predicates", async function () {
				var item = new Zotero.Item("book");
				assert.throws(() => {
					item.setRelations({
						"0": ["http://example.com/foo"]
					});
				});
			});
		});
		
		describe("#_getLinkedObject()", function () {
			it("should return a linked object in another library", async function () {
				var group = await getGroup();
				var item1 = await createDataObject('item');
				var item2 = await createDataObject('item', { libraryID: group.libraryID });
				var item2URI = Zotero.URI.getItemURI(item2);
				
				await item2.addLinkedItem(item1);
				var linkedItem = await item1.getLinkedItem(item2.libraryID);
				assert.equal(linkedItem.id, item2.id);
			})
			
			it("shouldn't return a linked item in the trash in another library", async function () {
				var group = await getGroup();
				var item1 = await createDataObject('item');
				var item2 = await createDataObject('item', { libraryID: group.libraryID });
				var item2URI = Zotero.URI.getItemURI(item2);
				
				await item2.addLinkedItem(item1);
				item2.deleted = true;
				await item2.saveTx();
				var linkedItem = await item1.getLinkedItem(item2.libraryID);
				assert.isFalse(linkedItem);
			})
			
			it("shouldn't return reverse linked objects by default", async function () {
				var group = await getGroup();
				var item1 = await createDataObject('item');
				var item1URI = Zotero.URI.getItemURI(item1);
				var item2 = await createDataObject('item', { libraryID: group.libraryID });
				
				await item2.addLinkedItem(item1);
				var linkedItem = await item2.getLinkedItem(item1.libraryID);
				assert.isFalse(linkedItem);
			})
			
			it("should return reverse linked objects with bidirectional flag", async function () {
				var group = await getGroup();
				var item1 = await createDataObject('item');
				var item1URI = Zotero.URI.getItemURI(item1);
				var item2 = await createDataObject('item', { libraryID: group.libraryID });
				
				await item2.addLinkedItem(item1);
				var linkedItem = await item2.getLinkedItem(item1.libraryID, true);
				assert.equal(linkedItem.id, item1.id);
			})
		})
		
		describe("#_addLinkedObject()", function () {
			it("should add an owl:sameAs relation", async function () {
				var group = await getGroup();
				var item1 = await createDataObject('item');
				var dateModified = item1.getField('dateModified');
				var item2 = await createDataObject('item', { libraryID: group.libraryID });
				var item2URI = Zotero.URI.getItemURI(item2);
				
				await item2.addLinkedItem(item1);
				var preds = item1.getRelationsByPredicate(Zotero.Relations.linkedObjectPredicate);
				assert.include(preds, item2URI);
				
				// Make sure Date Modified hasn't changed
				assert.equal(item1.getField('dateModified'), dateModified);
			})
		})
	});
	
	describe("#fromJSON()", function () {
		it("should remove object from trash if 'deleted' property not provided", async function () {
			for (let type of types) {
				let obj = await createDataObject(type, { deleted: true });
				
				assert.isTrue(obj.deleted, type);
				
				let json = obj.toJSON();
				delete json.deleted;
				
				obj.fromJSON(json);
				await obj.saveTx();
				
				assert.isFalse(obj.deleted, type);
			}
		});
	});
	
	describe("#toJSON()", function () {
		it("should output 'deleted' as true", function () {
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				obj.deleted = true;
				let json = obj.toJSON();
				assert.isTrue(json.deleted, type);
			}
		});
		
		it("shouldn't include 'deleted' if not set in default mode", function () {
			for (let type of types) {
				let obj = createUnsavedDataObject(type);
				let json = obj.toJSON();
				assert.notProperty(json, 'deleted', type);
			}
		});
		
		describe("'patch' mode", function () {
			it("should include changed 'deleted' field", async function () {
				for (let type of types) {
					let plural = Zotero.DataObjectUtilities.getObjectTypePlural(type)
					let pluralClass = Zotero[Zotero.Utilities.capitalize(plural)];
					
					// True to false
					let obj = createUnsavedDataObject(type)
					obj.deleted = true;
					let id = await obj.saveTx();
					obj = await pluralClass.getAsync(id);
					let patchBase = obj.toJSON();
					
					obj.deleted = false;
					let json = obj.toJSON({
						patchBase: patchBase
					})
					assert.isUndefined(json.title, type);
					assert.isFalse(json.deleted, type);
					
					// False to true
					obj = createUnsavedDataObject(type);
					obj.deleted = false;
					id = await obj.saveTx();
					obj = await pluralClass.getAsync(id);
					patchBase = obj.toJSON();
					
					obj.deleted = true;
					json = obj.toJSON({
						patchBase: patchBase
					})
					assert.isUndefined(json.title, type);
					assert.isTrue(json.deleted, type);
				}
			});
		});
	});
})
