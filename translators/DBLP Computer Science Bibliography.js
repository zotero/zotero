{
	"translatorID":"625c6435-e235-4402-a48f-3095a9c1a09c",
	"translatorType":4,
	"label":"DBLP Computer Science Bibliography",
	"creator":"Adam Crymble",
	"target":"http://(search?|dblp?).mpi-inf",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.title.match("journals")) {
		return "journalArticle";
	} else if (doc.title.match("conf")) {
		return "conferencePaper";
	} else if (doc.title.match("DBLP entry")) {
		return "bookSection";
	}
}


//DBLP Computer Science Database Translator. Code by Adam Crymble.
//Doesn't work for multiple entries. Site uses a different URL for the search and single entry. Multiple code attached as comment.

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	} : null;	
	
	var dataTags = new Object();
	
	var mediaType = detectWeb(doc, url);
	
	if (mediaType == "bookSection") {
		var newItem = new Zotero.Item("bookSection");
	} else if (mediaType == "conferencePaper") {
		var newItem = new Zotero.Item("conferencePaper");
	} else if (mediaType == "journalArticle") {
		var newItem = new Zotero.Item("journalArticle");
	}
	
	var xPathAllData = doc.evaluate('//pre', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var allData = xPathAllData.iterateNext().textContent.split("},");
	
	var cleanFirstEntry = allData[0].indexOf(",");
	allData[0] = allData[0].substr(cleanFirstEntry);

	var headers = new Array();
	var content = new Array();
	var splitAllData;
	
	for (var i = 0; i < allData.length-2; i++) {
		splitAllData = allData[i].split("=");
		headers.push(splitAllData[0].replace(/^\s*|\s*$|\W*/g, ''));
		content.push(splitAllData[1].replace(/^\s*|\s*$|\{*/g, ''));
		
		fieldTitle = headers[i].replace(",", '');
	
		if (fieldTitle == "author") {
			var authors = content[i].split("and");
	
			for (var j =0; j<authors.length; j++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author"));
			}
		} else if (fieldTitle == "editor") {
			var editors = content[i].split("and");

			for (var j =0; j<editors.length; j++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(editors[j], "editor"));
			}
		} else {

			dataTags[fieldTitle] = content[i];
		}
	}

	if (mediaType == "conferencePaper") {
		associateData (newItem, dataTags, "booktitle", "conferenceName");
	} else {
		associateData (newItem, dataTags, "booktitle", "bookTitle");
	}
	
	newItem.url = doc.location.href;
	
	associateData (newItem, dataTags, "year", "date");
	associateData (newItem, dataTags, "pages", "pages");
	associateData (newItem, dataTags, "title", "title");	
	associateData (newItem, dataTags, "publisher", "publisher");
	associateData (newItem, dataTags, "volume", "volume");
	associateData (newItem, dataTags, "isbn", "ISBN");
	associateData (newItem, dataTags, "series", "series");
	associateData (newItem, dataTags, "journal", "publicationTitle");
	associateData (newItem, dataTags, "number", "issue");

	newItem.complete();

}



function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	/* Multiple code doesn't work due to Permission denied to get property HTMLDocument.documentElement error.
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		//newer interface xPaths
		if (doc.title.match("DEMO")) {
			
			var titles = doc.evaluate('//a/font', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//dt/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var next_title;
			while (next_title = titles.iterateNext()) {
				items[links.iterateNext().href] = next_title.textContent;
			}
			
		//older interface xPaths	
		} else {
				
			var titles = doc.evaluate('//td[3]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//td[1]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var next_title;
			var split1;
			var split2;
			
			while (next_title = titles.iterateNext()) {
				
				split1 = next_title.textContent.indexOf(":");
				var title = next_title.textContent.substr(split1+2);
				split2 = title.indexOf(".");
				title = title.substr(0, split2);
			
				items[links.iterateNext().href] = title;
			}
		
		}

		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		
	} else {
	
		*/
		
		articles = [url];
	//}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}