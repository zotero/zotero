var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

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
if (typeof require == "undefined") {
	Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader)
		.loadSubScript('resource://zotero/require.js');
}

if (winName) {
	 window.name = winName;
}
