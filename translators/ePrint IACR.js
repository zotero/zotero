{
	"translatorID":"04a23cbe-5f8b-d6cd-8eb1-2e23bcc8ae8f",
	"translatorType":4,
	"label":"ePrint IACR",
	"creator":"Jonas Schrieb",
	"minVersion":"1.0.0b3.r1",
	"target":"^http://eprint\\.iacr\\.org/",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2010-03-03 14:00:00"
}

function detectWeb(doc, url) {
	var singleRe   = /^http:\/\/eprint\.iacr\.org\/(\d{4}\/\d{3}|cgi-bin\/print\.pl)/;
	var multipleRe = /^http:\/\/eprint\.iacr\.org\/(complete|curr|\d{4}|cgi-bin\/search\.pl)/;
	if(singleRe.test(url)) {
		return "report";
	} else if(multipleRe.test(url)) {
		return "multiple";
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var reportNoXPath = "//h2";
	var titleXPath    = "//p[1]/b";
	var authorsXPath  = "//p[2]/i";
	var abstractXPath = "//p[starts-with(b/text(),\"Abstract\")]/text() | //p[not(*)]";
	var keywordsXPath = "//p[starts-with(b/text(),\"Category\")]";

	var reportNo = doc.evaluate(reportNoXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	reportNo = reportNo.match(/(\d{4})\/(\d{3})$/);
	var year = reportNo[1];
	var no   = reportNo[2];

	var title = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	var authors = doc.evaluate(authorsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	authors = authors.split(" and ");
	
	var abstr = "";
	var abstractLines = doc.evaluate(abstractXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var nextLine;
	while(nextLine = abstractLines.iterateNext()) {
		abstr += nextLine.textContent;
	}
	
	var keywords = doc.evaluate(keywordsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var tmp = keywords.match(/Category \/ Keywords: (?:([^\/]*) \/ )?([^\/]*)/);
	keywords = tmp[2].split(", ")
	keywords.unshift(tmp[1]);


	var newItem = new Zotero.Item("report");
	newItem.date = year;
	newItem.reportNumber = no;
	newItem.url = "http://eprint.iacr.org/"+year+"/"+no;
	newItem.title = title;
	newItem.abstractNote = abstr;
	for (var i in authors) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
	}
	for (var i = 0; i < keywords.length; i++) {
		newItem.tags[i] = keywords[i];
	}
	newItem.attachments = [
		{url:newItem.url, title:"ePrint IACR Snapshot", mimeType:"text/html"},
		{url:newItem.url+".pdf", title:"ePrint IACR Full Text PDF", mimeType:"application/pdf"}
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
		var titleXPath = "//dl/dd/b";
		var linkXPath = "//dl/dt/a[1]";

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
