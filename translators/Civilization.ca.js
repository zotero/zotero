{
	"translatorID":"8451431a-895f-4732-8339-79eb6756d2f9",
	"translatorType":4,
	"label":"Civilization.ca",
	"creator":"Adam Crymble",
	"target":"http://collections.civilization.ca",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//tr/td[2]/a/font', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.location.href.match("Display.php")) {
		return "artwork";
	}
}

//Civilization.ca translator. Code by Adam Crymble.

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
	
	var headers = doc.evaluate('//table[2]/tbody/tr/td[1]/span[@class="textb"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var contents = doc.evaluate('//tr[2]/td/table[2]/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//table[2]/tbody/tr/td[1]/span[@class="textb"]/b)', doc, nsResolver, XPathResult.ANY_TYPE, null);

	newItem.title = contents.iterateNext().textContent.replace(/^\s*|\s+$/g, '');
	var dump = contents.iterateNext();

	for (i=0; i<xPathCount.numberValue; i++) {	 	
     			
     		fieldTitle = headers.iterateNext().textContent.replace(/\s+/g, '');
     		if (fieldTitle == "Artist/Maker/Manufacturer") {
	     		fieldTitle = "	Artiste/Artisan/Fabricant";
     		} else if (fieldTitle == "Autreaffiliationculturelle") {
	     		fieldTitle = "OtherCulturalAffiliation";
     		}
     		
     		 dataTags[fieldTitle] = Zotero.Utilities.cleanTags(contents.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
     	}

	if (dataTags["Artist/Maker/Manufacturer"]) {
		var author = dataTags["Artist/Maker/Manufacturer"];
		if (author.match(" and ")) {
			var authors = author.split(" and ");
			for (var i in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));	
			}
		} else {
			newItem.creators.push({lastName: author, creatorType: "creator"});				
		}
	}

	if (dataTags["OtherCulturalAffiliation"]) {
		tagsContent = dataTags["OtherCulturalAffiliation"].split(/\n/);

		for (var i = 0; i < tagsContent.length; i++) {
		     		newItem.tags[i] = tagsContent[i];
	     	}
	}
	
	if (dataTags["Collection"]) {
		newItem.extra = "Collection: " + dataTags['Collection'];
	}
	
	associateData (newItem, dataTags, "ArtifactNumber", "callNumber");
	associateData (newItem, dataTags, "Museum", "repository");
	associateData (newItem, dataTags, "Measurements", "artworkSize");
	associateData (newItem, dataTags, "BeginDate", "date");
	associateData (newItem, dataTags, "EndDate", "date");
	associateData (newItem, dataTags, "AdditionalInformation", "abstractNote");
	
	associateData (newItem, dataTags, "Numérod'artefact", "callNumber");
	associateData (newItem, dataTags, "Musée", "repository");
	associateData (newItem, dataTags, "Mesures", "artworkSize");
	associateData (newItem, dataTags, "Datededébut", "date");
	associateData (newItem, dataTags, "Datedefin", "date");
	associateData (newItem, dataTags, "Informationsupplémentaire", "abstractNote");
	
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
	
		var titles = doc.evaluate('//tr/td[2]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		var next_title;
		while (next_title = titles.iterateNext()) {
			if (next_title.textContent.match(/\w/)) {
				items[next_title.href] = next_title.textContent;
			}
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