/* global Components:false */
/* eslint-disable no-unused-vars */

var Zotero = Components.classes['@zotero.org/Zotero;1']
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

// Components.utils.import('resource://zotero/require.js');
// Not using Cu.import here since we don't want the require module to be cached
// for includes within ZoteroPane or other code, where we want the window
// instance available to modules.
// However, doing this unsets `window.name` (and possibly other window props)
// so we're manually handling it here
var winName;
if (typeof window != 'undefined') {
	winName = window.name;
}
Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Components.interfaces.mozIJSSubScriptLoader)
	.loadSubScript('resource://zotero/require.js');

if (winName) {
	window.name = winName;
}