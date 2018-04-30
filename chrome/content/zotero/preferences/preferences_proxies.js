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

Zotero_Preferences.Proxies = {
	_proxies: null,
	
	
	init: function () {
		this.refreshProxyList();
		this.updateCheckboxState();
	},
	
	/**
	 * Updates proxy autoRecognize and transparent settings based on checkboxes
	 */
	updateProxyPrefs: function () {
		var transparent = document.getElementById('zotero-proxies-transparent').checked;
		Zotero.Prefs.set("proxies.transparent", transparent);
		Zotero.Prefs.set("proxies.autoRecognize", document.getElementById('zotero-proxies-autoRecognize').checked);	
		Zotero.Prefs.set("proxies.showRedirectNotification", document.getElementById('zotero-proxies-showRedirectNotification').checked);
		Zotero.Prefs.set("proxies.disableByDomainString", document.getElementById('zotero-proxies-disableByDomain-textbox').value);
		Zotero.Prefs.set("proxies.disableByDomain", document.getElementById('zotero-proxies-disableByDomain-checkbox').checked &&
				document.getElementById('zotero-proxies-disableByDomain-textbox').value != "");
		
		Zotero.Proxies.init();
		
		this.updateCheckboxState();
	},
	
	
	updateCheckboxState: function() {
		var transparent = document.getElementById('zotero-proxies-transparent').checked;

		document.getElementById('proxyTree-add').disabled =
			document.getElementById('proxyTree-delete').disabled =
			document.getElementById('proxyTree').disabled =
			document.getElementById('zotero-proxies-autoRecognize').disabled =
			document.getElementById('zotero-proxies-showRedirectNotification').disabled =
			document.getElementById('zotero-proxies-disableByDomain-checkbox').disabled =
			document.getElementById('zotero-proxies-disableByDomain-textbox').disabled =
				!transparent;
	},
	
	
	/**
	 * Enables UI buttons when proxy is selected
	 */
	enableProxyButtons: function () {
		document.getElementById('proxyTree-edit').disabled = false;
		document.getElementById('proxyTree-delete').disabled = false;
	},
	
	/**
	 * Adds a proxy to the proxy pane
	 */
	showProxyEditor: function (index) {
		if(index == -1) return;
		window.openDialog('chrome://zotero/content/preferences/proxyEditor.xul',
			"zotero-preferences-proxyEditor", "chrome,modal,centerscreen",
			index !== undefined ? this._proxies[index] : null);
		this.refreshProxyList();
	},
	
	
	/**
	 * Deletes the currently selected proxy
	 */
	deleteProxy: function () {
		if(document.getElementById('proxyTree').currentIndex == -1) return;
		this._proxies[document.getElementById('proxyTree').currentIndex].erase();
		this.refreshProxyList();
		document.getElementById('proxyTree-delete').disabled = true;
	},
	
	
	/**
	 * Refreshes the proxy pane
	 */
	refreshProxyList: function () {
		if(!document.getElementById("zotero-prefpane-proxies")) return;
		
		// get and sort proxies
		this._proxies = Zotero.Proxies.proxies.slice();
		for(var i=0; i<this._proxies.length; i++) {
			if(!this._proxies[i].proxyID) {
				this._proxies.splice(i, 1);
				i--;
			}
		}
		this._proxies = this._proxies.sort(function(a, b) {
			if(a.multiHost) {
				if(b.multiHost) {
					if(a.hosts[0] < b.hosts[0]) {
						return -1;
					} else {
						return 1;
					}
				} else {
					return -1;
				}
			} else if(b.multiHost) {
				return 1;
			}
			
			if(a.scheme < b.scheme) {
				return -1;
			} else if(b.scheme > a.scheme) {
				return 1;
			}
			
			return 0;
		});
		
		// erase old children
		var treechildren = document.getElementById('proxyTree-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		// add proxies to list
		for (var i=0; i<this._proxies.length; i++) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var hostnameCell = document.createElement('treecell');
			var schemeCell = document.createElement('treecell');
			
			hostnameCell.setAttribute('label', this._proxies[i].multiHost ? Zotero.getString("proxies.multiSite") : this._proxies[i].hosts[0]);
			schemeCell.setAttribute('label', this._proxies[i].scheme);
			
			treerow.appendChild(hostnameCell);
			treerow.appendChild(schemeCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}
		
		document.getElementById('proxyTree').currentIndex = -1;
		document.getElementById('proxyTree-edit').disabled = true;
		document.getElementById('proxyTree-delete').disabled = true;
		document.getElementById('zotero-proxies-transparent').checked = Zotero.Prefs.get("proxies.transparent");
		document.getElementById('zotero-proxies-autoRecognize').checked = Zotero.Prefs.get("proxies.autoRecognize");
		document.getElementById('zotero-proxies-showRedirectNotification').checked = Zotero.Prefs.get("proxies.showRedirectNotification");
		document.getElementById('zotero-proxies-disableByDomain-checkbox').checked = Zotero.Prefs.get("proxies.disableByDomain");
		document.getElementById('zotero-proxies-disableByDomain-textbox').value = Zotero.Prefs.get("proxies.disableByDomainString");
	}
};
