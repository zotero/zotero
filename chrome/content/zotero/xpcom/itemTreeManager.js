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


var PluginAPIBase;
if (typeof PluginAPIBase === "undefined") {
	PluginAPIBase = ChromeUtils.importESModule("chrome://zotero/content/modules/pluginAPIBase.mjs").PluginAPIBase;
}


const { COLUMNS: ITEMTREE_COLUMNS } = require("zotero/itemTreeColumns");


/**
 * @typedef {import("../itemTreeColumns.jsx").ItemTreeColumnOptions} ItemTreeColumnOptions
 * @typedef {"dataKey" | "label" | "pluginID"} RequiredCustomColumnOptionKeys
 * @typedef {Required<Pick<ItemTreeColumnOptions, RequiredCustomColumnOptionKeys>>} RequiredCustomColumnOptionsPartial
 * @typedef {Omit<ItemTreeColumnOptions, RequiredCustomColumnOptionKeys>} CustomColumnOptionsPartial
 * @typedef {RequiredCustomColumnOptionsPartial & CustomColumnOptionsPartial} ItemTreeCustomColumnOptions
 * @typedef {Partial<Omit<ItemTreeCustomColumnOptions, "enabledTreeIDs">>} ItemTreeCustomColumnFilters
 */


class ItemTreeColumnManagerIntl extends PluginAPIBase {
	constructor() {
		super();
		this.config = {
			APIName: "ItemTreeColumnManager",
			mainKeyName: "dataKey",
			notifyType: "itemtree",
			optionTypeDefinition: {
				dataKey: "string",
				label: "string",
				pluginID: "string",
				enabledTreeIDs: {
					type: "array",
					optional: true,
				},
				defaultIn: {
					type: "array",
					optional: true,
					checkHook: (_value) => {
						this._log("The 'defaultIn' property is deprecated. Use 'enabledTreeIDs' instead.", "warn");
						return true;
					}
				},
				disableIn: {
					type: "array",
					optional: true,
					checkHook: (_value) => {
						this._log("The 'disableIn' property is deprecated. Use 'enabledTreeIDs' instead.", "warn");
						return true;
					}
				},
				sortReverse: {
					type: "boolean",
					optional: true,
				},
				flex: {
					type: "number",
					optional: true,
				},
				width: {
					type: "string",
					optional: true,
				},
				fixedWidth: {
					type: "boolean",
					optional: true,
				},
				staticWidth: {
					type: "boolean",
					optional: true,
				},
				noPadding: {
					type: "boolean",
					optional: true,
				},
				minWidth: {
					type: "number",
					optional: true,
				},
				iconLabel: {
					type: "object",
					optional: true,
				},
				iconPath: {
					type: "string",
					optional: true,
				},
				htmlLabel: {
					type: "any",
					optional: true,
				},
				showInColumnPicker: {
					type: "boolean",
					optional: true,
				},
				columnPickerSubMenu: {
					type: "boolean",
					optional: true,
				},
				dataProvider: {
					type: "function",
					optional: true,
				},
				renderCell: {
					type: "function",
					optional: true,
				},
				zoteroPersist: {
					type: "array",
					optional: true,
				},
			},
		};
	}

	_add(option) {
		option = Object.assign({}, option);
		option.enabledTreeIDs = option.enabledTreeIDs || ["main"];
		if (option.enabledTreeIDs.includes("*")) {
			option.enabledTreeIDs = ["*"];
		}
		option.showInColumnPicker = option.showInColumnPicker === undefined ? true : option.showInColumnPicker;
		option.custom = true;
		return super._add(option);
	}

	_validate(option) {
		let mainKey = this._getOptionMainKey(option);

		if (ITEMTREE_COLUMNS.find(col => col.dataKey === mainKey)) {
			this._log(`'${mainKey}' already exists as a built-in column`, "warn");
			return false;
		}

		return super._validate(option);
	}
}


class ItemTreeManager {
	_columnManager = new ItemTreeColumnManagerIntl();

	/**
	 * Register a custom column, must be valid with a unique dataKey.
	 *
	 * Note that the `dataKey` you use here may be different from the one returned by the function.
	 * This is because the `dataKey` is prefixed with the `pluginID` to avoid conflicts after the column is registered.
	 * @param {ItemTreeCustomColumnOptions} option - An option or array of options to register
	 * @returns {string | false} - The dataKey of the added column or false if no column is added
	 * @example
	 * A minimal custom column:
	 * ```js
	 * // You can unregister the column later with Zotero.ItemTreeManager.unregisterColumn(registeredDataKey);
	 * const registeredDataKey = Zotero.ItemTreeManager.registerColumn(
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
	 * const registeredDataKey = Zotero.ItemTreeManager.registerColumn(
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
	 */
	registerColumn(option) {
		return this._columnManager.register(option);
	}

	/**
	 * @deprecated Use `registerColumn` instead.
	 */
	registerColumns(options) {
		if (!Array.isArray(options)) {
			options = [options];
		}
		return options.map(option => this.registerColumn(option));
	}

	/**
	 * Unregister a custom column.
	 * @param {string} dataKey - The dataKey of the column to unregister
	 * @returns {boolean} true if the column is unregistered
	 * @example
	 * The `registeredDataKey` is returned by the `registerColumn` function.
	 * ```js
	 * Zotero.ItemTreeManager.unregisterColumn(registeredDataKey);
	 * ```
	 */
	unregisterColumn(dataKey) {
		return this._columnManager.unregister(dataKey);
	}

	/**
	 * @deprecated Use `unregisterColumn` instead.
	 */
	unregisterColumns(dataKeys) {
		if (!Array.isArray(dataKeys)) {
			dataKeys = [dataKeys];
		}
		return dataKeys.map(dataKey => this.unregisterColumn(dataKey));
	}

	get customColumnUpdateTime() {
		return this._columnManager.updateTime;
	}

	/**
	 * Get column(s) that matches the properties of option
	 * @param {string | string[]} [filterTreeIDs] - The tree IDs to match
	 * @param {ItemTreeCustomColumnFilters} [options] - An option or array of options to match
	 * @returns {ItemTreeCustomColumnOptions[]}
	 */
	getCustomColumns(filterTreeIDs, options) {
		const allColumns = this._columnManager.options;
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
		return !!this._columnManager._optionsCache[dataKey];
	}

	/**
	 * A centralized data source for custom columns. This is used by the ItemTreeRow to get data.
	 * @param {Zotero.Item} item - The item to get data from
	 * @param {string} dataKey - The dataKey of the column
	 * @returns {string}
	 */
	getCustomCellData(item, dataKey) {
		const option = this._columnManager._optionsCache[dataKey];
		if (option && option.dataProvider) {
			return option.dataProvider(item, dataKey);
		}
		return "";
	}
}


Zotero.ItemTreeManager = new ItemTreeManager();
