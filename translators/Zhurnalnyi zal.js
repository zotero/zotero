{
	"translatorID" : "0db1c2d0-eaae-4f3d-94ef-d4b3aa61de16",
	"label" : "Журнальный зал",
	"creator" : "Avram Lyon",
	"target" : "^http://magazines\\.russ\\.ru/[a-zA-Z -_]+/[0-9]+/[0-9]+/",
	"minVersion" : "2.0",
	"maxVersion" : "",
	"priority" : 100,
	"inRepository" : "true",
	"translatorType" : 4,
	"lastUpdated" : "2010-08-23 00:45:42"
}

/*
   Журнальный зал Translator
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
 
 Translator for Russian journal aggregator. Scrapes basic bibliographic information
 for all of the journals, many of them literary or academic, hosted on the site.
 
 Due to small variations in journal formatting, some will not be translated correctly.

 Examples (Chicago style):
 1. Сергей Бирюков, “Избранное из неизбранного,” Дети Ра, no. 6 (2010), http://magazines.russ.ru/ra/2010/6/bi3.html.
 2. Вера Проскурина, “Ода Г.Р. Державина «На Счастие»: политика и поэтика,” НЛО, no. 97 (2009), http://magazines.russ.ru/nlo/2009/97/pr8.html.
 */

function detectWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
        var ns = n ? function(prefix) {
                if (prefix == 'x') return n; else return null;
        } : null;

	var results = doc.evaluate('//div[@class="opub"]', doc, ns, XPathResult.ANY_TYPE, null);
	if (results.iterateNext()) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
        var ns = n ? function(prefix) {
                if (prefix == 'x') return n; else return null;
        } : null;

	var publication = doc.evaluate('//div[@class="opub"]/a', doc, ns, XPathResult.ANY_TYPE, null);
	publication = publication.iterateNext().textContent;
	var pieces = publication.match(/«(.*)»[\n\t ]*([0-9]+), №([0-9]+)/);

	var title = doc.evaluate('//div[@class="title1"]', doc, ns, XPathResult.ANY_TYPE, null);
	title = title.iterateNext().textContent;

	var author = doc.evaluate('//*[@class="avt1"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
	author = author.textContent;

	item = new Zotero.Item("journalArticle");
	item.publicationTitle = pieces[1];
	item.title = title;
	item.date = pieces[2];
	item.issue = pieces[3];
	item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
	item.url = url;
	item.attachments.push({url:url, title: (item.publicationTitle + " Snapshot"), mimeType:"text/html"});

	item.complete();
	
}
