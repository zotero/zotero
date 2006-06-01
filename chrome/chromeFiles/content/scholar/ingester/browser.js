// Firefox Scholar Ingester Browser Functions
// Utilities based on code taken from Greasemonkey
// This code is licensed according to the GPL

// Prepare the browser and collector instrumentation caches --------------------
Scholar.Ingester.Interface = function() {}

Scholar.Ingester.Interface.init = function() {
	Scholar.Ingester.Interface.browsers = new Array();
	
    window.addEventListener("load", Scholar.Ingester.Interface.chromeLoad, false);
    window.addEventListener("unload", Scholar.Ingester.Interface.chromeUnload, false);
    
	Scholar.Ingester.Interface.browsers = new Array();
	Scholar.Ingester.Interface.browserDocuments = new Object(); 
}

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

Scholar.Ingester.Interface.chromeUnload = function() {
  this.tabBrowser.removeProgressListener(this);
}

Scholar.Ingester.Interface.getDocument = function(browser) {
	try {
		var key = browser.getAttribute("scholar-key");
		if(Scholar.Ingester.Interface.browserDocuments[key]) {
			return Scholar.Ingester.Interface.browserDocuments[key];
		}
	} finally {}
	return false;
}

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

Scholar.Ingester.Interface.scrapeThisPage = function() {
	var document = Scholar.Ingester.Interface.getDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
	if(document.scraper) {
		document.scrapePage();
	}
}

Scholar.Ingester.Interface.updateStatus = function(browser) {
	var document = Scholar.Ingester.Interface.getDocument(browser);
	if(document && document.scraper) {
		this.statusImage.src = "chrome://scholar/skin/capture_colored.png";
	} else {
		this.statusImage.src = "chrome://scholar/skin/capture_gray.png";
	}
}

Scholar.Ingester.Interface.contentLoad = function() {
	Scholar.Ingester.Interface.setDocument(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
	Scholar.Ingester.Interface.updateStatus(Scholar.Ingester.Interface.tabBrowser.selectedBrowser);
}

Scholar.Ingester.Interface.Listener = function() {}
Scholar.Ingester.Interface.Listener.onStatusChange = function() {}
Scholar.Ingester.Interface.Listener.onSecurityChange = function() {}
Scholar.Ingester.Interface.Listener.onProgressChange = function() {}
Scholar.Ingester.Interface.Listener.onStateChange = function() {}
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