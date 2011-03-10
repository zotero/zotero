{
        "translatorID": "83979786-44af-494a-9ddb-46654e0486ef",
        "label": "Reuters",
        "creator": "Avram Lyon, Michael Berkowitz",
        "target": "^https?://(www\\.)?reuters\\.com/",
        "minVersion": "2.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-10 21:05:59"
}

/*
   Reuters Translator
   Copyright (C) 2011 Avram Lyon, ajlyon@gmail.com

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
   Translator for Reuters. This is a minimal translator just to get Reuters back working after a redesign.
   Future versions should implement multiple item saving and attend to the nits that this translator has
   probably missed. 
*/

function detectWeb(doc, url) {
	if (url.match(/^https?:\/\/(www\.)?reuters\.com\/article/)) {
		return "newspaperArticle";
	}	
}

function doWeb(doc, url) {
	var item = new Zotero.Item("newspaperArticle");

	item.title = doc.evaluate('//meta[@property="og:title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().content;
	item.date = doc.evaluate('//meta[@name="REVISION_DATE"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().content;
	item.place = doc.evaluate('//div[@id="articleInfo"]//span[@class="location"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var byline = doc.evaluate('//div[@id="articleInfo"]//p[@class="byline"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var authors = byline.substr(3).split(',');
	for each (var aut in authors) {
		item.creators.push(authorFix(aut));
	}
	item.abstractNote = doc.evaluate('//span[@class="focusParagraph"]/p', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^.*\(Reuters\)\s+-\s+/,"");
	item.url = doc.evaluate('//link[@rel="canonical"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
	item.publicationTitle = "Reuters";
	if (item.place == item.place.toUpperCase())
	 item.place = Zotero.Utilities.capitalizeTitle(item.place.toLowerCase(),true);
	item.complete();
}

function authorFix(author) {
	// Sometimes we have "By Author"
	if(author.substr(0, 3).toLowerCase() == "by ") {
		author = author.substr(3);
	}
	var cleaned = Zotero.Utilities.cleanAuthor(author, "author");
	// If we have only one name, set the author to one-name mode
	if (cleaned.firstName == "") {
		cleaned["fieldMode"] = true;
	} else {
		// We can check for all lower-case and capitalize if necessary
		// All-uppercase is handled by cleanAuthor
		cleaned.firstName = (cleaned.firstName == cleaned.firstName.toLowerCase()) ?
			Zotero.Utilities.capitalizeTitle(cleaned.firstName, true) : cleaned.firstName;
		cleaned.lastName = (cleaned.lastName == cleaned.lastName.toLowerCase()) ?
			Zotero.Utilities.capitalizeTitle(cleaned.lastName, true) : cleaned.lastName;
	}
	return cleaned;
}
