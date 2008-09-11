{
	"translatorID":"9418dcc2-cc1e-432b-b7a6-7b00b7402d2f",
	"translatorType":4,
	"label":"Hurricane Digital Memory Bank",
	"creator":"Adam Crymble",
	"target":"http://hurricanearchive.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-21 15:45:00"
}

function detectWeb(doc, url) {
	
	if (doc.evaluate('//p[@id="cite-as"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	} else if (doc.evaluate('//p[@class="object_description"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
}

//Hurricane Digital Memory Bank translator; Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("book");
	
	var dataTags = new Object();
	var tagsContent = new Array();
	var tags;
	var cite = doc.evaluate('//p[@id="cite-as"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var split1 = new Array();
	var split2 = new Array();
	var split3 = new Array();
	var split4 = new Array();
	var split5 = new Array();

   	//author
	split1 = cite.split(', "');
	var authorWords = split1[0].split(/\b\s/);
	if (authorWords.length > 3) {
		newItem.creators.push({lastName: split1[0], creatorType: "creator"});
	} else {
	
		newItem.creators.push(Zotero.Utilities.cleanAuthor(split1[0], "author"));
	}
	
	//title	
	split2 = split1[1].split('." ');
	newItem.title = split2[0];	
   
  	 //repository
	split3 = split2[1].split("Bank, ");	
	
   	//object number	
	split4 = split3[1].split(" (");
	newItem.callNumber = split4[0];
	
   	//date posted and URL
	split5 = split4[1].split(")<");
	newItem.date = split5[0];
	
	//tags
	if (doc.evaluate('//ul[@class="taglist"][@id="tags"]/li', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xPathTags = doc.evaluate('//ul[@class="taglist"][@id="tags"]/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tagsCount = doc.evaluate('count (//ul[@class="taglist"][@id="tags"]/li)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		for (var i =0; i < tagsCount.numberValue; i++) {
			newItem.tags[i] = xPathTags.iterateNext().textContent;
		}
	}
	
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
		
		
		var links = doc.evaluate('//p[@class="object_description"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titles = doc.evaluate('//p[@class="object_description"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		
		while (next_title = titles.iterateNext()) {
			
			items[links.iterateNext().href] = next_title.textContent;
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