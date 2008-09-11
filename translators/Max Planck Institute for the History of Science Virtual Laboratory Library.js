{
	"translatorID":"66928fe3-1e93-45a7-8e11-9df6de0a11b3",
	"translatorType":4,
	"label":"Max Planck Institute for the History of Science: Virtual Laboratory Library",
	"creator":"Sean Takats",
	"target":"http://vlp.mpiwg-berlin.mpg.de/library/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-03-22 16:35:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;
	var elmt = doc.evaluate('//base[contains(@href, "/library/data/lit")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (elmt){
			return "book";
	}
	elmt = doc.evaluate('//span[starts-with(@title, "lit")] | //a[starts-with(@title, "lit")] | //p[starts-with(@title, "lit")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (elmt){
		return "multiple";
	}
}

function doWeb(doc, url){

	var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;
	var uris = new Array();
	var baseElmt = doc.evaluate('//base[contains(@href, "/library/data/lit")]/@href', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (baseElmt){
		var docID = baseElmt.nodeValue;
		var idRe = /lit[0-9]+/;
		var m = idRe.exec(docID);
		uris.push("http://vlp.mpiwg-berlin.mpg.de/library/meta?id=" + m[0]);
	} else {
		var searchElmts = doc.evaluate('//span[starts-with(@title, "lit")] | //a[starts-with(@title, "lit")] | //p[starts-with(@title, "lit")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var searchElmt;
		var links = new Array();
		var availableItems = new Array();
		var i = 0;
		while (searchElmt = searchElmts.iterateNext()){
			availableItems[i] = Zotero.Utilities.cleanString(searchElmt.textContent);
			var docID = doc.evaluate('./@title', searchElmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			links.push("http://vlp.mpiwg-berlin.mpg.de/library/meta?id=" + docID);
			i++;
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		var uris = new Array();
		for(var i in items) {
			uris.push(links[i]);
		}
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		// load Refer translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.type = undefined;
			item.complete();
		});
		translator.translate();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}