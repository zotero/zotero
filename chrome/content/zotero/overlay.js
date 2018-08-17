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
	var toolbarCollapseState;
	var zoteroPane, zoteroSplitter;
	
	this.isTab = false;
	
	this.onLoad = function () {
		Zotero.spawn(function* () {
			try {
				//
				// Code that runs in both full and connector mode
				//
				zoteroPane = document.getElementById('zotero-pane-stack');
				zoteroSplitter = document.getElementById('zotero-splitter');
				
				if (!Zotero) {
					throw new Error("No Zotero object");
				}
				if (Zotero.skipLoading) {
					throw new Error("Skipping loading");
				}
				
				ZoteroPane_Overlay = ZoteroPane;
				
				// TODO: Add only when progress window is open
				document.getElementById('appcontent').addEventListener('mousemove', Zotero.ProgressWindowSet.updateTimers, false);
				
				// Perform additional initialization for full mode
				if (!Zotero.isConnector) {
					yield _onLoadFull();
				}
			}
			catch (e) {
				Zotero.debug(e, 1);
				throw e;
			}
		});
	}
	
	
	/**
	 * Initialize overlay in new windows in full mode
	 *
	 * This is never run in Zotero for Firefox if Standalone is open first and Z4Fx is opened
	 * second, but we don't care.
	 */
	var _onLoadFull = function () {
		return Zotero.spawn(function* () {
			yield Zotero.Promise.all([Zotero.initializationPromise, Zotero.unlockPromise]);
			
			Zotero.debug("Initializing overlay");
			
			if (Zotero.skipLoading) {
				throw new Error("Skipping loading");
			}
			
			ZoteroPane.init();
			
			// Clear old Zotero icon pref
			var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
								.getService(Components.interfaces.nsIPrefService)
								.getBranch('extensions.zotero.');
			prefBranch.clearUserPref('statusBarIcon');
			
			// Used for loading pages from upgrade wizard
			if (Zotero.initialURL) {
				setTimeout(function () {
					Zotero.launchURL(ZOTERO_CONFIG.START_URL);
					Zotero.initialURL = null;
				}, 1);
			}
		}, this);
	}
	
	
	this.onUnload = function() {
		ZoteroPane.destroy();
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
		if (!Zotero || Zotero.startupError || Zotero.skipLoading) {
			ZoteroPane.displayStartupError();
			return;
		}
		
		// Don't do anything if pane is already showing
		if (makeVisible && ZoteroPane.isShowing()) {
			return;
		}
		
		if(makeVisible === undefined) makeVisible = zoteroPane.hidden || zoteroPane.collapsed;
		
		/*
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));
		Zotero.debug("zoteroPane.getAttribute('minheight'): " + zoteroPane.getAttribute('minheight'));
		Zotero.debug("savedHeight: " + savedHeight);
		*/
		
		if(makeVisible) {
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
			
			// Warn about unsafe data directory on first display
			Zotero.DataDirectory.checkForUnsafeLocation(Zotero.DataDirectory.dir); // async

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
}

window.addEventListener("load", function(e) {
	try {
		ZoteroOverlay.onLoad(e);
	}
	catch (e) {
		Components.utils.reportError(e);
		if (Zotero) {
			Zotero.debug(e, 1);
		}
		else {
			dump(e + "\n\n");
		}
	}
}, false);
window.addEventListener("unload", function(e) { ZoteroOverlay.onUnload(e); }, false);
