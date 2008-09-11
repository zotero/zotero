{
	"translatorID":"675306d2-fca9-466f-b33d-1e3cc1bfd091",
	"translatorType":4,
	"label":"Universiteit van Amsterdam",
	"creator":"Michael Berkowitz",
	"target":"http://opc.uva.nl:8080/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-18 08:55:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td[3][@class="hit"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.match("results/titledata")) {
		return "book";
	}
}

function scrape(item, langTags, data) {
	for (var tag in data) {
		tag = tag.toLowerCase();
		if (langTags[tag] == "creators") {
			var authors = data[tag].split(",");
			for each (var aut in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(aut), "author"));
			}
		} else if (langTags[tag] == "tags") {
			var kws = data[tag].split(/(,|;)/);
			for each (var key in kws) {
				if (key.match(/\w+/)) item.tags.push(Zotero.Utilities.trimInternal(key));
			}
		} else if (langTags[tag] == "publisher") {
			var pub = data[tag].split(/\s*:\s*/);
			item.place = pub[0];
			item.publisher = pub[1];
		} else {
			item[langTags[tag]] = data[tag];
		}
	}
}

var tagsEN = {
	"title":"title",
	"author(s)":"creators",
	"publisher":"publisher",
	"year":"date",
	"isbn":"ISBN",
	"subject headings":"tags",
	"subject heading person":"tags",
	"call number":"callNumber"
}

var tagsNE = {
	"titel":"title",
	"auteur(s)":"creators",
	"uitgever":"publisher",
	"jaar":"date",
	"isbn":"ISBN",
	"trefwoorden":"tags",
	"trefwoord persoon":"tags",
	"plaatsnummer":"callNumber"
}

function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//td[3][@class="hit"]/a', doc, null, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			items[link.href] = Zotero.Utilities.trimInternal(link.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i);
		}
	} else {
		books = [url];
	}
	Zotero.Utilities.processDocuments(books, function(newDoc) {
		var data = new Object();
		var box = newDoc.evaluate('//table/tbody/tr[1]/td[2]/table/tbody/tr', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext();
		var tags = newDoc.evaluate('//table/tbody/tr[1]/td[2]/table/tbody/tr/td[1]', newDoc, null, XPathResult.ANY_TYPE, null);
		var values = newDoc.evaluate('//table/tbody/tr[1]/td[2]/table/tbody/tr/td[2]', newDoc, null, XPathResult.ANY_TYPE, null);
		var tag;
		var value;
		while ((tag = tags.iterateNext()) && (value = values.iterateNext())) {
			tag = Zotero.Utilities.trimInternal(tag.textContent).replace(/:/, "").toLowerCase();
			if (tagsEN[tag] || tagsNE[tag]) {
				data[tag] = Zotero.Utilities.trimInternal(value.textContent);
			}
		}
		item = new Zotero.Item("book");
		var lingTags = new Array();
		if (data['titel']) {
			lingTags = tagsNE;
		} if (data['title']) {
			lingTags = tagsEN;
		}
		scrape(item, lingTags, data);
		item.complete();
	}, function() {Zotero.done;});
}