{
	"translatorID":"5e684d82-73a3-9a34-095f-19b112d77bbe",
	"label":"Digital Medievalist",
	"creator":"Fred Gibbs",
	"target":"digitalmedievalist\\.org\/(index\\.html)?($|journal\/?$|(journal\/[3-9]))",
	"minVersion":"2.0b7",
	"maxVersion":"",
	"priority":100,
	"inRepository":"1",
	"translatorType":4,
	"lastUpdated":"2010-09-25 10:20:00"
}


function detectWeb(doc, url) {

	if(doc.title == "Digital Medievalist: Journal" || doc.title == "Digital Medievalist") {
		return "multiple";
	} else {
		return "article";
	}
}


function doWeb(doc, url) {
	var links =[];
	var articles = [];
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
	
	// if on single article
	if (detectWeb(doc, url) == "article") {

		// insert 'xml' into URI for location of XML file.
		var uri = doc.location.href;
		var xmlUri = uri.replace("journal","journal/xml");
		
		var d = Zotero.Utilities.retrieveSource(xmlUri);
		parseXML(d, uri, doc);
	}

	// if multiple, collect article titles 
	else if (doc.evaluate('//div[@class="issue"]/div/ul/li/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {

		var titles = doc.evaluate('//div[@class="issue"]/div/ul/li/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		 
		while (title = titles.iterateNext()) { 
			links[title.href] = Zotero.Utilities.trimInternal(title.textContent);
		}

		var items = Zotero.selectItems(links);
		for (var i in items) {
			articles.push(i);
		}

		Zotero.Utilities.processDocuments(articles, doWeb, function() {Zotero.done();});
		Zotero.wait();	
	}
}

	
function parseXML(text, itemUrlBase, doc) {
	// Remove xml parse instruction and doctype
	text = text.replace(/<\?oxygen[^>]*\?>/, "").replace(/<\?xml[^>]*\?>/, "").replace(/<TEI[^>]*>/, "<TEI>");
	var xml = new XML(text);
	
	var newItem = new Zotero.Item("journalArticle");
	
	var fullTitle = '';
	var title = xml..titleStmt.title;
	var len = title.children().length();
	for (i=0; i < len; i++) { 
		fullTitle += title.children()[i]; 
	}
	
	// modify title if review article
	if (xml..textClass.keywords.term.(@type == "DMType").text() == "Review") {
		fullTitle = "Review of " + fullTitle;
	}
	
	newItem.title = Zotero.Utilities.trimInternal(fullTitle);
	
	var authors = xml..titleStmt.author.name;
	for (var i in authors) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i].toString(), "author"));
	}
	
	newItem.publicationTitle = "Digital Medievalist";
	newItem.volume = xml..seriesStmt.idno.(@type == "volume").toString();
	newItem.issue = xml..seriesStmt.idno.(@type == "issue").toString();
	newItem.date = xml..seriesStmt.idno.(@type == "date").toString();
	newItem.url = itemUrlBase;

	// save keywords
	kwords = xml..textClass.keywords.term.(@type == "keyword");
	for (var i = 0; i < kwords.length(); i++) {
		Zotero.debug(kwords[i].text());
		newItem.tags[i] = kwords[i];
	} 

	//newItem.abstractNote = Zotero.Utilities.cleanString(xml..text.front.argument.(@n == "abstract").p.text().toString());
	newItem.attachments.push({document:doc, title:doc.title});
	
	newItem.complete();
}
