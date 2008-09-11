{
	"translatorID":"f880bf79-d42f-4337-b0d2-7a7de4a48b7d",
	"translatorType":4,
	"label":"Library Catalog (X-OPAC)",
	"creator":"Michael Berkowitz",
	"target":"(xopac|hylib)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-06 21:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("&nd=") != -1) {
		return "book";
	} else if (url.indexOf("Aktion") != -1) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//table/tbody/tr/td//a';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var link = links.iterateNext();
		var items = new Object();
		while (link) {
			if (link.href.match(/&nd=\d+/)) {
				items[link.href.match(/&nd=(\d+)/)[1]] = Zotero.Utilities.trimInternal(link.textContent);
			}
			link = links.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push(i);
		}
	} else {
		ids = [url.match(/&nd=(\d+)/)[1]];
	}
	Zotero.debug(ids);
	for (var i = 0 ; i < ids.length ; i++) {
		var post = 'db=ubfr&nd=' + ids[i] + '&counter=0&Aktion=S&VomOLAF=0&links=1&gk=&format=ris';
		Zotero.Utilities.HTTP.doPost('http://www.ub.uni-freiburg.de/cgi-bin/refman', post, function(text) {
			//Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.translate();
		});
	}
}