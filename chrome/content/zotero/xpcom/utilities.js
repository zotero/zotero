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
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
	
    ***** END LICENSE BLOCK *****
*/

/////////////////////////////////////////////////////////////////
//
// Zotero.Utilities
//
/////////////////////////////////////////////////////////////////

Zotero.Utilities = function () {}

/*
 * See Zotero.Date
 */
Zotero.Utilities.prototype.formatDate = function(date) {
	return Zotero.Date.formatDate(date);
}
Zotero.Utilities.prototype.strToDate = function(date) {
	return Zotero.Date.strToDate(date);
}
Zotero.Utilities.prototype.strToISO = function(date) {
	return Zotero.Date.strToISO(date);
}

/*
 * Cleans extraneous punctuation off an author name
 */
Zotero.Utilities._allCapsRe = /^[A-Z]+$/;
Zotero.Utilities.prototype.cleanAuthor = function(author, type, useComma) {
	if(typeof(author) != "string") {
		throw "cleanAuthor: author must be a string";
	}
	
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\,\/\[\]\:\.]+$/, '');
	author = author.replace(/  +/, ' ');
	if(useComma) {
		// Add spaces between periods
		author = author.replace(/\.([^ ])/, ". $1");
		
		var splitNames = author.split(/, ?/);
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
	
	if(firstName && Zotero.Utilities._allCapsRe.test(firstName) &&
			firstName.length < 4 &&
			(firstName.length == 1 || lastName.toUpperCase() != lastName)) {
		// first name is probably initials
		var newFirstName = "";
		for(var i=0; i<firstName.length; i++) {
			newFirstName += " "+firstName[i]+".";
		}
		firstName = newFirstName.substr(1);
	}
	
	return {firstName:firstName, lastName:lastName, creatorType:type};
}


/*
 * Removes leading and trailing whitespace from a string
 */
Zotero.Utilities.prototype.trim = function(s) {
	if (typeof(s) != "string") {
		throw "trim: argument must be a string";
	}
	
	s = s.replace(/^\s+/, "");
	return s.replace(/\s+$/, "");
}


/*
 * Cleans whitespace off a string and replaces multiple spaces with one
 */
Zotero.Utilities.prototype.trimInternal = function(s) {
	if (typeof(s) != "string") {
		throw "trimInternal: argument must be a string";
	}
	
	s = s.replace(/[\xA0\r\n\s]+/g, " ");
	return this.trim(s);
}



/*
 * Cleans whitespace off a string and replaces multiple spaces with one
 *
 * DEPRECATED: use trimInternal()
 */
Zotero.Utilities.prototype.cleanString = function(s) {
	Zotero.debug("cleanString() is deprecated; use trimInternal() instead", 2);
	return this.trimInternal(s);
}

/*
 * Cleans any non-word non-parenthesis characters off the ends of a string
 */
Zotero.Utilities.prototype.superCleanString = function(x) {
	if(typeof(x) != "string") {
		throw "superCleanString: argument must be a string";
	}
	
	var x = x.replace(/^[\x00-\x27\x29-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/, "");
	return x.replace(/[\x00-\x28\x2A-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+$/, "");
}

/*
 * Eliminates HTML tags, replacing <br>s with /ns
 */
Zotero.Utilities.prototype.cleanTags = function(x) {
	if(typeof(x) != "string") {
		throw "cleanTags: argument must be a string";
	}
	
	x = x.replace(/<br[^>]*>/gi, "\n");
	return x.replace(/<[^>]+>/g, "");
}

/*
 * Encode special XML/HTML characters
 *
 * Certain entities can be inserted manually:
 *
 *  <ZOTEROBREAK/> => <br/>
 *  <ZOTEROHELLIP/> => &#8230;
 */
Zotero.Utilities.prototype.htmlSpecialChars = function(str) {
	if (typeof str != 'string') {
		throw "Argument '" + str + "' must be a string in Zotero.Utilities.htmlSpecialChars()";
	}
	
	if (!str) {
		return '';
	}
	
	var chars = ['&', '"',"'",'<','>'];
	var entities = ['amp', 'quot', 'apos', 'lt', 'gt'];
	
	var newString = str;
	for (var i = 0; i < chars.length; i++) {
		var re = new RegExp(chars[i], 'g');
		newString = newString.replace(re, '&' + entities[i] + ';');
	}
	
	newString = newString.replace(/&lt;ZOTERO([^\/]+)\/&gt;/g, function (str, p1, offset, s) {
		switch (p1) {
			case 'BREAK':
				return '<br/>';
			case 'HELLIP':
				return '&#8230;';
			default:
				return p1;
		}
	});
	
	return newString;
}


Zotero.Utilities.prototype.unescapeHTML = function(str) {
	var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
		.getService(Components.interfaces.nsIScriptableUnescapeHTML);
	return nsISUHTML.unescape(str);
}


/*
 * Parses a text string for HTML/XUL markup and returns an array of parts
 *
 * Currently only finds HTML links (<a> tags)
 *
 * Returns an array of objects with the following form:
 *     {
 *         type: 'text'|'link',
 *         text: "text content",
 *         [ attributes: { key1: val [ , key2: val, ...] }
 *     }
 */
Zotero.Utilities.prototype.parseMarkup = function(str) {
	var parts = [];
	var splits = str.split(/(<a [^>]+>[^<]*<\/a>)/);
	
	for each(var split in splits) {
		// Link
		if (split.indexOf('<a ') == 0) {
			var matches = split.match(/<a ([^>]+)>([^<]*)<\/a>/);
			if (matches) {
				// Attribute pairs
				var attributes = {};
				var pairs = matches[1].match(/([^ =]+)="([^"]+")/g);
				for each (var pair in pairs) {
					var [key, val] = pair.split(/=/);
					attributes[key] = val.substr(1, val.length - 2);
				}
				
				parts.push({
					type: 'link',
					text: matches[2],
					attributes: attributes
				});
				continue;
			}
		}
		
		parts.push({
			type: 'text',
			text: split
		});
	}
	
	return parts;
}


/*
 * Test if a string is an integer
 */
Zotero.Utilities.prototype.isInt = function(x) {
	if(parseInt(x) == x) {
		return true;
	}
	return false;
}

/*
 * Get current zotero version
 */
Zotero.Utilities.prototype.getVersion = function() {
	return Zotero.version;
}

/*
 * Get a page range, given a user-entered set of pages
 */
Zotero.Utilities.prototype._pageRangeRegexp = /^\s*([0-9]+)-([0-9]+)\s*$/;
Zotero.Utilities.prototype.getPageRange = function(pages) {
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
Zotero.Utilities.prototype.inArray = Zotero.inArray;

/*
 * pads a number or other string with a given string on the left
 */
Zotero.Utilities.prototype.lpad = function(string, pad, length) {
	string = string ? string + '' : '';
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}

/*
 * returns true if an item type exists, false if it does not
 */
Zotero.Utilities.prototype.itemTypeExists = function(type) {
	if(Zotero.ItemTypes.getID(type)) {
		return true;
	} else {
		return false;
	}
}

/*
 * returns an array of all (string) creatorTypes valid for a (string) itemType
 */
Zotero.Utilities.prototype.getCreatorsForType = function(type) {
	var types = Zotero.CreatorTypes.getTypesForItemType(Zotero.ItemTypes.getID(type));
	var cleanTypes = new Array();
	for each(var type in types) {
		cleanTypes.push(type.name);
	}
	return cleanTypes;
}

/*
 * returns a localized creatorType name
 */
Zotero.Utilities.prototype.getLocalizedCreatorType = function(type) {
	try {
		return Zotero.getString("creatorTypes."+type);
	} catch(e) {
		return false;
	}
}

/*
 * Cleans a title, capitalizing the proper words and replacing " :" with ":"
 *
 * Follows capitalizeTitles pref, unless |force| is true
 */
Zotero.Utilities.prototype.capitalizeTitle = function(string, force) {
	string = this.trimInternal(string);
	if(Zotero.Prefs.get('capitalizeTitles') || force) {
		// fix colons
		string = string.replace(" : ", ": ", "g");
		string = Zotero.Text.titleCase(string.replace(/ : /g, ": "));
	}
	return string;
}

/*
 * END ZOTERO FOR FIREFOX EXTENSIONS
 */

/////////////////////////////////////////////////////////////////
//
// Zotero.Utilities.Ingester
//
/////////////////////////////////////////////////////////////////
// Zotero.Utilities.Ingester extends Zotero.Utilities, offering additional
// classes relating to data extraction specifically from HTML documents.

Zotero.Utilities.Ingester = function(translate, proxiedURL) {
	this.translate = translate;
}

Zotero.Utilities.Ingester.prototype = new Zotero.Utilities();

// Takes an XPath query and returns the results
Zotero.Utilities.Ingester.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
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
 *
 * WARNING: This is DEPRECATED and may be removed in the final release. Use
 * doc.evaluate and the "nodeValue" or "textContent" property
 */
Zotero.Utilities.Ingester.prototype.getNodeString = function(doc, contextNode, xpath, nsResolver) {
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
Zotero.Utilities.Ingester.prototype.getItemArray = function(doc, inHere, urlRe, rejectRe) {
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

Zotero.Utilities.Ingester.prototype.lookupContextObject = function(co, done, error) {
	return Zotero.OpenURL.lookupContextObject(co, done, error);
}

Zotero.Utilities.Ingester.prototype.parseContextObject = function(co, item) {
	return Zotero.OpenURL.parseContextObject(co, item);
}


// Ingester adapters for Zotero.Utilities.HTTP to handle proxies

Zotero.Utilities.Ingester.prototype.loadDocument = function(url, succeeded, failed) {
	this.processDocuments([ url ], succeeded, null, failed);
}

Zotero.Utilities.Ingester._protocolRe = new RegExp();
Zotero.Utilities.Ingester._protocolRe.compile("^(?:(?:http|https|ftp):|[^:](?:/.*)?$)", "i");
Zotero.Utilities.Ingester.prototype.processDocuments = function(urls, processor, done, exception) {
	if(this.translate.locationIsProxied) {
		for(var i in urls) {
			if(this.translate.locationIsProxied) {
				urls[i] = Zotero.Ingester.ProxyMonitor.properToProxy(urls[i]);
			}
			// check for a protocol colon
			if(!Zotero.Utilities.Ingester._protocolRe.test(urls[i])) {
				throw("invalid URL in processDocuments");
			}
		}
	}
	
	// unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	if(!exception) {
		var translate = this.translate;
		exception = function(e) {
			translate.error(false, e);
		}
	}
	
	Zotero.Utilities.HTTP.processDocuments(null, urls, processor, done, exception);
}

Zotero.Utilities.Ingester.HTTP = function(translate) {
	this.translate = translate;
}

Zotero.Utilities.Ingester.HTTP.prototype.doGet = function(urls, processor, done, responseCharset) {
	var callAgain = false;
	
	if(typeof(urls) == "string") {
		var url = urls;
	} else {
		if(urls.length > 1) callAgain = true;
		var url = urls.shift();
	}
	
	if(this.translate.locationIsProxied) {
		url = Zotero.Ingester.ProxyMonitor.properToProxy(url);
	}
	if(!Zotero.Utilities.Ingester._protocolRe.test(url)) {
		throw("invalid URL in processDocuments");
	}
	
	var me = this;
	
	Zotero.Utilities.HTTP.doGet(url, function(xmlhttp) {
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
		} catch(e) {
			me.translate.error(false, e);
		}
	}, responseCharset);
}

Zotero.Utilities.Ingester.HTTP.prototype.doPost = function(url, body, onDone, requestContentType, responseCharset) {
	if(this.translate.locationIsProxied) {
		url = Zotero.Ingester.ProxyMonitor.properToProxy(url);
	}
	if(!Zotero.Utilities.Ingester._protocolRe.test(url)) {
		throw("invalid URL in processDocuments");
	}
	
	var translate = this.translate;
	Zotero.Utilities.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
		} catch(e) {
			translate.error(false, e);
		}
	}, requestContentType, responseCharset);
}

// These are front ends for XMLHttpRequest. XMLHttpRequest can't actually be
// accessed outside the sandbox, and even if it could, it wouldn't let scripts
// access across domains, so everything's replicated here.
Zotero.Utilities.HTTP = new function() {
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
	* Zotero.Utilities.HTTP.doGet(url, onDone)
	**/
	function doGet(url, onDone, onError, responseCharset) {
		Zotero.debug("HTTP GET "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		/*
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		var test = xmlhttp.open('GET', url, true);
		*/
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		const Cc = Components.classes;
		const Ci = Components.interfaces;
		var ds = Cc["@mozilla.org/webshell;1"].
					createInstance(Components.interfaces.nsIDocShellTreeItem).
					QueryInterface(Ci.nsIInterfaceRequestor);
		ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
		var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
						createInstance(Ci.nsIXMLHttpRequest);
		xmlhttp.open("GET", url, true);
		xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
		xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone, responseCharset);
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
	* Zotero.Utilities.HTTP.doPost(url, body, onDone)
	**/
	function doPost(url, body, onDone, requestContentType, responseCharset) {
		Zotero.debug("HTTP POST "+body+" to "+url);
		
		if (this.browserIsOffline()){
			return false;
		}
		
		/*
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		xmlhttp.open('POST', url, true);
		*/
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		const Cc = Components.classes;
		const Ci = Components.interfaces;
		var ds = Cc["@mozilla.org/webshell;1"].
					createInstance(Components.interfaces.nsIDocShellTreeItem).
					QueryInterface(Ci.nsIInterfaceRequestor);
		ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
		var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
						createInstance(Ci.nsIXMLHttpRequest);
		xmlhttp.open("POST", url, true);
		xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
		xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		
		xmlhttp.setRequestHeader("Content-Type", (requestContentType ? requestContentType : "application/x-www-form-urlencoded" ));
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone, responseCharset);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	
	function doHead(url, onDone) {
		Zotero.debug("HTTP HEAD "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		/*
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		var test = xmlhttp.open('HEAD', url, true);
		*/
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		const Cc = Components.classes;
		const Ci = Components.interfaces;
		var ds = Cc["@mozilla.org/webshell;1"].
					createInstance(Components.interfaces.nsIDocShellTreeItem).
					QueryInterface(Ci.nsIInterfaceRequestor);
		ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
		var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
						createInstance(Ci.nsIXMLHttpRequest);
		xmlhttp.open("HEAD", url, true);
		xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
		xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	
	/**
	* Send an HTTP OPTIONS request via XMLHTTPRequest
	*
	* doOptions can be called as:
	* Zotero.Utilities.HTTP.doOptions(url, body, onDone)
	*
	* The status handler, which doesn't really serve a very noticeable purpose
	* in our code, is required for compatiblity with the Piggy Bank project
	**/
	function doOptions(url, body, onDone) {
		Zotero.debug("HTTP OPTIONS "+url);
		if (this.browserIsOffline()){
			return false;
		}
		
		/*
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		xmlhttp.open('OPTIONS', url, true);
		*/
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		const Cc = Components.classes;
		const Ci = Components.interfaces;
		var ds = Cc["@mozilla.org/webshell;1"].
					createInstance(Components.interfaces.nsIDocShellTreeItem).
					QueryInterface(Ci.nsIInterfaceRequestor);
		ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
		var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
						createInstance(Ci.nsIXMLHttpRequest);
		xmlhttp.open("OPTIONS", url, true);
		xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
		xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		
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
	
	
	function _stateChange(xmlhttp, onDone, responseCharset){
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
					// Override the content charset
					if (responseCharset) {
						xmlhttp.channel.contentCharset = responseCharset;
					}
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
//             also logged in the Zotero for Firefox log)
// saveBrowser - whether to save the hidden browser object; usually, you don't
//               want to do this, because it makes it easier to leak memory
Zotero.Utilities.HTTP.processDocuments = function(firstDoc, urls, processor, done, exception, saveBrowser) {
	var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
	hiddenBrowser.docShell.allowImages = false;
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
		var loadEvent = Zotero.isFx2 ? "load" : "pageshow";
		hiddenBrowser.removeEventListener(loadEvent, onLoad, true);
		if(!saveBrowser) {
			Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
		}
	}
	var doLoad = function() {
		urlIndex++;
		if (urlIndex < urls.length) {
			url = urls[urlIndex];
			try {
				Zotero.debug("loading "+url);
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
			if(done) {
				done();
			}
		}
	};
	var onLoad = function() {
		Zotero.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
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
		var loadEvent = Zotero.isFx2 ? "load" : "pageshow";
		hiddenBrowser.addEventListener(loadEvent, onLoad, true);
		
		if (firstDoc) {
			processor(firstDoc, doLoad);
		} else {
			doLoad();
		}
	}
	
	init();
}


/*
 * This would probably be better as a separate XPCOM service
 */
Zotero.Utilities.AutoComplete = new function(){
	this.getResultComment = getResultComment;
	
	function getResultComment(textbox){
		var controller = textbox.controller;
		
		for (var i=0; i<controller.matchCount; i++)
		{
			if (controller.getValueAt(i) == textbox.value)
			{
				return controller.getCommentAt(i);
			}
		}
		return false;
	}
}