{
	"translatorID":"c76d6c19-b4c6-4e51-bd7a-0a81752305ae",
	"translatorType":4,
	"label":"BC Archival Information Network",
	"creator":"Adam Crymble",
	"target":"http://(mayne.)?aabc.bc.ca/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-20 20:45:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	
	var entryType = (doc.evaluate('/html/body/h3', doc, nsResolver, XPathResult.ANY_TYPE, null));
	if (entryType.iterateNext()) {
		var entryType1 = entryType.iterateNext().textContent;
	
		if (entryType1.match("Search") && entryType1 != ("Search Results - BCAUL Repositories")) {
			return "multiple";
		} else if (entryType1.match("Display") && entryType1 != ("Display - BCAUL Repositories") && doc.location.href.match("display")) {
			return "book";
		}
	}
}

//BCAIN translator. Code by Adam Crymble

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("book");
	
	var dataTags = new Object();
	var manyAuthors = new Array();
	var tagsContent = new Array();
	
	var xPathHeaders = doc.evaluate('//td[1][@class="datalabel"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContent = doc.evaluate('//td[2][@class="datatext"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//td[1][@class="datalabel"])', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	Zotero.debug(xPathCount.numberValue);
	
	for (var i = 0; i < xPathCount.numberValue; i++) {
		fieldTitle = xPathHeaders.iterateNext().textContent.replace(/\s+/g, '');
		
		if (fieldTitle =="Provenance:") {
	     		
	     		dataTags[fieldTitle] = (xPathContent.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
	     		
	     		if (dataTags[fieldTitle].match("; ")) {
		     		manyAuthors = dataTags[fieldTitle].split("; ");
	     		} else {
		     		manyAuthors.push(dataTags[fieldTitle]);
	     		}
	     		
	     		for (var j = 0; j < manyAuthors.length; j++) {
	     			if (manyAuthors[j].match(", ")) {
		     			var authorName = manyAuthors[j].split(",");
		     			authorName[0] = authorName[0].replace(/^\s*|\s*$/g, '');
		     			newItem.creators.push(Zotero.Utilities.cleanAuthor((authorName[1] + (" ") + authorName[0]), "author"));
	     			} else {
		     			newItem.creators.push({lastName: dataTags["Provenance:"], creatorType: "creator"}); 
	     			}
	     		}
	     		
		} else if (fieldTitle == "Partof:") {
			
			dataTags[fieldTitle] = ("Part of " + Zotero.Utilities.cleanTags(xPathContent.iterateNext().textContent.replace(/^\s*|\s*$/g, '')));

		} else if (fieldTitle == "OnlineFindingAid:") {
			dataTags[fieldTitle] = ("Online Finding Aid: " + xPathContent.iterateNext().textContent);	
			Zotero.debug(dataTags["OnlineFindingAid:"]);
			
		} else if (fieldTitle == "Names:")  { 
			dataTags[fieldTitle] = (xPathContent.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
			tagsContent = dataTags[fieldTitle].split(";");
			
		} else {
		
			dataTags[fieldTitle] = Zotero.Utilities.cleanTags(xPathContent.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
		}
	}
	
	for (var i = 0; i < tagsContent.length; i++) {
	  	tagsContent[i] = tagsContent[i].replace(/^\s*|\s*$/g, '');
	  	newItem.tags[i] = tagsContent[i];
     	}
     		
	associateData (newItem, dataTags, "Title:", "title");
	associateData (newItem, dataTags, "Dates:", "date");
	associateData (newItem, dataTags, "Physicaldesc.:", "pages");
	associateData (newItem, dataTags, "Repository:", "repository");
	associateData (newItem, dataTags, "Scope/Content:", "abstractNote");
	associateData (newItem, dataTags, "Partof:", "series");
	associateData (newItem, dataTags, "OnlineFindingAid:", "extra");
	
	newItem.notes.push({title:"Title", note:"To view this entry in your browser, please go to'http://aabc.bc.ca/WWW.aabc.archbc/access' and search for the entry Title "});
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
		
		var xPathTitles = doc.evaluate('//tr[1]/td[2][@class="datatext"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var nextTitle;
		
		var xPathLinks = doc.evaluate('//td[1][@class="dataleft"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var nextLink;
		
		while (nextTitle = xPathTitles.iterateNext()) {
			items[xPathLinks.iterateNext().href] = nextTitle.textContent;	
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