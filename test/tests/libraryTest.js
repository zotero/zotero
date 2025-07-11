describe("Zotero.Library", function () {
	describe("#constructor()", function () {
		it("should allow no arguments", function () {
			assert.doesNotThrow(() => new Zotero.Library());
		});
	});
	
	describe("#libraryID", function () {
		it("should not allow setting a library ID", function () {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryID = 1);
		});
		it("should return a  library ID for a saved library", function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isAbove(library.libraryID, 0);
		})
	});
	
	describe("#libraryType", function () {
		it("should not allow creating a non-basic library", function () {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryType = 'group', /^Invalid library type /);
			
		});
		it("should not allow setting a library type for a saved library", async function () {
			let library = await createGroup();
			assert.throws(() => library.libraryType = 'feed');
		});
		it("should not allow creating new unique libraries", async function () {
			for (let i=0; i<Zotero.Library.prototype.fixedLibraries.length; i++) {
				let libraryType = Zotero.Library.prototype.fixedLibraries[i];
				assert.throws(function () {new Zotero.Library({ libraryType })}, /^Cannot create library of type /, 'cannot create a new ' + libraryType + ' library');
			}
		});
	});
	
	describe("#libraryTypeID", function () {
		it("should return a group id for a group", async function () {
			let library = await createGroup();
			assert.typeOf(library.libraryTypeID, 'number');
			assert.equal(library.libraryTypeID, library.groupID);
		})
	})
	
	describe("#libraryVersion", function () {
		it("should be settable to increasing values", function () {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryVersion = -2);
			assert.throws(() => library.libraryVersion = "a");
			assert.throws(() => library.libraryVersion = 1.1);
			assert.doesNotThrow(() => library.libraryVersion = 0);
			assert.doesNotThrow(() => library.libraryVersion = 5);
		});
		it("should not be possible to decrement", function () {
			let library = new Zotero.Library();
			library.libraryVersion = 5;
			assert.throws(() => library.libraryVersion = 0);
		});
		it("should be possible to set to -1", function () {
			let library = new Zotero.Library();
			library.libraryVersion = 5;
			assert.doesNotThrow(() => library.libraryVersion = -1);
		});
	});
	
	describe("#editable", function () {
		it("should return editable status", function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isTrue(library.editable, 'user library is editable');
		});
		it("should allow setting editable status", async function () {
			let library = await createGroup({ editable: true });
			
			assert.isTrue(library.editable);
			assert.isTrue(Zotero.Libraries.isEditable(library.libraryID), "sets editable in cache to true");
			assert.equal(((await Zotero.DB.valueQueryAsync("SELECT editable FROM libraries WHERE libraryID=?", library.libraryID))), 1)
			
			library.editable = false;
			await library.saveTx();
			assert.isFalse(library.editable);
			assert.isFalse(Zotero.Libraries.isEditable(library.libraryID), "sets editable in cache to false");
			assert.equal(((await Zotero.DB.valueQueryAsync("SELECT editable FROM libraries WHERE libraryID=?", library.libraryID))), 0)
		});
		
		it("should also set filesEditable to false", async function () {
			let library = await createGroup({ editable: true, filesEditable: true });
			assert.isTrue(library.filesEditable);
			
			library.editable = false;
			await library.saveTx();
			assert.isFalse(library.filesEditable);
			assert.equal(((await Zotero.DB.valueQueryAsync("SELECT filesEditable FROM libraries WHERE libraryID=?", library.libraryID))), 0)
		});
		
		it("should not be settable for user libraries", async function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.throws(function () {library.editable = false}, /^Cannot change _libraryEditable for user library$/, "does not allow setting user library as not editable");
		});
	});
	
	describe("#filesEditable", function () {
		it("should always return true for user library", function () {
			assert.isTrue(Zotero.Libraries.userLibrary.filesEditable);
		});
		
		it("should return files editable status", function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isTrue(library.filesEditable, 'user library is files editable');
		});
		
		it("should allow setting files editable status", async function () {
			let library = await createGroup({ filesEditable: true });
			
			assert.isTrue(library.filesEditable);
			assert.isTrue(Zotero.Libraries.isFilesEditable(library.libraryID), "sets files editable in cache to true");
			
			library.filesEditable = false;
			await library.saveTx();
			assert.isFalse(library.filesEditable);
			assert.isFalse(Zotero.Libraries.isFilesEditable(library.libraryID), "sets files editable in cache to false");
		});
		
		it("should not be settable for user libraries", async function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.throws(function () {library.filesEditable = false}, /^Cannot change _libraryFilesEditable for user library$/, "does not allow setting user library as not files editable");
		});
	});
	
	describe("#allowsLinkedFiles", function () {
		it("should return true for personal library", function () {
			assert.isTrue(Zotero.Libraries.userLibrary.allowsLinkedFiles);
		});
		
		it("should return false for group libraries", async function () {
			var group = await getGroup();
			assert.isFalse(group.allowsLinkedFiles);
		});
	});
	
	describe("#archived", function () {
		it("should return archived status", function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isFalse(library.archived, 'user library is not archived');
		});
		
		it("should allow setting archived status", async function () {
			let library = await createGroup({ editable: false, archived: true });
			assert.isTrue(library.archived);
			assert.equal(((await Zotero.DB.valueQueryAsync("SELECT archived FROM libraries WHERE libraryID=?", library.libraryID))), 1)
			
			library.archived = false;
			await library.saveTx();
			assert.isFalse(library.archived);
			assert.equal(((await Zotero.DB.valueQueryAsync("SELECT archived FROM libraries WHERE libraryID=?", library.libraryID))), 0)
		});
		
		it("should not be settable for user libraries", async function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.throws(() => library.archived = true, /^Cannot change _libraryArchived for user library$/, "does not allow setting user library as archived");
		});
		
		it("should only be settable on read-only library", async function () {
			let library = await createGroup();
			assert.throws(() => library.archived = true, /^Cannot set editable library as archived$/);
		});
	});
	
	describe("#save()", function () {
		it("should require mandatory parameters to be set", async function () {
			let library = new Zotero.Library({ editable: true, filesEditable: true });
			await assert.isRejected(library.saveTx(), /^libraryType must be set before saving/, 'libraryType is mandatory');
			
			// Required group params
			let groupID = Zotero.Utilities.rand(1000, 10000);
			let name = 'foo';
			let description = '';
			let version = Zotero.Utilities.rand(1000, 10000);
			library = new Zotero.Group({ filesEditable: true, groupID, name , description, version });
			await assert.isRejected(library.saveTx(), /^editable must be set before saving/, 'editable is mandatory');
			
			library = new Zotero.Group({ editable: true, groupID, name , description, version });
			await assert.isRejected(library.saveTx(), /^filesEditable must be set before saving/, 'filesEditable is mandatory');
			
			library = new Zotero.Group({ editable: true, filesEditable: true, groupID, name , description, version });
			await assert.isFulfilled(library.saveTx());
		});
		it("should save new library to DB", async function () {
			let library = await createGroup({});
			
			assert.isAbove(library.libraryID, 0, "sets a libraryID");
			assert.isTrue(Zotero.Libraries.exists(library.libraryID));
			assert.equal(library.libraryType, 'group');
			
			let inDB = await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM libraries WHERE libraryID=?', library.libraryID);
			assert.ok(inDB, 'added to DB');
		});
		it("should save library changes to DB", async function () {
			let library = await createGroup({ editable: true });
			
			library.editable = false;
			await library.saveTx();
			assert.isFalse(Zotero.Libraries.isEditable(library.libraryID));
		});
		
		it("should initialize library after creation", async function () {
			let library = await createGroup({});
			Zotero.SyncedSettings.get(library.libraryID, "tagColors");
		});
	});
	describe("#erase()", function () {
		it("should erase a group library", async function () {
			let library = await createGroup();
			
			let libraryID = library.libraryID;
			await library.eraseTx();
			
			assert.isFalse(Zotero.Libraries.exists(libraryID), "library no longer exists in cache");assert.isFalse(Zotero.Libraries.exists(libraryID));
			
			let inDB = await Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM libraries WHERE libraryID=?', libraryID);
			assert.notOk(inDB, 'removed from DB');
		});
		
		it("should erase a read-only library", async function () {
			let library = await createGroup({ editable:false, filesEditable:false });
			
			await assert.isFulfilled(library.eraseTx());
		});
		
		it("should not allow erasing permanent libraries", async function () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			await assert.isRejected(library.eraseTx(), /^Cannot erase library of type 'user'$/, "does not allow erasing user library");
		});
		
		it("should not allow erasing unsaved libraries", async function () {
			let library = new Zotero.Library();
			await assert.isRejected(library.eraseTx());
		});
		it("should throw when accessing erased library methods, except for #libraryID and #name", async function () {
			let library = await createGroup();
			await library.eraseTx();
			
			assert.doesNotThrow(() => library.libraryID);
			assert.throws(() => library.editable = false, /^Group \(\d+\) has been disabled$/);
		});
		it("should clear child items from caches and DB", async function () {
			let group = await createGroup();
			let libraryID = group.libraryID;
			
			let collection = await createDataObject('collection', { libraryID });
			assert.ok(await Zotero.Collections.getAsync(collection.id));
			
			let item = await createDataObject('item', { libraryID });
			assert.ok(await Zotero.Items.getAsync(item.id));
			
			let search = await createDataObject('search', { libraryID });
			assert.ok(await Zotero.Searches.getAsync(search.id));
			
			await group.eraseTx();
			
			assert.notOk(((await Zotero.Searches.getAsync(search.id))), 'search was unloaded');
			assert.notOk(((await Zotero.Collections.getAsync(collection.id))), 'collection was unloaded');
			assert.notOk(((await Zotero.Items.getAsync(item.id))), 'item was unloaded');
		});
		
		it("should delete attachment files", async function () {
			// My Library
			var item1 = await createDataObject('item');
			var attachment1 = await importFileAttachment('test.png', { parentID: item1.id });
			var path1 = attachment1.getFilePath();
			
			// Group
			var group = await createGroup();
			var libraryID = group.libraryID;
			var item2 = await createDataObject('item', { libraryID });
			var attachment2 = await importFileAttachment('test.png', { libraryID, parentID: item2.id });
			var path2 = attachment2.getFilePath();
			
			assert.isTrue(await OS.File.exists(path1));
			assert.isTrue(await OS.File.exists(path2));
			
			await group.eraseTx();
			
			// My Library file should still exist, but group file should be deleted
			assert.isTrue(await OS.File.exists(path1));
			assert.isFalse(await OS.File.exists(path2));
		});
	});
	
	
	describe("#hasCollections()", function () {
		it("should throw if called before saving a library", function () {
			let library = new Zotero.Library();
			assert.throws(() => library.hasCollections());
		});
		it("should stay up to date as collections are added and removed", async function () {
			let library = await createGroup({ editable: true });
			let libraryID = library.libraryID;
			assert.isFalse(library.hasCollections());
			
			let c1 = await createDataObject('collection', { libraryID });
			assert.isTrue(library.hasCollections());
			
			let c2 = await createDataObject('collection', { libraryID });
			assert.isTrue(library.hasCollections());
			
			await c1.eraseTx();
			assert.isTrue(library.hasCollections());
			
			await c2.eraseTx();
			assert.isFalse(library.hasCollections());
		})
	});
	describe("#hasSearches()", function () {
		it("should throw if called before saving a library", function () {
			let library = new Zotero.Library();
			assert.throws(() => library.hasSearches());
		});
		it("should stay up to date as searches are added and removed", async function () {
			let library = await createGroup({ editable: true });
			let libraryID = library.libraryID;
			assert.isFalse(library.hasSearches());
			
			let s1 = await createDataObject('search', { libraryID });
			assert.isTrue(library.hasSearches());
			
			let s2 = await createDataObject('search', { libraryID });
			assert.isTrue(library.hasSearches());
			
			await s1.eraseTx();
			assert.isTrue(library.hasSearches());
			
			await s2.eraseTx();
			assert.isFalse(library.hasSearches());
		})
	});
	describe("#hasItems()", function () {
		it("should throw if called before saving a library", async function () {
			let library = new Zotero.Library();
			try {
				await library.hasItems();
				assert.isFalse(true, "Library#hasItems did not throw an error");
			} catch (e) {
				assert.ok(e);
			}
		});
		it("should stay up to date as items are added and removed", async function () {
			let library = await createGroup({ editable: true });
			let libraryID = library.libraryID;
			var hasItems = await library.hasItems();
			assert.isFalse(hasItems);

			let i1 = await createDataObject('item', { libraryID });
			hasItems = await library.hasItems();
			assert.isTrue(hasItems);

			let i2 = await createDataObject('item', { libraryID });
			hasItems = await library.hasItems();
			assert.isTrue(hasItems);

			await i1.eraseTx();
			hasItems = await library.hasItems();
			assert.isTrue(hasItems);

			await i2.eraseTx();
			hasItems = await library.hasItems();
			assert.isFalse(hasItems);
		});
	});
	describe("#updateLastSyncTime()", function () {
		it("should set sync time to current time", async function () {
			let group = await createGroup();
			assert.isFalse(group.lastSync);
			
			group.updateLastSyncTime();
			assert.ok(group.lastSync);
			assert.closeTo(Date.now(), group.lastSync.getTime(), 1000);
			
			await group.saveTx();
			
			let dbTime = await Zotero.DB.valueQueryAsync('SELECT lastSync FROM libraries WHERE libraryID=?', group.libraryID);
			assert.equal(dbTime*1000, group.lastSync.getTime());
		})
	});
})
