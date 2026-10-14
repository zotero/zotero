/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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


{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		ManagerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
	});

	const VALID_TARGETS = [
		"mainWindow",
		"preferencePane",
		"readerWindow",
	];

	const VALID_TYPES = [
		"ftl",
	];

	/**
	 * @typedef WindowResourceOptions
	 * @type {object}
	 * @property {string} resourceID - The unique ID of the resource registration
	 * @property {string} pluginID - The ID of the plugin registering the resource
	 * @property {string} target - The target window type, see `VALID_TARGETS`
	 * @property {string} type - The resource type: "ftl"
	 * @property {string} url - The URL of the resource to load
	 */


	class WindowResourceManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "WindowResourceAPI",
				mainKeyName: "resourceID",
				// Disable notifier, as resources are applied directly to windows
				notifyType: false,
				optionTypeDefinition: {
					resourceID: "string",
					pluginID: "string",
					target: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (!VALID_TARGETS.includes(value)) {
								return `Option 'target' must be one of ${VALID_TARGETS.join(", ")}, got ${value}`;
							}
							return true;
						}
					},
					type: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (!VALID_TYPES.includes(value)) {
								return `Option 'type' must be one of ${VALID_TYPES.join(", ")}, got ${value}`;
							}
							return true;
						}
					},
					url: "string",
				},
			};
		}

		register(option) {
			let mainKey = this._add(option);
			if (!mainKey) {
				return false;
			}
			this._addPluginShutdownObserver();
			this._applyResource(this._optionsCache[mainKey]);
			return mainKey;
		}

		/**
		 * Get all open windows matching the target type
		 * @param {string} target
		 * @returns {ChromeWindow[]}
		 */
		_getTargetWindows(target) {
			if (target === "mainWindow") {
				return Zotero.getMainWindows();
			}
			let windowType;
			if (target === "preferencePane") {
				windowType = "zotero:pref";
			}
			else if (target === "readerWindow") {
				windowType = "zotero:reader";
			}
			else {
				return [];
			}
			let windows = [];
			let enumerator = Services.wm.getEnumerator(windowType);
			while (enumerator.hasMoreElements()) {
				windows.push(enumerator.getNext());
			}
			return windows;
		}

		/**
		 * Apply a resource to all matching open windows
		 * @param {WindowResourceOptions} option
		 */
		_applyResource(option) {
			let windows = this._getTargetWindows(option.target);
			for (let win of windows) {
				this._applyToWindow(win, option);
			}
		}

		/**
		 * Apply a single resource to a window
		 * @param {ChromeWindow} win
		 * @param {WindowResourceOptions} option
		 */
		_applyToWindow(win, option) {
			if (option.type === "ftl") {
				win.document.l10n.addResourceIds([
					{ path: option.url, optional: true },
				]);
			}
		}

		/**
		 * Remove a resource from all matching open windows
		 * @param {WindowResourceOptions} option
		 */
		_removeResource(option) {
			let windows = this._getTargetWindows(option.target);
			for (let win of windows) {
				this._removeFromWindow(win, option);
			}
		}

		/**
		 * Remove a single resource from a window
		 * @param {ChromeWindow} win
		 * @param {WindowResourceOptions} option
		 */
		_removeFromWindow(win, option) {
			if (option.type === "ftl") {
				win.document.l10n.removeResourceIds([
					{ path: option.url },
				]);
			}
		}

		_remove(mainKey) {
			let option = this._optionsCache[mainKey];
			if (!option) {
				this._log(`Can't remove unknown option '${mainKey}'`, "warn");
				return false;
			}
			this._removeResource(option);
			delete this._optionsCache[mainKey];
			return true;
		}

		async _unregisterByPluginID(pluginID) {
			let keys = Object.keys(this._optionsCache).filter(
				id => this._getOptionPluginID(this._optionsCache[id]) == pluginID);
			if (keys.length === 0) {
				return [];
			}
			keys.forEach(id => this._remove(id));
			this._log(`Registrations for plugin ${pluginID} are unregistered due to shutdown`);
			return keys;
		}

		/**
		 * Apply all registered resources to a newly opened window
		 * @param {ChromeWindow} win
		 * @param {string} target - The target type of the window
		 */
		applyAllToWindow(win, target) {
			for (let option of Object.values(this._optionsCache)) {
				if (option.target === target) {
					this._applyToWindow(win, option);
				}
			}
		}
	}


	/**
	 * Manages window resource (FTL) registration for plugins.
	 *
	 * @memberof Zotero
	 */
	Zotero.WindowResourceManager = {
		_manager: new WindowResourceManagerInternal(),

		/**
		 * Register a window resource (FTL)
		 * @param {WindowResourceOptions} options
		 * @returns {string | false}
		 */
		registerResource(options) {
			return this._manager.register(options);
		},

		/**
		 * Unregister a window resource
		 * @param {string} resourceID
		 * @returns {boolean}
		 */
		unregisterResource(resourceID, _callerPluginID) {
			return this._manager.unregister(resourceID, _callerPluginID);
		},

		/**
		 * Apply all registered resources to a newly opened window.
		 * Should be called when a the corresponding window type is opened.
		 * @param {ChromeWindow} win
		 * @param {string} target - see `VALID_TARGETS`
		 */
		applyAllToWindow(win, target) {
			this._manager.applyAllToWindow(win, target);
		},
	};

	lazy.ScopeVariables.setCustomParser(
		Zotero.WindowResourceManager.registerResource,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.WindowResourceManager.unregisterResource,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
