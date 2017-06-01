/* global Components:false */
/* eslint-disable no-unused-vars */

var Zotero = Components.classes['@zotero.org/Zotero;1']
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

Components.utils.import('resource://zotero/require.js');