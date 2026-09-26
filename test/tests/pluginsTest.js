describe("Zotero.Plugins", function () {
	var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

	describe("Loading", function () {
		var addon;

		afterEach(async function () {
			if (addon) {
				await addon.uninstall();
				addon = null;
			}
			Zotero.Prefs.clear('pluginLoadingTest.pref');
		});

		// The fixture's bootstrap.js loads main.js from its own XPI with
		// Services.scriptloader.loadSubScript() and no target, as most plugins do
		it("should load scripts and default prefs from a plugin's XPI", async function () {
			let file = getTestDataDirectory();
			file.append('plugin-loading-test.xpi');
			addon = await AddonManager.installTemporaryAddon(file);

			await waitForCallback(() => Zotero.PluginLoadingTest, 100, 10);
			assert.equal(Zotero.PluginLoadingTest, 'loaded');
			assert.equal(Zotero.Prefs.get('pluginLoadingTest.pref'), 'default');
		});
	});
});
