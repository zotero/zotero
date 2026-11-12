describe("Zotero.ServerEndpointManager", function () {
	var plugin = usePluginSandbox({ id: "test-server-endpoint@zotero.org" });
	var other = usePluginSandbox({ id: "test-server-endpoint-other@zotero.org" });
	var serverPath, pathPrefix;

	before(function () {
		serverPath = "http://127.0.0.1:" + Zotero.Server.port;
		// A plugin's endpoints live under its own UUID
		pathPrefix = "/plugins/" + plugin.uuid;
	});

	beforeEach(function () {
		plugin.load(["default", "serverEndpoint"]);
	});

	afterEach(async function () {
		await Zotero.ServerEndpointManager._manager._unregisterByPluginID(plugin.id);
		await Zotero.ServerEndpointManager._manager._unregisterByPluginID(other.id);
	});

	// A local API client request; a non-browser client marks itself with Zotero-Allowed-Request
	function request(method, path, { headers = {}, body } = {}) {
		return Zotero.HTTP.request(method, serverPath + path, {
			headers: { "Zotero-Allowed-Request": "1", ...headers },
			responseType: "text",
			successCodes: false,
			body,
		});
	}

	// An endpoint answering with no content
	function registerEmpty(path) {
		return plugin.run(path => Zotero.ServerEndpointManager.registerEndpoint({ path, handler: () => 204 }), path);
	}

	it("should serve a GET request with a handler registered from the sandbox", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/hello",
			supportedMethods: ["GET"],
			handler: request => [200, "text/plain", "hello " + request.searchParams.name],
		}));
		assert.equal(key, pathPrefix + "/hello");
		let req = await request("GET", key + "?name=world");
		assert.equal(req.status, 200);
		assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
		assert.equal(req.responseText, "hello world");
	});

	it("should pass parsed JSON data to an async handler on POST", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/echo",
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json"],
			handler: async request => [201, "application/json", JSON.stringify({
				method: request.method,
				foo: request.data.foo,
			})],
		}));
		let req = await request("POST", key, {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ foo: "bar" }),
		});
		assert.equal(req.status, 201);
		assert.deepEqual(JSON.parse(req.responseText), { method: "POST", foo: "bar" });
	});

	it("should support a status-only integer response", async function () {
		let key = registerEmpty("/no-content");
		assert.equal((await request("GET", key)).status, 204);
	});

	it("should pass path template parameters to the handler", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/items/:key",
			handler: request => [200, "text/plain", request.pathParams.key],
		}));
		assert.equal(key, pathPrefix + "/items/:key");
		let req = await request("GET", pathPrefix + "/items/ABCD2345");
		assert.equal(req.status, 200);
		assert.equal(req.responseText, "ABCD2345");
	});

	it("should answer 500 when the handler throws", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/throws",
			handler: () => {
				throw new Error("boom");
			},
		}));
		assert.equal((await request("GET", key)).status, 500);
	});

	it("should answer 500 on an invalid response shape", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/invalid",
			handler: () => ({ body: "not a valid response" }),
		}));
		assert.equal((await request("GET", key)).status, 500);
	});

	it("should reject unsupported methods", async function () {
		let key = plugin.run(() => Zotero.ServerEndpointManager.registerEndpoint({
			path: "/post-only",
			supportedMethods: ["POST"],
			handler: () => 204,
		}));
		assert.equal((await request("GET", key)).status, 400);
	});

	it("should answer 404 once unregistered", async function () {
		let key = registerEmpty("/transient");
		assert.equal((await request("GET", key)).status, 204);
		assert.isTrue(plugin.run(key => Zotero.ServerEndpointManager.unregisterEndpoint(key), key));
		assert.notProperty(Zotero.Server.Endpoints, key);
		assert.equal((await request("GET", key)).status, 404);
	});

	it("should reject invalid paths", function () {
		assert.isFalse(registerEmpty("hello"), "a missing leading slash");
		assert.isFalse(registerEmpty("/../connector/ping"), "path traversal");
		assert.isFalse(registerEmpty("//hello"), "an empty segment");
	});

	it("should reject a duplicate path from the same plugin", function () {
		assert.equal(registerEmpty("/dupe"), pathPrefix + "/dupe");
		assert.isFalse(registerEmpty("/dupe"));
	});

	it("should keep an unprivileged plugin out of another plugin's namespace", function () {
		let key = plugin.run(otherID => Zotero.ServerEndpointManager.registerEndpoint({
			pluginID: otherID,
			path: "/spoof",
			handler: () => 204,
		}), other.id);
		assert.equal(key, pathPrefix + "/spoof", "the injected ID wins");
	});

	it("should not let a plugin unregister another plugin's endpoint", async function () {
		let key = registerEmpty("/protected");
		other.load(["default", "serverEndpoint"]);
		assert.isFalse(other.run(key => Zotero.ServerEndpointManager.unregisterEndpoint(key), key));
		assert.equal((await request("GET", key)).status, 204);
	});

	it("should give the endpoint URL for a registered endpoint only", function () {
		let key = registerEmpty("/url");
		assert.deepEqual(plugin.run((key, unknown) => [
			Zotero.ServerEndpointManager.getEndpointURL(key),
			Zotero.ServerEndpointManager.getEndpointURL(unknown),
		], key, pathPrefix + "/unknown"), [serverPath + pathPrefix + "/url", null]);
	});

	it("should reject requests that look like unsafe web content by default", async function () {
		let key = registerEmpty("/guarded");
		// Without Zotero-Allowed-Request, a Mozilla/ user agent has its connection cancelled without a response
		let e = await getPromiseError(Zotero.HTTP.request("GET", serverPath + key, { responseType: "text" }));
		assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
		assert.equal(e.status, 0);
	});

	it("should not expose ServerEndpointManager without the serverEndpoint permission", function () {
		other.load(["default"]);
		assert.equal(other.run(() => typeof Zotero.ServerEndpointManager), "undefined");
	});

	it("should list registered endpoints with their plugin-provided info at /plugins", async function () {
		plugin.run(() => {
			Zotero.ServerEndpointManager.registerEndpoint({
				path: "/with-info",
				supportedMethods: ["GET"],
				supportedDataTypes: ["application/json"],
				info: { description: "Test API", version: "1.2.0", params: { name: "string" } },
				handler: () => 204,
			});
			Zotero.ServerEndpointManager.registerEndpoint({ path: "/without-info", handler: () => 204 });
		});

		let req = await request("GET", "/plugins");
		assert.equal(req.status, 200);
		assert.equal(req.getResponseHeader("Content-Type"), "application/json");
		let { endpoints } = JSON.parse(req.responseText);
		let withInfo = endpoints.find(e => e.path == pathPrefix + "/with-info");
		assert.equal(withInfo.pluginID, plugin.id);
		assert.deepEqual(withInfo.supportedMethods, ["GET"]);
		assert.deepEqual(withInfo.supportedDataTypes, ["application/json"]);
		assert.deepEqual(withInfo.info, { description: "Test API", version: "1.2.0", params: { name: "string" } });
		let withoutInfo = endpoints.find(e => e.path == pathPrefix + "/without-info");
		assert.deepEqual(withoutInfo.supportedMethods, ["GET", "POST"]);
		assert.notProperty(withoutInfo, "supportedDataTypes");
		assert.notProperty(withoutInfo, "info");

		plugin.run(key => Zotero.ServerEndpointManager.unregisterEndpoint(key), pathPrefix + "/with-info");
		let remaining = JSON.parse((await request("GET", "/plugins")).responseText).endpoints;
		assert.notOk(remaining.find(e => e.path == pathPrefix + "/with-info"), "an unregistered endpoint leaves the list");
		assert.ok(remaining.find(e => e.path == pathPrefix + "/without-info"));
	});

	it("should serve an empty endpoint list when none are registered", async function () {
		let req = await request("GET", "/plugins");
		assert.equal(req.status, 200);
		assert.deepEqual(JSON.parse(req.responseText), { endpoints: [] });
	});

	it("should reject info that is not JSON-serializable", function () {
		assert.isFalse(plugin.run(() => {
			let cyclic = {};
			cyclic.self = cyclic;
			return Zotero.ServerEndpointManager.registerEndpoint({ path: "/cyclic-info", info: cyclic, handler: () => 204 });
		}));
	});

	it("should unregister a plugin's endpoints when it shuts down", async function () {
		let key = registerEmpty("/shutdown");
		assert.property(Zotero.Server.Endpoints, key);
		// What Zotero does on the plugin's shutdown
		await Zotero.ServerEndpointManager._manager._unregisterByPluginID(plugin.id);
		assert.notProperty(Zotero.Server.Endpoints, key);
		assert.equal((await request("GET", key)).status, 404);
	});
});
