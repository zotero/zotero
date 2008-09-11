{
	"translatorID":"99f958ab-0732-483d-833f-6bd8e42f6277",
	"translatorType":4,
	"label":"National Bureau of Economic Research",
	"creator":"Michael Berkowitz",
	"target":"^https?://(?:papers\\.|www\\.)?nber\\.org/(papers|s|new)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-05 07:45:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	if (doc.evaluate('//a[contains(text(), "RIS")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	} else if (doc.evaluate('//div[@class="maintd"][@id="maine"]/table/tbody/tr/td[1]//a[contains(@href, "papers/w")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

function parseRIS(uris){
	
	Zotero.Utilities.HTTP.doGet(uris, function(text){	
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//div[@class="maintd"][@id="maine"]/table/tbody/tr/td[1]//a[contains(@href, "papers/w")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			if (!link.href.match(/\.pdf$/)) items[link.href] = link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i + '.ris');
		}
	} else {
		arts = [url + '.ris'];
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if (text.match(/AB\s+\-\s+/)) item.abstractNote = text.match(/AB\s+\-\s+((.|\s)+)\n([A-Z]{2})/)[1];
			item.notes = new Array();
			item.complete();	
		});
		translator.translate();
	});
	Zotero.wait();
}