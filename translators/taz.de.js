{
        "translatorID": "d84574f1-e4d6-4337-934f-bf9d01173bf0",
        "label": "taz.de",
        "creator": "Martin Meyerhoff",
        "target": "^https?://(?:www\\.)?taz\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-06-14 17:18:22"
}

/*
taz.de Translator
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
This site is rather heterogenous when it comes to where the author is and all that.
Whenever the script doesn't find something it just returns an empty field.
Try on:
http://www.taz.de/
http://www.taz.de/1/archiv/detailsuche/?tx_hptazsearch_pi1[search_term]=Krise&tx_hptazsearch_pi2[submit_button].x=0&tx_hptazsearch_pi2[submit_button].y=0
http://www.taz.de/1/debatte/kolumnen/artikel/1/haengt-sie-hoeher-1/
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var taz_ArticleTitle_XPath = ".//h1";
	var taz_Multiple_XPath = ".//*[@id='hauptspalte']/div/ul/li/a/h3";
	var taz_Search_XPath = ".//*[@id='hauptspalte']/div/div/ul/li/a/h3";	
	if (doc.evaluate(taz_ArticleTitle_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.evaluate(taz_Multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("multiple");
		return "multiple";
	}  else if (doc.evaluate(taz_Search_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("multiple");
		return "multiple";
	}
}

function authorCase(author) { // Turns All-Uppercase-Authors to normally cased Authors
	var words = author.split(/\s|-/);
	var authorFixed = '';
	for (var i in words) {
		words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
		authorFixed = authorFixed + words[i] + ' ';
	}
	return(authorFixed);
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.url = doc.location.href; 

	
	// This is for the title!
	
	var title_XPath = '//title';
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.title = title.split(" - ")[0];
	
	// Summary
	var description_XPath = '//meta[contains(@name, "description")]';
	var description = doc.evaluate(description_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	summary = description.replace(/\sVON.*$/g, '');
	newItem.abstractNote = summary.replace(/KOMMENTAR|KOLUMNE.*$/g, '');
	
	// Authors 
	var author_XPath = "//*[contains(@class, 'sectbody')]/*/span[contains(@class, 'author')]";
	if (doc.evaluate(author_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ) {
		var author = doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else if (description.match(/^(KOMMENTAR)|(KOLUMNE)\sVON/)){
		Zotero.debug(description);
		author = description.replace(/^(KOMMENTAR)|(KOLUMNE)\sVON\s/, '');
	} else {
		var author = "";
	}
	author = author.replace(/^\s*|\s*$/g, '');
	author = author.replace(".", ". "); // in case a space is missing.
	author = author.replace("VON ", '');
	author = author.replace(/\s+/g, ' ');
	author = author.split(/\sund\s|\su\.\s|\,\s|\&/); 
	for (var i in author) {
		if (author[i].match(/\s/)) { // only names that contain a space!
			author[i] = author[i].replace(/^\s*|\s*$/g, '');
			author[i] = authorCase(author[i]);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
		}
	}
	
	
	
	// Section
	var section_XPath = ".//*[contains(@class, 'selected')]/ul/li[contains(@class, 'selected')]";
	if (doc.evaluate(section_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ) {
		var section= doc.evaluate(section_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.section = section;
	}
	
	// Date 
	var date_XPath = ".//div[contains(@class, 'secthead')]";
	var date = doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	date = date.replace(/^\s*|\s*$/g, '');
	date = date.substr(0,10);
	newItem.date = date;	

	newItem.attachments.push({url:doc.location.href, title:doc.title, mimeType:"text/html"});
	newItem.publicationTitle = "die tageszeitung"

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
		var taz_Multiple_XPath = ".//*[@id='hauptspalte']/div/ul/li/a";
		var taz_Search_XPath = ".//*[@id='hauptspalte']/div/div/ul/li/a";	

		 if (doc.evaluate(taz_Multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
			var titles = doc.evaluate(taz_Multiple_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		}  else if (doc.evaluate(taz_Search_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
			var titles = doc.evaluate(taz_Search_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		}

		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.innerHTML;
			items[next_title.href] = items[next_title.href].replace(/(\<h4.*?\>.*?\<\/h4\>\<h3.*?\>)(.*)\<\/h3\>.*/, '$2');
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
