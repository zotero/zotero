{
	"translatorID":"1c5b122c-7e58-4cd5-932b-93f5ca0b7e1a",
	"translatorType":4,
	"label":"National Post",
	"creator":"Adam Crymble",
	"target":"http://www.(national|financial)post.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-11 20:40:00"
}

function detectWeb(doc, url) {
	
	if (doc.title.match("Search Results")) {
		return "multiple";
	} else if (doc.location.href.match("story")) {
		return "newspaperArticle";
	} else if (doc.location.href.match("blog")) {
		return "blogPost";
	}
	
}

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
	
	var dataTags = new Object();
	var author = new Array();
	
	var mediaType = detectWeb(doc,doc.location.href);
	if (mediaType == "newspaperArticle") {
		var newItem = new Zotero.Item("newspaperArticle");
	
	//metadata	
		var dataTagHTML = doc.getElementsByTagName("meta");
		for (var i = 0 ; i < dataTagHTML.length ; i++) {
			dataTags[dataTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(dataTagHTML[i].getAttribute("content"));
		}
		
		associateData (newItem, dataTags, "Description", "abstractNote");
		associateData (newItem, dataTags, "PubDate", "date");
		
	//author
		if (dataTags["Author"]) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Author"], "author"));
		} else {
		
			author = doc.evaluate('//strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(",");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[0], "author"));
		}
		
	} else if (mediaType == "blogPost") {
		
		var newItem = new Zotero.Item("blogPost");
		
		var blog = doc.evaluate('//div[@class="entryviewfooter"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		blog = blog.replace("Posted:", '').split("by");
		newItem.date = blog[0].replace(/^\s*|\s*$/g, '');
		
		var author = doc.evaluate('//span[@class="MoreRecentPostsAuthor"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace("by ", '');
		newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
	}

	Zotero.debug(doc.location.href);
	newItem.url = doc.location.href;
	
	// This is ACTUALLY returning This URL: http://www.nationalpost.com/components/npemail.aspx?id=591742&ref=http://www.nationalpost.com/story.html


	var title1 = doc.title;
	Zotero.debug(title1);
	
	newItem.title = title1;
	newItem.publication = "The National Post";
	newItem.ISSN = 	"1486-8008";
	
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
		var titles = doc.evaluate('//h3[@class="alt"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.href.match("nationalpost")) {
				items[next_title.href] = next_title.textContent;
				Zotero.debug(next_title.href);
				Zotero.debug(next_title.textContent);
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