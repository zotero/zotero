{
        "translatorID": "f61beec2-1431-4218-a9d3-68063ede6ecd",
        "label": "Welt Online",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.welt\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-29 18:43:49"
}

/*
Welt Online Translator
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
"Multiple" doesn't work on the search pages, because that's another host. However, every other page does it:
http://www.welt.de/themen/Fukushima/
http://www.welt.de/wirtschaft/
http://www.welt.de/wirtschaft/article12962920/Krankenkassen-werfen-Aerzten-Gewinnstreben-vor.html
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var welt_article_XPath = ".//meta[contains(@property, 'og:type')]";
	var welt_multiple_XPath = ".//div[contains(@class, 'h2')]/a";
	if (doc.evaluate(welt_article_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.evaluate(welt_multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
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

	
	// This is for the title! Welt's titles are ok without their "supertitles". They seem to convey - nothing. 
	
	var xPath = ".//meta[contains(@property, 'og:title')]";
	var title = doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	newItem.title = title;

	// Authors
	
	var xPath = ".//meta[contains(@name, 'author')]";
	var author= doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	if (author == "WELT ONLINE") {
		author = "";
	}
	author = author.split(/\sund\s|\su\.\s|\,\s|\&|Und/); 
	for (var i in author) {
		if (author[i].match(/\s/)) { // only names that contain a space!
			author[i] = author[i].replace(/^\s*|\s*$/g, '');
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
		}
	}
	
	// Summary
	
	var xPath = '//meta[contains(@name, "description")]';
	var summary = doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	newItem.abstractNote = summary;

	// Tags
	var xPath = '//meta[contains(@name, "keywords")]';
	var tags= doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	tags = tags.split(/,\s/);
	if (tags[0] != "" ) {
		for (var i in tags) {
			tags[i] = tags[i].replace(/^\s*|\s*$/g, '');
			newItem.tags.push(tags[i]);
		}
	}
	
	// Date 
	var xPath = ".//span[contains(@class, 'date')][last()]";
	var date= doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.date = date;

	// Publikation (I can only distinguish some articles from Welt am Sonntag by their URL, otherwise its all mishmash)
	if (doc.location.href.match(/.*wams_print.*/)) {
		newItem.publicationTitle = "Welt am Sonntag";
	} else {
		newItem.publicationTitle = "Welt Online";
	}
	
	// Section
	var xPath = ".//*[@id='mainNavi']/ul/li[contains(@class, 'menAc')]/a";
	var section= doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.section = section;

	// Attachment
	newItem.attachments.push({url:doc.location.href+"?print=true", title:doc.title, mimeType:"text/html"});

	newItem.complete()
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		var titles = doc.evaluate(".//div[contains(@class, 'h2')]/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
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
