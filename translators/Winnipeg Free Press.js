{
	"translatorID":"1d82cbdf-703d-4f96-9ae2-246af21bb96e",
	"translatorType":4,
	"label":"Winnipeg Free Press",
	"creator":"Adam Crymble",
	"target":"http://www.winnipegfreepress",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("articles") || doc.location.href.match("story")) {
		return "newspaperArticle";
	}
}

//Winnipeg Free Press Translator. Code by Adam Crymble
//works for single entries only.

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("newspaperArticle");

	newItem.title = doc.evaluate('//h3', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s*$/g, '');

	if (doc.evaluate('//div[@id="middlecol"]/h4', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.abstractNote = doc.evaluate('//div[@id="middlecol"]/h4', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s*$/g, '');
	}

	if (doc.evaluate('//div[@id="bylines"]/p[@class="byline"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var byline = doc.evaluate('//p[@class="byline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var k = 0;
		var byLineArray = new Array();
		var nextByLine;
		
		while (nextByLine = byline.iterateNext()) {
			byLineArray.push(nextByLine.textContent.replace(/^\s*|\s*$/g, ''));
			k++;
		}	
		
		if (k>1) {
			for (var i = 0; i < byLineArray.length; i++) {
				if (byLineArray[i].match("Updated:")) {
					newItem.date = byLineArray[i].substr(9).replace(/^\s*|\s*$/g, '');
				} else if (byLineArray[i].match("bylineParse") && byLineArray[i].substr(13).match(/\w/)) {
				
					var author = (byLineArray[i].substr(13));
					var authorLength = author.length/2;
					var author = author.substr(0 + authorLength);
					var m = 0;
					
					if (author.match(" - ")) {
						var author = author.split(' - ');
					} else if (author.match(", ")) {
						var author = author.split(', ');
					} else if (author.match(/ By /)) {
						var author = author.split(/By/);
						author[0] = author[1];
					} else if (author.match(/By:/)) {
						var author = author.split(/By:/);
						author[0] = author[1];
					} else {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
						m = 1;
					}
					
					if (m == 0) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(author[0], "author"));	
					}					
				}
			}
		}
	}
     		
	newItem.publicationTitle = "Winnipeg Free Press";
	newItem.url = doc.location.href;
	newItem.complete();
}

function doWeb (doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	}: null;
	
	var uris= new Array();
	uris.push(url);
	Zotero.Utilities.processDocuments(uris, scrape, function() {Zotero.done();});
	Zotero.wait();
}