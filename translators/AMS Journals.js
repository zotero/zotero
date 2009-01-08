{
	"translatorID":"bdaac15c-b0ee-453f-9f1d-f35d00c7a994",
	"translatorType":4,
	"label":"AMS Journals",
	"creator":"Michael Berkowitz",
	"target":"http://www.ams.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/jour(nals|search)/)) {
		return "multiple";
	} else if (url.match(/\d{4}\-\d{2}\-\d{2}/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (url.match(/joursearch/)) {
			var titlex = '//table/tbody/tr/td/span[@class="searchResultsArticleTitle"]';
			var linkx = '//table/tbody/tr[td/span[@class="searchResultsArticleTitle"]]//a[contains(text(), "Abstract")]';
		} else {
			var titlex = '//div[@class="contentList"]/dl/dt[@class="articleTitleInAbstract"]';
			var linkx = '//div[@class="contentList"]/dl/dd/a[contains(text(), "Abstract")]'
		}
		var titles = doc.evaluate(titlex, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate(linkx, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title, link;
		while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(decodeURIComponent(i));
		}
	} else {
		articles = [url];
	}
	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.publicationTitle = doc.title;
		item.ISSN = doc.evaluate('//span[@class="journalISSN"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/\(e\)\s+ISSN:?\s+(.*)\(p\)/)[1];
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="articleTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var data = Zotero.Utilities.trimInternal(doc.evaluate('//p[span[@class="bibDataTag"]][1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		data = data.replace(/(Journal|MSC|Posted|Retrieve)/g, "\n$1");
		Zotero.debug(data);
		var authors = data.match(/Author\(s\):\s+(.*)\n/)[1].split(/;\s+/);
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		var journalinfo = data.match(/Journal:\s+(.*)\n/)[1].match(/^([^\d]+)(\d+)\s+\((\d+)\),\s+(.*)$/);
		item.journalAbbreviation = journalinfo[1];
		item.volume = journalinfo[2];
		item.pages = journalinfo[4];
		item.date = Zotero.Utilities.trimInternal(data.match(/Posted:\s+(.*)\n/)[1]);
		item.url = doc.location.href;
		item.issue = item.url.match(/(\d+)\/S/)[1];
		var pdfurl = item.url.replace(/([^/]+)\/home.html$/, "$1/$1.pdf");
		item.attachments = [
			{url:item.url, title:item.journalAbbreviation + " Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:item.journalAbbreviation + " PDF", mimeType:"application/pdf"}
		];
		item.abstract = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="bottomCell"]/p[4]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(10));
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}