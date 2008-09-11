{
	"translatorID":"6b0b11a6-9b77-4b49-b768-6b715792aa37",
	"translatorType":4,
	"label":"Toronto Star",
	"creator":"Adam Crymble",
	"target":"http://www.thestar.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("search") && !doc.location.href.match("classifieds")) {
		return "multiple";
	} else if (doc.location.href.match("article")) {
		return "newspaperArticle";
	}
}

//Toronto Star translator. code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("newspaperArticle");

	if (doc.title.match("TheStar.com | ")) {
		var lineBreak = doc.title.lastIndexOf(" |");
		newItem.section = doc.title.substr(14, lineBreak-14);
	}
	
	var byLine = doc.evaluate('//div[@id="ctl00_ContentPlaceHolder_article_NavWebPart_Article"]/div/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var nextEntry;
	while (nextEntry = byLine.iterateNext()) {
		if (nextEntry.textContent.match(" PM") || nextEntry.textContent.match(" AM") && nextEntry.textContent.match(/\d\d\d\d/)) {
			newItem.date = nextEntry.textContent;
		} else {
			newItem.abstractNote = nextEntry.textContent;
		}
	}
     	
	var author1 = new Array();
     	var k = 0;
     	
     	if (doc.evaluate('//span[@class="articleAuthor"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
	     	var author = doc.evaluate(xPathAuthor, doc, nsResolver, XPathResult.ANY_TYPE, null);
	     	var authorName;
	     	
	     	while (authorName = author.iterateNext()) {
			author1.push(authorName.textContent);	
			k++;
	     	}

	     	if (k>1) {
			for (k in author1) {
				var words = author1[k].toLowerCase().split(/\s/);
				
				for (var i in words) {
					words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
				}
				
				author1[k] = words.join(" ");
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author1[k], "author"));	
		    	} 	
	     	} else {

		     	var words = author1[0].toLowerCase().split(/\s/);
			for (var i in words) {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
			}
			author1[0] = words.join(" ");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author1[0], "author"));	
	     	}
     	}

	var xPathTitle = '//span[@class="headlineArticle"][@id="ctl00_ContentPlaceHolder_article_NavWebPart_Article_ctl00___Title__"]';
	newItem.title = doc.evaluate(xPathTitle, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
	
	newItem.url = doc.location.href;
	newItem.publicationTitle = "The Toronto Star";
	newItem.ISSN = "0319-0781";

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
		
		var titles = doc.evaluate('//a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.href.match("http://www.thestar.com") && next_title.href.match("article") && !next_title.href.match("generic") && !next_title.href.match("static")) {
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