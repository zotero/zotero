{
	"translatorID":"0b356cb6-7fa1-4662-b6e8-7ffc9ca2cd4a",
	"translatorType":4,
	"label":"Progress of Theoretical Physics",
	"creator":"Michael Berkowitz",
	"target":"http://ptp.ipap.jp/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.title.match(/search result/) || doc.title.match(/Table of Contents/)) {
		return "multiple";
	} else if (url.match(/getarticle\?/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.toLowerCase().match(/search result/)) {
			var titles = doc.evaluate('/html/body//li//b', doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('/html/body//li/a', doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
			}
		} else if (doc.title.toLowerCase().match(/table of contents/)) {
			var xpath = doc.evaluate('/html/body/ul/li/a', doc, null, XPathResult.ANY_TYPE, null);
			var text;
			while (text = xpath.iterateNext()) {
				items[text.href] = Zotero.Utilities.trimInternal(text.textContent);
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.ISSN = '0033-068X';
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//h2[@class="title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (doc.evaluate('//h2[@class="subtitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			item.title = item.title + ": " + Zotero.Utilities.trimInternal(doc.evaluate('//h2[@class="subtitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="abstract"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.unescapeHTML(Zotero.Utilities.trimInternal(doc.evaluate('/html/body/p[@class="author"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent));
		authors = authors.replace(/[*()]+/g, "").split(/(,\s+|\band\b)/);
		for each (var aut in authors) {
			if (!aut.match(/(,|and)/)) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
		}
		var info = Zotero.Utilities.trimInternal(doc.evaluate('//h4[@class="info"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		info = info.match(/Vol\.\s+(\d+)\s+No\.\s+(\d+)\s+\((\d+)\)\s+pp\.\s+([\d-]+)\s+URL\s+:\s+(.*)\s+DOI\s+:\s+(.*)$/);
		item.volume = info[1];
		item.issue = info[2];
		item.date = info[3];
		item.pages = info[4];
		item.url = info[5];
		item.DOI = info[6];
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:"PTP Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"PTP Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}