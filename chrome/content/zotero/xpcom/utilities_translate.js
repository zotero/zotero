/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

/**
 * @class All functions accessible from within Zotero.Utilities namespace inside sandboxed
 * translators
 *
 * @constructor
 * @augments Zotero.Utilities
 * @borrows Zotero.Date.formatDate as this.formatDate
 * @borrows Zotero.Date.strToDate as this.strToDate
 * @borrows Zotero.Date.strToISO as this.strToISO
 * @borrows Zotero.OpenURL.createContextObject as this.createContextObject
 * @borrows Zotero.OpenURL.parseContextObject as this.parseContextObject
 * @borrows Zotero.Multi.parseSerializedMultiField as this.parseSerializedMultiField
 * @borrows Zotero.Utilities.Translate.prototype.ZlsValidator as Zotero.ZlsValidator
 * @borrows Zotero.HTTP.processDocuments as this.processDocuments
 * @borrows Zotero.HTTP.doPost as this.doPost
 * @param {Zotero.Translate} translate
 */
Zotero.Utilities.Translate = function(translate) {
	this._translate = translate;
}

var tmp = function() {};
tmp.prototype = Zotero.Utilities;
Zotero.Utilities.Translate.prototype = new tmp();

Zotero.Utilities.Translate.prototype.formatDate = Zotero.Date.formatDate;
Zotero.Utilities.Translate.prototype.strToDate = Zotero.Date.strToDate;
Zotero.Utilities.Translate.prototype.strToISO = Zotero.Date.strToISO;
Zotero.Utilities.parseDateToObject = Zotero.DateParser.parseDateToObject;
Zotero.Utilities.convertDateObjectToString = Zotero.DateParser.convertDateObjectToString;
Zotero.Utilities.parseDateToString = Zotero.DateParser.parseDateToString;
Zotero.Utilities.resetDateParserMonths = Zotero.DateParser.resetDateParserMonths;
Zotero.Utilities.addDateParserMonths = Zotero.DateParser.addDateParserMonths;
Zotero.Utilities.Translate.prototype.createContextObject = Zotero.OpenURL.createContextObject;
Zotero.Utilities.Translate.prototype.parseContextObject = Zotero.OpenURL.parseContextObject;
Zotero.Utilities.Translate.prototype.ZlsValidator = Zotero.ZlsValidator;

/**
 * Hack to overloads {@link Zotero.Utilities.capitalizeTitle} to allow overriding capitalizeTitles 
 * pref on a per-translate instance basis (for translator testing only)
 */
Zotero.Utilities.Translate.prototype.capitalizeTitle = function(string, force) {
	if(force === undefined) {
		var translate = this._translate;
		do {
			if(translate.capitalizeTitles !== undefined) {
				force = translate.capitalizeTitles;
				break;
			}
		} while(translate = translate._parentTranslator);
	}
	
	return Zotero.Utilities.capitalizeTitle(string, force);
}

/**
 * Gets the current Zotero version
 *
 * @type String
 */
Zotero.Utilities.Translate.prototype.getVersion = function() {
	return Zotero.version;
}

/**
 * Takes an XPath query and returns the results
 *
 * @deprecated Use {@link Zotero.Utilities.xpath} or doc.evaluate() directly
 * @type Node[]
 */
Zotero.Utilities.Translate.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
	var elmts = [];
	
	var iterator = doc.evaluate(xpath, parentNode, nsResolver,
		(Zotero.isFx ? Components.interfaces.nsIDOMXPathResult.ANY_TYPE : XPathResult.ANY_TYPE),
		null);
	var elmt = iterator.iterateNext();
	var i = 0;
	while (elmt) {
		elmts[i++] = elmt;
		elmt = iterator.iterateNext();
	}
	return elmts;
}

/**
 * Gets a given node as a string containing all child nodes
 *
 * @deprecated Use doc.evaluate and the "nodeValue" or "textContent" property
 * @type String
 */
Zotero.Utilities.Translate.prototype.getNodeString = function(doc, contextNode, xpath, nsResolver) {
	var elmts = this.gatherElementsOnXPath(doc, contextNode, xpath, nsResolver);
	var returnVar = "";
	for(var i=0; i<elmts.length; i++) {
		returnVar += elmts[i].nodeValue;
	}
	return returnVar;
}

/**
 * Grabs items based on URLs
 *
 * @param {Document} doc DOM document object
 * @param {Element|Element[]} inHere DOM element(s) to process
 * @param {RegExp} [urlRe] Regexp of URLs to add to list
 * @param {RegExp} [urlRe] Regexp of URLs to reject
 * @return {Object} Associative array of link => textContent pairs, suitable for passing to
 *	Zotero.selectItems from within a translator
 */
Zotero.Utilities.Translate.prototype.getItemArray = function(doc, inHere, urlRe, rejectRe) {
	var availableItems = new Object();	// Technically, associative arrays are objects
	
	// Require link to match this
	if(urlRe) {
		if(urlRe.exec) {
			var urlRegexp = urlRe;
		} else {
			var urlRegexp = new RegExp();
			urlRegexp.compile(urlRe, "i");
		}
	}
	// Do not allow text to match this
	if(rejectRe) {
		if(rejectRe.exec) {
			var rejectRegexp = rejectRe;
		} else {
			var rejectRegexp = new RegExp();
			rejectRegexp.compile(rejectRe, "i");
		}
	}
	
	if(!inHere.length) {
		inHere = new Array(inHere);
	}
	
	for(var j=0; j<inHere.length; j++) {
		var links = inHere[j].getElementsByTagName("a");
		for(var i=0; i<links.length; i++) {
			if(!urlRe || urlRegexp.test(links[i].href)) {
				var text = links[i].textContent;
				if(text) {
					text = this.trimInternal(text);
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


/**
 * Load a single document in a hidden browser
 *
 * @deprecated Use processDocuments with a single URL
 * @see Zotero.Utilities.Translate#processDocuments
 */
Zotero.Utilities.Translate.prototype.loadDocument = function(url, succeeded, failed) {
	Zotero.debug("Zotero.Utilities.loadDocument is deprecated; please use processDocuments in new code");
	this.processDocuments([url], succeeded, null, failed);
}

/**
 * Already documented in Zotero.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.processDocuments = function(urls, processor, done, exception) {
	if(typeof(urls) == "string") {
		urls = [this._convertURL(urls)];
	} else {
		for(var i in urls) {
			urls[i] = this._convertURL(urls[i]);
		}
	}
	
	// Unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	var translate = this._translate;
	if(exception) {
		var myException = function(e) {
			try {
				exception(e);
			} catch(e) {
				try {
					Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
				} catch(e) {}
				translate.complete(false, e);
			}
		}
	} else {
		var myException = function(e) {
			try {
				Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
			} catch(e) {}
			translate.complete(false, e);
		}
	}
	
	if(Zotero.isFx) {
		var translate = this._translate;
		if(translate.document) {
			var protocol = translate.document.location.protocol,
				host = translate.document.location.host;
		} else {
			var url = Components.classes["@mozilla.org/network/io-service;1"] 
					.getService(Components.interfaces.nsIIOService)
					.newURI(typeof translate._sandboxLocation === "object" ?
						translate._sandboxLocation.location : translate._sandboxLocation, null, null),
				protocol = url.scheme+":",
				host = url.host;
		}
	}
	
	for(var i=0; i<urls.length; i++) {
		if(this._translate.document && this._translate.document.location
				&& this._translate.document.location.toString() === urls[i]) {
			// Document is attempting to reload itself
			Zotero.debug("Translate: Attempted to load the current document using processDocuments; using loaded document instead");
			processor(this._translate.document, urls[i]);
			urls.splice(i, 1);
			i--;
		}
	}
	
	translate.incrementAsyncProcesses("Zotero.Utilities.Translate#processDocuments");
	var hiddenBrowser = Zotero.HTTP.processDocuments(urls, function(doc) {
		if(!processor) return;
		
		var newLoc = doc.location;
		if(Zotero.isFx && (protocol != newLoc.protocol || host != newLoc.host)) {
			// Cross-site; need to wrap
			processor(Zotero.Translate.SandboxManager.Fx5DOMWrapper(doc), newLoc.toString());
		} else {
			// Not cross-site; no need to wrap
			processor(doc, newLoc.toString());
		}
	},
	function() {
		if(done) done();
		var handler = function() {
			try {
				Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
				translate.removeHandler("done", handler);
			} catch(e) {}
		};
		translate.setHandler("done", handler);
		translate.decrementAsyncProcesses("Zotero.Utilities.Translate#processDocuments");
	}, myException, true, translate.cookieSandbox);
}

/**
 * Gets the DOM document object corresponding to the page located at URL, but avoids locking the
 * UI while the request is in process.
 *
 * @deprecated
 * @param {String} 		url		URL to load
 * @return {Document} 			DOM document object
 */
Zotero.Utilities.Translate.prototype.retrieveDocument = function(url) {
	if(!Zotero.isFx) throw "Zotero.Utilities.retrieveDocument() is unsupported outside of Firefox";
	this._translate._debug("WARNING: Zotero.Utilities.retrieveDocument() is unsupported outside of Firefox", 1);
	
	url = this._convertURL(url);
	
	var mainThread = Zotero.mainThread;
	var loaded = false;
	var listener =  function() {
		loaded = hiddenBrowser.contentDocument.location.href != "about:blank";
	}
	
	var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
	if(this._translate.cookieSandbox) this._translate.cookieSandbox.attachToBrowser(hiddenBrowser);
	
	hiddenBrowser.addEventListener("pageshow", listener, true);
	hiddenBrowser.loadURI(url);
	
	// Use a timeout of 2 minutes. Without a timeout, a request to an IP at which no system is
	// configured will continue indefinitely, and hang Firefox as it shuts down. No same request
	// should ever take longer than 2 minutes. 
	var endTime = Date.now() + 120000;
	while(!loaded && Date.now() < endTime) {
		// This processNextEvent call is used to handle a deprecated case
		mainThread.processNextEvent(true);
	}
	
	hiddenBrowser.removeEventListener("pageshow", listener, true);
	hiddenBrowser.contentWindow.setTimeout(function() {
		Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
	}, 1);
	
	if(!loaded) throw "retrieveDocument failed: request timeout";
	return hiddenBrowser.contentDocument;
}

/**
 * Gets the source of the page located at URL, but avoids locking the UI while the request is in
 * process.
 *
 * @deprecated
 * @param {String} 		url					URL to load
 * @param {String}		[body=null]			Request body to POST to the URL; a GET request is
 *											executed if no body is present
 * @param {Object}		[headers]			HTTP headers to include in request;
 *											Content-Type defaults to application/x-www-form-urlencoded
 *											for POST; ignored if no body
 * @param {String} 		[responseCharset] 	Character set to force on the response
 * @return {String} 						Request body
 */
Zotero.Utilities.Translate.prototype.retrieveSource = function(url, body, headers, responseCharset) {
	this._translate._debug("WARNING: Use of Zotero.Utilities.retrieveSource() is deprecated. "+
		"The main thread will be frozen when Zotero.Utilities.retrieveSource() is called outside "+
		"of Firefox, and cross-domain requests will not work.", 1);
	
	if(Zotero.isFx) {
		/* Apparently, a synchronous XMLHttpRequest would have the behavior of this routine in FF3, but
		 * in FF3.5, synchronous XHR blocks all JavaScript on the thread. See 
		 * http://hacks.mozilla.org/2009/07/synchronous-xhr/. */
		url = this._convertURL(url);
		if(!headers) headers = null;
		if(!responseCharset) responseCharset = null;
		
		var mainThread = Zotero.mainThread;
		var finished = false;
		var listener = function() { finished = true };
		
		if(body) {
			var xmlhttp = Zotero.HTTP.doPost(url, body, listener, headers, responseCharset, this._translate.cookieSandbox);
		} else {
			var xmlhttp = Zotero.HTTP.doGet(url, listener, responseCharset, this._translate.cookieSandbox);
		}
		
		// This processNextEvent call is used to handle a deprecated case
		while(!finished) mainThread.processNextEvent(true);
	} else {
		// Use a synchronous XMLHttpRequest, even though this is inadvisable
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open((body ? "POST" : "GET"), url, false);
		xmlhttp.send(body ? body : null);
	}
	
	if(xmlhttp.status >= 400) throw "Zotero.Utilities.retrieveSource() failed: "+xmlhttp.status+" "+xmlhttp.statusText;
	
	return xmlhttp.responseText;
}

/**
* Send an HTTP GET request via XMLHTTPRequest
* 
* @param {String|String[]} urls URL(s) to request
* @param {Function} processor Callback to be executed for each document loaded
* @param {Function} done Callback to be executed after all documents have been loaded
* @param {String} responseCharset Character set to force on the response
* @return {Boolean} True if the request was sent, or false if the browser is offline
*/
Zotero.Utilities.Translate.prototype.doGet = function(urls, processor, done, responseCharset) {
	var callAgain = false;
	
	if(typeof(urls) == "string") {
		var url = urls;
	} else {
		if(urls.length > 1) callAgain = true;
		var url = urls.shift();
	}
	
	url = this._convertURL(url);
	
	var me = this;
	
	this._translate.incrementAsyncProcesses("Zotero.Utilities.Translate#doGet");
	var xmlhttp = Zotero.HTTP.doGet(url, function(xmlhttp) {
		try {
			if(processor) {
				processor(xmlhttp.responseText, xmlhttp, url);
			}
			
			if(callAgain) {
				me.doGet(urls, processor, done);
			} else {
				if(done) {
					done();
				}
			}
			me._translate.decrementAsyncProcesses("Zotero.Utilities.Translate#doGet");
		} catch(e) {
			me._translate.complete(false, e);
		}
	}, responseCharset, this._translate.cookieSandbox);
}

/**
 * Already documented in Zotero.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.doPost = function(url, body, onDone, headers, responseCharset) {
	url = this._convertURL(url);
	
	var translate = this._translate;
	this._translate.incrementAsyncProcesses("Zotero.Utilities.Translate#doPost");
	var xmlhttp = Zotero.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
			translate.decrementAsyncProcesses("Zotero.Utilities.Translate#doPost");
		} catch(e) {
			translate.complete(false, e);
		}
	}, headers, responseCharset, translate.cookieSandbox ? translate.cookieSandbox : undefined);
}

/**
 * Translate a URL to a form that goes through the appropriate proxy, or convert a relative URL to
 * an absolute one
 *
 * @param {String} url
 * @type String
 * @private
 */
Zotero.Utilities.Translate.prototype._convertURL = function(url) {
	const hostPortRe = /^((?:http|https|ftp):)\/\/([^\/]+)/i;
	// resolve local URL
	var resolved = "";
	
	// convert proxy to proper if applicable
	if(hostPortRe.test(url)) {
		if(this._translate.translator && this._translate.translator[0]
				&& this._translate.translator[0].properToProxy) {
			resolved = this._translate.translator[0].properToProxy(url);
		} else {
			resolved = url;
		}
	} else if(Zotero.isFx) {
		resolved = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(this._translate.location, "", null).resolve(url);
	} else if(Zotero.isNode) {
		resolved = require('url').resolve(this._translate.location, url);
	} else {
		var a = document.createElement('a');
        a.href = url;
        resolved = a.href;
	}
	
	/*var m = hostPortRe.exec(resolved);
	if(!m) {
		throw new Error("Invalid URL supplied for HTTP request: "+url);
	} else if(this._translate.document && this._translate.document.location) {
		var loc = this._translate.document.location;
		if(this._translate._currentState !== "translate" && loc
				&& (m[1].toLowerCase() !== loc.protocol.toLowerCase()
				|| m[2].toLowerCase() !== loc.host.toLowerCase())) {
			throw new Error("Attempt to access "+m[1]+"//"+m[2]+" from "+loc.protocol+"//"+loc.host
				+" blocked: Cross-site requests are only allowed during translation");
		}
	}*/
	
	return resolved;
}

//	"parseSerializedMultiField":Zotero.Multi.parseSerializedMultiField,
//	"ZlsValidator":Zotero.ZlsValidator
Zotero.Utilities.Translate.prototype.__exposedProps__ = {"HTTP":"r"};
for(var j in Zotero.Utilities.Translate.prototype) {
	if(typeof Zotero.Utilities.Translate.prototype[j] === "function" && j[0] !== "_" && j != "Translate") {
		Zotero.Utilities.Translate.prototype.__exposedProps__[j] = "r";
	}
}