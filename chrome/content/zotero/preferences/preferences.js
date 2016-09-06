/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

"use strict";

var Zotero_Preferences = {
	init: function () {
		if(Zotero.isConnector) {
			Zotero.activateStandalone();
			window.close();
			return;
		}
		
		observerService.addObserver(function() {
			if(Zotero.isConnector) window.close();
		}, "zotero-reloaded", false);
		
		if(window.arguments) {
			var io = window.arguments[0];
			io = io.wrappedJSObject || io;
			
			if(io.pane) {
				let tabID = io.tab;
				let tabIndex = io.tabIndex;
				var pane = document.getElementById(io.pane);
				document.getElementById('zotero-prefs').showPane(pane);
				// Select tab within pane by tab id
				if (tabID !== undefined) {
					if (pane.loaded) {
						let tab = document.querySelector('tab#' + tabID);
						if (tab) {
							document.getElementsByTagName('tabbox')[0].selectedTab = tab;
						}
					}
					else {
						pane.addEventListener('paneload', function () {
							let tab = document.querySelector('tab#' + tabID);
							if (tab) {
								document.getElementsByTagName('tabbox')[0].selectedTab = tab;
							}
						})
					}
				}
				// Select tab within pane by index
				else if (tabIndex !== undefined) {
					if (pane.loaded) {
						document.getElementsByTagName('tabbox')[0].selectedIndex = tabIndex;
					}
					else {
						pane.addEventListener('paneload', function () {
							document.getElementsByTagName('tabbox')[0].selectedIndex = tabIndex;
						})
					}
				}
			}
		} else if(document.location.hash == "#cite") {
			document.getElementById('zotero-prefs').showPane(document.getElementById("zotero-prefpane-cite"));
		}
	},
	
	onUnload: function () {
		if (Zotero_Preferences.Debug_Output) {
			Zotero_Preferences.Debug_Output.onUnload();
		}
	},
	
	openURL: function (url, windowName) {
		// Non-instantApply prefwindows are usually modal, so we can't open in the topmost window,
		// since it's probably behind the window
		var instantApply = Zotero.Prefs.get("browser.preferences.instantApply", true);
		
		if (instantApply) {
			window.opener.ZoteroPane_Local.loadURI(url, { shiftKey: true, metaKey: true });
		}
		else {
			if (Zotero.isStandalone) {
				var io = Components.classes['@mozilla.org/network/io-service;1']
							.getService(Components.interfaces.nsIIOService);
				var uri = io.newURI(url, null, null);
				var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
							.getService(Components.interfaces.nsIExternalProtocolService)
							.getProtocolHandlerInfo('http');
				handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
				handler.launchWithURI(uri, null);
			}
			else {
				var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
							.getService(Components.interfaces.nsIWindowWatcher);
				var win = ww.openWindow(
					window,
					url,
					windowName ? windowName : null,
					"chrome=no,menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes",
					null
				);
			}
		}
	},
	
	openHelpLink: function () {
		var url = "http://www.zotero.org/support/preferences/";
		var helpTopic = document.getElementsByTagName("prefwindow")[0].currentPane.helpTopic;
		url += helpTopic;
		
		this.openURL(url, "helpWindow");
	},
	
	
	/**
	 * Opens a URI in the basic viewer in Standalone, or a new window in Firefox
	 */
	openInViewer: function (uri, newTab) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		const features = "menubar=yes,toolbar=no,location=no,scrollbars,centerscreen,resizable";
		
		if(Zotero.isStandalone) {
			var win = wm.getMostRecentWindow("zotero:basicViewer");
			if(win) {
				win.loadURI(uri);
			} else {
				window.openDialog("chrome://zotero/content/standalone/basicViewer.xul",
					"basicViewer", "chrome,resizable,centerscreen,menubar,scrollbars", uri);
			}
		} else {
			var win = wm.getMostRecentWindow("navigator:browser");
			if(win) {
				if(newTab) {
					win.gBrowser.selectedTab = win.gBrowser.addTab(uri);
				} else {
					win.open(uri, null, features);
				}
			}
			else {
				var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
							.getService(Components.interfaces.nsIWindowWatcher);
				var win = ww.openWindow(null, uri, null, features + ",width=775,height=575", null);
			}
		}
	}
};