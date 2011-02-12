{
        "translatorID":"d921155f-0186-1684-615c-ca57682ced9b",
        "label":"JSTOR",
        "creator":"Simon Kornblith, Sean Takats, Michael Berkowitz, and Eli Osherovich",
        "target":"https?://[^/]*jstor\\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch|doLocatorSearch|doAdvancedResults|doBasicResults)|stable/|pss/)",
        "minVersion":"1.0.0b4.r1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2011-01-12 19:22:04"
}

 
function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page or Issue content
	if (doc.title == "JSTOR: Search Results" || url.match(/\/i\d+/) ||
		(url.match(/stable|pss/) // Issues with DOIs can't be identified by URL
		 && doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue)
	   ) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}
	
	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if(elmt || url.match(/pss/)) {
	return "journalArticle";
	}
}


Zotero.Utilities.processAsync = function (sets, callbacks, onDone) {
	var currentSet;
	var index = 0;
	
	var nextSet = function () {
		if (!sets.length) {
			onDone();
			return;
		}
		index = 0;
		currentSet = sets.shift();
		callbacks[0](currentSet, nextCallback);
	};
	var nextCallback = function () {
		index++;
		callbacks[index](currentSet, nextCallback);
	};
	
	// Add a final callback to proceed to the next set
	callbacks[callbacks.length] = function () {
		nextSet();
	}
	nextSet();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var host = doc.location.host;
	
	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	var allJids = new Array();
	if (elmt && /jid=10\.2307%2F(\d+)/.test(elmt.href)) {
	allJids.push(RegExp.$1);
	var jid = RegExp.$1;
	Zotero.debug("JID found 1 " + jid);
	}
	// Sometimes JSTOR uses DOIs as JID; here we exclude "?" characters, since it's a URL
	// And exclude TOC for journal issues that have their own DOI
	else if (/(?:pss|stable)\/(10\.\d+\/.+)(?:\?.*)?/.test(url)
		 && !doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
	Zotero.debug("URL " + url);
	jid = RegExp.$1;
	allJids.push(jid);
	Zotero.debug("JID found 2 " + jid);
	} 
	else if (/(?:pss|stable)\/(\d+)/.test(url)
		 && !doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
	Zotero.debug("URL " + url);
	jid = RegExp.$1;
	allJids.push(jid);
	Zotero.debug("JID found 2 " + jid);
	} 
	else {
	// We have multiple results
	var resultsBlock = doc.evaluate('//fieldset[@id="results"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if (! resultsBlock) {
		return true;
	}

	var allTitlesElmts = doc.evaluate('//li//a[@class="title"]', resultsBlock, nsResolver,  XPathResult.ANY_TYPE, null);
	var currTitleElmt;
	var availableItems = new Object();
	while (currTitleElmt = allTitlesElmts.iterateNext()) {
		var title = currTitleElmt.textContent;
		// Sometimes JSTOR uses DOIs as JID; here we exclude "?" characters, since it's a URL
		if (/(?:pss|stable)\/(10\.\d+\/.+)(?:\?.*)?/.test(currTitleElmt.href))
			var jid = RegExp.$1;
		else
			var jid = currTitleElmt.href.match(/(?:stable|pss)\/([a-z]*?\d+)/)[1];
		if (jid) {
			availableItems[jid] = title;
		}
		Zotero.debug("Found title " + title+jid);
	}
	Zotero.debug("End of titles");
	
	var selectedItems = Zotero.selectItems(availableItems);
	if (!selectedItems) {
		return true;
	}
	for (var j in selectedItems) {
		Zotero.debug("Pushing " + j);
		allJids.push(j);
	}
	}
	
	var sets = [];
	for each(var jid in allJids) {
		sets.push({ jid: jid });
	}
	
	function first(set, next) {
		var jid = set.jid;
		var downloadString = "suffix=" + jid;
		
		Zotero.Utilities.HTTP.doPost("http://"+host+"/action/downloadSingleCitation?format=refman&direct=true&singleCitation=true", downloadString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					// For some reason JSTOR exports abstract with 'AB' tag istead of 'N1'
					item.abstractNote = item.notes[0].note;
					
					delete item.notes;
					item.notes = undefined;
				}
				
				// Don't save HTML snapshot from 'UR' tag
				item.attachments = [];
				
				set.doi = "10.2307/" + jid;
				
				if (/stable\/(\d+)/.test(item.url)) {
					var pdfurl = "http://"+ host + "/stable/pdfplus/" + jid + ".pdf?acceptTC=true";
					item.attachments.push({url:pdfurl, title:"JSTOR Full Text PDF", mimeType:"application/pdf"});
				}
				
				set.item = item;
				
				next();
			});
			
			translator.translate();
		});
	}
	
	function second(set, next) {
		var item = set.item;
		
		if (!set.doi) {
			item.complete();
			next();
		}
		
		var doi = set.doi;
		var crossrefURL = "http://www.crossref.org/openurl/?req_dat=zter:zter321&url_ver=Z39.88-2004&ctx_ver=Z39.88-2004&rft_id=info%3Adoi/"+doi+"&noredirect=true&format=unixref";
		
		Zotero.Utilities.HTTP.doGet(crossrefURL, function (text) {
			text = text.replace(/<\?xml[^>]*\?>/, "");
			// parse XML with E4X
			try {
				var xml = new XML(text);
			} catch(e) {
				item.complete();
				next();
				return;
			}
			
			var doi = xml..doi.toString();
			
			// ensure DOI is valid
			if(!xml..error.length()) {
				Zotero.debug("DOI is valid");
				item.DOI = doi;
			}
			
			item.complete();
			next();
		});
	}
	
	var callbacks = [first, second];
	Zotero.Utilities.processAsync(sets, callbacks, function () { Zotero.done(); });
	Zotero.wait();
}
