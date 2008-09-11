{
	"translatorID":"c3edb423-f267-47a1-a8c2-158c247f87c2",
	"translatorType":4,
	"label":"Common-Place",
	"creator":"Frederick Gibbs",
	"target":"http://www.common-place\\.|historycooperative\\.org/journals/cp",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:30:00"
}

function detectWeb(doc, url) {
	if(doc.title.indexOf("Previous Issues") != -1 || doc.title.indexOf("Search Site") != -1 ) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function scrape(doc) {
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("journalArticle");
	newItem.publicationTitle = "Common-Place";
	newItem.url = doc.location.href;


	//get issue year and month
	//these will determine what xpaths we use for title and author
	var pubDate;
	var dateRe = /<a href="\/vol-[0-9]{2}\/no-[0-9]{2}\/">(.*)<\/a><\/b>/;
	var m = dateRe.exec(Zotero.Utilities.trimInternal(doc.getElementsByTagName("body")[0].innerHTML));

	if(m) {
		//newItem.title = Zotero.Utilities.trimInternal(Zotero.Utilities.unescapeHTML(m[1]));
		pubDate = m[1];
	} else {
	pubDate = doc.evaluate('//div[@id="container"]/div[@id="top"]/p/b/a[2]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	var d;
	//Zotero.debug(pubDate);
	pubDateVolRE = /vol. (.*) · no. /;
	d = pubDateVolRE.exec(pubDate);
	newItem.volume = d[1];

	pubDateVolRE = /no. (.*) ·/;
	d = pubDateVolRE.exec(pubDate);
	newItem.issue = d[1];

	pubDateVolRE = /no. [0-9] · (.*)/;
	d = pubDateVolRE.exec(pubDate);
	newItem.date = d[1];

	//usually the page begins with the article title or book title (of reviewed book)
	//some pages have an image just before them, so we need to skip it if it's there.
	var pLevel;
	var m=doc.evaluate('//div[@id="content"]/p[1]/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	
	//if there is an image here, offset the xpath
	if (m == null) {
		pLevel = '//div[@id="content"]/p[1]';
	} else { 
		pLevel = '//div[@id="content"]/p[2]';
	}
	
	//issues before 2004 have a table based layout, so a totally different xpath.
	//check to see if we have anything, then try again if we don't.
	var author;
	var title;
		
	author = doc.evaluate(pLevel+'/span[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	author = author.iterateNext();

	if (author != null) {
		//Zotero.debug("au"+author+"au");
		var title = doc.evaluate(pLevel+'/span[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		//Zotero.debug("ti"+title+"ti");
		title = title.iterateNext().textContent;		

		//determine if we have a book review
		// if so, get the publication information
		if (author.textContent.indexOf("Review by") != -1 ) {
			newItem.title = String.concat("Review of ", title);
			newItem.author = author.textContent.substring(10);
		} else {
			newItem.author = author.textContent;
			newItem.title = title;
		}

	}	
	else { //we have older issue
		
		//check if we are on a review
		var review = doc.evaluate('/html/body/table/tbody/tr/td[2]/p[2]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		var temp = review.textContent;
		if (temp.indexOf("Review") != -1) {
			title = doc.evaluate('/html/body/table/tbody/tr/td[2]/p/i', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			title = "Review of " + title; 
			author = review.textContent.substring(10);
		} else { //for articles
			title = doc.evaluate('/html/body/table/tbody/tr/td[2]/p/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			author = doc.evaluate('/html/body/table/tbody/tr/td[2]/p[1]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\n/)[1];
			//Zotero.debug(author);	
		}
		newItem.author = author;
		newItem.title = title;
	}
	
	newItem.attachments.push({document:doc, title:doc.title});
	
	newItem.complete();
}

function doWeb(doc, url) {
var type = detectWeb(doc, url);
if (type == "multiple") {
		
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
		//create list of items
		//what about home page (current issue table of contents?)
		//for search result links: /html/body/table[2]/tbody/tr/td[2]/li[3]/a
		//for previous issues: //tr/td/p/a/b (but we need to strip out volume links (starts with 'Volume')
		
	var link;
	var title;
	var items = new Object();
	var searchLinks = doc.evaluate('/html/body/table[2]/tbody/tr/td[2]/li/a', doc, nsResolver, XPathResult.ANY_TYPE, null);

		while (elmt = searchLinks.iterateNext()) {
			Zotero.debug(elmt.textContent);
			title = elmt.textContent;
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