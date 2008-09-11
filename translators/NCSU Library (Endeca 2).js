{
	"translatorID":"da440efe-646c-4a18-9958-abe1f7d55cde",
	"translatorType":4,
	"label":"NCSU Library (Endeca 2)",
	"creator":"Sean Takats",
	"target":"^https?://[^\\.]+.lib.ncsu.edu/(?:web2/tramp2\\.exe|catalog/\\?)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-26 03:00:00"
}

function detectWeb(doc, url) { 
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var xpath = '//a[contains(text(), "MARC record")]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
	xpath = '//span[@class="resultTitle"]/a';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

function scrape(text){
	var tempidRe = new RegExp("/web2/tramp2\.exe/goto/([^?]+)\?");
	var tempidMatch = tempidRe.exec(text);
	var tempid = tempidMatch[1];
	
	marcUri = "http://catalog.lib.ncsu.edu/web2/tramp2.exe/download_hitlist/" + tempid;
	marcUri = marcUri + "/NCSUCatResults.mrc?server=1home&format=MARC&server=1home&item=1&item_source=1home";
	Zotero.Utilities.HTTP.doGet(marcUri, function(text) {
		// load translator for MARC
		var marc = Zotero.loadTranslator("import");
		marc.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.setString(text);	
		marc.translate();
	}, function() {Zotero.done()}, null);
}

function doWeb(doc, url) { 
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var xpath = '//span[@class="resultTitle"]/a';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	if(elmt = elmts.iterateNext()) {
		// search results page
		var newUris = new Array();
		var items = new Array();
		do {
			items[elmt.href] = Zotero.Utilities.cleanString(elmt.textContent);
		} while (elmt = elmts.iterateNext());
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		for(var i in items) {
			newUris.push(i);
		}
		Zotero.Utilities.HTTP.doGet(newUris, function(text) { scrape(text) },
			function() {}, null);		
		Zotero.wait();
	} else if (elmt = doc.evaluate('//a[contains(text(), "MARC record")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		// single book
		scrape(elmt.href);
		Zotero.wait();
	}
}