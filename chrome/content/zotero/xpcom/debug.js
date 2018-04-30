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
	var _console, _stackTrace, _store, _level, _lastTime, _output = [];
	var _slowTime = false;
	var _colorOutput = false;
	var _consoleViewer = false;
	var _consoleViewerQueue = [];
	var _consoleViewerListener;
	
	/**
	 * Initialize debug logging
	 *
	 * Debug logging can be set in several different ways:
	 *
	 *   - via the debug.log pref in the client or connector
	 *   - by enabling debug output logging from the Help menu
	 *   - by passing -ZoteroDebug or -ZoteroDebugText on the command line
	 *
	 * In the client, debug.log and -ZoteroDebugText enable logging via the terminal, while -ZoteroDebug
	 * enables logging via an in-app HTML-based window.
	 *
	 * @param {Integer} [forceDebugLog = 0] - Force output even if pref disabled
	 *    2: window (-ZoteroDebug)
	 *    1: text console (-ZoteroDebugText)
	 *    0: disabled
	 */
	this.init = function (forceDebugLog = 0) {
		_console = Zotero.Prefs.get('debug.log') || forceDebugLog == 1;
		_consoleViewer = forceDebugLog == 2;
		// When logging to the text console from the client on Mac/Linux, colorize output
		if (_console && Zotero.isFx && !Zotero.isBookmarklet) {
			_colorOutput = true;
			
			// Time threshold in ms above which intervals should be colored red in terminal output
			_slowTime = Zotero.Prefs.get('debug.log.slowTime');
		}
		_store = Zotero.Prefs.get('debug.store');
		if (_store) {
			Zotero.Prefs.set('debug.store', false);
		}
		_level = Zotero.Prefs.get('debug.level');
		_stackTrace = Zotero.Prefs.get('debug.stackTrace');
		
		this.storing = _store;
		this.updateEnabled();
		
		if (Zotero.isStandalone) {
			// Enable dump() from window (non-XPCOM) scopes when terminal or viewer logging is enabled.
			// (These will always go to the terminal, even in viewer mode.)
			Zotero.Prefs.set('browser.dom.window.dump.enabled', _console || _consoleViewer, true);
			
			if (_consoleViewer) {
				setTimeout(function () {
					Zotero.openInViewer("chrome://zotero/content/debugViewer.html");
				}, 1000);
			}
		}
	}
	
	this.log = function (message, level, maxDepth, stack) {
		if (!this.enabled) {
			return;
		}
		
		if (typeof message != 'string') {
			message = Zotero.Utilities.varDump(message, 0, maxDepth);
		}
		
		if (!level) {
			level = 3;
		}
		
		// If level above debug.level value, don't display
		if (level > _level) {
			return;
		}
		
		var deltaStr = '';
		var deltaStrStore = '';
		var delta = 0;
		var d = new Date();
		if (_lastTime) {
			delta = d - _lastTime;
		}
		_lastTime = d;
		var slowPrefix = "";
		var slowSuffix = "";
		if (_slowTime && delta > _slowTime) {
			slowPrefix = "\x1b[31;40m";
			slowSuffix = "\x1b[0m";
		}
		
		delta = ("" + delta).padStart(7, "0")
		
		deltaStr = "(" + slowPrefix + "+" + delta + slowSuffix + ")";
		if (_store) {
			deltaStrStore = "(+" + delta + ")";
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
			message += '\n' + this.stackToString(stack);
		}
		
		if (_console || _consoleViewer) {
			var output = '(' + level + ')' + deltaStr + ': ' + message;
			if (Zotero.isFx && !Zotero.isBookmarklet) {
				// Text console
				if (_console) {
					dump("zotero" + output + "\n\n");
				}
				// Console window
				if (_consoleViewer) {
					// Remove ANSI color codes. We could replace this with HTML, but it's probably
					// unnecessarily distracting/alarming to show the red in the viewer. Devs who care
					// about times should just use a terminal.
					if (slowPrefix) {
						output = output.replace(slowPrefix, '').replace(slowSuffix, '');
					}
					
					// If there's a listener, pass line immediately
					if (_consoleViewerListener) {
						_consoleViewerListener(output);
					}
					// Otherwise add to queue
					else {
						_consoleViewerQueue.push(output);
					}
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
			_output.push('(' + level + ')' + deltaStrStore + ': ' + message);
		}
	}
	
	
	this.get = Zotero.Promise.method(function(maxChars, maxLineLength) {
		var output = _output;
		var total = output.length;
		
		if (total == 0) {
			return "";
		}
		
		if (maxLineLength) {
			for (var i=0, len=output.length; i<len; i++) {
				if (output[i].length > maxLineLength) {
					output[i] = Zotero.Utilities.ellipsize(output[i], maxLineLength, false, true);
				}
			}
		}
		
		output = output.join('\n\n');
		
		if (maxChars) {
			output = output.substr(maxChars * -1);
			// Cut at two newlines
			let matches = output.match(/^[\n]*\n\n/);
			if (matches) {
				output = output.substr(matches[0].length);
			}
		}

		return Zotero.getSystemInfo().then(function(sysInfo) {
			if (Zotero.isConnector) {
				return Zotero.Errors.getErrors().then(function(errors) {
					return errors.join('\n\n') +
						"\n\n" + sysInfo + "\n\n" +
						"=========================================================\n\n" +
						output;	
				});
			}
			else {
				return Zotero.getErrors(true).join('\n\n') +
					"\n\n" + sysInfo + "\n\n" +
					"=========================================================\n\n" +
					output;
			}
		});
	});
	
	
	this.getConsoleViewerOutput = function () {
		var queue = _output.concat(_consoleViewerQueue);
		_consoleViewerQueue = [];
		return queue;
	}
	
	
	this.addConsoleViewerListener = function (listener) {
		this.enabled = _consoleViewer = true;
		_consoleViewerListener = listener;
	};
	
	
	this.removeConsoleViewerListener = function () {
		_consoleViewerListener = null;
		// At least for now, stop logging once console viewer is closed
		_consoleViewer = false;
		this.updateEnabled();
	};
	
	
	this.setStore = function (enable) {
		if (enable) {
			this.clear();
		}
		_store = enable;
		this.updateEnabled();
		this.storing = _store;
	}
	
	
	this.updateEnabled = function () {
		this.enabled = _console || _consoleViewer || _store;
	};
	
	
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
		return this.filterStack(str).substr(1);
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
