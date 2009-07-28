{
	"translatorID":"99be9976-2ff9-40df-96e8-82edfa79d9f3",
	"translatorType":4,
	"label":"Defense Technical Information Center",
	"creator":"Matt Burton",
	"target":"http://oai\\.dtic\\.mil/oai/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-07-28 18:10:00"
}

function detectWeb(doc, url) {
	if(doc.title.indexOf("DTIC OAI Index for") != -1) {
		return "multiple";
	} else if (url.indexOf("verb=getRecord") != -1){
		return "report";
	}
}

function doWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newURIs = new Array();
	
	if(detectWeb(doc,url) == "multiple"){
		var links = doc.evaluate("//a/@href", doc, nsResolver, XPathResult.Abstract, null);
		var titles = doc.evaluate("//a/preceding::text()[1]", doc, nsResolver, XPathResult.Abstract, null);
		var items = new Object();
		var link, title;
		while( link = links.iterateNext(), title = titles.iterateNext()){
			items[link.textContent.replace(/&metadataPrefix=html/, "&metadataPrefix=oai_dc")] = title.textContent;
		}
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		for (url in items) {
			newURIs.push(url);
			Zotero.debug(url);
		}
	} else {
		newURIs.push(url.replace(/&metadataPrefix=html/, "&metadataPrefix=oai_dc"))
	}
	
	// ripped the arXiv.org code, hence the funny var names.
	Zotero.Utilities.HTTP.doGet(newURIs, function(text) {
		var newItem = new Zotero.Item("report");
		//	remove header
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		//	fix non-compliant XML tags (colons)
		text = text.replace(/<dc:/g, "<dc_").replace(/<\/dc:/g, "</dc_");
		text = text.replace(/<oai_dc:dc/g, "<oai_dc_dc").replace(/<\/oai_dc:dc/g, "</oai_dc_dc");
		text = text.replace(/<OAI-PMH[^>]*>/, "").replace(/<\/OAI-PMH[^>]*>/, "");
		text = "<zotero>" + text + "</zotero>";
		var xml = new XML(text);
		var title;
		var citation = xml.GetRecord.record.metadata.oai_dc_dc;
		var test = xml..responseDate.text().toString();

		if (citation.dc_title.length()){
			title = Zotero.Utilities.trimInternal(citation.dc_title.text().toString());
			newItem.title = title;
		}
		Zotero.debug("article title: " + title);
		var type = "";
		if(citation.dc_creator.length()) {
		var authors = citation.dc_creator;
			for(var j=0; j<authors.length(); j++) {
				Zotero.debug("author: " + authors[j]);
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
			}
		}
		if (citation.dc_date.length()) {
			var dates = citation.dc_date;
			newItem.date = Zotero.Utilities.cleanString(dates[0].text().toString());
		}
		if (citation.dc_description.length()) {
			var descriptions = citation.dc_description;
			for (var j=0; j<descriptions.length(); j++) {
				var noteStr = Zotero.Utilities.cleanString(descriptions[j].text().toString());
				newItem.notes.push({note:noteStr});
			}
		}
		if (citation.dc_subject.length()) {
			var subjects = citation.dc_subject;
			for (var j=0; j<subjects.length(); j++) { 
				var subjectValue = Zotero.Utilities.cleanString(subjects[j].text().toString());
				newItem.tags.push(subjectValue);
			}
		}
		if (citation.dc_identifier.length()) {
			var identifiers = citation.dc_identifier;
			for (var j=0; j<identifiers.length(); j++) {
				var identifier = Zotero.Utilities.cleanString(identifiers[j].text().toString());
				if (identifier.substr(0, 4) == "doi:") {
					newItem.DOI = identifier;
				}
				else if (identifier.substr(0, 7) == "http://") {
					newItem.url = identifier;
				}
				else {
					newItem.extra = identifier;
				}
			}
		}
		var articleID = "";
		if (xml.GetRecord.record.header.identifier.length()) {
			articleID = xml.GetRecord.record.header.identifier.text().toString();
			articleID = articleID.substr(14);
			newItem.publicationTitle = articleID;
		}
//		TODO add "arXiv.org" to bib data?
		newItem.attachments.push({url:newItem.url, title:"DTIC Snapshot", mimeType:"text/html"});
		if (newItem.notes[0]['note']) {
			newItem.abstractNote = newItem.notes[0]['note'];
			newItem.notes = new Array();
		}
		newItem.complete();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}