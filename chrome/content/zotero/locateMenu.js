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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/*
 * This object contains the various functions for the interface
 */
var Zotero_LocateMenu = new function() {
	XPCOMUtils.defineLazyServiceGetter(this, "ios", "@mozilla.org/network/io-service;1", "nsIIOService");
	
  	/**
  	 * Clear and build the locate menu
  	 */
	this.buildLocateMenu = function() {
		var locateMenu = document.getElementById('zotero-tb-locate-menu');
		
		// clear menu
		while(locateMenu.childElementCount > 0) {
			locateMenu.removeChild(locateMenu.firstChild);
		}
		
		var selectedItems = _getSelectedItems();
		
		if(selectedItems.length) {
			_addViewOptions(locateMenu, selectedItems, true, true);
			
			var availableEngines = _getAvailableLocateEngines(selectedItems);
			// add engines that are available for selected items
			if(availableEngines.length) {
				Zotero_LocateMenu.addLocateEngines(locateMenu, availableEngines, null, true);
			}
		} else {
			// add "no items selected"
			menuitem = _createMenuItem(Zotero.getString("pane.item.selected.zero"), "no-items-selected");
			locateMenu.appendChild(menuitem);
			menuitem.disabled = true;
		}
					
		// add separator at end if necessary
		if(locateMenu.lastChild.tagName !== "menuseparator") {
			locateMenu.appendChild(document.createElement("menuseparator"));
		}
		
		// add installable locate menus, if there are any
		if(window.Zotero_Browser) {
			var installableLocateEngines = _getInstallableLocateEngines();
		} else {
			var installableLocateEngines = [];
		}
		
		if(installableLocateEngines.length) {
			for (let locateEngine of installableLocateEngines) {
				var menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label", locateEngine.label);
				menuitem.setAttribute("class", "menuitem-iconic");
				menuitem.setAttribute("image", locateEngine.image);
				menuitem.zoteroLocateInfo = locateEngine;
				menuitem.addEventListener("command", _addLocateEngine, false);
				
				locateMenu.appendChild(menuitem);
			}
		}
		
		var menuitem = document.createElement("menuitem");
		menuitem = _createMenuItem(Zotero.getString("locate.manageLocateEngines"), "zotero-manage-locate-menu");
		menuitem.addEventListener("command", _openLocateEngineManager, false);
		locateMenu.appendChild(menuitem);
	}
	
	/**
	 * Clear the bottom part of the context menu and add locate options
	 * @param {menupopup} menu The menu to add context menu items to
	 * @param {Boolean} showIcons Whether menu items should have associated icons
	 * @return {Promise}
	 */
	this.buildContextMenu = Zotero.Promise.coroutine(function* (menu, showIcons) {
		// get selected items
		var selectedItems = _getSelectedItems();
		
		// if no items selected or >20 items selected, stop now
		if(!selectedItems.length || selectedItems.length > 20) return;
		
		// add view options
		yield _addViewOptions(menu, selectedItems, showIcons);
		
		/*// look for locate engines
		var availableEngines = _getAvailableLocateEngines(selectedItems);
		if(availableEngines.length) {
			// if locate engines are available, make a new submenu
			var submenu = document.createElement("menu");
			submenu.setAttribute("zotero-locate", "true");
			submenu.setAttribute("label", Zotero.getString("locate.locateEngines"));
			
			// add locate engines to the submenu
			_addLocateEngines(submenuPopup, availableEngines, true);
			
			submenu.appendChild(submenuPopup);
			menu.appendChild(submenu);
		}*/
	});
	
	function _addViewOption(selectedItems, optionName, optionObject, showIcons) {
		var menuitem = _createMenuItem(Zotero.getString("locate."+optionName+".label"),
			null, Zotero.getString("locate."+optionName+".tooltip"));
		if(showIcons) {
			menuitem.setAttribute("class", "menuitem-iconic");
			menuitem.style.listStyleImage = "url('"+optionObject.icon+"')";
		}
		menuitem.setAttribute("zotero-locate", "true");
		
		menuitem.addEventListener("command", function(event) {
			optionObject.handleItems(selectedItems, event);
		}, false)
		return menuitem;
	}
	
	/**
	 * Add view options to a menu
	 * @param {menupopup} locateMenu The menu to add menu items to
	 * @param {Zotero.Item[]} selectedItems The items to create view options based upon
	 * @param {Boolean} showIcons Whether menu items should have associated icons
	 * @param {Boolean} addExtraOptions Whether to add options that start with "_" below the separator
	 */
	var _addViewOptions = Zotero.Promise.coroutine(function* (locateMenu, selectedItems, showIcons, addExtraOptions) {
		var optionsToShow = {};
		
		// check which view options are available
		for (let item of selectedItems) {
			for(var viewOption in ViewOptions) {
				if(!optionsToShow[viewOption]) {
					optionsToShow[viewOption] = yield ViewOptions[viewOption].canHandleItem(item);
				}
			}
		}
		
		// add available view options to menu
		var lastNode = locateMenu.hasChildNodes() ? locateMenu.firstChild : null;
		var haveOptions = false;
		for(var viewOption in optionsToShow) {
			if(viewOption[0] === "_" || !optionsToShow[viewOption]) continue;
			locateMenu.insertBefore(_addViewOption(selectedItems, viewOption,
				ViewOptions[viewOption], showIcons), lastNode);
			haveOptions = true;
		}
		
		if(haveOptions) {
			var sep = document.createElement("menuseparator");
			sep.setAttribute("zotero-locate", "true");
			locateMenu.insertBefore(sep, lastNode);
		}
		
		if(addExtraOptions) {
			for (let viewOption in optionsToShow) {
				if(viewOption[0] !== "_" || !optionsToShow[viewOption]) continue;
				locateMenu.insertBefore(_addViewOption(selectedItems, viewOption.substr(1),
					ViewOptions[viewOption], showIcons), lastNode);
			}
		}
	});
	
	/**
	 * Get available locate engines that can handle a set of items 
	 * @param {Zotero.Item[]} selectedItems The items to look or locate engines for
	 * @return {Zotero.LocateManater.LocateEngine[]} An array of locate engines capable of handling
	 *	the given items
	 */
	function _getAvailableLocateEngines(selectedItems) {
		// check for custom locate engines
		var customEngines = Zotero.LocateManager.getVisibleEngines();
		var availableEngines = [];
		
		// check which engines can translate an item
		for (let engine of customEngines) {
			// require a submission for at least one selected item
			for (let item of selectedItems) {
				if(engine.getItemSubmission(item)) {
					availableEngines.push(engine);
					break;
				}
			}
		}
		
		return availableEngines;
	}
	
	/**
	 * Add locate engine options to a menu
	 * @param {menupopup} menu The menu to add menu items to
	 * @param {Zotero.LocateManager.LocateEngine[]} engines The list of engines to add to the menu
	 * @param {Function|null} items Function to call to locate items
	 * @param {Boolean} showIcons Whether menu items should have associated icons
	 */
	this.addLocateEngines = function(menu, engines, locateFn, showIcons) {
		if(!locateFn) {
			locateFn = this.locateItem;
		}
		
		for (let engine of engines) {
			var menuitem = _createMenuItem(engine.name, null, engine.description);
			menuitem.setAttribute("class", "menuitem-iconic");
			menuitem.setAttribute("image", engine.icon);
			menu.appendChild(menuitem);
			menuitem.addEventListener("command", locateFn, false);
		}
	}
	
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
	 * Get any locate engines that can be installed from the current page
	 */
	function _getInstallableLocateEngines() {
		var locateEngines = [];
		if(!window.Zotero_Browser || !window.Zotero_Browser.tabbrowser) return locateEngines;
		
		var links = Zotero_Browser.tabbrowser.selectedBrowser.contentDocument.getElementsByTagName("link");
		for (let link of links) {
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
	 * Locate selected items
	 */
	this.locateItem = function(event, selectedItems) {
		if(!selectedItems) {
			selectedItems = _getSelectedItems();
		}
		
		// find selected engine
		var selectedEngine = Zotero.LocateManager.getEngineByName(event.target.label);
		if(!selectedEngine) throw "Selected locate engine not found";
		
		var urls = [];
		var postDatas = [];
		for (let item of selectedItems) {
			var submission = selectedEngine.getItemSubmission(item);
			if(submission) {
				urls.push(submission.uri.spec);
				postDatas.push(submission.postData);
			}
		}
		
		Zotero.debug("Loading using "+selectedEngine.name);
		Zotero.debug(urls);
		ZoteroPane_Local.loadURI(urls, event, postDatas);
	}
	
  	/**
  	 * Add a new locate engine
  	 */
	function _addLocateEngine(event) {
		Zotero.LocateManager.addEngine(event.target.zoteroLocateInfo.href,
			Components.interfaces.nsISearchEngine.TYPE_OPENSEARCH,
			event.target.zoteroLocateInfo.image, false);
	}
	
  	/**
  	 * Open the locate manager
  	 */
	function _openLocateEngineManager(event) {
		window.openDialog('chrome://zotero/content/locateManager.xul',
			'Zotero Locate Engine Manager',
			'chrome,centerscreen'
		);
	}
	
	/**
	 * Get the first 50 selected items
	 */
	function _getSelectedItems() {
		var allSelectedItems = ZoteroPane_Local.getSelectedItems();
		var selectedItems = [];
		while(selectedItems.length < 50 && allSelectedItems.length) {
			var item = allSelectedItems.shift();
			if(!item.isNote()) selectedItems.push(item);
		}
		return selectedItems;
	}
	
	var ViewOptions = {};
	
	/**
	 * "View PDF" option
	 *
	 * Should appear only when the item is a PDF, or a linked or attached file or web attachment is
	 * a PDF
	 */
	ViewOptions.pdf = new function() {
		this.icon = "chrome://zotero/skin/treeitem-attachment-pdf.png";
		this._mimeTypes = ["application/pdf"];
		
		this.canHandleItem = function (item) {
			return _getFirstAttachmentWithMIMEType(item, this._mimeTypes).then((item) => !!item);
		}
		
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			var attachments = [];
			for (let item of items) {
				var attachment = yield _getFirstAttachmentWithMIMEType(item, this._mimeTypes);
				if(attachment) attachments.push(attachment.id);
			}
			
			ZoteroPane_Local.viewAttachment(attachments, event);
		});
		
		var _getFirstAttachmentWithMIMEType = Zotero.Promise.coroutine(function* (item, mimeTypes) {
			var attachments = item.isAttachment() ? [item] : (yield item.getBestAttachments());
			for (let i = 0; i < attachments.length; i++) {
				let attachment = attachments[i];
				if (mimeTypes.indexOf(attachment.attachmentContentType) !== -1
						&& attachment.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_URL) {
					return attachment;
				}
			}
			return false;
		});
	};
	
	/**
	 * "View Online" option
	 *
	 * Should appear only when an item or an attachment has a URL
	 */
	ViewOptions.online = new function() {
		this.icon = "chrome://zotero/skin/locate-view-online.png";
		
		this.canHandleItem = function (item) {
			return _getURL(item).then((val) => val !== false);
		}
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			var urls = yield Zotero.Promise.all(items.map(item => _getURL(item)));
			ZoteroPane_Local.loadURI(urls.filter(url => !!url), event);
		});
		
		var _getURL = Zotero.Promise.coroutine(function* (item) {
			// try url field for item and for attachments
			var urlField = item.getField('url');
			if(urlField) {
				var uri;
				try {
					uri = Zotero_LocateMenu.ios.newURI(urlField, null, null);
					if(uri && uri.host && uri.scheme !== 'file') return urlField;
				} catch(e) {};
			}
			
			if(item.isRegularItem()) {
				var attachments = item.getAttachments();
				if(attachments) {
					// look through url fields for non-file:/// attachments
					for (let attachment of Zotero.Items.get(attachments)) {
						var urlField = attachment.getField('url');
						if(urlField) return urlField;
					}
					
				}
			}
			
			// if no url field, try DOI field
			var doi = item.getField('DOI');
			if(doi && typeof doi === "string") {
				doi = Zotero.Utilities.cleanDOI(doi);
				if(doi) {
					return "http://dx.doi.org/" + encodeURIComponent(doi);
				}
			}
			
			return false;
		});
	};
	
	/**
	 * "View Snapshot" option
	 *
	 * Should appear only when the item is a PDF, or a linked or attached file or web attachment is
	 * a snapshot
	 */
	ViewOptions.snapshot = new function() {
		this.icon = "chrome://zotero/skin/treeitem-attachment-snapshot.png";
		this._mimeTypes = ["text/html", "application/xhtml+xml"];
		this.canHandleItem = ViewOptions.pdf.canHandleItem;
		this.handleItems = ViewOptions.pdf.handleItems;
	};
	
	/**
	 * "View File" option
	 *
	 * Should appear only when an item or a linked or attached file or web attachment does not
	 * satisfy the conditions for "View PDF" or "View Snapshot"
	 */
	ViewOptions.file = new function() {
		this.icon = "chrome://zotero/skin/treeitem-attachment-file.png";
		
		this.canHandleItem = function (item) {
			return _getFile(item).then((item) => !!item);
		}
		
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			var attachments = [];
			for (let item of items) {
				var attachment = yield _getFile(item);
				if(attachment) attachments.push(attachment.id);
			}
			
			ZoteroPane_Local.viewAttachment(attachments, event);
		});
		
		var _getFile = Zotero.Promise.coroutine(function* (item) {
			var attachments = item.isAttachment() ? [item] : (yield item.getBestAttachments());
			for (let i = 0; i < attachments.length; i++) {
				let attachment = attachments[i];
				if (!(yield ViewOptions.snapshot.canHandleItem(attachment))
						&& !(yield ViewOptions.pdf.canHandleItem(attachment))
						&& attachment.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_URL) {
					return attachment;
				}
			}
			return false;
		});
	};
	
	/**
	 * "Open in External Viewer" option
	 *
	 * Should appear only when an item or a linked or attached file or web attachment can be 
	 * viewed by an internal non-native handler and "launchNonNativeFiles" pref is disabled
	 */
	ViewOptions.externalViewer = new function() {
		this.icon = "chrome://zotero/skin/locate-external-viewer.png";
		this.useExternalViewer = true;
		
		this.canHandleItem = Zotero.Promise.coroutine(function* (item) {
			return (this.useExternalViewer ^ Zotero.Prefs.get('launchNonNativeFiles'))
				&& (yield _getBestNonNativeAttachment(item));
		});
		
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			var attachments = [];
			for (let item of items) {
				var attachment = yield _getBestNonNativeAttachment(item);
				if(attachment) attachments.push(attachment.id);
			}
			
			ZoteroPane_Local.viewAttachment(attachments, event, false, this.useExternalViewer);
		});
		
		var _getBestNonNativeAttachment = Zotero.Promise.coroutine(function* (item) {
			var attachments = item.isAttachment() ? [item] : (yield item.getBestAttachments());
			for (let i = 0; i < attachments.length; i++) {
				let attachment = attachments[i];
				if(attachment.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_URL) {
					var path = yield attachment.getFilePathAsync();
					if (path) {
						var ext = Zotero.File.getExtension(Zotero.File.pathToFile(path));
						if(!attachment.attachmentContentType ||
							Zotero.MIME.hasNativeHandler(attachment.attachmentContentType, ext) ||
							!Zotero.MIME.hasInternalHandler(attachment.attachmentContentType, ext)) {
							return false;
						}
						return attachment;
					}
				}
			}
			return false;
		});
	};
	
	/**
	 * "Open in Internal Viewer" option
	 *
	 * Should appear only when an item or a linked or attached file or web attachment can be 
	 * viewed by an internal non-native handler and "launchNonNativeFiles" pref is enabled
	 */
	ViewOptions.internalViewer = new function() {
		this.icon = "chrome://zotero/skin/locate-internal-viewer.png";
		this.useExternalViewer = false;
		this.canHandleItem = ViewOptions.externalViewer.canHandleItem;
		this.handleItems = ViewOptions.externalViewer.handleItems;
	};
	
	/**
	 * "Show File" option
	 *
	 * Should appear only when an item is a file or web attachment, or has a linked or attached
	 * file or web attachment
	 */
	ViewOptions.showFile = new function() {
		this.icon = "chrome://zotero/skin/locate-show-file.png";
		this.useExternalViewer = true;
		
		this.canHandleItem = function (item) {
			return _getBestFile(item).then(item => !!item);
		}
		
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			for (let item of items) {
				var attachment = yield _getBestFile(item);
				if(attachment) {
					ZoteroPane_Local.showAttachmentInFilesystem(attachment.id);
				}
			}
		});
		
		var _getBestFile = Zotero.Promise.coroutine(function* (item) {
			if(item.isAttachment()) {
				if(item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_URL) return false;
				return item;
			} else {
				return yield item.getBestAttachment();
			}
		});
	};
	
	/**
	 * "Library Lookup" Option
	 *
	 * Should appear only for regular items
	 */
	ViewOptions._libraryLookup = new function() {
		this.icon = "chrome://zotero/skin/locate-library-lookup.png";
		this.canHandleItem = function (item) { return Zotero.Promise.resolve(item.isRegularItem()); };
		this.handleItems = Zotero.Promise.method(function (items, event) {
			var urls = [];
			for (let item of items) {
				if(!item.isRegularItem()) continue;
				var url = Zotero.OpenURL.resolve(item);
				if(url) urls.push(url);
			}
			ZoteroPane_Local.loadURI(urls, event);
		});
	};
}