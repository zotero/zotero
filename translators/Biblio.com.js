{
	"translatorID":"9932d1a7-cc6d-4d83-8462-8f6658b13dc0",
	"translatorType":4,
	"label":"Biblio.com",
	"creator":"Adam Crymble and Michael Berkowitz",
	"target":"http://www.biblio.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-07 14:50:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("bookseller_search") || doc.location.href.match("bookstores") || doc.location.href.match("textbooks")) {
		
	} else if (doc.location.href.match("search")) {
		return "multiple";
	} else if (doc.location.href.match("books")) {
		return "book";
	}
}

//Biblio.com translator. Code by Adam Crymble.

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
	var contents = new Array();
	var multiAuthors = new Array();
	var fieldTitle;
	var author1;
	
	var newItem = new Zotero.Item("book");

	var content = doc.evaluate('//div[@class="smalltext1"][@id="infobox"]/ul/li', doc, nsResolver, XPathResult.ANY_TYPE,  null);
	var xPathCount = doc.evaluate('count (//div[@class="smalltext1"][@id="infobox"]/ul/li)', doc, nsResolver, XPathResult.ANY_TYPE,  null);
	
	for (i=0; i<xPathCount.numberValue; i++) {	 	
     			
     		contents = content.iterateNext().textContent.split(": ");
     		fieldTitle = contents[0].replace(/\s*/g, '');
     		dataTags[fieldTitle] = contents[1].replace(/^\s*|\s*$/g, '');
     	}

	//Authors
	if (doc.evaluate('//td[2]/h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var authors = doc.evaluate('//td[2]/h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		if (authors.match(/\w/)) {
			if (authors.match(/^ by/)) {
				authors = authors.substr(4);
				if (authors.match(/;/)) {
					multiAuthors = authors.split(";");
					Zotero.debug(multiAuthors);
					for each (var aut in multiAuthors) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(aut, "author", true));
					}
				} else {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "author", true));
				}
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "author"));
			}
		}
		
	}
	
	//extra
	if (dataTags["Quantityavailable"]) {
		newItem.extra = "Quantity Available: " + dataTags["Quantityavailable"];
	}

	associateData (newItem, dataTags, "Publisher", "publisher");
	associateData (newItem, dataTags, "Place", "place");
	associateData (newItem, dataTags, "Datepublished", "date");
	associateData (newItem, dataTags, "ISBN10", "ISBN");
	associateData (newItem, dataTags, "ISBN13", "ISBN");
	associateData (newItem, dataTags, "Pages", "pages");
	associateData (newItem, dataTags, "Edition", "edition");

	newItem.title = doc.evaluate('//tbody/tr[1]/td[2]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s&+/g, '');
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
		
		var titles = doc.evaluate('//table[@class="search-result"]/tbody/tr/td[2]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.textContent.match(/\w/)) {
				items[next_title.href] = next_title.textContent;
			}
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