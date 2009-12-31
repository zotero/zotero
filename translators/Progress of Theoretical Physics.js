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
	"lastUpdated":"2009-12-31 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.title.match(/search result/) || doc.title.match(/Table of Contents/)) {
		return "multiple";
	} else if (url.match(/getarticle\?/) || url.match(/link\?/)) {
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
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//h2[@class="title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (doc.evaluate('//h2[@class="subtitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			item.title = item.title + ": " + Zotero.Utilities.trimInternal(doc.evaluate('//h2[@class="subtitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="abstract"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = doc.evaluate("//p[@class='author']/a", doc, null, XPathResult.ANY_TYPE, null);
		var aut;
		while(aut = authors.iterateNext()) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut.textContent, "author"));
		}
		var info = Zotero.Utilities.trimInternal(doc.evaluate('//h4[@class="info"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (m = info.match(/Vol\.\s+(\d+)\s+No\.\s+(\d+)\s+\((\d+)\)\s+pp\.\s+([\d-]+)\s+URL\s+:\s+(.*)\s+DOI\s+:\s+(.*)$/)){
			item.ISSN = '0033-068X';
			item.publicationTitle = "Progress of Theoretical Physics";
			item.journalAbbreviation = "Prog. Theor. Phys.";
			item.volume = m[1];
			item.issue = m[2];
			item.date = m[3];
			item.pages = m[4];
			item.url = m[5];
			item.DOI = m[6];
		} else if (m = info.match(/Supplement\s+No\.\s+(\d+)\s+\((\d+)\)\s+pp\.\s+([\d-]+)\s+URL\s+:\s+(.*)\s+DOI\s+:\s+(.*)$/)){
			item.ISSN = '0375-9687';
			item.publicationTitle = "Progress of Theoretical Physics Supplement";
			item.journalAbbreviation = "Prog. Theor. Phys. Suppl.";
			item.volume = m[1];
			item.date = m[2];
			item.pages = m[3];
			item.url = m[4];
			item.DOI = m[5];
		}
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:"PTP Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"PTP Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}