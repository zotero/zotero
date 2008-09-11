{
	"translatorID":"dbfcaa3e-082a-45a4-9619-9892f49399c1",
	"translatorType":4,
	"label":"Cyberpresse",
	"creator":"Adam Crymble",
	"target":"http://www.cyberpresse.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb (doc,  url) {
	if (doc.location.href.match("article")) {
		return "newspaperArticle";
	}
}

//Cyberpresse translator. Code by Adam Crymble

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
	
	var newItem = new Zotero.Item("newspaperArticle");
	
	if (doc.title.match("|")) {
	
		var titleStuff = doc.title.split("|");	
		if (titleStuff[0].match(":")) {
			var authorTitle  = titleStuff[0].split(":");
			newItem.title = authorTitle[1];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authorTitle[0], "author"));	
			
		} else {
			newItem.title = titleStuff[0];
		}
		
	} else {
		newItem.title = doc.title;
	}

	var dataTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < dataTagHTML.length ; i++) {
		dataTags[dataTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(dataTagHTML[i].getAttribute("content"));
	}

	if (doc.evaluate('//div[@id="nouvelle"]/p[@class="auteur"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var author = doc.evaluate('//div[@id="nouvelle"]/p[@class="auteur"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
	}		
	
	if (doc.evaluate('//div[@id="nouvelle"]/p[@class="date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.date = doc.evaluate('//div[@id="nouvelle"]/p[@class="date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
	}		
	
	associateData (newItem, dataTags, "summary", "abstractNote");
	associateData (newItem, dataTags, "mediaarticle", "publicationTitle");

	newItem.url = doc.location.href;

	newItem.complete();
}

function doWeb(doc, url) {
	
	var articles = new Array();
	
	articles = [url];
	
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();	
}