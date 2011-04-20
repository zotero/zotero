{
        "translatorID": "eef50507-c756-4081-86fd-700ae4ebf22e",
        "label": "Spiegel Online",
        "creator": "Martin Meyerhoff",
        "target": "^http://www\\.spiegel\\.de/",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-04-01 11:56:06"
}

/*
Spiegel Online Translator
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
Test with the following URLs:
http://www.spiegel.de/suche/index.html?suchbegriff=AKW
http://www.spiegel.de/international/search/index.html?suchbegriff=Crisis
http://www.spiegel.de/international/topic/german_french_relations/
http://www.spiegel.de/international/europe/0,1518,700530,00.html
*/

function detectWeb(doc, url) {

	// I use XPaths. Therefore, I need the following block.
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var spiegel_article_XPath = ".//div[@id='spArticleFunctions']";
	
	if (doc.evaluate(spiegel_article_XPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		Zotero.debug("newspaperArticle");
		return "newspaperArticle";
	} else if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/thema/)){ 
		Zotero.debug("multiple");
		return "multiple";
	}  else if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/suche/)){ 
		Zotero.debug("multiple");
		return "multiple";
	}  else if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/international\/search/)){ 
		Zotero.debug("multiple");
		return "multiple";
	} else if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/international\/topic/)){ 
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

	// This is for the title 
	
	var title_xPath = ".//*[@id='spArticleColumn']/h2|.//*[@id='spArticleColumn ']/h2";
	if (doc.evaluate(title_xPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		var title = doc.evaluate(title_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.title = title;
	} else {
		var title = doc.evaluate('//title', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		title = title.split(" - ")[0];
		newItem.title = title;
	}

	// Tags
	var tags_xPath = '//meta[contains(@name, "keywords")]';
	var tags= doc.evaluate(tags_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	tags = tags.split(/,/);
	tags = tags.slice(5); // The first six 5 Tags are generic or section info.
	if (tags[0] != "" ) {
		for (var i in tags) {
			tags[i] = tags[i].replace(/^\s*|\s*$/g, '');
			newItem.tags.push(tags[i]);
		}
	}
	
	// Author
	var author_XPath1 = ".//p[contains(@class, 'spAuthor')]"; // Most of the time, the author has its own tag. Easy Case, really.
	var author_XPath2 =  ".//*[@id='spIntroTeaser']/strong/i"; // Sometimes, though, the author is in italics in the teaser.
	if (doc.evaluate(author_XPath1, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var author = doc.evaluate(author_XPath1, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		Zotero.debug(author);	 
	} else if  (doc.evaluate(author_XPath2, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var author = doc.evaluate(author_XPath2, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		Zotero.debug(author);	 
	} else {
		author = "";
	}
	
	author = author.replace(/^\s*By\s|^\s*Von\s|\s*$/g, ''); // remove whitespace around the author and the "Von "at the beginning
	if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/spiegel/)){ // Spiegel Online and the Spiegel Archive have different formatting for the author line
		author = author.split(/\sund\s|\su\.\s|\;\s|\sand\s/); 
		for (var i in author) {
			author[i] = author[i].replace(/(.*),\s(.*)/, '$2 $1');
		}
	} else {
	
		author = author.replace(/,\s|in\s\S*$/, ""); //remove ", location" or "in location"
		author = author.split(/\sund\s|\su\.\s|\,\s|\sand\s/); 
	}
	for (var i in author) {
		if (author[i].match(/\s/)) { // only names that contain a space!
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author[i], "author"));
		}
	}
	
	// Section
	var section_xPath = ".//ul[contains(@id, 'spChannel')]/li/ul/li/a[contains(@class, 'spActive')]";
	 if (doc.evaluate(section_xPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		var section = doc.evaluate(section_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.section = section;
	} 

	if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/spiegel/)){
		var printurl_xPath = ".//div[@id='spArticleFunctions']/ul/li[1]/a";
		var printurl = doc.evaluate(printurl_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.debug(printurl);
		newItem.attachments.push({url:printurl, title:doc.title, mimeType:"application/pdf"});
	} else { 
		// Attachment. Difficult. They want something inserted into the URL.
		var printurl = doc.location.href;
		printurl = printurl.replace(/(\d+\,\d+\.html.*$)/, 'druck-$1'); //done!
		newItem.attachments.push({url:printurl, title:doc.title, mimeType:"text/html"});
	}
	

	
	// Summary
	var summary_xPath = ".//p[@id='spIntroTeaser']";
	if (doc.evaluate(summary_xPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		var summary= doc.evaluate(summary_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.abstractNote = Zotero.Utilities.trim(summary);
	}
	
	// Date - sometimes xpath1 doesn't yield anything. Fortunately, there's another possibility...
	var date1_xPath = ".//h5[contains(@id, 'ShortDate')]"; 
	var date2_xPath = "//meta[@name='date']";
	if (doc.evaluate(date1_xPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		var date= doc.evaluate(date1_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		if (date.match('/')) {
			date = date.replace(/(\d\d)\/(\d\d)\/(\d\d\d\d)/, "$2.$1.$3");
		}
	} else if (doc.evaluate(date2_xPath, doc, null, XPathResult.ANY_TYPE, null).iterateNext() ){ 
		var date= doc.evaluate(date2_xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
		date=date.replace(/(\d\d\d\d)-(\d\d)-(\d\d)/, '$3.$2.$1');
	}
	newItem.date = Zotero.Utilities.trim(date);
	
	if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/spiegel/)){
		newItem.publicationTitle = "Der Spiegel";
	}else { 
		newItem.publicationTitle = "Spiegel Online";
	}
	

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
		
		 if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/thema/)){ 
			var titles = doc.evaluate(".//*[@id='spTeaserColumn']/div/h3/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else  if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/suche/)){ 
			var titles = doc.evaluate(".//*[@id='spTeaserColumn']/div/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else  if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/international\/search/)){ 
			var titles = doc.evaluate("//*[@id='spTeaserColumn']/div/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else  if (doc.location.href.match(/^http\:\/\/www\.spiegel\.de\/international\/topic/)){ 
			var titles = doc.evaluate(".//*[@id='spTeaserColumn']/div/h3/a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		} 
	
		var next_title;
		while (next_title = titles.iterateNext()) {
			//The search searches also manager-magazin.de, which won't work
			if (next_title.textContent != "mehr..."  && next_title.href.match(/^http:\/\/www\.spiegel\.de\//) ) { 
				items[next_title.href] = Zotero.Utilities.trim(next_title.textContent);
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
