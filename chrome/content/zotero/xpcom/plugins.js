/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
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


Zotero.Plugins = new function () {
	var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
	var scopes = new Map();
	
	
	this.init = async function () {
		this._addonObserver.init();
		
		var { addons } = await AddonManager.getActiveAddons(["extension"]);
		for (let addon of addons) {
			await _callMethod(addon, 'startup');
		}
		
		Zotero.addShutdownListener(async () => {
			var { addons } = await AddonManager.getActiveAddons(["extension"]);
			for (let addon of addons) {
				await _callMethod(addon, 'shutdown');
			}
		});
	};
	
	
	this.shutDown = async function () {
		var { addons } = await AddonManager.getActiveAddons(["extension"]);
		for (let addon of addons) {
			await _callMethod(addon, 'shutdown');
		}
	};
	
	
	/**
	 * Adapted from loadBootstrapScope() in Firefox 60 ESR
	 *
	 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4233
	 */
	 function _loadScope(addon) {
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
		Object.assign(scope, { Services, Worker, Zotero });
		scopes.set(addon.id, scope);
		
		var uri = addon.getResourceURI().spec + 'bootstrap.js';
		Services.scriptloader.loadSubScript(uri, scope);
	}
	
	
	/**
	 * Adapted from callBootstrapMethod() in Firefox 60 ESR
	 *
	 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4343
	 */
	async function _callMethod(addon, method) {
		try {
			let id = addon.id;
			Zotero.debug(`Calling bootstrap method '${method}' for plugin ${id} version ${addon.version}`);
			
			let scope = scopes.get(id);
			if (!scope) {
				_loadScope(addon);
				scope = scopes.get(id);
			}
			
			let func;
			try {
				func = scope[method] || Cu.evalInSandbox(`${method};`, scope);
			}
			catch (e) {}
			
			if (!func) {
				Zotero.warn(`Plugin ${id} is missing bootstrap method '${method}'`);
				return;
			}
			
			let params = {
				id: addon.id,
				version: addon.version,
				resourceURI: addon.getResourceURI().spec,
			};
			let reason = '';
			let result;
			try {
				result = func.call(scope, params, reason);
			}
			catch (e) {
				Zotero.logError(`Error running bootstrap method '${method}' on ${id}`);
				Zotero.logError(e);
			}
			
			// TODO: Needed?
			/*if (method == "startup") {
				activeAddon.startupPromise = Promise.resolve(result);
				activeAddon.startupPromise.catch(Cu.reportError);
			}*/
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	function _unloadScope(id) {
		scopes.delete(id);
	}
	
	
	this.getResourceURI = async function (id) {
		var addon = await AddonManager.getAddonByID(id);
		return addon.getResourceURI().spec;
	};
	
	
	this._addonObserver = {
		initialized: false,
		
		init() {
			if (!this.initialized) {
				AddonManager.addAddonListener(this);
				this.initialized = true;
			}
		},
		
		async onInstalling(addon) {
			Zotero.debug("Installing plugin " + addon.id);
		},
		
		async onInstalled(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Installed plugin " + addon.id);
			await _callMethod(addon, 'installed');
		},
		
		async onEnabling(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Enabling plugin " + addon.id);
			await _callMethod(addon, 'startup');
		},
		
		async onDisabled(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Disabling plugin " + addon.id);
			await _callMethod(addon, 'shutdown');
		},
		
		async onUninstalling(addon) {
			Zotero.debug("Uninstalling plugin " + addon.id);
		},
		
		async onUninstalled(addon) {
			Zotero.debug("Uninstalled plugin " + addon.id);
			await _callMethod(addon, 'shutdown');
			await _callMethod(addon, 'uninstalled');
		},
	};
};
