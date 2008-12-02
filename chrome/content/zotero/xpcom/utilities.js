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

/**
 * @class Functions for text manipulation and other miscellaneous purposes
 */
Zotero.Utilities = function () {}

/**
 * Cleans extraneous punctuation off a creator name and parse into first and last name
 *
 * @param {String} author Creator string
 * @param {String} type Creator type string (e.g., "author" or "editor")
 * @param {Boolean} useComma Whether the creator string is in inverted (Last, First) format
 * @return {Object} firstName, lastName, and creatorType
 */
Zotero.Utilities.prototype.cleanAuthor = function(author, type, useComma) {
	const allCapsRe = /^[A-Z]+$/;
	
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
	
	if(firstName && allCapsRe.test(firstName) &&
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

/**
 * Removes leading and trailing whitespace from a string
 * @type String
 */
Zotero.Utilities.prototype.trim = function(/**String*/ s) {
	if (typeof(s) != "string") {
		throw "trim: argument must be a string";
	}
	
	s = s.replace(/^\s+/, "");
	return s.replace(/\s+$/, "");
}

/**
 * Cleans whitespace off a string and replaces multiple spaces with one
 * @type String
 */
Zotero.Utilities.prototype.trimInternal = function(/**String*/ s) {
	if (typeof(s) != "string") {
		throw "trimInternal: argument must be a string";
	}
	
	s = s.replace(/[\xA0\r\n\s]+/g, " ");
	return this.trim(s);
}

/**
 * Cleans whitespace off a string and replaces multiple spaces with one
 *
 * @deprecated Use trimInternal
 * @see Zotero.Utilities#trimInternal
 * @type String
 */
Zotero.Utilities.prototype.cleanString = function(/**String*/ s) {
	Zotero.debug("cleanString() is deprecated; use trimInternal() instead", 2);
	return this.trimInternal(s);
}

/**
 * Cleans any non-word non-parenthesis characters off the ends of a string
 * @type String
 */
Zotero.Utilities.prototype.superCleanString = function(/**String*/ x) {
	if(typeof(x) != "string") {
		throw "superCleanString: argument must be a string";
	}
	
	var x = x.replace(/^[\x00-\x27\x29-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/, "");
	return x.replace(/[\x00-\x28\x2A-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+$/, "");
}

/**
 * Eliminates HTML tags, replacing &lt;br&gt;s with newlines
 * @type String
 */
Zotero.Utilities.prototype.cleanTags = function(/**String*/ x) {
	if(typeof(x) != "string") {
		throw "cleanTags: argument must be a string";
	}
	
	x = x.replace(/<br[^>]*>/gi, "\n");
	return x.replace(/<[^>]+>/g, "");
}

/**
 * Encode special XML/HTML characters<br/>
 * <br/>
 * Certain entities can be inserted manually:<br/>
 * <pre> &lt;ZOTEROBREAK/&gt; =&gt; &lt;br/&gt;
 * &lt;ZOTEROHELLIP/&gt; =&gt; &amp;#8230;</pre>
 * @type String
 */
Zotero.Utilities.prototype.htmlSpecialChars = function(/**String*/ str) {
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

/**
 * Decodes HTML entities within a string, returning plain text
 * @type String
 */
Zotero.Utilities.prototype.unescapeHTML = function(/**String*/ str) {
	var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
		.getService(Components.interfaces.nsIScriptableUnescapeHTML);
	return nsISUHTML.unescape(str);
}

/**
 * Parses a text string for HTML/XUL markup and returns an array of parts. Currently only finds
 * HTML links (&lt;a&gt; tags)
 *
 * @return {Array} An array of objects with the following form:<br>
 * <pre>   {
 *         type: 'text'|'link',
 *         text: "text content",
 *         [ attributes: { key1: val [ , key2: val, ...] }
 *    }</pre>
 */
Zotero.Utilities.prototype.parseMarkup = function(/**String*/ str) {
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

/**
 * Test if a string is an integer
 *
 * @deprecated Use isNaN(parseInt(x))
 * @type Boolean
 */
Zotero.Utilities.prototype.isInt = function(x) {
	if(parseInt(x) == x) {
		return true;
	}
	return false;
}

/**
 * Parse a page range
 *
 * @param {String} Page range to parse
 * @return {Integer[]} Start and end pages
 */
Zotero.Utilities.prototype.getPageRange = function(pages) {
	const pageRangeRegexp = /^\s*([0-9]+)-([0-9]+)\s*$/
	
	var pageNumbers;
	var m = pageRangeRegexp.exec(pages);
	if(m) {
		// A page range
		pageNumbers = [m[1], m[2]];
	} else {
		// Assume start and end are the same
		pageNumbers = [pages, pages];
	}
	return pageNumbers;
}

/**
 * Pads a number or other string with a given string on the left
 *
 * @param {String} string String to pad
 * @param {String} pad String to use as padding
 * @length {Integer} length Length of new padded string
 * @type String
 */
Zotero.Utilities.prototype.lpad = function(string, pad, length) {
	string = string ? string + '' : '';
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}

/**
 * Tests if an item type exists
 *
 * @param {String} type Item type
 * @type Boolean
 */
Zotero.Utilities.prototype.itemTypeExists = function(type) {
	if(Zotero.ItemTypes.getID(type)) {
		return true;
	} else {
		return false;
	}
}

/**
 * Find valid creator types for a given item type
 *
 * @param {String} type Item type
 * @return {String[]} Creator types
 */
Zotero.Utilities.prototype.getCreatorsForType = function(type) {
	var types = Zotero.CreatorTypes.getTypesForItemType(Zotero.ItemTypes.getID(type));
	var cleanTypes = new Array();
	for each(var type in types) {
		cleanTypes.push(type.name);
	}
	return cleanTypes;
}

/**
 * Gets a creator type name, localized to the current locale
 *
 * @param {String} type Creator type
 * @param {String} Localized creator type
 * @type Boolean
 */
Zotero.Utilities.prototype.getLocalizedCreatorType = function(type) {
	try {
		return Zotero.getString("creatorTypes."+type);
	} catch(e) {
		return false;
	}
}

/**
 * Cleans a title, converting it to title case and replacing " :" with ":"
 *
 * @param {String} string
 * @param {Boolean} force Forces title case conversion, even if the capitalizeTitles pref is off
 * @type String
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

/**
 * @class All functions accessible from within Zotero.Utilities namespace inside sandboxed
 * translators
 *
 * @constructor
 * @augments Zotero.Utilities
 * @borrows Zotero.inArray as this.inArray
 * @borrows Zotero.Date.formatDate as this.formatDate
 * @borrows Zotero.Date.strToDate as this.strToDate
 * @borrows Zotero.Date.strToISO as this.strToISO
 * @borrows Zotero.OpenURL.lookupContextObject as this.lookupContextObject
 * @borrows Zotero.OpenURL.parseContextObject as this.parseContextObject
 * @borrows Zotero.Utilities.HTTP.processDocuments as this.processDocuments
 * @borrows Zotero.Utilities.HTTP.doPost as this.doPost
 * @param {Zotero.Translate} translate
 */
Zotero.Utilities.Translate = function(translate) {
	this.translate = translate;
}

Zotero.Utilities.Translate.prototype = new Zotero.Utilities();
Zotero.Utilities.Translate.prototype.inArray = Zotero.inArray;
Zotero.Utilities.Translate.prototype.formatDate = Zotero.Date.formatDate;
Zotero.Utilities.Translate.prototype.strToDate = Zotero.Date.strToDate;
Zotero.Utilities.Translate.prototype.strToISO = Zotero.Date.strToISO;
Zotero.Utilities.Translate.prototype.lookupContextObject = Zotero.OpenURL.lookupContextObject;
Zotero.Utilities.Translate.prototype.parseContextObject = Zotero.OpenURL.parseContextObject;

/**
 * Gets the current Zotero version
 *
 * @type String
 */
Zotero.Utilities.prototype.getVersion = function() {
	return Zotero.version;
}

/**
 * Takes an XPath query and returns the results
 *
 * @deprecated Use doc.evaluate() directly instead
 * @type Node[]
 */
Zotero.Utilities.Translate.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
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
 * Already documented in Zotero.Utilities.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.processDocuments = function(urls, processor, done, exception) {
	if(this.translate.locationIsProxied) {
		if(typeof(urls) == "string") {
			urls = [this._convertURL(urls)];
		} else {
			for(var i in urls) {
				urls[i] = this._convertURL(urls[i]);
			}
		}
	}
	
	// Unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	if(!exception) {
		var translate = this.translate;
		var exception = function(e) {
			translate.error(false, e);
		}
	}
	
	Zotero.Utilities.HTTP.processDocuments(urls, processor, done, exception);
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

/**
 * Already documented in Zotero.Utilities.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.doPost = function(url, body, onDone, requestContentType, responseCharset) {
	url = this._convertURL(url);
	
	var translate = this.translate;
	Zotero.Utilities.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
		} catch(e) {
			translate.error(false, e);
		}
	}, requestContentType, responseCharset);
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
	const protocolRe = /^(?:(?:http|https|ftp):)/i;
	const fileRe = /^[^:]*/;
	
	if(this.translate.locationIsProxied) {
		url = Zotero.Ingester.ProxyMonitor.properToProxy(url);
	}
	if(protocolRe.test(url)) return url;
	if(!fileRe.test(url)) {
		throw "Invalid URL supplied for HTTP request";
	} else {
		return Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(this.translate.location, "", null).resolve(url);
	}
}

/**
 * Functions for performing HTTP requests, both via XMLHTTPRequest and using a hidden browser
 * @namespace
 */
Zotero.Utilities.HTTP = new function() {
	/**
	* Send an HTTP GET request via XMLHTTPRequest
	* 
	* @param {String} url URL to request
	* @param {Function} onDone Callback to be executed upon request completion
	* @param {Function} onError Callback to be executed if an error occurs. Not implemented
	* @param {String} responseCharset Character set to force on the response
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doGet = function(url, onDone, onError, responseCharset) {
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
		
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, onDone, responseCharset);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	/**
	* Send an HTTP POST request via XMLHTTPRequest
	*
	* @param {String} url URL to request
	* @param {String} body Request body
	* @param {Function} onDone Callback to be executed upon request completion
	* @param {String} requestContentType Request content type (usually
	*	application/x-www-form-urlencoded)
	* @param {String} responseCharset Character set to force on the response
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doPost = function(url, body, onDone, requestContentType, responseCharset) {
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
		
		/** @ignore */
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone, responseCharset);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	/**
	* Send an HTTP HEAD request via XMLHTTPRequest
	*
	* @param {String} url URL to request
	* @param {Function} onDone Callback to be executed upon request completion
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doHead = function(url, onDone) {
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
		
		/** @ignore */
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	/**
	* Send an HTTP OPTIONS request via XMLHTTPRequest
	*
	* @param {String} url URL to request
	* @param {String} body Request body
	* @param {Function} onDone Callback to be executed upon request completion
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doOptions = function(url, body, onDone) {
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
		
		/** @ignore */
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	/**
	 * Checks if the browser is currently in "Offline" mode
	 *
	 * @type Boolean
	 */
	this.browserIsOffline = function() { 
		return Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService).offline;
	}
	
	/**
	 * Load one or more documents in a hidden browser
	 *
	 * @param {String|String[]} urls URL(s) of documents to load
	 * @param {Function} processor Callback to be executed for each document loaded
	 * @param {Function} done Callback to be executed after all documents have been loaded
	 * @param {Function} exception Callback to be executed if an exception occurs
	 */
	this.processDocuments = function(urls, processor, done, exception) {
		/**
		 * Removes event listener for the load event and deletes the hidden browser
		 */
		var removeListeners = function() {
			hiddenBrowser.removeEventListener(loadEvent, onLoad, true);
			Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
		}
		
		/**
		 * Loads the next page
		 * @inner
		 */
		var doLoad = function() {
			if(urls.length) {
				var url = urls.shift();
				try {
					Zotero.debug("loading "+url);
					hiddenBrowser.loadURI(url);
				} catch(e) {
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
				if(done) done();
			}
		};
		
		/**
		 * Callback to be executed when a page load completes
		 * @inner
		 */
		var onLoad = function() {
			Zotero.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
			if(hiddenBrowser.contentDocument.location.href != prevUrl) {	// Just in case it fires too many times
				prevUrl = hiddenBrowser.contentDocument.location.href;
				try {
					processor(hiddenBrowser.contentDocument);
				} catch(e) {
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
		
		if(typeof(urls) == "string") urls = [urls];
		
		var prevUrl;
		var loadEvent = Zotero.isFx2 ? "load" : "pageshow";
		
		var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
		hiddenBrowser.addEventListener(loadEvent, onLoad, true);
		
		doLoad();
	}
	
	/**
	 * Handler for XMLHttpRequest state change
	 *
	 * @param {nsIXMLHttpRequest} XMLHttpRequest whose state just changed
	 * @param {Function} [onDone] Callback for request completion
	 * @param {String} [responseCharset] Character set to force on the response
	 * @private
	 */
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
				if(onDone) {
					// Override the content charset
					if(responseCharset) xmlhttp.channel.contentCharset = responseCharset;
					onDone(xmlhttp);
				}
			break;
		}
	}
}

/**
 * @namespace
 */
// This would probably be better as a separate XPCOM service
Zotero.Utilities.AutoComplete = new function(){
	this.getResultComment = function (textbox){
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