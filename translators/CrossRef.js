{
	"translatorID":"11645bd1-0420-45c1-badb-53fb41eeb753",
	"translatorType":8,
	"label":"CrossRef",
	"creator":"Simon Kornblith",
	"target":"^https?://partneraccess\\.oclc\\.org/",
	"minVersion":"2.1",
	"maxVersion":"",
	"priority":90,
	"inRepository":true,
	"lastUpdated":"2011-06-10 17:19:11"
}

/* CrossRef uses unixref; documentation at http://www.crossref.org/schema/documentation/unixref1.0/unixref.html */

function detectSearch(item) {
	if(item.itemType == "journalArticle") {
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

function processCrossRef(xmlOutput) {
	xmlOutput = xmlOutput.replace(/<\?xml[^>]*\?>/, "");
	
	// parse XML with E4X
	try {
		var xml = new XML(xmlOutput);
		if(!xml.doi_record.length()) {
			var xml = new XML(xmlOutput);
		}
	} catch(e) {
		return false;
	}
	
	// "with ({});" needed to fix default namespace scope issue
	// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
	default xml namespace = "http://www.crossref.org/xschema/1.1"; with ({});
	
	if(!xml.doi_record.length()) {
		// Fall back to older namespace
		default xml namespace = "http://www.crossref.org/xschema/1.0";
		if(!xml.doi_record.length()) {
			default xml namespace = "";
		}
	}
	// ensure this isn't an error
	if(xml.doi_record.crossref.error.length()) {
		throw xml.doi_record.crossref.error
		return false;
	}
	if(xml.doi_record[0].crossref.journal.length()) {
		var item = new Zotero.Item("journalArticle");
		var itemXML = xml.doi_record.crossref.journal;
		var refXML = itemXML.journal_article;
		var metadataXML = itemXML.journal_metadata;
	
		item.publicationTitle = itemXML.journal_metadata.full_title.toString();
		if (itemXML.journal_metadata.abbrev_title.length()) {
			item.journalAbbreviation = itemXML.journal_metadata.abbrev_title[0].toString();
		}
		item.volume = itemXML.journal_issue.journal_volume.volume.toString();
		item.issue = itemXML.journal_issue.issue.toString();
       } else if(xml.doi_record[0].crossref["report-paper"].length()) {
               // Report Paper
               // Example: doi: 10.4271/2010-01-0907
               // http://www.crossref.org/openurl/?pid=zter:zter321&url_ver=Z39.88-2004&ctx_ver=Z39.88-2004&rft_id=info%3Adoi/10.4271/2010-01-0907&rft_val_fmt=info%3A
               var itemXML = xml.doi_record[0].crossref["report-paper"];
               var refXML = itemXML["report-paper_metadata"];
               var metadataXML = itemXML["report-paper_metadata"];
               var item = new Zotero.Item("report");
               if (metadataXML.publisher_item.item_number.toString())
                       item.reportNumber = metadataXML.publisher_item.item_number.toString();
               item.institution = metadataXML.publisher.publisher_name.toString();
               item.place = metadataXML.publisher.publisher_place.toString();
	} else if(xml.doi_record[0].crossref.book.length()) {
		// Book chapter
		// Example: doi: 10.1017/CCOL0521858429.016
		if(xml.doi_record[0].crossref.book.@book_type.length()
				&& xml.doi_record[0].crossref.book.@book_type == 'edited_book') {
			var item = new Zotero.Item("bookSection");
			var refXML = xml.doi_record[0].crossref.book.content_item;
			if (xml.doi_record[0].crossref.book.book_series_metadata.length())
				var metadataXML = xml.doi_record[0].crossref.book.book_series_metadata;
			else if (xml.doi_record[0].crossref.book.book_metadata.length())
				var metadataXML = xml.doi_record[0].crossref.book.book_metadata;
			if (metadataXML.series_metadata.length())
				item.bookTitle = metadataXML.series_metadata.titles.title[0].toString();
			else if (metadataXML.length())
				item.bookTitle = metadataXML.titles.title[0].toString();
			
			// Handle book authors
			if (metadataXML.contributors.length()) {
				for each (var creatorXML in metadataXML.contributors.children()) {
					var creator = {creatorType:"bookAuthor"};
					if(creatorXML.@contributor_role == "editor") {
						creator.creatorType = "editor";
					} else if(creatorXML.@contributor_role == "translator") {
						creator.creatorType = "translator";
					}
					if(creatorXML.localName() == "organization") {
						creator.fieldMode = 1;
						creator.lastName = creatorXML.toString();
					} else if(creatorXML.localName() == "person_name") {
						creator.firstName = fixAuthorCapitalization(creatorXML.given_name.toString());
						creator.lastName = fixAuthorCapitalization(creatorXML.surname.toString());
					}
					item.creators.push(creator);
				}
			}
		// Reference book entry
		// Example: doi: 10.1002/14651858.CD002966.pub3
		// http://www.crossref.org/openurl/?url_ver=Z39.88-2004&req_dat=usr:pwd&rft_id=info:doi/10.1002/14651858.CD002966.pub3&format=unixref&redirect=false
		} else if(xml.doi_record[0].crossref.book.@book_type.length()
				&& (xml.doi_record[0].crossref.book.@book_type == 'reference'
					|| xml.doi_record[0].crossref.book.@book_type == 'other')
				&& (xml.doi_record[0].crossref.book.content_item.@component_type == "chapter"
					|| xml.doi_record[0].crossref.book.content_item.@component_type == 'reference_entry')) {
			var item = new Zotero.Item("bookSection");
			var refXML = xml.doi_record[0].crossref.book.content_item;
			var metadataXML = (xml.doi_record[0].crossref.book.book_metadata.length() ? 
				xml.doi_record[0].crossref.book.book_metadata :
				xml.doi_record[0].crossref.book.book_series_metadata);
			item.bookTitle = metadataXML.titles.title[0].toString();
			
			// Handle book authors
			if (metadataXML.contributors.length()) {
				for each (var creatorXML in metadataXML.contributors.children()) {
					var creator = {creatorType:"bookAuthor"};
					if(creatorXML.@contributor_role == "editor") {
						creator.creatorType = "editor";
					} else if(creatorXML.@contributor_role == "translator") {
						creator.creatorType = "translator";
					}
					if(creatorXML.localName() == "organization") {
						creator.fieldMode = 1;
						creator.lastName = creatorXML.toString();
					} else if(creatorXML.localName() == "person_name") {
						creator.firstName = fixAuthorCapitalization(creatorXML.given_name.toString());
						creator.lastName = fixAuthorCapitalization(creatorXML.surname.toString());
					}
					item.creators.push(creator);
				}
			}
		// Book
		} else {
			var item = new Zotero.Item("book");
			var refXML = xml.doi_record[0].crossref.book.book_metadata;
			var metadataXML = refXML;
			var seriesXML = metadataXML.series_metadata;
		}
		
		item.place = metadataXML.publisher.publisher_place.toString();
	} else if(xml.doi_record[0].crossref.conference.length()) {
		var item = new Zotero.Item("conferencePaper");
		var itemXML = xml.doi_record[0].crossref.conference;
		var refXML = itemXML.conference_paper;
		var metadataXML = itemXML.proceedingsMetadata;
		var seriesXML = metadataXML.series_metadata;
		
		item.publicationTitle = itemXML.proceedings_metadata.proceedings_title.toString();
		item.place = itemXML.event_metadata.conference_location.toString();
		item.conferenceName = itemXML.event_metadata.conference_name.toString();
	}
	
	var contributors = refXML.contributors.children();
	
	if(metadataXML.isbn.length()) item.ISBN = metadataXML.isbn[0].toString();
	if(metadataXML.issn.length()) item.ISSN = metadataXML.issn[0].toString();
	item.publisher = metadataXML.publisher.publisher_name.toString();
	item.edition = metadataXML.edition_number.toString();
	if(!item.volume) item.volume = metadataXML.volume.toString();
	
	if(seriesXML && seriesXML.length()) {
		if(seriesXML.contributors.length()) {
			contributors += seriesXML.contributors.children();
		}
		item.seriesNumber = seriesXML.series_number.toString();
	}

	for each(var creatorXML in contributors) {
		var creator = {creatorType:"author"};
		if(creatorXML.@contributor_role == "editor") {
			creator.creatorType = "editor";
		} else if(creatorXML.@contributor_role == "translator") {
			creator.creatorType = "translator";
		} else if(creatorXML.@contributor_role == "chair") {
			creator.creatorType = "contributor"; 
		}
		
		if(creatorXML.localName() == "organization") {
			creator.fieldMode = 1;
			creator.lastName = creatorXML.toString();
		} else if(creatorXML.localName() == "person_name") {
			creator.firstName = fixAuthorCapitalization(creatorXML.given_name.toString());
			creator.lastName = fixAuthorCapitalization(creatorXML.surname.toString());
		}
		item.creators.push(creator);
	}
	
	var pubDateNode;
	if(refXML.publication_date.length()) {
		pubDateNode = refXML.publication_date;
	}
	// For book chapters, try metadataXML node
	else if(metadataXML.publication_date.length()) {
		pubDateNode = metadataXML.publication_date;
	}
	if(pubDateNode) {
		item.date = pubDateNode[0].year.toString();
		if(pubDateNode[0].month.length()) {
			item.date = pubDateNode[0].month.toString()+"/"+item.date;
		}
	}
	
	if(refXML.pages.length()) {
		item.pages = refXML.pages.first_page.toString();
		if(refXML.pages.last_page.length()) {
			item.pages += "-"+refXML.pages.last_page.toString();
		}
	}
	
	item.DOI = refXML.doi_data.doi.toString();
	item.url = refXML.doi_data.resource.toString();
	item.title = refXML.titles[0].title.toString().replace(/^<title>/, "").replace(/<\/title>$/,"");
	
	item.complete();
	return true;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
		if(co.indexOf("url_ver=") == -1) {
			co = "url_ver=Z39.88-2004&"+co;
		}
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.HTTP.doGet("http://www.crossref.org/openurl/?pid=zter:zter321&"+co+"&noredirect=true&format=unixref", function(responseText) {
		processCrossRef(responseText);
		Zotero.done();
	});
	
	Zotero.wait();
}
