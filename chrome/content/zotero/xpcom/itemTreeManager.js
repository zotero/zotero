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

const { getColumns, addColumn, removeColumn, getColumn } = require("zotero/itemTreeColumns");

/**
 * @typedef {import("../itemTreeColumns.jsx").ItemTreeColumnOption} ItemTreeColumnOption
 */

class ItemTreeManager {
    _observerAdded = false;
    constructor() {
    }

    /** 
     * Register a custom column. All registered columns must be valid, and must have a unique dataKey.
     * @param {ItemTreeColumnOption | ItemTreeColumnOption[]} option
     * @async
     * @returns {boolean} Although it's async, resolving does not promise the item trees are updated.
     * @throws {Error} If the column option is missing required properties
     * @throws {Error} If the column is already registered
     */
    async registerColumn(option) {
        const success = addColumn(option);
        if(!success) {
            return false;
        }
        this._ensureObserverAdded();
        await this._reset();
        return true;
    }

    /**
     * Unregister a custom column
     * @param {string} dataKey - The dataKey of the column to unregister
     * @async
     * @returns {boolean} Although it's async, resolving does not promise the item trees are updated.
     */
    async unregisterColumn(dataKey) {
        const success = removeColumn(dataKey);
        if(!success){
            return false;
        }
        await this._reset();
        return true;
    }

    // TODO: add cell renderer registration

    /**
     * Get all registered columns
     */
    get columns() {
        return getColumns();
    }

    /**
     * Get column(s) that matches the properties of option
     * @param {Partial.<ItemTreeColumnOption> | Partial.<ItemTreeColumnOption>[]} option - An option or array of options to match
     * @returns {ItemTreeColumnOption[]}
     */
    getColumn(option) {
        return getColumn(option);
    }

    /**
     * Refresh the active item tree
     * @private
     */
    async _reset() {
        // TODO: dispatch a notify to reset all item trees
        const activeItemTree = Zotero.getActiveZoteroPane().itemsView;
        if (activeItemTree) {
            await activeItemTree._resetColumns();
        }
    }

    /**
     * Unregister all columns registered by a plugin
     * @param {string} pluginID - Plugin ID
     */
    async _unregisterColumnByPluginID(pluginID) {
        const columns = this.columns;
        let removed = false;
        for (const column of columns) {
            if (column.pluginID === pluginID) {
                removeColumn(column.dataKey);
                removed = true;
            }
        }
        if (!removed) {
            return;
        }
        Zotero.debug(`ItemTree columns registered by plugin ${pluginID} unregistered due to shutdown`);
        await this._reset();
    }

    /**
     * Ensure that the observer is added
     * @returns {void}
     */
    _ensureObserverAdded() {
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
