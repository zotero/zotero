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


import { PluginAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});


/**
 * Registration-style API: plugins register option objects that Zotero renders and
 * unregister them, with per-plugin cleanup on shutdown
 */
class ManagerAPIBase extends PluginAPIBase {
	_optionsCache = {};

	_lastUpdateID = "";

	/**
	 * @type {PluginAPIConfig}
	 */
	_config = {
		apiName: "ManagerAPIBase",
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
	 * @param {string} [callerPluginID] - Calling plugin's ID, injected for unprivileged callers
	 * @returns {boolean} - True if the option was successfully unregistered
	 */
	unregister(mainKey, callerPluginID) {
		let option = this._optionsCache[mainKey];
		if (callerPluginID && option
				&& this._getOptionPluginID(option) !== callerPluginID) {
			this._log(`Plugin '${callerPluginID}' cannot unregister '${mainKey}' owned by another plugin`, "warn");
			return false;
		}
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

		option = this._convert(option);

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
	 * Make sure the mainKey is namespaced with the pluginID
	 * @param {object} option
	 * @returns {string}
	 */
	_namespacedMainKey(option) {
		let mainKey = this._getOptionMainKey(option);
		let pluginID = this._getOptionPluginID(option);
		if (pluginID && mainKey) {
			// Make sure the return value is valid as class name or element id
			return CSS.escape(`${pluginID}-${mainKey}`);
		}
		return mainKey;
	}

	/**
	 * Convert the option before storing, can be overridden by subclasses
	 * @param {object} option
	 * @returns {object}
	 */
	_convert(option) {
		return option;
	}

	/**
	 * Notify the receiver to update
	 */
	async _refresh(ids = [], extraData = {}) {
		if (!this._config.notifyType || this._config.notifyType === "unknown") {
			return;
		}
		this._lastUpdateID = this._generateRandomKey();
		// register(), unregister(), and refresh() call _refresh() without awaiting it, so yield
		// first to keep observers -- and the plugin hooks they call -- from running before those
		// calls return
		await Promise.resolve();
		await lazy.Zotero.Notifier.trigger(
			this._config.notifyAction,
			this._config.notifyType,
			ids,
			extraData,
		);
	}

	/**
	 * Unregister all stored options by pluginID
	 * @param {string} pluginID - PluginID
	 * @returns {Promise<string[]>} - The mainKeys of the unregistered options
	 */
	async _unregisterByPluginID(pluginID) {
		let paneIDs = Object.keys(this._optionsCache).filter(
			id => this._getOptionPluginID(this._optionsCache[id]) == pluginID);
		if (paneIDs.length === 0) {
			return [];
		}
		// Remove the registrations one by one
		paneIDs.forEach(id => this._remove(id));
		this._log(`Registrations for plugin ${pluginID} are unregistered due to shutdown`);
		await this._refresh();
		return paneIDs;
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

	_getOptionPluginID(option) {
		return option[this._config.pluginIDKeyName];
	}

	_getOptionMainKey(option) {
		return option[this._config.mainKeyName];
	}

	_generateRandomKey() {
		return `${lazy.Zotero.Utilities.randomString()}-${new Date().getTime()}`;
	}
}

export { ManagerAPIBase };
