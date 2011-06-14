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
    
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
	
    ***** END LICENSE BLOCK *****
*/

/*
	Based on nsICommandLineHandler example code at
	https://developer.mozilla.org/en/Chrome/Command_Line
*/

const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=zotero";
const clh_CID = Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}");
const clh_category = "m-zotero";
const clh_description = "Zotero Command Line Handler";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 */
function ZoteroCommandLineHandler() {}
ZoteroCommandLineHandler.prototype = {
	/* nsISupports */
	QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
			Components.interfaces.nsIFactory, Components.interfaces.nsISupports]),
	
	/* nsICommandLineHandler */
	handle : function(cmdLine) {
		// handler for Zotero integration commands
		// this is typically used on Windows only, via WM_COPYDATA rather than the command line
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		if(agent) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			
			var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
			var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
			
			// Not quite sure why this is necessary to get the appropriate scoping
			var Zotero = this.Zotero;
			var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			timer.initWithCallback({notify:function() { Zotero.Integration.execCommand(agent, command, docId) }}, 0,
				Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		}
		
		// handler for Windows IPC commands
		var param = cmdLine.handleFlagWithParam("ZoteroIPC", false);
		if(param) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			this.Zotero.IPC.parsePipeInput(param);
		}
		
		// special handler for "zotero" URIs at the command line to prevent them from opening a new
		// window
		if(this.Zotero.isStandalone) {
			var param = cmdLine.handleFlagWithParam("url", false);
			if(param) {
				var uri = cmdLine.resolveURI(param);
				if(uri.schemeIs("zotero")) {
					// Don't open a new window
					cmdLine.preventDefault = true;
					
					Components.classes["@mozilla.org/network/protocol;1?name=zotero"]
							.createInstance(Components.interfaces.nsIProtocolHandler).newChannel(uri);
				}
			}
		}
	},
	
	classDescription: clh_description,
	classID: clh_CID,
	contractID: clh_contractID,
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:clh_category}],
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
	                                       Components.interfaces.nsISupports])
};

ZoteroCommandLineHandler.prototype.__defineGetter__("Zotero", function() {
	if(!this._Zotero) {
		this._Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports).wrappedJSObject;
	}
	return this._Zotero;
});

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroCommandLineHandler]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([ZoteroCommandLineHandler]);
}