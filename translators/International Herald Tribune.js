{
	"translatorID":"84bd421d-c6d1-4223-ab80-a156f98a8e30",
	"translatorType":4,
	"label":"International Herald Tribune",
	"creator":"Michael Berkowitz",
	"target":"^http://(www.)?iht.com/",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-07-31 16:45:00"
}

function detectWeb(doc, url) {
	if (doc.title == "Search - International Herald Tribune" && doc.location.href != "http://www.iht.com/info/nytarchive.php") {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == "x") return namespace; else return null;
		} : null;
		
		var xpath = '//meta[@name="Headline"]';
		if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "newspaperArticle";
		}
	}
}

function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The International Herald Tribune";
	newItem.ISSN = "0294-8052";
	newItem.url = doc.location.href;
	
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
	}

	associateMeta(newItem, metaTags, "Headline", "title");
	associateMeta(newItem, metaTags, "PrintPubDate", "date");
	associateMeta(newItem, metaTags, "Summary", "abstractNote");
	associateMeta(newItem, metaTags, "ArticleID", "accessionNumber");
	associateMeta(newItem, metaTags, "Owner", "extra");
	
	if (metaTags["Author"]) {
		var author = Zotero.Utilities.cleanString(metaTags["Author"]);
		if (author.substr(0,3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			var words = author.split(" ");
			for (var i in words) {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	if (metaTags["keywords"]) {
		var keywords = metaTags["keywords"];
		newItem.tags = keywords.split(",");
		if (newItem.tags[0].toLowerCase()) {
			newItem.tags = newItem.tags.slice(1, newItem.tags.length);
		}
		Zotero.debug(newItem.tags);
		for (var i in newItem.tags) {
			if (newItem.tags[i] != "") {
				newItem.tags[i] = Zotero.Utilities.cleanString(newItem.tags[i].replace("  ", ", "));
				var words = newItem.tags[i].split(" ");
				for (var j = 0 ; j < words.length ; j++) {
					if (words[j][0] == words[j][0].toLowerCase()) {
						words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
					}
				}
				newItem.tags[i] = words.join(" ");
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
	
	var uris = new Array();
	if (doc.title == "Search - International Herald Tribune") {
		var result = doc.evaluate('//td[@class="searchheadline"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items = new Array();
		var elmt = result.iterateNext();
		while (elmt) {
			items.push(elmt.href);
			elmt = result.iterateNext();
		}
		var items = Zotero.Utilities.getItemArray(doc, doc, '^http://(www.)*iht.com/articles/.*\.php$');
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			uris.push(i);
		}
		
	} else if (doc.evaluate('//meta[@name="Headline"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		uris.push(url);
	}
		
	Zotero.Utilities.processDocuments(uris, scrape, function() { Zotero.done(); });
	
	Zotero.wait();
}
