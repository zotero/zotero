{
	"translatorID":"f87c10fe-2bdc-4e1e-aedd-7fd20ec4b4c2",
	"translatorType":4,
	"label":"Getty Research Library Catalog",
	"creator":"Adam Crymble",
	"target":"http://(opac.pub|library).getty.edu",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-21 15:45:00"
}

function detectWeb(doc, url) {
	
	var  multiCheck = '';
	
	if (doc.evaluate('//table/tbody/tr/td[1]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		multiCheck = doc.evaluate('//table/tbody/tr/td[1]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	var callNumSearch = '';
	if (doc.evaluate('//table/tbody/tr/th[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		callNumSearch = doc.evaluate('//table/tbody/tr/th[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	if (callNumSearch.match("Call Number")) {
		return "multiple";
	}
	
	if (multiCheck.match("Sort by:")) {
		return "multiple";
	}
	
	if (doc.evaluate('//table[2]/tbody/tr/th', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match("Author:")) {
		return "book";
	} else if (doc.evaluate('//tr/th/font/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	} else if (doc.evaluate('//tr/th/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

//Getty Research Library Catalog translator. Code by Adam Crymble

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	
	var fieldContent = new Array();
	var fieldExtra = new Array();
	var tagsContent = new Array();
	var multis = new Array();
	
	var content1;
	var extra1;
	var multi1;
	
	var newItem = new Zotero.Item("book");
	
	var multiLineEntry = doc.evaluate('//table[2]/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	while (multi1 = multiLineEntry.iterateNext()) {
		multis.push(multi1.textContent);
	}
	
	//Puts field Content into an array
	var contents = doc.evaluate('//table[2]/tbody/tr/td', doc, nsResolver, XPathResult.ANY_TYPE, null);
	while (content1 = contents.iterateNext()) {
		if (content1.textContent.match(/\w/)) {
			fieldContent.push(content1.textContent.replace(/^\s*|\s*&/g, ''));
		}
	}
	
	//Entries that do not line up perfectly with a field heading are put into an array and these are then removed from the field Content array.
	var extraField = doc.evaluate('//table[2]/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	while (extra1 = extraField.iterateNext()) {
		if (extra1.textContent.match(/\w/)) {
			fieldExtra.push(extra1.textContent.replace(/^\s*|\s*&/g, ''));
		}
	}	
	
	var duplicates = new Array();
	for (var i = 0; i < fieldContent.length; i++) {
		for (var j = 0; j < fieldExtra.length; j++) {
			if (fieldContent[i] == fieldExtra[j]) {
				duplicates.push(i);
			}
		}
	}
	var cleanContent = new Array();
	
	for (var i = duplicates.length-1; i > -1; i --) {
	
		fieldContent[duplicates[i]-1] = fieldContent[duplicates[i]-1] + "; " + fieldContent[duplicates[i]];
		fieldContent[duplicates[i]] = '';
	}

	for (var i = 0; i < fieldContent.length-1; i++) {
		if (fieldContent[i].match(/\w/)) {
			cleanContent.push(fieldContent[i]);
		}
	}
	
	var headers = doc.evaluate('//form/table/tbody/tr/th', doc, nsResolver, XPathResult.ANY_TYPE, null);	
	
	//field title and cleancontent have the same number of entries; These are then associated and put into dataTags object.
	for (var i = 0; i < cleanContent.length; i++) {
		fieldTitle = headers.iterateNext().textContent.replace(/\s+/g, '');
		if (fieldTitle.match(/\w/)) {
		
		} else {
			fieldTitle = headers.iterateNext().textContent.replace(/\s+/g, '');
		}
		dataTags[fieldTitle] = cleanContent[i];
		
	}
	
	//The data is all now in the dataTags object. It needs only to be formatted and put in the proper Zotero fields.
	
	//fixing up any content that needs a different format for Zotero and then pushing it into Zotero.
	if (dataTags["Notes:"]) {
		if (dataTags["Notes:"].match("; ")) {
			var notes1 = dataTags["Notes:"].split("; ");
			var notes2 = '';
		
			for (var i = 0; i < notes1.length; i++) {
				
				if (notes2.match(/\w/)) {
					notes2 = notes2 + "; " + notes1[i];
				} else {
					notes2 = notes1[i];
				}
			}
			dataTags["Notes:"] = notes2;
		} 
	}
	
	if (dataTags["Subjects:"]) {
		if (dataTags["Subjects:"].match("; ")) {
			tagsContent = dataTags["Subjects:"].split("; ");
		} else {
			newItem.tags = dataTags["Subjects:"];
			var noMoreTags = 1;
		}
		if (noMoreTags != 1) {
			for (var i = 0; i < tagsContent.length; i++) {
				newItem.tags[i] = tagsContent[i];		
			}
		}
	}
	
	if (dataTags["Author:"]) {
		if (dataTags["Author:"].match(", ")) {
			var author = dataTags["Author:"].split(', ');
			author = author[1].substr(0, author[1].length) + " " + author[0];
			author = author.replace(/\./, '');
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	if (dataTags["CorporateAuthor:"]) {
		newItem.creators.push({lastName: dataTags["CorporateAuthor:"], creatorType: "creator"});
	}
	
	if (dataTags["Location:"]) {
		newItem.extra = "Location in Library: " + " " + dataTags["Location:"];
	}
	
	if (dataTags["PersistentLinkforthisRecord:"]) {
		associateData (newItem, dataTags, "PersistentLinkforthisRecord:", "url");
	} else {
		newItem.url = doc.location.href;
	}
	
	//Publishing info is split in a best guess format. 
	//If not all of Place, Publisher and Date are present, or they are in an unstandard format, the information is stored in Publisher.
	if (dataTags["PublicationInformation:"]) {
		if (dataTags["PublicationInformation:"].match(": ")) {
			var colon = dataTags["PublicationInformation:"].indexOf(":");
			var place1 = dataTags["PublicationInformation:"].substr(0, colon);
			newItem.place = place1;
			var publisher1 = dataTags["PublicationInformation:"].substr(colon);
			if (publisher1.match(", ")) {
				var date1 = publisher1.split(", ");
				newItem.publisher = date1[0];
				if (date1[1].match(/\d/)) {
					newItem.date = date1[1];
				}
			} else {
				newItem.date = publisher1;
			}
		} else {
			newItem.publisher = dataTags["PublicationInformation:"];
		}
	}
	
	associateData (newItem, dataTags, "Title:", "title");	
	associateData (newItem, dataTags, "Series:", "series");	
	associateData (newItem, dataTags, "Description:", "description");	
	associateData (newItem, dataTags, "ISBN:", "ISBN");
	associateData (newItem, dataTags, "Notes:", "abstractNote");
	associateData (newItem, dataTags, "CallNumber:", "callNumber");
	associateData (newItem, dataTags, "Edition:", "edition");

	newItem.notes.push({title:"Title", note:"Site is designed to timeout user. This may prevent Zotero from saving a screen capture."});

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
		
		var typeOfPage = doc.evaluate('//table/tbody/tr/th[3]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		Zotero.debug(typeOfPage);
		
		if (typeOfPage.match("Title")) {
			var titles = doc.evaluate('//table/tbody/tr/td[3]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else {
			var titles = doc.evaluate('//table[2]/tbody/tr/td[2]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}