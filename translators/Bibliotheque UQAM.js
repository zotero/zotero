{
	"translatorID":"39ea814e-8fdb-486c-a88d-59479f341066",
	"translatorType":4,
	"label":"Bibliotheque UQAM",
	"creator":"Adam Crymble",
	"target":"http://www.manitou.uqam.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-24 05:15:00"
}

function detectWeb(doc, url) {
	
	if (doc.evaluate('//center/table/tbody/tr[1]/td/input', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.match("détails")) {
		return "book";
	}
}

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("book");
	
	var dataTags = new Object();
	var tagsContent = new Array();
	var contents;
	var newItemAuthors1 = new Array();
	var newItemAuthors2 = new Array();
	
	var xPathHeadings = doc.evaluate('//p/table/tbody/tr/td[1]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathContents = doc.evaluate('//p/table/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//p/table/tbody/tr/td[1]/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);

	var dump = xPathHeadings.iterateNext();
		
	for (i=0; i<xPathCount.numberValue-1; i++) {
     					
     		fieldTitle=xPathHeadings.iterateNext().textContent.replace(/\s+/g, '');
     		contents = xPathContents.iterateNext().textContent;
	
		if (fieldTitle == "Titres:") {
			fieldTitle = "Titre:";
		}
	
	//determines media type
		if (fieldTitle == "Titre:") {
			
			dataTags[fieldTitle] = contents.replace(/^\s*|\s*$/g, '');
			
			if (contents.match("enregistrement sonore")) {
				var newItem = new Zotero.Item("audioRecording");	
			} else if (contents.match("musique")) {
				var newItem = new Zotero.Item("audioRecording");
			} else if (contents.match("enregistrement vidéo")) {
				var newItem = new Zotero.Item("videoRecording");
			} else {
				var newItem = new Zotero.Item("book");
			}
		}
	
	//gets author(s).
		if (fieldTitle == "Auteur:") {
			fieldTitle = "author";
			
			dataTags[fieldTitle] = contents;
	     		if (dataTags[fieldTitle].match(",")) {
		     		var authorName = dataTags["author"].split(",");
	     			authorName[0] = authorName[0].replace(/^\s*|\s*$/g, '');
	     			dataTags["author"] = (authorName[1] + (" ") + authorName[0]);
	     		} else {
		     		var parenthesis = dataTags["author"].indexOf("(");
			     	if (parenthesis > 0) {
				     	dataTags["author"] = dataTags["author"].substr(0, parenthesis);
		     		}
		     		dataTags["author"] = dataTags["author"].replace(/^\s*|\s*$/g, '');
	     		}
	
	     	} else if (fieldTitle == "Auteurs:") {
		     	
		     	dataTags[fieldTitle] = contents;
		  
		     	var multiAuthors = dataTags["Auteurs:"].split(/\n/);
		     	for (var j = 0; j < multiAuthors.length; j++) {
			     	var parenthesis = multiAuthors[j].indexOf("(");
			     
			     	if (parenthesis > 0) {
				     	multiAuthors[j] = multiAuthors[j].substr(0, parenthesis);
			     	}
			     	
			     	if (multiAuthors[j] != "" && multiAuthors[j] != ' ') {
				  	if (multiAuthors[j].match(", ")) {
					  	var authorName = multiAuthors[j].split(","); 	
				     		newItemAuthors1.push(authorName[1] + (" ") + authorName[0]);
				  	} else {
					  	newItemAuthors2.push(multiAuthors[j]);
				  	}
			     	}   	
		     	}
	     		
		} else if (fieldTitle == "Éditeur:") {
			dataTags[fieldTitle] = contents;
			var imprintSplit = dataTags["Éditeur:"].split(": ");
			if (imprintSplit.length > 1) {
				newItem.place = imprintSplit[0].replace(/^\s*|\s*$/g, '');
				var publisherDate = imprintSplit[1].split(", ");
				
				newItem.publisher = publisherDate[0].replace(/^\s*|\s*$/g, '');
				
				if (publisherDate.length > 1) {
					
					newItem.date = publisherDate[1].replace(/^\s*|\s*$/g, '');
				}
			} else {
				newItem.publisher = dataTags["Éditeur:"];
			}
						
		} else if (fieldTitle == "Sujet:") {
			dataTags[fieldTitle] = contents;
			
			if (dataTags["Sujet:"].match("\n")) {
				
				tagsContent = (dataTags["Sujet:"].split(/\n/));
				
			}		
			
		 } else {
	
			dataTags[fieldTitle] = contents.replace(/^\s*|\s*$/g, '');
		}	
	}

//pushes tags

	for (var y = 0; y < tagsContent.length; y++) {
		if (tagsContent[y]!='' && tagsContent[y]!= " ") {
			var parenthesis = tagsContent[y].indexOf("(");
		     	if (parenthesis > 0) {
			     	tagsContent[y] = tagsContent[y].substr(0, parenthesis);
			}		
			newItem.tags[y] = tagsContent[y];
		}
	}	

//because newItem is not defined until after the authors have, authors must be put into Zotero outside the main for loop.
	if (dataTags["author"]) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["author"], "author"));
	}
		
	for (var i = 0; i < newItemAuthors1.length; i++) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(newItemAuthors1[i], "author"));	
	}
	
	for (var i = 0; i < newItemAuthors2.length; i++) {
		newItem.creators.push({lastName: newItemAuthors2[i], creatorType: "creator"}); 
	}
	
//trims title as best as possible
	if (dataTags["Titre:"].match(/\[/)) {	
		var splitter = dataTags["Titre:"].indexOf("[");
	}
	
	if (dataTags["Titre:"].match("/")) {
		var splitter1 = dataTags["Titre:"].indexOf("/");
	}
	
	if (splitter1 > -1 && splitter > -1) {
		if (splitter1 > splitter) {
			dataTags["Titre:"] = dataTags["Titre:"].substr(0, splitter);
		} else {
			dataTags["Titre:"] = dataTags["Titre:"].substr(0, splitter1);
		}
	} else if (splitter1 > -1) {
		dataTags["Titre:"] = dataTags["Titre:"].substr(0, splitter1);
	} else if (splitter > -1) {
		dataTags["Titre:"] = dataTags["Titre:"].substr(0, splitter);
	}
	
	associateData (newItem, dataTags, "Titre:", "title");
	associateData (newItem, dataTags, "Numéro:", "ISBN");
	associateData (newItem, dataTags, "Description:", "pages");
	associateData (newItem, dataTags, "Banque:", "repository");
	associateData (newItem, dataTags, "Langue:", "language");
	associateData (newItem, dataTags, "Localisation:", "Loc. in Archive");
	
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
		var titles = doc.evaluate('/html/body/table/tbody/tr/td/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		for (var i = 0; i < 4; i++) {
			var dump = titles.iterateNext();
		}
		
		var next_title;

		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
			Zotero.debug(next_title.href);
			Zotero.debug(next_title.textContent);
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