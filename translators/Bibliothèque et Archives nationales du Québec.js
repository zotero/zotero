{
	"translatorID":"59cce211-9d77-4cdd-876d-6229ea20367f",
	"translatorType":4,
	"label":"Bibliothèque et Archives nationales du Québec",
	"creator":"Adam Crymble",
	"target":"http://catalogue.banq.qc.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-12 12:35:00"
}

function detectWeb(doc, url) {
	if (doc.title.match("Search")) {
		return "multiple";
	} else if (doc.title.match("Recherche")) {
		return "multiple";
		
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("book")) {
		return "book";
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mmusic")) {
		return "book";	
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("manalytic")) {
		return "book";
		
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("msdisc")) {
		return "audioRecording";
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("msound")) {
		return "audioRecording";
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mscas")) {
		return "audioRecording";
		
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mvdisc")) {
		return "videoRecording";
	
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mpaint")) {
		return "artwork";
	
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mserial")) {
		return "report";
	
	} else if (doc.evaluate('//td[2]/a/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src.match("mcomponent")) {
		return "newspaperArticle";
	}
}



//Bibliotheque et Archives National du Quebec. Code by Adam Crymble

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
	var fieldTitle;
	var contents;	
	var descriptionField;
	var tagsContent= new Array();
	var inField = 0;

	//determines media type	
	if (detectWeb(doc, url) == "book") {
		var newItem = new Zotero.Item("book");
		descriptionField = "pages";
	} else if (detectWeb(doc, url) == "audioRecording") {
		var newItem = new Zotero.Item("audioRecording");
		descriptionField = "runningTime";
	} else if (detectWeb(doc, url) == "videoRecording") {
		var newItem = new Zotero.Item("videoRecording");
		descriptionField = "runningTime";
	} else if (detectWeb(doc, url) == "artwork") {
		var newItem = new Zotero.Item("artwork");
		descriptionField = "artworkSize";
	} else if (detectWeb(doc, url) == "report") {
		var newItem = new Zotero.Item("report");
		descriptionField = "pages";
	}  else if (detectWeb(doc, url) == "newspaperArticle") {
		var newItem = new Zotero.Item("newspaperArticle");
		descriptionField = "pages"
	}
	
//determines  language	
	var lang = doc.evaluate('//td[2]/a/img', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var langCount = doc.evaluate('count (//td[2]/a/img)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var lang1 = lang.iterateNext().src;
	
	if (langCount.numberValue > 1) {	
		lang1 = lang.iterateNext().src;

		if (lang1.match("lfre")) {
			newItem.language = "French";
		} else if (lang1.match("leng")) {
			newItem.language = "English";
		}
	}
	
//scraping XPaths	
	var xPathHeadings = doc.evaluate('//td/table/tbody/tr/td[2]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContents = doc.evaluate('//td[2]/table/tbody/tr/td/table/tbody/tr/td[4]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//td/table/tbody/tr/td[2]/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	if (doc.evaluate('//td/table/tbody/tr/td[2]/b', doc, nsResolver, XPathResult.ANY_TYPE, null)) {
		
	   	for (i=0; i<xPathCount.numberValue; i++) {	 
			
			fieldTitle  = xPathHeadings.iterateNext().textContent.replace(/\s+/g, '');
			contents = xPathContents.iterateNext().textContent;
			
			if (contents.match("[*]") && fieldTitle!= "Publisher" && fieldTitle!= "Éditeur") {
				var removeTagExcess = contents.indexOf("[");
				contents = contents.substr(0, removeTagExcess);
			}		
			
			if (fieldTitle == "Author" | fieldTitle == "Auteur") {
				fieldTitle = "Author";
				dataTags[fieldTitle] = (contents);
			     	var authorName = dataTags["Author"].split(",");
		     		authorName[0] = authorName[0].replace(/\s+/g, '');
		
		     		dataTags["Author"] = (authorName[1] + (" ") + authorName[0]);
		     		newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Author"], "author"));  		
		
	 	 //publishing info    		
			} else if (fieldTitle == "Publisher" | fieldTitle == "Éditeur") {
				fieldTitle = "Publisher";
				
				dataTags["Publisher"] = (contents);
				
				if (dataTags["Publisher"].match(":")) {
				
					var place1 = dataTags["Publisher"].split(":");
					dataTags["Place"] = place1[0].replace(/^\s*|\[|\]/g,'');
					
					var publish = place1[1].split(",");
					dataTags["Publish"] = (publish[0].replace(/^\s*|\[|\]/g,''));
					
					place1[1] = place1[1].replace(/^\s*|\s*$|\[|\]/g, '');
					if (place1[1].match("/?")) {
						var dateLength = place1[1].length-5;
					} else {
						var dateLength = place1[1].length-4;
					}
					dataTags["Date"] = place1[1].substr(dateLength);
				} else {
					dataTags["Date"] = (contents);
				}
			
		//tags		
			} else if (fieldTitle == "Subjects" | fieldTitle == "Sujets") {
			     	fieldTitle = "Subjects";
			     	tagsContent = contents.split("\n");
		
		//source	
			} else  if (fieldTitle == "Source") {
				dataTags[fieldTitle] = (contents.replace(/^\s*|\s*$/g, ''));
				dataTags["Source"] = ("Source: " + dataTags["Source"]);
				Zotero.debug(doc.title);  	
		//normal	     					
			} else {
				dataTags[fieldTitle] = (contents.replace(/^\s*|\s*$/g, ''));	
			}    
		}
	
	//series	
		if (fieldTitle == "Series" | fieldTitle == "Collection") {
			fieldTitle = "Series";
			dataTags[fieldTitle] = (contents.replace(/\s\s\s*/g, ''));
		}
			
	//makes tags	
		for (i = 0; i < tagsContent.length; i++) {
			if (tagsContent[i] != ("") && tagsContent[i] !=(" ")) {							
				newItem.tags[i] = tagsContent[i];
			} 
	     	}
			
	associateData (newItem, dataTags, "Description", descriptionField);
			
	associateData (newItem, dataTags, "Title", "title");
	associateData (newItem, dataTags, "Place", "place");
	associateData (newItem, dataTags, "Publish", "publisher");
	associateData (newItem, dataTags, "Date", "date");
	associateData (newItem, dataTags, "Source", "extra");
	associateData (newItem, dataTags, "ISBN", "ISBN");
	associateData (newItem, dataTags, "Localinf.", "rights");
	associateData (newItem, dataTags, "Series", "series");
	associateData (newItem, dataTags, "Notes", "abstractNote");
	associateData (newItem, dataTags, "Numbering", "reportNumber");
	
	associateData (newItem, dataTags, "Titre", "title");
	associateData (newItem, dataTags, "Numérotation", "reportNumber");
	
	}
	
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
		var next_title = new Array();
		var links1 = new Array();
		var y = 0;
		var next_title1 = new Array();
		
		var titlesCount = doc.evaluate('count (//p/table/tbody/tr/td/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var numAndTitle= doc.evaluate('//p/table/tbody/tr/td/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate('//p/table/tbody/tr/td/a[img]', doc, nsResolver, XPathResult.ANY_TYPE, null);		
		var multipleTest = 0;
		
		for (j=0; j < titlesCount.numberValue; j++) {
			
			next_title[j] = numAndTitle.iterateNext().textContent;
			next_title[j] = next_title[j].substr(0, next_title[j].length-1);
		
			if (/^\d*$/.test(next_title[j])) {
				multipleTest = 0;
			} else if (multipleTest < 1) {
				multipleTest++;
				next_title1[y] = next_title[j];
			 	y++;
			 	Zotero.debug(next_title1[0]);
				
			} else if (multipleTest > 1) {
				multipleTest = 0;
			}
		}
		
		for (j = 0; j < 10; j++) {
				links1[j] = links.iterateNext().href;
				//Zotero.debug(links1[0]);
				items[links1] = next_title1[j];
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