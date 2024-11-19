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


/**
 * @typedef {object} PluginAPIConfig
 * @property {string} apiName - The name of the API
 * @property {string} mainKeyName - The main key in the option object that uniquely identifies it
 * @property {string} pluginIDKeyName - The key in the option object that identifies the plugin
 * @property {string} notifyType - The type of the notification to send after an update
 * @property {string} notifyAction - The action of the notification to send after an update
 * @property {Record<string, PluginAPIOptDefValue} optionTypeDefinition
 * - The option validation definition.
 *
 *
 * @typedef {string} PluginAPIOptDefType
 * - The type of the value
 *
 *
 * @typedef {(value: any) => boolean} PluginAPIOptDefCheckHook
 * - A function to check the value, returning true if it is valid
 *
 *
 * @typedef {object} PluginAPIOptDefConfig
 * @property {PluginAPIOptDefType} [type] - The type of the value
 * @property {boolean} [optional] - Whether the value is optional, default false
 * @property {PluginAPIOptDefCheckHook} [checkHook]
 *  - A function to check the value, returning true if it is valid
 * @property {PluginAPIOptDefConfig} [children]
 *  - The type definition of the children of the object. The children can be
 * an object or an array of objects with the same structure
 * @property {any} [fallbackReturn] - The value to return if the check hook fails
 * The fallback return is only used if the value is a function and it throws an error
 * If no fallback return is defined, the function will return null
 *
 *
 * @typedef {PluginAPIOptDefConfig | PluginAPIOptDefType | PluginAPIOptDefCheckHook} PluginAPIOptDefValue
 * - The value of the option definition
 * - If the value is a string, it is interpreted as the type
 * - If the value is a function, it is interpreted as a check hook
 * - If the value is an object, it is interpreted as a configuration object
 */


const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});


class PluginAPIBase {
	_optionsCache = {};

	_lastUpdateID = "";

	/**
	 * @type {PluginAPIConfig}
	 */
	_config = {
		apiName: "PluginAPIBase",
		mainKeyName: "id",
		pluginIDKeyName: "pluginID",
		notifyType: "unknown",
		notifyAction: "refresh",
		optionTypeDefinition: {},
	};

	get updateID() {
		return this._lastUpdateID;
	}

	get options() {
		return Object.values(this._optionsCache).map(opt => Object.assign({}, opt));
	}

	get data() {
		return {
			updateID: this.updateID,
			options: this.options,
		};
	}

	/**
	 * Set the configuration
	 * @param {PluginAPIConfig} config - The configuration to set
	 */
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
		this._refresh();
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
		this._refresh();
		return true;
	}

	/**
	 * Internal implementation of registering an option, can be overridden by subclasses
	 * @param {object} option - The option to add
	 * @returns {string | false} - The mainKey of the added option, or false if the option is invalid
	 */
	_add(option) {
		option = this._validate(option);
		if (option === false) {
			return false;
		}

		let mainKey = this._getOptionMainKey(option);
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
	 * @returns {object | false} - The option if it is valid, or false if it is invalid
	 */
	_validate(option) {
		let mainKey = this._namespacedMainKey(option);

		if (this._optionsCache[mainKey]) {
			this._log(`'${this._config.mainKeyName}' must be unique, got ${mainKey}`, "warn");
			return false;
		}

		let validateResult = this._validateObject(option, this._config.optionTypeDefinition);

		if (!validateResult.valid) {
			return false;
		}

		option = validateResult.obj;
		option[this._config.mainKeyName] = mainKey;
		return option;
	}

	/**
	 * Validate an object against type definition or check hook
	 * @param {object} obj - The object to validate
	 * @param {object} typeDef - The type definition to validate against
	 * @param {string} path - The path to the object in the type definition
	 * @returns {{obj?: object, valid: boolean}} - The validated object if valid and the validation flag
	 */
	_validateObject(obj, typeDef, path = "") {
		obj = Object.assign({}, obj);

		try {
			for (let key of Object.keys(typeDef)) {
				let val = obj[key];
				let requirement = typeDef[key];
				let fullPath = `${path}${key}`;
				if (!requirement) {
					throw new Error(`Unknown option ${fullPath}`);
				}

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
					throw new Error(`Option must have ${fullPath}`);
				}

				let requiredType = requirement.type;
				let gotType = typeof val;
				// Allow undefined values since it's checked above
				// Should be array or undefined
				if (requiredType === "array" && gotType !== "undefined") {
					if (!Array.isArray(val)) {
						throw new Error(`Option ${fullPath} must be ${requiredType}, got ${typeof val}`);
					}
				}
				// Should be required type or undefined
				else if (requiredType && requiredType !== "any" && !["undefined", requiredType].includes(gotType)) {
					throw new Error(`Option ${fullPath} must be ${requiredType}, got ${typeof val}`);
				}
				
				if (requirement.checkHook) {
					let result = requirement.checkHook(val);
					if (result !== true) {
						throw new Error(`Option ${fullPath} failed check: ${result}`);
					}
				}

				if (requirement.children) {
					if (Array.isArray(val)) {
						// Only validate array elements if they are objects
						if (val.length > 0 && typeof val[0] == "object") {
							for (let i = 0; i < val.length; i++) {
								let result = this._validateObject(val[i], requirement.children, `${path}.${key}[${i}].`);
								if (!result.valid) {
									// The detailed error message is already logged
									throw new Error(`Option ${fullPath}[${i}] is invalid`);
								}
								val[i] = result.obj;
							}
						}
					}
					else if (typeof val == "object") {
						let result = this._validateObject(val, requirement.children, `${path}.${key}`);
						if (!result.valid) {
							// The detailed error message is already logged
							throw new Error(`Option ${fullPath} is invalid`);
						}
						obj[key] = result.obj;
					}
				}

				// Validations passed, continue with post-processing

				// Wrap functions for safe execution
				if (gotType === "function") {
					obj[key] = (...args) => {
						try {
							return val(...args);
						}
						catch (e) {
							this._log(`Error in execution of ${fullPath}`, "warn");
							lazy.Zotero.logError(e);
							return requirement?.fallbackReturn || null;
						}
					};
				}
			}
		}
		catch (e) {
			this._log(String(e), "warn");
			return {
				valid: false,
			};
		}

		return {
			obj,
			valid: true,
		};
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
	async _refresh(ids = [], extraData = {}) {
		this._lastUpdateID = `${new Date().getTime()}-${lazy.Zotero.Utilities.randomString()}`;
		await lazy.Zotero.DB.executeTransaction(async () => {
			lazy.Zotero.Notifier.queue(
				this._config.notifyAction,
				this._config.notifyType,
				ids,
				extraData,
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
		// Remove the registrations one by one
		paneIDs.forEach(id => this._remove(id));
		this._log(`Registrations for plugin ${pluginID} are unregistered due to shutdown`);
		await this._refresh();
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
		lazy.Zotero[logType](`${this._config.apiName}: ${message}`);
	}

	_getOptionPluginID(option) {
		return option[this._config.pluginIDKeyName];
	}

	_getOptionMainKey(option) {
		return option[this._config.mainKeyName];
	}
}

export { PluginAPIBase };
