{
	"translatorID":"83979786-44af-494a-9ddb-46654e0486ef",
	"translatorType":4,
	"label":"Reuters",
	"creator":"Michael Berkowitz",
	"target":"http://(www\\.)?reuters.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-07 14:50:00"
}

function detectWeb(doc, url) {
	if (url.match(/article/)) {
		return "newspaperArticle";
	}	
}

function doWeb(doc, url) {
	var item = new Zotero.Item("newspaperArticle");

	item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="article primaryContent"]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	item.date = doc.evaluate('//div[@class="timestampHeader"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/^.*\d{4}/)[0];
	var byline = doc.evaluate('//div[@id="resizeableText"]/p[1]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	if (byline.match(/^By/)) {
		var authors = byline.substr(3).split(',');
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		item.abstractNote = doc.evaluate('//div[@id="resizeableText"]/p[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/\-\s+(.*)$/)[1];
	} else {
		item.abstractNote = byline.match(/\-\s+(.*)$/)[1];
	}
	item.url = url;
	item.complete();
}