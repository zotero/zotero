{
	"translatorID":"d1bf1c29-4432-4ada-8893-2e29fc88fd9e",
	"translatorType":4,
	"label":"washingtonpost.com",
	"creator":"Simon Kornblith",
	"target":"^http://www\\.washingtonpost\\.com/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-06-21 20:10:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// don't say we can scrape when we can't; make sure user is logged in
	var signedIn = doc.evaluate('//a[text() = "Sign out" or text() = "Sign Out"]',
							   doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!signedIn) {
		return;
	}
	
	var articleRegexp = /http:\/\/www\.washingtonpost\.com\/wp-dyn\/content\/article\/[0-9]+\/[0-9]+\/[0-9]+\/[^\/]+\.html/
	if(articleRegexp.test(url)) {
		return "newspaperArticle";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The Washington Post";
	newItem.ISSN = "0740-5421";
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");
	
	// Elena's code to grab print version (all pages)
	snapshotURL=doc.location.href.replace(".html", "_pf.html");
	newItem.attachments.push({title:"Washington Post Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});

	// grab title from doc title
	newItem.title = doc.title.replace(" - washingtonpost.com", "");
	
	var byline = doc.evaluate('//div[@id="byline"]', doc, nsResolver,
	                        XPathResult.ANY_TYPE, null).iterateNext();	
	// grab authors from byline
	if(byline) {
		var authors = byline.textContent.substr(3).split(" and ");
		for each(var author in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	var fonts = doc.evaluate('//div[@id="article"]/p/font/text()', doc, nsResolver,
	                        XPathResult.ANY_TYPE, null);
	var font;
	while(font = fonts.iterateNext()) {
		var pageRe = /([^;]+);(?:[\xA0 ]+Pages?[\xA0 ]+([A-Z0-9\-]+))?/
		// grab pages and date
		Zotero.debug(Zotero.Utilities.cleanString(font.nodeValue));
		var m = pageRe.exec(font.nodeValue);
		if(m) {
			newItem.date = m[1];
			newItem.pages = m[2];
			break;
		}
	}
	
	// grab tags from meta tag
	var keywords = doc.getElementsByTagName("meta");
	if(keywords) {
		keywords = keywords.namedItem("keywords");
		if(keywords) {
			keywords = keywords.getAttribute("content");
			if(keywords) {
				newItem.tags = keywords.split(/, ?/);
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /http:\/\/www\.washingtonpost\.com\/wp-dyn\/content\/article\/[0-9]+\/[0-9]+\/[0-9]+\/[^\/]+\.html/
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, articleRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}