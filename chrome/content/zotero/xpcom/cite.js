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
	
	// load class
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

/*
 * generate an item set
 */
Zotero.CSL.prototype.generateItemSet = function(items) {
	return new Zotero.CSL.ItemSet(items, this);
}

/*
 * create a citation (in-text or footnote)
 */
Zotero.CSL.prototype.createCitation = function(itemSet, items, format, position, locators, locatorTypes) {
	var context = this._csl.citation;
	if(!context) {
		throw "CSL: createCitation called on style with no citation context";
	}
	if(!items.length) {
		throw "CSL: createCitation called with no items";
	}
	
	var string = new Zotero.CSL.FormattedString(this, format, context.layout.@delimiter.toString());
	for(var i in items) {
		if(items[i] == undefined) continue;
		
		if(locators) {
			var locatorType = locatorTypes[i];
			var locator = locators[i];
		} else {
			var locatorType = false;
			var locator = false;
		}
		
		var citationString = new Zotero.CSL.FormattedString(this, format);
		this._processElements(items[i], context.layout, citationString,
			context, position, locator, locatorType);
		string.concat(citationString);
	}
	
	var returnString = new Zotero.CSL.FormattedString(this, format);
	returnString.append(string.get(), context.layout, false, true);
	return returnString.get();
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
		if(item == undefined) continue;
		
		var string = new Zotero.CSL.FormattedString(this, format);
		this._processElements(item, context.layout, string,
			context, "first");
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
	
	for(var j=0; j<variables.length; j++) {
		var success = false;
		newString = formattedString.clone();
		
		if(formattedString.format != "Sort" && variables[j] == "author"
				&& context.option.(@name == "subsequent-author-substitute").length()
				&& item.getProperty("subsequent-author-substitute")
				&& context.localName() == "bibliography") {
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
						
						if(context) {
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
							
							// add additional names to disambiguate
							if(variables[j] == "author" && useEtAl) {
								var disambigNames = item.getProperty("disambiguate-add-names");
								if(disambigNames != "") {
									maxCreators = disambigNames;
									if(disambigNames == creators.length) useEtAl = false;
								}
							}
							
							var authorStrings = [];
							var firstName, lastName;
							
							if(child.@form == "short") {
								var fullNames = item.getProperty("disambiguate-add-givenname").split(",");
							}
						}
						
						// parse authors into strings
						for(var i=0; i<maxCreators; i++) {
							if(formattedString.format == "Sort") {
								// for sort, we use the plain names
								var name = creators[i].getNameVariable("lastName");
								var firstName = creators[i].getNameVariable("firstName");
								if(name && firstName) name += ", ";
								name += firstName;
								
								newString.append(name);
							} else {
								var firstName = "";
								
								if(child.@form != "short" || (fullNames && fullNames.indexOf(i) != -1)) {
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
			if(child["@term"].length()) {
				var term = this._getTerm(child["@term"].toString(), child.@plural.length(), child.@form.toString());
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
						var text = locator;
					} else if(variables[j] == "citation-number") {
						var text = item.getProperty("citation-number");
					} else {
						var text = item.getText(variables[j], form);
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
				if(!macro.length()) throw "CSL: style references undefined macro";
				
				// If not ignored (bc already used as a substitution)
				if(!ignore[1][child.@macro.toString()]) {
					var newString = formattedString.clone(child.@delimiter.toString());
					var success = this._processElements(item, macro, newString,
						context, position, locator, locatorType, ignore);
					
					formattedString.concat(newString, child);
					dataAppended = true;
				}
			} else if(child.@value.length()) {
				formattedString.append(child.@value.toString(), child);
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
					var term = locatorType;
					var value = locator;
				} else {
					var term = variables[j];
					var value = item.getText(variables[j]);
				}
				
				if(term && value) {
					var isPlural = value.indexOf("-") != -1 || value.indexOf("—") != -1 || value.indexOf(",") != -1;
					var text = this._getTerm(term, isPlural, child.@form.toString());
					
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
						
						if(newName == "date-part") {
							var part = newChild.@name.toString();
							var string = date.getDateVariable(part).toString();
							if(string == "") continue;
						
							if(part == "year") {
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
									if(form == "numeric-leading-zeros") {
										if(string.length == 1) {
											string = "0" + string;
										}
									} else if(form == "short") {
										string = this._terms["short"]["_months"][string];
									} else if(form != "numeric") {
										string = this._terms["long"]["_months"][string];
									}
								} else if(form == "numeric") {
									string = "";
								}
							} else if(part == "day") {
								if(form == "numeric-leading-zeros"
										&& string.length() == 1) {
									string = "0" + string;
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

	this.ns = "http://purl.org/net/xbiblio/csl";
	this.collation = Components.classes["@mozilla.org/intl/collation-factory;1"]
	                       .getService(Components.interfaces.nsICollationFactory)
	                       .CreateCollation(Components.classes["@mozilla.org/intl/nslocaleservice;1"]
	                           .getService(Components.interfaces.nsILocaleService)
	                           .getApplicationLocale());

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
	if(!(item instanceof Zotero.Item)) {
		throw "Zotero.CSL.Item called to wrap a non-item";
	} else {
		this.zoteroItem = item;
	}
	
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
	"publisher-place":"place",
	"page":"pages",
	"volume":"volume",
	"issue":"issue",
	"number-of-volumes":"numberOfVolumes",
	"edition":"edition",
	"genre":"type",
	"abstract":"abstract",
	"URL":"url",
	"DOI":"DOI"
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
Zotero.CSL.ItemSet = function(items, csl) {
	this.csl = csl;
	
	this.citation = csl._csl.citation;
	this.bibliography = csl._csl.bibliography;
	
	// collect options
	this.options = new Object();
	options = this.citation.option.(@name.substr(0, 12) == "disambiguate")
		+ this.bibliography.option.(@name == "subsequent-author-substitute");
	for each(var option in options) {
		this.options[option.@name.toString()] = option.@value.toString();
	}
	
	Zotero.debug((this.options["subsequent-author-substitute"] ? "subsequent-author-substitute on" : "subsequent-author-substitute off"));
	
	this.items = [];
	this.itemsById = {};
	
	// add items
	this.add(items);
	
	// check which disambiguation options are enabled
	enabledDisambiguationOptions = new Array();
	for each(var option in ["disambiguate-add-year-suffix",
			"disambiguate-add-givenname", "disambiguate-add-names",
			"disambiguate-add-title"]) {
		if(this.options[option]) {
			enabledDisambiguationOptions.push(option);
		}
	}
	
	if(!items) {
		return;
	}
	
	this.resort();
}

/*
 * Gets CSL.Item objects from an item set using their IDs
 */
Zotero.CSL.ItemSet.prototype.getItemsByIds = function(ids) {
	var items = [];
	for each(var id in ids) {
		if(this.itemsById[id] != undefined) {
			items.push(this.itemsById[id]);
		}
	}
	return items;
}

/*
 * Adds items to the given item set; must be passed either CSL.Item 
 * objects or objects that may be wrapped as CSL.Item objects
 */
Zotero.CSL.ItemSet.prototype.add = function(items) {
	for(var i in items) {
		if(items[i] instanceof Zotero.CSL.Item) {
			var newItem = items[i];
		} else {
			var newItem = new Zotero.CSL.Item(items[i]);
		}
		
		this.itemsById[newItem.getID()] = newItem;
		this.items.push(newItem);
	}
}

/*
 * Removes items from the item set; must be passed either CSL.Item objects
 * or item IDs
 */
Zotero.CSL.ItemSet.prototype.remove = function(items) {
	Zotero.debug("removing!")
	for(var i in items) {
		if(items[i] instanceof Zotero.CSL.Item) {
			var item = items[i];
		} else {
			var item = this.itemsById[items[i]];
		}
		Zotero.debug("old index was "+this.items.indexOf(item))
		this.itemsById[item.getID()] = undefined;
		this.items.splice(this.items.indexOf(item), 1);
	}
}

/*
 * Sorts the item set, also running postprocessing and returning items whose
 * citations have changed
 */
Zotero.CSL.ItemSet.prototype.resort = function() {
	// sort, if necessary
	if(this.bibliography.option.(@name == "sort-algorithm").length()
			&& this.bibliography.option.(@name == "sort-algorithm").@value != "cited") {
		var me = this;
		
		this.items = this.items.sort(function(a, b) {
			return me._compareItem(a, b);
		});
	}
	
	changedCitations = new Array();
	
	// first loop through to collect disambiguation data by item, so we can
	// see if any items have changed
	if(enabledDisambiguationOptions.length) {
		oldDisambiguate = new Array();
		for(var i in enabledDisambiguationOptions) {
			oldDisambiguate[i] = new Array();
			for(var j in this.items) {
				if(this.items[j] == undefined) continue;
				oldDisambiguate[i][j] = this.items[j].getProperty(enabledDisambiguationOptions[i]);
				this.items[j].setProperty(enabledDisambiguationOptions[i], "");
			}
		}
	}
	
	// loop through once to determine where items equal the previous item
	if(enabledDisambiguationOptions.length) {
		citationsEqual = [];
		for(var i in this.items) {
			citationsEqual[i] = this._compareCitations(this.items[i-1], this.items[i]);
		}
	}
	
	var lastItem = false;
	var lastNames = false;
	var lastYear = false;
	var citationNumber = 1;
	
	for(var i in this.items) {
		var item = this.items[i];
		if(item == undefined) continue;
		
		var year = item.getDate("issued");
		if(year) year = year.getDateVariable("year");
		var names = item.getNames("author");
		var disambiguated = false;
		
		// true only if names are an exact match
		var exactMatch = this._compareNames(item, lastItem);
		
		if(enabledDisambiguationOptions.length && i != 0 && !citationsEqual[i]
				&& year == lastYear) {
			// some options can only be applied if there are actual authors
			if(names && lastNames) {				
				if(exactMatch == 0) {
					// copy from previous item
					this._copyDisambiguation(lastItem, item);
				} else {
					// these options only apply if not an _exact_ match
					if(this.options["disambiguate-add-names"]) {
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
					for(var j=0; j<numberOfNames; j++) {
						var lastUnequal = this.options["disambiguate-add-names"]
							&& names[j].getNameVariable("lastName") != lastNames[j].getNameVariable("lastName");
						var firstUnequal = this.options["disambiguate-add-givenname"]
							&& names[j].getNameVariable("firstName") != lastNames[j].getNameVariable("firstName");
						
						if(lastUnequal || firstUnequal) {
							if(this.options["disambiguate-add-names"]) {
								item.setProperty("disambiguate-add-names", j+1);
								
								if(!oldAddNames || oldAddNames < j+1) {
									lastItem.setProperty("disambiguate-add-names", j+1);
								}
							}
							
							// if the difference is only in the first
							// name, show first name
							if(!lastUnequal && firstUnequal) {
								oldAddGivenname = lastItem.getProperty("disambiguate-add-givenname").split(",");
								if(oldAddGivenname) {
									if(oldAddGivenname.indexOf(j) == -1) {
										oldAddGivenname.push(j);
										lastItem.setProperty("disambiguate-add-givenname", oldAddGivenname.join(","));
									}
								} else {
									lastItem.setProperty("disambiguate-add-givenname", j);
								}
								item.setProperty("disambiguate-add-givenname", j);
							}
							
							// add to names before as well
							for(var k=i-2; this._compareNames(lastItem, this.items[k]) == 0; k--) {
								this._copyDisambiguation(lastItem, this.items[k]);
							}
							
							disambiguated = true;
							break;
						}
					}
				}
			}
			
			// add a year suffix, if the above didn't work
			if(!disambiguated && year && this.options["disambiguate-add-year-suffix"]) {
				var lastDisambiguate = lastItem.getProperty("disambiguate-add-year-suffix");
				if(!lastDisambiguate) {
					lastItem.setProperty("disambiguate-add-year-suffix", "a");
					item.setProperty("disambiguate-add-year-suffix", "b");
				} else {
					var newDisambiguate = "";
					if(lastDisambiguate.length > 1) {
						newDisambiguate = oldLetter.substr(0, lastDisambiguate.length-1);
					}
					
					var charCode = lastDisambiguate.charCodeAt(lastDisambiguate.length-1);
					if(charCode == 122) {
						// item is z; add another letter
						newDisambiguate += "a";
					} else {
						// next lowercase letter
						newDisambiguate += String.fromCharCode(charCode+1);
					}
					
					item.setProperty("disambiguate-add-year-suffix", newDisambiguate);
				}
				
				disambiguated = true;
			}
			
			// add a title, if the above didn't work
			if(!disambiguated) {
				lastItem.setProperty("disambiguate-add-title", true);
				item.setProperty("disambiguate-add-title", true);
				
				disambiguated = true;
			}
		}
		
		if(this.options["subsequent-author-substitute"] && names
				&& exactMatch == 0) {
			item.setProperty("subsequent-author-substitute", true);
		}
		
		item.setProperty("citation-number", citationNumber++);
		
		lastItem = item;
		lastNames = names;
		lastYear = year;
	}
	
	// find changed citations
	if(enabledDisambiguationOptions.length) {
		for(var j in this.items) {
			if(this.items[j] == undefined) continue;
			for(var i in enabledDisambiguationOptions) {
				if(this.items[j].getProperty(enabledDisambiguationOptions[i]) != oldDisambiguate[i][j]) {
					changedCitations.push(this.items[j]);
				}
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

/*
 * Compares two items, in order to sort the reference list
 * Returns -1 if A comes before B, 1 if B comes before A, or 0 if they are equal
 */
Zotero.CSL.ItemSet.prototype._compareItem = function(a, b) {
	var sortA = [];
	var sortB = [];
	
	// author
	if(this.bibliography.option.(@name == "sort-algorithm").@value == "author-date") {
		var sortA = new Zotero.CSL.SortString();
		this.csl._processElements(a, this.csl._csl.macro.(@name == "author"), sortA);
		var date = a.getDate("issued");
		if(date) sortA.append(date.getDateVariable("sort"));
		
		var sortB = new Zotero.CSL.SortString();
		this.csl._processElements(b, this.csl._csl.macro.(@name == "author"), sortB);
		var date = b.getDate("issued");
		if(date) sortB.append(date.getDateVariable("sort"));
		
		return sortA.compare(sortB);
	}
	return 0;
}

/*
 * Compares two citations; returns true if they are different, false if they are equal
 */
Zotero.CSL.ItemSet.prototype._compareCitations = function(a, b) {
	if((!a && b) || (a && !b)) {
		return true;
	} else if(!a && !b) {
		return false;
	}
	
	var aString = new Zotero.CSL.FormattedString(this, "Text");
	this.csl._processElements(a, this.citation.layout, aString,
		this.citation, "subsequent");
		
	var bString = new Zotero.CSL.FormattedString(this, "Text");
	this.csl._processElements(b, this.citation.layout, bString,
		this.citation, "subsequent");
	
	return !(aString.get() == bString.get());
}

/*
 * Compares the names from two items
 * Returns -1 if A comes before B, 1 if B comes before A, or 0 if they are equal
 */
Zotero.CSL.ItemSet.prototype._compareNames = function(a, b) {
	if(!a && b) {
		return -1;
	} else if(!b && a) {
		return 1;
	} else if(!b && !a) {
		return 0;
	}
	
	var aString = new Zotero.CSL.SortString();
	this.csl._processElements(a, this.csl._csl.macro.(@name == "author"), aString);
	var bString = new Zotero.CSL.SortString();
	this.csl._processElements(b, this.csl._csl.macro.(@name == "author"), bString);
	
	return aString.compare(bString);
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
			if(element["@text-decoration"] == "underline") {
				string = "\\ul "+string+"\\ul0 ";
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
		} else {
			var cmp = Zotero.CSL.Global.collation.compareString(Zotero.CSL.Global.collation.kCollationCaseInSensitive, a, b);
			if(cmp == 0) {
				// for some reason collation service returned 0; the collation
				// service sucks!
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