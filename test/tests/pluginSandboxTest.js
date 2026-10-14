describe("Plugin Sandbox", function () {
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
	var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/file.mjs");
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

	/**
	 * Assert that an expression evaluated in the sandbox returns an item
	 * matching the given Zotero.Item. Handles both sync and async expressions.
	 * @param {string} expr - Expression to evaluate in the sandbox that returns an item (or a Promise of one)
	 * @param {Zotero.Item} item - The expected item to compare against
	 */
	async function assertItemEqual(expr, item) {
		// Resolve once -- works for both sync values and promises -- and pull the
		// comparable fields across in a single round-trip.
		let got = await evalInScope(`Promise.resolve(${expr}).then(i => ({
			id: i.id, key: i.key, libraryID: i.libraryID, itemType: i.itemType, title: i.getField('title')
		}))`);
		assert.equal(got.id, item.id);
		assert.equal(got.key, item.key);
		assert.equal(got.libraryID, item.libraryID);
		assert.equal(got.itemType, item.itemType);
		assert.equal(got.title, item.getField('title'));
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

	describe("Zotero.Items", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose Zotero.Items.get()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox Get Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.get(${item.id})`, item);

			await item.eraseTx();
		});

		it("should return an array of items from Zotero.Items.get() with array of IDs", async function () {
			let item1 = new Zotero.Item('book');
			item1.setField('title', 'Sandbox Array Test 1');
			await item1.saveTx();
			let item2 = new Zotero.Item('book');
			item2.setField('title', 'Sandbox Array Test 2');
			await item2.saveTx();

			evalInScope(`
				var _items = Zotero.Items.get([${item1.id}, ${item2.id}]);
				var itemCount = _items.length;
				var itemIDs = _items.map(i => i.id);
				var itemTitles = _items.map(i => i.getField('title'));
			`);
			assert.equal(evalInScope("itemCount"), 2);
			assert.equal(evalInScope("itemIDs[0]"), item1.id);
			assert.equal(evalInScope("itemIDs[1]"), item2.id);
			assert.equal(evalInScope("itemTitles[0]"), 'Sandbox Array Test 1');
			assert.equal(evalInScope("itemTitles[1]"), 'Sandbox Array Test 2');

			await item1.eraseTx();
			await item2.eraseTx();
		});

		it("should expose Zotero.Items.getAsync()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox GetAsync Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.getAsync(${item.id})`, item);

			await item.eraseTx();
		});

		it("should expose Zotero.Items.getByLibraryAndKey()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox GetByKey Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.getByLibraryAndKey(${item.libraryID}, "${item.key}")`, item);

			await item.eraseTx();
		});

		it("should expose Zotero.Items.getTopLevel()", async function () {
			let parent = new Zotero.Item('book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();

			evalInScope(`
				var _topLevel = Zotero.Items.getTopLevel([Zotero.Items.get(${parent.id}), Zotero.Items.get(${note.id})]);
				var topLevelCount = _topLevel.length;
				var topLevelIDs = _topLevel.map(i => i.id);
			`);
			assert.equal(evalInScope("topLevelCount"), 1);
			assert.equal(evalInScope("topLevelIDs[0]"), parent.id);

			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should expose Zotero.Items.keepTopLevel()", async function () {
			let parent = new Zotero.Item('book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();
			let standalone = new Zotero.Item('note');
			await standalone.saveTx();

			// When parent and its child are both selected, keepTopLevel removes the child
			evalInScope(`
				var _kept = Zotero.Items.keepTopLevel([Zotero.Items.get(${parent.id}), Zotero.Items.get(${note.id}), Zotero.Items.get(${standalone.id})]);
				var keptCount = _kept.length;
				var keptIDs = _kept.map(i => i.id);
			`);
			assert.equal(evalInScope("keptCount"), 2);
			// Parent and standalone kept, child note removed
			let keptIDs = [evalInScope("keptIDs[0]"), evalInScope("keptIDs[1]")];
			assert.include(keptIDs, parent.id);
			assert.include(keptIDs, standalone.id);
			assert.notInclude(keptIDs, note.id);

			await standalone.eraseTx();
			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should expose Zotero.Items.trashTx()", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			let itemID = item.id;

			await evalInScope(`Zotero.Items.trashTx(${itemID})`);

			item = Zotero.Items.get(itemID);
			assert.isTrue(item.deleted);

			await item.eraseTx();
		});

		it("should expose item attributes and return facades for related items", async function () {
			let parent = new Zotero.Item('book');
			parent.setField('title', 'Parent Book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();

			// Get the child note through the sandbox
			evalInScope(`
				var _note = Zotero.Items.get(${note.id});
				var _noteID = _note.id;
				var _noteKey = _note.key;
				var _noteLibraryID = _note.libraryID;
				var _noteItemType = _note.itemType;
				var _noteParentItemID = _note.parentItemID;
				var _noteParentKey = _note.parentKey;
			`);

			// Basic attributes
			assert.equal(evalInScope("_noteID"), note.id);
			assert.equal(evalInScope("_noteKey"), note.key);
			assert.equal(evalInScope("_noteLibraryID"), note.libraryID);
			assert.equal(evalInScope("_noteItemType"), 'note');
			assert.equal(evalInScope("_noteParentItemID"), parent.id);
			assert.equal(evalInScope("_noteParentKey"), parent.key);

			// topLevelItem should return a facade for the parent
			evalInScope(`
				var _topLevel = _note.topLevelItem;
				var _topLevelID = _topLevel.id;
				var _topLevelKey = _topLevel.key;
				var _topLevelTitle = _topLevel.getField('title');
				var _topLevelItemType = _topLevel.itemType;
			`);
			assert.equal(evalInScope("_topLevelID"), parent.id);
			assert.equal(evalInScope("_topLevelKey"), parent.key);
			assert.equal(evalInScope("_topLevelTitle"), 'Parent Book');
			assert.equal(evalInScope("_topLevelItemType"), 'book');

			// topLevelItem of a top-level item should return itself
			evalInScope(`
				var _parent = Zotero.Items.get(${parent.id});
				var _parentTopLevel = _parent.topLevelItem;
				var _parentTopLevelID = _parentTopLevel.id;
			`);
			assert.equal(evalInScope("_parentTopLevelID"), parent.id);

			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should construct a new Zotero.Item", async function () {
			evalInScope(`
				var _item = new Zotero.Item('book');
				_item.setField('title', 'Constructor Test Book');
			`);
			let itemType = evalInScope("_item.itemType");
			let title = evalInScope("_item.getField('title')");
			assert.equal(itemType, 'book');
			assert.equal(title, 'Constructor Test Book');

			// Save and verify
			let id = await evalInScope("_item.saveTx()");
			assert.isNumber(id);
			let realItem = Zotero.Items.get(id);
			assert.ok(realItem);
			assert.equal(realItem.getField('title'), 'Constructor Test Book');
			assert.equal(realItem.itemType, 'book');

			await realItem.eraseTx();
		});

		it("should not expose unlisted methods", function () {
			assert.isTrue(evalInScope("typeof Zotero.Items.erase === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Items.emptyTrash === 'undefined'"));
		});
	});

	describe("dataRead permission", function () {
		var WRITE_METHODS = ["save", "saveTx", "erase", "eraseTx"];

		beforeEach(function () {
			loadTestScope(["default", "dataRead"]);
		});

		// Resolve `_obj` in the sandbox (sync value or promise) and assert each of
		// `methods` is stripped from the read-only facade.
		async function assertStripped(methods) {
			for (let m of methods) {
				let type = await evalInScope(`Promise.resolve(_obj).then(o => typeof o.${m})`);
				assert.equal(type, "undefined", `${m} should be stripped under dataRead`);
			}
		}

		it("should expose read methods on Zotero.Items", function () {
			assert.isTrue(evalInScope("typeof Zotero.Items.get === 'function'"));
			assert.isTrue(evalInScope("typeof Zotero.Items.getAsync === 'function'"));
			assert.isTrue(evalInScope("typeof Zotero.Items.getByLibraryAndKey === 'function'"));
		});

		it("should not expose write methods on plural managers (Items/Tags/Collections)", function () {
			let hidden = [
				"Zotero.Items.trash",
				"Zotero.Items.trashTx",
				"Zotero.Tags.rename",
				"Zotero.Tags.removeFromLibrary",
				"Zotero.Tags.setColor",
				"Zotero.Collections.registerChildCollection",
				"Zotero.Collections.unregisterChildCollection",
				"Zotero.Collections.registerChildItem",
				"Zotero.Collections.unregisterChildItem",
			];
			for (let m of hidden) {
				assert.equal(evalInScope(`typeof ${m}`), "undefined", `${m} should be hidden`);
			}
		});

		it("should hide methods that persist internally and the plural-manager accessor", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Gating Test');
			await item.saveTx();
			try {
				// These exist on the chrome Item but persist via save()/erase()/
				// SyncedSettings internally, so dataRead must not expose them.
				assert.equal(typeof item.moveToLibrary, 'function');
				assert.equal(typeof item.addLinkedItem, 'function');

				evalInScope(`var _item = Zotero.Items.get(${item.id})`);
				for (let m of ["moveToLibrary", "setAttachmentLastPageIndex",
						"setAttachmentLastReadAloudPosition", "addLinkedItem"]) {
					assert.isTrue(evalInScope(`typeof _item.${m} === 'undefined'`),
						`${m} should be hidden under dataRead`);
				}
				// Plural-manager accessor must not leak the unrestricted singleton
				assert.isTrue(evalInScope("typeof _item.ObjectsClass === 'undefined'"),
					"ObjectsClass should be hidden");
				// Underscore-prefixed internals are never exposed
				assert.isTrue(evalInScope("typeof _item._saveData === 'undefined'"),
					"_saveData should be hidden");
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should block write methods on items across return shapes (get/getAsync/array/constructed/nested)", async function () {
			let parent = new Zotero.Item('book');
			parent.setField('title', 'Read Only Test');
			await parent.saveTx();
			let item2 = new Zotero.Item('book');
			await item2.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();
			try {
				// get() -- single value; read access still works
				evalInScope(`var _obj = Zotero.Items.get(${parent.id})`);
				assert.equal(evalInScope("_obj.getField('title')"), 'Read Only Test');
				assert.equal(evalInScope("_obj.itemType"), 'book');
				await assertStripped(WRITE_METHODS);

				// getAsync() -- promise
				evalInScope(`var _obj = Zotero.Items.getAsync(${parent.id})`);
				await assertStripped(WRITE_METHODS);

				// get([...]) -- array element
				evalInScope(`var _obj = Zotero.Items.get([${parent.id}, ${item2.id}])[1]`);
				await assertStripped(WRITE_METHODS);

				// new Zotero.Item() -- constructed; constructor still works
				evalInScope(`var _obj = new Zotero.Item('book')`);
				assert.equal(evalInScope("_obj.itemType"), 'book');
				await assertStripped(WRITE_METHODS);

				// Nested return value (topLevelItem) -- restriction must propagate
				evalInScope(`var _obj = Zotero.Items.get(${note.id}).topLevelItem`);
				assert.equal(evalInScope("_obj.id"), parent.id);
				await assertStripped(WRITE_METHODS);
			}
			finally {
				await note.eraseTx();
				await item2.eraseTx();
				await parent.eraseTx();
			}
		});

		it("should block write methods on collections returned from Collections.getByLibrary()", async function () {
			let col = new Zotero.Collection();
			col.name = 'Read Only Collection';
			await col.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByLibrary(${col.libraryID});
				var _col = _cols.find(c => c.id === ${col.id});
			`);

			assert.equal(evalInScope("_col.name"), 'Read Only Collection');
			assert.isTrue(evalInScope("typeof _col.save === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.saveTx === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.erase === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.eraseTx === 'undefined'"));
			// Collection-specific write methods
			assert.isTrue(evalInScope("typeof _col.addItem === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.addItems === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.removeItem === 'undefined'"));
			assert.isTrue(evalInScope("typeof _col.removeItems === 'undefined'"));

			await col.eraseTx();
		});

		it("should block write methods on libraries (get and getAll)", function () {
			let libraryID = Zotero.Libraries.userLibraryID;
			evalInScope(`
				var _lib = Zotero.Libraries.get(${libraryID});
				var _firstLib = Zotero.Libraries.getAll()[0];
			`);

			// Read access should work
			assert.ok(evalInScope("_lib.name"));
			assert.equal(evalInScope("_lib.libraryType"), 'user');
			assert.ok(evalInScope("_firstLib"));

			for (let v of ["_lib", "_firstLib"]) {
				for (let m of WRITE_METHODS) {
					assert.equal(evalInScope(`typeof ${v}.${m}`), "undefined", `${v}.${m}`);
				}
			}
		});

		it("should block write methods on constructed searches", function () {
			evalInScope(`var _search = new Zotero.Search()`);

			// Write methods should not exist
			assert.isTrue(evalInScope("typeof _search.save === 'undefined'"));
			assert.isTrue(evalInScope("typeof _search.saveTx === 'undefined'"));
			assert.isTrue(evalInScope("typeof _search.addCondition === 'undefined'"));
			assert.isTrue(evalInScope("typeof _search.removeCondition === 'undefined'"));
		});

		it("should block write methods on Search returned from Duplicates.getSearchObject()", async function () {
			let libraryID = Zotero.Libraries.userLibraryID;
			evalInScope(`var _dupes = new Zotero.Duplicates(${libraryID})`);

			let hasSave = await evalInScope(`
				_dupes.getSearchObject().then(s => typeof s.save)
			`);
			let hasSaveTx = await evalInScope(`
				_dupes.getSearchObject().then(s => typeof s.saveTx)
			`);
			let hasAddCondition = await evalInScope(`
				_dupes.getSearchObject().then(s => typeof s.addCondition)
			`);

			assert.equal(hasSave, 'undefined');
			assert.equal(hasSaveTx, 'undefined');
			assert.equal(hasAddCondition, 'undefined');
		});

		it("should block write methods on constructed feeds", function () {
			evalInScope(`var _feed = new Zotero.Feed({ url: 'https://example.com/feed' })`);

			// Read access should work
			assert.equal(evalInScope("_feed.url"), 'https://example.com/feed');
			assert.equal(evalInScope("_feed.libraryType"), 'feed');

			// Write methods should not exist
			assert.isTrue(evalInScope("typeof _feed.save === 'undefined'"));
			assert.isTrue(evalInScope("typeof _feed.saveTx === 'undefined'"));
			assert.isTrue(evalInScope("typeof _feed.erase === 'undefined'"));
			assert.isTrue(evalInScope("typeof _feed.eraseTx === 'undefined'"));
			// Feed-specific write methods
			assert.isTrue(evalInScope("typeof _feed.updateFeed === 'undefined'"));
			assert.isTrue(evalInScope("typeof _feed.clearExpiredItems === 'undefined'"));
			assert.isTrue(evalInScope("typeof _feed.storeSyncedSettings === 'undefined'"));
		});
	});

	describe("dataWrite permission", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should gate attachment file methods behind fileSystemWrite", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			try {
				// beforeEach already loaded a dataWrite (no fileSystemWrite) scope:
				// data writes ok, file ops hidden
				evalInScope(`var _item = Zotero.Items.get(${item.id})`);
				assert.isTrue(evalInScope("typeof _item.saveTx === 'function'"));
				assert.isTrue(evalInScope("typeof _item.moveToLibrary === 'function'"));
				assert.isTrue(evalInScope("typeof _item.deleteAttachmentFile === 'undefined'"),
					"deleteAttachmentFile needs fileSystemWrite");
				assert.isTrue(evalInScope("typeof _item.renameAttachmentFile === 'undefined'"));

				// dataWrite + fileSystemWrite: file methods exposed
				loadTestScope(["default", "dataWrite", "fileSystemWrite"]);
				evalInScope(`var _item2 = Zotero.Items.get(${item.id})`);
				assert.isTrue(evalInScope("typeof _item2.deleteAttachmentFile === 'function'"));
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should allow save/saveTx on items returned from Zotero.Items.get()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Write Test');
			await item.saveTx();

			evalInScope(`var _item = Zotero.Items.get(${item.id})`);

			// Write methods should exist
			assert.isTrue(evalInScope("typeof _item.save === 'function'"));
			assert.isTrue(evalInScope("typeof _item.saveTx === 'function'"));
			assert.isTrue(evalInScope("typeof _item.erase === 'function'"));
			assert.isTrue(evalInScope("typeof _item.eraseTx === 'function'"));

			await item.eraseTx();
		});

		it("should allow save/saveTx on constructed items", async function () {
			evalInScope(`
				var _newItem = new Zotero.Item('book');
				_newItem.setField('title', 'Write Constructor Test');
			`);

			assert.isTrue(evalInScope("typeof _newItem.saveTx === 'function'"));
			let id = await evalInScope("_newItem.saveTx()");
			assert.isNumber(id);

			let realItem = Zotero.Items.get(id);
			assert.equal(realItem.getField('title'), 'Write Constructor Test');

			await realItem.eraseTx();
		});

		it("should expose write methods on plural managers (Items/Tags/Collections) with dataWrite", function () {
			let exposed = [
				"Zotero.Items.trash",
				"Zotero.Items.trashTx",
				"Zotero.Tags.rename",
				"Zotero.Tags.removeFromLibrary",
				"Zotero.Tags.setColor",
				"Zotero.Collections.registerChildCollection",
				"Zotero.Collections.unregisterChildCollection",
				"Zotero.Collections.registerChildItem",
				"Zotero.Collections.unregisterChildItem",
			];
			for (let m of exposed) {
				assert.equal(evalInScope(`typeof ${m}`), "function", `${m} should be exposed`);
			}
		});

		it("should allow write methods on constructed feeds with dataWrite", function () {
			evalInScope(`var _feed = new Zotero.Feed({ url: 'https://example.com/feed' })`);

			assert.isTrue(evalInScope("typeof _feed.save === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.saveTx === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.erase === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.eraseTx === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.updateFeed === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.clearExpiredItems === 'function'"));
			assert.isTrue(evalInScope("typeof _feed.storeSyncedSettings === 'function'"));
		});

		it("should expose DB.executeTransaction with dataWrite", async function () {
			assert.isTrue(evalInScope("typeof Zotero.DB.executeTransaction === 'function'"));

			// Verify it actually works by running a transaction
			let item = new Zotero.Item('book');
			item.setField('title', 'DB Transaction Test');
			await item.saveTx();

			let newTitle = await evalInScope(`
				Zotero.DB.executeTransaction(async function () {
					var item = Zotero.Items.get(${item.id});
					item.setField('title', 'Updated via Transaction');
					await item.save();
				}).then(() => Zotero.Items.get(${item.id}).getField('title'))
			`);
			assert.equal(newTitle, 'Updated via Transaction');

			await item.eraseTx();
		});

		it("should not expose DB.executeTransaction without dataWrite", function () {
			loadTestScope(["default", "dataRead"]);
			assert.isFalse(evalInScope("typeof Zotero.DB !== 'undefined' && typeof Zotero.DB.executeTransaction === 'function'"));
		});
	});

	describe("Zotero.Libraries", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should return a library from Zotero.Libraries.get()", function () {
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _libName = _lib.name;
				var _libType = _lib.libraryType;
				var _libEditable = _lib.editable;
			`);
			let realLib = Zotero.Libraries.get(1);
			assert.equal(evalInScope("_libName"), realLib.name);
			assert.equal(evalInScope("_libType"), realLib.libraryType);
			assert.equal(evalInScope("_libEditable"), realLib.editable);
		});

		it("should return libraries from Zotero.Libraries.getAll()", function () {
			let realLibs = Zotero.Libraries.getAll();
			evalInScope(`
				var _libs = Zotero.Libraries.getAll();
				var _libCount = _libs.length;
			`);
			assert.equal(evalInScope("_libCount"), realLibs.length);
		});

		it("should match chrome for static accessors (getName/getType/getVersion/hasTrash/isEditable/isFilesEditable/isGroupLibrary)", function () {
			let methods = [
				"getName",
				"getType",
				"getVersion",
				"hasTrash",
				"isEditable",
				"isFilesEditable",
				"isGroupLibrary",
			];
			for (let m of methods) {
				assert.equal(evalInScope(`Zotero.Libraries.${m}(1)`), Zotero.Libraries[m](1), `Libraries.${m}(1)`);
			}
		});

		it("should return exists from Zotero.Libraries.exists()", function () {
			assert.isTrue(evalInScope("Zotero.Libraries.exists(1)"));
			assert.isFalse(evalInScope("Zotero.Libraries.exists(999999)"));
		});

		it("should expose library instance attributes via facade", function () {
			let realLib = Zotero.Libraries.get(1);
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _libID = _lib.libraryID;
				var _libId = _lib.id;
				var _libName = _lib.name;
				var _libType = _lib.libraryType;
				var _libVersion = _lib.libraryVersion;
				var _libEditable = _lib.editable;
				var _libFilesEditable = _lib.filesEditable;
				var _libHasTrash = _lib.hasTrash;
				var _libIsGroup = _lib.isGroup;
				var _libSyncable = _lib.syncable;
				var _libTreeViewID = _lib.treeViewID;
			`);
			assert.equal(evalInScope("_libID"), realLib.libraryID);
			assert.equal(evalInScope("_libId"), realLib.id);
			assert.equal(evalInScope("_libName"), realLib.name);
			assert.equal(evalInScope("_libType"), realLib.libraryType);
			assert.equal(evalInScope("_libVersion"), realLib.libraryVersion);
			assert.equal(evalInScope("_libEditable"), realLib.editable);
			assert.equal(evalInScope("_libFilesEditable"), realLib.filesEditable);
			assert.equal(evalInScope("_libHasTrash"), realLib.hasTrash);
			assert.equal(evalInScope("_libIsGroup"), realLib.isGroup);
			assert.equal(evalInScope("_libSyncable"), realLib.syncable);
			assert.equal(evalInScope("_libTreeViewID"), realLib.treeViewID);
		});

		it("should expose library instance methods via facade", async function () {
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _hasCollections = _lib.hasCollections();
				var _hasSearches = _lib.hasSearches();
			`);
			let realLib = Zotero.Libraries.get(1);
			assert.equal(evalInScope("_hasCollections"), realLib.hasCollections());
			assert.equal(evalInScope("_hasSearches"), realLib.hasSearches());

			let hasItems = await evalInScope("Zotero.Libraries.get(1).hasItems()");
			let realHasItems = await realLib.hasItems();
			assert.equal(hasItems, realHasItems);
		});

		it("should return library facades from Zotero.Libraries.getAll()", function () {
			let realLibs = Zotero.Libraries.getAll();
			evalInScope(`
				var _libs = Zotero.Libraries.getAll();
				var _libCount = _libs.length;
				var _firstLibID = _libs[0].libraryID;
				var _firstLibName = _libs[0].name;
				var _firstLibType = _libs[0].libraryType;
			`);
			assert.equal(evalInScope("_libCount"), realLibs.length);
			assert.equal(evalInScope("_firstLibID"), realLibs[0].libraryID);
			assert.equal(evalInScope("_firstLibName"), realLibs[0].name);
			assert.equal(evalInScope("_firstLibType"), realLibs[0].libraryType);
		});
	});

	describe("Zotero.Collections", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should return collection facades from getByLibrary()", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Test Collection Sandbox";
			await collection.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByLibrary(1);
				var _colCount = _cols.length;
				var _colNames = _cols.map(c => c.name);
			`);
			let count = evalInScope("_colCount");
			assert.isAbove(count, 0);
			let names = [];
			for (let i = 0; i < count; i++) {
				names.push(evalInScope(`_colNames[${i}]`));
			}
			assert.include(names, "Test Collection Sandbox");

			await collection.eraseTx();
		});

		it("should return child collections from getByParent()", async function () {
			let parent = new Zotero.Collection();
			parent.name = "Parent Collection";
			await parent.saveTx();
			let child = new Zotero.Collection();
			child.name = "Child Collection";
			child.parentID = parent.id;
			await child.saveTx();

			evalInScope(`
				var _children = Zotero.Collections.getByParent(${parent.id});
				var _childCount = _children.length;
				var _childName = _children[0].name;
				var _childID = _children[0].id;
			`);
			assert.equal(evalInScope("_childCount"), 1);
			assert.equal(evalInScope("_childName"), "Child Collection");
			assert.equal(evalInScope("_childID"), child.id);

			await child.eraseTx();
			await parent.eraseTx();
		});

		it("should return collections containing items from getCollectionsContainingItems()", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Container Collection";
			await collection.saveTx();
			let item = new Zotero.Item('book');
			item.setField('title', 'Contained Item');
			item.addToCollection(collection.id);
			await item.saveTx();

			let count = await evalInScope(`
				Zotero.Collections.getCollectionsContainingItems([${item.id}], true)
					.then(ids => ids.length)
			`);
			assert.equal(count, 1);

			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should expose collection instance attributes via facade", async function () {
			let parent = new Zotero.Collection();
			parent.name = "Facade Parent";
			await parent.saveTx();
			let child = new Zotero.Collection();
			child.name = "Facade Child";
			child.parentID = parent.id;
			await child.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByParent(${parent.id});
				var _col = _cols[0];
				var _colID = _col.id;
				var _colName = _col.name;
				var _colKey = _col.key;
				var _colLibraryID = _col.libraryID;
				var _colParent = _col.parent;
			`);
			assert.equal(evalInScope("_colID"), child.id);
			assert.equal(evalInScope("_colName"), "Facade Child");
			assert.equal(evalInScope("_colKey"), child.key);
			assert.equal(evalInScope("_colLibraryID"), child.libraryID);
			assert.equal(evalInScope("_colParent"), parent.id);

			await child.eraseTx();
			await parent.eraseTx();
		});

		it("should expose collection instance methods via facade", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Methods Collection";
			await collection.saveTx();
			let item = new Zotero.Item('book');
			item.setField('title', 'Collection Item');
			item.addToCollection(collection.id);
			await item.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByLibrary(1);
				var _col = _cols.find(c => c.id === ${collection.id});
				var _hasItems = _col.hasChildItems();
				var _hasCollections = _col.hasChildCollections();
				var _hasItem = _col.hasItem(${item.id});
			`);
			assert.isTrue(evalInScope("_hasItems"));
			assert.isFalse(evalInScope("_hasCollections"));
			assert.isTrue(evalInScope("_hasItem"));

			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should construct a new Zotero.Collection", async function () {
			evalInScope(`
				var _col = new Zotero.Collection();
				_col.name = 'Constructor Test Collection';
			`);
			let name = evalInScope("_col.name");
			assert.equal(name, 'Constructor Test Collection');

			let id = await evalInScope("_col.saveTx()");
			assert.isNumber(id);
			let realCol = Zotero.Collections.get(id);
			assert.ok(realCol);
			assert.equal(realCol.name, 'Constructor Test Collection');

			await realCol.eraseTx();
		});
	});

	describe("Zotero.Groups", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should return a group from Zotero.Groups.get()", async function () {
			let group = await createGroup({ name: "Sandbox Group Test" });
			evalInScope(`
				var _group = Zotero.Groups.get(${group.id});
				var _groupName = _group.name;
				var _groupLibID = _group.libraryID;
				var _groupEditable = _group.editable;
			`);
			assert.equal(evalInScope("_groupName"), "Sandbox Group Test");
			assert.equal(evalInScope("_groupLibID"), group.libraryID);
			assert.equal(evalInScope("_groupEditable"), group.editable);

			await group.eraseTx();
		});

		it("should return all groups from Zotero.Groups.getAll()", async function () {
			let group = await createGroup({ name: "Sandbox GetAll Group" });

			evalInScope(`
				var _groups = Zotero.Groups.getAll();
				var _groupCount = _groups.length;
				var _groupNames = _groups.map(g => g.name);
			`);
			let count = evalInScope("_groupCount");
			assert.isAbove(count, 0);
			let names = [];
			for (let i = 0; i < count; i++) {
				names.push(evalInScope(`_groupNames[${i}]`));
			}
			assert.include(names, "Sandbox GetAll Group");

			await group.eraseTx();
		});

		it("should return a group from Zotero.Groups.getByLibraryID()", async function () {
			let group = await createGroup({ name: "Sandbox ByLibID Group" });
			evalInScope(`
				var _group = Zotero.Groups.getByLibraryID(${group.libraryID});
				var _groupName = _group.name;
			`);
			assert.equal(evalInScope("_groupName"), "Sandbox ByLibID Group");

			await group.eraseTx();
		});

		it("should convert between group ID and library ID", async function () {
			let group = await createGroup({ name: "Sandbox ID Convert" });

			let sandboxLibID = evalInScope(`Zotero.Groups.getLibraryIDFromGroupID(${group.id})`);
			assert.equal(sandboxLibID, group.libraryID);

			let sandboxGroupID = evalInScope(`Zotero.Groups.getGroupIDFromLibraryID(${group.libraryID})`);
			assert.equal(sandboxGroupID, group.id);

			await group.eraseTx();
		});

		it("should check group existence from Zotero.Groups.exists()", async function () {
			let group = await createGroup({ name: "Sandbox Exists Group" });
			assert.isTrue(evalInScope(`Zotero.Groups.exists(${group.id})`));
			assert.isFalse(evalInScope("Zotero.Groups.exists(999999)"));

			await group.eraseTx();
		});
	});

	describe("Zotero.Tags", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should get tag ID and name", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-id-name-tag');
			await item.saveTx();

			let tagID = evalInScope("Zotero.Tags.getID('sandbox-id-name-tag')");
			assert.ok(tagID);
			assert.equal(tagID, Zotero.Tags.getID('sandbox-id-name-tag'));

			let tagName = evalInScope(`Zotero.Tags.getName(${tagID})`);
			assert.equal(tagName, 'sandbox-id-name-tag');

			await item.eraseTx();
		});

		it("should return all tags from getAll()", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-getall-tag');
			await item.saveTx();

			let tags = await evalInScope("Zotero.Tags.getAll(1)");
			assert.ok(tags);
			// tags is an array of {tag, type} objects
			let realTags = await Zotero.Tags.getAll(1);
			assert.equal(tags.length, realTags.length);

			await item.eraseTx();
		});

		it("should get and set tag color", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-color-tag');
			await item.saveTx();

			await evalInScope("Zotero.Tags.setColor(1, 'sandbox-color-tag', '#FF0000', 0)");

			let color = evalInScope("Zotero.Tags.getColor(1, 'sandbox-color-tag')");
			assert.ok(color);
			assert.equal(color.color, '#FF0000');

			let byPos = evalInScope("Zotero.Tags.getColorByPosition(1, 0)");
			assert.ok(byPos);
			assert.equal(byPos.name, 'sandbox-color-tag');

			// Clean up
			await evalInScope("Zotero.Tags.setColor(1, 'sandbox-color-tag', false)");
			await item.eraseTx();
		});

		it("should return colors map from getColors()", function () {
			let colors = evalInScope("Zotero.Tags.getColors(1)");
			assert.ok(colors);
		});

		it("should rename a tag", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-rename-old');
			await item.saveTx();

			await evalInScope("Zotero.Tags.rename(1, 'sandbox-rename-old', 'sandbox-rename-new')");

			let oldID = Zotero.Tags.getID('sandbox-rename-old');
			assert.isFalse(oldID);
			let newID = Zotero.Tags.getID('sandbox-rename-new');
			assert.ok(newID);

			await item.eraseTx();
		});

		it("should remove a tag from library", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-remove-tag');
			await item.saveTx();

			let tagID = Zotero.Tags.getID('sandbox-remove-tag');
			assert.ok(tagID);

			await evalInScope(`Zotero.Tags.removeFromLibrary(1, ${tagID})`);

			// Tag should no longer be on the item
			item = Zotero.Items.get(item.id);
			assert.isFalse(item.hasTag('sandbox-remove-tag'));

			await item.eraseTx();
		});
	});

	describe("Zotero.Search", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should construct a new Zotero.Search", async function () {
			evalInScope(`
				var _search = new Zotero.Search();
				_search.name = 'Constructor Test Search';
				_search.addCondition('title', 'contains', 'test');
			`);
			let name = evalInScope("_search.name");
			assert.equal(name, 'Constructor Test Search');

			let id = await evalInScope("_search.saveTx()");
			assert.isNumber(id);
			let realSearch = Zotero.Searches.get(id);
			assert.ok(realSearch);
			assert.equal(realSearch.name, 'Constructor Test Search');

			await realSearch.eraseTx();
		});
	});

	describe("Zotero.Duplicates", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should construct a new Zotero.Duplicates", async function () {
			let userLibraryID = Zotero.Libraries.userLibraryID;
			evalInScope(`
				var _dup = new Zotero.Duplicates(${userLibraryID});
				var _dupLibraryID = _dup.libraryID;
			`);
			let libraryID = evalInScope("_dupLibraryID");
			assert.equal(libraryID, userLibraryID);
		});
	});

	describe("Zotero.ItemFields", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose ItemFields lookups matching chrome", function () {
			// getAll() returns field descriptors
			let fields = evalInScope("Zotero.ItemFields.getAll()");
			assert.isArray(fields);
			assert.isAbove(fields.length, 0);
			assert.property(fields[0], 'id');
			assert.property(fields[0], 'name');

			// getID() round-trips for valid names, false for invalid
			let titleID = Zotero.ItemFields.getID('title');
			assert.equal(evalInScope("Zotero.ItemFields.getID('title')"), titleID);
			assert.isFalse(evalInScope("Zotero.ItemFields.getID('nonexistentField123')"));

			// getName(), isValidForType(), getLocalizedString()
			assert.equal(evalInScope(`Zotero.ItemFields.getName(${titleID})`), 'title');
			let bookID = Zotero.ItemTypes.getID('book');
			assert.isTrue(evalInScope(`Zotero.ItemFields.isValidForType(${titleID}, ${bookID})`));
			assert.equal(
				evalInScope("Zotero.ItemFields.getLocalizedString('title')"),
				Zotero.ItemFields.getLocalizedString('title'));
		});
	});

	describe("Zotero.ItemTypes", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose ItemTypes lookups matching chrome", function () {
			assert.equal(evalInScope("Zotero.ItemTypes.getID('book')"), Zotero.ItemTypes.getID('book'));
			assert.isFalse(evalInScope("Zotero.ItemTypes.getID('nonexistentType123')"));
			assert.equal(
				evalInScope("Zotero.ItemTypes.getLocalizedString('book')"),
				Zotero.ItemTypes.getLocalizedString('book'));
		});
	});

	describe("Zotero.CreatorTypes", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose Zotero.CreatorTypes.getLocalizedString()", function () {
			assert.equal(
				evalInScope("Zotero.CreatorTypes.getLocalizedString('author')"),
				Zotero.CreatorTypes.getLocalizedString('author'));
		});
	});

	describe("Zotero.Fulltext", function () {
		beforeEach(function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
		});

		it("should expose Zotero.Fulltext.getPages()", async function () {
			let item = new Zotero.Item('attachment');
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.attachmentContentType = 'application/pdf';
			await item.saveTx();

			// Un-indexed items return false; just verify the call completes without error
			// and matches the host result
			let result = await evalInScope(`Zotero.Fulltext.getPages(${item.id})`);
			let expected = await Zotero.Fulltext.getPages(item.id);
			assert.equal(result, expected);

			await item.eraseTx();
		});
	});

	describe("Zotero.File", function () {
		var tmpDir;

		before(async function () {
			// Use a subdir of the plugin's own data directory so that all
			// FS calls in these tests are auto-allowed (no session needed).
			tmpDir = PathUtils.join(
				Zotero.DataDirectory.dir, 'plugin-data', PLUGIN_UUID, 'pluginSandboxFileTest'
			);
			await IOUtils.makeDirectory(tmpDir, { ignoreExisting: true, createAncestors: true });
		});

		after(async function () {
			await IOUtils.remove(tmpDir, { recursive: true, ignoreAbsent: true });
		});

		beforeEach(function () {
			// `network` is included so the URL-based helpers (which require
			// it to enforce host_permissions via a sandbox XHR) get exposed.
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite", "network"]);
		});

		let fileMethods = [
			"getExtension",
			"getBinaryContentsAsync",
			"getContentsAsync",
			"getContentsFromURLAsync",
			"directoryIsEmpty",
			"generateDataURI",
			"normalizeToUnix",
			"directoryContains",
			"truncateFileName",
			"reveal",
			"putContentsAsync",
			"download",
			"rename",
			"removeIfExists",
			"iterateDirectory",
			"moveDirectory",
			"setNormalFilePermissions",
			"moveToUnique",
			"copyToUnique",
			"copyDirectory",
			"createDirectoryIfMissingAsync",
			"zipDirectory",
		];

		it("should expose the allowed Zotero.File methods as functions", function () {
			for (let method of fileMethods) {
				assert.equal(evalInScope(`typeof Zotero.File.${method}`), "function",
					`Zotero.File.${method} should be exposed`);
			}
		});

		it("should normalize paths with normalizeToUnix()", function () {
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('a\\\\b\\\\c')"), 'a/b/c');
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('a/b/c')"), 'a/b/c');
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('')"), '');
		});

		it("should check directory containment with directoryContains()", function () {
			assert.isTrue(evalInScope("Zotero.File.directoryContains('/a/b', '/a/b/c')"));
			assert.isTrue(evalInScope("Zotero.File.directoryContains('/a/b', '/a/b/c/d')"));
			assert.isFalse(evalInScope("Zotero.File.directoryContains('/a/b', '/a/c')"));
			assert.isFalse(evalInScope("Zotero.File.directoryContains('/a/b', '/a/bc')"));
		});

		it("should truncate file names with truncateFileName()", function () {
			let result = evalInScope("Zotero.File.truncateFileName('a_very_long_filename_that_exceeds.pdf', 20)");
			assert.ok(result);
			assert.isTrue(result.endsWith('.pdf'));
			assert.isAtMost(new TextEncoder().encode(result).length, 20);
		});

		it("should not truncate short file names with truncateFileName()", function () {
			let result = evalInScope("Zotero.File.truncateFileName('short.txt', 255)");
			assert.equal(result, 'short.txt');
		});

		it("should get file extension with getExtension()", function () {
			let filePath = PathUtils.join(tmpDir, 'testfile.pdf');
			evalInScope(`var _ext = Zotero.File.getExtension(${JSON.stringify(filePath)})`);
			assert.equal(evalInScope("_ext"), 'pdf');
		});

		it("should return empty string for file with no extension from getExtension()", function () {
			let filePath = PathUtils.join(tmpDir, 'noext');
			evalInScope(`var _ext = Zotero.File.getExtension(${JSON.stringify(filePath)})`);
			assert.equal(evalInScope("_ext"), '');
		});

		it("should write and read text file with putContentsAsync/getContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-rw.txt');
			await evalInScope(`Zotero.File.putContentsAsync(${JSON.stringify(filePath)}, "hello sandbox")`);

			let contents = await evalInScope(`Zotero.File.getContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents, "hello sandbox");
		});

		it("should write and read unicode text with putContentsAsync/getContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-unicode.txt');
			let unicodeText = "Unicode: \u00e9\u00e8\u00ea \u4f60\u597d \ud83d\ude00";
			await evalInScope(`Zotero.File.putContentsAsync(${JSON.stringify(filePath)}, ${JSON.stringify(unicodeText)})`);

			let contents = await evalInScope(`Zotero.File.getContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents, unicodeText);
		});

		it("should read binary contents with getBinaryContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-binary.bin');
			await IOUtils.write(filePath, new Uint8Array([0x00, 0x01, 0x02, 0xFF]));

			let contents = await evalInScope(`Zotero.File.getBinaryContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents.length, 4);
			assert.equal(contents.charCodeAt(0), 0x00);
			assert.equal(contents.charCodeAt(1), 0x01);
			assert.equal(contents.charCodeAt(2), 0x02);
			assert.equal(contents.charCodeAt(3), 0xFF);
		});

		it("should read binary contents with maxLength using getBinaryContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-binary-max.bin');
			await IOUtils.write(filePath, new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50]));

			let contents = await evalInScope(`Zotero.File.getBinaryContentsAsync(${JSON.stringify(filePath)}, 3)`);
			assert.equal(contents.length, 3);
			assert.equal(contents.charCodeAt(0), 0x10);
			assert.equal(contents.charCodeAt(1), 0x20);
			assert.equal(contents.charCodeAt(2), 0x30);
		});

		it("should create directory with createDirectoryIfMissingAsync()", async function () {
			let dirPath = PathUtils.join(tmpDir, 'new-subdir');
			await evalInScope(`Zotero.File.createDirectoryIfMissingAsync(${JSON.stringify(dirPath)})`);

			assert.isTrue(await IOUtils.exists(dirPath));
			let info = await IOUtils.stat(dirPath);
			assert.equal(info.type, 'directory');
		});

		it("should check if directory is empty with directoryIsEmpty()", async function () {
			let emptyDir = PathUtils.join(tmpDir, 'empty-dir');
			await IOUtils.makeDirectory(emptyDir, { ignoreExisting: true });

			let isEmpty = await evalInScope(`Zotero.File.directoryIsEmpty(${JSON.stringify(emptyDir)})`);
			assert.isTrue(isEmpty);

			// Add a file
			await IOUtils.writeUTF8(PathUtils.join(emptyDir, 'file.txt'), 'content');

			let isEmptyAfter = await evalInScope(`Zotero.File.directoryIsEmpty(${JSON.stringify(emptyDir)})`);
			assert.isFalse(isEmptyAfter);
		});

		it("should remove file with removeIfExists()", async function () {
			let filePath = PathUtils.join(tmpDir, 'to-remove.txt');
			await IOUtils.writeUTF8(filePath, 'delete me');

			let removed = await evalInScope(`Zotero.File.removeIfExists(${JSON.stringify(filePath)})`);
			assert.isTrue(removed);
			assert.isFalse(await IOUtils.exists(filePath));
		});

		it("should not throw for removeIfExists() on nonexistent file", async function () {
			let filePath = PathUtils.join(tmpDir, 'does-not-exist.txt');
			// Should not throw
			await evalInScope(`Zotero.File.removeIfExists(${JSON.stringify(filePath)})`);
		});

		it("should rename a file with rename()", async function () {
			let filePath = PathUtils.join(tmpDir, 'rename-original.txt');
			await IOUtils.writeUTF8(filePath, 'rename me');

			let newName = await evalInScope(`Zotero.File.rename(${JSON.stringify(filePath)}, "rename-result.txt")`);
			assert.ok(newName);
			assert.isFalse(await IOUtils.exists(filePath));
			assert.isTrue(await IOUtils.exists(PathUtils.join(tmpDir, newName)));
		});

		it("should iterate directory entries with iterateDirectory()", async function () {
			let iterDir = PathUtils.join(tmpDir, 'iter-dir');
			await IOUtils.makeDirectory(iterDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(iterDir, 'a.txt'), 'aaa');
			await IOUtils.writeUTF8(PathUtils.join(iterDir, 'b.txt'), 'bbb');

			evalInScope("var _iterCount = 0");
			await evalInScope(`Zotero.File.iterateDirectory(${JSON.stringify(iterDir)}, function(entry) { _iterCount++; })`);

			assert.equal(evalInScope("_iterCount"), 2);
		});

		it("should copy directory with copyDirectory()", async function () {
			let srcDir = PathUtils.join(tmpDir, 'copy-src');
			let destDir = PathUtils.join(tmpDir, 'copy-dest');
			await IOUtils.makeDirectory(srcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'file1.txt'), 'content1');
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'file2.txt'), 'content2');

			await evalInScope(`Zotero.File.copyDirectory(${JSON.stringify(srcDir)}, ${JSON.stringify(destDir)})`);

			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'file1.txt')));
			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'file2.txt')));
			let content = await IOUtils.readUTF8(PathUtils.join(destDir, 'file1.txt'));
			assert.equal(content, 'content1');
			// Source should still exist
			assert.isTrue(await IOUtils.exists(PathUtils.join(srcDir, 'file1.txt')));
		});

		it("should move file to unique name with moveToUnique()", async function () {
			let srcPath = PathUtils.join(tmpDir, 'move-unique-src.txt');
			let destPath = PathUtils.join(tmpDir, 'move-unique-dest.txt');
			await IOUtils.writeUTF8(srcPath, 'move me');
			// Create destination so unique name is generated
			await IOUtils.writeUTF8(destPath, 'existing');

			let newPath = await evalInScope(`Zotero.File.moveToUnique(${JSON.stringify(srcPath)}, ${JSON.stringify(destPath)})`);
			assert.ok(newPath);
			assert.notEqual(newPath, destPath);
			assert.isFalse(await IOUtils.exists(srcPath));
			assert.isTrue(await IOUtils.exists(newPath));
			let content = await IOUtils.readUTF8(newPath);
			assert.equal(content, 'move me');
		});

		it("should set normal file permissions with setNormalFilePermissions()", async function () {
			let filePath = PathUtils.join(tmpDir, 'perms-test.txt');
			await IOUtils.writeUTF8(filePath, 'permissions test');
			// Make it read-only first
			await IOUtils.setPermissions(filePath, 0o444);

			await evalInScope(`Zotero.File.setNormalFilePermissions(${JSON.stringify(filePath)})`);

			let info = await IOUtils.stat(filePath);
			assert.equal(info.permissions, 0o644);
		});

		it("should generate data URI with generateDataURI()", async function () {
			let filePath = PathUtils.join(tmpDir, 'datauri-test.txt');
			await IOUtils.writeUTF8(filePath, 'hello data uri');

			let dataURI = await evalInScope(`Zotero.File.generateDataURI(${JSON.stringify(filePath)}, "text/plain")`);
			assert.ok(dataURI);
			assert.isTrue(dataURI.startsWith('data:text/plain;base64,'));
		});

		it("should zip a directory with zipDirectory()", async function () {
			let zipSrcDir = PathUtils.join(tmpDir, 'zip-src');
			let zipPath = PathUtils.join(tmpDir, 'test-output.zip');
			await IOUtils.makeDirectory(zipSrcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(zipSrcDir, 'zipped.txt'), 'zip content');

			let result = await evalInScope(`Zotero.File.zipDirectory(${JSON.stringify(zipSrcDir)}, ${JSON.stringify(zipPath)})`);
			assert.isTrue(result);
			assert.isTrue(await IOUtils.exists(zipPath));
			// ZIP file should have non-zero size
			let info = await IOUtils.stat(zipPath);
			assert.isAbove(info.size, 0);
		});

		it("should return false from zipDirectory() for empty directory", async function () {
			let zipSrcDir = PathUtils.join(tmpDir, 'zip-empty-src');
			let zipPath = PathUtils.join(tmpDir, 'test-empty.zip');
			await IOUtils.makeDirectory(zipSrcDir, { ignoreExisting: true });

			let result = await evalInScope(`Zotero.File.zipDirectory(${JSON.stringify(zipSrcDir)}, ${JSON.stringify(zipPath)})`);
			assert.isFalse(result);
		});

		it("should move a directory with moveDirectory()", async function () {
			let srcDir = PathUtils.join(tmpDir, 'move-dir-src');
			let destDir = PathUtils.join(tmpDir, 'move-dir-dest');
			await IOUtils.makeDirectory(srcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'moved.txt'), 'moved content');

			let errors = await evalInScope(`Zotero.File.moveDirectory(${JSON.stringify(srcDir)}, ${JSON.stringify(destDir)})`);
			assert.equal(errors.length, 0);
			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'moved.txt')));
			let content = await IOUtils.readUTF8(PathUtils.join(destDir, 'moved.txt'));
			assert.equal(content, 'moved content');
		});
	});


	describe("Zotero.File permissions", function () {
		// Lives outside the plugin's auto-allowed plugin-data directory.
		var outsidePath;
		var outsideDir;

		before(async function () {
			outsideDir = await getTempDirectory();
			outsidePath = PathUtils.join(outsideDir, "outside-" + Zotero.Utilities.randomString() + ".txt");
			await IOUtils.writeUTF8(outsidePath, "outside content");
		});

		after(async function () {
			await IOUtils.remove(outsidePath, { ignoreAbsent: true });
		});

		beforeEach(function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
			Zotero.Prefs.clear(PREF_PREFIX + PLUGIN_UUID, true);
		});

		afterEach(function () {
			Zotero.Prefs.clear(PREF_PREFIX + PLUGIN_UUID, true);
		});

		it("denies read access outside plugin-data without a grant", async function () {
			let denied = await evalInScope(`
				Zotero.File.getContentsAsync(${JSON.stringify(outsidePath)})
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
		});

		it("denies write access outside plugin-data without a grant", async function () {
			let target = PathUtils.join(outsideDir, "no-write-" + Zotero.Utilities.randomString() + ".txt");
			let denied = await evalInScope(`
				Zotero.File.putContentsAsync(${JSON.stringify(target)}, "denied")
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
			assert.isFalse(await IOUtils.exists(target), "no file should have been written");
		});

		it("exposes the plugin-injected helpers (requestFileAccess, withAccessSession, getPluginDir, getTempDirectory) on Zotero.File", function () {
			assert.equal(evalInScope("typeof Zotero.File.requestFileAccess"), "function");
			assert.equal(evalInScope("typeof Zotero.File.withAccessSession"), "function");
			assert.equal(evalInScope("typeof Zotero.File.getPluginDir"), "function");
			assert.equal(evalInScope("typeof Zotero.File.getTempDirectory"), "function");
		});

		it("rejects requestFileAccess on the Zotero profile directory", async function () {
			let target = PathUtils.join(PathUtils.profileDir, "prefs.js");
			let denied = await evalInScope(`
				Zotero.File.requestFileAccess(${JSON.stringify(target)}, "read")
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
		});

		it("rejects requestFileAccess on the Zotero data directory outside plugin-data", async function () {
			let target = PathUtils.join(Zotero.DataDirectory.dir, "zotero.sqlite");
			let denied = await evalInScope(`
				Zotero.File.requestFileAccess(${JSON.stringify(target)}, "read")
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
		});

		it("auto-allows operations inside the plugin's own data directory", async function () {
			let target = PathUtils.join(
				Zotero.DataDirectory.dir, "plugin-data", PLUGIN_UUID,
				"auto-" + Zotero.Utilities.randomString() + ".txt"
			);
			try {
				await evalInScope(`
					Zotero.File.putContentsAsync(${JSON.stringify(target)}, "auto-allowed")
				`);
				let content = await IOUtils.readUTF8(target);
				assert.equal(content, "auto-allowed");
			}
			finally {
				await IOUtils.remove(target, { ignoreAbsent: true });
			}
		});

		it("honors a persisted read grant for Zotero.File operations", async function () {
			Zotero.Prefs.set(
				PREF_PREFIX + PLUGIN_UUID,
				JSON.stringify([[outsidePath, { mode: "read" }]]),
				true
			);
			let contents = await evalInScope(`
				Zotero.File.getContentsAsync(${JSON.stringify(outsidePath)})
			`);
			assert.equal(contents, "outside content");
		});

		it("persisted deny rejects even when path is otherwise reachable", async function () {
			// Persist a deny on the outer dir; child reads should reject.
			Zotero.Prefs.set(
				PREF_PREFIX + PLUGIN_UUID,
				JSON.stringify([[outsideDir, { mode: "deny" }]]),
				true
			);
			let denied = await evalInScope(`
				Zotero.File.requestFileAccess(${JSON.stringify(outsidePath)}, "read")
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
		});

		it("session grant from chrome covers a write inside the session", async function () {
			let target = PathUtils.join(outsideDir, "session-write-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// Mirrors FilePicker.show()'s addSessionGrant after modeSave.
					PluginFileAccess.addSessionGrant(ADDON_ID, target, "write");
					await evalInScope(`
						Zotero.File.putContentsAsync(${JSON.stringify(target)}, "session payload")
					`);
				});
				assert.equal(await IOUtils.readUTF8(target), "session payload");
			}
			finally {
				await IOUtils.remove(target, { ignoreAbsent: true });
			}
		});

		it("session grants don't survive the session", async function () {
			let target = PathUtils.join(outsideDir, "transient-" + Zotero.Utilities.randomString() + ".txt");
			await IOUtils.writeUTF8(target, "transient");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					PluginFileAccess.addSessionGrant(ADDON_ID, target, "read");
				});
				// Outside the session: the grant is gone, so reads reject.
				let denied = await evalInScope(`
					Zotero.File.getContentsAsync(${JSON.stringify(target)})
						.then(() => false, () => true)
				`);
				assert.isTrue(denied);
			}
			finally {
				await IOUtils.remove(target, { ignoreAbsent: true });
			}
		});

		it("Zotero.File.getPluginDir returns the per-plugin data directory", async function () {
			let dir = await evalInScope(`Zotero.File.getPluginDir()`);
			let expected = PathUtils.join(Zotero.DataDirectory.dir, "plugin-data", PLUGIN_UUID);
			assert.equal(dir, expected);
		});

		it("Zotero.File.getTempDirectory hands the plugin a writable scratch dir inside a session", async function () {
			let tmpPath;
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				tmpPath = await evalInScope(`Zotero.File.getTempDirectory()`);
				assert.isString(tmpPath);
				assert.include(tmpPath, PLUGIN_UUID);
				let target = PathUtils.join(tmpPath, "in-temp-" + Zotero.Utilities.randomString() + ".txt");
				await evalInScope(`
					Zotero.File.putContentsAsync(${JSON.stringify(target)}, "temp")
				`);
				assert.equal(await IOUtils.readUTF8(target), "temp");
			});
		});

		it("withAccessSession rejects when the chrome-configured session timeout fires", async function () {
			// `Zotero.File.withAccessSession(fn)` deliberately omits the
			// `options` arg so plugins can't extend the session timeout
			// themselves -- chrome owns that. To verify the timeout reaches
			// the sandbox side, stub `PluginFileAccess.withSession` for this
			// test so it injects a tight timeout, then have the sandbox fn
			// outlast it.
			let original = PluginFileAccess.withSession;
			PluginFileAccess.withSession = (pluginID, fn) => original.call(
				PluginFileAccess, pluginID, fn, { timeout: 50 }
			);
			try {
				let threw = await evalInScope(`Zotero.File.withAccessSession(async () => {
					await new Promise(r => setTimeout(r, 300));
				}).then(() => false, () => true)`);
				assert.isTrue(threw,
					"withAccessSession should reject when chrome times out the session");
			}
			finally {
				PluginFileAccess.withSession = original;
			}
		});

		it("does not expose file-IO methods without fileSystemRead permission", function () {
			loadTestScope(["default"]);
			// Default schema still exposes pure-string helpers (getExtension,
			// normalizeToUnix, etc.) but no IO and no plugin-injected helpers.
			assert.equal(evalInScope("typeof Zotero.File.getContentsAsync"), "undefined");
			assert.equal(evalInScope("typeof Zotero.File.putContentsAsync"), "undefined");
			assert.equal(evalInScope("typeof Zotero.File.requestFileAccess"), "undefined");
			assert.equal(evalInScope("typeof Zotero.File.withAccessSession"), "undefined");
			assert.equal(evalInScope("typeof Zotero.File.getPluginDir"), "undefined");
			assert.equal(evalInScope("typeof Zotero.File.getTempDirectory"), "undefined");
		});
	});


	describe("FilePicker session grants", function () {
		var pickedFile;
		var pickedDir;

		before(async function () {
			let scratch = await getTempDirectory();
			pickedDir = PathUtils.join(scratch, "picked-dir-" + Zotero.Utilities.randomString());
			await IOUtils.makeDirectory(pickedDir);
			pickedFile = PathUtils.join(pickedDir, "picked.txt");
			await IOUtils.writeUTF8(pickedFile, "picked content");
		});

		after(async function () {
			await IOUtils.remove(pickedDir, { recursive: true, ignoreAbsent: true });
		});

		beforeEach(function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
		});

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
				let contents = await evalInScope(`
					Zotero.File.getContentsAsync(${JSON.stringify(pickedFile)})
				`);
				assert.equal(contents, "picked content");
			});
		});

		it("modeSave grant gives the plugin write access to the chosen destination", async function () {
			let target = PathUtils.join(pickedDir, "saved-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					PluginFileAccess.addSessionGrant(ADDON_ID, target, "write");
					await evalInScope(`
						Zotero.File.putContentsAsync(${JSON.stringify(target)}, "saved")
					`);
				});
				assert.equal(await IOUtils.readUTF8(target), "saved");
			}
			finally {
				await IOUtils.remove(target, { ignoreAbsent: true });
			}
		});

		it("modeGetFolder grant covers everything inside the picked folder", async function () {
			let inner = PathUtils.join(pickedDir, "inside-" + Zotero.Utilities.randomString() + ".txt");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// Folder picker with fileSystemWrite -> write grant on the dir
					PluginFileAccess.addSessionGrant(ADDON_ID, pickedDir, "write");
					await evalInScope(`
						Zotero.File.putContentsAsync(${JSON.stringify(inner)}, "in folder")
					`);
					let read = await evalInScope(`
						Zotero.File.getContentsAsync(${JSON.stringify(inner)})
					`);
					assert.equal(read, "in folder");
				});
			}
			finally {
				await IOUtils.remove(inner, { ignoreAbsent: true });
			}
		});

		it("modeOpenMultiple grant covers each picked file independently", async function () {
			let extra = PathUtils.join(pickedDir, "extra.txt");
			await IOUtils.writeUTF8(extra, "extra content");
			try {
				await PluginFileAccess.withSession(ADDON_ID, async () => {
					// FilePicker.show() iterates `this.files` and grants read on each.
					PluginFileAccess.addSessionGrant(ADDON_ID, pickedFile, "read");
					PluginFileAccess.addSessionGrant(ADDON_ID, extra, "read");
					let main = await evalInScope(`
						Zotero.File.getContentsAsync(${JSON.stringify(pickedFile)})
					`);
					let other = await evalInScope(`
						Zotero.File.getContentsAsync(${JSON.stringify(extra)})
					`);
					assert.equal(main, "picked content");
					assert.equal(other, "extra content");
				});
			}
			finally {
				await IOUtils.remove(extra, { ignoreAbsent: true });
			}
		});

		it("picker grant does not bleed across sessions", async function () {
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				PluginFileAccess.addSessionGrant(ADDON_ID, pickedFile, "read");
			});
			// Outside the session, reads should be rejected again.
			let denied = await evalInScope(`
				Zotero.File.getContentsAsync(${JSON.stringify(pickedFile)})
					.then(() => false, () => true)
			`);
			assert.isTrue(denied);
		});

		it("a cancelled picker (no addSessionGrant call) leaves the path unreachable", async function () {
			// returnCancel is the path where FilePicker.show simply returns
			// without calling addSessionGrant; the file should stay denied.
			await PluginFileAccess.withSession(ADDON_ID, async () => {
				let denied = await evalInScope(`
					Zotero.File.getContentsAsync(${JSON.stringify(pickedFile)})
						.then(() => false, () => true)
				`);
				assert.isTrue(denied);
			});
		});
	});


	describe("Zotero.File URL-based helpers", function () {
		describe("getContentsFromURLAsync", function () {
			beforeEach(function () {
				loadTestScope(
					["default", "fileSystemRead", "network"],
					["*://127.0.0.1/*"]
				);
			});

			it("fetches text from an http URL covered by host_permissions", async function () {
				let url = registerServerEndpoint("GET", () => [200, "text/plain", "url body"]);
				let text = await evalInScope(`
					Zotero.File.getContentsFromURLAsync(${JSON.stringify(url)})
				`);
				assert.equal(text, "url body");
			});

			it("rejects non-http schemes (e.g. file://)", async function () {
				let denied = await evalInScope(`(async () => {
					try { await Zotero.File.getContentsFromURLAsync("file:///etc/passwd"); return false; }
					catch { return true; }
				})()`);
				assert.isTrue(denied);
			});

			it("is not exposed without the network permission", function () {
				loadTestScope(["default", "fileSystemRead"]);
				assert.equal(
					evalInScope("typeof Zotero.File.getContentsFromURLAsync"),
					"undefined"
				);
			});
		});

		describe("download", function () {
			var pluginDataDir;
			var outsideDir;

			before(async function () {
				pluginDataDir = PathUtils.join(
					Zotero.DataDirectory.dir, "plugin-data", PLUGIN_UUID
				);
				outsideDir = await getTempDirectory();
			});

			beforeEach(function () {
				loadTestScope(
					["default", "fileSystemRead", "fileSystemWrite", "network"],
					["*://127.0.0.1/*"]
				);
			});

			it("downloads to a path inside the plugin's own data directory", async function () {
				let url = registerServerEndpoint("GET", () => [200, "application/octet-stream", "downloaded payload"]);
				let target = PathUtils.join(pluginDataDir, "dl-" + Zotero.Utilities.randomString() + ".bin");
				try {
					await evalInScope(`
						Zotero.File.download(${JSON.stringify(url)}, ${JSON.stringify(target)})
					`);
					let content = await IOUtils.readUTF8(target);
					assert.equal(content, "downloaded payload");
				}
				finally {
					await IOUtils.remove(target, { ignoreAbsent: true });
				}
			});

			it("downloads to a session-granted path outside plugin-data", async function () {
				let url = registerServerEndpoint("GET", () => [200, "text/plain", "session dl"]);
				let target = PathUtils.join(outsideDir, "session-dl-" + Zotero.Utilities.randomString() + ".bin");
				try {
					await PluginFileAccess.withSession(ADDON_ID, async () => {
						PluginFileAccess.addSessionGrant(ADDON_ID, target, "write");
						await evalInScope(`
							Zotero.File.download(${JSON.stringify(url)}, ${JSON.stringify(target)})
						`);
					});
					let content = await IOUtils.readUTF8(target);
					assert.equal(content, "session dl");
				}
				finally {
					await IOUtils.remove(target, { ignoreAbsent: true });
				}
			});

			it("rejects writing to a path outside the plugin's allowed scope", async function () {
				let url = registerServerEndpoint("GET", () => [200, "text/plain", "blocked"]);
				let target = PathUtils.join(outsideDir, "no-write-" + Zotero.Utilities.randomString() + ".bin");
				let denied = await evalInScope(`
					Zotero.File.download(${JSON.stringify(url)}, ${JSON.stringify(target)})
						.then(() => false, () => true)
				`);
				assert.isTrue(denied);
				assert.isFalse(await IOUtils.exists(target));
			});

			it("rejects non-http URIs (e.g. file://)", async function () {
				let target = PathUtils.join(pluginDataDir, "nope-fileuri.bin");
				let denied = await evalInScope(`(async () => {
					try { await Zotero.File.download("file:///etc/passwd", ${JSON.stringify(target)}); return false; }
					catch { return true; }
				})()`);
				assert.isTrue(denied);
				assert.isFalse(await IOUtils.exists(target));
			});

			it("is not exposed without the network permission", function () {
				loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
				assert.equal(evalInScope("typeof Zotero.File.download"), "undefined");
			});

			it("is not exposed without the fileSystemWrite permission", function () {
				loadTestScope(["default", "fileSystemRead", "network"]);
				assert.equal(evalInScope("typeof Zotero.File.download"), "undefined");
			});
		});
	});


	describe("Zotero.HTTP", function () {
		beforeEach(function () {
			loadTestScope(["default", "network"], ["*://127.0.0.1/*"]);
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
				loadTestScope(["default", "network"], []);

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
						dataProvider: function(item, dataKey) {
							return 'sandbox-data-' + item.id;
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
		});

		describe("ItemPaneManager", function () {
			it("should register an info row with onGetData from sandbox", async function () {
				evalInScope(`
					var _rowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function({ item }) {
							return 'row-data-' + item.id;
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

				let result = onGetData({ item });
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
				let result = onGetData({ item });
				assert.isNull(result, "Should return null fallback on error");

				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_errRowID)");
				await item.eraseTx();
			});

			describe("embedded sections", function () {
				var tmpDir;

				before(async function () {
					tmpDir = await getTempDirectory();
					await IOUtils.writeUTF8(
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
					await IOUtils.writeUTF8(
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
							onRender: function ({ page, item }) {
								// No DOM handoff -- render the page by messaging it
								page.sendMessage({ marker: 'rendered-' + item.id });
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

		// All three managers pass plugin callbacks a facaded item. Without
		// dataWrite, that facade must expose read methods (getField) but strip
		// write methods (save/saveTx/eraseTx), across every manager entry point.
		it("should pass read-only item facades to manager callbacks without dataWrite", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Callback Perm Test');
			await item.saveTx();
			// Each callback records typeof of the item's methods + its id into a
			// sandbox results object; assertContract checks the read-only contract.
			let assertContract = (resultsVar) => {
				assert.equal(evalInScope(`${resultsVar}.hasGetField`), 'function');
				assert.equal(evalInScope(`${resultsVar}.itemID`), item.id);
				assert.equal(evalInScope(`${resultsVar}.hasSave`), 'undefined');
				assert.equal(evalInScope(`${resultsVar}.hasSaveTx`), 'undefined');
				assert.equal(evalInScope(`${resultsVar}.hasErase`), 'undefined');
			};
			try {
				evalInScope(`
					var _probe = function (item, results) {
						results.hasSave = typeof item.save;
						results.hasSaveTx = typeof item.saveTx;
						results.hasErase = typeof item.eraseTx;
						results.hasGetField = typeof item.getField;
						results.itemID = item.id;
					};
				`);

				// ItemTreeManager.dataProvider
				evalInScope(`
					var _treeResults = {};
					var _permColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-perm-col',
						label: 'Perm Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function (item) { _probe(item, _treeResults); return 'test'; }
					});
				`);
				Zotero.ItemTreeManager.getCustomCellData(item, evalInScope("_permColKey"));
				assertContract("_treeResults");
				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_permColKey)");

				// ItemPaneManager.onGetData
				evalInScope(`
					var _rowResults = {};
					var _permRowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-perm-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function ({ item }) { _probe(item, _rowResults); return 'test'; }
					});
				`);
				Zotero.ItemPaneManager.getInfoRowHook(evalInScope("_permRowID"), 'onGetData')(
					{ item, tabType: 'library', editable: false });
				assertContract("_rowResults");
				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_permRowID)");

				// MenuManager.onCommand
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
							onCommand: function (context) { _probe(context.items[0], _menuResults); }
						}]
					});
				`);
				let menuOption = Zotero.MenuManager._menuManager._optionsCache[evalInScope("_permMenuID")];
				menuOption.menus[0].onCommand(null, { items: [item] });
				assertContract("_menuResults");
				evalInScope("Zotero.MenuManager.unregisterMenu(_permMenuID)");
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
		it("should block chrome windows and DOM nodes crossing into the sandbox", function () {
			loadTestScope(["default"]);
			let mainWin = Zotero.getMainWindow();
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

		it("should not allow setting listed properties on Zotero sub-objects", function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
			// The mirror is created with mutable: false, so setting listed props should throw
			assert.throws(() => evalInScope("Zotero.Items.get = function() {}"),
				undefined, undefined, "Setting Zotero.Items.get should throw");
			// The function should still work
			assert.isTrue(evalInScope("typeof Zotero.Items.get === 'function'"));
		});
	});

	describe("Permission isolation", function () {
		it("should not expose data APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Items === 'undefined'"),
				"Items should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Libraries === 'undefined'"),
				"Libraries should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Collections === 'undefined'"),
				"Collections should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Groups === 'undefined'"),
				"Groups should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Tags === 'undefined'"),
				"Tags should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemFields === 'undefined'"),
				"ItemFields should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemTypes === 'undefined'"),
				"ItemTypes should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.CreatorTypes === 'undefined'"),
				"CreatorTypes should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Fulltext === 'undefined'"),
				"Fulltext should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Notifier === 'undefined'"),
				"Notifier should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Item === 'undefined'"),
				"Item should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Collection === 'undefined'"),
				"Collection should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Search === 'undefined'"),
				"Search should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Duplicates === 'undefined'"),
				"Duplicates should not be exposed without data permission");
		});

		it("should only expose File.reveal with default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.File === 'object'"),
				"File should be exposed with default permission");
			assert.isTrue(evalInScope("typeof Zotero.File.reveal === 'function'"),
				"File.reveal should be exposed with default permission");
			assert.isTrue(evalInScope("typeof Zotero.File.getContentsAsync === 'undefined'"),
				"File.getContentsAsync should not be exposed without fileSystemRead");
			assert.isTrue(evalInScope("typeof Zotero.File.putContentsAsync === 'undefined'"),
				"File.putContentsAsync should not be exposed without fileSystemWrite");
		});

		it("should not expose network APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'undefined'"),
				"HTTP should not be exposed without network permission");
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

		it("should imply dataRead when dataWrite is granted", async function () {
			// Only declare dataWrite -- dataRead should be implied
			loadTestScope(["default", "dataWrite"]);

			// dataRead APIs should be available
			assert.isTrue(evalInScope("typeof Zotero.Items === 'object'"),
				"Items should be exposed via implied dataRead");
			assert.isTrue(evalInScope("typeof Zotero.Items.get === 'function'"),
				"Items.get should be exposed via implied dataRead");
			assert.isTrue(evalInScope("typeof Zotero.Libraries === 'object'"),
				"Libraries should be exposed via implied dataRead");
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'object'"),
				"Translators should be exposed via implied dataRead");

			// dataWrite APIs should also be available
			assert.isTrue(evalInScope("typeof Zotero.Items.trash === 'function'"),
				"Items.trash should be exposed with dataWrite");
			assert.isTrue(evalInScope("typeof Zotero.Translate === 'object'"),
				"Translate should be exposed with dataWrite");

			// Write methods on returned items should be unrestricted
			let item = new Zotero.Item('book');
			item.setField('title', 'Implied Permission Test');
			await item.saveTx();

			evalInScope(`var _impliedItem = Zotero.Items.get(${item.id})`);
			assert.isTrue(evalInScope("typeof _impliedItem.save === 'function'"),
				"save should be available on items with implied dataRead + dataWrite");
			assert.isTrue(evalInScope("typeof _impliedItem.saveTx === 'function'"),
				"saveTx should be available on items with implied dataRead + dataWrite");

			await item.eraseTx();
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
			assert.isTrue(evalInScope("typeof Zotero.Items === 'object'"),
				"Items should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.Libraries === 'object'"),
				"Libraries should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.File.getContentsAsync === 'undefined'"),
				"File read methods should not be exposed with only data permission");
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'undefined'"),
				"HTTP should not be exposed with only data permission");
		});

		it("should expose fileSystem APIs but not data with fileSystem permission", function () {
			loadTestScope(["default", "fileSystemRead", "fileSystemWrite"]);
			assert.isTrue(evalInScope("typeof Zotero.File === 'object'"),
				"File should be exposed with fileSystem permission");
			assert.isTrue(evalInScope("typeof Zotero.Items === 'undefined'"),
				"Items should not be exposed with only fileSystem permission");
		});

		it("should merge multiple permissions correctly", function () {
			loadTestScope(["default", "dataRead", "dataWrite", "network", "preferences"], [], ["test."]);
			assert.isTrue(evalInScope("typeof Zotero.Items === 'object'"),
				"Items should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemFields === 'object'"),
				"ItemFields should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed with network permission");
			assert.isTrue(evalInScope("typeof Zotero.Prefs === 'object'"),
				"Prefs should be exposed with preferences permission");
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'object'"),
				"Translators should be exposed with translator permission");
			assert.isTrue(evalInScope("typeof Zotero.File.getContentsAsync === 'undefined'"),
				"File read methods should not be exposed without fileSystemRead permission");
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
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "test.html"), htmlContent);
				// Also create an XHTML file to test rejection
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "test.xhtml"), "<html></html>");
				// Create CSS and JS files for resource loading test
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "style.css"),
					"#test-div { color: rgb(255, 0, 0); }"
				);
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "script.js"),
					"document.getElementById('test-div').setAttribute('data-script-loaded', 'true');\n"
					+ "window._pluginScriptLoaded = true;"
				);
				let resourceHtml = "<!DOCTYPE html><html><head><title>Resources</title>"
					+ '<link rel="stylesheet" href="style.css">'
					+ "</head><body><div id='test-div'>Styled</div>"
					+ '<script src="script.js"></script></body></html>';
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "resources.html"), resourceHtml);
				// Page that echoes plugin messages and relays zoteroHost.api calls,
				// for page-messenger tests (external script to satisfy the page CSP)
				await IOUtils.writeUTF8(
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
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "echo.html"),
					"<!DOCTYPE html><html><head><title>Echo</title></head>"
					+ '<body><script src="echo.js"></script></body></html>'
				);
				// Fixed-size page larger than its window features, for fitContent
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "fixed-size.html"),
					"<!DOCTYPE html><html><head><title>Fixed</title>"
					+ "<style>html, body { margin: 0; padding: 0; }</style></head>"
					+ "<body><div style='width: 500px; height: 400px;'></div></body></html>"
				);
				// Create an HTML + external JS that probes privileged APIs
				await IOUtils.writeUTF8(
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
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "privileged.html"), privilegedProbeHtml);

				// CSP probe: a same-origin external script that records whether
				// eval() is permitted by the page's Content-Security-Policy.
				await IOUtils.writeUTF8(
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
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "csp-inline.html"),
					"<!DOCTYPE html><html><head></head><body>"
					+ "<script>window._inlineRan = true;</script>"
					+ '<script src="csp-probe.js"></script></body></html>'
				);
				// A page trying to loosen its own CSP via <meta> to allow eval.
				// meta can only tighten, so eval should still be blocked.
				await IOUtils.writeUTF8(
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
				await IOUtils.remove(tmpDir, { recursive: true });
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
				await IOUtils.writeUTF8(
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

					// Anything else -- no parent, an unknown ID, a window that isn't the plugin's -- gets the hidden window
					let hidden = Services.appShell.hiddenDOMWindow.browsingContext;
					for (let [name, parent] of [["_fp2", "null"], ["_fp3", "-1"], ["_fp4", String(mainWin.browsingContext.id)]]) {
						makePicker(name);
						evalInScope(`${name}.init(${parent}, "Other parent", ${name}.modeOpen)`);
						assert.strictEqual(initSpy.lastCall.args[0], hidden, `${parent} should parent to the hidden window`);
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

					let unknown = await sendToPage({ type: "call-api", name: "nope", params: {} });
					assert.equal(unknown.type, "api-error", "undeclared API should reject");

					let badParams = await sendToPage({ type: "call-api-bad" });
					assert.equal(badParams.type, "api-error", "non-object params should reject");
					assert.include(badParams.message, "plain object");
				}
				finally {
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
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "remote-script.html"),
					"<!DOCTYPE html><html><head></head><body>"
					+ `<script src="${remoteURL}"></script>`
					+ "</body></html>"
				);
				loadTestScopeWithURI(["default", "window"]);
				await evalInScope("openWindow('remote-script.html').then(function (win) { _win = win; })");
				let contentWin = getLastPluginWindowContent();
				try {
					for (let i = 0; i < 100 && contentWin.wrappedJSObject._remoteRan === undefined; i++) {
						await Zotero.Promise.delay(20);
					}
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
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "remote-fetch-probe.js"),
					"window._fetchStatus = 'pending';\n"
					// no-cors so a CORS rejection isn't mistaken for a CSP block;
					// 127.0.0.1 is loopback, so no mixed-content block either.
					+ `fetch(${JSON.stringify(remoteURL)}, { mode: 'no-cors' }).then(\n`
					+ "  function () { window._fetchStatus = 'allowed'; },\n"
					+ "  function () { window._fetchStatus = 'blocked'; }\n"
					+ ");\n"
				);
				await IOUtils.writeUTF8(
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
			await IOUtils.writeUTF8(
				PathUtils.join(tmpDir, "pane-script.js"),
				"document.getElementById('embedded-pane-marker').setAttribute('data-script-ran', 'true');\n"
				+ "zoteroHost.addMessageListener(function (data) {\n"
				+ "  if (data && data.type === 'ping') {\n"
				+ "    zoteroHost.sendMessage({ type: 'pong', value: data.value });\n"
				+ "  }\n"
				+ "});\n"
			);
			await IOUtils.writeUTF8(
				PathUtils.join(tmpDir, "prefs.html"),
				"<!DOCTYPE html><html><head><title>Pane</title></head><body>"
				+ "<div id='embedded-pane-marker'>Frobnicate the widgets</div>"
				+ "<button data-search-strings-raw='Xyzzy'>Attributed</button>"
				+ "<select><option>Alpha</option><option>Kumquat marmalade</option></select>"
				+ '<script src="pane-script.js"></script></body></html>'
			);
		});

		after(async function () {
			await IOUtils.remove(tmpDir, { recursive: true });
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
				await IOUtils.remove(tmpDir, { recursive: true });
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

			it("should trace set on a mutable instance", async function () {
				PluginSandbox.unloadScope(ADDON_ID);
				loadTestScope(["default", "dataRead", "dataWrite"]);
				startCapture();
				let item = await createDataObject('item', { title: 'Set Trace Test' });
				try {
					await evalInScope(`
						Zotero.Items.getAsync(${item.id}).then(i => { i.dateModified = '2025-01-01'; })
					`);
					let setLine = traceLines.find(l => l.includes("[set]") && l.includes("dateModified"));
					assert.ok(setLine, "Should have a [set] trace for dateModified");
				}
				finally {
					await item.eraseTx();
				}
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
				loadTestScope(["default", "dataRead"]);
				startCapture();
			});

			it("should trace method calls on returned instances", async function () {
				let item = await createDataObject('item', { title: 'Trace Test Item' });
				try {
					await evalInScope(`Zotero.Items.getAsync(${item.id}).then(i => i.getField('title'))`);
					let callLine = findTrace("call", "Zotero.Items.getAsync");
					assert.ok(callLine, "Should have a [call] trace for Zotero.Items.getAsync");

					let methodLine = traceLines.find(l => l.includes("[call]") && l.includes("getField"));
					assert.ok(methodLine, "Should have a [call] trace for getField. All call traces: "
						+ JSON.stringify(traceLines.filter(l => l.includes("[call]"))));
					assert.include(methodLine, ADDON_ID);
				}
				finally {
					await item.eraseTx();
				}
			});

			it("should trace getter access on returned instances", async function () {
				let item = await createDataObject('item', { title: 'Trace Getter Test' });
				try {
					await evalInScope(`Zotero.Items.getAsync(${item.id}).then(i => i.itemType)`);
					let getLine = traceLines.find(l => l.includes("[get]") && l.includes("itemType"));
					assert.ok(getLine, "Should have a [get] trace for itemType");
				}
				finally {
					await item.eraseTx();
				}
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
	});

	describe("plugin manifest content_security_policy (real install)", function () {
		var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
		const INSTALL_ID = "csp-install-test@zotero.org";

		it("passes the manifest content_security_policy through to installPermissions and the policy", async function () {
			let dir = await getTempDirectory();
			await IOUtils.writeUTF8(
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
			await IOUtils.writeUTF8(
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
				await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
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
