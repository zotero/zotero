{
        "translatorID": "530cf18c-e80a-4e67-ae9c-9b8c08591610",
        "label": "Le monde diplomatique",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.monde-diplomatique\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-26 16:50:57"
}

/*
Le Monde Diplomatique (de) Translator
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
Works really well. Try here:
http://www.monde-diplomatique.de/pm/2011/02/11/a0054.text.name,askexfz1c.n,0
http://www.monde-diplomatique.de/pm/.search?tx=Globalisierung
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (url.match(/^http:\/\/www\.monde-diplomatique\.de\/pm\/\d\d\d\d\/\d\d/) ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	}  else if (url.match(/search/) ) {
		Zotero.debug("multiple");
		return "multiple";
	} 
}
function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var title_XPath = ".//*[@id='haupt']/div/h3"
	if (doc.evaluate(title_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.url = doc.location.href; 

	
	// This is for the title!
	
	
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.title = Zotero.Utilities.trim(title);
	
	
	// Now for the Author

	var author_XPath = ".//*[@id='haupt']/div/h4"; 
	if (doc.evaluate(author_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var author  = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		author = author.replace(/^\s*von\s|\s*$/g, ''); // remove whitespace around the author and the "Von "at the beginning
	} else {
		var author = "";
	}
	var author = author.split(" | "); // this seems to work even if there's no |
	for (var i in author) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
	}
	
	// No Tags


	// Date
	var date_XPath = ".//*[@id='haupt']/h2"
	var date = doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	date = date.split(" vom ")[1];
	newItem.date = date; 

	
	// Summary
	var summary_XPath = ".//*[@id='haupt']/div/h5"
	if (doc.evaluate(summary_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
	var summary = doc.evaluate(summary_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
	newItem.abstractNote = Zotero.Utilities.trim(summary); 
	}
	
	newItem.publicationTitle = "Le Monde Diplomatique (Deutsch)";

	newItem.attachments.push({url:doc.location.href, title:doc.title, mimeType:"text/html"});
	newItem.complete()
				
	}
} 
 
function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		var titles = doc.evaluate("//*[@id='haupt']/div/p/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.href.match(/^http:\/\/www\.monde-diplomatique\.de\/pm\/\d\d\d\d\/\d\d/) ){
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

