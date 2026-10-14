describe("Zotero.PluginInteropManager", function () {
	var provider = usePluginSandbox({ id: "test-interop-provider@zotero.org" });
	var consumer = usePluginSandbox({ id: "test-interop-consumer@zotero.org" });
	var privileged = usePluginSandbox({ id: "test-interop-privileged@zotero.org" });
	var codes = Zotero.PluginInteropManager.statusCodes;

	beforeEach(function () {
		provider.load(["default", "pluginInterop"]);
		// The consumer declares the provider it calls
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

	// What the consumer's getCommand answers: a status code, or "function" for a callable command
	function lookUp(options) {
		return consumer.run((targetPluginID, options) => {
			let result = Zotero.PluginInteropManager.getCommand({ targetPluginID, ...options });
			return typeof result === "function" ? "function" : result;
		}, provider.id, options);
	}

	it("should register a command and call it with primitive data", function () {
		provideEcho();
		assert.deepEqual(consumer.run((targetPluginID) => {
			let echo = Zotero.PluginInteropManager.getCommand({ targetPluginID, commandName: "echo" });
			return [typeof echo, echo("hello"), echo(42), echo(true)];
		}, provider.id), ["function", "hello", 42, true]);
	});

	it("should pass the caller's plugin ID to the command", function () {
		provider.run(() => Zotero.PluginInteropManager.register({
			commandName: "whoami",
			commandVersion: "1.0.0",
			command: ({ callerPluginID }) => callerPluginID,
		}));
		assert.equal(consumer.run(targetPluginID => Zotero.PluginInteropManager.getCommand({
			targetPluginID,
			commandName: "whoami",
		})(), provider.id), consumer.id);
	});

	it("should take and return plain objects", function () {
		provider.run(() => Zotero.PluginInteropManager.register({
			commandName: "transform",
			commandVersion: "1.0.0",
			command: ({ data }) => ({ result: data.a + data.b, items: [data.a, data.b] }),
		}));
		assert.deepEqual(consumer.run(targetPluginID => Zotero.PluginInteropManager.getCommand({
			targetPluginID,
			commandName: "transform",
		})({ a: 1, b: 2 }), provider.id), { result: 3, items: [1, 2] });
	});

	it("should resolve a command's promise in the caller", async function () {
		provider.run(() => Zotero.PluginInteropManager.register({
			commandName: "asyncAdd",
			commandVersion: "1.0.0",
			command: ({ data }) => Promise.resolve(data.a + data.b),
		}));
		assert.equal(await consumer.run(targetPluginID => Zotero.PluginInteropManager.getCommand({
			targetPluginID,
			commandName: "asyncAdd",
		})({ a: 10, b: 20 }), provider.id), 30);
	});

	it("should propagate an error the command throws", function () {
		provider.run(() => Zotero.PluginInteropManager.register({
			commandName: "failing",
			commandVersion: "1.0.0",
			command: () => {
				throw new Error("intentional error");
			},
		}));
		assert.throws(() => consumer.run(targetPluginID => Zotero.PluginInteropManager.getCommand({
			targetPluginID,
			commandName: "failing",
		})(), provider.id));
	});

	it("should answer NotFound for a command nobody registered", function () {
		assert.equal(lookUp({ commandName: "nonexistent" }), codes.NOT_FOUND);
	});

	it("should check the command version against minVersion and maxVersion", function () {
		provideEcho("versioned", "1.5.0");
		assert.equal(lookUp({ commandName: "versioned", minVersion: "2.0.0" }), codes.VERSION_TOO_LOW);
		assert.equal(lookUp({ commandName: "versioned", maxVersion: "1.0.0" }), codes.VERSION_TOO_HIGH);
		assert.equal(lookUp({ commandName: "versioned", minVersion: "1.0.0", maxVersion: "2.0.0" }), "function");
	});

	it("should answer OK for checkOnly when the command is available", function () {
		provideEcho("check");
		assert.equal(lookUp({ commandName: "check", checkOnly: true }), codes.OK);
	});

	it("should expose the status codes to the sandbox", function () {
		provideEcho("versioned");
		// A plugin branches on the same codes the privileged side sees
		assert.deepEqual(consumer.run((targetPluginID) => {
			let codes = Zotero.PluginInteropManager.statusCodes;
			let lookUp = options => Zotero.PluginInteropManager.getCommand({ targetPluginID, ...options });
			return {
				ok: codes.OK,
				missing: lookUp({ commandName: "nope" }) === codes.NOT_FOUND,
				tooLow: lookUp({ commandName: "versioned", minVersion: "2.0.0" }) === codes.VERSION_TOO_LOW,
				callable: typeof lookUp({ commandName: "versioned" }),
			};
		}, provider.id), { ok: codes.OK, missing: true, tooLow: true, callable: "function" });
	});

	it("should unregister a command", function () {
		let key = provideEcho("removable");
		assert.isString(key);
		assert.isTrue(provider.run(key => Zotero.PluginInteropManager.unregister(key), key));
		assert.equal(lookUp({ commandName: "removable" }), codes.NOT_FOUND);
	});

	it("should throw when a command is called through a reference kept past its unregistering", function () {
		let key = provideEcho("stale");
		consumer.run((targetPluginID) => {
			globalThis.staleEcho = Zotero.PluginInteropManager.getCommand({ targetPluginID, commandName: "stale" });
		}, provider.id);
		assert.equal(consumer.run(() => staleEcho("alive")), "alive");
		provider.run(key => Zotero.PluginInteropManager.unregister(key), key);
		assert.throws(() => consumer.run(() => staleEcho("alive")));
	});

	describe("from a privileged plugin", function () {
		beforeEach(function () {
			privileged.load(["*"]);
		});

		// A privileged plugin gets the raw API, with no injected caller ID, so it names itself
		function callAsPrivileged(commandName, data) {
			return privileged.run((targetPluginID, commandName, data) => Zotero.PluginInteropManager.getCommand({
				callerPluginID: PLUGIN_ID,
				targetPluginID,
				commandName,
			})(data), provider.id, commandName, data);
		}

		it("should call an unprivileged plugin's command", function () {
			provider.run(() => Zotero.PluginInteropManager.register({
				commandName: "privTest",
				commandVersion: "1.0.0",
				command: ({ callerPluginID, data }) => ({ caller: callerPluginID, value: data }),
			}));
			assert.deepEqual(callAsPrivileged("privTest", "hello"), { caller: privileged.id, value: "hello" });
		});

		it("should resolve an async command", async function () {
			provider.run(() => Zotero.PluginInteropManager.register({
				commandName: "privAsync",
				commandVersion: "1.0.0",
				command: ({ data }) => Promise.resolve(data * 2),
			}));
			assert.equal(await callAsPrivileged("privAsync", 21), 42);
		});

		it("should propagate the command's error", function () {
			provider.run(() => Zotero.PluginInteropManager.register({
				commandName: "privFail",
				commandVersion: "1.0.0",
				command: () => {
					throw new Error("priv error");
				},
			}));
			assert.throws(() => callAsPrivileged("privFail"), /priv error/);
		});
	});

	describe("permissions", function () {
		it("should answer PermissionDenied when the caller lacks interop_permissions", function () {
			consumer.load(["default", "pluginInterop"], { interopPermissions: [] });
			provideEcho("secret");
			assert.equal(lookUp({ commandName: "secret" }), codes.PERMISSION_DENIED);
		});

		it("should not let a plugin spoof its callerPluginID", function () {
			provider.run(() => Zotero.PluginInteropManager.register({
				commandName: "whoami",
				commandVersion: "1.0.0",
				command: ({ callerPluginID }) => callerPluginID,
			}));
			assert.equal(consumer.run(targetPluginID => Zotero.PluginInteropManager.getCommand({
				callerPluginID: "spoofed-id@evil.com",
				targetPluginID,
				commandName: "whoami",
			})(), provider.id), consumer.id, "the injected caller ID wins");
		});

		// A sandbox's own late calls are refused before they get here; this pins the manager's check behind that gate
		it("should deny a caller ID whose scope is unloaded, whatever it declared", function () {
			provideEcho("secret");
			consumer.unload();
			assert.equal(Zotero.PluginInteropManager._registry.getCommand({
				callerPluginID: consumer.id,
				targetPluginID: provider.id,
				commandName: "secret",
			}), codes.PERMISSION_DENIED);
		});
	});
});
