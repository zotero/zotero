{
        "translatorID": "488fe1e0-b7d2-406f-8257-5060418ce9b2",
        "label": "fr-online.de",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.fr-online\\.de",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-26 15:45:54"
}

/*
fr-online.de Translator
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
Works w/ search and overviews. I had to include the ugly hack stopping non-articles (photo-streams) to make the multiple item import return an error. Test on:
http://www.fr-online.de/politik/spezials/wikileaks---die-enthuellungsplattform/-/4882932/4882932/-/index.html
http://www.fr-online.de/page/search/fr-online/home/suche/-/1473784/1473784/-/view/asSearch/-/index.html?contextsIds=1472660&docTypes=%22MauArticle,MauGallery,DMBrightcoveVideo,CMDownload,DMMovie,DMEvent,DMVenue%22&offset=5&pageNumber=2&searchMode=SIMPLEALL&sortBy=maupublicationdate&userQuery=Wikileaks
http://www.fr-online.de/wirtschaft/krise/-/1471908/1471908/-/index.html
http://www.fr-online.de/wirtschaft/krise/portugal-koennte-rettungspaket-benoetigen/-/1471908/8251842/-/index.html
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var FR_article_XPath = ".//div[contains(@class, 'ArticleToolBoxIcons')]";
	var FR_multiple_XPath = ".//*[@id='ContainerContent']/div/div[contains(@class, 'Headline2')]/a"

		
	if (doc.evaluate(FR_article_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.location.href.match(/^http\:\/\/www\.fr-online\.de\/.*?page\/search/) ) {
		Zotero.debug("multiple");
		return "multiple";
	} else if (doc.evaluate(FR_multiple_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		Zotero.debug("multiple");
		return "multiple";
	}
}

function authorCase(author) { // Turns All-Uppercase-Authors to normally cased Authors
	var words = author.split(/\s/);
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
	var FR_article_XPath = ".//div[contains(@class, 'ArticleToolBoxIcons')]"; // this protects against galleries...
	if (doc.evaluate(FR_article_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 	
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.url = doc.location.href; 

	
	// This is for the title!
	
	var title_XPath = '//title'
	var title = doc.evaluate(title_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.title = title.split("|")[0].replace(/^\s*|\s*$/g, '');

	// This is for the author!
	
	var author_XPath = '//meta[@name="author"]';
	var author= doc.evaluate(author_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	author = author.split(/\,\s|\sund\s/g);
	if (author[0].match(/Rundschau/)) { // Frankfurter Rundschau is no author.
		author[0] = "";
	}
	for (var i in author) {
		if (author[i].match(/\s/)) { // only names that contain a space!
			author[i] = Zotero.Utilities.trim(author[i]);
			author[i] = authorCase(author[i]);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
		}
	}
	
	//Summary
	var summary_XPath = '//meta[@name="description"]';
	 if (doc.evaluate(summary_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()  ){ 
		var summary= doc.evaluate(summary_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
		newItem.abstractNote = Zotero.Utilities.trim(summary);
	}
		
	//Date	
	var date_XPath = ".//div[contains(@class, 'TB_Date')]";
	var date = doc.evaluate(date_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	date = date.replace(/^\s*Datum\:\s|\s/g, ''); // remove "Datum: " and " "
	date = date.split("|");
	var realdate = "";
	realdate = realdate.concat(date[2], "-", date[1], "-", date[0]);
	newItem.date = realdate;
	
	// No Tags. FR does not provide consistently meaningful ones.
	
	// Publikation
	newItem.publicationTitle = "fr-online.de" 

	// Section
	var section_XPath = '//title'
	var section = doc.evaluate(section_XPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	section = section.split(/\||-/);
	newItem.section = section[1].replace(/^\s*|\s*$/g, '');
	
	// Attachment
	var printurl = doc.location.href;
	if (printurl.match("asFirstTeaser")) {
		printurl = printurl.replace("asFirstTeaser", "printVersion"); 
	} else {
		printurl = printurl.replace(/\-\/index.html$/, "-/view/printVersion/-/index.html");
	}
	newItem.attachments.push({url:printurl, title:doc.title, mimeType:"text/html"});
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
		
		var titles = doc.evaluate(".//*[@id='ContainerContentLinie']/div/h2/a|.//*[@id='ContainerContent']/div/div[contains(@class, 'Headline2')]/a|.//*[@id='ContainerContent']/div/div/div[contains(@class, 'link_article')]/a|.//*[@id='Main']/div[contains(@class, '2ColHP')]/div/div/div[contains(@class, 'Headline2')]/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			// This excludes the videos, whos link terminates in a hash.
			if (next_title.href.match(/.*html$/)) {
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
