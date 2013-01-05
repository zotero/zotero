Zotero.Cite = function(){}
Zotero.Cite.System = function(){};

Zotero.Cite.System._quotedRegexp = /^".+"$/;

// TODO: Clear this cache from time to time
Zotero.Cite.System._cache = new Object();

Zotero.Cite.System.retrieveItem = function(item) {
	var zoteroItem, slashIndex;
	if(item instanceof Zotero.Item) {
		//if(this._cache[item.id]) return this._cache[item.id];
		zoteroItem = item;
	} else {
		var type = typeof item;
		if(type === "string" && (slashIndex = item.indexOf("/")) !== -1) {
			// is an embedded item
			var sessionID = item.substr(0, slashIndex);
			var session = Zotero.Integration.sessions[sessionID]
			if(session) {
				var embeddedCitation = session.embeddedItems[item.substr(slashIndex+1)];
				if(embeddedCitation) {
					embeddedCitation.id = item;
					return embeddedCitation;
				}
			}
		} else {
			// is an item ID
			//if(this._cache[item]) return this._cache[item];
			zoteroItem = Zotero.Items.get(item);
		}
	}

	if(!zoteroItem) {
		throw "Zotero.Cite.getCSLItem called to wrap a non-item "+item;
	}

	// don't return URL or accessed information for journal articles if a
	// pages field exists
	var itemType = Zotero.ItemTypes.getName(zoteroItem.itemTypeID);
	var cslType = CSL_TYPE_MAPPINGS[itemType];
	if(!cslType) cslType = "article";
	var ignoreURL = ((zoteroItem.getField("accessDate", true, true) || zoteroItem.getField("url", true, true)) &&
			["journalArticle", "newspaperArticle", "magazineArticle"].indexOf(itemType) !== -1
			&& zoteroItem.getField("pages")
			&& !Zotero.Prefs.get("export.citePaperJournalArticleURL"));

	var cslItem = {
		'id':zoteroItem.id,
		'type':cslType,
		'multi':{
			'main':{},
			'_keys':{}
		}
	};

	if (!zoteroItem.libraryID) {
		cslItem.system_id = "0_" + zoteroItem.key;
	} else {
		cslItem.system_id = zoteroItem.libraryID + "_" + zoteroItem.key;
	}

	// get all text variables (there must be a better way)
	for(var variable in CSL_TEXT_MAPPINGS) {
		var fields = CSL_TEXT_MAPPINGS[variable];
		if(variable == "URL" && ignoreURL) continue;
		for each(var field in fields) {
			var value = zoteroItem.getField(field, false, true).toString();
			var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(zoteroItem.itemTypeID, field);
			if (!fieldID) {
				var fieldID = Zotero.ItemFields.getID(field);
			}
			if(value != "") {
				// Strip enclosing quotes
				if(value.match(Zotero.Cite.System._quotedRegexp)) {
					value = value.substr(1, value.length-2);
				}
				cslItem[variable] = value;
				if (zoteroItem.multi.main[fieldID]) {
					cslItem.multi.main[variable] = zoteroItem.multi.main[fieldID]
				}
				if (zoteroItem.multi._keys[fieldID]) {
					cslItem.multi._keys[variable] = {};
					for (var langTag in zoteroItem.multi._keys[fieldID]) {
						cslItem.multi._keys[variable][langTag] = zoteroItem.multi._keys[fieldID][langTag];
					}
				}
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

		var creatorType = CSL_NAMES_MAPPINGS[creatorType];
		if(!creatorType) continue;

		if (Zotero.Prefs.get('csl.enableInstitutionFormatting')) {
			var nameObj = {
				'family':creator.ref.lastName, 
				'given':creator.ref.firstName,
				'isInstitution': creator.ref.fieldMode
			}
		} else {
			var nameObj = {
				'family':creator.ref.lastName, 
				'given':creator.ref.firstName
			}
		}
		
		if (!nameObj.multi) {
			nameObj.multi = {};
			nameObj.multi._key = {};
			nameObj.multi.main = creator.multi.main;
		}
		for (var langTag in creator.multi._key) {
			if (Zotero.Prefs.get('csl.enableInstitutionFormatting')) {
				nameObj.multi._key[langTag] = {
					'family':creator.multi.get('lastName', langTag),
					'given':creator.multi.get('firstName', langTag),
					'isInstitution': creator.ref.fieldMode
				};
			} else {
				nameObj.multi._key[langTag] = {
					'family':creator.multi.get('lastName', langTag),
					'given':creator.multi.get('firstName', langTag)
				};
			}
			
		}

		if(cslItem[creatorType]) {
			cslItem[creatorType].push(nameObj);
		} else {
			cslItem[creatorType] = [nameObj];
		}
	}

	// get date variables
	for(var variable in CSL_DATE_MAPPINGS) {
		var date = zoteroItem.getField(CSL_DATE_MAPPINGS[variable], false, true);
		if(date) {
			if (Zotero.Prefs.get('hackUseCiteprocJsDateParser')) {
				var raw = Zotero.Date.multipartToStr(date);
				cslItem[variable] = {raw: raw, "date-parts":[dateParts]};
			} else {
				var dateObj = Zotero.Date.strToDate(date);
				// otherwise, use date-parts
				var dateParts = [];
				if(dateObj.year) {
					// add year, month, and day, if they exist
					dateParts.push(dateObj.year);
					if("number" === typeof dateObj.month) {
						dateParts.push(dateObj.month+1);
						if(dateObj.day) {
							dateParts.push(dateObj.day);
						}
					}
					cslItem[variable] = {"date-parts":[dateParts]};
				
					// if no month, use season as month
					if(dateObj.part && !dateObj.month) {
						cslItem[variable].season = dateObj.part;
					}
				} else {
					// if no year, pass date literally
					cslItem[variable] = {"literal":date};
				}
			}
		}
	}

    // Force Fields
    if (CSL_FORCE_FIELD_CONTENT[itemType]) {
        for (var variable in CSL_FORCE_FIELD_CONTENT[itemType]) {
            cslItem[variable] = CSL_FORCE_FIELD_CONTENT[itemType][variable];
        }
    }

	// Force remap
	if (CSL_FORCE_REMAP[itemType]) {
		for (var variable in CSL_FORCE_REMAP[itemType]) {
			cslItem[CSL_FORCE_REMAP[itemType][variable]] = cslItem[variable];
			delete cslItem[variable];
		}
	}

	//this._cache[zoteroItem.id] = cslItem;
	return cslItem;
};

Zotero.Cite.System.retrieveLocale = function(lang) {
	var protHandler = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
		.createInstance(Components.interfaces.nsIProtocolHandler);
	try {
		var channel = protHandler.newChannel(protHandler.newURI("chrome://zotero/content/locale/csl/locales-"+lang+".xml", "UTF-8", null));
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

Zotero.Cite.System.wrapCitationEntryHtml = function (str, item_id, locator_txt, suffix_txt) {
	if (!locator_txt) {
		locator_txt = "";
	}
	if (!suffix_txt) {
		suffix_txt = "";
	}
	return Zotero.Prefs.get("export.quickCopy.citationWrapperHtml")
		.replace("%%STRING%%", str)
		.replace("%%LOCATOR%%", locator_txt)
		.replace("%%SUFFIX%%", suffix_txt)
		.replace("%%ITEM_ID%%", item_id);
}

Zotero.Cite.System.wrapCitationEntryText = function (str, item_id, locator_txt, suffix_txt) {
	if (!locator_txt) {
		locator_txt = "";
	}
	if (!suffix_txt) {
		suffix_txt = "";
	}
	return Zotero.Prefs.get("export.quickCopy.citationWrapperText")
		.replace("%%STRING%%", str)
		.replace("%%LOCATOR%%", locator_txt)
		.replace("%%SUFFIX%%", suffix_txt)
		.replace("%%ITEM_ID%%", item_id);
}

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

/**
 * Makes a formatted bibliography, if the style defines one; otherwise makes a formatted list of
 * items
 * @param {Zotero.Style} style The style to use
 * @param {Zotero.Item[]} items An array of items
 * @param {String} format The format of the output
 * @param {Boolean} asCitationList Whether to return a list of formatted citations even if
 *    the style defines a bibliography
 */
Zotero.Cite.makeFormattedBibliographyOrCitationList = function(style, items, format, asCitationList) {
	var cslEngine = style.csl;
	cslEngine.setOutputFormat(format);
	cslEngine.updateItems([item.id for each(item in items)]);
	
	if(!asCitationList) {
		var bibliography = Zotero.Cite.makeFormattedBibliography(cslEngine, format);
		if(bibliography) return bibliography;
	}
	
	var styleClass = style.class;
	var citations = [cslEngine.appendCitationCluster({"citationItems":[{"id":item.id}], "properties":{}}, true)[0][1]
		for each(item in items)];
	
	if(styleClass == "note") {
		if(format == "html") {
			return "<ol>\n\t<li>"+citations.join("</li>\n\t<li>")+"</li>\n</ol>";
		} else if(format == "text") {
			var output = [];
			for(var i=0; i<citations.length; i++) {
				output.push((i+1)+". "+citations[i]+"\r\n");
			}
			return output.join("");
		} else if(format == "rtf") {
			var output = ["{\\rtf \n{\\*\\listtable{\\list\\listtemplateid1\\listhybrid{\\listlevel"+
				"\\levelnfc0\\levelnfcn0\\leveljc0\\leveljcn0\\levelfollow0\\levelstartat1"+
				"\\levelspace360\\levelindent0{\\*\\levelmarker \\{decimal\\}.}{\\leveltext"+
				"\\leveltemplateid1\\'02\\'00.;}{\\levelnumbers\\'01;}\\fi-360\\li720\\lin720 }"+
				"{\\listname ;}\\listid1}}\n{\\*\\listoverridetable{\\listoverride\\listid1"+
				"\\listoverridecount0\\ls1}}\n\\tx720\\li720\\fi-480\\ls1\\ilvl0\n"];
			for(var i=0; i<citations.length; i++) {
				output.push("{\\listtext "+(i+1)+".	}"+citations[i]+"\\\n");
			}
			output.push("}");
			return output.join("");
		} else {
			throw "Unimplemented bibliography format "+format;
		}
	} else {
		if(format == "html") {
			return citations.join("<br />");
		} else if(format == "text") {
			return citations.join("\r\n");
		} else if(format == "rtf") {
			return "<\\rtf \n"+citations.join("\\\n")+"\n}";
		}
	}
}

/**
 * Makes a formatted bibliography
 * @param {Zotero.Style} style The style
 * @param {Zotero.Item[]} items An array of items
 */
Zotero.Cite.makeFormattedBibliography = function(cslEngine, format) {
	cslEngine.setOutputFormat(format);
	var bib = cslEngine.makeBibliography();
	if(!bib) return false;

	if(format == "html") {
		var output = [bib[0].bibstart];
		for(var i in bib[1]) {
			output.push(bib[1][i]);
			
			// add COinS
			for each(var itemID in bib[0].entry_ids[i]) {
				try {
					var co = Zotero.OpenURL.createContextObject(Zotero.Items.get(itemID), "1.0");
					if(!co) continue;
					output.push('  <div class="forget-me-not" style="hidden:true;"><span class="Z3988" title="'+
						co.replace("&", "&amp;", "g").replace("<", "&lt;", "g").replace(">", "&gt;", "g")+
						'"/><spanclosetaghack/></div>\n');
				} catch(e) {
					Zotero.logError(e);
				}
			}
		}
		output.push(bib[0].bibend);
		var html = output.join("");

		
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
		
		var str;
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
			
			var leftMarginDivs = xml..div.(@class == "csl-left-margin");
			var clearEntries = leftMarginDivs.length() > 0;
			
			// csl-entry
			var divs = xml..div.(@class == "csl-entry");
			var num = divs.length();
			var i = 0;
			for each(var div in divs) {
				var first = i == 0;
				var last = i == num - 1;
				
				if (clearEntries) {
					div.@style += "clear: left; ";
				}
				
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
			for each(var div in leftMarginDivs) {
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
			str = xml.toXMLString().replace("/><spanclosetaghack/>", "></span>", "g");
		} finally {
			XML.prettyPrinting = true;
			XML.ignoreWhitespace = true;
		}
		
		return str;
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

/**
 * Get an item by ID, either by retrieving it from the library or looking for the document it
 * belongs to.
 * @param {String|Number|Array} id
 */
Zotero.Cite.getItem = function(id) {
	var slashIndex;
	
	if(id instanceof Array) {
		return [Zotero.Cite.getItem(anId) for each(anId in id)];
	} else if(typeof id === "string" && (slashIndex = id.indexOf("/")) !== -1) {		
		var sessionID = id.substr(0, slashIndex),
			session = Zotero.Integration.sessions[sessionID],
			item;
		if(session) {
			item = session.embeddedZoteroItems[id.substr(slashIndex+1)];
		}
		
		if(!item) {
			item = new Zotero.Item("document");
			item.setField("title", "Missing Item");
			Zotero.log("CSL item "+id+" not found");
		}
		return item;
	} else {
		return Zotero.Items.get(id);
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

