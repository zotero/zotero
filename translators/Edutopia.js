{
	"translatorID":"3f44a651-8b6b-4591-8ca4-4bfb943a13f4",
	"translatorType":4,
	"label":"Edutopia",
	"creator":"Adam Crymble",
	"target":"http://www.edutopia.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-20 20:45:00"
}

function detectWeb(doc, url) {
	
	var blog1 = 0;
	
	if (doc.title.match("blog")) {
		blog1 = 1;
	}
	
	if (doc.location.href.match("search")) {
		return "multiple";
	} else if (blog1 == 0 && doc.evaluate('//h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "newspaperArticle";
	}
}

//Edutopia.org translator. Code by Adam Crymble

function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	

	var author;
	var authorCheck = 0;
	var tagsContent = new Array();
	
	var newItem = new Zotero.Item("newspaperArticle");
	
//title	
	var title1 = doc.title.split("|");
	newItem.title = title1[0];
	
//author	
	if (doc.evaluate('//div[@id="article"]/h4/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		author = doc.evaluate('//div[@id="article"]/h4/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		authorCheck = 1;
		
	} else if (doc.evaluate('//div[@id="pollpage"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
	
		author = doc.evaluate('//div[@id="pollpage"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		authorCheck = 1;
		
	} else if (doc.evaluate('//div[@class="blog"]/h4', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		author = doc.evaluate('//div[@class="blog"]/h4', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		authorCheck = 1;
	}
	
	if (authorCheck == 1) {
		if (author.toLowerCase().match(/^by /)) {
			author = author.substr(3);
		}
		Zotero.debug(author);
		newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
	}
	
	
//abstract	
	if (doc.evaluate('//div[@class="dek"]/h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = (doc.evaluate('//div[@class="dek"]/h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}
	
//date
	if (doc.evaluate('/span[@class="blog_date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.date = doc.evaluate('/span[@class="blog_date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
	}
	
	if (metaTags["keywords"]) {
		tagsContent = (metaTags["keywords"].split(', '));		
	}
	
	for (var i = 0; i < tagsContent.length; i++) {
     		newItem.tags[i] = tagsContent[i];
     	}

	associateMeta (newItem, metaTags, "description", "abstractNote");
	
	newItem.publication = "Edutopia.org"
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
		
		var titles = doc.evaluate('//dt[@class="title"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
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