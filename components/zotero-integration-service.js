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

const nsISupports           = Components.interfaces.nsISupports;
const nsICategoryManager    = Components.interfaces.nsICategoryManager;
const nsIComponentRegistrar = Components.interfaces.nsIComponentRegistrar;
const nsICommandLine        = Components.interfaces.nsICommandLine;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIModule             = Components.interfaces.nsIModule;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;

const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=zotero-integration";
const clh_CID = Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}");
const clh_category = "m-zotero-integration";
const clh_description = "Zotero Integration Command Line Handler";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 */
function ZoteroIntegrationCommandLineHandler() {}
ZoteroIntegrationCommandLineHandler.prototype = {
	Zotero : null,
	
	/* nsISupports */
	QueryInterface : function(iid) {
		if(iid.equals(nsICommandLineHandler) ||
			iid.equals(nsIFactory) ||
			iid.equals(nsISupports)) return this;
		throw Components.results.NS_ERROR_NO_INTERFACE;
	},
	
	/* nsICommandLineHandler */
	handle : function(cmdLine) {
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
		var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
		if(agent && command) {
			if(!this.Zotero) this.Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports).wrappedJSObject;
			var Zotero = this.Zotero;
			// Not quite sure why this is necessary to get the appropriate scoping
			var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			timer.initWithCallback({notify:function() { Zotero.Integration.execCommand(agent, command, docId) }}, 0,
				Components.interfaces.nsITimer.TYPE_ONE_SHOT);
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

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ZoteroIntegrationCommandLineHandler]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([ZoteroIntegrationCommandLineHandler]);
}