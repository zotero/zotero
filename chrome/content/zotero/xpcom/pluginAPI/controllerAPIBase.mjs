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
 *     scope (see ScopeVariables.toScope); pass it through instead of the plain-data copy
 * @property {(params: object, context: ControllerRequestContext) => (object | Promise<object>)} handler
 *     - Called with the controller as `this`; must return plain data (JSON, plus bytes). For an
 *     unprivileged caller, `params.pluginID` (a reserved key) is the calling plugin
 */


import { PluginAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs";
import { ControllerError } from "chrome://zotero/content/xpcom/plugins/apiErrors.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
	PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
	VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
	ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
});


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
	static errorCodes = ControllerError.codes;

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
	 * Detach params from the caller's compartment; functions and getters are read once or dropped
	 */
	_toPlainParams(name, params) {
		if (params === undefined || params === null) {
			return {};
		}
		if (!lazy.VarCheck.isObject(params)) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS, `Params for '${name}' must be an object`);
		}
		try {
			return lazy.ScopeUtils.toPlainData(params);
		}
		catch (e) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_PARAMS,
				`Params for '${name}' must be plain data: ${e.message}`);
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
			return lazy.ScopeUtils.toPlainData(result);
		}
		catch (e) {
			this._throw(ControllerAPIBase.errorCodes.INVALID_RESULT,
				`Result of '${name}' must be plain data: ${e.message}`);
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

export { ControllerAPIBase };
