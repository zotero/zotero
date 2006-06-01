Scholar.Notifier = new function(){
	var _observers = new Array();
	_observers['columnTree'] = new Array();
	_observers['itemTree'] = new Array();
	
	this.registerColumnTree = registerColumnTree;
	this.registerItemTree = registerItemTree;
	this.unregisterColumnTree = unregisterColumnTree;
	this.unregisterItemTree = unregisterItemTree;
	this.trigger = trigger;
	
	function registerColumnTree(ref){
		_register('columnTree', ref);
	}
	
	function registerItemTree(ref){
		_register('itemTree', ref);
	}
	
	function unregisterColumnTree(hash){
		_unregister('columnTree', hash);
	}
	
	function unregisterItemTree(hash){
		_unregister('columnTree', hash);
	}
	
	/**
	* event is one of 'add', 'remove', 'modify'
	* type is one of 'collection', 'smartcollection', 'item'
	**/
	function trigger(event, type, id){
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
		
		for (i in _observers[treeType]){
			Scholar.debug("Calling _observers['" + treeType + "']['" + i + "'].notify('" + event
				+ "', " + type + "', " + id + ")", 4);
			_observers[treeType][i].notify(event, type, id);
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
		while (_observers[type][hash]);
		
		Scholar.debug('Registering ' + type + " with hash '" + hash + "'", 4);
		_observers[type][hash] = ref;
		return hash;
	}
	
	function _unregister(type, hash){
		delete _observers[type][hash];
	}
}
