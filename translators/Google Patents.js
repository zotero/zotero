{
	"translatorID":"d71e9b6d-2baa-44ed-acb4-13fe2fe592c0",
	"translatorType":4,
	"label":"Google Patents",
	"creator":"Adam Crymble",
	"target":"http://www\\.google.*/patents",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-07-29 06:35:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (doc.evaluate('//font[contains(./text(), "Result")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.location.href.match("id")) {
		return "patent";
	}
	
}

//Google Patents Translator. Code by Adam Crymble

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
	var newItem = new Zotero.Item("patent");

	//Grab the patent_bibdata items and the text node directly next to them 
	var xPathHeadings = doc.evaluate('//div[@class="patent_bibdata"]//b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContents = doc.evaluate('//div[@class="patent_bibdata"]//b/following::text()[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	// create an associative array of the items and their contents
	var heading, content;
	while( heading = xPathHeadings.iterateNext(), content = xPathContents.iterateNext()){
		if(heading.textContent == 'Publication number'){
			content = doc.evaluate('//div[@class="patent_bibdata"]//b[text()="Publication number"]/following::nobr[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		}
		dataTags[heading.textContent] = content.textContent.replace(": ", '');;
		//Zotero.debug(dataTags);
	}
	
	if (doc.evaluate('//td[3]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = (doc.evaluate('//td[3]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace("Abstract", ''));
	}	
	
	
	/*
	for (var i =0; i < xPathCount.numberValue; i++) {
		
		headings.push(xPathHeadings.iterateNext().textContent);	
		contents = contents.replace(headings[i], "xxx");	
	}
	
	
	var splitContent = new Array();
	splitContent = contents.split(/xxx/);
	*/
 //associate headings with contents.

//extra field\
	newItem.extra = '';

	for (fieldTitle in dataTags) {
		Zotero.debug(fieldTitle);
		//fieldTitle = item.replace(/\s+|\W*/g, '');
		/*
		if (fieldTitle == "US Classification" | fieldTitle == "International Classification" | fieldTitle == "Abstract") {
			dataTags[fieldTitle] = splitContent[i+1];
		} else {
			dataTags[fieldTitle] = splitContent[i+1].replace(": ", '');
		}
		*/
		if (dataTags[fieldTitle].match("About this patent")) {
			dataTags[fieldTitle] = dataTags[fieldTitle].replace("About this patent", '');
		}
		
	//author(s)
		if (fieldTitle == "Inventors" | fieldTitle == "Inventor") {
			var authors = dataTags[fieldTitle].split(", ");
			for (var j = 0; j < authors.length; j++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "inventor"));
			}
		} else if (fieldTitle == "Inventor") {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Inventor"], "inventor"));
		}
		
		if (fieldTitle == "U.S. Classification"  ) {
			newItem.extra += "U.S. Classification: " + dataTags["U.S. Classification"]+"\n";
		} else if (fieldTitle == "International Classification" ) {
			newItem.extra += "International Classification: " + dataTags["International Classification"]+"\n";
		} else if (fieldTitle == "Filing date" ) {
			newItem.extra += "Filing Date: " + dataTags["Filing date"]+"\n";
		}	else if (fieldTitle == "Publication number" ) {
			newItem.extra += "Publication number: " +dataTags["Publication number"]+"\n";
		}
	}

 

	associateData (newItem, dataTags, "Patent number", "patentNumber");
	associateData (newItem, dataTags, "Issue date", "date");
	associateData (newItem, dataTags, "Assignees", "assignee");
	associateData (newItem, dataTags, "Assignee", "assignee");
	associateData (newItem, dataTags, "Abstract", "abstractNote");
	associateData (newItem, dataTags, "Application number", "applicationNumber");
	
	newItem.title = doc.evaluate('//h1[@class="title"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.url = doc.location.href;

	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var host = 'http://' + doc.location.host + "/";
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var iterator = doc.evaluate('//a[@class = "big"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = [];
		var element = iterator.iterateNext();
		var items = new Object();
		while(element) {
			items[element.href] = element.textContent;
			element = iterator.iterateNext(); 
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for (var i in items) {
			articles.push(i);
		}
	
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
	
}
