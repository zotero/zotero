{
	"translatorID":"2a5dc3ed-ee5e-4bfb-baad-36ae007e40ce",
	"translatorType":4,
	"label":"Berkeley Electronic Press",
	"creator":"Michael Berkowitz",
	"target":"http://www.bepress.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match("cgi/query.cgi")) {
		return "multiple";
	} else if (url.match(/vol[\d+]\/iss[\d]+/)) {
		return "journalArticle";
	}
}

var tagMap = {
	journal_title:"publicationTitle",
	title:"title",
	date:"date",
	volume:"volume",
	issue:"issue",
	abstract_html_url:"url",
	doi:"DOI"
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//table[@id="query"]/tbody/tr/td[4]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var metatags = new Object();
		var metas = newDoc.evaluate('//meta[contains(@name, "bepress_citation")]', newDoc, null, XPathResult.ANY_TYPE, null);
		var next_meta;
		while (next_meta = metas.iterateNext()) {
			metatags[next_meta.name.replace("bepress_citation_", "")] = next_meta.content;
		}
		var item = new Zotero.Item("journalArticle");
		
		//regularly mapped tags
		for (var tag in tagMap) {
			if (metatags[tag]) {
				item[tagMap[tag]] = metatags[tag];
			}
		}
		
		//authors
		var authors = metatags['authors'].split(";");
		for each (var author in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		
		//attachments
		item.attachments = [
			{url:item.url, title:item.title, mimeType:"text/html"},
			{url:metatags['pdf_url'], title:"Berkeley Electronic Press Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}