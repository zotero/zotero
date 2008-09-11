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
	"lastUpdated":"2008-08-04 07:10:00"
}

function detectWeb(doc, url) {
	
	if (doc.location.href.match("Search")) {
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
	var headings = new Array();
	var newItem = new Zotero.Item("patent");

 //checks format type
	if (doc.location.href.match("printsec")) {
		
		var contents = doc.evaluate('//table[@id="summarytable"]/tbody/tr[1]/td', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var xPathHeadings = doc.evaluate('//b', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var xPathCount = doc.evaluate('count (//b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		if (doc.evaluate('//span[@class="addmd"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
			var author = doc.evaluate('//span[@class="addmd"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "inventor"));
		}
	
	} else {
	
		var xPathHeadings = doc.evaluate('//div[@class="patent_bibdata"]/p/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		var xPathCount = doc.evaluate('count (//div[@class="patent_bibdata"]/p/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	
		var xPathContents = doc.evaluate('//div[@class="patent_bibdata"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var contentsCount = doc.evaluate('count (//div[@class="patent_bibdata"]/p)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var contents;
		for (i = 0; i < contentsCount.numberValue; i++) {
			contents = (contents + xPathContents.iterateNext().textContent + " ");
		}
		
		if (doc.evaluate('//td[3]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.abstractNote = (doc.evaluate('//td[3]/p', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace("Abstract", ''));
		}	
	
	}
	
	for (var i =0; i < xPathCount.numberValue; i++) {
		
		headings.push(xPathHeadings.iterateNext().textContent);	
		contents = contents.replace(headings[i], "xxx");	
	}
	
	
	var splitContent = new Array();
	splitContent = contents.split(/xxx/);

 //associate headings with contents.
	for (var i = 0; i < headings.length; i++) {
		fieldTitle = headings[i].replace(/\s+|\W*/g, '');
		
		if (fieldTitle == "USClassification" | fieldTitle == "InternationalClassification" | fieldTitle == "Abstract") {
			dataTags[fieldTitle] = splitContent[i+1];
		} else {
			dataTags[fieldTitle] = splitContent[i+1].replace(": ", '');
		}
	
		if (dataTags[fieldTitle].match("About this patent")) {
			dataTags[fieldTitle] = dataTags[fieldTitle].replace("About this patent", '');
		}
		
	//author(s)
		if (fieldTitle == "Inventors") {
			var authors = dataTags[fieldTitle].split(", ");
			for (var j = 0; j < authors.length; j++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "inventor"));
			}
		} else if (fieldTitle == "Inventor") {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Inventor"], "inventor"));
		}
	}

 //extra field
	if (dataTags["USClassification"] && dataTags["InternationalClassification"]) {
		Zotero.debug(doc.title);
		newItem.extra = ("U.S. Classification: " + dataTags["USClassification"] + "; International Classification: " + dataTags["InternationalClassification"]);
	} else if (dataTags["USClassification"] ) {
		newItem.extra = ("U.S. Classification: " + dataTags["USClassification"]);
	} else if (dataTags["InternationalClassification"]) {
		newItem.extra = ("International Classification: " + dataTags["InternationalClassification"]);
	}

	associateData (newItem, dataTags, "Patentnumber", "patentNumber");
	associateData (newItem, dataTags, "Issuedate", "date");
	associateData (newItem, dataTags, "Assignees", "assignee");
	associateData (newItem, dataTags, "Assignee", "assignee");
	associateData (newItem, dataTags, "Abstract", "abstractNote");
	associateData (newItem, dataTags, "Applicationnumber", "applicationNumber");
	
	newItem.title = doc.evaluate('//h2[@class="title"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
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
		
		var xPathFirstTitle = doc.evaluate('//div[@id="results_container"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var firstTitle = xPathFirstTitle.iterateNext();
		
		var titles = doc.evaluate('//p/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		items[firstTitle.href] = firstTitle.textContent;
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.textContent.match("RSS feed")) {
				
			} else {
				items[next_title.href] = next_title.textContent;
			}
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
