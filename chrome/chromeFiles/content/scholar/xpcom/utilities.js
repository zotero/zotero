// Scholar for Firefox Utilities

/////////////////////////////////////////////////////////////////
//
// Scholar.Utilities
//
/////////////////////////////////////////////////////////////////

Scholar.Utilities = function () {}

Scholar.Utilities.prototype.debug = function(msg) {
	Scholar.debug(msg, 4);
}

/*
 * Converts a JavaScript date object to an SQL-style date
 */
Scholar.Utilities.prototype.dateToSQL = function(jsDate) {
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
 * Cleans extraneous punctuation off an author name
 */
Scholar.Utilities.prototype.cleanAuthor = function(author, type, useComma) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\,\/\[\]\:\.]+$/, '');
	author = author.replace(/  +/, ' ');
	if(useComma) {
		// Add period for initials
		if(author.substr(author.length-2, 1) == " ") {
			author += ".";
		}
		var splitNames = author.split(', ');
		if(splitNames.length > 1) {
			var lastName = splitNames[0];
			var firstName = splitNames[1];
		} else {
			var lastName = author;
		}
	} else {
		var spaceIndex = author.lastIndexOf(" ");
		var lastName = author.substring(spaceIndex+1);
		var firstName = author.substring(0, spaceIndex);
	}
	// TODO: take type into account
	return {firstName:firstName, lastName:lastName, creatorType:type};
}

/*
 * Cleans whitespace off a string and replaces multiple spaces with one
 */
Scholar.Utilities.prototype.cleanString = function(s) {
	s = s.replace(/[ \xA0]+/g, " ");
	s = s.replace(/^\s+/, "");
	return s.replace(/\s+$/, "");
}

/*
 * Cleans any non-word non-parenthesis characters off the ends of a string
 */
Scholar.Utilities.prototype.superCleanString = function(x) {
	var x = x.replace(/^[^\w(]+/, "");
	return x.replace(/[^\w)]+$/, "");
}

/*
 * Eliminates HTML tags, replacing <br>s with /ns
 */
Scholar.Utilities.prototype.cleanTags = function(x) {
	x = x.replace(/<br[^>]*>/gi, "\n");
	return x.replace(/<[^>]+>/g, "");
}

/*
 * Test if a string is an integer
 */
Scholar.Utilities.prototype.isInt = function(x) {
	if(parseInt(x) == x) {
		return true;
	}
	return false;
}

/*
 * Get current scholar version
 */
Scholar.Utilities.prototype.getVersion = function() {
	return Scholar.version;
}

/*
 * Get a page range, given a user-entered set of pages
 */
Scholar.Utilities.prototype._pageRangeRegexp = /^\s*([0-9]+)-([0-9]+)\s*$/;
Scholar.Utilities.prototype.getPageRange = function(pages) {
	var pageNumbers;
	var m = this._pageRangeRegexp.exec(pages);
	if(m) {
		// A page range
		pageNumbers = [m[1], m[2]];
	} else {
		// Assume start and end are the same
		pageNumbers = [pages, pages];
	}
	return pageNumbers;
}

/*
 * provide inArray function
 */
Scholar.Utilities.prototype.inArray = Scholar.inArray;

/*
 * pads a number or other string with a given string on the left
 */
Scholar.Utilities.prototype.lpad = function(string, pad, length) {
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}

/*
 * returns true if an item type exists, false if it does not
 */
Scholar.Utilities.prototype.itemTypeExists = function(type) {
	if(Scholar.ItemTypes.getID(type)) {
		return true;
	} else {
		return false;
	}
}

/*
 * END SCHOLAR FOR FIREFOX EXTENSIONS
 */

/////////////////////////////////////////////////////////////////
//
// Scholar.Utilities.Ingester
//
/////////////////////////////////////////////////////////////////
// Scholar.Utilities.Ingester extends Scholar.Utilities, offering additional
// classes relating to data extraction specifically from HTML documents.

Scholar.Utilities.Ingester = function(translate, proxiedURL) {
	this.translate = translate;
}

Scholar.Utilities.Ingester.prototype = new Scholar.Utilities();

// Takes an XPath query and returns the results
Scholar.Utilities.Ingester.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
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

/*
 * Gets a given node as a string containing all child nodes
 */
Scholar.Utilities.Ingester.prototype.getNodeString = function(doc, contextNode, xpath, nsResolver) {
	var elmts = this.gatherElementsOnXPath(doc, contextNode, xpath, nsResolver);
	var returnVar = "";
	for(var i=0; i<elmts.length; i++) {
		returnVar += elmts[i].nodeValue;
	}
	return returnVar;
}

/*
 * Grabs items based on URLs
 */
Scholar.Utilities.Ingester.prototype.getItemArray = function(doc, inHere, urlRe, rejectRe) {
	var availableItems = new Object();	// Technically, associative arrays are objects
	
	// Require link to match this
	if(urlRe) {
		var urlRegexp = new RegExp();
		urlRegexp.compile(urlRe, "i");
	}
	// Do not allow text to match this
	if(rejectRe) {
		var rejectRegexp = new RegExp();
		rejectRegexp.compile(rejectRe, "i");
	}
	
	if(!inHere.length) {
		inHere = new Array(inHere);
	}
	
	for(var j=0; j<inHere.length; j++) {
		var links = inHere[j].getElementsByTagName("a");
		for(var i=0; i<links.length; i++) {
			if(!urlRe || urlRegexp.test(links[i].href)) {
				var text = this.getNodeString(doc, links[i], './/text()', null);
				if(text) {
					text = this.cleanString(text);
					if(!rejectRe || !rejectRegexp.test(text)) {
						if(availableItems[links[i].href]) {
							if(text != availableItems[links[i].href]) {
								availableItems[links[i].href] += " "+text;
							}
						} else {
							availableItems[links[i].href] = text;
						}
					}
				}
			}
		}
	}
	
	return availableItems;
}

Scholar.Utilities.Ingester.prototype.lookupContextObject = function(co, done, error) {
	return Scholar.OpenURL.lookupContextObject(co, done, error);
}

Scholar.Utilities.Ingester.prototype.parseContextObject = function(co, item) {
	return Scholar.OpenURL.parseContextObject(co, item);
}

// Ingester adapters for Scholar.Utilities.HTTP to handle proxies

Scholar.Utilities.Ingester.prototype.loadDocument = function(url, succeeded, failed) {
	this.processDocuments([ url ], succeeded, null, failed);
}
Scholar.Utilities.Ingester.prototype.processDocuments = function(urls, processor, done, exception) {
	if(this.translate.locationIsProxied) {
		for(i in urls) {
			urls[i] = Scholar.Ingester.ProxyMonitor.properToProxy(urls[i]);
		}
	}
	
	// unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	if(!exception) {
		var translate = this.translate;
		exception = function(e) {
			Scholar.debug("an error occurred in code called by processDocuments: "+e);
			translate._translationComplete(false);
		}
	}
	
	Scholar.Utilities.HTTP.processDocuments(null, urls, processor, done, exception);
}

Scholar.Utilities.Ingester.HTTP = function(translate) {
	this.translate = translate;
}

Scholar.Utilities.Ingester.HTTP.prototype.doGet = function(url, onDone) {
	if(this.translate.locationIsProxied) {
		url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
	}
	
	var translate = this.translate;
	Scholar.Utilities.HTTP.doGet(url, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
		} catch(e) {
			Scholar.debug("an error occurred in code called by doGet: "+e);
			translate._translationComplete(false);
		}
	})
}

Scholar.Utilities.Ingester.HTTP.prototype.doPost = function(url, body, onDone) {
	if(this.translate.locationIsProxied) {
		url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
	}
	
	var translate = this.translate;
	Scholar.Utilities.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
		} catch(e) {
			Scholar.debug("an error occurred in code called by doPost: "+e);
			translate._translationComplete(false);
		}
	})
}

// These are front ends for XMLHttpRequest. XMLHttpRequest can't actually be
// accessed outside the sandbox, and even if it could, it wouldn't let scripts
// access across domains, so everything's replicated here.
Scholar.Utilities.HTTP = new function() {
	this.doGet = doGet;
	this.doPost = doPost;
	this.doHead = doHead;
	this.doOptions = doOptions;
	this.browserIsOffline = browserIsOffline;
	
	
	/**
	* Send an HTTP GET request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	*
	* doGet can be called as:
	* Scholar.Utilities.HTTP.doGet(url, onDone)
	**/
	function doGet(url, onDone, onError) {
		Scholar.debug("HTTP GET "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		
		var test = xmlhttp.open('GET', url, true);
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	
	/**
	* Send an HTTP POST request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	*
	* doPost can be called as:
	* Scholar.Utilities.HTTP.doPost(url, body, onDone)
	**/
	function doPost(url, body, onDone) {
		Scholar.debug("HTTP POST "+body+" to "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		
		xmlhttp.open('POST', url, true);
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	
	function doHead(url, onDone) {
		Scholar.debug("HTTP HEAD "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		
		var test = xmlhttp.open('HEAD', url, true);
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, callback1, callback2);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	
	/**
	* Send an HTTP OPTIONS request via XMLHTTPRequest
	*
	* doOptions can be called as:
	* Scholar.Utilities.HTTP.doOptions(url, body, onDone)
	*
	* The status handler, which doesn't really serve a very noticeable purpose
	* in our code, is required for compatiblity with the Piggy Bank project
	**/
	function doOptions(url, body, onDone) {
		Scholar.debug("HTTP OPTIONS "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		
		xmlhttp.open('OPTIONS', url, true);
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	
	function browserIsOffline() { 
		return Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService).offline;
	}
	
	
	function _stateChange(xmlhttp, onDone){
		switch (xmlhttp.readyState){
			// Request not yet made
			case 1:
			break;
	
			// Called multiple while downloading in progress
			case 3:
			break;
	
			// Download complete
			case 4:
				if(onDone){
					onDone(xmlhttp);
				}
			break;
		}
	}
	
	
}

// Downloads and processes documents with processor()
// firstDoc - the first document to process with the processor (if null, 
//            first document is processed without processor)
// urls - an array of URLs to load
// processor - a function to execute to process each document
// done - a function to execute when all document processing is complete
// exception - a function to execute if an exception occurs (exceptions are
//             also logged in the Scholar for Firefox log)
// saveBrowser - whether to save the hidden browser object; usually, you don't
//               want to do this, because it makes it easier to leak memory
Scholar.Utilities.HTTP.processDocuments = function(firstDoc, urls, processor, done, exception, saveBrowser) {
	var hiddenBrowser = Scholar.Browser.createHiddenBrowser();
	var prevUrl, url;

	if (urls.length == 0) {
		if(firstDoc) {
			processor(firstDoc, done);
		} else {
			done();
		}
		return;
	}
	var urlIndex = -1;
	
	var removeListeners = function() {
		hiddenBrowser.removeEventListener("load", onLoad, true);
		if(!saveBrowser) {
			Scholar.Browser.deleteHiddenBrowser(hiddenBrowser);
		}
	}
	var doLoad = function() {
		urlIndex++;
		if (urlIndex < urls.length) {
			url = urls[urlIndex];
			try {
				Scholar.debug("loading "+url);
				hiddenBrowser.loadURI(url);
			} catch (e) {
				removeListeners();
				if(exception) {
					exception(e);
					return;
				} else {
					throw(e);
				}
			}
		} else {
			removeListeners();
			done();
		}
	};
	var onLoad = function() {
		Scholar.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
		if(hiddenBrowser.contentDocument.location.href != prevUrl) {	// Just in case it fires too many times
			prevUrl = hiddenBrowser.contentDocument.location.href;
			try {
				processor(hiddenBrowser.contentDocument);
			} catch (e) {
				removeListeners();
				if(exception) {
					exception(e);
					return;
				} else {
					throw(e);
				}
			}
			doLoad();
		}
	};
	var init = function() {
		hiddenBrowser.addEventListener("load", onLoad, true);
		
		if (firstDoc) {
			processor(firstDoc, doLoad);
		} else {
			doLoad();
		}
	}
	
	init();
}