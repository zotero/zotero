{
	"translatorID":"4c164cc8-be7b-4d02-bfbf-37a5622dfd56",
	"translatorType":4,
	"label":"The New York Review of Books",
	"creator":"Simon Kornblith",
	"target":"^https?://www\\.nybooks\\.com/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2006-12-14 00:40:00"
}

function detectWeb(doc, url) {
	var articleRegexp = /^http:\/\/www\.nybooks\.com\/articles\/[0-9]+\/?/
	if(articleRegexp.test(url)) {
		return "journalArticle";
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
	var newItem = new Zotero.Item("journalArticle");
	newItem.publicationTitle = "The New York Review of Books";
	newItem.ISSN = "0028-7504";
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");

	newItem.attachments.push({document:doc, title:"New York Review of Books Snapshot"});
	
	associateMeta(newItem, metaTags, "dc.title", "title");
	
	var info = doc.evaluate('//div[@id="center-content"]/h4[@class="date"]',
	                            doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	
	if(info) {
		// get date (which is in an a tag)
		newItem.date = doc.evaluate("./a", info, nsResolver, XPathResult.ANY_TYPE,
		                           null).iterateNext();
		if(newItem.date) {
			newItem.date = newItem.date.textContent;
		}
		
		info = Zotero.Utilities.cleanString(info.textContent);
		
		// get volume and issue
		var infoRe = /Volume ([0-9]+), Number ([0-9]+)/;
		var m = infoRe.exec(info);
		if(m) {
			newItem.volume = m[1];
			newItem.issue = m[2];
		}
	}
	
	
	var authors = doc.evaluate('//div[@id="center-content"]/h4/a[substring(@href, 1, 9) = "/authors/"]',
	                           doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	
	var author;
	while(author = authors.iterateNext()) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(author.textContent, "author", false));
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /^http:\/\/www\.nybooks\.com\/articles\/[0-9]+/
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^https?://www\\.nybooks\\.com/articles/[0-9]+/?");
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