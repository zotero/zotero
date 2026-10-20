describe('Zotero.SyncedSettings', function () {
	it('should not affect cached value when modifying the setting after #set() call', async function () {
		let setting = {athing: 1};
		await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'setting', setting);
		
		setting.athing = 2;
		let storedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'setting');
		assert.notDeepEqual(setting, storedSetting);
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
