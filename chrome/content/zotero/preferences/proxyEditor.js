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

var Zotero_ProxyEditor = new function() {
	var treechildren;
	var tree;
	var treecol;
	var multiSite;
	
	/**
	 * Called when this window is first opened. Sets values if necessary
	 */
	this.load = function() {
		treechildren = document.getElementById("zotero-proxies-hostname-multiSite-tree-children");
		tree = document.getElementById("zotero-proxies-hostname-multiSite-tree");
		multiSite = document.getElementById("zotero-proxies-multiSite");
		
		if(window.arguments && window.arguments[0]) {
			var proxy = window.arguments[0];
			document.getElementById("zotero-proxies-scheme").value = proxy.scheme;
			document.getElementById("zotero-proxies-multiSite").checked = !!proxy.multiHost;
			if(proxy.hosts) {
				if(proxy.multiHost) {
					this.multiSiteChanged();
					for (var i=0; i<proxy.hosts.length; i++) {
						_addTreeElement(proxy.hosts[i]);
					}
					document.getElementById("zotero-proxies-autoAssociate").checked = proxy.autoAssociate;
				} else {
					document.getElementById("zotero-proxies-hostname-text").value = proxy.hosts[0];
				}
			}
		}
		
		window.sizeToContent();
	}
	
	/**
	 * Called when a user checks/unchecks the Multi-Site checkbox. Shows or hides multi-site
	 * hostname specification box as necessary.
	 */
	this.multiSiteChanged = function() {
		document.getElementById("zotero-proxies-hostname-multiSite").hidden = !multiSite.checked;
		document.getElementById("zotero-proxies-hostname-multiSite-description").hidden = !multiSite.checked;
		document.getElementById("zotero-proxies-hostname").hidden = multiSite.checked;
		window.sizeToContent();
	}
	
	/**
	 * Called when a row is selected
	 */
	this.select = function() {
		document.getElementById("zotero-proxies-delete").disabled = tree.selectedIndex == -1;
	}
	
	/**
	 * Adds a host when in multi-host mode
	 */
	this.addHost = function() {
		_addTreeElement();
		tree.startEditing(treechildren.childNodes.length-1, tree.columns.getFirstColumn());
	}
	
	/**
	 * Deletes a host when in multi-host mode
	 */
	this.deleteHost = function() {
		if(tree.currentIndex == -1) return;
		treechildren.removeChild(treechildren.childNodes[tree.currentIndex]);
		document.getElementById("zotero-proxies-delete").disabled = true;
	}
	
	/**
	 * Called when the user clicks "OK." Updates proxy for Zotero.Proxy.
	 */
	this.accept = function() {
		var proxy = window.arguments && window.arguments[0] ? window.arguments[0] : new Zotero.Proxy();
		
		proxy.scheme = document.getElementById("zotero-proxies-scheme").value;
		proxy.multiHost = multiSite.checked;
		if(proxy.multiHost) {
			proxy.hosts = [];
			var treecol = tree.columns.getFirstColumn();
			for(var i=0; i<tree.view.rowCount; i++) {
				var host = tree.view.getCellText(i, treecol);
				if(host) proxy.hosts.push(host);
			}
			proxy.autoAssociate = document.getElementById("zotero-proxies-autoAssociate").checked;
		} else {
			proxy.hosts = [document.getElementById("zotero-proxies-hostname-text").value];
		}
		
		var hasErrors = proxy.validate();
		if(hasErrors) {
			error = hasErrors.shift();
			
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
			promptService.alert(
				window, Zotero.getString("proxies.error"),
				Zotero.getString("proxies.error." + error, hasErrors)
			);
			if(window.arguments && window.arguments[0]) proxy.revert(); // async
			return false;
		}
		proxy.save(true);
		return true;
	}
	
	/**
	 * Adds an element to the tree
	 */
	function _addTreeElement(label) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var treecell = document.createElement('treecell');
		
		if(label) treecell.setAttribute('label', label);
		
		treerow.appendChild(treecell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}
}