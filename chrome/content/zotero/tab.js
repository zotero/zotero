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
		var enumerator = windowMediator.getZOrderDOMWindowEnumerator("navigator:browser", true);
		while(enumerator.hasMoreElements()) {
			var window = enumerator.getNext();
			var browserIndex = window.gBrowser.getBrowserIndexForDocument(document);
			if(browserIndex !== -1) break;
		}
		if(browserIndex === -1) return;
		
		// initialize ZoteroPane and swap out old window ZoteroPane object
		ZoteroPane.init();
		
		// swap window ZoteroPane with ZoteroPane from tab
		window.ZoteroPane_Overlay = window.ZoteroPane;
		window.ZoteroPane_Tab = ZoteroPane;
		window.ZoteroPane = ZoteroPane;
		
		// get tab for browser
		var tab = window.gBrowser.tabs[browserIndex];
		if(window.gBrowser.selectedTab === tab) {
			// if tab is already selected, init now
			ZoteroPane.makeVisible();
		} else {
			// otherwise, add a handler to wait until this tab is selected
			var listener = function(event) {
				if(event.target !== tab) return;
				window.gBrowser.tabContainer.removeEventListener("TabSelect", listener, false);
				ZoteroPane.makeVisible();
			}
			window.gBrowser.tabContainer.addEventListener("TabSelect", listener, false);
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