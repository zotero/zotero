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
	_observers['columnTree'] = new Zotero.Hash();
	_observers['itemTree'] = new Zotero.Hash();
	
	this.registerColumnTree = registerColumnTree;
	this.registerItemTree = registerItemTree;
	this.unregisterColumnTree = unregisterColumnTree;
	this.unregisterItemTree = unregisterItemTree;
	this.trigger = trigger;
	this.disable = disable;
	this.enable = enable;
	this.isEnabled = isEnabled;
	
	function registerColumnTree(ref){
		return _register('columnTree', ref);
	}
	
	function registerItemTree(ref){
		return _register('itemTree', ref);
	}
	
	function unregisterColumnTree(hash){
		_unregister('columnTree', hash);
	}
	
	function unregisterItemTree(hash){
		_unregister('itemTree', hash);
	}
	
	/**
	* event - 'add', 'remove', 'modify'
	* type - 'collection', 'search', 'item'
	* ids - single id or array of ids
	**/
	function trigger(event, type, ids){
		if (_disabled){
			return false;
		}
		
		switch (type){
			case 'item':
				var treeType = 'itemTree';
				break;
			case 'collection':
			case 'search':
				var treeType = 'columnTree';
				break;
			default:
				throw('Invalid type ' + type + ' in Notifier.trigger()');
		}
		
		Zotero.debug("Notifier.trigger('" + event + "', '" + type + "', "
			+ (typeof ids=='object' ? '[' + ids.join() + ']' : ids) + ") called "
			+ "[column trees: " + _observers['columnTree'].length
			+ ", item trees: " + _observers['itemTree'].length + "]");
		
		for (i in _observers[treeType].items){
			Zotero.debug("Calling notify() on " + treeType + " with hash '"
				+ i + "'", 4);
			_observers[treeType].get(i).notify(event, type, ids);
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
