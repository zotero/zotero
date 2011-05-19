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
var ZoteroOverlay = new function()
{
	const DEFAULT_ZPANE_HEIGHT = 300;
	var toolbarCollapseState, isFx36, showInPref;
	
	this.isTab = false;
	
	this.onLoad = function() {
		ZoteroPane_Overlay = ZoteroPane;
		ZoteroPane.init();
		
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
						.getService(Components.interfaces.nsIXULAppInfo);
		isFx36 = appInfo.platformVersion.indexOf('1.9') === 0;
		
		// Open Zotero app tab, if in Fx 4 and requested by pref
		showInPref = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefService)
							.getBranch('extensions.zotero.').getIntPref('showIn');
		this.isTab = showInPref === 2;
		if(!isFx36) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			var zoteroObserver = function(subject, topic, data) {
				if(subject != window) return;
				observerService.removeObserver(this, "browser-delayed-startup-finished");
				if(showInPref === 2) {
					var tabbar = document.getElementById("TabsToolbar");
					if(tabbar && window.getComputedStyle(tabbar).display !== "none") {
						// load Zotero as a tab, if it isn't loading by default
						ZoteroOverlay.loadZoteroTab(true);
					}
				} else {
					// close Zotero as a tab, in case it was pinned
					var zoteroTab = ZoteroOverlay.findZoteroTab();
					if(zoteroTab) gBrowser.removeTab(zoteroTab);
				}
			};
			
			observerService.addObserver(zoteroObserver, "browser-delayed-startup-finished", false);
		}
		
		// Make Zotero icon visible, if requested
		var iconPref = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefService)
							.getBranch('extensions.zotero.').getIntPref('statusBarIcon');
		
		var fx36Icon = document.getElementById('zotero-status-bar-icon');
		var addonBar = document.getElementById('addon-bar');
		
		// Status bar in Fx3.6
		if (isFx36) {
			var icon = fx36Icon;
		}
		// In >=Fx4, add to add-on bar
		else {
			// add Zotero icon
			var icon = document.createElement('toolbarbutton');
			icon.id = 'zotero-addon-bar-icon';
			icon.setAttribute('oncommand', 'ZoteroOverlay.toggleDisplay()');
			icon.setAttribute('hidden', true);
			addonBar.appendChild(icon);
			if (addonBar.collapsed) {
				// If no Zotero or icon isn't set to hidden, show add-on bar
				if (iconPref != 0) {
					setToolbarVisibility(addonBar, true);
				}
			}
		}
		
		if (Zotero && Zotero.initialized){
			document.getElementById('appcontent').addEventListener('mousemove', Zotero.ProgressWindowSet.updateTimers, false);
			switch (iconPref) {
				case 2:
					icon.setAttribute('hidden', false);
					break;
				case 1:
					icon.setAttribute('hidden', false);
					icon.setAttribute('compact', true);
					break;
			}
		}
		else {
			if (Zotero) {
				var errMsg = Zotero.startupError;
			}
			
			// Use defaults if necessary
			if (!errMsg) {
				// Get the stringbundle manually
				var src = 'chrome://zotero/locale/zotero.properties';
				var localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1'].
						getService(Components.interfaces.nsILocaleService);
				var appLocale = localeService.getApplicationLocale();
				var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
					.getService(Components.interfaces.nsIStringBundleService);
				var stringBundle = stringBundleService.createBundle(src, appLocale);
				
				var errMsg = stringBundle.GetStringFromName('startupError');
			}
			
			icon.setAttribute('tooltiptext', errMsg);
			icon.setAttribute('error', 'true');
			icon.setAttribute('hidden', false);
		}
		
		// Used for loading pages from upgrade wizard
		if (Zotero && Zotero.initialURL) {
			setTimeout("gBrowser.selectedTab = gBrowser.addTab(Zotero.initialURL); Zotero.initialURL = null;", 1);
		}
		
		// Hide browser chrome on Zotero tab
		if(Zotero.isFx4) {
			XULBrowserWindow.inContentWhitelist.push("chrome://zotero/content/tab.xul");
		}
	}
	
	this.onUnload = function() {
		ZoteroPane.destroy();
	}
	
	this.onBeforeUnload = function() {
		// close Zotero as a tab, so it won't be pinned
		var zoteroTab = ZoteroOverlay.findZoteroTab();
		if(zoteroTab) gBrowser.removeTab(zoteroTab);
	}
	
	/**
	 * Hides/displays the Zotero interface
	 */
	this.toggleDisplay = function(makeVisible)
	{
		if(this.isTab && (makeVisible || makeVisible === undefined)) {
			// If in separate tab mode, just open the tab
			this.loadZoteroTab();
			return;
		}
		
		if(!Zotero || !Zotero.initialized) {
			ZoteroPane.displayStartupError();
			return;
		}
		
		var zoteroPane = document.getElementById('zotero-pane-stack');
		var zoteroSplitter = document.getElementById('zotero-splitter');
		var isHidden = zoteroPane.getAttribute('hidden') == 'true';
		var isCollapsed = zoteroPane.getAttribute('collapsed') == 'true';
		
		if(makeVisible === undefined) makeVisible = isHidden || isCollapsed;
		
		zoteroSplitter.setAttribute('hidden', !makeVisible);
		zoteroPane.setAttribute('hidden', false);
		zoteroPane.setAttribute('collapsed', false);
		
		/*
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));
		Zotero.debug("zoteroPane.getAttribute('minheight'): " + zoteroPane.getAttribute('minheight'));
		Zotero.debug("savedHeight: " + savedHeight);
		*/
		
		if(makeVisible) {
			// Get saved height (makeVisible() may change it)
			if (zoteroPane.hasAttribute('savedHeight')) {
				var savedHeight = zoteroPane.getAttribute('savedHeight');
			}
			else {
				var savedHeight = DEFAULT_ZPANE_HEIGHT;
			}
			
			// Restore height
			var max = document.getElementById('appcontent').boxObject.height
						- zoteroSplitter.boxObject.height;
			zoteroPane.setAttribute('height', Math.min(savedHeight, max));
			
			// Make visible
			ZoteroPane.makeVisible();
			
			// Make sure tags splitter isn't missing for people upgrading from <2.0b7
			document.getElementById('zotero-tags-splitter').collapsed = false;
		} else {
			ZoteroPane.makeHidden();
			
			// Collapse pane
			zoteroPane.setAttribute('collapsed', true);
			zoteroPane.height = 0;
			
			document.getElementById('content').setAttribute('collapsed', false);
			
			// turn off full window mode, if it was on
			_setFullWindowMode(false);
			
			// Return focus to the browser content pane
			window.content.window.focus();
		}
	}
	
	/**
	 * Hides or shows navigation toolbars
	 * @param set {Boolean} Whether navigation toolbars should be hidden or shown
	 */
	function _setFullWindowMode(set) {
		// hide or show navigation toolbars
		if(!getNavToolbox) return;
		var toolbox = getNavToolbox();
		if(set) {
			// the below would be a good thing to do if the whole title bar (and not just the center
			// part) got updated when it happened...
			/*if(Zotero.isMac) {
				titlebarcolorState = document.documentElement.getAttribute("activetitlebarcolor");
				document.documentElement.removeAttribute("activetitlebarcolor");
			}*/
			if(document.title != "Zotero") {
				titleState = document.title;
				document.title = "Zotero";
			}
			
			if(!toolbarCollapseState) {
				toolbarCollapseState = [node.collapsed for each (node in toolbox.childNodes)];
				for(var i=0; i<toolbox.childNodes.length; i++) {
					toolbox.childNodes[i].collapsed = true;
				}
			}
		} else {
			/*if(Zotero.isMac) {
				document.documentElement.setAttribute("activetitlebarcolor", titlebarcolorState);
			}*/
			if(document.title == "Zotero") document.title = titleState;
			
			if(toolbarCollapseState) {
				for(var i=0; i<toolbox.childNodes.length; i++) {
					toolbox.childNodes[i].collapsed = toolbarCollapseState[i];
				}
				toolbarCollapseState = undefined;
			}
		}
	}
	
	/**
	 * Determines whether there is an open Zotero tab
	 */
	this.findZoteroTab = function() {
		// Look for an existing tab
		var tab = false;
		var numTabs = gBrowser.browsers.length;
		for(var index = 0; index < numTabs; index++) {
			var currentBrowser = gBrowser.getBrowserAtIndex(index);
			if(ZOTERO_TAB_URL == currentBrowser.currentURI.spec) {
				tab = (gBrowser.tabs ? gBrowser.tabs : gBrowser.mTabs)[index];
				break;
			}
		}
		
		return tab;
	}
	
	/**
	 * Loads the Zotero tab, or adds a new tab if no tab yet exists
	 * @param {Boolean} background Whether the Zotero tab should be loaded in the background
	 */
	this.loadZoteroTab = function(background) {
		var tab = this.findZoteroTab();
		
		// If no existing tab, add a new tab
		if(!tab) tab = gBrowser.addTab(ZOTERO_TAB_URL);
		// Pin tab
		if(!isFx36) gBrowser.pinTab(tab);
		// If requested, activate tab
		if(!background) gBrowser.selectedTab = tab;
	}
	
	/**
	 * Toggle between Zotero as a tab and Zotero as a pane
	 */
	this.toggleTab = function(setMode) {
		var tab = this.findZoteroTab();
		window.zoteroSavedItemSelection = ZoteroPane.itemsView.saveSelection();
		window.zoteroSavedCollectionSelection = ZoteroPane.collectionsView.saveSelection();
		if(tab) {		// Zotero is running in a tab
			if(setMode) return;
			// if Zotero tab is the only tab, open the home page in a new tab
			if((gBrowser.tabs ? gBrowser.tabs : gBrowser.mTabs).length === 1) {
				gBrowser.addTab(gBrowser.homePage);
			}
			
			// swap ZoteroPane object
			ZoteroPane = ZoteroPane_Overlay;
			
			// otherwise, close Zotero tab and open Zotero pane
			gBrowser.removeTab(tab);
			this.isTab = false;
			this.toggleDisplay();
		} else {		// Zotero is running in the pane
			if(setMode === false) return;
			// close Zotero pane
			this.toggleDisplay(false);
			
			// open Zotero tab
			this.isTab = true;
			this.loadZoteroTab();
		}
	}
}

window.addEventListener("load", function(e) { ZoteroOverlay.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroOverlay.onUnload(e); }, false);
window.addEventListener("beforeunload", function(e) { ZoteroOverlay.onBeforeUnload(e); }, false);
