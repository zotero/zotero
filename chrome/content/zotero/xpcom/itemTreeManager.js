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

const { DEFAULT_COLUMNS } = require("zotero/itemTreeColumns");

/**
 * @typedef {import("../itemTreeColumns.jsx").ItemTreeColumnOption} ItemTreeColumnOption
 */

class ItemTreeManager {
    _observerAdded = false;
    /** @type {ItemTreeColumnOption[]} */
    _customColumns = [];
    constructor() {
    }

    /** 
     * Register a custom column. All registered columns must be valid, and must have a unique dataKey.
     * @param {ItemTreeColumnOption | ItemTreeColumnOption[]} optionOrOptions
     * @returns {boolean} Although it's async, resolving does not promise the item trees are updated.
     */
    async registerColumns(optionOrOptions) {
        const success = this._addColumn(optionOrOptions);
        if (!success) {
            return false;
        }
        this._addPluginShutdownObserver();
        await this._notifyItemTrees();
        return true;
    }

    /**
     * Unregister a custom column
     * @param {string | string[]} dataKeyOrDataKeys - The dataKey of the column to unregister
     * @returns {boolean} Although it's async, resolving does not promise the item trees are updated.
     */
    async unregisterColumns(dataKeyOrDataKeys) {
        const success = this._removeColumn(dataKeyOrDataKeys);
        if (!success) {
            return false;
        }
        await this._notifyItemTrees();
        return true;
    }

    // TODO: add cell renderer registration

    /**
     * Get column(s) that matches the properties of option
     * @param {undefined | Partial.<ItemTreeColumnOption> | Partial.<ItemTreeColumnOption>[]} optionOrOptions - An option or array of options to match
     * @returns {ItemTreeColumnOption[]}
     */
    getColumns(optionOrOptions) {
        if (!optionOrOptions) {
            return this._getAllColumns();
        }
        if (Array.isArray(optionOrOptions)) {
            const matches = optionOrOptions.map(opt => this.getColumns(opt));
            return matches.reduce((acc, match) => acc.concat(match), []);
        }
        return this._getAllColumns().filter(col => Object.keys(optionOrOptions).every(key => col[key] === optionOrOptions[key]));
    }

    /**
     * Get all registered columns
     */
    _getAllColumns() {
        return [...DEFAULT_COLUMNS, ...this._customColumns];
    }

    /**
     * Check if column option is valid atomically
     * @param {ItemTreeColumnOption | ItemTreeColumnOption[]} optionOrOptions 
     * @returns {boolean}
     */
    _validateColumnOption(optionOrOptions) {
        /**
         * Validate column option atomically
         * @param {ItemTreeColumnOption | ItemTreeColumnOption[]} optionOrOptions 
         * @param {(option: ItemTreeColumnOption) => boolean} validator - A function that returns true if the option is valid
         * @returns {boolean}
         */
        function validate(optionOrOptions, validator) {
            if (Array.isArray(optionOrOptions)) {
                return optionOrOptions.every(opt => validator(opt));
            }
            return validator(optionOrOptions);
        }

        // Check if the input option has duplicate dataKeys
        const noInputDuplicates = !Array.isArray(optionOrOptions) || !optionOrOptions.find((opt, i, arr) => arr.findIndex(o => o.dataKey === opt.dataKey) !== i);
        if (!noInputDuplicates) {
            Zotero.warn(`ItemTree Column options have duplicate dataKey.`);
        }
        const requiredProperties = validate(optionOrOptions, (option) => {
            const valid = option.dataKey && option.label;
            if (!valid) {
                Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} must have dataKey and label.`);
            }
            return valid;
        });
        const noRegisteredDuplicates = validate(optionOrOptions, (option) => {
            const valid = this.getColumns({ dataKey: option.dataKey }).length === 0;
            if (!valid) {
                Zotero.warn(`ItemTree Column option ${JSON.stringify(option)} with dataKey ${option.dataKey} already exists.`);
            }
            return valid;
        });
        return noInputDuplicates && requiredProperties && noRegisteredDuplicates;
    }


    /**
     * Add a new column or new columns atomically. All options must be valid.
     * Only if all options are valid will the columns be added.
     * @param {ItemTreeColumnOption | ItemTreeColumnOption[]} optionOrOptions - An option or array of options to add
     * @returns {boolean} - True if column(s) were added, false if not
     */
    _addColumn(optionOrOptions) {
        // If any check fails, return check results
        if (!this._validateColumnOption(optionOrOptions)) {
            return false;
        }
        if (Array.isArray(optionOrOptions)) {
            optionOrOptions.forEach(opt => this._addColumn(opt));
            return true;
        }
        this._customColumns.push(Object.assign({}, optionOrOptions, { custom: true }));
        return true;
    }

    /**
     * Remove a column option
     * @param {string | string[]} dataKeyOrDataKeys 
     * @returns {boolean | boolean[]}
     */
    _removeColumn(dataKeyOrDataKeys) {
        if (Array.isArray(dataKeyOrDataKeys)) {
            return dataKeyOrDataKeys.map(key => this._removeColumn(key));
        }
        const index = this._customColumns.findIndex(column => column.dataKey == dataKeyOrDataKeys);
        if (index > -1) {
            this._customColumns.splice(index, 1);
            return true;
        }
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
        const columns = this._getAllColumns();
        let removed = false;
        for (const column of columns) {
            if (column.pluginID === pluginID) {
                this._removeColumn(column.dataKey);
                removed = true;
            }
        }
        if (!removed) {
            return;
        }
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
