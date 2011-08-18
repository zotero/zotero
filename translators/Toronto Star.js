{
	"translatorID": "6b0b11a6-9b77-4b49-b768-6b715792aa37",
	"label": "Toronto Star",
	"creator": "Adam Crymble, Avram Lyon",
	"target": "^http://www\\.thestar\\.com",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-08-18 01:03:09"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("search") && !doc.location.href.match("classifieds")) {
		return "multiple";
	} else if (doc.location.href.match("article")) {
		return "newspaperArticle";
	}
}

//Toronto Star translator. code by Adam Crymble

function scrape(doc, url) {
	if (!ZU) ZU = Zotero.Utilities;

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var newItem = new Zotero.Item("newspaperArticle");
	
	var date = doc.evaluate('//span[@class="ts-label_published"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(date) {
		newItem.date = date.textContent.replace(/Published On/,'');
	}
	
	var abstractNote = doc.evaluate('//meta[@property="og:description"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(abstractNote) newItem.abstractNote = abstractNote.content;
	
	var authorNode = doc.evaluate('//div[@class="td-author"]/span[@class="ts-label"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var author;
	while (author = authorNode.iterateNext()) {
		author = author.textContent;
		if (author.toUpperCase() == author) author = ZU.capitalizeTitle(author.toLowerCase(),true);
		newItem.creators.push(ZU.cleanAuthor(author.replace(/^By\s*/,'')));
	}

	var xPathTitle = '//h1[@class="ts-article_header"]';
	newItem.title = doc.evaluate(xPathTitle, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	

	// The section is the first listed keyword
	var keywords = doc.evaluate('//meta[@name="Keywords"][@content]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (keywords) newItem.section = keywords.content.split(',').shift();

	newItem.attachments.push({document:doc, title:"Toronto Star Snapshot"});

	newItem.url = doc.location.href;
	newItem.publicationTitle = "The Toronto Star";
	newItem.ISSN = "0319-0781";

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
		
		var titles = doc.evaluate('//a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.href.match("http://www.thestar.com") && next_title.href.match("article") && !next_title.href.match("generic") && !next_title.href.match("static")) {
				items[next_title.href] = next_title.textContent;
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
		Zotero.wait();
	} else {
		scrape(doc, url);
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.thestar.com/news/world/article/755917--france-should-ban-muslim-veils-commission-says?bn=1",
		"items": [
			{
				"itemType": "newspaperArticle",
				"creators": [],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"document": false,
						"title": "Toronto Star Snapshot"
					}
				],
				"date": "2010/01/26 10:34:00",
				"abstractNote": "France's National Assembly should pass a resolution denouncing full Muslim face veils and then vote the strictest law possible to ban women from wearing them, a parliamentary commission proposed on Tuesday.",
				"title": "France should ban Muslim veils, commission says",
				"section": "News",
				"url": "http://www.thestar.com/news/world/article/755917--france-should-ban-muslim-veils-commission-says?bn=1",
				"publicationTitle": "The Toronto Star",
				"ISSN": "0319-0781",
				"libraryCatalog": "Toronto Star"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.thestar.com/business/cleanbreak/article/1031551--hamilton-ontario-should-reconsider-offshore-wind",
		"items": [
			{
				"itemType": "newspaperArticle",
				"creators": [
					{
						"firstName": "Tyler",
						"lastName": "Hamilton"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"document": false,
						"title": "Toronto Star Snapshot"
					}
				],
				"date": "2011/07/29 21:43:00",
				"abstractNote": "There’s no reason why Ontario can’t regain the momentum it once had.",
				"title": "Hamilton: Ontario should reconsider offshore wind",
				"section": "Business",
				"url": "http://www.thestar.com/business/cleanbreak/article/1031551--hamilton-ontario-should-reconsider-offshore-wind",
				"publicationTitle": "The Toronto Star",
				"ISSN": "0319-0781",
				"libraryCatalog": "Toronto Star",
				"shortTitle": "Hamilton"
			}
		]
	}
]
/** END TEST CASES **/