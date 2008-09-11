{
	"translatorID":"e85a3134-8c1a-8644-6926-584c8565f23e",
	"translatorType":4,
	"label":"History Cooperative",
	"creator":"Simon Kornblith",
	"target":"https?://[^/]*historycooperative\\.org[^/]*/(?:journals/.+/.+/.+\\.s?html$|cgi-bin/search.cgi|journals/(?!cp|whc).+/.+/)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-06 08:15:00"
}

function detectWeb(doc, url) {
	var contents = doc.title.replace("Contents", "");
	if(doc.title != contents || doc.title == "History Cooperative: Search Results") {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {
	var newItem = new Zotero.Item("journalArticle");
	newItem.url = doc.location.href;
	
	var month, year;
	var metaTags = doc.getElementsByTagName("meta");

	associateMeta(newItem, metaTags, "Journal", "publicationTitle");
	associateMeta(newItem, metaTags, "Volume", "volume");
	associateMeta(newItem, metaTags, "Issue", "issue");

	// grab title without using meta tag, since when titles have quotes History
	// Cooperative can't create a proper meta tag

	// 16apr08 - fwg
	// as of now, title meta tags are properly escaped, but 
	// in the case of book reviews, the title field is set to one of many (~10) variations
	// of "Book Review", so it's easiest to get the book title from the proprietary tags (below) as originally coded.
	
	var titleRe = /<!--_title_-->(.*)<!--_\/title_-->/;
	
	// 16apr08 - fwg
	// added trimInteral, since some pages have extraneous line breaks in source code
	// added unescapeHTML to make quotes nice 
	var m = titleRe.exec(Zotero.Utilities.trimInternal(doc.getElementsByTagName("body")[0].innerHTML));
	if(m) {
		newItem.title = Zotero.Utilities.trimInternal(Zotero.Utilities.unescapeHTML(m[1]));
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;

	var bookTitle;
	
	//different journals want their reviewed book titles formatted in different ways (or have bizarre markup)
	jNames = new Array ("The Western Historical Quarterly", "Journal of American Ethnic History", "Labour History","Environmental History",
						"New York History","Indiana Magazine of History");
					       
	jXpaths = new Array("//tr[4]/td[3]/table/tbody/tr[1]/td/b/i",
						"//[4]/td[3]/table/tbody/tr[1]/td/b/i",
						"//tr[4]/td[3]/table/tbody/tr[1]/td/b/b/i",
						"//tr[4]/td[3]/table/tbody/tr[1]/td/b[1]",
						"//tr[4]/td[3]/p[1]/font/b/i",
						"//tr[4]/td[3]/table[1]/tbody/tr[1]/td/h4/font/i"
						);
	
	// 16apr08 - fwg
	// figure out which Xpath to use
	// the below Xpath seems to work much of the time, so we default to it
	var jXpath ='//tr[4]/td[3]/table/tbody/tr[1]/td/i';
	
	for (var i=0; i < jNames.length; i++) {
		if (newItem.publicationTitle == jNames[i]) {
			//Zotero.debug("using Xpath for: " + jNames[i]);
			//Zotero.debug("Xpath is: " + jXpaths[i]);
			jXpath = jXpaths[i];
		}
	}	
	
	bookTitle = doc.evaluate(jXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	//Zotero.debug("bookTitle: " + bookTitle);
		
	// 16apr08 - fwg
	//instead of general failure, let's admit we can't get the title and save everything else
	// this is useful when a book review page has a one-off introduction or strange formatting that we can't anticipate.
	if (bookTitle) {
		newItem.title = "Review of " + bookTitle.textContent;
	} else {
		newItem.title = "Review of <unable to get title from page>";
		}
	}
	
	var author = metaTags.namedItem("Author");
	if(author) {
		var authors = author.getAttribute("content").split(" and ");
		for(j in authors) {
			authors[j] = authors[j].replace("Reviewed by ", "");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author"));
		}
	}
	
	var month = metaTags.namedItem("PublicationMonth");
	var year = metaTags.namedItem("PublicationYear");
	if(month && year) {
		newItem.date = month.getAttribute("content")+" "+year.getAttribute("content");
	}
	
	newItem.attachments.push({document:doc, title:"History Cooperative Snapshot"});
	
	newItem.complete();
}

function doWeb(doc, url) {
	var contents = doc.title.replace(" Contents | ", "");
	if(doc.title != contents || doc.title == "History Cooperative: Search Results") {
		var items = Zotero.Utilities.getItemArray(doc, doc, '^https?://[^/]+/journals/.+/.+/.+\.html$');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	} else {
		scrape(doc);
	}
}