describe("Zotero.PluginInteropController", function () {
	var provider = usePluginSandbox({ id: "test-interop-provider@zotero.org" });
	var consumer = usePluginSandbox({ id: "test-interop-consumer@zotero.org" });
	var privileged = usePluginSandbox({ id: "test-interop-privileged@zotero.org" });
	var codes = Zotero.PluginInteropController.errorCodes;

	beforeEach(function () {
		provider.load(["default", "pluginInterop"]);
		// The consumer declares the provider it calls
		consumer.load(["default", "pluginInterop"], { interopPermissions: [provider.id] });
	});

	afterEach(async function () {
		await Zotero.PluginInteropManager._registry._unregisterByPluginID(provider.id);
	});

	function provide(commandName, command, commandVersion = "1.0.0") {
		return provider.run((commandName, commandVersion, source) => Zotero.PluginInteropManager.register({
			commandName,
			commandVersion,
			// eslint-disable-next-line no-eval
			command: eval(`(${source})`),
		}), commandName, commandVersion, command.toString());
	}

	// A request from the consumer's sandbox, its response as plain data
	function query(name, params, caller = consumer) {
		return caller.run((name, params, targetPluginID) => Zotero.PluginInteropController.query(name, { targetPluginID, ...params }), name, params, provider.id);
	}

	function call(params, caller = consumer) {
		return caller.run((params, targetPluginID) => Zotero.PluginInteropController.command("call", { targetPluginID, ...params }), params, provider.id);
	}

	it("should call a command with primitives, plain objects and the caller's ID", async function () {
		provide("echo", ({ callerPluginID, data }) => ({ data, callerPluginID }));
		for (let data of ["hello", 42, true, { a: 1, list: [1, 2] }]) {
			assert.deepEqual(await requestResult(call({ commandName: "echo", data })), { value: { data, callerPluginID: consumer.id } });
		}
	});

	it("should settle a command's promise", async function () {
		provide("asyncAdd", ({ data }) => Promise.resolve(data.a + data.b));
		assert.deepEqual(await requestResult(call({ commandName: "asyncAdd", data: { a: 10, b: 20 } })), { value: 30 });
	});

	it("should report what the command throws as CommandFailed", async function () {
		provide("failing", () => {
			throw new Error("intentional error");
		});
		let error = await requestError(call({ commandName: "failing" }), codes.COMMAND_FAILED);
		assert.include(error.message, "intentional error");
	});

	it("should list a provider's commands with their versions", async function () {
		provide("one", () => 1, "1.0.0");
		provide("two", () => 2, "2.1.0");
		let { commands } = await requestResult(query("commands", {}));
		assert.sameDeepMembers(commands, [{ commandName: "one", commandVersion: "1.0.0" }, { commandName: "two", commandVersion: "2.1.0" }]);
	});

	it("should answer NotFound for an unknown command or one outside the version bounds", async function () {
		provide("versioned", () => 1, "1.5.0");
		await requestError(call({ commandName: "nonexistent" }), codes.NOT_FOUND);
		let tooLow = await requestError(call({ commandName: "versioned", minVersion: "2.0.0" }), codes.NOT_FOUND);
		assert.deepEqual(tooLow.data, { version: "1.5.0" });
		await requestError(call({ commandName: "versioned", maxVersion: "1.0.0" }), codes.NOT_FOUND);
		assert.deepEqual(await requestResult(call({ commandName: "versioned", minVersion: "1.0.0", maxVersion: "2.0.0" })), { value: 1 });
	});

	it("should answer NotFound once the command is unregistered", async function () {
		let key = provide("removable", () => 1);
		assert.deepEqual(await requestResult(call({ commandName: "removable" })), { value: 1 });
		provider.run(key => Zotero.PluginInteropManager.unregister(key), key);
		await requestError(call({ commandName: "removable" }), codes.NOT_FOUND);
	});

	describe("from a privileged plugin", function () {
		beforeEach(function () {
			privileged.load(["*"]);
		});

		// A privileged plugin gets the raw API, with no injected caller ID, so it names itself
		function callAsPrivileged(params) {
			return privileged.run((params, targetPluginID) => Zotero.PluginInteropController.command("call", { targetPluginID, ...params }, PLUGIN_ID), params, provider.id);
		}

		it("should call an unprivileged plugin's command, naming itself", async function () {
			provide("whoami", ({ callerPluginID, data }) => ({ caller: callerPluginID, value: data }));
			assert.deepEqual(await requestResult(callAsPrivileged({ commandName: "whoami", data: "hello" })), { value: { caller: privileged.id, value: "hello" } });
		});

		it("should settle an async command and report a failing one", async function () {
			provide("double", ({ data }) => Promise.resolve(data * 2));
			provide("fail", () => {
				throw new Error("priv error");
			});
			assert.deepEqual(await requestResult(callAsPrivileged({ commandName: "double", data: 21 })), { value: 42 });
			let error = await requestError(callAsPrivileged({ commandName: "fail" }), codes.COMMAND_FAILED);
			assert.include(error.message, "priv error");
		});
	});

	describe("permissions", function () {
		it("should refuse a provider the caller did not declare, for listing and calling", async function () {
			consumer.load(["default", "pluginInterop"], { interopPermissions: [] });
			provide("secret", () => 1);
			await requestError(query("commands", {}), codes.PERMISSION_DENIED);
			await requestError(call({ commandName: "secret" }), codes.PERMISSION_DENIED);
		});

		it("should not take a caller ID from the params", async function () {
			provide("whoami", ({ callerPluginID }) => callerPluginID);
			await requestError(call({ commandName: "whoami", callerPluginID: "spoofed-id@evil.com" }), codes.INVALID_PARAMS);
		});

		// A sandbox's own late calls are refused before they get here; this pins the check behind that gate
		it("should refuse a caller whose scope is unloaded, whatever it declared", async function () {
			provide("secret", () => 1);
			consumer.unload();
			await requestError(Zotero.PluginInteropController.command("call", {
				targetPluginID: provider.id,
				commandName: "secret",
			}, consumer.id), codes.PERMISSION_DENIED);
		});
	});
});
