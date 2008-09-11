{
	"translatorID":"add79dfd-7951-4c72-af1d-ce1d50aa4fb4",
	"translatorType":4,
	"label":"informIT database",
	"creator":"Adam Crymble",
	"target":"http://www.informit.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-07 14:50:00"
}

function detectWeb(doc,  url) {
	if (doc.title.match("Search Results")) {
		return "multiple";
	} else if (doc.location.href.match("topics")) {
		return "multiple";
		
	} else if (doc.location.href.match("product")) {
		return "book";
	} else if (doc.location.href.match("guides")) {
		return "book";
		
	} else if (doc.location.href.match("library")) {
		return "bookSection";
	} else if (doc.location.href.match(/articles\/article/)) {
		return "bookSection";
	}
}

//informIT database translator. Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	
	//FOR GUIDES
		if (doc.location.href.match("guides")) {
			var newItem = new Zotero.Item("book");
			newItem.title = doc.evaluate('//h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			var authors = doc.evaluate('//div[@class="titling"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
	
	//FOR ARTICLES
		if (doc.location.href.match(/articles\/article/)) {
			var newItem = new Zotero.Item("bookSection");
			
			var contents = doc.evaluate('//div[@id="articleHeader"]/ul/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var xPathCount = doc.evaluate('count (//div[@id="articleHeader"]/ul/li)', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var authors = contents.iterateNext().textContent.substr(3);
						
			if (doc.evaluate('//div[@class="relatedBook"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				newItem.bookTitle = doc.evaluate('//div[@class="relatedBook"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			}
				
			newItem.date = contents.iterateNext().textContent;
			
			var rights1;
			if (xPathCount.numberValue> 2) {
				newItem.rights = contents.iterateNext().textContent;
			}
			
			newItem.title = doc.evaluate('//h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		} else if (doc.evaluate('//ul[@class="bibliography"]/li', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {


	//FOR STORE BOOKS
		var newItem = new Zotero.Item("book");
		
		var contents = doc.evaluate('//ul[@class="bibliography"]/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var xPathCount = doc.evaluate('count (//ul[@class="bibliography"]/li)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		for (i=0; i<xPathCount.numberValue; i++) {	 	
	     		dataTags[i] = Zotero.Utilities.cleanTags(contents.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
	     	}
	
		var authors = dataTags[0].substr(3);			
	
		if (dataTags[1].match("Published")) {
			var publisherInfo = dataTags[1].substr(10);
			var date = publisherInfo.substr(0, 12);
			newItem.date = date;
			
			if (publisherInfo.match("by ")) {
				var publishCo = publisherInfo.split("by ");
				newItem.publisher = publishCo[1];
			}
		}
		var extraStuff = dataTags[2].split(/\n/);
		
		var pageCut = extraStuff[0].indexOf("Pages");
		var dimensions = extraStuff[0].substr(0, pageCut).split("Dimensions ");
		
		newItem.description = "Dimensions: " + dimensions[1];
		newItem.pages = extraStuff[0].substr(pageCut+6);
		newItem.edition = extraStuff[1].replace(/Edition\:\s| \s\s*/g, '');
		newItem.ISBN = extraStuff[2].substr(31, 18);
		newItem.title = doc.evaluate('//h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		
  	 //FOR LIBRARY BOOKS	
		} else if (doc.location.href.match("library")) {
			
			var newItem = new Zotero.Item("bookSection");
			
			newItem.title = doc.evaluate('//h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var meta = doc.evaluate('//div[@id="columnOne"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null);
			newItem.bookTitle = meta.iterateNext().textContent;
			
			var authors = meta.iterateNext().textContent.substr(3);
		}

	 //SHARED	
		var noMoreAuthor = 0;
		
		if (authors.match(" and ")) {
			authors = authors.split(" and ");
		} else if (authors.match(", ")) {
			authors = authors.split(", ");
		} else {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "author"));
			noMoreAuthor = 1;
		}
		
		if (authors.length>0 && noMoreAuthor != 1) {
			
			for (var i = 0; i < authors.length; i++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
			}
		}
	
	newItem.url = doc.location.href;
	if (newItem.publisher) newItem.publisher = Zotero.Utilities.trimInternal(newItem.publisher);
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
		var next_title;
		
	   //xPath for Topics pages, else xPaths for regular search pages.
		if (doc.location.href.match("topics")) {
			var titles = doc.evaluate('//div[@class="productList articles"]/dl/dt/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else {
			var titles = doc.evaluate('//td[3][@class="results"]/ul/li/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var chapters = doc.evaluate('//dt/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		
		if (doc.title.match("Search Results")) {
			while (next_title = chapters.iterateNext()) {
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