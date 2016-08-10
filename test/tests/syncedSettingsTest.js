describe('Zotero.SyncedSettings', function() {
	it('modifying object after setting does not affect cached value', function* () {
		let setting = {athing: 1};
		yield Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'setting', setting);
		
		setting.athing = 2;
		let storedSetting = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'setting');
		assert.notDeepEqual(setting, storedSetting);
	});
});
