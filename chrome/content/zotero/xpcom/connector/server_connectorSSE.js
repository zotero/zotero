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
 * A Zotero.ConnectorNotifier listener and a notifier to listening SSE HTTP connections
 *
 * Listeners are individual SSE connections from (possibly multiple) Connector connections
 */
Zotero.Server.SSE.Connector = {
	_listeners: [],
	/**
	 * @param event {String} event name
	 * @param data {Any} JSON-encodable data
	 */
	notify: function (event, data) {
		var data = `data: ${JSON.stringify({ data, event })}\n\n`;
		this._listeners.forEach(function (listener) {
			listener.notify(data);
		});
	},
	
	addListener: async function (listener) {
		this._listeners.push(listener);
		Zotero.debug(`SSE.Connector listener added. Total: ${this._listeners.length}`);
		// Send out initialization data on the channel
		let initData = await Zotero.ConnectorNotifier.getInitData();
		var data = `data: ${JSON.stringify({data: initData, event: 'init'})}\n\n`;
		listener.notify(data);
	},
	
	removeListener: function (listener) {
		this._listeners = this._listeners.filter(l => l !== listener);
		Zotero.debug(`SSE.Connector listener removed. Total: ${this._listeners.length}`);
	},
	
	init: function () {
		Zotero.ConnectorNotifier.addListener(this);
	}
};

/**
 * Receives a writeCallback to the SSE listener connection and attaches it to a connector
 * event listener
 * @param writeCallback {Function} throws upon connection close
 */
Zotero.Server.SSE.Endpoints['/connector/sse'] = function (writeCallback) {
	let listener = new function listener() {
		this.notify = function () {
			try {
				writeCallback.apply(writeCallback, arguments);
			}
			catch (e) {
				// This should never happen since we remove the listener in case of other errors
				if (e instanceof Zotero.Server.ClosedStreamError) {
					throw e;
				}
				else {
					Zotero.Server.SSE.Connector.removeListener(this);
				}
			}
		}
	};
	Zotero.Server.SSE.Connector.addListener(listener);
};

