{
	"translatorID":"4fd6b89b-2316-2dc4-fd87-61a97dd941e8",
	"translatorType":4,
	"label":"Library Catalog (InnoPAC)",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"(search~|\\/search\\?|(a|X|t|Y|w)\\?|\\?(searchtype|searchscope)|frameset&FF)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":200,
	"inRepository":true,
	"lastUpdated":"2008-10-28 02:50:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

// Central Michigan University fix
	var xpath = '//div[@class="bibRecordLink"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(elmt) {
		return "book";
	}

// possibly disastrous edit to regular expression below	
	if (!url.match(/SEARCH=/) && !url.match(/searchargs?=/) && !url.match(/&FF/)) return false;
	// First, check to see if the URL alone reveals InnoPAC, since some sites don't reveal the MARC button
	var matchRegexp = new RegExp('^https?://[^/]+/search[^/]*\\??/[^/]+/[^/]+/[^/]+\%2C[^/]+/frameset(.+)$');
	if(matchRegexp.test(doc.location.href)) {
		if (!url.match("SEARCH") && !url.match("searchtype")) {
			return "book";
		}
	}
	// Next, look for the MARC button	
	xpath = '//a[img[@src="/screens/marcdisp.gif" or starts-with(@alt, "MARC ") or @src="/screens/regdisp.gif" or @alt="REGULAR RECORD DISPLAY"]]';
	elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(elmt) {
		return "book";
	}
	// Also, check for links to an item display page
	var tags = doc.getElementsByTagName("a");
	for(var i=0; i<tags.length; i++) {
		if(matchRegexp.test(tags[i].href) || tags[i].href.match(/^https?:\/\/([^/]+\/(?:search\??\/|record=?|search%7e\/)|frameset&FF=)/)) {
			return "multiple";
		}
	}
	
	return false;
}

function scrape(marc, newDoc) {
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var xpath = '//pre/text()';
	if (newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var elmts = newDoc.evaluate(xpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var useNodeValue = true;
	} else {
		var elmts = newDoc.evaluate('//pre', newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var useNodeValue = false;
	}
	var elmt;
	while(elmt = elmts.iterateNext()) {
		if (useNodeValue) {
			var text = elmt.nodeValue;
		} else {
			var text = elmt.textContent;
		}
		var newItem = new Zotero.Item();
		var record = new marc.record();
		
		var linee = text.split("\n");
		for (var i=0; i<linee.length; i++) {
			if(!linee[i]) {
				continue;
			}
			
			linee[i] = linee[i].replace(/[\xA0_\t]/g, " ");
			var value = linee[i].substr(7);
			
			if(linee[i].substr(0, 6) == "      ") {
				// add this onto previous value
				tagValue += value;
			} else {
				if(linee[i].substr(0, 6) == "LEADER") {
					// trap leader
					record.leader = value;
				} else {
					if(tagValue) {	// finish last tag
						tagValue = tagValue.replace(/\|(.)/g, marc.subfieldDelimiter+"$1");
						if(tagValue[0] != marc.subfieldDelimiter) {
							tagValue = marc.subfieldDelimiter+"a"+tagValue;
						}
						
						// add previous tag
						record.addField(tag, ind, tagValue);
					}
					
					var tag = linee[i].substr(0, 3);
					var ind  = linee[i].substr(4, 2);
					var tagValue = value;
				}
			}
		}
		if(tagValue) {
			tagValue = tagValue.replace(/\|(.)/g, marc.subfieldDelimiter+"$1");
			if(tagValue[0] != marc.subfieldDelimiter) {
				tagValue = marc.subfieldDelimiter+"a"+tagValue;
			}
			
			// add previous tag
			record.addField(tag, ind, tagValue);
		}
		
		record.translate(newItem);
		
		var domain = newDoc.location.href.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}
}

function pageByPage(marc, urls) {
	Zotero.Utilities.processDocuments(urls, function(newDoc) {
		scrape(marc, newDoc);
	}, function() { Zotero.done() });
}

function doWeb(doc, url) {
	var uri = doc.location.href;
	var newUri;
	// load translator for MARC
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (detectWeb(doc, url) == "book") {
		var matchRegexp = new RegExp('^(.*)frameset(.+)$');
		var m = matchRegexp.exec(uri);
		if (m) {
			newUri = uri.replace(/frameset/, "marc");
		} else {
			newUri = doc.evaluate('//a[contains(@href, "frameset")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.replace(/frameset/, 'marc');
		}
		pageByPage(marc, [newUri]);
	} else {	// Search results page
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile('^https?://[^/]+/search\\??/[^/]+/[^/]+/[0-9]+\%2C[^/]+/frameset');
		
		var urls = new Array();
		var availableItems = new Array();
		var firstURL = false;
		
		var tableRows = doc.evaluate('//table[@class="browseScreen"]//tr[@class="browseEntry" or @class="briefCitRow" or td/input[@type="checkbox"] or td[contains(@class,"briefCitRow")]]',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		// Go through table rows
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			// get link
			var links = doc.evaluate('.//span[@class="briefcitTitle"]/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
			var link = links.iterateNext();
			if(!link) {
				var links = doc.evaluate(".//a", tableRow, nsResolver, XPathResult.ANY_TYPE, null);
				link = links.iterateNext();
			}
			
			if(link) {
				if(availableItems[link.href]) {
					continue;
				}
					
				
				// Go through links
				while(link) {
					if (link.textContent.match(/\w+/)) availableItems[link.href] = link.textContent;
					link = links.iterateNext();
				}
				i++;
			}
		};
		
		var items = Zotero.selectItems(availableItems);
		
		if(!items) {
			return true;
		}
		
		var newUrls = new Array();
		for(var url in items) {
			newUrls.push(url.replace("frameset", "marc"));
		}
		pageByPage(marc, newUrls);
	}

	Zotero.wait();
}