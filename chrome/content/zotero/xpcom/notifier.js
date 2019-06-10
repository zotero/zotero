/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

Zotero.Notifier = new function(){
	var _observers = {};
	var _types = [
		'collection', 'search', 'share', 'share-items', 'item', 'file',
		'collection-item', 'item-tag', 'tag', 'setting', 'group', 'trash',
		'bucket', 'relation', 'feed', 'feedItem', 'sync', 'api-key'
	];
	var _transactionID = false;
	var _queue = {};


	/**
	 * @param {Object} [ref] signature {notify: function(event, type, ids, extraData) {}}
	 * @param {Array} [types] a list of types of events observer should be triggered on
	 * @param {String} [id] an id of the observer used in debug output
	 * @param {Integer} [priority] lower numbers correspond to higher priority of observer execution
	 * @returns {string}
	 */
	this.registerObserver = function (ref, types, id, priority) {
		if (types){
			types = Zotero.flattenArguments(types);
			
			for (var i=0; i<types.length; i++){
				if (_types.indexOf(types[i]) == -1){
					throw new Error("Invalid type '" + types[i] + "'");
				}
			}
		}
		
		var len = 2;
		var tries = 10;
		do {
			// Increase the hash length if we can't find a unique key
			if (!tries){
				len++;
				tries = 10;
			}
			
			var hash = (id ? id + '_' : '') + Zotero.randomString(len);
			tries--;
		}
		while (_observers[hash]);
		
		var msg = "Registering notifier observer '" + hash + "' for "
			+ (types ? '[' + types.join() + ']' : 'all types');
		if (priority) {
			msg += " with priority " + priority;
		}
		_observers[hash] = {
			ref: ref,
			types: types,
			priority: priority || false
		};
		return hash;
	}
	
	this.unregisterObserver = function (id) {
		Zotero.debug("Unregistering notifier observer in notifier with id '" + id + "'", 4);
		delete _observers[id];
	}
	
	
	/**
	* Trigger a notification to the appropriate observers
	*
	* Possible values:
	*
	* 	event: 'add', 'modify', 'delete', 'move' ('c', for changing parent),
	*		'remove' (ci, it), 'refresh', 'redraw', 'trash', 'unreadCountUpdated'
	* 	type - 'collection', 'search', 'item', 'collection-item', 'item-tag', 'tag',
	*		'group', 'relation', 'feed', 'feedItem'
	* 	ids - single id or array of ids
	*
	* Notes:
	*
	* - If event queuing is on, events will not fire until commit() is called
	* unless _force_ is true.
	*
	* - New events and types should be added to the order arrays in commit()
	**/
	this.trigger = Zotero.Promise.coroutine(function* (event, type, ids, extraData, force) {
		if (_transactionID && !force) {
			return this.queue(event, type, ids, extraData);
		}
		
		if (_types && _types.indexOf(type) == -1) {
			throw new Error("Invalid type '" + type + "'");
		}
		
		ids = Zotero.flattenArguments(ids);
		
		if (Zotero.Debug.enabled) {
			_logTrigger(event, type, ids, extraData);
		}
		
		var order = _getObserverOrder(type);
		for (let id of order) {
			//Zotero.debug("Calling notify() with " + event + "/" + type
			//	+ " on observer with id '" + id + "'", 5);
			
			if (!_observers[id]) {
				Zotero.debug("Observer no longer exists");
				continue;
			}
			
			// Catch exceptions so all observers get notified even if
			// one throws an error
			try {
				let t = new Date;
				yield Zotero.Promise.resolve(_observers[id].ref.notify(event, type, ids, extraData));
				t = new Date - t;
				if (t > 5) {
					//Zotero.debug(id + " observer finished in " + t + " ms", 5);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		return true;
	});
	
	
	/**
	 * Queue an event until the end of the current notifier transaction
	 *
	 * Takes the same parameters as trigger()
	 *
	 * @throws If a notifier transaction isn't currently open
	 */
	this.queue = function (event, type, ids, extraData, queue) {
		if (_types && _types.indexOf(type) == -1) {
			throw new Error("Invalid type '" + type + "'");
		}
		
		ids = Zotero.flattenArguments(ids);
		
		if (Zotero.Debug.enabled) {
			_logTrigger(event, type, ids, extraData, true, queue ? queue.id : null);
		}
		
		// Use a queue if one is provided, or else use main queue
		if (queue) {
			queue.size++;
			queue = queue._queue;
		}
		else {
			if (!_transactionID) {
				throw new Error("Can't queue event outside of a transaction");
			}
			queue = _queue;
		}
		
		_mergeEvent(queue, event, type, ids, extraData);
	}
	
	
	function _mergeEvent(queue, event, type, ids, extraData) {
		// Merge with existing queue
		if (!queue[type]) {
			queue[type] = [];
		}
		if (!queue[type][event]) {
			queue[type][event] = {};
		}
		if (!queue[type][event].ids) {
			queue[type][event].ids = [];
			queue[type][event].data = {};
		}
		
		// Merge ids
		queue[type][event].ids = queue[type][event].ids.concat(ids);
		
		// Merge extraData keys
		if (extraData) {
			// If just a single id, extra data can be keyed by id or passed directly
			if (ids.length == 1) {
				let id = ids[0];
				queue[type][event].data[id] = extraData[id] ? extraData[id] : extraData;
			}
			// For multiple ids, check for data keyed by the id
			else {
				for (let i = 0; i < ids.length; i++) {
					let id = ids[i];
					if (extraData[id]) {
						queue[type][event].data[id] = extraData[id];
					}
				}
			}
		}
	}
	
	
	function _logTrigger(event, type, ids, extraData, queueing, queueID) {
		Zotero.debug("Notifier.trigger("
			+ "'" + event + "', "
			+ "'" + type + "', "
			+ "[" + ids.join() + "]"
			+ (extraData ? ", " + JSON.stringify(extraData) : "")
			+ ")"
			+ (queueing
				? " " + (queueID ? "added to queue " + queueID : "queued") + " "
				: " called "
			+ "[observers: " + _countObserversForType(type) + "]")
		);
	}
	
	
	/**
	 * Get order of observer by priority, with lower numbers having higher priority.
	 * If an observer doesn't have a priority, default to 100.
	 */
	function _getObserverOrder(type) {
		var order = [];
		for (let i in _observers) {
			// Skip observers that don't handle notifications for this type (or all types)
			if (_observers[i].types && _observers[i].types.indexOf(type) == -1) {
				continue;
			}
			order.push({
				id: i,
				priority: _observers[i].priority || 100
			});
		}
		order.sort((a, b) => {
			if (a.priority === false && b.priority === false) return 0;
			if (a.priority === false) return 1;
			if (b.priority === false) return -1;
			return a.priority - b.priority;
		});
		return order.map(o => o.id);
	}
	
	
	function _countObserversForType(type) {
		var num = 0;
		for (let i in _observers) {
			// Skip observers that don't handle notifications for this type (or all types)
			if (_observers[i].types && _observers[i].types.indexOf(type) == -1) {
				continue;
			}
			num++;
		}
		return num;
	}
	
	
	/**
	 * Begin queueing event notifications (i.e. don't notify the observers)
	 *
	 * Note: Be sure the matching commit() gets called (e.g. in a finally{...} block) or
	 * notifications will break until Firefox is restarted or commit(true)/reset() is called manually
	 *
	 * @param {String} [transactionID]
	 */
	this.begin = function (transactionID = true) {
		_transactionID = transactionID;
	}
	
	
	/**
	 * Send notifications for ids in the event queue
	 *
	 * @param {Zotero.Notifier.Queue|Zotero.Notifier.Queue[]} [queues] - One or more queues to use
	 *     instead of the internal queue
	 * @param {String} [transactionID]
	 */
	this.commit = Zotero.Promise.coroutine(function* (queues, transactionID = true) {
		if (queues) {
			if (!Array.isArray(queues)) {
				queues = [queues];
			}
			
			var queue = {};
			for (let q of queues) {
				q = q._queue;
				for (let type in q) {
					for (let event in q[type]) {
						_mergeEvent(queue, event, type, q[type][event].ids, q[type][event].data);
					}
				}
			}
		}
		else if (!_transactionID) {
			throw new Error("Can't commit outside of transaction");
		}
		else {
			var queue = _queue;
		}
		
		var runQueue = [];
		
		// Sort using order from array, unless missing, in which case sort after
		var getSorter = function (orderArray) {
			return function (a, b) {
				var posA = orderArray.indexOf(a);
				var posB = orderArray.indexOf(b);
				if (posA == -1) posA = 100;
				if (posB == -1) posB = 100;
				return posA - posB;
			}
		};
		
		var typeOrder = ['collection', 'search', 'item', 'collection-item', 'item-tag', 'tag'];
		var eventOrder = ['add', 'modify', 'remove', 'move', 'delete', 'trash'];
		
		var queueTypes = Object.keys(queue);
		queueTypes.sort(getSorter(typeOrder));
		
		var totals = '';
		for (let type of queueTypes) {
			if (!runQueue[type]) {
				runQueue[type] = [];
			}
			
			let typeEvents = Object.keys(queue[type]);
			typeEvents.sort(getSorter(eventOrder));
			
			for (let event of typeEvents) {
				runQueue[type][event] = {
					ids: [],
					data: queue[type][event].data
				};
				
				// Remove redundant ids
				for (let i = 0; i < queue[type][event].ids.length; i++) {
					let id = queue[type][event].ids[i];
					
					// Don't send modify on nonexistent items or tags
					if (event == 'modify') {
						if (type == 'item' && !(yield Zotero.Items.getAsync(id))) {
							continue;
						}
						else if (type == 'tag' && !(yield Zotero.Tags.getAsync(id))) {
							continue;
						}
					}
					
					if (runQueue[type][event].ids.indexOf(id) == -1) {
						runQueue[type][event].ids.push(id);
					}
				}
				
				if (runQueue[type][event].ids.length || event == 'refresh') {
					totals += ' [' + event + '-' + type + ': ' + runQueue[type][event].ids.length + ']';
				}
			}
		}
		
		if (!queues) {
			this.reset(transactionID);
		}
		
		if (totals) {
			if (queues) {
				Zotero.debug("Committing notifier event queues" + totals
					+ " [queues: " + queues.map(q => q.id).join(", ") + "]");
			}
			else {
				Zotero.debug("Committing notifier event queue" + totals);
			}
			
			for (let type in runQueue) {
				for (let event in runQueue[type]) {
					if (runQueue[type][event].ids.length || event == 'refresh') {
						yield this.trigger(
							event,
							type,
							runQueue[type][event].ids,
							runQueue[type][event].data,
							true
						);
					}
				}
			}
		}
	});
	
	
	/*
	 * Reset the event queue
	 */
	this.reset = function (transactionID = true) {
		if (transactionID != _transactionID) {
			return;
		}
		//Zotero.debug("Resetting notifier event queue");
		_queue = {};
		_transactionID = false;
	}
}


Zotero.Notifier.Queue = function () {
	this.id = Zotero.Utilities.randomString();
	Zotero.debug("Creating notifier queue " + this.id);
	this._queue = {};
	this.size = 0;
};
