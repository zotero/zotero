var EXPORTED_SYMBOLS = ["Zotero"];

var Zotero = Components.classes['@zotero.org/Zotero;1']
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;
