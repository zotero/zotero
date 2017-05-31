'use strict';

var EXPORTED_SYMBOLS = ['require'];

var require = (function() {
	var { Loader, Require, Module } = Components.utils.import('resource://gre/modules/commonjs/toolkit/loader.js');
	var requirer = Module('/', '/');
	var _runningTimers = {};

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
			Zotero: typeof Zotero !== 'undefined' && Zotero || {} 
		}
	});

	return Require(loader, requirer);
})();