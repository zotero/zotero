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

	function registerResource(target = "mainWindow") {
		return plugin.run(target => Zotero.WindowResourceManager.registerResource({
			resourceID: "test-ftl", target, type: "ftl", url: "preferences.ftl",
		}), target);
	}

	it("should reject an unsupported window target", function () {
		assert.isFalse(registerResource("unknown"));
	});

	it("should register and remove an FTL resource across open main windows", async function () {
		let attachment = await importFileAttachment("test.pdf");
		let { win: readerWin } = await Zotero.Reader.open(attachment.id, null, { window: win, openInWindow: true });
		try {
			let resourceID = registerResource();
			assert.isString(resourceID);
			let l10n = new Localization(["preferences.ftl"], true);
			let id = "preferences-file-renaming-title";
			let expected = l10n.formatValueSync(id);
			for (let targetDoc of [doc, readerWin.document]) {
				assert.equal(await targetDoc.l10n.formatValue(id), expected);
			}
			assert.isTrue(plugin.run(id => Zotero.WindowResourceManager.unregisterResource(id), resourceID));
			for (let targetDoc of [doc, readerWin.document]) {
				assert.notEqual(await targetDoc.l10n.formatValue(id), expected);
			}
		}
		finally {
			readerWin.close();
		}
	});

	it("should apply registered resources to windows opened later", async function () {
		assert.isString(registerResource());
		let l10n = new Localization(["preferences.ftl"], true);
		let id = "preferences-file-renaming-title";
		for (let type of ["reader", "note"]) {
			let item = type === "reader"
				? await importFileAttachment("test.pdf")
				: await createDataObject("item", { itemType: "note" });
			let opener = type === "reader" ? Zotero.Reader : Zotero.Notes;
			let { win: itemWin } = await opener.open(item.id, null, { window: win, openInWindow: true });
			try {
				assert.equal(await itemWin.document.l10n.formatValue(id), l10n.formatValueSync(id));
			}
			finally {
				itemWin.close();
			}
		}
	});
});
