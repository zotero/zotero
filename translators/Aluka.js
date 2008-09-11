{
	"translatorID":"e8fc7ebc-b63d-4eb3-a16c-91da232f7220",
	"translatorType":4,
	"label":"Aluka",
	"creator":"Sean Takats",
	"target":"https?://(?:www\\.)aluka.org/action/(?:showMetadata\\?doi=[^&]+|doSearch\\?|doBrowseResults\\?)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-12 10:00:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
		
	var xpath = '//a[@class="title"]';

	if (url.match(/showMetadata\?doi=[^&]+/)){
		return "document";
	} else if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

// Aluka types we can import
// TODO: Improve support for other Aluka item types?
// Correspondence, Circulars, Newsletters, Interviews, Pamphlets, Policy Documents, Posters, Press Releases, Reports, Testimonies, Transcripts
var typeMap = {
	"Books":"book",
	"Aluka Essays":"report",
	"photograph":"artwork",
	"Photographs":"artwork",
	"Panoramas":"artwork",
	"Journals (Periodicals)":"journalArticle",
	"Articles":"journalArticle",
	"Correspondence":"letter",
	"Interviews":"interview",
	"Reports":"report"
}

function doWeb(doc, url){
	var urlString = "http://www.aluka.org/action/showPrimeXML?doi=" ;
	var uris = new Array();
	var m = url.match(/showMetadata\?doi=([^&]+)/);
	if (m) { //single page
		uris.push(urlString+ m[1]);
	} else { //search results page
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
			
		var xpath = '//a[@class="title"]';
		var items = new Object();
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		while (elmt = elmts.iterateNext()) {
			var title = elmt.textContent;
			var link = elmt.href;
			var m = link.match(/showMetadata\?doi=([^&]+)/);
			if (title && m){
				items[m[1]] = title;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			uris.push(urlString + i);
		}
	}
	// http://www.aluka.org/action/showPrimeXML?doi=10.5555/AL.SFF.DOCUMENT.cbp1008

	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		text = text.replace(/<\?xml[^>]*\?>/, ""); // strip xml header
		text = text.replace(/(<[^>\.]*)\.([^>]*>)/g, "$1_$2");	// replace dots in tags with underscores
		var xml = new XML(text);
		var metadata = xml..MetadataDC;
		var itemType = "Unknown";
		if (metadata.length()){
			itemType = "document";
			if (metadata[0].Type.length()){
				var value = metadata[0].Type[0].text().toString();
				if(typeMap[value]) {
					itemType = typeMap[value];
				} else {
					Zotero.debug("Unmapped Aluka Type: " + value);
				}		
			}
			var newItem = new Zotero.Item(itemType);
			var title = "";
			if (metadata[0].Title.length()){
				var title = Zotero.Utilities.trimInternal(metadata[0].Title[0].text().toString());
				if (title == ""){
					title = " ";
				}
				newItem.title = title;
			}
			if (metadata[0].Title_Alternative.length()){
				newItem.extra = Zotero.Utilities.trimInternal(metadata[0].Title_Alternative[0].text().toString());
			}
			for(var i=0; i<metadata[0].Subject_Enriched.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Subject_Enriched[i].text().toString()));
			}
			for(var i=0; i<metadata[0].Coverage_Spatial.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Coverage_Spatial[i].text().toString()));
			}
			for(var i=0; i<metadata[0].Coverage_Temporal.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Coverage_Temporal[i].text().toString()));
			}
//	TODO: decide whether to uncomment below code to import species data as tags
//			for(var i=0; i<xml..TopicName.length(); i++) {
//				newItem.tags.push(Zotero.Utilities.trimInternal(xml..TopicName[i].text().toString()));
//			}

			if (metadata[0].Date.length()){
				var date = metadata[0].Date[0].text().toString();
				if (date.match(/^\d{8}$/)){
					date = date.substr(0, 4) + "-" + date.substr(4, 2) + "-" + date.substr(6, 2);
				}
				newItem.date = date;
			}
			if (metadata[0].Creator.length()){
				var authors = metadata[0].Creator;
				var type = "author";
				for(var j=0; j<authors.length(); j++) {
					Zotero.debug("author: " + authors[j]);
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
				}
			}
			if (metadata[0].Contributor.length()){
				var authors = metadata[0].Contributor;
				var type = "contributor";
				for(var j=0; j<authors.length(); j++) {
					Zotero.debug("author: " + authors[j]);
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
				}
			}
			if (metadata[0].Publisher.length()){
				newItem.publisher = Zotero.Utilities.trimInternal(metadata[0].Publisher[0].text().toString());
			}
			if (metadata[0].Format_Medium.length()){
				newItem.medium = Zotero.Utilities.trimInternal(metadata[0].Format_Medium[0].text().toString());
			}
			if (metadata[0].Language.length()){
				newItem.language = Zotero.Utilities.trimInternal(metadata[0].Language[0].text().toString());
			}	
			if (metadata[0].Description.length()){
				newItem.abstractNote = metadata[0].Description[0].text().toString();
			}
			if (metadata[0].Format_Extent.length()){
				newItem.pages = Zotero.Utilities.trimInternal(metadata[0].Format_Extent[0].text().toString());
			}
			var doi = xml..DOI;
			if (doi.length()){
				newItem.DOI = doi[0];
				var newUrl = "http://www.aluka.org/action/showMetadata?doi=" + doi[0];
				newItem.attachments.push({title:"Aluka Link", snapshot:false, mimeType:"text/html", url:newUrl});
				var pdfUrl = "http://ts-den.aluka.org/delivery/aluka-contentdelivery/pdf/" + doi[0] + "?type=img&q=high";
				newItem.attachments.push({url:pdfUrl});
				newItem.url = newUrl;
			}
			var rights = xml..Rights.Attribution;
			if (rights.length()){
				newItem.rights = rights[0];
			}
			if (metadata[0].Rights.length()){
				newItem.rights = Zotero.Utilities.trimInternal(metadata[0].Rights[0].text().toString());
			}
			if (metadata[0].Source.length()){
				newItem.repository = "Aluka: " + Zotero.Utilities.trimInternal(metadata[0].Source[0].text().toString());
			}
			if (metadata[0].Relation.length()){
				newItem.callNumber = Zotero.Utilities.trimInternal(metadata[0].Relation[0].text().toString());
			}
			newItem.complete();
		} else {
			Zotero.debug("No Dublin Core XML data");
			return false;
		}
		Zotero.done();
	});
	Zotero.wait();
}