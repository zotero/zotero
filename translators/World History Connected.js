{
	"translatorID":"0507797c-9bc4-4374-92ca-9e3763b6922b",
	"translatorType":4,
	"label":"World History Connected",
	"creator":"Frederick Gibbs",
	"target":"worldhistoryconnected\\.press|historycooperative.*/whc/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-06 08:15:00"
}

function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("journalArticle");
	newItem.url = doc.location.href;
	
	var titlePath;
	var bookTitle;
	var month, year;
	var metaTags = doc.getElementsByTagName("meta");

	associateMeta(newItem, metaTags, "Journal", "publicationTitle");
	associateMeta(newItem, metaTags, "Volume", "volume");
	associateMeta(newItem, metaTags, "Issue", "issue");

	// in the case of book reviews, the title field is blank
	//but quotes are not escaped properly, so if an article title begins with quotes, then the title tag looks blank even though it is not.
	//(though semantically it is)
	//they use the meta tag 'FileType' to indicate Aritlce or Book Review. silly, but we can use it.
	
	if (metaTags.namedItem('FileType').getAttribute("content") == 'Book Review') {
		//for a book review, title of reviewed book is
		titlePath = '/html/body/table[4]/tbody/tr[3]/td[1]/i';	
		newItem.title = "Review of " + doc.evaluate(titlePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	} else {
		//it would be nice to grab the title from the meta tags, but quotations are properly escaped and the tags are therefore malformed.
		titlePath = '/html/body/table[4]/tbody/tr[2]/td[1]/h2/font/b';
		newItem.title = Zotero.Utilities.superCleanString(doc.evaluate(titlePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
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
	
	newItem.attachments.push({document:doc, title:"World History Connected Snapshot"});
	
	newItem.complete();
}

function doWeb(doc, url) {
	
	var searchLinks;
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	if(doc.title.indexOf("Contents") != -1 || doc.title.indexOf("Search results") != -1) {

		if(doc.title.indexOf("Contents") != -1) {
		searchLinks = doc.evaluate('//tbody/tr[2]/td[1]/table/tbody/tr/td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);	
		} 
		else if ( doc.title.indexOf("Search results") != -1) {
		searchLinks = doc.evaluate('/html/body/dl/dt/strong/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		
		var link;
		var title;
		var items = new Object();
		
		while (elmt = searchLinks.iterateNext()) {
			Zotero.debug(elmt.href);
			title = Zotero.Utilities.superCleanString(elmt.textContent);
			link = elmt.href;
			if (title && link){
				items[link] = title;
			}
		}
	
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