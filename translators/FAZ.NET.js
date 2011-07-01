{
        "translatorID": "4f0d0c90-5da0-11df-a08a-0800200c9a66",
        "label": "FAZ.NET",
        "creator": "ibex",
        "target": "^http://((www\\.)?faz\\.net/.)",
        "minVersion": "2.1",
        "maxVersion": "",
        "priority": 100,
        "browserSupport": "gcs",
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-07-01 07:38:34"
}

/*
	FAZ Translator - Parses FAZ articles and creates Zotero-based metadata.
	Copyright (C) 2010-2011 ibex

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
http://www.faz.net/artikel/C30783/wissenschaftsphilosophie-krumme-wege-der-vernunft-30436005.html
http://www.faz.net/f30/common/Suchergebnis.aspx?term=philosophie&x=0&y=0&allchk=1
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
	if (doc.title == "Suche - FAZ.NET" && getXPath('//div[@class = "SuchPagingModul"]', doc)) {
		return "multiple";
	} else if (getXPath('//div[@class = "Article"]', doc)) {
		return "newspaperArticle";
	}
}

/* Zotero API */
function doWeb(doc, url) {
	//Zotero.debug("ibex doWeb URL = "+ url);
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc,
                doc.getElementById("MainColumn")
                .getElementsByTagName("h1"),
                '/artikel/.+\\.html');
		if (!items || countObjectProperties(items) == 0) {
            Zotero.debug("no items");
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
	var newArticle = new Zotero.Item('newspaperArticle');
	newArticle.url = doc.location.href;
	newArticle.title = Zotero.Utilities.trimInternal(getXPath('//div[@class = "Article"]/h1', doc).textContent);
	var date = getXPath('//div[@class = "Article"]//span[@id = "dateline"][1]', doc).textContent;
	newArticle.date = Zotero.Utilities.trimInternal(date.replace(/ .*$/, ""));


	var subtitle = getXPath('//div[@class = "Article"]/h2', doc);
	if (subtitle != null) {
		newArticle.shortTitle = newArticle.title;
		newArticle.title = Zotero.Utilities.trimInternal(subtitle.textContent) + ": " + newArticle.title;
	}

	var teaser = getXPath('//div[@class = "Article"]/h4', doc);
	if (teaser != null) {
		newArticle.abstractNote = Zotero.Utilities.trimInternal(teaser.textContent);
	}

	var authorline = getXPath('//div[@class = "Article"]/p[@class = "Author"]', doc);
	if (authorline != null) {
		authorline = Zotero.Utilities.trimInternal(authorline.textContent);
		//assumption of authorline: "Von name1 [und Name2][, location]"
		authorline = authorline.replace(/Von /, "");
		//remove ", location"
		authorline = Zotero.Utilities.trim(authorline.replace(/, .*$/, ""));

		var authors = authorline.split(" und ");
		for (var i = 0; i < authors.length && authorline.length > 0; i++) {
			newArticle.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
		}
	}

	newArticle.publicationTitle = "FAZ.NET";

	var section = getXPath('//div[@id="FAZNavMain"]//li[@class = "tabSelected"]/a', doc);
	if (section != null) {
		newArticle.section = Zotero.Utilities.trimInternal(section.textContent);
	}

	var source = getXPath('//div[@id="MainColumn"]/div[@class = "Article"]/p[@class = "ArticleSrc"]', doc);
	if (source != null) {
		newArticle.extra = Zotero.Utilities.trimInternal(Zotero.Utilities.cleanTags(source.innerHTML));
	}

	//unfortunately a print dialog will be shown due to <script>window.print();</script> if the snapshot is opened. A user must click on cancel afterwards.
	var length = newArticle.attachments.push({title:"FAZ.NET Article Snapshot", mimeType:"text/html", url:doc.location.href.replace("~Scontent.html", "~Scontent~Afor~Eprint.html"), snapshot:true});

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


/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://www.faz.net/artikel/C30783/wissenschaftsphilosophie-krumme-wege-der-vernunft-30436005.html",
        "items": [
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Fynn Ole",
                        "lastName": "Engler",
                        "creatorType": "author"
                    },
                    {
                        "firstName": "Jürgen",
                        "lastName": "Renn",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "title": "FAZ.NET Article Snapshot",
                        "mimeType": "text/html",
                        "url": false,
                        "snapshot": true
                    }
                ],
                "url": "http://www.faz.net/artikel/C30783/wissenschaftsphilosophie-krumme-wege-der-vernunft-30436005.html",
                "title": "Wissenschaftsphilosophie: Krumme Wege der Vernunft",
                "date": "2011-06-13",
                "shortTitle": "Krumme Wege der Vernunft",
                "abstractNote": "Wissenschaft hat eine Geschichte, wie kann sie dann aber rational sein? Im Briefwechsel zwischen Ludwik Fleck und Moritz Schlick deuteten sich bereits Antworten an.",
                "publicationTitle": "FAZ.NET",
                "extra": "Fynn Ole Engler ist Mitherausgeber der als Langzeitvorhaben der Akademie der Wissenschaften in Hamburg erscheinenden Moritz-Schlick-Gesamtausgabe. Jürgen Renn ist Direktor am Max-Planck-Institut für Wissenschaftsgeschichte in Berlin. Text: F.A.S. Bildmaterial: Foto ETH Zürich, ÖNB Bildarchiv Austria",
                "libraryCatalog": "FAZ.NET"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://www.faz.net/f30/common/Suchergebnis.aspx?term=philosophie&x=0&y=0&allchk=1",
        "items": "multiple"
    }
]
/** END TEST CASES **/
