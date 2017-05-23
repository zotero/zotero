/* global Components:false */
/* eslint-disable no-unused-vars */

var Zotero = Components.classes['@zotero.org/Zotero;1']
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;


var require = (function() {
	var { Loader, Require, Module } = Components.utils.import('resource://gre/modules/commonjs/toolkit/loader.js');
	var requirer = Module('/', '/');

	var loader = Loader({
		id: 'zotero/require',
		paths: {
			'': 'resource://zotero/',
		},
		globals: {
			document,
			console,
			navigator,
			window,
			Zotero
		}
	});

	return Require(loader, requirer);
})();