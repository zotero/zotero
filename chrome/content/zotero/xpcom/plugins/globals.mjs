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
import { PluginFileAccess } from "chrome://zotero/content/xpcom/plugins/fileAccess.mjs";
import { FilePath, PathIdentity } from "chrome://zotero/content/xpcom/plugins/filePath.mjs";
import { PluginPrefs } from "chrome://zotero/content/xpcom/plugins/prefs.mjs";
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
	let access = PluginPrefs.access(pluginID, scope.PREF_PERMISSIONS);

	let Prefs = Cu.createObjectIn(scope);

	// get, set, clear
	for (let [method, sig] of Object.entries(PREFS_METHODS)) {
		let keyIndex = sig.indexOf("key");
		let globalIndex = sig.indexOf("global");

		Prefs[method] = ScopeUtils.ensureCallableInScope(
			Zotero.Prefs[method], Zotero.Prefs, scope, {
				argParser: (args) => {
					args[keyIndex] = access.resolve(args[keyIndex], args[globalIndex]);
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
				access.checkReset(args[1]);
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
				args[0] = access.resolve(args[0], args[2]);
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
 * the plugin's own windows, given by window ID; anything else gets the hidden window on macOS, the main one elsewhere.
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFilePicker(scope) {
	let pluginID = scope.PLUGIN_ID;
	let canWrite = scope.PERMISSIONS.includes("fileSystemWrite");
	let { FilePicker } = lazy;
	class PluginFilePicker extends FilePicker {
		init(parentWindowID, title, mode) {
			let win = null;
			if (typeof parentWindowID === "number") {
				try {
					win = WindowUtils.getWindow(parentWindowID, "pluginWindow", pluginID);
				}
				catch {}
			}
			// Anything but the plugin's own window gets the hidden window, which exists on macOS only, else the main one
			if (!win) {
				win = Zotero.isMac ? Services.appShell.hiddenDOMWindow : Zotero.getMainWindow() || Services.wm.getMostRecentWindow(null);
			}
			this._pluginMode = mode;
			return super.init(win, title, mode);
		}

		// Paths cross the boundary in the canonical spelling, both ways
		get file() {
			return PathIdentity.canonicalize(super.file);
		}

		get files() {
			return super.files.map(file => PathIdentity.canonicalize(file));
		}

		get displayDirectory() {
			return PathIdentity.canonicalize(super.displayDirectory);
		}

		set displayDirectory(path) {
			super.displayDirectory = PathIdentity.toNative(PathIdentity.canonicalize(path));
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

function defineOnMirror(mirror, name, value) {
	Object.defineProperty(mirror, name, { value, enumerable: true, configurable: false, writable: false });
}

/**
 * Zotero.DataStore.ChangeSet, the sandbox's own copy of the data builder, and Zotero.DataStore.Handle, the
 * classical form over it: Handle.<type>(target) changes in place, with snapshot() and save()
 *
 * @param {Object} scope - The sandbox scope
 */
function setupDataStore(scope) {
	// Force-create the lazy DataStore mirror so we can attach to it
	let mirror = Cu.waiveXrays(scope).Zotero.DataStore;
	if (!mirror) return;
	let holder = ScopeUtils.loadChangeSet("chrome://zotero/content/xpcom/plugins/dataChangeSet.js", { scope });
	defineOnMirror(mirror, "ChangeSet", holder.DataChangeSet);
	defineOnMirror(mirror, "Handle", holder.ChangeSetBase.handleClass(mirror, holder.DataChangeSet));
}

// The path helpers as functions of the sandbox, each failure arriving there as its own TypeError
function exportFilePath(scope) {
	let mirror = Cu.createObjectIn(scope);
	Object.defineProperty(mirror, "sep", { value: FilePath.sep, enumerable: true });
	for (let name of Object.keys(FilePath).filter(key => typeof FilePath[key] === "function")) {
		Cu.exportFunction((...args) => {
			try {
				return FilePath[name](...args);
			}
			catch (e) {
				throw new scope.TypeError(String(e?.message ?? e));
			}
		}, mirror, { defineAs: name });
	}
	return mirror;
}

/**
 * Zotero.FileStore.ChangeSet and path, the sandbox's own copy of the file builder, Handle, the traditional form
 * over it, plus withSession, the grant session that lets picker and prompt grants hold across a burst of calls
 *
 * @param {Object} scope - The sandbox scope
 */
function setupFileStore(scope) {
	let pluginID = scope.PLUGIN_ID;
	let mirror = Cu.waiveXrays(scope).Zotero.FileStore;
	if (!mirror) return;
	let path = exportFilePath(scope);
	let holder = ScopeUtils.loadChangeSet("chrome://zotero/content/xpcom/plugins/fileChangeSet.js", {
		scope,
		globals: { FilePath: path },
	});
	defineOnMirror(mirror, "ChangeSet", holder.FileChangeSet);
	defineOnMirror(mirror, "path", path);
	defineOnMirror(mirror, "Handle", holder.ChangeSetBase.handleClass(mirror, holder.FileChangeSet));
	let withSessionTrace = { pluginID, path: "Zotero.FileStore.withSession" };
	defineOnMirror(mirror, "withSession", ScopeUtils.ensureCallableInScope(
		fn => PluginFileAccess.withSession(pluginID, fn),
		null, scope, {
			argParser: args => [ScopeVariables.fromScope(args[0], pluginID, { trace: withSessionTrace })],
			trace: withSessionTrace,
		}
	));
}

export { setupConsole, setupInstanceProxy, setupHTTP, setupPreferences, setupFilePicker, setupDataStore, setupFileStore };
