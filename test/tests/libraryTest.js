describe("Zotero.Library", function() {
	describe("#constructor()", function() {
		it("should allow no arguments", function() {
			assert.doesNotThrow(() => new Zotero.Library());
		});
	});
	
	describe("#libraryID", function() {
		it("should not allow setting a library ID", function() {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryID = 1);
		});
		it("should return a  library ID for a saved library", function() {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isAbove(library.libraryID, 0);
		})
	});
	
	describe("#libraryType", function() {
		it("should not allow creating a non-basic library", function() {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryType = 'group', /^Invalid library type /);
			
		});
		it("should not allow setting a library type for a saved library", function* () {
			let library = yield createGroup();
			assert.throws(() => library.libraryType = 'feed');
		});
		it("should not allow creating new unique libraries", function* () {
			for (let i=0; i<Zotero.Library.prototype.fixedLibraries.length; i++) {
				let libraryType = Zotero.Library.prototype.fixedLibraries[i];
				assert.throws(function() {new Zotero.Library({ libraryType })}, /^Cannot create library of type /, 'cannot create a new ' + libraryType + ' library');
			}
		});
	});
	
	describe("#libraryVersion", function() {
		it("should be settable to increasing values", function() {
			let library = new Zotero.Library();
			assert.throws(() => library.libraryVersion = -2);
			assert.throws(() => library.libraryVersion = "a");
			assert.throws(() => library.libraryVersion = 1.1);
			assert.doesNotThrow(() => library.libraryVersion = 0);
			assert.doesNotThrow(() => library.libraryVersion = 5);
		});
		it("should not be possible to decrement", function() {
			let library = new Zotero.Library();
			library.libraryVersion = 5;
			assert.throws(() => library.libraryVersion = 0);
		});
		it("should be possible to set to -1", function() {
			let library = new Zotero.Library();
			library.libraryVersion = 5;
			assert.doesNotThrow(() => library.libraryVersion = -1);
		});
	});
	
	describe("#editable", function() {
		it("should return editable status", function() {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isTrue(library.editable, 'user library is editable');
		});
		it("should allow setting editable status", function* () {
			let library = yield createGroup({ editable: true });
			
			assert.isTrue(library.editable);
			assert.isTrue(Zotero.Libraries.isEditable(library.libraryID), "sets editable in cache to true");
			
			library.editable = false;
			yield library.saveTx();
			assert.isFalse(library.editable);
			assert.isFalse(Zotero.Libraries.isEditable(library.libraryID), "sets editable in cache to false");
		});
		it("should not be settable for user and publications libraries", function* () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.throws(function() {library.editable = false}, /^Cannot change _libraryEditable for user library$/, "does not allow setting user library as not editable");
			
			library = Zotero.Libraries.get(Zotero.Libraries.publicationsLibraryID);
			assert.throws(function() {library.editable = false}, /^Cannot change _libraryEditable for publications library$/, "does not allow setting publications library as not editable");
		});
	});
	
	describe("#filesEditable", function() {
		it("should return files editable status", function() {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.isTrue(library.filesEditable, 'user library is files editable');
		});
		
		it("should allow setting files editable status", function* () {
			let library = yield createGroup({ filesEditable: true });
			
			assert.isTrue(library.filesEditable);
			assert.isTrue(Zotero.Libraries.isFilesEditable(library.libraryID), "sets files editable in cache to true");
			
			library.filesEditable = false;
			yield library.saveTx();
			assert.isFalse(library.filesEditable);
			assert.isFalse(Zotero.Libraries.isFilesEditable(library.libraryID), "sets files editable in cache to false");
		});
		it("should not be settable for user and publications libraries", function* () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			assert.throws(function() {library.filesEditable = false}, /^Cannot change _libraryFilesEditable for user library$/, "does not allow setting user library as not files editable");
			
			library = Zotero.Libraries.get(Zotero.Libraries.publicationsLibraryID);
			assert.throws(function() {library.filesEditable = false}, /^Cannot change _libraryFilesEditable for publications library$/, "does not allow setting publications library as not files editable");
		});
	});
	
	describe("#save()", function() {
		it("should require mandatory parameters to be set", function* () {
			let library = new Zotero.Library({ editable: true, filesEditable: true });
			yield assert.isRejected(library.saveTx(), /^Error: libraryType must be set before saving/, 'libraryType is mandatory');
			
			// Required group params
			let groupID = Zotero.Utilities.rand(1000, 10000);
			let name = 'foo';
			let description = '';
			let version = Zotero.Utilities.rand(1000, 10000);
			library = new Zotero.Group({ filesEditable: true, groupID, name , description, version });
			yield assert.isRejected(library.saveTx(), /^Error: editable must be set before saving/, 'editable is mandatory');
			
			library = new Zotero.Group({ editable: true, groupID, name , description, version });
			yield assert.isRejected(library.saveTx(), /^Error: filesEditable must be set before saving/, 'filesEditable is mandatory');
			
			library = new Zotero.Group({ editable: true, filesEditable: true, groupID, name , description, version });
			yield assert.isFulfilled(library.saveTx());
		});
		it("should save new library to DB", function* () {
			let library = yield createGroup({});
			
			assert.isAbove(library.libraryID, 0, "sets a libraryID");
			assert.isTrue(Zotero.Libraries.exists(library.libraryID));
			assert.equal(library.libraryType, 'group');
			
			let inDB = yield Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM libraries WHERE libraryID=?', library.libraryID);
			assert.ok(inDB, 'added to DB');
		});
		it("should save library changes to DB", function* () {
			let library = yield createGroup({ editable: true });
			
			library.editable = false;
			yield library.saveTx();
			assert.isFalse(Zotero.Libraries.isEditable(library.libraryID));
		});
	});
	describe("#erase()", function() {
		it("should erase a group library", function* () {
			let library = yield createGroup();
			
			let libraryID = library.libraryID;
			yield library.eraseTx();
			
			assert.isFalse(Zotero.Libraries.exists(libraryID), "library no longer exists in cache");assert.isFalse(Zotero.Libraries.exists(libraryID));
			
			let inDB = yield Zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM libraries WHERE libraryID=?', libraryID);
			assert.notOk(inDB, 'removed from DB');
		});
		
		it("should erase a read-only library", function* () {
			let library = yield createGroup({ editable:false, filesEditable:false });
			
			yield assert.isFulfilled(library.eraseTx());
		});
		
		it("should not allow erasing permanent libraries", function* () {
			let library = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
			yield assert.isRejected(library.eraseTx(), /^Error: Cannot erase library of type 'user'$/, "does not allow erasing user library");
			
			library = Zotero.Libraries.get(Zotero.Libraries.publicationsLibraryID);
			yield assert.isRejected(library.eraseTx(), /^Error: Cannot erase library of type 'publications'$/, "does not allow erasing publications library");
		});
		
		it("should not allow erasing unsaved libraries", function* () {
			let library = new Zotero.Library();
			yield assert.isRejected(library.eraseTx());
		});
		it("should throw when accessing erased library methods, except for #libraryID", function* () {
			let library = yield createGroup();
			yield library.eraseTx();
			
			assert.doesNotThrow(() => library.libraryID);
			assert.throws(() => library.name, /^Group \(\d+\) has been disabled$/);
			assert.throws(() => library.editable = false, /^Group \(\d+\) has been disabled$/);
		});
		it("should clear child items from caches and DB", function* () {
			let group = yield createGroup();
			let libraryID = group.libraryID;
			
			let collection = yield createDataObject('collection', { libraryID });
			assert.ok(yield Zotero.Collections.getAsync(collection.id));
			
			let item = yield createDataObject('item', { libraryID });
			assert.ok(yield Zotero.Items.getAsync(item.id));
			
			let search = yield createDataObject('search', { libraryID });
			assert.ok(yield Zotero.Searches.getAsync(search.id));
			
			yield group.eraseTx();
			
			assert.notOk((yield Zotero.Searches.getAsync(search.id)), 'search was unloaded');
			assert.notOk((yield Zotero.Collections.getAsync(collection.id)), 'collection was unloaded');
			assert.notOk((yield Zotero.Items.getAsync(item.id)), 'item was unloaded');
		});
	});
	describe("#hasCollections()", function() {
		it("should throw if called before saving a library", function() {
			let library = new Zotero.Library();
			assert.throws(() => library.hasCollections());
		});
		it("should stay up to date as collections are added and removed", function* () {
			let library = yield createGroup({ editable: true });
			let libraryID = library.libraryID;
			assert.isFalse(library.hasCollections());
			
			let c1 = yield createDataObject('collection', { libraryID });
			assert.isTrue(library.hasCollections());
			
			let c2 = yield createDataObject('collection', { libraryID });
			assert.isTrue(library.hasCollections());
			
			yield c1.eraseTx();
			assert.isTrue(library.hasCollections());
			
			yield c2.eraseTx();
			assert.isFalse(library.hasCollections());
		})
	});
	describe("#hasSearches()", function() {
		it("should throw if called before saving a library", function() {
			let library = new Zotero.Library();
			assert.throws(() => library.hasSearches());
		});
		it("should stay up to date as searches are added and removed", function* () {
			let library = yield createGroup({ editable: true });
			let libraryID = library.libraryID;
			assert.isFalse(library.hasSearches());
			
			let s1 = yield createDataObject('search', { libraryID });
			assert.isTrue(library.hasSearches());
			
			let s2 = yield createDataObject('search', { libraryID });
			assert.isTrue(library.hasSearches());
			
			yield s1.eraseTx();
			assert.isTrue(library.hasSearches());
			
			yield s2.eraseTx();
			assert.isFalse(library.hasSearches());
		})
	});
	describe("#updateLastSyncTime()", function() {
		it("should set sync time to current time", function* () {
			let group = yield createGroup();
			assert.isFalse(group.lastSync);
			
			group.updateLastSyncTime();
			assert.ok(group.lastSync);
			assert.closeTo(Date.now(), group.lastSync.getTime(), 1000);
			
			yield group.saveTx();
			
			let dbTime = yield Zotero.DB.valueQueryAsync('SELECT lastSync FROM libraries WHERE libraryID=?', group.libraryID);
			assert.equal(dbTime*1000, group.lastSync.getTime());
		})
	});
})
