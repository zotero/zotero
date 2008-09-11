{
	"translatorID":"c7830593-807e-48cb-99f2-c3bed2b148c2",
	"translatorType":4,
	"label":"New Zealand Herald",
	"creator":"Michael Berkowitz",
	"target":"^http://(www|search).nzherald.co.nz/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-08-14 22:15:00"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("Search Results") != -1) {
		return "multiple";
	} else if (doc.location.href.indexOf("story.cfm") != -1) {
		return "newspaperArticle";
	}
}

function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = url;
		newItem.publicationTitle = "New Zealand Herald";
		
		//author?
		var aut = /<a href=\"\/author\/[^>]*>(.*)<\/a>/;
		if (text.match(aut)) {
			var author = text.match(aut)[1];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		
		//abstract
		var a = /meta name=\"description\" content=\"([^&]*)/;
		newItem.abstractNote = text.match(a)[1];
		
		//title and date
		var t = /<title>(.*)<\/title>/;
		var result = text.match(t)[1].split(" - ");
		newItem.title = result[0];
		newItem.date = result[1];
		
		//keywords
		var k = /<meta name=\"keywords\" content=\"(.*)\"/;
		var kwords = Zotero.Utilities.cleanString(text.match(k)[1]).split(", ");
		for (var i = 0 ; i < kwords.length ; i++) {
			newItem.tags.push(kwords[i]);
		}
		
		//section
		var s = /class=\"current\"><.*><span>(.*)<\/span>/;
		newItem.section = text.match(s)[1];
		
		newItem.complete();
		Zotero.debug(newItem);
		
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var articles = new Array();
	var names = new Array();
	if (doc.title.indexOf("Search Results:") != -1) {
		var URLS = new Array();
		var titles = new Array();
		var xpath = '//p[@class="g"]/a';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var link = links.iterateNext();
	
		while (link) {
			URLS.push(link.href);
			titles.push(link.textContent);
			link = links.iterateNext();
		}
		
		Zotero.debug(titles);
		Zotero.debug(URLS);
		
		var newItems = new Object();
		
		for (var i = 0 ; i < titles.length ; i++) {
			newItems[URLS[i]] = titles[i];
		}
	
		newItems = Zotero.selectItems(newItems);
	
		Zotero.debug(newItems);
		
		for (var i in newItems) {
			articles.push(i);
			names.push(newItems[i]);
		}
	} else {
		articles.push(doc.location.href);
		names.push(Zotero.Utilities.cleanString(doc.title.split("-")[0]));
	}
	
	Zotero.debug(articles);
	
	Zotero.Utilities.HTTP.doPost(articles, "", function(text) {
		for (var i = 0 ; i < articles.length ; i++) {
			scrape(articles[i]);
		}
	});
	
	Zotero.wait();
}