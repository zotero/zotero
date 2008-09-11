{
	"translatorID":"1b9ed730-69c7-40b0-8a06-517a89a3a278",
	"translatorType":4,
	"label":"Sudoc",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"^http://www\\.sudoc\\.abes\\.fr",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-19 17:30:00"
}

function detectWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;

		var xpath = '//table/tbody/tr/td[1][@class="preslabel"]/strong';
		var multxpath = '//a[@id="InitialFocusPoint"]';
		var elt;

		if (elt = doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				return "multiple";
		}
		else if (elt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) 
		{
				var contenu = elt.textContent;
				var numRegexp = /(Num.ro.de.notice|Record.number)/;
				var m = numRegexp.exec(contenu);
				if (m) {
						// On a bien une notice d"ouvrage, on doit chercher limage 
						// pour choisir le type de document
						var imgXpath = '/html/body/table/tbody/tr/td[1]/p/img/@src';
						var imgsrc = doc.evaluate(imgXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
						if (imgsrc){
								if (imgsrc.indexOf("icon_per.gif") > 0){
										return "book";
								} else if (imgsrc.indexOf("icon_books.gif") > 0){
										return "book";
								} else if (imgsrc.indexOf("icon_thesis.gif") > 0){
										return "thesis";
								} else if (imgsrc.indexOf("icon_art.gif") > 0){
										return "journalArticle";
								} else {
										return "book";
								}
						} 
				}
		}
}

function scrape(doc) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;

		var rowXpath = '//tr[td[@class="preslabel"]]';
		var tableRows = doc.evaluate(rowXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;

		var newItem = new Zotero.Item();
		// TODO add other item types using detectWeb's icon checking code
		newItem.itemType = "book";
		var imgXpath = '/html/body/table/tbody/tr/td[1]/p/img/@src';
		var imgsrc = doc.evaluate(imgXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if (imgsrc){
				if (imgsrc.indexOf("icon_per.gif") > 0){
						newItem.itemType = "book";
				} else if (imgsrc.indexOf("icon_books.gif") > 0){
						newItem.itemType = "book";
				} else if (imgsrc.indexOf("icon_thesis.gif") > 0){
						newItem.itemType = "thesis";
				} else if (imgsrc.indexOf("icon_art.gif") > 0){
						newItem.itemType = "journalArticle";
				} else {
						newItem.itemType = "book";
				}
		} else {
				newItem.itemType = "book";
		}
		while (tableRow = tableRows.iterateNext())
		{
				var field = doc.evaluate('./td[1]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				var value = doc.evaluate('./td[2]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				field = Zotero.Utilities.superCleanString(field);
				field = field.replace(/(\(s\))?\s*:\s*$/, "");
				if (field == "Titre" || field == "Title"){
						Zotero.debug("title = " + value);
						value = value.replace(/(\[[^\]]+\])/g,"");
						newItem.title = value.split(" / ")[0];
				}
				if (field.substr(0,6) == "Auteur" || field.substr(0,6) == "Author"){
						var authors = doc.evaluate('./td[2]/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
						var author;
						while (author = authors.iterateNext()){
								var authorText = author.textContent;
								var authorParts = authorText.split(" ("); 
								newItem.creators.push(Zotero.Utilities.cleanAuthor(authorParts[0], "author", true));
						}
				}
				if (field.substr(0,4) == "Date"){
						newItem.date = value;
				}
				if (field.substr(0,7)  == "Editeur" || field.substr(0,9)  == "Publisher"){
						var pubParts = value.split(" : ");
						newItem.place = pubParts[0];
						// needs error checking below to avoid error
						if (pubParts[1] ) {
								pubParts = pubParts[1].split(", ");
								newItem.publisher = pubParts[0];
						}
				}
				if (field.substr(0,4) == "ISBN" || field.substr(0,4) == "ISSN"){
						newItem.ISBN = value.split(" (")[0];
				}
				if (field == "Description") {
						var m = value.match(/([0-9]+) (?:[pP])/);
						if (m) {
								newItem.pages = m[1];
						}
				}
				if (field.substr(0,5) == "Serie" || field.substr(0,10) == "Collection"){
						newItem.series = value;
				}
				if (field.substr(0,6) == "Sujets" || field.substr(0,8) == "Subjects"){
						var subjectElmts = doc.evaluate('./td[2]/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
						var subject;
						var subjects;
						while (subject = subjectElmts.iterateNext()){
								subjects = subject.textContent.split(" -- ");
								newItem.tags = newItem.tags.concat(subjects);
						}
				}
				if (field == "In" || field == "Dans"){
						var jtitle = value.replace(/(\[[^\]]+\])/g,"");
						jtitle = jtitle.split(" / ")[0];
						jtitle = jtitle.split(" - ")[0];
						newItem.publicationTitle = jtitle;
						//get page numbers
						var m = value.match(/(?:[Pp]\. )([0-9\-]+)/);
						if (m) {
								newItem.pages = m[1];
						}
						//get ISBN or ISSN
						m = value.match(/(?:ISSN|ISBN) ([0-9Xx\-]+)/);
						if (m) {
								newItem.ISBN = m[1];
								newItem.ISSN = m[1];
						}
						// publicationTitle, issue/volume
				}
				// TODO Pages, Notes, Description, Language, Annexes
		}
		newItem.complete();
}

function doWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;

		var multxpath = '//a[@id="InitialFocusPoint"]';
		var elt;

		if (elt = doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var newUrl = doc.evaluate('//base/@href', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
				var xpath = '//tr/td[3]/a';
				var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var elmt = elmts.iterateNext();
				var links = new Array();
				var availableItems = new Array();
				var i = 0;
				do {
						var link = doc.evaluate('./@href', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
						var searchTitle = elmt.textContent;
						availableItems[i] = searchTitle;
						links[i] = link;
						i++;
				} while (elmt = elmts.iterateNext());
				var items = Zotero.selectItems(availableItems);

				if(!items) {
						return true;
				}
				var uris = new Array();
				for(var i in items) {
						uris.push(newUrl + links[i]);
				}
				Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
						function() { Zotero.done(); }, null);
				Zotero.wait();
		}
		else {
				scrape(doc);
		}
}