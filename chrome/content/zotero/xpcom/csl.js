/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

/*
 * CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */
Zotero.CSL = function(csl) {
	// "with ({});" needed to fix default namespace scope issue
	// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
	
	if(typeof csl != "xml") {
		this._csl = new XML(Zotero.CSL.Global.cleanXML(csl));
	} else {
		this._csl = csl;
	}
	
	// initialize CSL
	Zotero.CSL.Global.init();
	
	// load localizations
	this._terms = Zotero.CSL.Global.parseLocales(this._csl.terms);
	
	// load class and styleID
	this.styleID = this._csl.info.id.toString();
	this.class = this._csl["@class"].toString();
	Zotero.debug("CSL: style class is "+this.class);
	
	this.hasBibliography = (this._csl.bibliography.length() ? 1 : 0);
}

/*
 * Constants for citation positions
 */
Zotero.CSL.POSITION_FIRST = 0;
Zotero.CSL.POSITION_SUBSEQUENT = 1;
Zotero.CSL.POSITION_IBID = 2;
Zotero.CSL.POSITION_IBID_WITH_LOCATOR = 3;


Zotero.CSL._dateVariables = {
	"issued":true,
	"accessDate":true
}

Zotero.CSL._namesVariables = {
	"editor":true,
	"translator":true,
	"recipient":true,
	"interviewer":true,
	"collection-editor":true,
	"author":true
}

/*
 * Constants for name (used for disambiguate-add-givenname)
 */
Zotero.CSL.NAME_USE_INITIAL = 1;
Zotero.CSL.NAME_USE_FULL = 2;

/*
 * generate an item set
 */
Zotero.CSL.prototype.createItemSet = function(items) {
	return new Zotero.CSL.ItemSet(items, this);
}

/*
 * generate a citation object
 */
Zotero.CSL.prototype.createCitation = function(citationItems) {
	return new Zotero.CSL.Citation(citationItems, this);
}

/*
 * create a citation (in-text or footnote)
 */
Zotero.CSL._firstNameRegexp = /^[^\s]*/;
Zotero.CSL._textCharRegexp = /[a-zA-Z0-9]/;
Zotero.CSL._numberRegexp = /\d+/;
Zotero.CSL._quotedRegexp = /^".+"$/;
Zotero.CSL.prototype.formatCitation = function(citation, format) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var context = this._csl.citation;
	if(!context) {
		throw "CSL: formatCitation called on style with no citation context";
	}
	if(!citation.citationItems.length) {
		throw "CSL: formatCitation called with empty citation";
	}
	
	// clone citationItems, so as not to disturb the citation
	var citationItems = citation.citationItems;
	
	// handle collapse
	var cslAdded = [];
	
	var collapse = context.option.(@name == "collapse").@value.toString();
	if(collapse) {
		// clone citationItems, so as not to disturb the citation
		citationItems = new Array();
		
		if(collapse == "citation-number") {
			// loop through, collecting citation numbers
			var citationNumbers = new Object();
			for(var i=0; i<citation.citationItems.length; i++) {
				citationNumbers[citation.citationItems[i].item.getProperty("citation-number")] = i;
			}
			// add -1 at the end so that the last span gets added (loop below 
			// must be run once more)
			citationNumbers[-1] = false;
			
			var previousI = -1;
			var span = [];
			// loop through citation numbers and collect ranges in span
			for(var i in citationNumbers) {
				if(i != -1 && !citation.citationItems[citationNumbers[i]].prefix
						&& !citation.citationItems[citationNumbers[i]].suffix
						&& i == parseInt(previousI, 10)+1) {
					// could be part of a range including the previous number
					span.push(citationNumbers[i]);
				} else {				// not part of a range
					if(span.length) citationItems[span[0]] = citation.citationItems[span[0]];
					if(span.length > 2) {
						// if previous set of citations was a range, collapse them
						var firstNumber = citationItems[span[0]].item.getProperty("citation-number");
						citationItems[span[0]]._csl = {"citation-number":(firstNumber+"-"+(parseInt(firstNumber, 10)+span.length-1))};
						cslAdded.push(span[0]);
					} else if(span.length == 2) {
						citationItems[span[1]] = citation.citationItems[span[1]];
					}
					
					span = [citationNumbers[i]];
				}
				previousI = i;
			}
		} else if(collapse.substr(0, 4) == "year") {		
			// loop through, collecting citations (sans date) in an array
			var lastNames = {};
			for(var i=0; i<citation.citationItems.length; i++) {
				var citationString = new Zotero.CSL.FormattedString(context, format);
				this._processElements(citation.citationItems[i].item, context.layout, citationString,
					context, null, [{"issued":true}, {}]);
				var cite = citationString.get();
				
				// put into lastNames array
				if(!lastNames[cite]) {
					lastNames[cite] = [i];
				} else {
					lastNames[cite].push(i);
				}
			}
			
			for(var i in lastNames) {
				var itemsSharingName = lastNames[i];
				if(itemsSharingName.length == 1) {
					// if only one, don't worry about grouping
					citationItems[itemsSharingName[0]] = citation.citationItems[itemsSharingName[0]];
				} else {
					var years = [];
					// if grouping by year-suffix, we need to do more (to pull
					// together various letters)
					if(collapse == "year-suffix" && context.option.(@name == "disambiguate-add-year-suffix").@value == "true") {
						var yearsArray = new Object();
						for(var j=0; j<itemsSharingName.length; j++) {
							var year = citation.citationItems[itemsSharingName[j]].item.getDate("issued");
							if(year) {
								year = year.getDateVariable("year");
								if(year) {
									// add to years
									if(!yearsArray[year]) {
										yearsArray[year] = [itemsSharingName[j]];
									} else {
										yearsArray[year].push(itemsSharingName[j]);
									}
								}
							}
							
							if(!year) {
								// if no year, just copy
								years.push("");
							}
						}
						
						// loop through all years
						for(var j in yearsArray) {
							var citationItem = citation.citationItems[yearsArray[j][0]];
							
							// push first year with any suffix
							var year = j;						
							var suffix = citationItem.item.getProperty("disambiguate-add-year-suffix");
							if(suffix) year += suffix;
							years.push(year);
							
							// also push subsequent years
							if(yearsArray[j].length > 1) {
								for(k=1; k<yearsArray[j].length; k++) {
									var suffix = citation.citationItems[yearsArray[j][k]].item.getProperty("disambiguate-add-year-suffix");
									if(suffix) years.push(suffix);
								}
							}
						}
					} else {
						// just add years
						for(var j=0; j<itemsSharingName.length; j++) {
							var item = citation.citationItems[itemsSharingName[j]].item;
							var year = item.getDate("issued");
							if(year) {
								years[j] = year.getDateVariable("year");
								var suffix = item.getProperty("disambiguate-add-year-suffix");
								if(suffix) years[j] += suffix;
							}
						}
					}
					citation.citationItems[itemsSharingName[0]]._csl = {"issued":{"year":years.join(", ")}};
					citationItems[itemsSharingName[0]] = citation.citationItems[itemsSharingName[0]];
					cslAdded.push(itemsSharingName[0]);
				}
			}
		}
	}
	
	var string = new Zotero.CSL.FormattedString(context, format, context.layout.@delimiter.toString());
	for(var i=0; i<citationItems.length; i++) {
		var citationItem = citationItems[i];
		if(!citationItem) continue;
		
		var citationString = string.clone();
		
		// suppress author if requested
		var ignore = citationItem.suppressAuthor ? [{"author":true}, {}] : undefined;
		
		// add prefix
		if(citationItem.prefix) {
			var prefix = citationItem.prefix;
			
			// add space to prefix if last char is alphanumeric
			if(Zotero.CSL._textCharRegexp.test(prefix[prefix.length-1])) prefix += " ";
			
			citationString.append(prefix);
		}
		
		this._processElements(citationItem.item, context.layout, citationString,
			context, citationItem, ignore);
		
		// add suffix
		if(citationItem.suffix) {
			var suffix = citationItem.suffix;
			
			// add space to suffix if last char is alphanumeric
			if(Zotero.CSL._textCharRegexp.test(suffix[0])) suffix = " "+suffix;
			
			citationString.append(suffix);
		}
		
		string.concat(citationString);
	}
	
	var returnString = string.clone();
	returnString.concat(string, context.layout);
	var returnString = returnString.get();
	
	// loop through to remove _csl property
	for(var i=0; i<cslAdded.length; i++) {
		citationItems[cslAdded[i]]._csl = undefined;
	}
	
	return returnString;
}

/*
 * create a bibliography
 */
Zotero.CSL.prototype.formatBibliography = function(itemSet, format) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var context = this._csl.bibliography;
	if(!context.length()) {
		context = this._csl.citation;
		var isCitation = true;
	}
	if(!context) {
		throw "CSL: formatBibliography called on style with no bibliography context";
	}
	
	if(!itemSet.items.length) return "";
	
	var hangingIndent = context.option.(@name == "hanging-indent").@value == "true";
	var secondFieldAlign = context.option.(@name == "second-field-align").@value.toString();
	var lineSpacing = context.option.(@name == "line-spacing").@value.toString();
	lineSpacing = (lineSpacing === "" ? 1 : parseInt(lineSpacing, 10));
	if(lineSpacing == NaN) throw "Invalid line spacing";
	var entrySpacing = context.option.(@name == "entry-spacing").@value.toString();
	entrySpacing = (entrySpacing === "" ? 1 : parseInt(entrySpacing, 10));
	if(entrySpacing == NaN) throw "Invalid entry spacing";
	
	var index = 0;
	var output = "";
	var preamble = "";
	if(format == "HTML") {
		if(this.class == "note" && isCitation) {
			// note citations are formatted as an ordered list
			preamble = '<ol>\r\n';
			secondFieldAlign = false;
		} else {
			// needed bc HTML doesn't force lines to be at least as big as the
			// tallest character
			if(lineSpacing <= 1.1) lineSpacing = 1.1;
			
			// add style
			var style = 'line-height:'+lineSpacing+'em;'
			 if(hangingIndent) {
				style += 'margin-left:0.5in;text-indent:-0.5in;';
			}
			
			if(secondFieldAlign) {
				preamble += '<table style="border-collapse:collapse;'+style+'">\r\n';
			} else {
				preamble += '<div style="'+style+'">\r\n';
			}
		}
	} else {
		if(format == "RTF" || format == "Integration") {
			if(format == "RTF") {
				preamble = "{\\rtf\\ansi{\\fonttbl\\f0\\froman Times New Roman;}{\\colortbl;\\red255\\green255\\blue255;}\\pard\\f0\r\n";
			}
			
			var tabStop = null;
			if(hangingIndent) {
				var indent = 720;			// 720 twips = 0.5 in
				var firstLineIndent = -720;	// -720 twips = -0.5 in
			} else {
				var indent = 0;
				var firstLineIndent = 0;
			}
		}
		
		var returnChars = "";
		for(j=0; j<=entrySpacing; j++) {
			if(format == "RTF") {
				returnChars += "\\\r\n";
			} else if(Zotero.isWin) {
				returnChars += "\r\n";
			} else {
				returnChars += "\n";
			}
		}
	}
	
	var maxFirstFieldLength = 0;
	for(var i in itemSet.items) {
		var item = itemSet.items[i];
		if(item == undefined) continue;
		
		// try to get custom bibliography
		var string = item.getProperty("bibliography-"+(format == "Integration" ? "RTF" : format));
		if(!string) {
			string = new Zotero.CSL.FormattedString(context, format);
			this._processElements(item, context.layout, string, context);
			if(!string) {
				continue;
			}
			
			// add format
			string.string = context.layout.@prefix.toString() + string.string;
			if(context.layout.@suffix.length()) {
				string.append(context.layout.@suffix.toString());
			}
			
			string = string.get();
		}
		
		if(secondFieldAlign && (format == "RTF" || format == "Integration")) {
			if(format == "RTF") {
				var tab = string.indexOf("\\tab ");
			} else {
				var tab = string.indexOf("\t");
			}
			if(tab > maxFirstFieldLength) {
				maxFirstFieldLength = tab;
			}
		}
		
		// add line feeds
		if(format == "HTML") {
			var coins = Zotero.OpenURL.createContextObject(item.zoteroItem, "1.0");
			
			// Wrap URLs in <a href=""> links, in a very unsophisticated manner
			//
			// This should be done earlier when the data is still in variables
			//
			// Ignore URLs preceded by '>', since these are likely already links
			string = string.replace(/([^>])(https?:\/\/[^\s]+)([\."'>:\]\)\s])/g, '$1<a href="$2">$2</a>$3');
			string = string.replace(/(doi:[ ]*)(10\.[^\s]+[0-9a-zA-Z])/g, '$1<a href="http://dx.doi.org/$2">$2</a>');
			
			var span = (coins ? ' <span class="Z3988" title="'+coins.replace("&", "&amp;", "g")+'">&nbsp;</span>' : '');
			
			if(this.class == "note" && isCitation) {
				output += "<li>"+string+span+"</li>\r\n";
			} else if(secondFieldAlign) {
				output += '<tr style="vertical-align:top;"><td>'+string+span+"</td></tr>\r\n";
				for(var j=0; j<entrySpacing; j++) {
					output += '<tr><td colspan="2">&nbsp;</td></tr>\r\n';
				}
			} else {
				if(i == 0) {
					// first p has no margins
					var margin = "0";
				} else {
					var margin = (entrySpacing*lineSpacing).toString()+"em 0 0 0";
				}
				output += '<p style="margin:'+margin+'">'+string+span+"</p>\r\n";
			}
		} else  {
			if(this.class == "note" && isCitation) {
				if(format == "RTF") {
					index++;
					output += index+". ";
				} else if(format == "Text") {
					index++;
					output += index+". ";
				}
			}
			output += string+returnChars;
		}
	}
	
	if(format == "HTML") {
		if(this.class == "note" && isCitation) {
			output += '</ol>';
		} else if(secondFieldAlign) {
			output += '</table>';
		} else {
			output += '</div>';
		}
	} else if(format == "RTF" || format == "Integration") {
		if(secondFieldAlign) {
			// this is a really sticky issue. the below works for first fields
			// that look like "[1]" and "1." otherwise, i have no idea. luckily,
			// this will be good enough 99% of the time.
			var alignAt = 24+maxFirstFieldLength*120;
			
			if(secondFieldAlign == "margin") {
				firstLineIndent -= alignAt;
				tabStop = 0;
			} else {
				indent += alignAt;
				firstLineIndent = -indent;
				tabStop = indent;
			}
		}
		
		preamble += "\\li"+indent+" \\fi"+firstLineIndent+" ";
		if(format == "Integration") {
			preamble += "\\sl"+lineSpacing+" ";
		} else if(format == "RTF" && lineSpacing != 1) {
			preamble += "\\sl"+(240*lineSpacing)+" \\slmult1 ";
		}
		
		if(tabStop !== null) {
			preamble += "\\tx"+tabStop+" ";
		}
		preamble += "\r\n";
		
		// drop last returns
		output = output.substr(0, output.length-returnChars.length);
		
		// add bracket for RTF
		if(format == "RTF") output += "\\par }";
	}
	
	return preamble+output;
}

/*
 * gets a term, in singular or plural form
 */
Zotero.CSL.prototype._getTerm = function(term, plural, form, includePeriod) {
	if(!form) {
		form = "long";
	}
	
	if(!this._terms[form] || !this._terms[form][term]) {
		if(form == "verb-short") {
			return this._getTerm(term, plural, "verb");
		} else if(form == "symbol") {
			return this._getTerm(term, plural, "short");
		} else if(form != "long") {
			return this._getTerm(term, plural, "long");
		} else {
			Zotero.debug("CSL: WARNING: could not find term \""+term+'"');
			return "";
		}
	}
	
	var term;
	if(typeof(this._terms[form][term]) == "object") {	// singular and plural forms
	                                                    // are available
		if(plural) {
			term = this._terms[form][term][1];
		} else {
			term = this._terms[form][term][0];
		}
	} else {
		term = this._terms[form][term];
	}
	
	if((form == "short" || form == "verb-short") && includePeriod) {
		term += ".";
	}
	
	return term;
}

/*
 * process creator objects; if someone had a creator model that handled
 * non-Western names better than ours, this would be the function to change
 */
Zotero.CSL.prototype._processNames = function(item, element, formattedString, context, citationItem, variables) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var children = element.children();
	if(!children.length()) return false;
	var variableSucceeded = false;
	
	for(var j=0; j<variables.length; j++) {
		var success = false;
		var newString = formattedString.clone();
		
		if(formattedString.format != "Sort" && variables[j] == "author" && context
				&& context.option.(@name == "subsequent-author-substitute").length()
				&& item.getProperty("subsequent-author-substitute")
				&& context.localName() == "bibliography") {
			newString.append(context.option.(@name == "subsequent-author-substitute").@value.toString());
			success = true;
		} else {
			var creators = item.getNames(variables[j]);
			
			if(creators && creators.length) {
				var maxCreators = creators.length;
	
				for each(var child in children) {
					if(child.namespace() != Zotero.CSL.Global.ns) continue;
					
					var name = child.localName();
					if(name == "name") {
						var useEtAl = false;
						
						if(context) {
							// figure out if we need to use "et al"
							var etAlMin = context.option.(@name == "et-al-min").@value.toString();
							var etAlUseFirst = context.option.(@name == "et-al-use-first").@value.toString();
							
							if(citationItem && citationItem.position
									&& citationItem.position >= Zotero.CSL.POSITION_SUBSEQUENT) {
								if(context.option.(@name == "et-al-subsequent-min").length()) {
									etAlMin = context.option.(@name == "et-al-subsequent-min").@value.toString();
								}
								if(context.option.(@name == "et-al-subsequent-use-first").length()) {
									etAlUseFirst = context.option.(@name == "et-al-subsequent-use-first").@value.toString();
								}
							}
							
							if(etAlMin && etAlUseFirst && maxCreators >= parseInt(etAlMin, 10)) {
								etAlUseFirst = parseInt(etAlUseFirst, 10);
								if(etAlUseFirst != maxCreators) {
									maxCreators = etAlUseFirst;
									useEtAl = true;
								}
							}
							
							// add additional names to disambiguate
							if(variables[j] == "author" && useEtAl) {
								var disambigNames = item.getProperty("disambiguate-add-names");
								if(disambigNames != "") {
									maxCreators = disambigNames;
									if(disambigNames == creators.length) useEtAl = false;
								}
							}
							
							if(child.@form == "short") {
								var fullNames = item.getProperty("disambiguate-add-givenname").split(",");
							}
						}
						
						var authorStrings = [];
						var firstName, lastName;
						// parse authors into strings
						for(var i=0; i<maxCreators; i++) {
							if(formattedString.format == "Sort") {
								// for sort, we use the plain names
								var name = creators[i].getNameVariable("lastName");
								
								// cut off lowercase parts of otherwise capitalized names (e.g., "de")
								var lastNameParts = name.split(" ");
								if(lastNameParts.length > 1 && lastNameParts[0] !== "" && lastNameParts[0].length <= 4
										&& lastNameParts[0][0].toLowerCase() == lastNameParts[0][0]
										&& lastNameParts[lastNameParts.length-1][0].toUpperCase() == lastNameParts[lastNameParts.length-1][0]) {
									name = "";
									for(var k=1; k<lastNameParts.length; k++) {
										if(lastNameParts[k][0].toUpperCase() == lastNameParts[k][0]) {
											name += " "+lastNameParts[k];
										}
									}
									name = name.substr(1);
								}
								
								var firstName = creators[i].getNameVariable("firstName");
								if(name && firstName) name += ", ";
								name += firstName;
								
								newString.append(name);
							} else {
								var firstName = "";
								
								if(child.@form != "short" || (fullNames && fullNames[i])) {
									if(child["@initialize-with"].length() && (!fullNames ||
											fullNames[i] != Zotero.CSL.NAME_USE_FULL)) {
										// even if initialize-with is simply an empty string, use
										// initials
										
										// use first initials
										var firstNames = creators[i].getNameVariable("firstName").split(" ");
										for(var k in firstNames) {
											if(firstNames[k]) {
												// get first initial, put in upper case, add initializeWith string
												firstName += firstNames[k][0].toUpperCase()+child["@initialize-with"].toString();
											}
										}
								
										if(firstName[firstName.length-1] == " ") {
											firstName = firstName.substr(0, firstName.length-1);
										}
									} else {
										firstName = creators[i].getNameVariable("firstName");
									}
								}
								lastName = creators[i].getNameVariable("lastName");
								
								if(child["@name-as-sort-order"].length()
								  && ((i == 0 && child["@name-as-sort-order"] == "first")
								  || child["@name-as-sort-order"] == "all")
								  && child["@sort-separator"].length()) {
									// if this is the first author and name-as-sort="first"
									// or if this is a subsequent author and name-as-sort="all"
									// then the name gets inverted
									authorStrings.push(lastName+(firstName ? child["@sort-separator"].toString()+firstName : ""));
								} else {
									authorStrings.push((firstName ? firstName+" " : "")+lastName);
								}
							}
						}
						
						if(formattedString.format != "Sort") {
							// figure out if we need an "and" or an "et al"
							var joinString = (child["@delimiter"].length() ? child["@delimiter"].toString() : ", ");
							if(creators.length > 1) {
								if(useEtAl) {	// multiple creators and need et al
									authorStrings.push(this._getTerm("et-al"));
								} else {		// multiple creators but no et al
									// add and to last creator
									if(child["@and"].length()) {
										if(child["@and"] == "symbol") {
											var and = "&"
										} else if(child["@and"] == "text") {
											var and = this._getTerm("and");
										}
										
										authorStrings[maxCreators-1] = and+" "+authorStrings[maxCreators-1];
									}
								}
								
								// check whether to use a serial comma
								if((authorStrings.length == 2 && (child["@delimiter-precedes-last"] != "always" || useEtAl)) ||
								   (authorStrings.length > 2 && child["@delimiter-precedes-last"] == "never")) {
									var lastString = authorStrings.pop();
									authorStrings[authorStrings.length-1] = authorStrings[authorStrings.length-1]+" "+lastString;
								}
							}
							newString.append(authorStrings.join(joinString), child);
						}
					} else if(formattedString.format != "Sort" && 
							name == "label" && variables[j] != "author") {
						newString.append(this._getTerm(variables[j], (maxCreators != 1 || useEtAl), child["@form"].toString(), child["@include-period"] == "true"), child);
					}
				}
				success = true;
			}
		}
		
		if(success) {
			variableSucceeded = true;
			formattedString.concat(newString);
		}
	}
	
	return variableSucceeded;
}

/*
 * processes an element from a (pre-processed) item into text
 */
Zotero.CSL.prototype._processElements = function(item, element, formattedString,
		context, citationItem, ignore, isSingle) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(!ignore) {
		ignore = [[], []];
		// ignore[0] is for variables; ignore[1] is for macros
	}
	
	var dataAppended = false;
	
	if(isSingle) {
		// handle single elements
		var numberOfChildren = 1;
		var children = [element];
	} else {
		// accept groups of elements by default
		var children = element.children();
		var numberOfChildren = children.length();
		var lastChild = children.length()-1;
	}
	
	for(var i=0; i<numberOfChildren; i++) {
		var child = children[i];
		if(child.namespace() != Zotero.CSL.Global.ns) continue;
		var name = child.localName();
		
		if(name == "text") {
			if(child["@term"].length()) {
				var term = this._getTerm(child["@term"].toString(), child.@plural == "true", child.@form.toString(), child["@include-period"] == "true");
				if(term) {
					formattedString.append(term, child);
				}
			} else if(child.@variable.length()) {
				var form = child.@form.toString();
				var variables = child["@variable"].toString().split(" ");
				var newString = formattedString.clone(child.@delimiter.toString());
				var success = false;
				
				for(var j=0; j<variables.length; j++) {
					if(ignore[0][variables[j]]) continue;
					
					if(variables[j] == "locator") {
						// special case for locator
						var text = citationItem && citationItem.locator ? citationItem.locator : "";
					} else if(citationItem && citationItem._csl && citationItem._csl[variables[j]]) {
						// override if requested
						var text = citationItem._csl[variables[j]];
					} else if(variables[j] == "citation-number") {
						// special case for citation-number
						var text = item.getProperty("citation-number");
					} else {
						var text = item.getVariable(variables[j], form);
					}
					
					if(text) {
						newString.append(text);
						success = true;
					}
				}
				
				if(success) {
					formattedString.concat(newString, child);
					dataAppended = true;
				}
			} else if(child.@macro.length()) {
				var macro = this._csl.macro.(@name == child.@macro);
				if(!macro.length()) throw "CSL: style references undefined macro " + child.@macro;
				
				// If not ignored (bc already used as a substitution)
				if(!ignore[1][child.@macro.toString()]) {
					var newString = formattedString.clone(child.@delimiter.toString());
					var success = this._processElements(item, macro, newString,
						context, citationItem, ignore);
					if(success) dataAppended = true;
					formattedString.concat(newString, child);
				}
			} else if(child.@value.length()) {
				formattedString.append(child.@value.toString(), child);
			}
		} else if(name == "number") {
			if(child.@variable.length()) {
				var form = child.@form.toString();
				var variables = child["@variable"].toString().split(" ");
				var newString = formattedString.clone(child.@delimiter.toString());
				var success = false;
				
				for(var j=0; j<variables.length; j++) {
					if(ignore[0][variables[j]]) continue;
					
					var text = item.getNumericVariable(variables[j], form);
					if(text) {
						newString.append(text);
						success = true;
					}
				}
				
				if(success) {
					formattedString.concat(newString, child);
					dataAppended = true;
				}
			}
		} else if(name == "label") {
			var form = child.@form.toString();
			var variables = child["@variable"].toString().split(" ");
			var newString = formattedString.clone(child.@delimiter.toString());
			var success = false;
			
			for(var j=0; j<variables.length; j++) {
				if(ignore[0][variables[j]]) continue;
				
				if(variables[j] == "locator") {
					// special case for locator
					var term = (citationItem && citationItem.locatorType) ? citationItem.locatorType : "page";
					// if "other" specified as the term, don't do anything
					if(term == "other") term = false;
					var value = citationItem && citationItem.locator ? citationItem.locator : false;
				} else {
					var term = variables[j];
					var value = item.getVariable(variables[j]).toString();
				}
				
				if(term !== false && value) {
					if (child["@pluralize"] == "always") {
						var isPlural = true;
					}
					else if (child["@pluralize"] == "never") {
						var isPlural = false;
					}
					else { // contextual
						var isPlural = value.indexOf("-") != -1 || value.indexOf(",") != -1 || value.indexOf("\u2013") != -1;
					}
					var text = this._getTerm(term, isPlural, child.@form.toString(), child["@include-period"] == "true");
					
					if(text) {
						newString.append(text);
						success = true;
					}
				}
			}
			
			if(success) {
				formattedString.concat(newString, child);
			}
		} else if(name == "names") {
			var variables = child["@variable"].toString().split(" ");
			var newString = formattedString.clone(child.@delimiter.toString());
			
			// remove variables that aren't supposed to be there
			for(var j=0; j<variables.length; j++) {
				if(ignore[0][variables[j]]) {
					variables.splice(j, 1);
				}
			}
			if(!variables.length) continue;
			
			var success = this._processNames(item, child, newString, context,
				citationItem, variables);
			
			if(!success && child.substitute.length()) {
				for each(var newChild in child.substitute.children()) {
					if(newChild.namespace() != Zotero.CSL.Global.ns) continue;
					
					if(newChild.localName() == "names" && newChild.children.length() == 0) {
						// apply same rules to substitute names
						// with no children
						var variable = newChild.@variable.toString();
						variables = variable.split(" ");
						success = this._processNames(item, child, newString,
							context, citationItem, variables);
						
						ignore[0][newChild.@variable.toString()] = true;
						
						if(success) break;
					} else {
						if(!newChild.@suffix.length()) newChild.@suffix = element.@suffix;
						if(!newChild.@prefix.length()) newChild.@prefix = element.@prefix;
						
						success = this._processElements(item, 
							newChild, newString, context, citationItem, ignore, true);
						
						// ignore if used as substitution
						if(newChild.@variable.length()) {
							ignore[0][newChild.@variable.toString()] = true;
						} else if(newChild.@macro.length()) {
							ignore[1][newChild.@macro.toString()] = true;
						}
						
						// if substitution was successful, stop
						if(success) break;
					}
				}
			}
			
			if(success) {
				formattedString.concat(newString, child);
				dataAppended = true;
			}
		} else if(name == "date") {
			var variables = child["@variable"].toString().split(" ");
			var newString = formattedString.clone(child.@delimiter.toString());
			var success = false;
			
			for(var j=0; j<variables.length; j++) {
				if(ignore[0][variables[j]]) continue;
				
				var date = item.getDate(variables[j]);
				if(!date) continue;
				
				var variableString = formattedString.clone();
				success = true;
				
				if(formattedString.format == "Sort") {
					variableString.append(date.getDateVariable("sort"));
				} else {
					for each(var newChild in child.children()) {
						if(newChild.namespace() != Zotero.CSL.Global.ns) continue;
						var newName = newChild.localName();
						var newForm = newChild.@form.toString();
						
						if(newName == "date-part") {
							var part = newChild.@name.toString();
							
							if(citationItem && citationItem._csl && citationItem._csl[variables[j]] && citationItem._csl[variables[j]][part]) {
								// date is in citationItem
								var string = citationItem._csl[variables[j]][part];
							} else {
								var string = date.getDateVariable(part);
								if(string === "") continue;
								
								if(part == "year") {
									string = string.toString();
									
									// if 4 digits and no B.C., use short form
									if(newForm == "short" && string.length == 4 && !isNaN(string*1)) {
										string = string.substr(2, 2);
									}
									
									var disambiguate = item.getProperty("disambiguate-add-year-suffix");
									if(disambiguate && variables[j] == "issued") {
										string += disambiguate;
									}
								} else if(part == "month") {
									// if month is a numeric month, format as such
									if(!isNaN(string*1)) {
										if(newForm == "numeric-leading-zeros") {
											string = (string+1).toString();
											if(string.length == 1) {
												string = "0" + string;
											}
										} else if(newForm == "short") {
											string = this._terms["short"]["_months"][string];
										} else if(newForm == "numeric") {
											string = (1+string).toString();
										} else {
											string = this._terms["long"]["_months"][string];
										}
									} else if(newForm == "numeric") {
										string = "";
									}
								} else if(part == "day") {
									string = string.toString();
									if(form == "numeric-leading-zeros"
											&& string.length() == 1) {
										string = "0" + string;
									} else if (newForm == "ordinal") {
										var ind = parseInt(string);
										var daySuffixes = Zotero.getString("date.daySuffixes").replace(/, ?/g, "|").split("|");
										string += (parseInt(ind/10)%10) == 1 ? daySuffixes[3] : (ind % 10 == 1) ? daySuffixes[0] : (ind % 10 == 2) ? daySuffixes[1] : (ind % 10 == 3) ? daySuffixes[2] : daySuffixes[3];
									}
								}
							}
						}
						
						variableString.append(string, newChild);
					}
					
					newString.concat(variableString);
				}
				
				formattedString.concat(newString, child);
			}
			
			if(success) {
				dataAppended = true;
			}
		} else if(name == "group") {
			var newString = formattedString.clone(child.@delimiter.toString());			
			var success = this._processElements(item, 
				child, newString, context, citationItem,
				ignore);
			
			// concat only if true data (not text element) was appended
			if(success) {
				formattedString.concat(newString, child);
				dataAppended = true;
			}
		} else if(name == "choose") {
			for each(var newChild in child.children()) {
				if(newChild.namespace() != Zotero.CSL.Global.ns) continue;
				
				var truthValue;
				
				if(newChild.localName() == "else") {
					// always true, if we got to this point in the loop
					truthValue = true;
				} else if(newChild.localName() == "if"
						|| newChild.localName() == "else-if") {
					
					var matchAny = newChild.@match == "any";
					var matchNone = newChild.@match == "none";
					if(matchAny) {
						// if matching any, begin with false, then set to true
						// if a condition is true
						truthValue = false;
					} else {
						// if matching all, begin with true, then set to false
						// if a condition is false
						truthValue = true;
					}
					
					// inspect variables
					var done = false;
					var attributes = ["variable", "is-date", "is-numeric", "is-plural", "type", "disambiguate", "locator", "position"];
					for(var k=0; !done && k<attributes.length; k++) {
						var attribute = attributes[k];
						
						if(newChild["@"+attribute].length()) {
							var variables = newChild["@"+attribute].toString().split(" ");
							for(var j=0; !done && j<variables.length; j++) {
								var exists = false;
								if(attribute == "variable") {
									if(variables[j] == "locator") {
										// special case for locator
										exists = citationItem && citationItem.locator && citationItem.locator.length > 0
									}
									else if(Zotero.CSL._dateVariables[variables[j]]) {
										// getDate not false/undefined
										exists = !!item.getDate(variables[j]);
									} else if(Zotero.CSL._namesVariables[variables[j]]) {
										// getNames not false/undefined, not empty
										exists = item.getNames(variables[j]);
										if(exists) exists = !!exists.length;
									} else {
										exists = item.getVariable(variables[j]);
										if (exists) exists = !!exists.length;
									}
								} else if (attribute == "is-numeric") {
									exists = item.getNumericVariable(variables[j]);
								} else if (attribute == "is-date") { // XXX - this needs improving
									if (Zotero.CSL._dateVariables[variables[j]]) {
										exists = !!item.getDate(variables[j]);
									}
								} else if(attribute == "is-plural") {
									if(Zotero.CSL._namesVariables[variables[j]]) {
										exists = item.getNames(variables[j]);
										if(exists) exists = exists.length > 1;
									} else if(variables[j] == "page" || variables[j] == "locator") {
										if(variables[j] == "page") {
											var value = item.getVariable("page");
										} else {
											var value = citationItem && citationItem.locator ? citationItem.locator : "";
										}
										exists = value.indexOf("-") != -1 || value.indexOf(",") != -1 || value.indexOf("\u2013") != -1;
									}
								} else if(attribute == "type") {
									exists = item.isType(variables[j]);
								} else if(attribute == "disambiguate") {
									exists = (variables[j] == "true" && item.getProperty("disambiguate-condition"))
										|| (variables[j] == "false" && !item.getProperty("disambiguate-condition"));
								} else if(attribute == "locator") {
									exists = citationItem && citationItem.locator &&
										(citationItem.locatorType == variables[j]
										|| (!citationItem.locatorType && variables[j] == "page"));
								} else {	// attribute == "position"
									if(variables[j] == "first") {
										exists = !citationItem
											|| !citationItem.position
											|| citationItem.position == Zotero.CSL.POSITION_FIRST;
									} else if(variables[j] == "subsequent") {
										exists = citationItem && citationItem.position >= Zotero.CSL.POSITION_SUBSEQUENT;
									} else if(variables[j] == "ibid") {
										exists = citationItem && citationItem.position >= Zotero.CSL.POSITION_IBID;
									} else if(variables[j] == "ibid-with-locator") {
										exists = citationItem && citationItem.position == Zotero.CSL.POSITION_IBID_WITH_LOCATOR;
									}
								}
								
								if(matchAny) {
									if(exists) {
										truthValue = true;
										done = true;
									}
								} else if(matchNone) {
									if(exists) {
										truthValue = false;
										done = true;
									}
								} else if(!exists) {
									truthValue = false;
									done = true;
								}
							}
						}
					}
				}
				
				if(truthValue) {
					// if true, process
					var newString = formattedString.clone(newChild.@delimiter.toString());			
					var success = this._processElements(item, newChild,
						newString, context, citationItem, ignore);
					if(success) dataAppended = true;
					formattedString.concat(newString, child);
					
					// then break
					break;
				}
			}
		} else {
			Zotero.debug("CSL: WARNING: could not add element "+name);
		}
	}
	
	return dataAppended;
}

/*
 * Compares two items, in order to sort the reference list
 * Returns -1 if A comes before B, 1 if B comes before A, or 0 if they are equal
 */
Zotero.CSL.prototype._compareItem = function(a, b, context, cache) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var sortA = [];
	var sortB = [];
	
	var aID = a.id;
	var bID = b.id;
	
	// author
	if(context.sort.key.length()) {
		var keyA, keyB;
		for each(var key in context.sort.key) {
			if(key.@macro.length()) {
				var aCacheKey = aID+"-macro-"+key.@macro;
				var bCacheKey = bID+"-macro-"+key.@macro;
				
				if(cache[aCacheKey]) {
					keyA = cache[aCacheKey];
				} else {
					keyA = new Zotero.CSL.SortString();
					this._processElements(a, this._csl.macro.(@name == key.@macro), keyA);
					cache[aCacheKey] = keyA;
				}
				
				if(cache[bCacheKey]) {
					keyB = cache[bCacheKey];
				} else {
					keyB = new Zotero.CSL.SortString();
					this._processElements(b, this._csl.macro.(@name == key.@macro), keyB);
					cache[bCacheKey] = keyB;
				}
			} else if(key.@variable.length()) {
				var variable = key.@variable.toString();
				var keyA = new Zotero.CSL.SortString();
				var keyB = new Zotero.CSL.SortString();
				
				if(Zotero.CSL._dateVariables[variable]) {				// date
					var date = a.getDate(variable);
					if(date) keyA.append(date.getDateVariable("sort"));
					date = b.getDate(variable);
					if(date) keyB.append(date.getDateVariable("sort"));
				} else if(Zotero.CSL._namesVariables[key.@variable]) {	// names
					var element = <names><name/></names>;
					element.setNamespace(Zotero.CSL.Global.ns);
					
					this._processNames(a, element, keyA, context, null, [variable]);
					this._processNames(b, element, keyB, context, null, [variable]);
				} else {												// text
					if(variable == "citation-number") {
						keyA.append(a.getProperty(variable));
						keyB.append(b.getProperty(variable));
					} else {
						keyA.append(a.getVariable(variable));
						keyB.append(b.getVariable(variable));
					}
				}
			}
			
			var compare = keyA.compare(keyB);
			if(key.@sort == "descending") {	// the compare method sorts ascending
											// so we sort descending by reversing it
				if(compare < 1) return 1;
				if(compare > 1) return -1;
			} else if(compare != 0) {
				return compare;
			}
		}
	}
	
	// sort by index in document
	var aIndex = a.getProperty("index");
	var bIndex = b.getProperty("index");
	if(aIndex !== "" && (bIndex === "" || aIndex < bIndex)) {
		return -1;
	} else if(aIndex != bIndex) {
		return 1;
	}
	
	// sort by old index (to make this a stable sort)
	var aOldIndex = a.getProperty("oldIndex");
	var bOldIndex = b.getProperty("oldIndex");
	if(aOldIndex < bOldIndex) {
		return -1;
	} else if(aOldIndex != bOldIndex) {
		return 1;
	}
	
	return 0;
}


/**
 * Sorts a list of items, keeping a cache of processed keys
 **/
Zotero.CSL.prototype.cachedSort = function(items, context, field) {
	var me = this;
	var cache = new Object();
	
	for(var i=0; i<items.length; i++) {
		if(items[i].setProperty) items[i].setProperty("oldIndex", i);
	}
	
	if(field) {
		var newItems = items.sort(function(a, b) {
			return me._compareItem(a[field], b[field], context, cache);
		});
	} else {
		var newItems = items.sort(function(a, b) {
			return me._compareItem(a, b, context, cache);
		});
	}
	
	delete cache;
	return newItems;
}

Zotero.CSL.prototype.getEqualCitations = function(items) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var citationsEqual = [];
	
	if(items) {
		var context = this._csl.citation;
		
		var string = new Zotero.CSL.FormattedString(context.options, "Text");
		this._processElements(items[0], context.layout, string,
			context, "subsequent");
		var lastString = string.get();
		
		for(var i=1; i<items.length; i++) {
			string = new Zotero.CSL.FormattedString(context.option, "Text");
			this._processElements(items[i], context.layout, string,
				context, "subsequent");
			string = string.get();
			
			citationsEqual[i] = string == lastString;
			lastString = string;
		}
	}
	
	return citationsEqual;
}

/*
 * Compares two citations; returns true if they are different, false if they are equal
 */
Zotero.CSL.prototype.compareCitations = function(a, b, context) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if((!a && b) || (a && !b)) {
		return true;
	} else if(!a && !b) {
		return false;
	}
	
	var option = (context ? context.option : null);
	var aString = new Zotero.CSL.FormattedString(option, "Text");
	this._processElements(a, this._csl.citation.layout, aString,
		context, "subsequent");
		
	var bString = new Zotero.CSL.FormattedString(option, "Text");
	this._processElements(b, this._csl.citation.layout, bString,
		context, "subsequent");
	
	return !(aString.get() == bString.get());
}

Zotero.CSL.Global = new function() {
	this.init = init;
	this.getMonthStrings = getMonthStrings;
	this.getLocatorStrings = getLocatorStrings;
	this.cleanXML = cleanXML;
	this.parseLocales = parseLocales;
	
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	this.ns = "http://purl.org/net/xbiblio/csl";
	
	this.__defineGetter__("locale", function() {
		Zotero.CSL.Global.init()
		return Zotero.CSL.Global._xmlLang;
	});
	this.collation = Components.classes["@mozilla.org/intl/collation-factory;1"]
	                       .getService(Components.interfaces.nsICollationFactory)
	                       .CreateCollation(Components.classes["@mozilla.org/intl/nslocaleservice;1"]
	                           .getService(Components.interfaces.nsILocaleService)
	                           .getApplicationLocale());
	                           
	var locatorTypeTerms = ["page", "book", "chapter", "column", "figure", "folio",
		"issue", "line", "note", "opus", "paragraph", "part", "section", "sub verbo",
		"volume", "verse"];

	/*
	 * initializes CSL interpreter
	 */
	function init() {
		if(!Zotero.CSL.Global._xmlLang) {
			var prefix = "chrome://zotero/content/locale/csl/locales-";
			var ext = ".xml";
			
			// If explicit bib locale, try to use that
			var bibLocale = Zotero.Prefs.get('export.bibliographyLocale');
			if (bibLocale) {
				var loc = bibLocale;
				var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					createInstance();
				req.open("GET", prefix + loc + ext, false);
				req.overrideMimeType("text/plain");
				var fail = false;
				try {
					req.send(null);
				}
				catch (e) {
					fail = true;
				}
				
				if (!fail) {
					Zotero.CSL.Global._xmlLang = loc;
					var xml = req.responseText;
				}
			}
			
			// If no or invalid bib locale, try Firefox locale
			if (!xml) {
				var loc = Zotero.locale;
				var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					createInstance();
				req.open("GET", prefix + loc + ext, false);
				req.overrideMimeType("text/plain");
				var fail = false;
				try {
					req.send(null);
				}
				catch (e) {
					fail = true;
				}
				
				if (!fail) {
					Zotero.CSL.Global._xmlLang = loc;
					var xml = req.responseText;
				}
			}
			
			// Fall back to en-US if no locales.xml
			if (!xml) {
				var loc = 'en-US';
				var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					createInstance();
				req.open("GET", prefix + loc + ext, false);
				req.overrideMimeType("text/plain");
				req.send(null);
				
				Zotero.CSL.Global._xmlLang = loc;
				var xml = req.responseText;
			}
			
			Zotero.debug('CSL: Using ' + loc + ' as bibliography locale');
			
			// get default terms
			var locales = new XML(Zotero.CSL.Global.cleanXML(xml));
			Zotero.CSL.Global._defaultTerms = Zotero.CSL.Global.parseLocales(locales, true);
		}
	}
	
	/*
	 * returns an array of short or long month strings
	 */
	function getMonthStrings(form) {
		Zotero.CSL.Global.init();
		return Zotero.CSL.Global._defaultTerms[form]["_months"];
	}
	
	/*
	 * returns an array of short or long locator strings
	 */
	function getLocatorStrings(form) {
		if(!form) form = "long";
		
		Zotero.CSL.Global.init();
		var locatorStrings = new Object();
		for(var i=0; i<locatorTypeTerms.length; i++) {
			var term = locatorTypeTerms[i];
			var termKey = term;
			if(term == "page") termKey = "";
			locatorStrings[termKey] = Zotero.CSL.Global._defaultTerms[form][term];
			
			if(!locatorStrings[termKey] && form == "symbol") {
				locatorStrings[termKey] = Zotero.CSL.Global._defaultTerms["short"][term];
			}
			if(!locatorStrings[termKey]) {
				locatorStrings[termKey] = Zotero.CSL.Global._defaultTerms["long"][term];
			}
			
			// use singular form
			if(typeof(locatorStrings[termKey]) == "object") locatorStrings[termKey] = locatorStrings[termKey][0];
		}
		return locatorStrings;
	}
	
	/*
	 * removes parse instructions from XML
	 */
	function cleanXML(xml) {
		return xml.replace(/<\?[^>]*\?>/g, "");
	}
	
	/*
	 * parses locale strings into an array; 
	 */
	function parseLocales(termXML, ignoreLang) {
		// return defaults if there are no terms
		if(!termXML.length()) {
			return (Zotero.CSL.Global._defaultTerms ? Zotero.CSL.Global._defaultTerms : {});
		}
		
		var xml = new Namespace("http://www.w3.org/XML/1998/namespace");
		
		if(ignoreLang) {
			// ignore lang if loaded from chrome
			locale = termXML.locale[0];
		} else {
			// get proper locale
			var locale = termXML.locale.(@xml::lang == Zotero.CSL.Global._xmlLang);
			if(!locale.length()) {
				var xmlLang = Zotero.CSL.Global._xmlLang.substr(0, 2);
				locale = termXML.locale.(@xml::lang == xmlLang);
			}
			if(!locale.length()) {
				// return defaults if there are no locales
				return (Zotero.CSL.Global._defaultTerms ? Zotero.CSL.Global._defaultTerms : {});
			}
		}
		
		var termArray = new Object();
		termArray["default"] = new Object();
		
		if(Zotero.CSL.Global._defaultTerms) {
			// ugh. copy default array. javascript dumb.
			for(var i in Zotero.CSL.Global._defaultTerms) {
				termArray[i] = new Object();
				for(var j in Zotero.CSL.Global._defaultTerms[i]) {
					if(typeof(Zotero.CSL.Global._defaultTerms[i][j]) == "object") {
						termArray[i][j] = Zotero.CSL.Global._defaultTerms[i][j].concat();
					} else {
						termArray[i][j] = Zotero.CSL.Global._defaultTerms[i][j];
					}
				}
			}
		}
		
		// loop through terms
		for each(var term in locale.term) {
			var name = term.@name.toString();
			if(!name) {
				throw("CSL: citations cannot be generated: no name defined on term in locales.xml");
			}
			// unless otherwise specified, assume "long" form
			var form = term.@form.toString();
			if(!form) {
				var form = "long";
			}
			if(!termArray[form]) {
				termArray[form] = new Object();
			}
			
			var single = term.single.text().toString();
			var multiple = term.multiple.text().toString();
			if(single || multiple) {
				if((single && multiple)			// if there's both elements or
				  || !termArray[form][name]) {	// no previously defined value
					termArray[form][name] = [single, multiple];
				} else {
					if(typeof(termArray[name]) != "object") {
						// if old object was just a single value, make it two copies
						termArray[form][name] = [termArray[form][name], termArray[form][name]];
					}
					
					// redefine either single or multiple
					if(single) {
						termArray[form][name][0] = single;
					} else {
						termArray[form][name][1] = multiple;
					}
				}
			} else {
				if(name.substr(0, 6) == "month-") {
					// place months into separate array
					if(!termArray[form]["_months"]) {
						termArray[form]["_months"] = new Array();
					}				
					var monthIndex = parseInt(name.substr(6),10)-1;
					var term = term.text().toString();
					termArray[form]["_months"][monthIndex] = term[0].toUpperCase()+term.substr(1).toLowerCase();
				} else {
					termArray[form][name] = term.text().toString();
				}
			}
		}
		
		// ensure parity between long and short months
		var longMonths = termArray["long"]["_months"];
		var shortMonths = termArray["short"]["_months"];
		for(var i=0; i<longMonths.length; i++) {
			if(!shortMonths[i]) {
				shortMonths[i] = longMonths[i];
			}
		}
		
		return termArray;
	}
}

/*
 * the CitationItem object represents an individual source within a citation.
 *
 * PROPERTIES:
 * prefix
 * suffix
 * locatorType
 * locator
 * suppressAuthor
 * item
 * itemID
 */
Zotero.CSL.CitationItem = function(item) {
	if(item) {
		this.item = item;
		this.itemID = item.id;
	}
}

/*
 * the Citation object represents a citation.
 */
Zotero.CSL.Citation = function(citationItems, csl) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(csl) {
		this._csl = csl;
		this._citation = csl._csl.citation;
		this.sortable = this._citation.sort.key.length();
	} else {
		this.sortable = false;
	}
	
	this.citationItems = [];
	if(citationItems) this.add(citationItems);
	
	// reserved for application use
	this.properties = {};
}

/*
 * sorts a citation
 */
Zotero.CSL.Citation.prototype.sort = function() {
	if(this.sortable) {
		this.citationItems = this._csl.cachedSort(this.citationItems, this._citation, "item");
	}
}

/*
 * adds a citationItem to a citation
 */
Zotero.CSL.Citation.prototype.add = function(citationItems) {
	for(var i=0; i<citationItems.length; i++) {
		var citationItem = citationItems[i];
		
		if(citationItem instanceof Zotero.CSL.Item
				|| citationItem instanceof Zotero.Item) {
			this.citationItems.push(new Zotero.CSL.CitationItem(citationItem));
		} else {
			this.citationItems.push(citationItem);
		}
	}
}

/*
 * removes a citationItem from a citation
 */
Zotero.CSL.Citation.prototype.remove = function(citationItems) {
	for each(var citationItem in citationItems){
		var index = this.citationItems.indexOf(citationItem);
		if(index == -1) throw "Zotero.CSL.Citation: tried to remove an item not in citation";
		this.citationItems.splice(index, 1);
	}
}

/*
 * copies a citation
 */
Zotero.CSL.Citation.prototype.clone = function() {
	var clone = new Zotero.CSL.Citation();
	
	// copy items
	for(var i=0; i<this.citationItems.length; i++) {
		var oldCitationItem = this.citationItems[i];
		var newCitationItem = new Zotero.CSL.CitationItem();
		for(var key in oldCitationItem) {
			newCitationItem[key] = oldCitationItem[key];
		}
		clone.citationItems.push(newCitationItem);
	}
	
	// copy properties
	for(var key in this.properties) {
		clone.properties[key] = this.properties[key];
	}
	
	return clone;
}

/*
 * This is an item wrapper class for Zotero items. If converting this code to
 * work with another application, this is what needs changing. Potentially, this
 * function could accept an ID or an XML data structure instead of an actual
 * item, provided it implements the same public interfaces (those not beginning
 * with "_") are implemented.
 */
Zotero.CSL.Item = function(item) {
	if(item instanceof Zotero.Item) {
		this.zoteroItem = item;
	} else if(parseInt(item, 10) == item) {
		// is an item ID
		this.zoteroItem = Zotero.Items.get(item);
	}
	
	if(!this.zoteroItem) {
		throw "Zotero.CSL.Item called to wrap a non-item";
	}
	
	this.id = this.zoteroItem.id;
	
	// don't return URL or accessed information for journal articles if a
	// pages field exists
	var itemType = Zotero.ItemTypes.getName(this.zoteroItem.itemTypeID);
	if(!Zotero.Prefs.get("export.citePaperJournalArticleURL") 
			&& ["journalArticle", "newspaperArticle", "magazineArticle"].indexOf(itemType) !== -1
			&& this.zoteroItem.getField("pages")) {
		this._ignoreURL = true;
	}
	
	this._properties = {};
	this._refreshItem();
}


/**
 * Returns some identifier for the item. Used to create citations. In Zotero,
 * this is the item ID
 *
 * @deprecated
 **/
Zotero.CSL.Item.prototype.getID = function() {
	Zotero.debug("Zotero.CSL.Item.getID() deprecated; use Zotero.CSL.Item.id");
	return this.zoteroItem.id;
}

/**
 * Refreshes item if it has been modified
 */
Zotero.CSL.Item.prototype._refreshItem = function() {
	var previousChanged = this._lastChanged;
	this._lastChanged = this.zoteroItem.getField("dateModified", false, true);
	
	if(this._lastChanged != previousChanged) {
		this._names = undefined;
		this._dates = {};
	}
}

/*
 * Mappings for names
 */
Zotero.CSL.Item._zoteroNameMap = {
	"collection-editor":"seriesEditor"
}

/*
 * Gets an array of Item.Name objects for a variable.
 */
Zotero.CSL.Item.prototype.getNames = function(variable) {
	var field = Zotero.CSL.Item._zoteroNameMap[variable];
	if (field) variable = field;
	this._refreshItem();
	if(!this._names) {
		this._separateNames();
	}
	
	if(this._names[variable]) {
		return this._names[variable];
	}
	return [];
}

/*
 * Gets an Item.Date object for a specific type.
 */
Zotero.CSL.Item.prototype.getDate = function(variable) {
	// ignore accessed date
	if(this._ignoreURL && variable == "accessed") return false;
	
	// load date variable if possible
	this._refreshItem();
	if(this._dates[variable] == undefined) {
		this._createDate(variable);
	}
	
	if(this._dates[variable]) return this._dates[variable];
	return false;
}

Zotero.CSL.Item._zoteroFieldMap = {
	"long":{
		"title":"title",
		"container-title":["publicationTitle",  "reporter", "code"], /* reporter and code should move to SQL mapping tables */
		"collection-title":["seriesTitle", "series"],
		"collection-number":"seriesNumber",
		"publisher":["publisher", "distributor"], /* distributor should move to SQL mapping tables */
		"publisher-place":"place",
		"authority":"court",
		"page":"pages",
		"volume":"volume",
		"issue":"issue",
		"number-of-volumes":"numberOfVolumes",
		"edition":"edition",
		"version":"version",
		"section":"section",
		"genre":["type", "artworkSize"], /* artworkSize should move to SQL mapping tables, or added as a CSL variable */
		"medium":"medium",
		"archive":"repository",
		"archive_location":"archiveLocation",
		"event":["meetingName", "conferenceName"], /* these should be mapped to the same base field in SQL mapping tables */
		"event-place":"place",
		"abstract":"abstractNote",
		"URL":"url",
		"DOI":"DOI",
		"ISBN" : "ISBN",
		"call-number":"callNumber",
		"note":"extra",
		"number":"number",
		"references":"history"
	},
	"short":{
		"title":["shortTitle", "title"],
		"container-title":"journalAbbreviation",
		"genre":["shortTitle", "type"] /* needed for subsequent citations of items with no title */ 
	}
}

/*
 * Gets a text object for a specific type.
 */
Zotero.CSL.Item.prototype.getVariable = function(variable, form) {
	if(!Zotero.CSL.Item._zoteroFieldMap["long"][variable]) return "";
	
	// ignore URL
	if(this._ignoreURL && variable == "URL") return ""
	
	var zoteroFields = [];
	var field;
	
	if(form == "short" && Zotero.CSL.Item._zoteroFieldMap["short"][variable]) {
		field = Zotero.CSL.Item._zoteroFieldMap["short"][variable];
		if(typeof field == "string") {
			zoteroFields.push(field);
		} else {
			zoteroFields = zoteroFields.concat(field);
		}
	}
	
	field = Zotero.CSL.Item._zoteroFieldMap["long"][variable];
	if(typeof field == "string") {
		zoteroFields.push(field);
	} else {
		zoteroFields = zoteroFields.concat(field);
	}
	
	for each(var zoteroField in zoteroFields) {
		var value = this.zoteroItem.getField(zoteroField, false, true).toString();
		if(value != "") {
			// Strip enclosing quotes
			if(value.match(Zotero.CSL._quotedRegexp)) {
				value = value.substr(1, value.length-2);
			}
			return value;
		}
	}
	
	return "";
}

/*
 * convert a number into a ordinal number 1st, 2nd, 3rd etc.
 */
Zotero.CSL.Item.prototype.makeOrdinal = function(value) {
	var ind = parseInt(value);
	var daySuffixes = Zotero.getString("date.daySuffixes").replace(/, ?/g, "|").split("|");
	value += (parseInt(ind/10)%10) == 1 ? daySuffixes[3] : (ind % 10 == 1) ? daySuffixes[0] : (ind % 10 == 2) ? daySuffixes[1] : (ind % 10 == 3) ? daySuffixes[2] : daySuffixes[3];
	return value;
}


Zotero.CSL.Item._zoteroRomanNumerals = {
	"0" : [ "", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix" ],
	"1" : [ "", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc" ],
	"2" : [ "", "c", "cc", "ccc", "cd", "d", "dc", "dcc", "dccc", "cm" ],
	"3" : [ "", "m", "mm", "mmm", "mmmm", "mmmmm"],
	}

/*
 * Convert a number into a roman numeral.
 */
Zotero.CSL.Item.prototype.makeRoman = function(value) {

	var number = parseInt(value);
	var result = "";
	if (number > 5000) return "";
	var thousands = parseInt(number/1000);
	if (thousands > 0) {
		result += Zotero.CSL.Item._zoteroRomanNumerals[3][thousands];
	}
	number = number % 1000;
	var hundreds = parseInt(number/100);
	if (hundreds > 0) {
		result += Zotero.CSL.Item._zoteroRomanNumerals[2][hundreds];
	}
	number = number % 100;
	var tens = parseInt(number/10);
	if (tens > 0) {
		result += Zotero.CSL.Item._zoteroRomanNumerals[1][tens];
	}
	number = number % 10;
	if (number > 0) {
		result += Zotero.CSL.Item._zoteroRomanNumerals[0][number];
	}
	return result;
}

Zotero.CSL.Item._zoteroNumberFieldMap = {
	"volume":"volume",
	"issue":"issue",
	"number-of-volumes":"numberOfVolumes",
	"edition":"edition",
	"number":"number"
}
/*
 * Gets a numeric object for a specific type. <number variable="edition" form="roman"/>
 */
Zotero.CSL.Item.prototype.getNumericVariable = function(variable, form) {

	if(!Zotero.CSL.Item._zoteroNumberFieldMap[variable]) return "";
	
	var zoteroFields = [];
	var field;
	
	field = Zotero.CSL.Item._zoteroNumberFieldMap[variable];
	if(typeof field == "string") {
		zoteroFields.push(field);
	} else {
		zoteroFields = zoteroFields.concat(field);
	}
	
	var matches;
	for each(var zoteroField in zoteroFields) {
		var value = this.zoteroItem.getField(zoteroField, false, true).toString();
		
		// Quoted strings are never numeric
		if(value.match(Zotero.CSL._quotedRegexp)) {
			continue;
		}
		
		var matches;
		if(value != "" && (matches = value.match(Zotero.CSL._numberRegexp)) ) {
			value = matches[0];
			if (form == "ordinal") {
				return this.makeOrdinal(value);
			}
			else if (form == "roman") { 
				return this.makeRoman(value);
			}
			else
				return value;
		}
	}
	return "";
}

/*
 * Sets an item-specific property to a given value.
 */
Zotero.CSL.Item.prototype.setProperty = function(property, value) {
	this._properties[property] = value;
}

/*
 * Sets an item-specific property to a given value.
 */
Zotero.CSL.Item.prototype.getProperty = function(property, value) {
	return (this._properties[property] !== undefined ? this._properties[property] : "");
}

Zotero.CSL.Item._optionalTypeMap = {
	journalArticle:"article-journal",
	magazineArticle:"article-magazine",
	newspaperArticle:"article-newspaper",
	thesis:"thesis",
	conferencePaper:"paper-conference",
	letter:"personal_communication",
	manuscript:"manuscript",
	interview:"interview",
	film:"motion_picture",
	artwork:"graphic",
	webpage:"webpage",
	report:"report",
	bill:"bill",
	case:"legal_case",
	hearing:"bill",				// ??
	patent:"patent",
	statute:"bill",				// ??
	email:"personal_communication",
	map:"map",
	blogPost:"webpage",
	instantMessage:"personal_communication",
	forumPost:"webpage",
	audioRecording:"song",		// ??
	presentation:"speech",
	videoRecording:"motion_picture",
	tvBroadcast:"broadcast",
	radioBroadcast:"broadcast",
	podcast:"song",			// ??
	computerProgram:"book"		// ??
};

// TODO: check with Elena/APA/MLA on this
Zotero.CSL.Item._fallbackTypeMap = {
	book:"book",
	bookSection:"chapter",
	journalArticle:"article",
	magazineArticle:"article",
	newspaperArticle:"article",
	thesis:"article",
	encyclopediaArticle:"chapter",
	dictionaryEntry:"chapter",
	conferencePaper:"chapter",
	letter:"article",
	manuscript:"article",
	interview:"article",
	film:"book",
	artwork:"book",
	webpage:"article",
	report:"book",
	bill:"book",
	case:"book",
	hearing:"book",
	patent:"article",
	statute:"book",
	email:"article",
	map:"article",
	blogPost:"article",
	instantMessage:"article",
	forumPost:"article",
	audioRecording:"book",
	presentation:"article",
	videoRecording:"book",
	tvBroadcast:"article",
	radioBroadcast:"article",
	podcast:"article",
	computerProgram:"book"
};

/*
 * Determines whether this item is of a given type
 */
Zotero.CSL.Item.prototype.isType = function(type) {
	var zoteroType = Zotero.ItemTypes.getName(this.zoteroItem.itemTypeID);
	
	return (Zotero.CSL.Item._optionalTypeMap[zoteroType]
		&& Zotero.CSL.Item._optionalTypeMap[zoteroType] == type)
		|| (Zotero.CSL.Item._fallbackTypeMap[zoteroType] ? Zotero.CSL.Item._fallbackTypeMap[zoteroType] : "article") == type;
}

/*
 * Separates names into different types.
 */
Zotero.CSL.Item.prototype._separateNames = function() {
	this._names = [];
	
	var authorID = Zotero.CreatorTypes.getPrimaryIDForType(this.zoteroItem.itemTypeID);
	
	var creators = this.zoteroItem.getCreators();
	for each(var creator in creators) {
		if(creator.creatorTypeID == authorID) {
			var variable = "author";
		} else {
			var variable = Zotero.CreatorTypes.getName(creator.creatorTypeID);
		}
		
		var name = new Zotero.CSL.Item.Name(creator);
		
		if(!this._names[variable]) {
			this._names[variable] = [name];
		} else {
			this._names[variable].push(name);
		}
	}
}

/*
 * Generates an date object for a given variable (currently supported: issued
 * and accessed)
 */
Zotero.CSL.Item.prototype._createDate = function(variable) {
	// first, figure out what date variable to use.
	if(variable == "issued") {
		var date = this.zoteroItem.getField("date", false, true);
		var sort = this.zoteroItem.getField("date", true, true);
	} else if(variable == "accessed") {
		var date = this.zoteroItem.getField("accessDate", false, true);
		var sort = this.zoteroItem.getField("accessDate", true, true);
	}
	
	if(date) {
		this._dates[variable] = new Zotero.CSL.Item.Date(date, sort);
	} else {
		this._dates[variable] = false;
	}
}

/*
 * Date class
 */
Zotero.CSL.Item.Date = function(date, sort) {
	this.date = date;
	this.sort = sort;
}

/*
 * Should accept the following variables:
 *
 * year - returns a year (optionally, with attached B.C.)
 * month - returns a month (numeric from 0, or, if numeric is not available, long)
 * day - returns a day (numeric)
 * sort - a date that can be used for sorting purposes
 */
Zotero.CSL.Item.Date.prototype.getDateVariable = function(variable) {
	if(this.date) {
		if(variable == "sort") {
			return this.sort;
		}
		
		if(!this.dateArray) {
			this.dateArray = Zotero.Date.strToDate(this.date);
		}
		
		if(this.dateArray[variable] !== undefined && this.dateArray[variable] !== false) {
			return this.dateArray[variable];
		} else if(variable == "month") {
			if(this.dateArray.part) {
				return this.dateArray.part;
			}
		}
	}
	
	return "";
}

/*
 * Name class
 */
Zotero.CSL.Item.Name = function(zoteroCreator) {
	this._zoteroCreator = zoteroCreator;
}

/*
 * Should accept the following variables:
 *
 * firstName - first name
 * lastName - last name
 */
Zotero.CSL.Item.Name.prototype.getNameVariable = function(variable) {
	return this._zoteroCreator.ref[variable] ? this._zoteroCreator.ref[variable] : "";
}

/*
 * When an array of items are passed to create a new item set, each is wrapped
 * in an item wrapper.
 */
Zotero.CSL.ItemSet = function(items, csl) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	this.csl = csl;
	
	this.citation = csl._csl.citation;
	this.bibliography = csl._csl.bibliography;
	
	// collect options
	this.options = new Object();
	var options = this.citation.option.(@name.substr(0, 12) == "disambiguate")
		+ this.bibliography.option.(@name == "subsequent-author-substitute");
	for each(var option in options) {
		this.options[option.@name.toString()] = option.@value.toString();
	}
	
	// check for disambiguate condition
	for each(var thisIf in csl._csl..if) {
		if(thisIf.@disambiguate.length()) {
			this.options["disambiguate-condition"] = true;
			break;
		}
	}
	
	// check for citation number
	for each(var thisText in csl._csl..text) {
		if(thisText.@variable == "citation-number") {
			this.options["citation-number"] = true;
			break;
		}
	}
	
	// set sortable
	this.sortable = !!this.bibliography.sort.key.length();
	
	this.items = [];
	this.itemsById = {};
	
	// add items
	this.add(items);
	
	// check which disambiguation options are enabled
	this._citationChangingOptions = new Array();
	this._disambiguate = false;
	for(var option in this.options) {
		if(option.substr(0, 12) == "disambiguate" && this.options[option]) {
			this._citationChangingOptions.push(option);
			this._disambiguate = true;
		} else if(option == "citation-number" && this.options[option]) {
			this._citationChangingOptions.push(option);
		}
	}
	
	if(!items) {
		return;
	}
	
	this.resort();
}


/**
 * Gets CSL.Item objects from an item set using their ids
 *
 * @param {Array} ids An array of ids
 * @return {Array} items An array whose indexes correspond to those of ids, whose values are either 
 *                       the CSL.Item objects or false
 **/
Zotero.CSL.ItemSet.prototype.getItemsByIds = function(ids) {
	var items = [];
	for each(var id in ids) {
		if(this.itemsById[id] != undefined) {
			items.push(this.itemsById[id]);
		} else {
			items.push(false);
		}
	}
	return items;
}

/*
 * Adds items to the given item set; must be passed either CSL.Item 
 * objects or objects that may be wrapped as CSL.Item objects
 */
Zotero.CSL.ItemSet.prototype.add = function(items) {
	var newItems = new Array();
	
	for(var i in items) {
		if(items[i] instanceof Zotero.CSL.Item) {
			var newItem = items[i];
		} else {
			var newItem = new Zotero.CSL.Item(items[i]);
		}
		
		newItem.setProperty("index", this.items.length);
		
		this.itemsById[newItem.id] = newItem;
		this.items.push(newItem);
		newItems.push(newItem);
	}
	
	return newItems;
}

/*
 * Removes items from the item set; must be passed either CSL.Item objects
 * or item IDs
 */
Zotero.CSL.ItemSet.prototype.remove = function(items) {
	for(var i in items) {
		if(!items[i]) continue;
		if(items[i] instanceof Zotero.CSL.Item) {
			var item = items[i];
		} else {
			var item = this.itemsById[items[i]];
		}
		if(item) {
			this.itemsById[item.id] = undefined;
			this.items.splice(this.items.indexOf(item), 1);
		}
	}
}

/*
 * Sorts the item set, also running postprocessing and returning items whose
 * citations have changed
 */
Zotero.CSL.ItemSet.prototype.resort = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	// sort
	this.items = this.csl.cachedSort(this.items, this.bibliography);
	
	// first loop through to collect disambiguation data by item, so we can
	// see if any items have changed; also collect last names
	var oldOptions = new Array();
	for(var i in this._citationChangingOptions) {
		oldOptions[i] = new Array();
		for(var j in this.items) {
			if(this.items[j] == undefined) continue;
			oldOptions[i][j] = this.items[j].getProperty(this._citationChangingOptions[i]);
			this.items[j].setProperty(this._citationChangingOptions[i], "");
		}
	}
	
	var namesByItem = new Object();
	for(var i=0; i<this.items.length; i++) {
		var names = this.items[i].getNames("author");
		if(!names) names = this.items[i].getNames("editor");
		if(!names) names = this.items[i].getNames("translator");
		if(!names) names = this.items[i].getNames("recipient");
		if(!names) names = this.items[i].getNames("interviewer");
		if(!names) names = this.items[i].getNames("collection-editor");
		if(!names) continue;
		namesByItem[i] = names;
	}
	
	// check where last names are the same but given names are different
	if(this.options["disambiguate-add-givenname"]) {
		var firstNamesByItem = new Object();
		var allNames = new Object();
		var nameType = new Object();
		
		for(var i=0; i<this.items.length; i++) {
			var names = namesByItem[i];
			var firstNames = [];
			for(var j=0; j<names.length; j++) {
				// get firstName and lastName
				var m = Zotero.CSL._firstNameRegexp.exec(names[j].getNameVariable("firstName"));
				var firstName = m[0].toLowerCase();
				firstNames.push(firstName);
				if(!firstName) continue;
				var lastName = names[j].getNameVariable("lastName");
				
				// add last name
				if(!allNames[lastName]) {
					allNames[lastName] = [firstName];
				} else if(allNames[lastName].indexOf(firstName) == -1) {
					allNames[lastName].push(firstName);
				}
			}
			
			firstNamesByItem[i] = firstNames;
		}
		
		// loop through last names
		for(var i=0; i<this.items.length; i++) {
			if(!namesByItem[i]) continue;
			
			var nameFormat = new Array();
			for(var j=0; j<namesByItem[i].length; j++) {
				var lastName = namesByItem[i][j].getNameVariable("lastName");
				if(nameType[lastName] === undefined) {
					// determine how to format name
					var theNames = allNames[lastName];
					if(theNames && theNames.length > 1) {
						// have two items with identical last names but different
						// first names
						nameType[lastName] = Zotero.CSL.NAME_USE_INITIAL;	
						
						// check initials to see if any match
						var initials = new Object();
						for(var k=0; k<theNames.length; k++) {
							if(initials[theNames[k][0]]) {
								nameType[lastName] = Zotero.CSL.NAME_USE_FULL;
								break;
							}
							initials[theNames[k][0]] = true;
						}
					}
				}
				
				nameFormat[j] = nameType[lastName];
			}
			
			if(nameFormat.length) {
				// if some names have special formatting, save
				this.items[i].setProperty("disambiguate-add-givenname", nameFormat.join(","));
			}
		}
	}
	
	// loop through once to determine where items equal the previous item
	if(this._disambiguate && this.items.length) {
		var citationsEqual = this.csl.getEqualCitations(this.items, this.citation);
	}
	
	var allNames = {};
	
	var lastItem = false;
	var lastNames = false;
	var lastYear = false;
	var citationNumber = 1;
	
	for(var i=0; i<this.items.length; i++) {
		var item = this.items[i];
		if(item == undefined) continue;
		
		var year = item.getDate("issued");
		if(year) year = year.getDateVariable("year");
		var names = namesByItem[i];
		var disambiguated = false;
		
		if(this._disambiguate && i != 0 && citationsEqual[i] == true) {
			// some options can only be applied if there are actual authors
			if(names && lastNames && this.options["disambiguate-add-names"]) {
				// try adding names to disambiguate
				var oldAddNames = lastItem.getProperty("disambiguate-add-names");
				
				// if a different number of names, disambiguation is
				// easy, although we should still see if there is a
				// smaller number of names that works
				var numberOfNames = names.length;
				if(numberOfNames > lastNames.length) {
					numberOfNames = lastNames.length;
					item.setProperty("disambiguate-add-names", numberOfNames+1);
					
					// have to check old property
					if(!oldAddNames || oldAddNames < numberOfNames) {
						lastItem.setProperty("disambiguate-add-names", numberOfNames);
					}
					
					disambiguated = true;
				} else if(numberOfNames != lastNames.length) {
					item.setProperty("disambiguate-add-names", numberOfNames);
					
					// have to check old property
					if(!oldAddNames || oldAddNames < numberOfNames+1) {
						lastItem.setProperty("disambiguate-add-names", numberOfNames+1);
					}
					
					disambiguated = true;
				}
			}
			
			// now, loop through and see whether there's a
			// dissimilarity before the end
			var namesDiffer = false;
			for(var j=0; j<numberOfNames; j++) {
				namesDiffer = (names[j].getNameVariable("lastName") != lastNames[j].getNameVariable("lastName")
						|| (firstNamesByItem && firstNamesByItem[i][j] != firstNamesByItem[i-1][j]));
				if(this.options["disambiguate-add-names"] && namesDiffer) {
					item.setProperty("disambiguate-add-names", j+1);
					
					if(!oldAddNames || oldAddNames < j+1) {
						lastItem.setProperty("disambiguate-add-names", j+1);
					}
					
					disambiguated = true;
				}
				
				if(namesDiffer) {
					break;
				}
			}
			
			// add a year suffix, if the above didn't work
			if(!disambiguated && year && !namesDiffer && this.options["disambiguate-add-year-suffix"]) {
				var lastDisambiguate = lastItem.getProperty("disambiguate-add-year-suffix");
				if(!lastDisambiguate) {
					lastItem.setProperty("disambiguate-add-year-suffix", "a");
					item.setProperty("disambiguate-add-year-suffix", "b");
				} else {
					var newDisambiguate = "";
					var charCode = lastDisambiguate.charCodeAt(lastDisambiguate.length-1);
					if(charCode == 122) {
						newDisambiguate = lastDisambiguate.replace(/z+$/, "");
						var consecutiveZs = lastDisambiguate.length-newDisambiguate.length;
						if(newDisambiguate.length >= 1) {
							var nonZCharCode = lastDisambiguate.charCodeAt(newDisambiguate.length-1);
							newDisambiguate = newDisambiguate.substring(0,newDisambiguate.length-1);
							newDisambiguate += String.fromCharCode(nonZCharCode+1);
							for(i=0;i<consecutiveZs;i++) {
								newDisambiguate += "a";
							}
						}
						else  {
							newDisambiguate = lastDisambiguate.replace(/z/g, "a");
							newDisambiguate += "a";
						}
					}
					else  {
						// next lowercase letter
						newDisambiguate = lastDisambiguate.substring(0,lastDisambiguate.length-1);
						newDisambiguate += String.fromCharCode(charCode+1);
					}
					
					item.setProperty("disambiguate-add-year-suffix", newDisambiguate);
				}
				
				disambiguated = true;
			}
			
			// use disambiguate condition if above didn't work
			if(!disambiguated && this.options["disambiguate-condition"]) {
				var oldCondition = lastItem.getProperty("disambiguate-condition");
				lastItem.setProperty("disambiguate-condition", true);
				item.setProperty("disambiguate-condition", true);
				
				// if we cannot disambiguate with the conditional, revert
				if(this.csl.compareCitations(lastItem, item) == 0) {
					if(!oldCondition) {
						lastItem.setProperty("disambiguate-condition", undefined);
					}
					item.setProperty("disambiguate-condition", undefined);
				}
			}
		}
		
		if(this.options["subsequent-author-substitute"]
				&& lastNames && names.length && lastNames.length == names.length) {
			var namesDiffer = false;
			for(var j=0; j<names.length; j++) {
				namesDiffer = (names[j].getNameVariable("lastName") != lastNames[j].getNameVariable("lastName")
						|| (names[j].getNameVariable("firstName") != lastNames[j].getNameVariable("firstName")));
				if(namesDiffer) break;
			}
			
			if(!namesDiffer) item.setProperty("subsequent-author-substitute", true);
		}
		
		item.setProperty("citation-number", citationNumber++);

		lastItem = item;
		lastNames = names;
		lastYear = year;
	}
	
	// find changed citations
	var changedCitations = new Array();
	for(var j in this.items) {
		if(this.items[j] == undefined) continue;
		for(var i in this._citationChangingOptions) {
			if(this.items[j].getProperty(this._citationChangingOptions[i]) != oldOptions[i][j]) {
				changedCitations.push(this.items[j]);
			}
		}
	}
	
	return changedCitations;
}

/*
 * Copies disambiguation settings (with the exception of disambiguate-add-year-suffix)
 * from one item to another
 */
Zotero.CSL.ItemSet.prototype._copyDisambiguation = function(fromItem, toItem) {
	for each(var option in ["disambiguate-add-givenname", "disambiguate-add-names",
			"disambiguate-add-title"]) {
		var value = fromItem.getProperty(option);
		if(value) {
			toItem.setProperty(option, value);
		}
	}
}

Zotero.CSL.FormattedString = function(context, format, delimiter, subsequent) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	this.context = context;
	this.option = context ? context.option : new XMLList();
	this.format = format;
	this.delimiter = delimiter;
	this.string = "";
	this.closePunctuation = "";
	this.closeFormatting = "";
	this.useBritishStyleQuotes = false;
	
	// insert tab iff second-field-align is on
	this.insertTabAfterField = (!subsequent && this.option.(@name == "second-field-align").@value.toString());
	this.insertTabBeforeField = false;
	// append line before next
	this.prependLine = false;
	
	if(format == "RTF") {
		this._openQuote = "\\uc0\\u8220 ";
		this._closeQuote = "\\uc0\\u8221 ";
	} else {
		this._openQuote = "\u201c";
		this._closeQuote = "\u201d";
	}
}

Zotero.CSL.FormattedString._punctuation = "!.,?:";

/*
 * attaches another formatted string to the end of the current one
 */
Zotero.CSL.FormattedString.prototype.concat = function(formattedString, element) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(!formattedString || !formattedString.string) {
		return false;
	}
	
	if(formattedString.format != this.format) {
		throw "CSL: cannot concatenate formatted strings: formats do not match";
	}
	
	var haveAppended = false;
	var suffix = false;
	if(formattedString.string !== "") {
		// first, append the actual string without its suffix
		if(element && element.@suffix.length()) {
			// don't edit original element
			element = element.copy();
			// let us decide to add the suffix
			suffix = element.@suffix.toString();
			element.@suffix = [];
		}
		haveAppended = this.append(formattedString.string, element, false, true);
	}
	
	// if there's close punctuation to append, that also counts
	if(formattedString.closePunctuation || formattedString.closeFormatting) {
		haveAppended = true;
		// add the new close punctuation
		this.closeFormatting += formattedString.closeFormatting;
		this.closePunctuation += formattedString.closePunctuation;
	}
	
	// append suffix, if we didn't before
	if(haveAppended && suffix !== false) this.append(suffix, null, true);
	
	return haveAppended;
}

Zotero.CSL.FormattedString._rtfEscapeFunction = function(aChar) {
	return "{\\uc0\\u"+aChar.charCodeAt(0).toString()+"}"
}

/*
 * appends a string (with format parameters) to the current one
 */
Zotero.CSL.FormattedString.prototype.append = function(string, element, dontDelimit, dontEscape) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(!string && string !== 0) return false;
	
	if(typeof(string) != "string") {
		string = string.toString();
	}
	
	// get prefix
	var prefix = "";
	if(element && element.@prefix.length()) {
		var prefix = element.@prefix.toString();
	}
	
	// append tab before if necessary
	if(!dontDelimit && this.insertTabBeforeField) {
		// replace any space preceding tab
		this.string = this.string.replace(/\s+$/, "");
		
		if(this.format == "HTML") {
			this.string += '</td><td style="padding-left:4pt;">';
		} else if(this.format == "RTF") {
			this.string += "\\tab ";
		} else if(this.format == "Integration") {
			this.string += "\t";
		} else {
			this.string += " ";
		}
		
		this.insertTabBeforeField = false;
		if(prefix !== "") {
			prefix = prefix.replace(/^\s+/, "");
		} else {
			string = string.replace(/^\s+/, "");
		}
	}
	
	// append delimiter if necessary
	if(this.delimiter && this.string && !dontDelimit) {
		this.append(this.delimiter, null, true);
	}
	
	// append prefix before closing punctuation
	if(prefix !== "") {
		this.append(prefix, null, true);
	}
	
	var addBefore = "";
	var addAfter = "";
	
	// prepend line before if display="block"
	if(element && (element["@display"] == "block" || this.prependLine)) {
		if(this.format == "HTML") {
			if(this.option.(@name == "hanging-indent").@value == "true") {
				addBefore += '<div style="text-indent:0.5in;">'
			} else {
				addBefore += '<div>';
			}
			addAfter = '</div>';
		} else {
			if(this.format == "RTF") {
				addBefore += "\r\n\\line ";
			} else if(this.format == "Integration") {
				addBefore += "\x0B";
			} else {
				addBefore += (Zotero.isWin ? "\r\n" : "\n");
			}
			this.prependLine = element["@display"] == "block";
		}
	}
	
	// close quotes, etc. using punctuation
	if(this.closePunctuation) {
		if(Zotero.CSL.FormattedString._punctuation.indexOf(string[0]) != -1) {
			this.string += string[0];
			string = string.substr(1);
		}
		this.string += this.closePunctuation;
		this.closePunctuation = "";
	}
	
	// clean up
	if(string.length && string[0] == "." &&
	   Zotero.CSL.FormattedString._punctuation.indexOf(this.string[this.string.length-1]) != -1) {
	   // if string already ends in punctuation, preserve the existing stuff
	   // and don't add a period
		string = string.substr(1);
	} else if(this.string[this.string.length-1] == "(" && string[0] == " ") {
		string = string.substr(1);
	} else if(this.string[this.string.length-1] == " " && string[0] == ")") {
		this.string = this.string.substr(0, this.string.length-1);
	}
	
	// close previous formatting
	this.string += this.closeFormatting;
	this.closeFormatting = "";
	
	// handling of "text-transform" attribute (now obsolete)
	if(element && element["@text-transform"].length() && !element["@text-case"].length()) {
		var mapping = {"lowercase":"lowercase", "uppercase":"uppercase", "capitalize":"capitalize-first"};
		element["@text-case"] = mapping[element["@text-transform"].toString()];
	}
	
	// handle text case
	if(element) {
		if(element["@text-case"].length()) {
			if(element["@text-case"] == "lowercase") {
				// all lowercase
				string = string.toLowerCase();
			} else if(element["@text-case"] == "uppercase") {
				// all uppercase
				string = string.toUpperCase();
			} else if(element["@text-case"] == "sentence") {
				// for now capitalizes only the first letter, the rest are lowercase
				string = string[0].toUpperCase()+string.substr(1).toLowerCase();
			} else if(element["@text-case"] == "capitalize-first") {
				// capitalize first
				string = string[0].toUpperCase()+string.substr(1);
			} else if(element["@text-case"] == "capitalize-all") {
				// capitalize first
				var strings = string.split(" ");
				for(var i=0; i<strings.length; i++) {
					if(strings[i].length > 1) {
						strings[i] = strings[i][0].toUpperCase()+strings[i].substr(1).toLowerCase();
					} else if(strings[i].length == 1) {
						strings[i] = strings[i].toUpperCase();
					}
				}
				string = strings.join(" ");
			} else if(element["@text-case"] == "title") {
				string = Zotero.Text.titleCase(string);
			}
		}
		
		// style attributes
		if(this.format == "HTML") {
			var style = "";
			
			var cssAttributes = ["font-family", "font-style", "font-variant",
						"font-weight", "vertical-align", "display",
						"text-decoration" ];
			for(var j in cssAttributes) {
				var value = element["@"+cssAttributes[j]].toString();
				if(value && value.indexOf('"') == -1) {
					style += cssAttributes[j]+":"+value+";";
				}
			}
			
			if(style) {
				addBefore += '<span style="'+style+'">';
				addAfter = '</span>'+addAfter;
			}
		} else {
			if(this.format == "RTF" || this.format == "Integration") {
				var rtfAttributes = {
					"font-style":{"oblique":"i", "italic":"i"},
					"font-variant":{"small-caps":"scaps"},
					"font-weight":{"bold":"b"},
					"text-decoration":{"underline":"ul"},
					"vertical-align":{"sup":"super", "sub":"sub"}
				}
				
				for(var j in rtfAttributes) {
					for(var k in rtfAttributes[j]) {
						if(element["@"+j] == k) {
							addBefore += "\\"+rtfAttributes[j][k]+" ";
							addAfter = "\\"+rtfAttributes[j][k]+"0 "+addAfter;
						}
					}
				}
			}
		}
	
		// add quotes if necessary
		if(element.@quotes == "true") {
			this.string += this._openQuote;
			
			if(this.useBritishStyleQuotes) {
				string += this._closeQuote;
			} else {
				this.closePunctuation = this._closeQuote;
			}
		}
	}
	
	if(!dontEscape) {
		if(this.format == "HTML") {
			string = string.replace("&", "&amp;", "g")
							.replace("<", "&lt;", "g")
							.replace(">", "&gt;", "g")
							.replace(/(\r\n|\r|\n)/g, "<br />")
							.replace(/[\x00-\x1F]/g, "");
		} else if(this.format == "RTF" || this.format == "Integration") {
			string = string.replace("\\", "\\\\", "g")
							.replace(/(\r\n|\r|\n)/g, "\\line ");
			if(string.substr(string.length-6) == "\\line ") {
				string = string.substr(0, string.length-6);
				addAfter = "\\line "+addAfter;
			}
			
			if(this.format == "RTF") {
				string = string.replace(/[\x7F-\uFFFF]/g, Zotero.CSL.FormattedString._rtfEscapeFunction)
							.replace("\t", "\\tab ", "g");
				
				if(string.substr(string.length-5) == "\\tab ") {
					string = string.substr(0, string.length-5);
					addAfter = "\\tab "+addAfter;
				}
			}
		} else {
			string = string.replace(/(\r\n|\r|\n)/g, (Zotero.isWin ? "\r\n" : "\n"));
		}
	}
	
	this.string += addBefore+string;
	
	if(element && element.@suffix.length()) {
		this.append(element.@suffix.toString(), null, true);
	}
	
	// save for second-field-align
	if(!dontDelimit && this.insertTabAfterField) {
		this.insertTabAfterField = false;
		this.insertTabBeforeField = true;
	}
	
	this.closeFormatting = addAfter;
	
	return true;
}

/*
 * gets the formatted string
 */
Zotero.CSL.FormattedString.prototype.get = function() {
	return this.string+this.closeFormatting+this.closePunctuation;
}

/*
 * creates a new formatted string with the same formatting parameters as this one
 */
Zotero.CSL.FormattedString.prototype.clone = function(delimiter) {
	return new Zotero.CSL.FormattedString(this.context, this.format, delimiter, true);
}

/*
 * Implementation of FormattedString for sort purposes.
 */
Zotero.CSL.SortString = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl";
	
	this.format = "Sort";
	this.string = [];
}

Zotero.CSL.SortString.prototype.concat = function(newString) {
	if(newString.string.length == 0) {
		return;
	} else if(newString.string.length == 1) {
		this.string.push(newString.string[0]);
	} else {
		this.string.push(newString.string);
	}
}

Zotero.CSL.SortString.prototype.append = function(newString) {
	this.string.push(newString);
}

Zotero.CSL.SortString.prototype.compare = function(b, a) {
	// by default, a is this string
	if(a == undefined) {
		a = this.string;
		b = b.string;
	}
	
	var aIsString = typeof(a) != "object";
	var bIsString = typeof(b) != "object";
	if(aIsString && bIsString) {
		if(a == b) {
			return 0;
		} else if(!isNaN(a % 1) && !isNaN(b % 1)) {
			// both numeric
			if(b > a) return -1;
			return 1;	// already know they're not equal
		} else {
			var cmp = Zotero.CSL.Global.collation.compareString(Zotero.CSL.Global.collation.kCollationCaseInSensitive, a, b);
			if(cmp == 0) {
				// for some reason collation service returned 0; the collation
				// service sucks! they can't be equal!
				if(b > a) {
					return -1;
				} else {
					return 1;
				}
			}
			return cmp;
		}
	} else if(aIsString && !bIsString) {
		var cmp = this.compare(b[0], a);
		if(cmp == 0) {
			return -1;	// a before b
		}
		return cmp;
	} else if(bIsString && !aIsString) {
		var cmp = this.compare(b, a[0]);
		if(cmp == 0) {
			return 1;	// b before a
		}
		return cmp;
	}
	
	var maxLength = Math.min(b.length, a.length);
	for(var i = 0; i < maxLength; i++) {
		var cmp = this.compare(b[i], a[i]);
		if(cmp != 0) {
			return cmp;
		}
	}
	
	if(b.length > a.length) {
		return -1;	// a before b
	} else if(b.length < a.length) {
		return 1;	// b before a
	}
	
	return 0;
}


Zotero.CSL.SortString.prototype.clone = function() {
	return new Zotero.CSL.SortString();
}