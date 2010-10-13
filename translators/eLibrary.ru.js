{
        "translatorID":"587709d3-80c5-467d-9fc8-ed41c31e20cf",
        "label":"eLibrary.ru",
        "creator":"Avram Lyon",
        "target":"^http://elibrary\\.ru/",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-10-13 21:41:03"
}

/*
   eLibrary.ru Translator
   Copyright (C) 2010 Avram Lyon, ajlyon@gmail.com

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

function detectWeb(doc, url){
	if (url.match(/\/item.asp/)) {
		return "journalArticle";
	} else if (url.match(/\/query_results\.asp/) || url.match(/\/contents\.asp/)){
		return "multiple";
	}
}

function doWeb(doc, url){
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var results = doc.evaluate('//table[@id="restab"]//tr[@bgcolor = "#f5f5f5"]/td[2]', doc, ns, XPathResult.ANY_TYPE, null);
		var items = new Array();
		var result;
		while(result = results.iterateNext()) {
			var link = doc.evaluate('./a', result, ns, XPathResult.ANY_TYPE, null).iterateNext();
			var title = link.textContent;
			var url = link.href;
			items[url] = title;
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	
	Zotero.Utilities.processDocuments(articles, function(doc) {
		var datablock = doc.evaluate('//td[@align="right" and @width="100%" and @valign="top"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		
		// Some pages have no author information, so our count of tables will be incorrect
		var tableCount = doc.evaluate('count(./table)', datablock, ns, XPathResult.ANY_TYPE, null).numberValue;
		var authorMissing = (tableCount < 3);		
		var titleBlock =  (authorMissing) ? 
           	 	doc.evaluate('./table[1]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext()
           	 	: doc.evaluate('./table[1]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
		var metaBlock =  (authorMissing) ? 
           	 	doc.evaluate('./table[2]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext()
           	 	: doc.evaluate('./table[3]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
		var abstractBlock =  (authorMissing) ? 
           	 	doc.evaluate('./table[3]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext()
           	 	: doc.evaluate('./table[4]', datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
		
		var type = doc.evaluate('.//table[2]//tr[5]/td[4]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		switch (type) {
			case "научная статья":
			default:
				type = "journalArticle";
				break;
		}
		
		item = new Zotero.Item(type);

		item.title = doc.title.match(/eLIBRARY.RU - (.*)/)[1];
		var author = doc.evaluate('./table[2]//td[2]/font/a', datablock, ns, XPathResult.ANY_TYPE, null);

		if ((author = author.iterateNext()) !== null) {
			author = author.textContent;
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
			item.creators.push(cleaned);
		}

		item.publicationTitle = doc.evaluate('.//table[1]//tr[1]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.publisher = doc.evaluate('.//table[1]//tr[2]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.date = doc.evaluate('.//table[2]//tr[1]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.ISSN = doc.evaluate('.//table[2]//tr[1]/td[4]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.volume = doc.evaluate('.//table[2]//tr[2]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.issue = doc.evaluate('.//table[2]//tr[3]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.pages = doc.evaluate('.//table[2]//tr[4]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.language = doc.evaluate('.//table[2]//tr[5]/td[2]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		if (abstractBlock)
			item.abstractNote = doc.evaluate('./tbody/tr/td[2]/table/tbody/tr/td/font', abstractBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}
