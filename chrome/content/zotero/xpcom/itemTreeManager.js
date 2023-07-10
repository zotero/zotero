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
	/** @type {ItemTreeColumnOptions[]} */
	_customColumns = [];
	/** 
	 * Cached custom columns' data source
	 * @type {(item: Zotero.Item, dataKey: string) => string}
	 */
	_customDataProvider = {};
	constructor() {
	}

	/** 
	 * Register a custom column. All registered columns must be valid, and must have a unique dataKey.
	 * Although it's async, resolving does not promise the item trees are updated.
	 * @param {ItemTreeColumnOptions | ItemTreeColumnOptions[]} options - An option or array of options to register
	 * @returns {boolean} true if the column(s) are registered
	 * @example
	 * A minimal custom column with icon:
	 * ```js
	 * Zotero.ItemTreeManager.registerColumns(
	 * {
	 *     dataKey: 'rtitle',
	 *     iconPath: 'chrome://zotero/skin/tick.png',
	 *     label: 'reversed title',
	 *     dataProvider: (item, dataKey) => {
	 *         return item.getField('title').split('').reverse().join('');
	 *     },
	 * });
	 * ```
	 * @example
	 * A custom column using all available options.
	 * Note that the column will only be shown in the main item tree.
	 * ```js
	 * Zotero.ItemTreeManager.registerColumns(
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
	 *     pluginID: 'my-plugin', // plugin ID, which will be used to unregister the column when the plugin is unloaded
	 *     dataProvider: (item, dataKey) => {
	 *         // item: the current item in the row
	 *         // dataKey: the dataKey of the column
	 *         // return: the data to display in the column
	 *         return item.getField('title').split('').reverse().join('');
	 *     },
	 *     zoteroPersist: ['width', 'hidden', 'sortDirection'], // persist the column properties
	 * });
	 * ```
	 */
	async registerColumns(options) {
		const success = this._addColumns(options);
		if (!success) {
			return false;
		}
		this._addPluginShutdownObserver();
		await this._notifyItemTrees();
		return true;
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
	 * @param {string[]} [types=["custom", "itemtree"]] - An array of column source type to include
	 * @returns {ItemTreeColumnOptions[]}
	 */
	getColumns(options, types) {
		types = types || ["custom", "itemtree"]
		const allColumns = types.reduce((acc, type) => acc.concat(this._getColumnsByType(type)), []);
		if (!options) {
			return allColumns;
		}
		if (Array.isArray(options)) {
			const matches = options.map(opt => this.getColumns(opt));
			return matches.reduce((acc, match) => acc.concat(match), []);
		}
		return allColumns.filter(col => Object.keys(options).every(key => col[key] === options[key]));
	}

	/**
	 * A centralized data source for custom columns. This is used by the ItemTreeRow to get data.
	 * @param {Zotero.Item} item 
	 * @param {string} field 
	 * @param {boolean} unformatted 
	 * @returns {string}
	 */
	getCustomCellData(item, field, unformatted) {
		if (this._customDataProvider[field]) {
			return this._customDataProvider[field](item, field, unformatted);
		}
		return "";
	}

	/**
	 * Get columns by type. Only support itemtree and custom for now.
	 * @param {"itemtree" | "custom"} type 
	 * @returns {ItemTreeColumnOptions[]}
	 */
	_getColumnsByType(type) {
		type = type || "itemtree";
		if (type === "itemtree") {
			return [...ITEMTREE_COLUMNS];
		}
		if (type === "custom") {
			return [...this._customColumns];
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
			const valid = this.getColumns({ dataKey: option.dataKey }).length === 0;
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
	 * @param {boolean} [skipValidate=false] - Whether to validate the option(s) before adding 
	 * @returns {boolean} - True if column(s) were added, false if not
	 */
	_addColumns(options, skipValidate) {
		// If any check fails, return check results
		if (!skipValidate && !this._validateColumnOption(options)) {
			return false;
		}
		if (Array.isArray(options)) {
			// Validating options as an array is more efficient, so we skip validation for each option
			// and only validate the array once
			options.forEach(opt => this._addColumns(opt, true));
			return true;
		}
		this._customColumns.push(Object.assign({}, options, { custom: true }));
		if (options.dataProvider) {
			this._customDataProvider[options.dataKey] = options.dataProvider;
		}
		return true;
	}

	/**
	 * Remove a column option
	 * @param {string | string[]} dataKeys 
	 * @returns {boolean | boolean[]}
	 */
	_removeColumns(dataKeys) {
		if (Array.isArray(dataKeys)) {
			return dataKeys.map(key => this._removeColumns(key));
		}
		const index = this._customColumns.findIndex(column => column.dataKey == dataKeys);
		if (index > -1) {
			this._customColumns.splice(index, 1);
			return true;
		}
		delete this._customDataProvider[dataKeys.dataKey];
		return false;
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
		const columns = this.getColumns({ pluginID }, ["custom"]);
		if (columns.length === 0) {
			return;
		}
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
