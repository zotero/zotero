{
	"translatorID":"b33af0e1-d122-45b2-b144-4b4eedd12d5d",
	"translatorType":4,
	"label":"Wildlife Biology in Practice",
	"creator":"Michael Berkowitz",
	"target":"http://www.socpvs.org/journals/index.php/wbp",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/showToc/) || url.match(/advancedResults/)) {
		return "multiple";
	} else if (url.match(/article/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//tr[td/a[2]]';
		if (url.match(/issue/)) {
			var linkx = './td[2]/a[1]';
			var titlex = './td[1]';
		} else if (url.match(/advanced/)) {
			var linkx = './td[3]/a[1]';
			var titlex = './td[2]';
		}
		var results = doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = doc.evaluate(titlex, result, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, result, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = Zotero.Utilities.trimInternal(title);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i.replace(/view/, "viewArticle"));
		}
	} else {
		arts = [url.replace(/viewRST/, "viewArticle")];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		var voliss = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="main"]/h2', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		voliss = voliss.match(/^([^,]+),\s+([^;]+);\s+(\d+)\((\d+)\);\s+([^;]+)/);
		item.journalAbbreviation = voliss[1];
		item.date = voliss[2];
		item.issue = voliss[3];
		item.volume = voliss[4];
		item.pages = voliss[5];
		var authors = doc.evaluate('//div[@id="authorDetails"]/ul[@class="lista"]/li/strong/a', doc, ns, XPathResult.ANY_TYPE, null);
		var author;
		while (author = authors.iterateNext()) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author.title.match(/^\w+\b\s+(.*)\s+\b\w+$/)[1], "author"));
		}
		item.publicationTitle = "Wildlife Biology in Practice";
		item.ISSN = "1646-2742";
		item.DOI = doc.evaluate('//div[@id="copyArticle"]/a[1]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/doi:\s+([^\s]+)/)[1];
		item.url = doc.location.href;
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="content"]/h3', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="abstract"]/blockquote/p', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.tags = doc.evaluate('//div[@id="abstract"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/Keywords:\s+([^\.]+)/)[1].split(/,\s+/);
		
		var pdfurl = doc.evaluate('//div[@id="rt"]/a[@class="action noarrow"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:item.publicationTitle + " PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}