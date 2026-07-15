describe("Zotero.Plugins", function () {
	var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

	describe("Loading", function () {
		var addon;

		afterEach(async function () {
			if (addon) {
				await addon.uninstall();
				addon = null;
			}
			Zotero.Prefs.clear('pluginLoadingTest.pref');
		});

		// The fixture's bootstrap.js loads main.js from its own XPI with
		// Services.scriptloader.loadSubScript(rootURI + ...), as plugins commonly do
		it("should load scripts and default prefs from a plugin's XPI", async function () {
			let dir = getTestDataDirectory();
			dir.append('plugin-loading-test');
			let xpiPath = PathUtils.join(await getTempDirectory(), 'plugin-loading-test.xpi');
			await Zotero.File.zipDirectory(dir.path, xpiPath);
			addon = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(xpiPath));

			await waitForCallback(() => Zotero.PluginLoadingTest, 100, 10);
			assert.equal(Zotero.PluginLoadingTest, 'loaded');
			assert.equal(Zotero.Prefs.get('pluginLoadingTest.pref'), 'default');
		});
	});

	describe("Blocking", function () {
		var addon;

		afterEach(async function () {
			if (addon) {
				try {
					await addon.uninstall();
				}
				catch {}
				addon = null;
			}
			delete Zotero._pluginBlockingTestEvents;
			await Zotero.Plugins.setBlockedPlugins(0, []);
		});

		it("should disable an installed plugin added to the blocklist and re-enable it when removed", async function () {
			var events = Zotero._pluginBlockingTestEvents = [];
			addon = await installTestPlugin({
				bootstrap: "function install() {}\n"
					+ "function startup() { Zotero._pluginBlockingTestEvents.push('startup'); }\n"
					+ "function shutdown() { Zotero._pluginBlockingTestEvents.push('shutdown'); }\n"
					+ "function uninstall() {}\n"
			});
			await waitForCallback(() => events.includes('startup'), 10, 3);
			assert.isTrue(addon.isActive);

			await Zotero.Plugins.setBlockedPlugins(9999, [
				{ id: addon.id, versionRanges: [{}], reason: "Test block" }
			]);
			assert.isFalse(addon.isActive);
			// The running plugin gets shut down
			await waitForCallback(() => events.includes('shutdown'), 10, 3);

			await Zotero.Plugins.setBlockedPlugins(10000, []);
			assert.equal(addon.blocklistState, Ci.nsIBlocklistService.STATE_NOT_BLOCKED);
			assert.isTrue(addon.isActive);
			await waitForCallback(() => events.filter(x => x == 'startup').length == 2, 10, 3);
		});

		it("should block an entry without a reason", async function () {
			addon = await installTestPlugin();
			await Zotero.Plugins.setBlockedPlugins(9999, [
				{ id: addon.id, versionRanges: [{}] }
			]);
			assert.isFalse(addon.isActive);
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason(addon.id, addon.version));
		});
	});

	describe("#updateBlocklistFromServer()", function () {
		var server;
		var response;

		beforeEach(function () {
			response = null;
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
			server = sinon.fakeServer.create();
			server.autoRespond = true;
			server.respond(function (req) {
				if (req.method != "GET" || req.url != ZOTERO_CONFIG.PLUGIN_BLOCKLIST_URL) {
					return;
				}
				if (!response) {
					req.respond(500, {}, "");
					return;
				}
				req.respond(
					200,
					{
						"Content-Type": "application/json"
					},
					JSON.stringify(response)
				);
			});
		});

		afterEach(async function () {
			Zotero.HTTP.mock = null;
			Zotero.Plugins._setBuiltInBlockedPlugins(0, []);
			await Zotero.Plugins.setBlockedPlugins(0, []);
		});

		// version must exceed the built-in list's version so the downloaded copy wins
		it("should block versions within a range in the downloaded list", async function () {
			response = {
				version: 9999,
				blockedPlugins: [
					{
						id: "test@example.com",
						versionRanges: [{ minVersion: "1.0", maxVersion: "2.0" }],
						reason: "Breaks things"
					}
				]
			};
			assert.isTrue(await Zotero.Plugins.updateBlocklistFromServer());

			assert.equal(
				Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"),
				"Breaks things"
			);
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "0.9"));
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "2.1"));
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("other@example.com", "1.5"));
		});

		it("should let a newer downloaded list unblock a plugin blocked by the built-in list", async function () {
			Zotero.Plugins._setBuiltInBlockedPlugins(1, [
				{ id: "test@example.com", versionRanges: [{ maxVersion: "2.0" }], reason: "Breaks things" }
			]);
			assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));

			// A newer list that omits it takes over as a whole and unblocks it
			response = { version: 2, blockedPlugins: [] };
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));
		});

		it("shouldn't apply a downloaded list older than the built-in one", async function () {
			Zotero.Plugins._setBuiltInBlockedPlugins(2, []);
			response = {
				version: 1,
				blockedPlugins: [
					{
						id: "test@example.com",
						versionRanges: [{ maxVersion: "2.0" }],
						reason: "Breaks things"
					}
				]
			};
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));
		});

		it("should reject a list with invalid entries or version ranges", async function () {
			response = {
				version: 9999,
				blockedPlugins: [
					{
						id: "test@example.com",
						versionRanges: [{ maxVersion: "2.0" }],
						reason: "Breaks things"
					}
				]
			};
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));

			for (let blockedPlugins of [
				[{ id: "test@example.com", versionRanges: {} }],
				[{ id: "test@example.com", versionRanges: [[]] }],
				[{ id: "test@example.com", versionRanges: [{ maxVersion: 3 }] }],
				[{ versionRanges: [{}] }]
			]) {
				response = { version: 10000, blockedPlugins };
				assert.isFalse(await Zotero.Plugins.updateBlocklistFromServer());
				// The previous list remains in effect
				assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));
				assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "2.5"));
			}
		});

		it("should clear the list when a newer version omits an entry", async function () {
			response = {
				version: 9998,
				blockedPlugins: [
					{
						id: "test@example.com",
						versionRanges: [{ maxVersion: "2.0" }],
						reason: "Breaks things"
					}
				]
			};
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));

			response = { version: 9999, blockedPlugins: [] };
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isFalse(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));
		});

		it("should leave the list unchanged if the request fails", async function () {
			response = {
				version: 9999,
				blockedPlugins: [
					{
						id: "test@example.com",
						versionRanges: [{ maxVersion: "2.0" }],
						reason: "Breaks things"
					}
				]
			};
			await Zotero.Plugins.updateBlocklistFromServer();
			assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));

			response = null;
			assert.isFalse(await Zotero.Plugins.updateBlocklistFromServer());
			assert.isString(Zotero.Plugins.getBlockedPluginReason("test@example.com", "1.5"));
		});
	});
});
