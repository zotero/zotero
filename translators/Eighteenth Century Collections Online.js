{
	"translatorID":"00ce0d68-9205-40e6-91f4-c96f7ab296c2",
	"translatorType":4,
	"label":"Eighteenth Century Collections Online",
	"creator":"Adam Crymble",
	"target":"http://galenet.galegroup.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td[2][@class="stnd"]/a/i/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//td[3]/span[@class="stnd"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "bookSection";
	} else if (doc.evaluate('//span[@class="stnd"]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}


//Eighteenth Century Collections Online translator. Code by Adam Crymble


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
	var tagsContent = new Array();
	var fieldTitle;
	
	var newItem = new Zotero.Item("book");

	var headers = doc.evaluate('//td[1][@class="stnd"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//td[2][@class="stnd"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	while (fieldTitle = headers.iterateNext()) {
		
		fieldTitle = fieldTitle.textContent.replace(/\s+/g, '');
		fieldContent = contents.iterateNext().textContent;
		
		while (fieldContent.length<2) {
			if (fieldContent.match(/\d/)) {
				break;
			} else {
				fieldContent = contents.iterateNext().textContent;	
			}			
		}
		dataTags[fieldTitle] = fieldContent.replace(/^\s*|\s*$/g, '');		
	}
		
	if (dataTags["Author"]) {
		if (dataTags["Author"].match(/\n/)) {
			var author = dataTags["Author"].split(/\n/);
			dataTags["Author"] = author[0];

		}
		if (dataTags["Author"].match(", ")) {
			var author = dataTags["Author"].split(", ");
			author = author[1] + " " + author[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		} else {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Author"], "author"));	
		}
	}
	
	if (dataTags["GaleDocumentNumber"]) {
		newItem.extra = "Gale Document Number: " + dataTags["GaleDocumentNumber"];
	}
	
	if (dataTags["18thCenturyMicrofilmReel#"]) {
		newItem.locInArchive = "18th Century Microfilm Reel #: " + dataTags["18thCenturyMicrofilmReel#"];
	}
	
	if (dataTags["Imprint"]) {
		if (dataTags["Imprint"].match(": ")) {
			var place1 = dataTags["Imprint"].split(": ");
			newItem.place = place1[0];
			if (place1[1].match(", ")) {
				var pub1 = place1[1].split(", ");
				newItem.publisher = pub1[0];
				newItem.date = pub1[1];
			} else {
				newItem.publisher = place1[1];
			}
		} else {
			newItem.publisher = dataTags["Imprint"];
		}
	}
	
	associateData (newItem, dataTags, "Title", "title");
	associateData (newItem, dataTags, "Language", "language");
	associateData (newItem, dataTags, "Pages", "page");
	associateData (newItem, dataTags, "SourceLibrary", "repository");
	associateData (newItem, dataTags, "Volume", "volume");
	associateData (newItem, dataTags, "Notes", "abstractNote");

	newItem.url = doc.location.href;

	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var items = new Object();	
	var articles1 = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var titles = doc.evaluate('//td[2][@class="stnd"]/a/i/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate('//td[2][@class="stnd"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			var link = links.iterateNext();
				
			while (link.textContent!="Full Citation") {
				link = links.iterateNext();
			}
			
			items[link.href] = next_title.textContent;
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles1.push(i);
		}
		
	} else if (detectWeb(doc, url) == "bookSection") {
	
		var links = doc.evaluate('//td[3]/span[@class="stnd"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var articles = links.iterateNext();
		Zotero.debug(articles);
		
		articles1.push(articles.href);
		
	} else {
		articles1 = [url];
	}
	
	Zotero.Utilities.processDocuments(articles1, scrape, function() {Zotero.done();});
	Zotero.wait();
}