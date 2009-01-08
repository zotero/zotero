{
	"translatorID":"4363275e-5cc5-4627-9a7f-951fb58a02c3",
	"translatorType":4,
	"label":"Cornell University Press",
	"creator":"Michael Berkowitz",
	"target":"http://www.cornellpress.cornell.edu/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match("detail.taf")) {
		return "book";
	} else if (url.match("list.taf") || url.match("listsearch.taf")) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function (prefix) {
	    if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//tr/td[2]/a', doc, ns, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			if (title.textContent.match(/\w+/)) items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
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
		item.title = Zotero.Utilities.capitalizeTitle(doc.evaluate('//span[@class="bktitle"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = doc.evaluate('//div[@id="detail"]/table/tbody/tr/td/form/a', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/;/);
		Zotero.debug(authors);
		for each (var aut in authors) {
			if (aut.match(/Translator/)) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut.match(/^(.*)\s+\(/)[1], "translator"));
			} else if (aut.match(/Editor/)) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut.match(/^(.*)\s+\(/)[1], "editor"));
			} else {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
		}
		var bits = doc.evaluate('//div[@id="detail"]/table/tbody/tr/td/form', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.ISBN = bits.match(/ISBN:\s+([\d\-]+)/)[1];
		item.date = bits.match(/\d{4}/)[0];
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="description"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}