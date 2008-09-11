{
	"translatorID":"19643c25-a4b2-480d-91b7-4e0b761fb6ad",
	"translatorType":4,
	"label":"ScientificCommons",
	"creator":"Sean Takats",
	"target":"^http://(?:en|de|www)\\.scientificcommons\\.org",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-03-16 03:00:00"
}

function detectWeb(doc, url) {
	var articleRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/([0-9]+)/;
	var m = articleRe.exec(url);

	if(m) {
		return "journalArticle";
	} else {
		var frontRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/$/;
		if(frontRe.test(url)) return "multiple";
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
			} : null;
		var listElt = doc.evaluate('//div[@id="content_search_details"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (listElt) return "multiple";
	}
	return false;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;

	var hostRe = new RegExp("^(http://[^/]+)/");
	var m = hostRe.exec(url);
	var host = m[1];

	var articleRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/([0-9]+)/;
	m = articleRe.exec(url);
	var uris = new Array();

	if(m) {
		var idElt = doc.evaluate('//div[@id="publication_id"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if  (idElt) {
			uris.push(host + "/export/ris/" + idElt.textContent);
		} else {
			return false;
		}
	} else {
		var items = new Array();
		var listElts = doc.evaluate('//div[@class="content_element"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var id;
		var link;
		var title;
		while (listElt = listElts.iterateNext()) {
			id = doc.evaluate('./@id', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			link = host + "/export/ris/" + id;
			title = doc.evaluate('.//p[@class="title"]', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[link] = Zotero.Utilities.cleanString(title);
		} 

		items = Zotero.selectItems(items);
		if(!items) return true;

		for(var uri in items) {
			uris.push(uri);
		}
	}

	Zotero.Utilities.HTTP.doGet(uris, function(text) {
	// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			// add attachment support?
			item.complete();
		});
		translator.translate();
		Zotero.done();
	});
	Zotero.wait();
}