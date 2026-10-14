describe("Plugin Zotero.Prefs", function () {
	var plugin = usePluginSandbox();
	var { PluginUUID } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/uuid.mjs");
	var { PluginPrefs } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/prefs.mjs");

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
			let id = plugin.eval("typeof _prefObsID !== 'undefined' && _prefObsID");
			if (id) {
				Zotero.Prefs.unregisterObserver(id);
			}
		}
		// eslint-disable-next-line no-unused-vars
		catch (e) {}
	});

	describe("auto-prefixed namespace (global=false)", function () {
		// Full pref path prefix for the mock addon
		var OWN_PREFIX = PluginPrefs.getBranch(plugin.uuid);

		beforeEach(function () {
			plugin.load(["default", "preferences"]);
		});

		it("should auto-prefix get/set with the plugin UUID", function () {
			let shortKey = 'myPref';
			let fullKey = OWN_PREFIX + shortKey;
			testPrefKeys.push(plugin.uuid + '.' + shortKey);
			// Plugin sets without global flag -- auto-prefixed
			plugin.eval(`Zotero.Prefs.set('${shortKey}', 'hello')`);
			// Chrome sees it under the full key (global=true)
			assert.equal(Zotero.Prefs.get(fullKey, true), 'hello');
			// Plugin reads it back
			assert.equal(plugin.eval(`Zotero.Prefs.get('${shortKey}')`), 'hello');
		});

		it("should set and get different types", function () {
			testPrefKeys.push(plugin.uuid + '.str', plugin.uuid + '.int', plugin.uuid + '.bool');
			plugin.eval("Zotero.Prefs.set('str', 'value')");
			assert.equal(plugin.eval("Zotero.Prefs.get('str')"), 'value');

			plugin.eval("Zotero.Prefs.set('int', 42)");
			assert.strictEqual(plugin.eval("Zotero.Prefs.get('int')"), 42);

			plugin.eval("Zotero.Prefs.set('bool', true)");
			assert.strictEqual(plugin.eval("Zotero.Prefs.get('bool')"), true);
		});

		it("should clear an auto-prefixed pref", function () {
			let fullKey = OWN_PREFIX + 'clearMe';
			testPrefKeys.push(plugin.uuid + '.clearMe');
			plugin.eval("Zotero.Prefs.set('clearMe', 'val')");
			assert.equal(Zotero.Prefs.get(fullKey, true), 'val');
			plugin.eval("Zotero.Prefs.clear('clearMe')");
			assert.isUndefined(Zotero.Prefs.get(fullKey, true));
		});

		it("should reflect prefs between sandbox and chrome", function () {
			let fullKey = OWN_PREFIX + 'cross';
			testPrefKeys.push(plugin.uuid + '.cross');
			// Set from sandbox, read from chrome
			plugin.eval("Zotero.Prefs.set('cross', 'fromSandbox')");
			assert.equal(Zotero.Prefs.get(fullKey, true), 'fromSandbox');
			// Set from chrome, read from sandbox
			Zotero.Prefs.set(fullKey, 'fromChrome', true);
			assert.equal(plugin.eval("Zotero.Prefs.get('cross')"), 'fromChrome');
		});

		it("should register observer on auto-prefixed pref", function () {
			let fullKey = OWN_PREFIX + 'obs';
			testPrefKeys.push(plugin.uuid + '.obs');

			plugin.eval(`
					var _prefNewValue = undefined;
					var _prefObsID = Zotero.Prefs.registerObserver(
						'obs',
						function(newValue) { _prefNewValue = newValue; }
					);
				`);

			// Change from chrome side using full key
			Zotero.Prefs.set(fullKey, 'observed', true);
			assert.equal(plugin.eval("_prefNewValue"), 'observed');

			plugin.eval("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});
	});

	describe("explicit access (global=true)", function () {
		beforeEach(function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.test.sandbox."] });
		});

		it("should get/set prefs by full name with global=true", function () {
			let fullKey = 'extensions.zotero.test.sandbox.explicit';
			let shortKey = 'test.sandbox.explicit';
			testPrefKeys.push(shortKey);
			plugin.eval(`Zotero.Prefs.set('${fullKey}', 'hello', true)`);
			assert.equal(Zotero.Prefs.get(shortKey), 'hello');
			assert.equal(plugin.eval(`Zotero.Prefs.get('${fullKey}', true)`), 'hello');
		});

		it("should clear a pref with global=true", function () {
			let fullKey = 'extensions.zotero.test.sandbox.clearExplicit';
			let shortKey = 'test.sandbox.clearExplicit';
			testPrefKeys.push(shortKey);
			plugin.eval(`Zotero.Prefs.set('${fullKey}', 'val', true)`);
			plugin.eval(`Zotero.Prefs.clear('${fullKey}', true)`);
			assert.isUndefined(Zotero.Prefs.get(shortKey));
		});

		it("should register observer with global=true", function () {
			let fullKey = 'extensions.zotero.test.sandbox.obsExplicit';
			let shortKey = 'test.sandbox.obsExplicit';
			testPrefKeys.push(shortKey);

			plugin.eval(`
					var _prefNewValue = undefined;
					var _prefObsID = Zotero.Prefs.registerObserver(
						'${fullKey}',
						function(newValue) { _prefNewValue = newValue; },
						true
					);
				`);

			Zotero.Prefs.set(shortKey, 'observed');
			assert.equal(plugin.eval("_prefNewValue"), 'observed');

			plugin.eval("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should resetBranch within declared prefix", function () {
			let key1 = 'test.sandbox.reset1';
			let key2 = 'test.sandbox.reset2';
			testPrefKeys.push(key1, key2);
			plugin.eval(`Zotero.Prefs.set('extensions.zotero.${key1}', 'val1', true)`);
			plugin.eval(`Zotero.Prefs.set('extensions.zotero.${key2}', 'val2', true)`);

			plugin.eval("Zotero.Prefs.resetBranch([], 'extensions.zotero.test.sandbox.reset')");

			assert.isUndefined(Zotero.Prefs.get(key1));
			assert.isUndefined(Zotero.Prefs.get(key2));
		});
	});

	describe("access control", function () {
		it("should deny global=true for prefs not matching pref_permissions", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.myPlugin."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.get('extensions.zotero.fontSize', true)"),
				undefined, undefined, "get() outside declared prefix should throw");
			assert.throws(() => plugin.eval("Zotero.Prefs.set('extensions.zotero.fontSize', 14, true)"),
				undefined, undefined, "set() outside declared prefix should throw");
		});

		it("should allow global=true for prefs matching pref_permissions", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.fontSize"] });
			plugin.eval("Zotero.Prefs.get('extensions.zotero.fontSize', true)");
		});

		it("should deny resetBranch on entire Zotero branch", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.test."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.resetBranch()"),
				undefined, undefined, "resetBranch() without branch should throw");
		});

		it("should deny resetBranch on branches outside declared prefixes", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.myPlugin."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.resetBranch([], 'extensions.zotero.other.')"),
				undefined, undefined, "resetBranch outside declared prefix should throw");
		});

		it("should deny resetBranch on non-Zotero branches", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.test."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.resetBranch([], 'browser.')"),
				undefined, undefined, "resetBranch on non-Zotero branch should throw");
		});

		it("should deny registerObserver with global=true outside pref_permissions", function () {
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.myPlugin."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.registerObserver('extensions.zotero.fontSize', function() {}, true)"),
				undefined, undefined, "registerObserver outside allowed scope should throw");
		});

		it("should deny reserved namespaces even when declared", function () {
			plugin.load(["default", "preferences"], { prefPermissions: [
				"extensions.zotero.pluginFileAccess.",
				"extensions.zotero.dataDir",
			] });
			assert.throws(
				() => plugin.eval(`Zotero.Prefs.set('extensions.zotero.pluginFileAccess.${plugin.uuid}', '[]', true)`),
				undefined, undefined, "writing the file-access grant store must be denied");
			assert.throws(
				() => plugin.eval("Zotero.Prefs.clear('extensions.zotero.pluginFileAccess.x', true)"),
				undefined, undefined, "clearing a grant-store pref must be denied");
			assert.throws(
				() => plugin.eval("Zotero.Prefs.get('extensions.zotero.dataDir', true)"),
				undefined, undefined, "reading the data dir pref must be denied");
		});

		it("should deny a wildcard prefix covering an exact-match-only namespace (sync)", function () {
			// A wildcard prefix covering sync.* is dropped at setup -> denied
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.sync."] });
			assert.throws(() => plugin.eval("Zotero.Prefs.get('extensions.zotero.sync.server.username', true)"),
				undefined, undefined, "a wildcard prefix must not grant sync.*");
		});

		it("should allow an exact pref name in an exact-match-only namespace (sync)", function () {
			// An exact pref name is allowed
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.sync.autoSync"] });
			plugin.eval("Zotero.Prefs.get('extensions.zotero.sync.autoSync', true)");
		});

		it("should deny resetBranch that would clear an exact-match-only namespace", function () {
			// Declaring the exact parent passes the per-pref check, but resetBranch
			// on it would wipe sync.* as a subtree -> blocked by the reset guard.
			plugin.load(["default", "preferences"], { prefPermissions: ["extensions.zotero.sync"] });
			assert.throws(() => plugin.eval("Zotero.Prefs.resetBranch([], 'extensions.zotero.sync')"),
				undefined, undefined, "resetBranch covering sync.* must be denied");
		});
	});

	describe("default prefs (prefs.js)", function () {
		var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
		var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
		var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

		// Zotero.Plugins runs prefs.js on install, so this takes a real plugin rather than the mock sandbox
		async function installWithPrefs(id, permissions, prefsJS, manifest = {}) {
			let dir = await getTempDirectory();
			await FileIO.writeUTF8(PathUtils.join(dir, "manifest.json"), JSON.stringify({
				manifest_version: 2,
				name: "Default Prefs Test",
				version: "1.0." + Date.now(),
				applications: { zotero: { id, update_url: "https://example.invalid/none.json", strict_max_version: "9999.*" } },
				permissions,
				...manifest,
			}));
			await FileIO.writeUTF8(PathUtils.join(dir, "bootstrap.js"),
				"function install() {}\nfunction startup() {}\nfunction shutdown() {}\nfunction uninstall() {}\n");
			await FileIO.writeUTF8(PathUtils.join(dir, "prefs.js"), prefsJS);
			let addon = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(dir));
			return {
				addon,
				async remove() {
					await addon.uninstall();
					await FileIO.remove(dir, { recursive: true, ignoreAbsent: true });
				},
			};
		}

		// The install resolves before Zotero.Plugins finishes its onInstalled work
		async function waitForDefault(key) {
			for (let i = 0; i < 50 && Zotero.Prefs.get(key, true) === undefined; i++) {
				await Zotero.Promise.delay(100);
			}
		}

		it("should name an unprivileged plugin's defaults relative to its branch and keep chrome out of reach", async function () {
			const ID = "default-prefs-test@zotero.org";
			let installed = await installWithPrefs(ID, ["preferences"], [
				'pref("featureEnabled", false);',
				'pref("retryCount", 1);',
				'pref("greeting", "(default greeting)");',
				// prefs.js is plugin code, so it sees pref() and nothing of chrome
				'pref("reach", typeof Services + "/" + typeof ChromeUtils + "/" + typeof pref);',
				// And none of it runs once the load returns
				'Promise.resolve().then(() => pref("late", "ran"));',
				"",
			].join("\n"));
			try {
				await waitForDefault(PluginPrefs.getBranch(PluginUUID.getByID(ID)) + "greeting");
				// The plugin reads them back as it reads any pref of its own
				let read = Cu.evalInSandbox(`JSON.stringify({
					featureEnabled: Zotero.Prefs.get("featureEnabled"),
					retryCount: Zotero.Prefs.get("retryCount"),
					greeting: Zotero.Prefs.get("greeting"),
					reach: Zotero.Prefs.get("reach"),
					late: Zotero.Prefs.get("late"),
				})`, PluginSandbox.getScope(ID));
				// An unset "late" is dropped by JSON.stringify
				assert.deepEqual(JSON.parse(read), {
					featureEnabled: false,
					retryCount: 1,
					greeting: "(default greeting)",
					reach: "undefined/undefined/function",
				});
			}
			finally {
				await installed.remove();
			}
		});

		it("should take an unprivileged plugin's global default as Zotero.Prefs would, gated by pref_permissions", async function () {
			const ID = "default-prefs-global-test@zotero.org";
			const DECLARED = "extensions.zotero.test.defaultPrefs.declared";
			testPrefKeys.push("test.defaultPrefs.declared");
			let fontSize = Zotero.Prefs.get("fontSize");
			let installed = await installWithPrefs(ID, ["preferences"], [
				`pref("${DECLARED}", "declared", true);`,
				// Undeclared: refused, and the error ends the file
				'pref("extensions.zotero.fontSize", "99", true);',
				"",
			].join("\n"), { pref_permissions: ["extensions.zotero.test.defaultPrefs."] });
			try {
				await waitForDefault(DECLARED);
				assert.equal(Zotero.Prefs.get(DECLARED, true), "declared");
				assert.equal(Zotero.Prefs.get("fontSize"), fontSize);
			}
			finally {
				await installed.remove();
			}
		});

		it("should take a privileged plugin's defaults by their full names, in the same sandbox", async function () {
			const ID = "default-prefs-privileged-test@zotero.org";
			const KEY = "extensions.zotero.test.defaultPrefs.privileged";
			const REACH = "extensions.zotero.test.defaultPrefs.reach";
			testPrefKeys.push("test.defaultPrefs.privileged", "test.defaultPrefs.reach");
			let installed = await installWithPrefs(ID, undefined, `pref("${KEY}", 7);\npref("${REACH}", typeof Services);\n`);
			try {
				await waitForDefault(KEY);
				assert.strictEqual(Zotero.Prefs.get(KEY, true), 7);
				assert.strictEqual(Zotero.Prefs.get(REACH, true), "undefined");
			}
			finally {
				await installed.remove();
			}
		});
	});
});
