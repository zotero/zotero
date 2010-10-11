{
	"translatorID":"caecaea0-5d06-11df-a08a-0800200c9a66",
	"translatorType":4,
	"label":"tagesanzeiger.ch/Newsnetz",
	"creator":"ibex",
	"target":"^http://((www\\.)?(tagesanzeiger|bernerzeitung|bazonline|derbund|thurgauerzeitung)\\.ch/.)",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2010-09-08 12:00:00"
}

/*
	Tagesanzeiger.ch Translator - Parses tagesanzeiger.ch, bernerzeitung.ch,
	bazonline.ch, derbund.ch, thurgauerzeitung.ch articles from to the
	Newsnetz and creates Zotero-based metadata.
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
	if (doc.location.href.indexOf("suche.html?") != -1 && doc.getElementById("panelArticleItems")) {
		return "multiple";
	} else if (doc.location.href.indexOf("/story/") != -1
			&& getXPath('//div[@id = "singlePage"]/div[@id = "singleLeft"]/h2', doc)) {
		return "newspaperArticle";
	}
}

/* Zotero API */
function doWeb(doc, url) {
	//Zotero.debug("ibex doWeb URL= "+ url);
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc.getElementById("panelArticleItems").getElementsByTagName("h3"), '/story/\\d+');
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

function scrape(doc) {
	//Zotero.debug("ibex scrape URL = " + doc.location.href);
	var newArticle = new Zotero.Item('newspaperArticle');
	newArticle.url = doc.location.href;
	newArticle.title = Zotero.Utilities.trimInternal(getXPath('//div[@id = "singleLeft"]/h2', doc).textContent);

	var date = Zotero.Utilities.trimInternal(getXPath('//div[@id = "singleLeft"]/p[@class = "publishedDate"]', doc).textContent);
	newArticle.date = Zotero.Utilities.trimInternal(date.split(/[:,] */)[1]);

	var authorline = getXPath('//div[@id = "singleLeft"]/div[@id = "metaLine"]/h5', doc);
	if (authorline != null && authorline.textContent.length > 0) {
		authorline = Zotero.Utilities.trimInternal(authorline.textContent);
		//remove script code "//<![CDATA[  ...  //]]>"
		authorline = authorline.replace(/\/\/<!\[CDATA\[.*\/\/\]\]>/, "");
		//assumption of authorline: "[Interview:|Von name1 [und Name2][, location].] [Aktualisiert ...]"
		authorline = authorline.replace(/Von /, "");
		authorline = authorline.replace(/Interview: /, "");
		authorline = authorline.replace(/Aktualisiert .*$/, "");
		authorline = authorline.replace(/, .*$/, "");
		authorline = Zotero.Utilities.trim(authorline.replace(/\. .*$/, ""));

		var authors = authorline.split(" und ");
		for (var i = 0; i < authors.length && authorline.length > 0; i++) {
			newArticle.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
		}
	}

	var teaser = getXPath('//div[@id = "singleLeft"]/p[@class = "teaser"]', doc);
	if (teaser != null) {
		newArticle.abstractNote = Zotero.Utilities.trimInternal(teaser.textContent);
	}

	var publicationTitle = getXPath('//div[@id = "singleLeft"]//span[@class = "idcode"]', doc);
	newArticle.publicationTitle = doc.location.host.replace(/^www./,"");
	if (publicationTitle != null) {
		publicationTitle = Zotero.Utilities.trimInternal(publicationTitle.textContent);
		newArticle.publicationTitle += ": " + publicationTitle;
		if (publicationTitle == '(Tages-Anzeiger)') {
			newArticle.publicationTitle = "Tages-Anzeiger";
			newArticle.ISSN = "1422-9994";
		}
	}

	var section = getXPath('//div[@id = "singleHeader"]/h1/span', doc);
	if (section != null) {
			newArticle.section = Zotero.Utilities.trimInternal(section.textContent);
	}

	newArticle.attachments.push({title:"tagesanzeiger.ch Article Snapshot", mimeType:"text/html", url:doc.location.href + "/print.html", snapshot:true});

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