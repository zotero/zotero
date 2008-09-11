{
	"translatorID":"35d6c82d-4749-4cc5-9e12-2924307df28f",
	"translatorType":4,
	"label":"UBC Library Catalog",
	"creator":"Adam Crymble",
	"target":"http://webcat(1||2).library.ubc",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	
	if (doc.evaluate('//tbody/tr/td[1]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//center/h4/i/strong/bdo', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

//UBC Library Catalog translator. Code by Adam Crymble

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
	var headersArray = new Array();
	var fieldTitle;
	
	var newItem = new Zotero.Item("book");

	var headers = doc.evaluate('//form/table/tbody/tr/th', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount= doc.evaluate('count (//form/table/tbody/tr/th)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var contents = doc.evaluate('//form/table', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var dump = contents.iterateNext();
	
	
	for (var i = 0; i < xPathCount.numberValue; i++) {
		fieldTitle = headers.iterateNext().textContent;
		if (fieldTitle.match(/\w/)) {
			headersArray.push(fieldTitle);
		}
	}
	
	var contentsArray = new Array();
	var j = 0;
	contents = contents.iterateNext().textContent.replace(/\s\s/g, '');
	
	for (var i = headersArray.length-1; i> -1; i--) {	 	
		
		var fieldIndex = contents.lastIndexOf(headersArray[i]);

		var headerLength = headersArray[i].length;
		
		contentsArray.push(contents.substr(fieldIndex+headerLength));
		contents = contents.substr(0, fieldIndex);
	
		fieldTitle = headersArray[i].replace(/\s+/g, '');
		if (fieldTitle == "Subject(s):") {
			if (contentsArray[j].match(". ")) {
				var tagsContent = contentsArray[j].split(". ")
			} else if (contentsArray[j].match(/\n/)) {
				var tagsContent = contentsArray[j].split(/\n/);
			} else {
				newItem.tags = contentsArray[j];
				var noMoreTags = 1;
			}
				
		}
		dataTags[fieldTitle] = contentsArray[j].replace(/^\s*|\s+$/g, '');
		
		j++;
	}	
	
	j = 0;
	
	if (noMoreTags != 1) {
		for (var i = 0; i < tagsContent.length; i++) {
		     	if (tagsContent[i].match(/\w/)) {
			     	newItem.tags[j] = tagsContent[i].replace(/^\s*|\s+$/g, '');
			     	j++;
		     	}
	     	}
	}
		
	if (dataTags["MainAuthor:"]) {
		var author = dataTags["MainAuthor:"];
		if (author.match(", ")) {
			var authors = author.split(", ");
			author = authors[1] + " " + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		} else {
			newItem.creators.push({lastName: author, creatorType: "creator"});				
		}
	}
	
	if (dataTags["OtherAuthor(s):"]) {
		var author = dataTags["OtherAuthor(s):"];
		
		if (author.match(", ")) {
			var authors = author.split(", ");
			author = authors[1] + " " + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));	
		} else {
			newItem.creators.push({lastName: author, creatorType: "creator"});				
		}
	}
	
	if (dataTags["Published:"]) {
		if (dataTags["Published:"].match(": ")) {
			var imprint = dataTags["Published:"];
			
			var place1 = imprint.indexOf(": ");
			
			newItem.place = imprint.substr(0, place1);
			
			var imprint2 = imprint.substr(place1+2);
			
			if (imprint2.match(/\d\d\d/)) {
				var date1 = imprint2.lastIndexOf(/\d\d\d/);
				var date2 = imprint2.substr(date1-4);
				newItem.date = date2;
				newItem.publisher = imprint2.substr(0, imprint2.length-(newItem.date.length+2));
			} else {
				newItem.publisher = imprint2;
			}
		} else {
			newItem.publisher = dataTags["Published:"]
		}
	}
	
	associateData (newItem, dataTags, "Title:", "title");
	associateData (newItem, dataTags, "CallNumber:", "callNumber");
	associateData (newItem, dataTags, "Description:", "pages");
	associateData (newItem, dataTags, "Location:", "repository");

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
		
		var titles = doc.evaluate('//form/table/tbody/tr/td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
				
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
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