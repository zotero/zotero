{
	"translatorID":"09a9599e-c20e-a405-d10d-35ad4130a426",
	"translatorType":4,
	"label":"Electronic Colloquium on Computational Complexity",
	"creator":"Jonas Schrieb",
	"minVersion":"1.0.0b3.r1",
	"target":"http://(www.)?eccc.(uni-trier|hpi-web).de/",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2010-03-03 15:00:00"
}

function detectWeb(doc, url) {
	var singleRe   = /^http:\/\/(www\.)?eccc\.(uni-trier|hpi-web)\.de\/report\/\d{4}\/\d{3}/;
	var multipleRe = /^http:\/\/(www\.)?eccc\.(uni-trier|hpi-web)\.de\/(title|year|keyword)\//;
	if(singleRe.test(url)) {
		return "report";
	} else if(multipleRe.test(url)) {
		return "multiple";
	}
}

function scrape(doc) {
	var newItem = new Zotero.Item("report");

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;


	var url = doc.location.href;
	var tmp  = url.match(/\/(\d{4})\/(\d{3})\/$/);
	newItem.date = tmp[1];
	newItem.reportNumber = tmp[2];
	newItem.url = url;
	


	var titleXPath    = "id('box')//h4";
	newItem.title = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;



	var authorsXPath  = "id('box')//a[contains(@href,'author')]";
	var authors = doc.evaluate(authorsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var nextAuthor;
	while (nextAuthor = authors.iterateNext()) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(nextAuthor.textContent, "author"));
	}


	
	var keywordsXPath = "id('box')//a[contains(@href,'keyword')]";
	var keywords = doc.evaluate(keywordsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var nextKeyword;
	var i = 0;
	while (nextKeyword = keywords.iterateNext()) {
		newItem.tags[i++] = nextKeyword.textContent;
	}



	var abstractXPath = "id('box')/text()";
	var abstractLines = doc.evaluate(abstractXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	newItem.abstractNote = "";
	var nextLine;
	while(nextLine = abstractLines.iterateNext()) {
		newItem.abstractNote += nextLine.textContent;
	}



	newItem.attachments = [
		{url:url, title:"ECCC Snapshot", mimeType:"text/html"},
		{url:url+"download", title:"ECCC Full Text PDF", mimeType:"application/pdf"}
	];

	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var articles = new Array();
	var items = new Object();
	var nextTitle;

	if (detectWeb(doc, url) == "multiple") {
		var titleXPath = "//a[starts-with(@href,'/report/')]/h4";
		var linkXPath = "//a[starts-with(@href,'/report/')][h4]";

		var titles = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links  = doc.evaluate(linkXPath,  doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (nextTitle = titles.iterateNext()) {
			nextLink = links.iterateNext();
			items[nextLink.href] = nextTitle.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}

	Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
	Zotero.wait();
}
