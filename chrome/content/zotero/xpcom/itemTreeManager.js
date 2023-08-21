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

const { COLUMNS: ITEMTREE_COLUMNS } = require("zotero/itemTreeColumns");

/**
 * @typedef {import("../itemTreeColumns.jsx").ItemTreeColumnOptions} ItemTreeColumnOptions
 * @typedef {"dataKey" | "label" | "pluginID"} RequiredCustomColumnOptionKeys
 * @typedef {Required<Pick<ItemTreeColumnOptions, RequiredCustomColumnOptionKeys>>} RequiredCustomColumnOptionsPartial
 * @typedef {Omit<ItemTreeColumnOptions, RequiredCustomColumnOptionKeys>} CustomColumnOptionsPartial
 * @typedef {RequiredCustomColumnOptionsPartial & CustomColumnOptionsPartial} ItemTreeCustomColumnOptions
 * @typedef {Partial<Omit<ItemTreeCustomColumnOptions, "enabledTreeIDs">>} ItemTreeCustomColumnFilters
 */

class ItemTreeManager {
	_observerAdded = false;

	/** @type {Record<string, ItemTreeCustomColumnOptions}} */
	_customColumns = {};

	/**
	 * Register a custom column. All registered columns must be valid, and must have a unique dataKey.
	 * Although it's async, resolving does not promise the item trees are updated.
	 *
	 * Note that the `dataKey` you use here may be different from the one returned by the function.
	 * This is because the `dataKey` is prefixed with the `pluginID` to avoid conflicts after the column is registered.
	 * @param {ItemTreeCustomColumnOptions | ItemTreeCustomColumnOptions[]} options - An option or array of options to register
	 * @returns {string | string[] | false} - The dataKey(s) of the added column(s) or false if no columns were added
	 * @example
	 * A minimal custom column:
	 * ```js
	 * // You can unregister the column later with Zotero.ItemTreeManager.unregisterColumns(registeredDataKey);
	 * const registeredDataKey = await Zotero.ItemTreeManager.registerColumns(
	 * {
	 *     dataKey: 'rtitle',
	 *     label: 'Reversed Title',
	 *     pluginID: 'make-it-red@zotero.org', // Replace with your plugin ID
	 *     dataProvider: (item, dataKey) => {
	 *         return item.getField('title').split('').reverse().join('');
	 *     },
	 * });
	 * ```
	 * @example
	 * A custom column using all available options.
	 * Note that the column will only be shown in the main item tree.
	 * ```js
	 * const registeredDataKey = await Zotero.ItemTreeManager.registerColumns(
	 * {
	 *     dataKey: 'rtitle',
	 *     label: 'Reversed Title',
	 *     enabledTreeIDs: ['main'], // only show in the main item tree
	 *     sortReverse: true, // sort by increasing order
	 *     flex: 0, // don't take up all available space
	 *     width: 100, // assign fixed width in pixels
	 *     fixedWidth: true, // don't allow user to resize
	 *     staticWidth: true, // don't allow column to be resized when the tree is resized
	 *     minWidth: 50, // minimum width in pixels
	 *     iconPath: 'chrome://zotero/skin/tick.png', // icon to show in the column header
	 *     htmlLabel: '<span style="color: red;">reversed title</span>', // use HTML in the label. This will override the label and iconPath property
	 *     showInColumnPicker: true, // show in the column picker
	 *     columnPickerSubMenu: true, // show in the column picker submenu
	 *     pluginID: 'make-it-red@zotero.org', // plugin ID, which will be used to unregister the column when the plugin is unloaded
	 *     dataProvider: (item, dataKey) => {
	 *         // item: the current item in the row
	 *         // dataKey: the dataKey of the column
	 *         // return: the data to display in the column
	 *         return item.getField('title').split('').reverse().join('');
	 *     },
	 *     renderCell: (index, data, column) => {
	 *         // index: the index of the row
	 *         // data: the data to display in the column, return of `dataProvider`
	 *         // column: the column options
	 *         // return: the HTML to display in the cell
	 *         const cell = document.createElement('span');
	 *         cell.className = `cell ${column.className}`;
	 *         cell.textContent = data;
	 *         cell.style.color = 'red';
	 *         return cell;
	 *     },
	 *     zoteroPersist: ['width', 'hidden', 'sortDirection'], // persist the column properties
	 * });
	 * ```
	 * @example
	 * Register multiple custom columns:
	 * ```js
	 * const registeredDataKeys = await Zotero.ItemTreeManager.registerColumns(
	 * [
	 *     {
	 *          dataKey: 'rtitle',
	 *          iconPath: 'chrome://zotero/skin/tick.png',
	 *          label: 'Reversed Title',
	 *          pluginID: 'make-it-red@zotero.org', // Replace with your plugin ID
	 *          dataProvider: (item, dataKey) => {
	 *              return item.getField('title').split('').reverse().join('');
	 *          },
	 *     },
	 *     {
	 *          dataKey: 'utitle',
	 *          label: 'Uppercase Title',
	 *          pluginID: 'make-it-red@zotero.org', // Replace with your plugin ID
	 *          dataProvider: (item, dataKey) => {
	 *              return item.getField('title').toUpperCase();
	 *          },
	 *     },
	 * ]);
	 * ```
	 */
	async registerColumns(options) {
		const registeredDataKeys = this._addColumns(options);
		if (!registeredDataKeys) {
			return false;
		}
		this._addPluginShutdownObserver();
		await this._notifyItemTrees();
		return registeredDataKeys;
	}

	/**
	 * Unregister a custom column.
	 * Although it's async, resolving does not promise the item trees are updated.
	 * @param {string | string[]} dataKeys - The dataKey of the column to unregister
	 * @returns {boolean} true if the column(s) are unregistered
	 * @example
	 * The `registeredDataKey` is returned by the `registerColumns` function.
	 * ```js
	 * Zotero.ItemTreeManager.unregisterColumns(registeredDataKey);
	 * ```
	 */
	async unregisterColumns(dataKeys) {
		const success = this._removeColumns(dataKeys);
		if (!success) {
			return false;
		}
		await this._notifyItemTrees();
		return true;
	}

	/**
	 * Get column(s) that matches the properties of option
	 * @param {string | string[]} [filterTreeIDs] - The tree IDs to match
	 * @param {ItemTreeCustomColumnFilters} [options] - An option or array of options to match
	 * @returns {ItemTreeCustomColumnOptions[]}
	 */
	getCustomColumns(filterTreeIDs, options) {
		const allColumns = Object.values(this._customColumns).map(opt => Object.assign({}, opt));
		if (!filterTreeIDs && !options) {
			return allColumns;
		}
		let filteredColumns = allColumns;
		if (typeof filterTreeIDs === "string") {
			filterTreeIDs = [filterTreeIDs];
		}
		if (filterTreeIDs && !filterTreeIDs.includes("*")) {
			const filterTreeIDsSet = new Set(filterTreeIDs);
			filteredColumns = filteredColumns.filter((column) => {
				if (column.enabledTreeIDs[0] == "*") return true;

				for (const treeID of column.enabledTreeIDs) {
					if (filterTreeIDsSet.has(treeID)) return true;
				}
				return false;
			});
		}
		if (options) {
			filteredColumns = filteredColumns.filter((col) => {
				return Object.keys(options).every((key) => {
					// Ignore undefined properties
					if (options[key] === undefined) {
						return true;
					}
					return options[key] === col[key];
				});
			});
		}
		return filteredColumns;
	}

	/**
	 * Check if a column is registered as a custom column
	 * @param {string} dataKey - The dataKey of the column
	 * @returns {boolean} true if the column is registered as a custom column
	 */
	isCustomColumn(dataKey) {
		return !!this._customColumns[dataKey];
	}

	/**
	 * A centralized data source for custom columns. This is used by the ItemTreeRow to get data.
	 * @param {Zotero.Item} item - The item to get data from
	 * @param {string} dataKey - The dataKey of the column
	 * @returns {string}
	 */
	getCustomCellData(item, dataKey) {
		const options = this._customColumns[dataKey];
		if (options && options.dataProvider) {
			return options.dataProvider(item, dataKey);
		}
		return "";
	}

	/**
	 * Check if column options is valid.
	 * All its children must be valid. Otherwise, the validation fails.
	 * @param {ItemTreeCustomColumnOptions[]} options - An array of options to validate
	 * @returns {boolean} true if the options are valid
	 */
	_validateColumnOption(options) {
		// Check if the input option has duplicate dataKeys
		const noInputDuplicates = !options.find((opt, i, arr) => arr.findIndex(o => o.dataKey === opt.dataKey) !== i);
		if (!noInputDuplicates) {
			Zotero.warn(`ItemTree Column options have duplicate dataKey.`);
		}
		const noDeniedProperties = options.every((option) => {
			const valid = !option.primary;
			return valid;
		});
		const requiredProperties = options.every((option) => {
			const valid = option.dataKey && option.label && option.pluginID;
			if (!valid) {
				Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} must have dataKey, label, and pluginID.`);
			}
			return valid;
		});
		const noRegisteredDuplicates = options.every((option) => {
			const valid = !this._customColumns[option.dataKey] && !ITEMTREE_COLUMNS.find(col => col.dataKey === option.dataKey);
			if (!valid) {
				Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} with dataKey ${option.dataKey} already exists.`);
			}
			return valid;
		});
		return noInputDuplicates && noDeniedProperties && requiredProperties && noRegisteredDuplicates;
	}


	/**
	 * Add a new column or new columns.
	 * If the options is an array, all its children must be valid.
	 * Otherwise, no columns are added.
	 * @param {ItemTreeCustomColumnOptions | ItemTreeCustomColumnOptions[]} options - An option or array of options to add
	 * @returns {string | string[] | false} - The dataKey(s) of the added column(s) or false if no columns were added
	 */
	_addColumns(options) {
		const isSingle = !Array.isArray(options);
		if (isSingle) {
			options = [options];
		}
		options.forEach((o) => {
			o.dataKey = this._namespacedDataKey(o);
			o.enabledTreeIDs = o.enabledTreeIDs || ["main"];
			if (o.enabledTreeIDs.includes("*")) {
				o.enabledTreeIDs = ["*"];
			}
			o.showInColumnPicker = o.showInColumnPicker === undefined ? true : o.showInColumnPicker;
		});
		// If any check fails, return check results
		if (!this._validateColumnOption(options)) {
			return false;
		}
		for (const opt of options) {
			this._customColumns[opt.dataKey] = Object.assign({}, opt, { custom: true });
		}
		return isSingle ? options[0].dataKey : options.map(opt => opt.dataKey);
	}

	/**
	 * Remove a column option
	 * @param {string | string[]} dataKeys - The dataKey of the column to remove
	 * @returns {boolean} - True if column(s) were removed, false if not
	 */
	_removeColumns(dataKeys) {
		if (!Array.isArray(dataKeys)) {
			dataKeys = [dataKeys];
		}
		// If any check fails, return check results and do not remove any columns
		for (const key of dataKeys) {
			if (!this._customColumns[key]) {
				Zotero.warn(`ItemTree Column option with dataKey ${key} does not exist.`);
				return false;
			}
		}
		for (const key of dataKeys) {
			delete this._customColumns[key];
		}
		return true;
	}

	/**
	 * Make sure the dataKey is namespaced with the plugin ID
	 * @param {ItemTreeCustomColumnOptions} options
	 * @returns {string}
	 */
	_namespacedDataKey(options) {
		if (options.pluginID && options.dataKey) {
			// Make sure the return value is valid as class name or element id
			return `${options.pluginID}-${options.dataKey}`.replace(/[^a-zA-Z0-9-_]/g, "-");
		}
		return options.dataKey;
	}


	/**
	 * Reset the item trees to update the columns
	 */
	async _notifyItemTrees() {
		await Zotero.DB.executeTransaction(async function () {
			Zotero.Notifier.queue(
				'refresh',
				'itemtree',
				[],
				{},
			);
		});
	}

	/**
	 * Unregister all columns registered by a plugin
	 * @param {string} pluginID - Plugin ID
	 */
	async _unregisterColumnByPluginID(pluginID) {
		const columns = this.getCustomColumns(undefined, { pluginID });
		if (columns.length === 0) {
			return;
		}
		// Remove the columns one by one
		// This is to ensure that the columns are removed and not interrupted by any non-existing columns
		columns.forEach(column => this._removeColumns(column.dataKey));
		Zotero.debug(`ItemTree columns registered by plugin ${pluginID} unregistered due to shutdown`);
		await this._notifyItemTrees();
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
				this._unregisterColumnByPluginID(pluginID);
			}
		});
		this._observerAdded = true;
	}
}

Zotero.ItemTreeManager = new ItemTreeManager();
