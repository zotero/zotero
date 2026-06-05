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
import { Utils, ScopeUtils } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { getScope } from "chrome://zotero/content/xpcom/plugins/sandbox.mjs";

const lazy = XPCOMUtils.declareLazy({
	ConsoleAPI: "resource://gre/modules/Console.sys.mjs",
});

const ORIGINAL_REF_KEY = "__zoteroOriginalRef__";


const ScopeVariables = {
	// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/ExtensionCommon.sys.mjs#60
	getConsole(addon) {
		return () => {
			let console = new lazy.ConsoleAPI({
				prefix: `${addon.name} (${addon.id}):\n`,
			});
			return ScopeVariables.createAllowlistMirrorObject(console, true, addon.id, { mutable: false, cache: true });
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
		let scope = getScope(addonID);
		if (Utils.isPrivilegedScope(scope)) {
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
			if (!Utils.isObjectLike(obj)) return obj;

			if (schemaNode !== true && (!schemaNode || typeof schemaNode !== "object")) {
				return Object.freeze(Cu.createObjectIn(scope));
			}

			let cacheForObj;
			let cacheKey;
			if (cache) {
				cacheForObj = getAllowlistCacheForObj(obj);
				cacheKey = Utils.schemaKey(schemaNode);
				if (cacheForObj.has(cacheKey)) {
					return cacheForObj.get(cacheKey);
				};
			}

			let wrapper = Cu.createObjectIn(scope);
			if (cache) {
				cacheForObj.set(cacheKey, wrapper);
			}
			let objRef = new WeakRef(obj);

			let keys = Utils.getAllowedKeys(obj, schemaNode);

			for (let prop of keys) {
				if (!Utils.isAllowed(schemaNode, prop)) continue;

				let holder = Cu.createObjectIn(scope);
				Cu.exportFunction(
					() => {
						let actualObj = objRef.deref();
						if (!actualObj) {
							Utils.throwPropError("access", prop, "object has been garbage collected");
						}
						let value = Reflect.get(actualObj, prop);

						if (typeof value === "function") {
							// If the schema value for this prop is a string, we need to call custom handling function
							if (typeof schemaNode === "object" && typeof schemaNode[prop] === "string") {
								switch (schemaNode[prop]) {
									case "WindowScopeCallable":
										return WindowScopeVariables.createSafeWindowCallable(value, actualObj, addonID);
									default:
										Utils.throwPropError("access", prop, "unknown schema handler");
								}
							}
							return ScopeUtils.ensureCallableInScope(value, actualObj, scope);
						}

						if (Utils.isObjectLike(value)) {
							let nextSchemaNode = Utils.nextSchema(schemaNode, prop);

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
							Utils.throwPropError("set", prop);
						}
						let actualObj = objRef.deref();
						if (!actualObj) {
							Utils.throwPropError("set", prop, "object has been garbage collected");
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
		let scope = getScope(addonID);
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
		if (Utils.isWindowObject(node)) {
			return WindowScopeVariables.createSafeWindow(node, addonID, { rootNode });
		}

		if (!Utils.isDOMNode(node)) {
			return node;
		}

		let root = rootNode.deref ? rootNode.deref() : rootNode;
		if (root === null) {
			// No access
			return null;
		}
		if (!root) {
			Utils.throwPropError("access", "root element", "object has been garbage collected");
		}

		// Check if node is within root subtree
		if (!Utils.isElementWithinSubtree(node, root)) {
			return null;
		}

		if (Utils.isDocumentObject(node)) {
			return WindowScopeVariables.createSafeDocument(node, addonID, { rootNode });
		}

		return WindowScopeVariables.createSafeHTMLElement(node, addonID, { rootNode });
	},

	/**
	 * Wrap an array-like list of DOM nodes or Window objects within the given root subtree
	 */
	createSafeWindowObjectOrList(nodes, addonID, { rootNode } = {}) {
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

		if (Utils.isArrayLike(nodes)) {
			let items = Array.from(nodes);
			if (items.length === 0 || !items.some(item => Utils.isDOMNode(item) || Utils.isWindowObject(item))) {
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
		let scope = getScope(addonID);

		if (Utils.isPrivilegedScope(scope)) {
			return win;
		}

		// This should be executed after the scope is fully initialized with permissions, so we can get the correct schema based on permissions
		let permissions = scope.PERMISSIONS;
		let schema;
		if (win.location.href === "chrome://zotero/content/zoteroPane.xhtml") {
			schema = Utils.getMainWindowSchema(permissions);
		}
		else {
			schema = Utils.getWindowSchema(permissions);
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
		let scope = getScope(addonID);
		if (Utils.isPrivilegedScope(scope)) {
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
							Utils.throwPropError("create", tagName, "tag is not allowed");
						}

						let actualDoc = docRef.deref();
						if (!actualDoc) {
							Utils.throwPropError("access", "document", "object has been garbage collected");
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
		let scope = getScope(addonID);

		if (Utils.isPrivilegedScope(scope)) {
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
		let scope = getScope(addonID);

		if (Utils.isPrivilegedScope(scope)) {
			return elem;
		}

		if (!Utils.isObjectLike(elem)) {
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

		let keys = Utils.getAllKeysIncludingPrototypes(elem);
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
						Utils.throwPropError("access", prop);
					}

					let actual = getActual();
					let value = Reflect.get(actual, prop);

					// Access to global window objects is not allowed
					if (Utils.isWindowObject(value)) {
						Utils.throwPropError("access", prop);
					}

					// Wrap the function to wrap DOM results
					if (typeof value === "function") {
						return WindowScopeVariables.createSafeWindowCallable(value, actual, addonID, { rootNode });
					}

					let wrapped = WindowScopeVariables.createSafeWindowObjectOrList(value, addonID, { rootNode });
					if (wrapped !== value) {
						return wrapped;
					}

					if (Utils.isObjectLike(value)) {
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
						Utils.throwPropError("set", prop);
					}
					if (blockedWindowProps.has(prop)) {
						Utils.throwPropError("set", prop);
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
			if (Utils.isArrayLike(arg)) {
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
						if (Utils.isDOMNode(cbArg)) {
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
		return Utils.isObjectLike(value) && typeof value[ORIGINAL_REF_KEY] === "function";
	},

	unwrapDOMNode(value) {
		if (WindowScopeVariables.isWrappedDOMNode(value)) {
			return value[ORIGINAL_REF_KEY]();
		}
		return value;
	},
};

export { ScopeVariables, WindowScopeVariables };
