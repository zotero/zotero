// Firefox Scholar Ingester Browser Functions
// Based on code taken from Greasemonkey and PiggyBank
// This code is licensed according to the GPL

//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Interface
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

Scholar.Ingester.Interface = function() {}

//////////////////////////////////////////////////////////////////////////////
//
// Public Scholar.Ingester.Interface methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Initialize some variables and prepare event listeners for when chrome is done
 * loading
 */
Scholar.Ingester.Interface.init = function() {
	Scholar.Ingester.Interface.browsers = new Array();
	Scholar.Ingester.Interface.browserDocuments = new Object(); 
	
    window.addEventListener("load", Scholar.Ingester.Interface.chromeLoad, false);
    window.addEventListener("unload", Scholar.Ingester.Interface.chromeUnload, false);
}

/*
 * When chrome loads, register our event handlers with the appropriate interfaces
 */
Scholar.Ingester.Interface.chromeLoad = function() {
	Scholar.Ingester.Interface.tabBrowser = document.getElementById("content");
	Scholar.Ingester.Interface.hiddenBrowser = document.getElementById("scholar-hidden-browser");
	Scholar.Ingester.Interface.appContent = document.getElementById("appcontent");
	Scholar.Ingester.Interface.statusImage = document.getElementById("scholar-status-image");
	
	// this gives us onLocationChange
	Scholar.Ingester.Interface.tabBrowser.addProgressListener(Scholar.Ingester.Interface.Listener,
		Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
	// this gives us DOMContentLoaded
    Scholar.Ingester.Interface.appContent.addEventListener("DOMContentLoaded",
    	Scholar.Ingester.Interface.contentLoad, true);
}

/*
 * When chrome unloads, delete our document objects and remove our listeners
 */
Scholar.Ingester.Interface.chromeUnload = function() {
	delete Scholar.Ingester.Interface.browserDocuments;
	this.tabBrowser.removeProgressListener(this);
}

/*
 * Scrapes a page (called when the capture icon is clicked)
 */
Scholar.Ingester.Interface.scrapeThisPage = function() {
	var documentObject = Scholar.Ingester.Interface._getDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
	if(documentObject.scraper) {
		Scholar.Ingester.Interface.scrapeProgress = new Scholar.Ingester.Interface.Progress(window, Scholar.Ingester.Interface.tabBrowser.selectedBrowser.contentDocument, Scholar.getString("ingester.scraping"));
		documentObject.scrapePage(Scholar.Ingester.Interface._finishScraping);
	}
}

/*
 * Updates the status of the capture icon to reflect the scrapability or lack
 * thereof of the current page
 */
Scholar.Ingester.Interface.updateStatus = function(browser) {
	var documentObject = Scholar.Ingester.Interface._getDocument(browser);
	if(documentObject && documentObject.scraper) {
		Scholar.Ingester.Interface.statusImage.src = "chrome://scholar/skin/capture_colored.png";
	} else {
		Scholar.Ingester.Interface.statusImage.src = "chrome://scholar/skin/capture_gray.png";
	}
}

/*
 * An event handler called when a new document is loaded. Creates a new document
 * object, and updates the status of the capture icon
 *
 * FIXME: This approach, again borrowed from PiggyBank, does not work properly
 * when the newly loaded page is not the currently selected page. For example,
 * if a tab is loaded behind the currently selected page, the ingester will not
 * create a new object for it.
 */
Scholar.Ingester.Interface.contentLoad = function() {	
	Scholar.Ingester.Interface._setDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
	Scholar.Ingester.Interface.updateStatus(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
}

/*
 * Dummy event handlers for all the events we don't care about
 */
Scholar.Ingester.Interface.Listener = function() {}
Scholar.Ingester.Interface.Listener.onStatusChange = function() {}
Scholar.Ingester.Interface.Listener.onSecurityChange = function() {}
Scholar.Ingester.Interface.Listener.onProgressChange = function() {}
Scholar.Ingester.Interface.Listener.onStateChange = function() {}

/*
 * onLocationChange is called when tabs are switched. Use it to retrieve the
 * appropriate status indicator for the current tab, and to free useless objects
 */
Scholar.Ingester.Interface.Listener.onLocationChange = function() {
    var browsers = Scholar.Ingester.Interface.tabBrowser.browsers;

    // Remove document object of any browser that no longer exists
    for (var i = 0; i < Scholar.Ingester.Interface.browsers.length; i++) {
        var browser = Scholar.Ingester.Interface.browsers[i];
        var exists = false;

        for (var j = 0; j < browsers.length; j++) {
            if (browser == browsers[j]) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            Scholar.Ingester.Interface.browsers.splice(i,1);

        	// To execute if document object does not exist
            Scholar.Ingester.Interface._deleteDocument(browser);
        }
    }
    
    /*// Add a collector to any new browser
    for (var i = 0; i < browsers.length; i++) {
        var browser = browsers[i];
        var exists = false;

        for (var j = 0; j < Scholar.Ingester.Interface.browsers.length; j++) {
            if (browser == Scholar.Ingester.Interface.browsers[j]) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            Scholar.Ingester.Interface.browsers.splice(i,0,browser);
            
        	// To execute if window is new
        }
    }*/

    Scholar.Ingester.Interface.updateStatus(
    	Scholar.Ingester.Interface.tabBrowser.selectedBrowser
    );
}

//////////////////////////////////////////////////////////////////////////////
//
// Private Scholar.Ingester.Document methods
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
Scholar.Ingester.Interface._getDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
		if(Scholar.Ingester.Interface.browserDocuments[key]) {
			return Scholar.Ingester.Interface.browserDocuments[key];
		}
	} finally {}
	return false;
}

/*
 * Creates a new document object for a browser window object, attempts to
 * retrieve appropriate scraper
 */
Scholar.Ingester.Interface._setDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
	} finally {
		if(!key) {
			var key = (new Date()).getTime();
			browser.setAttribute("scholar-key", key);
		}
	}
	Scholar.Ingester.Interface.browserDocuments[key] = new Scholar.Ingester.Document(browser, Scholar.Ingester.Interface.hiddenBrowser);
	Scholar.Ingester.Interface.browserDocuments[key].retrieveScraper();
}

/*
 * Deletes the document object associated with a given browser window object
 */
Scholar.Ingester.Interface._deleteDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
		if(Scholar.Ingester.Interface.browserDocuments[key]) {
			delete Scholar.Ingester.Interface.browserDocuments[key];
			return true;
		}
	} finally {}
	return false;
}

/*
 * Callback to be executed when scraping is complete
 */
Scholar.Ingester.Interface._finishScraping = function(documentObject) {
	if(documentObject.item) {
		Scholar.Ingester.Interface.scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeComplete"));
		
		var fields = Scholar.ItemFields.getItemTypeFields(documentObject.item.getField("itemTypeID"));
			
		var titleLabel = Scholar.getString("itemFields.title") + ":"
		Scholar.Ingester.Interface.scrapeProgress.addResult(titleLabel, this.item.getField("title"));
		var creators = documentObject.item.numCreators();
		if(creators) {
			for(var i=0; i<creators; i++) {
				var creator = documentObject.item.getCreator(i);
				var label = Scholar.getString("creatorTypes."+Scholar.CreatorTypes.getTypeName(creator.creatorTypeID)) + ":";
				var data = creator.firstName + ' ' + creator.lastName;
				Scholar.Ingester.Interface.scrapeProgress.addResult(label, data);
			}
		}
		
		for(i in fields) {
			var data = documentObject.item.getField(fields[i]);
			if(data) {
				var name = Scholar.ItemFields.getName(fields[i]);
				if(name != "source") {
					var label = Scholar.getString("itemFields."+ name) + ":";
					Scholar.Ingester.Interface.scrapeProgress.addResult(label, data);
				}
			}
		}
	} else {
		Scholar.Ingester.Interface.scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeError"));
		Scholar.Ingester.Interface.scrapeProgress.addDescription(Scholar.getString("ingester.scrapeErrorDescription"));
	}
	
	setTimeout(function() { Scholar.Ingester.Interface.scrapeProgress.fade() }, 2000);
}

//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Progress
//
//////////////////////////////////////////////////////////////////////////////

// Handles the display of a div showing progress in scraping

Scholar.Ingester.Interface.Progress = function(myWindow, myDocument, headline) {
	this.window = myWindow;
	this.document = myDocument;
	this.div = this.document.createElement('div');
	this.div.style.MozOpacity = '.9';
	this.div.style.position = 'fixed';
	this.div.style.right = '20px';
	this.div.style.top = '20px';
	this.div.style.width = '200px';
	this.div.style.height = '150px';
	this.div.style.backgroundColor = '#7eadd9'
	this.div.style.color = '#000';
	this.div.style.padding = '5px';
	this.div.style.fontFamily = 'Arial, Geneva, Helvetica';
	this.div.style.overflow = 'hidden';
	this.div.id = 'firefoxScholarProgressDiv';
	
	this.headlineP = this.document.createElement("div");
	this.headlineP.style.textAlign = 'center';
	this.headlineP.style.fontSize = '22px';
	this.headlineP.style.marginBottom = '5px';
	if(!headline) {
		headline = '&nbsp;';
	}
	var headlineNode = this.document.createTextNode(headline);
	this.headlineP.appendChild(headlineNode);
	this.div.appendChild(this.headlineP);
	
	this.bodyP = this.document.createElement("div");
	this.table = this.document.createElement("table");
	this.table.style.borderCollapse = 'collapse';
	this.bodyP.appendChild(this.table);
	this.div.appendChild(this.bodyP);
	
	this.document.body.appendChild(this.div);
}

Scholar.Ingester.Interface.Progress.prototype.changeHeadline = function(headline) {
	this.headlineP.removeChild(this.headlineP.firstChild);
	
	var headlineNode = this.document.createTextNode(headline);
	this.headlineP.appendChild(headlineNode);
}

Scholar.Ingester.Interface.Progress.prototype.addResult = function(label, data) {
	var labelNode = this.document.createTextNode(label);
	var dataNode = this.document.createTextNode(data);
	
	var tr = this.document.createElement("tr");
	var labelTd = this.document.createElement("td");
	labelTd.style.fontSize = '10px';
	labelTd.style.width = '60px';
	var dataTd = this.document.createElement("td");
	dataTd.style.fontSize = '10px';
	
	labelTd.appendChild(labelNode);
	dataTd.appendChild(dataNode);
	tr.appendChild(labelTd);
	tr.appendChild(dataTd);
	this.table.appendChild(tr);
}

Scholar.Ingester.Interface.Progress.prototype.addDescription = function(description) {
	var descriptionNode = this.document.createTextNode(description);
	var tr = this.document.createElement("tr");
	var descriptionTd = this.document.createElement("td");
	descriptionTd.style.fontSize = '10px';
	descriptionTd.style.colspan = '2';
	
	descriptionTd.appendChild(descriptionNode);
	tr.appendChild(descriptionTd);
	this.table.appendChild(tr);
}


Scholar.Ingester.Interface.Progress.prototype.fade = function() {
	// Icky, icky hack to keep objects
	var me = this;
	this._fader = function() {
		if(me.div.style.MozOpacity <= 0) {
			me.div.style.display = 'none';
		} else {
			me.div.style.MozOpacity -= .1;
			setTimeout(me._fader, 100);
		}
	}
	
	// Begin fade
	this._fader();
}
