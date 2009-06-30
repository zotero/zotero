{
	"translatorID":"d75381ee-7d8d-4a3b-a595-b9190a06f43f",
	"translatorType":4,
	"label":"Scitation",
	"creator":"Eugeniy Mikhailov",
	"target":"^https?://(?:www\\.)?scitation.aip.org",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-05-29 11:40:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var multids = doc.evaluate('//input[@class="sr-checkbox" and @type="checkbox" and @name="SelectCheck"]',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var singid = doc.evaluate('//input[@type="hidden" and @name="SelectCheck"]',doc, nsResolver, XPathResult.ANY_TYPE, null);

	if (multids.iterateNext()){
		return "multiple";
	} else if (singid.iterateNext()){
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var multids = doc.evaluate('//input[@class="sr-checkbox" and @type="checkbox" and @name="SelectCheck"]',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var singids = doc.evaluate('//input[@type="hidden" and @name="SelectCheck"]',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var multid;
	var singid;
	var getstring = "/getabs/servlet/GetCitation?PrefType=ARTICLE&PrefAction=Add+Selected&fn=open_isi&source=scitation&downloadcitation=+Go+";
	if (multid = multids.iterateNext()){
		var titles = new Array();
		var ids = new Array();
		var items = new Array();
		var title;
		do {
			title = doc.evaluate('../../..//a[1]',multid, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[multid.value] = Zotero.Utilities.cleanString(title.textContent);
		} while (multid =multids.iterateNext());
		
		items = Zotero.selectItems(items);
		if(!items) return true;

		for(var i in items) {
			getstring = getstring + "&SelectCheck=" + i;
		}
	} else if (singid = singids.iterateNext()){
		getstring = getstring + "&SelectCheck=" + singid.value;
	} 

	var hostRe = new RegExp("^(https?://[^/]+)/");
	var m = hostRe.exec(url);
	var host = m[1];
	var newuri = host + getstring;
	Zotero.Utilities.HTTP.doGet(newuri, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var doi = text.match(/ER\s{2}\-\s.*org\/(.*)\n/)[1];
			if (doi) item.DOI = doi;
			item.complete();
		});
		translator.translate();

		Zotero.done();
    });
	Zotero.wait();
}