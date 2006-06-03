Scholar.Notifier = new function(){
	var _observers = new Array();
	_observers['columnTree'] = new Scholar.Hash();
	_observers['itemTree'] = new Scholar.Hash();
	
	this.registerColumnTree = registerColumnTree;
	this.registerItemTree = registerItemTree;
	this.unregisterColumnTree = unregisterColumnTree;
	this.unregisterItemTree = unregisterItemTree;
	this.trigger = trigger;
	
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
	* type - 'collection', 'smartcollection', 'item'
	* ids - single id or array of ids
	**/
	function trigger(event, type, ids){
		switch (type){
			case 'item':
				var treeType = 'itemTree';
				break;
			case 'collection':
			case 'smartcollection':
				var treeType = 'columnTree';
				break;
			default:
				throw('Invalid type in Notifier.trigger()');
		}
		
		Scholar.debug("Notifier.trigger('" + event + "', '" + type + "', "
			+ (typeof ids=='Object' ? ids.join() : ids) + ") called "
			+ "[column trees: " + _observers['columnTree'].length
			+ ", item trees: " + _observers['itemTree'].length + "]");
		
		for (i in _observers[treeType].items){
			Scholar.debug("Calling notify() on " + treeType + " with hash '"
				+ i + "'", 4);
			_observers[treeType].get(i).notify(event, type, ids);
		}
	}
	
	
	function _register(type, ref){
		var len = 6;
		var tries = 10;
		do {
			// Increase the hash length if we can't find a unique key
			if (!tries){
				len++;
				tries = 10;
			}
			
			var hash = Scholar.randomString(len);
			tries--;
		}
		while (_observers[type].get(hash));
		
		Scholar.debug('Registering ' + type + " in notifier with hash '" + hash + "'", 4);
		_observers[type].set(hash, ref);
		return hash;
	}
	
	function _unregister(type, hash){
		Scholar.debug("Unregistering " + type + " in notifier with hash '" + hash + "'", 4);
		_observers[type].remove(hash);
	}
}
