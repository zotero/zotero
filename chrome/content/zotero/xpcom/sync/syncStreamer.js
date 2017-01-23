/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2016 Center for History and New Media
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

"use strict";


// Initialized as Zotero.Sync.Streamer in zotero.js
Zotero.Sync.Streamer_Module = function (options = {}) {
	this.url = options.url;
	this.apiKey = options.apiKey;
	
	let observer = {
		notify: function (event, type) {
			if (event == 'modify') {
				this.init();
			}
			else if (event == 'delete') {
				this.disconnect();
			}
		}.bind(this)
	};
	this._observerID = Zotero.Notifier.registerObserver(observer, ['api-key'], 'syncStreamer');
};

Zotero.Sync.Streamer_Module.prototype = {
	_observerID: null,
	_socket: null,
	_socketClosedDeferred: null,
	_reconnect: true,
	_retry: null,
	
	init: Zotero.Promise.coroutine(function* () {
		// Connect to the streaming server
		if (!Zotero.Prefs.get('sync.autoSync') || !Zotero.Prefs.get('sync.streaming.enabled')) {
			return this.disconnect();
		}
		
		// If already connected, disconnect first
		if (this._socket && (this._socket.readyState == this._socket.OPEN
				|| this._socket.readyState == this._socket.CONNECTING)) {
			yield this.disconnect();
		}
		
		// Connect to the streaming server
		let apiKey = this.apiKey || (yield Zotero.Sync.Data.Local.getAPIKey());
		if (apiKey) {
			let url = this.url || Zotero.Prefs.get('sync.streaming.url') || ZOTERO_CONFIG.STREAMING_URL;
			this._connect(url, apiKey);
		}
	}),
	
	_connect: function (url, apiKey) {
		Zotero.debug(`Connecting to streaming server at ${url}`);
		
		var window = Cc["@mozilla.org/appshell/appShellService;1"]
			.getService(Ci.nsIAppShellService)
			.hiddenDOMWindow;
		this._reconnect = true;
		
		this._socket = new window.WebSocket(url, "zotero-streaming-api-v1");
		
		this._socket.onopen = () => {
			Zotero.debug("WebSocket connection opened");
			this._reconnectGenerator = null;
		};
		
		this._socket.onerror = event => {
			Zotero.debug("WebSocket error");
		};
		
		this._socket.onmessage = Zotero.Promise.coroutine(function* (event) {
			Zotero.debug("WebSocket message: " + this._hideAPIKey(event.data));
			
			let data = JSON.parse(event.data);
			
			if (data.event == "connected") {
				// Subscribe with all topics accessible to the API key
				let data = JSON.stringify({
					action: "createSubscriptions",
					subscriptions: [{ apiKey }]
				});
				Zotero.debug("WebSocket message send: " + this._hideAPIKey(data));
				this._socket.send(data);
			}
			else if (data.event == "subscriptionsCreated") {
				for (let error of data.errors) {
					Zotero.logError(this._hideAPIKey(JSON.stringify(error)));
				}
			}
			// Library added or removed
			else if (data.event == 'topicAdded' || data.event == 'topicRemoved') {
				yield Zotero.Sync.Runner.sync({
					background: true
				});
			}
			// Library modified
			else if (data.event == 'topicUpdated') {
				let library = Zotero.URI.getPathLibrary(data.topic);
				if (library) {
					// Ignore if skipped library
					let skipped = Zotero.Sync.Data.Local.getSkippedLibraries();
					if (skipped.includes(library.libraryID)) return;
					
					yield Zotero.Sync.Runner.sync({
						background: true,
						libraries: [library.libraryID]
					});
				}
			}
		}.bind(this));
		
		this._socket.onclose = Zotero.Promise.coroutine(function* (event) {
			Zotero.debug(`WebSocket connection closed: ${event.code} ${event.reason}`, 2);
			
			if (this._socketClosedDeferred) {
				this._socketClosedDeferred.resolve();
			}
			
			if (this._reconnect) {
				if (event.code >= 4000) {
					Zotero.debug("Not reconnecting to WebSocket due to client error");
					return;
				}
				
				if (!this._reconnectGenerator) {
					let intervals = [
						2, 5, 10, 15, 30, // first minute
						60, 60, 60, 60, // every minute for 4 minutes
						120, 120, 120, 120, // every 2 minutes for 8 minutes
						300, 300, // every 5 minutes for 10 minutes
						600, // 10 minutes
						1200, // 20 minutes
						1800, 1800, // 30 minutes for 1 hour
						3600, 3600, 3600, // every hour for 3 hours
						14400, 14400, 14400, // every 4 hours for 12 hours
						86400 // 1 day
					].map(i => i * 1000);
					this._reconnectGenerator = Zotero.Utilities.Internal.delayGenerator(intervals);
				}
				yield this._reconnectGenerator.next().value;
				this._connect(url, apiKey);
			}
		}.bind(this));
	},
	
	
	_hideAPIKey: function (str) {
		return str.replace(/(apiKey":\s*")[^"]+"/, '$1********"');
	},
	
	
	disconnect: Zotero.Promise.coroutine(function* () {
		this._reconnect = false;
		this._reconnectGenerator = null;
		if (this._socket) {
			this._socketClosedDeferred = Zotero.Promise.defer();
			this._socket.close();
			return this._socketClosedDeferred.promise;
		}
	})
};
