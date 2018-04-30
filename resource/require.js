'use strict';

var EXPORTED_SYMBOLS = ['require'];

var require = (function() {
	var { Loader, Require, Module } = Components.utils.import('resource://gre/modules/commonjs/toolkit/loader.js');
	var requirer = Module('/', '/');
	var _runningTimers = {};
	var window = {};

	window.setTimeout = function (func, ms) {
		var id = Math.floor(Math.random() * (1000000000000 - 1)) + 1
		var useMethodjit = Components.utils.methodjit;
		var timer = Components.classes["@mozilla.org/timer;1"]
			.createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback({"notify":function() {
			// Remove timer from object so it can be garbage collected
			delete _runningTimers[id];
			
			// Execute callback function
			try {
				func();
			} catch(err) {
				// Rethrow errors that occur so that they appear in the error
				// console with the appropriate name and line numbers. While the
				// the errors appear without this, the line numbers get eaten.
				var scriptError = Components.classes["@mozilla.org/scripterror;1"]
					.createInstance(Components.interfaces.nsIScriptError);
				scriptError.init(
					err.message || err.toString(),
					err.fileName || err.filename || null,
					null,
					err.lineNumber || null,
					null,
					scriptError.errorFlag,
					'component javascript'
				);
				Components.classes["@mozilla.org/consoleservice;1"]
					.getService(Components.interfaces.nsIConsoleService)
					.logMessage(scriptError);
				typeof Zotero !== 'undefined' && Zotero.debug(err.stack, 1);
			}
		}}, ms, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		_runningTimers[id] = timer;
		return id;
	};
	
	window.clearTimeout = function (id) {
		var timer = _runningTimers[id];
		if (timer) {
			timer.cancel();
		}
		delete _runningTimers[id];
	};

	window.debug = function (msg) {
		dump(msg + "\n\n");
	};

	var loader = Loader({
		id: 'zotero/require',
		paths: {
			'': 'resource://zotero/',
		},
		globals: {
			document: typeof document !== 'undefined' && document || {},
			console: typeof console !== 'undefined' && console || {},
			navigator: typeof navigator !== 'undefined' && navigator || {},
			window,
			setTimeout: window.setTimeout,
			clearTimeout: window.clearTimeout,
			Zotero: typeof Zotero !== 'undefined' && Zotero || {} 
		}
	});

	return Require(loader, requirer);
})();