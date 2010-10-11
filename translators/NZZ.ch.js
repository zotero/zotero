{
	"translatorID":"61ffe600-55e0-11df-bed9-0002a5d5c51b",
	"translatorType":4,
	"label":"nzz.ch",
	"creator":"ibex",
	"target":"^http://((www\\.)?nzz\\.ch/.)",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2010-09-08 12:00:00"
}

/*
	NZZ Translator - Parses NZZ articles and creates Zotero-based metadata.
	Copyright (C) 2010 ibex

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

/* Get the first xpath element from doc, if not found return null. */
function getXPath(xpath, doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;

	return doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
}

/* Zotero API */
function detectWeb(doc, url) {
	//Zotero.debug("ibex detectWeb URL= "+ url);
	if (doc.title.substr(0, 6) == "Suche " &&  getXPath('//div[@class = "searchdetails"]', doc)) {
		return "multiple";
	} else if (doc.location.href.match(/\.\d+\.html/) && getXPath('//li[@id = "article"]/div[@class = "article"]', doc)) {
		return "newspaperArticle";
	}
}

/* Zotero API */
function doWeb(doc, url) {
	//Zotero.debug("ibex doWeb URL= "+ url);
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc.getElementById("searchresult").getElementsByTagName("h3"), '\\.\\d+\\.html');
		if (!items || countObjectProperties(items) == 0) {
			return true;
		}
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}

		for (var i in items) {
			urls.push(i);
		}
	} else {
		urls.push(doc.location.href);
	}
	Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); } );
	Zotero.wait();
}

/* Three types of articles: "Neue Zürcher Zeitung", "NZZ Online" and "NZZ am Sonntag" */
function scrape(doc) {
	//Zotero.debug("ibex scrape URL = "+ doc.location.href);
	var newArticle = new Zotero.Item('newspaperArticle');
	newArticle.url = doc.location.href;
	newArticle.title = Zotero.Utilities.trimInternal(getXPath('//li[@id = "article"]/div[@class = "article"]/div[@class = "header"]//h1', doc).textContent);

	var publ = Zotero.Utilities.trimInternal(getXPath('//li[@id = "article"]/div[@class = "article"]/div[@class = "header"]/div[@class = "pubication"]', doc).textContent);
	publ = publ.split(',');
	newArticle.date = Zotero.Utilities.trimInternal(publ[0]);
	newArticle.publicationTitle = Zotero.Utilities.trimInternal(publ[publ.length - 1]);
	if (newArticle.publicationTitle.match(/^\d/)) {
		//set a publication title if there is only a number (date)
		newArticle.publicationTitle = "NZZ";
	} else if (newArticle.publicationTitle == "Neue Zürcher Zeitung") {
		newArticle.ISSN = "0376-6829";
	} else if (newArticle.publicationTitle == "NZZ am Sonntag") {
		newArticle.ISSN = "1660-0851";
	}

	var subtitle = getXPath('//li[@id = "article"]/div[@class = "article"]/div[@class = "header"]//h2', doc);
	if (subtitle != null && newArticle.publicationTitle != "NZZ am Sonntag") {
		newArticle.shortTitle = newArticle.title;
		newArticle.title += ": " + Zotero.Utilities.trimInternal(subtitle.textContent);
	}

	var teaser = getXPath('//li[@id = "article"]/div[@class = "article"]//div[@class = "body"]/h5', doc);
	if (teaser != null) {
		newArticle.abstractNote = Zotero.Utilities.trimInternal(teaser.textContent);
	}

	var authorline = getXPath('//li[@id = "article"]/div[@class = "article"]//div[@class = "body"]/p[contains(@class, "quelle")]', doc);
	authorline = !authorline && newArticle.publicationTitle == "NZZ am Sonntag"? subtitle :authorline; // subtitle in some cases of "NZZ am Sonntag"
	if (authorline != null) {
		authorline = Zotero.Utilities.trimInternal(authorline.textContent);
		//assumption of authorline: "[Interview:|Von ]name1 [und Name2][, location]"
		authorline = authorline.replace(/^.*Von /, "");
		authorline = authorline.replace(/Interview: /, "");
		//remove ", location"
		authorline = Zotero.Utilities.trim(authorline.replace(/, .*$/, ""));

		var authors = authorline.split(" und ");
		for (var i = 0; i < authors.length && authorline.length > 0; i++) {
			newArticle.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
		}
	}

	var section = getXPath('//ul[@id="navContent"]/li/a[@id="navContentSelected"]', doc);
	if (section != null) {
		newArticle.section = Zotero.Utilities.trimInternal(section.textContent.replace(/·/,""));
	}

	newArticle.attachments.push({title:"NZZ Online Article Snapshot", mimeType:"text/html", url:doc.location.href + "?printview=true", snapshot:true});

	newArticle.complete();
}

/* There is no built-in function to count object properties which often are used as associative arrays.*/
function countObjectProperties(obj) {
	var size = 0;
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
}
