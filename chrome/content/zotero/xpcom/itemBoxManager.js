/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 Corporation for Digital Scholarship
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
 * @typedef {Object} ItemBoxCustomRowOptions
 * @property {string} dataKey - Data key of the row.
 * @property {string} label - Label for the row to be displayed in the item box.
 * @property {string} pluginID - Set plugin ID to auto remove row when plugin is removed.
 * @property {number} [index] - Index of the row.
 * - If not set, the row is appended to the end.
 * - Rows with lower indices are displayed first.
 * - Rows with the same index are displayed in unknown order.
 * - Index starts from `1`, after item type, title, and creators.
 * @property {boolean} [editable=false] - Whether the row is editable.
 * @property {boolean} [multiline=false] - Whether the row is multiline.
 * @property {(item: Zotero.Item, dataKey: string) => string} dataProvider
 * - Custom data provider that is called when rendering rows.
 * @property {(item: Zotero.Item, dataKey: string, value: string) => void} dataSetter
 * - Custom data setter that is called when editing rows.
 * @property {(item: Zotero.Item, dataKey: string) => boolean} [expandStateGetter]
 * - Custom expand state getter. Only used when multiline is true.
 * - Return true for expanded.
 * @property {(item: Zotero.Item, dataKey: string, expanded: boolean) => void} [expandStateSetter]
 * - Custom expand state setter. Only used when multiline is true.
 * - The expanded parameter is true for expanded.
 */

class ItemBoxManager {
	_observerAdded = false;

	/** @type {Record<string, ItemBoxCustomRowOptions}} */
	_customRows = {};

	/** @type {string[]} */
	_builtinFields = Zotero.ItemFields.getAll().map(f => f.name);

	/**
	 * Registers custom row(s) for the item box element.
	 * @param {ItemBoxCustomRowOptions | ItemBoxCustomRowOptions[]} options - Options for the custom row.
	 * @example
	 * Register an uneditable single row. The row will be appended to the end of the item box.
	 * ```js
	 * const registeredDataKey = await Zotero.ItemBoxManager.registerRows({
	 *   dataKey: 'rtitle',
	 *   label: 'Reversed Title',
	 *   pluginID: 'make-it-red@zotero.org',
	 *   dataProvider: (item, dataKey) => item.getField('title').split('').reverse().join(''),
	 *   dataSetter: (item, dataKey, value) => Zotero.debug(`Item ${item.getField("title")}'s reversed title is ${value} now.`),
	 * });
	 * ```
	 * @example
	 * Register an editable multiline row
	 * ```js
	 * const registeredDataKey = Zotero.ItemBoxManager.registerRows({
	 *   dataKey: 'rabstract',
	 *   label: 'Reversed Abstract',
	 *   pluginID: 'make-it-red@zotero.org', // plugin ID, which will be used to unregister the row when the plugin is unloaded
	 *   editable: true,
	 *   multiline: true,
	 *   index: 1,
	 *   dataProvider: (item, dataKey) => item.getField('abstractNote').split('').reverse().join(''),
	 *   dataSetter: (item, dataKey, value) => Zotero.debug(`Item ${item.getField("title")}'s reversed abstract is ${value} now.`),
	 *   expandStateGetter: (item, dataKey) => Zotero.Prefs.get("extensions.make-it-red.reversedAbstractExpanded", true),
	 *   expandStateSetter: (item, dataKey, expanded) => Zotero.Prefs.set("extensions.make-it-red.reversedAbstractExpanded", expanded, true)
	 * });
	 * ```
	 */
	async registerRows(options) {
		const registeredDataKeys = this._addRow(options);
		if (!registeredDataKeys) {
			return false;
		}
		this._addPluginShutdownObserver();
		await this._notifyItemBoxes();
		return registeredDataKeys;
	}

	/**
	 * Unregister custom row(s) for the item box element.
	 * @param {string | string[]} dataKeys - Data key(s) of the row(s).
	 * @example
	 * ```js
	 * Zotero.ItemBoxManager.unregisterRows(registeredDataKey);
	 * ```
	 */
	async unregisterRows(dataKeys) {
		const success = this._removeRows(dataKeys);
		if (!success) {
			return false;
		}
		await this._notifyItemBoxes();
		return true;
	}

	/**
	 * Get row(s) that matches the properties of option
	 * @param {ItemBoxCustomRowOptions} [options] - An option or array of options to match
	 * @returns {ItemBoxCustomRowOptions[]}
	 */
	getCustomRows(options) {
		const allRows = Object.values(this._customRows).map(opt => Object.assign({}, opt));
		if (!options) {
			return allRows;
		}
		let filteredRows = allRows;
		if (options) {
			filteredRows = filteredRows.filter((row) => {
				return Object.keys(options).every((key) => {
					// Ignore undefined properties
					if (options[key] === undefined) {
						return true;
					}
					return options[key] === row[key];
				});
			});
		}
		return filteredRows;
	}


	/**
	 * Check if a row is registered as a custom row
	 * @param {string} dataKey - The dataKey of the row
	 * @returns {boolean} true if the row is registered as a custom row
	 */
	isCustomRow(dataKey) {
		return !!this._customRows[dataKey];
	}

	/**
	 * A centralized data source for custom rows. This is used by the ItemBox to get data.
	 * @param {Zotero.Item} item - The item to get data from
	 * @param {string} dataKey - The dataKey of the row
	 * @returns {string}
	 */
	getCustomRowData(item, dataKey) {
		const options = this._customRows[dataKey];
		if (options && options.dataProvider) {
			return options.dataProvider(item, dataKey);
		}
		return "";
	}

	/**
	 * A centralized data setter for custom rows. This is used by the ItemBox to set data.
	 * @param {Zotero.Item} item - The item to set data to
	 * @param {string} dataKey - The dataKey of the row
	 * @param {string} value - The value to set
	 * @returns {void}
	 */
	setCustomRowData(item, dataKey, value) {
		const options = this._customRows[dataKey];
		if (options && options.dataSetter) {
			options.dataSetter(item, dataKey, value);
		}
	}

	/**
	 * A centralized expand state getter for custom rows. This is used by the ItemBox to get data.
	 * @param {Zotero.Item} item - The item to get data from
	 * @param {string} dataKey - The dataKey of the row
	 * @returns {boolean | undefined}
	 * - true for expanded
	 * - false for collapsed
	 */
	getCustomRowExpandState(item, dataKey) {
		const options = this._customRows[dataKey];
		if (options && options.expandStateGetter) {
			return options.expandStateGetter(item, dataKey);
		}
		return undefined;
	}

	/**
	 * A centralized expand state setter for custom rows. This is used by the ItemBox to set data.
	 * @param {Zotero.Item} item - The item to set data to
	 * @param {string} dataKey - The dataKey of the row
	 * @param {boolean} expanded - true for expanded, false for collapsed
	 * @returns {void}
	 */
	setCustomRowExpandState(item, dataKey, expanded) {
		const options = this._customRows[dataKey];
		if (options && options.expandStateSetter) {
			options.expandStateSetter(item, dataKey, expanded);
		}
	}


	/**
	 * Check if row options are valid.
	 * All its children must be valid. Otherwise, the validation fails.
	 * @param {ItemBoxCustomRowOptions[]} options - An array of options to validate
	 * @returns {boolean} true if the options are valid
	 */
	_validateRowOption(options) {
		// Check if the input option has duplicate dataKeys
		const noInputDuplicates = !options.find((opt, i, arr) => arr.findIndex(o => o.dataKey === opt.dataKey) !== i);
		if (!noInputDuplicates) {
			Zotero.warn(`ItemBox Row options have duplicate dataKey.`);
		}
		const requiredProperties = options.every((option) => {
			let valid = option.dataKey && option.label && option.pluginID
				&& option.dataProvider && option.dataSetter;
			if (!valid) {
				Zotero.warn(`ItemBox Row option ${JSON.stringify(option)} must have dataKey, label, pluginID, dataProvider, and dataSetter.`);
				return false;
			}
			if (option.multiline) {
				valid &&= option.expandStateGetter && option.expandStateSetter;
			}
			if (!valid) {
				Zotero.warn(`ItemBox Row option ${JSON.stringify(option)} is multiline, must have expandStateGetter and expandStateSetter.`);
			}
			return valid;
		});
		const noRegisteredDuplicates = options.every((option) => {
			const valid = !this._customRows[option.dataKey] && !this._builtinFields.includes(option.dataKey);
			if (!valid) {
				Zotero.warn(`ItemBox Row options ${JSON.stringify(option)} with dataKey ${option.dataKey} already exists.`);
			}
			return valid;
		});
		return noInputDuplicates && requiredProperties && noRegisteredDuplicates;
	}

	/**
	 * Make sure the dataKey is namespaced with the plugin ID
	 * @param {ItemBoxCustomRowOptions} options
	 * @returns {string}
	 */
	_namespacedDataKey(options) {
		if (options.pluginID && options.dataKey) {
			// Make sure the return value is valid as class name or element id
			return `${options.pluginID}-${options.dataKey}`.replace(/[^a-zA-Z0-9_]/g, "$");
		}
		return options.dataKey;
	}

	/**
	 * Add a new row or new rows.
	 * If the options is an array, all its children must be valid.
	 * Otherwise, no rows are added.
	 * @param {ItemBoxCustomRowOptions | ItemBoxCustomRowOptions[]} options - Rows to add
	 * @returns {string | string[] | false} - The dataKey(s) of the added row(s) or false if no rows were added
	 */
	_addRow(options) {
		const isSingle = !Array.isArray(options);
		if (isSingle) {
			options = [options];
		}

		options.forEach((o) => {
			o.dataKey = this._namespacedDataKey(o);
		});
		// If any check fails, return check results
		if (!this._validateRowOption(options)) {
			return false;
		}
		for (const opt of options) {
			this._customRows[opt.dataKey] = Object.assign({}, opt, { custom: true });
		}
		return isSingle ? options[0].dataKey : options.map(opt => opt.dataKey);
	}

	/**
	 * Remove row options
	 * @param {string | string[]} dataKeys - The dataKeys of the rows to remove
	 * @returns {boolean} - True if row(s) were removed, false if not
	 */
	_removeRows(dataKeys) {
		if (!Array.isArray(dataKeys)) {
			dataKeys = [dataKeys];
		}
		// If any check fails, return check results and do not remove any rows
		for (const key of dataKeys) {
			if (!this._customRows[key]) {
				Zotero.warn(`ItemBox Row option with dataKey ${key} does not exist.`);
				return false;
			}
		}
		for (const key of dataKeys) {
			delete this._customRows[key];
		}
		return true;
	}

	/**
	 * Notify all item boxes to refresh
	 */
	async _notifyItemBoxes() {
		let mainWindows = Zotero.getMainWindows();
		for (const win of mainWindows) {
			for (const itemBox of win.document.querySelectorAll("item-box")) {
				try {
					itemBox.refresh();
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
	}

	/**
	 * Unregister all rows registered by a plugin
	 * @param {string} pluginID - Plugin ID
	 */
	async _unregisterRowsByPluginID(pluginID) {
		const rows = this.getCustomRows(undefined, { pluginID });
		if (rows.length === 0) {
			return;
		}
		// Remove the rows one by one
		// This is to ensure that the rows are removed and not interrupted by any non-existing rows
		rows.forEach(row => this._removeRows(row.dataKey));
		Zotero.debug(`ItemBox rows registered by plugin ${pluginID} unregistered due to shutdown`);
		await this._notifyItemBoxes();
	}

	/**
	 * Ensure that the shutdown observer is added
	 * @returns {void}
	 */
	_addPluginShutdownObserver() {
		if (this._observerAdded) {
			return;
		}

		Zotero.Plugins.addObserver({
			shutdown: ({ id: pluginID }) => {
				this._unregisterRowsByPluginID(pluginID);
			}
		});
		this._observerAdded = true;
	}
}

Zotero.ItemBoxManager = new ItemBoxManager();
