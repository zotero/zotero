{
	"translatorID":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"translatorType":3,
	"label":"RIS",
	"creator":"Simon Kornblith",
	"target":"ris",
	"minVersion":"2.1b2",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"configOptions":{"dataMode":"block"},
	"displayOptions":{"exportCharset":"UTF-8", "exportNotes":true},
	"lastUpdated":"2010-11-07 03:10:59"
}

function detectImport() {
	var line;
	var i = 0;
	while((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(line.substr(0, 6).match(/^TY {1,2}- /)) {
				return true;
			} else {
				if(i++ > 3) {
					return false;
				}
			}
		}
	}
}

var fieldMap = {
	ID:"itemID",
	T1:"title",
	T3:"series",
	JF:"publicationTitle",
	CY:"place",
	JA:"journalAbbreviation",
	M3:"DOI"
};

var bookSectionFieldMap = {
	ID:"itemID",
	T1:"title",
	T3:"series",
	T2:"bookTitle",
	CY:"place",
	JA:"journalAbbreviation",
	M3:"DOI"
};

var inputFieldMap = {
	TI:"title",
	CT:"title",
	CY:"place"
};

// TODO: figure out if these are the best types for letter, interview, webpage
var typeMap = {
	book:"BOOK",
	bookSection:"CHAP",
	journalArticle:"JOUR",
	magazineArticle:"MGZN",
	newspaperArticle:"NEWS",
	thesis:"THES",
	letter:"PCOMM",
	manuscript:"PAMP",
	interview:"PCOMM",
	film:"MPCT",
	artwork:"ART",
	report:"RPRT",
	bill:"BILL",
	"case":"CASE",
	hearing:"HEAR",
	patent:"PAT",
	statute:"STAT",
	map:"MAP",
	blogPost:"ELEC",
	webpage:"ELEC",
	instantMessage:"ICOMM",
	forumPost:"ICOMM",
	email:"ICOMM",
	audioRecording:"SOUND",
	presentation:"GEN",
	videoRecording:"VIDEO",
	tvBroadcast:"GEN",
	radioBroadcast:"GEN",
	podcast:"GEN",
	computerProgram:"COMP",
	conferencePaper:"CONF",
	document:"GEN"
};

// supplements outputTypeMap for importing
// TODO: DATA, MUSIC
var inputTypeMap = {
	ABST:"journalArticle",
	ADVS:"film",
	CTLG:"magazineArticle",
	INPR:"manuscript",
	JFULL:"journalArticle",
	PAMP:"manuscript",
	SER:"book",
	SLIDE:"artwork",
	UNBILL:"manuscript"
};

function processTag(item, tag, value) {
	if (Zotero.Utilities.unescapeHTML) {
		value = Zotero.Utilities.unescapeHTML(value.replace("\n", "<br>", "g"));
	}
    
	if(fieldMap[tag]) {
		item[fieldMap[tag]] = value;
	} else if(inputFieldMap[tag]) {
		item[inputFieldMap[tag]] = value;
	} else if(tag == "TY") {
		// look for type
		
		// trim the whitespace that some providers (e.g. ProQuest) include
		value = Zotero.Utilities.trim(value);
		
		// first check typeMap
		for(var i in typeMap) {
			if(value == typeMap[i]) {
				item.itemType = i;
			}
		}
		// then check inputTypeMap
		if(!item.itemType) {
			if(inputTypeMap[value]) {
				item.itemType = inputTypeMap[value];
			} else {
				// default to generic from inputTypeMap
				item.itemType = inputTypeMap["GEN"];
			}
		}
	} else if(tag == "JO") {
		if (item.itemType == "conferencePaper"){
			item.conferenceName = value;
		} else {
			item.publicationTitle = value;
		}
	} else if(tag == "BT") {
		// ignore, unless this is a book or unpublished work, as per spec
		if(item.itemType == "book" || item.itemType == "manuscript") {
			item.title = value;
		} else {
			item.backupPublicationTitle = value;
		}
	} else if(tag == "T2") {
		item.backupPublicationTitle = value;
	} else if(tag == "A1" || tag == "AU") {
		// primary author (patent: inventor)
		// store Zotero "creator type" in temporary variable
		var tempType;
		if (item.itemType == "patent") {
			tempType = "inventor";
		} else {
			tempType = "author";
		}
		var names = value.split(/, ?/);
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:tempType});
	} else if(tag == "ED") {
		var names = value.split(/, ?/);
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:"editor"});
	} else if(tag == "A2") {
		// contributing author (patent: assignee)
		if (item.itemType == "patent") {
			if (item.assignee) {
				// Patents can have multiple assignees (applicants) but Zotero only allows a single
				// assignee field, so we  have to concatenate them together
				item.assignee += ", "+value;
			} else {
				item.assignee =  value;
			}
		} else {
			var names = value.split(/, ?/);
			item.creators.push({lastName:names[0], firstName:names[1], creatorType:"contributor"});
		}
	} else if(tag == "Y1" || tag == "PY") {
		// year or date
		var dateParts = value.split("/");

		if(dateParts.length == 1) {
			// technically, if there's only one date part, the file isn't valid
			// RIS, but EndNote writes this, so we have to too
			// Nick: RIS spec example records also only contain a single part
			// even though it says the slashes are not optional (?)
			item.date = value;
		} else {
			// in the case that we have a year and other data, format that way

			var month = parseInt(dateParts[1]);
			if(month) {
				month--;
			} else {
				month = undefined;
			}

			item.date = Zotero.Utilities.formatDate({year:dateParts[0],
								  month:month,
								  day:dateParts[2],
								  part:dateParts[3]});
		}
	} else if(tag == "Y2") {
		// the secondary date field can mean two things, a secondary date, or an
		// invalid EndNote-style date. let's see which one this is.
		// patent: application (filing) date -- do not append to date field 
		var dateParts = value.split("/");
		if(dateParts.length != 4 && item.itemType != "patent") {
			// an invalid date and not a patent. 
			// It's from EndNote or Delphion (YYYY-MM-DD)
			if(item.date && value.indexOf(item.date) == -1) {
				// append existing year
				value += " " + item.date;
			}
			item.date = value;
		} else if (item.itemType == "patent") {
				// Date-handling code copied from above
			if(dateParts.length == 1) {
				// technically, if there's only one date part, the file isn't valid
				// RIS, but EndNote writes this, so we have to too
				// Nick: RIS spec example records also only contain a single part
				// even though it says the slashes are not optional (?)
				item.filingDate = value;
			} else {
				// in the case that we have a year and other data, format that way

				var month = parseInt(dateParts[1]);
				if(month) {
					month--;
				} else {
					month = undefined;
				}

				item.filingDate = Zotero.Utilities.formatDate({year:dateParts[0],
								  month:month,
								  day:dateParts[2],
								  part:dateParts[3]});
			}
		} 
		// ToDo: Handle correctly formatted Y2 fields (secondary date)
	} else if(tag == "N1" || tag == "AB") {
		// notes
		if(value != item.title) {       // why does EndNote do this!?
			item.notes.push({note:value});
		}
	} else if(tag == "N2") {
		// abstract
		item.abstractNote = value;
	} else if(tag == "KW") {
		// keywords/tags
		
		// technically, treating newlines as new tags breaks the RIS spec, but
		// it's required to work with EndNote
		item.tags = item.tags.concat(value.split("\n"));
	} else if(tag == "SP") {
		// start page
		if(!item.pages) {
			item.pages = value;
			// EndNote uses SP without EP for number of pages
			// Save as numPages only if there were no previous pages tags
			if (item.itemType == "book") item.numPages = value;
		} else if(item.pages[0] == "-") {       // already have ending page
			item.pages = value + item.pages;
		} else {	// multiple ranges? hey, it's a possibility
			item.pages += ", "+value;
		}
	} else if(tag == "EP") {
		// end page
		if(value) {
			if(!item.pages) {
				item.pages = value;
			} else if(value != item.pages) {
				item.pages += "-"+value;
				// EndNote uses SP without EP for number of pages
				// Here, clear numPages if we have an EP != SP
				if (item.itemType == "book") item.numPages = undefined;
			}
		}
	} else if(tag == "SN") {
		// ISSN/ISBN - just add both
		// TODO We should be able to tell these apart
		if(!item.ISBN) {
			item.ISBN = value;
		}
		if(!item.ISSN) {
			item.ISSN = value;
		}
	} else if(tag == "UR" || tag == "L1" || tag == "L2" || tag == "L4") {
		// URL
		if(!item.url) {
			item.url = value;
		}
		if(tag == "UR") {
			item.attachments.push({url:value});
		} else if(tag == "L1") {
			item.attachments.push({url:value, mimeType:"application/pdf",
				title:"Full Text (PDF)", downloadable:true});
		} else if(tag == "L2") {
			item.attachments.push({url:value, mimeType:"text/html",
				title:"Full Text (HTML)", downloadable:true});
		} else if(tag == "L4") {
			item.attachments.push({url:value,
				title:"Image", downloadable:true});
		}
	} else if (tag == "IS") {
		// Issue Number (patent: patentNumber)
		if (item.itemType == "patent") {
			item.patentNumber = value;
		} else {
			item.issue = value;
		}
	} else if (tag == "VL") {
		// Volume Number (patent: applicationNumber)
		if (item.itemType == "patent") {
			item.applicationNumber = value;
		// Report Number (report: reportNumber)
		} else if(item.itemType == "report") {
			item.reportNumber = value;
		} else {
			item.volume = value;
		}
	} else if (tag == "PB") {
		// publisher (patent: references)
		if (item.itemType == "patent") {
			item.references = value;
		} else {
			item.publisher = value;
		}
	} else if (tag == "M1" || tag == "M2") {
		// Miscellaneous fields
		if (!item.extra) {
			item.extra = value;
		} else {
			item.extra += "; "+value;
		}
	}
}

function completeItem(item) {
	// if backup publication title exists but not proper, use backup
	// (hack to get newspaper titles from EndNote)
	if(item.backupPublicationTitle) {
		if(!item.publicationTitle) {
			item.publicationTitle = item.backupPublicationTitle;
		}
		item.backupPublicationTitle = undefined;
	}
	// hack for sites like Nature, which only use JA, journal abbreviation
	if(item.journalAbbreviation && !item.publicationTitle){
		item.publicationTitle = item.journalAbbreviation;
	}
	item.complete();
}

function doImport(attachments) {
	var line = true;
	var tag = data = false;
	do {    // first valid line is type
		line = Zotero.read();
		line = line.replace(/^\s+/, "");
	} while(line !== false && !line.substr(0, 6).match(/^TY {1,2}- /));

	var item = new Zotero.Item();
	var i = 0;
	if(attachments && attachments[i]) {
		item.attachments = attachments[i];
	}

	var tag = "TY";
	
	// Handle out-of-spec old EndNote exports
	if (line.substr(0, 5) == "TY - ") {
		var data = line.substr(5);
	}
	else {
		var data = line.substr(6);
	}
	
	var rawLine;
	while((rawLine = Zotero.read()) !== false) {    // until EOF
		// trim leading space if this line is not part of a note
		line = rawLine.replace(/^\s+/, "");
		if(line.substr(2, 4) == "  - " || line == "ER  -" || line.substr(0, 5) == "TY - ") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				Zotero.debug("tag: '"+tag+"'; data: '"+data+"'");
				processTag(item, tag, data);
			}

			// then fetch the tag and data from this line
			tag = line.substr(0,2);
			
			// Handle out-of-spec old EndNote exports
			if (line.substr(0, 5) == "TY - ") {
				data = line.substr(5);
			}
			else {
				data = line.substr(6);
			}

			if(tag == "ER") {	       // ER signals end of reference
				// unset info
				tag = data = false;
				// new item
				completeItem(item);
				item = new Zotero.Item();
				i++;
				if(attachments && attachments[i]) {
					item.attachments = attachments[i];
				}
			}
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag == "N1" || tag == "N2" || tag == "AB" || tag == "KW") {
				// preserve line endings for N1/N2/AB fields, for EndNote
				// compatibility
				data += "\n"+rawLine;
			} else if(tag) {
				// otherwise, follow the RIS spec
				if(data[data.length-1] == " ") {
					data += rawLine;
				} else {
					data += " "+rawLine;
				}
			}
		}
	}

	if(tag && tag != "ER") {	// save any unprocessed tags
		Zotero.debug(tag);
		processTag(item, tag, data);
		completeItem(item);
	}
}

function addTag(tag, value) {
	if(value) {
		Zotero.write(tag+"  - "+value+"\r\n");
	}
}

function doExport() {
	var item;

	while(item = Zotero.nextItem()) {
		// can't store independent notes in RIS
		if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}

		// type
		addTag("TY", typeMap[item.itemType] ? typeMap[item.itemType] : "GEN");

		// use field map
		if (item.itemType == "bookSection" || item.itemType == "conferencePaper") {
			for(var j in bookSectionFieldMap) {
				if(item[bookSectionFieldMap[j]]) addTag(j, item[bookSectionFieldMap[j]]);
			}
		} else {
			for(var j in fieldMap) {
				if(item[fieldMap[j]]) addTag(j, item[fieldMap[j]]);
			}
		}

		// creators
		for(var j in item.creators) {
			// only two types, primary and secondary
			var risTag;
			// authors and inventors are primary creators
			if (item.creators[j].creatorType == "author" || item.creators[j].creatorType == "inventor") {
				risTag = "A1";
			} else if (item.creators[j].creatorType == "editor") {
				risTag = "ED";
			} else {
				risTag = "A2";
			}

			var names = [];
			if (item.creators[j].lastName) names.push(item.creators[j].lastName);
			if (item.creators[j].firstName) names.push(item.creators[j].firstName);

			addTag(risTag, names.join(","));
		}
		
		// assignee (patent)
		if(item.assignee) {
			addTag("A2", item.assignee);
		}
		
		// volume (patent: applicationNumber, report: reportNumber)
		if(item.volume || item.applicationNumber || item.reportNumber) {
			if (item.volume) {
				var value = item.volume;
			} else if(item.applicationNumber) {
				var value = item.applicationNumber;
			} else if(item.reportNumber) {
				var value = item.reportNumber;
			}
			addTag("VL", value);
		}
		
		// issue (patent: patentNumber)
		if(item.issue || item.patentNumber) {
			var value = (item.issue) ? item.issue : item.patentNumber;
			addTag("IS", value);
		}

		// publisher (patent: references)
		if(item.publisher || item.references) {
			var value = (item.publisher) ? item.publisher : item.references;
			addTag("PB", value);
		}


		// date
		if(item.date) {
			var date = Zotero.Utilities.strToDate(item.date);
			var string = date.year+"/";
			if(date.month != undefined) {
				// deal with javascript months
				date.month++;
				if(date.month < 10) string += "0";
				string += date.month;
			}
			string += "/";
			if(date.day != undefined) {
				if(date.day < 10) string += "0";
				string += date.day;
			}
			string += "/";
			if(date.part != undefined) {
				string += date.part;
			}
			addTag("PY", string);
		}
		
		// filingDate (patents)
		if(item.filingDate) {
			var date = Zotero.Utilities.strToDate(item.filingDate);
			var string = date.year+"/";
			if(date.month != undefined) {
				// deal with javascript months
				date.month++;
				if(date.month < 10) string += "0";
				string += date.month;
			}
			string += "/";
			if(date.day != undefined) {
				if(date.day < 10) string += "0";
				string += date.day;
			}
			string += "/";
			if(date.part != undefined) {
				string += date.part;
			}
			addTag("Y2", string);
		}

		// notes
		if(Zotero.getOption("exportNotes")) {
			for(var j in item.notes) {
				addTag("N1", item.notes[j].note.replace(/(?:\r\n?|\n)/g, "\r\n"));
			}
		}

		if(item.abstractNote) {
			addTag("N2", item.abstractNote.replace(/(?:\r\n?|\n)/g, "\r\n"));
		}
		else if(item["abstract"]) {
			// patent type has abstract
			addTag("N2", item["abstract"].replace(/(?:\r\n?|\n)/g, "\r\n"));
		}

		// tags
		for each(var tag in item.tags) {
			addTag("KW", tag.tag);
		}

		// pages
		if(item.pages) {
			if(item.itemType == "book") {
				addTag("EP", item.pages);
			} else {
				var range = Zotero.Utilities.getPageRange(item.pages);
				addTag("SP", range[0]);
				addTag("EP", range[1]);
			}
		}

		// ISBN/ISSN
		addTag("SN", item.ISBN);
		addTag("SN", item.ISSN);

		// URL
		if(item.url) {
			addTag("UR", item.url);
		} else if(item.source && item.source.substr(0, 7) == "http://") {
			addTag("UR", item.source);
		}

		Zotero.write("ER  - \r\n\r\n");
	}
}
