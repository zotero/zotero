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
	var _disabled = false;
	var _types = [
		'collection', 'search', 'share', 'share-items', 'item', 'file',
		'collection-item', 'item-tag', 'tag', 'setting', 'group', 'trash', 'publications',
		'bucket', 'relation'
	];
	var _inTransaction;
	var _locked = false;
	var _queue = [];
	
	this.begin = begin;
	this.reset = reset;
	this.disable = disable;
	this.enable = enable;
	this.isEnabled = isEnabled;
	
	
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
		Zotero.debug(msg);
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
	*		'remove' (ci, it), 'refresh', 'redraw', 'trash'
	* 	type - 'collection', 'search', 'item', 'collection-item', 'item-tag', 'tag', 'group', 'relation'
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
		if (_inTransaction && !force) {
			return this.queue(event, type, ids, extraData);
		}
		
		if (_disabled){
			Zotero.debug("Notifications are disabled");
			return false;
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
			Zotero.debug("Calling notify() with " + event + "/" + type
				+ " on observer with id '" + id + "'", 4);
			
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
					Zotero.debug(id + " observer finished in " + t + " ms");
				}
			}
			catch (e) {
				Zotero.debug(e);
				Components.utils.reportError(e);
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
	this.queue = function (event, type, ids, extraData) {
		if (_disabled){
			Zotero.debug("Notifications are disabled");
			return false;
		}
		
		if (_types && _types.indexOf(type) == -1) {
			throw new Error("Invalid type '" + type + "'");
		}
		
		ids = Zotero.flattenArguments(ids);
		
		if (Zotero.Debug.enabled) {
			_logTrigger(event, type, ids, extraData, true);
		}
		
		if (!_inTransaction) {
			throw new Error("Can't queue event outside of a transaction");
		}
		
		// Merge with existing queue
		if (!_queue[type]) {
			_queue[type] = [];
		}
		if (!_queue[type][event]) {
			_queue[type][event] = {};
		}
		if (!_queue[type][event].ids) {
			_queue[type][event].ids = [];
			_queue[type][event].data = {};
		}
		
		// Merge ids
		_queue[type][event].ids = _queue[type][event].ids.concat(ids);
		
		// Merge extraData keys
		if (extraData) {
			// If just a single id, extra data can be keyed by id or passed directly
			if (ids.length == 1) {
				let id = ids[0];
				_queue[type][event].data[id] = extraData[id] ? extraData[id] : extraData;
			}
			// For multiple ids, check for data keyed by the id
			else {
				for (let i = 0; i < ids.length; i++) {
					let id = ids[i];
					if (extraData[id]) {
						_queue[type][event].data[id] = extraData[id];
					}
				}
			}
		}
		
		return true;
	}
	
	
	function _logTrigger(event, type, ids, extraData, queueing) {
		Zotero.debug("Notifier.trigger("
			+ "'" + event + "', "
			+ "'" + type + "', "
			+ "[" + ids.join() + "]"
			+ (extraData ? ", " + JSON.stringify(extraData) : "")
			+ ")"
			+ (queueing
				? " queued "
				: " called "
			+ "[observers: " + _countObserversForType(type) + "]")
		);
	}
	
	
	/**
	 * Get order of observer by priority, with lower numbers having higher priority.
	 * If an observer doesn't have a priority, sort it last.
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
				priority: _observers[i].priority || false
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
	
	
	this.untrigger = function (event, type, ids) {
		if (!_inTransaction) {
			throw ("Zotero.Notifier.untrigger() called with no active event queue")
		}
		
		ids = Zotero.flattenArguments(ids);
		
		for each(var id in ids) {
			var index = _queue[type][event].ids.indexOf(id);
			if (index == -1) {
				Zotero.debug(event + '-' + type + ' id ' + id +
					' not found in queue in Zotero.Notifier.untrigger()');
				continue;
			}
			_queue[type][event].ids.splice(index, 1);
			delete _queue[type][event].data[id];
		}
	}
	
	
	/*
	 * Begin queueing event notifications (i.e. don't notify the observers)
	 *
	 * _lock_ will prevent subsequent commits from running the queue until commit() is called
	 * with the _unlock_ being true
	 *
	 * Note: Be sure the matching commit() gets called (e.g. in a finally{...} block) or
	 * notifications will break until Firefox is restarted or commit(true)/reset() is called manually
	 */
	function begin(lock) {
		if (lock && !_locked) {
			_locked = true;
			var unlock = true;
		}
		else {
			var unlock = false;
		}
		
		if (_inTransaction) {
			//Zotero.debug("Notifier queue already open", 4);
		}
		else {
			Zotero.debug("Beginning notifier event queue");
			_inTransaction = true;
		}
		
		return unlock;
	}
	
	
	/*
	 * Send notifications for ids in the event queue
	 *
	 * If the queue is locked, notifications will only run if _unlock_ is true
	 */
	this.commit = Zotero.Promise.coroutine(function* (unlock) {
		// If there's a lock on the event queue and _unlock_ isn't given, don't commit
		if ((unlock == undefined && _locked) || (unlock != undefined && !unlock)) {
			//Zotero.debug("Keeping Notifier event queue open", 4);
			return;
		}
		
		var runQueue = [];
		
		function sorter(a, b) {
			return order.indexOf(b) - order.indexOf(a);
		}
		var order = ['collection', 'search', 'item', 'collection-item', 'item-tag', 'tag'];
		_queue.sort();
		
		var order = ['add', 'modify', 'remove', 'move', 'delete', 'trash'];
		var totals = '';
		for (var type in _queue) {
			if (!runQueue[type]) {
				runQueue[type] = [];
			}
			
			_queue[type].sort();
			
			for (var event in _queue[type]) {
				runQueue[type][event] = {
					ids: [],
					data: _queue[type][event].data
				};
				
				// Remove redundant ids
				for (var i=0; i<_queue[type][event].ids.length; i++) {
					var id = _queue[type][event].ids[i];
					
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
		
		reset();
		
		if (totals) {
			Zotero.debug("Committing notifier event queue" + totals);
			
			for (var type in runQueue) {
				for (var event in runQueue[type]) {
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
	function reset() {
		Zotero.debug("Resetting notifier event queue");
		_locked = false;
		_queue = [];
		_inTransaction = false;
	}
	
	
	// 
	// These should rarely be used now that we have event queuing
	//
	
	/*
	 * Disables Notifier notifications
	 *
	 * Returns false if the Notifier was already disabled, true otherwise
	 */
	function disable() {
		if (_disabled) {
			Zotero.debug('Notifier notifications are already disabled');
			return false;
		}
		Zotero.debug('Disabling Notifier notifications'); 
		_disabled = true;
		return true;
	}
	
	
	function enable() {
		Zotero.debug('Enabling Notifier notifications');
		_disabled = false; 
	}
	
	
	function isEnabled() {
		return !_disabled;
	}
}
