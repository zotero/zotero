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
	var _observers = new Array();
	var _disabled = false;
	_observers['collectionObserver'] = new Zotero.Hash();
	_observers['itemObserver'] = new Zotero.Hash();
	
	this.registerCollectionObserver = registerCollectionObserver;
	this.registerItemObserver = registerItemObserver;
	this.unregisterCollectionObserver = unregisterCollectionObserver;
	this.unregisterItemObserver = unregisterItemObserver;
	this.trigger = trigger;
	this.disable = disable;
	this.enable = enable;
	this.isEnabled = isEnabled;
	
	function registerCollectionObserver(ref){
		return _register('collectionObserver', ref);
	}
	
	function registerItemObserver(ref){
		return _register('itemObserver', ref);
	}
	
	function unregisterCollectionObserver(hash){
		_unregister('collectionObserver', hash);
	}
	
	function unregisterItemObserver(hash){
		_unregister('itemObserver', hash);
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
	* c = collection, s = search, i = item
	**/
	function trigger(event, type, ids){
		if (_disabled){
			return false;
		}
		
		switch (type){
			case 'item':
				var observerType = 'itemObserver';
				break;
			case 'collection':
			case 'search':
				var observerType = 'collectionObserver';
				break;
			default:
				throw('Invalid type ' + type + ' in Notifier.trigger()');
		}
		
		Zotero.debug("Notifier.trigger('" + event + "', '" + type + "', "
			+ (typeof ids=='object' ? '[' + ids.join() + ']' : ids) + ") called "
			+ "[collection observers: " + _observers['collectionObserver'].length
			+ ", item observers: " + _observers['itemObserver'].length + "]");
		
		for (i in _observers[observerType].items){
			Zotero.debug("Calling notify() on " + observerType + " with hash '"
				+ i + "'", 4);
			_observers[observerType].get(i).notify(event, type, ids);
		}
		
		return true;
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
	
	
	function _register(type, ref){
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
		while (_observers[type].get(hash));
		
		Zotero.debug('Registering ' + type + " in notifier with hash '" + hash + "'", 4);
		_observers[type].set(hash, ref);
		return hash;
	}
	
	function _unregister(type, hash){
		Zotero.debug("Unregistering " + type + " in notifier with hash '" + hash + "'", 4);
		_observers[type].remove(hash);
	}
}
