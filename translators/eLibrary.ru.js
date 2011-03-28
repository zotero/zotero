{
        "translatorID": "587709d3-80c5-467d-9fc8-ed41c31e20cf",
        "label": "eLibrary.ru",
        "creator": "Avram Lyon",
        "target": "^http://elibrary\\.ru/",
        "minVersion": "1.0.0b4.r5",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-12 22:55:32"
}

/*
   eLibrary.ru Translator
   Copyright (C) 2010-2011 Avram Lyon, ajlyon@gmail.com

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
		Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	} else {
		scrape(doc);
	}
	
	Zotero.wait();
}

function scrape (doc) {
	    var n = doc.documentElement.namespaceURI;
    var ns = n ? function(prefix) {
        if (prefix == 'x') return n; else return null;
    } : null;
		var datablock = doc.evaluate('//td[@align="right" and @width="100%" and @valign="top"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		
		var tableLabels = doc.evaluate('./table/tbody/tr[1]/td[@bgcolor="#dddddd"][1]|./table//table[1]//tr[1]/td[@bgcolor="#dddddd"][1]', datablock, ns, XPathResult.ANY_TYPE, null);

		var titleBlock, authorBlock, publicationBlock, metaBlock, codeBlock, keywordBlock,  abstractBlock, referenceBlock;
		var t = 0,  label;	// Table number and label
		while ((label =  tableLabels.iterateNext()) !== null) {
			t++;
			label = label.textContent;

			switch (label) {
				case "Названиепубликации":
					titleBlock = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have titleBlock");
					break;
				case "Авторы":
					authorBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have authorBlock");
					break;
				case "Журнал":
				case "Издательство":
					metaBlock = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have metaBlock");
					break;
				case "Коды":
					codeBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have codeBlock");
					break;
				case "Ключевыеслова":
					keywordBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have keywordBlock");
					break;
				case "Аннотация":
					abstractBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have abstractBlock");
					break;
				case "Списоклитературы":
					referenceBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					Zotero.debug("have referenceBlock");
					break;
				case "Переводнаяверсия":
				default:
					Zotero.debug("Unknown/unsupported block: "+ label);
					break;
			}
		}
		
		var item = new Zotero.Item();
		/*var pdf = false;
		// Now see if we have a free PDF to download
		var pdfImage = doc.evaluate('//a/img[@src="/images/pdf_green.gif"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		if (pdfImage) {
			// A green PDF is a free one. We need to construct the POST request
			var postData = [], postField;
			var postNode = doc.evaluate('//form[@name="results"]/input', doc, ns, XPathResult.ANY_TYPE, null);
			while ((postField = postNode.iterateNext()) !== null) {
				postData.push(postField.name + "=" +postField.value);
			}
			postData = postData.join("&");
			Zotero.debug(postData + postNode.iterateNext());
			Zotero.Utilities.HTTP.doPost('http://elibrary.ru/full_text.asp', postData, function(text) {
				var href = text.match(/http:\/\/elibrary.ru\/download\/.*?\.pdf/)[0];
				pdf = {url:href, title:"eLibrary.ru полный текст", mimeType:"application/pdf"};
			});
		}*/

		item.title = doc.title.match(/eLIBRARY.RU - (.*)/)[1];
		
		if (authorBlock) {
		// Sometimes we don't have links, just bold text
		var authorNode = doc.evaluate('.//td[2]/font/a | .//td[2]/font/b', authorBlock, ns, XPathResult.ANY_TYPE, null);
		while ((author = authorNode.iterateNext()) !== null) {
			// Remove organizations; by URL or by node name
			if ((author.href && !author.href.match(/org_about\.asp/)
							 && !author.href.match(/org_items\.asp/))
					|| author.nodeName == "B") { 
				author = author.textContent;
				var authors = author.split(",");
				for (var i = 0; i < authors.length; i++) {
					var cleaned = Zotero.Utilities.cleanAuthor(authors[i], "author");
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
					// Skip entries with an @ sign-- email addresses slip in otherwise
					if (cleaned.lastName.indexOf("@") === -1) item.creators.push(cleaned);
				}
			} else { Zotero.debug("Skipping presumed affiliation: " + author.textContent) ; } 
		}
		}
		// This is the table of metadata. We could walk through it, but I found it easier
		// to just make a 2-d array of XPaths of field names values.
		var mapped = false;
		var metaPieces = [['.//table[1]//tr[1]/td[1]','.//table[1]//tr[1]/td[2]'],
							['.//table[1]//tr[2]/td[1]','.//table[1]//tr[2]/td[2]'],
							['.//table[2]//tr[1]/td[1]','.//table[2]//tr[1]/td[2]'],
							['.//table[2]//tr[1]/td[3]','.//table[2]//tr[1]/td[4]'],
							['.//table[2]//tr[2]/td[1]','.//table[2]//tr[2]/td[2]'],
							['.//table[2]//tr[2]/td[3]','.//table[2]//tr[2]/td[4]'],
							['.//table[2]//tr[3]/td[1]','.//table[2]//tr[3]/td[2]'],
							['.//table[2]//tr[3]/td[3]','.//table[2]//tr[3]/td[4]'],
							['.//table[2]//tr[4]/td[1]','.//table[2]//tr[4]/td[2]'],
							['.//table[2]//tr[4]/td[3]','.//table[2]//tr[4]/td[4]']]
		for (i in metaPieces) {
			mapped = mapper(metaPieces[i][0], metaPieces[i][1], metaBlock, doc);
			item[mapped[0]] = mapped[1];
		}
		if (item.extra) item.extra = "Цитируемость в РИНЦ: " + item.extra;
		if (abstractBlock)
			item.abstractNote = doc.evaluate('./tbody/tr/td[2]/table/tbody/tr/td/font', abstractBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		// Set type
		switch (item.itemType) {
			case "обзорная статья": // Would be "review article"
			case "научная статья":
			        item.itemType = "journalArticle";
			        break;
			case "учебное пособие":
			case "монография":
			        item.itemType = "book";
			        break;
			case "публикация в сборнике трудов конференции":
			        item.itemType = "conferencePaper";
			        break;
			default:
		                Zotero.debug("Unknown type: "+item.itemType+". Using 'journalArticle'");
				item.itemType = "journalArticle";
				break;
		}
		
		/*if (referenceBlock) {
			var note = Zotero.Utilities.trimInternal(
							doc.evaluate('./tbody/tr/td[2]/table', referenceBlock, ns, XPathResult.ANY_TYPE, null)
							.iterateNext().textContent);
			Zotero.debug(note);
			item.notes.push(note);
		}*/
		
		if (codeBlock) {
			item.extra += ' '+ doc.evaluate('.//td[2]', codeBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
 			var doi = item.extra.match(/DOI: (10\.[^\s]+)/);
 			if (doi) {
	 			item.DOI = doi[1];
	 			item.extra = item.extra.replace(/DOI: 10\.[^\s]+/,"");
	 		}
 		}
		
		if (keywordBlock) {
			var tag, tagNode = doc.evaluate('.//td[2]/a', keywordBlock, ns, XPathResult.ANY_TYPE, null);
			while ((tag = tagNode.iterateNext()) !== null)
					item.tags.push(tag.textContent);
		}

		if (item.title.toUpperCase() == item.title) {
			Zotero.debug("Trying to fix all-uppers");
			item.title = item.title.substr(0,1) + item.title.toLowerCase().substr(1);
		}

		//if(pdf) item.attachments.push(pdf);
		
		item.complete();
}

function mapper (from, to, block, doc) {
	var name = doc.evaluate(from, block, null, XPathResult.ANY_TYPE, null).iterateNext();
	var value = doc.evaluate(to, block, null, XPathResult.ANY_TYPE, null).iterateNext();
	if (!name || !value) return false;
	var key = false;
	switch (name.textContent.trim()) {
		case "Журнал":
			key = "publicationTitle"; break;
		case "Издательство":
			key = "publisher"; break;
		case "Год издания":
		case "Год выпуска":
			key = "date"; break;
		case "Том":
			key = "volume"; break;
		case "Номер":
			key = "issue"; break;
		case "ISSN":
			key = "ISSN"; break;
		case "Страницы":
			key = "pages"; break;
		case "Язык":
			key = "language"; break;
		case "Место издания":
			key = "place"; break;
		case "Цит. в РИНЦ":
			key = "extra"; break;
		case "Тип":
			key = "itemType"; break;
		default:
			Zotero.debug("Unmapped field: "+name.textContent.trim());
	}
	return [key, value.textContent.trim()];
}