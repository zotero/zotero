/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/


{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		PluginAPIBase: "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginUUID: "chrome://zotero/content/xpcom/plugins/uuid.mjs",
		NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
	});

	const VALID_METHODS = ["GET", "POST"];

	// All plugin endpoints are namespaced under "/plugins/<pluginUUID>"
	const ENDPOINT_PATH_PREFIX = "/plugins/";

	// The universal discovery endpoint
	const DISCOVERY_PATH = "/plugins";

	// "/" separated RFC 3986 pchar segments, with Zotero.Router template parameters
	const PATH_PATTERN = /^(?:\/:?[A-Za-z0-9._~@!$&'()*+,;=-]+)+$/;

	// RFC 9110 field-name token
	const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/;

	/**
	 * @typedef {object} ServerEndpointRequest
	 * @property {string} method - "GET" or "POST"
	 * @property {string} pathname - Full request path, e.g. "/plugins/<pluginUUID>/hello"
	 * @property {Record<string, string>} pathParams - Matched ":param" template
	 *   segments, e.g. { key: "ABCD2345" } for "/items/:key"
	 * @property {string} query - Raw query string, without the leading "?"
	 * @property {Record<string, string>} searchParams - Parsed query params; for a
	 *   repeated param, only the last value is kept
	 * @property {Record<string, string>} headers - Request headers, with lower-case names
	 * @property {object | string | any[] | null} data - Request body: an object for JSON
	 *   and form-urlencoded, an array of parts for multipart/form-data, a string for
	 *   text/plain, a raw byte string for other types, and null for GET
	 *
	 * @typedef {number
	 *   | [number, string | Record<string, string>, string?]
	 * } ServerEndpointResponse
	 * - A status code alone, or [status, contentType (or header -> value object), body?].
	 * The status must be one in `Zotero.Server.responseCodes`.
	 *
	 * @typedef {object} ServerEndpointOptions
	 * @property {string} pluginID - ID of the registering plugin
	 * @property {string} path - Endpoint path; must start with "/". Served at
	 *   "/plugins/<pluginUUID><path>". ":"-prefixed segments are template parameters,
	 *   passed to the handler via `pathParams`
	 * @property {string[]} [supportedMethods] - Accepted methods, a subset of
	 *   ["GET", "POST"]. Defaults to both
	 * @property {string[]} [supportedDataTypes] - Content types accepted for POST.
	 *   Defaults to all
	 * @property {boolean} [allowRequestsFromUnsafeWebContent] - Allow requests that look
	 *   like they come from a browser without a connector-like header (default false).
	 *   Enable only for endpoints meant for web pages (e.g. an OAuth callback), and
	 *   treat all input as untrusted
	 * @property {object} [info] - JSON-serializable object describing the endpoint,
	 *   served to external consumers by the discovery endpoint at "/plugins"
	 * @property {(request: ServerEndpointRequest) =>
	 *   ServerEndpointResponse | Promise<ServerEndpointResponse>} handler
	 * - Request handler. Thrown errors result in a 500 response
	 */


	class ServerEndpointManagerInternal extends lazy.PluginAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ServerEndpointManager",
				mainKeyName: "path",
				pluginIDKeyName: "pluginID",
				// Disable notifier, as endpoints are applied directly to the server
				notifyType: false,
				optionTypeDefinition: {
					pluginID: {
						type: "string",
						checkHook: (value) => {
							if (!value) {
								return "Option 'pluginID' must not be empty";
							}
							return true;
						},
					},
					path: {
						type: "string",
						checkHook: (value) => {
							if (!PATH_PATTERN.test(value)) {
								return `Option 'path' must start with "/" and contain only URL path characters, got ${value}`;
							}
							if (value.split("/").some(segment => /^\.+$/.test(segment))) {
								return `Option 'path' must not contain "." or ".." segments, got ${value}`;
							}
							return true;
						},
					},
					supportedMethods: {
						type: "array",
						optional: true,
						checkHook: (value) => {
							if (typeof value === "undefined") {
								return true;
							}
							if (!value.length || !value.every(method => VALID_METHODS.includes(method))) {
								return `Option 'supportedMethods' must be a non-empty subset of ${VALID_METHODS.join(", ")}`;
							}
							return true;
						},
					},
					supportedDataTypes: {
						type: "array",
						optional: true,
						checkHook: (value) => {
							if (typeof value === "undefined") {
								return true;
							}
							if (!value.every(type => typeof type === "string" && !!type)) {
								return "Option 'supportedDataTypes' must only contain non-empty strings";
							}
							return true;
						},
					},
					allowRequestsFromUnsafeWebContent: {
						type: "boolean",
						optional: true,
					},
					info: {
						type: "object",
						optional: true,
						checkHook: (value) => {
							if (typeof value === "undefined") {
								return true;
							}
							try {
								JSON.stringify(value);
							}
							catch {
								return "Option 'info' must be JSON-serializable";
							}
							return true;
						},
					},
					handler: {
						type: "function",
						// Disable the try-catch wrapper so _handleRequest can turn errors into a 500
						unsafeFunction: true,
					},
				},
			};
		}

		_namespacedMainKey(option) {
			let pluginID = option?.pluginID;
			let uuid = typeof pluginID === "string" && pluginID
				? lazy.PluginUUID.getByID(pluginID)
				: pluginID;
			return `${ENDPOINT_PATH_PREFIX}${uuid}${option?.path}`;
		}

		_validate(option) {
			option = super._validate(option);
			if (option === false) {
				return false;
			}
			let mainKey = this._getOptionMainKey(option);
			if (Zotero.Server.Endpoints[mainKey]) {
				this._log(`Endpoint '${mainKey}' is already registered on the server`, "warn");
				return false;
			}
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			option.handler = lazy.ScopeVariables.fromScope(option.handler, option.pluginID);
			option.allowRequestsFromUnsafeWebContent = !!option.allowRequestsFromUnsafeWebContent;
			if (option.info !== undefined) {
				option.info = JSON.parse(JSON.stringify(option.info));
			}
			return option;
		}

		_add(option) {
			let mainKey = super._add(option);
			if (!mainKey) {
				return false;
			}
			Zotero.Server.Endpoints[mainKey] = this._makeEndpoint(mainKey);
			if (!this.getEndpointURL(mainKey)) {
				this._log(`Local server is not running -- endpoint '${mainKey}' won't be reachable`, "warn");
			}
			return mainKey;
		}

		_remove(mainKey) {
			let success = super._remove(mainKey);
			if (success) {
				delete Zotero.Server.Endpoints[mainKey];
			}
			return success;
		}

		/**
		 * Get the full URL of a registered endpoint
		 * @param {string} mainKey - The registration key returned by register()
		 * @returns {string | null} - The URL, or null if the endpoint isn't
		 *   registered or the local server isn't running
		 */
		getEndpointURL(mainKey) {
			if (!this._optionsCache[mainKey]) {
				return null;
			}
			try {
				return `http://127.0.0.1:${Zotero.Server.port}${mainKey}`;
			}
			catch {
				// Server not initialized
				return null;
			}
		}

		/**
		 * Get a JSON-serializable list of all registered endpoints for discovery
		 * @returns {object[]}
		 */
		getDiscoveryList() {
			return Object.values(this._optionsCache)
				.map((option) => {
					let entry = {
						path: this._getOptionMainKey(option),
						pluginID: this._getOptionPluginID(option),
						supportedMethods: option.supportedMethods || [...VALID_METHODS],
					};
					if (option.supportedDataTypes) {
						entry.supportedDataTypes = option.supportedDataTypes;
					}
					if (option.info !== undefined) {
						entry.info = option.info;
					}
					return entry;
				})
				.sort((a, b) => a.path.localeCompare(b.path));
		}

		/**
		 * Create an endpoint constructor for Zotero.Server.Endpoints
		 * @param {string} mainKey
		 * @returns {function}
		 */
		_makeEndpoint(mainKey) {
			let getOption = () => this._optionsCache[mainKey];
			let handleRequest = request => this._handleRequest(mainKey, request);
			return function () {
				let option = getOption();
				this.supportedMethods = option?.supportedMethods || VALID_METHODS;
				this.supportedDataTypes = option?.supportedDataTypes;
				this.allowRequestsFromUnsafeWebContent = !!option?.allowRequestsFromUnsafeWebContent;
				this.init = handleRequest;
			};
		}

		/**
		 * Handle a server-dispatched request: pass a request object that can safely
		 * cross into the plugin scope, then normalize the handler's response
		 * @returns {Promise<number | [number, string | object, string?]>}
		 */
		async _handleRequest(mainKey, { method, pathname, pathParams, searchParams, headers, data }) {
			let option = this._optionsCache[mainKey];
			// Unregistered since the request was dispatched
			if (!option) {
				return 404;
			}

			// The server passes unparsed content types as a raw stream -- read it into a byte string
			if (data instanceof Ci.nsIInputStream) {
				try {
					let available = data.available();
					data = available ? lazy.NetUtil.readInputStreamToString(data, available) : "";
				}
				catch (e) {
					Zotero.logError(e);
					return 500;
				}
			}

			let request = {
				method,
				pathname,
				pathParams: Object.assign({}, pathParams),
				query: searchParams.toString(),
				searchParams: Object.fromEntries(searchParams),
				headers: Object.assign({}, headers),
				data,
			};

			let response;
			try {
				response = await option.handler(request);
			}
			catch (e) {
				this._log(`Error in handler of endpoint '${mainKey}'`, "warn");
				Zotero.logError(e);
				return 500;
			}

			return this._normalizeResponse(response, mainKey);
		}

		/**
		 * Normalize a handler response (possibly from an unprivileged plugin scope)
		 * into chrome-compartment values the server can send
		 */
		_normalizeResponse(response, mainKey) {
			if (this._isValidStatus(response)) {
				return response;
			}
			if (Array.isArray(response)) {
				let status = response[0];
				let contentTypeOrHeaders = response[1];
				let body = response[2];
				if (!this._isValidStatus(status)) {
					this._log(`Endpoint '${mainKey}' returned an unsupported status code '${status}'`, "warn");
					return 500;
				}
				let responseHeaders = this._normalizeResponseHeaders(contentTypeOrHeaders, mainKey);
				if (responseHeaders === false) {
					return 500;
				}
				if (body === undefined || body === null) {
					return [status, responseHeaders, undefined];
				}
				if (typeof body !== "string") {
					this._log(`Endpoint '${mainKey}' returned a non-string body -- serialize it first (e.g. with JSON.stringify())`, "warn");
					return 500;
				}
				return [status, responseHeaders, body];
			}
			this._log(`Endpoint '${mainKey}' returned an invalid response -- must be a status code or [status, contentTypeOrHeaders, body]`, "warn");
			return 500;
		}

		_isValidStatus(status) {
			return Number.isInteger(status) && !!Zotero.Server.responseCodes[status];
		}

		/**
		 * @returns {string | object | undefined | false} - False if invalid
		 */
		_normalizeResponseHeaders(contentTypeOrHeaders, mainKey) {
			if (contentTypeOrHeaders === undefined || contentTypeOrHeaders === null) {
				return undefined;
			}
			if (typeof contentTypeOrHeaders === "string") {
				return contentTypeOrHeaders.replace(/[\r\n]+/g, " ");
			}
			if (typeof contentTypeOrHeaders === "object") {
				let responseHeaders = {};
				for (let key of Object.keys(contentTypeOrHeaders)) {
					if (!HEADER_NAME_PATTERN.test(key)) {
						this._log(`Endpoint '${mainKey}' returned an invalid header name '${key}'`, "warn");
						return false;
					}
					responseHeaders[key] = String(contentTypeOrHeaders[key]).replace(/[\r\n]+/g, " ");
				}
				return responseHeaders;
			}
			this._log(`Endpoint '${mainKey}' returned invalid response headers`, "warn");
			return false;
		}
	}


	/**
	 * Manages HTTP endpoint registration on Zotero's local server for plugins.
	 *
	 * Endpoints are served at `http://127.0.0.1:<localAPIPort>/plugins/<pluginUUID><path>`
	 * and unregistered automatically when the owning plugin shuts down. Use
	 * getEndpointURL() for a registered endpoint's full URL.
	 *
	 * External consumers can discover endpoints via `GET /plugins`, which returns
	 * each endpoint's path, owning plugin ID, supported methods/content types, and
	 * the JSON `info` object the plugin supplied at registration.
	 *
	 * @memberof Zotero
	 *
	 * @example
	 * ```js
	 * let key = Zotero.ServerEndpointManager.registerEndpoint({
	 *     pluginID: "example@zotero.org",
	 *     path: "/hello",
	 *     supportedMethods: ["GET", "POST"],
	 *     supportedDataTypes: ["application/json"],
	 *     handler: async ({ method, searchParams, data }) => {
	 *         if (method === "POST") {
	 *             return [201, "application/json", JSON.stringify({ received: data })];
	 *         }
	 *         return [200, "text/plain", `Hello, ${searchParams.name || "World"}!`];
	 *     },
	 * });
	 * // Served at http://127.0.0.1:<localAPIPort>/plugins/<pluginUUID>/hello
	 * let url = Zotero.ServerEndpointManager.getEndpointURL(key);
	 * ```
	 */
	Zotero.ServerEndpointManager = {
		_manager: new ServerEndpointManagerInternal(),

		/**
		 * Register an endpoint on the local HTTP server.
		 *
		 * @param {ServerEndpointOptions} options
		 * @returns {string | false} - The registration key (the endpoint's server
		 *   path), or false if the options are invalid
		 */
		registerEndpoint(options) {
			return this._manager.register(options);
		},

		/**
		 * Unregister a previously registered endpoint.
		 *
		 * @param {string} registrationKey - The key returned by registerEndpoint()
		 * @returns {boolean}
		 */
		unregisterEndpoint(registrationKey, _callerPluginID) {
			return this._manager.unregister(registrationKey, _callerPluginID);
		},

		/**
		 * Get the full URL of a registered endpoint.
		 *
		 * @param {string} registrationKey - The key returned by registerEndpoint()
		 * @returns {string | null} - The URL, or null if the endpoint isn't
		 *   registered or the local server isn't running
		 */
		getEndpointURL(registrationKey) {
			return this._manager.getEndpointURL(registrationKey);
		},
	};

	lazy.ScopeVariables.setCustomParser(
		Zotero.ServerEndpointManager.registerEndpoint,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.ServerEndpointManager.unregisterEndpoint,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);

	// Universal discovery endpoint for external consumers to look up endpoint URLs and info
	class DiscoveryEndpoint {
		constructor() {
			this.supportedMethods = ["GET"];
			this.init = (_request) => {
				let endpoints = Zotero.ServerEndpointManager._manager.getDiscoveryList();
				return [200, "application/json", JSON.stringify({ endpoints })];
			};
		}
	}
	Zotero.Server.Endpoints[DISCOVERY_PATH] = DiscoveryEndpoint;
}
