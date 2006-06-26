// Scholar for Firefox Utilities
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

/////////////////////////////////////////////////////////////////
//
// Scholar.Utilities
//
/////////////////////////////////////////////////////////////////
// Scholar.Utilities class, a set of methods to assist in data
// extraction. Some of the code here was stolen directly from the Piggy Bank
// project.

Scholar.Utilities = function () {}

// Adapter for Piggy Bank function to print debug messages; log level is
// fixed at 4 (could change this)
Scholar.Utilities.prototype.debugPrint = function(msg) {
	Scholar.debug(msg, 4);
}

// Appears to trim a string, chopping of newlines/spacing
Scholar.Utilities.prototype.trimString = function(s) {
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

/*
 * BEGIN SCHOLAR FOR FIREFOX EXTENSIONS
 * Functions below this point are extensions to the utilities provided by
 * Piggy Bank. When used in external code, the repository will need to add
 * a function definition when exporting in Piggy Bank format.
 */

/*
 * Converts a JavaScript date object to an ISO-style date
 */
Scholar.Utilities.prototype.dateToISO = function(jsDate) {
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
Scholar.Utilities.prototype.cleanAuthor = function(author) {
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
Scholar.Utilities.prototype.cleanString = function(s) {
	s = s.replace(/[ \xA0]+/g, " ");
	return this.trimString(s);
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
 * END SCHOLAR FOR FIREFOX EXTENSIONS
 */

/////////////////////////////////////////////////////////////////
//
// Scholar.Utilities.Ingester
//
/////////////////////////////////////////////////////////////////
// Scholar.Utilities.Ingester extends Scholar.Utilities, offering additional
// classes relating to data extraction specifically from HTML documents.

Scholar.Utilities.Ingester = function(myWindow, proxiedURL) {
	this.window = myWindow;
	this.proxiedURL = proxiedURL;
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

// Loads a single document for a scraper, running succeeded() on success or
// failed() on failure
Scholar.Utilities.Ingester.prototype.loadDocument = function(url, browser, succeeded, failed) {
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
//             also logged in the Scholar for Firefox log)
Scholar.Utilities.Ingester.prototype.processDocuments = function(browser, firstDoc, urls, processor, done, exception) {
	var hiddenBrowser = Scholar.Ingester.createHiddenBrowser(this.window);
	var myWindow = this.window;
	var prevUrl, url;
	Scholar.debug("processDocuments called");
	
	try {
		if (urls.length == 0) {
			if(firstDoc) {
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
				url = urls[urlIndex];
				if(this.proxiedURL) {
					url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
				}
				try {
					Scholar.debug("loading "+url);
					hiddenBrowser.loadURI(url);
				} catch (e) {
					Scholar.debug("Scholar.Utilities.Ingester.processDocuments doLoad: " + e, 2);
					exception(e);
				}
			} else {
				hiddenBrowser.removeEventListener("load", onLoad, true);
				Scholar.Ingester.deleteHiddenBrowser(hiddenBrowser);
				done();
			}
		};
		var onLoad = function() {
			Scholar.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
			if(hiddenBrowser.contentDocument.location.href != prevUrl) {	// Just in case it fires too many times
				prevUrl = hiddenBrowser.contentDocument.location.href;
				try {
					var newHiddenBrowser = new Object();
					newHiddenBrowser.contentDocument = hiddenBrowser.contentDocument;
					newHiddenBrowser.contentWindow = hiddenBrowser.contentWindow;
					processor(newHiddenBrowser);
				} catch (e) {
					Scholar.debug("Scholar.Utilities.Ingester.processDocuments onLoad: " + e, 2);
					exception(e);
				}
				doLoad();
			}
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

// Appears to look for links in a document containing a certain substring (kind
// of like getItemArray, only with NO REGEXP FUNCTIONALITY)
Scholar.Utilities.Ingester.prototype.collectURLsWithSubstring = function(doc, substring) {
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
 * BEGIN SCHOLAR FOR FIREFOX EXTENSIONS
 */

/*
 * Gets a given node (assumes only one value)
 */
Scholar.Utilities.Ingester.prototype.getNode = function(doc, contextNode, xpath, nsResolver) {
	return doc.evaluate(xpath, contextNode, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null).iterateNext();
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
 * Allows a user to select which items to scrape
 */
Scholar.Utilities.Ingester.prototype.selectItems = function(itemList) {
	// mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = this.window.openDialog("chrome://scholar/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	return io.dataOut;
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

// These functions are for use by importMARCRecord. They're private, because,
// while they are useful, it's also nice if as many of our scrapers as possible
// are PiggyBank compatible, and if our scrapers used functions, that would
// break compatibility
Scholar.Utilities.Ingester.prototype._MARCCleanString = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	return author.replace(/  +/, ' ');
}

Scholar.Utilities.Ingester.prototype._MARCCleanNumber = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	var regexp = /^[^ ]*/;
	var m = regexp.exec(author);
	if(m) {
		return m[0];
	}
}
Scholar.Utilities.Ingester.prototype._MARCPullYear = function(text) {
	var pullRe = /[0-9]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

Scholar.Utilities.Ingester.prototype._MARCAssociateField = function(record, uri, model, fieldNo, rdfUri, execMe, prefix, part) {
	if(!part) {
		part = 'a';
	}
	var field = record.get_field_subfields(fieldNo);
	Scholar.debug('Found '+field.length+' matches for '+fieldNo+part);
	if(field) {
		for(i in field) {
			var value;
			for(var j=0; j<part.length; j++) {
				var myPart = part.substr(j, 1);
				if(field[i][myPart]) {
					if(value) {
						value += " "+field[i][myPart];
					} else {
						value = field[i][myPart];
					}
				}
			}
			if(value) {
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
Scholar.Utilities.Ingester.prototype.importMARCRecord = function(record, uri, model) {
	var prefixDC = 'http://purl.org/dc/elements/1.1/';
	var prefixDCMI = 'http://purl.org/dc/dcmitype/';
	var prefixDummy = 'http://chnm.gmu.edu/firefox-scholar/';
	var prefixRDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
	
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
	model = this._MARCAssociateField(record, uri, model, '245', prefixDC + 'title', this._MARCCleanString, '', 'ab');
	// Extract edition
	model = this._MARCAssociateField(record, uri, model, '250', prefixDC + 'hasVersion', this._MARCCleanString);
	// Extract place info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDummy + 'place', this._MARCCleanString, '', 'a');
	// Extract publisher info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'publisher', this._MARCCleanString, '', 'b');
	// Extract year
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'year', this._MARCPullYear, '', 'c');
	// Extract series
	model = this._MARCAssociateField(record, uri, model, '440', prefixDummy + 'series', this._MARCCleanString);
	// Extract call number
	model = this._MARCAssociateField(record, uri, model, '050', prefixDC + 'identifier', this._MARCCleanString, 'LCC ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '060', prefixDC + 'identifier', this._MARCCleanString, 'NLM ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '070', prefixDC + 'identifier', this._MARCCleanString, 'NAL ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '080', prefixDC + 'identifier', this._MARCCleanString, 'UDC ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '082', prefixDC + 'identifier', this._MARCCleanString, 'DDC ', 'a');
	model = this._MARCAssociateField(record, uri, model, '084', prefixDC + 'identifier', this._MARCCleanString, 'CN ', 'ab');
	
	// Set type
	model = model.addStatement(uri, prefixRDF + 'type', prefixDummy + "book", true);
}

/*
 * END SCHOLAR FOR FIREFOX EXTENSIONS
 */

// These are front ends for XMLHttpRequest. XMLHttpRequest can't actually be
// accessed outside the sandbox, and even if it could, it wouldn't let scripts
// access across domains, so everything's replicated here.
// Scholar for Firefox Utilities
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

/////////////////////////////////////////////////////////////////
//
// Scholar.Utilities
//
/////////////////////////////////////////////////////////////////
// Scholar.Utilities class, a set of methods to assist in data
// extraction. Some of the code here was stolen directly from the Piggy Bank
// project.

Scholar.Utilities = function () {}

// Adapter for Piggy Bank function to print debug messages; log level is
// fixed at 4 (could change this)
Scholar.Utilities.prototype.debugPrint = function(msg) {
	Scholar.debug(msg, 4);
}

// Appears to trim a string, chopping of newlines/spacing
Scholar.Utilities.prototype.trimString = function(s) {
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

/*
 * BEGIN SCHOLAR FOR FIREFOX EXTENSIONS
 * Functions below this point are extensions to the utilities provided by
 * Piggy Bank. When used in external code, the repository will need to add
 * a function definition when exporting in Piggy Bank format.
 */

/*
 * Converts a JavaScript date object to an ISO-style date
 */
Scholar.Utilities.prototype.dateToISO = function(jsDate) {
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
Scholar.Utilities.prototype.cleanAuthor = function(author) {
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
Scholar.Utilities.prototype.cleanString = function(s) {
	s = s.replace(/[ \xA0]+/g, " ");
	return this.trimString(s);
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

// These functions are for use by importMARCRecord. They're private, because,
// while they are useful, it's also nice if as many of our scrapers as possible
// are PiggyBank compatible, and if our scrapers used functions, that would
// break compatibility
Scholar.Utilities.prototype._MARCCleanString = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	return author.replace(/  +/, ' ');
}

Scholar.Utilities.prototype._MARCCleanNumber = function(author) {
	author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
	author = author.replace(/[\s\.\,\/\[\]\:]+$/, '');
	var regexp = /^[^ ]*/;
	var m = regexp.exec(author);
	if(m) {
		return m[0];
	}
}
Scholar.Utilities.prototype._MARCPullYear = function(text) {
	var pullRe = /[0-9]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

Scholar.Utilities.prototype._MARCAssociateField = function(record, uri, model, fieldNo, rdfUri, execMe, prefix, part) {
	if(!part) {
		part = 'a';
	}
	var field = record.get_field_subfields(fieldNo);
	Scholar.debug('Found '+field.length+' matches for '+fieldNo+part);
	if(field) {
		for(i in field) {
			var value;
			for(var j=0; j<part.length; j++) {
				var myPart = part.substr(j, 1);
				if(field[i][myPart]) {
					if(value) {
						value += " "+field[i][myPart];
					} else {
						value = field[i][myPart];
					}
				}
			}
			if(value) {
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
Scholar.Utilities.prototype.importMARCRecord = function(record, uri, model) {
	var prefixDC = 'http://purl.org/dc/elements/1.1/';
	var prefixDCMI = 'http://purl.org/dc/dcmitype/';
	var prefixDummy = 'http://chnm.gmu.edu/firefox-scholar/';
	var prefixRDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
	
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
	model = this._MARCAssociateField(record, uri, model, '245', prefixDC + 'title', this._MARCCleanString, '', 'ab');
	// Extract edition
	model = this._MARCAssociateField(record, uri, model, '250', prefixDC + 'hasVersion', this._MARCCleanString);
	// Extract place info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDummy + 'place', this._MARCCleanString, '', 'a');
	// Extract publisher info
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'publisher', this._MARCCleanString, '', 'b');
	// Extract year
	model = this._MARCAssociateField(record, uri, model, '260', prefixDC + 'year', this._MARCPullYear, '', 'c');
	// Extract series
	model = this._MARCAssociateField(record, uri, model, '440', prefixDummy + 'series', this._MARCCleanString);
	// Extract call number
	model = this._MARCAssociateField(record, uri, model, '050', prefixDC + 'identifier', this._MARCCleanString, 'LCC ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '060', prefixDC + 'identifier', this._MARCCleanString, 'NLM ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '070', prefixDC + 'identifier', this._MARCCleanString, 'NAL ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '080', prefixDC + 'identifier', this._MARCCleanString, 'UDC ', 'ab');
	model = this._MARCAssociateField(record, uri, model, '082', prefixDC + 'identifier', this._MARCCleanString, 'DDC ', 'a');
	model = this._MARCAssociateField(record, uri, model, '084', prefixDC + 'identifier', this._MARCCleanString, 'CN ', 'ab');
	
	// Set type
	model = model.addStatement(uri, prefixRDF + 'type', prefixDummy + "book", true);
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

Scholar.Utilities.Ingester = function(myWindow, proxiedURL) {
	this.window = myWindow;
	this.proxiedURL = proxiedURL;
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

// Loads a single document for a scraper, running succeeded() on success or
// failed() on failure
Scholar.Utilities.Ingester.prototype.loadDocument = function(url, browser, succeeded, failed) {
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
//             also logged in the Scholar for Firefox log)
Scholar.Utilities.Ingester.prototype.processDocuments = function(browser, firstDoc, urls, processor, done, exception) {
	var hiddenBrowser = Scholar.Ingester.createHiddenBrowser(this.window);
	var myWindow = this.window;
	var prevUrl, url;
	Scholar.debug("processDocuments called");
	
	try {
		if (urls.length == 0) {
			if(firstDoc) {
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
				url = urls[urlIndex];
				if(this.proxiedURL) {
					url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
				}
				try {
					Scholar.debug("loading "+url);
					hiddenBrowser.loadURI(url);
				} catch (e) {
					Scholar.debug("Scholar.Utilities.Ingester.processDocuments doLoad: " + e, 2);
					exception(e);
				}
			} else {
				hiddenBrowser.removeEventListener("load", onLoad, true);
				Scholar.Ingester.deleteHiddenBrowser(hiddenBrowser);
				done();
			}
		};
		var onLoad = function() {
			Scholar.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
			if(hiddenBrowser.contentDocument.location.href != prevUrl) {	// Just in case it fires too many times
				prevUrl = hiddenBrowser.contentDocument.location.href;
				try {
					var newHiddenBrowser = new Object();
					newHiddenBrowser.contentDocument = hiddenBrowser.contentDocument;
					newHiddenBrowser.contentWindow = hiddenBrowser.contentWindow;
					processor(newHiddenBrowser);
				} catch (e) {
					Scholar.debug("Scholar.Utilities.Ingester.processDocuments onLoad: " + e, 2);
					exception(e);
				}
				doLoad();
			}
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
Scholar.Utilities.Ingester.prototype.collectURLsWithSubstring = function(doc, substring) {
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
 * BEGIN SCHOLAR FOR FIREFOX EXTENSIONS
 */

/*
 * Gets a given node (assumes only one value)
 */
Scholar.Utilities.Ingester.prototype.getNode = function(doc, contextNode, xpath, nsResolver) {
	return doc.evaluate(xpath, contextNode, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null).iterateNext();
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
 * Allows a user to select which items to scrape
 */
Scholar.Utilities.Ingester.prototype.selectItems = function(itemList) {
	// mozillazine made me do it! honest!
	var io = { dataIn:itemList, dataOut:null }
	var newDialog = this.window.openDialog("chrome://scholar/content/ingester/selectitems.xul",
		"_blank","chrome,modal,centerscreen,resizable=yes", io);
	return io.dataOut;
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

/*
 * END SCHOLAR FOR FIREFOX EXTENSIONS
 */

// Ingester adapters for Scholar.Utilities.HTTP to handle proxies

Scholar.Utilities.Ingester.HTTPUtilities = function(proxiedURL) {
	this.proxiedURL = proxiedURL
}

Scholar.Utilities.Ingester.HTTPUtilities.prototype.doGet = function(url, onStatus, onDone) {
	if(this.proxiedURL) {
		url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
	}
	Scholar.Utilities.HTTP.doGet(url, onStatus, function(xmlhttp) { onDone(xmlhttp.responseText, xmlhttp) })
}

Scholar.Utilities.Ingester.HTTPUtilities.prototype.doPost = function(url, body, onStatus, onDone) {
	if(this.proxiedURL) {
		url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
	}
	Scholar.Utilities.HTTP.doPost(url, body, onStatus, function(xmlhttp) { onDone(xmlhttp.responseText, xmlhttp) })
}

Scholar.Utilities.Ingester.HTTPUtilities.prototype.doOptions = function(url, onStatus, onDone) {
	if(this.proxiedURL) {
		url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
	}
	Scholar.Utilities.HTTP.doOptions(url, onStatus, function(xmlhttp) { onDone(xmlhttp.responseText, xmlhttp) })
}

// These are front ends for XMLHttpRequest. XMLHttpRequest can't actually be
// accessed outside the sandbox, and even if it could, it wouldn't let scripts
// access across domains, so everything's replicated here.
Scholar.Utilities.HTTP = new function() {
	this.doGet = doGet;
	this.doPost = doPost;
	this.doOptions = doOptions;
	this.browserIsOffline = browserIsOffline;
	
	/**
	* Send an HTTP GET request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	**/
	function doGet(url, onStatus, onDone) {
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		
		var test = xmlhttp.open('GET', url, true);
		
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onStatus, onDone);
		};
		
		xmlhttp.send(null);
		
		return true;
	}
	
	
	/**
	* Send an HTTP POST request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	**/
	function doPost(url, body, onStatus, onDone) {
		if (this.browserIsOffline()){
			return false;
		}
		if(this.proxiedURL) {
			url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		
		xmlhttp.open('POST', url, true);
		
		var me = this;
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onStatus, onDone);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	
	/**
	* Send an HTTP OPTIONS request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	**/
	function doOptions(url, body, onStatus, onDone) {
		if (this.browserIsOffline()){
			return false;
		}
		if(this.proxiedURL) {
			url = Scholar.Ingester.ProxyMonitor.properToProxy(url);
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		
		xmlhttp.open('OPTIONS', url, true);
		
		var me = this;
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onStatus, onDone);
		};
		
		xmlhttp.send(body);
		
		return true;
	}
	
	
	function browserIsOffline() { 
		return Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService).offline;
	}
	
	
	function _stateChange(xmlhttp, onStatus, onDone){
		if(!onDone) {
			onStatus = null;
			onDone = onStatus;
		}
		switch (xmlhttp.readyState){
			// Request not yet made
			case 1:
			break;
	
			// Contact established with server but nothing downloaded yet
			case 2:
				// Accessing status will throw an exception if no network connection
				try {
					xmlhttp.status;
				}
				catch (e){
					Scholar.debug('No network connection');
					xmlhttp.noNetwork = true;
					return false;
				}
				
				// Check for HTTP status 200
				if (xmlhttp.status != 200){
					Scholar.debug('XMLHTTPRequest received HTTP response code '
						+ xmlhttp.status);
					if(onStatus) {
						try {
							onStatus(
								xmlhttp.status,
								xmlhttp.statusText,
								xmlhttp
							);
						} catch (e) {
							Scholar.debug(e, 2);
						}
					}
				}
			break;
	
			// Called multiple while downloading in progress
			case 3:
			break;
	
			// Download complete
			case 4:
				try {
					if (onDone){
						onDone(xmlhttp);
					}
				}
				catch (e){
					Scholar.debug(e, 2);
				}
			break;
		}
	}
}