{
	"translatorID":"dd149efc-7f0e-43e4-b3df-b6d15e171717",
	"translatorType":4,
	"label":"Persée",
	"creator":"Adam Crymble",
	"target":"http://www.persee.fr",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-15 19:40:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("search") && doc.evaluate('//div[@id="searchResults"]/div[@class="oneResult"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.location.href.match("article")) {
		return "journalArticle";
	}
}

//Persee Translator. Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("journalArticle");

	newItem.url = doc.location.href;
	newItem.title = doc.evaluate('//div[@class="oneResult"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s+$/g, '');

	//various journal info
	if (doc.title.match(", ")) {
		var contents = doc.title.split(", ");
			newItem.publicationTitle = contents[0].substr(9);
		for (var i = 1; i < contents.length; i++) {
			if (contents[i].match("Year ")) {
				newItem.date = contents[i].substr(5);
			} else if (contents[i].match("Volume ")) {
				newItem.volume = contents[i].substr(7);
			} else if (contents[i].match("Issue ")) {
				newItem.issue = contents[i].substr(6);
			} else if (contents[i].match("pp. ")) {
				newItem.pages = contents[i].substr(4);
			}
		}
	}
	
	//authors
	var getAuthors = doc.evaluate('//div[@class="oneResult"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s+$/g, '');
	var chopAuthors1 = getAuthors.indexOf(newItem.title) + newItem.title.length;
	var chopAuthors2 = getAuthors.indexOf(newItem.publicationTitle);
	
	var authors = getAuthors.substr(chopAuthors1, chopAuthors2-chopAuthors1);
	if (authors.match(", ")) {
		authors = authors.split(", ");
		for (var i in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));	
		}
	} else {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "author"));	
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc,url) == "journalArticle") {
		articles = [url];
		
	} else if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		var titles = doc.evaluate('//div[@id="searchResults"]/div[@class="oneResult"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		var titlesArray = new Array();
		var linksArray = new Array();
		
		 while (next_title = titles.iterateNext()) {
			 titlesArray.push(next_title.textContent.replace(/^\s*|\s+$/g, ''));
			 linksArray.push(next_title.href);
		 }
	
		for (var i = 0; i < titlesArray.length; i++) {
			
			if (linksArray[i].match("article")) {
				items[linksArray[i]] = titlesArray[i];
			}
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}