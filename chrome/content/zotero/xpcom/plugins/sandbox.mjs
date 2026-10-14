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


import {
	setTimeout, clearTimeout,
	setInterval, clearInterval,
	requestIdleCallback, cancelIdleCallback
} from "resource://gre/modules/Timer.sys.mjs";
import { VarCheck, ScopeUtils } from "chrome://zotero/content/xpcom/plugins/utils.mjs";
import { ScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";
import { PluginFileAccess } from "chrome://zotero/content/xpcom/plugins/file.mjs";
import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";
import { PluginNames } from "chrome://zotero/content/xpcom/plugins/names.mjs";
import { setupConsole, setupInstanceProxy, setupHTTP, setupPreferences, setupFilePicker, setupFile } from "chrome://zotero/content/xpcom/plugins/globals.mjs";

const SANDBOX_NUKE_DELAY_MS = 10000;

var scopes = new Map();

/**
 * Adapted from loadBootstrapScope() in Firefox 60 ESR
 *
 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4233
 */
function loadScope(addon, globalVars = {}) {
	let currentPermissions = VarCheck.getPermissionsString(VarCheck.resolvePermissions(addon.installPermissions.permissions));
	let uuid = PluginUUID.getByID(addon.id);

	if (scopes.has(addon.id)) {
		Zotero.debug(`Recreating scope for plugin ${addon.id}`);
		unloadScope(addon.id);
	}

	PluginFileAccess.register(addon.id, uuid);

	// Record plugin name so that its data can be identified after uninstall.
	PluginNames.record(addon.id, addon.name);

	// Register moz-extension:// protocol with allowed origins from host_permissions
	PluginProtocol.register(
		addon.id, addon.getResourceURI(), uuid,
		addon.installPermissions?.origins,
		addon.installPermissions?.content_security_policy
	);

	let scope;
	if (VarCheck.isPrivilegedPermission(addon)) {
		Zotero.debug(`Loading privileged scope for plugin ${addon.id}`);
		scope = loadPrivilegedScope(addon, uuid, globalVars);
	}
	else {
		Zotero.debug(`Loading unprivileged scope for plugin ${addon.id}, permissions: ${currentPermissions}`);
		scope = loadUnprivilegedScope(addon, uuid, globalVars);
	}
	
	try {
		let uri = PluginProtocol.getBaseURI(addon.id) + 'bootstrap.js';
		Services.scriptloader.loadSubScriptWithOptions(
			uri,
			{
				target: scope,
				ignoreCache: true,
				// Plugins are loaded from jar:file: URIs, which the script loader
				// otherwise refuses (Mozilla bug 1974213)
				allowUnsafeURL: true
			}
		);
	}
	catch (e) {
		Zotero.logError(e);
	}
}

function unloadScope(id) {
	let scope = scopes.get(id);
	if (!scope) {
		return;
	}
	scopes.delete(id);
	PluginProtocol.unregister(id);
	PluginFileAccess.unregister(id);
	// Delay nuke to allow any pending operations to complete
	setTimeout(() => {
		Cu.nukeSandbox(scope);
	}, SANDBOX_NUKE_DELAY_MS);
}

function getScope(id) {
	return scopes.get(id);
}

function defineFrozenIdentity(scope, addon, uuid, privileged, perms) {
	let freezeInSandbox;
	if (privileged) {
		// evalInSandbox in privileged scopes will run the code as a file with the same name
		// and thus the debugger only sees the function instead of the full file.
		freezeInSandbox = arr => Object.freeze(arr);
	}
	else {
		freezeInSandbox = Cu.evalInSandbox("arr => Object.freeze(arr)", scope);
	}
	let toFrozenSandboxArray = arr => freezeInSandbox(Cu.cloneInto(arr, scope));
	let vars = {
		PLUGIN_ID: addon.id,
		PLUGIN_UUID: uuid,
		PERMISSIONS: toFrozenSandboxArray(perms.permissions),
		HOST_PERMISSIONS: toFrozenSandboxArray(perms.hostPermissions),
		PREF_PERMISSIONS: toFrozenSandboxArray(perms.prefPermissions),
		INTEROP_PERMISSIONS: toFrozenSandboxArray(perms.interopPermissions),
		VERSION: addon.version,
	};
	for (let [name, value] of Object.entries(vars)) {
		Object.defineProperty(scope, name, {
			value,
			enumerable: true,
			configurable: false,
			writable: false,
		});
	}
}

function defineFunction(scope, name, func) {
	Cu.exportFunction(func, scope, { defineAs: name });
}

function loadPrivilegedScope(addon, uuid, globalVars = {}) {
	var scope = new Cu.Sandbox(
		Services.scriptSecurityManager.getSystemPrincipal(),
		{
			sandboxName: addon.id,
			// Cu.nukeSandbox requires a wrapper with its own compartment,
			// otherwise throws NS_ERROR_ILLEGAL_VALUE (0x80070057).
			freshCompartment: true,
			wantGlobalProperties: [
				"atob",
				"btoa",
				"Blob",
				"crypto",
				"CSS",
				"ChromeUtils",
				"DOMParser",
				"fetch",
				"File",
				"FileReader",
				"TextDecoder",
				"TextEncoder",
				"URL",
				"URLSearchParams",
				"XMLHttpRequest"
			]
		}
	);

	Object.assign(
		scope,
		{
			Zotero,
			ChromeWorker,
			IOUtils,
			Localization,
			PathUtils,
			Services,
			Worker,
			XMLSerializer,

			// Add additional global functions
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			requestIdleCallback,
			cancelIdleCallback,
			...globalVars
		}
	);

	defineFrozenIdentity(scope, addon, uuid, true, {
		permissions: ["*"],
		hostPermissions: ["*"],
		prefPermissions: ["*"],
		interopPermissions: ["*"],
	});

	setupConsole(scope, addon);
	
	// fx140: Shim ChromeUtils.import() in the plugin scope
	// TODO: Do we want this?
	scope.ChromeUtils = new Proxy(scope.ChromeUtils, {
		get(target, property, receiver) {
			if (property === 'import') {
				return function (uri) {
					let esmURI = uri.replace('.jsm', uri.includes('/zotero/') ? '.mjs' : '.sys.mjs');
					Zotero.warn('ChromeUtils.import() has been removed. Use importESModule():\n'
						+ `  ChromeUtils.importESModule("${esmURI}");`);
					return receiver.importESModule(esmURI);
				};
			}
			return Reflect.get(target, property, receiver);
		}
	});

	scopes.set(addon.id, scope);

	return scope;
}

function loadUnprivilegedScope(addon, uuid, globalVars = {}) {
	let baseURI = PluginProtocol.getBaseURI(addon.id);
	var scope = new Cu.Sandbox(
		baseURI,
		{
			sandboxName: addon.id,
			wantGlobalProperties: [
				"atob",
				"btoa",
				"Blob",
				"DOMParser",
				"fetch",
				"TextDecoder",
				"TextEncoder",
				"URL",
				"URLSearchParams",
				"XMLHttpRequest"
			],
			wantXrays: true,
			allowWaivers: true,
			freshCompartment: true,
		}
	);
	let permissions = VarCheck.resolvePermissions(addon.installPermissions.permissions);

	Object.assign(
		scope,
		{
			// Add additional global vars
			Localization: ScopeUtils.ensureConstructableInScope(Localization, scope, {
				mutable: true,
				returnParser: instance => ScopeVariables.createAllowlistMirrorObject(instance, true, addon.id, { frozen: false, strong: true, pathPrefix: "Localization" }),
				trace: { pluginID: addon.id, path: "Localization" },
			}),
			...globalVars
		}
	);

	let funcToExport = {
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		requestIdleCallback,
		cancelIdleCallback,
		loadSubScript: (res) => {
			let uri = new URL(res, baseURI).href;
			if (!uri.startsWith(baseURI)) {
				throw new Error(`loadSubScript: ${res} resolves outside the plugin directory`);
			}
			return Services.scriptloader.loadSubScript(uri, scope);
		},
		isDeadWrapper: obj => Cu.isDeadWrapper(VarCheck.getOriginalOrSelf(obj)),
	};
	for (let key in funcToExport) {
		defineFunction(scope, key, funcToExport[key]);
	}

	defineFrozenIdentity(scope, addon, uuid, false, {
		permissions,
		hostPermissions: addon.installPermissions?.host_permissions || [],
		prefPermissions: addon.installPermissions?.pref_permissions || [],
		interopPermissions: addon.installPermissions?.interop_permissions || [],
	});

	setupConsole(scope, addon);

	scopes.set(addon.id, scope);

	setupInstanceProxy(scope);

	let schema = VarCheck.getPermissionSchema(permissions);

	let extraGlobals = {};
	for (let key in schema) {
		let obj = globalThis[key];
		if (!obj) {
			continue;
		}
		extraGlobals[key] = ScopeVariables.createAllowlistMirrorObject(obj, schema[key], addon.id, { cache: true, pathPrefix: key });
	}

	Object.assign(scope, extraGlobals);

	// The sandbox principal bounds requests to host_permissions
	setupHTTP(scope);

	if (permissions.includes("preferences")) {
		setupPreferences(scope);
	}

	// fileSystemWrite implies fileSystemRead
	if (permissions.includes("fileSystemRead")) {
		setupFilePicker(scope);
		setupFile(scope);
	}

	return scope;
}

const PluginSandbox = { loadScope, unloadScope, getScope };

export { PluginSandbox };
