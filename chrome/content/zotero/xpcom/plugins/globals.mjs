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
import { ScopeUtils } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { ScopeVariables, WindowScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";
import { PLUGIN_DB_SCHEMA } from "chrome://zotero/content/xpcom/plugins/schema.mjs";

const lazy = XPCOMUtils.declareLazy({
	ConsoleAPI: "resource://gre/modules/Console.sys.mjs",
	FilePicker: "chrome://zotero/content/modules/filePicker.mjs",
});


// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/ExtensionCommon.sys.mjs#60
function getConsole(addon) {
	return () => {
		let console = new lazy.ConsoleAPI({
			prefix: `${addon.name} (${addon.id}):\n`,
		});
		let wrapper = ScopeVariables.createAllowlistMirrorObject(console, true, addon.id, { cache: true, strong: true, pathPrefix: "console" });
		return wrapper;
	};
}

/**
 * Set up a lazy `console` global on the sandbox scope.
 *
 * @param {Object} scope - The sandbox scope
 * @param {Object} addon - The addon descriptor
 */
function setupConsole(scope, addon) {
	ChromeUtils.defineLazyGetter(scope, "console", getConsole(addon));
}

const ALLOWED_WINDOW_FEATURES = new Set([
	"width",
	"height",
	"left",
	"top",
	"centerscreen",
	"resizable",
	"minimizable",
]);

function sanitizeFeatures(features) {
	if (!features) return "";
	return features.split(",")
		.map(s => s.trim())
		.filter(s => ALLOWED_WINDOW_FEATURES.has(s.split("=")[0].trim().toLowerCase()))
		.join(",");
}

/**
 * Set up the `openWindow` function on an unprivileged plugin scope.
 * The function opens a chrome wrapper window with a <browser> element
 * that loads the plugin's HTML content.
 *
 * @param {Object} scope - The sandbox scope to attach `openWindow` to
 * @param {string} rootURI - The plugin's resource:// root URI
 * @param {string} addonID - The plugin ID
 */
function setupOpenWindow(scope, rootURI, addonID) {
	let holder = Cu.createObjectIn(scope);
	Cu.exportFunction(
		(url, features, options = {}) => {
			let { windowId, onLoad, fitContent } = Cu.waiveXrays(options);
			if (windowId !== null && windowId !== undefined && typeof windowId !== "string") {
				throw new Error("openWindow: windowId must be a string");
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

			let safeFeatures = sanitizeFeatures(features ? String(features) : "");

			// Open a chrome wrapper window with a <browser> element
			// that loads the plugin's HTML content. The browser's
			// contentWindow gets a resource:// content principal,
			// enabling same-origin DOM access from the sandbox.
			let resizable = !safeFeatures || safeFeatures.includes("resizable");
			let chromeFeatures = "chrome,dialog=no,"
				+ (safeFeatures || "resizable");
			let win = Services.ww.openWindow(
				null,
				"chrome://zotero/content/pluginWindow.xhtml",
				null,
				chromeFeatures,
				null
			);

			return new scope.Promise((resolve) => {
				win.addEventListener("load", () => {
					let browser = win.document
						.getElementById("plugin-browser");

					// Initialize the plugin window (title sync, menus, lifecycle)
					win.PluginWindow.init(windowId, addonID);

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
									browser.focus();
									resolve(browser.contentWindow);
									if (typeof onLoad === "function") {
										onLoad(browser.contentWindow);
									}
									if (fitContent) {
										// Set explicit size on browser from content before sizeToContent,
										let docEl = browser.contentDocument.documentElement;
										browser.style.width = docEl.scrollWidth + "px";
										browser.style.height = docEl.scrollHeight + "px";
										browser.removeAttribute("flex");
										win.sizeToContent();
										// Only keep syncing if the window is not manually resizable.
										if (!resizable) {
											let ro = new win.ResizeObserver(Zotero.Utilities.debounce(() => {
												browser.style.width = docEl.scrollWidth + "px";
												browser.style.height = docEl.scrollHeight + "px";
												win.sizeToContent();
											}, 100));
											ro.observe(docEl);
											win.addEventListener("unload", () => ro.disconnect(), { once: true });
										}
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
				}, { once: true });
			});
		},
		holder,
		{ defineAs: "f" }
	);
	scope.openWindow = holder.f;
}

/**
 * Set up a `Zotero.HTTP` wrapper on the plugin scope that injects the
 * sandbox's XMLHttpRequest into every request.  The sandbox's XHR
 * carries the plugin's restricted principal (constrained by
 * allowedOrigins from host_permissions), so Firefox's built-in
 * security enforces URL access control.
 *
 * @param {Object} scope - The sandbox scope
 * @param {string} addonID - The addon's ID
 */
/**
 * Set up Zotero.HTTP on the plugin scope.
 * Uses a XHR factory created inside the sandbox so instances carry the
 * sandbox's restricted principal (constrained by allowedOrigins from
 * host_permissions).  Firefox's built-in principal security enforces
 * URL access control.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupHTTP(scope) {
	// Create XHR factory *inside* the sandbox so instances get the
	// sandbox's restricted principal.  The principal is determined by
	// the calling context of `new`, not the constructor's origin.
	let createXHR = Cu.evalInSandbox("() => new XMLHttpRequest()", scope);
	let addonID = scope.PLUGIN_ID;

	let HTTP = Cu.createObjectIn(scope);

	for (let name of ["request", "processDocuments"]) {
		HTTP[name] = ScopeUtils.ensureCallableInScope(
			Zotero.HTTP[name], Zotero.HTTP, scope, {
				mutable: true,
				argParser: (args) => {
					// Inject sandbox XHR factory into options
					// Options is always at index 2 for both request() and processDocuments()
					if (!args[2] || typeof args[2] !== "object") {
						args[2] = {};
					}
					args[2].createXMLHttpRequest = createXHR;
					args[2].noMock = true;
					return args;
				},
				trace: { pluginID: addonID, path: `Zotero.HTTP.${name}` },
			}
		);
	}

	// Attach to the scope's Zotero mirror object
	Object.defineProperty(Cu.waiveXrays(scope.Zotero), "HTTP", {
		value: HTTP,
		enumerable: true,
		configurable: false,
		writable: false,
	});
}

// Method signatures for Prefs methods that follow the standard key/global pattern.
// key: pref name (auto-prefixed when global=false, permission-checked when global=true)
// global: flag index -- forced to true when calling real Zotero.Prefs
const PREFS_METHODS = {
	get: ["key", "global"],
	set: ["key", "value", "global"],
	clear: ["key", "global"],
};

/**
 * Set up Zotero.Prefs on the plugin scope with access control.
 *
 * The "preferences" permission exposes the Zotero.Prefs API.
 * Access scope is controlled by the plugin's syncGUID namespace
 * and pref_permissions declared in the manifest.
 * Global (non-Zotero) prefs are not accessible from unprivileged plugins.
 *
 * @param {Object} scope - The sandbox scope
 * @param {Object} addon - The addon descriptor
 */
function setupPreferences(scope, addon) {
	let prefPrefixes = addon.installPermissions.pref_permissions || [];

	// Plugin's own namespace
	let ownPrefix = `extensions.${addon.syncGUID.replace(/[{}]/g, '')}.`;
	let allPrefixes = [ownPrefix, ...prefPrefixes];

	function checkPrefPermission(pref) {
		if (allPrefixes.some(prefix => pref.startsWith(prefix))) {
			return;
		}
		throw new Error(
			`Permission denied: cannot access preference "${pref}".`
			+ ' Declare it in "pref_permissions".'
		);
	}

	let Prefs = Cu.createObjectIn(scope);

	let addonID = addon.id;

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
				trace: { pluginID: addonID, path: `Zotero.Prefs.${method}` },
			}
		);
	}

	// resetBranch(exclude, branch)
	Prefs.resetBranch = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.resetBranch, Zotero.Prefs, scope, {
			argParser: (args) => {
				if (!args[1]) {
					throw new Error(
						'Permission denied: cannot reset entire preference branch.'
					);
				}
				checkPrefPermission(args[1]);
				return args;
			},
			trace: { pluginID: addonID, path: "Zotero.Prefs.resetBranch" },
		}
	);

	// registerObserver(name, handler, global)
	let registerObserverTrace = { pluginID: addonID, path: "Zotero.Prefs.registerObserver" };
	Prefs.registerObserver = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.registerObserver, Zotero.Prefs, scope, {
			argParser: (args) => {
				if (!args[2]) {
					args[0] = ownPrefix + args[0];
				}
				else {
					checkPrefPermission(args[0]);
				}
				args[1] = ScopeVariables.fromScope(args[1], addonID, { trace: registerObserverTrace });
				args[2] = true;
				return args;
			},
			trace: registerObserverTrace,
		}
	);

	// unregisterObserver(symbol)
	Prefs.unregisterObserver = ScopeUtils.ensureCallableInScope(
		Zotero.Prefs.unregisterObserver, Zotero.Prefs, scope, {
			trace: { pluginID: addonID, path: "Zotero.Prefs.unregisterObserver" },
		}
	);

	// Attach to the scope's Zotero mirror object
	Object.defineProperty(Cu.waiveXrays(scope.Zotero), "Prefs", {
		value: Prefs,
		enumerable: true,
		configurable: false,
		writable: false,
	});
}

/**
 * Set up the `FilePicker` constructor on the plugin scope.
 * The `init` method is overridden to unwrap the sandbox-side
 * parentWindow argument via `fromScope` before passing it to
 * the real nsIFilePicker.
 *
 * @param {Object} scope - The sandbox scope
 * @param {string} addonID - The addon's ID
 */
function setupFilePicker(scope, addonID) {
	let { FilePicker } = lazy;
	class PluginFilePicker extends FilePicker {
		init(parentWindow, title, mode) {
			parentWindow = ScopeVariables.fromScope(parentWindow, addonID);
			return super.init(parentWindow, title, mode);
		}
	}
	scope.FilePicker = ScopeUtils.ensureConstructableInScope(PluginFilePicker, scope, {
		mutable: true,
		trace: { pluginID: addonID, path: "FilePicker" },
	});
}

/**
 * Set up `Zotero.DBConnection` on the sandbox scope.
 * The constructor creates plugin-scoped SQLite databases under
 * `<data dir>/plugin-data/<syncGUID>/`.  Only accepts a plain
 * database name; instances are restricted via PLUGIN_DB_SCHEMA.
 *
 * @param {Object} scope - The sandbox scope
 * @param {Object} addon - The addon descriptor
 */
function setupPluginDB(scope, addon) {
	let guidDir = addon.syncGUID.replace(/[{}]/g, "");
	let pluginDir = PathUtils.join(
		Zotero.DataDirectory.dir, "plugin-data", guidDir
	);

	let PluginDBConnection = function (dbName) {
		if (!dbName || typeof dbName !== "string") {
			throw new Error("DBConnection requires a database name");
		}
		if (dbName.includes("/") || dbName.includes("\\") || dbName.includes("..")) {
			throw new Error("DBConnection name must not contain path separators");
		}
		if (dbName === "zotero") {
			throw new Error("Plugins cannot open the main Zotero database");
		}
		Zotero.File.createDirectoryIfMissing(pluginDir);
		let dbPath = PathUtils.join(pluginDir, dbName + ".sqlite");
		let conn = new Zotero.DBConnection(dbPath);

		// Wrap queryAsync results with forwarding proxies so
		// mozIStorageRow Proxies can cross compartments
		let origQueryAsync = conn.queryAsync.bind(conn);
		conn.queryAsync = async function (sql, params, options = {}) {
			let rows = await origQueryAsync(sql, params, options);
			if (!Array.isArray(rows)) return rows;
			return rows.map(row => ScopeUtils.ensureForwardingProxyInScope(row, scope));
		};

		conn.rowQueryAsync = async function (sql, params) {
			let rows = await conn.queryAsync(sql, params);
			return rows.length ? rows[0] : false;
		};

		// getColumns reads row.name in chrome, so it must use the
		// original queryAsync to avoid Xray-wrapped forwarding proxies
		conn.getColumns = function (table) {
			return origQueryAsync("PRAGMA table_info(" + table + ")")
				.then(rows => rows.map(row => row.name));
		};

		return conn;
	};

	let wrapped = ScopeUtils.ensureConstructableInScope(
		PluginDBConnection, scope,
		{ mutable: true, instanceSchema: PLUGIN_DB_SCHEMA, trace: { pluginID: addon.id, path: "Zotero.DBConnection" } }
	);

	// Static helpers on the constructor for managing plugin databases.
	let statics = Cu.createObjectIn(scope);
	Cu.exportFunction(function (dbName) {
		if (!dbName || typeof dbName !== "string") return false;
		let dbPath = PathUtils.join(pluginDir, dbName + ".sqlite");
		return IOUtils.exists(dbPath);
	}, statics, { defineAs: "hasDatabase" });
	Cu.exportFunction(async function (dbName) {
		if (!dbName || typeof dbName !== "string") {
			throw new Error("deleteDatabase requires a database name");
		}
		let dbPath = PathUtils.join(pluginDir, dbName + ".sqlite");
		await IOUtils.remove(dbPath, { ignoreAbsent: true });
	}, statics, { defineAs: "deleteDatabase" });
	Cu.exportFunction(async function () {
		await IOUtils.remove(pluginDir, { recursive: true, ignoreAbsent: true });
	}, statics, { defineAs: "deleteAllDatabases" });

	Object.defineProperty(wrapped, "hasDatabase", {
		value: statics.hasDatabase,
		enumerable: true,
	});
	Object.defineProperty(wrapped, "deleteDatabase", {
		value: statics.deleteDatabase,
		enumerable: true,
	});
	Object.defineProperty(wrapped, "deleteAllDatabases", {
		value: statics.deleteAllDatabases,
		enumerable: true,
	});

	Object.defineProperty(scope.Zotero, "DBConnection", {
		value: wrapped,
		enumerable: true,
		configurable: false,
		writable: false,
	});
}

export { setupConsole, setupOpenWindow, setupHTTP, setupPreferences, setupFilePicker, setupPluginDB };
