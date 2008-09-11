{
	"translatorID":"b10bf941-12e9-4188-be04-f6357fa594a0",
	"translatorType":4,
	"label":"Old Bailey Online",
	"creator":"Adam Crymble",
	"target":"http://www.oldbaileyonline.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-11 20:40:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("search")) {
		return "multiple";
	} else if (doc.location.href.match("browse")) {
		return "case";
	}
}

//Old Bailey Online translator. Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var tagsContent = new Array();
	var fieldTitle;
	
	var newItem = new Zotero.Item("case");

	var headers = doc.evaluate('//div[@class="apparatus"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//div[@class="apparatus"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var xPathCount = doc.evaluate('count (//div[@class="apparatus"]/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var headersArray = new Array();
	var oneHeader = '';

	if (xPathCount.numberValue > 1) {
		for (var i = 0; i < xPathCount.numberValue; i++) {
			fieldTitle = headers.iterateNext().textContent;
			headersArray.push(fieldTitle);
		}
	} else {
		oneHeader = (headers.iterateNext().textContent);
	}
	
	var contentsArray = new Array();
	var j = 0;
	
	if (oneHeader.length<1) {
	
		for (var i = headersArray.length-1; i> -1; i--) {	 	
		
			var fieldIndex = contents.indexOf(headersArray[i]);
			
			contentsArray.push(contents.substr(fieldIndex));
			contents = contents.substr(0, fieldIndex);
			fieldTitle = headersArray[i].replace(/\s+/g, '');
			
			if (fieldTitle != "ReferenceNumber:") {
				tagsContent.push(contentsArray[j]);
			} else {
				newItem.extra = contentsArray[j];
			}
			j++;
		}
	} else {

		if (oneHeader.match("Reference")) {
			
			newItem.extra = contents;
		} else {
			newItem.tags = contents;
			var noMoreTags = 1;
		}
	}
		
	if (noMoreTags != 1) {
		for (var i = 0; i < tagsContent.length; i++) {
	     		newItem.tags[i] = tagsContent[i];
     		}
	}
	
	newItem.title = doc.evaluate('//div[@class="sessionsPaperTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
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
		
		var titles = doc.evaluate('//li/p[@class="srchtitle"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else if (doc.evaluate('//div[@id="main2"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {

		var xmlOrText = doc.evaluate('//div[@id="main2"]/p/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

		if (xmlOrText.textContent.match("Text")) {
			articles = [xmlOrText.href];

		} else {
			articles = [url];
		}
	}

	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();	
}