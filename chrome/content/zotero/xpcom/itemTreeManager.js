/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Corporation for Digital Scholarship
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
 */

class ItemTreeManager {
	_observerAdded = false;
	/** @type {Record<string, ItemTreeColumnOptions}} */
	_customColumns = {};
	constructor() {
	}

	/** 
	 * Register a custom column. All registered columns must be valid, and must have a unique dataKey.
	 * Although it's async, resolving does not promise the item trees are updated.
	 * @param {ItemTreeColumnOptions | ItemTreeColumnOptions[]} options - An option or array of options to register
	 * @returns {string | string[] | false} - The dataKey(s) of the added column(s) or false if no columns were added
	 * @example
	 * A minimal custom column with icon:
	 * ```js
	 * // You can unregister the column later with Zotero.ItemTreeManager.unregisterColumns(registeredDataKey);
	 * const registeredDataKey = await Zotero.ItemTreeManager.registerColumns(
	 * {
	 *     dataKey: 'rtitle',
	 *     iconPath: 'chrome://zotero/skin/tick.png',
	 *     label: 'reversed title',
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
	 * await Zotero.ItemTreeManager.registerColumns(
	 * {
	 *     dataKey: 'rtitle',
	 *     label: 'reversed title',
	 *     enabledTreeIDs: ['main'], // only show in the main item tree
	 *     defaultSort: 1, // sort by increasing order
	 *     flex: 0, // don't take up all available space
	 *     width: 100, // assign fixed width in pixels
	 *     fixedWidth: true, // don't allow user to resize
	 *     staticWidth: true, // don't allow coloumn to be resized when the tree is resized
	 *     minWidth: 50, // minimum width in pixels
	 *     iconPath: 'chrome://zotero/skin/tick.png',
	 *     ignoreInColumnPicker: false, // show in the column picker
	 *     submenu: true, // show in the column picker submenu
	 *     primary: false, // only one primary column is allowed
	 *     pluginID: 'make-it-red@zotero.org', // plugin ID, which will be used to unregister the column when the plugin is unloaded
	 *     dataProvider: (item, dataKey) => {
	 *         // item: the current item in the row
	 *         // dataKey: the dataKey of the column
	 *         // return: the data to display in the column
	 *         return item.getField('title').split('').reverse().join('');
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
	 *          label: 'reversed title',
	 *          pluginID: 'make-it-red@zotero.org', // Replace with your plugin ID
	 *          dataProvider: (item, dataKey) => {
	 *              return item.getField('title').split('').reverse().join('');
	 *          },
	 *     },
	 *     {
	 *          dataKey: 'utitle',
	 *          iconPath: 'chrome://zotero/skin/cross.png',
	 *          label: 'uppercase title',
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
	 * ```js
	 * Zotero.ItemTreeManager.unregisterColumns('rtitle');
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

	// TODO: add cell renderer registration

	/**
	 * Get column(s) that matches the properties of option
	 * @param {undefined | Partial.<ItemTreeColumnOptions> | Partial.<ItemTreeColumnOptions>[]} options - An option or array of options to match
	 * @returns {ItemTreeColumnOptions[]}
	 */
	getCustomColumns(options) {
		const allColumns = this._getColumnsByType("custom");
		if (!options) {
			return allColumns;
		}
		if (!Array.isArray(options)) {
			options = [options];
		}
		options.forEach(o => o.dataKey = this._namespacedDataKey(o));
		/** @type {ItemTreeColumnOptions[]} */
		const matches = [];
		for (const opt of options) {
			const currentMatches = allColumns
				.filter(col =>
					// Aoid dataKey collision
					!matches.map(match => match.dataKey).includes(col.dataKey)
					// Match all properties
					&& Object.keys(opt).every(key => {
						// Ignore undefined properties
						if (opt[key] === undefined) {
							return true;
						}
						// Special case for enabledTreeIDs
						if (key === "enabledTreeIDs"){
							// If enabledTreeIDs is "*", match all tree IDs
							return opt.enabledTreeIDs.includes("*")
							// Otherwise, match the tree IDs
								|| opt.enabledTreeIDs.every(treeID => col.enabledTreeIDs.includes(treeID));
						}
						return col[key] === opt[key];
					})
				);
			matches.push(...currentMatches);
		}
		return matches;
	}

	/**
	 * Check if a column is registered as a custom column
	 * @param {string} dataKey 
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
	 * Get columns by type. Only support itemtree and custom for now.
	 * @param {"itemtree" | "custom" | "*"} type 
	 * @returns {ItemTreeColumnOptions[]}
	 */
	_getColumnsByType(type) {
		type = type || "itemtree";
		if (type === "*") {
			// Return all columns
			return ["itemtree", "custom"].flatMap(t => this._getColumnsByType(t));
		}
		if (type === "itemtree") {
			return ITEMTREE_COLUMNS.map(opt => Object.assign({}, opt));
		}
		if (type === "custom") {
			return Object.values(this._customColumns).map(opt => Object.assign({}, opt));
		}
	}

	/**
	 * Check if column options is valid.
	 * If the options is an array, all its children must be valid.
	 * Otherwise, the validation fails.
	 * @param {ItemTreeColumnOptions | ItemTreeColumnOptions[]} options 
	 * @returns {boolean} true if the option(s) are valid
	 */
	_validateColumnOption(options) {
		/**
		 * Validate column options.
		 * @param {ItemTreeColumnOptions | ItemTreeColumnOptions[]} options 
		 * @param {(option: ItemTreeColumnOptions) => boolean} validator - A function that returns true if the option is valid
		 * @returns {boolean} true if the option(s) are valid
		 */
		function validate(options, validator) {
			if (Array.isArray(options)) {
				return options.every(opt => validator(opt));
			}
			return validator(options);
		}

		// Check if the input option has duplicate dataKeys
		const noInputDuplicates = !Array.isArray(options) || !options.find((opt, i, arr) => arr.findIndex(o => o.dataKey === opt.dataKey) !== i);
		if (!noInputDuplicates) {
			Zotero.warn(`ItemTree Column options have duplicate dataKey.`);
		}
		const requiredProperties = validate(options, (option) => {
			const valid = option.dataKey && option.label;
			if (!valid) {
				Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} must have dataKey and label.`);
			}
			return valid;
		});
		const noRegisteredDuplicates = validate(options, (option) => {
			const valid = !this._getColumnsByType("*").find(col => col.dataKey === option.dataKey);
			if (!valid) {
				Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} with dataKey ${option.dataKey} already exists.`);
			}
			return valid;
		});
		return noInputDuplicates && requiredProperties && noRegisteredDuplicates;
	}


	/**
	 * Add a new column or new columns.
	 * If the options is an array, all its children must be valid.
	 * Otherwise, no columns are added.
	 * @param {ItemTreeColumnOptions | ItemTreeColumnOptions[]} options - An option or array of options to add
	 * @returns {string | string[] | false} - The dataKey(s) of the added column(s) or false if no columns were added
	 */
	_addColumns(options) {
		const isSingle = !Array.isArray(options);
		if (isSingle) {
			options = [options];
		}
		options.forEach(o => o.dataKey = this._namespacedDataKey(o));
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
	 * @param {string | string[]} dataKeys 
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
	 * @param {ItemTreeColumnOptions} options
	 * @returns {string}
	 */
	_namespacedDataKey(options) {
		if (options.pluginID && options.dataKey) {
			return `${options.pluginID}-${options.dataKey}`;
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
		const columns = this.getCustomColumns({ pluginID });
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
