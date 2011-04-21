{
        "translatorID": "c436f3c7-4246-4ed3-a227-a538c8113a0e",
        "label": "fishpond.co.nz",
        "creator": "Sopheak Hean",
        "target": "^https?://www\\.fishpond\\.co\\.nz/",
        "minVersion": "1.0",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-04-21 09:34:42"
}

/*
    Fishpond.co.nz Translator- Parses Fishpond.co.nz articles and creates Zotero-based metadata
   Copyright (C) 2011 Sopheak Hean, University of Waikato, Faculty of Education
   Contact:  maxximuscool@gmail.com
   
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


function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
	var definePath = '//td[@class="main hproduct"]/h1';
	var XpathObject = doc.evaluate(definePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if  (XpathObject) {
		return "book";
	} else {
		var definePath = '//td[@id="page_title"]/h1';
		var XpathObject = doc.evaluate(definePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if  (XpathObject) {
			return "multiple";
		}
	}

}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("book");
	var title = '//span[@class="fn"]';
	var titleObject = doc.evaluate(title, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (titleObject){
		newItem.title = titleObject.textContent;
	}
		
	var author = '//p[@id="product_author"]';
	var authorObject = doc.evaluate(author, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (authorObject){
			authorObject = authorObject.textContent;
			if (( authorObject.match(/By\s/)) && (authorObject.match(/\([A-Za-z]+\W[a-zA-Z]+\)/)  )){
				authorObject = authorObject.replace(/By\s/, '').replace(/\([A-Za-z]+\W[a-zA-Z]+\)/, '');
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorObject, "author"));   
			} 
			else if (authorObject.match(/By\W/)) {
				authorObject = authorObject.replace(/By\s/, '');
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorObject, "author"));   
			}
			
		}
	var date = '//table[@class="product_info_text"]/tbody/tr[3]';
	var dateObject = doc.evaluate(date, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (dateObject){
		dateObject = dateObject.textContent;
		if (dateObject.match(/Release Date:\s/)){
			newItem.date = dateObject.replace(/Release Date:\s/, '');
		} else {
			
			var d = new Date();
			date ='//span[@class="arrival_time"]';
			dateObject = doc.evaluate(date, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(dateObject){
					newItem.date = dateObject.textContent.replace(/Available\s/, '')+ " " +d.getFullYear()
					;
				}
		}
	}
	var abstract = '//table[@class="product_info_text"]/tbody/tr/td/p[@class="description"]';
	var abstractObject = doc.evaluate(abstract, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (abstractObject){
		abstractObject = abstractObject.textContent;
		newItem.abstractNote = abstractObject;
	}
	
	var isbn = "//table/tbody/tr/td[2]/table[4]/tbody/tr[2]/td[2]";
	var isbnObject = doc.evaluate(isbn, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (isbnObject){
		newItem.ISBN = isbnObject.textContent;
	}
	var publisher = "//table/tbody/tr/td[2]/table[4]/tbody/tr[1]/td[2]/a";
	var publisherObject = doc.evaluate(publisher, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (publisherObject) {
	 	newItem.publisher= publisherObject.textContent;
	}

	newItem.attachments.push({title:"FishPond Record", mimeType:"text/html", url:doc.location.href});
	newItem.complete();
}


function doWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		
		var titles = '//td[@class="productSearch-data"]/table/tbody/tr/td/div/a';
		var titleObject = doc.evaluate(titles, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title; 
		while ( next_title = titleObject.iterateNext()) {
			items[next_title.href] = next_title.textContent;
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
