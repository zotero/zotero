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
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";
import { PluginFileAccess } from "chrome://zotero/content/xpcom/plugins/file.mjs";
import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";

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
 */
function setupOpenWindow(scope) {
	let pluginID = scope.PLUGIN_ID;
	let rootURI = PluginProtocol.getBaseURI(pluginID);
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
			// that loads the plugin's HTML content
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
					win.PluginWindow.init(windowId, pluginID);

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
			`Permission denied: cannot access preference "${pref}".`
			+ ' Declare it in "pref_permissions".'
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
				if (!args[1]) {
					throw new Error(
						'Permission denied: cannot reset entire preference branch.'
					);
				}
				checkPrefPermission(args[1]);
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
 * Set up the `FilePicker` constructor on the plugin scope.
 * The `init` method is overridden to unwrap the sandbox-side
 * parentWindow argument via `fromScope` before passing it to
 * the real nsIFilePicker.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFilePicker(scope) {
	let pluginID = scope.PLUGIN_ID;
	let canWrite = scope.PERMISSIONS.includes("fileSystemWrite");
	let { FilePicker } = lazy;
	class PluginFilePicker extends FilePicker {
		init(parentWindow, title, mode) {
			parentWindow = ScopeVariables.fromScope(parentWindow, pluginID);
			this._pluginMode = mode;
			return super.init(parentWindow, title, mode);
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
		if (!PluginProtocol.canAccessURI(pluginID, uriStr)) {
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

/**
 * Set up `Zotero.DBConnection` on the sandbox scope.
 * The constructor creates plugin-scoped SQLite databases under
 * `<data dir>/plugin-db/<PLUGIN_UUID>/`.  Only accepts a plain
 * database name; instances are restricted via PLUGIN_DB_SCHEMA.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupPluginDB(scope) {
	let pluginID = scope.PLUGIN_ID;
	let pluginDir = PathUtils.join(
		Zotero.DataDirectory.dir, "plugin-db", PluginUUID.getByID(pluginID)
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
			if (typeof sql === "string" && /^\s*(ATTACH|DETACH)\s/i.test(sql)) {
				throw new Error("ATTACH/DETACH DATABASE is not allowed in plugin databases");
			}
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
		{ mutable: true, instanceSchema: PLUGIN_DB_SCHEMA, trace: { pluginID, path: "Zotero.DBConnection" } }
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

export { setupConsole, setupOpenWindow, setupHTTP, setupPreferences, setupFilePicker, setupFile, setupPluginDB };
