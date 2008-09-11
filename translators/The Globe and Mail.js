{
	"translatorID":"e0234bcf-bc56-4577-aa94-fe86a27f6fd6",
	"translatorType":4,
	"label":"The Globe and Mail",
	"creator":"Adam Crymble",
	"target":"http://www.theglobeandmail.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-04 07:10:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var metaTags = new Object();
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
		
	}
		
	if (doc.evaluate('//div[@id="header"]/h2/a/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {	
		var printEdition1 = doc.evaluate('//div[@id="header"]/h2/a/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().src;
		if (printEdition1.match("printedition")) {
			return "newspaperArticle";
		}
	}
		
	if (doc.evaluate('//p[@id="continueReading"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var payPerView = doc.evaluate('//p[@id="continueReading"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		if (payPerView == "purchase this article") {
			return "newspaperArticle";
		}
	}
	
	if (metaTags["article_id"]) {
		return "newspaperArticle";
		
	} else if (doc.title.match('globeandmail.com: Search')) {
		return "multiple";
	} 
	
	if (doc.evaluate('//ul[@id="utility"]/li[@class="email"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var blogCheck = doc.evaluate('//ul[@id="utility"]/li[@class="email"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var blogCheck1 = blogCheck.iterateNext().textContent;
		if (blogCheck1.match("blog")) { 
			if (doc.location.href.match("story")) {
			return "blogPost";
			}
		}
	}
}

//Translator for the Globe and Mail newspaper: code by Adam Crymble 

function associateMeta (newItem, metaTags, field, zoteroField) {
	if (metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (detectWeb(doc, url) == "blogPost") {
		var newItem = new Zotero.Item("blogPost");
		
		var title = doc.evaluate('//div[@id="headline"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null);
		newItem.title = title.iterateNext().textContent;
		
		var blogger = doc.evaluate('//div[@id="author"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null); 
		var bloggerName = blogger.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
		var bloggerName1 = bloggerName.split(",");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(bloggerName1[0], "author"));
	}
	var noMetaType = 0;
	
	if (detectWeb(doc, url) == "newspaperArticle") {
		var newItem = new Zotero.Item("newspaperArticle");
		
	//checks if the article is from the "Print Edition" which doesn't contain meta data.	
		if (doc.evaluate('//div[@id="header"]/h2/a/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {	
			var printEdition1 = doc.evaluate('//div[@id="header"]/h2/a/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().src;
			if (printEdition1.match("printedition")) {
				noMetaType = 1;
				if (doc.evaluate('//div[@id="author"]/p[@class="article-date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
					newItem.date= doc.evaluate('//div[@id="author"]/p[@class="article-date"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				}
			}
		}
		
	//checks if the article is a Pay per view article.	
		if (doc.evaluate('//p[@id="continueReading"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var payPerView = doc.evaluate('//p[@id="continueReading"]/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			if (payPerView == "purchase this article") {
				noMetaType = 1;
			}
		}
		
	//format for the "Print Edition" and "Pay per view" articles	
		if (noMetaType = 1) {
			noMetaType = 1;
				if (doc.evaluate('//div[@id="headline"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
					newItem.title = doc.evaluate('//div[@id="headline"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				}
								
				if (doc.evaluate('//div[@id="author"]/p[@class="byline"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
					var author = doc.evaluate('//div[@id="author"]/p[@class="byline"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				}
				noMetaType = 0;
		}
		
		var metaTags = new Object();
		var tagsContent = new Array();
		
	//get data
		var metaTagHTML = doc.getElementsByTagName("meta");
		for (var i = 0 ; i < metaTagHTML.length ; i++) {
			metaTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
		}
		
	//author	
		if (metaTags["byline"]) {
			var author = metaTags["byline"];
		}
		
	//date	
		if (metaTags["pubdate"]) {
			var month = metaTags["pubdate"].substr(4, 2);
			var day = metaTags["pubdate"].substr(6, 2);
			var year = metaTags["pubdate"].substr(0, 4);
			
			newItem.date = (year + "-" + month + "-"+ day);
		}
	
	//tags	
		if (metaTags["article_keywords"]) {
			tagsContent = metaTags["article_keywords"].split("; ");
		}
		
		for (var i = 0; i < tagsContent.length; i++) {
		     	if (tagsContent[i] != (" ") && tagsContent[i] != ("")) {
			     	newItem.tags[i] = tagsContent[i];
		     	}
	     	}	
		
		associateMeta (newItem, metaTags, "headline", "title");
		associateMeta (newItem, metaTags, "summary", "abstractNote");
		associateMeta (newItem, metaTags, "desk", "section");	
		associateMeta (newItem, metaTags, "article_id", "callNumber");
		associateMeta (newItem, metaTags, "credit", "rights");
	
	//rest of author (shared between both newspaperArticle types)
		if (author) {
			
		
			if (author.substr(0,3).toLowerCase() == "by ") {
				author= author.substr(3);
			}
		
			var authors = author.toLowerCase().split(" and ");
			for each(var author in authors) {
				var words = author.split(" ");
				
				for (var i in words) {
					if (words[i] != "") {
						words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
					}
				}
				author = words.join(" ");
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));			
			}
		}
	}	
	
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
		var next_title = new Array();
		
		var titlesCount = doc.evaluate('count (//h3[@class="storyLink"]/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titles = doc.evaluate('//h3[@class="storyLink"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);		
		
		for (i=0; i < titlesCount.numberValue; i++) {
			next_title = titles.iterateNext();
			
			if (next_title.href.match("story")) {
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