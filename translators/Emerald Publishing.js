{
	"translatorID":"79f6f9ed-537a-4d4f-8270-c4fbaafdf327",
	"translatorType":4,
	"label":"Emerald Publishing",
	"creator":"Michael Berkowitz",
	"target":"www.emeraldinsight.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-05 07:45:00"
}

function detectWeb(doc, url) {
	if (url.match('searchQuickOptions.do')) {
		return "multiple"
	} else if (url.match('viewContentItem')) {
		return "journalArticle";
	}
}

var tags  = {
	journal:"publicationTitle",
	year:"date",
	volume:"volume",
	issue:"issue",
	page:"pages",
	doi:"DOI",
//	publisher:"repository",
	'article url':"url",
	abstract:"abstractNote"
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//td[3][@class="resultTd"]/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			items[link.href] = link.textContent;
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
		item.title = Zotero.Utilities.trimInternal(doc.title.split('-')[1]);
		
		var data = new Object();
		var values = doc.evaluate('//div[@class="browseBoxGreen"]/div[@class="toc"]/p[@class="inline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fields = doc.evaluate('//div[@class="browseBoxGreen"]/div[@class="toc"]/h3', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var value;
		var field;
		while ((field = fields.iterateNext()) && (value = values.iterateNext())) {
			data[Zotero.Utilities.trimInternal(field.textContent.toLowerCase()).replace(':', '')] = value.textContent;
		}
		var values = doc.evaluate('//div[@id="centerLeft"]/p[@class="inline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fields = doc.evaluate('//div[@id="centerLeft"]/h3[@class="inline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while ((field = fields.iterateNext()) && (value = values.iterateNext())) {
			data[Zotero.Utilities.trimInternal(field.textContent.toLowerCase()).replace(':', '')] = value.textContent;
		}
		for (var tag in data) {
			if (tags[tag]) item[tags[tag]] = Zotero.Utilities.trimInternal(data[tag]);
		}
		item.attachments = [{url:item.url, title:"Emerald Insight Snapshot", mimeType:"text/html"}];
		item.tags = Zotero.Utilities.trimInternal(data['keywords']).split(/,\s+/);
		var authors = data['author(s)'].split(/,\s+/);
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}