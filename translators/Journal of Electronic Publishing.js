{
	"translatorID":"d93c14fb-d327-4540-b60a-327309ea512b",
	"translatorType":4,
	"label":"Journal of Electronic Publishing",
	"creator":"Michael Berkowitz",
	"target":"http://quod.lib.umich.edu/.*c=jep",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div/span[text() = "Search Results"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/\d+\.\d+\.\d+/)) {
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
		var links = doc.evaluate('//div[@id="resultslist"]/div[@class="itemcitation"]/div/a', doc, ns, XPathResult.ANY_TYPE, null);
		var link;
		var items = new Object();
		while (link = links.iterateNext()) {
			items[link.href] = Zotero.Utilities.trimInternal(link.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var data = new Object();
		var rows = doc.evaluate('//table[@id="itemmdataTable"]//tr', doc, ns, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var header = doc.evaluate('./td[1]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var value = doc.evaluate('./td[2]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			data[Zotero.Utilities.trimInternal(header.replace(":", "").replace("Authors", "Author"))] = value;
		}
		var item = new Zotero.Item("journalArticle");
		item.publicationTitle = "Journal of Electronic Publishing";
		item.title = data["Title"];
		var authors = data["Author"].split(",");
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		item.url = data["URL"];
		var voliss = data["Source"].match(/vol\.\s+([^,]+),\s+no\.\s+([^,]+),\s+(.*)$/);
		item.volume = voliss[1];
		item.issue = voliss[2];
		item.date = voliss[3];
		
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}