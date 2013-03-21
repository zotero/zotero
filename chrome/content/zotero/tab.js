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
    
    ***** END LICENSE BLOCK *****
*/

/*
 * This object contains the various functions for the interface
 */
var ZoteroTab = new function()
{
	this.onLoad = function() {
		var me = this;
		
		// find window this tab is loaded in
		this.containerWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		   .getInterface(Components.interfaces.nsIWebNavigation)
		   .QueryInterface(Components.interfaces.nsIDocShell)
		   .chromeEventHandler.ownerDocument.defaultView;
		if(!this.containerWindow) return;
		
		var tabs = (this.containerWindow.gBrowser.tabs
					? this.containerWindow.gBrowser.tabs : this.containerWindow.gBrowser.mTabs);
		
		// loop over all browsers in this window
		for(var i=0; i<this.containerWindow.gBrowser.browsers.length; i++) {
			var currentBrowser = this.containerWindow.gBrowser.browsers[i];
			if(currentBrowser.contentWindow == window) {
				// find containerBrowser and containerTab
				this.containerBrowser = currentBrowser;
				this.containerTab = tabs[i];
				continue;
			}
			
			// if we somehow ended up with other Zotero tabs in the window, close them
			if(currentBrowser && ZOTERO_TAB_URL == currentBrowser.currentURI.spec) {
				this.containerWindow.gBrowser.removeTab(tabs[i]);
			}
		}
		
		// stop drop events from propagating
		this.containerBrowser.addEventListener("drop", _dropPropagationKiller, false);
		
		// initialize ZoteroPane and swap out old window ZoteroPane object
		if(this.containerWindow.ZoteroPane) {
			this._swapZoteroPane();
		} else {
			this.containerWindow.addEventListener("load", function() { this._swapZoteroPane() }, false);
		}
		
		// get tab for browser
		if(this.containerWindow.gBrowser.selectedTab === this.containerTab) {
			// if tab is already selected, init now
			ZoteroPane.init();
			ZoteroPane.makeVisible();
		} else {
			// otherwise, add a handler to wait until this tab is selected
			var listener = function(event) {
				if(event.target !== me.containerTab) return;
				me.containerWindow.gBrowser.tabContainer.removeEventListener("TabSelect", listener, false);
				ZoteroPane.init();
				ZoteroPane.makeVisible();
			}
			this.containerWindow.gBrowser.tabContainer.addEventListener("TabSelect", listener, false);
		}
		
		if(Zotero && Zotero.Prefs.get("showIn") != 2) {
			// on Fx 4, add an event listener so the pinned tab isn't restored on close
			var pinnedTabCloser = function() {
				try {
					me.containerWindow.gBrowser.removeTab(me.containerTab);
				} catch(e) {}
			}
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(pinnedTabCloser, "quit-application-requested", false);
			this.containerWindow.addEventListener("close", pinnedTabCloser, false);
		}
	}
	
	this._swapZoteroPane = function() {
		if(!this.containerWindow.ZoteroOverlay.isTab) {
			var tabs = (this.containerWindow.gBrowser.tabs
						? this.containerWindow.gBrowser.tabs : this.containerWindow.gBrowser.mTabs);
			if(tabs.length > 1) {
				window.close();
			} else {
				if(tabs[0].pinned) this.containerWindow.gBrowser.unpinTab(tabs[0]);
				document.location.replace(this.containerWindow.gHomeButton.getHomePage());
			}
			return;
		}
		
		this.containerWindow.ZoteroPane_Overlay = this.containerWindow.ZoteroPane;
		this.containerWindow.ZoteroPane_Tab = ZoteroPane;
		this.containerWindow.ZoteroPane = ZoteroPane;
	}
	
	this.onUnload = function() {
		// remove drop propagation killer
		this.containerBrowser.removeEventListener("drop", _dropPropagationKiller, false);
		
		// replace window ZoteroPane
		if(this.containerWindow.ZoteroPane === this.containerWindow.ZoteroPane_Tab) {
			this.containerWindow.ZoteroPane = this.containerWindow.ZoteroPane_Overlay;
		}
		delete this.containerWindow.ZoteroPane_Tab;
		
		// destroy pane
		ZoteroPane.destroy();
	}
	
	function _dropPropagationKiller(event) {
		event.stopPropagation();
		event.preventDefault();
	}
}

window.addEventListener("load", function(e) { ZoteroTab.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroTab.onUnload(e); }, false);
