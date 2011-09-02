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


Zotero.Debug = new function () {
	this.__defineGetter__('storing', function () _store);
	this.__defineGetter__('enabled', function () _console || _store);
	
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
			if (Math.random() < 1/1000) {
				// Remove initial lines if over limit
				var overage = this.count() - Zotero.Prefs.get('debug.store.limit');
				if (overage > 0) {
					_output.splice(0, Math.abs(overage));
				}
			}
			_output.push('(' + level + ')' + deltaStr + ': ' + message);
		}
	}
	
	
	this.get = function (maxChars, maxLineLength) {
		var output = _output;
		var total = output.length;
		
		if (total == 0) {
			return "";
		}
		
		if (maxLineLength) {
			for (var i=0, len=output.length; i<len; i++) {
				if (output[i].length > maxLineLength) {
					output[i] = Zotero.Utilities.ellipsize(output[i], maxLineLength, true);
				}
			}
		}
		
		output = output.join('\n\n');
		
		if (maxChars) {
			output = output.substr(maxChars * -1);
			// Cut at two newlines
			for (var i=1, len=output.length; i<len; i++) {
				if (output[i] == '\n' && output[i-1] == '\n') {
					output = output.substr(i + 1);
					break;
				}
			}
		}
		
		return output;
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
