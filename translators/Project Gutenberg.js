{
	"translatorID":"d770e7d2-106c-4396-8c32-b35cdc46376c",
	"translatorType":4,
	"label":"Project Gutenberg",
	"creator":"Adam Crymble, Avram Lyon",
	"target":"^http://www\\.gutenberg\\.org",
	"minVersion":"2.1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2011-04-11 00:15:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("etext")||doc.location.href.match("ebooks")) {
		return "book";
	} else if (doc.location.href.match("catalog")) {
		return "multiple";
	}
}

//Project Gutenberg translator. Code by Adam Crymble.

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
	var creatorType = new Array();
	var creatorField = new Array();
	var creatorContent = new Array();
	
	var newItem = new Zotero.Item("book");

	var headings = doc.evaluate('//table[@class="bibrec"]//tr/th', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	var content = doc.evaluate('//table[@class="bibrec"]//tr/td', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var i;

	while (i = headings.iterateNext()) {
		fieldTitle = i.textContent;
		dataTags[fieldTitle] = Zotero.Utilities.cleanTags(content.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
		//Zotero.debug(i.textContent);
		if (fieldTitle == "Creator") {
			creatorType.push("author");
			creatorField.push("Creator");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Author") {
			creatorType.push("author");
			creatorField.push("Author");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Illustrator") {
			creatorType.push("illustrator");
			creatorField.push("Illustrator");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Translator") {
			creatorType.push("translator");
			creatorField.push("Translator");
			creatorContent.push(dataTags[fieldTitle]);	
		} else if (fieldTitle == "Editor") {
			creatorType.push("editor");
			creatorField.push("Editor");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Commentator") {
			creatorType.push("commentator");
			creatorField.push("Commentator");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Contributor") {
			creatorType.push("contributor");
			creatorField.push("Contributor");
			creatorContent.push(dataTags[fieldTitle]);
		} else if (fieldTitle == "Imprint") {
			var place = dataTags["Imprint"].split(":");
			newItem.place = place[0];
			//Zotero.debug(place);
		} else if (fieldTitle == "Subject") {
			newItem.tags.push(dataTags["Subject"]);
		} else {
			//Zotero.debug("Have: " + fieldTitle + "=>" + dataTags[fieldTitle]);
		}
	}

	for (var i = 0; i < creatorType.length; i++) {
		if (creatorContent[i].match(", ")) {
			
			var author = creatorContent[i].split(", ");
			var author = author[1] + " " + author[0];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, creatorType[i]));
		} else {
	
			newItem.creators.push(Zotero.Utilities.cleanAuthor(creatorContent[i], creatorType[i]));
		}
	}
	
	
	if (dataTags["EText-No."]) {
		newItem.callNumber = "EText-No. " + dataTags["EText-No."];
	}
	
	if (dataTags["ReleaseDate"]) {
		newItem.date = "Release Date " + dataTags["ReleaseDate"];
	}
	
	if (dataTags["LoCClass"]) {
		newItem.extra = "LoC Class " + dataTags["LoCClass"];
	}

	associateData (newItem, dataTags, "Title", "title");
	associateData (newItem, dataTags, "Language", "language");
	associateData (newItem, dataTags, "CopyrightStatus", "rights");
	
	newItem.url = doc.location.href;

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
		
		var allLinks = doc.evaluate('//td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var xPathCount = doc.evaluate('count(//td/a)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		for (var i = 0; i < xPathCount.numberValue; i++) {
			next_title = allLinks.iterateNext();
			if (next_title.href.match("etext")) {
				items[next_title.href] = next_title.textContent;
			}
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


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.gutenberg.org/ebooks/20321",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"firstName": "Bartolomé de las",
						"lastName": "Casas",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Indians, Treatment of -- Latin America",
					"Spain -- Colonies -- America"
				],
				"seeAlso": [],
				"attachments": [],
				"date": "Release Date Jan 9, 2007",
				"extra": "LoC Class F1401: Latin America local history: General",
				"title": "A Brief Account of the Destruction of the Indies\u000aOr, a faithful NARRATIVE OF THE Horrid and Unexampled Massacres, Butcheries, and all manner of Cruelties, that Hell and Malice could invent, committed by the Popish Spanish Party on the inhabitants of West-India, TOGETHER With the Devastations of several Kingdoms in America by Fire and Sword, for the space of Forty and Two Years, from the time of its first Discovery by them.",
				"language": "English",
				"rights": "Public domain in the USA.",
				"url": "http://www.gutenberg.org/ebooks/20321",
				"libraryCatalog": "Project Gutenberg"
			}
		]
	}
]
/** END TEST CASES **/
