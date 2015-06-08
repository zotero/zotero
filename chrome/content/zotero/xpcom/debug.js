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
	var _console, _consolePref, _stackTrace, _store, _level, _time, _lastTime, _output = [];
	
	this.init = function (forceDebugLog) {
		_consolePref = Zotero.Prefs.get('debug.log');
		_console = _consolePref || forceDebugLog;
		_store = Zotero.Prefs.get('debug.store');
		if (_store) {
			Zotero.Prefs.set('debug.store', false);
		}
		_level = Zotero.Prefs.get('debug.level');
		_time = forceDebugLog || Zotero.Prefs.get('debug.time');
		_stackTrace = Zotero.Prefs.get('debug.stackTrace');
		
		this.storing = _store;
		this.enabled = _console || _store;
	}
	
	this.log = function (message, level, stack) {
		if (!_console && !_store) {
			return;
		}
		
		if (typeof message != 'string') {
			message = Zotero.Utilities.varDump(message);
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
		
		if (stack === true) {
			// Display stack starting from where this was called
			stack = Components.stack.caller;
		} else if (stack >= 0) {
			let i = stack;
			stack = Components.stack.caller;
			while(stack && i--) {
				stack = stack.caller;
			}
		} else if (_stackTrace) {
			// Stack trace enabled globally
			stack = Components.stack.caller;
		} else {
			stack = undefined;
		}
		
		if (stack) {
			message += '\n' + Zotero.Debug.stackToString(stack);
		}
		
		if (_console) {
			var output = 'zotero(' + level + ')' + (_time ? deltaStr : '') + ': ' + message;
			if(Zotero.isFx && !Zotero.isBookmarklet) {
				// On Windows, where the text console (-console) is inexplicably glacial,
				// log to the Browser Console instead if only the -ZoteroDebug flag is used.
				// Developers can use the debug.log/debug.time prefs and the Cygwin text console.
				//
				// TODO: Get rid of the filename and line number
				if (!_consolePref && Zotero.isWin && !Zotero.isStandalone) {
					var console = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
					console.log(output);
				}
				// Otherwise dump to the text console
				else {
					dump(output + "\n\n");
				}
			} else if(window.console) {
				window.console.log(output);
			}
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
		
		if(Zotero.getErrors) {
			return Zotero.getErrors(true).join('\n\n') +
					"\n\n" + Zotero.getSystemInfo() + "\n\n" +
					"=========================================================\n\n" +
					output;
		} else {
			return output;
		}
	}
	
	
	this.setStore = function (enable) {
		if (enable) {
			this.clear();
		}
		_store = enable;
		
		this.storing = _store;
		this.enabled = _console || _store;
	}
	
	
	this.count = function () {
		return _output.length;
	}
	
	
	this.clear = function () {
		_output = [];
	}
	
	/**
	 * Format a stack trace for output in the same way that Error.stack does
	 * @param {Components.stack} stack
	 * @param {Integer} [lines=5] Number of lines to format
	 */
	this.stackToString = function (stack, lines) {
		if (!lines) lines = 5;
		var str = '';
		while(stack && lines--) {
			str += '\n  ' + (stack.name || '') + '@' + stack.filename
				+ ':' + stack.lineNumber;
			stack = stack.caller;
		}
		return str.substr(1);
	};
	
	
	/**
	 * Strip Bluebird lines from a stack trace
	 *
	 * @param {String} stack
	 */
	this.filterStack = function (stack) {
		return stack.split(/\n/).filter(line => line.indexOf('zotero/bluebird') == -1).join('\n');
	}
}
