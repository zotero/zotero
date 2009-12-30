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
	this.scrapeThisPage = scrapeThisPage;
	this.annotatePage = annotatePage;
	this.toggleMode = toggleMode;
	this.toggleCollapsed = toggleCollapsed;
	this.chromeLoad = chromeLoad;
	this.chromeUnload = chromeUnload;
	this.contentLoad = contentLoad;
	this.contentHide = contentHide;
	this.tabClose = tabClose;
	this.resize = resize;
	this.updateStatus = updateStatus;
	this.finishScraping = finishScraping;
	this.itemDone = itemDone;
	
	this.tabbrowser = null;
	this.appcontent = null;
	this.statusImage = null;
	this.isScraping = false;
	
	var _scrapePopupShowing = false;
	var _browserData = new Object();
	
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
	
	
	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		Zotero_Browser.browserData = new Object();
		Zotero_Browser._scrapePopupShowing = false;
		
		window.addEventListener("load",
			function(e) { Zotero_Browser.chromeLoad(e) }, false);
		window.addEventListener("unload",
			function(e) { Zotero_Browser.chromeUnload(e) }, false);
	}
	
	/**
	 * Scrapes a page (called when the capture icon is clicked)
	 *
	 * @param	{Integer}	libraryID
	 * @param	{Integer}	collectionID
	 * @return	void
	 */
	function scrapeThisPage(libraryID, collectionID) {
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
			return;
		}
		
		if (!Zotero.stateCheck()) {
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
			var desc = Zotero.getString("ingester.scrapeErrorDescription.previousError")
				+ ' ' + Zotero.getString("general.restartFirefoxAndTryAgain");
			Zotero_Browser.progress.addDescription(desc);
			Zotero_Browser.progress.show();
			Zotero_Browser.progress.startCloseTimer(8000);
			return;
		}
		_getTabObject(this.tabbrowser.selectedBrowser).translate(libraryID, collectionID);
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
	 * called to hide the collection selection popup
	 */
	function hidePopup(collectionID) {
		_scrapePopupShowing = false;
	}

	/*
	 * called to show the collection selection popup
	 *
	 * not currently used
	 */
	function showPopup(collectionID, parentElement) {
		if(_scrapePopupShowing && parentElement.hasChildNodes()) {
			return false;	// Don't dynamically reload popups that are already showing
		}
		_scrapePopupShowing = true;
		parentElement.removeAllItems();
		
		if(collectionID == null) {	// show library
			var newItem = document.createElement("menuitem");
			newItem.setAttribute("label", Zotero.getString("pane.collections.library"));
			newItem.setAttribute("class", "menuitem-iconic zotero-scrape-popup-library");
			newItem.setAttribute("oncommand", 'Zotero_Browser.scrapeThisPage()');
			parentElement.appendChild(newItem);
		}
		
		var childrenList = Zotero.getCollections(collectionID);
		for(var i = 0; i < childrenList.length; i++) {
			if(childrenList[i].hasChildCollections()) {
				var newItem = document.createElement("menu");
				var subMenu = document.createElement("menupopup");
				subMenu.setAttribute("onpopupshowing", 'Zotero_Browser.showPopup("'+childrenList[i].getID()+'", this)');
				newItem.setAttribute("class", "menu-iconic zotero-scrape-popup-collection");
				newItem.appendChild(subMenu);
			} else {
				var newItem = document.createElement("menuitem");
				newItem.setAttribute("class", "menuitem-iconic zotero-scrape-popup-collection");
			}
			newItem.setAttribute("label", childrenList[i].getName());
			newItem.setAttribute("oncommand", 'Zotero_Browser.scrapeThisPage("'+childrenList[i].getID()+'")');
			
			parentElement.appendChild(newItem);
		}
		
		return true;
	}
	
	/*
	 * When chrome loads, register our event handlers with the appropriate interfaces
	 */
	function chromeLoad() {
		this.tabbrowser = document.getElementById("content");
		this.appcontent = document.getElementById("appcontent");
		this.statusImage = document.getElementById("zotero-status-image");
		
		// this gives us onLocationChange, for updating when tabs are switched/created
		this.tabbrowser.addEventListener("TabClose",
			function(e) {
				//Zotero.debug("TabClose");
				Zotero_Browser.tabClose(e);
			}, false);
		this.tabbrowser.addEventListener("TabSelect",
			function(e) {
				//Zotero.debug("TabSelect");
				Zotero_Browser.updateStatus();
			}, false);
		// this is for pageshow, for updating the status of the book icon
		this.appcontent.addEventListener("pageshow",
			function(e) {
				//Zotero.debug("pageshow");
				Zotero_Browser.contentLoad(e);
			}, true);
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
		
		reduce.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
		enlarge.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
		reset.addEventListener("command",
			function(e) { Zotero_Browser.resize(e) }, false);
	}
	
	/*
	 * When chrome unloads, delete our document objects
	 */
	function chromeUnload() {
		delete Zotero_Browser.browserData;
	}
	
	/*
	 * An event handler called when a new document is loaded. Creates a new document
	 * object, and updates the status of the capture icon
	 */
	function contentLoad(event) {
		var isHTML = event.originalTarget instanceof HTMLDocument;
		var doc = event.originalTarget;
		var rootDoc = doc;
		
		if(isHTML) {
			// get the appropriate root document to check which browser we're on
			while(rootDoc.defaultView.frameElement) {
				rootDoc = rootDoc.defaultView.frameElement.ownerDocument;
			}
			
			// ignore blacklisted domains
			try {
				if(doc.domain) {
					for each(var blacklistedURL in _blacklist) {
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
		}
		catch (e) {}
		
		// Figure out what browser this contentDocument is associated with
		var browser;
		for(var i=0; i<this.tabbrowser.browsers.length; i++) {
			if(rootDoc == this.tabbrowser.browsers[i].contentDocument) {
				browser = this.tabbrowser.browsers[i];
				break;
			}
		}
		if(!browser) return;
		
		// get data object
		var tab = _getTabObject(browser);
		
		if(isHTML) {
			var annotationID = Zotero.Annotate.getAnnotationIDFromURL(browser.currentURI.spec);
			if(annotationID) {
				if(Zotero.Annotate.isAnnotated(annotationID)) {
					window.alert(Zotero.getString("annotations.oneWindowWarning"));
				} else if(!tab.page.annotations) {
					// enable annotation
					tab.page.annotations = new Zotero.Annotations(this, browser, annotationID);
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
	}

	/*
	 * called to unregister Zotero icon, etc.
	 */
	function contentHide(event) {
		if(event.originalTarget instanceof HTMLDocument) {
			// Get root document if this is a frameset
			var doc = event.originalTarget;
			var rootDoc = doc;
			while(rootDoc.defaultView.frameElement) {
				rootDoc = rootDoc.defaultView.frameElement.ownerDocument;
			}
			
			// Figure out what browser this contentDocument is associated with
			var browser;
			for(var i=0; i<this.tabbrowser.browsers.length; i++) {
				if(rootDoc == this.tabbrowser.browsers[i].contentDocument) {
					browser = this.tabbrowser.browsers[i];
					break;
				}
			}
			
			var tab = _getTabObject(browser);
			if(!tab) return;
			if(doc == tab.page.document || doc == rootDoc) {
				// clear translator only if the page on which the pagehide event was called is
				// either the page to which the translator corresponded, or the root document
				// (the second check is probably paranoid, but won't hurt)
				tab.clear();
			}
			
			// update status
			if(this.tabbrowser.selectedBrowser == browser) {
				updateStatus();
			}
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
		_deleteTabObject(event.target.linkedBrowser);
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
		var tab = _getTabObject(Zotero_Browser.tabbrowser.selectedBrowser);
		
		var captureIcon = tab.getCaptureIcon();
		if(captureIcon) {
			Zotero_Browser.statusImage.src = captureIcon;
			Zotero_Browser.statusImage.tooltipText = tab.getCaptureTooltip();
			Zotero_Browser.statusImage.hidden = false;
		} else {
			Zotero_Browser.statusImage.hidden = true;
		}
		
		// set annotation bar status
		if(tab.page.annotations) {
			document.getElementById('zotero-annotate-tb').hidden = false;
			toggleMode();
		} else {
			document.getElementById('zotero-annotate-tb').hidden = true;
		}
	}
	
	/*
	 * Callback to be executed when scraping is complete
	 */
	function finishScraping(obj, returnValue) {
		if(!returnValue) {
			Zotero_Browser.progress.show();
			Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
			// Include link to Known Translator Issues page
			var url = "http://www.zotero.org/documentation/known_translator_issues";
			var linkText = '<a href="' + url + '" tooltiptext="' + url + '">'
				+ Zotero.getString('ingester.scrapeErrorDescription.linkText') + '</a>';
			Zotero_Browser.progress.addDescription(Zotero.getString("ingester.scrapeErrorDescription", linkText));
			Zotero_Browser.progress.startCloseTimer(8000);
		} else {
			Zotero_Browser.progress.startCloseTimer();
		}
		Zotero_Browser.isScraping = false;
	}
	
	
	/*
	 * Callback to be executed when an item has been finished
	 */
	function itemDone(obj, item, collection) {
		var title = item.getField("title", false, true);
		var icon = item.getImageSrc();
		Zotero_Browser.progress.show();
		Zotero_Browser.progress.changeHeadline(Zotero.getString("ingester.scraping"));
		Zotero_Browser.progress.addLines([title], [icon]);
		
		// add item to collection, if one was specified
		if(collection) {
			collection.addItem(item.getID());
		}
		
		if(Zotero_Browser.isScraping) {
			// initialize close timer between item saves in case translator doesn't call done
			Zotero_Browser.progress.startCloseTimer(10000);	// is this long enough?
		} else {
			// if we aren't supposed to be scraping now, the translator is broken; assume we're
			// done
			Zotero_Browser.progress.startCloseTimer();
		}
	}
	
	//////////////////////////////////////////////////////////////////////////////
	//
	// Private Zotero_Browser methods
	//
	//////////////////////////////////////////////////////////////////////////////
	
	/*
	 * Gets a data object given a browser window object
	 * 
	 * NOTE: Browser objects are associated with document objects via keys generated
	 * from the time the browser object is opened. I'm not sure if this is the
	 * appropriate mechanism for handling this, but it's what PiggyBank used and it
	 * appears to work.
	 *
	 * Currently, the data object contains only one property: "translators," which
	 * is an array of translators that should work with the given page as returned
	 * from Zotero.Translate.getTranslator()
	 */
	function _getTabObject(browser) {
		if(!browser) return false;
		try {
			var key = browser.getAttribute("zotero-key");
			if(_browserData[key]) {
				return _browserData[key];
			}
		} finally {
			if(!key) {
				var key = (new Date()).getTime();
				browser.setAttribute("zotero-key", key);
				return (_browserData[key] = new Zotero_Browser.Tab(browser));
			}
		}
		return false;
	}
	
	/*
	 * Deletes the document object associated with a given browser window object
	 */
	function _deleteTabObject(browser) {
		if(!browser) return false;
		try {
			var key = browser.getAttribute("zotero-key");
			if(_browserData[key]) {
				delete _browserData[key];
				return true;
			}
		} finally {}
		return false;
	}
	
	/*
	 * adds an annotation
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
	// if there's already a scrapable page in the browser window, and it's
	// still there, ensure it is actually part of the page, then return
	if(this.page.translators && this.page.translators.length && this.page.document.location) {
		if(this._searchFrames(rootDoc, this.page.document)) return;
		this.clear();
	}
	
	if(doc instanceof HTMLDocument && doc.documentURI.substr(0, 6) != "about:") {
		// get translators
		var me = this;
		
		var translate = new Zotero.Translate("web");
		translate.setDocument(doc);
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		translate.getTranslators();
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
	for each(var frame in frames) {
		if(frame.contentDocument &&
				(frame.contentDocument == searchDoc ||
				this._searchFrames(frame.contentDocument, searchDoc))) {
			return true;
		}
	}
	
	var frames = rootDoc.getElementsByTagName("iframe");
	for each(var frame in frames) {
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
	if(doc.documentURI.match(/\.csl(\.xml)?$/i)) {
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
		var translate = new Zotero.Translate("import");
		translate.setLocation(file);
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		translate.getTranslators();
	}
}

/*
 * translate a page
 *
 * @param	{Integer}	libraryID
 * @param	{Integer}	collectionID
 */
Zotero_Browser.Tab.prototype.translate = function(libraryID, collectionID) {
	if(this.page.translators && this.page.translators.length) {
		Zotero_Browser.progress.show();
		Zotero_Browser.isScraping = true;
		
		if(collectionID) {
			var collection = Zotero.Collections.get(collectionID);
		}
		else {
			var collection = false;
		}
		
		var me = this;
		
		if(!this.page.hasBeenTranslated) {
			// use first translator available
			this.page.translate.setTranslator(this.page.translators[0]);
			this.page.translate.setHandler("select", me._selectItems);
			this.page.translate.setHandler("done", function(obj, item) { Zotero_Browser.finishScraping(obj, item) });
			this.page.hasBeenTranslated = true;
		}
		this.page.translate.clearHandlers("itemDone");
		this.page.translate.setHandler("itemDone", function(obj, item) { Zotero_Browser.itemDone(obj, item, collection) });
		
		this.page.translate.translate(libraryID);
	}
}

/*
 * returns the URL of the image representing the translator to be called on the
 * current page, or false if the page cannot be scraped
 */
Zotero_Browser.Tab.prototype.getCaptureIcon = function() {
	if(this.page.translators && this.page.translators.length) {
		var itemType = this.page.translators[0].itemType;
		if(itemType == "multiple") {
			// Use folder icon for multiple types, for now
			return "chrome://zotero/skin/treesource-collection.png";
		} else {
			return Zotero.ItemTypes.getImageSrc(itemType);
		}
	}
	
	return false;
}

Zotero_Browser.Tab.prototype.getCaptureTooltip = function() {
	if (this.page.translators && this.page.translators.length) {
		var arr = [Zotero.getString('ingester.saveToZotero')];
		if (this.page.translators[0].itemType == 'multiple') {
			arr.push('...');
		}
		arr.push (' ' , '(' + this.page.translators[0].label + ')');
		return Zotero.localeJoin(arr, '');
	}
	return '';
}


/**********CALLBACKS**********/

/*
 * called when a user is supposed to select items
 */
Zotero_Browser.Tab.prototype._selectItems = function(obj, itemList) {
	// this is kinda ugly, mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = window.openDialog("chrome://zotero/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	
	if(!io.dataOut) {	// user selected no items, so close the progress indicatior
		Zotero_Browser.progress.close();
	}
	
	return io.dataOut;
}

/*
 * called when translators are available
 */
Zotero_Browser.Tab.prototype._translatorsAvailable = function(translate, translators) {
	if(translators && translators.length) {
		this.page.translate = translate;
		this.page.translators = translators;
		this.page.document = translate.document;
	} else if(translate.type != "import" && translate.document.documentURI.length > 7
			&& translate.document.documentURI.substr(0, 7) == "file://") {
		this._attemptLocalFileImport(translate.document);
	}
	Zotero_Browser.updateStatus();
}

// Handles the display of a div showing progress in scraping
Zotero_Browser.progress = new Zotero.ProgressWindow();

Zotero_Browser.init();