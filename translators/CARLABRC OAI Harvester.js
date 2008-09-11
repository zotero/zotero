{
	"translatorID":"31649d9d-8f7e-4b87-8678-b3e68ee98f39",
	"translatorType":4,
	"label":"CARL/ABRC OAI Harvester",
	"creator":"Adam Crymble",
	"target":"http://carl-abrc-oai",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.title.match("Search")) {
		return "multiple";
	} else if (doc.title.match("Browse")) {
		return "multiple";
	} else if (doc.title.match("Record")) {
		return "book";
	}
}

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
	
	var dataTags = new Object();
	var allAuthors = new Array();
	
	var newItem = new Zotero.Item("book");

	var metaTagHTML = doc.getElementsByTagName("meta");
	
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		dataTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
		if (metaTagHTML[i].getAttribute("name") == "DC.Creator") {
			allAuthors.push(dataTags["DC.Creator"]);
		}
		
	}
	Zotero.debug(allAuthors);
	
	for (var i = 0; i < allAuthors.length; i++) {
		
		
		if (allAuthors[i].match(",")) {
			var authorName = allAuthors[i].split(",");
			allAuthors[i] = (authorName[1] + (" ") + authorName[0]);
		
			if (allAuthors[i].match("; ; ")) {
				
				allAuthors[i] = allAuthors[i].replace("; ;", '');
			}
				
			
			newItem.creators.push(Zotero.Utilities.cleanAuthor(allAuthors[i], "author"));
		} else {
			if (allAuthors[i].match("; ; ")) {
				
				allAuthors[i] = allAuthors[i].replace("; ;", '');
			}
			
			newItem.creators.push({lastName: allAuthors[i], creatorType: "creator"}); 
		}
		
		
	}
		

	associateData (newItem, dataTags, "DC.Title", "title");
	associateData (newItem, dataTags, "DC.Description", "abstractNote");
	associateData (newItem, dataTags, "DC.Publisher", "publisher");
	associateData (newItem, dataTags, "DC.Contributor", "extra");
	associateData (newItem, dataTags, "DC.Date", "date");
	associateData (newItem, dataTags, "DC.Language", "language");

	
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
		
		var titles = doc.evaluate('//span[@class="title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate('//div[@class="main"]/div/div/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[links.iterateNext().href] = next_title.textContent;
			links.iterateNext();
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