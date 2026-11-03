describe("Plugin Sandbox", function () {
	var plugin = usePluginSandbox();
	var copySource = usePluginSandbox({ id: "copy-source@zotero.org" });
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

		it("should expose the declared host permissions as HOST_PERMISSIONS", function () {
			// AddonManager keeps a manifest's host_permissions as installPermissions.origins
			plugin.load(["default"], { origins: ["*://example.com/*"] });
			assert.deepEqual(plugin.run(() => Array.from(HOST_PERMISSIONS)), ["*://example.com/*"]);
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

	describe("Facade compatibility", function () {
		var { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
		let factories = {
			"plain object": target => ScopeVariables.toScope(target, plugin.id),
			"allowlist mirror": target => ScopeVariables.createAllowlistMirrorObject(
				target, { label: true, readLabel: true }, plugin.id, { frozen: false, strong: true }),
			"class instance": target => ScopeUtils._ensureInstanceInScope(target, plugin.scope, { mutable: true }),
			"forwarding proxy": target => ScopeUtils.ensureForwardingProxyInScope(target, plugin.scope, { mutable: true }),
		};

		for (let [name, create] of Object.entries(factories)) {
			it(`should preserve ${name} identity and unwrapping across compartments`, function () {
				plugin.load(["default"]);
				let target = { label: "original", readLabel: () => "original" };
				if (name === "class instance") {
					target = new class {
						label = "original";

						readLabel() {
							return this.label;
						}
					};
				}
				let facade = create(target);
				plugin.scope.probe = facade;
				plugin.scope.echoProbe = ScopeUtils.ensureCallableInScope((value) => {
					assert.strictEqual(ScopeVariables.fromScope(value, plugin.id), target);
					return value;
				}, null, plugin.scope);

				assert.equal(plugin.eval("probe.label"), "original");
				assert.equal(plugin.eval("probe.readLabel()"), "original");
				assert.isTrue(plugin.eval("echoProbe(probe) === probe"));
				assert.strictEqual(ScopeVariables.toScope(facade, plugin.id), facade);
				assert.strictEqual(VarCheck.getOriginalOrSelf(facade), target);
				assert.strictEqual(VarCheck.getOriginalOrSelf(Cu.waiveXrays(facade)), target);
				assert.strictEqual(VarCheck.getOriginalOrSelf(Cu.unwaiveXrays(facade)), target);
				assert.isFalse(plugin.eval("isDeadWrapper(probe)"));

				assert.strictEqual(ScopeVariables.fromScope(plugin.eval("probe"), plugin.id), target);

				if (name === "forwarding proxy") {
					let prototype = Object.getPrototypeOf(target);
					assert.isFalse(plugin.eval('Reflect.set(probe, "__proto__", { injected: true })'));
					assert.strictEqual(Object.getPrototypeOf(target), prototype);
					assert.isUndefined(target.injected);
				}
				if (name !== "plain object") {
					plugin.eval("probe.label = 'updated'");
					assert.equal(target.label, "updated");
				}
				if (name === "class instance") {
					assert.strictEqual(create(target), facade, "the cached facade retains its identity");
					assert.equal(plugin.eval("probe.readLabel()"), "updated");
				}
			});
		}

		it("should recover a wrapped callback's original identity", function () {
			plugin.load(["default"]);
			let callback = plugin.eval("value => value + 1");
			let wrapped = ScopeVariables.fromScope(callback, plugin.id);
			assert.equal(wrapped(4), 5);
			assert.strictEqual(VarCheck.getOriginalOrSelf(wrapped), callback);
			assert.strictEqual(ScopeVariables.fromScope(wrapped, plugin.id), callback);
		});
	});

	describe("Incoming plugin data", function () {
		beforeEach(function () {
			plugin.load(["default"]);
		});

		it("should detach records and discard hidden and inherited properties", function () {
			let value = Cu.waiveXrays(plugin.eval(`(() => {
				Object.prototype.inherited = true;
				let value = { nested: { label: "Original" } };
				Object.defineProperty(value, "hidden", { get() { throw new Error("Hidden getter"); } });
				value[Symbol.toStringTag] = "Window";
				return value;
			})()`));
			let copy = ScopeVariables.fromScope(value, plugin.id);
			assert.isNull(Object.getPrototypeOf(copy));
			assert.isNull(Object.getPrototypeOf(copy.nested));
			assert.sameMembers(Object.keys(copy), ["nested"]);
			assert.lengthOf(Object.getOwnPropertySymbols(copy), 0);
			value.nested.label = "Changed";
			assert.equal(copy.nested.label, "Original");
		});

		it("should discard reserved keys without inspecting their values", function () {
			let value = plugin.eval(`Object.defineProperties({ label: "Data" }, {
				["__proto__"]: { enumerable: true, get() { throw new Error("Prototype getter ran"); } },
				constructor: { enumerable: true, get() { throw new Error("Constructor getter ran"); } },
				prototype: { enumerable: true, get() { throw new Error("Prototype value getter ran"); } },
			})`);
			let copy = ScopeUtils.copyPluginData(value);
			assert.isNull(Object.getPrototypeOf(copy));
			assert.deepEqual(copy, { label: "Data" });
		});

		it("should detach proxies without invoking their property getters", function () {
			let value = Cu.waiveXrays(plugin.eval(`new Proxy({ nested: { label: "Original" } }, {
				get() { throw new Error("Proxy getter ran"); },
			})`));
			let copy = ScopeUtils.copyPluginData(value);
			assert.isNull(Object.getPrototypeOf(copy));
			assert.deepEqual(copy, { nested: { label: "Original" } });
			Object.getOwnPropertyDescriptor(value, "nested").value.label = "Changed";
			assert.equal(copy.nested.label, "Original");
		});

		it("should copy array indices without calling iterators or array methods", function () {
			let value = plugin.eval(`Object.assign([1, { label: "Two" }], {
				map() { throw new Error("Map ran"); },
				[Symbol.iterator]() { throw new Error("Iterator ran"); },
			})`);
			assert.deepEqual(ScopeUtils.copyPluginData(value), [1, { label: "Two" }]);
			let getter = plugin.eval(`Object.defineProperty([1], "0", {
				get() { throw new Error("Index getter ran"); },
			})`);
			assert.throws(() => ScopeUtils.copyPluginData(getter), /Accessor/);
		});

		it("should copy bytes without reading shadowed buffer properties", function () {
			let value = Cu.waiveXrays(plugin.eval(`Object.defineProperty(new Uint8Array([1, 2]), "buffer", {
				get() { throw new Error("Buffer getter ran"); },
			})`));
			let copy = ScopeUtils.copyPluginData(value);
			assert.deepEqual(Array.from(copy), [1, 2]);
			value[0] = 3;
			assert.equal(copy[0], 1);
		});

		it("should reject unsupported instances and cyclic data", function () {
			assert.throws(() => ScopeUtils.copyPluginData(plugin.eval("new Date()")), /plain object/);
			assert.throws(() => ScopeUtils.copyPluginData(plugin.eval("new (class Custom { constructor() { this.value = 1; } })()")), /plain object/);
			let cyclic = plugin.eval("(() => { let value = {}; value.self = value; return value; })()");
			assert.throws(() => ScopeUtils.copyPluginData(cyclic), /cyclic/);
		});

		it("should copy known data mirrors without unwrapping API facades", function () {
			let data = ScopeVariables.toScope({ label: "Data" }, plugin.id);
			assert.deepEqual(ScopeUtils.copyPluginData(data), { label: "Data" });
			let api = ScopeVariables.createAllowlistMirrorObject(
				{ visible: "Visible", secret: "Secret" }, { visible: true }, plugin.id, { strong: true });
			assert.throws(() => ScopeUtils.copyPluginData(api), /Accessor/);
		});

		it("should gate callback results without invoking getters or custom then methods", async function () {
			let getter = plugin.eval(`() => ({ get value() { throw new Error("Result getter ran"); } })`);
			assert.throws(() => ScopeVariables.fromScope(getter, plugin.id)(), /Accessor/);
			let asyncHook = plugin.eval(`() => Object.assign(Promise.resolve({ label: "Resolved" }), {
				then() { throw new Error("Custom then ran"); },
			})`);
			assert.deepEqual(await ScopeVariables.fromScope(asyncHook, plugin.id)(), { label: "Resolved" });
		});
	});

	describe("Chrome DOM boundary", function () {
		it("should copy arrays without calling source-defined map methods", function () {
			plugin.load(["default"]);
			copySource.load(["default"]);
			let value = Cu.waiveXrays(copySource.eval(`Object.assign([1, 2], {
				map() { throw new Error("Source map must not run"); },
			})`));
			assert.deepEqual(Array.from(ScopeVariables.toScope(value, plugin.id)), [1, 2]);
			assert.deepEqual(Array.from(ScopeUtils.ensurePromiseVarInScope(value, plugin.scope)), [1, 2]);
		});

		it("should parse HTML and XML within the plugin's origin", function () {
			plugin.load(["default"]);
			let result = plugin.run(() => {
				let parser = new DOMParser();
				let html = parser.parseFromString("<title>Parsed</title><p>Text</p>", "text/html");
				let xml = parser.parseFromString('<root><child value="ok"/></root>', "application/xml");
				return {
					title: html.title,
					text: html.querySelector("p").textContent,
					xml: xml.querySelector("child").getAttribute("value"),
					window: html.defaultView,
				};
			});
			assert.equal(result.title, "Parsed");
			assert.equal(result.text, "Text");
			assert.equal(result.xml, "ok");
			assert.isNull(result.window);
			let doc = plugin.eval('new DOMParser().parseFromString("<p>Text</p>", "text/html")');
			assert.equal(doc.nodePrincipal.origin, "moz-extension://" + plugin.uuid);
		});

		it("should discard an own __proto__ property when wrapping callbacks", function () {
			plugin.load(["default"]);
			let value = plugin.eval(`Object.defineProperty({
				hook: node => node === undefined,
			}, "__proto__", {
				value: { injected: true },
				enumerable: true,
			})`);
			let wrapped = ScopeVariables.fromScope(Cu.waiveXrays(value), plugin.id);
			assert.isUndefined(wrapped.injected);
			assert.isFalse(Object.hasOwn(wrapped, "__proto__"));
			assert.isTrue(wrapped.hook(document.documentElement));
		});

		it("should not trust a plugin's original-reference property when wrapping hooks", function () {
			plugin.load(["default"]);
			let hook = plugin.eval(`Object.assign(function (node) { return node === undefined; }, {
				__zoteroOriginalRef__: () => function () { return 'forged'; },
			})`);
			let wrapped = ScopeVariables.fromScope(hook, plugin.id);
			assert.isTrue(wrapped(document.documentElement));
		});

		it("should not evaluate original-reference accessors supplied by plugins", function () {
			plugin.load(["default"]);
			let value = plugin.eval(`({
				get __zoteroOriginalRef__() { throw new Error('forged reference getter'); },
			})`);
			var { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
			assert.isFalse(VarCheck.hasOriginalRef(value));
		});

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
		it("should reject non-string external URLs before checking their scheme", function () {
			plugin.load(["default", "userPrompt"]);
			// Stop before an external application could be opened even if the guard regresses.
			let check = sinon.stub(Zotero.Utilities, "isHTTPURL").throws(new Error("scheme check reached"));
			try {
				assert.throws(() => plugin.eval(`Zotero.launchURL({
					toString() { return 'https://www.zotero.org/'; },
				})`));
				assert.isFalse(check.called);
				assert.throws(() => plugin.eval("Zotero.launchURL('https://www.zotero.org/')"));
				assert.isTrue(check.calledOnce);
			}
			finally {
				check.restore();
			}
		});

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
		it("should revoke a retained preferences API when permissions are removed", function () {
			plugin.load(["default", "preferences"]);
			let oldScope = plugin.scope;
			plugin.eval("var retainedGet = Zotero.Prefs.get");
			plugin.load(["default"]);
			assert.throws(() => plugin.eval("retainedGet('revocationProbe')", oldScope));
			assert.throws(() => plugin.eval("Zotero.Prefs.get('revocationProbe')", oldScope));
		});

		it("should revoke retained constructors and instance methods after reload", function () {
			plugin.load(["default", "userPrompt"]);
			let oldScope = plugin.scope;
			plugin.eval("var retainedConstructor = Zotero.ProgressWindow; var retainedWindow = new retainedConstructor()");
			plugin.load(["default"]);
			assert.throws(() => plugin.eval("new retainedConstructor()", oldScope));
			assert.throws(() => plugin.eval("retainedWindow.changeHeadline('Revoked')", oldScope));
		});

		it("should stop invoking a hook from a replaced sandbox", function () {
			plugin.load(["default"]);
			let hook = ScopeVariables.fromScope(plugin.eval("() => 'old hook ran'"), plugin.id);
			plugin.load(["default"]);
			assert.isUndefined(hook());
		});

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

	describe("Progress window boundary", function () {
		it("should render description markup literally as text", async function () {
			plugin.load(["default", "userPrompt"]);
			let text = '<a href="javascript:void(0)" onmouseover="void(0)" style="color:red">unsafe</a>'
				+ '<a href="https://www.zotero.org/" tooltiptext="safe">safe</a>';
			let opened = waitForWindow("chrome://zotero/content/progressWindow.xhtml");
			plugin.eval("var progress = new Zotero.ProgressWindow()");
			plugin.run((text) => {
				globalThis.progress.addDescription(text);
				globalThis.progress.show();
			}, text);
			let win = await opened;
			try {
				let description = win.document.querySelector('#zotero-progress-text-box description');
				assert.equal(description.textContent, text);
				assert.lengthOf(description.children, 0);
			}
			finally {
				plugin.eval("progress.close()");
			}
		});

		it("should reject invalid descriptions without coercing them", function () {
			plugin.load(["default", "userPrompt"]);
			plugin.eval("var progress = new Zotero.ProgressWindow(); var coerced = false");
			assert.throws(() => plugin.eval(`progress.addDescription({
				toString() { coerced = true; return 'description'; },
			})`));
			assert.isFalse(plugin.eval("coerced"));
			for (let value of [null, 1, true, ['text'], [{ text: 'Link', href: 'https://www.zotero.org/' }]]) {
				assert.throws(() => plugin.run(value => globalThis.progress.addDescription(value), value));
			}
		});
	});
});
