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
 * What every request resolves with; a plugin branches on it instead of catching
 * @template T
 * @typedef {object} APIResponse
 * @property {boolean} success
 * @property {T | {}} result - Empty when the request failed
 * @property {{ code: string, message: string }} [error] - Only when the request failed
 *
 *
 * @typedef {object} RequestAPIConfig
 * @property {string} apiName - Log prefix and error namespace
 * @property {string | string[]} [permissions] - What every request of this API requires, on top of a request's
 *     own; the schema already hides methods from a plugin, this holds for calls made on its behalf
 * @property {Record<string, RequestDef>} [queries] - Read-only requests, defined on set
 *
 *
 * @typedef {object} RequestCaller
 * @property {string} [pluginID] - The calling plugin; unset for chrome
 * @property {boolean} privileged
 * @property {object | null} scope - The caller's sandbox scope, for permission checks
 *
 *
 * @typedef {object} RequestContext
 * @property {"query" | "command"} kind
 * @property {string} name - The request name the handler was invoked as
 * @property {RequestCaller} caller
 *
 *
 * @typedef {object} RequestDef
 * @property {string | string[]} [permissions] - Permissions the caller must hold on top of the
 *     one that exposed the API method
 * @property {Record<string, PluginAPIOptDefValue>} [params]
 *     - Type definition for the params object; unknown keys are rejected
 * @property {boolean} [scopedResult] - The handler already made its result safe for the caller's
 *     scope (see ScopeVariables.toScope); pass it through instead of the plain-data copy
 * @property {(params: object, context: RequestContext) => (object | Promise<object>)} handler
 *     - Called with the API as `this`; must return plain data (JSON, plus bytes). For an
 *     unprivileged caller, `params.pluginID` (a reserved key) is the calling plugin
 */


import { PluginAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs";
import { PluginRequestError } from "chrome://zotero/content/xpcom/plugins/apiErrors.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
	PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
	VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
	ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
	PluginTrace: "chrome://zotero/content/xpcom/plugins/trace.mjs",
});


/**
 * What controllers and stores share: plugins ask through named requests whose params and results cross the
 * sandbox as data, each resolving with an APIResponse. Queries live here; controllers add commands, stores commits
 */
class RequestAPIBase extends PluginAPIBase {
	_config = {
		apiName: "RequestAPIBase",
		permissions: [],
	};

	/**
	 * Codes a PluginRequestError carries, in the order a request meets them; the last two are Zotero bugs
	 */
	static errorCodes = PluginRequestError.codes;

	/**
	 * @type {Map<string, RequestDef>}
	 */
	_queries = new Map();

	/**
	 * Requests under `queries` are defined as the config is set
	 * @param {RequestAPIConfig} config
	 */
	set config(config) {
		let { queries = {}, ...rest } = config;
		Object.assign(this._config, rest);
		for (let [name, def] of Object.entries(queries)) {
			this._define(this._queries, name, def);
		}
	}

	/**
	 * Run a read-only request
	 * @param {string} name
	 * @param {object} [params]
	 * @param {string} [callerPluginID] - Injected for sandbox callers; omitted by chrome
	 * @returns {Promise<APIResponse>}
	 */
	query(name, params = {}, callerPluginID) {
		return this._invoke(this._queries, "query", name, params, callerPluginID);
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
		return this._respond(() => this._run(registry, kind, name, params, callerPluginID), callerPluginID, kind, name);
	}

	/**
	 * A failure is a response, not a rejection, so callers branch instead of catching; a sandbox caller's
	 * request is traced by name, timed to its response
	 * @param {() => Promise<object>} fn - Produces the result, or throws
	 * @param {string} [callerPluginID]
	 * @param {string} [kind] - query, command or commit
	 * @param {string} [name] - The query or command name
	 * @returns {Promise<APIResponse>}
	 */
	async _respond(fn, callerPluginID, kind, name) {
		let t = callerPluginID ? lazy.PluginTrace.start() : 0;
		let response;
		try {
			response = { success: true, result: await fn() };
		}
		catch (e) {
			response = { success: false, result: {}, error: this._toResponseError(e) };
		}
		if (t) {
			let path = `Zotero.${this._config.apiName}.${name ? `${kind}:${name}` : kind}`;
			lazy.PluginTrace.end(t, callerPluginID, "call", path, response.error?.code);
		}
		return response;
	}

	/**
	 * Anything but a PluginRequestError is a bug, logged and reported as InternalError
	 */
	_toResponseError(e) {
		if (e instanceof PluginRequestError) {
			let error = { code: e.code, message: e.message };
			if (e.data !== undefined) {
				error.data = e.data;
			}
			return error;
		}
		lazy.Zotero.logError(e);
		return { code: RequestAPIBase.errorCodes.INTERNAL_ERROR, message: String(e?.message ?? e) };
	}

	async _run(registry, kind, name, params, callerPluginID) {
		let def = registry.get(name);
		if (!def) {
			this._throw(RequestAPIBase.errorCodes.UNKNOWN_REQUEST, `Unknown ${kind} '${name}'`);
		}

		let context = this._getContext(callerPluginID);
		let permissions = [].concat(this._config.permissions, def.permissions);
		if (!context.privileged && !lazy.VarCheck.hasPermissions(context.scope, permissions)) {
			this._throw(RequestAPIBase.errorCodes.PERMISSION_DENIED,
				`${kind} '${name}' requires permission ${permissions.join(", ")}`);
		}

		params = this._toPlainParams(name, params);
		let validated = this._validateParams(params, def.params);
		if (!validated.valid) {
			this._throw(RequestAPIBase.errorCodes.INVALID_PARAMS,
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
	 * @returns {RequestCaller}
	 */
	_getContext(callerPluginID) {
		let scope = callerPluginID ? lazy.PluginSandbox.getScope(callerPluginID) : null;
		// A caller named but not loaded is an unloaded plugin, not chrome
		if (callerPluginID && !scope) {
			this._throw(RequestAPIBase.errorCodes.PERMISSION_DENIED, `Plugin ${callerPluginID} is not loaded`);
		}
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
			this._throw(RequestAPIBase.errorCodes.INVALID_PARAMS, `Params for '${name}' must be an object`);
		}
		try {
			return lazy.ScopeUtils.toPlainData(params);
		}
		catch (e) {
			this._throw(RequestAPIBase.errorCodes.INVALID_PARAMS,
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
			this._throw(RequestAPIBase.errorCodes.INVALID_RESULT, `Result of '${name}' must be an object`);
		}
		try {
			return lazy.ScopeUtils.toPlainData(result);
		}
		catch (e) {
			this._throw(RequestAPIBase.errorCodes.INVALID_RESULT,
				`Result of '${name}' must be plain data: ${e.message}`);
		}
		return {};
	}

	/**
	 * Unknown keys are rejected before the shared validator runs
	 */
	_validateParams(params, typeDef) {
		for (let key of Object.keys(params)) {
			if (!Object.hasOwn(typeDef, key)) {
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
		throw new PluginRequestError(code, message, data);
	}
}

export { RequestAPIBase };
