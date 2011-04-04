{
	"translatorID":"9e306d5d-193f-44ae-9dd6-ace63bf47689",
	"translatorType":4,
	"label":"IngentaConnect",
	"creator":"Michael Berkowitz",
	"target":"^https?://(www\\.)?ingentaconnect\\.com",
	"minVersion":"1.0.0b3r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2011-04-03 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("article?") != -1 || url.indexOf("article;") != -1 || url.indexOf("/art") != -1) {
		return "journalArticle";
	} else if (url.indexOf("search?") !=-1 || url.indexOf("search;") != -1) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var artlink = '//div//p/strong/a';
		var links = doc.evaluate(artlink, doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = next_link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var abs, pdf;
		var risurl = newDoc.evaluate('//div[contains(@class,"export-formats")]/ul/li/a[@title="EndNote Export"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		if (newDoc.evaluate('//div[@id="abstract"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			abs = Zotero.Utilities.trimInternal(newDoc.evaluate('//div[@id="abstract"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(10);
		}
		if (newDoc.evaluate('//div[@id="purchaseexpand"]//a[contains(@title,"download")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			pdf = newDoc.evaluate('//div[@id="purchaseexpand"]//a[contains(@title,"download")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		}
		if (newDoc.evaluate('//div[@id="info"]/p[1]/a', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var keywords = newDoc.evaluate('//div[@id="info"]/p[1]/a', newDoc, null, XPathResult.ANY_TYPE, null);
			var key;
			var keys = new Array();
			while (key = keywords.iterateNext()) {
				keys.push(Zotero.Utilities.capitalizeTitle(key.textContent, true));
			}
		}
		Zotero.Utilities.HTTP.doGet(risurl, function(text) {
			// fix spacing per spec
			text = text.replace(/([A-Z0-9]{2})  ?-/g,"$1  -");
			Zotero.debug(text);
			text = text.replace(/(PY\s+\-\s+)\/+/, "$1");
			text = text.replace(/ER\s\s\-/, "") + "\nER  - ";
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (abs) item.abstractNote = abs;
				if (pdf) item.attachments.push({url:pdf, title:"IngentaConnect Full Text PDF", mimeType:"application/pdf"});
				// Note that the RIS translator gives us a link to the record already
				item.url = null;
				if (keys) item.tags = keys;
				if (item.DOI) {
					if (item.DOI.match(/^doi:/)) {
						item.DOI = item.DOI.substr(4);
					}
				}
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done();});
}
