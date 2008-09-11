{
	"translatorID":"f9373e49-e6ac-46f7-aafe-bb24a2fbc3f0",
	"translatorType":4,
	"label":"Bracero History Archive",
	"creator":"Adam Crymble",
	"target":"http://braceroarchive.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.title.match("Item")) {
		return "book";
	} else if (doc.evaluate('//div[@class="item-meta"]/h2/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

//Bracero History Archive translator; Code by Adam Crymble

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
	var fieldTitle;
	var contents1;

	var headers = doc.evaluate('//h3', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//div[@class="field"]/div', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//div[@class="field"]/div)', doc, nsResolver, XPathResult.ANY_TYPE, null);

	for (i=0; i<xPathCount.numberValue -1; i++) {	 	
     			
     		fieldTitle = headers.iterateNext().textContent.replace(/\s+/g, '');
     		contents1 = contents.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
  
     		if (contents1.match("Empty")) {
	     		contents1 = '';
     		}
     		dataTags[fieldTitle] = Zotero.Utilities.cleanTags(contents1);
     	}

   //media type?
	if (dataTags["TypeName"]) {
		if (dataTags["TypeName"].match("Oral History")) {
			Zotero.debug(doc.title);
			var newItem = new Zotero.Item("audioRecording");
		} else {
			var newItem = new Zotero.Item("book");
		}
	} else {
			var newItem = new Zotero.Item("book");
	}
	
   //creators	
	if (dataTags["Interviewee"] && dataTags["Interviewee"] != '') {
		if (dataTags["Interviewee"].match(", ")) {
			var authors = dataTags["Interviewee"].split(", ");
			authors = authors[1] + ' ' + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "interviewee"));
		} else {
			newItem.creators.push({lastName: dataTags["Interviewee"], creatorType: "interviewee"});
		}
	}
	
	if (dataTags["Interviewer"] && dataTags["Interviewer"] != '') {
		if (dataTags["Interviewer"].match(", ")) {
			var authors = dataTags["Interviewer"].split(", ");
			authors = authors[1] + ' ' + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "interviewer"));
		} else {
			newItem.creators.push({lastName: dataTags["Interviewee"], creatorType: "interviewer"});
		}
	}
	
	if (dataTags["Creator"] && dataTags["Creator"] != '') {
		if (dataTags["Creator"].match(", ")) {
			var authors = dataTags["Creator"].split(", ");
			authors = authors[1] + ' ' + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "creator"));
		} else {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Creator"], "creator"));
		}
	}
	
	if (dataTags["AdditionalCreator"] && dataTags["AdditionalCreator"] != '') {
		if (dataTags["AdditionalCreator"].match(", ")) {
			var authors = dataTags["AdditionalCreator"].split(", ");
			authors = authors[1] + ' ' + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors, "creator"));
		} else {
			newItem.creators.push({lastName: dataTags["AdditionalCreator"], creatorType: "creator"});
		}
	}
	
   //associate	
	associateData (newItem, dataTags, "Description", "abstractNote");
	associateData (newItem, dataTags, "Date", "date");
	associateData (newItem, dataTags, "Publisher", "publisher");
	associateData (newItem, dataTags, "Source", "place");
	associateData (newItem, dataTags, "Location", "place");
	associateData (newItem, dataTags, "RightsHolder", "rights");
	associateData (newItem, dataTags, "Language", "lang");
	associateData (newItem, dataTags, "Title:", "title");
	associateData (newItem, dataTags, "FileNameIdentifier", "callNumber");

   //tags
	var tags1;
	var tagsContent = new Array();

	if (doc.evaluate('//li[@class="tag"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
	 	var xPathTags = doc.evaluate('//li[@class="tag"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	 	while (tags1 = xPathTags.iterateNext()) {
		 	tagsContent.push(tags1.textContent);
	 	}
	}

	for (var i = 0; i < tagsContent.length; i++) {
		newItem.tags[i] = tagsContent[i];
	}
	
   //title	
	newItem.title = doc.evaluate('//h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	newItem.url = doc.location.href;
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	var fullRecord = "view=full";
	var extraChar = "?";
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
				
		var titles = doc.evaluate('//div[@class="item-meta"]/h2/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href + extraChar + fullRecord] = next_title.textContent;
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