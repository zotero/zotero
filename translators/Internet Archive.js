{
	"translatorID":"db0f4858-10fa-4f76-976c-2592c95f029c",
	"translatorType":4,
	"label":"Internet Archive",
	"creator":"Adam Crymble",
	"target":"http://www.archive.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:30:00"
}

function detectWeb(doc, url) {
	var mediaType = "1";
		
	if (doc.evaluate('//h3', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		mediaType  = doc.evaluate('//h3', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
	} else if (doc.evaluate('//div[@class="box"][@id="spotlight"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		mediaType  = doc.evaluate('//div[@class="box"][@id="spotlight"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
	}else if (doc.evaluate('//div[@class="box"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		mediaType  = doc.evaluate('//div[@class="box"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	if (mediaType == "The Item") {
		return "artwork";
	} else if ( mediaType.match("Spotlight")) {
		return "book";
	}else if (mediaType.match("book")) {
		return "book";
	} else if (mediaType.match("movie")) {
		return "videoRecording";
	} else if (mediaType.match("audio")) {
		return "audioRecording";
	} else 	if (doc.location.href.match("search") && mediaType == "1") {
		return "multiple"; 
	}	
}

//Internet Archive Translator. Code by Adam Crymble

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
	var fieldContents = new Array();
	var fieldTitleLength;
	
	var fieldTitle;
	var scrapeType = 0;
	
	var mediaType1 = detectWeb(doc, url);
	
	if (mediaType1 == "artwork") {
		
		var newItem = new Zotero.Item("artwork");
		
		//split contents by linebreak and push into an array if it is not empty
		var contents = doc.evaluate('//div[@id="col2"]/div[@class="box"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\n/);
		for (var i = 0; i < contents.length; i++) {
			if (contents[i].match(/\w/)) {
				fieldContents.push(contents[i]);
			}  
		}
		var headers = doc.evaluate('//div[@id="col2"]/div[@class="box"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var headersCount = doc.evaluate('count (//div[@id="col2"]/div[@class="box"]/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		for (var k = 0; k < headersCount.numberValue; k++) {
			fieldTitle = headers.iterateNext().textContent.toLowerCase();
			fieldTitleLength = fieldTitle.length;
			var fieldTitleSpot;
			
			for (var j = 0; j < fieldContents.length; j++) {
				if (fieldContents[j].match(fieldTitle)) {
					fieldTitleSpot = fieldContents[j].indexOf(fieldTitle);
					if (fieldTitleSpot != 0) {
						fieldContents[j] = fieldContents[j].substr(fieldTitleSpot + fieldTitleLength);
					} else {
						fieldContents[j] = fieldContents[j].substr(fieldTitleLength);
					}
							
					dataTags[fieldTitle] = fieldContents[j].replace(/^\s*|\s*$/g, '');
					fieldContents[j] = '';
				}
			}
		}

	} else if (mediaType1 == "book") {
		var newItem = new Zotero.Item("book");
		
		if (doc.evaluate('//div[@class="darkBorder roundbox"][@id="main"]/table/tbody/tr/td[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var headers = doc.evaluate('//div[@class="darkBorder roundbox"][@id="main"]/table/tbody/tr/td[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var contents = doc.evaluate('//div[@class="darkBorder roundbox"][@id="main"]/table/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var next_title;
			while (next_title = headers.iterateNext()) {
				fieldTitle = next_title.textContent.toLowerCase().replace(/\s+/g, '');
				if (!fieldTitle.match(":")) {
					fieldTitle = fieldTitle + ":";
				}
				fieldContent = contents.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
				dataTags[fieldTitle] = fieldContent;
			}
		}
		
	} else if (mediaType1 == "videoRecording") {
		var newItem = new Zotero.Item("videoRecording");
		scrapeType = 1;

	} else if (mediaType1 == "audioRecording") {
		var newItem = new Zotero.Item("audioRecording");
		scrapeType = 1;
	} 
	
	if (scrapeType == 1) {
		var xPathHeaders = '//div[@class="darkBorder roundbox"][@id="main"]/p[@class="content"]/span[@class="key"]';
		
		if (doc.evaluate('xPathHeaders', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var headers = doc.evaluate('xPathHeaders', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var contents =  doc.evaluate('//span[@class="value"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var next_title;
			while (next_title = headers.iterateNext()) {
				fieldTitle = next_title.textContent.toLowerCase().replace(/\s+/g, '');
				fieldContent = contents.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
				dataTags[fieldTitle] = fieldContent;
			}
		}
	}
	
	if (dataTags["creator:"]) {
		var author = dataTags["creator:"];
		if (author.match(", ")) {
			var authors = author.split(", ");
			author = authors[1] + " " + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "creator"));
		} else {
			newItem.creators.push({lastName: author, creatorType: "creator"});
		}
	}
	
	if (dataTags["author:"]) {
		var author = dataTags["author:"];
		if (author.match(", ")) {
			var authors = author.split(", ");
			author = authors[1] + " " + authors[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		} else {
			newItem.creators.push({lastName: author, creatorType: "author"});
		}
	}
	
	if (doc.evaluate('//div[@class="box"][@id="description"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.title = doc.evaluate('//div[@class="box"][@id="description"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else if (doc.evaluate('//div[@class="darkBorder roundbox"][@id="main"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.title = doc.evaluate('//div[@class="darkBorder roundbox"][@id="main"]/h1', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else {
		newItem.title = doc.title;
	}
	
	var tagsCount = "none";
	if (dataTags["keywords:"]) {
		if (dataTags["keywords:"].match(";")) {
			var tagsContent = (dataTags["keywords:"].split(";"));
			tagsCount = "multiple";
		} else if (dataTags["keywords:"].match(", ")) {
			var tagsContent = (dataTags["keywords:"].split(", "));
			tagsCount = "multiple";
		} else {
			var tagsContent = (dataTags["keywords:"]);
			tagsCount = "one";
		}
		if (tagsCount == "multiple") {
			for (var i = 0; i < tagsContent.length; i++) {
	     			newItem.tags[i] = tagsContent[i];
     			}
		} else if (tagsCount == "one") {
			newItem.tags = tagsContent;
		}
	}
	
	if (dataTags["publisher:"]) {
		if (dataTags["publisher:"].match(":")) {
			var place1 = dataTags["publisher:"].split(":");
			newItem.place = place1[0];
			newItem.publisher = place1[1];
		} else {
			associateData (newItem, dataTags, "publisher:", "publisher");
		}
	}
	
	if (dataTags["rights:"]) {
		associateData (newItem, dataTags, "rights:", "rights");
	} else if (dataTags["creativecommonslicense:"]) {
		newItem.rights = "Creative Commons License: " + dataTags["creativecommonslicense:"];
	}
	
	associateData (newItem, dataTags, "title:", "title");;
	associateData (newItem, dataTags, "date:", "date");
	associateData (newItem, dataTags, "callnumber:", "callNumber");
	
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
		
		var titles = doc.evaluate('//td[2][@class="hitCell"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titlesCount = doc.evaluate('count (//td[2][@class="hitCell"]/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		Zotero.debug(titlesCount.numberValue);
		
		var next_title;
		for (var i = 0; i < titlesCount.numberValue; i++) {
			next_title = titles.iterateNext();
			
			while (!next_title.href.match(/details/)) {
				i++;
				if (i == titlesCount.numberValue) {
					Zotero.debug(i);
					break;
				}
				next_title = titles.iterateNext();			
			}
			
			if (next_title.href.match(/details/)) {
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