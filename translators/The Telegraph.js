{
	"translatorID":"40b9ca22-8df4-4f3b-9cb6-8f9b55486d30",
	"translatorType":4,
	"label":"Telegraph.co.uk",
	"creator":"Reino Ruusu",
	"target":"^http://www\.telegraph\.co\.uk/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-07 02:36:56"
}

function detectWeb(doc, url) {
	Zotero.debug("detectWeb URL= "+ url);
	var result = doc.evaluate('html/head/meta[@name = "article-id"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if (result) {
		return "newspaperArticle";
	}
	return null;
}

function getAuthors(byline) {
	if (byline.search(/.+(?:,\s.+)+\sand\s.+/) == -1) {
		byline = byline.replace(/,\s.+$/, "");
	}
	byline = byline.replace(/\s+(?:in|at)\s+.+$/, "");
	return byline.split(/(?:,\s+|\s+and\s+)/);
}

function putAuthors(item, byline) {
	for each (var a in getAuthors(byline)) {
		item.creators.push(Zotero.Utilities.cleanAuthor(a, "author"));
	}
}

function doWeb(doc, url) {
	Zotero.debug("doWeb URL= "+ url);
	var newArticle = new Zotero.Item('newspaperArticle');
	newArticle.url = url;
	newArticle.publicationTitle = 'Telegraph.co.uk';
	//newArticle.publisher = 'Telegraph Media Group Limited';
	//Zotero.debug(doc.evaluate('//html/head/meta[@name="title"]/@content', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	var metaElements = doc.evaluate('html/head/meta', doc, null, XPathResult.ANY_TYPE, null);
	var tmp;	
	while (tmp = metaElements.iterateNext()) {
		var name = tmp.getAttribute('name');
		var content = tmp.getAttribute('content');
		if (name == 'title')
			newArticle.title = content;
			else if (name == 'author') {
				content = Zotero.Utilities.trim(content);
				//Zotero.debug(content);
				content = content.replace(/^By\s+/, "");
				putAuthors(newArticle, content);
			}
			else if (name == 'description') {
				newArticle.abstractNote = content.replace(/\s+/gm, " ");
			}
	}
	
	var datePath = '//div[@class="story"]/div[@class="byline"]/p[1]/br/following-sibling::text()';
	var dateElement = doc.evaluate(datePath, doc, null,XPathResult.ANY_TYPE, null).iterateNext();
	if (dateElement) {
		var dateRE = /\d\d?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d\d\d\d/;
		var date = dateElement.textContent.match(dateRE);
		if (date) newArticle.date = date[0];
	}
	newArticle.complete();
}