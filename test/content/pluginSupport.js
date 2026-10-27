/*
 * Helpers for the plugin API tests. Every API test calls the API from a mock plugin's sandbox, as a
 * plugin does, so the tests read as usage examples; only Zotero's own side (rendering, events) runs in chrome
 */

/**
 * A mock plugin for the tests of one describe block, whose sandbox is unloaded after each test; tests name it `plugin`
 * @param {object} [options]
 * @param {string} [options.id]
 * @param {string} [options.name]
 * @returns {PluginTestSandbox}
 */
function usePluginSandbox({ id = "test-sandbox@zotero.org", name = "Test Sandbox Plugin" } = {}) {
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
	var { PluginUUID } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/uuid.mjs");
	var { ScopeUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
	var { PluginNetwork } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/network.mjs");

	/** @typedef {object} PluginTestSandbox */
	var sandbox = {
		id,
		uuid: PluginUUID.getByID(id),
		// The mock addon and the scope of the last load
		addon: null,
		scope: null,

		/**
		 * (Re)load the plugin; ["*"] makes it privileged
		 * @param {string[]} [permissions]
		 * @param {object} [manifest] - The rest of createMockPlugin's options, e.g. origins or resourceURI
		 * @returns {object} The scope
		 */
		load(permissions = ["default"], manifest = {}) {
			this.addon = createMockPlugin({ id, name, permissions, ...manifest });
			PluginSandbox.loadScope(this.addon);
			this.scope = PluginSandbox.getScope(id);
			return this.scope;
		},

		eval(code, scope = this.scope) {
			return Cu.evalInSandbox(code, scope);
		},

		/**
		 * Run a function as the plugin's own code; it sees the sandbox's globals and its JSON args, no test
		 * variables, and what it returns (or resolves with) arrives as plain data
		 * @param {function} fn
		 * @param {...*} args
		 */
		run(fn, ...args) {
			let result = this.eval(`(${fn}).apply(null, ${JSON.stringify(args)})`);
			let plain = value => ScopeUtils.toPlainData(value);
			return typeof result?.then === "function" ? result.then(plain) : plain(result);
		},

		/**
		 * Hand the plugin a test function, e.g. one its hooks report to; the arguments arrive as plain data
		 * @param {string} name - The global it is defined as
		 * @param {function} fn
		 */
		expose(name, fn) {
			Cu.exportFunction((...args) => fn(...args.map(arg => ScopeUtils.toPlainData(arg))), this.scope, { defineAs: name });
		},

		unload() {
			PluginSandbox.unloadScope(id);
		},
	};

	before(async function () {
		await Zotero.initializationPromise;
		// The harness runs plugin code without bootstrap.js, which loadScope holds back until the gate is live
		await PluginNetwork.init();
	});

	afterEach(function () {
		sandbox.unload();
	});

	return sandbox;
}

/**
 * Local API server endpoints for one describe block, removed after each test
 * @returns {{ register: (method: string, init: function) => string }} `register` returns the endpoint URL
 */
function useTestEndpoints() {
	var endpoints = [];

	afterEach(function () {
		for (let endpoint of endpoints) {
			delete Zotero.Server.Endpoints[endpoint];
		}
		endpoints = [];
	});

	return {
		register(method, init) {
			let endpoint = "/test/plugin-sandbox/" + Zotero.Utilities.randomString();
			let handler = function () {};
			handler.prototype = {
				supportedMethods: [method],
				supportedDataTypes: "*",
				// The server picks its calling convention by arity; one param is the promise form
				init(options) {
					return init(options);
				},
			};
			Zotero.Server.Endpoints[endpoint] = handler;
			endpoints.push(endpoint);
			return "http://127.0.0.1:" + Zotero.Server.port + endpoint;
		},
	};
}

// From https://searchfox.org/mozilla-esr128/source/browser/base/content/test/menubar/browser_file_close_tabs.js
function simulateMenuOpen(menu) {
	return new Promise((resolve) => {
		menu.addEventListener("popupshown", resolve, { once: true });
		menu.dispatchEvent(new MouseEvent("popupshowing"));
		menu.dispatchEvent(new MouseEvent("popupshown"));
	});
}

function simulateMenuClosed(menu) {
	return new Promise((resolve) => {
		menu.addEventListener("popuphidden", resolve, { once: true });
		menu.dispatchEvent(new MouseEvent("popuphiding"));
		menu.dispatchEvent(new MouseEvent("popuphidden"));
	});
}

function simulateMenuItemClick(menuitem) {
	return new Promise((resolve) => {
		menuitem.addEventListener("command", resolve, { once: true });
		menuitem.dispatchEvent(new MouseEvent("click"));
		menuitem.dispatchEvent(new MouseEvent("command"));
	});
}

/**
 * The result of a request API response, failing with the response's own message
 * @param {Promise<APIResponse> | APIResponse} response
 * @returns {Promise<object>}
 */
async function requestResult(response) {
	let { success, result, error } = await response;
	assert.isTrue(success, error && `${error.code}: ${error.message}`);
	return result;
}

/**
 * The error of a failed request API response, checking the rest of the envelope on the way
 * @param {Promise<APIResponse> | APIResponse} response
 * @param {string} [code] - The error code it must carry
 * @returns {Promise<{ code: string, message: string, data?: object }>}
 */
async function requestError(response, code) {
	let { success, result, error } = await response;
	assert.isFalse(success, "expected a failed response");
	assert.deepEqual(result, {}, "a failed response carries an empty result");
	assert.isString(error.message);
	if (code !== undefined) {
		assert.equal(error.code, code, error.message);
	}
	return error;
}

/**
 * What callbacks report, by key: `expect(key)` before the call, `get(key)` resolves once `report(key, value)` runs
 */
function createCallbackLog() {
	var entries = {};
	return {
		expect(key) {
			entries[key] = { deferred: Zotero.Promise.defer(), value: undefined };
		},
		report(key, value) {
			let entry = entries[key];
			if (!entry) {
				return;
			}
			entry.value = value;
			entry.deferred.resolve();
		},
		async get(key) {
			await entries[key].deferred.promise;
			return entries[key].value;
		},
		reset() {
			entries = {};
		},
	};
}
