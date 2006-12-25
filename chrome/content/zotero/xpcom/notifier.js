/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Notifier = new function(){
	var _observers = new Zotero.Hash();
	var _disabled = false;
	var _types = ['collection', 'search', 'item', 'tag'];
	var _inTransaction;
	var _locked = false;
	var _queue = [];
	
	this.registerObserver = registerObserver;
	this.unregisterObserver = unregisterObserver;
	this.registerCollectionObserver = registerCollectionObserver;
	this.registerItemObserver = registerItemObserver;
	this.unregisterCollectionObserver = unregisterCollectionObserver;
	this.unregisterItemObserver = unregisterItemObserver;
	this.trigger = trigger;
	this.begin = begin;
	this.commit = commit;
	this.reset = reset;
	this.disable = disable;
	this.enable = enable;
	this.isEnabled = isEnabled;
	
	
	function registerObserver(ref, types){
		if (types){
			types = Zotero.flattenArguments(types);
			
			for (var i=0; i<types.length; i++){
				if (_types.indexOf(types[i]) == -1){
					throw ('Invalid type ' + types[i] + ' in registerObserver()');
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
			
			var hash = Zotero.randomString(len);
			tries--;
		}
		while (_observers.get(hash));
		
		Zotero.debug('Registering observer for '
			+ (types ? '[' + types.join() + ']' : 'all types')
			+ ' in notifier with hash ' + hash + "'", 4);
		_observers.set(hash, {ref: ref, types: types});
		return hash;
	}
	
	function unregisterObserver(hash){
		Zotero.debug("Unregistering observer in notifier with hash '" + hash + "'", 4);
		_observers.remove(hash);
	}
	
	// Deprecated
	function registerCollectionObserver(ref){
		Zotero.debug('registerCollectionObserver is deprecated and will be removed in a future release -- use registerObserver() instead', 2);
		return registerObserver(ref, 'collection');
	}
	
	// Deprecated
	function registerItemObserver(ref){
		Zotero.debug('registerItemObserver is deprecated and will be removed in a future release -- use registerObserver() instead', 2);
		return registerObserver(ref, 'item');
	}
	
	// Deprecated
	function unregisterCollectionObserver(hash){
		Zotero.debug('unregisterCollectionObserver is deprecated and will be removed in a future release -- use unregisterObserver() instead', 2);
		unregisterObserver(hash);
	}
	
	// Deprecated
	function unregisterItemObserver(hash){
		Zotero.debug('unregisterItemObserver is deprecated and will be removed in a future release -- use unregisterObserver() instead', 2);
		unregisterObserver(hash);
	}
	
	/**
	* Trigger a notification to the appropriate observers
	*
	* Possible values:
	*
	* 	event: 'add', 'modify', 'delete', 'move' (c, for changing parent),
	*		'remove' (i, for removing from collections)
	* 	type - 'collection', 'search', 'item'
	* 	ids - single id or array of ids
	*
	* c = collection, s = search, i = item, t = tag
	*
	*
	* Notes:
	*
	* - add-item is currently used for both item creation and adding an
	* existing item to a collection
	*
	* - If event queuing is on, events will not fire until commit() is called
	* unless _force_ is true.
	*
	* - New events and types should be added to the order arrays in commit()
	**/
	function trigger(event, type, ids, force){
		if (_disabled){
			return false;
		}
		
		if (_types && _types.indexOf(type) == -1){
			throw ('Invalid type ' + type + ' in Notifier.trigger()');
		}
		
		ids = Zotero.flattenArguments(ids);
		
		var queue = _inTransaction && !force;
		
		Zotero.debug("Notifier.trigger('" + event + "', '" + type + "', " + '[' + ids.join() + '])'
			+ (queue ? " queued" : " called " + "[observers: " + _observers.length + "]"));
		
		if (queue) {
			if (!_queue[type]) {
				_queue[type] = [];
			}
			if (!_queue[type][event]) {
				_queue[type][event] = [];
			}
			
			_queue[type][event] = _queue[type][event].concat(ids);
			
			return true;
		}
		
		for (i in _observers.items){
			Zotero.debug("Calling notify() on observer with hash '" + i + "'", 4);
			// Find observers that handle notifications for this type (or all types)
			if (!_observers.get(i).types || _observers.get(i).types.indexOf(type)!=-1){
				_observers.get(i).ref.notify(event, type, ids);
			}
		}
		
		return true;
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
			Zotero.debug("Beginning Notifier event queue");
			_inTransaction = true;
		}
		
		return unlock;
	}
	
	
	/*
	 * Send notifications for ids in the event queue
	 *
	 * If the queue is locked, notifications will only run if _unlock_ is true
	 */
	function commit(unlock) {
		// If there's a lock on the event queue and _unlock_ isn't given, don't commit
		if ((unlock == undefined && _locked) || (unlock != undefined && !unlock)) {
			//Zotero.debug("Keeping Notifier event queue open", 4);
			return;
		}
		
		var runQueue = [];
		
		function sorter(a, b) {
			return order.indexOf(a) - order.indexOf(b);
		}
		var order = ['collection', 'search', 'items', 'tags'];
		_queue.sort();
		
		var order = ['add', 'modify', 'remove', 'move', 'delete'];
		var totals = '';
		for (var type in _queue) {
			if (!runQueue[type]) {
				runQueue[type] = [];
			}
			
			_queue[type].sort();
			
			for (var event in _queue[type]) {
				runQueue[type][event] = [];
				
				// Remove redundant ids
				for each(var id in _queue[type][event]) {
					if (runQueue[type][event].indexOf(id) == -1) {
						runQueue[type][event].push(id);
					}
				}
				
				totals += ' [' + event + '-' + type + ': ' + runQueue[type][event].length + ']';
			}
		}
		
		if (totals) {
			Zotero.debug("Committing Notifier event queue" + totals);
			
			for (var type in runQueue) {
				for (var event in runQueue[type]) {
					if (runQueue[type][event].length) {
						trigger(event, type, runQueue[type][event], true);
					}
				}
			}
		}
		reset();
	}
	
	
	/*
	 * Reset the event queue
	 */
	function reset() {
		Zotero.debug("Resetting Notifier event queue");
		_locked = false;
		_queue = [];
		_inTransaction = false;
	}
	
	
	function disable(){
		Zotero.debug('Disabling Notifier notifications');
		_disabled = true;
	}
	
	
	function enable(){
		Zotero.debug('Enabling Notifier notifications');
		_disabled = false;
	}
	
	
	function isEnabled(){
		return !_disabled;
	}
}
