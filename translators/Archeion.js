{
	"translatorID":"f6717cbb-2771-4043-bde9-dbae19129bb3",
	"translatorType":4,
	"label":"Archeion",
	"creator":"Adam Crymble",
	"target":"http://archeion-aao",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:15:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td[@class="full"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//div[@class="main"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

//Archeion translator. code by Adam Crymble
//The way the site is formatted, I can't split the creators up logically. I have left them off for now.

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
	
	newItem = new Zotero.Item("book");
	
	var xPathHeadings = doc.evaluate('//th', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContent = doc.evaluate('//table[@class="results"]/tbody/tr/td', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//th)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var fieldTitle;
	var dataTags = new Object();
	var multiAuthorCheck = new Array();
	
	
	for (var i = 0; i < xPathCount.numberValue; i++) {
		fieldTitle=xPathHeadings.iterateNext().textContent.replace(/\s+/g, '');
	
		//This was Michael Berkowitz's suggested Fix.

			/*var ts = doc.getElementsByTagName(("table"), 1) = ts.length, ar = [];
			while ((i--)) {
				if (ts[i].className&&ts[i].className.match("results")) {
					ar[ar.length] = ts[i].getElementsByTagName("td")[0].split(/\<br\>/);
				}
			}
			Zotero.debug(ar[0][0]); */
		
	//COULDN"T SPLIT BY ("\n") TO SEPARATE MULTIPLE CREATORS.
		if (fieldTitle == "Creator:" | fieldTitle == "Créateur:") {
			fieldTitle == "Creator:";
			
			var authorContent = xPathContent.iterateNext().textContent;
			//Zotero.debug(authorContent);
			
			//if (authorContent.match(' (*) ')) {
			//	Zotero.debug(doc.title);
			//}
			
			
			
			//var test = authorContent.split(/\<br\>/);
			//Zotero.debug(test);
			
			authors = authorContent.match(/\w+,?\s+[\w\(\)\.]+/g);
			
			//Zotero.debug(authors);
			
			
			for (i = 0; i < authors.length; i++) {
				
				var author = authors[i].split(", "); 
				
				if (author.length < 2) {
					
					dataTags["Creator:"] = author[0];
					newItem.creators.push({lastName: dataTags["Creator:"], creatorType: "creator"});
				
				} else {
					
					dataTags["Creator:"] = (author[1] + (" ") + author[0]);
					//Zotero.debug(authorArranged);
					newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Creator:"], "creator"));
				}
			}
			
		} else {


	
		dataTags[fieldTitle] = Zotero.Utilities.cleanTags(xPathContent.iterateNext().textContent);
		//Zotero.debug(fieldTitle);
		}
	}
	
	associateData (newItem, dataTags, "Datesofmaterial:", "date");	
	associateData (newItem, dataTags, "Repository:", "repository");	
	associateData (newItem, dataTags, "ReferenceNumber:", "callNumber");	
	associateData (newItem, dataTags, "PhysicalDescription:", "extra");	
	associateData (newItem, dataTags, "Scopeandcontent", "abstractNote");
	
	associateData (newItem, dataTags, "Dates:", "date");	
	associateData (newItem, dataTags, "Centred'archives:", "repository");	
	associateData (newItem, dataTags, "Numéroderéférence:", "callNumber");	
	associateData (newItem, dataTags, "Descriptionmatérielle:", "extra");	
	associateData (newItem, dataTags, "Portéeetcontenu", "abstractNote");
	
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
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xPathLinks = doc.evaluate('//td[@class="full"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var linksCounter = doc.evaluate('count (//td[@class="full"]/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var xPathTitles = doc.evaluate('//table[@class="results"]/tbody/tr[1]/td', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_link;
		for (var i = 0; i < linksCounter.numberValue; i++) {
			next_link = xPathLinks.iterateNext().href;
			items[next_link] = xPathTitles.iterateNext().textContent;
			
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
