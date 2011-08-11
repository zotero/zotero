{
	"translatorID": "d71e9b6d-2baa-44ed-acb4-13fe2fe592c0",
	"label": "Google Patents",
	"creator": "Adam Crymble",
	"target": "^http://www\\.google.*/patents",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-16 14:00:40"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(doc.location.href.match(/[?&]q=/)) {
		return "multiple";
	} else if(doc.location.href.match(/[?&]id=/)) {
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
	var dataTags = new Object();
	var newItem = new Zotero.Item("patent");

	//Grab the patent_bibdata items and the text node directly next to them 
	var xPathHeadings = doc.evaluate('//div[@class="patent_bibdata"]//b', doc, null, XPathResult.ANY_TYPE, null);
	var xPathContents = doc.evaluate('//div[@class="patent_bibdata"]//b/following::text()[1]', doc, null, XPathResult.ANY_TYPE, null);
	
	// create an associative array of the items and their contents
	var heading, content;
	while( heading = xPathHeadings.iterateNext(), content = xPathContents.iterateNext()){
		if(heading.textContent == 'Publication number'){
			content = doc.evaluate('//div[@class="patent_bibdata"]//b[text()="Publication number"]/following::nobr[1]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		}
		dataTags[heading.textContent] = content.textContent.replace(": ", '');;
		//Zotero.debug(dataTags);
	}
	
	if (doc.evaluate('//td[3]/p', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = (doc.evaluate('//td[3]/p', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace("Abstract", ''));
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
	
	//extra field
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
		
		if (fieldTitle == "Current U.S. Classification"  ) {
			newItem.extra += "U.S. Classification: " + dataTags["Current U.S. Classification"]+"\n";
		} else if (fieldTitle == "International Classification" ) {
			newItem.extra += "International Classification: " + dataTags["International Classification"]+"\n";
		}	else if (fieldTitle == "Publication number" ) {
			newItem.extra += "Publication number: " +dataTags["Publication number"]+"\n";
		}
	}

	associateData (newItem, dataTags, "Patent number", "patentNumber");
	associateData (newItem, dataTags, "Issue date", "date");
	associateData (newItem, dataTags, "Filing date", "filingDate");
	associateData (newItem, dataTags, "Assignees", "assignee");
	associateData (newItem, dataTags, "Assignee", "assignee");
	associateData (newItem, dataTags, "Abstract", "abstractNote");
	associateData (newItem, dataTags, "Application number", "applicationNumber");
	
	var pdf = doc.evaluate('//div[@class="g-button-basic"]/span/span/a[contains(@href,"/download/)]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if (pdf) newItem.attachments.push({url:pdf.href, title:"Google Patents PDF", mimeType:"application/pdf"});
	newItem.title = doc.evaluate('//h1[@class="gb-volume-title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.url = doc.location.href.replace(/(^[^\?]*\?id=[a-zA-Z0-9]+).*/,"$1");

	newItem.complete();
}

function doWeb(doc, url) {
	var host = 'http://' + doc.location.host + "/";
	
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, /\/patents(?:\/about)?\?id=/);
		Zotero.selectItems(items, function (items) {
			var articles = new Array();
			for (var i in items) {
				articles.push(i);
			}
			Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
			Zotero.wait();
		});			
	} else {
		scrape(doc);
	}
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.google.com/patents/about?id=j5NSAAAAEBAJ",
		"items": [
			{
				"itemType": "patent",
				"creators": [
					{
						"firstName": "T.",
						"lastName": "SHOOK",
						"creatorType": "inventor"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"extra": "U.S. Classification: 215/273",
				"patentNumber": "1065211",
				"date": "Jun 17, 1913",
				"filingDate": "Aug 3, 1912",
				"title": "BOTTLE-STOPPER",
				"url": "http://www.google.com/patents/about?id=j5NSAAAAEBAJ",
				"libraryCatalog": "Google Patents"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.google.com/search?tbm=pts&tbo=1&hl=en&q=book&btnG=Search+Patents",
		"items": "multiple"
	}
]
/** END TEST CASES **/
