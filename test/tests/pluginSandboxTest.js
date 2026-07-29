describe("Plugin Sandbox", function () {
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
	var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/file.mjs");
	var { ScopeUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
	var { WindowScopeVariables } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/variables.mjs");
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

	// Build a real container > target DOM pair, expose a wrapped (rootNode-scoped)
	// facade of `target` to the sandbox as `_target`, and return the real nodes
	// so the caller can assert on them and clean up.
	function setupSafeDiv() {
		let container = document.createElement("div");
		document.documentElement.appendChild(container);
		let target = document.createElement("div");
		container.appendChild(target);
		scope._target = WindowScopeVariables.createSafeHTMLElement(
			target, ADDON_ID, { rootNode: new WeakRef(container) }
		);
		return { container, target };
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

	describe("Plugin DBConnection", function () {
		var pluginDir;

		beforeEach(function () {
			loadTestScope(["default", "database"]);
			// Plugin databases live in plugin-db/<UUID>/, separate from the
			// plugin's file-access data dir (plugin-data/<UUID>/).
			pluginDir = PathUtils.join(
				Zotero.DataDirectory.dir, "plugin-db",
				PLUGIN_UUID
			);
		});

		afterEach(async function () {
			// Close any plugin DBs and clean up the plugin data directory
			try {
				await evalInScope(`
					typeof _db !== 'undefined' && _db.closeDatabase
						? _db.closeDatabase(true)
						: Promise.resolve()
				`);
			}
			catch (e) {}
			await IOUtils.remove(pluginDir, { recursive: true, ignoreAbsent: true });
		});

		it("should expose Zotero.DBConnection constructor with database", function () {
			assert.isTrue(evalInScope("typeof Zotero.DBConnection === 'function'"));
		});

		it("should not expose Zotero.DBConnection without database", function () {
			loadTestScope(["default", "dataRead", "dataWrite"]);
			assert.isTrue(evalInScope("typeof Zotero.DBConnection === 'undefined'"));
		});

		it("should create a database in the plugin data directory", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)')
			`);

			let dbPath = PathUtils.join(pluginDir, "testdb.sqlite");
			assert.isTrue(await IOUtils.exists(dbPath),
				"Database file should exist in plugin data directory");
		});

		it("should support query and transaction methods", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.executeTransaction(async function () {
					await _db.queryAsync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
					await _db.queryAsync("INSERT INTO kv (key, value) VALUES ('foo', 'bar')");
				})
			`);

			let value = await evalInScope(`
				_db.valueQueryAsync("SELECT value FROM kv WHERE key = 'foo'")
			`);
			assert.equal(value, "bar");

			// queryAsync returns forwarding proxies that delegate property
			// access to the chrome-side db.js Proxy rows.  Assertions must
			// run inside the sandbox (Xrays bypass Proxy traps from chrome).
			let queryResult = await evalInScope(`
				_db.queryAsync("SELECT key, value FROM kv").then(function (rows) {
					return rows[0].key + ":" + rows[0].value;
				})
			`);
			assert.equal(queryResult, "foo:bar");

			// rowQueryAsync should return a single row with column access
			let rowResult = await evalInScope(`
				_db.rowQueryAsync("SELECT key, value FROM kv WHERE key = 'foo'").then(function (row) {
					return row.key + ":" + row.value;
				})
			`);
			assert.equal(rowResult, "foo:bar");
		});

		it("should expose tableExists and columnExists", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)')
			`);

			assert.isTrue(await evalInScope("_db.tableExists('test')"));
			assert.isFalse(await evalInScope("_db.tableExists('nonexistent')"));
			assert.isTrue(await evalInScope("_db.columnExists('test', 'name')"));
			assert.isFalse(await evalInScope("_db.columnExists('test', 'missing')"));
		});

		it("should support columnQueryAsync", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.executeTransaction(async function () {
					await _db.queryAsync('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
					await _db.queryAsync("INSERT INTO items (name) VALUES ('alpha')");
					await _db.queryAsync("INSERT INTO items (name) VALUES ('beta')");
				})
			`);

			let names = await evalInScope(`
				_db.columnQueryAsync("SELECT name FROM items ORDER BY name")
			`);
			assert.isArray(names);
			assert.equal(names.length, 2);
			assert.equal(names[0], "alpha");
			assert.equal(names[1], "beta");
		});

		it("should support queryTx", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS qt (val TEXT)')
			`);

			await evalInScope(`
				_db.queryTx("INSERT INTO qt (val) VALUES ('txval')")
			`);

			let val = await evalInScope(`
				_db.valueQueryAsync("SELECT val FROM qt WHERE val = 'txval'")
			`);
			assert.equal(val, "txval");
		});

		it("should support indexExists", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.executeTransaction(async function () {
					await _db.queryAsync('CREATE TABLE IF NOT EXISTS idx_test (id INTEGER PRIMARY KEY, val TEXT)');
					await _db.queryAsync('CREATE INDEX IF NOT EXISTS idx_val ON idx_test (val)');
				})
			`);

			assert.isTrue(await evalInScope("_db.indexExists('idx_val')"));
			assert.isFalse(await evalInScope("_db.indexExists('no_such_index')"));
		});

		it("should support getColumns", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS col_test (id INTEGER PRIMARY KEY, name TEXT, score REAL)')
			`);

			let cols = await evalInScope("_db.getColumns('col_test')");
			assert.isArray(cols);
			assert.include(Array.from(cols), "id");
			assert.include(Array.from(cols), "name");
			assert.include(Array.from(cols), "score");
		});

		it("should support inTransaction", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('testdb');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY)')
			`);

			assert.isFalse(await evalInScope("_db.inTransaction()"));

			let inTx = await evalInScope(`
				_db.executeTransaction(async function () {
					return _db.inTransaction();
				})
			`);
			assert.isTrue(inTx);
		});

		it("should expose path property", function () {
			evalInScope("var _db = new Zotero.DBConnection('pathtest')");

			let dbPath = evalInScope("_db.path");
			assert.isString(dbPath);
			assert.include(dbPath, "pathtest.sqlite");
		});

		it("should support closeDatabase", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('closetest');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)')
			`);

			await evalInScope("_db.closeDatabase(true)");

			// After closing, queries should fail
			let e = await getPromiseError(evalInScope("_db.queryAsync('SELECT 1')"));
			assert.ok(e, "queries should fail after closeDatabase");
		});

		it("should support deleteDatabase", async function () {
			await evalInScope(`
				var _db = new Zotero.DBConnection('deltest');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)')
			`);

			let dbPath = PathUtils.join(pluginDir, "deltest.sqlite");
			assert.isTrue(await IOUtils.exists(dbPath));

			await evalInScope("_db.closeDatabase(true)");
			await evalInScope("Zotero.DBConnection.deleteDatabase('deltest')");

			assert.isFalse(await IOUtils.exists(dbPath),
				"database file should be removed after deleteDatabase");
		});

		it("should support hasDatabase", async function () {
			assert.isFalse(await evalInScope(
				"Zotero.DBConnection.hasDatabase('checktest')"
			));

			await evalInScope(`
				var _db = new Zotero.DBConnection('checktest');
				_db.queryAsync('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)')
			`);

			assert.isTrue(await evalInScope(
				"Zotero.DBConnection.hasDatabase('checktest')"
			));
		});

		it("should support deleteAllDatabases", async function () {
			await evalInScope(`
				var _db1 = new Zotero.DBConnection('all1');
				_db1.queryAsync('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)')
			`);
			await evalInScope(`
				var _db2 = new Zotero.DBConnection('all2');
				_db2.queryAsync('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)')
			`);

			assert.isTrue(await IOUtils.exists(
				PathUtils.join(pluginDir, "all1.sqlite")
			));
			assert.isTrue(await IOUtils.exists(
				PathUtils.join(pluginDir, "all2.sqlite")
			));

			// Close before deleting
			await evalInScope("_db1.closeDatabase(true)");
			await evalInScope("_db2.closeDatabase(true)");
			await evalInScope("Zotero.DBConnection.deleteAllDatabases()");

			assert.isFalse(await IOUtils.exists(pluginDir),
				"plugin data directory should be removed");
		});

		it("should reject path separators in database name", function () {
			assert.throws(() => evalInScope("new Zotero.DBConnection('../escape')"));
			assert.throws(() => evalInScope("new Zotero.DBConnection('sub/db')"));
			assert.throws(() => evalInScope("new Zotero.DBConnection('a\\\\b')"));
		});

		it("should reject opening the main Zotero database", function () {
			assert.throws(() => evalInScope("new Zotero.DBConnection('zotero')"));
		});

		it("should not expose dangerous methods like backupDatabase or vacuum", async function () {
			evalInScope("var _db = new Zotero.DBConnection('testdb')");

			assert.isFalse(evalInScope("typeof _db.backupDatabase === 'function'"),
				"backupDatabase should not be exposed");
			assert.isFalse(evalInScope("typeof _db.backUpDatabase === 'function'"),
				"backUpDatabase should not be exposed");
			assert.isFalse(evalInScope("typeof _db.vacuum === 'function'"),
				"vacuum should not be exposed");
			assert.isFalse(evalInScope("typeof _db.integrityCheck === 'function'"),
				"integrityCheck should not be exposed");
			assert.isFalse(evalInScope("typeof _db._getConnection === 'function'"),
				"_getConnection should not be exposed");
			assert.isFalse(evalInScope("typeof _db._getConnectionAsync === 'function'"),
				"_getConnectionAsync should not be exposed");
		});

		it("should block ATTACH/DETACH/VACUUM on all query methods", async function () {
			evalInScope("var _db = new Zotero.DBConnection('attacktest')");
			let dangerous = [
				"ATTACH DATABASE '/tmp/evil.sqlite' AS e",
				"ATTACH'/tmp/evil.sqlite'AS e",
				"  attach '/tmp/evil.sqlite' as e",
				"VACUUM INTO '/tmp/evil.sqlite'",
				"DETACH e",
			];
			for (let m of ["queryAsync", "valueQueryAsync", "columnQueryAsync"]) {
				for (let sql of dangerous) {
					// The SQL guard throws synchronously, so wrap to capture it as a rejection
					let e = await getPromiseError((async () => evalInScope(`_db.${m}(${JSON.stringify(sql)})`))());
					assert.ok(e, `${m} should reject: ${sql}`);
				}
			}
			// A normal statement still works on each method
			await evalInScope("_db.queryAsync('CREATE TABLE t (a TEXT)')");
			await evalInScope("_db.queryAsync(\"INSERT INTO t VALUES ('x')\")");
			assert.equal(await evalInScope("_db.valueQueryAsync('SELECT a FROM t')"), 'x');
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

			it("should pass a safe document to renderCell", function () {
				// Register a column with renderCell that probes doc restrictions
				evalInScope(`
					var _renderResults = {};
					var _renderColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-render-col',
						label: 'Render Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) { return 'test'; },
						renderCell: function(index, data, column, isFirstColumn, doc) {
							_renderResults.hasDoc = !!doc;
							_renderResults.typeofDoc = typeof doc;
							// Safe document should expose createElement
							_renderResults.hasCreateElement = typeof doc.createElement === 'function';
							_renderResults.hasCreateXULElement = typeof doc.createXULElement === 'function';
							// Safe document should not expose querySelector, getElementById, etc.
							_renderResults.hasQuerySelector = typeof doc.querySelector === 'function';
							_renderResults.hasGetElementById = typeof doc.getElementById === 'function';
							_renderResults.hasDocumentElement = typeof doc.documentElement !== 'undefined';
							// Create an element and return it
							var span = doc.createElement('span');
							_renderResults.createdTag = span.tagName;
							return span;
						}
					});
				`);
				let dataKey = evalInScope("_renderColKey");
				assert.isString(dataKey);
				let option = Zotero.ItemTreeManager._columnManager._optionsCache[dataKey];
				let renderCell = option.renderCell;

				try {
					// Invoke renderCell with a real document
					renderCell(0, 'test', { className: 'test-col' }, false, pluginWin.document);

					assert.isTrue(evalInScope("_renderResults.hasDoc"),
						"doc should be accessible");
					assert.isTrue(evalInScope("_renderResults.hasCreateElement"),
						"createElement should be exposed on safe document");
					assert.isTrue(evalInScope("_renderResults.hasCreateXULElement"),
						"createXULElement should be exposed on safe document");
					assert.isTrue(evalInScope("_renderResults.hasQuerySelector"),
						"querySelector should be exposed on safe document");
					assert.isTrue(evalInScope("_renderResults.hasGetElementById"),
						"getElementById should be exposed on safe document");
					assert.equal(evalInScope("_renderResults.createdTag"), "span",
						"createElement should return elements");
				}
				finally {
					evalInScope("Zotero.ItemTreeManager.unregisterColumn(_renderColKey)");
				}
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

			it("should restrict section body to its own subtree via rootNode", function () {
				// Register a section with onRender that probes body restrictions
				evalInScope(`
					var _sectionResults = {};
					var _sectionID = Zotero.ItemPaneManager.registerSection({
						paneID: 'sandbox-restrict-section',
						pluginID: '${ADDON_ID}',
						header: { l10nID: 'general-print', icon: 'chrome://zotero/skin/16/universal/empty.png' },
						sidenav: { l10nID: 'general-print', icon: 'chrome://zotero/skin/20/universal/empty.png' },
						onRender: function({ body, doc }) {
							_sectionResults.hasBody = !!body;
							_sectionResults.bodyTag = body.tagName;
							// parentNode is outside rootNode subtree -- should be null
							_sectionResults.parentNode = body.parentNode;
							// ownerGlobal is blocked
							try {
								body.ownerGlobal;
								_sectionResults.ownerGlobal = 'accessible';
							} catch(e) {
								_sectionResults.ownerGlobal = 'blocked';
							}
							// ownerDocument returns a safe document
							_sectionResults.hasDocument = typeof body.ownerDocument === 'object';
							// child within subtree should be accessible
							var child = doc.createElement('span');
							body.appendChild(child);
							_sectionResults.childCount = body.childElementCount;
							_sectionResults.childTag = body.firstElementChild
								? body.firstElementChild.tagName : null;
						}
					});
				`);
				let paneID = evalInScope("_sectionID");
				assert.isString(paneID);
				let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
				let onRender = option.onRender;

				// Build DOM: container > body (body is the rootNode)
				let container = pluginWin.document.createElement('div');
				let body = pluginWin.document.createElement('div');
				container.appendChild(body);
				pluginWin.document.documentElement.appendChild(container);

				let item = new Zotero.Item('book');

				try {
					// Invoke the wrapped onRender with mock section args
					onRender({
						paneID,
						doc: pluginWin.document,
						body,
						item,
						tabType: 'library',
						editable: false,
						setL10nArgs: () => {},
						setEnabled: () => {},
						setSectionSummary: () => {},
						setSectionButtonStatus: () => {},
					});

					assert.isTrue(evalInScope("_sectionResults.hasBody"),
						"body should be accessible");
					assert.equal(evalInScope("_sectionResults.bodyTag"), "div");
					assert.isNull(evalInScope("_sectionResults.parentNode"),
						"parentNode should be null (outside rootNode subtree)");
					assert.equal(evalInScope("_sectionResults.ownerGlobal"), "accessible",
						"ownerGlobal should be accessible");
					assert.isTrue(evalInScope("_sectionResults.hasDocument"),
						"ownerDocument should be a safe document");
					assert.equal(evalInScope("_sectionResults.childCount"), 1,
						"children within subtree should be accessible");
					assert.equal(evalInScope("_sectionResults.childTag"), "span",
						"child element tag should be correct");
				}
				finally {
					container.remove();
					evalInScope("Zotero.ItemPaneManager.unregisterSection(_sectionID)");
				}
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

			it("should restrict context.menuElem to its own subtree via rootNode", function () {
				// Register a menu with onCommand that probes menuElem restrictions
				evalInScope(`
					var _restrictResults = {};
					var _restrictMenuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-restrict-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function(event, context) {
								var elem = context.menuElem;
								_restrictResults.hasElem = !!elem;
								_restrictResults.tagName = elem.tagName;
								// parentNode is outside rootNode subtree -- should be null
								_restrictResults.parentNode = elem.parentNode;
								// ownerGlobal is blocked
								try {
									elem.ownerGlobal;
									_restrictResults.ownerGlobal = 'accessible';
								} catch(e) {
									_restrictResults.ownerGlobal = 'blocked';
								}
								// ownerDocument returns a safe document
								_restrictResults.hasDocument = typeof elem.ownerDocument === 'object';
								// child within subtree should be accessible
								_restrictResults.childCount = elem.childElementCount;
								var firstChild = elem.firstElementChild;
								_restrictResults.childTag = firstChild
									? firstChild.tagName : null;
							}
						}]
					});
				`);
				let menuID = evalInScope("_restrictMenuID");
				let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				let onCommand = option.menus[0].onCommand;

				// Build a DOM tree: parent > menuElem > child
				let parent = pluginWin.document.createElement('div');
				let menuElem = pluginWin.document.createElement('menuitem');
				let child = pluginWin.document.createElement('label');
				menuElem.appendChild(child);
				parent.appendChild(menuElem);
				pluginWin.document.documentElement.appendChild(parent);

				try {
					// Invoke the wrapped callback with a mock context
					onCommand(null, { menuElem });

					assert.isTrue(evalInScope("_restrictResults.hasElem"),
						"menuElem should be accessible");
					assert.equal(evalInScope("_restrictResults.tagName"), "menuitem");
					assert.isNull(evalInScope("_restrictResults.parentNode"),
						"parentNode should be null (outside rootNode subtree)");
					assert.equal(evalInScope("_restrictResults.ownerGlobal"), "accessible",
						"ownerGlobal should be accessible");
					assert.isTrue(evalInScope("_restrictResults.hasDocument"),
						"ownerDocument should be a safe document");
					assert.equal(evalInScope("_restrictResults.childCount"), 1,
						"children within subtree should be accessible");
					assert.equal(evalInScope("_restrictResults.childTag"), "label",
						"child element tag should be correct");
				}
				finally {
					parent.remove();
					evalInScope("Zotero.MenuManager.unregisterMenu(_restrictMenuID)");
				}
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
							onCommand: function (event, context) { _probe(context.items[0], _menuResults); }
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

		describe("Reader", function () {
			it("should register and unregister an event listener", function () {
				evalInScope(`
					var _readerHandler = function(event) {};
					Zotero.Reader.registerEventListener('renderToolbar', _readerHandler, '${ADDON_ID}');
				`);

				// Verify listener was added
				let listeners = Zotero.Reader._registeredListeners.filter(
					l => l.pluginID === ADDON_ID && l.type === 'renderToolbar'
				);
				assert.equal(listeners.length, 1, "Should have one registered listener");

				// Unregister from sandbox
				evalInScope("Zotero.Reader.unregisterEventListener('renderToolbar', _readerHandler)");

				listeners = Zotero.Reader._registeredListeners.filter(
					l => l.pluginID === ADDON_ID && l.type === 'renderToolbar'
				);
				assert.equal(listeners.length, 0, "Listener should be removed after unregister");
			});

			it("should not expose unlisted Reader methods", function () {
				assert.isTrue(evalInScope("typeof Zotero.Reader.open === 'undefined'"),
					"open should not be exposed");
				assert.isTrue(evalInScope("typeof Zotero.Reader._registeredListeners === 'undefined'"),
					"_registeredListeners should not be exposed");
				assert.isTrue(evalInScope("typeof Zotero.Reader._dispatchEvent === 'undefined'"),
					"_dispatchEvent should not be exposed");
			});
		});
	});

	describe("Zotero Main Window", function () {
		var win;

		before(async function () {
			win = await loadZoteroPane();
		});

		after(function () {
			win.close();
		});

		beforeEach(function () {
			loadTestScope(["default", "mainWindow", "dataRead"]);
			// Store the window in a sandbox variable -- returning wrapper objects
			// across compartments via evalInScope doesn't work, so all assertions
			// must evaluate entirely inside the sandbox and return primitives.
			evalInScope("var _win = Zotero.getMainWindow()");
		});

		describe("getMainWindow / getMainWindows", function () {
			it("should expose getMainWindow/getMainWindows returning a wrapped window with a safe document", function () {
				assert.equal(evalInScope("typeof Zotero.getMainWindow"), "function");
				assert.equal(evalInScope("typeof Zotero.getMainWindows"), "function");
				assert.isTrue(evalInScope("_win !== null && _win !== undefined"),
					"getMainWindow() should return a window");
				assert.equal(evalInScope("typeof _win.alert"), "function");
				assert.equal(evalInScope("typeof _win.Zotero_Tabs"), "object");
				assert.equal(evalInScope("typeof _win.document"), "object");
				assert.equal(evalInScope("typeof _win.document.createElement"), "function");
				assert.equal(evalInScope("typeof _win.document.createXULElement"), "function");
				assert.equal(evalInScope("typeof _win.document.createElementNS"), "function");
			});
		});

		describe("Window APIs (WINDOW_SCHEMAS)", function () {
			it("should expose allowed WINDOW_SCHEMAS APIs", function () {
				assert.isTrue(evalInScope("typeof _win.alert === 'function'"));
				assert.isTrue(evalInScope("typeof _win.confirm === 'function'"));
				assert.isTrue(evalInScope("typeof _win.prompt === 'function'"));
				assert.isTrue(evalInScope("typeof _win.getComputedStyle === 'function'"));
				assert.isTrue(evalInScope("typeof _win.matchMedia === 'function'"));
			});

			it("should expose MozXULElement.insertFTLIfNeeded", function () {
				// MozXULElement is a class with static methods; the schema exposes
				// sub-properties, so it is wrapped as a namespace object.
				assert.isTrue(evalInScope("typeof _win.MozXULElement === 'object'"));
				assert.isTrue(evalInScope("typeof _win.MozXULElement.insertFTLIfNeeded === 'function'"));
			});

			it("should expose document.l10n.addResourceIds and removeResourceIds", function () {
				assert.isTrue(evalInScope("typeof _win.document.l10n.addResourceIds === 'function'"));
				assert.isTrue(evalInScope("typeof _win.document.l10n.removeResourceIds === 'function'"));
			});

			it("matchMedia should return a usable MediaQueryList", function () {
				let expected = win.matchMedia('(prefers-color-scheme: dark)').matches;
				let matches = evalInScope("_win.matchMedia('(prefers-color-scheme: dark)').matches");
				assert.isBoolean(matches);
				assert.equal(matches, expected);
				let media = evalInScope("_win.matchMedia('(prefers-color-scheme: dark)').media");
				assert.equal(media, '(prefers-color-scheme: dark)');
			});

			it("should receive events via addEventListener on safe window", function () {
				evalInScope(`
					var _winEvtType = null;
					function _winHandler(e) { _winEvtType = e.type; }
					_win.addEventListener("test-sandbox-evt", _winHandler);
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-evt"));
				assert.equal(evalInScope("_winEvtType"), "test-sandbox-evt",
					"handler should have received the dispatched event");
			});

			it("should pass a usable Event to addEventListener callback on safe window", function () {
				evalInScope(`
					var _winEvt = {};
					_win.addEventListener("test-sandbox-evt2", function (e) {
						_winEvt.type = e.type;
						_winEvt.bubbles = e.bubbles;
						_winEvt.cancelable = e.cancelable;
						_winEvt.defaultPrevented = e.defaultPrevented;
						_winEvt.hasPreventDefault = typeof e.preventDefault === "function";
						_winEvt.hasStopPropagation = typeof e.stopPropagation === "function";
						_winEvt.detail = e.detail;
						e.preventDefault();
						_winEvt.defaultPreventedAfter = e.defaultPrevented;
					});
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-evt2", {
					bubbles: true, cancelable: true, detail: 42,
				}));
				assert.equal(evalInScope("_winEvt.type"), "test-sandbox-evt2", "type");
				assert.isTrue(evalInScope("_winEvt.bubbles"), "bubbles");
				assert.isTrue(evalInScope("_winEvt.cancelable"), "cancelable");
				assert.isFalse(evalInScope("_winEvt.defaultPrevented"), "defaultPrevented before");
				assert.isTrue(evalInScope("_winEvt.hasPreventDefault"), "preventDefault is function");
				assert.isTrue(evalInScope("_winEvt.hasStopPropagation"), "stopPropagation is function");
				assert.equal(evalInScope("_winEvt.detail"), 42, "detail from CustomEvent");
				assert.isTrue(evalInScope("_winEvt.defaultPreventedAfter"), "defaultPrevented after preventDefault()");
			});

			it("should remove listener via removeEventListener on safe window", function () {
				evalInScope(`
					var _winEvtCount = 0;
					function _winCountHandler(e) { _winEvtCount++; }
					_win.addEventListener("test-sandbox-rm", _winCountHandler);
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-rm"));
				assert.equal(evalInScope("_winEvtCount"), 1, "handler should fire once");

				evalInScope("_win.removeEventListener('test-sandbox-rm', _winCountHandler)");
				win.dispatchEvent(new CustomEvent("test-sandbox-rm"));
				assert.equal(evalInScope("_winEvtCount"), 1,
					"handler should not fire after removal");
			});

			it("should not expose dangerous window globals", function () {
				assert.isTrue(evalInScope("typeof _win.eval === 'undefined'"),
					"eval should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Function === 'undefined'"),
					"Function should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Components === 'undefined'"),
					"Components should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ChromeUtils === 'undefined'"),
					"ChromeUtils should not be exposed");
			});

			it("should not expose privileged window properties", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero === 'undefined'"),
					"Zotero should not be exposed via window");
			});
		});

		describe("Zotero_Tabs API", function () {
			it("should expose tab state accessors and navigation methods", function () {
				assert.equal(evalInScope("_win.Zotero_Tabs.selectedID"), 'zotero-pane');
				assert.equal(evalInScope("_win.Zotero_Tabs.selectedType"), 'library');
				assert.equal(evalInScope("_win.Zotero_Tabs.selectedIndex"), 0);
				assert.isAtLeast(evalInScope("_win.Zotero_Tabs.numTabs"), 1);
				assert.equal(evalInScope("_win.Zotero_Tabs.getTabInfo('zotero-pane').type"), 'library');
				assert.equal(evalInScope("_win.Zotero_Tabs.parseTabType('library').tabContentType"), 'library');
				for (let m of ["selectPrev", "selectNext", "selectLast", "close", "rename"]) {
					assert.equal(evalInScope(`typeof _win.Zotero_Tabs.${m}`), "function", m);
				}
			});

			it("should return correct result from hasContextPane()", function () {
				assert.isFalse(evalInScope("_win.Zotero_Tabs.hasContextPane('library')"),
					"library tab should not have context pane");
				assert.isTrue(evalInScope("_win.Zotero_Tabs.hasContextPane('reader')"),
					"reader tab should have context pane");
			});

			it("should select a tab without throwing", function () {
				evalInScope("_win.Zotero_Tabs.select('zotero-pane')");
				assert.equal(evalInScope("_win.Zotero_Tabs.selectedID"), 'zotero-pane');
			});

			it("should not expose unlisted Zotero_Tabs members", function () {
				let hidden = [
					// DOM accessors
					"deck",
					"tabsMenuPanel",
					"getTabContent",
					// lifecycle and session
					"init",
					"destroy",
					"notify",
					"getState",
					"restoreState",
					// internal state and hooks
					"_tabs",
					"tabHooks",
					"focusOptions",
					"_update",
					// focus management
					"refocus",
					"focusFirst",
					"moveFocus",
					// tab loading internals
					"add",
					"unload",
					"markAsLoaded",
					"closeAll",
				];
				for (let m of hidden) {
					assert.equal(evalInScope(`typeof _win.Zotero_Tabs.${m}`), "undefined", `${m} should not be exposed`);
				}
			});
		});

		describe("ZoteroPane API", function () {
			it("should return the selected library ID matching host", function () {
				let expected = win.ZoteroPane.getSelectedLibraryID();
				let actual = evalInScope("_win.ZoteroPane.getSelectedLibraryID()");
				assert.isNumber(actual);
				assert.equal(actual, expected);
			});

			it("should return selected items as IDs and wrapped facades", async function () {
				let item = new Zotero.Item('book');
				item.setField('title', 'ZoteroPane Selection Test');
				await item.saveTx();

				await win.ZoteroPane.selectItem(item.id);

				// As IDs
				evalInScope("var _selIDs = _win.ZoteroPane.getSelectedItems(true)");
				assert.equal(evalInScope("_selIDs.length"), 1);
				assert.equal(evalInScope("_selIDs[0]"), item.id);

				// As wrapped facades
				evalInScope(`
					var _selItems = _win.ZoteroPane.getSelectedItems();
					var _selFirstID = _selItems[0].id;
					var _selFirstTitle = _selItems[0].getField('title');
				`);
				assert.equal(evalInScope("_selFirstID"), item.id);
				assert.equal(evalInScope("_selFirstTitle"), 'ZoteroPane Selection Test');

				await item.eraseTx();
			});

			it("should return sort field and direction matching host", function () {
				let field = evalInScope("_win.ZoteroPane.getSortField()");
				let direction = evalInScope("_win.ZoteroPane.getSortDirection()");
				assert.equal(field, win.ZoteroPane.getSortField());
				assert.equal(direction, win.ZoteroPane.getSortDirection());
			});

			it("should return sorted items as IDs", function () {
				let expected = win.ZoteroPane.getSortedItems(true);
				evalInScope("var _sortedIDs = _win.ZoteroPane.getSortedItems(true)");
				assert.equal(evalInScope("_sortedIDs.length"), expected.length);
			});

			it("should return permission checks matching host", function () {
				assert.equal(
					evalInScope("_win.ZoteroPane.canEdit()"),
					win.ZoteroPane.canEdit()
				);
				assert.equal(
					evalInScope("_win.ZoteroPane.canEditLibrary()"),
					win.ZoteroPane.canEditLibrary()
				);
				assert.equal(
					evalInScope("_win.ZoteroPane.canEditFiles()"),
					win.ZoteroPane.canEditFiles()
				);
			});

			it("should select item(s) by ID via selectItem and selectItems", async function () {
				let item1 = new Zotero.Item('book');
				await item1.saveTx();
				let item2 = new Zotero.Item('book');
				await item2.saveTx();

				// Single
				assert.isTrue(await evalInScope(`_win.ZoteroPane.selectItem(${item1.id})`));
				assert.include(win.ZoteroPane.getSelectedItems(true), item1.id);

				// Multiple
				assert.isTrue(await evalInScope(`_win.ZoteroPane.selectItems([${item1.id}, ${item2.id}])`));
				let selectedIDs = win.ZoteroPane.getSelectedItems(true);
				assert.include(selectedIDs, item1.id);
				assert.include(selectedIDs, item2.id);

				await item1.eraseTx();
				await item2.eraseTx();
			});

			it("should not expose data-accessing methods without dataRead", function () {
				PluginSandbox.unloadScope(ADDON_ID);
				loadTestScope(["default", "mainWindow"]);
				evalInScope("var _winNoData = Zotero.getMainWindow()");

				// UI-only methods should still work
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.loaded !== 'undefined'"),
					"loaded should be exposed without dataRead");
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.toggleItemPane === 'function'"),
					"toggleItemPane should be exposed without dataRead");

				// Data-accessing methods should not be available
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.getSelectedItems === 'undefined'"),
					"getSelectedItems should not be exposed without dataRead");
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.getSelectedCollection === 'undefined'"),
					"getSelectedCollection should not be exposed without dataRead");
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.selectItem === 'undefined'"),
					"selectItem should not be exposed without dataRead");
				assert.isTrue(evalInScope("typeof _winNoData.ZoteroPane.canEdit === 'undefined'"),
					"canEdit should not be exposed without dataRead");
			});

			it("should not expose creation methods without dataWrite", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.newItem === 'undefined'"),
					"newItem should not be exposed without dataWrite");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.newCollection === 'undefined'"),
					"newCollection should not be exposed without dataWrite");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.newNote === 'undefined'"),
					"newNote should not be exposed without dataWrite");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.newChildNote === 'undefined'"),
					"newChildNote should not be exposed without dataWrite");
			});

			it("should not expose internal, destructive, or DOM members", function () {
				let hidden = [
					// internal properties
					"itemsView",
					"collectionsView",
					"document",
					"init",
					"destroy",
					// destructive operations
					"deleteSelectedItems",
					"deleteSelectedCollection",
					"emptyTrash",
					// event handlers and DOM methods
					"handleKeyDown",
					"handleKeyPress",
					"buildItemContextMenu",
				];
				for (let m of hidden) {
					assert.equal(evalInScope(`typeof _win.ZoteroPane.${m}`), "undefined", `${m} should not be exposed`);
				}
			});
		});

		describe("ZoteroPane creation methods (requires dataWrite)", function () {
			beforeEach(function () {
				// Override parent beforeEach with mainWindow + dataWrite permissions
				PluginSandbox.unloadScope(ADDON_ID);
				loadTestScope(["default", "mainWindow", "dataRead", "dataWrite"]);
				evalInScope("var _win2 = Zotero.getMainWindow()");
			});

			it("should expose creation methods with dataWrite", function () {
				assert.isTrue(evalInScope("typeof _win2.ZoteroPane.newItem === 'function'"),
					"newItem should be exposed with dataWrite");
				assert.isTrue(evalInScope("typeof _win2.ZoteroPane.newCollection === 'function'"),
					"newCollection should be exposed with dataWrite");
				assert.isTrue(evalInScope("typeof _win2.ZoteroPane.newNote === 'function'"),
					"newNote should be exposed with dataWrite");
				assert.isTrue(evalInScope("typeof _win2.ZoteroPane.newChildNote === 'function'"),
					"newChildNote should be exposed with dataWrite");
			});

			it("should create a new collection and return its ID", async function () {
				let dialogPromise = waitForDialog(
					null,
					'accept',
					'chrome://zotero/content/newCollectionDialog.xhtml'
				);
				let collID = await evalInScope("_win2.ZoteroPane.newCollection()");
				await dialogPromise;
				assert.isNumber(collID);

				let collection = Zotero.Collections.get(collID);
				assert.ok(collection);

				await collection.eraseTx();
			});

			it("should create a new note and return its item ID", async function () {
				let noteID = await evalInScope("_win2.ZoteroPane.newNote(false, null, 'Test note')");
				assert.isNumber(noteID);

				let note = Zotero.Items.get(noteID);
				assert.ok(note);
				assert.equal(note.itemType, 'note');

				await note.eraseTx();
			});
		});

		describe("Document safety", function () {
			it("should block creating unsafe elements", function () {
				for (let tag of ["script", "iframe", "browser"]) {
					assert.throws(() => evalInScope(`_win.document.createElement('${tag}')`),
						undefined, undefined, `creating <${tag}> should throw`);
				}
			});

			it("should allow creating safe elements", function () {
				assert.isTrue(evalInScope("!!_win.document.createElement('div')"),
					"createElement('div') should return an element");
			});
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

		it("should still expose default APIs (logging, platform info, window access, utilities) regardless of permissions", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.debug === 'function'"),
				"debug should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.warn === 'function'"),
				"warn should always be exposed");
			assert.isString(evalInScope("Zotero.version"),
				"version should always be exposed");
			assert.isBoolean(evalInScope("Zotero.isMac"),
				"isMac should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.getMainWindow === 'function'"),
				"getMainWindow should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.getMainWindows === 'function'"),
				"getMainWindows should always be exposed");
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

	describe("openWindow API", function () {
		it("should not be available without 'openWindow' permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof openWindow === 'undefined'"));
		});

		it("should reject disallowed URLs (external, file://, and non-.html files)", function () {
			loadTestScope(["default", "openWindow"]);
			let badURLs = [
				"https://example.com/page.html",
				"file:///etc/page.html",
				"settings.xhtml",
				"dialog.xul",
				"script.js",
			];
			for (let url of badURLs) {
				assert.throws(() => evalInScope(`openWindow(${JSON.stringify(url)})`),
					undefined, undefined, `openWindow(${url}) should throw`);
			}
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

			it("should open an .html window and resolve with a window object", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('test.html')");
				try {
					assert.ok(win, "openWindow should resolve with a window");
					assert.equal(win.document.title, "Test");
				}
				finally {
					win.close();
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
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('remote-script.html')");
				try {
					for (let i = 0; i < 100 && win.wrappedJSObject._remoteRan === undefined; i++) {
						await Zotero.Promise.delay(20);
					}
					assert.notOk(win.wrappedJSObject._remoteRan,
						"a cross-origin script must be blocked by the extension-page CSP");
				}
				finally {
					win.close();
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
					permissions: ["default", "openWindow"],
					contentSecurityPolicy: csp,
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				});
				PluginSandbox.loadScope(addon);
				let s = PluginSandbox.getScope(id);
				let win = await Cu.evalInSandbox("openWindow('remote-fetch.html')", s);
				try {
					for (let i = 0; i < 100 && win.wrappedJSObject._fetchStatus === "pending"; i++) {
						await Zotero.Promise.delay(20);
					}
					return win.wrappedJSObject._fetchStatus;
				}
				finally {
					win.close();
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
					permissions: ["default", "openWindow"],
					contentSecurityPolicy: csp,
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				});
				PluginSandbox.loadScope(addon);
				let s = PluginSandbox.getScope(id);
				let win = await Cu.evalInSandbox("openWindow('csp-inline.html')", s);
				try {
					let w = win.wrappedJSObject;
					return { evalStatus: w._evalStatus, wasmStatus: w._wasmStatus };
				}
				finally {
					win.close();
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
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('csp-inline.html')");
				try {
					let w = win.wrappedJSObject;
					assert.isTrue(w._probeRan, "same-origin external script runs (CSP-exempt)");
					assert.notOk(w._inlineRan, "inline script should be blocked by the extension-page CSP");
					assert.equal(w._evalStatus, "blocked", "eval() should be blocked by the extension-page CSP");
				}
				finally {
					win.close();
				}
			});

			it("does not let a plugin loosen its CSP via a <meta> tag (eval stays blocked)", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('csp-meta.html')");
				try {
					let w = win.wrappedJSObject;
					assert.isTrue(w._probeRan, "external script should still run");
					assert.equal(w._evalStatus, "blocked",
						"a meta CSP adding 'unsafe-eval' must not override the stricter policy CSP");
				}
				finally {
					win.close();
				}
			});


			it("should call onLoad callback with the content window", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let cbkLoadPromise = new Promise((resolve) => {
					scope._resolveOnLoad = resolve;
				});
				let win = await evalInScope(`
					openWindow('test.html', '', {
						onLoad: function(w) {
							_resolveOnLoad(w);
						}
					});
				`);
				try {
					let cbkWin = await cbkLoadPromise;
					assert.ok(cbkWin, "onLoad callback should receive a window");
					assert.equal(cbkWin.document.title, "Test");
					assert.equal(cbkWin, win, "onLoad window should be the same as the resolved window");
				}
				finally {
					win.close();
				}
			});

			it("should load relative CSS and JS resources", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('resources.html')");
				try {
					assert.equal(win.document.title, "Resources");
					// JS resource should have executed (check DOM attribute, not expando -- Xrays hide expandos)
					let div = win.document.getElementById("test-div");
					assert.equal(div.getAttribute("data-script-loaded"), "true", "script.js should have executed");
					// CSS resource should have been applied
					let color = win.getComputedStyle(div).color;
					assert.equal(color, "rgb(255, 0, 0)", "style.css should set color to red");
				}
				finally {
					win.close();
				}
			});

			it("should reveal content expandos via wrappedJSObject", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('resources.html')");
				try {
					// Xray wrappers hide expandos set by content scripts
					assert.isUndefined(win._pluginScriptLoaded, "Xray should hide expando properties");
					// wrappedJSObject waives Xrays and reveals content-set expandos
					assert.isTrue(win.wrappedJSObject._pluginScriptLoaded, "wrappedJSObject should reveal expando properties");
				}
				finally {
					win.close();
				}
			});

			it("should allow plugin scope to manipulate the DOM of the opened window", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('test.html')");
				try {
					// Store the window on the scope so sandbox code can reference it
					scope._testWin = win;

					// Modify existing element from plugin scope
					evalInScope("_testWin.document.getElementById('test-div').textContent = 'Modified'");
					assert.equal(
						win.document.getElementById("test-div").textContent,
						"Modified",
						"Plugin scope should be able to modify element text"
					);

					// Create and append a new element from plugin scope
					evalInScope(
						`let el = _testWin.document.createElement('p');
						el.id = 'new-el';
						el.textContent = 'Added by plugin';
						_testWin.document.body.appendChild(el);`
					);
					let newEl = win.document.getElementById("new-el");
					assert.ok(newEl, "Plugin scope should be able to append new elements");
					assert.equal(newEl.textContent, "Added by plugin");
				}
				finally {
					win.close();
				}
			});
			it("should open separate windows for each call", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win1 = await evalInScope("openWindow('test.html')");
				let win2 = await evalInScope("openWindow('test.html')");
				try {
					assert.notEqual(win1, win2, "Each openWindow call should return a different window");
					// Mutating one should not affect the other
					win1.document.getElementById("test-div").textContent = "Window 1";
					win2.document.getElementById("test-div").textContent = "Window 2";
					assert.equal(win1.document.getElementById("test-div").textContent, "Window 1");
					assert.equal(win2.document.getElementById("test-div").textContent, "Window 2");
				}
				finally {
					win1.close();
					win2.close();
				}
			});

			it("should not expose privileged APIs in the content window", async function () {
				loadTestScopeWithURI(["default", "openWindow"]);
				let win = await evalInScope("openWindow('privileged.html')");
				try {
					let results = win.document.getElementById("results");
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
					win.close();
				}
			});

			describe("createFrame", function () {
				function setupSafeScope() {
					scope._safeDoc = WindowScopeVariables.createSafeDocument(
						mainWin.document, ADDON_ID, {}
					);
					// Wrap container as a safe element so sandbox can call appendChild
					scope._container = WindowScopeVariables.createSafeHTMLElement(
						mainWin.document.documentElement, ADDON_ID, {}
					);
				}

				afterEach(function () {
					// Clean up any appended browser elements
					let browsers = mainWin.document.querySelectorAll('browser[type="content"][disableglobalhistory="true"]');
					for (let b of browsers) {
						b.remove();
					}
				});

				it("should load plugin content and call onLoad with contentWindow", async function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();

					let contentWin = await evalInScope(`
						new Promise((resolve) => {
							let frame = _safeDoc.createFrame("test.html", {
								onLoad: function(win) {
									resolve(win);
								},
							});
							_container.appendChild(frame);
						});
					`);
					assert.ok(contentWin, "createFrame should call onLoad with content window");
					assert.equal(contentWin.document.title, "Test");
					assert.equal(
						contentWin.document.getElementById("test-div").textContent,
						"Hello"
					);
				});

				it("should reject URLs outside plugin root", function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();
					assert.throws(
						() => evalInScope('_safeDoc.createFrame("https://evil.com/page.html", { onLoad: function() {} })'),
						undefined, undefined, "Should reject URLs outside plugin root");
				});

				it("should reject non-.html files", function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();
					assert.throws(
						() => evalInScope('_safeDoc.createFrame("script.js", { onLoad: function() {} })'),
						undefined, undefined, "Should reject non-.html files");
				});

				it("should not expose privileged APIs in frame content", async function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();

					let contentWin = await evalInScope(`
						new Promise((resolve) => {
							let frame = _safeDoc.createFrame("privileged.html", {
								onLoad: function(win) {
									resolve(win);
								},
							});
							_container.appendChild(frame);
						});
					`);
					let results = contentWin.document.getElementById("results");
					let privilegedAPIs = ["chromeutils", "services", "ioutils", "pathutils", "cu", "cc", "ci", "zotero"];
					for (let api of privilegedAPIs) {
						assert.equal(
							results.getAttribute("data-" + api),
							"undefined",
							`${api} should not be accessible in frame content`
						);
					}
				});
			});

			describe("createFrame with ItemPaneManager", function () {
				var registeredID;

				afterEach(async function () {
					if (registeredID) {
						Zotero.ItemPaneManager.unregisterSection(registeredID);
						registeredID = null;
					}
				});

				it("should embed a frame in a custom item pane section via createFrame", async function () {
					loadTestScopeWithURI(["default", "itemPane"]);

					// Set up a promise on the scope that the onLoad callback will resolve
					let frameLoadPromise = new Promise((resolve) => {
						scope._resolveFrameLoad = resolve;
					});

					// Register a custom section from the plugin scope.
					// The onRender hook uses doc.createFrame() to embed plugin HTML.
					// The onLoad callback resolves a promise with the contentWindow.
					registeredID = evalInScope(`
						Zotero.ItemPaneManager.registerSection({
							paneID: "test-createframe-section",
							pluginID: "${ADDON_ID}",
							header: {
								l10nID: "zotero-item-pane-header-title",
								icon: "chrome://zotero/skin/16/universal/note.svg",
							},
							sidenav: {
								l10nID: "zotero-item-pane-header-title",
								icon: "chrome://zotero/skin/20/universal/note.svg",
							},
							onRender: function({ doc, body }) {
								if (body.querySelector && body.querySelector('browser')) return;
								let frame = doc.createFrame("test.html", {
									onLoad: function(win) {
										_resolveFrameLoad(win);
									},
								});
								body.appendChild(frame);
							},
						});
					`);

					assert.ok(registeredID, "Section should be registered");

					// Create an item to trigger the item pane render
					let item = await createDataObject('item');

					// Wait for the frame's onLoad callback to fire
					let contentWin = await frameLoadPromise;
					assert.ok(contentWin, "onLoad should receive a contentWindow");
					assert.equal(contentWin.document.title, "Test");
					assert.equal(
						contentWin.document.getElementById("test-div").textContent,
						"Hello"
					);

					await Zotero.Items.erase(item.id);
				});
			});
		});
	});

	describe("XHTML sanitization", function () {
		it("should remove unsafe elements from a fragment", function () {
			loadTestScope(["default"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:div id="safe">Safe</html:div>'
				+ '<html:script>alert("xss")</html:script>'
				+ '<browser src="chrome://zotero/content/zoteroPane.xhtml"/>'
				+ '<html:iframe src="about:config"></html:iframe>'
				+ '<html:p>Text</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			assert.isNull(frag.querySelector("script"), "<script> should be removed");
			assert.isNull(frag.querySelector("browser"), "<browser> should be removed");
			assert.isNull(frag.querySelector("iframe"), "<iframe> should be removed");
			assert.ok(frag.querySelector('[id="safe"]'), "<div> should remain");
			assert.ok(frag.querySelector("p"), "<p> should remain");
		});

		it("should strip on* attributes for unprivileged plugins", function () {
			loadTestScope(["default"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:p onclick="alert(1)" onmouseover="alert(2)">Click</html:p>'
				+ '<html:div onload="alert(3)">Div</html:div>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			let p = frag.querySelector("p");
			assert.ok(p, "<p> should remain");
			assert.isFalse(p.hasAttribute("onclick"), "onclick should be stripped");
			assert.isFalse(p.hasAttribute("onmouseover"), "onmouseover should be stripped");
			let div = frag.querySelector("div");
			assert.isFalse(div.hasAttribute("onload"), "onload should be stripped");
		});

		it("should preserve safe attributes", function () {
			loadTestScope(["default"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:div id="test" class="my-class" data-value="42">Content</html:div>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			let div = frag.querySelector("div");
			assert.equal(div.getAttribute("id"), "test");
			assert.equal(div.getAttribute("class"), "my-class");
			assert.equal(div.getAttribute("data-value"), "42");
		});

		it("should skip sanitization for privileged plugins", function () {
			loadTestScope(["*"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:script>alert("xss")</html:script>'
				+ '<html:p onclick="alert(1)">Click</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			assert.ok(frag.querySelector("script"), "<script> should remain for privileged plugins");
			let p = frag.querySelector("p");
			assert.isTrue(p.hasAttribute("onclick"), "onclick should remain for privileged plugins");
		});

		it("should sanitize for unprivileged plugins when pluginID is provided", function () {
			loadTestScope(["default"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:script>alert("xss")</html:script>'
				+ '<html:p onclick="alert(1)">Click</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			assert.isNull(frag.querySelector("script"), "<script> should be removed for unprivileged plugins");
			let p = frag.querySelector("p");
			assert.isFalse(p.hasAttribute("onclick"), "onclick should be removed for unprivileged plugins");
			assert.isTrue(p.hasAttribute("data-sandbox-on-click"), "handler should be stored as data attr");
		});

		it("should rewire on* handlers to execute in sandbox scope", function () {
			loadTestScope(["default"]);
			Cu.evalInSandbox("var handlerCalled = false;", scope);

			let frag = MozXULElement.parseXULToFragment(
				'<html:button onclick="handlerCalled = true;">Click</html:button>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);

			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			container.appendChild(document.importNode(frag, true));
			WindowScopeVariables.activateInlineHandlers(container, ADDON_ID);

			try {
				let button = container.querySelector("button");
				assert.isFalse(button.hasAttribute("onclick"), "onclick attr should be removed");
				assert.isFalse(button.hasAttribute("data-sandbox-on-click"), "data attr should be removed after activation");
				button.click();
				assert.isTrue(Cu.evalInSandbox("handlerCalled", scope), "handler should have set variable in sandbox");
			}
			finally {
				container.remove();
			}
		});

		it("should provide wrapped this and event to rewired handlers", function () {
			loadTestScope(["default"]);
			Cu.evalInSandbox("var capturedTagName = null; var capturedEventType = null;", scope);

			let frag = MozXULElement.parseXULToFragment(
				'<html:button onclick="capturedTagName = this.tagName; capturedEventType = event.type;">Click</html:button>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);

			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			container.appendChild(document.importNode(frag, true));
			WindowScopeVariables.activateInlineHandlers(container, ADDON_ID);

			try {
				container.querySelector("button").click();
				let tagName = Cu.evalInSandbox("capturedTagName", scope);
				assert.ok(tagName, "this.tagName should be accessible");
				assert.isTrue(
					tagName.toUpperCase().includes("BUTTON"),
					"this.tagName should contain BUTTON"
				);
				assert.equal(
					Cu.evalInSandbox("capturedEventType", scope),
					"click",
					"event.type should be accessible"
				);
			}
			finally {
				container.remove();
			}
		});

		it("should block setting on* properties on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				let warnStub = sinon.stub(Zotero, "warn");
				evalInScope("_btn.onclick = function() {}");
				assert.isTrue(warnStub.calledOnce, "should warn about on* property");
				assert.include(warnStub.firstCall.args[0], "addEventListener");
				assert.isNull(button.onclick, "onclick should not be set on real element");
				warnStub.restore();
			}
			finally {
				container.remove();
			}
		});

		it("should block setAttribute for on* attributes on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				let warnStub = sinon.stub(Zotero, "warn");
				evalInScope('_btn.setAttribute("onclick", "alert(1)")');
				assert.isTrue(warnStub.calledOnce, "should warn about on* attribute");
				assert.include(warnStub.firstCall.args[0], "addEventListener");
				assert.isFalse(button.hasAttribute("onclick"), "onclick attribute should not be set");
				warnStub.restore();

				// Verify non-on* attributes still work
				evalInScope('_btn.setAttribute("class", "test-class")');
				assert.equal(button.getAttribute("class"), "test-class");
			}
			finally {
				container.remove();
			}
		});

		it("should receive events via addEventListener on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemEvtType = null;
					var _elemEvtTarget = null;
					_btn.addEventListener("click", function (e) {
						_elemEvtType = e.type;
						_elemEvtTarget = e.target;
					});
				`);
				button.click();
				assert.equal(evalInScope("_elemEvtType"), "click",
					"handler should receive the click event");
				assert.isTrue(evalInScope("_elemEvtTarget !== null"),
					"event target should be wrapped, not null");
			}
			finally {
				container.remove();
			}
		});

		it("should pass a usable Event to addEventListener callback on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemEvt = {};
					_btn.addEventListener("click", function (e) {
						_elemEvt.type = e.type;
						_elemEvt.bubbles = e.bubbles;
						_elemEvt.cancelable = e.cancelable;
						_elemEvt.hasPreventDefault = typeof e.preventDefault === "function";
						_elemEvt.hasStopPropagation = typeof e.stopPropagation === "function";
						_elemEvt.targetTagName = e.target ? e.target.tagName : null;
						_elemEvt.currentTargetTagName = e.currentTarget ? e.currentTarget.tagName : null;
					});
				`);
				button.click();
				assert.equal(evalInScope("_elemEvt.type"), "click", "type");
				assert.isTrue(evalInScope("_elemEvt.bubbles"), "bubbles");
				assert.isTrue(evalInScope("_elemEvt.hasPreventDefault"), "preventDefault is function");
				assert.isTrue(evalInScope("_elemEvt.hasStopPropagation"), "stopPropagation is function");
				assert.equal(
					evalInScope("_elemEvt.targetTagName").toUpperCase(), "BUTTON",
					"target should be the button"
				);
				assert.equal(
					evalInScope("_elemEvt.currentTargetTagName").toUpperCase(), "BUTTON",
					"currentTarget should be the button"
				);
			}
			finally {
				container.remove();
			}
		});

		it("should remove listener via removeEventListener on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemClickCount = 0;
					function _elemClickHandler(e) { _elemClickCount++; }
					_btn.addEventListener("click", _elemClickHandler);
				`);
				button.click();
				assert.equal(evalInScope("_elemClickCount"), 1,
					"handler should fire once");

				evalInScope("_btn.removeEventListener('click', _elemClickHandler)");
				button.click();
				assert.equal(evalInScope("_elemClickCount"), 1,
					"handler should not fire after removal");
			}
			finally {
				container.remove();
			}
		});

		describe("innerHTML sanitization via wrapped element", function () {
			it("should parse and set plain HTML content", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = "<b>bold</b> and <em>italic</em>"');
					assert.equal(target.querySelector("b").textContent, "bold");
					assert.equal(target.querySelector("em").textContent, "italic");
				}
				finally {
					container.remove();
				}
			});

			it("should preserve xul: and html: namespaces in innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					// XML parse path preserves namespace metadata -- nodes are inserted
					// directly into the DOM rather than re-serialized through the HTML parser.
					evalInScope(
						'_target.innerHTML = \''
						+ '<xul:label value="xul-label"/>'
						+ '<html:span class="ns-test">ns-content</html:span>\''
					);
					let xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
					let htmlNS = "http://www.w3.org/1999/xhtml";
					let label = target.querySelector("label");
					assert.ok(label, "xul:label element should exist");
					assert.equal(label.namespaceURI, xulNS, "label should be in XUL namespace");
					assert.equal(label.getAttribute("value"), "xul-label", "value attribute should be preserved");
					let span = target.querySelector("span");
					assert.ok(span, "html:span element should exist");
					assert.equal(span.namespaceURI, htmlNS, "span should be in HTML namespace");
					assert.equal(span.textContent, "ns-content", "text content should be preserved");
				}
				finally {
					container.remove();
				}
			});

			it("should strip on* event handlers from innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = \'<span onclick="evil()">click</span>\'');
					let span = target.querySelector("span");
					assert.ok(span, "span should be created");
					assert.isFalse(span.hasAttribute("onclick"), "onclick should be stripped");
				}
				finally {
					container.remove();
				}
			});

			it("should strip unsafe tags from innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = \'<script>evil()</script><b>safe</b>\'');
					assert.isNull(target.querySelector("script"), "script should be stripped");
					assert.ok(target.querySelector("b"), "safe content should remain");
				}
				finally {
					container.remove();
				}
			});

			it("should block javascript:/data:text/html URLs on setAttribute and property set", function () {
				loadTestScope(["default"]);
				let container = document.createElement("div");
				document.documentElement.appendChild(container);
				let anchor = document.createElement("a");
				container.appendChild(anchor);
				scope._a = WindowScopeVariables.createSafeHTMLElement(
					anchor, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				try {
					// setAttribute with a dangerous scheme is a no-op (blocked by validator)
					evalInScope('_a.setAttribute("href", "javascript:alert(1)")');
					assert.isNull(anchor.getAttribute("href"), "javascript: via setAttribute must be blocked");
					// obfuscation with an embedded control char is still caught
					evalInScope('_a.setAttribute("href", "java\\tscript:alert(1)")');
					assert.isNull(anchor.getAttribute("href"), "obfuscated javascript: must be blocked");
					// data:text/html is active markup -> blocked
					evalInScope('_a.setAttribute("href", "data:text/html,<b>x</b>")');
					assert.isNull(anchor.getAttribute("href"), "data:text/html must be blocked");
					// property set with javascript: throws
					assert.throws(() => evalInScope('_a.href = "javascript:alert(1)"'),
						undefined, undefined, "javascript: via property set must throw");
					assert.isNull(anchor.getAttribute("href"));

					// Safe schemes are allowed (setAttribute and property set)
					evalInScope('_a.setAttribute("href", "https://example.com/x")');
					assert.equal(anchor.getAttribute("href"), "https://example.com/x");
					evalInScope('_a.href = "https://example.com/y"');
					assert.equal(anchor.getAttribute("href"), "https://example.com/y");
					// Inline data: images are inert as images -> allowed
					evalInScope('_a.setAttribute("src", "data:image/png;base64,iVBORw0KGgo=")');
					assert.ok((anchor.getAttribute("src") || "").startsWith("data:image/png"),
						"data:image/* must be allowed");
				}
				finally {
					container.remove();
				}
			});
		});
	});

	describe("chrome-window resource origin allowlist", function () {
		// Build a container > <tag> pair, expose the rootNode-scoped child as
		// `sandboxName`, and return the real nodes for assertions/cleanup.
		function setupSafeEl(tagName, sandboxName) {
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let el = document.createElement(tagName);
			container.appendChild(el);
			scope[sandboxName] = WindowScopeVariables.createSafeHTMLElement(
				el, ADDON_ID, { rootNode: new WeakRef(container) }
			);
			return { container, el };
		}

		it("isDisallowedResourceURL enforces the declared-resource allowlist", function () {
			loadTestScope(["default"], ["https://declared.example.com/*"]);
			let base = "chrome://zotero/content/zoteroPane.xhtml";
			let check = url => WindowScopeVariables.isDisallowedResourceURL(url, ADDON_ID, base);
			assert.isFalse(check("chrome://zotero/skin/x.png"), "chrome: allowed");
			assert.isFalse(check("resource://gre/x.png"), "resource: allowed");
			assert.isFalse(check("data:image/png;base64,iVBORw0KGgo="), "data:image allowed");
			assert.isFalse(check("https://declared.example.com/pic.png"), "declared host_permissions origin allowed");
			assert.isFalse(check("foo/bar.png"), "relative URL resolves to chrome and is allowed");
			assert.isFalse(check(""), "empty value triggers no load");
			assert.isTrue(check("https://evil.example.com/x.png"), "undeclared remote origin blocked");
			assert.isTrue(check("https://other.example.com/x.png"), "other undeclared origin blocked");
			assert.isTrue(check("javascript:alert(1)"), "javascript: blocked");
			assert.isTrue(check("data:text/html,<b>x</b>"), "data:text/html blocked");
		});

		it("blocks <img src> to an undeclared remote origin, allows local/declared", function () {
			loadTestScope(["default"]);
			let { container, el } = setupSafeEl("img", "_img");
			let own = WebExtensionPolicy.getByID(ADDON_ID).getURL("icon.png");
			try {
				// setAttribute with a remote origin is a no-op (blocked by validator).
				evalInScope('_img.setAttribute("src", "https://evil.example.com/beacon.png")');
				assert.isNull(el.getAttribute("src"), "remote src via setAttribute must be blocked");
				// Property set with a remote origin throws.
				assert.throws(() => evalInScope('_img.src = "https://evil.example.com/beacon.png"'),
					undefined, undefined, "remote src via property set must throw");
				assert.isNull(el.getAttribute("src"), "no remote src should be set");

				// Declared resources are allowed.
				evalInScope('_img.setAttribute("src", "chrome://zotero/skin/zotero-new-z-16px.png")');
				assert.ok((el.getAttribute("src") || "").startsWith("chrome://"), "chrome: src must be allowed");
				evalInScope(`_img.src = ${JSON.stringify(own)}`);
				assert.equal(el.getAttribute("src"), own, "plugin's own moz-extension resource must be allowed");
				evalInScope('_img.setAttribute("src", "data:image/png;base64,iVBORw0KGgo=")');
				assert.ok((el.getAttribute("src") || "").startsWith("data:image/png"), "data:image must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("blocks a remote <img srcset> candidate, allows an all-local one", function () {
			loadTestScope(["default"]);
			let { container, el } = setupSafeEl("img", "_img");
			try {
				evalInScope('_img.setAttribute("srcset", "https://evil.example.com/x.png 2x, chrome://zotero/skin/a.png 1x")');
				assert.isNull(el.getAttribute("srcset"), "a srcset with any remote candidate must be blocked");
				evalInScope('_img.setAttribute("srcset", "chrome://zotero/skin/a.png 1x, chrome://zotero/skin/b.png 2x")');
				assert.ok(el.getAttribute("srcset"), "an all-chrome srcset must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("blocks remote url() in an inline style attribute, including CSS-escape obfuscation", function () {
			loadTestScope(["default"]);
			let { container, el } = setupSafeEl("div", "_div");
			try {
				evalInScope('_div.setAttribute("style", "background: url(https://evil.example.com/x.png)")');
				assert.isNull(el.getAttribute("style"), "remote url() in style attr must be blocked");
				// "\\70" is the CSS escape for "p" -- htt\70s:// decodes to https://.
				scope._obf = "background: url(htt\\70s://evil.example.com/x.png)";
				evalInScope('_div.setAttribute("style", _obf)');
				assert.isNull(el.getAttribute("style"), "CSS-escape-obfuscated remote url() must be blocked");
				evalInScope('_div.setAttribute("style", "background: url(chrome://zotero/skin/x.png)")');
				assert.ok((el.getAttribute("style") || "").includes("chrome://"), "chrome: url() must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("blocks el.style writes that pull in a remote url(), allows ordinary writes", function () {
			loadTestScope(["default"]);
			let { container, el } = setupSafeEl("div", "_div");
			try {
				evalInScope('_div.style.backgroundImage = "url(https://evil.example.com/x.png)"');
				assert.equal(el.style.backgroundImage, "", "remote url() via style object must be dropped");
				evalInScope('_div.style.setProperty("background-image", "url(https://evil.example.com/x.png)")');
				assert.equal(el.style.backgroundImage, "", "remote url() via setProperty must be dropped");
				evalInScope('_div.style.color = "red"');
				assert.equal(el.style.color, "red", "ordinary style writes must still work");
				evalInScope('_div.style.backgroundImage = "url(chrome://zotero/skin/x.png)"');
				assert.include(el.style.backgroundImage, "chrome://", "chrome: url() via style object must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("drops a <style> block that @imports a remote sheet from innerHTML", function () {
			loadTestScope(["default"]);
			let { container, target } = setupSafeDiv();
			try {
				evalInScope('_target.innerHTML = \'<style>@import url(https://evil.example.com/e.css); body{color:red}</style>\'');
				assert.isNull(target.querySelector("style"), "a <style> with a remote @import must be dropped");
				evalInScope('_target.innerHTML = \'<style>.x{color:blue}</style>\'');
				assert.ok(target.querySelector("style"), "a local-only <style> must be kept");
			}
			finally {
				container.remove();
			}
		});

		it("blocks setting a <style> element's textContent to a remote @import", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let styleEl = document.createElement("style");
			container.appendChild(styleEl);
			scope._style = WindowScopeVariables.createSafeHTMLElement(
				styleEl, ADDON_ID, { rootNode: new WeakRef(container) }
			);
			try {
				evalInScope('_style.textContent = "@import url(https://evil.example.com/e.css)"');
				assert.equal(styleEl.textContent, "", "remote @import via <style> textContent must be blocked");
				evalInScope('_style.textContent = ".ok{color:green}"');
				assert.equal(styleEl.textContent, ".ok{color:green}", "local <style> textContent must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("blocks feeding a <style> a remote @import via append/insertAdjacentText", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let styleEl = document.createElement("style");
			container.appendChild(styleEl);
			scope._style = WindowScopeVariables.createSafeHTMLElement(
				styleEl, ADDON_ID, { rootNode: new WeakRef(container) }
			);
			try {
				evalInScope('_style.append("@import url(https://evil.example.com/e.css)")');
				assert.equal(styleEl.textContent, "", "append() of remote CSS into <style> must be blocked");
				evalInScope('_style.insertAdjacentText("beforeend", "@import url(https://evil.example.com/e.css)")');
				assert.equal(styleEl.textContent, "", "insertAdjacentText of remote CSS into <style> must be blocked");
				evalInScope('_style.append(".ok{color:green}")');
				assert.equal(styleEl.textContent, ".ok{color:green}", "local CSS via append() must be allowed");
			}
			finally {
				container.remove();
			}
		});

		it("blocks a remote stylesheet <link>, but keeps navigational <a href>", function () {
			loadTestScope(["default"]);
			let link = setupSafeEl("link", "_link");
			let anchor = setupSafeEl("a", "_a");
			try {
				// <link href> is a silent subresource fetch -> origin-restricted.
				evalInScope('_link.setAttribute("href", "https://evil.example.com/e.css")');
				assert.isNull(link.el.getAttribute("href"), "remote <link href> must be blocked");
				evalInScope('_link.setAttribute("href", "chrome://zotero/skin/x.css")');
				assert.equal(link.el.getAttribute("href"), "chrome://zotero/skin/x.css", "chrome: <link href> must be allowed");
				// <a href> is user-initiated navigation, not a silent load -> allowed.
				evalInScope('_a.setAttribute("href", "https://example.com/page")');
				assert.equal(anchor.el.getAttribute("href"), "https://example.com/page", "external <a href> navigation must stay allowed");
			}
			finally {
				link.container.remove();
				anchor.container.remove();
			}
		});
	});

	describe("element.dataset", function () {
		it("should read and write arbitrary dataset keys", function () {
			loadTestScope(["default"]);
			let { container, target } = setupSafeDiv();
			try {
				evalInScope('_target.dataset.myKey = "hello";');
				assert.equal(target.dataset.myKey, "hello", "value written via sandbox should appear on real element");
				let read = evalInScope("_target.dataset.myKey");
				assert.equal(read, "hello", "value should be readable back from sandbox");
			}
			finally {
				container.remove();
			}
		});

		it("should support keys that did not exist at wrap time", function () {
			loadTestScope(["default"]);
			let { container, target } = setupSafeDiv();
			try {
				// target has no data attributes when wrapper is created
				assert.equal(Object.keys(target.dataset).length, 0, "no keys initially");
				evalInScope('_target.dataset.brand = "new";');
				assert.equal(target.dataset.brand, "new", "new key written via sandbox should exist");
				evalInScope('_target.dataset.second = "also";');
				assert.equal(target.dataset.second, "also", "second new key should also work");
			}
			finally {
				container.remove();
			}
		});

		it("should delete dataset keys", function () {
			loadTestScope(["default"]);
			let { container, target } = setupSafeDiv();
			try {
				target.dataset.toRemove = "yes";
				evalInScope("delete _target.dataset.toRemove");
				assert.isFalse("toRemove" in target.dataset, "key should be deleted from real element");
			}
			finally {
				container.remove();
			}
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
});
