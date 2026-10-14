/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
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


/**
 * @typedef {object} PluginAPIConfig
 * @property {string} apiName - The name of the API
 * @property {string} mainKeyName - The main key in the option object that uniquely identifies it
 * @property {string} pluginIDKeyName - The key in the option object that identifies the plugin
 * @property {string} notifyType - The type of the notification to send after an update
 * @property {string} notifyAction - The action of the notification to send after an update
 * @property {Record<string, PluginAPIOptDefValue} optionTypeDefinition
 * - The option validation definition.
 *
 *
 * @typedef {string} PluginAPIOptDefType
 * - The type of the value
 *
 *
 * @typedef {(value: any) => boolean} PluginAPIOptDefCheckHook
 * - A function to check the value, returning true if it is valid
 *
 *
 * @typedef {object} PluginAPIOptDefConfig
 * @property {PluginAPIOptDefType} [type] - The type of the value
 * @property {boolean} [optional] - Whether the value is optional, default false
 * @property {PluginAPIOptDefCheckHook} [checkHook]
 *  - A function to check the value, returning true if it is valid
 * @property {PluginAPIOptDefConfig} [children]
 *  - The type definition of the children of the object. The children can be
 * an object or an array of objects with the same structure
 * @property {any} [fallbackReturn] - The value to return if the check hook fails
 * The fallback return is only used if the value is a function and it throws an error
 * If no fallback return is defined, the function will return null
 *
 *
 * @typedef {PluginAPIOptDefConfig | PluginAPIOptDefType | PluginAPIOptDefCheckHook} PluginAPIOptDefValue
 * - The value of the option definition
 * - If the value is a string, it is interpreted as the type
 * - If the value is a function, it is interpreted as a check hook
 * - If the value is an object, it is interpreted as a configuration object
 */


/**
 * @typedef {object} ControllerAPIConfig
 * @property {string} apiName - Log prefix and error namespace
 * @property {Record<string, ControllerRequestDef>} [queries] - Read-only requests, defined on set
 * @property {Record<string, ControllerRequestDef>} [commands] - Requests with side effects, defined on set
 *
 *
 * @typedef {object} ControllerRequestContext
 * @property {"query" | "command"} kind
 * @property {string} name - The request name the handler was invoked as
 *
 *
 * @typedef {object} ControllerRequestDef
 * @property {string | string[]} [permissions] - Permissions the caller must hold on top of the
 *     one that exposed the API method
 * @property {Record<string, PluginAPIOptDefValue>} [params]
 *     - Type definition for the params object; unknown keys are rejected
 * @property {boolean} [scopedResult] - The handler already made its result safe for the caller's
 *     scope (see ScopeVariables.toScope); pass it through instead of the JSON round trip
 * @property {(params: object, context: ControllerRequestContext) => (object | Promise<object>)} handler
 *     - Called with the controller as `this`; must return a JSON-serializable object. For an
 *     unprivileged caller, `params.pluginID` (a reserved key) is the calling plugin
 */


const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
	PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
	VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
});


/**
 * Shared plumbing for both plugin API types: config, option validation, and logging
 */
class PluginAPIBase {
	_config = {
		apiName: "PluginAPIBase",
	};

	/**
	 * Set the configuration
	 * @param {PluginAPIConfig | ControllerAPIConfig} config - The configuration to set
	 */
	set config(config) {
		Object.assign(this._config, config);
	}

	/**
	 * Validate an object against type definition or check hook
	 * @param {object} obj - The object to validate
	 * @param {object} typeDef - The type definition to validate against
	 * @param {string} path - The path to the object in the type definition
	 * @returns {{obj?: object, valid: boolean}} - The validated object if valid and the validation flag
	 */
	_validateObject(obj, typeDef, path = "") {
		obj = Object.assign({}, obj);

		try {
			for (let key of Object.keys(typeDef)) {
				let val = obj[key];
				let requirement = typeDef[key];
				let fullPath = `${path}["${key}"]`;
				if (!requirement) {
					throw new Error(`Unknown option ${fullPath}`);
				}

				if (typeof requirement === "string") {
					requirement = {
						optional: false,
						type: requirement,
					};
				}
				else if (typeof requirement === "function") {
					requirement = {
						optional: false,
						checkHook: requirement,
					};
				}

				if (!requirement.optional && typeof val === "undefined") {
					throw new Error(`Option must have ${fullPath}`);
				}

				let requiredType = requirement.type;
				let gotType = typeof val;
				// Allow undefined values since it's checked above
				// Should be array or undefined
				if (requiredType === "array" && gotType !== "undefined") {
					if (!Array.isArray(val)) {
						throw new Error(`Option ${fullPath} must be ${requiredType}, got ${typeof val}`);
					}
					// Copy into a chrome-compartment array since Object.assign
					// only shallow-copies and the array may be from a sandbox
					val = obj[key] = Array.from(val);
				}
				// Should be required type or undefined
				else if (requiredType && requiredType !== "any" && !["undefined", requiredType].includes(gotType)) {
					throw new Error(`Option ${fullPath} must be ${requiredType}, got ${typeof val}`);
				}
				
				if (requirement.checkHook) {
					let result = requirement.checkHook(val);
					if (result !== true) {
						throw new Error(`Option ${fullPath} failed check: ${result}`);
					}
				}

				if (requirement.children) {
					if (Array.isArray(val)) {
						// Only validate array elements if they are objects
						if (val.length > 0 && typeof val[0] == "object") {
							for (let i = 0; i < val.length; i++) {
								let result = this._validateObject(val[i], requirement.children, `${path}.${key}[${i}].`);
								if (!result.valid) {
									// The detailed error message is already logged
									throw new Error(`Option ${fullPath}[${i}] is invalid`);
								}
								val[i] = result.obj;
							}
						}
					}
					else if (typeof val == "object") {
						let result = this._validateObject(val, requirement.children, `${path}.${key}`);
						if (!result.valid) {
							// The detailed error message is already logged
							throw new Error(`Option ${fullPath} is invalid`);
						}
						obj[key] = result.obj;
					}
				}

				// Validations passed, continue with post-processing

				// Wrap functions for safe execution
				if (gotType === "function" && !requirement.unsafeFunction) {
					obj[key] = (...args) => {
						try {
							return val(...args);
						}
						catch (e) {
							this._log(`Error in execution of ${fullPath}`, "warn");
							lazy.Zotero.logError(e);
							return requirement?.fallbackReturn || null;
						}
					};
				}
			}
		}
		catch (e) {
			this._log(String(e), "warn");
			return {
				valid: false,
			};
		}

		return {
			obj,
			valid: true,
		};
	}

	_log(message, logType = "debug") {
		lazy.Zotero[logType](`${this._config.apiName}: ${message}`);
	}
}


/**
 * Registration-style API: plugins register option objects that Zotero renders and
 * unregister them, with per-plugin cleanup on shutdown
 */
class ManagerAPIBase extends PluginAPIBase {
	_optionsCache = {};

	_lastUpdateID = "";

	/**
	 * @type {PluginAPIConfig}
	 */
	_config = {
		apiName: "ManagerAPIBase",
		mainKeyName: "id",
		pluginIDKeyName: "pluginID",
		notifyType: "unknown",
		notifyAction: "refresh",
		optionTypeDefinition: {},
	};

	get updateID() {
		return this._lastUpdateID;
	}

	get options() {
		return Object.values(this._optionsCache).map(opt => Object.assign({}, opt));
	}

	get data() {
		return {
			updateID: this.updateID,
			options: this.options,
		};
	}

	/**
	 * Register an option. Must be valid with a unique mainKey defined by _config#mainKeyName
	 * @param {object} option - The option to register
	 * @returns {string | false} - The mainKey of the registered option, or false if the option is invalid
	 */
	register(option) {
		let mainKey = this._add(option);
		if (!mainKey) {
			return false;
		}
		this._addPluginShutdownObserver();
		this._refresh();
		return mainKey;
	}

	/**
	 * Unregister an option by mainKey
	 * @param {string} mainKey - The mainKey of the option to unregister
	 * @param {string} [callerPluginID] - Calling plugin's ID, injected for unprivileged callers
	 * @returns {boolean} - True if the option was successfully unregistered
	 */
	unregister(mainKey, callerPluginID) {
		let option = this._optionsCache[mainKey];
		if (callerPluginID && option
				&& this._getOptionPluginID(option) !== callerPluginID) {
			this._log(`Plugin '${callerPluginID}' cannot unregister '${mainKey}' owned by another plugin`, "warn");
			return false;
		}
		const success = this._remove(mainKey);
		if (!success) {
			return false;
		}
		this._refresh();
		return true;
	}

	/**
	 * Internal implementation of registering an option, can be overridden by subclasses
	 * @param {object} option - The option to add
	 * @returns {string | false} - The mainKey of the added option, or false if the option is invalid
	 */
	_add(option) {
		option = this._validate(option);
		if (option === false) {
			return false;
		}

		option = this._convert(option);

		let mainKey = this._getOptionMainKey(option);
		this._optionsCache[mainKey] = option;
		return mainKey;
	}

	/**
	 * Internal implementation of unregistering an option, can be overridden by subclasses
	 * @param {object} mainKey - The mainKey of the option to remove
	 * @returns {boolean} - True if the option was successfully removed
	 */
	_remove(mainKey) {
		if (!this._optionsCache[mainKey]) {
			this._log(`Can't remove unknown option '${mainKey}'`, "warn");
			return false;
		}
		delete this._optionsCache[mainKey];
		return true;
	}

	/**
	 * Internal implementation of validating an option, can be overridden by subclasses
	 * @param {object} option
	 * @returns {object | false} - The option if it is valid, or false if it is invalid
	 */
	_validate(option) {
		let mainKey = this._namespacedMainKey(option);

		if (this._optionsCache[mainKey]) {
			this._log(`'${this._config.mainKeyName}' must be unique, got ${mainKey}`, "warn");
			return false;
		}

		let validateResult = this._validateObject(option, this._config.optionTypeDefinition);

		if (!validateResult.valid) {
			return false;
		}

		option = validateResult.obj;
		option[this._config.mainKeyName] = mainKey;
		return option;
	}

	/**
	 * Make sure the mainKey is namespaced with the pluginID
	 * @param {object} option
	 * @returns {string}
	 */
	_namespacedMainKey(option) {
		let mainKey = this._getOptionMainKey(option);
		let pluginID = this._getOptionPluginID(option);
		if (pluginID && mainKey) {
			// Make sure the return value is valid as class name or element id
			return CSS.escape(`${pluginID}-${mainKey}`);
		}
		return mainKey;
	}

	/**
	 * Convert the option before storing, can be overridden by subclasses
	 * @param {object} option
	 * @returns {object}
	 */
	_convert(option) {
		return option;
	}

	/**
	 * Notify the receiver to update
	 */
	async _refresh(ids = [], extraData = {}) {
		if (!this._config.notifyType || this._config.notifyType === "unknown") {
			return;
		}
		this._lastUpdateID = this._generateRandomKey();
		// register(), unregister(), and refresh() call _refresh() without awaiting it, so yield
		// first to keep observers -- and the plugin hooks they call -- from running before those
		// calls return
		await Promise.resolve();
		await lazy.Zotero.Notifier.trigger(
			this._config.notifyAction,
			this._config.notifyType,
			ids,
			extraData,
		);
	}

	/**
	 * Unregister all stored options by pluginID
	 * @param {string} pluginID - PluginID
	 * @returns {Promise<string[]>} - The mainKeys of the unregistered options
	 */
	async _unregisterByPluginID(pluginID) {
		let paneIDs = Object.keys(this._optionsCache).filter(
			id => this._getOptionPluginID(this._optionsCache[id]) == pluginID);
		if (paneIDs.length === 0) {
			return [];
		}
		// Remove the registrations one by one
		paneIDs.forEach(id => this._remove(id));
		this._log(`Registrations for plugin ${pluginID} are unregistered due to shutdown`);
		await this._refresh();
		return paneIDs;
	}

	/**
	 * Ensure the plugin shutdown observer is added
	 * @returns {void}
	 */
	_addPluginShutdownObserver() {
		if (this._observerAdded) {
			return;
		}

		lazy.Zotero.Plugins.addObserver({
			shutdown: ({ id: pluginID }) => {
				this._unregisterByPluginID(pluginID);
			}
		});
		this._observerAdded = true;
	}

	_getOptionPluginID(option) {
		return option[this._config.pluginIDKeyName];
	}

	_getOptionMainKey(option) {
		return option[this._config.mainKeyName];
	}

	_generateRandomKey() {
		return `${lazy.Zotero.Utilities.randomString()}-${new Date().getTime()}`;
	}
}


/**
 * Controller-style API: plugins drive Zotero through named query/command requests whose
 * params and results are plain objects, so both sides cross the sandbox as data
 */
class ControllerAPIBase extends PluginAPIBase {
	_config = {
		apiName: "ControllerAPIBase",
	};

	/**
	 * Rejection names; an unprivileged caller sees them as the "<code>: <message>"
	 * prefix of the re-created Error
	 */
	static errorCodes = Object.freeze({
		UNKNOWN_REQUEST: "UnknownRequest",
		PERMISSION_DENIED: "PermissionDenied",
		INVALID_PARAMS: "InvalidParams",
		INVALID_RESULT: "InvalidResult",
		NOT_FOUND: "NotFound",
		NOT_ALLOWED: "NotAllowed",
		NOT_IMPLEMENTED: "NotImplemented",
	});

	/**
	 * @type {Map<string, ControllerRequestDef>}
	 */
	_queries = new Map();

	/**
	 * @type {Map<string, ControllerRequestDef>}
	 */
	_commands = new Map();

	/**
	 * Requests under `queries` and `commands` are defined as the config is set
	 * @param {ControllerAPIConfig} config
	 */
	set config(config) {
		let { queries = {}, commands = {}, ...rest } = config;
		Object.assign(this._config, rest);
		for (let [name, def] of Object.entries(queries)) {
			this._define(this._queries, name, def);
		}
		for (let [name, def] of Object.entries(commands)) {
			this._define(this._commands, name, def);
		}
	}

	/**
	 * Run a read-only request
	 * @param {string} name
	 * @param {object} [params]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<object>}
	 */
	query(name, params = {}, callerPluginID) {
		return this._invoke(this._queries, "query", name, params, callerPluginID);
	}

	/**
	 * Run a request with side effects
	 * @param {string} name
	 * @param {object} [params]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<object>}
	 */
	command(name, params = {}, callerPluginID) {
		return this._invoke(this._commands, "command", name, params, callerPluginID);
	}

	/**
	 * @returns {{ queries: string[], commands: string[] }}
	 */
	get requestNames() {
		return {
			queries: Array.from(this._queries.keys()),
			commands: Array.from(this._commands.keys()),
		};
	}

	_define(registry, name, def) {
		if (registry.has(name)) {
			throw new Error(`${this._config.apiName}: request '${name}' is already defined`);
		}
		if (typeof def.handler !== "function") {
			throw new Error(`${this._config.apiName}: request '${name}' has no handler`);
		}
		registry.set(name, Object.assign({ permissions: [], params: {} }, def));
	}

	async _invoke(registry, kind, name, params, callerPluginID) {
		let def = registry.get(name);
		if (!def) {
			this._throw(ControllerAPIBase.errorCodes.UNKNOWN_REQUEST, `Unknown ${kind} '${name}'`);
		}

		let context = this._getContext(callerPluginID);
		if (!context.privileged
				&& !lazy.VarCheck.hasPermissions(context.scope, def.permissions)) {
			this._throw(ControllerAPIBase.errorCodes.PERMISSION_DENIED,
				`${kind} '${name}' requires permission ${[].concat(def.permissions).join(", ")}`);
		}

		params = this._toPlainParams(name, params);
		let validated = this._validateParams(params, def.params);
		if (!validated.valid) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS, `Invalid params for ${kind} '${name}'`);
		}

		// An unprivileged caller's params carry its pluginID (a reserved key), as manager options do
		if (!context.privileged) {
			validated.obj.pluginID = context.pluginID;
		}

		let result = await def.handler.call(this, validated.obj, { kind, name });
		if (def.scopedResult) {
			return result;
		}
		return this._toPlainResult(name, result);
	}

	_getContext(callerPluginID) {
		let scope = callerPluginID ? lazy.PluginSandbox.getScope(callerPluginID) : null;
		return {
			pluginID: callerPluginID,
			scope,
			privileged: lazy.VarCheck.isPrivilegedScope(scope),
		};
	}

	/**
	 * Detach params from the caller's compartment; JSON drops functions and getters
	 */
	_toPlainParams(name, params) {
		if (params === undefined || params === null) {
			return {};
		}
		if (!lazy.VarCheck.isObject(params)) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS, `Params for '${name}' must be an object`);
		}
		try {
			return JSON.parse(JSON.stringify(params));
		}
		catch (e) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS,
				`Params for '${name}' must be JSON-serializable: ${e.message}`);
		}
		return {};
	}

	/**
	 * Handlers must hand back data only, so a leaked object is a bug rather than a hole
	 */
	_toPlainResult(name, result) {
		if (result === undefined) {
			return {};
		}
		if (!lazy.VarCheck.isObject(result)) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_RESULT, `Result of '${name}' must be an object`);
		}
		try {
			return JSON.parse(JSON.stringify(result));
		}
		catch (e) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_RESULT,
				`Result of '${name}' must be JSON-serializable: ${e.message}`);
		}
		return {};
	}

	/**
	 * Unknown keys are rejected before the shared validator runs
	 */
	_validateParams(params, typeDef) {
		for (let key of Object.keys(params)) {
			if (!(key in typeDef)) {
				this._log(`Unknown param '${key}'`, "warn");
				return { valid: false };
			}
		}
		return this._validateObject(params, typeDef);
	}

	/**
	 * Handler stub for catalog entries that are not implemented yet
	 */
	_notImplemented(_params, { name }) {
		this._throw(ControllerAPIBase.errorCodes.NOT_IMPLEMENTED, `'${name}' is not implemented yet`);
	}

	/**
	 * @param {string} code - One of errorCodes, set as the error's name
	 * @param {string} message
	 * @returns {Error}
	 */
	static createError(code, message) {
		let e = new Error(message);
		e.name = code;
		return e;
	}

	_throw(code, message) {
		throw ControllerAPIBase.createError(code, message);
	}
}

export { PluginAPIBase, ManagerAPIBase, ControllerAPIBase };
