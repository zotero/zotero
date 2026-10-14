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


import { VarCheck, ScopeUtils, ORIGINAL_REF_KEY, CUSTOM_PARSER_KEY } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { SchemaKey } from "chrome://zotero/content/xpcom/plugins/schema.mjs";
import { PluginSandbox } from "chrome://zotero/content/xpcom/plugins/sandbox.mjs";
import { PluginTrace } from "chrome://zotero/content/xpcom/plugins/trace.mjs";

const ScopeVariables = {

	/**
	 * Wrap a single value with a safe object based on its type.
	 * This method intelligently wraps different types:
	 * - Functions: ensureCallableInScope to allow calling across scopes
	 * - Events and privileged Window/Document/DOM nodes: blocked (undefined)
	 * - Plain objects: recursively wrap properties to allow access to nested properties
	 * - Other objects: createAllowlistMirrorObject to allow access to safe properties and methods
	 * - Primitives: returned as-is
	 * @param {any} value - The value to wrap
	 * @param {string} pluginID - The plugin ID for scope restrictions
	 * @param {Object} [options]
	 * @param {string} [options.path] - The API path the value is reached by, so calls into it are traced
	 * @returns {any} The wrapped value safe for use in the plugin scope
	 */
	toScope(value, pluginID, { path = null, _seen = null } = {}) {
		if (!pluginID || PluginSandbox.isPrivileged(pluginID)) {
			return value;
		}
		let scope = PluginSandbox.getScope(pluginID);

		// Early return for primitives
		if (!VarCheck.isObjectLike(value)) {
			return value;
		}

		// Skip already-wrapped scope objects
		if (VarCheck.hasOriginalRef(value)) {
			return value;
		}

		if (typeof value === "function") {
			return ScopeUtils.ensureCallableInScope(value, undefined, scope, { trace: path ? { pluginID, path } : null });
		}

		// Event.isInstance matches across compartments, unlike instanceof
		if (Event.isInstance(value)) {
			return undefined;
		}
		if (VarCheck.isWindowObject(value) || VarCheck.isDOMNode(value)) {
			// The plugin's own pages are same-origin with its sandbox and can
			// be scripted directly; privileged chrome DOM never crosses
			if (VarCheck.isPluginOwnContent(value, pluginID)) {
				return value;
			}
			return undefined;
		}

		// Library data reaches plugins as IDs and Zotero.DataStore snapshots, never as live objects
		if (VarCheck.isDataObject(value)) {
			Zotero.warn(`Plugin ${pluginID}: dropped a live ${value._objectType || "data"} object from a payload; pass IDs`);
			return undefined;
		}

		if (!_seen) _seen = new Map();
		if (_seen.has(value)) return _seen.get(value);

		// Handle arrays by cloning into scope and recursively wrapping elements
		if (Array.isArray(value)) {
			let arr = Cu.cloneInto([], scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
			_seen.set(value, arr);
			arr.push(...value.map((v, i) => ScopeVariables.toScope(v, pluginID, { path: path && `${path}[${i}]`, _seen })));
			return arr;
		}

		// Wrap plain objects with lazy getters to avoid deep recursion
		if (VarCheck.isPlainObject(value)) {
			let wrapped = Cu.createObjectIn(scope);
			_seen.set(value, wrapped);
			for (let key in value) {
				if (Object.prototype.hasOwnProperty.call(value, key)) {
					let holder = Cu.createObjectIn(scope);
					let cached;
					let hasCached = false;
					Cu.exportFunction(() => {
						if (!hasCached) {
							cached = ScopeVariables.toScope(value[key], pluginID, { path: path && `${path}.${key}`, _seen });
							hasCached = true;
						}
						return cached;
					}, holder, { defineAs: "g" });
					Object.defineProperty(wrapped, key, {
						get: holder.g,
						enumerable: true,
						configurable: false,
					});
				}
			}
			Object.defineProperty(wrapped, ORIGINAL_REF_KEY, {
				value: () => value,
				enumerable: false,
				configurable: false,
				writable: false,
			});
			return wrapped;
		}

		// Traced under the given path, else the class name, as the facades of returned instances are
		return ScopeVariables.createAllowlistMirrorObject(
			value,
			true,
			pluginID,
			{ frozen: false, pathPrefix: path || value.constructor?.name || "Object" }
		);
	},

	/**
	 * Wrap a variable from the plugin scope to be used in the host scope
	 * Wraps functions and plain objects with function properties.
	 *
	 * - Functions:
	 *   1. All arguments are wrapped using `toScope` before passing to the plugin function
	 *   2. The plugin function is called with wrapped arguments
	 *
	 * - Plain objects:
	 *   1. Function properties are recursively wrapped using `fromScope`
	 *   2. Non-function properties are copied as-is
	 *
	 * @param {any} value - The value from plugin scope to wrap
	 * @param {string} pluginID - The plugin ID for scope restrictions
	 * @param {Object} [options] - Options for wrapping
	 * @returns {any} - Wrapped value safe for use in the host scope
	 */
	fromScope(value, pluginID, { trace = null, _seen = null } = {}) {
		if (!pluginID || PluginSandbox.isPrivileged(pluginID)) {
			return value;
		}

		// Early return for primitives
		if (!VarCheck.isObjectLike(value)) {
			return value;
		}

		// Unwrap instance facades back to their originals
		if (VarCheck.hasOriginalRef(value)) {
			return VarCheck.getOriginalRef(value);
		}

		if (typeof value === "function") {
			let funcName = value.name || "anonymous";
			let hookPath = trace ? `${trace.path}:${funcName}` : funcName;
			let unloaded = false;
			let wrapper = function (...args) {
				// A hook the plugin left behind falls silent once its sandbox is nuked, instead of throwing
				if (Cu.isDeadWrapper(value)) {
					if (!unloaded) {
						unloaded = true;
						Zotero.debug(`Plugin ${pluginID}: hook ${hookPath} called after unload; ignored`);
					}
					return undefined;
				}
				let t = PluginTrace.start();
				let failure;
				try {
					// Arguments cross into the plugin scope, traced under the hook's path
					let wrappedArgs = args.map(arg => ScopeVariables.toScope(arg, pluginID, { path: hookPath }));
					return Reflect.apply(value, this, wrappedArgs);
				}
				catch (e) {
					failure = e;
					throw e;
				}
				finally {
					PluginTrace.end(t, pluginID, "hook", hookPath, failure);
				}
			};
			// Store the original function ref on the wrapper so callers can
			// match wrapped handlers back to their originals (e.g. for unregister)
			Object.defineProperty(wrapper, ORIGINAL_REF_KEY, {
				value: () => value,
				enumerable: false,
				configurable: false,
				writable: false,
			});
			return wrapper;
		}

		if (!_seen) _seen = new Map();
		if (_seen.has(value)) return _seen.get(value);

		// Recursively unwrap array elements. Register in _seen before
		// recursing so self-referential values can't recurse forever
		if (Array.isArray(value)) {
			let arr = [];
			_seen.set(value, arr);
			for (let v of Array.from(value)) {
				arr.push(ScopeVariables.fromScope(v, pluginID, { trace, _seen }));
			}
			return arr;
		}

		if (VarCheck.isPlainObject(value)) {
			let hasWrapped = false;
			let wrapped = {};
			_seen.set(value, wrapped);
			for (let key of Object.keys(value)) {
				let val = value[key];
				let wrappedVal = ScopeVariables.fromScope(val, pluginID, { trace, _seen });
				if (wrappedVal !== val) {
					hasWrapped = true;
				}
				wrapped[key] = wrappedVal;
			}
			if (hasWrapped) {
				return wrapped;
			}
		}

		return value;
	},

	/**
	 * Attach a custom arg parser on a function. When the function is
	 * exposed via the `"CustomParserCallable"` schema type.
	 *
	 * @param {function} func
	 * @param {function} parser
	 */
	setCustomParser(func, parser) {
		func[CUSTOM_PARSER_KEY] = parser;
	},

	/**
	 * Enforce a trusted property on a parser arg by rebuilding it as a fresh chrome
	 * object -- an in-place write can be dropped by a plugin accessor or Proxy trap.
	 *
	 * @param {Array} args - The parser's args array (mutated in place)
	 * @param {number} index - Index of the option object in args
	 * @param {string} key - Property to enforce
	 * @param {*} value - Trusted value to assign
	 */
	assignTrustedArg(args, index, key, value) {
		let original = args[index];
		if (!VarCheck.isObject(original)) {
			return;
		}
		let copy = {};
		for (let k of Object.keys(original)) {
			if (k === key) continue;
			copy[k] = original[k];
		}
		copy[key] = value;
		args[index] = copy;
	},

	/**
	 * Wrap a host function using a custom arg parser attached on the
	 * function itself via `setCustomParser`.
	 */
	createCustomParserCallable(func, thisArg, pluginID, scope, { trace } = {}) {
		// A sandbox unloaded or replaced by a reload no longer speaks for its plugin ID
		let ensureLoaded = () => {
			if (!scope || PluginSandbox.getScope(pluginID) !== scope) {
				throw new Error(`Plugin ${pluginID} is not loaded`);
			}
		};
		ensureLoaded();
		let parser = func[CUSTOM_PARSER_KEY];
		if (typeof parser !== "function") {
			return ScopeUtils.ensureCallableInScope(func, thisArg, scope, { trace });
		}
		return ScopeUtils.ensureCallableInScope(func, thisArg, scope, {
			argParser: (args) => {
				ensureLoaded();
				parser({ pluginID, thisArg, args });
				return args;
			},
			trace,
		});
	},

	/**
	 * Create a mirrored object in scope based on the allowlist schema
	 * This is to bypass Gecko cross-compartment with different security principles for the designated
	 * attributes and methods on the target object, so that the scope with a lower privilege can access
	 * the exposed ones safely, with functions exposed to scope and direct/subsequent variables from
	 * function returns properly mirrored in scope as well.
	 * @param {Object} target Target object to mirror
	 * @param {Object} schema Allowlist schema, see schema.mjs
	 * @param {Object} scope Scope to mirror the objects
	 * @param {Object} options
	 * @param {Boolean} options.frozen Whether properties on the mirrored object cannot be set. Default true.
	 * @param {Boolean} options.mutable Whether objects returned from methods/getters are writable.
	 *   Defaults to true -- returned objects (e.g. items from Zotero.Items.get()) should generally
	 *   be operable by plugins, even if the namespace itself is frozen.
	 * @param {Boolean} options.cache Whether to cache the mirrored object. Default false. Only for long-lived objects!
	 * @param {Boolean} options.strong Whether to use a strong reference to the target. Default false (WeakRef).
	 *   Use this for constructor-created objects that the caller owns, to prevent premature GC.
	 * @returns {Object} The mirrored object in scope
	 */
	createAllowlistMirrorObject(target, schema, pluginID, { frozen = true, mutable = true, cache = false, strong = false, pathPrefix = "" } = {}) {
		if (PluginSandbox.isPrivileged(pluginID)) {
			return target;
		}
		let scope = PluginSandbox.getScope(pluginID);

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
		 * Wrap an object with an allowlist schema recursively.
		 * `frozen` controls whether properties on the wrapper can be set.
		 * `mutable` (from outer scope) controls whether values returned from methods/getters are writable.
		 */
		function wrapAllowlist(obj, schemaNode, { frozen: isFrozen = true, strong: strongRef = false, pathPrefix: prefix = "" } = {}) {
			if (!VarCheck.isObjectLike(obj)) return obj;

			if (schemaNode !== true && (!schemaNode || typeof schemaNode !== "object")) {
				return Object.freeze(Cu.createObjectIn(scope));
			}

			let cacheForObj;
			let cacheKey;
			if (cache) {
				cacheForObj = getAllowlistCacheForObj(obj);
				cacheKey = VarCheck.schemaKey(schemaNode);
				if (cacheForObj.has(cacheKey)) {
					return cacheForObj.get(cacheKey);
				};
			}

			let wrapper = Cu.createObjectIn(scope);
			if (cache) {
				cacheForObj.set(cacheKey, wrapper);
			}
			let objRef = strongRef ? { deref: () => obj } : new WeakRef(obj);

			let keys = VarCheck.getAllowedKeys(obj, schemaNode);

			for (let prop of keys) {
				if (!VarCheck.isAllowed(schemaNode, prop)) continue;

				let propPath = prefix ? `${prefix}.${prop}` : prop;
				let trace = prefix ? { pluginID: pluginID, path: propPath } : null;

				let callableOrigin;
				let callableWrapped;

				// The callable a schema entry asks for: a handler by name, in the string or the object form,
				// else the plain call wrapper
				let wrapCallable = (value, actualObj) => {
					let entry = typeof schemaNode === "object" ? schemaNode[prop] : undefined;
					let handler = VarCheck.isObject(entry) ? entry[SchemaKey.HANDLER] : entry;
					let instanceSchema = (VarCheck.isObject(entry) && entry[SchemaKey.SCHEMA]) || null;
					switch (typeof handler === "string" ? handler : undefined) {
						case undefined:
							return ScopeUtils.ensureCallableInScope(value, actualObj, scope, { mutable, trace });
						case "Callable":
							return ScopeUtils.ensureCallableInScope(value, actualObj, scope, { mutable, instanceSchema, trace });
						case "Constructor":
							return ScopeUtils.ensureConstructableInScope(value, scope, { mutable: true, instanceSchema, trace });
						case "FromScopeCallable":
							return ScopeUtils.ensureCallableInScope(value, actualObj, scope, {
								argParser: args => args.map(arg => ScopeVariables.fromScope(arg, pluginID, { trace })),
								instanceSchema,
								trace,
							});
						case "CustomParserCallable":
							return ScopeVariables.createCustomParserCallable(value, actualObj, pluginID, scope, { trace });
						default:
							VarCheck.throwPropError("access", prop, "unknown schema handler");
					}
					return undefined;
				};

				let holder = Cu.createObjectIn(scope);
				Cu.exportFunction(
					() => {
						let actualObj = objRef.deref();
						if (!actualObj) {
							VarCheck.throwPropError("access", prop, "object has been garbage collected");
						}
						let value = Reflect.get(actualObj, prop);

						if (typeof value === "function") {
							// A schema object with no handler names the function's sub-properties, a namespace
							// such as Zotero.Promise with .defer and .delay
							let nextSchema = VarCheck.nextSchema(schemaNode, prop);
							if (nextSchema && typeof nextSchema === "object" && !nextSchema[SchemaKey.HANDLER]) {
								return wrapAllowlist(value, nextSchema, { pathPrefix: propPath });
							}
							// One wrapper per function, so identity holds and a hot path allocates nothing
							if (cache && value === callableOrigin) {
								return callableWrapped;
							}
							let wrapped = wrapCallable(value, actualObj);
							if (cache) {
								callableOrigin = value;
								callableWrapped = wrapped;
							}
							return wrapped;
						}

						if (VarCheck.isObjectLike(value)) {
							// Block Window/DOM objects to prevent
							// privilege escalation through nested properties
							if (VarCheck.isWindowObject(value) || VarCheck.isDOMNode(value)) {
								return undefined;
							}

							let nextSchemaNode = VarCheck.nextSchema(schemaNode, prop);

							if (nextSchemaNode === true || (nextSchemaNode && typeof nextSchemaNode === "object")) {
								return wrapAllowlist(value, nextSchemaNode, { pathPrefix: propPath });
							}
							return ScopeUtils.ensurePromiseVarInScope(value, scope, { mutable });
						}

						// Leaf value, trace the get
						if (trace) {
							PluginTrace.record(pluginID, "get", propPath);
						}
						return value;
					},
					holder,
					{ defineAs: "g" }
				);

				Cu.exportFunction(
					(value) => {
						if (isFrozen) {
							VarCheck.throwPropError("set", prop);
						}
						let actualObj = objRef.deref();
						if (!actualObj) {
							VarCheck.throwPropError("set", prop, "object has been garbage collected");
						}
						if (trace) {
							PluginTrace.record(pluginID, "set", propPath);
						}
						return Reflect.set(actualObj, prop, value);
					},
					holder,
					{ defineAs: "s" }
				);

				Object.defineProperty(wrapper, prop, {
					enumerable: true,
					configurable: false,
					get: holder.g,
					set: holder.s,
				});
			}

			// Store a reference to the original object for unwrapping in fromScope,
			// so that wrappers are detected and not recursed into
			Object.defineProperty(wrapper, ORIGINAL_REF_KEY, {
				value: () => objRef.deref(),
				enumerable: false,
				configurable: false,
				writable: false,
			});

			return wrapper;
		}

		let result = wrapAllowlist(target, schema, { frozen, strong, pathPrefix });
		return result;
	},
};

export { ScopeVariables };
