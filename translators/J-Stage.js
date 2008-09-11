{
	"translatorID":"e40a27bc-0eef-4c50-b78b-37274808d7d2",
	"translatorType":4,
	"label":"J-Stage",
	"creator":"Michael Berkowitz",
	"target":"http://www.jstage.jst.go.jp/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-06 08:45:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//a[contains(@href, "_ris")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	} else if (doc.evaluate('//tr/td[2]/table/tbody/tr/td/table/tbody/tr[td[2]//a]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
		doc.evaluate('//tr/td/table/tbody/tr/td/table/tbody/tr[td[1]//a]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}


function RISify(str) {
	return str.replace("_article", "_ris").replace("article", "download");
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath;
		var titlex;
		var linkx;
		if (doc.evaluate('//tr/td[2]/table/tbody/tr/td/table/tbody/tr[td[2]//a]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '//tr/td[2]/table/tbody/tr/td/table/tbody/tr[td[2]//a]';
			titlex = './td[2]//strong';
			linkx = './td[2]//a[1]';
		} else if (doc.evaluate('//tr/td/table/tbody/tr/td/table/tbody/tr[td[1]//a]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '/html/body/div/table/tbody/tr/td/table/tbody/tr/td/table/tbody/tr[td//a[contains(@href, "_pdf")]]';
			titlex = './/td/b';
			linkx = './/td/a[contains(@href, "_article")]';
		}
		Zotero.debug(xpath);
		
		var list = doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null);
		var nextitem;
		while (nextitem = list.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(titlex, nextitem, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate(linkx, nextitem, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(RISify(i));
		}
	} else {
		arts = [RISify(url)];
	}
	Zotero.debug(arts);
	for each (var uri in arts) {
		Zotero.Utilities.HTTP.doGet(uri, function(text) {
			Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = uri.replace("download", "article").replace("_ris", "_article");
				var pdfurl = item.url.replace(/(\d+)_(\d+)\/_article/, "$2/_pdf").replace("download", "article");
				Zotero.debug(pdfurl);
				item.attachments = [
					{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:item.publicationTitle + " PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
		});
	}
}