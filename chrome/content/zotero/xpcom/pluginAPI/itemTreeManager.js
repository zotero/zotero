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


import { COLUMNS } from 'zotero/itemTreeColumns';


{
	const PluginAPIBase = ChromeUtils.importESModule("chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs").PluginAPIBase;


	/**
	 * @namespace Zotero
	 */


	/**
	 * @typedef {function} ItemTreeColumnDataProvider
	 * @param {Zotero.Item} item - The item to get data from
	 * @param {string} dataKey - The dataKey of the column
	 * @returns {string} - The data to display in the column
	 */

	/**
	 * @typedef {function} ItemTreeColumnRenderCell
	 * @param {number} index - The index of the row
	 * @param {string} data - The data to display in the column
	 * @param {ItemTreeColumnOptions | {className: string}} column - The column options
	 * @param {boolean} isFirstColumn - true if this is the first column
	 * @param {Document} doc - The document of the item tree
	 * @returns {HTMLElement} - The HTML to display in the cell
	 */


	class ItemTreeColumnManagerInternal extends PluginAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ItemTreeColumnManager",
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
						fallbackReturn: "",
					},
					renderCell: {
						type: "function",
						optional: true,
						fallbackReturn: null,
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
			return super._add(option);
		}

		_validate(option) {
			let mainKey = this._namespacedMainKey(option);

			if (COLUMNS.find(col => col.dataKey === mainKey)) {
				this._log(`'${mainKey}' already exists as a built-in column`, "warn");
				return false;
			}

			return super._validate(option);
		}

		refresh() {
			this._refresh();
		}
	}


	/**
	 * @memberof Zotero
	 */
	Zotero.ItemTreeManager = {
		_columnManager: new ItemTreeColumnManagerInternal(),

		/**
		 * Register a custom column, must be valid with a unique dataKey.
		 *
		 * Note that the `dataKey` you use here may be different from the one returned by the function.
		 * This is because the `dataKey` is prefixed with the `pluginID` to avoid conflicts after the column is registered.
		 * @param {Object} option - An option or array of options to register
		 * @param {string} option.dataKey - Required, see use in ItemTree#_getRowData()
		 * @param {string} option.label - The column label. Either a string or the id to an i18n string.
		 * @param {string} option.pluginID - Set plugin ID to auto remove column when plugin is removed.
		 * @param {string[]} [option.enabledTreeIDs=[]] - Which tree ids the column should be enabled in. If undefined, enabled in main tree. If ["*"], enabled in all trees.
		 * @param {string[]} [option.defaultIn] - Will be deprecated. Types of trees the column is default in. Can be [default, feed];
		 * @param {string[]} [option.disabledIn] - Will be deprecated. Types of trees where the column is not available
		 * @param {boolean} [option.sortReverse=false] - Default: false. Set to true to reverse the sort order
		 * @param {number} [option.flex=1] - Default: 1. When the column is added to the tree how much space it should occupy as a flex ratio
		 * @param {string} [option.width] - A column width instead of flex ratio. See above.
		 * @param {boolean} [option.fixedWidth] - Default: false. Set to true to disable column resizing
		 * @param {boolean} [option.staticWidth] - Default: false. Set to true to prevent columns from changing width when the width of the tree increases or decreases
		 * @param {boolean} [option.noPadding] - Set to true for columns with padding disabled in stylesheet
		 * @param {number} [option.minWidth] - Override the default [20px] column min-width for resizing
		 * @param {React.Component} [option.iconLabel] - Set an Icon label instead of a text-based one
		 * @param {string} [option.iconPath] - Set an Icon path, overrides {iconLabel}
		 * @param {string | React.Component} [option.htmlLabel] - Set an HTML label, overrides {iconLabel} and {label}. Can be a HTML string or a React component.
		 * @param {boolean} [option.showInColumnPicker=true] - Default: true. Set to true to show in column picker.
		 * @param {boolean} [option.columnPickerSubMenu=false] - Default: false. Set to true to display the column in "More Columns" submenu of column picker.
		 * @param {boolean} [option.primary] - Should only be one column at the time. Title is the primary column
		 * @param {ItemTreeColumnDataProvider} [option.dataProvider] - Custom data provider that is called when rendering cells
		 * @param {ItemTreeColumnRenderCell} [option.renderCell] - The cell renderer function
		 * @param {string[]} [option.zoteroPersist] - Which column properties should be persisted between zotero close
		 * @returns {string | false} - The dataKey of the added column or false if no column is added
		 */
		registerColumn(option) {
			return this._columnManager.register(option);
		},

		/**
		 * @deprecated Use `registerColumn` instead.
		 */
		registerColumns(options) {
			if (!Array.isArray(options)) {
				options = [options];
			}
			return options.map(option => this.registerColumn(option));
		},

		/**
		 * Unregister a custom column.
		 * @param {string} dataKey - The dataKey of the column to unregister
		 * @returns {boolean} - true if the column was unregistered, false if the column was not found
		 */
		unregisterColumn(dataKey) {
			return this._columnManager.unregister(dataKey);
		},

		/**
		 * @deprecated Use `unregisterColumn` instead.
		 */
		unregisterColumns(dataKeys) {
			if (!Array.isArray(dataKeys)) {
				dataKeys = [dataKeys];
			}
			return dataKeys.map(dataKey => this.unregisterColumn(dataKey));
		},

		/**
		 * Refresh the columns in the item tree
		 * @returns {void}
		 */
		refreshColumns() {
			this._columnManager.refresh();
		},

		get customColumnUpdateID() {
			return this._columnManager.updateID;
		},

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
		},

		isCustomColumn(dataKey) {
			return !!this._columnManager._optionsCache[dataKey];
		},

		getCustomCellData(item, dataKey) {
			const option = this._columnManager._optionsCache[dataKey];
			if (option && option.dataProvider) {
				return option.dataProvider(item, dataKey);
			}
			return "";
		},
	};
}
