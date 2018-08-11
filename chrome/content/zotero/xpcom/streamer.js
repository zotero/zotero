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


// Initialized as Zotero.Streamer in zotero.js
Zotero.Streamer_Module = function (options = {}) {
	this.url = options.url;
	this.apiKey = options.apiKey;
	
	let observer = {
		notify: (event, type) => {
			if (event == 'modify' || event == 'delete') {
				this._update();
			}
		}
	};
	this._observerID = Zotero.Notifier.registerObserver(observer, ['api-key'], 'streamer');
};

Zotero.Streamer_Module.prototype = {
	_initialized: null,
	_observerID: null,
	_socket: null,
	_ready: false,
	_reconnect: true,
	_retry: null,
	_subscriptions: new Set(),
	
	
	init: function () {
		Zotero.Prefs.registerObserver('streaming.enabled', (val) => this._update());
		Zotero.Prefs.registerObserver('automaticScraperUpdates', (val) => this._update());
		Zotero.Prefs.registerObserver('sync.autoSync', (val) => this._update());
		Zotero.uiReadyPromise.then(() => this._update());
	},
	
	
	_update: async function () {
		if (!this._isEnabled()) {
			this._disconnect();
			return;
		}
		
		// If not connecting or connected, connect now
		if (!this._socketOpen()) {
			this._connect();
			return;
		}
		// If not yet ready for messages, wait until we are, at which point this will be called again
		if (!this._ready) {
			return;
		}
		
		var apiKey = this.apiKey || (await Zotero.Sync.Data.Local.getAPIKey());
		
		var subscriptionsToAdd = [];
		var subscriptionsToRemove = [];
		
		if (Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Runner.enabled) {
			if (!this._subscriptions.has('sync')) {
				// Subscribe to all topics accessible to the API key
				subscriptionsToAdd.push({ apiKey });
			}
		}
		else if (this._subscriptions.has('sync')) {
			subscriptionsToRemove.push({ apiKey });
		}
		
		if (Zotero.Prefs.get('automaticScraperUpdates')) {
			if (!this._subscriptions.has('bundled-files')) {
				subscriptionsToAdd.push(
					{
						topics: ['styles', 'translators']
					}
				);
			}
		}
		else if (this._subscriptions.has('bundled-files')) {
			subscriptionsToRemove.push(
				{
					topic: 'styles'
				},
				{
					topic: 'translators'
				}
			);
		}
		
		if (subscriptionsToAdd.length) {
			let data = JSON.stringify({
				action: 'createSubscriptions',
				subscriptions: subscriptionsToAdd
			});
			Zotero.debug("WebSocket message send: " + this._hideAPIKey(data));
			this._socket.send(data);
		}
		if (subscriptionsToRemove.length) {
			let data = JSON.stringify({
				action: 'deleteSubscriptions',
				subscriptions: subscriptionsToRemove
			});
			Zotero.debug("WebSocket message send: " + this._hideAPIKey(data));
			this._socket.send(data);
		}
	},
	
	
	_isEnabled: function () {
		return Zotero.Prefs.get('streaming.enabled')
			// Only connect if either auto-sync or automatic style/translator updates are enabled
			&& ((Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Runner.enabled)
				|| Zotero.Prefs.get('automaticScraperUpdates'));
	},
	
	
	_socketOpen: function () {
		return this._socket && (this._socket.readyState == this._socket.OPEN
				|| this._socket.readyState == this._socket.CONNECTING);
	},
	
	
	_connect: async function () {
		let url = this.url || Zotero.Prefs.get('streaming.url') || ZOTERO_CONFIG.STREAMING_URL;
		Zotero.debug(`Connecting to streaming server at ${url}`);
		
		this._ready = false;
		this._reconnect = true;
		
		var window = Cc["@mozilla.org/appshell/appShellService;1"]
			.getService(Ci.nsIAppShellService).hiddenDOMWindow;
		this._socket = new window.WebSocket(url, "zotero-streaming-api-v1");
		var deferred = Zotero.Promise.defer();
		
		this._socket.onopen = () => {
			Zotero.debug("WebSocket connection opened");
		};
		
		this._socket.onerror = async function (event) {
			Zotero.debug("WebSocket error");
		};
		
		this._socket.onmessage = async function (event) {
			Zotero.debug("WebSocket message: " + this._hideAPIKey(event.data));
			
			let data = JSON.parse(event.data);
			
			if (data.event == "connected") {
				this._ready = true;
				this._update();
			}
			else {
				this._reconnectGenerator = null;
				
				if (data.event == "subscriptionsCreated") {
					for (let s of data.subscriptions) {
						if (s.apiKey) {
							this._subscriptions.add('sync');
						}
						else if (s.topics && s.topics.includes('styles')) {
							this._subscriptions.add('bundled-files');
						}
					}
					
					for (let error of data.errors) {
						Zotero.logError(this._hideAPIKey(JSON.stringify(error)));
					}
				}
				else if (data.event == "subscriptionsDeleted") {
					for (let s of data.subscriptions) {
						if (s.apiKey) {
							this._subscriptions.delete('sync');
						}
						else if (s.topics && s.topics.includes('styles')) {
							this._subscriptions.delete('bundled-files');
						}
					}
				}
				// Library added or removed
				else if (data.event == 'topicAdded' || data.event == 'topicRemoved') {
					await Zotero.Sync.Runner.sync({
						background: true
					});
				}
				// Library modified
				else if (data.event == 'topicUpdated') {
					// Update translators and styles
					if (data.topic == 'translators' || data.topic == 'styles') {
						await Zotero.Schema.onUpdateNotification(data.delay);
					}
					// Auto-sync
					else {
						let library = Zotero.URI.getPathLibrary(data.topic);
						if (library) {
							// Ignore if skipped library
							let skipped = Zotero.Sync.Data.Local.getSkippedLibraries();
							if (skipped.includes(library.libraryID)) return;
							
							if (data.version && data.version == library.libraryVersion) {
								Zotero.debug("Library is already up to date");
								return;
							}
							
							await Zotero.Sync.Runner.sync({
								background: true,
								libraries: [library.libraryID]
							});
						}
					}
				}
				// TODO: Handle this in other ways?
				else if (data.event == 'error') {
					Zotero.logError(data);
				}
			}
		}.bind(this);
		
		this._socket.onclose = async function (event) {
			var msg = `WebSocket connection closed: ${event.code} ${event.reason}`;
			
			if (event.code != 1000) {
				Zotero.logError(msg);
			}
			else {
				Zotero.debug(msg);
			}
			
			this._subscriptions.clear();
			
			if (this._reconnect) {
				if (event.code >= 4400 && event.code < 4500) {
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
				await this._reconnectGenerator.next().value;
				this._update();
			}
		}.bind(this);
	},
	
	
	_hideAPIKey: function (str) {
		return str.replace(/(apiKey":\s*")[^"]+"/, '$1********"');
	},
	
	
	_disconnect: function () {
		this._reconnect = false;
		this._reconnectGenerator = null;
		this._subscriptions.clear();
		if (this._socket) {
			this._socket.close(1000);
		}
	}
};
