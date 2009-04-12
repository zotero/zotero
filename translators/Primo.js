{
	"translatorID":"1300cd65-d23a-4bbf-93e5-a3c9e00d1066",
	"translatorType":4,
	"label":"Primo",
	"creator":"Matt Burton",
	"target":"/primo_library/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-03-19 17:15:00"
}


function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		if (doc.evaluate('//span[contains(., "Results")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			 return 'multiple';
		} else if (doc.evaluate('//div/h2[contains(., "Details")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			return 'document';
		}
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	var links = new Array();
	
	if (detectWeb(doc,url) == 'multiple') {
		
		var items = new Object();
		var linkIterator = doc.evaluate('//div[contains(@class, "title")]/a/@href', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titleIterator = doc.evaluate('//div[contains(@class, "title")]/a/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		// try/catch for the case when there are no search results, let doc.evealuate fail quietly
		try {
			while (link = linkIterator.iterateNext(), title = titleIterator.iterateNext()) {
				// create an array containing the links and add '&showPnx=true' to the end
			 	var xmlLink = Zotero.Utilities.trimInternal(link.textContent)+'&showPnx=true';
				var title = Zotero.Utilities.trimInternal(title.textContent);
				items[xmlLink] = title;
			}
			items = Zotero.selectItems(items);
			for(var link in items) {
				links.push(link);
			}
		} catch(e) {
			Zotero.debug("Search results contained zero items. "+e);
			return;
		}

		
	} else {
		links.push(url+'&showPnx=true');
	}
	
	Zotero.Utilities.HTTP.doGet(links, function(text) {
	
		text = text.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, ""); //because E4X is full of FAIL
		var xmldoc = new XML(text);
		
		if (xmldoc.display.type.toString() == 'book') {
			var item = new Zotero.Item("book");
		} else if (xmldoc.display.type.toString() == 'audio') {
			var item = new Zotero.Item("audioRecording");
		} else if (xmldoc.display.type.toString() == 'video') {
			var item = new Zotero.Item("videoRecording");
		} else {
			var item = new Zotero.Item("document");
		}
		item.title = xmldoc.display.title.toString();
		
		var creators = xmldoc.display.creator.toString().replace(/\d{4}-(\d{4})?/, '').split("; ");
		var contributors = xmldoc.display.contributor.toString().replace(/\d{4}-(\d{4})?/, '').split("; ");
		
		if (!creators[0]) { // <contributor> not available using <contributor> as author instead
			creators = contributors;
			contributors = null;
		}
		for (creator in creators) {
			if (creators[creator]) {
				item.creators.push(Zotero.Utilities.cleanAuthor(creators[creator], "author"));
			}
		}
		
		for (contributor in contributors) {
			if (contributors[contributor]) {
				item.creators.push(Zotero.Utilities.cleanAuthor(contributors[contributor], "contributor"));
			}
		}
		
		var pubplace = xmldoc.display.publisher.toString().split(" : ");
		if (pubplace) {
			item.place = pubplace[0];
			item.publisher = pubplace[1];
		}
		
		var date = xmldoc.display.creationdate.toString();
		if (date) item.date = date.match(/\d+/)[0];
		
		var language = xmldoc.display.language.toString();
		if (language) item.language = language;
		
		var pages = xmldoc.display.format.toString().match(/(\d+)\sp\./);
		if (pages) item.pages = pages[1];
		
		var isbn = xmldoc.display.identifier.toString().match(/\$\$CISBN\$\$V([A-Za-z0-9]+)\s/);
		if (isbn) item.ISBN = isbn[1];
		
		var edition = xmldoc.display.edition.toString();
		if (edition) item.edition = edition;
		
		for each (subject in xmldoc.search.subject) {
			item.tags.push(subject.toString());
		}
		// does callNumber get stored anywhere else in the xml?
		item.callNumber = xmldoc.enrichment.classificationlcc[0];
		
		item.complete();
		
	}, function() {Zotero.done();});
	Zotero.wait();

}