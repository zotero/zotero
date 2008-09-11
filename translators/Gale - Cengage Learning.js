{
	"translatorID":"4ea89035-3dc4-4ae3-b22d-726bc0d83a64",
	"translatorType":4,
	"label":"Gale - Cengage Learning",
	"creator":"Adam Crymble",
	"target":"http://www.gale.cengage.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:30:00"
}

function detectWeb(doc, url) {
	
	if (doc.evaluate('//td[3]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//div[@id="title_main"]/h2', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
	
	
	
}

//Gale Cengage Learning - Catalog translator. Code by Adam Crymble.

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	var titles1;
	
	var newItem = new Zotero.Item("book");
	
	var credits = doc.evaluate('//div[@id="credits"]/ul/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//div[@id="credits"]/ul/li)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var creditsArray = new Array();
	
	for (var i = 0; i < xPathCount.numberValue; i++) {
		creditsArray.push(credits.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));	
	}

	if (doc.evaluate('//div[@id="title_main"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		titles1 = doc.evaluate('//div[@id="title_main"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s*$/g, '');
	}
	
	if (titles1.match(/\w/) && creditsArray[0].match(/\w/)) {
		newItem.title = titles1 + ": " + creditsArray[0];
	} else if (titles1.match(/\w/) && !creditsArray[0].match(/\w/)) {
		newItem.title = titles1;
	} else {
		newItem.title = "No Title Found."
	}
	
	for (var i = 1; i < creditsArray.length; i++) {
		
		if (creditsArray[i].match("Author ")) {
			var author = creditsArray[i].split("Author ");
			author = author[1];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		} else if (creditsArray[i].match("Published by ")) {
			var  publisher1 = creditsArray[i].split("Published by ");
			newItem.publisher = publisher1[1];
		} else if (creditsArray[i].match("Volume")) {
			var volume1 = creditsArray[i].split("Volume");
			newItem.volume = volume1[1];
		}
		
	}
	
	if (doc.evaluate('//div[@id="description"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = doc.evaluate('//div[@id="description"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	var pageContents = doc.evaluate('//div[@id="detail"]/ul/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var allContents = new Array();
	var contents;
	var fieldTitle;
	
	while (contents = pageContents.iterateNext()) {
		allContents.push(contents.textContent);
	}
	
	for (i=0; i<allContents.length; i++) {	 	
		if  (allContents[i].match(":")) {
			contents = allContents[i].split(":");
			fieldTitle = contents[0].replace(/\s*/g, '');
			dataTags[fieldTitle] = contents[1];
		}
     	}

	associateData (newItem, dataTags, "ISBN10", "ISBN");
	if (dataTags["ISBN13"]) {
		newItem.extra = "ISBN 13: " + dataTags["ISBN13"];
	}
	associateData (newItem, dataTags, "Published/Released", "date");

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

		var titles = doc.evaluate('//td[3]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);

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
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}