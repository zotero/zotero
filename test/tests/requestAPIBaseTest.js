// The request half every controller and store shares, driven through a test controller
describe("RequestAPIBase", function () {
	var plugin = usePluginSandbox();
	var privileged = usePluginSandbox({ id: "test-request-privileged@zotero.org" });
	var { ControllerAPIBase } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/pluginAPI/controllerAPIBase.mjs");
	var { PluginRequestError } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/apiErrors.mjs");
	var { ScopeVariables } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/variables.mjs");
	var codes = ControllerAPIBase.errorCodes;

	class TestController extends ControllerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "TestController",
				queries: {
					echo: {
						params: { value: { type: "any", optional: true } },
						handler: params => ({ params }),
					},
					gated: {
						permissions: ["dataRead"],
						handler: () => ({ ok: true }),
					},
					leaky: {
						handler: () => ({ big: BigInt(1) }),
					},
					boom: {
						handler: () => {
							throw new TypeError("kaboom");
						},
					},
					gone: {
						handler: () => {
							throw new PluginRequestError(codes.NOT_FOUND, "gone");
						},
					},
					whoami: {
						handler(_params, { kind, name }) {
							return { apiName: this._config.apiName, kind, name };
						},
					},
				},
				commands: {
					noop: {
						handler: () => undefined,
					},
				},
			};
		}
	}

	var api = new TestController();

	// The test API as a plugin reaches a Zotero.*Controller: a mirror whose requests carry its injected plugin ID
	function exposeTo(sandbox) {
		let facade = {
			query: (name, params, callerPluginID) => api.query(name, params, callerPluginID),
			command: (name, params, callerPluginID) => api.command(name, params, callerPluginID),
		};
		let inject = ({ pluginID, args }) => {
			args[2] = pluginID;
		};
		ScopeVariables.setCustomParser(facade.query, inject);
		ScopeVariables.setCustomParser(facade.command, inject);
		sandbox.scope.TestAPI = ScopeVariables.createAllowlistMirrorObject(
			facade, { query: "CustomParserCallable", command: "CustomParserCallable" }, sandbox.id);
	}

	beforeEach(function () {
		plugin.load(["default"]);
		exposeTo(plugin);
	});

	function query(name, params, caller = plugin) {
		return caller.run((name, params) => TestAPI.query(name, params), name, params);
	}

	it("should list the defined requests", function () {
		assert.sameMembers(api.requestNames.queries, ["echo", "gated", "leaky", "boom", "gone", "whoami"]);
		assert.sameMembers(api.requestNames.commands, ["noop"]);
	});

	it("should reject a request without a handler or with a taken name", function () {
		assert.throws(() => {
			api.config = { queries: { broken: {} } };
		}, /has no handler/);
		assert.throws(() => {
			api.config = { commands: { noop: { handler: () => ({}) } } };
		}, /already defined/);
	});

	it("should call the handler with the API as this and the request in its context", async function () {
		assert.deepEqual(await query("whoami"), {
			success: true,
			result: { apiName: "TestController", kind: "query", name: "whoami" },
		});
	});

	it("should resolve a failure as a response, never a rejection", async function () {
		// A PluginRequestError carries its code; any other exception is an internal error
		assert.deepEqual(await query("gone"), { success: false, result: {}, error: { code: codes.NOT_FOUND, message: "gone" } });
		assert.deepEqual(await query("boom"), { success: false, result: {}, error: { code: codes.INTERNAL_ERROR, message: "kaboom" } });
		assert.notProperty(await query("whoami"), "error");
	});

	it("should fail an unknown request", async function () {
		await requestError(query("nope"), codes.UNKNOWN_REQUEST);
		await requestError(plugin.run(() => TestAPI.command("echo")), codes.UNKNOWN_REQUEST);
	});

	it("should fail non-object and unknown params, naming the problem", async function () {
		let error = await requestError(query("echo", 5), codes.INVALID_PARAMS);
		assert.include(error.message, "must be an object");
		error = await requestError(query("echo", { nope: 1 }), codes.INVALID_PARAMS);
		assert.include(error.message, "Unknown param 'nope'");
	});

	it("should treat a prototype name as an unknown param", async function () {
		await requestError(query("echo", { constructor: 1 }), codes.INVALID_PARAMS);
		let error = await requestError(plugin.run(() => TestAPI.query("echo", JSON.parse('{ "__proto__": { "value": 1 } }'))),
			codes.INVALID_PARAMS);
		assert.include(error.message, "Unknown param '__proto__'");
	});

	it("should resolve an undefined result to an empty object", async function () {
		assert.deepEqual(await plugin.run(() => TestAPI.command("noop")), { success: true, result: {} });
	});

	it("should fail a result that is not plain data", async function () {
		await requestError(query("leaky"), codes.INVALID_RESULT);
	});

	it("should gate a request on the calling plugin's permissions", async function () {
		await requestError(query("gated"), codes.PERMISSION_DENIED);
		plugin.load(["default", "dataRead"]);
		exposeTo(plugin);
		assert.deepEqual(await requestResult(query("gated")), { ok: true });
	});

	it("should hand the handler an unprivileged caller's plugin ID and fail a supplied one", async function () {
		assert.deepEqual((await requestResult(query("echo", { value: 1 }))).params, { value: 1, pluginID: plugin.id });
		await requestError(query("echo", { pluginID: "x" }), codes.INVALID_PARAMS);
	});

	// No sandbox reaches this: a loaded plugin's calls name it, and an unloaded one's are refused at the mirror
	it("should deny a caller ID naming a plugin that is not loaded", async function () {
		await requestError(api.query("echo", {}, "never-loaded@zotero.org"), codes.PERMISSION_DENIED);
	});

	describe("from a privileged plugin", function () {
		beforeEach(function () {
			privileged.load(["*"]);
			// A privileged plugin gets the raw API, with no caller ID injected
			privileged.scope.TestAPI = api;
		});

		it("should skip the permission gates", async function () {
			assert.deepEqual(await requestResult(query("gated", {}, privileged)), { ok: true });
		});

		it("should hand the handler no plugin ID and fail a supplied one", async function () {
			assert.deepEqual((await requestResult(query("echo", { value: 1 }, privileged))).params, { value: 1 });
			await requestError(query("echo", { pluginID: "x" }, privileged), codes.INVALID_PARAMS);
		});

		it("should hand the handler a detached plain copy of the params", function () {
			return privileged.run(async () => {
				let params = { value: { list: [1, 2] } };
				let { result: { params: received } } = await TestAPI.query("echo", params);
				return JSON.stringify(received) === JSON.stringify(params) && received.value !== params.value;
			}).then(detached => assert.isTrue(detached));
		});
	});
});
