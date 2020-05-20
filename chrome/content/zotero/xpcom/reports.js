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

Zotero.Errors = new function () {
	// Errors that were in the console at startup
	var _startupErrors = [];
	// Number of errors to maintain in the recent errors buffer
	const ERROR_BUFFER_SIZE = 25;
	// A rolling buffer of the last ERROR_BUFFER_SIZE errors
	var _recentErrors = [];
	
	/**
	 * Determines whether to keep an error message so that it can (potentially) be reported later
	 */
	function _shouldKeepError(msg) {
		const skip = ['CSS Parser', 'content javascript'];
		
		//Zotero.debug(msg);
		try {
			msg.QueryInterface(Components.interfaces.nsIScriptError);
			//Zotero.debug(msg);
			if (skip.indexOf(msg.category) != -1 || msg.flags & msg.warningFlag) {
				return false;
			}
		}
		catch (e) { }
		
		const blacklist = [
			"No chrome package registered for chrome://communicator",
			'[JavaScript Error: "Components is not defined" {file: "chrome://nightly/content/talkback/talkback.js',
			'[JavaScript Error: "document.getElementById("sanitizeItem")',
			'No chrome package registered for chrome://piggy-bank',
			'[JavaScript Error: "[Exception... "\'Component is not available\' when calling method: [nsIHandlerService::getTypeFromExtension',
			'[JavaScript Error: "this._uiElement is null',
			'Error: a._updateVisibleText is not a function',
			'[JavaScript Error: "Warning: unrecognized command line flag ',
			'LibX:',
			'function skype_',
			'[JavaScript Error: "uncaught exception: Permission denied to call method Location.toString"]',
			'CVE-2009-3555',
			'OpenGL',
			'trying to re-register CID',
			'Services.HealthReport',
			'[JavaScript Error: "this.docShell is null"',
			'[JavaScript Error: "downloadable font:',
			'[JavaScript Error: "Image corrupt or truncated:',
			'[JavaScript Error: "The character encoding of the',
			'nsLivemarkService.js',
			'Sync.Engine.Tabs',
			'content-sessionStore.js',
			'org.mozilla.appSessions',
			'bad script XDR magic number',
			'did not contain an updates property',
		];
		
		for (var i=0; i<blacklist.length; i++) {
			if (msg.message.indexOf(blacklist[i]) != -1) {
				//Zotero.debug("Skipping blacklisted error: " + msg.message);
				return false;
			}
		}
		
		return true;
	}
	
	this.init = function () {
		// Get startup errors
		try {
			var messages = {};
			Services.console.getMessageArray(messages, {});
			_startupErrors = Object.keys(messages.value).map(i => messages[i])
				.filter(msg => _shouldKeepError(msg));
		}
		catch (e) {
			Zotero.logError(e);
		}

		/**
		 * Observer for console messages
		 * @namespace
		 */
		var ConsoleListener = {
			"QueryInterface":XPCOMUtils.generateQI([Components.interfaces.nsIConsoleMessage,
				Components.interfaces.nsISupports]),
			"observe":function(msg) {
				if(!_shouldKeepError(msg)) return;
				if(_recentErrors.length === ERROR_BUFFER_SIZE) _recentErrors.shift();
				_recentErrors.push(msg);
			}
		};

		// Register error observer
		Services.console.registerListener(ConsoleListener);
		
		// Add shutdown listener to remove quit-application observer and console listener
		Zotero.addShutdownListener(function() {
			Services.console.unregisterListener(ConsoleListener);
		});
	};
	
	this.getErrors = function (asStrings) {
		var errors = [];

		for (let msg of _startupErrors.concat(_recentErrors)) {
			let altMessage;
			// Remove password in malformed XML errors
			if (msg.category == 'malformed-xml') {
				try {
					// msg.message is read-only, so store separately
					altMessage = msg.message.replace(/(https?:\/\/[^:]+:)([^@]+)(@[^"]+)/, "$1****$3");
				}
				catch (e) {}
			}

			if (asStrings) {
				errors.push(altMessage || msg.message);
			}
			else {
				errors.push(msg);
			}
		}
		return errors;
	};
	
	this.showReportDialog = function () {
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				   .getService(Components.interfaces.nsIWindowWatcher);
		var data = {
			msg: Zotero.getString('errorReport.followingReportWillBeSubmitted'),
		};
		var io = { wrappedJSObject: { Zotero: Zotero, data: data } };
		var win = ww.openWindow(null, "chrome://zotero/content/errorReport.xul",
					"zotero-error-report", "chrome,centerscreen,modal", io);
	};
	
	
	this.generateReport = async function () {
		let sysInfo = await Zotero.getSystemInfo();
		let errors = await this.getErrors();
		errors = errors.length ? "\n\n" + errors.join('\n\n') : "";
		return sysInfo + errors;
	};

	this.submitToZotero = async function (debug) {
		var headers = { 'Content-Type': 'text/plain' };
		var url;
		var body;
		if (debug) {
			url = ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1";
			body = await Zotero.Debug.get(
				Zotero.Prefs.get('debug.store.submitSize'),
				Zotero.Prefs.get('debug.store.submitLineLength')
			);
		}
		else {
			// TODO: change to non-debug URL once that is supported
			url = ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1";
			body = await this.generateReport();
		}
		
		try {
			var xmlhttp = await Zotero.HTTP.request(
				"POST",
				url,
				{
					compressBody: true,
					body,
					headers,
					logBodyLength: 30,
					timeout: 15000,
					requestObserver: function (req) {
						// Don't fail during tests, with fake XHR
						if (!req.channel) {
							return;
						}
						req.channel.notificationCallbacks = {
							onProgress: function (request, context, progress, progressMax) {},
							
							// nsIInterfaceRequestor
							getInterface: function (iid) {
								try {
									return this.QueryInterface(iid);
								}
								catch (e) {
									throw Components.results.NS_NOINTERFACE;
								}
							},
							
							QueryInterface: function (iid) {
								if (iid.equals(Components.interfaces.nsISupports) ||
										iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
										iid.equals(Components.interfaces.nsIProgressEventSink)) {
									return this;
								}
								throw Components.results.NS_NOINTERFACE;
							},
						};
					}
				}
			);
		}
		catch (e) {
			Zotero.logError(e);
			if (e instanceof Zotero.HTTP.BrowserOfflineException) {
				throw new Error(Zotero.getString('general.browserIsOffline', Zotero.appName));
			}
			throw new Error(Zotero.getString('general.invalidResponseServer'));
		}
		
		Zotero.debug(xmlhttp.responseText);
		
		var reported = xmlhttp.responseXML.getElementsByTagName('reported');
		if (reported.length != 1) {
			throw new Error(Zotero.getString('errorReport.invalidResponseServer'));
		}
		
		var reportID = reported[0].getAttribute('reportID');
		
		if (debug) {
			return 'D' + reportID;
		}
		// TODO: remove the D once endpoint is updated for reports
		return 'D' + reportID;
	};
};

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
	};
	
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
		
		delta = ("" + delta).padStart(7, "0");
		
		deltaStr = "(" + slowPrefix + "+" + delta + slowSuffix + ")";
		if (_store) {
			deltaStrStore = "(+" + delta + ")";
		}
		
		if (stack === true) {
			// Display stack starting from where this was called
			stack = Components.stack.caller;
		}
		else if (stack >= 0) {
			let i = stack;
			stack = Components.stack.caller;
			while (stack && i--) {
				stack = stack.caller;
			}
		}
		else if (_stackTrace) {
			// Stack trace enabled globally
			stack = Components.stack.caller;
		}
		else {
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
			}
			else if (window.console) {
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
	};
	
	
	this.get = async function (maxChars, maxLineLength) {
		var output = _output;
		
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

		let errors = await Zotero.Errors.generateReport();
		return [errors,
			"---------------------------------------------------------",
			output].join("\n\n");
	};
	
	
	this.getConsoleViewerOutput = function () {
		var queue = _output.concat(_consoleViewerQueue);
		_consoleViewerQueue = [];
		return queue;
	};
	
	
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
	};
	
	
	this.updateEnabled = function () {
		this.enabled = _console || _consoleViewer || _store;
	};
	
	
	this.count = function () {
		return _output.length;
	};
	
	
	this.clear = function () {
		_output = [];
	};
	
	/**
	 * Format a stack trace for output in the same way that Error.stack does
	 * @param {Components.stack} stack
	 * @param {Integer} [lines=5] Number of lines to format
	 */
	this.stackToString = function (stack, lines) {
		if (!lines) lines = 5;
		var str = '';
		while (stack && lines--) {
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
	};
	
	this.submitToZotero = async function () {
		Zotero.debug("Submitting debug output");

		Zotero.Debug.setStore(false);
		let debugID = await Zotero.Errors.submitToZotero(true);
		Zotero.Debug.clear(true);
		return debugID;
	};
};
