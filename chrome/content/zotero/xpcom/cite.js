Zotero.Cite = function(){}
Zotero.Cite.System = function(){};

/**
 * Mappings for names
 * Note that this is the reverse of the text variable map, since all mappings should be one to one
 * and it makes the code cleaner
 */
Zotero.Cite.System._zoteroNameMap = {
	"author":"author",
	"editor":"editor",
	"translator":"translator",
	"seriesEditor":"collection-editor",
	"bookAuthor":"container-author"
}

/**
 * Mappings for text variables
 */
Zotero.Cite.System._zoteroFieldMap = {
	"title":["title"],
	"container-title":["publicationTitle",  "reporter", "code"], /* reporter and code should move to SQL mapping tables */
	"collection-title":["seriesTitle", "series"],
	"collection-number":["seriesNumber"],
	"publisher":["publisher", "distributor"], /* distributor should move to SQL mapping tables */
	"publisher-place":["place"],
	"authority":["court"],
	"page":["pages"],
	"volume":["volume"],
	"issue":["issue"],
	"number-of-volumes":["numberOfVolumes"],
	"number-of-pages":["numPages"],
	"edition":["edition"],
	"version":["version"],
	"section":["section"],
	"genre":["type", "artworkSize"], /* artworkSize should move to SQL mapping tables, or added as a CSL variable */
	"medium":["medium"],
	"archive":["archive"],
	"archive_location":["archiveLocation"],
	"event":["meetingName", "conferenceName"], /* these should be mapped to the same base field in SQL mapping tables */
	"event-place":["place"],
	"abstract":["abstractNote"],
	"URL":["url"],
	"DOI":["DOI"],
	"ISBN":["ISBN"],
	"call-number":["callNumber"],
	"note":["extra"],
	"number":["number"],
	"references":["history"],
	"shortTitle":["shortTitle"],
	"journalAbbreviation":["journalAbbreviation"]
}

Zotero.Cite.System._zoteroDateMap = {
	"issued":"date",
	"accessed":"accessDate"
}

Zotero.Cite.System._zoteroTypeMap = {
	'book':"book",
	'bookSection':'chapter',
	'journalArticle':"article-journal",
	'magazineArticle':"article-magazine",
	'newspaperArticle':"article-newspaper",
	'thesis':"thesis",
	'encyclopediaArticle':"entry-encyclopedia",
	'dictionaryEntry':"entry-dictionary",
	'conferencePaper':"paper-conference",
	'letter':"personal_communication",
	'manuscript':"manuscript",
	'interview':"interview",
	'film':"motion_picture",
	'artwork':"graphic",
	'webpage':"webpage",
	'report':"report",
	'bill':"bill",
	'case':"legal_case",
	'hearing':"bill",				// ??
	'patent':"patent",
	'statute':"bill",				// ??
	'email':"personal_communication",
	'map':"map",
	'blogPost':"webpage",
	'instantMessage':"personal_communication",
	'forumPost':"webpage",
	'audioRecording':"song",		// ??
	'presentation':"speech",
	'videoRecording':"motion_picture",
	'tvBroadcast':"broadcast",
	'radioBroadcast':"broadcast",
	'podcast':"song",			// ??
	'computerProgram':"book"		// ??
};

Zotero.Cite.System._quotedRegexp = /^".+"$/;

// TODO: Clear this cache from time to time
Zotero.Cite.System._cache = new Object();

Zotero.Cite.System.retrieveItem = function(item){
	if(item instanceof Zotero.Item) {
		//if(this._cache[item.id]) return this._cache[item.id];
		var zoteroItem = item;
	} else {
		// is an item ID
		//if(this._cache[item]) return this._cache[item];
		var zoteroItem = Zotero.Items.get(item);
	}

	if(!zoteroItem) {
		throw "Zotero.Cite.getCSLItem called to wrap a non-item";
	}
	
	// don't return URL or accessed information for journal articles if a
	// pages field exists
	var itemType = Zotero.ItemTypes.getName(zoteroItem.itemTypeID);
	var cslType = Zotero.Cite.System._zoteroTypeMap[itemType];
	if(!cslType) cslType = "article";
	var ignoreURL = ((zoteroItem.getField("accessDate", true, true) || zoteroItem.getField("url", true, true)) &&
			["journalArticle", "newspaperArticle", "magazineArticle"].indexOf(itemType) !== -1
			&& zoteroItem.getField("pages")
			&& !Zotero.Prefs.get("export.citePaperJournalArticleURL"));
	
	var cslItem = {
		'id':zoteroItem.id,
		'type':cslType
	};
	
	// get all text variables (there must be a better way)
	// TODO: does citeproc-js permit short forms?
	for(var variable in Zotero.Cite.System._zoteroFieldMap) {
		var fields = Zotero.Cite.System._zoteroFieldMap[variable];
		if(variable == "URL" && ignoreURL) continue;
		for each(var field in fields) {
			var value = zoteroItem.getField(field, false, true).toString();
			if(value != "") {
				// Strip enclosing quotes
				if(value.match(Zotero.Cite.System._quotedRegexp)) {
					value = value.substr(1, value.length-2);
				}
				cslItem[variable] = value;
				break;
			}
		}
	}
	
	// separate name variables
	var authorID = Zotero.CreatorTypes.getPrimaryIDForType(zoteroItem.itemTypeID);
	var creators = zoteroItem.getCreators();
	for each(var creator in creators) {
		if(creator.creatorTypeID == authorID) {
			var creatorType = "author";
		} else {
			var creatorType = Zotero.CreatorTypes.getName(creator.creatorTypeID);
		}
		
		var creatorType = Zotero.Cite.System._zoteroNameMap[creatorType];
		if(!creatorType) continue;
		
		var nameObj = {'family':creator.ref.lastName, 'given':creator.ref.firstName};
		
		if(cslItem[creatorType]) {
			cslItem[creatorType].push(nameObj);
		} else {
			cslItem[creatorType] = [nameObj];
		}
	}
	
	// get date variables
	for(var variable in Zotero.Cite.System._zoteroDateMap) {
		var date = zoteroItem.getField(Zotero.Cite.System._zoteroDateMap[variable], false, true);
		if(date) {
			date = Zotero.Date.strToDate(date);
			if(date.part && !date.month) {
				// if there's a part but no month, interpret literally
				cslItem[variable] = {"literal": date.part};
			} else {
				// otherwise, use date-parts
				var dateParts = [];
				if(date.year) {
					dateParts.push(date.year);
					if(date.month) {
						dateParts.push(date.month+1);
						if(date.day) {
							dateParts.push(date.day);
						}
					}
				}
				cslItem[variable] = {"date-parts":[dateParts]};
			}
		}
	}
	
	//this._cache[zoteroItem.id] = cslItem;
	return cslItem;
};

Zotero.Cite.System.retrieveLocale = function(lang) {
	var protHandler = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
		.createInstance(Components.interfaces.nsIProtocolHandler);
	var channel = protHandler.newChannel(protHandler.newURI("chrome://zotero/content/locale/csl/locales-"+lang+".xml", "UTF-8", null));
	try {
		var rawStream = channel.open();
	} catch(e) {
		return false;
	}
	var converterStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
						   .createInstance(Components.interfaces.nsIConverterInputStream);
	converterStream.init(rawStream, "UTF-8", 65535,
		Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	var str = {};
	converterStream.readString(channel.contentLength, str);
	converterStream.close();
	return str.value;
};

Zotero.Cite.System.getAbbreviations = function() {
	return {};
}

Zotero.Cite.removeFromBibliography = function(bib, itemsToRemove) {
	var removeItems = [];
	for(let i in bib[0].entry_ids) {
		for(let j in bib[0].entry_ids[i]) {
			if(itemsToRemove[bib[0].entry_ids[i][j]]) {
				removeItems.push(i);
				break;
			}
		}
	}
	for(let i=removeItems.length-1; i>=0; i--) {
		bib[0].entry_ids.splice(removeItems[i], 1);
		bib[1].splice(removeItems[i], 1);
	}
}

Zotero.Cite.getBibliographyFormatParameters = function(bib) {
	var bibStyle = {"tabStops":[], "indent":0, "firstLineIndent":0,
	                "lineSpacing":(240*bib[0].linespacing),
	                "entrySpacing":(240*bib[0].entryspacing)};
	if(bib[0].hangingindent) {
		bibStyle.indent = 720;				// 720 twips = 0.5 in
		bibStyle.firstLineIndent = -720;	// -720 twips = -0.5 in
	} else if(bib[0]["second-field-align"]) {
		// this is a really sticky issue. the below works for first fields that look like "[1]"
		// and "1." otherwise, i have no idea. luckily, this will be good enough 99% of the time.
		var alignAt = 24+bib[0].maxoffset*120;
		bibStyle.firstLineIndent = -alignAt;
		if(bib[0]["second-field-align"] == "margin") {
			bibStyle.tabStops = [0];
		} else {
			bibStyle.indent = alignAt;
			bibStyle.tabStops = [alignAt];
		}
	}
	
	return bibStyle;
}

Zotero.Cite.makeFormattedBibliography = function(cslEngine, format) {
	cslEngine.setOutputFormat(format);
	var bib = cslEngine.makeBibliography();
	
	if(format == "html") {
		var html = bib[0].bibstart+bib[1].join("")+bib[0].bibend;
		
		var inlineCSS = true;
		if (!inlineCSS) {
			return html;
		}
		
		//Zotero.debug("maxoffset: " + bib[0].maxoffset);
		//Zotero.debug("entryspacing: " + bib[0].entryspacing);
		//Zotero.debug("linespacing: " + bib[0].linespacing);
		//Zotero.debug("hangingindent: " + bib[0].hangingindent);
		//Zotero.debug("second-field-align: " + bib[0]["second-field-align"]);
		
		var maxOffset = parseInt(bib[0].maxoffset);
		var entrySpacing = parseInt(bib[0].entryspacing);
		var lineSpacing = parseInt(bib[0].linespacing);
		var hangingIndent = parseInt(bib[0].hangingindent);
		var secondFieldAlign = bib[0]["second-field-align"];
		
		// Validate input
		if(maxOffset == NaN) throw "Invalid maxoffset";
		if(entrySpacing == NaN) throw "Invalid entryspacing";
		if(lineSpacing == NaN) throw "Invalid linespacing";
		
		default xml namespace = ''; with({});
		try {			
			XML.prettyPrinting = false;
			XML.ignoreWhitespace = false;
			var xml = new XML(html);
			
			var multiField = !!xml..div.(@class == "csl-left-margin").length();
			
			// One of the characters is usually a period, so we can adjust this down a bit
			maxOffset = Math.max(1, maxOffset - 2);
			
			// Force a minimum line height
			if(lineSpacing <= 1.35) lineSpacing = 1.35;
			
			xml.@style += "line-height: " + lineSpacing + "; ";
			
			if(hangingIndent) {
				if (multiField && !secondFieldAlign) {
					throw ("second-field-align=false and hangingindent=true combination is not currently supported");
				}
				// If only one field, apply hanging indent on root
				else if (!multiField) {
					xml.@style += "padding-left: " + hangingIndent + "em; text-indent:-" + hangingIndent + "em;";
				}
			}
			
			// csl-entry
			var divs = xml..div.(@class == "csl-entry");
			var num = divs.length();
			var i = 0;
			for each(var div in divs) {
				var first = i == 0;
				var last = i == num - 1;
				
				if(entrySpacing) {
					if(!last) {
						div.@style += "margin-bottom: " + entrySpacing + "em;";
					}
				}
				
				i++;
			}
			
			// Padding on the label column, which we need to include when
			// calculating offset of right column
			var rightPadding = .5;
			
			// div.csl-left-margin
			for each(var div in xml..div.(@class == "csl-left-margin")) {
				div.@style = "float: left; padding-right: " + rightPadding + "em;";
				
				// Right-align the labels if aligning second line, since it looks
				// better and we don't need the second line of text to align with
				// the left edge of the label
				if (secondFieldAlign) {
					div.@style += "text-align: right; width: " + maxOffset + "em;";
				}
			}
			
			// div.csl-right-inline
			for each(var div in xml..div.(@class == "csl-right-inline")) {
				div.@style = "margin: 0 .4em 0 " + (secondFieldAlign ? maxOffset + rightPadding : "0") + "em;";
				
				if (hangingIndent) {
					div.@style += "padding-left: " + hangingIndent + "em; text-indent:-" + hangingIndent + "em;";
				}
			}
			
			// div.csl-indent
			for each(var div in xml..div.(@class == "csl-indent")) {
				div.@style = "margin: .5em 0 0 2em; padding: 0 0 .2em .5em; border-left: 5px solid #ccc;";
			}
			
			//Zotero.debug(xml);
		} finally {
			XML.prettyPrinting = true;
			XML.ignoreWhitespace = true;
		}
		
		return xml.toXMLString();
	} else if(format == "text") {
		return bib[0].bibstart+bib[1].join("")+bib[0].bibend;
	} else if(format == "rtf") {
		var bibStyle = Zotero.Cite.getBibliographyFormatParameters(bib);
		
		var preamble = (bibStyle.tabStops.length ? "\\tx"+bibStyle.tabStops.join(" \\tx")+" " : "");
		preamble += "\\li"+bibStyle.indent+" \\fi"+bibStyle.firstLineIndent+" "
		           +"\\sl"+bibStyle.lineSpacing+" \\slmult1 "
		           +"\\sa"+bibStyle.entrySpacing+" ";
		
		return bib[0].bibstart+preamble+bib[1].join("\\\r\n")+"\\\r\n"+bib[0].bibend;
	} else {
		throw "Unimplemented bibliography format "+format;
	}
}

Zotero.Cite.labels = ["page", "book", "chapter", "column", "figure", "folio",
		"issue", "line", "note", "opus", "paragraph", "part", "section", "sub verbo",
		"volume", "verse"];