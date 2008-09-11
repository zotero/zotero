{
	"translatorID":"14763d24-8ba0-45df-8f52-b8d1108e7ac9",
	"translatorType":2,
	"label":"Zotero RDF",
	"creator":"Simon Kornblith",
	"target":"rdf",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":25,
	"inRepository":true,
	"lastUpdated":"2008-07-20 01:40:00"
}

Zotero.configure("getCollections", true);
Zotero.configure("dataMode", "rdf");
Zotero.addOption("exportNotes", true);
Zotero.addOption("exportFileData", false);

var rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

var n = {
	bib:"http://purl.org/net/biblio#",
	dc:"http://purl.org/dc/elements/1.1/",
	dcterms:"http://purl.org/dc/terms/",
	prism:"http://prismstandard.org/namespaces/1.2/basic/",
	foaf:"http://xmlns.com/foaf/0.1/",
	vcard:"http://nwalsh.com/rdf/vCard#",
	link:"http://purl.org/rss/1.0/modules/link/",
	z:"http://www.zotero.org/namespaces/export#"
};

function generateSeeAlso(resource, seeAlso) {
	for(var i in seeAlso) {
		if(itemResources[seeAlso[i]]) {
			Zotero.RDF.addStatement(resource, n.dc+"relation", itemResources[seeAlso[i]], false);
		}
	}
}

function generateTags(resource, tags) {
	Zotero.debug("processing tags");
	for each(var tag in tags) {
		if(tag.type == 1) {
			var tagResource = Zotero.RDF.newResource();
			// set tag type and value
			Zotero.RDF.addStatement(tagResource, rdf+"type", n.z+"AutomaticTag", false);
			Zotero.RDF.addStatement(tagResource, rdf+"value", tag.tag, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"subject", tagResource, false);
		} else {
			Zotero.RDF.addStatement(resource, n.dc+"subject", tag.tag, true);
		}
	}
}

function generateCollection(collection) {
	var collectionResource = "#collection_"+collection.id;
	Zotero.RDF.addStatement(collectionResource, rdf+"type", n.z+"Collection", false);
	Zotero.RDF.addStatement(collectionResource, n.dc+"title", collection.name, true);
	
	var children = collection.children ? collection.children : collection.descendents;
	if(!children) return;
	for each(var child in children) {
		// add child list items
		if(child.type == "collection") {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", "#collection_"+child.id, false);
			// do recursive processing of collections
			generateCollection(child);
		} else if(itemResources[child.id]) {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", itemResources[child.id], false);
		}
	}
}

function generateItem(item, zoteroType, resource) {
	var container = null;
	var containerElement = null;
	
	/** CORE FIELDS **/
	
	// type
	var type = null;
	if(zoteroType == "book") {
		type = n.bib+"Book";
	} else if (zoteroType == "bookSection") {
		type = n.bib+"BookSection";
		container = n.bib+"Book";
	} else if(zoteroType == "journalArticle") {
		type = n.bib+"Article";
		container = n.bib+"Journal";
	} else if(zoteroType == "magazineArticle") {
		type = n.bib+"Article";
		container = n.bib+"Periodical";
	} else if(zoteroType == "newspaperArticle") {
		type = n.bib+"Article";
		container = n.bib+"Newspaper";
	} else if(zoteroType == "thesis") {
		type = n.bib+"Thesis";
	} else if(zoteroType == "letter") {
		type = n.bib+"Letter";
	} else if(zoteroType == "manuscript") {
		type = n.bib+"Manuscript";
	} else if(zoteroType == "interview") {
		type = n.bib+"Interview";
	} else if(zoteroType == "film") {
		type = n.bib+"MotionPicture";
	} else if(zoteroType == "artwork") {
		type = n.bib+"Illustration";
	} else if(zoteroType == "webpage") {
		type = n.bib+"Document";
		container = n.z+"Website";
	} else if(zoteroType == "note") {
		type = n.bib+"Memo";
		if(!Zotero.getOption("exportNotes")) {
			return;
		}
	} else if(zoteroType == "attachment") {
		type = n.z+"Attachment";
	} else if(zoteroType == "report") {
		type = n.bib+"Report";
	} else if(zoteroType == "bill") {
		type = n.bib+"Legislation";
	} else if(zoteroType == "case") {
		type = n.bib+"Document";	// ??
		container = n.bib+"CourtReporter";
	} else if(zoteroType == "hearing") {
		type = n.bib+"Report";
	} else if(zoteroType == "patent") {
		type = n.bib+"Patent";
	} else if(zoteroType == "statute") {
		type = n.bib+"Legislation";
	} else if(zoteroType == "email") {
		type = n.bib+"Letter";
	} else if(zoteroType == "map") {
		type = n.bib+"Image";
	} else if(zoteroType == "blogPost") {
		type = n.bib+"Document";
		container = n.z+"Blog";
	} else if(zoteroType == "instantMessage") {
		type = n.bib+"Letter";
	} else if(zoteroType == "forumPost") {
		type = n.bib+"Document";
		container = n.z+"Forum";
	} else if(zoteroType == "audioRecording") {
		type = n.bib+"Recording";
	} else if(zoteroType == "presentation") {
		type = n.bib+"ConferenceProceedings";
	} else if(zoteroType == "videoRecording") {
		type = n.bib+"Recording";
	} else if(zoteroType == "tvBroadcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "radioBroadcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "podcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "computerProgram") {
		type = n.bib+"Data";
	}
	
	if(type) {
		Zotero.RDF.addStatement(resource, rdf+"type", type, false);
	}
	Zotero.RDF.addStatement(resource, n.z+"itemType", zoteroType, true);
	
	// generate section
	if(item.section) {
		var section = Zotero.RDF.newResource();
		// set section type
		Zotero.RDF.addStatement(section, rdf+"type", n.bib+"Part", false);
		// set section title
		Zotero.RDF.addStatement(section, n.dc+"title", item.section, true);
		// add relationship to resource
		Zotero.RDF.addStatement(resource, n.dcterms+"isPartOf", section, false);
	}
	
	// generate container
	if(container) {
		if(item.ISSN && !Zotero.RDF.getArcsIn("urn:issn:"+item.ISSN)) {
			// use ISSN as container URI if no other item is
			containerElement = "urn:issn:"+item.ISSN;
		} else {
			containerElement = Zotero.RDF.newResource();
		}
		// attach container to section (if exists) or resource
		Zotero.RDF.addStatement((section ? section : resource), n.dcterms+"isPartOf", containerElement, false);
		// add container type
		Zotero.RDF.addStatement(containerElement, rdf+"type", container, false);
	}
	
	// generate series
	if(item.series || item.seriesTitle || item.seriesText || item.seriesNumber) {
		var series = Zotero.RDF.newResource();
		// set series type
		Zotero.RDF.addStatement(series, rdf+"type", n.bib+"Series", false);
		// add relationship to resource
		Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"isPartOf", series, false);
	}
	
	// generate publisher
	if(item.publisher || item.distributor || item.label || item.company || item.institution || item.place) {
		var organization = Zotero.RDF.newResource();
		// set organization type
		Zotero.RDF.addStatement(organization, rdf+"type", n.foaf+"Organization", false);
		// add relationship to resource
		Zotero.RDF.addStatement(resource, n.dc+"publisher", organization, false);
	}
	
	var typeProperties = ["reportType", "videoRecordingType", "letterType",
							"manuscriptType", "mapType", "thesisType", "websiteType",
							"audioRecordingType", "presentationType", "postType",
							"audioFileType"];
	var ignoreProperties = ["itemID", "itemType", "firstCreator", "dateAdded",
							"dateModified", "section", "sourceItemID"];
	
	// creators
	if(item.creators) {			// authors/editors/contributors
		var creatorContainers = new Object();
		
		// not yet in biblio
		var biblioCreatorTypes = ["author", "editor", "contributor"];
		
		for(var j in item.creators) {
			var creator = Zotero.RDF.newResource();
			Zotero.RDF.addStatement(creator, rdf+"type", n.foaf+"Person", false);
			// gee. an entire vocabulary for describing people, and these aren't even
			// standardized in it. oh well. using them anyway.
			Zotero.RDF.addStatement(creator, n.foaf+"surname", item.creators[j].lastName, true);
			Zotero.RDF.addStatement(creator, n.foaf+"givenname", item.creators[j].firstName, true);
			
			if(biblioCreatorTypes.indexOf(item.creators[j].creatorType) != -1) {
				var cTag = n.bib+item.creators[j].creatorType+"s";
			} else {
				var cTag = n.z+item.creators[j].creatorType+"s";
			}
			
			if(!creatorContainers[cTag]) {
				var creatorResource = Zotero.RDF.newResource();
				// create new seq for author type
				creatorContainers[cTag] = Zotero.RDF.newContainer("seq", creatorResource);
				// attach container to resource
				Zotero.RDF.addStatement(resource, cTag, creatorResource, false);
			}
			Zotero.RDF.addContainerElement(creatorContainers[cTag], creator, false);
		}
	}
	
	// notes
	if(item.notes && Zotero.getOption("exportNotes")) {
		for(var j in item.notes) {
			var noteResource = itemResources[item.notes[j].itemID];
			
			// add note tag
			Zotero.RDF.addStatement(noteResource, rdf+"type", n.bib+"Memo", false);
			// add note item.notes
			Zotero.RDF.addStatement(noteResource, rdf+"value", item.notes[j].note, true);
			// add relationship between resource and note
			Zotero.RDF.addStatement(resource, n.dcterms+"isReferencedBy", noteResource, false);
			
			// Add see also info to RDF
			generateSeeAlso(noteResource, item.notes[j].seeAlso);
			generateTags(noteResource, item.notes[j].tags);
		}
	}
	
	// child attachments
	if(item.attachments) {
		for each(var attachment in item.attachments) {
			var attachmentResource = itemResources[attachment.itemID];
			Zotero.RDF.addStatement(resource, n.link+"link", attachmentResource, false);
			generateItem(attachment, "attachment", attachmentResource);
		}
	}
	
	// relative file path for attachment items
	if(item.path) {
		Zotero.RDF.addStatement(resource, rdf+"resource", item.path, false);
	}
    
	// seeAlso and tags
	if(item.seeAlso) generateSeeAlso(resource, item.seeAlso);
	if(item.tags) generateTags(resource, item.tags);
	
	for(var property in item.uniqueFields) {
		var value = item[property];
		if(!value) continue;
		
		if(property == "title") {					// title
			Zotero.RDF.addStatement(resource, n.dc+"title", value, true);
		} else if(property == "source") {			// authors/editors/contributors
			Zotero.RDF.addStatement(resource, n.dc+"source", value, true);
		} else if(property == "url") {				// url
			// add url as identifier
			var term = Zotero.RDF.newResource();
			// set term type
			Zotero.RDF.addStatement(term, rdf+"type", n.dcterms+"URI", false);
			// set url value
			Zotero.RDF.addStatement(term, rdf+"value", value, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"identifier", term, false);
		} else if(property == "accessionNumber") {	// accessionNumber as generic ID
			Zotero.RDF.addStatement(resource, n.dc+"identifier", value, true);
		} else if(property == "rights") {			// rights
			Zotero.RDF.addStatement(resource, n.dc+"rights", value, true);
		} else if(property == "edition" ||			// edition
		          property == "version") {			// version
			Zotero.RDF.addStatement(resource, n.prism+"edition", value, true);
		} else if(property == "date") {				// date
			Zotero.RDF.addStatement(resource, n.dc+"date", value, true);
		} else if(property == "accessDate") {		// accessDate
			Zotero.RDF.addStatement(resource, n.dcterms+"dateSubmitted", value, true);
		} else if(property == "issueDate") {		// issueDate
			Zotero.RDF.addStatement(resource, n.dcterms+"issued", value, true);
		} else if(property == "pages") {			// pages
			// not yet part of biblio, but should be soon
			Zotero.RDF.addStatement(resource, n.bib+"pages", value, true);
		} else if(property == "extra") {			// extra
			Zotero.RDF.addStatement(resource, n.dc+"description", value, true);
		} else if(property == "mimeType") {			// mimeType
			Zotero.RDF.addStatement(resource, n.link+"type", value, true);
		} else if(property == "charset") {			// charset
			Zotero.RDF.addStatement(resource, n.link+"charset", value, true);
		// THE FOLLOWING ARE ALL PART OF THE CONTAINER
		} else if(property == "ISSN") {				// ISSN
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISSN "+value, true);
		} else if(property == "ISBN") {				// ISBN
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISBN "+value, true);
		} else if(property == "DOI") {				// DOI
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "DOI "+value, true);
		} else if(property == "publicationTitle" ||	// publicationTitle
		          property == "reporter") {			// reporter
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"title", value, true);
		} else if(property == "journalAbbreviation") {	// journalAbbreviation
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"alternative", value, true);
		} else if(property == "volume") {			// volume
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"volume", value, true);
		} else if(property == "issue" ||			// issue
				  property == "number" ||			// number
				  property == "patentNumber") {		// patentNumber
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"number", value, true);
		} else if(property == "callNumber") {
			var term = Zotero.RDF.newResource();
			// set term type
			Zotero.RDF.addStatement(term, rdf+"type", n.dcterms+"LCC", false);
			// set callNumber value
			Zotero.RDF.addStatement(term, rdf+"value", value, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"subject", term, false);
		} else if(property == "abstractNote") {
			Zotero.RDF.addStatement(resource, n.dcterms+"abstract", value, true);
		// THE FOLLOWING ARE ALL PART OF THE SERIES
		} else if(property == "series") {			// series
			Zotero.RDF.addStatement(series, n.dc+"title", value, true);
		} else if(property == "seriesTitle") {		// seriesTitle
			Zotero.RDF.addStatement(series, n.dcterms+"alternative", value, true);
		} else if(property == "seriesText") {		// seriesText
			Zotero.RDF.addStatement(series, n.dc+"description", value, true);
		} else if(property == "seriesNumber") {		// seriesNumber
			Zotero.RDF.addStatement(series, n.dc+"identifier", value, true);
		// THE FOLLOWING ARE ALL PART OF THE PUBLISHER
		} else if(property == "publisher" ||		// publisher
		          property == "distributor" ||		// distributor (film)
		          property == "label" ||			// label (audioRecording)
		          property == "company" ||			// company (computerProgram)
		          property == "institution") {		// institution (report)
			Zotero.RDF.addStatement(organization, n.foaf+"name", value, true);
		} else if(property == "place") {			// place
			var address = Zotero.RDF.newResource();
			// set address type
			Zotero.RDF.addStatement(address, rdf+"type", n.vcard+"Address", false);
			// set address locality
			Zotero.RDF.addStatement(address, n.vcard+"locality", value, true);
			// add relationship to organization
			Zotero.RDF.addStatement(organization, n.vcard+"adr", address, false);
		} else if(property == "archiveLocation") {	// archiveLocation
			Zotero.RDF.addStatement(resource, n.dc+"coverage", value, true);
		} else if(property == "interviewMedium" ||
		          property == "artworkMedium") {	// medium
			Zotero.RDF.addStatement(resource, n.dcterms+"medium", value, true);
		} else if(property == "conferenceName") {
			var conference = Zotero.RDF.newResource();
			// set conference type
			Zotero.RDF.addStatement(conference, rdf+"type", n.bib+"Conference", false);
			// set conference title
			Zotero.RDF.addStatement(conference, n.dc+"title", value, true);
			// add relationship to conference
			Zotero.RDF.addStatement(resource, n.bib+"presentedAt", conference, false);
		} else if(typeProperties.indexOf(property) != -1) {
			Zotero.RDF.addStatement(resource, n.dc+"type", value, true);
		// THE FOLLOWING RELATE TO NOTES
		} else if(property == "note") {
			if(Zotero.getOption("exportNotes")) {
				if(item.itemType == "attachment") {
					Zotero.RDF.addStatement(resource, n.dc+"description", value, true);
				} else if(item.itemType == "note") {
					Zotero.RDF.addStatement(resource, rdf+"value", value, true);
				}
			}
		// THIS CATCHES ALL REMAINING PROPERTIES
		} else if(ignoreProperties.indexOf(property) == -1) {
			Zotero.debug("Zotero RDF: using Zotero namespace for property "+property);
			Zotero.RDF.addStatement(resource, n.z+property, value, true);
		}
	}
}

function doExport() {
	// add namespaces
	for(var i in n) {
		Zotero.RDF.addNamespace(i, n[i]);
	}
	
	// leave as global
	itemResources = new Array();
	
	// keep track of resources already assigned (in case two book items have the
	// same ISBN, or something like that)
	var usedResources = new Array();
	
	var items = new Array();
	
	// first, map each ID to a resource
	while(item = Zotero.nextItem()) {
		items.push(item);
		
		if(item.ISBN && !usedResources["urn:isbn:"+item.ISBN]) {
			itemResources[item.itemID] = "urn:isbn:"+item.ISBN;
			usedResources[itemResources[item.itemID]] = true;
		} else if(item.itemType != "attachment" && item.url && !usedResources[item.url]) {
			itemResources[item.itemID] = item.url;
			usedResources[itemResources[item.itemID]] = true;
		} else {
			// just specify a node ID
			itemResources[item.itemID] = "#item_"+item.itemID;
		}
		
		for(var j in item.notes) {
			itemResources[item.notes[j].itemID] = "#item_"+item.notes[j].itemID;
		}
		
		for each(var attachment in item.attachments) {
			// just specify a node ID
			itemResources[attachment.itemID] = "#item_"+attachment.itemID;
		}
	}
	
	for each(item in items) {
		// these items are global
		generateItem(item, item.itemType, itemResources[item.itemID]);
	}
	
	/** RDF COLLECTION STRUCTURE **/
	var collection;
	while(collection = Zotero.nextCollection()) {
		generateCollection(collection);
	}
}