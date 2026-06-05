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
import { setupConsole, setupOpenWindow, setupHTTP, setupPreferences, setupFilePicker, setupFile, setupPluginDB } from "chrome://zotero/content/xpcom/plugins/globals.mjs";

const SANDBOX_NUKE_DELAY_MS = 10000;

var scopes = new Map();

/**
 * Adapted from loadBootstrapScope() in Firefox 60 ESR
 *
 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4233
 */
function loadScope(addon, globalVars = {}) {
	let currentPermissions = VarCheck.getPermissionsString(VarCheck.resolvePermissions(addon.installPermissions.permissions));
	let existingScope = scopes.get(addon.id);
	let uuid = PluginUUID.getByID(addon.id);

	if (existingScope) {
		let existingPermissions = VarCheck.getPermissionsString(existingScope?.PERMISSIONS);
		if (existingPermissions === currentPermissions) {
			Zotero.debug(`Reusing existing scope for plugin ${addon.id}`);
			// Ensure the moz-extension:// policy is still active
			PluginProtocol.register(
				addon.id, addon.getResourceURI(), uuid,
				addon.installPermissions?.origins
			);
			// Update version
			existingScope.VERSION = addon.version;
			return;
		}
		Zotero.debug(`Permissions changed for plugin ${addon.id}, recreating scope`);
		unloadScope(addon.id);
	}

	PluginFileAccess.register(addon.id, uuid);

	// Record plugin name so that its data can be identified after uninstall.
	PluginNames.record(addon.id, addon.name);

	// Register moz-extension:// protocol with allowed origins from host_permissions
	PluginProtocol.register(
		addon.id, addon.getResourceURI(), uuid,
		addon.installPermissions?.origins
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
	// TODO: Throws error 0x80070057
	setTimeout(() => {
		Cu.nukeSandbox(scope);
	}, SANDBOX_NUKE_DELAY_MS);
}

function getScope(id) {
	return scopes.get(id);
}

function loadPrivilegedScope(addon, uuid, globalVars = {}) {
	var scope = new Cu.Sandbox(
		Services.scriptSecurityManager.getSystemPrincipal(),
		{
			sandboxName: addon.id,
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
			PLUGIN_ID: addon.id,
			PLUGIN_UUID: uuid,
			PERMISSIONS: ["*"],
			HOST_PERMISSIONS: ["*"],
			PREF_PERMISSIONS: ["*"],
			INTEROP_PERMISSIONS: ["*"],
			VERSION: addon.version,

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
	let rootURI = PluginProtocol.getBaseURI(addon.id);
	var scope = new Cu.Sandbox(
		rootURI,
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
			loadSubScript: res => Services.scriptloader.loadSubScript(
				`${rootURI}${res}`, scope
			),
			isDeadWrapper: obj => Cu.isDeadWrapper(VarCheck.getOriginalOrSelf(obj)),
			PLUGIN_ID: addon.id,
			PLUGIN_UUID: uuid,
			PERMISSIONS: Cu.cloneInto(permissions, scope),
			HOST_PERMISSIONS: Cu.cloneInto(addon.installPermissions?.host_permissions || [], scope),
			PREF_PERMISSIONS: Cu.cloneInto(addon.installPermissions?.pref_permissions || [], scope),
			INTEROP_PERMISSIONS: Cu.cloneInto(addon.installPermissions?.interop_permissions || [], scope),
			VERSION: addon.version,

			// Add additional global vars
			Localization: ScopeUtils.ensureConstructableInScope(Localization, scope, {
				mutable: true,
				returnParser: instance => ScopeVariables.createAllowlistMirrorObject(instance, true, addon.id, { frozen: false, strong: true, pathPrefix: "Localization" }),
				trace: { pluginID: addon.id, path: "Localization" },
			}),
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			requestIdleCallback,
			cancelIdleCallback,
			...globalVars
		}
	);

	setupConsole(scope, addon);

	scopes.set(addon.id, scope);

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

	if (permissions.includes("openWindow")) {
		setupOpenWindow(scope);
	}

	if (permissions.includes("network")) {
		setupHTTP(scope);
	}

	if (permissions.includes("preferences")) {
		setupPreferences(scope);
	}

	// fileSystemWrite implies fileSystemRead
	if (permissions.includes("fileSystemRead")) {
		setupFilePicker(scope);
		setupFile(scope);
	}

	if (permissions.includes("database")) {
		setupPluginDB(scope);
	}

	return scope;
}

const PluginSandbox = { loadScope, unloadScope, getScope };

export { PluginSandbox };
