describe("Zotero.ClipboardController", function () {
	var plugin = usePluginSandbox();
	var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

	const FILE_FLAVOR = "application/x-moz-file";

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

	it("should write text and a file and read them back, a file as its path or bytes", async function () {
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
		let file = PluginFileAccess.canonicalize(PathUtils.join(await getTempDirectory(), "on-clipboard-" + Zotero.Utilities.randomString() + ".txt"));
		await FileIO.writeUTF8(file, "file bytes");
		let placed = await plugin.eval(`Zotero.ClipboardController.command("write", { data: { ${JSON.stringify(FILE_FLAVOR)}: ${JSON.stringify(file)} } })`);
		assert.isTrue(placed.success, placed.error && placed.error.message);
		flavors = await plugin.eval('Zotero.ClipboardController.query("flavors")');
		assert.include(Array.from(flavors.result.flavors), FILE_FLAVOR);
		let path = await plugin.eval(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)} })`);
		assert.equal(path.result.data, file);
		// Read as a plain array in the sandbox, since a typed array is not readable over Xrays
		let bytes = await plugin.eval(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)}, as: "bytes" })`
			+ ".then(r => Array.from(r.result.data))");
		assert.equal(new TextDecoder().decode(new Uint8Array(Array.from(bytes))), "file bytes");
		let bad = await plugin.eval(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)}, as: "base64" })`);
		assert.equal(bad.error.code, Zotero.ClipboardController.errorCodes.INVALID_PARAMS);
	});

	// The core reader and writer are stubbed, so no file lands on the clipboard
	it("should hand a file flavor out as a canonical path and take one back", async function () {
		plugin.load(["default", "clipboardRead", "clipboardWrite"]);
		let native = PathUtils.join(await getTempDirectory(), "OnClipboard.txt");
		let canonical = PluginFileAccess.canonicalize(native);
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
