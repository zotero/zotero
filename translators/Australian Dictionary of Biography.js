{
	"translatorID":"0aea3026-a246-4201-a4b5-265f75b9a6a7",
	"translatorType":4,
	"label":"Australian Dictionary of Biography",
	"creator":"Tim Sherratt and Michael Berkowitz",
	"target":"http://www.adb.online.anu.edu.au",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
    if (url.match(/adbp-ent_search|browse_people|browse_authors/)) {
        return "multiple";
    } else if (url.match(/biogs\/AS*\d+b.htm/)) {
	return "bookSection";
    }
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == "x") return namespace; else return null;
		} : null;
	if (detectWeb(doc, url) == "multiple") {
		var records = new Array();
		var items = new Object();
		if (url.match(/browse_people/)) {
			var titles = doc.evaluate('//ul[@class="pb-results"]/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//ul[@class="pb-results"]/li/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (url.match(/browse_authors/)) {
			var titles = doc.evaluate('//div[@id="content"]/dl/dd', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//div[@id="content"]/dl/dd/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (url.match(/adbp-ent_search/)) {
			var titles = doc.evaluate('//div[@id="content"]/ol/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//div[@id="content"]/ol/li//a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var title;
		var link;
		while ((link = links.iterateNext()) && (title = titles.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			records.push(i);
		}
	} else {
		records = [url]; 
	}
	Zotero.Utilities.processDocuments(records, function(doc) {
		var item = new Zotero.Item("bookSection");
		var author = Zotero.Utilities.cleanString(doc.evaluate('//div[@id="content"]/p[strong="Author"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		item.title = Zotero.Utilities.cleanString(doc.evaluate('//h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var pubdetails = Zotero.Utilities.cleanString(doc.evaluate('//div[@id="content"]/p[strong="Print Publication Details"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		pubdetails = pubdetails.match(/Volume (\d+), ([\w ]+), (\d{4}), p+\.*\s+([\d-]+)/);
		item.volume = RegExp.$1;
		item.publisher = RegExp.$2;
		item.date = RegExp.$3;
		item.pages = RegExp.$4;
		item.url = doc.location.href;
		item.bookTitle = "Australian Dictionary of Biography";
		item.place = "Melbourne";
		item.repository = "Australian Dictionary of Biography";
		var tags = doc.evaluate('//li/a[starts-with(@title, "find people with the occupation")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (tag = tags.iterateNext()) {
			item.tags.push(tag.textContent);
		}
		item.attachments = [
			{url:item.url, title: "Snapshot - " + item.title, mimeType:"text/html"},
		];
		item.complete();
		
	}, function() {Zotero.done();});
}