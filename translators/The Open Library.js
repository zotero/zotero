{
	"translatorID":"96b54986-16c7-45ea-b296-fde962d658b2",
	"translatorType":4,
	"label":"The Open Library",
	"creator":"Adam Crymble",
	"target":"http://openlibrary.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:30:00"
}

function detectWeb(doc, url) {
	
	if (doc.location.href.match("search")) {
		return "multiple";
	} else if (doc.evaluate('//div[@class="title-pad"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
	
}

//Open Library Translator. Code by Adam Crymble

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
	var tagsContent = new Array();
	var fieldTitle;
	
	var newItem = new Zotero.Item("book");

	newItem.title = doc.evaluate('//div[@class="title-pad"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
	if (doc.evaluate('//div[@id="header"]/div[@class="subtitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = doc.evaluate('//div[@id="header"]/div[@class="subtitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	var m = 0;
	if (doc.evaluate('//div[@id="statement"]/span[@class="book-details-italic"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var publisher = doc.evaluate('//div[@id="statement"]/span[@class="book-details-italic"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		var publisher1 = publisher.split(/\n/);
		for (var i= 0; i < publisher1.length; i++) {
			publisher1[i] = publisher1[i].replace(/^\s*|\s+$/g, '');
			if  (publisher1[i].match("Published in ")) {
				newItem.date = publisher1[i].substr(13, publisher1[i].length-3);
				m = i+1;
			} else if (publisher1[i].match(/\(/)) {
				newItem.place = publisher1[i];
			}
		}

		if (m > 0) {
			newItem.publisher = publisher1[m];
		}
	}

	var headers = doc.evaluate('//td[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//td[1])', doc, nsResolver, XPathResult.ANY_TYPE, null);

	for (i=0; i<xPathCount.numberValue; i++) {	 	
     		fieldTitle = headers.iterateNext().textContent.replace(/\s+/g, '');
     		dataTags[fieldTitle] = Zotero.Utilities.cleanTags(contents.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
     	}

	//author
     	if (doc.evaluate('//div[@id="statement"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
     		var author = doc.evaluate('//div[@id="statement"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
     		
     		var author = author.split(/\n/);
     		for (var i in author) {
	     		author[i] = author[i].replace(/^\s*|\s*$/g, '');
	     		if (author[i].match(/^by/)) {
		     		author = author[i].substr(3);
		     		
		     		if (author.match(", ")) {
			     		if (author.match(/\s/)) {
				     		var wordcount = author.split(/\s/);

				     		if (wordcount.length > 3) {
					     	
					     		var words = author.split(", ");
					     		for (var k in words) {
						     		newItem.creators.push(Zotero.Utilities.cleanAuthor(words[k], "author"));	
					     		}
					 
				     		} else {
				
					     		var words = author.split(", ");
					     		author = words[1] + " " + words[0];
		  					newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		  					break;
		  				}
  					}
		     		} else {
			     		
		     			newItem.creators.push({lastName: author, creatorType: "creator"});
		     			break;
		     		}
	     		}
     		}
     	}
     	
	var m = 0;
	if (dataTags["Subject:"]) {
		if (dataTags["Subject:"].match(/\n/)) {
			tagsContent = dataTags["Subject:"].split(/\n/);
			for (var i = 0; i < tagsContent.length; i++) {
	     			if (tagsContent[i].match(/\w/)) {
		     			newItem.tags[m] = tagsContent[i];
		     			m++;
	     			}
     			}
		} else {
			newItem.tags = dataTags["Subject:"];
		}
	}

	if (dataTags["ISBN13:"]) {
		newItem.extra = "ISBN 13: " + dataTags["ISBN13:"];
	}
	
	associateData (newItem, dataTags, "Language:", "language");
	associateData (newItem, dataTags, "ISBN10:", "ISBN");
	associateData (newItem, dataTags, "Series:", "series");
	associateData (newItem, dataTags, "Edition:", "edition");
	associateData (newItem, dataTags, "Pagination:", "pages");

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
		
		var titles = doc.evaluate('//td[2][@class="result-text"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
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