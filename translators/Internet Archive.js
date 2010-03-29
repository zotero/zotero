{
	"translatorID":"db0f4858-10fa-4f76-976c-2592c95f029c",
	"translatorType":4,
	"label":"Internet Archive",
	"creator":"Adam Crymble",
	"target":"http://www.archive.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:30:00"
}

function detectWeb(doc, url) {
	var mediaType = "1";

	// iterate through links under item/bucket name to check for zoterocommons (the collection name)
	var links = doc.evaluate('//div/p/span/a', doc, null, XPathResult.ANY_TYPE, null);
	var link = null;
	while (next_link = links.iterateNext()) {
		link = next_link.textContent;
		if (link.match(/zoterocommons/)) {
			mediaType  = "commons";
			Zotero.debug("IA TRANS: scraping commons");
		}
	}
	
	if (mediaType == "commons") return "commons";
	
	else if (doc.evaluate('//h3', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
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
 		
	if (mediaType1 == "commons") {
		doWeb(doc, url);
		return;
	}
 	
 	else if (mediaType1 == "artwork") {	
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


function processRDFs(doc, url, articles) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
		
	var httpLink = doc.evaluate('//a[text()="HTTP"]/@href', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	for (var i=0 ; i<articles.length; i++) {
		rdfurl = articles[i];
		Zotero.debug("IA TRANS: looking at RDF: " + rdfurl);
		
		var text = Zotero.Utilities.retrieveSource(rdfurl);

		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("5e3ad958-ac79-463d-812b-a86a9235c28f"); // RDF
		//translator.setTranslator("14763d24-8ba0-45df-8f52-b8d1108e7ac9"); // Zotero RDF
		translator.setString(text);
		translator.waitForCompletion = true;
		translator.setHandler("itemDone", function(obj, item) {

			// get attachment filename from RDF
			var re = /<rdf:resource rdf:resource.*/g;
			var resources = text.match(re); 

			// process all attachments
			// TODO: do not add/keep attachment for regular PDF if full text version exists.
			for (var j=0; j<resources.length; j++) {
				Zotero.debug(resources[j]);
				var sep = resources[j].lastIndexOf("/",resources[j].length-3);
				var filename = resources[j].substr(sep+1,resources[j].length-sep-4).replace(/ /g,'-');
				filename = filename.replace(/-+/g,'-');					
				resourceURL = httpLink + "/" + filename;
				Zotero.debug("IA TRANS: attachment: " + resourceURL);
				item.attachments.push({url:resourceURL, title:filename});

				// if attachment is pdf, add OCR'd version (allow to fail if no OCR version exists)
				if (filename.match(/\.pdf/) && !filename.match(/_text/)) {
					resourceURL = resourceURL.substr(0,resourceURL.length-4) + "_text.pdf";
					filename = filename.substr(0,filename.length-4) + "_text.pdf";
					Zotero.debug("IA TRANS: attachment: " + resourceURL);
					item.attachments.push({url:resourceURL, title:filename, mimeType:"application/pdf"});
				}
				else { 
						Zotero.debug("not PDF or already _text");
				}
			}

			// item.DOI = item.url.match(/\.org\/(.*)$/)[1];
			// add access date and url
			item.accessDate = 'CURRENT_TIMESTAMP';
			
			// TODO: reference zip file, since bucket address could point to multiple items?
			item.url = doc.location.href;
			item.complete();
		} ); // end itemDone handler
		translator.translate();
	} // end for each RDF link
	function() {Zotero.done();};
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var items = new Object();
	var articles = new Array();
	var zipfile = null;
	var commons = false;
	var itemCount = 0;
	
	if (detectWeb(doc, url) == "commons") {
		commons = true;
		var titles = doc.evaluate('/html/body/div[5]/div/table/tbody/tr/td[2]/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var httpLink = doc.evaluate('//a[text()="HTTP"]/@href', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

		// scrape the item titles and item keys off page for selection
		// TODO: if called from scrape (ie getting a bucket from search result page), get all items automatically?
		while(next_title = titles.iterateNext()) {
			Zotero.debug("examining:" + next_title.textContent);
			if (next_title.textContent.match(/\|/)) {
				split = next_title.textContent.split('|');
				zipfile = split[1].substr(0,split[1].length-4) + ".rdf";
				zipfile = httpLink + "/" + zipfile;
				items[zipfile] = split[0];
				Zotero.debug("added: "+ zipfile + " = " + split[0]);
				itemCount++;
			}
		}

		if (itemCount > 1) {
			items = Zotero.selectItems(items);
			for (var i in items) {
				articles.push(i);
			}
		}
		else {
			articles.push(zipfile)
		}
	} 
	else if (detectWeb(doc, url) == "multiple") {
		Zotero.debug("multiple");
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

	if (!commons)	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	else processRDFs(doc,url, articles);
	
	Zotero.wait();
}