describe("Plugin Sandbox", function () {
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
	var { PluginFileAccess, PersistedGrantLayer } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
	var { PathIdentity } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/filePath.mjs");
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var { ScopeUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
	var { ScopeVariables } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/variables.mjs");
	var { PluginProtocol } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/protocol.mjs");
	var { getByID } = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/uuid.mjs"
	).PluginUUID;
	var {
		get: getName,
		list: listNames,
		forget: forgetName,
	} = ChromeUtils.importESModule(
		"chrome://zotero/content/xpcom/plugins/names.mjs"
	).PluginNames;

	var PREF_PREFIX = "extensions.zotero.pluginFileAccess.";

	var ADDON_ID = "test-sandbox@zotero.org";

	var mockAddon;
	var scope;

	// AddonManager's per-addon sync identifier. Distinct from the plugin's
	// derived UUID below; kept on the mock for API completeness only.
	var SYNC_GUID = "{00000000-0000-0000-0000-000000000001}";
	// Deterministic UUID the sandbox uses for plugin-scoped paths and prefs.
	var PLUGIN_UUID = getByID(ADDON_ID);

	function createMockAddon(permissions = ["default"], origins = [], prefPrefixes = []) {
		return createMockPlugin({
			id: ADDON_ID,
			name: "Test Sandbox Plugin",
			syncGUID: SYNC_GUID,
			permissions,
			origins,
			prefPermissions: prefPrefixes,
		});
	}

	function evalInScope(code) {
		return Cu.evalInSandbox(code, scope);
	}

	// Endpoints registered on the local Zotero API server during a test, torn
	// down in afterEach so HTTP/file-URL tests don't leak handlers.
	var serverEndpoints = [];

	function registerServerEndpoint(method, initFn) {
		let endpoint = "/test/plugin-sandbox/" + Zotero.Utilities.randomString();
		let handler = function () {};
		handler.prototype = {
			supportedMethods: [method],
			supportedDataTypes: "*",
			init(options) {
				return initFn(options);
			}
		};
		Zotero.Server.Endpoints[endpoint] = handler;
		serverEndpoints.push(endpoint);
		return "http://127.0.0.1:" + Zotero.Server.port + endpoint;
	}

	before(async function () {
		await Zotero.initializationPromise;
	});

	afterEach(function () {
		try {
			PluginSandbox.unloadScope(ADDON_ID);
		}
		catch (e) {}
		for (let ep of serverEndpoints) {
			delete Zotero.Server.Endpoints[ep];
		}
		serverEndpoints = [];
	});

	function loadTestScope(permissions, origins, prefPrefixes) {
		mockAddon = createMockAddon(permissions, origins, prefPrefixes);
		PluginSandbox.loadScope(mockAddon);
		scope = PluginSandbox.getScope(ADDON_ID);
	}

	describe("Plugin name persistence", function () {
		const PLUGIN_NAME_PREF = "extensions.zotero.pluginNames." + PLUGIN_UUID;

		afterEach(function () {
			Zotero.Prefs.clear(PLUGIN_NAME_PREF, true);
		});

		it("records the plugin name on load, keyed by UUID", function () {
			loadTestScope(["default"]);
			assert.equal(getName(PLUGIN_UUID), "Test Sandbox Plugin");
		});

		it("the recorded name survives unloading the plugin", function () {
			loadTestScope(["default"]);
			PluginSandbox.unloadScope(ADDON_ID);
			// Name still recoverable -- chrome UI can show it for orphan dirs
			assert.equal(getName(PLUGIN_UUID), "Test Sandbox Plugin");
		});

		it("listNames includes the loaded plugin", function () {
			loadTestScope(["default"]);
			let names = listNames();
			let entry = names.find(n => n.uuid === PLUGIN_UUID);
			assert.ok(entry, "loaded plugin should appear in the recorded list");
			assert.equal(entry.name, "Test Sandbox Plugin");
		});

		it("returns null for unknown UUIDs", function () {
			assert.isNull(getName("00000000-0000-0000-0000-000000000000"));
		});

		it("forgetName removes the entry", function () {
			loadTestScope(["default"]);
			assert.equal(getName(PLUGIN_UUID), "Test Sandbox Plugin");
			forgetName(PLUGIN_UUID);
			assert.isNull(getName(PLUGIN_UUID));
		});
	});


	describe("Scope creation", function () {
		it("should create an unprivileged scope with default permissions", function () {
			loadTestScope(["default"]);
			assert.ok(scope);
			assert.isTrue(evalInScope("typeof Zotero === 'object'"));
		});

		it("should expose PERMISSIONS in the scope", function () {
			loadTestScope(["default"]);
			let perms = evalInScope("PERMISSIONS");
			assert.include(Array.from(perms), "default");
		});

		it("should expose the expected base globals (timers, console, web APIs)", function () {
			loadTestScope(["default"]);
			let fns = [
				"setTimeout",
				"clearTimeout",
				"setInterval",
				"clearInterval",
				"requestIdleCallback",
				"cancelIdleCallback",
				"console.log",
				"console.warn",
				"console.error",
				"atob",
				"btoa",
				"Blob",
				"DOMParser",
				"fetch",
				"TextDecoder",
				"TextEncoder",
				"URL",
				"URLSearchParams",
				"XMLHttpRequest",
			];
			for (let fn of fns) {
				assert.equal(evalInScope(`typeof ${fn}`), "function", `${fn} should be a function`);
			}
			assert.equal(evalInScope("typeof console"), "object");
		});

		it("allows eval/Function/fetch/WebAssembly in the sandbox itself (no CSP applies)", function () {
			// Plugin code runs in a Cu.Sandbox (not CSP-gated, unlike its HTML
			// pages), so eval/Function/WebAssembly work and fetch/XHR are exposed.
			loadTestScope(["default"]);
			assert.equal(evalInScope("eval('1 + 1')"), 2, "eval works in the sandbox");
			assert.equal(evalInScope("(new Function('return 2 + 3'))()"), 5, "new Function works in the sandbox");
			assert.equal(evalInScope("typeof fetch"), "function");
			assert.equal(evalInScope("typeof XMLHttpRequest"), "function");
			assert.equal(
				evalInScope("(function(){ new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0])); return 'ok'; })()"),
				"ok", "WebAssembly compiles in the sandbox");
		});

		it("should remember an unloaded plugin's privilege", function () {
			loadTestScope(["default"]);
			PluginSandbox.unloadScope(ADDON_ID);
			assert.isFalse(PluginSandbox.isPrivileged(ADDON_ID));
			assert.isTrue(PluginSandbox.isPrivileged("never-loaded@zotero.org"),
				"an ID that never loaded a scope is first-party");
		});

		it("should always recreate the scope on reload, never reusing", function () {
			PluginSandbox.loadScope(createMockAddon(["default"]));
			let scope1 = PluginSandbox.getScope(ADDON_ID);
			assert.ok(scope1);
			assert.equal(scope1.VERSION, "1.0.0");

			PluginSandbox.loadScope(createMockAddon(["default"]));
			let scope2 = PluginSandbox.getScope(ADDON_ID);
			assert.notStrictEqual(scope2, scope1,
				"an unchanged reload should still recreate the scope");
		});

		it("should facade function-valued properties on plain objects crossing into the scope", function () {
			loadTestScope(["default"]);
			let chromeMarker = { secret: "chrome-only" };
			let chromeObject = {
				data: 42,
				nested: { label: "x" },
				cb: () => chromeMarker,
			};
			scope.__h5test = ScopeUtils._ensureVarInScope(chromeObject, scope);

			// Data round-trips through the per-property build (proves the in-scope
			// object is actually populated and visible to sandbox code).
			assert.equal(evalInScope("__h5test.data"), 42);
			assert.equal(evalInScope("__h5test.nested.label"), "x");

			// The function property is callable...
			assert.equal(evalInScope("typeof __h5test.cb"), "function");
			// ...and it went through ensureCallableInScope rather than being handed
			// over as a raw cloneFunctions-wrapped chrome callable. The facade
			// exports its wrapper as "f"; a raw clone would keep the name "myCb".
			assert.equal(evalInScope("__h5test.cb.name"), "f",
				"function property must be exposed via the controlled callable facade");
			// The facade also facades the call's return value: a plain object comes
			// back as a usable in-scope object, not the raw chrome reference.
			assert.equal(evalInScope("__h5test.cb().secret"), "chrome-only");
			assert.isTrue(evalInScope("__h5test.cb() instanceof Object"),
				"the faceted return should be an in-scope object");
		});
	});

	describe("Zotero Logging APIs", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose logging APIs (debug/warn/logError) without throwing", function () {
			assert.equal(evalInScope("typeof Zotero.debug"), "function");
			assert.equal(evalInScope("typeof Zotero.warn"), "function");
			assert.equal(evalInScope("typeof Zotero.logError"), "function");
			// Calls should not throw
			evalInScope("Zotero.debug('test message from sandbox')");
			evalInScope("Zotero.warn('test warning from sandbox')");
		});
	});

	describe("Zotero General attributes", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose general attributes matching the chrome values", function () {
			let attrs = [
				"version",
				"isBetaBuild",
				"isDevBuild",
				"isSourceBuild",
				"platformVersion",
				"platformMajorVersion",
				"arch",
				"isMac",
				"isWin",
				"isLinux",
			];
			for (let attr of attrs) {
				assert.deepEqual(evalInScope(`Zotero.${attr}`), Zotero[attr], `Zotero.${attr}`);
			}
		});

		it("should not allow setting attributes on Zotero", function () {
			assert.throws(() => evalInScope("Zotero.version = 'hacked'"));
			// Value should be unchanged
			assert.equal(evalInScope("Zotero.version"), Zotero.version);
		});
	});

	describe("Wildcard schema internals", function () {
		it("should not expose underscore-prefixed members of wildcard namespaces", function () {
			loadTestScope(["ui"]);
			// The public API is exposed
			assert.equal(evalInScope("typeof Zotero.MenuManager.registerMenu"), "function");
			// The internals are not
			assert.equal(evalInScope("typeof Zotero.MenuManager._menuManager"), "undefined");
		});
	});

	describe("Zotero Locks", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose lock promises (initialization/uiReady/unlock)", async function () {
			for (let lock of ["initializationPromise", "uiReadyPromise", "unlockPromise"]) {
				assert.ok(evalInScope(`Zotero.${lock}`), lock);
				assert.equal(evalInScope(`typeof Zotero.${lock}.then`), "function", `${lock}.then`);
			}
			await evalInScope("Zotero.initializationPromise");
		});
	});

	describe("Zotero.Utilities", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.Utilities.cleanDOI()", function () {
			assert.equal(evalInScope("Zotero.Utilities.cleanDOI('https://doi.org/10.1234/test')"), '10.1234/test');
			assert.isNotOk(evalInScope("Zotero.Utilities.cleanDOI('not a doi')"));
		});

		it("should expose string helpers (sentenceCase/capitalizeName)", function () {
			assert.equal(
				evalInScope("Zotero.Utilities.sentenceCase('A Title in Title Case')"),
				Zotero.Utilities.sentenceCase('A Title in Title Case'));
			assert.equal(
				evalInScope("Zotero.Utilities.capitalizeName('john smith')"),
				Zotero.Utilities.capitalizeName('john smith'));
		});
	});

	describe("Zotero.Date", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.Date.strToISO()", function () {
			assert.equal(evalInScope("Zotero.Date.strToISO('January 1, 2020')"), '2020-01-01');
			assert.isFalse(evalInScope("Zotero.Date.strToISO('')"));
		});

		it("should not expose unlisted Date methods", function () {
			assert.isTrue(evalInScope("typeof Zotero.Date.sqlToDate === 'undefined'"),
				"sqlToDate should not be exposed");
		});
	});

	describe("Zotero.FileStore", function () {
		var pluginDataDir;
		var outsideDir;
		var outsidePath;

		before(async function () {
			pluginDataDir = PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", PLUGIN_UUID);
			await FileIO.makeDirectory(pluginDataDir, { ignoreExisting: true, createAncestors: true });
			// Lives outside the plugin's auto-allowed directories
			outsideDir = await getTempDirectory();
			outsidePath = PathUtils.join(outsideDir, "outside-" + Zotero.Utilities.randomString() + ".txt");
			await FileIO.writeUTF8(outsidePath, "outside content");
		});

		after(async function () {
			await FileIO.remove(outsidePath, { ignoreAbsent: true });
		});

		beforeEach(function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
			Zotero.Prefs.clear(PREF_PREFIX + PLUGIN_UUID, true);
		});

		afterEach(function () {
			Zotero.Prefs.clear(PREF_PREFIX + PLUGIN_UUID, true);
		});

		function inDataDir(name) {
			return PathUtils.join(pluginDataDir, name + "-" + Zotero.Utilities.randomString() + ".txt");
		}

		function readFile(path) {
			return evalInScope(`Zotero.FileStore.query("readFile", { path: ${JSON.stringify(path)}, encoding: "utf8" })`);
		}

		function writeFile(path, text) {
			return evalInScope(`Zotero.FileStore.commit(`
				+ `Zotero.FileStore.ChangeSet.file(${JSON.stringify(path)}).writeFile(${JSON.stringify(text)}))`);
		}

		// The store's own suite covers the operations; these cover the sandbox boundary and the gate
		it("should write and read a file in the plugin's data directory without a prompt", async function () {
			let target = inDataDir("roundtrip");
			try {
				let written = await writeFile(target, "from the sandbox");
				assert.isTrue(written.success, written.error && written.error.message);
				assert.equal(written.result.objects[0].path, Zotero.File.normalizeToUnix(target));
				let read = await readFile(target);
				assert.isTrue(read.success, read.error && read.error.message);
				assert.equal(read.result.data, "from the sandbox");
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		it("should carry bytes across the boundary as bytes", async function () {
			let target = inDataDir("bytes");
			try {
				let res = await evalInScope(`Zotero.FileStore.commit(`
					+ `Zotero.FileStore.ChangeSet.file(${JSON.stringify(target)}).writeFile(new Uint8Array([0, 255, 10])))`);
				assert.isTrue(res.success, res.error && res.error.message);
				assert.deepEqual(Array.from(await FileIO.read(target)), [0, 255, 10]);
				// A JSON-style entry carries a typed array of any kind too
				res = await evalInScope(`Zotero.FileStore.commit({ changes: [{ type: "file", path: ${JSON.stringify(target)}, `
					+ `ops: [{ op: "appendFile", data: new Uint16Array([0x0201]) }] }] })`);
				assert.isTrue(res.success, res.error && res.error.message);
				assert.deepEqual(Array.from(await FileIO.read(target)), [0, 255, 10, 1, 2]);

				let read = await evalInScope(`Zotero.FileStore.query("readFile", { path: ${JSON.stringify(target)} })`
					+ `.then(r => ({ success: r.success, isBytes: r.result.data instanceof Uint8Array, bytes: Array.from(r.result.data) }))`);
				assert.isTrue(read.success);
				assert.isTrue(read.isBytes, "the sandbox gets a Uint8Array of its own realm");
				assert.deepEqual(Array.from(read.bytes), [0, 255, 10, 1, 2]);
				let base64 = await evalInScope(`Zotero.FileStore.query("readFile", `
					+ `{ path: ${JSON.stringify(target)}, encoding: "base64" })`);
				assert.equal(base64.result.data, btoa("\x00\xff\n\x01\x02"));
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		// Content far past any 32K chunk boundary, checked on the plugin's side of the boundary
		it("should carry large content across the boundary intact", async function () {
			let target = inDataDir("large");
			try {
				let res = await evalInScope(`(async () => {
					let FS = Zotero.FileStore.ChangeSet;
					let path = ${JSON.stringify(target)};
					let text = "中文 mixed ünïcödé 🚀 line\\n".repeat(40000);
					let written = await Zotero.FileStore.commit(FS.file(path).writeFile(text));
					if (!written.success) return { failed: "write text: " + written.error.message };
					let read = await Zotero.FileStore.query("readFile", { path, encoding: "utf8" });
					if (!read.success) return { failed: "read text: " + read.error.message };
					let textIntact = read.result.data === text;
					let bytes = new Uint8Array(8 * 1024 * 1024);
					for (let i = 0; i < bytes.length; i++) {
						bytes[i] = (i * 2654435761) >>> 24;
					}
					written = await Zotero.FileStore.commit(FS.file(path).writeFile(bytes));
					if (!written.success) return { failed: "write bytes: " + written.error.message };
					read = await Zotero.FileStore.query("readFile", { path });
					if (!read.success) return { failed: "read bytes: " + read.error.message };
					let back = read.result.data;
					let mismatches = back.length === bytes.length ? 0 : 1;
					for (let i = 0; i < bytes.length && !mismatches; i++) {
						if (back[i] !== bytes[i]) mismatches++;
					}
					return { textIntact, textLength: text.length, byteLength: back.length, mismatches };
				})()`);
				assert.isUndefined(res.failed, res.failed);
				assert.isTrue(res.textIntact, `text of ${res.textLength} chars came back different`);
				assert.equal(res.byteLength, 8 * 1024 * 1024);
				assert.equal(res.mismatches, 0);
				let onDisk = await FileIO.read(target);
				assert.equal(onDisk.byteLength, 8 * 1024 * 1024);
				assert.equal(onDisk[onDisk.length - 1], ((onDisk.length - 1) * 2654435761) >>> 24);
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		it("should give the sandbox the path helpers and its directories", async function () {
			assert.equal(evalInScope(`Zotero.FileStore.path.join("a/b", "../c", "d.txt")`), "a/c/d.txt");
			assert.equal(evalInScope(`Zotero.FileStore.path.extname("x/y.tar.gz")`), ".gz");
			// Chrome-backed, but a failure is the sandbox's own TypeError
			assert.equal(evalInScope(`(() => { try { Zotero.FileStore.path.dirname(5); return "no throw"; }`
				+ ` catch (e) { return e instanceof TypeError ? "TypeError" : String(e); } })()`), "TypeError");
			let dirs = await evalInScope(`Zotero.FileStore.query("dirs")`);
			assert.equal(dirs.result.data, Zotero.File.normalizeToUnix(pluginDataDir));
			assert.include(dirs.result.temp, PLUGIN_UUID);
		});

		it("should write to the plugin's temp directory without a session", async function () {
			let dirs = await evalInScope(`Zotero.FileStore.query("dirs")`);
			let target = dirs.result.temp + "/in-temp-" + Zotero.Utilities.randomString() + ".txt";
			let res = await writeFile(target, "temp");
			assert.isTrue(res.success, res.error && res.error.message);
			assert.equal(await FileIO.readUTF8(target), "temp");
		});

		it("should hand out picker paths in the canonical spelling", async function () {
			loadTestScope(["default", "fileSystemRead"]);
			let { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
			let native = PathUtils.join(outsideDir, "Picked.txt");
			let canonical = PluginFileAccess.canonicalize(native);
			let picked = [native, PathUtils.join(outsideDir, "Other.txt")];
			let next = 0;
			evalInScope("var _pk = new FilePicker();");
			let picker = VarCheck.getOriginalOrSelf(scope._pk);
			picker._fp = {
				file: { path: native },
				files: { hasMoreElements: () => next < picked.length, getNext: () => ({ QueryInterface() {}, path: picked[next++] }) },
				displayDirectory: null,
			};
			assert.equal(evalInScope("_pk.file"), canonical);
			assert.deepEqual(Array.from(evalInScope("_pk.files")), picked.map(p => PluginFileAccess.canonicalize(p)));
			evalInScope(`_pk.displayDirectory = ${JSON.stringify(PluginFileAccess.canonicalize(outsideDir))}`);
			assert.equal(picker._fp.displayDirectory.path, outsideDir);
			assert.equal(evalInScope("_pk.displayDirectory"), PluginFileAccess.canonicalize(outsideDir));
		});

		// Storage sits in the forbidden data directory, so a missing grant fails at once rather than prompting
		it("should reach an attachment's file through the data store, read with dataRead and write with dataWrite", async function () {
			let attachment = await importFileAttachment("test.txt");
			try {
				loadTestScope(["default", "dataRead", "fileSystemRead", "fileSystemWrite"]);
				let file = await evalInScope(`Zotero.DataStore.query("file", { itemID: ${attachment.id} })`);
				assert.isTrue(file.success, file.error && file.error.message);
				assert.isTrue(file.result.exists);
				assert.equal(file.result.path, PluginFileAccess.canonicalize(await attachment.getFilePathAsync()));
				let read = await readFile(file.result.path);
				assert.isTrue(read.success, read.error && read.error.message);
				assert.equal(read.result.data, await FileIO.readUTF8(file.result.path));
				let write = await writeFile(file.result.path, "changed");
				assert.isFalse(write.success);
				assert.equal(write.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);

				loadTestScope(["default", "dataWrite", "fileSystemRead", "fileSystemWrite"]);
				file = await evalInScope(`Zotero.DataStore.query("file", { itemID: ${attachment.id} })`);
				write = await writeFile(file.result.path, "changed");
				assert.isTrue(write.success, write.error && write.error.message);
				assert.equal(await FileIO.readUTF8(file.result.path), "changed");
			}
			finally {
				await attachment.eraseTx();
			}
		});

		it("should grant only read on an attachment the user cannot edit, whatever the permissions", async function () {
			let group = await createGroup();
			let attachment = await importFileAttachment("test.txt", { libraryID: group.libraryID });
			group.editable = false;
			group.filesEditable = false;
			await group.saveTx();
			try {
				loadTestScope(["default", "dataWrite", "fileSystemRead", "fileSystemWrite"]);
				let file = await evalInScope(`Zotero.DataStore.query("file", { itemID: ${attachment.id} })`);
				assert.isTrue(file.success, file.error && file.error.message);
				let read = await readFile(file.result.path);
				assert.isTrue(read.success, read.error && read.error.message);
				let write = await writeFile(file.result.path, "changed");
				assert.isFalse(write.success);
				assert.equal(write.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
			}
			finally {
				await group.eraseTx();
			}
		});

		// A deny on the directory answers a prompt at once, so a missing grant fails instead of waiting
		it("should resolve a linked file stored relative to the base directory", async function () {
			let base = await getTempDirectory();
			let target = PathUtils.join(base, "linked-" + Zotero.Utilities.randomString() + ".txt");
			await FileIO.writeUTF8(target, "linked");
			let prefs = { baseAttachmentPath: Zotero.Prefs.get("baseAttachmentPath"), saveRelativeAttachmentPath: Zotero.Prefs.get("saveRelativeAttachmentPath") };
			Zotero.Prefs.set("baseAttachmentPath", base);
			Zotero.Prefs.set("saveRelativeAttachmentPath", true);
			let attachment = await Zotero.Attachments.linkFromFile({ file: target });
			Zotero.Prefs.set(PREF_PREFIX + PLUGIN_UUID, JSON.stringify([[PluginFileAccess.canonicalize(base), { mode: "deny" }]]), true);
			try {
				assert.isTrue(attachment.attachmentPath.startsWith("attachments:"));
				loadTestScope(["default", "dataRead", "fileSystemRead"]);
				let item = await evalInScope(`Zotero.DataStore.query("item", { itemID: ${attachment.id} })`);
				assert.isTrue(item.result.data.path.startsWith("attachments:"));
				let file = await evalInScope(`Zotero.DataStore.query("file", { itemID: ${attachment.id} })`);
				assert.equal(file.result.path, PluginFileAccess.canonicalize(target));
				let read = await readFile(file.result.path);
				assert.isTrue(read.success, read.error && read.error.message);
				assert.equal(read.result.data, "linked");
			}
			finally {
				await attachment.eraseTx();
				for (let [pref, value] of Object.entries(prefs)) {
					if (value === undefined) {
						Zotero.Prefs.clear(pref);
					}
					else {
						Zotero.Prefs.set(pref, value);
					}
				}
			}
		});

		// Where a path leads is simulated, so a link out of plugin-data needs no link on this file system
		it("should judge a path by where it really leads, not by how it is spelled", async function () {
			let spelledInside = inDataDir("looks-inside");
			let spelledOutside = PathUtils.join(outsideDir, "looks-outside-" + Zotero.Utilities.randomString() + ".txt");
			let realInside = PluginFileAccess._realPath(PluginFileAccess.canonicalize(inDataDir("really-inside")));
			let stub = sinon.stub(PluginFileAccess, "_realPath").callsFake(function (p) {
				let canonical = Zotero.File.normalizeToUnix(p);
				if (canonical === Zotero.File.normalizeToUnix(spelledInside)) {
					return Zotero.File.normalizeToUnix(outsidePath);
				}
				if (canonical === Zotero.File.normalizeToUnix(spelledOutside)) {
					return realInside;
				}
				return stub.wrappedMethod(p);
			});
			try {
				let escape = await readFile(spelledInside);
				assert.isFalse(escape.success);
				assert.equal(escape.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
				// Allowed by the gate, so the store gets as far as looking for the file
				let reach = await readFile(spelledOutside);
				assert.isFalse(reach.success);
				assert.equal(reach.error.code, Zotero.FileStore.errorCodes.NOT_FOUND);
			}
			finally {
				stub.restore();
			}
		});

		it("should compare paths without regard to case where the default file system ignores it", function () {
			let was = { isWin: Zotero.isWin, isMac: Zotero.isMac };
			try {
				Zotero.isWin = false;
				Zotero.isMac = false;
				assert.isFalse(PathIdentity.same("/A/b", "/a/b"));
				assert.isFalse(PathIdentity.contains("/A", "/a/b"));
				assert.isFalse(PersistedGrantLayer.subsumes({ path: "/A", mode: "read" }, { path: "/a/b", mode: "read" }));
				Zotero.isMac = true;
				assert.isTrue(PathIdentity.same("/A/b", "/a/b"));
				assert.isTrue(PathIdentity.contains("/Users/X", "/users/x/doc.txt"));
				Zotero.isWin = true;
				assert.isTrue(PathIdentity.same("C:/A/b", "c:/a/B"));
				assert.isTrue(PathIdentity.contains("C:/Users/X", "c:/users/x/doc.txt"));
				assert.isFalse(PathIdentity.contains("C:/Users/X", "c:/users/xy/doc.txt"));
				assert.isTrue(PersistedGrantLayer.subsumes({ path: "C:/Users/X", mode: "write" }, { path: "c:/users/x/doc.txt", mode: "read" }));
			}
			finally {
				Object.assign(Zotero, was);
			}
		});

		// A real link, so the walk itself runs; Windows needs a privilege to make one
		it("should follow a symlink out of plugin-data and refuse one that leads nowhere", async function () {
			if (Zotero.isWin) {
				this.skip();
			}
			let link = inDataDir("link-out");
			let dangling = inDataDir("link-nowhere");
			let nowhere = PathUtils.join(outsideDir, "never-" + Zotero.Utilities.randomString() + ".txt");
			await Zotero.Utilities.Internal.subprocess("ln", ["-s", outsidePath, link]);
			await Zotero.Utilities.Internal.subprocess("ln", ["-s", nowhere, dangling]);
			try {
				let escape = await readFile(link);
				assert.isFalse(escape.success);
				assert.equal(escape.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
				let through = await writeFile(dangling, "x");
				assert.isFalse(through.success);
				assert.equal(through.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
				assert.isFalse(await FileIO.exists(nowhere));
			}
			finally {
				await Zotero.Utilities.Internal.subprocess("rm", ["-f", link, dangling]);
			}
		});

		it("should see through a junction on Windows", async function () {
			if (!Zotero.isWin) {
				this.skip();
			}
			// A junction needs no privilege, which is what makes it the escape to catch
			let base = await getTempDirectory();
			let target = PathUtils.join(base, "target");
			let junction = PathUtils.join(base, "junction");
			await IOUtils.makeDirectory(target);
			// Subprocess does not search PATH here
			let cmd = Services.env.get("COMSPEC") || "C:\\Windows\\System32\\cmd.exe";
			let made = await Zotero.Utilities.Internal.subprocess(cmd, ["/c", "mklink", "/J", junction, target]);
			try {
				assert.isTrue(await IOUtils.exists(junction), `mklink via ${cmd} said: ${made}`);
				// Windows stores the target's long name in the junction, so the resolved path is compared by
				// shape: a short-name spelling of the temp dir would not match it letter for letter
				let throughJunction = PathIdentity.realPath(PathIdentity.canonicalize(PathUtils.join(junction, "inside.txt")));
				assert.notInclude(throughJunction, "/junction/", "the junction should be seen through");
				assert.isTrue(throughJunction.endsWith("/target/inside.txt"), throughJunction);
			}
			finally {
				await Zotero.Utilities.Internal.subprocess(cmd, ["/c", "rmdir", junction]);
			}
		});

		it("should refuse a read outside plugin-data without a grant", async function () {
			let res = await readFile(outsidePath);
			assert.isFalse(res.success);
			assert.equal(res.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
		});

		it("should refuse a write outside plugin-data without a grant, writing nothing", async function () {
			let target = PathUtils.join(outsideDir, "no-write-" + Zotero.Utilities.randomString() + ".txt");
			let res = await writeFile(target, "denied");
			assert.isFalse(res.success);
			assert.equal(res.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
			assert.isFalse(await FileIO.exists(target), "no file should have been written");
		});

		it("should refuse access to the profile and to the data directory outside plugin-data", async function () {
			for (let target of [
				PathUtils.join(PathUtils.profileDir, "prefs.js"),
				PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite"),
			]) {
				let res = await evalInScope(`Zotero.FileStore.query("access", { path: ${JSON.stringify(target)} })`);
				assert.isFalse(res.success, target);
				assert.equal(res.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
			}
		});

		it("should honor a persisted read grant and a persisted deny", async function () {
			Zotero.Prefs.set(PREF_PREFIX + PLUGIN_UUID, JSON.stringify([[outsidePath, { mode: "read" }]]), true);
			let read = await readFile(outsidePath);
			assert.isTrue(read.success, read.error && read.error.message);
			assert.equal(read.result.data, "outside content");

			// A deny on the outer directory covers the file
			Zotero.Prefs.set(PREF_PREFIX + PLUGIN_UUID, JSON.stringify([[outsideDir, { mode: "deny" }]]), true);
			let denied = await evalInScope(`Zotero.FileStore.query("access", { path: ${JSON.stringify(outsidePath)} })`);
			assert.isFalse(denied.success);
			assert.equal(denied.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
		});

		it("should cover a write with a session grant only while the session lasts", async function () {
			let target = PathUtils.join(outsideDir, "session-write-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// Mirrors FilePicker.show()'s addSessionGrant after modeSave
					PluginFileAccess.addSessionGrant(ADDON_ID, target, "write");
					let res = await writeFile(target, "session payload");
					assert.isTrue(res.success, res.error && res.error.message);
				});
				assert.equal(await FileIO.readUTF8(target), "session payload");
				let after = await readFile(target);
				assert.isFalse(after.success, "the grant is gone with the session");
				assert.equal(after.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		it("should expose withSession, which rejects when chrome times the session out", async function () {
			// The sandbox's withSession omits the options arg so a plugin cannot extend the timeout; stub the
			// chrome side with a tight one and have the sandbox fn outlast it
			let original = PluginFileAccess.withSession;
			PluginFileAccess.withSession = (pluginID, fn) => original.call(PluginFileAccess, pluginID, fn, { timeout: 50 });
			try {
				let threw = await evalInScope(`Zotero.FileStore.withSession(async () => {
					await new Promise(r => setTimeout(r, 300));
				}).then(() => false, () => true)`);
				assert.isTrue(threw, "withSession should reject when chrome times out the session");
			}
			finally {
				PluginFileAccess.withSession = original;
			}
		});

		it("should not expose commit without fileSystemWrite, nor the store without fileSystemRead", function () {
			loadTestScope(["default", "fileSystemRead"]);
			assert.equal(evalInScope("typeof Zotero.FileStore.query"), "function");
			assert.equal(evalInScope("typeof Zotero.FileStore.ChangeSet"), "function");
			assert.equal(evalInScope("typeof Zotero.FileStore.withSession"), "function");
			assert.equal(evalInScope("typeof Zotero.FileStore.commit"), "undefined");
			loadTestScope(["default"]);
			assert.equal(evalInScope("typeof Zotero.FileStore"), "undefined");
			// The pure helpers stay in the default schema
			assert.equal(evalInScope("typeof Zotero.File.getExtension"), "function");
		});
	});


	describe("FilePicker session grants", function () {
		var pickedFile;
		var pickedDir;

		before(async function () {
			let scratch = await getTempDirectory();
			pickedDir = PathUtils.join(scratch, "picked-dir-" + Zotero.Utilities.randomString());
			await FileIO.makeDirectory(pickedDir);
			pickedFile = PathUtils.join(pickedDir, "picked.txt");
			await FileIO.writeUTF8(pickedFile, "picked content");
		});

		after(async function () {
			await FileIO.remove(pickedDir, { recursive: true, ignoreAbsent: true });
		});

		beforeEach(function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
		});

		function readFile(path) {
			return evalInScope(`Zotero.FileStore.query("readFile", { path: ${JSON.stringify(path)}, encoding: "utf8" })`);
		}

		function writeFile(path, text) {
			return evalInScope(`Zotero.FileStore.commit(`
				+ `Zotero.FileStore.ChangeSet.file(${JSON.stringify(path)}).writeFile(${JSON.stringify(text)}))`);
		}

		it("does not expose FilePicker without fileSystemRead", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof FilePicker === 'undefined' || FilePicker === undefined"));
		});

		// FilePicker.show() opens a native OS dialog, so we don't drive the
		// full UI flow from a test. Instead, simulate what each return path
		// does -- on returnOK/returnReplace, FilePicker.show calls
		// PluginFileAccess.addSessionGrant for the picked path with the
		// mode-appropriate access -- and verify the plugin can then access
		// the path from inside the same session.

		it("modeOpen grant gives the plugin read access to the picked file", async function () {
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				PluginFileAccess.addSessionGrant(ADDON_ID, pickedFile, "read");
				let read = await readFile(pickedFile);
				assert.isTrue(read.success, read.error && read.error.message);
				assert.equal(read.result.data, "picked content");
			});
		});

		it("modeSave grant gives the plugin write access to the chosen destination", async function () {
			let target = PathUtils.join(pickedDir, "saved-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					PluginFileAccess.addSessionGrant(ADDON_ID, target, "write");
					let res = await writeFile(target, "saved");
					assert.isTrue(res.success, res.error && res.error.message);
				});
				assert.equal(await FileIO.readUTF8(target), "saved");
			}
			finally {
				await FileIO.remove(target, { ignoreAbsent: true });
			}
		});

		it("modeGetFolder grant covers everything inside the picked folder", async function () {
			let inner = PathUtils.join(pickedDir, "inside-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// Folder picker with fileSystemWrite -> write grant on the dir
					PluginFileAccess.addSessionGrant(ADDON_ID, pickedDir, "write");
					let res = await writeFile(inner, "in folder");
					assert.isTrue(res.success, res.error && res.error.message);
					let read = await readFile(inner);
					assert.equal(read.result.data, "in folder");
				});
			}
			finally {
				await FileIO.remove(inner, { ignoreAbsent: true });
			}
		});

		it("modeOpenMultiple grant covers each picked file independently", async function () {
			let extra = PathUtils.join(pickedDir, "extra.txt");
			await FileIO.writeUTF8(extra, "extra content");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// FilePicker.show() iterates `this.files` and grants read on each.
					PluginFileAccess.addSessionGrant(ADDON_ID, pickedFile, "read");
					PluginFileAccess.addSessionGrant(ADDON_ID, extra, "read");
					assert.equal((await readFile(pickedFile)).result.data, "picked content");
					assert.equal((await readFile(extra)).result.data, "extra content");
				});
			}
			finally {
				await FileIO.remove(extra, { ignoreAbsent: true });
			}
		});

		it("picker grant does not bleed across sessions", async function () {
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				PluginFileAccess.addSessionGrant(ADDON_ID, pickedFile, "read");
			});
			// Outside the session, reads should be rejected again.
			let res = await readFile(pickedFile);
			assert.isFalse(res.success);
			assert.equal(res.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
		});

		it("a cancelled picker (no addSessionGrant call) leaves the path unreachable", async function () {
			// returnCancel is the path where FilePicker.show simply returns
			// without calling addSessionGrant; the file should stay denied.
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				let res = await readFile(pickedFile);
				assert.isFalse(res.success);
				assert.equal(res.error.code, Zotero.FileStore.errorCodes.PERMISSION_DENIED);
			});
		});
	});


	describe("Zotero.HTTP", function () {
		beforeEach(function () {
			loadTestScope(["default"], ["*://127.0.0.1/*"]);
		});

		it("should make a GET request and return status and response text", async function () {
			let url = registerServerEndpoint("GET", function () {
				return [200, "text/plain", "sandbox GET response"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
			assert.equal(result.status, 200);
			assert.equal(result.text, "sandbox GET response");
		});

		it("should make a POST request with a JSON body", async function () {
			let receivedData;
			let url = registerServerEndpoint("POST", function (options) {
				// Server auto-parses JSON bodies
				receivedData = options.data;
				return [201, "text/plain", "created"];
			});

			let status = await evalInScope(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: 'from sandbox' }),
					responseType: 'text'
				}).then(req => req.status)
			`);
			assert.equal(status, 201);
			assert.equal(receivedData.message, 'from sandbox');
		});

		it("should send custom headers with the request", async function () {
			let receivedHeaders;
			let url = registerServerEndpoint("GET", function (options) {
				receivedHeaders = options.headers;
				return [200, "text/plain", "ok"];
			});

			await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					headers: { 'X-Custom-Header': 'sandbox-test-value' },
					responseType: 'text'
				})
			`);
			assert.equal(receivedHeaders['X-Custom-Header'], 'sandbox-test-value');
		});

		it("should handle JSON response type", async function () {
			let url = registerServerEndpoint("GET", function () {
				return [200, "application/json", JSON.stringify({ key: "value", num: 42 })];
			});

			let response = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'json'
				}).then(req => req.response)
			`);
			assert.equal(response.key, "value");
			assert.equal(response.num, 42);
		});

		it("should handle non-200 success status codes", async function () {
			let url = registerServerEndpoint("GET", function () {
				return 204;
			});

			let status = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => req.status)
			`);
			assert.equal(status, 204);
		});

		it("should reject on error status codes", async function () {
			let url = registerServerEndpoint("GET", function () {
				return [400, "text/plain", "bad request"];
			});

			let rejected = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(() => false, () => true)
			`);
			assert.isTrue(rejected, "Request with 400 status should reject");
		});

		it("should accept successCodes option to treat non-2xx as success", async function () {
			let url = registerServerEndpoint("GET", function () {
				return [404, "text/plain", "not found"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text',
					successCodes: [404]
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
			assert.equal(result.status, 404);
			assert.equal(result.text, "not found");
		});

		it("should POST JSON body and receive JSON response", async function () {
			let receivedData;
			let url = registerServerEndpoint("POST", function (options) {
				receivedData = options.data;
				return [200, "application/json", JSON.stringify({ received: true })];
			});

			let response = await evalInScope(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Test', count: 3 }),
					responseType: 'json'
				}).then(req => req.response)
			`);
			assert.isTrue(response.received);
			assert.equal(receivedData.title, 'Test');
			assert.equal(receivedData.count, 3);
		});

		it("should fetch and process an HTML document with processDocuments()", async function () {
			let url = registerServerEndpoint("GET", function () {
				return [200, "text/html", "<html><head><title>Sandbox Doc</title></head><body><p>Hello</p></body></html>"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.processDocuments(${JSON.stringify(url)}, function (doc, responseURL) {
					return responseURL;
				}).then(results => results[0])
			`);
			assert.include(result, "/test/plugin-sandbox/");
		});

		describe("network access control", function () {
			it("should block requests to origins not in host_permissions via CORS", async function () {
				// Unload existing scope (created by parent beforeEach with 127.0.0.1 origins)
				// and recreate with empty origins to test CORS enforcement
				PluginSandbox.unloadScope(ADDON_ID);
				loadTestScope(["default"], []);

				let url = registerServerEndpoint("GET", function () {
					return [200, "text/plain", "should not reach here"];
				});

				let rejected = await evalInScope(`
					Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
						responseType: 'text'
					}).then(() => false, () => true)
				`);
				assert.isTrue(rejected,
					"Request to undeclared origin should be blocked by CORS");
			});

			it("should allow requests when origin is in host_permissions", async function () {
				// Parent beforeEach already creates scope with *://127.0.0.1/*
				let url = registerServerEndpoint("GET", function () {
					return [200, "text/plain", "allowed"];
				});

				let result = await evalInScope(`
					Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
						responseType: 'text'
					}).then(req => req.responseText)
				`);
				assert.equal(result, "allowed");
			});
		});
	});

	describe("Zotero.Notifier", function () {
		// Register a sentinel observer on the chrome side with lower priority (higher number)
		// so it runs AFTER the sandbox observer. Awaiting the returned promise guarantees
		// all higher-priority observers (including the sandbox one) have finished.
		function waitForNotify(types) {
			return new Promise((resolve) => {
				let id = Zotero.Notifier.registerObserver(
					{
						notify: function () {
							// Unregister immediately so it only fires once
							Zotero.Notifier.unregisterObserver(id);
							resolve();
						}
					},
					types,
					'test-sentinel',
					200 // lower priority than default 100, runs after sandbox observer
				);
			});
		}

		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		afterEach(function () {
			// Clean up any leftover observers
			try {
				let id = evalInScope("typeof _observerID !== 'undefined' && _observerID");
				if (id) {
					Zotero.Notifier.unregisterObserver(id);
				}
			}
			// eslint-disable-next-line no-unused-vars
			catch (e) {}
		});

		it("should receive notifications when an item is added", async function () {
			evalInScope(`
				var _notifyEvent = null;
				var _notifyType = null;
				var _notifyFirstID = null;
				var _notifyIDsLength = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids, extraData) {
							_notifyEvent = event;
							_notifyType = type;
							_notifyIDsLength = ids.length;
							_notifyFirstID = ids[0];
						}
					},
					['item'],
					'test-sandbox-add'
				);
			`);

			let promise = waitForNotify(['item']);
			let item = new Zotero.Item('book');
			item.setField('title', 'Notifier Test Book');
			await item.saveTx();
			await promise;

			assert.equal(evalInScope("_notifyEvent"), 'add');
			assert.equal(evalInScope("_notifyType"), 'item');
			assert.isAbove(evalInScope("_notifyIDsLength"), 0, "ids should have length");
			assert.equal(evalInScope("_notifyFirstID"), item.id, "ids should contain the item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should receive notifications when an item is modified", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Before Modify');
			await item.saveTx();

			evalInScope(`
				var _modifyFirstID = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							if (event === 'modify') {
								_modifyFirstID = ids[0];
							}
						}
					},
					['item'],
					'test-sandbox-modify'
				);
			`);

			let promise = waitForNotify(['item']);
			item.setField('title', 'After Modify');
			await item.saveTx();
			await promise;

			assert.equal(evalInScope("_modifyFirstID"), item.id, "Should have received modify event with item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should receive notifications when an item is trashed", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Trash Test');
			await item.saveTx();

			evalInScope(`
				var _trashFirstID = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							if (event === 'trash') {
								_trashFirstID = ids[0];
							}
						}
					},
					['item'],
					'test-sandbox-trash'
				);
			`);

			let promise = waitForNotify(['item']);
			item.deleted = true;
			await item.saveTx();
			await promise;

			assert.equal(evalInScope("_trashFirstID"), item.id, "Should have received trash event with item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should only receive notifications for subscribed types", async function () {
			evalInScope(`
				var _collectionNotified = false;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							_collectionNotified = true;
						}
					},
					['collection'],
					'test-sandbox-type-filter'
				);
			`);

			// Create an item -- should NOT trigger the collection observer
			// Use a sentinel on 'item' to know when item notifications are done
			let itemPromise = waitForNotify(['item']);
			let item = new Zotero.Item('book');
			await item.saveTx();
			await itemPromise;

			assert.isFalse(evalInScope("_collectionNotified"), "Item add should not trigger collection observer");

			// Create a collection -- should trigger it
			let collectionPromise = waitForNotify(['collection']);
			let collection = new Zotero.Collection();
			collection.name = "Notifier Type Filter Test";
			await collection.saveTx();
			await collectionPromise;

			assert.isTrue(evalInScope("_collectionNotified"), "Collection add should trigger collection observer");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should not receive notifications after unregistering", async function () {
			evalInScope(`
				var _postUnregCount = 0;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							_postUnregCount++;
						}
					},
					['item'],
					'test-sandbox-unreg'
				);
			`);

			// Create an item -- should trigger
			let promise1 = waitForNotify(['item']);
			let item1 = new Zotero.Item('book');
			await item1.saveTx();
			await promise1;
			let countBefore = evalInScope("_postUnregCount");
			assert.isAbove(countBefore, 0);

			// Unregister
			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			evalInScope("_postUnregCount = 0");

			// Create another item -- should NOT trigger
			// Use sentinel to ensure notifications have been fully dispatched
			let promise2 = waitForNotify(['item']);
			let item2 = new Zotero.Item('book');
			await item2.saveTx();
			await promise2;

			assert.equal(evalInScope("_postUnregCount"), 0, "Should not receive notifications after unregistering");

			await item1.eraseTx();
			await item2.eraseTx();
		});

		it("should receive extraData in notifications", async function () {
			evalInScope(`
				var _deleteExtra = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids, extraData) {
							if (event === 'delete') {
								_deleteExtra = extraData;
							}
						}
					},
					['item'],
					'test-sandbox-extra'
				);
			`);

			let item = new Zotero.Item('book');
			item.setField('title', 'ExtraData Test');
			await item.saveTx();
			let itemID = item.id;

			let promise = waitForNotify(['item']);
			await item.eraseTx();
			await promise;

			let hasExtra = evalInScope("!!_deleteExtra");
			assert.ok(hasExtra, "extraData should be provided on delete");
			// extraData is keyed by item ID -- read inside sandbox since
			// the wrapped object uses getters not visible through Xrays
			let hasItemID = evalInScope(`!!_deleteExtra[${itemID}]`);
			assert.ok(hasItemID, "extraData should contain deleted item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
		});
	});

	describe("Zotero.Translators", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose Zotero.Translators.getAll()", async function () {
			assert.isTrue(evalInScope("typeof Zotero.Translators.getAll === 'function'"));
			let translators = await evalInScope("Zotero.Translators.getAll()");
			assert.isArray(translators);
		});

		it("should construct Translate.Import/Search/Web with the right type", function () {
			assert.equal(evalInScope("new Zotero.Translate.Import().type"), 'import');
			assert.equal(evalInScope("new Zotero.Translate.Search().type"), 'search');
			assert.equal(evalInScope("new Zotero.Translate.Web().type"), 'web');
		});

		it("should import an item via Translate.Import facade", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("book");'
				+ '  item.title = "Sandbox Import Test";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getTestTranslator" });

			let count = await evalInScope(`
				var _ti2 = new Zotero.Translate.Import();
				_ti2.setString("");
				_ti2.setTranslator(_getTestTranslator());
				_ti2.translate().then(items => items.length);
			`);
			assert.equal(count, 1);
		});

		it("should call itemDone handler during Translate.Import", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("journalArticle");'
				+ '  item.title = "Handler Test Article";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getHandlerTranslator" });

			let handlerCount = await evalInScope(`
				var _handlerCount = 0;
				var _ti3 = new Zotero.Translate.Import();
				_ti3.setString("");
				_ti3.setTranslator(_getHandlerTranslator());
				_ti3.setHandler('itemDone', function() { _handlerCount++; });
				_ti3.translate().then(function() { return _handlerCount; });
			`);
			assert.equal(handlerCount, 1);
		});

		it("should retrieve translators on Translate.Search via setSearch and setIdentifier", async function () {
			// Both entry points should return a translator array
			let viaSearch = await evalInScope(`
				var _ts2 = new Zotero.Translate.Search();
				_ts2.setSearch({ itemType: 'journalArticle', DOI: '10.1234/test' });
				_ts2.getTranslators().then(t => t.length);
			`);
			assert.isNumber(viaSearch);

			let viaIdentifier = await evalInScope(`
				var _ts3 = new Zotero.Translate.Search();
				_ts3.setIdentifier({ DOI: '10.1234/test' });
				_ts3.getTranslators().then(t => t.length);
			`);
			assert.isNumber(viaIdentifier);
		});

		it("should clear handlers so they do not fire", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("book");'
				+ '  item.title = "Clear Handler Test";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getClearTranslator" });

			let handlerCount = await evalInScope(`
				var _clearCount = 0;
				var _ti4 = new Zotero.Translate.Import();
				_ti4.setString("");
				_ti4.setTranslator(_getClearTranslator());
				_ti4.setHandler('itemDone', function() { _clearCount++; });
				_ti4.clearHandlers('itemDone');
				_ti4.translate().then(function() { return _clearCount; });
			`);
			assert.equal(handlerCount, 0);
		});

		it("should not expose Translators without data permission", function () {
			PluginSandbox.unloadScope(ADDON_ID);
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'undefined'"),
				"Translators should not be exposed without data permission");
		});

		it("should not expose Translate constructors with only dataRead", function () {
			PluginSandbox.unloadScope(ADDON_ID);
			loadTestScope(["default", "dataRead"]);
			assert.isTrue(evalInScope("typeof Zotero.Translators.getAll === 'function'"),
				"Translators.getAll should be exposed with dataRead");
			assert.isTrue(evalInScope("typeof Zotero.Translate === 'undefined'"),
				"Translate constructors should not be exposed with only dataRead");
		});
	});

	describe("Zotero.Prefs", function () {
		let testPrefKeys = [];

		afterEach(function () {
			// Clean up test prefs
			for (let key of testPrefKeys) {
				try {
					Zotero.Prefs.clear(key);
				}
				// eslint-disable-next-line no-unused-vars
				catch (e) {}
			}
			testPrefKeys = [];
			// Clean up sandbox pref observer if registered
			try {
				let id = evalInScope("typeof _prefObsID !== 'undefined' && _prefObsID");
				if (id) {
					Zotero.Prefs.unregisterObserver(id);
				}
			}
			// eslint-disable-next-line no-unused-vars
			catch (e) {}
		});

		describe("auto-prefixed namespace (global=false)", function () {
			// Full pref path prefix for the mock addon
			var OWN_PREFIX = 'extensions.' + PLUGIN_UUID + '.';

			beforeEach(function () {
				loadTestScope(["default", "preferences"]);
			});

			it("should auto-prefix get/set with the plugin UUID", function () {
				let shortKey = 'myPref';
				let fullKey = OWN_PREFIX + shortKey;
				testPrefKeys.push(PLUGIN_UUID + '.' + shortKey);
				// Plugin sets without global flag -- auto-prefixed
				evalInScope(`Zotero.Prefs.set('${shortKey}', 'hello')`);
				// Chrome sees it under the full key (global=true)
				assert.equal(Zotero.Prefs.get(fullKey, true), 'hello');
				// Plugin reads it back
				assert.equal(evalInScope(`Zotero.Prefs.get('${shortKey}')`), 'hello');
			});

			it("should set and get different types", function () {
				testPrefKeys.push(PLUGIN_UUID + '.str', PLUGIN_UUID + '.int', PLUGIN_UUID + '.bool');
				evalInScope("Zotero.Prefs.set('str', 'value')");
				assert.equal(evalInScope("Zotero.Prefs.get('str')"), 'value');

				evalInScope("Zotero.Prefs.set('int', 42)");
				assert.strictEqual(evalInScope("Zotero.Prefs.get('int')"), 42);

				evalInScope("Zotero.Prefs.set('bool', true)");
				assert.strictEqual(evalInScope("Zotero.Prefs.get('bool')"), true);
			});

			it("should clear an auto-prefixed pref", function () {
				let fullKey = OWN_PREFIX + 'clearMe';
				testPrefKeys.push(PLUGIN_UUID + '.clearMe');
				evalInScope("Zotero.Prefs.set('clearMe', 'val')");
				assert.equal(Zotero.Prefs.get(fullKey, true), 'val');
				evalInScope("Zotero.Prefs.clear('clearMe')");
				assert.isUndefined(Zotero.Prefs.get(fullKey, true));
			});

			it("should reflect prefs between sandbox and chrome", function () {
				let fullKey = OWN_PREFIX + 'cross';
				testPrefKeys.push(PLUGIN_UUID + '.cross');
				// Set from sandbox, read from chrome
				evalInScope("Zotero.Prefs.set('cross', 'fromSandbox')");
				assert.equal(Zotero.Prefs.get(fullKey, true), 'fromSandbox');
				// Set from chrome, read from sandbox
				Zotero.Prefs.set(fullKey, 'fromChrome', true);
				assert.equal(evalInScope("Zotero.Prefs.get('cross')"), 'fromChrome');
			});

			it("should register observer on auto-prefixed pref", function () {
				let fullKey = OWN_PREFIX + 'obs';
				testPrefKeys.push(PLUGIN_UUID + '.obs');

				evalInScope(`
					var _prefNewValue = undefined;
					var _prefObsID = Zotero.Prefs.registerObserver(
						'obs',
						function(newValue) { _prefNewValue = newValue; }
					);
				`);

				// Change from chrome side using full key
				Zotero.Prefs.set(fullKey, 'observed', true);
				assert.equal(evalInScope("_prefNewValue"), 'observed');

				evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
			});
		});

		describe("explicit access (global=true)", function () {
			beforeEach(function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.test.sandbox."]);
			});

			it("should get/set prefs by full name with global=true", function () {
				let fullKey = 'extensions.zotero.test.sandbox.explicit';
				let shortKey = 'test.sandbox.explicit';
				testPrefKeys.push(shortKey);
				evalInScope(`Zotero.Prefs.set('${fullKey}', 'hello', true)`);
				assert.equal(Zotero.Prefs.get(shortKey), 'hello');
				assert.equal(evalInScope(`Zotero.Prefs.get('${fullKey}', true)`), 'hello');
			});

			it("should clear a pref with global=true", function () {
				let fullKey = 'extensions.zotero.test.sandbox.clearExplicit';
				let shortKey = 'test.sandbox.clearExplicit';
				testPrefKeys.push(shortKey);
				evalInScope(`Zotero.Prefs.set('${fullKey}', 'val', true)`);
				evalInScope(`Zotero.Prefs.clear('${fullKey}', true)`);
				assert.isUndefined(Zotero.Prefs.get(shortKey));
			});

			it("should register observer with global=true", function () {
				let fullKey = 'extensions.zotero.test.sandbox.obsExplicit';
				let shortKey = 'test.sandbox.obsExplicit';
				testPrefKeys.push(shortKey);

				evalInScope(`
					var _prefNewValue = undefined;
					var _prefObsID = Zotero.Prefs.registerObserver(
						'${fullKey}',
						function(newValue) { _prefNewValue = newValue; },
						true
					);
				`);

				Zotero.Prefs.set(shortKey, 'observed');
				assert.equal(evalInScope("_prefNewValue"), 'observed');

				evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
			});

			it("should resetBranch within declared prefix", function () {
				let key1 = 'test.sandbox.reset1';
				let key2 = 'test.sandbox.reset2';
				testPrefKeys.push(key1, key2);
				evalInScope(`Zotero.Prefs.set('extensions.zotero.${key1}', 'val1', true)`);
				evalInScope(`Zotero.Prefs.set('extensions.zotero.${key2}', 'val2', true)`);

				evalInScope("Zotero.Prefs.resetBranch([], 'extensions.zotero.test.sandbox.reset')");

				assert.isUndefined(Zotero.Prefs.get(key1));
				assert.isUndefined(Zotero.Prefs.get(key2));
			});
		});

		describe("access control", function () {
			it("should deny global=true for prefs not matching pref_permissions", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.myPlugin."]);
				assert.throws(() => evalInScope("Zotero.Prefs.get('extensions.zotero.fontSize', true)"),
					undefined, undefined, "get() outside declared prefix should throw");
				assert.throws(() => evalInScope("Zotero.Prefs.set('extensions.zotero.fontSize', 14, true)"),
					undefined, undefined, "set() outside declared prefix should throw");
			});

			it("should allow global=true for prefs matching pref_permissions", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.fontSize"]);
				evalInScope("Zotero.Prefs.get('extensions.zotero.fontSize', true)");
			});

			it("should deny resetBranch on entire Zotero branch", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.test."]);
				assert.throws(() => evalInScope("Zotero.Prefs.resetBranch()"),
					undefined, undefined, "resetBranch() without branch should throw");
			});

			it("should deny resetBranch on branches outside declared prefixes", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.myPlugin."]);
				assert.throws(() => evalInScope("Zotero.Prefs.resetBranch([], 'extensions.zotero.other.')"),
					undefined, undefined, "resetBranch outside declared prefix should throw");
			});

			it("should deny resetBranch on non-Zotero branches", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.test."]);
				assert.throws(() => evalInScope("Zotero.Prefs.resetBranch([], 'browser.')"),
					undefined, undefined, "resetBranch on non-Zotero branch should throw");
			});

			it("should deny registerObserver with global=true outside pref_permissions", function () {
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.myPlugin."]);
				assert.throws(() => evalInScope("Zotero.Prefs.registerObserver('extensions.zotero.fontSize', function() {}, true)"),
					undefined, undefined, "registerObserver outside allowed scope should throw");
			});

			it("should deny reserved namespaces even when declared", function () {
				loadTestScope(["default", "preferences"], [], [
					"extensions.zotero.pluginFileAccess.",
					"extensions.zotero.dataDir",
				]);
				assert.throws(
					() => evalInScope(`Zotero.Prefs.set('extensions.zotero.pluginFileAccess.${PLUGIN_UUID}', '[]', true)`),
					undefined, undefined, "writing the file-access grant store must be denied");
				assert.throws(
					() => evalInScope("Zotero.Prefs.clear('extensions.zotero.pluginFileAccess.x', true)"),
					undefined, undefined, "clearing a grant-store pref must be denied");
				assert.throws(
					() => evalInScope("Zotero.Prefs.get('extensions.zotero.dataDir', true)"),
					undefined, undefined, "reading the data dir pref must be denied");
			});

			// Note: these are two separate tests so each gets a fresh scope. Calling
			// loadTestScope twice with the same permissions in one test takes the
			// loadScope reuse branch, which currently throws on the frozen VERSION.
			it("should deny a wildcard prefix covering an exact-match-only namespace (sync)", function () {
				// A wildcard prefix covering sync.* is dropped at setup -> denied
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.sync."]);
				assert.throws(() => evalInScope("Zotero.Prefs.get('extensions.zotero.sync.server.username', true)"),
					undefined, undefined, "a wildcard prefix must not grant sync.*");
			});

			it("should allow an exact pref name in an exact-match-only namespace (sync)", function () {
				// An exact pref name is allowed
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.sync.autoSync"]);
				evalInScope("Zotero.Prefs.get('extensions.zotero.sync.autoSync', true)");
			});

			it("should deny resetBranch that would clear an exact-match-only namespace", function () {
				// Declaring the exact parent passes the per-pref check, but resetBranch
				// on it would wipe sync.* as a subtree -> blocked by the reset guard.
				loadTestScope(["default", "preferences"], [], ["extensions.zotero.sync"]);
				assert.throws(() => evalInScope("Zotero.Prefs.resetBranch([], 'extensions.zotero.sync')"),
					undefined, undefined, "resetBranch covering sync.* must be denied");
			});
		});
	});

	describe("Zotero Plugin APIs", function () {
		var pluginWin;

		before(async function () {
			pluginWin = await loadZoteroPane();
		});

		after(function () {
			pluginWin.close();
		});

		beforeEach(function () {
			loadTestScope(["default", "dataRead", "itemTree", "itemPane", "menu", "reader"]);
		});

		describe("ItemTreeManager", function () {
			it("should register a column with dataProvider from sandbox", async function () {
				// Store return value in sandbox variable to avoid CSS.escape backslash issues
				evalInScope(`
					var _colDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-col',
						label: 'Sandbox Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function({ itemID }, dataKey) {
							return 'sandbox-data-' + itemID;
						}
					});
				`);
				let dataKey = evalInScope("_colDataKey");

				assert.isString(dataKey, "registerColumn should return a string dataKey");

				// Verify the column appears in getCustomColumns
				let columns = Zotero.ItemTreeManager.getCustomColumns();
				let found = columns.find(c => c.dataKey === dataKey);
				assert.ok(found, "Column should appear in getCustomColumns");
				assert.equal(found.label, 'Sandbox Column');

				// Verify dataProvider callback works across compartments
				let item = new Zotero.Item('book');
				item.setField('title', 'Column Test');
				await item.saveTx();

				let cellData = Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
				assert.equal(cellData, 'sandbox-data-' + item.id,
					"dataProvider should return correct data when called from chrome");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.ItemTreeManager.unregisterColumn(_colDataKey)");
				assert.isTrue(success, "unregisterColumn should return true");

				// Verify it's gone
				columns = Zotero.ItemTreeManager.getCustomColumns();
				found = columns.find(c => c.dataKey === dataKey);
				assert.notOk(found, "Column should be gone after unregister");

				await item.eraseTx();
			});

			it("should handle dataProvider errors gracefully", async function () {
				evalInScope(`
					var _errColDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-err-col',
						label: 'Error Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) {
							throw new Error("Sandbox dataProvider error");
						}
					});
				`);
				let dataKey = evalInScope("_errColDataKey");
				assert.isString(dataKey);

				let item = new Zotero.Item('book');
				await item.saveTx();

				// Should return fallback instead of throwing
				// (fallbackReturn is "" but "" || null → null in pluginAPIBase)
				let cellData = Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
				assert.isNull(cellData, "Should return null fallback on error");

				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_errColDataKey)");
				await item.eraseTx();
			});

			it("should reject duplicate dataKey registration", function () {
				evalInScope(`
					var _dupColDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-dup-col',
						label: 'First Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item) { return '1'; }
					});
				`);
				assert.isString(evalInScope("_dupColDataKey"));

				// Second registration with same dataKey should fail
				let dataKey2 = evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-dup-col',
						label: 'Duplicate Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item) { return '2'; }
					});
				`);
				assert.isFalse(dataKey2, "Duplicate registration should return false");

				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_dupColDataKey)");
			});

			it("should render renderCell SVG URLs as an image", function () {
				evalInScope(`
					var _renderColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-render-col',
						label: 'Render Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) { return 'test'; },
						renderCell: function(index, data, column, isFirstColumn) {
							switch (index) {
								// Raw markup is not accepted, to test the fallback
								case 1: return '<svg xmlns="http://www.w3.org/2000/svg"/>';
								// A plugin-internal .svg URL
								case 2: return 'cell.svg';
								// An external .svg URL, which must be rejected
								case 3: return 'https://example.com/x.svg';
								// A data: URL of a non-SVG type, which must be rejected
								case 4: return 'data:text/html,<script>bad()</script>';
								default: return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
									'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12">'
									+ '<text x="0" y="10">' + data + '</text></svg>');
							}
						}
					});
				`);
				let dataKey = evalInScope("_renderColKey");
				assert.isString(dataKey);
				let option = Zotero.ItemTreeManager._columnManager._optionsCache[dataKey];

				try {
					let cell = option.renderCell(0, "test", { className: "test-col" }, false, pluginWin.document);
					assert.equal(cell.localName, "span");
					assert.equal(cell.className, "cell test-col",
						"the cell element itself should be chrome-built");
					let img = cell.firstElementChild;
					assert.equal(img.localName, "img",
						"an SVG data URL should be shown as an image");
					assert.match(img.src, /^data:image\/svg\+xml/);
					assert.include(decodeURIComponent(img.src), "test");
					assert.equal(img.alt, "test");

					// Raw markup falls back to the plain cell data
					let fallback = option.renderCell(1, "test", { className: "test-col" }, false, pluginWin.document);
					assert.equal(fallback.className, "cell test-col");
					assert.equal(fallback.textContent, "test");
					assert.equal(fallback.childElementCount, 0,
						"raw markup must not become an image");

					// A plugin-internal .svg URL resolves against the plugin root
					let urlCell = option.renderCell(2, "test", { className: "test-col" }, false, pluginWin.document);
					assert.equal(urlCell.firstElementChild.src,
						Zotero.Plugins.getBaseURI(ADDON_ID) + "cell.svg");

					// An external .svg URL falls back to the plain cell data
					let externalCell = option.renderCell(3, "test", { className: "test-col" }, false, pluginWin.document);
					assert.equal(externalCell.childElementCount, 0,
						"external URLs must be rejected");
					assert.equal(externalCell.textContent, "test");

					// A non-SVG data: URL falls back to the plain cell data
					let htmlDataCell = option.renderCell(4, "test", { className: "test-col" }, false, pluginWin.document);
					assert.equal(htmlDataCell.childElementCount, 0,
						"non-SVG data: URLs must be rejected");
				}
				finally {
					evalInScope("Zotero.ItemTreeManager.unregisterColumn(_renderColKey)");
				}
			});

			it("should restrict htmlLabel to SVG URLs", function () {
				let stringLabelKey = evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-strlabel-col',
						label: 'Label Column',
						pluginID: '${ADDON_ID}',
						htmlLabel: '<b onclick="alert(1)">evil</b>',
						dataProvider: function() { return ''; },
					});
				`);
				assert.isString(stringLabelKey);
				let option = Zotero.ItemTreeManager._columnManager._optionsCache[stringLabelKey];
				assert.isUndefined(option.htmlLabel, "an HTML label should be dropped");
				Zotero.ItemTreeManager.unregisterColumn(stringLabelKey);

				let svgLabelKey = evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-svglabel-col',
						label: 'Label Column',
						pluginID: '${ADDON_ID}',
						htmlLabel: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
							'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12">'
							+ '<text x="0" y="10">fancy</text></svg>'),
						dataProvider: function() { return ''; },
					});
				`);
				assert.isString(svgLabelKey);
				option = Zotero.ItemTreeManager._columnManager._optionsCache[svgLabelKey];
				assert.match(option.htmlLabel.svgSrc, /^data:image\/svg\+xml/,
					"an SVG data URL label should be kept");
				assert.include(decodeURIComponent(option.htmlLabel.svgSrc), "fancy");
				Zotero.ItemTreeManager.unregisterColumn(svgLabelKey);

				let urlLabelKey = evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-urllabel-col',
						label: 'Label Column',
						pluginID: '${ADDON_ID}',
						htmlLabel: 'label.svg',
						dataProvider: function() { return ''; },
					});
				`);
				assert.isString(urlLabelKey);
				option = Zotero.ItemTreeManager._columnManager._optionsCache[urlLabelKey];
				assert.equal(option.htmlLabel.svgSrc, Zotero.Plugins.getBaseURI(ADDON_ID) + "label.svg",
					"a plugin .svg URL label should resolve against the plugin root");
				Zotero.ItemTreeManager.unregisterColumn(urlLabelKey);
			});

			function isColumnRegistered(dataKey) {
				return Object.keys(Zotero.ItemTreeManager._columnManager._optionsCache)
					.some(key => key.includes(dataKey));
			}

			it("should refuse an unloaded plugin's late calls", function () {
				// Once used, the mirror keeps the callable, and the sandbox still runs until it is nuked
				evalInScope("Zotero.ItemTreeManager.registerColumn");
				PluginSandbox.unloadScope(ADDON_ID);
				assert.throws(() => evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-unloaded-col',
						label: 'Late Column',
						dataProvider: function() { return ''; },
					});
				`));
				assert.isFalse(isColumnRegistered("sandbox-unloaded-col"));
			});

			it("should refuse late calls from a sandbox replaced by a reload", function () {
				evalInScope("Zotero.ItemTreeManager.registerColumn");
				let oldScope = scope;
				loadTestScope(["default", "dataRead", "itemTree", "itemPane", "menu", "reader"]);
				let column = `{
					dataKey: 'sandbox-reloaded-col',
					label: 'Reloaded Column',
					dataProvider: function() { return ''; },
				}`;
				assert.throws(() => Cu.evalInSandbox(`Zotero.ItemTreeManager.registerColumn(${column})`, oldScope),
					undefined, undefined, "a callable the old sandbox kept");
				assert.throws(() => Cu.evalInSandbox("Zotero.ItemTreeManager.unregisterColumn", oldScope),
					undefined, undefined, "a callable the old sandbox first reaches after the reload");
				assert.isFalse(isColumnRegistered("sandbox-reloaded-col"));

				let dataKey = evalInScope(`Zotero.ItemTreeManager.registerColumn(${column})`);
				assert.isTrue(isColumnRegistered("sandbox-reloaded-col"), "the new sandbox still registers");
				Zotero.ItemTreeManager.unregisterColumn(dataKey);
			});
		});

		describe("ItemPaneManager", function () {
			it("should register an info row with onGetData from sandbox", async function () {
				evalInScope(`
					var _rowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function({ itemID }) {
							return 'row-data-' + itemID;
						}
					});
				`);
				let rowID = evalInScope("_rowID");

				assert.isString(rowID, "registerInfoRow should return a string rowID");

				// Verify the onGetData callback works across compartments
				let onGetData = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				assert.isFunction(onGetData, "onGetData hook should be accessible");

				let item = new Zotero.Item('book');
				item.setField('title', 'InfoRow Test');
				await item.saveTx();

				let result = onGetData({ itemID: item.id, item });
				assert.equal(result, 'row-data-' + item.id,
					"onGetData should return correct data when called from chrome");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_rowID)");
				assert.isTrue(success, "unregisterInfoRow should return true");

				// Verify it's gone
				let hook = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				assert.isUndefined(hook, "Hook should be gone after unregister");

				await item.eraseTx();
			});

			it("should handle onGetData errors gracefully", async function () {
				evalInScope(`
					var _errRowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-err-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function({ item }) {
							throw new Error("Sandbox onGetData error");
						}
					});
				`);
				let rowID = evalInScope("_errRowID");
				assert.isString(rowID);

				let onGetData = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				let item = new Zotero.Item('book');
				await item.saveTx();

				// Should return fallback instead of throwing
				let result = onGetData({ itemID: item.id, item });
				assert.isNull(result, "Should return null fallback on error");

				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_errRowID)");
				await item.eraseTx();
			});

			describe("embedded sections", function () {
				var tmpDir;

				before(async function () {
					tmpDir = await getTempDirectory();
					await FileIO.writeUTF8(
						PathUtils.join(tmpDir, "section-script.js"),
						"document.getElementById('section-marker').setAttribute('data-script-ran', 'true');\n"
						// Page-side messaging: the injected zoteroHost messenger renders
						// from whatever the plugin sends -- no token, no postMessage
						+ "zoteroHost.addMessageListener(function (data) {\n"
						+ "  if (data && 'marker' in data) {\n"
						+ "    document.getElementById('section-marker').textContent = data.marker;\n"
						+ "  }\n"
						+ "});\n"
					);
					await FileIO.writeUTF8(
						PathUtils.join(tmpDir, "section.html"),
						"<!DOCTYPE html><html><head><title>Section</title></head><body>"
						+ "<div id='section-marker'>Embedded section body</div>"
						+ '<script src="section-script.js"></script></body></html>'
					);
				});

				// The section page has to live inside the plugin, so replace the
				// scope from the outer beforeEach with one rooted at tmpDir
				function loadSectionTestScope(permissions = ["default", "dataRead", "itemPane"]) {
					try {
						PluginSandbox.unloadScope(ADDON_ID);
					}
					catch {}
					mockAddon = createMockPlugin({
						id: ADDON_ID,
						name: "Test Sandbox Plugin",
						syncGUID: SYNC_GUID,
						permissions,
						resourceURI: PathUtils.toFileURI(tmpDir) + "/",
					});
					PluginSandbox.loadScope(mockAddon);
					scope = PluginSandbox.getScope(ADDON_ID);
				}

				function registerTestSection(options = {}) {
					return Zotero.ItemPaneManager.registerSection({
						paneID: "sandbox-embedded-section",
						pluginID: ADDON_ID,
						// Must not resolve to a message with a value, or Fluent
						// would replace the section's children with it
						header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/empty.png" },
						sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/empty.png" },
						onRender: () => {},
						src: "section.html",
						...options,
					});
				}

				it("should drop bodyXHTML and require a page within the plugin as src", function () {
					loadSectionTestScope();
					assert.isFalse(registerTestSection({ src: undefined, bodyXHTML: "<div>nope</div>" }),
						"registration without src should be rejected");
					assert.isFalse(registerTestSection({ src: "https://example.com/section.html" }),
						"external src should be rejected");
					assert.isFalse(registerTestSection({ src: "chrome://zotero/content/zoteroPane.xhtml" }),
						"chrome src should be rejected");
					assert.isFalse(registerTestSection({ src: "section.xhtml" }),
						"non-.html src should be rejected");

					let paneID = registerTestSection({ bodyXHTML: "<div>dropped</div>" });
					assert.isString(paneID, "valid src should register");
					let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
					assert.isUndefined(option.bodyXHTML, "bodyXHTML should be dropped");
					assert.equal(option.src, Zotero.Plugins.getBaseURI(ADDON_ID) + "section.html");
					Zotero.ItemPaneManager.unregisterSection(paneID);
				});

				it("should let a privileged plugin use src too, keeping bodyXHTML", function () {
					loadSectionTestScope(["*"]);
					let paneID = registerTestSection({ bodyXHTML: "<html:div>fallback</html:div>" });
					assert.isString(paneID, "privileged registration with src should succeed");
					let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
					assert.equal(option.src, Zotero.Plugins.getBaseURI(ADDON_ID) + "section.html");
					assert.equal(option.bodyXHTML, "<html:div>fallback</html:div>",
						"bodyXHTML should not be dropped for privileged plugins");
					Zotero.ItemPaneManager.unregisterSection(paneID);

					assert.isFalse(registerTestSection({ src: "https://example.com/section.html" }),
						"external src should be rejected for privileged plugins too");
				});

				it("should show the section page in an embedded browser and drive it with the page messenger", async function () {
					loadSectionTestScope();
					evalInScope(`
						var _sectionID = Zotero.ItemPaneManager.registerSection({
							paneID: 'sandbox-embedded-section',
							pluginID: '${ADDON_ID}',
							header: { l10nID: 'example-item-pane-header', icon: 'chrome://zotero/skin/16/universal/empty.png' },
							sidenav: { l10nID: 'example-item-pane-header', icon: 'chrome://zotero/skin/20/universal/empty.png' },
							src: 'section.html',
							onRender: function ({ page, itemID }) {
								// No DOM handoff -- render the page by messaging it
								page.sendMessage({ marker: 'rendered-' + itemID });
							},
						});
					`);
					let paneID = evalInScope("_sectionID");
					assert.isString(paneID);

					let item = await createDataObject('item');
					await pluginWin.ZoteroPane.selectItem(item.id);

					let itemDetails = pluginWin.ZoteroPane.itemPane._itemDetails;
					let getSection = () => itemDetails.getPanes().find(elem => elem.dataset.pane === paneID);
					await waitForCallback(() => getSection(), 50, 5);
					await waitForScrollToPane(itemDetails, paneID);

					let section = getSection();
					let browser = section.querySelector("browser.plugin-section-browser");
					assert.ok(browser, "section body should contain a content browser");
					assert.isNull(section.querySelector("#section-marker"),
						"page markup should not be inserted into the chrome document");

					// Wait for the page to render from the message the plugin sent it
					let marker;
					await waitForCallback(() => {
						marker = browser.contentDocument?.getElementById("section-marker");
						return marker && marker.textContent === "rendered-" + item.id;
					}, 50, 5);
					assert.equal(marker.getAttribute("data-script-ran"), "true",
						"page scripts should run inside the embedded page");

					evalInScope("Zotero.ItemPaneManager.unregisterSection(_sectionID)");
					await Zotero.Items.erase(item.id);
				});
			});
		});

		describe("MenuManager", function () {
			it("should register a menu with callbacks from sandbox", function () {
				evalInScope(`
					var _menuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function(event, context) {
								return 'sandbox-command';
							},
							onShowing: function(event, context) {
								return 'sandbox-showing';
							}
						}]
					});
				`);
				let menuID = evalInScope("_menuID");

				assert.isString(menuID, "registerMenu should return a string menuID");

				// Verify the menu is stored with wrapped callbacks
				let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				assert.ok(option, "Menu option should be in cache");
				assert.isFunction(option.menus[0].onCommand, "onCommand should be a function");
				assert.isFunction(option.menus[0].onShowing, "onShowing should be a function");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.MenuManager.unregisterMenu(_menuID)");
				assert.isTrue(success, "unregisterMenu should return true");

				// Verify it's gone
				option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				assert.notOk(option, "Menu option should be gone after unregister");
			});

			// A plugin must not keep a spoofed pluginID via an accessor with a
			// no-op setter -- a bogus ID resolves to a privileged (missing) scope.
			it("should not let an accessor pluginID override the real caller", function () {
				evalInScope(`
					var _spoofOpts = {
						menuID: 'accessor-spoof-menu',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function () {}
						}]
					};
					Object.defineProperty(_spoofOpts, 'pluginID', {
						get: function () { return 'nonexistent-privileged@evil'; },
						set: function () {},
						enumerable: true,
						configurable: true
					});
					var _spoofMenuID = Zotero.MenuManager.registerMenu(_spoofOpts);
				`);
				let menuID = evalInScope("_spoofMenuID");
				assert.isString(menuID, "registerMenu should still succeed");
				try {
					let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
					assert.ok(option, "spoofed menu should be stored");
					assert.equal(option.pluginID, ADDON_ID,
						"stored pluginID must be the real caller, not the spoofed value");
				}
				finally {
					evalInScope("Zotero.MenuManager.unregisterMenu(_spoofMenuID)");
				}
			});

			it("should not let a Proxy options object override the real caller", function () {
				evalInScope(`
					var _proxyBase = {
						menuID: 'proxy-spoof-menu',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function () {}
						}]
					};
					var _proxyOpts = new Proxy(_proxyBase, {
						get: function (t, p) {
							return p === 'pluginID' ? 'nonexistent-privileged@evil' : t[p];
						},
						set: function () { return true; }
					});
					var _proxyMenuID = Zotero.MenuManager.registerMenu(_proxyOpts);
				`);
				let menuID = evalInScope("_proxyMenuID");
				assert.isString(menuID, "registerMenu should still succeed");
				try {
					let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
					assert.ok(option, "spoofed menu should be stored");
					assert.equal(option.pluginID, ADDON_ID,
						"stored pluginID must be the real caller, not the spoofed value");
				}
				finally {
					evalInScope("Zotero.MenuManager.unregisterMenu(_proxyMenuID)");
				}
			});

			// _wrapHook must strip the chrome DOM event and context.menuElem
			// before an unprivileged hook runs (privileged plugins keep both)
			it("should strip the DOM event and context.menuElem from unprivileged hooks", function () {
				evalInScope(`
					var _restrictResults = {};
					var _restrictMenuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-restrict-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function (context) {
								_restrictResults.argCount = arguments.length;
								_restrictResults.hasMenuElem = context
									? 'menuElem' in context : null;
								_restrictResults.itemID = context && context.itemIDs
									? context.itemIDs[0] : null;
							}
						}]
					});
				`);
				let menuID = evalInScope("_restrictMenuID");
				let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				let onCommand = option.menus[0].onCommand;

				let menuElem = pluginWin.document.createElement('menuitem');
				try {
					// Invoke the wrapped callback the way MenuManager does, with
					// a chrome event placeholder and a menuElem in the context
					onCommand(null, { menuElem, itemIDs: [123] });

					assert.equal(evalInScope("_restrictResults.argCount"), 1,
						"the hook should receive (context) only -- no DOM event");
					assert.isFalse(evalInScope("_restrictResults.hasMenuElem"),
						"menuElem should be stripped from the context");
					assert.equal(evalInScope("_restrictResults.itemID"), 123,
						"other context properties should pass through");
				}
				finally {
					evalInScope("Zotero.MenuManager.unregisterMenu(_restrictMenuID)");
				}
			});
		});

		describe("ShortcutManager", function () {
			beforeEach(function () {
				loadTestScope(["default", "shortcut"]);
			});

			function dispatchKey(key) {
				let event = new pluginWin.KeyboardEvent("keydown", {
					key,
					metaKey: Zotero.isMac,
					ctrlKey: !Zotero.isMac,
					altKey: true,
					bubbles: true,
					cancelable: true,
				});
				pluginWin.document.getElementById("zotero-pane").dispatchEvent(event);
				return event;
			}

			it("should register a shortcut from sandbox and fire its onCommand", function () {
				evalInScope(`
					var _firedContext = null;
					var _shortcutID = Zotero.ShortcutManager.registerShortcut({
						shortcutID: 'sandbox-shortcut',
						pluginID: '${ADDON_ID}',
						key: 'U',
						modifiers: ['accel', 'alt'],
						target: 'mainWindow',
						onCommand: function (context) {
							_firedContext = context;
						}
					});
				`);
				let shortcutID = evalInScope("_shortcutID");
				assert.isString(shortcutID, "registerShortcut should return a string shortcutID");

				let option = Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID];
				assert.ok(option, "Shortcut option should be in cache");
				assert.isFunction(option.onCommand, "onCommand should be a function");

				try {
					let event = dispatchKey("u");
					assert.isTrue(event.defaultPrevented, "a matching keydown should be consumed");
					assert.equal(evalInScope("_firedContext && _firedContext.tabType"), "library");
					assert.equal(evalInScope("_firedContext.tabID"), "zotero-pane");
				}
				finally {
					assert.isTrue(evalInScope("Zotero.ShortcutManager.unregisterShortcut(_shortcutID)"));
				}
				let event = dispatchKey("u");
				assert.isFalse(event.defaultPrevented, "the combo should be free after unregistering");
			});

			it("should not let an accessor pluginID override the real caller", function () {
				evalInScope(`
					var _spoofOpts = {
						shortcutID: 'accessor-spoof-shortcut',
						key: 'U',
						modifiers: ['accel', 'alt'],
						target: 'mainWindow',
						onCommand: function () {}
					};
					Object.defineProperty(_spoofOpts, 'pluginID', {
						get: function () { return 'nonexistent-privileged@evil'; },
						set: function () {},
						enumerable: true,
						configurable: true
					});
					var _spoofShortcutID = Zotero.ShortcutManager.registerShortcut(_spoofOpts);
				`);
				let shortcutID = evalInScope("_spoofShortcutID");
				assert.isString(shortcutID, "registerShortcut should still succeed");
				try {
					let option = Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID];
					assert.ok(option, "spoofed shortcut should be stored");
					assert.equal(option.pluginID, ADDON_ID,
						"stored pluginID must be the real caller, not the spoofed value");
				}
				finally {
					evalInScope("Zotero.ShortcutManager.unregisterShortcut(_spoofShortcutID)");
				}
			});

			it("should not let a Proxy options object override the real caller", function () {
				evalInScope(`
					var _proxyBase = {
						shortcutID: 'proxy-spoof-shortcut',
						key: 'U',
						modifiers: ['accel', 'alt'],
						target: 'mainWindow',
						onCommand: function () {}
					};
					var _proxyOpts = new Proxy(_proxyBase, {
						get: function (t, p) {
							return p === 'pluginID' ? 'nonexistent-privileged@evil' : t[p];
						},
						set: function () { return true; }
					});
					var _proxyShortcutID = Zotero.ShortcutManager.registerShortcut(_proxyOpts);
				`);
				let shortcutID = evalInScope("_proxyShortcutID");
				assert.isString(shortcutID, "registerShortcut should still succeed");
				try {
					let option = Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID];
					assert.ok(option, "spoofed shortcut should be stored");
					assert.equal(option.pluginID, ADDON_ID,
						"stored pluginID must be the real caller, not the spoofed value");
				}
				finally {
					evalInScope("Zotero.ShortcutManager.unregisterShortcut(_proxyShortcutID)");
				}
			});

			it("should not unregister another plugin's shortcut", function () {
				let shortcutID = Zotero.ShortcutManager.registerShortcut({
					shortcutID: "other-plugin-shortcut",
					pluginID: "other@zotero.org",
					key: "U",
					modifiers: ["accel", "alt"],
					target: "mainWindow",
					onCommand: () => {},
				});
				assert.isString(shortcutID);
				try {
					// Pass the CSS-escaped key in via the scope to avoid escaping issues
					scope._otherShortcutID = shortcutID;
					assert.isFalse(evalInScope("Zotero.ShortcutManager.unregisterShortcut(_otherShortcutID)"));
				}
				finally {
					Zotero.ShortcutManager.unregisterShortcut(shortcutID);
				}
			});

			it("should reject combos reserved by Zotero from sandbox", function () {
				assert.isFalse(evalInScope(`Zotero.ShortcutManager.registerShortcut({
					shortcutID: 'reserved-shortcut',
					pluginID: '${ADDON_ID}',
					key: 'W',
					modifiers: ['accel'],
					target: 'mainWindow',
					onCommand: function () {}
				})`));
			});

			it("should not be exposed without the shortcut permission", function () {
				loadTestScope(["default"]);
				assert.equal(evalInScope("typeof Zotero.ShortcutManager"), "undefined");
			});

			it("should be exposed via the ui umbrella permission", function () {
				loadTestScope(["default", "ui"]);
				assert.equal(evalInScope("typeof Zotero.ShortcutManager.registerShortcut"), "function");
			});
		});

		// Library data never reaches a manager callback as a live object: hooks get IDs, and the
		// synchronous ones a read-only snapshot or summary when the plugin has dataRead
		it("should pass IDs and plain snapshots, never live items, to manager callbacks", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Callback Perm Test');
			await item.saveTx();
			let otherItem = new Zotero.Item('book');
			otherItem.setField('title', 'Callback Perm Other');
			await otherItem.saveTx();
			let collection = await createDataObject('collection');
			let assertPlain = (resultsVar) => {
				assert.equal(evalInScope(`${resultsVar}.hasGetField`), 'undefined');
				assert.equal(evalInScope(`${resultsVar}.hasSave`), 'undefined');
			};
			try {
				evalInScope(`
					var _probe = function (value, results) {
						results.hasSave = typeof value?.save;
						results.hasGetField = typeof value?.getField;
					};
				`);

				// ItemTreeManager.dataProvider gets the row's ID and a synchronous getItem
				evalInScope(`
					var _treeResults = {};
					var _permColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-perm-col',
						label: 'Perm Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function ({ itemID, getItem }) {
							let row = getItem();
							_probe(row, _treeResults);
							_treeResults.itemID = itemID;
							_treeResults.id = row.id;
							_treeResults.kind = row.kind;
							_treeResults.title = row.data.title;
							_treeResults.itemType = row.data.itemType;
							// getItem(id) reads any other item already in memory
							_treeResults.otherTitle = getItem(${otherItem.id}).data.title;
							_treeResults.missing = getItem(-1);
							return 'test';
						}
					});
				`);
				Zotero.ItemTreeManager.getCustomCellData(item, evalInScope("_permColKey"));
				assertPlain("_treeResults");
				assert.equal(evalInScope("_treeResults.itemID"), item.id);
				assert.equal(evalInScope("_treeResults.id"), item.id);
				assert.equal(evalInScope("_treeResults.kind"), "regular");
				assert.equal(evalInScope("_treeResults.title"), "Callback Perm Test");
				assert.equal(evalInScope("_treeResults.itemType"), "book");
				assert.equal(evalInScope("_treeResults.otherTitle"), "Callback Perm Other");
				assert.isNull(evalInScope("_treeResults.missing"));
				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_permColKey)");

				// ItemPaneManager.onGetData gets the ID and getItem; onSetData only writes, so it gets
				// the ID alone
				evalInScope(`
					var _rowResults = {};
					var _permRowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-perm-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function ({ itemID, getItem }) {
							let snapshot = getItem();
							_probe(snapshot, _rowResults);
							_rowResults.itemID = itemID;
							_rowResults.snapshotID = snapshot.id;
							_rowResults.title = snapshot.data.title;
							return 'test';
						},
						onSetData: function ({ itemID, getItem, item }) {
							_rowResults.setItemID = itemID;
							_rowResults.setHasGetItem = typeof getItem;
							_rowResults.setHasItem = typeof item;
						}
					});
				`);
				Zotero.ItemPaneManager.getInfoRowHook(evalInScope("_permRowID"), 'onGetData')(
					{ itemID: item.id, item, tabType: 'library', editable: false });
				assertPlain("_rowResults");
				assert.equal(evalInScope("_rowResults.itemID"), item.id);
				assert.equal(evalInScope("_rowResults.snapshotID"), item.id);
				assert.equal(evalInScope("_rowResults.title"), "Callback Perm Test");
				Zotero.ItemPaneManager.getInfoRowHook(evalInScope("_permRowID"), 'onSetData')(
					{ itemID: item.id, item, tabType: 'library', editable: true, value: 'x' });
				assert.equal(evalInScope("_rowResults.setItemID"), item.id);
				assert.equal(evalInScope("_rowResults.setHasGetItem"), "undefined");
				assert.equal(evalInScope("_rowResults.setHasItem"), "undefined");
				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_permRowID)");

				// MenuManager hooks get itemIDs and row refs
				evalInScope(`
					var _menuResults = {};
					var _permMenuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-perm-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							// Unprivileged menu hooks receive (context) only
							onCommand: function (context) {
								_menuResults.itemIDs = JSON.stringify(Array.from(context.itemIDs));
								_menuResults.hasItems = typeof context.items;
								_menuResults.hasRows = typeof context.collectionTreeRows;
								_menuResults.libraryIDs = JSON.stringify(Array.from(context.libraryIDs));
								_menuResults.collectionIDs = JSON.stringify(Array.from(context.collectionIDs));
							}
						}]
					});
				`);
				let menuOption = Zotero.MenuManager._menuManager._optionsCache[evalInScope("_permMenuID")];
				let row = { type: 'collection', ref: collection, isCollection: () => true, isSearch: () => false };
				menuOption.menus[0].onCommand(null, {
					itemIDs: [item.id],
					libraryIDs: [collection.libraryID],
					collectionIDs: [collection.id],
					items: [item],
					collectionTreeRows: [row],
				});
				assert.deepEqual(JSON.parse(evalInScope("_menuResults.itemIDs")), [item.id]);
				assert.equal(evalInScope("_menuResults.hasItems"), "undefined");
				assert.equal(evalInScope("_menuResults.hasRows"), "undefined");
				assert.deepEqual(JSON.parse(evalInScope("_menuResults.libraryIDs")), [collection.libraryID]);
				assert.deepEqual(JSON.parse(evalInScope("_menuResults.collectionIDs")), [collection.id]);
				evalInScope("Zotero.MenuManager.unregisterMenu(_permMenuID)");

				// Without dataRead only the IDs cross
				PluginSandbox.unloadScope(ADDON_ID);
				loadTestScope(["default", "itemTree", "itemPane"]);
				evalInScope(`
					var _noReadResults = {};
					var _noReadColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-noread-col',
						label: 'No Read',
						pluginID: '${ADDON_ID}',
						dataProvider: function ({ itemID, getItem }) {
							_noReadResults.id = itemID;
							_noReadResults.item = getItem();
							_noReadResults.other = getItem(${otherItem.id});
							return 'test';
						}
					});
					var _noReadRowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-noread-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function ({ itemID, getItem, item }) {
							_noReadResults.rowItemID = itemID;
							_noReadResults.rowItem = getItem();
							_noReadResults.rowHasItem = typeof item;
							return 'test';
						}
					});
				`);
				Zotero.ItemTreeManager.getCustomCellData(item, evalInScope("_noReadColKey"));
				Zotero.ItemPaneManager.getInfoRowHook(evalInScope("_noReadRowID"), 'onGetData')(
					{ itemID: item.id, item, tabType: 'library', editable: false });
				assert.equal(evalInScope("_noReadResults.id"), item.id);
				// No key or libraryID crosses without dataRead, only the local ID
				assert.isNull(evalInScope("_noReadResults.item"));
				assert.isNull(evalInScope("_noReadResults.other"));
				assert.equal(evalInScope("_noReadResults.rowItemID"), item.id);
				assert.isNull(evalInScope("_noReadResults.rowItem"));
				assert.equal(evalInScope("_noReadResults.rowHasItem"), "undefined");
				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_noReadColKey)");
				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_noReadRowID)");
			}
			finally {
				await item.eraseTx();
				await otherItem.eraseTx();
				await collection.eraseTx();
			}
		});

		// getItem is the escape hatch for hooks that cannot await; keeping one past its hook would answer
		// for whatever item was selected when it was captured
		it("should expire a getItem stashed past its hook", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Stashed');
			await item.saveTx();
			try {
				evalInScope(`
					var _stash = {};
					var _stashColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-stash-col',
						label: 'Stash',
						pluginID: '${ADDON_ID}',
						dataProvider: function ({ getItem }) {
							_stash.getItem = getItem;
							_stash.duringHook = getItem().data.title;
							return 'test';
						}
					});
				`);
				Zotero.ItemTreeManager.getCustomCellData(item, evalInScope("_stashColKey"));
				assert.equal(evalInScope("_stash.duringHook"), 'Stashed',
					"it reads normally while the hook runs");

				evalInScope(`
					try {
						_stash.after = _stash.getItem();
					}
					catch (e) {
						_stash.after = 'threw: ' + e.message;
					}
				`);
				// The boundary sanitizes the chrome message, so only the throw itself crosses
				assert.match(evalInScope("_stash.after"), /^threw: /,
					"a stashed getItem throws instead of answering for a stale item");
				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_stashColKey)");
			}
			finally {
				await item.eraseTx();
			}
		});

		// A privileged plugin gets the new payloads without losing its deprecated live ones
		it("should pass live objects and the new ID/getItem props to privileged callbacks", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Privileged Callback Test');
			await item.saveTx();
			// No sandbox scope for this ID, so the managers treat it as privileged
			const PRIVILEGED_ID = 'privileged-callback-test@zotero.org';
			try {
				let col = {};
				let dataKey = Zotero.ItemTreeManager.registerColumn({
					dataKey: 'privileged-col',
					label: 'Privileged Column',
					pluginID: PRIVILEGED_ID,
					dataProvider: (arg, key, context) => {
						col.liveFirstArg = arg instanceof Zotero.Item;
						col.itemID = context.itemID;
						col.title = context.getItem().data.title;
						return 'test';
					}
				});
				Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
				assert.isTrue(col.liveFirstArg, "first argument stays the live item");
				assert.equal(col.itemID, item.id);
				assert.equal(col.title, 'Privileged Callback Test');
				Zotero.ItemTreeManager.unregisterColumn(dataKey);

				let row = {};
				let rowID = Zotero.ItemPaneManager.registerInfoRow({
					rowID: 'privileged-row',
					pluginID: PRIVILEGED_ID,
					label: { l10nID: 'general-print' },
					onGetData: ({ itemID, getItem, item: liveItem }) => {
						row.itemID = itemID;
						row.liveItem = liveItem instanceof Zotero.Item;
						row.title = getItem().data.title;
						return 'test';
					}
				});
				Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData')(
					{ itemID: item.id, item, tabType: 'library', editable: false });
				assert.equal(row.itemID, item.id);
				assert.isTrue(row.liveItem, "the deprecated live item rides along");
				assert.equal(row.title, 'Privileged Callback Test');
				Zotero.ItemPaneManager.unregisterInfoRow(rowID);

				let menu = {};
				let menuID = Zotero.MenuManager.registerMenu({
					menuID: 'privileged-menu',
					pluginID: PRIVILEGED_ID,
					target: 'main/library/item',
					menus: [{
						menuType: 'menuitem',
						l10nID: 'general-print',
						// Privileged menu hooks keep the legacy (event, context) signature
						onCommand: (event, context) => {
							menu.itemIDs = context.itemIDs;
							menu.liveItems = context.items?.[0] instanceof Zotero.Item;
						}
					}]
				});
				let menuOption = Zotero.MenuManager._menuManager._optionsCache[menuID];
				menuOption.menus[0].onCommand(null, { itemIDs: [item.id], items: [item] });
				assert.deepEqual(menu.itemIDs, [item.id]);
				assert.isTrue(menu.liveItems, "the deprecated live items ride along");
				Zotero.MenuManager.unregisterMenu(menuID);
			}
			finally {
				await item.eraseTx();
			}
		});

		describe("ReaderManager", function () {
			afterEach(function () {
				for (let option of Zotero.ReaderManager._sectionManager.options) {
					Zotero.ReaderManager.unregisterSection(option.sectionID);
				}
				for (let option of Zotero.ReaderManager._contextMenuManager.options) {
					Zotero.ReaderManager.unregisterContextMenuItem(option.menuItemID);
				}
			});

			it("should register and unregister a section from the sandbox", function () {
				// src resolves against the plugin's own moz-extension root
				evalInScope(`
					var _secID = Zotero.ReaderManager.registerSection({
						sectionID: 'sandbox-sec',
						target: 'textSelectionPopup',
						src: 'popup.html',
					});
				`);
				let secID = evalInScope("_secID");
				assert.isString(secID);
				assert.lengthOf(
					Zotero.ReaderManager._sectionManager.options.filter(o => o.pluginID === ADDON_ID), 1
				);

				evalInScope("Zotero.ReaderManager.unregisterSection(_secID)");
				assert.lengthOf(
					Zotero.ReaderManager._sectionManager.options.filter(o => o.pluginID === ADDON_ID), 0
				);
			});

			it("should register and unregister a context-menu item from the sandbox", function () {
				evalInScope(`
					var _miID = Zotero.ReaderManager.registerContextMenuItem({
						menuItemID: 'sandbox-item',
						target: 'annotationContextMenu',
						label: 'Sandbox item',
						onCommand: function () {},
					});
				`);
				let miID = evalInScope("_miID");
				assert.isString(miID);
				assert.lengthOf(
					Zotero.ReaderManager._contextMenuManager.options.filter(o => o.pluginID === ADDON_ID), 1
				);

				evalInScope("Zotero.ReaderManager.unregisterContextMenuItem(_miID)");
				assert.lengthOf(
					Zotero.ReaderManager._contextMenuManager.options.filter(o => o.pluginID === ADDON_ID), 0
				);
			});

			it("should not expose the raw Zotero.Reader API to unprivileged plugins", function () {
				// The direct reader-DOM event API is privileged-only now
				assert.isTrue(evalInScope("typeof Zotero.Reader === 'undefined'"),
					"Zotero.Reader should not be exposed");
			});

			it("should not expose ReaderManager internals", function () {
				assert.isTrue(evalInScope("typeof Zotero.ReaderManager.registerSection === 'function'"));
				assert.isTrue(evalInScope("typeof Zotero.ReaderManager._sectionManager === 'undefined'"),
					"_sectionManager should not be exposed");
				assert.isTrue(evalInScope("typeof Zotero.ReaderManager._handleEvent === 'undefined'"),
					"_handleEvent should not be exposed");
			});
		});
	});

	describe("Main window access removal", function () {
		it("should block chrome windows and DOM nodes crossing into the sandbox", async function () {
			loadTestScope(["default"]);
			// Windows has no main window left at this point of the suite
			let mainWin = Zotero.getMainWindow() || await loadZoteroPane();
			scope._hostWin = ScopeVariables.toScope(mainWin, ADDON_ID);
			scope._hostNode = ScopeVariables.toScope(mainWin.document.documentElement, ADDON_ID);
			scope._hostEvent = ScopeVariables.toScope(new mainWin.CustomEvent("test"), ADDON_ID);
			assert.isTrue(evalInScope("typeof _hostWin === 'undefined'"),
				"a chrome window must not cross into the sandbox");
			assert.isTrue(evalInScope("typeof _hostNode === 'undefined'"),
				"a chrome DOM node must not cross into the sandbox");
			assert.isTrue(evalInScope("typeof _hostEvent === 'undefined'"),
				"a chrome event must not cross into the sandbox");
		});
	});

	describe("Access control", function () {
		it("should not expose unlisted Zotero properties", function () {
			loadTestScope(["default"]);
			// These are internal properties not in the schema
			assert.isTrue(evalInScope("typeof Zotero.DB === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Schema === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Sync === 'undefined'"));
		});

		it("should not expose privileged globals", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof ChromeUtils === 'undefined'"));
			assert.isTrue(evalInScope("typeof Services === 'undefined'"));
			assert.isTrue(evalInScope("typeof IOUtils === 'undefined'"));
			assert.isTrue(evalInScope("typeof PathUtils === 'undefined'"));
		});

		// Queries take a library and key as well as an ID, a path with no coverage until it broke
		it("should resolve a query addressed by libraryID and key", async function () {
			loadTestScope(["default", "dataRead"]);
			let item = new Zotero.Item('book');
			item.setField('title', 'Key Addressed');
			await item.saveTx();
			try {
				let res = await evalInScope(`Zotero.DataStore.query("item", `
					+ `{ libraryID: ${item.libraryID}, key: "${item.key}" })`);
				assert.isTrue(res.success, res.error && res.error.message);
				assert.equal(res.result.id, item.id);
				assert.equal(res.result.data.title, 'Key Addressed');

				let missing = await evalInScope(`Zotero.DataStore.query("item", `
					+ `{ libraryID: ${item.libraryID}, key: "ZZZZ9999" })`);
				assert.isFalse(missing.success);
				assert.equal(missing.error.code, Zotero.DataStore.errorCodes.NOT_FOUND);
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should commit a change set built in the sandbox", async function () {
			loadTestScope(["default", "dataWrite"]);
			let item = new Zotero.Item('book');
			item.setField('title', 'Before');
			await item.saveTx();
			try {
				let res = await evalInScope(`Zotero.DataStore.commit(`
					+ `Zotero.DataStore.ChangeSet.item(${item.id}).setField("title", "From the sandbox"))`);
				assert.isTrue(res.success, res.error && res.error.message);
				assert.equal(res.result.objects[0].id, item.id);
				assert.equal(item.getField('title'), 'From the sandbox');
			}
			finally {
				await item.eraseTx();
			}
		});

		// A note far past any 32K chunk boundary survives both directions of the boundary
		it("should carry a long note across the boundary intact", async function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
			let item = new Zotero.Item('note');
			item.setNote('<p>short</p>');
			await item.saveTx();
			try {
				let res = await evalInScope(`(async () => {
					let note = "<p>" + "段落 paragraph 🚀 ".repeat(15000) + "</p>";
					let committed = await Zotero.DataStore.commit(Zotero.DataStore.ChangeSet.item(${item.id}).setNote(note));
					if (!committed.success) return { failed: "commit: " + committed.error.message };
					let back = await Zotero.DataStore.query("item", { itemID: ${item.id} });
					if (!back.success) return { failed: "query: " + back.error.message };
					return { length: note.length, intact: back.result.data.note === note };
				})()`);
				assert.isUndefined(res.failed, res.failed);
				assert.equal(item.getNote().length, res.length);
				assert.isTrue(res.intact);
			}
			finally {
				await item.eraseTx();
			}
		});

		// The schema hides commit from a scope without dataWrite; the store's own gate is what stops a
		// call made on such a scope's behalf, so it is exercised from chrome
		it("should refuse a commit on behalf of a scope without dataWrite", async function () {
			loadTestScope(["default", "dataRead"]);
			let item = new Zotero.Item('book');
			item.setField('title', 'Read only');
			await item.saveTx();
			try {
				let res = await Zotero.DataStore.commit(
					Zotero.DataStore.ChangeSet.item(item.id).setField("title", "Written"), {}, ADDON_ID);
				assert.isFalse(res.success);
				assert.equal(res.error.code, Zotero.DataStore.errorCodes.PERMISSION_DENIED);
				assert.equal(item.getField('title'), 'Read only');
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should not allow setting listed properties on Zotero sub-objects", function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
			// The mirror is created with mutable: false, so setting listed props should throw
			assert.throws(() => evalInScope("Zotero.DataStore.query = function() {}"),
				undefined, undefined, "Setting Zotero.DataStore.query should throw");
			// The function should still work
			assert.isTrue(evalInScope("typeof Zotero.DataStore.query === 'function'"));
		});
	});

	describe("Permission isolation", function () {
		it("should not expose data APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.DataStore === 'undefined'"),
				"DataStore should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Notifier === 'undefined'"),
				"Notifier should not be exposed without data permission");
		});

		it("should expose File.reveal and launchURL with userPrompt only", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.File === 'object'"),
				"File should be exposed with default permission");
			assert.equal(evalInScope("typeof Zotero.File.reveal"), "undefined",
				"File.reveal hands the user's attention to another application, so it needs userPrompt");
			assert.equal(evalInScope("typeof Zotero.launchURL"), "undefined");
			assert.isTrue(evalInScope("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed without fileSystemRead");
			loadTestScope(["default", "userPrompt"]);
			assert.equal(evalInScope("typeof Zotero.File.reveal"), "function");
			assert.equal(evalInScope("typeof Zotero.launchURL"), "function");
		});

		it("should expose network APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed to every scope, bounded by host_permissions");
		});

		it("should not expose preferences APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Prefs === 'undefined'"),
				"Prefs should not be exposed without preferences permission");
		});

		it("should not expose translator APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'undefined'"),
				"Translators should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Translate === 'undefined'"),
				"Translate should not be exposed without dataWrite permission");
		});

		it("should imply dataRead when dataWrite is granted", function () {
			// Only declare dataWrite -- dataRead should be implied
			loadTestScope(["default", "dataWrite"]);

			// dataRead APIs should be available
			assert.isTrue(evalInScope("typeof Zotero.DataStore.query === 'function'"),
				"DataStore.query should be exposed via implied dataRead");
			assert.isTrue(evalInScope("typeof Zotero.DataStore.ChangeSet === 'function'"),
				"DataStore.ChangeSet should be exposed via implied dataRead");
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'object'"),
				"Translators should be exposed via implied dataRead");

			// dataWrite APIs should also be available
			assert.isTrue(evalInScope("typeof Zotero.DataStore.commit === 'function'"),
				"DataStore.commit should be exposed with dataWrite");
			assert.isTrue(evalInScope("typeof Zotero.Translate === 'object'"),
				"Translate should be exposed with dataWrite");
		});

		it("should not expose UI APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemPaneManager === 'undefined'"),
				"ItemPaneManager should not be exposed without itemPane permission");
			assert.isTrue(evalInScope("typeof Zotero.MenuManager === 'undefined'"),
				"MenuManager should not be exposed without menu permission");
			assert.isTrue(evalInScope("typeof Zotero.Reader === 'undefined'"),
				"Reader should not be exposed without reader permission");
			assert.isTrue(evalInScope("typeof Zotero.PreferencePanes === 'undefined'"),
				"PreferencePanes should not be exposed without preferencePane permission");
		});

		it("should expose data APIs but not fileSystem with data permission", function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
			assert.isTrue(evalInScope("typeof Zotero.DataStore === 'object'"),
				"DataStore should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed with only data permission");
		});

		it("should expose fileSystem APIs but not data with fileSystem permission", function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
			assert.isTrue(evalInScope("typeof Zotero.FileStore === 'object'"),
				"FileStore should be exposed with fileSystem permission");
			assert.isTrue(evalInScope("typeof Zotero.DataStore === 'undefined'"),
				"DataStore should not be exposed with only fileSystem permission");
		});

		it("should merge multiple permissions correctly", function () {
			loadTestScope(["default", "dataRead", "dataWrite", "preferences"], [], ["test."]);
			assert.isTrue(evalInScope("typeof Zotero.DataStore === 'object'"),
				"DataStore should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed to every scope");
			assert.isTrue(evalInScope("typeof Zotero.Prefs === 'object'"),
				"Prefs should be exposed with preferences permission");
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'object'"),
				"Translators should be exposed with translator permission");
			assert.isTrue(evalInScope("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed without fileSystemRead permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
		});

		it("should still expose default APIs (logging, platform info, utilities) regardless of permissions", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.debug === 'function'"),
				"debug should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.warn === 'function'"),
				"warn should always be exposed");
			assert.isString(evalInScope("Zotero.version"),
				"version should always be exposed");
			assert.isBoolean(evalInScope("Zotero.isMac"),
				"isMac should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Utilities === 'object'"),
				"Utilities should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Utilities.cleanDOI === 'function'"),
				"Utilities.cleanDOI should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Date === 'object'"),
				"Date should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Date.strToISO === 'function'"),
				"Date.strToISO should always be exposed");
		});
	});

	describe("plugin resource web-accessibility", function () {
		function canLoad(sourcePrincipal, targetURI) {
			try {
				Services.scriptSecurityManager.checkLoadURIWithPrincipal(
					sourcePrincipal, targetURI, Ci.nsIScriptSecurityManager.STANDARD
				);
				return true;
			}
			catch {
				return false;
			}
		}

		it("blocks web content from loading plugin resources, allows self/chrome", function () {
			loadTestScope(["default"]);
			let policy = WebExtensionPolicy.getByID(ADDON_ID);
			let resURI = Services.io.newURI(policy.getURL("resources.html"));
			let secMan = Services.scriptSecurityManager;

			let webPrincipal = secMan.createContentPrincipal(
				Services.io.newURI("https://example.com/"), {}
			);
			let selfPrincipal = secMan.createContentPrincipal(resURI, {});

			assert.isFalse(canLoad(webPrincipal, resURI),
				"arbitrary web content must not load plugin resources");
			assert.isTrue(canLoad(selfPrincipal, resURI),
				"the plugin's own origin must load its resources");
			assert.isTrue(canLoad(secMan.getSystemPrincipal(), resURI),
				"chrome (system principal) must load plugin resources");
		});
	});

	describe("plugin page CSP", function () {
		it("defaults to the manifestVersion-3 page CSP when the plugin declares none", function () {
			loadTestScope(["default"]);
			let policy = WebExtensionPolicy.getByID(ADDON_ID);
			// With no manifest content_security_policy the page gets the MV3
			// default (script-src 'self'); a plugin can override it (see below).
			assert.include(policy.extensionPageCSP, "script-src 'self'");
			assert.notInclude(policy.extensionPageCSP, "unsafe-eval");
		});
	});

	describe("openPluginWindow command", function () {
		// Tests keep the old positional call shape through this adapter onto the command,
		// which unwraps the response and throws a failure as "<code>: <message>"
		const OPEN_WINDOW_SHIM = "var openWindow = (url, features, options) => Zotero.WindowController"
			+ ".command('openPluginWindow', Object.assign({ url, features }, options || {}))"
			+ ".then(r => { if (!r.success) throw new Error(r.error.code + ': ' + r.error.message); return r.result; });";

		// Cleanup through the controller; a window that is already gone is fine
		async function closeWin(name = "_win", inScope = scope) {
			let { success, error } = await Cu.evalInSandbox(
				`Zotero.WindowController.command("closeWindow", { windowID: ${name}.windowID })`, inScope
			);
			if (!success && error.code !== "NotFound") {
				throw new Error(`${error.code}: ${error.message}`);
			}
		}

		it("should reject disallowed URLs (external, file://, and non-.html files)", async function () {
			loadTestScope(["default", "window"]);
			let badURLs = [
				"https://example.com/page.html",
				"file:///etc/page.html",
				"settings.xhtml",
				"dialog.xul",
				"script.js",
			];
			for (let url of badURLs) {
				let { success, error } = await evalInScope(
					`Zotero.WindowController.command("openPluginWindow", { url: ${JSON.stringify(url)} })`
				);
				assert.isFalse(success, `${url} should be rejected`);
				assert.equal(error.code, "InvalidParams");
			}
		});

		it("should take features as an object of booleans and numbers", async function () {
			loadTestScope(["default", "window"]);
			let bad = ['"width=300,height=200"', '["centerscreen"]', '{ width: "300" }', '{ centerscreen: null }'];
			for (let features of bad) {
				let { success, error } = await evalInScope(
					`Zotero.WindowController.command("openPluginWindow", { url: "test.html", features: ${features} })`
				);
				assert.isFalse(success, `${features} should be rejected`);
				assert.equal(error.code, "InvalidParams");
			}
		});

		it("should keep only the allowed features and format them for openWindow", function () {
			let { sanitizeWindowFeatures } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/embeddedPage.mjs");
			let { str, values } = sanitizeWindowFeatures({
				centerscreen: true, width: 300, resizable: false, modal: true, chrome: true,
			});
			assert.equal(str, "centerscreen,width=300,resizable=no");
			assert.deepEqual(values, { centerscreen: true, width: 300, resizable: false });
			assert.deepEqual(sanitizeWindowFeatures(), { str: "", values: {} });
		});

		describe("should work with real HTML file", function () {
			var tmpDir;
			var mainWin;

			function loadTestScopeWithURI(permissions, contentSecurityPolicy = null) {
				// Point the plugin root at the temp dir holding our test HTML file.
				mockAddon = createMockPlugin({
					id: ADDON_ID,
					name: "Test Sandbox Plugin",
					syncGUID: "{00000000-0000-0000-0000-000000000002}",
					permissions,
					contentSecurityPolicy,
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				});
				PluginSandbox.loadScope(mockAddon);
				scope = PluginSandbox.getScope(ADDON_ID);
				evalInScope(OPEN_WINDOW_SHIM);
			}

			// The wrapper window's content never crosses into the sandbox, so
			// tests reach it chrome-side instead (newest window last)
			function getPluginWindowBrowsers() {
				let browsers = [];
				for (let win of Services.wm.getEnumerator(null)) {
					if (win.location.href === "chrome://zotero/content/pluginWindow.xhtml") {
						browsers.push(win.document.getElementById("plugin-browser"));
					}
				}
				return browsers;
			}

			function getLastPluginWindowContent() {
				let browsers = getPluginWindowBrowsers();
				return browsers.length
					? browsers[browsers.length - 1].contentWindow
					: null;
			}

			before(async function () {
				mainWin = await loadZoteroPane();
				tmpDir = await getTempDirectory();
				// Create a simple HTML file in the temp directory
				let htmlContent = "<!DOCTYPE html><html><head><title>Test</title></head>"
					+ "<body><div id='test-div'>Hello</div></body></html>";
				await FileIO.writeUTF8(PathUtils.join(tmpDir, "test.html"), htmlContent);
				// Also create an XHTML file to test rejection
				await FileIO.writeUTF8(PathUtils.join(tmpDir, "test.xhtml"), "<html></html>");
				// Create CSS and JS files for resource loading test
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "style.css"),
					"#test-div { color: rgb(255, 0, 0); }"
				);
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "script.js"),
					"document.getElementById('test-div').setAttribute('data-script-loaded', 'true');\n"
					+ "window._pluginScriptLoaded = true;"
				);
				let resourceHtml = "<!DOCTYPE html><html><head><title>Resources</title>"
					+ '<link rel="stylesheet" href="style.css">'
					+ "</head><body><div id='test-div'>Styled</div>"
					+ '<script src="script.js"></script></body></html>';
				await FileIO.writeUTF8(PathUtils.join(tmpDir, "resources.html"), resourceHtml);
				// Page that echoes plugin messages and relays zoteroHost.api calls,
				// for page-messenger tests (external script to satisfy the page CSP)
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "echo.js"),
					"function reportAPI(promise) {\n"
					+ "  promise.then(\n"
					+ "    function (result) {\n"
					+ "      zoteroHost.sendMessage({ type: 'api-result', result: result === undefined ? null : result });\n"
					+ "    },\n"
					+ "    function (e) {\n"
					+ "      zoteroHost.sendMessage({ type: 'api-error', message: String(e && e.message || e) });\n"
					+ "    }\n"
					+ "  );\n"
					+ "}\n"
					+ "zoteroHost.addMessageListener(function (data) {\n"
					+ "  if (!data) return;\n"
					+ "  if (data.type === 'ping') {\n"
					+ "    zoteroHost.sendMessage({ type: 'pong', value: data.value });\n"
					+ "  }\n"
					+ "  else if (data.type === 'request-close') {\n"
					+ "    zoteroHost.api.close();\n"
					+ "  }\n"
					+ "  else if (data.type === 'call-api') {\n"
					+ "    reportAPI(zoteroHost.api[data.name](data.params));\n"
					+ "  }\n"
					+ "  else if (data.type === 'call-api-bad') {\n"
					+ "    reportAPI(zoteroHost.api.echoBack('not-an-object'));\n"
					+ "  }\n"
					+ "});\n"
				);
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "echo.html"),
					"<!DOCTYPE html><html><head><title>Echo</title></head>"
					+ '<body><script src="echo.js"></script></body></html>'
				);
				// Fixed-size page larger than its window features, for fitContent
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "fixed-size.html"),
					"<!DOCTYPE html><html><head><title>Fixed</title>"
					+ "<style>html, body { margin: 0; padding: 0; }</style></head>"
					+ "<body><div style='width: 500px; height: 400px;'></div></body></html>"
				);
				// Create an HTML + external JS that probes privileged APIs
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "probe.js"),
					"var apis = ['ChromeUtils', 'Services', 'IOUtils', 'PathUtils', 'Cu', 'Cc', 'Ci', 'Zotero'];\n"
					+ "var r = document.getElementById('results');\n"
					+ "apis.forEach(function(name) {\n"
					+ "  r.setAttribute('data-' + name.toLowerCase(), typeof window[name]);\n"
					+ "});\n"
					+ "try {\n"
					+ "  Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);\n"
					+ "  r.setAttribute('data-xpcom-blocked', 'false');\n"
					+ "} catch(e) {\n"
					+ "  r.setAttribute('data-xpcom-blocked', 'true');\n"
					+ "}\n"
				);
				let privilegedProbeHtml = "<!DOCTYPE html><html><head><title>Privilege Probe</title></head>"
					+ "<body><div id='results'></div>"
					+ '<script src="probe.js"></script></body></html>';
				await FileIO.writeUTF8(PathUtils.join(tmpDir, "privileged.html"), privilegedProbeHtml);

				// CSP probe: a same-origin external script that records whether
				// eval() is permitted by the page's Content-Security-Policy.
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "csp-probe.js"),
					"window._probeRan = true;\n"
					+ "try {\n"
					+ "  window._evalStatus = (window.eval('21 + 21') === 42) ? 'allowed' : 'blocked-silent';\n"
					+ "} catch (e) {\n"
					+ "  window._evalStatus = 'blocked';\n"
					+ "}\n"
					// Minimal valid empty wasm module ("\\0asm" + version 1). Its
					// compilation is gated by 'wasm-unsafe-eval' in script-src.
					+ "try {\n"
					+ "  new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));\n"
					+ "  window._wasmStatus = 'allowed';\n"
					+ "} catch (e) {\n"
					+ "  window._wasmStatus = 'blocked';\n"
					+ "}\n"
				);
				// Inline script (should be blocked by 'self'-only script-src) plus
				// the external eval probe (external same-origin script is allowed).
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "csp-inline.html"),
					"<!DOCTYPE html><html><head></head><body>"
					+ "<script>window._inlineRan = true;</script>"
					+ '<script src="csp-probe.js"></script></body></html>'
				);
				// A page trying to loosen its own CSP via <meta> to allow eval.
				// meta can only tighten, so eval should still be blocked.
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "csp-meta.html"),
					"<!DOCTYPE html><html><head>"
					+ '<meta http-equiv="Content-Security-Policy" '
					+ "content=\"script-src 'self' 'unsafe-eval'\">"
					+ "</head><body>"
					+ '<script src="csp-probe.js"></script></body></html>'
				);
			});

			after(async function () {
				mainWin.close();
				await FileIO.remove(tmpDir, { recursive: true });
			});

			// The handle's properties are sandbox-side accessors, so the tests
			// drive it from inside the sandbox, the way a plugin would
			it("should open an .html window and resolve with a page handle", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let alive = await evalInScope(`
					openWindow('test.html').then(function (win) {
						_win = win;
						return win.page.isAlive();
					});
				`);
				try {
					assert.isTrue(alive, "the page messenger should be alive");
					// The content window stays chrome-side
					let contentWin = getLastPluginWindowContent();
					assert.equal(contentWin.document.title, "Test");
				}
				finally {
					await closeWin();
				}
			});

			it("should fail with NotFound when the page does not load", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let { success, result, error } = await evalInScope(
					'Zotero.WindowController.command("openPluginWindow", { url: "missing.html" })'
				);
				if (success) {
					await evalInScope(`Zotero.WindowController.command("closeWindow", { windowID: ${result.windowID} })`);
				}
				assert.isFalse(success, "a missing page should not open a window");
				assert.equal(error.code, "NotFound");
			});

			it("should take its params as one object and resolve with a live handle", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope(`
					Zotero.WindowController.command("openPluginWindow", {
						url: "test.html", features: { width: 300, height: 200 }, notitle: true,
					}).then(function (r) { _win = r.result; });
				`);
				try {
					assert.isTrue(evalInScope("typeof _win.page.isAlive === 'function' && _win.page.isAlive()"));
					assert.isNumber(evalInScope("_win.windowID"));
				}
				finally {
					await closeWin();
				}
			});

			it("should map window drag attributes via the injected user sheet", async function () {
				// The page can't use -moz-window-dragging itself (chrome-only CSS,
				// dropped from moz-extension author sheets), only the attributes
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "drag.html"),
					"<!DOCTYPE html><html><head><title>Drag</title></head>"
					+ "<body><div id='bar' window-dragging>"
					+ "<button id='btn'>x</button></div>"
					+ "<div id='free' window-no-drag></div></body></html>"
				);
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('drag.html').then(function (win) { _win = win; })");
				try {
					let browser = getPluginWindowBrowsers().pop();
					assert.isTrue(browser.docShell.windowDraggingAllowed,
						"the plugin window browser should allow window dragging");
					let InspectorUtils = browser.ownerDocument.defaultView.InspectorUtils;
					// The chrome-only property is hidden from CSSOM getPropertyValue
					// in content documents, so read it from the serialized rule text
					let getDrag = (id) => {
						let el = browser.contentWindow.document.getElementById(id);
						let value = "";
						for (let rule of InspectorUtils.getMatchingCSSRules(el)) {
							let m = rule.cssText.match(/-moz-window-dragging: ([\w-]+)/);
							if (m) {
								value = m[1];
							}
						}
						return value;
					};
					assert.equal(getDrag("bar"), "drag",
						"window-dragging should map to -moz-window-dragging: drag");
					assert.equal(getDrag("btn"), "no-drag",
						"interactive elements inside a drag area should opt out");
					assert.equal(getDrag("free"), "no-drag",
						"window-no-drag should map to -moz-window-dragging: no-drag");
				}
				finally {
					await closeWin();
				}
			});

			it("should hand the sandbox the page messenger and window controls only", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('test.html').then(function (win) { _win = win; })");
				try {
					assert.equal(
						evalInScope("Object.keys(_win).sort().join(',')"),
						"page,windowID",
						"the handle should expose the page and its window ID only"
					);
					assert.equal(
						evalInScope("Object.keys(_win.page).sort().join(',')"),
						"addMessageListener,isAlive,removeMessageListener,sendMessage",
						"the messenger should expose only the messaging methods"
					);
				}
				finally {
					await closeWin();
				}
			});

			it("should report its window's state by ID and refuse it once closed", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('test.html', { width: 300, height: 200 }).then(function (win) { _win = win; })");
				let browsers = getPluginWindowBrowsers();
				let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
				let windowID = chromeWin.browsingContext.id;
				try {
					assert.equal(evalInScope("_win.windowID"), windowID, "the handle should carry the controller window ID");
					let { result: state } = await evalInScope('Zotero.WindowController.query("getWindowState", { windowID: _win.windowID })');
					assert.deepEqual(
						JSON.parse(JSON.stringify(state)),
						(await Zotero.WindowController.query("getWindowState", { windowID })).result,
						"the sandbox and chrome should agree on the state"
					);
					assert.deepEqual([state.width, state.height], [chromeWin.outerWidth, chromeWin.outerHeight]);

					await evalInScope('Zotero.WindowController.command("closeWindow", { windowID: _win.windowID })');
					// closed flips first; the page channel goes down with the teardown that follows
					for (let attempt = 0; attempt < 100 && evalInScope("_win.page.isAlive()"); attempt++) {
						await Zotero.Promise.delay(20);
					}
					assert.isTrue(chromeWin.closed, "closeWindow should close the wrapper");
					assert.isFalse(evalInScope("_win.page.isAlive()"), "the page channel should be down after the close");
					// A closed window is gone for the controller too
					let { error } = await evalInScope('Zotero.WindowController.query("getWindowState", { windowID: _win.windowID })');
					assert.match(error.message, /No window with ID/);
					({ error } = await evalInScope('Zotero.WindowController.command("closeWindow", { windowID: _win.windowID })'));
					assert.match(error.message, /No window with ID/);
				}
				finally {
					await closeWin();
				}
			});

			it("should open the window with a parent when given a window ID", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let mainWindow = Zotero.getMainWindow();
				await evalInScope(`
					openWindow('test.html', { width: 300, height: 200, dependent: true }, { parentWindowID: ${mainWindow.browsingContext.id} })
						.then(function (win) { _win = win; });
				`);
				let browsers = getPluginWindowBrowsers();
				let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
				try {
					assert.strictEqual(chromeWin.opener, mainWindow, "the parent should be the opener");
					let appWindow = chromeWin.docShell.treeOwner
						.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIAppWindow);
					assert.ok(appWindow.chromeFlags & Ci.nsIWebBrowserChrome.CHROME_DEPENDENT, "dependent should be honored");

					// A handle's windowID parents another plugin window
					await evalInScope(`
						openWindow('test.html', { width: 300, height: 200 }, { parentWindowID: _win.windowID })
							.then(function (win) { _child = win; });
					`);
					let childBrowsers = getPluginWindowBrowsers();
					let childWin = childBrowsers[childBrowsers.length - 1].ownerDocument.defaultView;
					try {
						assert.strictEqual(childWin.opener, chromeWin, "a plugin window should parent another");
					}
					finally {
						await closeWin("_child");
					}

					let parentError = await getPromiseError(evalInScope("openWindow('test.html', {}, { parentWindowID: -1 })"));
					assert.match(String(parentError.message), /No window with ID/);
				}
				finally {
					await closeWin();
				}
			});

			it("should expose its own windows to Zotero.WindowController but not other plugins'", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('test.html').then(function (win) { _win = win; })");
				let windowID = evalInScope("_win.windowID");
				// A second unprivileged plugin with the same permission
				const OTHER_ID = "other-sandbox-plugin@zotero.org";
				PluginSandbox.loadScope(createMockPlugin({
					id: OTHER_ID,
					name: "Other Sandbox Plugin",
					syncGUID: "{00000000-0000-0000-0000-000000000003}",
					permissions: ["default", "window"],
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				}));
				let otherScope = PluginSandbox.getScope(OTHER_ID);
				Cu.evalInSandbox(OPEN_WINDOW_SHIM, otherScope);
				try {
					let { result: { windows } } = await evalInScope(
						'Zotero.WindowController.query("windows", { type: "pluginWindow" })'
					);
					windows = Array.from(windows);
					assert.include(windows.map(w => w.windowID), windowID, "the owner should list its window");
					assert.isTrue(windows.every(w => w.type === "pluginWindow" && w.pluginID === ADDON_ID),
						"the owner should list only its own windows");
					let { result: state } = await evalInScope(
						`Zotero.WindowController.query("getWindowState", { windowID: ${windowID} })`
					);
					assert.isNumber(state.width);

					({ result: { windows } } = await Cu.evalInSandbox(
						'Zotero.WindowController.query("windows", { type: "pluginWindow" })', otherScope
					));
					assert.notInclude(Array.from(windows).map(w => w.windowID), windowID,
						"another plugin should not list the window");
					let { error } = await Cu.evalInSandbox(
						`Zotero.WindowController.query("getWindowState", { windowID: ${windowID} })`, otherScope
					);
					assert.match(error.message, /No window with ID/);
					({ error } = await Cu.evalInSandbox(
						`Zotero.WindowController.command("focusWindow", { windowID: ${windowID} })`, otherScope
					));
					assert.match(error.message, /No window with ID/);
					let e = await getPromiseError(
						Cu.evalInSandbox(`openWindow('test.html', {}, { parentWindowID: ${windowID} })`, otherScope)
					);
					assert.match(String(e.message), /No window with ID/);
				}
				finally {
					PluginSandbox.unloadScope(OTHER_ID);
					await closeWin();
				}
			});

			it("should parent a FilePicker to its own plugin window by ID and nothing else", async function () {
				loadTestScopeWithURI(["default", "window", "fileSystemRead"]);
				await evalInScope("openWindow('test.html').then(function (win) { _win = win; })");
				let { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
				// Swap the native picker under each instance for a spy, so init() shows no dialog
				let initSpy = sinon.spy();
				let makePicker = (name) => {
					evalInScope(`var ${name} = new FilePicker();`);
					VarCheck.getOriginalOrSelf(scope[name])._fp = { init: initSpy };
				};
				try {
					let browsers = getPluginWindowBrowsers();
					let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
					makePicker("_fp");
					evalInScope('_fp.init(_win.windowID, "Own window parent", _fp.modeOpen)');
					assert.strictEqual(initSpy.lastCall.args[0], chromeWin.browsingContext,
						"the plugin's own window should be the parent");

					// Anything else -- no parent, an unknown ID, a window that isn't the plugin's -- gets the platform's
					// fallback: the hidden window on macOS, the main window elsewhere
					let fallback = (Zotero.isMac ? Services.appShell.hiddenDOMWindow : Zotero.getMainWindow()).browsingContext;
					for (let [name, parent] of [["_fp2", "null"], ["_fp3", "-1"], ["_fp4", String(mainWin.browsingContext.id)]]) {
						makePicker(name);
						evalInScope(`${name}.init(${parent}, "Other parent", ${name}.modeOpen)`);
						assert.strictEqual(initSpy.lastCall.args[0], fallback, `${parent} should parent to the fallback window`);
					}
				}
				finally {
					await closeWin();
				}
			});

			it("should message the page over the page messenger", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let pongPromise = new Promise((resolve) => {
					scope._resolvePong = resolve;
				});
				await evalInScope(`
					openWindow('echo.html').then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && data.type == 'pong') {
								_resolvePong(data.value);
							}
						});
						win.page.sendMessage({ type: 'ping', value: 42 });
					});
				`);
				try {
					assert.equal(await pongPromise, 42, "the page should echo over zoteroHost");
				}
				finally {
					await closeWin();
				}
			});

			it("should close the window when the page calls the close host API", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('echo.html').then(function (win) { _win = win; })");
				let browsers = getPluginWindowBrowsers();
				let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
				evalInScope("_win.page.sendMessage({ type: 'request-close' })");
				for (let i = 0; i < 100 && !chromeWin.closed; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.isTrue(chromeWin.closed, "the wrapper window should close");
				assert.isFalse(evalInScope("_win.page.isAlive()"),
					"the page messenger should be dead");
			});

			it("should let the page control its own window via zoteroHost.api", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let pending = [];
				scope._reportAPI = (json) => {
					pending.shift()?.(JSON.parse(json));
				};
				await evalInScope(`
					openWindow('echo.html', { width: 300, height: 200 }).then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && (data.type == 'api-result' || data.type == 'api-error')) {
								_reportAPI(JSON.stringify(data));
							}
						});
					});
				`);
				let sendToPage = (data) => {
					let report = new Promise(resolve => pending.push(resolve));
					scope._toPage = JSON.stringify(data);
					evalInScope("_win.page.sendMessage(JSON.parse(_toPage))");
					return report;
				};
				let browsers = getPluginWindowBrowsers();
				let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
				try {
					let x = chromeWin.screen.availLeft + 60;
					let y = chromeWin.screen.availTop + 60;
					let result = await sendToPage({ type: "call-api", name: "moveTo", params: { x, y } });
					assert.equal(result.type, "api-result", "moveTo should resolve");
					for (let attempt = 0; attempt < 100 && (chromeWin.screenX !== x || chromeWin.screenY !== y); attempt++) {
						await Zotero.Promise.delay(20);
					}
					assert.deepEqual([chromeWin.screenX, chromeWin.screenY], [x, y]);

					result = await sendToPage({ type: "call-api", name: "getState", params: {} });
					assert.equal(result.type, "api-result");
					assert.deepEqual(
						result.result,
						(await Zotero.WindowController.query("getWindowState", { windowID: chromeWin.browsingContext.id })).result
					);
				}
				finally {
					await closeWin();
				}
			});

			it("should dispatch zoteroHost.api calls to host handlers with object params", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let pending = [];
				scope._reportAPI = (json) => {
					pending.shift()?.(JSON.parse(json));
				};
				await evalInScope(`
					openWindow('echo.html').then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && (data.type == 'api-result' || data.type == 'api-error')) {
								_reportAPI(JSON.stringify(data));
							}
						});
					});
				`);
				let sendToPage = (data) => {
					let report = new Promise(resolve => pending.push(resolve));
					scope._toPage = JSON.stringify(data);
					evalInScope("_win.page.sendMessage(JSON.parse(_toPage))");
					return report;
				};
				let traceLines = [];
				let traceListener = (line) => {
					if (line.includes("[PluginTrace]")) {
						traceLines.push(line);
					}
				};
				Zotero.Debug.addListener(traceListener);
				try {
					// Extend this window's host API chrome-side for a round-trip check
					let browsers = getPluginWindowBrowsers();
					let actor = browsers[browsers.length - 1].browsingContext
						.currentWindowGlobal.getActor("ZoteroEmbeddedPluginPage");
					actor.setHostAPI({
						echoBack: params => ({ doubled: params.value * 2 }),
					});

					let result = await sendToPage({ type: "call-api", name: "echoBack", params: { value: 21 } });
					assert.equal(result.type, "api-result", "declared API should resolve");
					assert.equal(result.result.doubled, 42, "params and result should round-trip");
					// The call is traced under the page it came from
					let traced = traceLines.find(l => l.includes("[call]") && l.includes("/echo.html:zoteroHost.api.echoBack"));
					assert.ok(traced, "Should trace the page's host API call. All traces: " + JSON.stringify(traceLines));
					assert.include(traced, ADDON_ID);

					let unknown = await sendToPage({ type: "call-api", name: "nope", params: {} });
					assert.equal(unknown.type, "api-error", "undeclared API should reject");
					traced = traceLines.find(l => l.includes("/echo.html:zoteroHost.api.nope"));
					assert.ok(traced, "Should trace the refused call too");
					assert.include(traced, "failed: Error");

					let badParams = await sendToPage({ type: "call-api-bad" });
					assert.equal(badParams.type, "api-error", "non-object params should reject");
					assert.include(badParams.message, "plain object");
				}
				finally {
					Zotero.Debug.removeListener(traceListener);
					await closeWin();
				}
			});

			it("should fit the window to the page content with fitContent", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope(`
					openWindow('fixed-size.html', { width: 300, height: 200 }, { fitContent: true })
						.then(function (win) { _win = win; });
				`);
				let browsers = getPluginWindowBrowsers();
				let browser = browsers[browsers.length - 1];
				try {
					// The page actor reports the document scroll size and the
					// wrapper window follows once the size is applied
					for (let i = 0; i < 100 && browser.getBoundingClientRect().width < 499; i++) {
						await Zotero.Promise.delay(20);
					}
					let rect = browser.getBoundingClientRect();
					assert.approximately(rect.width, 500, 2, "browser should take the content width");
					assert.approximately(rect.height, 400, 2, "browser should take the content height");
				}
				finally {
					await closeWin();
				}
			});

			it("blocks a cross-origin (remote) script via the page CSP script-src 'self'", async function () {
				// Same-origin moz-extension resources are CSP-exempt, so only a
				// CROSS-ORIGIN load reveals whether script-src 'self' is enforced.
				let remoteURL = registerServerEndpoint("GET", function () {
					return [200, "application/javascript", "window._remoteRan = true;"];
				});
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "remote-script.html"),
					"<!DOCTYPE html><html><head></head><body>"
					+ `<script src="${remoteURL}"></script>`
					+ "</body></html>"
				);
				loadTestScopeWithURI(["default", "window"]);
				// openWindow resolves once the document has loaded, and a parser-inserted script runs
				// before that, so an allowed script would already have left its mark
				await evalInScope("openWindow('remote-script.html').then(function (win) { _win = win; })");
				let contentWin = getLastPluginWindowContent();
				try {
					assert.notOk(contentWin.wrappedJSObject._remoteRan,
						"a cross-origin script must be blocked by the extension-page CSP");
				}
				finally {
					await closeWin();
				}
			});

			// Fresh-id plugin with a declared CSP; opens a page whose external
			// (CSP-allowed) probe does a remote fetch, and returns the fetch status.
			async function remoteFetchStatus(id, guid, csp, remoteURL) {
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "remote-fetch-probe.js"),
					"window._fetchStatus = 'pending';\n"
					// no-cors so a CORS rejection isn't mistaken for a CSP block;
					// 127.0.0.1 is loopback, so no mixed-content block either.
					+ `fetch(${JSON.stringify(remoteURL)}, { mode: 'no-cors' }).then(\n`
					+ "  function () { window._fetchStatus = 'allowed'; },\n"
					+ "  function () { window._fetchStatus = 'blocked'; }\n"
					+ ");\n"
				);
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "remote-fetch.html"),
					"<!DOCTYPE html><html><head></head><body>"
					+ '<script src="remote-fetch-probe.js"></script></body></html>'
				);
				let addon = createMockPlugin({
					id,
					name: "CSP Remote " + id,
					syncGUID: guid,
					permissions: ["default", "window"],
					contentSecurityPolicy: csp,
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				});
				PluginSandbox.loadScope(addon);
				let s = PluginSandbox.getScope(id);
				Cu.evalInSandbox(OPEN_WINDOW_SHIM, s);
				await Cu.evalInSandbox("openWindow('remote-fetch.html').then(function (win) { _win = win; })", s);
				let contentWin = getLastPluginWindowContent();
				try {
					for (let i = 0; i < 100 && contentWin.wrappedJSObject._fetchStatus === "pending"; i++) {
						await Zotero.Promise.delay(20);
					}
					return contentWin.wrappedJSObject._fetchStatus;
				}
				finally {
					await closeWin("_win", s);
					PluginSandbox.unloadScope(id);
				}
			}

			it("lets a plugin-declared CSP restrict remote subresources (connect-src)", async function () {
				// Cross-origin fetch target (the local test server is a different
				// origin than moz-extension, so connect-src governs it).
				let remoteURL = registerServerEndpoint("GET", function () {
					return [200, "text/plain", "ok"];
				});
				// Both plugins declare a CSP (avoiding the default's
				// upgrade-insecure-requests); they differ ONLY in connect-src.
				let allowed = await remoteFetchStatus(
					"csp-r1@zotero.org", "{00000000-0000-0000-0000-0000000000c6}",
					"script-src 'self'", remoteURL);
				let blocked = await remoteFetchStatus(
					"csp-r2@zotero.org", "{00000000-0000-0000-0000-0000000000c7}",
					"script-src 'self'; connect-src 'none';", remoteURL);
				assert.equal(allowed, "allowed",
					"without connect-src, the remote fetch is allowed");
				assert.equal(blocked, "blocked",
					"a plugin-declared connect-src 'none' blocks the remote fetch -- the "
					+ "declared page CSP IS enforced for cross-origin subresources");
			});

			// Load a fresh-id plugin with a declared CSP, open the probe page, and
			// return whether eval() and WebAssembly compilation are permitted.
			async function evalWasmStatus(id, guid, csp) {
				let addon = createMockPlugin({
					id,
					name: "CSP Probe " + id,
					syncGUID: guid,
					permissions: ["default", "window"],
					contentSecurityPolicy: csp,
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				});
				PluginSandbox.loadScope(addon);
				let s = PluginSandbox.getScope(id);
				Cu.evalInSandbox(OPEN_WINDOW_SHIM, s);
				await Cu.evalInSandbox("openWindow('csp-inline.html').then(function (win) { _win = win; })", s);
				try {
					let w = getLastPluginWindowContent().wrappedJSObject;
					return { evalStatus: w._evalStatus, wasmStatus: w._wasmStatus };
				}
				finally {
					await closeWin("_win", s);
					PluginSandbox.unloadScope(id);
				}
			}

			it("cannot loosen the CSP to allow eval() -- the base CSP forbids 'unsafe-eval'", async function () {
				// Even declaring 'unsafe-eval' can't re-enable eval: the fixed base
				// CSP co-applies (AND-semantics) and omits 'unsafe-eval'.
				let r = await evalWasmStatus(
					"csp-eval@zotero.org", "{00000000-0000-0000-0000-0000000000c8}",
					"script-src 'self' 'unsafe-eval'");
				assert.equal(r.evalStatus, "blocked",
					"a plugin cannot re-enable eval() -- the base CSP forbids 'unsafe-eval'");
			});

			it("can enable WebAssembly by declaring 'wasm-unsafe-eval' (default blocks it)", async function () {
				// Default page CSP has no 'wasm-unsafe-eval', so wasm is blocked; the
				// base CSP DOES allow it, so a plugin can opt in via its manifest CSP.
				let def = await evalWasmStatus(
					"csp-wasm1@zotero.org", "{00000000-0000-0000-0000-0000000000c9}", null);
				let optIn = await evalWasmStatus(
					"csp-wasm2@zotero.org", "{00000000-0000-0000-0000-0000000000ca}",
					"script-src 'self' 'wasm-unsafe-eval'");
				assert.equal(def.wasmStatus, "blocked",
					"default page CSP (no 'wasm-unsafe-eval') blocks WebAssembly");
				assert.equal(optIn.wasmStatus, "allowed",
					"declaring 'wasm-unsafe-eval' enables WebAssembly (base CSP permits it)");
			});

			it("enforces the extension-page CSP: inline + eval blocked; same-origin scripts exempt", async function () {
				// Inline + eval() are blocked, but the page's own same-origin script
				// runs: moz-extension same-origin resources are CSP-exempt in Gecko.
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('csp-inline.html').then(function (win) { _win = win; })");
				try {
					let w = getLastPluginWindowContent().wrappedJSObject;
					assert.isTrue(w._probeRan, "same-origin external script runs (CSP-exempt)");
					assert.notOk(w._inlineRan, "inline script should be blocked by the extension-page CSP");
					assert.equal(w._evalStatus, "blocked", "eval() should be blocked by the extension-page CSP");
				}
				finally {
					await closeWin();
				}
			});

			it("does not let a plugin loosen its CSP via a <meta> tag (eval stays blocked)", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('csp-meta.html').then(function (win) { _win = win; })");
				try {
					let w = getLastPluginWindowContent().wrappedJSObject;
					assert.isTrue(w._probeRan, "external script should still run");
					assert.equal(w._evalStatus, "blocked",
						"a meta CSP adding 'unsafe-eval' must not override the stricter policy CSP");
				}
				finally {
					await closeWin();
				}
			});


			it("should load relative CSS and JS resources", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('resources.html').then(function (win) { _win = win; })");
				let contentWin = getLastPluginWindowContent();
				try {
					assert.equal(contentWin.document.title, "Resources");
					// JS resource should have executed (check DOM attribute, not expando -- Xrays hide expandos)
					let div = contentWin.document.getElementById("test-div");
					assert.equal(div.getAttribute("data-script-loaded"), "true", "script.js should have executed");
					// CSS resource should have been applied
					let color = contentWin.getComputedStyle(div).color;
					assert.equal(color, "rgb(255, 0, 0)", "style.css should set color to red");
				}
				finally {
					await closeWin();
				}
			});

			it("should open separate windows for each call", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let countBefore = getPluginWindowBrowsers().length;
				await evalInScope("openWindow('test.html').then(function (win) { _win1 = win; })");
				await evalInScope("openWindow('test.html').then(function (win) { _win2 = win; })");
				try {
					assert.isTrue(evalInScope("_win1 !== _win2"),
						"Each openWindow call should resolve to a distinct handle");
					assert.equal(getPluginWindowBrowsers().length, countBefore + 2,
						"each call should open its own wrapper window");
				}
				finally {
					await closeWin("_win1");
					await closeWin("_win2");
				}
			});

			it("should not expose privileged APIs in the content window", async function () {
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('privileged.html').then(function (win) { _win = win; })");
				try {
					let results = getLastPluginWindowContent().document.getElementById("results");
					// Components is excluded -- it exists in content as a neutered object (accessing properties throws)
					let privilegedAPIs = ["chromeutils", "services", "ioutils", "pathutils", "cu", "cc", "ci", "zotero"];
					for (let api of privilegedAPIs) {
						assert.equal(
							results.getAttribute("data-" + api),
							"undefined",
							`${api} should not be accessible in plugin content window`
						);
					}
					// Components exists but is neutered -- XPCOM instantiation should be blocked
					assert.equal(
						results.getAttribute("data-xpcom-blocked"),
						"true",
						"Components.classes XPCOM instantiation should be blocked"
					);
				}
				finally {
					await closeWin();
				}
			});

		});
	});

	describe("PreferencePanes", function () {
		var tmpDir;

		function loadPrefPaneTestScope() {
			mockAddon = createMockPlugin({
				id: ADDON_ID,
				name: "Test Sandbox Plugin",
				syncGUID: "{00000000-0000-0000-0000-00000000000a}",
				permissions: ["default", "preferencePane"],
				resourceURI: PathUtils.toFileURI(tmpDir) + "/",
			});
			PluginSandbox.loadScope(mockAddon);
			scope = PluginSandbox.getScope(ADDON_ID);
		}

		function registerTestPane(options = {}) {
			return Zotero.PreferencePanes.register({
				pluginID: ADDON_ID,
				label: "Embedded Pane",
				image: "chrome://zotero/skin/20/universal/cog.svg",
				src: "prefs.html",
				...options,
			});
		}

		before(async function () {
			tmpDir = await getTempDirectory();
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "pane-script.js"),
				"document.getElementById('embedded-pane-marker').setAttribute('data-script-ran', 'true');\n"
				+ "zoteroHost.addMessageListener(function (data) {\n"
				+ "  if (data && data.type === 'ping') {\n"
				+ "    zoteroHost.sendMessage({ type: 'pong', value: data.value });\n"
				+ "  }\n"
				+ "});\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "prefs.html"),
				"<!DOCTYPE html><html><head><title>Pane</title></head><body>"
				+ "<div id='embedded-pane-marker'>Frobnicate the widgets</div>"
				+ "<button data-search-strings-raw='Xyzzy'>Attributed</button>"
				+ "<select><option>Alpha</option><option>Kumquat marmalade</option></select>"
				+ '<script src="pane-script.js"></script></body></html>'
			);
		});

		after(async function () {
			await FileIO.remove(tmpDir, { recursive: true });
		});

		afterEach(function () {
			for (let pane of [...Zotero.PreferencePanes.pluginPanes]) {
				Zotero.PreferencePanes.unregister(pane.id);
			}
		});

		it("should register an unprivileged plugin pane as embedded and drop privileged options", async function () {
			loadPrefPaneTestScope();
			let paneID = await registerTestPane({
				scripts: ["pane-script.js"],
				stylesheets: ["style.css"],
				l10nFiles: ["pane.ftl"],
				onLoad: () => {},
			});
			let pane = Zotero.PreferencePanes.pluginPanes.find(p => p.id == paneID);
			assert.isTrue(pane.embedded, "pane should be embedded");
			assert.equal(pane.src, Zotero.Plugins.getBaseURI(ADDON_ID) + "prefs.html");
			assert.lengthOf(pane.scripts, 0, "scripts should be dropped");
			assert.lengthOf(pane.stylesheets, 0, "stylesheets should be dropped");
			assert.lengthOf(pane.l10nResourceIDs, 0, "l10nFiles should be dropped");
			assert.isFunction(pane.onLoad, "onLoad should be kept (wrapped for the sandbox)");
		});

		it("should register under the caller's own pluginID, not a spoofed one", async function () {
			loadPrefPaneTestScope();
			// The unprivileged plugin claims another plugin's ID; the framework must inject its real one
			let paneID = await evalInScope(
				`Zotero.PreferencePanes.register({ pluginID: "other-plugin@zotero.org", label: "x", `
				+ `image: "chrome://zotero/skin/20/universal/cog.svg", src: "prefs.html" })`
			);
			let pane = Zotero.PreferencePanes.pluginPanes.find(p => p.id == paneID);
			assert.equal(pane.pluginID, ADDON_ID, "pane is owned by the real caller, not the spoofed ID");
			assert.isTrue(pane.embedded, "and is still treated as unprivileged");
		});

		it("should refuse unregistering a pane owned by another plugin", async function () {
			// A different, loaded, privileged plugin owns the pane
			const OWNER_ID = "pane-owner@zotero.org";
			PluginSandbox.loadScope(createMockPlugin({
				id: OWNER_ID, name: "Owner", syncGUID: "{00000000-0000-0000-0000-00000000000c}", permissions: ["*"],
			}));
			try {
				let ownerPane = await Zotero.PreferencePanes.register({
					pluginID: OWNER_ID, label: "owned", image: "chrome://zotero/skin/20/universal/cog.svg",
					src: PathUtils.toFileURI(PathUtils.join(tmpDir, "prefs.html")),
				});
				loadPrefPaneTestScope();
				await evalInScope(`Zotero.PreferencePanes.unregister(${JSON.stringify(ownerPane)})`);
				assert.isTrue(
					Zotero.PreferencePanes.pluginPanes.some(p => p.id === ownerPane),
					"the attacker's unregister is refused"
				);
				Zotero.PreferencePanes.unregister(ownerPane, OWNER_ID);
				assert.isFalse(
					Zotero.PreferencePanes.pluginPanes.some(p => p.id === ownerPane),
					"the owner can still unregister it"
				);
			}
			finally {
				PluginSandbox.unloadScope(OWNER_ID);
			}
		});

		it("should reject src outside the plugin or non-HTML src for an unprivileged plugin", async function () {
			loadPrefPaneTestScope();
			let e = await getPromiseError(registerTestPane({ src: "https://example.com/prefs.html" }));
			assert.ok(e, "external src should be rejected");
			e = await getPromiseError(registerTestPane({
				src: "chrome://zotero/content/preferences/preferences_general.xhtml",
			}));
			assert.ok(e, "chrome src should be rejected");
			e = await getPromiseError(registerTestPane({ src: "prefs.xhtml" }));
			assert.ok(e, "non-.html src should be rejected");
		});

		it("should show the pane page in an embedded browser without inserting it into the document", async function () {
			loadPrefPaneTestScope();
			let paneID = await registerTestPane();
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				let container = win.document.querySelector(".pane-container.embedded");
				assert.ok(container, "embedded pane container should exist");
				assert.isNull(container.querySelector("#embedded-pane-marker"),
					"pane markup should not be inserted into the preferences document");
				let browser = container.querySelector("browser.plugin-pane-browser");
				assert.ok(browser, "pane should contain a content browser");
				assert.equal(browser.currentURI.specIgnoringRef, Zotero.Plugins.getBaseURI(ADDON_ID) + "prefs.html");
				let marker = browser.contentDocument.getElementById("embedded-pane-marker");
				assert.ok(marker, "plugin page should be loaded in the browser");
				for (let i = 0; i < 100 && !marker.getAttribute("data-script-ran"); i++) {
					await Zotero.Promise.delay(20);
				}
				assert.equal(marker.getAttribute("data-script-ran"), "true",
					"page scripts should run inside the embedded page");
			}
			finally {
				win.close();
			}
		});

		it("should block navigation away from the pane page and open web URLs externally", async function () {
			loadPrefPaneTestScope();
			let paneID = await registerTestPane();
			let stub = sinon.stub(Zotero, "launchURL");
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				let browser = win.document.querySelector(".pane-container.embedded browser");
				let src = Zotero.Plugins.getBaseURI(ADDON_ID) + "prefs.html";
				browser.contentWindow.location.href = "https://example.com/";
				for (let i = 0; i < 100 && !stub.called; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.isTrue(stub.calledWith("https://example.com/"),
					"web URL should open in the system browser");
				assert.equal(browser.currentURI.specIgnoringRef, src, "browser should stay on the plugin page");

				// The pane is single-page -- other pages within the plugin are blocked too
				browser.contentWindow.location.href = Zotero.Plugins.getBaseURI(ADDON_ID) + "other.html";
				for (let i = 0; i < 15; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.equal(browser.currentURI.specIgnoringRef, src,
					"browser should not navigate to other plugin pages");
				assert.isTrue(stub.calledOnce, "non-web navigation should not open the system browser");
			}
			finally {
				stub.restore();
				win.close();
			}
		});

		it("should sync the embedded browser height with the page height", async function () {
			loadPrefPaneTestScope();
			let paneID = await registerTestPane();
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				let browser = win.document.querySelector(".pane-container.embedded browser");
				let initialHeight = 0;
				for (let i = 0; i < 100; i++) {
					initialHeight = browser.getBoundingClientRect().height;
					if (initialHeight > 0) break;
					await Zotero.Promise.delay(20);
				}
				assert.isAbove(initialHeight, 0, "browser should get the page height after load");
				assert.equal(browser.contentWindow.scrollMaxY, 0,
					"page should not scroll vertically after sync");

				let filler = browser.contentDocument.createElement("div");
				filler.style.height = "2000px";
				browser.contentDocument.body.appendChild(filler);
				let grownHeight = initialHeight;
				for (let i = 0; i < 100 && grownHeight < initialHeight + 1900; i++) {
					await Zotero.Promise.delay(20);
					grownHeight = browser.getBoundingClientRect().height;
				}
				assert.isAtLeast(grownHeight, initialHeight + 1900, "browser should grow with the page");
				assert.equal(browser.contentWindow.scrollMaxY, 0,
					"page should not scroll vertically after growing");

				filler.remove();
				let shrunkHeight = grownHeight;
				for (let i = 0; i < 100 && shrunkHeight > initialHeight + 100; i++) {
					await Zotero.Promise.delay(20);
					shrunkHeight = browser.getBoundingClientRect().height;
				}
				assert.isBelow(shrunkHeight, initialHeight + 100, "browser should shrink when the page shrinks");
			}
			finally {
				win.close();
			}
		});

		it("should match and highlight embedded pane content when searching", async function () {
			loadPrefPaneTestScope();
			await registerTestPane();
			// Open on a built-in pane so the plugin pane loads during the search
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: "zotero-prefpane-general" });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				let searchField = win.document.getElementById("prefs-search");
				searchField.focus();

				// Text inside the page gets a native find highlight
				await win.Zotero_Preferences._search("frobnicate");
				let container = win.document.querySelector(".pane-container.embedded");
				let browser = container.querySelector("browser");
				assert.isFalse(container.classList.contains("hidden-by-search"),
					"pane should stay visible on an embedded text match");
				let selection = win.Zotero_Preferences._getEmbeddedSearchSelection(browser);
				assert.ok(selection, "shown pane browser should have a find selection");
				assert.isAbove(selection.rangeCount, 0,
					"embedded text match should get a native find highlight");
				assert.ok(win.document.activeElement.closest("#prefs-search"),
					"search box should keep focus while embedded panes load and highlight");

				// data-search-strings-raw matches get a tooltip inside the page
				await win.Zotero_Preferences._search("xyzzy");
				assert.isFalse(container.classList.contains("hidden-by-search"),
					"pane should stay visible on an embedded attribute match");
				assert.ok(browser.contentDocument.querySelector(".search-tooltip-parent .search-tooltip"),
					"embedded attribute match should get a tooltip in the page");
				assert.ok(win.document.activeElement.closest("#prefs-search"),
					"search box should keep focus across repeated searches");

				// Text in dropdown options can't be range-highlighted -- the
				// closest <select> gets a tooltip instead, like XUL menulists
				await win.Zotero_Preferences._search("kumquat");
				assert.isFalse(container.classList.contains("hidden-by-search"),
					"pane should stay visible on a dropdown option match");
				let tooltipParent = browser.contentDocument.querySelector(".search-tooltip-parent");
				assert.ok(tooltipParent, "option match should get a tooltip");
				assert.ok(tooltipParent.querySelector("select"),
					"the tooltip should wrap the select element");

				// No match hides the pane and cleans up highlights and tooltips
				await win.Zotero_Preferences._search("zzznomatch");
				assert.isTrue(container.classList.contains("hidden-by-search"),
					"pane should hide when nothing in it matches");
				// The hidden browser's selection is destroyed with its presentation
				assert.isNull(win.Zotero_Preferences._getEmbeddedSearchSelection(browser),
					"hidden pane browser should have no find selection");
				assert.isNull(browser.contentDocument.querySelector(".search-tooltip-parent"),
					"tooltips should be removed");

				// Searching again while the pane is hidden must skip the dead
				// selection and re-highlight once the pane is shown
				await win.Zotero_Preferences._search("frobnicate");
				assert.isFalse(container.classList.contains("hidden-by-search"),
					"pane should show again on a new match");
				selection = win.Zotero_Preferences._getEmbeddedSearchSelection(browser);
				assert.isAbove(selection?.rangeCount, 0,
					"highlights should come back after the pane was hidden");
			}
			finally {
				win.close();
			}
		});

		it("should call onLoad with the pane page's messenger", async function () {
			loadPrefPaneTestScope();
			let loadedPromise = new Promise((resolve) => {
				scope._resolveLoaded = resolve;
			});
			let pongPromise = new Promise((resolve) => {
				scope._resolvePong = resolve;
			});
			await evalInScope(`
				Zotero.PreferencePanes.register({
					pluginID: '${ADDON_ID}',
					id: 'test-embedded-onload',
					label: 'Hooked Pane',
					image: 'chrome://zotero/skin/20/universal/cog.svg',
					src: 'prefs.html',
					onLoad: function ({ paneID, page }) {
						page.addMessageListener(function (data) {
							if (data && data.type == 'pong') {
								_resolvePong(data.value);
							}
						});
						page.sendMessage({ type: 'ping', value: 5 });
						_resolveLoaded(paneID + ':' + page.isAlive());
					},
				});
			`);
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: "test-embedded-onload" });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				assert.equal(await loadedPromise, "test-embedded-onload:true",
					"onLoad should receive the pane ID and a live page messenger");
				assert.equal(await pongPromise, 5, "the pane page should echo over zoteroHost");
			}
			finally {
				win.close();
			}
		});

		it("should let the pane page navigate via the zoteroHost.api host API", async function () {
			loadPrefPaneTestScope();
			let paneID = await registerTestPane({ id: "test-embedded-main" });
			let subpaneID = await registerTestPane({ id: "test-embedded-subpane", parent: "test-embedded-main" });
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
			try {
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				let browser = win.document.querySelector(".pane-container.embedded browser");
				// Drive the injected host API here the way the pane page would
				let cwin = browser.contentWindow;
				for (let i = 0; i < 100 && !cwin.wrappedJSObject.zoteroHost; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.ok(cwin.wrappedJSObject.zoteroHost, "pane page should get the injected zoteroHost messenger");
				let navigate = id => cwin.wrappedJSObject.zoteroHost.api.navigate(
					Cu.cloneInto({ paneID: id }, cwin)
				);

				// A pane from another plugin rejects and doesn't navigate
				let error = await new Promise(resolve => navigate("zotero-prefpane-general")
					.then(() => resolve(null), e => resolve(e)));
				assert.ok(error, "cross-plugin navigation should reject");
				assert.equal(win.Zotero_Preferences.navigation.value, paneID,
					"should not navigate to another plugin's pane");

				// The plugin's own subpane navigates
				navigate(subpaneID);
				// The subpane loads asynchronously after the select
				let backButton = win.document.getElementById("prefs-subpane-back-button");
				let containers = [];
				for (let i = 0; i < 100; i++) {
					containers = win.document.querySelectorAll(".pane-container.embedded");
					if (containers.length >= 2 && !backButton.hidden) {
						break;
					}
					await Zotero.Promise.delay(20);
				}
				assert.equal(win.Zotero_Preferences.navigation.value, subpaneID);
				assert.lengthOf(containers, 2, "subpane should load its own embedded browser");
				assert.isFalse(backButton.hidden, "back button should show for the subpane");
			}
			finally {
				win.close();
			}
		});
	});

	describe("image-URI origin allowlist", function () {
		it("canLoadImageURI enforces the declared-resource allowlist", function () {
			loadTestScope(["default"], ["https://declared.example.com/*"]);
			let check = url => PluginProtocol.canLoadImageURI(url, ADDON_ID);
			assert.isTrue(check("chrome://zotero/skin/x.png"), "chrome: allowed");
			assert.isTrue(check("resource://gre/x.png"), "resource: allowed");
			assert.isTrue(check("data:image/png;base64,iVBORw0KGgo="), "data:image allowed");
			assert.isTrue(check("https://declared.example.com/pic.png"), "declared host_permissions origin allowed");
			assert.isTrue(check("foo/bar.png"), "relative URL resolves to the plugin root and is allowed");
			assert.isTrue(check(""), "empty value triggers no load");
			assert.isFalse(check("https://evil.example.com/x.png"), "undeclared remote origin blocked");
			assert.isFalse(check("https://other.example.com/x.png"), "other undeclared origin blocked");
			assert.isFalse(check("javascript:alert(1)"), "javascript: blocked (not a declared origin)");
			// data: is allowed as a local scheme; text/html is inert rendered as an image
			assert.isTrue(check("data:text/html,<b>x</b>"), "data:text/html allowed (inert as an image)");
			// Own moz-extension origin is in allowedOrigins (via register), so
			// canAccessURI permits it; another plugin's origin is blocked.
			let own = WebExtensionPolicy.getByID(ADDON_ID).getURL("icon.png");
			assert.isTrue(check(own), "own moz-extension resource allowed");
			assert.isFalse(check("moz-extension://00000000-0000-0000-0000-000000000000/x.png"),
				"another plugin's moz-extension resource blocked");
		});
	});

	describe("resolveURI", function () {
		it("should resolve relative URIs for unprivileged plugins against moz-extension:// root", async function () {
			var tmpDir = await getTempDirectory();
			let addon = createMockPlugin({
				id: ADDON_ID,
				name: "Test Sandbox Plugin",
				syncGUID: "{00000000-0000-0000-0000-000000000003}",
				resourceURI: PathUtils.toFileURI(tmpDir) + "/",
			});
			PluginSandbox.loadScope(addon);
			try {
				let resolved = await Zotero.Plugins.resolveURI(ADDON_ID, "content/overlay.html");
				assert.isTrue(
					resolved.startsWith("moz-extension://"),
					"Unprivileged plugin URI should be moz-extension://"
				);
				assert.isTrue(
					resolved.endsWith("/content/overlay.html"),
					"Should resolve the relative path"
				);
			}
			finally {
				PluginSandbox.unloadScope(ADDON_ID);
				await FileIO.remove(tmpDir, { recursive: true });
			}
		});
	});

	describe("PluginTrace", function () {
		// Ensure the trace module is loaded
		ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/trace.mjs");
		var traceLines;
		var listener;

		function startCapture() {
			traceLines = [];
			listener = (line) => {
				if (line.includes("[PluginTrace]")) {
					traceLines.push(line);
				}
			};
			Zotero.Debug.addListener(listener);
		}

		function stopCapture() {
			Zotero.Debug.removeListener(listener);
		}

		function findTrace(type, pathSubstring) {
			return traceLines.find(l => l.includes(`[${type}]`) && l.includes(pathSubstring));
		}

		afterEach(function () {
			stopCapture();
		});

		describe("property access tracing", function () {
			beforeEach(function () {
				loadTestScope(["default"]);
				startCapture();
			});

			it("should trace get of a leaf property", function () {
				evalInScope("Zotero.version");
				let line = findTrace("get", "Zotero.version");
				assert.ok(line, "Should have a [get] trace for Zotero.version");
				assert.include(line, ADDON_ID);
			});
		});

		describe("function call tracing", function () {
			beforeEach(function () {
				loadTestScope(["default"]);
				startCapture();
			});

			it("should trace a function call with timing", function () {
				evalInScope("Zotero.debug('trace test')");
				let line = findTrace("call", "Zotero.debug");
				assert.ok(line, "Should have a [call] trace for Zotero.debug");
				assert.include(line, ADDON_ID);
				assert.match(line, /\(\d+(\.\d+)?ms\)/, "Should include timing");
			});

			it("should trace nested namespace function calls", function () {
				evalInScope("Zotero.Utilities.randomString()");
				let line = findTrace("call", "Zotero.Utilities.randomString");
				assert.ok(line, "Should have a [call] trace for Zotero.Utilities.randomString");
			});
		});

		describe("constructor tracing", function () {
			beforeEach(function () {
				loadTestScope(["default"]);
				startCapture();
			});

			it("should trace Localization constructor", function () {
				evalInScope("new Localization(['zotero.ftl'])");
				let line = findTrace("construct", "Localization");
				assert.ok(line, "Should have a [construct] trace for Localization");
				assert.include(line, ADDON_ID);
				assert.match(line, /\(\d+(\.\d+)?ms\)/, "Should include timing");
			});
		});

		describe("hook tracing", function () {
			beforeEach(function () {
				loadTestScope(["default", "dataRead"]);
				startCapture();
			});

			it("should trace hooks passed via fromScope (Notifier)", async function () {
				let observerID = evalInScope(`
					var _observerID = Zotero.Notifier.registerObserver(
						{ notify: function testHook() {} },
						['item']
					);
					_observerID;
				`);
				// Trigger the observer -- trigger is async
				await Zotero.Notifier.trigger('modify', 'item', []);
				let line = traceLines.find(l => l.includes("[hook]"));
				assert.ok(line, "Should have a [hook] trace. All traces: " + JSON.stringify(traceLines));
				assert.include(line, ADDON_ID);

				// Clean up
				Zotero.Notifier.unregisterObserver(observerID);
			});
		});

		describe("instance method tracing", function () {
			beforeEach(function () {
				loadTestScope(["default", "dataWrite"]);
				startCapture();
			});

			it("should trace method calls on returned instances", function () {
				evalInScope("new Zotero.Translate.Import().setString('x')");
				let constructLine = findTrace("construct", "Zotero.Translate.Import");
				assert.ok(constructLine, "Should have a [construct] trace for Zotero.Translate.Import");

				let methodLine = traceLines.find(l => l.includes("[call]") && l.includes("setString"));
				assert.ok(methodLine, "Should have a [call] trace for setString. All call traces: "
					+ JSON.stringify(traceLines.filter(l => l.includes("[call]"))));
				assert.include(methodLine, ADDON_ID);
			});

			it("should trace getter access on returned instances", function () {
				evalInScope("new Zotero.Translate.Import().type");
				let getLine = traceLines.find(l => l.includes("[get]") && /\.type\b/.test(l));
				assert.ok(getLine, "Should have a [get] trace for type");
			});
		});

		describe("console tracing", function () {
			beforeEach(function () {
				loadTestScope(["default"]);
				startCapture();
			});

			it("should trace console method calls", function () {
				evalInScope("console.log('trace test')");
				let line = findTrace("call", "console.log");
				assert.ok(line, "Should have a [call] trace for console.log");
			});
		});

		describe("request tracing", function () {
			it("should trace a controller request by name, with its outcome", async function () {
				loadTestScope(["default", "window"]);
				startCapture();
				await evalInScope('Zotero.WindowController.query("windows", { type: "mainWindow" })');
				let line = findTrace("call", "Zotero.WindowController.query:windows");
				assert.ok(line, "Should have a [call] trace naming the request. All traces: " + JSON.stringify(traceLines));
				assert.include(line, ADDON_ID);
				assert.notInclude(line, "failed");
				await evalInScope('Zotero.WindowController.query("nope")');
				line = findTrace("call", "Zotero.WindowController.query:nope");
				assert.ok(line, "Should trace a failed request too");
				assert.include(line, "failed: UnknownRequest");
			});

			it("should trace a call that throws", function () {
				loadTestScope(["default", "preferences"]);
				startCapture();
				// The boundary replaces a chrome error's message, so only the throw itself is asserted
				assert.throws(() => evalInScope("Zotero.Prefs.resetBranch()"));
				let line = findTrace("call", "Zotero.Prefs.resetBranch");
				assert.ok(line, "Should have a [call] trace for the failed call. All traces: " + JSON.stringify(traceLines));
				assert.include(line, "failed: Error");
			});
		});
	});

	describe("Hooks after unload", function () {
		it("should ignore a hook whose sandbox was nuked instead of throwing", function () {
			loadTestScope(["default"]);
			// A sandbox of its own, so nuking it leaves the test scope alone
			let sandbox = new Cu.Sandbox(Services.scriptSecurityManager.createNullPrincipal({}), { freshCompartment: true });
			let hook = Cu.evalInSandbox("(function hook() { return 'ran'; })", sandbox);
			let wrapped = ScopeVariables.fromScope(hook, ADDON_ID);
			assert.equal(wrapped(), "ran");
			Cu.nukeSandbox(sandbox);
			assert.isTrue(Cu.isDeadWrapper(hook));
			assert.isUndefined(wrapped());
		});
	});

	describe("plugin manifest content_security_policy (real install)", function () {
		var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
		const INSTALL_ID = "csp-install-test@zotero.org";

		// The loader counts a plugin's moz-extension URL as untrusted, so the load must say so explicitly
		it("should run bootstrap.js from an installed XPI so startup can register a command", async function () {
			let { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
			const ID = "xpi-startup-test@zotero.org";
			let dir = await getTempDirectory();
			await FileIO.writeUTF8(PathUtils.join(dir, "manifest.json"), JSON.stringify({
				manifest_version: 2,
				name: "XPI Startup Test",
				version: "1.0." + Date.now(),
				applications: { zotero: { id: ID, update_url: "https://example.invalid/none.json", strict_max_version: "9999.*" } },
				permissions: ["pluginInterop"],
			}));
			await FileIO.writeUTF8(PathUtils.join(dir, "bootstrap.js"), `
function startup({ id }) {
	Zotero.PluginInteropManager.register({
		pluginID: id, commandName: "exec", commandVersion: "1.0.0",
		command({ data }) { return { echo: data && data.code }; },
	});
}
function shutdown() {}
function install() {}
function uninstall() {}
`);
			let xpiPath = PathUtils.join(dir, "plugin.xpi");
			let zw = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
			zw.open(new FileUtils.File(xpiPath), 0x02 | 0x08 | 0x20);
			for (let name of ["manifest.json", "bootstrap.js"]) {
				zw.addEntryFile(name, Ci.nsIZipWriter.COMPRESSION_DEFAULT, new FileUtils.File(PathUtils.join(dir, name)), false);
			}
			zw.close();
			let addon = await AddonManager.installTemporaryAddon(new FileUtils.File(xpiPath));
			try {
				let exec = Zotero.PluginInteropManager.getCommand({ callerPluginID: "harness@zotero.org", targetPluginID: ID, commandName: "exec" });
				assert.equal(typeof exec, "function", "startup should have registered exec; got " + String(exec));
				assert.equal((await exec({ code: "1+1" })).echo, "1+1");
			}
			finally {
				await addon.uninstall();
				await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
			}
		});

		it("passes the manifest content_security_policy through to installPermissions and the policy", async function () {
			let dir = await getTempDirectory();
			await FileIO.writeUTF8(
				PathUtils.join(dir, "manifest.json"),
				JSON.stringify({
					manifest_version: 2,
					name: "CSP Install Test",
					version: "1.0.0",
					applications: {
						zotero: {
							id: INSTALL_ID,
							update_url: "https://example.com/updates.json",
							strict_max_version: "9999.*",
						},
					},
					content_security_policy: "script-src 'self'; object-src 'self'; connect-src 'none';",
				})
			);
			await FileIO.writeUTF8(
				PathUtils.join(dir, "bootstrap.js"),
				"function install() {}\nfunction startup() {}\nfunction shutdown() {}\nfunction uninstall() {}\n"
			);
			let expectedCSP = "script-src 'self'; object-src 'self'; connect-src 'none';";
			let addon = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(dir));
			try {
				assert.equal(addon.installPermissions?.content_security_policy, expectedCSP,
					"manifest content_security_policy should flow into installPermissions");
				// If the plugin lifecycle registered a WebExtensionPolicy, it must
				// carry the declared CSP (that's what makes it enforceable).
				let policy = WebExtensionPolicy.getByID(INSTALL_ID);
				if (policy) {
					assert.equal(policy.extensionPageCSP, expectedCSP,
						"the plugin's WebExtensionPolicy should use the declared CSP");
				}
			}
			finally {
				await addon.uninstall();
				await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
			}
		});
	});

	describe("Clipboard controller", function () {
		const FILE_FLAVOR = "application/x-moz-file";

		it("should expose query with clipboardRead and command with clipboardWrite only", function () {
			loadTestScope(["default"]);
			assert.equal(evalInScope("typeof Zotero.ClipboardController"), "undefined");
			loadTestScope(["default", "clipboardRead"]);
			assert.equal(evalInScope("typeof Zotero.ClipboardController.query"), "function");
			assert.equal(evalInScope("typeof Zotero.ClipboardController.command"), "undefined");
			loadTestScope(["default", "clipboardWrite"]);
			assert.equal(evalInScope("typeof Zotero.ClipboardController.command"), "function");
			assert.equal(evalInScope("typeof Zotero.ClipboardController.query"), "undefined");
		});

		it("should write text and a file and read them back, a file as its path or bytes", async function () {
			loadTestScope(["default", "clipboardRead", "clipboardWrite"]);
			let text = "sandbox clipboard " + Zotero.Utilities.randomString();
			let written = await evalInScope(`Zotero.ClipboardController.command("write", { data: { "text/plain": ${JSON.stringify(text)} } })`);
			assert.isTrue(written.success, written.error && written.error.message);
			let read = await evalInScope('Zotero.ClipboardController.query("read", { flavor: "text/plain" })');
			assert.equal(read.result.data, text);
			let flavors = await evalInScope('Zotero.ClipboardController.query("flavors")');
			assert.include(Array.from(flavors.result.flavors), "text/plain");
			let notBytes = await evalInScope('Zotero.ClipboardController.query("read", { flavor: "text/plain", as: "bytes" })');
			assert.equal(notBytes.error.code, Zotero.ClipboardController.errorCodes.INVALID_PARAMS);
			let file = PluginFileAccess.canonicalize(PathUtils.join(await getTempDirectory(), "on-clipboard-" + Zotero.Utilities.randomString() + ".txt"));
			await FileIO.writeUTF8(file, "file bytes");
			let placed = await evalInScope(`Zotero.ClipboardController.command("write", { data: { ${JSON.stringify(FILE_FLAVOR)}: ${JSON.stringify(file)} } })`);
			assert.isTrue(placed.success, placed.error && placed.error.message);
			flavors = await evalInScope('Zotero.ClipboardController.query("flavors")');
			assert.include(Array.from(flavors.result.flavors), FILE_FLAVOR);
			let path = await evalInScope(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)} })`);
			assert.equal(path.result.data, file);
			// Read as a plain array in the sandbox, since a typed array is not readable over Xrays
			let bytes = await evalInScope(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)}, as: "bytes" })`
				+ ".then(r => Array.from(r.result.data))");
			assert.equal(new TextDecoder().decode(new Uint8Array(Array.from(bytes))), "file bytes");
			let bad = await evalInScope(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)}, as: "base64" })`);
			assert.equal(bad.error.code, Zotero.ClipboardController.errorCodes.INVALID_PARAMS);
		});

		// The core reader and writer are stubbed, so no file lands on the clipboard
		it("should hand a file flavor out as a canonical path and take one back", async function () {
			loadTestScope(["default", "clipboardRead", "clipboardWrite"]);
			let native = PathUtils.join(await getTempDirectory(), "OnClipboard.txt");
			let canonical = PluginFileAccess.canonicalize(native);
			let reader = sinon.stub(Zotero.Utilities.Internal, "getClipboard").returns(native);
			let writer = sinon.stub(Zotero.Utilities.Internal, "copyToClipboard");
			try {
				let read = await evalInScope(`Zotero.ClipboardController.query("read", { flavor: ${JSON.stringify(FILE_FLAVOR)} })`);
				assert.equal(read.result.data, canonical);
				assert.deepEqual(reader.lastCall.args, [FILE_FLAVOR, "path"]);
				let written = await evalInScope(`Zotero.ClipboardController.command("write", { data: { ${JSON.stringify(FILE_FLAVOR)}: ${JSON.stringify(canonical)}, "text/plain": "x" } })`);
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

	describe("Window and tab controllers", function () {
		var pluginWin;

		before(async function () {
			pluginWin = await loadZoteroPane();
		});

		after(function () {
			pluginWin.close();
		});

		it("should not be exposed without the window or tab permission", function () {
			loadTestScope(["default"]);
			assert.equal(evalInScope("typeof Zotero.WindowController"), "undefined");
			assert.equal(evalInScope("typeof Zotero.TabController"), "undefined");
		});

		it("should expose WindowController with window and TabController only with tab", function () {
			loadTestScope(["default", "window"]);
			assert.equal(evalInScope("typeof Zotero.WindowController.query"), "function");
			assert.equal(evalInScope("typeof Zotero.WindowController.command"), "function");
			assert.isTrue(evalInScope("Zotero.WindowController.windowTypes.includes('mainWindow')"));
			assert.equal(evalInScope("typeof Zotero.TabController"), "undefined");

			// tab implies window
			loadTestScope(["default", "tab"]);
			assert.equal(evalInScope("typeof Zotero.WindowController.query"), "function");
			assert.equal(evalInScope("typeof Zotero.TabController.query"), "function");
			assert.equal(evalInScope("typeof Zotero.TabController.command"), "function");
		});

		it("should be exposed via the ui umbrella permission", function () {
			loadTestScope(["default", "ui"]);
			assert.equal(evalInScope("typeof Zotero.WindowController.command"), "function");
			assert.equal(evalInScope("typeof Zotero.TabController.command"), "function");
		});

		it("should not expose the internal instances", function () {
			loadTestScope(["default", "tab"]);
			assert.equal(evalInScope("typeof Zotero.WindowController._windowController"), "undefined");
			assert.equal(evalInScope("typeof Zotero.TabController._tabController"), "undefined");
		});

		it("should hand out one wrapper per request method", function () {
			loadTestScope(["default", "tab"]);
			assert.isTrue(evalInScope("Zotero.WindowController.query === Zotero.WindowController.query"));
			assert.isTrue(evalInScope("Zotero.TabController.command === Zotero.TabController.command"));
		});

		it("should resolve a query to a plain sandbox object", async function () {
			loadTestScope(["default", "window"]);
			let isPlain = await evalInScope(`(async () => {
				let response = await Zotero.WindowController.query("windows", { type: "mainWindow" });
				let { result } = response;
				return Object.getPrototypeOf(response) === Object.prototype
					&& response.success === true && !("error" in response)
					&& Object.getPrototypeOf(result) === Object.prototype
					&& Array.isArray(result.windows)
					&& result.windows.every(w => typeof w.windowID === "number" && w.type === "mainWindow");
			})()`);
			assert.isTrue(isPlain);

			let { result: { windows } } = await evalInScope('Zotero.WindowController.query("windows", { type: "mainWindow" })');
			assert.include(Array.from(windows).map(w => w.windowID), pluginWin.browsingContext.id);
		});

		it("should run a command from the sandbox", async function () {
			loadTestScope(["default", "window"]);
			let stub = sinon.stub(pluginWin, "focus");
			try {
				let { result } = await evalInScope(
					`Zotero.WindowController.command("focusWindow", { windowID: ${pluginWin.browsingContext.id} })`
				);
				assert.isTrue(stub.calledOnce);
				assert.isEmpty(Object.keys(result));
			}
			finally {
				stub.restore();
			}
		});

		it("should resolve a failure with its code and message instead of rejecting", async function () {
			loadTestScope(["default", "window"]);
			let response = await evalInScope('Zotero.WindowController.query("nope")');
			assert.deepEqual(JSON.parse(JSON.stringify(response)), {
				success: false,
				result: {},
				error: { code: "UnknownRequest", message: "Unknown query 'nope'" },
			});
		});

		it("should resolve a tab query to plain data", async function () {
			loadTestScope(["default", "tab"]);
			// The tab permission implies window, so the scope can look up its own window ID
			let { result } = await evalInScope(`(async () => {
				let { result: { windows } } = await Zotero.WindowController.query("windows", { type: "mainWindow" });
				return Zotero.TabController.query("tabs", { windowID: windows[0].windowID });
			})()`);
			assert.equal(result.selectedTabID, "zotero-pane");
			assert.equal(Array.from(result.tabs)[0].type, "library");
		});

		it("should open and close a note window from the sandbox", async function () {
			loadTestScope(["default", "window"]);
			let note = await createDataObject("item", { itemType: "note" });
			let { result: { windowID } } = await evalInScope(
				`Zotero.WindowController.command("openWindow", { type: "note", itemID: ${note.id} })`
			);
			let { WindowUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/window.mjs");
			let noteWin = WindowUtils.getWindow(windowID, "noteWindow");
			try {
				assert.equal(noteWin.name, "zotero-note-" + note.id);
				// closeWindow is not limited to the plugin's own windows
				await evalInScope(`Zotero.WindowController.command("closeWindow", { windowID: ${windowID} })`);
				for (let attempt = 0; attempt < 100 && !noteWin.closed; attempt++) {
					await Zotero.Promise.delay(20);
				}
				assert.isTrue(noteWin.closed, "closeWindow should close a note window");
			}
			finally {
				if (!noteWin.closed) {
					noteWin.close();
				}
			}
		});

		it("should open the preferences on a pane from the sandbox", async function () {
			loadTestScope(["default", "window"]);
			const PANE = "zotero-prefpane-general";
			let { result: { windowID } } = await evalInScope(
				`Zotero.WindowController.command("openWindow", { type: "preferencePane", location: { pane: "${PANE}" } })`
			);
			let { WindowUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/window.mjs");
			let prefsWin = WindowUtils.getWindow(windowID, "preferencePane");
			try {
				for (let attempt = 0; attempt < 100 && prefsWin.Zotero_Preferences?.navigation?.value !== PANE; attempt++) {
					await Zotero.Promise.delay(20);
				}
				assert.equal(prefsWin.Zotero_Preferences.navigation.value, PANE);
			}
			finally {
				prefsWin.close();
			}
		});

		it("should open and close a note tab from the sandbox", async function () {
			loadTestScope(["default", "tab"]);
			let note = await createDataObject("item", { itemType: "note" });
			let windowID = pluginWin.browsingContext.id;
			let { result: { tabID } } = await evalInScope(
				`Zotero.TabController.command("openTab", { windowID: ${windowID}, type: "note", itemID: ${note.id} })`
			);
			try {
				assert.equal(pluginWin.Zotero_Tabs.selectedID, tabID);
				assert.equal(pluginWin.Zotero_Tabs.getTabInfo(tabID).type, "note");
			}
			finally {
				await evalInScope(
					`Zotero.TabController.command("closeTabs", { windowID: ${windowID}, tabIDs: [${JSON.stringify(tabID)}] })`
				);
			}
		});
	});
});
