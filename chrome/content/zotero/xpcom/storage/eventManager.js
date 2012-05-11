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

Zotero.Sync.Storage.EventManager = (function () {
	var _observers = [];
	
	function call(handler, data, clear) {
		Zotero.debug("Calling storage sync " + handler + " handlers");
		
		var observers = _observers;
		var cont = true;
		var handled = false;
		
		if (clear) {
			Zotero.Sync.Storage.EventManager.clear();
		}
		
		// Process most recently assigned observers first
		for (var i = observers.length - 1; i >= 0; i--) {
			let observer = observers[i].observer;
			let j = i;
			if (observer[handler]) {
				handled = true;
				if (observers[i].async) {
					setTimeout(function () {
						Zotero.debug("Calling " + handler + " handler " + j);
						var cont = observer[handler](data);
						if (cont === false) {
							throw new Error("Cannot cancel events from async observer");
						}
					}, 0);
				}
				else {
					Zotero.debug("Calling " + handler + " handler " + j);
					var cont = observer[handler](data);
					// If handler returns explicit false, cancel further events
					if (cont === false) {
						break;
					}
				}
			}
		}
		
		if (!handled && data) {
			var msg = "Unhandled storage sync event: " + data;
			Zotero.debug(msg, 1);
			if (handler == 'onError') {
				throw new Error(msg);
			}
			else {
				Components.utils.reportError(msg);
			}
		}
		
		// Throw errors to stop execution
		if (handler == 'onError') {
			if (!data) {
				throw new Error("Data not provided for error");
			}
			
			if (cont !== false) {
				throw (data);
			}
		}
	}
	
	return {
		registerObserver: function (observer, async, id) {
			var pos = -1;
			
			if (id) {
				for (var i = 0, len = _observers.length; i < len; i++) {
					var o = _observers[i];
					if (o.id === id && o.async == async) {
						pos = o;
						break;
					}
				}
			}
			
			if (pos == -1) {
				Zotero.debug("Registering storage sync event observer '" + id + "'");
				_observers.push({
					observer: observer,
					async: !!async,
					id: id
				});
			}
			else {
				Zotero.debug("Replacing storage sync event observer '" + id + "'");
				_observers[pos] = {
					observer: observer,
					async: !!async,
					id: id
				};
			}
		},
		
		success: function () call('onSuccess', false, true),
		skip: function (clear) call('onSkip', false, true),
		stop: function () call('onStop', false, true),
		error: function (e) call('onError', e, true),
		
		warning: function (e) call('onWarning', e),
		changesMade: function () call('onChangesMade'),
		
		clear: function () {
			var queues = Zotero.Sync.Storage.QueueManager.getAll();
			for each(var queue in queues) {
				if (queue.isRunning()) {
					Zotero.debug(queue.name[0].toUpperCase() + queue.name.substr(1)
						+ " queue not empty -- not clearing storage sync event observers");
					return;
				}
			}
			
			Zotero.debug("Clearing storage sync event observers");
			_observers = [];
		}
	};
}());
