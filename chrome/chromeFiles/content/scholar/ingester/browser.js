// Firefox Scholar Ingester Browser Functions
// Based on code taken from Greasemonkey and PiggyBank
// This code is licensed according to the GPL

//////////////////////////////////////////////////////////////////////////////
//
// Scholar_Ingester_Interface
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

Scholar_Ingester_Interface = function() {}

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
	
    window.addEventListener("load", Scholar_Ingester_Interface.chromeLoad, false);
    window.addEventListener("unload", Scholar_Ingester_Interface.chromeUnload, false);
}

/*
 * When chrome loads, register our event handlers with the appropriate interfaces
 */
Scholar_Ingester_Interface.chromeLoad = function() {
	Scholar_Ingester_Interface.tabBrowser = document.getElementById("content");
	Scholar_Ingester_Interface.hiddenBrowser = document.getElementById("scholar-hidden-browser");
	Scholar_Ingester_Interface.appContent = document.getElementById("appcontent");
	Scholar_Ingester_Interface.statusImage = document.getElementById("scholar-status-image");
	
	// this gives us onLocationChange
	Scholar_Ingester_Interface.tabBrowser.addProgressListener(Scholar_Ingester_Interface.Listener,
		Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
	// this gives us DOMContentLoaded
    Scholar_Ingester_Interface.appContent.addEventListener("DOMContentLoaded",
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
Scholar_Ingester_Interface.scrapeThisPage = function() {
	var documentObject = Scholar_Ingester_Interface._getDocument(Scholar_Ingester_Interface.tabBrowser.selectedBrowser);
	if(documentObject.scraper) {
		Scholar_Ingester_Interface.scrapeProgress = new Scholar_Ingester_Interface.Progress(window, Scholar_Ingester_Interface.tabBrowser.selectedBrowser.contentDocument, Scholar.getString("ingester.scraping"));
		documentObject.scrapePage(Scholar_Ingester_Interface._finishScraping);
	}
}

/*
 * Updates the status of the capture icon to reflect the scrapability or lack
 * thereof of the current page
 */
Scholar_Ingester_Interface.updateStatus = function(browser) {
	var documentObject = Scholar_Ingester_Interface._getDocument(browser);
	if(documentObject && documentObject.scraper) {
		Scholar_Ingester_Interface.statusImage.src = "chrome://scholar/skin/capture_colored.png";
	} else {
		Scholar_Ingester_Interface.statusImage.src = "chrome://scholar/skin/capture_gray.png";
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
Scholar_Ingester_Interface.contentLoad = function() {
	Scholar_Ingester_Interface._setDocument(Scholar_Ingester_Interface.tabBrowser.selectedBrowser);
	Scholar_Ingester_Interface.updateStatus(Scholar_Ingester_Interface.tabBrowser.selectedBrowser);
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
	Scholar.debug("onLocationChange called");
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
    
    /*// Add a collector to any new browser
    for (var i = 0; i < browsers.length; i++) {
        var browser = browsers[i];
        var exists = false;

        for (var j = 0; j < Scholar_Ingester_Interface.browsers.length; j++) {
            if (browser == Scholar_Ingester_Interface.browsers[j]) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            Scholar_Ingester_Interface.browsers.splice(i,0,browser);
            
        	// To execute if window is new
        }
    }*/

    Scholar_Ingester_Interface.updateStatus(
    	Scholar_Ingester_Interface.tabBrowser.selectedBrowser
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
	Scholar_Ingester_Interface.browserDocuments[key] = new Scholar.Ingester.Document(browser, Scholar_Ingester_Interface.hiddenBrowser);
	Scholar_Ingester_Interface.browserDocuments[key].retrieveScraper();
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
Scholar_Ingester_Interface._finishScraping = function(obj) {
	if(obj.items.length) {
		try {		// Encased in a try block to fix a as-of-yet unresolved issue
			var item1 = obj.items[0];
			
			Scholar_Ingester_Interface.scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeComplete"));
			
			var fields = Scholar.ItemFields.getItemTypeFields(item1.getField("itemTypeID"));
			
			// Display title and creators
			var titleLabel = Scholar.getString("itemFields.title") + ":"
			Scholar_Ingester_Interface.scrapeProgress.addResult(titleLabel, item1.getField("title"));
			var creators = item1.numCreators();
			if(creators) {
				for(var i=0; i<creators; i++) {
					var creator = item1.getCreator(i);
					var label = Scholar.getString("creatorTypes."+Scholar.CreatorTypes.getTypeName(creator.creatorTypeID)) + ":";
					var data = creator.firstName + ' ' + creator.lastName;
					Scholar_Ingester_Interface.scrapeProgress.addResult(label, data);
				}
			}
			
			// Add additional fields for display
			for(i in fields) {
				var data = item1.getField(fields[i]);
				if(data) {
					var name = Scholar.ItemFields.getName(fields[i]);
					if(name != "source") {
						var label = Scholar.getString("itemFields."+ name) + ":";
						Scholar_Ingester_Interface.scrapeProgress.addResult(label, data);
					}
				}
			}
		} catch(ex) {
		}
		
		// Save items
		for(i in obj.items) {
			obj.items[i].save();
		}
	} else {
		Scholar_Ingester_Interface.scrapeProgress.changeHeadline(Scholar.getString("ingester.scrapeError"));
		Scholar_Ingester_Interface.scrapeProgress.addDescription(Scholar.getString("ingester.scrapeErrorDescription"));
	}
	
	setTimeout(function() { Scholar_Ingester_Interface.scrapeProgress.fade() }, 2000);
}

//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Progress
//
//////////////////////////////////////////////////////////////////////////////

// Handles the display of a div showing progress in scraping

Scholar_Ingester_Interface.Progress = function(myWindow, myDocument, headline) {
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

Scholar_Ingester_Interface.Progress.prototype.changeHeadline = function(headline) {
	this.headlineP.removeChild(this.headlineP.firstChild);
	
	var headlineNode = this.document.createTextNode(headline);
	this.headlineP.appendChild(headlineNode);
}

Scholar_Ingester_Interface.Progress.prototype.addResult = function(label, data) {
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

Scholar_Ingester_Interface.Progress.prototype.addDescription = function(description) {
	var descriptionNode = this.document.createTextNode(description);
	var tr = this.document.createElement("tr");
	var descriptionTd = this.document.createElement("td");
	descriptionTd.style.fontSize = '10px';
	descriptionTd.style.colspan = '2';
	
	descriptionTd.appendChild(descriptionNode);
	tr.appendChild(descriptionTd);
	this.table.appendChild(tr);
}


Scholar_Ingester_Interface.Progress.prototype.fade = function() {
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
