{
	"translatorID":"04c0db88-a7fc-4d1a-9cf7-471d0990acb1",
	"translatorType":4,
	"label":"Christian Science Monitor",
	"creator":"Adam Crymble",
	"target":"http://(features.csmonitor|www.csmonitor).com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("search")) {
		return "multiple";
	} else if (doc.location.href.match("features")) {
		return "newspaperArticle";
	} else if (doc.evaluate('//div[@id="storyContent"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "newspaperArticle";
	}
}

//Christian Science Monitor translator. Code by Adam Crymble.

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("newspaperArticle");
	
	
	if (doc.location.href.match("features.csmonitor")) {
		
	newItem.title = doc.title;
		
		
		if (doc.evaluate('//div[@class="story"][@id="main"]/p/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.abstractNote = doc.evaluate('//div[@class="story"][@id="main"]/p/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		
		if (doc.evaluate('//h3/span[@class="time-date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.date = doc.evaluate('//h3/span[@class="time-date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(" edition", '');
		}
		
		if (doc.evaluate('//h3/span', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
			var author = doc.evaluate('//h3/span', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			if (author.match("By ")) {
				author = author.substr(3);
			}
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		}
		
		var title1 = doc.title;
		
		//Some entries do not work for some reason unbeknownst to me; this flag catches the problem and prevents an error, but doesn't save the data properly.
		if (title1.match("csmonitor")) {
			newItem.title = title1.substr(0, title1.length-15);
		} else {
			newItem.title = "This Entry Cannot Be Saved";
			newItem.abstractNote = "Entry must be entered manually";
		}
		
		
		
	} else {
		
		//title
		if (doc.evaluate('//div[@id="storyContent"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
			var title1 = doc.evaluate('//div[@id="storyContent"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var words = title1.split(" ");
			for (var i in words) {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
			}
			title1 = words.join(" ");
			newItem.title = title1;
		} else {
			newItem.title = "no title found";
		}
		
		//abstract note
		if (doc.evaluate('//div[@id="storyContent"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.abstractNote = doc.evaluate('//div[@id="storyContent"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		
		//date
		if (doc.evaluate('//div[@id="storyContent"]/p[@class="postdate"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var date1 = doc.evaluate('//div[@id="storyContent"]/p[@class="postdate"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			date1 = date1.replace(/from the /g, '');
			date1 = date1.replace(/ edition/g, '');
			newItem.date = date1;
		}
		
		//author
		if (doc.evaluate('//address[@class="byline"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var author = doc.evaluate('//address[@class="byline"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

			if (author.match("By ")) {
				author = author.substr(3);
			}
			var words = author.split(" ");
			for (var i in words) {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		} 
	
	}

	newItem.publicationTitle = "Christian Science Monitor";
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
	
		var titles = doc.evaluate('//p[@id="searchResultRow"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (!next_title.href.match("features")) {
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