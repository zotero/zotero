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

const { getColumns, addColumn, removeColumn, getDefaultColumnByDataKey } = require("zotero/itemTreeColumns");

/**
 * @typedef {import("../itemTreeColumns.jsx").ColumnOption} ItemTreeColumnOption
 */

class ItemTreeManager {
    _observerAdded = false;
    constructor() {
    }

    /** 
     * Register a custom column
     * @param {ItemTreeColumnOption} option
     * @async
     * @returns {void}
     * @throws {Error} If the column option is missing required properties
     * @throws {Error} If the column is already registered
     */
    async registerColumn(option) {
        if (option.pluginID) {
            Zotero.Plugins.registeredPlugins[option.pluginID].registerColumn(option);
        }
        addColumn(option);
        this._ensureObserverAdded();
        await this._refresh();
    }

    /**
     * Unregister a custom column
     * @param {string} dataKey - The dataKey of the column to unregister
     */
    async unregisterColumn(dataKey) {
        removeColumn(dataKey);
        await this._refresh();
    }

    // TODO: add cell renderer registration

    /**
     * Get all registered columns
     */
    get columns() {
        return getColumns();
    }

    /**
     * Get a column by dataKey
     * @param {string} dataKey 
     * @returns 
     */
    getColumn(dataKey) {
        return getDefaultColumnByDataKey(dataKey);
    }

    /**
     * Refresh the active item tree
     * @private
     */
    async _refresh() {
        const activeItemTree = Zotero.getActiveZoteroPane().itemsView;
        if (activeItemTree) {
            await activeItemTree._refresh();
        }
    }

    /**
     * Unregister all columns registered by a plugin
     * @param {string} pluginID 
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
        await this._refresh();
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
