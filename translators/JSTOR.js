{
	"translatorID":"d921155f-0186-1684-615c-ca57682ced9b",
	"translatorType":4,
	"label":"JSTOR",
	"creator":"Simon Kornblith, Sean Takats, Michael Berkowitz and Eli Osherovich",
	"target":"https?://[^/]*jstor\\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch|doLocatorSearch)|stable/|pss/)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-27 16:45:00"
	}
 
function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page or Issue content
	if (doc.title == "JSTOR: Search Results" || url.match(/\/i\d+/)) {
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
	if (elmt && /jid=(\d+)/.test(elmt.href)) {
	allJids.push(RegExp.$1);
	Zotero.debug("JID found 1 " + jid);
	}
	else if (/(?:pss|stable)\/(\d+)/.test(url)) {
	Zotero.debug("URL " + url);
	allJids.push(RegExp.$1);
	Zotero.debug("JID found 2 " + jid);
	} 
	else {
	// We have multiple results
	var resultsBlock = doc.evaluate('//fieldset[@id="results"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if (! resultsBlock) {
		return true;
	}

	var allTitlesElmts = doc.evaluate('//li/ul/li/a[@class="title"]', resultsBlock, nsResolver,  XPathResult.ANY_TYPE, null);
	var currTitleElmt;
	var availableItems = new Object();
	while (currTitleElmt = allTitlesElmts.iterateNext()) {
		var title = currTitleElmt.textContent;
		var jid = currTitleElmt.href.match(/stable\/(\d+)/)[1];
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
	
	for (var i in allJids) {
	var downloadString = "&suffix="+allJids[i];
	Zotero.Utilities.HTTP.doPost("http://"+host+"/action/downloadSingleCitation?format=refman&direct=true&singleCitation=true",downloadString,  function(text) {
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
			item.attachments[0].title = item.title;
			item.attachments[0].mimeType = "text/html";
			
			if (/stable\/(\d+)/.test(item.url)) {
				var localJid = RegExp.$1;
				
				// Add DOI
				if (! item.DOI) {
				item.DOI = "10.2307/"+localJid;
				}
				var pdfurl = "http://"+ host + "/stable/pdfplus/" + localJid + ".pdf";
				item.attachments.push({url:pdfurl, title:"JSTOR Full Text PDF", mimeType:"application/pdf"});
			}
			item.complete();
			});
		
		translator.translate();
		
		Zotero.done();
		});
	}
}
