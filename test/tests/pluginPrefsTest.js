describe("Plugin Zotero.Prefs", function () {
	var plugin = usePluginSandbox();

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
		var OWN_PREFIX = 'extensions.' + plugin.uuid + '.';

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
});
