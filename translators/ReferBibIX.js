{
	"translatorID":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"translatorType":3,
	"label":"Refer/BibIX",
	"creator":"Simon Kornblith",
	"target":"txt",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"configOptions":{"dataMode":"line"},
	"displayOptions":{"exportCharset":"UTF-8"},
	"inRepository":true,
	"lastUpdated":"2011-01-11 04:31:00"
}

function detectImport() {
	var lineRe = /%[A-Z0-9\*\$] .+/;
	var line;
	var matched = 0;
	while((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(lineRe.test(line)) {
				matched++;
				if(matched == 2) {
					// threshold is two lines
					return true;
				}
			} else {
				return false;
			}
		}
	}
}

var fieldMap = {
	T:"title",
	S:"series",
	V:"volume",
	N:"issue",
	C:"place",
	I:"publisher",
	R:"type",
	P:"pages",
	W:"archiveLocation",
	"*":"rights",
	"@":"ISBN",
	L:"callNumber",
	M:"accessionNumber",
	U:"url",
	7:"edition",
	X:"abstractNote"
};

var inputFieldMap = {
	J:"publicationTitle",
	B:"publicationTitle",
	9:"type"
};

// TODO: figure out if these are the best types for personal communication
var typeMap = {
	book:"Book",
	bookSection:"Book Section",
	journalArticle:"Journal Article",
	magazineArticle:"Magazine Article",
	newspaperArticle:"Newspaper Article",
	thesis:"Thesis",
	letter:"Personal Communication",
	manuscript:"Unpublished Work",
	interview:"Personal Communication",
	film:"Film or Broadcast",
	artwork:"Artwork",
	webpage:"Web Page",
	report:"Report",
	bill:"Bill",
	"case":"Case",
	hearing:"Hearing",
	patent:"Patent",
	statute:"Statute",
	email:"Personal Communication",
	map:"Map",
	blogPost:"Web Page",
	instantMessage:"Personal Communication",
	forumPost:"Web Page",
	audioRecording:"Audiovisual Material",
	presentation:"Report",
	videoRecording:"Audiovisual Material",
	tvBroadcast:"Film or Broadcast",
	radioBroadcast:"Film or Broadcast",
	podcast:"Audiovisual Material",
	computerProgram:"Computer Program",
	conferencePaper:"Conference Paper",
	document:"Generic",
	encyclopediaArticle:"Encyclopedia",
	dictionaryEntry:"Dictionary"
};

// supplements outputTypeMap for importing
// TODO: BILL, CASE, COMP, CONF, DATA, HEAR, MUSIC, PAT, SOUND, STAT
var inputTypeMap = {
	"Ancient Text":"book",
	"Audiovisual Material":"videoRecording",
	"Generic":"book",
	"Chart or Table":"artwork",
	"Classical Work":"book",
	"Conference Proceedings":"conferencePaper",
	"Conference Paper":"conferencePaper",
	"Edited Book":"book",
	"Electronic Article":"journalArticle",
	"Electronic Book":"book",
	"Equation":"artwork",
	"Figure":"artwork",
	"Government Document":"document",
	"Grant":"document",
	"Legal Rule or Regulation":"statute",
	"Online Database":"webpage",
	"Online Multimedia":"webpage",
	"Electronic Source":"webpage"
};

var isEndNote = false;

function processTag(item, tag, value) {
	value = Zotero.Utilities.trim(value);
	if(fieldMap[tag]) {
		item[fieldMap[tag]] = value;
	} else if(inputFieldMap[tag]) {
		item[inputFieldMap[tag]] = value;
	} else if(tag == "0") {
		if(inputTypeMap[value]) {	// first check inputTypeMap
			item.itemType = inputTypeMap[value]
		} else {					// then check typeMap
			for(var i in typeMap) {
				if(value == typeMap[i]) {
					item.itemType = i;
					break;
				}
			}
			// fall back to generic
			if(!item.itemType) item.itemType = inputTypeMap["Generic"];
		}
	} else if(tag == "A" || tag == "E" || tag == "?") {
		if(tag == "A") {
			var type = "author";
		} else if(tag == "E") {
			var type = "editor";
		} else if(tag == "?") {
			var type = "translator";
		}
		
		item.creators.push(Zotero.Utilities.cleanAuthor(value, type, value.indexOf(",") != -1));
	} else if(tag == "Q") {
		item.creators.push({creatorType:"author", lastName:value, fieldMode:true});
	} else if(tag == "H" || tag == "O") {
		item.extra += "\n"+value;
	} else if(tag == "Z") {
		item.notes.push({note:value});
	} else if(tag == "D") {
		if(item.date) {
			if(item.date.indexOf(value) == -1) {
				item.date += " "+value;
			}
		} else {
			item.date = value;
		}
	} else if(tag == "8") {
		if(item.date) {
			if(value.indexOf(item.date) == -1) {
				item.date += " "+value;
			}
		} else {
			item.date = value;
		}
	} else if(tag == "K") {
		item.tags = value.split("\n");
	}
}

function doImport() {
	var line = true;
	var tag = data = false;
	do {	// first valid line is type
		Zotero.debug("ignoring "+line);
		line = Zotero.read();
		line = line.replace(/^\s+/, "");
	} while(line !== false && line[0] != "%");
	
	var item = new Zotero.Item();
	
	var tag = line[1];
	var data = line.substr(3);
	while((line = Zotero.read()) !== false) {	// until EOF
		line = line.replace(/^\s+/, "");
		if(!line) {
			if(tag) {
				processTag(item, tag, data);
				// unset info
				tag = data = readRecordEntry = false;
				// new item
				item.complete();
				item = new Zotero.Item();
			}
		} else if(line[0] == "%" && line[2] == " ") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				processTag(item, tag, data);
			}
			
			// then fetch the tag and data from this line
			tag = line[1];
			data = line.substr(3);
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag) {
				data += "\n"+line;
			}
		}
	}
	
	if(tag) {	// save any unprocessed tags
		processTag(item, tag, data);
		item.complete();
	}
}

function addTag(tag, value) {
	if(value) {
		Zotero.write("%"+tag+" "+value+"\r\n");
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
		addTag("0", typeMap[item.itemType] ? typeMap[item.itemType] : "Generic");
		
		// use field map
		for(var j in fieldMap) {
			if(item[fieldMap[j]]) addTag(j, item[fieldMap[j]]);
		}
		
		//handle J & B tags correctly
		if (item["publicationTitle"]) {
			if (item.itemType == "journalArticle") {
				addTag("J", item["publicationTitle"]);
			} else {
				addTag("B", item["publicationTitle"]);
			}
		}
		
		// creators
		for(var j in item.creators) {
			var referTag = "A";
			if(item.creators[j].creatorType == "editor") {
				referTag = "E";
			} else if(item.creators[j].creatorType == "translator") {
				referTag = "?";
			}
			
			addTag(referTag, item.creators[j].lastName+(item.creators[j].firstName ? ", "+item.creators[j].firstName : ""));
		}
		
		// date
		addTag("D", item.date);
		
		// tags
		if(item.tags) {
			var keywordTag = "";
			for each(var tag in item.tags) {
				keywordTag += "\r\n"+tag.tag;
			}
			addTag("K", keywordTag.substr(2));
		}
		Zotero.write("\r\n");
	}
}