"use strict";

/**
 * Utility functions for dealing with citations
 * @namespace
 */
Zotero.Cite = {
	/**
	 * Locator labels
	 */
	"labels":["page", "book", "chapter", "column", "figure", "folio",
		"issue", "line", "note", "opus", "paragraph", "part", "section", "sub verbo",
		"volume", "verse"],
	
	/**
	 * Remove specified item IDs in-place from a citeproc-js bibliography object returned
	 * by makeBibliography()
	 * @param {bib} citeproc-js bibliography object
	 * @param {Array} itemsToRemove Array of items to remove
	 */
	"removeFromBibliography":function(bib, itemsToRemove) {
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
	},

	/**
	 * Convert formatting data from citeproc-js bibliography object into explicit format
	 * parameters for RTF or word processors
	 * @param {bib} citeproc-js bibliography object
	 * @return {Object} Bibliography style parameters.
	 */
	"getBibliographyFormatParameters":function getBibliographyFormatParameters(bib) {
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
	},

	/**
	 * Makes a formatted bibliography, if the style defines one; otherwise makes a 
	 * formatted list of items
	 * @param {Zotero.Style} style The style to use
	 * @param {Zotero.Item[]} items An array of items
	 * @param {String} format The format of the output (html, text, or rtf)
	 * @return {String} Bibliography or item list in specified format
	 */
	"makeFormattedBibliographyOrCitationList":function(style, items, format, asCitationList) {
		var cslEngine = style.getCiteProc();
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
	},
	
	/**
	 * Makes a formatted bibliography
	 * @param {Zotero.Style} style The style
	 * @param {String} format The format of the output (html, text, or rtf)
	 * @return {String} Bibliography in specified format
	 */
	"makeFormattedBibliography":function makeFormattedBibliography(cslEngine, format) {
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
						output.push('  <span class="Z3988" title="'+
							co.replace("&", "&amp;", "g").replace("<", "&lt;", "g").replace(">", "&gt;", "g")+
							'"></span>\n');
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
			var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser),
				doc = parser.parseFromString("<!DOCTYPE html><html><body></body></html>", "text/html");
			doc.body.insertAdjacentHTML("afterbegin", html);
			var div = doc.body.firstChild,
				leftMarginDivs = Zotero.Utilities.xpath(doc, '//div[@class="csl-left-margin"]'),
				multiField = !!leftMarginDivs.length,
				clearEntries = multiField;
			
			// One of the characters is usually a period, so we can adjust this down a bit
			maxOffset = Math.max(1, maxOffset - 2);
			
			// Force a minimum line height
			if(lineSpacing <= 1.35) lineSpacing = 1.35;
			
			var style = div.getAttribute("style");
			if(!style) style = "";
			style += "line-height: " + lineSpacing + "; ";
			
			if(hangingIndent) {
				if (multiField && !secondFieldAlign) {
					throw ("second-field-align=false and hangingindent=true combination is not currently supported");
				}
				// If only one field, apply hanging indent on root
				else if (!multiField) {
					style += "padding-left: " + hangingIndent + "em; text-indent:-" + hangingIndent + "em;";
				}
			}
			
			if(style) div.setAttribute("style", style);
			
			// csl-entry
			var divs = Zotero.Utilities.xpath(doc, '//div[@class="csl-entry"]');
			for(var i=0, n=divs.length; i<n; i++) {
				var div = divs[i],
					divStyle = div.getAttribute("style");
				if(!divStyle) divStyle = "";
				
				if (clearEntries) {
					divStyle += "clear: left; ";
				}
				
				if(entrySpacing && i !== n - 1) {
					divStyle += "margin-bottom: " + entrySpacing + "em;";
				}
				
				if(divStyle) div.setAttribute("style", divStyle);
			}
			
			// Padding on the label column, which we need to include when
			// calculating offset of right column
			var rightPadding = .5;
			
			// div.csl-left-margin
			for each(var div in leftMarginDivs) {
				var divStyle = div.getAttribute("style");
				if(!divStyle) divStyle = "";
				
				divStyle = "float: left; padding-right: " + rightPadding + "em;";
				
				// Right-align the labels if aligning second line, since it looks
				// better and we don't need the second line of text to align with
				// the left edge of the label
				if (secondFieldAlign) {
					divStyle += "text-align: right; width: " + maxOffset + "em;";
				}
				
				div.setAttribute("style", divStyle);
			}
			
			// div.csl-right-inline
			for each(var div in Zotero.Utilities.xpath(doc, '//div[@class="csl-right-inline"]')) {
				var divStyle = div.getAttribute("style");
				if(!divStyle) divStyle = "";
				
				divStyle = "margin: 0 .4em 0 " + (secondFieldAlign ? maxOffset + rightPadding : "0") + "em;";
				
				if (hangingIndent) {
					divStyle += "padding-left: " + hangingIndent + "em; text-indent:-" + hangingIndent + "em;";
				}
				
				div.setAttribute("style", divStyle);
			}
			
			// div.csl-indent
			for each(var div in Zotero.Utilities.xpath(doc, '//div[@class="csl-indent"]')) {
				div.setAttribute("style", "margin: .5em 0 0 2em; padding: 0 0 .2em .5em; border-left: 5px solid #ccc;");
			}
			
			return doc.body.innerHTML;
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
	},

	/**
	 * Get an item by ID, either by retrieving it from the library or looking for the document it
	 * belongs to.
	 * @param {String|Number|Array} id
	 * @return {Zotero.Item} item
	 */
	"getItem":function getItem(id) {
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
};

/**
 * Get a CSL abbreviation in the format expected by citeproc-js
 */
Zotero.Cite.getAbbreviation = new function() {
	var abbreviations,
		abbreviationCategories;

	/**
	 * Initialize abbreviations database.
	 */
	function init() {
		if(!abbreviations) loadAbbreviations();
	}

	function loadAbbreviations() {
		var file = Zotero.getZoteroDirectory();
		file.append("abbreviations.json");

		var json, origin;
		if(file.exists()) {
			json = Zotero.File.getContents(file);
			origin = file.path;
		} else {
			json = Zotero.File.getContentsFromURL("resource://zotero/schema/abbreviations.json");
			origin = "resource://zotero/schema/abbreviations.json";
		}

		try {
			abbreviations = JSON.parse(json);
		} catch(e) {
			throw new Zotero.Exception.Alert("styles.abbreviations.parseError", origin,
				"styles.abbreviations.title", e);
		}

		if(!abbreviations.info || !abbreviations.info.name || !abbreviations.info.URI) {
			throw new Zotero.Exception.Alert("styles.abbreviations.missingInfo", origin,
				"styles.abbreviations.title");
		}

		abbreviationCategories = {};
		for(var jurisdiction in abbreviations) {
			for(var category in abbreviations[jurisdiction]) {
				abbreviationCategories[category] = true;
			}
		}
	}
	
	/**
	 * Normalizes a key
	 */
	function normalizeKey(key) {
		// Strip periods, normalize spacing, and convert to lowercase
		return key.toString().
			replace(/(?:\b|^)(?:and|et|y|und|l[ae]|the|[ld]')(?:\b|$)|[\x21-\x2C.\/\x3A-\x40\x5B-\x60\\\x7B-\x7E]/ig, "").
			replace(/\s+/g, " ").trim();
	}

	function lookupKey(key) {
		return key.toLowerCase().replace(/\s*\./g, "." );
	}
	
	/**
	 * Replace getAbbreviation on citeproc-js with our own handler.
	 */
	return function getAbbreviation(listname, obj, jurisdiction, category, key) {
		init();

		// Short circuit if we know we don't handle this kind of abbreviation
		if(!abbreviationCategories[category] && !abbreviationCategories[category+"-word"]) return;

		var normalizedKey = normalizeKey(key),
			lcNormalizedKey = lookupKey(normalizedKey),
			abbreviation;
		if(!normalizedKey) return;
		
		var jurisdictions = ["default"];
		if(jurisdiction !== "default" && abbreviations[jurisdiction]) {
			jurisdictions.unshift(jurisdiction);
		}

		// Look for full abbreviation
		var jur, cat;
		for(var i=0; i<jurisdictions.length && !abbreviation; i++) {
			if((jur = abbreviations[jurisdictions[i]]) && (cat = jur[category])) {
				abbreviation = cat[lcNormalizedKey];
			}
		}

		if(!abbreviation) {
			// Abbreviate words individually
			var words = normalizedKey.split(/([ \-])/);

			if(words.length > 1) {
				var lcWords = [];
				for(var j=0; j<words.length; j+=2) {
					lcWords[j] = lookupKey(words[j]);
				}
				for(var j=0; j<words.length; j+=2) {
					var word = words[j],
						lcWord = lcWords[j],
						newWord = undefined,
						exactMatch = false;
					
					for(var i=0; i<jurisdictions.length && newWord === undefined; i++) {
						if(!(jur = abbreviations[jurisdictions[i]])) continue;
						if(!(cat = jur[category+"-word"])) continue;
						
						if(cat.hasOwnProperty(lcWord)) {
							// Complete match
							newWord = cat[lcWord];
							exactMatch = true;
						} else if(lcWord.charAt(lcWord.length-1) == 's' && cat.hasOwnProperty(lcWord.substr(0, lcWord.length-1))) {
							// Try dropping 's'
							newWord = cat[lcWord.substr(0, lcWord.length-1)];
							exactMatch = true;
						} else {
							if(j < words.length-2) {
								// Two-word match
								newWord = cat[lcWord+words[j+1]+lcWords[j+2]];
								if(newWord !== undefined) {
									words.splice(j+1, 2);
									lcWords.splice(j+1, 2);
									exactMatch = true;
								}
							}

							if(newWord === undefined) {
								// Partial match
								for(var k=lcWord.length; k>0 && newWord === undefined; k--) {
									newWord = cat[lcWord.substr(0, k)+"-"];
								}
							}
						}
					}
					
					// Don't substitute with a longer word
					if(newWord && !exactMatch && word.length - newWord.length < 1) {
						newWord = word;
					}
					
					// Fall back to full word
					if(newWord === undefined) newWord = word;
					
					// Don't discard last word (e.g. Climate of the Past => Clim. Past)
					if(!newWord && j == words.length-1) newWord = word;
					
					words[j] = newWord.substr(0, 1).toUpperCase() + newWord.substr(1);
				}
				abbreviation = words.join("").replace(/\s+/g, " ").trim();
			} else {
				abbreviation = key;
			}
		}

		if(!abbreviation) abbreviation = key; //this should never happen, but just in case
		
		Zotero.debug("Abbreviated "+key+" as "+abbreviation);
		
		// Add to jurisdiction object
		if(!obj[jurisdiction]) {
			obj[jurisdiction] = new Zotero.CiteProc.CSL.AbbreviationSegments();
		}
		obj[jurisdiction][category][key] = abbreviation;
	}
};

/**
 * citeproc-js system object
 * @class
 */
Zotero.Cite.System = function(automaticJournalAbbreviations) {
	if(automaticJournalAbbreviations) {
		this.getAbbreviation = Zotero.Cite.getAbbreviation;
	}
}

Zotero.Cite.System.prototype = {
	/**
	 * citeproc-js system function for getting items
	 * See http://gsl-nagoya-u.net/http/pub/citeproc-doc.html#retrieveitem
	 * @param {String|Integer} Item ID, or string item for embedded citations
	 * @return {Object} citeproc-js item
	 */
	"retrieveItem":function retrieveItem(item) {
		var zoteroItem, slashIndex;
		if(typeof item === "object" && item !== null &&  item instanceof Zotero.Item) {
			//if(this._cache[item.id]) return this._cache[item.id];
			zoteroItem = item;
		} else if(typeof item === "string" && (slashIndex = item.indexOf("/")) !== -1) {
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
			try {
				zoteroItem = Zotero.Items.get(item);
			} catch(e) {}
		}

		if(!zoteroItem) {
			throw "Zotero.Cite.System.retrieveItem called on non-item "+item;
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
			'type':cslType
		};
		
		// get all text variables (there must be a better way)
		// TODO: does citeproc-js permit short forms?
		for(var variable in CSL_TEXT_MAPPINGS) {
			var fields = CSL_TEXT_MAPPINGS[variable];
			if(variable == "URL" && ignoreURL) continue;
			for each(var field in fields) {
				var value = zoteroItem.getField(field, false, true).toString();
				if(value != "") {
					// Strip enclosing quotes
					if(value.match(/^".+"$/)) {
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
			
			var creatorType = CSL_NAMES_MAPPINGS[creatorType];
			if(!creatorType) continue;
			
			var nameObj = {'family':creator.ref.lastName, 'given':creator.ref.firstName};
			
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
				var dateObj = Zotero.Date.strToDate(date);
				// otherwise, use date-parts
				var dateParts = [];
				if(dateObj.year) {
					// add year, month, and day, if they exist
					dateParts.push(dateObj.year);
					if(dateObj.month !== undefined) {
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

		// extract PMID
		var extra = zoteroItem.getField("extra", false, true);
		if(typeof extra === "string") {
			var m = /(?:^|\n)PMID:\s*([0-9]+)/.exec(extra);
			if(m) cslItem.PMID = m[1];
			m = /(?:^|\n)PMCID:\s*((?:PMC)?[0-9]+)/.exec(extra);
			if(m) cslItem.PMCID = m[1];
		}
		
		//this._cache[zoteroItem.id] = cslItem;
		return cslItem;
	},

	/**
	 * citeproc-js system function for getting locale
	 * See http://gsl-nagoya-u.net/http/pub/citeproc-doc.html#retrieveLocale
	 * @param {String} lang Language to look for a locale for
	 * @return {String|Boolean} The locale as a string if it exists, or false if it doesn't
	 */
	"retrieveLocale":function retrieveLocale(lang) {
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
	}
};