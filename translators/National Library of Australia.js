{
	"translatorID":"fc410e64-0252-4cd3-acb1-25e584775fa2",
	"translatorType":4,
	"label":"National Library of Australia",
	"creator":"Michael Berkowitz",
	"target":"http://librariesaustralia.nla.gov.au/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match("action=Search")) {
		return "multiple";
	} else if (url.match("action=Display")) {
		return "book";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, 'action=Display&');
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i);
		}
	} else {
		books = [url];
	}
	Zotero.Utilities.processDocuments(books, function(doc) {
		var table = doc.evaluate('//tbody/tr[td[1][@class="CellAlignRight"]/strong]', doc, ns, XPathResult.ANY_TYPE, null);
		var row;
		var data = new Object();
		while (row = table.iterateNext()) {
			var heading = doc.evaluate('./td[1]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var value = doc.evaluate('./td[2]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			data[Zotero.Utilities.trimInternal(heading)] = value;
		}
		item = new Zotero.Item("book");
		item.title = Zotero.Utilities.trimInternal(data['Title:'].match(/^[^/]+/)[0]);
		if (data['Author:']) item.creators.push(Zotero.Utilities.cleanAuthor(data['Author:'], "author", true));
		if (data['Published:'].match(/\w+/)) {
			var pub = data['Published:'].match(/^([^:]+):(.*)\s+([^\s]+)$/);
			item.location = Zotero.Utilities.trimInternal(pub[1]);
			item.publisher = Zotero.Utilities.trimInternal(pub[2]);
			item.date = Zotero.Utilities.trimInternal(pub[3].replace(/\D/g, ""));
		}
		if (data['Subjects:']) {
			var kws = data['Subjects:'].split(".");
			for each (var key in kws) {
				if (key.match(/\w+/)) item.tags.push(key);
			}
		}
		if (data['ISBN:']) item.ISBN = Zotero.Utilities.trimInternal(data['ISBN:'].match(/^[^(]+/)[0]);
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}