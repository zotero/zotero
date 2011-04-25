{
        "translatorID": "374ac2a5-dd45-461e-bf1f-bf90c2eb7085",
        "label": "Der Tagesspiegel",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.tagesspiegel\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-30 22:04:46"
}

/*
Tagesspiegel Translator
Copyright (C) 2011 Martin Meyerhoff

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var tspiegel_ArticleTools_XPath = ".//div[@class='hcf-article']";
	var tspiegel_Multiple_XPath = "//*[@id='hcf-wrapper']/div[2]/div[contains(@class, 'hcf-main-col')]/div/ul/li/h2/a|//*[@id='hcf-wrapper']/div[@class='hcf-lower-hp']/div/ul/li/ul/li/a|//ul/li[contains(@class, 'hcf-teaser')]/h2/a";
	
	if (doc.evaluate(tspiegel_ArticleTools_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.location.href.match(/http\:\/\/www\.tagesspiegel\.de\/suchergebnis\//)){ 
		Zotero.debug("multiple");
		return "multiple";
	} else if (doc.evaluate(tspiegel_Multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ) {
		Zotero.debug("multiple");
		return "multiple";
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.url = doc.location.href; 

	
	// This is for the title!
	
	var title_XPath = "//div[@class='hcf-article']/h1";
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.title = title;
	
	// Date
	var date_XPath = "//span[contains(@class, 'hcf-date')]";
	var date= doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.date= date.replace(/(.{10,10}).*/, '$1');
	
	// Summary 
	
	var summary_XPath = ".//p[@class='hcf-teaser']"
	if (doc.evaluate(summary_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){
		var summary = doc.evaluate(summary_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
		newItem.abstractNote = Zotero.Utilities.trim(summary); 
	}
	
	// Publication Title
	newItem.publicationTitle = "Der Tagesspiegel Online";
	
	// Authors 
	var author_XPath = "//span[contains(@class, 'hcf-author')]";
	if (doc.evaluate(author_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){
		var author  = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		Zotero.debug(author);
		author = author.replace(/^Von\s|Kommentar\svon\s/g, '');
		author = author.split(/,\s/);
		for (var i in author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
		}
	}
	
	// Printurl (add "v_print," before the article ID and "?p=" at the end) 
	var printurl = doc.location.href.replace(/^(.*\/)(\d+.html$)/, '$1v_print,$2?p=');
	newItem.attachments.push({url:printurl, title:doc.title, mimeType:"text/html"}); 
	
	// Tags
	var tags_XPath = "//meta[@name='keywords']";
	var tags = doc.evaluate(tags_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	var tags= tags.split(","); // this seems to work even if there's no |
	for (var i in tags) {
		tags[i] = tags[i].replace(/^\s*|\s*$/g, '') // remove whitespace around the tags
		newItem.tags.push(tags[i]);
	} 
	
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
		
		var titles = doc.evaluate("//*[@id='hcf-wrapper']/div[2]/div[contains(@class, 'hcf-main-col')]/div/ul/li/h2/a|//*[@id='hcf-wrapper']/div[@class='hcf-lower-hp']/div/ul/li/ul/li/a|//ul/li[contains(@class, 'hcf-teaser')]/h2/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			// The following conditions excludes the image galleries and videos.
			if (next_title.href.match(/http\:\/\/www\.tagesspiegel\.de\/(?!mediacenter)/)) { 
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
