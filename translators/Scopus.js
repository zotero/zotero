{
	"translatorID":"a14ac3eb-64a0-4179-970c-92ecc2fec992",
	"translatorType":4,
	"label":"Scopus",
	"creator":"Michael Berkowitz and Rintze Zelle",
	"target":"http://[^/]*www.scopus.com[^/]*",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-06-04 00:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("/results/") != -1) {
		return "multiple";
	} else if (url.indexOf("/record/") != -1) {
		return "journalArticle";
	}
}

function getEID(url) {
	return url.match(/eid=([^&]+)/)[1];
}

function returnURL(eid) {
	return 'http://www.scopus.com/scopus/citation/output.url?origin=recordpage&eid=' + eid + '&src=s&view=CiteAbsKeywsRefs';
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		items = new Object();
		var boxes = doc.evaluate('//table/tbody/tr[@class]/td[@class="fldtextPad"][1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var box;
		while (box = boxes.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate('.//span[@class="txtBoldOnly"]', box, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate('.//a[@class="outwardLink"]', box, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(returnURL(getEID(i)));
		}
	} else {
		articles = [returnURL(getEID(url))];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var eid = getEID(newDoc.location.href);
		var stateKey = newDoc.evaluate('//input[@name="stateKey"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
		var get = 'http://www.scopus.com/scopus/citation/export.url';
		var post = 'origin=recordpage&sid=&src=s&stateKey=' + stateKey + '&eid=' + eid + '&sort=&exportFormat=RIS&view=CiteAbsKeyws&selectedCitationInformationItemsAll=on';
		var rislink = get + "?" + post;	
		Zotero.Utilities.HTTP.doGet(rislink, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (item.notes[0]['note']) {
					item.abstractNote = item.notes[0]['note'];
					item.notes = new Array();
					item.complete();
				}
			});
			translator.translate();
		});
	}, function() {Zotero.done();});
	Zotero.wait();
}