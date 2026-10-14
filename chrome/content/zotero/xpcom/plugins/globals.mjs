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
import { ScopeUtils, VarCheck, INSTANCE_PROXY_FACTORY, resolvePluginPage } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { ScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";
import { PluginFileAccess } from "chrome://zotero/content/xpcom/plugins/file.mjs";
import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";
import { loadPluginPageInBrowser, stopAutoResize } from "chrome://zotero/content/xpcom/plugins/embeddedPage.mjs";

const lazy = XPCOMUtils.declareLazy({
	ConsoleAPI: "resource://gre/modules/Console.sys.mjs",
	FilePicker: "chrome://zotero/content/modules/filePicker.mjs",
});


/**
 * Set up a lazy `console` global on the sandbox scope.
 *
 * @param {Object} scope - The sandbox scope
 * @param {Object} addon - The addon instance from AddonManager (needed for display name)
 */
// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/ExtensionCommon.sys.mjs#60
function setupConsole(scope, addon) {
	let pluginID = scope.PLUGIN_ID;
	ChromeUtils.defineLazyGetter(scope, "console", () => {
		let console = new lazy.ConsoleAPI({
			prefix: `${addon.name} (${addon.id}):\n`,
		});
		return ScopeVariables.createAllowlistMirrorObject(console, true, pluginID, { cache: true, strong: true, pathPrefix: "console" });
	});
}

/**
 * Attach the instance-facade Proxy factory to the scope for `_ensureInstanceInScope`
 *
 * @param {Object} scope - The sandbox scope
 */
function setupInstanceProxy(scope) {
	let makeProxy = Cu.evalInSandbox(
		`(t) => new Proxy(Object.create(null), {
			get: t.get, set: t.set, has: t.has, ownKeys: t.ownKeys,
			getOwnPropertyDescriptor: t.getOwnPropertyDescriptor,
			deleteProperty: t.deleteProperty, defineProperty: t.defineProperty,
		})`,
		scope
	);
	Object.defineProperty(scope, INSTANCE_PROXY_FACTORY, {
		value: makeProxy,
		enumerable: false,
		configurable: false,
		writable: false,
	});
}

const ALLOWED_WINDOW_FEATURES = new Set([
	"width",
	"height",
	"left",
	"top",
	"centerscreen",
	"resizable",
	"minimizable",
	"alwaysontop",
]);

function sanitizeFeatures(features) {
	let values = {};
	let parts = [];
	for (let raw of String(features || "").split(",")) {
		let s = raw.trim();
		if (!s) continue;
		let eq = s.indexOf("=");
		let name = (eq === -1 ? s : s.slice(0, eq)).trim().toLowerCase();
		if (!ALLOWED_WINDOW_FEATURES.has(name)) continue;
		let value = eq === -1 ? "" : s.slice(eq + 1).trim();
		let low = value.toLowerCase();
		if (value === "" || low === "yes" || low === "1" || low === "true") {
			values[name] = true;
		}
		else if (low === "no" || low === "0" || low === "false") {
			values[name] = false;
		}
		else {
			values[name] = value;
		}
		parts.push(value === "" ? name : `${name}=${value}`);
	}
	return { str: parts.join(","), values };
}

/**
 * Set up `openWindow` on an unprivileged plugin scope: a chrome wrapper window
 * hosts the plugin's HTML page, driven over a page messenger.
 *
 * @param {Object} scope - The sandbox scope to attach `openWindow` to
 */
function setupOpenWindow(scope) {
	let pluginID = scope.PLUGIN_ID;
	let holder = Cu.createObjectIn(scope);
	Cu.exportFunction(
		(url, features, options = {}) => {
			let { windowId, fitContent, notitle } = Cu.waiveXrays(options);
			if (windowId !== null && windowId !== undefined && typeof windowId !== "string") {
				throw new Error("openWindow: windowId must be a string");
			}

			let resolved = resolvePluginPage(pluginID, url);
			if (!resolved) {
				throw new Error(`openWindow: url must be an .html page within the plugin: ${url}`);
			}

			let { str: safeFeatures, values: featureValues } = sanitizeFeatures(features);

			// Open a chrome wrapper window with a <browser> element for the plugin's HTML content
			let resizable = featureValues.resizable !== false;
			let chromeFeatures = "chrome,dialog=no,"
				+ (safeFeatures || "resizable");
			// Use custom notitle style because the `titlebar=no` feature is ugly
			let windowArgs = { notitle: !!notitle };
			let win = Services.ww.openWindow(
				null,
				"chrome://zotero/content/pluginWindow.xhtml",
				null,
				chromeFeatures,
				windowArgs
			);

			return new scope.Promise((resolve, reject) => {
				win.addEventListener("load", async () => {
					try {
						let browser = win.document
							.getElementById("plugin-browser");

						// Initialize the plugin window (title sync, menus, lifecycle)
						win.PluginWindow.init(windowId, pluginID);

						let { messenger, dispose } = await loadPluginPageInBrowser(browser, resolved, {
							channel: true,
							pluginID,
							// The page actor keeps the browser at the document scroll size
							autoResize: fitContent ? { height: true, width: true, content: true } : {},
							// The page can close its own window as zoteroHost.api.close()
							hostAPI: {
								close: () => {
									win.close();
								},
							},
						});
						if (!messenger) {
							win.close();
							reject(new scope.Error(`openWindow: failed to load ${url}`));
							return;
						}
						win.addEventListener("unload", dispose, { once: true });

						browser.addEventListener("contextmenu", (event) => {
							let t = event.target;
							if (t && t.closest
									&& t.closest("input, textarea, [contenteditable]")) {
								return;
							}
							event.preventDefault();
						});

						browser.focus();

						if (fitContent) {
							// Fit the window once the actor applies the first size to the
							// browser's style; until then flex keeps the feature-string size
							let mo = new win.MutationObserver(() => {
								mo.disconnect();
								browser.removeAttribute("flex");
								win.sizeToContent();
								if (resizable) {
									// Fit once, then the user owns the window size
									stopAutoResize(browser);
								}
								else {
									// Keep the window following the content size
									let ro = new win.ResizeObserver(Zotero.Utilities.debounce(
										() => win.sizeToContent(), 100));
									ro.observe(browser);
									win.addEventListener("unload", () => ro.disconnect(), { once: true });
								}
							});
							mo.observe(browser, { attributes: true, attributeFilter: ["style"] });
							win.addEventListener("unload", () => mo.disconnect(), { once: true });
						}

						// window: the page's own same-origin window, passed raw
						resolve(ScopeVariables.toScope({
							page: messenger,
							window: browser.contentWindow,
							close: () => !win.closed && win.close(),
							focus: () => !win.closed && win.focus(),
						}, pluginID));
					}
					catch (e) {
						Zotero.logError(e);
						try {
							win.close();
						}
						catch {}
						reject(new scope.Error(`openWindow: ${e?.message || e}`));
					}
				}, { once: true });
			});
		},
		holder,
		{ defineAs: "f" }
	);
	scope.openWindow = holder.f;
}

/**
 * Set up Zotero.HTTP on the plugin scope.
 * Uses a XHR factory created inside the sandbox so instances carry the
 * sandbox's restricted principal (constrained by allowedOrigins from
 * host_permissions). Firefox's built-in principal security enforces
 * URL access control.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupHTTP(scope) {
	let createXHR = Cu.evalInSandbox("() => new XMLHttpRequest()", scope);
	let pluginID = scope.PLUGIN_ID;

	let HTTP = Cu.createObjectIn(scope);

	for (let name of ["request", "processDocuments"]) {
		HTTP[name] = ScopeUtils.ensureCallableInScope(
			Zotero.HTTP[name], Zotero.HTTP, scope, {
				mutable: true,
				argParser: (args) => {
					// Inject sandbox XHR factory into options
					if (!args[2] || typeof args[2] !== "object") {
						args[2] = {};
					}
					args[2].createXMLHttpRequest = createXHR;
					args[2].noMock = true;
					return args;
				},
				trace: { pluginID, path: `Zotero.HTTP.${name}` },
			}
		);
	}

	Object.defineProperty(scope.Zotero, "HTTP", {
		value: HTTP,
		enumerable: true,
		configurable: false,
		writable: false,
	});
}

const PREFS_METHODS = {
	get: ["key", "global"],
	set: ["key", "value", "global"],
	clear: ["key", "global"],
};

const FORBIDDEN_PREF_PREFIXES = [
	"extensions.zotero.pluginFileAccess.",
	"extensions.zotero.pluginNames.",
	"extensions.zotero.dataDir",
	"extensions.update.",
	"extensions.blocklist.",
	"security.",
	"network.",
	"services.",
	"signon.",
	"app.update.",
	"datareporting.",
	"toolkit.telemetry.",
	"privacy.",
	"devtools.",
];

const EXACT_MATCH_ONLY_PREF_PREFIXES = [
	"extensions.zotero.sync.",
];

function isAllowedPrefPrefix(prefix) {
	for (let p of FORBIDDEN_PREF_PREFIXES) {
		if (prefix.startsWith(p) || p.startsWith(prefix)) {
			return false;
		}
	}
	if (prefix.endsWith(".")) {
		for (let p of EXACT_MATCH_ONLY_PREF_PREFIXES) {
			if (prefix.startsWith(p) || p.startsWith(prefix)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Set up Zotero.Prefs on the plugin scope with access control.
 *
 * The "preferences" permission exposes the Zotero.Prefs API.
 * By default, plugins can only access preferences in their own namespace,
 * `extensions.<PLUGIN_UUID>.*`. Additional namespaces can be granted via the `pref_permissions`
 * in the manifest.
 * The `global` argument behavior is different from the main Zotero.Prefs API:
 * If `global` is true, the key is used as-is and must match an allowed namespace.
 * If `global` is false or omitted, the plugin's own namespace is prefixed to the key.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupPreferences(scope) {
	let pluginID = scope.PLUGIN_ID;
	let prefPrefixes = scope.PREF_PERMISSIONS;

	// Plugin's own namespace
	let ownPrefix = `extensions.${PluginUUID.getByID(pluginID)}.`;
	let declaredPrefixes = Array.from(prefPrefixes || []).filter(
		p => typeof p === "string" && p.length > 0
	);
	declaredPrefixes = declaredPrefixes.filter((p) => {
		if (!isAllowedPrefPrefix(p)) {
			Zotero.warn(
				`Plugin ${pluginID}: ignoring reserved pref in pref_permission "${p}"`
			);
			return false;
		}
		return true;
	});
	let allPrefixes = [ownPrefix, ...declaredPrefixes];

	// Require a trailing "." for prefix matches so "extensions.zo" can't
	// silently cover all of "extensions.zotero.*".
	function prefixMatches(prefix, pref) {
		if (pref === prefix) return true;
		if (prefix.endsWith(".") && pref.startsWith(prefix)) return true;
		return false;
	}

	function checkPrefPermission(pref) {
		if (allPrefixes.some(prefix => prefixMatches(prefix, pref))) {
			return;
		}
		throw new Error(
			`Permission denied: cannot access preference "${pref}". Declare it in "pref_permissions".`
		);
	}

	let Prefs = Cu.createObjectIn(scope);

	// get, set, clear
	for (let [method, sig] of Object.entries(PREFS_METHODS)) {
		let keyIndex = sig.indexOf("key");
		let globalIndex = sig.indexOf("global");

		Prefs[method] = ScopeUtils.ensureCallableInScope(
			Zotero.Prefs[method], Zotero.Prefs, scope, {
				argParser: (args) => {
					// Auto-prefix with ownPrefix (plugin's namespace)
					if (!args[globalIndex]) {
						args[keyIndex] = ownPrefix + args[keyIndex];
					}
					// Use as-is, gated by pref_permissions
					else {
						checkPrefPermission(args[keyIndex]);
					}
					// Always call with global=true
					args[globalIndex] = true;
					return args;
				},
				trace: { pluginID, path: `Zotero.Prefs.${method}` },
			}
		);
	}

	// resetBranch(exclude, branch)
	Prefs.resetBranch = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.resetBranch, Zotero.Prefs, scope, {
			argParser: (args) => {
				let branch = args[1];
				if (!branch) {
					throw new Error(
						'Permission denied: cannot reset entire preference branch.'
					);
				}
				checkPrefPermission(branch);
				if (EXACT_MATCH_ONLY_PREF_PREFIXES.some(
					p => p.startsWith(branch) || branch.startsWith(p)
				)) {
					throw new Error(
						`Permission denied: cannot reset reserved branch "${branch}".`
					);
				}
				return args;
			},
			trace: { pluginID, path: "Zotero.Prefs.resetBranch" },
		}
	);

	// registerObserver(name, handler, global)
	let registerObserverTrace = { pluginID, path: "Zotero.Prefs.registerObserver" };
	Prefs.registerObserver = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.registerObserver, Zotero.Prefs, scope, {
			argParser: (args) => {
				if (!args[2]) {
					args[0] = ownPrefix + args[0];
				}
				else {
					checkPrefPermission(args[0]);
				}
				args[1] = ScopeVariables.fromScope(args[1], pluginID, { trace: registerObserverTrace });
				args[2] = true;
				return args;
			},
			trace: registerObserverTrace,
		}
	);

	// unregisterObserver(symbol)
	Prefs.unregisterObserver = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.unregisterObserver, Zotero.Prefs, scope, {
			trace: { pluginID, path: "Zotero.Prefs.unregisterObserver" },
		}
	);

	Object.defineProperty(scope.Zotero, "Prefs", {
		value: Prefs,
		enumerable: true,
		configurable: false,
		writable: false,
	});
}

/**
 * Set up the `FilePicker` constructor on the plugin scope. `init` only
 * parents to a plugin-held window; anything else gets the hidden window.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFilePicker(scope) {
	let pluginID = scope.PLUGIN_ID;
	let canWrite = scope.PERMISSIONS.includes("fileSystemWrite");
	let { FilePicker } = lazy;
	class PluginFilePicker extends FilePicker {
		init(parentWindow, title, mode) {
			let win = ScopeVariables.fromScope(parentWindow, pluginID);
			if (!VarCheck.isWindowObject(win) || win.closed) {
				win = Services.appShell.hiddenDOMWindow;
			}
			this._pluginMode = mode;
			return super.init(win, title, mode);
		}

		// After the user picks file(s)/folder, auto-grant access in the current session.
		async show() {
			let result = await super.show();
			if (result === this.returnOK || result === this.returnReplace) {
				try {
					switch (this._pluginMode) {
						case this.modeOpen:
							PluginFileAccess.addSessionGrant(pluginID, this.file, "read");
							break;
						case this.modeSave:
							if (canWrite) {
								PluginFileAccess.addSessionGrant(pluginID, this.file, "write");
							}
							break;
						case this.modeGetFolder:
							PluginFileAccess.addSessionGrant(
								pluginID, this.file, canWrite ? "write" : "read"
							);
							break;
						case this.modeOpenMultiple:
							for (let f of this.files) {
								PluginFileAccess.addSessionGrant(pluginID, f, "read");
							}
							break;
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			return result;
		}
	}
	scope.FilePicker = ScopeUtils.ensureConstructableInScope(PluginFilePicker, scope, {
		mutable: true,
		trace: { pluginID, path: "FilePicker" },
	});
}

/**
 * Inject plugin-only helpers onto the sandbox's `Zotero.File` mirror.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFile(scope) {
	let pluginID = scope.PLUGIN_ID;
	// Force-create the lazy File mirror so we can attach to it
	let fileMirror = Cu.waiveXrays(scope).Zotero.File;
	if (!fileMirror) return;

	Cu.exportFunction(
		(fn) => {
			let wrappedFn = ScopeVariables.fromScope(fn, pluginID);
			return ScopeUtils.ensurePromiseVarInScope(
				PluginFileAccess.withSession(pluginID, wrappedFn), scope, {}
			);
		},
		fileMirror,
		{ defineAs: "withAccessSession" }
	);

	Cu.exportFunction(
		(path, mode) => {
			return ScopeUtils.ensurePromiseVarInScope(
				PluginFileAccess.check(pluginID, path, mode), scope, {}
			);
		},
		fileMirror,
		{ defineAs: "requestFileAccess" }
	);

	Cu.exportFunction(
		() => PluginFileAccess.getDir(pluginID),
		fileMirror,
		{ defineAs: "getPluginDir" }
	);

	// Return a plugin-scoped subdir of Zotero's temp dir, creating it on
	// demand and adding a session grant. Without an active session, the
	// grant is dropped -- but the plugin can still call this inside
	// withAccessSession to get a usable temp area.
	Cu.exportFunction(
		() => {
			let zoteroTmp = Zotero.getTempDirectory().path;
			let pluginTmp = PathUtils.join(zoteroTmp, "plugin-" + PluginUUID.getByID(pluginID));
			Zotero.File.createDirectoryIfMissing(pluginTmp);
			PluginFileAccess.addSessionGrant(pluginID, pluginTmp, "write");
			return pluginTmp;
		},
		fileMirror,
		{ defineAs: "getTempDirectory" }
	);

	function requireUrlAllowed(uriStr, method) {
		if (typeof uriStr !== "string" || !/^https?:\/\//i.test(uriStr)) {
			throw new Error(`Zotero.File.${method}: only http(s) URIs are supported`);
		}
		if (!PluginProtocol.canAccessURI(uriStr, pluginID)) {
			throw new Error(`Zotero.File.${method}: URI not allowed by host_permissions`);
		}
	}

	if (scope.PERMISSIONS.includes("network")) {
		Cu.exportFunction(
			(url, options) => {
				requireUrlAllowed(url, "getContentsFromURLAsync");
				return ScopeUtils.ensurePromiseVarInScope(
					Zotero.File.getContentsFromURLAsync(url, options),
					scope, {}
				);
			},
			fileMirror,
			{ defineAs: "getContentsFromURLAsync" }
		);

		if (scope.PERMISSIONS.includes("fileSystemWrite")) {
			Cu.exportFunction(
				(uri, path) => {
					let uriStr = (uri && typeof uri === "object" && uri.spec) || uri;
					requireUrlAllowed(uriStr, "download");
					return ScopeUtils.ensurePromiseVarInScope(
						(async () => {
							await PluginFileAccess.check(pluginID, path, "write");
							return Zotero.File.download(uriStr, path);
						})(),
						scope, {}
					);
				},
				fileMirror,
				{ defineAs: "download" }
			);
		}
	}
}

export { setupConsole, setupInstanceProxy, setupOpenWindow, setupHTTP, setupPreferences, setupFilePicker, setupFile };
