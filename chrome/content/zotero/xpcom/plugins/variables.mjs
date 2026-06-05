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


import { VarCheck, ScopeUtils, ORIGINAL_REF_KEY } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { PluginSandbox } from "chrome://zotero/content/xpcom/plugins/sandbox.mjs";
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";

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
	toScope(value, addonID, { rootNode = null, _seen = null } = {}) {
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

		// Skip already-wrapped scope objects
		if (typeof value[ORIGINAL_REF_KEY] === "function") {
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

		if (!_seen) _seen = new Map();
		if (_seen.has(value)) return _seen.get(value);

		// Handle arrays by cloning into scope and recursively wrapping elements
		if (Array.isArray(value)) {
			let arr = Cu.cloneInto([], scope, {
				wrapReflectors: true,
				cloneFunctions: true,
			});
			_seen.set(value, arr);
			arr.push(...value.map(v => ScopeVariables.toScope(v, addonID, { rootNode, _seen })));
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
							cached = ScopeVariables.toScope(value[key], addonID, { rootNode, _seen });
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
	fromScope(value, addonID, { rootNode = null, unwrapReturn = false, _seen = null } = {}) {
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

		// Unwrap instance facades and DOM node wrappers back to their originals
		if (typeof value[ORIGINAL_REF_KEY] === "function") {
			return value[ORIGINAL_REF_KEY]();
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

		if (!_seen) _seen = new Map();
		if (_seen.has(value)) return _seen.get(value);

		// Recursively unwrap array elements
		if (Array.isArray(value)) {
			let arr = Array.from(value).map(v => ScopeVariables.fromScope(v, addonID, { rootNode, unwrapReturn, _seen }));
			_seen.set(value, arr);
			return arr;
		}

		if (VarCheck.isPlainObject(value)) {
			let hasFunction = false;
			let wrapped = {};
			for (let key of Object.keys(value)) {
				let val = value[key];
				let wrappedVal = ScopeVariables.fromScope(val, addonID, { rootNode, unwrapReturn, _seen });
				if (wrappedVal !== val) {
					hasFunction = true;
				}
				wrapped[key] = wrappedVal;
			}
			if (hasFunction) {
				_seen.set(value, wrapped);
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
	 * @param {Boolean} options.mutable Whether to make the mirrored object mutable. Default false (frozen).
	 * @param {Boolean} options.cache Whether to cache the mirrored object. Default false.
	 * @param {Boolean} options.strong Whether to use a strong reference to the target. Default false (WeakRef).
	 *   Use this for constructor-created objects that the caller owns, to prevent premature GC.
	 * @returns {Object} The mirrored object in scope
	 */
	createAllowlistMirrorObject(target, schema, addonID, { mutable = false, cache = false, strong = false } = {}) {
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
		function wrapAllowlist(obj, schemaNode, { mutable = false, strong: strongRef = false } = {}) {
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
							// Intercept Window/DOM objects to prevent
							// privilege escalation through nested properties
							if (VarCheck.isWindowObject(value) || VarCheck.isDOMNode(value)) {
								return WindowScopeVariables.createSafeWindowObject(value, addonID);
							}

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

		let result = wrapAllowlist(target, schema, { mutable, strong });
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
	createSafeWindowCallable(func, thisArg, addonID, { rootNode, argValidator } = {}) {
		let scope = PluginSandbox.getScope(addonID);
		return ScopeUtils.ensureCallableInScope(
			func,
			thisArg,
			scope,
			{
				argParser(args) {
					if (typeof argValidator === "function" && !argValidator(args)) {
						return null;
					}
					return WindowScopeVariables.unwrapDOMArguments(args, addonID, { rootNode });
				},
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

		// addEventListener / removeEventListener need the callback-wrapping
		// logic from createSafeWindowCallable so that event handlers receive
		// safe Event wrappers and the correct handler identity is preserved
		// for removal.  They are added manually (like `document`) rather than
		// through the schema so that `rootNode` is forwarded.
		for (let method of ["addEventListener", "removeEventListener"]) {
			Object.defineProperty(wrapper, method, {
				value: WindowScopeVariables.createSafeWindowCallable(
					win[method], win, addonID, { rootNode }
				),
				enumerable: true,
				configurable: false,
				writable: false,
			});
		}

		// Expose read-only size/position properties
		for (let prop of [
			"innerWidth",
			"innerHeight",
			"outerWidth",
			"outerHeight",
			"scrollX",
			"scrollY",
			"screenX",
			"screenY",
			"devicePixelRatio",
			"screen",
		]) {
			let holder = Cu.createObjectIn(scope);
			Cu.exportFunction(() => win[prop], holder, { defineAs: "g" });
			Object.defineProperty(wrapper, prop, {
				get: holder.g,
				enumerable: true,
				configurable: false,
			});
		}

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

						if (WindowScopeVariables.UNSAFE_TAGS.has(localName.toLowerCase())) {
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

		// Add createFrame for chrome documents with a registered protocol
		let rootURI = PluginProtocol.getBaseURI(addonID);
		if (typeof doc.createXULElement === "function" && rootURI) {
			Cu.exportFunction(
				(url, onLoad) => {
					let actualDoc = docRef.deref();
					if (!actualDoc) {
						VarCheck.throwPropError("access", "document", "object has been garbage collected");
					}

					let resolved;
					try {
						resolved = new URL(String(url || ""), rootURI).href;
					}
					catch {
						throw new Error(`Invalid URL: ${url}`);
					}
					if (!resolved.startsWith(rootURI)) {
						throw new Error(`URL must be within plugin root: ${url}`);
					}
					let pathname = new URL(resolved).pathname.toLowerCase();
					if (!pathname.endsWith(".html") && !pathname.endsWith(".htm")) {
						throw new Error(`Only .html files are allowed: ${url}`);
					}

					let browser = actualDoc.createXULElement("browser");
					browser.setAttribute("type", "content");
					browser.setAttribute("remote", "false");
					browser.setAttribute("disableglobalhistory", "true");

					// Defer loading until the element is connected to the document.
					// The <browser> custom element creates its docshell in
					// connectedCallback (synchronous during appendChild). The
					// MutationObserver fires as a microtask after appendChild
					// returns, so the docshell is ready by then.
					let observer = new actualDoc.defaultView.MutationObserver((_mutations, obs) => {
						if (!browser.isConnected) return;
						obs.disconnect();

						let nsURI = Services.io.newURI(resolved);
						let principal = Services.scriptSecurityManager
							.createContentPrincipal(nsURI, {});

						browser.addProgressListener({
							QueryInterface: ChromeUtils.generateQI([
								Ci.nsIWebProgressListener,
								Ci.nsISupportsWeakReference,
							]),
							onStateChange(_wp, _req, flags, status) {
								if ((flags & Ci.nsIWebProgressListener.STATE_STOP)
									&& (flags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)
									&& Components.isSuccessCode(status)) {
									WindowScopeVariables.setupContentL10n(browser).then(() => {
										if (typeof onLoad === "function") {
											onLoad(browser.contentWindow);
										}
									});
								}
							},
							onLocationChange() {},
							onProgressChange() {},
							onStatusChange() {},
							onSecurityChange() {},
							onContentBlockingEvent() {},
						}, Ci.nsIWebProgress.NOTIFY_ALL);

						browser.loadURI(nsURI, {
							triggeringPrincipal: principal,
						});
					});
					observer.observe(actualDoc.documentElement, { childList: true, subtree: true });

					return WindowScopeVariables.createSafeHTMLElement(browser, addonID, { rootNode });
				},
				wrapper,
				{ defineAs: "createFrame" }
			);
		}

		if (typeof doc.createDocumentFragment === "function") {
			Cu.exportFunction(
				() => {
					let actualDoc = docRef.deref();
					if (!actualDoc) {
						VarCheck.throwPropError("access", "document", "object has been garbage collected");
					}
					let fragment = actualDoc.createDocumentFragment();
					return WindowScopeVariables.createSafeHTMLElement(fragment, addonID, { rootNode });
				},
				wrapper,
				{ defineAs: "createDocumentFragment" }
			);
		}

		// addEventListener / removeEventListener need the callback-wrapping
		// logic from createSafeWindowCallable so that event handlers receive
		// safe Event wrappers and the correct handler identity is preserved
		// for removal.
		for (let method of ["addEventListener", "removeEventListener"]) {
			Object.defineProperty(wrapper, method, {
				value: WindowScopeVariables.createSafeWindowCallable(
					doc[method], doc, addonID, { rootNode }
				),
				enumerable: true,
				configurable: false,
				writable: false,
			});
		}

		// DOM query methods -- results are filtered to the rootNode subtree
		[
			"getElementById",
			"getElementsByClassName",
			"getElementsByName",
			"getElementsByTagName",
			"getElementsByTagNameNS",
			"querySelector",
			"querySelectorAll",
		].forEach((method) => {
			if (typeof doc[method] !== "function") return;
			Cu.exportFunction(
				(...args) => {
					let actualDoc = docRef.deref();
					if (!actualDoc) {
						VarCheck.throwPropError("access", "document", "object has been garbage collected");
					}
					let result = actualDoc[method](...args);
					return WindowScopeVariables.createSafeWindowObjectOrList(result, addonID, { rootNode });
				},
				wrapper,
				{ defineAs: method }
			);
		});

		if (doc.l10n) {
			wrapper.l10n = ScopeVariables.createAllowlistMirrorObject(
				doc.l10n, { addResourceIds: true, removeResourceIds: true }, addonID
			);
		}

		Object.preventExtensions(wrapper);
		return wrapper;
	},

	/**
	 * Set up l10n on a content document inside a <browser> element.
	 * Creates a DOMLocalization, connects it to the document root,
	 * auto-detects <link rel="localization"> tags, and sets document.l10n.
	 *
	 * @param {XULElement} browser - The <browser> element containing the content
	 * @returns {Promise} Resolves when initial translation is complete
	 */
	setupContentL10n(browser) {
		let contentDoc = browser.contentDocument;
		let contentWin = browser.contentWindow;
		let l10n = new contentWin.DOMLocalization([], false);
		l10n.connectRoot(contentDoc.documentElement);

		// Collect initial <link rel="localization"> resource IDs
		let links = contentDoc.querySelectorAll('link[rel="localization"]');
		if (links.length) {
			l10n.addResourceIds(
				Array.from(links).map(link => link.getAttribute('href'))
			);
		}

		// Observe <link rel="localization"> additions/removals to mirror
		// the DocumentL10n behavior that chrome documents get natively.
		let observer = new contentWin.MutationObserver((mutations) => {
			let addIds = [];
			let removeIds = [];
			for (let mutation of mutations) {
				for (let node of mutation.addedNodes) {
					if (node.nodeName === "LINK"
						&& node.getAttribute("rel") === "localization"
						&& node.getAttribute("href")) {
						addIds.push(node.getAttribute("href"));
					}
				}
				for (let node of mutation.removedNodes) {
					if (node.nodeName === "LINK"
						&& node.getAttribute("rel") === "localization"
						&& node.getAttribute("href")) {
						removeIds.push(node.getAttribute("href"));
					}
				}
			}
			if (removeIds.length) {
				l10n.removeResourceIds(removeIds);
			}
			if (addIds.length) {
				l10n.addResourceIds(addIds);
			}
			if (addIds.length || removeIds.length) {
				l10n.translateRoots();
			}
		});
		observer.observe(contentDoc.documentElement, {
			childList: true,
			subtree: true,
		});

		// Clean up when the content window is closed
		contentWin.addEventListener("unload", () => {
			observer.disconnect();
			l10n.disconnectRoot(contentDoc.documentElement);
		}, { once: true });

		Cu.waiveXrays(contentDoc).l10n = l10n;
		return l10n.translateRoots();
	},

	createSafeEvent(event, addonID, { rootNode } = {}) {
		let scope = PluginSandbox.getScope(addonID);

		if (VarCheck.isPrivilegedScope(scope)) {
			return event;
		}

		// DOM-referencing properties that need special wrapping
		let DOMProps = new Set(["target", "currentTarget", "relatedTarget"]);
		let DOMPropMethods = new Set(["composedPath"]);
		let DOMOverrides = new Set([...DOMProps, ...DOMPropMethods]);

		// Build schema excluding DOM properties we'll handle separately
		let schema = {};
		for (let key of VarCheck.getAllKeysIncludingPrototypes(event)) {
			if (!DOMOverrides.has(key)) {
				schema[key] = true;
			}
		}

		let wrappedEvent = ScopeVariables.createAllowlistMirrorObject(event, schema, addonID, { mutable: true });

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
						// Block setAttribute/setAttributeNS from setting on* event handlers
						if (prop === "setAttribute" || prop === "setAttributeNS") {
							let nameArgIndex = prop === "setAttributeNS" ? 1 : 0;
							return WindowScopeVariables.createSafeWindowCallable(value, actual, addonID, {
								rootNode,
								argValidator(args) {
									let attrName = String(args[nameArgIndex] || "");
									if (/^on/i.test(attrName)) {
										Zotero.warn(`Setting ${attrName} attribute is not allowed for unprivileged plugins. Use addEventListener() instead.`);
										return false;
									}
									return true;
								},
							});
						}
						return WindowScopeVariables.createSafeWindowCallable(value, actual, addonID, { rootNode });
					}

					let wrapped = WindowScopeVariables.createSafeWindowObjectOrList(value, addonID, { rootNode });
					if (wrapped !== value) {
						return wrapped;
					}

					if (VarCheck.isObjectLike(value)) {
						// DOMStringMap (dataset) has arbitrary string keys that are unknown at
						// wrap time, so a static allowlist wrapper cannot cover them.
						// Use a minimal Proxy in the sandbox scope that forwards get/set directly.
						if (prop === "dataset") {
							let mapGet = Cu.exportFunction(k => value[String(k)], scope);
							let mapSet = Cu.exportFunction((k, v) => value[String(k)] = String(v), scope);
							let mapDel = Cu.exportFunction(k => delete value[String(k)], scope);
							let makeDatasetProxy = Cu.evalInSandbox(`
								(function(get, set, del) {
									return new Proxy({}, {
										get(target, key) { return get(key); },
										set(target, key, value) { set(key, value); return true; },
										deleteProperty(target, key) { del(key); return true; },
									});
								})
							`, scope);
							return makeDatasetProxy(mapGet, mapSet, mapDel);
						}
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
					if (/^on/i.test(prop)) {
						Zotero.warn(`Setting ${prop} directly is not allowed for unprivileged plugins. Use addEventListener() instead.`);
						return false;
					}
					if (prop === "outerHTML") {
						VarCheck.throwPropError("set", prop);
					}
					// Sanitize HTML strings to strip unsafe tags and on* event handlers.
					if (prop === "innerHTML") {
						if (typeof value !== "string") {
							VarCheck.throwPropError("set", prop, "value must be a string");
						}
						let doc = actual.ownerDocument;
						let parser = new doc.defaultView.DOMParser();
						let fragment = doc.createDocumentFragment();
						let useXML = false;
						let xmlParsed = parser.parseFromSafeString(
							`<div xmlns="http://www.w3.org/1999/xhtml"
								 xmlns:html="http://www.w3.org/1999/xhtml"
								 xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
							${value}
							</div>`,
							"application/xml"
						);
						if (xmlParsed.documentElement.localName !== "parsererror") {
							useXML = true;
							for (let child of Array.from(xmlParsed.documentElement.childNodes)) {
								fragment.appendChild(doc.importNode(child, true));
							}
						}
						else {
							let htmlParsed = parser.parseFromSafeString(`<div>${value}</div>`, "text/html");
							for (let child of Array.from(htmlParsed.querySelector("div").childNodes)) {
								fragment.appendChild(doc.importNode(child, true));
							}
						}
						WindowScopeVariables.sanitizeFragment(fragment, addonID);
						let result;
						if (useXML) {
							// Directly replace children to preserve namespace information.
							// Re-serializing to string and setting innerHTML would re-parse
							// through the HTML parser, stripping namespace metadata.
							while (actual.firstChild) actual.removeChild(actual.firstChild);
							actual.appendChild(fragment);
							result = true;
						}
						else {
							let tmp = doc.createElement("div");
							tmp.appendChild(fragment);
							value = tmp.innerHTML;
							result = Reflect.set(actual, prop, value);
						}
						WindowScopeVariables.activateWhenConnected(actual, addonID);
						return result;
					}
					return Reflect.set(actual, prop, WindowScopeVariables.unwrapDOMNode(value));
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
					// Call the original function with wrapped arguments.
					// Use Reflect.apply to avoid cross-compartment issues with the args array.
					let scope = PluginSandbox.getScope(addonID);
					let scopeArgs = Cu.cloneInto([], scope);
					for (let a of wrappedArgs) scopeArgs.push(a);
					let result = arg.apply(this, scopeArgs);
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
			if (VarCheck.isArrayLike(arg)) {
				let items = Array.from(arg);
				if (items.some(item => WindowScopeVariables.isWrappedDOMNode(item))) {
					return items.map(item => WindowScopeVariables.unwrapDOMNode(item));
				}
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

	UNSAFE_TAGS: new Set([
		"script",
		"browser",
		"iframe",
		"object",
		"embed",
		"meta",
	]),

	// Pre-compiled CSS selector for all known on* event-handler attributes from
	// Firefox nsGkAtomList.h. Used by sanitizeFragment to avoid querying
	// every element in the tree.
	// Generated with:
	//   curl -s 'https://searchfox.org/firefox-esr140/raw/__GENERATED__/xpcom/ds/nsGkAtomList.h' \
	//     | awk -F'"' '/^GK_ATOM\(on[a-z]/ {print $2}' | grep -v '^only$' | sort -u \
	//     | awk '{printf "%s,", "*["$1"]"}' | sed 's/,$//'
	ON_EVENT_ATTRS_SELECTOR: "*[onabort],*[onactivate],*[onactivated],*[onaddsourcebuffer],*[onaddtrack],*[onafterprint],*[onafterscriptexecute],*[onanimationcancel],*[onanimationend],*[onanimationiteration],*[onanimationstart],*[onaudioend],*[onaudioprocess],*[onaudiostart],*[onauxclick],*[onbeforecopy],*[onbeforecut],*[onbeforeinput],*[onbeforematch],*[onbeforepaste],*[onbeforeprint],*[onbeforescriptexecute],*[onbeforetoggle],*[onbeforeunload],*[onbegin],*[onbeginEvent],*[onblocked],*[onblur],*[onboundary],*[onboundschange],*[onbroadcast],*[onbufferedamountlow],*[oncached],*[oncancel],*[oncanplay],*[oncanplaythrough],*[onchange],*[onchargingchange],*[onchargingtimechange],*[onchecking],*[onclick],*[onclose],*[oncommand],*[oncommandupdate],*[oncomplete],*[oncompositionend],*[oncompositionstart],*[oncompositionupdate],*[onconnect],*[onconnectionavailable],*[oncontentvisibilityautostatechange],*[oncontextlost],*[oncontextmenu],*[oncontextrestored],*[oncontrollerchange],*[oncookiechange],*[oncopy],*[oncuechange],*[oncurrententrychange],*[oncut],*[ondata],*[ondataavailable],*[ondblclick],*[ondeactivated],*[ondequeue],*[ondevicechange],*[ondevicelight],*[ondevicemotion],*[ondeviceorientation],*[ondeviceorientationabsolute],*[ondischargingtimechange],*[ondispose],*[ondownloading],*[ondrag],*[ondragdrop],*[ondragend],*[ondragenter],*[ondragexit],*[ondragleave],*[ondragover],*[ondragstart],*[ondrain],*[ondrop],*[ondurationchange],*[onemptied],*[onencrypted],*[onend],*[onendEvent],*[onended],*[onenter],*[onerror],*[onexit],*[onfetch],*[onfinish],*[onfocus],*[onfocusin],*[onfocusout],*[onformdata],*[onfullscreenchange],*[onfullscreenerror],*[ongamepadaxismove],*[ongamepadbuttondown],*[ongamepadbuttonup],*[ongamepadconnected],*[ongamepaddisconnected],*[ongatheringstatechange],*[onget],*[ongotpointercapture],*[onhashchange],*[oninput],*[oninputsourceschange],*[oninstall],*[oninvalid],*[onkeydown],*[onkeypress],*[onkeystatuseschange],*[onkeyup],*[onlanguagechange],*[onlevelchange],*[onload],*[onloadeddata],*[onloadedmetadata],*[onloadend],*[onloading],*[onloadingdone],*[onloadingerror],*[onloadstart],*[onlostpointercapture],*[onmark],*[onmerchantvalidation],*[onmessage],*[onmessageerror],*[onmetadatachange],*[onmidimessage],*[onmousedown],*[onmouseenter],*[onmouseleave],*[onmouselongtap],*[onmousemove],*[onmouseout],*[onmouseover],*[onmouseup],*[onmousewheel],*[onmozaccesskeynotfound],*[onmozfullscreenchange],*[onmozfullscreenerror],*[onmozorientationchange],*[onmozpointerlockchange],*[onmozpointerlockerror],*[onmozshowdropdown],*[onmozshowdropdown-sourcetouch],*[onmozvisualresize],*[onmozvisualscroll],*[onmute],*[onnavigate],*[onnavigateerror],*[onnavigatesuccess],*[onnomatch],*[onnotificationclick],*[onnotificationclose],*[onnoupdate],*[onobsolete],*[onoffline],*[ononline],*[onopen],*[onorientationchange],*[onoverflow],*[onpagehide],*[onpageshow],*[onpaste],*[onpause],*[onpayerdetailchange],*[onpaymentmethodchange],*[onphoto],*[onplay],*[onplaybackstatechange],*[onplaying],*[onpointercancel],*[onpointerdown],*[onpointerenter],*[onpointerleave],*[onpointerlockchange],*[onpointerlockerror],*[onpointermove],*[onpointerout],*[onpointerover],*[onpointerrawupdate],*[onpointerup],*[onpopstate],*[onpopuphidden],*[onpopuphiding],*[onpopuppositioned],*[onpopupshowing],*[onpopupshown],*[onpositionstatechange],*[onprintPreviewUpdate],*[onprioritychange],*[onprocessorerror],*[onprogress],*[onpush],*[onpushsubscriptionchange],*[onratechange],*[onreadystatechange],*[onrejectionhandled],*[onrelease],*[onremove],*[onremovesourcebuffer],*[onremovetrack],*[onrepeat],*[onrepeatEvent],*[onrequestprogress],*[onreset],*[onresize],*[onresourcetimingbufferfull],*[onresponseprogress],*[onresult],*[onresume],*[onrtctransform],*[onscroll],*[onscrollend],*[onsecuritypolicyviolation],*[onseeked],*[onseeking],*[onselect],*[onselectend],*[onselectionchange],*[onselectstart],*[onset],*[onshippingaddresschange],*[onshippingoptionchange],*[onshow],*[onslotchange],*[onsoundend],*[onsoundstart],*[onsourceclose],*[onsourceended],*[onsourceopen],*[onspeechend],*[onspeechstart],*[onsqueeze],*[onsqueezeend],*[onsqueezestart],*[onstalled],*[onstart],*[onstatechange],*[onstop],*[onstorage],*[onsubmit],*[onsuccess],*[onsupportedkeyschange],*[onsuspend],*[onsystemstatusbarclick],*[onterminate],*[ontext],*[ontextInput],*[ontimeout],*[ontimeupdate],*[ontoggle],*[ontonechange],*[ontouchcancel],*[ontouchend],*[ontouchmove],*[ontouchstart],*[ontransitioncancel],*[ontransitionend],*[ontransitionrun],*[ontransitionstart],*[ontypechange],*[onuncapturederror],*[onunderflow],*[onunhandledrejection],*[onunload],*[onunmute],*[onupdate],*[onupdateend],*[onupdatefound],*[onupdateready],*[onupdatestart],*[onupgradeneeded],*[onuserproximity],*[onversionchange],*[onvisibilitychange],*[onvoiceschanged],*[onvolumechange],*[onvrdisplayactivate],*[onvrdisplayconnect],*[onvrdisplaydeactivate],*[onvrdisplaydisconnect],*[onvrdisplaypresentchange],*[onwaiting],*[onwaitingforkey],*[onwarning],*[onwebkitAnimationEnd],*[onwebkitAnimationIteration],*[onwebkitAnimationStart],*[onwebkitTransitionEnd],*[onwebkitanimationend],*[onwebkitanimationiteration],*[onwebkitanimationstart],*[onwebkittransitionend],*[onwheel],*[onzoom]",

	/**
	 * Sanitize a parsed DOM fragment by removing unsafe elements and
	 * stripping inline event-handler attributes (on*).
	 * Operates on an already-parsed DocumentFragment (from
	 * MozXULElement.parseXULToFragment or DOMParser).
	 *
	 * Only sanitizes unprivileged plugins. If pluginID is provided and
	 * the plugin is privileged, the fragment is returned unchanged.
	 *
	 * @param {DocumentFragment} fragment - The fragment to sanitize in place
	 * @param {string} [pluginID] - Plugin ID to check privilege level
	 * @returns {DocumentFragment} The same fragment, sanitized
	 */
	sanitizeFragment(fragment, pluginID) {
		if (!pluginID) return fragment;
		let scope = PluginSandbox.getScope(pluginID);
		if (!scope || VarCheck.isPrivilegedScope(scope)) return fragment;

		// Remove unsafe elements via querySelectorAll (faster than tree walking)
		let unsafeSelector = Array.from(this.UNSAFE_TAGS).join(",");
		for (let node of fragment.querySelectorAll(unsafeSelector)) {
			node.remove();
		}

		// Convert on* attributes to data-sandbox-on-* for post-insertion activation.
		// Use the pre-compiled ON_EVENT_ATTRS_SELECTOR to visit only elements that
		// actually carry one of the known event-handler attributes, avoiding a full
		// tree walk over every node.
		for (let node of fragment.querySelectorAll(this.ON_EVENT_ATTRS_SELECTOR)) {
			for (let attr of Array.from(node.attributes)) {
				if (/^on/i.test(attr.localName)) {
					let eventName = attr.localName.slice(2);
					node.removeAttribute(attr.name);
					if (pluginID) {
						node.setAttribute(`data-sandbox-on-${eventName}`, attr.value);
						node.classList.add("_sandbox-has-handlers");
					}
				}
			}
		}

		return fragment;
	},

	/**
	 * Activate inline event handlers that were converted to data-sandbox-on-*
	 * attributes by sanitizeFragment. Must be called after the element is
	 * inserted into the document (after importNode).
	 *
	 * @param {Element} root - The root element to walk
	 * @param {string} pluginID - Plugin ID for sandbox scope lookup
	 */
	activateInlineHandlers(root, pluginID) {
		if (!pluginID) return;
		let scope = PluginSandbox.getScope(pluginID);
		if (!scope || VarCheck.isPrivilegedScope(scope)) return;

		// Only process elements marked by sanitizeFragment
		for (let node of root.querySelectorAll("._sandbox-has-handlers")) {
			node.classList.remove("_sandbox-has-handlers");
			for (let attr of Array.from(node.attributes)) {
				let match = attr.localName.match(/^data-sandbox-on-(.+)$/);
				if (!match) continue;
				let eventName = match[1];
				let handlerCode = attr.value;
				node.removeAttribute(attr.name);

				let fn = Cu.evalInSandbox(
					`(function(event) { ${handlerCode} })`,
					scope
				);
				let rootNode = new WeakRef(node);
				node.addEventListener(eventName, function (realEvent) {
					let wrappedThis = WindowScopeVariables.createSafeHTMLElement(
						this, pluginID, { rootNode }
					);
					let wrappedEvent = WindowScopeVariables.createSafeEvent(
						realEvent, pluginID, { rootNode }
					);
					fn.call(wrappedThis, wrappedEvent);
				});
			}
		}
	},

	/**
	 * Call activateInlineHandlers once elem is connected to the DOM.
	 * If already connected, activates immediately; otherwise sets up a
	 * one-shot MutationObserver on the document to detect insertion.
	 *
	 * @param {Element} elem
	 * @param {string} pluginID
	 */
	activateWhenConnected(elem, pluginID) {
		if (!pluginID) return;
		let scope = PluginSandbox.getScope(pluginID);
		if (!scope || VarCheck.isPrivilegedScope(scope)) return;

		if (elem.isConnected) {
			WindowScopeVariables.activateInlineHandlers(elem, pluginID);
			return;
		}
		let doc = elem.ownerDocument;
		let observer = new doc.defaultView.MutationObserver(() => {
			if (elem.isConnected) {
				observer.disconnect();
				WindowScopeVariables.activateInlineHandlers(elem, pluginID);
			}
		});
		observer.observe(doc.documentElement || doc, { childList: true, subtree: true });
	},
};

export { ScopeVariables, WindowScopeVariables };
