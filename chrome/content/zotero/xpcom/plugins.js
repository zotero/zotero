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
	var observers = new Set();
	
	const REASONS = {
		APP_STARTUP: 1,
		APP_SHUTDOWN: 2,
		ADDON_ENABLE: 3,
		ADDON_DISABLE: 4,
		ADDON_INSTALL: 5,
		ADDON_UNINSTALL: 6,
		ADDON_UPGRADE: 7, // TODO
		ADDON_DOWNGRADE: 8 // TODO
	};
	
	this.init = async function () {
		this._addonObserver.init();
		
		var { addons } = await AddonManager.getActiveAddons(["extension"]);
		for (let addon of addons) {
			await _callMethod(addon, 'startup', REASONS.APP_STARTUP);
		}
		
		Zotero.addShutdownListener(async () => {
			var { addons } = await AddonManager.getActiveAddons(["extension"]);
			for (let addon of addons) {
				await _callMethod(addon, 'shutdown', REASONS.APP_SHUTDOWN);
			}
		});
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
		for (let name in REASONS) {
			scope[name] = REASONS[name];
		}
		Object.assign(scope, { Services, Worker, ChromeWorker, Zotero });
		scopes.set(addon.id, scope);
		
		var uri = addon.getResourceURI().spec + 'bootstrap.js';
		Services.scriptloader.loadSubScript(uri, scope);
	}
	
	
	/**
	 * Adapted from callBootstrapMethod() in Firefox 60 ESR
	 *
	 * https://searchfox.org/mozilla-esr60/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm#4343
	 */
	async function _callMethod(addon, method, reason) {
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
				rootURI: addon.getResourceURI().spec
			};
			let result;
			try {
				result = func.call(scope, params, reason);
			}
			catch (e) {
				Zotero.logError(`Error running bootstrap method '${method}' on ${id}`);
				Zotero.logError(e);
			}

			for (let observer of observers) {
				if (observer[method]) {
					try {
						observer[method](params, reason);
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
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
	
	
	this.getName = async function (id) {
		var addon = await AddonManager.getAddonByID(id);
		return addon.name;
	};


	/**
	 * @param {String} id
	 * @param {Number} idealSize In logical pixels (scaled automatically on hiDPI displays)
	 * @returns {Promise<String | null>}
	 */
	this.getIconURI = async function (id, idealSize) {
		var addon = await AddonManager.getAddonByID(id);
		return AddonManager.getPreferredIconURL(addon, idealSize, Services.appShell.hiddenDOMWindow);
	};
	
	
	this.addObserver = function (observer) {
		observers.add(observer);
	};
	
	
	this.removeObserver = function (observer) {
		observers.delete(observer);
	};
	
	
	function notifyObservers(fnName, id) {
		for (let observer of observers) {
			if (observer[fnName]) {
				observer[fnName](id);
			}
		}
	}
	
	
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
			await _callMethod(addon, 'install');
			await _callMethod(addon, 'startup', REASONS.ADDON_INSTALL);
		},
		
		async onEnabling(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Enabling plugin " + addon.id);
			await _callMethod(addon, 'startup', REASONS.ADDON_ENABLE);
		},
		
		async onDisabled(addon) {
			if (addon.type !== "extension") {
				return;
			}
			Zotero.debug("Disabling plugin " + addon.id);
			await _callMethod(addon, 'shutdown', REASONS.ADDON_DISABLE);
		},
		
		async onUninstalling(addon) {
			Zotero.debug("Uninstalling plugin " + addon.id);
		},
		
		async onUninstalled(addon) {
			Zotero.debug("Uninstalled plugin " + addon.id);
			await _callMethod(addon, 'shutdown', REASONS.ADDON_UNINSTALL);
			await _callMethod(addon, 'uninstall');
		},
	};
};
