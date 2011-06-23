{
	"translatorID":"11645bd1-0420-45c1-badb-53fb41eeb753",
	"translatorType":8,
	"label":"CrossRef",
	"creator":"Simon Kornblith",
	"target":"^https?://partneraccess\\.oclc\\.org/",
	"minVersion":"2.1.9",
	"maxVersion":"",
	"priority":90,
	"browserSupport":"gcs",
	"inRepository":true,
	"lastUpdated":"2011-06-23 08:05:22"
}

/* CrossRef uses unixref; documentation at http://www.crossref.org/schema/documentation/unixref1.0/unixref.html */
var ns;

function detectSearch(item) {
	// query: should we make this more forgiving?
	if(item.itemType === "journalArticle" || item.DOI) {
		return true;
	}
	return false;
}

function fixAuthorCapitalization(string) {
	if(string.toUpperCase() == string) {
		string = string.toLowerCase().replace(/\b[a-z]/g, function(m) { return m[0].toUpperCase() });
	}
	return string;
}

function parseCreators(node, item, typeOverrideMap) {
	var contributors = ZU.xpath(node, 'c:contributors/c:organization | c:contributors/c:person_name', ns);
	for(var i in contributors) {
		var creatorXML = contributors[i];
		var creator = {};
		
		var role = creatorXML.getAttribute("contributor_role");
		if(typeOverrideMap && typeOverrideMap[role]) {
			creator.creatorType = typeOverrideMap[role];
		} else if(role === "author" || role === "editor" || role === "translator") {
			creator.creatorType = role;
		} else {
			creator.creatorType = "contributor";
		}
		
		if(creatorXML.nodeName === "organization") {
			creator.fieldMode = 1;
			creator.lastName = creatorXML.textContent;
		} else if(creatorXML.nodeName === "person_name") {
			creator.firstName = fixAuthorCapitalization(ZU.xpathText(creatorXML, 'c:given_name', ns));
			creator.lastName = fixAuthorCapitalization(ZU.xpathText(creatorXML, 'c:surname', ns));
		}
		item.creators.push(creator);
	}
}

function processCrossRef(xmlOutput) {
	// XPath does not give us the ability to use the same XPaths regardless of whether or not
	// there is a namespace, so we add an element to make sure that there will always be a 
	// namespace.
	xmlOutput = '<xml xmlns="http://www.example.com/">'+xmlOutput.replace(/<\?xml[^>]*\?>/, "")+"</xml>";
	
	// parse XML with E4X
	try {
		var parser = new DOMParser();
		var doc = parser.parseFromString(xmlOutput, "text/xml");
	} catch(e) {
		Zotero.debug(e);
		return false;
	}
	
	// determine appropriate namespace
	ns = {"c":"http://www.crossref.org/xschema/1.1", "x":"http://www.example.com/"};
	var doiRecords = ZU.xpath(doc, '/x:xml/c:doi_records/c:doi_record', ns);
	if(!doiRecords.length) {
		ns.c = "http://www.crossref.org/xschema/1.0";
		doiRecords = ZU.xpath(doc, '/x:xml/c:doi_records/c:doi_record', ns);
		if(!doiRecords.length) {
			// this means that the original document was un-namespaced
			ns.c = "http://www.example.com/";
			doiRecords = ZU.xpath(doc, '/c:xml/c:doi_records/c:doi_record', ns);
			if(!doiRecords.length) {
				throw new Error("No records found");
				return;
			}
		}
	}
	
	var doiRecord = doiRecords[0];
	
	// ensure this isn't an error
	var errorString = ZU.xpathText(doiRecord, 'c:crossref/c:error', ns);
	if(errorString !== null) {
		throw errorString;
		return false;
	}
	
	var itemXML, item, refXML, metadataXML, seriesXML;
	if((itemXML = ZU.xpath(doiRecord, 'c:crossref/c:journal', ns)).length) {
		item = new Zotero.Item("journalArticle");
		refXML = ZU.xpath(itemXML, 'c:journal_article', ns);
		metadataXML = ZU.xpath(itemXML, 'c:journal_metadata', ns);
	
		item.publicationTitle = ZU.xpathText(metadataXML, 'c:full_title[1]', ns);
		item.journalAbbreviation = ZU.xpathText(refXML, 'c:abbrev_title[1]', ns);
		item.volume = ZU.xpathText(itemXML, 'c:journal_issue/c:journal_volume/c:volume', ns);
		item.issue = ZU.xpathText(itemXML, 'c:journal_issue/c:journal_volume/c:issue', ns);
   } else if((itemXML = ZU.xpath(doiRecord, 'c:crossref/c:report-paper', ns)).length) {
		// Report Paper
		// Example: doi: 10.4271/2010-01-0907
		// http://www.crossref.org/openurl/?pid=zter:zter321&url_ver=Z39.88-2004&rft_id=info:doi/10.4271/2010-01-0907&format=unixref&redirect=false
		item = new Zotero.Item("report");
		refXML = ZU.xpath(itemXML, 'c:report-paper_metadata', ns);
		metadataXML = refXML;
		
		item.reportNumber = ZU.xpathText(refXML, 'c:publisher_item/c:item_number', ns);
		item.institution = ZU.xpathText(refXML, 'c:publisher/c:publisher_name', ns);
		item.place = ZU.xpathText(refXML, 'c:publisher/c:publisher_place', ns);
	} else if((itemXML = ZU.xpath(doiRecord, 'c:crossref/c:book', ns)).length) {
		// Book chapter
		// Example: doi: 10.1017/CCOL0521858429.016
		// http://www.crossref.org/openurl/?pid=zter:zter321&url_ver=Z39.88-2004&rft_id=info:doi/10.1017/CCOL0521858429.016&format=unixref&redirect=false
		// Reference book entry
		// Example: doi: 10.1002/14651858.CD002966.pub3
		// http://www.crossref.org/openurl/?pid=zter:zter321&url_ver=Z39.88-2004&rft_id=info:doi/10.1002/14651858.CD002966.pub3&format=unixref&redirect=false
		var bookType = itemXML[0].hasAttribute("book_type") ? itemXML[0].getAttribute("book_type") : null;
		var componentType = itemXML[0].hasAttribute("component_type") ? itemXML[0].getAttribute("component_type") : null;
		
		var isReference = ["reference", "other"].indexOf(bookType) !== -1
				&& ["chapter", "reference_entry"].indexOf(componentType);
		
		if(bookType === "edited_book" || isReference) {
			item = new Zotero.Item("bookSection");
			refXML = ZU.xpath(itemXML, 'c:content_item', ns);
			
			if(isReference) {
				metadataXML = ZU.xpath(itemXML, 'c:book_metadata', ns);
				if(!metadataXML.length) metadataXML = ZU.xpath(itemXML, 'c:book_series_metadata', ns);
				
				item.bookTitle = ZU.xpathText(metadataXML, 'c:titles[1]/c:title[1]', ns);
			} else {
				metadataXML = ZU.xpath(itemXML, 'c:book_series_metadata', ns);
				if(!metadataXML.length) metadataXML = ZU.xpath(itemXML, 'c:book_metadata', ns);
				
				item.bookTitle = ZU.xpathText(metadataXML, 'c:series_metadata/c:titles[1]/c:title[1]', ns);
				if(!item.bookTitle) item.bookTitle = ZU.xpathText(metadataXML, 'c:titles[1]/c:title[1]', ns);
			}
			
			// Handle book authors
			parseCreators(metadataXML, item, {"author":"bookAuthor"});
		// Book
		} else {
			item = new Zotero.Item("book");
			refXML = ZU.xpath(itemXML, 'c:book_metadata', ns);
			metadataXML = refXML;
			seriesXML = ZU.xpath(refXML, 'c:series_metadata', ns);
		}
		
		item.place = ZU.xpathText(metadataXML, 'c:publisher/c:publisher_place', ns);
	} else if((itemXML = ZU.xpath(doiRecord, 'c:crossref/c:conference', ns)).length) {
		item = new Zotero.Item("conferencePaper");
		refXML = ZU.xpath(itemXML, 'c:conference_paper', ns);
		metadataXML = ZU.xpath(itemXML, 'c:proceedings_metadata', ns);
		seriesXML = ZU.xpath(metadataXML, 'c:proceedings_metadata', ns);
		
		item.publicationTitle = ZU.xpathText(metadataXML, 'c:publisher/c:proceedings_title', ns);
		item.place = ZU.xpathText(metadataXML, 'c:event_metadata/c:conference_location', ns);
		item.conferenceName = ZU.xpathText(metadataXML, 'c:event_metadata/c:conference_name', ns);
	}
	
	item.ISBN = ZU.xpathText(metadataXML, 'c:isbn', ns);
	item.ISSN = ZU.xpathText(metadataXML, 'c:issn', ns);
	item.publisher = ZU.xpathText(metadataXML, 'c:publisher/c:publisher_name', ns);
	item.edition = ZU.xpathText(metadataXML, 'c:edition_number', ns);
	if(!item.volume) item.volume = ZU.xpathText(metadataXML, 'c:volume', ns);
	
	parseCreators(refXML, item, "author");
	
	if(seriesXML && seriesXML.length) {
		parseCreators(refXML, item, {"editor":"seriesEditor"});
		item.seriesNumber = ZU.xpathText(seriesXML, 'c:series_number', ns);
	}
	
	var pubDateNode = ZU.xpath(refXML, 'c:publication_date', ns);
	if(!pubDateNode) ZU.xpath(metadataXML, 'c:publication_date', ns);
	
	if(pubDateNode.length) {
		var year = ZU.xpathText(pubDateNode[0], 'c:year', ns);
		var month = ZU.xpathText(pubDateNode[0], 'c:month', ns);
		var day = ZU.xpathText(pubDateNode[0], 'c:day', ns);
		
		if(year) {
			if(month) {
				if(day) {
					item.date = year+"-"+month+"-"+day;
				} else {
					item.date = month+"/"+year
				}
			} else {
				item.date = year;
			}
		}
	}
	
	var pages = ZU.xpath(refXML, 'c:pages[1]', ns);
	if(pages.length) {
		item.pages = ZU.xpathText(pages, 'c:first_page[1]', ns);
		var lastPage = ZU.xpathText(pages, 'c:last_page[1]', ns);
		if(lastPage) item.pages += "-"+lastPage;
	}
	
	item.DOI = ZU.xpathText(refXML, 'c:doi_data/c:doi', ns);
	item.url = ZU.xpathText(refXML, 'c:doi_data/c:resource', ns);
	item.title = ZU.xpathText(refXML, 'c:titles[1]/c:title[1]', ns);
	
	//Zotero.debug(JSON.stringify(item, null, 4));
	
	item.complete();
	return true;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
		if(co.indexOf("url_ver=") == -1) {
			co = "url_ver=Z39.88-2004&"+co;
		}
	} else if(item.DOI) {
		var co = "url_ver=Z39.88-2004&&rft_id=info:doi/"+ZU.cleanDOI(item.DOI.toString());
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.HTTP.doGet("http://www.crossref.org/openurl/?pid=zter:zter321&"+co+"&noredirect=true&format=unixref", function(responseText) {
		processCrossRef(responseText);
		Zotero.done();
	});
	
	Zotero.wait();
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "search",
		"input": {
			"DOI":"10.1017/CCOL0521858429.016"
		},
		"items": [
			{
				"itemType": "bookSection",
				"creators": [
					{
						"creatorType": "editor",
						"firstName": "John",
						"lastName": "Rodden"
					},
					{
						"creatorType": "author",
						"firstName": "Christopher",
						"lastName": "Hitchens"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"bookTitle": "The Cambridge Companion to George Orwell",
				"place": "Cambridge",
				"ISBN": "0521858429, 9780521858427, 0521675073, 9780521675079",
				"publisher": "Cambridge University Press",
				"pages": "201-207",
				"DOI": "10.1017/CCOL0521858429.016",
				"url": "http://cco.cambridge.org/extract?id=ccol0521858429_CCOL0521858429A016",
				"title": "Why Orwell still matters",
				"libraryCatalog": "CrossRef"
			}
		]
	}
]
/** END TEST CASES **/