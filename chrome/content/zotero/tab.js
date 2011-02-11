/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/*
 * This object contains the various functions for the interface
 */
var ZoteroTab = new function()
{
	this.onLoad = function() {
		// find window this tab is loaded in
		var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									   .getService(Components.interfaces.nsIWindowMediator);
		var enumerator = windowMediator.getXULWindowEnumerator("navigator:browser");
		while(enumerator.hasMoreElements()) {
			var xulwin = enumerator.getNext().QueryInterface(Components.interfaces.nsIXULWindow);
			var window = xulwin.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(Components.interfaces.nsIDOMWindow);
			var browserIndex = window.gBrowser.getBrowserIndexForDocument(document);
			if(browserIndex !== -1) break;
		}
		
		if(browserIndex === -1) return;
		
		this.containerWindow = window;
		this.containerBrowser = window.gBrowser.browsers[browserIndex];
		
		// if we somehow ended up with other Zotero tabs in the window, close them
		var numTabs = window.gBrowser.browsers.length;
		for(var index = 0; index < numTabs; index++) {
			if(index === browserIndex) continue;
			
			var currentBrowser = window.gBrowser.browsers[index];
			if(currentBrowser && ZOTERO_TAB_URL == currentBrowser.currentURI.spec) {
				window.gBrowser.removeTab((window.gBrowser.tabs ? window.gBrowser.tabs : window.gBrowser.mTabs)[index]);
			}
		}
		
		// initialize ZoteroPane and swap out old window ZoteroPane object
		if(window.ZoteroPane) {
			window.ZoteroPane_Overlay = window.ZoteroPane;
			window.ZoteroPane_Tab = ZoteroPane;
			window.ZoteroPane = ZoteroPane;
		} else {
			window.addEventListener("load", function() {
				window.ZoteroPane_Overlay = window.ZoteroPane;
				window.ZoteroPane_Tab = ZoteroPane;
				window.ZoteroPane = ZoteroPane;
			}, false);
		}
		
		// get tab for browser
		var tab = (window.gBrowser.tabs ? window.gBrowser.tabs : window.gBrowser.mTabs)[browserIndex];
		if(window.gBrowser.selectedTab === tab) {
			// if tab is already selected, init now
			ZoteroPane.init();
			ZoteroPane.makeVisible();
		} else {
			// otherwise, add a handler to wait until this tab is selected
			var listener = function(event) {
				if(event.target !== tab) return;
				window.gBrowser.tabContainer.removeEventListener("TabSelect", listener, false);
				if(!Zotero || !Zotero.initialized) {
					ZoteroPane.displayStartupError(true);
					return;
				}
				ZoteroPane.init();
				ZoteroPane.makeVisible();
			}
			window.gBrowser.tabContainer.addEventListener("TabSelect", listener, false);
		}
		
		if(Zotero && Zotero.isFx4) {
			// on Fx 4, add an event listener so the pinned tab isn't restored on close
			var pinnedTabCloser = function() {
				try {
					window.gBrowser.removeTab(tab);
				} catch(e) {}
			}
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(pinnedTabCloser, "quit-application-requested", false);
			window.addEventListener("close", pinnedTabCloser, false);
		}
	}
	
	this.onUnload = function() {
		if(window.ZoteroPane === window.ZoteroPane_Tab) {
			window.ZoteroPane = window.ZoteroPane_Overlay;
		}
		delete window.ZoteroPane_Tab;
		ZoteroPane.destroy();
	}
}

window.addEventListener("load", function(e) { ZoteroTab.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroTab.onUnload(e); }, false);
