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
 * What every query/command resolves with; a plugin branches on it instead of catching
 * @template T
 * @typedef {object} ControllerResponse
 * @property {boolean} success
 * @property {T | {}} result - Empty when the request failed
 * @property {{ code: string, message: string }} [error] - Only when the request failed
 *
 *
 * @typedef {object} ControllerAPIConfig
 * @property {string} apiName - Log prefix and error namespace
 * @property {Record<string, ControllerRequestDef>} [queries] - Read-only requests, defined on set
 * @property {Record<string, ControllerRequestDef>} [commands] - Requests with side effects, defined on set
 *
 *
 * @typedef {object} ControllerCaller
 * @property {string} [pluginID] - The calling plugin; unset for chrome
 * @property {boolean} privileged
 * @property {object | null} scope - The caller's sandbox scope, for permission checks
 *
 *
 * @typedef {object} ControllerRequestContext
 * @property {"query" | "command"} kind
 * @property {string} name - The request name the handler was invoked as
 * @property {ControllerCaller} caller
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


/**
 * @typedef {object} StoreAPIConfig
 * @property {string} apiName - Log prefix and error namespace
 * @property {Record<string, ControllerRequestDef>} [queries] - Read-only requests, as on a controller. Every
 *     store also gets `validate`, which dry-runs a change set, unless it defines its own
 * @property {Record<string, StoreObjectTypeDef>} objectTypes - What a change set can address, by type name
 * @property {string | string[]} [permissions] - What every commit requires; a type or operation can add to it
 * @property {(fn: () => Promise<void>) => Promise<void>} [transaction]
 *     - Runs the transactional entries of a commit; defaults to calling fn directly
 *
 *
 * @typedef {object} StoreObjectTypeDef
 * @property {string | string[]} [permissions] - Required on top of the store's for every entry of this type
 * @property {boolean} [transactional] - Whether entries run inside the store transaction (default true); the
 *     others run after it, in order, not atomically, and a failure among them leaves the earlier ones applied
 * @property {(id: number, ctx: StoreCommitContext) => (object | null | Promise<object | null>)} resolve
 *     - The live object for an ID, or null
 * @property {StoreAddressDef} address - How an entry or a reference names an existing object of this type;
 *     the store decides what an address looks like, the base only passes it through
 * @property {StoreCreateDef} [create] - How a new object is made; absent means the type cannot be created
 * @property {(target: object) => (string | number)} [revision] - The token an entry's `revision` is compared against
 * @property {(target: object) => boolean} [isEditable] - false fails the entry with NotAllowed
 * @property {(target: object, ctx: StoreCommitContext) => Promise<void>} [save] - Persist the target after its
 *     operations; also called before the first operation flagged `needsID` on a created target
 * @property {(target: object) => Promise<void>} [restore] - Drop in-memory changes after a failed commit
 * @property {(target: object) => object} describe - The result entry for a target, at least `{ id }`
 * @property {(target: object) => object} [snapshot] - For the `snapshots` commit option
 * @property {Record<string, StoreOperationDef>} operations
 *
 *
 * @typedef {object} StoreAddressDef
 * @property {string[]} fields - The entry keys that name an existing object, refused alongside `create`
 * @property {(entry: object, defaults: object, fail: StoreFail) => object} plan - The address an entry names,
 *     in any shape `resolve` understands; nothing is loaded yet
 * @property {(address: object, fail: StoreFail) => any} resolve - The id `StoreObjectTypeDef.resolve` takes
 * @property {(value: any, options: { defaults: object, scope?: any, type: string, what: string }, fail: StoreFail) => any} fromValue
 *     - The id an operation param names; the base has already handled `{ ref }`
 *
 *
 * @typedef {object} StoreFail
 * @property {(message: string) => never} invalid - Throw InvalidParams, located at the caller
 * @property {(message: string) => never} notFound - Throw NotFound, located at the caller
 *
 *
 * @typedef {object} StoreCreateDef
 * @property {Record<string, PluginAPIOptDefValue>} [params]
 * @property {(params: object, ctx: StoreCommitContext) => (object | Promise<object>)} handler - The new, unsaved target
 *
 *
 * @typedef {object} StoreOperationDef
 * @property {string | string[]} [permissions] - Required on top of the store's and the type's
 * @property {Record<string, PluginAPIOptDefValue>} [params] - Everything in the operation but `op`; unknown keys are rejected
 * @property {boolean} [terminal] - The target no longer exists afterwards (erase): no save, no later operation
 * @property {boolean} [needsID] - A created target must be saved before this runs
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (string | undefined | Promise<string | undefined>)} [check]
 *     - A reason the operation cannot apply, checked before anything changes; must not resolve refs
 * @property {(target: object, params: object, ctx: StoreCommitContext) => (void | Promise<void>)} apply
 *
 *
 * @typedef {object} StoreCommitContext
 * @property {string} [pluginID] - The calling plugin; unset for chrome
 * @property {boolean} privileged
 * @property {object} defaults - Every change set key but `changes`, for the object types to read
 * @property {Map<string, { type: string, target: object }>} refs - Objects created so far, by ref
 * @property {(type: string, value: StoreIDRef, options?: { scope?: *, what?: string }) => *} resolveID
 *     - The ID an operation names: a `{ ref }` resolves here, anything else through the type's
 *     `address.fromValue`, with `scope` as the object being edited
 *
 *
 * How an operation names another object: one this set creates, or any form the type's address accepts
 * @typedef {{ ref: string } | *} StoreIDRef
 *
 *
 * Entries apply in order, each to one object, and every key besides `changes` is a default the object
 * types read. A single entry stands for a one-entry set
 * @typedef {object} StoreChangeSet
 * @property {StoreChangeEntry[]} changes
 *
 *
 * `create` makes an object later entries reach as `{ ref }`; otherwise the type's `address.fields` name
 * an existing one
 * @typedef {object} StoreChangeEntry
 * @property {string} type - One of the store's object types
 * @property {string} [ref] - Required with `create`; unique within the change set
 * @property {object} [create] - The type's create params
 * @property {string | number} [revision] - The snapshot revision the entry was built from; a mismatch fails
 *     the whole commit with Conflict before anything is applied
 * @property {StoreOperation[]} ops
 *
 *
 * @typedef {{ op: string } & Record<string, any>} StoreOperation
 *
 *
 * @typedef {object} StoreCommitResult
 * @property {StoreObjectRef[]} objects - One per entry, in order
 *
 *
 * What the type's `describe` returns for the target, plus the store's bookkeeping
 * @typedef {object} StoreObjectRef
 * @property {string} type
 * @property {*} id
 * @property {string} [ref] - The entry's ref, for created objects
 * @property {string | number} [revision] - Absent for erased objects and types without revisions
 * @property {boolean} [erased]
 * @property {object} [snapshot] - With the `snapshots` commit option, for objects that still exist
 *
 *
 * @typedef {object} StoreIssue
 * @property {string} code - One of StoreAPIBase.errorCodes
 * @property {string} message
 * @property {StoreConflict[]} [conflicts] - For a Conflict issue
 *
 *
 * @typedef {object} StoreConflict
 * @property {number} index - The entry's position in `changes`
 * @property {string} type
 * @property {number} id
 * @property {string | number} expected
 * @property {string | number} current
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
	 * @returns {{obj?: object, valid: boolean, reason?: string}} - The validated object if valid, else why not
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
				reason: e.message,
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
 * A request failure with its response code (one of ControllerAPIBase.errorCodes) and optional JSON
 * details the response carries as `error.data`; anything else a handler throws is a bug
 */
class ControllerError extends Error {
	constructor(code, message, data) {
		super(message);
		this.name = "ControllerError";
		this.code = code;
		if (data !== undefined) {
			this.data = data;
		}
	}
}


/**
 * Controller-style API: plugins drive Zotero through named query/command requests whose
 * params and results cross the sandbox as data, and every request resolves with a ControllerResponse
 */
class ControllerAPIBase extends PluginAPIBase {
	_config = {
		apiName: "ControllerAPIBase",
	};

	/**
	 * Codes a ControllerError carries, in the order a request meets them; the last two are Zotero bugs
	 */
	static errorCodes = Object.freeze({
		// No query or command of that name
		UNKNOWN_REQUEST: "UnknownRequest",
		// The plugin lacks a manifest permission the request declares
		PERMISSION_DENIED: "PermissionDenied",
		// The call is malformed: a param fails its schema or a handler's own check
		INVALID_PARAMS: "InvalidParams",
		// A certain target necessary for the request does not exist, is not the requested type, or is invisible to the caller
		NOT_FOUND: "NotFound",
		// The caller may make the request, but Zotero forbids this action
		NOT_ALLOWED: "NotAllowed",
		// A handler returned something that is not JSON data
		INVALID_RESULT: "InvalidResult",
		// A handler threw anything but a ControllerError; logged
		INTERNAL_ERROR: "InternalError",
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
	 * @returns {Promise<ControllerResponse>}
	 */
	query(name, params = {}, callerPluginID) {
		return this._invoke(this._queries, "query", name, params, callerPluginID);
	}

	/**
	 * Run a request with side effects
	 * @param {string} name
	 * @param {object} [params]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<ControllerResponse>}
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

	_invoke(registry, kind, name, params, callerPluginID) {
		return this._respond(() => this._run(registry, kind, name, params, callerPluginID));
	}

	/**
	 * A failure is a response, not a rejection, so callers branch instead of catching
	 * @param {() => Promise<object>} fn - Produces the result, or throws
	 * @returns {Promise<ControllerResponse>}
	 */
	async _respond(fn) {
		try {
			return { success: true, result: await fn() };
		}
		catch (e) {
			return { success: false, result: {}, error: this._toResponseError(e) };
		}
	}

	/**
	 * Anything but a ControllerError is a bug, logged and reported as InternalError
	 */
	_toResponseError(e) {
		if (e instanceof ControllerError) {
			let error = { code: e.code, message: e.message };
			if (e.data !== undefined) {
				error.data = e.data;
			}
			return error;
		}
		lazy.Zotero.logError(e);
		return { code: ControllerAPIBase.errorCodes.INTERNAL_ERROR, message: String(e?.message ?? e) };
	}

	async _run(registry, kind, name, params, callerPluginID) {
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
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS,
				`Invalid params for ${kind} '${name}': ${validated.reason}`);
		}

		// An unprivileged caller's params carry its pluginID (a reserved key), as manager options do
		if (!context.privileged) {
			validated.obj.pluginID = context.pluginID;
		}

		let result = await def.handler.call(this, validated.obj, { kind, name, caller: context });
		if (def.scopedResult) {
			return result;
		}
		return this._toPlainResult(name, result);
	}

	/**
	 * @param {string} [callerPluginID]
	 * @returns {ControllerCaller}
	 */
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
				return { valid: false, reason: `Unknown param '${key}'` };
			}
		}
		return this._validateObject(params, typeDef);
	}

	/**
	 * @param {string} code - One of errorCodes
	 * @param {string} message
	 * @param {object} [data] - JSON details for the response
	 */
	_throw(code, message, data) {
		throw new ControllerError(code, message, data);
	}
}


/**
 * Store-style API: plugins read snapshots through queries, describe changes locally as a change set, and
 * commit it once; the store checks the whole set, then applies it to the live objects in one transaction
 */
class StoreAPIBase extends ControllerAPIBase {
	_config = {
		apiName: "StoreAPIBase",
		permissions: [],
		transaction: fn => fn(),
	};

	/**
	 * The controller codes plus the one outcome only a commit has
	 */
	static errorCodes = Object.freeze({
		...ControllerAPIBase.errorCodes,
		// An entry's revision no longer matches its object; nothing was applied
		CONFLICT: "Conflict",
	});

	static COMMIT_OPTIONS = Object.freeze({
		snapshots: { type: "boolean", optional: true },
	});

	/**
	 * @type {Map<string, StoreObjectTypeDef>}
	 */
	_objectTypes = new Map();

	/**
	 * Queries are defined as on a controller, plus `validate` unless the store defines one; object types
	 * under `objectTypes`. Commands are refused: every write is an operation in a change set
	 * @param {StoreAPIConfig} config
	 */
	set config(config) {
		let { objectTypes = {}, commands, ...rest } = config;
		if (commands) {
			throw new Error(`${rest.apiName || this._config.apiName}: a store has no commands; writes are change set operations`);
		}
		super.config = rest;
		if (!this._queries.has("validate")) {
			this._define(this._queries, "validate", {
				params: { changes: "object" },
				handler: ({ changes }, { caller }) => this._validate(changes, caller),
			});
		}
		for (let [type, def] of Object.entries(objectTypes)) {
			this._defineObjectType(type, def);
		}
	}

	/**
	 * @returns {Record<string, string[]>} Operation names by object type, for feature detection
	 */
	get operationNames() {
		let names = {};
		for (let [type, def] of this._objectTypes) {
			names[type] = Object.keys(def.operations);
		}
		return names;
	}

	/**
	 * Apply a change set
	 * @param {StoreChangeSet | { toJSON: () => StoreChangeSet }} changes - A change set builder or its JSON
	 * @param {{ snapshots?: boolean }} [options]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<ControllerResponse<StoreCommitResult>>}
	 */
	commit(changes, options = {}, callerPluginID) {
		return this._respond(() => this._commit(changes, options, callerPluginID));
	}

	_defineObjectType(type, def) {
		let { apiName } = this._config;
		if (this._objectTypes.has(type)) {
			throw new Error(`${apiName}: object type '${type}' is already defined`);
		}
		if (typeof def.resolve !== "function" || typeof def.describe !== "function") {
			throw new Error(`${apiName}: object type '${type}' needs resolve and describe`);
		}
		for (let hook of ["plan", "resolve", "fromValue"]) {
			if (typeof def.address?.[hook] !== "function") {
				throw new Error(`${apiName}: object type '${type}' needs address.${hook}`);
			}
		}
		let operations = {};
		for (let [name, op] of Object.entries(def.operations || {})) {
			if (typeof op.apply !== "function") {
				throw new Error(`${apiName}: operation '${type}.${name}' has no apply`);
			}
			operations[name] = Object.assign({ permissions: [], params: {} }, op);
		}
		this._objectTypes.set(type, Object.assign({ permissions: [], transactional: true }, def, { operations }));
	}

	async _commit(changes, options, callerPluginID) {
		let context = this._getContext(callerPluginID);
		// JSON.stringify serializes a builder through its toJSON
		let params = this._toPlainParams("commit", { changes, options });
		let validatedOptions = this._validateParams(params.options || {}, StoreAPIBase.COMMIT_OPTIONS);
		if (!validatedOptions.valid) {
			this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS, `Invalid commit options: ${validatedOptions.reason}`);
		}
		let { entries, defaults } = this._plan(params.changes, context);
		let ctx = this._createCommitContext(context, defaults);

		let transactional = entries.filter(entry => entry.def.transactional);
		let deferred = entries.filter(entry => !entry.def.transactional);
		// What survives a failure: entries applied outside the store transaction, or inside one that
		// committed before a later entry threw
		let applied = [];
		let failed;
		let run = async (toRun) => {
			for (let entry of toRun) {
				try {
					await this._applyEntry(entry, ctx);
				}
				catch (e) {
					failed = entry;
					throw e;
				}
				applied.push(entry);
			}
		};
		let applying = false;
		try {
			// Revisions are compared inside the transaction, so no other commit can save between the check
			// and the apply
			if (transactional.length) {
				await this._config.transaction(async () => {
					await this._resolve(entries, ctx);
					applying = true;
					await run(transactional);
				});
			}
			else {
				await this._resolve(entries, ctx);
			}
		}
		catch (e) {
			// The transaction rolled back; the live objects may still hold the changes
			if (applying) {
				await this._restore(transactional);
				applied.length = 0;
			}
			throw this._withProgress(e, entries, applied, failed);
		}
		// Types that manage their own transactions apply after the store's, in order
		try {
			await run(deferred);
		}
		catch (e) {
			throw this._withProgress(e, entries, applied, failed);
		}
		return this._describe(entries, validatedOptions.obj.snapshots);
	}

	/**
	 * Check the set before anything is loaded: addressing, operations, params, refs and permissions
	 * @param {StoreChangeSet | StoreChangeEntry} changeSet
	 * @param {ControllerCaller} context
	 * @returns {{ entries: object[], defaults: object }} The planned entries, in order, and every key of
	 *     the set but `changes`
	 */
	_plan(changeSet, context) {
		let { INVALID_PARAMS, PERMISSION_DENIED } = StoreAPIBase.errorCodes;
		let isObject = lazy.VarCheck.isObject;
		// A single entry stands for a one-entry set
		if (isObject(changeSet) && !Array.isArray(changeSet.changes) && typeof changeSet.type === "string") {
			changeSet = { changes: [changeSet] };
		}
		if (!isObject(changeSet) || !Array.isArray(changeSet.changes)) {
			this._throw(INVALID_PARAMS, "A change set must be an object with a 'changes' array");
		}
		// Everything but `changes` is a default the object types interpret; the base passes it through
		let { changes: _changes, ...defaults } = changeSet;
		let requirePermissions = (permissions, what) => {
			if (!context.privileged && !lazy.VarCheck.hasPermissions(context.scope, permissions)) {
				this._throw(PERMISSION_DENIED, `${what} requires permission ${[].concat(permissions).join(", ")}`);
			}
		};
		requirePermissions(this._config.permissions, "commit");

		let refs = new Set();
		let entries = changeSet.changes.map((entry, index) => {
			let at = `changes[${index}]`;
			if (!isObject(entry)) {
				this._throw(INVALID_PARAMS, `${at} must be an object`);
			}
			let def = this._objectTypes.get(entry.type);
			if (!def) {
				this._throw(INVALID_PARAMS, `${at}.type must be one of ${[...this._objectTypes.keys()].join(", ")}, got ${entry.type}`);
			}
			requirePermissions(def.permissions, `${at} (${entry.type})`);

			let planned = { index, type: entry.type, def, ops: [] };
			if (entry.create !== undefined) {
				if (!def.create) {
					this._throw(INVALID_PARAMS, `${at}: ${entry.type} objects cannot be created`);
				}
				if (def.address.fields.some(field => entry[field] !== undefined)) {
					this._throw(INVALID_PARAMS, `${at} cannot address an existing object and create one`);
				}
				if (typeof entry.ref !== "string" || !entry.ref) {
					this._throw(INVALID_PARAMS, `${at}.ref must be a non-empty string for a created object`);
				}
				if (refs.has(entry.ref)) {
					this._throw(INVALID_PARAMS, `${at}.ref '${entry.ref}' is used twice`);
				}
				let validated = this._validateParams(isObject(entry.create) ? entry.create : {}, def.create.params || {});
				if (!validated.valid) {
					this._throw(INVALID_PARAMS, `${at}.create: ${validated.reason}`);
				}
				refs.add(entry.ref);
				planned.ref = entry.ref;
				planned.create = validated.obj;
			}
			else if (typeof entry.ref === "string") {
				this._throw(INVALID_PARAMS, `${at}: ref '${entry.ref}' has no create block; the builder merges a ref-addressed editor into the entry creating it`);
			}
			else {
				planned.address = def.address.plan(entry, defaults, this._fail(at));
			}
			if (!planned.create && entry.revision !== undefined) {
				if (typeof entry.revision !== "string" && !Number.isInteger(entry.revision)) {
					this._throw(INVALID_PARAMS, `${at}.revision must be a string or an integer`);
				}
				planned.revision = entry.revision;
			}

			if (!Array.isArray(entry.ops)) {
				this._throw(INVALID_PARAMS, `${at}.ops must be an array`);
			}
			entry.ops.forEach((op, opIndex) => {
				let opAt = `${at}.ops[${opIndex}]`;
				if (planned.terminal) {
					this._throw(INVALID_PARAMS, `${opAt}: no operation can follow ${planned.ops.at(-1).name}`);
				}
				if (!isObject(op) || typeof op.op !== "string") {
					this._throw(INVALID_PARAMS, `${opAt} must be an object with an 'op' name`);
				}
				let opDef = def.operations[op.op];
				if (!opDef) {
					this._throw(INVALID_PARAMS, `${opAt}.op must be one of ${Object.keys(def.operations).join(", ")} for ${entry.type}, got ${op.op}`);
				}
				requirePermissions(opDef.permissions, `${opAt} (${entry.type}.${op.op})`);
				let { op: _name, ...opParams } = op;
				let validated = this._validateParams(opParams, opDef.params);
				if (!validated.valid) {
					this._throw(INVALID_PARAMS, `${opAt}: ${validated.reason}`);
				}
				planned.ops.push({ index: opIndex, name: op.op, def: opDef, params: validated.obj });
				planned.terminal = !!opDef.terminal;
			});
			return planned;
		});
		return { entries, defaults };
	}

	/**
	 * Say how far a commit got, for the entries a store does not run atomically. Nothing is attached when
	 * nothing survived, so an absent `applied` means the set had no effect
	 * @param {Error} e
	 * @param {object[]} entries - Every planned entry
	 * @param {object[]} applied - Those that completed and were not rolled back
	 * @param {object} [failed] - The one that threw
	 * @returns {Error} The same error
	 */
	_withProgress(e, entries, applied, failed) {
		if (!applied.length || !(e instanceof ControllerError)) {
			return e;
		}
		let locate = entry => ({ index: entry.index, type: entry.type, id: entry.id, ref: entry.ref });
		let done = new Set(applied);
		e.data = Object.assign({
			applied: applied.map(locate),
			failed: failed && locate(failed),
			pending: entries.filter(entry => entry !== failed && !done.has(entry)).map(locate),
		}, e.data);
		return e;
	}

	/**
	 * How an object type reports a bad address, located where the base knows the caller is
	 * @param {string} [at] - Omitted when the caller's location adds nothing, as in a one-object query
	 * @returns {StoreFail}
	 */
	_fail(at) {
		let { INVALID_PARAMS, NOT_FOUND } = StoreAPIBase.errorCodes;
		let where = at ? `${at}: ` : "";
		return {
			invalid: message => this._throw(INVALID_PARAMS, `${where}${message}`),
			notFound: message => this._throw(NOT_FOUND, `${where}${message}`),
		};
	}

	/**
	 * The one path from an address to a live target, for commit entries and read queries alike
	 * @param {string} type
	 * @param {object} address - What the type's `address.plan` returned
	 * @param {string} [at] - The caller's location, for messages
	 * @param {StoreCommitContext} [ctx]
	 * @returns {Promise<{ id: *, target: object }>} NotFound when nothing is there
	 */
	async _loadTarget(type, address, at, ctx) {
		let def = this._objectTypes.get(type);
		let id = def.address.resolve(address, this._fail(at));
		let target = await def.resolve(id, ctx);
		if (!target) {
			this._throw(StoreAPIBase.errorCodes.NOT_FOUND, `${at ? `${at}: ` : ""}no ${type} with ID ${id}`);
		}
		return { id, target };
	}

	/**
	 * @param {ControllerCaller} context
	 * @param {object} defaults - Every change set key but `changes`
	 * @returns {StoreCommitContext}
	 */
	_createCommitContext(context, defaults) {
		let { INVALID_PARAMS } = StoreAPIBase.errorCodes;
		let isObject = lazy.VarCheck.isObject;
		let refs = new Map();
		return {
			pluginID: context.pluginID,
			privileged: context.privileged,
			defaults,
			refs,
			// A ref names an object this set created; anything else is the type's own address form
			resolveID: (type, value, { scope, what = "Reference" } = {}) => {
				if (isObject(value) && typeof value.ref === "string") {
					let created = refs.get(value.ref);
					if (!created) {
						this._throw(INVALID_PARAMS, `${what}: no object created earlier in the change set has ref '${value.ref}'`);
					}
					if (created.type !== type) {
						this._throw(INVALID_PARAMS, `${what}: ref '${value.ref}' is a ${created.type}, not a ${type}`);
					}
					// The type says what its objects' IDs are; an unsaved one has none yet
					let { id } = this._objectTypes.get(created.type).describe(created.target);
					if (id === undefined || id === null || id === false) {
						this._throw(INVALID_PARAMS, `${what}: ref '${value.ref}' has no ID yet; it is saved after its own operations`);
					}
					return id;
				}
				let def = this._objectTypes.get(type);
				return def.address.fromValue(value, { defaults, scope, type, what }, this._fail(what));
			},
		};
	}

	/**
	 * Load every addressed object and run the revision and pre-condition checks before anything changes;
	 * conflicts across the whole set are reported before any operation's check, since they come first
	 */
	async _resolve(plan, ctx) {
		let { NOT_ALLOWED, CONFLICT } = StoreAPIBase.errorCodes;
		let conflicts = [];
		let existing = plan.filter(entry => !entry.create);
		for (let entry of existing) {
			let at = `changes[${entry.index}]`;
			let { id, target } = await this._loadTarget(entry.type, entry.address, at, ctx);
			entry.id = id;
			if (entry.def.isEditable && !entry.def.isEditable(target)) {
				this._throw(NOT_ALLOWED, `${at}: ${entry.type} ${entry.id} is not editable`);
			}
			if (entry.revision !== undefined && entry.def.revision) {
				let current = entry.def.revision(target);
				if (current !== entry.revision) {
					conflicts.push({ index: entry.index, type: entry.type, id: entry.id, expected: entry.revision, current });
				}
			}
			entry.target = target;
		}
		if (conflicts.length) {
			this._throw(CONFLICT,
				`${conflicts.length} object(s) changed since their snapshot: ${conflicts.map(c => `${c.type} ${c.id}`).join(", ")}`,
				{ conflicts });
		}
		// A created object's checks run once it exists
		for (let entry of existing) {
			await this._check(entry, entry.target, ctx);
		}
	}

	async _check(entry, target, ctx) {
		for (let op of entry.ops) {
			if (!op.def.check) {
				continue;
			}
			let reason = await this._callOp(entry, op, () => op.def.check(target, op.params, ctx));
			if (reason) {
				this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS,
					`changes[${entry.index}].ops[${op.index}] (${entry.type}.${op.name}): ${reason}`);
			}
		}
	}

	/**
	 * Create or take the target, run its operations, save
	 */
	async _applyEntry(entry, ctx) {
		let { def } = entry;
		let target = entry.target;
		let saved = !entry.create;
		if (entry.create) {
			target = await this._callOp(entry, null, () => def.create.handler(entry.create, ctx));
			entry.target = target;
			ctx.refs.set(entry.ref, { type: entry.type, target });
			await this._check(entry, target, ctx);
		}
		for (let op of entry.ops) {
			if (op.def.needsID && !saved) {
				await this._callOp(entry, "save", () => def.save(target, ctx));
				saved = true;
			}
			await this._callOp(entry, op, () => op.def.apply(target, op.params, ctx));
		}
		if (entry.terminal) {
			entry.erased = true;
			return;
		}
		if (def.save) {
			await this._callOp(entry, "save", () => def.save(target, ctx));
		}
	}

	/**
	 * What an entry throws while created, checked, applied or saved is the caller's bad request, since
	 * the core validates data on save; only a platform exception stays a bug
	 * @param {object} entry
	 * @param {object | "save" | null} op - The operation, "save" for the type's save, null for create
	 * @param {() => any} fn
	 */
	async _callOp(entry, op, fn) {
		try {
			return await fn();
		}
		catch (e) {
			if (e instanceof ControllerError || StoreAPIBase._isPlatformError(e)) {
				throw e;
			}
			let where = `changes[${entry.index}]`;
			if (op === "save") {
				where += ` (${entry.type} save)`;
			}
			else if (op) {
				where += `.ops[${op.index}] (${entry.type}.${op.name})`;
			}
			else {
				where += `.create (${entry.type})`;
			}
			this._throw(StoreAPIBase.errorCodes.INVALID_PARAMS, `${where}: ${e?.message ?? e}`);
		}
		return undefined;
	}

	/**
	 * XPCOM and storage failures carry an nsresult; anything the core throws about data is a plain Error
	 */
	static _isPlatformError(e) {
		return typeof e?.result === "number" || e?.name === "TimeoutError";
	}

	async _restore(entries) {
		for (let entry of entries) {
			if (entry.create || !entry.target || !entry.def.restore) {
				continue;
			}
			try {
				await entry.def.restore(entry.target);
			}
			catch (e) {
				lazy.Zotero.logError(e);
			}
		}
	}

	_describe(plan, withSnapshots) {
		let objects = plan.map((entry) => {
			let ref = Object.assign({ type: entry.type }, entry.def.describe(entry.target));
			if (entry.ref) {
				ref.ref = entry.ref;
			}
			if (entry.erased) {
				ref.erased = true;
				return ref;
			}
			if (entry.def.revision) {
				ref.revision = entry.def.revision(entry.target);
			}
			if (withSnapshots && entry.def.snapshot) {
				ref.snapshot = entry.def.snapshot(entry.target);
			}
			return ref;
		});
		return this._toPlainResult("commit", { objects });
	}

	/**
	 * The checks a commit makes before it changes anything, as data; stops at the first blocking issue.
	 * Runs outside the transaction, so a passing set can still conflict when committed
	 * @param {StoreChangeSet} changes
	 * @param {ControllerCaller} context
	 * @returns {Promise<{ issues: StoreIssue[] }>}
	 */
	async _validate(changes, context) {
		let issues = [];
		try {
			let { entries, defaults } = this._plan(changes, context);
			await this._resolve(entries, this._createCommitContext(context, defaults));
		}
		catch (e) {
			if (!(e instanceof ControllerError)) {
				throw e;
			}
			issues.push(Object.assign({ code: e.code, message: e.message }, e.data));
		}
		return { issues };
	}
}

export { PluginAPIBase, ManagerAPIBase, ControllerAPIBase, StoreAPIBase, ControllerError };
