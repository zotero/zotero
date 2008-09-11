{
	"translatorID":"a7c8b759-6f8a-4875-9d6e-cc0a99fe8f43",
	"translatorType":4,
	"label":"Canadian Letters and Images",
	"creator":"Adam Crymble",
	"target":"http://(www.)?canadianletters.ca/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-20 20:45:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("results")) {
		return "multiple";
	} else if (doc.location.href.match("letters.php")) {
		return "document";
	} else if (doc.location.href.match("template")) {
		return "artwork";
	}
	
}

//Translator for Canadian Letters and Images. Code by Adam Crymble


function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	
	var mediaType = (detectWeb(doc, url));
	if (mediaType == "document") {
		var newItem = new Zotero.Item("letter");
		var title2;
		
		//title
		if (doc.evaluate('//h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.title = doc.evaluate('//h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		} else {
			newItem.title = doc.title;
		}
	
		//letter, diary, memoir, personal item
		if (doc.evaluate('//div[@id="collectionCategory_letters"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
			var xPathType = doc.evaluate('//div[@id="collectionCategory_letters"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			newItem.type = xPathType;
		}
		
		//gets date, to and from
		if (doc.evaluate('//div[@class="letterInfo_label"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xPathHeaders = doc.evaluate('//div[@class="letterInfo_label"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var xPathContent = doc.evaluate('//div[@class="letterInfo_title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var xPathCount = doc.evaluate('count (//div[@class="letterInfo_label"])', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			for (i=0; i<xPathCount.numberValue; i++) {	
				fieldTitle=xPathHeaders.iterateNext().textContent.replace(/\s+/g, '');
				dataTags[fieldTitle] = xPathContent.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
				
				if (fieldTitle == "To:") {
					
					newItem.abstractNote = ("To: " + dataTags[fieldTitle]);
					
				} else if (fieldTitle == "From:") {
				
					newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags[fieldTitle], "author"));
					
				} else if (fieldTitle == "Date:") {
					
					newItem.date = dataTags[fieldTitle];
				}	
			}		
		}
	} else if (mediaType == "artwork") {
		
		newItem = new Zotero.Item("artwork");
		
		if (doc.evaluate('//div[@class="pictureDisplay"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.title = doc.evaluate('//div[@class="pictureDisplay"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		} else {
			newItem.title = doc.title;
		}		
	}
	
	
		
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
		
		var titles = doc.evaluate('//div[@class="searchResultsDisplay"]/div/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
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