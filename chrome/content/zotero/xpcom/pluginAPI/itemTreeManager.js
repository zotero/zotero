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
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		ManagerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/managerAPIBase.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginProtocol: "chrome://zotero/content/xpcom/plugins/protocol.mjs",
	});

	/**
	 * The resolved URL is shown via <img>, where SVG-as-image mode blocks
	 * scripts and external loads.
	 *
	 * @param {string} pluginID
	 * @param {string} url - data:image/svg+xml URL, or an .svg URL optionally
	 * 		relative to the plugin's root
	 * @returns {string | null} Null if the value isn't an accepted SVG URL
	 */
	function resolveSVGImageURL(pluginID, url) {
		if (typeof url !== "string") {
			return null;
		}
		let parsed = URL.parse(url);
		if (parsed?.protocol === "data:") {
			return /^image\/svg\+xml[;,]/i.test(parsed.pathname) ? url : null;
		}
		return lazy.PluginProtocol.resolveFile(pluginID, url, [".svg"]);
	}


	/**
	 * @namespace Zotero
	 */


	/**
	 * @typedef {object} ItemTreeColumnContext
	 * @property {number} itemID - The row's item
	 * @property {SyncItemGetter} getItem - A cell answers synchronously, so this is how a column reads data
	 */

	/**
	 * @typedef {function} ItemTreeColumnDataProvider
	 * @param {Zotero.Item | ItemTreeColumnContext} item - An `ItemTreeColumnContext` for unprivileged
	 * 		plugins. The live item privileged plugins get is @deprecated
	 * @param {string} dataKey - The dataKey of the column
	 * @param {ItemTreeColumnContext} context - The same context, passed to every plugin
	 * @returns {string} - The data to display in the column
	 */

	/**
	 * @typedef {function} ItemTreeColumnRenderCell
	 * @param {number} index - The index of the row
	 * @param {string} data - The data to display in the column
	 * @param {ItemTreeColumnOptions | {className: string}} column - The column options
	 * @param {boolean} isFirstColumn - true if this is the first column
	 * @param {Document} doc - The document of the item tree. Not passed to unprivileged plugins,
	 * 		whose renderCell returns an SVG URL instead of an element
	 * @returns {HTMLElement | string} - The cell element, or for unprivileged plugins an SVG URL
	 * 		(a `data:image/svg+xml` URL or a plugin .svg URL) shown as an image filling the
	 * 		cell. Size via the root <svg>: width/height for a fixed size, only a viewBox to
	 * 		scale to the cell, neither to stretch to it. Anything else falls back to the
	 * 		plain cell data.
	 */


	class ItemTreeColumnManagerInternal extends lazy.ManagerAPIBase {
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

		_convert(option) {
			option = super._convert(option);

			option.enabledTreeIDs = option.enabledTreeIDs || ["main"];
			if (option.enabledTreeIDs.includes("*")) {
				option.enabledTreeIDs = ["*"];
			}
			option.showInColumnPicker = option.showInColumnPicker === undefined ? true : option.showInColumnPicker;

			// Unprivileged plugins can't build free-form markup or DOM.
			// htmlLabel and renderCell content is an SVG URL shown as
			// an image (see resolveSVGImageURL)
			let unprivileged = !lazy.PluginSandbox.isPrivileged(option.pluginID);
			if (unprivileged && option.htmlLabel !== undefined) {
				let imageURL = resolveSVGImageURL(option.pluginID, option.htmlLabel);
				if (imageURL) {
					// Marker object rendered as <img> by virtualized-table
					option.htmlLabel = { svgSrc: imageURL };
				}
				else {
					this._log("'htmlLabel' must be a data:image/svg+xml URL or a plugin .svg URL for unprivileged plugins", "warn");
					delete option.htmlLabel;
				}
			}

			if (unprivileged && option.renderCell) {
				// The plugin returns an SVG URL; the cell is built chrome-side
				let getSVG = lazy.ScopeVariables.fromScope(option.renderCell, option.pluginID);
				let pluginID = option.pluginID;
				option.renderCell = function (index, data, column, isFirstColumn, doc) {
					let cell = doc.createElement("span");
					cell.className = `cell ${column.className}`;
					let imageURL = resolveSVGImageURL(pluginID, getSVG(index, data, column, isFirstColumn));
					if (imageURL) {
						let img = doc.createElement("img");
						img.className = "cell-svg";
						img.src = imageURL;
						img.alt = data === undefined || data === null ? "" : String(data);
						cell.appendChild(img);
					}
					else if (data !== undefined && data !== null) {
						cell.textContent = data;
					}
					return cell;
				};
			}

			if (option.dataProvider) {
				let provider = lazy.ScopeVariables.fromScope(option.dataProvider, option.pluginID);
				let pluginID = option.pluginID;
				// A cell answers synchronously, so `getItem` replaces the live item, and rides along as the
				// third argument since a privileged plugin's first stays the live item
				provider = ((wrapped, item, dataKey) => {
					let context = {
						itemID: item.id,
						getItem: Zotero.DataStore.itemGetter(item.id, pluginID),
					};
					try {
						return wrapped(unprivileged ? context : item, dataKey, context);
					}
					finally {
						context.getItem.expire?.();
					}
				}).bind(null, provider);
				option.dataProvider = provider;
			}
			return option;
		}

		_validate(option) {
			let mainKey = this._namespacedMainKey(option);

			if (COLUMNS.find(col => col.dataKey === mainKey)) {
				this._log(`'${mainKey}' already exists as a built-in column`, "warn");
				return false;
			}

			option = super._validate(option);
			if (!option || !this._resolveImageURLs(option, ["iconPath"], option.pluginID)) {
				return false;
			}
			return option;
		}

		refresh() {
			this._refresh();
		}
	}


	/**
	 * Manages item tree APIs.
	 *
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
		 * @param {string} [option.iconPath] - Set an Icon path, optionally relative to the plugin root, overrides {iconLabel}
		 * @param {string | React.Component} [option.htmlLabel] - Set an HTML label,
		 * 		overrides {iconLabel} and {label}. Can be a HTML string or a React component for
		 * 		privileged plugins; unprivileged plugins must pass a `data:image/svg+xml` URL or
		 * 		the URL of an .svg file within the plugin, shown as an image. Unlike renderCell,
		 * 		header images render at their intrinsic size, so declare width/height on the
		 * 		root <svg>.
		 * @param {boolean} [option.showInColumnPicker=true] - Default: true. Set to true to show in column picker.
		 * @param {boolean} [option.columnPickerSubMenu=false] - Default: false. Set to true to display the column in "More Columns" submenu of column picker.
		 * @param {boolean} [option.primary] - Should only be one column at the time. Title is the primary column
		 * @param {ItemTreeColumnDataProvider} [option.dataProvider] - Custom data provider that is called when rendering cells
		 * @param {ItemTreeColumnRenderCell} [option.renderCell] - The cell renderer function
		 * @param {string[]} [option.zoteroPersist] - Which column properties should be persisted between zotero close
		 * @returns {string | false} - The dataKey of the added column or false if no column is added
		 *
		 * @example
		 * A minimal custom column:
		 * ```javascript
		 * // You can unregister the column later with Zotero.ItemTreeManager.unregisterColumn(registeredDataKey);
		 * const registeredDataKey = Zotero.ItemTreeManager.registerColumn(
		 * {
		 *     dataKey: 'rtitle',
		 *     label: 'Reversed Title',
		 *     pluginID: 'my-plugin@my-namespace.com', // Replace with your plugin ID
		 *     dataProvider: (item, dataKey) => {
		 *         return item.getField('title').split('').reverse().join('');
		 *     },
		 * });
		 * ```
		 * @example
		 * A custom column using all available options.
		 * Note that the column will only be shown in the main item tree.
		 * ```javascript
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
		 *     pluginID: 'my-plugin@my-namespace.com', // plugin ID
		 *     dataProvider: (item, dataKey) => {
		 *         // item: the current item in the row
		 *         // dataKey: the dataKey of the column
		 *         // return: the data to display in the column
		 *         return item.getField('title').split('').reverse().join('');
		 *     },
		 *     renderCell: (index, data, column, isFirstColumn, doc) => {
		 *         // index: the index of the row
		 *         // data: the data to display in the column, return of `dataProvider`
		 *         // column: the column options
		 *         // isFirstColumn: true if this is the first column
		 *         // doc: the document of the item tree
		 *         // return: the HTML to display in the cell
		 *         const cell = doc.createElement('span');
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
		},

		/**
		 * Unregister a custom column.
		 * @param {string} dataKey - The dataKey of the column to unregister
		 * @returns {boolean} - true if the column was unregistered, false if the column was not found
		 */
		unregisterColumn(dataKey, _callerPluginID) {
			return this._columnManager.unregister(dataKey, _callerPluginID);
		},

		/**
		 * Refresh the columns in the item tree, re-running every `dataProvider`. A column shows a value
		 * `dataProvider` can't compute synchronously by caching the async result and then refreshing
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
				// A throwing provider must not take the tree down with it
				try {
					return option.dataProvider(item, dataKey);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			return "";
		},
	};
	lazy.ScopeVariables.setCustomParser(
		Zotero.ItemTreeManager.registerColumn,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.ItemTreeManager.unregisterColumn,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
