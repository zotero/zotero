describe("Zotero.ClipboardController", function () {
	var plugin = usePluginSandbox();
	var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var { PathIdentity } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/filePath.mjs");

	const FILE_FLAVOR = "application/x-moz-file";
	const PREF_PREFIX = "extensions.zotero.pluginFileAccess.";

	// A file in the plugin's own data directory, which it reads without a grant
	async function ownFile(name, content) {
		let dir = PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", plugin.uuid);
		await FileIO.makeDirectory(dir, { createAncestors: true });
		let file = PathUtils.join(dir, name);
		await FileIO.writeUTF8(file, content);
		return PluginFileAccess.canonicalize(file);
	}

	function writeClipboard(data) {
		return plugin.eval(`Zotero.ClipboardController.command("write", { data: ${JSON.stringify(data)} })`);
	}

	function readClipboard(flavor, as) {
		return plugin.eval(`Zotero.ClipboardController.query("read", ${JSON.stringify({ flavor, as })})`);
	}

	it("should expose query with clipboardRead and command with clipboardWrite only", function () {
		plugin.load(["default"]);
		assert.equal(plugin.eval("typeof Zotero.ClipboardController"), "undefined");
		plugin.load(["default", "clipboardRead"]);
		assert.equal(plugin.eval("typeof Zotero.ClipboardController.query"), "function");
		assert.equal(plugin.eval("typeof Zotero.ClipboardController.command"), "undefined");
		plugin.load(["default", "clipboardWrite"]);
		assert.equal(plugin.eval("typeof Zotero.ClipboardController.command"), "function");
		assert.equal(plugin.eval("typeof Zotero.ClipboardController.query"), "undefined");
	});

	it("should write text and a file and read them back, a file only as its path", async function () {
		plugin.load(["default", "clipboardRead", "clipboardWrite"]);
		let text = "sandbox clipboard " + Zotero.Utilities.randomString();
		let written = await plugin.eval(`Zotero.ClipboardController.command("write", { data: { "text/plain": ${JSON.stringify(text)} } })`);
		assert.isTrue(written.success, written.error && written.error.message);
		let read = await plugin.eval('Zotero.ClipboardController.query("read", { flavor: "text/plain" })');
		assert.equal(read.result.data, text);
		let flavors = await plugin.eval('Zotero.ClipboardController.query("flavors")');
		assert.include(Array.from(flavors.result.flavors), "text/plain");
		let notBytes = await plugin.eval('Zotero.ClipboardController.query("read", { flavor: "text/plain", as: "bytes" })');
		assert.equal(notBytes.error.code, Zotero.ClipboardController.errorCodes.INVALID_PARAMS);
		let file = await ownFile("on-clipboard-" + Zotero.Utilities.randomString() + ".txt", "file bytes");
		let placed = await writeClipboard({ [FILE_FLAVOR]: file });
		assert.isTrue(placed.success, placed.error && placed.error.message);
		flavors = await plugin.eval('Zotero.ClipboardController.query("flavors")');
		assert.include(Array.from(flavors.result.flavors), FILE_FLAVOR);
		assert.equal((await readClipboard(FILE_FLAVOR)).result.data, file);
		// Its content goes through Zotero.FileStore and its access gate
		for (let as of ["text", "bytes", "base64"]) {
			assert.equal((await readClipboard(FILE_FLAVOR, as)).error.code, Zotero.ClipboardController.errorCodes.INVALID_PARAMS, as);
		}
	});

	// A paste, even into the plugin's own page, hands over the file on the clipboard
	it("should place only a file the plugin may read", async function () {
		plugin.load(["default", "clipboardRead", "clipboardWrite"]);
		let { INVALID_PARAMS, PERMISSION_DENIED } = Zotero.ClipboardController.errorCodes;
		let outside = PluginFileAccess.canonicalize(PathUtils.join(await getTempDirectory(), "outside.txt"));
		await FileIO.writeUTF8(outside, "outside");
		try {
			assert.isTrue((await writeClipboard({ "text/plain": "before" })).success);
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[outside, { mode: "deny" }]]), true);
			assert.equal((await writeClipboard({ [FILE_FLAVOR]: outside })).error.code, PERMISSION_DENIED);
			assert.equal((await readClipboard("text/plain")).result.data, "before", "the clipboard is left as it was");
			assert.equal((await writeClipboard({ [FILE_FLAVOR]: "relative.txt" })).error.code, INVALID_PARAMS);

			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[outside, { mode: "read" }]]), true);
			let placed = await writeClipboard({ [FILE_FLAVOR]: outside });
			assert.isTrue(placed.success, placed.error && placed.error.message);
			assert.equal((await readClipboard(FILE_FLAVOR)).result.data, outside);
		}
		finally {
			Zotero.Prefs.clear(PREF_PREFIX + plugin.uuid, true);
		}
	});

	// The core reader and writer are stubbed, so no file lands on the clipboard
	it("should hand a file flavor out as a canonical path and take one back", async function () {
		plugin.load(["default", "clipboardRead", "clipboardWrite"]);
		let canonical = await ownFile("OnClipboard.txt", "");
		let native = PathIdentity.toNative(canonical);
		let reader = sinon.stub(Zotero.Utilities.Internal, "getClipboard").returns(native);
		let writer = sinon.stub(Zotero.Utilities.Internal, "copyToClipboard");
		try {
			let read = await plugin.eval(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)} })`);
			assert.equal(read.result.data, canonical);
			assert.deepEqual(reader.lastCall.args, [FILE_FLAVOR, "path"]);
			let written = await plugin.eval(`Zotero.ClipboardController.command("write", { data: { ${JSON.stringify(FILE_FLAVOR)}: ${JSON.stringify(canonical)}, "text/plain": "x" } })`);
			assert.isTrue(written.success, written.error && written.error.message);
			assert.equal(writer.lastCall.args[0][FILE_FLAVOR], native);
			assert.equal(writer.lastCall.args[0]["text/plain"], "x");
		}
		finally {
			reader.restore();
			writer.restore();
		}
	});
});
