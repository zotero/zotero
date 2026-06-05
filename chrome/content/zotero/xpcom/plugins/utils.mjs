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


import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { PERMISSION_SCHEMAS } from "chrome://zotero/content/xpcom/plugins/schema.mjs";

const lazy = XPCOMUtils.declareLazy({
	ConsoleAPI: "resource://gre/modules/Console.sys.mjs",
});

const Utils = {
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
		let proto = Object.getPrototypeOf(v);
		return proto === Object.prototype || proto === null;
	},

	throwPropError(op, prop) {
		let p = typeof prop === "symbol" ? prop.toString() : String(prop);
		throw new Error(`Permission denied: cannot ${op}${prop === undefined ? "" : ` "${p}"`}`);
	},

	getPermissionsString(permissions) {
		return [...permissions].toSorted().join(',');
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

	isAllowed(schemaNode, prop) {
		if (schemaNode === true) return true;
		if (!schemaNode || typeof schemaNode !== "object") return false;
		return Object.prototype.hasOwnProperty.call(schemaNode, prop);
	},

	nextSchema(schemaNode, prop) {
		return schemaNode === true ? true : schemaNode[prop];
	},

	schemaKey(schemaNode) {
		return schemaNode === true ? "__ALLOW_ALL__" : schemaNode;
	},

	getAllKeysIncludingPrototypes(obj, { allowSymbols = false } = {}) {
		let seen = new Set();
		let cur = obj;
		while (cur && cur !== Object.prototype) {
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
		while (cur && cur !== Object.prototype) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || proto === Object.prototype) break;

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
		while (cur && cur !== Object.prototype) {
			let proto = Object.getPrototypeOf(cur);
			if (!proto || proto === Object.prototype) break;

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
	}
};

const ScopeUtils = {

	/**
	 * Ensure a potentially promise variable is safe to expose in the sandbox scope
	 * Following https://github.com/mdn/content/issues/15059#issuecomment-1198017259
	 */
	ensurePromiseVarInScope(maybePromise, scope) {
		if (Utils.isPromise(maybePromise)) {
			return new scope.Promise((resolve, reject) => {
				maybePromise.then(
					v => resolve(this.ensureVarInScope(v, scope)),
					e => reject(e)
				);
			});
		}
		return this.ensureVarInScope(maybePromise, scope);
	},

	/**
	 * Ensure a variable is safely exposed in the scope. Always use `ensurePromiseVarInScope`
	 * - Functions are exported as callables that scope their returns
	 * - Plain objects/arrays are cloned into the scope
	 * - Non-plain objects (class instances) are wrapped in a readonly facade with methods and getters (own and prototype) preserved
	 */
	ensureVarInScope(value, scope) {
		if (typeof value === "function") {
			return this.ensureCallableInScope(value, null, scope);
		}

		if (!Utils.isObjectLike(value)) return value;

		if (Utils.isPlainObject(value) || Array.isArray(value)) {
			return Cu.cloneInto(value, scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
		}

		return this.ensureInstanceInScope(value, scope);
	},

	/**
	 * Create a function that runs in privileged realm and scopes returns
	 */
	ensureCallableInScope(func, thisArg = undefined, scope) {
		let holder = Cu.createObjectIn(scope);

		let wrapped = (...args) => {
			let res;
			res = func.apply(thisArg, args);
			return ScopeUtils.ensurePromiseVarInScope(res, scope);
		};

		Cu.exportFunction(wrapped, holder, { defineAs: "f" });
		return holder.f;
	},

	/**
	 * Create a readonly facade for a class instance, exposing methods and getters (own and prototype)
	 */
	ensureInstanceInScope(instance, scope) {
		if (!Utils.isObjectLike(instance)) return instance;

		let facade = Cu.createObjectIn(scope);

		// Expose prototype-chain methods as privileged wrapper that calls the real method on the real instance
		let methodNames = Utils.getPrototypeMethodNames(instance);
		for (let name of methodNames) {
			if (name === "constructor") continue;

			let method = instance[name];
			if (typeof method !== "function") continue;

			Cu.exportFunction(
				(...args) => {
					let res = method.apply(instance, args);
					return ScopeUtils.ensurePromiseVarInScope(res, scope);
				},
				facade,
				{ defineAs: name }
			);
		}

		// Expose prototype-chain getters as readonly accessors
		let getterNames = Utils.getPrototypeGetterNames(instance);
		for (let name of getterNames) {
			if (Object.prototype.hasOwnProperty.call(facade, name)) continue;
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => ScopeUtils.ensurePromiseVarInScope(Reflect.get(instance, name), scope), holder, { defineAs: "g" });

			Object.defineProperty(facade, name, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set() {
					Utils.throwPropError("set", name);
				},
			});
		}

		// Expose own enumerable data properties and getters as readonly
		let ownDescriptors = Object.getOwnPropertyDescriptors(instance);
		for (let key of Object.keys(ownDescriptors)) {
			if (Object.prototype.hasOwnProperty.call(facade, key)) continue;
			let desc = ownDescriptors[key];
			let holder = Cu.createObjectIn(scope);
			if (typeof desc.get === "function") {
				Cu.exportFunction(() => ScopeUtils.ensurePromiseVarInScope(Reflect.get(instance, key), scope), holder, { defineAs: "g" });
			}
			else {
				Cu.exportFunction(() => ScopeUtils.ensurePromiseVarInScope(instance[key], scope), holder, { defineAs: "g" });
			}

			Object.defineProperty(facade, key, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set() {
					Utils.throwPropError("set", key);
				},
			});
		}

		Object.preventExtensions(facade);
		return facade;
	},

	// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/ExtensionCommon.sys.mjs#60
	getConsole(addon, scope) {
		return () => {
			let console = new lazy.ConsoleAPI({
				prefix: `${addon.name} (${addon.id}):\n`,
			});
			return Cu.cloneInto(
				createAllowlistMirrorObject(console, true, scope),
				scope,
				{ wrapReflectors: true, cloneFunctions: true }
			);
		};
	},
};

/**
 * Create a mirrored object in scope based on the allowlist schema
 * This is to bypass Gecko cross-compartment with different security principles for the designated
 * attributes and methods on the target object, so that the scope with a lower privilege can access
 * the exposed ones safely, with functions exposed to scope and direct/subsequent variables from
 * function returns properly mirrored in scope as well.
 * @param {Object} target Target object to mirror
 * @param {Object} schema Allowlist schema, see schema.mjs
 * @param {Object} scope Scope to mirror the objects
 * @returns {Object} The mirrored object in scope
 */
function createAllowlistMirrorObject(target, schema, scope) {
	// Facade cache to preserve identity and handle cycles for schema-based traversal
	let allowlistFacadeCache = new WeakMap();

	function getAllowlistCacheForObj(obj) {
		let m = allowlistFacadeCache.get(obj);
		if (!m) {
			m = new Map();
			allowlistFacadeCache.set(obj, m);
		}
		return m;
	}

	/**
	 * Wrap an object with an allowlist schema recursively
	 */
	function wrapAllowlist(obj, schemaNode) {
		if (!Utils.isObjectLike(obj)) return obj;

		if (schemaNode !== true && (!schemaNode || typeof schemaNode !== "object")) {
			return Object.freeze(Cu.createObjectIn(scope));
		}

		let cacheForObj = getAllowlistCacheForObj(obj);
		let key = Utils.schemaKey(schemaNode);
		if (cacheForObj.has(key)) return cacheForObj.get(key);

		let wrapper = Cu.createObjectIn(scope);
		cacheForObj.set(key, wrapper);

		let keys = Utils.getAllowedKeys(obj, schemaNode);

		for (let prop of keys) {
			if (!Utils.isAllowed(schemaNode, prop)) continue;

			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(
				() => {
					let value = Reflect.get(obj, prop);

					if (typeof value === "function") {
						return ScopeUtils.ensureCallableInScope(value, obj, scope);
					}

					if (Utils.isObjectLike(value)) {
						let nextSchemaNode = Utils.nextSchema(schemaNode, prop);

						if (nextSchemaNode === true || (nextSchemaNode && typeof nextSchemaNode === "object")) {
							return wrapAllowlist(value, nextSchemaNode);
						}
						return ScopeUtils.ensurePromiseVarInScope(value, scope);
					}

					return value;
				},
				holder,
				{ defineAs: "g" }
			);

			Object.defineProperty(wrapper, prop, {
				enumerable: true,
				configurable: false,
				get: holder.g,
				set() {
					Utils.throwPropError("set", prop);
				},
			});
		}

		Object.preventExtensions(wrapper);
		return wrapper;
	}

	return Object.freeze(wrapAllowlist(target, schema));
}

export { Utils, ScopeUtils, createAllowlistMirrorObject };
