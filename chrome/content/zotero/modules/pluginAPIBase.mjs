/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
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


const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});


class PluginAPIBase {
	_optionsCache = {};

	_lastUpdateTime = 0;

	_config = {
		APIName: "PluginAPIBase",
		mainKeyName: "id",
		pluginIDKeyName: "pluginID",
		notifyType: "unknown",
		notifyAction: "refresh",
		optionTypeDefinition: {},
	};

	get updateTime() {
		return this._lastUpdateTime;
	}

	get options() {
		return Object.values(this._optionsCache).map(opt => Object.assign({}, opt));
	}

	set config(config) {
		Object.assign(this._config, config);
	}

	/**
	 * Register an option. Must be valid with a unique mainKey defined by _config#mainKeyName
	 * @param {object} option - The option to register
	 * @returns {string | false} - The mainKey of the registered option, or false if the option is invalid
	 */
	register(option) {
		let mainKey = this._add(option);
		if (!mainKey) {
			return false;
		}
		this._addPluginShutdownObserver();
		this._update();
		return mainKey;
	}

	/**
	 * Unregister an option by mainKey
	 * @param {string} mainKey - The mainKey of the option to unregister
	 * @returns {boolean} - True if the option was successfully unregistered
	 */
	unregister(mainKey) {
		const success = this._remove(mainKey);
		if (!success) {
			return false;
		}
		this._update();
		return true;
	}

	/**
	 * Internal implementation of registering an option, can be overridden by subclasses
	 * @param {object} option - The option to add
	 * @returns {string | false} - The mainKey of the added option, or false if the option is invalid
	 */
	_add(option) {
		option = Object.assign({}, option);
		let mainKey = this._namespacedMainKey(option);
		option[this._config.mainKeyName] = mainKey;
		if (!this._validate(option)) {
			return false;
		}
		this._optionsCache[mainKey] = option;
		return mainKey;
	}

	/**
	 * Internal implementation of unregistering an option, can be overridden by subclasses
	 * @param {object} mainKey - The mainKey of the option to remove
	 * @returns {boolean} - True if the option was successfully removed
	 */
	_remove(mainKey) {
		if (!this._optionsCache[mainKey]) {
			this._log(`Can't remove unknown option '${mainKey}'`, "warn");
			return false;
		}
		delete this._optionsCache[mainKey];
		return true;
	}

	/**
	 * Internal implementation of validating an option, can be overridden by subclasses
	 * @param {object} option
	 * @returns {boolean}
	 */
	_validate(option) {
		let mainKey = this._getOptionMainKey(option);

		if (this._optionsCache[mainKey]) {
			this._log(`'${this._config.mainKeyName}' must be unique, got ${mainKey}`, "warn");
			return false;
		}

		return this._validateObject(option, this._config.optionTypeDefinition);
	}

	_validateObject(obj, typeDef, path = "") {
		for (let key of Object.keys(typeDef)) {
			let val = obj[key];
			let requirement = typeDef[key];
			if (typeof requirement === "string") {
				requirement = {
					optional: false,
					type: requirement,
				};
			}
			else if (typeof requirement === "function") {
				requirement = {
					optional: false,
					checkHook: requirement,
				};
			}

			if (!requirement.optional && typeof val === "undefined") {
				this._log(`Option must have ${path}${key}`, "warn");
				return false;
			}

			let requiredType = requirement.type;
			let gotType = typeof val;
			// Allow undefined values since it's checked above
			// Should be array or undefined
			if (requiredType === "array" && gotType !== "undefined") {
				if (!Array.isArray(val)) {
					this._log(`Option ${path}${key} must be ${requiredType}, got ${typeof val}`, "warn");
					return false;
				}
			}
			// Should be required type or undefined
			else if (requiredType && requiredType !== "any" && !["undefined", requiredType].includes(gotType)) {
				this._log(`Option ${path}${key} must be ${requiredType}, got ${typeof val}`, "warn");
				return false;
			}
			
			if (requirement.checkHook) {
				let result = requirement.checkHook(val);
				if (result !== true) {
					this._log(`Option ${path}${key} failed check: ${result}`, "warn");
					return false;
				}
			}

			if (requirement.children) {
				if (Array.isArray(val) && val.length > 0 && typeof val[0] == "object") {
					for (let i = 0; i < val.length; i++) {
						let result = this._validateObject(val[i], requirement.children, `${path}.${key}[${i}].`);
						if (!result) {
							return false;
						}
					}
				}
				else if (typeof val == "object") {
					let result = this._validateObject(val, requirement.children, `${path}.${key}`);
					if (!result) {
						return false;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Make sure the mainKey is namespaced with the pluginID
	 * @param {object} option
	 * @returns {string}
	 */
	_namespacedMainKey(option) {
		let mainKey = this._getOptionMainKey(option);
		let pluginID = this._getOptionPluginID(option);
		if (pluginID && mainKey) {
			// Make sure the return value is valid as class name or element id
			return CSS.escape(`${pluginID}-${mainKey}`.replace(/[^a-zA-Z0-9-_]/g, "-"));
		}
		return mainKey;
	}

	/**
	 * Notify the receiver to update
	 */
	async _update() {
		this._lastUpdateTime = new Date().getTime();
		await lazy.Zotero.DB.executeTransaction(async () => {
			lazy.Zotero.Notifier.queue(
				this._config.notifyAction,
				this._config.notifyType,
				[],
				{},
			);
		});
	}

	/**
	 * Unregister all stored options by pluginID
	 * @param {string} pluginID - PluginID
	 */
	async _unregisterByPluginID(pluginID) {
		let paneIDs = Object.keys(this._optionsCache).filter(
			id => this._getOptionPluginID(this._optionsCache[id]) == pluginID);
		if (paneIDs.length === 0) {
			return;
		}
		// Remove the columns one by one
		// This is to ensure that the columns are removed and not interrupted by any non-existing columns
		paneIDs.forEach(id => this._remove(id));
		this._log(`Section for plugin ${pluginID} unregistered due to shutdown`);
		await this._update();
	}

	/**
	 * Ensure the plugin shutdown observer is added
	 * @returns {void}
	 */
	_addPluginShutdownObserver() {
		if (this._observerAdded) {
			return;
		}

		lazy.Zotero.Plugins.addObserver({
			shutdown: ({ id: pluginID }) => {
				this._unregisterByPluginID(pluginID);
			}
		});
		this._observerAdded = true;
	}

	_log(message, logType = "debug") {
		lazy.Zotero[logType](`${this._config.APIName}: ${message}`);
	}

	_getOptionPluginID(option) {
		return option[this._config.pluginIDKeyName];
	}

	_getOptionMainKey(option) {
		return option[this._config.mainKeyName];
	}
}

export { PluginAPIBase };
