describe("Zotero.WindowResourceManager", function () {
	var plugin = usePluginSandbox();
	var win, doc;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		plugin.load(["default", "windowResource"]);
	});

	afterEach(async function () {
		await Zotero.WindowResourceManager._manager._unregisterByPluginID(plugin.id);
	});

	it("should register and unregister an FTL resource", async function () {
		// preferences.ftl is not loaded by default in the main window
		let resourceID = plugin.run(() => Zotero.WindowResourceManager.registerResource({
			resourceID: "test-ftl",
			target: "mainWindow",
			type: "ftl",
			url: "preferences.ftl",
		}));
		assert.isString(resourceID);

		// The strings resolve in the open window
		let l10n = new Localization(["preferences.ftl"], true);
		let expected = l10n.formatValueSync("preferences-file-renaming-title");
		assert.equal(await doc.l10n.formatValue("preferences-file-renaming-title"), expected);

		assert.isTrue(plugin.run(id => Zotero.WindowResourceManager.unregisterResource(id), resourceID));
		assert.notExists(doc.querySelector(`link[href="preferences.ftl"]`), "the FTL link goes with it");
	});
});
