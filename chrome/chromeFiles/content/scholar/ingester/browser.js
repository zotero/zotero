// Scholar for Firefox Ingester Browser Functions
// Based on code taken from Greasemonkey and PiggyBank
// This code is licensed according to the GPL

//////////////////////////////////////////////////////////////////////////////
//
// Scholar_Ingester_Interface
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

Scholar_Ingester_Interface = function() {}
Scholar_Ingester_Interface._scrapeProgress = new Array();

//////////////////////////////////////////////////////////////////////////////
//
// Public Scholar_Ingester_Interface methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Initialize some variables and prepare event listeners for when chrome is done
 * loading
 */
Scholar_Ingester_Interface.init = function() {
	Scholar_Ingester_Interface.browsers = new Array();
	Scholar_Ingester_Interface.browserDocuments = new Object();
	Scholar_Ingester_Interface.browserUris = new Array();
	Scholar_Ingester_Interface._scrapePopupShowing = false;
	Scholar.Ingester.ProxyMonitor.init();
	
	window.addEventListener("load", Scholar_Ingester_Interface.chromeLoad, false);
	window.addEventListener("unload", Scholar_Ingester_Interface.chromeUnload, false);
}

/*
 * When chrome loads, register our event handlers with the appropriate interfaces
 */
Scholar_Ingester_Interface.chromeLoad = function() {
	Scholar_Ingester_Interface.tabBrowser = document.getElementById("content");
	Scholar_Ingester_Interface.appContent = document.getElementById("appcontent");
	Scholar_Ingester_Interface.statusImage = document.getElementById("scholar-status-image");
	
	// this gives us onLocationChange, for updating when tabs are switched/created
	Scholar_Ingester_Interface.tabBrowser.addProgressListener(Scholar_Ingester_Interface.Listener,
		Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
	// this is for pageshow, for updating the status of the book icon
	Scholar_Ingester_Interface.appContent.addEventListener("pageshow",
		Scholar_Ingester_Interface.contentLoad, true);
}

/*
 * When chrome unloads, delete our document objects and remove our listeners
 */
Scholar_Ingester_Interface.chromeUnload = function() {
	delete Scholar_Ingester_Interface.browserDocuments;
	this.tabBrowser.removeProgressListener(this);
}

/*
 * Scrapes a page (called when the capture icon is clicked)
 */
Scholar_Ingester_Interface.scrapeThisPage = function(saveLocation) {
	var documentObject = Scholar_Ingester_Interface._getDocument(Scholar_Ingester_Interface.tabBrowser.selectedBrowser);
	if(documentObject.scraper) {
		var scrapeProgress = new Scholar_Ingester_Interface.Progress(window);
		Scholar_Ingester_Interface._scrapeProgress.push(scrapeProgress);
		documentObject.scrapePage(function(obj, returnValue) { Scholar_Ingester_Interface._finishScraping(obj, returnValue, scrapeProgress, saveLocation) });
	}
}

/*
 * Updates the status of the capture icon to reflect the scrapability or lack
 * thereof of the current page
 */
Scholar_Ingester_Interface.updateStatus = function() {
	var documentObject = Scholar_Ingester_Interface._getDocument(Scholar_Ingester_Interface.tabBrowser.selectedBrowser);
	if(documentObject && documentObject.scraper) {
		if(documentObject.type == "multiple") {
			// Use folder icon for multiple types, for now
			Scholar_Ingester_Interface.statusImage.src = "chrome://scholar/skin/treesource-collection.png";
		} else {
			Scholar_Ingester_Interface.statusImage.src = "chrome://scholar/skin/treeitem-"+documentObject.type+".png";
		}
		Scholar_Ingester_Interface.statusImage.hidden = false;
	} else {
		Scholar_Ingester_Interface.statusImage.hidden = true;
	}
}

/*
 * An event handler called when a new document is loaded. Creates a new document
 * object, and updates the status of the capture icon

 */
Scholar_Ingester_Interface.contentLoad = function(event) {
	if (event.originalTarget instanceof HTMLDocument) {
		// Stolen off the Mozilla extension developer's website, a routine to
		// determine the root document loaded from a frameset
		if (event.originalTarget.defaultView.frameElement) {
			var doc = event.originalTarget;
			while (doc.defaultView.frameElement) {
				doc=doc.defaultView.frameElement.ownerDocument;
			}
			// Frame within a tab was loaded. doc is the root document of the frameset
		} else {
			var doc = event.originalTarget;
			// Page was loaded. doc is the document that loaded.
		}
		
		// Figure out what browser this contentDocument is associated with
		var browser;
		for(var i=0; i<Scholar_Ingester_Interface.tabBrowser.browsers.length; i++) {
			if(doc == Scholar_Ingester_Interface.tabBrowser.browsers[i].contentDocument) {
				browser = Scholar_Ingester_Interface.tabBrowser.browsers[i];
				break;
			}
		}
		if(!browser) {
			Scholar.debug("Could not find browser!");
			return;
		}
		
		Scholar_Ingester_Interface._setDocument(browser);
		Scholar_Ingester_Interface.updateStatus();
	}
}

/*
 * Dummy event handlers for all the events we don't care about
 */
Scholar_Ingester_Interface.Listener = function() {}
Scholar_Ingester_Interface.Listener.onStatusChange = function() {}
Scholar_Ingester_Interface.Listener.onSecurityChange = function() {}
Scholar_Ingester_Interface.Listener.onProgressChange = function() {}
Scholar_Ingester_Interface.Listener.onStateChange = function() {}

/*
 * onLocationChange is called when tabs are switched. Use it to retrieve the
 * appropriate status indicator for the current tab, and to free useless objects
 */
Scholar_Ingester_Interface.Listener.onLocationChange = function(progressObject) {
	var browsers = Scholar_Ingester_Interface.tabBrowser.browsers;

	// Remove document object of any browser that no longer exists
	for (var i = 0; i < Scholar_Ingester_Interface.browsers.length; i++) {
		var browser = Scholar_Ingester_Interface.browsers[i];
		var exists = false;

		for (var j = 0; j < browsers.length; j++) {
			if (browser == browsers[j]) {
				exists = true;
				break;
			}
		}

		if (!exists) {
			Scholar_Ingester_Interface.browsers.splice(i,1);

			// To execute if document object does not exist
			Scholar_Ingester_Interface._deleteDocument(browser);
		}
	}
	Scholar_Ingester_Interface.updateStatus();
	
	// Make sure scrape progress is gone
	var scrapeProgress;
	while(scrapeProgress = Scholar_Ingester_Interface._scrapeProgress.pop()) {
		scrapeProgress.kill();
	}
}

Scholar_Ingester_Interface.hidePopup = function(collectionID) {
	Scholar_Ingester_Interface._scrapePopupShowing = false;
}

Scholar_Ingester_Interface.showPopup = function(collectionID, parentElement) {
	if(Scholar_Ingester_Interface._scrapePopupShowing && parentElement.hasChildNodes()) {
		return false;	// Don't dynamically reload popups that are already showing
	}
	Scholar_Ingester_Interface._scrapePopupShowing = true;
	
	while(parentElement.hasChildNodes()) {
		parentElement.removeChild(parentElement.firstChild);
	}
	
	if(collectionID == null) {	// show library
		var newItem = document.createElement("menuitem");
		newItem.setAttribute("label", Scholar.getString("pane.collections.library"));
		newItem.setAttribute("class", "menuitem-iconic scholar-scrape-popup-library");
		newItem.setAttribute("oncommand", 'Scholar_Ingester_Interface.scrapeThisPage()');
		parentElement.appendChild(newItem);
	}
	
	var childrenList = Scholar.getCollections(collectionID);
	for(var i = 0; i < childrenList.length; i++) {
		if(childrenList[i].hasChildCollections()) {
			var newItem = document.createElement("menu");
			var subMenu = document.createElement("menupopup");
			subMenu.setAttribute("onpopupshowing", 'Scholar_Ingester_Interface.showPopup("'+childrenList[i].getID()+'", this)');
			newItem.setAttribute("class", "menu-iconic scholar-scrape-popup-collection");
			newItem.appendChild(subMenu);
		} else {
			var newItem = document.createElement("menuitem");
			newItem.setAttribute("class", "menuitem-iconic scholar-scrape-popup-collection");
		}
		newItem.setAttribute("label", childrenList[i].getName());
		newItem.setAttribute("oncommand", 'Scholar_Ingester_Interface.scrapeThisPage("'+childrenList[i].getID()+'")');
		
		parentElement.appendChild(newItem);
	}
}

//////////////////////////////////////////////////////////////////////////////
//
// Private Scholar_Ingester_Interface methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Gets a document object given a browser window object
 * 
 * NOTE: Browser objects are associated with document objects via keys generated
 * from the time the browser object is opened. I'm not sure if this is the
 * appropriate mechanism for handling this, but it's what PiggyBank used and it
 * appears to work.
 */
Scholar_Ingester_Interface._getDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
		if(Scholar_Ingester_Interface.browserDocuments[key]) {
			return Scholar_Ingester_Interface.browserDocuments[key];
		}
	} finally {}
	return false;
}

/*
 * Creates a new document object for a browser window object, attempts to
 * retrieve appropriate scraper
 */
Scholar_Ingester_Interface._setDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
	} finally {
		if(!key) {
			var key = (new Date()).getTime();
			browser.setAttribute("scholar-key", key);
		}
	}
	
	// Only re-load the scraper if it's a new document
	//if(Scholar_Ingester_Interface.browserUris[key] != browser.contentDocument.location.href) {
		Scholar_Ingester_Interface.browserUris[key] = browser.contentDocument.location.href;
		Scholar_Ingester_Interface.browserDocuments[key] = new Scholar.Ingester.Document(browser, window);
		Scholar_Ingester_Interface.browserDocuments[key].retrieveScraper();
	//}
}

/*
 * Deletes the document object associated with a given browser window object
 */
Scholar_Ingester_Interface._deleteDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
		if(Scholar_Ingester_Interface.browserDocuments[key]) {
			delete Scholar_Ingester_Interface.browserDocuments[key];
			return true;
		}
	} finally {}
	return false;
}

/*
 * Callback to be executed when scraping is complete
 */
Scholar_Ingester_Interface._finishScraping = function(obj, returnValue, scrapeProgress, saveLocation) {
	if(obj.items.length) {
		scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeComplete"));
		
		// Display title and creators
		var labels = new Array();
		var icons = new Array();
		for(var i in obj.items) {
			labels.push(obj.items[i].getField("title"));
			icons.push("chrome://scholar/skin/treeitem-"+Scholar.ItemTypes.getName(obj.items[i].getField("itemTypeID"))+".png");
		}
		scrapeProgress.addLines(labels, icons);
		
		// Get collection if the user used the drop-down menu
		if(saveLocation) {
			var saveCollection = Scholar.Collections.get(saveLocation);
		}
		// Save items
		for(i in obj.items) {
			obj.items[i].save();
			if(saveLocation) {
				saveCollection.addItem(obj.items[i].getID());
			}
		}
		
		setTimeout(function() { scrapeProgress.fade() }, 2500);
	} else if(returnValue) {
		scrapeProgress.kill();
	} else {
		scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeError"));
		scrapeProgress.addDescription(Scholar.getString("ingester.scrapeErrorDescription"));
		setTimeout(function() { scrapeProgress.fade() }, 2500);
	}
}

//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Progress
//
//////////////////////////////////////////////////////////////////////////////

// Handles the display of a div showing progress in scraping

Scholar_Ingester_Interface.Progress = function(myWindow) {
	this.openerWindow = myWindow;
	this.progressWindow = myWindow.openDialog("chrome://scholar/chrome/ingester/progress.xul", "", "chrome,dialog=no,titlebar=no,popup=yes");
	var me = this;
	this.progressWindow.addEventListener("load", function() { me.windowLoaded() }, false);
	
	this._loadDescription = null;
	this._loadLines = new Array();
	this._loadIcons = new Array();
	this._loadHeadline = Scholar.getString("ingester.scraping");
}

Scholar_Ingester_Interface.Progress.prototype.windowLoaded = function() {
	this._windowLoaded = true;
	this._move();
	
	this.changeHeadline(this._loadHeadline);
	this.addLines(this._loadLines, this._loadIcons);
	if(this._loadDescription) {
		this.addDescription(this._loadDescription);
	}
}

Scholar_Ingester_Interface.Progress.prototype.changeHeadline = function(headline) {
	if(this._windowLoaded) {
		this.progressWindow.document.getElementById("scholar-progress-text-headline").value = headline;
	} else {
		this._loadHeadline = headline;
	}
}

Scholar_Ingester_Interface.Progress.prototype.addLines = function(label, icon) {
	if(this._windowLoaded) {
		for(i in label) {
			var newLabel = this.progressWindow.document.createElement("label");
			newLabel.setAttribute("class", "scholar-progress-item-label");
			newLabel.setAttribute("crop", "end");
			newLabel.setAttribute("value", label[i]);
			
			var newImage = this.progressWindow.document.createElement("image");
			newImage.setAttribute("class", "scholar-progress-item-icon");
			newImage.setAttribute("src", icon[i]);
			
			var newHB = this.progressWindow.document.createElement("hbox");
			newHB.setAttribute("class", "scholar-progress-item-hbox");
			newHB.setAttribute("valign", "center");
			newHB.appendChild(newImage);
			newHB.appendChild(newLabel);
			
			this.progressWindow.document.getElementById("scholar-progress-text-box").appendChild(newHB);
		}
		
		this._move();
	} else {
		this._loadLines = this._loadLines.concat(label);
		this._loadIcons = this._loadIcons.concat(icon);
	}
}

Scholar_Ingester_Interface.Progress.prototype.addDescription = function(text) {
	if(this._windowLoaded) {
		var newHB = this.progressWindow.document.createElement("hbox");
		newHB.setAttribute("class", "scholar-progress-item-hbox");
		var newDescription = this.progressWindow.document.createElement("description");
		newDescription.setAttribute("class", "scholar-progress-description");
		var newText = this.progressWindow.document.createTextNode(text);
		
		newDescription.appendChild(newText);
		newHB.appendChild(newDescription);
		this.progressWindow.document.getElementById("scholar-progress-text-box").appendChild(newHB);
		
		this._move();
	} else {
		this._loadDescription = text;
	}
}

Scholar_Ingester_Interface.Progress.prototype._move = function() {
	this.progressWindow.sizeToContent();
	this.progressWindow.moveTo(
		this.openerWindow.screenX + this.openerWindow.outerWidth - this.progressWindow.outerWidth - 30,
		this.openerWindow.screenY + this.openerWindow.outerHeight - this.progressWindow.outerHeight
	);
}

Scholar_Ingester_Interface.Progress.prototype.fade = function() {
	this.kill();
}

Scholar_Ingester_Interface.Progress.prototype.kill = function() {
	try {
		this.progressWindow.close();
	} catch(ex) {}
}

