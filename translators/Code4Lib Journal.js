{
	"translatorID":"a326fc49-60c2-405b-8f44-607e5d18b9ad",
	"translatorType":4,
	"label":"Code4Lib Journal",
	"creator":"Michael Berkowitz",
	"target":"http://journal.code4lib.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//h2[@class="articletitle"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//h1[@class="articletitle"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var items = new Object();
	var articles = new Array();
	var xpath = '//div[@class="article"]/h2[@class="articletitle"]/a';
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//div[@class="article"]/h2[@class="articletitle"]/a';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		while (next_title) {
			items[next_title.href] = next_title.textContent;
			next_title = titles.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	
	Zotero.Utilities.processDocuments(articles, function(newDoc, url) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.repository = "Code4Lib Journal";
		newItem.publicationTitle = "The Code4Lib Journal";
		newItem.ISSN = "1940-5758";
		newItem.url = newDoc.location.href;
		newItem.title = newDoc.evaluate('//div[@class="article"]/h1[@class="articletitle"]/a', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.abstractNote = newDoc.evaluate('//div[@class="article"]/div[@class="abstract"]/p', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var issdate = newDoc.evaluate('//p[@id="issueDesignation"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.issue = issdate.match(/([^,]*)/)[0].match(/\d+/)[0];
		newItem.date = issdate.match(/,\s+(.*)$/)[1];
		
		
		var axpath = '//div[@class="article"]/div[@class="entry"]/p[1]/a';
		var authors = newDoc.evaluate(axpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var next_author = authors.iterateNext();
		while (next_author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(next_author.textContent, "author"));
			next_author = authors.iterateNext();
		}
		
		newItem.attachments.push({url:newDoc.location.href, title:"Code4Lib Journal Snapshot", mimeType:"text/html"});
		newItem.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}