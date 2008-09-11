{
	"translatorID":"095239e7-c18c-4f45-a932-bcf4a9e48c08",
	"translatorType":4,
	"label":"Probing the Past",
	"creator":"Adam Crymble",
	"target":"http://chnm.gmu.edu/probateinventory/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-11 20:40:00"
}

function detectWeb(doc, url) {
	
	if (doc.evaluate('//td/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.location.href.match("document")) {
		return "book";
	}
	
}

//Probing the Past translator; Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	
	var newItem = new Zotero.Item("book");

	var title = doc.evaluate('//h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
	var author = title.split(", ");
	author = author[1] + " " + author[0];
	newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));

	newItem.title = "Probate of " + author;

	var citation = doc.evaluate('//table[@id="browseinfo"]', doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
	var citation = citation.split(": ");
	citation[1] = citation[1].replace("County/City", '');
	
	
	citation[2] = citation[2].replace("State", '');
	for (var i = 0; i < citation.length; i++) {
		citation[i] = citation[i].replace(/^\s*|\s*$/g, '');
	}
	Zotero.debug(citation);

	newItem.date = citation[1];
	newItem.place = citation[2] + ", " + citation[3];

	newItem.url = doc.location.href;

	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();

		var titles = doc.evaluate('//td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titlesCount = doc.evaluate('count (//td/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_date;
		var next_title;
		var next_town;
		
		for (var i = 0; i < titlesCount.numberValue/3; i++) {
		
			next_date = titles.iterateNext();
			next_title = titles.iterateNext();

			items[next_title.href] = next_title.textContent;
			
			next_town = titles.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}