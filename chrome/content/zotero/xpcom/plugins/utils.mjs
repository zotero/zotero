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


import { SchemaKey, IMPLIED_PERMISSIONS, PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS } from "chrome://zotero/content/xpcom/plugins/schema.mjs";
import { PluginTrace } from "chrome://zotero/content/xpcom/plugins/trace.mjs";

const ORIGINAL_REF_KEY = "__zoteroOriginalRef__";

const CUSTOM_PARSER_KEY = "__zoteroCustomParser__";

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

	isElementWithinSubtree(targetElem, rootElem) {
		if (!VarCheck.isDOMNode(targetElem) || !VarCheck.isDOMNode(rootElem)) {
			return false;
		}
		try {
			return rootElem.contains(targetElem);
		}
		catch {}
		return false;
	},

	isDocumentObject(value) {
		if (!VarCheck.isObjectLike(value)) return false;
		try {
			// Document nodes have nodeType === 9
			if (value.nodeType === 9) {
				return true;
			}
		}
		catch {}
		return false;
	},

	isWindowObject(value) {
		if (!VarCheck.isObjectLike(value)) return false;
		try {
			return value.window === value;
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

	isPrivilegedScope(scope) {
		if (!scope) return true;
		// If the scope is unprivileged, it will be xrayed and thus using its properties is safe
		return scope.PERMISSIONS.includes("*");
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

		// String value with the same handler wins
		if (typeof a === "string" && typeof b === "string") return a === b ? a : a;
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
	 * Supports composite keys (e.g. "mainWindow,dataWrite") that require
	 * all listed permissions to be present.
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

	getWindowSchema(permissions) {
		let schemas = [WINDOW_SCHEMAS.default, ...this._collectSchemas(WINDOW_SCHEMAS, permissions)];
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	getMainWindowSchema(permissions) {
		let winSchema = this.getWindowSchema(permissions);
		let schemas = [MAIN_WINDOW_SCHEMAS.default, winSchema, ...this._collectSchemas(MAIN_WINDOW_SCHEMAS, permissions)];
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	isAllowed(schemaNode, prop) {
		if (schemaNode === true || typeof schemaNode === "string") return true;
		if (!schemaNode || typeof schemaNode !== "object") return false;
		if (Object.prototype.hasOwnProperty.call(schemaNode, prop)) {
			return schemaNode[prop] !== false;
		}
		if (schemaNode[SchemaKey.WILDCARD] === true) return true;
		return false;
	},

	nextSchema(schemaNode, prop) {
		if (schemaNode === true || typeof schemaNode === "string") return true;
		if (schemaNode && typeof schemaNode === "object") {
			if (Object.prototype.hasOwnProperty.call(schemaNode, prop)) {
				return schemaNode[prop];
			}
			if (schemaNode[SchemaKey.WILDCARD] === true) return true;
		}
		return undefined;
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
				.filter(k => !excluded.has(k));
		}
		let keys = Object.keys(schemaNode).filter(k => schemaNode[k] !== false);
		if (allowSymbols) {
			keys.push(...Object.getOwnPropertySymbols(schemaNode).filter(s => schemaNode[s] && schemaNode[s] !== false));
		}
		return keys;
	},

	getPrototypeMethodNames(obj, { allowSymbols = false } = {}) {
		let seen = new Set();
		let cur = obj;
		while (cur && !VarCheck._isObjectPrototype(cur)) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || VarCheck._isObjectPrototype(proto)) break;

			for (let k of Reflect.ownKeys(proto)) {
				if (!allowSymbols && typeof k === "symbol") continue;
				let desc = Object.getOwnPropertyDescriptor(proto, k);
				if (desc && typeof desc.value === "function") {
					seen.add(k);
				}
			}
			cur = proto;
		}
		return Array.from(seen);
	},

	getPrototypeGetterNames(obj, { allowSymbols = false } = {}) {
		let seen = new Set();
		let cur = obj;
		while (cur && !VarCheck._isObjectPrototype(cur)) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || VarCheck._isObjectPrototype(proto)) break;

			for (let k of Reflect.ownKeys(proto)) {
				if (!allowSymbols && typeof k === "symbol") continue;
				let desc = Object.getOwnPropertyDescriptor(proto, k);
				if (desc && typeof desc.get === "function") {
					seen.add(k);
				}
			}
			cur = proto;
		}
		return Array.from(seen);
	},

	getPrototypeValueNames(obj, { allowSymbols = false } = {}) {
		let seen = new Set();
		let cur = obj;
		while (cur && !VarCheck._isObjectPrototype(cur)) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || VarCheck._isObjectPrototype(proto)) break;

			for (let k of Reflect.ownKeys(proto)) {
				if (!allowSymbols && typeof k === "symbol") continue;
				let desc = Object.getOwnPropertyDescriptor(proto, k);
				if (desc && "value" in desc && typeof desc.value !== "function") {
					seen.add(k);
				}
			}
			cur = proto;
		}
		return Array.from(seen);
	}
};

const ScopeUtils = {

	/**
	 * Create a constructable function that runs in privileged realm and scopes returns.
	 * The returned function can be called with `new` from the sandbox scope.
	 * The constructed instance is wrapped via ensurePromiseVarInScope.
	 */
	ensureConstructableInScope(Constructor, scope, { mutable = false, returnParser = null, instanceSchema = null, trace = null } = {}) {
		if (VarCheck.isSameCompartment(Constructor, scope)) {
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
		if (VarCheck.isSameCompartment(func, scope)) {
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
			if (!skipArgRescoping && actualThisArg && !VarCheck.isSameCompartment(actualThisArg, {})) {
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
		if (VarCheck.isSameCompartment(maybePromise, scope)) {
			return maybePromise;
		}
		if (VarCheck.isPromise(maybePromise)) {
			return new scope.Promise((resolve, reject) => {
				maybePromise.then(
					v => resolve(ScopeUtils._ensureVarInScope(v, scope, { mutable, strong, instanceSchema })),
					e => reject(e)
				);
			});
		}
		return ScopeUtils._ensureVarInScope(maybePromise, scope, { mutable, strong, instanceSchema });
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
			return Cu.cloneInto(value, scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
		}

		return ScopeUtils._ensureInstanceInScope(value, scope, { mutable, strong, instanceSchema });
	},

	/**
	 * Create a readonly facade for a class instance, exposing methods and getters (own and prototype)
	 */
	_ensureInstanceInScope(instance, scope, { mutable = false, strong = false, instanceSchema = null } = {}) {
		if (!VarCheck.isObjectLike(instance)) return instance;

		function isPropertyAllowed(name) {
			if (!instanceSchema) return true;
			if (instanceSchema[SchemaKey.WILDCARD] === true) return instanceSchema[name] !== false;
			return name in instanceSchema && instanceSchema[name] !== false;
		}

		let nestedSchema = (instanceSchema && instanceSchema[SchemaKey.RECURSIVE]) ? instanceSchema : null;

		let facade = Cu.createObjectIn(scope);
		let instanceRef = strong ? { deref: () => instance } : new WeakRef(instance);

		let pluginID = scope.PLUGIN_ID;
		let instanceName = instance.constructor?.name || "Object";

		// Expose prototype-chain methods as privileged wrapper that calls the real method on the real instance
		let methodNames = VarCheck.getPrototypeMethodNames(instance);
		for (let name of methodNames) {
			if (name === "constructor") continue;
			if (!isPropertyAllowed(name)) continue;

			let method = instance[name];
			if (typeof method !== "function") continue;

			Cu.exportFunction(
				(...args) => {
					let t = PluginTrace.start();
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", name, "object has been garbage collected");
					}
					// Make sure the args are in the same scope if the thisArg is not in the current compartment
					if (!VarCheck.isSameCompartment(inst, {})) {
						args = ScopeUtils.ensurePromiseVarInScope(args, Cu.getGlobalForObject(inst), { mutable });
					}
					let res = method.apply(inst, args);
					let result = ScopeUtils.ensurePromiseVarInScope(res, scope, { mutable, instanceSchema: nestedSchema });
					PluginTrace.end(t, pluginID, "call", `${instanceName}.${name}`);
					return result;
				},
				facade,
				{ defineAs: name }
			);
		}

		// Expose prototype-chain getters as readonly accessors
		let getterNames = VarCheck.getPrototypeGetterNames(instance);
		for (let name of getterNames) {
			if (!isPropertyAllowed(name)) continue;
			if (Object.prototype.hasOwnProperty.call(facade, name)) continue;
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => {
				let inst = instanceRef.deref();
				if (!inst) {
					VarCheck.throwPropError("access", name, "object has been garbage collected");
				}
				PluginTrace.record(pluginID, "get", `${instanceName}.${name}`);
				return ScopeUtils.ensurePromiseVarInScope(Reflect.get(inst, name), scope, { mutable, instanceSchema: nestedSchema });
			}, holder, { defineAs: "g" });

			Cu.exportFunction(
				(value) => {
					if (!mutable) {
						VarCheck.throwPropError("set", name);
					}
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("set", name, "object has been garbage collected");
					}
					PluginTrace.record(pluginID, "set", `${instanceName}.${name}`);
					return Reflect.set(inst, name, value);
				},
				holder,
				{ defineAs: "s" }
			);

			Object.defineProperty(facade, name, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set: holder.s,
			});
		}

		// Expose prototype-chain value properties (non-function) as readonly
		let valueNames = VarCheck.getPrototypeValueNames(instance);
		for (let name of valueNames) {
			if (!isPropertyAllowed(name)) continue;
			if (Object.prototype.hasOwnProperty.call(facade, name)) continue;
			let val = instance[name];
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => {
				PluginTrace.record(pluginID, "get", `${instanceName}.${name}`);
				return ScopeUtils.ensurePromiseVarInScope(val, scope, { mutable, instanceSchema: nestedSchema });
			}, holder, { defineAs: "g" });

			Cu.exportFunction(
				() => {
					VarCheck.throwPropError("set", name);
				},
				holder,
				{ defineAs: "s" }
			);

			Object.defineProperty(facade, name, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set: holder.s,
			});
		}

		// Expose own enumerable data properties and getters as readonly
		let ownDescriptors = Object.getOwnPropertyDescriptors(instance);
		for (let key of Object.keys(ownDescriptors)) {
			if (!isPropertyAllowed(key)) continue;
			if (Object.prototype.hasOwnProperty.call(facade, key)) continue;
			let desc = ownDescriptors[key];
			let holder = Cu.createObjectIn(scope);
			if (typeof desc.get === "function") {
				Cu.exportFunction(() => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", key, "object has been garbage collected");
					}
					PluginTrace.record(pluginID, "get", `${instanceName}.${key}`);
					return ScopeUtils.ensurePromiseVarInScope(Reflect.get(inst, key), scope, { mutable, instanceSchema: nestedSchema });
				}, holder, { defineAs: "g" });
			}
			else {
				Cu.exportFunction(() => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", key, "object has been garbage collected");
					}
					PluginTrace.record(pluginID, "get", `${instanceName}.${key}`);
					return ScopeUtils.ensurePromiseVarInScope(inst[key], scope, { mutable, instanceSchema: nestedSchema });
				}, holder, { defineAs: "g" });
			}

			Cu.exportFunction(
				(value) => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("set", key, "object has been garbage collected");
					}
					PluginTrace.record(pluginID, "set", `${instanceName}.${key}`);
					return Reflect.set(inst, key, value);
				},
				holder,
				{ defineAs: "s" }
			);

			Object.defineProperty(facade, key, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set: holder.s,
			});
		}

		// Store a reference to the original instance for unwrapping in fromScope
		Object.defineProperty(facade, ORIGINAL_REF_KEY, {
			value: () => instanceRef.deref(),
			enumerable: false,
			configurable: false,
			writable: false,
		});

		Object.preventExtensions(facade);
		return facade;
	},

	/**
	 * Create a forwarding Proxy in the sandbox that delegates all property
	 * access to a chrome-side object.  The real object stays in chrome;
	 * the sandbox gets a Proxy whose traps are exported functions.
	 * Carries ORIGINAL_REF_KEY so _ensureVarInScope passes it through.
	 */
	ensureForwardingProxyInScope(target, scope, { mutable = false } = {}) {
		if (VarCheck.isSameCompartment(target, scope)) {
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

export { VarCheck, ScopeUtils, ORIGINAL_REF_KEY, CUSTOM_PARSER_KEY };
