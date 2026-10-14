describe("Plugin Zotero.HTTP", function () {
	var plugin = usePluginSandbox();
	var endpoints = useTestEndpoints();

	beforeEach(function () {
		plugin.load(["default"], { origins: ["*://127.0.0.1/*"] });
	});

	it("should make a GET request and return status and response text", async function () {
		let url = endpoints.register("GET", function () {
			return [200, "text/plain", "sandbox GET response"];
		});

		let result = await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
		assert.equal(result.status, 200);
		assert.equal(result.text, "sandbox GET response");
	});

	it("should make a POST request with a JSON body", async function () {
		let receivedData;
		let url = endpoints.register("POST", function (options) {
			// Server auto-parses JSON bodies
			receivedData = options.data;
			return [201, "text/plain", "created"];
		});

		let status = await plugin.eval(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: 'from sandbox' }),
					responseType: 'text'
				}).then(req => req.status)
			`);
		assert.equal(status, 201);
		assert.equal(receivedData.message, 'from sandbox');
	});

	it("should send custom headers with the request", async function () {
		let receivedHeaders;
		let url = endpoints.register("GET", function (options) {
			receivedHeaders = options.headers;
			return [200, "text/plain", "ok"];
		});

		await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					headers: { 'X-Custom-Header': 'sandbox-test-value' },
					responseType: 'text'
				})
			`);
		assert.equal(receivedHeaders['X-Custom-Header'], 'sandbox-test-value');
	});

	it("should handle JSON response type", async function () {
		let url = endpoints.register("GET", function () {
			return [200, "application/json", JSON.stringify({ key: "value", num: 42 })];
		});

		let response = await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'json'
				}).then(req => req.response)
			`);
		assert.equal(response.key, "value");
		assert.equal(response.num, 42);
	});

	it("should handle non-200 success status codes", async function () {
		let url = endpoints.register("GET", function () {
			return 204;
		});

		let status = await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => req.status)
			`);
		assert.equal(status, 204);
	});

	it("should reject on error status codes", async function () {
		let url = endpoints.register("GET", function () {
			return [400, "text/plain", "bad request"];
		});

		let rejected = await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(() => false, () => true)
			`);
		assert.isTrue(rejected, "Request with 400 status should reject");
	});

	it("should accept successCodes option to treat non-2xx as success", async function () {
		let url = endpoints.register("GET", function () {
			return [404, "text/plain", "not found"];
		});

		let result = await plugin.eval(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text',
					successCodes: [404]
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
		assert.equal(result.status, 404);
		assert.equal(result.text, "not found");
	});

	it("should POST JSON body and receive JSON response", async function () {
		let receivedData;
		let url = endpoints.register("POST", function (options) {
			receivedData = options.data;
			return [200, "application/json", JSON.stringify({ received: true })];
		});

		let response = await plugin.eval(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Test', count: 3 }),
					responseType: 'json'
				}).then(req => req.response)
			`);
		assert.isTrue(response.received);
		assert.equal(receivedData.title, 'Test');
		assert.equal(receivedData.count, 3);
	});

	it("should fetch and process an HTML document with processDocuments()", async function () {
		let url = endpoints.register("GET", function () {
			return [200, "text/html", "<html><head><title>Sandbox Doc</title></head><body><p>Hello</p></body></html>"];
		});

		let result = await plugin.eval(`
				Zotero.HTTP.processDocuments(${JSON.stringify(url)}, function (doc, responseURL) {
					return responseURL;
				}).then(results => results[0])
			`);
		assert.include(result, "/test/plugin-sandbox/");
	});

	describe("network access control", function () {
		it("should block requests to origins not in host_permissions via CORS", async function () {
			// Reload without the parent's 127.0.0.1 origins
			plugin.load(["default"]);

			let url = endpoints.register("GET", function () {
				return [200, "text/plain", "should not reach here"];
			});

			let rejected = await plugin.eval(`
					Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
						responseType: 'text'
					}).then(() => false, () => true)
				`);
			assert.isTrue(rejected,
				"Request to undeclared origin should be blocked by CORS");
		});

		it("should allow requests when origin is in host_permissions", async function () {
			// Parent beforeEach already creates scope with *://127.0.0.1/*
			let url = endpoints.register("GET", function () {
				return [200, "text/plain", "allowed"];
			});

			let result = await plugin.eval(`
					Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
						responseType: 'text'
					}).then(req => req.responseText)
				`);
			assert.equal(result, "allowed");
		});
	});
});
