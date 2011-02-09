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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/*
 * This object contains the various functions for the interface
 */
var Zotero_LocateMenu = new function() {
	XPCOMUtils.defineLazyServiceGetter(this, "ios", "@mozilla.org/network/io-service;1", "nsIIOService");
	
	/**
	 * Create a new menuitem XUL element
	 */
	function _createMenuItem( label, id, tooltiptext ) {
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label", label);
		if(id) menuitem.setAttribute("id", id);
		if(tooltiptext) menuitem.setAttribute("tooltiptext", tooltiptext);
		
		return menuitem;
	}
	
	/**
	 * Get snapshot IDs for items
	 */
	function _getSnapshotIDs(items) {
		var ids = [];
		for each(var item in items) {
			if(item.isNote()) continue;
			var snapID = (item.isAttachment() ? item.id : item.getBestAttachment());
			if(!snapID) continue;
			var spec = Zotero.Items.get(snapID).getLocalFileURL();
			if(!spec) continue;
			var uri = Zotero_LocateMenu.ios.newURI(spec, null, null);
			if(!uri || uri.scheme != 'file') continue;
			ids.push(snapID);
		}
		return ids;
	}
	
	/**
	 * Get URLs for items
	 */
	function _getURLs(items, includeDOIs) {
		var urls = [];
		for each(var item in items) {
			if(item.isNote()) continue;
			var url = null;
			
			// try url field
			var urlField = item.getField('url');
			if(urlField) {
				var uri = Zotero_LocateMenu.ios.newURI(urlField, null, null);
				if(uri && (uri.host || !uri.scheme !== 'file')) {
					url = urlField;
				}
			}
			
			if(includeDOIs) {
				if(!url) {
					// try DOI field
					var doi = item.getField('DOI');
					if(doi && typeof doi === "string") {
						doi = Zotero.Utilities.cleanDOI(doi);
						if(doi) url = "http://dx.doi.org/" + encodeURIComponent(doi);
					}
				}
			}
			
			if(url) urls.push(url);
		}
		return urls;
	}
	
	/**
	 * Get any locate engines that can be installed from the current page
	 */
	function _getInstallableLocateEngines() {
		var locateEngines = [];
		if(!Zotero_Browser) return locateEngines;
		
		var links = Zotero_Browser.tabbrowser.selectedBrowser.contentDocument.getElementsByTagName("link");
		for each(var link in links) {
			if(!link.getAttribute) continue;
			var rel = link.getAttribute("rel");
			if(rel && rel === "search") {
				var type = link.getAttribute("type");
				if(type && type === "application/x-openurl-opensearchdescription+xml") {
					var label = link.getAttribute("title");
					if(label) {
						if(Zotero.LocateManager.getEngineByName(label)) {
							label = 'Update "'+label+'"';
						} else {
							label = 'Add "'+label+'"';
						}
					} else {
						label = 'Add Locate Engine';
					}
					
					locateEngines.push({'label':label,
						'href':link.getAttribute("href"),
						'image':Zotero_Browser.tabbrowser.selectedTab.image});
				}
			}
		}
		
		return locateEngines;
	}
  	
  	/**
  	 * Clear and build the locate menu
  	 */
	this.buildLocateMenu = function() {
		var locateMenu = document.getElementById('zotero-tb-locate-menu');
		
		// clear menu
		while(locateMenu.childElementCount > 0) {
			locateMenu.removeChild(locateMenu.firstChild);
		}
		
		var selectedItems = [item for each(item in ZoteroPane.getSelectedItems()) if(!item.isNote())];
		
		if(selectedItems.length) {
			// get snapshot IDs and URLs
			var allURLs = _getURLs(selectedItems, true);
			var realURLs = _getURLs(selectedItems);
			
			if(selectedItems.length == 1 && _getSnapshotIDs(selectedItems).length) {
				// add view snapshot
				var menuitem = _createMenuItem(Zotero.getString("locate.snapshot.label"),
					"zotero-locate-snapshot", Zotero.getString("locate.snapshot.tooltip"));
				locateMenu.appendChild(menuitem);
				menuitem.addEventListener("command", this.openItemSnapshot, false);
			}
			
			if(allURLs.length) {
				// add view online
				var menuitem = _createMenuItem(Zotero.getString("locate.online.label"),
					"zotero-locate-online", Zotero.getString("locate.online.tooltip"));
				locateMenu.appendChild(menuitem);
				menuitem.addEventListener("command", this.openItemURL, false);
			}
			
			// add library lookup to regular items
			var regularItems = [item for each(item in selectedItems) if(item.isRegularItem())];
			if(regularItems.length) {
				var menuitem = _createMenuItem(Zotero.getString("locate.libraryLookup.label"),
					"zotero-locate-service-openurl", Zotero.getString("locate.libraryLookup.tooltip"));
				locateMenu.appendChild(menuitem);
				menuitem.addEventListener("command", this.lookupItem, false);
			}
			
			// add wayback if there are real URLs
			if(realURLs.length) {
				var menuitem = _createMenuItem(Zotero.getString("locate.waybackMachine.label"),
					"zotero-locate-service-wayback", Zotero.getString("locate.waybackMachine.tooltip"));
				locateMenu.appendChild(menuitem);
				menuitem.addEventListener("command", this.waybackItem, false);
			}
			
			var customEngines = Zotero.LocateManager.getVisibleEngines();
			if(customEngines.length) {
				locateMenu.appendChild(document.createElement("menuseparator"));
				
				// add engines to menu
				for each(var engine in customEngines) {
					// require a submission for at least one selected item
					var canSubmit = false;
					for each(var item in selectedItems) {
						if(engine.getItemSubmission(item)) {
							canSubmit = true;
							break;
						}
					}
					
					if(canSubmit) {
						var menuitem = _createMenuItem(engine.name, null, engine.description);
						menuitem.setAttribute("class", "menuitem-iconic");
						menuitem.setAttribute("image", engine.icon);
						locateMenu.appendChild(menuitem);
						menuitem.addEventListener("command", this.locateItem, false);
					}
				}
			}
		} else {
			// add "no items selected"
			menuitem = _createMenuItem(Zotero.getString("pane.item.selected.zero"), "no-items-selected");
			locateMenu.appendChild(menuitem);
			menuitem.disabled = true;
		}
		
		// add installable locate menus, if there are any
		if(window.Zotero_Browser) {
			var installableLocateEngines = _getInstallableLocateEngines();
		} else {
			var installableLocateEngines = [];
		}
		
		if(installableLocateEngines.length) {
			locateMenu.appendChild(document.createElement("menuseparator"));
			
			for each(var locateEngine in installableLocateEngines) {
				var menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label", locateEngine.label);
				menuitem.setAttribute("image", locateEngine.image);
				menuitem.zoteroLocateInfo = locateEngine;
				menuitem.addEventListener("command", this.addLocateEngine, false);
				
				locateMenu.appendChild(menuitem);
			}
		}
		
		// add manage menu item
		locateMenu.appendChild(document.createElement("menuseparator"));
		
		var menuitem = document.createElement("menuitem");
		menuitem = _createMenuItem(Zotero.getString("locate.manageLocateEngines"), "zotero-manage-locate-menu");
		menuitem.addEventListener("command", this.openLocateEngineManager, false);
		locateMenu.appendChild(menuitem);
	}
	
	/**
	 * Open snapshots for selected items
	 */
	this.openItemSnapshot = function(event) {
		ZoteroPane.viewAttachment(_getSnapshotIDs(ZoteroPane.getSelectedItems())[0], event);
	}
	
	/**
	 * Open URLs for selected items
	 */
	this.openItemURL = function(event) {
		ZoteroPane.loadURI(_getURLs(ZoteroPane.getSelectedItems(), true), event);
	}
	
	/**
	 * Perform library lookup of selected items
	 */
	this.lookupItem = function(event) {
		var urls = [];
		for each(var item in ZoteroPane.getSelectedItems()) {
			if(!item.isRegularItem()) continue;
			var url = Zotero.OpenURL.resolve(item);
			if(url) urls.push(url);
		}
		ZoteroPane.loadURI(urls, event);
	}
	
	/**
	 * Perform library lookup of selected items
	 */
	this.waybackItem = function(event) {
		ZoteroPane.loadURI(["http://web.archive.org/web/*/"+url
			for each(url in _getURLs(ZoteroPane.getSelectedItems()))], event);
	}
	
	/**
	 * Locate selected items
	 */
	this.locateItem = function(event) {
		var selectedItems = ZoteroPane.getSelectedItems();
		
		// find selected engine
		var selectedEngine = Zotero.LocateManager.getEngineByName(event.target.label);
		if(!selectedEngine) throw "Selected locate engine not found";
		
		var urls = [];
		var postDatas = [];
		for each(var item in selectedItems) {
			var submission = selectedEngine.getItemSubmission(item);
			urls.push(submission.uri.spec);
			postDatas.push(submission.postData);
		}
		
		Zotero.debug("Loading using "+selectedEngine.name);
		Zotero.debug(urls);
		ZoteroPane.loadURI(urls, event, postDatas);
	}
	
  	/**
  	 * Add a new locate engine
  	 */
	this.addLocateEngine = function(event) {
		Zotero.LocateManager.addEngine(event.target.zoteroLocateInfo.href,
			Components.interfaces.nsISearchEngine.TYPE_OPENSEARCH,
			event.target.zoteroLocateInfo.image, false);
	}
	
  	/**
  	 * Open the locate manager
  	 */
	this.openLocateEngineManager = function(event) {
		window.openDialog('chrome://zotero/content/locateManager.xul',
			'Zotero Locate Engine Manager',
			'chrome,centerscreen'
		);
	}
}
