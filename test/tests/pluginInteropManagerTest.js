describe("Zotero.PluginInteropManager", function () {
	var provider = usePluginSandbox({ id: "test-interop-provider@zotero.org" });
	var consumer = usePluginSandbox({ id: "test-interop-consumer@zotero.org" });

	beforeEach(function () {
		provider.load(["default", "pluginInterop"]);
		// The consumer declares the provider it looks at
		consumer.load(["default", "pluginInterop"], { interopPermissions: [provider.id] });
	});

	afterEach(async function () {
		await Zotero.PluginInteropManager._registry._unregisterByPluginID(provider.id);
	});

	// The provider registers a command answering with its data; its own pluginID is injected
	function provideEcho(commandName = "echo", commandVersion = "1.0.0") {
		return provider.run((commandName, commandVersion) => Zotero.PluginInteropManager.register({
			commandName,
			commandVersion,
			command: ({ data }) => data,
		}), commandName, commandVersion);
	}

	// What a declared consumer sees of the provider
	function listed() {
		return requestResult(consumer.run(targetPluginID => Zotero.PluginInteropController.query("commands", { targetPluginID }), provider.id))
			.then(({ commands }) => commands);
	}

	it("should register a command under the provider's own ID", async function () {
		let key = provideEcho("echo", "1.2.0");
		assert.isString(key);
		assert.deepEqual(await listed(), [{ commandName: "echo", commandVersion: "1.2.0" }]);
	});

	it("should default the command version to the plugin's", async function () {
		provider.run(() => Zotero.PluginInteropManager.register({ commandName: "plain", command: () => 1 }));
		assert.deepEqual(await listed(), [{ commandName: "plain", commandVersion: provider.addon.version }]);
	});

	it("should not let a plugin register under another plugin's ID", async function () {
		provider.run(() => Zotero.PluginInteropManager.register({
			pluginID: "spoofed-id@evil.com",
			commandName: "spoof",
			command: () => 1,
		}));
		assert.deepEqual((await listed()).map(c => c.commandName), ["spoof"]);
	});

	it("should unregister a command, by its provider only", async function () {
		let key = provideEcho("removable");
		assert.isFalse(consumer.run(key => Zotero.PluginInteropManager.unregister(key), key));
		assert.lengthOf(await listed(), 1);
		assert.isTrue(provider.run(key => Zotero.PluginInteropManager.unregister(key), key));
		assert.lengthOf(await listed(), 0);
	});
});
