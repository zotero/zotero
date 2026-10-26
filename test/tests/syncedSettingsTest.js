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
});
