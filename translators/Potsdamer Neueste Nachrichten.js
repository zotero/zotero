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
        "lastUpdated": "2011-03-26 13:42:35"
}

/*
Potsdamer Neueste Nachrichten Translator
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
The articles themselves are quite badly tagged, so that the translator sometimes doesn't capture the summary or the authors.

Test it with:
http://www.pnn.de/archiv/?type=archiv&phrase=Krise
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
	
	var PNN_Article_XPath = ".//a[contains(@class, 'print')]"; //only articles have a print button.
	var PNN_Multiple_XPath = ".//ul/li/h2/a"
	
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
	var title_XPath = '//title'
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	title = title.split("—")[0]; // split at mdash
	title = title.replace(/\„|\“/g, '"'); // standard quotation marks
	title = title.replace(/|^\s*|\s*$/, ''); // remove whitespace
	newItem.title = title;
	
	// Summary
	var summary_XPath = ".//p[contains(@class, 'teaser')]";
	var summary = doc.evaluate(summary_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	summary=summary.replace(/\(.*\)/, ''); // No date in the summary. 
	summary=Zotero.Utilities.trimInternal(summary); //remove white space
	newItem.abstractNote = summary;
	
	// Date 
	var date_XPath = "//*[contains(@class, 'teaser')]/span[contains(@class, 'date')]";
	var date = doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	date = date.replace(/\(|\)|^\s*|\s*$/g, ''); // remove whitespace and braces
	newItem.date = date;
	

	// Authors. Tricky. Actually, horrible. I hope they change their site at some point and this mess can be cleaned up.
	var temp = new Array();
	temp[0] = ""
	var author_XPath = ".//*[@id='teaser']/p/i"; // Sometimes, the author is in italics in the paragraph. Easy Case, really.
	if (doc.evaluate(author_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var author = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		temp[0] = author;	 
	} else {
		author_XPath = ".//*[@id='teaser']"; // basically, grab the entire article. no other chance.
		var author = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		author = author.replace(/\s\s\s*/g, "|"); // replace lots of white space (indicative of a line break / paragraph)
		author = author.split("|");
	

	//	Zotero.debug(author);
		var author_searchpattern1 = /^Von(.*)/; // These three patterns capture the majority of authors. 
		var author_searchpattern2 = /^Das\sGespräch\sführte(.*)\.$/;
		var author_searchpattern3 = /^Interview\:\s(.*)Foto:.*/;

		for (var i in author) {
			if (temp[0] == "") {
				if (author[i].match(author_searchpattern1)) {
					var temp = author[i].match(author_searchpattern1);
					temp[0] = temp[0].replace(author_searchpattern1, "$1");
				} 
				if (author[i].match(author_searchpattern2)) {
					var temp = author[i].match(author_searchpattern2);
					temp[0] = temp[0].replace(author_searchpattern2, "$1");	
				}
				if (author[i].match(author_searchpattern3)) {
					var temp = author[i].match(author_searchpattern3);
					temp[0] = temp[0].replace(author_searchpattern3, "$1");
				}  
			}
	}
	}
	var realauthor = temp[0].replace(/^\s*|\s*$/g, '');
	realauthor = realauthor.split(/\sund\s|\su\.\s|\,\s/); 
 	for (var i in realauthor) {
		if (realauthor[i].match(/\s/)) { // only names that contain a space!
			newItem.creators.push(Zotero.Utilities.cleanAuthor(realauthor[i], "author"));
		}
	}
	newItem.attachments.push({url:doc.location.href, title:doc.title, mimeType:"text/html"});
	newItem.publicationTitle = "Potsdamer Neueste Nachrichten"
	// section
	var section_XPath = ".//*[@id='sidebar-left']/ul/li[contains(@class, 'active')]";
	var section = doc.evaluate(section_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.section = section.replace(/^\s*|\s*$/g, '');
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
		
		var titles = doc.evaluate(".//ul/li/h2/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
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
