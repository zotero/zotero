/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
	
	Based on code from Greasemonkey and PiggyBank
	
	
    ***** END LICENSE BLOCK *****
*/

//
// Zotero Ingester Browser Functions
//

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_Ingester_Interface
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

var Zotero_Ingester_Interface = function() {}

Zotero_Ingester_Interface.blacklist = [
	"googlesyndication.com",
	"doubleclick.net",
	"questionmarket.com",
	"atdmt.com"
];

//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero_Ingester_Interface methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Initialize some variables and prepare event listeners for when chrome is done
 * loading
 */
Zotero_Ingester_Interface.init = function() {
	Zotero_Ingester_Interface.browserData = new Object();
	Zotero_Ingester_Interface._scrapePopupShowing = false;
	Zotero.Ingester.ProxyMonitor.init();
	Zotero.Ingester.MIMEHandler.init();
	Zotero.Translate.init();
	
	window.addEventListener("load", Zotero_Ingester_Interface.chromeLoad, false);
	window.addEventListener("unload", Zotero_Ingester_Interface.chromeUnload, false);
}

/*
 * When chrome loads, register our event handlers with the appropriate interfaces
 */
Zotero_Ingester_Interface.chromeLoad = function() {
	Zotero_Ingester_Interface.tabBrowser = document.getElementById("content");
	Zotero_Ingester_Interface.appContent = document.getElementById("appcontent");
	Zotero_Ingester_Interface.statusImage = document.getElementById("zotero-status-image");
	
	// this gives us onLocationChange, for updating when tabs are switched/created
	Zotero_Ingester_Interface.tabBrowser.addEventListener("TabClose",
	    Zotero_Ingester_Interface.tabClose, false);
	Zotero_Ingester_Interface.tabBrowser.addEventListener("TabSelect",
	    Zotero_Ingester_Interface.tabSelect, false);
	// this is for pageshow, for updating the status of the book icon
	Zotero_Ingester_Interface.appContent.addEventListener("pageshow",
		Zotero_Ingester_Interface.contentLoad, true);
}

/*
 * When chrome unloads, delete our document objects and remove our listeners
 */
Zotero_Ingester_Interface.chromeUnload = function() {
	delete Zotero_Ingester_Interface.browserData;
}

/*
 * Scrapes a page (called when the capture icon is clicked); takes a collection
 * ID as the argument
 */
Zotero_Ingester_Interface.scrapeThisPage = function(saveLocation) {
	var browser = Zotero_Ingester_Interface.tabBrowser.selectedBrowser;
	var data = Zotero_Ingester_Interface._getData(browser);
	
	if(data.translators && data.translators.length) {
		Zotero_Ingester_Interface.Progress.show();
		
		if(saveLocation) {
			saveLocation = Zotero.Collections.get(saveLocation);
		} else { // save to currently selected collection, if a collection is selected
			try {
				saveLocation = ZoteroPane.getSelectedCollection();
			} catch(e) {}
		}
		
		var translate = new Zotero.Translate("web");
		translate.setDocument(data.document);
		// use first translator available
		translate.setTranslator(data.translators[0]);
		translate.setHandler("select", Zotero_Ingester_Interface._selectItems);
		translate.setHandler("itemDone", function(obj, item) { Zotero_Ingester_Interface._itemDone(obj, item, saveLocation) });
		translate.setHandler("done", function(obj, item) { Zotero_Ingester_Interface._finishScraping(obj, item, saveLocation) });
		translate.translate();
	}
}

Zotero_Ingester_Interface.searchFrames = function(rootDoc, searchDoc) {
	for each(var frame in rootDoc.frames) {
		if(frame.document == searchDoc ||
		   (frame.document.frames && searchFrames(frame, searchDoc))) {
			return true;
		}
	}
	
	return false;
}

/*
 * An event handler called when a new document is loaded. Creates a new document
 * object, and updates the status of the capture icon
 */
Zotero_Ingester_Interface.contentLoad = function(event) {
	if(event.originalTarget instanceof HTMLDocument) {
		var doc = event.originalTarget;
		var rootDoc = doc;
		
		// get the appropriate root document to check which browser we're on
		while(rootDoc.defaultView.frameElement) {
			rootDoc = rootDoc.defaultView.frameElement.ownerDocument;
		}
		
		// Figure out what browser this contentDocument is associated with
		var browser;
		for(var i=0; i<Zotero_Ingester_Interface.tabBrowser.browsers.length; i++) {
			if(rootDoc == Zotero_Ingester_Interface.tabBrowser.browsers[i].contentDocument) {
				browser = Zotero_Ingester_Interface.tabBrowser.browsers[i];
				break;
			}
		}
		if(!browser) {
			return;
		}
		
		// get data object
		var data = Zotero_Ingester_Interface._getData(browser);
		
		// if there's already a scrapable page in the browser window, and it's
		// still there, ensure it is actually part of the page, then return
		if(data.translators && data.translators.length && data.document.location) {
			if(Zotero_Ingester_Interface.searchFrames(rootDoc, data.document)) {
				return;
			} else {
				data.document = null;
			}
		}
		
		for each(var blacklistedURL in Zotero_Ingester_Interface.blacklist) {
			if(doc.domain.substr(doc.domain.length-blacklistedURL.length) == blacklistedURL) {
				Zotero.debug("Ignoring blacklisted URL "+doc.location);
				return;
			}
		}
		
		// get translators
		var translate = new Zotero.Translate("web");
		translate.setDocument(doc);
		data.translators = translate.getTranslators();
		// update status
		if(Zotero_Ingester_Interface.tabBrowser.selectedBrowser == browser) {
			Zotero_Ingester_Interface._updateStatus(data);
		}
		// add document
		if(data.translators && data.translators.length) {
			data.document = doc;
		}
	}
}

/*
 * called when a tab is closed
 */
Zotero_Ingester_Interface.tabClose = function(event) {
	// To execute if document object does not exist
	Zotero_Ingester_Interface._deleteData(event.target.linkedBrowser);
}

/*
 * called when a tab is switched
 */
Zotero_Ingester_Interface.tabSelect = function(event) {
	var data = Zotero_Ingester_Interface._getData(Zotero_Ingester_Interface.tabBrowser.selectedBrowser);
	Zotero_Ingester_Interface._updateStatus(data);
}

Zotero_Ingester_Interface.hidePopup = function(collectionID) {
	Zotero_Ingester_Interface._scrapePopupShowing = false;
}

Zotero_Ingester_Interface.showPopup = function(collectionID, parentElement) {
	if(Zotero_Ingester_Interface._scrapePopupShowing && parentElement.hasChildNodes()) {
		return false;	// Don't dynamically reload popups that are already showing
	}
	Zotero_Ingester_Interface._scrapePopupShowing = true;
	parentElement.removeAllItems();
	
	if(collectionID == null) {	// show library
		var newItem = document.createElement("menuitem");
		newItem.setAttribute("label", Zotero.getString("pane.collections.library"));
		newItem.setAttribute("class", "menuitem-iconic zotero-scrape-popup-library");
		newItem.setAttribute("oncommand", 'Zotero_Ingester_Interface.scrapeThisPage()');
		parentElement.appendChild(newItem);
	}
	
	var childrenList = Zotero.getCollections(collectionID);
	for(var i = 0; i < childrenList.length; i++) {
		if(childrenList[i].hasChildCollections()) {
			var newItem = document.createElement("menu");
			var subMenu = document.createElement("menupopup");
			subMenu.setAttribute("onpopupshowing", 'Zotero_Ingester_Interface.showPopup("'+childrenList[i].getID()+'", this)');
			newItem.setAttribute("class", "menu-iconic zotero-scrape-popup-collection");
			newItem.appendChild(subMenu);
		} else {
			var newItem = document.createElement("menuitem");
			newItem.setAttribute("class", "menuitem-iconic zotero-scrape-popup-collection");
		}
		newItem.setAttribute("label", childrenList[i].getName());
		newItem.setAttribute("oncommand", 'Zotero_Ingester_Interface.scrapeThisPage("'+childrenList[i].getID()+'")');
		
		parentElement.appendChild(newItem);
	}
	
	return true;
}

//////////////////////////////////////////////////////////////////////////////
//
// Private Zotero_Ingester_Interface methods
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
Zotero_Ingester_Interface._getData = function(browser) {
	try {
		var key = browser.getAttribute("zotero-key");
		if(Zotero_Ingester_Interface.browserData[key]) {
			return Zotero_Ingester_Interface.browserData[key];
		}
	} finally {
		if(!key) {
			var key = (new Date()).getTime();
			browser.setAttribute("zotero-key", key);
			Zotero_Ingester_Interface.browserData[key] = new Array();
			return Zotero_Ingester_Interface.browserData[key];
		}
	}
	return false;
}

/*
 * Deletes the document object associated with a given browser window object
 */
Zotero_Ingester_Interface._deleteData = function(browser) {
	try {
		var key = browser.getAttribute("zotero-key");
		if(Zotero_Ingester_Interface.browserData[key]) {
			delete Zotero_Ingester_Interface.browserData[key];
			return true;
		}
	} finally {}
	return false;
}

/*
 * Updates the status of the capture icon to reflect the scrapability or lack
 * thereof of the current page
 */
Zotero_Ingester_Interface._updateStatus = function(data) {
	if(data.translators && data.translators.length) {
		var itemType = data.translators[0].itemType;
		if(itemType == "multiple") {
			// Use folder icon for multiple types, for now
			Zotero_Ingester_Interface.statusImage.src = "chrome://zotero/skin/treesource-collection.png";
		} else {
			Zotero_Ingester_Interface.statusImage.src = "chrome://zotero/skin/treeitem-"+itemType+".png";
		}
		Zotero_Ingester_Interface.statusImage.hidden = false;
	} else {
		Zotero_Ingester_Interface.statusImage.hidden = true;
	}
}

/*
 * Callback to be executed when an item has been finished
 */
Zotero_Ingester_Interface._itemDone = function(obj, item, collection) {
	var title = item.getField("title");
	var icon = "chrome://zotero/skin/treeitem-"+Zotero.ItemTypes.getName(item.getField("itemTypeID"))+".png"
	Zotero_Ingester_Interface.Progress.addLines([title], [icon]);
	
	// add item to collection, if one was specified
	if(collection) {
		Zotero.Notifier.disable();
		collection.addItem(item.getID());
		Zotero.Notifier.enable();
	}
}

/*
 * called when a user is supposed to select items
 */
Zotero_Ingester_Interface._selectItems = function(obj, itemList) {
	// this is kinda ugly, mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = window.openDialog("chrome://zotero/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	
	if(!io.dataOut) {	// user selected no items, so kill the progress indicatior
		Zotero_Ingester_Interface.Progress.kill();
	}
	
	return io.dataOut;
}

/*
 * Callback to be executed when scraping is complete
 */
Zotero_Ingester_Interface._finishScraping = function(obj, returnValue, collection) {
	if(!returnValue) {
		Zotero_Ingester_Interface.Progress.changeHeadline(Zotero.getString("ingester.scrapeError"));
		Zotero_Ingester_Interface.Progress.addDescription(Zotero.getString("ingester.scrapeErrorDescription"));
	}
	
	if(collection) {
		// notify about modified items
		Zotero.Notifier.trigger("modify", "collection", collection.getID());
	}
	
	Zotero_Ingester_Interface.Progress.fade();
}

//////////////////////////////////////////////////////////////////////////////
//
// Zotero.Ingester.Progress
//
//////////////////////////////////////////////////////////////////////////////

// Handles the display of a div showing progress in scraping
Zotero_Ingester_Interface.Progress = new function() {
	var _windowLoaded = false;
	var _windowLoading = false;
	// keep track of all of these things in case they're called before we're
	// done loading the progress window
	var _loadDescription = null;
	var _loadLines = new Array();
	var _loadIcons = new Array();
	var _loadHeadline = Zotero.getString("ingester.scraping");
	
	this.show = show;
	this.changeHeadline = changeHeadline;
	this.addLines = addLines;
	this.addDescription = addDescription;
	this.fade = fade;
	this.kill = kill;
	
	function show() {
		if(_windowLoading || _windowLoaded) {	// already loading or loaded
			return false;
		}
		_progressWindow = window.openDialog("chrome://zotero/chrome/ingester/progress.xul",
		                                    "", "chrome,dialog=no,titlebar=no,popup=yes");
		_progressWindow.addEventListener("load", _onWindowLoaded, false);
		_windowLoading = true;
		
		return true;
	}
	
	function changeHeadline(headline) {
		if(_windowLoaded) {
			_progressWindow.document.getElementById("zotero-progress-text-headline").value = headline;
		} else {
			_loadHeadline = headline;
		}
	}
	
	function addLines(label, icon) {
		if(_windowLoaded) {
			for(i in label) {
				var newLabel = _progressWindow.document.createElement("label");
				newLabel.setAttribute("class", "zotero-progress-item-label");
				newLabel.setAttribute("crop", "end");
				newLabel.setAttribute("value", label[i]);
				
				var newImage = _progressWindow.document.createElement("image");
				newImage.setAttribute("class", "zotero-progress-item-icon");
				newImage.setAttribute("src", icon[i]);
				
				var newHB = _progressWindow.document.createElement("hbox");
				newHB.setAttribute("class", "zotero-progress-item-hbox");
				newHB.setAttribute("valign", "center");
				newHB.appendChild(newImage);
				newHB.appendChild(newLabel);
				
				_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
			}
			
			_move();
		} else {
			_loadLines = _loadLines.concat(label);
			_loadIcons = _loadIcons.concat(icon);
		}
	}
	
	function addDescription(text) {
		if(_windowLoaded) {
			var newHB = _progressWindow.document.createElement("hbox");
			newHB.setAttribute("class", "zotero-progress-item-hbox");
			var newDescription = _progressWindow.document.createElement("description");
			newDescription.setAttribute("class", "zotero-progress-description");
			var newText = _progressWindow.document.createTextNode(text);
			
			newDescription.appendChild(newText);
			newHB.appendChild(newDescription);
			_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
			
			_move();
		} else {
			_loadDescription = text;
		}
	}
	
	function fade() {
		if(_windowLoaded || _windowLoading) {
			setTimeout(_timeout, 2500);
		}
	}
	
	function kill() {
		_windowLoaded = false;
		_windowLoading = false;
		try {
			_progressWindow.close();
		} catch(ex) {}
	}
	
	function _onWindowLoaded() {
		_windowLoading = false;
		_windowLoaded = true;
		
		_move();
		// do things we delayed because the window was loading
		changeHeadline(_loadHeadline);
		addLines(_loadLines, _loadIcons);
		if(_loadDescription) {
			addDescription(_loadDescription);
		}
		
		// reset parameters
		_loadDescription = null;
		_loadLines = new Array();
		_loadIcons = new Array();
		_loadHeadline = Zotero.getString("ingester.scraping")
	}
	
	function _move() {
		_progressWindow.sizeToContent();
		_progressWindow.moveTo(
			window.screenX + window.innerWidth - _progressWindow.outerWidth - 30,
			window.screenY + window.innerHeight - _progressWindow.outerHeight - 10
		);
	}
	
	function _timeout() {
		kill();	// could check to see if we're really supposed to fade yet
				// (in case multiple scrapers are operating at once)
	}
}
