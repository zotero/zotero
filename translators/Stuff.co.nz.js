{
	"translatorID":"631ff0c7-2e64-4279-a9c9-ad9518d40f2b",
	"translatorType":4,
	"label":"Stuff.co.nz",
	"creator":"Michael Berkowitz",
	"target":"^http://(www.)?stuff.co.nz/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-08-14 22:15:00"
}

function detectWeb(doc, url) {
	if ((doc.location.href.indexOf("search-results") != -1) || (doc.location.href.indexOf("/blogs/blogs/") != -1 )) {
		return "multiple";
	} else if ((doc.location.href.indexOf("blogs") != -1) && (url != "http://www.stuff.co.nz/blogs/blogs") && (url != "http://stuff.co.nz/blogs/blogs")) {
		return "blogPost";
	} else if (doc.location.href.indexOf("html") == (doc.location.href.length - 4)){
		return "newspaperArticle";
	}
}

function scrape(doc, url) {
	if (doc.location.href.indexOf("html") != -1) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = doc.location.href;
		newItem.publicationTitle = "Stuff.co.nz";
		newItem.title = doc.title.split(" - ")[0];
		
		//abstract
		var xpath = '//div[@id="leftcol_story"]/p/strong';
		newItem.abstractNote = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		
		//date and author
		var xpath = '//div[@id="story_headline"]';
		var info = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\n+/)[2].split(" | ");
		
		newItem.date = Zotero.Utilities.cleanString(info[1].split(",")[1]);
		
		var author = Zotero.Utilities.cleanString(info[0]);
		if (author.substr(0,2).toLowerCase() == "by") {
			author = author.substr(3);
			if (author.indexOf(" - ") != -1) {
				author = author.split(" - ")[0].split(" ");
			} else {
				author = author.split(" ");
			}
			for (var i = 0 ; i < author.length ; i++) {
				author[i] = author[i][0] + author[i].substr(1).toLowerCase();
				var creator = author.join(" ");
			}
			newItem.creators.push(Zotero.Utilities.cleanAuthor(creator, "author"));
		} else {
			newItem.extra = author;
		}
	} else if (doc.location.href.indexOf("blogs") != -1) {
		var newItem = new Zotero.Item("blogPost");
		newItem.url = doc.location.href;

		//post title
		var xpath = '//div[@class="post"]/h2[@class="storytitle"]/a';
		newItem.title = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
		//date and author
		var xpath = '//div[@class="meta"][@id="postdate"]'
		var info = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(" | ");
		var byline = Zotero.Utilities.cleanString(info[0]).split(" in ");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(byline[0], "author"));
		newItem.blogTitle = byline[1];
		var date = Zotero.Utilities.cleanString(info[1]).split("m ");
		newItem.date = date[1];
	}
	newItem.complete();
}

function doWeb(doc, url) {
	var URLS = new Array();
	
	//multiple
	if ((url.indexOf("search-results") != -1) || (url.indexOf("blogs/blogs/") != -1)) {
		if (url.indexOf("search-results") != -1) {
			var xpath = '//div[@id="leftcol_story"]/p/a';
		} else if (url.indexOf("blogs/blogs/") != -1) {
			var xpath = '//h2[@class="storytitle"]/a';
		}
	
		var items = new Object();
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var newTitle = titles.iterateNext();
		while (newTitle) {
			items[newTitle.href] = newTitle.textContent;
			newTitle = titles.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			URLS.push(i);
		}
	} else {
		URLS.push(url);
	}
	
	Zotero.Utilities.processDocuments(URLS, scrape, function() {Zotero.done();});
	Zotero.wait();
}