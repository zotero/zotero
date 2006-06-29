// Scholar for Firefox Ingester
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

Scholar.Ingester = new Object();

Scholar.Ingester.createHiddenBrowser = function(myWindow) {
	// Create a hidden browser			
	var newHiddenBrowser = myWindow.document.createElement("browser");
	var windows = myWindow.document.getElementsByTagName("window");
	windows[0].appendChild(newHiddenBrowser);
	Scholar.debug("created hidden browser");
	return newHiddenBrowser;
}

Scholar.Ingester.deleteHiddenBrowser = function(myBrowser) {			
	// Delete a hidden browser
	delete myBrowser;
	Scholar.debug("deleted hidden browser");
}

/*
 * Operates the ingester given only a URL
 * url - URL to scrape
 * complete - callback function to be executed if page grab completes
 *            (will be passed document object; obj.items contains array of
 *            *unsaved* items scraped; empty array indicates unscrapable page)
 * error - callback function to be executed if an error occurred loading page
 * myWindow - optional argument indicating window to attach a dialog to. if no
 *            window is given, Firefox Scholar uses the hidden DOM window and
 *            will simply avoid scraping multiple pages
 */
Scholar.Ingester.ingestURL = function(url, complete, error, myWindow) {
	var isHidden = false;
	if(!myWindow) {
		var myWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
					   .getService(Components.interfaces.nsIAppShellService)
					   .hiddenDOMWindow;
		var isHidden = true;
	}
				   
	var succeeded = function(browser) {
		var myDoc = new Scholar.Ingester.Document(browser, myWindow, isHidden);
		if(myDoc.retrieveTranslator()) {
			myDoc.scrapePage(function(myDoc) {
				Scholar.Ingester.deleteHiddenBrowser(browser);
				complete(myDoc);
			});
		} else {
			Scholar.Ingester.deleteHiddenBrowser(browser);
			complete(myDoc);
		}
	}
	
	var failed = function() {
		Scholar.debug("Scholar.Ingester.ingestURL: could not ingest "+url);
		error();
	}
	
	Scholar.Utilities.HTTP.processDocuments(null, [ url ], succeeded, function() {}, failed, true);
}

/////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.ProxyMonitor
//
/////////////////////////////////////////////////////////////////

// A singleton for recognizing EZProxies and converting URLs such that databases
// will work from outside them. Unfortunately, this only works with the ($495)
// EZProxy software. If there are open source alternatives, we should support
// them too.

/*
 * Precompile proxy regexps
 */
Scholar.Ingester.ProxyMonitor = new function() {
	var _ezProxyRe = new RegExp();
	_ezProxyRe.compile("\\?(?:.+&)?(url|qurl)=([^&]+)", "i");
	/*var _hostRe = new RegExp();
	_hostRe.compile("^https?://(([^/:]+)(?:\:([0-9]+))?)");*/
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
							  .getService(Components.interfaces.nsIIOService);
	var on = false;
	var _mapFromProxy = null;
	var _mapToProxy = null;
	
	this.init = init;
	this.proxyToProper = proxyToProper;
	this.properToProxy = properToProxy;
	this.observe = observe;
	
	function init() {
		if(!on) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
										.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(this, "http-on-examine-response", false);
		}
		on = true;
	}
	
	function observe(channel) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		if(channel.getResponseHeader("Server") == "EZproxy") {
			// We're connected to an EZproxy
			if(channel.responseStatus != "302") {
				return;
			}
			
			Scholar.debug(channel.URI.spec);
			// We should be able to scrape the URL out of this
			var m = _ezProxyRe.exec(channel.URI.spec);
			if(!m) {
				return;
			}
			
			// Found URL
			var variable = m[1];
			var properURL = m[2];
			if(variable.toLowerCase() == "qurl") {
				properURL = unescape(properURL);
			}
			var properURI = _parseURL(properURL);
			if(!properURI) {
				return;
			}
			
			// Get the new URL
			var newURL = channel.getResponseHeader("Location");
			if(!newURL) {
				return;
			}
			var newURI = _parseURL(newURL);
			if(!newURI) {
				return;
			}
			
			if(channel.URI.host == newURI.host && channel.URI.port != newURI.port) {
				// Different ports but the same server means EZproxy active
				
				Scholar.debug("EZProxy: host "+newURI.hostPort+" is really "+properURI.hostPort);
				// Initialize variables here so people who never use EZProxies
				// don't get the (very very minor) speed hit
				if(!_mapFromProxy) {
					_mapFromProxy = new Object();
					_mapToProxy = new Object();
				}
				_mapFromProxy[newURI.hostPort] = properURI.hostPort;
				_mapToProxy[properURI.hostPort] = newURI.hostPort;
			}
		}
	}
	
	/*
	 * Returns a page's proper url, adjusting for proxying
	 */
	function proxyToProper(url) {
		if(_mapFromProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapFromProxy[uri.hostPort]) {
				url = url.replace(uri.hostPort, _mapFromProxy[uri.hostPort]);
				Scholar.debug("EZProxy: proper url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Returns a page's proxied url from the proper url
	 */
	function properToProxy(url) {
		if(_mapToProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapToProxy[uri.hostPort]) {
				// Actually need to map
				url = url.replace(uri.hostPort, _mapToProxy[uri.hostPort]);
				Scholar.debug("EZProxy: proxied url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Parses a url into components (hostPort, port, host, and spec)
	 */
	function _parseURL(url) {
		// create an nsIURI (not sure if this is faster than the regular
		// expression, but it's at least more kosher)
		var uri = ioService.newURI(url, null, null);
		return uri;
	}
}

/////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Model
//
/////////////////////////////////////////////////////////////////

// Scholar.Ingester.Model, an object representing an RDF data model with
// methods to add to that model. In Piggy Bank, this was implemented in Java,
// but seeing as we don't really want an enormous web server running with FS,
// but we don't actually need that, so it's much simpler.
// 
// The Java version of this class can be viewed at
// http://simile.mit.edu/repository/piggy-bank/trunk/src/java/edu/mit/simile/piggyBank/WorkingModel.java
Scholar.Ingester.Model = function() {
	this.data = new Object();
}

// Piggy Bank provides a fourth argument, one that determines if the third
// argument is a literal or an RDF URI. Since our ontologies are
// sufficiently restricted, we have no chance of confusing a literal and an
// RDF URI and thus this is unnecessary.
Scholar.Ingester.Model.prototype.addStatement = function(uri, rdfUri, literal) {
	if(!this.data[uri]) this.data[uri] = new Object();
	if(!this.data[uri][rdfUri]) {
		this.data[uri][rdfUri] = new Array();
	}
	this.data[uri][rdfUri].push(literal);
	Scholar.debug(rdfUri+" for "+uri+" is "+literal);
}

// Additional functions added for compatibility purposes only
// No idea if any scraper actually uses these, but just in case, they're
// implemented so as not to throw an exception
Scholar.Ingester.Model.prototype.addTag = function() {}
Scholar.Ingester.Model.prototype.getRepository = function() {}
Scholar.Ingester.Model.prototype.detachRepository = function() {}

//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Document
//
//////////////////////////////////////////////////////////////////////////////

/* THIS CODE IS GOING AWAY
 * eventually, all ingesting will be part of a unified API in Scholar.Translate.
 * until then, Scholar.Ingester.Document reigns supreme.
 * 
 * Public properties:
 * browser - browser window object of document
 * model - data model for semantic scrapers
 * scraper - best scraper to use to scrape page
 * items - items returned after page is scraped
 * window - window, for creating new hidden browsers
 * url - url, as passed through proxy system
 * type - type of item that will be scraped (set after retrieveScraper() is
 *        called)
 *
 * Private properties:
 * _sandbox - sandbox for code execution
 * _scrapeCallback - callback function to be executed when scraping is complete
 */

//////////////////////////////////////////////////////////////////////////////
//
// Public Scholar.Ingester.Document methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Constructor for Document object
 */
Scholar.Ingester.Document = function(myBrowser, myWindow, isHidden) {
	this.browser = myBrowser;
	this.window = myWindow;
	this.isHidden = isHidden;
	this.scraper = this.type = null;
	this.model = new Scholar.Ingester.Model();
	
	// Create separate URL to account for proxies
	this.url = Scholar.Ingester.ProxyMonitor.proxyToProper(this.browser.contentDocument.location.href);
	if(this.url != this.browser.contentDocument.location.href) {
		this.proxiedURL = true;
	}
	
	this.items = new Array();
	this._generateSandbox();
}

/*
 * Retrieves the best scraper to scrape a given page
 */
Scholar.Ingester.Document.prototype.retrieveScraper = function() {
	Scholar.debug("Retrieving scrapers for "+this.url);
	
	var sql = 'SELECT * FROM translators WHERE type = 3 ORDER BY detectCode IS NULL DESC';
	var scrapers = Scholar.DB.query(sql);
	for(var i=0; i<scrapers.length; i++) {
		var currentScraper = scrapers[i];
		if(this.canScrape(currentScraper)) {
			this.scraper = currentScraper;
			Scholar.debug("Found scraper "+this.scraper.label);
			return true;
		}
	}
	return false;
}

/*
 * Check to see if _scraper_ can scrape this document
 */
Scholar.Ingester.Document.prototype.canScrape = function(currentScraper) {
	var canScrape = false;
	
	// Test with regular expression
	// If this is slow, we could preload all scrapers and compile regular
	// expressions, so each check will be faster
	if(currentScraper.target) {
		var regularExpression = new RegExp(currentScraper.target, "i");
		if(regularExpression.test(this.url)) {
			canScrape = true;
		}
	}
	
	// Test with JavaScript if available and didn't have a regular expression or
	// passed regular expression test
	if((!currentScraper.target || canScrape)
	  && currentScraper.detectCode) {
		Scholar.debug("Checking detectCode");
		var scraperSandbox = this._sandbox;
		try {
			canScrape = Components.utils.evalInSandbox("(function(){\n" +
							   currentScraper.detectCode +
							   "\n})()", scraperSandbox);
		} catch(e) {
			Scholar.debug(e+' in detectCode for '+currentScraper.label);
			return false;
		}
				
		// detectCode returns text type
		if(canScrape.toString() != "") {
			this.type = canScrape;
		} else {
			this.type = "website";
		}
	}
	return canScrape;
}

/*
 * Populate model with semantic data regarding this page using _scraper_
 * Callback will be executed once scraping is complete
 */
Scholar.Ingester.Document.prototype.scrapePage = function(callback) {
	if(callback) {
		this._scrapeCallback = callback;
	}
	
	Scholar.debug("Scraping "+this.url);
	
	var scraperSandbox = this._sandbox;
	try {
		var returnValue = Components.utils.evalInSandbox("(function(){\n" +
							   this.scraper.code +
							   "\n})()", scraperSandbox);
	} catch(e) {
		Scholar.debug(e+' in code for '+this.scraper.label);
		this._scrapePageComplete(false);
		return;
	}
	
	// If synchronous, call _scrapePageComplete();
	if(!this._waitForCompletion) {
		Scholar.debug("is asynch");
		this._scrapePageComplete(returnValue);
	}
}

//////////////////////////////////////////////////////////////////////////////
//
// Private Scholar.Ingester.Document methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Piggy Bank/FS offers four objects to JavaScript scrapers
 * browser - the object representing the open browser window containing the
 *           document to be processes
 * doc - the DOM (basically just browser.contentDocument)
 * model - the object representing the RDF model of data to be returned
 *         (see Scholar.Ingester.Model)
 * utilities - a set of utilities for making certain tasks easier
 *             (see Scholar.Utilities);
 *
 * Piggy Bank/FS also offers two functions to simplify asynchronous requests
 * (these will only be available for scraping, and not for scrape detection)
 * wait() - called on asynchronous requests so that Piggy Bank/FS will not
 *          automatically return at the end of code execution
 * done() - when wait() is called, Piggy Bank/FS will wait for this
 *          function before returning
 */

/*
 * Called when scraping (synchronous or asynchronous) is complete
 */
Scholar.Ingester.Document.prototype._scrapePageComplete = function(returnValue) {
	this._updateDatabase();
	if(this._scrapeCallback) {
		this._scrapeCallback(this, returnValue);
	}
	// Get us ready for another scrape
	delete this.model;
	delete this.items;
	this.model = new Scholar.Ingester.Model();
	this.items = new Array();
	this._waitForCompletion = false;
	// This is perhaps a bit paranoid, but we need to get the model redone anyway
	this._generateSandbox();
}

/*
 * Generates a sandbox for scraping/scraper detection
 */
Scholar.Ingester.Document.prototype._generateSandbox = function() {
	this._sandbox = new Components.utils.Sandbox(this.browser.contentDocument.location.href);
	this._sandbox.browser = this.browser;
	this._sandbox.doc = this.browser.contentDocument;
	this._sandbox.url = this.url;
	this._sandbox.utilities = new Scholar.Utilities.Ingester(this.window, this.proxiedURL, this.isHidden);
	this._sandbox.utilities.HTTPUtilities = new Scholar.Utilities.Ingester.HTTPUtilities(this.proxiedURL);
	this._sandbox.window = this.window;
	this._sandbox.model = this.model;
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	this._sandbox.MARC_Record = Scholar.Ingester.MARC_Record;
	this._sandbox.MARC_Record.prototype = new Scholar.Ingester.MARC_Record();
	
	var me = this;
	this._sandbox.wait = function(){ me._waitForCompletion = true; };
	this._sandbox.done = function(){ me._scrapePageComplete(); };
}

Scholar.Ingester.Document.prototype._associateRDF = function(rdfUri, field, uri, item, typeID) {
	var fieldID;
	if(fieldID = Scholar.ItemFields.getID(field)) {
		if(this.model.data[uri][rdfUri] && Scholar.ItemFields.isValidForType(fieldID, typeID)) {
			item.setField(field, this.model.data[uri][rdfUri][0]);
		} else {
			Scholar.debug("discarded scraper " + field + " data: not valid for item type "+typeID);
		}
	} else {
		Scholar.debug("discarded scraper " + field + " data: no field in database");
	}
}

/*
 * Add data ingested using RDF to database
 * (Ontologies are hard-coded until we have a real way of dealing with them)
 */
Scholar.Ingester.Document.prototype._updateDatabase = function() {
	Scholar.debug("doing updating");
	
	var prefixRDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
	var prefixDC = 'http://purl.org/dc/elements/1.1/';
	var prefixDCMI = 'http://purl.org/dc/dcmitype/';
	var prefixDummy = 'http://chnm.gmu.edu/firefox-scholar/';
	
	// Call number fields, in order of preference
	var callNumbers = new Array("LCC", "DDC", "UDC", "NLM", "NAL", "CN");
	
	try {
		for(var uri in this.model.data) {
			// Get typeID, defaulting to "website"
			try {
				var type = this.model.data[uri][prefixRDF + 'type'][0].substr(prefixDummy.length);
				var typeID = Scholar.ItemTypes.getID(type);
			} catch(ex) {
				var typeID = Scholar.ItemTypes.getID("website")
			}
			
			var newItem = Scholar.Items.getNewItemByType(typeID);
			
			// Handle source and title
			newItem.setField("source", uri);
			if(this.model.data[uri][prefixDC + 'title']) {
				newItem.setField("title", this.model.data[uri][prefixDC + 'title'][0]);
			}
			
			// Handle creators and contributors
			var creatorIndex = 0;
			if(this.model.data[uri][prefixDC + 'creator']) {
				for(i in this.model.data[uri][prefixDC + 'creator']) {
					var creator = this.model.data[uri][prefixDC + 'creator'][i];
					var spaceIndex = creator.lastIndexOf(" ");
					var lastName = creator.substring(spaceIndex+1, creator.length);
					var firstName = creator.substring(0, spaceIndex);
					
					newItem.setCreator(creatorIndex, firstName, lastName, 1);
					creatorIndex++;
				}
			}
			if(this.model.data[uri][prefixDC + 'contributor']) {
				for(i in this.model.data[uri][prefixDC + 'contributor']) {
					var creator = this.model.data[uri][prefixDC + 'contributor'][i];
					var spaceIndex = creator.lastIndexOf(" ");
					var lastName = creator.substring(spaceIndex+1, creator.length);
					var firstName = creator.substring(0, spaceIndex);
				
					newItem.setCreator(creatorIndex, firstName, lastName, 2);
					creatorIndex++;
				}
			}
			if(this.model.data[uri][prefixDummy + 'corporateCreator']) {
				for(i in this.model.data[uri][prefixDummy + 'corporateCreator']) {
					newItem.setCreator(creatorIndex, null, this.model.data[uri][prefixDummy + 'corporateCreator'][i], 1);
					creatorIndex++;
				}
			}
			if(this.model.data[uri][prefixDummy + 'corporateContributor']) {
				for(i in this.model.data[uri][prefixDummy + 'corporateContributor']) {
					newItem.setCreator(creatorIndex, null, this.model.data[uri][prefixDummy + 'corporateContributor'][i], 2);
					creatorIndex++;
				}
			}
			if(this.model.data[uri][prefixDummy + 'editor']) {
				for(i in this.model.data[uri][prefixDummy + 'editor']) {
					newItem.setCreator(creatorIndex, null, this.model.data[uri][prefixDummy + 'editor'][i], 3);
					creatorIndex++;
				}
			}
			
			// Handle years, extracting from date if necessary
			if(Scholar.ItemFields.isValidForType(Scholar.ItemFields.getID("year"), typeID)) {
				if(this.model.data[uri][prefixDC + 'year']) {
					newItem.setField("year", this.model.data[uri][prefixDC + 'year'][0]);
				} else if(this.model.data[uri][prefixDC + 'date'] && this.model.data[uri][prefixDC + 'date'][0].length >= 4) {
					var ISORe = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
					if(ISORe.test(this.model.data[uri][prefixDC + 'date'][0])) {
						newItem.setField("year", this.model.data[uri][prefixDC + 'date'][0].substr(0, 4));
					} else {
						var m;
						var yearRe = /[0-9]{4}$/;
						if(m = yearRe.exec(this.model.data[uri][prefixDC + 'date'][0])) {
							newItem.setField("year", m[0]);
						}
					}
				}
			}
			
			// Handle ISBNs/ISSNs/Call Numbers
			if(this.model.data[uri][prefixDC + 'identifier']) {
				var oldIndex = -1;
				var needISSN =  Scholar.ItemFields.isValidForType(Scholar.ItemFields.getID("ISSN"), typeID);
				var needISBN =  Scholar.ItemFields.isValidForType(Scholar.ItemFields.getID("ISBN"), typeID);
				for(i in this.model.data[uri][prefixDC + 'identifier']) {
					prefix = this.model.data[uri][prefixDC + 'identifier'][i].substr(0, this.model.data[uri][prefixDC + 'identifier'][i].indexOf(" "));
					if(needISSN && prefix == 'ISSN') {
						newItem.setField("ISSN", this.model.data[uri][prefixDC + 'identifier'][i].substring(5));
						needISSN = false;
					}
					if(needISBN && prefix == 'ISBN') {
						newItem.setField("ISBN", this.model.data[uri][prefixDC + 'identifier'][i].substring(5));
						needISBN = false;
					}
					var newIndex = Scholar.arraySearch(prefix, callNumbers);
					if(newIndex && newIndex > oldIndex) {
						oldIndex = newIndex;
						var callNumber = this.model.data[uri][prefixDC + 'identifier'][i].substring(prefix.length+1);
					}
				}
				if(callNumber) {
					newItem.setField("callNumber", callNumber);
				}
			}
			
			this._associateRDF(prefixDummy + 'publication', "publication", uri, newItem, typeID);
			this._associateRDF(prefixDummy + 'volume', "volume", uri, newItem, typeID);
			this._associateRDF(prefixDummy + 'number', "number", uri, newItem, typeID);
			this._associateRDF(prefixDummy + 'pages', "pages", uri, newItem, typeID);
			this._associateRDF(prefixDC + 'publisher', "publisher", uri, newItem, typeID);
			this._associateRDF(prefixDC + 'date', "date", uri, newItem, typeID);
			this._associateRDF(prefixDC + 'hasVersion', "edition", uri, newItem, typeID);
			this._associateRDF(prefixDummy + 'series', "series", uri, newItem, typeID);
			this._associateRDF(prefixDummy + 'place', "place", uri, newItem, typeID);
			
			this.items.push(newItem);
		}
	} catch(ex) {
		Scholar.debug('Error in Scholar.Ingester.Document._updateDatabase: '+ex);
	}
}