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
		if(this._cache[item.id]) return this._cache[item.id];
		var zoteroItem = item;
	} else {
		// is an item ID
		if(this._cache[item]) return this._cache[item];
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
	
	this._cache[zoteroItem.id] = cslItem;
	return cslItem;
};

Zotero.Cite.System.retrieveLocale = function(lang) {
	var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
	xhr.open("GET", "chrome://zotero/content/locale/csl/locales-"+lang+".xml", false);
	xhr.overrideMimeType("application/octet-stream");
	try {
		xhr.send();
		return xhr.responseText;
	} catch(e) {
		return false;
	}
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
		// TODO CSS
		return bib[0].bibstart+bib[1].join("")+bib[0].bibend;
	} else if(format == "text") {
		return bib[0].bibstart+bib[1].join("")+bib[0].bibend;
	} else if(format == "rtf") {
		var bibStyle = Zotero.Cite.getBibliographyFormatParameters(bib);
		
		var preamble = (tabStops.length ? "\\tx"+tabStops.join(" \\tx")+" " : "");
		preamble += "\\li"+indent+" \\fi"+firstLineIndent+" "
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

Zotero.Cite._monthStrings = false;
Zotero.Cite.getMonthStrings = function(form, locale) {
	if(Zotero.Cite._monthStrings){ 
		return Zotero.Cite._monthStrings[form];
	} else {
		Zotero.Cite._monthStrings = {"long":[], "short":[]};
		
		var sys = {'xml':new Zotero.CiteProc.CSL.System.Xml.Parsing()};
		if(!locale) locale = Zotero.locale;
		
		var cslLocale = Zotero.CiteProc.CSL.localeResolve(Zotero.locale);
		if(!Zotero.CiteProc.CSL.locale[cslLocale.best]) {
			let localexml = sys.xml.makeXml(Zotero.Cite.System.retrieveLocale(cslLocale.best));
			if(!localexml) {
				if(localexml == "en-US") {
					throw "No locales.xml file could be found for the preferred locale or for en-US. "+
					      "Please ensure that the locales directory exists and is properly populated";
				} else {
					let localexml = sys.xml.makeXml(Zotero.Cite.System.retrieveLocale(cslLocale.bare));
					if(!localexml) {
						Zotero.log("No locale "+cslLocale.best+"; using en-US", "warning");
						return Zotero.Cite.getMonthStrings(form, "en-US");
					}
				}
			}
			Zotero.CiteProc.CSL.localeSet.call(Zotero.CiteProc.CSL, sys, localexml, cslLocale.best, cslLocale.best);
		}
		
		var locale = Zotero.CiteProc.CSL.locale[cslLocale.best];
		if(!locale) {
			Zotero.log("No locale "+cslLocale.best+"; using en-US", "warning");
			return Zotero.Cite.getMonthStrings(form, "en-US");
		}
		
		for(let i=1; i<=12; i++) {
			let term = locale.terms["month-"+(i<10 ? "0" : "")+i];
			if(term) {
				Zotero.Cite._monthStrings["long"][i-1] = term["long"];
				Zotero.Cite._monthStrings["short"][i-1] = (term["short"] ? term["short"].replace(".", "", "g") : term["long"]);
			} else {
				Zotero.log("No month "+i+" specified for locale "+cslLocale.best, "warning");
			}
		}
		return Zotero.Cite._monthStrings[form];
	}
}