{
	"translatorID":"661fc39a-2500-4710-8285-2d67ddc00a69",
	"translatorType":4,
	"label":"Artefacts Canada",
	"creator":"Adam Crymble",
	"target":"http://daryl.chin.gc.ca",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:55:00"
}

function detectWeb(doc, url) {
	var multi1 = '';
	var single1 = '';
	
	if (doc.evaluate('//div[@id="mainContent"]/table/tbody/tr/td[1]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		multi1 = doc.evaluate('//div[@id="mainContent"]/table/tbody/tr/td[1]/h1', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	var xpath = '//tbody/tr[1]/td[2]/span';
	if (doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		single1 = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	if (multi1.match("Search Results") || multi1.match("Résultats de recherche")) {
		return "multiple";
	} else if (single1.match("Document") || single1.match("Enregistrement")) {
		return "artwork";
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
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	var tagsContent = new Array();
	var fieldTitle;
	
	var newItem = new Zotero.Item("artwork");

	var headers = doc.evaluate('//td[1][@class="leftResTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//td[2][@class="pageText"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	while (fieldTitle = headers.iterateNext()) {
		fieldTitle = fieldTitle.textContent.replace(/\s+/g, '');
		if (fieldTitle == "Titre:") {
			fieldTitle = "Title:";
		} else if (fieldTitle == "Nomdel'objet:") {
			fieldTitle = "NameofObject:";
		} else if (fieldTitle == "Sujetouimage:") {
			fieldTitle = "Subject/Image:";
		} else if (fieldTitle == "Numérod'accession:") {
			fieldTitle = "AccessionNumber:";
		} else if (fieldTitle == "Artisteouartisan:") {
			fieldTitle = "Artist/Maker:";
		} else if (fieldTitle == "Fabricant:") {
			fieldTitle = "Manufacturer:";
		}
		
		dataTags[fieldTitle] = contents.iterateNext().textContent.replace(/^\s*|\s*$/g, '')
	}

	Zotero.debug(dataTags);

	if (dataTags["Artist/Maker:"]) {
		if (dataTags["Artist/Maker:"].match(", ")) {
			var authors = dataTags["Artist/Maker:"].split(", ");
			authors = authors[0] + ' ' + authors[1];
			newItem.creators.push(authors, "creator");	
		} else {
			newItem.creators.push(dataTags["Artist/Make:"], "creator");	
		}
	}
	
	if (dataTags["Manufacturer:"]) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Manufacturer:"], "creator"));	
	}
	
	if (dataTags["AccessionNumber:"]) {
		newItem.locInArchive = "Accession Number: " + dataTags["AccessionNumber:"];
	}
	
	if (dataTags["Subject/Image:"]) {
		if (dataTags["Subject/Image:"].match(/\n/)) {
			var subjects = dataTags["Subject/Image:"].split(/\n/);
			for (var i = 0; i < subjects.length; i++) {
				newItem.tags[i] = subjects[i];
			}
		} else {
			newItem.tags[0] = dataTags["Subject/Image:"].match(/\n/);
		}
	}
	
	if (dataTags["Title:"]) {
		associateData (newItem, dataTags, "Title:", "title");
		associateData (newItem, dataTags, "NameofObject:", "medium");
	} else if (dataTags["NameofObject:"]) {
		associateData (newItem, dataTags, "NameofObject:", "title");
	} else {
		newItem.title = "No Title Found";
	}
	
	associateData (newItem, dataTags, "LatestProductionDate:", "date");
	associateData (newItem, dataTags, "Datedefindeproduction:", "date");
	
	associateData (newItem, dataTags, "Institution:", "repository");
	associateData (newItem, dataTags, "Établissement:", "repository");
	
	associateData (newItem, dataTags, "Description:", "description");
	
	associateData (newItem, dataTags, "Medium:", "medium");
	associateData (newItem, dataTags, "Médium:", "medium");
	
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
		
		var titles = doc.evaluate('//tr[1]/td[2][@class="pageText"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate('//td/a[@class="moreInfoink"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var next_title;
		while (next_title = titles.iterateNext()) {
		
			items[links.iterateNext().href] = next_title.textContent;
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
