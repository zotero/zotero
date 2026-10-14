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
import { ScopeUtils, INSTANCE_PROXY_FACTORY } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { ScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";
import { PluginFileAccess } from "chrome://zotero/content/xpcom/plugins/file.mjs";
import { exportFilePath } from "chrome://zotero/content/xpcom/plugins/filePath.mjs";
import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";
import { WindowUtils } from "chrome://zotero/content/xpcom/plugins/window.mjs";

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
 * Set up the `FilePicker` constructor on the plugin scope. `init` parents only to one of
 * the plugin's own windows, given by window ID; anything else gets the hidden window.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFilePicker(scope) {
	let pluginID = scope.PLUGIN_ID;
	let canWrite = scope.PERMISSIONS.includes("fileSystemWrite");
	let { FilePicker } = lazy;
	class PluginFilePicker extends FilePicker {
		init(parentWindowID, title, mode) {
			let win = Services.appShell.hiddenDOMWindow;
			if (typeof parentWindowID === "number") {
				try {
					win = WindowUtils.getWindow(parentWindowID, "pluginWindow", pluginID);
				}
				catch {}
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

const CHANGE_SET_BASE_URL = "chrome://zotero/content/xpcom/plugins/changeSetBase.js";

/**
 * Load a change set builder into the sandbox, so a draft is a plain object of the plugin's compartment
 * until commit hands its JSON to chrome
 * @param {Object} scope - The sandbox scope
 * @param {string} url - The store's builder script, evaluated after the shared base
 * @param {Object} [globals] - Free variables the scripts read, put on the holder first
 * @returns {Object} The holder the scripts defined their classes on
 */
function loadChangeSet(scope, url, globals = {}) {
	let holder = Cu.createObjectIn(scope);
	Object.assign(holder, globals);
	for (let script of [CHANGE_SET_BASE_URL, url]) {
		Services.scriptloader.loadSubScript(script, holder);
	}
	return holder;
}

function defineOnMirror(mirror, name, value) {
	Object.defineProperty(mirror, name, { value, enumerable: true, configurable: false, writable: false });
}

/**
 * Zotero.DataStore.ChangeSet, the sandbox's own copy of the data builder
 *
 * @param {Object} scope - The sandbox scope
 */
function setupDataStore(scope) {
	// Force-create the lazy DataStore mirror so we can attach to it
	let mirror = Cu.waiveXrays(scope).Zotero.DataStore;
	if (!mirror) return;
	let holder = loadChangeSet(scope, "chrome://zotero/content/xpcom/plugins/changeSet.js");
	defineOnMirror(mirror, "ChangeSet", holder.DataChangeSet);
}

/**
 * Zotero.FileStore.ChangeSet and path, the sandbox's own copy of the file builder, plus withSession, the
 * grant session that lets picker and prompt grants hold across a burst of calls
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFileStore(scope) {
	let pluginID = scope.PLUGIN_ID;
	let mirror = Cu.waiveXrays(scope).Zotero.FileStore;
	if (!mirror) return;
	let path = exportFilePath(scope);
	let holder = loadChangeSet(scope, "chrome://zotero/content/xpcom/plugins/fileChangeSet.js", { FilePath: path });
	defineOnMirror(mirror, "ChangeSet", holder.FileChangeSet);
	defineOnMirror(mirror, "path", path);
	Cu.exportFunction(
		(fn) => {
			let wrappedFn = ScopeVariables.fromScope(fn, pluginID);
			return ScopeUtils.ensurePromiseVarInScope(
				PluginFileAccess.withSession(pluginID, wrappedFn), scope, {}
			);
		},
		mirror,
		{ defineAs: "withSession" }
	);
}

export { setupConsole, setupInstanceProxy, setupHTTP, setupPreferences, setupFilePicker, setupDataStore, setupFileStore };
