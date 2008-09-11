{
	"translatorID":"1f245496-4c1b-406a-8641-d286b3888231",
	"translatorType":4,
	"label":"The Boston Globe",
	"creator":"Adam Crymble",
	"target":"http://(www|search).boston.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-06 08:45:00"
}

function detectWeb(doc, url) {
	if (url.match("search.boston.com")) {
		return "multiple";
	} else if (doc.evaluate('//div[@id="headTools"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "newspaperArticle";
	} else if (doc.evaluate('//div[@id="blogEntry"]/h1/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "blogPost";
	} 
}

//Boston Globe and Boston.com Translator. Code by Adam Crymble

function scrape (doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	}: null;
		
	//sets variables that remain constant in both formats
					
		if (doc.evaluate('//span[@id="dateline"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext())  {
			var xPathDateResults = doc.evaluate ('//span[@id="dateline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);	
		}
		
		if (doc.evaluate('//span[@id="byline"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext())  {
			var xPathAuthorResults= doc.evaluate ('//span[@id="byline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}	
		
	
	//sets variables unique to the blog posts on Boston.com		
	
		if (doc.evaluate('//div[@id="blogEntry"]/h1/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			
			var newItem =new Zotero.Item("blogPost");
			newItem.publicationTitle = "Boston.com";
			
			//title
			var xPathTitle = '//div[@id="blogEntry"]/h1/a';
			
			//date
			var articleDate = xPathDateResults.iterateNext().textContent;
			newItem.date = articleDate;
			
			//author
			var articleAuthor = xPathAuthorResults.iterateNext().textContent.replace(/Posted by /i, '');
			articleAuthor = articleAuthor.split(',');
			var authorName = articleAuthor[0].split("and ");
	
	//else it sets the variables unique to the articles on the Boston Globe	
	
		} else if (doc.evaluate('//div[@id="headTools"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext())  {
			
			var newItem = new Zotero.Item("newspaperArticle");
			newItem.publicationTitle = "The Boston Globe";
		
			//title
			var xPathTitle = '//div[@id="headTools"]/h1';
			
			//date
			if (doc.evaluate('//span[@id="dateline"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext())  {
				var articleDate = xPathDateResults.iterateNext().textContent;
				if (articleDate.match('/')) {
					articleDate = articleDate.split('/');
				newItem.date = articleDate[1];	
				} else {
					newItem.date = articleDate;
				}
				
			}			
			
			//author(s)
				var articleAuthor = xPathAuthorResults.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
				articleAuthor= articleAuthor.substr(3);
				var authorName = articleAuthor.split("and ");
			
			
			//byline	
			if (doc.evaluate('//div[@id="headTools"]/h2', doc, null, XPathResult.ANY_TYPE, null).iterateNext())  {		
				newItem.abstractNote = doc.evaluate ('//div[@id="headTools"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			}
		}
			
		//creates title using xPaths defined above
			var xPathTitleResults = doc.evaluate (xPathTitle, doc, nsResolver, XPathResult.ANY_TYPE, null);
			newItem.title = xPathTitleResults.iterateNext().textContent;
		
		//pushes author(s)	
			
			for (var i=0; i<authorName.length; i++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorName[i], "author"));
			}	
		
		newItem.url = doc.location.href;
			
		newItem.complete();
}


function doWeb (doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	}: null;
	
	var uris= new Array();

	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var result =  doc.evaluate('//div[@class="regTZ"]/a[@class="titleLink"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt = result.iterateNext();
		Zotero.debug(elmt);
		while (elmt) {
			//items.push(elmt.href);
			items[elmt.href] = elmt.textContent;
			elmt = result.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			uris.push(i);
		}
	} else
		uris.push(url);
		Zotero.debug(uris);
	Zotero.Utilities.processDocuments(uris, scrape, function() {Zotero.done();});
	Zotero.wait();
}