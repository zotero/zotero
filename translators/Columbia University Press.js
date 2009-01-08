{
	"translatorID":"a75e0594-a9e8-466e-9ce8-c10560ea59fd",
	"translatorType":4,
	"label":"Columbia University Press",
	"creator":"Michael Berkowitz",
	"target":"http://www.cup.columbia.edu/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/book\//)) {
		return "book";
	} else if (doc.evaluate('//p[@class="header"]/a/span[@class="_booktitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

function addTag(item, tag, xpath) {
	item[tag] = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//p[@class="header"]/a', doc, ns, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i);
		}
	} else {
		books = [url];
	}
	Zotero.Utilities.processDocuments(books, function(doc) {
		var item = new Zotero.Item("book");
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//h1[@id="_booktitle"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.trimInternal(doc.evaluate('//p[@id="_authors"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (authors.match(/Edited/)) {
			authors = Zotero.Utilities.trimInternal(authors.replace("Edited by", ""));
			var autType = "editor";
		} else {
			var autType = "author";
		}
		var auts = authors.split(/,|\band\b/);
		for each (var aut in auts) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, autType));
		}
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//p[@id="_desc"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.date = Zotero.Utilities.trimInternal(doc.evaluate('//span[@id="_publishDate"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.ISBN = Zotero.Utilities.trimInternal(doc.evaluate('//span[@id="_isbn"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.publisher = Zotero.Utilities.trimInternal(doc.evaluate('//span[@id="_publisher"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}