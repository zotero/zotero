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
 * Zotero.Cite: a class for creating bibliographies from within Scholar
 * this class handles pulling the CSL file and item data out of the database,
 * while CSL, below, handles the actual generation of the bibliography
 */
default xml namespace = "http://purl.org/net/xbiblio/csl";

Zotero.Cite = new function() {
	var _lastCSL = null;
	var _lastStyle = null;
	
	this.getStyles = getStyles;
	this.getStyleClass = getStyleClass;
	this.getStyle = getStyle;
	
	/*
	 * returns an associative array of cslID => styleName pairs
	 */
	function getStyles() {
		// get styles
		var sql = "SELECT cslID, title FROM csl ORDER BY title";
		var styles = Zotero.DB.query(sql);
		
		// convert to associative array
		var stylesObject = new Object();
		for each(var style in styles) {
			stylesObject[style.cslID] = style.title;
		}
		
		return stylesObject;
	}
	
	/*
	 * gets the class of a given style
	 */
	function getStyleClass(cslID) {
		var csl = _getCSL(cslID);
		var xml = new XML(Zotero.CSL.Global.cleanXML(csl));
		return xml["@class"].toString();
	}
	
	/*
	 * gets CSL from the database, or, if it's the most recently used style,
	 * from the cache
	 */
	function getStyle(cslID) {
		if(_lastStyle != cslID || Zotero.Prefs.get("cacheTranslatorData") == false) {
			// create a CSL instance
			var csl = _getCSL(cslID);
			
			// load CSL in compat mode if it is old-style
			if(csl.indexOf("<defaults") != -1) {
				_lastCSL = new Zotero.CSL.Compat(csl);
			} else {
				_lastCSL = new Zotero.CSL(csl);
			}
			
			_lastStyle = cslID;
		}
		return _lastCSL;
	}
	
	/*
	 * get CSL for a given style from the database
	 */
	function _getCSL(cslID) {
		var style = Zotero.DB.valueQuery("SELECT csl FROM csl WHERE cslID = ?", [cslID]);
		if(!style) throw "Zotero.Cite: invalid CSL ID";
		return style;
	}
}

/*
 * CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */
Zotero.CSL = function(csl) {
	this._csl = new XML(Zotero.CSL.Global.cleanXML(csl));
	
	// initialize CSL
	Zotero.CSL.Global.init();
	
	// load localizations
	this._terms = Zotero.CSL.Global.parseLocales(this._csl.terms);
	
	// load class defaults
	this.class =  this._csl["@class"].toString();
	Zotero.debug("CSL: style class is "+this.class);
	
	this.hasBibliography = (this._csl.bibliography.length() ? 1 : 0);
}

Zotero.CSL._dateVariables = {
	"date":true,
	"accessDate":true
}

Zotero.CSL._namesVariables = {
	"editor":true,
	"translator":true,
	"author":true
}

Zotero.CSL._textVariables = {
	"title":true,
	"container-title":true,
	"collection-title":true,
	"publisher":true,
	"locator":true,
	"pages":true,
	"status":true,
	"identifier":true,
	"version":true,
	"volume":true,
	"issue":true,
	"number-of-volumes":true,
	"medium":true,
	"edition":true,
	"genre":true,
	"note":true,
	"annote":true,
	"abstract":true,
	"keyword":true,
	"number":true,
	"URL":true,
	"DOI":true,
	"status":true
}

/*
 * generate an item set
 */
Zotero.CSL.prototype.generateItemSet = function(items) {
	return new Zotero.CSL.ItemSet(items, this);
}

/*
 * create a citation (in-text or footnote)
 */
Zotero.CSL.prototype.createCitation = function(itemSet, itemIDs, format, position, locators, locatorTypes) {
	var context = this._csl.citation;
	if(!context) {
		throw "CSL: createCitation called on style with no citation context";
	}
	
	// get items
	var items = itemSet.getItemsByIds(itemIDs);
	
	var string = new Zotero.CSL.FormattedString(this, format);
	var lasti = items.length-1;
	
	for(var i in items) {
		var locatorType = false;
		var locator = false;
		if(locators) {
			locatorType = locatorTypes[i];
			locator = locators[i];
		}
		
		var citationString = this._getCitation(items[i], context, format, position, locator, locatorType);
		string.concat(citationString);
		
		if(context.@delimiter.length() && i != lasti) {
			// add delimiter if one exists, and this isn't the last element
			string.append(context.@delimiter.toString());
		}
	}
	
	// add citation prefix or suffix
	string.string = context.layout.@prefix.toString() + string.string;
	if(context.layout.@suffix.length()) {
		string.append(context.layout.@suffix.toString());
	}
	
	return string.get();
}

/*
 * create a bibliography
 */
Zotero.CSL.prototype.createBibliography = function(itemSet, format) {
	var context = this._csl.bibliography;
	if(!context.length()) {
		context = this._csl.citation;
		var isCitation = true;
	}
	if(!context) {
		throw "CSL: createBibliography called on style with no bibliography context";
	}
	
	var output = "";
	
	var hangingIndent = !!context.layout.option.(@name == "hanging-indent");
	var index = 0;
	if(format == "HTML") {
		if(this.class == "note" && isCitation) {
			output += '<ol>\r\n';
		} else if(hangingIndent) {
			output += '<div style="margin-left:0.5in;text-indent:-0.5in;">\r\n';
		}
	} else if(format == "RTF") {
		output += "{\\rtf\\ansi{\\fonttbl\\f0\\froman Times New Roman;}{\\colortbl;\\red255\\green255\\blue255;}\\pard\\f0";
		if(hangingIndent) {
			output += "\\li720\\fi-720";
		}
		output += "\r\n";
	}
	
	for(var i in itemSet.items) {
		var item = itemSet.items[i];
		
		var string = this._getCitation(item, context, format, "first");
		if(!string) {
			continue;
		}
		
		// add format
		string.string = context.layout.@prefix.toString() + string.string;
		if(context.layout.@suffix.length()) {
			string.append(context.layout.@suffix.toString());
		}
		
		string = string.get();
		
		// add line feeds
		if(format == "HTML") {
			var coins = Zotero.OpenURL.createContextObject(item.zoteroItem, "1.0");
			
			var span = (coins ? ' <span class="Z3988" title="'+coins.replace("&", "&amp;")+'"></span>' : '');
			
			if(this.class == "note" && isCitation) {
				output += "<li>"+string+span+"</li>\r\n";
			} else {
				output += "<p>"+string+span+"</p>\r\n";
			}
		} else if(format == "RTF") {
			if(this.class == "note" && isCitation) {
				index++;
				output += index+". ";
			}
			output += string+"\\\r\n\\\r\n";
		} else {
			if(format == "Text" && this.class == "note" && isCitation) {
				index++;
				output += index+". ";
			}
			// attach \n on mac (since both \r and \n count as newlines for
			// clipboard purposes)
			output += string+(Zotero.isMac ? "\n\n" : "\r\n\r\n");
		}
	}
	
	if(format == "HTML") {
		if(this.class == "note" && isCitation) {
			output += '</ol>';
		} else if(hangingIndent) {
			output += '</div>';
		}
	} else if(format == "RTF") {
		// drop last 6 characters of output (last two returns)
		output = output.substr(0, output.length-6)+"}";
	} else {
		// drop last 4 characters (last two returns)
		output = output.substr(0, (Zotero.isMac ? output.length-2 : output.length-4));
	}
	
	return output;
}

/*
 * get a citation, given an item and bibCitElement
 */
Zotero.CSL.prototype._getCitation = function(item, context, format, position, locator, locatorType) {
	Zotero.debug("CSL: generating citation for item");
	
	var formattedString = new Zotero.CSL.FormattedString(this, format);
	this._processElements(item, context.layout, formattedString,
		context, position, locator, locatorType);
	
	return formattedString;
}

/*
 * gets a term, in singular or plural form
 */
Zotero.CSL.prototype._getTerm = function(term, plural, form) {
	if(!form) {
		form = "long";
	}
	
	if(!this._terms[form] || !this._terms[form][term]) {
		Zotero.debug("CSL: WARNING: could not find term \""+term+'" with form "'+form+'"');
		return "";
	}
	
	if(typeof(this._terms[form][term]) == "object") {	// singular and plural forms
	                                                    // are available
		if(plural) {
			return this._terms[form][term][1];
		} else {
			return this._terms[form][term][0];
		}
	}
	
	return this._terms[form][term];
}

/*
 * process creator objects; if someone had a creator model that handled
 * non-Western names better than ours, this would be the function to change
 */
Zotero.CSL.prototype._processNames = function(item, element, formattedString, context, position, variables) {
	var children = element.children();
	if(!children.length()) return false;
	var variableSucceeded = false;
	
	// Special routine for sorted names
	if(formattedString.format == "Sort") {
		for(var j=0; j<variables.length; j++) {
			var creators = item.getNames(variables[j]);
			
			if(creators.length) {
				newString = formattedString.clone();
				
				for each(var creator in creators) {
					var name = creator.getNameVariable("lastName");
					var firstName = creator.getNameVariable("firstName");
					if(name && firstName) name += ", ";
					name += firstName;
					
					newString.append(name);
				}
				
				formattedString.concat(newString);
				variableSucceeded = true;
			}
		}
		
		return variableSucceeded;
	}
	
	var isShort = element.@form.toString() == "short";
			
	for(var j=0; j<variables.length; j++) {
		var success = false;
		newString = formattedString.clone();
		
		if(context.option.(@name == "subsequent-author-substitute").length()
				&& item.getProperty("subsequent-author-substitute")
				&& variables[j] == "author") {
			newString.append(context.option.(@name == "subsequent-author-substitute").@value.toString());
			success = true;
		} else {
			var creators = item.getNames(variables[j]);
			
			if(creators && creators.length) {
				maxCreators = creators.length;
	
				for each(var child in children) {
					if(child.namespace() != Zotero.CSL.Global.ns) continue;
					
					var name = child.localName();
					if(name == "name") {
						var useEtAl = false;
						
						// figure out if we need to use "et al"
						var etAlMin = context.option.(@name == "et-al-min").@value.toString();
						var etAlUseFirst = context.option.(@name == "et-al-use-first").@value.toString();
						
						if(position == "subsequent" && context.option.(@name == "et-al-subsequent-min").length()) {
							etAlMin = context.option.(@name == "et-al-subsequent-min").@value.toString();
						}
						if(position == "subsequent" && context.option.(@name == "et-al-subsequent-use-first").length()) {
							etAlUseFirst = context.option.(@name == "et-al-subsequent-use-first").@value.toString();
						}
						
						if(etAlMin && etAlUseFirst && maxCreators >= parseInt(etAlMin, 10)) {
							maxCreators = parseInt(etAlUseFirst, 10);
							useEtAl = true;
						}
						
						// parse authors into strings
						var authorStrings = [];
						var firstName, lastName;
						for(var i=0; i<maxCreators; i++) {
							var firstName = "";
							if(!isShort && child.@form != "short") {
								if(child["@initialize-with"].length()) {
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
							if((authorStrings.length == 2 && child["@delimiter-precedes-last"] != "always") ||
							   (authorStrings.length > 2 && child["@delimiter-precedes-last"] == "never")) {
								var lastString = authorStrings.pop();
								authorStrings[authorStrings.length-1] = authorStrings[authorStrings.length-1]+" "+lastString;
							}
						}
						newString.append(authorStrings.join(joinString), child);
					} else if(name == "label" && variables[j] != "author") {
						newString.append(this._getTerm(variables[j], (maxCreators != 1), child["@form"].toString()), child);
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
		context, position, locator, locatorType, ignore, isSingle) {
	
	if(!ignore) {
		ignore = new Array();
		ignore[0] = new Array();		// for variables
		ignore[1] = new Array();		// for macros
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
			if(child["@term-name"].length()) {
				var term = this._getTerm(child["@term-name"].toString(), child.@plural.length(), child.@form.toString());
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
					
					var text = item.getText(variables[j], form);
					
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
				if(!macro.length()) throw "CSL: style references undefined macro";
				
				// If not ignored (bc already used as a substitution)
				if(!ignore[1][child.@macro.toString()]) {			
					var newString = formattedString.clone(child.@delimiter.toString());
					var success = this._processElements(item, macro, newString,
						context, position, locatorType, ignore);
					
					formattedString.concat(newString, child);
					dataAppended = true;
				}
			}
		} else if(name == "names") {
			var variables = child["@variable"].toString().split(" ");
			var newString = formattedString.clone(child.@delimiter.toString());
			
			// remove variables that aren't supposed to be there
			for(var j=0; j<variables.length; j++) {
				if(ignore[0][variables[j]]) variables.splice(j, 1);
			}
			
			var success = this._processNames(item, child, newString, context, position, variables);
			
			if(!success && child.substitute.length()) {
				for each(var newChild in child.substitute.children()) {
					if(newChild.namespace() != Zotero.CSL.Global.ns) continue;
					
					if(newChild.localName() == "names" && newChild.children.length() == 0) {
						// apply same rules to substitute names
						// with no children
						variable = newChild.@variable.toString();
						variables = variable.split(" ");
						success = this._processNames(item, child, newString, context, position, variables);
						
						ignore[0][newChild.@variable.toString()] = true;
						
						if(success) break;
					} else {
						if(!newChild.@suffix.length()) newChild.@suffix = element.@suffix;
						if(!newChild.@prefix.length()) newChild.@prefix = element.@prefix;
						
						success = this._processElements(item, 
							newChild, newString, context, position, locator,
							locatorType, ignore, true);
						
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
						
						if(newName == "text") {
							var string = this.CSL._getTerm(newChild["@term-name"].toString(), false, form);
						} else if(newName == "date-part") {
							var part = newChild.@name.toString();
							var string = date.getDateVariable(part);
							if(string == "") continue;
						
							if(part == "year") {
								if(newForm == "short" && string.length == 4 && !isNaN(string*1)) {
									string = string.substr(2, 2);
								}
								
								var disambiguate = item.getProperty("disambiguate");
								if(disambiguate && variable == "published" &&
										context.option.(@name == "disambiguate-year-suffix").length()) {
									string += disambiguate;
								}
							} else if(part == "month") {
								isNumeric = !isNaN(string*1);
								
								if(isNumeric) {
									if(form == "numeric") {
										string = month;
									} else if(form == "short") {
										string = this._terms["short"]["_months"][string];
									} else {
										string = this._terms["long"]["_months"][string];
									}
								} else if(form == "numeric") {
									string = "";
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
				child, newString, context, position, locator, locatorType,
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
					for each(var attribute in ["variable", "type", "position"]) {
						if(newChild["@"+attribute].length()) {
							var variables = newChild["@"+attribute].toString().split(" ");
							for(var j=0; j<variables.length; j++) {
								if(attribute == "variable") {
									var exists = item.getText(variables[j]) !== "";
								} else if(attribute == "type") {
									var exists = item.isType(variables[j]);
								} else {
									var exists = position == variables[j];
								}
								
								if(matchAny) {
									if(exists) {
										truthValue = true;
										break;
									}
								} else if(!exists) {
									truthValue = false;
									break;
								}
							}
							if(truthValue != undefined) break;
						}
					}
				}
				
				if(truthValue) {
					// if true, process
					var newString = formattedString.clone(newChild.@delimiter.toString());			
					var success = this._processElements(item, 
						newChild, newString, context, position, locator, locatorType,
						ignore);
					
					formattedString.concat(newString, child);
					dataAppended = true;
					
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

Zotero.CSL.Global = new function() {
	this.init = init;
	this.getMonthStrings = getMonthStrings;
	this.cleanXML = cleanXML;
	this.parseLocales = parseLocales;
	
	// for types
	this.typeInheritance = { 
		"article-magazine":"article",
		"article-newspaper":"article",
		"article-journal":"article",
		"bill":"article",
		"figure":"article",
		"graphic":"article",
		"interview":"article",
		"legal-case":"article",
		"manuscript":"book",
		"map":"article",
		"motion picture":"book",
		"musical score":"article",
		"pamphlet":"book",
		"paper-conference":"chapter",
		"patent":"article",
		"personal communication":"article",
		"report":"book",
		"song":"article",
		"speech":"article",
		"thesis":"book",
		"treaty":"article",
		"webpage":"article",
	}

	this.ns = "http://purl.org/net/xbiblio/csl";

	/*
	 * initializes CSL interpreter
	 */
	function init() {
		if(!Zotero.CSL.Global._xmlLang) {
			// get XML lang
			Zotero.CSL.Global._xmlLang = Zotero.locale;
			
			// read locales.xml from directory
			var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					  createInstance();
			req.open("GET", "chrome://zotero/locale/locales.xml", false);
			req.overrideMimeType("text/plain");
			req.send(null);
			
			// get default terms
			var locales = new XML(Zotero.CSL.Global.cleanXML(req.responseText));
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
					if(typeof(Zotero.CSL.Global._defaultTerms[i]) == "object") {
						termArray[i][j] = [Zotero.CSL.Global._defaultTerms[i][j][0],
										Zotero.CSL.Global._defaultTerms[i][j][1]];
					} else {
						termArray[i][j] = Zotero.CSL.Global_defaultTerms[i][j];
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
		
		return termArray;
	}
}

/*
 * This is an item wrapper class for Zotero items. If converting this code to
 * work with another application, this is what needs changing. Potentially, this
 * function could accept an ID or an XML data structure instead of an actual
 * item, provided it implements the same public interfaces (those not beginning
 * with "_") are implemented.
 */
Zotero.CSL.Item = function(item) {
	this.zoteroItem = item;
	this._dates = {};
	this._properties = {};
}

/*
 * Returns some identifier for the item. Used to create citations. In Zotero,
 * this is the item ID
 */
Zotero.CSL.Item.prototype.getID = function() {
	return this.zoteroItem.getID();
}

/*
 * Gets an array of Item.Name objects for a variable.
 */
Zotero.CSL.Item.prototype.getNames = function(variable) {
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
	// load date variable if possible
	if(this._dates[variable] == undefined) {
		this._createDate(variable);
	}
	
	if(this._dates[variable]) return this._dates[variable];
	return false;
}

Zotero.CSL.Item._zoteroFieldMap = {
	"title":"title",
	"container-title":"publicationTitle",
	"collection-title":["seriesTitle", "series"],
	"publisher":"publisher",
	"pages":"pages",
	"volume":"volume",
	"issue":"issue",
	"number-of-volumes":"number-of-volumes",
	"edition":"edition",
	"genre":"type",
	"abstract":"abstract",
	"URL":"url",
	"DOI":"doi"
}

/*
 * Gets a text object for a specific type.
 */
Zotero.CSL.Item.prototype.getText = function(variable, form) {
	if(!Zotero.CSL.Item._zoteroFieldMap[variable]) return "";
	
	if(variable == "title" && form == "short") {
		var zoteroFields = ["shortTitle", "title"];
	} else {
		var zoteroFields = Zotero.CSL.Item._zoteroFieldMap[variable];
		if(typeof zoteroFields == "string") zoteroFields = [zoteroFields];
	}
	
	for each(var zoteroField in zoteroFields) {
		var value = this.zoteroItem.getField(zoteroField, false, true);
		if(value != "") return value;
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
	return (this._properties[property] ? this._properties[property] : "");
}

Zotero.CSL.Item._optionalTypeMap = {
	journalArticle:"article-journal",
	magazineArticle:"article-magazine",
	newspaperArticle:"article-newspaper",
	thesis:"thesis",
	letter:"personal communication",
	manuscript:"manuscript",
	interview:"interview",
	film:"motion picture",
	artwork:"graphic",
	webpage:"webpage",
	report:"paper-conference",	// ??
	bill:"bill",
	case:"legal case",
	hearing:"bill",				// ??
	patent:"patent",
	statute:"bill",				// ??
	email:"personal communication",
	map:"map",
	blogPost:"webpage",
	instantMessage:"personal communication",
	forumPost:"webpage",
	audioRecording:"song",		// ??
	presentation:"paper-conference",
	videoRecording:"motion picture",
	tvBroadcast:"motion picture",
	radioBroadcast:"motion picture",
	podcast:"speech",			// ??
	computerProgram:"book"		// ??
};

// TODO: check with Elena/APA/MLA on this
Zotero.CSL.Item._fallbackTypeMap = {
	book:"book",
	bookSection:"chapter",
	journalArticle:"article",
	magazineArticle:"article",
	newspaperArticle:"article",
	thesis:"book",
	letter:"article",
	manuscript:"book",
	interview:"book",
	film:"book",
	artwork:"book",
	webpage:"article",
	report:"book",
	bill:"book",
	case:"book",
	hearing:"book",
	patent:"book",
	statute:"book",
	email:"article",
	map:"article",
	blogPost:"article",
	instantMessage:"article",
	forumPost:"article",
	audioRecording:"article",
	presentation:"article",
	videoRecording:"article",
	tvBroadcast:"article",
	radioBroadcast:"article",
	podcast:"article",
	computerProgram:"book"
};

/*
 * Determines whether this item is of a given type
 */
Zotero.CSL.Item.prototype.isType = function(type) {
	var zoteroType = Zotero.ItemTypes.getName(this.zoteroItem.getType());
	
	return Zotero.CSL.Item._optionalTypeMap[zoteroType] == type
			|| Zotero.CSL.Item._fallbackTypeMap[zoteroType] == type;
}

/*
 * Separates names into different types.
 */
Zotero.CSL.Item.prototype._separateNames = function() {
	this._names = [];
	
	var authorID = Zotero.CreatorTypes.getPrimaryIDForType(this.zoteroItem.getType());
	
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
 * Generates an date object for a given variable (currently supported: published
 * and accessed)
 */
Zotero.CSL.Item.prototype._createDate = function(variable) {
	// first, figure out what date variable to use.
	if(variable == "published") {
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
 * month - returns a month (numeric, or, if numeric is not available, long)
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
		
		if(this.dateArray[variable]) {
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
	return this._zoteroCreator[variable] ? this._zoteroCreator[variable] : "";
}

/*
 * When an array of items are passed to create a new item set, each is wrapped
 * in an item wrapper.
 */
Zotero.CSL.ItemSet = function(unwrappedItems, csl) {
	var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
		.getService(Components.interfaces.nsILocaleService);
	var collationFactory = Components.classes["@mozilla.org/intl/collation-factory;1"]
		.getService(Components.interfaces.nsICollationFactory);
	this._collation = collationFactory.CreateCollation(localeService.getApplicationLocale());
	
	this.csl = csl;
	
	this.postprocess = false;
	this.bib = csl._csl.bibliography;
	if(this.bib.option.(@name == "disambiguate").length()
			|| this.bib.option.(@name == "subsequent-author-substitute").length()) {
		this.postprocess = true;
	}
	
	this.items = [];
	this.itemsById = {};
	
	if(!unwrappedItems) {
		return;
	}
	
	// add data (authors, editors, translators, etc.)
	for(var i in unwrappedItems) {
		var newItem = new Zotero.CSL.Item(unwrappedItems[i]);
		this.items.push(newItem);
		this.itemsById[newItem.getID()] = newItem;
	}
	
	if(this.bib.option.(@name == "sort-algorithm").length()
			&& this.bib.option.(@name == "sort-algorithm").@value != "cited") {
		this.resort();
	}
	
	// run postprocessing (subsequent author substitute and disambiguation)
	if(this.postprocess) {
		var lastItem = false;
		var lastNames = false;
		var lastYear = false;
		
		for(var i in this.items) {
			var item = this.items[i];
			
			var year = item.getDate("published");
			if(year) year = year.getDateVariable("year");
			var names = item.getNames("author");
			
			if(names && lastNames && !this._compareNames(names, lastNames)) {
				if(year && year == lastYear) {
					var oldDisambiguate = lastItem.getProperty("disambiguate");
					if(!oldDisambiguate) {
						lastItem.setProperty("disambiguate", "a");
						item.setProperty("disambiguate", "b");
					} else {
						var newDisambiguate = "";
						if(oldDisambiguate.length > 1) {
							newDisambiguate = oldLetter.substr(0, oldDisambiguate.length-1);
						}
						
						var charCode = oldDisambiguate.charCodeAt(oldDisambiguate.length-1);
						if(charCode == 122) {
							// item is z; add another letter
							newDisambiguate += "a";
						} else {
							// next lowercase letter
							newDisambiguate += String.fromCharCode(charCode+1);
						}
						
						item.setProperty("disambiguate", newDisambiguate);
					}
				}
				
				item.setProperty("subsequent-author-substitute", "1");
			}
			
			item.setProperty("number", i+1);
			
			lastItem = item;
			lastNames = names;
			lastYear = year;
		}
	}
}

/*
 * Sorts the item set, running postprocessing afterwards
 */
Zotero.CSL.ItemSet.prototype.resort = function() {
	var me = this;
	
	this.items = this.items.sort(function(a, b) {
		return me._compareItem(a, b);
	});
}

/*
 * Gets CSL.Item objects from an item set using their IDs
 */
Zotero.CSL.ItemSet.prototype.getItemsByIds = function(ids) {
	var items = [];
	for each(var id in ids) {
		if(this.itemsById[id]) {
			items.push(this.itemsById[id]);
		}
	}
	return items;
}

/*
 * Compares two items, in order to sort the reference list
 * Returns -1 if A comes before B, 1 if B comes before A, or 0 if they are equal
 */
Zotero.CSL.ItemSet.prototype._compareItem = function(a, b) {
	var sortA = [];
	var sortB = [];
	
	// author
	if(this.bib.option.(@name == "sort-algorithm").@value == "author-date") {
		var sortString = new Zotero.CSL.SortString();
		this.csl._processElements(a, this.csl._csl.macro.(@name == "author"), sortString);
		sortA.push(sortString.get().toLowerCase());
		var date = a.getDate("published");
		if(date) sortA.push(date.getDateVariable("sort"));
		
		sortString = new Zotero.CSL.SortString();
		this.csl._processElements(b, this.csl._csl.macro.(@name == "author"), sortString);
		sortB.push(sortString.get().toLowerCase());
		var date = b.getDate("published");
		if(date) sortB.push(date.getDateVariable("sort"));
	}
	
	var compareNum = Math.min(sortA.length, sortB.length);
	for(i=0; i<compareNum; i++) {
		aValue = sortA[i];
		bValue = sortB[i];
		
		if(aValue != bValue) {
			var cmp = this._collation.compareString(0, aValue, bValue);
			return cmp;
		}
	}
	
	if(sortA.length < sortB.length) {
		return -1;
	} else if(sortA.length != sortB.length) {
		return 1;
	}
	
	// finally, give up; they're the same
	return 0;
}

/*
 * Compares the names from two items
 * Returns -1 if A comes before B, 1 if B comes before A, or 0 if they are equal
 */
Zotero.CSL.ItemSet.prototype._compareNames = function(a, b) {
	var sortString = new Zotero.CSL.SortString();
	this.csl._processElements(a, this.bib.macro.(@name == "author"), sortString);
	aString = sortString.get().toLowerCase();
	
	sortString = new Zotero.CSL.SortString();
	this.csl._processElements(b, this.bib.macro.(@name == "author"), sortString);
	bString = sortString.get().toLowerCase();
			
	if(aString != bString) {
		return this._collation.compareString(0, aString, bString);;
	}
	return 0;
}

Zotero.CSL.FormattedString = function(CSL, format, delimiter) {
	this.CSL = CSL;
	this.format = format;
	this.delimiter = delimiter;
	this.string = "";
	this.closePunctuation = false;
	this.useBritishStyleQuotes = false;
	
	if(format == "RTF") {
		this._openQuote = "\\uc0\\u8220 ";
		this._closeQuote = "\\uc0\\u8221 ";
	} else {
		this._openQuote = "\u201c";
		this._closeQuote = "\u201d";
	}
}

Zotero.CSL.FormattedString._punctuation = "!.,?";

/*
 * attaches another formatted string to the end of the current one
 */
Zotero.CSL.FormattedString.prototype.concat = function(formattedString, element) {
	if(!formattedString || !formattedString.string) {
		return false;
	}
	
	if(formattedString.format != this.format) {
		throw "CSL: cannot concatenate formatted strings: formats do not match";
	}
	
	if(formattedString.string) {
		// first, append the actual string
		var haveAppended = this.append(formattedString.string, element, false, true);
		
		// if there's close punctuation to append, that also counts
		if(formattedString.closePunctuation) {
			haveAppended = true;
			if(this.closePunctuation) {
				// if there's existing close punctuation and punctuation to
				// append, we need to append that
				this.string += this.closePunctuation;
			}
			// add the new close punctuation
			this.closePunctuation = formattedString.closePunctuation;
		}
		
		return haveAppended;
	}
	return false;
}

/*
 * appends a string (with format parameters) to the current one
 */
Zotero.CSL.FormattedString.prototype.append = function(string, element, dontDelimit, dontEscape) {
	if(!string) return false;
	if(typeof(string) != "string") {
		string = string.toString();
	}
	
	// append delimiter if necessary
	if(this.delimiter && this.string && !dontDelimit) {
		this.append(this.delimiter, null, true);
	}
	
	// append prefix before closing punctuation
	if(element && element.@prefix.length()) {
		this.append(element.@prefix.toString(), null, true);
	}
	
	// close quotes, etc. using punctuation
	if(this.closePunctuation) {
		if(Zotero.CSL.FormattedString._punctuation.indexOf(string[0]) != -1) {
			this.string += string[0];
			string = string.substr(1);
		}
		this.string += this.closePunctuation;
		this.closePunctuation = false;
	}
	
	// handle text transformation
	if(element) {
		if(element["@text-transform"].length()) {
			if(element["@text-transform"] == "lowercase") {
				// all lowercase
				string = string.toLowerCase();
			} else if(element["@text-transform"] == "uppercase") {
				// all uppercase
				string = string.toUpperCase();
			} else if(element["@text-transform"] == "capitalize") {
				// capitalize first
				string = string[0].toUpperCase()+string.substr(1);
			}
		}
	}
	
	if(!dontEscape) {
		if(this.format == "HTML") {
			var newString = "";
			
			for(var i=0; i<string.length; i++) {
				var charCode = string.charCodeAt(i);
				// Replace certain characters with HTML entities
				switch (charCode) {
					case 38: // &
						newString += '&amp;';
						break;
					case 60: // <
						newString += '&lt;';
						break;
					case 62: // >
						newString += '&gt;';
						break;
					case 8211: // en-dash
						newString += '&#8211;'
						break;
					case 8212: // em-dash
						newString += '&#8212;'
						break;
					default:
						newString += string[i];
				}
			}
			
			string = newString;
			
		} else if(this.format == "RTF") {
			var newString = "";
			
			// go through and fix up unicode entities
			for(var i=0; i<string.length; i++) {
				var charCode = string.charCodeAt(i);
				if(charCode > 127) {			// encode unicode
					newString += "{\\uc0\\u"+charCode.toString()+"}";
				} else if(charCode == 92) {		// double backslashes
					newString += "\\\\";
				} else {
					newString += string[i];
				}
			}
			
			string = newString;
		} else if(this.format == "Integration") {
			string = string.replace(/\\/g, "\\\\");
		}
	}
	
	if(element) {
		if(this.format == "HTML") {
			var style = "";
			
			var cssAttributes = ["font-family", "font-style", "font-variant",
								 "font-weight"];
			for(var j in cssAttributes) {
				var value = element["@"+cssAttributes[j]].toString();
				if(value && value.indexOf('"') == -1) {
					style += cssAttributes[j]+":"+value;
				}
			}
			
			if(style) {
				string = '<span style="'+style+'">'+string+'</span>';
			}
		} else if(this.format == "RTF" || this.format == "Integration") {
			if(element["@font-style"] == "oblique" || element["@font-style"] == "italic") {
				string = "\\i "+string+"\\i0 ";
			}
			if(element["@font-variant"] == "small-caps") {
				string = "\\scaps "+string+"\\scaps0 ";
			}
			if(element["@font-weight"] == "bold") {
				string = "\\b "+string+"\\b0 ";
			}
		}
	
		// add quotes if necessary
		if(element.@quotes.length()) {
			this.string += this._openQuote;
			
			if(this.useBritishStyleQuotes) {
				string += this._closeQuote;
			} else {
				this.closePunctuation = this._closeQuote;
			}
		}
	}
	
	this.string += string;
	
	// special rule: if a variable ends in a punctuation mark, and the suffix
	// begins with a period, chop the period off the suffix
	var suffix;
	if(element && element.@suffix.length()) {
		suffix = element.@suffix.toString(); // copy so as to leave original intact
		
		if(suffix[0] == "." &&
		   Zotero.CSL.FormattedString._punctuation.indexOf(string[string.length-1]) != -1) {
		   // if string already ends in punctuation, preserve the existing stuff
		   // and don't add a period
			suffix = suffix.substr(1);
		}
		
		this.append(suffix, null, true);
	}
	
	return true;
}

/*
 * gets the formatted string
 */
Zotero.CSL.FormattedString.prototype.get = function() {
	return this.string+(this.closePunctuation ? this.closePunctuation : "");
}

/*
 * creates a new formatted string with the same formatting parameters as this one
 */
Zotero.CSL.FormattedString.prototype.clone = function(delimiter) {
	return new Zotero.CSL.FormattedString(this.CSL, this.format, delimiter);
}

/*
 * Implementation of FormattedString for sort purposes.
 */
Zotero.CSL.SortString = function() {
	this.format = "Sort";
	this.string = "";
	this.delimiter = "\u0000"; // null character
}

Zotero.CSL.SortString.prototype.concat = function(string) {
	newString = string.get();
	
	// Replace old delimiter if concatenated string has a delimiter as wel
	if(newString.match("\u0000")) {
		delimiterRegexp = new RegExp(this.delimiter, "g");
		this.delimiter += "\u0000";
		this.string = this.string.replace(delimiterRegexp, this.delimiter);
	}
	
	// append
	this.append(newString);
}

Zotero.CSL.SortString.prototype.append = function(string) {
	if(this.string) {
		this.string += this.delimiter + string;
	} else {
		this.string += string;
	}
}

Zotero.CSL.SortString.prototype.get = function() {
	return this.string;
}


Zotero.CSL.SortString.prototype.clone = function() {
	return new Zotero.CSL.SortString();
}