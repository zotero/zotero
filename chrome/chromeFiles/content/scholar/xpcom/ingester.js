// Firefox Scholar Ingester
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

Scholar.Ingester = new function() {}

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

/////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Utilities
//
/////////////////////////////////////////////////////////////////
// Scholar.Ingester.Utilities class, a set of methods to assist in data
// extraction. Most code here was stolen directly from the Piggy Bank project.
Scholar.Ingester.Utilities = function(myWindow) {
	this.window = myWindow;
}

// Adapter for Piggy Bank function to print debug messages; log level is
// fixed at 4 (could change this)
Scholar.Ingester.Utilities.prototype.debugPrint = function(msg) {
	Scholar.debug(msg, 4);
}

// Appears to trim a string, chopping of newlines/spacing
Scholar.Ingester.Utilities.prototype.trimString = function(s) {
	var i = 0;
	var spaceChars = " \n\r\t" + String.fromCharCode(160) /* &nbsp; */;
	while (i < s.length) {
		var c = s.charAt(i);
		if (spaceChars.indexOf(c) < 0) {
			break;
		}
		i++;
	}
	
	s = s.substring(i);
	
	i = s.length;
	while (i > 0) {
		var c = s.charAt(i - 1);
		if (spaceChars.indexOf(c) < 0) {
			break;
		}
		i--;
	}
	
	return s.substring(0, i);
}

// Takes an XPath query and returns the results
Scholar.Ingester.Utilities.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
	var elmts = [];
	
	var iterator = doc.evaluate(xpath, parentNode, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
	var elmt = iterator.iterateNext();
	var i = 0;
	while (elmt) {
		elmts[i++] = elmt;
		elmt = iterator.iterateNext();
	}
	return elmts;
}

// Loads a single document for a scraper, running succeeded() on success or
// failed() on failure
Scholar.Ingester.Utilities.prototype.loadDocument = function(url, browser, succeeded, failed) {
	Scholar.debug("loadDocument called");
	this.processDocuments(browser, null, [ url ], succeeded, function() {}, failed);
}

// Downloads and processes documents with processor()
// browser - a browser object
// firstDoc - the first document to process with the processor (if null, 
//            first document is processed without processor)
// urls - an array of URLs to load
// processor - a function to execute to process each document
// done - a function to execute when all document processing is complete
// exception - a function to execute if an exception occurs (exceptions are
//             also logged in the Firefox Scholar log)
Scholar.Ingester.Utilities.prototype.processDocuments = function(browser, firstDoc, urls, processor, done, exception) {
	var hiddenBrowser = Scholar.Ingester.createHiddenBrowser(this.window);
	Scholar.debug("processDocuments called");
	
	try {
		if (urls.length == 0) {
			if (firstDoc) {
				processor(firstDoc, done);
			} else {
				done();
			}
			return;
		}
		
		var urlIndex = -1;
		var doLoad = function() {
			urlIndex++;
			if (urlIndex < urls.length) {
				try {
					var url = urls[urlIndex];
					Scholar.debug("loading "+url);
					hiddenBrowser.loadURI(url);
				} catch (e) {
					Scholar.debug("Scholar.Ingester.Utilities.processDocuments doLoad: " + e, 2);
					exception(e);
				}
			} else {
				Scholar.Ingester.deleteHiddenBrowser(hiddenBrowser);
				hiddenBrowser.setTimeout(done, 10);
			}
		};
		var onLoad = function() {
			Scholar.debug("onLoad called");
			hiddenBrowser.removeEventListener("load", onLoad, true);
			try {
				var newHiddenBrowser = new Object();
				newHiddenBrowser.contentDocument = hiddenBrowser.contentDocument;
				newHiddenBrowser.contentWindow = hiddenBrowser.contentWindow;
				processor(newHiddenBrowser);
			} catch (e) {
				Scholar.debug("Scholar.Ingester.Utilities.processDocuments onLoad: " + e, 2);
				exception(e);
			}
			doLoad();
		};
		var init = function() {
			Scholar.debug("init called");
			hiddenBrowser.addEventListener("load", onLoad, true);
			
			if (firstDoc) {
				Scholar.debug("processing");
				processor(firstDoc, doLoad);
			} else {
				Scholar.debug("doing load");
				doLoad();
			}
		}
		
		init();
	} catch (e) {
		Scholar.debug("processDocuments: " + e);
		exception(e);
	}
}

// Appears to look for links in a document containing a certain substring
Scholar.Ingester.Utilities.prototype.collectURLsWithSubstring = function(doc, substring) {
	var urls = [];
	var addedURLs = [];
	
	var aElements = doc.evaluate("//a", doc, null, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
	var aElement = aElements.iterateNext();
	while (aElement) {
		var href = aElement.href;
		if (href.indexOf(substring) >= 0 && !(addedURLs[href])) {
			urls.unshift(href);
			addedURLs[href] = true;
		}
		aElement = aElements.iterateNext();
	}
	return urls;
}

// For now, we're going to skip the getLLsFromAddresses function (which gets
// latitude and longitude pairs from a series of addresses, but requires the
// big mess of Java code that is the Piggy Bank server) and the geoHelper
// tools (which rely on getLLsFromAddresses) since these are probably not
// essential components for Scholar and would take a great deal of effort to
// implement. We can, however, always implement them later.

/*
 * BEGIN FIREFOX SCHOLAR EXTENSIONS
 * Functions below this point are extensions to the utilities provided by
 * Piggy Bank. When used in external code, the repository will need to add
 * a function definition when exporting in Piggy Bank format.
 */

/*
 * Converts a JavaScript date object to an ISO-style date
 */
Scholar.Ingester.Utilities.prototype.dateToISO = function(jsDate) {
	var date = "";
	var year = jsDate.getFullYear().toString();
	var month = (jsDate.getMonth()+1).toString();
	var day = jsDate.getDate().toString();
	
	for(var i = year.length; i<4; i++) {
		date += "0";
	}
	date += year+"-";
	
	if(month.length == 1) {
		date += "0";
	}
	date += month+"-";
	
	if(day.length == 1) {
		date += "0";
	}
	date += day;
	
	return date;
}

/*
 * Gets a given node (assumes only one value)
 */
Scholar.Ingester.Utilities.prototype.getNode = function(doc, contextNode, xpath, nsResolver) {
	return doc.evaluate(xpath, contextNode, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null).iterateNext();
}

/*
 * Gets a given node as a string containing all child nodes
 */
Scholar.Ingester.Utilities.prototype.getNodeString = function(doc, contextNode, xpath, nsResolver) {
	var elmts = this.gatherElementsOnXPath(doc, contextNode, xpath, nsResolver);
	var returnVar = "";
	for(var i=0; i<elmts.length; i++) {
		returnVar += elmts[i].nodeValue;
	}
	return returnVar;
}

/*
 * Cleans extraneous punctuation off an author name
 */
Scholar.Ingester.Utilities.prototype.cleanAuthor = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\,\/\[\]\:\.]+$/, '');
	author = author.replace(/  +/, ' ');
	// Add period for initials
	if(author.substring(author.length-2, author.length-1) == " ") {
		author += ".";
	}
	var splitNames = author.split(', ');
	if(splitNames.length > 1) {
		author = splitNames[1]+' '+splitNames[0];
	}
	return author;
}

/*
 * Cleans whitespace off a string and replaces multiple spaces with one
 */
Scholar.Ingester.Utilities.prototype.cleanString = function(s) {
	s = this.trimString(s);
	return s.replace(/[ \xA0]+/g, " ");
}

/*
 * Cleans any non-world non-parenthesis characters off the ends of a string
 */
Scholar.Ingester.Utilities.prototype.superCleanString = function(x) {
	var x = x.replace(/^[^\w(]+/, "");
	return x.replace(/[^\w)]+$/, "");
}

/*
 * Eliminates HTML tags, replacing <br>s with /ns
 */
Scholar.Ingester.Utilities.prototype.cleanTags = function(x) {
	x = x.replace(/<br[^>]*>/gi, "\n");
	return x.replace(/<[^>]+>/g, "");
}

/*
 * Allows a user to select which items to scrape
 */
Scholar.Ingester.Utilities.prototype.selectItems = function(itemList) {
	// mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = this.window.openDialog("chrome://scholar/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	return io.dataOut;
}

/*
 * Grabs items based on URLs
 */
Scholar.Ingester.Utilities.prototype.getItemArray = function(doc, inHere, urlRe, rejectRe) {
	var availableItems = new Object();	// Technically, associative arrays are objects
	
	// Require link to match this
	var tagRegexp = new RegExp();
	tagRegexp.compile(urlRe);
	// Do not allow text to match this
	var rejectRegexp = new RegExp();
	rejectRegexp.compile(rejectRe);
	
	var links = inHere.getElementsByTagName("a");
	for(var i=0; i<links.length; i++) {
		if(tagRegexp.test(links[i].href)) {
			var text = this.getNodeString(doc, links[i], './/text()', null);
			if(text) {
				text = this.cleanString(text);
				if(!rejectRegexp.test(text)) {
					if(availableItems[links[i].href]) {
						availableItems[links[i].href] += " "+text;
					} else {
						availableItems[links[i].href] = text;
					}
				}
			}
		}
	}
	
	return availableItems;
}

// These functions are for use by importMARCRecord. They're private, because,
// while they are useful, it's also nice if as many of our scrapers as possible
// are PiggyBank compatible, and if our scrapers used functions, that would
// break compatibility
Scholar.Ingester.Utilities.prototype._MARCCleanString = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	return author.replace(/  +/, ' ');
}

Scholar.Ingester.Utilities.prototype._MARCCleanNumber = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	var regexp = /^[^ ]*/;
	var m = regexp.exec(author);
	if(m) {
		return m[0];
	}
}

Scholar.Ingester.Utilities.prototype._MARCAssociateField = function(record, uri, model, fieldNo, rdfUri, execMe, prefix, part) {
	if(!part) {
		part = 'a';
	}
	var field = record.get_field_subfields(fieldNo);
	Scholar.debug('Found '+field.length+' matches for '+fieldNo+part);
	if(field) {
		for(i in field) {
			if(field[i][part]) {
				var value = field[i][part];
				Scholar.debug(value);
				if(fieldNo == '245') {	// special case - title + subtitle
					if(field[i]['b']) {
						value += ' '+field[i]['b'];
					}
				}
				if(execMe) {
					value = execMe(value);
				}
				if(prefix) {
					value = prefix + value;
				}
				model.addStatement(uri, rdfUri, value);
			}
		}
	}
	return model;
}

// This is an extension to PiggyBank's architecture. It's here so that we don't
// need an enormous library for each scraper that wants to use MARC records
Scholar.Ingester.Utilities.prototype.importMARCRecord = function(record, uri, model) {
	var prefixDC = 'http://purl.org/dc/elements/1.1/';
	var prefixDCMI = 'http://purl.org/dc/dcmitype/';
	var prefixDummy = 'http://chnm.gmu.edu/firefox-scholar/';
	
	// Extract ISBNs
	model = this._MARCAssociateField(record, uri, model, '020', prefixDC + 'identifier', this._MARCCleanNumber, 'ISBN ');
	// Extract ISSNs
	model = this._MARCAssociateField(record, uri, model, '022', prefixDC + 'identifier', this._MARCCleanNumber, 'ISSN ');
	// Extract creators
	model = this._MARCAssociateField(record, uri, model, '100', prefixDC + 'creator', this.cleanAuthor);
	model = this._MARCAssociateField(record, uri, model, '110', prefixDummy + 'corporateCreator', this._MARCCleanString);
	model = this._MARCAssociateField(record, uri, model, '111', prefixDummy + 'corporateCreator', this._MARCCleanString);
	model = this._MARCAssociateField(record, uri, model, '700', prefixDC + 'contributor', this.cleanAuthor);
	model = this._MARCAssociateField(record, uri, model, '710', prefixDummy + 'corporateContributor', this._MARCCleanString);
	model = this._MARCAssociateField(record, uri, model, '711', prefixDummy + 'corporateContributor', this._MARCCleanString);
	if(!model.data[uri] || (!model.data[uri][prefixDC + 'creator'] && !model.data[uri][prefixDC + 'contributor'] && !model.data[uri][prefixDummy + 'corporateCreator'] && !model.data[uri][prefixDummy + 'corporateContributor'])) {
		// some LOC entries have no listed author, but have the author in the person subject field as the first entry
		var field = record.get_field_subfields('600');
		if(field[0]) {
			model.addStatement(uri, prefixDC + 'creator', this.cleanAuthor(field[0]['a']));	
		}
	}
	// Extract title
	model = this._MARCAssociateField(record, uri, model, '245', prefixDC + 'title', this._MARCCleanString);
	// Extract edition
	model = this._MARCAssociateField(record, uri, model, '250', prefixDC + 'hasVersion', this._MARCCleanString);
	// Extract place info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDummy + 'place', this._MARCCleanString, '', 'a');
	// Extract publisher info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'publisher', this._MARCCleanString, '', 'b');
	// Extract year
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'year', this._MARCCleanString, '', 'c');
	// Extract series
	model = this._MARCAssociateField(record, uri, model, '440', prefixDummy + 'series', this._MARCCleanString);
}

/*
 * END FIREFOX SCHOLAR EXTENSIONS
 */

// These are front ends for XMLHttpRequest. XMLHttpRequest can't actually be
// accessed outside the sandbox, and even if it could, it wouldn't let scripts
// access across domains, so everything's replicated here.
Scholar.Ingester.HTTPUtilities = function(contentWindow) {
	this.window = contentWindow;
}

Scholar.Ingester.HTTPUtilities.prototype.doGet = function(url, onStatus, onDone) {
	var xmlhttp = new this.window.XMLHttpRequest();
	
	xmlhttp.open('GET', url, true);
	xmlhttp.overrideMimeType("text/plain");
	
	var me = this;
	xmlhttp.onreadystatechange = function() {
		me.stateChange(xmlhttp, onStatus, onDone);
	};
	xmlhttp.send(null);
}

Scholar.Ingester.HTTPUtilities.prototype.doPost = function(url, body, onStatus, onDone) {
	var xmlhttp = new this.window.XMLHttpRequest();
	
	xmlhttp.open('POST', url, true);
	xmlhttp.overrideMimeType("text/plain");
	
	var me = this;
	xmlhttp.onreadystatechange = function() {
		me.stateChange(xmlhttp, onStatus, onDone);
	};
	xmlhttp.send(body);
}
	
Scholar.Ingester.HTTPUtilities.prototype.doOptions = function(url, body, onStatus, onDone) {
	var xmlhttp = new this.window.XMLHttpRequest();
  
	xmlhttp.open('OPTIONS', url, true);
	xmlhttp.overrideMimeType("text/plain");
	
	var me = this;
	xmlhttp.onreadystatechange = function() {
		me.stateChange(xmlhttp, onStatus, onDone);
	};
	xmlhttp.send(body);
}
	
// Possible point of failure; for some reason, this used to be a separate
// class, so make sure it works
Scholar.Ingester.HTTPUtilities.prototype.stateChange = function(xmlhttp, onStatus, onDone) {
	switch (xmlhttp.readyState) {

		// Request not yet made
		case 1:
		break;

		// Contact established with server but nothing downloaded yet
		case 2:
			try {
				// Check for HTTP status 200
				if (xmlhttp.status != 200) {
					if (onStatus) {
						onStatus(
							xmlhttp.status,
							xmlhttp.statusText,
							xmlhttp
						);
						xmlhttp.abort();
					}
				}
			} catch (e) {
				Scholar.debug(e, 2);
			}
		break;

		// Called multiple while downloading in progress
		case 3:
		break;

		// Download complete
		case 4:
			try {
				if (onDone) {
					onDone(xmlhttp.responseText, xmlhttp);
				}
			} catch (e) {
				Scholar.debug(e, 2);
			}
		break;
	}
}
//////////////////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.Document
//
//////////////////////////////////////////////////////////////////////////////

/* Public properties:
 * browser - browser window object of document
 * model - data model for semantic scrapers
 * scraper - best scraper to use to scrape page
 * items - items returned after page is scraped
 *
 * Private properties:
 * _sandbox - sandbox for code execution
 * _appSvc - AppShellService instance
 * _hiddenBrowser - hiden browser object
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
Scholar.Ingester.Document = function(browserWindow, myWindow){
	this.scraper = null;
	this.browser = browserWindow;
	this.window = myWindow;
	this.model = new Scholar.Ingester.Model();
	this.items = new Array();
	this._appSvc = Cc["@mozilla.org/appshell/appShellService;1"]
	             .getService(Ci.nsIAppShellService);
	this._generateSandbox();
}

/*
 * Retrieves the best scraper to scrape a given page
 */
Scholar.Ingester.Document.prototype.retrieveScraper = function() {
	Scholar.debug("Retrieving scrapers for "+this.browser.contentDocument.location.href);
	var sql = 'SELECT * FROM scrapers ORDER BY scraperDetectCode IS NULL DESC';
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
	if(currentScraper.urlPattern) {
		var regularExpression = new RegExp(currentScraper.urlPattern, "i");
		if(regularExpression.test(this.browser.contentDocument.location.href)) {
			canScrape = true;
		}
	}
	
	// Test with JavaScript if available and didn't have a regular expression or
	// passed regular expression test
	if((!currentScraper.urlPattern || canScrape)
	  && currentScraper.scraperDetectCode) {
		Scholar.debug("Checking scraperDetectCode");
		var scraperSandbox = this._sandbox;
		try {
			canScrape = Components.utils.evalInSandbox("(function(){\n" +
							   currentScraper.scraperDetectCode +
							   "\n})()", scraperSandbox);
		} catch(e) {
			Scholar.debug(e+' in scraperDetectCode for '+currentScraper.label);
			return false;
		}
				
		// scraperDetectCode returns an associative array (object) in the case of a search result
		if(typeof(canScrape) == "object") {
			Scholar.debug("scraperDetectCode returned a URL list");
			this.scrapeURLList = canScrape;
		} else {
			Scholar.debug("canScrape was a "+typeof(canScrape));
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
	
	Scholar.debug("Scraping "+this.browser.contentDocument.location.href);
	
	var scraperSandbox = this._sandbox;
	try {
		var returnValue = Components.utils.evalInSandbox("(function(){\n" +
							   this.scraper.scraperJavaScript +
							   "\n})()", scraperSandbox);
	} catch(e) {
		Scholar.debug(e+' in scraperJavaScript for '+this.scraper.label);
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
 *             (see Scholar.Ingester.Utilities);
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
	// This is perhaps a bit paranoid, but we need to get the model redone anyway
	this._generateSandbox();
}

/*
 * Generates a sandbox for scraping/scraper detection
 */
Scholar.Ingester.Document.prototype._generateSandbox = function() {
	this._sandbox = new Components.utils.Sandbox(this.browser.contentDocument.location.href);
	this._sandbox.browser = this.browser;
	this._sandbox.doc = this._sandbox.browser.contentDocument;
	this._sandbox.utilities = new Scholar.Ingester.Utilities(this.window);
	this._sandbox.utilities.HTTPUtilities = new Scholar.Ingester.HTTPUtilities(this._appSvc.hiddenDOMWindow);
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
	
	var typeToTypeID = new Object();
	typeToTypeID[prefixDummy + 'book'] = 1;
	typeToTypeID[prefixDummy + 'journal'] = 2;
	typeToTypeID[prefixDummy + 'newspaper'] = 2;
	
	try {
		for(var uri in this.model.data) {
			var typeID = typeToTypeID[this.model.data[uri][prefixRDF + 'type']];
			if(!typeID) {
				var typeID = 1;
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
					newItem.setField("year", this.model.data[uri][prefixDC + 'date'][0].substr(0, 4));
				}
			}
			
			// Handle ISBNs/ISSNs
			if(this.model.data[uri][prefixDC + 'identifier']) {
				var needISSN =  Scholar.ItemFields.isValidForType(Scholar.ItemFields.getID("ISSN"), typeID);
				var needISBN =  Scholar.ItemFields.isValidForType(Scholar.ItemFields.getID("ISBN"), typeID);
				if(needISSN || needISBN) {
					for(i in this.model.data[uri][prefixDC + 'identifier']) {
						firstFour = this.model.data[uri][prefixDC + 'identifier'][i].substring(0, 4);
						if(needISSN && firstFour == 'ISSN') {
							newItem.setField("ISSN", this.model.data[uri][prefixDC + 'identifier'][0].substring(5));
							break;
						}
						if(needISBN && firstFour == 'ISBN') {
							newItem.setField("ISBN", this.model.data[uri][prefixDC + 'identifier'][0].substring(5));
							break;
						}
					}
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