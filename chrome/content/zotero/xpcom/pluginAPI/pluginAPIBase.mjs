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
 *  - A function to check the value, returning true if it is valid; not called for an optional value left out
 * @property {PluginAPIOptDefConfig | PluginAPIOptDefType} [children]
 *  - The type definition of the children of the object. The children can be
 * an object or an array of objects with the same structure; for an array, a type
 * name instead is what every element must be
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


/**
 * Shared plumbing for both plugin API types: config, option validation, and logging
 */
class PluginAPIBase {
	_config = {
		apiName: "PluginAPIBase",
	};

	/**
	 * Set the configuration
	 * @param {PluginAPIConfig | ControllerAPIConfig} config - The configuration to set
	 */
	set config(config) {
		Object.assign(this._config, config);
	}

	/**
	 * Validate an object against type definition or check hook
	 * @param {object} obj - The object to validate
	 * @param {object} typeDef - The type definition to validate against
	 * @param {string} path - The path to the object in the type definition
	 * @returns {{obj?: object, valid: boolean, reason?: string}} - The validated object if valid, else why not
	 */
	_validateObject(obj, typeDef, path = "") {
		// A copy of the own properties; through Object.assign, a __proto__ key would set the prototype
		obj = Object.fromEntries(Object.entries(obj ?? {}));

		try {
			for (let key of Object.keys(typeDef)) {
				let val = obj[key];
				let requirement = typeDef[key];
				let fullPath = `${path}["${key}"]`;
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
					// Copy into a chrome-compartment array since Object.assign
					// only shallow-copies and the array may be from a sandbox
					val = obj[key] = Array.from(val);
				}
				// Should be required type or undefined
				else if (requiredType && requiredType !== "any" && !["undefined", requiredType].includes(gotType)) {
					throw new Error(`Option ${fullPath} must be ${requiredType}, got ${typeof val}`);
				}
				
				if (requirement.checkHook && gotType !== "undefined") {
					let result = requirement.checkHook(val);
					if (result !== true) {
						throw new Error(`Option ${fullPath} failed check: ${result}`);
					}
				}

				if (requirement.children) {
					if (Array.isArray(val)) {
						// A type name is checked on every element; a definition validates object elements
						if (typeof requirement.children === "string") {
							let bad = val.findIndex(v => typeof v !== requirement.children);
							if (bad !== -1) {
								throw new Error(`Option ${fullPath}[${bad}] must be ${requirement.children}, got ${typeof val[bad]}`);
							}
						}
						else if (val.length > 0 && typeof val[0] == "object") {
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
				if (gotType === "function" && !requirement.unsafeFunction) {
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
				reason: e.message,
			};
		}

		return {
			obj,
			valid: true,
		};
	}

	_log(message, logType = "debug") {
		lazy.Zotero[logType](`${this._config.apiName}: ${message}`);
	}
}

export { PluginAPIBase };
