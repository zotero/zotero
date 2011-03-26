{
        "translatorID": "cd77f1e5-507f-4c41-a6d2-bda5fa6f8694",
        "label": "Readability",
        "creator": "Avram Lyon",
        "target": "^https?://www\\.readability\\.com/articles",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "0",
        "translatorType": 4,
        "lastUpdated": "2011-03-26 17:16:55"
}

/*
   Readability Translator
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

function detectWeb(doc, url){
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	var title = doc.evaluate('//h1[@id="article-entry-title"]', doc, ns, XPathResult.ANY_TYPE, null);
	if (title) return "webpage";
	else return false;
}

function doWeb(doc, url){
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	// Since we don't know much about the site, we have to assume that
	// it is a webpage
	var item = new Zotero.Item("webpage");
	var title = doc.evaluate('//h1[@id="article-entry-title"]', doc, ns, XPathResult.ANY_TYPE, null);
	item.title = title.iterateNext().textContent;
	var rurl = doc.evaluate('//a[@id="article-url"]', doc, ns, XPathResult.ANY_TYPE, null);
	rurl = rurl.iterateNext();
	item.url = rurl.href;

	// This is just the domain name, but it'll serve as the site title,
	// since we don't know anything else.
	item.websiteTitle = rurl.textContent;

	// It is possible that Readability sometimes has multiple authors,
	// in which case this will have to be slightly amended
	var author = doc.evaluate('//span[@id="article-author"]/span[@class="fn"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
	if (author) {
		var auts = author.textContent.split(" and ");
		for (var i in auts) {
			item.creators.push(Zotero.Utilities.cleanAuthor(auts[i],"author"));
		}
	}

	// There is also a standardized timestamp, but we're ignoring that
	// in favor of the nice-looking time.
	var time = doc.evaluate('//time[@id="article-timestamp"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
	if(time) item.date = time.textContent;

	// We snapshot the page, using the existing document
	// TODO Eliminate the itemType:"attachment" when Z 2.1.2 is released
	item.attachments = [{itemType:"attachment", document:doc, title:"Readability Snapshot"}]
	item.complete();
}
