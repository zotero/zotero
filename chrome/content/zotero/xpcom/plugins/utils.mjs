/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://www.zotero.org
	
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


import { SchemaKey, IMPLIED_PERMISSIONS, PERMISSION_SCHEMAS } from "chrome://zotero/content/xpcom/plugins/schema.mjs";
import { PluginTrace } from "chrome://zotero/content/xpcom/plugins/trace.mjs";
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";

const ORIGINAL_REF_KEY = "__zoteroOriginalRef__";

const CUSTOM_PARSER_KEY = "__zoteroCustomParser__";

const INSTANCE_PROXY_FACTORY = "__zoteroInstanceProxyFactory__";

const CHROME_GLOBAL = Cu.getGlobalForObject({});

/**
 * Cache the facades per instance - scope - rule to avoid duplication
 * The GC of the instance or scope should clear the weak map entry
 * @type {WeakMap<Object, WeakMap<Object, Map<string, Array<Object>>>>}
 */
const instanceFacadeCache = new WeakMap();
const NULL_INSTANCE_SCHEMA = Symbol("nullSchema");

/**
 * Resolve a URL to a file within the plugin, optionally relative to the plugin's
 * root, and required to have one of the given extensions.
 * @param {string} pluginID
 * @param {string} src - File URL, optionally relative to the plugin's root
 * @param {string[]} extensions - Allowed file extensions (with leading dot)
 * @returns {string | null} The absolute URL, or null if src doesn't qualify
 */
function resolvePluginFile(pluginID, src, extensions) {
	let base = PluginProtocol.getBaseURI(pluginID);
	if (!base) {
		return null;
	}
	let resolved;
	try {
		resolved = new URL(String(src ?? ""), base).href;
	}
	catch {
		return null;
	}
	if (!resolved.startsWith(base)) {
		return null;
	}
	let pathname = new URL(resolved).pathname.toLowerCase();
	if (!extensions.some(ext => pathname.endsWith(ext))) {
		return null;
	}
	return resolved;
}

/**
 * Resolve a plugin page URL (an `.html`/`.htm` file within the plugin).
 * @param {string} pluginID
 * @param {string} src - Page URL, optionally relative to the plugin's root
 * @returns {string | null} The absolute URL, or null if src doesn't qualify
 */
function resolvePluginPage(pluginID, src) {
	return resolvePluginFile(pluginID, src, [".html", ".htm"]);
}

const VarCheck = {
	isObject(v) {
		return v !== null && typeof v === "object";
	},

	isObjectLike(v) {
		return v !== null && (typeof v === "object" || typeof v === "function");
	},

	isPromise(v) {
		return this.isObjectLike(v) && typeof v.then === "function";
	},

	isXPCOMObject(v) {
		if (!this.isObject(v)) return false;
		try {
			return typeof v.QueryInterface === "function";
		}
		catch {
			return false;
		}
	},

	isPlainObject(v) {
		if (v === null || typeof v !== "object") return false;
		// Unwaive Xray waivers so prototype comparisons work correctly
		// for cross-compartment objects (e.g. Cu.waiveXrays'd sandbox objects)
		v = Cu.unwaiveXrays(v);
		let proto = Object.getPrototypeOf(v);
		if (proto === null) return true;
		return proto === Object.prototype || proto === VarCheck._getObjectPrototype(v);
	},

	// Cross-compartment safe check for Object.prototype identity
	_isObjectPrototype(v) {
		return v === Object.prototype
			|| (v !== null && typeof v === "object" && v === VarCheck._getObjectPrototype(v));
	},

	_getObjectPrototype(v) {
		return Cu.getGlobalForObject(Cu.unwaiveXrays(v)).Object.prototype;
	},

	isArrayLike(v) {
		return Array.isArray(v) || (this.isObjectLike(v) && typeof v.length === "number");
	},

	isDOMNode(value) {
		if (!this.isObjectLike(value)) return false;
		try {
			return typeof value.nodeType === "number" && typeof value.nodeName === "string";
		}
		catch {}
		return false;
	},

	isWindowObject(value) {
		if (!VarCheck.isObjectLike(value)) return false;
		try {
			return !Cu.isDeadWrapper(value) && Cu.getClassName(value, true) === "Window";
		}
		catch {}
		return false;
	},

	/**
	 * Check if a value is a Zotero DataObject or Library instance
	 */
	isDataObject(value) {
		try {
			return value instanceof Zotero.DataObject
				|| value instanceof Zotero.Library;
		}
		catch {}
		return false;
	},

	isSameCompartment(obj1, obj2) {
		// Non-objects (null, undefined, primitives) can be directly accessed across compartments
		if (!this.isObjectLike(obj1) || !this.isObjectLike(obj2)) {
			return true;
		}
		return Cu.getGlobalForObject(obj1) === Cu.getGlobalForObject(obj2);
	},

	isInChrome(value) {
		if (!this.isObjectLike(value)) return true;
		return Cu.getGlobalForObject(value) === CHROME_GLOBAL;
	},

	isInScope(value, scopeGlobal) {
		if (!this.isObjectLike(value)) return true;
		return Cu.getGlobalForObject(value) === scopeGlobal;
	},

	// Whether a window/node belongs to a page from the plugin's own origin,
	// which its sandbox holds the content principal for
	isPluginOwnContent(value, pluginID) {
		if (!pluginID) return false;
		let doc = value.document || value.ownerDocument || value;
		return doc?.nodePrincipal?.addonPolicy?.id === pluginID;
	},

	hasOriginalRef(v) {
		return this.isObjectLike(v) && typeof Cu.waiveXrays(v)[ORIGINAL_REF_KEY] === "function";
	},

	getOriginalRef(v) {
		return Cu.waiveXrays(v)[ORIGINAL_REF_KEY]();
	},

	getOriginalOrSelf(v) {
		return this.hasOriginalRef(v) ? this.getOriginalRef(v) : v;
	},

	throwPropError(op, prop = undefined, reason = undefined) {
		let p = typeof prop === "symbol" ? prop.toString() : String(prop);
		throw new Error(`Permission denied: cannot ${op}${prop === undefined ? " " : ` "${p}".`}${reason ? ` (${reason})` : ""}`);
	},

	// Only run once at scope creation. Otherwise use `scope.PERMISSIONS`
	resolvePermissions(rawPermissions) {
		if (!Array.isArray(rawPermissions)) return rawPermissions;
		let resolved = new Set(rawPermissions);
		if (resolved.size !== 0 && !resolved.has("*") && !resolved.has("default")) {
			// The default is always implied in unprivileged scopes
			resolved.add("default");
		}
		for (let perm of Object.keys(IMPLIED_PERMISSIONS)) {
			if (resolved.has(perm)) {
				for (let p of IMPLIED_PERMISSIONS[perm]) resolved.add(p);
			}
		}
		return Array.from(resolved);
	},

	getPermissionsString(permissions) {
		if (!Array.isArray(permissions)) {
			return null;
		}
		return [...permissions].toSorted().join(',');
	},

	isPrivilegedPermission(addon) {
		let permissions = this.resolvePermissions(addon.installPermissions.permissions);
		if (permissions.includes("*") || permissions.length === 0) {
			return true;
		}
		return false;
	},

	_scopeFlagsCache: new WeakMap(),

	scopeFlags(scope) {
		let flags = this._scopeFlagsCache.get(scope);
		if (flags) return flags;
		let perms = scope.PERMISSIONS;
		let permissions = new Set(perms ? Array.from(perms) : []);
		flags = {
			permissions,
			privileged: permissions.has("*"),
			dataRead: permissions.has("dataRead"),
			dataWrite: permissions.has("dataWrite"),
		};
		this._scopeFlagsCache.set(scope, flags);
		return flags;
	},

	isPrivilegedScope(scope) {
		if (!scope) return true;
		// If the scope is unprivileged, it will be xrayed and thus using its properties is safe
		return this.scopeFlags(scope).privileged;
	},

	/**
	 * @param {object} scope
	 * @param {string|string[]} required
	 * @return {boolean}
	 */
	hasPermissions(scope, required) {
		if (!required) return true;
		if (!scope) return false;
		let { permissions, privileged } = this.scopeFlags(scope);
		if (privileged) return true;
		if (permissions.size === 0) return false;
		if (typeof required === "string") {
			return permissions.has(required);
		}
		return required.every(p => permissions.has(p));
	},

	PERMISSION_MATCH_MODES: {
		HOST_PERMISSIONS: "pattern",
		PREF_PERMISSIONS: "prefix",
		INTEROP_PERMISSIONS: "exact",
	},

	/**
	 * Check if a scope has a specific permission in a named permission list.
	 * Privileged scopes always pass. Returns true if allowed, false if denied.
	 *
	 * @param {object} scope - The sandbox scope
	 * @param {string} listKey - The scope property holding the permission list (e.g. "INTEROP_PERMISSIONS")
	 * @param {string} value - The value to check against the list
	 * @param {object} [options]
	 * @param {"exact"|"prefix"|"pattern"} [options.matchMode] - "exact" for exact match, "prefix" for prefix match, "pattern" for pattern match
	 * @returns {boolean}
	 */
	checkScopePermission(scope, listKey, value, { matchMode = undefined } = {}) {
		if (!scope || this.isPrivilegedScope(scope)) {
			return true;
		}
		let allowed = scope[listKey];
		if (!allowed) {
			return false;
		}
		if (!matchMode) {
			matchMode = VarCheck.PERMISSION_MATCH_MODES[listKey] || "exact";
		}

		let list = Array.from(allowed);
		switch (matchMode) {
			case "prefix": {
				return list.some(prefix => value.startsWith(prefix));
			}
			case "pattern": {
				// Use MatchPatternSet for WebExtension-style URL pattern matching
				// (e.g. "*://*.example.com/*", "<all_urls>")
				try {
					let patterns = new MatchPatternSet(list, { restrictSchemes: false });
					return patterns.matches(value);
				}
				catch {
					return false;
				}
			}
			case "exact":
			default: {
				return list.includes(value);
			}
		}
	},

	mergeSchema(a, b) {
		// Allowed in either schema, allowed
		if (a === true || b === true) return true;
		if (a === false && b === false) return false;
		if (a === false) return b;
		if (b === false) return a;

		// String value with the same handler wins; conflicting handlers are an error
		if (typeof a === "string" && typeof b === "string") {
			if (a === b) return a;
			throw new Error(`Conflicting handlers: "${a}" vs "${b}"`);
		}
		if (typeof a === "string" && this.isObject(b) && b[SchemaKey.HANDLER] === a) return a;
		if (typeof b === "string" && this.isObject(a) && a[SchemaKey.HANDLER] === b) return b;

		if (!this.isObject(a)) a = undefined;
		if (!this.isObject(b)) b = undefined;
		if (!a) return b;
		if (!b) return a;

		if (a[SchemaKey.HANDLER] && b[SchemaKey.HANDLER]) {
			if (a[SchemaKey.HANDLER] === b[SchemaKey.HANDLER]) {
				// Merge sub-schemas if both have the same handler specified
				let out = { [SchemaKey.HANDLER]: a[SchemaKey.HANDLER] };
				if (a[SchemaKey.SCHEMA] || b[SchemaKey.SCHEMA]) {
					out[SchemaKey.SCHEMA] = this.mergeSchema(a[SchemaKey.SCHEMA] || undefined, b[SchemaKey.SCHEMA] || undefined);
				}
				return out;
			}
			else {
				throw new Error(`Conflicting handlers: "${a[SchemaKey.HANDLER]}" vs "${b[SchemaKey.HANDLER]}"`);
			}
		}

		let out = { ...a };

		for (let k of Object.keys(b)) {
			let av = out[k];
			let bv = b[k];
			// Not defined in a, take from b
			if (av === undefined) {
				out[k] = bv;
				continue;
			}
			out[k] = this.mergeSchema(av, bv);
		}
		return out;
	},

	/**
	 * Collect matching schemas from a schema map based on permissions.
	 * Composite keys (e.g. "menu,dataWrite") require all listed permissions.
	 */
	_collectSchemas(schemaMap, permissions) {
		let permSet = new Set(permissions);
		let schemas = [];
		for (let key of Object.keys(schemaMap)) {
			if (key === "default") continue;
			let parts = key.split(",");
			if (parts.every(p => permSet.has(p))) {
				schemas.push(schemaMap[key]);
			}
		}
		return schemas;
	},

	getPermissionSchema(permissions) {
		let schemas = [PERMISSION_SCHEMAS.default, ...this._collectSchemas(PERMISSION_SCHEMAS, permissions)];
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	isAllowed(schemaNode, prop) {
		if (schemaNode === true || typeof schemaNode === "string") return true;
		if (!schemaNode || typeof schemaNode !== "object") return false;
		if (Object.prototype.hasOwnProperty.call(schemaNode, prop)) {
			return schemaNode[prop] !== false;
		}
		if (schemaNode[SchemaKey.WILDCARD] === true) {
			return !this._isInternalProp(prop);
		}
		return false;
	},

	nextSchema(schemaNode, prop) {
		if (schemaNode === true || typeof schemaNode === "string") return true;
		if (schemaNode && typeof schemaNode === "object") {
			if (Object.prototype.hasOwnProperty.call(schemaNode, prop)) {
				return schemaNode[prop];
			}
			if (schemaNode[SchemaKey.WILDCARD] === true && !this._isInternalProp(prop)) {
				return true;
			}
		}
		return undefined;
	},

	_isInternalProp(prop) {
		return typeof prop === "string" && prop.startsWith("_");
	},

	schemaKey(schemaNode) {
		return schemaNode === true ? "__ALLOW_ALL__" : schemaNode;
	},

	getAllKeysIncludingPrototypes(obj, { allowSymbols = false } = {}) {
		let seen = new Set();
		let cur = obj;
		while (cur && !VarCheck._isObjectPrototype(cur)) {
			for (let k of Reflect.ownKeys(cur)) seen.add(k);
			cur = Object.getPrototypeOf(cur);
		}
		let keys = Array.from(seen);
		return allowSymbols ? keys : keys.filter(k => typeof k !== "symbol");
	},

	getAllowedKeys(obj, schemaNode, { allowSymbols = false } = {}) {
		if (schemaNode === true) return this.getAllKeysIncludingPrototypes(obj, { allowSymbols });
		if (!schemaNode || typeof schemaNode !== "object") return [];
		if (schemaNode[SchemaKey.WILDCARD] === true) {
			let excluded = new Set(
				Object.keys(schemaNode).filter(k => schemaNode[k] === false)
			);
			return this.getAllKeysIncludingPrototypes(obj, { allowSymbols })
				.filter(k => !excluded.has(k)
					// Internal/underscore-prefixed members are never exposed by
					// a wildcard unless the schema explicitly lists them
					&& (Object.prototype.hasOwnProperty.call(schemaNode, k)
						|| !this._isInternalProp(k)));
		}
		let keys = Object.keys(schemaNode).filter(k => schemaNode[k] !== false);
		if (allowSymbols) {
			keys.push(...Object.getOwnPropertySymbols(schemaNode).filter(s => schemaNode[s] && schemaNode[s] !== false));
		}
		return keys;
	},

	_prototypeMemberCache: new WeakMap(),

	/**
	 * Walk obj's prototype chain once and categorize each member into
	 * { methods, getters, values }. Caches for subsequent calls on the same prototype.
	 */
	getPrototypeMembers(obj, { allowSymbols = false } = {}) {
		let firstProto = this.isObjectLike(obj) ? Object.getPrototypeOf(obj) : null;
		let canCache = !allowSymbols && firstProto !== null && typeof firstProto === "object";
		if (canCache) {
			let cached = this._prototypeMemberCache.get(firstProto);
			if (cached) return cached;
		}

		let methods = new Set();
		let getters = new Set();
		let values = new Set();
		let cur = obj;
		while (cur && !VarCheck._isObjectPrototype(cur)) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || VarCheck._isObjectPrototype(proto)) break;

			for (let k of Reflect.ownKeys(proto)) {
				if (!allowSymbols && typeof k === "symbol") continue;
				let desc = Object.getOwnPropertyDescriptor(proto, k);
				if (!desc) continue;
				if (typeof desc.value === "function") {
					methods.add(k);
				}
				else if (typeof desc.get === "function") {
					getters.add(k);
				}
				else if ("value" in desc) {
					values.add(k);
				}
			}
			cur = proto;
		}

		let result = {
			methods: Array.from(methods),
			getters: Array.from(getters),
			values: Array.from(values),
		};
		if (canCache) {
			this._prototypeMemberCache.set(firstProto, result);
		}
		return result;
	},

	getPrototypeMethodNames(obj, opts) {
		return this.getPrototypeMembers(obj, opts).methods;
	},

	getPrototypeGetterNames(obj, opts) {
		return this.getPrototypeMembers(obj, opts).getters;
	},

	getPrototypeValueNames(obj, opts) {
		return this.getPrototypeMembers(obj, opts).values;
	}
};

const ScopeUtils = {

	/**
	 * Build a forwarding-Proxy facade in `scope` from a traps object (get / set /
	 * has / ownKeys / getOwnPropertyDescriptor / deleteProperty / defineProperty).
	 */
	buildInstanceProxy(scope, traps) {
		return scope[INSTANCE_PROXY_FACTORY](traps);
	},

	/**
	 * Create a constructable function that runs in privileged realm and scopes returns.
	 * The returned function can be called with `new` from the sandbox scope.
	 * The constructed instance is wrapped via ensurePromiseVarInScope.
	 */
	ensureConstructableInScope(Constructor, scope, { mutable = false, returnParser = null, instanceSchema = null, trace = null } = {}) {
		if (VarCheck.isInScope(Constructor, scope)) {
			return Constructor;
		}
		let holder = Cu.createObjectIn(scope);

		// Must use a regular function (not arrow) so it has [[Construct]] and
		// can be called with `new` from the sandbox.  When the function returns
		// an object, `new` uses that object instead of the auto-created `this`.
		let wrapped = function (...args) {
			let t = trace && PluginTrace.start();
			args = args.map(arg => Cu.waiveXrays(arg));
			let instance = Reflect.construct(Constructor, args);
			if (typeof returnParser === "function") {
				instance = returnParser(instance);
			}
			// Use strong reference for constructor-created objects since the
			// plugin owns the instance and it must not be GC'd prematurely
			let result = ScopeUtils.ensurePromiseVarInScope(instance, scope, { mutable, strong: true, instanceSchema });
			PluginTrace.end(t, trace?.pluginID, "construct", trace?.path);
			return result;
		};

		Cu.exportFunction(wrapped, holder, { defineAs: "f" });
		return holder.f;
	},

	/**
	 * Create a function that runs in privileged realm and scopes returns
	 */
	ensureCallableInScope(func, thisArg = undefined, scope, { mutable = false, argParser = null, returnParser = null, skipArgRescoping = false, instanceSchema = null, trace = null } = {}) {
		if (VarCheck.isInScope(func, scope)) {
			return func;
		}
		let holder = Cu.createObjectIn(scope);
		let thisArgRef = VarCheck.isObjectLike(thisArg) ? new WeakRef(thisArg) : null;

		let wrapped = (...args) => {
			let t = trace && PluginTrace.start();
			args = args.map(arg => Cu.waiveXrays(arg));
			if (typeof argParser === "function") {
				args = argParser(args);
				// argParser returning null signals the call should be blocked
				if (args === null) return undefined;
			}
			let actualThisArg = thisArgRef ? thisArgRef.deref() : thisArg;
			if (thisArgRef && !actualThisArg) {
				VarCheck.throwPropError("access", "this", "object has been garbage collected");
			}
			// Make sure the args are in the same scope if the thisArg is not in the current compartment
			if (!skipArgRescoping && actualThisArg && !VarCheck.isInChrome(actualThisArg)) {
				args = ScopeUtils.ensurePromiseVarInScope(args, Cu.getGlobalForObject(actualThisArg), { mutable });
			}
			let res = func.apply(actualThisArg, args);
			if (typeof returnParser === "function") {
				res = returnParser(res);
			}
			let result = ScopeUtils.ensurePromiseVarInScope(res, scope, { mutable, instanceSchema });
			PluginTrace.end(t, trace?.pluginID, "call", trace?.path);
			return result;
		};

		Cu.exportFunction(wrapped, holder, { defineAs: "f" });
		return holder.f;
	},

	/**
	 * Ensure a potentially promise variable is safe to expose in the sandbox scope
	 * Following https://github.com/mdn/content/issues/15059#issuecomment-1198017259
	 */
	ensurePromiseVarInScope(maybePromise, scope, { mutable = false, strong = false, instanceSchema = null } = {}) {
		if (VarCheck.isInScope(maybePromise, scope)) {
			return maybePromise;
		}
		if (VarCheck.isPromise(maybePromise)) {
			return new scope.Promise((resolve, reject) => {
				maybePromise.then(
					(v) => {
						// If the resolved value can't be mirrored into the scope,
						// reject rather than leaving the scope promise pending forever
						try {
							resolve(ScopeUtils._ensureVarInScope(v, scope, { mutable, strong, instanceSchema }));
						}
						catch (e) {
							reject(ScopeUtils.ensureErrorInScope(e, scope));
						}
					},
					e => reject(ScopeUtils.ensureErrorInScope(e, scope))
				);
			});
		}
		return ScopeUtils._ensureVarInScope(maybePromise, scope, { mutable, strong, instanceSchema });
	},

	/**
	 * Ensure a rejection value can cross into the scope. Chrome-side Error
	 * objects would otherwise reach unprivileged scopes as non-unwrappable
	 * opaque wrappers, so re-create the error in the target scope.
	 */
	ensureErrorInScope(e, scope) {
		if (!VarCheck.isObjectLike(e)) {
			return e;
		}
		if (VarCheck.isInScope(e, scope)) {
			return e;
		}
		let message;
		try {
			if (e.message || e.name) {
				message = `${e.name && e.name !== "Error" ? e.name + ": " : ""}${e.message || ""}`;
			}
			// Non-Error rejection values (e.g. plain data objects) would
			// otherwise stringify to a useless "[object Object]"
			else {
				try {
					message = JSON.stringify(e);
				}
				catch {}
				if (!message || message === "{}") {
					message = String(e);
				}
			}
		}
		catch {
			message = "Unknown error";
		}
		try {
			// Structured clone supports Error objects and preserves the message
			return Cu.cloneInto(new Error(message), scope);
		}
		catch {}
		try {
			let makeError = Cu.evalInSandbox("(msg => new Error(msg))", scope);
			return makeError(message);
		}
		catch {}
		return message;
	},

	/**
	 * Ensure a variable is safely exposed in the scope.
	 * - Functions are exported as callables that scope their returns
	 * - Plain objects/arrays are cloned into the scope
	 * - Non-plain objects (class instances) are wrapped in a readonly facade with methods and getters (own and prototype) preserved
	 */
	_ensureVarInScope(value, scope, { mutable = false, strong = false, instanceSchema = null } = {}) {
		if (typeof value === "function") {
			// If the function has own prototype properties beyond 'constructor',
			// it's meant to be used as a constructor (e.g. ProgressWindow.ItemProgress)
			if (value.prototype
				&& Object.getOwnPropertyNames(value.prototype).some(n => n !== "constructor")) {
				return ScopeUtils.ensureConstructableInScope(value, scope, { mutable });
			}
			return ScopeUtils.ensureCallableInScope(value, null, scope);
		}

		if (!VarCheck.isObjectLike(value)) return value;

		if (VarCheck.hasOriginalRef(value)) {
			return value;
		}

		// Privileged windows and DOM nodes never cross into a sandbox --
		// only nodes from the plugin's own same-origin pages pass through
		if (VarCheck.isWindowObject(value) || VarCheck.isDOMNode(value)) {
			if (VarCheck.isPluginOwnContent(value, scope.PLUGIN_ID)) {
				return value;
			}
			return undefined;
		}

		// Nor do live data objects; see Zotero.DataStore
		if (VarCheck.isDataObject(value) && !VarCheck.isPrivilegedScope(scope)) {
			return undefined;
		}

		if (Array.isArray(value)) {
			let arr = Cu.cloneInto([], scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
			arr.push(...value.map(v => ScopeUtils.ensurePromiseVarInScope(v, scope, { mutable, instanceSchema })));
			return arr;
		}

		// Binary data (ArrayBuffer, typed arrays, DataView): structured-clone
		if (Cu.getClassName(value, true) === "ArrayBuffer" || ArrayBuffer.isView(value)) {
			return Cu.cloneInto(value, scope);
		}

		// XPCOM objects get a blank wrapper to avoid leaking
		if (VarCheck.isXPCOMObject(value)) {
			return Cu.cloneInto({}, scope);
		}

		if (VarCheck.isPlainObject(value)) {
			let obj = Cu.createObjectIn(scope);
			for (let key of Object.keys(value)) {
				Object.defineProperty(obj, key, {
					value: ScopeUtils.ensurePromiseVarInScope(value[key], scope, { mutable, instanceSchema }),
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}
			return obj;
		}

		return ScopeUtils._ensureInstanceInScope(value, scope, { mutable, strong, instanceSchema });
	},

	/**
	 * Create a readonly facade for a class instance, exposing methods and getters (own and prototype)
	 */
	_ensureInstanceInScope(instance, scope, { mutable = false, strong = false, instanceSchema = null } = {}) {
		if (!VarCheck.isObjectLike(instance)) return instance;

		let variantMap, variantMode;
		// Reuse cached facade if exists
		if (!strong) {
			let perInstance = instanceFacadeCache.get(instance);
			if (!perInstance) {
				perInstance = new WeakMap();
				instanceFacadeCache.set(instance, perInstance);
			}
			let perScope = perInstance.get(scope);
			if (!perScope) {
				// Two weak maps already guarantee the instance and scope are alive,
				// thus the inner map stores strong ref to make sure the facade isn't GC'd.
				perScope = new Map();
				perInstance.set(scope, perScope);
			}
			let variantSchema = instanceSchema || NULL_INSTANCE_SCHEMA;
			variantMode = mutable ? 1 : 0;
			variantMap = perScope.get(variantSchema);
			if (!variantMap) {
				variantMap = [];
				perScope.set(variantSchema, variantMap);
			}
			let cachedFacade = variantMap[variantMode];
			if (cachedFacade && !Cu.isDeadWrapper(cachedFacade)) {
				return cachedFacade;
			}
		}

		function isPropertyAllowed(name) {
			let present = !!instanceSchema && typeof name === "string"
				&& Object.prototype.hasOwnProperty.call(instanceSchema, name);
			// Internal/underscore-prefixed members are never exposed unless a
			// schema explicitly lists them (kills _saveData/_updateFeed/etc.).
			if (!present && typeof name === "string" && name.startsWith("_")) {
				return false;
			}
			if (!instanceSchema) return true;
			let node = instanceSchema[name];
			if (node === false) return false;
			// Allowlist schemas (no wildcard) only expose listed members.
			if (instanceSchema[SchemaKey.WILDCARD] !== true && !present) return false;
			// Additional permissions (SchemaKey.REQUIRE)
			if (present && VarCheck.isObject(node) && node[SchemaKey.REQUIRE]
					&& !VarCheck.hasPermissions(scope, node[SchemaKey.REQUIRE])) {
				return false;
			}
			return true;
		}

		let nestedSchema = (instanceSchema && instanceSchema[SchemaKey.RECURSIVE]) ? instanceSchema : null;
		let instanceRef = strong ? { deref: () => instance } : new WeakRef(instance);
		let pluginID = scope.PLUGIN_ID;
		let instanceName = instance.constructor?.name || "Object";

		// The closed set of exposed members by category, priority
		// method > getter > value > own, `constructor` excluded, schema-filtered.
		let protoMembers = VarCheck.getPrototypeMembers(instance);
		let categories = new Map();
		for (let name of protoMembers.methods) {
			if (name === "constructor") continue;
			if (isPropertyAllowed(name)) categories.set(name, "method");
		}
		for (let name of protoMembers.getters) {
			if (!categories.has(name) && isPropertyAllowed(name)) categories.set(name, "getter");
		}
		for (let name of protoMembers.values) {
			if (!categories.has(name) && isPropertyAllowed(name)) categories.set(name, "value");
		}
		for (let name of Object.getOwnPropertyNames(instance)) {
			if (!categories.has(name) && isPropertyAllowed(name)) categories.set(name, "own");
		}

		function derefOrThrow(op, prop) {
			let inst = instanceRef.deref();
			if (!inst) {
				VarCheck.throwPropError(op, prop, "object has been garbage collected");
			}
			return inst;
		}

		// Lazy build and cache callable wrapper that runs the real method on the live instance.
		// Arguments rescoped into the instance's compartment.
		// Result wrapped under the nested schema.
		let methodCache = new Map();
		function methodWrapper(name) {
			let inst = derefOrThrow("access", name);
			let method = inst[name];
			if (typeof method !== "function") return undefined;
			let cached = methodCache.get(name);
			if (cached && cached.method === method) return cached.wrapped;
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction((...args) => {
				let t = PluginTrace.start();
				let obj = derefOrThrow("access", name);
				if (!VarCheck.isInChrome(obj)) {
					args = ScopeUtils.ensurePromiseVarInScope(args, Cu.getGlobalForObject(obj), { mutable });
				}
				let res = method.apply(obj, args);
				let result = ScopeUtils.ensurePromiseVarInScope(res, scope, { mutable, instanceSchema: nestedSchema });
				PluginTrace.end(t, pluginID, "call", `${instanceName}.${name}`);
				return result;
			}, holder, { defineAs: "f" });
			methodCache.set(name, { method, wrapped: holder.f });
			return holder.f;
		}

		let origRef = () => instanceRef.deref();

		let traps = Cu.createObjectIn(scope);

		Cu.exportFunction((_facade, prop) => {
			if (prop === ORIGINAL_REF_KEY) return origRef;
			// Never expose symbols or `then` (so the facade isn't taken for a thenable).
			if (typeof prop === "symbol" || prop === "then") return undefined;
			let category = categories.get(prop);
			if (!category) return undefined;
			if (category === "method") return methodWrapper(prop);
			let inst = derefOrThrow("access", prop);
			PluginTrace.record(pluginID, "get", `${instanceName}.${prop}`);
			return ScopeUtils.ensurePromiseVarInScope(Reflect.get(inst, prop), scope, { mutable, instanceSchema: nestedSchema });
		}, traps, { defineAs: "get" });

		Cu.exportFunction((_facade, prop, value) => {
			let category = categories.get(prop);
			// Own properties are writable; prototype getters only when `mutable`;
			// value props, methods and unknown names are read-only.
			if (category === "own" || (category === "getter" && mutable)) {
				let inst = derefOrThrow("set", prop);
				PluginTrace.record(pluginID, "set", `${instanceName}.${prop}`);
				Reflect.set(inst, prop, value);
				return true;
			}
			VarCheck.throwPropError("set", typeof prop === "symbol" ? undefined : prop);
			return false;
		}, traps, { defineAs: "set" });

		Cu.exportFunction((_facade, prop) => {
			return prop === ORIGINAL_REF_KEY || categories.has(prop);
		}, traps, { defineAs: "has" });

		Cu.exportFunction(() => {
			let keys = Array.from(categories.keys());
			keys.push(ORIGINAL_REF_KEY);
			return Cu.cloneInto(keys, scope);
		}, traps, { defineAs: "ownKeys" });

		Cu.exportFunction((_facade, prop) => {
			// configurable:true is required by the Proxy invariant because the
			// target has no such key; deletion and redefinition are still blocked
			// by the deleteProperty/defineProperty traps. Reads go through the get
			// trap, so the descriptor carries no value.
			if (prop === ORIGINAL_REF_KEY) {
				let d = Cu.createObjectIn(scope);
				d.enumerable = false; d.configurable = true; d.writable = false; d.value = origRef;
				return d;
			}
			let category = categories.get(prop);
			if (!category) return undefined;
			let d = Cu.createObjectIn(scope);
			d.enumerable = true;
			d.configurable = true;
			d.writable = category === "own" || (category === "getter" && mutable);
			d.value = undefined;
			return d;
		}, traps, { defineAs: "getOwnPropertyDescriptor" });

		Cu.exportFunction((_facade, prop) => {
			// Exposed members and the original-ref key cannot be deleted.
			return !(categories.has(prop) || prop === ORIGINAL_REF_KEY);
		}, traps, { defineAs: "deleteProperty" });

		// Properties cannot be added or redefined.
		Cu.exportFunction(() => false, traps, { defineAs: "defineProperty" });

		let facade = ScopeUtils.buildInstanceProxy(scope, traps);

		if (variantMap) {
			variantMap[variantMode] = facade;
		}
		return facade;
	},

	/**
	 * Create a forwarding Proxy in the sandbox that delegates all property
	 * access to a chrome-side object.  The real object stays in chrome;
	 * the sandbox gets a Proxy whose traps are exported functions.
	 * Carries ORIGINAL_REF_KEY so _ensureVarInScope passes it through.
	 */
	ensureForwardingProxyInScope(target, scope, { mutable = false } = {}) {
		if (VarCheck.isInScope(target, scope)) {
			return target;
		}

		let traps = Cu.createObjectIn(scope);

		Cu.exportFunction(function (_facade, prop) {
			if (typeof prop === "symbol") return undefined;
			if (prop === "then") return undefined;
			if (prop === ORIGINAL_REF_KEY) return traps._origRef;
			let value;
			try {
				value = Reflect.get(target, prop);
			}
			catch {
				return undefined;
			}
			if (value === undefined || value === null) return value;
			if (typeof value !== "object" && typeof value !== "function") {
				return value;
			}
			if (typeof value === "function") {
				return ScopeUtils.ensureCallableInScope(value, target, scope, { mutable });
			}
			return ScopeUtils.ensurePromiseVarInScope(value, scope, { mutable });
		}, traps, { defineAs: "get" });

		Cu.exportFunction(function (_facade, prop) {
			if (typeof prop === "symbol") return false;
			if (prop === ORIGINAL_REF_KEY) return true;
			try {
				return Reflect.has(target, prop);
			}
			catch {
				return false;
			}
		}, traps, { defineAs: "has" });

		Cu.exportFunction(function (_facade, prop, value) {
			if (typeof prop === "symbol") return false;
			if (!mutable) {
				VarCheck.throwPropError("set", prop);
			}
			try {
				return Reflect.set(target, prop, Cu.waiveXrays(value));
			}
			catch {
				return false;
			}
		}, traps, { defineAs: "set" });

		Cu.exportFunction(function () {
			return target;
		}, traps, { defineAs: "_origRef" });

		let makeProxy = Cu.evalInSandbox(
			`(function(t) { return new Proxy({}, { get: t.get, has: t.has, set: t.set }); })`,
			scope
		);
		return makeProxy(traps);
	},
};

export { VarCheck, ScopeUtils, ORIGINAL_REF_KEY, CUSTOM_PARSER_KEY, INSTANCE_PROXY_FACTORY, resolvePluginFile, resolvePluginPage };
