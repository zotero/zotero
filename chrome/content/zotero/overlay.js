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
	var toolbarCollapseState, showInPref;	
	var zoteroPane, zoteroSplitter;
	var _stateBeforeReload = false;
	
	this.isTab = false;
	
	this.onLoad = function() {
		try {
		
		zoteroPane = document.getElementById('zotero-pane-stack');
		zoteroSplitter = document.getElementById('zotero-splitter');
		
		ZoteroPane_Overlay = ZoteroPane;
		ZoteroPane.init();
		
		// Open Zotero app tab, if in Fx 4 and requested by pref
		showInPref = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefService)
							.getBranch('extensions.zotero.').getIntPref('showIn');
		this.isTab = showInPref !== 1;

		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		var zoteroObserver = function(subject, topic, data) {
			if(subject != window) return;
			observerService.removeObserver(this, "browser-delayed-startup-finished");
			if(showInPref === 3) {
				var tabbar = document.getElementById("TabsToolbar");
				if(tabbar && window.getComputedStyle(tabbar).display !== "none") {
					// load Zotero as a tab, if it isn't loading by default
					ZoteroOverlay.loadZoteroTab(true);
				}
			} else if(showInPref === 1) {
				// close Zotero as a tab, in case it was pinned
				var zoteroTab = ZoteroOverlay.findZoteroTab();
				if(zoteroTab) gBrowser.removeTab(zoteroTab);
			}
		};
		
		observerService.addObserver(zoteroObserver, "browser-delayed-startup-finished", false);
		
		// Make Zotero icon visible, if requested
		var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefService)
							.getBranch('extensions.zotero.');
		
		var addonBar = document.getElementById('addon-bar');
		
		var iconPref = prefBranch.getIntPref('statusBarIcon');
		
		// If this is the first run, add icon to add-on bar if not
		// in the window already and not hidden by the Zotero prefs
		if (!document.getElementById("zotero-toolbar-button") && iconPref != 0) {
			addonBar.insertItem("zotero-toolbar-button");
			addonBar.setAttribute("currentset", addonBar.currentSet);
			document.persist(addonBar.id, "currentset");
			addonBar.setAttribute("collapsed", false);
			document.persist(addonBar.id, "collapsed");
		}
		
		var icon = document.getElementById('zotero-toolbar-button');
		
		// Add a listener for toolbar change events
		window.addEventListener("customizationchange", onToolbarChange, false);
		
		if (Zotero && Zotero.initialized){
			document.getElementById('appcontent').addEventListener('mousemove', Zotero.ProgressWindowSet.updateTimers, false);
			if (icon) {
				if (iconPref == 1) {
					icon.setAttribute('compact', true);
				}
				// If hidden in prefs, remove from add-on bar
				else if (iconPref == 0) {
					var toolbar = icon.parentNode;
					if (toolbar.id == 'addon-bar') {
						var palette = document.getElementById("navigator-toolbox").palette;
						palette.appendChild(icon);
						toolbar.setAttribute("currentset", toolbar.currentSet);
						document.persist(toolbar.id, "currentset");
					}
				}

				if (icon.getAttribute("cui-areatype") == "toolbar") {
					window.setTimeout(function() {
						var isUpgrade = false;
						try {
							isUpgrade = Zotero.Prefs.get("firstRunGuidanceShown.saveIcon");
						} catch(e) {}
						var property = "firstRunGuidance.toolbarButton."+(isUpgrade ? "upgrade" : "new");
						var shortcut = Zotero.getString(Zotero.isMac ? "general.keys.cmdShift" : "general.keys.ctrlShift")+
							           Zotero.Prefs.get("keys.openZotero");
						document.getElementById("zotero-toolbar-button-guidance").show(null, Zotero.getString(property, shortcut));
					}, 0);
				}
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
		}
		
		// Used for loading pages from upgrade wizard
		if (Zotero && Zotero.initialURL) {
			setTimeout(function () {
				gBrowser.selectedTab = gBrowser.addTab(Zotero.initialURL);
				Zotero.initialURL = null;
			}, 1);
		}
		
		// Hide browser chrome on Zotero tab
		XULBrowserWindow.inContentWhitelist.push("chrome://zotero/content/tab.xul");
		
		// Close pane before reload
		ZoteroPane_Local.addBeforeReloadListener(function(newMode) {
			if(newMode == "connector") {
				// save current state
				_stateBeforeReload = !zoteroPane.hidden && !zoteroPane.collapsed;
				// ensure pane is closed
				if(!zoteroPane.collapsed) ZoteroOverlay.toggleDisplay(false, true);
			}
		});

		// Close pane if connector is enabled
		ZoteroPane_Local.addReloadListener(function() {
			if(!Zotero.isConnector) {
				// reopen pane if it was open before
				ZoteroOverlay.toggleDisplay(_stateBeforeReload, true);
			}
		});
		
		}
		catch (e) {
			Zotero.debug(e);
		}
	}
	
	
    function onToolbarChange(e) {
    	// e.target seems to be navigator-toolbox in all cases,
    	// so check the addon-bar directly
    	var addonBar = document.getElementById("addon-bar");
    	var icon = document.getElementById("zotero-toolbar-button");
    	if (icon) {
    		// If dragged to add-on bar
			if (addonBar.getElementsByAttribute("id", "zotero-toolbar-button").length) {
				var statusBarPref = Zotero.Prefs.get("statusBarIcon");
				// If pref set to hide, force to full
				if (statusBarPref == 0) {
					Zotero.Prefs.set("statusBarIcon", 2)
				}
				else if (statusBarPref == 1) {
					icon.setAttribute("compact", true);
				}
				return;
			}
    	}
    	Zotero.Prefs.set("statusBarIcon", 0);
    }
    
    
	this.onUnload = function() {
		window.removeEventListener("customizationchange", onToolbarChange, false);
		ZoteroPane.destroy();
	}
	
	this.onBeforeUnload = function() {
		// close Zotero as a tab, so it won't be pinned
		var zoteroTab = ZoteroOverlay.findZoteroTab();
		if(zoteroTab) gBrowser.removeTab(zoteroTab);
	}
	
	/**
	 * Hides/displays the Zotero interface
	 * @param {Boolean} makeVisible Whether or not Zotero interface should be visible
	 * @param {Boolean} dontRefocus If true, don't focus content when closing Zotero pane. Used
	 *     when closing pane because Zotero Standalone is being opened, to avoid pulling Firefox to 
	 *     the foreground.
	 */
	this.toggleDisplay = function(makeVisible, dontRefocus)
	{	
		if(!Zotero || !Zotero.initialized) {
			ZoteroPane.displayStartupError();
			return;
		}
		
		if(makeVisible || makeVisible === undefined) {
			if(Zotero.isConnector) {
				// If in connector mode, bring Zotero Standalone to foreground
				Zotero.activateStandalone();
				return;
			} else if(this.isTab) {
				// If in separate tab mode, just open the tab
				this.loadZoteroTab();
				return;
			}
		}
		
		if(makeVisible === undefined) makeVisible = zoteroPane.hidden || zoteroPane.collapsed;
		
		/*
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));
		Zotero.debug("zoteroPane.getAttribute('minheight'): " + zoteroPane.getAttribute('minheight'));
		Zotero.debug("savedHeight: " + savedHeight);
		*/
		
		if(makeVisible) {
			if (Zotero.locked) {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var msg = Zotero.getString('general.operationInProgress') + '\n\n' + Zotero.getString('general.operationInProgress.waitUntilFinished');
				ps.alert(null, "", msg);
				return false;
			}
			
			zoteroSplitter.setAttribute('hidden', false);
			zoteroPane.setAttribute('hidden', false);
			zoteroPane.setAttribute('collapsed', false);
			
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
			zoteroSplitter.setAttribute('hidden', true);
			zoteroPane.setAttribute('collapsed', true);
			zoteroPane.height = 0;
			
			document.getElementById('content').setAttribute('collapsed', false);
			
			if(!dontRefocus) {
				// Return focus to the browser content pane
				window.content.window.focus();
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
		if(showInPref == 3) gBrowser.pinTab(tab);
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
