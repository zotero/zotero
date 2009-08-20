/*
    ***** BEGIN LICENSE BLOCK *****
	
	Copyright (c) 2009  Zotero
						Center for History and New Media
						George Mason University, Fairfax, Virginia, USA
						http://zotero.org
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Based on nsICommandLineHandler example code at
	https://developer.mozilla.org/en/Chrome/Command_Line
    
    ***** END LICENSE BLOCK *****
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
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
const ZoteroIntegrationCommandLineHandler = {
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
		if(agent && command) {
			if(!this.Zotero) this.Zotero = Components.classes["@zotero.org/Zotero;1"]
				.getService(Components.interfaces.nsISupports).wrappedJSObject;
			var Zotero = this.Zotero;
			// Not quite sure why this is necessary to get the appropriate scoping
			var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			timer.initWithCallback({notify:function() { Zotero.Integration.execCommand(agent, command) }}, 0,
				Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		}
	},
	
	/* nsIFactory */
	createInstance : function(outer, iid) {
		if (outer != null) throw Components.results.NS_ERROR_NO_AGGREGATION;
		return this.QueryInterface(iid);
	},
	
	lockFactory : function(lock) {
		/* no-op */
	}
};

/**
 * The XPCOM glue that implements nsIModule
 */
const ZoteroIntegrationModule = {
	/* nsISupports */
	QueryInterface : function(iid) {
		if(iid.equals(nsIModule) || iid.equals(nsISupports)) return this;
		throw Components.results.NS_ERROR_NO_INTERFACE;
	},
	
	/* nsIModule */
	getClassObject : function(compMgr, cid, iid) {
		if(cid.equals(clh_CID)) return ZoteroIntegrationCommandLineHandler.QueryInterface(iid);
		throw Components.results.NS_ERROR_NOT_REGISTERED;
	},
	
	registerSelf : function(compMgr, fileSpec, location, type) {
		compMgr.QueryInterface(nsIComponentRegistrar);
		
		compMgr.registerFactoryLocation(clh_CID,
										"myAppHandler",
										clh_contractID,
										fileSpec,
										location,
										type);
		
		var catMan = Components.classes["@mozilla.org/categorymanager;1"].
		  getService(nsICategoryManager);
		catMan.addCategoryEntry("command-line-handler",
								clh_category,
								clh_contractID, true, true);
	},
	
	unregisterSelf : function(compMgr, location, type) {
		compMgr.QueryInterface(nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(clh_CID, location);
		
		var catMan = Components.classes["@mozilla.org/categorymanager;1"].
		  getService(nsICategoryManager);
		catMan.deleteCategoryEntry("command-line-handler", clh_category);
	},
	
	canUnload : function (compMgr) {
		return true;
	}
};

/* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
 * this component provides
 */
function NSGetModule(comMgr, fileSpec){ return ZoteroIntegrationModule; }
