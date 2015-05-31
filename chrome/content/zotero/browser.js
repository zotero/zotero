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
    
    
    Based on code from Greasemonkey and PiggyBank
    
    ***** END LICENSE BLOCK *****
*/

//
// Zotero Ingester Browser Functions
//

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_Browser
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

var Zotero_Browser = new function() {
	this.init = init;
	this.annotatePage = annotatePage;
	this.toggleMode = toggleMode;
	this.toggleCollapsed = toggleCollapsed;
	this.chromeLoad = chromeLoad;
	this.contentLoad = contentLoad;
	this.itemUpdated = itemUpdated;
	this.contentHide = contentHide;
	this.tabClose = tabClose;
	this.resize = resize;
	this.updateStatus = updateStatus;
	
	this.tabbrowser = null;
	this.appcontent = null;
	this.isScraping = false;
	
	var _browserData = new Object();
	var _attachmentsMap = new WeakMap();
	
	var _blacklist = [
		"googlesyndication.com",
		"doubleclick.net",
		"questionmarket.com",
		"atdmt.com",
		"aggregateknowledge.com",
		"ad.yieldmanager.com"
	];
	
	var _locationBlacklist = [
		"zotero://debug/"
	];
	
	var tools = {
		'zotero-annotate-tb-add':{
			cursor:"pointer",
			event:"click",
			callback:function(e) { _add("annotation", e) }
		},
		'zotero-annotate-tb-highlight':{
			cursor:"text",
			event:"mouseup",
			callback:function(e) { _add("highlight", e) }
		},
		'zotero-annotate-tb-unhighlight':{
			cursor:"text",
			event:"mouseup",
			callback:function(e) { _add("unhighlight", e) }
		}
	};

	//////////////////////////////////////////////////////////////////////////////
	//
	// Public Zotero_Browser methods
	//
	//////////////////////////////////////////////////////////////////////////////
	
	
	/**
	 * Initialize some variables and prepare event listeners for when chrome is done loading
	 */
	function init() {
		if (!window.hasOwnProperty("gBrowser")) {
			return;
		}
		
		var zoteroInitDone;
		if (!Zotero || !Zotero.initialized) {
			// Zotero either failed to load or is reloading in Connector mode
			// In case of the latter, listen for the 'zotero-loaded' event (once) and retry
			var zoteroInitDone_deferred = Q.defer();
			var obs = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			var observer = {
				"observe":function() {
					obs.removeObserver(observer, 'zotero-loaded')
					zoteroInitDone_deferred.resolve();
				}
			};
			obs.addObserver(observer, 'zotero-loaded', false);
			
			zoteroInitDone = zoteroInitDone_deferred.promise;
		} else {
			zoteroInitDone = Q();
		}
		
		var chromeLoaded = Q.defer();
		window.addEventListener("load", function(e) { chromeLoaded.resolve() }, false);
		
		// Wait for Zotero to init and chrome to load before proceeding
		Q.all([
			zoteroInitDone.then(function() {
				ZoteroPane_Local.addReloadListener(reload);
				reload();
			}),
			chromeLoaded.promise
		])
		.then(function() {
			Zotero_Browser.chromeLoad()
		})
		.done();
	}
	
	/**
	 * Called when Zotero is reloaded
	 */
	function reload() {
		// Handles the display of a div showing progress in scraping
		Zotero_Browser.progress = new Zotero.ProgressWindow();
	}
	
	/**
	 * Scrapes a page (called when the capture icon is clicked
	 * @return	void
	 */
	this.scrapeThisPage = function (translator, event) {
		// Perform translation
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		if(tab.page.translators && tab.page.translators.length) {
			tab.page.translate.setTranslator(translator || tab.page.translators[0]);
			Zotero_Browser.performTranslation(tab.page.translate);
		}
		else {
			// Keep in sync with cmd_zotero_newItemFromCurrentPage
			//
			// DEBUG: Possible to just trigger command directly with event? Assigning it to the
			// command property of the icon doesn't seem to work, and neither does goDoCommand()
			// from chrome://global/content/globalOverlay.js. Getting the command by id and
			// running doCommand() works but doesn't pass the event.
			ZoteroPane.addItemFromPage(
				'temporaryPDFHack',
				(event && event.shiftKey) ? !Zotero.Prefs.get('automaticSnapshots') : null
			);
		}
	}
	
	/*
	 * flags a page for annotation
	 */
	function annotatePage(id, browser) {
		if (browser) {
			var tab = _getTabObject(browser);
		}
		else {
			var tab = _getTabObject(this.tabbrowser.selectedBrowser);
		}
	}
	
	/*
	 * toggles a tool on/off
	 */
	function toggleMode(toggleTool, ignoreOtherTools) {
		// make sure other tools are turned off
		if(!ignoreOtherTools) {
			for(var tool in tools) {
				if(tool != toggleTool && document.getElementById(tool).getAttribute("tool-active")) {
					toggleMode(tool, true);
				}
			}
		}
		
		// make sure annotation action is toggled
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		if(tab.page && tab.page.annotations && tab.page.annotations.clearAction) tab.page.annotations.clearAction();
		
		if(!toggleTool) return;
		
		var body = Zotero_Browser.tabbrowser.selectedBrowser.contentDocument.getElementsByTagName("body")[0];
		var addElement = document.getElementById(toggleTool);
		
		if(addElement.getAttribute("tool-active")) {
			// turn off
			body.style.cursor = "auto";
			addElement.removeAttribute("tool-active");
			Zotero_Browser.tabbrowser.selectedBrowser.removeEventListener(tools[toggleTool].event, tools[toggleTool].callback, true);
		} else {
			body.style.cursor = tools[toggleTool].cursor;
			addElement.setAttribute("tool-active", "true");
			Zotero_Browser.tabbrowser.selectedBrowser.addEventListener(tools[toggleTool].event, tools[toggleTool].callback, true);
		}
	}
	
	/*
	 * expands all annotations
	 */
	function toggleCollapsed() {
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		tab.page.annotations.toggleCollapsed();
	}
	
	/*
	 * When chrome loads, register our event handlers with the appropriate interfaces
	 */
	function chromeLoad() {
		this.tabbrowser = gBrowser;
		this.appcontent = document.getElementById("appcontent");
		
		// this gives us onLocationChange, for updating when tabs are switched/created
		gBrowser.tabContainer.addEventListener("TabClose",
			function(e) {
				//Zotero.debug("TabClose");
				Zotero_Browser.tabClose(e);
			}, false);
		gBrowser.tabContainer.addEventListener("TabSelect",
			function(e) {
				//Zotero.debug("TabSelect");
				Zotero_Browser.updateStatus();
			}, false);
		// this is for pageshow, for updating the status of the book icon
		this.appcontent.addEventListener("pageshow", contentLoad, true);
		// this is for turning off the book icon when a user navigates away from a page
		this.appcontent.addEventListener("pagehide",
			function(e) {
				//Zotero.debug("pagehide");
				Zotero_Browser.contentHide(e);
			}, true);
		
		this.tabbrowser.addEventListener("resize",
			function(e) { Zotero_Browser.resize(e) }, false);
		// Resize on text zoom changes
		
		// Fx2
		var reduce = document.getElementById('cmd_textZoomReduce');
		if (reduce) {
			var enlarge = document.getElementById('cmd_textZoomEnlarge');
			var reset = document.getElementById('cmd_textZoomReset');
		}
		// Fx3
		else {
			var reduce = document.getElementById('cmd_fullZoomReduce');
			var enlarge = document.getElementById('cmd_fullZoomEnlarge');
			var reset = document.getElementById('cmd_fullZoomReset');
		}
		
		if(reduce) reduce.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
		if(enlarge) enlarge.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
		if(reset) reset.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
	}
	
	
	/*
	 * An event handler called when a new document is loaded. Creates a new document
	 * object, and updates the status of the capture icon
	 */
	function contentLoad(event) {
		var doc = event.originalTarget;
		var isHTML = doc instanceof HTMLDocument;
		var rootDoc = (doc instanceof HTMLDocument ? doc.defaultView.top.document : doc);
		var browser = Zotero_Browser.tabbrowser.getBrowserForDocument(rootDoc);
		if(!browser) return;
		
		if(isHTML) {
			// ignore blacklisted domains
			try {
				if(doc.domain) {
					for (let i = 0; i < _blacklist.length; i++) {
						let blacklistedURL = _blacklist[i];
						if(doc.domain.substr(doc.domain.length-blacklistedURL.length) == blacklistedURL) {
							Zotero.debug("Ignoring blacklisted URL "+doc.location);
							return;
						}
					}
				}
			}
			catch (e) {}
		}
		
		try {
			if (_locationBlacklist.indexOf(doc.location.href) != -1) {
				return;
			}
			
			// Ignore TinyMCE popups
			if (!doc.location.host && doc.location.href.indexOf("tinymce/") != -1) {
				return;
			}
		}
		catch (e) {}
		
		// get data object
		var tab = _getTabObject(browser);
		
		if(isHTML && !Zotero.isConnector) {
			var annotationID = Zotero.Annotate.getAnnotationIDFromURL(browser.currentURI.spec);
			if(annotationID) {
				if(Zotero.Annotate.isAnnotated(annotationID)) {
					//window.alert(Zotero.getString("annotations.oneWindowWarning"));
				} else if(!tab.page.annotations) {
					// enable annotation
					tab.page.annotations = new Zotero.Annotations(Zotero_Browser, browser, annotationID);
					var saveAnnotations = function() {
						tab.page.annotations.save();
						tab.page.annotations = undefined;
					};
					browser.contentWindow.addEventListener('beforeunload', saveAnnotations, false);
					browser.contentWindow.addEventListener('close', saveAnnotations, false);
					tab.page.annotations.load();
				}
			}
		}
		
		// detect translators
		tab.detectTranslators(rootDoc, doc);
		
		// register metadata updated event
		if(isHTML) {
			var contentWin = doc.defaultView;
			if(!contentWin.haveZoteroEventListener) {
				contentWin.addEventListener("ZoteroItemUpdated", function(event) { itemUpdated(event.originalTarget) }, false);
				contentWin.haveZoteroEventListener = true;
			}
		}
	}

	/*
	 * called to unregister Zotero icon, etc.
	 */
	function contentHide(event) {
		var doc = event.originalTarget;
		if(!(doc instanceof HTMLDocument)) return;
	
		var rootDoc = (doc instanceof HTMLDocument ? doc.defaultView.top.document : doc);
		var browser = Zotero_Browser.tabbrowser.getBrowserForDocument(rootDoc);
		if(!browser) return;
		
		var tab = _getTabObject(browser);
		if(!tab) return;
		
		if(doc == tab.page.document || doc == rootDoc) {
			// clear translator only if the page on which the pagehide event was called is
			// either the page to which the translator corresponded, or the root document
			// (the second check is probably paranoid, but won't hurt)
			tab.clear();
		}
		
		// update status
		if(Zotero_Browser.tabbrowser.selectedBrowser == browser) {
			updateStatus();
		}
	}
	
	/**
	 * Called when item should be updated due to a DOM event
	 */
	function itemUpdated(doc) {
		try {
			var rootDoc = (doc instanceof HTMLDocument ? doc.defaultView.top.document : doc);
			var browser = Zotero_Browser.tabbrowser.getBrowserForDocument(rootDoc);
			var tab = _getTabObject(browser);
			if(doc == tab.page.document || doc == rootDoc) tab.clear();
			tab.detectTranslators(rootDoc, doc);
		} catch(e) {
			Zotero.debug(e);
		}
	}
	
	/*
	 * called when a tab is closed
	 */
	function tabClose(event) {
		// Save annotations when closing a tab, since the browser is already
		// gone from tabbrowser by the time contentHide() gets called
		var tab = _getTabObject(event.target);
		if(tab.page && tab.page.annotations) tab.page.annotations.save();
		tab.clear();
		
		// To execute if document object does not exist
		toggleMode();
	}
	
	
	/*
	 * called when the window is resized
	 */
	function resize(event) {
		var tab = _getTabObject(this.tabbrowser.selectedBrowser);
		if(!tab.page.annotations) return;
		
		tab.page.annotations.refresh();
	}
	
	/*
	 * Updates the status of the capture icon to reflect the scrapability or lack
	 * thereof of the current page
	 */
	function updateStatus() {
		if (!Zotero_Browser.tabbrowser) return;
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		
		Components.utils.import("resource:///modules/CustomizableUI.jsm");
		var buttons = getSaveButtons();
		if (buttons.length) {
			let state = tab.getCaptureState();
			let tooltiptext = tab.getCaptureTooltip();
			for (let { button, placement } of buttons) {
				let inToolbar = placement.area == CustomizableUI.AREA_NAVBAR;
				button.image = tab.getCaptureIcon(Zotero.hiDPI || !inToolbar);
				button.tooltipText = tooltiptext;
				if (state == tab.CAPTURE_STATE_TRANSLATABLE) {
					button.classList.add('translate');
					
					// Show guidance panel if necessary
					if (inToolbar) {
						button.addEventListener("load", function() {
							document.getElementById("zotero-status-image-guidance").show();
						});
					}
					// TODO: Different guidance for web pages?
				}
				else {
					button.classList.remove('translate');
				}
				button.removeAttribute('disabled');
			}
		}
		
		// set annotation bar status
		if(tab.page.annotations && tab.page.annotations.annotations.length) {
			document.getElementById('zotero-annotate-tb').hidden = false;
			toggleMode();
		} else {
			document.getElementById('zotero-annotate-tb').hidden = true;
		}
	}
	
	function getSaveButtons() {
		Components.utils.import("resource:///modules/CustomizableUI.jsm");
		var buttons = [];
		
		var placement = CustomizableUI.getPlacementOfWidget("zotero-toolbar-buttons");
		if (placement) {
			let button = document.getElementById("zotero-toolbar-save-button");
			if (button) {
				buttons.push({
					button: button,
					placement: placement
				});
			}
		}
		
		placement = CustomizableUI.getPlacementOfWidget("zotero-toolbar-save-button-single");
		if (placement) {
			let button = document.getElementById("zotero-toolbar-save-button-single");
			if (button) {
				buttons.push({
					button: button,
					placement: placement
				});
			}
		}
		
		return buttons;
	}
	
	/**
	 * Called when status bar icon is right-clicked
	 */
	this.onStatusPopupShowing = function(e) {
		var popup = e.target;
		while(popup.hasChildNodes()) popup.removeChild(popup.lastChild);
		
		var tab = _getTabObject(this.tabbrowser.selectedBrowser);
		
		if (tab.getCaptureState() == tab.CAPTURE_STATE_TRANSLATABLE) {
			let translators = tab.page.translators;
			for (var i=0, n = translators.length; i < n; i++) {
				let translator = translators[i];
				
				let menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label",
					Zotero.getString("ingester.saveToZoteroUsing", translator.label));
				menuitem.setAttribute("image", (translator.itemType === "multiple"
					? "chrome://zotero/skin/treesource-collection.png"
					: Zotero.ItemTypes.getImageSrc(translator.itemType)));
				menuitem.setAttribute("class", "menuitem-iconic");
				menuitem.addEventListener("command", function(e) {
					Zotero_Browser.scrapeThisPage(translator, e);
					e.stopPropagation();
				}, false);
				popup.appendChild(menuitem);
			}
			
			popup.appendChild(document.createElement("menuseparator"));
			
			let menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Zotero.getString("locate.libraryLookup.label"));
			menuitem.setAttribute("tooltiptext", Zotero.getString("locate.libraryLookup.tooltip"));
			menuitem.setAttribute("image", "chrome://zotero/skin/locate-library-lookup.png");
			menuitem.setAttribute("class", "menuitem-iconic");
			menuitem.addEventListener("command", _constructLookupFunction(tab, function(event, obj) {
				var urls = [];
				for (let i = 0; i < obj.newItems.length; i++) {
					var url = Zotero.OpenURL.resolve(obj.newItems[i]);
					if(url) urls.push(url);
				}
				ZoteroPane.loadURI(urls, event);
			}), false);
			popup.appendChild(menuitem);		
			
			var locateEngines = Zotero.LocateManager.getVisibleEngines();
			Zotero_LocateMenu.addLocateEngines(popup, locateEngines,
				_constructLookupFunction(tab, function(e, obj) {
					Zotero_LocateMenu.locateItem(e, obj.newItems);
				}), true);
		}
		else {
			let webPageIcon = tab.getCaptureIcon(Zotero.hiDPI);
			let automaticSnapshots = Zotero.Prefs.get('automaticSnapshots');
			let snapshotEvent = {
				shiftKey: !automaticSnapshots
			};
			let noSnapshotEvent = {
				shiftKey: automaticSnapshots
			};
			
			let menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", "Save to Zotero as Web Page (with snapshot)");
			menuitem.setAttribute("image", webPageIcon);
			menuitem.setAttribute("class", "menuitem-iconic");
			menuitem.addEventListener("command", function (event) {
				Zotero_Browser.scrapeThisPage(null, snapshotEvent);
				event.stopPropagation();
			});
			popup.appendChild(menuitem);
			
			menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", "Save to Zotero as Web Page (without snapshot)");
			menuitem.setAttribute("image", webPageIcon);
			menuitem.setAttribute("class", "menuitem-iconic");
			menuitem.addEventListener("command", function (event) {
				Zotero_Browser.scrapeThisPage(null, noSnapshotEvent);
				event.stopPropagation();
			});
			popup.appendChild(menuitem);
		}
	}
	
	/**
	 * Translates using the specified translation instance. setTranslator() must already
	 * have been called
	 * @param {Zotero.Translate} translate
	 */
	this.performTranslation = function(translate, libraryID, collection) {
		if (Zotero.locked) {
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
			var desc = Zotero.localeJoin([
				Zotero.getString('general.operationInProgress'),
				Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
			]);
			Zotero_Browser.progress.addDescription(desc);
			Zotero_Browser.progress.show();
			Zotero_Browser.progress.startCloseTimer(8000);
			return;
		}
		
		if (!Zotero.stateCheck()) {
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
			var desc = Zotero.getString("ingester.scrapeErrorDescription.previousError")
				+ ' ' + Zotero.getString("general.restartFirefoxAndTryAgain", Zotero.appName);
			Zotero_Browser.progress.addDescription(desc);
			Zotero_Browser.progress.show();
			Zotero_Browser.progress.startCloseTimer(8000);
			return;
		}
		
		Zotero_Browser.progress.show();
		Zotero_Browser.isScraping = true;
		
		// Get libraryID and collectionID
		if(libraryID === undefined && ZoteroPane && !Zotero.isConnector) {
			try {
				if (!ZoteroPane.collectionsView.editable) {
					Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
					var desc = Zotero.getString('save.error.cannotMakeChangesToCollection');
					Zotero_Browser.progress.addDescription(desc);
					Zotero_Browser.progress.show();
					Zotero_Browser.progress.startCloseTimer(8000);
					return;
				}
				
				libraryID = ZoteroPane.getSelectedLibraryID();
				collection = ZoteroPane.getSelectedCollection();
			} catch(e) {
				Zotero.debug(e, 1);
			}
		}
		
		if(Zotero.isConnector) {
			Zotero.Connector.callMethod("getSelectedCollection", {}, function(response, status) {
				if(status !== 200) {
					Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scraping"));
				} else {
					Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapingTo"),
						"chrome://zotero/skin/treesource-"+(response.id ? "collection" : "library")+".png",
						response.name+"\u2026");
				}
			});
		} else {
			var name;
			if(collection) {
				name = collection.name;
			} else if(libraryID) {
				name = Zotero.Libraries.getName(libraryID);
			} else {
				name = Zotero.getString("pane.collections.library");
			}
			
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapingTo"),
				"chrome://zotero/skin/treesource-"+(collection ? "collection" : "library")+".png",
				name+"\u2026");
		}
		
		translate.clearHandlers("done");
		translate.clearHandlers("itemDone");
		translate.clearHandlers("attachmentProgress");
		
		translate.setHandler("done", function(obj, returnValue) {		
			if(!returnValue) {
				Zotero_Browser.progress.show();
				Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
				// Include link to translator troubleshooting page
				var url = "https://www.zotero.org/support/troubleshooting_translator_issues";
				var linkText = '<a href="' + url + '" tooltiptext="' + url + '">'
					+ Zotero.getString('ingester.scrapeErrorDescription.linkText') + '</a>';
				Zotero_Browser.progress.addDescription(Zotero.getString("ingester.scrapeErrorDescription", linkText));
				Zotero_Browser.progress.startCloseTimer(8000);
			} else {
				Zotero_Browser.progress.startCloseTimer();
			}
			Zotero_Browser.isScraping = false;
		});
		
		translate.setHandler("itemDone", function(obj, dbItem, item) {
			Zotero_Browser.progress.show();
			var itemProgress = new Zotero_Browser.progress.ItemProgress(Zotero.ItemTypes.getImageSrc(item.itemType),
				item.title);
			itemProgress.setProgress(100);
			for(var i=0; i<item.attachments.length; i++) {
				var attachment = item.attachments[i];
				_attachmentsMap.set(attachment,
					new Zotero_Browser.progress.ItemProgress(
						Zotero.Utilities.determineAttachmentIcon(attachment),
						attachment.title, itemProgress));
			}
			
			// add item to collection, if one was specified
			if(collection) {
				collection.addItem(dbItem.id);
			}
		});
		
		translate.setHandler("attachmentProgress", function(obj, attachment, progress, error) {
			var itemProgress = _attachmentsMap.get(attachment);
			if(progress === false) {
				itemProgress.setError();
			} else {
				itemProgress.setProgress(progress);
				if(progress === 100) {
					itemProgress.setIcon(Zotero.Utilities.determineAttachmentIcon(attachment));
				}
			}
		});
		
		translate.translate(libraryID);
	}
	
	
	//////////////////////////////////////////////////////////////////////////////
	//
	// Private Zotero_Browser methods
	//
	//////////////////////////////////////////////////////////////////////////////
	
	function _constructLookupFunction(tab, success) {
		return function(e) {
			tab.page.translate.setTranslator(tab.page.translators[0]);
			tab.page.translate.clearHandlers("done");
			tab.page.translate.clearHandlers("itemDone");
			tab.page.translate.setHandler("done", function(obj, status) {
				if(status) {
					success(e, obj);
					Zotero_Browser.progress.close();
				} else {
					Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.lookup.error"));
					Zotero_Browser.progress.startCloseTimer(8000);
				}
			});
			
			Zotero_Browser.progress.show();
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.lookup.performing"));
			tab.page.translate.translate(false);
			e.stopPropagation();
		}
	}
	
	/*
	 * Gets a data object given a browser window object
	 */
	function _getTabObject(browser) {
		if(!browser) return false;
		if(!browser.zoteroBrowserData) {
			browser.zoteroBrowserData = new Zotero_Browser.Tab(browser);
		}
		return browser.zoteroBrowserData;
	}
	
	/**
	 * Adds an annotation
	 */
	 function _add(type, e) {
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		
		if(type == "annotation") {
			// ignore click if it's on an existing annotation
			if(e.target.getAttribute("zotero-annotation")) return;
			
			var annotation = tab.page.annotations.createAnnotation();
			annotation.initWithEvent(e);
			
			// disable add mode, now that we've used it
			toggleMode();
		} else {
			try {
				var selection = Zotero_Browser.tabbrowser.selectedBrowser.contentWindow.getSelection();
			} catch(err) {
				return;
			}
			if(selection.isCollapsed) return;
			
			if(type == "highlight") {
	 			tab.page.annotations.highlight(selection.getRangeAt(0));
			} else if(type == "unhighlight") {
	 			tab.page.annotations.unhighlight(selection.getRangeAt(0));
			}
			
			selection.removeAllRanges();
		}
		
		// stop propagation
		e.stopPropagation();
		e.preventDefault();
	 }
}


//////////////////////////////////////////////////////////////////////////////
//
// Zotero_Browser.Tab
//
//////////////////////////////////////////////////////////////////////////////

Zotero_Browser.Tab = function(browser) {
	this.browser = browser;
	this.page = new Object();
}

Zotero_Browser.Tab.prototype.CAPTURE_STATE_DISABLED = 0;
Zotero_Browser.Tab.prototype.CAPTURE_STATE_GENERIC = 1;
Zotero_Browser.Tab.prototype.CAPTURE_STATE_TRANSLATABLE = 2;

/*
 * clears page-specific information
 */
Zotero_Browser.Tab.prototype.clear = function() {
	delete this.page;
	this.page = new Object();
}

/*
 * detects translators for this browser object
 */
Zotero_Browser.Tab.prototype.detectTranslators = function(rootDoc, doc) {
	if (doc instanceof HTMLDocument) {
		if (doc.documentURI.startsWith("about:")) {
			this.page.saveEnabled = false;
			return;
		}
		
		// get translators
		var me = this;
		
		var translate = new Zotero.Translate.Web();
		translate.setDocument(doc);
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		translate.setHandler("pageModified", function(translate, doc) { Zotero_Browser.itemUpdated(doc) });
		translate.getTranslators(true);
	} else if(doc.documentURI.substr(0, 7) == "file://") {
		this._attemptLocalFileImport(doc);
	}
}


/*
 * searches for a document in all of the frames of a given document
 */
Zotero_Browser.Tab.prototype._searchFrames = function(rootDoc, searchDoc) {
	if(rootDoc == searchDoc) return true;
	var frames = rootDoc.getElementsByTagName("frame");
	for (let i = 0; i < frames.length; i++) {
		let frame = frames[i];
		if(frame.contentDocument &&
				(frame.contentDocument == searchDoc ||
				this._searchFrames(frame.contentDocument, searchDoc))) {
			return true;
		}
	}
	
	var frames = rootDoc.getElementsByTagName("iframe");
	for (let i = 0; i < frames.length; i++) {
		let frame = frames[i];
		if(frame.contentDocument &&
				(frame.contentDocument == searchDoc ||
				this._searchFrames(frame.contentDocument, searchDoc))) {
			return true;
		}
	}
	
	return false;
}

/*
 * Attempts import of a file; to be run on local files only
 */
Zotero_Browser.Tab.prototype._attemptLocalFileImport = function(doc) {
	if(doc.documentURI.match(/\.csl(\.xml|\.txt)?$/i)) {
		// read CSL string
		var csl = Zotero.File.getContentsFromURL(doc.documentURI);
		if(csl.indexOf("http://purl.org/net/xbiblio/csl") != -1) {
			// looks like a CSL; try to import
			Zotero.Styles.install(csl, doc.documentURI);
		}
	} else {
		// see if we can import this file
		var file = Components.classes["@mozilla.org/network/protocol;1?name=file"]
									.getService(Components.interfaces.nsIFileProtocolHandler)
									.getFileFromURLSpec(doc.documentURI);
		
		var me = this;
		var translate = new Zotero.Translate.Import();
		translate.setLocation(file);
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		translate.getTranslators();
	}
}


Zotero_Browser.Tab.prototype.getCaptureState = function () {
	if (!this.page.saveEnabled) {
		return this.CAPTURE_STATE_DISABLED;
	}
	if (this.page.translators && this.page.translators.length) {
		return this.CAPTURE_STATE_TRANSLATABLE;
	}
	return this.CAPTURE_STATE_GENERIC;
}

/*
 * returns the URL of the image representing the translator to be called on the
 * current page, or false if the page cannot be scraped
 */
Zotero_Browser.Tab.prototype.getCaptureIcon = function (hiDPI) {
	var suffix = hiDPI ? "@2x" : "";
	
	switch (this.getCaptureState()) {
	case this.CAPTURE_STATE_TRANSLATABLE:
		var itemType = this.page.translators[0].itemType;
		return (itemType === "multiple"
				? "chrome://zotero/skin/treesource-collection" + suffix + ".png"
				: Zotero.ItemTypes.getImageSrc(itemType));
	
	// TODO: Show icons for images, PDFs, etc.?
	default:
		return "chrome://zotero/skin/treeitem-webpage" + suffix + ".png";
	}
}

Zotero_Browser.Tab.prototype.getCaptureTooltip = function() {
	switch (this.getCaptureState()) {
	case this.CAPTURE_STATE_DISABLED:
		var text = Zotero.getString('ingester.saveToZotero');
		break;
	
	case this.CAPTURE_STATE_TRANSLATABLE:
		var text = Zotero.getString('ingester.saveToZotero');
		if (this.page.translators[0].itemType == 'multiple') {
			text += '…';
		}
		text += ' (' + this.page.translators[0].label + ')';
		break;
	
	// TODO: Different captions for images, PDFs, etc.?
	default:
		var text = Zotero.getString('ingester.saveToZotero')
			+ " (" + Zotero.getString('itemTypes.webpage') + ")";
	}
	
	var key = Zotero.Keys.getKeyForCommand('saveToZotero');
	if (key) {
		// Add RLE mark in RTL mode to make shortcut render the right way
		text += (Zotero.rtl ? ' \u202B' : ' ') + '('
		+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
		+ key
		+ ')';
	}
	
	return text;
}

Zotero_Browser.Tab.prototype.getCaptureCommand = function () {
	switch (this.getCaptureState()) {
	case this.CAPTURE_STATE_DISABLED:
		return '';
	case this.CAPTURE_STATE_TRANSLATABLE:
		return '';
	default:
		return 'cmd_zotero_newItemFromCurrentPage';
	}
}


/**********CALLBACKS**********/

/*
 * called when a user is supposed to select items
 */
Zotero_Browser.Tab.prototype._selectItems = function(obj, itemList, callback) {
	// this is kinda ugly, mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = window.openDialog("chrome://zotero/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	
	if(!io.dataOut) {	// user selected no items, so close the progress indicatior
		Zotero_Browser.progress.close();
	}
	
	callback(io.dataOut);
}

/*
 * called when translators are available
 */
Zotero_Browser.Tab.prototype._translatorsAvailable = function(translate, translators) {
	this.page.saveEnabled = true;
	
	if(translators && translators.length) {
		//see if we should keep the previous set of translators
		if(//we already have a translator for part of this page
			this.page.translators && this.page.translators.length && this.page.document.location
			//and the page is still there
			&& this.page.document.defaultView && !this.page.document.defaultView.closed
			//this set of translators is not targeting the same URL as a previous set of translators,
			// because otherwise we want to use the newer set,
			// but only if it's not in a subframe of the previous set
			&& (this.page.document.location.href != translate.document.location.href ||
				Zotero.Utilities.Internal.isIframeOf(translate.document.defaultView, this.page.document.defaultView))
				//the best translator we had was of higher priority than the new set
			&& (this.page.translators[0].priority < translators[0].priority
				//or the priority was the same, but...
				|| (this.page.translators[0].priority == translators[0].priority
					//the previous set of translators targets the top frame or the current one does not either
					&& (this.page.document.defaultView == this.page.document.defaultView.top
						|| translate.document.defaultView !== this.page.document.defaultView.top)
			))
		) {
			Zotero.debug("Translate: a better translator was already found for this page");
			return; //keep what we had
		} else {
			this.clear(); //clear URL bar icon
			this.page.saveEnabled = true;
		}
		
		Zotero.debug("Translate: found translators for page\n"
			+ "Best translator: " + translators[0].label + " with priority " + translators[0].priority);
		
		this.page.translate = translate;
		this.page.translators = translators;
		this.page.document = translate.document;
	
		this.page.translate.clearHandlers("select");
		this.page.translate.setHandler("select", this._selectItems);
	} else if(translate.type != "import" && translate.document.documentURI.length > 7
			&& translate.document.documentURI.substr(0, 7) == "file://") {
		this._attemptLocalFileImport(translate.document);
	}
	
	if(!translators || !translators.length) Zotero.debug("Translate: No translators found");
	
	Zotero_Browser.updateStatus();
}

Zotero_Browser.init();