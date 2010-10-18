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
        "lastUpdated":"2010-10-18 10:01:42"
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
		
		var tableLabels = doc.evaluate('./table/tbody/tr[1]/td[@bgcolor="#dddddd"][1]|./table//table[1]//tr[1]/td[@bgcolor="#dddddd"][1]', datablock, ns, XPathResult.ANY_TYPE, null);

		var titleBlock, authorBlock, publicationBlock, metaBlock, codeBlock, keywordBlock,  abstractBlock, referenceBlock;
		var t = 0,  label;	// Table number and label
		while ((label =  tableLabels.iterateNext()) !== null) {
			t++;
			label = label.textContent;

			switch (label) {
				case "Названиепубликации":
					titleBlock = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Авторы":
					authorBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Журнал":
					metaBlock = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Коды":
					codeBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Ключевыеслова":
					keywordBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Аннотация":
					abstractBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Коды":
					codeBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Списоклитературы":
					referenceBlock  = doc.evaluate('./table['+t+']',  datablock, ns, XPathResult.ANY_TYPE, null).iterateNext();
					break;
				case "Переводнаяверсия":
				default:
					Zotero.debug("Unknown/unsupported block: "+ label);
					break;
			}
		}
		var type = doc.evaluate('.//table[2]//tr[5]/td[4]', metaBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		switch (type) {
			case "научная статья":
			        type = "journalArticle";
			        break;
			case "учебное пособие":
			case "монография":
			        type = "book";
			        break;
			default:
		                Zotero.debug("Unknown type: "+type+". Using 'journalArticle'");
				type = "journalArticle";
				break;
		}
		
		var item = new Zotero.Item(type);
		
		// Now see if we have a free PDF to download
		var pdfImage = doc.evaluate('//a/img[@src="/images/pdf_green.gif"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		if (pdfImage) {
			var attachments = [];
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
				attachments.push({url:href, title:"eLibrary.ru полный текст", mimeType:"application/pdf"});
			});
		}

		item.title = doc.title.match(/eLIBRARY.RU - (.*)/)[1];
		
		if (authorBlock) {
		var authorNode = doc.evaluate('.//td[2]/font/a', authorBlock, ns, XPathResult.ANY_TYPE, null);
		while ((author = authorNode.iterateNext()) !== null) {
			if (!author.href.match(/org_about\.asp/)) { // Remove organizations
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
		/*if (referenceBlock) {
			var note = Zotero.Utilities.cleanString(
							doc.evaluate('./tbody/tr/td[2]/table', referenceBlock, ns, XPathResult.ANY_TYPE, null)
							.iterateNext().textContent);
			Zotero.debug(note);
			item.notes.push(note);
		}*/
		if (codeBlock) {
			item.extra = doc.evaluate('.//td[2]', codeBlock, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
 			var doi = item.extra.match(/DOI: (10\..+?) /);
 			if (doi) item.DOI = doi[1];
 		}
		
		if (keywordBlock) {
			var tag, tagNode = doc.evaluate('.//td[2]/a', keywordBlock, ns, XPathResult.ANY_TYPE, null);
			while ((tag = tagNode.iterateNext()) !== null)
					item.tags.push(tag.textContent);
		}

		item.attachments = attachments.shift();
		
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}
