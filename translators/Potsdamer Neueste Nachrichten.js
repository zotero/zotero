{
        "translatorID": "9405db4b-be7f-42ab-86ca-430226be9b35",
        "label": "Potsdamer Neueste Nachrichten",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.pnn\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-05-06 11:34:44"
}

/*
Potsdamer Neueste Nachrichten Translator 1.1
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

/* 

Test it with:
http://www.pnn.de/
http://www.pnn.de/zeitung/
http://www.pnn.de/zeitung/12.01.2011/
http://www.pnn.de/titelseite/364860/
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var PNN_Article_XPath = ".//div[contains (@class, 'um-article')]/h1"; //only articles have a print button.
	var PNN_Multiple_XPath = "//div[contains(@class, 'um-teaser')]/h2/a"
	
	if (doc.evaluate(PNN_Article_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.evaluate(PNN_Multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
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
	
	// Title
	var title_XPath = "//div[contains (@class, 'um-article')]/h1"
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	title = title.replace(/\s+|\n/g, ' ');
	newItem.title = title;
	
	// Summary
	var summary_XPath = "//div[contains (@class, 'um-article')]/p[@class='um-first']";
	if (doc.evaluate(summary_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		var summary = doc.evaluate(summary_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.abstractNote = summary;
	}
	
	// Date 
	var date_XPath = "//div[contains (@class, 'um-article')]/div[@class='um-metabar']/ul/li[contains(@class, 'um-first')]";
	var date = doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.date = date.replace(/(\d+)\.(\d+).(\d+)/, '$3-$2-$1');;
	

	// Authors 
	var author_XPath = "//div[contains (@class, 'um-article')]/span[@class='um-author']"; 
	if (doc.evaluate(author_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		var author = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		author =author.replace(/^von\s|^\s*|\s*$/g, '');
		author =author.split(/\sund\s|\su\.\s|\,\s/); 
	 	for (var i in author) {
			if (author[i].match(/\s/)) { // only names that contain a space!
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
			}
		}
	}
	
	newItem.attachments.push({url:doc.location.href, title:doc.title, mimeType:"text/html"});
	newItem.publicationTitle = "Potsdamer Neueste Nachrichten"

	// section
	var section_XPath = "//div[@class='um-mainnav']/ul/li[@class='um-selected']/a";
	if (doc.evaluate(section_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		var section = doc.evaluate(section_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.section = section.replace(/^\s*|\s*$/g, '');
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
		
		var titles = doc.evaluate("//div[contains(@class, 'um-teaser')]/h2/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent.replace(/\s+/g, ' ');
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	} else {
		scrape(doc, url);
	}
	Zotero.wait();
}	
