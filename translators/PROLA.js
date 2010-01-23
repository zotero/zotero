{
	"translatorID":"2c310a37-a4dd-48d2-82c9-bd29c53c1c76",
	"translatorType":4,
	"label":"PROLA","creator":"Eugeniy Mikhailov and Michael Berkowitz",
	"target":"https?://(?:www\\.)?(prola|prl|prb|rmp|pra|prc|prd|pre|prst-ab|prst-per|)\\.aps\\.org[^/]*/(toc|forward|searchabstract|abstract)/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":null,
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-01-23 23:15:00"
}
// Works for most journals at http://prola.aps.org/browse.html

function detectWeb(doc, url) {
	// toc indicates table of contents, forward is a "Citing articles" page
	if (/\/toc\//.test(url) || (/\/forward\//.test(url))){
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
    	var arts = new Array();
    	if (detectWeb(doc, url) == "multiple") {
	    	var items = Zotero.Utilities.getItemArray(doc, doc, "(abstract|abstractsearch)");
	    	items = Zotero.selectItems(items);
	    	for (var i in items) {
		    	arts.push(i);
	    	}
    	} else {
	    	arts = [url];
    	}
    	
    	Zotero.Utilities.processDocuments(arts, function(newDoc) {
    		Zotero.debug(newDoc.title);
		// Use abstract only if we have one
		if (newDoc.evaluate('//div[contains(@class, "aps-abstractbox")]/p', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) var abs = Zotero.Utilities.trimInternal(newDoc.evaluate('//div[contains(@class, "aps-abstractbox")]/p', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
    		var urlRIS = newDoc.location.href;
		// so far several more or less  identical url possible
		// one is with "abstract" other with "searchabstract"
		urlRIS = urlRIS.replace(/(searchabstract|abstract)/,"export");
		var post = "type=ris";
		var snapurl = newDoc.location.href;
		var pdfurl = snapurl.replace(/(searchabstract|abstract)/, "pdf");
		Zotero.Utilities.HTTP.doPost(urlRIS, post, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (item.itemID) {
					item.DOI = item.itemID;
				}
				item.attachments = [
					{url:snapurl, title:"PROLA Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"PROLA Full Text PDF", mimeType:"application/pdf"}
				];
				if (abs) item.abstractNote = abs;
				item.complete();
			});
			translator.translate();
		 }, null, 'latin1');
	}, function() {Zotero.done();});
	Zotero.wait();
}