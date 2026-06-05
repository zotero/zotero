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


import { PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS } from "chrome://zotero/content/xpcom/plugins/schema.mjs";

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

	getPermissionsString(permissions) {
		if (!Array.isArray(permissions)) {
			return null;
		}
		return [...permissions].toSorted().join(',');
	},

	isPrivilegedPermission(addon) {
		let permissions = addon.installPermissions.permissions;
		if (permissions.includes("*") || permissions.length === 0) {
			return true;
		}
		return false;
	},

	isPrivilegedScope(scope) {
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

		if (!this.isObject(a)) a = undefined;
		if (!this.isObject(b)) b = undefined;
		if (!a) return b;
		if (!b) return a;

		let out = { ...a };

		for (let k of Object.keys(b)) {
			let av = out[k];
			let bv = b[k];
			// Not defined in a, take from b
			if (av === undefined) {
				out[k] = bv;
				continue;
			}
			// Allowed in either schema, allowed
			if (av === true || bv === true) {
				out[k] = true;
				continue;
			}
			// Both objects, merge recursively
			if (this.isObject(av) && this.isObject(bv)) {
				out[k] = this.mergeSchema(av, bv);
				continue;
			}
			out[k] = this.isObject(bv) ? bv : av;
		}
		return out;
	},

	getPermissionSchema(permissions) {
		let schemas = [PERMISSION_SCHEMAS.default];

		for (let perm of permissions) {
			if (perm in PERMISSION_SCHEMAS) {
				schemas.push(PERMISSION_SCHEMAS[perm]);
			}
		}
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	getWindowSchema(permissions) {
		let schemas = [WINDOW_SCHEMAS.default];

		for (let perm of permissions) {
			if (perm in WINDOW_SCHEMAS) {
				schemas.push(WINDOW_SCHEMAS[perm]);
			}
		}
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	getMainWindowSchema(permissions) {
		let winSchema = this.getWindowSchema(permissions);

		let schemas = [MAIN_WINDOW_SCHEMAS.default, winSchema];
		
		for (let perm of permissions) {
			if (perm in MAIN_WINDOW_SCHEMAS) {
				schemas.push(MAIN_WINDOW_SCHEMAS[perm]);
			}
		}
		return schemas.reduce((acc, s) => this.mergeSchema(acc, s), undefined);
	},

	isAllowed(schemaNode, prop) {
		if (schemaNode === true || typeof schemaNode === "string") return true;
		if (!schemaNode || typeof schemaNode !== "object") return false;
		return Object.prototype.hasOwnProperty.call(schemaNode, prop);
	},

	nextSchema(schemaNode, prop) {
		return schemaNode === true || typeof schemaNode === "string" ? true : schemaNode[prop];
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
		let keys = Object.keys(schemaNode);
		if (allowSymbols) {
			keys.push(...Object.getOwnPropertySymbols(schemaNode).filter(s => schemaNode[s]));
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
	ensureConstructableInScope(Constructor, scope, { mutable = false, returnParser = null } = {}) {
		if (VarCheck.isSameCompartment(Constructor, scope)) {
			return Constructor;
		}
		let holder = Cu.createObjectIn(scope);

		// Must use a regular function (not arrow) so it has [[Construct]] and
		// can be called with `new` from the sandbox.  When the function returns
		// an object, `new` uses that object instead of the auto-created `this`.
		let wrapped = function (...args) {
			args = args.map(arg => Cu.waiveXrays(arg));
			let instance = Reflect.construct(Constructor, args);
			if (typeof returnParser === "function") {
				instance = returnParser(instance);
			}
			// Use strong reference for constructor-created objects since the
			// plugin owns the instance and it must not be GC'd prematurely
			return ScopeUtils.ensurePromiseVarInScope(instance, scope, { mutable, strong: true });
		};

		Cu.exportFunction(wrapped, holder, { defineAs: "f" });
		return holder.f;
	},

	/**
	 * Create a function that runs in privileged realm and scopes returns
	 */
	ensureCallableInScope(func, thisArg = undefined, scope, { mutable = false, argParser = null, returnParser = null, skipArgRescoping = false } = {}) {
		if (VarCheck.isSameCompartment(func, scope)) {
			return func;
		}
		let holder = Cu.createObjectIn(scope);
		let thisArgRef = VarCheck.isObjectLike(thisArg) ? new WeakRef(thisArg) : null;

		let wrapped = (...args) => {
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
			return ScopeUtils.ensurePromiseVarInScope(res, scope, { mutable });
		};

		Cu.exportFunction(wrapped, holder, { defineAs: "f" });
		return holder.f;
	},

	/**
	 * Ensure a potentially promise variable is safe to expose in the sandbox scope
	 * Following https://github.com/mdn/content/issues/15059#issuecomment-1198017259
	 */
	ensurePromiseVarInScope(maybePromise, scope, { mutable = false, strong = false } = {}) {
		if (VarCheck.isSameCompartment(maybePromise, scope)) {
			return maybePromise;
		}
		if (VarCheck.isPromise(maybePromise)) {
			return new scope.Promise((resolve, reject) => {
				maybePromise.then(
					v => resolve(ScopeUtils._ensureVarInScope(v, scope, { mutable, strong })),
					e => reject(e)
				);
			});
		}
		return ScopeUtils._ensureVarInScope(maybePromise, scope, { mutable, strong });
	},

	/**
	 * Ensure a variable is safely exposed in the scope.
	 * - Functions are exported as callables that scope their returns
	 * - Plain objects/arrays are cloned into the scope
	 * - Non-plain objects (class instances) are wrapped in a readonly facade with methods and getters (own and prototype) preserved
	 */
	_ensureVarInScope(value, scope, { mutable = false, strong = false } = {}) {
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

		if (Array.isArray(value)) {
			let arr = Cu.cloneInto([], scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
			arr.push(...value.map(v => ScopeUtils.ensurePromiseVarInScope(v, scope, { mutable })));
			return arr;
		}

		if (VarCheck.isPlainObject(value)) {
			return Cu.cloneInto(value, scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
		}

		return ScopeUtils._ensureInstanceInScope(value, scope, { mutable, strong });
	},

	/**
	 * Create a readonly facade for a class instance, exposing methods and getters (own and prototype)
	 */
	_ensureInstanceInScope(instance, scope, { mutable = false, strong = false } = {}) {
		if (!VarCheck.isObjectLike(instance)) return instance;

		let facade = Cu.createObjectIn(scope);
		let instanceRef = strong ? { deref: () => instance } : new WeakRef(instance);

		// Expose prototype-chain methods as privileged wrapper that calls the real method on the real instance
		let methodNames = VarCheck.getPrototypeMethodNames(instance);
		for (let name of methodNames) {
			if (name === "constructor") continue;

			let method = instance[name];
			if (typeof method !== "function") continue;

			Cu.exportFunction(
				(...args) => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", name, "object has been garbage collected");
					}
					// Make sure the args are in the same scope if the thisArg is not in the current compartment
					if (!VarCheck.isSameCompartment(inst, {})) {
						args = ScopeUtils.ensurePromiseVarInScope(args, Cu.getGlobalForObject(inst), { mutable });
					}
					let res = method.apply(inst, args);
					return ScopeUtils.ensurePromiseVarInScope(res, scope, { mutable });
				},
				facade,
				{ defineAs: name }
			);
		}

		// Expose prototype-chain getters as readonly accessors
		let getterNames = VarCheck.getPrototypeGetterNames(instance);
		for (let name of getterNames) {
			if (Object.prototype.hasOwnProperty.call(facade, name)) continue;
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => {
				let inst = instanceRef.deref();
				if (!inst) {
					VarCheck.throwPropError("access", name, "object has been garbage collected");
				}
				return ScopeUtils.ensurePromiseVarInScope(Reflect.get(inst, name), scope, { mutable });
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
			if (Object.prototype.hasOwnProperty.call(facade, name)) continue;
			let val = instance[name];
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => {
				return ScopeUtils.ensurePromiseVarInScope(val, scope, { mutable });
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
			if (Object.prototype.hasOwnProperty.call(facade, key)) continue;
			let desc = ownDescriptors[key];
			let holder = Cu.createObjectIn(scope);
			if (typeof desc.get === "function") {
				Cu.exportFunction(() => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", key, "object has been garbage collected");
					}
					return ScopeUtils.ensurePromiseVarInScope(Reflect.get(inst, key), scope, { mutable });
				}, holder, { defineAs: "g" });
			}
			else {
				Cu.exportFunction(() => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("access", key, "object has been garbage collected");
					}
					return ScopeUtils.ensurePromiseVarInScope(inst[key], scope, { mutable });
				}, holder, { defineAs: "g" });
			}

			Cu.exportFunction(
				(value) => {
					let inst = instanceRef.deref();
					if (!inst) {
						VarCheck.throwPropError("set", key, "object has been garbage collected");
					}
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
};

export { VarCheck, ScopeUtils, ORIGINAL_REF_KEY, CUSTOM_PARSER_KEY };
