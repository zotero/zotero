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
import { VarCheck, ScopeUtils, ORIGINAL_REF_KEY } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { PluginSandbox } from "chrome://zotero/content/xpcom/plugins/sandbox.mjs";

const lazy = XPCOMUtils.declareLazy({
	ConsoleAPI: "resource://gre/modules/Console.sys.mjs",
});

const ScopeVariables = {

	/**
	 * Wrap a single value with a safe object based on its type.
	 * This method intelligently wraps different types:
	 * - Functions: ensureCallableInScope to allow calling across scopes
	 * - Events: createSafeEvent to allow safe event handling
	 * - Window/Document/DOM nodes: createSafeWindowObject to allow safe DOM access
	 * - Plain objects: recursively wrap properties to allow access to nested properties
	 * - Other objects: createAllowlistMirrorObject to allow access to safe properties and methods
	 * - Primitives: returned as-is
	 * @param {any} value - The value to wrap
	 * @param {string} addonID - The plugin ID for scope restrictions
	 * @param {Object} [options] - Options for wrapping
	 * @param {Element} [options.rootNode] - Optional root node to restrict DOM access.
	 * @returns {any} The wrapped value safe for use in the plugin scope
	 */
	toScope(value, addonID, { rootNode = null } = {}) {
		if (!addonID) {
			return value;
		}
		let scope = PluginSandbox.getScope(addonID);
		if (VarCheck.isPrivilegedScope(scope)) {
			return value;
		}

		// Early return for primitives
		if (!VarCheck.isObjectLike(value)) {
			return value;
		}

		if (typeof value === "function") {
			return ScopeUtils.ensureCallableInScope(value, undefined, scope);
		}

		if (value instanceof Event) {
			return WindowScopeVariables.createSafeEvent(
				value,
				addonID,
				{ rootNode: rootNode || null }
			);
		}
		if (VarCheck.isWindowObject(value) || VarCheck.isDOMNode(value)) {
			return WindowScopeVariables.createSafeWindowObject(
				value,
				addonID,
				{ rootNode: rootNode || null }
			);
		}

		// Handle arrays by cloning into scope and recursively wrapping elements
		if (Array.isArray(value)) {
			let arr = Cu.cloneInto([], scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
			arr.push(...value.map(v => ScopeVariables.toScope(v, addonID, { rootNode })));
			return arr;
		}

		// Recursively wrap plain objects to allow access to nested properties
		if (VarCheck.isPlainObject(value)) {
			let wrapped = Cu.createObjectIn(scope);
			for (let key in value) {
				if (Object.prototype.hasOwnProperty.call(value, key)) {
					wrapped[key] = ScopeVariables.toScope(value[key], addonID, { rootNode });
				}
			}
			return wrapped;
		}

		return ScopeVariables.createAllowlistMirrorObject(
			value,
			true,
			addonID,
			{ mutable: true }
		);
	},

	/**
	 * Wrap a variable from the plugin scope to be used in the host scope
	 * Wraps functions and plain objects with function properties.
	 *
	 * - Functions:
	 *   1. All arguments are wrapped using `toScope` before passing to the plugin function
	 *   2. The plugin function is called with wrapped arguments
	 *   3. The return value is optionally unwrapped if `unwrapReturn` is true
	 *
	 * - Plain objects:
	 *   1. Function properties are recursively wrapped using `fromScope`
	 *   2. Non-function properties are copied as-is
	 *
	 * @param {any} value - The value from plugin scope to wrap
	 * @param {string} addonID - The plugin ID for scope restrictions
	 * @param {Object} [options] - Options for wrapping
	 * @param {Element|Function} [options.rootNode=null] - Optional root node to restrict DOM access.
	 *   Can be an Element or a function that takes the arguments and returns an Element.
	 * @param {boolean} [options.unwrapReturn=false] - Whether to unwrap DOM nodes in return value
	 * @returns {any} - Wrapped value safe for use in the host scope
	 */
	fromScope(value, addonID, { rootNode = null, unwrapReturn = false } = {}) {
		if (!addonID) {
			return value;
		}
		let scope = PluginSandbox.getScope(addonID);
		if (VarCheck.isPrivilegedScope(scope)) {
			return value;
		}

		// Unwrap instance facades and DOM node wrappers back to their originals
		if (VarCheck.isObjectLike(value) && typeof value[ORIGINAL_REF_KEY] === "function") {
			return value[ORIGINAL_REF_KEY]();
		}

		// Recursively unwrap array elements
		if (Array.isArray(value)) {
			return Array.from(value).map(v => ScopeVariables.fromScope(v, addonID, { rootNode, unwrapReturn }));
		}

		if (typeof value === "function") {
			let wrapper = function (...args) {
				// Determine the actual rootNode - can be a function that extracts it from args
				let actualRootNode = typeof rootNode === "function" ? rootNode(...args) : rootNode;

				// Wrap all arguments before passing to plugin function
				let wrappedArgs = args.map(arg => ScopeVariables.toScope(arg, addonID, { rootNode: actualRootNode }));

				let result = Reflect.apply(value, this, wrappedArgs);

				if (unwrapReturn) {
					return WindowScopeVariables.unwrapDOMNode(result);
				}

				return result;
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
		else if (VarCheck.isPlainObject(value)) {
			let hasFunction = false;
			let wrapped = {};
			for (let key of Object.keys(value)) {
				let val = value[key];
				let wrappedVal = ScopeVariables.fromScope(val, addonID, { rootNode, unwrapReturn });
				if (wrappedVal !== val) {
					hasFunction = true;
				}
				wrapped[key] = wrappedVal;
			}
			if (hasFunction) {
				return wrapped;
			}
		}

		return value;
	},

	/**
	 * Get the original unwrapped function from a fromScope-wrapped function.
	 * Returns the function itself if it is not wrapped.
	 * Useful for matching wrapped handlers back to their originals in
	 * register/unregister patterns.
	 * @param {Function} fn - A possibly wrapped function
	 * @returns {Function} The original function
	 */
	getOriginal(fn) {
		if (typeof fn === "function" && typeof fn[ORIGINAL_REF_KEY] === "function") {
			return fn[ORIGINAL_REF_KEY]();
		}
		return fn;
	},

	/**
	 * Wrap a host function so that when called from the plugin scope,
	 * any function arguments or object arguments with function properties
	 * are wrapped using `fromScope` before passing to the actual function.
	 * This allows the host to safely consume plugin-provided functions.
	 */
	createFromScopeCallable(func, thisArg, addonID) {
		let scope = PluginSandbox.getScope(addonID);
		return ScopeUtils.ensureCallableInScope(func, thisArg, scope, {
			argParser: args => args.map(arg => ScopeVariables.fromScope(arg, addonID)),
		});
	},

	// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/ExtensionCommon.sys.mjs#60
	getConsole(addon) {
		return () => {
			let console = new lazy.ConsoleAPI({
				prefix: `${addon.name} (${addon.id}):\n`,
			});
			let wrapper = ScopeVariables.createAllowlistMirrorObject(console, true, addon.id, { mutable: false, cache: true });
			// Save a strong ref to the original object so that it doesn't get GCed before plugin unloads
			Object.defineProperty(wrapper, ORIGINAL_REF_KEY, {
				value() {
					return console;
				}
			});
			return wrapper;
		};
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
	 * - mutable: {Boolean} Whether to make the mirrored object mutable. Default false (frozen).
	 * @returns {Object} The mirrored object in scope
	 */
	createAllowlistMirrorObject(target, schema, addonID, { mutable = false, cache = false } = {}) {
		let scope = PluginSandbox.getScope(addonID);
		if (VarCheck.isPrivilegedScope(scope)) {
			return target;
		}

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
		 * The mutable only applies to the top-level wrapper; nested objects are always frozen.
		 */
		function wrapAllowlist(obj, schemaNode, { mutable = false } = {}) {
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
			let objRef = new WeakRef(obj);

			let keys = VarCheck.getAllowedKeys(obj, schemaNode);

			for (let prop of keys) {
				if (!VarCheck.isAllowed(schemaNode, prop)) continue;

				let holder = Cu.createObjectIn(scope);
				Cu.exportFunction(
					() => {
						let actualObj = objRef.deref();
						if (!actualObj) {
							VarCheck.throwPropError("access", prop, "object has been garbage collected");
						}
						let value = Reflect.get(actualObj, prop);

						if (typeof value === "function") {
							// If the schema value for this prop is a string, we need to call custom handling function
							if (typeof schemaNode === "object" && typeof schemaNode[prop] === "string") {
								switch (schemaNode[prop]) {
									case "WindowScopeCallable":
										return WindowScopeVariables.createSafeWindowCallable(value, actualObj, addonID);
									case "FromScopeCallable":
										return ScopeVariables.createFromScopeCallable(value, actualObj, addonID);
									case "Constructor":
										return ScopeUtils.ensureConstructableInScope(value, scope, { mutable: true });
									default:
										VarCheck.throwPropError("access", prop, "unknown schema handler");
								}
							}
							// If the schema is an object, treat the function as a namespace
							// with sub-properties (e.g. Zotero.Translate has .Search, .Web)
							let nextSchema = VarCheck.nextSchema(schemaNode, prop);
							if (nextSchema && typeof nextSchema === "object") {
								return wrapAllowlist(value, nextSchema);
							}
							return ScopeUtils.ensureCallableInScope(value, actualObj, scope);
						}

						if (VarCheck.isObjectLike(value)) {
							let nextSchemaNode = VarCheck.nextSchema(schemaNode, prop);

							if (nextSchemaNode === true || (nextSchemaNode && typeof nextSchemaNode === "object")) {
								return wrapAllowlist(value, nextSchemaNode);
							}
							return ScopeUtils.ensurePromiseVarInScope(value, scope, { mutable });
						}

						return value;
					},
					holder,
					{ defineAs: "g" }
				);

				Cu.exportFunction(
					(value) => {
						if (!mutable) {
							VarCheck.throwPropError("set", prop);
						}
						let actualObj = objRef.deref();
						if (!actualObj) {
							VarCheck.throwPropError("set", prop, "object has been garbage collected");
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

			return wrapper;
		}

		let result = wrapAllowlist(target, schema, { mutable });
		return result;
	},
};

const WindowScopeVariables = {

	/**
	 * Wrap a function from the host scope to be called in the sandbox scope,
	 * with DOM arguments unwrapped before passing to the actual function,
	 * and DOM return values wrapped before returning to the sandbox.
	 * This is to allow sandbox code to call DOM methods with wrapped DOM nodes and receive wrapped DOM nodes,
	 * while the actual function runs in the privileged host scope with access to real DOM nodes.
	 */
	createSafeWindowCallable(func, thisArg, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);
		return ScopeUtils.ensureCallableInScope(
			func,
			thisArg,
			scope,
			{
				argParser: args => WindowScopeVariables.unwrapDOMArguments(args, addonID, { rootNode }),
				returnParser: value => WindowScopeVariables.createSafeWindowObjectOrList(value, addonID, { rootNode }),
			}
		);
	},

	/**
	 * Wrap a DOM node or Window object within the given root subtree
	 */
	createSafeWindowObject(node, addonID, { rootNode } = {}) {
		if (VarCheck.isWindowObject(node)) {
			return WindowScopeVariables.createSafeWindow(node, addonID, { rootNode });
		}

		if (!VarCheck.isDOMNode(node)) {
			return node;
		}

		let root = rootNode?.deref ? rootNode.deref() : rootNode;

		if (VarCheck.isDocumentObject(node)) {
			return WindowScopeVariables.createSafeDocument(node, addonID, { rootNode });
		}

		if (root === null) {
			// No access
			return null;
		}
		if (rootNode?.deref && !root) {
			VarCheck.throwPropError("access", "root element", "object has been garbage collected");
		}

		// Check if node is within root subtree
		if (!VarCheck.isElementWithinSubtree(node, root)) {
			return null;
		}

		return WindowScopeVariables.createSafeHTMLElement(node, addonID, { rootNode });
	},

	/**
	 * Wrap an array-like list of DOM nodes or Window objects within the given root subtree
	 */
	createSafeWindowObjectOrList(nodes, addonID, { rootNode } = {}) {
		// Check for Window/DOM objects before the array-like check,
		// because Window has a numeric `length` property (frame count)
		// that causes isArrayLike to return true, bypassing the wrapper.
		if (VarCheck.isWindowObject(nodes) || VarCheck.isDOMNode(nodes)) {
			return WindowScopeVariables.createSafeWindowObject(nodes, addonID, { rootNode });
		}

		if (nodes instanceof NodeList) {
			let items = Array.from(nodes)
				.map(item => WindowScopeVariables.createSafeWindowObject(item, addonID, { rootNode }))
				.filter(item => item !== null);

			let nodeList = new NodeList();
			for (let i = 0; i < items.length; i++) {
				nodeList[i] = items[i];
			}
			nodeList.length = items.length;
			return ScopeVariables.createAllowlistMirrorObject(nodeList, true, addonID, { mutable: true });
		}

		if (VarCheck.isArrayLike(nodes)) {
			let items = Array.from(nodes);
			if (items.length === 0 || !items.some(item => VarCheck.isDOMNode(item) || VarCheck.isWindowObject(item))) {
				return nodes;
			}
			// Since it's a return from DOM method, we can assume it's safe to do the filtering
			return items.map(item => WindowScopeVariables.createSafeWindowObject(item, addonID, { rootNode })).filter(item => item !== null);
		}
		
		return WindowScopeVariables.createSafeWindowObject(nodes, addonID, { rootNode });
	},

	/**
	 * Wrap a Window object that only exposes allowed properties and methods based on the schema
	 * If the `rootNode` is not provided, the wrapper will be created without access to any DOM.
	 */
	createSafeWindow(win, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);

		if (VarCheck.isPrivilegedScope(scope)) {
			return win;
		}

		// This should be executed after the scope is fully initialized with permissions, so we can get the correct schema based on permissions
		let permissions = scope.PERMISSIONS;
		let schema;
		if (win.location.href === "chrome://zotero/content/zoteroPane.xhtml") {
			schema = VarCheck.getMainWindowSchema(permissions);
		}
		else {
			schema = VarCheck.getWindowSchema(permissions);
		}
		let wrapper = ScopeVariables.createAllowlistMirrorObject(win, schema, addonID, { mutable: false, cache: false });

		Object.defineProperties(wrapper, {
			document: {
				get() {
					return WindowScopeVariables.createSafeDocument(win.document, addonID, { rootNode });
				},
				enumerable: true,
				configurable: false,
			},
		});
		return wrapper;
	},

	/**
	 * Wrap a Document object that only exposes allowed properties and methods based on the schema
	 * If the `rootNode` is not provided, the wrapper will be created without access to any DOM.
	 */
	createSafeDocument(doc, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);
		if (VarCheck.isPrivilegedScope(scope)) {
			return doc;
		}

		let docRef = new WeakRef(doc);

		let wrapper = Cu.createObjectIn(scope);
		// Dangerous tags that should not be created
		let unsafeTags = ["script", "iframe", "browser", "object", "embed", "meta"];

		["createElement", "createXULElement", "createElementNS"].forEach((method) => {
			if (typeof doc[method] === "function") {
				Cu.exportFunction(
					(...args) => {
						let tagName = method === "createElementNS" ? args[1] : args[0];

						if (typeof tagName !== "string") {
							throw new Error("tagName must be a string");
						}

						let localName = tagName;
						// Handle qualified names (e.g., "html:iframe")
						if (method === "createElementNS") {
							localName = tagName.includes(":") ? tagName.split(":").pop() : tagName;
						}

						if (unsafeTags.includes(localName.toLowerCase())) {
							VarCheck.throwPropError("create", tagName, "tag is not allowed");
						}

						let actualDoc = docRef.deref();
						if (!actualDoc) {
							VarCheck.throwPropError("access", "document", "object has been garbage collected");
						}
						let newElement = actualDoc[method](...args);
						return WindowScopeVariables.createSafeHTMLElement(newElement, addonID, { rootNode });
					},
					wrapper,
					{ defineAs: method }
				);
			}
		});

		Object.preventExtensions(wrapper);
		return wrapper;
	},

	createSafeEvent(event, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);

		if (VarCheck.isPrivilegedScope(scope)) {
			return event;
		}

		// Create a mirrored event in mutable mode so we can modify DOM properties
		let wrappedEvent = ScopeVariables.createAllowlistMirrorObject(event, true, addonID, { mutable: true });

		let DOMProps = ["target", "currentTarget", "relatedTarget"];
		let DOMPropMethods = ["composedPath"];

		// Wrap DOM-referencing properties
		for (let prop of DOMProps) {
			if (event[prop]) {
				Object.defineProperty(wrappedEvent, prop, {
					value: WindowScopeVariables.createSafeWindowObject(event[prop], addonID, { rootNode }),
					enumerable: true,
					configurable: false,
					writable: false,
				});
			}
		}

		for (let method of DOMPropMethods) {
			if (typeof event[method] === "function") {
				Object.defineProperty(wrappedEvent, method, {
					value: WindowScopeVariables.createSafeWindowCallable(event[method], event, addonID, { rootNode }),
					enumerable: true,
					configurable: false,
					writable: false,
				});
			}
		}
		Object.preventExtensions(wrappedEvent);
		return wrappedEvent;
	},

	createSafeHTMLElement(elem, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);

		if (VarCheck.isPrivilegedScope(scope)) {
			return elem;
		}

		if (!VarCheck.isObjectLike(elem)) {
			return elem;
		}

		// let elemRef = new WeakRef(elem);
		let wrapper = Cu.createObjectIn(scope);

		const blockedWindowProps = new Set([
			"ownerGlobal",
			"defaultView",
			"window",
			"global",
			"globalThis",
			"top",
			"parent",
			"frames",
			"frameElement",
			"self",
			"opener",
			"content",
		]);

		// We need the strong ref to prevent GC, as the `unwrapDOMNode` may be called later.
		// For elements created in the sandbox, they can be GCed before getting consumed otherwise.
		// Sandboxed code should not hold long-term references to DOM nodes anyway.
		function getActual() {
			return elem;
		}

		let keys = VarCheck.getAllKeysIncludingPrototypes(elem);
		for (let prop of keys) {
			if (typeof prop === "symbol") continue;
			let holder = Cu.createObjectIn(scope);

			Cu.exportFunction(
				() => {
					if (prop === "ownerDocument") {
						let actual = getActual();
						return WindowScopeVariables.createSafeDocument(actual.ownerDocument, addonID, { rootNode });
					}
					if (blockedWindowProps.has(prop)) {
						VarCheck.throwPropError("access", prop);
					}

					let actual = getActual();
					let value = Reflect.get(actual, prop);

					// Access to global window objects is not allowed
					if (VarCheck.isWindowObject(value)) {
						VarCheck.throwPropError("access", prop);
					}

					// Wrap the function to wrap DOM results
					if (typeof value === "function") {
						return WindowScopeVariables.createSafeWindowCallable(value, actual, addonID, { rootNode });
					}

					let wrapped = WindowScopeVariables.createSafeWindowObjectOrList(value, addonID, { rootNode });
					if (wrapped !== value) {
						return wrapped;
					}

					if (VarCheck.isObjectLike(value)) {
						return ScopeUtils.ensurePromiseVarInScope(value, scope, { mutable: true });
					}

					return value;
				},
				holder,
				{ defineAs: "g" }
			);

			Cu.exportFunction(
				(value) => {
					let actual = getActual();
					if (prop === "ownerDocument") {
						VarCheck.throwPropError("set", prop);
					}
					if (blockedWindowProps.has(prop)) {
						VarCheck.throwPropError("set", prop);
					}
					let unwrappedValue = WindowScopeVariables.unwrapDOMNode(value);
					return Reflect.set(actual, prop, unwrappedValue);
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

		// Define the ref to the actual element for internal use
		Object.defineProperty(wrapper, ORIGINAL_REF_KEY, {
			value: () => getActual(),
			enumerable: false,
			configurable: false,
			writable: false,
		});

		Object.preventExtensions(wrapper);
		return wrapper;
	},


	/**
	 * Convert the arguments before passing to actual DOM methods e.g., `appendChild` or `addEventListener`
	 * - For DOM nodes, unwrap to actual nodes.
	 * - For array-like arguments, unwrap each item if they are wrapped DOM nodes (assume no nested arrays or functions in arrays)
	 * - For callback functions, wrap them to wrap DOM nodes and Events in their arguments and return values. For example:
	 *   - When calling `addEventListener` from the sandbox with callback `fn_{sandbox}`
	 *   - We return a wrapped callback `fn_{host}^{wrapped}` to the host scope, and store the reference on `fn_{sandbox}`
	 *   - The wrapped callback `fn_{host}^{wrapped}` is the actual function passed to `addEventListener`
	 *   - When calling `removeEventListener` from the sandbox with the original callback `fn_{sandbox}`
	 *   - This function detects that `fn_{sandbox}` has a wrapped reference stored, and returns `fn_{host}^{wrapped}` to the host scope
	 *   - Thus, the correct function reference is passed to `removeEventListener`
	 */
	unwrapDOMArguments(args, addonID, { rootNode } = {}) {
		return args.map((arg) => {
			if (WindowScopeVariables.isWrappedDOMNode(arg)) {
				return WindowScopeVariables.unwrapDOMNode(arg);
			}
			if (VarCheck.isArrayLike(arg)) {
				let items = Array.from(arg);
				if (items.some(item => WindowScopeVariables.isWrappedDOMNode(item))) {
					return items.map(item => WindowScopeVariables.unwrapDOMNode(item));
				}
			}
			if (typeof arg === "function") {
				// If this function has already been wrapped, return the wrapped version
				if (arg[ORIGINAL_REF_KEY]) {
					return arg[ORIGINAL_REF_KEY]();
				}
				
				let wrappedCallback = function (...callbackArgs) {
					// Wrap DOM nodes and Events in callback arguments
					let wrappedArgs = callbackArgs.map((cbArg) => {
						if (VarCheck.isDOMNode(cbArg)) {
							return WindowScopeVariables.createSafeWindowObject(cbArg, addonID, { rootNode });
						}
						// Wrap Event objects and their related properties
						if (cbArg && typeof cbArg === "object" && typeof cbArg.type === "string") {
							// It's likely an Event - create a safe version
							return WindowScopeVariables.createSafeEvent(cbArg, addonID, { rootNode });
						}
						return cbArg;
					});
					// Call the original function with wrapped arguments and wrap its result
					let result = arg.apply(this, wrappedArgs);
					return (result);
				};
				
				// Store the reference to the wrapped callback for future checks
				Object.defineProperty(arg, ORIGINAL_REF_KEY, {
					value: () => wrappedCallback,
					enumerable: false,
					configurable: false,
					writable: false,
				});
				
				return wrappedCallback;
			}
			return arg;
		});
	},


	isWrappedDOMNode(value) {
		return VarCheck.isObjectLike(value) && typeof value[ORIGINAL_REF_KEY] === "function";
	},

	unwrapDOMNode(value) {
		if (WindowScopeVariables.isWrappedDOMNode(value)) {
			return value[ORIGINAL_REF_KEY]();
		}
		return value;
	},
};

export { ScopeVariables, WindowScopeVariables };
