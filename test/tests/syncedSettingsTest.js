describe('Zotero.SyncedSettings', function() {
	it('should not affect cached value when modifying the setting after #set() call', function* () {
		let setting = {athing: 1};
		yield Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'setting', setting);
		
		setting.athing = 2;
		let storedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'setting');
		assert.notDeepEqual(setting, storedSetting);
	});
});
