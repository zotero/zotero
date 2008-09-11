{
	"translatorID":"2cd7d362-5fba-423a-887f-579ed343e751",
	"translatorType":4,
	"label":"The Microfinance Gateway",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?microfinancegateway.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-06 08:15:00"
}

function detectWeb(doc, url) {
	if (url.match(/results\.php/) || url.match(/search/)) {
		return "multiple";
	} else if (url.match(/content\/article/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var ns = doc.documentElement.namespaceURI;
	var nsResolver = ns ? function (prefix) {
		if (prefix == 'x') return ns; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, "content/article/detail");
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[2][@class="main_content_box"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="source"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(/(\.,|&)/);
		for each (var aut in authors) {
			if (aut.match(/\w+/)) {
				item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(aut), "author", true));
			}
		}
		item.url = doc.location.href;
		item.date = Zotero.Utilities.trimInternal(doc.evaluate('//span[@class="date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//span[@class="summary"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var pdfurl = doc.evaluate('//div[@class="articleTopics"]/div/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.publicationTitle = doc.evaluate('//div[@class="articleTopics"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/Published\s+by:\s+(.*)\n/)[1];
		item.attachments = [
			{url:item.url, title:item.title + " Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:item.title + " PDF", mimeType:"application/pdf"}
		];
		
		item.complete();
	}, function() {Zotero.done;});
}