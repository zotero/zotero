{
	"translatorID":"6871e8c5-f935-4ba1-8305-0ba563ce3941",
	"translatorType":4,
	"label":"PEI Archival Information Network",
	"creator":"Adam Crymble",
	"target":"http://www.archives.pe.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-11 20:40:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (doc.evaluate('//td[2]/table/tbody/tr/td/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match("Search")) {
		return "multiple";
	
	} else if (doc.evaluate('//td[2]/table/tbody/tr/td/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match("Display")){
		return "book";
	}
}

//PEI Archival Information Network translator: Code by Adam Crymble

var authors;

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function authors1() {
	for (var k = 0; k< authors.length; k++) { 
		if (authors[k].match(", ")) {
			var author = authors[k].split(", ");
			authors[k] = (author[1] + (" ") + author[0].replace(/^\s*|\s*$/g, ''));
						
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[k], "author"));  		
		
		} else {
				
			newItem.creators.push({lastName: authors[k], creatorType: "creator"}); 
		}	
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var dataTags = new Object();
	var fieldTitle;
	var contents;
	var tagsContent = new Array();
	
	newItem = new Zotero.Item("book");

	var xPathHeadings = doc.evaluate('//small/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContents = doc.evaluate('//dd', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//small/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	for (i=0; i<xPathCount.numberValue; i++) {	 
			
		fieldTitle  = xPathHeadings.iterateNext().textContent.replace(/\s+/g, '');
		contents = xPathContents.iterateNext().textContent;
		
		if (fieldTitle == "AccessPoints") {
			
		//creates Author
			dataTags["Author"] = (contents.substr(11).replace(/^\s*|\s*$/g, ''));
			contents = xPathContents.iterateNext().textContent;
			
				authors = dataTags["Author"].split(/\n/);
				authors1();		
				
		//creates Other Authors (if any)				
			dataTags["OtherAuthor"] = (contents.substr(13).replace(/^\s*|\s*$/g, ''));
			contents = xPathContents.iterateNext().textContent;
			
				if (dataTags["OtherAuthor"].match("no Other Author access points found")) {
					
				} else {
					
					authors = dataTags["OtherAuthor"].split(/\n/);
					authors1();
				}
		
		//creates tags
			dataTags["subject"] = (contents);
			var tags;
			
			var tagLinks = doc.evaluate('//dd/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tagsLinksCount = doc.evaluate('count (//dd/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);

				for (j = 0; j < tagsLinksCount.numberValue; j++) {
			
					tags = tagLinks.iterateNext();
					if (tags.href.match("subject")) {
					  	tagsContent.push(tags.textContent);
				 	 }
				}		
		} else {
			
			dataTags[fieldTitle] = (contents.replace(/^\s*|\s*$/g, ''));
		}	
	}	

	for (var i = 0; i < tagsContent.length; i++) {
		newItem.tags[i] = tagsContent[i];
	}
	
	associateData (newItem, dataTags, "NameofRepository", "repository");
	associateData (newItem, dataTags, "DatesofCreation", "date");
	associateData (newItem, dataTags, "Identifier", "callNumber");
	associateData (newItem, dataTags, "PhysicalDescription", "extra");
	associateData (newItem, dataTags, "ScopeAndContent", "abstractNote");
	associateData (newItem, dataTags, "Title/StmntofResponsibility", "title");

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
		
		var xPathTitles = doc.evaluate('//td/ul', doc, nsResolver, XPathResult.ANY_TYPE, null);

		var linkContent = xPathTitles.iterateNext().textContent.split(/\n/);	
		

		var linkContent1;
		var linkHref = new Array();

		var xPathLinks= doc.evaluate('//ul/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var xPathLinksCount = doc.evaluate('count (//ul/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		for (i=0; i< xPathLinksCount.numberValue; i++) {
			linkHref.push(xPathLinks.iterateNext().href);
	
			var y = (i + 1);
			linkContent1 = linkContent[y].split("- ");
			
			
			items[linkHref[i]] = linkContent1[1];
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