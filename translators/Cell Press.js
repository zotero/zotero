{
	"translatorID":"f26cfb71-efd7-47ae-a28c-d4d8852096bd",
	"translatorType":4,
	"label":"Cell Press",
	"creator":"Michael Berkowitz",
	"target":"http://www.(cancercell|cell|cellhostandmicrobe|cellmetabolism|cellstemcell|chembiol|current-biology|developmentalcell|immunity|molecule|neuron|structure).(org|com)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":99,
	"inRepository":true,
	"lastUpdated":"2008-07-07 14:50:00"
}

function detectWeb(doc, url) {
	
	if (url.indexOf("search/results") != -1) {
		return "multiple";
	} else if (url.indexOf("content/article") != -1) {
		return "journalArticle";
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	var fieldTitle;
	var commaSplit = new Array();
	
	var newItem = new Zotero.Item("journalArticle");
		
	//title	
		newItem.title = doc.evaluate('//h1[@class="article_title"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
	//publication, volume, pages, date.
		var voliss = doc.evaluate('//div[contains(@class, "article_citation")]/p[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		var volissSplit = voliss.split(".");
		
		for (var i = 0; i < volissSplit.length; i++) {
			if (volissSplit[i].match(", ")) {
				commaSplit = volissSplit[i].split(", ");
			}
		}
		if (commaSplit[0] != '') {
			newItem.publicationTitle = commaSplit[0];
		}
		if (commaSplit[1] != '') {
			newItem.volume = commaSplit[1];
		}
		if (commaSplit[2] != '') {
			newItem.pages= commaSplit[2];
		}
		if (commaSplit[3] != '') {
			newItem.date= commaSplit[3];
		}

	//abstract
	
		var abstractXPath2 = '//div[@class="min_fulltext"][@id="main_content"]/p';
		if (doc.evaluate(abstractXPath2, doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.abstractNote = doc.evaluate(abstractXPath2, doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		
		var abstractXPath = '//div[@class="panelcontent article_summary"]/p[contains(text(), " ")]';
		if (doc.evaluate(abstractXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.abstractNote = doc.evaluate(abstractXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}

	//authors
		var authors = doc.evaluate('//p[@class="authors"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(",");
		for (var i in authors) {
			var next_author = authors[i];
			if (next_author.match(/[a-z]/)) {
				next_author = Zotero.Utilities.trimInternal(next_author.replace(/\d/g, ""));
				if (next_author.substr(0, 3) == "and") {
					next_author = next_author.substr(4);
				}
				newItem.creators.push(Zotero.Utilities.cleanAuthor(next_author, "author"));
			}
		}
	
	//url
		var newurl = doc.location.href;
		if (newurl.indexOf("abstract") != -1) {
			newurl = newurl.replace("abstract", "fulltext");
		}
		
	//attachments	
		var uid = newurl.match(/uid=([^&]+)/)[1];
		var pdfx = '//a[contains(text(), "PDF")][contains(@href, "' + uid + '")]';
		var pdfurl = doc.evaluate(pdfx, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		newItem.attachments = [
			{url:newurl, title:"Cell Press Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"Cell Press Full Text PDF", mimeType:"application/pdf"}
		];
		
		newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		var titles = doc.evaluate('//dd/strong', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var link = doc.evaluate('//nobr/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		var next_lilnk;
		
		while (next_title = titles.iterateNext()) {
			next_link = link.iterateNext();
			if (next_link.textContent.match("Summary")) {
				items[next_link.href] = next_title.textContent;
			} else {
				next_link = link.iterateNext();
				items[next_link.href] = next_title.textContent;
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