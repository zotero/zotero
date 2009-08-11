// TODO: license

Zotero.Debug = new function () {
	this.__defineGetter__('storing', function () _store);
	
	var _console;
	var _store;
	var _level;
	var _time;
	var _lastTime;
	var _output = [];
	
	
	this.init = function () {
		_console = Zotero.Prefs.get('debug.log');
		_store = Zotero.Prefs.get('debug.store');
		_level = Zotero.Prefs.get('debug.level');
		_time = Zotero.Prefs.get('debug.time');
	}
	
	this.log = function (message, level) {
		if (!_console && !_store) {
			return;
		}
		
		if (typeof message != 'string') {
			message = Zotero.varDump(message);
		}
		
		if (!level) {
			level = 3;
		}
		
		// If level above debug.level value, don't display
		if (level > _level) {
			return;
		}
		
		var deltaStr = '';
		if (_time || _store) {
			var delta = 0;
			var d = new Date();
			if (_lastTime) {
				delta = d - _lastTime;
			}
			_lastTime = d;
			
			while (("" + delta).length < 7) {
				delta = '0' + delta;
			}
			
			deltaStr = '(+' + delta + ')';
		}
		
		if (_console) {
			dump('zotero(' + level + ')' + (_time ? deltaStr : '') + ': ' + message + "\n\n");
		}
		if (_store) {
			if (Zotero.Utilities.prototype.probability(1000)) {
				// Remove initial lines if over limit
				var overage = this.count() - Zotero.Prefs.get('debug.store.limit');
				if (overage > 0) {
					_output.splice(0, Math.abs(overage));
				}
			}
			_output.push('(' + level + ')' + deltaStr + ': ' + message);
		}
	}
	
	this.get = function () {
		return _output.join('\n\n');
	}
	
	
	this.setStore = function (enable) {
		if (enable) {
			this.clear();
		}
		_store = enable;
	}
	
	
	this.count = function () {
		return _output.length;
	}
	
	
	this.clear = function () {
		_output = [];
	}
}
