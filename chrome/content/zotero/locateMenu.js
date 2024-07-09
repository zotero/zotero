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
	this.buildLocateMenu = async function (locateMenu) {
		// clear menu
		while(locateMenu.childElementCount > 0) {
			locateMenu.removeChild(locateMenu.firstChild);
		}
		
		var selectedItems = _getSelectedItems();
		
		if(selectedItems.length) {
			await _addViewOptions(locateMenu, selectedItems, true, true, true);
			
			var availableEngines = _getAvailableLocateEngines(selectedItems);
			// add engines that are available for selected items
			if(availableEngines.length) {
				Zotero_LocateMenu.addLocateEngines(locateMenu, availableEngines, null, true);
			}
		}
		else {
			// add "no items selected"
			menuitem = document.createXULElement("menuitem");
			document.l10n.setAttributes(menuitem, "item-pane-message-items-selected", { count: 0 });
			locateMenu.appendChild(menuitem);
			menuitem.disabled = true;
		}
					
		// add separator at end if necessary
		if(locateMenu.lastChild && locateMenu.lastChild.tagName !== "menuseparator") {
			locateMenu.appendChild(document.createXULElement("menuseparator"));
		}
		
		// add installable locate menus, if there are any
		if(window.Zotero_Browser) {
			var installableLocateEngines = _getInstallableLocateEngines();
		} else {
			var installableLocateEngines = [];
		}
		
		if(installableLocateEngines.length) {
			for (let locateEngine of installableLocateEngines) {
				var menuitem = document.createXULElement("menuitem");
				menuitem.setAttribute("label", locateEngine.label);
				menuitem.setAttribute("class", "menuitem-iconic");
				menuitem.setAttribute("image", locateEngine.image);
				menuitem.zoteroLocateInfo = locateEngine;
				menuitem.addEventListener("command", _addLocateEngine, false);
				
				locateMenu.appendChild(menuitem);
			}
		}
		
		menuitem = _createMenuItem(Zotero.getString("locate.manageLocateEngines"), "zotero-manage-locate-menu");
		menuitem.addEventListener("command", _openLocateEngineManager, false);
		locateMenu.appendChild(menuitem);
		
		await document.l10n.translateFragment(locateMenu);
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
			var submenu = document.createXULElement("menu");
			submenu.setAttribute("zotero-locate", "true");
			submenu.setAttribute("label", Zotero.getString("locate.locateEngines"));
			
			// add locate engines to the submenu
			_addLocateEngines(submenuPopup, availableEngines, true);
			
			submenu.appendChild(submenuPopup);
			menu.appendChild(submenu);
		}*/
		
		yield document.l10n.translateFragment(menu);
	});
	
	function _addViewOption(selectedItems, optionName, optionObject, showIcons) {
		var menuitem;
		if (optionObject.l10nId) {
			menuitem = _createMenuItem('', null, null); // Set by Fluent
			menuitem.dataset.l10nId = optionObject.l10nId;
			let l10nArgs = optionObject.l10nArgs;
			if (l10nArgs) {
				menuitem.dataset.l10nArgs = JSON.stringify(l10nArgs);
			}
		}
		else {
			menuitem = _createMenuItem(optionObject.label || Zotero.getString(`locate.${optionName}.label`),
				null, null);
		}
		if (optionObject.className && showIcons) {
			menuitem.setAttribute("class", `menuitem-iconic ${optionObject.className}`);
		}
		menuitem.setAttribute("zotero-locate", "true");
		
		menuitem.addEventListener("command", function (event) {
			optionObject.handleItems(selectedItems, event);
		}, false);
		return menuitem;
	}
	
	/**
	 * Add view options to a menu
	 * @param {menupopup} locateMenu The menu to add menu items to
	 * @param {Zotero.Item[]} selectedItems The items to create view options based upon
	 * @param {Boolean} showIcons Whether menu items should have associated icons
	 * @param {Boolean} addExtraOptions Whether to add options that start with "_" below the separator
	 * @param {Boolean} isToolbarMenu Whether the menu being populated is displayed in the toolbar
	 * 		(and not the item tree context menu)
	 */
	var _addViewOptions = async function (locateMenu, selectedItems, showIcons, addExtraOptions, isToolbarMenu) {
		var optionsToShow = {};
		
		// check which view options are available
		for (let item of selectedItems) {
			for(var viewOption in ViewOptions) {
				if (!optionsToShow[viewOption]
						&& (!isToolbarMenu || !ViewOptions[viewOption].hideInToolbar)) {
					optionsToShow[viewOption] = await ViewOptions[viewOption].canHandleItem(item);
				}
			}
		}
		
		// Let the ViewOptions update their display properties
		for (let viewOption in optionsToShow) {
			await ViewOptions[viewOption].updateMenuItem?.(selectedItems);
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
			var sep = document.createXULElement("menuseparator");
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
	};
	
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
		var menuitem = document.createXULElement("menuitem");
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
		window.openDialog('chrome://zotero/content/locateManager.xhtml',
			'Zotero Locate Engine Manager',
			'chrome,centerscreen'
		);
	}
	
	/**
	 * Get the first 50 selected items
	 */
	function _getSelectedItems() {
		if (Zotero_Tabs.selectedID == 'zotero-pane') {
			var allSelectedItems = ZoteroPane_Local.getSelectedItems();
			var selectedItems = [];
			while (selectedItems.length < 50 && allSelectedItems.length) {
				var item = allSelectedItems.shift();
				if (!item.isNote()) selectedItems.push(item);
			}
			return selectedItems;
		}
		else {
			var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			if (reader) {
				let item = Zotero.Items.get(reader.itemID);
				if (item.parentItem) {
					return [item.parentItem];
				}
			}
			return [];
		}
	}
	
	var ViewOptions = {};
	
	/**
	 * "Open PDF" option
	 *
	 * Should appear only when the item is a PDF, or a linked or attached file or web attachment is
	 * a PDF
	 */
	function ViewAttachment(alternateWindowBehavior) {
		this._attachmentType = "mixed";
		this._numAttachments = 0;
		Object.defineProperty(this, "className", {
			get() {
				switch (this._attachmentType) {
					case "pdf":
						return "zotero-menuitem-attachments-pdf";
					case "epub":
						return "zotero-menuitem-attachments-epub";
					case "snapshot":
						return "zotero-menuitem-attachments-snapshot";
					default: {
						let openInNewWindow = Zotero.Prefs.get("openReaderInNewWindow");
						if (alternateWindowBehavior) {
							openInNewWindow = !openInNewWindow;
						}
						return openInNewWindow ? "zotero-menuitem-new-window" : "zotero-menuitem-new-tab";
					}
				}
			},
		});

		// Don't show alternate-behavior option ("in New Window" when openReaderInNewWindow is false,
		// "in New Tab" when it's true) in toolbar Locate menu
		this.hideInToolbar = alternateWindowBehavior;
		
		this.l10nId = "item-menu-viewAttachment";
		Object.defineProperty(this, "l10nArgs", {
			get: () => {
				let openIn;
				if (this._attachmentType !== "mixed" && Zotero.Prefs.get(`fileHandler.${this._attachmentType}`)) {
					openIn = "external";
				}
				else {
					let openInNewWindow = Zotero.Prefs.get("openReaderInNewWindow");
					if (alternateWindowBehavior) {
						openInNewWindow = !openInNewWindow;
					}
					openIn = openInNewWindow ? "window" : "tab";
				}
				return {
					attachmentType: this._attachmentType,
					numAttachments: this._numAttachments,
					openIn,
				};
			}
		});
		
		this.canHandleItem = async function (item) {
			const attachment = await _getFirstUsableAttachment(item);
			// Don't show alternate-behavior option when using an external PDF viewer
			return attachment
				&& !(alternateWindowBehavior && Zotero.Prefs.get(`fileHandler.${attachment.attachmentReaderType}`));
		};
		
		this.updateMenuItem = async function (items) {
			let attachmentType = null;
			let numAttachments = 0;
			for (let item of items) {
				let attachment = await _getFirstUsableAttachment(item);
				let thisAttachmentType = attachment?.attachmentReaderType;
				if (!thisAttachmentType) {
					continue;
				}
				
				if (attachmentType === null) {
					attachmentType = thisAttachmentType;
				}
				else if (attachmentType !== thisAttachmentType) {
					attachmentType = "mixed";
				}
				
				numAttachments++;
			}
			this._attachmentType = attachmentType;
			this._numAttachments = numAttachments;
		};
		
		this.handleItems = Zotero.Promise.coroutine(function* (items, event) {
			var attachments = [];
			for (let item of items) {
				var attachment = yield _getFirstUsableAttachment(item);
				if (attachment) attachments.push(attachment.id);
			}
			
			ZoteroPane_Local.viewAttachment(attachments, event, false,
				{ forceAlternateWindowBehavior: alternateWindowBehavior });
		});
		
		var _getFirstUsableAttachment = Zotero.Promise.coroutine(function* (item) {
			var attachments = item.isAttachment() ? [item] : (yield item.getBestAttachments());
			for (let i = 0; i < attachments.length; i++) {
				let attachment = attachments[i];
				if (attachment.attachmentReaderType
						&& attachment.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_URL) {
					return attachment;
				}
			}
			return null;
		});
	}

	ViewOptions.viewAttachmentInTab = new ViewAttachment(false);
	ViewOptions.viewAttachmentInWindow = new ViewAttachment(true);

	/**
	 * "View Online" option
	 *
	 * Should appear only when an item or an attachment has a URL
	 */
	ViewOptions.online = new function() {
		this.className = "zotero-menuitem-view-online";
		
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
					return "https://doi.org/" + encodeURIComponent(doi);
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
		this.className = "zotero-menuitem-view-external";
		this.useExternalViewer = true;
		
		this.canHandleItem = Zotero.Promise.coroutine(function* (item) {
			//return (this.useExternalViewer ^ Zotero.Prefs.get('launchNonNativeFiles'))
			//	&& (yield _getBestNonNativeAttachment(item));
			return false;
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
						try {
							var ext = Zotero.File.getExtension(Zotero.File.pathToFile(path));
						}
						catch (e) {
							Zotero.logError(e);
							return false;
						}
						if(!attachment.attachmentContentType ||
								Zotero.MIME.hasNativeHandler(attachment.attachmentContentType, ext)) {
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
		this.className = "zotero-menuitem-show-file";
		this.hideInToolbar = true;
		
		this.canHandleItem = function (item) {
			return ZoteroPane.canShowItemInFilesystem(item);
		};
		
		this.updateMenuItem = function (items) {
			if (Zotero.isMac) {
				this.l10nId = 'menu-file-show-in-finder';
			}
			else {
				// We only care about showing 1 or many
				let count = Zotero.Items.numDistinctFileAttachmentsForLabel(items) > 1 ? 2 : 1;
				this.l10nId = count > 1 ? 'menu-file-show-files' : 'menu-file-show-file';
			}
		};
		
		this.handleItems = async function (items) {
			await ZoteroPane.showItemsInFilesystem(items);
		};
	};
	
	/**
	 * "Library Lookup" Option
	 *
	 * Should appear only for regular items
	 */
	ViewOptions._libraryLookup = new function() {
		this.className = "zotero-menuitem-library-lookup";
		this.canHandleItem = function (item) { return Zotero.Promise.resolve(item.isRegularItem()); };
		this.handleItems = async function (items, event) {
			// If no resolver configured, show error
			if (!Zotero.Prefs.get('openURL.resolver')) {
				let paneName = Zotero.Intl.strings['zotero.preferences.prefpane.general'];
				let [noResolverStr, openSettingsStr] = await document.l10n.formatValues(
					[
						{ id: 'locate-library-lookup-no-resolver', args: { pane: paneName } },
						{ id: 'general-open-settings' }
					]
				);
				let ps = Services.prompt;
				let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
				let index = ps.confirmEx(
					null,
					Zotero.getString('locate.libraryLookup.noResolver.title'),
					noResolverStr,
					buttonFlags,
					openSettingsStr,
					null, null, null, {}
				);
				if (index == 0) {
					Zotero.Utilities.Internal.openPreferences('zotero-prefpane-general', {
						scrollTo: '#zotero-prefpane-locate-groupbox'
					});
				}
				return;
			}
			var urls = [];
			for (let item of items) {
				if(!item.isRegularItem()) continue;
				var url = Zotero.Utilities.Internal.OpenURL.resolve(item);
				if(url) urls.push(url);
			}
			ZoteroPane_Local.loadURI(urls, event);
		};
	};
}
