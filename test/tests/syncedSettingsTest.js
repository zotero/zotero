describe('Zotero.SyncedSettings', function () {
	it('should not affect cached value when modifying the setting after #set() call', async function () {
		let setting = {athing: 1};
		await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'lastPageIndex_u_AAAAAAAA', setting);
		
		setting.athing = 2;
		let storedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'lastPageIndex_u_AAAAAAAA');
		assert.notDeepEqual(setting, storedSetting);
	});
	
	describe("#set()", function () {
		it("should throw for a setting not allowed by the server", async function () {
			let libraryID = Zotero.Libraries.userLibraryID;
			let e = await getPromiseError(
				Zotero.SyncedSettings.set(libraryID, 'plugin.setting.ABCD2345', 'foo')
			);
			assert.ok(e);
			assert.include(e.message, "Invalid synced setting 'plugin.setting.ABCD2345'");
			assert.isNull(Zotero.SyncedSettings.get(libraryID, 'plugin.setting.ABCD2345'));
		});
		
		it("should allow an unknown setting from the server", async function () {
			let libraryID = Zotero.Libraries.userLibraryID;
			await Zotero.SyncedSettings.set(libraryID, 'futureSetting', 'foo', 5, true);
			assert.equal(Zotero.SyncedSettings.get(libraryID, 'futureSetting'), 'foo');
			await Zotero.SyncedSettings.clear(libraryID, 'futureSetting', { skipDeleteLog: true });
		});
	});
	
	describe("#getUnsynced()", function () {
		it("should skip settings not allowed by the server", async function () {
			let group = await createGroup();
			let libraryID = group.libraryID;
			await Zotero.DB.queryAsync(
				"INSERT INTO syncedSettings (setting, libraryID, value, version, synced) "
					+ "VALUES (?, ?, ?, 0, 0)",
				['plugin.setting.ABCD2345', libraryID, '"foo"']
			);
			await Zotero.SyncedSettings.set(libraryID, 'lastPageIndex_u_AAAAAAAA', 1);
			
			let settings = await Zotero.SyncedSettings.getUnsynced(libraryID);
			assert.sameMembers(Object.keys(settings), ['lastPageIndex_u_AAAAAAAA']);
		});
	});
	
	describe('clientVersion', function () {
		let libraryID;
		
		before(function () {
			libraryID = Zotero.Libraries.userLibraryID;
		});
		
		afterEach(async function () {
			await Zotero.SyncedSettings.clear(libraryID, 'clientVersionTest');
		});
		
		it('should increment the library clientVersion when a setting is set outside a transaction', async function () {
			let library = Zotero.Libraries.get(libraryID);
			let versionBefore = library.clientVersion;
			await Zotero.SyncedSettings.set(libraryID, 'clientVersionTest', 'a');
			assert.isAbove(library.clientVersion, versionBefore);
			assert.equal(
				Zotero.SyncedSettings.getMetadata(libraryID, 'clientVersionTest').clientVersion,
				library.clientVersion
			);
			assert.equal(
				await Zotero.DB.valueQueryAsync(
					"SELECT clientVersion FROM syncedSettings WHERE setting=? AND libraryID=?",
					['clientVersionTest', libraryID]
				),
				library.clientVersion
			);
			
			versionBefore = library.clientVersion;
			await Zotero.SyncedSettings.set(libraryID, 'clientVersionTest', 'b');
			assert.isAbove(library.clientVersion, versionBefore);
			assert.equal(
				Zotero.SyncedSettings.getMetadata(libraryID, 'clientVersionTest').clientVersion,
				library.clientVersion
			);
		});
		
		it('should share the transaction clientVersion when a setting is set inside a transaction', async function () {
			let library = Zotero.Libraries.get(libraryID);
			let item;
			await Zotero.DB.executeTransaction(async () => {
				item = createUnsavedDataObject('item');
				await item.save();
				await Zotero.SyncedSettings.set(libraryID, 'clientVersionTest', 'a');
			});
			assert.equal(item.clientVersion, library.clientVersion);
			assert.equal(
				Zotero.SyncedSettings.getMetadata(libraryID, 'clientVersionTest').clientVersion,
				library.clientVersion
			);
			await item.eraseTx();
		});
		
		it('should load clientVersion from the database', async function () {
			await Zotero.SyncedSettings.set(libraryID, 'clientVersionTest', 'a');
			let clientVersion = Zotero.SyncedSettings.getMetadata(libraryID, 'clientVersionTest').clientVersion;
			await Zotero.SyncedSettings.loadAll(libraryID);
			assert.equal(
				Zotero.SyncedSettings.getMetadata(libraryID, 'clientVersionTest').clientVersion,
				clientVersion
			);
		});
		
		it('should increment the library clientVersion when a setting is cleared', async function () {
			let library = Zotero.Libraries.get(libraryID);
			await Zotero.SyncedSettings.set(libraryID, 'clientVersionTest', 'a');
			let versionBefore = library.clientVersion;
			await Zotero.SyncedSettings.clear(libraryID, 'clientVersionTest');
			assert.isAbove(library.clientVersion, versionBefore);
		});
	});
});
