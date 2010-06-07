{
        "translatorID":"a354331-981b-43de-a61-bc26dd1be3a9",
        "label":"AMS MathSciNet",
        "creator":"Simon Kornblith",
        "target":"^https?://www\\.ams\\.org[^/]*/mathscinet/search/(?:publications\\.html|publdoc\\.html)",
        "minVersion":"1.0.0b3.r1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-06-06 19:00:50"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var tableRows = doc.evaluate('//div[@id="content"]/form/div[@class="headline"]', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	if(tableRows.iterateNext()) {
		return "multiple"
	} else if(doc.evaluate('//div[@id="titleSeparator"]/div[@class="navbar"]/span[@class="PageLink"]/a[text() = "Up"]',
		doc, nsResolver, XPathResult.ANY_TYPE, null)) {
		return "journalArticle";
	}
	
	return false;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var pub = "http://www.ams.org/mathscinet/search/publications.html?fmt=bibtex";
	
	var tableRows = doc.evaluate('//div[@id="content"]/form/div[@class="headline"]', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var tableRow = tableRows.iterateNext();
	if(tableRow) {
		// search page
		var items = new Object();
		var links = new Object();
		
		do {
			var id = doc.evaluate('.//input[@type="checkbox"]', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().value;
			items[id] = doc.evaluate('./div[@class="headlineText"]/span[@class="title"]', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().textContent;
			links[id] = doc.evaluate('.//a', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().href;
		} while(tableRow = tableRows.iterateNext())
		
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var docLinks = new Array();
		for(var id in items) {
			pub += "&b="+id;
			docLinks.push(links[id]);
		}
	} else {
		var MR = doc.evaluate('//div[@id="content"]/div[@class="doc"]/div[@class="headline"]/strong',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		pub += "&b="+MR.replace(/^MR0*/, "");
	}
	
	Zotero.Utilities.HTTP.doGet(pub, function(text) {
		var m = text.match(/<pre>(?:.|[\r\n])*?<\/pre>/g);
		var bibTeXString = "";
		for each(var citation in m) {
			// kill pre tags
			citation = citation.substring(5, citation.length-6);
			bibTeXString += citation;
		}
		
		// import using BibTeX
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibTeXString);
		translator.setHandler("itemDone", function(obj, item) {
			if(docLinks) {
				item.attachments.push({title:"MathSciNet Snapshot", url:docLinks.shift(), mimeType:"text/html"});
			} else {
				item.attachments.push({title:"MathSciNet Snapshot", document:doc});
			}
			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
}
