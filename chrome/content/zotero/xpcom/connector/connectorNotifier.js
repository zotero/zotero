/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2017 Center for History and New Media
					George Mason University, Fairfax, Virginia, USA
					http://zotero.org
	
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
 * Orchestrates observers for various events relevant to the connector
 * Subscribes to Zotero.Notifier for certain events and provides an API
 * to send custom events to connectors
 *
 * Intended to notify an SSE listener service and later a websocket listener service
 */
Zotero.ConnectorNotifier = {
	_listeners: [],
	_notifierID: null,

	init: function () {
		this._notifierID = Zotero.Notifier.registerObserver(this, ['collectionTreeRow', 'item', 'translators'], 'Connector Notifier')
	},
	
	notify: function (event, targetType, ids, extraData) {
		if (event === 'select') {
			switch (targetType) {
				case 'item':
					this._notifySelectItem(ids);
					break;
				case 'collectionTreeRow':
					this._notifySelectCollection(ids);
					break;
			}
		}
		if (event === 'modify' && targetType === 'translators') {
			this.notifyListeners('translators', null);
		}
	},
	
	_notifySelectItem: function () {
		this.notifyListeners('select', this._getSelectedItemData());
	},
	
	_notifySelectCollection: function () {
		this.notifyListeners('select', this._getSelectedCollectionData());
	},
	
	notifyListeners: function (event, data) {
		this._listeners.forEach(function (listener) {
			listener.notify(event, data);
		});
	},

	addListener: function (listener) {
		this._listeners.push(listener);
		Zotero.debug(`ConnectorNotifier listener added. Total: ${this._listeners.length}`);
	},
	
	removeListener: function (listener) {
		this._listeners = this._listeners.filter(l => l !== listener);
		Zotero.debug(`ConnectorNotifier listener removed. Total: ${this._listeners.length}`);
	},
	
	_getSelectedCollectionData: function () {
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget(true);
		var data = {};
		if (collection) {
			data = { collection: { id: collection.id, name: collection.name },
				id: collection.id, name: collection.name };
		}
		else {
			data = { collection: { id: null, name: library.name },
				id: library.libraryId, name: library.name };
		}
		data.library = {
			name: library.name,
			id: library.libraryID,
			editable: editable,
			filesEditable: library.filesEditable
		};
		return data;
	},
	
	_getSelectedItemData: function () {
		var zp = Zotero.getActiveZoteroPane();
		if (!zp) return;
		return { items: zp.getSelectedItems().map(i => ({
			itemID: i.itemID,
			title: i.getDisplayTitle(),
			type: Zotero.ItemTypes.getName(i.itemTypeID)
		})) };
	},
	
	getInitData: async function () {
		return {
			selected: Object.assign(this._getSelectedCollectionData(), this._getSelectedItemData()),
			proxies: {
				proxies: Zotero.Proxies.proxies.map(p => Object.assign(p.toJSON(), { hosts: p.hosts })),
				dateModified: Zotero.Prefs.get('proxies.dateModified') * 1000
			}
		};
	},
};
