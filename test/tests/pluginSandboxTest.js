describe("Plugin Sandbox", function () {
	var plugin = usePluginSandbox();
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
	var { ScopeUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
	var { ScopeVariables } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/variables.mjs");
	var { get: getName, list: listNames, forget: forgetName } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/names.mjs").PluginNames;

	describe("Plugin name persistence", function () {
		const PLUGIN_NAME_PREF = "extensions.zotero.pluginNames." + plugin.uuid;

		afterEach(function () {
			Zotero.Prefs.clear(PLUGIN_NAME_PREF, true);
		});

		it("records the plugin name on load, keyed by UUID", function () {
			plugin.load(["default"]);
			assert.equal(getName(plugin.uuid), "Test Sandbox Plugin");
		});

		it("the recorded name survives unloading the plugin", function () {
			plugin.load(["default"]);
			PluginSandbox.unloadScope(plugin.id);
			// Name still recoverable -- chrome UI can show it for orphan dirs
			assert.equal(getName(plugin.uuid), "Test Sandbox Plugin");
		});

		it("listNames includes the loaded plugin", function () {
			plugin.load(["default"]);
			let names = listNames();
			let entry = names.find(n => n.uuid === plugin.uuid);
			assert.ok(entry, "loaded plugin should appear in the recorded list");
			assert.equal(entry.name, "Test Sandbox Plugin");
		});

		it("returns null for unknown UUIDs", function () {
			assert.isNull(getName("00000000-0000-0000-0000-000000000000"));
		});

		it("forgetName removes the entry", function () {
			plugin.load(["default"]);
			assert.equal(getName(plugin.uuid), "Test Sandbox Plugin");
			forgetName(plugin.uuid);
			assert.isNull(getName(plugin.uuid));
		});
	});

	describe("Scope creation", function () {
		it("should create an unprivileged scope with default permissions", function () {
			plugin.load(["default"]);
			assert.ok(plugin.scope);
			assert.isTrue(plugin.eval("typeof Zotero === 'object'"));
		});

		it("should expose PERMISSIONS in the scope", function () {
			plugin.load(["default"]);
			let perms = plugin.eval("PERMISSIONS");
			assert.include(Array.from(perms), "default");
		});

		it("should expose the expected base globals (timers, console, web APIs)", function () {
			plugin.load(["default"]);
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
				assert.equal(plugin.eval(`typeof ${fn}`), "function", `${fn} should be a function`);
			}
			assert.equal(plugin.eval("typeof console"), "object");
		});

		it("allows eval/Function/fetch/WebAssembly in the sandbox itself (no CSP applies)", function () {
			// Plugin code runs in a Cu.Sandbox (not CSP-gated, unlike its HTML
			// pages), so eval/Function/WebAssembly work and fetch/XHR are exposed.
			plugin.load(["default"]);
			assert.equal(plugin.eval("eval('1 + 1')"), 2, "eval works in the sandbox");
			assert.equal(plugin.eval("(new Function('return 2 + 3'))()"), 5, "new Function works in the sandbox");
			assert.equal(plugin.eval("typeof fetch"), "function");
			assert.equal(plugin.eval("typeof XMLHttpRequest"), "function");
			assert.equal(
				plugin.eval("(function(){ new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0])); return 'ok'; })()"),
				"ok", "WebAssembly compiles in the sandbox");
		});

		it("should remember an unloaded plugin's privilege", function () {
			plugin.load(["default"]);
			PluginSandbox.unloadScope(plugin.id);
			assert.isFalse(PluginSandbox.isPrivileged(plugin.id));
			assert.isTrue(PluginSandbox.isPrivileged("never-loaded@zotero.org"),
				"an ID that never loaded a scope is first-party");
		});

		it("should always recreate the scope on reload, never reusing", function () {
			PluginSandbox.loadScope(createMockPlugin({ id: plugin.id, permissions: ["default"] }));
			let scope1 = PluginSandbox.getScope(plugin.id);
			assert.ok(scope1);
			assert.equal(scope1.VERSION, "1.0.0");

			PluginSandbox.loadScope(createMockPlugin({ id: plugin.id, permissions: ["default"] }));
			let scope2 = PluginSandbox.getScope(plugin.id);
			assert.notStrictEqual(scope2, scope1,
				"an unchanged reload should still recreate the scope");
		});

		it("should facade function-valued properties on plain objects crossing into the scope", function () {
			plugin.load(["default"]);
			let chromeMarker = { secret: "chrome-only" };
			let chromeObject = {
				data: 42,
				nested: { label: "x" },
				cb: () => chromeMarker,
			};
			plugin.scope.__h5test = ScopeUtils._ensureVarInScope(chromeObject, plugin.scope);

			// The per-property build leaves the data readable in the scope
			assert.equal(plugin.eval("__h5test.data"), 42);
			assert.equal(plugin.eval("__h5test.nested.label"), "x");

			assert.equal(plugin.eval("typeof __h5test.cb"), "function");
			// The facade exports its wrapper as "f", where a raw cloneFunctions clone would keep "cb"
			assert.equal(plugin.eval("__h5test.cb.name"), "f",
				"function property must be exposed via the controlled callable facade");
			// The return value is faceted too, into an in-scope object
			assert.equal(plugin.eval("__h5test.cb().secret"), "chrome-only");
			assert.isTrue(plugin.eval("__h5test.cb() instanceof Object"),
				"the faceted return should be an in-scope object");
		});
	});

	describe("Zotero Logging APIs", function () {
		beforeEach(function () {
			plugin.load(["default"]);
		});

		it("should expose logging APIs (debug/warn/logError) without throwing", function () {
			assert.equal(plugin.eval("typeof Zotero.debug"), "function");
			assert.equal(plugin.eval("typeof Zotero.warn"), "function");
			assert.equal(plugin.eval("typeof Zotero.logError"), "function");
			plugin.eval("Zotero.debug('test message from sandbox')");
			plugin.eval("Zotero.warn('test warning from sandbox')");
		});
	});

	describe("Zotero General attributes", function () {
		beforeEach(function () {
			plugin.load(["default"]);
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
				assert.deepEqual(plugin.eval(`Zotero.${attr}`), Zotero[attr], `Zotero.${attr}`);
			}
		});

		it("should not allow setting attributes on Zotero", function () {
			assert.throws(() => plugin.eval("Zotero.version = 'hacked'"));
			assert.equal(plugin.eval("Zotero.version"), Zotero.version);
		});
	});

	describe("Zotero Locks", function () {
		beforeEach(function () {
			plugin.load(["default"]);
		});

		it("should expose lock promises (initialization/uiReady/unlock)", async function () {
			for (let lock of ["initializationPromise", "uiReadyPromise", "unlockPromise"]) {
				assert.ok(plugin.eval(`Zotero.${lock}`), lock);
				assert.equal(plugin.eval(`typeof Zotero.${lock}.then`), "function", `${lock}.then`);
			}
			await plugin.eval("Zotero.initializationPromise");
		});
	});

	describe("Zotero.Utilities", function () {
		beforeEach(function () {
			plugin.load(["default"]);
		});

		it("should expose Zotero.Utilities.cleanDOI()", function () {
			assert.equal(plugin.eval("Zotero.Utilities.cleanDOI('https://doi.org/10.1234/test')"), '10.1234/test');
			assert.isNotOk(plugin.eval("Zotero.Utilities.cleanDOI('not a doi')"));
		});

		it("should expose string helpers (sentenceCase/capitalizeName)", function () {
			assert.equal(
				plugin.eval("Zotero.Utilities.sentenceCase('A Title in Title Case')"),
				Zotero.Utilities.sentenceCase('A Title in Title Case'));
			assert.equal(
				plugin.eval("Zotero.Utilities.capitalizeName('john smith')"),
				Zotero.Utilities.capitalizeName('john smith'));
		});
	});

	describe("Zotero.Date", function () {
		beforeEach(function () {
			plugin.load(["default"]);
		});

		it("should expose Zotero.Date.strToISO()", function () {
			assert.equal(plugin.eval("Zotero.Date.strToISO('January 1, 2020')"), '2020-01-01');
			assert.isFalse(plugin.eval("Zotero.Date.strToISO('')"));
		});

		it("should not expose unlisted Date methods", function () {
			assert.isTrue(plugin.eval("typeof Zotero.Date.sqlToDate === 'undefined'"),
				"sqlToDate should not be exposed");
		});
	});

	describe("Chrome DOM boundary", function () {
		it("should block chrome windows and DOM nodes crossing into the sandbox", function () {
			plugin.load(["default"]);
			// The test runner's own window is a chrome window like any other
			plugin.scope._hostWin = ScopeVariables.toScope(window, plugin.id);
			plugin.scope._hostNode = ScopeVariables.toScope(document.documentElement, plugin.id);
			plugin.scope._hostEvent = ScopeVariables.toScope(new CustomEvent("test"), plugin.id);
			assert.isTrue(plugin.eval("typeof _hostWin === 'undefined'"),
				"a chrome window must not cross into the sandbox");
			assert.isTrue(plugin.eval("typeof _hostNode === 'undefined'"),
				"a chrome DOM node must not cross into the sandbox");
			assert.isTrue(plugin.eval("typeof _hostEvent === 'undefined'"),
				"a chrome event must not cross into the sandbox");
		});
	});

	describe("Access control", function () {
		it("should not expose unlisted Zotero properties", function () {
			plugin.load(["default"]);
			// These are internal properties not in the schema
			assert.isTrue(plugin.eval("typeof Zotero.DB === 'undefined'"));
			assert.isTrue(plugin.eval("typeof Zotero.Schema === 'undefined'"));
			assert.isTrue(plugin.eval("typeof Zotero.Sync === 'undefined'"));
		});

		it("should not expose privileged globals", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof ChromeUtils === 'undefined'"));
			assert.isTrue(plugin.eval("typeof Services === 'undefined'"));
			assert.isTrue(plugin.eval("typeof IOUtils === 'undefined'"));
			assert.isTrue(plugin.eval("typeof PathUtils === 'undefined'"));
		});

		it("should not allow setting listed properties on Zotero sub-objects", function () {
			plugin.load(["default", "dataRead", "dataWrite"]);
			// The mirror is frozen, so setting a listed property throws
			assert.throws(() => plugin.eval("Zotero.DataStore.query = function() {}"),
				undefined, undefined, "Setting Zotero.DataStore.query should throw");
			assert.isTrue(plugin.eval("typeof Zotero.DataStore.query === 'function'"));
		});
	});

	describe("Permission isolation", function () {
		it("should not expose data APIs with only default permission", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.DataStore === 'undefined'"),
				"DataStore should not be exposed without dataRead");
			assert.isTrue(plugin.eval("typeof Zotero.Notifier === 'undefined'"),
				"Notifier should not be exposed without dataRead");
		});

		it("should expose File.reveal and launchURL with userPrompt only", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.File === 'object'"),
				"File should be exposed with default permission");
			assert.equal(plugin.eval("typeof Zotero.File.reveal"), "undefined",
				"File.reveal hands the user's attention to another application, so it needs userPrompt");
			assert.equal(plugin.eval("typeof Zotero.launchURL"), "undefined");
			assert.isTrue(plugin.eval("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed without fileSystemRead");
			plugin.load(["default", "userPrompt"]);
			assert.equal(plugin.eval("typeof Zotero.File.reveal"), "function");
			assert.equal(plugin.eval("typeof Zotero.launchURL"), "function");
		});

		it("should expose network APIs with only default permission", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed to every scope, bounded by host_permissions");
		});

		it("should not expose preferences APIs with only default permission", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.Prefs === 'undefined'"),
				"Prefs should not be exposed without preferences permission");
		});

		it("should imply dataRead when dataWrite is granted", function () {
			plugin.load(["default", "dataWrite"]);
			assert.isTrue(plugin.eval("typeof Zotero.DataStore.query === 'function'"),
				"DataStore.query should be exposed via implied dataRead");
			assert.isTrue(plugin.eval("typeof Zotero.DataStore.ChangeSet === 'function'"),
				"DataStore.ChangeSet should be exposed via implied dataRead");
			assert.isTrue(plugin.eval("typeof Zotero.DataStore.commit === 'function'"),
				"DataStore.commit should be exposed with dataWrite");
		});

		it("should not expose UI APIs with only default permission", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
			assert.isTrue(plugin.eval("typeof Zotero.ItemPaneManager === 'undefined'"),
				"ItemPaneManager should not be exposed without itemPane permission");
			assert.isTrue(plugin.eval("typeof Zotero.MenuManager === 'undefined'"),
				"MenuManager should not be exposed without menu permission");
			assert.isTrue(plugin.eval("typeof Zotero.ReaderManager === 'undefined'"),
				"ReaderManager should not be exposed without reader permission");
			assert.isTrue(plugin.eval("typeof Zotero.PreferencePanes === 'undefined'"),
				"PreferencePanes should not be exposed without preferencePane permission");
		});

		it("should expose data APIs but not the file system with dataRead and dataWrite", function () {
			plugin.load(["default", "dataRead", "dataWrite"]);
			assert.isTrue(plugin.eval("typeof Zotero.DataStore === 'object'"),
				"DataStore should be exposed with dataRead");
			assert.isTrue(plugin.eval("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed with only the data permissions");
		});

		it("should expose file system APIs but not data with fileSystemRead and fileSystemWrite", function () {
			plugin.load(["default", "fileSystemRead", "fileSystemWrite"]);
			assert.isTrue(plugin.eval("typeof Zotero.FileStore === 'object'"),
				"FileStore should be exposed with fileSystemRead");
			assert.isTrue(plugin.eval("typeof Zotero.DataStore === 'undefined'"),
				"DataStore should not be exposed with only the file system permissions");
		});

		it("should merge multiple permissions correctly", function () {
			plugin.load(["default", "dataRead", "dataWrite", "preferences"], { prefPermissions: ["test."] });
			assert.isTrue(plugin.eval("typeof Zotero.DataStore === 'object'"),
				"DataStore should be exposed with dataRead");
			assert.isTrue(plugin.eval("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed to every scope");
			assert.isTrue(plugin.eval("typeof Zotero.Prefs === 'object'"),
				"Prefs should be exposed with preferences permission");
			assert.isTrue(plugin.eval("typeof Zotero.FileStore === 'undefined'"),
				"FileStore should not be exposed without fileSystemRead permission");
			assert.isTrue(plugin.eval("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
		});

		it("should still expose default APIs (logging, platform info, utilities) regardless of permissions", function () {
			plugin.load(["default"]);
			assert.isTrue(plugin.eval("typeof Zotero.debug === 'function'"),
				"debug should always be exposed");
			assert.isTrue(plugin.eval("typeof Zotero.warn === 'function'"),
				"warn should always be exposed");
			assert.isString(plugin.eval("Zotero.version"),
				"version should always be exposed");
			assert.isBoolean(plugin.eval("Zotero.isMac"),
				"isMac should always be exposed");
			assert.isTrue(plugin.eval("typeof Zotero.Utilities === 'object'"),
				"Utilities should always be exposed");
			assert.isTrue(plugin.eval("typeof Zotero.Utilities.cleanDOI === 'function'"),
				"Utilities.cleanDOI should always be exposed");
			assert.isTrue(plugin.eval("typeof Zotero.Date === 'object'"),
				"Date should always be exposed");
			assert.isTrue(plugin.eval("typeof Zotero.Date.strToISO === 'function'"),
				"Date.strToISO should always be exposed");
		});
	});

	describe("After unload", function () {
		function isColumnRegistered(dataKey) {
			return Object.keys(Zotero.ItemTreeManager._columnManager._optionsCache).some(key => key.includes(dataKey));
		}

		afterEach(async function () {
			await Zotero.ItemTreeManager._columnManager._unregisterByPluginID(plugin.id);
		});

		it("should refuse an unloaded plugin's late calls", function () {
			plugin.load(["default", "itemTree"]);
			// Once used, the mirror keeps the callable, and the sandbox still runs until it is nuked
			plugin.eval("Zotero.ItemTreeManager.registerColumn");
			PluginSandbox.unloadScope(plugin.id);
			assert.throws(() => plugin.run(() => Zotero.ItemTreeManager.registerColumn({
				dataKey: "sandbox-unloaded-col",
				label: "Late Column",
				dataProvider: () => "",
			})));
			assert.isFalse(isColumnRegistered("sandbox-unloaded-col"));
		});

		it("should refuse late calls from a sandbox replaced by a reload", function () {
			plugin.load(["default", "itemTree"]);
			plugin.eval("Zotero.ItemTreeManager.registerColumn");
			let oldScope = plugin.scope;
			plugin.load(["default", "itemTree"]);
			let register = `Zotero.ItemTreeManager.registerColumn({
				dataKey: "sandbox-reloaded-col",
				label: "Reloaded Column",
				dataProvider: () => "",
			})`;
			assert.throws(() => plugin.eval(register, oldScope), undefined, undefined, "a callable the old sandbox kept");
			assert.throws(() => plugin.eval("Zotero.ItemTreeManager.unregisterColumn", oldScope),
				undefined, undefined, "a callable the old sandbox first reaches after the reload");
			assert.isFalse(isColumnRegistered("sandbox-reloaded-col"));

			plugin.eval(register);
			assert.isTrue(isColumnRegistered("sandbox-reloaded-col"), "the new sandbox still registers");
		});

		it("should ignore a hook whose sandbox was nuked instead of throwing", function () {
			plugin.load(["default"]);
			// A sandbox of its own, so nuking it leaves the test scope alone
			let own = new Cu.Sandbox(Services.scriptSecurityManager.createNullPrincipal({}), { freshCompartment: true });
			let hook = Cu.evalInSandbox("(function hook() { return 'ran'; })", own);
			let wrapped = ScopeVariables.fromScope(hook, plugin.id);
			assert.equal(wrapped(), "ran");
			Cu.nukeSandbox(own);
			assert.isTrue(Cu.isDeadWrapper(hook));
			assert.isUndefined(wrapped());
		});
	});
});
