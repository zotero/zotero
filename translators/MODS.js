{
	"translatorID":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"translatorType":3,
	"label":"MODS",
	"creator":"Simon Kornblith",
	"target":"xml",
	"minVersion":"1.0.8",
	"maxVersion":"",
	"priority":50,
	"inRepository":true,
	"lastUpdated":"2009-05-05 07:15:00"
}

Zotero.addOption("exportNotes", true);

function detectImport() {
	var read = Zotero.read(512);
	var modsTagRegexp = /<mods[^>]+>/
	if(modsTagRegexp.test(read)) {
		return true;
	}
}

var partialItemTypes = ["bookSection", "journalArticle", "magazineArticle", "newspaperArticle"];

function doExport() {
	Zotero.setCharacterSet("utf-8");
	var modsCollection = <modsCollection xmlns="http://www.loc.gov/mods/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/mods/v3 http://www.loc.gov/standards/mods/v3/mods-3-2.xsd" />;
	
	var item;
	while(item = Zotero.nextItem()) {
		var isPartialItem = Zotero.Utilities.inArray(item.itemType, partialItemTypes);
		
		var mods = <mods />;
		
		/** CORE FIELDS **/
		
		// XML tag titleInfo; object field title
		if(item.title) {
			mods.titleInfo.title = item.title;
		}
		
		// XML tag typeOfResource/genre; object field type
		var modsType, marcGenre;
		if(item.itemType == "book" || item.itemType == "bookSection") {
			modsType = "text";
			marcGenre = "book";
		} else if(item.itemType == "journalArticle" || item.itemType == "magazineArticle") {
			modsType = "text";
			marcGenre = "periodical";
		} else if(item.itemType == "newspaperArticle") {
			modsType = "text";
			marcGenre = "newspaper";
		} else if(item.itemType == "thesis") {
			modsType = "text";
			marcGenre = "theses";
		} else if(item.itemType == "letter") {
			modsType = "text";
			marcGenre = "letter";
		} else if(item.itemType == "manuscript") {
			modsType = "text";
			modsType.@manuscript = "yes";
		} else if(item.itemType == "interview") {
			modsType = "text";
			marcGenre = "interview";
		} else if(item.itemType == "film") {
			modsType = "moving image";
			marcGenre = "motion picture";
		} else if(item.itemType == "artwork") {
			modsType = "still image";
			marcGenre = "art original";
		} else if(item.itemType == "webpage") {
			modsType = "multimedia";
			marcGenre = "web site";
		} else if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}
		mods.typeOfResource = modsType;
		mods.genre += <genre authority="local">{item.itemType}</genre>;
		if(marcGenre) {
			mods.genre += <genre authority="marcgt">{marcGenre}</genre>;
		}
		
		// XML tag genre; object field thesisType, type
		if(item.thesisType) {
			mods.genre += <genre>{item.thesisType}</genre>;
		}
		if(item.type) {
			mods.genre += <genre>{item.type}</genre>;
		}
		
		// XML tag name; object field creators
		for(var j in item.creators) {
			var roleTerm = "";
			if(item.creators[j].creatorType == "author") {
				roleTerm = "aut";
			} else if(item.creators[j].creatorType == "editor") {
				roleTerm = "edt";
			} else if(item.creators[j].creatorType == "creator") {
				roleTerm = "ctb";
			}
			
			// FIXME - currently all names are personal
			mods.name += <name type="personal">
				<namePart type="family">{item.creators[j].lastName}</namePart>
				<namePart type="given">{item.creators[j].firstName}</namePart>
				<role><roleTerm type="code" authority="marcrelator">{roleTerm}</roleTerm></role>
				</name>;
		}
		
		// XML tag recordInfo.recordOrigin; used to store our generator note
		//mods.recordInfo.recordOrigin = "Zotero for Firefox "+Zotero.Utilities.getVersion();
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// XML tag recordInfo.recordContentSource; object field source
		if(item.source) {
			mods.recordInfo.recordContentSource = item.source;
		}
		// XML tag recordInfo.recordIdentifier; object field accessionNumber
		if(item.accessionNumber) {
			mods.recordInfo.recordIdentifier = item.accessionNumber;
		}
		
		// XML tag accessCondition; object field rights
		if(item.rights) {
			mods.accessCondition = item.rights;
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// Make part its own tag so we can figure out where it goes later
		var part = new XML();
		
		// XML tag detail; object field volume
		if(item.volume) {
			if(Zotero.Utilities.isInt(item.volume)) {
				part += <detail type="volume"><number>{item.volume}</number></detail>;
			} else {
				part += <detail type="volume"><text>{item.volume}</text></detail>;
			}
		}
		
		// XML tag detail; object field number
		if(item.issue) {
			if(Zotero.Utilities.isInt(item.issue)) {
				part += <detail type="issue"><number>{item.issue}</number></detail>;
			} else {
				part += <detail type="issue"><text>{item.issue}</text></detail>;
			}
		}
		
		// XML tag detail; object field section
		if(item.section) {
			if(Zotero.Utilities.isInt(item.section)) {
				part += <detail type="section"><number>{item.section}</number></detail>;
			} else {
				part += <detail type="section"><text>{item.section}</text></detail>;
			}
		}
		
		// XML tag detail; object field pages
		if(item.pages) {
			var range = Zotero.Utilities.getPageRange(item.pages);
			part += <extent unit="pages"><start>{range[0]}</start><end>{range[1]}</end></extent>;
		}
		
		// Assign part if something was assigned
		if(part.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., the part is the host
				mods.relatedItem.part += <part>{part}</part>;
			} else {
				mods.part += <part>{part}</part>;
			}
		}
		
		// XML tag originInfo; object fields edition, place, publisher, year, date
		var originInfo = new XML();
		if(item.edition) {
			originInfo += <edition>{item.edition}</edition>;
		}
		if(item.place) {
			originInfo += <place><placeTerm type="text">{item.place}</placeTerm></place>;
		}
		if(item.publisher) {
			originInfo += <publisher>{item.publisher}</publisher>;
		} else if(item.distributor) {
			originInfo += <publisher>{item.distributor}</publisher>;
		}
		if(item.date) {
			if(Zotero.Utilities.inArray(item.itemType, ["book", "bookSection"])) {
				// Assume year is copyright date
				var dateType = "copyrightDate";
			} else if(Zotero.Utilities.inArray(item.itemType, ["journalArticle", "magazineArticle", "newspaperArticle"])) {
				// Assume date is date issued
				var dateType = "dateIssued";
			} else {
				// Assume date is date created
				var dateType = "dateCreated";
			}
			var tag = <{dateType}>{item.date}</{dateType}>;
			originInfo += tag;
		}
		if(item.accessDate) {
			originInfo += <dateCaptured>{item.accessDate}</dateCaptured>;
		}
		if(originInfo.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., this goes under the host
				mods.relatedItem.originInfo += <originInfo>{originInfo}</originInfo>;
			} else {
				mods.originInfo += <originInfo>{originInfo}</originInfo>;
			}
		}
		
		// XML tag identifier; object fields ISBN, ISSN
		if(isPartialItem) {
			var identifier = mods.relatedItem;
		} else {
			var identifier = mods;
		}
		if(item.ISBN) {
			identifier.identifier += <identifier type="isbn">{item.ISBN}</identifier>;
		}
		if(item.ISSN) {
			identifier.identifier += <identifier type="issn">{item.ISSN}</identifier>;
		}
		if(item.DOI) {
			mods.identifier += <identifier type="doi">{item.DOI}</identifier>;
		}
		
		// XML tag relatedItem.titleInfo; object field publication
		if(item.publicationTitle) {
			mods.relatedItem.titleInfo += <titleInfo><title>{item.publicationTitle}</title></titleInfo>;
		}
		
		// XML tag classification; object field callNumber
		if(item.callNumber) {
			mods.classification = item.callNumber;
		}
		
		// XML tag location.physicalLocation; object field archiveLocation
		if(item.archiveLocation) {
			mods.location.physicalLocation = item.archiveLocation;
		}
		
		// XML tag location.url; object field archiveLocation
		if(item.url) {
			mods.location.url = item.url;
		}
		
		// XML tag title.titleInfo; object field journalAbbreviation
		if(item.journalAbbreviation) {
			mods.relatedItem.titleInfo += <titleInfo type="abbreviated"><title>{item.journalAbbreviation}</title></titleInfo>;
		}
		
		// XML tag abstract; object field abstractNote
		if(item.abstractNote) {
			mods.abstract = item.abstractNote;
		}
		
		if(mods.relatedItem.length() == 1 && isPartialItem) {
			mods.relatedItem.@type = "host";
		}
		
		/** NOTES **/
		
		if(Zotero.getOption("exportNotes")) {
			for(var j in item.notes) {
				// Add note tag
				var note = <note type="content">{item.notes[j].note}</note>;
				mods.note += note;
			}
		}
		
		/** TAGS **/
		
		for(var j in item.tags) {
			mods.subject += <subject><topic>{item.tags[j].tag}</topic></subject>;
		}
		
		
		// XML tag relatedItem.titleInfo; object field series
		if(item.seriesTitle || item.series || item.seriesNumber || item.seriesText) {
			var series = <relatedItem type="series"/>;
			
			if(item.series) {
				series.titleInfo.title = item.series;
			}
			
			if(item.seriesTitle) {
				series.titleInfo.partTitle = item.seriesTitle;
			}
			
			if(item.seriesText) {
				series.titleInfo.subTitle = item.seriesText;
			}
			
			if(item.seriesNumber) {
				series.titleInfo.partNumber = item.seriesNumber;
			}
			
			// TODO: make this work in import
			/*if(item.itemType == "bookSection") {
				// For a book section, series info must go inside host tag
				mods.relatedItem.relatedItem = series;
			} else {*/
				mods.relatedItem += series;
			//}
		}
		
		modsCollection.mods += mods;
	}
	
	Zotero.write('<?xml version="1.0"?>'+"\n");
	Zotero.write(modsCollection.toXMLString());
}

function processIdentifiers(newItem, identifier) {
	for each(var myIdentifier in identifier) {
		if(myIdentifier.@type == "isbn") {
			newItem.ISBN = myIdentifier.text().toString()
		} else if(myIdentifier.@type == "issn") {
			newItem.ISSN = myIdentifier.text().toString()
		} else if(myIdentifier.@type == "doi") {
			newItem.DOI = myIdentifier.text().toString()
		}
	}
}

function doImport() {
	var marcGenres = {
		"book":"book",
		"periodical":"journalArticle",
		"newspaper":"newspaperArticle",
		"theses":"thesis",
		"letter":"letter",
		"motion picture":"film",
		"art original":"artwork",
		"web site":"webpage"
	};
	
	
	var read;
	
	// read until we see if the file begins with a parse instruction
	read = " ";
	while(read == " " || read == "\n" || read == "\r") {
		read = Zotero.read(1);
	}
	
	var firstPart = read + Zotero.read(4);
	if(firstPart == "<?xml") {
		// got a parse instruction, read until it ends
		read = true;
		while((read !== false) && (read !== ">")) {
			read = Zotero.read(1);
			firstPart += read;
		}
		var encodingRe = /encoding=['"]([^'"]+)['"]/;
		var m = encodingRe.exec(firstPart);
		// set character set
		try {
			Zotero.setCharacterSet(m[1]);
		} catch(e) {
			Zotero.setCharacterSet("utf-8");
		}
	} else {
		Zotero.setCharacterSet("utf-8");
	}
	
	// read in 16384 byte increments
	var text = "";
	while(read = Zotero.read(16384)) {
		text += read;
	}
	text = text.replace(/<\?xml[^>]+\?>/, "");
	
	// parse with E4X
	var m = new Namespace("http://www.loc.gov/mods/v3");
	// why does this default namespace declaration not work!?
	default xml namespace = m;
	var xml = new XML(text);
	
	if(xml.m::mods.length()) {
		var modsElements = xml.m::mods;
	} else {
		var modsElements = [xml];
	}
	
	for each(var mods in modsElements) {
		var newItem = new Zotero.Item();
		
		// title
		for each(var titleInfo in mods.m::titleInfo) {
			// dropping other title types so they don't overwrite the main title
			// we have same behaviour in the MARC translator
			if(!titleInfo.@type.toString()) { 
				newItem.title = titleInfo.*.text(); // including text from sub elements
			} 
		}
		// try to get genre from local genre
		for each(var genre in mods.m::genre) {
			if(genre.@authority == "local" && Zotero.Utilities.itemTypeExists(genre)) {
				newItem.itemType = genre.text().toString();
			} else if(!newItem.itemType && (genre.@authority == "marcgt" || genre.@authority == "marc")) {
				// otherwise, look at the marc genre
				newItem.itemType = marcGenres[genre.text().toString()];
			}
		}
		
		if(!newItem.itemType) {
			// try to get genre data from host
			for each(var relatedItem in mods.m::relatedItem) {
				if(relatedItem.@type == "host") {
					for each(var genre in relatedItem.m::genre) {
						if(genre.@authority == "marcgt" || genre.@authority == "marc") {
							newItem.itemType = marcGenres[genre.text().toString()];
							break;
						}
					}
				}
			}
			
			// check if this is an electronic resource
			if(!newItem.itemType) {
				for each(var form in mods.m::physicalDescription.m::form) {
					if(form.@authority == "marcform" || form.@authority == "marc") {
						if(form.text().toString() == "electronic") {
							newItem.itemType = "webpage";
							break;
						}
					}
				}
				
				if(!newItem.itemType) newItem.itemType = "book";
			}
		}
		
		var isPartialItem = Zotero.Utilities.inArray(newItem.itemType, partialItemTypes);
		
		// TODO: thesisType, type
		
		for each(var name in mods.m::name) {
			// TODO: institutional authors
			var creator = {};
			creator.firstName = "";
			for each(var namePart in name.m::namePart) {
				if(namePart.@type == "given") {
					if(creator.firstName != "")
						creator.firstName = creator.firstName + " ";
					creator.firstName = creator.firstName + namePart.text().toString();
				} else if(namePart.@type == "family") {
					creator.lastName = namePart.text().toString();
				} else if(namePart.@type == "date" || namePart.@type == "termsOfAddress") {
					// ignore these non name types for now
				}
				else {
					var backupName = namePart.text().toString();
				}
			}
			
			if(backupName && !creator.firstName && !creator.lastName) {
				creator = Zotero.Utilities.cleanAuthor(backupName, "author", true);
			}
			
			// look for roles
			for(var role in name.m::role.m::roleTerm) {
				if(role.@type == "code" && role.@authority == "marcrelator") {
					if(role == "edt") {
						creator.creatorType = "editor";
					} else if(role == "ctb") {
						creator.creatorType = "contributor";
					} else if(role == "trl") {
						creator.creatorType = "translator";
					}
				}
			}
			if(!creator.creatorType) creator.creatorType = "author";
			
			newItem.creators.push(creator);
		}
		
		// source
		newItem.source = mods.m::recordInfo.m::recordContentSource.text().toString();
		// accessionNumber
		newItem.accessionNumber = mods.m::recordInfo.m::recordIdentifier.text().toString();
		// rights
		newItem.rights = mods.m::accessCondition.text().toString();
		
		/** SUPPLEMENTAL FIELDS **/
		
		var part = false, originInfo = false;
		
		// series
		for each(var relatedItem in mods.m::relatedItem) {
			if(relatedItem.@type == "host") {
				for each(var titleInfo in relatedItem.m::titleInfo) {
					if(titleInfo.@type == "abbreviated") {
						newItem.journalAbbreviation = titleInfo.m::title.text().toString();
						if(!newItem.publicationTitle) newItem.publicationTitle = newItem.journalAbbreviation;
					} else {
						newItem.publicationTitle = titleInfo.m::title.text().toString();
					}
				}
				part = relatedItem.m::part;
				originInfo = relatedItem.m::originInfo;
				processIdentifiers(newItem, relatedItem.m::identifier);
			} else if(relatedItem.@type == "series") {
				newItem.series = relatedItem.m::titleInfo.m::title.text().toString();
				newItem.seriesTitle = relatedItem.m::titleInfo.m::partTitle.text().toString();
				newItem.seriesText = relatedItem.m::titleInfo.m::subTitle.text().toString();
				newItem.seriesNumber = relatedItem.m::titleInfo.m::partNumber.text().toString();
			}
		}
		
		// get part
		if(!part) {
			part = mods.m::part;
			originInfo = mods.m::originInfo;
		}
		
		if(part) {
			for each(var detail in part.m::detail) {
				// volume
				if(detail.@type == "volume") {
					newItem.volume = detail.m::number.text().toString();
					if(!newItem.volume) {
						newItem.volume = detail.m::text.text().toString();
					}
				}
				
				// number
				if(detail.@type == "issue") {
					newItem.issue = detail.m::number.text().toString();
					if(!newItem.issue) {
						newItem.issue = detail.m::text.text().toString();
					}
				}
				
				// section
				if(detail.@type == "section") {
					newItem.section = detail.m::number.text().toString();
					if(!newItem.section) {
						newItem.section = detail.m::text.text().toString();
					}
				}
			}
			
			// pages
			for each(var extent in part.m::extent) {
				if(extent.@unit == "pages" || extent.@unit == "page") {
					var pagesStart = extent.m::start.text().toString();
					var pagesEnd = extent.m::end.text().toString();
					if(pagesStart || pagesEnd) {
						if(pagesStart == pagesEnd) {
							newItem.pages = pagesStart;
						} else if(pagesStart && pagesEnd) {
							newItem.pages = pagesStart+"-"+pagesEnd;
						} else {
							newItem.pages = pagesStart+pagesEnd;
						}
					}
				}
			}
		}
		
		// identifier
		processIdentifiers(newItem, mods.m::identifier);
		// edition
		newItem.edition = originInfo.m::edition.text().toString();
		// place
		for each(var placeTerm in originInfo.m::place.m::placeTerm) {
			if(placeTerm.@type == "text") {
				newItem.place = placeTerm.text().toString();
			}
		}
		// publisher/distributor
		if(originInfo.m::publisher.length()) {
			if(newItem.itemType == "webpage" || newItem.itemType == "website") {
				newItem.publicationTitle = originInfo.m::publisher[0].text().toString();
			} else {
				newItem.publisher = originInfo.m::publisher[0].text().toString();
			}
		}
		// date
		if(originInfo.m::copyrightDate.length()) {
			newItem.date = originInfo.m::copyrightDate[0].text().toString();
		} else if(originInfo.m::dateIssued.length()) {
			newItem.date = originInfo.m::dateIssued[0].text().toString();
		} else if(originInfo.m::dateCreated.length()) {
			newItem.date = originInfo.m::dateCreated[0].text().toString();
		}
		// lastModified
		newItem.lastModified = originInfo.m::dateModified.text().toString();
		// accessDate
		newItem.accessDate = originInfo.m::dateCaptured.text().toString();
		
		// call number
		newItem.callNumber = mods.m::classification.text().toString();
		// archiveLocation
		newItem.archiveLocation = mods.m::location.m::physicalLocation.text().toString();
		// attachments and url
		for each(var url in mods.m::location.m::url) {
			var value = url.text().toString();
			if (url.@access == "raw object") {
				var filetitle;
				if (url.@displayLabel){
					filetitle = url.@displayLabel;
				} else {
					filetitle = "Attachment";
				}
				if (value.substr(-4,4)==".pdf") {
					newItem.attachments.push({url:value, mimeType:"application/pdf", title:filetitle, downloadable:true});
				} else {
					newItem.attachments.push({url:value, title:filetitle, downloadable:true});
				}
			} else {
				newItem.url = value;
			}
		}
		// abstract
		newItem.abstractNote = mods.m::abstract.text().toString();
		
		/** NOTES **/
		for each(var note in mods.m::note) {
			newItem.notes.push({note:note.text().toString()});
		}
		
		/** TAGS **/
		for each(var subject in mods.m::subject.m::topic) {
			newItem.tags.push(subject.text().toString());
		}
		
		// Language
		// create an array of languages
		var languages = new Array();
		// E4X filter might need to be updated to include languageTerms that are @type="code" only
		for each(var language in mods.m::language.m::languageTerm.(@type == "text")) { 
			languages.push(language.text().toString());
		}
		// join the list separated by semicolons & add it to zotero item
		newItem.language = languages.join('; ');
		
		Zotero.debug(newItem);
		
		newItem.complete();
	}
}