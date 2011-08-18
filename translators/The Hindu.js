{
	"translatorID": "9499c586-d672-42d6-9ec4-ee9594dcc571",
	"label": "The Hindu",
	"creator": "Prashant Iyengar and Michael Berkowitz",
	"target": "^http://(www\\.)?hindu\\.com",
	"minVersion": "1.0.0b4.r5",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-08-16 03:36:22"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//h2[@class="r"]/a[@class="l"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
	  		return "multiple";
	  	} else {
		  	return "newspaperArticle";
	}
}

function regexMeta(str, item) {
	var re = /NAME\=\"([\w\W]*?)\"\s+CONTENT\=\"([\w\W]*?)\"/;
	var stuff = str.match(re);
		if (stuff)
		{
		if (stuff[1] == "PAGEHEAD") {
		item.section = stuff[2].split(/\s+/)[0];
	}
	if (stuff[1] == "ZONE") {
		item.place = stuff[2].split(/\s+/)[0];
	}
	if (stuff[1] == "EXPORTTIME") {
		item.date = stuff[2].split(/\s+/)[0];
	}
	if (stuff[1] == "PAGENUMBER") {
		item.pages = stuff[2].split(/\s+/)[0];
	}
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//h2[@class="r"]/a[@class="l"]';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var link;
		var items = new Object();
		while (link = links.iterateNext()) {
			items[link.href] = link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
		
	} else { arts = [url]; }
	for each (var art in arts) {
		Zotero.debug(art);
		Zotero.Utilities.HTTP.doGet(art, function(text) {
			var newItem = new Zotero.Item("newspaperArticle");
			newItem.publicationTitle = "The Hindu";
			newItem.url = art;
			//title
			var t = /\<TITLE\>[\w\W]*\:([\w\W]*?)<\/TITLE/;
			newItem.title = Zotero.Utilities.unescapeHTML(Zotero.Utilities.capitalizeTitle(text.match(t)[1]));
	
			var auth = 	/\<font class\=storyhead[\w\W]*?justify\>([\w\W]*?)\<p\>/;
			if (text.match(auth))
			{
				//newItem.author=Zotero.Utilities.cleanAuthor(text.match(auth)[1]);
				cleanauth=Zotero.Utilities.cleanTags(text.match(auth)[1]);
				newItem.creators.push(Zotero.Utilities.cleanAuthor(cleanauth, "author"));	
			}
	
			newItem.publicationTitle="The Hindu";
			
			newItem.attachments = [{"title":"The Hindu Snapshot", mimeType:"text/html", url:art}];
	
			//hooray for real meta tags!
			var meta = /<META NAME[\w\W]*?\>/g;
			var metaTags = text.match(meta);
			for (var i = 0 ; i <metaTags.length ; i++) {
				regexMeta(metaTags[i], newItem);
			}
			newItem.complete();
			Zotero.done();
		});
		Zotero.wait();
	}
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.hindu.com/lr/2004/01/04/stories/2004010400030100.htm",
		"items": [
			{
				"itemType": "newspaperArticle",
				"creators": [
					{
						"firstName": "To be torn between two languages, discovers H. MASUD TAJ, is to drown soul-deep in  the",
						"lastName": "present",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"publicationTitle": "The Hindu",
				"url": "http://www.hindu.com/lr/2004/01/04/stories/2004010400030100.htm",
				"title": "Falling at the speed of light",
				"websiteTitle": "The Hindu",
				"date": "01-01-2004",
				"pages": "01",
				"place": "CHEN",
				"section": "LITERARY",
				"libraryCatalog": "The Hindu"
			}
		]
	}
]
/** END TEST CASES **/
