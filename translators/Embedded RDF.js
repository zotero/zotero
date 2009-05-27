{
	"translatorID":"951c027d-74ac-47d4-a107-9c3069ab7b48",
	"translatorType":4,
	"label":"Embedded RDF",
	"creator":"Simon Kornblith",
	"target":null,
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":400,
	"inRepository":true,
	"lastUpdated":"2008-03-14 18:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("reprint") != -1) return false;
	var metaTags = doc.getElementsByTagName("meta");
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		if(tag && tag.substr(0, 3).toLowerCase() == "dc.") {
			return "webpage";
		}
	}
	
	return false;
}

function doWeb(doc, url) {
	var dc = "http://purl.org/dc/elements/1.1/";

	// load RDF translator, so that we don't need to replicate import code
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("5e3ad958-ac79-463d-812b-a86a9235c28f");
	translator.setHandler("itemDone", function(obj, newItem) {
		// add attachment
		newItem.attachments.push({document:doc});
		// add access date and url
		newItem.accessDate = 'CURRENT_TIMESTAMP';
		newItem.url = doc.location.href;
		newItem.repository = false;
		newItem.complete();
	});
	var rdf = translator.getTranslatorObject();
	
	var metaTags = doc.getElementsByTagName("meta");
	var foundTitle = false;		// We can use the page title if necessary
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		if(tag && value && tag.substr(0, 3).toLowerCase() == "dc.") {
			if(tag == "dc.title") {
				foundTitle = true;
			}
			rdf.Zotero.RDF.addStatement(url, dc + tag.substr(3).toLowerCase(), value, true);
		} else if(tag && value && (tag == "author" || tag == "author-personal")) {
			rdf.Zotero.RDF.addStatement(url, dc + "creator", value, true);
		} else if(tag && value && tag == "author-corporate") {
			rdf.Zotero.RDF.addStatement(url, dc + "creator", value, true);
		}
	}
	
	if (!foundTitle) {
		rdf.Zotero.RDF.addStatement(url, dc + "title", doc.title, true);
	}
	rdf.defaultUnknownType = "webpage";
	rdf.doImport();
}