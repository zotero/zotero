{
	"translatorID":"1eb5eb03-26ab-4015-bd0d-65487734744a",
	"translatorType":4,
	"label":"Bibliotheque et Archives Nationale du Quebec (Pistard)",
	"creator":"Adam Crymble",
	"target":"http://pistard.banq.qc.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb (doc, url) {
	
	if (doc.title.match("Liste détaillée des fonds")) {
		return "multiple";
	} else if (doc.title.match("Description fonds")) {
		return "book";
	}
}

//Bibliotheque et Archives National du Quebec. Code by Adam Crymble

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
	var tagsContent= new Array();

	var newItem = new Zotero.Item("book");
	
     	var headers = doc.evaluate('//strong', doc, nsResolver, XPathResult.ANY_TYPE, null);
     	var xPathCount = doc.evaluate('count (//strong)', doc, nsResolver, XPathResult.ANY_TYPE, null);
     	var contents = doc.evaluate('//div[@id="Content"]/div/table', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
     	
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
			var removeHeader = headersArray[i].length;
			
			contentsArray.push(contents.substr(fieldIndex));
			contents = contents.substr(0, fieldIndex);
			fieldTitle = headersArray[i].replace(/\s+/g, '');
			
			dataTags[fieldTitle] = contentsArray[j].substr(removeHeader).replace(/^\s*|\s+$/g, '');
			j++;
		}
	} 
	Zotero.debug(dataTags);
	
	if (dataTags["Titre,Dates,Quantité"]) {
		if (dataTags["Titre,Dates,Quantité"].match(/\n/)) {
			var splitTitle = dataTags["Titre,Dates,Quantité"].split(/\n/);
			if (splitTitle[0].match(/\w/)) {
				newItem.title = splitTitle[0].replace(/^\s*|\s+$/g, '');
			}
			for (var i = 0; i < splitTitle.length; i++) {
				if (splitTitle[i].match("/ ")) {
					var author = splitTitle[i].replace(/^\s*|\s+$/g, '').substr(2);
					newItem.creators.push({lastName: author, creatorType: "creator"});
				}
			}
		}
	} else {
		newItem.title = doc.title;
	}
	
	
	var k = 0;
	if (dataTags["Termesrattachés"]) {
		
		if (dataTags["Termesrattachés"].match(/\n/)) {
			tagsContent = dataTags["Termesrattachés"].split(/\n/);
			for (var i in tagsContent) {
				if (tagsContent[i].match(/\w/)) {
					newItem.tags[k] = tagsContent[i].replace(/^\s+|\s*$/g, '');					
					k++;
				}
			}
		} else {
			newItem.tags[0] = dataTags["Termesrattachés"];
		}	
	}
	
	associateData (newItem, dataTags, "Languedesdocuments", "language");
	associateData (newItem, dataTags, "Cote:", "callNumber");
	associateData (newItem, dataTags, "Collation", "pages");
	associateData (newItem, dataTags, "Centre:", "place");
	associateData (newItem, dataTags, "Portéeetcontenu", "abstractNote");
	
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
			
		var titles = doc.evaluate('//td[2]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		var next_title;	
		while (next_title = titles.iterateNext()) {
			if (next_title.href.match("description_fonds")) {
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