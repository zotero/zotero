{
	"translatorID":"a29d22b3-c2e4-4cc0-ace4-6c2326144332",
	"translatorType":4,
	"label":"CABI - CAB Abstracts",
	"creator":"Adam Crymble",
	"target":"http://www.cabi.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-29 21:10:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div/table/tbody/tr[1]/td/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//span[@class="PageSubTitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

//CAB Abstracts translator. Code by Adam Crymble
//only designed for "book" entries. People, projects, sites, etc are ignored by Zotero.

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("book");

//authors
	if (doc.evaluate('//td[@class="smallwebtext"]/table/tbody/tr/td[1]/span[@class="MenuBar"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xPathAuthors = doc.evaluate('//td[@class="smallwebtext"]/table/tbody/tr/td[1]/span[@class="MenuBar"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var xPath1Count = doc.evaluate('count (//td[@class="smallwebtext"]/table/tbody/tr/td[1]/span[@class="MenuBar"])', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var nameTest = 0;
	
		for (var j = 0; j < xPath1Count.numberValue; j++) {
			authors = xPathAuthors.iterateNext().textContent
			if (authors.match("by ")) {
				var shortenAuthor = authors.indexOf("by ")+3;
				
				authors = authors.substr(shortenAuthor).split("; ");
			
				for (var i = 0; i < authors.length; i++) {
					
					shortenAuthor = authors[i].indexOf(",");
					authors[i] = (authors[i].substr(0, shortenAuthor));
					var givenName = (authors[i].split(/\s/));
					authors[i] = '';
					
					for (var k = 0; k < givenName.length; k++) {
						if (givenName[k].length == 1) {
							authors[i] = (authors[i] + givenName[k] + ".");
						} else {
							
							authors[i] = (authors[i] + " " + givenName[k]);
						}
					}
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
				}
			}
		}
	}
	
//imprint info
	var info = new Array();
	if (doc.evaluate('//td[3]/table/tbody/tr/td[@class="MenuBar"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xPathImprint = doc.evaluate('//td[3]/table/tbody/tr/td[@class="MenuBar"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var imprint = xPathImprint.iterateNext().textContent.split(/\n/);
		
	
		for (var i = 0; i < imprint.length; i++) {
			imprint[i] = imprint[i].replace(/^\s*|\s*$/g, '');
			if (imprint[i].match(/\w/)) {
				info.push(imprint[i]);
			}
		}
	
		for (var i = 0; i < info.length; i++) {	
			if (info[i].match("pages")) {
				var cutPages = info[i].indexOf("pages");
				newItem.pages = info[i].substr(0, cutPages);
			} else if (info[i].match("Date:")) {
				newItem.date = info[i].substr(10);
			} else if (info[i].match("ISBN: ")) {
				newItem.ISBN = info[i].substr(6);
			}
		}
	}
	
	newItem.title = doc.title;
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
		
		var titles = doc.evaluate('//tr[1]/td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var mediaType = doc.evaluate('//strong', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var dump = mediaType.iterateNext();
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = mediaType.iterateNext().textContent;
			if (items[next_title.href].match("Book")) {
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