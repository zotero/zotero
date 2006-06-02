// Firefox Scholar Ingester Browser Functions
// Utilities based on code taken from Greasemonkey
// This code is licensed according to the GPL

Scholar.Ingester.Interface = function() {}

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
 * Gets a document object given a browser window object
 * 
 * NOTE: Browser objects are associated with document objects via keys generated
 * from the time the browser object is opened. I'm not sure if this is the
 * appropriate mechanism for handling this, but it's what PiggyBank used and it
 * appears to work.
 */
Scholar.Ingester.Interface.getDocument = function(browser) {
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
Scholar.Ingester.Interface.setDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
	} finally {
		if(!key) {
			var key = (new Date()).getTime();
			browser.setAttribute("scholar-key", key);
		}
	}
	Scholar.Ingester.Interface.browserDocuments[key] = new Scholar.Ingester.Document(browser);
	Scholar.Ingester.Interface.browserDocuments[key].retrieveScraper();
}

/*
 * Deletes the document object associated with a given browser window object
 */
Scholar.Ingester.Interface.deleteDocument = function(browser) {
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
 * Scrapes a page (called when the capture icon is clicked)
 */
Scholar.Ingester.Interface.scrapeThisPage = function() {
	var document = Scholar.Ingester.Interface.getDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
	if(document.scraper) {
		document.scrapePage();
	}
}

/*
 * Updates the status of the capture icon to reflect the scrapability or lack
 * thereof of the current page
 */
Scholar.Ingester.Interface.updateStatus = function(browser) {
	var document = Scholar.Ingester.Interface.getDocument(browser);
	if(document && document.scraper) {
		this.statusImage.src = "chrome://scholar/skin/capture_colored.png";
	} else {
		this.statusImage.src = "chrome://scholar/skin/capture_gray.png";
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
	Scholar.Ingester.Interface.setDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
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
            Scholar.Ingester.Interface.deleteDocument(browser);
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