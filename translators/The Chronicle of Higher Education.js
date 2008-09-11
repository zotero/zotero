{
	"translatorID":"1e6d1529-246f-4429-84e2-1f1b180b250d",
	"translatorType":4,
	"label":"The Chronicle of Higher Education",
	"creator":"Simon Kornblith",
	"target":"^http://chronicle\\.com/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2006-12-12 23:41:00"
}

function detectWeb(doc, url) {
	var articleRegexp = /^http:\/\/chronicle\.com\/(?:daily|weekly)\/[^/]+\//
	if(articleRegexp.test(url)) {
		if(doc.location.href.indexOf("weekly") != -1) {
			return "magazineArticle";
		} else {
			return "webpage";
		}
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}

function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags.namedItem(field)) {
		newItem[zoteroField] = Zotero.Utilities.cleanString(metaTags.namedItem(field).getAttribute("content"));
	}
}

function scrape(doc) {
	if(doc.location.href.indexOf("weekly") != -1) {
		var newItem = new Zotero.Item("magazineArticle");
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		// go in search of pages
		var content = doc.evaluate('/html/body/table[@class="layout"]/tbody/tr[1]/td[@class="content"]',
		                           doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(content) {
			var pagesRegexp = /http:\/\/chronicle.com\nSection: [^\n]+\nVolume [0-9]+, Issue [0-9]+, Pages? ([A-Z0-9\-]+)/;
			var m = pagesRegexp.exec(content.textContent);
			if(m) {
				newItem.pages = m[1];
			}
		}
	} else {
		var newItem = new Zotero.Item("webpage");
	}
	newItem.publicationTitle = "The Chronicle of Higher Education";
	newItem.ISSN = "0009-5982";
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");

	newItem.attachments.push({document:doc, title:"Chronicle of Higher Education Snapshot"});
	
	associateMeta(newItem, metaTags, "published_date", "date");
	associateMeta(newItem, metaTags, "headline", "title");
	associateMeta(newItem, metaTags, "section", "section");
	associateMeta(newItem, metaTags, "volume", "volume");
	associateMeta(newItem, metaTags, "issue", "issue");
	
	if(metaTags.namedItem("byline")) {
		var author = Zotero.Utilities.cleanString(metaTags.namedItem("byline").getAttribute("content"));
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			// fix capitalization
			var words = author.split(" ");
			for(var i in words) {
				words[i] = words[i][0].toUpperCase()+words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			
			if(words[0] == "The") {
				newItem.creators.push({lastName:author, creatorType:"author", fieldMode:true});
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /^http:\/\/chronicle\.com\/(?:daily|weekly)\/[^/]+\//;
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, '^http://chronicle\\.com/(?:daily|weekly)/[^/]+/');
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